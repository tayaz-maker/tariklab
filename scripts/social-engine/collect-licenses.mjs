// Build-input provenance for the isolated static renderer; does not rewrite runtime assets.
import { build } from "esbuild";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const compiled = await build({
  entryPoints: ["src/games/social-engine/ui/app.ts", "src/games/social-engine/worker/entry.ts"],
  bundle: true,
  format: "esm",
  splitting: true,
  outdir: "unused",
  write: false,
  metafile: true,
  target: "es2022",
  alias: { "pixi.js": resolve("scripts/social-engine/pixi-entry.mjs") },
  define: { SOCIAL_ATLAS_URL: JSON.stringify("/unused-atlas") },
});
const names = [
  ...new Set(
    Object.keys(compiled.metafile.inputs)
      .filter((p) => p.startsWith("node_modules/"))
      .map((p) =>
        p
          .split("/")
          .slice(1, p.split("/")[1].startsWith("@") ? 3 : 2)
          .join("/"),
      ),
  ),
].sort();
const packages = [];
const notices = [
  "SOCIAL ENGINE — bundled third-party runtime notices",
  "",
  "Playable artwork and game logic provenance: docs/social-engine/ASSET_LICENSES.md.",
  "The following unmodified dependency notices apply to bundled library code.",
  "",
];
for (const name of names) {
  const pkg = JSON.parse(await readFile(`node_modules/${name}/package.json`, "utf8"));
  const licensePath =
    name === "@pixi/colord"
      ? "scripts/social-engine/licenses/colord-MIT.txt"
      : `node_modules/${name}/LICENSE`;
  const license = await readFile(licensePath, "utf8");
  if (!license.trim()) throw new Error(`Missing license notice for ${name}`);
  const upstream =
    name === "@pixi/colord"
      ? JSON.parse(await readFile("scripts/social-engine/licenses/colord-source.json", "utf8"))
      : null;
  packages.push({
    name,
    version: pkg.version,
    license: pkg.license,
    licensePath,
    licenseSha256: sha256(license),
    upstream,
  });
  notices.push(
    `${name}@${pkg.version} (${pkg.license})`,
    "",
    license.trim(),
    "",
    "----------------------------------------",
    "",
  );
}
const output = notices.join("\n");
await mkdir("public/games/social-engine", { recursive: true });
await writeFile("public/games/social-engine/THIRD_PARTY_LICENSES.txt", output);
await writeFile(
  "artifacts/social-engine/runtime-dependency-licenses.json",
  JSON.stringify(
    {
      packages,
      file: "public/games/social-engine/THIRD_PARTY_LICENSES.txt",
      bytes: Buffer.byteLength(output),
      sha256: sha256(output),
      bundledPackageCount: packages.length,
    },
    null,
    2,
  ) + "\n",
);
console.log(JSON.stringify({ packages: names, noticeBytes: Buffer.byteLength(output) }));
