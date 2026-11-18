import type { SubmissionStatus } from "@/interfaces/submission/submission";

/**
 * Realtime messages are signals only: listeners refetch through app/api.
 * `connected` fires on every (re)subscribe so listeners can catch up on anything missed while offline.
 */
export type VenueSignal =
  | { type: "submission_changed"; submissionId: string; status: SubmissionStatus }
  | { type: "screen_state_changed"; currentSubmissionId: string | null; endsAt: string | null }
  | { type: "connected" };

/** Staff get every signal; screens only hear about what's on screen (CAMSKYNET_ADDENDUM Exception A). */
export type SignalAudience = "staff" | "screen";

export type RealtimeConnectionStatus = "connecting" | "connected" | "disconnected";
