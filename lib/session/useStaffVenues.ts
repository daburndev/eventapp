"use client";

import { useQuery } from "@tanstack/react-query";

import { QUERY_KEYS } from "@/lib/constants/query-keys";
import { fetchStaffVenues } from "@/lib/session/staff-venues.service";

export function useStaffVenues() {
  return useQuery({
    queryKey: QUERY_KEYS.staffVenues,
    queryFn: fetchStaffVenues,
    staleTime: 60_000,
  });
}
