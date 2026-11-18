"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";

import type { VenueSummary } from "@/interfaces/venue/venue";
import { syncScreen } from "@/features/screen-player/services/screen.service";
import { QUERY_KEYS } from "@/lib/constants/query-keys";
import { useVenueSignals } from "@/lib/hooks/useVenueSignals";
import { ApiError } from "@/lib/services/api-error";
import { buildPhotoUrl } from "@/lib/storage/photo-url";
import { computeClockOffsetMs, remainingMs } from "@/lib/utils/server-clock";

const HEARTBEAT_MS = 15_000;
const MAX_RETRY_DELAY_MS = 30_000;
// Small delay past endsAt so the server agrees the item has finished.
const END_OF_ITEM_GRACE_MS = 300;
const LAST_VENUE_KEY_PREFIX = "camskynet.screen.lastVenue.";

function isScreenRevoked(error: unknown): boolean {
  return error instanceof ApiError && error.code === "screen_not_found";
}

// The venue name/slug is remembered so a screen that reloads while offline can still show
// its idle QR. Storage may be blocked (kiosk/private mode), which only loses that fallback.
const subscribeNever = () => () => undefined;

/** Raw string (stable between calls, as useSyncExternalStore requires); parsed by the caller. */
function readLastVenueRaw(screenToken: string): string | null {
  try {
    return window.localStorage.getItem(LAST_VENUE_KEY_PREFIX + screenToken);
  } catch {
    return null;
  }
}

function parseVenue(raw: string | null): VenueSummary | null {
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as VenueSummary;
  } catch {
    return null;
  }
}

function writeLastVenue(screenToken: string, venue: VenueSummary): void {
  try {
    window.localStorage.setItem(LAST_VENUE_KEY_PREFIX + screenToken, JSON.stringify(venue));
  } catch {
    // Fallback only; nothing else depends on it.
  }
}

/**
 * Keeps one screen in sync with its venue's shared queue. The server decides what plays;
 * this hook only asks at the right moments: on load, on realtime signals, when the current
 * item ends, and on a heartbeat (which also marks the screen online).
 */
export function useScreenSync(screenToken: string) {
  const queryClient = useQueryClient();
  // Server snapshot is null, so hydration matches; the stored value appears right after.
  const lastVenueRaw = useSyncExternalStore(subscribeNever, () => readLastVenueRaw(screenToken), () => null);
  const lastVenue = useMemo(() => parseVenue(lastVenueRaw), [lastVenueRaw]);

  const query = useQuery({
    queryKey: QUERY_KEYS.screenState(screenToken),
    queryFn: async () => ({ state: await syncScreen(screenToken), receivedAtMs: Date.now() }),
    refetchInterval: HEARTBEAT_MS,
    refetchIntervalInBackground: true,
    staleTime: 0,
    // A screen should never give up on a network blip, only on a revoked link.
    retry: (_failureCount, error) => !isScreenRevoked(error),
    retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, MAX_RETRY_DELAY_MS),
  });

  const state = query.data?.state ?? null;

  const clockOffsetMs = useMemo(
    () => (query.data ? computeClockOffsetMs(query.data.state.serverNow, query.data.receivedAtMs) : 0),
    [query.data],
  );

  const resync = useCallback(
    () => void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.screenState(screenToken) }),
    [queryClient, screenToken],
  );

  const connectionStatus = useVenueSignals(state?.venue.id || null, "screen", resync);

  const endsAt = state?.current ? state.endsAt : null;

  useEffect(() => {
    if (!endsAt) {
      return;
    }
    const delay = remainingMs(endsAt, clockOffsetMs, Date.now()) + END_OF_ITEM_GRACE_MS;
    const timer = window.setTimeout(resync, delay);
    return () => window.clearTimeout(timer);
  }, [endsAt, clockOffsetMs, resync]);

  const venue = state?.venue ?? null;
  useEffect(() => {
    if (venue?.slug) {
      writeLastVenue(screenToken, venue);
    }
  }, [screenToken, venue]);

  // Warm the browser cache so the next slide appears instantly on slow venue Wi-Fi.
  const nextPhotoPath = state?.next?.photoPath ?? null;
  useEffect(() => {
    if (nextPhotoPath) {
      new Image().src = buildPhotoUrl(nextPhotoPath, "screen");
    }
  }, [nextPhotoPath]);

  return {
    state,
    lastVenue,
    clockOffsetMs,
    connectionStatus,
    isPending: query.isPending,
    isOffline: query.isError && !isScreenRevoked(query.error),
    isRevoked: isScreenRevoked(query.error),
  };
}
