// Service Worker for Smart Manager RWA PWA & Web Push Notifications
const CACHE_NAME = 'smart-manager-v5';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Listen for message from main app to show notification
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    event.waitUntil(
      self.registration.showNotification(title, {
        icon: '/icon-192.png',
        badge: '/badge-96.png',
        vibrate: [100, 50, 100],
        ...options,
      })
    );
  }
});

// Handle push events (for future server Web Push triggers)
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
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/badge-96.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || data.link || '/',
    },
    tag: data.tag || undefined,
    renotify: !!data.renotify,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Handle notification click in phone notification bar
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a tab is already open, focus it and navigate
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          client.focus();
          if ('navigate' in client) {
            client.navigate(targetUrl);
          }
          return;
        }
      }
      // If no tab is open, open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
