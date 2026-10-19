import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { banksForDate, renderBankHistory } from "../public/games/tc-sim/js/banks-presentation.js";
import { NAVIGATION_ITEMS, getNavigationTarget } from "../public/games/tc-sim/js/navigation.js";
import { createNewGame, SAVE_VERSION } from "../public/games/tc-sim/js/state.js";
import { migrateState } from "../public/games/tc-sim/js/save.js";

test("Banks has one canonical navigation target next to Money, without losing Property/Market", () => {
  assert.equal(getNavigationTarget("banks"), "banks");
  assert.equal(NAVIGATION_ITEMS.filter(i => i.view === "banks").length, 1);
  const index = NAVIGATION_ITEMS.findIndex(i => i.view === "finance");
  assert.equal(NAVIGATION_ITEMS[index + 1].view, "banks");
  assert.equal(getNavigationTarget("emlak"), "emlak");
  assert.equal(getNavigationTarget("market"), "market");
});

test("historical brands respect documented operational and rename boundaries", () => {
  assert.deepEqual(banksForDate("1888-08-14"), []);
  assert.equal(banksForDate("1888-08-15")[0].name, "Ziraat Bankası");
  assert.equal(banksForDate("1924-08-25").some(b => b.id === "isbank"), false);
  assert.equal(banksForDate("1924-08-26").some(b => b.id === "isbank"), true);
  assert.equal(banksForDate("1946-06-20").some(b => b.id === "garanti"), false);
  assert.equal(banksForDate("1946-06-21").some(b => b.id === "garanti"), true);
  assert.equal(banksForDate("2019-06-09").find(b => b.id === "garanti").name, "Garanti Bankası");
  assert.equal(banksForDate("2019-06-10").find(b => b.id === "garanti").name, "Garanti BBVA");
});

test("dated service context never invents an exact 1997 launch day or pre-launch internet access", () => {
  const service = date => banksForDate(date, "en").find(b => b.id === "isbank").service;
  assert.match(service("1996-12-31"), /not opened yet/);
  assert.match(service("1997-01-01"), /exact launch day is not modeled/);
  assert.match(service("1998-01-01"), /opened in 1997/);
});

test("TR/EN/PL historical context is separated from game offers and contains official sources", () => {
  for (const [lang, heading, disclaimer] of [["tr", "Dönemin bankaları", "oyun modelidir"], ["en", "Banks of the period", "game models"], ["pl", "Banki danej epoki", "modelem gry"]]) {
    const html = renderBankHistory("2017-04-18", lang);
    assert.ok(html.includes(heading)); assert.ok(html.includes(disclaimer));
    assert.ok(!html.includes("Garanti BBVA</summary>"));
    assert.equal((html.match(/data-bank-id=/g) || []).length, 3);
    assert.equal((html.match(/rel="noopener noreferrer"/g) || []).length, 3);
    assert.doesNotMatch(html, /data-credit|data-wealth-action|data-exchange/);
    if (lang !== "tr") assert.doesNotMatch(html, /oyun modelidir|tarım kredileri|Şube bankacılığı/);
  }
});

test("presentation never introduces save fields or changes old V5/V6 finances", () => {
  for (const version of [5, 6]) {
    const s = createNewGame({ seed: 17 }); s.meta.saveVersion = version;
    const migrated = migrateState(s); assert.ok(migrated.ok);
    const before = structuredClone(migrated.state);
    renderBankHistory(migrated.state.time.date, "pl");
    assert.deepEqual(migrated.state, before);
    assert.equal(SAVE_VERSION, 6);
    assert.equal(migrated.state.flags.bankAccounts, undefined);
  }
  const source = readFileSync("public/games/tc-sim/js/banks-presentation.js", "utf8");
  assert.doesNotMatch(source, /localStorage|transact\(|Math.random|finances\s*=/);
});

test("help describes the actual Money/Banks split directly in TR/EN/PL", async () => {
  const { renderHelpModal } = await import("../public/games/tc-sim/js/help.js");
  const oldWindow = globalThis.window;
  try {
    for (const [lang, expected] of [["tr", "kredi sicili Bankalar"], ["en", "credit history are in Banks"], ["pl", "historia kredytowa są w Bankach"]]) {
      globalThis.window = { tlabI18n: { getLang: () => lang, contentLang: () => "tr" } };
      assert.ok(renderHelpModal().includes(expected));
      assert.ok(!renderHelpModal().includes("Para ekranında nakit, net servet, borçlar, banka kredisi"));
    }
  } finally { globalThis.window = oldWindow; }
});
