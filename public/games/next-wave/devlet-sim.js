/**
 * DEVLET simulation kernel — period starts, monthly tick, signature systems.
 * Player = state organism. Intent ≠ field result.
 */
import {
  PERIODS,
  POLICIES,
  EVENTS,
  COHORTS,
  REGIONS,
  NETWORKS,
  DOCTRINES,
  ALT_PRESETS,
  PERIOD_BANDS,
  DNA_AXES,
  DEBT_DOMAINS,
  FOREIGN_AXES,
  GRAND_HOOKS,
  GUNUMUZ_BASELINE,
} from "./devlet-data.js";
import {
  ensureDevletDepth,
  schedulePolicyDepth,
  tickDevletDepth,
} from "./devlet-depth.js";
import { overlayCadres, processDevletContentMonth } from "./devlet-content.js";

export { DOCTRINES, ALT_PRESETS, DNA_AXES, GRAND_HOOKS, GUNUMUZ_BASELINE, PERIOD_BANDS };
export { ensureDevletDepth, previewPolicy, validateDevletDepth } from "./devlet-depth.js";

export const clamp = (n, a = 0, b = 100) => Math.max(a, Math.min(b, n));

export function implementationRate(s) {
  const inst = s.institutions || [];
  const capacity = inst.reduce((a, x) => a + (x.capacity || 0) + (x.professionalism || 50) - (x.fatigue || 0), 0) / Math.max(1, inst.length * 2);
  const entropy = s.entropy || 0;
  const heat = s.heat || 0;
  const instDna = s.dna?.institutionalism || 50;
  const info = s.infoQuality || 50;
  return clamp(capacity - entropy * 0.1 - heat * 0.08 + (instDna - 50) * 0.12 + (info - 50) * 0.08, 0, 100);
}

function eraOfYear(year) {
  const band = PERIOD_BANDS.find((b) => year >= b.from && year <= b.to);
  return band ? band.era : year < 1923 ? "1923" : "gunumuz";
}

function policiesOf(eraId) {
  return POLICIES[eraId] || POLICIES["2002"];
}

function eventsOf(eraId) {
  return EVENTS[eraId] || [];
}

function defaultForeign() {
  const o = {};
  for (const k of FOREIGN_AXES) o[k] = 50;
  return o;
}

function defaultDebt() {
  const o = {};
  for (const k of DEBT_DOMAINS) o[k] = 20;
  return o;
}

