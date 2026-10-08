import { clamp } from "@/lib/utils";
import { CREW_MAP, HEALTH_MAX, ITEM_MAP } from "./data";
import type { CrewId, NeighborhoodId, Player, Rival, Risk, ShopItem } from "./types";


export function xpToNext(level: number) {
  return 8 + level * 10 + (level - 1) * (level - 1) * 4;
}

export function energyMax(level: number, neighborhood: NeighborhoodId) {
  return 20 + level * 4 + (neighborhood === "tarlabasi" ? 4 : 0);
}

export function staminaMax(level: number) {
  return 12 + level * 2;
}

export function lakap(level: number) {
  if (level >= 14) return "Baba";
  if (level >= 10) return "Baron";
  if (level >= 8) return "Bölge Patronu";
  if (level >= 6) return "Ağabey";
  if (level >= 5) return "Kabadayı";
  if (level >= 4) return "Tetikçi";
  if (level >= 3) return "Mahalle Kabadayısı";
  if (level >= 2) return "Köşe Başı";
  return "Çaylak";
}

export const RISK_SUCCESS: Record<Risk, number> = {
  Düşük: 0.88,
  Orta: 0.72,
  Yüksek: 0.55,
  "Çok Yüksek": 0.38,
  Kritik: 0.22,
};

export const RISK_JAIL: Record<Risk, number> = {
  Düşük: 0.1,
  Orta: 0.25,
  Yüksek: 0.4,
  "Çok Yüksek": 0.55,
  Kritik: 0.7,
};

export const RISK_DMG: Record<Risk, [number, number]> = {
  Düşük: [4, 12],
  Orta: [10, 20],
  Yüksek: [16, 32],
  "Çok Yüksek": [24, 44],
  Kritik: [32, 58],
};

export const RISK_BRIBE: Record<Risk, number> = {
  Düşük: 400,
  Orta: 1200,
  Yüksek: 4000,
  "Çok Yüksek": 18000,
  Kritik: 55000,
};

export function bribeCost(risk: Risk, cash: number) {
  return Math.max(200, Math.round(RISK_BRIBE[risk] + cash * 0.04));
}

export function jobSuccessChance(player: Player, risk: Risk, missionId: string) {
  let p = RISK_SUCCESS[risk];
  p += clamp(player.itibar / 220, 0, 0.15);
  p += clamp(player.level * 0.012, 0, 0.12);
  const loadout = equippedBonuses(player);
  p += clamp((loadout.atk + loadout.def) / 900, 0, 0.08);
  if (player.neighborhood === "eyup" && (missionId === "j101" || missionId === "j102")) {
    p += 0.06;
  }
  const isi = player.isi ?? 0;
  if (isi >= 75) p -= 0.12;
  else if (isi >= 45) p -= 0.05;
  p += clamp((player.turf?.[player.neighborhood] ?? 0) / 280, 0, 0.14);
  if ((player.buzz ?? 0) >= 3) p -= 0.07;
  if ((player.high ?? 0) >= 1) p -= 0.03;
  const extra = Math.max(0, freeCrew(player).length - missionCrewNeed(risk));
  p += clamp(extra * 0.04, 0, 0.08);
  return clamp(p, 0.08, 0.96);
}

export function jailChance(player: Player, risk: Risk) {
  let p = RISK_JAIL[risk];
  const isi = player.isi ?? 0;
  p += isi >= 75 ? 0.16 : isi >= 45 ? 0.07 : 0;
  if (player.crew?.includes("gozcu")) p *= 0.82;
  if (player.crew?.includes("avukat")) p *= 0.75;
  return clamp(p, 0.04, 0.92);
}

export function missionCrewNeed(risk: Risk) {
  if (risk === "Düşük") return 0;
  if (risk === "Orta" || risk === "Yüksek") return 1;
  return 2;
}

