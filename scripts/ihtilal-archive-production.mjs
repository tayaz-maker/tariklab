import assert from "node:assert/strict";
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { chromium } from "playwright";
import { archiveAcceptance } from "./ihtilal-archive-browser.mjs";

const origin = process.argv[2];
assert.ok(["https://www.tariklab.com", "https://tariklab.tayaz29.workers.dev"].includes(origin));
const out = process.env.ARCHIVE_BROWSER_OUT;
assert.ok(out); mkdirSync(out, { recursive: true });
const hash = data => createHash("sha256").update(data).digest("hex");
const manifest = JSON.parse(readFileSync("docs/ihtilal/ARCHIVE_MANIFEST_2026-10-20.json", "utf8"));
assert.equal(manifest.status, "ARCHIVE_REFERENCE_VERIFIED");
const expected = manifest.retainedFiles.filter(file => file.path.startsWith("public/"));
const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(file => file.isDirectory() ? walk(join(dir, file.name)) : [join(dir, file.name)]);
const jitem = walk("public/games/jitem-derin-ag"); assert.equal(jitem.length, 31);
for (const path of jitem) expected.push({ path, sha256: hash(readFileSync(path)) });
for (const path of ["public/credits.html", "public/i18n/tlab-i18n.js", "public/sitemap.xml"]) expected.push({ path, sha256: hash(readFileSync(path)) });
const rows = [];
for (const { path, sha256 } of expected) {
  const url = origin + "/" + path.slice("public/".length);
  let response = await fetch(url, { redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (path.endsWith("/index.html") && response.status === 307) {
    const directory = url.slice(0, -"index.html".length);
    assert.equal(new URL(response.headers.get("location"), response.url).href, directory);
    response = await fetch(directory, { redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15000) });
  }
  assert.equal(response.status, 200, path);
  assert.equal(new URL(response.url).origin, origin);
  assert.equal(hash(Buffer.from(await response.arrayBuffer())), sha256, path);
  rows.push({ path, sha256, status: "PASS" });
}
writeFileSync(`${out}/hash-results.json`, JSON.stringify({ origin, archiveRef: manifest.archiveRef, preRetirementSha: manifest.preRetirementSha, jitemFiles: 31, rows }, null, 2));
const sw = await fetch(origin + "/sw.js", { redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15000) });
assert.equal(sw.status, 200);
assert.ok((await sw.text()).includes('const CACHE = "cete-offline-v6"'));
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, args: ["--no-sandbox"] });
try { console.log(await archiveAcceptance(browser, origin, out)); }
finally { await browser.close(); }
