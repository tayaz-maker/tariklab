/** TC SIM Wave 4 — bounded causal life arcs built on the existing simulation. */
// catalog.js is a leaf module, so importing the commute primitive here cannot
// create a cycle (life.js, which wraps it, reaches state.js and back again).
import { locationCommute } from "./locations.js?v=10";

export const LIFE_ARC_IDS = [
  "career", "education", "relationship", "family", "finance",
  "housing", "social", "status", "health", "crisis",
];

export const LIFE_ARC_LABELS = {
  career: ["Kariyer", "Career"], education: ["Eğitim", "Education"],
  relationship: ["İlişki", "Relationship"], family: ["Aile", "Family"],
  finance: ["Finans / borç", "Finance / debt"], housing: ["Konut", "Housing"],
  social: ["Sosyal çevre", "Social circle"], status: ["Sosyal statü", "Social status"],
  health: ["Sağlık / enerji", "Health / energy"], crisis: ["Kişisel kriz", "Personal crisis"],
};

const STAGES = ["start", "development", "tension", "crisis", "turning", "outcome"];
const cap = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Number(value) || 0));
const bounded = (rows, limit) => (Array.isArray(rows) ? rows.slice(-limit) : []);
const unique = (rows, key = (row) => row.id) => {
  const seen = new Set();
  return rows.filter((row) => row && !seen.has(key(row)) && seen.add(key(row)));
};

export function getLifePhase(state) {
  const age = Number(state?.player?.age) || 18;
  return age < 30 ? "opening" : age < 51 ? "midgame" : "late-game";
}

function baseArc(id) {
  return { id, stage: "start", momentum: 0, unresolvedIssue: null, memory: [], risks: [], opportunities: [] };
}

export function neutralLifeDepth(state) {
  return {
    version: 1,
    phase: getLifePhase(state),
    arcs: Object.fromEntries(LIFE_ARC_IDS.map((id) => [id, baseArc(id)])),
    goals: [], opportunities: [], pendingEffects: [], resolvedEffects: [],
    echoes: [], arcHistory: [], decisionHistory: [], dossier: null,
  };
}

function validStage(stage) { return STAGES.includes(stage) ? stage : "start"; }

export function ensureLifeDepthState(state) {
  const raw = state.lifeDepth && typeof state.lifeDepth === "object" ? state.lifeDepth : neutralLifeDepth(state);
  const arcs = {};
  for (const id of LIFE_ARC_IDS) {
    const source = raw.arcs?.[id] || baseArc(id);
    arcs[id] = {
      id, stage: validStage(source.stage), momentum: cap(source.momentum, -100, 100),
      unresolvedIssue: typeof source.unresolvedIssue === "string" ? source.unresolvedIssue : null,
      memory: bounded(source.memory, 16).filter((x) => x?.id && Number.isInteger(x.week)),
      risks: bounded(source.risks, 4).filter((x) => typeof x === "string"),
      opportunities: bounded(source.opportunities, 4).filter((x) => typeof x === "string"),
    };
  }
  const normalized = {
    version: 1, phase: getLifePhase(state), arcs,
    goals: unique(bounded(raw.goals, 6)).filter((x) => x?.id && typeof x.label === "string"),
    opportunities: unique(bounded(raw.opportunities, 8)).filter((x) => x?.id),
    pendingEffects: unique(bounded(raw.pendingEffects, 12)).filter((x) => x?.id && Number.isInteger(x.dueWeek) && x.dueWeek >= 1 && x.status === "pending"),
    resolvedEffects: [...new Set(bounded(raw.resolvedEffects, 32).filter((x) => typeof x === "string"))],
    echoes: bounded(raw.echoes, 12).filter((x) => x?.id && typeof x.text === "string"),
    arcHistory: bounded(raw.arcHistory, 80).filter((x) => x?.arc && Number.isInteger(x.week)),
    decisionHistory: bounded(raw.decisionHistory, 80).filter((x) => x?.id && Number.isInteger(x.week)),
    dossier: raw.dossier && typeof raw.dossier === "object" ? raw.dossier : null,
  };
  // Preserve object identity: callers may sanitize while composing a decision
  // or weekly tick and must not continue writing into a detached container.
  Object.assign(raw, normalized);
  state.lifeDepth = raw;
  // Backfill the durable once-per-life marker from a save whose ledger still
  // carries it, so the education payoff cannot reopen when that bounded entry
  // later rolls off.
  if (state.flags && normalized.resolvedEffects.some((x) => x.startsWith("education-leverage")))
    state.flags.lifeDepthEducationLeverage = true;
  return raw;
}

