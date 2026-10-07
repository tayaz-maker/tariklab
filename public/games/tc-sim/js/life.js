import { parenthoodCosts } from "./parenthood.js?v=10";
import { getHouseholdFinance } from "./household.js?v=10";
import {
  addCareerHistory,
  addMemory,
  adjustHealth,
  getWeeklyActivityLimit,
  isCriticalHealth,
  transact,
} from "./state.js?v=10";
import { getCommuteLoad, getHomeById, getJobById } from "./catalog.js?v=10";
import { getWealthMonthlySummary } from "./wealth.js?v=10";
import {
  getEducationWeeklyLoad,
  getPathById,
  getWeeklyProgressGain,
  isEligibleForJob,
  resolveCompletedLevel,
} from "./education.js?v=10";
import { applySocialMaintenance } from "./social.js?v=10";
import { scheduleMoveConsequence } from "./depth3-systems.js?v=10";

export { HOMES, JOBS, getCommuteLoad, getHomeById, getJobById } from "./catalog.js?v=10";

export function getEffectiveCommuteLoad(state) {
  const raw = getCommuteLoad(state.household.homeId, state.career.jobId);
  return state.wealth?.vehicle ? Math.max(0, raw - 1) : raw;
}

export function getWeeklyLifeLoad(state) {
  const job = getJobById(state.career.jobId);
  const commute = getEffectiveCommuteLoad(state);
  const education = getEducationWeeklyLoad(state);
  const reduced = state.flags?.lateCareerReducedLoadUntil > state.time.absoluteWeek;
  return {
    commute,
    education,
    load: Math.max(0, (job?.load || 0) - (reduced ? 1 : 0)) + commute + education.load,
    energy: (job?.energy || 0) + (reduced && job ? 2 : 0) - commute * 2 + education.energy,
    stress: Math.max(0, (job?.stress || 0) - (reduced ? 2 : 0)) + commute * 2 + education.stress,
  };
}

export function getCommuteExplanation(homeId, jobId, state = null) {
  if (jobId === null)
    return {
      label: "İşsiz — ulaşım yükü yok",
      detail: "Aktif iş olmadığı için haftalık ulaşım etkisi yok.",
      energy: 0,
      stress: 0,
    };
  const rawLoad = getCommuteLoad(homeId, jobId);
  const load = state?.wealth?.vehicle ? Math.max(0, rawLoad - 1) : rawLoad;
  const labels = ["Çok düşük", "Düşük", "Orta", "Yüksek"];
  const label = labels[Math.min(load, labels.length - 1)];
  return {
    label,
    detail:
      load === 0
        ? "Ev ve iş yakın; haftalık ek ulaşım yükü yok."
        : `Haftalık etki: ${-load * 2} enerji · +${load * 2} stres${state?.wealth?.vehicle && rawLoad > load ? " · araç ulaşım yükünü azalttı" : ""}`,
    energy: -load * 2,
    stress: load * 2,
  };
}

export const PRIVACY_CONTEXT =
  "Mahremiyet şu an doğrudan stat değiştirmez; ileride aile, partner ve sosyal olaylarda bağlam sağlar.";

export const getMonthlyEmploymentIncome = (state) => getJobById(state.career.jobId)?.salary || 0;
export function getCostOfLivingIndex(state) {
  const years = Math.max(0, (state.time?.year || 2027) - (state.meta?.startYear || state.time?.year || 2027));
  return Math.min(1.5, 1 + years * 0.04);
}

export function getLateLifeCostFactor(state) {
  // 18–35'in kabul edilmiş 1.5 tavanını değiştirmeden, 36'dan sonra temel
  // yaşam giderine çok daha yavaş ve sınırlı bir devam uygular.
  const age = Number(state?.player?.age) || 18;
  return age <= 35 ? 1 : Math.min(1.2, 1 + (age - 35) * 0.006);
}

export function getPlayerLifeStage(state) {
  const age = Number(state?.player?.age) || 18;
  if (age < 36) return { id: "young_adult", label: "Genç yetişkinlik" };
  if (age < 45) return { id: "mid_career", label: "Orta kariyer" };
  if (age < 55) return { id: "midlife", label: "Orta yaşam" };
  if (age < 65) return { id: "late_career", label: "Geç kariyer" };
  return { id: "retirement_transition", label: "Emeklilik dönemi" };
}

