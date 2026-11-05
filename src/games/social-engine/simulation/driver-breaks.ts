import { vehicleSeparation, personVehicleSeparation } from "./vehicle-collision.ts";
import type { WorldState, Vehicle, Person, Point } from "../domain/types.ts";
import {
  DRIVER_BAYS,
  ALL_BREAK_BAYS,
  STARTER_BAY,
  WEST_OVERFLOW_PARKING_ID,
  getBreakBay,
  breakEntry,
  breakReturn,
  breakRoute,
  breakRoutePose,
  type DriverBreak,
} from "../domain/driver-breaks.ts";
import { BUILDINGS, isWalkable, laneLength } from "../domain/world.ts";
import { trafficPose } from "../domain/traffic.ts";
import { mayAdvanceVehicle, trafficContext, mergeJunctionGap } from "./traffic.ts";
import { pedestrianPath, pedestrianSegment } from "./pedestrian-navigation.ts";
import { serviceOpen, serviceHours, requestNpcMeal } from "./services.ts";
import { mealAddress, hasMeal } from "./meal-membership.ts";
import { hasSettledTransaction } from "./ledger.ts";
import { draw, quantize } from "./random.ts";

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const detached = (b: DriverBreak) =>
  ["walkToMarket", "queue", "walkBack", "awaitReturn", "routine"].includes(b.phase);
