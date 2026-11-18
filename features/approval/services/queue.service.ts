import type { QueueOverview } from "@/interfaces/screen/screen-state";
import { mapQueueOverview } from "@/features/approval/mappers/queue.mapper";
import { API_ROUTES } from "@/lib/constants/api-routes";
import { apiRequest } from "@/lib/services/request";

export async function fetchQueue(venueId: string): Promise<QueueOverview> {
  return mapQueueOverview(await apiRequest(API_ROUTES.queue, { query: { venueId } }));
}

export async function skipCurrent(venueId: string): Promise<void> {
  await apiRequest(API_ROUTES.skipCurrent, { method: "POST", body: { venueId } });
}

export async function removeFromQueue(submissionId: string): Promise<void> {
  await apiRequest(API_ROUTES.removeFromQueue(submissionId), { method: "POST" });
}