function rememberArc(state, id, type, text) {
  const depth = ensureLifeDepthState(state), arc = depth.arcs[id];
  const entry = { id: `${id}:${type}:${state.time.absoluteWeek}`, type, week: state.time.absoluteWeek, text };
  if (!arc.memory.some((x) => x.id === entry.id)) arc.memory = bounded(arc.memory.concat(entry), 16);
  depth.arcHistory = bounded(depth.arcHistory.concat({ arc: id, ...entry }), 80);
}

function schedule(state, effect) {
  const depth = ensureLifeDepthState(state);
  if (depth.pendingEffects.some((x) => x.id === effect.id) || depth.resolvedEffects.includes(effect.id)) return false;
  depth.pendingEffects.push({ ...effect, status: "pending" });
  depth.pendingEffects = bounded(depth.pendingEffects, 12);
  return true;
}

function recentlyResolved(depth, prefix, week, cooldown) {
  return depth.resolvedEffects.some((id) => {
    if (!id.startsWith(prefix)) return false;
    const resolvedWeek = Number(id.slice(prefix.length));
    return Number.isFinite(resolvedWeek) && week - resolvedWeek < cooldown;
  });
}

function debtTotal(state) {
  const wealthDebt = Number(state.wealth?.debts?.reduce?.((sum, debt) => sum + (debt.principal || 0), 0)) || 0;
  const socialDebt = (state.openCases || []).filter((x) => x.status !== "resolved" && x.type === "personal-debt").reduce((sum, x) => sum + (x.payload?.amount || 0), 0);
  const arrears = Math.max(0, Number(state.finances?.arrears) || 0);
  return Math.max(0, Math.round(wealthDebt + socialDebt + arrears));
}

export function economyCausality(state) {
  // The commute is the game's own zone-distance model (home zone vs job zone,
  // minus a car), the same number getWeeklyLifeLoad and the commute_fatigue
  // event already use. It used to be guessed from the home id instead: no home
  // id contains "center"/"central", so that branch was dead, "shared" and
  // "studio" scored identically (making the pricier flat strictly dominated),
  // and the ordering ran backwards against the catalog's own zone field.
  const commute = locationCommute(state);
  const debt = debtTotal(state);
  const balance = Number(state.finances?.balance) || 0;
  const familyLoad = (state.parenthood?.children || []).filter((x) => x.alive !== false).length;
  return {
    debt, commute, familyLoad,
    liquidityPressure: cap((debt - balance) / 500 + familyLoad * 8 + commute * 5),
    timePressure: cap(commute * 14 + familyLoad * 12 + (state.education?.active ? 14 : 0)),
    safety: cap(50 + balance / 500 - debt / 700 - familyLoad * 5),
  };
}

function deriveGoals(state) {
  const d = ensureLifeDepthState(state), eco = economyCausality(state), goals = [];
  if (eco.debt > 0 || state.finances.balance < 2500) goals.push({ id: "stabilize-finance", arc: "finance", label: "Borç ve nakit baskısını azalt", progress: eco.debt ? cap(100 - eco.debt / 100) : cap(state.finances.balance / 40) });
  if (state.career.jobId && state.career.performance < 70) goals.push({ id: "prepare-promotion", arc: "career", label: "Performans ve çevreyle terfiye hazırlan", progress: cap(state.career.performance) });
  if (state.household.homeId === "family" && state.player.age >= 23) goals.push({ id: "housing-step", arc: "housing", label: "Sürdürülebilir bir konut adımı hazırla", progress: cap(state.finances.balance / 100) });
  const partner = state.social?.currentPartnerNpcId && state.people.find((x) => x.id === state.social.currentPartnerNpcId);
  if (partner?.social?.tension >= 35) goals.push({ id: "repair-relationship", arc: "relationship", label: "İlişkide biriken gerilimi konuş", progress: cap(100 - partner.social.tension) });
  if (state.education.active) goals.push({ id: "complete-education", arc: "education", label: "Başladığın eğitimi tamamla", progress: cap(state.education.active.progress || 0) });
  d.goals = goals.slice(0, 4);
}

