import "server-only";

import { dataResponse, errorResponse, internalErrorResponse } from "@/lib/services/api-response";
import { createAnonSupabase, createStaffSupabase } from "@/lib/services/supabase-server";

// The one way app/api route handlers reach the backend (CAMSKYNET_ADDENDUM §1):
// pick the caller's credentials, call one Postgres function, pass status + body through.

export type RpcCaller = "anon" | "staff";

export async function proxyRpc(
  functionName: string,
  payload: Record<string, unknown>,
  caller: RpcCaller,
): Promise<Response> {
  try {
    const supabase = caller === "staff" ? await createStaffSupabase() : createAnonSupabase();
    const { data, error, status } = await supabase.rpc(functionName, { payload });

    // supabase-js reports a network failure as status 0 with no hint.
    if (error && !status) {
      return internalErrorResponse(`rpc ${functionName} unreachable`, error);
    }

    if (error) {
      // Our functions raise message = machine code, hint = human text. Postgres/PostgREST
      // errors (e.g. permission denied) have no hint, so the client shows a generic message.
      return errorResponse(status || 500, error.message, error.hint || undefined);
    }

    return dataResponse(data, status || 200);
  } catch (cause) {
    return internalErrorResponse(`rpc ${functionName}`, cause);
  }
}
