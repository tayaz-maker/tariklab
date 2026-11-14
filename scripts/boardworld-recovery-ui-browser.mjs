// Focused source-level browser proof: displayed card fields must retain the
// actual action's payer/cost/time and consequences after copy consolidation.
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
let initial = expandGame(createGame({ scenario: "restart", seed: 303 }));
initial.bank = 120000;
while (initial.pendingEvents.length) {
  const action = getActions(initial).find((a) => a.id.startsWith("event:") && !a.disabled);
  const result = resolveAction(initial, action.id);
  assert.ok(result.ok, result.message);
  initial = result.state;
}
const mortgage = resolveAction(initial, "economy:mortgage:istanbul:room");
assert.ok(mortgage.ok, mortgage.message);
const cases = [
  { state: initial, ids: ["economy:buy:istanbul:room", "economy:mortgage:istanbul:room"] },
  { state: mortgage.state, ids: ["economy:maintain:istanbul:room", "economy:repay:istanbul:room"] },
];
const terms = {
  tr: {
    buy: [/tapu/i],
    mortgage: [/peşinat/i, /%0,8/, /%4/, /üç/i, /tasfiye/i],
    maintain: [/kondisyon/i, /\+18/],
    repay: [/önce faiz/i, /sonra anapara/i],
  },
  en: {
    buy: [/purchase/i],
    mortgage: [/deposit/i, /0\.8%/, /4%/, /three/i, /foreclosure/i],
    maintain: [/condition/i, /\+18/],
    repay: [/interest first/i, /then principal/i],
  },
  pl: {
    buy: [/zakupu/i],
    mortgage: [/wkład/i, /0,8%/, /4%/, /3/, /przejęci/i],
    maintain: [/stan/i, /\+18/],
    repay: [/najpierw odsetki/i, /potem kapitał/i],
  },
};
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
  for (const language of ["tr", "en", "pl"])
    for (const fixture of cases) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      try {
        await context.addInitScript(
          (language) => localStorage.setItem("tariklab.language", language),
          language,
        );
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.goto(`http://127.0.0.1:${server.address().port}/games/tc-sim-boardworld/`);
        await page.locator('[data-testid="create-game"]').click();
        await page.waitForFunction(() => window.boardworldInspect?.()?.version === 6);
        await page.waitForFunction(
          () => !document.querySelector(".save-state")?.textContent.includes("Kaydediliyor"),
        );
        await openBoardworldTab(page, "expansion");
        await page.locator('[data-ui="expand"]').click();
        await page.waitForFunction(() => window.boardworldInspect?.()?.version === 7);
        await page.waitForFunction(
          () => !document.querySelector(".save-state")?.textContent.includes("Kaydediliyor"),
        );
        await page
          .locator("#import-file")
          .setInputFiles({
            name: "fixture.json",
            mimeType: "application/json",
            buffer: Buffer.from(exportGame(fixture.state)),
          });
        try {
          await page.waitForFunction(
            (expected) => window.boardworldInspect?.()?.seed === expected,
            fixture.state.seed,
            { timeout: 4000 },
          );
        } catch (error) {
          throw new Error(
            `fixture import failed: ${await page.locator("#notice").innerText()} / ${errors.join("; ")}`,
            { cause: error },
          );
        }
        await openBoardworldTab(page, "expansion-finance");
        const current = getActions(fixture.state);
        for (const id of fixture.ids) {
          const action = current.find((a) => a.id === id);
          assert.ok(action, id);
          const card = page
            .locator(".action-card")
            .filter({ has: page.locator(`[data-action="${id}"]`) });
          await card.waitFor();
          const actual = await card.innerText();
          const cost = new Intl.NumberFormat(
            { tr: "tr-TR", en: "en-GB", pl: "pl-PL" }[language],
          ).format(action.cost);
          assert.ok(
            (await card.locator(".action-cost").innerText()).includes(cost),
            `${language}/${id}: cost ${actual}`,
          );
          const duration = await card.locator(".action-time").innerText();
          const hours = Math.floor(action.minutes / 60),
            minutes = action.minutes % 60;
          if (hours)
            assert.match(duration, new RegExp(`\\b${hours}\\b`), `${language}/${id}: ${duration}`);
          if (minutes)
            assert.match(
              duration,
              new RegExp(`\\b${minutes}\\b`),
              `${language}/${id}: ${duration}`,
            );
          assert.equal(
            await card.locator(`[data-action="${id}"]`).isDisabled(),
            !!action.disabled,
            `${language}/${id}: eligibility`,
          );
          if (action.disabled)
            assert.ok(
              (await card.locator(".action-reason").innerText()).trim(),
              `${language}/${id}: missing reason`,
            );
          const kind = id.split(":")[1];
          for (const term of terms[language][kind])
            assert.match(actual, term, `${language}/${id}: missing ${term}`);
          checks++;
        }
        assert.deepEqual(errors, []);
      } finally {
        await context.close();
      }
    }
  console.log(
    JSON.stringify({ checks, languages: ["tr", "en", "pl"], source: process.argv[2] || "public" }),
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
