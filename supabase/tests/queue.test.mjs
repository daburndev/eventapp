// Runs the real migrations against in-memory Postgres (PGlite) with small stand-ins
// for Supabase's auth / realtime / storage / cron schemas, then exercises the queue.
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

const root = join(import.meta.dirname, "..", "..");
const db = new PGlite({ extensions: { pgcrypto } });

await db.exec(`
  create role anon; create role authenticated; create role service_role;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  create schema realtime;
  create table realtime.sent (id serial, payload jsonb, event text, topic text, private boolean);
  create function realtime.send(payload jsonb, event text, topic text, private boolean) returns void
    language sql as $$ insert into realtime.sent (payload, event, topic, private) values ($1, $2, $3, $4) $$;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create schema cron;
  create function cron.schedule(name text, schedule text, command text) returns bigint language sql as $$ select 1::bigint $$;
`);

const migrationsDir = join(root, "supabase", "migrations");
for (const file of readdirSync(migrationsDir).sort()) {
  const sql = readFileSync(join(migrationsDir, file), "utf8").replace(/create extension if not exists pg_cron;/, "");
  await db.exec(sql);
  console.log("applied", file);
}
await db.exec(readFileSync(join(root, "supabase", "seed.sql"), "utf8"));

const STAFF = "11111111-1111-1111-1111-111111111111";
const OUTSIDER = "22222222-2222-2222-2222-222222222222";
await db.exec(`
  insert into auth.users values ('${STAFF}', 'staff@test'), ('${OUTSIDER}', 'other@test');
  insert into public.staff_members (user_id, organization_id, role)
  values ('${STAFF}', '00000000-0000-0000-0000-000000000001', 'owner');
`);

async function asUser(uid) {
  await db.exec(`select set_config('test.uid', '${uid ?? ""}', false)`);
}
async function rpc(fn, payload = {}) {
  const res = await db.query(`select public.${fn}($1::jsonb) as r`, [JSON.stringify(payload)]);
  return res.rows[0].r;
}
async function rpcError(fn, payload = {}) {
  try {
    await rpc(fn, payload);
  } catch (error) {
    return error.message;
  }
  throw new Error(`${fn} should have failed`);
}
async function expireCurrent() {
  await db.exec(`update public.screen_state set ends_at = now() - interval '1 second'`);
}
const VENUE_ID = "00000000-0000-0000-0000-000000000010";
// The seeded venue skips approval (wedding). Most of this file tests the approval flow, so turn it back on;
// the auto-approve path has its own section below.
assert.equal((await db.query(`select auto_approve from public.venues where id = '${VENUE_ID}'`)).rows[0].auto_approve, true);
await db.exec(`update public.venues set auto_approve = false where id = '${VENUE_ID}'`);

// --- Guest side ---------------------------------------------------------------
await asUser(null);
const venue = await rpc("get_venue_public", { venueSlug: "demo-event" });
assert.equal(venue.name, "Demo Event");
assert.deepEqual(venue.tiers.map((t) => t.durationSeconds), [15, 30, 60]);
assert.ok("serviceType" in venue && "isAccepting" in venue, "camelCase keys");
const [tier15, tier30] = venue.tiers;

assert.match(await rpcError("get_venue_public", { venueSlug: "nope" }), /venue_not_found/);

const make = (deviceId, message, tierId = tier15.id, extra = {}) =>
  rpc("create_submission", { venueSlug: "demo-event", tierId, message, deviceId, instagram: "@cam.sky", ...extra });

const a = await make("dev-a", "Message A");
const b = await make("dev-b", "Message B", tier30.id);
const c = await make("dev-c", "Message C");
const d = await make("dev-d", "Message D");
assert.equal(a.status, "pending_approval");

assert.match(await rpcError("create_submission", { venueSlug: "demo-event", tierId: tier15.id, message: "", deviceId: "x" }), /invalid_message/);
assert.match(await rpcError("create_submission", { venueSlug: "demo-event", tierId: tier15.id, message: "hi", deviceId: "x", instagram: "bad handle!" }), /invalid_instagram/);
assert.match(
  await rpcError("create_submission", { venueSlug: "demo-event", tierId: tier15.id, message: "hi", deviceId: "x", photoPath: "other-venue/x.jpg" }),
  /invalid_photo/,
);
// Per-device limit comes from venues.max_open_per_device (default 2).
await make("spammer", "1");
await make("spammer", "2");
assert.match(await rpcError("create_submission", { venueSlug: "demo-event", tierId: tier15.id, message: "3", deviceId: "spammer" }), /too_many_pending/);

