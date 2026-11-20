// Event screen styling for #POPFOUNDHERPRINCE. The video and saver photos are served from public/.
export const SCREEN_BACKGROUND_VIDEO = "/Popfoundherprince.mp4";
export const SCREEN_QR_PROMPT = "แจกวาร์ปหน่อยค้าบ👇🏻";
/** QR image resolution in pixels; it's displayed at a viewport-relative size so it stays sharp on 4K screens. */
export const SCREEN_QR_RESOLUTION = 600;

export interface ScreenSaverPhoto {
  src: string;
  /** Width / height. */
  aspectRatio: number;
  /** Decoration (word art, heart) rather than a photo of people: drawn smaller, see SCREEN_SAVER_STICKER_SIZE_SU. */
  sticker?: boolean;
}

/**
 * Cutout photos (transparent WebP, trimmed to the content) for the idle-screen saver. Three are on screen at once,
 * and each swaps to a random photo not already showing on every bounce. The first three are the starting set.
 */
export const SCREEN_SAVER_PHOTOS: readonly ScreenSaverPhoto[] = [
  { src: "/savers/saver1.webp", aspectRatio: 863 / 800 },
  { src: "/savers/saver2.webp", aspectRatio: 855 / 800 },
  { src: "/savers/1.webp", aspectRatio: 671 / 800 },
  { src: "/savers/2.webp", aspectRatio: 667 / 800 },
  { src: "/savers/3.webp", aspectRatio: 725 / 800 },
  { src: "/savers/4.webp", aspectRatio: 880 / 800 },
  { src: "/savers/5.webp", aspectRatio: 642 / 800 },
  { src: "/savers/6.webp", aspectRatio: 810 / 800 },
  { src: "/savers/7.webp", aspectRatio: 831 / 800 },
  { src: "/savers/8.webp", aspectRatio: 822 / 800 },
  { src: "/savers/9.webp", aspectRatio: 749 / 800 },
  { src: "/savers/10.webp", aspectRatio: 887 / 800 },
  { src: "/savers/11.webp", aspectRatio: 1077 / 800 },
  { src: "/savers/12.webp", aspectRatio: 1139 / 800 },
  { src: "/savers/13.webp", aspectRatio: 967 / 800 },
  { src: "/savers/14.webp", aspectRatio: 737 / 800 },
  { src: "/savers/15.webp", aspectRatio: 325 / 800 },
  { src: "/savers/16.webp", aspectRatio: 1045 / 800 },
  { src: "/savers/17.webp", aspectRatio: 764 / 800 },
  { src: "/savers/18.webp", aspectRatio: 667 / 800 },
  { src: "/savers/19.webp", aspectRatio: 776 / 800 },
  { src: "/savers/20.webp", aspectRatio: 601 / 800 },
  { src: "/savers/21.webp", aspectRatio: 481 / 800 },
  { src: "/savers/22.webp", aspectRatio: 615 / 800 },
  { src: "/savers/23.webp", aspectRatio: 524 / 800 },
  { src: "/savers/24.webp", aspectRatio: 689 / 800 },
  { src: "/savers/25.webp", aspectRatio: 762 / 800 },
  { src: "/savers/26.webp", aspectRatio: 719 / 800 },
  { src: "/savers/27.webp", aspectRatio: 789 / 800 },
  { src: "/savers/28.webp", aspectRatio: 825 / 800 },
  { src: "/savers/29.webp", aspectRatio: 562 / 800 },
  { src: "/savers/30.webp", aspectRatio: 1146 / 800 },
  { src: "/savers/31.webp", aspectRatio: 1126 / 800 },
  { src: "/savers/32.webp", aspectRatio: 1063 / 800 },
  { src: "/savers/33.webp", aspectRatio: 943 / 800 },
  { src: "/savers/34.webp", aspectRatio: 763 / 800 },
  { src: "/savers/35.webp", aspectRatio: 600 / 800 },
  { src: "/savers/36.webp", aspectRatio: 622 / 800 },
  { src: "/savers/37.webp", aspectRatio: 508 / 800 },
  // 38-41 are word art (POP / PRINCE) and 42 a heart: drawn as small stickers.
  { src: "/savers/38.webp", aspectRatio: 2444 / 800, sticker: true },
  { src: "/savers/39.webp", aspectRatio: 4216 / 800, sticker: true },
  { src: "/savers/40.webp", aspectRatio: 1805 / 800, sticker: true },
  { src: "/savers/41.webp", aspectRatio: 3523 / 800, sticker: true },
  { src: "/savers/42.webp", aspectRatio: 860 / 800, sticker: true },
];
export const SCREEN_SAVERS_ON_SCREEN = 3;
/**
 * Largest box a saver fits in, in screen units (--su; the screen is 100su wide). Photos are 19su tall so every photo
 * of the couple reads at one scale (none is wide enough to reach the width limit).
 */
export const SCREEN_SAVER_PHOTO_SIZE_SU = { maxHeight: 19, maxWidth: 40 } as const;
/** Stickers are smaller, so the photos stay the focus: wide word art is limited by width, the heart by height. */
export const SCREEN_SAVER_STICKER_SIZE_SU = { maxHeight: 9, maxWidth: 22 } as const;
/** A saver swaps to another photo on every Nth bounce (1 = every bounce); its border color changes on every bounce. */
export const SCREEN_SAVER_BOUNCES_PER_PHOTO = 1;
/** Speed along each axis, as a fraction of the screen width per second (the same on any screen size). */
export const SCREEN_SAVER_SPEED = 0.09;
/** Event palette: each saver's outline switches to a random one of these whenever it bounces. */
export const SCREEN_SAVER_BORDER_COLORS = ["#724319", "#D88180", "#F7B1B0", "#FEEAC7", "#CAD182"] as const;
