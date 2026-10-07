import { LIFETIME_EVENTS, resolveAdultChoice } from "./lifetime.js?v=10";
import { PARENTING_EVENTS, resolveParentChoice, processParenthoodCases } from "./parenthood.js?v=10";
import { HOUSEHOLD_EVENTS, resolveHouseholdChoice, processHouseholdCases, canDiscussHousehold, householdChoiceAvailability, householdConversationAvailable } from "./household.js?v=10";
import {
  addEventHistory,
  addCareerHistory,
  addMemory,
  addNpcMemory,
  adjustHealth,
  getStartingProfileId,
  transact,
  updateRelationship,
} from "./state.js?v=10";
import { completePendingJob, getCommuteLoad, getJobById, getMonthlyHousingCost } from "./life.js?v=10";
import { getPathById, isEligibleForJob } from "./education.js?v=10";
import {
  applyRelationshipDelta,
  becomePartner,
  canBecomePartner,
  createPersonalDebt,
  createSocialObligation,
  getOpenSocialCase,
  getPersonalDebt,
  getRelationship,
  getRelationshipStage,
  hasNpcMemory,
  markMeaningfulContact,
  resolvePersonalDebt,
  resolveSocialObligation,
  scheduleSocialFollowup,
  setRomanticInterest,
} from "./social.js?v=10";
import { ADULT_LIFE_EVENTS, applyAdultLifeResolution } from "./adult-life-events.js?v=10";
import { REALISM_EVENTS, applyRealismResolution } from "./realism-events.js?v=10";
import { DEPTH_EVENTS, applyDepthResolution, expireDepthCases } from "./depth-events.js?v=10";
import { DEPTH2_EVENTS } from "./depth2-events.js?v=10";
import { applyDepth2Resolution, createSecret, expireDepth2Cases, seedDepth2Secrets, transferSecret } from "./depth2-systems.js?v=10";
import { DEPTH3_EVENTS, applyDepth3Resolution } from "./depth3-events.js?v=10";
import { BODY_EVENTS, applyBodyResolution } from "./body-events.js?v=10";
import { ensureDepth3State, processDepth3OpenCases, updatePerceivedIdentity } from "./depth3-systems.js?v=10";
import { EXPANSION_EVENTS, EXPANSION_CALLBACK_EVENTS, applyExpansionResolution } from "./expansion-events.js?v=10";
import { LIFE_ECHO_EVENTS, LIFE_ECHO_CALLBACK_EVENTS, applyLifeEchoResolution, ensureLifeEchoState } from "./life-echo-events.js?v=10";
import { LIFE_DEPTH_EVENTS, applyLifeDepthResolution } from "./life-depth.js?v=10";
import { LIFE_CONTENT_EVENTS, applyLifeContentResolution } from "./life-content.js?v=10";

const canTakeJob = (state, jobId) =>
  state.career.jobId !== jobId &&
  !state.career.pendingJob &&
  isEligibleForJob(state, getJobById(jobId)).ok;

// 3D: yardımcılar. Yeni NPC/rol/tag yok; mevcut dört kişi üzerinde çalışır.
const FRIEND_OR_BETTER_STAGES = ["friend", "close", "partner"];
const isFriendOrBetter = (state, personId) =>
  FRIEND_OR_BETTER_STAGES.includes(getRelationshipStage(state, personId));
const isElifRomantic = (state) => ["interest", "partner"].includes(getRelationship(state, "elif").romanceStatus) && !(state.social.currentPartnerNpcId === "elif" && state.household.union?.separatedSince);
const weeksSince = (state, week) =>
  state.time.absoluteWeek - (Number.isInteger(week) ? week : state.time.absoluteWeek);

function applyEffects(state, effects = {}, eventTitle = "Olay") {
  if (effects.money) transact(state, effects.money, effects.reason || `${eventTitle} işlemi`, "event");
  if (effects.health) adjustHealth(state, effects.health);
  if (effects.relationships) {
    for (const [personId, amount] of Object.entries(effects.relationships))
      updateRelationship(state, personId, amount);
  }
  if (effects.social) {
    for (const [personId, delta] of Object.entries(effects.social))
      applyRelationshipDelta(state, personId, delta);
  }
  if (effects.flags) Object.assign(state.flags, effects.flags);
  if (effects.memory) addMemory(state, effects.memory, effects.importance || "normal");
  if (effects.npcMemory)
    addNpcMemory(
      state,
      effects.npcMemory.personId,
      effects.npcMemory.text,
      effects.npcMemory.type || "general",
    );
  // 3D: kişiye özel borç. Mevcut friend-loan/loan_repayment mekanizmasından ayrıdır.
  if (effects.debt)
    createPersonalDebt(
      state,
      effects.debt.personId,
      effects.debt.amount,
      effects.debt.dueWeeks,
      effects.debt.memoryType,
    );
}

const formatEffectAmount = (value) => {
  const amount = Math.abs(Number(value));
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(1);
};

const effectDelta = (label, value) => `${label} ${Number(value) > 0 ? "+" : "−"}${formatEffectAmount(value)}`;

/** Short, player-facing summary of only the choice's immediate known effects. */
export function getChoiceEffectSummary(choice) {
  const effects = choice?.effects || {};
  const summary = [];
  const money = Number(effects.money);
  if (Number.isFinite(money) && money !== 0) summary.push(`₺${formatEffectAmount(money)} ${money > 0 ? "al" : "öde"}`);
  for (const [key, label] of [["energy", "Enerji"], ["stress", "Stres"], ["health", "Sağlık"]]) {
    const value = Number(effects.health?.[key]);
    if (Number.isFinite(value) && value !== 0) summary.push(effectDelta(label, value));
  }
  for (const [, delta] of Object.entries(effects.social || {})) {
    for (const [key, label] of [["closeness", "Yakınlık"], ["trust", "Güven"], ["tension", "Gerilim"]]) {
      const value = Number(delta?.[key]);
      if (Number.isFinite(value) && value !== 0) summary.push(effectDelta(label, value));
    }
  }
  for (const value of Object.values(effects.relationships || {})) {
    if (Number.isFinite(Number(value)) && Number(value) !== 0) summary.push(effectDelta("İlişki", value));
  }
  if (effects.debt?.amount) summary.push(`₺${formatEffectAmount(effects.debt.amount)} borç oluşur`);
  if (choice?.risk) return `${summary.slice(0, 3).join(" · ")}${summary.length ? " · " : ""}Risk: ${choice.risk}`;
  if (summary.length) return summary.slice(0, 4).join(" · ");
  if (effects.flags || effects.npcMemory || effects.memory) return "Bağlam değişir";
  return "Sonucu belirsiz";
}

