import "server-only";

import { dataResponse, errorResponse, internalErrorResponse } from "@/lib/services/api-response";
import { createStaffSupabase } from "@/lib/services/supabase-server";

// Staff sign-in happens server-side so the session lives only in httpOnly cookies
// (CAMSKYNET_ADDENDUM: no auth calls straight from the browser).

export async function signInStaff(email: string, password: string): Promise<Response> {
  if (!email || !password) {
    return errorResponse(400, "invalid_credentials", "Enter your email and password.");
  }

  try {
    const supabase = await createStaffSupabase();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return errorResponse(401, "invalid_credentials", "Email or password is incorrect.");
    }

    return dataResponse({ signedIn: true });
  } catch (cause) {
    return internalErrorResponse("signInStaff", cause);
  }
}

export async function signOutStaff(): Promise<Response> {
  try {
    const supabase = await createStaffSupabase();
    await supabase.auth.signOut();
    return dataResponse({ signedIn: false });
  } catch (cause) {
    return internalErrorResponse("signOutStaff", cause);
  }
}
