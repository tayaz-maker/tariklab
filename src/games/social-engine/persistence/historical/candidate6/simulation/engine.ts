import { advanceTraffic } from "./traffic.ts";
import { trafficPose } from "../domain/traffic.ts";
import { finishWorkOrder } from "./work-orders.ts";
import { propertyCommand, validateProperty } from "./property-crime.ts";
import { requestService, finishService } from "./services.ts";
import {
  initializeEconomy,
  economyMinute,
  economyView,
  validateEconomy,
  recordSale,
} from "./economy.ts";
import {
  tickJustice,
  applyJusticeCommand,
  guardJusticeCommand,
  isPoliceChargeSupported,
  recordFineResolution,
} from "./justice.ts";
import {
  initializeSocial,
  applySocialCommand,
  tickSocial,
  validateSocial,
  projectSocial,
} from "./social.ts";
import {
  initializeProgression,
  progressionCommand,
  reconcileProgression,
  validateProgression,
  progressionView,
  progressionWageBonus,
} from "./progression.ts";
import type {
  Command,
  CommandResult,
  Person,
  Point,
  Profile,
  RenderProjection,
  WorldState,
} from "../domain/types.ts";
import {
  ENGINE_VERSION,
  ITEMS,
  JOBS,
  SCHEMA_VERSION,
  TICKS_PER_MINUTE,
} from "../domain/content.ts";
import {
  BUILDINGS,
  INTERIOR_EXIT,
  INTERIOR_SPAWN,
  ROADS,
  findPath,
  hasLineOfSight,
  isWalkable,
  laneLength,
  moveWithCollision,
} from "../domain/world.ts";
import { initializeWorld, profileErrors } from "./population.ts";
import { adjustRelation, emit, notify, relation } from "./events.ts";
import { reconcile, transfer, validTransactionBits } from "./ledger.ts";
import { clamp, canonical, quantize } from "./random.ts";
import { missionMinute, offerEvent, validateMissionReservations } from "./missions.ts";
import { npcMovement, societyMinute } from "./society.ts";
import {
  initializeLife,
  applyLifeCommand,
  lifeMinute,
  validateLife,
  lifeView,
  jobPrerequisite,
} from "./life.ts";

import {
  initializeMobility,
  applyMobilityCommand,
  mobilityTick,
  mobilityMinute,
  validateMobility,
  mobilityView,
  weatherEffects,
  rentalAccess,
  unparkVehicle,
  parkedAt,
} from "./mobility.ts";

export { profileErrors } from "./population.ts";
export { transfer, reconcile } from "./ledger.ts";
export { offerEvent, eventEligible } from "./missions.ts";
export function createWorld(seed = 20261103, profile?: Profile): WorldState {
  return initializeCompleteWorld(seed, profile, 1100);
}
/** Synthetic capacity probe only. Normal validation, worker INIT and save codecs reject this world. */
export function createBenchmarkWorld(seed = 20261103): WorldState {
  return initializeCompleteWorld(seed, undefined, 10000);
}
function initializeCompleteWorld(
  seed: number,
  profile: Profile | undefined,
  populationCount: number,
): WorldState {
  const state = initializeWorld(seed, profile, populationCount);
  state.life = initializeLife(state, { seedFamilies: true });
  state.mobility = initializeMobility(state);
  state.social = initializeSocial(state);
  state.progression = initializeProgression(state);
  state.economy = initializeEconomy(state);
  offerEvent(state, "shortage");
  offerEvent(state, "neighbor_help");
  offerEvent(state, "delivery");
  return state;
}
export const canonicalState = (state: WorldState): string => canonical(state);
const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);
const atBuilding = (state: WorldState, buildingId: string): boolean => {
  const building = BUILDINGS.find((item) => item.id === buildingId),
    location = state.player.location;
  return (
    !!building &&
    (location.scene === buildingId ||
      (location.scene === "outside" &&
        distance(location, building.door) <= 1.8 &&
        hasLineOfSight(location, building.door)))
  );
};
const nearby = (state: WorldState, person: Person): boolean =>
  person.alive &&
  person.location.scene === state.player.location.scene &&
  distance(state.player.location, person.location) <= 1.8 &&
  hasLineOfSight(state.player.location, person.location, person.location.scene);
const numberArg = (args: Record<string, unknown>, key: string): number | null =>
  typeof args[key] === "number" && Number.isFinite(args[key]) ? (args[key] as number) : null;
const stringArg = (args: Record<string, unknown>, key: string): string =>
  typeof args[key] === "string" ? (args[key] as string) : "";
