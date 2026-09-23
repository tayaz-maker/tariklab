// Coastal rhythm-network prototype: pure rules. Turn = one day of four rhythm
// windows. previewDay runs the same code on a copy, so the forecast is exact.
import {
  AGREEMENTS,
  CORRIDORS,
  DAYS,
  DISTRICTS,
  DISTRICT_IDS,
  MODES,
  NEEDS,
  UPGRADES,
  WINDOWS,
} from "./data.js";

export const VERSION = 1;
export const START_POINTS = 10;
export const DAILY_POINTS = 5;
export const KEPT_BONUS = 2;
export const FREQ_MULT = [0, 1, 1.6, 2.2];
export const MAX_FREQ = 3;
export const TRANSFER_PENALTY = 2;
export const MAX_TRIP_TIME = 12;
export const WIND_FERRY = 0.5;
export const BREAK_AT = 100;
export const MAX_BROKEN = 3;
export const OFFER_DAYS = [1, 3, 5];

const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(v)));
const clone = (v) => JSON.parse(JSON.stringify(v));
export const keyOf = (a, b) => `${a}-${b}`;
const CORR = Object.fromEntries(CORRIDORS.map((c) => [keyOf(c.a, c.b), c]));
const AGR = Object.fromEntries(AGREEMENTS.map((a) => [a.id, a]));

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createGame({ seed = 1 } = {}) {
  const r = rng(seed * 7919 + 13);
  const windDays = new Set();
  while (windDays.size < 2) windDays.add(2 + Math.floor(r() * (DAYS - 1)));
  const order = AGREEMENTS.map((a) => a.id).sort(() => r() - 0.5);
  const s = {
    v: VERSION,
    seed: seed >>> 0,
    day: 1,
    phase: "plan",
    points: START_POINTS,
    links: {},
    fragility: Object.fromEntries(DISTRICT_IDS.map((d) => [d, 10])),
    broken: [],
    wind: Array.from({ length: DAYS }, (_, i) => windDays.has(i + 1)),
    offerOrder: order,
    offer: null,
    agreements: [],
    report: null,
    history: [],
    totals: { demand: 0, served: 0, careDemand: 0, careAccessible: 0, transfers: 0, trips: 0 },
    ended: false,
    ui: { selected: null, window: 0, tab: "map" },
  };
  openOffer(s);
  return s;
}

function openOffer(s) {
  const idx = OFFER_DAYS.indexOf(s.day);
  s.offer = idx >= 0 ? s.offerOrder[idx] : null;
}

// ---------- building ----------

export function canBuild(s, key, mode) {
  const c = CORR[key];
  if (s.phase !== "plan") return { ok: false, reason: ["Gün çalışıyor", "The day is running"] };
  if (!c || !c.modes.includes(mode))
    return {
      ok: false,
      reason: ["Arazi bu hatta izin vermiyor", "The terrain does not allow this line"],
    };
  if (s.links[key])
    return {
      ok: false,
      reason: ["Bu koridorda zaten hat var", "This corridor already has a line"],
    };
  if (s.points < MODES[mode].cost)
    return { ok: false, reason: ["Yapım puanı yetmiyor", "Not enough build points"] };
  return { ok: true, reason: null };
}

export function build(s, key, mode) {
  if (!canBuild(s, key, mode).ok) return false;
  s.points -= MODES[mode].cost;
  s.links[key] = { mode, freq: 1, night: false, ramp: false, day: s.day };
  return true;
}

