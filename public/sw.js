/**
 * Dr Non's City Hub — service worker.
 *
 * Strategy:
 *   - App shell (index.html, JS, CSS): cache-first with background refresh,
 *     so the dashboard opens instantly even when offline. Stale shell still
 *     works because the data layers tolerate offline (cachedFetch falls
 *     back to last-known values).
 *   - Map tiles + API JSON: network-first, fall back to cache if offline.
 *
 * The cache name is versioned — bumping it on each deploy forces a fresh
 * shell on the next visit.
 */
const VERSION = 'v16-2026-06-01'
const SHELL_CACHE = `shell-${VERSION}`
const RUNTIME_CACHE = `runtime-${VERSION}`

const SHELL_URLS = ['/', '/index.html', '/manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_URLS)).catch(() => {}),
  )
  self.skipWaiting()
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

  // App shell — cache-first
  if (url.origin === self.location.origin &&
      (url.pathname === '/' || url.pathname.endsWith('.html') ||
       url.pathname.endsWith('.js') || url.pathname.endsWith('.css') ||
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
