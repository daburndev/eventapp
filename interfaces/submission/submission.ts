export type SubmissionStatus =
  | "payment_pending"
  | "pending_approval"
  | "approved"
  | "playing"
  | "played"
  | "rejected"
  | "removed";

export interface Submission {
  id: string;
  status: SubmissionStatus;
  message: string;
  instagram: string | null;
  lineId: string | null;
  photoPath: string | null;
  tierLabel: string;
  durationSeconds: number;
  createdAt: string;
  approvedAt: string | null;
  startedAt: string | null;
  rejectionReason: string | null;
}

/** What a guest sees on their status page. */
export interface SubmissionStatusView extends Submission {
  venueId: string;
  venueName: string;
  queuePosition: number | null;
  /** Seconds until this item should start (approved items only). */
  etaSeconds: number | null;
  endsAt: string | null;
  serverNow: string;
}

export interface CreateSubmissionInput {
  venueSlug: string;
  tierId: string;
  message: string;
  instagram: string | null;
  lineId: string | null;
  photoPath: string | null;
  deviceId: string;
  /** Bot check; verified by our API, ignored by the database. */
  turnstileToken: string | null;
}

export interface CreatedSubmission {
  publicToken: string;
  status: SubmissionStatus;
}

