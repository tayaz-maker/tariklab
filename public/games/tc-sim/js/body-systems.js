import { appendCapped, addMemory } from "./state.js?v=10";
import { isDetained } from "./risk-layer.js?v=10";

const MAX_CONDITIONS = 8;
const EXPOSURES = ["overwork", "underRecovery", "inactivity"];
const STATUS_TEXT = { active: "devam ediyor", managed: "yönetiliyor", resolved: "geride kaldı", chronic: "uzun dönem takip gerektiriyor" };
const CONDITION_NAMES = { "persistent-fatigue": "Uzun süren yorgunluk", "recovery-strain": "Toparlanma güçlüğü", "physical-sluggishness": "Hareketsizliğin etkisi" };
export const HEALTH_CHAIN_REGISTRY = Object.freeze({
  CHN_H01: Object.freeze({ id: "CHN-H01", domain: "overload", warning: "health_overload_review", followup: "health_overload_outcome" }),
  CHN_H02: Object.freeze({ id: "CHN-H02", domain: "recovery", warning: "health_recovery_review", followup: "health_recovery_outcome" }),
  CHN_H03: Object.freeze({ id: "CHN-H03", domain: "inactivity", warning: "health_inactivity_review", followup: "health_inactivity_outcome" }),
  CHN_H04: Object.freeze({ id: "CHN-H04", domain: "support-disclosure", warning: "health_support_disclosure", followup: "health_support_callback" }),
});

export function scheduleHealthChain(state, chainId, eventId, dueWeeks = 4, payload = {}) {
  const chain = Object.values(HEALTH_CHAIN_REGISTRY).find((item) => item.id === chainId);
  if (!chain || ![chain.warning, chain.followup].includes(eventId)) return false;
  if (state.openCases.some((item) => item.chainId === chainId && item.status !== "resolved")) return false;
  const stage = eventId === chain.warning ? "warning" : "reassessment";
  const id = `health-${chainId}-${stage}-${state.time.absoluteWeek}`;
  if (state.openCases.some((item) => item.id === id)) return false;
  state.openCases.push({ id, chainId, type: "health-followup", createdWeek: state.time.absoluteWeek, dueWeek: state.time.absoluteWeek + dueWeeks, eventId, status: "pending", payload: { ...payload, stage } });
  return true;
}

export function ensureBodyState(state) {
  state.body ||= {};
  state.body.exposures ||= {};
  for (const key of EXPOSURES) {
    const value = Number(state.body.exposures[key]);
    state.body.exposures[key] = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  }
  const ids = new Set();
  // Eski kayıtlarda aynı durum yeniden eklenmiş olabilir; son sonuç korunur.
  state.body.conditions = [...(Array.isArray(state.body.conditions) ? state.body.conditions : [])].reverse().filter((item) => {
    if (!item?.id || ids.has(item.id) || !Object.hasOwn(STATUS_TEXT, item.status)) return false;
    ids.add(item.id);
    item.knownToPlayer = item.knownToPlayer === true;
    return true;
  }).reverse().slice(-MAX_CONDITIONS);
  state.body.warningAcknowledged = Boolean(state.body.warningAcknowledged);
  return state.body;
}

export function recordBodyExposure(state, kind, amount = 1) {
  ensureBodyState(state);
  if (!EXPOSURES.includes(kind)) return false;
  state.body.exposures[kind] = Math.max(0, Math.min(100, state.body.exposures[kind] + amount));
  return true;
}

function conditionRisk(state, id) {
  const e = state.body.exposures;
  if (id === "persistent-fatigue") return e.overwork >= 70 && e.underRecovery >= 55;
  if (id === "recovery-strain") return e.underRecovery >= 70;
  return e.inactivity >= 70;
}

function conditionImproved(state, id) {
  const e = state.body.exposures;
  if (id === "persistent-fatigue") return e.overwork < 45 && e.underRecovery < 45;
  return id === "recovery-strain" ? e.underRecovery < 45 : e.inactivity < 45;
}

export function reassessBodyCondition(state, chainId) {
  ensureBodyState(state);
  const id = chainId === "CHN-H03" ? "physical-sluggishness" : conditionRisk(state, "persistent-fatigue") ? "persistent-fatigue" : "recovery-strain";
  if (!state.body.warningAcknowledged || (chainId === "CHN-H01" && id !== "persistent-fatigue") || !conditionRisk(state, id)) return false;
  const previous = state.body.conditions.find((item) => item.id === id);
  if (previous && previous.status !== "resolved") return false;
  const week = state.time.absoluteWeek;
  const condition = previous || { id, category: id === "physical-sluggishness" ? "activity" : "recovery", severity: "moderate", createdWeek: week };
  Object.assign(condition, { status: previous?.managedWeek != null ? "chronic" : "active", knownToPlayer: true, lastUpdateWeek: week, recoveryWeeks: 0, relapseWeeks: 0 });
  delete condition.resolvedWeek;
  if (!previous) appendCapped(state.body.conditions, condition, MAX_CONDITIONS);
  addMemory(state, `${CONDITION_NAMES[id]} günlük temponu etkiliyor. Bakım ve sürdürülebilir toparlanma gerekiyor.`, "important");
  return true;
}

