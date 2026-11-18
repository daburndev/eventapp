import type {
  CreatedSubmission,
  CreateSubmissionInput,
  SubmissionStatusView,
} from "@/interfaces/submission/submission";
import {
  mapCreatedSubmission,
  mapStoredPhoto,
  mapSubmissionStatusView,
} from "@/features/guest-submission/mappers/submission-status.mapper";
import { API_ROUTES } from "@/lib/constants/api-routes";
import { apiRequest } from "@/lib/services/request";
import type { PhotoRenditions } from "@/lib/utils/image-resize";

/** Uploads both renditions through our API (stored in R2); returns the path for createSubmission. */
export async function uploadSubmissionPhotos(venueSlug: string, renditions: PhotoRenditions): Promise<string> {
  const form = new FormData();
  form.set("venueSlug", venueSlug);
  form.set("screen", renditions.screen, "screen.jpg");
  form.set("thumb", renditions.thumb, "thumb.jpg");
  return mapStoredPhoto(await apiRequest(API_ROUTES.photos, { method: "POST", body: form }));
}

export async function createSubmission(input: CreateSubmissionInput): Promise<CreatedSubmission> {
  return mapCreatedSubmission(await apiRequest(API_ROUTES.submissions, { method: "POST", body: input }));
}

export async function fetchSubmissionStatus(publicToken: string): Promise<SubmissionStatusView> {
  return mapSubmissionStatusView(await apiRequest(API_ROUTES.submissionStatus(publicToken)));
}
