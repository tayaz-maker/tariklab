import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { buildAtlasGeometry, GEOMETRY_REVIEW, GEOMETRY_VERSION, projectPoint, STRUCTURE_IDS } from "../public/atlas/yapi/geometry.js";
import { createAtlasView } from "../public/atlas/yapi/svg-view.js";

test("four adult projections expose the same complete coarse structure IDs with bounded finite paths", () => {
  for (const variant of ["female", "male"]) for (const view of ["front", "back"]) {
    const model = buildAtlasGeometry({ variant, view });
    assert.equal(model.version, GEOMETRY_VERSION);
    assert.equal(model.review.status, "not-expert-reviewed");
    assert.deepEqual(model.viewBox, [0, 0, 420, 780]);
    assert.ok(model.paths.length < 180, "bounded SVG path count");
    assert.ok(Buffer.byteLength(JSON.stringify(model)) < 80000, "bounded generated model");
    assert.equal(new Set(model.paths.map(({ key }) => key)).size, model.paths.length);
    assert.deepEqual([...new Set(model.paths.map(({ structureId }) => structureId).filter(Boolean))].sort(), [...STRUCTURE_IDS].sort());
    for (const { d, layer, opacity = 1, structureId } of model.paths) {
      assert.ok(["surface", "skeleton", "organs"].includes(layer));
      assert.ok(structureId === null || STRUCTURE_IDS.includes(structureId));
      assert.ok(Number.isFinite(opacity) && opacity >= 0 && opacity <= 1);
      assert.match(d, /^M/);
      assert.doesNotMatch(d, /NaN|Infinity|undefined/);
      const values = d.match(/-?\d+(?:\.\d+)?/g).map(Number);
      assert.equal(values.length % 2, 0);
      for (let i = 0; i < values.length; i += 2) {
        assert.ok(values[i] >= 0 && values[i] <= 420, `x coordinate ${values[i]}`);
        assert.ok(values[i + 1] >= 0 && values[i + 1] <= 780, `y coordinate ${values[i + 1]}`);
      }
    }
  }
});

test("projection uses anatomical laterality: liver right, stomach and heart toward left", () => {
  const front = buildAtlasGeometry({ view: "front" }).landmarks;
  const back = buildAtlasGeometry({ view: "back" }).landmarks;
  assert.ok(front.liver.x < front.spine.x);
  assert.ok(front.stomach.x > front.spine.x);
  assert.ok(front.heart.x > front.spine.x);
  assert.ok(back.liver.x > back.spine.x);
  assert.ok(back.stomach.x < back.spine.x);
  assert.ok(back.heart.x < back.spine.x);
  for (const id of STRUCTURE_IDS) {
    assert.equal(front[id].x + back[id].x, 420);
    assert.equal(front[id].y, back[id].y);
  }
  assert.deepEqual(projectPoint(30, 344, "front"), { x: 180, y: 344 });
  assert.deepEqual(projectPoint(30, 344, "back"), { x: 240, y: 344 });
  assert.ok(front.brain.y < front.heart.y && front.heart.y < front.liver.y && front.liver.y < front.stomach.y);
  const geometry = buildAtlasGeometry({ view: "front" });
  for (const [key, direction] of [["liver-mass", -1], ["stomach-mass", 1], ["heart-mass", 1]]) {
    const xs = geometry.paths.find((path) => path.key === key).d.match(/-?\d+(?:\.\d+)?/g).map(Number).filter((_, i) => i % 2 === 0);
    assert.ok((((Math.min(...xs) + Math.max(...xs)) / 2) - 210) * direction > 0, `${key} geometry agrees with its laterality landmark`);
  }
});

test("body proportions are adult schematic and posterior anatomy is separately drawn", () => {
  const male = buildAtlasGeometry({ variant: "male" });
  const female = buildAtlasGeometry({ variant: "female" });
  const body = (model) => model.paths.find(({ key }) => key === "adult-surface");
  assert.notEqual(body(male).d, body(female).d, "variants use distinct proportions");
  const ys = body(male).d.match(/-?\d+(?:\.\d+)?/g).map(Number).filter((_, i) => i % 2);
  const height = Math.max(...ys) - Math.min(...ys);
  assert.ok(height / 95 > 7 && height / 95 < 8, "adult head/body proportion guard, not an anatomical measurement claim");
  for (const variant of ["female", "male"]) {
    const back = buildAtlasGeometry({ variant, view: "back" });
    assert.ok(back.paths.some(({ key }) => key === "posterior-midline"));
    assert.ok(back.paths.some(({ key }) => key === "back-scapular-plane-1"));
    assert.ok(!back.paths.some(({ key }) => key.startsWith("orbit-")));
    assert.ok(!back.paths.some(({ key }) => key === "sternum"));
    assert.ok(!back.paths.some(({ key }) => key.startsWith("chest-plane")));
    for (const side of [-1, 1]) {
      assert.ok(back.paths.some(({ key }) => key === `hand-surface-${side}`));
      assert.equal(back.paths.filter(({ key }) => key.startsWith(`hand-ray-${side}-`)).length, 5, "five coarse rays, without per-phalange detail");
    }
  }
  assert.throws(() => buildAtlasGeometry({ variant: "child" }), /Unknown atlas/);
  assert.throws(() => buildAtlasGeometry({ view: "side" }), /Unknown atlas/);
});

