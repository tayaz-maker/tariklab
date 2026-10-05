import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { createHash } from "node:crypto";
const root = resolve(process.argv[2] || "public/atlas/3d");
const hash = (b) => createHash("sha256").update(b).digest("hex");
async function walk(dir) {
  const paths = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.isSymbolicLink()) throw Error("No symlinks");
    if (e.isDirectory()) paths.push(...(await walk(resolve(dir, e.name))));
    else paths.push(resolve(dir, e.name));
  }
  return paths;
}
const files = [];
for (const path of (await walk(root)).sort()) {
  const name = relative(root, path);
  if (["sw.js", "offline-manifest.json", ".gitignore"].includes(name)) continue;
  const bytes = await readFile(path);
  files.push({ path: name, bytes: bytes.length, sha256: hash(bytes) });
}
const total = files.reduce((a, f) => a + f.bytes, 0);
if (total > 8 * 1024 * 1024) throw Error("8 MiB offline budget exceeded");
const template = await readFile(new URL("../public/atlas/3d/sw.js", import.meta.url), "utf8");
// Generated worker template stored separately after first invocation for reproducibility.
const templatePath = new URL("./atlas-3d-sw-template.txt", import.meta.url);
let source;
try {
  source = await readFile(templatePath, "utf8");
} catch {
  source = template;
  await writeFile(templatePath, source);
}
const version = hash(JSON.stringify(files) + source).slice(0, 24);
await writeFile(
  resolve(root, "sw.js"),
  source.replace("__VERSION__", version).replace("__FILES__", JSON.stringify(files)),
);
await writeFile(
  resolve(root, "offline-manifest.json"),
  JSON.stringify({ version, bytes: total, files }, null, 2) + "\n",
);
console.log(JSON.stringify({ version, bytes: total, files: files.length }));
