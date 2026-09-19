/* Çete Savaşları — kalıcı çevrimdışı.
 * İlk online ziyarette kabuk + asset cache'lenir. Sonra uçak modu çalışır.
 */
const CACHE = "cete-offline-v4";
const BUILD_ASSETS = /* TARIKLAB_BUILD_ASSETS */ [];
const SHELL = ["/", "/cete-savaslari", "/favicon.svg", "/__grok/icon-180.png", "/manifest.webmanifest", "/i18n/tlab-i18n.js", "/i18n/deep-en.js", "/i18n/deep-en-final.js", "/i18n/boot.js", "/credits.html"].concat(BUILD_ASSETS);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("cete-offline-") && k !== CACHE)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

function bypass(url) {
  const p = url.pathname;
  if (p.startsWith("/api/")) return true;
  if (p.startsWith("/__app-env")) return true;
  if (p.startsWith("/auth/")) return true;
  return false;
}

function isAsset(url) {
  if (url.pathname.startsWith("/assets/")) return true;
  return /\.(?:js|css|png|jpe?g|svg|webp|woff2?|ico|webmanifest|gif)(?:$|\?)/.test(
    url.pathname,
  );
}

// Native ES module graph'lari: bir modulu eski cache'ten dondurmek, farkli
// deploy'lardan gelen parcalari karistirip render edilmis kontrolleri
// dinleyicisiz birakabiliyor. Bu oyunlar bu yuzden online'da tek tutarli
// deploy'dan yuklenir; cache yalniz cevrimdisi yedegidir.
const MODULE_GAME_PATHS = [
  "/games/duel-core/",
  "/games/veto-h/",
  "/games/gett-oh/",
  "/games/tc-sim/",
  "/games/labirent/",
  "/games/peg-solitaire/",
  "/games/satranc/",
  "/games/amiral-batti/",
  "/games/next-wave.js",
  "/games/next-wave/",
  "/games/shared/",
  "/games/apartman/",
  "/games/son-100-gun/",
  "/games/kayip-telefon/",
  "/games/tc-sim-devlet/",
  "/games/son-kasaba/",
  "/games/ihtilal/",
  "/games/hanedanian/",
  "/games/darbe-h/",
  "/i18n/",
];

function isModuleGameAsset(url) {
  return MODULE_GAME_PATHS.some((prefix) => url.pathname.startsWith(prefix));
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (bypass(url)) return;

  if (req.mode === "navigate") {
    event.respondWith(networkFirst(req));
    return;
  }
  if (isModuleGameAsset(url)) {
    event.respondWith(networkFirst(req));
    return;
  }
  if (isAsset(url)) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }
  event.respondWith(networkFirst(req));
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  } catch {
    const hit = await cache.match(req);
    if (hit) return hit;
    if (req.mode === "navigate") {
      const home = await cache.match("/");
      if (home) return home;
    }
    return new Response("Çevrimdışı", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  const fetching = fetch(req)
    .then((res) => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => hit);
  return hit || fetching;
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = "/cete-savaslari";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        for (const c of list) {
          if ("focus" in c) {
            c.focus();
            if ("navigate" in c) c.navigate(url);
            return;
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(url);
      }),
  );
});
