import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { injectBuildAssets, offlineSwPlugin } from "./offline-sw-plugin.mjs";

function generate(environment, bundle) {
  const emitted = [];
  offlineSwPlugin().generateBundle.call(
    { environment: { name: environment }, emitFile: (asset) => emitted.push(asset) },
    {},
    bundle,
  );
  return emitted;
}

test("generated worker precaches the static shell and client JS/CSS on its first install", async () => {
  const emitted = generate("client", {
    "assets/index-123.js": {},
    "assets/game-456.js": {},
    "assets/styles-789.css": {},
    "assets/index-123.js.map": {},
    "manifest.json": {},
  });
  assert.equal(emitted.length, 2);
  assert.equal(emitted[0].fileName, "sw.js");
  assert.equal(emitted[1].fileName, "games/hanedanian/sw.js");
  assert.match(emitted[1].source, /const VERSION = "hanedanian-package-[0-9a-f]{16}";/);
  assert.ok(!emitted[1].source.includes('HANEDANIAN_BUILD_VERSION'));

  const handlers = {};
  const cached = [];
  let skippedWaiting = false;
  vm.runInNewContext(emitted[0].source, {
    self: {
      addEventListener: (name, callback) => { handlers[name] = callback; },
      skipWaiting: async () => { skippedWaiting = true; },
    },
    caches: { open: async () => ({ addAll: async (urls) => { cached.push(...urls); } }) },
  });
  let installation;
  handlers.install({ waitUntil: (promise) => { installation = promise; } });
  await installation;

  assert.deepEqual(cached, [
    "/", "/cete-savaslari", "/favicon.svg", "/__grok/icon-180.png", "/manifest.webmanifest",
    "/i18n/tlab-i18n.js", "/i18n/deep-en.js", "/i18n/deep-en-final.js", "/i18n/boot.js", "/credits.html",
    "/assets/index-123.js", "/assets/game-456.js", "/assets/styles-789.css",
  ]);
  assert.equal(skippedWaiting, true);
});

test("server output is never injected into the browser service worker", () => {
  assert.deepEqual(generate("ssr", { "assets/server.js": {} }), []);
  assert.deepEqual(generate("client", { "server.mjs": {}, "assets/client.js": {} }), []);
});

test("missing or duplicated injection marker fails instead of silently shipping an incomplete cache", () => {
  assert.throws(() => injectBuildAssets("const BUILD_ASSETS = [];", []), /exactly one/);
  assert.throws(() => injectBuildAssets("/* TARIKLAB_BUILD_ASSETS */ []\n/* TARIKLAB_BUILD_ASSETS */ []", []), /exactly one/);
});