export function freeCrew(player: Player): CrewId[] {
  const busy = player.crewBusy ?? {};
  return [...new Set(player.crew ?? [])].filter((id) => Object.hasOwn(CREW_MAP, id) && (busy[id] ?? 0) <= 0);
}

export function missionCrewBlock(player: Player, risk: Risk) {
  const need = missionCrewNeed(risk);
  const free = freeCrew(player).length;
  if (free >= need) return "";
  if (need === 0) return "";
  return need === 1
    ? "Bu iş için serbest bir adam gerekir."
    : `Bu iş için ${need} serbest adam gerekir.`;
}

export function assignCrewTicks(risk: Risk) {
  if (risk === "Kritik" || risk === "Çok Yüksek") return 8;
  if (risk === "Yüksek") return 6;
  if (risk === "Orta") return 4;
  return 2;
}

export function equippedBonuses(player: Player) {
  const ids = [
    player.equippedWeapon,
    player.equippedArmor,
    player.equippedVehicle,
  ];
  let atk = 0;
  let def = 0;
  for (const id of ids) {
    if (!id) continue;
    const item = ITEM_MAP[id];
    if (!item) continue;
    atk += item.attackBonus;
    def += item.defenseBonus;
  }
  return { atk, def };
}

export function playerCombat(player: Player) {
  const bonus = equippedBonuses(player);
  let atk =
    6 +
    player.level * 3 +
    bonus.atk +
    Math.floor(player.stamina * 0.35) +
    Math.floor(player.itibar * 0.04);
  let jammed = false;
  if (player.equippedWeapon === "w103" && Math.random() < 0.12) {
    const gun = ITEM_MAP.w103 as ShopItem;
    atk -= gun.attackBonus;
    jammed = true;
  }
  if (player.neighborhood === "sultangazi") atk += 5;
  if (player.crew?.includes("tetik")) atk += 10;
  const homeTurf = player.turf?.[player.neighborhood] ?? 0;
  if (homeTurf >= 100) atk += 4;
  else if (homeTurf >= 75) atk += 3;
  else if (homeTurf >= 50) atk += 2;
  else if (homeTurf >= 25) atk += 1;
  const def =
    4 + Math.floor(player.health * 0.12) + bonus.def + Math.floor(player.level * 1.5);
  return { atk, def, jammed };
}

export function applyXp(player: Player, gain: number) {
  let xp = player.xp + gain;
  let level = player.level;
  let energy = player.energy;
  let stamina = player.stamina;
  const notes: string[] = [];
  while (xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level += 1;
    energy = energyMax(level, player.neighborhood);
    stamina = staminaMax(level);
    notes.push(`Kıdem yükseldi: ${lakap(level)}`);
  }
  return { xp, level, energy, stamina, notes };
}

export function refillCaps(player: Player) {
  const eMax = energyMax(player.level, player.neighborhood);
  const sMax = staminaMax(player.level);
  return {
    eMax,
    sMax,
    energy: clamp(player.energy, 0, eMax),
    stamina: clamp(player.stamina, 0, sMax),
    health: clamp(player.health, 0, HEALTH_MAX),
  };
}

// Shared by the simulation and the district briefing: no hidden UI-only forecast.
export function turfDefense(player: Player) {
  const available = freeCrew(player);
  return Math.min(0.6, (available.includes("gozcu") ? 0.2 : 0) +
    (available.includes("tetik") ? 0.25 : 0) + equippedBonuses(player).def / 200);
}

export function rivalPressure(player: Player, rival: Rival) {
  if (!rival.alive || rival.hospitalTicks > 0 || (player.turf[rival.hood] ?? 0) <= 28) return 0;
  const stake = (player.turf[rival.hood] ?? 0) / 100;
  return Math.min(0.18, 0.025 + stake * 0.06 + player.isi / 2000 +
    (rival.revengeTicks > 0 ? 0.03 : 0)) * (1 - turfDefense(player));
}
