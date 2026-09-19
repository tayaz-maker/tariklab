/**
 * Client build'da hashed /assets/* listesini SW precache'ine yazar.
 * public/sw.js runtime cache ile de çalışır; bu plugin ilk ziyareti güçlendirir.
 */
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SW_PATH = join(ROOT, "public/sw.js");
const BUILD_ASSETS_MARKER = "/* TARIKLAB_BUILD_ASSETS */ []";

export function injectBuildAssets(source, assets) {
  if (source.split(BUILD_ASSETS_MARKER).length !== 2) {
    throw new Error("Offline service worker must contain exactly one build-assets marker");
  }
  return source.replace(BUILD_ASSETS_MARKER, () => JSON.stringify(assets));
}

export function versionGameWorker(source, files) {
  const marker = '/* HANEDANIAN_BUILD_VERSION */ "hanedanian-package-dev-1"';
  if (source.split(marker).length !== 2)
    throw new Error("HANEDANIAN worker needs one version marker");
  const hash = createHash("sha256");
  for (const [name, bytes] of Object.entries(files).sort(([a], [b]) => a.localeCompare(b))) {
    hash.update(name);
    hash.update("\0");
    hash.update(bytes);
    hash.update("\0");
  }
  hash.update(source);
  return source.replace(
    marker,
    JSON.stringify(`hanedanian-package-${hash.digest("hex").slice(0, 16)}`),
  );
}

export function offlineSwPlugin() {
  return {
    name: "cete-offline-sw",
    apply: "build",
    generateBundle(_opts, bundle) {
      const envName = this.environment?.name;
      if (envName && envName !== "client") return;
      const names = Object.keys(bundle);
      if (names.some((n) => n.includes("_ssr") || n.endsWith(".mjs"))) return;
      const assets = names
        .filter((n) => !n.endsWith(".map"))
        .filter((n) => /\.(js|css|svg|png|webmanifest)$/.test(n))
        .map((n) => `/${n.replace(/^\/+/, "")}`);
      const source = injectBuildAssets(readFileSync(SW_PATH, "utf8"), assets);
      this.emitFile({ type: "asset", fileName: "sw.js", source });
      const gameDir = join(ROOT, "public/games/hanedanian");
      const files = Object.fromEntries(
        readdirSync(gameDir)
          .filter((name) => name !== "sw.js")
          .map((name) => [name, readFileSync(join(gameDir, name))]),
      );
      const gameWorker = versionGameWorker(readFileSync(join(gameDir, "sw.js"), "utf8"), files);
      this.emitFile({ type: "asset", fileName: "games/hanedanian/sw.js", source: gameWorker });
    },
  };
}
