import { EMPLOYERS } from "../public/games/tc-sim-boardworld/deep-content.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import keys from "../public/games/tc-sim-boardworld/locale-keys.mjs";
import en from "../public/games/tc-sim-boardworld/locale-en.mjs";
import pl from "../public/games/tc-sim-boardworld/locale-pl.mjs";
import {
  chooseLanguage,
  getLanguage,
  number,
  signed,
  translateText,
} from "../public/games/tc-sim-boardworld/i18n.mjs";

test("Boardworld language catalogs align, retain placeholders and contain complete values", () => {
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(keys.length > 2500);
  for (const values of [en, pl]) {
    assert.equal(values.length, keys.length);
    keys.forEach((key, index) => {
      assert.equal(typeof values[index], "string");
      assert.ok(values[index].trim());
      assert.deepEqual(
        values[index].match(/\{\w+\}/g)?.sort() || [],
        key.match(/\{\w+\}/g)?.sort() || [],
        key,
      );
    });
  }
});
test("Boardworld presentation rounds floating tails and signed zero in all languages", async () => {
  for (const lang of ["tr", "en", "pl"]) {
    await chooseLanguage(lang);
    assert.equal(signed(-0.000000001), "0");
    assert.equal(signed(0.000000001), "0");
    assert.ok(!number(-0.29999999999999716, 1).includes("999"));
    assert.equal(number(0.3, 1), lang === "en" ? "0.3" : "0,3");
    assert.equal(signed(1.999999, 1), "+2");
  }
});
test("Boardworld composed live descriptions translate without breaking names or quantities", async () => {
  await chooseLanguage("en");
  assert.equal(translateText("Kadıköy"), "Kadıköy");
  assert.match(translateText("Ece Yalın profilini aç"), /Ece Yalın/);
  const course = translateText(
    "Altı dersle bakım, ölçüm ve güvenli onarım. 6 oturum, her gün en çok bir ders. Oturum başına Zanaat +4.",
  );
  assert.ok(!/ders|oturum|Zanaat/.test(course), course);
  assert.match(course, /6/);
  assert.match(course, /\+4/);
  assert.ok(!/Ücretsiz/.test(translateText("1 sa 30 dk · Ücretsiz")));
  assert.equal(translateText("Banka 0 ₺ ↗"), "Bank 0 ₺ ↗");
  assert.equal(translateText("Onarım ustası · ekip sorumlusu"), "Master repairer · team lead");
  await chooseLanguage("pl");
  assert.equal(translateText("Banka 0 ₺ ↗"), "Bank 0 ₺ ↗");
  assert.equal(translateText("Onarım ustası · ekip sorumlusu"), "Mistrz napraw · lider zespołu");
});
test("Boardworld rapid asynchronous language selection keeps the most recent choice", async () => {
  await Promise.all([chooseLanguage("en"), chooseLanguage("pl"), chooseLanguage("tr")]);
  assert.equal(getLanguage(), "tr");
});
test("Boardworld live outcome deltas translate labels without reinterpreting formatted amounts", async () => {
  for (const [lang, labels, amount] of [
    ["tr", ["Nakit", "Banka", "Enerji", "Tokluk", "Stres", "Sağlık"], "1.234"],
    ["en", ["Cash", "Bank", "Energy", "Fullness", "Stress", "Health"], "1,234"],
    ["pl", ["Gotówka", "Bank", "Energia", "Sytość", "Stres", "Zdrowie"], "12\u00a0345"],
  ]) {
    await chooseLanguage(lang);
    for (const [index, label] of [
      "Nakit",
      "Banka",
      "Enerji",
      "Tokluk",
      "Stres",
      "Sağlık",
    ].entries()) {
      for (const sign of ["+", "-", "−"]) {
        const value = `${sign}${amount}${index < 2 ? " ₺" : ""}`;
        assert.equal(translateText(`${label} ${value}`), `${labels[index]} ${value}`);
      }
    }
    assert.equal(
      translateText("Nakit -55 ₺ · Enerji -2 · Tokluk -2"),
      `${labels[0]} -55 ₺ · ${labels[2]} -2 · ${labels[3]} -2`,
    );
    assert.equal(translateText("Nakit Deniz"), "Nakit Deniz", "names are not numeric deltas");
  }
});
test("Boardworld habit counts and legacy cause labels use the selected presentation language", async () => {
  const legacy = Object.freeze({
    why: "39 tamamlanan vardiya, 100 performans ve 0 stres; ekip ihtiyacı busy.",
  });
  const original = JSON.stringify(legacy);
  for (const lang of ["tr", "en", "pl"]) {
    await chooseLanguage(lang);
    const week = translateText("Bugün 0 · Bu hafta 0");
    assert.match(week, { tr: /Bu hafta 0/, en: /This week 0/, pl: /W tym tygodniu 0/ }[lang]);
    for (const token of ["busy", "quiet", "balanced"]) {
      const result = translateText(legacy.why.replace("busy", token));
      if (lang !== "en") assert.ok(!/busy|quiet|balanced/.test(result), result);
      if (lang === "en") assert.ok(!/ekip|ihtiyacı/.test(result), result);
    }
  }
  assert.equal(JSON.stringify(legacy), original, "presentation never rewrites original records");
});
test("Boardworld source-number captures preserve monetary magnitude and clock times", async () => {
  await chooseLanguage("en");
  assert.equal(translateText("1.377 TL nakit gerekir."), "Requires 1,377 TL in cash.");
  assert.equal(translateText("1.450 TL/vardiya"), "1,450 TL per shift");
  const clinic = translateText(
    "90 dk; sağlık +35, stres −8. Şişli sağlık merkezi. Hizmet yoğunluğu: +0 dk; bakım hakkı korunur.",
  );
  assert.ok(!/sağlık|yoğunluğu|korunur/.test(clinic), clinic);
  const job = translateText(
    "Beşiktaş’ta ekip işi. Başlangıç için diploma gerektirmez. Vardiya 7 saat; taban 1.050 TL/vardiya, ücret her 7 günde bankaya. Başlangıç 08.00–12.00. Hafta sonu vardiya; Salı izin. Kabul edersen mevcut işin sona erer; biriken ücretin ödenir.",
  );
  assert.match(job, /1,050 TL/);
  assert.match(job, /08:00–12:00/);
  assert.ok(!/Vardiya|Başlangıç|ücret/.test(job), job);
  await chooseLanguage("pl");
  assert.equal(translateText("1.377 TL nakit gerekir."), "Wymaga 1377 TL gotówki.");
  assert.equal(translateText("1.450 TL/vardiya"), "1450 TL za zmianę");
});
test("Boardworld current action copy remains localized across four authentic upgraded lives", async () => {
  const [{ readFileSync }, { importGame }, { getActions }, { NPCS, DISTRICTS }] = await Promise.all(
    [
      import("node:fs"),
      import("../public/games/tc-sim-boardworld/persistence.mjs"),
      import("../public/games/tc-sim-boardworld/engine.mjs"),
      import("../public/games/tc-sim-boardworld/content.mjs"),
    ],
  );
  const names = [
    ...NPCS.map((n) => n.name),
    ...DISTRICTS.map((n) => n.name),
    ...NPCS.map((n) => n.name.split(" ")[0]),
    ...EMPLOYERS.map((e) => e.name),
  ].sort((a, b) => b.length - a.length);
  for (const lang of ["en", "pl"]) {
    await chooseLanguage(lang);
    for (const file of [
      "v4-career-day91",
      "v4-active-enterprise",
      "v4-active-household",
      "v4-active-causal",
    ]) {
      const state = importGame(
        readFileSync(new URL(`./fixtures/boardworld/${file}.json`, import.meta.url), "utf8"),
      ).state;
      assert.ok(state);
      for (const action of getActions(state)) {
        for (const key of ["label", "description", "reason"]) {
          const result = translateText(action[key] || ""),
            withoutNames = names.reduce((text, name) => text.replaceAll(name, ""), result);
          assert.ok(
            !/[çğıöşüİĞŞÖÇÜ]/.test(withoutNames),
            `${lang} ${file} ${action.id} ${key}: ${result}`,
          );
        }
      }
    }
  }
});