export function hydrateDevlet(eraId, opts = {}) {
  const era = PERIODS[eraId] || PERIODS["2002"];
  const start = era.start || { year: 2002, month: 1 };
  const campaign = !!opts.campaign;
  const doctrine = DOCTRINES.find((d) => d.id === opts.doctrine) || null;
  const alt = ALT_PRESETS.find((a) => a.id === opts.alt) || null;
  const dna = { ...era.dna };
  if (doctrine) {
    for (const [k, v] of Object.entries(doctrine.prefer)) {
      if (k in dna) dna[k] = clamp(dna[k] + v);
    }
  }
  if (alt?.dna) {
    for (const [k, v] of Object.entries(alt.dna)) dna[k] = clamp(v);
  }
  const economy = { ...era.economy, ...(alt?.economy || {}) };
  const state = {
    meta: { version: 2, id: "tc-sim-devlet", seed: Number.isInteger(opts.seed) ? opts.seed : 12345 },
    time: { year: start.year, month: start.month, turn: 1 },
    scenario: {
      id: campaign ? "1923-2030" : era.id === "2002" ? "2002-2005" : era.id,
      campaign,
      doctrine: doctrine?.id || null,
      doctrineName: doctrine?.name || null,
      alt: alt?.id || null,
    },
    eraId: era.id,
    actual: {
      inflation: economy.inflation,
      treasury: economy.treasury,
      unemployment: economy.unemployment,
      fx: economy.fx,
      debt: economy.debt,
      industry: economy.industry,
      agri: economy.agri,
      energy: economy.energy,
      externalDep: economy.externalDep,
    },
    reported: {
      inflation: economy.inflation,
      treasury: economy.treasury,
      unemployment: economy.unemployment,
    },
    known: {
      inflation: { confidence: era.infoQuality / 100 },
      treasury: { confidence: era.infoQuality / 100 },
      unemployment: { confidence: Math.max(0.3, era.infoQuality / 140) },
    },
    institutions: era.institutions.map((x) => ({ ...x })),
    characters: [],
    appointments: [],
    generations: [{ id: "g0", year: start.year, note: "açılış kohortu" }],
    cohorts: COHORTS.map((c) => ({ ...c, mood: 52 - Math.round(era.heat / 8), trust: 50 })),
    regions: REGIONS.map((r) => ({
      id: r.id,
      name: r.name,
      impl: Math.round(50 * r.implMod),
      heat: era.heat,
    })),
    networks: NETWORKS.map((n) => ({ ...n })),
    foreign: { ...defaultForeign(), ...(alt?.foreign || {}) },
    events: [],
    periodPacks: Object.keys(PERIODS),
    grand: {
      ...GRAND_HOOKS,
      active: campaign,
      endYear: campaign ? 2030 : era.id === "2002" ? 2005 : start.year + 8,
    },
    dna,
    reflexes: era.reflexes.slice(),
    form: alt?.form || era.form,
    kimDevlet: { center: dna.centralization, networks: 30, street: era.heat, capital: dna.market },
    entropy: era.entropy,
    infoQuality: era.infoQuality,
    nervous: { channels: era.channels.slice(), lag: Math.round((100 - era.infoQuality) / 12) },
    policyDebt: defaultDebt(),
    path: [],
    memoryState: [],
    memoryPublic: [],
    butterflies: [],
    attraction: 70,
    ghosts: [],
    files: [],
    media: [
      { id: "official", reach: 60, trust: era.infoQuality, tone: "resmi" },
      { id: "street", reach: 40, trust: 35, tone: "söylenti" },
    ],
    rumor: 20,
    heat: era.heat,
    procurement: { quality: 50, delay: 20, graftRisk: 18 },
    openCases: [],
    archive: [],
    yearDigest: [],
    implementationLog: [],
    flags: {
      baseline: era.id === "gunumuz" ? GUNUMUZ_BASELINE : null,
      decisionsRemaining: 2,
      governanceCapacity: 8,
      governanceUsed: 0,
      bureaucraticFriction: 0,
      decisionIds: [],
      pendingPolicies: [],
    },
    history: [],
    ui: { screen: "Durum", flavor: era.flavor },
  };
  ensureDevletDepth(state);
  overlayCadres(state);
  processDevletContentMonth(state);
  return state;
}

function pushBounded(arr, row, cap) {
  arr.push(row);
  if (arr.length > cap) arr.splice(0, arr.length - cap);
}

function applyDnaDelta(s, delta) {
  if (!delta) return;
  s.dna = s.dna || {};
  for (const [k, v] of Object.entries(delta)) {
    if (k === "entropy") {
      s.entropy = clamp((s.entropy || 40) + v);
      continue;
    }
    if (DNA_AXES.includes(k)) s.dna[k] = clamp((s.dna[k] || 50) + v);
  }
}

/**
 * Opens this month's decision budget once. Policies, regional priority and
 * diplomatic initiatives all draw on the same governance capacity.
 */
export function beginDecisionMonth(s) {
  const stamp = s.time.year + "-" + s.time.month;
  if (s.flags.decisionMonth !== stamp) {
    s.flags.decisionMonth = stamp;
    s.flags.decisionsRemaining = 2;
    s.flags.governanceCapacity = Math.max(5, Math.round(implementationRate(s) / 15) + 2);
    s.flags.governanceUsed = 0;
    s.flags.bureaucraticFriction = Math.max(0, Math.round((s.flags.bureaucraticFriction || 0) * 0.45));
    s.flags.decisionIds = [];
    s.flags.pendingPolicies = [];
  }
  return stamp;
}

