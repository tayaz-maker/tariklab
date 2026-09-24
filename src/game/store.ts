import { validateSaveSlice } from "./save-validation";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { track } from "@/lib/analytics";
import {
  clearSlot,
  isSlotIndex,
  migrateLegacyToSlot1,
  readActiveSlot,
  readSlotRaw,
  slotKey,
  writeActiveSlot,
  writeSlotRaw,
  type SlotIndex,
} from "@/lib/save-slots";
import { clamp, pick, randInt } from "@/lib/utils";
import {
  applyTicks,
  canAct,
  pushLog,
} from "./clock";
import {
  ALL_MISSIONS,
  CLINIC_TICKS,
  CLINIC_VOLUNTARY_TICKS,
  CONTRACT_MAP,
  CREW_MAP,
  ESTATE_MAP,
  ESNAF_COST,
  ESNAF_STAMINA,
  HEALTH_MAX,
  HEAT_MAX,
  HORSE_NAMES,
  HORSE_PRICE,
  HORSE_TRAIN,
  IHBAR_STAMINA,
  ITEM_MAP,
  JAIL_TICKS,
  JOB_FLAVOR,
  LIFE_KID_MAX,
  MARKET_START,
  PARTNER_MAP,
  PVP_STAMINA_COST,
  RACE_FIELD,
  RISK_HEAT,
  RIVAL_CLINIC_TICKS,
  SAVE_KEY,
  SAVE_VERSION,
  SELL_RATE,
  SPOUSES,
  TICKS_PER_HOUR,
  TURF_STAMINA,
  holdingOf,
  hoodName,
  koseUpgradeCost,
  pickRaceWinner,
  estateLevel,
  hydratePlayer,
  jobEnergyCost,
  makeRivals,
  migrateHood,
  tefeciLoanTerms,
  upgradeCost,
  turfPressCash,
} from "./data";
import {
  applyXp,
  assignCrewTicks,
  energyMax,
  freeCrew,
  jailChance,
  jobSuccessChance,
  lakap,
  missionCrewBlock,
  missionCrewNeed,
  playerCombat,
  RISK_DMG,
  staminaMax,
} from "./formulas";
import type {
  CrewId,
  FamilyChoice,
  GambleKind,
  InvestId,
  LifeId,
  LogEntry,
  Market,
  NeighborhoodId,
  Player,
  RelAct,
  Rival,
} from "./types";
import { ACHIEVEMENTS, unlockAchievements, applyDailyStreak } from "./meta";

interface GameState {
  version: number;
  player: Player | null;
  rivals: Rival[];
  logs: LogEntry[];
  hiz: 1 | 2 | 4;
  market: Market;
  savedAt: number;
  activeSlot: SlotIndex;
  createPlayer: (name: string, neighborhood: NeighborhoodId) => void;
  tick: (n?: number) => void;
  skipHour: () => void;
  toggleHiz: () => void;
  doJob: (missionId: string) => void;
  buyItem: (itemId: string) => void;
  sellItem: (itemId: string) => void;
  equipItem: (itemId: string) => void;
  buyEstate: (estateId: string) => void;
  attackRival: (rivalId: string) => void;
  putBounty: (rivalId: string, amount: number) => void;
  huntBounty: (rivalId: string) => void;
  depositBribe: (amount: number) => void;
  payBribe: () => void;
  treatClinic: () => void;
  hireCrew: (id: CrewId) => void;
  fireCrew: (id: CrewId) => void;
  pressTurf: (hood: NeighborhoodId) => void;
  snitchHood: (hood: NeighborhoodId) => void;
  sitEsnafBar: (hood: NeighborhoodId) => void;
  bankMove: (amount: number, dir: "in" | "out") => void;
  writeSenet: (kind: "alacak" | "borc", rivalId?: string) => void;
  upgradeEstate: (estateId: string) => void;
  live: (id: LifeId) => void;
  gamble: (kind: GambleKind, stake: number, pick?: string) => void;
  betRace: (index: number, stake: number) => void;
  buyHorse: () => void;
  trainHorse: () => void;
  raceHorse: () => void;
  relate: (partnerId: string, act: RelAct) => void;
  resolveFamily: (choice: FamilyChoice) => void;
  tradeInvest: (id: InvestId, dir: "al" | "sat", units: number) => void;
  fundKose: () => void;
  adoptCloudSave: (state: Record<string, unknown>) => void;
  resetGame: () => void;
  loadSlot: (slot: SlotIndex) => boolean;
  saveToSlot: (slot: SlotIndex) => boolean;
  clearPlaySlot: (slot: SlotIndex) => boolean;
  ackSeason: () => void;
  skipTutorial: () => void;
  bumpTutorial: (step: number) => void;
  claimDaily: () => void;
}

function neighborhoodName(id: NeighborhoodId) {
  return hoodName(id);
}

function bumpRel(p: Player, id: string, d: number): Player {
  const relations = { ...(p.relations ?? {}) };
  relations[id] = clamp((relations[id] ?? 0) + d, 0, 100);
  return { ...p, relations };
}

function knockOut(
  player: Player,
  logs: LogEntry[],
): { player: Player; logs: LogEntry[] } {
  const fee = Math.round(player.cash * 0.15);
  const next: Player = {
    ...player,
    cash: Math.max(0, player.cash - fee),
    health: 1,
    durum: "klinik",
    durumTick: CLINIC_TICKS,
    saglikIzi: Math.max(player.saglikIzi ?? 0, 18),
  };
  return {
    player: next,
    logs: pushLog(
      logs,
      next,
      "clinic",
      `Canın sıfırlandı. Mafya doktorunun gizli kliniğine kaldırıldın. Tedavi ${fee.toLocaleString("tr-TR")} ₺ — nakitinin yüzde 15'i.`,
      -fee,
    ),
  };
}

function maybeLevelNotes(player: Player, notes: string[], logs: LogEntry[]) {
  let next = logs;
  for (const n of notes) next = pushLog(next, player, "system", n);
  return next;
}

function withMeta(player: Player, logs: LogEntry[]): { player: Player; logs: LogEntry[] } {
  const ach = unlockAchievements(player);
  let nextLogs = logs;
  for (const id of ach.unlocked) {
    const label = ACHIEVEMENTS.find((a) => a.id === id)?.label ?? id;
    nextLogs = pushLog(nextLogs, ach.player, "system", `Başarım: ${label}`);
  }
  return { player: ach.player, logs: nextLogs };
}

const emptyPersist = {
  version: SAVE_VERSION,
  player: null as Player | null,
  rivals: [] as Rival[],
  logs: [] as LogEntry[],
  hiz: 1 as 1 | 2 | 4,
  market: { ...MARKET_START },
  savedAt: 0,
  activeSlot: 1 as SlotIndex,
};

function parseHiz(v: unknown): 1 | 2 | 4 {
  return v === 2 || v === 4 ? v : 1;
}

function normalizeSlice(s: Record<string, unknown>) {
  validateSaveSlice(s);
  const playerRaw = s.player as Player | null | undefined;
  const player =
    playerRaw && typeof playerRaw === "object"
      ? hydratePlayer({
          ...playerRaw,
          name: playerRaw.name || "İsimsiz",
          neighborhood: migrateHood(playerRaw.neighborhood),
        })
      : null;
  const rivals = Array.isArray(s.rivals)
    ? (s.rivals as Rival[]).map((r) => ({
        ...r,
        hospitalTicks: r.hospitalTicks ?? 0,
        revengeTicks: r.revengeTicks ?? 0,
        hood: migrateHood(r.hood),
      }))
    : [];
  const logs = Array.isArray(s.logs) ? (s.logs as LogEntry[]).slice(0, 40) : [];
  const market =
    s.market && typeof s.market === "object"
      ? { ...MARKET_START, ...(s.market as Market) }
      : { ...MARKET_START };
  return {
    version: SAVE_VERSION,
    player,
    rivals,
    logs,
    hiz: parseHiz(s.hiz),
    market,
    savedAt: typeof s.savedAt === "number" ? s.savedAt : 0,
  };
}

