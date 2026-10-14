/* Service worker Aircon — Web Push PWA (rute /t).
 * FASE 1: notifikasi penugasan teknisi/kernet.
 * Cakupan "/" — dikirim dari public/ (Next menyalin apa adanya).
 * Kontrak payload dari server (push-notification-service.ts):
 *   JSON { title: string, body: string, url: string, tag: string|null }
 */

self.addEventListener("install", (event) => {
  // SW baru → aktif saat tab berikutnya (tanpa skipWaiting paksa).
  self.skipWaiting();
  event.waitUntil(Promise.resolve());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload = {};
  try { payload = event.data.json(); } catch { payload = { title: "Tugas baru", body: event.data.text() ?? "" }; }
  const p = payload ?? {};
  const title = typeof p.title === "string" && p.title ? p.title : "Tugas baru";
  const body = typeof p.body === "string" ? p.body : "";
  const url = typeof p.url === "string" && p.url ? p.url : "/t";
  const tag = typeof p.tag === "string" && p.tag ? p.tag : "aircon-assignment";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  const url = event.notification?.data?.url || "/t";
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      // Buka tab yang SUDAH membuka aplikasi (bukan duplikat).
      for (const c of list) {
        if ("focus" in c) return c.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
