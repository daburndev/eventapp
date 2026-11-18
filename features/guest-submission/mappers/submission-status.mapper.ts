import type { CreatedSubmission, SubmissionStatusView } from "@/interfaces/submission/submission";
import { mapSubmissionRecord, SUBMISSION_STATUSES } from "@/lib/mappers/submission.mapper";
import { asRecord, readEnum, readNullableNumber, readNullableString, readString } from "@/lib/utils/read-field";

export function mapSubmissionStatusView(payload: unknown): SubmissionStatusView {
  const record = asRecord(payload);
  return {
    ...mapSubmissionRecord(record),
    venueId: readString(record, "venueId"),
    venueName: readString(record, "venueName"),
    queuePosition: readNullableNumber(record, "queuePosition"),
    etaSeconds: readNullableNumber(record, "etaSeconds"),
    endsAt: readNullableString(record, "endsAt"),
    serverNow: readString(record, "serverNow", new Date().toISOString()),
  };
}

export function mapCreatedSubmission(payload: unknown): CreatedSubmission {
  const record = asRecord(payload);
  return {
    publicToken: readString(record, "publicToken"),
    status: readEnum(record, "status", SUBMISSION_STATUSES, "pending_approval"),
  };
}

export function mapStoredPhoto(payload: unknown): string {
  return readString(asRecord(payload), "photoPath");
}