export function canUpgrade(s, key, kind) {
  const l = s.links[key];
  if (s.phase !== "plan" || !l || !UPGRADES[kind])
    return { ok: false, reason: ["Geçersiz", "Invalid"] };
  if (s.points < UPGRADES[kind].cost)
    return { ok: false, reason: ["Yapım puanı yetmiyor", "Not enough build points"] };
  if (kind === "freq" && (l.mode === "bridge" || l.freq >= MAX_FREQ))
    return { ok: false, reason: ["Sıklık artırılamaz", "Frequency cannot rise"] };
  if (kind === "night" && (l.mode === "bridge" || l.night))
    return { ok: false, reason: ["Gerek yok", "Not needed"] };
  if (kind === "ramp" && (l.mode !== "bridge" || l.ramp))
    return { ok: false, reason: ["Yalnız yaya geçidine", "Footbridges only"] };
  return { ok: true, reason: null };
}

export function upgrade(s, key, kind) {
  if (!canUpgrade(s, key, kind).ok) return false;
  s.points -= UPGRADES[kind].cost;
  const l = s.links[key];
  if (kind === "freq") l.freq++;
  if (kind === "night") l.night = true;
  if (kind === "ramp") l.ramp = true;
  return true;
}

/** Remove a line built today (full refund); older lines cannot be removed. */
export function unbuild(s, key) {
  const l = s.links[key];
  if (s.phase !== "plan" || !l || l.day !== s.day || l.freq > 1 || l.night || l.ramp) return false;
  s.points += MODES[l.mode].cost;
  delete s.links[key];
  return true;
}

export function answerOffer(s, accept) {
  if (s.phase !== "plan" || !s.offer) return false;
  const a = AGR[s.offer];
  if (accept) s.agreements.push({ id: a.id, due: s.day + a.days, done: false, kept: null });
  else s.fragility[a.district] = clamp(s.fragility[a.district] + 5);
  s.offer = null;
  return true;
}

// ---------- network ----------

const accessibleLink = (l) => MODES[l.mode].accessible || l.ramp;

function edges(s, win, dayWind) {
  const out = [];
  for (const [key, l] of Object.entries(s.links)) {
    const c = CORR[key];
    if (win.nightOnly && l.mode !== "bridge" && !l.night) continue;
    let cap = MODES[l.mode].cap * FREQ_MULT[l.freq];
    if (l.mode === "ferry" && dayWind && (win.id === "morning" || win.id === "evening"))
      cap *= WIND_FERRY;
    out.push({
      key,
      a: c.a,
      b: c.b,
      mode: l.mode,
      cap,
      time: MODES[l.mode].time,
      accessible: accessibleLink(l),
    });
  }
  return out;
}

/** Cheapest route from `from` to `to` over open edges with capacity left. */
export function route(list, from, to, left) {
  const adj = {};
  for (const e of list) {
    if (left && left[e.key] <= 0.01) continue;
    (adj[e.a] ||= []).push({ e, to: e.b });
    (adj[e.b] ||= []).push({ e, to: e.a });
  }
  const best = new Map();
  const queue = [{ node: from, mode: null, cost: 0, path: [] }];
  while (queue.length) {
    queue.sort((x, y) => x.cost - y.cost);
    const cur = queue.shift();
    if (cur.node === to) return cur;
    const k = cur.node + "|" + cur.mode;
    if (best.has(k) && best.get(k) <= cur.cost) continue;
    best.set(k, cur.cost);
    for (const { e, to: next } of adj[cur.node] || []) {
      if (cur.path.some((p) => p.key === e.key)) continue;
      const cost = cur.cost + e.time + (cur.mode && cur.mode !== e.mode ? TRANSFER_PENALTY : 0);
      if (cost > MAX_TRIP_TIME) continue;
      queue.push({ node: next, mode: e.mode, cost, path: [...cur.path, e] });
    }
  }
  return null;
}

