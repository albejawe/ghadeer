const CACHE_NAME = "ghadeer-sales-v8";
const STATIC_ASSETS = ["/manifest.webmanifest", "/icon.svg", "/icon-maskable.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (
    request.method !== "GET" ||
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/@") ||
    url.pathname.startsWith("/src/") ||
    url.pathname.includes("vite") ||
    url.pathname.startsWith("/__manus__/")
  )
    return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok)
            void caches
              .open(CACHE_NAME)
              .then((cache) => cache.put("/delegates", response.clone()));
          return response;
        })
        .catch(() =>
          caches
            .match("/delegates")
            .then((cached) => cached || caches.match("/"))
        )
    );
    return;
  }

  if (["style", "script", "font", "image"].includes(request.destination)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok)
              void caches
                .open(CACHE_NAME)
                .then((cache) => cache.put(request, response.clone()));
            return response;
          })
      )
    );
  }
});

self.addEventListener("push", (event) => {
  let data = {
    title: "مبيعات جديدة — غدير",
    body: "تمت إضافة مبيعات جديدة.",
    url: "/delegates",
    tag: "ghadeer-sale",
    badge: 0,
  };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    if (event.data) data.body = event.data.text();
  }
  const options = {
    body: data.body,
    icon: "/icon.svg",
    badge: "/icon.svg",
    tag: data.tag,
    renotify: true,
    vibrate: [180, 80, 180],
    data: { url: data.url },
    actions: [
      { action: "open", title: "عرض المبيعات" },
      { action: "close", title: "إغلاق" },
    ],
  };
  const tasks = [self.registration.showNotification(data.title, options)];
  if (data.badge && self.navigator?.setAppBadge)
    tasks.push(self.navigator.setAppBadge(data.badge));
  event.waitUntil(Promise.all(tasks));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "close") return;
  const url = event.notification.data?.url || "/delegates";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ("focus" in client) {
            if ("navigate" in client) void client.navigate(url);
            return client.focus();
          }
        }
        return self.clients.openWindow(url);
      })
  );
});