export function getRetirementEligibility(state) {
  const age = Number(state?.player?.age) || 0;
  const experienceWeeks = Object.values(state?.career?.jobFamilyExperience || {}).reduce(
    (sum, weeks) => sum + (Number.isFinite(weeks) ? weeks : 0),
    0,
  );
  const eligible =
    state?.career?.retirement?.status !== "retired" &&
    ((age >= 60 && experienceWeeks >= 480) || (age >= 65 && experienceWeeks >= 240));
  return {
    eligible,
    age,
    experienceWeeks,
    reason: eligible
      ? "TC SIM'in soyut yaş ve çalışma geçmişi koşullarını karşılıyorsun."
      : age < 60
        ? "Emeklilik değerlendirmesi 60 yaşından sonra açılır."
        : "Emeklilik için yeterli çalışma geçmişi henüz oluşmadı.",
  };
}

export function getRetirementIncomePreview(state) {
  const current = getJobById(state?.career?.jobId);
  const last = getJobById(state?.career?.retirement?.lastJobId);
  const salary = current?.salary || last?.salary || 9000;
  const weeks = Object.values(state?.career?.jobFamilyExperience || {}).reduce(
    (sum, value) => sum + (Number.isFinite(value) ? value : 0),
    0,
  );
  const serviceFactor = Math.min(0.65, 0.48 + Math.floor(weeks / 520) * 0.03);
  return Math.min(12500, Math.max(4800, Math.round((salary * serviceFactor) / 100) * 100));
}

export function retireCareer(state) {
  if (state.lifetime?.death) return { ok: false, reason: "Bu yaşam tamamlandı." };
  const eligibility = getRetirementEligibility(state);
  if (!eligibility.eligible) return { ok: false, reason: eligibility.reason };
  const job = getJobById(state.career.jobId);
  if (!job) return { ok: false, reason: "Emeklilik geçişi için aktif bir iş gerekiyor." };
  const monthlyIncome = getRetirementIncomePreview(state);
  state.career.retirement = {
    ...state.career.retirement,
    status: "retired",
    retiredWeek: state.time.absoluteWeek,
    deferredUntil: null,
    monthlyIncome,
    lastJobId: job.id,
  };
  state.career.jobId = null;
  state.career.pendingJob = null;
  state.career.weeksInRole = 0;
  state.flags.jobSecurityRisk = null;
  state.flags.jobSecurityRecovery = null;
  state.flags.depth2PromotionPending = null;
  state.flags.overtimeLastWeek = null;
  state.flags.overtimeStreak = 0;
  for (const item of state.openCases || []) {
    if (item.status === "resolved") continue;
    if (
      item.type === "job-start" ||
      (item.type === "depth2-followup" &&
        ["job_security", "career_promotion", "retirement_transition"].includes(item.payload?.kind))
    ) {
      item.status = "resolved";
      item.resolutionApplied = true;
    }
  }
  addCareerHistory(state, {
    type: "retirement",
    jobId: job.id,
    label: `${job.title} işinden emekli oldun.`,
  });
  addMemory(
    state,
    `${job.title} işinden emekli oldun; aylık emeklilik gelirin bağlandı.`,
    "important",
  );
  return { ok: true, monthlyIncome };
}
export function getMonthlyHousingBreakdown(state, options = {}) {
  const home = getHomeById(state.household.homeId);
  const base = home?.monthlyCost || 0;
  const salary = getMonthlyEmploymentIncome(state);
  // Aile yanında yaşamak düşük maliyetli kalır; gelir yükseldikçe ev katkısı da yükselir.
  const familyContribution =
    home?.id === "family" && salary > 10000 ? Math.round((salary - 10000) * 0.2) : 0;
  const shared = getHouseholdFinance(state, options);
  return {
    base,
    familyContribution,
    ...shared,
    total: Math.max(
      0,
      base + familyContribution + shared.householdExtra - shared.partnerContribution,
    ),
  };
}

export const getMonthlyHousingCost = (state) => getMonthlyHousingBreakdown(state).total;
export const hasIndependentHousing = (state) =>
  getHomeById(state.household.homeId)?.id !== "family";