export function controlledBreak(s: WorldState, personId: string): boolean {
  return (s.mobility.driverBreaks ?? []).some(
    (b) => b.personId === personId && ["walkToMarket", "queue", "walkBack"].includes(b.phase),
  );
}
export function routeBreak(s: WorldState, vehicleId: string): DriverBreak | undefined {
  return (s.mobility.driverBreaks ?? []).find(
    (b) => b.vehicleId === vehicleId && ["toBay", "fromBay", "disabled"].includes(b.phase),
  );
}
function claimsBay(s: WorldState, b: DriverBreak): boolean {
  return (
    !["driving", "seeking", "cancelled"].includes(b.phase) &&
    (b.phase !== "disabled" || s.vehicles.some((v) => v.id === b.vehicleId && v.driverId))
  );
}
export function breakVehicleEntryBlocked(s: WorldState, vehicleId: string): boolean {
  const breaks = s.mobility.driverBreaks ?? [];
  const paused = breaks.find((b) => b.vehicleId === vehicleId && b.phase === "disabled");
  return (
    !!paused && breaks.some((b) => b !== paused && b.bayId === paused.bayId && claimsBay(s, b))
  );
}
function walk(s: WorldState, p: Person, to: Point, goal: string): boolean {
  const obstacles = s.vehicles
    .filter((v) => !v.driverId || v.speed === 0)
    .map((v) => ({ ...v.location, heading: v.heading }));
  const path = pedestrianPath(p.location, to, obstacles);
  if (!path.length) return false;
  p.goal = goal;
  p.destination = { ...to };
  p.path = path;
  p.lastDecision = s.minute;
  return true;
}
function returnToCar(s: WorldState, b: DriverBreak, p: Person): void {
  // Existing doorway admission, walking clearance and crossing rules remain in
  // charge. Leaving the shop is requested through its real doorway, not a snap.
  const desk = s.economy.services.market;
  desk.queue = desk.queue.filter((q) => q.personId !== p.id);
  desk.updatedTick = s.tick;
  b.lastProgressAt = s.tick;
  b.lastPosition = { ...p.location };
  b.phase = "walkBack";
  p.goal = "returnToCar";
  p.lastDecision = s.minute - 20;
  p.destination = { ...getBreakBay(b.bayId).door };
  p.path = [];
  if (p.location.scene === "outside") walk(s, p, getBreakBay(b.bayId).door, "returnToCar");
}
function pauseWalkingReturn(s: WorldState, b: DriverBreak, p: Person): void {
  b.phase = "awaitReturn";
  b.cooldownUntil = s.tick + 600;
  p.goal = "idle";
  p.lastDecision = s.minute - 60;
  p.destination = null;
  p.path = [];
}
function retryWalkingReturn(s: WorldState, b: DriverBreak, p: Person): void {
  if (s.tick < b.cooldownUntil) return;
  b.cooldownUntil = s.tick + 180;
  if (p.health < 35) return;
  const outside = p.location.scene === "outside";
  const start = outside ? p.location : BUILDINGS.find((site) => site.id === p.location.scene)?.door;
  if (!start) return;
  const drivers = new Set(s.vehicles.map((v) => v.driverId));
  if (
    !outside &&
    [s.player, ...s.npcs.slice(0, 100)].some(
      (other) =>
        other.id !== p.id &&
        other.alive &&
        !drivers.has(other.id) &&
        other.location.scene === "outside" &&
        distance(other.location, start) < 0.6,
    )
  )
    return;
  const door = getBreakBay(b.bayId).door;
  const obstacles = s.vehicles
    .filter((v) => !v.driverId || v.speed === 0)
    .map((v) => ({ ...v.location, heading: v.heading }));
  const path = pedestrianPath(start, door, obstacles);
  if (!path.length) return;
  b.phase = "walkBack";
  b.recoveryAttempts = 0;
  b.lastProgressAt = s.tick;
  b.lastPosition = { ...p.location };
  p.goal = "returnToCar";
  p.lastDecision = s.minute - 60;
  p.destination = { ...door };
  p.path = outside ? path : [];
}
function cancel(s: WorldState, b: DriverBreak, p: Person | undefined): void {
  b.phase = "cancelled";
  b.outcome = "cancelled";
  b.cooldownUntil = s.tick + 6000;
  if (p?.alive) {
    p.goal = "idle";
    p.lastDecision = s.minute - 60;
    p.destination = null;
    p.path = [];
  }
}
function mealSettled(s: WorldState, b: DriverBreak): boolean {
  if (b.mealJoinedTick === null) return false;
  const address = mealAddress(`meal:v5:market:${b.mealJoinedTick}:${b.personId}`)!;
  return hasMeal(s.flags[address.key], address.code);
}
function bodyClear(s: WorldState, v: Vehicle, next: ReturnType<typeof breakRoutePose>): boolean {
  // Check the oriented body's corners against buildings and the sea wall in
  // addition to the shared moving-body, pedestrian and right-of-way guard.
  for (const l of [-1.5, 0, 1.5])
    for (const w of [-0.85, 0, 0.85])
      if (
        !isWalkable({
          x: next.x + l * Math.cos(next.heading) - w * Math.sin(next.heading),
          y: next.y + l * Math.sin(next.heading) + w * Math.cos(next.heading),
        })
      )
        return false;
  return mayAdvanceVehicle(s, v, next, trafficContext(s));
}
function clearRouteCorridor(s: WorldState, v: Vehicle, r: ReturnType<typeof breakRoute>): boolean {
  const corridor = r.connectorPoses;
  return (
    mergeJunctionGap(s, v, r) &&
    !s.vehicles.some(
      (other) =>
        other.id !== v.id &&
        corridor.some(
          (point) => vehicleSeparation(point, { ...other.location, heading: other.heading }) < 0.15,
        ),
    ) &&
    !trafficContext(s).pedestrians.some((person) =>
      corridor.some((point) => personVehicleSeparation(person.location, point) < 0.1),
    )
  );
}
function parkingExitClear(s: WorldState, b: DriverBreak, v: Vehicle, p: Person): boolean {
  const bay = getBreakBay(b.bayId);
  const lot = s.mobility.parking.find((l) => l.id === bay.parkingId)!;
  return (
    (!lot.vehicleIds.length || lot.vehicleIds.includes(v.id)) &&
    ![s.player, ...s.npcs].some(
      (n) =>
        n.id !== p.id &&
        n.alive &&
        n.location.scene === "outside" &&
        distance(n.location, bay.door) < 0.6,
    ) &&
    pedestrianPath(bay.door, BUILDINGS.find((x) => x.id === "b-market")!.door, [
      { ...v.location, heading: v.heading },
    ]).length > 0
  );
}
function moveRoute(s: WorldState, b: DriverBreak, v: Vehicle, p: Person): void {
  const phase = b.phase as "toBay" | "fromBay",
    r = breakRoute(phase, b.originalLane, b.bayId);
  if (phase === "fromBay" && b.routeProgress === 0 && !clearRouteCorridor(s, v, r)) {
    v.speed = 0;
    return;
  }
  const speed = quantize(Math.min(1.2, v.speed + 0.22));
  const progress = Math.min(r.length, quantize(b.routeProgress + speed * 0.1));
  const pose = breakRoutePose(phase, b.originalLane, progress, b.bayId);
  if (!bodyClear(s, v, pose)) {
    v.speed = 0;
    return;
  }
  v.speed = speed;
  delete v.resumeSpeed;
  b.routeProgress = progress;
  if (b.resumeMark !== undefined && progress - b.resumeMark >= 0.5) {
    b.recoveryAttempts = 0;
    delete b.resumeMark;
  }
  v.location = { x: pose.x, y: pose.y, scene: "outside" };
  v.heading = pose.heading;
  p.location = { ...v.location };
  if (progress < r.length) return;
  if (phase === "toBay") {
    if (p.id === "player") {
      b.phase = "fromBay";
      b.originalLane = getBreakBay(b.bayId).lanes.includes(1) ? 1 : 0;
      b.routeProgress = 0;
      v.speed = 0;
      return;
    }
    const lot = s.mobility.parking.find((l) => l.id === getBreakBay(b.bayId).parkingId)!;
    // Disembark only through a clear pavement point at the actual parked car.
    if (!parkingExitClear(s, b, v, p)) {
      v.speed = 0;
      return;
    }
    v.speed = 0;
    v.driverId = null;
    lot.vehicleIds = [v.id];
    p.location = { ...getBreakBay(b.bayId).door, scene: "outside" };
    p.goal = "eat";
    b.phase = b.workRelease ? "routine" : "walkToMarket";
    b.expiresAt = s.tick + (b.workRelease ? 14400 : 6000);
    if (b.workRelease) {
      p.goal = "idle";
      p.lastDecision = s.minute - 60;
      p.destination = null;
      p.path = [];
    } else walk(s, p, BUILDINGS.find((x) => x.id === "b-market")!.door, "eat");
  } else {
    const endpoint = breakReturn(b.originalLane, b.bayId),
      pose = trafficPose(endpoint.lane, endpoint.progress);
    v.lane = endpoint.lane;
    v.progress = endpoint.progress;
    v.heading = pose.heading;
    v.location = { x: quantize(pose.x), y: quantize(pose.y), scene: "outside" };
    p.location = { ...v.location };
    v.speed = 0;
    if (p.id !== "player") v.resumeSpeed = b.cruiseSpeed;
    p.goal = "drive";
    p.path = [];
    p.destination = null;
    b.phase = p.id === "player" ? "cancelled" : "driving";
    b.cooldownUntil = s.tick + (b.outcome === "fed" ? 1800 : 600);
    b.routeProgress = 0;
    delete b.resumeMark;
  }
}

