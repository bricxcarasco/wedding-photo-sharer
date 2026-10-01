/* Bricx & Hannah Wedding — Service Worker
 *
 * Scope of responsibility (intentionally small & honest):
 *  1. Cache the app shell so the site loads instantly and works offline-ish
 *     (the UI opens; uploads still need the network to actually reach Drive).
 *  2. Network-first for navigations (so new deploys show up), cache fallback.
 *  3. Cache-first for hashed static assets.
 *  4. Background Sync (ANDROID/Chromium ONLY) — when the OS fires a 'sync'
 *     event we simply wake any open client and tell it to resume its upload
 *     queue. We do NOT upload from the SW itself, because the file Blobs and
 *     the resumable-session state live in the page's IndexedDB-backed engine,
 *     and iOS Safari does not support Background Sync at all.
 *
 * This SW never claims a photo is uploaded. Only the server (/api/finalize)
 * confirms that, and only the page reflects it.
 */

const SHELL_CACHE = 'bh-shell-v1';
const ASSET_CACHE = 'bh-assets-v1';
const SHELL_URLS = ['/', '/manifest.webmanifest', '/icons/favicon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL_URLS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Never cache API or Drive calls — always live.
  if (url.pathname.startsWith('/api/')) return;

  // SPA navigations: network-first, fall back to cached shell when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put('/', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('/').then((r) => r || caches.match(req)))
    );
    return;
  }

  // Hashed build assets: cache-first (they are immutable).
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(ASSET_CACHE).then((c) => c.put(req, copy)).catch(() => {});
            return res;
          })
      )
    );
  }
});

// Android/Chromium progressive enhancement: nudge the page to resume uploads.
self.addEventListener('sync', (event) => {
  if (event.tag === 'bh-upload-resume') {
    event.waitUntil(notifyClientsToResume());
  }
});

async function notifyClientsToResume() {
  const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const client of all) {
    client.postMessage({ type: 'RESUME_UPLOADS' });
  }
  // If no page is open there is nothing we can do — the queue is safely
  // persisted and will resume when the guest reopens the site.
}