function updateArc(arc, score, risk, opportunity) {
  arc.momentum = cap(Math.round(score), -100, 100);
  arc.stage = score >= 70 ? "outcome" : score >= 45 ? "turning" : score <= -55 ? "crisis" : score <= -25 ? "tension" : score >= 15 ? "development" : "start";
  arc.risks = risk ? [risk] : [];
  arc.opportunities = opportunity ? [opportunity] : [];
  arc.unresolvedIssue = score <= -25 ? risk : null;
}

export function refreshLifeArcs(state) {
  const d = ensureLifeDepthState(state), eco = economyCausality(state);
  const rels = Object.values(state.relationships || {}), avgRel = rels.length ? rels.reduce((a, b) => a + b, 0) / rels.length : 50;
  const partner = state.social?.currentPartnerNpcId && state.people.find((x) => x.id === state.social.currentPartnerNpcId);
  const career = (state.career?.jobId ? 15 : -35) + (state.career?.performance - 50) + Math.min(30, (state.career?.weeksInRole || 0) / 4);
  updateArc(d.arcs.career, career, "Performans ve tükenme baskısı", "İş çevresinden yeni rol");
  updateArc(d.arcs.education, state.education?.active ? 25 + (state.education.active.progress || 0) / 2 : state.education?.level === "lise" ? -5 : 55, "Eğitim yarım kalabilir", "Eğitimin kariyere çevrilmesi");
  updateArc(d.arcs.relationship, partner ? partner.social.trust - partner.social.tension : avgRel - 45, "Yakınlık ihmal ediliyor", "Ortak gelecek kararı");
  updateArc(d.arcs.family, avgRel - 40 + (state.parenthood?.children?.length || 0) * 8, "Aile sorumlulukları birikiyor", "Aile desteğinin geri dönüşü");
  updateArc(d.arcs.finance, eco.safety - 45, "Borç ve zorunlu gider baskısı", "Birikimin yeni seçenek açması");
  updateArc(d.arcs.housing, state.household?.homeId === "family" ? -10 : 35 - eco.commute * 5, "Konut ve ulaşım dengesi", "Daha uygun yaşam alanı");
  updateArc(d.arcs.social, avgRel - 45, "Sosyal çevre zayıflıyor", "Eski bağın geri dönüşü");
  updateArc(d.arcs.status, (state.career?.performance || 50) / 2 + avgRel / 3 - 35, "İtibar tek alana sıkışıyor", "Çevreler arası güven");
  updateArc(d.arcs.health, (state.health?.energy || 0) / 2 + (state.health?.health || 0) / 2 - (state.health?.stress || 0), "Tükenme ve sağlık baskısı", "Düzeni toparlama");
  updateArc(d.arcs.crisis, 35 - eco.liquidityPressure - (state.health?.stress || 0) / 2, "Birden fazla yük aynı anda açık", "Kırılmayı yeni düzene çevirme");
  deriveGoals(state);
  return d;
}

