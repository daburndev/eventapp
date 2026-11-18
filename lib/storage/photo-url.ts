import { photoKeyFor, type PhotoVariant } from "@/lib/utils/photo-path";

/** Photos are served from our own /media route (R2 behind the Worker), never a third-party URL. */
export function buildPhotoUrl(photoPath: string, variant: PhotoVariant): string {
  return `/media/${photoKeyFor(photoPath, variant)}`;
}
