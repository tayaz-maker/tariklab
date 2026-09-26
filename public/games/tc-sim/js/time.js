import { processLifetimeWeek } from "./lifetime.js?v=10";
import {
  needsParentCare,
  canRequestParentPlanning,
  requestParentPlanning,
  requestCareBudget,
  parentingOvertimeBlocked,
  processParenthoodWeek,
  parenthoodYearSummary,
} from "./parenthood.js?v=10";
import { getHouseholdSummary } from "./household.js?v=10";
import {
  WEEKS_PER_MONTH,
  MONTHS_PER_YEAR,
  addMemory,
  addNpcMemory,
  addYearHistory,
  adjustTendency,
  adjustHealth,
  assertValidState,
  getWeeklyActivityLimit,
  isCriticalHealth,
  transact,
  updateRelationship,
} from "./state.js?v=10";
import { applyRelationshipDelta, markMeaningfulContact } from "./social.js?v=10";
import { activateNextEvent, enqueueEvent, processDueOpenCases, hasEligiblePoolEvent } from "./events.js?v=10";
import { attachLifeDossier, processLifeDepthWeek, recordLifeDecision } from "./life-depth.js?v=10";
import { decorateLifeDossier, processLifeContentWeek, pickLifeContentOrganic, shouldOfferLifeContent, takeDueLifeContent } from "./life-content.js?v=10";
import { applyWeeklyLifeLoad, getMonthlySummary } from "./life.js?v=10";
import { processWealthMonthEnd, processOwnedBenefits, processCashShortfall, netWorth } from "./wealth.js?v=10";
import { advanceComparisonCircle, expireMilitaryObligation } from "./depth2-systems.js?v=10";
import {
  getReputationContext,
  processNpcMilestones,
  syncPeerMilestones,
  updatePerceivedIdentity,
} from "./depth3-systems.js?v=10";
import { processLongTermBody, getBodyYearSummary, getHealthPriorityReflection } from "./body-systems.js?v=10";
import { processNetworkWeek } from "./network.js?v=10";
import { acknowledgeBodyWarning, manageBodyCondition } from "./body-systems.js?v=10";
import { processScenarioWeek } from "./historical-scenarios.js?v=10";

import { getPlayerVisibleOpenCases } from "./calendar.js?v=10";

/** Ek mesai: ilk haftalar tam öder, aralıksız sürdükçe getirisi düşer ve yükü artar. */
export const OVERTIME_BASE_PAY = 1250;
export const OVERTIME_FREE_WEEKS = 2;
const OVERTIME_MIN_PAY_RATIO = 0.5;
const OVERTIME_BASE_STRESS = 12;
const OVERTIME_MAX_STRESS = 20;

/** `streak`, kesintisiz geçmiş mesai haftası sayısıdır (bu hafta dahil değil). */
export function getOvertimePay(streak = 0) {
  const extra = Math.max(0, streak - (OVERTIME_FREE_WEEKS - 1));
  const ratio = Math.max(OVERTIME_MIN_PAY_RATIO, 1 - extra * 0.2);
  return Math.round(OVERTIME_BASE_PAY * ratio);
}

export function getOvertimeStress(streak = 0) {
  const extra = Math.max(0, streak - (OVERTIME_FREE_WEEKS - 1));
  return Math.min(OVERTIME_MAX_STRESS, OVERTIME_BASE_STRESS + extra * 2);
}

/** Dinlenme: yüksek stres altında toparlanma zayıflar. Stresin ayrı bir işi olur. */
export const REST_BASE_ENERGY = 22;
export function getRestEnergyGain(stress) {
  if (stress >= 80) return 10;
  if (stress >= 60) return 15;
  return REST_BASE_ENERGY;
}

