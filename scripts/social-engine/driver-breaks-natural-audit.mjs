/** No fixture edits. Records actual paid food receipts before ledger compaction. */
import {
  createWorld,
  stepWorld,
  validateState,
} from "../../src/games/social-engine/simulation/engine.ts";
import { vehicleSeparation } from "../../src/games/social-engine/simulation/vehicle-collision.ts";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";

const seed = Number(process.argv[2] ?? 922),
  days = Number(process.argv[3] ?? 5);
if (!Number.isSafeInteger(seed) || !Number.isSafeInteger(days) || days < 2 || days > 30)
  throw Error("Usage: driver-breaks-natural-audit.mjs SEED DAYS (2–30)");
const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  s = createWorld(seed),
  endTick = days * 14400;
const people = new Map(
  s.vehicles
    .filter((v) => v.driverId && v.driverId !== "player")
    .map((v) => [
      v.driverId,
      {
        vehicleId: v.id,
        meals: [],
        completedBreaks: [],
        walkBackMealTick: null,
        mergeMealTick: null,
        minHealth: 100,
        maxHunger: 0,
        finalHunger: 0,
        finalIncome: 0,
        consecutiveAt100: 0,
        longestAt100: 0,
        firstReturnTick: null,
        lastReturnTick: null,
        peakStoppedTicks: 0,
        stoppedTicks: 0,
      },
    ]),
);
const seen = new Set(),
  errors = [],
  overlapExamples = [];
let overlaps = 0;
for (let tick = 1; tick <= endTick; tick++) {
  stepWorld(s);
  for (const [id, m] of people) {
    const p = s.npcs.find((n) => n.id === id),
      v = s.vehicles.find((v) => v.id === m.vehicleId),
      b = s.mobility.driverBreaks.find((b) => b.personId === id && b.vehicleId === m.vehicleId);
    m.minHealth = Math.min(m.minHealth, p.health);
    m.maxHunger = Math.max(m.maxHunger, p.hunger);
    m.finalHunger = p.hunger;
    m.finalIncome = p.income;
    m.consecutiveAt100 = p.hunger === 100 ? m.consecutiveAt100 + 1 : 0;
    m.longestAt100 = Math.max(m.longestAt100, m.consecutiveAt100);
    m.stoppedTicks =
      v.driverId === id && v.speed === 0 && (!b || ["driving", "seeking"].includes(b.phase))
        ? m.stoppedTicks + 1
        : 0;
    m.peakStoppedTicks = Math.max(m.peakStoppedTicks, m.stoppedTicks);
    if (b?.outcome === "fed" && b.lastMealTick !== null) {
      if (b.phase === "walkBack") m.walkBackMealTick = b.lastMealTick;
      if (b.phase === "fromBay" && v.driverId === id && m.walkBackMealTick === b.lastMealTick)
        m.mergeMealTick = b.lastMealTick;
      if (
        b.phase === "driving" &&
        v.driverId === id &&
        m.mergeMealTick === b.lastMealTick &&
        (!m.lastReturnTick || m.lastReturnTick < b.lastMealTick)
      ) {
        m.firstReturnTick ??= tick;
        m.lastReturnTick = tick;
        m.completedBreaks.push({ mealTick: b.lastMealTick, returnTick: tick });
      }
    }
  }
  if (tick % 10 === 0)
    for (const entry of s.ledger.slice(-128)) {
      const m = people.get(entry.from);
      if (
        !m ||
        entry.reason !== "food" ||
        entry.to !== "business:market" ||
        entry.amount <= 0 ||
        seen.has(entry.id)
      )
        continue;
      seen.add(entry.id);
      const b = s.mobility.driverBreaks.find(
        (b) => b.personId === entry.from && b.vehicleId === m.vehicleId,
      );
      m.meals.push({
        id: entry.id,
        tick: entry.tick,
        amount: entry.amount,
        day: Math.floor((480 + entry.tick / 10) / 1440),
        onDriverBreak:
          b?.phase === "queue" && entry.id === `meal:v5:market:${b.mealJoinedTick}:${b.personId}`,
      });
    }
  for (let i = 0; i < s.vehicles.length; i++)
    for (let j = i + 1; j < s.vehicles.length; j++) {
      const a = s.vehicles[i],
        b = s.vehicles[j],
        sep = vehicleSeparation(
          { ...a.location, heading: a.heading },
          { ...b.location, heading: b.heading },
        );
      if (sep < -0.001) {
        overlaps++;
        if (overlapExamples.length < 8) overlapExamples.push({ tick, a: a.id, b: b.id, sep });
      }
    }
  if (tick % 1000 === 0) {
    const validation = validateState(s);
    if (validation.length) errors.push({ tick, validation });
  }
  if (tick % 14400 === 0)
    console.log(
      JSON.stringify({
        seed,
        day: tick / 14400,
        meals: Object.fromEntries([...people].map(([id, m]) => [id, m.meals.length])),
        overlaps,
      }),
    );
}
const drivers = Object.fromEntries(
  [...people].map(([id, m]) => {
    const receipts = m.meals.map((e) => e.tick),
      boundaries = [0, ...receipts, endTick];
    return [
      id,
      {
        ...m,
        mealsPerGameDay: Object.fromEntries(
          [...new Set(m.meals.map((e) => e.day))].map((day) => [
            day,
            m.meals.filter((e) => e.day === day).length,
          ]),
        ),
        maxMealGapHours: Math.max(...boundaries.slice(1).map((b, i) => (b - boundaries[i]) / 600)),
        longestAt100Hours: m.longestAt100 / 600,
      },
    ];
  }),
);
const report = {
  commit,
  seed,
  days,
  fixture: "Unchanged createWorld(seed); no edits or player commands.",
  overlaps,
  overlapExamples,
  errors,
  drivers,
  finalBreaks: s.mobility.driverBreaks,
};
const out = "artifacts/social-engine/driver-breaks";
await mkdir(out, { recursive: true });
await writeFile(
  `${out}/natural-${commit.slice(0, 8)}-${seed}-${days}d.json`,
  JSON.stringify(report, null, 2),
);
console.log(
  JSON.stringify({
    seed,
    days,
    overlaps,
    errors,
    drivers: Object.fromEntries(
      Object.entries(drivers).map(([id, m]) => [
        id,
        {
          paidMeals: m.meals.length,
          paidMealsOnBreak: m.meals.filter((meal) => meal.onDriverBreak).length,
          completedBreaks: m.completedBreaks.length,
          firstReturnTick: m.firstReturnTick,
          minHealth: m.minHealth,
          maxHunger: m.maxHunger,
          finalHunger: m.finalHunger,
          maxMealGapHours: m.maxMealGapHours,
          longestAt100Hours: m.longestAt100Hours,
        },
      ]),
    ),
  }),
);
