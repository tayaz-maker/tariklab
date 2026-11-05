import { personVehicleSeparation } from "./vehicle-collision.ts";
import type { Point } from "../domain/types.ts";
import { isRoad, isWalkable, ROAD_CENTERS } from "../domain/world.ts";

type Obstacle = Point & { heading?: number };
const obstacleClearance = (p: Point, body: Obstacle) =>
  body.heading === undefined
    ? Math.hypot(body.x - p.x, body.y - p.y) - 0.95
    : personVehicleSeparation(p, { ...body, heading: body.heading });
const blocked = (p: Point, body: Obstacle) => obstacleClearance(p, body) < -0.00001;

/** Physical crossings are fixed world geometry, shared by routing and yielding.
 * Roads use metres; neither atlas directions nor screen coordinates enter navigation. */
export const CROSSINGS = { x: [10, 27, 36, 53, 58], y: [15.5, 33.5, 50.5, 54.5] };
export function pedestrianWalkable(p: Point): boolean {
  if (!isWalkable(p)) return false;
  const vertical = ROAD_CENTERS.vertical.some((x) => Math.abs(p.x - x) <= 2);
  const horizontal = ROAD_CENTERS.horizontal.some((y) => Math.abs(p.y - y) <= 2);
  return (
    (!vertical || CROSSINGS.y.some((y) => Math.abs(p.y - y) <= 0.65)) &&
    (!horizontal || CROSSINGS.x.some((x) => Math.abs(p.x - x) <= 0.65))
  );
}
export function pedestrianSegment(
  a: Point,
  b: Point,
  obstacles: readonly Obstacle[] = [],
  spacing: 0.15 | 0.02 = 0.15,
): boolean {
  const steps = Math.max(1, Math.ceil(Math.hypot(a.x - b.x, a.y - b.y) / spacing));
  for (let i = 0; i <= steps; i++) {
    const p = { x: a.x + ((b.x - a.x) * i) / steps, y: a.y + ((b.y - a.y) * i) / steps };
    if (!pedestrianWalkable(p) || obstacles.some((body) => blocked(p, body))) return false;
  }
  return true;
}
function clearOfPeople(from: Point, to: Point, people: readonly Point[]): boolean {
  const dx = to.x - from.x,
    dy = to.y - from.y,
    length = dx * dx + dy * dy;
  if (length <= 0) return false;
  return !people.some((other) => {
    const t = Math.min(
      1,
      Math.max(0, ((other.x - from.x) * dx + (other.y - from.y) * dy) / length),
    );
    return Math.hypot(from.x + t * dx - other.x, from.y + t * dy - other.y) < 0.5;
  });
}

/** A curb-side walker with no route can make room for someone already
 * inside the crossing. The peer has priority to leave the live road. */
export function pedestrianCurbReliefPoint(
  from: Point,
  bodies: readonly Obstacle[],
  people: readonly Point[],
): Point | null {
  if (isRoad(from) || !pedestrianWalkable(from)) return null;
  for (const across of ["y", "x"] as const) {
    const along = across === "y" ? "x" : "y";
    const roads = across === "y" ? ROAD_CENTERS.horizontal : ROAD_CENTERS.vertical;
    for (const road of roads) {
      const fromSide = from[across] - road;
      if (Math.abs(fromSide) <= 2 || Math.abs(fromSide) > 2.45) continue;
      for (const mark of CROSSINGS[along]) {
        if (Math.abs(from[along] - mark) > 0.7) continue;
        const peer = people.find((other) => {
          const otherSide = other[across] - road;
          return (
            otherSide * fromSide > 0 &&
            Math.abs(otherSide) <= 2 &&
            Math.abs(other[along] - mark) <= 0.65 &&
            Math.hypot(other.x - from.x, other.y - from.y) <= 0.8
          );
        });
        if (!peer) continue;
        for (const radius of [0.5, 0.65, 0.8])
          for (let sample = 0; sample < 32; sample++) {
            const angle = (sample * Math.PI) / 16;
            const to = {
              x: Math.round((from.x + radius * Math.cos(angle)) * 1e6) / 1e6,
              y: Math.round((from.y + radius * Math.sin(angle)) * 1e6) / 1e6,
            };
            if (
              isRoad(to) ||
              Math.abs(to[across] - road) < Math.abs(fromSide) - 0.0001 ||
              Math.hypot(to.x - peer.x, to.y - peer.y) < 0.92 ||
              !pedestrianSegment(from, to, bodies) ||
              !clearOfPeople(from, to, people)
            )
              continue;
            return to;
          }
      }
    }
  }
  return null;
}

/** A blocked destination must not hold a moving vehicle's clearance envelope.
 * Find a legal short pavement step and retain the original destination. */