export const DECISIONS = [
  {
    id: "parent-plan",
    title: "Çocuk niyetini yeniden görüş",
    detail: "Bir aktivite · gelecek hafta niyetleri yeniden konuş",
    contextual: canRequestParentPlanning,
    apply: requestParentPlanning,
  },
  {
    id: "parent-budget",
    title: "Bakım bütçesini planla",
    detail: "Bir aktivite · gelecek hafta bakım düzenini seç",
    contextual: (s) =>
      needsParentCare(s) &&
      !s.openCases.some(
        (c) =>
          c.type === "parenting-followup" && c.payload.kind === "budget" && c.status !== "resolved",
      ),
    apply: requestCareBudget,
  },
  {
    id: "parent-care",
    title: "Çocuğunun bakımına zaman ayır",
    detail: "Bir aktivite · bu haftanın bakım sorumluluğunu karşılar",
    contextual: needsParentCare,
    apply() {},
  },
  {
    id: "overtime",
    title: "Ek mesai yap",
    detail: "+₺1.250 · enerji −16 · stres +12 · aralıksız sürerse azalır",
    // Ek mesai bir işin uzantısıdır: iş yoksa mesai de yoktur.
    contextual: (state) => state.career.jobId !== null,
    apply(state) {
      const streak = state.flags.overtimeStreak || 0;
      transact(state, getOvertimePay(streak), "Ek mesai", "work");
      adjustHealth(state, { energy: -16, stress: getOvertimeStress(streak) });
      state.flags.overtimeStreak = streak + 1;
      state.flags.overtimeLastWeek = state.time.absoluteWeek;
      adjustTendency(state, "risk", 1);
      adjustTendency(state, "discipline", 1);
    },
  },
  {
    id: "family",
    title: "Aileyle vakit geçir",
    detail: "anne ilişkisi +8 · stres −6",
    contextual: (state) => state.relationships.anne < 96,
    apply(state) {
      updateRelationship(state, "anne", 8);
      applyRelationshipDelta(state, "anne", { trust: 2, tension: -3 });
      markMeaningfulContact(state, "anne");
      adjustHealth(state, { energy: -5, stress: -6 });
      addMemory(state, "Ailenle sakin bir hafta geçirdin.");
      addNpcMemory(state, "anne", "Bu hafta benimle vakit geçirdi.");
      adjustTendency(state, "sociability", 1);
    },
  },
  {
    id: "friend",
    title: "Mehmet'le buluş",
    detail: "₺250 · ilişki +7 · enerji −8",
    contextual: (state) => state.relationships.mehmet < 96 && state.finances.balance >= 250,
    apply(state) {
      transact(state, -250, "Arkadaş buluşması", "social");
      updateRelationship(state, "mehmet", 7);
      applyRelationshipDelta(state, "mehmet", { trust: 2, tension: -2 });
      markMeaningfulContact(state, "mehmet");
      adjustHealth(state, { energy: -8, stress: -5 });
      addNpcMemory(state, "mehmet", "Bu hafta birlikte vakit geçirdik.");
    },
  },
  {
    id: "rest",
    title: "Dinlen",
    detail: "enerji +22 · stres −12 · stres yüksekken daha az toparlar",
    apply(state) {
      adjustHealth(state, { energy: getRestEnergyGain(state.health.stress), stress: -12 });
      adjustTendency(state, "discipline", 1);
    },
  },
  {
    id: "body-care",
    title: "Bedenine bakım ayır",
    detail: "₺300 · birikmiş yükü yönetmeye başla",
    minimumBalance: 300,
    contextual: (state) =>
      Boolean(
        state.body?.warningAvailable ||
        state.body?.conditions?.some(
          (item) => item.knownToPlayer && ["active", "chronic"].includes(item.status),
        ),
      ),
    apply(state) {
      transact(state, -300, "Beden bakımı", "health");
      if (state.body?.warningAvailable) acknowledgeBodyWarning(state);
      manageBodyCondition(state);
      adjustHealth(state, { energy: 8, stress: -8 });
    },
  },
  {
    id: "exercise",
    title: "Spor yap",
    detail: "₺150 · sağlık +4 · stres −8",
    apply(state) {
      transact(state, -150, "Spor gideri", "health");
      adjustHealth(state, { energy: -8, stress: -8, health: 4 });
      adjustTendency(state, "discipline", 1);
    },
  },
  {
    id: "help-friend",
    title: "Mehmet'in başvurusuna yardım et",
    detail: "geçmişte hatırlanır · ilişki +6",
    onceFlag: "helpedFriend",
    contextual: (state) => !state.flags.helpedFriend && state.relationships.mehmet >= 40,
    apply(state) {
      state.flags.helpedFriend = true;
      state.flags.helpedFriendWeek = state.time.absoluteWeek;
      updateRelationship(state, "mehmet", 6);
      applyRelationshipDelta(state, "mehmet", { trust: 6, tension: -2 });
      markMeaningfulContact(state, "mehmet");
      addMemory(state, "Mehmet'in iş başvurusuna yardım ettin.", "important");
      addNpcMemory(state, "mehmet", "İş başvurumda bana yardım etti.", "helped");
    },
  },
  {
    id: "lend-friend",
    title: "Mehmet'e borç ver",
    detail: "₺1.500 şimdi gider · 4 hafta sonra döner",
    onceFlag: "loanedToMehmet",
    minimumBalance: 1500,
    contextual: (state) =>
      !state.flags.loanedToMehmet &&
      state.finances.balance >= 1500 &&
      state.relationships.mehmet >= 45,
    apply(state) {
      transact(state, -1500, "Mehmet'e verilen borç", "social");
      state.flags.loanedToMehmet = true;
      state.openCases.push({
        id: `loan-${state.time.absoluteWeek}`,
        type: "friend-loan",
        createdWeek: state.time.absoluteWeek,
        dueWeek: state.time.absoluteWeek + 4,
        eventId: "loan_repayment",
        status: "pending",
      });
      addMemory(state, "Mehmet'e ₺1.500 borç verdin.", "important");
    },
  },
  {
    id: "quiet-evening",
    title: "Sakin bir akşam geçir",
    detail: "enerji +10 · stres −4",
    contextual: (state) => state.health.energy <= 50,
    apply(state) {
      adjustHealth(state, { energy: 10, stress: -4 });
      adjustTendency(state, "frugality", 1);
    },
  },
  {
    id: "reset-routine",
    title: "Temponu düzenle",
    detail: "enerji +4 · stres −10",
    contextual: (state) => state.health.stress >= 50,
    apply(state) {
      adjustHealth(state, { energy: 4, stress: -10 });
      adjustTendency(state, "discipline", 1);
    },
  },
  {
    id: "budget-check",
    title: "Bütçeyi gözden geçir",
    detail: "stres −5 · harcama planı kaydı",
    contextual: (state) => state.finances.balance < 3500,
    apply(state) {
      adjustHealth(state, { stress: -5 });
      state.flags.reviewedBudget = state.time.absoluteWeek;
      addMemory(state, "Bütçeni gözden geçirip harcama planı yaptın.");
    },
  },
  {
    id: "job-search",
    title: "İş fırsatlarını araştır",
    detail: "stres −3 · iş arama kaydı",
    contextual: (state) => state.career.jobId === null && !state.career.pendingJob,
    apply(state) {
      adjustHealth(state, { stress: -3 });
      state.flags.searchedForWorkWeek = state.time.absoluteWeek;
      addMemory(state, "Yeni iş fırsatlarını araştırdın.");
    },
  },
  {
    id: "call-anne",
    title: "Aylin'i ara",
    detail: "anne ilişkisi +5 · stres −2",
    contextual: (state) => state.relationships.anne <= 62,
    apply(state) {
      updateRelationship(state, "anne", 5);
      applyRelationshipDelta(state, "anne", { trust: 2, tension: -3 });
      markMeaningfulContact(state, "anne");
      adjustHealth(state, { stress: -2 });
      addMemory(state, "Aylin'i arayıp aranızdaki mesafeyi azalttın.");
      addNpcMemory(state, "anne", "Arayıp halimi hatırımı sordu.");
    },
  },
  {
    id: "reconnect-mehmet",
    title: "Mehmet'e ulaş",
    detail: "Mehmet ilişkisi +5 · enerji −3",
    contextual: (state) => state.relationships.mehmet <= 45,
    apply(state) {
      updateRelationship(state, "mehmet", 5);
      applyRelationshipDelta(state, "mehmet", { trust: 2, tension: -3 });
      markMeaningfulContact(state, "mehmet");
      adjustHealth(state, { energy: -3, stress: -2 });
      addMemory(state, "Mehmet'e ulaşıp aranızdaki sessizliği bozdun.");
      addNpcMemory(state, "mehmet", "Uzun sessizliğin ardından bana ulaştı.");
    },
  },
];

