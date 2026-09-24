// Polish body text: every game that renders English content for Polish
// readers loads /i18n/pl-body.js with its own dictionary, the dictionaries
// hold Polish (never Turkish), and the runtime translator matches whole
// strings, " · " parts and "{0}" patterns.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");
const games = Object.keys(JSON.parse(read("scripts/pl/games.json")));
const TURKISH_ONLY = /[çğıöşüÇĞİÖŞÜ]/;
// Proper names (Tarık, Kuştepe, Fevzi Paşa) keep their spelling; Turkish text
// shows up in lower-case words, so only those are checked.
const turkishWord = (s) =>
  s.split(/[^\p{L}]+/u).some((w) => /^\p{Ll}/u.test(w) && TURKISH_ONLY.test(w));
const slots = (s) =>
  [...s.matchAll(/\{(\d+)#?\}/g)]
    .map((m) => m[1])
    .sort()
    .join(",");

test("every covered game loads the Polish body layer with its own dictionary", () => {
  assert.ok(games.length >= 18, "covered games");
  for (const game of games) {
    const html = read(`public/games/${game}/index.html`);
    assert.match(
      html,
      new RegExp(
        `\\n[ ]*<script src="/i18n/pl-body\\.js" data-game="${game}" defer></script>\\n[ ]*</head>`,
      ),
      game,
    );
    // The head stays intact: one </head>, no stray "<" before the tag.
    assert.equal(html.split("</head>").length, 2, `${game} </head>`);
    assert.doesNotMatch(html, /<<script/, game);
    assert.ok(existsSync(new URL(`public/i18n/pl/${game}.json`, root)), `${game} dictionary`);
  }
});

test("dictionaries hold Polish, keep placeholders and never Turkish", () => {
  for (const game of games) {
    const { exact, patterns } = JSON.parse(read(`public/i18n/pl/${game}.json`));
    assert.ok(Object.keys(exact).length > 0, `${game} has entries`);
    for (const [from, to] of Object.entries(exact)) {
      assert.equal(typeof to, "string", `${game}: ${from}`);
      assert.ok(to.trim(), `${game}: ${from}`);
      assert.ok(!turkishWord(to), `${game}: ${from} → ${to}`);
    }
    for (const [from, to] of patterns) {
      assert.match(from, /\{\d+#?\}/, `${game}: ${from}`);
      // every slot the Polish uses must be captured; a Turkish case suffix may be dropped
      for (const n of slots(to).split(",").filter(Boolean))
        assert.ok(slots(from).split(",").includes(n), `${game}: ${from} → ${to}`);
      assert.doesNotMatch(to, /\$\d/, `${game}: ${to}`);
      assert.ok(!turkishWord(to), `${game}: ${to}`);
    }
  }
});

// Run the browser script against a stub page with the site language on English
// (so it never touches the DOM) and translate strings through its API.
async function translator(game) {
  const data = JSON.parse(read(`public/i18n/pl/${game}.json`));
  const noop = () => {};
  const context = {
    localStorage: { getItem: () => "en" },
    location: { pathname: `/games/${game}/index.html` },
    fetch: async () => ({ ok: true, json: async () => data }),
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
  };
  context.window = context;
  context.document = {
    currentScript: { getAttribute: () => game },
    readyState: "complete",
    addEventListener: noop,
    body: null,
  };
  context.addEventListener = noop;
  vm.runInNewContext(read("public/i18n/pl-body.js"), context);
  await context.tlabPlBody.ready();
  return (s) => context.tlabPlBody.translate(s);
}

test("runtime: whole strings, dot-separated parts and patterns", async () => {
  const t = await translator("son-100-gun");
  assert.equal(t("Who do you tell?"), "Komu powiesz?");
  assert.equal(t("Day 12"), "Dzień 12");
  assert.equal(t("Uncertain · 40%"), "Niepewne · 40%");
  assert.equal(t("Nothing in this sentence was ever translated"), null);
  const v = await translator("veto-h");
  assert.equal(v("Normal Summon"), "Zwykłe przywołanie");
  const d = await translator("tc-sim");
  assert.equal(d("Last meaningful contact 3 weeks ago"), "Ostatni ważny kontakt 3 tyg. temu");
});

test("Esik renders its English copy for Polish readers", () => {
  assert.match(
    read("public/games/esik/app.js"),
    /\["en", "pl"\]\.includes\(localStorage\.getItem\("tariklab\.language"\)\)/,
  );
});

test("games marked pl: body in the coverage record load the body layer", () => {
  const cov = JSON.parse(read("docs/INTERACTIVE_LANGUAGE_I18N_COVERAGE.json"));
  const body = cov.games.filter((g) => g.pl === "body").map((g) => g.id);
  assert.deepEqual([...body].sort(), [...games].sort());
});
