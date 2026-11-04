// Compile into memory so verification never mutates the candidate it is checking.
import { rolldown } from "rolldown";
import { resolve } from "node:path";
import { sharedReplay } from "./shared-replay.mjs";

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
    plugins: [sharedReplay(root)],
  });
  try {
    const { output } = await bundle.generate({
      format: "esm",
      minify: true,
      comments: false,
      entryFileNames: "[name]-[hash].js",
      chunkFileNames: "chunk-[hash].js",
    });
    return output;
  } finally {
    await bundle.close();
  }
}