const CORE_DECISION_IDS = new Set(["overtime", "rest", "exercise"]);

export function getAvailableDecisions(state) {
  return DECISIONS.filter((decision) =>
    decision.contextual ? decision.contextual(state) : CORE_DECISION_IDS.has(decision.id),
  );
}

export function canApplyDecision(state, decisionId) {
  if (state.lifetime?.death) return { ok: false, reason: "Bu yaşam tamamlandı." };
  const decision = DECISIONS.find((item) => item.id === decisionId);
  if (!decision) return { ok: false, reason: "Karar bulunamadı." };
  if (decisionId === "parent-plan" && !decision.contextual(state))
    return { ok: false, reason: "Yeni bir niyet görüşmesi için uygun bağlam yok." };
  if (decisionId === "parent-budget" && !decision.contextual(state))
    return { ok: false, reason: "Yeni bir bakım bütçesi görüşmesi için uygun bağlam yok." };
  if (decisionId === "parent-care" && !needsParentCare(state))
    return { ok: false, reason: "Bu bakım döneminde hanende çocuk yok." };
  if (decisionId === "overtime" && state.career.jobId === null)
    return { ok: false, reason: "Ek mesai için aktif bir iş gerekiyor." };
  if (decisionId === "overtime" && parentingOvertimeBlocked(state))
    return {
      ok: false,
      reason: "Biriken bakım sorumluluğu için önce bu haftaya zaman ayırmalısın.",
    };
  if (decisionId === "body-care" && !decision.contextual(state))
    return { ok: false, reason: "Şu anda bakım gerektiren bilinen bir durum yok." };
  if (state.events.active) return { ok: false, reason: "Önce açık olayı sonuçlandır." };
  if (state.weekly.used >= getWeeklyActivityLimit(state))
    return {
      ok: false,
      reason: isCriticalHealth(state)
        ? "Sağlığın kritik; bu hafta yalnız bir şeye gücün yetiyor."
        : "Bu haftanın aktivite hakkı bitti.",
    };
  if (
    decisionId === "overtime" &&
    (isCriticalHealth(state) ||
      state.body?.conditions?.some(
        (c) => c.knownToPlayer && ["active", "chronic"].includes(c.status),
      ))
  )
    return { ok: false, reason: "Bedeninin mevcut kapasitesi bu hafta ek mesaiye uygun değil." };
  if (state.weekly.selectedIds.includes(decisionId))
    return { ok: false, reason: "Aynı aktivite bir haftada iki kez seçilemez." };
  if (decision.onceFlag && state.flags[decision.onceFlag])
    return { ok: false, reason: "Bu karar daha önce verildi." };
  if (decision.minimumBalance && state.finances.balance < decision.minimumBalance)
    return { ok: false, reason: "Yeterli paran yok." };
  return { ok: true, decision };
}

