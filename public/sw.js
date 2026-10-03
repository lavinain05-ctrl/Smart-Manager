// Service Worker for D Block RWA Indraprastha PWA & High-Speed Launch Caching
const CACHE_NAME = 'rwa-app-v39';

const STATIC_PRECACHE = [
  '/',
  '/index.html',
  '/manifest.json?v=12',
  '/favicon.svg?v=12',
  '/icon-192.png?v=12',
  '/icon-512.png?v=12',
  '/apple-touch-icon.png?v=12',
  '/badge-96.png?v=12',
];

// Precache essential app shell on install
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_PRECACHE).catch((err) => {
        console.warn('[SW] Precache soft error:', err);
      });
    })
  );
});

// Purge obsolete caches on activation and claim all open clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Clearing outdated cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim()).then(() => {
      // Notify all open client tabs that a new bundle is active
      return self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'SW_UPDATED', version: CACHE_NAME });
        });
      });
    })
  );
});

// High-speed asset caching & offline fallback
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Bypass Firebase Auth, Firestore, Google Cloud APIs, and local server bridges
  if (
    url.hostname.includes('firebase') ||
    url.hostname.includes('firestore') ||
    url.hostname.includes('identitytoolkit') ||
    url.hostname.includes('securetoken') ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/__/auth')
  ) {
    return;
  }

  // 1. Navigation requests (HTML pages): Always fetch fresh from network so latest deployment is used
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(req, { cache: 'no-cache' });
          if (networkResponse && networkResponse.ok) {
            // Keep /index.html in cache strictly for offline fallback
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', clone));
            return networkResponse;
          }
        } catch {
          // Offline fallback
        }

        const cached = await caches.match('/index.html');
        if (cached) return cached;

        return new Response('Offline - D Block RWA', {
          headers: { 'Content-Type': 'text/plain' },
          status: 503,
        });
      })()
    );
    return;
  }

  // 2. Static bundled assets (/assets/*, fonts, icons, images)
  const isStaticAsset =
    url.origin === self.location.origin &&
    (url.pathname.startsWith('/assets/') ||
      /\.(js|css|svg|png|jpg|jpeg|webp|ico|woff2?|ttf|eot)$/i.test(url.pathname));

  const isFontAsset =
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com';

  if (isStaticAsset || isFontAsset) {
    event.respondWith(
      caches.match(req).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(req).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const contentType = networkResponse.headers.get('content-type') || '';
            // CRITICAL: If server returned HTML (SPA fallback for missing chunk), DO NOT cache it as a JS asset!
            const isJsAsset = url.pathname.endsWith('.js');
            if (isJsAsset && contentType.includes('text/html')) {
              console.warn('[SW] Rejected HTML fallback for missing JS chunk:', url.pathname);
              return new Response('/* Missing chunk - deployment updated */', {
                status: 404,
                statusText: 'Not Found',
                headers: { 'Content-Type': 'text/plain' },
              });
            }
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return networkResponse;
        }).catch(() => {
          return new Response('Network error loading resource', { status: 408 });
        });
      })
    );
    return;
  }
});

// Status bar notifications & push triggers
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    event.waitUntil(
      self.registration.showNotification(title, {
        icon: '/icon-192.png?v=10',
        badge: '/badge-96.png?v=10',
        vibrate: [100, 50, 100],
        ...options,
      })
    );
  }
});

self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { title: 'D Block RWA Indraprastha', message: event.data.text() };
    }
  }

  const title = data.title || 'D Block RWA Indraprastha';
  const options = {
    body: data.message || data.body || 'You have a new update.',
    icon: data.icon || '/icon-192.png?v=10',
    badge: data.badge || '/badge-96.png?v=10',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || data.link || '/',
    },
    tag: data.tag || undefined,
    renotify: !!data.renotify,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          client.focus();
          if ('navigate' in client) {
            client.navigate(targetUrl);
          }
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
