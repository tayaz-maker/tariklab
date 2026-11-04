// Lossless packing of our generated artwork; no new dependency or raster redrawing.
import { createRequire } from "node:module";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
// The existing locked Playwright distribution already contains the pngjs codec.
// This development-only dependency is never included in the browser runtime.
const { PNG } = require(resolve("node_modules/playwright-core/lib/utilsBundle.js"));
const pixel = (image, x, y) => (y * image.width + x) * 4;
function copyRect(source, target, sx, sy, width, height, tx, ty) {
  for (let row = 0; row < height; row++)
    source.data.copy(
      target.data,
      pixel(target, tx, ty + row),
      pixel(source, sx, sy + row),
      pixel(source, sx, sy + row) + width * 4,
    );
}
function trim(source, f) {
  let left = f.w,
    top = f.h,
    right = -1,
    bottom = -1;
  for (let y = 0; y < f.h; y++)
    for (let x = 0; x < f.w; x++)
      if (source.data[pixel(source, f.x + x, f.y + y) + 3]) {
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
  assert.ok(right >= left, "Empty authored building frame");
  // Keep the original world-space pivot inside the trimmed rectangle, plus padding.
  left = Math.max(0, Math.min(left, Math.floor(f.pivot.x)) - 2);
  top = Math.max(0, Math.min(top, Math.floor(f.pivot.y)) - 2);
  right = Math.min(f.w - 1, Math.max(right, Math.ceil(f.pivot.x)) + 2);
  bottom = Math.min(f.h - 1, Math.max(bottom, Math.ceil(f.pivot.y)) + 2);
  return { left, top, w: right - left + 1, h: bottom - top + 1 };
}
function pack(rects) {
  const ordered = [...rects].sort((a, b) => b.h - a.h || b.w - a.w || (a.name < b.name ? -1 : 1));
  let best = null;
  for (let width = 256; width <= 2048; width += 64) {
    let x = 2,
      y = 2,
      rowHeight = 0,
      valid = true;
    const placements = [];
    for (const r of ordered) {
      if (r.w + 4 > width) {
        valid = false;
        break;
      }
      if (x + r.w + 2 > width) {
        x = 2;
        y += rowHeight + 4;
        rowHeight = 0;
      }
      placements.push({ ...r, x, y });
      x += r.w + 4;
      rowHeight = Math.max(rowHeight, r.h);
    }
    const height = Math.ceil((y + rowHeight + 2) / 4) * 4;
    if (!valid || height > 2048) continue;
    const area = width * height;
    if (!best || area < best.area) best = { width, height, area, placements };
  }
  assert.ok(best, "Atlas exceeds the original2048maximum");
  return best;
}
function verify(source, originalFrames, target, newFrames) {
  let visiblePixels = 0;
  for (const [name, old] of Object.entries(originalFrames)) {
    const next = newFrames[name],
      dx = old.pivot.x - next.pivot.x,
      dy = old.pivot.y - next.pivot.y;
    assert.ok(Number.isInteger(dx) && Number.isInteger(dy));
    for (let y = 0; y < old.h; y++)
      for (let x = 0; x < old.w; x++) {
        const from = pixel(source, old.x + x, old.y + y),
          nx = x - dx,
          ny = y - dy;
        if (nx < 0 || ny < 0 || nx >= next.w || ny >= next.h) {
          assert.equal(source.data[from + 3], 0, `${name}: a visible pixel was trimmed`);
          continue;
        }
        const to = pixel(target, next.x + nx, next.y + ny);
        for (let channel = 0; channel < 4; channel++)
          assert.equal(
            source.data[from + channel],
            target.data[to + channel],
            `${name}: pixel or pivot changed`,
          );
        if (source.data[from + 3]) visiblePixels++;
      }
  }
  return visiblePixels;
}
export function compactAtlas(atlas, images) {
  const result = structuredClone(atlas),
    buffers = {},
    groups = [];
  for (const key of ["buildings", "actors"]) {
    const original = atlas[key],
      source = PNG.sync.read(images[key]);
    let target, frames;
    if (key === "buildings") {
      const rects = Object.entries(original.frames).map(([name, f]) => ({
        name,
        ...trim(source, f),
      }));
      const packed = pack(rects);
      target = new PNG({ width: packed.width, height: packed.height });
      target.data.fill(0);
      frames = {};
      for (const r of packed.placements) {
        const f = original.frames[r.name];
        copyRect(source, target, f.x + r.left, f.y + r.top, r.w, r.h, r.x, r.y);
        frames[r.name] = {
          x: r.x,
          y: r.y,
          w: r.w,
          h: r.h,
          pivot: { x: f.pivot.x - r.left, y: f.pivot.y - r.top },
        };
      }
    } else {
      // Animation cells and foot pivots stay identical; remove only unused outer rows/columns.
      const width =
        Math.ceil((Math.max(...Object.values(original.frames).map((f) => f.x + f.w)) + 2) / 4) * 4;
      const height =
        Math.ceil((Math.max(...Object.values(original.frames).map((f) => f.y + f.h)) + 2) / 4) * 4;
      assert.ok(width <= source.width && height <= source.height);
      target = new PNG({ width, height });
      target.data.fill(0);
      frames = structuredClone(original.frames);
      copyRect(source, target, 0, 0, width, height, 0, 0);
    }
    const visiblePixelsVerified = verify(source, original.frames, target, frames);
    const buffer = PNG.sync.write(target, {
      colorType: 6,
      inputColorType: 6,
      bitDepth: 8,
      deflateLevel: 9,
      deflateStrategy: 0,
      filterType: 0,
    });
    const roundtrip = PNG.sync.read(buffer);
    assert.deepEqual(roundtrip.data, target.data);
    result[key] = { ...original, width: target.width, height: target.height, frames };
    buffers[key] = buffer;
    groups.push({
      key,
      frames: Object.keys(frames).length,
      visiblePixelsVerified,
      before: {
        width: source.width,
        height: source.height,
        decodedBytes: source.width * source.height * 4,
      },
      after: {
        width: target.width,
        height: target.height,
        decodedBytes: target.width * target.height * 4,
        pngBytes: buffer.length,
      },
    });
  }
  return {
    atlas: result,
    buffers,
    verification: {
      status: "PASS",
      groups,
      scope:
        "Every RGBA pixel retained within a frame is byte-identical; removed pixels have zero alpha. All visible pixels retain their world-space offset from the original pivot. Animation cells/pivots are unchanged.",
    },
  };
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const input = "public/games/social-engine/assets",
    output = resolve(process.env.SE_ATLAS_EXPERIMENT_DIR || "../atlas-experiment");
  const atlas = JSON.parse(await readFile(`${input}/atlas.json`));
  const result = compactAtlas(atlas, {
    buildings: await readFile(`${input}/${atlas.buildings.image}`),
    actors: await readFile(`${input}/${atlas.actors.image}`),
  });
  await mkdir(output, { recursive: true });
  for (const key of ["buildings", "actors"])
    await writeFile(`${output}/${atlas[key].image}`, result.buffers[key]);
  await writeFile(`${output}/atlas.json`, JSON.stringify(result.atlas, null, 2) + "\n");
  await writeFile(
    `${output}/verification.json`,
    JSON.stringify(result.verification, null, 2) + "\n",
  );
  console.log(JSON.stringify(result.verification));
}
