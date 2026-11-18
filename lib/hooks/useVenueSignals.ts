"use client";

import { useEffect, useRef, useState } from "react";

import type { RealtimeConnectionStatus, SignalAudience, VenueSignal } from "@/interfaces/realtime/venue-signal";
import { subscribeToVenueSignals } from "@/lib/realtime/venue-signals";

/** Listens to a venue's realtime signals while mounted. Pass `null` to stay idle. */
export function useVenueSignals(
  venueId: string | null,
  audience: SignalAudience,
  onSignal: (signal: VenueSignal) => void,
): RealtimeConnectionStatus {
  const [status, setStatus] = useState<RealtimeConnectionStatus>("connecting");
  const onSignalRef = useRef(onSignal);

  useEffect(() => {
    onSignalRef.current = onSignal;
  }, [onSignal]);

  useEffect(() => {
    if (!venueId) {
      return;
    }
    return subscribeToVenueSignals(venueId, audience, {
      onSignal: (signal) => onSignalRef.current(signal),
      onStatus: setStatus,
    });
  }, [venueId, audience]);

  return status;
}
