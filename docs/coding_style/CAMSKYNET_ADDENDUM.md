# CamSkynet Addendum to the Coding Style

[CODING_STYLE.md](CODING_STYLE.md) is our generic, reusable rulebook and stays unchanged.
This file records how it applies to CamSkynet's stack (Next.js on Cloudflare Workers + Supabase), plus the **two agreed exceptions**.
Where they differ, this file wins for this project only.

Decided: 2026-10-27.

---

## 1. What "the backend" is here

In the rulebook, "Backend" means the system behind our API proxy. For CamSkynet, the backend is **Supabase Postgres functions (RPC)**.

- **Business rules live in the database:** submission state machine, `advance_queue`, approve/reject, tier rules, tenant checks.
- **`app/api/` route handlers** stay thin, as in §5 of the rulebook. Each one:
  1. resolves auth through one shared helper (`lib/services/supabase-server`);
  2. calls one RPC;
  3. passes the result and status straight through.

```
Hook → Service (via shared request wrapper) → app/api/<resource>/route → supabase.rpc('<function>') → Postgres
```

**Route handlers are the standard path** for every read and write. Do not use Next.js Server Actions.
**Why:** one path keeps a single request wrapper, one error envelope and one set of cache keys, matching §4/§6 of the rulebook.

---

## 2. Exception A — direct Supabase from the browser (Realtime for screens and staff only)

Updated 2026-10-28 (Phase 2, scaling for 500-guest events):
- **Guests no longer use Realtime.** They poll through `app/api`, because 500 open phones would exceed Supabase's connection limit.
- **Photos no longer go to Supabase Storage.** They are uploaded through `app/api` into Cloudflare R2 and served from `/media`.

| Case | Why it can't go through `app/api/` | Where it lives |
|---|---|---|
| **Realtime subscriptions** (screen player, admin approval page) | A long-lived WebSocket to Supabase Realtime; proxying it through a Worker defeats the purpose | `lib/realtime/venue-signals.ts` (one ref-counted channel per venue topic) + `lib/hooks/useVenueSignals.ts` |

Topics, chosen by audience:
- `venue:<id>:staff` gets every signal;
- `venue:<id>:screen` gets only `screen_state_changed`, so screens never see a burst of new submissions.

Rules:
- **Only `lib/realtime/` may import the browser Supabase client** (`lib/services/supabase-browser.ts`). A feature that creates its own Supabase client is a defect.
- Feature hooks consume `useVenueSignals`; components still never touch the network.
- **Realtime events are only signals.** On an event, the hook invalidates its cached read (staff debounce it by 400 ms). Authoritative data still comes through `app/api/`.
- **Realtime payloads are mapped defensively** into `interfaces/` types, like any service response.
- **Everything else goes through `app/api`:** queries, inserts, auth calls, photo uploads (`POST /api/submissions/photos` → R2) and the guest status page (smart polling).


---

## 3. Exception B — casing: camelCase produced by Postgres

The rulebook requires camelCase on the wire and forbids casing converters in the frontend. Postgres columns stay **snake_case**, and the database itself produces camelCase:

- **Every RPC that returns data** builds its JSON with camelCase keys, for example:
  ```sql
  jsonb_build_object('id', s.id, 'approvedAt', s.approved_at, 'tierSeconds', t.duration_seconds)
  ```
- **RPC parameters** are named in camelCase-compatible form and called with camelCase from the route handler. Example: `supabase.rpc('approve_submission', { submissionId })` with a quoted parameter `"submissionId"`, or a single `payload jsonb` argument read with camelCase keys.
- **Realtime broadcasts** are built in the database (triggers / `realtime.send`) with camelCase payloads.
- **Never select raw tables from the app** (e.g. `.from('submissions').select()`), since that leaks snake_case.
- **No `camelCaseKeys` / `toSnakeCase` helpers anywhere in the frontend.**
- **Mappers still validate shape and types** (rulebook §6). They just never rename keys.

---

## 4. Folder mapping for this project

The app has four page groups:

