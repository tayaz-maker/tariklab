import type { Point, Vehicle } from "../domain/types.ts";
export const VEHICLE_HALF_LENGTH = 1.5,
  VEHICLE_HALF_WIDTH = 0.85,
  PERSON_RADIUS = 0.28;
const VEHICLE_RADIUS = Math.hypot(VEHICLE_HALF_LENGTH, VEHICLE_HALF_WIDTH);
type Pose = Point & { heading: number };
/** Separating-axis clearance of the two oriented authoritative bodies. A
 * negative result is penetration; centre distance cannot represent a long car. */
export function vehicleSeparation(a: Pose, b: Pose): number {
  const ca = Math.cos(a.heading),
    sa = Math.sin(a.heading),
    cb = Math.cos(b.heading),
    sb = Math.sin(b.heading),
    dx = b.x - a.x,
    dy = b.y - a.y;
  let clearance = -Infinity;
  for (const [x, y] of [
    [ca, sa],
    [-sa, ca],
    [cb, sb],
    [-sb, cb],
  ]) {
    const ra =
      VEHICLE_HALF_LENGTH * Math.abs(ca * x + sa * y) +
      VEHICLE_HALF_WIDTH * Math.abs(-sa * x + ca * y);
    const rb =
      VEHICLE_HALF_LENGTH * Math.abs(cb * x + sb * y) +
      VEHICLE_HALF_WIDTH * Math.abs(-sb * x + cb * y);
    clearance = Math.max(clearance, Math.abs(dx * x + dy * y) - ra - rb);
  }
  return clearance;
}
/** Check translation and rotation at at most 5cm / 0.03rad intervals. Legacy
 * overlaps may only separate monotonically; they never grant free movement. */
export function vehicleSweepClear(
  car: Vehicle,
  next: Point & { heading?: number },
  other: Vehicle,
): boolean {
  const travel = Math.hypot(next.x - car.location.x, next.y - car.location.y);
  if (
    Math.hypot(other.location.x - car.location.x, other.location.y - car.location.y) >
    2 * VEHICLE_RADIUS + travel + 0.001
  )
    return true;
  const from = { ...car.location, heading: car.heading },
    to = { ...next, heading: next.heading ?? car.heading },
    stationary = { ...other.location, heading: other.heading };
  const turn = Math.atan2(Math.sin(to.heading - from.heading), Math.cos(to.heading - from.heading));
  const count = Math.max(
    1,
    Math.ceil(Math.max(Math.hypot(to.x - from.x, to.y - from.y) / 0.05, Math.abs(turn) / 0.03)),
  );
  let previous = vehicleSeparation(from, stationary);
  for (let i = 1; i <= count; i++) {
    const t = i / count,
      pose = {
        x: from.x + (to.x - from.x) * t,
        y: from.y + (to.y - from.y) * t,
        heading: from.heading + turn * t,
      },
      clearance = vehicleSeparation(pose, stationary);
    if (clearance < -0.00001 && clearance <= previous + 0.000001) return false;
    previous = clearance;
  }
  return true;
}
export function personVehicleSeparation(person: Point, car: Pose): number {
  const dx = person.x - car.x,
    dy = person.y - car.y,
    c = Math.cos(car.heading),
    s = Math.sin(car.heading);
  const along = Math.abs(dx * c + dy * s) - VEHICLE_HALF_LENGTH,
    across = Math.abs(-dx * s + dy * c) - VEHICLE_HALF_WIDTH;
  return (
    Math.hypot(Math.max(0, along), Math.max(0, across)) +
    Math.min(0, Math.max(along, across)) -
    PERSON_RADIUS
  );
}
export function pedestrianApproachClear(car: Vehicle, from: Point, next: Point): boolean {
  if (
    Math.hypot(next.x - car.location.x, next.y - car.location.y) >
    VEHICLE_RADIUS + PERSON_RADIUS + 0.001
  )
    return true;
  const pose = { ...car.location, heading: car.heading },
    before = personVehicleSeparation(from, pose),
    after = personVehicleSeparation(next, pose);
  return after >= -0.00001 || after > before + 0.000001;
}
export function vehiclePedestrianSweepClear(
  car: Vehicle,
  next: Point & { heading?: number },
  person: Point,
): boolean {
  const travel = Math.hypot(next.x - car.location.x, next.y - car.location.y);
  if (
    Math.hypot(person.x - car.location.x, person.y - car.location.y) >
    VEHICLE_RADIUS + PERSON_RADIUS + travel + 0.001
  )
    return true;
  const turn = Math.atan2(
    Math.sin((next.heading ?? car.heading) - car.heading),
    Math.cos((next.heading ?? car.heading) - car.heading),
  );
  const count = Math.max(
    1,
    Math.ceil(
      Math.max(
        Math.hypot(next.x - car.location.x, next.y - car.location.y) / 0.05,
        Math.abs(turn) / 0.03,
      ),
    ),
  );
  let previous = personVehicleSeparation(person, { ...car.location, heading: car.heading });
  for (let i = 1; i <= count; i++) {
    const t = i / count,
      clearance = personVehicleSeparation(person, {
        x: car.location.x + (next.x - car.location.x) * t,
        y: car.location.y + (next.y - car.location.y) * t,
        heading: car.heading + turn * t,
      });
    if (clearance < -0.00001 && clearance <= previous + 0.000001) return false;
    previous = clearance;
  }
  return true;
}