export const EVENT_DEFINITIONS = [
  ...LIFETIME_EVENTS,
  {
    // Diploma ödülü haftalık tick'te verilir; bu tanım yalnız bildirimdir.
    id: "education_completed",
    repeat: "repeatable",
    title: "Eğitimin tamamlandı",
    text: "Kayıtlı olduğun programı bitirdin; belgen artık iş başvurularında geçerli.",
    condition: (state) => Boolean(state.flags.educationCompletedPending),
    choices: [
      {
        id: "acknowledge",
        label: "Kaydını al",
        effects: {
          health: { stress: -5 },
          flags: { educationCompletedPending: null },
          memory: "Eğitim belgeni aldın.",
        },
      },
    ],
  },
  {
    id: "social_promise_due",
    repeat: "repeatable",
    title: "Verdiğin sözün süresi doldu",
    text: "Yardım edeceğini söylemiştin; süre doldu ve karşındaki bunu fark etti.",
    condition: () => false,
    choices: [{ id: "acknowledge", label: "Sonucuyla yüzleş", effects: {} }],
  },
  {
    id: "social_invitation",
    repeat: "cooldown",
    cooldownWeeks: 10,
    title: "Mehmet'ten davet",
    text: "Mehmet bu hafta görüşmek için seni aradı.",
    condition: (state) =>
      state.social.engaged &&
      state.time.absoluteWeek >= (
        getStartingProfileId(state) === "social" || state.player.tendencies?.sociability >= 55 || state.player.background?.social === "broad"
          ? 3
          : state.player.background?.social === "family" ? 6 : 4
      ) &&
      state.time.absoluteWeek - getRelationship(state, "mehmet").lastMeaningfulContactWeek >= 3,
    choices: [
      {
        id: "accept",
        label: "Daveti kabul et",
        effects: {
          money: -250,
          health: { energy: -5, stress: -4 },
          relationships: { mehmet: 5 },
          social: { mehmet: { trust: 3, tension: -2 } },
          npcMemory: { personId: "mehmet", text: "Davetimi kabul etti." },
          reason: "Sosyal buluşma",
        },
      },
      {
        id: "decline",
        label: "Bu kez reddet",
        effects: {
          social: { mehmet: { trust: -2, tension: 3 } },
          npcMemory: { personId: "mehmet", text: "Davetimi geri çevirdi." },
        },
      },
    ],
  },
  {
    id: "social_help_request",
    repeat: "cooldown",
    cooldownWeeks: 24,
    title: "Mehmet yardım istiyor",
    text: "Mehmet üç hafta içinde halletmesi gereken bir iş için senden destek istedi.",
    condition: (state) =>
      state.social.engaged &&
      state.time.absoluteWeek >= 6 &&
      getRelationship(state, "mehmet").trust >= 45 &&
      !getOpenSocialCase(state, "mehmet"),
    choices: [
      { id: "promise", label: "Yardım sözü ver", effects: { social: { mehmet: { trust: 2 } } } },
      {
        id: "decline",
        label: "Şimdi üstlenme",
        effects: { social: { mehmet: { trust: -3, tension: 2 } } },
      },
    ],
  },
  {
    id: "romantic_opportunity",
    repeat: "once",
    title: "Aranızdaki ihtimal",
    text: "Elif'le kurduğun bağın arkadaşlıktan başka bir ihtimali olabileceğini hissediyorsun.",
    condition: (state) => {
      const relationship = getRelationship(state, "elif");
      return (
        state.social.engaged &&
        relationship.romanceStatus === "none" &&
        relationship.closeness >= 55 &&
        relationship.trust >= 52 &&
        relationship.tension <= 35
      );
    },
    choices: [
      { id: "interested", label: "İhtimali açıkça konuş", effects: {} },
      {
        id: "remain_friends",
        label: "Arkadaş olarak kal",
        effects: { social: { elif: { trust: 2 } }, flags: { declinedElifRomance: true } },
      },
    ],
  },
  {
    id: "partner_transition",
    repeat: "once",
    title: "İlişkinin adı",
    text: "Elif aranızdaki ilişkiyi daha açık biçimde tanımlamak istiyor.",
    condition: (state) => state.social.engaged && canBecomePartner(state, "elif"),
    choices: [
      { id: "commit", label: "Sevgili olmayı kabul et", effects: {} },
      {
        id: "wait",
        label: "Biraz daha zaman iste",
        effects: { social: { elif: { trust: -2, tension: 3 } } },
      },
    ],
  },
  {
    id: "relationship_tension",
    repeat: "cooldown",
    cooldownWeeks: 12,
    title: "Aranızdaki gerilim",
    text: "Biriken sürtüşme konuşulmadan geçecek gibi görünmüyor.",
    condition: (state) =>
      state.social.engaged && state.people.some((person) => person.social.tension >= 60),
    choices: [
      {
        id: "talk",
        label: "Sakin bir konuşma yap",
        effects: { health: { stress: -3 }, flags: { addressedRelationshipTension: true } },
      },
      { id: "avoid", label: "Konuyu ertele", effects: { health: { stress: 4 } } },
    ],
  },
  {
    id: "family_budget_talk",
    repeat: "once",
    title: "Evde para konuşması",
    text: "Paran azalınca annen masrafları nasıl yöneteceğini sordu.",
    condition: (state) =>
      state.finances.balance <
        (state.player.background?.family === "strained" ? 3200 : getStartingProfileId(state) === "ambitious" ? 2200 : getStartingProfileId(state) === "social" ? 2800 : 2500) &&
      state.household.homeId === "family",
    choices: [
      {
        id: "accept",
        label: "Geçici destek iste",
        effects: {
          money: 1000,
          relationships: { anne: -3 },
          memory: "Annen maddi olarak destek oldu.",
          reason: "Aile desteği",
        },
      },
      {
        id: "refuse",
        label: "Kendim halledeceğim de",
        effects: {
          health: { stress: 7 },
          relationships: { anne: 2 },
          memory: "Maddi sıkıntıyı kendi başına çözmeyi seçtin.",
        },
      },
    ],
  },
  {
    id: "burnout_warning",
    repeat: "once",
    title: "Yorgunluk birikti",
    text: "Üst üste yoğun haftalar bedeninde ve sabrında iz bırakmaya başladı.",
    condition: (state) => state.health.stress >= 70 || state.flags.overtimeStreak >= 2,
    choices: [
      {
        id: "slow",
        label: "Biraz yavaşla",
        effects: {
          health: { energy: 12, stress: -15 },
          memory: "Yoğun temponun ardından yavaşlamayı seçtin.",
        },
      },
      {
        id: "push",
        label: "Devam et",
        effects: {
          money: 500,
          health: { energy: -12, stress: 10, health: -4 },
          reason: "Yoğun tempo",
        },
      },
    ],
  },
  {
    id: "friend_followup",
    repeat: "once",
    title: "Mehmet'ten haber var",
    text: "Daha önce yardım ettiğin Mehmet, görüşmeye çağrıldığını söyledi.",
    condition: (state) =>
      (state.flags.helpedFriend === true || hasNpcMemory(state, "mehmet", "helped")) &&
      state.time.absoluteWeek >= (state.flags.helpedFriendWeek || 0) + 6,
    choices: [
      {
        id: "celebrate",
        label: "Birlikte kutla",
        effects: {
          money: -300,
          relationships: { mehmet: 8 },
          health: { stress: -5 },
          memory: "Mehmet'in iş görüşmesini birlikte kutladınız.",
          npcMemory: { personId: "mehmet", text: "İyi haberimi birlikte kutladı." },
          reason: "Kutlama",
        },
      },
      {
        id: "message",
        label: "Mesajla tebrik et",
        effects: {
          relationships: { mehmet: 3 },
          npcMemory: { personId: "mehmet", text: "İş görüşmem için beni tebrik etti." },
        },
      },
    ],
  },
  {
    id: "health_warning",
    repeat: "cooldown",
    cooldownWeeks: 16,
    title: "Bedenin uyarıyor",
    text: "Uzun süren yorgunluk günlük hayatını etkilemeye başladı.",
    condition: (state) => state.health.health <= 55,
    choices: [
      {
        id: "clinic",
        label: "Sağlık ocağına git",
        effects: {
          money: -250,
          health: { health: 12, stress: -5 },
          memory: "Sağlığın için yardım aldın.",
          reason: "Sağlık gideri",
        },
      },
      { id: "ignore", label: "Şimdilik ertele", effects: { health: { health: -6, stress: 4 } } },
    ],
  },
  {
    id: "work_review",
    repeat: "once",
    title: "İlk iş değerlendirmesi",
    text: "Yöneticin ilk aylarını değerlendirmek için seni çağırdı.",
    condition: (state) => {
      const job = getJobById(state.career.jobId);
      return state.career.jobId !== null && state.career.weeksInRole >= (job?.terms?.probationWeeks || 8);
    },
    choices: [
      {
        id: "steady",
        label: "Dengeli devam et",
        effects: { health: { stress: -3 }, memory: "İlk iş değerlendirmeni sorunsuz tamamladın." },
      },
      {
        id: "responsibility",
        label: "Daha fazla sorumluluk iste",
        effects: {
          money: 400,
          health: { stress: 6 },
          flags: { soughtResponsibility: true },
          memory: "İşinde daha fazla sorumluluk istedin.",
          reason: "İş primi",
        },
      },
    ],
  },
  {
    id: "education_opportunity",
    repeat: "once",
    title: "Diploman kapı açtı",
    text: "Lisans belgen sayesinde kurumsal bir pozisyon artık sana açık.",
    condition: (state) => canTakeJob(state, "specialist"),
    choices: [
      {
        id: "review",
        label: "Fırsatı incele",
        effects: {
          health: { stress: -3 },
          flags: { sawEducationOpportunity: true },
          memory: "Lisans diploman yeni bir iş fırsatının kapısını açtı.",
          importance: "important",
        },
      },
    ],
  },
  {
    id: "experience_opportunity",
    repeat: "once",
    title: "Tecrüben fark edildi",
    text: "Sahadaki deneyimin ve teknik eğitimin birleşti; daha iyi bir pozisyon konuşuluyor.",
    condition: (state) => canTakeJob(state, "technician"),
    choices: [
      {
        id: "review",
        label: "Fırsatı incele",
        effects: {
          health: { stress: -3 },
          flags: { sawExperienceOpportunity: true },
          memory: "Deneyimin sayesinde daha iyi bir iş fırsatı doğdu.",
          importance: "important",
        },
      },
    ],
  },
  {
    id: "study_workload_pressure",
    repeat: "cooldown",
    cooldownWeeks: 16,
    title: "Okul ve iş aynı haftaya sığmıyor",
    text: "Çalışma düzeni ile ders yükü üst üste bindi; beden bunu hissettiriyor.",
    condition: (state) =>
      Boolean(state.education.active) &&
      state.career.jobId !== null &&
      (state.health.energy <= 40 || state.health.stress >= 65),
    choices: [
      {
        id: "slow",
        label: "Tempoyu düşür",
        effects: {
          health: { energy: 8, stress: -10 },
          memory: "Ders ve iş yükü arasında tempoyu düşürdün.",
        },
      },
      {
        id: "push",
        label: "İkisini de sürdür",
        effects: {
          health: { energy: -6, stress: 6, health: -2 },
          flags: { pushedThroughStudy: true },
        },
      },
    ],
  },
  {
    id: "tuition_pressure",
    repeat: "cooldown",
    cooldownWeeks: 4,
    title: "Eğitim ücreti sıkıştırdı",
    text: "Yaklaşan eğitim ödemesi için kasadaki para yeterli görünmüyor.",
    condition: (state) => {
      const path = state.education.active ? getPathById(state.education.active.pathId) : null;
      return Boolean(path) && state.finances.balance < path.monthlyTuition * 2;
    },
    choices: [
      {
        id: "ask",
        label: "Aileden destek iste",
        effects: {
          money: 1500,
          relationships: { anne: -4 },
          reason: "Eğitim desteği",
          memory: "Eğitim ücreti için ailenden destek istedin.",
        },
      },
      {
        id: "cut",
        label: "Harcamaları kıs",
        effects: {
          health: { stress: 6 },
          flags: { cutForTuition: true },
          memory: "Eğitim ücretini karşılamak için harcamalarını kıstın.",
        },
      },
    ],
  },
  {
    id: "job_pressure",
    repeat: "cooldown",
    cooldownWeeks: 20,
    title: "İş baskısı yükseldi",
    text: "Yoğun çalışma düzeni ve biriken stres aynı haftada üst üste geldi.",
    condition: (state) =>
      (getJobById(state.career.jobId)?.load || 0) >= 3 &&
      (state.health.stress >= 65 ||
        (getStartingProfileId(state) === "ambitious" && state.health.stress >= 60)),
    choices: [
      {
        id: "boundary",
        label: "Sınır koy",
        effects: {
          health: { stress: -10, energy: 5 },
          flags: { setWorkBoundary: true },
          memory: "İş yüküne karşı sınır koydun.",
        },
      },
      {
        id: "endure",
        label: "Tempoya dayan",
        effects: {
          money: 600,
          health: { energy: -8, stress: 8, health: -3 },
          reason: "Yoğun iş primi",
          memory: "Yoğun iş temposunu sürdürdün.",
        },
      },
    ],
  },
  {
    id: "housing_squeeze",
    repeat: "cooldown",
    cooldownWeeks: 16,
    title: "Kira günü yaklaştı",
    text: "Hesapta kira kadar yok. Ev sahibi ayın beşini bekler. Market fişi bu hafta birikecek.",
    condition: (state) =>
      state.finances.balance < getMonthlyHousingCost(state) && getMonthlyHousingCost(state) >= 3600,
    choices: [
      {
        id: "cut",
        label: "Harcamaları kıs",
        effects: {
          health: { stress: 4 },
          flags: { housingBudgetCut: true },
          memory: "Konut giderini karşılamak için harcamalarını kıstın.",
        },
      },
      {
        id: "ask",
        label: "Aileden destek iste",
        effects: {
          money: 1000,
          relationships: { anne: -4 },
          reason: "Konut desteği",
          memory: "Konut gideri için ailenden destek istedin.",
        },
      },
    ],
  },
  {
    id: "family_privacy",
    repeat: "once",
    title: "Evde sınırlar",
    text: "Aile evinde mahremiyet ve ortak yaşam kuralları üzerine gerilim çıktı.",
    condition: (state) =>
      state.household.homeId === "family" &&
      state.relationships.anne <= 72 &&
      state.time.absoluteWeek >= 5,
    choices: [
      {
        id: "talk",
        label: "Sakin konuş",
        effects: {
          relationships: { anne: 5 },
          health: { stress: -3 },
          memory: "Aile evindeki sınırları sakin biçimde konuştun.",
        },
      },
      {
        id: "withdraw",
        label: "Konuyu kapat",
        effects: {
          relationships: { anne: -5 },
          health: { stress: 7 },
          flags: { familyPrivacyTension: true },
        },
      },
    ],
  },
  {
    id: "commute_fatigue",
    repeat: "cooldown",
    cooldownWeeks: 12,
    title: "Servis ve ayak",
    text: "Minibüs dolu, aktarma kaçtı. İşe on dakika kala duraktasın; ter ve çanta omzunda.",
    condition: (state) =>
      getCommuteLoad(state.household.homeId, state.career.jobId) >= 2 && state.health.energy <= 45,
    choices: [
      {
        id: "early",
        label: "Daha erken çık",
        effects: {
          health: { energy: -3, stress: -6 },
          flags: { adjustedCommute: true },
          memory: "Yol yükünü azaltmak için düzenini değiştirdin.",
        },
      },
      {
        id: "late",
        label: "Gecikmeyi göze al",
        effects: { health: { stress: 8 }, memory: "Uzun yol yüzünden işe geç kaldın." },
      },
    ],
  },
  {
    id: "unemployed_pressure",
    repeat: "cooldown",
    cooldownWeeks: 8,
    title: "İlan kutusu boş",
    text: "Başvurduğun yerler dönmüyor. Evde herkes iş saatini biliyor; sen salondasın.",
    condition: (state) =>
      state.career.jobId === null && !state.career.pendingJob && state.finances.balance < 3500,
    choices: [
      {
        id: "search",
        label: "Fırsatları incele",
        effects: {
          health: { stress: -3 },
          flags: { activelySeekingWork: true },
          memory: "Yeni iş fırsatlarını araştırmaya başladın.",
        },
      },
      {
        id: "pause",
        label: "Bir hafta daha bekle",
        effects: { health: { stress: 7 }, relationships: { anne: -2 } },
      },
    ],
  },
  {
    id: "job_start",
    repeat: "repeatable",
    title: "Yeni işin başlıyor",
    text: "Kabul ettiğin iş teklifinin başlangıç günü geldi.",
    condition: () => false,
    choices: [{ id: "start", label: "İşe başla", effects: { flags: { startedNewJob: true } } }],
  },
  {
    id: "loan_repayment",
    repeat: "repeatable",
    title: "Verdiğin borcun günü geldi",
    text: "Mehmet borcu konuşmak için seni aradı.",
    condition: () => false,
    choices: [
      {
        id: "collect",
        label: "Geri ödemeyi al",
        effects: {
          money: 1500,
          relationships: { mehmet: -2 },
          memory: "Mehmet verdiğin borcu geri ödedi.",
          reason: "Borç geri ödemesi",
        },
      },
      {
        id: "forgive",
        label: "Borcu kapat",
        effects: {
          relationships: { mehmet: 10 },
          memory: "Mehmet'in borcunu sildin.",
          npcMemory: { personId: "mehmet", text: "Ödeyemediğim borcu sildi." },
        },
      },
    ],
  },

  // ============================== 3D — Arkadaşlık ==============================
  {
    id: "night_call_mehmet",
    social3D: true,
    repeat: "cooldown",
    cooldownWeeks: 16,
    title: "Gece yarısı arama",
    text: "Mehmet 00:40'ta aradı: \"Kafam kötü, gelebilir misin?\"",
    condition: (state) =>
      isFriendOrBetter(state, "mehmet") &&
      getRelationship(state, "mehmet").trust >= 45 &&
      state.time.absoluteWeek >= 5,
    choices: [
      {
        id: "go",
        label: "Git",
        effects: {
          money: -80,
          health: { energy: -12 },
          social: { mehmet: { closeness: 8 } },
          npcMemory: { personId: "mehmet", text: "Gece yarısı yanıma geldi.", type: "night_showed_up" },
          reason: "Gece çıkışı",
        },
      },
      { id: "phone", label: "Telefonda dinle", effects: { health: { energy: -4 } } },
      {
        id: "refuse",
        label: "Yarın konuşuruz de",
        effects: {
          social: { mehmet: { trust: -4, tension: 6 } },
          npcMemory: { personId: "mehmet", text: "Gece aradığımda gelmedi.", type: "night_refused" },
        },
      },
    ],
  },
  {
    id: "moving_help_mehmet",
    social3D: true,
    repeat: "cooldown",
    cooldownWeeks: 20,
    title: "Taşınma günü",
    text: "Mehmet taşınıyor: \"Öğlen kamyonet geliyor, iki saat yeter.\"",
    condition: (state) => isFriendOrBetter(state, "mehmet") && state.time.absoluteWeek >= 8,
    choices: [
      {
        id: "help",
        label: "Yardıma git",
        effects: {
          money: -250,
          health: { energy: -10 },
          social: { mehmet: { closeness: 6, trust: 4 } },
          npcMemory: { personId: "mehmet", text: "Taşınmamda yardım etti.", type: "helped_move" },
        },
      },
      {
        id: "excuse",
        label: "Bahane uydur",
        effects: {
          social: { mehmet: { trust: -6, tension: 8 } },
          npcMemory: { personId: "mehmet", text: "Taşınma günü ortada yoktu.", type: "skipped_move" },
        },
      },
      {
        id: "cash",
        label: "Nakit gönder, gelemem",
        effects: {
          money: -400,
          social: { mehmet: { trust: 2 } },
          npcMemory: { personId: "mehmet", text: "Gelemedi ama nakliye parasını verdi.", type: "sent_cash_instead" },
        },
      },
    ],
  },
  {
    id: "mehmet_elif_gossip",
    social3D: true,
    repeat: "once",
    title: "Kim ne demiş",
    text: "Mehmet: \"Elif senin arkandan bir şeyler söylemiş, duydun mu?\"",
    condition: (state) =>
      state.time.absoluteWeek >= 4 &&
      isFriendOrBetter(state, "mehmet") &&
      isElifRomantic(state) === false &&
      state.relationships.elif >= 30,
    choices: [
      {
        id: "side_mehmet",
        label: "Mehmet'e hak ver",
        effects: {
          social: { mehmet: { trust: 4 }, elif: { trust: -6, tension: 8 } },
          npcMemory: { personId: "mehmet", text: "Elif'e karşı benim tarafımı tuttu.", type: "took_side" },
        },
      },
      {
        id: "side_elif",
        label: "Elif'i ara, doğrudan sor",
        effects: {
          social: { elif: { trust: 4 }, mehmet: { trust: -4, tension: 6 } },
          npcMemory: { personId: "elif", text: "Söylenti çıkınca doğrudan bana sordu.", type: "took_side" },
        },
      },
      {
        id: "stay_out",
        label: "Karışmam",
        effects: { social: { mehmet: { tension: 3 }, elif: { tension: 3 } } },
      },
    ],
  },
  {
    id: "mehmet_ignored_ping",
    social3D: true,
    repeat: "cooldown",
    cooldownWeeks: 16,
    title: "Bir şey mi var?",
    text: "Mehmet birkaç mesajını cevapsız bıraktığını fark etti: \"Bir şey mi var, küstün mü?\"",
    condition: (state) =>
      isFriendOrBetter(state, "mehmet") &&
      weeksSince(state, getRelationship(state, "mehmet").lastMeaningfulContactWeek) > 12,
    choices: [
      {
        id: "plan",
        label: "Bu hafta buluşalım",
        effects: { social: { mehmet: { trust: 3, tension: -4 } } },
      },
      { id: "busy", label: "Şu an çok yoğunum", effects: { social: { mehmet: { tension: 4 } } } },
      {
        id: "seen",
        label: "Mesajı gördüm ama unuttum, deme",
        effects: {
          social: { mehmet: { trust: -3, tension: 6 } },
          npcMemory: { personId: "mehmet", text: "Mesajlarımı görüp cevapsız bıraktı.", type: "ignored_ping" },
        },
      },
    ],
  },

  // ================================ 3D — Romantik (Elif) ================================
  {
    id: "elif_what_are_we",
    social3D: true,
    repeat: "once",
    title: "Bu ne şimdi?",
    text: "Elif: \"Bu ne şimdi? Arkadaşlık mı, başka bir şey mi?\"",
    condition: (state) => getRelationship(state, "elif").romanceStatus === "interest",
    choices: [
      {
        id: "commit",
        label: "Sevgili olmak istediğini söyle",
        effects: {},
      },
      {
        id: "unclear",
        label: "Akışına bırakalım",
        effects: { flags: { elifWantsClarity: true }, social: { elif: { tension: 6 } } },
      },
      {
        id: "cut",
        label: "Bu kadarını kaldıramam, kes",
        effects: {
          social: { elif: { closeness: -12, tension: -4 } },
          flags: { declinedElifRomance: true },
        },
      },
    ],
  },
  {
    id: "elif_stayed_over",
    social3D: true,
    repeat: "once",
    title: "Kapı sesi",
    text: "Elif aile evinde kalıyor: \"Kapı sesi yapmayalım, olur mu?\"",
    condition: (state) => isElifRomantic(state) && state.household.homeId === "family",
    choices: [
      { id: "not_here", label: "Burada olmaz", effects: { social: { elif: { tension: 4 } } } },
      {
        id: "secret",
        label: "Sessizce kalsın, kimse bilmesin",
        effects: {
          social: { elif: { closeness: 6, tension: 3 } },
          npcMemory: { personId: "elif", text: "Ailemden gizli kaldı.", type: "kept_secret" },
        },
      },
      {
        id: "hotel",
        label: "Otele gidelim",
        effects: { money: -600, social: { elif: { closeness: 4 } } },
      },
    ],
  },
  {
    id: "elif_old_photo_like",
    social3D: true,
    repeat: "cooldown",
    cooldownWeeks: 16,
    title: "Eski bir fotoğraf",
    text: "Elif'in eski bir tatil fotoğrafını beğendiğini gördün; altında tanımadığın biri var.",
    condition: (state) => getRelationship(state, "elif").romanceStatus === "partner",
    choices: [
      { id: "ask", label: "Kim olduğunu sor", effects: { social: { elif: { tension: 4 } } } },
      { id: "ignore", label: "Takma", effects: {} },
      {
        id: "confront",
        label: "Fotoğrafı sorgula",
        effects: { social: { elif: { trust: -4, tension: 10 } } },
      },
    ],
  },
  {
    id: "elif_neglect_week",
    social3D: true,
    repeat: "cooldown",
    cooldownWeeks: 12,
    title: "Bu hafta da yoksun",
    text: "Elif: \"Bu hafta da hiç vaktin olmadı.\"",
    condition: (state) =>
      getRelationship(state, "elif").romanceStatus === "partner" && !state.household.union?.separatedSince &&
      weeksSince(state, getRelationship(state, "elif").lastMeaningfulContactWeek) > 5,
    choices: [
      {
        id: "plan",
        label: "Bu hafta sonu için plan yap",
        effects: { money: -200, social: { elif: { closeness: 5, tension: -6 } } },
      },
      { id: "work", label: "İş yoğun, elimde değil", effects: { social: { elif: { tension: 5 } } } },
      {
        id: "argue",
        label: "Sen de hep müsait değilsin, tartış",
        effects: { social: { elif: { trust: -3, tension: 8 } } },
      },
    ],
  },

  // ==================================== 3D — Aile ====================================
  {
    id: "family_late_night",
    social3D: true,
    repeat: "cooldown",
    cooldownWeeks: 20,
    title: "01:10'da nerede kaldın",
    text: "Annen gece uyanmış, kapıda seni bekliyor: \"Nerede kaldın?\"",
    condition: (state) => state.household.homeId === "family" && state.time.absoluteWeek >= 2,
    choices: [
      {
        id: "lie",
        label: "Uydur bir şey",
        effects: { flags: { lateHomeLie: true } },
      },
      { id: "truth", label: "Doğruyu söyle", effects: { relationships: { anne: 2 } } },
      {
        id: "tell_elif",
        label: "Elif'le olduğunu söyle",
        effects: {
          flags: { familyKnowsElif: true },
          relationships: { anne: 1 },
          npcMemory: { personId: "anne", text: "Elif'ten ailemin haberi oldu.", type: "told_about_elif" },
        },
      },
      { id: "room", label: "Cevap vermeden odana çık", effects: { health: { stress: 3 } } },
    ],
  },
  {
    id: "family_money_check",
    social3D: true,
    repeat: "once",
    title: "Kasa yine ince",
    text: "Annen: \"Kasa yine ince, sen bir şey biriktirebiliyor musun?\"",
    condition: (state) => state.household.homeId === "family" && state.time.absoluteWeek >= 6,
    choices: [
      { id: "open", label: "Bütün durumu anlat", effects: { relationships: { anne: 3 }, health: { stress: -2 } } },
      { id: "save", label: "Biriktiriyorum de", effects: {} },
      {
        id: "defend",
        label: "Benim param, karışma",
        effects: { relationships: { anne: -4 }, health: { stress: 3 } },
      },
    ],
  },
  {
    id: "family_marriage_hint",
    social3D: true,
    repeat: "once",
    title: "Komşunun kızı/oğlu",
    text: "Kahve sohbetinde annen: \"Komşunun kızı/oğlu senden küçük, o bile nişanlandı.\"",
    condition: (state) => state.household.homeId === "family" && state.time.absoluteWeek >= 20,
    choices: [
      { id: "dismiss", label: "Konuyu geç", effects: {} },
      { id: "hide", label: "İlişkini gizle", effects: { flags: { hidingRelationshipFromFamily: true } } },
      {
        id: "career",
        label: "Önce kariyer de",
        effects: { flags: { careerShield: true }, relationships: { anne: -1 } },
      },
      { id: "sit", label: "Gülüp geç, oturmaya devam et", effects: { health: { stress: -2 } } },
    ],
  },
  {
    id: "family_holiday_visit",
    social3D: true,
    repeat: "cooldown",
    cooldownWeeks: 20,
    title: "Bayram ziyareti",
    text: "Annen: \"Perşembe otobüs var, bayramda geliyor musun?\"",
    condition: (state) => state.time.absoluteWeek === 16 || state.time.absoluteWeek === 40,
    choices: [
      {
        id: "go",
        label: "Git",
        effects: { money: -900, relationships: { anne: 6, baba: 4 }, health: { energy: -6 } },
      },
      {
        id: "work",
        label: "İş var, gidemem",
        effects: {
          relationships: { anne: -5 },
          npcMemory: { personId: "anne", text: "Bayramda gelemedi.", type: "missed_holiday" },
        },
      },
      {
        id: "short",
        label: "Bir günlüğüne uğra",
        effects: { money: -400, relationships: { anne: 2 } },
      },
    ],
  },

  // =================================== 3D — Para ===================================
  {
    id: "mehmet_needs_money",
    social3D: true,
    repeat: "once",
    title: "Kart yemedi",
    text: "Mehmet: \"Kart yemedi, resmen açığım var, 2.500 lazım.\"",
    condition: (state) =>
      state.time.absoluteWeek >= 4 && isFriendOrBetter(state, "mehmet") && state.finances.balance >= 2500,
    choices: [
      {
        id: "lend_full",
        label: "2.500 ver",
        effects: {
          money: -2500,
          debt: { personId: "mehmet", amount: 2500, dueWeeks: 4, memoryType: "lent_2500" },
        },
      },
      { id: "decline", label: "Şu an olmaz", effects: { social: { mehmet: { trust: -3 } } } },
      {
        id: "lend_partial",
        label: "1.000 verebilirim",
        effects: {
          money: -1000,
          debt: { personId: "mehmet", amount: 1000, dueWeeks: 4, memoryType: "lent_1000" },
        },
      },
    ],
  },
  {
    id: "cousin_wedding_gold",
    social3D: true,
    repeat: "once",
    title: "Kuzenin düğünü",
    text: "Kuzeninin düğünü var; masaya çeyrek altın koymak âdet.",
    condition: (state) => state.time.absoluteWeek >= 12,
    choices: [
      { id: "gold", label: "Çeyrek altın koy", effects: { money: -3500 } },
      { id: "cash", label: "800 TL zarf koy", effects: { money: -800 } },
      {
        id: "excuse",
        label: "Bahane uydur, gitme",
        effects: { flags: { weddingExcuse: true }, relationships: { anne: -2 } },
      },
    ],
  },
  {
    id: "mom_needs_money",
    social3D: true,
    repeat: "cooldown",
    cooldownWeeks: 20,
    title: "Sende duran var mı",
    text: "Annen: \"Sende duran para var mı, bu ay biraz sıkıştık.\"",
    condition: (state) => state.time.absoluteWeek >= 4 && state.household.homeId === "family",
    choices: [
      { id: "give", label: "800 ver", effects: { money: -800, relationships: { anne: 4 } } },
      { id: "rent", label: "Kira gününe kadar bende de yok de", effects: {} },
      {
        id: "lie",
        label: "Param yok de (varken)",
        effects: { flags: { moneyLieToMom: true }, relationships: { anne: -1 } },
      },
    ],
  },
  {
    id: "payday_iban_help",
    social3D: true,
    repeat: "cooldown",
    cooldownWeeks: 16,
    title: "Yattı ya",
    text: "Mehmet: \"Maaşın yattı ya, 600 borç lazımdı, hatırlarsın diye yazdım.\"",
    condition: (state) =>
      state.time.absoluteWeek >= 4 && state.career.jobId !== null && state.time.weekOfMonth === 1,
    choices: [
      { id: "pay", label: "Hemen gönder", effects: { money: -600, social: { mehmet: { trust: 3 } } } },
      {
        id: "lie",
        label: "Daha yatmadı de",
        effects: { flags: { paydayLie: true }, social: { mehmet: { tension: 3 } } },
      },
      { id: "push_back", label: "Sen de bana borçlusun, sıra sende", effects: { social: { mehmet: { tension: 6 } } } },
    ],
  },

  // ============================== 3D — Görünürlük ==============================
  {
    id: "mehmet_debt_story",
    social3D: true,
    repeat: "cooldown",
    cooldownWeeks: 8,
    title: "Story'de yeni telefon",
    text: "Mehmet'in story'sinde yeni telefon kılıfı var: \"Sana 2.500 duruyor, unutmadın herhâlde.\"",
    condition: (state) => {
      const debt = getPersonalDebt(state, "mehmet");
      return (
        Boolean(debt) &&
        hasNpcMemory(state, "mehmet", "lent_2500") &&
        weeksSince(state, debt.createdWeek) >= 4
      );
    },
    choices: [
      { id: "collect", label: "Ne zaman ödeyeceksin diye sor", effects: {} },
      { id: "ignore", label: "Story'yi beğen, geç", effects: { social: { mehmet: { tension: 2 } } } },
      { id: "forgive", label: "Boş ver, sil gitsin", effects: {} },
    ],
  },
  {
    id: "family_group_photo",
    social3D: true,
    repeat: "once",
    title: "Bu kim evlat?",
    text: "Aile grubuna düşen bir fotoğrafta Elif de var: \"Bu kim evlat?\"",
    condition: (state) =>
      (state.social.currentPartnerNpcId === "elif" || state.flags.elifSleptOverSecret === true) &&
      state.household.homeId === "family",
    choices: [
      { id: "neighbor", label: "Komşunun kızı de", effects: { flags: { hidElifFromFamily: true } } },
      { id: "silent", label: "Cevap verme, geç", effects: { health: { stress: 3 } } },
      {
        id: "confess",
        label: "Elif olduğunu söyle",
        effects: { flags: { familyKnowsElif: true }, relationships: { anne: 1 } },
      },
    ],
  },
  {
    id: "elif_seen_not_replied",
    social3D: true,
    repeat: "cooldown",
    cooldownWeeks: 12,
    title: "Mavi tik",
    text: "Mesajın dört saattir mavi tik, cevap yok.",
    condition: (state) => isElifRomantic(state),
    choices: [
      { id: "ask", label: "Yoğun musun diye yaz", effects: {} },
      { id: "wait", label: "Bekle, yazma", effects: { social: { elif: { tension: 2 } } } },
      {
        id: "match",
        label: "Sen de aynısını yap, geciktir",
        effects: { social: { elif: { tension: 6 } } },
      },
    ],
  },
  {
    id: "partner_location_ping",
    social3D: true,
    repeat: "cooldown",
    cooldownWeeks: 12,
    title: "23:40, kafe",
    text: "Konum paylaşımı 23:40'ta bir kafede olduğunu gösteriyor; Elif fark etti.",
    condition: (state) => isElifRomantic(state),
    choices: [
      {
        id: "cover",
        label: "Farklı bir yerdeydim de",
        effects: { flags: { locationCover: true }, social: { elif: { trust: -3 } } },
      },
      { id: "honest", label: "Oradaydım, doğruyu söyle", effects: { social: { elif: { trust: 4 } } } },
      { id: "hope", label: "Fark etmemiş olabilir, sessiz kal", effects: { social: { elif: { tension: 3 } } } },
    ],
  },

  // ================================ 3D — Yetişkin hayat ================================
  {
    id: "elif_alone_at_home",
    social3D: true,
    repeat: "once",
    title: "Evde kimse yok",
    text: "Elif yakınlaşmak istediğini açıkça söylüyor; ikiniz de yetişkinsiniz. Rıza, sınırlar ve korunma üzerine karar senin. İstemiyorsan bugün hayır diyebilirsin.",
    condition: (state) =>
      state.player.age >= 18 &&
      isElifRomantic(state) &&
      getRelationship(state, "elif").closeness >= 60 &&
      getRelationship(state, "elif").trust >= 55,
    choices: [
      { id: "protected", label: "İkiniz de istiyorsanız kondomla seks", effects: { money: -120, social: { elif: { closeness: 8, trust: 2 } } } },
      { id: "unprotected", label: "İkiniz de kabul ediyorsanız kondomsuz seks", effects: { social: { elif: { closeness: 8 } } } },
      { id: "leave", label: "Bugün seks istemiyorum de", effects: { social: { elif: { trust: 2 } } } },
    ],
  },
  {
    id: "elif_morning_after",
    social3D: true,
    repeat: "repeatable",
    title: "Ne olduk şimdi",
    text: "Elif ertesi gün: \"Ne olduk şimdi biz?\"",
    condition: () => false,
    choices: [
      {
        id: "talk",
        label: "Açıkça konuş",
        effects: { flags: { talkedAboutElif: true }, social: { elif: { trust: 5, closeness: 4 } } },
      },
      {
        id: "ghost",
        label: "Cevapsız bırak",
        effects: { flags: { ghostedElif: true }, social: { elif: { trust: -8, tension: 8 } } },
      },
      {
        id: "casual",
        label: "Sadece o geceydi de",
        effects: { flags: { oneNightElif: true }, social: { elif: { tension: 3 } } },
      },
    ],
  },
  {
    id: "pregnancy_scare",
    social3D: true,
    repeat: "repeatable",
    title: "Gecikme",
    text: "Elif: \"Gecikme var, biraz korkuyorum.\"",
    condition: () => false,
    choices: [
      {
        id: "test",
        label: "Birlikte test yaptırın",
        effects: {
          money: -180,
          flags: { pregnancyFear: false },
          health: { stress: -6 },
          memory: "Korku sona erdi; hamilelik yoktu.",
        },
      },
      {
        id: "hide",
        label: "Konuyu sakla, kendi haline bırak",
        effects: {
          flags: { pregnancyFear: false },
          social: { elif: { trust: -4 } },
          health: { stress: 4 },
        },
      },
      {
        id: "blame",
        label: "Onu suçla",
        effects: {
          flags: { pregnancyFear: false },
          social: { elif: { trust: -14, tension: 14 } },
        },
      },
    ],
  },
  {
    id: "move_in_with_elif",
    social3D: true,
    household: true,
    validateChoice: householdChoiceAvailability,
    repeat: "once",
    title: "Bir bakınsak mı?",
    text: "Elif: \"Bir ara birlikte bir ev bakınsak mı?\"",
    condition: (state) =>
      getRelationship(state, "elif").romanceStatus === "partner" && !state.household.union?.separatedSince &&
      weeksSince(state, getRelationship(state, "elif").lastMeaningfulContactWeek) <= 8 &&
      state.household.homeId === "family" && canDiscussHousehold(state, "cohabitation"),
    choices: [
      {
        id: "look",
        label: "Bakınmaya başlayalım · bir aktivite",
        effects: { flags: { lookedForPlaceWithElif: true }, social: { elif: { closeness: 6 } } },
      },
      {
        id: "family",
        label: "Önce ailemle konuşmam lazım",
        effects: { flags: { hidingRelationshipFromFamily: true } },
      },
      { id: "early", label: "Bence daha erken", effects: { social: { elif: { tension: 5 } } } },
    ],
  },

  // ============================ 3D — Zincir altyapısı ============================
  {
    id: "debt_elif_comment",
    repeat: "repeatable",
    title: "Sen hâlâ mı takıyorsun",
    text: "Elif, Mehmet'le aranızdaki para meselesine değindi: \"Sen hâlâ o parayı takıyor musun?\"",
    condition: () => false,
    choices: [
      {
        id: "acknowledge",
        label: "Geç, önemli değil",
        effects: { health: { stress: -2 }, social: { elif: { tension: -2 } } },
      },
    ],
  },
  {
    id: "promise_mehmet_reference",
    social3D: true,
    repeat: "once",
    title: "Referans lazım",
    text: "Mehmet yeni bir iş başvurusu yaptı: \"Referans olarak seni gösterebilir miyim?\"",
    condition: (state) =>
      state.time.absoluteWeek >= 4 && isFriendOrBetter(state, "mehmet") && state.career.jobId !== null,
    choices: [
      { id: "promise", label: "Söz ver", effects: { social: { mehmet: { trust: 3 } } } },
      { id: "decline", label: "Şimdi olmaz", effects: { social: { mehmet: { trust: -2 } } } },
    ],
  },
  {
    id: "reference_promise_outcome",
    repeat: "repeatable",
    title: "Referans durumu",
    text: "Mehmet soruyor: \"Referans konusunu hallettin mi?\"",
    condition: () => false,
    choices: [
      {
        id: "gave",
        label: "Referansı verdim",
        effects: {
          social: { mehmet: { trust: 6 } },
          npcMemory: { personId: "mehmet", text: "Referansımı gerçekten verdi.", type: "reference_given" },
        },
      },
      {
        id: "broke",
        label: "Unuttum, vermedim",
        effects: {
          social: { mehmet: { trust: -8, tension: 8 } },
          npcMemory: { personId: "mehmet", text: "Söz verdiği referansı vermedi.", type: "reference_broken" },
        },
      },
    ],
  },
  {
    id: "reference_followup_positive",
    repeat: "repeatable",
    title: "Mehmet'ten teşekkür",
    text: "Mehmet yeni işinde iyi gidiyor: \"Referansın için gerçekten sağ ol.\"",
    condition: () => false,
    choices: [
      {
        id: "acknowledge",
        label: "Rica ederim",
        effects: { social: { mehmet: { trust: 4, closeness: 3 } }, health: { stress: -2 } },
      },
    ],
  },
  {
    id: "reference_followup_negative",
    repeat: "repeatable",
    title: "Ortaya çıktı",
    text: "Mehmet'in yeni işvereni referansının asılsız olduğunu fark etmiş; Mehmet seni bu yüzden suçluyor.",
    condition: () => false,
    choices: [
      {
        id: "acknowledge",
        label: "Sonucuyla yüzleş",
        effects: {
          social: { mehmet: { trust: -10, tension: 10 } },
          memory: "Vermediğin referans yüzünden Mehmet zor durumda kaldı.",
        },
      },
    ],
  },
  {
    id: "wedding_budget_reflection",
    repeat: "repeatable",
    title: "Düğün masrafı",
    text: "Ay sonu hesabı çıkınca düğüne koyduğun para gözüne battı.",
    condition: () => false,
    choices: [{ id: "acknowledge", label: "Bütçeni gözden geçir", effects: { health: { stress: 2 } } }],
  },
  {
    id: "wedding_reciprocity_return",
    repeat: "repeatable",
    title: "Karşılık",
    text: "Mehmet: \"Geçen düğünde yaptığın iyiliği unutmadım, bugün masrafını ben karşılıyorum.\"",
    condition: () => false,
    choices: [
      {
        id: "acknowledge",
        label: "Teşekkür et",
        effects: {
          money: 500,
          social: { mehmet: { trust: 5, closeness: 4 } },
          memory: "Mehmet geçen düğündeki iyiliğinin karşılığını verdi.",
        },
      },
    ],
  },
  {
    id: "elif_asks_about_secret",
    repeat: "repeatable",
    title: "Bu böyle sürmez",
    text: "Elif: \"Ailenden hep gizli kalamayız, bu böyle sürmez.\"",
    condition: () => false,
    choices: [
      {
        id: "tell_family",
        label: "Aileme söyleyeceğim",
        effects: { flags: { familyKnowsElif: true }, social: { elif: { trust: 6, tension: -6 } } },
      },
      {
        id: "keep_secret",
        label: "Şimdilik sır kalsın",
        effects: { social: { elif: { tension: 6 } } },
      },
    ],
  },
  {
    id: "mehmet_learns_secret",
    repeat: "repeatable",
    title: "Mehmet de öğrendi",
    text: "Mehmet, ortak bir tanıdıktan Elif'le aranızdaki durumu öğrenmiş: \"Bana neden söylemedin?\"",
    condition: () => false,
    choices: [
      {
        id: "acknowledge",
        label: "Açıklamaya çalış",
        effects: {
          social: { mehmet: { trust: -6, tension: 6 } },
          memory: "Elif'le ilgili sır Mehmet'e başka yoldan ulaştı.",
        },
      },
    ],
  },
  ...REALISM_EVENTS,
  ...ADULT_LIFE_EVENTS,
  ...DEPTH_EVENTS,
  ...DEPTH2_EVENTS,
  ...DEPTH3_EVENTS,
  ...BODY_EVENTS,
  ...HOUSEHOLD_EVENTS,
  ...PARENTING_EVENTS,
  ...EXPANSION_EVENTS.map((event) => ({ ...event, expansion: true })),
  ...EXPANSION_CALLBACK_EVENTS.map((event) => ({ ...event, expansion: true })),
  ...LIFE_ECHO_EVENTS,
  ...LIFE_ECHO_CALLBACK_EVENTS,
  ...LIFE_DEPTH_EVENTS,
  ...LIFE_CONTENT_EVENTS,
];