function resumeBlockedRoute(s: WorldState, b: DriverBreak, v: Vehicle, p: Person): boolean {
  if (
    p.id === "player" ||
    !p.alive ||
    v.driverId !== p.id ||
    !b.disabledPhase ||
    s.tick < b.cooldownUntil ||
    (s.tick + Number(p.id.slice(1))) % 20 !== 0
  )
    return false;
  const phase = b.disabledPhase,
    r = breakRoute(phase, b.originalLane, b.bayId);
  if (phase === "fromBay" && b.routeProgress === 0 && !clearRouteCorridor(s, v, r)) return false;
  const parkedAtEndpoint = phase === "toBay" && b.routeProgress === r.length;
  if (parkedAtEndpoint && !parkingExitClear(s, b, v, p)) return false;
  const next = breakRoutePose(
    phase,
    b.originalLane,
    Math.min(r.length, b.routeProgress + 0.022),
    b.bayId,
  );
  if (!bodyClear(s, v, next)) return false;
  if (parkedAtEndpoint) {
    // Completing an actual disembark requires no further driving distance.
    // Keep the original driver and claim while a pedestrian blocks the door.
    b.recoveryAttempts = 0;
  } else if (b.recoveryAttempts >= 3) {
    // Three small false starts exhaust an episode, not the vehicle. A newly
    // open swept stretch renews the budget without discarding or moving it.
    const end = Math.min(r.length, b.routeProgress + 0.75);
    if (end <= b.routeProgress + 0.0001) return false;
    const shadow = { ...v, location: { ...v.location } };
    for (let d = b.routeProgress; d < end - 0.0001;) {
      d = Math.min(end, d + 0.05);
      const sample = breakRoutePose(phase, b.originalLane, d, b.bayId);
      if (!bodyClear(s, shadow, sample)) return false;
      shadow.location = { x: sample.x, y: sample.y, scene: "outside" };
      shadow.heading = sample.heading;
    }
    b.recoveryAttempts = 0;
  }
  b.phase = phase;
  b.outcome = b.suspendedOutcome ?? "cancelled";
  delete b.disabledPhase;
  delete b.suspendedOutcome;
  b.lastProgressAt = s.tick;
  b.lastPosition = { ...v.location };
  b.recoveryAttempts++;
  b.resumeMark = b.routeProgress;
  return true;
}
function recoverParkedCar(s: WorldState, b: DriverBreak, v: Vehicle): void {
  const bay = getBreakBay(b.bayId);
  if (
    v.driverId ||
    b.recoveryAttempts >= 3 ||
    (s.tick + s.vehicles.indexOf(v)) % 20 !== 0 ||
    !s.mobility.parking.find((l) => l.id === bay.parkingId)?.vehicleIds.includes(v.id)
  )
    return;
  const drivers = new Set(s.vehicles.map((v) => v.driverId));
  const assigned = new Set(s.mobility.driverBreaks!.map((other) => other.personId));
  const pedestrians = [s.player, ...s.npcs.slice(0, 100)].filter(
    (p) => p.alive && p.location.scene === "outside" && !drivers.has(p.id),
  );
  const obstacles = s.vehicles
    .filter((v) => !v.driverId || v.speed === 0)
    .map((v) => ({ ...v.location, heading: v.heading }));
  const nearby = s.npcs
    .slice(0, 100)
    .filter(
      (p) =>
        p.alive &&
        p.age >= 18 &&
        p.health >= 35 &&
        p.wanted === 0 &&
        p.goal !== "work" &&
        p.id !== b.recoveryFor &&
        !drivers.has(p.id) &&
        !assigned.has(p.id),
    )
    .flatMap((p) => {
      const start =
        p.location.scene === "outside"
          ? p.location
          : BUILDINGS.find((x) => x.id === p.location.scene)?.door;
      if (
        !start ||
        (p.location.scene !== "outside" &&
          pedestrians.some((other) => distance(other.location, start) < 0.6))
      )
        return [];
      return [{ p, start, distance: distance(start, bay.door) }];
    })
    .sort((a, b) => a.distance - b.distance || Number(a.p.id.slice(1)) - Number(b.p.id.slice(1)))
    .slice(0, 12);
  const routeCache = new Map<string, Point[]>();
  const candidate = nearby
    .flatMap(({ p, start }) => {
      const key = `${start.x},${start.y}`;
      let path = routeCache.get(key);
      if (!path) {
        path = pedestrianPath(start, bay.door, obstacles);
        routeCache.set(key, path);
      }
      if (!path.length) return [];
      const length = path.reduce(
        (length, point, index) => length + distance(index ? path[index - 1] : start, point),
        0,
      );
      return [{ p, length }];
    })
    .sort((a, b) => a.length - b.length || Number(a.p.id.slice(1)) - Number(b.p.id.slice(1)))[0]?.p;
  if (!candidate) return;
  const previous = s.npcs.find((p) => p.id === b.personId);
  if (previous?.alive) {
    previous.goal = "idle";
    previous.lastDecision = s.minute - 60;
    previous.path = [];
    previous.destination = null;
  }
  b.recoveryFor ??= b.personId;
  b.personId = candidate.id;
  b.recoveryAttempts++;
  b.phase = "walkBack";
  b.outcome = "cancelled";
  b.lastMealTick = null;
  b.mealJoinedTick = null;
  b.workRelease = false;
  b.lastProgressAt = s.tick;
  b.lastPosition = { ...candidate.location };
  candidate.goal = "returnToCar";
  candidate.lastDecision = s.minute - 60;
  candidate.destination = { ...getBreakBay(b.bayId).door };
  candidate.path = [];
  if (candidate.location.scene === "outside")
    walk(s, candidate, getBreakBay(b.bayId).door, "returnToCar");
}