export function applyPolicy(s, policyId) {
  ensureDevletDepth(s);
  const stamp = beginDecisionMonth(s);
  const pool = policiesOf(s.eraId);
  const p = pool.find((x) => x.id === policyId) || pool[0];
  if (!p) return s;
  if ((s.flags.decisionIds || []).includes(p.id)) return s;
  const capacity = s.flags.governanceCapacity || 8;
  const crisisLoad = (s.heat || 0) >= 70 ? 1 : 0;
  const capacityCost = Math.max(1, Math.ceil((p.capacityNeed || 30) / 30) + crisisLoad);
  if ((s.flags.governanceUsed || 0) + capacityCost > capacity) return s;
  s.flags.policyMonth = stamp;
  const inst = s.institutions.find((i) => i.id === p.inst);
  const cap = inst ? inst.capacity : 50;
  const rate = clamp((cap / Math.max(30, p.capacityNeed)) * 70 - (s.entropy || 0) * 0.1);
  s.appointments.push({
    id: "policy_" + s.time.turn,
    kind: p.id === pool[0].id ? "stability" : p.id,
    institution: p.inst,
    rate,
  });
  if (s.appointments.length > 40) s.appointments.splice(0, s.appointments.length - 40);
  pushBounded(s.implementationLog, { turn: s.time.turn, policy: p.id, rate }, 48);
  s.flags.pendingPolicy = { id: p.id, rate, inflation: p.inflation, cost: p.cost, trust: p.trust };
  s.flags.pendingPolicies = (s.flags.pendingPolicies || []).concat(s.flags.pendingPolicy);
  s.flags.decisionIds = (s.flags.decisionIds || []).concat(p.id);
  s.flags.decisionsRemaining = Math.max(0, (s.flags.decisionsRemaining ?? 2) - 1);
  s.flags.governanceUsed = (s.flags.governanceUsed || 0) + capacityCost;
  s.flags.bureaucraticFriction = clamp((s.flags.bureaucraticFriction || 0) + capacityCost * 7 + crisisLoad * 4);
  if (inst) inst.fatigue = clamp((inst.fatigue || 0) + capacityCost * 3);
  applyDnaDelta(s, p.dna);
  const domain =
    p.inst === "belediye"
      ? "housing"
      : p.inst === "maarif"
        ? "education"
        : p.inst === "maliye"
          ? "infra"
          : "legal";
  if (p.cost >= 8) s.policyDebt[domain] = clamp((s.policyDebt[domain] || 20) - 4);
  else if (p.id.includes("relief") || p.id.includes("rahat"))
    s.policyDebt.housing = clamp((s.policyDebt.housing || 20) + 3);
  pushBounded(s.path, { turn: s.time.turn, policy: p.id, era: s.eraId }, 36);
  pushBounded(s.butterflies, { turn: s.time.turn, from: p.id, text: p.intent }, 24);
  pushBounded(s.history, { type: "policy", turn: s.time.turn, policy: p.id }, 80);
  schedulePolicyDepth(s, p);
  return s;
}

function pickEvent(s) {
  const list = eventsOf(s.eraId);
  if (!list.length) return null;
  const exact = list.filter(
    (e) => (e.year ? e.year === s.time.year : true) && e.month === s.time.month,
  );
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) {
    const seen = new Set((s.events || []).map((x) => x.id));
    const fresh = exact.find((e) => !seen.has(e.id));
    if (fresh) return fresh;
    if ((s.actual?.inflation || 0) > 20) return exact.find((e) => e.domain === "prices") || exact[0];
    if ((s.heat || 0) > 55) return exact.find((e) => e.domain === "heat" || e.domain === "admin") || exact[0];
    return exact[s.time.turn % exact.length];
  }
  const seen = new Set((s.events || []).map((x) => x.id));
  const unused = list.filter((e) => !seen.has(e.id));
  if ((s.actual?.inflation || 0) > 18 || (s.heat || 0) > 60 || s.time.month % 3 === 0) {
    const pool = unused.length ? unused : list;
    if ((s.actual?.inflation || 0) > 18) {
      const priced = pool.find((e) => e.domain === "prices" || e.domain === "fiscal");
      if (priced) return priced;
    }
    return pool[s.time.turn % pool.length];
  }
  if (s.time.month % 4 === 0) return list[s.time.turn % list.length];
  return null;
}

function maybeTransition(s) {
  if (!s.scenario?.campaign) return;
  const next = eraOfYear(s.time.year);
  if (next !== s.eraId && PERIODS[next]) {
    const era = PERIODS[next];
    s.eraId = next;
    s.ui.flavor = era.flavor;
    s.nervous.channels = era.channels.slice();
    for (const inst of era.institutions) {
      const cur = s.institutions.find((i) => i.id === inst.id);
      if (cur) {
        cur.capacity = clamp(Math.round(cur.capacity * 0.7 + inst.capacity * 0.3));
        cur.name = inst.name;
      } else s.institutions.push({ ...inst });
    }
    s.ghosts.push({
      year: s.time.year,
      from: "transition",
      text: era.name + " bandına geçildi. Eski kadro alışkanlığı duruyor.",
    });
    if (s.ghosts.length > 16) s.ghosts.splice(0, s.ghosts.length - 16);
    pushBounded(s.history, { type: "period-transition", era: next, year: s.time.year }, 80);
  }
}

