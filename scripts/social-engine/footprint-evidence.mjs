import { readFile, readdir } from "node:fs/promises";

// A new measurement run must never hide a failed sample on the same runtime.
export async function footprintEvidence(manifestSha256) {
  const root = "artifacts/social-engine/performance";
  const samples = [],
    paths = [];
  for (const dir of (await readdir(root, { withFileTypes: true })).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    if (!dir.isDirectory() || !/^\d{4}-\d\d-\d\dT/.test(dir.name)) continue;
    const path = `performance/${dir.name}/os-footprint-samples.json`;
    let data;
    try {
      data = JSON.parse(await readFile("artifacts/social-engine/" + path));
    } catch (e) {
      if (e.code === "ENOENT") continue;
      throw e;
    }
    const matching = data.samples.filter((s) => s.manifestSha256 === manifestSha256);
    if (matching.length) {
      paths.push(path);
      samples.push(...matching.map((s) => ({ ...s, runId: dir.name })));
    }
  }
  return { paths, samples };
}
