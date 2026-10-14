import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { createNewGame } from "../public/games/tc-sim/js/state.js";
import { processPocketWeek } from "../public/games/tc-sim/js/pocket-income.js";
import { createStaticGameServer } from "./static-game-server.mjs";

const out = "/workspace/screenshots/tc-sim-pocket";
mkdirSync(out, { recursive: true });
const state = createNewGame({ name: "Cep", now: "2027-01-01T00:00:00.000Z", seed: 11 });
state.career.weeksInRole = 40;
state.time.month = 6;
state.time.weekOfMonth = 1;
state.time.absoluteWeek = 21;
state.events.active = null;
state.events.queue = [];
if (state.world.scenario) state.world.scenario.pendingEvent = null;
const note = processPocketWeek(state);
assert.match(note, /İkramiye/);
const save = JSON.stringify(state);
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
    }, save);
    await page.goto(`${origin}/games/tc-sim/index.html`, { waitUntil: "networkidle" });
    await page.locator("#continue-game").click();
    await page.waitForFunction(() => document.body.innerText.includes("İkramiye"));
    const gold = page.locator('[data-decision="pocket-gold"]');
    await gold.scrollIntoViewIfNeeded();
    await gold.click();
    await page.locator("text=Altın bozdurma").first().waitFor();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 1, `${name} overflow ${overflow}`);
    const saved = JSON.parse(await page.evaluate(() => localStorage.getItem("tariklab::tc-sim:1")));
    assert.equal(saved.meta.saveVersion, 6);
    assert.equal(saved.flags.pocket.gold, true);
    assert.ok(saved.finances.ledger.some((row) => row.reason === "Altın bozdurma" && row.amount === 8500));
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
console.log("pocket browser smoke ok");
