import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
const repo = fileURLToPath(new URL("../", import.meta.url));
const digest = (b) => createHash("sha256").update(b).digest("hex");
// Small repository chunks are joined at build time, never in the browser.
export function restoreAtlas3dAssets() {
  const source = resolve(repo, "assets/atlas-3d");
  const entries = JSON.parse(readFileSync(resolve(source, "manifest.json"), "utf8"));
  for (const entry of entries) {
    const chunks = entry.parts.map((part) => {
      if (!/^[\w.-]+$/.test(part.file)) throw Error("Invalid atlas chunk path");
      const data = readFileSync(resolve(source, part.file));
      if (digest(data) !== part.sha256) throw Error(`Atlas chunk integrity: ${part.file}`);
      return data;
    });
    const packed = Buffer.concat(chunks);
    const data = entry.encoding === "gzip" ? gunzipSync(packed) : packed;
    if (data.length !== entry.bytes || digest(data) !== entry.sha256)
      throw Error(`Atlas asset integrity: ${entry.path}`);
    if (!/^(models|vendor)\/[\w.-]+$/.test(entry.path)) throw Error("Invalid atlas asset path");
    const target = resolve(repo, "public/atlas/3d", entry.path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, data);
  }
}
export function atlas3dAssetsPlugin() {
  return {
    name: "atlas-3d-assets",
    configResolved() {
      restoreAtlas3dAssets();
    },
  };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  restoreAtlas3dAssets();