export const hasSavings = (state, amount) =>
  Number.isFinite(amount) &&
  Number.isFinite(state.finances?.balance) &&
  state.finances.balance >= amount;
export const getMoveCost = (homeId) => getHomeById(homeId)?.moveCost ?? Infinity;

const PROMOTION_PATHS = {
  market: "office",
  courier: "technician",
  office: "specialist",
};

export function getNextCareerStep(state) {
  if (state?.career?.retirement?.status === "retired") return null;
  const current = getJobById(state?.career?.jobId);
  const nextId = current ? PROMOTION_PATHS[current.id] : null;
  const next = nextId ? getJobById(nextId) : null;
  if (!next) return null;
  return isEligibleForJob(state, next).ok ? next : null;
}

export function promoteCareer(state) {
  if (state.lifetime?.death) return { ok: false, reason: "Bu yaşam tamamlandı." };
  // Sert kural: işsiz oyuncu terfi edemez. Terfi görüşmesi işten sonra
  // sonuçlansa bile bu kapı kapalıdır.
  if (state?.career?.retirement?.status === "retired")
    return { ok: false, reason: "Emeklilikten sonra normal kariyer terfisi yok." };
  if (state?.career?.jobId === null)
    return { ok: false, reason: "İşsizken üst pozisyona geçilemez." };
  const next = getNextCareerStep(state);
  if (!next) return { ok: false, reason: "Şu an uygun bir üst pozisyon yok." };
  const previous = getJobById(state.career.jobId);
  state.career.jobId = next.id;
  state.career.weeksInRole = 0;
  state.career.performance = Math.max(55, Number(state.career.performance) || 55);
  addCareerHistory(state, {
    type: "promotion",
    fromJobId: previous?.id || null,
    jobId: next.id,
    label: `${next.title} pozisyonuna geçtin.`,
  });
  addMemory(state, `${next.title} pozisyonuna geçtin.`, "important");
  return { ok: true, job: next };
}

/** Performans değerlendirmesinde işin devam etmesi için gereken alt sınır. */
export const CAREER_RISK_PERFORMANCE = 30;

/**
 * Gerçek işsizlik. Yalnız aktif bir iş varken çalışır, geçmişe bir kez yazar;
 * bundan sonra maaş da ek mesai de kapanır.
 */
export function endEmployment(state, { label, type = "involuntary_unemployment" } = {}) {
  const oldJob = getJobById(state?.career?.jobId);
  if (!oldJob) return { ok: false, reason: "Sonlandırılacak aktif iş yok." };
  const text = label || `${oldJob.title} işini kaybettin.`;
  state.career.jobId = null;
  state.career.weeksInRole = 0;
  state.flags.jobSecurityRisk = null;
  state.flags.jobSecurityRecovery = null;
  addCareerHistory(state, { type, jobId: oldJob.id, label: text });
  addMemory(state, text, "important");
  return { ok: true, jobId: oldJob.id };
}

/** Geçici destek tutarının tabanı, tavanı ve adımı. Rastgelelik yok. */
export const MONEY_RELIEF_MIN = 1000;
export const MONEY_RELIEF_MAX = 6000;
export const MONEY_RELIEF_STEP = 500;

/**
 * Destek tutarı gerçek nakit açığından türer: önümüzdeki ayın net yükü
 * (gider − gelir) eksi eldeki para. Açık yoksa destek de yoktur; bu yüzden
 * borçlanmak kalıcı servet üretemez, yalnız o ayı kapatır.
 */
export function getMoneyReliefAmount(state) {
  const summary = getMonthlySummary(state);
  const need = summary.expenses - summary.income - (state.finances?.balance || 0);
  if (!(need > 0)) return 0;
  const stepped = Math.ceil(need / MONEY_RELIEF_STEP) * MONEY_RELIEF_STEP;
  return Math.min(MONEY_RELIEF_MAX, Math.max(MONEY_RELIEF_MIN, stepped));
}

/** Kayıttan gelen tutarı sınırlara oturtur; bozuk kayıt tabana düşer. */
export const clampMoneyReliefAmount = (value) =>
  Number.isFinite(value)
    ? Math.min(MONEY_RELIEF_MAX, Math.max(MONEY_RELIEF_MIN, Math.round(value)))
    : MONEY_RELIEF_MIN;

