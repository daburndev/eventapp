import type { Submission, SubmissionStatus } from "@/interfaces/submission/submission";
import {
  asRecord,
  readNullableString,
  readNumber,
  readString,
  readEnum,
  type UnknownRecord,
} from "@/lib/utils/read-field";

// Shared by guest-submission, approval and screen-player, so it lives in lib.

export const SUBMISSION_STATUSES: readonly SubmissionStatus[] = [
  "payment_pending",
  "pending_approval",
  "approved",
  "playing",
  "played",
  "rejected",
  "removed",
];

export function mapSubmissionRecord(record: UnknownRecord): Submission {
  return {
    id: readString(record, "id"),
    status: readEnum(record, "status", SUBMISSION_STATUSES, "pending_approval"),
    message: readString(record, "message"),
    instagram: readNullableString(record, ["instagram", "instagramHandle"]),
    lineId: readNullableString(record, "lineId"),
    photoPath: readNullableString(record, "photoPath"),
    tierLabel: readString(record, "tierLabel"),
    durationSeconds: readNumber(record, ["durationSeconds", "tierSeconds"], 15),
    createdAt: readString(record, "createdAt"),
    approvedAt: readNullableString(record, "approvedAt"),
    startedAt: readNullableString(record, "startedAt"),
    rejectionReason: readNullableString(record, "rejectionReason"),
  };
}

export function mapSubmission(payload: unknown): Submission {
  return mapSubmissionRecord(asRecord(payload));
}

export function mapSubmissionList(payload: unknown): Submission[] {
  return Array.isArray(payload) ? payload.map(mapSubmission) : [];
}
