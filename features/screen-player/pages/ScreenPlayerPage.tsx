"use client";

import { useEffect, useRef } from "react";

import { ConnectionBadge } from "@/components/common/ConnectionBadge";
import { IdleSlide } from "@/features/screen-player/components/IdleSlide";
import { NowPlayingSlide } from "@/features/screen-player/components/NowPlayingSlide";
import { ScreenBackdrop } from "@/features/screen-player/components/ScreenBackdrop";
import { ScreenHeader } from "@/features/screen-player/components/ScreenHeader";
import { ScreenQrCorner } from "@/features/screen-player/components/ScreenQrCorner";
import { useScreenSync } from "@/features/screen-player/hooks/useScreenSync";
import { APP_ROUTES } from "@/lib/constants/app-routes";
import { useNow } from "@/lib/hooks/useNow";
import { useOrigin } from "@/lib/hooks/useOrigin";
import { useWakeLock } from "@/lib/hooks/useWakeLock";
import { progressRatio, remainingMs } from "@/lib/utils/server-clock";

// If an item has ended and the server still hasn't told us what's next (Wi-Fi down),
// fall back to the idle QR instead of freezing on a finished message.
const STALE_ITEM_GRACE_MS = 5_000;
const SERVICE_WORKER_URL = "/sw.js";

function requestFullscreen(): void {
  if (!document.fullscreenElement) {
    void document.documentElement.requestFullscreen?.().catch(() => undefined);
  }
}

/** Development only: drops a worker registered earlier, along with its cached files. */
async function removeServiceWorkers(): Promise<void> {
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map((name) => caches.delete(name)));
}

/**
 * Lets a screen that reloads during a Wi-Fi drop still load the page shell (see public/sw.js).
 * Production only: the worker keeps /_next/static files forever, which is safe with production's
 * content-hashed names but serves stale CSS/JS in `next dev`, where file names don't change.
 */
function useScreenServiceWorker(): void {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }
    if (process.env.NODE_ENV !== "production") {
      removeServiceWorkers().catch((error: unknown) => console.warn("[screen] service worker cleanup failed", error));
      return;
    }
    navigator.serviceWorker
      .register(SERVICE_WORKER_URL)
      .catch((error: unknown) => console.warn("[screen] service worker registration failed", error));
  }, []);
}

export function ScreenPlayerPage({ screenToken }: { screenToken: string }) {
  const { state, lastVenue, clockOffsetMs, connectionStatus, isPending, isOffline, isRevoked } =
    useScreenSync(screenToken);
  const now = useNow(250);
  const qrRef = useRef<HTMLDivElement>(null);
  const origin = useOrigin();
  useWakeLock();
  useScreenServiceWorker();

  const venue = state?.venue ?? lastVenue;
  const guestUrl = venue ? `${origin}${APP_ROUTES.guestVenue(venue.slug)}` : "";
  const isCurrentStale =
    Boolean(state?.current) &&
    remainingMs(state?.endsAt ?? null, clockOffsetMs, now - STALE_ITEM_GRACE_MS) === 0;
  const current = isCurrentStale ? null : (state?.current ?? null);

  return (
    // Browsers only allow fullscreen after a user gesture, so one click on the screen enables it.
    <main
      onClick={requestFullscreen}
      className="screen-units relative flex h-dvh w-screen cursor-none items-center justify-center overflow-hidden bg-black font-display text-white"
    >
      {/* Rendered outside the slides so the video keeps looping smoothly between messages. */}
      <ScreenBackdrop />
      <ScreenHeader />

      <div className="relative flex h-full w-full items-center justify-center">
        {isRevoked ? <p className="text-[3vw] text-danger">This screen link is invalid or was revoked.</p> : null}
        {!isRevoked && isPending && !venue ? <p className="text-[2vw] text-white/80">Connecting to the queue…</p> : null}

        {!isRevoked && venue && origin ? (
          current && state ? (
            // key restarts the slide (and its progress bar) for each new item
            <NowPlayingSlide
              key={current.id}
              submission={current}
              progress={progressRatio(state.startedAt, state.endsAt, clockOffsetMs, now)}
            />
          ) : (
            <IdleSlide qrRef={qrRef} />
          )
        ) : null}
      </div>

      {!isRevoked && venue && origin ? <ScreenQrCorner guestUrl={guestUrl} qrRef={qrRef} /> : null}

      {venue && !isRevoked ? (
        <div className="absolute bottom-3 left-4 opacity-60">
          <ConnectionBadge status={isOffline ? "disconnected" : connectionStatus} />
        </div>
      ) : null}
    </main>
  );
}
