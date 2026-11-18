import type { SubmissionStatus } from "@/interfaces/submission/submission";
import type { ServiceType } from "@/interfaces/venue/venue";

// Mirrors the database checks in create_submission; the database stays the source of truth.
export const MESSAGE_MAX_LENGTH = 120;
export const INSTAGRAM_HANDLE_PATTERN = /^[A-Za-z0-9._]{1,30}$/;
// LINE IDs are case-insensitive: checked (and stored) lowercase, without a leading @.
export const LINE_ID_PATTERN = /^[a-z0-9._-]{4,20}$/;
// Original file limit before resizing on the phone; the upload itself is ~0.3–0.6 MB.
export const MAX_PHOTO_BYTES = 20 * 1024 * 1024;
// Show "current wait" above the form once the queue is at least this long.
export const QUEUE_HINT_MIN_MINUTES = 5;
export const ACCEPTED_PHOTO_TYPES = "image/jpeg,image/png,image/webp";

// PDPA notice shown under the submit button; must match the retention rules in the migrations:
// data is deleted right after its slot on screen (0012_scrub_after_show). Events skip approval
// (0010_auto_approve), so the event copy doesn't promise it.
export const RETENTION_NOTICE: Record<ServiceType, string> = {
  event:
    "Your photo, message, Instagram and LINE ID go straight onto the screen and are deleted right after they're shown.",
  venue:
    "Staff approve every message first. Your photo, message, Instagram and LINE ID are deleted right after they're shown (or if not approved).",
};

export const STATUS_COPY: Record<SubmissionStatus, { title: string; detail: string }> = {
  payment_pending: { title: "Waiting for payment", detail: "Complete your payment to continue." },
  pending_approval: { title: "Waiting for approval", detail: "Staff are checking your message. This usually takes a minute." },
  approved: { title: "You're in the queue", detail: "Keep an eye on the screen!" },
  playing: { title: "You're on screen now! 🎉", detail: "Look up and take a photo." },
  played: {
    title: "Shown on screen",
    detail: "Thanks for sending! Your photo and message have now been deleted. Send another any time.",
  },
  rejected: { title: "Not approved", detail: "Staff didn't approve this message." },
  removed: { title: "Removed by staff", detail: "This message was taken off the queue." },
};