export function recordLifeDecision(state, decisionId) {
  const d = refreshLifeArcs(state), week = state.time.absoluteWeek;
  d.decisionHistory = bounded(d.decisionHistory.concat({ id: decisionId, week }), 80);
  const map = {
    overtime: ["career", 8, "Ek mesai kariyer ivmesi yarattı."], rest: ["health", 8, "Dinlenme yükü azalttı."],
    exercise: ["health", 6, "Düzenli bakım için adım atıldı."], family: ["family", 8, "Aileye zaman ayrıldı."],
    friend: ["social", 8, "Sosyal bağ korundu."], "help-friend": ["social", 12, "Geçmiş yardım yeni bir karşılık ihtimali doğurdu."],
    "budget-check": ["finance", 7, "Bütçe baskısı görünür hale getirildi."], "job-search": ["career", 6, "Yeni iş yönü araştırıldı."],
  };
  const row = map[decisionId];
  if (row) { d.arcs[row[0]].momentum = cap(d.arcs[row[0]].momentum + row[1], -100, 100); rememberArc(state, row[0], decisionId, row[2]); }
  if (decisionId === "overtime" && (state.flags.overtimeStreak || 0) >= 3
    && !d.pendingEffects.some((x) => x.eventId === "life_depth_overwork_echo")
    && !recentlyResolved(d, "overwork-echo:", week, 16))
    schedule(state, { id: `overwork-echo:${week}`, eventId: "life_depth_overwork_echo", dueWeek: week + 8, actorId: "burak" });
  if (decisionId === "help-friend")
    schedule(state, { id: `friend-return:${week}`, eventId: "life_depth_friend_return", dueWeek: week + 12, actorId: "mehmet" });
}

export function processLifeDepthWeek(state) {
  let d = refreshLifeArcs(state);
  const due = [];
  if (d.arcs.relationship.stage === "crisis"
    && !d.pendingEffects.some((x) => x.eventId === "life_depth_relationship_reckoning")
    && !recentlyResolved(d, "relationship:", state.time.absoluteWeek, 12))
    schedule(state, { id: `relationship:${state.time.absoluteWeek}`, eventId: "life_depth_relationship_reckoning", dueWeek: state.time.absoluteWeek + 2, actorId: state.social?.currentPartnerNpcId || "mehmet" });
  // The education payoff is once per life, but resolvedEffects is a bounded
  // ring buffer: in a long life the overwork echoes alone push past its 32
  // entries, the marker rolls off and the gate silently reopens, repeating a
  // one-time beat and its +8 performance. A durable flag (the same mechanism
  // the weekly decisions use for onceFlag) is what actually spans a life.
  if (state.education?.level !== "lise" && state.career?.performance >= 62 && !state.flags.lifeDepthEducationLeverage
    && !d.resolvedEffects.some((x) => x.startsWith("education-leverage")) && !d.pendingEffects.some((x) => x.eventId === "life_depth_education_leverage"))
    schedule(state, { id: `education-leverage:${state.time.absoluteWeek}`, eventId: "life_depth_education_leverage", dueWeek: state.time.absoluteWeek + 4, actorId: "burak" });
  // schedule() sanitizes and replaces the bounded container; continue from
  // that canonical object rather than a stale pre-schedule reference.
  d = ensureLifeDepthState(state);
  for (const effect of d.pendingEffects) {
    if (effect.status !== "pending" || effect.dueWeek > state.time.absoluteWeek) continue;
    effect.status = "resolved"; d.resolvedEffects.push(effect.id); due.push(effect.eventId);
    if (String(effect.id).startsWith("education-leverage")) state.flags.lifeDepthEducationLeverage = true;
    d.echoes = bounded(d.echoes.concat({ id: effect.id, week: state.time.absoluteWeek, text: `Geçmiş kararın geri döndü: ${effect.eventId}.` }), 12);
  }
  d.pendingEffects = d.pendingEffects.filter((x) => x.status === "pending");
  d.resolvedEffects = [...new Set(bounded(d.resolvedEffects, 32))];
  return [...new Set(due)];
}

