// Real shop controls and IndexedDB, no world-state mutation. Fixed QA ticks only shorten the walk.
import { chromium, firefox, webkit } from "playwright";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
const kind = process.env.SE_BROWSER || "chromium";
const base = process.env.SE_BASE || "http://127.0.0.1:8097";
const dir = "artifacts/social-engine/property-browser-" + kind;
await mkdir(dir, { recursive: true });
const digest = (b) => createHash("sha256").update(b).digest("hex");
const manifest = await readFile("public/games/social-engine/build-manifest.json");
const res = await fetch(base + "/games/social-engine/build-manifest.json");
assert.equal(res.status, 200);
assert.equal(digest(await res.text()), digest(manifest));
const browser = await { chromium, firefox, webkit }[kind].launch({
  headless: true,
  ...(kind === "chromium" && process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
    : {}),
});
const report = {
  status: "RUNNING",
  browser: kind,
  version: browser.version(),
  manifestSha256: digest(manifest),
  checks: [],
  errors: [],
};
let page;
try {
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(12000);
  page.on("pageerror", (e) => report.errors.push(e.message));
  await page.goto(base + "/games/social-engine/index.html?qa=1");
  await page.locator("[name=name]").fill("Deniz Emanet");
  await page.getByRole("button", { name: "Hikâyene başla" }).click();
  await page.waitForFunction(() => window.__socialEngine?.projection()?.population === 1100);
  await page.evaluate(() => window.__socialEngine.pause(true));
  await page.locator('[data-panel="map"]').waitFor();
  const stable = await page.evaluate(async () => {
    const btn = document.querySelector('[data-panel="map"]'),
      canvas = document.getElementById("minimap");
    await new Promise((r) => setTimeout(r, 900));
    return (
      btn === document.querySelector('[data-panel="map"]') &&
      canvas === document.getElementById("minimap")
    );
  });
  assert.ok(
    stable,
    "HUD must retain the same focusable button and the same minimap canvas through multiple refreshes",
  );
  report.checks.push("HUD controls and minimap retain DOM identity through multiple refreshes.");
  await page.locator('[data-panel="map"]').click();
  await page.locator('[data-go="b-market"]').click();
  await page.evaluate(() => window.__socialEngine.step(1000));
  const atMarket = await page.evaluate(
    async () => (await window.__socialEngine.state()).player.location,
  );
  await page.waitForFunction((pos) => {
    const p = window.__socialEngine.projection().player.location;
    return p.scene === pos.scene && Math.hypot(p.x - pos.x, p.y - pos.y) < 0.01;
  }, atMarket);
  await page.keyboard.press("KeyE");
  await page.locator("summary").filter({ hasText: "Ödemeden almak" }).click();
  const state = () => page.evaluate(() => window.__socialEngine.state());
  const before = await state(),
    stock = before.businesses.find((b) => b.id === "market").stock.simit;
  await page.locator("#unpaid-item").selectOption("simit");
  await page.getByRole("button", { name: "Bir tane ödemeden al" }).click();
  await page.getByRole("button", { name: "Simit geri ver" }).waitFor();
  const after = await state(),
    loss = after.crimes.at(-1).propertyLoss;
  assert.equal(after.player.inventory.simit, before.player.inventory.simit + 1);
  assert.equal(after.businesses.find((b) => b.id === "market").stock.simit, stock - 1);
  assert.equal(after.accounts.player, before.accounts.player);
  assert.equal(after.progression.items.simit.at(-1).id, loss.itemId);
  report.checks.push(
    "Map destination, entrance and real shop action move exactly one unit without a sale.",
  );
  assert.equal(await page.evaluate(() => window.__socialEngine.save("slot-1")), true);
  await page.getByRole("button", { name: "Simit geri ver" }).click();
  await page.waitForFunction(
    () => window.__socialEngine.projection().crimes.at(-1)?.propertyLoss?.returnedTick !== null,
  );
  const returned = await state();
  assert.equal(returned.businesses.find((b) => b.id === "market").stock.simit, stock);
  assert.equal(returned.player.inventory.simit, before.player.inventory.simit);
  assert.ok(returned.crimes.some((c) => c.propertyLoss?.itemId === loss.itemId));
  report.checks.push("UI restitution restores the shop stock once and preserves the incident.");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Kayıtlar & dışa aktarım", exact: true }).click();
  await page.locator('[data-load="slot-1"]').click();
  await page.waitForFunction(() => document.getElementById("panel").classList.contains("hidden"));
  const restored = await state(),
    caseBeforeReturn = restored.crimes.find((c) => c.propertyLoss?.itemId === loss.itemId);
  assert.equal(caseBeforeReturn.propertyLoss.returnedTick, null);
  assert.equal(restored.progression.items.simit.at(-1).sourceId, "stolen:" + caseBeforeReturn.id);
  assert.equal(restored.businesses.find((b) => b.id === "market").stock.simit, stock - 1);
  report.checks.push(
    "Real IndexedDB save and menu load preserve the original victim, incident and item identity.",
  );
  assert.deepEqual(report.errors, []);
  report.status = "PASS";
} catch (e) {
  report.status = "FAIL";
  report.reason = e.message;
  report.observed = await page
    ?.evaluate(() => ({
      location: window.__socialEngine?.projection()?.player.location,
      tick: window.__socialEngine?.projection()?.tick,
      prompt: document.getElementById("context")?.innerText,
      panel: document.querySelector("#panel h2")?.textContent,
      notice: document.querySelector("#toast")?.textContent,
    }))
    .catch(() => null);
  process.exitCode = 1;
} finally {
  await browser.close();
  await writeFile(dir + "/results.json", JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report));
}
