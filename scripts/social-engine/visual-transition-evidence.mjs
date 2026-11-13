// Real worker traffic; observe visible base-frame switches and displayed orientation jumps.
import { build } from "esbuild";
import { chromium } from "playwright";
import { readFile, mkdir, copyFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import assert from "node:assert/strict";
await mkdir(process.env.SE_EVIDENCE_OUT || "artifacts/social-engine/visual-rework", {
  recursive: true,
});
const temp = path.resolve("node_modules/.cache/social-heading-transitions");
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
            `    (window as any).__vehiclePresentation = [...actors].filter(([id,v]) => !!v.vehicle).map(([id,v]) => ({id,x:v.sprite.x,y:v.sprite.y,dir:v.direction,rot:v.sprite.rotation,visible:v.sprite.visible && v.sprite.renderable,heading:v.vehicle!.heading}));\n` +
              marker,
          );
          return { contents: s, loader: "ts", resolveDir: path.dirname(a.path) };
        });
      },
    },
  ],
});
const server = spawn(
  "python3",
  ["-m", "http.server", "18234", "--bind", "127.0.0.1", "--directory", temp],
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
  await page.goto("http://127.0.0.1:18234/games/social-engine/index.html?qa=1");
  await page.locator("[name=name]").fill("Deniz Saha");
  await page.getByRole("button", { name: "Hikâyene başla" }).click();
  await page.waitForFunction(() => window.__socialEngine?.projection()?.population === 1100);
  const prev = new Map();
  const transitions = [];
  const start = Date.now();
  const projectedAngle = (v) => {
    const t = (v.dir * Math.PI) / 4;
    return Math.atan2((Math.cos(t) + Math.sin(t)) * 12, (Math.cos(t) - Math.sin(t)) * 24) + v.rot;
  };
  while (Date.now() - start < 45000) {
    const items = await page.evaluate(() => window.__vehiclePresentation || []);
    for (const a of items) {
      const old = prev.get(a.id);
      prev.set(a.id, a);
      if (!old || !old.visible || !a.visible || old.dir === a.dir) continue;
      const dx = a.x - old.x,
        dy = a.y - old.y,
        distance = Math.hypot(dx, dy);
      const orientation = projectedAngle(a),
        previous = projectedAngle(old);
      const wrap = (v) => Math.atan2(Math.sin(v), Math.cos(v));
      const jump = (Math.abs(wrap(orientation - previous)) * 180) / Math.PI;
      const error =
        distance > 0.15 ? (Math.abs(wrap(orientation - Math.atan2(dy, dx))) * 180) / Math.PI : null;
      transitions.push({
        id: a.id,
        from: old.dir,
        to: a.dir,
        distance,
        jumpDegrees: jump,
        movementErrorDegrees: error,
        rotation: a.rot,
        heading: a.heading,
      });
    }
    await page.waitForTimeout(50);
  }
  const jumps = transitions.map((v) => v.jumpDegrees).sort((a, b) => a - b);
  const result = {
    kind: "real worker simulation; no synthetic traffic",
    durationMs: Date.now() - start,
    transitions: transitions.length,
    vehicles: [...new Set(transitions.map((v) => v.id))],
    p95JumpDegrees: jumps[Math.floor(jumps.length * 0.95)] ?? null,
    maxJumpDegrees: jumps.at(-1) ?? null,
    examples: transitions.slice(0, 25),
    errors,
  };
  console.log(JSON.stringify(result));
  await writeFile(
    `${process.env.SE_EVIDENCE_OUT || "artifacts/social-engine/visual-rework"}/heading-transitions.json`,
    JSON.stringify(result, null, 2),
  );
  assert(transitions.length > 0, "No visible frame changes observed");
  assert.equal(errors.length, 0);
} finally {
  await browser.close();
  server.kill();
}