export function demand(win) {
  const trips = [];
  for (const [need, volume] of Object.entries(win.flows)) {
    const src = DISTRICT_IDS.map((d) => [
      d,
      DISTRICTS[d].pop + (need === "care" || need === "health" ? DISTRICTS[d].old : 0),
    ]);
    const dst = DISTRICT_IDS.map((d) => [d, DISTRICTS[d].attract[need] || 0]);
    const sw = src.reduce((n, x) => n + x[1], 0),
      dw = dst.reduce((n, x) => n + x[1], 0);
    for (const [a, wa] of src)
      for (const [b, wb] of dst) {
        if (a === b || !wa || !wb) continue;
        const amount = Math.round(((volume * wa) / sw) * (wb / dw) * 10) / 10;
        if (amount < 0.2) continue;
        const rev = (win.reverse || []).includes(need);
        trips.push({ from: rev ? b : a, to: rev ? a : b, need, amount, home: a });
      }
  }
  return trips.sort(
    (x, y) => y.amount - x.amount || x.from.localeCompare(y.from) || x.to.localeCompare(y.to),
  );
}

function runWindow(s, win, dayWind) {
  const list = edges(s, win, dayWind);
  const left = Object.fromEntries(list.map((e) => [e.key, e.cap]));
  const load = Object.fromEntries(list.map((e) => [e.key, 0]));
  const byHome = {};
  let total = 0,
    served = 0,
    careDemand = 0,
    careAccessible = 0,
    transfers = 0,
    trips = 0;
  for (const t of demand(win)) {
    total += t.amount;
    const h = (byHome[t.home] ||= { demand: 0, served: 0 });
    h.demand += t.amount;
    const care = t.need === "care" || t.need === "health";
    if (care) careDemand += t.amount;
    if (s.broken.includes(t.home)) continue;
    const r = route(list, t.from, t.to, left);
    if (!r) continue;
    const room = Math.min(...r.path.map((e) => left[e.key]));
    let got = Math.min(t.amount, room);
    const stepFree = r.path.every((e) => e.accessible);
    for (const e of r.path) {
      left[e.key] -= got;
      load[e.key] += got;
    }
    if (care && !stepFree) got *= 0.5; // half cannot use stairs
    if (care && stepFree) careAccessible += got;
    served += got;
    h.served += got;
    const changes = r.path.reduce((n, e, i) => n + (i && r.path[i - 1].mode !== e.mode ? 1 : 0), 0);
    transfers += changes * got;
    trips += got;
  }
  const overloaded = list.filter((e) => load[e.key] >= e.cap * 0.95).map((e) => e.key);
  return {
    id: win.id,
    total,
    served,
    careDemand,
    careAccessible,
    transfers,
    trips,
    byHome,
    load,
    cap: Object.fromEntries(list.map((e) => [e.key, e.cap])),
    overloaded,
  };
}

export function reachable(s, winId, a, b) {
  const win = WINDOWS.find((w) => w.id === winId);
  return Boolean(route(edges(s, win, false), a, b, null));
}

function testAgreement(s, a, day) {
  const t = a.test;
  const touching = (d) =>
    Object.entries(s.links).filter(([k]) => CORR[k].a === d || CORR[k].b === d);
  if (t.kind === "nightLift")
    return touching(t.district).some(([, l]) => l.mode === "lift" && l.night);
  if (t.kind === "ferryFreq")
    return touching(t.district).some(([, l]) => l.mode === "ferry" && l.freq >= t.freq);
  if (t.kind === "nightPath") return reachable(s, "night", t.a, t.b);
  if (t.kind === "access") return day.access >= t.min;
  if (t.kind === "reach")
    return (
      DISTRICT_IDS.filter((d) => d !== t.district && reachable(s, t.window, d, t.district))
        .length >= t.min
    );
  return false;
}

const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 100);

