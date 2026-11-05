// Instrumentation observes renderer output from real simulation and physical key inputs; no actor fixture.
import { build } from "esbuild";
import { chromium } from "playwright";
import { readFile, mkdir, copyFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import assert from "node:assert/strict";
await mkdir(process.env.SE_EVIDENCE_OUT || "artifacts/social-engine/visual-rework", {
  recursive: true,
});
const temp = path.resolve("node_modules/.cache/social-visual-motion");
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
          let marker = "        if (id === current.player.id) focus = p;";
          assert(s.includes(marker));
          s = s.replace(
            marker,
            `        if (id === current.player.id) { (window as any).__visualPlayer = {moving, running, apparentSpeed, frame, textureName}; focus = p; }`,
          );
          return { contents: s, loader: "ts", resolveDir: path.dirname(a.path) };
        });
      },
    },
  ],
});
const server = spawn(
  "python3",
  ["-m", "http.server", "18232", "--bind", "127.0.0.1", "--directory", temp],
  { stdio: "ignore" },
);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
});
try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  let errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:18232/games/social-engine/index.html?qa=1");
  await page.locator("[name=name]").fill("Deniz Saha");
  await page.getByRole("button", { name: "Hikâyene başla" }).click();
  await page.waitForFunction(() => window.__socialEngine?.projection()?.population === 1100);
  await page.locator("#world canvas").focus();
  const observed = { punch: [], block: [] };
  async function sample(mode, n) {
    for (let i = 0; i < n; i++) {
      await page.waitForTimeout(40);
      observed[mode].push(await page.evaluate(() => window.__visualPlayer));
    }
  }
  await page.keyboard.down("KeyB");
  await sample("block", 12);
  await page.keyboard.up("KeyB");
  await page.waitForTimeout(200);
  await page.keyboard.press("KeyF");
  await sample("punch", 20);
  const result = {
    blockFrames: observed.block.filter((x) => x?.textureName?.startsWith("person-block-")).length,
    punchFrames: observed.punch.filter((x) => x?.textureName?.startsWith("person-punch-")).length,
    errors,
  };
  console.log(JSON.stringify(result));
  await writeFile(
    `${process.env.SE_EVIDENCE_OUT || "artifacts/social-engine/visual-rework"}/combat-pose.json`,
    JSON.stringify(result, null, 2),
  );
  assert(result.blockFrames > 0);
  assert(result.punchFrames > 0);
  assert.equal(errors.length, 0);
} finally {
  await browser.close();
  server.kill();
}