const commandSets = new WeakMap<WorldState, Set<string>>();
function stop(state: WorldState): void {
  state.flags.moveX = 0;
  state.flags.moveY = 0;
  state.player.path = [];
  state.player.destination = null;
}
function payFine(state: WorldState): void {
  const cases = state.crimes.filter(
    (crime) =>
      crime.offender === "player" &&
      crime.reported &&
      crime.status !== "resolved" &&
      isPoliceChargeSupported(state, crime.id),
  );
  for (const crime of cases) {
    const cash = Math.min(state.accounts.player, crime.fine);
    if (cash) transfer(state, `fine:${crime.id}`, "player", "municipality", cash, "fine");
    const arrears = crime.fine - cash;
    state.player.debt += arrears;
    state.flags.loanAsset = Number(state.flags.loanAsset ?? 0) + arrears;
    crime.status = "resolved";
    recordFineResolution(state, crime.id);
    emit(
      state,
      "case_resolved",
      "İfade alındı; tanık kaydı olan dosya oyun içi para cezasıyla kapandı.",
      ["player"],
      crime.victim,
      "private",
    );
  }
  state.player.wanted = 0;
  state.flags.pursuitUntil = 0;
  state.player.shift = null;
  stop(state);
  notify(
    state,
    "Takip sona erdi. Ödenemeyen ceza borç defterinde; geçim ve iyileşme yolları açık.",
  );
}
function consume(state: WorldState, item: string, count = 1): boolean {
  if (
    !Object.hasOwn(state.player.inventory, item) ||
    !Number.isSafeInteger(state.player.inventory[item]) ||
    state.player.inventory[item] < count
  )
    return false;
  state.player.inventory[item] -= count;
  if (!state.player.inventory[item]) delete state.player.inventory[item];
  return true;
}
function completeMission(state: WorldState, questId: string): CommandResult {
  const quest = state.quests.find((item) => item.id === questId),
    p = state.player;
  if (!quest || quest.status !== "active")
    return { ok: false, reason: "Görev aktif değil veya ödül daha önce alındı.", events: [] };
  if (!atBuilding(state, quest.buildingId))
    return { ok: false, reason: "Önce görevde belirtilen mekâna ulaş.", events: [] };
  let item = "";
  switch (quest.kind) {
    case "shortage":
    case "vehicle_breakdown":
      item = "parts";
      break;
    case "neighbor_help":
      item = "simit";
      break;
    case "friend_invite":
      item = "tea";
      break;
    case "delivery":
      item = `parcel:${quest.id}`;
      break;
    case "job_offer":
      if (!p.jobId) return { ok: false, reason: "Önce telefonundan bir işe başvur.", events: [] };
      break;
    case "layoff":
      if (!Number(state.flags.shiftsCompleted))
        return { ok: false, reason: "Bir vardiya tamamlaman gerekiyor.", events: [] };
      break;
    case "promotion":
      if (!Object.values(p.skills).some((value) => value >= 20))
        return { ok: false, reason: "Bir beceriyi en az 20 seviyesine getir.", events: [] };
      break;
    case "loan_due":
      if (p.debt >= Number(state.flags[`questDebt:${quest.id}`]))
        return { ok: false, reason: "Borç bakiyeni önce azaltmalısın.", events: [] };
      break;
    case "price_shock":
      if (p.skills.trade < 15)
        return { ok: false, reason: "Ticaret becerin en az 15 olmalı.", events: [] };
      break;
    case "scholarship":
      if (p.skills.academic <= Number(state.flags[`questAcademic:${quest.id}`]))
        return { ok: false, reason: "Önce akademide bir ders tamamla.", events: [] };
      break;
    case "traffic_jam":
      if (Number(state.flags.drivenDistance ?? 0) < 10)
        return { ok: false, reason: "Araçla en az 10 metre sür.", events: [] };
      break;
    case "witness_report":
      if (!state.crimes.some((crime) => crime.reported && crime.witnesses.length))
        return { ok: false, reason: "Bildirilebilecek gerçek bir tanık kaydı yok.", events: [] };
      break;
    case "police_check":
      if (p.wanted || !state.crimes.some((crime) => crime.status === "resolved"))
        return { ok: false, reason: "Önce açık takip dosyanı çöz.", events: [] };
      break;
    case "faction_truce":
      if (p.reputation < 10)
        return {
          ok: false,
          reason: "Arabuluculuk için sosyal itibarın en az 10 olmalı.",
          events: [],
        };
      break;
    case "late_wage":
      break;
    default:
      if (!state.relations.some((edge) => edge.to === "player" && edge.trust >= 5))
        return { ok: false, reason: "Bir komşuyla konuşup güven oluştur.", events: [] };
  }
  if (item && (p.inventory[item] ?? 0) < 1)
    return {
      ok: false,
      reason: `${ITEMS[item]?.name ?? "Görev paketi"} çantanda yok.`,
      events: [],
    };
  const escrow = `escrow:${quest.id}`;
  if (state.accounts[escrow] !== quest.reward)
    return { ok: false, reason: "Görev ödülü doğrulanamadı; işlem yapılmadı.", events: [] };
  if (!transfer(state, `reward:${quest.id}`, escrow, "player", quest.reward, "mission-reward"))
    return { ok: false, reason: "Ödül aktarımı reddedildi.", events: [] };
  if (item) consume(state, item);
  quest.status = "complete";
  quest.progress = quest.required;
  p.reputation = clamp(p.reputation + 3, -100, 100);
  adjustRelation(state, quest.issuerId, "player", 10, 4);
  if (quest.kind === "shortage") state.businesses.find((b) => b.id === "garage")!.stock.parts += 1;
  if (quest.kind === "delivery") state.businesses.find((b) => b.id === "taxi")!.stock.parts += 1;
  if (quest.kind === "vehicle_breakdown") {
    state.flags.vehicleWear = false;
    state.vehicles[2].speed = 2;
    p.skills.technical = clamp(p.skills.technical + 4);
  }
  if (quest.kind === "late_wage") {
    const business = state.businesses.find(
      (b) => b.buildingId === quest.buildingId && b.ownerId === quest.issuerId,
    );
    if (business && business.status === "distressed") {
      transfer(
        state,
        `mediation:${quest.id}`,
        "municipality",
        `business:${business.id}`,
        30000,
        "wage-mediation",
      );
      business.status = "open";
    }
  }
  if (quest.kind === "faction_truce")
    for (const faction of ["dock", "hill", "night"])
      state.flags[`faction:${faction}`] = Math.max(
        0,
        Number(state.flags[`faction:${faction}`]) - 3,
      );
  const event = emit(
    state,
    "mission_completed",
    `${quest.title} tamamlandı. ${(quest.reward / 100).toFixed(0)} TL ödendi.`,
    ["player", quest.issuerId],
    null,
    "public",
    [],
    quest.sourceEvent,
  );
  notify(state, event.text);
  return { ok: true, reason: event.text, events: [event.id] };
}

