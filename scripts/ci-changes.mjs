// Emits conservative CI routing flags. Unknown or shared paths always select
// the full browser matrix: a fast false positive is preferable to a gap.
import { execFileSync } from "node:child_process";

const [base, head] = process.argv.slice(2);
if (!base || !head) throw new Error("usage: ci-changes.mjs <base> <head>");
const files = execFileSync("git", ["diff", "--name-only", `${base}...${head}`], {
  encoding: "utf8",
})
  .split("\n")
  .filter(Boolean);
const routeByPath = new Map([
  ["public/games/tc-sim-devlet/", "tc-sim-devlet"],
  ["public/games/hanedanian/", "hanedanian"],
  ["public/games/ihtilal/", "ihtilal"],
  ["public/games/duel-core/", "duel"],
  ["public/games/veto-h/", "duel"],
  ["public/games/gett-oh/", "duel"],
  ["public/games/darbe-h/", "duel"],
]);
const shared =
  /^(\.github\/|package(?:-lock)?\.json$|vite\.config|src\/|public\/(?:games\/(?:shared|next-wave)|i18n|sw\.js)|scripts\/(?!ci-changes\.mjs$))/;
const docsOnly =
  files.length > 0 && files.every((file) => /^(docs\/|README|LICENSE|\.md$)/.test(file));
const routes = new Set();
let full = !files.length;
for (const file of files) {
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
  if (!found && !/^(docs\/|README|LICENSE|\.md$)/.test(file)) full = true;
}
if (routes.size !== 1) full ||= routes.size > 1;
const only = full ? "" : [...routes].join(",");
const values = {
  full: String(full),
  docs: String(docsOnly),
  routes: only,
  browser: String(full || routes.size > 0),
  devlet: String(full || routes.has("tc-sim-devlet")),
  duel: String(full || routes.has("duel")),
  campaign: String(full || routes.has("hanedanian") || routes.has("ihtilal")),
  balance: String(full || routes.has("hanedanian")),
};
for (const [key, value] of Object.entries(values)) console.log(`${key}=${value}`);
if (process.env.GITHUB_OUTPUT)
  await import("node:fs/promises").then(({ appendFile }) =>
    appendFile(
      process.env.GITHUB_OUTPUT,
      Object.entries(values)
        .map(([key, value]) => `${key}=${value}`)
        .join("\n") + "\n",
    ),
  );
