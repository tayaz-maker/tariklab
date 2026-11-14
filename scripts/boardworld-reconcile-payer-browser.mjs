// Real-card regression for business-account spending versus personal payment.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createStaticGameServer } from "./static-game-server.mjs";
import { openBoardworldTab } from "./boardworld-browser-navigation.mjs";
import {
  createGame,
  getActions,
  loadExpansionRuntime,
  resolveAction,
} from "../public/games/tc-sim-boardworld/engine.mjs";
import { exportGame } from "../public/games/tc-sim-boardworld/persistence.mjs";

await loadExpansionRuntime();
function businessLife(expansion) {
  let state = createGame({ scenario: "restart", seed: 303, expansion });
  state.bank = 120000;
  for (const id of [
    "business:start:repair",
    "business:fund:2000",
    "business:stock:6",
    "business:acquire",
  ]) {
    while (state.pendingEvents.length) {
      const event = getActions(state).find((a) => a.id.startsWith("event:") && !a.disabled);
      const result = resolveAction(state, event.id);
      assert.ok(result.ok, result.message);
      state = result.state;
    }
    const result = resolveAction(state, id);
    assert.ok(result.ok, `${id}: ${result.message}`);
    state = result.state;
  }
  return state;
}
const fixtures = [businessLife(false), businessLife(true)];
const labels = {
  tr: {
    noPersonal: "Kişisel ödeme yok",
    free: "Ücretsiz",
    payer: /işletme kasasından/i,
    arrears: /borca geçer/i,
  },
  en: {
    noPersonal: "No personal payment",
    free: "Free",
    payer: /business funds/i,
    arrears: /arrears/i,
  },
  pl: {
    noPersonal: "Brak płatności osobistej",
    free: "Bezpłatnie",
    payer: /kasy firmy/i,
    arrears: /zaległości/i,
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
    for (const fixture of fixtures) {
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
        if (fixture.expansion) {
          await openBoardworldTab(page, "expansion");
          await page.locator('[data-ui="expand"]').click();
          await page.waitForFunction(() => window.boardworldInspect?.()?.version === 7);
        }
        await page.locator("#import-file").setInputFiles({
          name: "fixture.json",
          mimeType: "application/json",
          buffer: Buffer.from(exportGame(fixture)),
        });
        await page.waitForFunction(
          (seed) => window.boardworldInspect?.()?.seed === seed,
          fixture.seed,
        );
        await openBoardworldTab(page, "enterprise");
        const actions = getActions(fixture);
        for (const id of [
          "business:pause",
          "business:stock:3",
          "business:serve",
          "business:upgrade",
        ]) {
          const action = actions.find((a) => a.id === id);
          assert.ok(action, id);
          const card = page
            .locator(".action-card")
            .filter({ has: page.locator(`[data-action="${id}"]`) });
          await card.waitFor();
          const badge = await card.locator(".action-cost").innerText();
          if (action.cost === 0)
            assert.equal(badge, labels[language].noPersonal, `${language}/${id}`);
          else {
            const cost = new Intl.NumberFormat(
              { tr: "tr-TR", en: "en-GB", pl: "pl-PL" }[language],
            ).format(action.cost);
            assert.ok(badge.includes(cost), `${language}/${id}: ${badge}`);
          }
          assert.equal(await card.locator(`[data-action="${id}"]`).isDisabled(), !!action.disabled);
          assert.ok((await card.locator(".action-time").innerText()).trim());
          if (id === "business:stock:3" || id === "business:serve") {
            const description = await card.locator("p").first().innerText();
            for (const match of action.description.matchAll(/(\d+) TL/g))
              assert.ok(
                description.includes(match[1]),
                `${language}/${id}: missing ${match[1]} in ${description}`,
              );
          }
          if (fixture.expansion && id === "business:pause") {
            assert.equal(action.cost, 0);
            const fee = action.description.match(/^(\d+) TL/)?.[1];
            assert.equal(fee, "23");
            const description = await card.locator("p").first().innerText();
            assert.ok(description.includes(fee), `${language}: ${description}`);
            assert.match(description, labels[language].payer);
            assert.match(description, labels[language].arrears);
            assert.notEqual(badge, labels[language].free);
          }
          checks++;
        }
        if (fixture.expansion) {
          await openBoardworldTab(page, "expansion");
          const support = actions.find((a) => a.id.startsWith("family:support:"));
          assert.ok(support && support.cost === 0);
          const card = page
            .locator(".action-card")
            .filter({ has: page.locator(`[data-action="${support.id}"]`) });
          assert.equal(await card.locator(".action-cost").innerText(), labels[language].free);
          checks++;
        } else {
          await openBoardworldTab(page, "work");
          const personal = actions.find((a) => a.category === "work" && a.cost === 0);
          assert.ok(personal);
          const card = page
            .locator(".action-card")
            .filter({ has: page.locator(`[data-action="${personal.id}"]`) });
          assert.equal(await card.locator(".action-cost").innerText(), labels[language].free);
          checks++;
        }
        assert.deepEqual(errors, []);
      } finally {
        await context.close();
      }
    }
  console.log(
    JSON.stringify({
      checks,
      languages: ["tr", "en", "pl"],
      modes: ["Gold", "expansion"],
      source: process.argv[2] || "public",
    }),
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
