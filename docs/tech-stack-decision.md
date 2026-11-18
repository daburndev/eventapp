# Tech Stack Decision — CamSkynet

Status: **Proposed** (Phase 0 of the plan) · Date: 2026-10-26

## TL;DR

| Layer | Choice | Why |
|---|---|---|
| App framework | **Next.js (App Router, TypeScript)** — one app with 3 surfaces: guest `/v/[slug]`, admin `/admin`, screen `/screen/[token]` | One codebase; `app/api` route handlers call Postgres RPCs (see [coding_style/CAMSKYNET_ADDENDUM.md](coding_style/CAMSKYNET_ADDENDUM.md)); good mobile-web performance |
| Backend / DB | **Supabase** (Postgres + Auth + Storage + Realtime), region **ap-southeast-1 (Singapore)** | Relational data with transactions fits a queue; RLS gives multi-tenant isolation for free; closest region to Thailand |
| Realtime | **Supabase Realtime Broadcast (from Database)** for **screens + staff only**; guests poll | Supabase recommends Broadcast over Postgres Changes for scale. Guests poll because 500 guest pages would exceed Realtime's connection limit (Free 200 / Pro 500) |
| Hosting | **Cloudflare Workers** via the **OpenNext adapter** (`@opennextjs/cloudflare`). Workers Free while learning/testing → Workers Paid ($5/mo) at launch | Cheapest path; runs at Cloudflare's edge (incl. Bangkok); no server to maintain. See [cloudflare-hosting-guide.md](cloudflare-hosting-guide.md) |
| Image pipeline | Phone makes 2 JPEG renditions (1920px screen + 480px thumb; canvas re-encode drops EXIF/GPS) → `POST /api/submissions/photos` → **Cloudflare R2** → served by `/media` | `sharp` doesn't run on Workers; R2 has free egress; photos are deleted after the event (PDPA) |
| Moderation | **OpenAI `omni-moderation-latest`** (image + text, free) as first pass + custom Thai/English banned-word list; human approval is final | Free, handles images; human approval already required, so the model only *flags* |
| Screen player | Browser page in kiosk mode (Chrome `--kiosk` on mini PC, or Fully Kiosk Browser on Android box) + service worker | No native app to install; survives reloads |
| Testing | Vitest (unit, state machine & queue), Playwright (E2E across guest/admin/screen) | |

## Phase 2 update (2026-10-28): 500-guest events + Thailand PDPA

- **Realtime only for screens + staff**, on split topics `venue:<id>:staff` / `venue:<id>:screen`. Guests use smart polling: every 10s while pending, every 5–30s by queue position, at `endsAt` while playing, then stop. With ±20% jitter that stays at about 10 Realtime connections per event, even on the Free plan.
- **Photos in Cloudflare R2** (free egress, 10 GB free storage), uploaded and served through our Worker. There's no shared edge cache, so a deleted photo is never served.
- **PDPA (updated 2026-11-19, migration 0012):** every submission is scrubbed (photo queued for R2 deletion; message, Instagram and LINE ID cleared) as soon as it finishes on screen, is removed or is rejected, for all venue types. Originally: (its end time or the **End event** button), or right after showing/rejection for the venue type. A Worker cron (`worker/index.js` → `lib/services/photo-purge.ts`) deletes the R2 objects each minute; an R2 3-day lifecycle rule is the safety net.
- **Capacity controls:** `max_queue_seconds` (default 45 min → `queue_full`) and `max_open_per_device` (default 2). Bulk approve, a paged pending list and keyboard shortcuts help staff keep up.
- **Smart Placement** runs the Worker near Supabase (Singapore). **Workers Paid ($5/mo) is required for real events**: polling and uploads exceed the Free plan's 100k requests/day and 10 ms CPU.
- **Staging:** the Worker `camskynet-staging` with its own R2 bucket and a separate Supabase project. Load test: `scripts/load/`.

Estimated cost:
- **Testing phase:** Supabase Free + Cloudflare Workers Free + moderation ≈ **$0/mo**. Supabase Free pauses idle projects. That's fine for testing; just un-pause it before a demo.
- **Commercial launch:** Supabase Pro ~$25/mo + Cloudflare Workers Paid $5/mo ≈ **$30/mo**.

Verify on vendor pricing pages before committing.

---

## 1. Realtime (screens + admin live updates)

Requirements: admin sees new submissions instantly; screens learn about newly approved items and "now playing" changes; several screens per venue stay in sync; tolerate flaky venue Wi-Fi.

Load profile is small per venue: 1–5 screens + a few staff + guests watching their status page. Hundreds of venues ⇒ low thousands of concurrent sockets.