export const LIFE_DEPTH_EVENTS = [
  { id: "life_depth_overwork_echo", repeat: "repeatable", lifeDepth: true, title: "Aylar önceki fazla mesai", text: "Üst üste aldığın yük şimdi performans ve beden hesabı olarak geri döndü.", condition: () => false, choices: [
    { id: "slow-down", label: "Yükü azalt", risk: "Kariyer ivmesi azalır; sağlık toparlanır", effects: { health: { energy: 10, stress: -14 } } },
    { id: "push-through", label: "İvmeyi koru", risk: "Kariyer fırsatı korunur; tükenme riski artar", effects: { health: { energy: -8, stress: 12 } } },
  ] },
  { id: "life_depth_friend_return", repeat: "repeatable", lifeDepth: true, title: "Eski yardımın karşılığı", text: "Mehmet aylar önceki desteğini unutmadı; bir iş bağlantısını sana açıyor.", condition: () => false, choices: [
    { id: "use-referral", label: "Bağlantıyı kullan", risk: "Kariyer fırsatı; ilişkiye karşılık beklentisi", effects: { social: { mehmet: { trust: 3 } } } },
    { id: "keep-personal", label: "Dostluğu işten ayrı tut", risk: "Fırsat kapanır; güven ilişkisi sade kalır", effects: { social: { mehmet: { trust: 1, tension: -2 } } } },
  ] },
  { id: "life_depth_relationship_reckoning", repeat: "repeatable", lifeDepth: true, title: "Biriken mesafe", text: "Takvim değil, aylar boyunca ayırmadığın zaman konuşuyor.", condition: () => false, choices: [
    { id: "repair", label: "Zaman ve para ayır", risk: "₺600 ve zaman; ilişkiyi toparlama şansı", effects: { money: -600, health: { energy: -6, stress: -5 } } },
    { id: "distance", label: "Mesafeyi kabul et", risk: "Maliyet yok; bağ ve aile planı zayıflar", effects: { health: { stress: 4 } } },
  ] },
  { id: "life_depth_education_leverage", repeat: "repeatable", lifeDepth: true, title: "Eğitimin karşılığı", text: "Tamamladığın eğitim, mevcut performansınla birleşince yeni bir rol kapısı açtı.", condition: () => false, choices: [
    { id: "specialize", label: "Uzmanlık yoluna gir", risk: "Performans artar; enerji yükü oluşur", effects: { health: { energy: -5, stress: 4 } } },
    { id: "wait", label: "Doğru zamanı bekle", risk: "Risk düşük; fırsat ivmesi azalır", effects: {} },
  ] },
];

export function applyLifeDepthResolution(state, definition, choiceId) {
  if (!definition?.lifeDepth) return false;
  const d = ensureLifeDepthState(state), actorId = definition.id.includes("friend") ? "mehmet" : definition.id.includes("relationship") ? (state.social?.currentPartnerNpcId || "mehmet") : "burak";
  const arcId = definition.id.includes("overwork") ? "health" : definition.id.includes("education") ? "education" : definition.id.includes("relationship") ? "relationship" : "career";
  rememberArc(state, arcId, choiceId, `${definition.title}: ${definition.choices.find((x) => x.id === choiceId)?.label || choiceId}`);
  const actor = state.people?.find((x) => x.id === actorId);
  if (actor) {
    // Keyed by week, so a second resolution of the same chain in the same week
    // would otherwise stack identical entries. rememberArc() already guards
    // its own memory this way; the NPC ledger needs the same check.
    const memoryId = `wave4:${definition.id}:${state.time.absoluteWeek}`;
    actor.memories = (actor.memories || []).some((x) => x?.id === memoryId)
      ? actor.memories
      : bounded((actor.memories || []).concat({ id: memoryId, type: "life_arc", week: state.time.absoluteWeek, year: state.time.year, text: `${definition.title} konusunda ${choiceId} seçimini yaptı.` }), 50);
    actor.lifeState = { ...(actor.lifeState || {}), concern: definition.title };
  }
  if (definition.id === "life_depth_friend_return" && choiceId === "use-referral") { state.career.performance = cap(state.career.performance + 7); d.opportunities.push({ id: `referral:${state.time.absoluteWeek}`, arc: "career", label: "Mehmet'in iş bağlantısı", status: "used" }); }
  if (definition.id === "life_depth_overwork_echo" && choiceId === "push-through") state.career.performance = cap(state.career.performance + 5);
  if (definition.id === "life_depth_relationship_reckoning") {
    const person = state.people?.find((x) => x.id === actorId);
    if (person) { person.social.trust = cap(person.social.trust + (choiceId === "repair" ? 8 : -8)); person.social.tension = cap(person.social.tension + (choiceId === "repair" ? -14 : 10)); }
  }
  if (definition.id === "life_depth_education_leverage" && choiceId === "specialize") state.career.performance = cap(state.career.performance + 8);
  d.opportunities = unique(bounded(d.opportunities, 8)); refreshLifeArcs(state); return true;
}

