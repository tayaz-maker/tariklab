/* Son Mahalle Bükücü — HTML/navigate network-first so phones never stick on an old board. */
var CACHE = "smb-shell-v13";
var PRECACHE = ["./index.html", "./sw.js", "./manifest.webmanifest", "./icon.svg", "./"];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return c.addAll(PRECACHE).catch(function () {
        return c.addAll(["./index.html", "./"]);
      });
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (k) { return k.indexOf("smb-shell-") === 0 && k !== CACHE; })
          .map(function (k) { return caches.delete(k); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

function isDoc(req, url) {
  if (req.mode === "navigate") return true;
  if (req.destination === "document") return true;
  var p = url.pathname || "";
  if (p === "/games/bukucu" || p === "/games/bukucu/" || /\/games\/bukucu\/index\.html$/.test(p)) return true;
  if (/\/games\/bukucu\/sw\.js/.test(p)) return true;
  var acc = req.headers.get("accept") || "";
  if (acc.indexOf("text/html") !== -1) return true;
  return false;
}

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;
  if (url.pathname.indexOf("/games/bukucu") !== 0) return;

  if (isDoc(req, url)) {
    e.respondWith(
      fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        return caches.match(req).then(function (h) {
          return h || caches.match("./index.html").then(function (h2) {
            return h2 || new Response("", { status: 503 });
          });
        });
      })
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(function (hit) {
      var net = fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        return hit || caches.match("./index.html").then(function (h) {
          return h || new Response("", { status: 503 });
        });
      });
      return hit || net;
    })
  );
});