function runDay(s) {
  const dayWind = s.wind[s.day - 1];
  if (s.offer) answerOffer(s, false);
  const windows = WINDOWS.map((w) => runWindow(s, w, dayWind));
  const fragBefore = { ...s.fragility };
  for (const w of windows)
    for (const d of DISTRICT_IDS) {
      const h = w.byHome[d];
      if (!h || !h.demand || s.broken.includes(d)) continue;
      const u = 1 - h.served / h.demand;
      s.fragility[d] = u < 0.25 ? clamp(s.fragility[d] - 3) : clamp(s.fragility[d] + u * 4);
    }
  const sum = (k) => windows.reduce((n, w) => n + w[k], 0);
  const day = {
    day: s.day,
    wind: dayWind,
    coverage: pct(sum("served"), sum("total")),
    access: pct(sum("careAccessible"), sum("careDemand")),
    reliability: clamp(
      100 -
        (sum("trips") ? (sum("transfers") / sum("trips")) * 40 : 0) -
        windows.reduce((n, w) => n + w.overloaded.length, 0) * 2,
    ),
    windows: windows.map((w) => ({
      id: w.id,
      total: Math.round(w.total),
      served: Math.round(w.served),
      overloaded: w.overloaded,
      load: w.load,
      cap: w.cap,
    })),
  };
  const agreements = [];
  let bonus = 0;
  for (const a of s.agreements) {
    if (a.done || a.due !== s.day) continue;
    const def = AGR[a.id];
    a.done = true;
    a.kept = testAgreement(s, def, day);
    if (a.kept) {
      bonus += KEPT_BONUS;
      s.fragility[def.district] = clamp(s.fragility[def.district] - 20);
    } else s.fragility[def.district] = clamp(s.fragility[def.district] + 30);
    agreements.push({ id: a.id, kept: a.kept });
  }
  const newlyBroken = DISTRICT_IDS.filter(
    (d) => !s.broken.includes(d) && s.fragility[d] >= BREAK_AT,
  );
  s.broken.push(...newlyBroken);
  for (const k of ["served", "transfers", "trips"]) s.totals[k] += sum(k);
  s.totals.demand += sum("total");
  s.totals.careDemand += sum("careDemand");
  s.totals.careAccessible += sum("careAccessible");
  const fragility = Math.round(
    DISTRICT_IDS.reduce((n, d) => n + s.fragility[d], 0) / DISTRICT_IDS.length,
  );
  return {
    ...day,
    fragility,
    fragBefore,
    fragAfter: { ...s.fragility },
    agreements,
    newlyBroken,
    bonus,
    pointsNext: DAILY_POINTS + bonus,
  };
}

/** The exact result of running today with the current network. Never mutates `s`. */
export function previewDay(s) {
  if (s.phase !== "plan") return null;
  return runDay(clone(s));
}

export function runToday(s) {
  if (s.phase !== "plan" || s.ended) return null;
  const r = runDay(s);
  s.report = r;
  s.history.push({
    day: r.day,
    coverage: r.coverage,
    access: r.access,
    reliability: r.reliability,
    fragility: r.fragility,
    agreements: r.agreements,
    newlyBroken: r.newlyBroken,
  });
  s.phase = "report";
  return r;
}

export function nextDay(s) {
  if (s.phase !== "report") return false;
  if (s.day >= DAYS || s.broken.length >= MAX_BROKEN) {
    s.ended = true;
    s.phase = "end";
    return true;
  }
  s.points += s.report.pointsNext;
  s.day++;
  s.phase = "plan";
  s.report = null;
  openOffer(s);
  return true;
}

export function summary(s) {
  const t = s.totals;
  return {
    coverage: pct(t.served, t.demand),
    access: pct(t.careAccessible, t.careDemand),
    reliability: s.history.length
      ? Math.round(s.history.reduce((n, h) => n + h.reliability, 0) / s.history.length)
      : 100,
    fragility: Math.round(
      DISTRICT_IDS.reduce((n, d) => n + s.fragility[d], 0) / DISTRICT_IDS.length,
    ),
    broken: s.broken.length,
    finalCoverage: s.history.length ? s.history[s.history.length - 1].coverage : 0,
    finalAccess: s.history.length ? s.history[s.history.length - 1].access : 0,
    kept: s.agreements.filter((a) => a.kept === true).length,
    brokenPromises: s.agreements.filter((a) => a.kept === false).length,
  };
}

