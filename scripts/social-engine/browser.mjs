import { waitForQATicks } from "./wait-for-qa-ticks.mjs";
import { chromium, firefox, webkit } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { BUILDINGS, isWalkable, project } from "../../src/games/social-engine/domain/world.ts";
const base = process.env.SE_BASE || "http://127.0.0.1:8097";
const kind = process.env.SE_BROWSER || "chromium";
const out = "artifacts/social-engine/browser-" + kind;
await mkdir(out, { recursive: true });
const browser = await { chromium, firefox, webkit }[kind].launch({
  headless: true,
  executablePath:
    kind === "chromium"
      ? process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
        (process.platform === "darwin"
          ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
          : chromium.executablePath())
      : undefined,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: out + "/video" },
});
await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const report = {
  browser: await browser.version(),
  engine: kind,
  base,
  started: new Date().toISOString(),
  results: [],
  errors,
};
const manifestResponse = await fetch(base + "/games/social-engine/build-manifest.json");
assert.equal(manifestResponse.status, 200);
const manifestText = await manifestResponse.text();
report.manifestSha256 = createHash("sha256").update(manifestText).digest("hex");
report.manifest = JSON.parse(manifestText);
async function test(id, fn, assertions = []) {
  const t = performance.now();
  try {
    await fn();
    report.results.push({ id, status: "PASS", assertions, duration_ms: performance.now() - t });
  } catch (e) {
    report.results.push({
      id,
      status: "FAIL",
      reason: e.message,
      duration_ms: performance.now() - t,
    });
    await page.screenshot({ path: out + "/failure-" + id.replaceAll(",", "-") + ".png" });
    throw e;
  }
}
const state = () => page.evaluate(() => window.__socialEngine.state());
const cmd = (type, args = {}) =>
  page.evaluate(({ type, args }) => window.__socialEngine.command(type, args), { type, args });
