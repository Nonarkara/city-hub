/**
 * Dr Non's City Hub — service worker.
 *
 * Strategy:
 *   - HTML navigation (index.html): network-first with cache fallback, so a
 *     fresh deploy always wins and users never get stuck on a stale shell
 *     ('Failed to fetch dynamically imported module'). Offline still works
 *     via the cached fallback.
 *   - Static assets (JS, CSS, SVG, manifest): cache-first with background
 *     refresh — Vite content-hashes these, so staleness is harmless.
 *   - Map tiles + API JSON: network-first, fall back to cache if offline.
 *
 * The cache name is versioned — bumping it on each deploy forces a fresh
 * shell on the next visit.
 *
 * Race-condition fix (was causing "SYSTEM ERROR" on first deploy load):
 *   skipWaiting() is now chained AFTER cache.addAll() succeeds, not fired
 *   unconditionally alongside it. This prevents the SW from activating and
 *   calling clients.claim() while the cache is still empty — which caused
 *   in-flight lazy-chunk requests to be intercepted mid-React-boot and
 *   returned from an empty cache as opaque errors.
 */
const VERSION = 'v23-2026-06-01'
const SHELL_CACHE = `shell-${VERSION}`
const RUNTIME_CACHE = `runtime-${VERSION}`

const SHELL_URLS = ['/', '/index.html', '/manifest.webmanifest']

self.addEventListener('install', (event) => {
  // Wait until shell is cached, THEN skip waiting.
  // If caching fails (e.g. offline install), still skip — the network fallback
  // in fetch handler covers the miss.
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((n) => n !== SHELL_CACHE && n !== RUNTIME_CACHE)
          .map((n) => caches.delete(n)),
      ),
    ).then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)

  // HTML navigation — network-first so a new deploy always wins; fall back
  // to the cached shell only when offline. This is the durable fix for stale
  // shells ('Failed to fetch dynamically imported module') — no hand-bumped
  // VERSION needed for HTML freshness.
  if (url.origin === self.location.origin &&
      (url.pathname === '/' || url.pathname.endsWith('.html'))) {
    event.respondWith(
      fetch(req).then((fresh) => {
        if (fresh.ok) caches.open(SHELL_CACHE).then((c) => c.put(req, fresh.clone()))
        return fresh
      }).catch(() =>
        caches.match(req).then((c) => c ?? Response.error()),
      ),
    )
    return
  }

  // Static assets — cache-first (content-hashed by Vite, staleness harmless)
  if (url.origin === self.location.origin &&
      (url.pathname.endsWith('.js') || url.pathname.endsWith('.css') ||
       url.pathname.endsWith('.svg') || url.pathname === '/manifest.webmanifest')) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) {
          // Background refresh
          fetch(req).then((fresh) => {
            if (fresh.ok) caches.open(SHELL_CACHE).then((c) => c.put(req, fresh.clone()))
          }).catch(() => {})
          return cached
        }
        return fetch(req).then((fresh) => {
          if (fresh.ok) caches.open(SHELL_CACHE).then((c) => c.put(req, fresh.clone()))
          return fresh
        })
      }),
    )
    return
  }

  // Map tiles / API — network-first
  if (url.hostname.includes('tiles') ||
      url.hostname.includes('arcgisonline') ||
      url.hostname.includes('eox.at') ||
      url.hostname.includes('gibs.earthdata') ||
      url.hostname.includes('longdo')) {
    event.respondWith(
      fetch(req).then((fresh) => {
        if (fresh.ok) caches.open(RUNTIME_CACHE).then((c) => c.put(req, fresh.clone()))
        return fresh
      }).catch(() => caches.match(req).then((c) => c ?? Response.error())),
    )
  }
})
