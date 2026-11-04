import type { Point, Vehicle, WorldState } from "../domain/types.ts";
import { JUNCTION_ZONES, signalAxis } from "../domain/traffic.ts";
import { parkedAt, weatherEffects } from "./mobility.ts";
import { ROADS, ROAD_CENTERS, laneLength, pointOnLane } from "../domain/world.ts";
import { trafficPose, canonicalHeading } from "../domain/traffic.ts";
import { CROSSINGS } from "./pedestrian-navigation.ts";
import { clamp, quantize } from "./random.ts";
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
// Stop outside the vehicle clearance envelope; a stop line inside 1.4m can
// physically obstruct the admitted cross traffic and lock the junction forever.
const RESERVATION_RADIUS = 2;
/** Occupancy is a reservation derived from persisted vehicle positions. No second
 * queue authority can become stale on restore; all decisions use stable vehicle order. */
export function trafficContext(s: WorldState) {
  const drivers = new Set(s.vehicles.map((v) => v.driverId));
  return {
    cars: s.vehicles,
    parked: new Set(s.mobility.parking.flatMap((lot) => lot.vehicleIds)),
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
    moving.some((other) => {
      const dx = next.x - other.location.x,
        dy = next.y - other.location.y;
      // Parking bays sit beside the travel lane. A circular buffer would seal
      // that lane forever; use the parked body's longitudinal/lateral footprint.
      const overlaps = context.parked.has(other.id)
        ? Math.abs(dx * Math.cos(other.heading) + dy * Math.sin(other.heading)) < 1.5 &&
          Math.abs(-dx * Math.sin(other.heading) + dy * Math.cos(other.heading)) < 0.85
        : dist(next, other.location) < 1.4;
      return overlaps && dist(next, other.location) < dist(car.location, other.location) - 0.001;
    })
  )
    return false;
  // Yield to physical pedestrians, never to the car's own driver or distant abstract citizens.
  const pedestrians = context.pedestrians;
  // Reserve the whole crossing before the nose reaches it. Radial yielding
  // alone can stop a car in the middle of the pedestrian corridor, with each
  // participant then waiting for the other's body to move out of the way.
  const vertical = Math.abs(next.y - car.location.y) > Math.abs(next.x - car.location.x);
  const axis = vertical ? "y" : "x",
    lateral = vertical ? "x" : "y";
  const centers = vertical ? ROAD_CENTERS.vertical : ROAD_CENTERS.horizontal;
  const crossings = vertical ? CROSSINGS.y : CROSSINGS.x;
  for (const road of centers) {
    if (Math.abs(car.location[lateral] - road) > 2) continue;
    for (const crossing of crossings) {
      const current = car.location[axis] - crossing,
        after = next[axis] - crossing;
      if (
        Math.abs(current) <= 0.8 ||
        Math.abs(after) >= 2.1 ||
        Math.abs(after) >= Math.abs(current)
      )
        continue;
      if (
        pedestrians.some((p) => {
          if (Math.abs(p.location[axis] - crossing) > 0.65) return false;
          const offset = p.location[lateral] - road;
          if (Math.abs(offset) <= 1.7) return true;
          if (Math.abs(offset) > 2.6) return false;
          // Waiting on the curb is not occupying the carriageway. Reserve early
          // only when a physical actor is actually walking toward this crossing.
          const target = p.path[0];
          const motion =
            p.id === "player" ? Number(s.flags[lateral === "x" ? "moveX" : "moveY"] ?? 0) : 0;
          return (
            offset * motion < 0 ||
            (!!target && offset * (target[lateral] - p.location[lateral]) < 0)
          );
        })
      )
        return false;
    }
  }
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
    if (
      !vehicle.driverId ||
      parkedAt(state, vehicle.id) ||
      !Number.isInteger(vehicle.lane) ||
      vehicle.lane < 0 ||
      vehicle.lane >= ROADS.length ||
      !Number.isFinite(vehicle.progress) ||
      vehicle.progress < 0 ||
      vehicle.progress >= laneLength(vehicle.lane) ||
      !Number.isFinite(vehicle.speed) ||
      vehicle.speed < 0
    )
      continue;
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
                heading = canonicalHeading(Math.atan2(b.y - a.y, b.x - a.x)),
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
    if (vehicle.driverId !== "player" && vehicle.resumeSpeed !== undefined)
      vehicle.speed = quantize(Math.min(vehicle.resumeSpeed, vehicle.speed + 0.22));
    const step = Math.min(vehicle.speed, 6 * weatherEffects(state).speedFactor) * 0.1,
      len = laneLength(vehicle.lane),
      progress = quantize((vehicle.progress + step) % len) % len,
      position = trafficPose(vehicle.lane, progress);
    if (!mayAdvanceVehicle(state, vehicle, position, context)) {
      if (vehicle.driverId !== "player" && vehicle.speed > 0)
        vehicle.resumeSpeed ??= vehicle.speed;
      vehicle.speed = 0;
      continue;
    }
    if (vehicle.resumeSpeed !== undefined && vehicle.speed >= vehicle.resumeSpeed)
      delete vehicle.resumeSpeed;
    if (step <= 0) continue;
    const delta = dist(vehicle.location, position);
    vehicle.heading = position.heading;
    vehicle.location = { x: quantize(position.x), y: quantize(position.y), scene: "outside" };
    vehicle.progress = progress;
    driver.location = { ...vehicle.location };
    if (vehicle.driverId === "player")
      state.flags.drivenDistance = quantize(
        Number(state.flags.drivenDistance ?? 0) + Math.min(step, delta),
      );
  }
}

/** Schema migration hook: convert only recognized legacy rectangular poses.
 * Call during schema-6 -> schema-7 migration BEFORE strict validateState. Never
 * call from rendering/validation; arbitrary off-lane saves remain invalid.
 * Parked bay coordinates are authoritative and must not be canonicalized. */
export function migrateLegacyTrafficPoses(state: WorldState): void {
  for (const vehicle of state.vehicles) {
    if (
      parkedAt(state, vehicle.id) ||
      !Number.isInteger(vehicle.lane) ||
      vehicle.lane < 0 ||
      vehicle.lane >= ROADS.length ||
      !Number.isFinite(vehicle.progress) ||
      vehicle.progress < 0 ||
      vehicle.progress >= Number.MAX_SAFE_INTEGER
    )
      continue;
    const legacy = pointOnLane(vehicle.lane, vehicle.progress);
    if (dist(vehicle.location, legacy) > 0.002) continue;
    vehicle.progress =
      quantize(vehicle.progress % laneLength(vehicle.lane)) % laneLength(vehicle.lane);
    const canonicalPose = trafficPose(vehicle.lane, vehicle.progress);
    vehicle.location = {
      x: quantize(canonicalPose.x),
      y: quantize(canonicalPose.y),
      scene: "outside",
    };
    vehicle.heading = canonicalPose.heading;
    const driver =
      vehicle.driverId === "player"
        ? state.player
        : state.npcs.find((n) => n.id === vehicle.driverId);
    if (driver) driver.location = { ...vehicle.location };
  }
}
