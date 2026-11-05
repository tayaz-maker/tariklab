import { pedestrianCrossingTraffic } from "./pedestrian-crossing.ts";
import { pedestrianApproachClear, personVehicleSeparation } from "./vehicle-collision.ts";
import { getBreakBay, WEST_OVERFLOW_PARKING_ID } from "../domain/driver-breaks.ts";
import { requestNpcMeal, serviceOpen } from "./services.ts";
import {
  scheduleBackgroundTravel,
  closeAttendanceDay,
  attendedWage,
  produceBusiness,
  economyDayEnd,
} from "./economy.ts";
import type { Person, WorldState } from "../domain/types.ts";
import { JOBS } from "../domain/content.ts";
import { BUILDINGS, hasLineOfSight, moveWithCollision } from "../domain/world.ts";
import { BUILDING_FOR_BUSINESS } from "./population.ts";
import { adjustRelation, emit, notify } from "./events.ts";
import { transfer } from "./ledger.ts";
import { clamp, draw } from "./random.ts";
import { canonicalHeading } from "../domain/traffic.ts";
import { npcMovementTraits } from "./npc-traits.ts";
import {
  pedestrianPath,
  pedestrianCurbReliefPoint,
  pedestrianSegment,
  pedestrianWalkable,
  pedestrianYieldPoint,
} from "./pedestrian-navigation.ts";

