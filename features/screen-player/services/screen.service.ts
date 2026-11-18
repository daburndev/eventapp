import type { ScreenState } from "@/interfaces/screen/screen-state";
import { mapScreenState } from "@/features/screen-player/mappers/screen-state.mapper";
import { API_ROUTES } from "@/lib/constants/api-routes";
import { apiRequest } from "@/lib/services/request";

/** Heartbeat + "move the queue on if the current item has ended" + read state, in one call. */
export async function syncScreen(screenToken: string): Promise<ScreenState> {
  return mapScreenState(await apiRequest(API_ROUTES.screenSync(screenToken), { method: "POST" }));
}
