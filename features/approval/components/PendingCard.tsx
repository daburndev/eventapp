"use client";

import { useState, type KeyboardEvent } from "react";

import { SubmissionPhoto } from "@/components/common/SubmissionPhoto";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { Submission } from "@/interfaces/submission/submission";
import { REJECT_REASONS } from "@/features/approval/constants/reject-reasons";

interface PendingCardProps {
  submission: Submission;
  isBusy: boolean;
  isSelected: boolean;
  onToggleSelected: () => void;
  onApprove: () => void;
  onReject: (reason: string | null) => void;
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function PendingCard({
  submission,
  isBusy,
  isSelected,
  onToggleSelected,
  onApprove,
  onReject,
}: PendingCardProps) {
  const [isChoosingReason, setIsChoosingReason] = useState(false);

  // Shortcuts for fast approving at busy events: focus a card (Tab), then A = approve, R = reject, X = select.
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || isBusy || event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }
    const key = event.key.toLowerCase();
    if (key === "a") {
      event.preventDefault();
      onApprove();
    } else if (key === "r") {
      event.preventDefault();
      setIsChoosingReason(true);
    } else if (key === "x") {
      event.preventDefault();
      onToggleSelected();
    }
  }

  return (
    <Card
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label={`Message: ${submission.message}. Press A to approve, R to reject, X to select.`}
      className={`relative flex flex-col gap-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        isSelected ? "border-accent" : ""
      }`}
    >
      <label className="absolute top-6 left-6 z-10 flex size-8 cursor-pointer items-center justify-center rounded-lg bg-black/60">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelected}
          aria-label="Select for bulk approve"
          className="size-4 accent-accent"
        />
      </label>
      <SubmissionPhoto
        variant="thumb"
        photoPath={submission.photoPath}
        alt={`Photo sent with: ${submission.message}`}
        className="aspect-square w-full rounded-xl"
      />
      <div className="flex flex-col gap-1">
        <p className="text-lg font-medium break-words">{submission.message}</p>
        {submission.instagram ? <p className="text-sm text-accent">@{submission.instagram}</p> : null}
        {submission.lineId ? <p className="text-sm text-accent">LINE: {submission.lineId}</p> : null}
        <p className="text-xs text-muted">
          {submission.tierLabel} · sent {formatTime(submission.createdAt)}
        </p>
      </div>

      {isChoosingReason ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Why reject?</p>
          <div className="flex flex-wrap gap-2">
            {REJECT_REASONS.map((reason) => (
              <Button key={reason} variant="secondary" disabled={isBusy} onClick={() => onReject(reason)}>
                {reason}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="danger" disabled={isBusy} onClick={() => onReject(null)}>
              Reject without reason
            </Button>
            <Button variant="ghost" onClick={() => setIsChoosingReason(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" disabled={isBusy} onClick={() => setIsChoosingReason(true)}>
            Reject
          </Button>
          <Button disabled={isBusy} onClick={onApprove}>
            Approve
          </Button>
        </div>
      )}
    </Card>
  );
}
