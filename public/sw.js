// Service worker for venue screens (registered by /screen pages only).
// Goal: a screen that reloads while the venue Wi-Fi is down still shows its page (idle QR),
// instead of a browser error. It never caches API responses or guest photos (/media),
// so nothing personal is stored and deleted photos (PDPA) can't be served from here.

// Bump the version to drop every cached file on screens after a breaking change.
const CACHE_NAME = "camskynet-screen-v2";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

// Screen pages: try the network first, keep a copy, fall back to the copy when offline.
async function networkFirstScreenPage(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) {
      return cached;
    }
    throw error;
  }
}

// Next.js build assets have content hashes in their names, so a cached copy is always correct.
async function cacheFirstStaticAsset(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }
  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate" && url.pathname.startsWith("/screen/")) {
    event.respondWith(networkFirstScreenPage(request));
    return;
  }
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirstStaticAsset(request));
  }
});
