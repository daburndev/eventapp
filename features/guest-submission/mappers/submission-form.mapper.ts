import type { CreateSubmissionInput } from "@/interfaces/submission/submission";
import type { SubmissionFormValues } from "@/features/guest-submission/validation/submission-form.schema";

interface SubmissionContext {
  venueSlug: string;
  photoPath: string | null;
  deviceId: string;
  turnstileToken: string | null;
}

export function mapFormToCreateSubmission(values: SubmissionFormValues, context: SubmissionContext): CreateSubmissionInput {
  const instagram = values.instagram.trim().replace(/^@/, "");
  const lineId = values.lineId.trim().replace(/^@/, "").toLowerCase();
  return {
    venueSlug: context.venueSlug,
    tierId: values.tierId,
    message: values.message.trim(),
    instagram: instagram === "" ? null : instagram,
    lineId: lineId === "" ? null : lineId,
    photoPath: context.photoPath,
    deviceId: context.deviceId,
    turnstileToken: context.turnstileToken,
  };
}
