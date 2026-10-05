import assert from "node:assert/strict";
import { fixture, place, act } from "./duel-fixture.mjs";
import { pools } from "./duel-pools.mjs";
import { serialize } from "../public/games/duel-core/save.js";
import { assertSameOrigin } from "./duel-origin-proof.mjs";

// Seeded saved positions exercise visible controls, never private browser APIs.
export async function duelScenarios(browser, origin) {
  for (const theme of ["veto-h", "gett-oh"])
    for (const lang of ["tr", "en"]) {
      const tr = lang === "tr",
        prefix = theme === "veto-h" ? "SND" : "RCN",
        key = `tariklab.${theme}.duel`;
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const errors = [];
      const page = await context.newPage();
      page.on("pageerror", (e) => errors.push(e.message));
      const saved = () =>
        page.evaluate((k) => JSON.parse(JSON.parse(localStorage.getItem(k)).payload), key);
      async function load(s) {
        const raw = serialize(s);
        await page.goto(origin);
        assertSameOrigin(page.url(), origin, `${theme}/${lang} fixture page`);
        await page.evaluate(
          ({ key, raw, lang }) => {
            localStorage.setItem(key, raw);
            localStorage.setItem("tariklab.language", lang);
          },
          { key, raw, lang },
        );
        await page.goto(`${origin}/games/${theme}/index.html`);
        assertSameOrigin(page.url(), origin, `${theme}/${lang} scenario game`);
        await page.getByRole("button", { name: tr ? "Devam Et" : "Continue", exact: true }).click();
        await page.locator(".duel-table").waitFor();
      }
      async function confirm() {
        const btn = page.locator("dialog").getByRole("button", { name: tr ? "Onayla" : "Confirm", exact: true });
        if (await btn.count()) await btn.click();
      }
      async function firstChoice() {
        if (await page.locator("dialog .choice-list button").count())
          await page.locator("dialog .choice-list button").first().click();
        await confirm();
      }
      async function resolveChoice() {
        for (let n = 0; n < 6; n++) {
          const s = await saved();
          if (!s.choice) break;
          assert.equal(s.choice.player, 0);
          await page
            .locator(".action-dock")
            .getByRole("button", { name: tr ? "Seç" : "Choose", exact: true })
            .click();
          await firstChoice();
        }
      }
      // Low-level new card: summon, rights, normal reload, targeted paid recovery.
      let s = fixture(theme);
      const unit = place(s, `${prefix}-152`, 0, "hand"),
        recover = place(s, `${prefix}-155`, 0, "grave");
      await load(s);
      await page.locator(`.hand-row [data-card="${unit}"]`).click();
      assert.ok(await page.locator(".zone.legal").count());
      await page
        .locator(".inspector-actions")
        .getByRole("button", {
          name:
            theme === "veto-h"
              ? tr
                ? "Normal Çağır"
                : "Normal Summon"
              : tr
                ? "Sahaya Sür"
                : "Deploy Crew",
          exact: true,
        })
        .click();
      await firstChoice();
      assert.equal((await saved()).players[0].normalUsed, 1);
      const raw = await page.evaluate((k) => localStorage.getItem(k), key);
      await page.reload();
      assert.equal(await page.evaluate((k) => localStorage.getItem(k), key), raw);
      await page.getByRole("button", { name: tr ? "Devam Et" : "Continue", exact: true }).click();
      await page.locator(`.zone [data-card="${unit}"]`).click();
      await page
        .locator(".inspector-actions")
        .getByRole("button", { name: tr ? "Etkiyi Kullan" : "Activate Effect", exact: true })
        .click();
      await firstChoice();
      await resolveChoice();
      s = await saved();
      assert.equal(s.players[0].points, 7700);
      assert.ok(s.players[0].hand.includes(recover));
      assert.equal(s.cards[unit].used.activate, 3);
      // Real tribute selection and one normal right.
      s = fixture(theme);
      const tribute = place(s, `${prefix}-152`, 0, "units");
      const big = pools[theme]
        .slice(150)
        .find((c) => c.kind === "unit" && c.level === 5 && c.deckLocation === "main");
      const boss = place(s, big.id, 0, "hand");
      await load(s);
      await page.locator(`.hand-row [data-card="${boss}"]`).click();
      await page
        .locator(".inspector-actions")
        .getByRole("button", {
          name:
            theme === "veto-h"
              ? tr
                ? "İstifa ile Çağır"
                : "Summon by Resignation"
              : tr
                ? "Adam Yakarak Sür"
                : "Tribute Crew",
          exact: true,
        })
        .click();
      await firstChoice();
      s = await saved();
      assert.ok(s.players[0].grave.includes(tribute));
      assert.ok(s.players[0].units.includes(boss));
      assert.equal(s.players[0].normalUsed, 1);
      // Battle target confirmation and spent-attack presentation; no enemy response.
      s = fixture(theme);
      s.phase = "battle";
      const attacker = place(s, `${prefix}-152`, 0, "units"),
        victim = place(s, `${prefix}-151`, 1, "units");
      await load(s);
      await page.locator(`.zone [data-card="${attacker}"]`).click();
      await page.locator(`.zone [data-card="${victim}"]`).click();
      await confirm();
      s = await saved();
      assert.ok(s.players[1].grave.includes(victim));
      assert.equal(s.cards[attacker].attacksUsed, 1);
      assert.equal(
        (await page.locator(`[data-card="${attacker}"][data-attacked="true"]`).count()) > 0,
        true,
      );
      // New set trap loaded in a real one-response window, including set age and cost.
      s = fixture(theme);
      s.active = 1;
      s.phase = "battle";
      const enemy = place(s, `${prefix}-152`, 1, "units"),
        trap = place(s, `${prefix}-276`, 0, "support"),
        ret = place(s, `${prefix}-155`, 0, "grave");
      s = act(s, { type: "attack", card: enemy, target: null });
      assert.equal(s.pending.responding, 0);
      await load(s);
      await page.locator(`[data-zone="0-support-0"] .playing-card`).click();
      await page
        .locator(".inspector-actions")
        .getByRole("button", { name: tr ? "Cevap Ver" : "Respond", exact: true })
        .click();
      await firstChoice();
      await resolveChoice();
      s = await saved();
      assert.ok(s.players[0].grave.includes(trap));
      assert.ok(s.players[0].hand.includes(ret));
      assert.equal(s.players[0].points, 7650);
      // Auxiliary materials are selected through the pile/inspector UI.
      s = fixture(theme);
      const auxiliary = pools[theme].find((c) => c.id === `${prefix}-235`);
      const materials = auxiliary.traits.materials.series.map((series, index) =>
        place(
          s,
          pools[theme].find((c) => c.kind === "unit" && c.level <= 3 && c.series.includes(series))
            .id,
          0,
          "units",
          index,
        ),
      );
      const auxiliaryUid =
        s.players[0].auxiliary.find((uid) => s.cards[uid].id === auxiliary.id) ||
        place(s, auxiliary.id, 0, "auxiliary");
      assert.ok(auxiliaryUid);
      await load(s);
      await page.locator('[data-pile="0:auxiliary"]').click();
      await page
        .locator("dialog")
        .getByRole("button", { name: auxiliary.name[lang], exact: true })
        .click();
      await page
        .locator("dialog .inspector-actions")
        .getByRole("button", { name: tr ? "Özel Çağır" : "Special Summon", exact: true })
        .click();
      await firstChoice();
      s = await saved();
      assert.ok(s.players[0].units.includes(auxiliaryUid));
      assert.ok(materials.every((uid) => s.players[0].grave.includes(uid)));
      // Real mobile controls: a double-click never draws a second card.
      s = fixture(theme);
      s.phase = "draw";
      const expectedDraw = s.players[0].deck[0];
      await page.setViewportSize({ width: 390, height: 844 });
      await load(s);
      await page.locator(".action-dock > button.primary").dblclick();
      s = await saved();
      assert.equal(s.players[0].hand.length, 1);
      assert.ok(s.players[0].hand.includes(expectedDraw));
      assert.ok(["standby", "main1"].includes(s.phase));
      if (s.phase === "standby") await page.locator(".action-dock > button.primary").click();
      assert.equal((await saved()).phase, "main1");
      assert.deepEqual(errors, []);
      await context.close();
    }
  console.log("DUEL_BROWSER_SCENARIOS_PASS 24 deterministic UI scenarios including mobile Draw");
}
