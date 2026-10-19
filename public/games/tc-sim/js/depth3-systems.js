import {
  addMemory,
  addNpcMemory,
  addCareerHistory,
  appendCapped,
} from "./state.js?v=10";
import { applyRelationshipDelta, getPerson, markMeaningfulContact } from "./social.js?v=10";

const MAX_FAVORS = 30;
const MAX_EVIDENCE = 60;
const MAX_MILESTONES = 12;
const MAX_DEPTH3_CASES = 24;
export const DEPTH3_CHAIN_REGISTRY = Object.freeze({
  FAMILY_PERCEPTION: Object.freeze({ id: "CHN-19", eventId: "perception_reality_gap", domain: "family/perception" }),
  MILESTONE_NETWORK: Object.freeze({ id: "CHN-20", eventId: "network_referral_offer", followupEventId: "network_referral_followup", domain: "milestone/network" }),
  LOCATION_SOCIAL: Object.freeze({ id: "CHN-21", eventId: "housing_move_followup", domain: "location/social" }),
});

export function getDepth3ChainByEvent(eventId) {
  return Object.values(DEPTH3_CHAIN_REGISTRY).find((chain) => chain.eventId === eventId || chain.followupEventId === eventId) || null;
}
const CIRCLES = ["family", "professional", "friends", "acquaintances"];

export function ensureDepth3State(state) {
  if (!Array.isArray(state.favors)) state.favors = [];
  if (!state.reputation || typeof state.reputation !== "object") state.reputation = { evidence: [] };
  if (!Array.isArray(state.reputation.evidence)) state.reputation.evidence = [];
  if (!state.perception || typeof state.perception !== "object") state.perception = { circles: {} };
  if (!state.perception.circles || typeof state.perception.circles !== "object") state.perception.circles = {};
  state.favors = state.favors.filter((item) => item?.id && item?.personId).slice(-MAX_FAVORS);
  state.reputation.evidence = state.reputation.evidence.filter((item) => item?.circle && item?.signal).slice(-MAX_EVIDENCE);
  if (!state.reputation.evidence.length && state.player?.background?.family === "demanding") {
    state.reputation.evidence.push({ circle: "family", signal: "pressure", weight: 1, week: state.time.absoluteWeek, source: "background" });
  }
  for (const person of state.people || []) {
    person.circles = Array.isArray(person.circles) ? [...new Set(person.circles.filter((circle) => CIRCLES.includes(circle)))].slice(0, 4) : [];
    person.lifeMilestones = Array.isArray(person.lifeMilestones) ? person.lifeMilestones.slice(-MAX_MILESTONES) : [];
    person.knownMilestones = Array.isArray(person.knownMilestones) ? [...new Set(person.knownMilestones)].slice(-MAX_MILESTONES) : [];
    person.dormant = person.dormant === true;
  }
  return state;
}

const peerPersonId = (peer) => peer.personId || ({ "comparison-cousin": "selin", "comparison-classmate": "emre" }[peer.id] || null);

export function recordNpcMilestone(state, personId, { id, text, type = "life", playerKnown = false, statePatch = {} } = {}) {
  const person = getPerson(state, personId);
  if (!person || !id || !text || person.lifeMilestones.some((item) => item.id === id)) return false;
  const milestone = { id, type, text, week: state.time.absoluteWeek };
  appendCapped(person.lifeMilestones, milestone, MAX_MILESTONES);
  Object.assign(person.lifeState, statePatch);
  if (playerKnown && !person.knownMilestones.includes(id)) person.knownMilestones.push(id);
  return true;
}

export function markNpcMilestoneKnown(state, personId, milestoneId) {
  const person = getPerson(state, personId);
  const milestone = person?.lifeMilestones.find((item) => item.id === milestoneId);
  if (!person || !milestone || person.knownMilestones.includes(milestoneId)) return false;
  person.knownMilestones.push(milestoneId);
  addNpcMemory(state, personId, milestone.text, "milestone_shared");
  addMemory(state, `${person.name}: ${milestone.text}`, "important");
  return true;
}

