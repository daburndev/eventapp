// Centralised cache keys (CODING_STYLE §12) so reads and invalidations stay in sync.
export const QUERY_KEYS = {
  publicVenue: (venueSlug: string) => ["public-venue", venueSlug] as const,
  submissionStatus: (publicToken: string) => ["submission-status", publicToken] as const,
  staffVenues: ["staff-venues"] as const,
  pendingSubmissions: (venueId: string) => ["pending-submissions", venueId] as const,
  queue: (venueId: string) => ["queue", venueId] as const,
  screenState: (screenToken: string) => ["screen-state", screenToken] as const,
} as const;
