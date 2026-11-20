import type { RefObject } from "react";

import { QrCode } from "@/components/common/QrCode";
import { SCREEN_QR_PROMPT, SCREEN_QR_RESOLUTION } from "@/features/screen-player/constants/screen-display";

interface ScreenQrCornerProps {
  guestUrl: string;
  /** The QR box the idle-screen photos bounce off (the prompt badge above it lets them pass behind). */
  qrRef: RefObject<HTMLDivElement | null>;
}

// Sized and framed for a projector: a solid badge and a thick frame stay readable over the video from the back of the room.
// Sits in the top-right corner, level with the event-name badge (ScreenHeader), with the QR centred under its label.
// Sizes are in screen units (--su, see globals.css), so the corner gap is the same on the top and right on any
// screen shape.
export function ScreenQrCorner({ guestUrl, qrRef }: ScreenQrCornerProps) {
  return (
    <div className="absolute top-[calc(var(--su)*1.5)] right-[calc(var(--su)*1.5)] z-10 flex flex-col items-center gap-[calc(var(--su)*0.7)]">
      <p className="rounded-full bg-event-blush px-[calc(var(--su)*1.2)] py-[calc(var(--su)*0.3)] text-[calc(var(--su)*1.7)] leading-tight font-extrabold whitespace-nowrap text-event-cocoa shadow-[0_calc(var(--su)*0.35)_calc(var(--su)*1.1)_rgb(0_0_0/0.6)]">
        {SCREEN_QR_PROMPT}
      </p>
      <div
        ref={qrRef}
        className="rounded-[calc(var(--su)*1)] bg-event-cream p-[calc(var(--su)*0.45)] shadow-[0_calc(var(--su)*0.45)_calc(var(--su)*1.7)_rgb(0_0_0/0.65)]"
      >
        <QrCode
          value={guestUrl}
          size={SCREEN_QR_RESOLUTION}
          label="Scan to send your photo and message to the screen"
          className="block w-[calc(var(--su)*14.5)] p-[calc(var(--su)*0.45)]"
        />
      </div>
    </div>
  );
}
