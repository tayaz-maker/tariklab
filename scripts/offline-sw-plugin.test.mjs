import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync,readdirSync} from "node:fs";
import { injectBuildAssets, offlineSwPlugin, versionGameWorker } from "./offline-sw-plugin.mjs";
import {retiredWorkerPaths,retirementWorker} from './retired-products.mjs';

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
  assert.equal(emitted.length, 4);
  assert.equal(emitted[0].fileName, "sw.js");
  const game=emitted.find(asset=>asset.fileName==='games/hanedanian/sw.js');
  assert.ok(game);
  assert.match(game.source, /const VERSION = "hanedanian-package-[0-9a-f]{16}";/);
  assert.ok(!game.source.includes('HANEDANIAN_BUILD_VERSION'));
  for(const path of retiredWorkerPaths)
    assert.equal(emitted.find(asset=>asset.fileName===path)?.source,retirementWorker);

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
    "/", "/cete-savaslari", "/favicon.svg", "/manifest.webmanifest",
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


test("HANEDANIAN package version includes locale and capability-loader closure bytes", () => {
  const gameDir = new URL('../public/games/hanedanian/', import.meta.url);
  const source = readFileSync(new URL('sw.js', gameDir), 'utf8');
  const files = Object.fromEntries(readdirSync(gameDir).filter(name => name !== 'sw.js').map(name => [name, readFileSync(new URL(name, gameDir))]));
  files['../shared/outcome-runtime.js'] = readFileSync(new URL('../shared/outcome-runtime.js', gameDir));
  const shared = ['/i18n/pl-body.js', '/i18n/pl/hanedanian.json', '/games/shared/pixi-adapter.js', '/vendor/pixi/pixi-8.21.0.min.mjs'];
  for (const path of shared) files[path] = readFileSync(new URL('../public' + path, import.meta.url));
  const generated = generate('client', {'assets/client.js': {}}).find(asset => asset.fileName === 'games/hanedanian/sw.js').source;
  assert.equal(generated, versionGameWorker(source, files), 'generator must bind every runtime closure byte');
  for (const path of shared) {
    const changed = {...files, [path]: Buffer.concat([files[path], Buffer.from('changed-byte')])};
    assert.notEqual(versionGameWorker(source, changed), generated, `package would mix changed ${path}`);
  }
});