export function updateCareerProgress(state) {
  const career = state.career;
  if (!career || !getJobById(career.jobId)) return false;
  career.weeksInRole = Number.isInteger(career.weeksInRole) ? career.weeksInRole + 1 : 1;
  const healthyWeek = state.health.health > 40 && state.health.energy >= 35;
  const manageableStress = state.health.stress < 70;
  const bodyPenalty = state.body?.conditions?.some(
    (condition) => condition.knownToPlayer && ["active", "chronic"].includes(condition.status),
  )
    ? 1
    : 0;
  const delta =
    healthyWeek && manageableStress
      ? Math.max(0, 1 - bodyPenalty)
      : state.health.health <= 15 || state.health.stress >= 85
        ? -2
        : 0;
  career.performance = Math.min(100, Math.max(0, career.performance + delta));
  return true;
}

export function getMonthlySummary(state, options = {}) {
  const salary = getMonthlyEmploymentIncome(state);
  const rawHousing = getMonthlyHousingBreakdown(state, options);
  const ownsHome = state.wealth?.properties?.some((property) => property.occupancy === "owner");
  const housingBreakdown = ownsHome
    ? {
        ...rawHousing,
        base: 0,
        total: Math.max(0, rawHousing.total - rawHousing.base),
        ownerOccupied: true,
      }
    : rawHousing;
  const housing = housingBreakdown.total;
  const wealth = getWealthMonthlySummary(state);
  const retirementIncome =
    state.career?.retirement?.status === "retired" ? state.career.retirement.monthlyIncome : 0;
  const otherIncome = state.finances.otherMonthlyIncome;
  const otherExpenses = Math.round(
    state.finances.otherMonthlyExpenses *
      getCostOfLivingIndex(state) *
      getLateLifeCostFactor(state),
  );
  const tuition = state.education?.tuitionOwedThisMonth || 0;
  return {
    salary,
    retirementIncome,
    housing,
    housingBreakdown,
    otherIncome,
    otherExpenses,
    tuition,
    parenting: parenthoodCosts(state, options),
    wealth,
    income: salary + otherIncome + retirementIncome + wealth.income,
    expenses: housing + otherExpenses + tuition + parenthoodCosts(state, options) + wealth.expenses,
  };
}

function canUseWeeklyAction(state, actionId) {
  if (state.lifetime?.death) return { ok: false, reason: "Bu yaşam tamamlandı." };
  if (state.events.active) return { ok: false, reason: "Önce açık olayı sonuçlandır." };
  if (state.weekly.used >= getWeeklyActivityLimit(state))
    return {
      ok: false,
      reason: isCriticalHealth(state)
        ? "Sağlığın kritik; bu hafta yalnız bir şeye gücün yetiyor."
        : "Bu haftanın aktivite hakkı bitti.",
    };
  if (state.weekly.selectedIds.includes(actionId))
    return { ok: false, reason: "Bu işlem bu hafta zaten yapıldı." };
  return { ok: true };
}

function markWeeklyAction(state, actionId) {
  state.weekly.used += 1;
  state.weekly.selectedIds.push(actionId);
}

export function acceptJobOffer(state, jobId) {
  if (state.career?.retirement?.status === "retired")
    return { ok: false, reason: "Emeklilikten sonra normal iş teklifleri kapalı." };
  const job = getJobById(jobId);
  if (!job) return { ok: false, reason: "İş teklifi geçersiz." };
  if (state.career.jobId === jobId) return { ok: false, reason: "Zaten bu işte çalışıyorsun." };
  if (state.career.pendingJob)
    return { ok: false, reason: "Önce bekleyen iş başlangıcı sonuçlanmalı." };
  const eligibility = isEligibleForJob(state, job);
  if (!eligibility.ok) return { ok: false, reason: eligibility.reason };
  const actionId = `job-offer:${jobId}`;
  const check = canUseWeeklyAction(state, actionId);
  if (!check.ok) return check;
  const caseId = `job-start-${state.time.absoluteWeek}-${jobId}`;
  state.career.pendingJob = { jobId, startWeek: state.time.absoluteWeek + 1, caseId };
  state.openCases.push({
    id: caseId,
    type: "job-start",
    createdWeek: state.time.absoluteWeek,
    dueWeek: state.time.absoluteWeek + 1,
    eventId: "job_start",
    status: "pending",
    payload: { jobId },
  });
  markWeeklyAction(state, actionId);
  addCareerHistory(state, {
    type: "offer_accepted",
    jobId,
    label: `${job.title} teklifini kabul ettin.`,
  });
  addMemory(
    state,
    `${job.title} teklifini kabul ettin; başlangıç tarihini bekliyorsun.`,
    "important",
  );
  return { ok: true, message: `${job.title} teklifi kabul edildi. İş gelecek hafta başlayacak.` };
}