export function processNpcMilestones(state) {
  ensureDepth3State(state);
  const week = state.time.absoluteWeek;
  if (week % 12 !== 0) return false;
  if (week >= 24) recordNpcMilestone(state, "selin", { id: "selin-job", type: "career", text: "Selin düzenli bir işe geçti.", statePatch: { employment: "stable" } });
  if (week >= 72) recordNpcMilestone(state, "selin", { id: "selin-moved", type: "housing", text: "Selin kendi düzenini kurdu.", statePatch: { residence: "independent" } });
  if (week >= 36) recordNpcMilestone(state, "emre", { id: "emre-education", type: "education", text: "Emre eğitimine devam ediyor.", statePatch: { education: "program" } });
  if (week >= 48) recordNpcMilestone(state, "burak", { id: "burak-promotion", type: "career", text: "Burak yeni bir ekipte sorumluluk aldı.", statePatch: { employment: "supervisor" } });
  if (week >= 84) {
    const burak = getPerson(state, "burak");
    if (burak && !burak.lifeMilestones.some((item) => item.id === "burak-dormant")) {
      burak.dormant = true;
      recordNpcMilestone(state, "burak", { id: "burak-dormant", type: "contact", text: "Burak'la görüşmeleriniz seyrekleşti.", statePatch: { concern: "dormant" } });
    }
  }
  return true;
}

export function createFavor(state, { personId, direction = "player_owes", type = "help", dueWeeks = 8, sourceEvent = null } = {}) {
  ensureDepth3State(state);
  const person = getPerson(state, personId);
  if (!person || person.deceased || !["player_owes", "npc_owes"].includes(direction)) return null;
  const existing = state.favors.find((item) => item.personId === personId && item.direction === direction && item.type === type && item.status === "open");
  if (existing) return existing;
  if (direction === "player_owes" && state.openCases.filter((item) => ["favor-obligation", "depth3-followup"].includes(item.type) && item.status !== "resolved").length >= MAX_DEPTH3_CASES) return null;
  const owedCount = state.favors.filter((item) => item.personId === personId && item.direction === "player_owes" && item.status === "open").length;
  const id = `favor-${personId}-${direction}-${type}-${state.time.absoluteWeek}`;
  if (state.favors.some((item) => item.id === id)) return null;
  const favor = { id, personId, direction, type, sourceEvent, createdWeek: state.time.absoluteWeek, dueWeek: direction === "player_owes" ? state.time.absoluteWeek + dueWeeks : null, status: "open" };
  appendCapped(state.favors, favor, MAX_FAVORS);
  if (owedCount >= 2) {
    applyRelationshipDelta(state, personId, { trust: -2, tension: 3 });
    recordReputationEvidence(state, person.circles?.[0] || "acquaintances", "unreliable", -1, "favor_overload");
  }
  if (direction === "player_owes") {
    state.openCases.push({ id: `${favor.id}-case`, type: "favor-obligation", createdWeek: state.time.absoluteWeek, dueWeek: favor.dueWeek, eventId: "network_favor_due", status: "pending", payload: { favorId: favor.id, personId } });
    addNpcMemory(state, personId, "Bana bir iyilik borcu var.", "favor_owed");
    if (type === "emergency-help" && (state.finances?.balance || 0) < 2500) {
      addNpcMemory(state, personId, "Maddi olarak zorlandığını biliyorum.", "financial_disclosure", { category: "financial", sourceEvent });
      state.perception.circles[person.circles?.[0] || "acquaintances"] = "baskı altında";
    }
  } else addNpcMemory(state, personId, "Ona bir iyilik borçluyum.", "favor_received");
  recordReputationEvidence(state, person.circles?.[0] || "acquaintances", direction === "npc_owes" ? "helpful" : "reliable", 1, sourceEvent);
  return favor;
}

export function resolveFavor(state, favorId, outcome = "fulfilled") {
  const favor = state.favors?.find((item) => item.id === favorId && item.status === "open");
  if (!favor) return false;
  favor.status = "resolved";
  favor.resolvedWeek = state.time.absoluteWeek;
  const closed = new Set();
  for (const item of state.openCases) {
    if (item.payload?.favorId === favorId) { item.status = "resolved"; closed.add(item.id); }
  }
  state.events.queue = state.events.queue.filter((item) => !closed.has(item.sourceCaseId));
  const person = getPerson(state, favor.personId);
  if (favor.direction === "player_owes") {
    const good = outcome === "fulfilled";
    applyRelationshipDelta(state, favor.personId, good ? { trust: 6, closeness: 3, tension: -3 } : { trust: -8, tension: 8 });
    if (person) addNpcMemory(state, favor.personId, good ? "Verdiği iyiliğin karşılığını aldı." : "Verdiği iyiliğin karşılığını alamadı.", good ? "favor_returned" : "favor_broken");
    addMemory(state, good ? `${person?.name || "Bir tanıdığın"} için verdiğin sözü tuttun.` : `${person?.name || "Bir tanıdığın"} için verdiğin sözü tutmadın.`, "important");
    recordReputationEvidence(state, person?.circles?.[0] || "acquaintances", good ? "reliable" : "unreliable", good ? 2 : -2, favor.sourceEvent);
  } else if (person) {
    applyRelationshipDelta(state, favor.personId, outcome === "fulfilled" ? { trust: 5, closeness: 2 } : { trust: -3, tension: 3 });
    addNpcMemory(state, favor.personId, outcome === "fulfilled" ? "İyiliğinin karşılığını verdi." : "İyiliğinin karşılığını vermedi.", "favor_resolved");
  }
  return true;
}

