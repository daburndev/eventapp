"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  approveSubmission,
  approveSubmissions,
  endEvent,
  rejectSubmission,
} from "@/features/approval/services/approval.service";
import { removeFromQueue, skipCurrent } from "@/features/approval/services/queue.service";
import { QUERY_KEYS } from "@/lib/constants/query-keys";

interface RejectInput {
  submissionId: string;
  reason: string | null;
}

export function useApprovalActions(venueId: string) {
  const queryClient = useQueryClient();

  const refreshVenueData = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pendingSubmissions(venueId) }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.queue(venueId) }),
    ]);

  const approve = useMutation({ mutationFn: approveSubmission, onSettled: refreshVenueData });

  const approveMany = useMutation({
    mutationFn: (submissionIds: string[]) => approveSubmissions(venueId, submissionIds),
    onSettled: refreshVenueData,
  });

  const reject = useMutation({
    mutationFn: ({ submissionId, reason }: RejectInput) => rejectSubmission(submissionId, reason),
    onSettled: refreshVenueData,
  });

  const skip = useMutation({ mutationFn: () => skipCurrent(venueId), onSettled: refreshVenueData });

  const remove = useMutation({ mutationFn: removeFromQueue, onSettled: refreshVenueData });

  const end = useMutation({ mutationFn: () => endEvent(venueId), onSettled: refreshVenueData });

  return { approve, approveMany, reject, skip, remove, end };
}
