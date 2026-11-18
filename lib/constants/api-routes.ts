// Single source of truth for our same-origin API paths (app/api/...).
export const API_ROUTES = {
  venue: (venueSlug: string) => `/api/venues/${encodeURIComponent(venueSlug)}`,
  photos: "/api/submissions/photos",
  submissions: "/api/submissions",
  submissionStatus: (publicToken: string) => `/api/submissions/${encodeURIComponent(publicToken)}`,
  screenSync: (screenToken: string) => `/api/screens/${encodeURIComponent(screenToken)}/sync`,
  login: "/api/auth/login",
  logout: "/api/auth/logout",
  staffVenues: "/api/staff/venues",
  pendingApprovals: "/api/approvals/pending",
  approve: (submissionId: string) => `/api/approvals/${encodeURIComponent(submissionId)}/approve`,
  reject: (submissionId: string) => `/api/approvals/${encodeURIComponent(submissionId)}/reject`,
  bulkApprove: "/api/approvals/bulk-approve",
  // Not under /api/venues/[venueSlug]: Next.js forbids two different param names at one level.
  endEvent: (venueId: string) => `/api/events/${encodeURIComponent(venueId)}/end`,
  queue: "/api/queue",
  skipCurrent: "/api/queue/skip",
  removeFromQueue: (submissionId: string) => `/api/queue/${encodeURIComponent(submissionId)}/remove`,
} as const;
