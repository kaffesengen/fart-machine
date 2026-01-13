// service-worker.js
// Enkel app-shell caching for mer stabil "install" og offline UI.
// NB: PeerJS og eksterne lydfiler krever nett.

const CACHE_NAME = "promp-remote-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-192-maskable.png",
  "./icon-512-maskable.png"
];

// Installer: legg app-shell i cache
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Aktiver: rydd gamle cacher
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch:
// - App-shell: cache-first
// - Andre GET-requests: network-first med cache fallback
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Bare GET
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Ikke prøv å cache cross-origin (PeerJS CDN/lydfiler) her
  if (url.origin !== self.location.origin) return;

  // Cache-first for app-shell-filer
  if (APP_SHELL.includes(url.pathname) || APP_SHELL.includes("." + url.pathname)) {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req))
    );
    return;
  }

  // Network-first for resten (så du får oppdateringer når du er online)
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req))
  );
});
