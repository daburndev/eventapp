import { ApiError, GENERIC_ERROR_MESSAGE } from "@/lib/services/api-error";
import { asRecord, readString } from "@/lib/utils/read-field";

// The shared request wrapper (CODING_STYLE §6). Every feature service calls our
// same-origin app/api routes through this; a bare fetch in a feature is a defect.

type QueryParams = Record<string, string | undefined>;

interface RequestOptions {
  method?: "GET" | "POST";
  query?: QueryParams;
  body?: unknown;
  signal?: AbortSignal;
}

const NETWORK_ERROR_MESSAGE = "Network problem. Check your connection and try again.";

function buildUrl(path: string, query?: QueryParams): string {
  if (!query) {
    return path;
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      params.set(key, value);
    }
  }
  const queryString = params.toString();
  return queryString ? `${path}?${queryString}` : path;
}

/** Strips the `{ data }` / `{ error }` envelope once, so callers only see plain data. */
function unwrapEnvelope(payload: unknown, response: Response): unknown {
  const envelope = asRecord(payload);
  if (response.ok && "data" in envelope) {
    return envelope.data;
  }
  const error = asRecord(envelope.error);
  throw new ApiError(
    readString(error, "code", "unknown_error"),
    readString(error, "message", GENERIC_ERROR_MESSAGE),
    response.status,
  );
}

export async function apiRequest(path: string, options: RequestOptions = {}): Promise<unknown> {
  const { method = "GET", query, body, signal } = options;
  let response: Response;

  // FormData (photo uploads) sets its own multipart Content-Type with the boundary.
  const isFormData = body instanceof FormData;

  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers: body === undefined || isFormData ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
      credentials: "same-origin",
      cache: "no-store",
      signal,
    });
  } catch (error) {
    if (signal?.aborted) {
      throw error;
    }
    throw new ApiError("network_error", NETWORK_ERROR_MESSAGE, 0);
  }

  const payload: unknown = await response.json().catch(() => null);
  return unwrapEnvelope(payload, response);
}
