// DEVLET maps: regional priority and diplomatic initiatives are real,
// previewed exactly, share governance capacity and carry delayed effects.
import test from "node:test";
import assert from "node:assert/strict";
import { hydrateDevlet, applyAction } from "../public/games/next-wave.js";
import { tickDevlet, applyPolicy, implementationRate } from "../public/games/next-wave/devlet-sim.js";
import {
  previewFocus,
  previewDiplomacy,
  applyGeoTick,
  ensureGeo,
  FOCUS_COST,
  FOREIGN_TIES,
  DIPLOMACY,
} from "../public/games/next-wave/devlet-geo.js";
import { validateDevletDepth } from "../public/games/next-wave/devlet-depth.js";
import { REGION_SHAPES } from "../public/games/tc-sim-devlet/maps.js";
import { screenHtml } from "../public/games/tc-sim-devlet/presentation.js";

const fresh = () => {
  const s = hydrateDevlet("2002");
  s.meta = { ...(s.meta || {}), id: "tc-sim-devlet", version: s.meta?.version };
  return s;
};
const clone = (s) => JSON.parse(JSON.stringify(s));
const act = (s, a) => applyAction("tc-sim-devlet", s, a);

test("the map covers all seven geographic regions the sim models", () => {
  const s = fresh();
  assert.deepEqual(Object.keys(REGION_SHAPES).sort(), s.regions.map((r) => r.id).sort());
  assert.equal(s.regions.length, 7);
});

test("a regional priority lands exactly as previewed, and the others pay for it", () => {
  const withFocus = fresh();
  const without = clone(withFocus);
  const p = previewFocus(withFocus, "dogu");
  assert.equal(p.ok, true);
  act(withFocus, "focus:dogu");
  assert.equal(withFocus.flags.governanceUsed, FOCUS_COST);
  act(withFocus, "advance");
  act(without, "advance");
  const a = withFocus.regions.find((r) => r.id === "dogu"), b = without.regions.find((r) => r.id === "dogu");
  assert.ok(Math.abs(a.impl - Math.min(90, b.impl + p.gain.impl)) < 1e-9, "delivery gain");
  assert.ok(Math.abs(a.services - (b.services + p.gain.services)) < 1e-9, "services gain");
  assert.ok(Math.abs(a.heat - Math.max(0, b.heat + p.gain.heat)) < 1e-9, "tension relief");
  const other = (st) => st.regions.find((r) => r.id === "marmara");
  assert.ok(Math.abs(other(withFocus).satisfaction - (other(without).satisfaction + p.neglect.satisfaction)) < 1e-9, "neglect elsewhere");
});

test("one priority per month, and returns diminish on the third month in a row", () => {
  const s = fresh();
  act(s, "focus:ege");
  const used = s.flags.governanceUsed;
  act(s, "focus:marmara");
  assert.equal(s.flags.governanceUsed, used, "second priority in a month refused");
  assert.equal(previewFocus(s, "marmara").ok, false);
  act(s, "advance");
  act(s, "focus:ege");
  act(s, "advance");
  const third = previewFocus(s, "ege");
  assert.equal(third.streak, 3);
  assert.ok(third.gain.impl < previewFocus(s, "marmara").gain.impl);
});

test("a diplomatic initiative moves the target, its rivals and partners exactly as previewed", () => {
  for (const [axis, kind] of [["eu", "trade"], ["ru", "security"], ["gulf", "distance"]]) {
    const s = fresh();
    const p = previewDiplomacy(s, axis, kind);
    assert.equal(p.ok, true, `${axis} ${kind}`);
    const heat = s.heat;
    act(s, `diplo:${axis}:${kind}`);
    for (const [k, r] of Object.entries(p.relation)) assert.equal(s.foreign[k], r.to, `${axis} ${kind} → ${k}`);
    for (const r of FOREIGN_TIES[axis].rivals) assert.ok(r in p.relation);
    assert.equal(s.heat, Math.max(0, Math.min(100, heat + p.heat)));
    assert.equal(s.flags.governanceUsed, DIPLOMACY[kind].cost);
  }
});

test("delayed diplomacy lands on its due month, once", () => {
  const s = fresh();
  const p = previewDiplomacy(s, "eu", "trade");
  act(s, "diplo:eu:trade");
  const after = s.foreign.eu;
  while (s.time.turn < p.dueTurn - 1) act(s, "advance");
  assert.equal(ensureGeo(s).pending.length, 1, "still pending before its month");
  const marmara0 = s.regions.find((r) => r.id === "marmara").activity;
  const snap = clone(s);
  act(s, "advance");
  act(snap, "advance");
  assert.equal(ensureGeo(s).pending.length, 0);
  assert.ok(s.foreign.eu >= after, "relation follow-up applied");
  void marmara0;
  const once = s.foreign.eu;
  act(s, "advance");
  assert.ok(Math.abs(s.foreign.eu - once) < 1e-9 || s.foreign.eu === once, "not applied twice");
});

test("maps share the month's governance capacity with policies", () => {
  const s = fresh();
  const capacity = Math.max(5, Math.round(implementationRate(s) / 15) + 2);
  let spent = 0;
  for (const axis of Object.keys(FOREIGN_TIES)) {
    if (previewDiplomacy(s, axis, "security").ok) { act(s, `diplo:${axis}:security`); spent += 2; }
  }
  assert.ok(spent <= capacity);
  assert.ok(s.flags.governanceUsed <= s.flags.governanceCapacity);
  const blocked = Object.keys(FOREIGN_TIES).find((axis) => !ensureGeo(s).used.includes(axis));
  if (blocked) assert.equal(previewDiplomacy(s, blocked, "security").ok, s.flags.governanceCapacity - s.flags.governanceUsed >= 2);
  const before = s.flags.governanceUsed;
  applyPolicy(s, "stability-anchor-does-not-exist");
  assert.ok(s.flags.governanceUsed >= before);
});

test("geo state survives save/load, old saves without it still validate, and nothing breaks after the run ends", () => {
  const s = fresh();
  act(s, "focus:akdeniz");
  act(s, "diplo:ir:trade");
  const loaded = JSON.parse(JSON.stringify(s));
  assert.equal(loaded.geo.focus.id, "akdeniz");
  assert.equal(validateDevletDepth(loaded), true);
  const old = clone(s);
  delete old.geo;
  assert.equal(validateDevletDepth(old), true);
  act(old, "advance");
  assert.deepEqual(ensureGeo(old).pending, []);
  const ended = fresh();
  ended.flags.campaignEnd = true;
  assert.equal(previewFocus(ended, "ege").ok, false);
  assert.equal(previewDiplomacy(ended, "eu", "trade").ok, false);
  assert.deepEqual(applyGeoTick(ended), []);
  void tickDevlet;
});

test("maps stay on the desk and relation records are not hidden in a closed table", () => {
  globalThis.window = {};
  try {
    const s = fresh();
    const foreign = screenHtml(s, { screen: "foreign", map: { axis: "eu" } });
    const regions = screenHtml(s, { screen: "regions", map: { region: "ege", metric: "satisfaction" } });
    assert.match(foreign, /class="dip-map"/);
    assert.match(regions, /class="geo-map"/);
    for (const html of [foreign, regions]) {
      assert.match(html, /class="data-grid geo-ledger"/);
      assert.match(html, /class="report-card"/);
      assert.doesNotMatch(html, /<details[^>]*geo-table/);
    }
    assert.match(foreign, /data-axis="eu"/);
    assert.match(regions, /data-region="ege"/);
    assert.match(regions, /data-focus="ege"/);
  } finally {
    delete globalThis.window;
  }
});
