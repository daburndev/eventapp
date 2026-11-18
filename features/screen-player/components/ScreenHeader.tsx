import { EVENT_BRAND } from "@/lib/constants/event-brand";

// Sizes are in screen units (--su, see globals.css) so both badges sit the same distance from their corners on any screen.
const BADGE =
  "rounded-full px-[calc(var(--su)*1.6)] py-[calc(var(--su)*0.45)] shadow-[0_calc(var(--su)*0.35)_calc(var(--su)*1.1)_rgb(0_0_0/0.6)]";

// Solid palette badges instead of plain text, so they read clearly on a washed-out projector image.
export function ScreenHeader() {
  return (
    <header className="absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-[calc(var(--su)*2)] p-[calc(var(--su)*1.5)] text-[calc(var(--su)*2.6)] leading-none font-extrabold tracking-wide whitespace-nowrap">
      <p className={`${BADGE} bg-event-cocoa text-event-cream`}>{EVENT_BRAND.name}</p>
      <p className={`${BADGE} bg-event-cream text-event-cocoa`}>{EVENT_BRAND.dateLabel}</p>
    </header>
  );
}
