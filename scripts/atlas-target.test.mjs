import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, dirname } from "node:path";
import { createHash } from "node:crypto";
import { checkedAtlasOrigin, productionOrigins, verifyAtlasBuild, ATLAS_ROOT, manifestPath, summarizeAtlasEntry, atlasEntryBudgets } from "./atlas-target.mjs";
const hash = value => createHash("sha256").update(value).digest("hex");

async function fixture(t) {
  const root = await mkdtemp(resolve(tmpdir(), "atlas-target-")); t.after(() => rm(root, { recursive: true, force: true }));
  const names = ["index.html", "app.js", "content.js", "content-schema.js", "geometry.js", "view-model.js", "svg-view.js", "manifest.webmanifest", "icon.svg", "fixtures/smoke.json"];
  const files = [];
  for (const name of names) {
    const path = ATLAS_ROOT + name, body = `fixture:${name}`;
    const destination = resolve(root, "." + path); await mkdir(dirname(destination), { recursive: true }); await writeFile(destination, body);
    const mime = name.endsWith(".js") ? "text/javascript" : name.endsWith(".svg") ? "image/svg+xml" : name.endsWith(".json") ? "application/json" : name.endsWith(".webmanifest") ? "application/manifest+json" : "text/html";
    files.push({ path, bytes: Buffer.byteLength(body), sha256: hash(body), mime });
  }
  const manifest = { schema: 1, root: ATLAS_ROOT, version: "", workerSha256: hash("worker template"), totalBytes: files.reduce((n, file) => n + file.bytes, 0), files };
  const saveManifest = async () => {
    manifest.version = "atlas-foundation-" + hash(JSON.stringify({ files: manifest.files, workerSha256: manifest.workerSha256 })).slice(0, 24);
    await writeFile(resolve(root, "." + manifestPath), JSON.stringify(manifest) + "\n");
  };
  await saveManifest(); await writeFile(resolve(root, "." + ATLAS_ROOT + "sw.js"), "fixture worker");
  const requests = [];
  const request = async (url, options) => {
    requests.push(url); assert.equal(options.redirect, "error"); assert.equal(options.cache, "no-store");
    const parsed = new URL(url), path = parsed.pathname === ATLAS_ROOT ? ATLAS_ROOT + "index.html" : parsed.pathname;
    const mime = path === manifestPath ? "application/json" : path.endsWith("/sw.js") ? "text/javascript" : files.find(row => row.path === path).mime;
    return new Response(await readFile(resolve(root, "." + path)), { headers: { "content-type": mime } });
  };
  return { root, files, manifest, saveManifest, request, requests };
}

test("Atlas origin authorization is exact and production use is explicit", () => {
  assert.equal(checkedAtlasOrigin("http://127.0.0.1:8081"), "http://127.0.0.1:8081");
  for (const origin of productionOrigins) { assert.equal(checkedAtlasOrigin(origin, true), origin); assert.throws(() => checkedAtlasOrigin(origin)); }
  for (const base of ["https://www.tariklab.com.evil.test", "https://tariklab.com", "https://www.tariklab.com:123", "https://u:p@www.tariklab.com", "https://www.tariklab.com/atlas/yapi/", "https://www.tariklab.com?allow=1", "file:///tmp/atlas"]) assert.throws(() => checkedAtlasOrigin(base, true));
});
test("exact manifest, emitted worker and all package assets gate production, with canonical HTML path", async t => {
  const f = await fixture(t), origin = productionOrigins[0];
  const result = await verifyAtlasBuild(origin, f.root, f.request);
  assert.equal(result.files.length, 10); assert.equal(result.version, f.manifest.version);
  assert.equal(f.requests.length, 12); assert.ok(f.requests.includes(origin + ATLAS_ROOT));
  assert.ok(!f.requests.includes(origin + ATLAS_ROOT + "index.html"));
});
test("stale manifest/worker/content, wrong MIME, HTTP failure and redirect all fail closed", async t => {
  const f = await fixture(t), origin = productionOrigins[0];
  for (const path of [manifestPath, `${ATLAS_ROOT}sw.js`, `${ATLAS_ROOT}content.js`]) {
    await assert.rejects(verifyAtlasBuild(origin, f.root, (url, opts) => new URL(url).pathname === path ? new Response("stale", { headers: { "content-type": path.endsWith(".json") ? "application/json" : "text/javascript" } }) : f.request(url, opts)), /deployed byte count|exact candidate/);
  }
  await assert.rejects(verifyAtlasBuild(origin, f.root, async () => new Response("missing", { status: 404 })), /HTTP status/);
  await assert.rejects(verifyAtlasBuild(origin, f.root, async () => new Response("html fallback", { headers: { "content-type": "text/html" } })), /MIME mismatch/);
  await assert.rejects(verifyAtlasBuild(origin, f.root, async () => { throw new Error("redirect denied"); }), /redirect denied/);
});
test("unsafe paths, duplicate files, incomplete dependency lists and manifest tampering cannot authorize requests", async t => {
  for (const mutate of [
    m => { m.files[0].path = ATLAS_ROOT + "../secret.json"; },
    m => { m.files[0].path = "https://example.invalid/asset.js"; },
    m => { m.files.push({ ...m.files[0] }); m.totalBytes += m.files[0].bytes; },
    m => { m.files[0].path = `${ATLAS_ROOT}other.html`; },
    m => { m.totalBytes++; },
  ]) {
    const f = await fixture(t); mutate(f.manifest); await f.saveManifest();
    await assert.rejects(verifyAtlasBuild(productionOrigins[0], f.root, f.request)); assert.equal(f.requests.length, 0);
  }
  const f = await fixture(t); f.manifest.version = "atlas-foundation-" + "0".repeat(24);
  await writeFile(resolve(f.root, "." + manifestPath), JSON.stringify(f.manifest));
  await assert.rejects(verifyAtlasBuild(productionOrigins[0], f.root, f.request), /bind all listed bytes/); assert.equal(f.requests.length, 0);
});
test("changed built asset bytes fail even if a remote server would echo the changed file", async t => {
  const f = await fixture(t);
  await writeFile(resolve(f.root, "." + ATLAS_ROOT + "content.js"), "mutated build");
  await assert.rejects(verifyAtlasBuild(productionOrigins[0], f.root, f.request), /built asset length|built asset hash/);
});

