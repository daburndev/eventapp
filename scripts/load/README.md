# Event load test

Simulates one big wedding against **staging**, or a **throwaway venue on the live site** (never the real event venue):
- 500 guests open the page within 2 minutes;
- 300 of them upload a photo and send within 10 minutes, then poll their status the way the app does;
- 1 staff bot approves (one per second, plus a bulk approve every 10 s), skipped for auto-approve venues;
- the screens sync over Realtime.

## Against the live site, with a throwaway venue (used 2026-11-19)

The test never touches the real event: it uses its own venue (`loadtest-venue`, auto-approve, 3 screens) in the
same Supabase project, created and removed by `test-venue.mjs` with the secret key from `.dev.vars`.

```bash
node --env-file=.dev.vars scripts/load/test-venue.mjs setup
node --env-file=scripts/load/.env.load scripts/load/event-load.mjs      # ~15 min
node --env-file=.dev.vars scripts/load/test-venue.mjs end              # deletes its personal data, queues photos
node --env-file=.dev.vars scripts/load/test-venue.mjs status           # repeat until photosWaitingForR2Deletion is 0
node --env-file=.dev.vars scripts/load/test-venue.mjs teardown         # removes the venue and all its rows
```

`scripts/load/.env.load` (git-ignored): `LOAD_BASE_URL` (live URL), `LOAD_VENUE_SLUG=loadtest-venue`,
`LOAD_SCREEN_TOKENS=loadtest-screen-1,loadtest-screen-2,loadtest-screen-3`, `LOAD_SUPABASE_URL`,
`LOAD_SUPABASE_PUBLISHABLE_KEY` (both public). Leave `LOAD_STAFF_*` unset: an auto-approve venue has nothing to approve.

## Against a staging project (original plan)

1. **Staging Supabase project:** run every file in `supabase/migrations/`, then `supabase/seed.sql`, then create a test staff user. For the test, give the demo event enough room so it doesn't fill up:
   ```sql
   update public.venues set max_queue_seconds = 86400, is_accepting = true, ended_at = null where slug = 'demo-event';
   ```
2. **Staging Worker:**
   - set its secrets (`npx wrangler secret put … --env staging`): `SUPABASE_URL`, `SUPABASE_SECRET_KEY`;
   - optionally `TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA` (Cloudflare's always-pass test secret);
   - deploy with `npx wrangler deploy --env staging` after an OpenNext build.
3. Copy `.env.load.example` to `scripts/load/.env.load` and fill it in. Git ignores this file.

## Run

```bash
node --env-file=scripts/load/.env.load scripts/load/event-load.mjs
```

It takes about 15 minutes, printing progress every 15 seconds. At the end it prints a table and saves `scripts/load/results-<time>.json`.

## Pass criteria

| Check | Target | Where |
|---|---|---|
| p95 latency, every API route | < 600 ms | report `endpoints` |
| Server errors | 0 × 5xx / network errors | report `pass.no5xx` |
| Screen drift | < 500 ms between screens per item | report `screenDriftMs` |
| Realtime connections | < 20 | Supabase dashboard → Realtime |
| Worker CPU-limit errors | 0 | Cloudflare dashboard → Workers → camskynet-staging → Logs |

`queue_full` / `too_many_pending` count under `outcomes.rejectedByLimit`. They are the capacity controls working, not failures.

Afterwards: in the admin page, press **End event**. Within about 2 minutes the R2 bucket (`camskynet-photos-staging`) should be empty, which checks the PDPA purge at volume. Record the results in `docs/load-test-results.md`.
