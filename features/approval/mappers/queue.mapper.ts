import type { QueueOverview } from "@/interfaces/screen/screen-state";
import { mapNowPlaying } from "@/lib/mappers/now-playing.mapper";
import { mapSubmissionList } from "@/lib/mappers/submission.mapper";
import { asRecord, readArray, readRecord } from "@/lib/utils/read-field";

export function mapQueueOverview(payload: unknown): QueueOverview {
  const record = asRecord(payload);
  return {
    nowPlaying: mapNowPlaying(readRecord(record, "nowPlaying") ?? {}),
    upNext: mapSubmissionList(readArray(record, "upNext")),
  };
}
