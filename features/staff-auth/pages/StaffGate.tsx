"use client";

import type { ReactNode } from "react";

import { EmptyState, ErrorState, LoadingState } from "@/components/common/StateMessages";
import { Button } from "@/components/ui/Button";
import { LoginForm } from "@/features/staff-auth/components/LoginForm";
import { useLogin, useLogout } from "@/features/staff-auth/hooks/useStaffAuth";
import { EVENT_BRAND } from "@/lib/constants/event-brand";
import { isAuthError, toErrorMessage } from "@/lib/services/api-error";
import { useStaffVenues } from "@/lib/session/useStaffVenues";

/** Wraps every /admin page: shows the login form until the staff session is valid. */
export function StaffGate({ children }: { children: ReactNode }) {
  const venuesQuery = useStaffVenues();
  const loginMutation = useLogin();
  const logoutMutation = useLogout();

  if (venuesQuery.isPending) {
    return <LoadingState />;
  }

  if (venuesQuery.isError && isAuthError(venuesQuery.error)) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <LoginForm
          isSubmitting={loginMutation.isPending}
          submitError={loginMutation.isError ? toErrorMessage(loginMutation.error) : null}
          onSubmit={(values) => loginMutation.mutate(values)}
        />
      </main>
    );
  }

  if (venuesQuery.isError) {
    return <ErrorState message={toErrorMessage(venuesQuery.error)} onRetry={() => void venuesQuery.refetch()} />;
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <p className="text-sm font-semibold uppercase tracking-widest text-accent">{EVENT_BRAND.name} admin</p>
        <Button variant="ghost" isLoading={logoutMutation.isPending} onClick={() => logoutMutation.mutate()}>
          Log out
        </Button>
      </header>
      {venuesQuery.data.length === 0 ? (
        <EmptyState title="No venues yet">Ask the owner to add you as staff.</EmptyState>
      ) : (
        children
      )}
    </div>
  );
}
