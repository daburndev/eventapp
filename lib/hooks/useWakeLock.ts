"use client";

import { useEffect } from "react";

/** Asks the browser to keep the display awake (kiosk screens). Silently does nothing if unsupported. */
export function useWakeLock(): void {
  useEffect(() => {
    if (!("wakeLock" in navigator)) {
      return;
    }

    let sentinel: WakeLockSentinel | null = null;
    let isActive = true;

    const request = async () => {
      try {
        sentinel = await navigator.wakeLock.request("screen");
      } catch (error) {
        console.warn("[wake-lock] request failed", error);
      }
    };

    // The lock is released whenever the tab is hidden; take it again when visible.
    const handleVisibility = () => {
      if (isActive && document.visibilityState === "visible") {
        void request();
      }
    };

    void request();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      isActive = false;
      document.removeEventListener("visibilitychange", handleVisibility);
      void sentinel?.release();
    };
  }, []);
}
