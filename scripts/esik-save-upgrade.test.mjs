import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

// Deterministic SW fetch-handler/module test, not a browser install or a claim
// that an entirely offline visitor receives code they have never downloaded.
const origin = "https://tariklab.example";
const route = `${origin}/games/esik/`;
const rootWorker = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
const currentIndex = readFileSync(new URL("../public/games/esik/index.html", import.meta.url), "utf8");
const currentSim = readFileSync(new URL("../public/games/esik/sim.js", import.meta.url), "utf8");
// Exact permissive deserialize boundary from be160c95. Only the pure save API
// is retained here; this fixture is not a substitute for the old game's UI.
const legacySim = `
export const KEY = "tariklab.kiyi-esigi.v1";
export function serialize(state) { return JSON.stringify({ key: KEY, version: 1, state }); }
export function deserialize(raw) {
  try {
    const data = JSON.parse(raw);
    if (data.key !== KEY || data.version !== 1 || !Array.isArray(data.state?.line)) return null;
    return data.state;
  } catch { return null; }
}
`;
const legacyApp = 'import { KEY, deserialize, serialize } from "./sim.js";\n// Cached pre-fix save boundary fixture.\n';
const legacyIndex = '<script type="module" src="./app.js"></script>';
const asModuleUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const freshSim = await import(asModuleUrl(currentSim));

function workerHarness({ offline = false } = {}) {
  const handlers = {};
  const entries = new Map([
    [route, legacyIndex],
    [`${route}app.js`, legacyApp],
    [`${route}sim.js`, legacySim],
  ]);
  const requests = [];
  const puts = [];
  const keyOf = (request) => new URL(typeof request === "string" ? request : request.url, origin).href;
  const cache = {
    async match(request) {
      const source = entries.get(keyOf(request));
      return source === undefined ? undefined : new Response(source);
    },
    put(request, response) {
      const done = response.text().then((source) => { entries.set(keyOf(request), source); });
      puts.push(done);
      return done;
    },
  };
  vm.runInNewContext(rootWorker, {
    URL, Response,
    caches: { open: async () => cache },
    fetch: async (request) => {
      requests.push(keyOf(request));
      if (offline) throw new TypeError("offline fixture");
      const { pathname } = new URL(keyOf(request));
      const file = pathname.endsWith("/") ? `${pathname}index.html` : pathname;
      return new Response(readFileSync(new URL(`../public${file}`, import.meta.url), "utf8"));
    },
    self: { location: { origin }, addEventListener(name, callback) { handlers[name] = callback; } },
  });
  return {
    entries, requests,
    setOffline(value) { offline = value; },
    async load(url, mode = "cors") {
      let responding;
      handlers.fetch({
        request: { url: keyOf(url), method: "GET", mode },
        respondWith(promise) { responding = promise; },
      });
      assert.ok(responding, "actual root worker must handle this same-origin request");
      const response = await responding;
      assert.ok(response?.ok, `module response failed: ${url}`);
      const source = await response.text();
      await Promise.all(puts);
      return source;
    },
  };
}

function moduleEntry(html) {
  const match = html.match(/<script\s+type="module"\s+src="([^"]+)"/);
  assert.ok(match, "game HTML must expose its module entry");
  return new URL(match[1], route).href;
}

function imported(source, file, parent) {
  const paths = [...source.matchAll(/\bfrom\s+["']([^"']+)["']/g)].map((match) => match[1]);
  const specifier = paths.find((path) => new URL(path, parent).pathname.endsWith(`/${file}`));
  assert.ok(specifier, `missing ${file} import`);
  return new URL(specifier, parent).href;
}