export function getEventDefinition(eventId) {
  return EVENT_DEFINITIONS.find((event) => event.id === eventId) || null;
}

function isEligible(state, definition) {
  if (definition.depth2 && state.flags.depth2Enabled !== true) return false;
  if (definition.depth3 && state.flags.depth3Enabled !== true) return false;
  if (definition.repeat === "once" && state.events.seen.includes(definition.id)) return false;
  if (
    definition.repeat === "cooldown" &&
    (state.events.cooldowns[definition.id] || 0) > state.time.absoluteWeek
  )
    return false;
  if (
    state.events.active?.eventId === definition.id ||
    state.events.queue.some((item) => item.eventId === definition.id)
  )
    return false;
  // 3D yoğunluk siperi: organik aramada haftada en fazla bir yeni 3D sosyal event.
  // Zincir halkaları processDueOpenCases ile kuyruklanır ve bu aramadan hiç geçmez;
  // dolayısıyla siperden muaftır (tasarım gereği). lastEventResolvedWeek kontrolü,
  // resolveEvent'in aynı hafta içinde zincirleme aktive ettiği bir sonraki olayın
  // (3D olmayan bir olayın ardından bile) o hafta içine sızmasını engeller.
  if (
    (definition.social3D || definition.expansion) &&
    (state.flags.lastSocial3DWeek === state.time.absoluteWeek ||
      state.flags.lastEventResolvedWeek === state.time.absoluteWeek)
  )
    return false;
  return definition.condition(state);
}

