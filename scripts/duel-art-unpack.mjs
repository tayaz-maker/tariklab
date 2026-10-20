import { gunzipSync } from "node:zlib";
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
// Repository transport only. Browsers receive ordinary individual WebP files;
// they never download or decode these source packs.
const folder = "scripts/duel-art-packs";
if (existsSync(folder))
  for (const file of readdirSync(folder)
    .filter((n) => n.endsWith(".json.gz"))
    .sort()) {
    const pack = JSON.parse(gunzipSync(readFileSync(`${folder}/${file}`)).toString("utf8"));
    for (const art of pack.assets) {
      if (
        !/^public\/games\/(veto-h|gett-oh)\/assets\/(cards\/(SND|RCN)-\d{3}|atmosphere)\.webp$/.test(
          art.path,
        )
      )
        throw Error(`Invalid art output: ${art.path}`);
      const bytes = Buffer.from(art.base64, "base64");
      const hash = createHash("sha256").update(bytes).digest("hex");
      if (hash !== art.sha256) throw Error(`Corrupt art pack: ${art.path}`);
      const path = resolve(art.path);
      if (
        existsSync(path) &&
        createHash("sha256").update(readFileSync(path)).digest("hex") === hash
      )
        continue;
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, bytes);
    }
  }
