import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
export const productionOrigins = ["https://www.tariklab.com", "https://tariklab.tayaz29.workers.dev"];
export const fingerprintPaths = ["/games/tc-sim/js/app.js?v=10", "/games/tc-sim/styles.css?v=10", "/games/tc-sim/js/job-start-outcome.js?v=10", "/games/tc-sim/js/job-start-outcome-ui.js?v=10"];
export function checkedOutcomeOrigin(base, production = false) {
  const url = new URL(base);
  assert.ok(!url.username && !url.password && url.pathname === "/" && !url.search && !url.hash, "base must be a plain origin");
  assert.ok(production ? productionOrigins.includes(url.origin) : url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname), "synthetic fixtures require a loopback or explicitly allowed production origin");
  return url.origin;
}
export async function verifyOutcomeBuild(origin, directory, request = fetch) {
  const rows = [];
  const sha = bytes => createHash("sha256").update(bytes).digest("hex");
  for (const path of fingerprintPaths) {
    const expected = sha(await readFile(resolve(directory, "." + path.split("?")[0])));
    const response = await request(origin + path, { redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15000) });
    assert.equal(response.status, 200, `asset status: ${path}`);
    const actual = sha(Buffer.from(await response.arrayBuffer()));
    assert.equal(actual, expected, `deployed TC asset is not the exact candidate: ${path}`);
    rows.push({ path, sha256: actual });
  }
  return rows;
}
