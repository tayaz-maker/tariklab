import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { checkedOutcomeOrigin, productionOrigins, fingerprintPaths, verifyOutcomeBuild } from "./tc-sim-job-start-target.mjs";
test("fixture origins are exact and explicit; a generic external-host override cannot authorize writes", () => {
  assert.equal(checkedOutcomeOrigin("http://127.0.0.1:4567"), "http://127.0.0.1:4567");
  for (const origin of productionOrigins) { assert.equal(checkedOutcomeOrigin(origin, true), origin); assert.throws(() => checkedOutcomeOrigin(origin)); }
  for (const value of ["https://www.tariklab.com.evil.test", "https://tariklab.com", "https://www.tariklab.com:123", "https://u:p@www.tariklab.com", "https://www.tariklab.com/path", "https://www.tariklab.com?x=1", "file:///tmp/test"]) assert.throws(() => checkedOutcomeOrigin(value, true));
});
test("all six exact built fingerprints gate the browser; a stale asset, HTTP error or redirect fails closed", async () => {
  const origin=productionOrigins[0],root=resolve("public");
  const read=async(url,options)=>{assert.equal(options.redirect,"error");return new Response(await readFile(resolve(root,"."+new URL(url).pathname)));};
  assert.deepEqual(fingerprintPaths, ["/games/tc-sim/js/app.js?v=10", "/games/tc-sim/styles.css?v=10", "/games/tc-sim/js/job-start-outcome.js?v=10", "/games/tc-sim/js/job-start-outcome-ui.js?v=10", "/i18n/expansion-en.js", "/i18n/pl/tc-sim.json"]);
  assert.equal((await verifyOutcomeBuild(origin,root,read)).length,6);
  for (const path of fingerprintPaths.slice(4)) await assert.rejects(verifyOutcomeBuild(origin,root,async(url,options)=>new URL(url).pathname===path ? new Response("old translation") : read(url,options)), /exact candidate/);
  await assert.rejects(verifyOutcomeBuild(origin,root,async()=>new Response("stale")), /exact candidate/);
  await assert.rejects(verifyOutcomeBuild(origin,root,async()=>new Response("missing",{status:404})), /asset status/);
  await assert.rejects(verifyOutcomeBuild(origin,root,async()=>{throw new Error("redirect denied");}), /redirect denied/);
});
