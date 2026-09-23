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
  };
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
  const factor = streak >= 3 ? FOCUS_STREAK_DECAY : 1;
  const gain = Object.fromEntries(Object.entries(FOCUS_GAIN).map(([k, v]) => [k, round(v * factor)]));
  const stamp = s.time.year + "-" + s.time.month;
  const already = g.month === stamp && g.focus?.id;
  let reason = null;
  if (s.flags?.campaignEnd) reason = ["Dönem kapandı", "The run is closed"];
  else if (already) reason = ["Bu ay öncelik zaten belirlendi", "This month's priority is already set"];
  else if (g.month === stamp ? capacityLeft(s) < FOCUS_COST : false) reason = ["Yönetim kapasitesi yetmiyor", "Not enough governing capacity"];
  return { ok: !reason, reason, cost: FOCUS_COST, streak, factor, gain, neglect: { ...FOCUS_NEGLECT }, others: (s.regions || []).length - 1 };
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
  return {
    ok: !reason,
    reason,
    cost: d.cost,
    relation,
    world: { ...d.world },
    heat: d.heat,
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
