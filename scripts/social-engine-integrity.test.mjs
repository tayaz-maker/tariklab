import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
const all = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? all(path) : [path];
  });
test("SOCIAL ENGINE pure domain boundaries and isolated storage remain enforced", () => {
  for (const file of [
    ...all("src/games/social-engine/domain"),
    ...all("src/games/social-engine/simulation"),
  ].filter((p) => p.endsWith(".ts"))) {
    const s = readFileSync(file, "utf8");
    assert.doesNotMatch(
      s,
      /from\s+['"](?:pixi|react)|\b(?:document|window|indexedDB|localStorage)\b|Math\.random\(|Date\.now\(/,
      file,
    );
    assert.doesNotMatch(s, /games\/(?:tc-sim|racon)|from\s+['"].*rendering\//, file);
  }
  for (const file of all("src/games/social-engine").filter((p) => p.endsWith(".ts"))) {
    const s = readFileSync(file, "utf8");
    assert.doesNotMatch(
      s,
      /localStorage\.(?:clear|removeItem)\(|indexedDB\.deleteDatabase\(/,
      file,
    );
  }
});
test("SOCIAL ENGINE immutable bundle manifest matches every runtime byte and package budget", () => {
  const root = "public/games/social-engine";
  const maxRuntimeGzip = 256000;
  const manifest = JSON.parse(readFileSync(root + "/build-manifest.json", "utf8"));
  let gzip = 0;
  for (const asset of manifest.assets) {
    const bytes = readFileSync(root + "/" + asset.file);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), asset.sha256, asset.file);
    assert.equal(bytes.length, asset.bytes);
    assert.equal(gzipSync(bytes).length, asset.gzipBytes);
    gzip += asset.gzipBytes;
  }
  assert.equal(gzip, manifest.totalGzipBytes);
  assert.ok(gzip <= maxRuntimeGzip, `total runtime gzip ${gzip} > ${maxRuntimeGzip} bytes`);
  assert.match(manifest.worker, /^worker-[\w-]+\.js$/);
  assert.match(manifest.entry, /^app-[\w-]+\.js$/);
});
test("SOCIAL ENGINE art has provenance and concrete collision/map data", () => {
  const root = "public/games/social-engine/assets";
  const atlas = JSON.parse(readFileSync(root + "/atlas.json", "utf8"));
  assert.ok(Object.keys(atlas.buildings.frames).length >= 14);
  assert.ok(Object.keys(atlas.actors.frames).length >= 128);
  const map = JSON.parse(readFileSync(root + "/kiyiyaka-map.json", "utf8"));
  assert.ok(map);
  assert.ok(readFileSync("docs/social-engine/ASSET_LICENSES.md", "utf8").includes("original"));
  const bytes = all(root).reduce((n, p) => n + statSync(p).size, 0);
  assert.ok(bytes <= 3 * 1024 * 1024, `initial art transfer ${bytes} >3MiB`);
});
test("SOCIAL ENGINE release gate preserves all60 unabridged acceptance criteria", () => {
  const matrix = JSON.parse(readFileSync("artifacts/social-engine/results.json", "utf8"));
  const rows = Array.isArray(matrix) ? matrix : (matrix.tests ?? matrix.results ?? matrix.criteria);
  assert.ok(Array.isArray(rows), "matrix entries array");
  assert.equal(rows.length, 60);
  assert.equal(new Set(rows.map((r) => r.id)).size, 60);
  assert.equal(rows.filter((r) => r.priority === "P0").length, 38);
  assert.equal(rows.filter((r) => r.priority === "P1").length, 22);
});
