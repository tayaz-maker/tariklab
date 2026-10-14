import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { createNewGame } from "../public/games/tc-sim/js/state.js";
import { rentToLive } from "../public/games/tc-sim/js/quarters.js";
import { openHatirWeek, processMarchRent } from "../public/games/tc-sim/js/march-hatir.js";
import { createStaticGameServer } from "./static-game-server.mjs";

const out = "/workspace/screenshots/tc-sim-march-hatir";
mkdirSync(out, { recursive: true });

const quiet = (state) => {
  state.events.active = null;
  state.events.queue = [];
  if (state.world?.scenario) state.world.scenario.pendingEvent = null;
};

function marchState() {
  const state = createNewGame({ name: "Mart", now: "2027-01-01T00:00:00.000Z", seed: 11 });
  state.finances.balance = 800000;
  quiet(state);
  assert.equal(rentToLive(state, "sirt", "1+1").ok, true);
  state.weekly = { used: 0, selectedIds: [] };
  state.time.absoluteWeek = 9;
  state.time.month = 3;
  state.time.weekOfMonth = 1;
  state.time.year = 2027;
  state.time.date = "2027-03-01";
  state.time.dateOrigin = "2027-03-01";
  state.time.dateOriginWeek = 9;
  const note = processMarchRent(state);
  assert.match(note, /Mart/);
  assert.match(note, /400/);
  quiet(state);
  return state;
}

function hatirState() {
  const state = createNewGame({ name: "Hatır", now: "2027-01-01T00:00:00.000Z", seed: 11 });
  state.finances.balance = 800000;
  state.time.absoluteWeek = 14;
  state.time.month = 4;
  state.time.weekOfMonth = 2;
  state.time.year = 2027;
  state.time.date = "2027-04-08";
  state.time.dateOrigin = "2027-04-08";
  state.time.dateOriginWeek = 14;
  const note = openHatirWeek(state);
  assert.match(note, /Düğün/);
  quiet(state);
  return state;
}

const server = createStaticGameServer("/workspace/tariklab/public");
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell",
  args: ["--no-sandbox"],
});
const errors = [];
try {
  for (const [name, width, height, state, ready, button, savedCheck] of [
    ["march-desktop", 1280, 800, marchState(), "Mart", "march-overtime", (saved) => {
      assert.equal(saved.meta.saveVersion, 6);
      assert.equal(saved.weekly.used, 1);
      assert.ok(saved.finances.ledger.some((row) => row.reason === "Mart zammı mesaisi" && row.amount === 400));
      assert.equal(saved.career.jobId, "market");
    }],
    ["march-mobile", 390, 844, marchState(), "Mart", "march-overtime", (saved) => {
      assert.equal(saved.meta.saveVersion, 6);
      assert.equal(saved.flags.calendar.openMarch.choice, "overtime");
    }],
    ["hatir-desktop", 1280, 800, hatirState(), "Düğün", "hatir-small", (saved) => {
      assert.equal(saved.meta.saveVersion, 6);
      assert.equal(saved.flags.calendar.hatir.at(-1).outcome, "kucuk");
      assert.equal(saved.flags.calendar.hatir.at(-1).envelope, 500);
    }],
    ["hatir-mobile", 390, 844, hatirState(), "küçük", "hatir-small", (saved) => {
      assert.equal(saved.meta.saveVersion, 6);
      assert.equal(saved.weekly.used, 1);
    }],
  ]) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: width < 500, hasTouch: width < 500 });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(`${name}:${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(`${name}:${message.text()}`);
    });
    await context.addInitScript((payload) => {
      localStorage.setItem("tariklab::tc-sim:1", payload);
      localStorage.setItem("tariklab::tc-sim:active", "1");
      localStorage.setItem("tariklab.language", "tr");
    }, JSON.stringify(state));
    await page.goto(`${origin}/games/tc-sim/index.html`, { waitUntil: "networkidle" });
    await page.locator("#continue-game").click();
    await page.waitForFunction((needle) => document.body.innerText.includes(needle), ready);
    const action = page.locator(`[data-decision="${button}"]`);
    await action.scrollIntoViewIfNeeded();
    await action.click();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 1, `${name} overflow ${overflow}`);
    const saved = JSON.parse(await page.evaluate(() => localStorage.getItem("tariklab::tc-sim:1")));
    savedCheck(saved);
    await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("march-hatir browser smoke ok");
