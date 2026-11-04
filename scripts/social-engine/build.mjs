import { build } from "esbuild";
import { readFile, writeFile, mkdir, readdir, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { resolve, relative } from "node:path";
const root = resolve(import.meta.dirname, "../..");
const out = resolve(root, "public/games/social-engine");
await mkdir(out, { recursive: true });
// Only this game's generated root files; authored assets subdirectory is untouched.
for (const name of await readdir(out))
  if (/^(app|worker|chunk|styles)-[\w-]+\.(js|css)(\.map)?$/.test(name))
    await rm(resolve(out, name));
const atlasRoot = resolve(out, "assets");
const atlas = JSON.parse(await readFile(resolve(atlasRoot, "atlas.json"), "utf8"));
const playableAssets = [];
for (const key of ["buildings", "actors"]) {
  const original = atlas[key].image;
  const bytes = await readFile(resolve(atlasRoot, original));
  const hash = createHash("sha256").update(bytes).digest("hex");
  const name = original.replace(/\.png$/, "-" + hash.slice(0, 12) + ".png");
  await writeFile(resolve(atlasRoot, name), bytes);
  atlas[key].image = name;
  playableAssets.push({ file: "assets/" + name, bytes: bytes.length, sha256: hash });
}
const atlasBytes = Buffer.from(JSON.stringify(atlas));
const atlasHash = createHash("sha256").update(atlasBytes).digest("hex");
const atlasName = "atlas-" + atlasHash.slice(0, 12) + ".json";
await writeFile(resolve(atlasRoot, atlasName), atlasBytes);
playableAssets.push({ file: "assets/" + atlasName, bytes: atlasBytes.length, sha256: atlasHash });
const opts = {
  bundle: true,
  format: "esm",
  target: "es2022",
  minify: true,
  metafile: true,
  alias: { "pixi.js": resolve(root, "scripts/social-engine/pixi-entry.mjs") },
  outdir: out,
  entryNames: "[name]-[hash]",
  chunkNames: "chunk-[hash]",
  legalComments: "none",
  logLevel: "warning",
};
const compiled = await build({
  ...opts,
  splitting: true,
  entryPoints: {
    app: resolve(root, "src/games/social-engine/ui/app.ts"),
    worker: resolve(root, "src/games/social-engine/worker/entry.ts"),
  },
  define: { SOCIAL_ATLAS_URL: JSON.stringify("/games/social-engine/assets/" + atlasName) },
});
const outputFor = (suffix) =>
  Object.keys(compiled.metafile.outputs)
    .find((k) => compiled.metafile.outputs[k].entryPoint?.endsWith(suffix))
    ?.split("/")
    .at(-1);
const workerFile = outputFor("/worker/entry.ts"),
  appFile = outputFor("/ui/app.ts");
if (!workerFile || !appFile) throw new Error("Missing explicit app/worker output");
const css = await readFile(resolve(root, "src/games/social-engine/ui/styles.css"));
const cssFile = `styles-${createHash("sha256").update(css).digest("hex").slice(0, 12)}.css`;
await writeFile(resolve(out, cssFile), css);
let html = await readFile(resolve(root, "src/games/social-engine/ui/index.html"), "utf8");
html = html
  .replace("./app.js", "./" + appFile)
  .replace("./styles.css", "./" + cssFile)
  .replace("./worker.js", "./" + workerFile);
await writeFile(resolve(out, "index.html"), html);
const assets = [];
for (const name of (await readdir(out)).sort()) {
  if (!/\.(js|css|html)$/.test(name)) continue;
  const bytes = await readFile(resolve(out, name));
  assets.push({
    file: name,
    bytes: bytes.length,
    gzipBytes: gzipSync(bytes).length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
}
const sourceHasher = createHash("sha256");
async function hashSources(dir) {
  for (const item of (await readdir(dir, { withFileTypes: true })).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    if (item.name === "tests" || item.name === "fixtures") continue;
    const path = resolve(dir, item.name);
    if (item.isDirectory()) await hashSources(path);
    else {
      sourceHasher.update(relative(root, path) + "\0");
      sourceHasher.update(await readFile(path));
    }
  }
}
await hashSources(resolve(root, "src/games/social-engine"));
sourceHasher.update(await readFile(resolve(root, "package-lock.json")));
const report = {
  version: 1,
  sourceDigest: sourceHasher.digest("hex"),
  playableAssets,
  initialPlayableBytes:
    playableAssets.reduce((n, a) => n + a.bytes, 0) + assets.reduce((n, a) => n + a.gzipBytes, 0),
  assets,
  totalGzipBytes: assets.reduce((a, b) => a + b.gzipBytes, 0),
  worker: workerFile,
  entry: appFile,
};
await writeFile(resolve(out, "build-manifest.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
