import { parseArgs } from "node:util";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { checkedOutcomeOrigin, verifyOutcomeBuild } from "./tc-sim-job-start-target.mjs";
import { waitUntilReady } from "./ci-readiness.mjs";

export async function waitForTcDeployment(origin, root, options = {}) {
  checkedOutcomeOrigin(origin, true);
  const { request = fetch, ...waitOptions } = options;
  await waitUntilReady(async remaining => {
    const deadline = Date.now() + remaining;
    await verifyOutcomeBuild(origin, root, (url, init) => request(url, {
      ...init, signal: AbortSignal.timeout(Math.min(3000, Math.max(1, deadline - Date.now()))),
    }));
    return true;
  }, { timeoutMs: 300000, intervalMs: 5000, ...waitOptions });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { values } = parseArgs({ options: { origin: { type: "string" }, root: { type: "string" } } });
  if (!values.origin || !values.root) throw new Error("--origin and --root required");
  await waitForTcDeployment(values.origin, values.root);
}