/** Called before ordinary traffic. Managed vehicles have a single physical
 * integrator; unreserved requests continue cruising and never stop at the bay. */
export function driverBreakTick(s: WorldState): Set<string> {
  const integrated = new Set<string>();
  const breaks = s.mobility.driverBreaks ?? (s.mobility.driverBreaks = []);
  const market = s.businesses.find((x) => x.id === "market")!;
  const guardedEastIngress = s.mobility.parking.some((lot) => lot.id === WEST_OVERFLOW_PARKING_ID);
  const day = Math.floor(s.minute / 1440);
  const openingIn = serviceHours(market.id)[0] - (s.minute % 1440);
  const beforeOpening = market.status !== "closed" && openingIn > 0 && openingIn <= 90;
  const canWalkBeforeOpening = (b: DriverBreak) =>
    beforeOpening && b.workRelease && hasSettledTransaction(s, `salary:${day}:${b.personId}`);
  for (const v of s.vehicles) {
    if (!v.driverId || v.driverId === "player") continue;
    const p = s.npcs.find((n) => n.id === v.driverId);
    if (!p?.alive || p.age < 18) continue;
    const workRelease = s.accounts[p.id] < market.prices.simit;
    // The market can feed adults from 45 hunger. Stagger demand around the
    // real threshold so the first break does not coincide with closing.
    const targetHunger = 46 + ((Number(p.id.slice(1)) * 5 + draw(s.seed, 791, 0, 0)) % 13);
    const untilClosing = serviceHours(market.id)[1] - (s.minute % 1440);
    const beforeClosing = untilClosing > 0 && untilClosing <= 100 && p.hunger >= 48;
    if (!workRelease && p.hunger < targetHunger && !beforeClosing) continue;
    let b = breaks.find((x) => x.vehicleId === v.id);
    if (b && b.phase !== "driving") continue;
    if (b && s.tick < b.cooldownUntil) continue;
    if (!workRelease && (!serviceOpen(s, market) || market.stock.simit < 1)) continue;

    if (v.speed <= 0 && v.resumeSpeed === undefined) continue; // A breakdown is not a meal request.
    if (!b) {
      b = {
        bayId: "coast",
        personId: p.id,
        vehicleId: v.id,
        phase: "driving",
        originalLane: v.lane,
        workRelease,
        lastProgressAt: s.tick,
        lastPosition: { ...p.location },
        recoveryAttempts: 0,
        recoveryFor: null,
        cruiseSpeed: v.resumeSpeed ?? v.speed,
        routeProgress: 0,
        requestedAt: s.tick,
        expiresAt: s.tick + 12000,
        cooldownUntil: 0,
        lastMealTick: null,
        mealJoinedTick: null,
        outcome: "none",
      };
      breaks.push(b);
    }
    b.lastProgressAt = s.tick;
    b.lastPosition = { ...p.location };
    b.recoveryAttempts = 0;
    b.recoveryFor = null;
    delete b.resumeMark;
    b.phase = "seeking";
    b.workRelease = workRelease;
    b.originalLane = v.lane;
    b.cruiseSpeed = v.resumeSpeed ?? v.speed;
    b.requestedAt = s.tick;
    b.expiresAt = s.tick + 12000;
    b.mealJoinedTick = null;
    b.outcome = "none";
  }
  // Priority applies only when contenders can physically reach the same
  // free bay in this tick. A distant or blocked request can never veto a meal.
  const pending = breaks
    .filter((b) => b.phase === "seeking")
    .sort(
      (a, b) =>
        (a.lastMealTick ?? -1) - (b.lastMealTick ?? -1) ||
        a.requestedAt - b.requestedAt ||
        (a.personId < b.personId ? -1 : a.personId > b.personId ? 1 : 0),
    );
  let nextPending = 0;
  const order = breaks.map((b) => (b.phase === "seeking" ? pending[nextPending++] : b));
  for (const b of order) {
    const v = s.vehicles.find((v) => v.id === b.vehicleId),
      p = b.personId === "player" ? s.player : s.npcs.find((p) => p.id === b.personId);
    if (b.phase === "driving") continue;
    if (b.phase === "cancelled") {
      if (v) recoverParkedCar(s, b, v);
      continue;
    }
    if (b.phase === "disabled") {
      if (v && p) {
        if (resumeBlockedRoute(s, b, v, p)) {
          integrated.add(v.id);
          moveRoute(s, b, v, p);
        } else if (!p.alive && !v.driverId) {
          const bay = getBreakBay(b.bayId);
          const lot = s.mobility.parking.find((l) => l.id === bay.parkingId)!;
          if (
            distance(v.location, bay.point) <= 0.002 &&
            (!lot.vehicleIds.length || lot.vehicleIds.includes(v.id))
          ) {
            // The unoccupied body is already parked. Register the real slot so
            // a local recovery driver can walk to it; never move a dead car.
            lot.vehicleIds = [v.id];
            delete b.disabledPhase;
            delete b.suspendedOutcome;
            delete b.resumeMark;
            b.recoveryAttempts = 0;
            cancel(s, b, p);
          }
        }
      }
      continue;
    }
    const actor = v?.driverId === "player" ? s.player : p;
    if (
      actor &&
      (distance(actor.location, b.lastPosition) > 0.001 ||
        actor.location.scene !== b.lastPosition.scene)
    ) {
      b.lastPosition = { ...actor.location };
      b.lastProgressAt = s.tick;
    }
    if (
      s.tick - b.lastProgressAt >= 1800 &&
      ["toBay", "fromBay", "walkToMarket", "queue", "walkBack"].includes(b.phase)
    ) {
      if (v && (b.phase === "toBay" || b.phase === "fromBay")) {
        pauseBreakVehicle(s, v);
        v.speed = 0;
        delete v.resumeSpeed;
      } else if (p && (b.phase === "walkToMarket" || b.phase === "queue")) {
        if (b.outcome !== "fed") b.outcome = "unavailable";
        returnToCar(s, b, p);
      } else if (
        p?.alive &&
        b.phase === "walkBack" &&
        b.recoveryFor === null &&
        b.recoveryAttempts < 2
      ) {
        // Preserve the actual living driver on two independent route attempts.
        // A blocked doorway is not a death or a transfer of vehicle custody.
        b.recoveryAttempts++;
        b.lastProgressAt = s.tick;
        b.lastPosition = { ...p.location };
        p.path = [];
        p.destination = { ...getBreakBay(b.bayId).door };
        p.goal = "returnToCar";
        p.lastDecision = s.minute - 60;
      } else if (p?.alive && b.phase === "walkBack" && b.recoveryFor === null) {
        // Release the actor back to ordinary life while the route is unusable.
        // A living driver never loses their car solely because of a blocked path.
        pauseWalkingReturn(s, b, p);
      } else cancel(s, b, p);
      continue;
    }
    if (
      v &&
      (b.phase === "toBay" || b.phase === "fromBay") &&
      v.driverId === "player" &&
      b.outcome === "cancelled"
    ) {
      integrated.add(v.id);
      moveRoute(s, b, v, s.player);
      continue;
    }
    if (v && (b.phase === "toBay" || b.phase === "fromBay") && !p?.alive) {
      b.disabledPhase = b.phase;
      b.phase = "disabled";
      b.outcome = "cancelled";
      v.driverId = null;
      v.speed = 0;
      delete v.resumeSpeed;
      continue;
    }
    if (!v || !p?.alive || (detached(b) ? !!v.driverId : v.driverId !== p.id)) {
      cancel(s, b, p);
      continue;
    }
    if (b.phase === "seeking") {
      if (
        s.tick >= b.expiresAt ||
        (!b.workRelease &&
          (!serviceOpen(s, market) ||
            market.stock.simit < 1 ||
            s.accounts[p.id] < market.prices.simit))
      ) {
        b.phase = "driving";
        b.outcome = s.accounts[p.id] < market.prices.simit ? "unaffordable" : "unavailable";
        b.cooldownUntil = s.tick + 600;
        continue;
      }
      const available = (bay: (typeof DRIVER_BAYS)[number]) => {
        const lot = s.mobility.parking.find((l) => l.id === bay.parkingId);
        return (
          !!lot &&
          !lot.vehicleIds.length &&
          !breaks.some((other) => other !== b && other.bayId === bay.id && claimsBay(s, other))
        );
      };
      const candidate = DRIVER_BAYS.find((bay) => {
        if (!bay.lanes.includes(v.lane) || !available(bay)) return false;
        // Keep the dedicated overflow position for severe hunger when the
        // ordinary nearby bay is really occupied or reserved.
        if (bay.id === "westSouth" && (p.hunger < 96 || available(getBreakBay("west"))))
          return false;
        const entry = breakEntry(v.lane, bay.id),
          advance = (entry.progress - v.progress + laneLength(v.lane)) % laneLength(v.lane);
        return (
          advance <= Math.max(0.001, v.speed * 0.1) &&
          bodyClear(s, v, breakRoutePose("toBay", v.lane, 0, bay.id)) &&
          (bay.id !== "east" ||
            !guardedEastIngress ||
            clearRouteCorridor(s, v, breakRoute("toBay", v.lane, bay.id)))
        );
      });
      if (!candidate) continue;
      b.bayId = candidate.id;
      const entry = breakEntry(v.lane, b.bayId),
        pose = breakRoutePose("toBay", v.lane, 0, b.bayId);
      // Clamp at the authored approach in this tick; the standard traffic step
      // is skipped once ownership transfers, so no second integration occurs.
      v.location = { x: pose.x, y: pose.y, scene: "outside" };
      v.heading = pose.heading;
      p.location = { ...v.location };
      v.progress = entry.progress;
      v.speed = 0;
      delete v.resumeSpeed;
      b.phase = "toBay";
      b.routeProgress = 0;
      integrated.add(v.id);
      continue;
    }
    if (b.phase === "toBay" || b.phase === "fromBay") {
      integrated.add(v.id);
      moveRoute(s, b, v, p);
      continue;
    }
    if (b.phase === "awaitReturn") {
      retryWalkingReturn(s, b, p);
      continue;
    }
    if (b.phase === "routine") {
      if (s.tick >= b.expiresAt) {
        b.outcome = "unaffordable";
        returnToCar(s, b, p);
        continue;
      }
      // The ordinary society routine and attendance/payroll systems own this
      // interval. No driving wage, free meal or synthetic credit is introduced.
      if (
        (serviceOpen(s, market) || canWalkBeforeOpening(b)) &&
        market.stock.simit > 0 &&
        s.accounts[p.id] >= market.prices.simit
      ) {
        b.phase = "walkToMarket";
        b.lastProgressAt = s.tick;
        b.lastPosition = { ...p.location };
        b.expiresAt = s.tick + 6000;
        p.goal = "eat";
        p.lastDecision = s.minute - 60;
        if (p.location.scene === "outside")
          walk(s, p, BUILDINGS.find((x) => x.id === "b-market")!.door, "eat");
      }
      continue;
    }
    if (b.phase === "walkToMarket") {
      if (
        s.tick >= b.expiresAt ||
        (!serviceOpen(s, market) && !canWalkBeforeOpening(b)) ||
        market.stock.simit < 1 ||
        s.accounts[p.id] < market.prices.simit
      ) {
        b.outcome = s.accounts[p.id] < market.prices.simit ? "unaffordable" : "unavailable";
        returnToCar(s, b, p);
        continue;
      }
      if (
        p.location.scene === "b-market" ||
        distance(p.location, BUILDINGS.find((x) => x.id === "b-market")!.door) <= 1.5
      ) {
        // Travel can start before opening, but joining the line, paying, and
        // consuming remain guarded by the actual market's opening hours.
        if (!serviceOpen(s, market)) continue;
        p.goal = "eat";
        requestNpcMeal(s, p);
        const q = s.economy.services.market.queue.find((q) => q.personId === p.id);
        if (q) {
          b.mealJoinedTick = Number(q.id.split(":").at(-1));
          b.phase = "queue";
        }
      } else if (!p.path.length && p.location.scene === "outside")
        walk(s, p, BUILDINGS.find((x) => x.id === "b-market")!.door, "eat");
    } else if (b.phase === "queue") {
      if (mealSettled(s, b)) {
        const alreadyServedOnBreak = b.outcome === "fed";
        b.lastMealTick =
          s.ledger.find((e) => e.id === `meal:v5:market:${b.mealJoinedTick}:${b.personId}`)?.tick ??
          s.tick - 1;
        b.outcome = "fed";
        if (
          !alreadyServedOnBreak &&
          p.hunger >= 56 &&
          serviceOpen(s, market) &&
          market.stock.simit > 0 &&
          s.accounts[p.id] >= market.prices.simit
        ) {
          // One additional serving for serious remaining hunger. Rejoin the
          // same FIFO from the tail and settle as a separate real purchase.
          b.mealJoinedTick = null;
          requestNpcMeal(s, p);
          if (b.mealJoinedTick !== null) continue;
        }
        returnToCar(s, b, p);
      } else if (
        s.tick >= b.expiresAt ||
        !serviceOpen(s, market) ||
        market.stock.simit < 1 ||
        s.accounts[p.id] < market.prices.simit
      ) {
        if (b.outcome !== "fed")
          b.outcome = s.accounts[p.id] < market.prices.simit ? "unaffordable" : "unavailable";
        returnToCar(s, b, p);
      } else {
        p.goal = "eat";
        requestNpcMeal(s, p);
        const q = s.economy.services.market.queue.find((q) => q.personId === p.id);
        if (q) b.mealJoinedTick = Number(q.id.split(":").at(-1));
      }
    } else if (b.phase === "walkBack") {
      if (
        p.location.scene === "outside" &&
        distance(p.location, getBreakBay(b.bayId).door) < 0.15
      ) {
        const lot = s.mobility.parking.find((l) => l.id === getBreakBay(b.bayId).parkingId)!;
        if (
          !lot.vehicleIds.includes(v.id) ||
          distance(v.location, getBreakBay(b.bayId).point) > 0.002
        ) {
          cancel(s, b, p);
          continue;
        }
        lot.vehicleIds = lot.vehicleIds.filter((id) => id !== v.id);
        v.driverId = p.id;
        v.speed = 0;
        p.location = { ...v.location };
        p.path = [];
        p.destination = null;
        p.goal = "drive";
        if (b.recoveryFor === null) b.recoveryAttempts = 0;
        delete b.resumeMark;
        b.phase = "fromBay";
        b.routeProgress = 0;
      } else if (p.location.scene === "outside" && !p.path.length)
        walk(s, p, getBreakBay(b.bayId).door, "returnToCar");
    }
  }
  s.mobility.driverBreaks = breaks.filter(
    (b) =>
      s.vehicles.some((v) => v.id === b.vehicleId) &&
      (b.personId === "player" || s.npcs.some((p) => p.id === b.personId)),
  );
  return integrated;
}