| Option | Verdict |
|---|---|
| **Supabase Realtime Broadcast** | ✅ Chosen. Scoped channels per venue (`venue:{id}`), authorized by Realtime RLS policies. Supabase benchmarks Broadcast at 50k concurrent users / p95 ≈ 49 ms. Auto-reconnect built into `supabase-js`. |
| Supabase Postgres Changes | ❌ for production. Each change is checked against every subscriber's access rights on a single thread — Supabase's docs recommend migrating to Broadcast at scale. OK for a prototype only. |
| Convex | Strong reactive model (queries auto-refresh), but a proprietary DB; less natural for SQL reporting/CSV takings exports needed in Phase 2. Runner-up. |
| Firebase (Firestore) | NoSQL makes ordered queue + transactional approval and reporting harder; per-read billing climbs with status-page polling. |
| Self-hosted Socket.IO / Node | Full control, but we'd run and scale our own WebSocket servers + Redis adapter. Not worth it at this size. |
| Cloudflare Durable Objects | Elegant "one object per venue" queue with hibernating WebSockets, but more custom code and a second data store alongside Postgres. Revisit if Supabase Realtime limits bite. |

**Limits to watch:** third-party sources put Free at ~200 concurrent Realtime connections and Pro at ~500 included (overage billed). Confirm current numbers on Supabase's pricing page; guest status pages can fall back to polling every 5–10 s to save connections.

### Queue engine design (independent of transport)
The DB is the source of truth; realtime only *notifies*.
- `screen_state(venue_id, current_submission_id, started_at, ends_at)` — one row per venue (or per screen group).
- Postgres function `advance_queue(venue_id)`: `SELECT … FOR UPDATE` on the state row; if `now() >= ends_at`, mark current `played`, pick the next `approved` submission ordered by `approved_at`, set `started_at/ends_at = now() + tier.duration`. Idempotent — any screen (or a cron fallback) can call it; the row lock prevents double-advancing.
- Screens render from `started_at/ends_at` using server time offset, so all screens and reloads show the same thing at the same moment.
- Staff actions (skip, remove, pin-next) are just other functions that take the same lock.

## 2. Media upload

