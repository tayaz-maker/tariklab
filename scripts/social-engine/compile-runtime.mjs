// Compile into memory so verification never mutates the candidate it is checking.
import { rolldown } from "rolldown";
import { transform } from "esbuild";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { sharedReplay } from "./shared-replay.mjs";
import { pixiRuntime } from "./pixi-runtime.mjs";

export async function compileStyles(root) {
  const source = await readFile(resolve(root, "src/games/social-engine/ui/styles.css"), "utf8");
  const { code } = await transform(source, { loader: "css", minify: true, target: "es2022" });
  return code;
}

export async function compileRuntime(
  root,
  atlas,
  input = {
    app: resolve(root, "src/games/social-engine/ui/app.ts"),
    worker: resolve(root, "src/games/social-engine/worker/entry.ts"),
  },
) {
  const bundle = await rolldown({
    input,
    platform: "browser",
    // The app's package declares sideEffects:false, but this adapter also registers
    // texture constructors with Pixi. Preserve its imports when following reexports.
    treeshake: {
      moduleSideEffects: [
        { test: /\/scripts\/social-engine\/pixi-entry\.mjs$/, sideEffects: true },
      ],
    },
    resolve: { alias: { "pixi.js": resolve(root, "scripts/social-engine/pixi-entry.mjs") } },
    transform: {
      target: "es2022",
      define: { SOCIAL_ATLAS_URL: JSON.stringify("/games/social-engine/" + atlas) },
    },
    plugins: [sharedReplay(root), pixiRuntime()],
  });
  try {
    const { output } = await bundle.generate({
      format: "esm",
      minify: true,
      comments: false,
      entryFileNames: "[name]-[hash].js",
      chunkFileNames: "chunk-[hash].js",
      manualChunks(id) {
        if (id.includes("/node_modules/pixi.js/")) return "pixi";
      },
    });
    return output;
  } finally {
    await bundle.close();
  }
}
