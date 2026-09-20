export const VERSION = 1;
import "./shared/depth-framework.js";
export const seeds = (n) => {
  let x = n >>> 0;
  return () => (x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 4294967296;
};
export const rng = seeds;
export const clamp = (n, a = 0, b = 100) => Math.max(a, Math.min(b, n));
export const implementationRate = (s) => {
  const inst = s.institutions || [];
  const cap = inst.reduce((a, x) => a + (x.capacity || 0), 0) / Math.max(1, inst.length);
  if (s.dna || s.entropy != null) {
    const entropy = s.entropy || 0;
    const heat = s.heat || 0;
    const instDna = s.dna?.institutionalism || 50;
    const info = s.infoQuality || 50;
    return clamp(cap - entropy * 0.18 - heat * 0.12 + (instDna - 50) * 0.12 + (info - 50) * 0.08);
  }
  return clamp(cap);
};

import {
  SYSTEMS,
  RESIDENTS,
  ISSUES,
  ISSUE_TEMPLATES,
  MEETINGS,
  PROPOSALS,
} from "./next-wave/apartman-data.js";
import {
  tickApartmanChains,
  applyApartmanEventChoice,
  resolveApartmanChainEffect,
  summarizeApartmanRun,
} from "./next-wave/apartman-chains.js";
import {
  SCENARIOS,
  MILESTONES,
  ACTIONS as A100,
  EVENTS as SON_EVENTS,
} from "./next-wave/son100-data.js";
import { applySonAction, sonAdvanceDay, applySonScenario, ensureSonState, validateSonState } from "./next-wave/son100-sim.js";
import { APPS, CONTACTS, DISCOVERABLES, ENDINGS } from "./next-wave/kayip-data.js";
import {
  createPhoneState,
  ensurePhoneState,
  validatePhoneState,
  discoverEvidence,
  linkEvidence,
  togglePin,
  setTheory,
  setDecision,
  finishCase,
  newCaseSeed,
  availableEvidence,
  evidenceNodes,
  evidenceSpec,
  phoneThreads,
  FACTS as PHONE_FACTS,
  THEORIES as PHONE_THEORIES,
  SIDE_SECRETS as PHONE_SIDE_SECRETS,
  DECISIONS as PHONE_DECISIONS,
} from "./next-wave/kayip-deduction.js";
import { PERIODS, POLICIES_2002, POLICIES } from "./next-wave/devlet-data.js";
import {
  hydrateDevlet,
  applyPolicy as devletPolicyApply,
  tickDevlet,
  tickDevletN,
  applyDoctrine,
  finiteState,
  ensureDevletDepth,
  validateDevletDepth,
  DOCTRINES,
  ALT_PRESETS,
  GUNUMUZ_BASELINE,
} from "./next-wave/devlet-sim.js";
import {
  applyContentChoice as devletContentChoice,
  settleDevletContent,
  overlayCadres,
  devletContentBag,
} from "./next-wave/devlet-content.js";

function pushHist(s, row) {
  s.history = (s.history || []).concat(row).slice(-80);
}

function scenarioOf(id) {
  return SCENARIOS.find((x) => x.id === id) || SCENARIOS[0];
}

const defs = {
  apartman: {
    title: "Apartman: Apartman Yöneticisi",
    tag: "Toplantı Gecesi",
    screens: ["Genel", "Sakinler", "Bina", "Aidat/Kasa", "Meseleler", "Toplantı", "Geçmiş"],
    initial: () => ({
      meta: { version: 2, id: "apartman" },
      week: 1,
      building: {
        systems: SYSTEMS.map((x) => x.id),
        condition: 72,
        parts: SYSTEMS.map((x) => ({ id: x.id, name: x.name, condition: x.condition })),
      },
      finance: { cash: 12000, dues: 2400, arrears: 1800 },
      site: { blocks: 2, units: 32, serviceLoad: 1, operationalCapacity: 6 },
      residents: RESIDENTS.slice(0, 14).map((r) => ({
        ...r,
        trust: r.satisfaction,
        income: r.income || (r.owner ? "orta" : "kırılgan"),
        household: r.household || (r.owner ? "hane" : "kiracı hane"),
        interest: r.interest || (r.bloc === "eski" ? "mülk değeri" : r.bloc === "kiraci" ? "ödenebilir aidat" : "düzen"),
        personality: r.personality || (r.influence >= 65 ? "kanaat önderi" : r.pays ? "temkinli" : "itirazcı"),
        memory: [],
        memories: [],
        relations: { ...(r.ties || {}) },
        currentIssue: null,
      })),
      issues: ISSUES.map((i) => ({ ...i })),
      meetings: MEETINGS.map((m) => m.id),
      lastMeeting: null,
      openCases: [],
      history: [],
      delayedEffects: [],
      eventDirector: { history: [], cooldowns: {} },
      politics: { confidence: 58, opposition: [], alliances: [], electionDue: 12, warnings: [] },
      progression: { phase: "yıpranmış bina", investments: 0, path: "kararsız", score: 0 },
      runSummary: null,
      flags: { meeting: false, cheapPatch: 0, cheapCount: 0, duesHikes: 0, financeWeek: 0, lastIssueTemplate: "" },
      ui: { screen: "Genel" },
    }),
  },
  "son-100-gun": {
    title: "Son 100 Gün",
    tag: "Zaman kıtlığı",
    screens: ["Durum", "Yüküm", "Fırsat", "İlişkiler", "Geçmiş"],
    initial: () => {
      const sc = scenarioOf("financial-recovery");
      return ensureSonState({
        meta: { version: 2, id: "son-100-gun", seed: 73129 },
        day: 1,
        remainingDays: 100,
        actionsRemaining: 2,
        focusMax: 8,
        focusRemaining: 8,
        scenarioId: sc.id,
        resources: { ...sc.resources },
        relationships: Object.entries(sc.relations).map(([id, value]) => ({ id, value })),
        obligations: sc.obligations.map((o) => ({ ...o, status: "open" })),
        opportunities: [
          {
            id: SON_EVENTS[0].id,
            title: SON_EVENTS[0].title,
            expiresOn: 1 + (SON_EVENTS[0].window || 3),
            choices: SON_EVENTS[0].choices,
            domain: SON_EVENTS[0].domain,
            status: "open",
          },
        ],
        goalProgress: { money: 0, relationship: 0, health: 0, work: 0 },
        missed: [],
        openCases: [],
        history: [],
        flags: { milestones: [], finalReport: false, workStreak: 0, soul: { ...(sc.soul || {}) } },
        ui: { screen: "Durum" },
      });
    },
  },
  "kayip-telefon": {
    title: "Kayıp Telefon",
    tag: "Keşif · mahremiyet",
    screens: [
      "Mesajlar",
      "Aramalar",
      "Fotoğraflar",
      "Notlar",
      "Takvim",
      "Rehber",
      "Dosyalar",
      "Ses Kayıtları",
    ],
    initial: () => createPhoneState(12345),
  },
  "tc-sim-devlet": {
    title: "TC SIM: DEVLET",
    tag: "Devlet organizması · dönemler",
    screens: ["Durum", "Politika", "Kurumlar", "DNA", "Arşiv", "Dönemler", "Kelebekler", "Geçmiş"],
    initial: () => hydrateDevlet("2002"),
  },
};

export function create(id) {
  const s = defs[id].initial();
  s.meta.seed = 12345;
  if (id === "apartman") {
    ensureApartmanState(s);
    tickApartmanChains(s);
  }
  return s;
}
export function validate(s, id) {
  if (!s || ![1, 2].includes(s.meta?.version)) return false;
  if (!Array.isArray(s.history) || !Array.isArray(s.openCases)) return false;
  // A save only belongs to the game that wrote it. Without this an apartman
  // payload validated cleanly as another game's save and would have been fed
  // to the wrong engine.
  if (id && s.meta?.id !== id) return false;
  return true;
}
export function normalize(id, raw) {
  if (!validate(raw, id)) return raw ? null : create(id);
  if (id === "apartman") ensureApartmanState(raw);
  if (id === "son-100-gun") {
    if (!validateSonState(raw)) return null;
    ensureSonState(raw);
    if (!validateSonState(raw)) return null;
  }
  if (id === "kayip-telefon") {
    if (!validatePhoneState(raw)) return null;
    if (!ensurePhoneState(raw) || !validatePhoneState(raw)) return null;
  }
  if (id === "tc-sim-devlet") {
    // Every other game validates after hydrating. DEVLET only hydrated, so its
    // own validateDevletDepth was dead code and a save carrying NaN/Infinity
    // loaded cleanly: most values were laundered into plausible numbers over the
    // next few turns, and a non-finite taxBurden — which nothing ever writes —
    // stayed poisoned for the rest of the campaign.
    // Reject poisoned nested numbers before hydration can coerce them to a
    // strategic extreme (cap(NaN) is zero). Missing legacy fields may still be
    // hydrated, but a value explicitly present as NaN/Infinity is never a
    // migration signal.
    const finitePayload = (value) => typeof value === "number"
      ? Number.isFinite(value)
      : !value || typeof value !== "object" || Object.values(value).every(finitePayload);
    if (!finitePayload(raw) || !ensureDevletDepth(raw) || !validateDevletDepth(raw)) return null;
    overlayCadres(raw);
    devletContentBag(raw);
  }
  return raw;
}

function ensureApartmanState(s) {
  const D = globalThis.TarikLabDepth;
  s.meta.version = 2;
  s.delayedEffects = Array.isArray(s.delayedEffects) ? s.delayedEffects : [];
  s.eventDirector = s.eventDirector && typeof s.eventDirector === "object" ? s.eventDirector : { history: [], cooldowns: {} };
  s.eventDirector.history = Array.isArray(s.eventDirector.history) ? s.eventDirector.history : [];
  s.eventDirector.cooldowns = s.eventDirector.cooldowns || {};
  s.politics = Object.assign({ confidence: 58, opposition: [], alliances: [], electionDue: Math.max(12, s.week + 4), warnings: [] }, s.politics || {});
  s.progression = Object.assign({ phase: "yıpranmış bina", investments: 0, path: "kararsız", score: 0 }, s.progression || {});
  s.residents = (s.residents || []).map((r) => ({
    ...r,
    memory: Array.isArray(r.memory) ? r.memory : [],
    trust: Number.isFinite(r.trust) ? r.trust : r.satisfaction,
    income: r.income || (r.owner ? "orta" : "kırılgan"),
    household: r.household || (r.owner ? "hane" : "kiracı hane"),
    interest: r.interest || (r.pays ? "istikrar" : "ödenebilir aidat"),
    personality: r.personality || (r.influence >= 65 ? "kanaat önderi" : "temkinli"),
    memories: Array.isArray(r.memories) ? r.memories : (r.memory || []).map((id, i) => ({ id: `legacy-${id}-${i}`, type: id, turn: Math.max(1, s.week - i), weight: 1 })),
    relations: r.relations && typeof r.relations === "object" ? r.relations : {},
    currentIssue: r.currentIssue || null,
  }));
  s.residents.forEach((resident) => {
    s.residents.forEach((other) => {
      if (resident.id === other.id || Number.isFinite(resident.relations[other.id])) return;
      resident.relations[other.id] = resident.bloc === other.bloc ? 25 : [resident.bloc, other.bloc].includes("eski") && [resident.bloc, other.bloc].includes("yeni") ? -15 : 0;
    });
  });
  if (!D) return s;
  s.politics.confidence = D.clamp(s.politics.confidence, 0, 100);
  return s;
}

function apartmanVote(s, proposal) {
  const cheap = proposal.id === "cheap-patch";
  const wait = proposal.id === "wait";
  const hike = proposal.id === "raise-dues";
  let yes = 0;
  let no = 0;
  const ballots = {};
  for (const r of s.residents) {
    let score = (r.satisfaction - 50) / 24 + (r.trust - 50) / 28 + r.influence / 220;
    if (!r.pays) score -= 0.35;
    if (!r.owner) score -= 0.1;
    if (cheap) score += r.satisfaction < 55 ? 0.25 : -0.15;
    if (wait) score += r.pays ? -0.2 : 0.15;
    if (hike) score += r.owner ? -0.1 : -0.35;
    if ((r.memory || []).includes("cheap-patch") && cheap) score -= 0.35;
    if ((r.memory || []).includes("raise-dues") && hike) score -= 0.5;
    if ((r.memories || []).some((m) => m.type === proposal.id && m.sentiment < 0)) score -= 0.45;
    score -= Math.max(0, (s.flags.proposalCounts?.[proposal.id] || 0) - 1) * 0.42;
    const allies = Object.entries(r.relations || {}).filter(([, value]) => value >= 20).map(([id]) => id);
    const allyMood = allies.reduce((sum, id) => sum + (s.residents.find((x) => x.id === id)?.trust || 50) - 50, 0);
    score += allyMood / 240;
    if (s.issues.some((i) => (i.parties || []).includes(r.id))) score += 0.2;
    ballots[r.id] = score >= 0;
    if (score >= 0) yes += 1;
    else no += 1;
  }
  return { yes, no, accepted: yes > no, ballots };
}

function updateApartmanPolitics(s) {
  const D = globalThis.TarikLabDepth;
  const avgTrust = s.residents.reduce((sum, r) => sum + r.trust, 0) / Math.max(1, s.residents.length);
  const openSeverity = s.issues.filter((i) => i.status === "acik").reduce((sum, i) => sum + (i.severity || 1), 0);
  s.politics.confidence = D.clamp(Math.round(avgTrust - openSeverity * 1.1 + s.building.condition * 0.22), 0, 100);
  s.politics.opposition = s.residents.filter((r) => r.trust < 40).sort((a, b) => b.influence - a.influence).map((r) => r.id);
  const blocs = {};
  s.residents.forEach((r) => { (blocs[r.bloc] ||= []).push(r); });
  s.politics.alliances = Object.entries(blocs).filter(([, people]) => people.length >= 2 && people.reduce((n, r) => n + r.trust, 0) / people.length >= 54).map(([bloc]) => bloc);
  s.politics.warnings = [];
  s.residents.forEach((resident) => {
    resident.currentAttitude = resident.trust < 35 ? "muhalif" : resident.trust >= 65 ? "destekçi" : "kararsız";
    resident.currentIssue = s.issues.find((issue) => issue.status === "acik" && (issue.parties || []).includes(resident.id))?.id || null;
  });
  if (s.politics.confidence < 35) s.politics.warnings.push("Yönetim desteği kritik; seçimden önce iki haftalık toparlanma penceresi var.");
  if (s.finance.cash < 1500) s.politics.warnings.push("Kasa kritik; kalıcı bakım kararı borç baskısı yaratabilir.");
  if (s.building.condition < 35) s.politics.warnings.push("Bina güvenliği kritik eşiğe yaklaşıyor.");
}

function rememberProposal(s, r, proposal, accepted, votedYes) {
  const D = globalThis.TarikLabDepth;
  const dislikes = proposal.id === "raise-dues" ? r.income === "kırılgan" : proposal.id === "wait" ? r.owner : proposal.id === "cheap-patch" ? r.personality === "kanaat önderi" : false;
  const repeated = (s.flags.proposalCounts?.[proposal.id] || 0) >= 3;
  const sentiment = accepted ? (dislikes || repeated ? -2 : proposal.id === "durable-maintenance" ? 2 : 1) : (votedYes ? -1 : 0);
  D.remember(r, { id: `${proposal.id}-${s.week}`, type: proposal.id, turn: s.week, sentiment, weight: Math.abs(sentiment), tags: [accepted ? "kabul" : "ret"] });
  r.trust = D.clamp(r.trust + sentiment * 2, 0, 100);
}

function resolveApartmanEffect(s, effect) {
  const D = globalThis.TarikLabDepth;
  if (effect.type === "patch-failure") {
    s.issues.push({ id: `callback-${effect.system}-${s.week}`, type: "bakım", system: effect.system, title: "Ucuz yama yeniden arızalandı", status: "acik", severity: 4, chainId: effect.chainId });
    s.residents.filter((r) => (r.memories || []).some((m) => m.type === "cheap-patch")).forEach((r) => { r.trust = D.clamp(r.trust - 7); });
    pushHist(s, { type: "callback", text: "Ucuz çözüm geri tepti; bunu destekleyenler bile yönetimi sorguluyor.", cause: effect.cause });
  } else if (effect.type === "investment-return") {
    s.building.condition = D.clamp(s.building.condition + 5);
    s.progression.investments += 1;
    s.progression.score += 12;
    s.residents.forEach((r) => { r.trust = D.clamp(r.trust + (r.owner ? 4 : 2)); });
    pushHist(s, { type: "callback", text: "Kalıcı bakımın faturası ağırdı; arıza yükü şimdi belirgin biçimde azaldı.", cause: effect.cause });
  } else if (effect.type === "dues-opposition") {
    s.residents.filter((r) => r.income === "kırılgan").forEach((r) => { r.trust = D.clamp(r.trust - 8); r.pays = r.trust >= 32; });
    pushHist(s, { type: "callback", text: "Aidat artışı muhalefeti aynı masada topladı.", cause: effect.cause });
  } else if (effect.type === "neglect") {
    const issue = s.issues.find((i) => i.id === effect.issue && i.status === "acik");
    if (issue) issue.severity = Math.min(5, (issue.severity || 1) + 1);
    s.politics.confidence = D.clamp(s.politics.confidence - 6);
    pushHist(s, { type: "callback", text: "Ertelenen mesele büyüdü; sakinler kararın kaynağını hatırlıyor.", cause: effect.cause });
  } else if (effect.type === "chain-echo" || effect.type === "chain") {
    resolveApartmanChainEffect(s, effect);
  }
}

function applyApartmanProposal(s, proposal, meetingType) {
  ensureApartmanState(s);
  if (s.flags.meetingWeek === s.week) return { ...(s.lastMeeting || {}), duplicate: true };
  const vote = apartmanVote(s, proposal);
  s.flags.meeting = true;
  s.flags.meetingWeek = s.week;
  s.lastMeeting = { type: meetingType, proposal: proposal.id, ...vote, week: s.week };
  s.flags.proposalCounts = s.flags.proposalCounts || {};
  if (vote.accepted) s.flags.proposalCounts[proposal.id] = (s.flags.proposalCounts[proposal.id] || 0) + 1;
  for (const r of s.residents) {
    r.memory = (r.memory || []).concat(proposal.id).slice(-6);
    rememberProposal(s, r, proposal, vote.accepted, vote.ballots?.[r.id]);
  }
  const financeOnce = s.flags.financeWeek !== s.week;
  if (vote.accepted) {
    if (financeOnce) {
      s.finance.cash -= proposal.cash || 0;
      s.flags.financeWeek = s.week;
    }
    s.building.condition = clamp(s.building.condition + (proposal.condition || 0));
    const targetSys =
      proposal.id === "raise-dues"
        ? null
        : s.issues.find((i) => i.status === "acik" && i.system)?.system || "asansor";
    const part = targetSys && s.building.parts.find((p) => p.id === targetSys);
    if (part) part.condition = clamp(part.condition + (proposal.condition || 0));
    if (proposal.id === "cheap-patch") {
      s.flags.cheapPatch = 3;
      s.flags.cheapSystem = targetSys || "asansor";
      s.flags.cheapCount = (s.flags.cheapCount || 0) + 1;
      globalThis.TarikLabDepth.schedule(s, { id: `patch-${s.week}`, type: "patch-failure", dueTurn: s.week + 3, system: targetSys || "asansor", chainId: `bakim-${s.week}`, cause: proposal.id });
    }
    if (proposal.id === "raise-dues") {
      s.finance.dues += proposal.duesDelta || 350;
      s.flags.duesHikes = (s.flags.duesHikes || 0) + 1;
      for (const r of s.residents) r.satisfaction = clamp(r.satisfaction - (r.pays ? 8 : 4));
      globalThis.TarikLabDepth.schedule(s, { id: `dues-${s.week}`, type: "dues-opposition", dueTurn: s.week + 2, cause: proposal.id });
    }
    if (proposal.id === "durable-maintenance") {
      s.issues = s.issues.map((i) =>
        i.status === "acik" && i.system === (targetSys || "asansor")
          ? { ...i, status: "kapali" }
          : i,
      );
      globalThis.TarikLabDepth.schedule(s, { id: `investment-${s.week}`, type: "investment-return", dueTurn: s.week + 4, cause: proposal.id });
    }
    if (proposal.id === "wait") globalThis.TarikLabDepth.schedule(s, { id: `neglect-${s.week}`, type: "neglect", dueTurn: s.week + 2, issue: s.flags.focusIssue, cause: proposal.id });
    if (proposal.id === "cheap-patch") {
      s.issues = s.issues.map((i) =>
        i.status === "acik" && i.system === "asansor" ? { ...i, status: "kapali" } : i,
      );
    }
    s.openCases.push({
      id: "followup_" + s.week,
      kind: "inspection",
      due: s.week + 2,
      system: targetSys || "asansor",
    });
  }
  pushHist(s, {
    type: "meeting",
    proposal: proposal.id,
    accepted: vote.accepted,
    yes: vote.yes,
    no: vote.no,
  });
  globalThis.TarikLabDepth.noteEvent(s, `proposal:${proposal.id}`, s.week, 4);
  updateApartmanPolitics(s);
  return vote;
}

export function apartmanForecast(s, proposal) {
  ensureApartmanState(s);
  const cashAfter = s.finance.cash - (proposal.cash || 0);
  const financeRisk = cashAfter < 1500 ? 82 : cashAfter < 5000 ? 52 : proposal.id === "raise-dues" ? 38 : 22;
  const socialRisk = proposal.id === "raise-dues" ? 78 : proposal.id === "cheap-patch" ? 58 : proposal.id === "wait" ? 46 : 28;
  const longRisk = proposal.id === "wait" ? 76 : proposal.id === "cheap-patch" ? 72 : proposal.id === "raise-dues" ? 55 : 24;
  return { financeRisk, socialRisk, longRisk, bands: [financeRisk, socialRisk, longRisk].map(globalThis.TarikLabDepth.riskBand) };
}

function tickApartman(s) {
  ensureApartmanState(s);
  if (s.activeEvent && !s.activeEvent.resolved) {
    const ev = s.activeEvent;
    applyApartmanEventChoice(s, `${ev.chainId}:${ev.nodeId}:bekle`);
  }
  s.week += 1;
  s.flags.meeting = false;
  s.flags.prepared = [];
  s.flags.focusIssue = null;
  const paid = s.residents.filter((r) => r.pays).length;
  const serviceLoad = s.site?.serviceLoad || 1;
  s.finance.cash += Math.round((s.finance.dues * paid * serviceLoad) / s.residents.length);
  s.finance.arrears += Math.round(
    (s.finance.dues * (s.residents.length - paid)) / s.residents.length,
  );
  const cheapSys = s.flags.cheapSystem || "asansor";
  for (const p of s.building.parts) {
    const extra = s.flags.cheapPatch > 0 && p.id === cheapSys ? 2 + (s.flags.cheapCount || 0) : 0;
    p.condition = clamp(p.condition - (serviceLoad + extra), 0, 100);
  }
  s.building.condition = clamp(
    Math.round(s.building.parts.reduce((a, p) => a + p.condition, 0) / s.building.parts.length),
  );
  if (s.flags.cheapPatch > 0) {
    s.flags.cheapPatch -= 1;
  }
  // The repeat-use penalty (apartmanVote) is meant to stop spamming the same
  // proposal week after week, not to permanently retire a proposal type for
  // the rest of a 60+ week run the first time it is used more than twice.
  // Left unbounded it made the single best proposal (durable-maintenance)
  // unusable forever after its third acceptance. A slow weekly decay keeps
  // rapid repetition costly while letting the penalty fade if the board
  // moves on to other business for a while.
  if (s.flags.proposalCounts) {
    for (const key of Object.keys(s.flags.proposalCounts)) {
      s.flags.proposalCounts[key] = Math.max(0, s.flags.proposalCounts[key] - 0.15);
    }
  }
  if ((s.flags.duesHikes || 0) >= 2 && !s.flags.duesRevolt) {
    s.flags.duesRevolt = true;
    for (const r of s.residents) {
      if (r.pays && r.satisfaction < 50) r.pays = false;
      r.satisfaction = clamp(r.satisfaction - 6);
    }
    s.issues.push({
      id: "aidat-isyan-" + s.week,
      type: "aidat",
      title: "Aidat isyanı: liste asılsın deniyor",
      status: "acik",
      severity: 4,
    });
    pushHist(s, { type: "callback", text: "Üst üste aidat artışı ödemeyi durdurdu." });
  }
  for (const c of s.openCases.slice()) {
    if (typeof c.due === "number" && c.due <= s.week) {
      c.status = "due";
      const el = s.residents.find((r) => !r.pays);
      if (el) el.satisfaction = clamp(el.satisfaction - 6);
    }
  }
  globalThis.TarikLabDepth.settleDue(s, s.week, (effect) => resolveApartmanEffect(s, effect));
  tickApartmanChains(s);
  if (s.issues.filter((i) => i.status === "acik").length < 4) {
    const used = new Set(s.issues.map((i) => i.id));
    const next = ISSUE_TEMPLATES.find((t) => !used.has(t.id) && globalThis.TarikLabDepth.canShowEvent(s, t.id, s.week));
    if (next) { s.issues.push({ ...next, status: "acik" }); globalThis.TarikLabDepth.noteEvent(s, next.id, s.week, 6); }
  }
  if (s.week >= 8 && s.progression.phase === "yıpranmış bina") s.progression.phase = "yenileme baskısı";
  if (s.week >= 20) { s.progression.phase = s.progression.investments >= 2 ? "kademeli yenileme" : "dönüşüm tartışması"; s.progression.path = s.progression.investments >= 2 ? "yenile" : "diren/borçlan"; }
  updateApartmanPolitics(s);
  if (s.week >= s.politics.electionDue) {
    const retained = s.politics.confidence >= 42;
    pushHist(s, { type: "election", text: retained ? "Güven oylamasını geçtin; yeni dönem başladı." : "Güven oylamasını kaybettin; iki haftalık devir ve toparlanma süresi başladı.", confidence: s.politics.confidence });
    if (!retained) s.politics.recoveryUntil = s.week + 2;
    s.politics.electionDue = s.week + 12;
  }
  if (s.politics.recoveryUntil && s.week > s.politics.recoveryUntil) {
    if (s.politics.confidence < 38) {
      s.runSummary = { result: "Yönetim değişti", week: s.week, cause: "Güven kaybı toparlanma penceresinde giderilemedi", confidence: s.politics.confidence, phase: s.progression.phase, decisions: s.history.filter((x) => x.type === "meeting").slice(-8), traces: summarizeApartmanRun(s) };
    } else {
      // The two-week recovery window closed with confidence back at or above
      // the floor: the window is spent. Left set, this flag stayed armed for
      // the rest of the run, so any later, unrelated dip below 38 - even
      // after winning several subsequent elections - ended the game citing a
      // recovery window that had actually closed dozens of weeks earlier.
      s.politics.recoveryUntil = null;
    }
  }
}

function unlockPhoneApps(s) {
  const map = {
    call_leyla: "calls",
    call_emre: "calls",
    call_unknown: "calls",
    photo_cafe: "photos",
    photo_key: "photos",
    photo_bag: "photos",
    photo_ticket: "photos",
    note_pin: "notes",
    note_debt: "notes",
    note_pass: "notes",
    cal_naz: "calendar",
    cal_clinic: "calendar",
    cal_work: "calendar",
    file_pdf: "files",
    file_scan: "files",
    file_chat: "files",
    voice_1: "voice",
    voice_2: "voice",
  };
  for (const id of s.discoveredItems) {
    const app = map[id];
    if (app && !s.unlockedApps.includes(app)) s.unlockedApps.push(app);
  }
  if (s.discoveredItems.length >= 2 && !s.unlockedApps.includes("calls"))
    s.unlockedApps.push("calls");
  if (s.discoveredItems.length >= 3 && !s.unlockedApps.includes("photos"))
    s.unlockedApps.push("photos");
  if (s.discoveredItems.length >= 4 && !s.unlockedApps.includes("notes"))
    s.unlockedApps.push("notes");
  if (s.discoveredItems.length >= 5 && !s.unlockedApps.includes("calendar"))
    s.unlockedApps.push("calendar");
  if (s.discoveredItems.length >= 6 && !s.unlockedApps.includes("files"))
    s.unlockedApps.push("files");
  if (s.discoveredItems.length >= 7 && !s.unlockedApps.includes("voice"))
    s.unlockedApps.push("voice");
}

function devletPolicy(s, policyId) {
  return devletPolicyApply(s, policyId);
}

function devletAdvance(s) {
  return tickDevlet(s);
}

export function applyAction(id, s, action) {
  if (!s) return null;
  if (typeof action !== "string") return s;
  if (id === "apartman" && s.runSummary) return s;
  if (id === "apartman" && action.startsWith("focus:")) {
    const issueId = action.slice(6);
    if (s.issues.some((issue) => issue.id === issueId && issue.status === "acik"))
      s.flags.focusIssue = issueId;
  } else if (id === "apartman" && action.startsWith("prepare:")) {
    const issueId = action.slice(8);
    const prepared = s.flags.prepared || [];
    if (
      prepared.length < 2 &&
      !prepared.includes(issueId) &&
      s.issues.some((issue) => issue.id === issueId && issue.status === "acik")
    ) {
      s.flags.prepared = prepared.concat(issueId);
      pushHist(s, { type: "preparation", issue: issueId, week: s.week });
    }
  } else if (id === "apartman" && action === "meeting") {
    const proposal = s.finance.cash < 2000 ? PROPOSALS[1] : PROPOSALS[0];
    const kind = s.finance.arrears > 2500 ? "aidat-krizi" : "butce";
    applyApartmanProposal(s, proposal, kind);
  } else if (id === "apartman" && action === "advance") {
    tickApartman(s);
  } else if (id === "apartman" && action.startsWith("proposal:")) {
    const proposal = PROPOSALS.find((p) => p.id === action.slice(9)) || PROPOSALS[0];
    applyApartmanProposal(
      s,
      proposal,
      proposal.id === "raise-dues" ? "aidat-krizi" : "acil-onarim",
    );
  } else if (id === "apartman" && action.startsWith("event-choice:")) {
    applyApartmanEventChoice(s, action.slice("event-choice:".length));
    updateApartmanPolitics(s);
  } else if (id === "son-100-gun" && action === "advance") {
    // Explicit "skip to next day": forfeits any unused action(s) for today.
    // This used to also sneak in one free "work" action before advancing, so
    // every "advance" press (which is what the UI's only action button sent)
    // silently consumed the day's first action AND ended the day in the same
    // click - the two-actions-per-day contract could never be exercised.
    // Day 100 is the end of the run. Without the finalReport guard the final
    // report stayed on screen while further presses kept advancing the day
    // counter (101 -> 121) and kept missing obligations after the game was over.
    if (!s.flags.finalReport) sonAdvanceDay(s);
  } else if (id === "son-100-gun" && action.startsWith("act:")) {
    if ((s.focusRemaining ?? 8) > 0 && !s.flags.finalReport) applySonAction(s, action.slice(4));
    if ((s.focusRemaining ?? 0) === 0 && !s.flags.finalReport) sonAdvanceDay(s);
  } else if (id === "son-100-gun" && action.startsWith("scenario:")) {
    applySonScenario(s, action.slice(9));
  } else if (id === "kayip-telefon" && action.startsWith("discover:")) {
    if (discoverEvidence(s, action.slice(9))) unlockPhoneApps(s);
  } else if (id === "kayip-telefon" && action.startsWith("link:")) {
    const [a, b] = action.slice(5).split(":");
    linkEvidence(s, a, b);
  } else if (id === "kayip-telefon" && action.startsWith("pin:")) {
    togglePin(s, action.slice(4));
  } else if (id === "kayip-telefon" && action.startsWith("theory:")) {
    const [question, option] = action.slice(7).split(":");
    setTheory(s, question, option);
  } else if (id === "kayip-telefon" && action.startsWith("decision:")) {
    setDecision(s, action.slice(9));
  } else if (id === "kayip-telefon" && action === "return") {
    finishCase(s);
  } else if (id === "tc-sim-devlet" && action.startsWith("content:")) {
    const rest = action.slice(8);
    const cut = rest.indexOf(":");
    if (cut > 0) devletContentChoice(s, rest.slice(0, cut), rest.slice(cut + 1));
  } else if (id === "tc-sim-devlet" && action === "policy") {
    devletPolicy(s, "imf-sba");
  } else if (id === "tc-sim-devlet" && action.startsWith("policy:")) {
    devletPolicy(s, action.slice(7));
  } else if (id === "tc-sim-devlet" && action === "advance") {
    settleDevletContent(s);
    devletAdvance(s);
  } else if (id === "tc-sim-devlet" && action.startsWith("era:")) {
    const eraId = action.slice(4);
    if (PERIODS[eraId]) {
      const keepMeta = s.meta;
      Object.assign(s, hydrateDevlet(eraId), { meta: keepMeta });
      pushHist(s, { type: "era-select", era: eraId, playable: true });
    }
  } else if (id === "tc-sim-devlet" && action === "campaign:grand") {
    const keepMeta = s.meta;
    Object.assign(s, hydrateDevlet("1923", { campaign: true }), { meta: keepMeta });
    pushHist(s, { type: "campaign", mode: "hedefsiz" });
  } else if (id === "tc-sim-devlet" && action.startsWith("campaign:")) {
    const doctrine = action.slice(9);
    const keepMeta = s.meta;
    Object.assign(s, hydrateDevlet("1923", { campaign: true, doctrine }), { meta: keepMeta });
    pushHist(s, { type: "campaign", mode: "hedefli", doctrine });
  } else if (id === "tc-sim-devlet" && action.startsWith("doctrine:")) {
    applyDoctrine(s, action.slice(9));
  } else if (id === "tc-sim-devlet" && action.startsWith("alt:")) {
    const keepMeta = s.meta;
    Object.assign(s, hydrateDevlet("alternatif", { alt: action.slice(4) }), { meta: keepMeta });
  } else if (id === "tc-sim-devlet" && action.startsWith("tick:")) {
    tickDevletN(s, Number(action.slice(5)) || 0);
  }
  s.history = (s.history || []).slice(-80);
  s.openCases = (s.openCases || []).slice(-40);
  return s;
}

export {
  defs,
  SYSTEMS,
  MEETINGS,
  SCENARIOS,
  DISCOVERABLES,
  PERIODS,
  POLICIES_2002,
  ENDINGS,
  APPS,
  ISSUE_TEMPLATES,
  hydrateDevlet,
  tickDevletN,
  DOCTRINES,
  ALT_PRESETS,
  POLICIES,
  finiteState,
  GUNUMUZ_BASELINE,
  CONTACTS,
  RESIDENTS,
  SON_EVENTS,
  PROPOSALS,
  createPhoneState,
  newCaseSeed,
  availableEvidence,
  evidenceNodes,
  evidenceSpec,
  phoneThreads,
  PHONE_FACTS,
  PHONE_THEORIES,
  PHONE_SIDE_SECRETS,
  PHONE_DECISIONS,
};
export { A100 as SON_ACTIONS };