export function buildLifeDossier(state) {
  const d = refreshLifeArcs(state), eco = economyCausality(state);
  const avgRelationship = Object.values(state.relationships || {}).reduce((a, b, _, xs) => a + b / Math.max(1, xs.length), 0);
  const career = d.arcs.career.momentum, family = d.arcs.family.momentum, health = d.arcs.health.momentum;
  let outcome = "balanced";
  if (career >= 55 && avgRelationship < 45) outcome = "successful-but-alone";
  else if (family >= 50 && career < 35) outcome = "simple-with-strong-bonds";
  else if (eco.debt === 0 && state.finances.balance > 20000) outcome = health < -20 ? "wealthy-but-burned-out" : "financially-secure";
  else if (career >= 45 && family >= 35 && health >= -20) outcome = "balanced";
  else if (health < -35) outcome = "burned-out";
  else if (eco.debt > state.finances.balance) outcome = "debt-burdened";
  const traces = unique([
    ...d.arcHistory.slice(-8).map((x) => ({ id: x.id, text: x.text })),
    ...d.echoes.slice(-4).map((x) => ({ id: x.id, text: x.text })),
  ]).slice(-10);
  d.dossier = {
    version: 1, week: state.time.absoluteWeek, outcome,
    phase: d.phase, career: { jobId: state.career.jobId, performance: state.career.performance, stage: d.arcs.career.stage },
    education: { level: state.education.level, active: state.education.active?.pathId || null, stage: d.arcs.education.stage },
    relationships: { average: Math.round(avgRelationship), partnerId: state.social.currentPartnerNpcId, stage: d.arcs.relationship.stage },
    family: { children: state.parenthood?.children?.length || 0, stage: d.arcs.family.stage },
    economy: { balance: Math.round(state.finances.balance), debt: eco.debt, safety: eco.safety, housing: state.household.homeId },
    health: { ...state.health, stage: d.arcs.health.stage },
    achievements: LIFE_ARC_IDS.filter((id) => d.arcs[id].stage === "outcome"),
    regrets: LIFE_ARC_IDS.filter((id) => ["tension", "crisis"].includes(d.arcs[id].stage)),
    actorOutcomes: (state.people || []).slice(0, 12).map((x) => ({ id: x.id, trust: x.social?.trust || 0, tension: x.social?.tension || 0, lastMemory: x.memories?.at(-1)?.text || null })),
    traces,
  };
  return d.dossier;
}

export function attachLifeDossier(state) {
  const dossier = buildLifeDossier(state);
  const report = state.lifetime?.reports?.find((x) => x.id === state.lifetime?.death?.reportId);
  if (report) report.lifeDossier = structuredClone(dossier);
  return dossier;
}

export function validateLifeDepthState(state) {
  const d = state?.lifeDepth;
  return !!d && d.version === 1 && LIFE_ARC_IDS.every((id) => d.arcs?.[id] && STAGES.includes(d.arcs[id].stage) && Number.isFinite(d.arcs[id].momentum)) &&
    Array.isArray(d.goals) && d.goals.length <= 6 && Array.isArray(d.pendingEffects) && d.pendingEffects.length <= 12 &&
    new Set(d.pendingEffects.map((x) => x.id)).size === d.pendingEffects.length && Array.isArray(d.resolvedEffects) && d.resolvedEffects.length <= 32 &&
    Array.isArray(d.arcHistory) && d.arcHistory.length <= 80 && Array.isArray(d.decisionHistory) && d.decisionHistory.length <= 80;
}