export function requestHouseholdConversation(state, eventId) {
  if (!householdConversationAvailable(state, eventId)) return { ok: false, message: "Bu görüşme için koşullar henüz uygun değil; açık kararını veya hazırlık süresini tamamla." };
  enqueueEvent(state, eventId);
  activateNextEvent(state);
  return { ok: true, message: "Bu kararı birlikte konuşun." };
}

export function enqueueEvent(state, eventId, sourceCaseId = null) {
  const definition = getEventDefinition(eventId);
  if (!definition) return false;
  // History is intentionally capped; deriving identity from its length would
  // eventually reuse an old occurrence id in long games. A bounded scalar in
  // flags keeps each live occurrence unique without changing the save schema.
  state.flags.eventSequence = (Number.isInteger(state.flags.eventSequence) ? state.flags.eventSequence : 0) + 1;
  const occurrenceId = `${eventId}-${state.time.absoluteWeek}-${state.flags.eventSequence}`;
  state.events.queue.push({ eventId, occurrenceId, sourceCaseId });
  return true;
}

export function activateNextEvent(state) {
  if (state.lifetime?.death) return null;
  seedDepth2Secrets(state);
  ensureDepth3State(state);
  ensureLifeEchoState(state);
  updatePerceivedIdentity(state);
  if (state.events.active) return state.events.active;
  if (!state.events.queue.length) {
    const definition =
      EVENT_DEFINITIONS.find((candidate) => candidate.lifeEcho && isEligible(state, candidate)) ||
      EVENT_DEFINITIONS.find((candidate) => isEligible(state, candidate));
    if (definition) enqueueEvent(state, definition.id);
  }
  state.events.active = state.events.queue.shift() || null;
  return state.events.active;
}

