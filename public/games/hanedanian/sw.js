/* A complete standalone game version installs together. Failed installs retain
 * the previous working package; running sessions don't mix lazy module versions. */
const VERSION = /* HANEDANIAN_BUILD_VERSION */ "hanedanian-package-dev-1";
const ROOT = "/games/hanedanian/";
const FILES = [
  "index.html",
  "style.css",
  "app.js",
  "data.js",
  "world.js",
  "engine.js",
  "campaign.js",
  "map.js",
  "save.js",
  "icon.svg",
  "manifest.webmanifest",
].map((p) => ROOT + p);
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const responses = await Promise.all(
        FILES.map(async (path) => {
          const response = await fetch(new Request(path, { cache: "reload" }));
          if (!response.ok) throw new Error(`Game package incomplete: ${path}`);
          const contentType = response.headers.get("content-type") || "";
          const expected = path.endsWith(".js")
            ? /javascript/
            : path.endsWith(".css")
              ? /text\/css/
              : path.endsWith(".svg")
                ? /image\/svg\+xml/
                : path.endsWith(".webmanifest")
                  ? /(?:manifest\+json|application\/json)/
                  : /text\/html/;
          if (!expected.test(contentType)) throw new Error(`Invalid game module: ${path}`);
          return [path, response];
        }),
      );
      const cache = await caches.open(VERSION);
      await Promise.all(responses.map(([path, response]) => cache.put(path, response)));
      // First installation activates immediately. Upgrades wait for existing game
      // clients to close, so their module graph remains one complete version.
    })(),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("hanedanian-package-") && k !== VERSION)
          .map((k) => caches.delete(k)),
      );
    })(),
  );
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    !(url.pathname === ROOT || FILES.includes(url.pathname))
  )
    return;
  if (url.pathname === ROOT + "sw.js") return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(VERSION);
      const path = url.pathname === ROOT ? ROOT + "index.html" : url.pathname;
      const hit = await cache.match(path);
      if (hit) return hit;
      return fetch(event.request);
    })(),
  );
});
self.addEventListener("message", (event) => {
  if (event.data?.type !== "CACHE_HANEDANIAN") return;
  event.waitUntil(
    (async () => {
      const cache = await caches.open(VERSION);
      const results = await Promise.all(FILES.map((path) => cache.match(path)));
      event.ports[0]?.postMessage({
        type: "HANEDANIAN_OFFLINE_READY",
        ok: results.every(Boolean),
        version: VERSION,
      });
    })(),
  );
});
