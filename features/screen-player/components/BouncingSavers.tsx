"use client";

import { useEffect, useRef, type RefObject } from "react";

import {
  SCREEN_SAVER_BORDER_COLORS,
  SCREEN_SAVER_BOUNCES_PER_PHOTO,
  SCREEN_SAVER_PHOTO_SIZE_SU,
  SCREEN_SAVER_PHOTOS,
  SCREEN_SAVER_STICKER_SIZE_SU,
  SCREEN_SAVER_SPEED,
  SCREEN_SAVERS_ON_SCREEN,
  type ScreenSaverPhoto,
} from "@/features/screen-player/constants/screen-display";

// After a hidden tab or a slow frame, move at most this far in one step so nothing jumps through a wall.
const MAX_FRAME_SECONDS = 0.05;
const BORDER_COLOR_VAR = "--saver-border";
// Starting spots (fractions of the screen) and directions, one per saver on screen.
const SAVER_STARTS = [
  { x: 0.04, y: 0.12, dx: 1, dy: 1 },
  { x: 0.56, y: 0.14, dx: -1, dy: 1 },
  { x: 0.3, y: 0.55, dx: 1, dy: -1 },
] as const;
// Four hard drop-shadows trace the cutout's silhouette as a sticker-style border; the last one is the soft shadow.
// Thick enough to read on a projector from the back of the room.
// In screen units (--su). Negative offsets go inside calc(): "-calc(...)" is invalid CSS and voids the whole filter.
const BORDER_SU = 0.45;
const borderOffset = (sign: 1 | -1) => `calc(var(--su) * ${sign * BORDER_SU})`;
const OUTLINE_FILTER = [
  `drop-shadow(${borderOffset(1)} 0 0 var(${BORDER_COLOR_VAR}))`,
  `drop-shadow(${borderOffset(-1)} 0 0 var(${BORDER_COLOR_VAR}))`,
  `drop-shadow(0 ${borderOffset(1)} 0 var(${BORDER_COLOR_VAR}))`,
  `drop-shadow(0 ${borderOffset(-1)} 0 var(${BORDER_COLOR_VAR}))`,
  "drop-shadow(0 calc(var(--su) * 0.85) calc(var(--su) * 0.85) rgb(0 0 0 / 0.45))",
].join(" ");

/**
 * CSS height that fits this photo's shape in its size box (photo or sticker). In screen units, so portrait screens
 * don't get oversized photos; the width follows from `aspect-ratio`.
 */
function saverHeight(photo: ScreenSaverPhoto): string {
  const box = photo.sticker ? SCREEN_SAVER_STICKER_SIZE_SU : SCREEN_SAVER_PHOTO_SIZE_SU;
  return `calc(var(--su) * ${Math.min(box.maxHeight, box.maxWidth / photo.aspectRatio)})`;
}

/** A random photo that no saver is showing right now. */
function pickPhoto(showing: number[]): number {
  const choices = SCREEN_SAVER_PHOTOS.map((_, index) => index).filter((index) => !showing.includes(index));
  return choices[Math.floor(Math.random() * choices.length)];
}

/** A random palette color other than the current one, so every bounce visibly changes it. */
function pickBorderColor(current?: string): string {
  const choices = SCREEN_SAVER_BORDER_COLORS.filter((color) => color !== current);
  return choices[Math.floor(Math.random() * choices.length)];
}

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  borderColor: string;
  photoIndex: number;
  /** Bounces since the last photo swap. */
  bounces: number;
}

/** Pushes a body out of the obstacle along the shallowest overlap and reflects that velocity. Returns true on a hit. */
function bounceOffObstacle(body: Body, obstacle: Box): boolean {
  const overlapsX = body.x < obstacle.right && body.x + body.width > obstacle.left;
  const overlapsY = body.y < obstacle.bottom && body.y + body.height > obstacle.top;
  if (!overlapsX || !overlapsY) {
    return false;
  }
  const fromLeft = body.x + body.width - obstacle.left;
  const fromRight = obstacle.right - body.x;
  const fromTop = body.y + body.height - obstacle.top;
  const fromBottom = obstacle.bottom - body.y;
  const shallowest = Math.min(fromLeft, fromRight, fromTop, fromBottom);

  if (shallowest === fromLeft) {
    body.x -= fromLeft;
    body.vx = -Math.abs(body.vx);
  } else if (shallowest === fromRight) {
    body.x += fromRight;
    body.vx = Math.abs(body.vx);
  } else if (shallowest === fromTop) {
    body.y -= fromTop;
    body.vy = -Math.abs(body.vy);
  } else {
    body.y += fromBottom;
    body.vy = Math.abs(body.vy);
  }
  return true;
}

/** Returns true when the body hit an edge. */
function bounceOffWalls(body: Body, width: number, height: number): boolean {
  const { vx, vy } = body;
  if (body.x < 0) {
    body.x = 0;
    body.vx = Math.abs(body.vx);
  } else if (body.x + body.width > width) {
    body.x = width - body.width;
    body.vx = -Math.abs(body.vx);
  }
  if (body.y < 0) {
    body.y = 0;
    body.vy = Math.abs(body.vy);
  } else if (body.y + body.height > height) {
    body.y = height - body.height;
    body.vy = -Math.abs(body.vy);
  }
  return body.vx !== vx || body.vy !== vy;
}

