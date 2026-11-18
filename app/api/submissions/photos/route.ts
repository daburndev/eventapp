import { storeSubmissionPhotos } from "@/lib/services/photo-store";

export async function POST(request: Request) {
  return storeSubmissionPhotos(request);
}
