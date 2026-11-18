// NEXT_PUBLIC_* values must be referenced literally so Next.js can inline them at build time.
export const PUBLIC_ENV = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabasePublishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
  /** Cloudflare Turnstile; empty turns the guest bot check off (local dev). */
  turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "",
} as const;

