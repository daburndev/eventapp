import type { Submission } from "@/interfaces/submission/submission";
import type { VenueSummary } from "@/interfaces/venue/venue";

/** The venue-wide "now playing" state; every screen of a venue shares it. */
export interface NowPlaying {
  serverNow: string;
  startedAt: string | null;
  endsAt: string | null;
  current: Submission | null;
  queueLength: number;
}

export interface ScreenState extends NowPlaying {
  venue: VenueSummary;
  screenName: string;
  /** First item waiting in the queue, so the screen can preload its photo. */
  next: Submission | null;
}

export interface QueueOverview {
  nowPlaying: NowPlaying;
  upNext: Submission[];
}