const step = (count) => waitForQATicks(page, count);
async function stepUntil(condition, { batch, maxTicks, reason }) {
  for (let elapsed = 0; elapsed <= maxTicks; elapsed += batch) {
    const current = await state();
    if (condition(current)) return current;
    if (elapsed < maxTicks) await step(Math.min(batch, maxTicks - elapsed));
  }
  assert.fail(reason);
}
try {
  await test("SE-001", async () => {
    await page.goto(base + "/games/social-engine/index.html?qa=1");
    await page.getByRole("heading", { name: "Mahalleye hoş geldin." }).waitFor();
    await page.screenshot({ path: out + "/menu.png" });
  });
  await test("SE-005", async () => {
    await page.locator("[name=name]").fill("<script>");
    await page.getByRole("button", { name: "Hikâyene başla" }).click();
    assert.match(await page.locator("#form-error").innerText(), /Ad 2/);
    assert.equal(await page.locator("#intro").isVisible(), true);
  });
  await test("SE-002,SE-004", async () => {
    await page.locator("[name=name]").fill("Deniz Test");
    await page.locator("[name=background]").selectOption("local");
    await page.locator("[name=appearance]").selectOption("2");
    await page.getByRole("button", { name: "Hikâyene başla" }).click();
    await page.waitForFunction(() => window.__socialEngine?.projection()?.population === 1100, {
      timeout: 20000,
    });
    await page.evaluate(() => window.__socialEngine.pause(true));
    const s = await state();
    assert.equal(s.player.name, "Deniz Test");
    assert.equal(s.player.profile.background, "local");
    assert.equal(s.player.appearance, 2);
    assert.equal(s.npcs.length, 1100);
    await page.screenshot({ path: out + "/world.png" });
  });
  await test("SE-007-keyboard", async () => {
    await page.evaluate(() => window.__socialEngine.pause(false));
    const before = (await state()).player.location;
    await page.keyboard.down("KeyD");
    await page.waitForTimeout(700);
    await page.keyboard.up("KeyD");
    await page.evaluate(() => window.__socialEngine.pause(true));
    const after = (await state()).player.location;
    assert.ok(after.x > before.x && after.y < before.y, "D moves screen-right");
    await cmd("MOVE_TO", { x: 27, y: 16 });
    await step(20);
  });
  await test("SE-016", async () => {
    const s = await state();
    const n = s.npcs.find((n) => n.id === "n0");
    assert.equal(
      s.player.location.scene,
      n.location.scene,
      "the welcoming neighbor is in the street",
    );
    // Navigate using normal controls and wait for real proximity rather than assuming ten ticks suffice.
    for (let turn = 0; turn < 8; turn++) {
      const live = await state(),
        npc = live.npcs.find((person) => person.id === n.id);
      const p = live.player.location;
      if (
        p.scene === npc.location.scene &&
        Math.hypot(p.x - npc.location.x, p.y - npc.location.y) < 1.55
      )
        break;
      const moved = await cmd("MOVE_TO", { x: npc.location.x, y: npc.location.y });
      assert.ok(moved.ok, moved.reason);
      await step(8);
    }
    const r = await cmd("TALK", { npcId: n.id, topic: "greet" });
    assert.equal(r.ok, true, r.reason);
    assert.ok((await state()).relations.some((r) => r.from === "player" || r.to === "player"));
  });
  await test("SE-007-click,SE-009", async () => {
    const near = (location, point) => Math.hypot(location.x - point.x, location.y - point.y) < 0.2;
    const start = { x: 24, y: 15.5 };
    const approach = await cmd("MOVE_TO", start);
    assert.ok(approach.ok, approach.reason);
    await stepUntil((s) => near(s.player.location, start) && !s.player.path.length, {
      batch: 12,
      maxTicks: 120,
      reason: "player reached the open market frontage",
    });
    for (const [viewport, point] of [
      [{ width: 1440, height: 900 }, { x: 24.75, y: 16.15 }],
      [{ width: 1280, height: 720 }, { x: 25.5, y: 15.5 }],
    ]) {
      await page.setViewportSize(viewport);
      assert.ok(isWalkable(point), "click target must be on open ground");
      const canvas = page.locator("#world canvas");
      await page.waitForFunction(async () => {
        const readCamera = () => window.__socialEngine.metrics().renderer.cameraTransform;
        const first = readCamera();
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const second = readCamera();
        return !!first && !!second && Math.hypot(second.x - first.x, second.y - first.y) < 0.5;
      });
      const camera = await page.evaluate(
        () => window.__socialEngine.metrics().renderer.cameraTransform,
      );
      assert.ok(camera, "renderer transform instrumentation");
      const iso = project(point);
      const screen = {
        x: iso.x * camera.zoom + camera.x,
        y: iso.y * camera.zoom + camera.y,
      };
      await canvas.click({ position: screen });
      const destination = (await state()).player.destination;
      assert.ok(destination && near(destination, point),
        `canvas click mapped to ${JSON.stringify(destination)} at ${viewport.width}px`);
      await stepUntil((s) => near(s.player.location, point) && !s.player.path.length, {
        batch: 4,
        maxTicks: 24,
        reason: `player reached the clicked point at ${viewport.width}px`,
      });
    }
    await cmd("MOVE_TO", { x: 27, y: 16 });
    await step(20);
  });
  await test("SE-013,SE-022", async () => {
    await cmd("MOVE_TO", { x: 27, y: 14.7 });
    await step(100);
    assert.equal((await cmd("ENTER", { buildingId: "b-market" })).ok, true);
    await page.waitForTimeout(200);
    const before = await state();
    const r = await cmd("BUY", { businessId: "market", item: "simit", quantity: 1 });
    assert.equal(r.ok, true, r.reason);
    const after = await state();
    assert.equal(after.player.inventory.simit, (before.player.inventory.simit || 0) + 1);
    const market = before.businesses.find(b => b.id === "market"), price=market.prices.simit;
    assert.equal(after.businesses.find(b=>b.id==="market").stock.simit, market.stock.simit-1);
    assert.equal(after.accounts.player, before.accounts.player-price);
    assert.equal(after.accounts["business:market"], before.accounts["business:market"]+price);
    const transfer=after.ledger.at(-1);
    assert.deepEqual([transfer.reason,transfer.from,transfer.to,transfer.amount],["purchase","player","business:market",price]);
    await page.screenshot({ path: out + "/interior.png" });
  }, ["SE-022-stock-cash"]);
  await test("SE-019,SE-020", async () => {
    assert.equal((await cmd("APPLY_JOB", { jobId: "retail" })).ok, true);
    assert.equal((await cmd("START_SHIFT")).ok, true);
    const before = await state();
    assert.ok(before.player.shift);
    await step(610);
    const after = await state();
    assert.equal(after.player.shift, null);
    assert.ok(after.accounts.player > before.accounts.player);
    const pay = after.ledger.filter((e) => e.reason === "player-payroll");
    assert.ok(pay.length === 1);
    await step(20);
    assert.equal((await state()).ledger.filter((e) => e.reason === "player-payroll").length, 1);
  });
  await test("SE-014", async () => {
    const r = await cmd("EXIT");
    assert.equal(r.ok, true, r.reason);
    const s = await state();
    assert.equal(s.player.location.scene, "outside");
    assert.ok(Math.hypot(s.player.location.x - 27, s.player.location.y - 14.7) < 0.1);
  });
  await test("SE-035", async () => {
    const q = (await state()).quests.find((q) => q.kind === "delivery" && q.status === "offered");
    assert.ok(q, "delivery quest exists");
    assert.equal((await cmd("ACCEPT_QUEST", { questId: q.id })).ok, true);
    await cmd("MOVE_TO", { x: 50, y: 49.7 });
    await step(1200);
    const r = await cmd("COMPLETE_QUEST", { questId: q.id });
    assert.equal(r.ok, true, r.reason);
    const before = (await state()).accounts.player;
    assert.equal((await cmd("COMPLETE_QUEST", { questId: q.id })).ok, false);
    assert.equal((await state()).accounts.player, before);
  });
  await test("SE-033", async () => {
    const s = await state();
    const v = s.vehicles.find((v) => v.id === "v0");
    assert.ok(v && !v.driverId, "the starter car is available");
    await cmd("MOVE_TO", v.location);
    await step(1200);
    const r = await cmd("VEHICLE_ENTER", { vehicleId: v.id });
    assert.equal(r.ok, true, r.reason);
    assert.ok((await cmd("DRIVE", { throttle: 1, steer: 0 })).ok);
    const car = (s) => s.vehicles.find((item) => item.id === v.id);
    const inParkingManeuver = (s) => s.mobility.driverBreaks?.some(
      (b) => b.vehicleId === v.id && ["toBay", "fromBay", "disabled"].includes(b.phase),
    );
    await stepUntil((s) => !inParkingManeuver(s) && car(s).speed > 0.6, {
      batch: 20,
      maxTicks: 1200,
      reason: "starter car physically left its bay and accelerated on the lane",
    });
    await step(30);
    await cmd("DRIVE", { throttle: 0, steer: 0 });
    await page.evaluate(() => window.__socialEngine.save("slot-1"));
    const before = await state();
    await page.evaluate(async () => {await window.__socialEngine.load("slot-1"); window.__socialEngine.pause(true);});
    const after = await state();
    assert.equal(after.player.vehicleId, before.player.vehicleId);
    assert.deepEqual(after.player.location, before.player.location);
    assert.deepEqual(after.vehicles.find(c=>c.id===v.id),before.vehicles.find(c=>c.id===v.id));
    assert.equal(after.player.location.scene, "outside");
    assert.ok((await cmd("DRIVE", { throttle: -1, steer: 0 })).ok);
    await stepUntil((s) => car(s).speed <= 0.6, {
      batch: 4,
      maxTicks: 40,
      reason: "loaded car responded to the brake before attempting to exit",
    });
    const exit = await cmd("VEHICLE_EXIT");
    assert.equal(exit.ok, true, exit.reason);
    assert.equal((await state()).player.vehicleId, null);
  }, ["SE-033-exact-position"]);
  await test("SE-031,SE-029,SE-030", async () => {
    const s = await state();
    let n = s.npcs.find((n) => n.id === "n0");
    assert.ok(n);
    if (n.location.scene !== "outside") {
      const b = BUILDINGS.find((b) => b.id === n.location.scene);
      assert.ok(b);
      await cmd("MOVE_TO", b.door);
      await step(450);
      assert.equal((await cmd("ENTER", { buildingId: b.id })).ok, true);
    }
    n = (await state()).npcs.find((p) => p.id === n.id);
    await cmd("MOVE_TO", n.location);
    await step(60);
    await page.evaluate(()=>window.__socialEngine.pause(true));
    const preAttack=await state();
    const r = await cmd("ATTACK", { npcId: n.id });
    assert.equal(r.ok, true, r.reason);
    const struck=await state();
    assert.equal(struck.tick,preAttack.tick,"capture the attack at one paused simulation tick");
    assert.equal(struck.player.stamina,preAttack.player.stamina-12);
    assert.equal((await cmd("BLOCK",{active:true})).ok,true);
    assert.equal((await state()).player.blocking,true);
    await step(5);
    const a = await state();
    assert.ok(a.crimes.length);
    assert.ok(a.npcs.find((v) => v.id === n.id).health < n.health);
    await step(10);
    const guarded=await state();
    assert.equal(guarded.player.health,a.player.health-3);
    assert.equal(guarded.player.stamina,a.player.stamina-6,"successful block consumes six stamina without passive recovery");
    await cmd("BLOCK", { active: false });
    await step(90);
    assert.ok((await state()).player.wanted > 0);
    assert.equal((await cmd("SURRENDER")).ok, true);
    assert.equal((await state()).player.wanted, 0);
  }, ["SE-031-stamina-block"]);
  await test("SE-040,SE-055", async () => {
    await page.evaluate(() => window.__socialEngine.pause(true));
    const saved = await page.evaluate(async () => {
      const auto = window.__socialEngine.save("auto");
      const manual = window.__socialEngine.save("slot-2");
      return [await auto, await manual];
    });
    assert.deepEqual(saved, [true, true], "manual request must wait behind automatic save");
    const before = await state();
    await page.evaluate(() => window.__socialEngine.load("slot-2"));
    await page.waitForTimeout(500);
    await page.evaluate(() => window.__socialEngine.pause(true));
    const after = await state();
    assert.equal(after.accounts.player, before.accounts.player);
    assert.deepEqual(after.player.inventory, before.player.inventory);
    assert.equal(after.player.name, before.player.name);
    const displayedCash = await page.getByTestId("balance").innerText();
    assert.equal(displayedCash,new Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY",maximumFractionDigits:2}).format(after.accounts.player/100));
    for (const [label,expected] of [["Sağlık",after.player.health],["Enerji",after.player.stamina],["Tokluk",100-after.player.hunger]])
      assert.equal(Number(await page.getByRole("meter",{name:label,exact:true}).getAttribute("aria-valuenow")),expected);
    await page.screenshot({ path: out + "/final.png" });
  }, ["SE-055-dom-hud"]);
  await test("SE-057", async () => {
    for (const size of [
      { width: 1280, height: 720 },
      { width: 1920, height: 1080 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(size);
      await page.waitForTimeout(200);
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      );
      await page.screenshot({ path: out + `/viewport-${size.width}.png` });
    }
  });
  assert.deepEqual(errors, []);
} catch (e) {
  report.failure = e.stack;
} finally {
  report.metrics = await page.evaluate(() => window.__socialEngine?.metrics()).catch(() => null);
  report.finished = new Date().toISOString();
  await writeFile(out + "/results.json", JSON.stringify(report, null, 2));
  await context.tracing.stop({ path: out + "/trace.zip" });
  await context.close();
  await browser.close();
  console.log(JSON.stringify(report, null, 2));
  if (report.failure) process.exitCode = 1;
}
