import type { BulkApproveResult, PendingPage } from "@/interfaces/approval/approval";
import type { Submission } from "@/interfaces/submission/submission";
import { mapBulkApproveResult, mapPendingPage } from "@/features/approval/mappers/approval.mapper";
import { API_ROUTES } from "@/lib/constants/api-routes";
import { mapSubmission } from "@/lib/mappers/submission.mapper";
import { apiRequest } from "@/lib/services/request";

export async function fetchPendingSubmissions(venueId: string, limit: number): Promise<PendingPage> {
  return mapPendingPage(await apiRequest(API_ROUTES.pendingApprovals, { query: { venueId, limit: String(limit) } }));
}

export async function approveSubmission(submissionId: string): Promise<Submission> {
  return mapSubmission(await apiRequest(API_ROUTES.approve(submissionId), { method: "POST" }));
}

export async function approveSubmissions(venueId: string, submissionIds: string[]): Promise<BulkApproveResult> {
  const data = await apiRequest(API_ROUTES.bulkApprove, { method: "POST", body: { venueId, submissionIds } });
  return mapBulkApproveResult(data);
}

export async function rejectSubmission(submissionId: string, reason: string | null): Promise<Submission> {
  return mapSubmission(await apiRequest(API_ROUTES.reject(submissionId), { method: "POST", body: { reason } }));
}

export async function endEvent(venueId: string): Promise<void> {
  await apiRequest(API_ROUTES.endEvent(venueId), { method: "POST" });
}
