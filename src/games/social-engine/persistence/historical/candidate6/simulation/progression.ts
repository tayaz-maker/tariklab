import type { Command, CommandResult, WorldState } from "../domain/types.ts";
import type { ProgressionState, ProgressionView } from "../domain/progression-types.ts";
import { ITEMS } from "../domain/content.ts";
import { emit, notify } from "./events.ts";
export const DAILY_SKILL_LIMIT = 20;
export const INVENTORY_SLOT_LIMIT = 12;
const fail = (reason: string): CommandResult => ({ ok: false, reason, events: [] });
const ok = (reason: string): CommandResult => ({ ok: true, reason, events: [] });
export function initializeProgression(s: WorldState): ProgressionState {
  if (s.progression) return s.progression;
  s.progression = {
    version: 1,
    updatedTick: s.tick,
    day: Math.floor(s.minute / 1440),
    gainedToday: 0,
    lastSkills: { ...s.player.skills },
    perks: [],
    items: {},
    retired: false,
    retiredAt: null,
  };
  reconcileProgression(s, "legacy-import");
  return s.progression;
}
export function progressionCommand(s: WorldState, c: Command): CommandResult | null {
  const p = s.progression;
  if (c.type === "RESUME_CAREER") {
    if (!p.retired) return fail("Zaten etkin hayatına devam ediyorsun.");
    p.retired = false;
    p.retiredAt = null;
    emit(
      s,
      "career_resumed",
      "Yeni bir sayfa: mahalledeki hayatına devam ediyorsun.",
      ["player"],
      null,
      "private",
    );
    return ok("Yeni bir başlangıç.");
  }
  if (p.retired && !["STOP", "BLOCK", "SET_TIME_SPEED"].includes(c.type))
    return fail("Emeklilik özetinden hayata dönerek devam edebilirsin.");
  if (c.type === "RETIRE") {
    if (
      s.player.shift ||
      s.player.vehicleId ||
      s.player.wanted ||
      s.mobility?.trip ||
      s.player.attackUntil > s.tick
    )
      return fail("Önce vardiyanı, yolculuğunu ve hukuki yükümlülüklerini tamamla.");
    p.retired = true;
    p.retiredAt = s.minute;
    s.player.path = [];
    s.player.destination = null;
    s.flags.moveX = 0;
    s.flags.moveY = 0;
    emit(
      s,
      "retirement",
      "Bir dönemi kapattın. Dilersen aynı dünyadaki hayatına yeniden dönebilirsin.",
      ["player"],
      null,
      "private",
    );
    return ok("Hayat özetin hazır; kayıtların ve dünyan korunuyor.");
  }
  if (c.type === "BUY") {
    const item = String(c.args.item);
    if (
      Object.hasOwn(ITEMS, item) &&
      !s.player.inventory[item] &&
      Object.values(s.player.inventory).filter((q) => q > 0).length >= INVENTORY_SLOT_LIMIT
    )
      return fail("Çantanın 12 eşya türü yuvası dolu. Bir yuvayı boşaltmalısın.");
  }
  if (c.type === "ACCEPT_QUEST") {
    const q = s.quests.find((q) => q.id === c.args.questId);
    if (
      q?.kind === "delivery" &&
      !s.player.inventory[`parcel:${q.id}`] &&
      Object.values(s.player.inventory).filter((q) => q > 0).length >= INVENTORY_SLOT_LIMIT
    )
      return fail("Teslimat için çantanda boş bir yuva gerekli.");
  }
  return null;
}
/** Reconciles actual authoritative changes; never creates money or a second inventory. */
export function reconcileProgression(s: WorldState, sourceId = "world"): void {
  const p = s.progression;
  if (!p) return;
  const day = Math.floor(s.minute / 1440);
  if (day !== p.day) {
    p.day = day;
    p.gainedToday = 0;
  }
  for (const key of Object.keys(s.player.skills).sort()) {
    const before = p.lastSkills[key] ?? s.player.skills[key],
      now = s.player.skills[key];
    if (now > before) {
      const awarded = Math.min(now - before, Math.max(0, DAILY_SKILL_LIMIT - p.gainedToday));
      if (awarded < now - before && s.flags.skillCapNoticeDay !== day) {
        s.flags.skillCapNoticeDay = day;
        notify(
          s,
          "Bugünkü 20 beceri puanı sınırına ulaştın. Sertifika ve ücret hakların korunur; yeni beceri kazanımı yarın devam eder.",
        );
      }
      s.player.skills[key] = before + awarded;
      p.gainedToday += awarded;
    }
    p.lastSkills[key] = s.player.skills[key];
  }
  if (Number(s.flags.shiftsCompleted ?? 0) >= 5 && !p.perks.includes("professional"))
    p.perks.push("professional");
  for (const kind of Object.keys(p.items)) if (!s.player.inventory[kind]) delete p.items[kind];
  for (const kind of Object.keys(s.player.inventory).sort()) {
    const count = s.player.inventory[kind];
    if (!Number.isSafeInteger(count) || count < 0 || count > 10000) continue;
    const units = (p.items[kind] ??= []);
    if (units.length > count) units.splice(0, units.length - count);
    while (units.length < count)
      units.push({ id: `item:${s.nextId++}`, kind, acquiredTick: s.tick, sourceId });
  }
  p.updatedTick = s.tick;
}
export function progressionWageBonus(s: WorldState): number {
  return s.progression?.perks.includes("professional") ? 500 : 0;
}
export function progressionView(s: WorldState): ProgressionView {
  const p = s.progression;
  return {
    day: p.day,
    gainedToday: p.gainedToday,
    dailyLimit: DAILY_SKILL_LIMIT,
    slotLimit: INVENTORY_SLOT_LIMIT,
    slotsUsed: Object.values(s.player.inventory).filter((q) => q > 0).length,
    items: p.items,
    perks: p.perks.map((id) => ({
      id,
      name: "Meslek ustalığı",
      effect: "Beş tamamlanmış vardiya: sonraki vardiya tekliflerinde +5 ₺.",
    })),
    retired: p.retired,
    retiredAt: p.retiredAt,
    shiftsCompleted: Number(s.flags.shiftsCompleted ?? 0),
  };
}
export function validateProgression(s: WorldState): string[] {
  const errors: string[] = [];
  try {
    const p = s.progression;
    if (!p || p.version !== 1) return ["progression schema"];
    if (p.day !== Math.floor(s.minute / 1440) || p.updatedTick !== s.tick)
      errors.push("progression clock");
    if (!Number.isInteger(p.gainedToday) || p.gainedToday < 0 || p.gainedToday > DAILY_SKILL_LIMIT)
      errors.push("daily skill allowance");
    if (!p.lastSkills || typeof p.lastSkills !== "object" || Array.isArray(p.lastSkills))
      errors.push("skill baseline object");
    else {
      const actual = Object.keys(s.player.skills).sort(),
        last = Object.keys(p.lastSkills).sort();
      if (JSON.stringify(actual) !== JSON.stringify(last)) errors.push("skill baseline keys");
      for (const key of actual)
        if (
          !Number.isFinite(p.lastSkills[key]) ||
          p.lastSkills[key] < 0 ||
          p.lastSkills[key] > 100 ||
          p.lastSkills[key] !== s.player.skills[key]
        )
          errors.push("skill baseline:" + key);
    }
    if (Object.values(s.player.inventory).filter((q) => q > 0).length > INVENTORY_SLOT_LIMIT)
      errors.push("inventory slot capacity");
    const ids = new Set<string>();
    if (!p.items || typeof p.items !== "object" || Array.isArray(p.items))
      errors.push("item container");
    else {
      for (const [kind, items] of Object.entries(p.items)) {
        if (!Array.isArray(items)) {
          errors.push("item list:" + kind);
          continue;
        }
        if (items.length !== (s.player.inventory[kind] ?? 0)) errors.push("item count:" + kind);
        for (const item of items) {
          if (
            !item ||
            typeof item.id !== "string" ||
            !/^item:[0-9]+$/.test(item.id) ||
            ids.has(item.id) ||
            item.kind !== kind ||
            !Number.isSafeInteger(item.acquiredTick) ||
            item.acquiredTick < 0 ||
            item.acquiredTick > s.tick ||
            typeof item.sourceId !== "string" ||
            !item.sourceId ||
            item.sourceId.length > 120
          )
            errors.push("item identity:" + String(item?.id));
          if (item) ids.add(item.id);
        }
      }
      for (const [kind, count] of Object.entries(s.player.inventory))
        if (count > 0 && p.items[kind]?.length !== count)
          errors.push("missing item instances:" + kind);
    }
    if (
      !Array.isArray(p.perks) ||
      p.perks.some((id) => id !== "professional") ||
      new Set(p.perks).size !== p.perks.length
    )
      errors.push("perk identity");
    if (
      Array.isArray(p.perks) &&
      p.perks.includes("professional") &&
      Number(s.flags.shiftsCompleted ?? 0) < 5
    )
      errors.push("unearned perk");
    if (
      typeof p.retired !== "boolean" ||
      (p.retired &&
        (!Number.isSafeInteger(p.retiredAt) || p.retiredAt! < 0 || p.retiredAt! > s.minute)) ||
      (!p.retired && p.retiredAt !== null)
    )
      errors.push("retirement state");
  } catch {
    errors.push("malformed progression state");
  }
  return errors;
}
