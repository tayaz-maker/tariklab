import { parentPort, workerData } from "node:worker_threads";
import { createHash } from "node:crypto";
import { decodeSave } from "../../src/games/social-engine/persistence/codec.ts";
import { advanceMinutes, canonicalState, createWorld, validateState } from "../../src/games/social-engine/simulation/engine.ts";

const hash = (state) => createHash("sha256").update(canonicalState(state)).digest("hex");
let state = workerData.checkpoint
  ? (await decodeSave(workerData.checkpoint)).state
  : createWorld(workerData.seed);
parentPort.postMessage({ ready: true, hash: hash(state) });
parentPort.on("message", () => {
  try {
    advanceMinutes(state, 1440);
    parentPort.postMessage({ hash: hash(state), violations: validateState(state) });
  } catch (error) {
    parentPort.postMessage({ error: error.stack });
  }
});
