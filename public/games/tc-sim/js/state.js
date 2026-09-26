import { normalizeLifetime, validateLifetime } from "./lifetime.js?v=10";
import { neutralWealth, normalizeWealth, validateWealth } from "./wealth.js?v=10";
import { neutralParenthood, normalizeParenthood, validateParenthood } from "./parenthood.js?v=10";
import {
  normalizeHousehold,
  HOUSEHOLD_HISTORY_LIMIT,
  neutralUnion,
  FAMILY_INTENTS,
} from "./household.js?v=10";
import { ensureBodyState } from "./body-systems.js?v=10";
import { getHomeById, getJobById } from "./catalog.js?v=10";
import { PRESENT_DAY_ERA_ID, getEraById } from "./eras.js?v=10";
import { isEducationLevel, isValidActiveEducation } from "./education.js?v=10";
import {
  applyFamilyStartFlags,
  resolveFamilyType,
  resolveNetworkMode,
  selectNetworkPeople,
} from "./network.js?v=10";
import { ensureLifeDepthState, neutralLifeDepth, validateLifeDepthState } from "./life-depth.js?v=10";
import { createScenario } from "./historical-scenarios.js?v=10";

export const SAVE_VERSION = 6;
export const WEEKS_PER_MONTH = 4;
export const MONTHS_PER_YEAR = 12;
/** Haftanın kullanılabilir zaman/odak blokları. Eski kayıtların `used` alanı korunur. */
export const WEEKLY_ACTIVITY_LIMIT = 6;
/** Bu eşiğin altında beden kendini taşıyamaz: haftalık odak bütçesi düşer. */
export const CRITICAL_HEALTH = 15;
export const CRITICAL_HEALTH_ACTIVITY_LIMIT = 3;

/**
 * O haftaki gerçek karar hakkı. Kritik sağlıkta düşer; sağlık toparlanınca
 * kendiliğinden geri gelir. Doğrulama sınırı (WEEKLY_ACTIVITY_LIMIT) hiç
 * değişmez: hakkı zaten harcanmış bir hafta geçersiz duruma düşmez.
 */
export function getWeeklyActivityLimit(state) {
  const health = state?.health?.health;
  if (Number.isFinite(health) && health <= CRITICAL_HEALTH) return CRITICAL_HEALTH_ACTIVITY_LIMIT;
  return WEEKLY_ACTIVITY_LIMIT;
}

export const isCriticalHealth = (state) =>
  Number.isFinite(state?.health?.health) && state.health.health <= CRITICAL_HEALTH;

const LIMITS = {
  memories: 200,
  npcMemories: 50,
  eventHistory: 200,
  // Sixty annual snapshots still cover an entire adult life while keeping
  // 90+ saves below the storage budget. Lifetime reports separately archive
  // the final eight years, so generation handoff does not depend on this tail.
  yearlyHistory: 56,
  careerHistory: 40,
  secrets: 30,
  comparisonMilestones: 24,
  favors: 30,
  reputationEvidence: 60,
};

export const BACKGROUND_OPTIONS = {
  family: {
    supportive: "Destekleyici aile",
    demanding: "Beklentisi yüksek aile",
    strained: "Maddi olarak zorlanan aile",
  },
  economic: { tight: "Sıkışık başlangıç", modest: "Mütevazı başlangıç", stable: "Dengeli birikim" },
  education: {
    general: "Genel lise",
    vocational: "Meslek lisesi",
    unfinished: "Yarım kalmış eğitim",
  },
  social: { close: "Yakın çevre", broad: "Geniş çevre", family: "Aile merkezli" },
  familyType: {
    nuclear: "Çekirdek Aile",
    extended: "Geniş Aile",
    stem: "Kök Aile",
    single: "Tek Ebeveynli Aile",
    random: "Rastgele",
  },
};

const DEFAULT_TENDENCIES = { risk: 50, discipline: 50, sociability: 50, frugality: 50 };

export function adjustTendency(state, key, amount) {
  if (!state?.player?.tendencies || !(key in DEFAULT_TENDENCIES) || !Number.isFinite(amount))
    return false;
  state.player.tendencies[key] = clamp(state.player.tendencies[key] + amount);
  return true;
}

export function getTendencyLabel(key, value) {
  const labels = {
    risk: ["Temkinli", "Dengeli", "Atılgan"],
    discipline: ["Dağınık", "Dengeli", "Disiplinli"],
    sociability: ["İçe dönük", "Dengeli", "Sosyal"],
    frugality: ["Harcamacı", "Dengeli", "Tutumlu"],
  };
  const scale = labels[key] || labels.discipline;
  return scale[value < 34 ? 0 : value < 67 ? 1 : 2];
}

export const PRIORITY_OPTIONS = {
  career: "Kariyer",
  education: "Eğitim",
  money: "Para ve borç",
  health: "Sağlık",
  relationship: "İlişki",
  independence: "Bağımsızlık",
};

export function setYearlyPriorities(state, priorities) {
  if (!state?.yearlyPlan || !Array.isArray(priorities)) return false;
  state.yearlyPlan.priorities = priorities
    .filter((id) => Object.hasOwn(PRIORITY_OPTIONS, id))
    .filter((id, index, list) => list.indexOf(id) === index)
    .slice(0, 2);
  return true;
}

export function recordComparisonMilestone(state, entry) {
  if (!state?.comparisonCircle) return false;
  appendCapped(state.comparisonCircle.milestones, {
    week: state.time.absoluteWeek,
    year: state.time.year,
    ...entry,
  }, LIMITS.comparisonMilestones);
  return true;
}

export function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Number(value)));
}

export function appendCapped(list, item, limit) {
  list.push(item);
  if (list.length > limit) list.splice(0, list.length - limit);
}

/** Kayıtta görünen etiketten başlangıç profilini güvenle türetir. */
export function getStartingProfileId(state) {
  const profile = state?.player?.profile;
  if (profile === "Hırslı başlangıç") return "ambitious";
  if (profile === "Sosyal başlangıç") return "social";
  return "balanced";
}

