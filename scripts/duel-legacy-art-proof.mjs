import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { waitForVisibleHandArt } from "./duel-visible-art.mjs";

// The identical archive/legacy/manifest/capture flow runs locally in CI and on production.
export async function duelLegacyArtProof(browser, origin, theme, out) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  try {
    const key = `tariklab.${theme}.duel`;
    const raw = readFileSync(`scripts/fixtures/duel/${theme}-old-save.json`, "utf8");
    await context.addInitScript(
      ({ key, raw }) => {
        if (!localStorage.getItem(key)) localStorage.setItem(key, raw);
        localStorage.setItem("tariklab.language", "tr");
      },
      { key, raw },
    );
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${origin}/oyna/${theme}`, { waitUntil: "networkidle" });
    const game = page.frameLocator("iframe");
    await game.getByRole("button", { name: "Kart Arşivi · 300", exact: true }).click();
    assert.equal(await game.locator(".archive-head span").innerText(), "300 / 300");
    await game.locator(".filters input").fill(theme === "veto-h" ? "SND-300" : "RCN-300");
    await game
      .locator(".archive-grid img")
      .first()
      .evaluate(async (image) => {
        await image.decode();
      });
    // Each theme's art is rendered at its own size; read the declared width
    // from the manifest rather than pinning a constant that goes stale the
    // next time the art is regenerated. VETO-H! is 576 wide, GETT-OH! 400.
    const artManifest = JSON.parse(
      readFileSync(`public/games/${theme}/assets/art-manifest.json`, "utf8"),
    );
    const artWidth = artManifest.summary.dimensions[0];
    assert.equal(
      await game
        .locator(".archive-grid img")
        .first()
        .evaluate((image) => image.naturalWidth),
      artWidth,
    );
    await game.getByRole("button", { name: "Ana Menü", exact: true }).click();
    await game.getByRole("button", { name: "Devam Et", exact: true }).click();
    await game.locator(".duel-table").waitFor();
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), key), raw);
    assert.equal(
      await game.getByRole("button", { name: /^(Sonraki Evre|Next Phase)$/i }).count(),
      0,
    );
    const fixture = JSON.parse(JSON.parse(raw).payload);
    // These canonical fixtures have empty boards; the capture contract covers restored hand art.
    assert.ok(
      fixture.players.every((player) =>
        [...player.units, ...player.support, player.field].every((slot) => slot === null),
      ),
      "Legacy fixture board changed: extend the visible-art contract before capturing it",
    );
    const expectedHand = fixture.players[0].hand.map((uid) => {
      const id = fixture.cards[uid].id;
      const art = artManifest.cards[id];
      assert.ok(
        art?.path &&
          Number.isInteger(art.width) &&
          art.width > 0 &&
          Number.isInteger(art.height) &&
          art.height > 0,
        `Missing manifest art for ${id}`,
      );
      return { uid, id, src: art.path, width: art.width, height: art.height };
    });
    assert.equal(expectedHand.length, 6, "Canonical legacy fixture must restore six hand cards");
    const desktopArt = await waitForVisibleHandArt(game.locator(".hand-row"), {
      expected: expectedHand,
      minVisible: expectedHand.length,
    });
    await page.screenshot({ path: `${out}/${theme}-legacy-desktop.png`, fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    const mobileArt = await waitForVisibleHandArt(game.locator(".hand-row"), {
      expected: expectedHand,
    });
    await page.screenshot({ path: `${out}/${theme}-legacy-mobile.png`, fullPage: true });
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), key), raw);
    assert.deepEqual(errors, []);
    return {
      theme,
      archive: 300,
      expansionArt: true,
      restoredHandArt: { desktop: desktopArt, mobile: mobileArt },
      legacySaveUnchanged: true,
      errors,
    };
  } finally {
    await context.close();
  }
}
