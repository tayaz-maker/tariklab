// Apartment community prototype: pure rules. No DOM, no randomness outside the seed.
// Preview and commit run the same function on a copy, so what the player sees
// before committing is exactly what happens.
import { APPROACHES, HOUSEHOLDS, ISSUES, SYSTEM_IDS, TIES } from "./data.js";

export const VERSION = 1;
export const ATTENTION = 3;
export const PERIOD_COUNT = 3;
export const ISSUES_PER_PERIOD = 4;
export const BASE_DUES = 1800;
export const RUNNING_COST = 10000;
export const TOGETHER_MIN_SOLIDARITY = 45;
export const ECHO_SHARE = 0.4;
export const INCIDENT_BELOW = 30;

const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(v)));
const byId = Object.fromEntries(ISSUES.map((i) => [i.id, i]));
const clone = (v) => JSON.parse(JSON.stringify(v));

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

export const DEFAULT_PLAN = ["structure", "water", "power"];

export function createGame({ seed = 1, plan = DEFAULT_PLAN } = {}) {
  const s = {
    v: VERSION,
    seed: seed >>> 0,
    period: 1,
    phase: "decide",
    cash: 30000,
    duesRate: 1,
    solidarity: 46,
    systems: {
      water: { cond: 62, debt: 18 },
      power: { cond: 58, debt: 22 },
      security: { cond: 66, debt: 12 },
      structure: { cond: 54, debt: 26 },
    },
    households: HOUSEHOLDS.map((h) => ({ id: h.id, trust: h.trust, tolerance: h.tolerance })),
    plan: validPlan(plan) ? [...plan] : [...DEFAULT_PLAN],
    planRevised: false,
    memory: {},
    issues: [],
    choices: {},
    dues: "keep",
    report: null,
    history: [],
    ended: false,
    ui: { layer: "trust", selected: null, tab: "queue" },
  };
  s.issues = drawIssues(s);
  return s;
}

function validPlan(plan) {
  return (
    Array.isArray(plan) && plan.length === PERIOD_COUNT && plan.every((p) => SYSTEM_IDS.includes(p))
  );
}

/** Households a problem touches. */
export function affected(issue) {
  const w = issue.who || {};
  return HOUSEHOLDS.filter((h) =>
    w.all
      ? true
      : w.wing
        ? h.wing === w.wing
        : w.floor != null
          ? h.floor === w.floor
          : w.floorMin != null
            ? h.floor >= w.floorMin
            : false,
  ).map((h) => h.id);
}

export function neighbours(id) {
  return TIES.filter((t) => t.includes(id)).map((t) => (t[0] === id ? t[1] : t[0]));
}

const hh = (s, id) => s.households.find((h) => h.id === id);

/** How many times a problem has come back after a patch or deferral. */
export function returns(s, issueId) {
  const m = s.memory[issueId];
  return m ? (m.patched || 0) + (m.deferred || 0) : 0;
}

export function issueCost(s, issue, approach) {
  const sev = 1 + 0.25 * returns(s, issue.id);
  const base = issue.cost * sev;
  if (approach === "repair") return Math.round(base);
  if (approach === "patch") return Math.round(base * 0.35);
  if (approach === "together") return Math.round(base * 0.3);
  return 0;
}

export function drawIssues(s) {
  const r = rng(s.seed * 31 + s.period * 977);
  const scored = ISSUES.filter((i) => !(s.memory[i.id] && s.memory[i.id].fixed))
    .map((i) => {
      const sys = s.systems[i.system];
      const eligible = sys.cond <= i.when || returns(s, i.id) > 0;
      return {
        id: i.id,
        system: i.system,
        eligible,
        score: 100 - sys.cond + sys.debt * 0.5 + returns(s, i.id) * 20 + r() * 15,
      };
    })
    .sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.score - a.score);
  const out = [];
  const perSystem = {};
  for (const c of scored) {
    if (out.length >= ISSUES_PER_PERIOD) break;
    if ((perSystem[c.system] || 0) >= 2) continue;
    perSystem[c.system] = (perSystem[c.system] || 0) + 1;
    out.push(c.id);
  }
  return out;
}

export function attentionUsed(s, choices = s.choices) {
  return Object.values(choices).reduce((n, a) => n + (APPROACHES[a]?.attention || 0), 0);
}