/** Validated commands are the only mutation boundary used by the UI and worker. */
export function applyCommand(state: WorldState, command: Command): CommandResult {
  const result = applyCommandInner(state, command);
  reconcileProgression(
    state,
    command?.type === "BUY" ? String(command.args?.businessId ?? "world") : "world",
  );
  return result;
}
function applyCommandInner(state: WorldState, command: Command): CommandResult {
  const fail = (reason: string): CommandResult => ({ ok: false, reason, events: [] });
  const ok = (reason: string): CommandResult => ({ ok: true, reason, events: [] });
  if (
    !command ||
    command.v !== 1 ||
    typeof command.id !== "string" ||
    !/^[\w:.-]{1,120}$/.test(command.id) ||
    !command.args ||
    typeof command.args !== "object"
  )
    return fail("Geçersiz komut biçimi.");
  let ids = commandSets.get(state);
  if (!ids) {
    ids = new Set(state.processedCommands);
    commandSets.set(state, ids);
  }
  if (ids.has(command.id)) return fail("Bu işlem daha önce işlendi.");
  ids.add(command.id);
  state.processedCommands.push(command.id);
  const a = command.args,
    p = state.player;
  const custodyResult = guardJusticeCommand(state, command);
  if (custodyResult) return custodyResult;
  const justiceResult = applyJusticeCommand(state, command);
  if (justiceResult) return justiceResult;
  const progressionResult = progressionCommand(state, command);
  if (progressionResult) return progressionResult;
  const propertyResult = propertyCommand(state, command);
  if (propertyResult) return propertyResult;
  const mobilityResult = applyMobilityCommand(state, command);
  if (mobilityResult) return mobilityResult;
  const socialResult = applySocialCommand(state, command);
  if (socialResult) return socialResult;
  const lifeType =
    command.type === "TALK"
      ? (
          { date: "ASK_DATE", marry: "PROPOSE_MARRIAGE", separate: "SEPARATE" } as Record<
            string,
            string
          >
        )[String(a.topic)]
      : undefined;
  const lifeResult = applyLifeCommand(state, lifeType ? { ...command, type: lifeType } : command);
  if (lifeResult) return lifeResult;
  switch (command.type) {
    case "MOVE": {
      const x = numberArg(a, "x"),
        y = numberArg(a, "y");
      if (x === null || y === null || Math.abs(x) > 1 || Math.abs(y) > 1 || p.vehicleId)
        return fail("Hareket girdisi geçersiz.");
      state.flags.moveX = x;
      state.flags.moveY = y;
      state.flags.sprint = a.sprint === true;
      p.path = [];
      p.destination = null;
      return ok("");
    }
    case "STOP":
      stop(state);
      state.flags.throttle = 0;
      state.flags.steer = 0;
      return ok("");
    case "MOVE_TO": {
      const x = numberArg(a, "x"),
        y = numberArg(a, "y");
      if (x === null || y === null || p.vehicleId || !isWalkable({ x, y }, p.location.scene))
        return fail("Bu noktaya yürünemiyor.");
      const path = findPath(p.location, { x, y }, p.location.scene);
      if (!path.length) return fail("Hedefe açık bir yol bulunamadı.");
      stop(state);
      p.destination = { x, y };
      p.path = path;
      return ok("Yol belirlendi.");
    }
    case "ENTER": {
      const building = BUILDINGS.find((item) => item.id === stringArg(a, "buildingId"));
      if (
        !building ||
        p.location.scene !== "outside" ||
        p.vehicleId ||
        !atBuilding(state, building.id)
      )
        return fail("Girmek için binanın kapısına yaklaş.");
      p.location = { ...INTERIOR_SPAWN, scene: building.id };
      stop(state);
      emit(
        state,
        "building_entered",
        `${building.name} içine girdin.`,
        ["player"],
        building.id,
        "private",
      );
      return ok(`${building.name}`);
    }
    case "EXIT": {
      const building = BUILDINGS.find((item) => item.id === p.location.scene);
      if (
        !building ||
        distance(p.location, INTERIOR_EXIT) > 2 ||
        !hasLineOfSight(p.location, INTERIOR_EXIT, building.id)
      )
        return fail("Çıkmak için kapıya yaklaş.");
      p.location = { ...building.door, scene: "outside" };
      stop(state);
      return ok("Sokağa çıktın.");
    }
    case "TALK": {
      const npc = state.npcs.find((item) => item.id === stringArg(a, "npcId"));
      if (!npc || !nearby(state, npc))
        return fail("Konuşmak için kişiye yaklaş ve görüş hattını aç.");
      if (Number(state.flags[`talk:${npc.id}`] ?? -100) + 20 > state.tick)
        return fail("Karşındaki konuşmasını bitirsin.");
      state.flags[`talk:${npc.id}`] = state.tick;
      const topic = stringArg(a, "topic") || "greet";
      if (!["greet", "help", "insult", "askJob", "date", "marry", "separate"].includes(topic))
        return fail("Bu konuşma seçeneği yok.");
      const edge = relation(state, npc.id, "player");
      let line: string;
      if (topic === "insult") {
        adjustRelation(state, npc.id, "player", -12, -4, 0, 12);
        p.reputation = clamp(p.reputation - 3, -100, 100);
        line = `${npc.name}: Böyle konuşursan aramızdaki güven kalmaz.`;
      } else if (topic === "help") {
        if (!consume(state, "simit")) return fail("Yardım etmek için çantanda bir simit olmalı.");
        adjustRelation(state, npc.id, "player", 12, 6);
        npc.hunger = clamp(npc.hunger - 25);
        p.reputation = clamp(p.reputation + 3, -100, 100);
        line = `${npc.name}: Bunu unutmayacağım. İş ararken adını söyleyebilirim.`;
      } else {
        adjustRelation(state, npc.id, "player", topic === "askJob" ? 2 : 5, 2);
        p.skills.communication = clamp(p.skills.communication + 1);
        line =
          edge.trust < -15
            ? `${npc.name}: Önce aramızdaki meseleyi çözmeliyiz.`
            : topic === "askJob"
              ? `${npc.name}: Telefonundaki iş ilanlarına bak. Güven kazandığında ücretine referans katkım olur.`
              : `${npc.name}: ${npc.goal === "work" ? "Vardiya yoğun geçiyor." : npc.hunger > 60 ? "Bir şeyler yemem gerekiyor." : "DARAMCIK’ta herkesin bir hikâyesi var."} ${npc.memories.length ? "Son karşılaşmalarımızı hatırlıyorum." : "Tanıştığımıza sevindim."}`;
      }
      const event = emit(
        state,
        topic === "insult" ? "relationship_dispute" : "conversation",
        line,
        ["player", npc.id],
        npc.id,
        "private",
      );
      notify(state, line);
      return { ok: true, reason: line, events: [event.id] };
    }
    case "BUY": {
      const business = state.businesses.find((item) => item.id === stringArg(a, "businessId")),
        item = stringArg(a, "item"),
        quantity = a.quantity === undefined ? 1 : numberArg(a, "quantity");
      if (!business || business.status === "closed" || !atBuilding(state, business.buildingId))
        return fail("Alışveriş için açık işletmeye yaklaş.");
      if (
        !Object.hasOwn(ITEMS, item) ||
        quantity === null ||
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > 20
      )
        return fail("Geçersiz ürün veya miktar.");
      if ((business.stock[item] ?? 0) < quantity) return fail("İşletmenin stoğu yetmiyor.");
      const weight = Object.entries(p.inventory).reduce(
        (sum, [key, count]) => sum + count * (ITEMS[key]?.weight ?? 1),
        0,
      );
      if (weight + quantity * ITEMS[item].weight > 30)
        return fail("Çantanda yeterli yer yok (30 ağırlık).");
      const price = business.prices[item] * quantity;
      if (state.accounts.player < price) return fail("Yeterli paran yok.");
      const service = requestService(state, business, p);
      if (!service.ok) return fail(service.reason);
      if (
        !transfer(
          state,
          `buy:${command.id}`,
          "player",
          `business:${business.id}`,
          price,
          "purchase",
        )
      )
        return fail("Yeterli paran yok.");
      finishService(state, business, "player");
      business.stock[item] -= quantity;
      business.sales += price;
      recordSale(state, business.id, item, quantity);
      p.inventory[item] = (p.inventory[item] ?? 0) + quantity;
      p.expenses += price;
      emit(
        state,
        "purchase",
        `${quantity} ${ITEMS[item].name} satın alındı.`,
        ["player", business.ownerId],
        business.id,
        "private",
      );
      return ok(`${ITEMS[item].name} çantana eklendi.`);
    }
    case "USE_ITEM": {
      const item = stringArg(a, "item"),
        definition = ITEMS[item];
      if (!Object.hasOwn(ITEMS, item) || item === "parts")
        return fail("Bu eşya görevlerde veya işletmede kullanılır.");
      if (!consume(state, item)) return fail("Bu eşya çantanda yok.");
      p.hunger = clamp(p.hunger - definition.hunger);
      p.health = clamp(p.health + definition.health);
      if (item === "book") p.skills.academic = clamp(p.skills.academic + 3);
      return ok(`${definition.name} kullanıldı.`);
    }
    case "APPLY_JOB": {
      const job = JOBS.find((item) => item.id === stringArg(a, "jobId")),
        employer = job && state.businesses.find((item) => item.id === job.businessId);
      if (!job || !employer || employer.status === "closed")
        return fail("Bu iş şu anda açık değil.");
      const prerequisite = jobPrerequisite(state, job.id);
      if (prerequisite) return fail(prerequisite);
      if (p.shift) return fail("Aktif vardiya sürerken iş değiştiremezsin.");
      if (job.id === "teaching" && p.skills.academic < 20)
        return fail("Eğitim asistanlığı için akademik beceri en az 20 olmalı.");
      for (const business of state.businesses)
        business.employees = business.employees.filter((id) => id !== "player");
      p.jobId = job.id;
      p.employerId = employer.id;
      employer.employees.push("player");
      emit(
        state,
        "job_started",
        `${job.name} işine kabul edildin.`,
        ["player", employer.ownerId],
        employer.id,
        "private",
      );
      return ok("İşe alındın. Vardiya için işyerine git.");
    }
    case "FINISH_WORK_ORDER": return finishWorkOrder(state,a.choice);
    case "START_SHIFT": {
      const job = JOBS.find((item) => item.id === p.jobId),
        employer = state.businesses.find((item) => item.id === p.employerId);
      if (!job || !employer || !atBuilding(state, employer.buildingId))
        return fail("Vardiya için çalıştığın işletmeye git.");
      if (
        p.shift ||
        state.life.enrollments.some((enrollment) => enrollment.activeUntil !== null) ||
        employer.status === "closed" ||
        p.wanted > 0 ||
        p.health < 25 ||
        p.fatigue > 85
      )
        return fail(
          "Vardiya başlayamadı: aktif vardiya, takip, sağlık veya yorgunluk durumunu kontrol et.",
        );
      const reference = state.relations.some((edge) => edge.to === "player" && edge.trust >= 20)
        ? 1000
        : 0;
      const wage =
        Math.floor(
          (job.wage + p.skills[job.skill] * 100 + reference) *
            (employer.status === "distressed" ? 0.7 : 1),
        ) + progressionWageBonus(state);
      if (state.accounts[`business:${employer.id}`] < wage)
        return fail("İşletmenin maaş bütçesi yetersiz.");
      p.shift = {
        id: `shift:${state.nextId++}`,
        businessId: employer.id,
        endsAt: state.minute + job.duration,
        ...(a.workOrder === true && (job.id === "retail" || job.id === "mechanic") ? {order: job.id as "retail" | "mechanic"} : {}),
        wage,
      };
      stop(state);
      return ok(
        `Vardiya başladı. ${job.duration} oyun dakikası işyerinde kal; ${(wage / 100).toFixed(0)} TL kazanacaksın.`,
      );
    }
    case "QUIT_JOB":
      if (p.shift)
        return fail(
          "Vardiya sürüyor; işten ayrılmadan tamamla veya işyerinden uzaklaşarak iptal et.",
        );
      else {
        for (const business of state.businesses)
          business.employees = business.employees.filter((id) => id !== "player");
        p.jobId = null;
        p.employerId = null;
        return ok("İşten ayrıldın. Diğer ilanlar açık.");
      }
    case "ACCEPT_QUEST": {
      const quest = state.quests.find((item) => item.id === stringArg(a, "questId"));
      if (!quest || quest.status !== "offered" || quest.deadline <= state.minute)
        return fail("Bu fırsat artık açık değil.");
      if (state.quests.filter((item) => item.status === "active").length >= 3)
        return fail("Aynı anda en fazla üç görev üstlenebilirsin.");
      if (quest.kind === "delivery") {
        const warehouse = state.businesses.find((b) => b.id === "warehouse")!;
        if (warehouse.stock.parts < 1) return fail("Teslim edilecek paket kalmadı.");
        warehouse.stock.parts--;
        p.inventory[`parcel:${quest.id}`] = 1;
      }
      quest.status = "active";
      return ok("Görev kabul edildi. Haritada hedef işaretlendi.");
    }
    case "COMPLETE_QUEST":
      return completeMission(state, stringArg(a, "questId"));
    case "DECLINE_QUEST": {
      const quest = state.quests.find((item) => item.id === stringArg(a, "questId"));
      if (!quest || !["offered", "active"].includes(quest.status)) return fail("Görev açık değil.");
      quest.status = "failed";
      const balance = state.accounts[`escrow:${quest.id}`];
      if (balance)
        transfer(
          state,
          `decline:${quest.id}`,
          `escrow:${quest.id}`,
          "quests",
          balance,
          "mission-declined",
        );
      if (p.inventory[`parcel:${quest.id}`]) {
        state.businesses.find((b) => b.id === "warehouse")!.stock.parts +=
          p.inventory[`parcel:${quest.id}`];
        delete p.inventory[`parcel:${quest.id}`];
      }
      return ok("Görev bırakıldı. Ayrılmış paket depoya iade edildi; diğer ilerleme yolları açık.");
    }
    case "VEHICLE_ENTER": {
      const vehicle = state.vehicles.find((item) => item.id === stringArg(a, "vehicleId"));
      if (
        !vehicle ||
        vehicle.driverId ||
        p.vehicleId ||
        p.location.scene !== "outside" ||
        distance(p.location, vehicle.location) > 1.8 ||
        !hasLineOfSight(p.location, vehicle.location)
      )
        return fail("Boş araca yaklaş.");
      const accessError = rentalAccess(state, vehicle.id);
      if (accessError) return fail(accessError);
      unparkVehicle(state, vehicle.id);
      vehicle.driverId = "player";
      p.vehicleId = vehicle.id;
      p.location = { ...vehicle.location };
      stop(state);
      state.flags.throttle = 0;
      return ok(
        "Araca bindin. W hızlanır, S frenler; A/D kavşakta dönüş seçer. F veya etkileşim ile in.",
      );
    }
    case "VEHICLE_EXIT": {
      const vehicle = state.vehicles.find((item) => item.id === p.vehicleId);
      if (!vehicle || vehicle.speed > 0.6) return fail("İnmek için önce frenleyip dur.");
      const exits = [
        { x: vehicle.location.x + 1, y: vehicle.location.y },
        { x: vehicle.location.x - 1, y: vehicle.location.y },
        { x: vehicle.location.x, y: vehicle.location.y + 1 },
      ];
      const exit = exits.find((point) => isWalkable(point));
      if (!exit) return fail("Güvenli iniş alanı bulunamadı.");
      p.vehicleId = null;
      vehicle.driverId = null;
      vehicle.speed = 0;
      p.location = { ...exit, scene: "outside" };
      state.flags.throttle = 0;
      state.flags.steer = 0;
      return ok("Aracı yol kenarında durdurup indin. Ayrılmış yer için Park eylemini kullan.");
    }
    case "DRIVE": {
      const throttle = numberArg(a, "throttle"),
        steer = numberArg(a, "steer");
      if (
        !p.vehicleId ||
        throttle === null ||
        steer === null ||
        Math.abs(throttle) > 1 ||
        Math.abs(steer) > 1
      )
        return fail("Geçersiz sürüş komutu.");
      state.flags.throttle = throttle;
      state.flags.steer = steer;
      return ok("");
    }
    case "ATTACK": {
      const npc = state.npcs.find((item) => item.id === stringArg(a, "npcId"));
      const heavy = a.heavy === true,
        cost = heavy ? 24 : 12;
      if (!npc || !nearby(state, npc) || npc.age < 18 || p.vehicleId)
        return fail("Yakınında yetişkin bir hedef olmalı.");
      if (p.stamina < cost || p.cooldownUntil > state.tick || p.health <= 0)
        return fail("Dayanıklılık veya toparlanma süresi saldırıya izin vermiyor.");
      p.stamina -= cost;
      p.attackUntil = state.tick + (heavy ? 6 : 3);
      p.cooldownUntil = state.tick + (heavy ? 18 : 10);
      state.flags.attackTarget = npc.id;
      state.flags.attackHeavy = heavy;
      return ok("Saldırı hazırlanıyor.");
    }
    case "BLOCK":
      p.blocking = a.active === true;
      return ok(p.blocking ? "Savunma açık." : "Savunma kapalı.");
    case "DODGE":
      if (p.stamina < 15) return fail("Kaçınmak için dayanıklılık yetersiz.");
      else {
        p.stamina -= 15;
        state.flags.dodgeUntil = state.tick + 6;
        return ok("Kaçındın.");
      }
    case "SURRENDER":
      if (!p.wanted) return fail("Aktif takip yok.");
      else {
        payFine(state);
        return ok("Teslim oldun; dosya sonucu kaydedildi.");
      }
    case "REPORT": {
      const crime = state.crimes.find((item) => item.id === stringArg(a, "crimeId"));
      if (
        !crime ||
        !crime.witnesses.length ||
        crime.status === "resolved" ||
        !atBuilding(state, "b-police")
      )
        return fail("Karakolda, tanık kaydı bulunan açık bir olay bildirebilirsin.");
      crime.reported = true;
      crime.status = "investigating";
      state.flags[`caseHidden:${crime.id}`] = false;
      emit(state, "witness_report", "Tanık ifadesi dosyaya işlendi.", ["player"], crime.victim);
      return ok("İhbar kaydedildi.");
    }
    case "REST": {
      if (!atBuilding(state, "b-home") && !atBuilding(state, "b-clinic"))
        return fail("Dinlenmek için eve veya kliniğe git.");
      if (p.wanted || p.shift || p.vehicleId)
        return fail("Takip veya vardiya sırasında dinlenemezsin.");
      state.flags.restUntil = state.minute + 60;
      stop(state);
      return ok("Bir saatlik dinlenme başladı. Hareket edersen dinlenme sona erer.");
    }
    case "TRAIN": {
      const skill = stringArg(a, "skill");
      if (
        !Object.hasOwn(p.skills, skill) ||
        ![
          "academic",
          "driving",
          "combat",
          "communication",
          "technical",
          "trade",
          "body",
          "discipline",
        ].includes(skill) ||
        (!atBuilding(state, "b-school") &&
          !(skill === "technical" && atBuilding(state, "b-garage")))
      )
        return fail("Ders için akademiye, teknik çalışma için tamirhaneye git.");
      if (
        p.wanted ||
        p.shift ||
        state.life.enrollments.some((enrollment) => enrollment.activeUntil !== null) ||
        Number(state.flags.trainingUntil ?? 0) > state.minute
      )
        return fail("Şu anda derse başlayamazsın.");
      const dayKey = `training:${Math.floor(state.minute / 1440)}`;
      if (Number(state.flags[dayKey] ?? 0) >= 5) return fail("Günlük ders sınırına ulaştın.");
      if (!transfer(state, `course:${command.id}`, "player", "business:school", 2500, "course-fee"))
        return fail("Ders ücreti 25 TL.");
      state.flags.trainingSkill = skill;
      state.flags.trainingUntil = state.minute + 20;
      state.flags.trainingBuilding = atBuilding(state, "b-school") ? "b-school" : "b-garage";
      state.flags[dayKey] = Number(state.flags[dayKey] ?? 0) + 1;
      stop(state);
      return ok("Ders başladı. 20 oyun dakikası burada kal.");
    }
    case "BORROW": {
      const amount = numberArg(a, "amount");
      if (
        !atBuilding(state, "b-bank") ||
        amount === null ||
        !Number.isSafeInteger(amount) ||
        amount < 1000 ||
        amount > 200000 ||
        p.debt + amount > 300000
      )
        return fail(
          "Bankada 10–2000 TL arası kredi; toplam borç sınırı 3000 TL. Haftalık oyun faizi %1.",
        );
      if (!transfer(state, `loan:${command.id}`, "bank", "player", amount, "loan-principal"))
        return fail("Kredi verilemedi.");
      p.debt += amount;
      state.flags.loanAsset = Number(state.flags.loanAsset ?? 0) + amount;
      emit(
        state,
        "loan_opened",
        "Kredi anaparası ve karşılık alacağı borç defterine işlendi.",
        ["player"],
        null,
        "private",
      );
      return ok("Kredi hesabına geçti. Haftalık oyun faizi %1.");
    }
    case "REPAY": {
      const requested = numberArg(a, "amount");
      if (requested === null || !Number.isSafeInteger(requested) || requested <= 0 || !p.debt)
        return fail("Geçerli bir borç ödeme tutarı gir.");
      const amount = Math.min(requested, p.debt);
      if (!transfer(state, `repay:${command.id}`, "player", "bank", amount, "debt-repayment"))
        return fail("Borç ödemesi için bakiye yetersiz.");
      p.debt -= amount;
      state.flags.loanAsset = Number(state.flags.loanAsset ?? 0) - amount;
      return ok("Borç ödemesi kaydedildi.");
    }
    case "BUY_BUSINESS": {
      const business = state.businesses.find((item) => item.id === stringArg(a, "businessId"));
      if (!business || business.ownerId === "player" || !atBuilding(state, business.buildingId))
        return fail("Devralmak için işletmeye git.");
      if (
        state.life.estates?.some(
          (estate) => estate.status === "settling" && estate.assets.includes(business.id),
        )
      )
        return fail("İşletme miras tasfiyesinde; borçlar sonuçlanana kadar devralınamaz.");
      const price = business.status === "distressed" ? 600000 : 1200000;
      if (
        !transfer(
          state,
          `acquire:${command.id}`,
          "player",
          business.ownerId,
          price,
          "business-acquisition",
        )
      )
        return fail(`Devralma için ${(price / 100).toFixed(0)} TL gerekiyor.`);
      const previousOwner = state.npcs.find((npc) => npc.id === business.ownerId);
      if (previousOwner)
        previousOwner.propertyIds = previousOwner.propertyIds.filter((id) => id !== business.id);
      business.ownerId = "player";
      p.propertyIds.push(business.id);
      emit(
        state,
        "business_acquired",
        "İşletmeyi devraldın; günlük kârdan pay alacaksın.",
        ["player"],
        business.id,
      );
      return ok("İşletmenin sahibi oldun.");
    }
    case "SUPPORT": {
      const dayKey = `support:${Math.floor(state.minute / 1440)}`;
      if (!atBuilding(state, "b-security") || state.accounts.player >= 20000 || state.flags[dayKey])
        return fail("Dayanışma desteği, 200 TL altındaki bakiye için günde bir kez alınabilir.");
      if (
        !transfer(
          state,
          `support:${command.id}`,
          "municipality",
          "player",
          20000,
          "emergency-support",
        )
      )
        return fail("Destek fonu şu an yetersiz.");
      state.flags[dayKey] = true;
      return ok("200 TL geçim desteği hesabında. Geçici işlere başvurabilirsin.");
    }
    case "JOIN_FACTION": {
      const faction = stringArg(a, "factionId");
      if (!["dock", "hill", "night"].includes(faction) || p.reputation < 5)
        return fail("Bir çevreye katılmak için en az 5 sosyal itibar gerekiyor.");
      const previous = String(state.flags.faction);
      if (previous && previous !== faction) {
        p.influence = clamp(p.influence - 5);
        emit(state, "faction_departure", "Eski çevren ayrılığını hatırlayacak.", ["player"]);
      }
      if (previous === faction) return fail("Zaten bu çevrenin üyesisin.");
      state.flags.faction = faction;
      p.influence = clamp(p.influence + 5);
      state.flags[`faction:${faction}`] = clamp(Number(state.flags[`faction:${faction}`]) + 3);
      return ok("Çevre kaydın güncellendi.");
    }
    default:
      return fail("Bilinmeyen komut.");
  }
}

