import {
  BUILDINGS,
  COHORTS,
  GROUPS,
  NPCS,
  INVESTORS,
  EVENTS,
  IDENTITIES,
  ENDINGS,
} from "./data.js";
export const clamp = (n, a = 0, b = 100) => Math.max(a, Math.min(b, n));
const sum = (a) => a.reduce((x, y) => x + y, 0);
const mean = (a) => sum(a) / Math.max(1, a.length);
export const population = (s) => sum(s.cohorts.map((c) => c.count));
export const youngPopulation = (s) =>
  sum(s.cohorts.filter((c) => ["young", "educated"].includes(c.id)).map((c) => c.count));
export const TOWN_STAGES = [
  { id: "emergency", label: ["Acil muhtarlık", "Emergency village office"], institutions: ["council"] },
  {
    id: "municipal",
    label: ["İşleyen köy idaresi", "Working village municipality"],
    institutions: ["council", "service-board", "market-desk"],
  },
  {
    id: "planning",
    label: ["Planlı köy", "Planned village"],
    institutions: ["council", "service-board", "market-desk", "planning-office", "social-council"],
  },
  {
    id: "regional",
    label: ["Bölgesel köy merkezi", "Regional village centre"],
    institutions: [
      "council",
      "service-board",
      "market-desk",
      "planning-office",
      "social-council",
      "town-charter",
    ],
  },
];
const STAGE_INDEX = Object.fromEntries(TOWN_STAGES.map((stage, index) => [stage.id, index]));
const INVESTOR_STAGE = {
  hotel: "municipal",
  factory: "municipal",
  solar: "planning",
  logistics: "planning",
  hospital: "planning",
  mine: "planning",
  agriculture: "planning",
};
const INVESTOR_IDENTITY = {
  hotel: "tourism",
  factory: "production",
  solar: "agriculture",
  logistics: "enterprise",
  hospital: "retirement",
  mine: "production",
  agriculture: "agriculture",
};
const INVESTOR_CONFLICTS = [
  ["hotel", "factory"],
  ["solar", "mine"],
  ["mine", "agriculture"],
];

export function townModifiers(s) {
  const institutions = new Set(s.progression?.institutions || ["council"]);
  return {
    councilTrust: institutions.has("council") ? 1 : 0,
    serviceBonus: institutions.has("service-board") ? 4 : 0,
    marketIncome: institutions.has("market-desk") ? 1.05 : 1,
    upkeepFactor: institutions.has("planning-office") ? 0.93 : 1,
    migrationRelief: institutions.has("social-council") ? 0.18 : 0,
    companyResistance: institutions.has("town-charter") ? 1 : 0,
  };
}

