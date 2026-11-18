// Event screen styling for #POPFOUNDHERPRINCE. The video and saver photos are served from public/.
export const SCREEN_BACKGROUND_VIDEO = "/Popfoundherprince.mp4";
export const SCREEN_QR_PROMPT = "แจกวาร์ปหน่อยค้าบ👇🏻";
/** QR image resolution in pixels; it's displayed at a viewport-relative size so it stays sharp on 4K screens. */
export const SCREEN_QR_RESOLUTION = 600;

/**
 * Cutout photos (transparent WebP, trimmed to the people) for the idle-screen saver. Three are on screen at once,
 * and each swaps to a random photo not already showing every few bounces. `aspectRatio` is width / height.
 * The first three are the starting set.
 */
export const SCREEN_SAVER_PHOTOS = [
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
] as const;
export const SCREEN_SAVERS_ON_SCREEN = 3;
/** A saver swaps to another photo on every Nth bounce (its border color still changes on every bounce). */
export const SCREEN_SAVER_BOUNCES_PER_PHOTO = 3;
/** Speed along each axis, as a fraction of the screen width per second (the same on any screen size). */
export const SCREEN_SAVER_SPEED = 0.09;
/** Event palette: each saver's outline switches to a random one of these whenever it bounces. */
export const SCREEN_SAVER_BORDER_COLORS = ["#724319", "#D88180", "#F7B1B0", "#FEEAC7", "#CAD182"] as const;
