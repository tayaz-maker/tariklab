// Black-box shipping UI: no QA parameter, simulation API, clock changes or storage injection.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { decodeSaveText } from "../../src/games/social-engine/persistence/codec.ts";
import { windowlessRendererOptions } from "./windowless-launch.mjs";
const base = new URL(process.env.SE_ROUTE_BASE || "http://127.0.0.1:8230");
assert.ok(["127.0.0.1", "localhost", "www.tariklab.com"].includes(base.hostname));
const live = base.hostname === "www.tariklab.com",
  origin = base.origin;
if (live) assert.equal(base.protocol, "https:");
const out =
  process.env.SE_SMOKE_OUT ||
  "artifacts/social-engine/upgrade/" + (live ? "live-smoke" : "candidate-smoke");
const sha = (x) => createHash("sha256").update(x).digest("hex");
await mkdir(out, { recursive: true });
const report = {
  origin,
  status: "FAIL",
  mode: live ? "production" : "candidate",
  checks: [],
  errors: [],
};
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  ...windowlessRendererOptions(),
});
const page = await browser.newPage({
  viewport: { width: 1366, height: 768 },
  acceptDownloads: true,
});
page.setDefaultTimeout(10000);
page.on("pageerror", (e) => report.errors.push(e.message));
try {
  const manifest = await readFile("public/games/social-engine/build-manifest.json");
  const r = await page.request.get(origin + "/games/social-engine/build-manifest.json");
  assert.equal(r.status(), 200);
  assert.equal(sha(await r.body()), sha(manifest));
  report.manifestSha256 = sha(manifest);
  const m = JSON.parse(manifest);
  for (const obj of [...m.assets, ...m.playableAssets]) {
    const resp = await page.request.get(origin + "/games/social-engine/" + obj.file);
    assert.equal(resp.status(), 200, obj.file);
    assert.equal(sha(await resp.body()), obj.sha256, obj.file);
  }
  report.checks.push("all deployed asset hashes");
  const resp = await page.goto(origin + "/oyna/social-engine");
  assert.equal(resp.status(), 200);
  const f = page.frameLocator('iframe[title="SOCIAL ENGINE"]'),
    h = f.locator("#hud-name");
  await f.getByLabel("Karakter adı").fill("Deniz Saha");
  await f.getByRole("button", { name: "Hikâyene başla" }).click();
  await h.waitFor();
  assert.equal(await h.textContent(), "Deniz Saha");
  assert.equal(await f.locator("#hud-district").innerText(), "DARAMCIK");
  await f.locator("#context").click();
  await f.locator('[data-topic="greet"]').click();
  await f.locator("#panel").waitFor({ state: "hidden" });
  const save = async (slot) => {
    await f.locator('[data-panel="pause"]').click();
    await f.locator("#saves").click();
    await f.locator('[data-save="' + slot + '"]').click();
    const output = f.locator('[data-export="' + slot + '"]');
    await output.waitFor();
    const task = page.waitForEvent("download");
    await output.click();
    const dl = await task;
    const path = await dl.path();
    const { state } = await decodeSaveText(await readFile(path, "utf8"));
    await f.locator("#close-panel").click();
    return state;
  };
  const before = await save("slot-1");
  assert.ok(before.events.some((e) => e.kind === "conversation" && e.actors.includes("player")));
  report.checks.push("character, district and recorded NPC conversation");
  await f.locator("#world canvas").focus();
  await page.keyboard.down("KeyD");
  await page.waitForTimeout(750);
  await page.keyboard.up("KeyD");
  const after = await save("slot-2");
  const a = before.player.location,
    b = after.player.location;
  assert.ok(b.x > a.x && b.y < a.y, JSON.stringify({ a, b }));
  report.checks.push("physical D key moves screen-right");
  await page.reload();
  await f.locator("#continue").click();
  await f.locator('[data-load="slot-2"]').click();
  await h.waitFor();
  assert.equal(await h.innerText(), after.player.name);
  const restored = await save("slot-3");
  assert.deepEqual(restored.player.location, b);
  assert.equal(restored.accounts.player, after.accounts.player);
  assert.ok(restored.events.some((e) => e.kind === "conversation" && e.actors.includes("player")));
  assert.deepEqual(report.errors, []);
  report.checks.push("durable location, money and NPC history after page reload");
  await page.screenshot({ path: out + "/world.png" });
  report.status = "PASS";
} catch (e) {
  report.reason = String(e.stack ?? e);
  const frame = page.frames().find((child) => child.url().includes("/games/social-engine/"));
  if (frame)
    report.visibleError = await frame
      .locator("#form-error, #panel [role=alertdialog]")
      .allTextContents()
      .catch(() => []);

  await page.screenshot({ path: out + "/failure.png" }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
  await writeFile(out + "/results.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}
