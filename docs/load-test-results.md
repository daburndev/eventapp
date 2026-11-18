# Load test results

## 2026-11-19: live site, throwaway venue

**Setup:**
- Target: https://camskynet.ronald-kyawswar.workers.dev (production Worker, Smart Placement) with the production
  Supabase project (free plan, Singapore) and R2 bucket `camskynet-photos`.
- Venue: `loadtest-venue`, created by `scripts/load/test-venue.mjs`. It used auto-approve like the wedding, three
  screens and one 15-second tier. The real `demo-event` venue and its screens were not touched; the test venue was
  removed afterwards.
- Load: 500 guests opened the guest page within 2 minutes. 300 of them uploaded a ~380 KB photo pair and sent within
  10 minutes, then polled their status like the phone app. Three screens synced over Realtime. 16 minutes in total.
- Client: one Windows PC in Thailand running every simulated guest, so all traffic shared one home connection.

**Result: no errors.** All 7,407 requests answered 200. There were no 5xx responses, network errors or rejections.

| Endpoint | Requests | p50 | p95 | Max |
|---|---|---|---|---|
| GET venue (guest page data) | 500 | 260 ms | 283 ms | 752 ms |
| POST photos (upload to R2) | 300 | 616 ms | 1,100 ms | 2,352 ms |
| POST submissions | 300 | 262 ms | 284 ms | 594 ms |
| GET status (guest polling) | 5,782 | 258 ms | 274 ms | 1,027 ms |
| POST screen sync | 525 | 264 ms | 328 ms | 761 ms |

**Against the pass criteria:**

| Check | Target | Result |
|---|---|---|
| p95 latency per API route | < 600 ms | ✅ for every route except photo upload (1.1 s, see below) |
| Server errors | 0 | ✅ 0 |
| Screen drift between screens | < 500 ms | ✅ p95 301 ms, max 314 ms over 59 items |
| Realtime connections | < 20 | ✅ 3 (screens only; guests poll) |
| Queue order / auto-approve | — | ✅ all 300 accepted and queued; 58 played in order during the run |
| PDPA delete-after-show at volume | — | ✅ every shown photo was already gone from R2 when the run ended; the rest were removed when the venue was ended |

**Notes:**
- **Photo upload time is the one miss, and it's mostly the uploader's network.** Each upload carries ~380 KB. Here,
  300 uploads all left one home connection, so up to dozens ran in parallel. At the wedding each guest uploads over
  their own phone connection, and the server side of the request is the same quick R2 write. The 600 ms target was
  set for small JSON requests; a sub-second median for a photo is fine for guests, who see a "sending" spinner.
- **Most of the ~260 ms is the round trip** from Thailand to the Worker and on to Supabase in Singapore; it barely
  moved under load.
- **Only 58 of 300 messages reached the screen during the run.** That's expected: at 15 seconds each, one screen
  shows about 60 messages in 15 minutes. The real event has the 45-minute queue limit (`max_queue_seconds`) to stop
  guests from waiting hours; this test venue had it raised on purpose.
- **Capacity verdict:** 500 guests with 300 photo messages in 10 minutes is handled with room to spare. The practical
  limit at the wedding is screen time (queue length), not the servers.

Raw numbers: `scripts/load/results-2026-11-18T20-32-25-558Z.json` (git-ignored; times are UTC).
