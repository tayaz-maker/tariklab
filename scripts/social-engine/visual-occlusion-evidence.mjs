// Real walking simulation: verify both opaque clearance and an actual overlap.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.env.SE_BASE || "http://127.0.0.1:18430";
const out = process.env.SE_EVIDENCE_OUT || "artifacts/social-engine/occlusion-evidence";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
});
try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const response = await page.request.get(`${base}/games/social-engine/build-manifest.json`);
  assert.equal(response.status(), 200);
  const manifestSha256 = createHash("sha256").update(await response.body()).digest("hex");
  await page.goto(`${base}/games/social-engine/index.html?qa=1`);
  await page.locator("[name=name]").fill("Deniz Saha");
  await page.getByRole("button", { name: "Hikâyene başla" }).click();
  await page.waitForFunction(() => window.__socialEngine?.projection()?.population === 1100);
  await page.evaluate(() => {
    const stream = document.querySelector("#world canvas").captureStream(30);
    const chunks = [];
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9", videoBitsPerSecond: 3000000 });
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    window.__occlusionCapture = { stream, chunks, recorder, started: performance.now() };
    recorder.start(1000);
  });
  const results = [];
  for (const [label, x, y] of [["clear", 13, 14], ["covered", 19, 20]]) {
    const command = await page.evaluate(({ x, y }) => window.__socialEngine.command("MOVE_TO", { x, y }), { x, y });
    assert.equal(command.ok, true, JSON.stringify(command));
    await page.waitForFunction(({ x, y }) => {
      const p = window.__socialEngine.projection().player.location;
      return Math.hypot(p.x - x, p.y - y) < 0.4;
    }, { x, y }, { timeout: 90000 });
    await page.waitForTimeout(2500);
    const state = await page.evaluate(async () => ({
      seed: (await window.__socialEngine.state()).seed,
      projection: window.__socialEngine.projection(),
      renderer: window.__socialEngine.metrics().renderer,
    }));
    await page.screenshot({ path: `${out}/occlusion-${label}.png` });
    const office = state.renderer.occludedBuildings.find((building) => building.id === "b-office");
    if (label === "clear") assert.equal(office, undefined, "office faded without sprite overlap");
    else assert.ok(office && office.alpha < 0.6, `office did not fade: ${JSON.stringify(office)}`);
    results.push({ label, seed: state.seed, tick: state.projection.tick, minute: state.projection.minute,
      player: state.projection.player.location, camera: state.renderer.cameraTransform,
      occludedBuildings: state.renderer.occludedBuildings });
  }
  // This real idle-right position previously hid the player's head behind YUVA
  // because the sparse sample grid fell between 166 overlapping opaque pixels.
  for (const [x, y] of [[5.4, 14.6], [6, 14.6]]) {
    const command = await page.evaluate(({ x, y }) => window.__socialEngine.command("MOVE_TO", { x, y }), { x, y });
    assert.equal(command.ok, true, JSON.stringify(command));
    await page.waitForFunction(({ x, y }) => {
      const p = window.__socialEngine.projection().player.location;
      return Math.hypot(p.x - x, p.y - y) < 0.1;
    }, { x, y }, { timeout: 90000 });
  }
  await page.waitForTimeout(2000);
  const edge = await page.evaluate(async () => ({
    seed: (await window.__socialEngine.state()).seed,
    projection: window.__socialEngine.projection(),
    renderer: window.__socialEngine.metrics().renderer,
  }));
  await page.screenshot({ path: `${out}/occlusion-thin-edge.png` });
  const home = edge.renderer.occludedBuildings.find((building) => building.id === "b-home");
  assert.ok(home && home.alpha < 0.6, `home did not fade at thin overlap: ${JSON.stringify(home)}`);
  results.push({ label: "thin-edge", seed: edge.seed, tick: edge.projection.tick, minute: edge.projection.minute,
    player: edge.projection.player.location, camera: edge.renderer.cameraTransform,
    occludedBuildings: edge.renderer.occludedBuildings });
  assert.deepEqual(errors, []);
  const wait = await page.evaluate(() => Math.max(0, 32000 - (performance.now() - window.__occlusionCapture.started)));
  await page.waitForTimeout(wait);
  const video = await page.evaluate(() => new Promise((resolve) => {
    const { recorder, chunks, stream, started } = window.__occlusionCapture;
    const durationMs = performance.now() - started;
    recorder.onstop = () => {
      const reader = new FileReader();
      reader.onload = () => { stream.getTracks().forEach((track) => track.stop()); resolve({ data: reader.result, durationMs }); };
      reader.readAsDataURL(new Blob(chunks, { type: recorder.mimeType }));
    };
    recorder.stop();
  }));
  await writeFile(`${out}/occlusion-clear-covered.webm`, Buffer.from(video.data.split(",")[1], "base64"));
  const finalMetrics = await page.evaluate(() => window.__socialEngine.metrics().renderer);
  const report = { manifestSha256, durationMs: video.durationMs, results, errors, finalMetrics,
    method: "Normal-speed integrated simulation; QA MOVE_TO, no actor or crowd fixture; alpha from renderer metrics." };
  await writeFile(`${out}/occlusion-clear-covered.json`, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
