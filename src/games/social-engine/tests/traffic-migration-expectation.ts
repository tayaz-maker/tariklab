/** Test-only oracle. Derives the permitted pose mapping directly from the pinned
 * predecessor road geometry; never calls current traffic/migration functions. */
import type { WorldState } from "../domain/types.ts";
import { ROADS } from "../persistence/historical/candidate5/domain/world.ts";
const round = (n: number) => Math.round(n * 1000) / 1000;
export function expectedTrafficMigration(source: WorldState): WorldState {
  const expected = structuredClone(source);
  const parked = new Set(source.mobility.parking.flatMap((lot) => lot.vehicleIds));
  for (const car of expected.vehicles) {
    const road = ROADS[car.lane];
    if (
      parked.has(car.id) ||
      !Number.isInteger(car.lane) ||
      !road ||
      !Number.isFinite(car.progress) ||
      car.progress < 0 ||
      car.progress >= Number.MAX_SAFE_INTEGER
    )
      continue;
    const lengths = road.map((p, i) =>
      Math.hypot(road[(i + 1) % road.length].x - p.x, road[(i + 1) % road.length].y - p.y),
    );
    const perimeter = lengths.reduce((a, b) => a + b, 0);
    let legacyDistance = ((car.progress % perimeter) + perimeter) % perimeter;
    let legacy = { ...road[0] };
    for (let i = 0; i < road.length; i++) {
      if (legacyDistance <= lengths[i]) {
        const a = road[i],
          b = road[(i + 1) % road.length];
        legacy = {
          x: a.x + ((b.x - a.x) * legacyDistance) / lengths[i],
          y: a.y + ((b.y - a.y) * legacyDistance) / lengths[i],
        };
        break;
      }
      legacyDistance -= lengths[i];
    }
    if (Math.hypot(car.location.x - legacy.x, car.location.y - legacy.y) > 0.002) continue;
    car.progress = round(car.progress % perimeter) % perimeter;
    const distance = ((car.progress % perimeter) + perimeter) % perimeter;
    let offset = 0,
      pose: { x: number; y: number; heading: number } | undefined;
    for (let i = 0; i < road.length; i++) {
      const vertex = road[i],
        previous = road[(i + road.length - 1) % road.length],
        next = road[(i + 1) % road.length];
      const previousLength = lengths[(i + road.length - 1) % road.length],
        nextLength = lengths[i];
      const radius = Math.min(0.8, previousLength / 3, nextLength / 3);
      let displacement = distance - offset;
      if (i === 0 && displacement > perimeter / 2) displacement -= perimeter;
      if (Math.abs(displacement) <= radius) {
        const incoming = {
          x: (vertex.x - previous.x) / previousLength,
          y: (vertex.y - previous.y) / previousLength,
        };
        const outgoing = {
          x: (next.x - vertex.x) / nextLength,
          y: (next.y - vertex.y) / nextLength,
        };
        const t = (displacement + radius) / (2 * radius);
        // Expanded quadratic corner: vertex + outgoing*r*t² - incoming*r*(1-t)².
        pose = {
          x: vertex.x + radius * (outgoing.x * t * t - incoming.x * (1 - t) * (1 - t)),
          y: vertex.y + radius * (outgoing.y * t * t - incoming.y * (1 - t) * (1 - t)),
          heading: Math.atan2(
            incoming.y * (1 - t) + outgoing.y * t,
            incoming.x * (1 - t) + outgoing.x * t,
          ),
        };
        break;
      }
      offset += nextLength;
    }
    if (!pose) {
      offset = 0;
      for (let i = 0; i < road.length; i++) {
        if (distance < offset + lengths[i]) {
          const a = road[i],
            b = road[(i + 1) % road.length],
            t = (distance - offset) / lengths[i];
          pose = {
            x: a.x + (b.x - a.x) * t,
            y: a.y + (b.y - a.y) * t,
            heading: Math.atan2(b.y - a.y, b.x - a.x),
          };
          break;
        }
        offset += lengths[i];
      }
    }
    if (!pose) throw Error("Oracle road mapping failed");
    car.location = { x: round(pose.x), y: round(pose.y), scene: "outside" };
    car.heading = pose.heading;
    const driver =
      car.driverId === "player"
        ? expected.player
        : expected.npcs.find((n) => n.id === car.driverId);
    if (driver) driver.location = { ...car.location };
  }
  expected.schemaVersion = 8;
  expected.engineVersion = "1.0.0-candidate.7";
  return expected;
}
