/** Packed opacity, bounds, and optionally every opaque pixel in an atlas cell. */
export type AlphaMask = {
  width: number;
  height: number;
  bits: Uint8Array;
  pixels: Uint32Array;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export function alphaMask(rgba: Uint8ClampedArray, width: number, height: number, listPixels = false): AlphaMask {
  const bits = new Uint8Array(Math.ceil((width * height) / 8));
  const indices: number[] = [];
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let i = 0; i < width * height; i++) {
    if (rgba[i * 4 + 3] < 160) continue;
    bits[i >> 3] |= 1 << (i & 7);
    if (listPixels) indices.push(i);
    const x = i % width, y = Math.floor(i / width);
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  return { width, height, bits, pixels: Uint32Array.from(indices), minX, minY, maxX, maxY };
}

/**
 * Test every opaque actor pixel, transformed into building-cell coordinates.
 * Rotated pixels use a conservative axis-aligned enclosing box (at most an
 * edge-pixel false positive) so small overlaps cannot fall between samples.
 */
export function masksOverlap(
  building: AlphaMask,
  actor: AlphaMask,
  originX: number,
  originY: number,
  pivotX: number,
  pivotY: number,
  scaleX: number,
  scaleY: number,
  rotation: number,
): boolean {
  if (building.maxX < 0 || actor.maxX < 0) return false;
  const cos = Math.cos(rotation), sin = Math.sin(rotation);
  const xx = scaleX * cos, xy = scaleX * sin, yx = -scaleY * sin, yy = scaleY * cos;
  const left = originX - pivotX * xx - pivotY * yx;
  const top = originY - pivotX * xy - pivotY * yy;
  const minXDelta = Math.min(0, xx) + Math.min(0, yx), maxXDelta = Math.max(0, xx) + Math.max(0, yx);
  const minYDelta = Math.min(0, xy) + Math.min(0, yy), maxYDelta = Math.max(0, xy) + Math.max(0, yy);
  const actorMinX = left + Math.min(actor.minX * xx, (actor.maxX + 1) * xx) + Math.min(actor.minY * yx, (actor.maxY + 1) * yx);
  const actorMaxX = left + Math.max(actor.minX * xx, (actor.maxX + 1) * xx) + Math.max(actor.minY * yx, (actor.maxY + 1) * yx);
  const actorMinY = top + Math.min(actor.minX * xy, (actor.maxX + 1) * xy) + Math.min(actor.minY * yy, (actor.maxY + 1) * yy);
  const actorMaxY = top + Math.max(actor.minX * xy, (actor.maxX + 1) * xy) + Math.max(actor.minY * yy, (actor.maxY + 1) * yy);
  if (actorMaxX < building.minX || actorMinX >= building.maxX + 1 ||
      actorMaxY < building.minY || actorMinY >= building.maxY + 1) return false;
  for (const index of actor.pixels) {
    const x = index % actor.width, y = Math.floor(index / actor.width);
    const px = left + x * xx + y * yx, py = top + x * xy + y * yy;
    const x0 = Math.max(building.minX, Math.floor(px + minXDelta));
    const x1 = Math.min(building.maxX, Math.floor(px + maxXDelta));
    const y0 = Math.max(building.minY, Math.floor(py + minYDelta));
    const y1 = Math.min(building.maxY, Math.floor(py + maxYDelta));
    for (let by = y0; by <= y1; by++) for (let bx = x0; bx <= x1; bx++) {
      const bit = by * building.width + bx;
      if (building.bits[bit >> 3] & (1 << (bit & 7))) return true;
    }
  }
  return false;
}