export function verdict(s) {
  const m = summary(s);
  if (m.broken === 0 && m.finalCoverage >= 85 && m.finalAccess >= 80 && m.brokenPromises <= 1)
    return {
      id: "rhythm",
      tr: [
        "Kent ritmini buldu",
        "Sabah da gece de şehir birbirine ulaşıyor. Mahalleler sözlerine güveniyor.",
      ],
      en: [
        "The city found its rhythm",
        "Morning and night, the city reaches itself. Districts trust your word.",
      ],
    };
  if (m.broken === 0 && m.finalCoverage >= 65)
    return {
      id: "strained",
      tr: [
        "Akıyor ama yoruluyor",
        "Ağ çalışıyor; ama bazı saatler ve bazı yokuşlar hâlâ geride kalıyor.",
      ],
      en: [
        "Flowing but strained",
        "The network works, but some hours and some slopes are still left behind.",
      ],
    };
  if (m.broken > 0)
    return {
      id: "cut",
      tr: [
        "Kopan mahalleler",
        "Bazı mahalleler ağdan umudunu kesti. Kıyı bir bütün olarak işlemiyor.",
      ],
      en: [
        "Districts cut off",
        "Some districts gave up on the network. The bay no longer works as one city.",
      ],
    };
  return {
    id: "still",
    tr: ["Durgun kıyı", "Hatlar var ama şehir hâlâ kendi kıyısında bekliyor."],
    en: ["A still shore", "There are lines, but the city still waits on its own shore."],
  };
}

export function normalize(raw) {
  if (!raw || typeof raw !== "object" || raw.v !== VERSION) return null;
  const s = createGame({ seed: Number(raw.seed) || 1 });
  s.day = Math.min(DAYS, Math.max(1, Math.round(Number(raw.day) || 1)));
  s.phase = ["plan", "report", "end"].includes(raw.phase) ? raw.phase : "plan";
  s.points = Math.max(0, Math.min(60, Math.round(Number(raw.points) || 0)));
  s.links = {};
  if (raw.links && typeof raw.links === "object")
    for (const [k, l] of Object.entries(raw.links)) {
      if (!CORR[k] || !l || !CORR[k].modes.includes(l.mode)) continue;
      s.links[k] = {
        mode: l.mode,
        freq: Math.min(MAX_FREQ, Math.max(1, Math.round(l.freq) || 1)),
        night: l.night === true && l.mode !== "bridge",
        ramp: l.ramp === true && l.mode === "bridge",
        day: Math.round(l.day) || 1,
      };
    }
  if (raw.fragility)
    for (const d of DISTRICT_IDS)
      if (Number.isFinite(raw.fragility[d])) s.fragility[d] = clamp(raw.fragility[d]);
  s.broken = Array.isArray(raw.broken) ? [...new Set(raw.broken.filter((d) => DISTRICTS[d]))] : [];
  s.offer = AGR[raw.offer] ? raw.offer : null;
  s.agreements = Array.isArray(raw.agreements)
    ? raw.agreements
        .filter((a) => a && AGR[a.id] && Number.isFinite(a.due))
        .map((a) => ({
          id: a.id,
          due: a.due,
          done: a.done === true,
          kept: typeof a.kept === "boolean" ? a.kept : null,
        }))
    : [];
  if (raw.totals)
    for (const k of Object.keys(s.totals))
      if (Number.isFinite(raw.totals[k])) s.totals[k] = raw.totals[k];
  s.history = Array.isArray(raw.history) ? raw.history.slice(-DAYS) : [];
  s.report = raw.report && typeof raw.report === "object" ? raw.report : null;
  if (s.phase === "report" && !s.report) s.phase = "plan";
  s.ended = s.phase === "end";
  if (raw.ui && typeof raw.ui === "object") s.ui = { ...s.ui, ...raw.ui };
  return s;
}

export { NEEDS };
