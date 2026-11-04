/** Focused acceptance evidence, real renderer and public command boundary. */
import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
const base = process.env.SE_BASE || "http://127.0.0.1:8097";
const out = "artifacts/social-engine/browser-evidence";
await mkdir(out, { recursive: true });
const bytes = await readFile("public/games/social-engine/build-manifest.json");
const manifest = JSON.parse(bytes);
const report = {
  startedAt: new Date().toISOString(),
  build_sha: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  source_status: "working tree candidate; manifest identifies actual built bytes",
  manifestSha256: createHash("sha256").update(bytes).digest("hex"),
  sourceDigest: manifest.sourceDigest,
  results: [],
  errors: [],
  loadedAssets: [],
};
await writeFile(out + "/build-manifest.json", bytes);
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
    (process.platform === "darwin" ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : chromium.executablePath()),
});
report.environment = {
  browser: await browser.version(),
  viewport: { width: 1440, height: 900 },
  headless: true,
};
const context = await browser.newContext({ viewport: report.environment.viewport });
await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
const page = await context.newPage();
page.on("pageerror", (e) => report.errors.push(e.message));
const responses = [];
page.on("response", (r) => {
  if (r.url().includes("/games/social-engine/"))
    responses.push(
      (async () => {
        try {
          const b = await r.body();
          report.loadedAssets.push({
            url: r.url(),
            sha256: createHash("sha256").update(b).digest("hex"),
            bytes: b.length,
          });
        } catch {
          /* unsuccessful body reads do not constitute evidence */
        }
      })(),
    );
});
const state = () => page.evaluate(() => window.__socialEngine.state());
const cmd = (type, args = {}) =>
  page.evaluate(({ type, args }) => window.__socialEngine.command(type, args), { type, args });
