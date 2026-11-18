import type { ReactNode } from "react";

import { EVENT_BRAND } from "@/lib/constants/event-brand";

/** Narrow, phone-first frame shared by the guest pages. */
export function GuestShell({ venueName, children }: { venueName?: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-6">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">{EVENT_BRAND.name}</p>
        <h1 className="text-2xl font-bold">{venueName ?? "Send to the screen"}</h1>
      </header>
      {children}
    </main>
  );
}