export function applyDecision(state, decisionId) {
  const check = canApplyDecision(state, decisionId);
  if (!check.ok) return check;
  check.decision.apply(state);
  recordLifeDecision(state, decisionId);
  state.flags.depth2Enabled = true;
  state.flags.depth3Enabled = true;
  state.weekly.used += 1;
  state.weekly.selectedIds.push(decisionId);
  state.flags.lastDecisionId = decisionId;
  activateNextEvent(state);
  assertValidState(state);
  return { ok: true, message: `${check.decision.title} uygulandı.` };
}

function processMonthEnd(state) {
  const summary = getMonthlySummary(state, { closingMonth: true });
  if (summary.salary) transact(state, summary.salary, "Aylık maaş", "income");
  if (summary.retirementIncome)
    transact(state, summary.retirementIncome, "Aylık emeklilik geliri", "income");
  if (summary.otherIncome) transact(state, summary.otherIncome, "Diğer düzenli gelir", "income");
  transact(state, -summary.housing, "Aylık konut gideri", "housing");
  if (summary.otherExpenses)
    transact(state, -summary.otherExpenses, "Diğer düzenli gider", "expense");
  if (summary.parenting)
    transact(state, -summary.parenting, "Aylık çocuk ve bakım gideri", "parenting");
  state.parenthood.careOwedThisMonth = 0;
  // Ay içinde tek hafta bile ilerleme olduysa tam aylık ücret alınır; eğitimi
  // bırakmak o ayın borcunu silmez. Ay başına tam bir kez.
  if (summary.tuition) {
    transact(state, -summary.tuition, "Eğitim ücreti", "education");
    state.education.tuitionOwedThisMonth = 0;
  }
  processWealthMonthEnd(state);
  processCashShortfall(state);
  return `Ay sonu: ₺${summary.income.toLocaleString("tr-TR")} gelir, ₺${summary.expenses.toLocaleString("tr-TR")} gider işlendi.`;
}