export function cashCommitted(s, choices = s.choices) {
  return Object.entries(choices).reduce((n, [id, a]) => n + issueCost(s, byId[id], a), 0);
}

/** Whether `approach` can be picked for `issueId` right now, and why not. */
export function canChoose(s, issueId, approach) {
  if (s.ended || s.phase !== "decide")
    return { ok: false, reason: ["Dönem kapandı", "The period is closed"] };
  if (!s.issues.includes(issueId) || !APPROACHES[approach])
    return { ok: false, reason: ["Geçersiz seçim", "Invalid choice"] };
  if (approach !== "defer" && !byId[issueId].allow.includes(approach))
    return { ok: false, reason: ["Bu iş için uygun değil", "Not suitable for this job"] };
  const next = { ...s.choices, [issueId]: approach };
  if (approach === "defer") delete next[issueId];
  if (attentionUsed(s, next) > ATTENTION)
    return { ok: false, reason: ["Kurul mesaisi yetmiyor", "Not enough board time"] };
  if (cashCommitted(s, next) > s.cash)
    return { ok: false, reason: ["Kasa yetmiyor", "Not enough cash"] };
  if (approach === "together" && s.solidarity < TOGETHER_MIN_SOLIDARITY)
    return {
      ok: false,
      reason: [
        `Dayanışma ${TOGETHER_MIN_SOLIDARITY} altında`,
        `Solidarity below ${TOGETHER_MIN_SOLIDARITY}`,
      ],
    };
  return { ok: true, reason: null };
}

export function choose(s, issueId, approach) {
  if (!canChoose(s, issueId, approach).ok) return false;
  if (approach === "defer") delete s.choices[issueId];
  else s.choices[issueId] = approach;
  return true;
}

export function setDues(s, dues) {
  if (s.phase !== "decide" || !["keep", "raise", "levy"].includes(dues)) return false;
  if (dues === "raise" && s.duesRate > 1) return false;
  s.dues = dues;
  return true;
}

/** Change the promised focus of the current or a later period. Costs trust once per period. */
export function setPlan(s, index, system) {
  if (
    s.phase !== "decide" ||
    index < s.period - 1 ||
    index >= PERIOD_COUNT ||
    !SYSTEM_IDS.includes(system)
  )
    return false;
  if (s.plan[index] === system) return true;
  s.plan[index] = system;
  s.planRevised = true;
  return true;
}

function payRate(trust) {
  return trust < 30 ? 0.7 : trust < 50 ? 0.85 : 1;
}

export function avgTrust(s) {
  return Math.round(s.households.reduce((n, h) => n + h.trust, 0) / s.households.length);
}
export function totalDebt(s) {
  return SYSTEM_IDS.reduce((n, k) => n + s.systems[k].debt, 0);
}
export function metrics(s) {
  return { cash: s.cash, trust: avgTrust(s), debt: totalDebt(s), solidarity: s.solidarity };
}

