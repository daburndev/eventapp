import { EVENT_BRAND } from "@/lib/constants/event-brand";

// Sizes are in screen units (--su, see globals.css) so the badge sits the same distance from the corner as the QR
// (top right, ScreenQrCorner) on any screen.
const BADGE =
  "rounded-full px-[calc(var(--su)*1.6)] py-[calc(var(--su)*0.45)] shadow-[0_calc(var(--su)*0.35)_calc(var(--su)*1.1)_rgb(0_0_0/0.6)]";

// A solid palette badge instead of plain text, so it reads clearly on a washed-out projector image.
export function ScreenHeader() {
  return (
    <header className="absolute top-0 left-0 z-10 p-[calc(var(--su)*1.5)] text-[calc(var(--su)*2.6)] leading-none font-extrabold tracking-wide whitespace-nowrap">
      <p className={`${BADGE} bg-event-cocoa text-event-cream`}>{EVENT_BRAND.name}</p>
    </header>
  );
}
