import { restoreAtlas3dAssets } from "./atlas-3d-assets.mjs";
restoreAtlas3dAssets();
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
const root = new URL("../public/atlas/3d/", import.meta.url);
const read = (p) => readFile(new URL(p, root));
const hash = (b) => createHash("sha256").update(b).digest("hex");
test("nine source-identified male groups preserve 468 distinct source meshes with valid indexed triangles", async () => {
  const m = JSON.parse(await read("models/manifest.json"));
  assert.equal(m.sex, "adult-male-reference");
  assert.equal(m.reviewStatus, "not-reviewed");
  assert.equal(m.structures.length, 9);
  assert.equal(m.meshCount, 468);
  const ids = new Set();
  for (const s of m.structures) {
    for (const source of s.sources) {
      assert(!ids.has(source.id));
      ids.add(source.id);
      assert.match(source.sha256, /^[a-f0-9]{64}$/);
    }
    const packed = await read(s.file);
    assert.equal(hash(packed), s.sha256);
    assert.equal(packed.length, s.bytes);
    const bytes = gunzipSync(packed);
    assert.equal(bytes.length, s.decodedBytes);
    const nv = bytes.readUInt32LE(0),
      ni = bytes.readUInt32LE(4);
    assert.equal(nv, s.vertices);
    assert.equal(ni, s.triangles * 3);
    assert.equal(bytes.length, 8 + nv * 12 + ni * 4);
    for (let i = 0; i < nv * 3; i++) assert(Number.isFinite(bytes.readFloatLE(8 + i * 4)));
    for (let i = 0; i < ni; i++) assert(bytes.readUInt32LE(8 + nv * 12 + i * 4) < nv);
  }
});
test("offline package binds exact assets within 8 MiB and keeps the root and existing atlas separate", async () => {
  const p = JSON.parse(await read("offline-manifest.json"));
  assert(p.bytes <= 8 * 1024 * 1024);
  assert(p.files.every((f) => !f.path.includes("..") && !f.path.startsWith("/")));
  assert.equal(new Set(p.files.map((f) => f.path)).size, p.files.length);
  for (const f of p.files) {
    const bytes = await read(f.path);
    assert.equal(bytes.length, f.bytes);
    assert.equal(hash(bytes), f.sha256);
  }
  const html = (await read("index.html")).toString();
  assert(!html.includes('src="viewer.js"'));
  assert(!html.includes('src="vendor/'));
  const sw = (await read("sw.js")).toString();
  assert(sw.includes(p.version));
  assert(!sw.includes("skipWaiting"));
  assert(!sw.includes("caches.keys"));
});
test("all nine selected structures have source-linked draft descriptions; geometry is not labeled female", async () => {
  const { notes } = await import("../public/atlas/3d/content.js");
  const m = JSON.parse(await read("models/manifest.json"));
  assert.deepEqual(Object.keys(notes).sort(), m.structures.map((s) => s.id).sort());
  for (const [description, url] of Object.values(notes)) {
    assert(description.length > 40);
    assert.match(url, /^https:\/\/(www\.(nhlbi|niddk)\.nih\.gov|training\.seer\.cancer\.gov)\//);
  }
  const sources = (await read("sources.html")).toString();
  assert(sources.includes("CC BY 4.0"));
  assert(sources.includes("kadın"));
  assert(sources.includes("THREE-LICENSE.txt"));
});

import vm from "node:vm";
import { webcrypto } from "node:crypto";
async function offlineHarness({ failPath = null, stores = new Map() } = {}) {
  const pkg = JSON.parse(await read("offline-manifest.json")),
    bodies = new Map(
      await Promise.all(pkg.files.map(async (f) => ["/atlas/3d/" + f.path, await read(f.path)])),
    ),
    listeners = new Map();
  let offline = false;
  const key = (p) => new URL(typeof p === "string" ? p : p.url, "https://proof.example").pathname;
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const map = stores.get(name);
      return {
        async match(p) {
          return map.get(key(p))?.clone();
        },
        async put(p, r) {
          map.set(key(p), r.clone());
        },
      };
    },
    async delete(name) {
      return stores.delete(name);
    },
  };
  vm.runInNewContext((await read("sw.js")).toString(), {
    URL,
    Response,
    Uint8Array,
    crypto: webcrypto,
    location: { origin: "https://proof.example" },
    caches,
    fetch: async (p) => {
      if (offline) throw Error("offline");
      const path = key(p);
      if (path === failPath) return new Response("corrupt");
      return new Response(bodies.get(path));
    },
    self: {
      clients: { async claim() {} },
      addEventListener: (type, fn) => listeners.set(type, fn),
    },
  });
  const lifecycle = async (type) => {
    let pending;
    listeners.get(type)({ waitUntil: (p) => (pending = p) });
    await pending;
  };
  const status = async () => {
    let pending, result;
    listeners.get("message")({
      data: "verify",
      ports: [{ postMessage: (r) => (result = r) }],
      waitUntil: (p) => (pending = p),
    });
    await pending;
    return result;
  };
  const get = async (path, method = "GET") => {
    let response;
    listeners.get("fetch")({
      request: new Request(new URL(path, "https://proof.example"), { method }),
      respondWith: (r) => (response = r),
    });
    return response ? await response : null;
  };
  return { pkg, stores, lifecycle, status, get, setOffline: () => (offline = true) };
}
test("real 3D worker verifies the entire package, serves offline query/deep link and avoids other game scopes", async () => {
  const h = await offlineHarness();
  assert.equal((await h.status()).ready, false);
  await h.lifecycle("install");
  assert.equal((await h.status()).ready, true);
  h.setOffline();
  for (const path of [
    "/atlas/3d/",
    "/atlas/3d/index.html?proof=1",
    "/atlas/3d/models/FMA7148.bin.gz",
  ])
    assert.equal((await h.get(path)).status, 200);
  for (const path of [
    "/",
    "/atlas/yapi/",
    "/games/duel-core/theme-meta.js",
    "https://other.example/atlas/3d/",
  ])
    assert.equal(await h.get(path), null);
  assert.equal(await h.get("/atlas/3d/app.js", "POST"), null);
});
test("corrupt candidate cannot claim offline ready or erase existing foundation/game caches", async () => {
  const stores = new Map([
    ["old-proof", new Map()],
    ["cete-offline-v5", new Map()],
    ["atlas-foundation-existing", new Map()],
  ]);
  const h = await offlineHarness({ stores, failPath: "/atlas/3d/models/FMA7088.bin.gz" });
  await assert.rejects(h.lifecycle("install"), /corrupted/);
  assert.deepEqual(
    [...stores.keys()],
    ["old-proof", "cete-offline-v5", "atlas-foundation-existing"],
  );
  assert.equal((await h.status()).ready, false);
});
