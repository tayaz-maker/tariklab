import { gzipSync } from "node:zlib";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
// Lossless source packaging; generated WebP outputs are served directly by the asset server.
mkdirSync("scripts/duel-art-packs", { recursive: true });
for (const theme of ["veto-h", "gett-oh"].filter(
  (t) => !process.argv[2] || t === process.argv[2],
)) {
  const source = JSON.parse(readFileSync(`public/games/${theme}/source-cards.json`, "utf8"));
  const paths = source.map((c) => `public/games/${theme}/assets/cards/${c.id}.webp`);
  paths.push(`public/games/${theme}/assets/atmosphere.webp`);
  for (let i = 0; i < paths.length; i += 12) {
    const assets = paths.slice(i, i + 12).map((path) => {
      const bytes = readFileSync(path);
      return {
        path,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        base64: bytes.toString("base64"),
      };
    });
    writeFileSync(
      `scripts/duel-art-packs/${theme}-${String(i / 12 + 1).padStart(2, "0")}.json.gz`,
      gzipSync(JSON.stringify({ version: 1, assets }) + "\n", { level: 9 }),
    );
  }
}