export function completePendingJob(state, sourceCaseId) {
  if (state.lifetime?.death) return false;
  const pending = state.career.pendingJob;
  if (!pending || pending.caseId !== sourceCaseId || !getJobById(pending.jobId)) return false;
  state.career.jobId = pending.jobId;
  state.career.pendingJob = null;
  state.career.weeksInRole = 0;
  state.career.performance = Math.max(50, Number(state.career.performance) || 50);
  addCareerHistory(state, {
    type: "job_started",
    jobId: pending.jobId,
    label: `${getJobById(pending.jobId).title} olarak başladın.`,
  });
  addMemory(state, `${getJobById(state.career.jobId).title} olarak işe başladın.`, "important");
  return true;
}

export function quitJob(state) {
  if (state.career.jobId === null) return { ok: false, reason: "Bırakılacak aktif iş yok." };
  if (state.career.pendingJob)
    return { ok: false, reason: "Bekleyen iş teklifi varken mevcut iş bırakılamaz." };
  const check = canUseWeeklyAction(state, "quit-job");
  if (!check.ok) return check;
  const oldJob = getJobById(state.career.jobId);
  state.career.jobId = null;
  state.career.weeksInRole = 0;
  // İstifa, bekleyen iş güvenliği değerlendirmesini konusuz bırakır: olmayan
  // bir işten sonradan çıkarılmak mümkün olmamalı.
  state.flags.jobSecurityRisk = null;
  state.flags.jobSecurityRecovery = null;
  for (const item of state.openCases)
    if (
      item.type === "depth2-followup" &&
      item.status === "pending" &&
      item.payload?.kind === "job_security"
    )
      item.status = "resolved";
  addCareerHistory(state, {
    type: "resigned",
    jobId: oldJob.id,
    label: `${oldJob.title} işinden ayrıldın.`,
  });
  markWeeklyAction(state, "quit-job");
  addMemory(state, `${oldJob.title} işinden ayrıldın.`, "important");
  return { ok: true, message: "İşten ayrıldın; artık işsizsin." };
}

export function moveHome(state, homeId) {
  const home = getHomeById(homeId);
  if (!home) return { ok: false, reason: "Konut seçeneği geçersiz." };
  if (state.household.homeId === homeId) return { ok: false, reason: "Zaten burada yaşıyorsun." };
  const actionId = `move-home:${homeId}`;
  const check = canUseWeeklyAction(state, actionId);
  if (!check.ok) return check;
  const result = relocateHome(state, homeId);
  if (result.ok) markWeeklyAction(state, actionId);
  return result;
}

/** Ortak taşınma işlemi; haftalık karar veya doğrulanmış olay seçimi kullanır. */
export function relocateHome(state, homeId) {
  if (state.lifetime?.death) return { ok: false, reason: "Bu yaşam tamamlandı." };
  const home = getHomeById(homeId);
  if (!home || state.household.homeId === homeId)
    return { ok: false, reason: "Konut değişikliği yok." };
  if (homeId === "family" && state.household.union?.cohabitingSince)
    return { ok: false, reason: "Önce partnerinle ayrı evlerde yaşama kararını konuşmalısın." };
  const previousHomeId = state.household.homeId;
  const cost = getMoveCost(homeId);
  if (state.finances.balance < cost)
    return { ok: false, reason: `Taşınmak için ₺${cost.toLocaleString("tr-TR")} gerekiyor.` };
  transact(state, -cost, `${home.title} taşınma masrafı`, "housing");
  state.household.homeId = homeId;
  state.household.livingWithFamily = homeId === "family";
  addMemory(state, `${home.title} konutuna taşındın.`, "important");
  scheduleMoveConsequence(state, previousHomeId, homeId);
  return { ok: true, message: `${home.title} konutuna taşındın; taşınma maliyeti bir kez ödendi.` };
}

