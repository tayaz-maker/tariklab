import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export const productionOrigins = ["https://www.tariklab.com", "https://tariklab.tayaz29.workers.dev"];
export const ATLAS_ROOT = "/atlas/yapi/";
export const manifestPath = `${ATLAS_ROOT}package-manifest.json`;
export const atlasEntryBudgets = Object.freeze({ criticalBytes: 350 * 1024, criticalRequests: 12, desktopMeaningfulViewMs: 2500 });
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const requiredFiles = ["index.html", "app.js", "content.js", "content-schema.js", "geometry.js", "view-model.js", "svg-view.js", "manifest.webmanifest", "icon.svg", "fixtures/smoke.json"];
const validMimes = new Set(["text/html", "text/javascript", "text/css", "application/json", "application/manifest+json", "image/svg+xml"]);

export function checkedAtlasOrigin(base, production = false) {
  const url = new URL(base);
  assert.ok(!url.username && !url.password && url.pathname === "/" && !url.search && !url.hash, "base must be a plain origin");
  assert.ok(production ? productionOrigins.includes(url.origin) : url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname), "atlas fixtures require a loopback or explicitly allowed production origin");
  return url.origin;
}

/** ResourceTiming reports document resource transfers, not worker installation.
 * Include every page request started by DOM-ready; retain late/worker work as a
 * separate observable category. The byte gate charges encoded bytes even when
 * a cache reports zero network transfer, so cache hits cannot hide asset weight. */
export function summarizeAtlasEntry(entry, width) {
  assert.ok(Number.isFinite(entry.readyDomMs) && entry.readyDomMs > 0, "real ready-DOM timestamp required");
  assert.ok(Number.isFinite(entry.meaningfulViewMs) && entry.meaningfulViewMs >= entry.readyDomMs, "real first-render opportunity required");
  assert.equal(entry.navigation.length, 1, "one current document navigation required");
  for (const resource of entry.resources) assert.ok(Number.isFinite(resource.startTime) && resource.startTime >= 0, "real resource start time required");
  const criticalResources = entry.resources.filter(resource => resource.startTime <= entry.readyDomMs);
  const lateResources = entry.resources.filter(resource => resource.startTime > entry.readyDomMs);
  const entries = [...entry.navigation, ...criticalResources];
  for (const resource of entries) {
    for (const field of ["transferSize", "encodedBodySize"]) assert.ok(Number.isFinite(resource[field]) && resource[field] >= 0, `ResourceTiming ${field} required`);
  }
  const summary = {
    scope: "Current document plus page resources started by initial DOM-ready; excludes service-worker install fetches. Ready DOM plus two animation frames is an operational first-render opportunity, not a standardized FMP API.",
    criticalRequests: entries.length,
    pageTransferBytes: entries.reduce((sum, resource) => sum + resource.transferSize, 0),
    pageEncodedBodyBytes: entries.reduce((sum, resource) => sum + resource.encodedBodySize, 0),
    budgetedBytes: entries.reduce((sum, resource) => sum + Math.max(resource.transferSize, resource.encodedBodySize), 0),
    readyDomMs: entry.readyDomMs, meaningfulViewMs: entry.meaningfulViewMs,
    fcpMs: entry.paints.find(paint => paint.name === "first-contentful-paint")?.startTime ?? null,
    criticalResources, lateResources, desktopTimeBudgetApplied: width === 1440,
  };
  assert.ok(summary.pageEncodedBodyBytes > 0, "nonempty same-origin resource byte evidence required");
  assert.ok(Number.isFinite(summary.fcpMs) && summary.fcpMs >= 0, "actual first-contentful-paint entry required");
  assert.ok(summary.criticalRequests <= atlasEntryBudgets.criticalRequests, `Atlas critical requests ${summary.criticalRequests} > ${atlasEntryBudgets.criticalRequests}`);
  assert.ok(summary.budgetedBytes <= atlasEntryBudgets.criticalBytes, `Atlas critical bytes ${summary.budgetedBytes} > ${atlasEntryBudgets.criticalBytes}`);
  if (width === 1440) assert.ok(summary.meaningfulViewMs <= atlasEntryBudgets.desktopMeaningfulViewMs, `Atlas desktop first meaningful view ${summary.meaningfulViewMs}ms > ${atlasEntryBudgets.desktopMeaningfulViewMs}ms`);
  return summary;
}

