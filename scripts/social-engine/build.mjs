import { compileRuntime, compileStyles } from "./compile-runtime.mjs";
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
// Published revisions retain their own assets on Cloudflare; this checkout packages only its manifest.
const activeAtlasFiles = new Set(playableAssets.map((a) => a.file.slice("assets/".length)));
for (const name of await readdir(atlasRoot)) {
  if (
    /^(?:(?:buildings|people-props)-[a-f0-9]{12}\.png|atlas-[a-f0-9]{12}\.json)$/.test(name) &&
    !activeAtlasFiles.has(name)
  )
    await rm(resolve(atlasRoot, name));
}
const compiled = await compileRuntime(root, "assets/" + atlasName);
for (const chunk of compiled) await writeFile(resolve(out, chunk.fileName), chunk.code);
const workerFile = compiled.find((chunk) => chunk.isEntry && chunk.name === "worker")?.fileName,
  appFile = compiled.find((chunk) => chunk.isEntry && chunk.name === "app")?.fileName;
if (!workerFile || !appFile) throw new Error("Missing explicit app/worker output");
const css = await compileStyles(root);
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