/** Biten haftanın deneyimi. Aktif iş yoksa kredi yok; bir hafta tek aileye yazar. */
function creditWeeklyExperience(state) {
  const job = getJobById(state.career.jobId);
  if (!job?.family) return false;
  // Doğrulanmış her state'te bu harita vardır; tick'in çökmesindense kendini onarır.
  if (!state.career.jobFamilyExperience) state.career.jobFamilyExperience = {};
  const experience = state.career.jobFamilyExperience;
  experience[job.family] = (experience[job.family] || 0) + 1;
  return true;
}

/** Diploma ödülü tick içinde verilir; event yalnız bildirimdir. */
function completeEducation(state, path) {
  const education = state.education;
  education.level = resolveCompletedLevel(education.level, path.grantsLevel);
  if (path.grantsField && !education.fields.includes(path.grantsField))
    education.fields.push(path.grantsField);
  education.active = null;
  state.flags.educationCompletedPending = path.id;
  addMemory(state, `${path.displayName} eğitimini tamamladın.`, "important");
}

function advanceEducationProgress(state) {
  const active = state.education.active;
  if (!active) return false;
  const path = getPathById(active.pathId);
  if (!path) {
    state.education.active = null;
    return false;
  }
  active.progressPoints += getWeeklyProgressGain(active.intensity);
  // O ay doğan borç ay içinde yalnız artabilir: pahalı programı bırakıp ucuza
  // geçerek borcu düşürmek engellenir. Ay sonunda tahsil edilip sıfırlanır.
  state.education.tuitionOwedThisMonth = Math.max(
    state.education.tuitionOwedThisMonth,
    path.monthlyTuition,
  );
  if (active.progressPoints >= path.targetPoints) completeEducation(state, path);
  return true;
}

export function applyWeeklyLifeLoad(state) {
  if (state.lifetime?.death) return;
  const week = state.time.absoluteWeek;
  if (state.flags.lastLifeLoadWeek === week) return false;
  const effects = getWeeklyLifeLoad(state);
  adjustHealth(state, {
    energy: effects.energy,
    stress: effects.stress,
    health: effects.load >= 6 && state.health.stress >= 75 ? -1 : 0,
  });
  state.flags.lastLifeLoadWeek = week;
  creditWeeklyExperience(state);
  updateCareerProgress(state);
  advanceEducationProgress(state);
  applySocialMaintenance(state);
  return true;
}

export function enrollEducation(state, pathId, intensity) {
  if (state.events.active) return { ok: false, reason: "Önce açık olayı sonuçlandır." };
  if (state.education.active) return { ok: false, reason: "Zaten devam eden bir eğitimin var." };
  const path = getPathById(pathId);
  if (!path) return { ok: false, reason: "Eğitim seçeneği geçersiz." };
  if (!path.allowedIntensity.includes(intensity))
    return { ok: false, reason: "Bu yoğunluk bu program için geçerli değil." };
  if (state.finances.balance < path.enrollmentFee)
    return {
      ok: false,
      reason: `Kayıt için ₺${path.enrollmentFee.toLocaleString("tr-TR")} gerekiyor.`,
    };
  transact(state, -path.enrollmentFee, `${path.displayName} kayıt ücreti`, "education");
  state.education.active = { pathId: path.id, intensity, progressPoints: 0 };
  addMemory(state, `${path.displayName} programına kaydoldun.`, "important");
  return {
    ok: true,
    message: `${path.displayName} programına kaydoldun; ilerleme gelecek hafta başlar.`,
  };
}

export function stopEducation(state) {
  if (state.events.active) return { ok: false, reason: "Önce açık olayı sonuçlandır." };
  const active = state.education.active;
  if (!active) return { ok: false, reason: "Devam eden bir eğitim yok." };
  const path = getPathById(active.pathId);
  state.education.active = null;
  addMemory(state, `${path?.displayName || "Eğitim"} programını bıraktın.`, "important");
  return {
    ok: true,
    message: "Eğitimi bıraktın. Biriken ilerleme silindi, ödenen ücret iade edilmez.",
  };
}
