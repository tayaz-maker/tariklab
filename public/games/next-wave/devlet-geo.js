// DEVLET map layer: a monthly regional priority and diplomatic initiatives.
// Both spend the same governance capacity as policies, show their exact
// effect before the player commits (preview* functions use the same numbers
// the tick applies), and carry delayed consequences.
//
// Foreign actors are the game's existing relation axes. Effects are abstract
// relation-index and game-state changes; nothing here asserts a real-world fact.
import { beginDecisionMonth } from "./devlet-sim.js";

const cap = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const round = (v) => Math.round(v * 10) / 10;

export const FOCUS_COST = 1;
export const FOCUS_STREAK_DECAY = 0.6;
const FOCUS_GAIN = { impl: 2, services: 2, infrastructure: 1.5, satisfaction: 2, heat: -1.5 };
const FOCUS_NEGLECT = { satisfaction: -0.4, heat: 0.3 };

/** Who reacts when you move toward an actor: rivals cool, partners warm. */
export const FOREIGN_TIES = {
  us: { rivals: ["ru", "ir"], partners: ["nato"] },
  nato: { rivals: ["ru"], partners: ["us", "eu"] },
  eu: { rivals: ["ru"], partners: ["nato"] },
  ru: { rivals: ["us", "nato", "eu"], partners: ["ir"] },
  ir: { rivals: ["us", "gulf"], partners: ["ru"] },
  gulf: { rivals: ["ir"], partners: [] },
  gr: { rivals: [], partners: ["eu"] },
  cy: { rivals: [], partners: ["eu", "gr"] },
};

export const DIPLOMACY = {
  trade: { cost: 1, relation: 4, rival: -1, partner: 1, world: { tradeDemand: 2 }, heat: 0, due: 3, later: { relation: 1, activity: 2 } },
  security: { cost: 2, relation: 6, rival: -4, partner: 2, world: { regionalRisk: -3 }, heat: 2, due: 2, later: { relation: 1, regionalRisk: -2 } },
  distance: { cost: 1, relation: -6, rival: 2, partner: -1, world: { tradeDemand: -1 }, heat: -2, due: 2, later: { relation: -2, tradeDemand: -1 } },
};
/* Depth chain. Regional priority → capacity → service gap / public reaction →
   next-period effect; diplomacy → agreement, pressure, trade, risk and delayed
   domestic effects. Abstract indices only; no real-world claim. */
/** Months without a priority after which a region with a service gap reacts. */
export const QUIET_REACTION = 4;
const REACTION = { heat: 1.5, satisfaction: -0.6, impl: -1 };
/** Delivery readiness below this turns less of a priority into service. */
export const LOW_DELIVERY = 40;
export const LOW_DELIVERY_FACTOR = 0.7;
/** What a priority leaves for the next month: perceived service. */
const FOCUS_LATER = { satisfaction: 1 };
/** Trade or security at or above this relation, once due, becomes an agreement. */
export const AGREEMENT_AT = 60;
export const AGREEMENT_MONTHS = 6;
const AGREEMENT_EFFECT = { trade: { tradeDemand: 0.5 }, security: { regionalRisk: -0.5 } };
const BREACH = { relation: -4, heat: 2 };
/** Below this relation a party presses: less trade, more tension at home. */
export const PRESSURE_BELOW = 30;
const PRESSURE = { tradeDemand: -0.5, heat: 0.5 };

/** Coasts and gateways where trade shows up first. */
export const TRADE_REGIONS = ["marmara", "ege", "akdeniz"];

export function ensureGeo(s) {
  // Normalised in place: callers keep a reference across a single action.
  if (!s.geo || typeof s.geo !== "object") s.geo = {};
  const g = s.geo;
  if (!(g.focus && typeof g.focus.id === "string")) g.focus = null;
  if (typeof g.lastFocus !== "string") g.lastFocus = null;
  if (!Number.isFinite(g.streak)) g.streak = 0;
  g.pending = Array.isArray(g.pending) ? g.pending.filter((p) => p && FOREIGN_TIES[p.axis] && DIPLOMACY[p.kind] && Number.isFinite(p.due)).slice(-24) : [];
  if (typeof g.month !== "string") g.month = "";
  g.used = Array.isArray(g.used) ? g.used.filter((x) => typeof x === "string").slice(-12) : [];
  g.log = Array.isArray(g.log) ? g.log.slice(-20) : [];
  g.quiet = g.quiet && typeof g.quiet === "object" ? g.quiet : {};
  for (const k of Object.keys(g.quiet)) if (!Number.isInteger(g.quiet[k]) || g.quiet[k] < 0) delete g.quiet[k];
  g.later = Array.isArray(g.later) ? g.later.filter((x) => x && typeof x.id === "string" && Number.isFinite(x.due)).slice(-14) : [];
  g.agreements = g.agreements && typeof g.agreements === "object" ? g.agreements : {};
  for (const [k, a] of Object.entries(g.agreements))
    if (!FOREIGN_TIES[k] || !a || !AGREEMENT_EFFECT[a.kind] || !Number.isFinite(a.until)) delete g.agreements[k];
  return g;
}