function profileSettings(profile) {
  const profiles = {
    balanced: { label: "Dengeli başlangıç", balance: 5000, energy: 76, stress: 24 },
    ambitious: { label: "Hırslı başlangıç", balance: 6500, energy: 68, stress: 34 },
    social: { label: "Sosyal başlangıç", balance: 4000, energy: 80, stress: 20 },
  };
  return profiles[profile] || profiles.balanced;
}

export function createNewGame(options = {}) {
  const profile = profileSettings(options.profile);
  const now = options.now || new Date().toISOString();
  const seed = Number.isInteger(options.seed) ? options.seed >>> 0 : 20270101;
  const scenario = createScenario(options.eraId, seed);
  const startingYear = scenario?.startYear || 2027;
  const socialBonus = options.profile === "social" ? 6 : 0;
  const background = {
    family: Object.hasOwn(BACKGROUND_OPTIONS.family, options.familyBackground)
      ? options.familyBackground
      : "supportive",
    economic: Object.hasOwn(BACKGROUND_OPTIONS.economic, options.economicBackground)
      ? options.economicBackground
      : "modest",
    education: Object.hasOwn(BACKGROUND_OPTIONS.education, options.educationBackground)
      ? options.educationBackground
      : "general",
    social: Object.hasOwn(BACKGROUND_OPTIONS.social, options.socialBackground)
      ? options.socialBackground
      : "close",
  };
  const economicBalance = { tight: -1000, modest: 0, stable: 1000 }[background.economic];
  const familyRelationship = { supportive: 0, demanding: -4, strained: -8 }[background.family];
  const socialRelationship = { close: 0, broad: 3, family: -2 }[background.social];
  const educationFields = background.education === "vocational" ? ["technical"] : [];
  const tendencies = {
    ...DEFAULT_TENDENCIES,
    risk: options.profile === "ambitious" ? 56 : 50,
    sociability: options.profile === "social" ? 58 : 50,
    frugality: background.economic === "tight" ? 56 : 50,
    discipline: background.education === "vocational" ? 54 : 50,
  };
  const militaryApplicable = options.militaryApplicable === true;
  const familyType = resolveFamilyType(options);
  const networkMode = resolveNetworkMode(options);
  const extras = selectNetworkPeople(familyType, networkMode, 1);
  const people = [...createDefaultPeople(1), ...extras.filter((p) => !createDefaultPeople(1).some((d) => d.id === p.id))];
  const relationships = {
    anne: Math.max(0, Math.min(100, 70 + socialBonus + familyRelationship)),
    baba: 64,
    mehmet: Math.max(0, Math.min(100, 52 + socialBonus + socialRelationship)),
    elif: 38,
    selin: 44,
    emre: 44,
    burak: 48,
  };
  for (const person of extras) {
    if (!(person.id in relationships)) relationships[person.id] = Math.max(8, Math.min(50, person.social?.trust || 24));
  }

  const state = {
    meta: {
      saveVersion: SAVE_VERSION,
      gameId: options.gameId || `tc-${seed}-${String(options.name || "oyuncu").length}`,
      createdAt: now,
      updatedAt: now,
      rngState: seed || 1,
      startYear: startingYear,
      yearStartBalance: profile.balance + economicBalance,
      yearStartHealth: { energy: profile.energy, stress: profile.stress, health: 82 },
      yearStartRelationships: {
        anne: relationships.anne,
        baba: relationships.baba,
        mehmet: relationships.mehmet,
        elif: relationships.elif,
        selin: relationships.selin,
        emre: relationships.emre,
        burak: relationships.burak,
      },
    },
    player: {
      name:
        String(options.name || "Deniz")
          .trim()
          .slice(0, 40) || "Deniz",
      gender: ["woman", "man", "unspecified"].includes(options.gender)
        ? options.gender
        : "unspecified",
      profile: profile.label,
      background,
      familyType,
      networkMode,
      tendencies,
      age: 18,
      city: "İstanbul",
    },
    world: { eraId: getEraById(options.eraId)?.id || PRESENT_DAY_ERA_ID, ...(scenario ? { scenario } : {}) },
    time: {
      year: startingYear,
      month: scenario ? Number(scenario.startDate.slice(5, 7)) : 1,
      weekOfMonth: scenario ? Math.ceil(Number(scenario.startDate.slice(8, 10)) / 7) : 1,
      absoluteWeek: 1,
    },
    wealth: neutralWealth(),
    finances: {
      balance: profile.balance + economicBalance,
      otherMonthlyIncome: 0,
      otherMonthlyExpenses: 5000,
      arrears: 0,
      distressMonths: 0,
      ledger: [],
    },
    career: {
      jobId: "market",
      pendingJob: null,
      jobFamilyExperience: {},
      performance: 50,
      weeksInRole: 0,
      history: [],
      retirement: {
        status: "working",
        plannedWeek: null,
        deferredUntil: null,
        retiredWeek: null,
        monthlyIncome: 0,
        lastJobId: null,
      },
    },
    education: { level: "lise", fields: educationFields, active: null, tuitionOwedThisMonth: 0 },
    parenthood: neutralParenthood(),
    household: { homeId: "family", livingWithFamily: true, union: neutralUnion(), history: [] },
    people,
    relationships,
    social: { currentPartnerNpcId: null, lastMaintenanceWeek: 0, engaged: false },
    health: { energy: profile.energy, stress: profile.stress, health: 82 },
    body: { exposures: { overwork: 0, underRecovery: 0, inactivity: 0 }, conditions: [] },
    memories: [],
    flags: {},
    openCases: [],
    events: { active: null, queue: [], seen: [], cooldowns: {}, history: [] },
    weekly: { used: 0, selectedIds: [] },
    yearlyHistory: [],
    yearlyPlan: { year: startingYear, priorities: [], progress: {} },
    secrets: [],
    favors: [],
    reputation: { evidence: [] },
    perception: { circles: {} },
    comparisonCircle: {
      peers: [
        { id: "comparison-cousin", name: "Selin", relation: "Kuzen", status: "Yeni bir iş arıyor" },
        {
          id: "comparison-classmate",
          name: "Emre",
          relation: "Eski sınıf arkadaşı",
          status: "Eğitimine devam ediyor",
        },
      ],
      milestones: [],
    },
    military: {
      applicable: militaryApplicable,
      status: militaryApplicable ? "pending" : "not_applicable",
      dueWeek: militaryApplicable ? 96 : null,
    },
    lifeDepth: neutralLifeDepth({ player: { age: 18 } }),
  };
  state.flags.networkMode = networkMode;
  applyFamilyStartFlags(state, familyType);
  return state;
}

