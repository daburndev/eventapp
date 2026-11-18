# Hosting CamSkynet on Cloudflare Workers — Learning Guide

This guide covers how our Next.js app runs on Cloudflare, step by step, from your Windows PC to a live URL.
Companion to [tech-stack-decision.md](tech-stack-decision.md).

---

## 0. The mental model (read this first)

```
Phone / Screen / Admin browser
        │
        ▼
Cloudflare edge (nearest data centre, e.g. Bangkok)
  ├─ Static files (JS, CSS, images)  ← served straight from Cloudflare's CDN
  └─ Worker = our Next.js server code (pages, server actions, API routes)
        │  HTTPS (supabase-js)
        ▼
Supabase (Singapore): Postgres · Auth · Storage · Realtime
```

- **Cloudflare Worker**: a small server program that runs in Cloudflare's data centres instead of a server you own. No machine to patch, no uptime to manage.
- **OpenNext (`@opennextjs/cloudflare`)**: Next.js was built for Node.js servers / Vercel. OpenNext is the *adapter* that converts a `next build` output into a Worker.
- **Wrangler**: Cloudflare's command-line tool. It logs in, runs the Worker locally, sets secrets, deploys, and shows logs.
- **Live updates don't go through the Worker.** Screens and admin connect directly to Supabase Realtime. The Worker only renders pages and handles actions such as submit and approve, so it stays light.

---

## 1. One-time setup

1. **Accounts**
   - Cloudflare: sign up at dash.cloudflare.com (free).
   - GitHub: for code and auto-deploys.
   - Supabase: project in region *Southeast Asia (Singapore)*.
2. **Install on your PC**
   - Node.js LTS (v20 or newer) — check with `node -v`.
   - Git — check with `git --version`.
3. **Log Wrangler into your Cloudflare account** (opens a browser to approve):

```bash
npx wrangler login
```

---

## 2. Create the app

From the `camskynet` folder:

```bash
npm create cloudflare@latest -- app --framework=next --platform=workers
```

This creates `camskynet/app/`, a Next.js project already wired for Workers. The files that matter:

| File | What it's for |
|---|---|
| `wrangler.jsonc` | Worker config: name, `nodejs_compat` flag, where the built files are, bindings (images, cache) |
| `open-next.config.ts` | OpenNext adapter settings (e.g. caching) |
| `.dev.vars` | Local-only secrets and variables for the Worker (never commit) |
| `next.config.ts` | Normal Next.js config + `initOpenNextCloudflareForDev()` so `next dev` can use Cloudflare bindings |
| `.open-next/` | Build output. Generated, git-ignored. |

Key bits of `wrangler.jsonc`:

```jsonc
{
  "name": "camskynet",
  "main": ".open-next/worker.js",
  "compatibility_date": "2024-12-30",              // must be 2024-09-23 or later
  "compatibility_flags": ["nodejs_compat"],       // lets Node.js APIs work in the Worker
  "assets": { "directory": ".open-next/assets", "binding": "ASSETS" }
}
```

---

## 3. Daily development loop

| Command | When | Runs on |
|---|---|---|
| `npm run dev` | Everyday coding, hot reload | Node.js (fast) |
| `npm run preview` | Before deploying, to see real Worker behaviour | Local Workers runtime (`workerd`) |
| `npm run deploy` | Publish to the internet | Cloudflare |

**Rule of thumb:** if something works in `dev` but breaks in `preview`, it's a Workers-compatibility issue (see section 8).

---

## 4. Environment variables & secrets

We have two kinds:

| Kind | Example | Where it lives |
|---|---|---|
| **Public** (safe in the browser) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env` / `.env.production`. Next.js copies these into the JS **at build time**, so they must exist when you build. |
| **Secret** (server only) | `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY` | Locally: `.dev.vars`. Production: a Wrangler secret (below). Never `NEXT_PUBLIC_`. |

Local `.dev.vars` example (git-ignored):

```
NEXTJS_ENV=development
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_API_KEY=...
```

Set a production secret (Wrangler prompts you to paste the value):

```bash
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

