import type { Submission } from "@/interfaces/submission/submission";

export interface PendingPage {
  items: Submission[];
  total: number;
}

export interface BulkApproveResult {
  approvedIds: string[];
  skippedCount: number;
}
