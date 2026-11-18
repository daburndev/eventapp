// One upload stores two renditions next to each other in R2:
//   <venueId>/<uuid>.jpg     full size, for screens
//   <venueId>/<uuid>_t.jpg   thumbnail, for the admin list and guest page
// The database only stores the full-size path; the thumbnail path is derived.

export type PhotoVariant = "screen" | "thumb";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const PHOTO_KEY_PATTERN = new RegExp(`^${UUID}/${UUID}(_t)?\\.jpg$`);

export function thumbPathFor(photoPath: string): string {
  return photoPath.replace(/\.jpg$/, "_t.jpg");
}

export function photoKeyFor(photoPath: string, variant: PhotoVariant): string {
  return variant === "thumb" ? thumbPathFor(photoPath) : photoPath;
}

/** Guards the /media route so it can only read keys shaped like ours. */
export function isPhotoKey(key: string): boolean {
  return PHOTO_KEY_PATTERN.test(key);
}
