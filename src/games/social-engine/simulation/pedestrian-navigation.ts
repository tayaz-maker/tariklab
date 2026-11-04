import type { Point } from "../domain/types.ts";
import { isWalkable, ROAD_CENTERS } from "../domain/world.ts";

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
export function pedestrianSegment(a: Point, b: Point, obstacles: readonly Point[] = []): boolean {
  const steps = Math.max(1, Math.ceil(Math.hypot(a.x - b.x, a.y - b.y) / 0.15));
  for (let i = 0; i <= steps; i++) {
    const p = { x: a.x + ((b.x - a.x) * i) / steps, y: a.y + ((b.y - a.y) * i) / steps };
    if (
      !pedestrianWalkable(p) ||
      obstacles.some((body) => Math.hypot(body.x - p.x, body.y - p.y) < 0.95)
    )
      return false;
  }
  return true;
}
const cache = new Map<string, Point[]>();
/** Four-way half-metre A*: no diagonal corner clipping and no diagonal road crossings. */
export function pedestrianPath(from: Point, to: Point, obstacles: readonly Point[] = []): Point[] {
  const walkable = (p: Point) =>
    pedestrianWalkable(p) &&
    obstacles.every((body) => Math.hypot(body.x - p.x, body.y - p.y) >= 0.95);
  const segment = (a: Point, b: Point) => pedestrianSegment(a, b, obstacles);
  if (!walkable(to) || !isWalkable(from)) return [];
  if (segment(from, to)) return [{ ...to }];
  const size = 129,
    encode = (p: Point) => Math.round(p.y * 2) * size + Math.round(p.x * 2),
    point = (id: number) => ({ x: (id % size) / 2, y: Math.floor(id / size) / 2 }),
    start = encode(from),
    goal = encode(to),
    key = `${start}:${goal}:${obstacles
      .map((p) => `${p.x},${p.y}`)
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
      if (
        !Array.from({ length: steps + 1 }, (_, i) =>
          isWalkable({
            x: from.x + ((p.x - from.x) * i) / steps,
            y: from.y + ((p.y - from.y) * i) / steps,
          }),
        ).every(Boolean)
      )
        continue;
      const rest = pedestrianPath(p, to, obstacles);
      if (rest.length) return [p, ...rest];
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
