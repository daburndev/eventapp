"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

interface QrCodeProps {
  value: string;
  size: number;
  label: string;
  /** Overrides the displayed size (e.g. viewport units on screens); `size` stays the image resolution. */
  className?: string;
}

export function QrCode({ value, size, label, className = "" }: QrCodeProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;
    QRCode.toDataURL(value, { width: size, margin: 1 })
      .then((url) => {
        if (isCurrent) {
          setDataUrl(url);
        }
      })
      .catch((error: unknown) => console.error("[qr] failed to render", error));
    return () => {
      isCurrent = false;
    };
  }, [value, size]);

  if (!dataUrl) {
    return (
      <div
        style={className ? undefined : { width: size, height: size }}
        className={`aspect-square rounded-xl bg-white/10 ${className}`}
        aria-hidden
      />
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- data URL; next/image adds nothing here
  return <img src={dataUrl} width={size} height={size} alt={label} className={`rounded-xl bg-white ${className}`} />;
}