/** A normalised read-only view of the geo state; never writes to `s` (views must stay pure). */
export function readGeo(s) {
  const g = s.geo && typeof s.geo === "object" ? s.geo : {};
  return {
    focus: g.focus && typeof g.focus.id === "string" ? g.focus : null,
    lastFocus: typeof g.lastFocus === "string" ? g.lastFocus : null,
    streak: Number.isFinite(g.streak) ? g.streak : 0,
    pending: Array.isArray(g.pending) ? g.pending.filter((p) => p && FOREIGN_TIES[p.axis] && DIPLOMACY[p.kind] && Number.isFinite(p.due)) : [],
    month: typeof g.month === "string" ? g.month : "",
    used: Array.isArray(g.used) ? g.used.filter((x) => typeof x === "string") : [],
    log: Array.isArray(g.log) ? g.log : [],
    quiet: g.quiet && typeof g.quiet === "object" ? g.quiet : {},
    later: Array.isArray(g.later) ? g.later : [],
    agreements: g.agreements && typeof g.agreements === "object" ? g.agreements : {},
  };
}

/** Months since a region was last the priority (0 while it is). */
export function quietMonths(s, regionId) {
  const q = readGeo(s).quiet[regionId];
  return Number.isInteger(q) ? q : 0;
}
const hasGap = (r) => (r.services ?? 50) < 45 || (r.satisfaction ?? 50) < 45;
/** Public reaction a neglected region will add at the next month close. */
export function reactionFor(s, r) {
  return quietMonths(s, r.id) + 1 >= QUIET_REACTION && hasGap(r) ? { ...REACTION } : null;
}

function openMonth(s) {
  const stamp = beginDecisionMonth(s);
  const g = ensureGeo(s);
  if (g.month !== stamp) {
    g.month = stamp;
    g.used = [];
  }
  return g;
}

const capacityLeft = (s) => (s.flags.governanceCapacity || 8) - (s.flags.governanceUsed || 0);

// ---- Regional priority ----

/** Exactly what holding `regionId` as this month's priority will do at month close. */
export function previewFocus(s, regionId) {
  const g = readGeo(s);
  const region = (s.regions || []).find((r) => r.id === regionId);
  if (!region) return { ok: false, reason: ["Bölge yok", "No such region"] };
  const streak = g.lastFocus === regionId ? g.streak + 1 : 1;
  const weak = (region.impl ?? 50) < LOW_DELIVERY;
  const factor = (streak >= 3 ? FOCUS_STREAK_DECAY : 1) * (weak ? LOW_DELIVERY_FACTOR : 1);
  const gain = Object.fromEntries(Object.entries(FOCUS_GAIN).map(([k, v]) => [k, round(v * factor)]));
  const stamp = s.time.year + "-" + s.time.month;
  const already = g.month === stamp && g.focus?.id;
  let reason = null;
  if (s.flags?.campaignEnd) reason = ["Dönem kapandı", "The run is closed"];
  else if (already) reason = ["Bu ay öncelik zaten belirlendi", "This month's priority is already set"];
  else if (g.month === stamp ? capacityLeft(s) < FOCUS_COST : false) reason = ["Yönetim kapasitesi yetmiyor", "Not enough governing capacity"];
  const quiet = quietMonths(s, regionId);
  return {
    ok: !reason, reason, cost: FOCUS_COST, streak, factor, gain, neglect: { ...FOCUS_NEGLECT }, others: (s.regions || []).length - 1,
    weak,
    quiet,
    reactionStops: Boolean(reactionFor(s, region)),
    later: { ...FOCUS_LATER },
    reacting: (s.regions || []).filter((r) => r.id !== regionId && reactionFor(s, r)).map((r) => r.id),
  };
}

