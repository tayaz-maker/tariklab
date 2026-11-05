// Actual game and physical keyboard inputs; no synthetic actors or accelerated clock. Canvas capture excludes HUD.
import { chromium } from "playwright";
import { writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
const out = process.env.SE_EVIDENCE_OUT || "artifacts/social-engine/visual-rework";
const mode = process.env.SE_CAPTURE_MODE || "walking";
if (!["walking", "traffic", "crowd"].includes(mode)) throw new Error("Invalid capture mode");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
});
const manifestResponse = await browser.newPage();
const manifestBytes = await (
  await manifestResponse.request.get(
    `${process.env.SE_BASE || "http://127.0.0.1:18230"}/games/social-engine/build-manifest.json`,
  )
).body();
const manifestSha256 = createHash("sha256").update(manifestBytes).digest("hex");
await manifestResponse.close();
const page = await browser.newPage({
  viewport: { width: 1366, height: 768 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(
  `${process.env.SE_BASE || "http://127.0.0.1:18230"}/games/social-engine/index.html?qa=1`,
);
await page.locator("[name=name]").fill("Deniz Saha");
await page.getByRole("button", { name: "Hikâyene başla" }).click();
await page.waitForFunction(() => window.__socialEngine?.projection()?.population === 1100);
await page.waitForTimeout(1500);
const before = await page.evaluate(() => {
  let p = window.__socialEngine.projection();
  return {
    tick: p.tick,
    minute: p.minute,
    player: p.player.location,
    npcs: p.npcs.length,
    vehicles: p.vehicles.length,
  };
});
await page.evaluate(() => {
  const canvas = document.querySelector("#world canvas");
  const stream = canvas.captureStream(30);
  const chunks = [];
  const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
    ? "video/webm;codecs=vp9"
    : "video/webm";
  const r = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 3000000 });
  r.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  const samples = [];
  const timer = setInterval(() => {
    const p = window.__socialEngine.projection();
    if (p)
      samples.push({
        tick: p.tick,
        player: p.player.location,
        vehicles: p.vehicles.map((v) => ({ id: v.id, location: v.location, heading: v.heading })),
        npcs: p.npcs.map((n) => ({ id: n.id, location: n.location })),
      });
  }, 1000);
  window.__capture = { r, chunks, stream, samples, timer, started: performance.now() };
  r.start(1000);
});
await page.locator("#world canvas").focus();
if (mode === "walking") {
  for (const [key, ms] of [
    ["KeyD", 3200],
    ["KeyS", 2800],
    ["KeyA", 2500],
    ["KeyW", 2200],
    ["KeyD", 1800],
  ]) {
    await page.keyboard.down(key);
    await page.waitForTimeout(ms);
    await page.keyboard.up(key);
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(18000);
} else if (mode === "crowd") {
  await page.keyboard.down("KeyA");
  await page.waitForTimeout(1600);
  await page.keyboard.up("KeyA");
  await page.waitForTimeout(30500);
} else {
  await page.waitForTimeout(32500);
}
const after = await page.evaluate(() => {
  let p = window.__socialEngine.projection();
  return {
    tick: p.tick,
    minute: p.minute,
    player: p.player.location,
    metrics: window.__socialEngine.metrics().renderer,
  };
});
const data = await page.evaluate(
  () =>
    new Promise((resolve) => {
      const { r, chunks, stream, samples, timer, started } = window.__capture;
      clearInterval(timer);
      const durationMs = performance.now() - started;
      r.onstop = async () => {
        let blob = new Blob(chunks, { type: r.mimeType });
        let reader = new FileReader();
        reader.onload = () => {
          stream.getTracks().forEach((t) => t.stop());
          resolve({ data: reader.result, bytes: blob.size, mime: r.mimeType, durationMs, samples });
        };
        reader.readAsDataURL(blob);
      };
      r.stop();
    }),
);
await writeFile(
  `${out}/${mode}-real-gameplay.webm`,
  Buffer.from(data.data.split(",")[1], "base64"),
);
await writeFile(
  `${out}/${mode}-evidence.json`,
  JSON.stringify(
    {
      type: "actual integrated gameplay, no injected actors or fixture",
      mode,
      manifestSha256,
      durationMs: data.durationMs,
      samples: data.samples,
      before,
      after,
      bytes: data.bytes,
      mime: data.mime,
      errors,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    mode,
    before,
    after,
    durationMs: data.durationMs,
    sampleCount: data.samples.length,
    bytes: data.bytes,
    mime: data.mime,
    errors,
  }),
);
await browser.close();
