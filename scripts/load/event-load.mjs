// Load test for one wedding-sized event. Run against STAGING only:
//   node --env-file=scripts/load/.env.load scripts/load/event-load.mjs
// See scripts/load/README.md for setup and pass criteria.
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const env = (name, fallback) => {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing ${name} (see scripts/load/README.md)`);
  }
  return value;
};

const BASE_URL = env("LOAD_BASE_URL").replace(/\/$/, "");
const VENUE_SLUG = env("LOAD_VENUE_SLUG", "demo-event");
const SCREEN_TOKENS = env("LOAD_SCREEN_TOKENS", "demo-screen-1,demo-screen-2").split(",").map((t) => t.trim());
// Optional: auto-approve venues (venues.auto_approve) have nothing to approve, so leave these unset.
const STAFF_EMAIL = process.env.LOAD_STAFF_EMAIL ?? "";
const STAFF_PASSWORD = process.env.LOAD_STAFF_PASSWORD ?? "";
const SUPABASE_URL = env("LOAD_SUPABASE_URL");
const SUPABASE_KEY = env("LOAD_SUPABASE_PUBLISHABLE_KEY");
const GUESTS = Number(env("LOAD_GUESTS", "500"));
const SENDERS = Number(env("LOAD_SENDERS", "300"));
const OPEN_WINDOW_MS = Number(env("LOAD_OPEN_WINDOW_S", "120")) * 1000;
const SEND_WINDOW_MS = Number(env("LOAD_SEND_WINDOW_S", "600")) * 1000;
const TAIL_MS = Number(env("LOAD_TAIL_S", "300")) * 1000;
// Cloudflare's always-pass test token; staging uses Turnstile's test secret during load tests.
const TURNSTILE_TOKEN = env("LOAD_TURNSTILE_TOKEN", "XXXX.DUMMY.TOKEN.XXXX");

const START = Date.now();
const END = START + SEND_WINDOW_MS + TAIL_MS;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const randomBetween = (min, max) => min + Math.random() * (max - min);

// --- Metrics -----------------------------------------------------------------
const latencies = new Map(); // endpoint -> ms[]
const statuses = new Map(); // "endpoint status code" -> count
let totalRequests = 0;

function record(endpoint, ms, status, code) {
  totalRequests += 1;
  if (!latencies.has(endpoint)) latencies.set(endpoint, []);
  latencies.get(endpoint).push(ms);
  const key = `${endpoint} ${status}${code ? ` ${code}` : ""}`;
  statuses.set(key, (statuses.get(key) ?? 0) + 1);
}

async function call(endpoint, path, init = {}) {
  const started = performance.now();
  try {
    const response = await fetch(BASE_URL + path, init);
    const text = await response.text();
    let body = null;
    try {
      body = JSON.parse(text);
    } catch {
      // non-JSON (e.g. Cloudflare error page) — kept as null
    }
    record(endpoint, performance.now() - started, response.status, body?.error?.code);
    return { status: response.status, body, headers: response.headers };
  } catch (error) {
    record(endpoint, performance.now() - started, 0, "network_error");
    return { status: 0, body: null, headers: new Headers(), error };
  }
}

// --- Fake photos ---------------------------------------------------------------
// A real 1×1 JPEG padded after its end marker: decoders ignore the padding, and the
// sizes match what phones upload (~350 KB screen, ~30 KB thumbnail).
const TINY_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAA//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AN//Z",
  "base64",
);
const padded = (bytes) => new Blob([TINY_JPEG, Buffer.alloc(bytes)], { type: "image/jpeg" });
const SCREEN_PHOTO = padded(350_000);
const THUMB_PHOTO = padded(30_000);

// --- Guests --------------------------------------------------------------------
const outcomes = { submitted: 0, rejectedByLimit: 0, failed: 0, reachedScreen: 0 };

function pollDelay(status) {
  // Mirrors features/guest-submission/hooks/useSubmissionStatus.ts
  const jitter = (ms) => ms * randomBetween(0.8, 1.2);
  if (status.status === "approved") {
    return jitter(Math.min(30_000, Math.max(5_000, (status.queuePosition ?? 1) * 3_000)));
  }
  if (status.status === "playing" && status.endsAt) {
    return Math.max(500, Date.parse(status.endsAt) - Date.parse(status.serverNow) + 500);
  }
  return jitter(10_000);
}

async function guest(index) {
  await sleep(randomBetween(0, OPEN_WINDOW_MS));
  const venue = await call("GET venue", `/api/venues/${VENUE_SLUG}`);
  if (index >= SENDERS || venue.status !== 200) {
    return;
  }
  const tier = venue.body.data.tiers[0];

  await sleep(randomBetween(0, Math.max(0, SEND_WINDOW_MS - OPEN_WINDOW_MS)));
  const form = new FormData();
  form.set("venueSlug", VENUE_SLUG);
  form.set("screen", SCREEN_PHOTO, "screen.jpg");
  form.set("thumb", THUMB_PHOTO, "thumb.jpg");
  const photo = await call("POST photos", "/api/submissions/photos", { method: "POST", body: form });
  if (photo.status !== 200) {
    outcomes.failed += 1;
    return;
  }

  const created = await call("POST submissions", "/api/submissions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      venueSlug: VENUE_SLUG,
      tierId: tier.id,
      message: `Load test ${index} 🎉`,
      instagram: `load.guest${index}`,
      lineId: `load.line${index}`,
      photoPath: photo.body.data.photoPath,
      deviceId: `load-device-${index}`,
      turnstileToken: TURNSTILE_TOKEN,
    }),
  });
  if (created.status !== 200) {
    const code = created.body?.error?.code;
    if (code === "queue_full" || code === "too_many_pending") outcomes.rejectedByLimit += 1;
    else outcomes.failed += 1;
    return;
  }
  outcomes.submitted += 1;

  const token = created.body.data.publicToken;
  while (Date.now() < END) {
    const status = await call("GET status", `/api/submissions/${token}`);
    const data = status.body?.data;
    if (!data) {
      await sleep(10_000);
      continue;
    }
    if (data.status === "playing") outcomes.reachedScreen += 1;
    if (["played", "rejected", "removed"].includes(data.status)) return;
    await sleep(pollDelay(data));
  }
}

// --- Approver bot -------------------------------------------------------------
async function approver() {
  if (!STAFF_EMAIL) {
    console.log("No LOAD_STAFF_EMAIL: skipping the approver bot (auto-approve venue).");
    return null;
  }
  const login = await call("POST login", "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: STAFF_EMAIL, password: STAFF_PASSWORD }),
  });
  if (login.status !== 200) throw new Error(`Staff login failed (${login.status}); check LOAD_STAFF_*`);
  const cookie = login.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  const authed = { headers: { cookie } };

  const venues = await call("GET staff venues", "/api/staff/venues", authed);
  const venueId = venues.body.data.find((v) => v.slug === VENUE_SLUG)?.id;
  if (!venueId) throw new Error(`Staff user is not staff of ${VENUE_SLUG}`);

  let tick = 0;
  while (Date.now() < START + SEND_WINDOW_MS + 60_000) {
    tick += 1;
    const pending = await call("GET pending", `/api/approvals/pending?venueId=${venueId}&limit=40`, authed);
    const items = pending.body?.data?.items ?? [];
    if (tick % 10 === 0 && items.length > 1) {
      // Every 10s a staff member bulk-approves what's on screen.
      await call("POST bulk approve", "/api/approvals/bulk-approve", {
        method: "POST",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ venueId, submissionIds: items.slice(0, 10).map((s) => s.id) }),
      });
    } else if (items.length > 0) {
      await call("POST approve", `/api/approvals/${items[0].id}/approve`, { method: "POST", ...authed });
    }
    await sleep(1_000);
  }
  return venueId;
}

// --- Screens --------------------------------------------------------------------
const firstSeen = new Map(); // submissionId -> Map(screenToken -> ms)
let realtimeChannels = 0;

async function screen(screenToken) {
  let venueId = null;
  let endsAt = null;
  let nextTimer = null;

  const sync = async () => {
    const result = await call("POST screen sync", `/api/screens/${screenToken}/sync`, { method: "POST" });
    const data = result.body?.data;
    if (!data) return;
    venueId = data.venue.id;
    if (data.current) {
      if (!firstSeen.has(data.current.id)) firstSeen.set(data.current.id, new Map());
      const seen = firstSeen.get(data.current.id);
      if (!seen.has(screenToken)) seen.set(screenToken, Date.now());
    }
    endsAt = data.current ? Date.parse(data.endsAt) - Date.parse(data.serverNow) + Date.now() : null;
    clearTimeout(nextTimer);
    if (endsAt) nextTimer = setTimeout(sync, Math.max(0, endsAt - Date.now()) + 300);
  };

  await sync();
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
  const channel = supabase
    .channel(`venue:${venueId}:screen`)
    .on("broadcast", { event: "screen_state_changed" }, () => void sync())
    .subscribe((status) => {
      if (status === "SUBSCRIBED") realtimeChannels += 1;
    });

  while (Date.now() < END) {
    await sleep(15_000);
    await sync();
  }
  clearTimeout(nextTimer);
  await supabase.removeChannel(channel);
}

// --- Report -------------------------------------------------------------------
function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

function report() {
  const endpoints = [...latencies.entries()].map(([endpoint, values]) => ({
    endpoint,
    count: values.length,
    p50: Math.round(percentile(values, 50)),
    p95: Math.round(percentile(values, 95)),
    max: Math.round(Math.max(...values)),
  }));
  const drifts = [...firstSeen.values()]
    .filter((seen) => seen.size === SCREEN_TOKENS.length)
    .map((seen) => Math.max(...seen.values()) - Math.min(...seen.values()));
  const serverErrors = [...statuses.entries()].filter(([key]) => / (5\d\d|0) ?/.test(key));

  const summary = {
    target: BASE_URL,
    durationMinutes: Math.round((Date.now() - START) / 60_000),
    totalRequests,
    guests: GUESTS,
    senders: SENDERS,
    outcomes,
    realtimeChannels,
    screenDriftMs: { items: drifts.length, p95: percentile(drifts, 95), max: drifts.length ? Math.max(...drifts) : 0 },
    endpoints,
    statuses: Object.fromEntries(statuses),
    pass: {
      p95Under600ms: endpoints.every((e) => e.p95 < 600),
      no5xx: serverErrors.length === 0,
      screenDriftUnder500ms: drifts.every((d) => d < 500),
    },
  };

  console.table(endpoints);
  console.log(JSON.stringify(summary, null, 2));
  const file = join(import.meta.dirname, `results-${new Date(START).toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, JSON.stringify(summary, null, 2));
  console.log(`\nSaved ${file}`);
}

// --- Run ------------------------------------------------------------------------
console.log(`Load test → ${BASE_URL}: ${GUESTS} guests, ${SENDERS} senders, ${SCREEN_TOKENS.length} screens`);
const progress = setInterval(
  () => console.log(`[${Math.round((Date.now() - START) / 1000)}s] requests=${totalRequests} ${JSON.stringify(outcomes)}`),
  15_000,
);
try {
  await Promise.all([
    approver(),
    ...SCREEN_TOKENS.map(screen),
    ...Array.from({ length: GUESTS }, (_, index) => guest(index)),
  ]);
} finally {
  clearInterval(progress);
  report();
}
