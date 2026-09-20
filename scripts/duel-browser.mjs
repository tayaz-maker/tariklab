import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { duelScenarios } from "./duel-browser-scenarios.mjs";
const origin = "http://127.0.0.1:8082";
const out = `${process.env.RUNNER_TEMP || "/workspace"}/screenshots/duel`;
mkdirSync(out, { recursive: true });
const server = spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", "8082"], {
  stdio: "inherit",
});
let browser;
const errors = [],
  metrics = [];
try {
  let ready = false;
  for (let i = 0; i < 150; i++) {
    try {
      ready = (await fetch(origin)).ok;
    } catch {
      /* Server is starting. */
    }
    if (ready) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  assert.ok(ready);
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ["--no-sandbox"],
  });
  for (const theme of ["veto-h", "gett-oh"])
    for (const lang of ["tr", "en"]) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
      await context.addInitScript(
        (language) => localStorage.setItem("tariklab.language", language),
        lang,
      );
      const page = await context.newPage();
      const artRequests = new Set();
      page.on("request", (r) => {
        if (r.url().includes("/assets/cards/")) artRequests.add(r.url());
      });
      page.on("pageerror", (e) => errors.push(`${theme}/${lang}: ${e.message}`));
      page.on("response", (r) => {
        if (r.url().startsWith(origin) && r.status() >= 400)
          errors.push(`${r.status()}: ${r.url()}`);
      });
      const key = `tariklab.${theme}.duel`;
      const labels =
        lang === "tr"
          ? {
              archive: /Kart Arşivi/,
              new: "Yeni Düello",
              close: "Kapat",
              menu: "Ana Menü",
              start: "Düelloyu Başlat",
              rock: "Taş",
              first: "İlk Başla",
              next: "Kart Çek",
              confirm: "Onayla",
              continue: "Devam Et",
              help: "Nasıl Oynanır",
            }
          : {
              archive: /Card Archive/,
              new: "New Duel",
              close: "Close",
              menu: "Main Menu",
              start: "Start Duel",
              rock: "Rock",
              first: "Go First",
              next: "Draw Card",
              confirm: "Confirm",
              continue: "Continue",
              help: "How to Play",
            };
      async function measure(stage) {
        for (const [width, height] of [
          [320, 568],
          [360, 800],
          [390, 844],
          [430, 932],
          [740, 390],
          [768, 1024],
          [1280, 800],
          [1440, 1000],
          [1920, 1080],
        ]) {
          await page.setViewportSize({ width, height });
          const d = await page.evaluate(() => ({
            width: document.documentElement.clientWidth,
            scroll: document.documentElement.scrollWidth,
            text: document.body.innerText.length,
            // Nullish must never reach the player as words. Unicode-aware
            // boundaries: \b treats Turkish "ı" as a non-word character, so a
            // plain \bNaN\b would match inside "alınan".
            nullish: (
              document.body.innerText.match(
                /(?<![\p{L}\p{N}_])(null|undefined)(?![\p{L}\p{N}_])|(?<![\p{L}\p{N}_])NaN(?![\p{L}\p{N}_])|\[object Object\]/gu,
              ) || []
            ).slice(0, 4),
            offenders: [...document.querySelectorAll("body *")]
              .filter((el) => {
                const r = el.getBoundingClientRect();
                return (
                  r.width && r.right > innerWidth + 1 && getComputedStyle(el).position !== "fixed"
                );
              })
              .slice(0, 8)
              .map((el) => ({
                tag: el.tagName,
                class: el.className,
                right: el.getBoundingClientRect().right,
              })),
          }));
          assert.ok(d.text > 50);
          assert.equal(
            d.nullish.length,
            0,
            `${theme}/${lang}/${stage}/${width}: nullish text on screen (${d.nullish.join(", ")})`,
          );
          assert.ok(
            d.scroll <= d.width + 1,
            `${theme}/${lang}/${stage}/${width}: ${JSON.stringify(d)}`,
          );
          if (stage === "board") {
            // The duel board is one complete two-sided object: opponent half,
            // phase divider and player half all visible together with no
            // internal vertical scroll, the hand under it and the turn
            // controls under that, centred and never covering the hand.
            const g = await page.evaluate(async () => {
              // Geometry is only meaningful once the resize has been laid out.
              await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
              const box = (el) => (el ? el.getBoundingClientRect() : null);
              const table = document.querySelector(".duel-table");
              const opp = box(document.querySelector(".player-field.opponent"));
              const own = box(document.querySelector(".player-field.player"));
              const hand = box(document.querySelector(".hand-row"));
              const dockEl = document.querySelector(".action-dock");
              const dock = box(dockEl);
              const t = box(table);
              const buttons = dockEl
                ? [...dockEl.querySelectorAll("button")].map((b) => b.getBoundingClientRect())
                : [];
              const overlap = (a, b) =>
                a && b ? Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) : 0;
              return {
                boardScrolls: table ? table.scrollHeight > table.clientHeight + 2 : true,
                halvesInBoard: t && opp && own && opp.top >= t.top - 2 && own.bottom <= t.bottom + 2,
                halvesApart: opp && own && own.top >= opp.bottom - 2,
                handBelowBoard: hand && own && hand.top >= own.bottom - 2,
                dockCoversHand: Math.max(0, Math.round(overlap(hand, dock))),
                dockAfterHand:
                  hand && dock
                    ? Boolean(
                        document
                          .querySelector(".hand-row")
                          .compareDocumentPosition(dockEl) & Node.DOCUMENT_POSITION_FOLLOWING,
                      )
                    : false,
                // Defect E: the button group sits centred in the gameplay column.
                skew: buttons.length
                  ? Math.round(
                      Math.abs(
                        Math.min(...buttons.map((b) => b.left)) -
                          dock.left -
                          (dock.right - Math.max(...buttons.map((b) => b.right))),
                      ),
                    )
                  : 0,
              };
            });
            const at = `${theme}/${lang}/${width}x${height}`;
            assert.equal(g.boardScrolls, false, `${at}: duel board still scrolls internally`);
            assert.ok(g.halvesInBoard, `${at}: a field half sits outside the board box`);
            assert.ok(g.halvesApart, `${at}: the two field halves overlap`);
            assert.ok(g.handBelowBoard, `${at}: the hand overlaps the board`);
            assert.ok(g.dockAfterHand, `${at}: the action dock precedes the hand`);
            assert.equal(
              g.dockCoversHand,
              0,
              `${at}: the action dock covers the hand by ${g.dockCoversHand}px`,
            );
            assert.ok(g.skew <= 2, `${at}: action buttons off-centre by ${g.skew}px`);
          }
          metrics.push({ theme, lang, stage, width, overflow: d.scroll - d.width });
        }
      }
      await page.goto(`${origin}/games/${theme}/index.html`, { waitUntil: "networkidle" });
      try {
        await page
          .getByRole("button", { name: labels.new, exact: true })
          .waitFor({ timeout: 10000 });
      } catch (error) {
        console.log("DUEL_ENTRY_FAILURE", await page.locator("body").innerText(), errors);
        throw error;
      }
      assert.equal(await page.evaluate((k) => localStorage.getItem(k), key), null);
      assert.equal(await page.locator("#app").getAttribute("aria-busy"), null);
      await measure("menu");
      assert.equal(artRequests.size, 0, "Menu must not fetch card catalog images");
      await page.getByRole("button", { name: labels.archive }).click();
      await measure("archive");
      assert.ok(artRequests.size <= 24, "First archive page loads at most its 24 images");
      await page
        .locator(".archive-grid img")
        .first()
        .evaluate(async (img) => {
          await img.decode();
        });
      // Each theme's art is rendered at its own size; read the declared width
      // from the manifest rather than pinning a constant that goes stale the
      // next time the art is regenerated.
      const artWidth = JSON.parse(
        readFileSync(`public/games/${theme}/assets/art-manifest.json`, "utf8"),
      ).summary.dimensions[0];
      assert.equal(
        await page
          .locator(".archive-grid img")
          .first()
          .evaluate((img) => img.naturalWidth),
        artWidth,
      );
      assert.equal(await page.locator('.archive-grid [data-used="true"]').count(), 0);
      assert.equal(await page.locator(".archive-grid .playing-card").count(), 24);
      assert.equal(await page.locator(".archive-head span").innerText(), "300 / 300");
      const ids = new Set();
      for (let n = 0; n < 13; n++) {
        for (const id of await page
          .locator(".archive-grid [data-card]")
          .evaluateAll((nodes) => nodes.map((el) => el.dataset.card)))
          ids.add(id);
        const nextPage = page.locator(".pagination button").last();
        if (await nextPage.isDisabled()) break;
        await nextPage.click();
      }
      assert.equal(ids.size, 300);
      await page.locator(".filters input").fill(theme === "veto-h" ? "SND-001" : "RCN-001");
      assert.equal(await page.locator(".archive-grid .playing-card").count(), 1);
      await page.locator(".filters input").fill("");
      await page.locator(".filters select").first().selectOption("trap");
      assert.ok(await page.locator('.archive-grid [data-kind="trap"]').count());
      assert.equal(await page.locator('.archive-grid [data-kind="unit"]').count(), 0);
      await page.locator(".filters select").first().selectOption("");
      await page.locator(".filters select").nth(2).selectOption("equip");
      assert.ok(await page.locator(".archive-grid .playing-card").count());
      await page.locator(".filters select").nth(2).selectOption("");
      await page.locator(".filters select").nth(3).selectOption("auxiliary");
      assert.ok(await page.locator(".archive-grid .playing-card").count());
      await page.locator(".filters select").nth(3).selectOption("");
      await page.locator(".filters select").nth(4).selectOption("high");
      assert.ok(await page.locator(".archive-grid .playing-card").count());
      await page.locator(".filters select").nth(4).selectOption("");
      await page.locator(".archive-grid .playing-card").first().click();
      await measure("archive-inspector");

      // Navigation semantics. A layer opened straight from a screen has no
      // level above it, so it offers `Kapat` only. Following a combo is a step
      // down, and both `Geri` and Escape must walk back exactly one level
      // rather than dismissing the whole stack.
      assert.equal(
        await page.locator('[data-pick="dialog-up"]').count(),
        0,
        `${theme}/${lang}: a top-level layer must not offer Geri`,
      );
      const cardTitle = await page.locator("dialog h2").innerText();
      if (await page.locator('[data-pick^="combo-"]').count()) {
        await page.locator('[data-pick^="combo-"]').first().click();
        await page.locator('[data-pick="dialog-up"]').waitFor({ timeout: 4000 });
        await page.locator('[data-pick="dialog-up"]').click();
        assert.equal(
          await page.locator("dialog h2").innerText(),
          cardTitle,
          `${theme}/${lang}: Geri did not return to the card it was opened from`,
        );
        await page.locator('[data-pick^="combo-"]').first().click();
        await page.locator('[data-pick="dialog-up"]').waitFor({ timeout: 4000 });
        await page.keyboard.press("Escape");
        assert.equal(
          await page.locator("dialog[open]").count(),
          1,
          `${theme}/${lang}: Escape closed the whole stack instead of one level`,
        );
        assert.equal(await page.locator("dialog h2").innerText(), cardTitle);
      }
      await page.getByRole("button", { name: labels.close, exact: true }).click();
      assert.ok(
        await page.locator(".archive-grid").isVisible(),
        `${theme}/${lang}: Kapat did not leave the archive screen underneath`,
      );
      assert.equal(await page.evaluate((k) => localStorage.getItem(k), key), null);
      await page.getByRole("button", { name: labels.menu, exact: true }).click();
      await page.getByRole("button", { name: labels.new, exact: true }).click();

      // Three-step setup: deck, opponent style, summary. The chosen deck must
      // survive Back/Next and be the deck the duel is actually dealt from.
      await page.locator(".setup-wizard").waitFor();
      const deckChips = page.locator(".setup-wizard .identity-grid .choice-chip");
      assert.equal(await deckChips.count(), 5, "five deck presets");
      await deckChips.nth(2).click();
      assert.equal(await deckChips.nth(2).getAttribute("aria-pressed"), "true", "deck selects");
      const chosenDeck = (await deckChips.nth(2).locator("strong").innerText()).trim();
      await page.locator('[data-pick="inspect-deck"]').click();
      const listed = await page.locator(".deck-preview .deck-card-count").allInnerTexts();
      assert.equal(
        listed.reduce((n, c) => n + Number(c.replace("×", "")), 0),
        40,
        "deck preview lists all 40 cards",
      );
      await page.locator('[data-pick="inspect-deck"]').click();
      await page.locator('[data-pick="setup-next"]').click();
      const aiChips = page.locator(".setup-wizard .identity-grid .choice-chip");
      await aiChips.nth(1).click();
      const chosenAi = (await aiChips.nth(1).locator("strong").innerText()).trim();
      await page.locator('[data-pick="setup-back"]').click();
      assert.equal(
        await page
          .locator(".setup-wizard .identity-grid .choice-chip")
          .nth(2)
          .getAttribute("aria-pressed"),
        "true",
        "deck choice survives Back",
      );
      await page.locator('[data-pick="setup-next"]').click();
      await page.locator('[data-pick="setup-next"]').click();
      assert.equal((await page.locator('[data-value="deck"]').innerText()).trim(), chosenDeck);
      assert.equal((await page.locator('[data-value="ai"]').innerText()).trim(), chosenAi);
      assert.equal(await page.evaluate((k) => localStorage.getItem(k), key), null);
      await page.locator('[data-pick="setup-start"]').click();

      for (let tries = 0; tries < 20; tries++) {
        if (await page.getByRole("button", { name: labels.rock, exact: true }).isVisible())
          await page.getByRole("button", { name: labels.rock, exact: true }).click();
        if (await page.getByRole("button", { name: labels.first, exact: true }).isVisible())
          await page.getByRole("button", { name: labels.first, exact: true }).click();
        if (await page.getByRole("button", { name: labels.start, exact: true }).isVisible()) break;
      }
      assert.equal(await page.evaluate((k) => localStorage.getItem(k), key), null);
      await page
        .getByRole("button", {
          name: lang === "tr" ? "40 Kartlık Destenizi İnceleyin" : "Inspect Your 40 Cards",
          exact: true,
        })
        .click();
      assert.equal(
        (await page.locator(".dialog-body .deck-card-count").allInnerTexts()).reduce(
          (n, c) => n + Number(c.replace("×", "")),
          0,
        ),
        40,
      );
      assert.equal(await page.evaluate((k) => localStorage.getItem(k), key), null);
      await page.locator('[data-pick="preview-back"]').click();
      await page.getByRole("button", { name: labels.start, exact: true }).click();
      await page.locator(".duel-table").waitFor();
      await page.waitForFunction((k) => {
        const e = JSON.parse(localStorage.getItem(k));
        if (!e) return false;
        const s = JSON.parse(e.payload);
        return (s.choice?.player ?? s.pending?.responding ?? s.active) === 0;
      }, key);
      // Reach Main 1 through visible controls, completing any effect choices.
      await page.setViewportSize({ width: 1440, height: 1000 });
      for (let step = 0; step < 30; step++) {
        const live = await page.evaluate(
          (k) => JSON.parse(JSON.parse(localStorage.getItem(k)).payload),
          key,
        );
        if (live.result) break;
        const who = live.choice?.player ?? live.pending?.responding ?? live.active;
        if (who === 1) {
          await page.waitForFunction((k) => {
            const s = JSON.parse(JSON.parse(localStorage.getItem(k)).payload);
            return s.result || (s.choice?.player ?? s.pending?.responding ?? s.active) === 0;
          }, key);
          continue;
        }
        if (live.choice) {
          await page
            .locator(".action-dock")
            .getByRole("button", { name: lang === "tr" ? "Seç" : "Choose", exact: true })
            .click();
          if (await page.locator("dialog .choice-list button").count())
            await page.locator("dialog .choice-list button").first().click();
          await page
            .locator("dialog")
            .getByRole("button", { name: labels.confirm, exact: true })
            .click();
          continue;
        }
        if (live.pending) {
          await page
            .locator(".action-dock")
            .getByRole("button", {
              name: lang === "tr" ? "Geç" : "Pass",
              exact: true,
            })
            .click();
          continue;
        }
        if (live.phase === "main1") break;
        await page.locator(".action-dock > button.primary").first().click();
      }
      const hand = page.locator('.hand-row [data-kind="unit"]');
      for (let i = 0; i < (await hand.count()); i++) {
        await hand.nth(i).click();
        const summon = page.locator(".inspector-actions").getByRole("button", {
          name:
            theme === "veto-h"
              ? lang === "tr"
                ? "Normal Çağır"
                : "Normal Summon"
              : lang === "tr"
                ? "Sahaya Sür"
                : "Deploy Crew",
          exact: true,
        });
        if (await summon.count()) {
          await summon.click();
          // Choosing the zone finishes a plain summon; only a card that still
          // needs a target or a cost stops for a separate Confirm.
          if (await page.locator("dialog .choice-list button").count())
            await page.locator("dialog .choice-list button").first().click();
          const confirm = page
            .locator("dialog")
            .getByRole("button", { name: labels.confirm, exact: true });
          if (await confirm.count()) await confirm.click();
          await page.waitForFunction(
            (k) =>
              JSON.parse(JSON.parse(localStorage.getItem(k)).payload).players[0].units.some(
                Boolean,
              ),
            key,
          );
          break;
        }
      }
      assert.equal(
        await page.getByRole("button", { name: /^(Sonraki Evre|Next Phase)$/i }).count(),
        0,
      );
      await measure("board");
      assert.ok(
        (await page
          .locator(".action-dock")
          .getByRole("button", {
            name: lang === "tr" ? "Turu Bitir" : "End Turn",
            exact: true,
          })
          .count()) <= 1,
        "The primary End Turn action must not have a duplicate secondary button",
      );
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.locator(".hand-row .playing-card").first().click();
      await page.locator(".inspector .effect-text").waitFor();
      const shot = await page.screenshot({
        path: `${out}/${theme}-${lang}-desktop.jpg`,
        type: "jpeg",
        quality: 65,
        fullPage: true,
      });
      if (lang === "tr") console.log(`DUEL_SCREENSHOT ${theme} ${shot.toString("base64")}`);
      const before = await page.evaluate((k) => localStorage.getItem(k), key);
      await page.reload({ waitUntil: "networkidle" });
      assert.equal(await page.evaluate((k) => localStorage.getItem(k), key), before);
      await page.getByRole("button", { name: labels.continue, exact: true }).click();
      await page.setViewportSize({ width: 390, height: 844 });
      await page.locator(".hand-row .playing-card").first().click();
      assert.ok(await page.locator("dialog").isVisible());
      const mobileShot = await page.screenshot({
        path: `${out}/${theme}-${lang}-mobile.jpg`,
        type: "jpeg",
        quality: 65,
        fullPage: true,
      });
      if (lang === "tr")
        console.log(`DUEL_SCREENSHOT ${theme}-mobile ${mobileShot.toString("base64")}`);
      await page.getByRole("button", { name: labels.close, exact: true }).click();
      await page.getByRole("button", { name: labels.help, exact: true }).click();
      assert.ok(await page.locator("dialog p").first().innerText());
      await page.keyboard.press("Escape");
      assert.equal(await page.locator("dialog").isVisible(), false);
      const neutralSave = await page.evaluate((k) => localStorage.getItem(k), key);
      const peer = await context.newPage();
      await peer.goto(`${origin}/games/${theme}/index.html`, { waitUntil: "networkidle" });
      // The duplicate in-game language button was intentionally removed; the
      // outer TarikLab shell now owns this preference. Writing it from a peer
      // page reproduces that shell action and still exercises the real
      // cross-document storage event handled by the duel runtime.
      await peer.evaluate(
        (language) => localStorage.setItem("tariklab.language", language),
        lang === "tr" ? "en" : "tr",
      );
      await page.waitForFunction(
        (language) => document.documentElement.lang === language,
        lang === "tr" ? "en" : "tr",
      );
      assert.equal(await page.evaluate((k) => localStorage.getItem(k), key), neutralSave);
      await page.emulateMedia({ reducedMotion: "reduce" });
      assert.equal(
        await page
          .locator(".playing-card")
          .first()
          .evaluate((el) => getComputedStyle(el).animationName),
        "none",
      );
      await context.close();
    }
  await duelScenarios(browser, origin);
  assert.deepEqual(errors, []);
  writeFileSync(`${out}/results.json`, JSON.stringify(metrics, null, 2));
  console.log(`DUEL_BROWSER_PASS ${metrics.length} viewport checks`);
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
