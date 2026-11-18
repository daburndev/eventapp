import { buildPhotoUrl } from "@/lib/storage/photo-url";
import type { PhotoVariant } from "@/lib/utils/photo-path";

interface SubmissionPhotoProps {
  photoPath: string | null;
  variant: PhotoVariant;
  alt: string;
  className?: string;
}

/** Screens use the full-size "screen" rendition; lists and the guest page use the small "thumb". */
export function SubmissionPhoto({ photoPath, variant, alt, className = "" }: SubmissionPhotoProps) {
  if (!photoPath) {
    return null;
  }
  // eslint-disable-next-line @next/next/no-img-element -- served by our /media route; next/image would need Cloudflare Images
  return <img src={buildPhotoUrl(photoPath, variant)} alt={alt} className={`object-cover ${className}`} />;
}