const statusA = await rpc("get_submission_status", { publicToken: a.publicToken });
assert.equal(statusA.instagram, "cam.sky", "leading @ stripped");
assert.equal(statusA.venueId, VENUE_ID);
assert.equal(statusA.venueName, "Demo Event");

// --- Staff permission checks ----------------------------------------------------
assert.match(await rpcError("list_pending_submissions", { venueId: VENUE_ID }), /not_authenticated/);
await asUser(OUTSIDER);
assert.match(await rpcError("list_pending_submissions", { venueId: VENUE_ID }), /forbidden/);
assert.deepEqual(await rpc("list_my_venues"), []);

await asUser(STAFF);
const myVenues = await rpc("list_my_venues");
assert.equal(myVenues[0].role, "owner");
const pending = await rpc("list_pending_submissions", { venueId: VENUE_ID });
assert.equal(pending.items.length, 6);
assert.equal(pending.total, 6);
const idOf = async (token) => (await rpc("get_submission_status", { publicToken: token })).id;
const [idA, idB, idC, idD] = await Promise.all([a, b, c, d].map((s) => idOf(s.publicToken)));

// --- Approved while no screen is on: waits instead of burning its time -----------
await rpc("approve_submission", { submissionId: idA });
assert.equal((await rpc("get_submission_status", { publicToken: a.publicToken })).status, "approved");

// --- First screen connects: A starts --------------------------------------------
await asUser(null);
let screen = await rpc("screen_sync", { screenToken: "demo-screen-1" });
assert.equal(screen.current.id, idA);
assert.equal(screen.venue.slug, "demo-event");
assert.match(await rpcError("screen_sync", { screenToken: "wrong" }), /screen_not_found/);

// --- More approvals queue up behind A ---------------------------------------------
await asUser(STAFF);
await rpc("approve_submission", { submissionId: idB });
await rpc("approve_submission", { submissionId: idC });
assert.match(await rpcError("approve_submission", { submissionId: idA }), /invalid_status/);
await rpc("reject_submission", { submissionId: idD, reason: "Spam or advertising" });

await asUser(null);
const s1 = await rpc("screen_sync", { screenToken: "demo-screen-1" });
const s2 = await rpc("screen_sync", { screenToken: "demo-screen-2" });
assert.equal(s1.current.id, idA, "A plays first (FIFO)");
assert.equal(s2.current.id, idA, "both screens show the same item");
assert.equal(s1.endsAt, s2.endsAt, "same end time on both screens");
assert.equal(s1.queueLength, 2);

const statusB = await rpc("get_submission_status", { publicToken: b.publicToken });
assert.equal(statusB.status, "approved");
assert.equal(statusB.queuePosition, 1);
const statusC = await rpc("get_submission_status", { publicToken: c.publicToken });
assert.equal(statusC.queuePosition, 2);
const statusD = await rpc("get_submission_status", { publicToken: d.publicToken });
assert.equal(statusD.status, "rejected");
assert.equal(statusD.rejectionReason, "Spam or advertising");

// Repeated syncs before the item ends must not advance anything.
for (let i = 0; i < 5; i += 1) {
  const again = await rpc("screen_sync", { screenToken: i % 2 ? "demo-screen-1" : "demo-screen-2" });
  assert.equal(again.current.id, idA);
}

// --- Item ends: next one plays, previous marked played ---------------------------
await expireCurrent();
const afterA = await rpc("screen_sync", { screenToken: "demo-screen-2" });
assert.equal(afterA.current.id, idB);
assert.equal(afterA.current.durationSeconds, 30);
const again = await rpc("screen_sync", { screenToken: "demo-screen-1" });
assert.equal(again.current.id, idB, "second screen doesn't skip B");
assert.equal((await rpc("get_submission_status", { publicToken: a.publicToken })).status, "played");
assert.equal((await rpc("get_submission_status", { publicToken: b.publicToken })).status, "playing");

