import type { RealtimeConnectionStatus } from "@/interfaces/realtime/venue-signal";

const STATUS_STYLE: Record<RealtimeConnectionStatus, { dot: string; label: string }> = {
  connected: { dot: "bg-success", label: "Live" },
  connecting: { dot: "bg-warning animate-pulse", label: "Connecting…" },
  disconnected: { dot: "bg-danger", label: "Offline" },
};

export function ConnectionBadge({ status }: { status: RealtimeConnectionStatus }) {
  const style = STATUS_STYLE[status];
  return (
    <span role="status" className="inline-flex items-center gap-2 text-xs text-muted">
      <span className={`size-2 rounded-full ${style.dot}`} aria-hidden />
      {style.label}
    </span>
  );
}
