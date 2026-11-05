import { SPAWN } from "./world.ts";
import type { Point } from "./types.ts";
import { canonicalHeading, type TrafficPose } from "./traffic.ts";

export const BREAK_PARKING_ID = "park-driver-coast";
export const WEST_OVERFLOW_PARKING_ID = "park-driver-west-south";
export const BREAK_BAY = { x: 37, y: 55.2 };
export const BREAK_DOOR = { x: 37, y: 56.5 };
export type BreakBayId = "coast" | "east" | "west" | "westSouth" | "starter";
export type DriverBreakPhase =
  | "driving"
  | "seeking"
  | "toBay"
  | "walkToMarket"
  | "queue"
  | "walkBack"
  | "awaitReturn"
  | "fromBay"
  | "cancelled"
  | "disabled"
  | "routine";
export type DriverBreak = {
  bayId: BreakBayId;
  personId: string;
  vehicleId: string;
  phase: DriverBreakPhase;
  originalLane: number;
  workRelease: boolean;
  lastProgressAt: number;
  lastPosition: Point & { scene: string };
  recoveryAttempts: number;
  recoveryFor: string | null;
  disabledPhase?: "toBay" | "fromBay";
  suspendedOutcome?: DriverBreak["outcome"];
  resumeMark?: number;
  cruiseSpeed: number;
  routeProgress: number;
  requestedAt: number;
  expiresAt: number;
  cooldownUntil: number;
  lastMealTick: number | null;
  mealJoinedTick: number | null;
  outcome: "none" | "fed" | "unaffordable" | "unavailable" | "cancelled";
};

export type BreakBay = {
  id: BreakBayId;
  parkingId: string;
  name: string;
  point: Point;
  door: Point;
  ingress: Point;
  egress: Point;
  vertical: boolean;
  lanes: number[];
};
export const DRIVER_BAYS: BreakBay[] = [
  {
    id: "coast",
    parkingId: BREAK_PARKING_ID,
    name: "Sahil sürücü cebi",
    point: BREAK_BAY,
    door: BREAK_DOOR,
    ingress: { x: 31, y: 53 },
    egress: { x: 43, y: 53 },
    vertical: false,
    lanes: [0, 1, 2, 3],
  },
  {
    id: "east",
    parkingId: "park-driver-east",
    name: "Doğu sürücü cebi",
    point: { x: 46.6, y: 20.5 },
    door: { x: 47.85, y: 20.5 },
    ingress: { x: 44, y: 24.5 },
    egress: { x: 44, y: 19.8 },
    vertical: true,
    lanes: [1, 3],
  },
  {
    id: "west",
    parkingId: "park-driver-west",
    name: "Batı sürücü cebi",
    point: { x: 15.2, y: 21 },
    door: { x: 13.95, y: 21 },
    ingress: { x: 17, y: 27 },
    egress: { x: 17, y: 17.8 },
    vertical: true,
    lanes: [0, 2],
  },
  {
    id: "westSouth",
    parkingId: WEST_OVERFLOW_PARKING_ID,
    name: "Güneybatı sürücü cebi",
    point: { x: 15.2, y: 31.2 },
    door: { x: 13.95, y: 31.2 },
    ingress: { x: 17, y: 36.5 },
    egress: { x: 17, y: 27.5 },
    vertical: true,
    lanes: [0, 2],
  },
];
export const STARTER_BAY: BreakBay = {
  id: "starter",
  parkingId: "park-starter",
  name: "Başlangıç aracı cebi",
  point: { x: 19.6, y: 14.1 },
  door: SPAWN,
  ingress: { x: 17.9, y: 17 },
  egress: { x: 26.2, y: 17 },
  vertical: false,
  lanes: [0],
};
export const ALL_BREAK_BAYS = [...DRIVER_BAYS, STARTER_BAY];
export function getBreakBay(id: BreakBayId): BreakBay {
  const bay = ALL_BREAK_BAYS.find((b) => b.id === id);
  if (!bay) throw Error("Unknown driver bay");
  return bay;
}
type Route = {
  points: Point[];
  distances: number[];
  length: number;
  connectorLength: number;
  connectorPoses: Array<Point & { heading: number }>;
};
const q = (n: number) => Math.round(n * 1000) / 1000;
/** Authored manoeuvres, sampled once into millimetre geometry. Saved progress is
 * physical distance. Each curve has exact lane tangents and an oriented bay. */
