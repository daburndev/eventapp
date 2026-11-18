import { z } from "zod";

import {
  INSTAGRAM_HANDLE_PATTERN,
  LINE_ID_PATTERN,
  MAX_PHOTO_BYTES,
  MESSAGE_MAX_LENGTH,
} from "@/features/guest-submission/constants/submission-rules";

export interface SubmissionFormValues {
  tierId: string;
  message: string;
  instagram: string;
  lineId: string;
  photo: File | null;
}

export type SubmissionFormErrors = Partial<Record<keyof SubmissionFormValues, string>>;

export const submissionFormSchema = z.object({
  tierId: z.string().min(1, "Choose how long to show your message."),
  message: z
    .string()
    .trim()
    .min(1, "Write a message.")
    .max(MESSAGE_MAX_LENGTH, `Keep it under ${MESSAGE_MAX_LENGTH} characters.`),
  instagram: z
    .string()
    .trim()
    .transform((value) => value.replace(/^@/, ""))
    .refine((value) => value === "" || INSTAGRAM_HANDLE_PATTERN.test(value), "That doesn't look like an Instagram handle."),
  lineId: z
    .string()
    .trim()
    .transform((value) => value.replace(/^@/, "").toLowerCase())
    .refine(
      (value) => value === "" || LINE_ID_PATTERN.test(value),
      "That doesn't look like a LINE ID (4–20 letters, numbers, . - _).",
    ),
  photo: z
    .instanceof(File)
    .nullable()
    .refine((file) => !file || file.size <= MAX_PHOTO_BYTES, "Photo is too large (max 20 MB)."),
});

export function validateSubmissionForm(values: SubmissionFormValues): SubmissionFormErrors {
  const result = submissionFormSchema.safeParse(values);
  if (result.success) {
    return {};
  }
  const errors: SubmissionFormErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as keyof SubmissionFormValues | undefined;
    if (field && !errors[field]) {
      errors[field] = issue.message;
    }
  }
  return errors;
}
