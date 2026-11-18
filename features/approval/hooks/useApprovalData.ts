"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { PENDING_PAGE_SIZE } from "@/features/approval/constants/approval-limits";
import { fetchPendingSubmissions } from "@/features/approval/services/approval.service";
import { fetchQueue } from "@/features/approval/services/queue.service";
import { QUERY_KEYS } from "@/lib/constants/query-keys";
import { useVenueSignals } from "@/lib/hooks/useVenueSignals";
import { computeClockOffsetMs } from "@/lib/utils/server-clock";

const FALLBACK_REFRESH_MS = 30_000;
// A burst of 300 submissions in 10 minutes becomes ~1 refetch/s instead of 2 per message.
const SIGNAL_DEBOUNCE_MS = 400;

/** Pending list + queue for one venue, kept live by the venue's staff signals. */
export function useApprovalData(venueId: string) {
  const queryClient = useQueryClient();
  const debounceTimer = useRef<number | null>(null);

  const pendingQuery = useQuery({
    queryKey: QUERY_KEYS.pendingSubmissions(venueId),
    queryFn: () => fetchPendingSubmissions(venueId, PENDING_PAGE_SIZE),
    refetchInterval: FALLBACK_REFRESH_MS,
  });

  const queueQuery = useQuery({
    queryKey: QUERY_KEYS.queue(venueId),
    queryFn: async () => ({ queue: await fetchQueue(venueId), receivedAtMs: Date.now() }),
    refetchInterval: FALLBACK_REFRESH_MS,
  });

  const handleSignal = useCallback(() => {
    if (debounceTimer.current !== null) {
      window.clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = window.setTimeout(() => {
      debounceTimer.current = null;
      // Any change can move items between "pending" and "queue", so refresh both.
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pendingSubmissions(venueId) });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.queue(venueId) });
    }, SIGNAL_DEBOUNCE_MS);
  }, [queryClient, venueId]);

  useEffect(
    () => () => {
      if (debounceTimer.current !== null) {
        window.clearTimeout(debounceTimer.current);
      }
    },
    [],
  );

  const connectionStatus = useVenueSignals(venueId, "staff", handleSignal);

  const clockOffsetMs = useMemo(
    () =>
      queueQuery.data ? computeClockOffsetMs(queueQuery.data.queue.nowPlaying.serverNow, queueQuery.data.receivedAtMs) : 0,
    [queueQuery.data],
  );

  return { pendingQuery, queueQuery, connectionStatus, clockOffsetMs };
}