test("geometry is deterministic, without external art, invented vessels or accuracy approval", () => {
  assert.deepEqual(buildAtlasGeometry(), buildAtlasGeometry());
  assert.equal(GEOMETRY_REVIEW.status, "not-expert-reviewed");
  const source = ["geometry.js", "svg-view.js", "atlas-view.css"].map((name) => readFileSync(new URL(`../public/atlas/yapi/${name}`, import.meta.url), "utf8")).join("\n");
  assert.doesNotMatch(source, /fetch\(|new Image|<image|foreignObject|requestAnimationFrame|setInterval|AudioContext|vibrate\(|autoplay/);
  assert.ok(!STRUCTURE_IDS.includes("vessels") && !STRUCTURE_IDS.includes("nerves"));
});

class Element {
  constructor(tag) { this.tag = tag; this.attributes = {}; this.dataset = {}; this.children = []; this.listeners = new Map(); this.parent = null; }
  setAttribute(name, value) { this.attributes[name] = String(value); if (name.startsWith("data-")) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, char) => char.toUpperCase())] = String(value); }
  removeAttribute(name) { delete this.attributes[name]; }
  append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); } }
  replaceChildren(...nodes) { for (const node of this.children) node.parent = null; this.children = []; this.append(...nodes); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter((node) => node !== this); this.parent = null; }
  addEventListener(name, listener) { this.listeners.set(name, listener); }
  removeEventListener(name, listener) { if (this.listeners.get(name) === listener) this.listeners.delete(name); }
  contains(node) { return this === node || this.children.some((child) => child.contains(node)); }
  closest() { return this.attributes["data-id"] ? this : this.parent?.closest() || null; }
}
function all(node) { return [node, ...node.children.flatMap(all)]; }

test("SVG caches geometry across selection/layers/zoom and returns to the same four groups", () => {
  const oldDocument = globalThis.document;
  globalThis.document = { createElement: (tag) => new Element(tag), createElementNS: (_, tag) => new Element(tag) };
  try {
    const selections = [];
    const view = createAtlasView({ onSelect: (id) => selections.push(id) });
    const svg = view.element.children[0];
    const nodes = all(svg);
    const firstPaths = nodes.filter(({ tag }) => tag === "path");
    const pathsData = firstPaths.map(({ attributes }) => attributes.d);
    assert.equal(svg.attributes["aria-hidden"], "true");
    for (let i = 0; i < 30; i++) view.update({ selectedId: i % 2 ? "liver" : "heart", zoom: 1 + i % 3 });
    assert.deepEqual(all(svg), nodes, "state changes must not rebuild SVG DOM");
    assert.deepEqual(firstPaths.map(({ attributes }) => attributes.d), pathsData);
    const liver = firstPaths.find(({ dataset }) => dataset.id === "liver");
    svg.listeners.get("click")({ target: liver });
    assert.deepEqual(selections, ["liver"]);
    view.update({ layers: { organs: false } });
    svg.listeners.get("click")({ target: liver });
    assert.deepEqual(selections, ["liver"], "hidden organs cannot select");
    const initialGroup = nodes.find(({ attributes }) => attributes["data-variant"] === "male");
    for (const variant of ["female", "male"]) for (const projection of ["back", "front"]) view.update({ variant, view: projection });
    const groups = all(svg).filter(({ attributes }) => attributes["data-geometry-version"]);
    assert.equal(groups.length, 4);
    assert.ok(groups.includes(initialGroup));
    view.update({ variant: "male", view: "front", zoom: 1, panX: Infinity, panY: -999 });
    assert.equal(view.element.dataset.zoom, "1");
    const viewport = all(svg).find(({ attributes }) => attributes.class === "atlas-view__viewport");
    assert.equal(viewport.attributes.transform, "translate(210 390) scale(1) translate(-210 -390)");
    view.destroy(); view.destroy(); view.update({ view: "back" });
    assert.equal(svg.listeners.size, 0);
    assert.equal(view.element.children.length, 0);
  } finally { if (oldDocument === undefined) delete globalThis.document; else globalThis.document = oldDocument; }
});
