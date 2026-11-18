import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { PUBLIC_ENV } from "@/lib/constants/public-env";

// Browser Supabase client. Only lib/realtime and lib/storage may import this
// (CAMSKYNET_ADDENDUM Exception A). Everything else goes through app/api.

let browserClient: SupabaseClient | null = null;

export function getBrowserSupabase(): SupabaseClient {
  browserClient ??= createClient(PUBLIC_ENV.supabaseUrl, PUBLIC_ENV.supabasePublishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return browserClient;
}
