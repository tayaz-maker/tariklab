// DEVLET depth: regional priority → capacity → service gap / public reaction →
// next-period effect, and diplomacy → agreement, pressure, trade, risk and a
// delayed domestic effect. The maps stay the same decision tools.
import test from "node:test";
import assert from "node:assert/strict";
import { hydrateDevlet, applyAction } from "../public/games/next-wave.js";
import {
  previewFocus,
  previewDiplomacy,
  applyGeoTick,
  ensureGeo,
  quietMonths,
  reactionFor,
  QUIET_REACTION,
  LOW_DELIVERY,
  LOW_DELIVERY_FACTOR,
  AGREEMENT_AT,
  AGREEMENT_MONTHS,
  PRESSURE_BELOW,
} from "../public/games/next-wave/devlet-geo.js";
import { screenHtml } from "../public/games/tc-sim-devlet/presentation.js";

const fresh = () => {
  const s = hydrateDevlet("2002");
  s.meta = { ...(s.meta || {}), id: "tc-sim-devlet", version: s.meta?.version };
  return s;
};
const act = (s, a) => applyAction("tc-sim-devlet", s, a);
const region = (s, id) => s.regions.find((r) => r.id === id);

test("capacity: weak delivery readiness turns less of a priority into service", () => {
  const s = fresh();
  region(s, "dogu").impl = LOW_DELIVERY + 10;
  const strong = previewFocus(s, "dogu");
  region(s, "dogu").impl = LOW_DELIVERY - 10;
  const weak = previewFocus(s, "dogu");
  assert.equal(strong.weak, false);
  assert.equal(weak.weak, true);
  assert.equal(weak.factor, LOW_DELIVERY_FACTOR);
  assert.ok(weak.gain.services < strong.gain.services, "less service from the same capacity");
  assert.equal(weak.cost, strong.cost, "the capacity cost does not change");
});

test("service gap: a neglected region with a gap reacts; a priority stops it", () => {
  const s = fresh();
  const r = region(s, "dogu");
  r.services = 30;
  const others = s.regions.filter((x) => x.id !== "dogu");
  for (const x of others) {
    x.services = 70;
    x.satisfaction = 70;
  }
  let reactions = 0;
  for (let i = 0; i < QUIET_REACTION; i += 1) {
    act(s, "focus:marmara");
    const before = r.heat;
    act(s, "advance");
    if (ensureGeo(s).log.length && quietMonths(s, "dogu") >= QUIET_REACTION) {
      reactions += 1;
      assert.ok(r.heat >= before, "tension rises with the reaction");
    }
  }
  assert.equal(quietMonths(s, "dogu"), QUIET_REACTION);
  assert.ok(reactions >= 1, "the reaction started");
  assert.ok(reactionFor(s, r), "and it keeps going");
  const p = previewFocus(s, "dogu");
  assert.equal(p.reactionStops, true, "the preview says a priority stops it");
  assert.equal(quietMonths(s, "marmara"), 0, "the priority region is never quiet");
  act(s, "focus:dogu");
  act(s, "advance");
  assert.equal(quietMonths(s, "dogu"), 0);
  assert.equal(reactionFor(s, r), null);
});

test("no gap, no reaction, however long the quiet", () => {
  const s = fresh();
  for (const x of s.regions) {
    x.services = 80;
    x.satisfaction = 80;
  }
  const g = ensureGeo(s);
  g.quiet.ege = 12;
  assert.equal(reactionFor(s, region(s, "ege")), null);
});

test("next period: a priority leaves perceived service for the following month, once", () => {
  const s = fresh();
  act(s, "focus:ic-anadolu");
  act(s, "advance");
  const g = ensureGeo(s);
  assert.equal(g.later.filter((x) => x.id === "ic-anadolu").length, 1, "queued for next month");
  const due = g.later.find((x) => x.id === "ic-anadolu").due;
  assert.equal(due, s.time.turn + 1, "due at the next month close");
  act(s, "advance");
  assert.equal(ensureGeo(s).later.filter((x) => x.id === "ic-anadolu").length, 0, "applied once");
});

