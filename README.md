# CamSkynet

Guests scan a QR code, send a message, their Instagram handle and a photo, and appear on the venue screen. For the #POPFOUNDHERPRINCE wedding there is no approval step: messages go straight into the queue (`venues.auto_approve`).
Next.js 16 on Cloudflare Workers (OpenNext) + Supabase.

- Stack decisions: [docs/tech-stack-decision.md](docs/tech-stack-decision.md)
- Hosting guide: [docs/cloudflare-hosting-guide.md](docs/cloudflare-hosting-guide.md)
- Code rules: [docs/coding_style/CODING_STYLE.md](docs/coding_style/CODING_STYLE.md) + [CAMSKYNET_ADDENDUM.md](docs/coding_style/CAMSKYNET_ADDENDUM.md)

## Pages

| URL | Who |
|---|---|
| `/` | Landing (placeholder) |
| `/v/demo-event` | Guest: send a message (QR target) |
| `/v/demo-event/s/<token>` | Guest: status of their message (polls; shows queue position and ETA) |
| `/privacy` | Privacy notice (placeholder; PDPA) |
| `/admin` | Staff: log in, skip/remove queued messages, **End event** (approve/reject only for venues with `auto_approve` off) |
| `/screen/demo-screen-1`, `/screen/demo-screen-2` | Venue screens (stay in sync) |

## First-time setup

### 1. Supabase project
1. Create a project at supabase.com, region **Southeast Asia (Singapore)**.
2. In **SQL Editor**, run each file in `supabase/migrations/` in order, then `supabase/seed.sql`.
   - `…0004_queue_cron.sql` needs the **pg_cron** extension. If it errors, enable pg_cron under Database → Extensions and run the file again. The app also works without it, because screens advance the queue themselves.
3. **Authentication → Users → Add user**: create your staff login (email + password, auto-confirm).
4. Run the commented `insert into public.staff_members …` at the bottom of `seed.sql` with your email.
5. **Project Settings → API keys**: copy the project URL, the **publishable** key and a **secret** key.

### 2. Local env
```bash
cp .env.example .env.local
```
Fill in the values. Also copy `.dev.vars.example` to `.dev.vars` and set `SUPABASE_URL` + `SUPABASE_SECRET_KEY` (used by the photo purge cron).

Photos are stored in Cloudflare R2. `npm run dev` and `npm run preview` use a **local** R2 automatically (kept under `.wrangler/`), so no Cloudflare setup is needed to develop.

### 3. Run
```bash
npm install
```
```bash
npm run dev
```
Open http://localhost:3000. Use `npm run preview` to run the real Cloudflare Workers runtime locally (port 8787).

## Checks

```bash
npm run typecheck
```
```bash
npm run lint
```
```bash
npm run test:db
```
`test:db` runs the real migrations in an in-memory Postgres (PGlite), with small stand-ins for Supabase's auth/realtime/storage. It tests:
- queue rules: FIFO order, two screens in sync, skip/remove, bulk approve order, auto-approve (no approval step, arrival order);
- ETA, queue-full and per-device limits;
- realtime topic split;
- PDPA scrubbing / End event / the R2 deletion queue;
- permissions and the audit log.

Load test (staging only): see [scripts/load/README.md](scripts/load/README.md).

## Deploy to Cloudflare

```bash
npx wrangler login
```
Create the photo bucket once, with a 3-day safety-net lifecycle rule (PDPA). Normal deletion is done by the cron within about a minute of each message finishing on screen (0012), and for anything left in the queue when the event ends:
```bash
npx wrangler r2 bucket create camskynet-photos
```
```bash
npx wrangler r2 bucket lifecycle add camskynet-photos pdpa-safety-net --expire-days 3
```
Set the Worker secrets (repeat with `--env staging` for staging):
```bash
npx wrangler secret put SUPABASE_URL
```
```bash
npx wrangler secret put SUPABASE_SECRET_KEY
```
Optional bot protection: `npx wrangler secret put TURNSTILE_SECRET_KEY`, and `NEXT_PUBLIC_TURNSTILE_SITE_KEY` in `.env.local`.
```bash
npm run deploy
```
`NEXT_PUBLIC_*` values are baked in at build time, so `.env.local` (or Workers Builds build variables) must exist when you deploy. **Real events need Workers Paid ($5/mo).**

Approval is per venue: `venues.auto_approve` (on for the wedding). To bring the approval step back: `update venues set auto_approve = false where slug = 'demo-event';`

Events end automatically at `venues.event_ends_at`. Until the owner dashboard exists, set it in SQL, e.g. `update venues set event_ends_at = '2026-11-15 08:00+07' where slug = 'demo-event';`. To reuse the demo event after ending it: `update venues set ended_at = null, is_accepting = true where slug = 'demo-event';`

## Spike test script (manual)

1. Open `/screen/demo-screen-1` and `/screen/demo-screen-2` in two windows. Both show the idle QR.
2. On your phone, scan the QR (or open `/v/demo-event`), pick 15s, write a message, add a photo, send.
3. It joins the queue straight away (no approval). `/admin` shows it under the queue, where staff can skip or remove it.
4. Both screens show it at the same moment with the same countdown; the guest status page says "on screen now".
5. Send 3 more, then reload one screen mid-item. It resumes the same item and countdown.
6. Turn Wi-Fi off on the screen machine for 30s, then back on. It catches up without a reload.
