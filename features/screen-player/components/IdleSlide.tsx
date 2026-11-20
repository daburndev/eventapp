import type { RefObject } from "react";

import { BouncingSavers } from "@/features/screen-player/components/BouncingSavers";

// The event name and QR sit in the frame around this slide (ScreenPlayerPage), above the savers.
export function IdleSlide({ qrRef }: { qrRef: RefObject<HTMLElement | null> }) {
  return <BouncingSavers obstacleRef={qrRef} />;
}
