// Windowless, isolated visual-motion evidence. Never writes the shipped runtime.
// Synthetic crowd fixtures alter the presentation projection only, not the simulation.
import { build } from "esbuild";
import { chromium } from "playwright";
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
const root = process.cwd(),
  temp = path.resolve("node_modules/.cache/terra-motion"),
  out = path.resolve("screenshots/terra-motion");
await mkdir(`${temp}/games/social-engine/assets`, { recursive: true });
await mkdir(out, { recursive: true });
for (const name of ["atlas.json", "buildings.png", "people-props.png"])
  await copyFile(
    `public/games/social-engine/assets/${name}`,
    `${temp}/games/social-engine/assets/${name}`,
  );
for (const name of ["index.html", "styles.css"])
  await copyFile(`src/games/social-engine/ui/${name}`, `${temp}/games/social-engine/${name}`);
const renderer = path.resolve("src/games/social-engine/rendering/renderer.ts");
const marker = "    if (!initialized) {\n      camera = { ...focus };";
await build({
  entryPoints: {
    app: "src/games/social-engine/ui/app.ts",
    worker: "src/games/social-engine/worker/entry.ts",
  },
  outdir: `${temp}/games/social-engine`,
  bundle: true,
  format: "esm",
  splitting: true,
  target: "es2022",
  alias: { "pixi.js": path.resolve("scripts/social-engine/pixi-entry.mjs") },
  define: { SOCIAL_ATLAS_URL: JSON.stringify("/games/social-engine/assets/atlas.json") },
  plugins: [
    {
      name: "observe-renderer",
      setup(b) {
        b.onLoad({ filter: /rendering\/renderer\.ts$/ }, async (a) => {
          let s = await readFile(a.path, "utf8");
          if (!s.includes(marker)) throw Error("Renderer instrumentation marker missing");
          s = s.replace(
            "    current = projection;",
            `    if ((window as any).__terraFixtureCount) {
      const count = (window as any).__terraFixtureCount as number;
      const base = projection.npcs.find(p => p.alive);
      if (base) projection = { ...projection, visualAgentLimit: count, npcs: Array.from({length:count}, (_, i) => ({ ...base, id: 'fixture-' + i, appearance: i % 8, goal: 'walk' as const, location: { ...projection.player.location, x: projection.player.location.x + ((i % 10) - 4.5) * 0.8 + Math.sin(performance.now()/1000 + i * .3) * .25, y: projection.player.location.y + (Math.floor(i / 10) - count / 20) * .8 } })) };
    }
    current = projection;`,
          );
          s = s.replace(
            marker,
            `    (window as any).__terraRender = { actors: [...actors].map(([id, v]) => ({id, x:v.sprite.x, y:v.sprite.y, visible:v.sprite.visible && v.sprite.renderable, frame:[...paintedVehicles].find(([name,t]) => t === v.sprite.texture)?.[0].split(":")[0] ?? null})), camera:{x:world.x,y:world.y,zoom} };\n` +
              marker,
          );
          return { contents: s, loader: "ts", resolveDir: path.dirname(renderer) };
        });
      },
    },
  ],
});
const server = spawn(
  "python3",
  ["-m", "http.server", "8232", "--bind", "127.0.0.1", "--directory", temp],
  { stdio: "ignore" },
);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
});
const results = process.env.SE_SKIP_TRAFFIC
  ? JSON.parse(await readFile(`${out}/results-first-fixture-failed.json`, "utf8"))
  : {
      kind: "instrumented branch build; live simulation sample followed by presentation-only synthetic crowds",
      sourceSha: process.env.SE_SOURCE_SHA || null,
      assets: {},
      traffic: {
        samples: 0,
        comparable: 0,
        forward: 0,
        backward: 0,
        axisAligned: 0,
        axisMisaligned: 0,
        distinctVehicles: [],
        frameCounts: {},
        examples: [],
        anomalies: [],
      },
      crowds: [],
      errors: [],
    };
for (const n of ["atlas.json", "people-props.png", "buildings.png"])
  results.assets[n] = createHash("sha256")
    .update(await readFile(`public/games/social-engine/assets/${n}`))
    .digest("hex");
