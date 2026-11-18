"use client";

import { useSyncExternalStore } from "react";

const subscribeNever = () => () => undefined;

/** The page's origin (e.g. https://camskynet.example), or "" during server rendering. */
export function useOrigin(): string {
  return useSyncExternalStore(
    subscribeNever,
    () => window.location.origin,
    () => "",
  );
}