function movement(state: WorldState): void {
  const p = state.player;
  if (p.vehicleId || state.mobility.trip) return;
  let dx = Number(state.flags.moveX),
    dy = Number(state.flags.moveY),
    speed = state.flags.sprint && p.stamina >= 1 ? 0.36 : 0.16;
  if (p.path.length) {
    const target = p.path[0];
    dx = target.x - p.location.x;
    dy = target.y - p.location.y;
    if (Math.hypot(dx, dy) <= speed) {
      p.location.x = target.x;
      p.location.y = target.y;
      p.path.shift();
      if (!p.path.length) p.destination = null;
      return;
    }
  }
  const length = Math.hypot(dx, dy);
  if (!length) {
    if (!p.blocking) p.stamina = clamp(p.stamina + 0.4);
    return;
  }
  if (p.health < 20) speed *= 0.6;
  if (state.flags.sprint && p.stamina >= 1)
    p.stamina = clamp(
      p.stamina - 0.45 * (p.location.scene === "outside" ? weatherEffects(state).needFactor : 1),
    );
  const next = moveWithCollision(
    p.location,
    { x: (dx / length) * speed, y: (dy / length) * speed },
    p.location.scene,
  );
  p.location.x = quantize(next.x);
  p.location.y = quantize(next.y);
  state.flags.restUntil = 0;
}
function combat(state: WorldState): void {
  const p = state.player;
  if (p.attackUntil && state.tick >= p.attackUntil && state.flags.attackTarget) {
    const npc = state.npcs.find((item) => item.id === state.flags.attackTarget);
    state.flags.attackTarget = "";
    p.attackUntil = 0;
    if (npc && nearby(state, npc)) {
      const heavy = state.flags.attackHeavy === true,
        damage = (heavy ? 24 : 12) + Math.floor(p.skills.combat / 15);
      npc.health = clamp(npc.health - damage);
      npc.goal = "flee";
      npc.path = [];
      adjustRelation(state, npc.id, "player", -25, -10, 20, 20);
      p.reputation = clamp(p.reputation - 6, -100, 100);
      const witnesses = state.npcs
        .slice(0, 100)
        .filter(
          (person) =>
            person.alive &&
            person.age >= 18 &&
            person.id !== npc.id &&
            person.location.scene === npc.location.scene &&
            distance(person.location, npc.location) <= 9 &&
            hasLineOfSight(person.location, npc.location, npc.location.scene),
        )
        .map((person) => person.id);
      const id = `crime:${state.nextId++}`;
      state.crimes.push({
        id,
        offender: "player",
        victim: npc.id,
        witnesses,
        evidence: [`victim:${npc.id}`, ...witnesses.map((witness) => `saw:${witness}`)],
        reported: false,
        status: "unreported",
        tick: state.tick,
        fine: heavy ? 25000 : 15000,
      });
      emit(
        state,
        "assault",
        `${npc.name} yaralandı. ${witnesses.length ? "Olayın tanıkları var." : "Çevrede tanık görünmüyor."}`,
        ["player", npc.id],
        npc.id,
        "witnessed",
        witnesses,
      );
      // Retaliation is fixed-tick, readable and affected by block/dodge rather than render FPS.
      state.flags.retaliateAt = state.tick + 8;
      state.flags.retaliateNpc = npc.id;
      notify(state, "Kavganın sağlık, güven ve hukuki sonuçları kaydedildi.");
    }
  }
  if (Number(state.flags.retaliateAt ?? 0) === state.tick) {
    const npc = state.npcs.find((item) => item.id === state.flags.retaliateNpc);
    if (
      npc &&
      npc.health > 0 &&
      nearby(state, npc) &&
      Number(state.flags.dodgeUntil ?? 0) < state.tick
    ) {
      const blocked = p.blocking && p.stamina >= 6;
      p.health = clamp(p.health - (blocked ? 3 : 11));
      if (blocked) p.stamina -= 6;
    }
  }
  if (p.health <= 0) {
    state.mobility.trip = null;
    p.goal = "recover";
    p.health = 45;
    p.stamina = 50;
    p.location = { ...INTERIOR_SPAWN, scene: "b-clinic" };
    p.shift = null;
    if (p.vehicleId) {
      const vehicle = state.vehicles.find((v) => v.id === p.vehicleId)!;
      vehicle.driverId = null;
      vehicle.speed = 0;
      p.vehicleId = null;
    }
    stop(state);
    const cost = Math.min(state.accounts.player, 10000);
    if (cost)
      transfer(
        state,
        `clinic:${state.nextId++}`,
        "player",
        "business:clinic",
        cost,
        "medical-care",
      );
    emit(
      state,
      "medical_recovery",
      "Baygınlık sonrası klinikte tedavi edildin. Hayatın devam ediyor.",
      ["player"],
      null,
      "private",
    );
    notify(state, "Klinikte uyandın. Sağlık ve geçim desteği yolları açık.");
  }
}
function playerMinute(state: WorldState): void {
  const p = state.player;
  if (state.minute % 15 === 0) {
    p.hunger = clamp(p.hunger + 1);
    p.fatigue = clamp(p.fatigue + 1);
    if (p.hunger >= 95) p.health = clamp(p.health - 1);
  }
  if (Number(state.flags.restUntil ?? 0) > state.minute) {
    p.fatigue = clamp(p.fatigue - 2);
    p.health = clamp(p.health + 1);
    p.stamina = 100;
  }
  if (p.shift) {
    const shift = p.shift,
      business = state.businesses.find((item) => item.id === shift.businessId)!;
    if (!atBuilding(state, business.buildingId) || p.wanted) {
      p.shift = null;
      notify(
        state,
        "İşyerinden ayrıldığın veya takibe girdiğin için vardiya iptal oldu; ücret ödenmedi.",
      );
    } else if (state.minute >= shift.endsAt) {
      if (
        transfer(
          state,
          `pay:${shift.id}`,
          `business:${business.id}`,
          "player",
          shift.wage,
          "player-payroll",
        )
      ) {
        p.income += shift.wage;
        p.fatigue = clamp(p.fatigue + 12);
        const job = JOBS.find((item) => item.id === p.jobId)!;
        p.skills[job.skill] = clamp(p.skills[job.skill] + 3);
        state.flags.shiftsCompleted = Number(state.flags.shiftsCompleted ?? 0) + 1;
        adjustRelation(state, business.ownerId, "player", 4);
        emit(
          state,
          "shift_completed",
          `${job.name} vardiyası tamamlandı; ${(shift.wage / 100).toFixed(0)} TL ödendi.`,
          ["player", business.ownerId],
          business.id,
          "private",
        );
        notify(
          state,
          `Vardiya bitti: +${(shift.wage / 100).toFixed(0)} TL. Beceri ve güvenin gelişti.`,
        );
      } else {
        business.status = "distressed";
        notify(state, "İşletmenin nakdi yetmedi. Gecikmiş ücret olayı kaydedildi.");
        emit(
          state,
          "late_wage",
          "İşletmenin maaş bütçesi yetmedi.",
          ["player", business.ownerId],
          business.id,
        );
      }
      p.shift = null;
    }
  }
  if (Number(state.flags.trainingUntil ?? 0) > 0) {
    if (!atBuilding(state, String(state.flags.trainingBuilding))) {
      state.flags.trainingUntil = 0;
      notify(state, "Ders mekânından ayrıldın; devam şartı sağlanmadığı için beceri verilmedi.");
    } else if (state.minute >= Number(state.flags.trainingUntil)) {
      const skill = String(state.flags.trainingSkill);
      p.skills[skill] = clamp(p.skills[skill] + 5);
      state.flags.trainingUntil = 0;
      if (p.skills.academic >= 20) state.flags.certificate = true;
      emit(state, "course_completed", `${skill} dersi tamamlandı.`, ["player"], null, "private");
      notify(state, "Ders tamamlandı; becerin 5 puan arttı.");
    }
  }
  if (state.minute % 1440 === 0)
    for (const business of state.businesses)
      if (business.ownerId === "player") {
        const profit = Math.min(
          15000,
          Math.max(
            0,
            state.accounts[`business:${business.id}`] - business.employees.length * business.wage,
          ),
        );
        if (profit)
          transfer(
            state,
            `profit:${state.minute}:${business.id}`,
            `business:${business.id}`,
            "player",
            profit,
            "owner-dividend",
          );
      }
}
export function stepWorld(state: WorldState, commands: Command[] = []): CommandResult[] {
  const results = commands.map((command) => applyCommand(state, command));
  if (state.progression.retired) return results;
  state.tick++;
  mobilityTick(state);
  movement(state);
  advanceTraffic(state);
  npcMovement(state);
  combat(state);
  if (state.tick % TICKS_PER_MINUTE === 0) {
    state.minute++;
    mobilityMinute(state);
    playerMinute(state);
    societyMinute(state);
    lifeMinute(state);
    economyMinute(state);
    missionMinute(state);
  }
  tickJustice(state);
  tickSocial(state);
  reconcileProgression(state);
  return results;
}
export function advanceMinutes(state: WorldState, minutes: number): void {
  if (!Number.isSafeInteger(minutes) || minutes < 0 || minutes > 5256000)
    throw new Error("Invalid advance interval");
  for (let tick = 0; tick < minutes * TICKS_PER_MINUTE; tick++) stepWorld(state);
}
export function projectWorld(state: WorldState): RenderProjection {
  return {
    economy: economyView(state),
    social: projectSocial(state),
    progression: progressionView(state),
    mobility: mobilityView(state),
    life: lifeView(state),
    tick: state.tick,
    minute: state.minute,
    player: structuredClone(state.player),
    npcs: state.npcs
      .slice(0, 100)
      .filter((npc) => npc.alive)
      .map((npc) => ({
        ...npc,
        location: { ...npc.location },
        path: [],
        memories: npc.memories.slice(-3),
        skills: { ...npc.skills },
      })),
    vehicles: structuredClone(state.vehicles),
    businesses: structuredClone(state.businesses),
    quests: state.quests
      .filter((quest) => quest.status === "active" || quest.status === "offered")
      .concat(state.quests.filter((quest) => quest.status === "complete").slice(-5))
      .map((quest) => ({ ...quest })),
    events: state.events
      .filter(
        (event) =>
          event.visibility === "public" ||
          event.actors.includes("player") ||
          event.witnesses.includes("player"),
      )
      .slice(-20)
      .map((event) => ({ ...event })),
    relations: state.relations
      .filter((edge) => edge.from === "player" || edge.to === "player")
      .map((edge) => ({ ...edge })),
    crimes: state.crimes
      .filter(
        (crime) =>
          crime.offender === "player" ||
          crime.victim === "player" ||
          crime.witnesses.includes("player") ||
          state.events.some(
            (event) => event.visibility === "public" && event.targetId === crime.id,
          ),
      )
      .map((crime) => ({
        ...crime,
        ...(crime.propertyLoss
          ? {
              propertyLoss: { ...crime.propertyLoss, location: { ...crime.propertyLoss.location } },
            }
          : {}),
        witnesses: [...crime.witnesses],
        evidence: [...crime.evidence],
      })),
    balance: state.accounts.player,
    notices: [...state.notices],
    population: state.npcs.filter((n) => n.alive).length,
    simMs: 0,
  };
}
export function validateState(
  state: WorldState,
  options: { allowBenchmark?: boolean } = {},
): string[] {
  try {
    const errors: string[] = [];
    if (!state || state.schemaVersion !== SCHEMA_VERSION || state.engineVersion !== ENGINE_VERSION)
      return ["unsupported-world-version"];
    if (
      !Number.isSafeInteger(state.seed) ||
      state.seed < 0 ||
      !Number.isSafeInteger(state.nextId) ||
      state.nextId < 1
    )
      errors.push("invalid-world-sequence");
    if (
      !Number.isSafeInteger(state.tick) ||
      state.tick < 0 ||
      !Number.isSafeInteger(state.minute) ||
      state.minute !== 480 + Math.floor(state.tick / 10)
    )
      errors.push("invalid-clock");
    const order = state.player.shift?.order;
    if (order !== undefined && (order !== "done" && order !== "retail" && order !== "mechanic" || order !== "done" && order !== state.player.jobId)) errors.push("invalid-work-order");
    const basePopulation =
      options.allowBenchmark && state.flags.benchmarkPopulation === 10000 ? 10000 : 1100;
    if (state.flags.benchmarkPopulation && !options.allowBenchmark)
      errors.push("benchmark-world-disabled-in-production");
    if (
      state.npcs.length < basePopulation ||
      state.npcs.length > basePopulation + 24 ||
      state.npcs.filter((npc) => npc.local).length !== 100
    )
      errors.push("invalid-population");
    if (
      state.npcs.some((npc, index) =>
        index < basePopulation
          ? npc.id !== `n${index}` || npc.local !== index < 100
          : !/^born:/.test(npc.id) || npc.local,
      ) ||
      state.player.id !== "player"
    )
      errors.push("invalid-person-index");
    for (const [key, value] of Object.entries(state.flags)) {
      if (
        !["string", "number", "boolean"].includes(typeof value) ||
        (typeof value === "number" && !Number.isFinite(value))
      )
        errors.push(`invalid-flag:${key}`);
      if (/^tx(?:set|exact):/.test(key) && !validTransactionBits(value))
        errors.push(`invalid-transaction-index:${key}`);
    }
    if (
      Number(state.flags.trainingUntil ?? 0) > 0 &&
      ![
        "academic",
        "driving",
        "combat",
        "communication",
        "technical",
        "trade",
        "body",
        "discipline",
      ].includes(String(state.flags.trainingSkill))
    )
      errors.push("invalid-training-skill");
    errors.push(...profileErrors(state.player.profile).map((error) => `profile:${error}`));
    const ids = new Set<string>(),
      householdIds = new Set(state.households.map((h) => h.id));
    for (const person of [state.player, ...state.npcs]) {
      if (ids.has(person.id)) errors.push(`duplicate-person:${person.id}`);
      ids.add(person.id);
      if (!isWalkable(person.location, person.location.scene))
        errors.push(`invalid-location:${person.id}`);
      if (
        !Array.isArray(person.path) ||
        person.path.some((point) => !isWalkable(point, person.location.scene))
      )
        errors.push(`invalid-path:${person.id}`);
      if (
        ![person.health, person.stamina, person.hunger, person.fatigue].every(
          (value) => Number.isFinite(value) && value >= 0 && value <= 100,
        )
      )
        errors.push(`invalid-needs:${person.id}`);
      if (
        !Object.values(person.skills).every(
          (value) => Number.isFinite(value) && value >= 0 && value <= 100,
        )
      )
        errors.push(`invalid-skills:${person.id}`);
      if (!Number.isSafeInteger(person.debt) || person.debt < 0)
        errors.push(`invalid-debt:${person.id}`);
      if (
        !Number.isInteger(person.age) ||
        person.age < 0 ||
        person.age > 130 ||
        typeof person.alive !== "boolean"
      )
        errors.push(`invalid-life-stage:${person.id}`);
      if ((!person.alive || person.age < 18) && (person.jobId || person.employerId))
        errors.push(`invalid-adult-employment:${person.id}`);
      if (person.alive && !householdIds.has(person.householdId))
        errors.push(`missing-household:${person.id}`);
      if (!(person.id in state.accounts)) errors.push(`missing-person-account:${person.id}`);
      if (
        person.employerId &&
        !state.businesses.some(
          (business) => business.id === person.employerId && business.employees.includes(person.id),
        )
      )
        errors.push(`employment-link:${person.id}`);
      if (
        person.jobId &&
        !JOBS.some((job) => job.id === person.jobId && job.businessId === person.employerId)
      )
        errors.push(`job-reference:${person.id}`);
    }
    for (const household of state.households) {
      if (
        household.members.length > 4 ||
        new Set(household.members).size !== household.members.length
      )
        errors.push(`housing-capacity:${household.id}`);
      for (const id of household.members) {
        const person = id === "player" ? state.player : state.npcs.find((n) => n.id === id);
        if (
          !person ||
          !person.alive ||
          person.householdId !== household.id ||
          person.homeId !== household.homeId
        )
          errors.push(`household-link:${id}`);
      }
    }
    for (const business of state.businesses) {
      const owner =
        business.ownerId === "player"
          ? state.player
          : state.npcs.find((n) => n.id === business.ownerId);
      if (!owner?.alive || owner.age < 18 || !owner.propertyIds.includes(business.id))
        errors.push(`business-ownership:${business.id}`);
      if (
        !ids.has(business.ownerId) ||
        !BUILDINGS.some((building) => building.id === business.buildingId)
      )
        errors.push(`business-reference:${business.id}`);
      if (Object.values(business.stock).some((value) => !Number.isSafeInteger(value) || value < 0))
        errors.push(`negative-stock:${business.id}`);
      if (new Set(business.employees).size !== business.employees.length)
        errors.push(`duplicate-employee:${business.id}`);
      for (const employee of business.employees) {
        const person =
          employee === "player" ? state.player : state.npcs.find((n) => n.id === employee);
        if (!ids.has(employee) || person?.employerId !== business.id)
          errors.push(`unknown-employee:${employee}`);
      }
    }
    for (const [item, amount] of Object.entries(state.player.inventory))
      if (
        !Number.isSafeInteger(amount) ||
        amount <= 0 ||
        (!Object.hasOwn(ITEMS, item) && !item.startsWith("parcel:"))
      )
        errors.push(`invalid-inventory:${item}`);
    const eventIds = new Set(state.events.map((event) => event.id));
    if (eventIds.size !== state.events.length || state.eventCount !== state.events.length)
      errors.push("event-journal");
    for (const event of state.events) {
      if (!event.actors.every((id) => ids.has(id)) || !event.witnesses.every((id) => ids.has(id)))
        errors.push(`event-reference:${event.id}`);
      if (event.causeId && !eventIds.has(event.causeId)) errors.push(`missing-cause:${event.id}`);
    }
    for (const edge of state.relations)
      if (
        !ids.has(edge.from) ||
        !ids.has(edge.to) ||
        ![edge.trust, edge.affection, edge.fear, edge.resentment].every(
          (value) => Number.isFinite(value) && value >= -100 && value <= 100,
        )
      )
        errors.push(`invalid-relation:${edge.from}:${edge.to}`);
    for (const quest of state.quests) {
      if (!["offered", "active", "complete", "failed", "expired"].includes(quest.status))
        errors.push(`quest-status:${quest.id}`);
      if (
        !ids.has(quest.issuerId) ||
        !ids.has(quest.targetId) ||
        !eventIds.has(quest.sourceEvent) ||
        !BUILDINGS.some((building) => building.id === quest.buildingId)
      )
        errors.push(`quest-reference:${quest.id}`);
      const expectedEscrow =
        quest.status === "active" || quest.status === "offered" ? quest.reward : 0;
      if (state.accounts[`escrow:${quest.id}`] !== expectedEscrow)
        errors.push(`quest-funding:${quest.id}`);
    }
    for (const vehicle of state.vehicles) {
      const expected = trafficPose(vehicle.lane, vehicle.progress);
      if (
        (!parkedAt(state, vehicle.id) && distance(expected, vehicle.location) > 0.002) ||
        !Number.isInteger(vehicle.lane) ||
        vehicle.lane < 0 ||
        vehicle.lane >= ROADS.length ||
        !Number.isFinite(vehicle.progress) ||
        vehicle.progress < 0 ||
        vehicle.progress >= laneLength(vehicle.lane) ||
        !Number.isFinite(vehicle.speed) ||
        vehicle.speed < 0 ||
        vehicle.speed > 6 ||
        !Number.isFinite(vehicle.heading) ||
        !isWalkable(vehicle.location)
      )
        errors.push(`invalid-vehicle:${vehicle.id}`);
      if (
        vehicle.driverId === "player" &&
        (state.player.vehicleId !== vehicle.id ||
          distance(state.player.location, vehicle.location) > 0.001)
      )
        errors.push(`vehicle-player:${vehicle.id}`);
      if (vehicle.driverId && !ids.has(vehicle.driverId))
        errors.push(`unknown-driver:${vehicle.id}`);
    }
    if (
      state.player.vehicleId &&
      !state.vehicles.some(
        (vehicle) => vehicle.id === state.player.vehicleId && vehicle.driverId === "player",
      )
    )
      errors.push("player-vehicle-reference");
    for (const crime of state.crimes) {
      if (
        !ids.has(crime.offender) ||
        !ids.has(crime.victim) ||
        !crime.witnesses.every((id) => ids.has(id)) ||
        !["unreported", "investigating", "pursuit", "resolved"].includes(crime.status) ||
        !Number.isSafeInteger(crime.fine) ||
        crime.fine < 0
      )
        errors.push(`invalid-crime:${crime.id}`);
    }
    if (state.player.debt !== Number(state.flags.loanAsset ?? 0)) errors.push("player-loan-asset");
    errors.push(
      ...reconcile(state),
      ...validateLife(state),
      ...validateMobility(state),
      ...validateSocial(state),
      ...validateProgression(state),
      ...validateProperty(state),
      ...validateEconomy(state),
      ...validateMissionReservations(state),
    );
    return errors;
  } catch (error) {
    return [`malformed-world:${error instanceof Error ? error.message : "unknown"}`];
  }
}
