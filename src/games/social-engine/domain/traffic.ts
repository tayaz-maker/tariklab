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
/** Overlapping lane crossings belong to one physical conflict zone. Reserving
 * each lane-coordinate separately can admit two opposing cars into the same box. */
export const JUNCTION_ZONES: Junction[][] = [];
for (const junction of JUNCTIONS) {
  const touching = JUNCTION_ZONES.filter((zone) =>
    zone.some((p) => Math.hypot(p.x - junction.x, p.y - junction.y) <= 2.1),
  );
  if (!touching.length) JUNCTION_ZONES.push([junction]);
  else {
    touching[0].push(junction);
    for (const zone of touching.slice(1)) {
      touching[0].push(...zone);
      JUNCTION_ZONES.splice(JUNCTION_ZONES.indexOf(zone), 1);
    }
  }
}
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

/** Persisted angles use nanoradians. ECMAScript transcendental functions may
 * differ by a final bit between engines; that bit must not become save authority.
 * This quantum is far below position precision and preserves exact save equality. */
export function canonicalHeading(radians: number): number {
  return Math.round(radians * 1_000_000_000) / 1_000_000_000;
}
export type AtlasDirection = 0 | 1 | 2 | 3;
/** World +X,+Y,-X,-Y respectively. Atlas artwork must implement this contract.
 * Heading is atan2(world dy, world dx), never an angle in projected screen space. */
export function worldHeadingToAtlasDirection(heading: number): AtlasDirection {
  return (((Math.round(heading / (Math.PI / 2)) % 4) + 4) % 4) as AtlasDirection;
}
export type TrafficPose = Point & { heading: number; tangent: Point; turning: boolean };
export const TURN_RADIUS = 0.8;
/** Pure rounded directed loop mapping. Progress retains the historical rectangular
 * perimeter and save representation; quadratic corner tangents are continuous.
 * Rendering consumes this physics pose, and must never round-trip screen positions. */
export function trafficPose(lane: number, progress: number): TrafficPose {
  const points = ROADS[lane] ?? ROADS[0];
  // Presentation/corrupt-input probes must be total. Validation still rejects the
  // invalid stored lane/progress; fallback values never repair an invalid save.
  if (!Number.isFinite(progress)) progress = 0;
  const lengths = points.map((a, i) =>
    Math.hypot(points[(i + 1) % points.length].x - a.x, points[(i + 1) % points.length].y - a.y),
  );
  const length = lengths.reduce((a, b) => a + b, 0),
    d = ((progress % length) + length) % length;
  let cumulative = 0;
  for (let i = 0; i < points.length; i++) {
    const corner = points[i],
      previous = points[(i + points.length - 1) % points.length],
      next = points[(i + 1) % points.length];
    let delta = d - cumulative;
    if (i === 0 && delta > length / 2) delta -= length;
    const r = Math.min(
      TURN_RADIUS,
      lengths[i] / 3,
      lengths[(i + points.length - 1) % points.length] / 3,
    );
    if (Math.abs(delta) <= r) {
      const incoming = {
          x: (corner.x - previous.x) / lengths[(i + points.length - 1) % points.length],
          y: (corner.y - previous.y) / lengths[(i + points.length - 1) % points.length],
        },
        outgoing = { x: (next.x - corner.x) / lengths[i], y: (next.y - corner.y) / lengths[i] },
        t = (delta + r) / (2 * r),
        a = { x: corner.x - incoming.x * r, y: corner.y - incoming.y * r },
        b = { x: corner.x + outgoing.x * r, y: corner.y + outgoing.y * r },
        dx = incoming.x * (1 - t) + outgoing.x * t,
        dy = incoming.y * (1 - t) + outgoing.y * t,
        norm = Math.hypot(dx, dy);
      return {
        x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * corner.x + t ** 2 * b.x,
        y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * corner.y + t ** 2 * b.y,
        heading: canonicalHeading(Math.atan2(dy, dx)),
        tangent: { x: dx / norm, y: dy / norm },
        turning: true,
      };
    }
    cumulative += lengths[i];
  }
  cumulative = 0;
  for (let i = 0; i < points.length; i++) {
    if (d < cumulative + lengths[i]) {
      const a = points[i],
        b = points[(i + 1) % points.length],
        t = (d - cumulative) / lengths[i],
        tangent = { x: (b.x - a.x) / lengths[i], y: (b.y - a.y) / lengths[i] };
      return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        heading: canonicalHeading(Math.atan2(tangent.y, tangent.x)),
        tangent,
        turning: false,
      };
    }
    cumulative += lengths[i];
  }
  throw new Error("Invalid traffic progress");
}
export type DirectedLaneEdge = {
  id: string;
  from: Point;
  to: Point;
  heading: number;
  lanes: number[];
};
/** Split at crossings and merge duplicate physical edges: route IDs are not occupancy. */
export const DIRECTED_LANE_GRAPH: DirectedLaneEdge[] = [];
for (const edge of edges) {
  const dx = edge.b.x - edge.a.x,
    dy = edge.b.y - edge.a.y,
    len = Math.hypot(dx, dy);
  const t = (p: Point) => ((p.x - edge.a.x) * dx + (p.y - edge.a.y) * dy) / (len * len);
  const points = [
    edge.a,
    ...JUNCTIONS.filter(
      (p) =>
        t(p) > 0 && t(p) < 1 && Math.abs((p.x - edge.a.x) * dy - (p.y - edge.a.y) * dx) < 0.001,
    ),
    edge.b,
  ].sort((a, b) => t(a) - t(b));
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1],
      to = points[i],
      id = `${from.x},${from.y}>${to.x},${to.y}`;
    const existing = DIRECTED_LANE_GRAPH.find((e) => e.id === id);
    if (existing) {
      if (!existing.lanes.includes(edge.lane)) existing.lanes.push(edge.lane);
    } else
      DIRECTED_LANE_GRAPH.push({
        id,
        from: { x: from.x, y: from.y },
        to: { x: to.x, y: to.y },
        heading: canonicalHeading(Math.atan2(dy, dx)),
        lanes: [edge.lane],
      });
  }
}