export function investorTerms(s, id) {
  const offer = s.investors.find((item) => item.id === id);
  const definition = INVESTORS.find((item) => item.id === id);
  if (!offer || !definition) return null;
  const accepted = s.investors.filter((item) => item.status === "accepted");
  const count = accepted.length;
  const negotiated = offer.negotiated;
  const conflict = INVESTOR_CONFLICTS.some(
    (pair) =>
      pair.includes(id) &&
      pair.some((other) => other !== id && accepted.some((x) => x.id === other)),
  );
  const aligned = ["crisis", "company", INVESTOR_IDENTITY[id]].includes(s.identity);
  const grantFactor = Math.max(0.55, 1 - count * 0.1) * (negotiated ? 0.8 : 1);
  const benefitFactor = Math.max(0.6, 1 - count * 0.08);
  const controlFactor = negotiated ? 0.65 : 1;
  return {
    requiredStage: INVESTOR_STAGE[id],
    eligible: STAGE_INDEX[s.progression?.stage || "emergency"] >= STAGE_INDEX[INVESTOR_STAGE[id]],
    grant: Math.round(definition.grant * grantFactor),
    jobs: Math.max(1, Math.round(definition.jobs * benefitFactor)),
    control: Math.round(
      definition.control * controlFactor + Math.max(0, count - 1) * 2 + (conflict ? 4 : 0),
    ),
    trustCost: Math.min(8, Math.max(0, count - 1) + (conflict ? 3 : 0) + (aligned ? 0 : 2)),
    identityCost: Math.min(8, Math.max(0, count - 2) + (aligned ? 0 : 2)),
    monthlyCommitment: 900 + count * 300 + (conflict ? 600 : 0),
    conflict,
    aligned,
    benefitFactor,
  };
}
export const effective = (s, id) => {
  const b = s.buildings.find((b) => b.id === id);
  return b?.open ? b.condition : 0;
};
export function indicators(s) {
  const m = s.metrics,
    modifiers = townModifiers(s);
  return {
    jobs: clamp(
      m.jobs + (effective(s, "factory") + effective(s, "workshop")) / 10 - m.pollution / 10,
    ),
    health: clamp(
      mean([effective(s, "clinic"), effective(s, "pharmacy"), m.health, m.supply]) -
        m.pollution / 10 +
        modifiers.serviceBonus,
    ),
    school: s.npcs.find((n) => n.id === "elif")?.present
      ? clamp(mean([effective(s, "school"), m.school]) + modifiers.serviceBonus)
      : 0,
    transport: clamp(mean([effective(s, "fuel"), effective(s, "bus"), m.road])),
    social: clamp(mean([effective(s, "cafe"), m.social])),
    services: clamp(
      mean([
        effective(s, "clinic"),
        effective(s, "school"),
        effective(s, "bus"),
        m.water,
        m.energy,
        m.services,
      ]) + modifiers.serviceBonus,
    ),
  };
}
const addHistory = (s, tr, en, type = "decision") => {
  s.history.push({ month: s.month, type, text: [tr, en] });
  s.history = s.history.slice(-100);
};
function remember(s, group, tr, en, delta = 2) {
  for (const n of s.npcs.filter((n) => n.group === group && n.present)) {
    n.trust = clamp(n.trust + delta);
    n.memory.push({ month: s.month, text: [tr, en] });
    n.memory = n.memory.slice(-8);
  }
  const g = s.groups.find((g) => g.id === group);
  if (g) g.trust = clamp(g.trust + delta);
}
export function createTown(options = {}) {
  const s = {
    meta: { id: "son-kasaba", version: 2, seed: 12345 },
    name:
      typeof options.name === "string" ? options.name.trim().slice(0, 30) || "Çınarlı" : "Çınarlı",
    month: 1,
    completedMonths: 0,
    ended: false,
    ending: null,
    budget: 160000,
    debt: 40000,
    initialPopulation: 900,
    metrics: {
      road: 42,
      supply: 64,
      prices: 100,
      rent: 40,
      water: 65,
      energy: 55,
      jobs: 34,
      trust: 45,
      health: 50,
      school: 50,
      services: 48,
      social: 40,
      pollution: 20,
      reputation: 35,
      localIdentity: 70,
      inequality: 30,
      company: 0,
      production: 25,
      agriculture: 50,
      tourism: 15,
      enterprise: 15,
    },
    buildings: BUILDINGS.map((b) => ({
      id: b.id,
      condition: b.condition,
      open: b.id !== "factory",
    })),
    cohorts: COHORTS.map((c) => ({ id: c.id, count: c.count, lastDelta: 0 })),
    groups: GROUPS.map((g) => ({ id: g.id, trust: 45, influence: g.id === "trades" ? 70 : 50 })),
    npcs: NPCS.map((n) => ({
      id: n.id,
      group: n.group,
      trust: 45,
      loyalty: 65,
      present: true,
      memory: [],
    })),
    investors: INVESTORS.map((i) => ({
      id: i.id,
      status: "unseen",
      negotiated: false,
      acceptedMonth: null,
    })),
    used: [],
    capacityUsed: 0,
    capacityMax: 10,
    events: [],
    seenEvents: [],
    pending: [],
    openCases: [],
    history: [],
    coalitions: [],
    report: null,
    identity: "crisis",
    identityHistory: [],
    migrationLog: [],
    resolvedEffects: [],
    chains: {},
    progression: { stage: "emergency", score: 0, institutions: ["council"], milestones: [] },
    ui: { screen: "center" },
    flags: { teacherWarned: false, teacherLeft: false, townArcs: {} },
  };
  if (options.context === "industry") {
    s.metrics.production += 12;
    s.metrics.pollution += 8;
    s.metrics.localIdentity -= 4;
  }
  if (options.context === "rural") {
    s.metrics.agriculture += 12;
    s.metrics.water -= 8;
    s.metrics.jobs -= 3;
  }
  refreshTown(s);
  return s;
}
export function validateTown(s) {
  if (
    !s ||
    s.meta?.id !== "son-kasaba" ||
    ![1, 2].includes(s.meta.version) ||
    !Number.isInteger(s.month) ||
    s.month < 1 ||
    s.month > 24 ||
    !Number.isInteger(s.completedMonths) ||
    s.completedMonths < 0 ||
    s.completedMonths > 24 ||
    typeof s.name !== "string" ||
    !s.metrics ||
    !s.flags ||
    !s.ui
  )
    return false;
  const finite = (v) =>
    typeof v === "number"
      ? Number.isFinite(v)
      : v && typeof v === "object"
        ? Object.values(v).every(finite)
        : true;
  if (
    !finite(s) ||
    !Number.isFinite(s.budget) ||
    s.budget < 0 ||
    s.budget > 1e9 ||
    !Number.isFinite(s.debt) ||
    s.debt < 0 ||
    s.debt > 1e9
  )
    return false;
  if (s.meta.version === 2) {
    if (
      !s.progression ||
      !TOWN_STAGES.some((x) => x.id === s.progression.stage) ||
      !Number.isFinite(s.progression.score) ||
      !Array.isArray(s.progression.institutions) ||
      !Array.isArray(s.progression.milestones) ||
      !s.chains ||
      typeof s.chains !== "object" ||
      !Array.isArray(s.identityHistory) ||
      s.identityHistory.length > 24 ||
      !Array.isArray(s.migrationLog) ||
      s.migrationLog.length > 48 ||
      !Array.isArray(s.resolvedEffects) ||
      s.resolvedEffects.length > 80
    )
      return false;
  }
  for (const [key, defs] of [
    ["buildings", BUILDINGS],
    ["cohorts", COHORTS],
    ["groups", GROUPS],
    ["npcs", NPCS],
    ["investors", INVESTORS],
  ]) {
    if (
      !Array.isArray(s[key]) ||
      s[key].length !== defs.length ||
      new Set(s[key].map((x) => x.id)).size !== defs.length ||
      s[key].some((x) => !defs.some((d) => d.id === x.id))
    )
      return false;
  }
  if (
    s.buildings.some(
      (b) =>
        typeof b.open !== "boolean" ||
        !Number.isFinite(b.condition) ||
        b.condition < 0 ||
        b.condition > 100,
    ) ||
    s.cohorts.some((c) => !Number.isInteger(c.count) || c.count < 0 || c.count > 100000)
  )
    return false;
  for (const k of [
    "road",
    "supply",
    "rent",
    "water",
    "energy",
    "jobs",
    "trust",
    "health",
    "school",
    "services",
    "social",
    "pollution",
    "reputation",
    "localIdentity",
    "inequality",
    "company",
    "production",
    "agriculture",
    "tourism",
    "enterprise",
  ])
    if (!Number.isFinite(s.metrics[k]) || s.metrics[k] < 0 || s.metrics[k] > 100) return false;
  if (!Number.isFinite(s.metrics.prices) || s.metrics.prices < 60 || s.metrics.prices > 200)
    return false;
  if (
    s.groups.some((g) => !Number.isFinite(g.trust) || g.trust < 0 || g.trust > 100) ||
    s.npcs.some(
      (n) =>
        !Array.isArray(n.memory) ||
        n.memory.length > 8 ||
        !Number.isFinite(n.trust) ||
        !Number.isFinite(n.loyalty) ||
        typeof n.present !== "boolean",
    )
  )
    return false;
  for (const k of ["used", "events", "seenEvents", "pending", "openCases", "history", "coalitions"])
    if (!Array.isArray(s[k])) return false;
  if (
    s.used.length > BASE_CAPACITY + RESERVE_BONUS + STRETCH_MAX ||
    !Number.isFinite(s.capacityMax ?? BASE_CAPACITY) ||
    (s.capacityMax ?? BASE_CAPACITY) < BASE_CAPACITY - STRETCH_MAX ||
    (s.capacityMax ?? BASE_CAPACITY) > BASE_CAPACITY + RESERVE_BONUS ||
    !Number.isFinite(s.capacityUsed ?? s.used.length * 2) ||
    (s.capacityUsed ?? s.used.length * 2) < 0 ||
    (s.capacityUsed ?? s.used.length * 2) > (s.capacityMax || BASE_CAPACITY) + STRETCH_MAX ||
    new Set(s.used).size !== s.used.length ||
    s.events.length > 45 ||
    s.seenEvents.length > 45 ||
    s.pending.length > 80 ||
    s.history.length > 100 ||
    s.coalitions.length > 10
  )
    return false;
  if (
    s.events.some(
      (e) =>
        !EVENTS.some((x) => x.id === e.id) ||
        !["open", "resolved", "expired"].includes(e.status) ||
        !Number.isInteger(e.expires),
    ) ||
    new Set(s.events.map((e) => e.id)).size !== s.events.length
  )
    return false;
  if (
    s.pending.some(
      (p) =>
        typeof p.id !== "string" ||
        !Number.isInteger(p.due) ||
        !p.effects ||
        !Array.isArray(p.text) ||
        p.text.length !== 2,
    ) ||
    new Set(s.pending.map((p) => p.id)).size !== s.pending.length
  )
    return false;
  if (
    !Object.hasOwn(IDENTITIES, s.identity) ||
    s.investors.some(
      (i) =>
        !["unseen", "offered", "accepted", "rejected"].includes(i.status) ||
        typeof i.negotiated !== "boolean",
    )
  )
    return false;
  const text = (p) => Array.isArray(p) && p.length === 2 && p.every((x) => typeof x === "string");
  if (
    s.report &&
    (!Number.isInteger(s.report.month) ||
      !s.report.before ||
      !s.report.after ||
      !s.report.finance ||
      !Number.isFinite(s.report.finance.totalIncome) ||
      !Number.isFinite(s.report.finance.totalCosts) ||
      !Array.isArray(s.report.cohorts) ||
      s.report.cohorts.length !== COHORTS.length ||
      new Set(s.report.cohorts.map((c) => c.id)).size !== COHORTS.length ||
      s.report.cohorts.some(
        (c) => !COHORTS.some((d) => d.id === c.id) || !Number.isInteger(c.delta),
      ) ||
      [s.report.before, s.report.after].some(
        (r) =>
          ["population", "budget", "debt", "trust"].some((k) => !Number.isFinite(r[k])) ||
          !Object.hasOwn(IDENTITIES, r.identity),
      ))
  )
    return false;
  if (
    s.history.some((r) => !text(r.text) || !Number.isInteger(r.month)) ||
    s.openCases.some((r) => !text(r.text)) ||
    s.npcs.some((n) => n.memory.some((m) => !text(m.text)))
  )
    return false;
  if (
    s.coalitions.some(
      (c) =>
        !Number.isInteger(c.until) ||
        !Array.isArray(c.groups) ||
        c.groups.length !== 2 ||
        c.groups.some((id) => !GROUPS.some((g) => g.id === id)),
    )
  )
    return false;
  if (
    s.investors.some(
      (i) =>
        i.status === "accepted" &&
        (!Number.isInteger(i.acceptedMonth) || i.acceptedMonth < 1 || i.acceptedMonth > s.month),
    )
  )
    return false;
  if (
    typeof s.ended !== "boolean" ||
    s.completedMonths !== (s.ended ? 24 : s.month - 1) ||
    (s.ended &&
      (!Object.hasOwn(ENDINGS, s.ending?.id) ||
        !Array.isArray(s.ending?.reasons) ||
        !s.ending.reasons.every(text)))
  )
    return false;
  return true;
}
export function normalizeTown(_id, raw) {
  if (!raw) return null;
  // Version 1 is the first public format. Missing core collections must not be
  // silently replaced with a fresh town or a reset action allowance.
  try {
    if (raw.capacityMax == null) raw.capacityMax = 10;
    if (raw.capacityUsed == null) raw.capacityUsed = Math.min(raw.capacityMax, raw.used.length * 2);
    if (!validateTown(raw)) return null;
    if (raw.meta.version === 1) ensureTownDepth(raw);
    return validateTown(raw) ? raw : null;
  } catch {
    return null;
  }
}