async function setup() {
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    recordVideo: { dir: out, size: { width: 1366, height: 768 } },
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => results.errors.push(e.message));
  await page.goto("http://127.0.0.1:8232/games/social-engine/index.html?qa=1");
  await page.locator("[name=name]").fill("Deniz QA");
  await page.getByRole("button", { name: "Hikâyene başla" }).click();
  await page.waitForFunction(() => window.__socialEngine?.projection()?.population === 1100);
  return { context, page };
}
try {
  await new Promise((r) => setTimeout(r, 500));
  let context, page, video;
  if (!process.env.SE_SKIP_TRAFFIC) {
    ({ context, page } = await setup());
    // Real game command: navigate toward the intersection; no forced placement or clock stepping.
    const move = await page.evaluate(() =>
      window.__socialEngine.command("MOVE_TO", { x: 18, y: 18 }),
    );
    results.traffic.moveCommand = move;
    const seen = new Set(),
      previous = new Map(),
      start = Date.now();
    while (Date.now() - start < 60000) {
      const sample = await page.evaluate(() => ({
        t: performance.now(),
        projection: window.__socialEngine.projection(),
        render: window.__terraRender,
      }));
      if (sample.render) {
        for (const a of sample.render.actors) {
          if (!a.frame || !a.visible) continue;
          seen.add(a.id);
          results.traffic.frameCounts[a.frame] = (results.traffic.frameCounts[a.frame] || 0) + 1;
          let prev = previous.get(a.id);
          previous.set(a.id, { ...a, t: sample.t });
          if (!prev || prev.frame !== a.frame) continue;
          const dx = a.x - prev.x,
            dy = a.y - prev.y,
            dist = Math.hypot(dx, dy);
          if (dist < 0.5 || dist > 30) continue;
          const angle = (Number(a.frame.split("-").at(-1)) * Math.PI) / 4,
            axis = [
              (Math.cos(angle) - Math.sin(angle)) * 24,
              (Math.cos(angle) + Math.sin(angle)) * 12,
            ],
            dot = (dx * axis[0] + dy * axis[1]) / (dist * Math.hypot(...axis));
          results.traffic.comparable++;
          if (dot >= 0) results.traffic.forward++;
          else results.traffic.backward++;
          if (Math.abs(dot) >= Math.cos((32 * Math.PI) / 180)) results.traffic.axisAligned++;
          else results.traffic.axisMisaligned++;
          if (results.traffic.examples.length < 12)
            results.traffic.examples.push({ id: a.id, frame: a.frame, dx, dy, dot });
          if (Math.abs(dot) < Math.cos((32 * Math.PI) / 180) || dot < 0)
            results.traffic.anomalies.push({ id: a.id, frame: a.frame, dx, dy, dot });
        }
      }
      results.traffic.samples++;
      await page.waitForTimeout(200);
    }
    results.traffic.durationMs = Date.now() - start;
    results.traffic.distinctVehicles = [...seen];
    results.traffic.finalMetrics = await page.evaluate(
      () => window.__socialEngine.metrics().renderer,
    );
    await page.screenshot({ path: `${out}/traffic-final.png` });
    video = page.video();
    await context.close();
    await video.saveAs(`${out}/traffic-live-60s.webm`);
  }
  results.crowds = [];
  for (const count of [30, 100]) {
    ({ context, page } = await setup());
    await page.evaluate((count) => {
      window.__terraFixtureCount = count;
    }, count);
    const observed = [];
    for (let i = 0; i < 40; i++) {
      await page.waitForTimeout(250);
      observed.push(
        await page.evaluate(() => ({
          projection: window.__socialEngine.projection()?.npcs?.length,
          visible: window.__terraRender?.actors.filter(
            (a) => a.id.startsWith("fixture-") && a.visible,
          ).length,
          metrics: window.__socialEngine.metrics().renderer,
        })),
      );
    }
    await page.screenshot({ path: `${out}/crowd-synthetic-${count}.png` });
    video = page.video();
    await context.close();
    await video.saveAs(`${out}/crowd-synthetic-${count}.webm`);
    results.crowds.push({
      requested: count,
      synthetic: true,
      samples: observed.length,
      maxRealProjectionCount: Math.max(...observed.map((s) => s.projection || 0)),
      maxRenderableFixture: Math.max(...observed.map((s) => s.visible || 0)),
      note: "Renderable is a viewport-culling flag; it does not prove an unoccluded pixel count.",
      finalMetrics: observed.at(-1).metrics,
    });
  }
} finally {
  await browser.close();
  server.kill();
  await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2));
}
console.log(JSON.stringify(results, null, 2));