async function loadSaveBoundary(harness) {
  const html = await harness.load(route, "navigate");
  const entry = moduleEntry(html);
  assert.notEqual(entry, `${route}app.js`, "new HTML must not reuse the cached legacy entry URL");
  const app = await harness.load(entry);
  const simUrl = imported(app, "sim.js", entry);
  const storeUrl = imported(app, "save-store.js", entry);
  assert.equal(new URL(entry).searchParams.get("save"), "2");
  assert.equal(new URL(simUrl).searchParams.get("save"), "2");
  assert.equal(new URL(storeUrl).searchParams.get("save"), "2");
  const simSource = await harness.load(simUrl);
  const storeSource = await harness.load(storeUrl);
  assert.equal(imported(storeSource, "sim.js", storeUrl), simUrl, "app and storage must use the same validator URL");
  const simModule = asModuleUrl(simSource);
  const rewrittenStore = storeSource.replace(/from\s+["'][^"']*\/sim\.js(?:\?[^"']*)?["']/, `from ${JSON.stringify(simModule)}`);
  assert.notEqual(rewrittenStore, storeSource);
  return { sim: await import(simModule), store: await import(asModuleUrl(rewrittenStore)), entry, simUrl, storeUrl };
}

function corruptFixture() {
  const state = freshSim.apply(freshSim.createCoast(3), "bagla:merdiven");
  const backup = freshSim.serialize(state);
  const incomplete = JSON.parse(backup);
  delete incomplete.state.ramps;
  return { state, backup, corrupt: JSON.stringify(incomplete) };
}

function verifyRecovery({ sim, store }) {
  const { state, backup, corrupt } = corruptFixture();
  const records = new Map([[sim.KEY, corrupt], [store.BACKUP_KEY, backup]]);
  const storage = { getItem: (key) => records.get(key) ?? null, setItem: (key, value) => { records.set(key, value); } };
  assert.equal(sim.deserialize(corrupt), null);
  assert.deepEqual(store.loadCoastSave(storage), { state, status: "backup" });
  assert.equal(records.get(sim.KEY), corrupt, "load must not change the unreadable primary");
  const next = sim.apply(state, "rampa:merdiven");
  assert.deepEqual(store.saveCoastSave(storage, next), { ok: true, status: "preserved" });
  assert.equal(records.get(`${store.RECOVERY_PREFIX}0`), corrupt);
  assert.equal(records.get(store.BACKUP_KEY), backup);
  assert.deepEqual(store.loadCoastSave(storage), { state: next, status: "loaded" });
}

test("root SW negative control reproduces the permissive cached unversioned save boundary", async () => {
  const harness = workerHarness();
  const app = await harness.load(`${route}app.js`);
  assert.equal(app, legacyApp);
  const sim = await import(asModuleUrl(await harness.load(imported(app, "sim.js", `${route}app.js`))));
  assert.notEqual(sim.deserialize(corruptFixture().corrupt), null);
  assert.equal(freshSim.deserialize(corruptFixture().corrupt), null);
});

test("current online entry avoids old cached modules and restores backup without losing corrupt bytes", async () => {
  const harness = workerHarness();
  assert.equal(await harness.load(route, "navigate"), currentIndex);
  const boundary = await loadSaveBoundary(harness);
  verifyRecovery(boundary);
  assert.equal(harness.entries.get(`${route}sim.js`), legacySim, "query-specific upgrade must not depend on replacing the old cache entry");
  for (const url of [boundary.entry, boundary.simUrl, boundary.storeUrl]) assert.ok(harness.entries.has(url));
});

test("the warmed versioned save boundary still restores and safely saves when offline", async () => {
  const harness = workerHarness();
  await loadSaveBoundary(harness);
  harness.setOffline(true);
  verifyRecovery(await loadSaveBoundary(harness));
});

test("limit: a completely offline first visit with only old HTML and modules remains on the old boundary", async () => {
  const harness = workerHarness({ offline: true });
  const html = await harness.load(route, "navigate");
  assert.equal(html, legacyIndex);
  assert.equal(moduleEntry(html), `${route}app.js`);
  const app = await harness.load(moduleEntry(html));
  assert.equal(app, legacyApp);
  const source = await harness.load(imported(app, "sim.js", moduleEntry(html)));
  assert.equal(source, legacySim);
  const sim = await import(asModuleUrl(source));
  assert.notEqual(sim.deserialize(corruptFixture().corrupt), null, "this deliberately un-upgraded visitor is not claimed fixed");
  assert.ok([...harness.entries.keys()].every((url) => !new URL(url).searchParams.has("save")));
});
