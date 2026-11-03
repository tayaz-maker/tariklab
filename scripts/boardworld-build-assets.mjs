/** Production-only packing. Readable game sources and public module URLs stay intact. */
import { mkdir, readFile, readdir, writeFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";
import { transform } from "esbuild";

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
  return {
    assets,
    rawBytes: assets.reduce((sum, a) => sum + a.bytes, 0),
    gzipBytes: assets.reduce((sum, a) => sum + a.gzipBytes, 0),
    initialTrGzipBytes: assets
      .filter((a) => !a.file.startsWith("locale-"))
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
    (
      await transform(styles.map((file) => source.get(file)).join("\n"), {
        ...options,
        loader: "css",
      })
    ).code,
  );
  for (const file of styles.slice(1)) {
    // Keep established asset URLs for older probes/bookmarks; the production HTML
    // requests the combined sheet once. Original cascade order is unchanged.
    packed.set(file, "/* Included in style.css. */\n");
    html = html.replace(
      new RegExp(`\\s*<link rel="stylesheet" href="\\./${file.replace(".", "\\.")}"\\s*/>`),
      "",
    );
  }
  packed.set("index.html", html);
  locales.forEach((file, index) =>
    packed.set(file, `export default ${JSON.stringify(catalog[index])};\n`),
  );
  await mkdir(targetDir, { recursive: true });
  await Promise.all([...packed].map(([file, text]) => writeFile(resolve(targetDir, file), text)));
  const after = await assetMetrics(targetDir);
  return {
    sourceDir: resolve(sourceDir),
    targetDir: resolve(targetDir),
    before,
    after,
    localeEntries: keys.length,
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
