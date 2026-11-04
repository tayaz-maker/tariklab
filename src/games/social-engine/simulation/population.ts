import type { Business, Person, Player, Profile, WorldState } from "../domain/types.ts";
import {
  BACKGROUND_POPULATION,
  ENGINE_VERSION,
  FIRST_NAMES,
  JOBS,
  LAST_NAMES,
  LOCAL_POPULATION,
  SCHEMA_VERSION,
} from "../domain/content.ts";
import { BUILDINGS, SPAWN, pointOnLane } from "../domain/world.ts";
import { draw } from "./random.ts";
import { npcMovementTraits } from "./npc-traits.ts";
import { pedestrianWalkable } from "./pedestrian-navigation.ts";
import { emit, relation } from "./events.ts";

export const DEFAULT_PROFILE: Profile = {
  name: "Deniz",
  appearance: 0,
  background: "newcomer",
  attributes: { body: 3, mind: 3, social: 3, discipline: 3 },
};
export const BUILDING_FOR_BUSINESS: Record<string, string> = {
  market: "b-market",
  tea: "b-cafe",
  garage: "b-garage",
  warehouse: "b-warehouse",
  office: "b-office",
  police: "b-security",
  school: "b-school",
  bank: "b-sales",
  taxi: "b-taxi",
  restaurant: "b-restaurant",
  clinic: "b-clinic",
};
export function profileErrors(profile: Profile): string[] {
  if (!profile || typeof profile !== "object") return ["Profil okunamadı."];
  const errors: string[] = [];
  if (
    typeof profile.name !== "string" ||
    !/^[\p{L}\p{N}][\p{L}\p{N} '-]{1,23}$/u.test(profile.name.trim())
  )
    errors.push("Ad 2–24 karakter olmalı; harf, rakam, boşluk, kesme ve tire kullanılabilir.");
  if (!Number.isInteger(profile.appearance) || profile.appearance < 0 || profile.appearance > 7)
    errors.push("Geçersiz görünüm.");
  if (!["local", "newcomer", "graduate"].includes(profile.background))
    errors.push("Geçersiz geçmiş.");
  const points = ["body", "mind", "social", "discipline"].map(
    (key) => profile.attributes?.[key as keyof Profile["attributes"]],
  );
  if (
    points.some((value) => !Number.isInteger(value) || value < 1 || value > 6) ||
    points.reduce((a, b) => a + b, 0) !== 12
  )
    errors.push("Özellikler 1–6 aralığında ve toplam tam 12 puan olmalı.");
  return errors;
}
function person(seed: number, index: number): Person {
  const local = index < LOCAL_POPULATION,
    job = JOBS[index % JOBS.length],
    homeId = `home-${Math.floor(index / 4)}`;
  // Local citizens begin at their own store's public pavement; every initial position is canonical and reachable.
  const building = BUILDINGS.find((b) => b.id === BUILDING_FOR_BUSINESS[job.businessId])!;
  const sameBuilding = (candidate: (typeof JOBS)[number]) =>
    BUILDING_FOR_BUSINESS[candidate.businessId] === building.id;
  const ordinal =
    Math.floor(index / JOBS.length) * JOBS.filter(sameBuilding).length +
    JOBS.slice(0, index % JOBS.length).filter(sameBuilding).length;
  const candidates = Array.from({ length: 25 }, (_, slot) => ({
    x: building.door.x + [0, -1, 1, -2, 2, -3, 3, -4, 4][slot % 9] * 0.6,
    y: building.door.y + Math.floor(slot / 9) * 0.6,
  })).filter(pedestrianWalkable);
  const { x, y } = candidates[ordinal % candidates.length] ?? building.door;
  return {
    id: `n${index}`,
    name: `${FIRST_NAMES[index % FIRST_NAMES.length]} ${LAST_NAMES[Math.floor(index / FIRST_NAMES.length) % LAST_NAMES.length]}${index >= 240 ? ` ${index + 1}` : ""}`,
    age: 20 + (draw(seed, 1, 0, index) % 47),
    local,
    location: local
      ? { x: index === 0 ? 26.45 : x, y: index === 0 ? 15.4 : y, scene: "outside" }
      : { x: 7, y: 9, scene: "b-home" },
    destination: null,
    path: [],
    homeId,
    householdId: `h${Math.floor(index / 4)}`,
    jobId: job.id,
    employerId: job.businessId,
    goal: "idle",
    health: 100,
    stamina: 100,
    hunger: draw(seed, 2, 0, index) % 30,
    fatigue: draw(seed, 3, 0, index) % 20,
    debt: 0,
    income: 0,
    expenses: 0,
    propertyIds: [],
    skills: {
      driving: 10,
      combat: 10,
      communication: 10,
      technical: 10,
      trade: 10,
      academic: 10,
      body: 10,
      discipline: 10,
    },
    memories: [],
    wanted: 0,
    lastDecision: 460 + npcMovementTraits(seed, `n${index}`).decisionOffset,
    appearance: index % 8,
    alive: true,
  };
}
export function initializeWorld(
  seed: number,
  input: Profile = DEFAULT_PROFILE,
  populationCount = LOCAL_POPULATION + BACKGROUND_POPULATION,
): WorldState {
  if (![1100, 10000].includes(populationCount))
    throw new Error("Unsupported population configuration");
  if (!Number.isSafeInteger(seed)) throw new Error("Dünya seed değeri tamsayı olmalı.");
  const errors = profileErrors(input);
  if (errors.length) throw new Error(errors.join(" "));
  const profile = structuredClone(input);
  profile.name = profile.name.trim();
  const player: Player = {
    ...person(seed, 0),
    id: "player",
    name: profile.name,
    age: 24,
    local: true,
    profile,
    appearance: profile.appearance,
    homeId: "player-home",
    householdId: "player-household",
    jobId: null,
    employerId: null,
    location: { ...SPAWN, scene: "outside" },
    inventory: { simit: 2 },
    reputation: 0,
    influence: 0,
    vehicleId: null,
    shift: null,
    blocking: false,
    attackUntil: 0,
    cooldownUntil: 0,
  };
  player.skills.communication = profile.attributes.social * 2;
  player.skills.technical = profile.attributes.mind * 2;
  player.skills.combat = profile.attributes.body * 2;
  player.skills.academic = profile.background === "graduate" ? 25 : 10;
  const npcs = Array.from({ length: populationCount }, (_, index) => person(seed, index));
  npcs[0].location = { x: SPAWN.x + 1, y: SPAWN.y, scene: "outside" };
  npcs[0].goal = "greet";
  const businesses: Business[] = Object.entries(BUILDING_FOR_BUSINESS).map(
    ([id, buildingId], index) => ({
      id,
      buildingId,
      ownerId: `n${index}`,
      employees: npcs.filter((npc) => npc.employerId === id).map((npc) => npc.id),
      stock: {
        simit: id === "market" ? 250 : 20,
        tea: 120,
        meal: 80,
        medicine: 60,
        parts: id === "garage" ? 3 : 30,
        book: 30,
      },
      prices: { simit: 1800, tea: 1200, meal: 7500, medicine: 9500, parts: 5500, book: 4200 },
      wage: JOBS.find((job) => job.businessId === id)?.wage ?? 10000,
      status: "open",
      sales: 0,
    }),
  );
  const accounts: Record<string, number> = {
    player: 125000,
    external: 900_000_000_000,
    bank: 100_000_000,
    municipality: 100_000_000,
    landlord: 100_000_000,
    quests: 100_000_000,
  };
  for (const npc of npcs)
    accounts[npc.id] = 300000 + (draw(seed, 4, 0, Number(npc.id.slice(1))) % 400000);
  for (const business of businesses) accounts[`business:${business.id}`] = 20000000;
  const state: WorldState = {
    economy: undefined as unknown as WorldState["economy"],
    social: undefined as unknown as WorldState["social"],
    progression: undefined as unknown as WorldState["progression"],
    mobility: {
      version: 1,
      weather: { kind: "clear", day: 0 },
      speed: 1,
      parking: [],
      rentals: [],
      trip: null,
    },
    life: {
      version: 2,
      guardians: {},
      births: [],
      deaths: [],
      estates: [],
      demography: {
        initialPopulation: 1100,
        maxBirths: 24,
        lastDailyAt: 0,
        lastAgingYear: 0,
        parenthoodAt: {},
      },
      properties: [],
      leases: [],
      budgets: [],
      parentage: {},
      consents: [],
      partnerships: [],
      enrollments: [],
      certificates: [],
      aidLastAt: {},
      archivedHouseholds: [],
      lastDailyAt: 0,
    },
    schemaVersion: SCHEMA_VERSION,
    engineVersion: ENGINE_VERSION,
    seed: seed >>> 0,
    tick: 0,
    minute: 8 * 60,
    rng: seed >>> 0,
    nextId: 1,
    player,
    npcs,
    households: [
      ...Array.from({ length: Math.ceil(npcs.length / 4) }, (_, index) => ({
        id: `h${index}`,
        members: npcs.slice(index * 4, index * 4 + 4).map((npc) => npc.id),
        homeId: `home-${index}`,
        rent: 40000,
        arrears: 0,
      })),
      {
        id: "player-household",
        members: ["player"],
        homeId: "player-home",
        rent: 65000,
        arrears: 0,
      },
    ],
    businesses,
    accounts,
    openingTotal: Object.values(accounts).reduce((a, b) => a + b, 0),
    ledger: [],
    ledgerCheckpoint: { count: 0, balances: { ...accounts } },
    events: [],
    eventCount: 0,
    relations: [],
    quests: [],
    crimes: [],
    vehicles: Array.from({ length: 8 }, (_, index) => {
      const lane = index % 4,
        progress = index === 0 ? 10 : index * 13;
      const p = pointOnLane(lane, progress);
      return {
        id: `v${index}`,
        location: { x: p.x, y: p.y, scene: "outside" },
        heading: p.heading,
        speed: index === 0 ? 0 : 1.8 + (index % 3) * 0.4,
        driverId: index === 0 ? null : `n${80 + index}`,
        lane,
        progress,
        color: index === 0 ? 0xd9ae54 : [0xc96f59, 0xa5b8c4, 0xe0d9c4][index % 3],
      };
    }),
    processedCommands: [],
    flags: {
      ...(populationCount === 10000 ? { benchmarkPopulation: 10000 } : {}),
      moveX: 0,
      moveY: 0,
      sprint: false,
      throttle: 0,
      steer: 0,
      day: 0,
      debtInterest: 0,
      faction: "",
      tutorial: 0,
      "faction:dock": 20,
      "faction:hill": 20,
      "faction:night": 20,
    },
    notices: [
      "DARAMCIK’a hoş geldin. Deniz ile konuş; iş, komşuluk veya keşifle kendi yolunu kur.",
    ],
  };
  for (const vehicle of state.vehicles)
    if (vehicle.driverId) {
      const driver = npcs.find((npc) => npc.id === vehicle.driverId)!;
      driver.location = { ...vehicle.location };
      driver.goal = "drive";
    }
  for (const household of state.households)
    for (let i = 1; i < household.members.length; i++) {
      const edge = relation(state, household.members[0], household.members[i]);
      edge.trust = 40;
      edge.affection = 35;
    }
  emit(state, "arrival", `${profile.name}, DARAMCIK’ta yeni bir güne başladı.`, ["player"]);
  return state;
}
