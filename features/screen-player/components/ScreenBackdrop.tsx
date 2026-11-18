"use client";

import { useEffect, useRef } from "react";

import { SCREEN_BACKGROUND_VIDEO } from "@/features/screen-player/constants/screen-display";

/** Looping event video behind every slide, dimmed so messages and the QR stay readable. */
export function ScreenBackdrop() {
  const videoRef = useRef<HTMLVideoElement>(null);

  // React doesn't put `muted` in the server HTML, and browsers only autoplay muted video,
  // so mute and start it explicitly once the page is live.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    video.muted = true;
    video.play().catch((error: unknown) => console.warn("[screen] background video could not start", error));
  }, []);

  return (
    <div className="absolute inset-0" aria-hidden>
      <video
        ref={videoRef}
        src={SCREEN_BACKGROUND_VIDEO}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        className="h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-black/45" />
    </div>
  );
}
