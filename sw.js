// NUZU News Service Worker v1.0
// Provides: offline shell, feed caching, background sync, update notifications

const CACHE_NAME = 'nuzu-v1';
const FEED_CACHE = 'nuzu-feed-v1';
const VERSION_URL = '/TheMitchellPost/version.json';
const FEED_URL = '/TheMitchellPost/feed.json';

// Shell assets to cache on install (app skeleton)
const SHELL_ASSETS = [
  '/TheMitchellPost/',
  '/TheMitchellPost/index.html',
  '/TheMitchellPost/manifest.json',
  '/TheMitchellPost/icons/icon-192.png',
  '/TheMitchellPost/icons/icon-512.png',
  '/TheMitchellPost/offline.html',
];

// ── INSTALL: cache shell ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cache what we can, don't fail install if some assets are missing
      return Promise.allSettled(
        SHELL_ASSETS.map(url =>
          cache.add(url).catch(e => console.warn('SW: could not cache', url, e))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: clean old caches ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME && k !== FEED_CACHE)
            .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: network-first for feed/index, cache-first for assets ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET and cross-origin YouTube/Google requests
  if (event.request.method !== 'GET') return;
  if (url.hostname.includes('youtube.com') ||
      url.hostname.includes('google.com') ||
      url.hostname.includes('googleapis.com')) return;

  // Feed JSON: network first, fallback to cache
  if (url.pathname.includes('feed.json')) {
    event.respondWith(networkFirstFeed(event.request));
    return;
  }

  // Main index: network first with offline fallback
  if (url.pathname === '/TheMitchellPost/' ||
      url.pathname === '/TheMitchellPost/index.html') {
    event.respondWith(networkFirstPage(event.request));
    return;
  }

  // Icons and static assets: cache first
  if (url.pathname.includes('/icons/') ||
      url.pathname.includes('.png') ||
      url.pathname.includes('.ico') ||
      url.pathname.includes('.json')) {
    event.respondWith(cacheFirstAsset(event.request));
    return;
  }

  // Everything else: network with cache fallback
  event.respondWith(networkFirstPage(event.request));
});

async function networkFirstFeed(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(FEED_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    const cached = await caches.match(request);
    return cached || new Response(JSON.stringify({error:'offline',items:[]}),
      {headers:{'Content-Type':'application/json'}});
  }
}

async function networkFirstPage(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    const cached = await caches.match(request);
    if (cached) return cached;
    const offlinePage = await caches.match('/TheMitchellPost/offline.html');
    return offlinePage || new Response('<h1>NUZU - You are offline</h1>', {
      headers: {'Content-Type': 'text/html'}
    });
  }
}

async function cacheFirstAsset(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    return new Response('', {status: 404});
  }
}

// ── BACKGROUND SYNC: check for new content ──
self.addEventListener('periodicsync', event => {
  if (event.tag === 'nuzu-feed-sync') {
    event.waitUntil(syncFeed());
  }
});

async function syncFeed() {
  try {
    const response = await fetch(FEED_URL);
    if (response.ok) {
      const cache = await caches.open(FEED_CACHE);
      await cache.put(FEED_URL, response);
      // Notify all open clients
      const clients = await self.clients.matchAll({type: 'window'});
      clients.forEach(client => client.postMessage({type: 'FEED_UPDATED'}));
    }
  } catch (e) {}
}

// ── PUSH NOTIFICATIONS (future use) ──
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'NUZU Breaking News', {
      body: data.body || '',
      icon: '/TheMitchellPost/icons/icon-192.png',
      badge: '/TheMitchellPost/icons/icon-96.png',
      tag: 'nuzu-breaking',
      renotify: true,
      data: { url: data.url || '/TheMitchellPost/' }
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/TheMitchellPost/')
  );
});
