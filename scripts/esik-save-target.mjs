import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export const productionOrigins = ["https://www.tariklab.com", "https://tariklab.tayaz29.workers.dev"];
export const fingerprintPaths = [
  "/games/esik/", "/games/esik/app.js?save=2", "/games/esik/sim.js?save=2",
  "/games/esik/save-store.js?save=2", "/games/esik/style.css",
];
export const oldSaveBaseline = "be160c95eb5283e5ed2ce8bf139ef7aa714d329d";
const oldFiles = [
  ["app.js", "e392544020518ed6a0db158e01751480c04349952b7f0f610b0b5a1397e50d48"],
  ["sim.js", "20f9c5eb99b8421b96eea077b448b1347d3b42b052133f640d363c3665a30181"],
  ["index.html", "b2565b68eef5c35edbb8638dc8dbb0e23ade7000826d193bf491a1a49dcc4e79"],
];
const sha = bytes => createHash("sha256").update(bytes).digest("hex");

export function checkedSaveOrigin(base, production = false) {
  const url = new URL(base);
  assert.ok(!url.username && !url.password && url.pathname === "/" && !url.search && !url.hash, "base must be a plain origin");
  assert.ok(production ? productionOrigins.includes(url.origin) : url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname), "synthetic saves require a loopback or explicitly allowed production origin");
  return url.origin;
}

export async function verifySaveBuild(origin, directory, request = fetch) {
  const rows = [];
  for (const path of fingerprintPaths) {
    const pathname = path.split("?")[0];
    const expected = sha(await readFile(resolve(directory, "." + (pathname.endsWith("/") ? `${pathname}index.html` : pathname))));
    const response = await request(origin + path, { redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15000) });
    assert.equal(response.status, 200, `asset status: ${path}`);
    const actual = sha(Buffer.from(await response.arrayBuffer()));
    assert.equal(actual, expected, `deployed Kıyı save asset is not the exact candidate: ${path}`);
    rows.push({ path, sha256: actual });
  }
  return rows;
}

// Read three pinned blobs directly; no baseline HTTP server or mutable branch.
export function oldFixedUrlEntries(read = spec => execFileSync("git", ["show", spec], { maxBuffer: 100000 })) {
  return oldFiles.map(([name, expected]) => {
    const body = read(`${oldSaveBaseline}:public/games/esik/${name}`);
    assert.equal(sha(body), expected, `pinned pre-fix blob mismatch: ${name}`);
    return { path: name === "index.html" ? "/games/esik/" : `/games/esik/${name}`, body: body.toString(), sha256: expected,
      type: name.endsWith("html") ? "text/html; charset=utf-8" : "text/javascript; charset=utf-8" };
  });
}