function closeYear(state, endedYear) {
  const yearMemories = state.memories.filter((memory) => memory.year === endedYear);
  const yearStartWeek = (endedYear - (state.meta.startYear || 2027)) * 48 + 1;
  const yearEndWeek = yearStartWeek + 47;
  const yearEvents = state.events.history.filter(
    (entry) => entry.week >= yearStartWeek && entry.week <= yearEndWeek,
  );
  const careerMilestones = (state.career.history || [])
    .filter((entry) => entry.week >= yearStartWeek && entry.week <= yearEndWeek)
    .slice(-5)
    .map((entry) => entry.label)
    .filter(Boolean);
  const knownOpenCases = getPlayerVisibleOpenCases(state);
  const knownMilestones = state.people
    .flatMap((person) => (person.knownMilestones || []).map((id) => {
      const milestone = person.lifeMilestones?.find((item) => item.id === id);
      return milestone ? { person: person.name, text: milestone.text } : null;
    }).filter(Boolean))
    .slice(-6);
  const entry = {
    year: endedYear,
    startingBalance: state.meta.yearStartBalance,
    endingBalance: state.finances.balance,
    netWorth: netWorth(state),
    lifestyle: state.wealth?.lifestyle || "modest",
    importantMemories: yearMemories
      .filter((memory) => memory.importance === "important")
      .slice(-8)
      .map((memory) => memory.text),
    relationships: { ...state.relationships },
    career: {
      jobId: state.career.jobId,
      retirementStatus: state.career.retirement?.status || "working",
      retirementIncome: state.career.retirement?.monthlyIncome || 0,
      experience: { ...state.career.jobFamilyExperience },
      performance: state.career.performance,
      milestones: careerMilestones,
    },
    education: {
      level: state.education.level,
      fields: [...state.education.fields],
      activePathId: state.education.active?.pathId || null,
    },
    health: getBodyYearSummary(state),
    housing: {
      homeId: state.household.homeId,
      livingWithFamily: state.household.livingWithFamily,
    },
    parenting: parenthoodYearSummary(state, yearStartWeek, yearEndWeek),
    household: {
      ...getHouseholdSummary(state),
      milestones: (state.household.history || [])
        .filter((item) => item.week >= yearStartWeek && item.week <= yearEndWeek)
        .map((item) => item.text)
        .slice(-6),
    },
    knownObligations: knownOpenCases.length,
    meaningfulEvents: yearEvents.length,
    priorities: [...(state.yearlyPlan?.priorities || [])],
    priorityReflection: reflectYearPriorities(state, state.yearlyPlan?.priorities || []),
    livingWorld: {
      knownMilestones,
      favorsResolved: (state.favors || []).filter(
        (favor) =>
          favor.status === "resolved" &&
          favor.resolvedWeek >= yearStartWeek &&
          favor.resolvedWeek <= yearEndWeek,
      ).length,
      reputation: Object.fromEntries(
        ["family", "professional", "friends", "acquaintances"].map((circle) => [
          circle,
          getReputationContext(state, circle).label,
        ]),
      ),
    },
  };
  addYearHistory(state, entry);
  state.meta.yearStartBalance = state.finances.balance;
  state.meta.yearStartHealth = { ...state.health };
  state.meta.yearStartRelationships = { ...state.relationships };
  addMemory(
    state,
    `${endedYear} yılı tamamlandı. Yıl sonu bakiyesi ₺${state.finances.balance.toLocaleString("tr-TR")}.`,
    "important",
  );
  return entry;
}

function reflectYearPriorities(state, priorities) {
  return priorities.map((priority) => {
    if (priority === "career")
      return state.career.history?.some((entry) => entry.year === state.time.year)
        ? "Kariyerinde bir hareketlilik oldu."
        : "Kariyerin bu yıl aynı tempoda kaldı.";
    if (priority === "education")
      return state.education.active || state.education.level !== "lise"
        ? "Eğitim hayatında ilerleme kaydettin."
        : "Eğitim bu yıl gündeminin gerisinde kaldı.";
    if (priority === "money")
      return state.finances.balance >= state.meta.yearStartBalance
        ? "Birikimini korudun veya artırdın."
        : "Para hedefin beklenenden daha zor geçti.";
    if (priority === "health") return getHealthPriorityReflection(state);
    if (priority === "relationship")
      return Object.values(state.relationships).some((value) => value >= 70)
        ? "Önemli ilişkilerine zaman ayırdın."
        : "İlişkiler bu yıl daha fazla emek istedi.";
    if (priority === "independence")
      return state.household.homeId !== "family"
        ? "Kendi yaşam alanını kurdun."
        : "Bağımsızlık planın bu yıl tamamlanmadı.";
    return "Bu öncelik için yıl içinde yeterli kayıt oluşmadı.";
  });
}

