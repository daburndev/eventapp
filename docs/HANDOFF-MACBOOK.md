# Continuing on the MacBook (and running the wedding)

Start here on a new machine. If you use Claude Code on the Mac, ask it to read this file first: Claude's
notes from the Windows PC don't move with the code, but everything it needs is in this repo.

## Where things stand (2026-11-19)

- **Live:** https://camskynet.ronald-kyawswar.workers.dev (Cloudflare Worker `camskynet`).
- **Event:** #POPFOUNDHERPRINCE, 21 Nov 2026. Venue slug `demo-event` (name already set to #POPFOUNDHERPRINCE,
  `event_ends_at` set by SQL).
- **Database:** one Supabase project (Singapore). All migrations up to `20261119000012_scrub_after_show.sql` are applied.
- **Photos:** Cloudflare R2 bucket `camskynet-photos` with a 3-day auto-delete rule. Each photo is deleted
  right after its slot on screen (PDPA), by the Worker's every-minute cron.
- **No approval step** (`venues.auto_approve`): guest messages go straight into the queue.
  Staff can still Skip / Remove from `/admin`.

## 1. Get the code onto the Mac

The code lives in a private GitHub repo (see "Setting up the GitHub repo" at the end if that isn't done yet).

```bash
xcode-select --install          # gives you git, once
git clone https://github.com/<you>/camskynet.git
cd camskynet
```

Install **Node 24** (https://nodejs.org, "LTS" or 24.x), then:

```bash
npm install
```

## 2. Recreate the two secret files

They are never in Git. Copy the examples, then fill them from the **Supabase dashboard → Project Settings →
API keys** (project URL, publishable key, a secret key):

```bash
cp .env.example .env.local      # NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY
cp .dev.vars.example .dev.vars  # SUPABASE_URL, SUPABASE_SECRET_KEY
```

The live Worker already has its own copies (Cloudflare secrets), so this is only for running and deploying from the Mac.

## 3. Log in to Cloudflare and check it works

```bash
npx wrangler login              # opens the browser; on macOS plain `npx` works (no npx.cmd needed)
npm run dev                     # http://localhost:3000/screen/demo-screen-1
```

Deploy changes to the live site with:

```bash
npm run deploy
```

`.env.local` must exist when you deploy (the public Supabase values are built into the site).

## Event-day cheat sheet

| What | Where |
|---|---|
| Projector | `https://camskynet.ronald-kyawswar.workers.dev/screen/demo-screen-1` (second screen: `demo-screen-2`) |
| Guest page (the QR opens this) | `https://camskynet.ronald-kyawswar.workers.dev/v/demo-event` |
| Staff: skip / remove / End event | `https://camskynet.ronald-kyawswar.workers.dev/admin` |

- **Projector setup:** open the screen link in Chrome, click once on the page to go fullscreen. It keeps the
  screen awake and reconnects by itself after a Wi-Fi drop.
- **Bad message on screen:** `/admin` → Skip (current) or Remove (queued). Its data and photo are deleted straight away.
- **Queue limits** (Supabase SQL Editor): each phone may have 2 waiting messages; new sends stop once about
  45 minutes are queued. To change them:
  ```sql
  update public.venues set max_open_per_device = 3, max_queue_seconds = 3600 where slug = 'demo-event';
  ```
- **After the event:** press **End event** in `/admin` (or let `event_ends_at` pass). Everything left is deleted.
- **Supabase free plan** pauses a project after a week with no visits: open the site once in the days before.

## Setting up the GitHub repo (once, from the Windows PC)

1. On github.com → **New repository** → name `camskynet`, **Private**, no README/licence.
2. In this folder:
   ```bash
   git init -b main
   git add .
   git commit -m "CamSkynet: #POPFOUNDHERPRINCE wedding release"
   git remote add origin https://github.com/<you>/camskynet.git
   git push -u origin main
   ```
   Git for Windows opens a browser window to sign in to GitHub the first time.
3. Check on github.com that `.env.local`, `.dev.vars` and `scripts/load/.env.load` are **not** in the repo
   (`.gitignore` excludes them).

## Useful docs in this repo

- `README.md`: setup, scripts, checks.
- `docs/tech-stack-decision.md`, `docs/cloudflare-hosting-guide.md`: how and why it's built this way.
- `docs/coding_style/`: code rules (the generic rulebook + this project's addendum).
- `docs/load-test-results.md`: capacity measured on the live site.
- `scripts/load/README.md`: how to rerun the load test against a throwaway venue.
