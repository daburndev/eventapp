"use client";

import { useMemo, useState } from "react";

import { ConnectionBadge } from "@/components/common/ConnectionBadge";
import { ErrorState, LoadingState } from "@/components/common/StateMessages";
import type { StaffVenue } from "@/interfaces/venue/venue";
import { EndEventControl } from "@/features/approval/components/EndEventControl";
import { PendingSection } from "@/features/approval/components/PendingSection";
import { QueuePanel } from "@/features/approval/components/QueuePanel";
import { VenueSelector } from "@/features/approval/components/VenueSelector";
import { useApprovalActions } from "@/features/approval/hooks/useApprovalActions";
import { useApprovalData } from "@/features/approval/hooks/useApprovalData";
import { toErrorMessage } from "@/lib/services/api-error";
import { useStaffVenues } from "@/lib/session/useStaffVenues";

function VenueApprovals({ venue }: { venue: StaffVenue }) {
  const { pendingQuery, queueQuery, connectionStatus, clockOffsetMs } = useApprovalData(venue.id);
  const { approve, approveMany, reject, skip, remove, end } = useApprovalActions(venue.id);
  const [checkedIds, setCheckedIds] = useState<ReadonlySet<string>>(new Set());

  const pendingItems = pendingQuery.data?.items;
  // Derived, not stored: anything approved/rejected elsewhere drops out of the selection.
  const selectedIds = useMemo(
    () => new Set((pendingItems ?? []).map((item) => item.id).filter((id) => checkedIds.has(id))),
    [pendingItems, checkedIds],
  );

  const busyIds = useMemo(() => {
    const ids = new Set<string>();
    if (approve.isPending && approve.variables) {
      ids.add(approve.variables);
    }
    if (reject.isPending && reject.variables) {
      ids.add(reject.variables.submissionId);
    }
    return ids;
  }, [approve.isPending, approve.variables, reject.isPending, reject.variables]);

  const actionError = [approve, approveMany, reject, skip, remove, end].find((mutation) => mutation.isError)?.error;

  function toggleSelected(submissionId: string) {
    setCheckedIds((current) => {
      const next = new Set(current);
      if (next.has(submissionId)) {
        next.delete(submissionId);
      } else {
        next.add(submissionId);
      }
      return next;
    });
  }

  function approveSelected() {
    // Oldest first, matching the order guests sent them.
    const orderedIds = (pendingItems ?? []).map((item) => item.id).filter((id) => selectedIds.has(id));
    approveMany.mutate(orderedIds, { onSuccess: () => setCheckedIds(new Set()) });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ConnectionBadge status={connectionStatus} />
        {venue.serviceType === "event" ? (
          <EndEventControl isEnding={end.isPending} onEnd={() => end.mutate()} />
        ) : null}
      </div>
      {end.isSuccess ? (
        <p role="status" className="rounded-xl bg-success/10 px-3 py-2 text-sm text-success">
          Event ended. The screen is closed and personal data is being deleted.
        </p>
      ) : null}
      {actionError ? (
        <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
          {toErrorMessage(actionError)}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <PendingSection
          page={pendingQuery.data}
          isLoading={pendingQuery.isPending}
          error={pendingQuery.isError ? new Error(toErrorMessage(pendingQuery.error)) : null}
          onRetry={() => void pendingQuery.refetch()}
          selectedIds={selectedIds}
          busyIds={busyIds}
          isBulkApproving={approveMany.isPending}
          onToggleSelected={toggleSelected}
          onSelectAll={() => setCheckedIds(new Set((pendingItems ?? []).map((item) => item.id)))}
          onClearSelection={() => setCheckedIds(new Set())}
          onApprove={(submissionId) => approve.mutate(submissionId)}
          onApproveSelected={approveSelected}
          onReject={(submissionId, reason) => reject.mutate({ submissionId, reason })}
        />

        <aside className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Screen queue</h2>
          {queueQuery.isPending ? <LoadingState /> : null}
          {queueQuery.isError ? (
            <ErrorState message={toErrorMessage(queueQuery.error)} onRetry={() => void queueQuery.refetch()} />
          ) : null}
          {queueQuery.data ? (
            <QueuePanel
              queue={queueQuery.data.queue}
              clockOffsetMs={clockOffsetMs}
              isBusy={skip.isPending || remove.isPending}
              onSkip={() => skip.mutate()}
              onRemove={(submissionId) => remove.mutate(submissionId)}
            />
          ) : null}
        </aside>
      </div>
    </div>
  );
}

export function ApprovalPage() {
  const venuesQuery = useStaffVenues();
  const venues = venuesQuery.data ?? [];
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  const venue = venues.find((candidate) => candidate.id === selectedVenueId) ?? venues[0];

  if (!venue) {
    return null;
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6">
      <VenueSelector venues={venues} selectedVenueId={venue.id} onSelect={setSelectedVenueId} />
      {/* key resets per-venue state (mutations, selection, realtime) when switching venues */}
      <VenueApprovals key={venue.id} venue={venue} />
    </main>
  );
}