export function setRegionFocus(s, regionId) {
  const g = openMonth(s);
  const p = previewFocus(s, regionId);
  if (!p.ok || capacityLeft(s) < FOCUS_COST) return false;
  s.flags.governanceUsed = (s.flags.governanceUsed || 0) + FOCUS_COST;
  g.focus = { id: regionId, turn: s.time.turn, streak: p.streak, factor: p.factor };
  return true;
}

// ---- Diplomacy ----

export function previewDiplomacy(s, axis, kind) {
  const g = readGeo(s);
  const d = DIPLOMACY[kind],
    ties = FOREIGN_TIES[axis];
  if (!d || !ties || !(axis in (s.foreign || {}))) return { ok: false, reason: ["Geçersiz girişim", "Invalid initiative"] };
  const stamp = s.time.year + "-" + s.time.month;
  const used = g.month === stamp && g.used.includes(axis);
  const left = g.month === stamp ? capacityLeft(s) : Math.max(5, s.flags.governanceCapacity || 8);
  let reason = null;
  if (s.flags?.campaignEnd) reason = ["Dönem kapandı", "The run is closed"];
  else if (used) reason = ["Bu ay bu tarafla zaten bir girişim yapıldı", "Already an initiative with this party this month"];
  else if (left < d.cost) reason = ["Yönetim kapasitesi yetmiyor", "Not enough governing capacity"];
  const relation = {};
  relation[axis] = { from: s.foreign[axis], to: cap(s.foreign[axis] + d.relation) };
  for (const r of ties.rivals) if (r in s.foreign) relation[r] = { from: s.foreign[r], to: cap(s.foreign[r] + d.rival) };
  for (const r of ties.partners) if (r in s.foreign) relation[r] = { from: s.foreign[r], to: cap(s.foreign[r] + d.partner) };
  const agreement = g.agreements?.[axis] && g.agreements[axis].until >= s.time.turn ? g.agreements[axis] : null;
  const breach = kind === "distance" && agreement ? { ...BREACH } : null;
  if (breach) relation[axis].to = cap(relation[axis].to + breach.relation);
  return {
    ok: !reason,
    reason,
    cost: d.cost,
    relation,
    world: { ...d.world },
    heat: d.heat + (breach ? breach.heat : 0),
    agreement,
    breach,
    formsAgreement: kind !== "distance" && relation[axis].to >= AGREEMENT_AT,
    pressing: s.foreign[axis] < PRESSURE_BELOW,
    dueTurn: s.time.turn + d.due,
    dueIn: d.due,
    later: { ...d.later },
  };
}

export function applyDiplomacy(s, axis, kind) {
  const g = openMonth(s);
  const p = previewDiplomacy(s, axis, kind);
  if (!p.ok) return false;
  s.flags.governanceUsed = (s.flags.governanceUsed || 0) + p.cost;
  for (const [k, v] of Object.entries(p.relation)) s.foreign[k] = v.to;
  const w = s.devletDepth?.world;
  if (w) for (const [k, v] of Object.entries(p.world)) w[k] = cap((w[k] ?? 50) + v);
  s.heat = cap((s.heat || 0) + p.heat);
  g.used.push(axis);
  if (p.breach) {
    delete g.agreements[axis];
    g.log.push({ turn: s.time.turn, type: "breach", axis });
  }
  g.pending.push({ axis, kind, due: p.dueTurn, turn: s.time.turn });
  g.log.push({ turn: s.time.turn, type: "diplomacy", axis, kind });
  g.log = g.log.slice(-20);
  return true;
}

// ---- Month close ----

