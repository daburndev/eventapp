"use client";

import { SubmissionPhoto } from "@/components/common/SubmissionPhoto";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { QueueOverview } from "@/interfaces/screen/screen-state";
import { useNow } from "@/lib/hooks/useNow";
import { remainingMs } from "@/lib/utils/server-clock";

interface QueuePanelProps {
  queue: QueueOverview;
  clockOffsetMs: number;
  isBusy: boolean;
  onSkip: () => void;
  onRemove: (submissionId: string) => void;
}

function NowPlaying({ queue, clockOffsetMs, isBusy, onSkip }: Omit<QueuePanelProps, "onRemove">) {
  const now = useNow(500);
  const { current, endsAt } = queue.nowPlaying;

  if (!current) {
    return <p className="text-sm text-muted">Screen is idle — showing the QR code.</p>;
  }

  const secondsLeft = Math.ceil(remainingMs(endsAt, clockOffsetMs, now) / 1000);

  return (
    <div className="flex items-center gap-3">
      <SubmissionPhoto photoPath={current.photoPath} variant="thumb" alt="" className="size-16 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{current.message}</p>
        <p className="text-xs text-muted">
          {current.instagram ? `@${current.instagram} · ` : ""}
          {current.lineId ? `LINE: ${current.lineId} · ` : ""}
          {secondsLeft}s left
        </p>
      </div>
      <Button variant="secondary" disabled={isBusy} onClick={onSkip}>
        Skip
      </Button>
    </div>
  );
}

export function QueuePanel({ queue, clockOffsetMs, isBusy, onSkip, onRemove }: QueuePanelProps) {
  return (
    <Card className="flex flex-col gap-4">
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">On screen now</h2>
        <NowPlaying queue={queue} clockOffsetMs={clockOffsetMs} isBusy={isBusy} onSkip={onSkip} />
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Up next ({queue.upNext.length})</h2>
        {queue.upNext.length === 0 ? (
          <p className="text-sm text-muted">No approved messages waiting.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {queue.upNext.map((submission, index) => (
              <li key={submission.id} className="flex items-center gap-3 rounded-xl bg-surface p-2">
                <span className="w-5 text-center text-sm text-muted">{index + 1}</span>
                <SubmissionPhoto photoPath={submission.photoPath} variant="thumb" alt="" className="size-10 shrink-0 rounded-md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{submission.message}</p>
                  <p className="text-xs text-muted">{submission.tierLabel}</p>
                </div>
                <Button variant="ghost" disabled={isBusy} onClick={() => onRemove(submission.id)}>
                  Remove
                </Button>
              </li>
            ))}
          </ol>
        )}
      </section>
    </Card>
  );
}