function route(corners: Point[], enter: boolean, bay: BreakBay): Route {
  const points: Point[] = [];
  const append = (p: Point) => {
    const next = { x: q(p.x), y: q(p.y) };
    if (!points.length || next.x !== points.at(-1)!.x || next.y !== points.at(-1)!.y)
      points.push(next);
  };
  append(corners[0]);
  for (let i = 1; i < corners.length - 1; i++) {
    const a = corners[i - 1],
      b = corners[i],
      c = corners[i + 1];
    const before = Math.hypot(b.x - a.x, b.y - a.y),
      after = Math.hypot(c.x - b.x, c.y - b.y);
    const r = Math.min(0.8, before / 3, after / 3);
    const start = { x: b.x - ((b.x - a.x) * r) / before, y: b.y - ((b.y - a.y) * r) / before },
      end = { x: b.x + ((c.x - b.x) * r) / after, y: b.y + ((c.y - b.y) * r) / after };
    append(start);
    for (let sample = 1; sample <= 40; sample++) {
      const t = sample / 40;
      append({
        x: (1 - t) ** 2 * start.x + 2 * (1 - t) * t * b.x + t * t * end.x,
        y: (1 - t) ** 2 * start.y + 2 * (1 - t) * t * b.y + t * t * end.y,
      });
    }
  }
  append(corners.at(-1)!);
  const a = enter ? bay.ingress : bay.point,
    b = enter ? bay.point : bay.egress,
    curve: Point[] = [];
  for (let sample = enter ? 1 : 0; sample <= 160; sample++) {
    const t = sample / 160,
      s = t * t * (3 - 2 * t);
    curve.push({
      x: q(a.x + (b.x - a.x) * (bay.vertical ? s : t)),
      y: q(a.y + (b.y - a.y) * (bay.vertical ? t : s)),
    });
  }
  if (enter) for (const p of curve) append(p);
  else points.unshift(...curve.slice(0, -1));
  const distances = [0];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    distances.push(q(total));
  }
  return {
    points,
    distances,
    length: distances.at(-1)!,
    connectorLength: enter ? distances.at(-1)! : distances[Math.min(160, distances.length - 1)],
    connectorPoses: points.slice(0, 161).map((p, i) => {
      const a = points[Math.max(0, i - 1)],
        b = points[i === 0 ? 1 : i];
      return { ...p, heading: canonicalHeading(Math.atan2(b.y - a.y, b.x - a.x)) };
    }),
  };
}
export const BREAK_ENTRIES = [
  { lane: 0, progress: 79.5, point: { x: 21.5, y: 51 } },
  { lane: 1, progress: 12, point: { x: 31, y: 53 } },
  { lane: 2, progress: 61.5, point: { x: 21.5, y: 51 } },
  { lane: 3, progress: 83, point: { x: 19, y: 34 } },
];
const entries: Record<
  BreakBayId,
  Partial<Record<number, { lane: number; progress: number; point: Point }>>
> = {
  coast: Object.fromEntries(BREAK_ENTRIES.map((e) => [e.lane, e])),
  starter: { 0: { lane: 0, progress: 0.9, point: STARTER_BAY.ingress } },
  east: {
    1: { lane: 1, progress: 53.5, point: { x: 44, y: 24.5 } },
    3: { lane: 3, progress: 37.5, point: { x: 44, y: 24.5 } },
  },
  west: {
    0: { lane: 0, progress: 108, point: { x: 17, y: 27 } },
    2: { lane: 2, progress: 78, point: { x: 17, y: 39 } },
  },
  westSouth: {
    0: { lane: 0, progress: 98.5, point: { x: 17, y: 36.5 } },
    2: { lane: 2, progress: 80.5, point: { x: 17, y: 36.5 } },
  },
};
const returns: Record<BreakBayId, Partial<Record<number, { lane: number; progress: number }>>> = {
  coast: {
    0: { lane: 0, progress: 61 },
    1: { lane: 1, progress: 24 },
    2: { lane: 2, progress: 43 },
    3: { lane: 3, progress: 27 },
  },
  east: { 1: { lane: 1, progress: 58.2 }, 3: { lane: 3, progress: 42.2 } },
  starter: { 0: { lane: 0, progress: 9.2 } },
  west: { 0: { lane: 0, progress: 117.2 }, 2: { lane: 2, progress: 4 } },
  westSouth: { 0: { lane: 0, progress: 107.5 }, 2: { lane: 2, progress: 4 } },
};
const routes: Record<
  BreakBayId,
  { toBay: Partial<Record<number, Route>>; fromBay: Partial<Record<number, Route>> }