function ensureTownDepth(s) {
  s.meta.version = 2;
  s.identityHistory = Array.isArray(s.identityHistory) ? s.identityHistory.slice(-24) : [];
  s.migrationLog = Array.isArray(s.migrationLog) ? s.migrationLog.slice(-48) : [];
  s.resolvedEffects = Array.isArray(s.resolvedEffects) ? s.resolvedEffects.slice(-80) : [];
  s.chains = s.chains && typeof s.chains === "object" ? s.chains : {};
  s.progression =
    s.progression && typeof s.progression === "object"
      ? s.progression
      : { stage: "emergency", score: 0, institutions: ["council"], milestones: [] };
  s.progression.milestones = Array.isArray(s.progression.milestones)
    ? s.progression.milestones.slice(-4)
    : [];
  s.flags = s.flags || {};
  s.flags.townArcs =
    s.flags.townArcs && typeof s.flags.townArcs === "object" ? s.flags.townArcs : {};
  updateTownProgression(s);
  return s;
}

function updateChain(s, id, stage, tr, en) {
  const chain = s.chains[id] || { id, stage: "signal", month: s.month, history: [] };
  if (chain.stage !== stage) {
    chain.stage = stage;
    chain.month = s.month;
    chain.history.push({ month: s.month, stage });
    chain.history = chain.history.slice(-6);
    addHistory(s, tr, en, "chain");
  }
  s.chains[id] = chain;
}

