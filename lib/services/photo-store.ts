import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

import { dataResponse, errorResponse, internalErrorResponse } from "@/lib/services/api-response";
import { createAnonSupabase } from "@/lib/services/supabase-server";
import { isPhotoKey, thumbPathFor } from "@/lib/utils/photo-path";
import { asRecord, readBoolean, readString } from "@/lib/utils/read-field";

// Guest photos live in Cloudflare R2 (free egress), uploaded through our own API and
// served from /media. No shared edge cache: a deleted photo (PDPA) must stop being
// served at once, and Cloudflare's Cache API can't purge every data centre.

const MAX_SCREEN_BYTES = 3 * 1024 * 1024;
const MAX_THUMB_BYTES = 200 * 1024;
const PHOTO_CONTENT_TYPE = "image/jpeg";
const BROWSER_CACHE_SECONDS = 300;

function photoBucket(): R2Bucket {
  return getCloudflareContext().env.PHOTOS;
}

function isJpegWithin(value: FormDataEntryValue | null, maxBytes: number): value is File {
  return value instanceof File && value.type === PHOTO_CONTENT_TYPE && value.size > 0 && value.size <= maxBytes;
}

/** Stores the phone-made renditions under the venue's folder and returns the path for create_submission. */
export async function storeSubmissionPhotos(request: Request): Promise<Response> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return errorResponse(400, "invalid_photo", "Photo upload is invalid. Please try again.");
  }

  const screen = form.get("screen");
  const thumb = form.get("thumb");
  if (!isJpegWithin(screen, MAX_SCREEN_BYTES) || !isJpegWithin(thumb, MAX_THUMB_BYTES)) {
    return errorResponse(400, "invalid_photo", "Photo upload is invalid. Please try again.");
  }

  try {
    const venueSlug = readString(asRecord(Object.fromEntries(form)), "venueSlug");
    const venueResult = await createAnonSupabase().rpc("get_venue_public", { payload: { venueSlug } });
    if (venueResult.error) {
      return errorResponse(venueResult.status || 400, venueResult.error.message, venueResult.error.hint || undefined);
    }

    const venue = asRecord(venueResult.data);
    if (!readBoolean(venue, "isAccepting")) {
      return errorResponse(403, "venue_closed", "This screen is not accepting messages right now.");
    }

    const photoPath = `${readString(venue, "id")}/${crypto.randomUUID()}.jpg`;
    const httpMetadata = { contentType: PHOTO_CONTENT_TYPE };
    await Promise.all([
      photoBucket().put(photoPath, await screen.arrayBuffer(), { httpMetadata }),
      photoBucket().put(thumbPathFor(photoPath), await thumb.arrayBuffer(), { httpMetadata }),
    ]);

    return dataResponse({ photoPath });
  } catch (cause) {
    return internalErrorResponse("storeSubmissionPhotos", cause);
  }
}

export async function readPhoto(key: string): Promise<Response> {
  if (!isPhotoKey(key)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const object = await photoBucket().get(key);
    if (!object) {
      return new Response("Not found", { status: 404 });
    }
    return new Response(object.body, {
      headers: {
        "Content-Type": object.httpMetadata?.contentType ?? PHOTO_CONTENT_TYPE,
        "Cache-Control": `private, max-age=${BROWSER_CACHE_SECONDS}`,
        ETag: object.httpEtag,
      },
    });
  } catch (cause) {
    console.error("[media] read failed", cause);
    return new Response("Error", { status: 500 });
  }
}