export function pedestrianYieldPoint(
  from: Point,
  pressure: readonly Obstacle[],
  bodies: readonly Obstacle[],
  people: readonly Point[],
  spacing: 0.15 | 0.02 = 0.15,
): Point | null {
  if (!pedestrianWalkable(from)) return null;
  const fromRoad = isRoad(from);
  const clearance = (point: Point) =>
    Math.min(...pressure.map((car) => obstacleClearance(point, car)));
  const startClearance = clearance(from);
  if (startClearance >= (fromRoad ? 1.25 : 0.45)) return null;
  const points: Point[] = [];
  for (let dx = -3; dx <= 3; dx++)
    for (let dy = -3; dy <= 3; dy++) {
      const p = { x: Math.round(from.x * 2) / 2 + dx / 2, y: Math.round(from.y * 2) / 2 + dy / 2 };
      const distance = Math.hypot(p.x - from.x, p.y - from.y);
      if (
        distance < 0.05 ||
        distance > 1.65 ||
        isRoad(p) ||
        !pedestrianWalkable(p) ||
        pressure.some((car) => obstacleClearance(p, car) < 0.55) ||
        people.some((other) => Math.hypot(p.x - other.x, p.y - other.y) < 0.55) ||
        !pedestrianSegment(from, p, bodies, spacing)
      )
        continue;
      points.push(p);
    }
  points.sort(
    (a, b) =>
      Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y) ||
      a.x - b.x ||
      a.y - b.y,
  );
  if (points.length) return points[0];
  // At a nearly touching vehicle, a dense crowd can leave only a narrow
  // diagonal exit between half-metre grid points. Test the whole person-to-
  // person segment, and keep the ordinary per-step body checks during motion.
  if (!fromRoad && startClearance >= 0.06) return null;
  // A pedestrian already inside a marked crossing can be farther from both
  // curbs than one safe step. Keep the walkable crossing, progress toward its
  // edge, and never admit a new road entry as an escape.
  const depth = (p: Point) =>
    Math.max(
      0,
      ...ROAD_CENTERS.horizontal.map((y) => 2 - Math.abs(p.y - y)),
      ...ROAD_CENTERS.vertical.map((x) => 2 - Math.abs(p.x - x)),
    );
  const startDepth = fromRoad ? depth(from) : 0;
  let intermediate: { point: Point; depth: number } | undefined;
  const neighbours = people.filter((p) => Math.hypot(p.x - from.x, p.y - from.y) < 2.2);
  const radii = [0.4, 0.55, 0.7, 0.9, 1.1, 1.35, 1.6];
  if (fromRoad) radii.unshift(0.15, 0.25);
  for (const radius of radii)
    for (let sample = 0; sample < 64; sample++) {
      const angle = (sample * Math.PI) / 32;
      const p = {
        x: Math.round((from.x + radius * Math.cos(angle)) * 1e6) / 1e6,
        y: Math.round((from.y + radius * Math.sin(angle)) * 1e6) / 1e6,
      };
      const onRoad = isRoad(p);
      const nextDepth = onRoad ? depth(p) : 0;
      if (
        (onRoad &&
          (!fromRoad ||
            nextDepth > startDepth - 0.12 ||
            (intermediate && nextDepth >= intermediate.depth))) ||
        !pedestrianWalkable(p) ||
        clearance(p) < (onRoad ? Math.min(0.45, startClearance + 0.04) : 0.22) ||
        !pedestrianSegment(from, p, bodies, spacing)
      )
        continue;
      if (!clearOfPeople(from, p, neighbours)) continue;
      if (!onRoad) return p;
      intermediate = { point: p, depth: nextDepth };
    }
  return intermediate?.point ?? null;
}
const cache = new Map<string, Point[]>();
/** Four-way half-metre A*: no diagonal corner clipping and no diagonal road crossings. */
export function pedestrianPath(
  from: Point,
  to: Point,
  obstacles: readonly Obstacle[] = [],
): Point[] {
  const walkable = (p: Point) =>
    pedestrianWalkable(p) && obstacles.every((body) => !blocked(p, body));
  const segment = (a: Point, b: Point) => pedestrianSegment(a, b, obstacles);
  if (!walkable(to) || !isWalkable(from)) return [];
  if (segment(from, to)) return [{ ...to }];
  const size = 129,
    encode = (p: Point) => Math.round(p.y * 2) * size + Math.round(p.x * 2),
    point = (id: number) => ({ x: (id % size) / 2, y: Math.floor(id / size) / 2 }),
    start = encode(from),
    goal = encode(to),
    key = `${start}:${goal}:${obstacles
      .map((p) => `${p.x},${p.y},${p.heading ?? "point"}`)
      .sort()
      .join(";")}`;
  const finish = (cached: Point[]): Point[] => {
    // A rounded start is a connector, not the actor's exact position. Keep that
    // connector when it avoids a road/building corner on the first grid edge.
    const raw = cached.length > 1 && !segment(from, cached[0]) ? cached.slice(1) : cached;
    if (!raw.length || !segment(from, raw[0]) || !segment(raw[raw.length - 1], to)) return [];
    const points = [...raw, { ...to }],
      result: Point[] = [];
    let anchor = from;
    for (let i = 0; i < points.length;) {
      let j = i;
      while (j + 1 < points.length && segment(anchor, points[j + 1])) j++;
      result.push(points[j]);
      anchor = points[j];
      i = j + 1;
    }
    return result.map((p) => ({ ...p }));
  };
  // Legacy actors may be standing on a road. Permit only their short first link
  // to the nearest safe pavement, never a fresh arbitrary road shortcut.
  if (!walkable(from)) {
    const candidates: Point[] = [];
    for (let dx = -5; dx <= 5; dx++)
      for (let dy = -5; dy <= 5; dy++) {
        const p = {
          x: Math.round(from.x * 2) / 2 + dx / 2,
          y: Math.round(from.y * 2) / 2 + dy / 2,
        };
        if (walkable(p)) candidates.push(p);
      }
    candidates.sort(
      (a, b) => Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y),
    );
    for (const p of candidates) {
      const d = Math.hypot(p.x - from.x, p.y - from.y),
        steps = Math.ceil(d / 0.1);
      let clear = true,
        previous = obstacles.map((body) => obstacleClearance(from, body));
      for (let i = 1; i <= steps; i++) {
        const sample = {
          x: from.x + ((p.x - from.x) * i) / steps,
          y: from.y + ((p.y - from.y) * i) / steps,
        };
        if (!isWalkable(sample)) {
          clear = false;
          break;
        }
        const next = obstacles.map((body) => obstacleClearance(sample, body));
        if (next.some((distance, j) => distance < -0.00001 && distance <= previous[j] + 0.000001)) {
          clear = false;
          break;
        }
        previous = next;
      }
      if (!clear) continue;
      const rest = pedestrianPath(p, to, obstacles);
      if (rest.length) return [p, ...rest];
    }
    return [];
  }
  // An exact position can be on a valid pavement corner while the rounded
  // grid cell lies on both road boundaries. Link through a legal neighbouring
  // anchor instead of making the four-way search start inside a sealed cell.
  if (!walkable(point(start)) || !walkable(point(goal))) {
    const links = (p: Point) => {
      const candidates: Point[] = [];
      for (let dx = -2; dx <= 2; dx++)
        for (let dy = -2; dy <= 2; dy++) {
          const candidate = {
            x: Math.round(p.x * 2) / 2 + dx / 2,
            y: Math.round(p.y * 2) / 2 + dy / 2,
          };
          if (walkable(candidate) && segment(p, candidate)) candidates.push(candidate);
        }
      return candidates.sort(
        (a, b) =>
          Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y) ||
          a.x - b.x ||
          a.y - b.y,
      );
    };
    const starts = walkable(point(start)) ? [from] : links(from),
      goals = walkable(point(goal)) ? [to] : links(to);
    for (const a of starts)
      for (const b of goals) {
        const path = pedestrianPath(a, b, obstacles);
        if (path.length)
          return [...(a === from ? [] : [a]), ...path, ...(b === to ? [] : [{ ...to }])];
      }
    return [];
  }
  const hit = cache.get(key);
  if (hit) return finish(hit);
  const g = new Map<number, number>([[start, 0]]),
    parent = new Map<number, number>(),
    closed = new Set<number>();
  const heap: { id: number; f: number }[] = [];
  const heuristic = (id: number) =>
    Math.abs((id % size) - (goal % size)) +
    Math.abs(Math.floor(id / size) - Math.floor(goal / size));
  const push = (id: number, f: number) => {
    const value = { id, f };
    let i = heap.length;
    heap.push(value);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p].f < f || (heap[p].f === f && heap[p].id < id)) break;
      heap[i] = heap[p];
      i = p;
    }
    heap[i] = value;
  };
  const pop = () => {
    const first = heap[0],
      last = heap.pop()!;
    if (heap.length) {
      let i = 0;
      while (i * 2 + 1 < heap.length) {
        let j = i * 2 + 1;
        if (
          j + 1 < heap.length &&
          (heap[j + 1].f < heap[j].f ||
            (heap[j + 1].f === heap[j].f && heap[j + 1].id < heap[j].id))
        )
          j++;
        if (heap[j].f > last.f || (heap[j].f === last.f && heap[j].id > last.id)) break;
        heap[i] = heap[j];
        i = j;
      }
      heap[i] = last;
    }
    return first.id;
  };
  push(start, heuristic(start));
  while (heap.length) {
    const cur = pop();
    if (closed.has(cur)) continue;
    closed.add(cur);
    if (cur === goal) {
      const raw: Point[] = [];
      let id = goal;
      while (id !== start) {
        raw.unshift(point(id));
        id = parent.get(id)!;
      }
      if (walkable(point(start))) raw.unshift(point(start));
      if (cache.size >= 512) cache.delete(cache.keys().next().value!);
      // Cache only canonical grid nodes. Exact endpoints and smoothing depend on
      // the caller, so storing smoothed paths would make replay depend on cache history.
      cache.set(key, raw);
      return finish(raw);
    }
    for (const delta of [-size, -1, 1, size]) {
      const next = cur + delta;
      if (
        next < 0 ||
        next >= size * size ||
        closed.has(next) ||
        Math.abs((next % size) - (cur % size)) > 1
      )
        continue;
      if (!walkable(point(next))) continue;
      const cost = g.get(cur)! + 1;
      if (cost >= (g.get(next) ?? Infinity)) continue;
      g.set(next, cost);
      parent.set(next, cur);
      push(next, cost + heuristic(next));
    }
  }
  return [];
}
