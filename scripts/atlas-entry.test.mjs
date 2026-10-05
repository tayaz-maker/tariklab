import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("portal presents the 3D anatomy preview first and preserves a direct 2D alternative", async () => {
  const portal = await read("../src/components/portal/portal-home.tsx");
  assert.match(portal, /href="\/atlas\/3d\/"/);
  assert.match(portal, /href="\/atlas\/yapi\/"/);
  assert.match(portal, /portal\.atlas2d/);
});

test("both atlas surfaces link to one another and the 3D scope remains explicit", async () => {
  const legacyApp = await read("../public/atlas/yapi/app.js");
  const threeD = await read("../public/atlas/3d/index.html");
  const manifest = JSON.parse(await read("../public/atlas/3d/models/manifest.json"));
  assert.match(legacyApp, /href: '\/atlas\/3d\/'/);
  assert.match(threeD, /href="\.\.\/yapi\/"/);
  assert.equal(manifest.structures.length, 9);
  assert.equal(manifest.sex, "adult-male-reference");
  assert.equal(manifest.reviewStatus, "not-reviewed");
});