export function tickDevlet(s) {
  ensureDevletDepth(s);
  // A finished run is terminal. Without this the 2002–2005 slice (and every
  // other era horizon) kept ticking forever — 600 advances put the "2002-2005"
  // scenario in 2052 — and the campaign-end report could never settle.
  if (s.flags?.campaignEnd) return s;
  s.time.month += 1;
  if (s.time.month > 12) {
    s.time.month = 1;
    s.time.year += 1;
    pushBounded(
      s.yearDigest,
      {
        year: s.time.year - 1,
        inflation: Math.round(s.actual.inflation),
        heat: s.heat,
        entropy: s.entropy,
        form: s.form,
        era: s.eraId,
      },
      120,
    );
    if (s.time.year % 25 === 0) {
      pushBounded(
        s.generations,
        { id: "g" + s.generations.length, year: s.time.year, note: "nesil kaydı" },
        8,
      );
    }
  }
  s.time.turn += 1;
  const rate = implementationRate(s) / 100;
  const pendingList = s.flags.pendingPolicies?.length
    ? s.flags.pendingPolicies
    : s.flags.pendingPolicy
      ? [s.flags.pendingPolicy]
      : [];
  const pending = pendingList.length
    ? {
        rate: pendingList.reduce((sum, item) => sum + item.rate, 0) / pendingList.length,
        cost: pendingList.reduce((sum, item) => sum + item.cost, 0),
        trust: pendingList.reduce((sum, item) => sum + (item.trust || 0), 0),
      }
    : null;
  const boost = pending ? pending.rate / 100 : 0;
  s.actual.inflation = clamp(
    s.actual.inflation * (1 - rate * 0.06 - boost * 0.02) + (s.heat - 40) * 0.01,
    0,
    220,
  );
  s.actual.unemployment = clamp(
    (s.actual.unemployment || 10) + (pending && pending.cost > 8 ? -0.05 : 0.02) - rate * 0.04,
    0,
    40,
  );
  s.actual.treasury = clamp(
    (s.actual.treasury || 50) - (pending ? pending.cost : 1) + rate * 3,
    0,
    220,
  );
  if (pending) {
    s.flags.pendingPolicy = null;
    s.flags.pendingPolicies = [];
  }
  const lag = s.nervous?.lag || 1;
  const optimism = 0.88 + rate * 0.18 - (100 - (s.infoQuality || 50)) / 400;
  s.reported.inflation = Math.round(s.actual.inflation * optimism);
  s.reported.treasury = Math.round(s.actual.treasury * (0.94 + rate * 0.05));
  s.reported.unemployment = Math.round(
    (s.actual.unemployment || 10) * (0.9 + (s.infoQuality || 50) / 500),
  );
  // All three reporting channels age, not just inflation. Treasury and
  // unemployment confidence used to stay frozen at their hydrate values for the
  // whole run, so two thirds of the "known" layer was inert.
  const settle = (prev, floor, gain) =>
    Math.max(floor, Math.min(1, (prev || floor) + gain - lag * 0.002 - (s.rumor || 0) * 0.0004));
  s.known.inflation = { confidence: settle(s.known.inflation?.confidence, 0.2, 0.02) };
  s.known.treasury = { confidence: settle(s.known.treasury?.confidence, 0.2, 0.015) };
  s.known.unemployment = { confidence: settle(s.known.unemployment?.confidence, 0.15, 0.01) };
  const policyHistory = s.devletDepth?.policy?.history || [];
  const recentPolicies = policyHistory.filter((row) => row.turn >= s.time.turn - 1);
  const stabilizationWindow = policyHistory.filter((row) => row.turn > s.time.turn - 12);
  const reversals = recentPolicies.filter((row) => row.reversal).length;
  const poor = recentPolicies.filter((row) => row.rate < 35).length;
  const overload = recentPolicies.length > 1 ? recentPolicies.length - 1 : 0;
  const churn = recentPolicies.filter((row) => /^cadre-/.test(row.id)).length;
  const inactivityPressure = recentPolicies.length === 0 && ((s.heat || 0) > 55 || (s.actual.inflation || 0) > 18 || (s.actual.unemployment || 0) > 14) ? .015 : 0;
  const competentRelief = recentPolicies.length && poor === 0 && overload === 0 && reversals === 0 ? .04 : 0;
  const windowRate = stabilizationWindow.reduce((sum, row) => sum + Math.max(0, row.rate || 0), 0) / Math.max(1, stabilizationWindow.length);
  const coherentCadence = stabilizationWindow.length >= 1 && stabilizationWindow.length <= 4 &&
    !stabilizationWindow.some((row) => row.reversal) && windowRate >= 35;
  const depth = s.devletDepth;
  const institutionalBase = depth ? (depth.confidence.institutional + depth.cadres.reduce((sum, c) => sum + c.competence + c.professionalism, 0) / Math.max(1, depth.cadres.length * 2)) / 2 : 0;
  // Stabilisation is a recovery channel, not a permanent efficiency bonus:
  // it fades once entropy is back in the governable band. This prevents the
  // repair route from becoming an all-axis dominant meta at low entropy.
  const recoveryNeed = clamp(((s.entropy || 40) - 50) / 35, 0, 1);
  const structuralRecovery = coherentCadence
    ? (.045 + windowRate * .00045 + institutionalBase * .00035) * recoveryNeed
    : 0;
  const institutionRepair = coherentCadence && stabilizationWindow.some((row) => ["institutions", "education"].includes(row.domain)) ? .018 * recoveryNeed : 0;
  s.entropy = clamp((s.entropy || 40) + inactivityPressure + overload * .04 + reversals * .07 + poor * .04 + churn * .025 - competentRelief - structuralRecovery - institutionRepair);
  s.heat = clamp(
    (s.heat || 40) +
      ((s.actual.unemployment || 10) - 8) * 0.05 +
      (s.actual.inflation > 40 ? 0.2 : -0.05) -
      (pending?.trust || 0) * 0.05,
  );
  s.rumor = clamp((s.rumor || 20) + (s.infoQuality < 45 ? 0.3 : -0.1));
  s.infoQuality = clamp(
    (s.infoQuality || 50) + (s.dna?.institutionalism - 50) * 0.01 - s.rumor * 0.01,
  );
  const formScore = {
    security: s.dna.security,
    bureau: s.dna.institutionalism,
    capital: s.dna.market,
    street: s.heat,
  };
  const top = Object.entries(formScore).sort((a, b) => b[1] - a[1])[0][0];
  s.form =
    top === "security" && s.dna.security > 70
      ? "Kışla-Devlet"
      : top === "capital" && s.dna.market > 65
        ? "Sermaye-Devlet"
        : s.heat > 70
          ? "Popülist-Devlet"
          : s.entropy > 70
            ? "Boş Kabuk"
            : "Bürokrasi-Devlet";
  s.kimDevlet = {
    center: s.dna.centralization,
    networks: s.networks.reduce((a, n) => a + n.pressure, 0) / Math.max(1, s.networks.length),
    street: s.heat,
    capital: s.dna.market,
  };
  for (const d of DEBT_DOMAINS) {
    if (s.time.month === 1) s.policyDebt[d] = clamp((s.policyDebt[d] || 20) + 0.4);
  }
  const ev = pickEvent(s);
  if (ev) {
    pushBounded(
      s.events,
      { id: ev.id, title: ev.title, year: s.time.year, month: s.time.month },
      36,
    );
    if (ev.domain === "prices") s.reported.inflation = Math.max(0, s.reported.inflation - 2);
    if (ev.domain === "labor")
      s.actual.unemployment = clamp((s.actual.unemployment || 10) + 0.3, 0, 40);
    if (ev.domain === "heat") s.heat = clamp(s.heat + 4);
    if (ev.domain === "info") s.infoQuality = clamp(s.infoQuality - 3);
    if (ev.contested)
      pushBounded(s.files, { id: ev.id, status: "open", year: s.time.year, contested: true }, 20);
    else if (s.time.turn % 18 === 0)
      pushBounded(s.files, { id: "f" + s.time.turn, status: "sleeping", year: s.time.year }, 20);
    pushBounded(s.memoryState, { year: s.time.year, text: ev.title, voice: "resmi" }, 24);
    pushBounded(
      s.memoryPublic,
      { year: s.time.year, text: ev.voices?.halk || ev.text, voice: "halk" },
      24,
    );
    pushBounded(
      s.archive,
      {
        year: s.time.year,
        month: s.time.month,
        rate,
        event: ev.id,
        provenance: ev.provenance,
        contested: !!ev.contested,
      },
      36,
    );
  } else {
    pushBounded(s.archive, { year: s.time.year, month: s.time.month, rate }, 36);
  }
  if (s.files.some((f) => f.status === "sleeping") && s.time.month === 6) {
    const f = s.files.find((x) => x.status === "sleeping");
    if (f) {
      f.status = "reopened";
      pushBounded(s.history, { type: "file-return", id: f.id, year: s.time.year }, 80);
    }
  }
  s.attraction = clamp(
    70 - Math.abs(s.time.year - (PERIODS[s.eraId]?.start?.year || s.time.year)) * 0.15,
  );
  s.flags.decisionMonth = s.time.year + "-" + s.time.month;
  s.flags.decisionsRemaining = 2;
  s.flags.governanceCapacity = Math.max(5, Math.round(implementationRate(s) / 15) + 2);
  s.flags.governanceUsed = 0;
  s.flags.bureaucraticFriction = Math.max(0, Math.round((s.flags.bureaucraticFriction || 0) * 0.45));
  s.flags.decisionIds = [];
  tickDevletDepth(s);
  maybeTransition(s);
  // A period transition can add an institution (istikhbarat in 2002). It arrives
  // as a raw catalog row with no fatigue/budget/leadership/alignment/trust/memory
  // and no cadre, so for that turn institution health was NaN — clamped to 0 by
  // implementationAverage, which feeds crisis resilience and the bureaucracy
  // group — and the missing cadre left its policies on the flat cadreFit
  // fallback for the rest of the campaign.
  ensureDevletDepth(s);
  overlayCadres(s);
  processDevletContentMonth(s);
  const endYear = s.grand?.endYear || 2005;
  if (s.time.year > endYear || (s.time.year === endYear && s.time.month >= 12)) {
    s.flags.campaignEnd = true;
  }
  // The monthly heartbeat deliberately does NOT go into `history`. It used to,
  // and with an 80-row cap a 1284-month campaign evicted every meaningful record
  // (period transitions, policies, reopened files, doctrine) within ~6 years —
  // the campaign's whole institutional record was heartbeat noise. `archive`
  // already carries per-month rows and `yearDigest` the per-year summary.
  s.openCases = (s.openCases || []).slice(-24);
  return s;
}

