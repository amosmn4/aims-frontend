const CACHE_VERSION = "aims-v1";
const PRECACHE_URLS = ["/manifest.webmanifest", "/favicon.ico", "/amsol-logo.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

// Deliberately a pass-through, not an offline-cache strategy: every page here is server-rendered
// and data-driven (TanStack Start SSR + live API calls), so caching them would risk serving a
// stale dashboard/report as if it were current. A registered `fetch` handler is what actually
// matters for installability (Chrome/Android's "Add to Home Screen" criteria) — the handful of
// static files above are the one thing genuinely safe to serve from cache first.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
