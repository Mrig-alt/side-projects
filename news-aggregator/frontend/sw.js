/* ================================================================
   Service Worker — Personal Intelligence Feed
   Handles Web Push notifications so alerts arrive even when the
   tab or browser is closed (requires push subscription in app.js).
   ================================================================ */

const ICON = "/icon.svg";

// ── Install / Activate ──────────────────────────────────────────
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// ── Push: show OS notification ──────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { headline: event.data.text(), reason: "", severity: "medium" };
  }

  const isHigh = data.severity === "high";
  const title = isHigh ? "⚡ Breaking Alert — Intel Feed" : "📍 Intel Feed";

  const options = {
    body: data.reason
      ? `${data.headline}\n${data.reason}`
      : data.headline,
    icon: ICON,
    badge: ICON,
    tag: data.id || "intel-alert",          // replaces older same-tag notif
    renotify: true,                          // vibrate even if same tag
    data: { url: data.url || "/", article_id: data.article_id || null },
    vibrate: isHigh ? [300, 100, 300, 100, 300] : [200, 100, 200],
    requireInteraction: isHigh,              // high alerts stay until dismissed
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification click: open or focus app ──────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Focus an already-open tab if possible
        for (const client of clientList) {
          if (new URL(client.url).pathname === "/" && "focus" in client) {
            return client.focus();
          }
        }
        // Otherwise open a new tab
        if (clients.openWindow) return clients.openWindow(targetUrl);
      })
  );
});
