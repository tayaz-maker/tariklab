// Polish readers: authored Polish interface where it exists, English
// everywhere else, never the Turkish source text.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const TURKISH_ONLY = /[çğıöşüÇĞİÖŞÜ]/;
const SOURCE = readFileSync(new URL("../public/i18n/tlab-i18n.js", import.meta.url), "utf8");

// Evaluate the browser script in a fresh context per reader language.
function loadI18n(lang) {
  const context = { localStorage: { getItem: () => lang, setItem() {} } };
  vm.runInNewContext(SOURCE, context);
  return context.tlabI18n;
}

test("PL: authored Polish first, then English, never the Turkish source", () => {
  const I = loadI18n("pl");
  assert.equal(I.getLang(), "pl");
  assert.equal(I.contentLang(), "en");
  assert.equal(I.phrase("Kaydet"), "Zapisz", "Turkish key with Polish");
  assert.equal(I.phrase("NEW GAME"), "NOWA GRA", "English key with Polish");
  const enOnly = Object.keys(I.PHRASE).find(
    (k) => TURKISH_ONLY.test(k) && !(k in I.PHRASE_PL) && !(I.PHRASE[k] in I.PHRASE_PL),
  );
  assert.ok(enOnly, "a phrase with English but no Polish exists");
  assert.equal(I.phrase(enOnly), I.PHRASE[enOnly], "falls back to English");
  assert.equal(I.localize("Devam", "Continue"), "Kontynuuj");
  assert.equal(I.localize("Yalnız Türkçe", "English only"), "English only");
  assert.equal(I.t("common.save"), "Zapisz");
  assert.equal(I.t("footer.rights"), "© 2026 TarikLab. Wszelkie prawa zastrzeżone.");
  const onlyEn = Object.keys(I.EN).find((k) => !(k in I.PL));
  if (onlyEn) assert.equal(I.t(onlyEn), I.EN[onlyEn], "t() falls back to English");
});

test("TR and EN readers are unchanged", () => {
  const tr = loadI18n("tr");
  assert.equal(tr.phrase("Kaydet"), "Kaydet");
  assert.equal(tr.localize("Devam", "Continue"), "Devam");
  assert.equal(tr.contentLang(), "tr");
  const en = loadI18n("en");
  assert.equal(en.phrase("← Oyunlar"), "← Games");
  assert.equal(en.localize("Devam", "Continue"), "Continue");
  assert.equal(en.contentLang(), "en");
});

test("the Polish dictionaries hold Polish, not Turkish", () => {
  const I = loadI18n("pl");
  for (const [k, v] of Object.entries(I.PHRASE_PL)) {
    assert.equal(typeof v, "string", k);
    assert.ok(v.trim(), k);
    assert.doesNotMatch(v, TURKISH_ONLY, `${k} → ${v}`);
  }
});

test("duel table: Polish labels exist only for real English keys", async () => {
  const { labels } = await import("../public/games/duel-core/labels.js");
  const { labelsPl } = await import("../public/games/duel-core/labels-pl.js");
  for (const [k, v] of Object.entries(labelsPl)) {
    assert.ok(k in labels.en, k);
    assert.ok(v.trim(), k);
    assert.doesNotMatch(v, TURKISH_ONLY, k);
  }
  const app = readFileSync(new URL("../public/games/duel-core/app.js", import.meta.url), "utf8");
  assert.match(app, /lang = reader === "en" \|\| reader === "pl" \? "en" : "tr"/);
});

test("every game's language switch sends Polish readers to English content", () => {
  const read = (p) => readFileSync(new URL(`../public/games/${p}`, import.meta.url), "utf8");
  assert.match(
    read("next-wave/shared/runtime.js"),
    /lang === "en" \|\| lang === "pl" \? "en" : "tr"/,
  );
  assert.match(
    read("hanedanian/i18n.js"),
    /reader\(\) === "en" \|\| reader\(\) === "pl" \? "en" : "tr"/,
  );
  assert.match(
    read("ihtilal/solo-app.js"),
    /reader\(\) === "en" \|\| reader\(\) === "pl" \? "en" : "tr"/,
  );
  assert.match(read("son-100-gun/pov-app.js"), /raw === "en" \|\| raw === "pl" \? "en" : "tr"/);
  for (const p of ["racon/index.html", "bukucu/index.html", "hanedan/legacy.html"])
    assert.doesNotMatch(read(p), /getLang\(\) === "en"\) window\.tlabI18n\.applyPhrases/, p);
  for (const p of [
    "tc-sim/js/app.js",
    "tc-sim/js/help.js",
    "tc-sim/js/wealth.js",
    "tc-sim/js/desk.js",
  ])
    assert.doesNotMatch(read(p), /getLang\??\.?\(\) === "en"/, p);
});

test("the coverage record lists every catalogue game with a PL state", () => {
  const cov = JSON.parse(
    readFileSync(
      new URL("../docs/INTERACTIVE_LANGUAGE_I18N_COVERAGE.json", import.meta.url),
      "utf8",
    ),
  );
  for (const g of cov.games) {
    assert.ok(["interface", "english-fallback"].includes(g.pl), `${g.id}: ${g.pl}`);
    assert.ok(typeof g.plNote === "string" && g.plNote.length > 10, g.id);
  }
});
