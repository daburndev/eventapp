"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { isAuthError } from "@/lib/services/api-error";

const MAX_RETRIES = 2;

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5_000,
        // Retrying a "please log in" error only delays showing the login form.
        retry: (failureCount, error) => !isAuthError(error) && failureCount < MAX_RETRIES,
      },
    },
  });
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
