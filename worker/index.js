// Custom Worker entry (OpenNext "custom worker" pattern): the generated Next.js fetch
// handler plus our cron. Plain JS because .open-next/worker.js only exists after
// `opennextjs-cloudflare build`; wrangler bundles this file and the TS it imports.
import { default as handler } from "../.open-next/worker.js";
import { purgeDeletedPhotos } from "../lib/services/photo-purge";

const worker = {
  fetch: handler.fetch,

  // Every minute (wrangler.jsonc triggers): delete photos whose personal data was scrubbed (PDPA).
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(purgeDeletedPhotos(env));
  },
};

export default worker;