// --- Staff skip & remove --------------------------------------------------------
await asUser(STAFF);
const queueBefore = await rpc("get_queue", { venueId: VENUE_ID });
assert.equal(queueBefore.nowPlaying.current.id, idB);
assert.deepEqual(queueBefore.upNext.map((s) => s.id), [idC]);

await rpc("skip_current", { venueId: VENUE_ID });
let q = await rpc("get_queue", { venueId: VENUE_ID });
assert.equal(q.nowPlaying.current.id, idC, "skip moves to C");

await rpc("remove_submission", { submissionId: idC });
q = await rpc("get_queue", { venueId: VENUE_ID });
assert.equal(q.nowPlaying.current, null, "queue empty → idle");
assert.equal((await rpc("get_submission_status", { publicToken: c.publicToken })).status, "removed");

// --- Cron fallback only advances venues with a recently seen screen --------------
const e = await make("dev-e", "Message E");
await rpc("approve_submission", { submissionId: await idOf(e.publicToken) });
await expireCurrent();
await db.exec(`update public.screens set last_seen_at = now() - interval '5 minutes'`);
await db.exec(`select private.advance_active_queues()`);
q = await rpc("get_queue", { venueId: VENUE_ID });
assert.equal(q.nowPlaying.current.status, "playing", "E kept as-is while screens offline");
const eEndsAt = q.nowPlaying.endsAt;
await db.exec(`update public.screens set last_seen_at = now()`);
await db.exec(`select private.advance_active_queues()`);
q = await rpc("get_queue", { venueId: VENUE_ID });
assert.equal(q.nowPlaying.current, null, "E finished once a screen is online");
assert.ok(eEndsAt, "E had an end time");

// --- Bulk approve keeps the given order; ETA; next item for screen preload -------
await asUser(null);
const f = await make("dev-f", "Message F");
const g = await make("dev-g", "Message G", tier30.id);
const h = await make("dev-h", "Message H");
const [idF, idG, idH] = await Promise.all([f, g, h].map((s) => idOf(s.publicToken)));

await asUser(STAFF);
const firstPage = await rpc("list_pending_submissions", { venueId: VENUE_ID, limit: 2 });
assert.equal(firstPage.items.length, 2, "pending list honours limit");
assert.equal(firstPage.total, 5, "total counts every pending item");

const bulk = await rpc("approve_submissions", { venueId: VENUE_ID, submissionIds: [idH, idF, idG, idA] });
assert.deepEqual(bulk.approvedIds, [idH, idF, idG]);
assert.equal(bulk.skippedCount, 1, "already-handled A is skipped");

await asUser(null);
const afterBulk = await rpc("screen_sync", { screenToken: "demo-screen-1" });
assert.equal(afterBulk.current.id, idH, "bulk order kept: H first");
assert.equal(afterBulk.next.id, idF, "screen gets the next item to preload");
const statusG = await rpc("get_submission_status", { publicToken: g.publicToken });
assert.equal(statusG.queuePosition, 2);
assert.ok(statusG.etaSeconds > 15 && statusG.etaSeconds <= 30, `ETA = rest of H + F (got ${statusG.etaSeconds})`);

// --- Queue capacity limit ----------------------------------------------------------
await db.exec(`update public.venues set max_queue_seconds = 60 where id = '${VENUE_ID}'`);
assert.match(await rpcError("create_submission", { venueSlug: "demo-event", tierId: tier15.id, message: "late", deviceId: "dev-late" }), /queue_full/);
const fullVenue = await rpc("get_venue_public", { venueSlug: "demo-event" });
assert.equal(fullVenue.isQueueFull, true);
assert.ok(fullVenue.queueMinutes >= 1);
await db.exec(`update public.venues set max_queue_seconds = 2700 where id = '${VENUE_ID}'`);

