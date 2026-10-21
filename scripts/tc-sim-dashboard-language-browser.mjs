import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "playwright";
import { createStaticGameServer } from "./static-game-server.mjs";
import { pendingJobStartState } from "./tc-sim-job-start-fixture.mjs";

const { values } = parseArgs({
  options: {
    serve: { type: "string", default: "public" },
    out: { type: "string", default: "../tc-quality-evidence/screenshots/dashboard-language" },
  },
});
const out = resolve(values.out);
mkdirSync(out, { recursive: true });
const server = createStaticGameServer(values.serve);
await new Promise((done, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", done);
});
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
  args: ["--no-sandbox"],
});
const rows = [];
try {
  for (const language of ["tr", "en", "pl"])
    for (const width of [1280, 390]) {
      console.log("dashboard language", language, width);
      const context = await browser.newContext({ viewport: { width, height: 844 } }),
        page = await context.newPage(),
        errors = [];
      page.setDefaultTimeout(15000);
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      await context.addInitScript(
        ({ state, language, origin }) => {
          if (location.origin !== origin) return;
          if (!localStorage.getItem("tc-dashboard-seeded")) {
            localStorage.setItem("tariklab::tc-sim:1", JSON.stringify(state));
            localStorage.setItem("tariklab::tc-sim:active", "1");
            localStorage.setItem("tc-dashboard-seeded", "1");
          }
          localStorage.setItem("tariklab.language", language);
        },
        { state: pendingJobStartState(), language, origin },
      );
      const check = async (phase) => {
        const expected = {
          tr: ["Hayatın", "Bugün ne yapmalıyım?", "Paranın o yıldaki yüzü", "Son hayat kayıtları"],
          en: ["Your life", "What should I do today?", "Money in that year", "Recent life records"],
          pl: [
            "Twoje życie",
            "Co zrobić dzisiaj?",
            "Pieniądze w tym roku",
            "Ostatnie zapisy życia",
          ],
        }[language];
        await page.waitForFunction(
          (expected) => expected.every((text) => document.body.innerText.includes(text)),
          expected.slice(0, 3),
          { timeout: 15000 },
        );
        if (language === "pl") {
          const more = page.locator(".nav-more");
          const expand = await more.isVisible() && await more.getAttribute("aria-expanded") === "false";
          if (expand) await more.click();
          await page.waitForFunction(() => {
            const text = document.body.innerText;
            return ["Targ", "Praca", "Ludzie", "Bliscy", "Teczka roku", "Spotkaj się z: Mehmet", "Prognoza na koniec miesiąca:"].every(label => text.includes(label));
          });
          assert.doesNotMatch(await page.locator("body").innerText(), /\bMeet Mehmet\b|Month-end projection:|\bMarket street\b|\bYear file\b/);
          if (expand) await more.click();
        }
        for (const selector of [
          ".first-steps",
          ".period-economy > div",
          ".decision-context",
          ".history-panel .panel-head",
          ".workspace-head h1",
          ".period-economy dl",
          ".week-panel",
          ".cases-panel .panel-head",
          ".profile-panel > p",
          ".people-panel .person small",
          ".agenda-panel",
          ".top-meta",
          ".save-status",
          ".history-panel .memory",
        ]) {
          const text = (await page.locator(selector).allTextContents()).join(" ");
          if (language !== "tr")
            assert.doesNotMatch(
              text,
              /Hayatın|Bugün ne yapmalıyım|Paranın o yıldaki|Son hayat kayıtları|Küçük kararlar|Kartın altında|Gelen kutusu ve|Hepsini doldurman|Konut gideri|Housing gideri|Gönüllü işe çık|bir akşam|Bekleyen sonuçlar|Dengeli başlangıç|Günümüz|Ocak|hatıra|başlangıç tarihini bekliyorsun|olarak işe başladın|Kayıt hazır|Yeni işin başlıyor|İlerleme/,
              `${language}/${width}/${phase}: ${text}`,
            );
        }
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
          ),
          false,
        );
        assert.deepEqual(errors, []);
      };
      await page.goto(`${origin}/games/tc-sim/index.html`, { waitUntil: "networkidle" });
      await page.locator("#continue-game").click();
      await check("loaded");
      await page.locator("#advance-week").click();
      await page.locator('[data-event-choice="start"]').click();
      await check("job-started");
      const memory = await page.locator(".history-panel").textContent();
      assert.ok(
        memory.includes(
          {
            tr: "Market Çalışanı olarak işe başladın.",
            en: "You started work as a shop clerk.",
            pl: "Rozpoczęto pracę w sklepie.",
          }[language],
        ),
      );
      const saved = await page.evaluate(() => localStorage.getItem("tariklab::tc-sim:1"));
      writeFileSync(`${out}/${language}-${width}.txt`, await page.locator("body").innerText());
      await page.screenshot({ path: `${out}/${language}-${width}.png`, fullPage: true });
      console.log("reloading", language, width);
      await page.reload({ waitUntil: "networkidle" });
      await page.locator("#continue-game").click();
      await check("reloaded");
      assert.equal(
        await page.evaluate(() => localStorage.getItem("tariklab::tc-sim:1")),
        saved,
        "language presentation and reload preserve the serialized save",
      );
      rows.push({ language, width, phase: "loaded + job-started + reloaded", status: "PASS" });
      await context.close();
    }
  writeFileSync(
    `${out}/results.json`,
    JSON.stringify(
      {
        scope:
          "Visible dashboard language, no overflow or console errors, serialized save unchanged through reload",
        rows,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(JSON.stringify({ status: "PASS", cases: rows.length, rows }));
} finally {
  await browser.close();
  server.close();
}