export function updateTownProgression(s) {
  const i = indicators(s);
  const score = clamp(
    (i.services + s.metrics.trust + s.metrics.reputation + Math.min(100, population(s) / 9)) / 4,
  );
  const index =
    score >= 72 && s.month >= 18
      ? 3
      : score >= 58 && s.month >= 10
        ? 2
        : score >= 42 && s.month >= 4
          ? 1
          : 0;
  const next = TOWN_STAGES[index];
  s.progression = s.progression || { milestones: [] };
  if (
    s.progression.stage &&
    s.progression.stage !== next.id &&
    !s.progression.milestones.some((x) => x.stage === next.id)
  ) {
    s.progression.milestones.push({ stage: next.id, month: s.month });
    s.progression.milestones = s.progression.milestones.slice(-4);
    addHistory(
      s,
      `${next.label[0]} katmanı açıldı.`,
      `${next.label[1]} layer unlocked.`,
      "institution",
    );
  }
  s.progression.stage = next.id;
  s.progression.score = Math.round(score);
  s.progression.institutions = next.institutions.slice();
}
function effect(s, changes) {
  for (const [key, delta] of Object.entries(changes)) {
    if (!Number.isFinite(delta)) continue;
    if (key === "budget") {
      if (s.budget + delta < 0) s.debt = clamp(s.debt - s.budget - delta, 0, 1e9);
      s.budget = clamp(s.budget + delta, 0, 1e9);
    } else if (key === "debt") s.debt = clamp(s.debt + delta, 0, 1e9);
    else if (Object.hasOwn(s.metrics, key))
      s.metrics[key] = clamp(
        s.metrics[key] + delta,
        key === "prices" ? 60 : 0,
        key === "prices" ? 200 : 100,
      );
  }
}
export function eventEligible(s, e) {
  if (s.month < e.month || s.seenEvents.includes(e.id)) return false;
  const m = s.metrics,
    i = indicators(s);
  const gates = {
    road: m.road < 65,
    health: i.health < 65,
    school: i.school < 65,
    wet: s.month % 6 === 3,
    water: m.water < 65,
    social: i.social < 60,
    reputation: m.reputation >= 30,
    industry: m.production >= 20,
    culture: m.localIdentity >= 50,
    supply: m.supply < 70,
    energy: m.energy < 70,
    jobs: i.jobs < 65,
    transport: i.transport < 65,
    prices: m.prices > 105,
    rent: m.rent > 48,
    debt: s.debt > 20000,
    enterprise: m.enterprise >= 15,
    agriculture: m.agriculture >= 35,
    pollution: m.pollution > 30,
    retirement: s.cohorts.find((c) => c.id === "retired").count > 130,
    division: m.inequality > 35,
    company: m.company > 15,
    tourism: m.tourism >= 20,
    late: s.month >= 20,
  };
  if (!gates[e.gate]) return false;
  const arcs = s.flags?.townArcs || {};
  if (e.requireStage && s.progression?.stage !== e.requireStage) return false;
  if (e.requireInstitution && !(s.progression?.institutions || []).includes(e.requireInstitution))
    return false;
  if (e.requireIdentity && s.identity !== e.requireIdentity) return false;
  if (e.requireInvestor) {
    const inv = s.investors.find((i) => i.id === e.requireInvestor);
    if (inv?.status !== "accepted") return false;
  }
  if (e.requireNpc) {
    const npc = s.npcs.find((n) => n.id === e.requireNpc);
    if (!npc?.present) return false;
  }
  if (e.requireMemory) {
    const npc = s.npcs.find((n) => n.id === e.requireMemory);
    if (!npc?.memory?.length) return false;
  }
  if (e.requireFlag) {
    const got = arcs[e.requireFlag];
    if (e.requireValue == null) {
      if (!got) return false;
    } else if (got !== e.requireValue) return false;
  }
  if (e.exclusive && arcs[e.exclusive] && arcs[e.exclusive] !== (e.branch || e.id)) return false;
  return true;
}
export function deriveIdentity(s) {
  const m = s.metrics;
  if (m.company >= 50) return "company";
  if (indicators(s).services < 25) return "crisis";
  if (s.cohorts.find((c) => c.id === "retired").count / Math.max(1, population(s)) > 0.36)
    return "retirement";
  const ranked = [
    ["production", m.production],
    ["tourism", m.tourism],
    ["enterprise", m.enterprise],
    ["agriculture", m.agriculture],
    ["culture", m.localIdentity - 15],
  ].sort((a, b) => b[1] - a[1]);
  return ranked[0][1] >= 40 ? ranked[0][0] : "crisis";
}
export function refreshTown(s) {
  const beforeIdentity = s.identity;
  s.identity = deriveIdentity(s);
  if (Array.isArray(s.identityHistory) && beforeIdentity !== s.identity) {
    s.identityHistory.push({ month: s.month, from: beforeIdentity, to: s.identity });
    s.identityHistory = s.identityHistory.slice(-24);
  }
  if (s.progression) updateTownProgression(s);
  if (s.ended) return;
  const free = Math.max(0, 2 - s.events.filter((e) => e.status === "open").length);
  // Keep the established core cadence, but reserve a periodic deterministic
  // slot for eligible Wave 2 stories so authored array order cannot starve them.
  const eligibleEvents = EVENTS.filter((e) => eventEligible(s, e));
  if (s.flags?.followsTownAgenda && s.month % 6 === 0) {
    const extraIndex = eligibleEvents.findIndex((event) => event.wave2Extra);
    if (extraIndex > 0) eligibleEvents.unshift(eligibleEvents.splice(extraIndex, 1)[0]);
  }
  for (const e of eligibleEvents.slice(0, free)) {
    s.events.push({ id: e.id, status: "open", opened: s.month, expires: s.month + e.expires });
    s.seenEvents.push(e.id);
  }
  for (const offer of s.investors) {
    const d = INVESTORS.find((i) => i.id === offer.id);
    if (
      offer.status === "unseen" &&
      s.month >= d.month &&
      (s.metrics.reputation >= 25 || s.identity === "company")
    )
      offer.status = "offered";
  }
}
/**
 * Monthly field capacity is a plan, not a counter. You may stretch up to
 * STRETCH_MAX points past it, and next month starts that much shorter; leave
 * RESERVE_AT or more unused and next month starts RESERVE_BONUS longer.
 */
