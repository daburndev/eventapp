import type { ScreenState } from "@/interfaces/screen/screen-state";
import { mapNowPlaying } from "@/lib/mappers/now-playing.mapper";
import { mapSubmissionRecord } from "@/lib/mappers/submission.mapper";
import { asRecord, readRecord, readString } from "@/lib/utils/read-field";

export function mapScreenState(payload: unknown): ScreenState {
  const record = asRecord(payload);
  const venue = readRecord(record, "venue") ?? {};
  const next = readRecord(record, "next");
  return {
    ...mapNowPlaying(record),
    venue: {
      id: readString(venue, "id"),
      slug: readString(venue, "slug"),
      name: readString(venue, "name"),
    },
    screenName: readString(record, "screenName"),
    next: next ? mapSubmissionRecord(next) : null,
  };
}
