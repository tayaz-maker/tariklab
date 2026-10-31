/* Çete Savaşları — kalıcı çevrimdışı.
 * İlk online ziyarette kabuk + asset cache'lenir. Sonra uçak modu çalışır.
 */
const CACHE = "cete-offline-v8";
const BUILD_ASSETS = /* TARIKLAB_BUILD_ASSETS */ [];
const SHELL = ["/", "/cete-savaslari", "/favicon.svg", "/manifest.webmanifest", "/i18n/tlab-i18n.js", "/i18n/deep-en.js", "/i18n/deep-en-final.js", "/i18n/boot.js", "/credits.html"].concat(BUILD_ASSETS);

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
      for (const key of keys.filter((key) => key.startsWith("cete-offline-"))) {
        const cache = await caches.open(key);
        for (const request of await cache.keys()) {
          const url = new URL(request.url);
          if (url.origin === self.location.origin && isRetiredJitem(url)) await cache.delete(request);
        }
      }
      await self.clients.claim();
    })(),
  );
});

function isRetiredJitem(url) {
  const archived = ["tc-sim-devlet", "kayip-telefon", "son-100-gun", "veto-h", "gett-oh", "satranc", "amiral-batti", "peg-solitaire", "labirent"];
  if (archived.some(slug => url.pathname === `/oyna/${slug}` || url.pathname === `/oyna/${slug}/` || url.pathname === `/games/${slug}` || url.pathname.startsWith(`/games/${slug}/`))) return true;
  return url.pathname === "/oyna/jitem-derin-ag" || url.pathname === "/oyna/jitem-derin-ag/" ||
    url.pathname === "/games/jitem-derin-ag" || url.pathname.startsWith("/games/jitem-derin-ag/");
}

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
  "/games/tc-sim-boardworld/",
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
  // Never revive the retired runtime or an old cached play wrapper, even offline.
  if (isRetiredJitem(url)) {
    event.respondWith(req.mode === "navigate"
      ? Response.redirect(new URL("/", self.location.origin).href, 302)
      : Promise.resolve(new Response("Bu oyun arşivlendi", {status: 410})));
    return;
  }
  // Retired products must not fall back to old runtime cache entries.
  if (url.pathname.startsWith("/games/darbe-h/") || url.pathname.startsWith("/atlas/")) {
    event.respondWith(Promise.resolve(new Response("Bu ürün kaldırıldı", {status: 410})));
    return;
  }

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

// A retained cache entry may have been written by an older worker before
// navigation responses were normalized. Preserve its payload and HTTP metadata,
// but do not return redirect history to a request with redirect mode "manual".
function navigationResponse(req, response) {
  if (req.mode !== "navigate" || !response.redirected) return response;
  return new Response(response.body, {
    status: response.status, statusText: response.statusText, headers: response.headers,
  });
}

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.ok) {
      const cached = navigationResponse(req, fresh.clone());
      // Cache persistence is optional; a full cache must not hide fresh HTML.
      await cache.put(req, cached).catch(() => undefined);
    }
    return fresh;
  } catch {
    const hit = await cache.match(req);
    if (hit) return navigationResponse(req, hit);
    if (req.mode === "navigate") {
      // Cloudflare canonicalizes game index.html URLs to their directory. Its
      // redirect may be followed outside this fetch handler, caching that URL.
      const canonical = new URL(req.url);
      if (canonical.pathname.startsWith("/games/") && canonical.pathname.endsWith("/index.html")) {
        canonical.pathname = canonical.pathname.slice(0, -"index.html".length);
        const game = await cache.match(canonical.href);
        if (game) return navigationResponse(req, game);
      }
      const home = await cache.match("/");
      if (home) return navigationResponse(req, home);
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