export const BASE_CAPACITY = 10;
export const STRETCH_MAX = 3;
export const RESERVE_AT = 4;
export const RESERVE_BONUS = 2;
export const capacityLimit = (s) => (s.capacityMax || BASE_CAPACITY) + STRETCH_MAX;
export function nextCapacity(s) {
  const max = s.capacityMax || BASE_CAPACITY,
    used = s.capacityUsed || 0;
  if (used > max) return BASE_CAPACITY - (used - max);
  if (max - used >= RESERVE_AT) return BASE_CAPACITY + RESERVE_BONUS;
  return BASE_CAPACITY;
}
export const CIVIC_ACTIONS = [
  { id: "road", label: ["Yolu onar", "Repair the road"], cost: 12000, effects: { road: 22 } },
  {
    id: "water",
    label: ["Su hattını iyileştir", "Improve water supply"],
    cost: 10000,
    effects: { water: 18 },
  },
  {
    id: "energy",
    label: ["Enerji bakımını yap", "Service the power network"],
    cost: 9000,
    effects: { energy: 18 },
  },
  {
    id: "support",
    label: ["Yerel işletmeye destek", "Support local businesses"],
    cost: 10000,
    effects: { jobs: 7, enterprise: 6, localIdentity: 3 },
  },
  {
    id: "festival",
    label: ["Ortak etkinlik düzenle", "Hold a community event"],
    cost: 6000,
    effects: { social: 12, localIdentity: 5, tourism: 3 },
  },
  {
    id: "housing",
    label: ["Boş lojmanları aç", "Open vacant public housing"],
    cost: 12000,
    effects: { rent: -15, inequality: -5 },
  },
  {
    id: "cleanup",
    label: ["Dereyi temizle", "Clean the stream"],
    cost: 10000,
    effects: { pollution: -15, water: 5 },
  },
  {
    id: "loan",
    label: ["30.000 TL acil borç al", "Borrow 30,000 TL"],
    cost: 0,
    effects: { budget: 30000, debt: 33000 },
  },
  {
    id: "repay",
    label: ["10.000 TL borç öde", "Repay 10,000 TL"],
    cost: 10000,
    effects: { debt: -10000 },
  },
];
export function actionInfo(s, command) {
  const [kind, id, choice] = command.split(":");
  let cost = 0,
    label = ["", ""],
    key = command,
    reason = null,
    effort = 2;
  const no = (tr, en) => {
    reason = [tr, en];
  };
  if (s.ended) no("Kampanya tamamlandı", "Campaign complete");
  if ((s.capacityUsed || 0) >= capacityLimit(s)) no("Bu ayın saha kapasitesi (zorlamayla birlikte) doldu", "This month's field capacity, including stretch, is full");
  if (kind === "civic") {
    const a = CIVIC_ACTIONS.find((a) => a.id === id);
    if (!a) no("Geçersiz karar", "Invalid decision");
    else {
      cost = a.cost;
      effort = ["loan", "repay"].includes(id) ? 1 : 2;
      label = a.label;
      if (
        Object.entries(a.effects).every(
          ([k, v]) => k in s.metrics && (v > 0 ? s.metrics[k] >= 100 : s.metrics[k] <= 0),
        )
      )
        no("Bu alanda ek iyileştirme gerekmiyor", "No further improvement needed here");
      if (id === "loan" && s.debt >= 200000) no("Borç sınırına ulaştın", "Debt limit reached");
      if (id === "repay" && s.debt < 10000) no("Borç 10.000 TL altında", "Debt below 10,000 TL");
    }
  } else if (["repair", "toggle"].includes(kind)) {
    const b = s.buildings.find((b) => b.id === id),
      d = BUILDINGS.find((b) => b.id === id);
    key = `building:${id}`;
    if (!b) no("Bina bulunamadı", "Building not found");
    else {
      cost = kind === "repair" ? d.repair : b.open ? 0 : Math.round(d.repair * 0.4);
      effort = kind === "repair" ? 3 : 1;
      label =
        kind === "repair"
          ? [`${d.name[0]} onarımı`, `${d.name[1]} repair`]
          : [
              `${d.name[0]} ${b.open ? "kapat" : "yeniden aç"}`,
              `${b.open ? "Close" : "Reopen"} ${d.name[1]}`,
            ];
      if (kind === "repair" && b.condition >= 95) no("Bakım gerekmiyor", "No repairs needed");
    }
  } else if (kind === "event") {
    const e = s.events.find((e) => e.id === id && e.status === "open"),
      d = EVENTS.find((e) => e.id === id),
      c = d?.choices.find((c) => c.id === choice);
    key = `event:${id}`;
    if (!e || !c) no("Bu gündem artık açık değil", "This agenda item is no longer open");
    else {
      cost = c.cost;
      effort = 2;
      label = d.title;
    }
  } else if (kind === "investor") {
    effort = 3;
    const o = s.investors.find((i) => i.id === id),
      d = INVESTORS.find((i) => i.id === id);
    key = `investor:${id}`;
    if (!o || o.status !== "offered" || !["accept", "reject", "negotiate"].includes(choice))
      no("Teklif açık değil", "Offer not open");
    else {
      label = d.name;
      const terms = investorTerms(s, id);
      if (choice === "accept" && !terms.eligible) {
        const stage = TOWN_STAGES.find((item) => item.id === terms.requiredStage);
        no(`${stage.label[0]} katmanı gerekli`, `${stage.label[1]} layer required`);
      }
      if (choice === "negotiate") {
        cost = 5000;
        if (o.negotiated) no("Pazarlık tamamlandı", "Negotiation already complete");
      }
    }
  } else if (kind === "talk") {
    effort = 1;
    const n = s.npcs.find((n) => n.id === id),
      d = NPCS.find((n) => n.id === id);
    if (!n || !n.present) no("Kişi köyde değil", "Person is not in the village");
    else {
      label = [`${d.name[0]} ile görüş`, `Meet ${d.name[1]}`];
      cost = 1000;
    }
  } else if (kind === "coalition") {
    effort = 2;
    const a = s.groups.find((g) => g.id === id),
      b = s.groups.find((g) => g.id === choice);
    key = ["coalition", ...[id, choice].sort()].join(":");
    cost = 5000;
    label = ["Ortak bakım koalisyonu", "Shared maintenance coalition"];
    if (!a || !b || id === choice || Math.min(a.trust, b.trust) < 35)
      no(
        "İki farklı grubun güveni en az 35 olmalı",
        "Two different groups need trust of at least 35",
      );
    if (s.coalitions.some((c) => c.key === key && c.until >= s.month))
      no("Koalisyon hâlâ çalışıyor", "Coalition is still active");
  } else no("Geçersiz karar", "Invalid decision");
  if (s.used.includes(key)) no("Bu dosya bu ay işlendi", "This file was handled this month");
  if ((s.capacityUsed || 0) + effort > capacityLimit(s)) no("Bu iş için ayın kalan saha kapasitesi yetmiyor", "Not enough field capacity remains this month");
  if (s.budget < cost) no("Bütçe yetersiz", "Not enough budget");
  // Points of this action that go past the plan and will be taken from next month.
  const stretch = Math.max(0, (s.capacityUsed || 0) + effort - Math.max(s.capacityMax || BASE_CAPACITY, s.capacityUsed || 0));
  return { kind, id, choice, cost, effort, label, key, reason, stretch };
}
export function applyTownAction(s, command) {
  if (typeof command !== "string") return false;
  const [action, stamp] = command.split("@");
  if (stamp !== undefined && Number(stamp) !== s.month) return false;
  if (action === "advance") return advanceTown(s);
  const a = actionInfo(s, action);
  if (a.reason) return false;
  s.budget -= a.cost;
  s.capacityUsed = (s.capacityUsed || 0) + a.effort;
  s.used.push(a.key);
  if (a.kind === "civic") effect(s, CIVIC_ACTIONS.find((x) => x.id === a.id).effects);
  if (["repair", "toggle"].includes(a.kind)) {
    const b = s.buildings.find((b) => b.id === a.id);
    if (a.kind === "repair") b.condition = clamp(b.condition + 30);
    else b.open = !b.open;
    if (a.id === "school" && b.open && b.condition >= 50 && s.flags.teacherLeft) {
      s.npcs.find((n) => n.id === "elif").present = true;
      s.flags.teacherLeft = false;
      addHistory(
        s,
        "Elif onarılan okula dönmeyi kabul etti.",
        "Elif agreed to return to the repaired school.",
        "callback",
      );
    }
  }
  if (a.kind === "event") {
    const e = s.events.find((e) => e.id === a.id),
      d = EVENTS.find((e) => e.id === a.id),
      c = d.choices.find((c) => c.id === a.choice);
    e.status = "resolved";
    e.choice = c.id;
    effect(s, c.effects);
    if (c.delay)
      s.pending.push({
        id: `event-${e.id}`,
        source: e.id,
        due: s.month + c.delay,
        effects: c.later,
        text: c.text,
      });
    remember(
      s,
      d.rememberGroup ||
        (d.gate === "school"
          ? "young"
          : d.gate === "water"
            ? "farmers"
            : d.gate === "health"
              ? "elders"
              : "trades"),
      d.title[0],
      d.title[1],
      c.id === "act" ? 5 : -4,
    );
    s.flags.townArcs =
      s.flags.townArcs && typeof s.flags.townArcs === "object" ? s.flags.townArcs : {};
    if (d.setFlag) s.flags.townArcs[d.setFlag] = c.id === "act" ? d.branch || true : "declined";
    if (d.exclusive && c.id === "act") s.flags.townArcs[d.exclusive] = d.branch || d.id;
  }
  if (a.kind === "investor") {
    const o = s.investors.find((o) => o.id === a.id),
      d = INVESTORS.find((i) => i.id === a.id);
    if (a.choice === "negotiate") {
      o.negotiated = true;
      remember(
        s,
        "investors",
        "Yerel şartlar için pazarlık yapıldı.",
        "Local terms were negotiated.",
        -3,
      );
    }
    if (a.choice === "reject") {
      o.status = "rejected";
      effect(s, { localIdentity: 3, company: -2 });
      remember(s, "investors", "Teklif reddedildi.", "Offer rejected.", -6);
    }
    if (a.choice === "accept") {
      const terms = investorTerms(s, o.id);
      o.status = "accepted";
      o.acceptedMonth = s.month;
      const f = o.negotiated ? 0.65 : 1;
      effect(s, {
        budget: terms.grant,
        jobs: terms.jobs,
        company: terms.control,
        trust: -terms.trustCost,
        localIdentity: -terms.identityCost,
        ...Object.fromEntries(
          Object.entries(d.effects).map(([k, v]) => [
            k,
            v < 0 || ["pollution", "inequality", "rent"].includes(k)
              ? Math.round(v * f)
              : Math.round(v * terms.benefitFactor),
          ]),
        ),
      });
      const b = s.buildings.find((b) => b.id === d.building);
      b.open = true;
      b.condition = Math.max(70, b.condition);
      s.pending.push({
        id: `investor-${o.id}`,
        source: o.id,
        due: s.month + 3,
        effects: { rent: o.negotiated ? 2 : 6, inequality: o.negotiated ? 2 : 7 },
        text: [`${d.name[0]} çevresinde kiralar arttı.`, `Rents rose around the ${d.name[1]}.`],
      });
      addHistory(
        s,
        `Sözleşme aylık ${terms.monthlyCommitment.toLocaleString("tr-TR")} TL hizmet ve arazi yükümlülüğü getirdi${terms.conflict ? "; mevcut yatırımla çıkar çatışması doğdu" : ""}.`,
        `The contract added a monthly service and land commitment of ${terms.monthlyCommitment.toLocaleString("en-GB")} TL${terms.conflict ? "; it conflicts with an existing investment" : ""}.`,
        "investor",
      );
      remember(s, "workers", "Yeni yatırım iş açtı.", "New investment opened jobs.", 8);
      remember(
        s,
        "green",
        "Yatırımın çevre şartları kayda geçti.",
        "Environmental terms were recorded.",
        o.negotiated ? 2 : -7,
      );
      remember(
        s,
        "trades",
        "Yeni yatırım yerel rekabeti değiştirdi.",
        "New investment changed local competition.",
        -4,
      );
    }
  }
  if (a.kind === "talk") {
    const n = s.npcs.find((n) => n.id === a.id),
      d = NPCS.find((n) => n.id === a.id);
    n.loyalty = clamp(n.loyalty + 4);
    remember(s, n.group, d.goal[0], d.goal[1], 5);
    const peer = s.npcs.find((p) => p.id === d.relation);
    if (peer?.present) peer.trust = clamp(peer.trust + 1);
    effect(s, { trust: 1 });
    s.flags.followsTownAgenda = true;
  }
  if (a.kind === "coalition") {
    s.coalitions = s.coalitions.filter((c) => c.until >= s.month);
    s.coalitions.push({ key: a.key, groups: [a.id, a.choice], until: s.month + 2 });
    remember(s, a.id, "Ortak bakım için el sıkışıldı.", "Agreed to shared maintenance.", 5);
    remember(s, a.choice, "Ortak bakım için el sıkışıldı.", "Agreed to shared maintenance.", 5);
    effect(s, { inequality: -4, trust: 3 });
  }
  addHistory(
    s,
    `${a.label[0]} · ${a.cost.toLocaleString("tr-TR")} TL ayrıldı.`,
    `${a.label[1]} · ${a.cost.toLocaleString("en-GB")} TL allocated.`,
  );
  refreshTown(s);
  return true;
}
export function economy(s) {
  const m = s.metrics,
    i = indicators(s),
    p = population(s),
    modifiers = townModifiers(s);
  const taxRelief = s.investors.filter(
    (o) => o.status === "accepted" && s.month - o.acceptedMonth < 6,
  ).length;
  const identityIncome =
    { production: 1.08, tourism: 1.07, enterprise: 1.06, agriculture: 1.07 }[s.identity] || 1;
  const income = {
    local: Math.round(p * 8 * (0.6 + m.trust / 200)),
    business: Math.round(
      (effective(s, "market") + effective(s, "fuel") + effective(s, "cafe")) *
        24 *
        (1 - taxRelief * 0.07) *
        modifiers.marketIncome,
    ),
    tourism: Math.round((m.tourism * effective(s, "hotel") * effective(s, "heritage")) / 170),
    production: Math.round(
      identityIncome *
        m.production *
        (effective(s, "factory") + effective(s, "workshop")) *
        0.7 *
        (m.energy / 100) *
        (m.road / 100),
    ),
    agriculture: Math.round(
      identityIncome *
        m.agriculture *
        effective(s, "farms") *
        0.9 *
        (m.water / 100) *
        (1 - m.pollution / 150),
    ),
    support: 9000,
    donations: Math.round(Math.max(0, m.localIdentity - 55) * Math.max(0, m.trust - 40) * 2),
  };
  const costs = {
    staff: 3500,
    maintenance: Math.round(
      modifiers.upkeepFactor *
        sum(
          s.buildings.map((b) => BUILDINGS.find((d) => d.id === b.id).upkeep * (b.open ? 1 : 0.15)),
        ),
    ),
    infrastructure: Math.round((1500 + (100 - m.road) * 15) * modifiers.upkeepFactor),
    energy: Math.round(1800 + (100 - m.energy) * 12),
    interest: Math.ceil(s.debt * 0.012),
    health: Math.round(i.health * 18),
    education: Math.round(i.school * 16),
    commitments: s.investors
      .filter((offer) => offer.status === "accepted")
      .reduce((total, offer, index) => total + 900 + index * 300, 0),
  };
  return {
    income,
    costs,
    totalIncome: Math.round(sum(Object.values(income))),
    totalCosts: Math.round(sum(Object.values(costs))),
  };
}
export function endingFor(s) {
  const p = population(s),
    y = youngPopulation(s),
    m = s.metrics,
    services = indicators(s).services;
  let id;
  if (p < 350 || services < 20) id = "ghost";
  else if (m.company >= 55) id = "sold";
  else if (m.inequality >= 68) id = "divided";
  else if (s.budget >= 180000 && m.localIdentity < 45) id = "soulless";
  else if (y < 75 || s.cohorts.find((c) => c.id === "retired").count / Math.max(1, p) > 0.4)
    id = "quiet";
  else if (p >= 850 && y >= 130 && m.trust >= 55 && services >= 50) id = "reborn";
  else if (m.localIdentity >= 50 && m.trust >= 40) id = "resistant";
  else id = "quiet";
  const stage = TOWN_STAGES.find((x) => x.id === s.progression.stage).label;
  return {
    id,
    reasons: [
      [`Nüfus ${p}; genç/eğitimli ${y}.`, `Population ${p}; young/educated ${y}.`],
      [
        `Hizmet ${Math.round(services)}/100; güven ${Math.round(m.trust)}/100.`,
        `Services ${Math.round(services)}/100; trust ${Math.round(m.trust)}/100.`,
      ],
      [
        `Şirket kontrolü ${Math.round(m.company)}%; eşitsizlik ${Math.round(m.inequality)}/100.`,
        `Company control ${Math.round(m.company)}%; inequality ${Math.round(m.inequality)}/100.`,
      ],
      [
        `Yerel kimlik ${Math.round(m.localIdentity)}/100; bütçe ${Math.round(s.budget)} TL; borç ${Math.round(s.debt)} TL.`,
        `Local identity ${Math.round(m.localIdentity)}/100; budget ${Math.round(s.budget)} TL; debt ${Math.round(s.debt)} TL.`,
      ],
      [
        `${s.investors.filter((x) => x.status === "accepted").length} yatırım imzalandı; ${s.npcs.filter((x) => !x.present).length} önemli kişi ayrıldı; yönetim katmanı ${stage[0]}.`,
        `${s.investors.filter((x) => x.status === "accepted").length} investments were signed; ${s.npcs.filter((x) => !x.present).length} key people left; governance stage ${stage[1]}.`,
      ],
      [
        `Kurumlar: ${(s.progression.institutions || []).join(", ") || "yok"}. Kimlik: ${s.identity}.`,
        `Institutions: ${(s.progression.institutions || []).join(", ") || "none"}. Identity: ${s.identity}.`,
      ],
      [
        `Göç defteri ${ (s.migrationLog || []).length } kayıt; net son ay ${(s.report && s.report.migration) || 0}.`,
        `Migration log has ${(s.migrationLog || []).length} entries; last net ${(s.report && s.report.migration) || 0}.`,
      ],
      [
        `Grup güveni: ${s.groups.map((g) => g.id + " " + Math.round(g.trust)).join(", ")}.`,
        `Group trust: ${s.groups.map((g) => g.id + " " + Math.round(g.trust)).join(", ")}.`,
      ],
    ],
  };
}
export function advanceTown(s) {
  if (s.ended) return false;
  const before = {
    population: population(s),
    budget: s.budget,
    debt: s.debt,
    trust: s.metrics.trust,
    identity: s.identity,
  };
  const finance = economy(s),
    modifiers = townModifiers(s);
  effect(s, { budget: finance.totalIncome - finance.totalCosts });
  const m = s.metrics;
  for (const b of s.buildings)
    b.condition = clamp(
      b.condition - (b.open ? 2 : 1) + (s.coalitions.some((c) => c.until >= s.month) ? 1 : 0),
    );
  effect(s, { road: -3, water: -2, energy: -2 });
  const blocked =
    m.road < 30 || effective(s, "fuel") < 20 || !s.buildings.find((b) => b.id === "market").open;
  effect(s, { supply: blocked ? -14 : 5, prices: blocked ? 12 : m.supply > 60 ? -5 : 4 });
  if (blocked)
    addHistory(
      s,
      "Ulaşım aksadı → stok azaldı → fiyatlar yükseldi.",
      "Transport failed → stocks fell → prices rose.",
      "chain",
    );
  updateChain(
    s,
    "road-supply",
    blocked ? "crisis" : m.supply >= 60 ? "stable" : "risk",
    blocked
      ? "Yol-stok zinciri kriz aşamasına geçti."
      : "Yol-stok zinciri yeniden izlenebilir düzeye geldi.",
    blocked
      ? "The road-supply chain entered crisis."
      : "The road-supply chain returned to a manageable state.",
  );
  const i = indicators(s),
    pressure = {
      jobs: (55 - i.jobs) / 18,
      health: (55 - i.health) / 18,
      school: (55 - i.school) / 18,
      social: (50 - i.social) / 20,
      rent: (m.rent - 45) / 20,
      trust: (50 - m.trust) / 20,
      pollution: (m.pollution - 25) / 20,
      water: (55 - m.water) / 18,
      supply: (65 - m.supply) / 18,
    };
  for (const c of s.cohorts) {
    const d = COHORTS.find((d) => d.id === c.id);
    const weighted =
      sum(Object.entries(d.weights).map(([k, w]) => pressure[k] * w)) /
      sum(Object.values(d.weights));
    const pulls = {
      production: ["workers", "families"],
      tourism: ["young", "educated"],
      enterprise: ["young", "newcomers"],
      agriculture: ["farmers", "families"],
      culture: ["educated", "young"],
      retirement: ["retired"],
    };
    const identityPull = (pulls[s.identity] || []).includes(c.id) ? 0.35 : 0;
    const rate = clamp(
      weighted +
        (m.prices - 100) / 35 +
        (50 - i.transport) / 40 -
        identityPull -
        modifiers.migrationRelief,
      -1.5,
      5,
    );
    const delta = -Math.round((c.count * rate) / 100);
    c.lastDelta = Math.max(-c.count, delta) || 0;
    c.count = Math.max(0, c.count + c.lastDelta);
    if (c.lastDelta) {
      s.migrationLog.push({
        month: s.month,
        cohort: c.id,
        delta: c.lastDelta,
        identity: s.identity,
      });
      s.migrationLog = s.migrationLog.slice(-48);
    }
  }
  const pupils =
    s.cohorts.find((c) => c.id === "families").count * 0.3 +
    s.cohorts.find((c) => c.id === "young").count * 0.15;
  if (
    (pupils < 65 ||
      !s.buildings.find((b) => b.id === "school").open ||
      effective(s, "school") < 20) &&
    !s.flags.teacherLeft
  ) {
    s.flags.teacherLeft = true;
    s.npcs.find((n) => n.id === "elif").present = false;
    effect(s, { school: -15, trust: -5 });
    addHistory(
      s,
      "Öğrenci ve hizmet kaybı → Elif ayrıldı → ailelerin okul seçeneği daraldı.",
      "Loss of pupils and services → Elif left → families lost a school option.",
      "chain",
    );
    updateChain(
      s,
      "school-families",
      "teacher-left",
      "Okul-aile zincirinde öğretmen ayrılığı kayda geçti.",
      "Teacher departure was recorded in the school-family chain.",
    );
  } else if (!s.flags.teacherLeft && effective(s, "school") >= 50) {
    updateChain(
      s,
      "school-families",
      "stable",
      "Okul-aile zinciri dengede.",
      "The school-family chain is stable.",
    );
  }
  effect(s, {
    trust: (i.services < 35 ? -4 : 1) + modifiers.councilTrust,
    reputation: population(s) >= before.population ? 1 : -1,
    company: -modifiers.companyResistance,
    localIdentity: modifiers.companyResistance ? 1 : 0,
  });
  for (const g of s.groups) {
    const desire = {
      trades: m.supply,
      young: i.jobs,
      elders: i.health,
      farmers: m.water,
      workers: i.jobs,
      newcomers: 100 - m.rent,
      investors: m.company + 35,
      staff: s.debt < 80000 ? 65 : 25,
      green: 100 - m.pollution,
    }[g.id];
    g.trust = clamp(g.trust + (desire - 50) / 15);
  }
  m.trust = clamp(
    m.trust * 0.8 +
      (sum(s.groups.map((g) => g.trust * g.influence)) / sum(s.groups.map((g) => g.influence))) *
        0.2,
  );
  for (const n of s.npcs) {
    n.loyalty = clamp(n.loyalty + (s.groups.find((g) => g.id === n.group).trust - 50) / 30);
    if (n.loyalty < 15 && n.present) {
      n.present = false;
      const d = NPCS.find((d) => d.id === n.id);
      addHistory(s, `${d.name[0]} köyden ayrıldı.`, `${d.name[1]} left the village.`, "migration");
    }
  }
  s.completedMonths++;
  // The next month's delayed outcomes are applied exactly once before its agenda.
  const next = Math.min(24, s.month + 1);
  for (const p of s.pending.filter((p) => p.due <= next)) {
    if (s.resolvedEffects.includes(p.id)) continue;
    effect(s, p.effects);
    addHistory(s, p.text[0], p.text[1], "callback");
    s.openCases.push({ id: p.id, closed: next, text: p.text });
    s.resolvedEffects.push(p.id);
    s.resolvedEffects = s.resolvedEffects.slice(-80);
  }
  s.pending = s.pending.filter((p) => p.due > next);
  s.openCases = s.openCases.slice(-40);
  for (const e of s.events.filter((e) => e.status === "open" && e.expires <= next)) {
    e.status = "expired";
    const d = EVENTS.find((d) => d.id === e.id);
    effect(s, d.choices[1].effects);
    addHistory(
      s,
      `${d.title[0]} yanıtsız kaldı; reddetme sonucu uygulandı.`,
      `${d.title[1]} went unanswered; decline consequences applied.`,
      "deadline",
    );
  }
  s.identity = deriveIdentity(s);
  updateTownProgression(s);
  if (s.investors.some((x) => x.status === "accepted")) {
    updateChain(
      s,
      "investor-dependency",
      m.company >= 45 ? "dependency" : "bargained",
      "Yatırımcı bağımlılığı dosyası güncellendi.",
      "The investor-dependency file was updated.",
    );
  }
  if (s.progression.institutions.includes("town-charter")) {
    updateChain(
      s,
      "town-charter",
      "available",
      "Köy şartı artık kurumsal olarak mümkün.",
      "A village charter is now institutionally possible.",
    );
  }
  s.report = {
    month: s.month,
    before,
    after: {
      population: population(s),
      budget: s.budget,
      debt: s.debt,
      trust: m.trust,
      identity: s.identity,
    },
    finance,
    migration: population(s) - before.population,
    cohorts: s.cohorts.map((c) => ({ id: c.id, delta: c.lastDelta })),
    stage: s.progression.stage,
    institutions: s.progression.institutions.slice(),
    activeChains: Object.values(s.chains).map((c) => ({ id: c.id, stage: c.stage })),
    capacity: { used: s.capacityUsed || 0, max: s.capacityMax || BASE_CAPACITY, next: nextCapacity(s) },
  };
  if (s.report.capacity.next !== BASE_CAPACITY)
    addHistory(
      s,
      s.report.capacity.next < BASE_CAPACITY
        ? `Ekip zorlandı: gelecek ay saha kapasitesi ${s.report.capacity.next}.`
        : `İş planlı yürüdü: gelecek ay ${RESERVE_BONUS} ek saha kapasitesi.`,
      s.report.capacity.next < BASE_CAPACITY
        ? `The team was stretched: next month's field capacity is ${s.report.capacity.next}.`
        : `Work ran to plan: ${RESERVE_BONUS} extra field capacity next month.`,
      "month",
    );
  addHistory(
    s,
    `Ay kapandı: gelir ${finance.totalIncome} TL, gider ${finance.totalCosts} TL, nüfus ${population(s) - before.population >= 0 ? "+" : ""}${population(s) - before.population}.`,
    `Month closed: income ${finance.totalIncome} TL, costs ${finance.totalCosts} TL, population ${population(s) - before.population >= 0 ? "+" : ""}${population(s) - before.population}.`,
    "month",
  );
  if (s.completedMonths === 24) {
    s.ended = true;
    s.ending = endingFor(s);
    s.ui.screen = "report";
  } else {
    s.month++;
    s.used = [];
    s.capacityMax = nextCapacity(s);
    s.capacityUsed = 0;
    refreshTown(s);
    s.ui.screen = "report";
  }
  return true;
}