export function nextRandom(state) {
  let x = state.meta.rngState >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  state.meta.rngState = x >>> 0 || 1;
  return state.meta.rngState / 4294967296;
}

export function transact(state, amount, reason, category = "other") {
  if (state.lifetime?.death) return;
  if (!Number.isFinite(amount)) throw new Error("Geçersiz para işlemi");
  const rounded = Math.round(amount);
  state.finances.balance += rounded;
  if (!Number.isFinite(state.finances.balance)) throw new Error("Kasa geçersiz duruma geldi");
  appendCapped(
    state.finances.ledger,
    { week: state.time.absoluteWeek, amount: rounded, reason, category },
    120,
  );
}

export function adjustHealth(state, changes) {
  for (const key of ["energy", "stress", "health"]) {
    if (changes[key] !== undefined) state.health[key] = clamp(state.health[key] + changes[key]);
  }
}

export function updateRelationship(state, personId, amount) {
  if (state.people.find((p) => p.id === personId)?.deceased) return false;
  if (!(personId in state.relationships) || !Number.isFinite(amount)) return false;
  state.relationships[personId] = clamp(state.relationships[personId] + amount);
  return true;
}

export function addMemory(state, text, importance = "normal") {
  appendCapped(
    state.memories,
    {
      id: `m-${state.time.absoluteWeek}-${state.memories.length + 1}`,
      week: state.time.absoluteWeek,
      year: state.time.year,
      text,
      importance,
    },
    LIMITS.memories,
  );
}

export function addNpcMemory(state, personId, text, type = "general", metadata = null) {
  const person = state.people.find((candidate) => candidate.id === personId);
  if (!person) return false;
  appendCapped(
    person.memories,
    {
      id: `npc-${personId}-${state.time.absoluteWeek}-${person.memories.length + 1}`,
      type,
      week: state.time.absoluteWeek,
      year: state.time.year,
      text,
      ...(metadata ? { metadata } : {}),
    },
    LIMITS.npcMemories,
  );
  return true;
}

export function addEventHistory(state, entry) {
  appendCapped(state.events.history, entry, LIMITS.eventHistory);
}

export function addYearHistory(state, entry) {
  appendCapped(state.yearlyHistory, entry, LIMITS.yearlyHistory);
}

export function addCareerHistory(state, entry) {
  if (!state?.career) return;
  if (!Array.isArray(state.career.history)) state.career.history = [];
  appendCapped(state.career.history, {
    week: state.time.absoluteWeek,
    year: state.time.year,
    ...entry,
  }, LIMITS.careerHistory);
}

const safeCount = (value) => (Number.isInteger(value) && value >= 0 ? value : 0);

const SOCIAL_DEFAULTS = {
  anne: { roleId: "family", tags: ["family"], trust: 72, romanceStatus: "none" },
  baba: { roleId: "family", tags: ["family"], trust: 64, romanceStatus: "none" },
  mehmet: { roleId: "friend", tags: ["friend"], trust: 54, romanceStatus: "none" },
  elif: {
    roleId: "acquaintance",
    tags: ["peer", "romance_available"],
    trust: 42,
    romanceStatus: "none",
  },
  selin: {
    roleId: "acquaintance",
    tags: ["peer", "weak_tie"],
    trust: 44,
    romanceStatus: "none",
    relationType: "Kuzen",
    circles: ["family", "acquaintances"],
    contactCategory: "weak",
  },
  emre: {
    roleId: "acquaintance",
    tags: ["peer", "weak_tie"],
    trust: 44,
    romanceStatus: "none",
    relationType: "Eski sınıf arkadaşı",
    circles: ["friends", "acquaintances"],
    contactCategory: "weak",
  },
  burak: {
    roleId: "work_contact",
    tags: ["professional", "weak_tie"],
    trust: 48,
    romanceStatus: "none",
    relationType: "Eski iş bağlantısı",
    circles: ["professional", "acquaintances"],
    contactCategory: "former",
  },
};

function createDefaultPeople(startWeek = 1) {
  return [
    { id: "anne", name: "Aylin", relationType: "Anne", memories: [] },
    { id: "baba", name: "Murat", relationType: "Baba", memories: [] },
    { id: "mehmet", name: "Mehmet", relationType: "Arkadaş", memories: [] },
    { id: "elif", name: "Elif", relationType: "Tanıdık", memories: [] },
    { id: "selin", name: "Selin", relationType: "Kuzen", memories: [] },
    { id: "emre", name: "Emre", relationType: "Eski sınıf arkadaşı", memories: [] },
    { id: "burak", name: "Burak", relationType: "Eski iş bağlantısı", memories: [] },
  ].map((person) => ({
    ...person,
    roleId: SOCIAL_DEFAULTS[person.id].roleId,
    tags: [...SOCIAL_DEFAULTS[person.id].tags],
    circles: [
      ...(SOCIAL_DEFAULTS[person.id].circles ||
        (SOCIAL_DEFAULTS[person.id].roleId === "family" ? ["family"] : ["friends"])),
    ],
    contactCategory: SOCIAL_DEFAULTS[person.id].contactCategory || "close",
    dormant: false,
    lifeState: {
      employment: null,
      education: null,
      residence: null,
      relationship: "single",
      concern: null,
    },
    lifeMilestones: [],
    knownMilestones: [],
    available: true,
    social: {
      trust: SOCIAL_DEFAULTS[person.id].trust,
      tension: 0,
      lastMeaningfulContactWeek: startWeek,
      romanceStatus: SOCIAL_DEFAULTS[person.id].romanceStatus,
    },
  }));
}

