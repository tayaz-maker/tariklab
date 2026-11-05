import type { Building, Point } from "./types";

/** Original DARAMCIK map. All coordinates are metres; y=57 is the sea wall. */
export const WORLD_SIZE = 64;
export const LAND_HEIGHT = 57;
export const COLLIDER_RADIUS = 0.28;
export const INTERIOR_SPAWN: Point = { x: 7, y: 9 };
export const INTERIOR_EXIT: Point = { x: 7, y: 10 };
export const BUILDINGS: Building[] = [
  {
    id: "b-home",
    name: "Yuva Apartmanı",
    kind: "home",
    x: 4,
    y: 3,
    w: 5,
    h: 10,
    height: 8,
    color: 0xdfb98c,
    door: { x: 6.5, y: 13.7 },
    sign: "YUVA",
  },
  {
    id: "b-restaurant",
    name: "Sahil Sofrası",
    kind: "restaurant",
    x: 10,
    y: 5,
    w: 5,
    h: 8,
    height: 4,
    color: 0xce8f6b,
    door: { x: 12.5, y: 13.7 },
    sign: "SAHİL SOFRASI",
  },
  {
    id: "b-market",
    name: "Bereket Market",
    kind: "market",
    x: 23,
    y: 6,
    w: 8,
    h: 8,
    height: 5,
    color: 0xeac585,
    door: { x: 27, y: 14.7 },
    sign: "BEREKET",
  },
  {
    id: "b-clinic",
    name: "DARAMCIK Kliniği",
    kind: "clinic",
    x: 33,
    y: 4,
    w: 6,
    h: 10,
    height: 5,
    color: 0xe2ded0,
    door: { x: 36, y: 14.7 },
    sign: "SAĞLIK",
  },
  {
    id: "b-garage",
    name: "Usta İşi Tamirhane",
    kind: "garage",
    x: 47,
    y: 5,
    w: 12,
    h: 8,
    height: 4,
    color: 0xb0b9b2,
    door: { x: 53, y: 13.7 },
    sign: "USTA İŞİ",
  },
  {
    id: "b-cafe",
    name: "Çınar Çayevi",
    kind: "cafe",
    x: 4,
    y: 23,
    w: 9,
    h: 8,
    height: 5,
    color: 0xc48b75,
    door: { x: 8.5, y: 31.7 },
    sign: "ÇINAR ÇAYEVİ",
  },
  {
    id: "b-office",
    name: "Kıyı Kooperatifi",
    kind: "office",
    x: 23,
    y: 23,
    w: 7,
    h: 8,
    height: 8,
    color: 0xd6c5a9,
    door: { x: 26.5, y: 31.7 },
    sign: "KIYI KOOPERATİFİ",
  },
  {
    id: "b-security",
    name: "Mahalle Dayanışma",
    kind: "security",
    x: 33,
    y: 24,
    w: 6,
    h: 7,
    height: 4,
    color: 0xbabda0,
    door: { x: 36, y: 31.7 },
    sign: "DAYANIŞMA",
  },
  {
    id: "b-warehouse",
    name: "Liman Deposu",
    kind: "warehouse",
    x: 47,
    y: 23,
    w: 12,
    h: 9,
    height: 4,
    color: 0xbda68b,
    door: { x: 53, y: 32.7 },
    sign: "LİMAN DEPOSU",
  },
  {
    id: "b-school",
    name: "Ufuk Akademi",
    kind: "school",
    x: 4,
    y: 40,
    w: 10,
    h: 9,
    height: 6,
    color: 0xd7b77e,
    door: { x: 9, y: 49.7 },
    sign: "UFUK AKADEMİ",
  },
  {
    id: "b-sales",
    name: "Sahil Tasarım",
    kind: "sales",
    x: 23,
    y: 40,
    w: 7,
    h: 9,
    height: 5,
    color: 0xc99884,
    door: { x: 26.5, y: 49.7 },
    sign: "SAHİL TASARIM",
  },
  {
    id: "b-bank",
    name: "Kıyı Finans",
    kind: "bank",
    x: 33,
    y: 40,
    w: 6,
    h: 9,
    height: 5,
    color: 0xd8d1ba,
    door: { x: 36, y: 49.7 },
    sign: "KIYI FİNANS",
  },
  {
    id: "b-taxi",
    name: "Martı Taksi",
    kind: "taxi",
    x: 47,
    y: 40,
    w: 6,
    h: 9,
    height: 4,
    color: 0xd9b759,
    door: { x: 50, y: 49.7 },
    sign: "MARTI TAKSİ",
  },
  {
    id: "b-police",
    name: "DARAMCIK Karakolu",
    kind: "police",
    x: 55,
    y: 40,
    w: 6,
    h: 9,
    height: 5,
    color: 0xc3c9c4,
    door: { x: 58, y: 49.7 },
    sign: "KARAKOL",
  },
];
export const SPAWN: Point = { x: 20.35, y: 12.75 };
/** Directed lane loops. Closing segment last -> first is implicit. */
export const ROADS: Point[][] = [
  [
    { x: 17, y: 17 },
    { x: 42, y: 17 },
    { x: 42, y: 51 },
    { x: 17, y: 51 },
  ],
  [
    { x: 19, y: 53 },
    { x: 44, y: 53 },
    { x: 44, y: 19 },
    { x: 19, y: 19 },
  ],
  [
    { x: 17, y: 35 },
    { x: 42, y: 35 },
    { x: 42, y: 51 },
    { x: 17, y: 51 },
  ],
  [
    { x: 19, y: 37 },
    { x: 44, y: 37 },
    { x: 44, y: 19 },
    { x: 19, y: 19 },
  ],
];
export const ROAD_CENTERS = { vertical: [18, 43], horizontal: [18, 36, 52] };
export function isRoad(p: Point): boolean {
  return (
    p.x >= 1 &&
    p.x <= 63 &&
    p.y >= 1 &&
    p.y < 55 &&
    (ROAD_CENTERS.vertical.some((x) => Math.abs(p.x - x) <= 2) ||
      ROAD_CENTERS.horizontal.some((y) => Math.abs(p.y - y) <= 2))
  );
}
export function project(p: Point, z = 0): Point {
  return { x: (p.x - p.y) * 24, y: (p.x + p.y) * 12 - z * 24 };
}
export function unproject(p: Point): Point {
  return { x: p.x / 48 + p.y / 24, y: p.y / 24 - p.x / 48 };
}
export const toIso = project;
export const fromIso = unproject;
const validScenes = new Set(BUILDINGS.map((b) => b.id));
export function isWalkable(p: Point, scene = "outside"): boolean {
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return false;
  const r = COLLIDER_RADIUS;
  if (scene !== "outside")
    return (
      validScenes.has(scene) &&
      p.x >= 1 + r &&
      p.x <= 13 - r &&
      p.y >= 1 + r &&
      p.y <= 11 - r &&
      !(p.y < 4.8 + r && (p.x < 3.3 + r || p.x > 10 - r))
    );
  if (p.x < 1 + r || p.x > 63 - r || p.y < 1 + r || p.y > LAND_HEIGHT - r) return false;
  return !BUILDINGS.some(
    (b) => p.x > b.x - r && p.x < b.x + b.w + r && p.y > b.y - r && p.y < b.y + b.h + r,
  );
}
export function hasLineOfSight(a: Point, b: Point, scene = "outside"): boolean {
  const distance = Math.hypot(b.x - a.x, b.y - a.y),
    steps = Math.max(1, Math.ceil(distance / 0.2));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (!isWalkable({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, scene)) return false;
  }
  return true;
}
export function moveWithCollision(from: Point, delta: Point, scene = "outside"): Point {
  if (!Number.isFinite(delta.x) || !Number.isFinite(delta.y) || !isWalkable(from, scene))
    return { ...from };
  const steps = Math.min(4096, Math.max(1, Math.ceil(Math.hypot(delta.x, delta.y) / 0.16)));
  let p = { ...from };
  const dx = delta.x / steps,
    dy = delta.y / steps;
  for (let i = 0; i < steps; i++) {
    const next = { x: p.x + dx, y: p.y + dy };
    if (isWalkable(next, scene)) p = next;
    else {
      const px = { x: p.x + dx, y: p.y };
      if (isWalkable(px, scene)) p = px;
      const py = { x: p.x, y: p.y + dy };
      if (isWalkable(py, scene)) p = py;
    }
  }
  return { x: Math.round(p.x * 1e6) / 1e6, y: Math.round(p.y * 1e6) / 1e6 };
}
const cache = new Map<string, Point[]>();
/** Deterministic A* over a half-metre grid; diagonal corner cutting is forbidden. */
export function findPath(from: Point, to: Point, scene = "outside"): Point[] {
  if (!isWalkable(from, scene) || !isWalkable(to, scene)) return [];
  if (hasLineOfSight(from, to, scene)) return [{ ...to }];
  const sx = Math.round(from.x * 2),
    sy = Math.round(from.y * 2),
    tx = Math.round(to.x * 2),
    ty = Math.round(to.y * 2);
  const key = `${scene}:${sx},${sy}:${tx},${ty}`;
  const hit = cache.get(key);
  if (hit && hasLineOfSight(from, hit[0], scene) && hasLineOfSight(hit[hit.length - 1], to, scene))
    return [...hit.map((p) => ({ ...p })), { ...to }];
  const size = 129,
    start = sy * size + sx,
    goal = ty * size + tx;
  const g = new Map<number, number>([[start, 0]]),
    parent = new Map<number, number>();
  const closed = new Set<number>();
  const heap: { id: number; f: number }[] = [];
  const push = (item: { id: number; f: number }) => {
    heap.push(item);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p].f < item.f || (heap[p].f === item.f && heap[p].id < item.id)) break;
      heap[i] = heap[p];
      i = p;
    }
    heap[i] = item;
  };
  const pop = () => {
    const first = heap[0],
      last = heap.pop()!;
    if (heap.length) {
      let i = 0;
      heap[0] = last;
      while (true) {
        let j = i * 2 + 1;
        if (j >= heap.length) break;
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
    return first;
  };
  push({ id: start, f: Math.abs(tx - sx) + Math.abs(ty - sy) });
  const dirs = [
    [0, -1],
    [-1, 0],
    [1, 0],
    [0, 1],
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ];
  while (heap.length && closed.size < 17000) {
    const cur = pop();
    if (closed.has(cur.id)) continue;
    closed.add(cur.id);
    if (cur.id === goal) {
      const path: Point[] = [];
      let id = goal;
      while (id !== start) {
        path.unshift({ x: (id % size) / 2, y: Math.floor(id / size) / 2 });
        id = parent.get(id)!;
      }
      if (
        !path.length ||
        !hasLineOfSight(from, path[0], scene) ||
        !hasLineOfSight(path[path.length - 1], to, scene)
      )
        return [];
      const smooth: Point[] = [];
      let anchor = from;
      for (let i = 0; i < path.length;) {
        let j = i;
        while (j + 1 < path.length && hasLineOfSight(anchor, path[j + 1], scene)) j++;
        smooth.push(path[j]);
        anchor = path[j];
        i = j + 1;
      }
      if (cache.size > 256) cache.delete(cache.keys().next().value!);
      cache.set(key, smooth);
      return [...smooth, { ...to }];
    }
    const x = cur.id % size,
      y = Math.floor(cur.id / size);
    for (const [dx, dy] of dirs) {
      const nx = x + dx,
        ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      const id = ny * size + nx;
      if (closed.has(id) || !isWalkable({ x: nx / 2, y: ny / 2 }, scene)) continue;
      if (
        dx &&
        dy &&
        (!isWalkable({ x: (x + dx) / 2, y: y / 2 }, scene) ||
          !isWalkable({ x: x / 2, y: (y + dy) / 2 }, scene))
      )
        continue;
      const cost = g.get(cur.id)! + (dx && dy ? 14 : 10);
      if (cost >= (g.get(id) ?? Infinity)) continue;
      g.set(id, cost);
      parent.set(id, cur.id);
      push({ id, f: cost + 10 * Math.max(Math.abs(tx - nx), Math.abs(ty - ny)) });
    }
  }
  return [];
}
export function laneLength(lane: number): number {
  const points = ROADS[lane];
  if (!points) return 0;
  return points.reduce(
    (sum, p, i) =>
      sum +
      Math.hypot(points[(i + 1) % points.length].x - p.x, points[(i + 1) % points.length].y - p.y),
    0,
  );
}
export function pointOnLane(lane: number, distance: number): Point & { heading: number } {
  const points = ROADS[lane] ?? ROADS[0],
    len = laneLength(lane) || laneLength(0);
  let d = ((distance % len) + len) % len;
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length],
      seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (d <= seg)
      return {
        x: a.x + ((b.x - a.x) * d) / seg,
        y: a.y + ((b.y - a.y) * d) / seg,
        heading: Math.atan2(b.y - a.y, b.x - a.x),
      };
    d -= seg;
  }
  return { ...points[0], heading: 0 };
}
