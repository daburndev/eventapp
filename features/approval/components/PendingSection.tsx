"use client";

import { EmptyState, ErrorState, LoadingState } from "@/components/common/StateMessages";
import { Button } from "@/components/ui/Button";
import type { PendingPage } from "@/interfaces/approval/approval";
import { PendingCard } from "@/features/approval/components/PendingCard";

interface PendingSectionProps {
  page: PendingPage | undefined;
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
  selectedIds: ReadonlySet<string>;
  busyIds: ReadonlySet<string>;
  isBulkApproving: boolean;
  onToggleSelected: (submissionId: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onApprove: (submissionId: string) => void;
  onApproveSelected: () => void;
  onReject: (submissionId: string, reason: string | null) => void;
}

export function PendingSection({
  page,
  isLoading,
  error,
  onRetry,
  selectedIds,
  busyIds,
  isBulkApproving,
  onToggleSelected,
  onSelectAll,
  onClearSelection,
  onApprove,
  onApproveSelected,
  onReject,
}: PendingSectionProps) {
  const items = page?.items ?? [];
  const total = page?.total ?? 0;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Waiting for approval ({total})</h2>
        {items.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {selectedIds.size > 0 ? (
              <>
                <Button isLoading={isBulkApproving} onClick={onApproveSelected}>
                  Approve selected ({selectedIds.size})
                </Button>
                <Button variant="ghost" onClick={onClearSelection}>
                  Clear
                </Button>
              </>
            ) : (
              <Button variant="secondary" onClick={onSelectAll}>
                Select all shown
              </Button>
            )}
          </div>
        ) : null}
      </div>

      {total > items.length ? (
        <p className="text-sm text-muted">
          Showing the oldest {items.length} of {total}. More load as you approve.
        </p>
      ) : null}
      {items.length > 0 ? <p className="text-xs text-muted">Shortcuts: Tab to a card, then A approve · R reject · X select</p> : null}

      {isLoading ? <LoadingState /> : null}
      {error ? <ErrorState message={error.message} onRetry={onRetry} /> : null}
      {page && items.length === 0 ? <EmptyState title="All caught up">New messages appear here instantly.</EmptyState> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((submission) => (
          <PendingCard
            key={submission.id}
            submission={submission}
            isBusy={busyIds.has(submission.id) || isBulkApproving}
            isSelected={selectedIds.has(submission.id)}
            onToggleSelected={() => onToggleSelected(submission.id)}
            onApprove={() => onApprove(submission.id)}
            onReject={(reason) => onReject(submission.id, reason)}
          />
        ))}
      </div>
    </section>
  );
}