const safeRelationshipValue = (value, fallback) => {
  const numeric = typeof value === "number" ? value : Number.NaN;
  return Number.isFinite(numeric) ? clamp(numeric) : fallback;
};

export function normalizeSocialState(state) {
  if (!state || typeof state !== "object" || Array.isArray(state)) return state;
  const defaults = createDefaultPeople(state.time?.absoluteWeek || 1);
  const rawPeople = Array.isArray(state.people) ? state.people : [];
  const rawRelationships =
    state.relationships &&
    typeof state.relationships === "object" &&
    !Array.isArray(state.relationships)
      ? state.relationships
      : {};
  const hydrate = (fallback, raw, socialDefault) => {
    const source = raw || fallback;
    const social = source.social && typeof source.social === "object" ? source.social : {};
    const memories = Array.isArray(source.memories)
      ? source.memories
          .slice(-LIMITS.npcMemories)
          .filter((memory) => memory && typeof memory.text === "string")
          .map((memory, index) => ({
            ...memory,
            id:
              typeof memory.id === "string" && memory.id
                ? memory.id
                : `npc-${fallback.id}-${safeCount(memory.week) || 1}-${index + 1}`,
            type: typeof memory.type === "string" && memory.type ? memory.type : "general",
            week: safeCount(memory.week) || 1,
            year: Number.isInteger(memory.year) ? memory.year : state.time?.year || 2027,
          }))
      : [];
    const roleId = ["family", "friend", "acquaintance", "work_contact"].includes(source.roleId)
      ? source.roleId
      : fallback.roleId;
    return {
      ...fallback,
      ...source,
      id: fallback.id,
      name: typeof source.name === "string" && source.name ? source.name : fallback.name,
      relationType:
        typeof source.relationType === "string" && source.relationType
          ? source.relationType
          : fallback.relationType,
      roleId,
      tags: Array.isArray(source.tags) ? source.tags.filter((v) => typeof v === "string").slice(0, 8) : [...fallback.tags],
      circles: Array.isArray(source.circles) ? [...new Set(source.circles.filter((value) => typeof value === "string"))].slice(0, 4) : [...fallback.circles],
      contactCategory: typeof source.contactCategory === "string" ? source.contactCategory : fallback.contactCategory,
      dormant: source.dormant === true,
      lifeState: {
        employment: typeof source.lifeState?.employment === "string" ? source.lifeState.employment : fallback.lifeState?.employment || null,
        education: typeof source.lifeState?.education === "string" ? source.lifeState.education : null,
        residence: typeof source.lifeState?.residence === "string" ? source.lifeState.residence : null,
        relationship: typeof source.lifeState?.relationship === "string" ? source.lifeState.relationship : "single",
        concern: typeof source.lifeState?.concern === "string" ? source.lifeState.concern : null,
      },
      lifeMilestones: Array.isArray(source.lifeMilestones) ? source.lifeMilestones.slice(-12) : [],
      knownMilestones: Array.isArray(source.knownMilestones) ? [...new Set(source.knownMilestones.filter((value) => typeof value === "string"))].slice(-12) : [],
      available: source.available !== false,
      romanceEligible: source.romanceEligible === true && roleId !== "family",
      possibleFavors: Array.isArray(source.possibleFavors) ? source.possibleFavors.slice(0, 6) : [],
      networkEdges: Array.isArray(source.networkEdges) ? source.networkEdges.filter((id) => typeof id === "string").slice(0, 6) : [],
      memories,
      social: {
        trust: safeRelationshipValue(social.trust, socialDefault?.trust ?? 40),
        tension: safeRelationshipValue(social.tension, 0),
        lastMeaningfulContactWeek:
          Number.isInteger(social.lastMeaningfulContactWeek) && social.lastMeaningfulContactWeek >= 1
            ? Math.min(social.lastMeaningfulContactWeek, state.time?.absoluteWeek || 1)
            : state.time?.absoluteWeek || 1,
        romanceStatus:
          roleId !== "family" && ["none", "interest", "partner"].includes(social.romanceStatus)
            ? social.romanceStatus
            : "none",
        visibility: typeof social.visibility === "string" ? social.visibility : "heard_of",
      },
    };
  };
  const core = defaults.map((fallback) => {
    const raw = rawPeople.find((person) => person?.id === fallback.id) || fallback;
    return hydrate(fallback, raw, SOCIAL_DEFAULTS[fallback.id]);
  });
  const extras = rawPeople
    .filter((person) => person?.id && !SOCIAL_DEFAULTS[person.id])
    .slice(0, 48)
    .map((raw) =>
      hydrate(
        {
          id: raw.id,
          name: raw.name || raw.id,
          relationType: raw.relationType || "Tanıdık",
          roleId: ["family", "friend", "acquaintance", "work_contact"].includes(raw.roleId) ? raw.roleId : "acquaintance",
          tags: Array.isArray(raw.tags) ? raw.tags : ["peer"],
          circles: ["acquaintances"],
          contactCategory: "weak",
          lifeState: { employment: null, education: null, residence: null, relationship: "single", concern: null },
        },
        raw,
        { trust: 28 },
      ),
    );
  state.people = [...core, ...extras];
  const extendedSave = rawPeople.some((person) => ["selin", "emre", "burak"].includes(person?.id)) && ["selin", "emre", "burak"].some((id) => Object.hasOwn(rawRelationships, id));
  const extraIds = new Set(extras.map((p) => p.id));
  state.relationships = Object.fromEntries(
    state.people
      .filter((person) => extraIds.has(person.id) || extendedSave || !["selin", "emre", "burak"].includes(person.id))
      .map((person) => [
        person.id,
        safeRelationshipValue(
          rawRelationships[person.id],
          person.id === "anne" ? 70 : person.id === "baba" ? 64 : person.id === "mehmet" ? 52 : person.id === "elif" ? 38 : 44,
        ),
      ]),
  );
  const rawSocial = state.social && typeof state.social === "object" ? state.social : {};
  const partnerCandidates = state.people.filter((person) => person.social.romanceStatus === "partner");
  const requestedPartner = state.people.find(
    (person) =>
      person.id === rawSocial.currentPartnerNpcId &&
      person.roleId !== "family" &&
      (person.tags.includes("romance_available") || person.romanceEligible),
  );
  const partner = requestedPartner || partnerCandidates[0] || null;
  for (const person of state.people)
    if (person.id !== partner?.id && person.social.romanceStatus === "partner")
      person.social.romanceStatus = "interest";
  if (partner) partner.social.romanceStatus = "partner";
  state.social = {
    currentPartnerNpcId: partner?.id || null,
    engaged: rawSocial.engaged === true,
    lastMaintenanceWeek:
      Number.isInteger(rawSocial.lastMaintenanceWeek) && rawSocial.lastMaintenanceWeek >= 0
        ? Math.min(rawSocial.lastMaintenanceWeek, state.time?.absoluteWeek || 1)
        : 0,
  };
  if (typeof state.player === "object" && state.player) {
    if (!["nuclear", "extended", "stem", "single"].includes(state.player.familyType))
      state.player.familyType = "nuclear";
    if (!["tight", "normal", "wide"].includes(state.player.networkMode))
      state.player.networkMode = state.player.background?.social === "broad" ? "wide" : "tight";
  }
  state.flags = state.flags && typeof state.flags === "object" ? state.flags : {};
  if (!state.flags.familyType) state.flags.familyType = state.player?.familyType || "nuclear";
  if (!state.flags.networkMode) state.flags.networkMode = state.player?.networkMode || "tight";
  return state;
}

