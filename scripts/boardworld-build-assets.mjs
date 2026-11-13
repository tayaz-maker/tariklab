/** Production-only packing. Readable game sources and public module URLs stay intact. */
import { mkdir, readFile, readdir, writeFile, stat, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";
import { transform } from "esbuild";
import { transform as transformCss } from "lightningcss";
import { packModules } from "./boardworld-pack-modules.mjs";

const gamePath = "games/tc-sim-boardworld";
const styles = ["style.css", "deep.css", "living.css", "emergent.css", "society.css"];
const locales = ["locale-keys.mjs", "locale-en.mjs", "locale-pl.mjs"];
const isAsset = (name) => /\.(mjs|css|html|svg)$/.test(name);
const options = { minify: true, charset: "utf8", target: "es2022", legalComments: "none" };

export async function assetMetrics(directory) {
  const files = (await readdir(directory)).filter(isAsset).sort();
  const assets = await Promise.all(
    files.map(async (file) => {
      const bytes = await readFile(resolve(directory, file));
      return { file, bytes: bytes.length, gzipBytes: gzipSync(bytes).length };
    }),
  );
  const expansion = assets.filter((a) => a.file.startsWith("expansion") && a.file.endsWith(".mjs"));
  const expansionGzipBytes = expansion.reduce((sum, a) => sum + a.gzipBytes, 0);
  return {
    assets,
    expansionGzipBytes,
    goldGzipBytes: assets.reduce((sum, a) => sum + a.gzipBytes, 0) - expansionGzipBytes,
    rawBytes: assets.reduce((sum, a) => sum + a.bytes, 0),
    gzipBytes: assets.reduce((sum, a) => sum + a.gzipBytes, 0),
    initialTrGzipBytes: assets
      .filter((a) => !a.file.startsWith("locale-") && !a.file.startsWith("expansion"))
      .reduce((sum, a) => sum + a.gzipBytes, 0),
  };
}

export async function packGameAssets({ sourceDir = resolve("public", gamePath), targetDir } = {}) {
  if (!targetDir || resolve(sourceDir) === resolve(targetDir))
    throw new Error(
      "A separate production output directory is required; source assets are never overwritten.",
    );
  const before = await assetMetrics(sourceDir);
  const source = new Map(
    await Promise.all(
      before.assets.map(async ({ file }) => [
        file,
        await readFile(resolve(sourceDir, file), "utf8"),
      ]),
    ),
  );
  let html = source.get("index.html");
  for (const file of styles) {
    if (!html.includes(`href="./${file}"`)) throw new Error(`Missing ordered stylesheet: ${file}`);
    if (/@import|@charset/i.test(source.get(file)))
      throw new Error(`External CSS import needs an explicit packing rule: ${file}`);
  }
  const catalog = await Promise.all(
    locales.map(async (file) => {
      const path = resolve(sourceDir, file),
        info = await stat(path);
      return (await import(`${pathToFileURL(path).href}?packed=${info.mtimeMs}`)).default;
    }),
  );
  const [keys, en, pl] = catalog;
  if (new Set(keys).size !== keys.length || en.length !== keys.length || pl.length !== keys.length)
    throw new Error("Locale arrays must be unique and aligned before packing.");
  // Keep every index stable: an already-open older tab may hold its key module
  // while lazily requesting another language after a deployment. Reordering
  // would silently pair the old keys with the wrong new translations.
  const packed = new Map();
  for (const [file, text] of source) {
    if (styles.includes(file) || locales.includes(file) || file === "index.html") continue;
    packed.set(
      file,
      file.endsWith(".mjs") ? (await transform(text, { ...options, loader: "js" })).code : text,
    );
  }
  packed.set(
    "style.css",
    transformCss({
      filename: "style.css",
      code: Buffer.from(styles.map((file) => source.get(file)).join("\n")),
      minify: true,
    }).code.toString(),
  );
  for (const file of styles.slice(1)) {
    // Keep established asset URLs for older probes/bookmarks; the production HTML
    // requests the combined sheet once. Original cascade order is unchanged.
    packed.set(file, "");
    html = html.replace(
      new RegExp(`\\s*<link rel="stylesheet" href="\\./${file.replace(".", "\\.")}"\\s*/>`),
      "",
    );
  }
  // This fixed bootstrap has no preformatted content or inline script/style.
  // Keep textual separators while dropping formatting-only tag whitespace.
  if (/<(?:pre|textarea|style)\b|<script(?![^>]*\bsrc=)/i.test(html))
    throw new Error("Inline/preformatted bootstrap needs a dedicated HTML packing rule.");
  packed.set("index.html", html.replace(/\n\s*/g, " ").replace(/>\s+</g, "><").trim());
  locales.forEach((file, index) => {
    const entries = catalog[index];
    // Delimiter encoding preserves array order and values while avoiding JSON
    // punctuation; fall back when a translation contains the delimiter.
    const expression = index > 0 && entries.length > 0 && entries.every((entry) => typeof entry === "string" && !entry.includes("|"))
      ? `${JSON.stringify(entries.join("|"))}.split("|")`
      : JSON.stringify(entries);
    packed.set(file, `export default ${expression};\n`);
  });
  const modules = await packModules(packed, keys);
  await mkdir(targetDir, { recursive: true });
  for (const file of await readdir(targetDir))
    if (/^bw-runtime-[a-f0-9]{16}\.mjs$/.test(file) && !packed.has(file))
      await unlink(resolve(targetDir, file));
  await Promise.all([...packed].map(([file, text]) => writeFile(resolve(targetDir, file), text)));
  const after = await assetMetrics(targetDir);
  return {
    sourceDir: resolve(sourceDir),
    targetDir: resolve(targetDir),
    before,
    after,
    localeEntries: keys.length,
    modules,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2),
    index = args.indexOf("--root");
  if (index < 0 || !args[index + 1])
    throw new Error("Usage: node scripts/boardworld-build-assets.mjs --root .output/public");
  console.log(
    JSON.stringify(
      await packGameAssets({ targetDir: resolve(args[index + 1], gamePath) }),
      null,
      2,
    ),
  );
}
