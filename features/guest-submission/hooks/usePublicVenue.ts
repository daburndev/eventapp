"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchPublicVenue } from "@/features/guest-submission/services/venue.service";
import { QUERY_KEYS } from "@/lib/constants/query-keys";

export function usePublicVenue(venueSlug: string) {
  return useQuery({
    queryKey: QUERY_KEYS.publicVenue(venueSlug),
    queryFn: () => fetchPublicVenue(venueSlug),
    staleTime: 60_000,
  });
}
