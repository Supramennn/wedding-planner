import { FIREBASE_PUBLIC_CONFIG, FIREBASE_VAPID_KEY } from "@/lib/firebase";

/**
 * Service worker WedPlan (FR-21 + Fase 2 FCM) — disajikan via route handler
 * karena konfigurasi Firebase (public) harus DI-INJECT ke dalam file statis:
 * file di public/ tidak bisa membaca env.
 *
 * Fitur:
 *  - PWA offline (network-first navigasi, cache-first aset statis), dan
 *  - FCM background message (importScripts compat bundle) untuk pengingat
 *    deadline — maka VERSION dibump tiap perubahan.
 *
 * Prod: Browser fetch /sw.js → Next men-generate kode SW + config di sini.
 */
export const dynamic = "force-dynamic";

const swSource = `
/**
 * Service worker WedPlan (FR-21 + pengingat FCM Fase 2).
 * FIle ini digenerate oleh app/sw.js/route.ts — konfigurasi Firebase
 * di-inject dari environment server saat request.
 *
 * Strategi:
 * - Navigasi: network-first -> fallback cache -> halaman /offline
 * - /_next/static/*: cache-first (aset immutable, nama ber-hash)
 * - Lainnya (same-origin GET): stale-while-revalidate
 * - Cross-origin (Firebase/API): lewatkan ke jaringan
 *
 * Ganti VERSION setelah mengubah file ini agar SW lama langsung dibersihkan.
 */
var VERSION = "v2";
var CACHE_NAME = "wedplan-" + VERSION;
var OFFLINE_URL = "/offline";

var PRECACHE_URLS = [
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

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(function (cache) {
        return Promise.all(
          PRECACHE_URLS.map(function (url) {
            return cache.add(url).catch(function () {});
          })
        );
      })
      .then(function () {
        return self.skipWaiting();
      })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys
            .filter(function (key) {
              return key !== CACHE_NAME;
            })
            .map(function (key) {
              return caches.delete(key);
            })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

function isStaticAsset(pathname) {
  return pathname.indexOf("/_next/static/") === 0;
}

self.addEventListener("fetch", function (event) {
  var request = event.request;
  if (request.method !== "GET") return;

  var url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(function (response) {
          if (response && response.ok) {
            var copy = response.clone();
            caches.open(CACHE_NAME).then(function (cache) {
              return cache.put(request, copy);
            });
          }
          return response;
        })
        .catch(function () {
          return caches.match(request).then(function (cached) {
            if (cached) return cached;
            return caches.match(OFFLINE_URL).then(function (offline) {
              return offline || Response.error();
            });
          });
        })
    );
    return;
  }

  if (isStaticAsset(url.pathname)) {
    event.respondWith(
      caches.match(request).then(function (cached) {
        if (cached) return cached;
        return fetch(request).then(function (response) {
          if (response && response.ok) {
            var copy = response.clone();
            caches.open(CACHE_NAME).then(function (cache) {
              return cache.put(request, copy);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(function (cached) {
      var network = fetch(request)
        .then(function (response) {
          if (response && response.ok) {
            var copy = response.clone();
            caches.open(CACHE_NAME).then(function (cache) {
              return cache.put(request, copy);
            });
          }
          return response;
        })
        .catch(function () {
          return cached;
        });
      return cached || network;
    })
  );
});

/* -------- FCM (pengingat deadline, Fase 2) -------- */
importScripts("https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js");

firebase.initializeApp(__FIREBASE_CONFIG__);

var messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
  var data = payload.data || {};
  var notification = payload.notification || {};
  var title = data.title || notification.title || "WedPlan";
  var body = data.body || notification.body || "Ada pembaruan rencana pernikahanmu.";
  var clickTarget = data.clickTarget || "/dashboard";

  var options = {
    body: body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { clickTarget: clickTarget },
  };
  return self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var url =
    (event.notification.data && event.notification.data.clickTarget) ||
    "/dashboard";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(function (clients) {
        for (var i = 0; i < clients.length; i += 1) {
          var client = clients[i];
          if ("navigate" in client) {
            return client.navigate(url).then(function () {
              return client.focus();
            });
          }
        }
        return self.clients.openWindow(url);
      })
  );
});
`;

export function GET() {
  const config = JSON.stringify({
    ...FIREBASE_PUBLIC_CONFIG,
    vapidKey: FIREBASE_VAPID_KEY,
  });

  return new Response(swSource.replace("__FIREBASE_CONFIG__", config), {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      // Cache-Control dikelola next.config.ts (/sw.js: must-revalidate).
    },
  });
}