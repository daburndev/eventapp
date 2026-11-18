// Resizes and re-encodes a photo on the phone before upload. Re-encoding through a canvas
// also drops EXIF metadata (GPS location), and keeps uploads small on venue Wi-Fi/4G.
// sharp can't run on Cloudflare Workers, so this is our only image processing step.

const SCREEN_MAX_EDGE = 1920;
const SCREEN_QUALITY = 0.82;
const THUMB_MAX_EDGE = 480;
const THUMB_QUALITY = 0.72;

export interface PhotoRenditions {
  /** Full size for venue screens. */
  screen: Blob;
  /** Small copy for the admin list and the guest status page. */
  thumb: Blob;
}

export class UnsupportedImageError extends Error {
  constructor() {
    super("This photo format isn't supported. Please choose a JPEG or PNG photo.");
    this.name = "UnsupportedImageError";
  }
}

function scaleToFit(width: number, height: number, maxEdge: number): { width: number; height: number } {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

function encodeJpeg(bitmap: ImageBitmap, maxEdge: number, quality: number): Promise<Blob> {
  const size = scaleToFit(bitmap.width, bitmap.height, maxEdge);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;

  const context = canvas.getContext("2d");
  if (!context) {
    return Promise.reject(new UnsupportedImageError());
  }
  context.drawImage(bitmap, 0, 0, size.width, size.height);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new UnsupportedImageError())), "image/jpeg", quality);
  });
}

/** Decodes once and produces both renditions as JPEG. */
export async function createPhotoRenditions(file: Blob): Promise<PhotoRenditions> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new UnsupportedImageError();
  }

  try {
    const screen = await encodeJpeg(bitmap, SCREEN_MAX_EDGE, SCREEN_QUALITY);
    const thumb = await encodeJpeg(bitmap, THUMB_MAX_EDGE, THUMB_QUALITY);
    return { screen, thumb };
  } finally {
    bitmap.close();
  }
}
