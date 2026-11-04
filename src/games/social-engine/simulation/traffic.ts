import type { Point, Vehicle, WorldState } from "../domain/types.ts";
import { JUNCTION_ZONES, signalAxis } from "../domain/traffic.ts";
import { parkedAt, weatherEffects } from "./mobility.ts";
import { ROADS, laneLength } from "../domain/world.ts";
import { trafficPose } from "../domain/traffic.ts";
import { clamp, quantize } from "./random.ts";
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const RESERVATION_RADIUS = 1.25;
/** Occupancy is a reservation derived from persisted vehicle positions. No second
 * queue authority can become stale on restore; all decisions use stable vehicle order. */
export function trafficContext(s: WorldState) {
  const drivers = new Set(s.vehicles.map((v) => v.driverId));
  return {
    cars: s.vehicles,
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
  for (const zone of JUNCTION_ZONES) {
    const inside = (p: Point) => zone.some((j) => dist(p, j) <= RESERVATION_RADIUS);
    if (!inside(next)) continue;
    const clearing = inside(car.location);
    if (!clearing && moving.some((v) => inside(v.location))) return false;
    // Admission owns the whole connected crossing box. An admitted vehicle clears
    // all overlapping stop lines even when the signal changes halfway through.
    if (clearing) continue;
    const axis =
      Math.abs(next.x - car.location.x) >= Math.abs(next.y - car.location.y)
        ? "horizontal"
        : "vertical";
    if (signalAxis(s.tick, zone[0]) !== axis) return false;
  }
  return true;
}

/** Authoritative traffic step. Integration owner replaces engine's old local traffic
 * body with this export. Save fields and command flags remain unchanged. */
export function advanceTraffic(state: WorldState): void {
  const context = trafficContext(state);
  for (const vehicle of state.vehicles) {
    if (!vehicle.driverId || parkedAt(state, vehicle.id)) continue;
    const driver =
      vehicle.driverId === "player"
        ? state.player
        : state.npcs.find((n) => n.id === vehicle.driverId);
    if (!driver?.alive || driver.age < 18) {
      vehicle.driverId = null;
      vehicle.speed = 0;
      continue;
    }
    if (vehicle.driverId === "player") {
      const throttle = Number(state.flags.throttle ?? 0);
      vehicle.speed = quantize(
        clamp(
          vehicle.speed + (throttle > 0 ? 0.22 : throttle < 0 ? -0.55 : -0.08),
          0,
          6 * weatherEffects(state).speedFactor,
        ),
      );
      if (Number(state.flags.steer) && vehicle.speed > 0.1) {
        outer: for (let lane = 0; lane < ROADS.length; lane++)
          if (lane !== vehicle.lane) {
            let cumulative = 0;
            for (let i = 0; i < ROADS[lane].length; i++) {
              const a = ROADS[lane][i],
                b = ROADS[lane][(i + 1) % ROADS[lane].length],
                len = dist(a, b),
                t =
                  ((vehicle.location.x - a.x) * (b.x - a.x) +
                    (vehicle.location.y - a.y) * (b.y - a.y)) /
                  (len * len),
                heading = Math.atan2(b.y - a.y, b.x - a.x),
                turn = Math.atan2(
                  Math.sin(heading - vehicle.heading),
                  Math.cos(heading - vehicle.heading),
                );
              if (
                t >= 0 &&
                t <= 1 &&
                dist(vehicle.location, { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }) <
                  0.12 &&
                Math.abs(turn) > 0.4 &&
                Math.abs(turn) < 2.5 &&
                Math.sign(turn) === Math.sign(Number(state.flags.steer))
              ) {
                // The selected edge must start at the physical crossing. No snap to a parallel lane.
                vehicle.lane = lane;
                vehicle.progress = cumulative + t * len;
                state.flags.steer = 0;
                break outer;
              }
              cumulative += len;
            }
          }
      }
    }
    const step = Math.min(vehicle.speed, 6 * weatherEffects(state).speedFactor) * 0.1,
      len = laneLength(vehicle.lane),
      progress = quantize((vehicle.progress + step) % len),
      position = trafficPose(vehicle.lane, progress);
    if (!mayAdvanceVehicle(state, vehicle, position, context)) continue;
    // Legacy rectangular saves retain their location on decode. Approach the new
    // tangent by at most one physical step, avoiding a migration teleport.
    const delta = dist(vehicle.location, position),
      ratio = delta > step && delta > 0 ? step / delta : 1;
    if (ratio < 1) {
      const next = {
        x: vehicle.location.x + (position.x - vehicle.location.x) * ratio,
        y: vehicle.location.y + (position.y - vehicle.location.y) * ratio,
      };
      if (!mayAdvanceVehicle(state, vehicle, next, context)) continue;
      vehicle.heading = Math.atan2(next.y - vehicle.location.y, next.x - vehicle.location.x);
      vehicle.location = { x: quantize(next.x), y: quantize(next.y), scene: "outside" };
    } else {
      vehicle.heading = position.heading;
      vehicle.location = { x: quantize(position.x), y: quantize(position.y), scene: "outside" };
    }
    vehicle.progress = progress;
    driver.location = { ...vehicle.location };
    if (vehicle.driverId === "player")
      state.flags.drivenDistance = quantize(
        Number(state.flags.drivenDistance ?? 0) + Math.min(step, delta),
      );
  }
}
