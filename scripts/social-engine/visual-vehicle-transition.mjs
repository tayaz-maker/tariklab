// Real worker traffic; inspect every rendered transition without synthetic vehicle movement.
import { build } from "esbuild";
import { chromium } from "playwright";
import { readFile, mkdir, copyFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import assert from "node:assert/strict";
await mkdir(process.env.SE_EVIDENCE_OUT || "artifacts/social-engine/visual-rework", {
  recursive: true,
});
const temp = path.resolve("node_modules/.cache/social-heading-evidence");
await mkdir(`${temp}/games/social-engine/assets`, { recursive: true });
for (const n of ["atlas.json", "buildings.png", "people-props.png"])
  await copyFile(
    `public/games/social-engine/assets/${n}`,
    `${temp}/games/social-engine/assets/${n}`,
  );
for (const n of ["index.html", "styles.css"])
  await copyFile(`src/games/social-engine/ui/${n}`, `${temp}/games/social-engine/${n}`);
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
      name: "observe",
      setup(b) {
        b.onLoad({ filter: /rendering\/renderer\.ts$/ }, async (a) => {
          let s = await readFile(a.path, "utf8");
          const marker = "    if (!initialized) {\n      camera = { ...focus };";
          assert(s.includes(marker));
          s = s.replace(
            marker,
            `    (window as any).__vehiclePresentation = [...actors].filter(([id,v]) => !!v.vehicle).map(([id,v]) => ({id,x:v.sprite.x,y:v.sprite.y,dir:v.direction,rot:v.sprite.rotation,visible:v.sprite.visible && v.sprite.renderable,heading:v.vehicle!.heading}));
    const log = ((window as any).__turnLog ??= []); const prev = ((window as any).__turnPrev ??= new Map());
    for (const [id,v] of actors) if (v.vehicle && v.fadeSprite) {
      if (v.fadeStartedAt !== prev.get(id)) { prev.set(id, v.fadeStartedAt); if (v.fadeStartedAt !== undefined) log.push({id,alpha:v.sprite.alpha,oldAlpha:v.fadeSprite.alpha,oldVisible:v.fadeSprite.visible}); }
    }\n` + marker,
          );
          return { contents: s, loader: "ts", resolveDir: path.dirname(a.path) };
        });
      },
    },
  ],
});
const server = spawn(
  "python3",
  ["-m", "http.server", "18233", "--bind", "127.0.0.1", "--directory", temp],
  { stdio: "ignore" },
);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
});
try {
  let page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  let errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:18233/games/social-engine/index.html?qa=1");
  await page.locator("[name=name]").fill("Deniz Saha");
  await page.getByRole("button", { name: "Hikâyene başla" }).click();
  await page.waitForFunction(() => window.__socialEngine?.projection()?.population === 1100);
  let prev = new Map(),
    seen = new Set(),
    samples = 0,
    backward = 0,
    aligned = 0,
    angles = [],
    turning = new Set(),
    lastHeading = new Map();
  let start = Date.now();
  while (Date.now() - start < 15000) {
    let items = await page.evaluate(() => window.__vehiclePresentation || []);
    for (const a of items) {
      let old = prev.get(a.id);
      prev.set(a.id, a);
      if (lastHeading.has(a.id) && Math.abs(a.heading - lastHeading.get(a.id)) > 0.01)
        turning.add(a.id);
      lastHeading.set(a.id, a.heading);
      if (!old || !a.visible || a.dir !== old.dir) continue;
      let dx = a.x - old.x,
        dy = a.y - old.y,
        dist = Math.hypot(dx, dy);
      if (dist < 0.4 || dist > 35) continue;
      let theta = (a.dir * Math.PI) / 4,
        x = (Math.cos(theta) - Math.sin(theta)) * 24,
        y = (Math.cos(theta) + Math.sin(theta)) * 12,
        rx = x * Math.cos(a.rot) - y * Math.sin(a.rot),
        ry = x * Math.sin(a.rot) + y * Math.cos(a.rot),
        dot = (dx * rx + dy * ry) / (dist * Math.hypot(rx, ry));
      let error = (Math.acos(Math.min(1, Math.max(-1, dot))) * 180) / Math.PI;
      angles.push(error);
      samples++;
      seen.add(a.id);
      if (dot < 0) backward++;
      if (error < 32) aligned++;
    }
    await page.waitForTimeout(200);
  }
  angles.sort((a, b) => a - b);
  const transitions = await page.evaluate(() => window.__turnLog || []);
  let result = {
    transitions,
    kind: "actual simulation, renderer instrumented, no actor fixture",
    durationMs: Date.now() - start,
    samples,
    vehicles: [...seen],
    vehiclesWhoseHeadingChanged: [...turning],
    backward,
    aligned,
    p95Degrees: angles[Math.floor(angles.length * 0.95)] ?? null,
    maxDegrees: angles.at(-1) ?? null,
    errors,
  };
  console.log(JSON.stringify(result));
  await writeFile(
    `${process.env.SE_EVIDENCE_OUT || "artifacts/social-engine/visual-rework"}/vehicle-transition.json`,
    JSON.stringify(result, null, 2),
  );
  assert(samples > 5);
  assert(transitions.length > 0, "actual game should exercise a frame change");
  for (const transition of transitions) {
    assert.equal(transition.alpha, 0);
    assert.equal(transition.oldAlpha, 1);
    assert.equal(transition.oldVisible, true);
  }
  assert.equal(backward, 0);
  assert.equal(errors.length, 0);
} finally {
  await browser.close();
  server.kill();
}
