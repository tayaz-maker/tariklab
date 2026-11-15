import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

export function requireAllWorkers(needs, required = ["bundle", "unit", "browser"]) {
  assert.ok(
    needs && typeof needs === "object" && !Array.isArray(needs),
    "Missing dependency results",
  );
  assert.deepEqual(
    Object.keys(needs).sort(),
    [...required].sort(),
    "Missing or unexpected required worker",
  );
  for (const [name, result] of Object.entries(needs))
    assert.equal(result?.result, "success", `Required worker ${name} did not succeed`);
  return true;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const required = process.argv.slice(2);
  requireAllWorkers(
    JSON.parse(process.env.NEEDS_JSON || "null"),
    required.length ? required : undefined,
  );
  console.log("Every required worker passed; checking exact workload evidence next.");
}
