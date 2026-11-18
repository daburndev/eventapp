"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import type { SubmissionStatusView } from "@/interfaces/submission/submission";
import { fetchSubmissionStatus } from "@/features/guest-submission/services/submission.service";
import { QUERY_KEYS } from "@/lib/constants/query-keys";
import { computeClockOffsetMs, remainingMs } from "@/lib/utils/server-clock";

// Guests poll instead of holding a Realtime connection: 500 phones at a wedding would
// exceed Supabase's connection limit, while polling costs a few cheap requests each.
const PENDING_POLL_MS = 10_000;
const MIN_QUEUE_POLL_MS = 5_000;
const MAX_QUEUE_POLL_MS = 30_000;
const PER_POSITION_POLL_MS = 3_000;
const PLAYING_GRACE_MS = 500;
const JITTER_RATIO = 0.2;

interface StatusSnapshot {
  status: SubmissionStatusView;
  receivedAtMs: number;
  /** Drawn once per fetch: ±20% so hundreds of phones that loaded together don't poll in lockstep. */
  jitterFactor: number;
}

function drawJitterFactor(): number {
  return 1 - JITTER_RATIO + Math.random() * JITTER_RATIO * 2;
}

/**
 * Polls fast only when something is about to change for this guest; stops once it's final.
 * Must return the same value for the same snapshot: React Query restarts its timer whenever
 * the interval changes, so randomness or Date.now() here would keep postponing the poll.
 */
export function pollIntervalFor(snapshot: StatusSnapshot | undefined): number | false {
  if (!snapshot) {
    return PENDING_POLL_MS;
  }
  const { status, jitterFactor } = snapshot;

  switch (status.status) {
    case "pending_approval":
    case "payment_pending":
      return Math.round(PENDING_POLL_MS * jitterFactor);
    case "approved": {
      const byPosition = (status.queuePosition ?? 1) * PER_POSITION_POLL_MS;
      return Math.round(Math.min(MAX_QUEUE_POLL_MS, Math.max(MIN_QUEUE_POLL_MS, byPosition)) * jitterFactor);
    }
    case "playing":
      // Time left as of the server snapshot (the interval starts when that data arrived).
      return remainingMs(status.endsAt, 0, Date.parse(status.serverNow)) + PLAYING_GRACE_MS;
    default:
      return false;
  }
}

export function useSubmissionStatus(publicToken: string) {
  const query = useQuery({
    queryKey: QUERY_KEYS.submissionStatus(publicToken),
    queryFn: async (): Promise<StatusSnapshot> => ({
      status: await fetchSubmissionStatus(publicToken),
      receivedAtMs: Date.now(),
      jitterFactor: drawJitterFactor(),
    }),
    refetchInterval: (current) => pollIntervalFor(current.state.data),
  });

  const clockOffsetMs = useMemo(
    () => (query.data ? computeClockOffsetMs(query.data.status.serverNow, query.data.receivedAtMs) : 0),
    [query.data],
  );

  return { ...query, submission: query.data?.status ?? null, clockOffsetMs };
}
