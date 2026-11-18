import "server-only";

import type { ApiErrorBody } from "@/interfaces/api/api-envelope";
import { GENERIC_ERROR_MESSAGE } from "@/lib/services/api-error";
import { asRecord } from "@/lib/utils/read-field";

// Uniform envelope for every app/api response: { data } on success, { error } on failure.

export function dataResponse(data: unknown, status = 200): Response {
  return Response.json({ data }, { status });
}

export function errorResponse(status: number, code: string, message: string = GENERIC_ERROR_MESSAGE): Response {
  const error: ApiErrorBody = { code, message };
  return Response.json({ error }, { status });
}

export function internalErrorResponse(context: string, cause: unknown): Response {
  console.error(`[api] ${context}`, cause);
  return errorResponse(500, "internal_error");
}

export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    return asRecord(await request.json());
  } catch {
    return {};
  }
}

/** Query string forwarded verbatim as the RPC payload (CODING_STYLE §5). */
export function readQueryPayload(request: Request): Record<string, string> {
  return Object.fromEntries(new URL(request.url).searchParams);
}