/**
 * DVD-style screen saver: the photos bounce off the screen edges and off the QR code (`obstacleRef`),
 * changing border color and switching to another random photo on every bounce.
 * Positions live in refs and are written straight to `transform`, so animating never re-renders React.
 */
export function BouncingSavers({ obstacleRef }: { obstacleRef: RefObject<HTMLElement | null> }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const saverRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    const elements = saverRefs.current.filter((element): element is HTMLDivElement => element !== null);
    const images = elements.map((element) => element.querySelector("img"));
    if (!container || elements.length === 0) {
      return;
    }
    // Load every photo up front so a swap on bounce shows the new one immediately.
    SCREEN_SAVER_PHOTOS.forEach((photo) => {
      new Image().src = photo.src;
    });

    let bounds = container.getBoundingClientRect();
    let obstacle: Box | null = null;
    // Spread out across the screen, each heading a different way.
    const bodies: Body[] = elements.map((element, index) => {
      const width = element.offsetWidth;
      const height = element.offsetHeight;
      const speed = bounds.width * SCREEN_SAVER_SPEED;
      const start = SAVER_STARTS[index % SAVER_STARTS.length];
      return {
        x: bounds.width * start.x,
        y: bounds.height * start.y,
        vx: start.dx * speed,
        vy: start.dy * speed * 0.8,
        width,
        height,
        borderColor: pickBorderColor(),
        photoIndex: index,
        bounces: 0,
      };
    });
    elements.forEach((element, index) => element.style.setProperty(BORDER_COLOR_VAR, bodies[index].borderColor));

    const measure = () => {
      bounds = container.getBoundingClientRect();
      const obstacleRect = obstacleRef.current?.getBoundingClientRect();
      obstacle = obstacleRect
        ? {
            left: obstacleRect.left - bounds.left,
            top: obstacleRect.top - bounds.top,
            right: obstacleRect.right - bounds.left,
            bottom: obstacleRect.bottom - bounds.top,
          }
        : null;
      const speed = bounds.width * SCREEN_SAVER_SPEED;
      bodies.forEach((body, index) => {
        body.width = elements[index].offsetWidth;
        body.height = elements[index].offsetHeight;
        body.vx = Math.sign(body.vx) * speed;
        body.vy = Math.sign(body.vy) * speed * 0.8;
      });
    };
    measure();

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(container);
    if (obstacleRef.current) {
      resizeObserver.observe(obstacleRef.current);
    }

    // Shows another photo in place: the card keeps its centre and takes the new photo's shape,
    // then gets nudged back inside the screen and off the QR code if the new shape overlaps them.
    const swapPhoto = (index: number) => {
      const body = bodies[index];
      const photoIndex = pickPhoto(bodies.map((other) => other.photoIndex));
      const photo = SCREEN_SAVER_PHOTOS[photoIndex];
      const centerX = body.x + body.width / 2;
      const centerY = body.y + body.height / 2;

      elements[index].style.aspectRatio = String(photo.aspectRatio);
      elements[index].style.height = saverHeight(photo);
      images[index]?.setAttribute("src", photo.src);
      body.photoIndex = photoIndex;
      body.width = elements[index].offsetWidth;
      body.height = elements[index].offsetHeight;
      body.x = centerX - body.width / 2;
      body.y = centerY - body.height / 2;
      bounceOffWalls(body, bounds.width, bounds.height);
      if (obstacle) {
        bounceOffObstacle(body, obstacle);
      }
    };

    let frameId = 0;
    let lastTime = performance.now();
    const step = (time: number) => {
      const seconds = Math.min((time - lastTime) / 1000, MAX_FRAME_SECONDS);
      lastTime = time;
      bodies.forEach((body, index) => {
        body.x += body.vx * seconds;
        body.y += body.vy * seconds;
        const hitWall = bounceOffWalls(body, bounds.width, bounds.height);
        const hitObstacle = obstacle ? bounceOffObstacle(body, obstacle) : false;
        if (hitWall || hitObstacle) {
          body.borderColor = pickBorderColor(body.borderColor);
          elements[index].style.setProperty(BORDER_COLOR_VAR, body.borderColor);
          body.bounces += 1;
          if (body.bounces >= SCREEN_SAVER_BOUNCES_PER_PHOTO) {
            body.bounces = 0;
            swapPhoto(index);
          }
        }
        elements[index].style.transform = `translate3d(${body.x}px, ${body.y}px, 0)`;
        elements[index].style.visibility = "visible";
      });
      frameId = requestAnimationFrame(step);
    };
    frameId = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
    };
  }, [obstacleRef]);

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden" aria-hidden>
      {SCREEN_SAVER_PHOTOS.slice(0, SCREEN_SAVERS_ON_SCREEN).map((photo, index) => (
        <div
          key={index}
          ref={(element) => {
            saverRefs.current[index] = element;
          }}
          // Sized by height (see saverHeight) so every photo of the couple reads at the same scale.
          style={{ aspectRatio: photo.aspectRatio, height: saverHeight(photo) }}
          // Invisible until the first frame places it, so it never flashes in the top-left corner.
          className="invisible absolute top-0 left-0 will-change-transform"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- static event photos; no resizing service on Workers */}
          <img src={photo.src} alt="" style={{ filter: OUTLINE_FILTER }} className="h-full w-full object-contain" />
        </div>
      ))}
    </div>
  );
}
