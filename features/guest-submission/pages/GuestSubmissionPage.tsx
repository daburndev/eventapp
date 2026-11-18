"use client";

import { useRouter } from "next/navigation";

import { EmptyState, ErrorState, LoadingState } from "@/components/common/StateMessages";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { QUEUE_HINT_MIN_MINUTES } from "@/features/guest-submission/constants/submission-rules";
import { GuestShell } from "@/features/guest-submission/components/GuestShell";
import { SubmissionForm } from "@/features/guest-submission/components/SubmissionForm";
import { usePublicVenue } from "@/features/guest-submission/hooks/usePublicVenue";
import { useSubmitSubmission } from "@/features/guest-submission/hooks/useSubmitSubmission";
import type { SubmissionFormValues } from "@/features/guest-submission/validation/submission-form.schema";
import { APP_ROUTES } from "@/lib/constants/app-routes";
import { PUBLIC_ENV } from "@/lib/constants/public-env";
import { toErrorMessage } from "@/lib/services/api-error";

export function GuestSubmissionPage({ venueSlug }: { venueSlug: string }) {
  const router = useRouter();
  const venueQuery = usePublicVenue(venueSlug);
  const submit = useSubmitSubmission(venueSlug);

  function handleSubmit(values: SubmissionFormValues, turnstileToken: string | null) {
    submit.mutate({ values, turnstileToken }, {
      onSuccess: (created) => router.push(APP_ROUTES.guestStatus(venueSlug, created.publicToken)),
    });
  }

  if (venueQuery.isPending) {
    return (
      <GuestShell>
        <LoadingState />
      </GuestShell>
    );
  }

  if (venueQuery.isError) {
    return (
      <GuestShell>
        <ErrorState message={toErrorMessage(venueQuery.error)} onRetry={() => void venueQuery.refetch()} />
      </GuestShell>
    );
  }

  const venue = venueQuery.data;

  return (
    <GuestShell venueName={venue.name}>
      <Card>
        {!venue.isAccepting ? (
          <EmptyState title="The screen is closed right now">Please try again later.</EmptyState>
        ) : venue.tiers.length === 0 ? (
          <EmptyState title="Nothing to choose yet">Staff haven&apos;t set up display times.</EmptyState>
        ) : venue.isQueueFull ? (
          <div className="flex flex-col items-center gap-3">
            <EmptyState title="The screen is busy right now">
              About {venue.queueMinutes} minutes of messages are waiting. Please try again in a few minutes.
            </EmptyState>
            <Button variant="secondary" isLoading={venueQuery.isFetching} onClick={() => void venueQuery.refetch()}>
              Check again
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {venue.queueMinutes >= QUEUE_HINT_MIN_MINUTES ? (
              <p className="rounded-xl bg-surface px-3 py-2 text-sm text-muted">
                Current wait: about {venue.queueMinutes} minutes
              </p>
            ) : null}
            <SubmissionForm
              tiers={venue.tiers}
              serviceType={venue.serviceType}
              turnstileSiteKey={PUBLIC_ENV.turnstileSiteKey}
              isSubmitting={submit.isPending}
              submitError={submit.isError ? toErrorMessage(submit.error) : null}
              onSubmit={handleSubmit}
            />
          </div>
        )}
      </Card>
    </GuestShell>
  );
}
