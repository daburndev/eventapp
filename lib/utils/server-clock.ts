// Screens and phones have wrong clocks. The server sends its own `now` with every
// state, and countdowns use the offset so all screens end an item at the same moment.

/** Milliseconds to add to the local clock to get server time. */
export function computeClockOffsetMs(serverNowIso: string, receivedAtMs: number): number {
  const serverNowMs = Date.parse(serverNowIso);
  return Number.isNaN(serverNowMs) ? 0 : serverNowMs - receivedAtMs;
}

export function remainingMs(endsAtIso: string | null, clockOffsetMs: number, localNowMs: number): number {
  if (!endsAtIso) {
    return 0;
  }
  const endsAtMs = Date.parse(endsAtIso);
  if (Number.isNaN(endsAtMs)) {
    return 0;
  }
  return Math.max(0, endsAtMs - (localNowMs + clockOffsetMs));
}

export function progressRatio(
  startedAtIso: string | null,
  endsAtIso: string | null,
  clockOffsetMs: number,
  localNowMs: number,
): number {
  if (!startedAtIso || !endsAtIso) {
    return 0;
  }
  const startMs = Date.parse(startedAtIso);
  const endMs = Date.parse(endsAtIso);
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
    return 0;
  }
  const elapsed = localNowMs + clockOffsetMs - startMs;
  return Math.min(1, Math.max(0, elapsed / (endMs - startMs)));
}
