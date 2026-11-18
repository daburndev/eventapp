import Link from "next/link";

import { APP_ROUTES } from "@/lib/constants/app-routes";
import { EVENT_BRAND } from "@/lib/constants/event-brand";

// Placeholder until the real marketing landing page is designed.
export function LandingPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-4 py-16">
      <p className="text-sm font-semibold uppercase tracking-widest text-accent">{EVENT_BRAND.name}</p>
      <h1 className="text-4xl leading-tight font-bold">Guests scan, send a photo and message, and appear on your screen.</h1>
      <p className="text-lg text-muted">
        Every message joins a fair queue and shows for 15, 30 or 60 seconds.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link href={APP_ROUTES.guestVenue("demo-event")} className="rounded-xl bg-accent px-4 py-3 font-semibold text-on-accent">
          Try the guest page
        </Link>
        <Link href={APP_ROUTES.admin} className="rounded-xl border border-line px-4 py-3 font-semibold">
          Staff login
        </Link>
      </div>
    </main>
  );
}
