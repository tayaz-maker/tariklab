import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function requireTCNeeds(needs) {
  if (!needs || typeof needs !== "object" || Array.isArray(needs))
    throw new Error("TC dependency results must be an object");
  for (const id of ["prepare", "unit", "browser"])
    if (!Object.hasOwn(needs, id)) throw new Error(`Missing TC dependency: ${id}`);
  for (const [id, job] of Object.entries(needs))
    if (!job || job.result !== "success")
      throw new Error(`TC dependency ${id} did not succeed: ${job?.result}`);
  return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  requireTCNeeds(JSON.parse(process.env.NEEDS_JSON || "null"));
  console.log("TC required gate passed: exact build, all unit checks and every browser group succeeded");
}
