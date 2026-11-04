// Reproduce mature-neighbourhood liveness separately from the year-long replay.
import {readFileSync} from "node:fs";
import {gunzipSync} from "node:zlib";
import {createHash} from "node:crypto";
import {createWorld, stepWorld} from "../../src/games/social-engine/simulation/engine.ts";
import {migrateState} from "../../src/games/social-engine/persistence/codec.ts";
import {observeLocalDay} from "./neighbourhood-liveness.mjs";
const file = process.argv[2], raw = file && gunzipSync(readFileSync(file));
const world = raw ? migrateState(JSON.parse(raw)) : createWorld(20261103);
const startTick = world.tick;
const activity = observeLocalDay(world);
for (let i = 1; i <= 14400; i++) {
  stepWorld(world);
  if (i % 600 === 0) activity.sample();
}
const result = activity.result();
console.log(JSON.stringify({startTick, endTick: world.tick, inputSha256: raw && createHash("sha256").update(raw).digest("hex"), ...result}, null, 2));
if (result.stalled) process.exitCode = 1;
