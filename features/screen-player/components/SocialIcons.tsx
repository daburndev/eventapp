import { useId } from "react";

// Platform marks shown next to a guest's Instagram handle and LINE ID on the screen.
// Sized in em so they match the text they sit beside; decorative, since the text carries the information.

const ICON = "inline-block h-[1em] w-[1em] shrink-0";

export function InstagramIcon() {
  const gradientId = useId();
  return (
    <svg viewBox="0 0 24 24" className={ICON} aria-hidden>
      <defs>
        <radialGradient id={gradientId} cx="0.3" cy="1.07" r="1.3">
          <stop offset="0" stopColor="#FFDD55" />
          <stop offset="0.12" stopColor="#FFDD55" />
          <stop offset="0.5" stopColor="#FF543E" />
          <stop offset="1" stopColor="#C837AB" />
        </radialGradient>
      </defs>
      <rect width="24" height="24" rx="6" fill={`url(#${gradientId})`} />
      <rect x="5" y="5" width="14" height="14" rx="4" fill="none" stroke="#fff" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="3.3" fill="none" stroke="#fff" strokeWidth="1.8" />
      <circle cx="16.1" cy="7.9" r="1" fill="#fff" />
    </svg>
  );
}

export function LineIcon() {
  return (
    <svg viewBox="0 0 24 24" className={ICON} aria-hidden>
      <rect width="24" height="24" rx="5.5" fill="#06C755" />
      <path
        fill="#fff"
        d="M12 4.6c-4.8 0-8.7 3.1-8.7 7 0 3.5 3.1 6.4 7.3 6.9.3.1.7.2.8.4.1.2.1.6 0 .8l-.1.7c0 .2-.2.9.8.5s5.1-3 7-5.2c1.3-1.4 1.9-2.9 1.9-4.4 0-3.9-3.9-6.7-9-6.7z"
      />
      <text
        x="12"
        y="13.4"
        textAnchor="middle"
        fill="#06C755"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="4.6"
        fontWeight="900"
      >
        LINE
      </text>
    </svg>
  );
}
