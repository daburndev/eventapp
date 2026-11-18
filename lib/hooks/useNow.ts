"use client";

import { useEffect, useState } from "react";

/** Local clock that re-renders every `intervalMs`, for countdowns and progress bars. */
export function useNow(intervalMs = 250): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);

  return now;
}
