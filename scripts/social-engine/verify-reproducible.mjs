// Rebuild into memory: running tests keep serving an immutable on-disk candidate.
import { build } from "esbuild";
import { readFile, writeFile } from "node:fs/promises";
import { resolve, basename } from "node:path";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const hash = (data) => createHash("sha256").update(data).digest("hex");
const dir = "public/games/social-engine";
const rawManifest = await readFile(`${dir}/build-manifest.json`);
const manifest = JSON.parse(rawManifest);
const atlas = manifest.playableAssets.find((a) => a.file.endsWith(".json"));
const rebuilt = await build({
  bundle: true,
  format: "esm",
  target: "es2022",
  minify: true,
  metafile: true,
  alias: { "pixi.js": resolve("scripts/social-engine/pixi-entry.mjs") },
  outdir: resolve(dir),
  entryNames: "[name]-[hash]",
  chunkNames: "chunk-[hash]",
  legalComments: "none",
  logLevel: "warning",
  splitting: true,
  write: false,
  entryPoints: {
    app: resolve("src/games/social-engine/ui/app.ts"),
    worker: resolve("src/games/social-engine/worker/entry.ts"),
  },
  define: { SOCIAL_ATLAS_URL: JSON.stringify("/games/social-engine/" + atlas.file) },
});
const files = [];
for (const file of rebuilt.outputFiles) {
  const name = basename(file.path),
    expected = manifest.assets.find((a) => a.file === name);
  assert.ok(expected, `Rebuilt output ${name} is absent from the current manifest`);
  assert.equal(hash(file.contents), expected.sha256);
  assert.equal(hash(await readFile(file.path)), expected.sha256);
  files.push({ file: name, sha256: expected.sha256, bytes: file.contents.length });
}
assert.equal(files.length, manifest.assets.filter((a) => a.file.endsWith(".js")).length);
const css = await readFile("src/games/social-engine/ui/styles.css");
const cssFile = `styles-${hash(css).slice(0, 12)}.css`;
assert.equal(hash(await readFile(`${dir}/${cssFile}`)), hash(css));
const html = (await readFile("src/games/social-engine/ui/index.html", "utf8"))
  .replace("./app.js", "./" + manifest.entry)
  .replace("./styles.css", "./" + cssFile)
  .replace("./worker.js", "./" + manifest.worker);
assert.equal(hash(await readFile(`${dir}/index.html`)), hash(html));
for (const asset of manifest.playableAssets)
  assert.equal(hash(await readFile(`${dir}/${asset.file}`)), asset.sha256);
assert.deepEqual(await readFile(`${dir}/build-manifest.json`), rawManifest);
const report = {
  status: "PASS",
  checkedAt: new Date().toISOString(),
  manifestSha256: hash(rawManifest),
  sourceDigest: manifest.sourceDigest,
  files,
  scope:
    "Independent in-memory compilation reproduces every emitted JS byte/name, authored CSS/HTML and shipped atlas assets. No served files were changed. Full-site build and provider deployment are separate gates.",
};
await writeFile(
  "artifacts/social-engine/baseline/reproducible-build.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    status: report.status,
    javascriptFiles: files.length,
    manifestSha256: report.manifestSha256,
  }),
);
