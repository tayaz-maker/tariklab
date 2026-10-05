import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const source = ["Haftayı değerlendir", "Zaman / odak", "Zamanını nasıl kullandın?"];
const expected = {
  tr: source,
  en: ["Review the week", "Time / focus", "How did you use your time?"],
  pl: ["Podsumuj tydzień", "Czas / uwaga", "Jak wykorzystałeś swój czas?"],
};
async function load(language) {
  const context = { localStorage: { getItem: () => language, setItem() {} }, addEventListener() {}, document: undefined };
  const scripts = [...read("public/games/tc-sim/index.html").matchAll(/<script src="(\/i18n\/[^" ]+\.js)"/g)].map(match => match[1]);
  assert.deepEqual(scripts, ["/i18n/tlab-i18n.js", "/i18n/deep-en.js", "/i18n/deep-en-final.js", "/i18n/expansion-en.js", "/i18n/pl-body.js"]);
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
for (const language of ["tr", "en", "pl"]) test(`TC week controls use the real ${language} phrase/body APIs without altering counters`, async () => {
  const context = await load(language);
  assert.equal(context.tlabI18n.getLang(), language);
  const text = value => ({ nodeType: 3, nodeValue: value });
  const element = (tagName, childNodes) => ({ nodeType: 1, tagName, childNodes });
  const nodes = source.map(value => text(` ${value} `));
  const counter = text("2 / 3");
  const root = element("DIV", [nodes[0], element("SPAN", [nodes[1], element("B", [counter])]), nodes[2]]);
  context.tlabI18n.applyPhrases(root);
  for (let i = 0; i < nodes.length; i++) {
    const phrase = nodes[i].nodeValue.trim();
    const result = language === "pl" ? context.tlabPlBody.translate(phrase) ?? phrase : phrase;
    assert.equal(result, expected[language][i], source[i]);
    assert.ok(nodes[i].nodeValue.startsWith(" ") && nodes[i].nodeValue.endsWith(" "), "text-node whitespace remains intact");
  }
  assert.equal(counter.nodeValue, "2 / 3", "dynamic game-state counter remains untouched");
});
test("PL screen source and generated dictionary retain TR keys and translate the EN control pass", () => {
  const screen = JSON.parse(read("scripts/pl/screen/tc-sim.json"))["tc-sim"];
  const generated = JSON.parse(read("public/i18n/pl/tc-sim.json")).exact;
  for (let i = 0; i < source.length; i++) for (const key of [source[i], expected.en[i]]) {
    assert.equal(screen[key], expected.pl[i], `source: ${key}`);
    assert.equal(generated[key], expected.pl[i], `generated: ${key}`);
  }
});
