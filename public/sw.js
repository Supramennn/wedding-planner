/**
 * Service worker WedPlan (FR-21) — native (tanpa next-pwa, lihat README).
 *
 * Strategi:
 * - Navigasi: network-first → fallback cache → halaman /offline
 * - /_next/static/* : cache-first (aset immutable, nama file ber-hash)
 * - Lainnya (same-origin GET): stale-while-revalidate
 * - Cross-origin (Firebase/API): lewatkan ke jaringan, jangan di-cache
 *
 * Ganti VERSION setelah mengubah file ini agar SW lama langsung dibersihkan.
 */
const VERSION = "v2";
const CACHE_NAME = `wedplan-${VERSION}`;
const OFFLINE_URL = "/offline";

const PRECACHE_URLS = [
  "/",
  OFFLINE_URL,
  "/dashboard",
  "/onboarding",
  "/checklist",
  "/budget",
  "/vendors",
  "/settings",
  "/login",
  "/register",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        // addAll gagal total bila satu URL gagal — map dulu agar tahan satu URL error.
        Promise.all(
          PRECACHE_URLS.map((url) =>
            cache.add(url).catch(() => {
              /* URL belum tersedia saat install: lewati */
            })
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isStaticAsset(pathname) {
  // Chunk Next ber-hash: aman disimpan permanen selama cache aktif.
  return pathname.startsWith("/_next/static/");
}

// Push notification (Phase 2): klik notifikasi pengingat → fokuskan/pindahkan
// jendela PWA ke rute yang sesuai (data.url dari payload FCM).
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        const origin = self.location.origin;
        for (const client of windowClients) {
          if (client.url.startsWith(origin) && "focus" in client) {
            client.focus();
            // navigate tidak didukung Safari — fokus saja di sana.
            if (typeof client.navigate === "function") {
              client.navigate(target);
            }
            return undefined;
          }
        }
        return clients.openWindow(target);
      })
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Firebase Auth/Firestore/Storage (cross-origin) → jaringan saja.
  if (url.origin !== self.location.origin) return;

  // 1) Navigasi halaman: network-first + fallback offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const offline = await caches.match(OFFLINE_URL);
          return offline || Response.error();
        })
    );
    return;
  }

  // 2) Aset statis Next: cache-first.
  if (isStaticAsset(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        });
      })
    );
    return;
  }

  // 3) Sisanya (icon, /_next/image, dll): stale-while-revalidate.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