function loadPersistedSlice() {
  if (typeof window === "undefined") return { ...emptyPersist, market: { ...MARKET_START } };
  let slot: SlotIndex = 1;
  try {
    const storage = window.localStorage;
    migrateLegacyToSlot1(storage, "cete", [SAVE_KEY]);
    slot = readActiveSlot(storage, "cete");
    const raw = readSlotRaw(storage, "cete", slot);
    if (!raw) return { ...emptyPersist, activeSlot: slot, market: { ...MARKET_START } };
    const parsed = JSON.parse(raw) as { state?: Record<string, unknown> };
    return { ...normalizeSlice((parsed.state ?? parsed) as Record<string, unknown>), activeSlot: slot };
  } catch {
    return { ...emptyPersist, activeSlot: slot, market: { ...MARKET_START } };
  }
}

const bootSlice = loadPersistedSlice();

let persistTimer: ReturnType<typeof setTimeout> | null = null;
let persistPending: { name: string; value: unknown } | null = null;

function flushPersist() {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  if (!persistPending || typeof window === "undefined") return;
  try {
    const raw =
      typeof persistPending.value === "string"
        ? persistPending.value
        : JSON.stringify(persistPending.value);
    window.localStorage.setItem(persistPending.name, raw);
  } catch {
    /* quota */
  }
  persistPending = null;
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", flushPersist);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) flushPersist();
  });
}

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      ...emptyPersist,
      ...bootSlice,
      createPlayer: (name, neighborhood) => {
        const trimmed = name.trim().slice(0, 24) || "İsimsiz";
        const level = 1;
        let refFrom: string | null = null;
        if (typeof window !== "undefined") {
          const q = new URLSearchParams(window.location.search).get("ref");
          if (q && q.trim() && q.trim().toLowerCase() !== trimmed.toLowerCase()) {
            refFrom = q.trim().slice(0, 24);
          }
        }
        const player = hydratePlayer({
          name: trimmed,
          neighborhood,
          level,
          xp: 0,
          energy: energyMax(level, neighborhood),
          stamina: staminaMax(level),
          health: HEALTH_MAX,
          cash: 0,
          rusvet: 0,
          itibar: neighborhood === "eyup" ? 5 : 0,
          inventory: ["w101"],
          equippedWeapon: "w101",
          incomeMult: neighborhood === "kadikoy" ? 1.15 : 1,
          contractId: "c101",
          contractGun: 1,
          refFrom,
        });
        track("karakter_olusturuldu", { hood: neighborhood });
        set({
          player,
          rivals: makeRivals(),
          logs: pushLog(
            [],
            player,
            "system",
            `${trimmed}, ${lakap(1)} olarak ${neighborhoodName(neighborhood)} sokaklarına indi. Elinde kırık bir Efes şişesi, cebin bomboş. İş yapmadan ₺ basmaz.`,
          ),
          hiz: 1,
          market: { ...MARKET_START },
          savedAt: Date.now(),
        });
      },
      tick: (n = 1) => {
        const s = get();
        if (!s.player) return;
        const steps = Math.max(1, Math.min(8, Math.floor(n)));
        try {
          const next = applyTicks(
            {
              player: s.player,
              rivals: s.rivals,
              logs: s.logs,
              market: s.market ?? MARKET_START,
            },
            steps,
          );
          set(next);
        } catch (err) {
          console.error(err);
        }
      },
      skipHour: () => {
        const s = get();
        if (!s.player) return;
        try {
          const next = applyTicks(
            {
              player: s.player,
              rivals: s.rivals,
              logs: s.logs,
              market: s.market ?? MARKET_START,
            },
            TICKS_PER_HOUR,
          );
          set({
            ...next,
            logs: pushLog(
              next.logs,
              next.player,
              "system",
              "Bir saat geçti. Sokak kendi işini gördü.",
            ),
          });
        } catch (err) {
          console.error(err);
        }
      },
      toggleHiz: () => {
        const cur = get().hiz;
        set({ hiz: cur === 1 ? 2 : cur === 2 ? 4 : 1 });
      },
      doJob: (missionId) => {
        const s = get();
        const player = s.player;
        if (!player) return;
        if (!canAct(player)) return;
        const mission = ALL_MISSIONS.find((m) => m.id === missionId);
        if (!mission) return;
        const cost = jobEnergyCost(player, mission.energyCost);
        if (player.energy < cost) return;
        const missing = (mission.requiredItems ?? []).filter(
          (id) => !player.inventory.includes(id),
        );
        if (missing.length) return;
        const crewBlock = missionCrewBlock(player, mission.risk);
        if (crewBlock) return;

        let next = {
          ...player,
          energy: player.energy - cost,
        };
        const need = missionCrewNeed(mission.risk);
        if (need > 0) {
          const picked = freeCrew(player).slice(0, need);
          const busy = { ...(player.crewBusy ?? {}) };
          const ticks = assignCrewTicks(mission.risk);
          for (const id of picked) busy[id] = ticks;
          next = { ...next, crewBusy: busy };
        }
        let logs = s.logs;
        const chance = jobSuccessChance(player, mission.risk, mission.id);
        const success = Math.random() < chance;
        const flavor = JOB_FLAVOR[mission.id];
        const heatAdd =
          (RISK_HEAT[mission.risk] ?? 8) + (success ? 0 : 6);

        if (success) {
          const cash = randInt(mission.rewardCashMin, mission.rewardCashMax);
          const xp = applyXp(next, mission.xpGain);
          let bonus = 0;
          let contractNote = "";
          const c = next.contractId ? CONTRACT_MAP[next.contractId] : null;
          if (c && c.missionId === mission.id) {
            bonus = c.bonus;
            contractNote = ` ${c.npc} bonus ${bonus.toLocaleString("tr-TR")} ₺.`;
            next.contractId = null;
          }
          next = {
            ...next,
            cash: next.cash + cash + bonus,
            xp: xp.xp,
            level: xp.level,
            energy: xp.notes.length ? xp.energy : next.energy,
            stamina: xp.notes.length ? xp.stamina : next.stamina,
            itibar: next.itibar + Math.max(1, Math.round(mission.xpGain / 4)),
            health: clamp(next.health - randInt(0, 4), 1, HEALTH_MAX),
            isi: clamp(next.isi + heatAdd, 0, HEAT_MAX),
            seasonScore: next.seasonScore + mission.xpGain + Math.round(cash / 800),
            jobsDone: (next.jobsDone ?? 0) + 1,
          };
          if ((player.jobsDone ?? 0) === 0) {
            track("ilk_is_yapildi");
            if (next.refFrom && !next.refClaimed) {
              next = { ...next, cash: next.cash + 5000, refClaimed: true };
              logs = pushLog(
                logs,
                next,
                "system",
                `${next.refFrom} referansı. İkinize de 5.000 ₺ — bir kez.`,
                5000,
              );
            }
          }
          const ach = withMeta(next, logs);
          next = ach.player;
          logs = ach.logs;
          logs = pushLog(
            logs,
            next,
            "job",
            `${mission.name} — ${pick(flavor?.win ?? ["İş bitti."])} +${(cash + bonus).toLocaleString("tr-TR")} ₺.${contractNote} Emniyet ${Math.round(next.isi)}.`,
            cash + bonus,
          );
          logs = maybeLevelNotes(next, xp.notes, logs);
          if ((next.tutorialStep ?? 0) === 0) next = { ...next, tutorialStep: 1 };
          const rivals = s.rivals.map((r) =>
            r.alive && r.hood === next.neighborhood && r.hospitalTicks === 0
              ? { ...r, revengeTicks: Math.max(r.revengeTicks ?? 0, randInt(6, 16)) }
              : r,
          );
          set({ player: next, rivals, logs, savedAt: Date.now() });
          return;
        }

        const [d0, d1] = RISK_DMG[mission.risk];
        const dmg = randInt(d0, d1);
        next.health = next.health - dmg;
        next.itibar = Math.max(0, next.itibar - 2);
        next.isi = clamp(next.isi + heatAdd, 0, HEAT_MAX);
        next.jobsDone = (next.jobsDone ?? 0) + 1;
        const busted = Math.random() < jailChance(player, mission.risk);

        if (next.health <= 0) {
          const ko = knockOut(next, logs);
          next = ko.player;
          logs = ko.logs;
          logs = pushLog(
            logs,
            next,
            "job",
            `${mission.name} — ${pick(flavor?.lose ?? ["İş patladı."])} Yerde kaldın.`,
          );
          set({ player: next, logs });
          return;
        }

        if (busted) {
          next = {
            ...next,
            durum: "nezaret",
            durumTick: JAIL_TICKS,
          };
          logs = pushLog(
            logs,
            next,
            "jail",
            `${mission.name} — ${pick(flavor?.lose ?? ["Devriye köşeyi döndü."])} Polis yakaladı. Bir saat nezarethane. Zarfı Klinik'ten uzatabilirsin.`,
          );
          set({ player: next, logs });
          return;
        }

        logs = pushLog(
          logs,
          next,
          "job",
          `${mission.name} — ${pick(flavor?.lose ?? ["Kaçtın."])} −${dmg} can.`,
        );
        set({ player: next, logs });
      },
      buyItem: (itemId) => {
        const s = get();
        const player = s.player;
        if (!player) return;
        const item = ITEM_MAP[itemId];
        if (!item) return;
        if (player.inventory.includes(itemId)) return;
        if (player.cash < item.price) return;
        const next: Player = {
          ...player,
          cash: player.cash - item.price,
          inventory: [...player.inventory, itemId],
          itibar: player.itibar + (item.itibarBonus ?? 0),
        };
        if (item.kind === "weapon" && !player.equippedWeapon)
          next.equippedWeapon = itemId;
        if (item.kind === "armor" && !player.equippedArmor)
          next.equippedArmor = itemId;
        if (item.kind === "vehicle" && !player.equippedVehicle)
          next.equippedVehicle = itemId;
        if ((next.tutorialStep ?? 0) === 1 && item.kind === "weapon")
          next.tutorialStep = 2;
        set({
          player: next,
          logs: pushLog(
            s.logs,
            next,
            "shop",
            `${item.name} alındı.`,
            -item.price,
          ),
        });
      },
      sellItem: (itemId) => {
        const s = get();
        const player = s.player;
        if (!player) return;
        const item = ITEM_MAP[itemId];
        if (!item || item.price <= 0) return;
        if (!player.inventory.includes(itemId)) return;
        const refund = Math.round(item.price * SELL_RATE);
        const next: Player = {
          ...player,
          cash: player.cash + refund,
          inventory: player.inventory.filter((id) => id !== itemId),
          itibar: Math.max(0, player.itibar - (item.itibarBonus ?? 0)),
          equippedWeapon:
            player.equippedWeapon === itemId ? null : player.equippedWeapon,
          equippedArmor:
            player.equippedArmor === itemId ? null : player.equippedArmor,
          equippedVehicle:
            player.equippedVehicle === itemId ? null : player.equippedVehicle,
        };
        set({
          player: next,
          logs: pushLog(
            s.logs,
            next,
            "shop",
            `${item.name} elden çıkarıldı. +${refund.toLocaleString("tr-TR")} ₺`,
            refund,
          ),
        });
      },
      equipItem: (itemId) => {
        const s = get();
        const player = s.player;
        if (!player || !player.inventory.includes(itemId)) return;
        const item = ITEM_MAP[itemId];
        if (!item) return;
        const next = { ...player };
        if (item.kind === "weapon") next.equippedWeapon = itemId;
        if (item.kind === "armor") next.equippedArmor = itemId;
        if (item.kind === "vehicle") next.equippedVehicle = itemId;
        set({ player: next });
      },
      buyEstate: (estateId) => {
        const s = get();
        const player = s.player;
        if (!player) return;
        const estate = ESTATE_MAP[estateId];
        if (!estate) return;
        if (player.properties.includes(estateId)) return;
        if (player.cash < estate.cost) return;
        const next = {
          ...player,
          cash: player.cash - estate.cost,
          properties: [...player.properties, estateId],
          itibar: player.itibar + (estate.prestige ?? 8 + estate.hourlyIncome / 500),
        };
        set({
          player: next,
          logs: pushLog(
            s.logs,
            next,
            "estate",
            `${estate.name} senin. Saatlik ${estate.hourlyIncome.toLocaleString("tr-TR")} ₺ akar.`,
            -estate.cost,
          ),
        });
      },
      attackRival: (rivalId) => {
        const s = get();
        const player = s.player;
        if (!player) return;
        if (!canAct(player)) return;
        if (player.stamina < PVP_STAMINA_COST) return;
        const rival = s.rivals.find((r) => r.id === rivalId);
        if (!rival || rival.hospitalTicks > 0) return;

        let next = { ...player, stamina: player.stamina - PVP_STAMINA_COST };
        const you = playerCombat(next);
        const rAtk = rival.attack * (0.85 + Math.random() * 0.3);
        const yAtk = you.atk * (0.85 + Math.random() * 0.3);
        const win = yAtk >= rAtk;
        let logs = s.logs;
        const rivals = s.rivals.map((r) => ({ ...r }));
        const target = rivals.find((r) => r.id === rivalId);
        if (!target) return;
        const jamNote = you.jammed
          ? " Hayalet Canik tutukluk yaptı."
          : "";

        if (win) {
          const takePct = 0.1 + Math.random() * 0.12;
          const loot = Math.max(80, Math.round(target.cash * takePct));
          target.cash -= loot;
          target.health = Math.max(0, target.health - randInt(18, 40));
          next.cash += loot;
          next.itibar += 4;
          next.health = clamp(next.health - randInt(2, 10), 1, HEALTH_MAX);
          next.isi = clamp(next.isi + 6, 0, HEAT_MAX);
          next.seasonScore += 8;
          next.saglikIzi = Math.max(next.saglikIzi ?? 0, 6);
          if (target.health <= 0) {
            target.hospitalTicks = RIVAL_CLINIC_TICKS;
            target.health = 0;
          }
          target.revengeTicks = Math.max(target.revengeTicks ?? 0, randInt(12, 36));
          logs = pushLog(
            logs,
            next,
            "pvp",
            `${target.name} yere serildi. ${loot.toLocaleString("tr-TR")} ₺ gasp edildi.${jamNote}`,
            loot,
          );
          set({ player: next, rivals, logs });
          return;
        }

        const dmg = randInt(14, 36);
        next.health -= dmg;
        next.itibar = Math.max(0, next.itibar - 3);
        next.isi = clamp(next.isi + 10, 0, HEAT_MAX);
        next.saglikIzi = Math.max(next.saglikIzi ?? 0, 10);
        const lost = Math.min(next.cash, Math.round(next.cash * 0.08));
        next.cash -= lost;
        target.cash += lost;
        logs = pushLog(
          logs,
          next,
          "pvp",
          `${target.name} raconu kesti. ${lost.toLocaleString("tr-TR")} ₺ kaptırdın.${jamNote}`,
          -lost,
        );
        if (next.health <= 0) {
          const ko = knockOut(next, logs);
          next = ko.player;
          logs = ko.logs;
        }
        set({
          player: next,
          rivals,
          logs,
        });
      },
      putBounty: (rivalId, amount) => {
        const s = get();
        const player = s.player;
        if (!player) return;
        const cash = Math.round(amount);
        if (!Number.isFinite(cash) || cash < 500) return;
        if (player.cash < cash) return;
        const rivals = s.rivals.map((r) =>
          r.id === rivalId ? { ...r, bounty: r.bounty + cash } : r,
        );
        const name = s.rivals.find((r) => r.id === rivalId)?.name ?? "Hedef";
        const next = { ...player, cash: player.cash - cash };
        set({
          player: next,
          rivals,
          logs: pushLog(
            s.logs,
            next,
            "bounty",
            `${name} ölüm listesine yazıldı. Ödül ${cash.toLocaleString("tr-TR")} ₺. Saat ilerleyince sokak mermi kusar.`,
            -cash,
          ),
        });
      },
      huntBounty: (rivalId) => {
        get().attackRival(rivalId);
        const after = get();
        if (!after.player) return;
        const rival = after.rivals.find((r) => r.id === rivalId);
        if (!rival || rival.health > 0) return;
        if (rival.bounty <= 0) return;
        const payout = rival.bounty;
        const next = {
          ...after.player,
          cash: after.player.cash + payout,
          itibar: after.player.itibar + 6,
        };
        set({
          player: next,
          rivals: after.rivals.map((r) =>
            r.id === rivalId ? { ...r, bounty: 0 } : r,
          ),
          logs: pushLog(
            after.logs,
            next,
            "bounty",
            `Topuktan vurma emri tamam. ${rival.name} düştü. Ödül ${payout.toLocaleString("tr-TR")} ₺.`,
            payout,
          ),
        });
      },
      depositBribe: (amount) => {
        const s = get();
        const player = s.player;
        if (!player) return;
        const n = Math.round(amount);
        if (!Number.isFinite(n) || n <= 0 || player.cash < n) return;
        const next = { ...player, cash: player.cash - n, rusvet: player.rusvet + n };
        set({
          player: next,
          logs: pushLog(
            s.logs,
            next,
            "system",
            `Rüşvet kasasına ${n.toLocaleString("tr-TR")} ₺ ayrıldı.`,
            -n,
          ),
        });
      },
      payBribe: () => {
        const s = get();
        const player = s.player;
        if (!player) return;
        const cost = player.durum === "nezaret" ? 3000 * player.level + 2000 : 0;
        if (!cost) return;
        const fromPool = Math.min(player.rusvet, cost);
        const rest = cost - fromPool;
        if (player.cash < rest) return;
        const next = {
          ...player,
          rusvet: player.rusvet - fromPool,
          cash: player.cash - rest,
          durum: "serbest" as const,
          durumTick: 0,
        };
        set({
          player: next,
          logs: pushLog(
            s.logs,
            next,
            "jail",
            `Emniyet amiri zarfı aldı. Bu gece nezarethane yok. −${cost.toLocaleString("tr-TR")} ₺`,
            -cost,
          ),
        });
      },
      treatClinic: () => {
        const s = get();
        const player = s.player;
        if (!player) return;
        if (player.durum !== "serbest") return;
        if (player.health >= HEALTH_MAX) return;
        const fee = Math.round(player.cash * 0.15);
        if (player.cash < fee && fee > 0) return;
        const next: Player = {
          ...player,
          cash: Math.max(0, player.cash - fee),
          durum: "klinik",
          durumTick: CLINIC_VOLUNTARY_TICKS,
          saglikIzi: Math.max(player.saglikIzi ?? 0, 8),
        };
        set({
          player: next,
          logs: pushLog(
            s.logs,
            next,
            "clinic",
            `Kliniğe kendin gittin. Doktor peşin istedi: ${fee.toLocaleString("tr-TR")} ₺. 40 dakika.`,
            -fee,
          ),
        });
      },
      hireCrew: (id) => {
        const s = get();
        const player = s.player;
        if (!player) return;
        if (player.crew.includes(id)) return;
        const def = CREW_MAP[id];
        if (!def) return;
        if (player.cash < def.hire) return;
        if (player.itibar < def.itibar) return;
        const next: Player = {
          ...player,
          cash: player.cash - def.hire,
          crew: [...player.crew, id],
          itibar: player.itibar + 2,
        };
        set({
          player: next,
          logs: pushLog(
            s.logs,
            next,
            "crew",
            `${def.name} ekibe girdi. Saatlik ${def.wage.toLocaleString("tr-TR")} ₺ yer.`,
            -def.hire,
          ),
        });
      },
      fireCrew: (id) => {
        const s = get();
        const player = s.player;
        if (!player || !player.crew.includes(id) || (player.crewBusy[id] ?? 0) > 0) return;
        const def = CREW_MAP[id];
        const next: Player = {
          ...player,
          crew: player.crew.filter((c) => c !== id),
          itibar: Math.max(0, player.itibar - 1),
        };
        set({
          player: next,
          logs: pushLog(
            s.logs,
            next,
            "crew",
            `${def?.name ?? "Adam"} defterden silindi.`,
          ),
        });
      },
      pressTurf: (hood) => {
        const s = get();
        const player = s.player;
        if (!player) return;
        if (!canAct(player)) return;
        if (player.stamina < TURF_STAMINA) return;
        const cur = player.turf[hood] ?? 0;
        if (cur >= 100) return;
        const home = hood === player.neighborhood;
        const gain = (home ? 16 : 12) + Math.random() * 8;
        const after = Math.round(clamp(cur + gain, 0, 100) * 10) / 10;
        const lootRaw = turfPressCash(hood, after);
        const loot = Math.round(lootRaw * ((player.isi ?? 0) >= 70 ? 0.7 : (player.isi ?? 0) >= 45 ? 0.85 : 1));
        let extra = 0;
        let note = "";
        if (cur < 50 && after >= 50) {
          extra = 1800;
          note = " Yarı semt sende — haraç şişti.";
        } else if (cur < 75 && after >= 75) {
          extra = 2800;
          note = " Ağır el. Saldırı ve iş açıldı.";
        } else if (cur < 100 && after >= 100) {
          extra = 5200;
          note = " Semt kapandı. Haraç +%20.";
        }
        const xpGain = home ? 6 : 4;
        const grown = applyXp(
          { ...player, stamina: player.stamina - TURF_STAMINA },
          xpGain,
        );
        let next: Player = {
          ...player,
          stamina: grown.stamina,
          energy: grown.energy,
          xp: grown.xp,
          level: grown.level,
          cash: player.cash + loot + extra,
          isi: clamp(player.isi + 3, 0, HEAT_MAX),
          turf: {
            ...player.turf,
            [hood]: after,
          },
          itibar: player.itibar + (after >= 50 ? 3 : 2),
          seasonScore: player.seasonScore + 6,
        };
        const name = hoodName(hood);
        if ((next.tutorialStep ?? 0) === 2) next = { ...next, tutorialStep: 3 };
        const meta = withMeta(next, s.logs);
        next = meta.player;
        let logs = pushLog(
          meta.logs,
          next,
          "turf",
          `${name} basıldı. Kontrol %${Math.round(after)}. Haraç ${loot.toLocaleString("tr-TR")} ₺ cebine.${note}`,
          loot + extra,
        );
        logs = maybeLevelNotes(next, grown.notes, logs);
        set({ player: next, logs });
      },
      snitchHood: (hood) => {
        const s = get();
        const player = s.player;
        if (!player) return;
        if (!canAct(player)) return;
        if (player.stamina < IHBAR_STAMINA) return;
        const targets = s.rivals.filter(
          (r) => r.hood === hood && r.hospitalTicks === 0 && r.alive,
        );
        if (!targets.length) {
          const next = {
            ...player,
            stamina: player.stamina - IHBAR_STAMINA,
            isi: clamp(player.isi + 5, 0, HEAT_MAX),
          };
          set({
            player: next,
            logs: pushLog(
              s.logs,
              next,
              "turf",
              `${hoodName(hood)} ihbarı boş döndü. Muhbir yandı, emniyet ısındı.`,
            ),
          });
          return;
        }
        const target = pick(targets);
        const rivals = s.rivals.map((r) =>
          r.id === target.id
            ? {
                ...r,
                health: Math.max(0, r.health - randInt(22, 40)),
                hospitalTicks: RIVAL_CLINIC_TICKS,
                cash: Math.max(0, r.cash - randInt(400, 1800)),
                revengeTicks: Math.max(r.revengeTicks ?? 0, randInt(10, 28)),
              }
            : r,
        );
        const next: Player = {
          ...player,
          stamina: player.stamina - IHBAR_STAMINA,
          isi: clamp(player.isi + 10, 0, HEAT_MAX),
          itibar: Math.max(0, player.itibar - 2),
          turf: {
            ...player.turf,
            [hood]: clamp((player.turf[hood] ?? 0) + 4, 0, 100),
          },
        };
        set({
          player: next,
          rivals,
          logs: pushLog(
            s.logs,
            next,
            "turf",
            `${hoodName(hood)} ihbarı işledi. ${target.name} kliniğe çekildi. Semt %4 açıldı, emniyet yükseldi.`,
          ),
        });
      },
      sitEsnafBar: (hood) => {
        const s = get();
        const player = s.player;
        if (!player) return;
        if (!canAct(player)) return;
        if (player.stamina < ESNAF_STAMINA) return;
        if (player.cash < ESNAF_COST) return;
        const home = hood === player.neighborhood;
        const gain = (home ? 7 : 4) + Math.random() * 4;
        const after = Math.round(
          clamp((player.turf[hood] ?? 0) + gain, 0, 100) * 10,
        ) / 10;
        const next: Player = {
          ...player,
          cash: player.cash - ESNAF_COST,
          stamina: player.stamina - ESNAF_STAMINA,
          turf: { ...player.turf, [hood]: after },
          itibar: player.itibar + 1,
          health: clamp(player.health + 3, 0, HEALTH_MAX),
        };
        set({
          player: next,
          logs: pushLog(
            s.logs,
            next,
            "life",
            `${hoodName(hood)} esnaf barı. Çay, lahmacun, kulağa laf. Kontrol %${Math.round(after)}. −${ESNAF_COST.toLocaleString("tr-TR")} ₺.`,
            -ESNAF_COST,
          ),
        });
      },
      bankMove: (amount, dir) => {
        const s = get();
        const player = s.player;
        if (!player) return;
        const n = Math.round(amount);
        if (!Number.isFinite(n) || n <= 0) return;
        if (dir === "in") {
          if (player.cash < n) return;
          const next = { ...player, cash: player.cash - n, bank: player.bank + n };
          if ((next.tutorialStep ?? 0) === 3) next.tutorialStep = 4;
          set({
            player: next,
            logs: pushLog(
              s.logs,
              next,
              "bank",
              `Kasaya ${n.toLocaleString("tr-TR")} ₺ indi. Sokak bunu gasp etmez.`,
              -n,
            ),
          });
          return;
        }
        if (player.bank < n) return;
        const next = { ...player, cash: player.cash + n, bank: player.bank - n };
        set({
          player: next,
          logs: pushLog(
            s.logs,
            next,
            "bank",
            `Kasadan ${n.toLocaleString("tr-TR")} ₺ çekildi. Cebin ısındı.`,
            n,
          ),
        });
      },
      writeSenet: (kind, rivalId) => {
        const s = get();
        const player = s.player;
        if (!player) return;
        if (player.senet) return;
        if (kind === "borc") {
          const terms = tefeciLoanTerms(player);
          if (!terms.ok || terms.principal <= 0) {
            set({
              player,
              logs: pushLog(
                s.logs,
                player,
                "bank",
                "Tefeci Nuri notuna baktı. Kredi yok — önce senet kapat, itibar bas.",
              ),
            });
            return;
          }
          const next: Player = {
            ...player,
            cash: player.cash + terms.principal,
            senet: {
              kind: "borc",
              name: "Tefeci Nuri",
              amount: terms.due,
              dueGun: player.gun + 2,
            },
            isi: clamp(player.isi + 4, 0, HEAT_MAX),
          };
          set({
            player: next,
            logs: pushLog(
              s.logs,
              next,
              "bank",
              `Tefeci Nuri not ${terms.note}. ${terms.principal.toLocaleString("tr-TR")} ₺ uzattı. İki güne ${terms.due.toLocaleString("tr-TR")} ₺.`,
              terms.principal,
            ),
          });
          return;
        }
        const rival = s.rivals.find((r) => r.id === rivalId) ?? s.rivals[0];
        if (!rival) return;
        const principal = Math.min(player.cash, Math.max(1500, Math.round(rival.cash * 0.12)));
        if (principal < 1500) return;
        const next: Player = {
          ...player,
          cash: player.cash - principal,
          senet: {
            kind: "alacak",
            name: rival.name,
            amount: Math.round(principal * 1.25),
            dueGun: player.gun + 2,
            rivalId: rival.id,
          },
        };
        set({
          player: next,
          rivals: s.rivals.map((r) =>
            r.id === rival.id ? { ...r, cash: r.cash + principal } : r,
          ),
          logs: pushLog(
            s.logs,
            next,
            "bank",
            `${rival.name}'e ${principal.toLocaleString("tr-TR")} ₺ senet. İki güne ${next.senet!.amount.toLocaleString("tr-TR")} ₺ döner.`,
            -principal,
          ),
        });
      },
      upgradeEstate: (estateId) => {
        const s = get();
        const player = s.player;
        if (!player) return;
        if (!player.properties.includes(estateId)) return;
        const estate = ESTATE_MAP[estateId];
        if (!estate) return;
        const lvl = estateLevel(player, estateId);
        if (lvl >= 2) return;
        const cost = upgradeCost(estate, lvl);
        if (player.cash < cost) return;
        const next: Player = {
          ...player,
          cash: player.cash - cost,
          upgrades: { ...player.upgrades, [estateId]: lvl + 1 },
          itibar: player.itibar + 3,
        };
        set({
          player: next,
          logs: pushLog(
            s.logs,
            next,
            "estate",
            `${estate.name} kademe ${lvl + 1}. Saatlik gelir şişti.`,
            -cost,
          ),
        });
      },
      live: (id) => {
        const s = get();
        const player = s.player;
        if (!player) return;
        if (!canAct(player)) return;
        const eMax = energyMax(player.level, player.neighborhood);
        const sMax = staminaMax(player.level);
        let next: Player = { ...player };
        let text = "";
        let money = 0;

        if (id === "bira") {
          if (next.cash < 180) return;
          next.cash -= 180;
          next.stamina = clamp(next.stamina + 4, 0, sMax);
          next.health = clamp(next.health + 8, 1, HEALTH_MAX);
          next.buzz = Math.min(8, next.buzz + 2);
          next.isi = clamp(next.isi - 2, 0, HEAT_MAX);
          money = -180;
          text = "Soğuk bira. Can açıldı, racon gevşedi.";
        } else if (id === "raki") {
          if (next.cash < 850) return;
          next.cash -= 850;
          next.stamina = clamp(next.stamina + 7, 0, sMax);
          next.health = clamp(next.health + 12, 1, HEALTH_MAX);
          next.buzz = Math.min(10, next.buzz + 4);
          next.isi = clamp(next.isi - 4, 0, HEAT_MAX);
          money = -850;
          text = "Rakı masası. Kan yerine geldi, dil açıldı.";
        } else if (id === "esrar") {
          if (next.cash < 1100) return;
          next.cash -= 1100;
          next.energy = clamp(next.energy + 8, 0, eMax);
          next.health = clamp(next.health + 10, 1, HEALTH_MAX);
          next.stamina = clamp(next.stamina + 2, 0, sMax);
          next.high = Math.min(10, next.high + 5);
          next.isi = clamp(next.isi - 7, 0, HEAT_MAX);
          money = -1100;
          text = "Duman. Can doldu, emniyet düştü, mermi yerine geldi.";
        } else if (id === "pavyon") {
          if (next.cash < 4200) return;
          next.cash -= 4200;
          next.stamina = clamp(next.stamina + 5, 0, sMax);
          next.isi = clamp(next.isi + 6, 0, HEAT_MAX);
          next.itibar += 4;
          money = -4200;
          text =
            "Pavyon gecesi: sahne ışığı, rakı, kasa eridi. Adın masalarda döndü.";
          if (next.girlfriend) {
            const gid = next.girlfriend;
            next = bumpRel(next, gid, -16);
            const nm = PARTNER_MAP[gid]?.name ?? "o";
            if ((next.relations[gid] ?? 0) <= 8) {
              next.girlfriend = null;
              text += ` ${nm} haber aldı, bitti.`;
            } else text += ` ${nm} duydu.`;
          }
        } else if (id === "okey") {
          const stake = Math.min(next.cash, 800 + next.level * 400);
          if (stake < 400) return;
          const win = Math.random() < 0.46;
          if (win) {
            next.cash += stake;
            next.itibar += 1;
            money = stake;
            text = `Okey masası. Çift 7. +${stake.toLocaleString("tr-TR")} ₺`;
          } else {
            next.cash -= stake;
            next.isi = clamp(next.isi + 3, 0, HEAT_MAX);
            money = -stake;
            text = `Okey masası. Taş gelmedi. −${stake.toLocaleString("tr-TR")} ₺`;
          }
        } else if (id === "evlen") {
          if (next.married) return;
          if (next.cash < 18000 || next.itibar < 12) return;
          next.cash -= 18000;
          next.married = true;
          const gf = next.girlfriend ? PARTNER_MAP[next.girlfriend] : null;
          next.spouse = gf?.name ?? pick(SPOUSES);
          if (gf) next = bumpRel(next, gf.id, 12);
          next.girlfriend = null;
          next.itibar += 8;
          money = -18000;
          text = `${next.spouse} ile nikâh. Mahalle duymuş. Mekan geliri biraz şişer.`;
        } else if (id === "bosan") {
          if (!next.married) return;
          const fee = 6000 + next.kids * 4000;
          if (next.cash < fee) return;
          next.cash -= fee;
          const who = next.spouse;
          next.married = false;
          next.spouse = null;
          next.girlfriend = null;
          next.itibar = Math.max(0, next.itibar - 6);
          money = -fee;
          text = `${who} gitti. Avukat kesti, mahalle konuştu.`;
        } else if (id === "cocuk") {
          if (!next.married || next.kids >= LIFE_KID_MAX) return;
          if (next.cash < 8000) return;
          next.cash -= 8000;
          next.kids += 1;
          next.itibar += 5;
          money = -8000;
          text = `Çocuk ${next.kids}. Sünnet ileride, harcama şimdi.`;
        } else return;

        set({
          player: next,
          logs: pushLog(s.logs, next, "life", text, money),
        });
      },
      gamble: (kind, stake, choice) => {
        const s = get();
        const player = s.player;
        if (!player || !canAct(player)) return;
        const bet = Math.floor(stake);
        if (bet < 100 || player.cash < bet) return;
        let payout = 0;
        let text = "";
        if (kind === "slot") {
          const sym = ["7", "BAR", "ÜZÜM", "KIRAZ", "AT"];
          const a = pick(sym);
          const b = pick(sym);
          const c = pick(sym);
          if (a === b && b === c) payout = a === "7" ? bet * 12 : bet * 6;
          else if (a === b || b === c || a === c) payout = Math.round(bet * 1.5);
          text = `Slot ${a} ${b} ${c}. ${payout ? "Tuttu." : "Boş."}`;
        } else if (kind === "kazi") {
          const r = Math.random();
          if (r < 0.08) payout = bet * 12;
          else if (r < 0.22) payout = bet * 3;
          text = payout ? "Kazı kazan. Altın çizgi." : "Kazı kazan. Çizgi boş.";
        } else if (kind === "rulet") {
          const n = randInt(0, 36);
          const red = n !== 0 && n % 2 === 0;
          if (choice === "sayi") {
            const num = randInt(0, 36);
            if (num === n) payout = bet * 35;
            text = `Rulet ${n}. Sen ${num}. ${payout ? "Tek sayı tuttu." : "Yok."}`;
          } else {
            const wantRed = choice !== "siyah";
            if (n !== 0 && red === wantRed) payout = bet * 2;
            text = `Rulet ${n} ${n === 0 ? "yeşil" : red ? "kırmızı" : "siyah"}.`;
          }
        } else {
          const bust = Math.random() < 0.28;
          const dealerBust = Math.random() < 0.24;
          if (bust) {
            text = "Blackjack. 22. Yandın.";
          } else if (dealerBust) {
            payout = bet * 2;
            text = "Blackjack. Krupiye yandı.";
          } else {
            const you = randInt(17, 21);
            const they = randInt(17, 21);
            if (you > they) {
              payout = bet * 2;
              text = `Blackjack. ${you}–${they}. Masa senin.`;
            } else if (you === they) {
              payout = bet;
              text = `Blackjack. ${you}–${they}. Berabere, bahis döndü.`;
            } else text = `Blackjack. ${you}–${they}. Krupiye aldı.`;
          }
        }
        const next: Player = {
          ...player,
          cash: player.cash - bet + payout,
        };
        set({
          player: next,
          logs: pushLog(
            s.logs,
            next,
            "life",
            `${text} ${payout ? `+${(payout - bet).toLocaleString("tr-TR")} ₺` : `−${bet.toLocaleString("tr-TR")} ₺`}`,
            payout - bet,
          ),
        });
      },
      betRace: (index, stake) => {
        const s = get();
        const player = s.player;
        if (!player || !canAct(player)) return;
        const horse = RACE_FIELD[index];
        const bet = Math.floor(stake);
        if (!horse || bet < 100 || player.cash < bet) return;
        const win = pickRaceWinner(RACE_FIELD);
        const winner = RACE_FIELD[win]!;
        const hit = win === index;
        const payout = hit ? Math.round(bet * horse.odds) : 0;
        const next: Player = {
          ...player,
          cash: player.cash - bet + payout,
        };
        set({
          player: next,
          logs: pushLog(
            s.logs,
            next,
            "life",
            `Veliefendi: ${winner.name} birinci. ${hit ? `${horse.name} tuttu.` : `${horse.name} kaldı.`} ${
              hit
                ? `+${(payout - bet).toLocaleString("tr-TR")} ₺`
                : `−${bet.toLocaleString("tr-TR")} ₺`
            }`,
            payout - bet,
          ),
        });
      },
      buyHorse: () => {
        const s = get();
        const player = s.player;
        if (!player || !canAct(player) || player.horse) return;
        if (player.cash < HORSE_PRICE) return;
        const next: Player = {
          ...player,
          cash: player.cash - HORSE_PRICE,
          horse: { name: pick(HORSE_NAMES), speed: 18 + randInt(0, 8), form: 55 },
          itibar: player.itibar + 6,
        };
        set({
          player: next,
          logs: pushLog(
            s.logs,
            next,
            "life",
            `${next.horse!.name} senin. Veliefendi defterine yazıldı.`,
            -HORSE_PRICE,
          ),
        });
      },
      trainHorse: () => {
        const s = get();
        const player = s.player;
        if (!player || !canAct(player) || !player.horse) return;
        if (player.cash < HORSE_TRAIN || player.energy < 5) return;
        const horse = {
          ...player.horse,
          speed: clamp(player.horse.speed + 2, 10, 80),
          form: clamp(player.horse.form + 10, 10, 100),
        };
        const next: Player = {
          ...player,
          cash: player.cash - HORSE_TRAIN,
          energy: player.energy - 5,
          horse,
        };
        set({
          player: next,
          logs: pushLog(
            s.logs,
            next,
            "life",
            `${horse.name} çalıştı. Hız ${Math.round(horse.speed)}, form ${Math.round(horse.form)}.`,
            -HORSE_TRAIN,
          ),
        });
      },
      raceHorse: () => {
        const s = get();
        const player = s.player;
        if (!player || !canAct(player) || !player.horse) return;
        if (player.energy < 6) return;
        const h = player.horse;
        const chance = clamp((h.speed / 90) * (h.form / 100), 0.08, 0.72);
        const win = Math.random() < chance;
        const prize = win ? randInt(12000, 38000) : 0;
        const horse = {
          ...h,
          form: clamp(h.form - (win ? 8 : 14), 10, 100),
        };
        const next: Player = {
          ...player,
          energy: player.energy - 6,
          cash: player.cash + prize,
          horse,
          itibar: player.itibar + (win ? 4 : 0),
        };
        set({
          player: next,
          logs: pushLog(
            s.logs,
            next,
            "life",
            win
              ? `${h.name} birinci. Kupa ve ${prize.toLocaleString("tr-TR")} ₺.`
              : `${h.name} geride kaldı. Form düştü.`,
            prize,
          ),
        });
      },
      relate: (partnerId, act) => {
        const s = get();
        const player = s.player;
        if (!player || !canAct(player)) return;
        const p = PARTNER_MAP[partnerId];
        if (!p) return;
        let next: Player = {
          ...player,
          relations: { ...(player.relations ?? {}) },
        };
        const aff = next.relations[partnerId] ?? 0;
        let text = "";
        let money = 0;

        if (act === "flort") {
          if (next.married) return;
          if (next.cash < 400 || next.stamina < 3) return;
          next.cash -= 400;
          next.stamina -= 3;
          next = bumpRel(next, partnerId, 9);
          money = -400;
          text = `${p.name} ile laf. Gönül ${Math.round(next.relations[partnerId] ?? 0)}.`;
          if (next.girlfriend && next.girlfriend !== partnerId) {
            next = bumpRel(next, next.girlfriend, -10);
          }
        } else if (act === "hediye") {
          if (next.cash < p.gift) return;
          next.cash -= p.gift;
          next = bumpRel(next, partnerId, 16);
          money = -p.gift;
          text = `${p.name} hediyeyi aldı. Gönül ${Math.round(next.relations[partnerId] ?? 0)}.`;
        } else if (act === "randevu") {
          if (next.cash < p.date || next.stamina < 4) return;
          next.cash -= p.date;
          next.stamina -= 4;
          next.itibar += 1;
          next = bumpRel(next, partnerId, 14);
          money = -p.date;
          text = `${p.name} ile akşam. Masa, muhabbet, hesap sende.`;
        } else if (act === "sevgili" || act === "baslat") {
          if (next.married || next.girlfriend) return;
          if (aff < 25) return;
          next.girlfriend = partnerId;
          next = bumpRel(next, partnerId, 8);
          next.itibar += 3;
          text = `${p.name} ile ilişki başladı. Mahalle duymuş.`;
        } else if (act === "gece") {
          if (next.girlfriend !== partnerId && aff < 55) return;
          if (next.stamina < 4) return;
          next.stamina -= 4;
          next.health = clamp(next.health + 6, 1, HEALTH_MAX);
          next = bumpRel(next, partnerId, 10);
          next.itibar += 1;
          text = `${p.name} ile gece. Sabah ağız kokusu, gönül ısındı.`;
          if (
            !next.pendingFamily &&
            next.kids < LIFE_KID_MAX &&
            Math.random() < (next.married && next.spouse === p.name ? 0.22 : 0.38)
          ) {
            next.pendingFamily = { partnerId, name: p.name };
            text += " Sabah haber: çocuk. Kapıda üç yol var.";
          }
        } else if (act === "evlen") {
          if (next.married) return;
          if (next.cash < 18000 || next.itibar < 12) return;
          if (next.girlfriend !== partnerId && aff < 50) return;
          next.cash -= 18000;
          next.married = true;
          next.spouse = p.name;
          next.girlfriend = null;
          next = bumpRel(next, partnerId, 12);
          next.itibar += 8;
          money = -18000;
          text = `${p.name} ile nikâh. Mahalle duymuş. Mekan geliri biraz şişer.`;
        } else if (act === "bitir") {
          if (next.girlfriend !== partnerId) return;
          next.girlfriend = null;
          next = bumpRel(next, partnerId, -30);
          next.itibar = Math.max(0, next.itibar - 2);
          text = `${p.name} ile bitti.`;
        } else return;

        set({
          player: next,
          logs: pushLog(s.logs, next, "life", text, money),
        });
      },
      resolveFamily: (choice) => {
        const s = get();
        const player = s.player;
        if (!player?.pendingFamily) return;
        const { partnerId, name } = player.pendingFamily;
        let next: Player = {
          ...player,
          pendingFamily: null,
          relations: { ...(player.relations ?? {}) },
        };
        let text = "";
        let money = 0;
        if (choice === "evlen") {
          if (!next.married) {
            if (next.cash < 18000) return;
            next.cash -= 18000;
            next.married = true;
            next.spouse = name;
            next.girlfriend = null;
            money = -18000;
          }
          if (next.kids < LIFE_KID_MAX) next.kids += 1;
          next.itibar += 10;
          next = bumpRel(next, partnerId, 14);
          text = `${name} ile nikâh. Çocuk ${next.kids}. Mahalle alkışladı, sen damat oldun, racon ağırlaştı.`;
        } else if (choice === "ustlen") {
          if (next.kids < LIFE_KID_MAX) next.kids += 1;
          next.itibar = Math.max(0, next.itibar - 3);
          next.stamina = Math.max(0, next.stamina - 2);
          next = bumpRel(next, partnerId, 6);
          text = `Gizledin. Çocuk ${next.kids}, masraf saatte kesilir, mahalle resmen duymadı, gayriresmen herkes biliyor.`;
        } else {
          next.itibar = Math.max(0, next.itibar - 10);
          next.stamina = Math.max(0, next.stamina - 6);
          next = bumpRel(next, partnerId, -40);
          if (next.girlfriend === partnerId) next.girlfriend = null;
          text = `Yoktun, duymadın, görmedin. ${name} kapıyı çarptı. İtibar ve racon yerlerde.`;
        }
        set({
          player: next,
          logs: pushLog(s.logs, next, "life", text, money),
        });
      },
      tradeInvest: (id, dir, units) => {
        const s = get();
        const player = s.player;
        if (!player || !canAct(player)) return;
        const qty = Math.floor(units * 100) / 100;
        if (qty <= 0) return;
        const market = s.market ?? MARKET_START;
        const price = market[id];
        if (!price) return;
        const have = holdingOf(player, id);
        if (dir === "al") {
          const cost = Math.round(qty * price);
          if (player.cash < cost) return;
          const next: Player = {
            ...player,
            cash: player.cash - cost,
            altin: player.altin + (id === "altin" ? qty : 0),
            usd: player.usd + (id === "usd" ? qty : 0),
            usdt: player.usdt + (id === "usdt" ? qty : 0),
            isi: clamp(player.isi + (id === "usdt" ? 3 : 0), 0, HEAT_MAX),
          };
          const label =
            id === "altin" ? "gram altın" : id === "usd" ? "dolar" : "USDT";
          set({
            player: next,
            logs: pushLog(
              s.logs,
              next,
              "invest",
              `${qty} ${label} alındı. ${price.toLocaleString("tr-TR")} ₺.`,
              -cost,
            ),
          });
          return;
        }
        const sell = Math.min(have, qty);
        if (sell <= 0) return;
        const gain = Math.round(sell * price);
        const next: Player = {
          ...player,
          cash: player.cash + gain,
          altin: id === "altin" ? player.altin - sell : player.altin,
          usd: id === "usd" ? player.usd - sell : player.usd,
          usdt: id === "usdt" ? player.usdt - sell : player.usdt,
        };
        const label =
          id === "altin" ? "gram altın" : id === "usd" ? "dolar" : "USDT";
        set({
          player: next,
          logs: pushLog(
            s.logs,
            next,
            "invest",
            `${sell} ${label} satıldı. ${price.toLocaleString("tr-TR")} ₺.`,
            gain,
          ),
        });
      },
      fundKose: () => {
        const s = get();
        const player = s.player;
        if (!player || !canAct(player)) return;
        if (player.kose >= 3) return;
        const cost = koseUpgradeCost(player);
        if (player.cash < cost || cost <= 0) return;
        const nextLvl = player.kose + 1;
        const next: Player = {
          ...player,
          cash: player.cash - cost,
          kose: nextLvl,
          koseGun: player.kose === 0 ? player.gun : player.koseGun,
          isi: clamp(player.isi + 5, 0, HEAT_MAX),
          tutorialStep: (player.tutorialStep ?? 0) === 2 ? 3 : player.tutorialStep,
        };
        set({
          player: next,
          logs: pushLog(
            s.logs,
            next,
            "invest",
            `Köşe ${nextLvl}. kademe. Haftalık döner.`,
            -cost,
          ),
        });
      },
      adoptCloudSave: (state) => {
        try {
          const next = normalizeSlice(state);
          if (!next.player) return;
          set({ ...next, savedAt: Date.now() });
        } catch {
          /* bozuk bulut kaydı oyunu düşürmesin */
        }
      },
      resetGame: () => {
        if (typeof window !== "undefined") {
          void import("./save-sync")
            .then((m) => m.deleteCloudSave())
            .catch(() => undefined);
        }
        if (typeof window !== "undefined") {
          if (persistTimer) {
            clearTimeout(persistTimer);
            persistTimer = null;
          }
          persistPending = null;
          try {
            const slot = readActiveSlot(window.localStorage, "cete");
            clearSlot(window.localStorage, "cete", slot);
          } catch {
            /* quota */
          }
        }
        set({
          ...emptyPersist,
          activeSlot:
            typeof window !== "undefined"
              ? readActiveSlot(window.localStorage, "cete")
              : 1,
        });
      },
      loadSlot: (slot) => {
        if (typeof window === "undefined" || !isSlotIndex(slot)) return false;
        flushPersist();
        try {
          const raw = window.localStorage.getItem(slotKey("cete", slot));
          const parsed = raw ? JSON.parse(raw) : null;
          const slice = parsed?.state ?? parsed;
          if (raw && (!slice || typeof slice !== "object" || Array.isArray(slice) || !("player" in slice))) return false;
          const next = raw ? normalizeSlice(slice) : { ...emptyPersist, market: { ...MARKET_START } };
          if (!writeActiveSlot(window.localStorage, "cete", slot)) return false;
          set({ ...next, activeSlot: slot, savedAt: Date.now() });
          return true;
        } catch {
          return false;
        }
      },
      saveToSlot: (slot) => {
        if (typeof window === "undefined" || !isSlotIndex(slot)) return false;
        flushPersist();
        const s = get();
        const payload = {
          state: {
            version: SAVE_VERSION,
            player: s.player,
            rivals: s.rivals,
            logs: s.logs.slice(0, 40),
            hiz: s.hiz,
            market: s.market,
            savedAt: Date.now(),
          },
          version: SAVE_VERSION,
        };
        try {
        const written = writeSlotRaw(window.localStorage, "cete", slot, JSON.stringify(payload));
        if (!written.ok) return false;
        if (!writeActiveSlot(window.localStorage, "cete", slot)) return false;
        set({ activeSlot: slot, savedAt: Date.now() });
        return true;
        } catch { return false; }
      },
      clearPlaySlot: (slot) => {
        if (typeof window === "undefined" || !isSlotIndex(slot)) return false;
        flushPersist();
        try {
        const ok = clearSlot(window.localStorage, "cete", slot);
        if (ok && get().activeSlot === slot) set({ ...emptyPersist, market: { ...MARKET_START }, activeSlot: slot });
        return ok;
        } catch { return false; }
      },
      ackSeason: () => {
        const player = get().player;
        if (!player?.pendingSeasonCeremony) return;
        const c = player.pendingSeasonCeremony;
        let next: Player = {
          ...player,
          cash: player.cash + c.bonus,
          pendingSeasonCeremony: null,
        };
        let logs = pushLog(
          get().logs,
          next,
          "system",
          `Yeni sezon. Unvan: ${c.title}. +${c.bonus.toLocaleString("tr-TR")} ₺`,
          c.bonus,
        );
        const ach = withMeta(next, logs);
        next = ach.player;
        logs = ach.logs;
        track("sezon_tamamlandi", { score: c.score });
        set({ player: next, logs, savedAt: Date.now() });
      },
      skipTutorial: () => {
        const player = get().player;
        if (!player) return;
        set({ player: { ...player, tutorialStep: 4 } });
      },
      bumpTutorial: (step) => {
        const player = get().player;
        if (!player) return;
        if ((player.tutorialStep ?? 0) !== step) return;
        set({ player: { ...player, tutorialStep: step + 1 } });
      },
      claimDaily: () => {
        const s = get();
        if (!s.player) return;
        const raw = applyDailyStreak(s.player);
        if (raw === s.player) return;
        const gain = Math.max(0, raw.xp - s.player.xp);
        const grown = applyXp({ ...raw, xp: s.player.xp }, gain);
        const nextP = {
          ...raw,
          xp: grown.xp,
          level: grown.level,
          energy: grown.notes.length ? grown.energy : raw.energy,
          stamina: grown.notes.length ? grown.stamina : raw.stamina,
        };
        const cash = nextP.cash - s.player.cash;
        let logs = pushLog(
          s.logs,
          nextP,
          "system",
          `Günlük seri ${nextP.streak}. +${cash.toLocaleString("tr-TR")} ₺`,
          cash,
        );
        logs = maybeLevelNotes(nextP, grown.notes, logs);
        const meta = withMeta(nextP, logs);
        set({ player: meta.player, logs: meta.logs, savedAt: Date.now() });
      },
    }),
    {
      name: SAVE_KEY,
      version: SAVE_VERSION,
      storage: {
        getItem: () => {
          if (typeof window === "undefined") return null;
          try {
            migrateLegacyToSlot1(window.localStorage, "cete", [SAVE_KEY]);
            const slot = readActiveSlot(window.localStorage, "cete");
            const raw = readSlotRaw(window.localStorage, "cete", slot);
            return raw ? (JSON.parse(raw) as { state: unknown; version: number }) : null;
          } catch {
            return null;
          }
        },
        setItem: (_name, value) => {
          if (typeof window === "undefined") return;
          const slot = useGame.getState().activeSlot;
          persistPending = { name: slotKey("cete", slot), value };
          const player = (value as { state?: { player?: unknown } })?.state
            ?.player;
          if (!player) {
            flushPersist();
            return;
          }
          flushPersist();
        },
        removeItem: () => {
          if (typeof window === "undefined") return;
          const slot = readActiveSlot(window.localStorage, "cete");
          clearSlot(window.localStorage, "cete", slot);
        },
      },
      merge: (persisted, current) => {
        try {
          return { ...current, ...normalizeSlice(persisted as Record<string, unknown>), activeSlot: current.activeSlot };
        } catch {
          return current;
        }
      },
      migrate: (persisted) => normalizeSlice(persisted as Record<string, unknown>),
      partialize: (s) => ({
        version: s.version,
        player: s.player,
        rivals: s.rivals,
        logs: s.logs.slice(0, 40),
        hiz: s.hiz,
        market: s.market,
        savedAt: Date.now(),
      }),
      skipHydration: true,
    },
  ),
);
