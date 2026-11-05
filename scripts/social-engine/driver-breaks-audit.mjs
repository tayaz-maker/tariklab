/** Real seven-driver progression, needs/payroll audit and exact browser replay.
 * Fixture changes only initial hunger, a repaired traffic speed and n84's wallet.
 * Meals, stock, wages, walking, parking and time thereafter use production rules. */
import * as engine from "../../src/games/social-engine/simulation/engine.ts";
import * as codec from "../../src/games/social-engine/persistence/codec.ts";
import { transfer } from "../../src/games/social-engine/simulation/ledger.ts";
import { build } from "esbuild";
import { chromium, firefox, webkit } from "playwright";
import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";

async function scenario(api, zeroWallet) {
  let world = api.createWorld(922);
  const people = world.vehicles.filter((v) => v.driverId).map((v) => v.driverId);
  for (const vehicle of world.vehicles)
    if (vehicle.driverId) {
      vehicle.speed = 2.2;
      world.npcs.find((n) => n.id === vehicle.driverId).hunger = 90;
    }
  if (zeroWallet)
    api.transfer(world, "audit-n84-zero-wallet", "n84", "external", world.accounts.n84, "fixture");
  const needs = Object.fromEntries(
    people.map((id) => [
      id,
      {
        maxHunger: 0,
        minHealth: 100,
        ticksAt100BeforeFirstMeal: 0,
        firstMealTick: null,
        firstReturnTick: null,
        initialIncome: world.npcs.find((n) => n.id === id).income,
        earnedIncome: 0,
        mealExpense: 0,
      },
    ]),
  );
  const seen = new Set(),
    saves = [],
    payroll = [];
  let complete = false;
  for (let tick = 0; tick < 50000; tick++) {
    api.stepWorld(world);
    for (const id of people) {
      const p = world.npcs.find((n) => n.id === id),
        m = needs[id],
        b = world.mobility.driverBreaks.find((b) => b.personId === id);
      m.maxHunger = Math.max(m.maxHunger, p.hunger);
      m.minHealth = Math.min(m.minHealth, p.health);
      m.earnedIncome = p.income - m.initialIncome;
      m.mealExpense = p.expenses;
      if (m.firstMealTick === null && p.hunger === 100) m.ticksAt100BeforeFirstMeal++;
      if (b?.lastMealTick !== null && b?.lastMealTick !== undefined && m.firstMealTick === null)
        m.firstMealTick = b.lastMealTick;
      if (m.firstMealTick !== null && m.firstReturnTick === null && b?.phase === "driving")
        m.firstReturnTick = world.tick;
      if (b && !seen.has(b.phase)) {
        seen.add(b.phase);
        const saved = await api.encodeSave("auto", world),
          restored = (await api.decodeSave(saved)).state;
        if (api.canonicalState(restored) !== api.canonicalState(world))
          throw Error("Save mismatch in " + b.phase);
        world = restored;
        saves.push({
          phase: b.phase,
          tick: world.tick,
          hash: await api.sha256(api.canonicalState(world)),
        });
      }
    }
    const wage = world.economy.lastPayroll.find((p) => p.personId === "n84" && p.amount > 0);
    if (wage && !payroll.some((p) => p.day === Math.floor(world.minute / 1440)))
      payroll.push({ day: Math.floor(world.minute / 1440), ...wage });
    if (tick % 1000 === 0) {
      const errors = api.validateState(world);
      if (errors.length) throw Error(errors.join(","));
    }
    if (people.every((id) => needs[id].firstReturnTick !== null)) {
      complete = true;
      break;
    }
  }
  if (!complete)
    throw Error("Incomplete driver cycle: " + JSON.stringify(world.mobility.driverBreaks));
  return {
    zeroWallet,
    completedTick: world.tick,
    gameHours: world.tick / 600,
    needs,
    saves,
    payroll,
    hash: await api.sha256(api.canonicalState(world)),
  };
}

const out = "artifacts/social-engine/driver-breaks";
await mkdir(out, { recursive: true });
const report = {
  status: "RUNNING",
  commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  fixture:
    "seed922, all seven drivers hunger90 and repaired speed2.2; second case additionally transfers n84 wallet to external before tick0",
  node: [],
  browsers: [],
};
const api = { ...engine, ...codec, transfer };
for (const zero of [false, true]) report.node.push(await scenario(api, zero));
await writeFile(out + "/audit.json", JSON.stringify(report, null, 2));
if (process.env.SE_DRIVER_SKIP_BROWSERS !== "1") {
  const bundle = (
    await build({
      stdin: {
        contents:
          "export * from './src/games/social-engine/simulation/engine.ts';export * from './src/games/social-engine/persistence/codec.ts';export {transfer} from './src/games/social-engine/simulation/ledger.ts';",
        resolveDir: process.cwd(),
        loader: "ts",
      },
      bundle: true,
      format: "esm",
      platform: "browser",
      target: "es2022",
      write: false,
    })
  ).outputFiles[0].text;
  const server = createServer((request, response) => {
    response.setHeader(
      "Content-Type",
      request.url === "/bundle.js" ? "text/javascript" : "text/html",
    );
    response.end(
      request.url === "/bundle.js" ? bundle : "<!doctype html><title>Driver replay QA</title>",
    );
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    for (const [name, launcher] of Object.entries({ chromium, firefox, webkit })) {
      const browser = await launcher.launch({
        headless: true,
        ...(name === "chromium" && process.platform === "darwin"
          ? {
              executablePath:
                process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
                "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            }
          : {}),
      });
      try {
        const page = await browser.newPage();
        await page.goto(`http://127.0.0.1:${server.address().port}`);
        const results = await page.evaluate(async (source) => {
          const scenario = (0, eval)("(" + source + ")"),
            api = await import("/bundle.js");
          return [await scenario(api, false), await scenario(api, true)];
        }, scenario.toString());
        assert.deepEqual(results, report.node, name + " differs from Node");
        report.browsers.push({
          name,
          version: browser.version(),
          status: "PASS",
          hashes: results.map((r) => r.hash),
        });
        console.log(JSON.stringify({ browser: name, status: "PASS" }));
        await writeFile(out + "/audit.json", JSON.stringify(report, null, 2));
      } finally {
        await browser.close();
      }
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}
report.status = "PASS";
await writeFile(out + "/audit.json", JSON.stringify(report, null, 2));
console.log(
  JSON.stringify({
    status: report.status,
    cases: report.node.map((r) => ({
      zeroWallet: r.zeroWallet,
      completedTick: r.completedTick,
      gameHours: r.gameHours,
      needs: r.needs,
    })),
    browsers: report.browsers,
  }),
);