/**
 * What needs an answer this month and what is an investment that can wait.
 * Read-only: it ranks what the engine already exposes, it never decides.
 */
export function triage(s) {
  const urgent = [],
    invest = [];
  const next = s.month + 1;
  for (const e of s.events.filter((e) => e.status === "open")) {
    const d = EVENTS.find((d) => d.id === e.id);
    if (!d) continue;
    const row = { kind: "event", id: e.id, label: d.title, screen: "agenda", expires: e.expires };
    if (e.expires <= next)
      urgent.push({ ...row, reason: ["Bu ay kapanınca düşer", "Lapses when this month closes"] });
    else invest.push({ ...row, reason: [`Son yanıt: ay ${e.expires}`, `Reply by month ${e.expires}`] });
  }
  const i = indicators(s),
    m = s.metrics;
  const infra = [
    ["road", m.road, 35, ["Yol kopuyor: stok ve fiyat zinciri", "Road failing: supply and price chain"]],
    ["water", m.water, 35, ["Su hattı zayıf", "Water supply weak"]],
    ["energy", m.energy, 35, ["Enerji ağı zayıf", "Power network weak"]],
  ];
  for (const [id, v, floor, reason] of infra)
    if (v < floor)
      urgent.push({ kind: "civic", id, label: CIVIC_ACTIONS.find((a) => a.id === id).label, screen: "center", reason });
  for (const b of s.buildings.filter((b) => b.open && b.condition < 40)) {
    const d = BUILDINGS.find((x) => x.id === b.id);
    urgent.push({ kind: "building", id: b.id, label: d.name, screen: "services", reason: [`Bina durumu ${b.condition}/100`, `Condition ${b.condition}/100`] });
  }
  if (i.jobs < 45)
    invest.push({ kind: "civic", id: "support", label: CIVIC_ACTIONS.find((a) => a.id === "support").label, screen: "center", reason: ["İş imkânı zayıf; kalma kararını besler", "Jobs are weak; feeds the decision to stay"] });
  if (m.social < 45)
    invest.push({ kind: "civic", id: "festival", label: CIVIC_ACTIONS.find((a) => a.id === "festival").label, screen: "center", reason: ["Sosyal hayat zayıf", "Social life is weak"] });
  for (const o of s.investors.filter((o) => o.status === "offered")) {
    const d = INVESTORS.find((x) => x.id === o.id);
    if (d) invest.push({ kind: "investor", id: o.id, label: d.name, screen: "investors", reason: ["Açık yatırım teklifi", "Open investment offer"] });
  }
  // Anything already handled this month is not a suggestion any more.
  const open = (x) => !s.used.includes(x.kind === "event" ? `event:${x.id}` : x.kind === "building" ? `building:${x.id}` : x.kind === "investor" ? `investor:${x.id}` : `civic:${x.id}`);
  return { urgent: urgent.filter(open).slice(0, 4), invest: invest.filter(open).slice(0, 4) };
}
