import type { BulkApproveResult, PendingPage } from "@/interfaces/approval/approval";
import { mapSubmissionList } from "@/lib/mappers/submission.mapper";
import { asRecord, readArray, readNumber } from "@/lib/utils/read-field";

export function mapPendingPage(payload: unknown): PendingPage {
  const record = asRecord(payload);
  const items = mapSubmissionList(readArray(record, "items"));
  return { items, total: readNumber(record, "total", items.length) };
}

export function mapBulkApproveResult(payload: unknown): BulkApproveResult {
  const record = asRecord(payload);
  return {
    approvedIds: readArray(record, "approvedIds").filter((id): id is string => typeof id === "string"),
    skippedCount: readNumber(record, "skippedCount"),
  };
}
