"use client";

import { SubmissionPhoto } from "@/components/common/SubmissionPhoto";
import { Card } from "@/components/ui/Card";
import type { SubmissionStatusView } from "@/interfaces/submission/submission";
import { STATUS_COPY } from "@/features/guest-submission/constants/submission-rules";
import { useNow } from "@/lib/hooks/useNow";
import { remainingMs } from "@/lib/utils/server-clock";

interface StatusCardProps {
  submission: SubmissionStatusView;
  clockOffsetMs: number;
}

function StatusDetail({ submission, clockOffsetMs }: StatusCardProps) {
  const now = useNow(500);

  if (submission.status === "approved" && submission.queuePosition !== null) {
    return (
      <p className="text-muted">
        {submission.queuePosition === 1 ? "You're next!" : `Position in queue: ${submission.queuePosition}`}
        {submission.etaSeconds !== null && submission.etaSeconds >= 60
          ? ` · about ${Math.round(submission.etaSeconds / 60)} min`
          : ""}
      </p>
    );
  }
  if (submission.status === "playing") {
    const secondsLeft = Math.ceil(remainingMs(submission.endsAt, clockOffsetMs, now) / 1000);
    return <p className="text-muted">{secondsLeft}s left on screen</p>;
  }
  if (submission.status === "rejected" && submission.rejectionReason) {
    return <p className="text-muted">Reason: {submission.rejectionReason}</p>;
  }
  return <p className="text-muted">{STATUS_COPY[submission.status].detail}</p>;
}

export function StatusCard({ submission, clockOffsetMs }: StatusCardProps) {
  const copy = STATUS_COPY[submission.status];

  return (
    <Card className="flex flex-col gap-4">
      <div aria-live="polite" className="flex flex-col gap-1">
        <h2 className="text-xl font-bold">{copy.title}</h2>
        <StatusDetail submission={submission} clockOffsetMs={clockOffsetMs} />
      </div>
      <SubmissionPhoto photoPath={submission.photoPath} variant="thumb" alt="Your photo" className="aspect-square w-full rounded-xl" />
      <div className="flex flex-col gap-1 rounded-xl bg-surface p-3">
        <p className="text-lg">{submission.message}</p>
        {submission.instagram ? <p className="text-sm text-accent">@{submission.instagram}</p> : null}
        {submission.lineId ? <p className="text-sm text-accent">LINE: {submission.lineId}</p> : null}
        <p className="text-xs text-muted">{submission.tierLabel}</p>
      </div>
    </Card>
  );
}