function applyPeriod(s) {
  const before = metrics(s);
  const sysBefore = clone(s.systems);
  const lines = [];
  const direct = {};
  const bump = (id, d) => {
    if (!d) return;
    direct[id] = (direct[id] || 0) + d;
  };
  const all = (d) => s.households.forEach((h) => (h.trust = clamp(h.trust + d)));
  let spent = 0;

  for (const id of s.issues) {
    const issue = byId[id];
    const approach = s.choices[id] || "defer";
    const sys = s.systems[issue.system];
    const who = affected(issue);
    const cost = issueCost(s, issue, approach);
    const mem = (s.memory[id] ||= { patched: 0, deferred: 0, fixed: false });
    const sev = 1 + 0.25 * returns(s, id);
    spent += cost;
    if (approach === "patch") {
      sys.cond += 8;
      sys.debt += Math.round(issue.debt * 0.5);
      who.forEach((h) => bump(h, 2));
      mem.patched++;
    } else if (approach === "repair") {
      sys.cond += 25;
      sys.debt -= Math.min(sys.debt, 30);
      who.forEach((h) => bump(h, 6));
      const wing = issue.who.wing;
      for (const h of HOUSEHOLDS) {
        if (wing && h.wing !== wing) continue;
        const sensitive = h.tags.includes("night") || h.tags.includes("home");
        const st = hh(s, h.id);
        st.tolerance = clamp(st.tolerance - (sensitive ? 12 : 8));
        if (st.tolerance < 25) bump(h.id, -3);
      }
      mem.fixed = true;
    } else if (approach === "together") {
      sys.cond += 15;
      sys.debt -= Math.min(sys.debt, 12);
      s.solidarity = clamp(s.solidarity + 5);
      const circle = new Set(who.flatMap((h) => [h, ...neighbours(h)]));
      for (const h of HOUSEHOLDS) {
        const st = hh(s, h.id);
        const busy =
          h.tags.includes("night") || h.tags.includes("home") || h.tags.includes("elderly");
        if (busy) {
          st.tolerance = clamp(st.tolerance - 6);
          bump(h.id, -2);
        } else if (circle.has(h.id)) bump(h.id, 4);
      }
      mem.fixed = true;
    } else {
      sys.cond -= issue.decay;
      sys.debt += issue.debt;
      who.forEach((h) => bump(h, -Math.round(5 * sev)));
      mem.deferred++;
    }
    lines.push({ issue: id, approach, cost });
  }
  s.cash -= spent;

  // Social echo: direct experiences travel one step along the ties.
  const echoes = [];
  for (const [id, d] of Object.entries(direct)) {
    hh(s, id).trust = clamp(hh(s, id).trust + d);
    for (const n of neighbours(id)) {
      const e = Math.trunc(d * ECHO_SHARE);
      if (!e) continue;
      hh(s, n).trust = clamp(hh(s, n).trust + e);
      if (Math.abs(d) >= 4) echoes.push({ from: id, to: n, delta: e });
    }
  }

  // Dues.
  let income = 0;
  if (s.dues === "raise") s.duesRate = 1.2;
  for (const h of s.households) income += BASE_DUES * s.duesRate * payRate(h.trust);
  if (s.dues === "raise") {
    all(-3);
    for (const h of HOUSEHOLDS)
      if (h.tags.includes("tight")) hh(s, h.id).trust = clamp(hh(s, h.id).trust - 4);
  } else if (s.dues === "levy") {
    for (const h of s.households) income += 1500 * payRate(h.trust);
    all(-5);
    s.solidarity = clamp(s.solidarity - 4);
  }
  income = Math.round(income);
  s.cash += income - RUNNING_COST;

  // The promise made in the three-period plan.
  const promised = s.plan[s.period - 1];
  const kept = s.issues.some(
    (id) => byId[id].system === promised && ["repair", "together"].includes(s.choices[id]),
  );
  if (kept) all(3);
  else {
    all(-4);
    s.solidarity = clamp(s.solidarity - 2);
  }
  if (s.planRevised) all(-2);

  // Wear, then failures where a system is left too weak.
  const incidents = [];
  for (const k of SYSTEM_IDS) {
    const sys = s.systems[k];
    sys.cond = clamp(sys.cond - 3);
    sys.debt = clamp(sys.debt + 4, 0, 200);
    if (sys.cond < INCIDENT_BELOW) {
      s.cash -= 8000;
      all(-6);
      sys.debt = clamp(sys.debt + 6, 0, 200);
      incidents.push(k);
    }
  }
  if (s.cash < 0) all(-3);
  s.solidarity = clamp(s.solidarity + Math.round((avgTrust(s) - 50) / 8));

  const report = {
    period: s.period,
    lines,
    spent,
    income,
    running: RUNNING_COST,
    echoes,
    direct,
    promise: { system: promised, kept },
    planRevised: s.planRevised,
    incidents,
    before,
    after: metrics(s),
    systemsBefore: sysBefore,
    systemsAfter: clone(s.systems),
  };
  return report;
}

/** Exactly what committing the current choices would do. Never mutates `s`. */
export function preview(s) {
  if (s.phase !== "decide") return null;
  return applyPeriod(clone(s));
}

export function commit(s) {
  if (s.ended || s.phase !== "decide") return null;
  const report = applyPeriod(s);
  s.report = report;
  s.history.push({
    period: s.period,
    choices: { ...s.choices },
    dues: s.dues,
    promise: report.promise,
    after: report.after,
    incidents: report.incidents,
  });
  s.phase = "outcome";
  return report;
}