> = {
  coast: { toBay: {}, fromBay: {} },
  east: { toBay: {}, fromBay: {} },
  west: { toBay: {}, fromBay: {} },
  westSouth: { toBay: {}, fromBay: {} },
  starter: { toBay: {}, fromBay: {} },
};
for (const bay of ALL_BREAK_BAYS)
  for (const lane of bay.lanes) {
    let enter: Point[], exit: Point[];
    if (bay.id === "coast") {
      enter =
        lane === 0 || lane === 2
          ? [{ x: 21.5, y: 51 }, { x: 19, y: 51 }, { x: 19, y: 53 }, bay.ingress]
          : lane === 1
            ? [bay.ingress]
            : [{ x: 19, y: 34 }, { x: 19, y: 53 }, bay.ingress];
      exit =
        lane === 0 || lane === 2
          ? [bay.egress, { x: 44, y: 53 }, { x: 44, y: 51 }, { x: 40, y: 51 }]
          : lane === 1
            ? [bay.egress]
            : [bay.egress, { x: 44, y: 53 }, { x: 44, y: 35 }];
    } else if (bay.id === "east" || bay.id === "starter") {
      enter = [bay.ingress];
      exit = [bay.egress];
    } else {
      enter =
        lane === 0 || bay.id === "westSouth" ? [bay.ingress] : [{ x: 17, y: 39 }, bay.ingress];
      exit =
        lane === 0
          ? [bay.egress]
          : [bay.egress, { x: 17, y: 17 }, { x: 19, y: 17 }, { x: 19, y: 35 }, { x: 21, y: 35 }];
    }
    routes[bay.id].toBay[lane] = route(enter, true, bay);
    routes[bay.id].fromBay[lane] = route(exit, false, bay);
  }
export function breakEntry(lane: number, bayId: BreakBayId = "coast") {
  const value = entries[bayId][lane];
  if (!value) throw Error("Bay is unreachable from loop");
  return value;
}
export function breakReturn(lane: number, bayId: BreakBayId = "coast") {
  const value = returns[bayId][lane];
  if (!value) throw Error("Bay cannot return to loop");
  return value;
}
export function breakRoute(
  phase: "toBay" | "fromBay",
  lane: number,
  bayId: BreakBayId = "coast",
): Route {
  const value = routes[bayId]?.[phase][lane];
  if (!value) throw Error("Invalid driver bay route");
  return value;
}
export function breakRoutePose(
  phase: "toBay" | "fromBay",
  lane: number,
  progress: number,
  bayId: BreakBayId = "coast",
): TrafficPose {
  const r = breakRoute(phase, lane, bayId),
    d = Math.max(0, Math.min(r.length, progress));
  let i = 1;
  while (i < r.distances.length - 1 && r.distances[i] < d) i++;
  const a = r.points[i - 1],
    b = r.points[i],
    length = r.distances[i] - r.distances[i - 1],
    t = length ? (d - r.distances[i - 1]) / length : 0,
    norm = Math.hypot(b.x - a.x, b.y - a.y);
  return {
    x: q(a.x + (b.x - a.x) * t),
    y: q(a.y + (b.y - a.y) * t),
    heading: canonicalHeading(Math.atan2(b.y - a.y, b.x - a.x)),
    tangent: { x: (b.x - a.x) / norm, y: (b.y - a.y) / norm },
    turning: true,
  };
}