function validateManifest(manifest) {
  assert.equal(manifest.schema, 1, "Atlas package schema");
  assert.equal(manifest.root, ATLAS_ROOT, "Atlas package scope");
  assert.match(manifest.version, /^atlas-foundation-[a-f0-9]{24}$/, "content-addressed Atlas version");
  assert.match(manifest.workerSha256, /^[a-f0-9]{64}$/, "worker template hash required");
  assert.ok(Array.isArray(manifest.files) && manifest.files.length >= requiredFiles.length && manifest.files.length <= 100, "bounded complete package required");
  const names = new Set();
  for (const file of manifest.files) {
    assert.equal(typeof file.path, "string");
    assert.ok(file.path.startsWith(ATLAS_ROOT) && /^[a-zA-Z0-9_./-]+$/.test(file.path), "asset must stay inside Atlas scope");
    const relative = file.path.slice(ATLAS_ROOT.length);
    assert.ok(relative && relative.split("/").every(part => part && part !== "." && part !== ".."), "normalized package path required");
    assert.ok(!["sw.js", "package-manifest.json"].includes(relative), "self-referential package asset rejected");
    assert.ok(!names.has(file.path), "duplicate package asset"); names.add(file.path);
    assert.ok(Number.isInteger(file.bytes) && file.bytes > 0 && file.bytes <= 512 * 1024, "individual asset byte budget");
    assert.match(file.sha256, /^[a-f0-9]{64}$/, "exact asset hash required");
    assert.ok(validMimes.has(file.mime), "supported package MIME required");
  }
  assert.ok(requiredFiles.every(name => names.has(ATLAS_ROOT + name)), "foundation dependency missing from manifest");
  const total = manifest.files.reduce((sum, file) => sum + file.bytes, 0);
  assert.equal(manifest.totalBytes, total, "manifest byte total");
  assert.ok(total <= 5 * 1024 * 1024, "complete Atlas package byte budget");
  assert.equal(manifest.version, "atlas-foundation-" + hash(JSON.stringify({ files: manifest.files, workerSha256: manifest.workerSha256 })).slice(0, 24), "manifest version must bind all listed bytes and worker template");
}

function mimeMatches(actual, expected) {
  const mime = (actual || "").split(";", 1)[0].trim().toLowerCase();
  if (expected === "text/javascript") return ["text/javascript", "application/javascript"].includes(mime);
  if (expected === "application/manifest+json") return ["application/manifest+json", "application/json"].includes(mime);
  return mime === expected;
}

export async function verifyAtlasBuild(origin, directory, request = fetch) {
  const bytes = await readFile(resolve(directory, "." + manifestPath));
  assert.ok(bytes.byteLength < 100000, "bounded package manifest required");
  const manifest = JSON.parse(bytes.toString("utf8")); validateManifest(manifest);
  const verified = [];
  const localFile = path => readFile(resolve(directory, "." + path));
  const verifyResponse = async (path, expected, mime) => {
    const urlPath = path === `${ATLAS_ROOT}index.html` ? ATLAS_ROOT : path;
    const response = await request(origin + urlPath, { redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15000) });
    assert.equal(response.status, 200, `Atlas asset HTTP status: ${path}`);
    assert.equal(response.redirected, false, `Atlas canonical asset redirect: ${path}`);
    assert.ok(mimeMatches(response.headers.get("content-type"), mime), `Atlas asset MIME mismatch: ${path}`);
    const actual = Buffer.from(await response.arrayBuffer());
    assert.equal(actual.byteLength, expected.byteLength, `Atlas deployed byte count: ${path}`);
    assert.equal(hash(actual), hash(expected), `Atlas deployed asset is not the exact candidate: ${path}`);
    return { path, urlPath, sha256: hash(actual), bytes: actual.byteLength };
  };
  const manifestProof = await verifyResponse(manifestPath, bytes, "application/json");
  const workerPath = `${ATLAS_ROOT}sw.js`, worker = await localFile(workerPath);
  assert.ok(worker.byteLength < 512 * 1024, "bounded emitted worker required");
  const workerProof = await verifyResponse(workerPath, worker, "text/javascript");
  for (const file of manifest.files) {
    const local = await localFile(file.path);
    assert.equal(local.byteLength, file.bytes, `built asset length differs from manifest: ${file.path}`);
    assert.equal(hash(local), file.sha256, `built asset hash differs from manifest: ${file.path}`);
    verified.push(await verifyResponse(file.path, local, file.mime));
  }
  return { version: manifest.version, totalBytes: manifest.totalBytes, manifest: manifestProof, worker: workerProof, files: verified };
}