| Page | Who uses it | URL | Feature |
|---|---|---|---|
| **Landing page** | Venue owners / organisers discovering CamSkynet (marketing, pricing, contact) | `/` | `features/landing` |
| **User page** | Guests who scan the QR: pick tier → message, Instagram, photo → submit → live status | `/v/[venueSlug]` | `features/guest-submission` |
| **Approval page** | Venue owner / support staff: pending list, approve / reject, queue controls (skip, remove, pin next) | `/admin` (login required) | `features/approval`, `features/queue` |
| **Screen page** | The LED screen / TV in the venue: plays the approved queue, shows the QR when idle | `/screen/[screenToken]` | `features/screen-player` |

| **Dashboard page** | Venue owner / organiser: stats and activity logs | `/admin/dashboard` (login required) | `features/dashboard` |

Venue settings (tiers 15s/30s/60s, branding, QR download, staff) sit inside the admin area as `/admin/settings` → `features/venue-settings`.

### Dashboard contents (first version)
Scoped to one venue/event, with a date-range filter (tonight / 7 days / 30 days / custom).

- **Stat cards:**
  - Total submissions.
  - **Unique guests:** guests have no accounts, so count distinct Instagram handles plus distinct device IDs.
  - Approved / rejected / pending counts and approval rate.
  - Total screen time played.
  - Average wait (submit → on screen).
- **Charts:**
  - Submissions per hour, to show peak times.
  - Submissions by tier (15s / 30s / 60s).
  - Later, for venues: revenue per day.
- **Logs**, from the `audit_log` table, newest first, filterable by type and staff member:
  - Submission received, approved, rejected (with reason), played, skipped or removed, and who did it.
  - Staff login, settings changed.
  - Screen connected / disconnected.
- **CSV export** of submissions and logs for the selected range.

API: `GET /api/dashboard/stats` → rpc `get_dashboard_stats`; `GET /api/dashboard/logs` → rpc `list_audit_log` (paged). Both return camelCase JSON, as in Exception B. Stats are computed in Postgres, never in the browser.

A platform-wide dashboard for us (all venues, active screens, signups) is **later**, under a separate super-admin role.

```
app/
├── (marketing)/page.tsx          → features/landing/pages
├── (guest)/v/[venueSlug]/        → features/guest-submission/pages
├── (admin)/admin/...             → features/approval, features/queue, features/venue-settings, features/dashboard
├── screen/[screenToken]/         → features/screen-player/pages
└── api/
    ├── submissions/...           → rpc: create_submission, get_submission_status, ...
    ├── approvals/...             → rpc: approve_submission, reject_submission
    ├── queue/...                 → rpc: advance_queue, skip_current, ...
    ├── venues/...                → rpc: get_venue_public, update_venue_settings, ...
    └── dashboard/...             → rpc: get_dashboard_stats, list_audit_log
lib/
├── services/                     # shared request wrapper, supabase-server helper
├── realtime/                     # Exception A: channel helper
└── storage/                      # Exception A: signed upload helper
supabase/
└── migrations/                   # tables, RLS, RPC functions (camelCase JSON out)
```

Feature folders: `landing`, `guest-submission`, `staff-auth`, `approval`, `screen-player`, `venue-settings`, `dashboard`. Each follows rulebook §3.

As built in the spike (2026-10-27):
- **Queue controls live inside `features/approval`.** Skip and remove only appear on the approval page, so a separate `queue` feature would have meant cross-feature imports.
- **`features/staff-auth`** owns login/logout and `StaffGate`, which the `/admin` layout wraps around every admin page.
- **Shared kits in `lib/`:**
  - `lib/session/`: staff venue list, which also serves as the "logged in?" check for the gate and the approval page.
  - `lib/mappers/`: the `Submission` and now-playing mappers, used by three features.
  - `lib/realtime/` + `lib/hooks/useVenueSignals`: one ref-counted channel per venue.
- **Server helpers in `lib/services/`:**
  - `rpc-proxy.ts`: the one way a route handler calls an RPC.
  - `api-response.ts`: the envelope.
  - `supabase-server.ts`, `staff-auth.ts`;
  - `photo-store.ts` (R2 upload + `/media`), `photo-purge.ts` (PDPA cron, run from `worker/index.js`), `turnstile.ts` (guest bot check).

The landing page is static marketing content, so it needs no API, services or Supabase calls. Only `pages/`, `components/` and `constants/` apply.