/** Applies the closing month's regional priority and any diplomacy that has come due. */
export function applyGeoTick(s) {
  const g = ensureGeo(s);
  const out = [];
  if (g.focus) {
    const f = g.focus;
    for (const r of s.regions || []) {
      if (r.id === f.id) {
        r.impl = cap(r.impl + FOCUS_GAIN.impl * f.factor, 0, 90);
        r.services = cap((r.services ?? 50) + FOCUS_GAIN.services * f.factor);
        r.infrastructure = cap((r.infrastructure ?? 50) + FOCUS_GAIN.infrastructure * f.factor);
        r.satisfaction = cap((r.satisfaction ?? 50) + FOCUS_GAIN.satisfaction * f.factor);
        r.heat = cap(r.heat + FOCUS_GAIN.heat * f.factor);
      } else {
        r.satisfaction = cap((r.satisfaction ?? 50) + FOCUS_NEGLECT.satisfaction);
        r.heat = cap(r.heat + FOCUS_NEGLECT.heat);
      }
    }
    g.later.push({ id: f.id, due: s.time.turn + 1, ...FOCUS_LATER });
    g.streak = g.lastFocus === f.id ? g.streak + 1 : 1;
    g.lastFocus = f.id;
    g.log.push({ turn: s.time.turn, type: "focus", region: f.id, factor: f.factor });
    out.push({ type: "focus", region: f.id, factor: f.factor });
    g.focus = null;
  } else {
    g.streak = 0;
    g.lastFocus = null;
  }
  const due = g.pending.filter((p) => p.due <= s.time.turn);
  for (const p of due) {
    const later = DIPLOMACY[p.kind].later;
    if (later.relation) s.foreign[p.axis] = cap(s.foreign[p.axis] + later.relation);
    const w = s.devletDepth?.world;
    if (w && later.regionalRisk) w.regionalRisk = cap(w.regionalRisk + later.regionalRisk);
    if (w && later.tradeDemand) w.tradeDemand = cap(w.tradeDemand + later.tradeDemand);
    if (later.activity)
      for (const r of s.regions || []) if (TRADE_REGIONS.includes(r.id)) r.activity = cap((r.activity ?? 50) + later.activity);
    g.log.push({ turn: s.time.turn, type: "diplomacy-due", axis: p.axis, kind: p.kind, from: p.turn });
    out.push({ type: "diplomacy-due", axis: p.axis, kind: p.kind, from: p.turn });
  }
  g.pending = g.pending.filter((p) => p.due > s.time.turn);
  // Agreements: a due trade or security step on a warm relation becomes one.
  for (const p of due)
    if (AGREEMENT_EFFECT[p.kind] && (s.foreign[p.axis] ?? 0) >= AGREEMENT_AT) {
      g.agreements[p.axis] = { kind: p.kind, until: s.time.turn + AGREEMENT_MONTHS };
      g.log.push({ turn: s.time.turn, type: "agreement", axis: p.axis, kind: p.kind });
      out.push({ type: "agreement", axis: p.axis, kind: p.kind });
    }
  const w = s.devletDepth?.world;
  for (const [axis, a] of Object.entries(g.agreements)) {
    if (a.until < s.time.turn) {
      delete g.agreements[axis];
      continue;
    }
    if (w) for (const [k, v] of Object.entries(AGREEMENT_EFFECT[a.kind])) w[k] = cap((w[k] ?? 50) + v);
  }
  // Pressure from strained parties (at most two count).
  const pressing = Object.keys(FOREIGN_TIES).filter((k) => k in (s.foreign || {}) && s.foreign[k] < PRESSURE_BELOW).slice(0, 2);
  for (const axis of pressing) {
    if (w) w.tradeDemand = cap((w.tradeDemand ?? 50) + PRESSURE.tradeDemand);
    s.heat = cap((s.heat || 0) + PRESSURE.heat);
  }
  if (pressing.length) out.push({ type: "pressure", axes: pressing });
  // Regions: the priority's delayed service perception, neglect and reaction.
  for (const x of g.later.filter((x) => x.due <= s.time.turn)) {
    const r = (s.regions || []).find((y) => y.id === x.id);
    if (r) r.satisfaction = cap((r.satisfaction ?? 50) + (x.satisfaction || 0));
  }
  g.later = g.later.filter((x) => x.due > s.time.turn);
  const focused = out.find((x) => x.type === "focus")?.region || null;
  for (const r of s.regions || []) {
    if (r.id === focused) {
      g.quiet[r.id] = 0;
      continue;
    }
    const q = (g.quiet[r.id] || 0) + 1;
    g.quiet[r.id] = q;
    if (q >= QUIET_REACTION && hasGap(r)) {
      r.heat = cap(r.heat + REACTION.heat);
      r.satisfaction = cap((r.satisfaction ?? 50) + REACTION.satisfaction);
      r.impl = cap((r.impl ?? 50) + REACTION.impl, 0, 90);
      out.push({ type: "reaction", region: r.id, quiet: q });
    }
  }
  g.log = g.log.slice(-20);
  return out;
}

/** The region the state should look at first, and why. */
export function regionNeeds(r) {
  const rows = [
    ["services", r.services ?? 50],
    ["infrastructure", r.infrastructure ?? 50],
    ["satisfaction", r.satisfaction ?? 50],
    ["jobs", 100 - (r.unemployment ?? 10) * 2.5],
    ["calm", 100 - (r.heat ?? 40)],
    ["impl", r.impl ?? 50],
  ];
  return rows.sort((a, b) => a[1] - b[1]).slice(0, 2).map(([k, v]) => ({ key: k, value: Math.round(v) }));
}
