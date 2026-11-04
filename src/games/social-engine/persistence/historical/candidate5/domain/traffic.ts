import { ROADS } from "./world.ts";
import type { Point } from "./types.ts";
export type Junction = Point & { id: string };
const edges = ROADS.flatMap((lane, index) =>
  lane.map((a, i) => ({ a, b: lane[(i + 1) % lane.length], lane: index })),
);
const nodes = new Map<string, Junction>();
for (const h of edges.filter((e) => e.a.y === e.b.y))
  for (const v of edges.filter((e) => e.a.x === e.b.x)) {
    if (h.lane === v.lane) continue;
    const x = v.a.x,
      y = h.a.y;
    if (
      x < Math.min(h.a.x, h.b.x) ||
      x > Math.max(h.a.x, h.b.x) ||
      y < Math.min(v.a.y, v.b.y) ||
      y > Math.max(v.a.y, v.b.y)
    )
      continue;
    const id = `junction:${x}:${y}`;
    nodes.set(id, { id, x, y });
  }
export const JUNCTIONS = [...nodes.values()].sort((a, b) => a.x - b.x || a.y - b.y);
/** Eight seconds green, then a one-second clearance interval. Time is authoritative ticks. */
export function signalAxis(
  tick: number,
  junction: Junction,
): "horizontal" | "vertical" | "clearance" {
  const phase = (tick + (junction.x + junction.y) * 3) % 180;
  return phase < 80
    ? "horizontal"
    : phase < 90
      ? "clearance"
      : phase < 170
        ? "vertical"
        : "clearance";
}
