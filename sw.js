// NUZU News Service Worker v2.0
// Handles offline, caching, background sync, and push notifications

const CACHE_NAME = 'nuzu-v4';
const STATIC_CACHE = 'nuzu-static-v4';
const OFFLINE_URL = '/NUZU/offline.html';

const PRECACHE_URLS = [
  '/NUZU/',
  '/NUZU/index.html',
  '/NUZU/offline.html',
  '/NUZU/manifest.json',
  '/NUZU/icons/icon-192.png',
  '/NUZU/icons/icon-512.png',
];

// Install — precache shell assets
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      return cache.addAll(PRECACHE_URLS).catch(err => {
        console.warn('[NUZU SW] Precache partial failure:', err);
      });
    })
  );
});

// Activate — clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== STATIC_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch — network-first for HTML, cache-first for assets
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Skip cross-origin except YouTube (for video embeds)
  if (url.origin !== location.origin &&
      !url.hostname.includes('youtube.com') &&
      !url.hostname.includes('ytimg.com')) {
    return;
  }

  // For HTML pages: network-first, fall back to cache, then offline page
  if (event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' })
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(event.request)
            .then(cached => cached || caches.match(OFFLINE_URL))
        )
    );
    return;
  }

  // For feed.json: network-first with short timeout
  if (url.pathname.endsWith('feed.json')) {
    event.respondWith(
      Promise.race([
        fetch(event.request, { cache: 'no-cache' }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
      ])
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // For static assets (icons, images): cache-first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then(c => c.put(event.request, clone));
        }
        return response;
      }).catch(() => cached || new Response('', { status: 404 }));
    })
  );
});

// Push notifications
self.addEventListener('push', event => {
  let data = { title: 'NUZU Breaking News', body: 'New headlines available', url: '/NUZU/' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (e) {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/NUZU/icons/icon-192.png',
      badge: '/NUZU/icons/icon-96.png',
      tag: 'nuzu-breaking',
      renotify: true,
      requireInteraction: false,
      data: { url: data.url },
      actions: [
        { action: 'open', title: 'Read Now' },
        { action: 'dismiss', title: 'Dismiss' }
      ]
    })
  );
});

// Notification click
self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const url = event.notification.data?.url || '/NUZU/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        for (const client of clientList) {
          if (client.url.includes('/NUZU/') && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) return clients.openWindow(url);
      })
  );
});

// Background sync — refresh headlines
self.addEventListener('periodicsync', event => {
  if (event.tag === 'nuzu-headlines-refresh') {
    event.waitUntil(
      fetch('/NUZU/feed.json?sw=1&_=' + Date.now())
        .then(r => r.json())
        .then(data => {
          // Notify open clients of new content
          return self.clients.matchAll({ type: 'window' }).then(clients => {
            clients.forEach(client => client.postMessage({ type: 'NUZU_UPDATE', updated: data.updated }));
          });
        })
        .catch(() => {})
    );
  }
});

// Message from page — skip waiting
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
