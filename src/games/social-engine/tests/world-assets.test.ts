import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { BUILDINGS, isWalkable, ROADS } from "../domain/world.ts";
const root = new URL("../../../../public/games/social-engine/assets/", import.meta.url);
const readJson = async (name: string) => JSON.parse(await readFile(new URL(name, root), "utf8"));

test("original atlas frames are bounded, nonoverlapping and have consistent animation foot pivots", async () => {
  const atlas = await readJson("atlas.json");
  assert.match(atlas.creator, /Original procedural/);
  assert.match(atlas.license, /no third-party source images/);
  for (const key of ["buildings", "actors"]) {
    const group = atlas[key],
      image = await readFile(new URL(group.image, root));
    assert.equal(image.readUInt32BE(16), 2048);
    assert.equal(image.readUInt32BE(20), 2048);
    const frames = Object.entries(group.frames) as [
      string,
      { x: number; y: number; w: number; h: number; pivot: { x: number; y: number } },
    ][];
    for (let i = 0; i < frames.length; i++) {
      const [name, f] = frames[i];
      assert.ok(f.x >= 0 && f.y >= 0 && f.x + f.w <= 2048 && f.y + f.h <= 2048, name);
      assert.ok(f.pivot.x >= 0 && f.pivot.x <= f.w && f.pivot.y >= 0 && f.pivot.y <= f.h, name);
      for (let j = i + 1; j < frames.length; j++) {
        const [other, g] = frames[j];
        assert.ok(
          f.x + f.w <= g.x || g.x + g.w <= f.x || f.y + f.h <= g.y || g.y + g.h <= f.y,
          `${name} overlaps ${other}`,
        );
      }
    }
  }
  assert.equal(Object.keys(atlas.buildings.frames).length, BUILDINGS.length);
  for (let appearance = 0; appearance < 8; appearance++)
    for (let direction = 0; direction < 4; direction++)
      for (let frame = 0; frame < 4; frame++)
        assert.deepEqual(atlas.actors.frames[`person-${appearance}-${direction}-${frame}`].pivot, {
          x: 32,
          y: 84,
        });
});
test("exported machine-readable chunks, collision and navigation exactly match authoritative geometry", async () => {
  const map = await readJson("kiyiyaka-map.json");
  assert.equal(map.name, "DARAMCIK");
  assert.equal(map.chunks.length, 4);
  assert.deepEqual(map.vehicleLanes, ROADS);
  assert.equal(map.portals.length, BUILDINGS.length);
  assert.equal(map.pedestrianGrid.rows.length, 129);
  for (let y = 0; y <= 128; y++)
    for (let x = 0; x <= 128; x++)
      assert.equal(
        map.pedestrianGrid.rows[y][x],
        isWalkable({ x: x / 2, y: y / 2 }) ? "1" : "0",
        `${x / 2},${y / 2}`,
      );
  for (const chunk of map.chunks) {
    assert.equal(chunk.ground.length, 1024);
    assert.equal(chunk.collision.length, 1024);
    for (let i = 0; i < 1024; i++)
      assert.equal(
        chunk.collision[i],
        isWalkable({ x: chunk.x + (i % 32) + 0.5, y: chunk.y + Math.floor(i / 32) + 0.5 }) ? 0 : 1,
      );
  }
  for (const building of BUILDINGS) {
    const portal = map.portals.find((p: { id: string }) => p.id === building.id + "-portal");
    assert.deepEqual(portal.from, { ...building.door, scene: "outside" });
    assert.deepEqual(portal.to, { x: 7, y: 9, scene: building.id });
  }
});
