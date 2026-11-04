import { chromium } from "playwright";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const base = process.env.SE_PACKAGE_BASE || "http://127.0.0.1:8107";
const out = "artifacts/social-engine/portable-candidate";
await mkdir(out, { recursive: true });
const localManifest = await readFile("public/games/social-engine/build-manifest.json");
const hash = (b) => createHash("sha256").update(b).digest("hex");
const report = {
  status: "RUNNING",
  startedAt: new Date().toISOString(),
  base,
  manifestSha256: hash(localManifest),
  headless: true,
  checks: [],
  errors: [],
};
let browser;
try {
  const raw = Buffer.from(
    await (await fetch(base + "/games/social-engine/build-manifest.json")).arrayBuffer(),
  );
  assert.equal(hash(raw), hash(localManifest));
  const manifest = JSON.parse(raw);
  for (const a of [...manifest.assets, ...manifest.playableAssets]) {
    const r = await fetch(base + "/games/social-engine/" + a.file);
    assert.equal(r.status, 200, a.file);
    assert.equal(hash(Buffer.from(await r.arrayBuffer())), a.sha256, a.file);
  }
  report.checks.push({
    name: "Every packaged runtime and atlas file matches the tested manifest",
    status: "PASS",
  });
  for (const p of [
    "/start.mjs",
    "/README.txt",
    "/games/social-engine/%2e%2e%2fstart.mjs",
    "/.git/config",
  ])
    assert.equal((await fetch(base + p)).status, 404);
  assert.equal((await fetch(base + "/%ZZ")).status, 400);
  assert.equal((await fetch(base + "/", { method: "POST" })).status, 405);
  assert.equal(
    (await fetch(base + "/games/social-engine/index.html", { method: "HEAD" })).status,
    200,
  );
  report.checks.push({
    name: "Asset whitelist rejects traversal, unsupported methods and nonpublic files",
    status: "PASS",
  });
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
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  page.on("pageerror", (e) => report.errors.push(e.message));
  page.on("request", (r) => {
    if (!r.url().startsWith(base + "/"))
      report.errors.push("Unexpected external request: " + r.url());
  });
  await page.goto(base + "/games/social-engine/index.html?qa=1");
  await page.locator("[name=name]").fill("Paket Denizi");
  await page.getByRole("button", { name: "Hikâyene başla" }).click();
  await page.waitForFunction(() => window.__socialEngine?.projection()?.population === 1100);
  const before = await page.evaluate(
    async () => (await window.__socialEngine.state()).player.location,
  );
  await page.keyboard.down("KeyD");
  await page.waitForTimeout(700);
  await page.keyboard.up("KeyD");
  await page.keyboard.press("Escape");
  const state = await page.evaluate(() => window.__socialEngine.state());
  assert.ok(state.player.location.x > before.x && state.player.location.y < before.y);
  assert.equal(state.player.name, "Paket Denizi");
  assert.equal(await page.locator("#world canvas").count(), 1);
  report.checks.push({
    name: "Portable worker, renderer, character creation and real keyboard movement",
    status: "PASS",
  });
  await page.getByRole("button", { name: "Kayıtlar & dışa aktarım", exact: true }).click();
  await page.locator("[data-save=slot-1]").click();
  await page.locator("[data-load=slot-1]:not([disabled])").waitFor();
  await page.keyboard.press("Escape");
  await page.keyboard.down("KeyA");
  await page.waitForTimeout(500);
  await page.keyboard.up("KeyA");
  await page.keyboard.press("Escape");
  const moved = await page.evaluate(() => window.__socialEngine.state());
  assert.notDeepEqual(moved.player.location, state.player.location);
  await page.getByRole("button", { name: "Kayıtlar & dışa aktarım", exact: true }).click();
  await page.locator("[data-load=slot-1]").click();
  // The actual READY response dismisses the load panel. An old projection can still
  // contain1100people while the old worker is being replaced, so it is not readiness.
  await page.waitForFunction(() => document.getElementById("panel").classList.contains("hidden"));
  const loaded = await page.evaluate(() => window.__socialEngine.state());
  assert.equal(loaded.player.name, state.player.name);
  assert.ok(Number.isSafeInteger(state.accounts.player));
  assert.equal(loaded.accounts.player, state.accounts.player);
  assert.deepEqual(loaded.player.location, state.player.location);
  report.checks.push({
    name: "Actual packaged save menu roundtrip preserves identity, money and position",
    status: "PASS",
  });
  assert.deepEqual(report.errors, []);
  report.browser = await browser.version();
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