export function hasEligiblePoolEvent(state) {
  return Boolean(
    EVENT_DEFINITIONS.find((candidate) => candidate.lifeEcho && isEligible(state, candidate)) ||
      EVENT_DEFINITIONS.find((candidate) => isEligible(state, candidate)),
  );
}

export function getEventChoiceAvailability(state, choiceId) {
  const active = state.events.active;
  const definition = active && getEventDefinition(active.eventId);
  const choice = definition?.choices.find((item) => item.id === choiceId);
  if (!choice) return { ok: false, reason: "Geçersiz olay seçimi." };
  return definition.validateChoice?.(state, definition, choice, state.openCases.find((item) => item.id === active.sourceCaseId)) || { ok: true };
}

export function resolveEvent(state, choiceId) {
  if (state.lifetime?.death) return { ok: false, message: "Bu yaşam tamamlandı." };
  const active = state.events.active;
  if (!active) return { ok: false, message: "Çözülecek olay yok." };
  if (state.events.history.some((entry) => entry.occurrenceId === active.occurrenceId))
    return { ok: false, message: "Bu olay zaten sonuçlandı." };
  const definition = getEventDefinition(active.eventId);
  const choice = definition?.choices.find((candidate) => candidate.id === choiceId);
  if (!definition || !choice) return { ok: false, message: "Geçersiz olay seçimi." };

  const availability = getEventChoiceAvailability(state, choiceId);
  if (!availability.ok) return { ok: false, message: availability.reason };
  applyEffects(state, choice.effects, definition.title);
  if (definition.id === "work_review") {
    addCareerHistory(state, {
      type: choiceId === "responsibility" ? "probation_passed" : "probation_review",
      jobId: state.career.jobId,
      label: choiceId === "responsibility" ? "İlk iş değerlendirmesini geçip daha fazla sorumluluk istedin." : "İlk iş değerlendirmesini dengeli tamamladın.",
    });
  }
  if (definition.id === "social_invitation" && choiceId === "accept")
    markMeaningfulContact(state, "mehmet");
  if (definition.id === "social_help_request" && choiceId === "promise")
    createSocialObligation(state, "mehmet");
  if (definition.id === "romantic_opportunity" && choiceId === "interested")
    setRomanticInterest(state, "elif");
  if (definition.id === "partner_transition" && choiceId === "commit")
    becomePartner(state, "elif");
  if (definition.id === "relationship_tension") {
    const person = [...state.people].sort((a, b) => b.social.tension - a.social.tension)[0];
    if (person) {
      applyRelationshipDelta(
        state,
        person.id,
        choiceId === "talk" ? { trust: 3, tension: -16 } : { trust: -2, tension: 6 },
      );
      addNpcMemory(
        state,
        person.id,
        choiceId === "talk" ? "Aramızdaki gerilimi konuştu." : "Aramızdaki gerilimi erteledi.",
        choiceId === "talk" ? "tension_talk" : "tension_avoided",
      );
      if (choiceId === "talk") markMeaningfulContact(state, person.id);
    }
  }
  if (definition.id === "social_promise_due" && active.sourceCaseId) {
    const sourceCase = state.openCases.find((item) => item.id === active.sourceCaseId);
    if (sourceCase?.payload?.personId)
      resolveSocialObligation(state, sourceCase.payload.personId, false);
  }
  if (definition.id === "job_start") completePendingJob(state, active.sourceCaseId);
  if (definition.id === "elif_what_are_we" && choiceId === "commit") {
    if (!becomePartner(state, "elif")) applyRelationshipDelta(state, "elif", { tension: 4 });
  }

  // 3D — CHN-01: borç görünürlüğü, sonra Elif'in yorumu. "ignore" seçimi borcu
  // beklemede bırakır (cooldown sonrası olay tekrar tetiklenebilir).
  if (definition.id === "mehmet_debt_story" && choiceId !== "ignore") {
    resolvePersonalDebt(state, "mehmet", { collected: choiceId === "collect" });
    scheduleSocialFollowup(state, {
      eventId: "debt_elif_comment",
      dueWeek: state.time.absoluteWeek + 6,
      personId: "elif",
    });
  }
  // 3D — CHN-08: yalnız kalma sonrası ertesi gün ve (korunmasızsa) gecikmeli korku.
  if (definition.id === "elif_alone_at_home" && choiceId !== "leave") {
    Object.assign(state.flags, { sleptWithElif: true });
    addNpcMemory(
      state,
      "elif",
      choiceId === "protected" ? "Birlikte kaldık, korunmuştuk." : "Birlikte kaldık.",
      choiceId === "protected" ? "adult_together_safe" : "adult_together_risky",
    );
    scheduleSocialFollowup(state, {
      eventId: "elif_morning_after",
      dueWeek: state.time.absoluteWeek + 1,
      personId: "elif",
    });
    if (choiceId === "unprotected" && !state.parenthood.pregnancy)
      state.flags.intimacyFollowup = { partnerId: "elif", dueWeek: state.time.absoluteWeek + 4, originWeek: state.time.absoluteWeek };
  }
  // 3D — CHN-03: referans sözü, sonra sonucu, sonra uzun vadeli karşılığı.
  if (definition.id === "promise_mehmet_reference" && choiceId === "promise") {
    state.flags.promisedMehmetRef = true;
    scheduleSocialFollowup(state, {
      eventId: "reference_promise_outcome",
      dueWeek: state.time.absoluteWeek + 3,
      personId: "mehmet",
    });
  }
  if (definition.id === "reference_promise_outcome") {
    scheduleSocialFollowup(state, {
      eventId: choiceId === "gave" ? "reference_followup_positive" : "reference_followup_negative",
      dueWeek: state.time.absoluteWeek + 14,
      personId: "mehmet",
    });
  }
  // 3D — CHN-09: düğün altını, ay sonu hesabı, uzun vadeli karşılık (bahaneyle biter).
  if (definition.id === "cousin_wedding_gold" && choiceId !== "excuse") {
    scheduleSocialFollowup(state, {
      eventId: "wedding_budget_reflection",
      dueWeek: state.time.absoluteWeek + 4,
      personId: "mehmet",
      amount: choiceId === "gold" ? 3500 : 800,
    });
  }
  if (definition.id === "wedding_budget_reflection") {
    scheduleSocialFollowup(state, {
      eventId: "wedding_reciprocity_return",
      dueWeek: state.time.absoluteWeek + 12,
      personId: "mehmet",
    });
  }
  // 3D — CHN-10: aile evinde saklanan gece, Elif'in sorusu, sır kalırsa Mehmet'in öğrenmesi.
  if (definition.id === "elif_stayed_over" && choiceId === "secret") {
    createSecret(state, {
      id: "elif-family-home-secret",
      type: "relationship",
      summary: "Elif'in aile evinde gizlice kalması",
      relatedPeople: ["elif", "anne", "mehmet"],
      knownBy: ["player", "elif"],
      hiddenFrom: ["anne", "mehmet"],
      evidence: "weak",
      sourceEvent: definition.id,
    });
    state.flags.elifSleptOverSecret = true;
    scheduleSocialFollowup(state, {
      eventId: "elif_asks_about_secret",
      dueWeek: state.time.absoluteWeek + 5,
      personId: "elif",
    });
  }
  if (definition.id === "elif_asks_about_secret" && choiceId === "keep_secret") {
    scheduleSocialFollowup(state, {
      eventId: "mehmet_learns_secret",
      dueWeek: state.time.absoluteWeek + 10,
      personId: "mehmet",
    });
  }
  if (definition.id === "mehmet_learns_secret") {
    transferSecret(state, "elif-family-home-secret", "mehmet", "elif");
    addNpcMemory(state, "mehmet", "Elif'le ilgili saklanan meseleyi öğrendi.", "learned_relationship_secret");
  }
  if (definition.id === "life_mehmet_secret") {
    const secret = createSecret(state, {
      id: "mehmet-job-secret",
      type: "career",
      summary: "Mehmet'in işindeki belirsizlik",
      relatedPeople: ["mehmet", "anne"],
      knownBy: ["player", "mehmet"],
      hiddenFrom: ["anne"],
      evidence: choiceId === "tell_anne" ? "strong" : "weak",
      sourceEvent: definition.id,
    });
    if (choiceId === "tell_anne") transferSecret(state, secret.id, "anne");
  }
  const adultFollowup = applyAdultLifeResolution(state, definition, choiceId);
  const realismFollowup = applyRealismResolution(state, definition, choiceId);
  if (definition.lifetime) resolveAdultChoice(state, choiceId, state.openCases.find(item => item.id === active.sourceCaseId));
  if (adultFollowup) scheduleSocialFollowup(state, adultFollowup);
  if (realismFollowup) scheduleSocialFollowup(state, realismFollowup);
  applyDepthResolution(state, definition, choiceId);
  applyDepth2Resolution(state, definition, choiceId, active.sourceCaseId ? state.openCases.find((item) => item.id === active.sourceCaseId) : null);
  applyDepth3Resolution(state, definition, choiceId, active.sourceCaseId ? state.openCases.find((item) => item.id === active.sourceCaseId) : null);
  if (definition.parenting) resolveParentChoice(state, definition, choiceId, active.sourceCaseId ? state.openCases.find((item) => item.id === active.sourceCaseId) : null);
  if (definition.household) resolveHouseholdChoice(state, definition, choiceId, active.sourceCaseId ? state.openCases.find((item) => item.id === active.sourceCaseId) : null);
  applyBodyResolution(state, definition, choiceId, active.sourceCaseId ? state.openCases.find((item) => item.id === active.sourceCaseId) : null);
  applyExpansionResolution(state, definition, choiceId);
  applyLifeEchoResolution(state, definition, choiceId, active.sourceCaseId ? state.openCases.find((item) => item.id === active.sourceCaseId) : null);
  applyLifeDepthResolution(state, definition, choiceId);
  applyLifeContentResolution(state, definition, choiceId);
  if (definition.social3D) state.flags.lastSocial3DWeek = state.time.absoluteWeek;
  state.flags.lastEventResolvedWeek = state.time.absoluteWeek;
  if (!state.events.seen.includes(definition.id)) state.events.seen.push(definition.id);
  if (definition.repeat === "cooldown")
    state.events.cooldowns[definition.id] = state.time.absoluteWeek + definition.cooldownWeeks;
  if (active.sourceCaseId) {
    const openCase = state.openCases.find((item) => item.id === active.sourceCaseId);
    if (openCase) openCase.status = "resolved";
  }
  addEventHistory(state, {
    occurrenceId: active.occurrenceId,
    eventId: definition.id,
    choiceId,
    week: state.time.absoluteWeek,
  });
  state.events.active = null;
  // Content cadence gets one bounded slot. Resolving it must not immediately
  // open a second production-pool event in the same week; explicitly queued
  // chain/case work still keeps its normal priority.
  if (!definition.lifeContent || state.events.queue.length) activateNextEvent(state);
  return { ok: true, message: choice.effects.memory || `${definition.title}: ${choice.label}` };
}

export function processDueOpenCases(state) {
  if (state.lifetime?.death) return [];
  processHouseholdCases(state);
  processParenthoodCases(state);
  expireDepthCases(state);
  expireDepth2Cases(state);
  processDepth3OpenCases(state);
  const triggered = [];
  for (const openCase of state.openCases) {
    if (openCase.status === "pending" && openCase.dueWeek <= state.time.absoluteWeek) {
      if (enqueueEvent(state, openCase.eventId, openCase.id)) {
        openCase.status = "triggered";
        triggered.push(openCase.id);
      }
    }
  }
  return triggered;
}
