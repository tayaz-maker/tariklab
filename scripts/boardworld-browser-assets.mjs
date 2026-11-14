import { readdirSync } from "node:fs";
import { resolve } from "node:path";

// Generated code is part of every hash/byte audit, never omitted from totals.
export function generatedGameAssets(root = "public") {
  return readdirSync(resolve(root, "games/tc-sim-boardworld"))
    .filter((name) => /^(?:bw|expansion)-runtime-[a-f0-9]{16}\.mjs$/.test(name))
    .sort();
}
