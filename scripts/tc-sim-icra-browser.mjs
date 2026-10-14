import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { createNewGame } from "../public/games/tc-sim/js/state.js";
import { openIcraNotice } from "../public/games/tc-sim/js/icra.js";
import { createStaticGameServer } from "./static-game-server.mjs";

const out = "/workspace/screenshots/tc-sim-icra";
mkdirSync(out, { recursive: true });

function scene() {
  const state = createNewGame({ name: "Icra", now: "2027-01-01T00:00:00.000Z", seed: 7 });
  state.finances.balance = 20000;
  state.finances.arrears = 3000;
  state.career.jobId = "market";
  state.events.active = null;
  state.events.queue = [];
  if (state.world?.scenario) state.world.scenario.pendingEvent = null;
  state.time.absoluteWeek = 16;
  state.time.dateOrigin = "2027-04-08";
  state.time.dateOriginWeek = 16;
  state.time.date = "2027-04-08";
  state.time.year = 2027;
  state.time.month = 4;
  state.time.day = 8;
  state.time.weekOfMonth = 2;
  if (state.world?.scenario) state.world.scenario.currentDate = "2027-04-08";
  state.weekly = { used: 0, selectedIds: [] };
  openIcraNotice(state, { source: "temerrut", amount: 3000 });
  state.flags.icra = {
    watchWeek: null,
    frozenWeek: null,
    seized: "",
    banner: { week: 16, text: "İcra yazısı geldi. 3000 TL. Öde, taksit bağla, ya da dosya yürür." },
  };
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
  for (const [name, width, height] of [["desktop", 1280, 800], ["mobile", 390, 844]]) {
    const state = scene();
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
    try {
      await page.waitForFunction(() => document.body.innerText.includes("İcrayı kapat") && document.body.innerText.includes("Taksit bağla"), { timeout: 15000 });
    } catch (error) {
      const text = await page.evaluate(() => document.body.innerText.slice(0, 1800));
      console.error(name, text);
      throw error;
    }
    const action = page.locator('[data-decision="icra-pay"]');
    await action.scrollIntoViewIfNeeded();
    await action.click();
    await page.waitForFunction(() => document.body.innerText.includes("İcra kapandı"));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 1, `${name} overflow ${overflow}`);
    const saved = JSON.parse(await page.evaluate(() => localStorage.getItem("tariklab::tc-sim:1")));
    assert.equal(saved.meta.saveVersion, 6);
    assert.equal(saved.finances.balance, 17000);
    assert.equal(saved.finances.arrears, 0);
    assert.equal(saved.weekly.used, 1);
    assert.equal(saved.openCases.some((item) => item.type === "icra" && item.status === "resolved"), true);
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
console.log("icra browser smoke ok");
