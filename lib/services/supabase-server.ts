import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { PUBLIC_ENV } from "@/lib/constants/public-env";

// Server-side Supabase clients. Only app/api route handlers (via lib/services helpers) use these.

const STATELESS_AUTH = { persistSession: false, autoRefreshToken: false } as const;

/** Guests and screens: publishable key, no session. */
export function createAnonSupabase(): SupabaseClient {
  return createClient(PUBLIC_ENV.supabaseUrl, PUBLIC_ENV.supabasePublishableKey, { auth: STATELESS_AUTH });
}

/** Staff: session read from (and refreshed into) httpOnly cookies. */
export async function createStaffSupabase(): Promise<SupabaseClient> {
  const cookieStore = await cookies();

  return createServerClient(PUBLIC_ENV.supabaseUrl, PUBLIC_ENV.supabasePublishableKey, {
    cookieOptions: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options);
        }
      },
    },
  });
}

/** Secret key: storage admin only (issuing signed upload URLs). Never used for RPCs. */
export function createAdminSupabase(): SupabaseClient {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("SUPABASE_SECRET_KEY is not set");
  }
  return createClient(PUBLIC_ENV.supabaseUrl, secretKey, { auth: STATELESS_AUTH });
}
