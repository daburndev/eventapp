import type { NowPlaying } from "@/interfaces/screen/screen-state";
import { mapSubmissionRecord } from "@/lib/mappers/submission.mapper";
import { asRecord, readNullableString, readNumber, readRecord, readString } from "@/lib/utils/read-field";

export function mapNowPlaying(payload: unknown): NowPlaying {
  const record = asRecord(payload);
  const current = readRecord(record, "current");

  return {
    serverNow: readString(record, "serverNow", new Date().toISOString()),
    startedAt: readNullableString(record, "startedAt"),
    endsAt: readNullableString(record, "endsAt"),
    current: current ? mapSubmissionRecord(current) : null,
    queueLength: readNumber(record, "queueLength"),
  };
}
