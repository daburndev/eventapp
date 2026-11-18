export const APP_ROUTES = {
  home: "/",
  guestVenue: (venueSlug: string) => `/v/${encodeURIComponent(venueSlug)}`,
  guestStatus: (venueSlug: string, publicToken: string) =>
    `/v/${encodeURIComponent(venueSlug)}/s/${encodeURIComponent(publicToken)}`,
  admin: "/admin",
  privacy: "/privacy",
} as const;
