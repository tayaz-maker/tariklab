// Emits conservative CI routing flags. Unknown or shared paths always select
// the full browser matrix: a fast false positive is preferable to a gap.
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function classifyChanges(files, { pullRequest = false } = {}) {
  const routeByPath = new Map([
    ["public/games/tc-sim-devlet/", "tc-sim-devlet"],
    ["public/games/tc-sim/", "tc-sim"],
    ["public/games/hanedanian/", "hanedanian"],
    ["public/games/ihtilal/", "ihtilal"],
    ["public/games/duel-core/", "duel"],
    ["public/games/veto-h/", "duel"],
    ["public/games/gett-oh/", "duel"],
    ["public/games/darbe-h/", "duel"],
  ]);
  const shared =
    /^(\.github\/|package(?:-lock)?\.json$|vite\.config|src\/|public\/(?:games\/(?:shared|next-wave)|i18n|sw\.js)|scripts\/(?!ci-changes\.mjs$))/;
  const isDocumentation = (file) =>
    /^(docs\/|(?:README|LICENSE)(?:\.(?:md|txt))?$)/.test(file) ||
    /^(?:[^/]+|outputs\/.+)\.md$/.test(file);
  const docsOnly = files.length > 0 && files.every(isDocumentation);
  const routes = new Set();
  let full = !files.length;
  for (const file of files) {
    // Test-only TC files cannot alter other games' browser runtime. The full
    // npm test command still runs. Main and unknown/shared paths stay conservative.
    if (pullRequest && file === "scripts/management-desk.test.mjs") {
      routes.add("tc-sim");
      routes.add("tc-sim-devlet");
      continue;
    }
    if (pullRequest && (
      /^scripts\/tc-sim-(?!devlet).*\.test\.mjs$/.test(file) ||
      file === "scripts/tc-sim-job-start-outcome-browser.mjs" ||
      file === "public/i18n/pl/tc-sim.json"
    )) {
      routes.add("tc-sim");
      continue;
    }
    // This stylesheet has exactly two consumers, guarded by ci-changes.test.mjs.
    if (file === "public/games/shared/management-desk.css") {
      routes.add("tc-sim");
      routes.add("tc-sim-devlet");
      continue;
    }
    if (shared.test(file)) {
      full = true;
      continue;
    }
    let found = false;
    for (const [prefix, route] of routeByPath)
      if (file.startsWith(prefix)) {
        routes.add(route);
        found = true;
      }
    if (!found && !isDocumentation(file)) full = true;
  }
  const managementPair = routes.size === 2 && routes.has("tc-sim") && routes.has("tc-sim-devlet");
  if (!managementPair && routes.size !== 1) full ||= routes.size > 1;
  const only = full ? "" : [...routes].join(",");
  const values = {
    full: String(full),
    docs: String(docsOnly),
    routes: only,
    browser: String(full || routes.size > 0),
    tc: String(full || routes.has("tc-sim")),
    devlet: String(full || routes.has("tc-sim-devlet")),
    duel: String(full || routes.has("duel")),
    campaign: String(full || routes.has("hanedanian") || routes.has("ihtilal")),
    balance: String(full || routes.has("hanedanian")),
  };
  return values;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [base, head] = process.argv.slice(2);
  if (!base || !head) throw new Error("usage: ci-changes.mjs <base> <head>");
  const files = execFileSync("git", ["diff", "--name-only", "-z", `${base}...${head}`], {
    encoding: "utf8",
  })
    .split("\0")
    .filter(Boolean);
  const values = classifyChanges(files, { pullRequest: process.env.GITHUB_EVENT_NAME === "pull_request" });
  const output =
    Object.entries(values)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n") + "\n";
  process.stdout.write(output);
  if (process.env.GITHUB_OUTPUT)
    await import("node:fs/promises").then(({ appendFile }) =>
      appendFile(process.env.GITHUB_OUTPUT, output),
    );
}
