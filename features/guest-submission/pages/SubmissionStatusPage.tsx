"use client";

import Link from "next/link";

import { ErrorState, LoadingState } from "@/components/common/StateMessages";
import { GuestShell } from "@/features/guest-submission/components/GuestShell";
import { StatusCard } from "@/features/guest-submission/components/StatusCard";
import { useSubmissionStatus } from "@/features/guest-submission/hooks/useSubmissionStatus";
import { APP_ROUTES } from "@/lib/constants/app-routes";
import { toErrorMessage } from "@/lib/services/api-error";

interface SubmissionStatusPageProps {
  venueSlug: string;
  publicToken: string;
}

export function SubmissionStatusPage({ venueSlug, publicToken }: SubmissionStatusPageProps) {
  const { submission, clockOffsetMs, isPending, isError, error, refetch } = useSubmissionStatus(publicToken);

  return (
    // Empty name (status not loaded yet, or the DB function predates venueName) falls back to the generic title.
    <GuestShell venueName={submission?.venueName || undefined}>
      {isPending ? <LoadingState label="Checking your message…" /> : null}
      {isError ? <ErrorState message={toErrorMessage(error)} onRetry={() => void refetch()} /> : null}
      {submission ? <StatusCard submission={submission} clockOffsetMs={clockOffsetMs} /> : null}
      <Link
        href={APP_ROUTES.guestVenue(venueSlug)}
        className="text-center text-sm font-semibold text-accent underline-offset-4 hover:underline"
      >
        Send another message
      </Link>
    </GuestShell>
  );
}