export function recordReputationEvidence(state, circle, signal, weight = 1, source = null) {
  if (!CIRCLES.includes(circle) || !signal || !Number.isFinite(weight)) return false;
  ensureDepth3State(state);
  if (state.reputation.evidence.some((item) => item.circle === circle && item.signal === signal && item.source === source && item.week === state.time.absoluteWeek)) return false;
  appendCapped(state.reputation.evidence, { circle, signal, weight: Math.max(-3, Math.min(3, weight)), week: state.time.absoluteWeek, source }, MAX_EVIDENCE);
  return true;
}

const labels = {
  family: { reliable: "Sorumlu", helpful: "Destek olan", pressure: "Baskı altında", distant: "Uzak" },
  professional: { reliable: "Güvenilir", ambitious: "İstekli", unreliable: "Kararsız", distant: "Geri planda" },
  friends: { reliable: "Sözünün eri", helpful: "Yardımsever", distant: "Uzak", unreliable: "Güveni zedelenmiş" },
  acquaintances: { reliable: "Bağlantılı", helpful: "İşe yarar bir çevre", distant: "Çekingen", unreliable: "Temkinli yaklaşılması gereken" },
};

export function getReputationContext(state, circle) {
  const evidence = (state.reputation?.evidence || []).filter((item) => item.circle === circle);
  const totals = {};
  for (const item of evidence) totals[item.signal] = (totals[item.signal] || 0) + Math.abs(item.weight);
  const top = Object.entries(totals).sort((a, b) => b[1] - a[1])[0];
  const signal = top?.[0] || "distant";
  return { circle, signal, score: top?.[1] || 0, label: labels[circle]?.[signal] || "Dengeli" };
}

export function updatePerceivedIdentity(state) {
  ensureDepth3State(state);
  // Algı son bilinen bağlamdır; gizli gerçeklik her okumada yeniden yazılmaz.
  for (const circle of CIRCLES) state.perception.circles[circle] ||= "dengeli";
  return state.perception.circles;
}

export function getPerceptionContext(state, circle) {
  updatePerceivedIdentity(state);
  return state.perception.circles[circle] || "dengeli";
}

export function getRealityPerceptionGap(state, circle) {
  const real = circle === "family" && state.finances.balance < 2500 ? "baskı altında" : circle === "professional" && state.career.performance >= 65 ? "güvenilir" : "dengeli";
  const perceived = getPerceptionContext(state, circle);
  return { real, perceived, gap: real !== perceived };
}

export function getSocialDistanceContext(state, personId) {
  const person = getPerson(state, personId);
  if (!person) return "";
  if (person.roleId === "family" && state.household?.homeId === "family") return "Aynı evde yaşamak yakın ama mahremiyeti sınırlıyor.";
  if (person.roleId === "family") return "Ayrı evler aradaki mesafeyi ve planlama ihtiyacını artırıyor.";
  return state.household?.homeId === "family" ? "Aile evi sosyal planlar için daha fazla koordinasyon istiyor." : "Kendi yaşam alanın buluşmaları daha esnek kılıyor.";
}

export function exposeKnownMilestone(state, personId, milestoneId) {
  const changed = markNpcMilestoneKnown(state, personId, milestoneId);
  if (changed) {
    const person = getPerson(state, personId);
    recordReputationEvidence(state, person?.circles?.[0] || "acquaintances", "helpful", 1, milestoneId);
  }
  return changed;
}

export function processDepth3OpenCases(state) {
  for (const item of state.openCases || []) {
    if (item.type !== "favor-obligation" || item.status !== "pending") continue;
    if (state.time.absoluteWeek > item.dueWeek) {
      item.status = "resolved";
      resolveFavor(state, item.payload?.favorId, "broken");
    }
  }
  for (const item of state.openCases || []) {
    if (item.type !== "depth3-followup" || item.status !== "pending" || !Number.isInteger(item.expiresWeek)) continue;
    if (state.time.absoluteWeek > item.expiresWeek) {
      item.status = "resolved";
      item.resolutionApplied = true;
      addMemory(state, "Bir çevre fırsatının süresi doldu; daha sonra yeniden oluşabilir.");
    }
  }
}

