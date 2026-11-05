import type { Person, Point, Vehicle, WorldState } from "../domain/types.ts";
import { ROAD_CENTERS } from "../domain/world.ts";
import { CROSSINGS } from "./pedestrian-navigation.ts";
import { VEHICLE_HALF_LENGTH, VEHICLE_HALF_WIDTH } from "./vehicle-collision.ts";

type Direction = -1 | 1;
type Crossing = { id: string; along: "x" | "y"; across: "x" | "y"; road: number; mark: number };
type Intent = { crossing: Crossing; direction: Direction; order: number };
const crossings: Crossing[] = [
  ...ROAD_CENTERS.horizontal.flatMap((road) =>
    CROSSINGS.x.map((mark) => ({
      id: `h:${road}:${mark}`,
      along: "x" as const,
      across: "y" as const,
      road,
      mark,
    })),
  ),
  ...ROAD_CENTERS.vertical.flatMap((road) =>
    CROSSINGS.y.map((mark) => ({
      id: `v:${road}:${mark}`,
      along: "y" as const,
      across: "x" as const,
      road,
      mark,
    })),
  ),
];
const inside = (p: Point, c: Crossing) =>
  Math.abs(p[c.across] - c.road) <= 2 && Math.abs(p[c.along] - c.mark) <= 0.65;

/** Existing crossing occupants keep their exit. A short, staggered road
 * turn can close only the gate to new walkers; unused turns do not stop them. */
export function crossingVehicleTurn(tick: number, road: number, mark: number): boolean {
  return (tick + road * 11 + Math.round(mark * 6)) % 150 >= 75;
}
function crossingVehicleAxis(car: Vehicle, along: "x" | "y"): number {
  return along === "x" ? Math.cos(car.heading) : Math.sin(car.heading);
}
export function vehicleOccupiesCrossing(
  car: Vehicle,
  along: "x" | "y",
  road: number,
  mark: number,
): boolean {
  const across = along === "x" ? "y" : "x";
  const axis = Math.abs(crossingVehicleAxis(car, along));
  if (axis < 0.65 || Math.abs(car.location[across] - road) > 1.65) return false;
  const span =
    VEHICLE_HALF_LENGTH * axis + VEHICLE_HALF_WIDTH * Math.abs(crossingVehicleAxis(car, across));
  return Math.abs(car.location[along] - mark) < span + 0.65;
}
function vehicleApproachesCrossing(car: Vehicle, c: Crossing): boolean {
  const axis = crossingVehicleAxis(car, c.along);
  if (Math.abs(axis) < 0.65 || Math.abs(car.location[c.across] - c.road) > 1.65) return false;
  const ahead = (c.mark - car.location[c.along]) * Math.sign(axis);
  return ahead >= 0 && ahead < 4.5;
}

function intent(person: Person): Intent | null {
  let selected: Intent | null = null;
  for (const c of crossings) {
    if (
      Math.abs(person.location[c.across] - c.road) > 4.3 ||
      Math.abs(person.location[c.along] - c.mark) > 1.9
    )
      continue;
    if (inside(person.location, c)) {
      const exit = person.path.find((p) => Math.abs(p[c.across] - c.road) > 2);
      if (exit)
        return {
          crossing: c,
          direction: Math.sign(exit[c.across] - c.road) as Direction,
          order: -1,
        };
    }
    let from: Point = person.location;
    for (let i = 0; i < person.path.length; i++) {
      const next = person.path[i],
        a = from[c.across] - c.road,
        b = next[c.across] - c.road;
      if (a * b <= 0 && a !== b) {
        const t = -a / (b - a),
          along = from[c.along] + (next[c.along] - from[c.along]) * t;
        if (Math.abs(along - c.mark) <= 0.65 && (!selected || i < selected.order))
          selected = { crossing: c, direction: Math.sign(b - a) as Direction, order: i };
      }
      from = next;
    }
  }
  return selected;
}

/** A crossing is a narrow physical corridor, not a bidirectional crowd sink.
 * Claims are derived from living local bodies and their persisted routes on each
 * tick; death, route abort and reload cannot leave an orphaned queue or owner.
 * If a predecessor already has opposing occupants, those facing away from the
 * leading exit retreat through the same clear corridor before anyone enters. */
