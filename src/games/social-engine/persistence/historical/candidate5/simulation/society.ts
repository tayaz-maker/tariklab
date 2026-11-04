import { requestNpcMeal } from "./services.ts";
import {
  scheduleBackgroundTravel,
  closeAttendanceDay,
  attendedWage,
  produceBusiness,
  economyDayEnd,
} from "./economy.ts";
import type { Person, WorldState } from "../domain/types.ts";
import { JOBS } from "../domain/content.ts";
import { BUILDINGS, findPath, hasLineOfSight, moveWithCollision } from "../domain/world.ts";
import { BUILDING_FOR_BUSINESS } from "./population.ts";
import { adjustRelation, emit, notify } from "./events.ts";
import { transfer } from "./ledger.ts";
import { clamp, draw } from "./random.ts";

function routineTarget(
  state: WorldState,
  npc: Person,
  index: number,
): { goal: string; building: string } {
  const minute = state.minute % 1440;
  if (npc.age < 18)
    return {
      goal: npc.age >= 6 && minute >= 480 && minute < 900 ? "school" : "care",
      building: npc.age >= 6 && minute >= 480 && minute < 900 ? "b-school" : "b-home",
    };
  if (npc.health < 35) return { goal: "heal", building: "b-clinic" };
  if (npc.hunger > 75) return { goal: "eat", building: "b-market" };
  if (minute < 6 * 60 || minute >= 22 * 60) return { goal: "sleep", building: "b-home" };
  if (!npc.jobId) return { goal: "seekJob", building: "b-office" };
  if (minute >= 9 * 60 + (index % 45) && minute < 17 * 60 + (index % 45))
    return {
      goal: "work",
      building: BUILDING_FOR_BUSINESS[npc.employerId ?? "market"] ?? "b-market",
    };
  return { goal: "socialize", building: index % 2 ? "b-cafe" : "b-restaurant" };
}
export function npcMovement(state: WorldState): void {
  // Nearby actors use ten fixed steps; the remaining locals move on the same valid paths at 1 Hz.
  const player = state.player;
  let detailed = 0;
  for (let index = 0; index < 100; index++) {
    const npc = state.npcs[index];
    if (npc.goal === "drive" || !npc.alive) continue;
    if (npc.id === "n0" && state.minute < 490) continue;
    const near =
      npc.location.scene === player.location.scene &&
      Math.hypot(npc.location.x - player.location.x, npc.location.y - player.location.y) < 16 &&
      detailed < 25;
    if (near) detailed++;
    if (!near && state.tick % 10 !== index % 10) continue;
    if (
      state.minute >= npc.lastDecision + 20 &&
      (npc.path.length === 0 || state.minute >= npc.lastDecision + 60)
    ) {
      const plan = routineTarget(state, npc, index),
        target = BUILDINGS.find((building) => building.id === plan.building)!;
      npc.lastDecision = state.minute;
      if (npc.location.scene !== "outside") {
        if (npc.location.scene === target.id) {
          npc.goal = plan.goal;
          continue;
        }
        const current = BUILDINGS.find((building) => building.id === npc.location.scene);
        if (current) npc.location = { ...current.door, scene: "outside" };
      }
      npc.goal = plan.goal;
      npc.destination = { ...target.door };
      npc.path = findPath(npc.location, target.door);
    }
    if (npc.path.length) {
      const target = npc.path[0],
        dx = target.x - npc.location.x,
        dy = target.y - npc.location.y,
        distance = Math.hypot(dx, dy);
      const speed = near ? 0.105 : 1.05;
      if (distance <= speed) {
        npc.location.x = target.x;
        npc.location.y = target.y;
        npc.path.shift();
      } else {
        const next = moveWithCollision(
          npc.location,
          { x: (dx / distance) * speed, y: (dy / distance) * speed },
          npc.location.scene,
        );
        npc.location.x = next.x;
        npc.location.y = next.y;
      }
      if (!npc.path.length && npc.destination) {
        const building = BUILDINGS.find(
          (item) => Math.hypot(item.door.x - npc.location.x, item.door.y - npc.location.y) < 0.4,
        );
        if (building) {
          npc.location = { x: 4 + (index % 5), y: 6 + (index % 3), scene: building.id };
          npc.destination = null;
        }
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
