import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { createNewGame } from "../public/games/tc-sim/js/state.js";
import { riskNight } from "../public/games/tc-sim/js/risk-layer.js";
import { createStaticGameServer } from "./static-game-server.mjs";

const out = "/workspace/screenshots/tc-sim-risk";
mkdirSync(out, { recursive: true });

function scene() {
  const state = createNewGame({ name: "Risk", now: "2027-01-01T00:00:00.000Z", seed: 11 });
  state.finances.balance = 20000;
  state.player.age = 27;
  state.events.active = null;
  state.events.queue = [];
  if (state.world?.scenario) state.world.scenario.pendingEvent = null;
  state.time.weekOfMonth = 3;
  state.time.absoluteWeek = 11;
  state.time.month = 3;
  state.time.year = 2027;
  const elif = state.people.find((person) => person.id === "elif");
  elif.social.romanceStatus = "partner";
  state.social.currentPartnerNpcId = "elif";
  const night = riskNight(state);
  assert.equal(night.ok, true);
  // syncGameDate rebuilds weekOfMonth from dateOrigin. Day 8 keeps the fight slot (week 2).
  state.time.dateOrigin = "2027-03-08";
  state.time.dateOriginWeek = state.time.absoluteWeek;
  state.time.date = "2027-03-08";
  state.time.year = 2027;
  state.time.month = 3;
  state.time.day = 8;
  state.time.weekOfMonth = 2;
  if (state.world?.scenario) state.world.scenario.currentDate = "2027-03-08";
  state.health.stress = 60;
  state.weekly = { used: 0, selectedIds: [] };
  state.events.active = null;
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
    const balance = state.finances.balance;
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
      await page.waitForFunction(() => document.body.innerText.includes("Sağlık dosyası") && document.body.innerText.includes("Kavgaya gir"), { timeout: 15000 });
    } catch (error) {
      const probe = await page.evaluate(() => ({
        text: document.body.innerText.slice(0, 1800),
        decisions: [...document.querySelectorAll("[data-decision]")].map((node) => node.getAttribute("data-decision")),
      }));
      console.error(name, JSON.stringify(probe), errors.join(" | "));
      throw error;
    }
    const action = page.locator('[data-decision="risk-fight"]');
    await action.scrollIntoViewIfNeeded();
    await action.click();
    await page.waitForFunction(() => document.body.innerText.includes("Kavga dosyaya geçti"));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 1, `${name} overflow ${overflow}`);
    const saved = JSON.parse(await page.evaluate(() => localStorage.getItem("tariklab::tc-sim:1")));
    assert.equal(saved.meta.saveVersion, 6);
    assert.equal(saved.finances.balance, balance - 900);
    assert.equal(saved.weekly.used, 1);
    assert.equal(saved.openCases.some((item) => item.type === "risk-dosya" && item.payload.kind === "kavga"), true);
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
console.log("risk browser smoke ok");
