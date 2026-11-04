import type { Point } from "../domain/types";
import { COLLIDER_RADIUS, LAND_HEIGHT, WORLD_SIZE, project } from "../domain/world.ts";

/** Presentation bounds include every reachable ground point, not a cropped art rectangle. */
export function cameraTranslation(
  focus: Point,
  viewport: { width: number; height: number },
  zoom: number,
  scene = "outside",
): Point {
  const r = COLLIDER_RADIUS;
  const corners =
    scene === "outside"
      ? [
          { x: 1 + r, y: 1 + r },
          { x: WORLD_SIZE - 1 - r, y: 1 + r },
          { x: 1 + r, y: LAND_HEIGHT - r },
          { x: WORLD_SIZE - 1 - r, y: LAND_HEIGHT - r },
        ]
      : [
          { x: 1 + r, y: 1 + r },
          { x: 13 - r, y: 1 + r },
          { x: 1 + r, y: 11 - r },
          { x: 13 - r, y: 11 - r },
        ];
  const projected = corners.map((p) => project(p));
  const minX = Math.min(...projected.map((p) => p.x)),
    maxX = Math.max(...projected.map((p) => p.x));
  const minY = Math.min(...projected.map((p) => p.y)),
    maxY = Math.max(...projected.map((p) => p.y));
  // Keep edge actors clear of the top HUD, bottom actions, and side minimap.
  const side = Math.min(300, viewport.width * 0.25),
    top = Math.min(220, viewport.height * 0.3),
    bottom = Math.min(170, viewport.height * 0.25);
  const center = (value: number, a: number, b: number) =>
    a > b ? (a + b) / 2 : Math.max(a, Math.min(b, value));
  const x = center(
    focus.x,
    minX + (viewport.width / 2 - side) / zoom,
    maxX - (viewport.width / 2 - side) / zoom,
  );
  const y = center(
    focus.y,
    minY + (viewport.height * 0.53 - top) / zoom,
    maxY - (viewport.height * 0.47 - bottom) / zoom,
  );
  return { x: viewport.width / 2 - x * zoom, y: viewport.height * 0.53 - y * zoom };
}