function entryFixture() {
  return { readyDomMs: 400, meaningfulViewMs: 440,
    navigation: [{ transferSize: 1300, encodedBodySize: 1000 }],
    resources: [{ name: "/atlas/yapi/app.js", startTime: 10, transferSize: 10300, encodedBodySize: 10000 },
      { name: "/atlas/yapi/sw.js", startTime: 410, transferSize: 10300, encodedBodySize: 10000 }],
    paints: [{ name: "first-contentful-paint", startTime: 420 }] };
}
test("Atlas entry budgets distinguish critical page bytes from late registration and never hide cache weight", () => {
  const entry = entryFixture(), summary = summarizeAtlasEntry(entry, 1440);
  assert.equal(summary.criticalRequests, 2); assert.equal(summary.pageTransferBytes, 11600);
  assert.equal(summary.pageEncodedBodyBytes, 11000); assert.equal(summary.budgetedBytes, 11600);
  assert.equal(summary.lateResources.length, 1); assert.equal(summary.fcpMs, 420);
  entry.resources[0].transferSize = 0;
  assert.equal(summarizeAtlasEntry(entry, 320).budgetedBytes, 11300, "encoded bytes still count when the network reports a cache hit");
  assert.deepEqual(atlasEntryBudgets, { criticalBytes: 350 * 1024, criticalRequests: 12, desktopMeaningfulViewMs: 2500 });
});
test("Atlas 350 KiB, 12 critical requests and 2.5s desktop gates fail on real overages", () => {
  const large = entryFixture(); large.resources[0].encodedBodySize = atlasEntryBudgets.criticalBytes;
  assert.throws(() => summarizeAtlasEntry(large, 1440), /critical bytes/);
  const many = entryFixture(); many.resources = Array.from({ length: 12 }, (_, index) => ({ name: `file-${index}`, startTime: index, transferSize: 300, encodedBodySize: 100 }));
  assert.throws(() => summarizeAtlasEntry(many, 1440), /critical requests/);
  const slow = entryFixture(); slow.meaningfulViewMs = 2501;
  assert.throws(() => summarizeAtlasEntry(slow, 1440), /first meaningful view/);
  assert.equal(summarizeAtlasEntry(slow, 390).desktopTimeBudgetApplied, false, "mobile timing is measured without inventing an approved mobile threshold");
});
test("missing paint, timestamps or resource bytes cannot silently produce a performance PASS", () => {
  for (const mutate of [entry => { entry.paints = []; }, entry => { entry.readyDomMs = undefined; }, entry => { entry.resources[0].startTime = undefined; }, entry => { entry.navigation[0].encodedBodySize = NaN; }]) {
    const entry = entryFixture(); mutate(entry); assert.throws(() => summarizeAtlasEntry(entry, 1440));
  }
});
