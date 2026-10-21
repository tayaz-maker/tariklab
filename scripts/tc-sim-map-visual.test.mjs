import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const app = read("public/games/tc-sim/js/app.js");
const css = read("public/games/tc-sim/styles.css");
const locations = read("public/games/tc-sim/js/locations.js");
const state = read("public/games/tc-sim/js/state.js");

test("legacy fictional illustrations and district IDs remain beside the 23-region map", () => {
  for (const name of ["quarter-ridge.jpg", "quarter-shore.jpg", "quarter-edge.jpg", "city-ankara-west.jpg", "city-ankara-east.jpg", "city-izmir-konak.jpg", "city-izmir-bornova.jpg"]) {
    const bytes = readFileSync(new URL(`public/games/tc-sim/assets/map/${name}`, root));
    assert.ok(bytes.length > 20_000 && bytes.length < 400_000, name);
    assert.equal(bytes.subarray(0, 3).toString("hex"), "ffd8ff", name);
  }
  assert.match(app, /\["ridge","shore","edge"\]/);
  assert.match(app, /quarter-\$\{id\}\.jpg/);
  assert.match(app, /region-legacy-art/);
  assert.match(app, /loading="lazy"/);
  assert.match(app, /renderRegionMap\(state,selected,\{escapeText\}\)/);
  assert.match(app, /Sırt/);
  assert.doesNotMatch(app, /const pins=DISTRICTS/);
  assert.match(app, /city-ankara-west\.jpg/);
  assert.match(app, /city-izmir-konak\.jpg/);
  for (const plate of ["map-plate--ridge", "map-plate--shore", "map-plate--edge", "location-quarter"]) {
    assert.match(css, new RegExp(`\\.${plate}`));
  }
  assert.match(css, /min-height:380px/);
  for (const id of ["sisli", "kadikoy", "uskudar", "bayrampasa", "avcilar", "cankaya", "batikent", "konak", "bornova"]) {
    assert.match(locations, new RegExp(`id:'${id}'`));
  }
  assert.match(locations, /istanbul:'İstanbul',ankara:'Ankara',izmir:'İzmir'/);
  assert.match(state, /export const SAVE_VERSION = 6/);
  assert.doesNotMatch(app, /NORTH RIDGE|WEST-INDUSTRIAL|EAST SHORE/);
});
