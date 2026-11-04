// Real WebGL teardown ownership check; test-only instrumentation never ships in gameplay.
import { build } from "esbuild";
import { chromium } from "playwright";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const base = process.env.SE_BASE || "http://127.0.0.1:8097";
const out = "artifacts/social-engine/renderer-lifecycle";
await mkdir(out, { recursive: true });
const manifest = JSON.parse(await readFile("public/games/social-engine/build-manifest.json"));
const rendererSource = await readFile("src/games/social-engine/rendering/renderer.ts");
const hash = (b) => createHash("sha256").update(b).digest("hex");
const code = (
  await build({
    stdin: {
      contents:
        "export {createRenderer} from './src/games/social-engine/rendering/renderer.ts'; export {Cache} from './node_modules/pixi.js/lib/assets/cache/Cache.mjs'; export {createWorld,projectWorld} from './src/games/social-engine/simulation/engine.ts';",
      resolveDir: process.cwd(),
      loader: "ts",
    },
    bundle: true,
    format: "iife",
    globalName: "RendererLifecycle",
    target: "es2022",
    write: false,
    alias: { "pixi.js": resolve("scripts/social-engine/pixi-entry.mjs") },
    define: {
      SOCIAL_ATLAS_URL: JSON.stringify(
        "/games/social-engine/" +
          manifest.playableAssets.find((a) => a.file.endsWith(".json")).file,
      ),
    },
  })
).outputFiles[0].text;
const report = {
  status: "RUNNING",
  startedAt: new Date().toISOString(),
  headless: true,
  rendererSourceSha256: hash(rendererSource),
  probeSha256: hash(code),
  errors: [],
  cycles: [],
};
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    ...(process.platform === "darwin"
      ? {
          executablePath:
            process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        }
      : {}),
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("pageerror", (e) => report.errors.push(e.message));
  await page.route("**/__renderer_lifecycle__", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html><body style="margin:0"><div id="world" style="width:1280px;height:720px"></div></body></html>',
    }),
  );
  await page.goto(base + "/__renderer_lifecycle__");
  await page.addScriptTag({ content: code });
  const results = await page.evaluate(async () => {
    const { createRenderer, createWorld, projectWorld, Cache } = window.RendererLifecycle;
    const baseline = { entries: Cache._cache.size, aliases: Cache._cacheMap.size };
    const world = createWorld(20261103),
      host = document.getElementById("world"),
      cycles = [];
    for (let i = 0; i < 5; i++) {
      const renderer = await createRenderer(host, () => {});
      renderer.render(projectWorld(world));
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const during = { entries: Cache._cache.size, aliases: Cache._cacheMap.size };
      renderer.destroy();
      renderer.destroy();
      await new Promise((r) => setTimeout(r, 50));
      cycles.push({
        cycle: i + 1,
        during,
        after: {
          entries: Cache._cache.size,
          aliases: Cache._cacheMap.size,
          canvases: host.querySelectorAll("canvas").length,
        },
      });
    }
    return { baseline, cycles };
  });
  Object.assign(report, results);
  for (const c of results.cycles) {
    assert.equal(c.after.canvases, 0, "Disposed renderer leaves no canvas");
    assert.equal(
      c.after.entries,
      results.baseline.entries,
      "Disposed renderer releases all owned cached atlas textures",
    );
    assert.equal(
      c.after.aliases,
      results.baseline.aliases,
      "Disposed renderer releases all owned resource aliases",
    );
  }
  assert.deepEqual(report.errors, []);
  report.status = "PASS";
} catch (e) {
  report.status = "FAIL";
  report.reason = e.message;
  process.exitCode = 1;
} finally {
  await browser?.close();
  report.finishedAt = new Date().toISOString();
  await writeFile(out + "/results.json", JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report));
}
