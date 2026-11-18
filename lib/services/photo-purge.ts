import { createClient } from "@supabase/supabase-js";

import { thumbPathFor } from "../utils/photo-path";
import { asRecord, readNumber, readString } from "../utils/read-field";

// PDPA photo purge, run by the Worker cron (worker/index.js) every minute.
// Postgres queues photo paths when personal data is scrubbed; this deletes them from R2
// and confirms. A claim is a 5-minute lease, so a crash mid-run just means a retry.
// Bundled by wrangler outside Next.js: relative imports only, no "server-only"/next/* imports.

export interface PhotoPurgeEnv {
  PHOTOS: R2Bucket;
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
}

const BATCH_SIZE = 200;
// Up to 1,000 photos per minute; one large wedding is ~300.
const MAX_BATCHES_PER_RUN = 5;

interface ClaimedDeletion {
  id: number;
  photoPath: string;
}

function mapClaims(payload: unknown): ClaimedDeletion[] {
  return (Array.isArray(payload) ? payload : []).map((item) => {
    const record = asRecord(item);
    return { id: readNumber(record, "id"), photoPath: readString(record, "photoPath") };
  });
}

export async function purgeDeletedPhotos(env: PhotoPurgeEnv): Promise<void> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
    console.error("[photo-purge] SUPABASE_URL / SUPABASE_SECRET_KEY not set; photos are not being deleted");
    return;
  }

  // The secret key maps to Postgres' service_role, the only role allowed to claim deletions.
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  for (let batch = 0; batch < MAX_BATCHES_PER_RUN; batch += 1) {
    const claim = await supabase.rpc("claim_photo_deletions", { payload: { limit: BATCH_SIZE } });
    if (claim.error) {
      console.error("[photo-purge] claim failed", claim.error.message);
      return;
    }

    const claims = mapClaims(claim.data);
    if (claims.length === 0) {
      return;
    }

    const keys = claims.filter((row) => row.photoPath).flatMap((row) => [row.photoPath, thumbPathFor(row.photoPath)]);
    if (keys.length > 0) {
      await env.PHOTOS.delete(keys);
    }

    const confirm = await supabase.rpc("confirm_photo_deletions", { payload: { ids: claims.map((row) => row.id) } });
    if (confirm.error) {
      // Deleted from R2 but not confirmed: the lease expires and the (harmless) delete repeats.
      console.error("[photo-purge] confirm failed", confirm.error.message);
      return;
    }
    console.log(`[photo-purge] deleted ${claims.length} photos`);

    if (claims.length < BATCH_SIZE) {
      return;
    }
  }
}
