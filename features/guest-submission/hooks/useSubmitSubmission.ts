"use client";

import { useMutation } from "@tanstack/react-query";

import type { CreatedSubmission } from "@/interfaces/submission/submission";
import { mapFormToCreateSubmission } from "@/features/guest-submission/mappers/submission-form.mapper";
import { createSubmission, uploadSubmissionPhotos } from "@/features/guest-submission/services/submission.service";
import type { SubmissionFormValues } from "@/features/guest-submission/validation/submission-form.schema";
import { getDeviceId } from "@/lib/utils/device-id";
import { createPhotoRenditions } from "@/lib/utils/image-resize";

interface SubmitInput {
  values: SubmissionFormValues;
  turnstileToken: string | null;
}

/** Resize on the phone (screen + thumbnail) → upload both to R2 via our API → create the submission. */
export function useSubmitSubmission(venueSlug: string) {
  return useMutation<CreatedSubmission, Error, SubmitInput>({
    mutationFn: async ({ values, turnstileToken }) => {
      const photoPath = values.photo
        ? await uploadSubmissionPhotos(venueSlug, await createPhotoRenditions(values.photo))
        : null;
      const input = mapFormToCreateSubmission(values, { venueSlug, photoPath, deviceId: getDeviceId(), turnstileToken });
      return createSubmission(input);
    },
  });
}
