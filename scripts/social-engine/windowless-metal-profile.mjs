// A short, real GPU profile independent of the long soak and reference-PC gates.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
const path = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  base = process.env.SE_BASE || "http://127.0.0.1:8097";
assert.ok(
  process.platform === "darwin" && path?.endsWith("/chrome-headless-shell"),
  "Only use the windowless shell on this Mac.",
);
const hash = (b) => createHash("sha256").update(b).digest("hex"),
  id = hash(await readFile("public/games/social-engine/build-manifest.json"));
const out = "artifacts/social-engine/windowless-metal";
await mkdir(out, { recursive: true });
const result = {
  startedAt: new Date().toISOString(),
  status: "UNVERIFIED",
  manifestSha256: id,
  scope:
    "A short headless Metal gameplay sample on this Mac. Not the reference PC, human play, dedicated GPU memory, or the long soak.",
  segments: [],
  errors: [],
};
const browser = await chromium.launch({
  headless: true,
  executablePath: path,
  ignoreDefaultArgs: ["--use-angle=swiftshader-webgl"],
  args: ["--use-gl=angle", "--use-angle=metal", "--enable-gpu"],
});
try {
  const p = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  p.on("pageerror", (e) => result.errors.push(e.message));
  assert.equal(
    hash(await (await p.request.get(base + "/games/social-engine/build-manifest.json")).body()),
    id,
  );
  await p.goto(base + "/games/social-engine/index.html?qa=1");
  await p.getByLabel("Karakter adı").fill("Ölçüm Deniz");
  await p.getByRole("button", { name: "Hikâyene başla" }).click();
  await p.waitForFunction(() => window.__socialEngine?.projection()?.population === 1100);
  const cdp = await browser.newBrowserCDPSession(),
    info = await cdp.send("SystemInfo.getInfo");
  result.browser = browser.version();
  result.gpu = info.gpu.devices.map((d) => d.deviceString);
  result.actualRenderer = await p.evaluate(() => {
    const c = document.querySelector("#world canvas"),
      g = c?.getContext("webgl2") ?? c?.getContext("webgl"),
      ext = g?.getExtension("WEBGL_debug_renderer_info");
    return ext ? g.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null;
  });
  assert.match(result.actualRenderer ?? "", /Metal Renderer: Apple M2/i);
  const read = () =>
    p.evaluate(() => {
      const m = window.__socialEngine.metrics();
      return {
        frameCount: m.frames.length,
        simCount: m.sim.length,
        tick: window.__socialEngine.projection().tick,
        scene: window.__socialEngine.projection().player.location.scene,
      };
    });
  const stat = (a) => {
    const v = a.slice().sort((a, b) => a - b);
    return {
      count: v.length,
      p50: v[Math.ceil(v.length * 0.5) - 1],
      p95: v[Math.ceil(v.length * 0.95) - 1],
      p99: v[Math.ceil(v.length * 0.99) - 1],
    };
  };
  await p.waitForTimeout(1500);
  for (const [name, key] of [
    ["Standing outside", null],
    ["Walking east", "KeyD"],
    ["Walking west", "KeyA"],
  ]) {
    const begin = await read(),
      start = performance.now();
    if (key) await p.keyboard.down(key);
    await p.waitForTimeout(20000);
    if (key) await p.keyboard.up(key);
    const end = await read(),
      ms = performance.now() - start;
    const samples = await p.evaluate(
      ({ f, s }) => {
        let m = window.__socialEngine.metrics();
        return {
          frames: m.frames.slice(f),
          sim: m.sim.slice(s),
          preparation: m.renderer.renderPreparationMs,
        };
      },
      { f: begin.frameCount, s: begin.simCount },
    );
    assert.ok(samples.frames.length >= 2 && end.tick > begin.tick);
    result.segments.push({
      name,
      elapsedMs: ms,
      tickCoverage: ((end.tick - begin.tick) * 100) / ms,
      actualFps: (samples.frames.length * 1000) / ms,
      frameMs: stat(samples.frames),
      workerMs: stat(samples.sim),
      renderPreparationMs: samples.preparation,
    });
  }
  assert.deepEqual(result.errors, []);
  result.status = "MEASURED";
} catch (e) {
  result.status = "FAIL";
  result.reason = String(e.stack || e);
  process.exitCode = 1;
} finally {
  await browser.close();
  result.finishedAt = new Date().toISOString();
  await writeFile(out + "/results.json", JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result));
}