export function tickDevletN(s, n) {
  const cap = Math.max(0, n | 0);
  for (let i = 0; i < cap; i += 1) {
    // Stop at the run's own horizon instead of clearing the end flag every
    // iteration; clearing it meant no scenario ever actually ended.
    if (s.flags.campaignEnd) break;
    tickDevlet(s);
  }
  return s;
}

export function applyAlt(s, altId) {
  const alt = ALT_PRESETS.find((a) => a.id === altId);
  if (!alt) return s;
  s.scenario.alt = alt.id;
  if (alt.form) s.form = alt.form;
  if (alt.dna)
    applyDnaDelta(
      s,
      Object.fromEntries(Object.entries(alt.dna).map(([k, v]) => [k, v - (s.dna[k] || 50)])),
    );
  if (alt.foreign) s.foreign = { ...s.foreign, ...alt.foreign };
  if (alt.economy) {
    for (const [k, v] of Object.entries(alt.economy)) s.actual[k] = v;
  }
  pushBounded(s.history, { type: "alt", id: alt.id }, 80);
  return s;
}

export function applyDoctrine(s, doctrineId) {
  const d = DOCTRINES.find((x) => x.id === doctrineId);
  if (!d) return s;
  s.scenario.doctrine = d.id;
  s.scenario.doctrineName = d.name;
  applyDnaDelta(s, d.prefer);
  pushBounded(s.history, { type: "doctrine", id: d.id }, 80);
  return s;
}

export function finiteState(s) {
  const walk = (v) => {
    if (typeof v === "number") return Number.isFinite(v);
    if (!v || typeof v !== "object") return true;
    if (Array.isArray(v)) return v.every(walk);
    return Object.values(v).every(walk);
  };
  return walk(s);
}