Read them in server code with `process.env.SUPABASE_SERVICE_ROLE_KEY` (works because of `nodejs_compat`), or via `getCloudflareContext().env` from `@opennextjs/cloudflare`.

---

## 5. First deploy

```bash
npm run deploy
```

You'll get a URL like `https://camskynet.<your-subdomain>.workers.dev`. Open it on your phone: that's the app running on Cloudflare.

---

## 6. Auto-deploy from GitHub (recommended once the repo exists)

1. Push the project to a GitHub repository.
2. Cloudflare dashboard → **Workers & Pages** → your Worker → **Settings → Builds** → **Connect** your repo.
3. Set the build/deploy commands to the OpenNext ones (`npx opennextjs-cloudflare build`, then `npx opennextjs-cloudflare deploy`). Check the current OpenNext docs for the exact recommended values.
4. Add the `NEXT_PUBLIC_*` values as **build variables** there, since they're needed at build time.

After that, every push to `main` deploys production, and other branches can get preview URLs for testing.

---

## 7. Custom domain, logs, limits

- **Domain** (e.g. `camskynet.com`): add the domain to Cloudflare (change its nameservers at your registrar), then Worker → **Settings → Domains & Routes** → add `camskynet.com` / `app.camskynet.com`. HTTPS is automatic.
- **Live logs** from production:

```bash
npx wrangler tail
```

- **Plans:**

| | Workers Free | Workers Paid ($5/mo) |
|---|---|---|
| Requests | 100,000 / day | 10M / month included, then $0.30 per million |
| CPU per request | 10 ms | Much higher (30M CPU-ms/month included) |
| Worker size (compressed) | 3 MiB | 10 MiB |

Free is fine for learning. **Switch to Paid before real venues/events go live**, or sooner if you hit the errors below.

---

## 8. Rules for our code (so it keeps working on Workers)

1. **No `export const runtime = "edge"`.** OpenNext runs pages in the Node.js runtime; delete that line if a tutorial adds it.
2. **No native Node modules** (`sharp`, `bcrypt`, `canvas`…). Photo resizing happens on the phone before upload.
3. **Talk to Supabase with `supabase-js`** (HTTPS). Don't use direct Postgres drivers (`pg`, Prisma's TCP engine) unless we add Cloudflare Hyperdrive later.
4. **No `proxy.ts` / `middleware.ts` for now.** Next 16 renamed middleware to `proxy` and runs it on Node.js, which OpenNext may not support. Auth is checked inside each `app/api` route via the shared helper instead.
5. **Timers and background jobs** (queue fallback) live in Supabase (`pg_cron`), not the Worker.
6. **Keep server work small:** heavy work (moderation calls, image checks) is fine because waiting on network doesn't count as CPU, but avoid big CPU loops.
7. **Keep `cacheComponents` off** in `next.config.ts`. With it on (the Next 16 default), pages hung in the Workers runtime under OpenNext 1.20. Re-test when OpenNext updates.

---

## 9. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Deploy fails: *script too large* | Worker > 3 MiB on Free | Upgrade to Workers Paid, or trim large dependencies |
| Page shows error **1102** / *exceeded CPU* | > 10 ms CPU on Free | Upgrade to Paid; check for heavy server rendering |
| Works in `dev`, fails in `preview` | Node-only API or native module | See rules in section 8 |
| `undefined` Supabase URL in browser | `NEXT_PUBLIC_*` missing at build time | Add to `.env.production` or Workers Builds build variables, then rebuild |
| Secret missing in production | Only set in `.dev.vars` | `npx wrangler secret put NAME` |

---

## Sources
- [OpenNext for Cloudflare — Get started](https://opennext.js.org/cloudflare/get-started)
- [OpenNext for Cloudflare — overview](https://opennext.js.org/cloudflare)
- [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