/** A player boarding a parked break car keeps its physical pose and follows the
 * guarded bay exit before ordinary road controls resume. No unpark teleport. */
export function pauseBreakVehicle(s: WorldState, v: Vehicle): void {
  const b = routeBreak(s, v.id);
  if (!b || b.phase === "disabled") return;
  b.disabledPhase = b.phase as "toBay" | "fromBay";
  b.suspendedOutcome = b.outcome;
  b.cooldownUntil = s.tick + 30;
  b.phase = "disabled";
  b.outcome = "cancelled";
}

export function takeBreakVehicle(s: WorldState, v: Vehicle): boolean {
  let b = (s.mobility.driverBreaks ?? []).find((b) => b.vehicleId === v.id);
  if (
    !b &&
    s.mobility.parking.some((l) => l.id === STARTER_BAY.parkingId && l.vehicleIds.includes(v.id)) &&
    distance(v.location, STARTER_BAY.point) < 0.002
  ) {
    b = {
      bayId: "starter",
      personId: "player",
      vehicleId: v.id,
      phase: "fromBay",
      originalLane: 0,
      workRelease: false,
      lastProgressAt: s.tick,
      lastPosition: { ...v.location },
      recoveryAttempts: 0,
      recoveryFor: null,
      cruiseSpeed: 1.2,
      routeProgress: 0,
      requestedAt: s.tick,
      expiresAt: s.tick + 1800,
      cooldownUntil: 0,
      lastMealTick: null,
      mealJoinedTick: null,
      outcome: "cancelled",
    };
    (s.mobility.driverBreaks ?? (s.mobility.driverBreaks = [])).push(b);
  }
  if (!b) return false;
  const parked = s.mobility.parking.find((l) => l.id === getBreakBay(b.bayId).parkingId);
  if (!detached(b) && b.phase !== "disabled" && !parked?.vehicleIds.includes(v.id)) return false;
  const p = s.npcs.find((n) => n.id === b.personId);
  if (p?.alive) {
    p.goal = "idle";
    p.lastDecision = s.minute - 60;
    p.path = [];
    p.destination = null;
  }
  if (b.phase === "disabled") {
    b.phase = b.disabledPhase!;
    delete b.disabledPhase;
    delete b.suspendedOutcome;
  } else {
    b.phase = "fromBay";
    b.originalLane = getBreakBay(b.bayId).lanes.includes(1) ? 1 : 0;
    b.routeProgress = 0;
  }
  b.outcome = "cancelled";
  const lot = s.mobility.parking.find((l) => l.id === getBreakBay(b.bayId).parkingId)!;
  lot.vehicleIds = lot.vehicleIds.filter((id) => id !== v.id);
  return true;
}

