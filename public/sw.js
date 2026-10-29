/**
 * Service Worker PlayZone CRM.
 * Стратегия «сеть в приоритете, кэш как офлайн-фолбэк» для ВСЕХ GET-запросов,
 * включая /api/* — благодаря этому приложение работает без интернета:
 *  - последние данные кассы, устройств и сеансов видны офлайн;
 *  - таймеры тикают локально, сирена звучит локально;
 *  - вход остаётся сохранённым (/api/auth/me отдаётся из кэша).
 * POST/DELETE запросы не кэшируются — их ставит в очередь офлайн-модуль
 * (src/lib/offline.ts) и отправляет при появлении сети.
 */
const CACHE_NAME = "playzone-crm-v2";
const OFFLINE_URLS = ["/", "/manifest.json", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(OFFLINE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Кэшируем только GET-запросы к своему origin
  if (req.method !== "GET") return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;

  const isApi = url.pathname.startsWith("/api/");

  // Network-first: онлайн — свежий ответ (и обновление кэша),
  // офлайн — последний сохранённый вариант.
  event.respondWith(
    fetch(req)
      .then((res) => {
        // Кэшируем только успешные ответы (не 401/500),
        // чтобы не закэшировать «выход из аккаунта»
        if (res.ok) {
          const copy = res.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(req, copy))
            .catch(() => {});
        } else if (isApi && url.pathname === "/api/auth/me") {
          // Пользователь разлогинился — убираем устаревшее «я вошёл» из кэша
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.delete(req))
            .catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches
          .match(req)
          .then((cached) => cached || (isApi ? undefined : caches.match("/")))
          .then((fallback) => fallback || Response.error())
      )
  );
});

// ---- Push-уведомления «время вышло» (Web Push / VAPID) ----
// Приходят с сервера, когда приложение свёрнуто или закрыто. Если окно CRM
// сейчас видно — вместо системного уведомления будим приложение (сирену
// включит AlarmCenter), чтобы не дублировать сигнал.

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "PlayZone CRM", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "PlayZone CRM";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.tag || "playzone",
    renotify: true, // звенеть заново, даже если уведомление с таким tag уже висит
    vibrate: [500, 200, 500],
    requireInteraction: true,
    data: { url: data.url || "/", type: data.tag || "playzone" },
  };

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const visible = clientList.find((c) => c.visibilityState === "visible");
      if (visible) {
        // Приложение на экране — системное уведомление не нужно
        visible.postMessage({ type: "push-overdue", payload: data });
        return;
      }
      await self.registration.showNotification(title, options);
    })()
  );
});

// Клик по системному уведомлению: открыть/поднять приложение CRM
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of clientList) {
        if ("focus" in client) {
          await client.focus();
          client.postMessage({ type: "push-open", url });
          return;
        }
      }
      await self.clients.openWindow(url);
    })()
  );
});
