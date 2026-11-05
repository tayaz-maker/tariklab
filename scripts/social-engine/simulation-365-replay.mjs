import { Worker } from "node:worker_threads";

// One request is in flight per worker. A worker exit or exception must fail the run.
export function startReplay(workerData) {
  const worker = new Worker(new URL("./simulation-365-replay-worker.mjs", import.meta.url), { workerData });
  let pending;
  let failure;
  let stopping = false;
  const fail = (error) => {
    failure = error;
    if (pending) { pending.reject(error); pending = undefined; }
  };
  worker.on("error", fail);
  worker.on("exit", (code) => { if (!stopping) fail(new Error(`Replay worker exited unexpectedly: ${code}`)); });
  worker.on("message", (message) => {
    if (!pending) return fail(new Error("Unexpected replay worker message"));
    const current = pending;
    pending = undefined;
    if (message.error) current.reject(new Error(message.error));
    else current.resolve(message);
  });
  const receive = () => new Promise((resolve, reject) => {
    if (failure) reject(failure);
    else if (pending) reject(new Error("Replay request already pending"));
    else pending = { resolve, reject };
  });
  const ready = receive();
  ready.catch(() => {});
  return {
    ready,
    advance() { const result = receive(); result.catch(() => {}); worker.postMessage("advance"); return result; },
    stop() { stopping = true; return worker.terminate(); },
  };
}