- `<input type="file" accept="image/jpeg,image/png,image/webp">`: on iOS, restricting accepted types makes Safari hand over a JPEG instead of HEIC. Keep **heic2any** (WASM, ~lazy-loaded) as a fallback for Android/desktop browsers that hand over `.heic`.
- Client-side resize to max ~1920px / ~80% JPEG before upload (canvas or `browser-image-compression`) → typical 300–600 KB.
- Re-encoding through a canvas drops EXIF/GPS metadata, so no server image step is needed (`sharp` can't run on Cloudflare Workers anyway). The server only checks file type and size.
- Upload straight to Supabase Storage via a signed upload URL (no big payload through the Worker). Private bucket; screens/admin read through short-lived signed URLs.
- Retention: delete photos N days after the event (privacy, storage cost).

## 3. Moderation

Human approval is mandatory, so automation only **ranks and flags** for staff.

| Option | Cost | Notes |
|---|---|---|
| **OpenAI `omni-moderation-latest`** | Free (endpoint), image + text | ✅ First pass. Thai-language text accuracy unverified → pair with our own banned-word list. |
| AWS Rekognition moderation | ~$1 / 1k images | Hierarchical labels; good fallback if OpenAI misses or has an outage |
| Google Vision SafeSearch | ~$1.50 / 1k images | Coarser 5-likelihood buckets |
| Sightengine | $29/mo for 10k ops | Most moderation-specific features (text-in-image, weapons, etc.); consider if we need OCR on images |

Also: rate-limit submissions per device/IP, cap message length, validate IG handle format (`^[A-Za-z0-9._]{1,30}$`).

## 4. Auth & multi-tenancy

- Staff log in with Supabase Auth (email magic link / password; LINE login later is popular in Thailand).
- Tables carry `organization_id`; RLS policies check membership via `staff_members(user_id, organization_id, role)`. Roles: `owner`, `approver`.
- Guests are anonymous: each submission gets an unguessable `public_token` for its status page. Guest writes go through an `app/api` route handler that calls a Postgres RPC, never directly from the browser to tables.
- Screens authenticate with a per-screen pairing token (revocable), mapped to a restricted Realtime channel.

## 5. Screen player resilience

- Full-screen page, preloads the next photo, crossfades.
- Service worker caches the shell + idle QR/branding so a Wi-Fi drop shows the idle loop instead of an error.
- On reconnect: refetch `screen_state` and resync; never trust local timers alone.
- Wake-lock API to stop screen sleep; recommend Fully Kiosk Browser (Android) or Chrome `--kiosk --autoplay-policy=no-user-gesture-required` (mini PC).

## 6. Hosting, region & cost

- Supabase project in **ap-southeast-1**. The Next.js app runs on **Cloudflare Workers** (OpenNext adapter) in the Cloudflare data centre nearest each visitor; consider Cloudflare Smart Placement so server work runs near Singapore, close to the database.
- **Workers Free** for learning and testing: 100k requests/day, **10 ms CPU per request**, 3 MiB compressed Worker size. Next.js server rendering can exceed the CPU and size limits. If deploys fail on size or pages error on CPU, move to Paid early.
- **Workers Paid ($5/mo)** before going live: 10M requests/month included, much higher CPU and size limits.
- Constraints this brings (the app follows these from day one):
  - No `sharp` or other native Node modules → image work happens on the phone.
  - No `export const runtime = "edge"`; OpenNext uses the Node.js runtime on Workers (`nodejs_compat`).
  - No `proxy.ts`/middleware (Next 16 runs it on Node.js); auth is checked in each `app/api` route.
  - `cacheComponents` off: with it on, pages hung under OpenNext 1.20 on Workers.
  - Queue fallback timer runs in the database (Supabase `pg_cron` calling `advance_queue`), not in the web host.
- Fallback if Workers limits bite: a Singapore VPS (Hetzner/DigitalOcean) with Coolify, running the same app in Docker (`output: "standalone"`). Keeping everything in Supabase keeps this move easy.
- No measured Bangkok → Singapore latency found; expected ~30–50 ms. **Action:** measure from a Thai ISP in the spike (below).
- Static assets served from Cloudflare's CDN (Workers static assets); photos via Supabase Storage CDN.

## 7. Future payments fit (Phase 2)

Postgres RPCs + `app/api` route handlers make both paths straightforward:
- **PromptPay QR + slip verification** (Kheunjor model — money goes straight to the venue): generate EMVCo PromptPay payload per venue, verify slip with a provider API, store in `payments`, dedupe by slip reference.
- **Gateway** (Omise / 2C2P / Stripe PromptPay): webhook → `payments` row → submission moves `payment_pending → pending_approval`.
Either plugs into the state machine via a `PaymentProvider` interface; events skip the payment state.

## Open questions / next steps

1. **1-day spike** to validate before full build:
   - Supabase Broadcast with Realtime Authorization across 2 screens + admin; kill Wi-Fi and confirm resync.
   - `advance_queue` under 20 simultaneous approvals — no double-plays, FIFO kept.
   - iPhone + Android upload: confirm HEIC handling and upload size.
   - Measure latency from Bangkok to ap-southeast-1.
2. Confirm current Supabase Realtime connection limits and that the Worker fits Free-plan size/CPU limits (run `npm run preview` + a test deploy).
3. Decide UI library (suggest Tailwind + shadcn/ui) and i18n (`next-intl`, TH/EN).

## Sources
- [Supabase Realtime limits](https://supabase.com/docs/guides/realtime/limits.md)
- [Supabase Realtime benchmarks](https://supabase.com/docs/guides/realtime/benchmarks)
- [Supabase: migrate from Postgres Changes to Broadcast](https://supabase.com/docs/guides/realtime/migrate-from-postgres-changes)
- [Supabase: Realtime Broadcast from Database](https://supabase.com/blog/realtime-broadcast-from-database.md)
- [Supabase regions](https://supabase.com/docs/guides/platform/regions)
- [Supabase pricing guide 2026 (Jetadmin)](https://www.jetadmin.io/blog/supabase-pricing-2026-guide-to-plans-limits-and-real-world-costs/)
- [OpenNext for Cloudflare — get started](https://opennext.js.org/cloudflare/get-started) · [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Vercel Hobby plan](https://vercel.com/docs/plans/hobby) (considered, not chosen)
- [Convex: comparing realtime databases](https://stack.convex.dev/comparing-realtime-databases)
- [Cloudflare Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing)
- [Eden AI: explicit content detection APIs](https://www.edenai.co/post/top-10-explicit-content-detection-apis) · [Mixpeek: best NSFW detection APIs](https://mixpeek.com/curated-lists/best-nsfw-detection-apis)
- [OpenAI moderation API pricing (DeepInspect)](https://www.deepinspect.ai/blog/openai-moderation-api-pricing)
- [heic2any](https://github.com/aselivanov/heic2any)
- [Kheunjor (reference product)](https://kheunjor.com/en/)
