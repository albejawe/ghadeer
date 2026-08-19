const CACHE_NAME = 'hisabati-ghadeer-v4';
const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/delegates',
  '/manifest.webmanifest',
  '/icon.svg',
  '/icon-maskable.svg'
];

// Install: Cache essential shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Caching non-critical asset failure:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate: Clean up older cache versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Cache-first for styles, scripts, fonts; Network-first for dynamic navigation
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Exclude API requests, dev server scripts, and live assets
  if (
    request.method !== 'GET' ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.includes('vite') ||
    url.pathname.includes('hot-update') ||
    url.pathname.startsWith('/__manus__/')
  ) {
    return;
  }

  // Static assets (CSS, JS, Fonts, Images)
  if (
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'font' ||
    request.destination === 'image'
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        }).catch(() => cached);
      })
    );
    return;
  }

  // HTML / Page Navigation
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match('/dashboard') || caches.match('/');
      })
    );
  }
});

// =============================================================================
// Push & Local Notification Event Handlers
// =============================================================================

// Push Event (from Web Push servers if configured)
self.addEventListener('push', (event) => {
  let data = {
    title: 'تنبيه استحقاق سداد — حساباتي',
    body: 'توجد فواتير مستحقة الدفع تتطلب المتابعة والتحصيل.',
    url: '/dashboard?filter=due',
    tag: 'due-debt-alert'
  };

  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch (e) {
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/icon.svg',
    badge: '/icon.svg',
    tag: data.tag || 'hisabati-notification',
    renotify: true,
    vibrate: [200, 100, 200, 100, 200],
    data: {
      url: data.url || '/dashboard?filter=due'
    },
    actions: [
      { action: 'open', title: 'عرض الفواتير المستحقة' },
      { action: 'close', title: 'إغلاق' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification Click Handler: Focus or open the app window
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const targetUrl = (event.notification.data && event.notification.data.url) || '/dashboard?filter=due';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it and navigate
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) {
            return client.navigate(targetUrl);
          }
          return client;
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Message Listener from Client Window
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, tag, url, remaining, warehouse } = event.data.payload || {};
    const options = {
      body: body || 'تنبيه استحقاق جديد',
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: tag || `due-${Date.now()}`,
      renotify: true,
      vibrate: [200, 100, 200, 100, 200],
      data: {
        url: url || '/dashboard?filter=due',
        warehouse,
        remaining
      },
      actions: [
        { action: 'open', title: 'عرض الفاتورة' },
        { action: 'close', title: 'تم الاطلاع' }
      ]
    };

    self.registration.showNotification(title || '⚠️ تنبيه استحقاق دين', options);
  }
});