export function nextPeriod(s) {
  if (s.phase !== "outcome") return false;
  if (s.period >= PERIOD_COUNT) {
    s.ended = true;
    s.phase = "end";
    return true;
  }
  s.period++;
  s.phase = "decide";
  s.choices = {};
  s.dues = "keep";
  s.planRevised = false;
  s.report = null;
  s.issues = drawIssues(s);
  return true;
}

export function health(s) {
  const cond = SYSTEM_IDS.reduce((n, k) => n + s.systems[k].cond, 0) / SYSTEM_IDS.length;
  return Math.round(cond - totalDebt(s) / 8);
}
export function community(s) {
  return Math.round((avgTrust(s) + s.solidarity) / 2);
}

export function verdict(s) {
  const b = health(s) >= 45,
    c = community(s) >= 52;
  if (b && c)
    return {
      id: "standing",
      tr: ["Ayakta ve birlikte", "Bina sağlam, avlu konuşuyor. Bir sonraki kurul kolay geçecek."],
      en: [
        "Standing, together",
        "The building is sound and the courtyard talks. The next board meeting will be easy.",
      ],
    };
  if (b)
    return {
      id: "sound",
      tr: ["Sağlam bina, kırgın komşular", "Duvarlar ayakta; ama kimse kurula gelmek istemiyor."],
      en: [
        "Sound building, hurt neighbours",
        "The walls stand, but nobody wants to come to the board.",
      ],
    };
  if (c)
    return {
      id: "warm",
      tr: [
        "Sıcak avlu, yorgun bina",
        "İnsanlar birbirine güveniyor; bina bu güveni daha ne kadar taşır, belli değil.",
      ],
      en: [
        "Warm courtyard, tired building",
        "People trust each other; how long the building can carry that is unclear.",
      ],
    };
  return {
    id: "quiet",
    tr: ["Borç ve sessizlik", "Bakım borcu büyüdü, kapılar kapandı. Devralacak kişinin işi zor."],
    en: [
      "Debt and silence",
      "The maintenance debt grew and doors closed. Whoever takes over has a hard job.",
    ],
  };
}

/** Repairs anything a stored save could have wrong; returns null if unusable. */
export function normalize(raw) {
  if (!raw || typeof raw !== "object" || raw.v !== VERSION) return null;
  const s = createGame({ seed: Number(raw.seed) || 1, plan: raw.plan });
  for (const k of ["period", "cash", "duesRate", "solidarity"])
    if (Number.isFinite(raw[k])) s[k] = raw[k];
  s.period = Math.min(PERIOD_COUNT, Math.max(1, Math.round(s.period)));
  s.phase = ["decide", "outcome", "end"].includes(raw.phase) ? raw.phase : "decide";
  s.ended = raw.ended === true || s.phase === "end";
  if (raw.systems)
    for (const k of SYSTEM_IDS)
      if (raw.systems[k])
        s.systems[k] = {
          cond: clamp(raw.systems[k].cond),
          debt: clamp(raw.systems[k].debt, 0, 200),
        };
  if (Array.isArray(raw.households))
    for (const h of s.households) {
      const r = raw.households.find((x) => x && x.id === h.id);
      if (r) {
        h.trust = clamp(r.trust);
        h.tolerance = clamp(r.tolerance);
      }
    }
  s.memory = raw.memory && typeof raw.memory === "object" ? raw.memory : {};
  s.planRevised = raw.planRevised === true;
  s.issues = Array.isArray(raw.issues)
    ? raw.issues.filter((id) => byId[id]).slice(0, ISSUES_PER_PERIOD)
    : drawIssues(s);
  s.choices = {};
  if (raw.choices)
    for (const [id, a] of Object.entries(raw.choices))
      if (s.issues.includes(id) && APPROACHES[a] && byId[id].allow.includes(a)) s.choices[id] = a;
  s.dues = ["keep", "raise", "levy"].includes(raw.dues) ? raw.dues : "keep";
  s.report = raw.report && typeof raw.report === "object" ? raw.report : null;
  if (s.phase === "outcome" && !s.report) s.phase = "decide";
  s.history = Array.isArray(raw.history) ? raw.history.slice(-PERIOD_COUNT) : [];
  if (raw.ui && typeof raw.ui === "object") s.ui = { ...s.ui, ...raw.ui };
  return s;
}