/**
 * Eğitim ve kariyer alanlarını her migration dalından sonra güvenli hale getirir.
 * Bozuk tek bir alan yüzünden kaydın tamamı çöpe atılmaz; alan güvenli varsayılana döner.
 * Geçmişe dönük deneyim tahmini yapılmaz.
 */
export function normalizeEducationCareer(state) {
  if (!state || typeof state !== "object" || Array.isArray(state)) return state;

  const finances = state.finances && typeof state.finances === "object" ? state.finances : {};
  state.yearlyHistory = Array.isArray(state.yearlyHistory)
    ? state.yearlyHistory.slice(-LIMITS.yearlyHistory)
    : [];
  state.finances = {
    ...finances,
    arrears: Number.isFinite(finances.arrears) ? Math.max(0, Math.min(300000, Math.round(finances.arrears))) : 0,
    distressMonths: Number.isInteger(finances.distressMonths) ? Math.max(0, Math.min(999, finances.distressMonths)) : 0,
  };
  const career = state.career && typeof state.career === "object" ? state.career : {};
  const rawRetirement =
    career.retirement && typeof career.retirement === "object" ? career.retirement : {};
  const retirementStatus = ["working", "planned", "retired"].includes(rawRetirement.status)
    ? rawRetirement.status
    : "working";
  const rawExperience = career.jobFamilyExperience;
  const experience = {};
  if (rawExperience && typeof rawExperience === "object" && !Array.isArray(rawExperience)) {
    for (const [familyId, weeks] of Object.entries(rawExperience)) {
      if (typeof familyId !== "string" || !familyId) continue;
      experience[familyId] = safeCount(weeks);
    }
  }
  // Kariyer nesnesi tamamen kayıpsa yalnız eksik anahtarlar güvenli varsayılana döner:
  // olmayan iş uydurulmaz, karakter işsiz sayılır. Geçersiz (ama var olan) değerler
  // doğrulamaya bırakılır; mevcut kurtarma sözleşmesi gevşetilmez.
  state.career = {
    ...career,
    jobId: career.jobId === undefined ? null : career.jobId,
    pendingJob: career.pendingJob === undefined ? null : career.pendingJob,
    jobFamilyExperience: experience,
    performance: Number.isFinite(career.performance) ? clamp(career.performance) : 50,
    weeksInRole: safeCount(career.weeksInRole),
    history: Array.isArray(career.history) ? career.history.slice(-LIMITS.careerHistory) : [],
    retirement: {
      status: retirementStatus,
      plannedWeek: Number.isInteger(rawRetirement.plannedWeek) ? rawRetirement.plannedWeek : null,
      deferredUntil: Number.isInteger(rawRetirement.deferredUntil) ? rawRetirement.deferredUntil : null,
      retiredWeek: retirementStatus === "retired" && Number.isInteger(rawRetirement.retiredWeek) ? rawRetirement.retiredWeek : null,
      monthlyIncome: retirementStatus === "retired" && Number.isFinite(rawRetirement.monthlyIncome)
        ? Math.max(0, Math.round(rawRetirement.monthlyIncome))
        : 0,
      lastJobId: rawRetirement.lastJobId === null || getJobById(rawRetirement.lastJobId) ? rawRetirement.lastJobId || null : null,
    },
  };
  // Eski kayıtlar için nötr varsayılan: yalnız açıkça emekli olarak kaydedilmiş
  // bir durum işi kapatır. Yaşa bakarak geriye dönük emeklilik üretilmez.
  if (state.career.retirement.status === "retired") {
    state.career.jobId = null;
    state.career.pendingJob = null;
  }

  const raw = state.education && typeof state.education === "object" ? state.education : {};
  const fields = [];
  if (Array.isArray(raw.fields)) {
    for (const field of raw.fields)
      if (typeof field === "string" && field && !fields.includes(field)) fields.push(field);
  }
  state.education = {
    level: isEducationLevel(raw.level) ? raw.level : "lise",
    fields,
    active: isValidActiveEducation(raw.active) ? raw.active : null,
    tuitionOwedThisMonth: safeCount(raw.tuitionOwedThisMonth),
  };
  const rawPlayer = state.player && typeof state.player === "object" ? state.player : {};
  const rawBackground = rawPlayer.background && typeof rawPlayer.background === "object" ? rawPlayer.background : {};
  state.player = {
    ...rawPlayer,
    background: {
      family: Object.hasOwn(BACKGROUND_OPTIONS.family, rawBackground.family) ? rawBackground.family : "supportive",
      economic: Object.hasOwn(BACKGROUND_OPTIONS.economic, rawBackground.economic) ? rawBackground.economic : "modest",
      education: Object.hasOwn(BACKGROUND_OPTIONS.education, rawBackground.education) ? rawBackground.education : "general",
      social: Object.hasOwn(BACKGROUND_OPTIONS.social, rawBackground.social) ? rawBackground.social : "close",
    },
    tendencies: Object.fromEntries(Object.keys(DEFAULT_TENDENCIES).map((key) => [
      key,
      Number.isFinite(rawPlayer.tendencies?.[key]) ? clamp(rawPlayer.tendencies[key]) : DEFAULT_TENDENCIES[key],
    ])),
  };
  const rawPlan = state.yearlyPlan && typeof state.yearlyPlan === "object" ? state.yearlyPlan : {};
  state.yearlyPlan = {
    year: Number.isInteger(rawPlan.year) ? rawPlan.year : state.time.year,
    priorities: Array.isArray(rawPlan.priorities)
      ? rawPlan.priorities.filter((id) => Object.hasOwn(PRIORITY_OPTIONS, id)).slice(0, 2)
      : [],
    progress: rawPlan.progress && typeof rawPlan.progress === "object" ? rawPlan.progress : {},
  };
  const rawBody = state.body && typeof state.body === "object" ? state.body : {};
  const rawExposures =
    rawBody.exposures && typeof rawBody.exposures === "object" ? rawBody.exposures : {};
  state.body = {
    exposures: Object.fromEntries(
      ["overwork", "underRecovery", "inactivity"].map((key) => [
        key,
        Number.isFinite(rawExposures[key]) ? clamp(rawExposures[key]) : 0,
      ]),
    ),
    conditions: Array.isArray(rawBody.conditions)
      ? rawBody.conditions.filter((item) => item?.id).slice(-8)
      : [],
    warningAcknowledged: Boolean(rawBody.warningAcknowledged),
    warningAvailable: Boolean(rawBody.warningAvailable),
  };
  ensureBodyState(state);
  state.secrets = Array.isArray(state.secrets)
    ? state.secrets
        .filter((secret) => secret?.id && ["hidden", "exposed", "resolved"].includes(secret.status))
        .slice(-LIMITS.secrets)
        .map((secret) => ({
          id: String(secret.id),
          type: typeof secret.type === "string" ? secret.type : "personal",
          summary: typeof secret.summary === "string" ? secret.summary : "Özel bir mesele",
          createdWeek: Number.isInteger(secret.createdWeek)
            ? Math.max(1, secret.createdWeek)
            : state.time.absoluteWeek,
          status: secret.status,
          relatedPeople: Array.isArray(secret.relatedPeople)
            ? secret.relatedPeople.filter((id) => typeof id === "string").slice(0, 4)
            : [],
          knownBy: Array.isArray(secret.knownBy)
            ? [...new Set(secret.knownBy.filter((id) => typeof id === "string"))]
            : ["player"],
          hiddenFrom: Array.isArray(secret.hiddenFrom)
            ? [...new Set(secret.hiddenFrom.filter((id) => typeof id === "string"))].slice(0, 4)
            : [],
          evidence: ["none", "weak", "strong"].includes(secret.evidence) ? secret.evidence : "none",
          ...(Number.isInteger(secret.exposedWeek) ? { exposedWeek: secret.exposedWeek } : {}),
          ...(Number.isInteger(secret.resolvedWeek) ? { resolvedWeek: secret.resolvedWeek } : {}),
          ...(typeof secret.sourceEvent === "string" ? { sourceEvent: secret.sourceEvent } : {}),
        }))
    : [];
  const rawCircle =
    state.comparisonCircle && typeof state.comparisonCircle === "object"
      ? state.comparisonCircle
      : {};
  const defaultPeers = [
    { id: "comparison-cousin", name: "Selin", relation: "Kuzen", status: "Yeni bir iş arıyor" },
    {
      id: "comparison-classmate",
      name: "Emre",
      relation: "Eski sınıf arkadaşı",
      status: "Eğitimine devam ediyor",
    },
  ];
  const peers = defaultPeers.map((fallback) => {
    const raw = Array.isArray(rawCircle.peers)
      ? rawCircle.peers.find((peer) => peer?.id === fallback.id)
      : null;
    return {
      ...fallback,
      ...(raw || {}),
      id: fallback.id,
      name: typeof raw?.name === "string" && raw.name ? raw.name : fallback.name,
      relation:
        typeof raw?.relation === "string" && raw.relation ? raw.relation : fallback.relation,
      status: typeof raw?.status === "string" && raw.status ? raw.status : fallback.status,
      milestones: Array.isArray(raw?.milestones) ? raw.milestones.slice(-8) : [],
      memories: Array.isArray(raw?.memories) ? raw.memories.slice(-12) : [],
    };
  });
  state.comparisonCircle = {
    peers,
    milestones: Array.isArray(rawCircle.milestones)
      ? rawCircle.milestones.slice(-LIMITS.comparisonMilestones)
      : [],
  };
  const rawFavors = Array.isArray(state.favors) ? state.favors : [];
  state.favors = rawFavors
    .filter((item) => item?.id && item?.personId)
    .slice(-LIMITS.favors)
    .map((item) => ({
      ...item,
      direction: item.direction === "npc_owes" ? "npc_owes" : "player_owes",
      status: item.status === "resolved" ? "resolved" : "open",
    }));
  const rawReputation = state.reputation && typeof state.reputation === "object" ? state.reputation : {};
  state.reputation = {
    evidence: Array.isArray(rawReputation.evidence) ? rawReputation.evidence.filter((item) => item?.circle && item?.signal).slice(-LIMITS.reputationEvidence) : [],
  };
  const rawPerception = state.perception && typeof state.perception === "object" ? state.perception : {};
  state.perception = { circles: rawPerception.circles && typeof rawPerception.circles === "object" ? rawPerception.circles : {} };
  const rawMilitary = state.military && typeof state.military === "object" ? state.military : {};
  state.military = {
    applicable: rawMilitary.applicable === true,
    status: rawMilitary.applicable === true && ["pending", "deferred", "completed", "expired"].includes(rawMilitary.status)
      ? rawMilitary.status
      : rawMilitary.applicable === true ? "pending" : "not_applicable",
    dueWeek: rawMilitary.applicable === true && Number.isInteger(rawMilitary.dueWeek) ? rawMilitary.dueWeek : null,
  };
  normalizeSocialState(state);
  normalizeHousehold(state);
  normalizeParenthood(state);
  normalizeWealth(state);
  normalizeLifetime(state);
  ensureLifeDepthState(state);
  return state;
}

