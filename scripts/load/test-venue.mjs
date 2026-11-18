// Creates or removes a throwaway venue for load-testing the live site without touching the real event.
//   node --env-file=.dev.vars scripts/load/test-venue.mjs setup
//   node --env-file=.dev.vars scripts/load/test-venue.mjs end       # scrub everything, queue photos for R2 deletion
//   node --env-file=.dev.vars scripts/load/test-venue.mjs status    # how many of its photos still wait for deletion
//   node --env-file=.dev.vars scripts/load/test-venue.mjs teardown  # delete the venue and all its rows
// Uses SUPABASE_URL + SUPABASE_SECRET_KEY (service role: bypasses RLS). Never prints the key.
import { createClient } from "@supabase/supabase-js";

const VENUE_ID = "00000000-0000-0000-0000-00000000ad01";
const ORGANIZATION_ID = "00000000-0000-0000-0000-000000000001"; // the seeded organisation
export const LOAD_VENUE_SLUG = "loadtest-venue";
export const LOAD_SCREEN_TOKENS = ["loadtest-screen-1", "loadtest-screen-2", "loadtest-screen-3"];

const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  throw new Error("Run with --env-file=.dev.vars (needs SUPABASE_URL and SUPABASE_SECRET_KEY)");
}
const db = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

async function must(promise, what) {
  const { data, error } = await promise;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
}

async function setup() {
  await must(
    db.from("venues").upsert({
      id: VENUE_ID,
      organization_id: ORGANIZATION_ID,
      slug: LOAD_VENUE_SLUG,
      name: "Load test (temporary)",
      service_type: "event",
      auto_approve: true,
      is_accepting: true,
      ended_at: null,
      event_ends_at: null,
      // Room for every simulated guest; the real venue keeps its 45-minute limit.
      max_queue_seconds: 86_400,
    }),
    "create venue",
  );
  const tiers = await must(db.from("tiers").select("id").eq("venue_id", VENUE_ID), "read tiers");
  if (tiers.length === 0) {
    await must(db.from("tiers").insert({ venue_id: VENUE_ID, label: "15 seconds", duration_seconds: 15 }), "create tier");
  }
  for (const [index, token] of LOAD_SCREEN_TOKENS.entries()) {
    const existing = await must(db.from("screens").select("id").eq("token", token), "read screens");
    if (existing.length === 0) {
      await must(db.from("screens").insert({ venue_id: VENUE_ID, name: `Load screen ${index + 1}`, token }), "create screen");
    }
  }
  console.log(`Ready: venue "${LOAD_VENUE_SLUG}", screens ${LOAD_SCREEN_TOKENS.join(", ")}`);
}

// Same path as a real event ending: pg_cron's end_due_events scrubs the venue within a minute.
async function end() {
  await must(db.from("venues").update({ event_ends_at: new Date().toISOString() }).eq("id", VENUE_ID), "end venue");
  console.log("Event end time set to now; pg_cron ends it within a minute, then the Worker cron empties R2.");
}

async function status() {
  const venue = await must(db.from("venues").select("ended_at").eq("id", VENUE_ID).maybeSingle(), "read venue");
  const submissions = await must(
    db.from("submissions").select("id, personal_data_deleted_at").eq("venue_id", VENUE_ID),
    "read submissions",
  );
  const queued = await must(
    db.from("photo_deletions").select("id").like("photo_path", `${VENUE_ID}/%`),
    "read photo deletions",
  );
  console.log(
    JSON.stringify({
      ended: Boolean(venue?.ended_at),
      submissions: submissions.length,
      notYetScrubbed: submissions.filter((s) => !s.personal_data_deleted_at).length,
      photosWaitingForR2Deletion: queued.length,
    }),
  );
}

async function teardown() {
  const queued = await must(db.from("photo_deletions").select("id").like("photo_path", `${VENUE_ID}/%`), "read queue");
  if (queued.length > 0) {
    throw new Error(`${queued.length} photos still wait for R2 deletion; run "status" again in a minute`);
  }
  // Cascades to tiers, screens, submissions, screen_state and audit_log rows of this venue.
  await must(db.from("venues").delete().eq("id", VENUE_ID), "delete venue");
  console.log("Load-test venue and all its rows deleted.");
}

const actions = { setup, end, status, teardown };
const action = actions[process.argv[2]];
if (!action) throw new Error(`Usage: test-venue.mjs ${Object.keys(actions).join("|")}`);
await action();