const step = async (count) => {
  await page.evaluate((n) => window.__socialEngine.step(n), count);
  await page.waitForTimeout(150);
};
async function check(id, name, fn) {
  const t = performance.now();
  try {
    await resetWorld();
    const evidence = await fn();
    report.results.push({ id, name, status: "PASS", duration_ms: performance.now() - t, evidence });
  } catch (e) {
    report.results.push({
      id,
      name,
      status: "FAIL",
      duration_ms: performance.now() - t,
      reason: e.stack,
    });
    await page.screenshot({ path: out + "/" + id + "-failure.png" });
  }
}
async function resetWorld() {
  await page.goto(base + "/games/social-engine/index.html?qa=1");
  await page.locator("[name=name]").fill("Deniz Kanıt");
  await page.getByRole("button", { name: "Hikâyene başla" }).click();
  await page.waitForFunction(() => window.__socialEngine?.projection()?.population === 1100);
}
try {
  await check(
    "SE-018",
    "Concurrent dialogue commands resolve once in one authoritative tick",
    async () => {
      const before = await state();
      const results = await Promise.all([
        cmd("TALK", { npcId: "n0", topic: "greet" }),
        cmd("TALK", { npcId: "n0", topic: "greet" }),
      ]);
      assert.equal(results.filter((r) => r.ok).length, 1);
      const after = await state();
      const trust = (s) =>
        s.relations.find((r) => r.from === "n0" && r.to === "player")?.trust ?? 0;
      assert.equal(trust(after) - trust(before), 5);
      return { results, trustBefore: trust(before), trustAfter: trust(after) };
    },
  );
  await check(
    "SE-008",
    "Camera keeps player visible at four traversable world edges at three zoom levels",
    async () => {
      const samples = [];
      for (const point of [
        { x: 1.4, y: 1.4 },
        { x: 62.6, y: 1.4 },
        { x: 62.6, y: 56.4 },
        { x: 1.4, y: 56.4 },
      ]) {
        assert.equal((await cmd("MOVE_TO", point)).ok, true);
        await step(1800);
        assert.ok(
          Math.hypot(
            (await state()).player.location.x - point.x,
            (await state()).player.location.y - point.y,
          ) < 0.2,
        );
        for (const delta of [3000, -1500, -3000]) {
          await page.locator("#world canvas").hover();
          await page.mouse.wheel(0, delta);
          await page.waitForTimeout(700);
          const m = await page.evaluate(() => window.__socialEngine.metrics().renderer);
          const p = (await state()).player.location;
          const screen = {
            x: (p.x - p.y) * 24 * m.zoom + m.cameraTransform.x,
            y: (p.x + p.y) * 12 * m.zoom + m.cameraTransform.y,
          };
          samples.push({ point, screen, metrics: m });
          assert.ok(m.zoom >= 0.75 && m.zoom <= 1.75, "zoom bounds");
          assert.ok(
            screen.x >= 12 &&
              screen.x <= m.viewport.width - 12 &&
              screen.y >= 55 &&
              screen.y <= m.viewport.height - 8,
            `Player at ${JSON.stringify(point)} outside viewport at zoom ${m.zoom}: ${JSON.stringify(screen)}`,
          );
        }
      }
      await page.screenshot({ path: out + "/camera-edges.png" });
      return samples;
    },
  );
  await check(
    "SE-055",
    "Visible HUD cash and needs match authoritative projection after shopping and eating",
    async () => {
      await cmd("MOVE_TO", { x: 27, y: 14.7 });
      await step(20);
      assert.equal((await cmd("ENTER", { buildingId: "b-market" })).ok, true);
      const before = await state();
      assert.equal(
        (await cmd("BUY", { businessId: "market", item: "simit", quantity: 1 })).ok,
        true,
      );
      assert.equal((await cmd("USE_ITEM", { item: "simit" })).ok, true);
      await page.waitForTimeout(250);
      const after = await state();
      assert.ok(after.accounts.player < before.accounts.player);
      const actual = await page.getByTestId("balance").innerText();
      const expected = new Intl.NumberFormat("tr-TR", {
        style: "currency",
        currency: "TRY",
        maximumFractionDigits: 2,
      }).format(after.accounts.player / 100);
      assert.equal(actual, expected);
      const needs = {
        Sağlık: after.player.health,
        Enerji: after.player.stamina,
        Tokluk: 100 - after.player.hunger,
      };
      for (const [name, n] of Object.entries(needs))
        assert.equal(
          Number(
            await page.getByRole("meter", { name, exact: true }).getAttribute("aria-valuenow"),
          ),
          n,
        );
      await page.screenshot({ path: out + "/hud-purchase.png" });
      return {
        beforeBalance: before.accounts.player,
        afterBalance: after.accounts.player,
        actual,
        expected,
        needs,
      };
    },
  );
  await check(
    "SE-033",
    "Driven vehicle, lane progress and player coordinates survive real IndexedDB save/load exactly",
    async () => {
      if ((await state()).player.location.scene !== "outside")
        assert.equal((await cmd("EXIT")).ok, true);
      const v = (await state()).vehicles.find((v) => !v.driverId);
      assert.ok(v);
      assert.equal((await cmd("MOVE_TO", v.location)).ok, true);
      await step(1800);
      assert.equal((await cmd("VEHICLE_ENTER", { vehicleId: v.id })).ok, true);
      assert.equal((await cmd("DRIVE", { throttle: 1, steer: 0 })).ok, true);
      await step(50);
      assert.equal((await cmd("DRIVE", { throttle: 0, steer: 0 })).ok, true);
      await page.evaluate(() => window.__socialEngine.pause(true));
      await page.evaluate(() => window.__socialEngine.save("slot-1"));
      const before = await state();
      await page.evaluate(async () => {
        await window.__socialEngine.load("slot-1");
        window.__socialEngine.pause(true);
      });
      const after = await state();
      assert.equal(after.tick, before.tick, "paused load must not advance time");
      assert.deepEqual(after.player.location, before.player.location);
      assert.equal(after.player.vehicleId, before.player.vehicleId);
      assert.deepEqual(
        after.vehicles.find((x) => x.id === v.id),
        before.vehicles.find((x) => x.id === v.id),
      );
      await page.screenshot({ path: out + "/vehicle-roundtrip.png" });
      return {
        tick: before.tick,
        location: before.player.location,
        vehicle: before.vehicles.find((x) => x.id === v.id),
      };
    },
  );
} catch (e) {
  report.errors.push(e.stack);
} finally {
  await Promise.allSettled(responses);
  report.finishedAt = new Date().toISOString();
  report.status =
    report.errors.length || report.results.some((r) => r.status !== "PASS") ? "FAIL" : "PASS";
  await writeFile(out + "/results.json", JSON.stringify(report, null, 2));
  await context.tracing.stop({ path: out + "/trace.zip" });
  await context.close();
  await browser.close();
  console.log(
    JSON.stringify(
      {
        status: report.status,
        manifestSha256: report.manifestSha256,
        results: report.results.map(({ evidence: _evidence, ...r }) => r),
        errors: report.errors,
      },
      null,
      2,
    ),
  );
  if (report.status !== "PASS") process.exitCode = 1;
}