export function pedestrianCrossingTraffic(
  state: WorldState,
  actors: Person[],
  drivers: Set<string | null>,
) {
  const intents = new Map<string, { path: Point[]; intent: Intent | null }>();
  const get = (person: Person) => {
    const cached = intents.get(person.id);
    if (cached?.path === person.path) return cached.intent;
    const next = intent(person);
    intents.set(person.id, { path: person.path, intent: next });
    return next;
  };
  const flows = new Map<
    string,
    { flow: Direction | null; waiting: Set<Direction>; leader: number }
  >();
  for (const person of actors) {
    if (
      !person.alive ||
      drivers.has(person.id) ||
      person.location.scene !== "outside" ||
      !person.path.length
    )
      continue;
    const planned = get(person);
    if (!planned) continue;
    const { crossing: c, direction } = planned;
    const claim = flows.get(c.id) ?? {
      flow: null,
      waiting: new Set<Direction>(),
      leader: Infinity,
    };
    if (inside(person.location, c)) {
      const remaining = 2 - direction * (person.location[c.across] - c.road);
      if (remaining < claim.leader) {
        claim.leader = remaining;
        claim.flow = direction;
      }
    } else if (
      Math.abs(person.location[c.across] - c.road) <= 3.5 &&
      Math.abs(person.location[c.along] - c.mark) <= 1.25
    )
      claim.waiting.add(direction);
    flows.set(c.id, claim);
  }
  const managed = new Set(
    (state.mobility.driverBreaks ?? [])
      .filter((b) => ["toBay", "fromBay", "disabled"].includes(b.phase))
      .map((b) => b.vehicleId),
  );
  const active = state.vehicles.filter(
    (v) => v.driverId && (v.speed > 0 || v.resumeSpeed !== undefined || managed.has(v.id)),
  );
  const vehicleTurns = crossings.filter((c) =>
    active.some(
      (v) =>
        vehicleOccupiesCrossing(v, c.along, c.road, c.mark) ||
        (crossingVehicleTurn(state.tick, c.road, c.mark) && vehicleApproachesCrossing(v, c)),
    ),
  );
  return {
    retreat(person: Person): Point | null {
      const planned = get(person);
      if (!planned) return null;
      const { crossing: c, direction } = planned,
        claim = flows.get(c.id);
      if (!claim?.flow || claim.flow === direction) return null;
      const offset = person.location[c.across] - c.road;
      const nearExit =
        offset * claim.flow > 0 &&
        Math.abs(offset) < 2.74 &&
        Math.abs(person.location[c.along] - c.mark) <= 0.85;
      if (!inside(person.location, c) && !nearExit) return null;
      return { ...person.location, [c.across]: c.road + claim.flow * 2.75, [c.along]: c.mark };
    },
    mayWalk(person: Person, next: Point): boolean {
      if (vehicleTurns.some((c) => !inside(person.location, c) && inside(next, c))) return false;
      const planned = get(person);
      if (!planned) return true;
      const { crossing: c, direction } = planned;
      if (inside(person.location, c)) return true; // an existing body always retains a legal exit
      if (
        Math.abs(next[c.along] - c.mark) > 0.85 ||
        Math.abs(next[c.across] - c.road) > 2.95 ||
        Math.abs(next[c.across] - c.road) >= Math.abs(person.location[c.across] - c.road) - 0.0001
      )
        return true;
      const claim = flows.get(c.id) ?? {
        flow: null,
        waiting: new Set<Direction>(),
        leader: Infinity,
      };
      // Stop adding to the old batch when the opposing side's turn arrives.
      const preferred =
        claim.waiting.size > 1
          ? Math.floor((state.tick + c.road * 7 + c.mark * 3) / 90) % 2 === 0
            ? 1
            : -1
          : null;
      if (
        (claim.flow !== null && claim.flow !== direction) ||
        (preferred !== null && preferred !== direction)
      )
        return false;
      claim.flow = direction;
      flows.set(c.id, claim);
      return true;
    },
  };
}
