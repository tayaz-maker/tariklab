// Build the isolated JITEM runtime that TarikLab serves under
// /games/jitem-derin-ag/ from a checkout of tayaz-maker/jitem-derin-ag.
// Usage: node build-jitem-embed.mjs <jitem-checkout> <out-dir>
import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const [checkoutArg, outArg] = process.argv.slice(2);
if (!checkoutArg || !outArg) throw new Error("usage: build-jitem-embed.mjs <jitem-checkout> <out-dir>");
const checkout = resolve(checkoutArg);
const outDir = resolve(outArg);
const { build } = await import(pathToFileURL(join(checkout, "node_modules/vite/dist/node/index.js")).href);
const viteReact = (await import(pathToFileURL(join(checkout, "node_modules/@vitejs/plugin-react/dist/index.js")).href)).default;
const tailwindcss = (await import(pathToFileURL(join(checkout, "node_modules/@tailwindcss/vite/dist/index.mjs")).href)).default;

const entryDir = join(checkout, ".jitem-embed");
rmSync(entryDir, { recursive: true, force: true });
mkdirSync(entryDir, { recursive: true });
writeFileSync(join(entryDir, "index.html"),
  '<!doctype html><html lang="tr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>JITEM: Derin Ağ</title></head><body class="grain"><div id="root"></div><script type="module" src="./integration.tsx"></script></body></html>');
writeFileSync(join(entryDir, "integration.tsx"),
  'import { StrictMode } from "react";\nimport { createRoot } from "react-dom/client";\nimport { GameApp } from "@/components/game/GameApp";\nimport "@/styles.css";\n\ncreateRoot(document.getElementById("root")!).render(\n  <StrictMode>\n    <GameApp />\n  </StrictMode>,\n);\n');

try {
  await build({
    configFile: false,
    // Root is the checkout so Tailwind's automatic source detection sees src/.
    root: checkout,
    base: "/games/jitem-derin-ag/",
    publicDir: join(checkout, "public"),
    plugins: [viteReact(), tailwindcss()],
    resolve: { alias: { "@": join(checkout, "src") } },
    logLevel: "warn",
    build: {
      outDir,
      emptyOutDir: true,
      rollupOptions: {
        input: { integration: join(entryDir, "index.html") },
        output: { entryFileNames: "assets/runtime.js" },
      },
    },
  });
  // The HTML entry keeps its path relative to root; serve it as the index.
  renameSync(join(outDir, ".jitem-embed", "index.html"), join(outDir, "index.html"));
  rmSync(join(outDir, ".jitem-embed"), { recursive: true, force: true });
} finally {
  rmSync(entryDir, { recursive: true, force: true });
}
console.log("built", outDir);