export function syncPeerMilestones(state) {
  for (const peer of state.comparisonCircle?.peers || []) {
    const person = getPerson(state, peerPersonId(peer));
    if (!person) continue;
    peer.personId = person.id;
    peer.knownMilestones = [...person.knownMilestones];
    const merged = [...(peer.milestones || []), ...person.lifeMilestones];
    peer.milestones = merged.filter((item, index, list) => item?.id ? list.findIndex((candidate) => candidate.id === item.id) === index : list.indexOf(item) === index).slice(-MAX_MILESTONES);
    const known = person.lifeMilestones.filter((item) => person.knownMilestones.includes(item.id)).at(-1);
    if (known) peer.status = known.text;
    else if (person.lifeMilestones.length) peer.status = "Hayatında yeni bir gelişme var.";
  }
}

export function getNetworkContacts(state, circle = null) {
  return (state.people || []).filter((person) => !person.deceased && !person.dormant && (!circle || person.circles?.includes(circle)));
}

export function addCareerNetworkMemory(state, personId, text, type = "professional_reliable") {
  addNpcMemory(state, personId, text, type);
  recordReputationEvidence(state, "professional", type === "professional_reliable" ? "reliable" : "unreliable", type === "professional_reliable" ? 1 : -1, personId);
}

export function createNetworkOpportunity(state, personId, type, dueWeeks = 6) {
  const person = getPerson(state, personId);
  if (!person || person.deceased) return false;
  const id = `network-${type}-${personId}-${state.time.absoluteWeek}`;
  if (state.openCases.some((item) => item.id === id && item.status !== "resolved")) return false;
  if (state.openCases.filter((item) => item.type === "depth3-followup" && item.status !== "resolved").length >= MAX_DEPTH3_CASES) return false;
  state.openCases.push({ id, type: "depth3-followup", createdWeek: state.time.absoluteWeek, dueWeek: state.time.absoluteWeek + dueWeeks, expiresWeek: state.time.absoluteWeek + dueWeeks + 8, eventId: type, status: "pending", payload: { personId, networkType: type } });
  return true;
}

export function scheduleMoveConsequence(state, fromHomeId, toHomeId) {
  const id = `move-social-${state.time.absoluteWeek}`;
  if (state.openCases.some((item) => item.id === id && item.status !== "resolved")) return false;
  state.openCases.push({
    id,
    type: "depth3-followup",
    createdWeek: state.time.absoluteWeek,
    dueWeek: state.time.absoluteWeek + 6,
    expiresWeek: state.time.absoluteWeek + 14,
    eventId: "housing_move_followup",
    status: "pending",
    chainId: DEPTH3_CHAIN_REGISTRY.LOCATION_SOCIAL.id,
    payload: { networkType: "housing_move", fromHomeId, toHomeId },
  });
  return true;
}

// High-signal NPC-to-NPC information transfer; memories are the canonical knowledge trace.
export function transferNpcInformation(state, { category = "milestone", subjectPersonId, sourcePersonId, targetPersonId, milestoneId, text } = {}) {
  const source = getPerson(state, sourcePersonId);
  const target = getPerson(state, targetPersonId);
  if (!source || !target || sourcePersonId === targetPersonId) return false;
  if (category !== "milestone") return false;
  const subject = getPerson(state, subjectPersonId);
  const milestone = subject?.lifeMilestones?.find((item) => item.id === milestoneId);
  if (!milestone || (source.id !== subject.id && !canNpcReactToInformation(state, source.id, category, subject.id, milestoneId))) return false;
  if (canNpcReactToInformation(state, target.id, category, subject.id, milestoneId)) return false;
  addNpcMemory(state, targetPersonId, milestone.text, "information_received", { category, subjectPersonId, sourcePersonId, milestoneId });
  return true;
}

export function canNpcReactToInformation(state, targetPersonId, category, subjectPersonId, milestoneId) {
  const target = getPerson(state, targetPersonId);
  return Boolean(target?.memories?.some((memory) => memory.type === "information_received" && memory.metadata?.category === category && memory.metadata?.subjectPersonId === subjectPersonId && (!milestoneId || memory.metadata?.milestoneId === milestoneId)));
}