function routineTarget(
  state: WorldState,
  npc: Person,
  index: number,
): { goal: string; building: string } {
  const traits = npcMovementTraits(state.seed, npc.id);
  const minute = (((state.minute - traits.scheduleOffset) % 1440) + 1440) % 1440;
  if (npc.age < 18)
    return {
      goal: npc.age >= 6 && minute >= 480 && minute < 900 ? "school" : "care",
      building: npc.age >= 6 && minute >= 480 && minute < 900 ? "b-school" : "b-home",
    };
  if (npc.health < 35) return { goal: "heal", building: "b-clinic" };
  const market = state.businesses.find((b) => b.id === "market");
  if (
    npc.hunger > 75 &&
    market &&
    serviceOpen(state, market) &&
    market.stock.simit > 0 &&
    state.accounts[npc.id] >= market.prices.simit
  )
    return { goal: "eat", building: "b-market" };
  // An unaffordable food errand cannot preempt work forever. Keep the normal
  // paid schedule until an actual purchase is possible; never invent a meal or money.
  if (minute < 6 * 60 || minute >= 22 * 60) return { goal: "sleep", building: "b-home" };
  if (!npc.jobId) return { goal: "seekJob", building: "b-office" };
  if (minute >= 9 * 60 && minute < 17 * 60)
    return {
      goal: "work",
      building: BUILDING_FOR_BUSINESS[npc.employerId ?? "market"] ?? "b-market",
    };
  return {
    goal: "socialize",
    building: ["b-cafe", "b-restaurant", "b-sales", "b-security"][traits.socialVenue],
  };
}
export function npcMovement(state: WorldState): void {
  const actors = state.npcs.slice(0, 100);
  const canRecoverStalledPath = state.mobility.parking.some(
    (lot) => lot.id === WEST_OVERFLOW_PARKING_ID,
  );
  const drivers = new Set(state.vehicles.map((v) => v.driverId));
  const crossingTraffic = pedestrianCrossingTraffic(state, actors, drivers);
  // Static bodies can block an entire narrow crosswalk (including the starter
  // car). Route around them using another legal crossing rather than waiting forever.
  const staticBodies = state.vehicles
    .filter((v) => !v.driverId || v.speed === 0)
    .map((v) => ({ ...v.location, heading: v.heading }));
  const vehicleBodies = state.vehicles.map((v) => ({ ...v.location, heading: v.heading }));
  const physicalRoutes = new Set(
    state.mobility.driverBreaks
      ?.filter((b) => ["toBay", "fromBay", "disabled"].includes(b.phase))
      .map((b) => b.vehicleId) ?? [],
  );
  const pressureVehicles = state.vehicles.filter(
    (v) => v.driverId && (v.speed > 0 || v.resumeSpeed !== undefined || physicalRoutes.has(v.id)),
  );
  const roadPressure = pressureVehicles.map((v) => ({ ...v.location, heading: v.heading }));
  const stoppedPressure = pressureVehicles
    .filter((v) => v.speed === 0)
    .map((v) => ({ ...v.location, heading: v.heading }));
  const doorsUsed = new Set<string>();
  const canUseDoor = (building: (typeof BUILDINGS)[number]) =>
    !doorsUsed.has(building.id) &&
    state.tick - Number(state.flags[`npcDoorTick:${building.id}`] ?? -6) >= 6;
  const occupied = (npc: Person, p: { x: number; y: number }, scene: string) =>
    actors.some(
      (other) =>
        other.id !== npc.id &&
        other.alive &&
        !drivers.has(other.id) &&
        other.location.scene === scene &&
        Math.hypot(other.location.x - p.x, other.location.y - p.y) < 0.5 &&
        Math.hypot(other.location.x - p.x, other.location.y - p.y) <
          Math.hypot(other.location.x - npc.location.x, other.location.y - npc.location.y) - 0.0001,
    ) ||
    (state.player.location.scene === scene &&
      !drivers.has("player") &&
      Math.hypot(state.player.location.x - p.x, state.player.location.y - p.y) < 0.5 &&
      Math.hypot(state.player.location.x - p.x, state.player.location.y - p.y) <
        Math.hypot(
          state.player.location.x - npc.location.x,
          state.player.location.y - npc.location.y,
        ) -
          0.0001);
  // Rotate priority deterministically, so the same array prefix cannot monopolize doors.
  for (let offset = 0; offset < actors.length; offset++) {
    const index = (offset + Math.floor(state.tick / 6)) % actors.length,
      npc = actors[index];
    if (!npc.alive || drivers.has(npc.id) || npc.goal === "drive") continue;
    if (npc.id === "n0" && state.minute < 490) continue;
    const traits = npcMovementTraits(state.seed, npc.id);
    const near =
      npc.location.scene === state.player.location.scene &&
      Math.hypot(
        npc.location.x - state.player.location.x,
        npc.location.y - state.player.location.y,
      ) < 16;
    if (!near && state.tick % 10 !== Math.floor(traits.phase * 10)) continue;
    if (
      state.minute >= npc.lastDecision + 20 &&
      (!npc.path.length || state.minute >= npc.lastDecision + 60)
    ) {
      const activeBreak = state.mobility.driverBreaks?.find(
        (b) => b.personId === npc.id && ["walkToMarket", "queue", "walkBack"].includes(b.phase),
      );
      const plan = activeBreak
          ? {
              goal: activeBreak.phase === "walkBack" ? "returnToCar" : "eat",
              building: activeBreak.phase === "walkBack" ? "outside" : "b-market",
            }
          : routineTarget(state, npc, index),
        target =
          plan.building === "outside"
            ? { id: "outside", door: getBreakBay(activeBreak!.bayId).door }
            : BUILDINGS.find((b) => b.id === plan.building)!;
      if (npc.location.scene !== "outside") {
        if (npc.location.scene === target.id) {
          npc.goal = plan.goal;
          npc.lastDecision = state.minute;
          continue;
        }
        const current = BUILDINGS.find((b) => b.id === npc.location.scene);
        if (
          !current ||
          !canUseDoor(current) ||
          actors.some(
            (p) =>
              p.alive &&
              p.location.scene === "outside" &&
              !drivers.has(p.id) &&
              Math.hypot(p.location.x - current.door.x, p.location.y - current.door.y) < 0.6,
          ) ||
          (state.player.location.scene === "outside" &&
            Math.hypot(
              state.player.location.x - current.door.x,
              state.player.location.y - current.door.y,
            ) < 0.6)
        )
          continue;
        npc.location = { ...current.door, scene: "outside" };
        doorsUsed.add(current.id);
        state.flags[`npcDoorTick:${current.id}`] = state.tick;
      }
      npc.lastDecision = state.minute;
      npc.goal = plan.goal;
      npc.destination = { ...target.door };
      npc.path = pedestrianPath(npc.location, target.door, staticBodies);
    }
    if (npc.location.scene !== "outside") continue;
    if (
      npc.path.length &&
      pedestrianWalkable(npc.location) &&
      !pedestrianSegment(npc.location, npc.path[0], staticBodies) &&
      npc.destination
    )
      npc.path = pedestrianPath(npc.location, npc.destination, staticBodies);
    const recoveryUntilKey = `npcAvoidUntil:${npc.id}`,
      recoveryHeadingKey = `npcAvoidHeading:${npc.id}`;
    if (
      Number(state.flags[recoveryUntilKey] ?? 0) &&
      state.tick >= Number(state.flags[recoveryUntilKey])
    ) {
      delete state.flags[recoveryUntilKey];
      delete state.flags[recoveryHeadingKey];
      if (npc.destination) npc.path = pedestrianPath(npc.location, npc.destination, staticBodies);
    }
    // Far walkers are already staggered by their movement slot. Applying
    // another identity slot here can make the two schedules never intersect.
    const yieldSlot =
      npc.destination && (!near || (state.tick + Number(npc.id.slice(1))) % 10 === 0);
    const localYield = (relieveCurb: boolean) => {
      const people = [state.player, ...actors]
        .filter(
          (other) =>
            other.id !== npc.id &&
            other.alive &&
            other.location.scene === "outside" &&
            !drivers.has(other.id),
        )
        .map((other) => other.location);
      const away =
        pedestrianYieldPoint(
          npc.location,
          roadPressure,
          vehicleBodies,
          people,
          relieveCurb ? 0.15 : 0.02,
        ) ??
        (relieveCurb &&
        roadPressure.some(
          (car) => Math.hypot(car.x - npc.location.x, car.y - npc.location.y) <= 3.2,
        )
          ? pedestrianCurbReliefPoint(npc.location, vehicleBodies, people)
          : null);
      if (!away) return false;
      npc.path = [away];
      return true;
    };
    const hadRoute = npc.path.length > 0;
    if (!hadRoute && yieldSlot) localYield(true);
    const beforeX = npc.location.x,
      beforeY = npc.location.y;
    let budget = (near ? 0.105 : 1.05) * traits.speed;
    // Every LOD step uses the same collision and crossing rules, without tunnelling.
    while (budget > 0.00001 && npc.path.length) {
      const retreat = crossingTraffic.retreat(npc);
      const target = retreat ?? npc.path[0],
        dx = target.x - npc.location.x,
        dy = target.y - npc.location.y,
        distance = Math.hypot(dx, dy);
      if (distance < 0.00001) {
        if (retreat) break;
        npc.path.shift();
        continue;
      }
      const recovering = state.tick < Number(state.flags[recoveryUntilKey] ?? 0);
      const step = Math.min(0.1, budget, recovering ? 0.1 : distance),
        angle = recovering ? Number(state.flags[recoveryHeadingKey]) : Math.atan2(dy, dx);
      let moved = false;
      const side = traits.phase < 0.5 ? 1 : -1;
      const turns = recovering
        ? [0, 0.65, -0.65, 1.2, -1.2]
        : [
            0,
            0.65,
            -0.65,
            1.2,
            -1.2,
            (side * Math.PI) / 2,
            (-side * Math.PI) / 2,
            side * 2.2,
            -side * 2.2,
            Math.PI,
          ];
      for (const turn of turns) {
        const next = moveWithCollision(npc.location, {
          x: Math.cos(angle + turn) * step,
          y: Math.sin(angle + turn) * step,
        });
        if (
          Math.hypot(next.x - npc.location.x, next.y - npc.location.y) < step * 0.8 ||
          (pedestrianWalkable(npc.location) && !pedestrianSegment(npc.location, next)) ||
          occupied(npc, next, "outside") ||
          state.vehicles.some(
            (v) =>
              !drivers.has(npc.id) &&
              v.location.scene === "outside" &&
              !pedestrianApproachClear(v, npc.location, next),
          ) ||
          !crossingTraffic.mayWalk(npc, next)
        )
          continue;
        npc.location.x = next.x;
        npc.location.y = next.y;
        moved = true;
        if (!recovering && Math.abs(turn) >= Math.PI / 2) {
          // Keep the escape heading briefly: reconsidering the blocked goal on
          // the next step would make two opposing walkers bounce in lockstep.
          state.flags[recoveryHeadingKey] = canonicalHeading(angle + turn);
          state.flags[recoveryUntilKey] = state.tick + 20 + Math.floor(traits.phase * 20);
        }
        if (!retreat && !recovering && turn === 0 && distance <= step + 0.00001) npc.path.shift();
        break;
      }
      if (!moved) break;
      budget -= step;
    }
    // A remaining route can still be physically stalled. Only reroute when
    // every step failed and an actual stopped bumper is immediately adjacent.
    if (
      canRecoverStalledPath &&
      hadRoute &&
      yieldSlot &&
      npc.path.length &&
      Math.hypot(npc.location.x - beforeX, npc.location.y - beforeY) < 0.0001 &&
      stoppedPressure.some((car) => personVehicleSeparation(npc.location, car) < 0.035) &&
      localYield(false)
    ) {
      delete state.flags[recoveryUntilKey];
      delete state.flags[recoveryHeadingKey];
    }
    if (
      npc.destination &&
      Math.hypot(npc.location.x - npc.destination.x, npc.location.y - npc.destination.y) < 0.6
    ) {
      const building = BUILDINGS.find(
        (b) => Math.hypot(b.door.x - npc.destination!.x, b.door.y - npc.destination!.y) < 0.01,
      );
      if (building && canUseDoor(building)) {
        npc.location = { x: 4 + (index % 5), y: 6 + (index % 3), scene: building.id };
        npc.destination = null;
        npc.path = [];
        doorsUsed.add(building.id);
        state.flags[`npcDoorTick:${building.id}`] = state.tick;
      }
    }
  }
}
export function societyMinute(state: WorldState): void {
  if (state.minute % 60 === 0) {
    const hour = state.minute % 1440;
    for (let index = 0; index < state.npcs.length; index++) {
      const npc = state.npcs[index];
      if (!npc.alive) continue;
      if (npc.age < 18) {
        const plan = routineTarget(state, npc, index);
        scheduleBackgroundTravel(state, npc, plan, index);
        npc.hunger = clamp(npc.hunger + 2);
        npc.fatigue = clamp(npc.fatigue + (hour < 360 || hour >= 1200 ? -15 : 1));
        continue;
      }
      npc.hunger = clamp(npc.hunger + 4);
      npc.fatigue = clamp(npc.fatigue + 3);
      if (npc.goal === "sleep") npc.fatigue = clamp(npc.fatigue - 22);
      if (npc.goal === "heal") npc.health = clamp(npc.health + 15);
      if (!npc.local) {
        const plan = routineTarget(state, npc, index);
        scheduleBackgroundTravel(state, npc, plan, index);
      }
      requestNpcMeal(state, npc);
      if (hour >= 1200 && hour < 1260 && index < 100) {
        const friend = state.npcs[(index + 1) % 100];
        if (friend.alive && friend.age >= 18 && friend.location.scene === npc.location.scene)
          adjustRelation(state, npc.id, friend.id, 1, 1);
      }
    }
  }
  // Physical arrivals happen between schedule hours. Let locals join the real
  // FIFO service queue each minute rather than starving beside an open counter
  // until the next synchronized hourly request burst.
  if (state.minute % 60 !== 0)
    for (const npc of state.npcs.slice(0, 100)) requestNpcMeal(state, npc);
  if (state.minute % 1440 === 0) dailyEconomy(state);
}
export function dailyEconomy(state: WorldState): void {
  const day = Math.floor(state.minute / 1440);
  state.flags.day = day;
  closeAttendanceDay(state);
  for (const business of state.businesses) {
    if (business.status === "closed") continue;
    const revenue = Math.floor(
      (70000 +
        business.employees.length *
          (10000 + (draw(state.seed, 40, day, business.id.length) % 6000))) *
        (business.status === "distressed" ? 0.6 : 1) *
        (state.mobility.weather.kind === "rain"
          ? 0.96
          : state.mobility.weather.kind === "wind"
            ? 0.98
            : 1),
    );
    transfer(
      state,
      `trade:${day}:${business.id}`,
      "external",
      `business:${business.id}`,
      revenue,
      "external-trade",
    );
    if (
      state.accounts[`business:${business.id}`] <
      (business.employees.length * business.wage) / 2
    ) {
      business.status = "closed";
      emit(
        state,
        "business_closed",
        `${BUILDINGS.find((b) => b.id === business.buildingId)!.name} maaş yükünü karşılayamadığı için faaliyetini durdurdu.`,
        [business.ownerId],
        business.id,
      );
      if (state.player.employerId === business.id) {
        state.player.employerId = null;
        state.player.jobId = null;
        state.player.shift = null;
        business.employees = business.employees.filter((id) => id !== "player");
        notify(state, "İşyerin kapandı. Yeni iş ilanları, eğitim ve dayanışma desteği açık.");
      }
      continue;
    }
    produceBusiness(state, business);
  }
  for (let index = 0; index < state.npcs.length; index++) {
    const npc = state.npcs[index];
    if (!npc.alive || npc.age < 18) continue;
    if (npc.employerId && npc.jobId) {
      const employer = state.businesses.find((business) => business.id === npc.employerId)!;
      const wage = attendedWage(
        state,
        npc,
        employer.status === "distressed" ? Math.floor(employer.wage * 0.7) : employer.wage,
      );
      if (
        employer.status !== "closed" &&
        wage > 0 &&
        transfer(
          state,
          `salary:${day}:${npc.id}`,
          `business:${employer.id}`,
          npc.id,
          wage,
          "npc-payroll",
        )
      )
        npc.income += wage;
      else if (employer.status === "closed" || wage > 0) {
        employer.employees = employer.employees.filter((id) => id !== npc.id);
        npc.jobId = null;
        npc.employerId = null;
        if (index < 100) emit(state, "layoff", `${npc.name} yeni bir iş arıyor.`, [npc.id]);
      }
    } else {
      const candidate = state.businesses.filter((business) => business.status === "open")[
        draw(state.seed, 42, day, index) %
          state.businesses.filter((business) => business.status === "open").length
      ];
      const job = candidate && JOBS.find((item) => item.businessId === candidate.id);
      if (candidate && job) {
        npc.jobId = job.id;
        npc.employerId = candidate.id;
        candidate.employees.push(npc.id);
        if (index < 100)
          emit(state, "job_changed", `${npc.name}, ${job.name} olarak işe başladı.`, [npc.id]);
      } else
        transfer(
          state,
          `support:${day}:${npc.id}`,
          "municipality",
          npc.id,
          2000,
          "subsistence-support",
        );
    }
    if (
      state.accounts[npc.id] < 10000 &&
      npc.debt < 30000 &&
      npc.jobId &&
      transfer(state, `npc-loan:${day}:${npc.id}`, "bank", npc.id, 10000, "npc-emergency-loan")
    ) {
      npc.debt += 10000;
      state.flags[`loanAsset:${npc.id}`] = Number(state.flags[`loanAsset:${npc.id}`] ?? 0) + 10000;
    }
    if (npc.debt > 0 && day % 7 === 0) {
      const interest = Math.ceil(npc.debt / 100);
      npc.debt += interest;
      state.flags[`loanAsset:${npc.id}`] =
        Number(state.flags[`loanAsset:${npc.id}`] ?? 0) + interest;
      const payment = Math.min(npc.debt, Math.max(0, state.accounts[npc.id] - 100000), 10000);
      if (
        payment &&
        transfer(state, `debt:${day}:${npc.id}`, npc.id, "bank", payment, "debt-payment")
      ) {
        npc.debt -= payment;
        state.flags[`loanAsset:${npc.id}`] = Number(state.flags[`loanAsset:${npc.id}`]) - payment;
      }
    }
  }
  if (day % 7 === 0) {
    if (state.player.debt > 0) {
      const interest = Math.ceil(state.player.debt / 100);
      state.player.debt += interest;
      state.flags.loanAsset = Number(state.flags.loanAsset ?? 0) + interest;
      state.flags.debtInterest = Number(state.flags.debtInterest) + interest;
      emit(
        state,
        "loan_due",
        `Haftalık %1 oyun faizi: ${(interest / 100).toFixed(2)} TL.`,
        ["player"],
        null,
        "private",
      );
    }
  }
  // Deterministic social shocks are caused by market pressure, with bounded duration and actual wages affected.
  const affected =
    state.businesses[draw(state.seed, 43, Math.floor(day / 3)) % state.businesses.length];
  if (day % 3 === 0 && affected.status !== "closed") {
    affected.status = "distressed";
    emit(
      state,
      "business_distress",
      `${BUILDINGS.find((b) => b.id === affected.buildingId)!.name} talep daralması yaşıyor; yeni vardiyaların ücreti %30 azaldı.`,
      [affected.ownerId],
    );
    if (state.player.employerId === affected.id)
      notify(
        state,
        "İşyerindeki daralma yeni vardiya ücretini düşürdü. İstifa, eğitim veya işletmeyi devralma seçeneklerin açık.",
      );
  }
  if (day % 3 === 2)
    for (const business of state.businesses)
      if (
        business.status === "distressed" &&
        state.accounts[`business:${business.id}`] > business.wage * 3
      )
        business.status = "open";
  if (day % 5 === 0) {
    state.flags.vehicleWear = true;
    state.vehicles[2].speed = 0;
    delete state.vehicles[2].resumeSpeed;
    emit(state, "vehicle_breakdown", "Taksi filosunda bakım ihtiyacı oluştu.", ["n2"]);
  }
  if (day % 2 === 0) {
    const a = state.npcs[day % 100],
      b = state.npcs[(day + 1) % 100];
    if (a.alive && b.alive && a.age >= 18 && b.age >= 18)
      adjustRelation(state, a.id, b.id, -5, 0, 0, 12);
  }
  // Conflict follows a particular witnessed dispute; unemployment is never a crime trigger.
  if (day % 7 === 0) {
    const conflict = state.relations.find(
      (edge) =>
        edge.from !== "player" &&
        edge.to !== "player" &&
        edge.resentment >= 20 &&
        edge.trust <= -10,
    );
    if (conflict) {
      const offender = state.npcs.find((n) => n.id === conflict.from),
        victim = state.npcs.find((n) => n.id === conflict.to);
      if (
        offender?.alive &&
        victim?.alive &&
        offender.age >= 18 &&
        victim.age >= 18 &&
        offender.location.scene === victim.location.scene &&
        Math.hypot(
          offender.location.x - victim.location.x,
          offender.location.y - victim.location.y,
        ) <= 3 &&
        hasLineOfSight(offender.location, victim.location, offender.location.scene)
      ) {
        const witnesses = state.npcs
          .slice(0, 100)
          .filter(
            (npc) =>
              npc.alive &&
              npc.age >= 18 &&
              npc.id !== offender.id &&
              npc.id !== victim.id &&
              npc.location.scene === offender.location.scene &&
              Math.hypot(npc.location.x - victim.location.x, npc.location.y - victim.location.y) <=
                8 &&
              hasLineOfSight(npc.location, victim.location, npc.location.scene),
          )
          .map((npc) => npc.id);
        if (
          state.player.location.scene === victim.location.scene &&
          Math.hypot(
            state.player.location.x - victim.location.x,
            state.player.location.y - victim.location.y,
          ) <= 8 &&
          hasLineOfSight(state.player.location, victim.location, victim.location.scene)
        )
          witnesses.push("player");
        const id = `crime:${state.nextId++}`;
        victim.health = clamp(victim.health - 8);
        conflict.resentment = Math.max(0, conflict.resentment - 15);
        state.crimes.push({
          id,
          offender: offender.id,
          victim: victim.id,
          witnesses,
          evidence: witnesses.map((witness) => `saw:${witness}`),
          reported: false,
          status: "unreported",
          tick: state.tick,
          fine: 10000,
        });
        emit(
          state,
          "neighborhood_argument",
          `${offender.name} ile ${victim.name} arasındaki tartışma yaralanmayla sonuçlandı.`,
          [offender.id, victim.id],
          victim.id,
          "witnessed",
          witnesses,
        );
      }
    }
    // Justice owns every case settlement, dispatch limit and unpaid fine.
    // Weekly economy must never create a second payment identity or close its queue.
  }
  if (day % 7 === 0) {
    const faction = ["dock", "hill", "night"][draw(state.seed, 44, day) % 3];
    state.flags[`faction:${faction}`] = clamp(Number(state.flags[`faction:${faction}`]) + 6);
  }
  economyDayEnd(state);
}
