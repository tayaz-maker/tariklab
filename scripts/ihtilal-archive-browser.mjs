import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createSolo, serializeSolo, deserializeSolo, SOLO_KEY } from "../public/games/ihtilal/solo.js";
import { createMatch } from "../public/games/ihtilal/engine.js";
import { serialize } from "../public/games/ihtilal/save.js";

const COPY = {
  tr: { banner: "Arşiv sürümü.", open: "Dosyayı aç" },
  en: { banner: "Archived version.", open: "Open the file" },
  pl: { banner: "Wersja archiwalna.", open: "Otwórz akta" },
};

export async function archiveAcceptance(browser, origin, out) {
  mkdirSync(out, { recursive: true });
  const rows = [];
  try {
    for (const lang of ["tr", "en", "pl"]) for (const width of [1280, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 844 } });
      try {
        const solo = serializeSolo(createSolo(71));
        const legacy = serialize(createMatch({ seed: 42 }));
        const saves = { [SOLO_KEY]: solo, [SOLO_KEY + ".backup"]: solo };
        for (const suffix of ["slot1", "slot2", "slot3", "resume"]) {
          saves[`tariklab.ihtilal.v1.${suffix}`] = legacy;
          saves[`tariklab.ihtilal.v1.${suffix}.backup`] = legacy;
        }
        await context.addInitScript(({ lang, saves }) => {
          localStorage.setItem("tariklab.language", lang);
          if (!localStorage.getItem("ihtilal-archive-proof")) {
            for (const [key, value] of Object.entries(saves)) localStorage.setItem(key, value);
            localStorage.setItem("ihtilal-archive-proof", "1");
          }
        }, { lang, saves });
        const page = await context.newPage(); const errors = [];
        page.on("pageerror", error => errors.push(error.message));
        await page.goto(origin + "/", { waitUntil: "networkidle" });
        await page.locator("#active-games").waitFor();
        assert.equal(await page.locator('a[href*="ihtilal"]').count(), 0);
        assert.equal(await page.locator('a[href="/oyna/esik"]').count(), 0);
        await page.goto(origin + "/credits.html", { waitUntil: "networkidle" });
        assert.equal(await page.locator('a[href*="ihtilal"], [data-game="ihtilal"]').count(), 0);
        assert.equal(await page.locator('a[href="/oyna/esik"]').count(), 0);
        await page.goto(origin + "/ihtilal", { waitUntil: "networkidle" });
        await page.waitForURL("**/oyna/ihtilal");
        assert.equal(new URL(page.url()).origin, origin, "archive redirect stays on the certified origin");
        const banner = page.locator('[data-game-archive="ihtilal"]');
        await banner.waitFor(); assert.ok((await banner.innerText()).includes(COPY[lang].banner));
        assert.equal(await banner.locator('a[href="/oyna/jitem-derin-ag"]').count(), 1);
        assert.equal(await page.locator('meta[name="robots"]').getAttribute("content"), "noindex, follow");
        const saved = await page.evaluate(keys => Object.fromEntries(keys.map(k => [k, localStorage.getItem(k)])), Object.keys(saves));
        assert.deepEqual(saved, saves, "navigation and archive shell preserve every existing save byte");
        const frame = page.frameLocator("iframe");
        await frame.getByRole("button", { name: COPY[lang].open, exact: true }).click();
        await frame.locator(".basin-map").waitFor();
        assert.equal(await frame.locator("body").evaluate(() => location.origin), origin);
        const loaded = await page.evaluate(key => localStorage.getItem(key), SOLO_KEY);
        assert.deepEqual(deserializeSolo(loaded), deserializeSolo(solo), "archive resumes the original saved campaign");
        await frame.locator(".act:not([disabled])").first().click();
        await frame.locator(".inline-outcome").waitFor();
        const progressed = await page.evaluate(key => localStorage.getItem(key), SOLO_KEY);
        assert.notEqual(progressed, loaded);
        await page.reload({ waitUntil: "networkidle" });
        await page.frameLocator("iframe").getByRole("button", { name: COPY[lang].open, exact: true }).click();
        await page.frameLocator("iframe").locator(".basin-map").waitFor();
        assert.deepEqual(deserializeSolo(await page.evaluate(key => localStorage.getItem(key), SOLO_KEY)), deserializeSolo(progressed));
        const legacyKeys = Object.keys(saves).filter(k => k.startsWith("tariklab.ihtilal.v1."));
        assert.deepEqual(await page.evaluate(keys => Object.fromEntries(keys.map(k => [k, localStorage.getItem(k)])), legacyKeys), Object.fromEntries(legacyKeys.map(k => [k, saves[k]])));
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        assert.ok(await page.frameLocator("iframe").locator("body").evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        assert.deepEqual(errors, []);
        await page.screenshot({ path: `${out}/archive-${lang}-${width}.png`, fullPage: true });
        rows.push({ lang, width, status: "PASS", origin, legacySaveKeys: legacyKeys.length });
      } finally { await context.close(); }
    }
  } finally { writeFileSync(`${out}/archive-results.json`, JSON.stringify(rows, null, 2)); }
  return rows;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import("playwright");
  const origin = process.argv[2];
  assert.ok(["https://www.tariklab.com", "https://tariklab.tayaz29.workers.dev", "http://127.0.0.1:8081"].includes(origin));
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, args: ["--no-sandbox"] });
  try { console.log(await archiveAcceptance(browser, origin, process.env.ARCHIVE_BROWSER_OUT || "/workspace/screenshots/ihtilal-archive")); }
  finally { await browser.close(); }
}
