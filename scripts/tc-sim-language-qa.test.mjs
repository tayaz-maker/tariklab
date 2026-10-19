import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
async function load(language) {
  const context = { localStorage: { getItem: () => language, setItem() {} }, addEventListener() {}, document: undefined };
  const scripts = [...read("public/games/tc-sim/index.html").matchAll(/<script src="(\/i18n\/[^" ]+\.js)"/g)].map(match => match[1]);
  assert.deepEqual(scripts, ["/i18n/tlab-i18n.js", "/i18n/deep-en.js", "/i18n/deep-en-final.js", "/i18n/expansion-en.js", "/i18n/tc-sim.js", "/i18n/pl-body.js"]);
  for (const script of scripts.slice(0, -1)) vm.runInNewContext(read(`public${script}`), context);
  context.window = context;
  context.document = { body: null, currentScript: { getAttribute: () => "tc-sim" }, addEventListener() {} };
  context.fetch = async url => {
    assert.equal(url, "/i18n/pl/tc-sim.json");
    return { ok: true, json: async () => JSON.parse(read(`public${url}`)) };
  };
  vm.runInNewContext(read("public/i18n/pl-body.js"), context);
  await context.tlabPlBody.ready();
  return context;
}

for (const language of ["tr", "en", "pl"]) test(`TC actual API translates authored labels/patterns/help in ${language} without changing numbers`, async () => {
  const context = await load(language);
  for (const row of context.tlabI18n.TCSIM_LANGUAGE_QA) {
    const render = value => value.replace(/\{(\d+)#\}/g, (_, i) => ["1.840", "240", "2.400", "600"][i]);
    const raw = render(row[0]);
    const wanted = render(row[language === "tr" ? 0 : language === "en" ? 1 : 2]);
    assert.equal(context.tlabI18n.phrase(raw), wanted, raw);
    const text = { nodeType: 3, nodeValue: ` ${raw} ` };
    const counter = { nodeType: 3, nodeValue: "2 / 7 · 285.000 TL" };
    const root = { nodeType: 1, tagName: "DIV", childNodes: [text, counter] };
    context.tlabI18n.applyPhrases(root);
    assert.equal(text.nodeValue, ` ${wanted} `, raw);
    assert.equal(counter.nodeValue, "2 / 7 · 285.000 TL");
    if (language === "pl") {
      for (const key of [row[0], row[1]]) assert.equal(context.tlabPlBody.translate(render(key)), wanted, key);
    }
  }
});
test("every existing icra, risk and army decision title/detail uses the real EN/PL APIs", async () => {
  const { ICRA_DECISIONS } = await import("../public/games/tc-sim/js/icra.js");
  const { RISK_DECISIONS } = await import("../public/games/tc-sim/js/risk-layer.js");
  const { ASKER_DECISIONS } = await import("../public/games/tc-sim/js/askerlik.js");
  for (const language of ["en", "pl"]) {
    const { tlabI18n: I } = await load(language);
    for (const decision of [...ICRA_DECISIONS, ...RISK_DECISIONS, ...ASKER_DECISIONS]) {
      for (const raw of [decision.title, decision.detail]) assert.notEqual(I.phrase(raw), raw, raw);
    }
  }
});
test("attributes and help use TC overlay; other game documents never load it", async () => {
  const c = await load("pl");
  const attrs = { title: "İcrayı kapat", "aria-label": "Kalfa tut" };
  const node = { nodeType: 1, tagName: "BUTTON", childNodes: [], getAttribute: k => attrs[k], setAttribute: (k,v) => { attrs[k]=v; } };
  c.tlabI18n.applyPhrases(node);
  assert.equal(attrs.title, "Spłać dług egzekucyjny");
  assert.equal(attrs["aria-label"], "Zatrudnij pomocnika");
  for (const section of c.tlabI18n.TCSIM_HELP_EN) for (const raw of [section.title,section.body]) assert.notEqual(c.tlabI18n.phrase(raw), raw, raw);
  const { SAVE_VERSION, createNewGame } = await import("../public/games/tc-sim/js/state.js");
  const state = createNewGame({seed:11}); const before = JSON.stringify(state);
  c.tlabI18n.applyPhrases(node);
  assert.equal(JSON.stringify(state), before); assert.equal(SAVE_VERSION, 6);
  assert.doesNotMatch(read("public/games/hanedanian/index.html"), /i18n\/tc-sim\.js/);
});
