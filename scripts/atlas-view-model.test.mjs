import assert from "node:assert/strict";
import test from "node:test";
import { createAtlasState, reduceAtlasState, visibleStructures, STRUCTURE_IDS } from "../public/atlas/yapi/view-model.js";
import { buildAtlasGeometry } from "../public/atlas/yapi/geometry.js";

function freeze(value) {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

const structures = freeze([
  { id: "heart", systems: ["organs"], label: { tr: "Kalp", en: "Heart", pl: "Serce" }, searchTerms: { tr: ["dolaşım"], en: ["circulation"], pl: ["krążenie"] } },
  { id: "kidneys", systems: ["organs"], label: { tr: "Böbrekler", en: "Kidneys", pl: "Nerki" }, searchTerms: { tr: ["sıvı dengesi"], en: ["fluid balance"], pl: [] } },
  { id: "spine", systems: ["skeleton"], label: { tr: "Omurga", en: "Spine", pl: "Kręgosłup" }, searchTerms: { tr: ["iskelet"], en: ["vertebral column"], pl: [] } },
  { id: "skull", systems: ["skeleton"], views: ["front"], label: { tr: "Kafatası", en: "Skull", pl: "Czaszka" }, searchTerms: {} },
]);

test("defaults and overrides are independent, bounded in-memory presentation state", () => {
  const state = createAtlasState();
  assert.deepEqual(state, { variant: "female", view: "front", layers: { surface: true, skeleton: true, organs: true }, selectedId: "heart", query: "", zoom: 1, panX: 0, panY: 0, lessonIndex: 0, sourceOpen: false, locale: "tr" });
  const overrides = freeze({ variant: "male", view: "back", layers: { organs: false }, selectedId: "spine", zoom: 50, panX: 900, panY: -900, lessonIndex: 50, locale: "pl" });
  const changed = createAtlasState(overrides);
  assert.equal(changed.zoom, 3); assert.equal(changed.panX, 420); assert.equal(changed.panY, -780);
  assert.equal(changed.lessonIndex, 2); assert.equal(changed.layers.organs, false); assert.equal(changed.layers.skeleton, true);
  assert.notEqual(changed.layers, overrides.layers);
  assert.deepEqual(createAtlasState(null), state);
  assert.equal(STRUCTURE_IDS.length, 13); assert.equal(new Set(STRUCTURE_IDS).size, 13);
});

test("explicit variant, view, selection, layer and locale actions do not mutate frozen state", () => {
  const state = freeze(createAtlasState());
  const actions = [
    [{ type: "set-variant", value: "male" }, "variant", "male"],
    [{ type: "set-view", view: "back" }, "view", "back"],
    [{ type: "set-selection", id: "kidneys" }, "selectedId", "kidneys"],
    [{ type: "set-locale", locale: "pl" }, "locale", "pl"],
  ];
  for (const [action, key, value] of actions) {
    const next = reduceAtlasState(state, freeze(action));
    assert.equal(next[key], value); assert.notEqual(next, state);
    assert.deepEqual(reduceAtlasState(state, action), next);
  }
  const hidden = reduceAtlasState(state, { type: "toggle-layer", layer: "organs" });
  assert.equal(hidden.layers.organs, false); assert.equal(state.layers.organs, true);
  assert.equal(hidden.selectedId, "heart", "hiding a layer does not fabricate a new selection");
  assert.equal(reduceAtlasState(state, { type: "set-selection", id: null }).selectedId, null);
});

test("zoom and pan remain bounded; shrinking and resetting restore the visible viewport", () => {
  let state = freeze(createAtlasState());
  assert.equal(reduceAtlasState(state, { type: "pan", dx: 100, dy: -100 }), state);
  state = reduceAtlasState(state, { type: "zoom", delta: 1 });
  state = reduceAtlasState(freeze(state), { type: "pan", dx: 999, dy: -999 });
  assert.deepEqual([state.zoom, state.panX, state.panY], [2, 210, -390]);
  state = reduceAtlasState(freeze(state), { type: "zoom", value: 1.5 });
  assert.deepEqual([state.panX, state.panY], [105, -195]);
  state = reduceAtlasState(freeze(state), { type: "reset-view" });
  assert.deepEqual([state.zoom, state.panX, state.panY], [1, 0, 0]);
  assert.equal(reduceAtlasState(state, { type: "zoom", value: 0 }), state);
  assert.equal(reduceAtlasState(state, { type: "zoom", value: 100 }).zoom, 3);
});

test("maximum zoom can pan the real cranial top back inside the 420 by 780 viewport", () => {
  for (const variant of ["female", "male"]) for (const view of ["front", "back"]) {
    const geometry = buildAtlasGeometry({ variant, view });
    const [, , width, height] = geometry.viewBox;
    const cranium = geometry.paths.find((path) => path.key === "cranium");
    const [, x, y] = /^M(-?[\d.]+) (-?[\d.]+)/.exec(cranium.d);
    const state = reduceAtlasState(createAtlasState({ variant, view, zoom: 3 }), { type: "pan", dy: 10000 });
    const renderedX = width / 2 + state.panX + state.zoom * (Number(x) - width / 2);
    const renderedY = height / 2 + state.panY + state.zoom * (Number(y) - height / 2);
    assert.ok(renderedX >= 0 && renderedX <= width, `${variant}/${view}: cranium x ${renderedX}`);
    assert.ok(renderedY >= 0 && renderedY <= height, `${variant}/${view}: cranium y ${renderedY}`);
  }
});

test("lesson navigation and source panel do not change structure or infer content", () => {
  const state = freeze(createAtlasState());
  assert.equal(reduceAtlasState(state, { type: "lesson-prev" }), state);
  let next = state;
  for (let n = 0; n < 5; n++) next = reduceAtlasState(freeze(next), { type: "lesson-next" });
  assert.equal(next.lessonIndex, 2); assert.equal(next.selectedId, "heart");
  next = reduceAtlasState(next, { type: "sources" });
  assert.equal(next.sourceOpen, true);
  next = reduceAtlasState(freeze(next), { type: "sources", open: false });
  assert.equal(next.sourceOpen, false);
});

test("visible structure mapping obeys actual layers and view while retaining source identity/order", () => {
  const state = freeze(createAtlasState());
  assert.deepEqual(visibleStructures(state, structures), structures);
  const filtered = visibleStructures(createAtlasState({ layers: { organs: false }, view: "back" }), structures);
  assert.deepEqual(filtered.map((s) => s.id), ["spine"]); assert.equal(filtered[0], structures[2]);
  assert.deepEqual(visibleStructures(createAtlasState({ layers: { skeleton: false, organs: false } }), structures), []);
  assert.deepEqual(visibleStructures(state, [null, { id: "made-up", systems: ["organs"] }, { id: "heart", systems: ["unsupported"] }]), []);
  assert.deepEqual(visibleStructures(state, null), []);
});

test("search covers current and alternate language labels and terms without losing Turkish or Polish matches", () => {
  for (const [locale, query, expected] of [
    ["tr", "KALP", ["heart"]], ["en", "dolasim", ["heart"]], ["pl", "krazenie", ["heart"]],
    ["tr", "BÖBREK", ["kidneys"]], ["tr", "sivi dengesi", ["kidneys"]], ["en", "fluid balance", ["kidneys"]],
    ["pl", "KREGOSLUP", ["spine"]], ["tr", "İSKELET", ["spine"]], ["en", "vertebral column", ["spine"]],
    ["en", "skull", ["skull"]], ["tr", "kalp böbrek", []], ["tr", "<img onerror=alert(1)>", []],
  ]) assert.deepEqual(visibleStructures(createAtlasState({ locale, query }), structures).map((s) => s.id), expected, `${locale}:${query}`);
  const state = reduceAtlasState(freeze(createAtlasState()), { type: "search", query: "x".repeat(400) + "\u0000" });
  assert.equal(state.query.length, 200);
  assert.equal(reduceAtlasState(createAtlasState(), { type: "search", value: "kalp\u0000" }).query, "kalp ");
});

test("malformed, unknown and nonfinite actions cannot corrupt selection or camera state", () => {
  const state = freeze(createAtlasState());
  for (const action of [null, false, 42, "zoom", {}, { type: "unknown" },
    { type: "set-selection", id: "__proto__" }, { type: "set-variant", value: "child" },
    { type: "set-locale", value: "xx" }, { type: "set-view", value: "side" },
    { type: "toggle-layer", layer: "__proto__" }, { type: "zoom", value: NaN },
    { type: "zoom", value: Infinity }, { type: "zoom", value: "3" }, { type: "pan", x: Infinity },
    { type: "pan", dy: NaN }, { type: "sources", open: "yes" }, { type: "search", query: {} },
  ]) assert.equal(reduceAtlasState(state, action), state);
  const invalid = createAtlasState({ zoom: NaN, panX: Infinity, panY: -Infinity, lessonIndex: NaN, layers: { organs: "false" }, selectedId: "unknown" });
  assert.deepEqual(invalid, state);
});

test("deterministic bounded action sequence keeps all camera values finite and input snapshots unchanged", () => {
  let state = createAtlasState(), seed = 41;
  for (let i = 0; i < 500; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const action = i % 3 === 0 ? { type: "zoom", value: (seed % 600) / 100 - 1 }
      : { type: "pan", dx: seed % 501 - 250, dy: (seed >>> 8) % 501 - 250 };
    const original = JSON.stringify(state);
    const next = reduceAtlasState(freeze(state), action);
    assert.equal(JSON.stringify(state), original);
    assert.deepEqual(next, reduceAtlasState(state, action));
    assert.ok(Number.isFinite(next.zoom) && next.zoom >= 1 && next.zoom <= 3);
    assert.ok(Math.abs(next.panX) <= (next.zoom - 1) * 210);
    assert.ok(Math.abs(next.panY) <= (next.zoom - 1) * 390);
    state = next;
  }
});
