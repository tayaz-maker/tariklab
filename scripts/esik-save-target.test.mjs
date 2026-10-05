import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { checkedSaveOrigin, productionOrigins, fingerprintPaths, verifySaveBuild, oldFixedUrlEntries, oldSaveBaseline } from "./esik-save-target.mjs";

test("save browser fixtures require an explicit exact production host or loopback", () => {
  assert.equal(checkedSaveOrigin("http://127.0.0.1:4567"), "http://127.0.0.1:4567");
  for (const origin of productionOrigins) { assert.equal(checkedSaveOrigin(origin, true), origin); assert.throws(() => checkedSaveOrigin(origin)); }
  for (const value of ["https://www.tariklab.com.evil.test", "https://tariklab.com", "https://www.tariklab.com:123", "https://u:p@www.tariklab.com", "https://www.tariklab.com/path", "https://www.tariklab.com?x=1", "file:///tmp/test"]) assert.throws(() => checkedSaveOrigin(value, true));
});
test("all five exact save build fingerprints fail closed on stale files, HTTP errors and redirects", async () => {
  const root = resolve("public"), origin = productionOrigins[0];
  const read = async (url, options) => { assert.equal(options.redirect, "error"); const path = new URL(url).pathname; return new Response(await readFile(resolve(root, "." + (path.endsWith("/") ? `${path}index.html` : path)))); };
  assert.equal((await verifySaveBuild(origin, root, read)).length, fingerprintPaths.length);
  for (const path of fingerprintPaths) await assert.rejects(verifySaveBuild(origin, root, (url, options) => new URL(url).pathname === path.split("?")[0] ? new Response("stale") : read(url, options)), /exact candidate/);
  await assert.rejects(verifySaveBuild(origin, root, async () => new Response("missing", { status: 404 })), /asset status/);
  await assert.rejects(verifySaveBuild(origin, root, async () => { throw new Error("redirect denied"); }), /redirect denied/);
});
test("old-cache browser fixture reads exact pinned pre-fix blobs, not a mutable baseline", () => {
  // Ordinary npm test must work in a depth-one checkout. The browser driver
  // verifies the real three hashes after its workflow fetches this exact SHA.
  const calls = [];
  assert.throws(() => oldFixedUrlEntries(spec => { calls.push(spec); return Buffer.from("different baseline"); }), /pinned pre-fix blob mismatch/);
  assert.deepEqual(calls, [`${oldSaveBaseline}:public/games/esik/app.js`]);
  assert.equal(oldSaveBaseline, "be160c95eb5283e5ed2ce8bf139ef7aa714d329d");
  assert.throws(() => oldFixedUrlEntries(() => { throw new Error("missing baseline"); }), /missing baseline/);
});