export function processLongTermBody(state, { decisionIds, decisionId = null } = {}) {
  ensureBodyState(state);
  const week = state.time.absoluteWeek;
  // Yalnız sağlık dosyalarını temizle; başka sistemlerin geçmişini kesme.
  state.openCases = state.openCases.filter((item) => item.type !== "health-followup" || (item.status !== "resolved" && week <= item.dueWeek + 8));
  const decisions = decisionIds || (decisionId ? [decisionId] : []);
  const has = (id) => decisions.includes(id);
  const exposure = state.body.exposures;
  const load = state.career?.jobId && !isDetained(state) ? 1 : 0;
  recordBodyExposure(state, "overwork", has("overtime") || (load && state.health.stress >= 78) ? 2 + load : -1);
  recordBodyExposure(state, "underRecovery", has("rest") || state.health.energy >= 70 ? -2 : state.health.energy < 40 ? 1 : 0);
  recordBodyExposure(state, "inactivity", ["friend", "family", "partner", "exercise"].some(has) ? -1 : 1);
  const warning = exposure.overwork >= 45 || exposure.underRecovery >= 45 || exposure.inactivity >= 60;
  if (warning && !state.body.warningAcknowledged) state.body.warningAvailable = true;
  const triggers = [exposure.overwork >= 45, exposure.underRecovery >= 45, exposure.inactivity >= 60];
  Object.values(HEALTH_CHAIN_REGISTRY).slice(0, 3).forEach((chain, index) => {
    if (triggers[index] && week >= (state.events.cooldowns[chain.warning] || 0)) scheduleHealthChain(state, chain.id, chain.warning, 1);
  });
  for (const condition of state.body.conditions) {
    if (condition.status !== "managed") continue;
    condition.recoveryWeeks = conditionImproved(state, condition.id) ? Math.min(4, (condition.recoveryWeeks || 0) + 1) : 0;
    if (condition.recoveryWeeks > 0) condition.improvedSinceCare = true;
    condition.relapseWeeks = condition.improvedSinceCare && conditionRisk(state, condition.id) ? Math.min(4, (condition.relapseWeeks || 0) + 1) : 0;
    if (condition.recoveryWeeks >= 4) {
      condition.status = "resolved";
      condition.resolvedWeek = week;
      addMemory(state, `${CONDITION_NAMES[condition.id] || "Bilinen beden durumu"} bakım ve düzenli toparlanmayla geride kaldı.`, "important");
    } else if (condition.relapseWeeks >= 4) {
      condition.status = "chronic";
      addMemory(state, "Toparlanmanın ardından yeniden biriken yük, uzun dönem takip gerektiriyor.", "important");
    }
    condition.lastUpdateWeek = week;
  }
  return state.body;
}

export function acknowledgeBodyWarning(state) { ensureBodyState(state); state.body.warningAcknowledged = true; state.body.warningAvailable = false; return true; }
export function manageBodyCondition(state) {
  ensureBodyState(state);
  const condition = state.body.conditions.find((item) => item.knownToPlayer && ["active", "chronic"].includes(item.status));
  if (!condition) return false;
  Object.assign(condition, { status: "managed", managedWeek: state.time.absoluteWeek, lastUpdateWeek: state.time.absoluteWeek, recoveryWeeks: 0, relapseWeeks: 0, improvedSinceCare: false });
  return true;
}

export function getKnownBodyConditions(state, includeResolved = false) {
  return (state.body?.conditions || []).filter((item) => item.knownToPlayer && Object.hasOwn(STATUS_TEXT, item.status) && (includeResolved || item.status !== "resolved"))
    .map((item) => ({ name: CONDITION_NAMES[item.id] || "Bilinen beden durumu", status: item.status, outcome: STATUS_TEXT[item.status] }));
}

export function getBodyYearSummary(state) {
  return { ...state.health, start: state.meta.yearStartHealth ? { ...state.meta.yearStartHealth } : null, end: { ...state.health }, conditions: getKnownBodyConditions(state, true) };
}

export function getHealthPriorityReflection(state) {
  const unresolved = getKnownBodyConditions(state).some((item) => ["active", "chronic"].includes(item.status));
  const start = state.meta.yearStartHealth?.health;
  return !unresolved && state.health.health >= (start ?? 60) && state.health.stress < 65
    ? "Sağlık önceliğinle uyumlu bir yıl: bedenini korudun, toparlanmaya alan açtın."
    : "Sağlığı öncelik seçtin; yıl sonundaki beden durumu bu hedefin gerisinde kaldı.";
}

export function getBodyRiskSummary(state) {
  if (state.body?.warningAvailable) return "Bedenindeki birikmiş yük için toparlanma uyarısı var.";
  if (getKnownBodyConditions(state).length) return "Bilinen beden durumun için toparlanmaya alan açman gerekebilir.";
  return "Bedenindeki uzun vadeli yük şu an yönetilebilir düzeyde.";
}

export function getBodyCareContext(state) {
  return Number(state.player?.tendencies?.discipline ?? 50) >= 67
    ? "Planlı ilerlemeyi seviyorsun: dinlenme ve hareket için haftanda yer belirleyebilirsin."
    : "Toparlanmak için haftandaki bir işi ertelemeyi düşünebilirsin.";
}