export function validateDriverBreaks(s: WorldState): string[] {
  const errors: string[] = [],
    people = new Set<string>(),
    vehicles = new Set<string>();
  const phases = [
    "driving",
    "seeking",
    "toBay",
    "walkToMarket",
    "queue",
    "walkBack",
    "awaitReturn",
    "fromBay",
    "cancelled",
    "disabled",
    "routine",
  ];
  const breaks = s.mobility.driverBreaks;
  if (!Array.isArray(breaks) || breaks.length > s.vehicles.length) return ["invalid-driver-breaks"];
  const reservations = new Map<string, number>();
  for (const b of breaks) {
    if (!b || typeof b !== "object") {
      errors.push("invalid-driver-break:record");
      continue;
    }
    const p = b.personId === "player" ? s.player : s.npcs.find((n) => n.id === b.personId),
      v = s.vehicles.find((v) => v.id === b.vehicleId);
    if (
      !p ||
      !v ||
      !ALL_BREAK_BAYS.some((bay) => bay.id === b.bayId) ||
      !s.mobility.parking.some((lot) => lot.id === getBreakBay(b.bayId).parkingId) ||
      (b.personId === "player" &&
        (b.bayId !== "starter" ||
          b.vehicleId !== "v0" ||
          !["fromBay", "disabled", "cancelled"].includes(b.phase))) ||
      (b.bayId === "starter" && b.personId !== "player") ||
      typeof b.workRelease !== "boolean" ||
      people.has(b.personId) ||
      vehicles.has(b.vehicleId) ||
      !phases.includes(b.phase) ||
      !Number.isFinite(b.routeProgress) ||
      b.routeProgress < 0 ||
      !Number.isInteger(b.originalLane) ||
      b.originalLane < 0 ||
      b.originalLane > 3 ||
      !Number.isFinite(b.cruiseSpeed) ||
      b.cruiseSpeed <= 0 ||
      b.cruiseSpeed > 6 ||
      ![b.requestedAt, b.expiresAt, b.cooldownUntil, b.lastProgressAt].every(
        (n) => Number.isSafeInteger(n) && n >= 0,
      ) ||
      b.requestedAt > s.tick ||
      b.lastProgressAt > s.tick ||
      !Number.isInteger(b.recoveryAttempts) ||
      b.recoveryAttempts < 0 ||
      b.recoveryAttempts > 3 ||
      (b.resumeMark !== undefined &&
        (!Number.isFinite(b.resumeMark) || b.resumeMark < 0 || b.resumeMark > b.routeProgress)) ||
      !b.lastPosition ||
      !isWalkable(b.lastPosition, b.lastPosition.scene) ||
      (b.recoveryFor !== null && !s.npcs.some((p) => p.id === b.recoveryFor)) ||
      ![b.lastMealTick, b.mealJoinedTick].every(
        (n) => n === null || (Number.isSafeInteger(n) && n >= 0 && n <= s.tick),
      ) ||
      !["none", "fed", "unaffordable", "unavailable", "cancelled"].includes(b.outcome) ||
      (b.suspendedOutcome !== undefined &&
        (b.phase !== "disabled" ||
          !["none", "fed", "unaffordable", "unavailable", "cancelled"].includes(
            b.suspendedOutcome,
          ))) ||
      (b.phase === "disabled" && v?.speed !== 0)
    ) {
      errors.push("invalid-driver-break:" + b.personId);
      continue;
    }
    people.add(b.personId);
    vehicles.add(b.vehicleId);
    if (claimsBay(s, b)) reservations.set(b.bayId, (reservations.get(b.bayId) ?? 0) + 1);
    if (b.phase === "toBay" || b.phase === "fromBay" || b.phase === "disabled") {
      const phase = b.phase === "disabled" ? b.disabledPhase : b.phase;
      if (!getBreakBay(b.bayId).lanes.includes(b.originalLane)) {
        errors.push("invalid-driver-break-route:" + b.personId);
        continue;
      }
      if (
        (phase !== "toBay" && phase !== "fromBay") ||
        !Number.isFinite(b.routeProgress) ||
        b.routeProgress < 0 ||
        b.routeProgress > breakRoute(phase, b.originalLane, b.bayId).length ||
        (b.phase === "disabled"
          ? v?.driverId !== null && v?.driverId !== p?.id && v?.driverId !== "player"
          : v?.driverId !== p?.id && !(v?.driverId === "player" && b.outcome === "cancelled")) ||
        distance(v!.location, breakRoutePose(phase!, b.originalLane, b.routeProgress, b.bayId)) >
          0.002
      )
        errors.push("invalid-driver-break-route:" + b.personId);
    }
    if (
      detached(b) &&
      (!s.mobility.parking
        .find((l) => l.id === getBreakBay(b.bayId).parkingId)
        ?.vehicleIds.includes(b.vehicleId) ||
        v?.driverId ||
        distance(v!.location, getBreakBay(b.bayId).point) > 0.002)
    )
      errors.push("invalid-driver-break-parked:" + b.personId);
  }
  if ([...reservations.values()].some((count) => count > 1))
    errors.push("duplicate-driver-bay-reservation");
  return errors;
}
