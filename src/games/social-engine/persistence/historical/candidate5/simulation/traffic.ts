import type { Point, Vehicle, WorldState } from "../domain/types.ts";
import { JUNCTIONS, signalAxis } from "../domain/traffic.ts";
import { parkedAt } from "./mobility.ts";
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const RESERVATION_RADIUS = 1.25;
/** Occupancy is a reservation derived from persisted vehicle positions. No second
 * queue authority can become stale on restore; all decisions use stable vehicle order. */
export function trafficContext(s: WorldState) {
  const drivers = new Set(s.vehicles.map((v) => v.driverId));
  return {
    cars: s.vehicles.filter((v) => !parkedAt(s, v.id)),
    pedestrians: [s.player, ...s.npcs.slice(0, 100)].filter(
      (p) => p.alive && !drivers.has(p.id) && p.location.scene === "outside",
    ),
  };
}
export function mayAdvanceVehicle(
  s: WorldState,
  car: Vehicle,
  next: Point,
  context = trafficContext(s),
): boolean {
  const moving = context.cars.filter((v) => v.id !== car.id);
  if (
    moving.some(
      (other) =>
        dist(next, other.location) < 1.4 &&
        dist(next, other.location) < dist(car.location, other.location) - 0.001,
    )
  )
    return false;
  // Yield to physical pedestrians, never to the car's own driver or distant abstract citizens.
  const pedestrians = context.pedestrians;
  if (
    pedestrians.some(
      (p) =>
        Math.abs(next.x - p.location.x) < 0.8 &&
        Math.abs(next.y - p.location.y) < 0.8 &&
        dist(next, p.location) < 0.8 &&
        dist(next, p.location) < dist(car.location, p.location) - 0.001,
    )
  )
    return false;
  for (const junction of JUNCTIONS) {
    if (dist(next, junction) > RESERVATION_RADIUS) continue;
    const occupants = moving.filter((v) => dist(v.location, junction) <= RESERVATION_RADIUS);
    if (occupants.length && dist(car.location, junction) > RESERVATION_RADIUS) return false;
    // A vehicle already inside clears even when the light changes.
    if (dist(car.location, junction) <= RESERVATION_RADIUS) continue;
    const axis =
      Math.abs(next.x - car.location.x) >= Math.abs(next.y - car.location.y)
        ? "horizontal"
        : "vertical";
    if (signalAxis(s.tick, junction) !== axis) return false;
  }
  return true;
}
