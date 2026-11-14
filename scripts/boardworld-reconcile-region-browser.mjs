// Diagnostic fixture only: validates existing move/marriage controls and views,
// not a naturally earned relationship or an A–I playthrough.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createStaticGameServer } from "./static-game-server.mjs";
import { openBoardworldTab } from "./boardworld-browser-navigation.mjs";
import {
  createGame,
  expandGame,
  getActions,
  loadExpansionRuntime,
  resolveAction,
} from "../public/games/tc-sim-boardworld/engine.mjs";
import { exportGame } from "../public/games/tc-sim-boardworld/persistence.mjs";

await loadExpansionRuntime();
let fixture = expandGame(createGame({ seed: 123, name: "<Deniz &>" }));
while (fixture.pendingEvents.length) {
  const action = getActions(fixture).find((a) => a.id.startsWith("event:") && !a.disabled);
  const result = resolveAction(fixture, action.id);
  assert.ok(result.ok, result.message);
  fixture = result.state;
}
fixture.flags.partner = "ece";
fixture.npcs.ece.trust = 80;
fixture.npcs.ece.affinity = 80;
assert.equal(getActions(fixture).find((a) => a.id === "family:marry")?.disabled, false);
const bytes = exportGame(fixture);
const server = createStaticGameServer(process.argv[2] || "public");
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    args: ["--no-sandbox"],
  });
  let checks = 0;
  for (const language of ["tr", "en", "pl"]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    try {
      await context.addInitScript(
        (lang) => localStorage.setItem("tariklab.language", lang),
        language,
      );
      const page = await context.newPage(),
        errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${server.address().port}/games/tc-sim-boardworld/`);
      await page.locator('[data-testid="create-game"]').click();
      await page.waitForFunction(() => window.boardworldInspect?.()?.version === 6);
      await openBoardworldTab(page, "expansion");
      await page.locator('[data-ui="expand"]').click();
      await page.waitForFunction(() => window.boardworldInspect?.()?.version === 7);
      await page
        .locator("#import-file")
        .setInputFiles({
          name: "fixture.json",
          mimeType: "application/json",
          buffer: Buffer.from(bytes),
        });
      await page.waitForFunction(
        (seed) => window.boardworldInspect?.()?.seed === seed,
        fixture.seed,
      );
      await openBoardworldTab(page, "expansion");
      await page.locator('[data-action="family:marry"]').click();
      await page.waitForFunction(() =>
        window.boardworldInspect?.()?.expansion.events.some((e) => e.type === "family-marriage"),
      );
      const marriage = await page.evaluate(() =>
        window.boardworldInspect().expansion.events.find((e) => e.type === "family-marriage"),
      );
      assert.match(marriage.subject, /^union:/);
      await openBoardworldTab(page, "expansion-world");
      const history = page
        .locator("details")
        .filter({ has: page.locator("ol") })
        .last();
      await history.locator("summary").click();
      const row = history.locator("li").filter({ hasText: "Deniz" }).first();
      assert.match(await row.innerText(), /<Deniz &>/);
      assert.match(await row.innerText(), /Ece Yalın/);
      assert.ok(!(await row.innerText()).includes(marriage.subject));
      assert.equal(
        await row.locator("deniz").count(),
        0,
        "name must be escaped, not parsed as markup",
      );
      await page.locator('[data-action="world:move:ankara"]').click();
      await page.waitForFunction(
        () => window.boardworldInspect?.()?.expansion.world.region === "ankara",
      );
      const afterMove = await page.evaluate(() => window.boardworldInspect());
      assert.equal(afterMove.location, fixture.location, "Gold İstanbul anchor remains preserved");
      await openBoardworldTab(page, "board");
      assert.equal(await page.locator("#panel-heading").innerText(), "Ankara");
      assert.equal(
        await page.locator(".city-node.current").count(),
        0,
        "no İstanbul current marker away",
      );
      assert.ok(await page.locator('[data-action="world:move:istanbul"]').isVisible());
      const board = await page.locator("#main").innerText();
      await openBoardworldTab(page, "expansion-world");
      assert.equal(
        await page.locator("#main").innerText(),
        board,
        "board reuses actual regional view",
      );
      // The planner remains usable away, but new Istanbul plans explain the
      // authoritative regional constraint in the selected language.
      await openBoardworldTab(page, "plan");
      const planningReason = {
        tr: "Yeni İstanbul planları için önce İstanbul'a dön.",
        en: "Return to Istanbul before making new Istanbul plans.",
        pl: "Wróć do Stambułu przed ustaleniem nowych planów w tym mieście.",
      }[language];
      assert.equal(await page.locator(".slot-reason").innerText(), planningReason);
      await page.locator("[data-calendar-preview]").click();
      assert.ok((await page.locator(".forecast-dialog").innerText()).includes(planningReason));
      await page.locator(".dialog-close").click();
      await openBoardworldTab(page, "expansion-world");
      await page.locator('[data-action="world:move:istanbul"]').click();
      await page.waitForFunction(
        () => window.boardworldInspect?.()?.expansion.world.region === "istanbul",
      );
      await openBoardworldTab(page, "board");
      assert.equal(await page.locator(".city-node.current").count(), 1, "İstanbul board restored");
      assert.deepEqual(errors, []);
      checks++;
    } finally {
      await context.close();
    }
  }
  console.log(
    JSON.stringify({
      checks,
      languages: ["tr", "en", "pl"],
      fixture: "prepared relationship; real marry and moves",
      source: process.argv[2] || "public",
    }),
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