export function advanceWeek(state) {
  if (state.lifetime?.death)
    return { ok: false, messages: ["Bu yaşam tamamlandı; yaşam raporuna geç."] };
  if (state.world?.scenario?.completed)
    return { ok: false, messages: ["1 Ocak 2026 sonucuna ulaştın; bu tarihsel rota tamamlandı."] };
  if (state.world?.scenario?.pendingEvent)
    return { ok: false, messages: ["Önce dönem kararını ver."] };
  if (state.events.active) return { ok: false, messages: ["Önce açık olayı sonuçlandır."] };
  const messages = [];
  const previousYear = state.time.year;
  const workedOvertime = state.flags.overtimeLastWeek === state.time.absoluteWeek;

  processParenthoodWeek(state);
  applyWeeklyLifeLoad(state);
  processLongTermBody(state, { decisionIds: state.weekly.selectedIds });

  state.time.absoluteWeek += 1;
  messages.push(...processScenarioWeek(state));
  if (Number.isInteger(state.lifetime?.bornWeek))
    state.player.age = Math.floor((state.time.absoluteWeek - state.lifetime.bornWeek) / 48);
  state.time.weekOfMonth += 1;
  if (state.time.weekOfMonth > WEEKS_PER_MONTH) {
    state.time.weekOfMonth = 1;
    state.time.month += 1;
    messages.push(processMonthEnd(state));
    if (state.time.month > MONTHS_PER_YEAR) {
      state.time.month = 1;
      state.time.year += 1;
      if (!Number.isInteger(state.lifetime?.bornWeek)) state.player.age += 1;
      closeYear(state, previousYear);
      state.yearlyPlan = { year: state.time.year, priorities: [], progress: {} };
      messages.push(`${previousYear} yılı tamamlandı; yaşın ${state.player.age} oldu.`);
    }
  }
  // Olay veya haftalık karar ay kapanışını beklemeden tabanın altına indirdiyse
  // aynı güvenli temerrüt dönüşümünü uygula. Ay sonunda ikinci çağrı no-op'tur.
  processCashShortfall(state);

  state.weekly = { used: 0, selectedIds: [] };
  if (!workedOvertime) state.flags.overtimeStreak = 0;
  const ageRecovery =
    state.player.age < 45 ? 7 : state.player.age < 55 ? 6 : state.player.age < 65 ? 5 : 4;
  const highStressHealth = state.health.stress >= 80 ? (state.player.age >= 55 ? -3 : -2) : 0;
  adjustHealth(state, { energy: ageRecovery, stress: -2, health: highStressHealth });
  processOwnedBenefits(state);
  processLifeContentWeek(state);
  for (const eventId of processLifeDepthWeek(state)) enqueueEvent(state, eventId);
  processLifetimeWeek(state);
  if (state.lifetime?.death) {
    attachLifeDossier(state);
    decorateLifeDossier(state);
    assertValidState(state);
    return { ok: true, messages: ["Yaşam tamamlandı. Yaşam raporu hazır."] };
  }
  processDueOpenCases(state);
  advanceComparisonCircle(state);
  processNpcMilestones(state);
  processNetworkWeek(state);
  syncPeerMilestones(state);
  expireMilitaryObligation(state);
  updatePerceivedIdentity(state);
  let contentId = null;
  if (!state.events.queue.length && !state.events.active) {
    contentId = takeDueLifeContent(state);
    if (!contentId && (shouldOfferLifeContent(state) || !hasEligiblePoolEvent(state))) contentId = pickLifeContentOrganic(state);
  }
  if (contentId) enqueueEvent(state, contentId);
  activateNextEvent(state);
  assertValidState(state);
  return { ok: true, messages: messages.length ? messages : ["Yeni hafta başladı."] };
}