// --- PDPA: every venue scrubs each submission once it's finished (0012) ----------
const receivedBefore = (await db.query(`select count(*)::int as n from public.audit_log where action = 'submission_received'`)).rows[0].n;
const BAR = "00000000-0000-0000-0000-000000000020";
await db.exec(`
  insert into public.venues (id, organization_id, slug, name, service_type)
  values ('${BAR}', '00000000-0000-0000-0000-000000000001', 'demo-bar', 'Demo Bar', 'venue');
  insert into public.tiers (id, venue_id, label, duration_seconds)
  values ('00000000-0000-0000-0000-000000000021', '${BAR}', '15 seconds', 15);
  insert into public.submissions (id, venue_id, tier_id, message, instagram, photo_path, device_id)
  values ('00000000-0000-0000-0000-000000000022', '${BAR}', '00000000-0000-0000-0000-000000000021',
          'Bar message', 'bar.ig', '${BAR}/bar.jpg', 'dev-bar');
`);
await asUser(STAFF);
await rpc("reject_submission", { submissionId: "00000000-0000-0000-0000-000000000022", reason: null });
const barRow = (await db.query(`select message, instagram, photo_path, personal_data_deleted_at from public.submissions where id = '00000000-0000-0000-0000-000000000022'`)).rows[0];
assert.equal(barRow.message, "[deleted]");
assert.equal(barRow.instagram, null);
assert.equal(barRow.photo_path, null);
assert.ok(barRow.personal_data_deleted_at, "scrub time recorded");
const queuedPaths = async () => (await db.query(`select photo_path from public.photo_deletions order by id`)).rows.map((r) => r.photo_path);
assert.deepEqual(await queuedPaths(), [`${BAR}/bar.jpg`]);

// Events too: the played E above was scrubbed as soon as its slot ended, not at event end.
const eRow = (await db.query(`select message from public.submissions where id = '${await idOf(e.publicToken)}'`)).rows[0];
assert.equal(eRow.message, "[deleted]");

// --- PDPA: "End event" clears the queue and scrubs everything ---------------------
await db.exec(`update public.submissions set photo_path = '${VENUE_ID}/' || id || '.jpg' where id in ('${idF}', '${idG}')`);
await asUser(OUTSIDER);
assert.match(await rpcError("end_event", { venueId: VENUE_ID }), /forbidden/);
await asUser(STAFF);
const ended = await rpc("end_event", { venueId: VENUE_ID });
assert.ok(ended.endedAt);
const leftovers = await db.query(`
  select count(*) filter (where personal_data_deleted_at is null)::int as unscrubbed,
         count(*) filter (where status in ('pending_approval', 'approved', 'playing'))::int as open
  from public.submissions where venue_id = '${VENUE_ID}'`);
assert.deepEqual(leftovers.rows[0], { unscrubbed: 0, open: 0 });
assert.equal((await rpc("get_queue", { venueId: VENUE_ID })).nowPlaying.current, null);
assert.ok((await queuedPaths()).includes(`${VENUE_ID}/${idF}.jpg`));
await asUser(null);
assert.match(await rpcError("create_submission", { venueSlug: "demo-event", tierId: tier15.id, message: "after", deviceId: "dev-after" }), /venue_closed/);
assert.equal((await rpc("get_submission_status", { publicToken: g.publicToken })).message, "[deleted]");

// --- PDPA: events end automatically at event_ends_at ------------------------------
await db.exec(`
  insert into public.venues (id, organization_id, slug, name, service_type, event_ends_at) values
    ('00000000-0000-0000-0000-000000000030', '00000000-0000-0000-0000-000000000001', 'past-wedding', 'Past', 'event', now() - interval '1 minute'),
    ('00000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000001', 'future-wedding', 'Future', 'event', now() + interval '1 day');
  insert into public.tiers (id, venue_id, label, duration_seconds)
  values ('00000000-0000-0000-0000-000000000032', '00000000-0000-0000-0000-000000000030', '15 seconds', 15);
  insert into public.submissions (venue_id, tier_id, message, instagram, device_id)
  values ('00000000-0000-0000-0000-000000000030', '00000000-0000-0000-0000-000000000032', 'Congrats!', 'guest.ig', 'dev-w');
  select private.end_due_events();
`);
const dueRows = (await db.query(`select slug, ended_at is not null as ended from public.venues where slug in ('past-wedding', 'future-wedding') order by slug`)).rows;
assert.deepEqual(dueRows, [{ slug: "future-wedding", ended: false }, { slug: "past-wedding", ended: true }]);
const weddingMsg = (await db.query(`select message, instagram from public.submissions where venue_id = '00000000-0000-0000-0000-000000000030'`)).rows[0];
assert.deepEqual(weddingMsg, { message: "[deleted]", instagram: null });

const receivedAfter = (await db.query(`select count(*)::int as n from public.audit_log where action = 'submission_received'`)).rows[0].n;
assert.equal(receivedAfter, receivedBefore, "dashboard counts survive scrubbing");