test("diplomacy: a warm trade step becomes an agreement that pays monthly and expires", () => {
  const s = fresh();
  s.foreign.eu = AGREEMENT_AT;
  const p = previewDiplomacy(s, "eu", "trade");
  assert.equal(p.formsAgreement, true);
  act(s, "diplo:eu:trade");
  while (s.time.turn < p.dueTurn) act(s, "advance");
  const a = ensureGeo(s).agreements.eu;
  assert.ok(a, "agreement formed on its due month");
  assert.equal(a.kind, "trade");
  assert.equal(a.until, p.dueTurn + AGREEMENT_MONTHS);
  const w = s.devletDepth.world;
  const before = w.tradeDemand;
  const t = JSON.parse(JSON.stringify(s));
  applyGeoTick(s);
  delete ensureGeo(t).agreements.eu;
  applyGeoTick(t);
  assert.ok(
    w.tradeDemand > t.devletDepth.world.tradeDemand || before >= 100,
    "trade demand gains from it",
  );
  while (s.time.turn <= a.until) act(s, "advance");
  assert.equal(ensureGeo(s).agreements.eu, undefined, "expired");
});

test("diplomacy: stepping back from a running agreement breaches it and costs at home", () => {
  const s = fresh();
  ensureGeo(s).agreements.eu = { kind: "security", until: s.time.turn + 4 };
  const plain = previewDiplomacy(fresh(), "eu", "distance");
  const p = previewDiplomacy(s, "eu", "distance");
  assert.ok(p.breach, "the preview names the breach");
  assert.equal(p.heat, plain.heat + p.breach.heat);
  assert.ok(p.relation.eu.to < plain.relation.eu.to, "the relation drops further");
  act(s, "diplo:eu:distance");
  assert.equal(ensureGeo(s).agreements.eu, undefined);
  assert.ok(ensureGeo(s).log.some((x) => x.type === "breach" && x.axis === "eu"));
});

test("pressure: strained parties cut trade and add tension; at most two count", () => {
  const s = fresh();
  for (const k of Object.keys(s.foreign)) s.foreign[k] = 50;
  s.foreign.ru = PRESSURE_BELOW - 5;
  s.foreign.ir = PRESSURE_BELOW - 5;
  s.foreign.gulf = PRESSURE_BELOW - 5;
  assert.equal(previewDiplomacy(s, "ru", "trade").pressing, true);
  const heat = s.heat;
  const out = applyGeoTick(s);
  const pressure = out.find((x) => x.type === "pressure");
  assert.ok(pressure);
  assert.equal(pressure.axes.length, 2);
  assert.ok(s.heat > heat);
});

test("saves: old geo state gains empty depth fields; bad entries are dropped in place", () => {
  const s = fresh();
  const g = ensureGeo(s);
  delete g.quiet;
  delete g.later;
  delete g.agreements;
  const n = ensureGeo(s);
  assert.equal(n, g, "normalised in place");
  assert.deepEqual(n.quiet, {});
  assert.deepEqual(n.later, []);
  assert.deepEqual(n.agreements, {});
  n.quiet = { ege: 2, x: -1, y: 1.5 };
  n.later = [{ id: "ege", due: 3, satisfaction: 1 }, { id: 4 }, null];
  n.agreements = {
    eu: { kind: "trade", until: 9 },
    moon: { kind: "trade", until: 9 },
    ru: { kind: "war", until: 9 },
  };
  ensureGeo(s);
  assert.deepEqual(n.quiet, { ege: 2 });
  assert.equal(n.later.length, 1);
  assert.deepEqual(Object.keys(n.agreements), ["eu"]);
});

test("panels: the region shows the four-step chain; the party shows agreement and pressure", () => {
  const s = fresh();
  for (const lang of ["tr", "en"]) {
    globalThis.window = { tlabI18n: { getLang: () => lang, phrase: (x) => x } };
    const regions = screenHtml(s, {
      screen: "regions",
      map: { region: "dogu", metric: "satisfaction" },
    });
    const chain = regions.match(/<ol class="geo-chain"[\s\S]*?<\/ol>/);
    assert.ok(chain, lang);
    assert.equal((chain[0].match(/<li>/g) || []).length, 4);
    ensureGeo(s).agreements.eu = { kind: "trade", until: s.time.turn + 3 };
    s.foreign.ru = PRESSURE_BELOW - 1;
    const eu = screenHtml(s, { screen: "foreign", map: { axis: "eu" } });
    assert.match(eu, lang === "tr" ? /anlaşması · 3 ay kaldı/ : /agreement · 3 months left/);
    assert.match(eu, /dip-breach/, "distance names the breach");
    const ru = screenHtml(s, { screen: "foreign", map: { axis: "ru" } });
    assert.match(ru, lang === "tr" ? /Baskı:/ : /Pressure:/);
    for (const html of [regions, eu, ru])
      assert.doesNotMatch(html, /undefined|NaN|\[object Object\]/);
  }
  delete globalThis.window;
});
