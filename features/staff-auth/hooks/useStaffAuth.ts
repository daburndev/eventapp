"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { login, logout, type LoginCredentials } from "@/features/staff-auth/services/auth.service";
import { QUERY_KEYS } from "@/lib/constants/query-keys";

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, LoginCredentials>({
    mutationFn: login,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.staffVenues }),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, void>({
    mutationFn: logout,
    // Drop every cached staff read so the next person can't see them.
    onSuccess: () => queryClient.resetQueries(),
  });
}