// --- R2 deletion queue: claim → confirm, with a lease ------------------------------
const total = (await queuedPaths()).length;
await db.exec(`grant usage on schema public to service_role`);
await db.exec(`set role service_role`);
const claim1 = await rpc("claim_photo_deletions", { limit: 2 });
assert.equal(claim1.length, 2);
const claim2 = await rpc("claim_photo_deletions", { limit: 10 });
assert.equal(claim2.length, total - 2, "claimed rows aren't handed out twice");
assert.equal((await rpc("claim_photo_deletions", {})).length, 0);
await db.exec(`reset role`);
await db.exec(`update public.photo_deletions set claimed_at = now() - interval '6 minutes' where id = ${claim1[0].id}`);
await db.exec(`set role service_role`);
assert.equal((await rpc("claim_photo_deletions", {})).length, 1, "expired lease is retried");
const confirmed = await rpc("confirm_photo_deletions", { ids: [...claim1, ...claim2].map((r) => r.id) });
assert.equal(confirmed.confirmed, total);
await db.exec(`reset role`);
assert.equal((await queuedPaths()).length, 0);

// --- Auto-approve: messages skip approval, keep arrival order and start playing ---
const AUTO = "00000000-0000-0000-0000-000000000040";
await db.exec(`
  insert into public.venues (id, organization_id, slug, name, service_type, auto_approve)
  values ('${AUTO}', '00000000-0000-0000-0000-000000000001', 'auto-wedding', 'Auto', 'event', true);
  insert into public.tiers (id, venue_id, label, duration_seconds)
  values ('00000000-0000-0000-0000-000000000041', '${AUTO}', '15 seconds', 15);
  insert into public.screens (venue_id, name, token) values ('${AUTO}', 'Projector', 'auto-screen');
`);
await asUser(null);
await rpc("screen_sync", { screenToken: "auto-screen" });
const autoMake = (deviceId, message) =>
  rpc("create_submission", { venueSlug: "auto-wedding", tierId: "00000000-0000-0000-0000-000000000041", message, deviceId });
const auto1 = await autoMake("dev-x", "Auto one");
assert.equal(auto1.status, "approved", "no approval step");
const auto2 = await autoMake("dev-y", "Auto two");
const auto3 = await autoMake("dev-z", "Auto three");
const autoSync = await rpc("screen_sync", { screenToken: "auto-screen" });
assert.equal(autoSync.current.message, "Auto one", "first message starts playing right away");
assert.equal(autoSync.next.message, "Auto two", "arrival order is queue order");
assert.equal((await rpc("get_submission_status", { publicToken: auto3.publicToken })).queuePosition, 2);
await asUser(STAFF);
assert.equal((await rpc("list_pending_submissions", { venueId: AUTO })).total, 0, "nothing waits for staff");
assert.equal((await rpc("get_queue", { venueId: AUTO })).upNext.length, 2, "staff can still see (and remove) queued messages");
await asUser(null);
const autoLogs = (await db.query(`select actor_type, details from public.audit_log where venue_id = '${AUTO}' and action = 'submission_approved'`)).rows;
assert.equal(autoLogs.length, 3);
assert.ok(autoLogs.every((r) => r.actor_type === "system" && r.details.auto === true), "logged as auto-approved");
assert.ok(auto2.publicToken);

// The wedding case: once a message's time on screen is up, its photo is queued for R2 deletion
// and its text is cleared straight away, while the next message plays.
await db.exec(`update public.submissions set photo_path = '${AUTO}/auto1.jpg', instagram = 'auto.ig' where public_token = '${auto1.publicToken}'`);
await expireCurrent();
const afterAuto1 = await rpc("screen_sync", { screenToken: "auto-screen" });
assert.equal(afterAuto1.current.message, "Auto two", "next message plays");
const auto1Row = (await db.query(`select status, message, instagram, photo_path from public.submissions where public_token = '${auto1.publicToken}'`)).rows[0];
assert.deepEqual(auto1Row, { status: "played", message: "[deleted]", instagram: null, photo_path: null });
assert.ok(
  (await db.query(`select 1 from public.photo_deletions where photo_path = '${AUTO}/auto1.jpg'`)).rows.length === 1,
  "shown photo is queued for deletion from R2 right after its slot",
);

