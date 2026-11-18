import "server-only";

import { errorResponse } from "@/lib/services/api-response";
import { readString } from "@/lib/utils/read-field";

// Cloudflare Turnstile check for guest submissions. We can't rate-limit strictly by IP
// because a whole wedding shares one venue Wi-Fi IP, so bots are stopped here instead.
// Skipped when TURNSTILE_SECRET_KEY is unset (local dev).

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Returns an error Response to send back, or null when the request may continue. */
export async function rejectIfNotHuman(body: Record<string, unknown>, request: Request): Promise<Response | null> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    return null;
  }

  const token = readString(body, "turnstileToken");
  if (!token) {
    return errorResponse(400, "verification_required", "Please wait for the security check, then try again.");
  }

  try {
    const form = new FormData();
    form.set("secret", secret);
    form.set("response", token);
    const ip = request.headers.get("CF-Connecting-IP");
    if (ip) {
      form.set("remoteip", ip);
    }
    const result = await fetch(VERIFY_URL, { method: "POST", body: form });
    const outcome: unknown = await result.json();
    const isHuman = typeof outcome === "object" && outcome !== null && (outcome as { success?: unknown }).success === true;
    return isHuman ? null : errorResponse(403, "verification_failed", "Security check failed. Please try again.");
  } catch (cause) {
    // Fail closed: an unverifiable request is treated like a failed check.
    console.error("[turnstile] verify failed", cause);
    return errorResponse(503, "verification_unavailable", "Security check is unavailable. Please try again.");
  }
}
