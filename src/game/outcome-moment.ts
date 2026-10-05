import { ALL_MISSIONS, CONTRACT_MAP, TICK_MINUTES } from "./data";
import type { Player, Rival } from "./types";

export interface OutcomeSnapshot {
  player: Player | null;
  rivals: readonly Rival[];
  activeSlot: number;
}

export interface OutcomeMoment {
  title: string;
  summary: string;
  crewSummary: string;
  delaySummary: string;
  id: string;
  kind: "contract" | "first" | "operation" | "rank";
  day: number;
  seed: number;
  cash: number;
  reputation: number;
  pressure: number;
  energy: number;
  crew: { count: number; ticks: number };
  reactions: { count: number; minTicks: number; maxTicks: number };
  layers: { blocks: { x: number; y: number; height: number }[]; links: string[] };
}

// Presentation only. Call across ONE explicit job action, never on hydration,
// clock ticks or store subscriptions. No random draws, writes or new save fields.
export function buildOutcomeMoment(
  before: OutcomeSnapshot,
  after: OutcomeSnapshot,
  missionId: string,
): OutcomeMoment | null {
  const a = before.player, b = after.player;
  const mission = ALL_MISSIONS.find((m) => m.id === missionId);
  if (!a || !b || !mission || before.activeSlot !== after.activeSlot ||
    a.name !== b.name || a.neighborhood !== b.neighborhood ||
    b.jobsDone !== a.jobsDone + 1) return null;

  const contract = a.contractId ? CONTRACT_MAP[a.contractId] : null;
  const closed = !!contract && contract.missionId === missionId && b.contractId === null;
  const crewTicks = b.crew.filter((id) => (b.crewBusy[id] ?? 0) > (a.crewBusy[id] ?? 0))
    .map((id) => b.crewBusy[id] ?? 0);
  const kind = closed ? "contract" : a.jobsDone === 0 ? "first" :
    crewTicks.length >= 2 ? "operation" :
    Math.floor(b.level / 5) > Math.floor(a.level / 5) ? "rank" : null;
  if (!kind) return null;

  // One major operation of this kind per game day, one closure per contract.
  // The UI keeps a bounded in-memory set. Reloading never replays old moments.
  const id = [before.activeSlot, a.name, a.neighborhood, kind,
    kind === "contract" ? `${a.contractId}:${a.contractGun}` :
      kind === "rank" ? b.level : `${missionId}:${b.gun}`].join(":");
  let seed = 2166136261;
  for (const c of id) seed = Math.imul(seed ^ c.charCodeAt(0), 16777619) >>> 0;
  let visual = seed;
  const next = () => (visual = (Math.imul(visual, 1664525) + 1013904223) >>> 0);
  const blocks = Array.from({ length: 7 }, (_, i) => {
    const height = 12 + next() % 30;
    return { x: 8 + i * 29, y: 52 - height, height };
  });
  const previous = new Map(before.rivals.map((r) => [r.id, r.revengeTicks]));
  const reactions = after.rivals.filter((r) => r.alive && r.hospitalTicks === 0 &&
    r.revengeTicks > (previous.get(r.id) ?? 0)).map((r) => r.revengeTicks);
  const result: Omit<OutcomeMoment, "title" | "summary" | "crewSummary" | "delaySummary"> = {
    id, kind, day: b.gun, seed,
    cash: b.cash - a.cash, reputation: b.itibar - a.itibar,
    pressure: b.isi - a.isi, energy: b.energy - a.energy,
    crew: { count: crewTicks.length, ticks: Math.max(0, ...crewTicks) },
    reactions: { count: reactions.length, minTicks: reactions.length ? Math.min(...reactions) : 0, maxTicks: Math.max(0, ...reactions) },
    layers: { blocks, links: blocks.slice(0, -1).map((block, i) =>
      `M${block.x + 10} ${block.y}V6H${blocks[i + 1].x + 10}V${blocks[i + 1].y}`) },
  };
  return { ...result, ...describeOutcomeMoment(result) };
}

export function describeOutcomeMoment(moment: Omit<OutcomeMoment, "title" | "summary" | "crewSummary" | "delaySummary">, en = false) {
  const signed = (value: number) => `${value > 0 ? "+" : ""}${new Intl.NumberFormat(en ? "en" : "tr", { maximumFractionDigits: 1 }).format(value)}`;
  const titles = en ? { contract: "RECORD CLOSED", first: "IMPACT REGISTERED", operation: "NETWORK REBALANCED", rank: "NEW THRESHOLD" } :
    { contract: "KAYIT KAPANDI", first: "ETKİ YERLEŞTİ", operation: "AĞ YENİDEN DENGELENDİ", rank: "YENİ EŞİK" };
  return {
    title: titles[moment.kind],
    summary: `${titles[moment.kind]}. ${en ? "Cash" : "Nakit"} ${signed(moment.cash)} ₺. ${en ? "Reputation" : "İtibar"} ${signed(moment.reputation)}. ${en ? "Pressure" : "Baskı"} ${signed(moment.pressure)}.`,
    crewSummary: moment.crew.count ?
      (en ? `${moment.crew.count} crew committed · free in ${moment.crew.ticks * TICK_MINUTES} game minutes.` : `${moment.crew.count} ekip üyesi bağlı · ${moment.crew.ticks * TICK_MINUTES} oyun dk sonra serbest.`) :
      (en ? "No new crew commitment." : "Yeni ekip taahhüdü yok."),
    delaySummary: moment.reactions.count ?
      (en ? `${moment.reactions.count} reaction timers set/extended: ${moment.reactions.minTicks * TICK_MINUTES}–${moment.reactions.maxTicks * TICK_MINUTES} game minutes. Cash and health at risk if free with over ₺200.` :
        `${moment.reactions.count} tepki sayacı kuruldu/uzadı: ${moment.reactions.minTicks * TICK_MINUTES}–${moment.reactions.maxTicks * TICK_MINUTES} oyun dk. Serbestken nakit 200 ₺ üstündeyse nakit ve sağlık riski.`) :
      (en ? "No new reaction timer; existing risks continue." : "Yeni tepki sayacı yok; mevcut riskler sürüyor."),
  };
}

export function createMomentGate() {
  const seen = new Set<string>();
  let lastAt = -Infinity;
  return (moment: OutcomeMoment | null, now: number) => {
    if (!moment || seen.has(moment.id)) return false;
    seen.add(moment.id);
    if (seen.size > 64) seen.delete(seen.values().next().value!);
    // No queue of stale results, including bursts of distinct milestones.
    if (now - lastAt < 2500) return false;
    lastAt = now;
    return true;
  };
}