// --- LINE ID: optional, stored lowercase without @, validated, scrubbed with the rest ---
const withLine = await rpc("create_submission", {
  venueSlug: "auto-wedding", tierId: "00000000-0000-0000-0000-000000000041", message: "Line one", deviceId: "dev-line", lineId: "@Pop.Prince_1",
});
const lineStatus = await rpc("get_submission_status", { publicToken: withLine.publicToken });
assert.equal(lineStatus.lineId, "pop.prince_1");
assert.equal((await rpc("get_submission_status", { publicToken: auto1.publicToken })).lineId, null, "LINE ID is optional");
assert.match(
  await rpcError("create_submission", { venueSlug: "auto-wedding", tierId: "00000000-0000-0000-0000-000000000041", message: "x", deviceId: "dev-bad", lineId: "ab" }),
  /invalid_line_id/,
);
await asUser(STAFF);
await rpc("end_event", { venueId: AUTO });
await asUser(null);
const lineAfterEnd = (await db.query(`select line_id, message from public.submissions where public_token = '${withLine.publicToken}'`)).rows[0];
assert.deepEqual(lineAfterEnd, { line_id: null, message: "[deleted]" }, "LINE ID is scrubbed at event end (PDPA)");

// --- Audit log + realtime signals ------------------------------------------------
const audit = await db.query(`select action, count(*)::int as n from public.audit_log group by action order by action`);
const actions = Object.fromEntries(audit.rows.map((r) => [r.action, r.n]));
console.log("audit_log:", actions);
for (const action of ["submission_received", "submission_approved", "submission_rejected", "submission_started", "submission_played", "submission_skipped", "submission_removed", "screen_connected"]) {
  assert.ok(actions[action] > 0, `audit has ${action}`);
}
const staffRows = await db.query(`select count(*)::int as n from public.audit_log where actor_type = 'staff' and actor_user_id = '${STAFF}'`);
assert.ok(staffRows.rows[0].n > 0, "staff actions record who did them");

const sent = await db.query(`select event, topic, private, payload from realtime.sent order by id`);
const demoSignals = sent.rows.filter((r) => r.topic.startsWith(`venue:${VENUE_ID}:`));
const byTopic = demoSignals.reduce((acc, r) => {
  const key = `${r.topic.split(":")[2]}/${r.event}`;
  return { ...acc, [key]: (acc[key] ?? 0) + 1 };
}, {});
console.log("realtime signals:", byTopic);
assert.ok(sent.rows.every((r) => r.private === false && /^venue:[0-9a-f-]+:(staff|screen)$/.test(r.topic)));
assert.ok(byTopic["staff/submission_changed"] > 0 && byTopic["staff/screen_state_changed"] > 0);
assert.equal(byTopic["screen/screen_state_changed"], byTopic["staff/screen_state_changed"]);
assert.equal(byTopic["screen/submission_changed"], undefined, "screens never get submission bursts");
assert.ok(sent.rows.find((r) => r.event === "submission_changed").payload.submissionId, "camelCase signal payload");

// --- Grants: anon cannot call staff RPCs or private helpers ----------------------
await db.exec(`grant usage on schema public to anon, authenticated`);
await db.exec(`set role anon`);
await assert.rejects(db.query(`select public.list_pending_submissions('{}'::jsonb)`), /permission denied/);
await assert.rejects(db.query(`select private.advance_queue('${VENUE_ID}')`), /permission denied/);
await assert.rejects(db.query(`select * from public.submissions`), /permission denied/);
await assert.rejects(db.query(`select public.claim_photo_deletions('{}'::jsonb)`), /permission denied/);
await assert.rejects(db.query(`select public.end_event('{}'::jsonb)`), /permission denied/);
await db.exec(`reset role`);
await db.exec(`set role authenticated`);
await assert.rejects(db.query(`select public.claim_photo_deletions('{}'::jsonb)`), /permission denied/);
await assert.rejects(db.query(`select public.confirm_photo_deletions('{}'::jsonb)`), /permission denied/);
await db.exec(`reset role`);
await db.exec(`set role anon`);
const ok = await db.query(`select public.get_venue_public('{"venueSlug":"demo-event"}'::jsonb) as r`);
assert.equal(ok.rows[0].r.slug, "demo-event");
await db.exec(`reset role`);

console.log("\nALL QUEUE TESTS PASSED");
