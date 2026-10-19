import { setTimeout as delay } from "node:timers/promises";

// Readiness is evidence, not a fixed sleep. No failed probe becomes a PASS.
export async function waitUntilReady(probe, {
  timeoutMs = 90000, intervalMs = 1000, now = Date.now, sleep = delay,
  stopped = () => false, log = console.log,
} = {}) {
  if (!(timeoutMs > 0) || !(intervalMs > 0)) throw new Error("positive readiness bounds required");
  const start = now(), deadline = start + timeoutMs;
  let last = "no probe completed", attempt = 0;
  while (now() < deadline) {
    if (stopped()) throw new Error("server exited before readiness");
    try {
      if (await probe(Math.max(1, deadline - now()))) {
        if (now() >= deadline) throw new Error("probe exceeded readiness deadline");
        log(`ready after ${now() - start}ms (${++attempt} probes)`);
        return;
      }
      last = "probe not ready";
    } catch (error) { last = error.message; }
    log(`waiting ${now() - start}ms, probe ${++attempt}: ${last}`);
    if (now() < deadline) await sleep(Math.min(intervalMs, deadline - now()));
  }
  throw new Error(`readiness timed out after ${now() - start}ms: ${last}`);
}

export async function waitForHttp(url, options = {}) {
  return waitUntilReady(async remaining => {
    const response = await fetch(url, { redirect: "error", cache: "no-store", signal: AbortSignal.timeout(Math.min(2000, remaining)) });
    await response.body?.cancel();
    return response.status === 200;
  }, options);
}