export function validateState(state) {
  const errors = [];
  const finite = (value) => typeof value === "number" && Number.isFinite(value);
  if (!state || typeof state !== "object" || Array.isArray(state))
    return { ok: false, errors: ["State nesne değil"] };
  if (state.meta?.saveVersion !== SAVE_VERSION) errors.push("Save sürümü geçersiz");
  if (!validateLifetime(state)) errors.push("Yaşam ve kuşak kaydı geçersiz");
  if (!validateWealth(state)) errors.push("Servet kaydı geçersiz");
  if (!validateLifeDepthState(state)) errors.push("Yaşam arkları geçersiz");
  if (
    !state.player ||
    typeof state.player.name !== "string" ||
    !Number.isInteger(state.player.age) ||
    state.player.age < 0
  )
    errors.push("Oyuncu geçersiz");
  const time = state.time;
  if (
    !time ||
    !Number.isInteger(time.year) ||
    !Number.isInteger(time.month) ||
    time.month < 1 ||
    time.month > MONTHS_PER_YEAR ||
    !Number.isInteger(time.weekOfMonth) ||
    time.weekOfMonth < 1 ||
    time.weekOfMonth > WEEKS_PER_MONTH ||
    !Number.isInteger(time.absoluteWeek) ||
    time.absoluteWeek < 1
  )
    errors.push("Zaman geçersiz");
  if (
    !state.finances ||
    !finite(state.finances.balance) ||
    !finite(state.finances.otherMonthlyIncome) ||
    !finite(state.finances.otherMonthlyExpenses) ||
    !Number.isInteger(state.finances.arrears) ||
    state.finances.arrears < 0 ||
    state.finances.arrears > 300000 ||
    !Number.isInteger(state.finances.distressMonths) ||
    state.finances.distressMonths < 0 ||
    !Array.isArray(state.finances.ledger)
  )
    errors.push("Finans geçersiz");
  if (!state.career || (state.career.jobId !== null && !getJobById(state.career.jobId)))
    errors.push("İş kaydı geçersiz");
  if (
    state.career?.pendingJob !== null &&
    (!state.career?.pendingJob ||
      !getJobById(state.career.pendingJob.jobId) ||
      !Number.isInteger(state.career.pendingJob.startWeek) ||
      typeof state.career.pendingJob.caseId !== "string")
  )
    errors.push("Bekleyen iş kaydı geçersiz");
  const experience = state.career?.jobFamilyExperience;
  if (
    !experience ||
    typeof experience !== "object" ||
    Array.isArray(experience) ||
    Object.values(experience).some((weeks) => !Number.isInteger(weeks) || weeks < 0)
  )
    errors.push("Deneyim kaydı geçersiz");
  if (
    !finite(state.career?.performance) ||
    state.career.performance < 0 ||
    state.career.performance > 100 ||
    !Number.isInteger(state.career?.weeksInRole) ||
    state.career.weeksInRole < 0 ||
    !Array.isArray(state.career?.history)
  )
    errors.push("Kariyer ilerlemesi geçersiz");
  const retirement = state.career?.retirement;
  if (
    !retirement ||
    !["working", "planned", "retired"].includes(retirement.status) ||
    !finite(retirement.monthlyIncome) ||
    retirement.monthlyIncome < 0 ||
    (retirement.status === "retired" && state.career.jobId !== null)
  )
    errors.push("Emeklilik kaydı geçersiz");
  const education = state.education;
  if (
    !education ||
    typeof education !== "object" ||
    Array.isArray(education) ||
    !isEducationLevel(education.level) ||
    !Array.isArray(education.fields) ||
    education.fields.some((field) => typeof field !== "string" || !field) ||
    new Set(education.fields).size !== education.fields.length ||
    !Number.isInteger(education.tuitionOwedThisMonth) ||
    education.tuitionOwedThisMonth < 0 ||
    (education.active !== null && !isValidActiveEducation(education.active))
  )
    errors.push("Eğitim kaydı geçersiz");
  if (!state.household || !getHomeById(state.household.homeId)) errors.push("Konut kaydı geçersiz");
  if (state.household?.union && (
    ["cohabitingSince", "marriedSince", "separatedSince"].some((key) => state.household.union[key] != null && (!Number.isInteger(state.household.union[key]) || state.household.union[key] < 1 || state.household.union[key] > state.time.absoluteWeek)) ||
    (state.household.union.separatedSince && (!state.household.union.marriedSince || state.household.union.cohabitingSince)) ||
    (state.household.union.reconciled !== undefined && typeof state.household.union.reconciled !== "boolean") ||
    (state.household.union.familyPlan && (!Object.hasOwn(FAMILY_INTENTS, state.household.union.familyPlan.intent) || !Object.hasOwn(FAMILY_INTENTS, state.household.union.familyPlan.response))) ||
    (state.household.union.cohabitingSince && (!state.social?.currentPartnerNpcId || state.household.homeId === "family")) ||
    (state.household.union.marriedSince && !state.social?.currentPartnerNpcId) ||
    !Array.isArray(state.household.history) || state.household.history.length > HOUSEHOLD_HISTORY_LIMIT
  )) errors.push("Ortak yaşam kaydı geçersiz");
  if (!validateParenthood(state)) errors.push("Ebeveynlik kaydı geçersiz");
  if (!state.world || !getEraById(state.world.eraId)) errors.push("Dönem kaydı geçersiz");
  if (
    !state.health ||
    ["energy", "stress", "health"].some(
      (key) => !finite(state.health[key]) || state.health[key] < 0 || state.health[key] > 100,
    )
  )
    errors.push("Beden değerleri geçersiz");
  if (state.body && (
    !["overwork", "underRecovery", "inactivity"].every((key) => Number.isFinite(state.body.exposures?.[key]) && state.body.exposures[key] >= 0 && state.body.exposures[key] <= 100) ||
    !Array.isArray(state.body.conditions) || state.body.conditions.length > 8 ||
    new Set(state.body.conditions.map((item) => item.id)).size !== state.body.conditions.length ||
    state.body.conditions.some((item) => !item.id || !["active", "managed", "resolved", "chronic"].includes(item.status) || typeof item.knownToPlayer !== "boolean")
  )) errors.push("Uzun dönem beden kaydı geçersiz");
  if (
    !Array.isArray(state.people) ||
    new Set(state.people.map((person) => person?.id)).size !== state.people.length ||
    state.people.some((person) => !person?.id || !Array.isArray(person.memories))
  )
    errors.push("NPC kayıtları geçersiz");
  if (
    state.people?.some(
      (person) =>
        !["family", "friend", "acquaintance", "work_contact"].includes(person.roleId) ||
        !Array.isArray(person.tags) ||
        typeof person.available !== "boolean" ||
        !person.social ||
        !finite(person.social.trust) ||
        person.social.trust < 0 ||
        person.social.trust > 100 ||
        !finite(person.social.tension) ||
        person.social.tension < 0 ||
        person.social.tension > 100 ||
        !Number.isInteger(person.social.lastMeaningfulContactWeek) ||
        person.social.lastMeaningfulContactWeek < 1 ||
        person.social.lastMeaningfulContactWeek > state.time.absoluteWeek ||
        !["none", "interest", "partner"].includes(person.social.romanceStatus) ||
        (person.roleId === "family" && person.social.romanceStatus !== "none"),
    )
  )
    errors.push("Sosyal NPC kaydı geçersiz");
  if (
    !state.relationships ||
    typeof state.relationships !== "object" ||
    Object.values(state.relationships).some((value) => !finite(value) || value < 0 || value > 100)
  )
    errors.push("İlişkiler geçersiz");
  const partnerId = state.social?.currentPartnerNpcId;
  const partners =
    state.people?.filter((person) => person.social?.romanceStatus === "partner") || [];
  if (
    !state.social ||
    typeof state.social.engaged !== "boolean" ||
    !Number.isInteger(state.social.lastMaintenanceWeek) ||
    state.social.lastMaintenanceWeek < 0 ||
    state.social.lastMaintenanceWeek > state.time.absoluteWeek ||
    (partnerId !== null && !state.people.some((person) => person.id === partnerId)) ||
    partners.length > 1 ||
    (partnerId === null && partners.length) ||
    (partnerId !== null && partners[0]?.id !== partnerId)
  )
    errors.push("Sosyal durum geçersiz");
  if (
    !state.weekly ||
    !Number.isInteger(state.weekly.used) ||
    state.weekly.used < 0 ||
    state.weekly.used > WEEKLY_ACTIVITY_LIMIT ||
    !Array.isArray(state.weekly.selectedIds) ||
    new Set(state.weekly.selectedIds).size !== state.weekly.selectedIds.length
  )
    errors.push("Haftalık aktivite kaydı geçersiz");
  if (
    !Array.isArray(state.memories) ||
    !Array.isArray(state.openCases) ||
    !Array.isArray(state.yearlyHistory)
  )
    errors.push("Geçmiş kayıtları geçersiz");
  if (
    !state.player?.tendencies ||
    Object.keys(DEFAULT_TENDENCIES).some(
      (key) =>
        !finite(state.player.tendencies[key]) ||
        state.player.tendencies[key] < 0 ||
        state.player.tendencies[key] > 100,
    )
  )
    errors.push("Davranış eğilimleri geçersiz");
  if (
    !state.yearlyPlan ||
    !Array.isArray(state.yearlyPlan.priorities) ||
    state.yearlyPlan.priorities.length > 2 ||
    state.yearlyPlan.priorities.some((id) => !Object.hasOwn(PRIORITY_OPTIONS, id))
  )
    errors.push("Yıllık öncelikler geçersiz");
  if (
    !Array.isArray(state.secrets) ||
    state.secrets.some(
      (secret) => !secret?.id || !["hidden", "exposed", "resolved"].includes(secret.status),
    )
  )
    errors.push("Gizli mesele kaydı geçersiz");
  if (
    !Array.isArray(state.favors) ||
    state.favors.some(
      (favor) =>
        !favor?.id ||
        !favor?.personId ||
        !["player_owes", "npc_owes"].includes(favor.direction) ||
        !["open", "resolved"].includes(favor.status),
    )
  )
    errors.push("İyilik kaydı geçersiz");
  if (
    !state.reputation ||
    !Array.isArray(state.reputation.evidence) ||
    state.reputation.evidence.some((item) => !item?.circle || !item?.signal)
  )
    errors.push("Çevre itibarı geçersiz");
  if (!state.perception || typeof state.perception.circles !== "object")
    errors.push("Algı kaydı geçersiz");
  if (
    !state.military ||
    typeof state.military.applicable !== "boolean" ||
    !["pending", "deferred", "completed", "expired", "not_applicable"].includes(
      state.military.status,
    ) ||
    (state.military.applicable === false && state.military.status !== "not_applicable")
  )
    errors.push("Yükümlülük kaydı geçersiz");
  if (
    !state.events ||
    !Array.isArray(state.events.queue) ||
    !Array.isArray(state.events.seen) ||
    !Array.isArray(state.events.history) ||
    typeof state.events.cooldowns !== "object"
  )
    errors.push("Event kayıtları geçersiz");
  if (
    state.openCases?.some(
      (item) =>
        !item?.id ||
        !Number.isInteger(item.dueWeek) ||
        !["pending", "triggered", "resolved"].includes(item.status),
    )
  )
    errors.push("Açık dosya geçersiz");
  return { ok: errors.length === 0, errors };
}

export function assertValidState(state) {
  const result = validateState(state);
  if (!result.ok) throw new Error(result.errors.join("; "));
  return state;
}
