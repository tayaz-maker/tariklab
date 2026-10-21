import { needsParentCare, canTryParenthood, childStage, childAge, childAcademicStanding, isChildIssueKnown, parenthoodSummary, PARENTING_CHAINS } from "../public/games/tc-sim/js/parenthood.js";
/**
 * TC SIM uzun koşu / fuzz doğrulayıcı.
 *
 *   node scripts/tc-sim-longrun.mjs                 # 520 hafta, seed 1
 *   node scripts/tc-sim-longrun.mjs 1040 7          # 1040 hafta, seed 7
 *   node scripts/tc-sim-longrun.mjs fuzz            # 20 seed × 260 hafta
 *
 * Oyuncu eylemleri yalnız arayüzün izin verdiği yollardan (kayıt, bırakma,
 * teklif kabulü, taşınma, haftalık kararlar) seçilir. Her hafta invariant
 * yürüyüşü yapılır; ihlal varsa çıkış kodu 1 olur ve hafta numarasıyla raporlanır.
 */
import { pathToFileURL } from "node:url";
import { continueGeneration, isDeceased } from "../public/games/tc-sim/js/lifetime.js";
import assert from "node:assert/strict";
import { createNewGame, validateState } from "../public/games/tc-sim/js/state.js";
import {
  MONEY_RELIEF_MAX,
  MONEY_RELIEF_MIN,
  acceptJobOffer,
  enrollEducation,
  getCostOfLivingIndex,
  getHomeById,
  getJobById,
  getMonthlyHousingCost,
  getMonthlySummary,
  moveHome,
  stopEducation,
} from "../public/games/tc-sim/js/life.js";
import { JOBS } from "../public/games/tc-sim/js/catalog.js";
import { isEligibleForJob } from "../public/games/tc-sim/js/education.js";
import {
  advanceWeek,
  applyDecision,
  canApplyDecision,
  getAvailableDecisions,
} from "../public/games/tc-sim/js/time.js";
import { getEventDefinition, resolveEvent, getEventChoiceAvailability, activateNextEvent } from "../public/games/tc-sim/js/events.js";
import { EDUCATION_PATHS, getPathById } from "../public/games/tc-sim/js/education.js";
import { getEraById } from "../public/games/tc-sim/js/eras.js";
import { loadGame, saveGame } from "../public/games/tc-sim/js/save.js";
import {
  applySocialAction,
  canUseSocialAction,
  getAvailableSocialActions,
  getRelationship,
} from "../public/games/tc-sim/js/social.js";

class MemoryStorage {
  constructor() {
    this.data = new Map();
  }
  getItem(key) {
    return this.data.get(key) ?? null;
  }
  setItem(key, value) {
    this.data.set(key, String(value));
  }
  removeItem(key) {
    this.data.delete(key);
  }
}

const JOB_IDS = ["market", "courier", "office", "technician", "specialist"];
const HOME_IDS = ["family", "shared", "studio"];

function run(weeks, seed) {
  let state = createNewGame({
    name: "Uzun",
    profile: "balanced",
    seed,
    now: "2027-01-01T00:00:00.000Z",
  });
  const storage = new MemoryStorage();
  const problems = [];
  const seenProblems = new Set();
  const check = (ok, message) => {
    if (ok || seenProblems.has(message)) return;
    seenProblems.add(message);
    problems.push(`hafta ${state.time.absoluteWeek}: ${message}`);
  };

  let rng = seed >>> 0 || 1;
  const rand = () => {
    rng ^= rng << 13;
    rng ^= rng >>> 17;
    rng ^= rng << 5;
    rng >>>= 0;
    return rng / 4294967296;
  };
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const settle = (target) => {
    let guard = 0;
    while (target.events.active && guard++ < 50) {
      const definition = getEventDefinition(target.events.active.eventId);
      resolveEvent(target, pick(definition.choices).id);
    }
  };

  for (let step = 0; step < weeks; step += 1) {
    settle(state);
    if (rand() < 0.05 && !state.education.active)
      enrollEducation(state, pick(EDUCATION_PATHS).id, rand() < 0.5 ? "full" : "part");
    if (rand() < 0.01 && state.education.active) stopEducation(state);
    if (rand() < 0.03) acceptJobOffer(state, pick(JOB_IDS));
    if (rand() < 0.02) moveHome(state, pick(HOME_IDS));
    if (rand() < 0.28 && !state.events.active) {
      const person = pick(state.people);
      const actions = getAvailableSocialActions(state, person.id).filter(
        (action) => action.availability.ok,
      );
      const action = pick(actions);
      if (action) applySocialAction(state, person.id, action.id);
    }
    const available = getAvailableDecisions(state);
    for (let slot = 0; slot < 2; slot += 1) {
      const decision = pick(available);
      if (decision && canApplyDecision(state, decision.id).ok) applyDecision(state, decision.id);
    }
    settle(state);

    const advanced = advanceWeek(state);
    check(advanced.ok, `advanceWeek reddetti: ${advanced.messages?.join(" ")}`);
    settle(state);

    const validation = validateState(state);
    check(validation.ok, `validateState: ${validation.errors.join("; ")}`);
    check(state.career.jobId === null || Boolean(getJobById(state.career.jobId)), "geçersiz jobId");
    check(Boolean(getHomeById(state.household.homeId)), "geçersiz homeId");
    check(Boolean(getEraById(state.world.eraId)), "geçersiz eraId");

    const active = state.education.active;
    if (active) {
      const path = getPathById(active.pathId);
      check(Boolean(path), "geçersiz pathId");
      check(
        Number.isInteger(active.progressPoints) &&
          active.progressPoints >= 0 &&
          active.progressPoints <= (path?.targetPoints ?? 0),
        "ilerleme aralık dışı",
      );
    }
    check(
      Number.isInteger(state.education.tuitionOwedThisMonth) &&
        state.education.tuitionOwedThisMonth >= 0,
      "eğitim borcu geçersiz",
    );

    let totalExperience = 0;
    for (const value of Object.values(state.career.jobFamilyExperience)) {
      check(Number.isInteger(value) && value >= 0, "deneyim geçersiz");
      totalExperience += value;
    }
    check(totalExperience <= state.time.absoluteWeek, "deneyim geçen haftadan fazla");

    for (const key of ["energy", "stress", "health"])
      check(
        Number.isFinite(state.health[key]) && state.health[key] >= 0 && state.health[key] <= 100,
        `beden değeri aralık dışı: ${key}`,
      );
    check(Number.isFinite(state.finances.balance), "bakiye sayı değil");
    for (const value of Object.values(state.relationships))
      check(Number.isFinite(value) && value >= 0 && value <= 100, "ilişki aralık dışı");
    for (const person of state.people) {
      const relationship = getRelationship(state, person.id);
      check(
        Number.isFinite(relationship.trust) && relationship.trust >= 0 && relationship.trust <= 100,
        "güven aralık dışı",
      );
      check(
        Number.isFinite(relationship.tension) &&
          relationship.tension >= 0 &&
          relationship.tension <= 100,
        "gerilim aralık dışı",
      );
      check(person.memories.length <= 50, "NPC hafızası sınırı aşıldı");
      check(
        person.roleId !== "family" || person.social.romanceStatus === "none",
        "aile NPC romantik durumda",
      );
    }
    const partners = state.people.filter((person) => person.social.romanceStatus === "partner");
    check(partners.length <= 1, "birden fazla partner");
    check(
      (state.social.currentPartnerNpcId === null && partners.length === 0) ||
        partners[0]?.id === state.social.currentPartnerNpcId,
      "partner kimliği tutarsız",
    );
    check(state.weekly.used <= 2, "haftalık karar hakkı aşıldı");

    // Sınırlı listeler taşmamalı.
    check(state.memories.length <= 200, "hafıza sınırı aşıldı");
    check(state.finances.ledger.length <= 120, "defter sınırı aşıldı");
    check(state.events.history.length <= 200, "event geçmişi sınırı aşıldı");
    check(state.yearlyHistory.length <= 80, "yıl dosyası sınırı aşıldı");

    // Pending/triggered cases are live obligations; resolved cases are retained history.
    // The >70 lifetime pruning boundary has its own retention tests. A later
    // event resolution or death may legitimately add closed cases this week.
    const activeOpenCases = state.openCases.filter((item) => item.status !== "resolved");
    check(activeOpenCases.length <= 50, "aktif openCases sınırı aşıldı");
    const caseIds = new Set();
    for (const item of state.openCases) {
      check(!caseIds.has(item.id), `tekrar eden openCase id: ${item.id}`);
      caseIds.add(item.id);
      if (item.type === "personal-debt")
        check(
          Number.isFinite(item.payload?.amount) && item.payload.amount > 0,
          "kişisel borç tutarı geçersiz/negatif",
        );
    }
    const unresolvedDebts = state.openCases.filter(
      (item) => item.type === "personal-debt" && item.status !== "resolved",
    );
    check(unresolvedDebts.length <= 1, "birden fazla bekleyen kişisel borç");

    if ((step + 1) % 12 === 0) {
      const saved = saveGame(storage, state);
      check(saved.ok, `save başarısız: ${saved.message}`);
      const loaded = loadGame(storage);
      check(loaded.ok, "load başarısız");
      if (loaded.ok) state = loaded.state;
    }
  }

  return {
    weeks,
    seed,
    problems,
    age: state.player.age,
    years: state.yearlyHistory.length,
    growth: {
      memories: state.memories.length,
      ledger: state.finances.ledger.length,
      eventHistory: state.events.history.length,
      openCases: state.openCases.length,
      activeOpenCases: state.openCases.filter((item) => item.status !== "resolved").length,
      resolvedOpenCases: state.openCases.filter((item) => item.status === "resolved").length,
      openSocialCases: state.openCases.filter(
        (item) => item.type === "social-obligation" && item.status !== "resolved",
      ).length,
      yearlyHistory: state.yearlyHistory.length,
      npcMemories: state.people.map((person) => person.memories.length),
      flags: Object.keys(state.flags).length,
      saveBytes: Buffer.byteLength(JSON.stringify(state)),
    },
    final: {
      educationLevel: state.education.level,
      fields: state.education.fields,
      jobId: state.career.jobId,
      experience: state.career.jobFamilyExperience,
      balance: state.finances.balance,
      health: state.health,
      currentPartnerNpcId: state.social.currentPartnerNpcId,
    },
  };
}

// Aynı motor ve karar doğrulamasıyla strateji karşılaştırması. Haftalık sağlık
// değerlerine müdahale edilmez; farklar seçilen aktivitelerden doğar.
export function settleBodyEvents(state, strategy = "balanced", observe = () => {}) {
  let count = 0;
  while (state.events.active) {
    assert.ok(count++ < 80, "Olay zinciri aynı haftada sonlanmalı");
    const definition = getEventDefinition(state.events.active.eventId);
    const pushing = ["overworker", "low-recovery", "inactive"].includes(strategy);
    const preferred = pushing ? ["continue", "ignore", "hide"] : ["slow", "care", "move", "tell"];
    const selected = preferred.map((id) => definition.choices.find((item) => item.id === id)).find(Boolean) || definition.choices[0];
    observe(state, definition, selected, "before");
    assert.equal(resolveEvent(state, selected.id).ok, true);
    observe(state, definition, selected, "after");
  }
}

/**
 * İşsiz kalan oyuncu boşlukta beklemez: birkaç hafta sonra gerçek iş yolundan
 * (teklif → bir hafta bekleme → işe başlama olayı) yeniden işe girer. Anında
 * yedek iş yoktur; arama gerçek zaman alır ve bir aktivite hakkı harcar.
 */
export function trySeekWork(state, { every = 4 } = {}) {
  if (state.career.jobId !== null || state.career.pendingJob) return false;
  if (state.time.absoluteWeek % every !== 0) return false;
  for (const jobId of ["specialist", "technician", "office", "courier", "market"])
    if (acceptJobOffer(state, jobId).ok) return true;
  return false;
}

export function playBodyWeek(state, strategy, observe = () => {}) {
  settleBodyEvents(state, strategy, observe);
  if (trySeekWork(state)) settleBodyEvents(state, strategy, observe);
  const actions = strategy === "overworker" ? ["overtime"]
    : strategy === "low-recovery" ? ["exercise", "friend", "family"]
    : strategy === "inactive" ? []
    : strategy === "health-first" ? ["body-care", "rest", "exercise"]
    : ["rest", state.time.absoluteWeek % 4 === 0 ? "family" : "exercise"];
  const available = new Set(getAvailableDecisions(state).map((item) => item.id));
  for (const id of actions) {
    if (available.has(id) && canApplyDecision(state, id).ok) {
      assert.equal(applyDecision(state, id).ok, true);
      settleBodyEvents(state, strategy, observe);
    }
  }
  const choices = [...state.weekly.selectedIds];
  assert.equal(advanceWeek(state).ok, true);
  settleBodyEvents(state, strategy, observe);
  assert.equal(validateState(state).ok, true);
  return choices;
}

export function runBodyStrategy(strategy, weeks = 520) {
  const state = createNewGame({ name: "Deniz", profile: "balanced", now: "2027-01-01T00:00:00.000Z" });
  const checkpoints = {};
  const maximums = { overwork: 0, underRecovery: 0, inactivity: 0, conditions: 0, healthOpenCases: 0 };
  const decisions = {};
  let warnings = 0;
  for (let step = 1; step <= weeks; step += 1) {
    const choices = playBodyWeek(state, strategy, (_state, definition, _choice, phase) => {
      if (phase === "before" && /^health_(overload|recovery|inactivity)_review$/.test(definition.id)) warnings += 1;
    });
    for (const id of choices) decisions[id] = (decisions[id] || 0) + 1;
    for (const [key, value] of Object.entries(state.body.exposures)) {
      assert.ok(value >= 0 && value <= 100);
      maximums[key] = Math.max(maximums[key], value);
    }
    maximums.conditions = Math.max(maximums.conditions, state.body.conditions.length);
    const healthOpenCases = state.openCases.filter((item) => item.type === "health-followup" && item.status !== "resolved");
    maximums.healthOpenCases = Math.max(maximums.healthOpenCases, healthOpenCases.length);
    assert.ok(state.body.conditions.length <= 8);
    assert.ok(healthOpenCases.length <= 4);
    assert.equal(new Set(healthOpenCases.map((item) => item.chainId)).size, healthOpenCases.length);
    assert.ok(state.people.every((person) => person.memories.length <= 50));
    assert.ok(state.yearlyHistory.length <= 80);
    if ([52, 156, 520].includes(step)) checkpoints[step] = {
      ...state.body.exposures,
      ...Object.fromEntries(["active", "managed", "resolved", "chronic"].map((status) => [status, state.body.conditions.filter((item) => item.status === status).length])),
      healthOpenCases: healthOpenCases.length,
    };
  }
  return { strategy, checkpoints, maximums, warnings, decisions,
    healthNpcMemories: state.people.reduce((sum, person) => sum + person.memories.filter((item) => item.type?.startsWith("health_")).length, 0),
    yearHealthSummaries: state.yearlyHistory.filter((entry) => entry.health?.end).length,
    yearHealthConditions: state.yearlyHistory.flatMap((entry) => entry.health?.conditions || []).length,
  };
}

export function runBodyMatrix() {
  return Object.fromEntries(["overworker", "balanced", "low-recovery", "health-first"].map((strategy) => [strategy, runBodyStrategy(strategy)]));
}

export function settleHouseholdEvents(state, choices = {}, observe = () => {}) {
  let guard = 0;
  activateNextEvent(state);
  while (state.events.active) {
    assert.ok(guard++ < 80, "Olaylar sonlanmalı");
    const definition = getEventDefinition(state.events.active.eventId);
    const configured = choices[definition.id];
    const preferred = (typeof configured === "function" ? configured(state) : configured) || {
      cohabitation_discussion: "plan", cohabitation_move: "shared", household_adjustment: "coordinate",
      household_family_visit: "tell", marriage_discussion: "plan", marriage_commitment: "confirm",
      romantic_opportunity: "interested", partner_transition: "commit",
      health_overload_review: "slow", health_recovery_review: "care", health_inactivity_review: "move", health_support_disclosure: "tell",
    }[definition.id];
    const choice = definition.choices.find((item) => item.id === preferred && getEventChoiceAvailability(state, item.id).ok) || definition.choices.find((item) => getEventChoiceAvailability(state, item.id).ok);
    assert.ok(choice, `${definition.id}: uygulanabilir seçim yok (${definition.choices.map((item) => `${item.id}=${getEventChoiceAvailability(state, item.id).reason || "ok"}`).join(", ")})`);
    observe(definition, choice);
    assert.equal(resolveEvent(state, choice.id).ok, true);
  }
}

export function runHouseholdScenario(weeks = 520, { conflict = false } = {}) {
  let state = createNewGame({ now: "2027-01-01T00:00:00.000Z", name: "Deniz" });
  const storage = new MemoryStorage();
  let maxCases = 0;
  const choices = {};
  const settle = () => settleHouseholdEvents(state, choices);
  for (let step = 0; step < weeks; step += 1) {
    const neglect = conflict && step >= 40;
    if (neglect) Object.assign(choices, { household_adjustment: "skip", relationship_tension: "avoid", elif_neglect_week: "work", separation_discussion: "separate", separation_review: "divorce" });
    settle();
    if (canApplyDecision(state, "rest").ok) applyDecision(state, "rest");
    settle();
    const socialAction = canUseSocialAction(state, "elif", "confide").ok ? "confide" : "meet";
    if (!neglect && step % 2 === 0 && canUseSocialAction(state, "elif", socialAction).ok) applySocialAction(state, "elif", socialAction);
    else if (canApplyDecision(state, "exercise").ok) applyDecision(state, "exercise");
    settle();
    assert.equal(advanceWeek(state).ok, true);
    settle();
    assert.equal(validateState(state).ok, true);
    const cases = state.openCases.filter((item) => item.type === "household-followup" && item.status !== "resolved");
    assert.equal(new Set(cases.map((item) => item.payload.kind)).size, cases.length);
    maxCases = Math.max(maxCases, cases.length);
    assert.ok(cases.length <= 4);
    assert.ok(state.household.history.length <= 24);
    assert.ok(state.people.every((person) => person.memories.length <= 50));
    assert.ok(state.yearlyHistory.length <= 80);
    if (step % 12 === 0) {
      assert.equal(saveGame(storage, state).ok, true);
      const loaded = loadGame(storage);
      assert.equal(loaded.ok, true);
      assert.deepEqual(loaded.state.household, state.household);
      state = loaded.state;
    }
  }
  return { weeks, partner: state.social.currentPartnerNpcId, union: state.household.union, home: state.household.homeId,
    balance: state.finances.balance, history: state.household.history, years: state.yearlyHistory.map((year) => ({ year: year.year, household: year.household })),
    maxCases, partnerCount: state.people.filter((person) => person.social.romanceStatus === "partner").length,
    activeHouseholdCases: state.openCases.filter((item) => item.type === "household-followup" && item.status !== "resolved").length,
    npcMemoryCounts: state.people.map((person) => person.memories.length),
    playerMemories: state.memories.length,
  };
}

/**
 * Çocuğun 6→18 yolunu tek bir yeniden kullanılabilir koşuda kanıtlar.
 * Kurulum ortaktır; yalnız politika haritası değişir. Yaş asla elle yazılmaz:
 * gebelik ve doğum gerçek üretim yolundan geçer, yaş doğum haftasından türer.
 */
const CHILD_POLICIES = {
  stable: {
    child_school_transition: "support", child_attendance_concern: "support", child_peer_concern: "support",
    child_relationship_conflict: "listen", child_conflict_repair: "repair", child_autonomy_disclosure: "listen",
    child_autonomy_followup: "listen", child_activity_choice: "join", child_activity_review: "continue",
    child_other_parent_contact: "support", child_contact_followup: "support", child_future_discussion: "support",
  },
  strained: {
    child_school_transition: "later", child_attendance_concern: "ignore", child_peer_concern: "ignore",
    child_relationship_conflict: "insist", child_conflict_repair: "later", child_autonomy_disclosure: "insist",
    child_autonomy_followup: "later", child_activity_choice: "later", child_activity_review: "stop",
    child_other_parent_contact: "later", child_contact_followup: "later", child_future_discussion: "push",
  },
};
CHILD_POLICIES.separated = { ...CHILD_POLICIES.stable };

export function runChildScenario(kind = "stable", { weeks = 1180, includeState = false, maxChildren = 1, economicPolicy = false } = {}) {
  let state = createNewGame({ now: "2027-01-01T00:00:00.000Z", name: "Deniz" });
  const storage = new MemoryStorage();
  const policy = CHILD_POLICIES[kind] || CHILD_POLICIES.stable;
  const checkpoints = {};
  const playerCheckpoints = {};
  const chainCounts = {};
  const maximums = { attendance: 0, social: 0, issues: 0, parentingCases: 0, secrets: 0, npcMemories: 0, history: 0, yearFile: 0, commitments: 0 };
  const seenResolved = new Set();
  let birthWeek = null;
  let separatedAt = null;
  const child = () => state.parenthood.children[0] || null;
  const childAgeNow = () => (child() ? childAge(state, child()) : null);

  for (let step = 0; step < weeks; step += 1) {
    const kid = child();
    const tryingChoice = state.parenthood.children.length >= maxChildren ? "no" : canTryParenthood(state) ? "try_partner" : "discuss";
    // Ayrılık yalnız gerçek Second Stage B olay yolundan gelir; state elle
    // "separated" yapılmaz. Çocuk okul çağına geldikten sonra tetiklenir.
    const wantSeparation = kind === "separated" && kid && childAge(state, kid) >= 6;
    const choices = {
      ...policy,
      family_intent_discussion: "wants", family_intent_review: "talk",
      parent_planning: tryingChoice, parent_planning_review: tryingChoice,
      parent_preparation: "prepare", parent_family_support: "tell",
      // Bu koşuda hane geçimini koruyacak şekilde oynanır: stüdyoya taşınmak
      // 18 yıl boyunca sürdürülemez bir gider yaratıp ölçümü yoksullukla
      // gölgeliyordu. Taşınmayı ertelemek geçerli bir oyuncu kararıdır.
      parent_housing_review: "later",
      // Zorlu koşuda bakım düzeni de aksatılır: okul baskısı ve buna bağlı
      // C02/C03/C04 zincirleri ancak böyle gerçek koşullarıyla doğar.
      parent_care_review: kind === "strained" ? "later" : "arrange", parent_budget_review: "home",
      ...(wantSeparation ? { household_adjustment: "skip", relationship_tension: "avoid", elif_neglect_week: "work", separation_discussion: "separate", separation_review: "divorce" } : {}),
      ...(kind === "strained" ? { household_adjustment: "skip" } : {}),
    };
    const settle = () => settleHouseholdEvents(state, choices, (definition) => {
      const chain = Object.values(PARENTING_CHAINS).find((entry) => entry.eventId === definition.id);
      const key = chain?.id || (definition.id.startsWith("child_") ? definition.id : null);
      if (key) chainCounts[key] = (chainCounts[key] || 0) + 1;
    });
    settle();
    // Geçerli bir oyuncu gibi geçimini de sürdürür: 24 haftada bir uygun olan
    // en iyi işe geçmeyi dener. Aksi halde koşu yıllar içinde iflasa gider ve
    // ölçülen şey ebeveynlik değil yoksulluk olur.
    if (economicPolicy && !state.education.active && state.education.level !== "lisans" && state.finances.balance >= 8000) enrollEducation(state, "university", "part");
    if (step % 24 === 0) for (const jobId of ["specialist", "technician", "office", "courier", "market"]) {
      if (economicPolicy && getJobById(jobId).salary <= (getJobById(state.career.jobId)?.salary || 0)) continue;
      if (acceptJobOffer(state, jobId).ok) break;
    }
    settle();
    if (kind !== "strained" && needsParentCare(state) && canApplyDecision(state, "parent-care").ok) applyDecision(state, "parent-care");
    else if (canApplyDecision(state, "rest").ok) applyDecision(state, "rest");
    settle();
    const socialAction = canUseSocialAction(state, "elif", "confide").ok ? "confide" : "meet";
    // Ayrılık senaryosunda ilişki bakımı bırakılır ki gerçek Second Stage B
    // ayrılık olayları kendi koşullarıyla uygun hale gelsin.
    const nurture = (kind !== "strained" && !wantSeparation) || !kid;
    if (nurture && step % 2 === 0 && canUseSocialAction(state, "elif", socialAction).ok) applySocialAction(state, "elif", socialAction);
    else if (canApplyDecision(state, "exercise").ok) applyDecision(state, "exercise");
    settle();
    assert.equal(advanceWeek(state).ok, true);
    settle();
    assert.equal(validateState(state).ok, true);

    if (!birthWeek && child()) birthWeek = child().bornWeek;
    if (!separatedAt && state.household.union?.separatedSince) separatedAt = state.time.absoluteWeek;

    const cases = state.openCases.filter((c) => c.type === "parenting-followup" && c.status !== "resolved");
    assert.equal(new Set(cases.map((c) => `${c.payload.kind}:${c.payload.childId || "-"}`)).size, cases.length, "aynı çocuk için yinelenen zincir olmamalı");
    for (const item of state.openCases) if (item.status === "resolved") seenResolved.add(item.id);
    const kidNow = child();
    if (kidNow) {
      maximums.attendance = Math.max(maximums.attendance, kidNow.school.attendancePressure);
      maximums.social = Math.max(maximums.social, kidNow.school.socialPressure);
      maximums.issues = Math.max(maximums.issues, kidNow.school.issues.length);
      maximums.commitments = Math.max(maximums.commitments, kidNow.school.extracurricular ? 1 : 0);
      // Gizli konu hiçbir zaman oyuncuya sızmamalı.
      if (kidNow.school.hiddenIssue && !isChildIssueKnown(state, kidNow))
        assert.doesNotMatch(parenthoodSummary(state).children[0], /paylaşmıyor/, "gizli konu okunabilir olmamalı");
    }
    maximums.parentingCases = Math.max(maximums.parentingCases, cases.length);
    maximums.secrets = Math.max(maximums.secrets, state.secrets.length);
    maximums.npcMemories = Math.max(maximums.npcMemories, ...state.people.map((p) => p.memories.length));
    maximums.history = Math.max(maximums.history, state.household.history.length);
    maximums.yearFile = Math.max(maximums.yearFile, state.yearlyHistory.length);
    assert.ok(state.secrets.length <= 30);
    assert.ok(state.household.history.length <= 24);
    assert.ok(state.yearlyHistory.length <= 80);
    assert.ok(state.people.every((p) => p.memories.length <= 50));

    const age = childAgeNow();
    if (age !== null && [6, 12, 15, 18].includes(age) && !checkpoints[age]) {
      const c = child();
      checkpoints[age] = {
        age, stage: childStage(state, c), standing: childAcademicStanding(c),
        attendancePressure: c.school.attendancePressure, socialPressure: c.school.socialPressure,
        schoolIssues: c.school.issues.filter((i) => i.status !== "resolved").length,
        trust: c.relationship.trust, tension: c.relationship.tension, closeness: c.relationship.closeness,
        extracurricular: Boolean(c.school.extracurricular),
        openCases: state.openCases.filter((x) => x.payload?.childId === c.id && x.status !== "resolved").length,
        knownIssue: isChildIssueKnown(state, c), hiddenIssuePending: Boolean(c.school.hiddenIssue) && !isChildIssueKnown(state, c),
        futurePreference: c.futurePreference, trajectory: c.trajectory ?? null,
        balance: Math.round(state.finances.balance), history: state.household.history.length, yearFile: state.yearlyHistory.length,
      };
    }
    if (economicPolicy && state.player.age === 35 && !playerCheckpoints[35]) playerCheckpoints[35] = {
      age: state.player.age, week: state.time.absoluteWeek, job: state.career.jobId,
      retirement: structuredClone(state.career.retirement), money: state.finances.balance, health: structuredClone(state.health),
      children: structuredClone(state.parenthood.children.map(c => ({ id: c.id, age: childAge(state, c), adult: c.adult, trajectory: c.trajectory }))), generation: 1,
    };
    if (step % 24 === 0) {
      assert.equal(saveGame(storage, state).ok, true);
      const next = loadGame(storage);
      assert.equal(next.ok, true);
      assert.deepEqual(next.state.parenthood, state.parenthood, "kayıt/yükleme ebeveynlik durumunu bozmamalı");
      state = next.state;
    }
    if (checkpoints[18]) break;
  }
  const finalChild = child();
  return {
    ...(includeState ? { state } : {}), kind, birthWeek, separatedAt, weeks: state.time.absoluteWeek, checkpoints, playerCheckpoints, chainCounts, maximums,
    child: finalChild ? { id: finalChild.id, name: finalChild.name, trajectory: finalChild.trajectory ?? null, futurePreference: finalChild.futurePreference,
      otherParentId: finalChild.otherParentId, otherParentValid: state.people.some((p) => p.id === finalChild.otherParentId),
      hiddenIssue: finalChild.school.hiddenIssue, knownIssue: isChildIssueKnown(state, finalChild) } : null,
    union: state.household.union ? { cohabitingSince: state.household.union.cohabitingSince ?? null, separatedSince: state.household.union.separatedSince ?? null } : null,
    partner: state.social.currentPartnerNpcId,
    openParentingCases: state.openCases.filter((c) => c.type === "parenting-followup" && c.status !== "resolved").length,
    valid: validateState(state).ok,
  };
}

export function runParenthoodScenario({ noChild = false } = {}) {
  let state = createNewGame({ now: "2027-01-01T00:00:00.000Z", name: "Deniz" });
  const storage = new MemoryStorage();
  let maximumCases = 0;
  for (let step = 0; step < 520; step += 1) {
    const ready = state.time.absoluteWeek >= 220;
    const tryingChoice = state.parenthood.children.length >= 2 ? "no" : canTryParenthood(state) ? "try_partner" : "discuss";
    const choices = {
      family_intent_discussion: ready ? noChild ? "no" : "wants" : "later", family_intent_review: "talk",
      parent_planning: ready && !noChild ? tryingChoice : "wait", parent_planning_review: ready && !noChild ? tryingChoice : "wait",
      parent_preparation: "prepare", parent_family_support: "tell", parent_housing_review: "studio", parent_care_review: "arrange", parent_budget_review: "home",
    };
    const settle = () => settleHouseholdEvents(state, choices);
    settle();
    if (needsParentCare(state) && canApplyDecision(state, "parent-care").ok) applyDecision(state, "parent-care");
    else if (canApplyDecision(state, "rest").ok) applyDecision(state, "rest");
    settle();
    const socialAction = canUseSocialAction(state, "elif", "confide").ok ? "confide" : "meet";
    if (step % 2 === 0 && canUseSocialAction(state, "elif", socialAction).ok) applySocialAction(state, "elif", socialAction);
    else if (canApplyDecision(state, "rest").ok) applyDecision(state, "rest");
    else if (canApplyDecision(state, "exercise").ok) applyDecision(state, "exercise");
    settle();
    assert.equal(advanceWeek(state).ok, true); settle();
    assert.equal(validateState(state).ok, true);
    const cases = state.openCases.filter(c => c.type === "parenting-followup" && c.status !== "resolved");
    assert.equal(new Set(cases.map(c => c.payload.kind)).size, cases.length);
    maximumCases = Math.max(maximumCases, cases.length);
    assert.ok(cases.length <= 7);
    assert.ok(state.household.history.length <= 24);
    assert.ok(state.people.every(p => p.memories.length <= 50));
    if (step % 12 === 0) {
      assert.equal(saveGame(storage, state).ok, true);
      const next = loadGame(storage); assert.equal(next.ok, true); assert.deepEqual(next.state.parenthood, state.parenthood); state = next.state;
    }
  }
  return { children: state.parenthood.children, pregnancy: state.parenthood.pregnancy, stages: state.parenthood.children.map(c => childStage(state,c)),
    balance: state.finances.balance, relationship: getRelationship(state, "elif"), plan: state.household.union.familyPlan,
    maximumCases, parentingCases: state.openCases.filter(c => c.type === "parenting-followup" && c.status !== "resolved").length,
    npcMemories: state.people.map(p=>p.memories.length), history: state.household.history, years: state.yearlyHistory, valid: validateState(state).ok };
}

/* ------------------------------------------------------------------ *
 * Yetişkin çekirdek (18–35) uzun koşusu.
 *
 * Dört strateji tek motoru paylaşır: kurulum, olay sonuçlandırma, haftalık
 * aktivite seçimi, kontrol noktası ölçümü ve invariant yürüyüşü ortaktır;
 * yalnız politika değişir. Dört ayrı simülasyon kopyası yoktur.
 *
 *   node scripts/tc-sim-longrun.mjs adult-career
 *   node scripts/tc-sim-longrun.mjs adult-balanced
 *   node scripts/tc-sim-longrun.mjs adult-strained
 *   node scripts/tc-sim-longrun.mjs adult-education
 *   node scripts/tc-sim-longrun.mjs adult-matrix
 * ------------------------------------------------------------------ */

export const ADULT_CORE_CHECKPOINTS = [52, 156, 260, 520];

/** Yıllık temel geçim gideri: konut + düzenli gider + eğitim + bakım. */
export function annualBaselineCost(state) {
  const summary = getMonthlySummary(state);
  return 12 * (summary.housing + summary.otherExpenses + summary.tuition + summary.parenting);
}

/**
 * Para tek bir TL rakamıyla değil, o anki geçim maliyetine göre ölçülür:
 * kaç yıllık geçim cebinde duruyor. Gider indeksi yükselince de anlamlı kalır.
 */
export function savingsMultiple(state) {
  const annual = annualBaselineCost(state);
  return annual > 0 ? Number((state.finances.balance / annual).toFixed(3)) : 0;
}

const salaryOf = (jobId) => JOBS.find((item) => item.id === jobId)?.salary || 0;

/** Uygun işler arasında en yüksek maaşlı olan; yalnız gerçek uygunluk kapısından geçer. */
function bestEligibleJob(state, preference, { mustBeat = -1 } = {}) {
  let best = null;
  for (const jobId of preference) {
    const job = JOBS.find((item) => item.id === jobId);
    if (!job || job.id === state.career.jobId || job.salary <= mustBeat) continue;
    if (!isEligibleForJob(state, job).ok) continue;
    if (!best || job.salary > best.salary) best = job;
  }
  return best?.id || null;
}

const ADULT_CORE_POLICIES = {
  "career-focused": {
    // İş değiştirerek değil, aynı işte kalıp terfi ederek yükselir:
    // terfi penceresi 20 hafta kıdem ve yüksek performans ister.
    // Hizmet ailesinde kalır: teknik alan + 24 hafta hizmet deneyimi, kursla
    // birlikte Teknik Servis Uzmanlığını gerçekten uygun hale getirir.
    jobPreference: ["technician", "courier", "market"],
    upgradeEvery: 12,
    housing: [[104, "shared"]],
    // Kariyere yatırım: kısa, çalışırken sürdürülebilir mesleki kurs teknik
    // alanı açar ve daha iyi ücretli işi gerçekten uygun hale getirir.
    education: { pathId: "vocational_course", intensity: "part", fromWeek: 12 },
    choices: {
      career_promotion_window: "accept", career_promotion_review: "advance",
      job_security_warning: "recover", job_security_review: "recover",
      education_path_window: "consider", education_window_followup: "pursue",
    },
    week(state, act) {
      // Sürdürülebilir tempo: performans yürüyüşünün "sağlıklı hafta" eşiğinin
      // altına düşmeden mesai yapar, sonra mutlaka toparlanır.
      if (state.health.energy >= 40 && state.health.stress <= 62) act("overtime");
      act("rest");
      act("exercise");
    },
  },
  balanced: {
    // Sıradan oyuncu: çalışır, dinlenir, aileyle vakit geçirir, ara sıra
    // mesai yapar, aşırı optimize etmez.
    jobPreference: ["office", "courier", "market"],
    upgradeEvery: 0,
    housing: [[156, "shared"]],
    education: null,
    choices: {
      career_promotion_window: "accept", career_promotion_review: "advance",
      job_security_warning: "recover", job_security_review: "recover",
      education_path_window: "work", education_window_followup: "postpone",
    },
    week(state, act, step) {
      if (step % 4 === 0 && state.health.energy >= 60) act("overtime");
      act("rest");
      if (step % 2 === 0) act("family");
      act("exercise");
    },
  },
  "financially-strained": {
    // Düşük ücretli işte kalır, terfiyi almaz, mesai yapmaz, aile evinden
    // çıkmaz. Yükselen geçim gideri ve iş güvenliği riski açığı büyütür.
    jobPreference: ["market"],
    upgradeEvery: 0,
    housing: [],
    // Konut kararı sabit değil, gerçek nakit durumuna göre gider gelir:
    // eline para geçince kendi evini dener, sıkışınca aile evine döner.
    // Böylece ne kalıcı yoksulluk kilidi ne de bedava birikim olur.
    adapt(state, step) {
      if (step < 52) return;
      const monthly = annualBaselineCost(state) / 12;
      // Eline yeterince para geçince kendi evini dener; nakit tükenmeden,
      // taşınma masrafını hâlâ karşılayabilecekken aile evine döner.
      if (state.household.homeId === "family" && state.finances.balance > monthly * 4) moveHome(state, "shared");
      else if (state.household.homeId !== "family" && state.finances.balance < 1000) moveHome(state, "family");
    },
    education: null,
    choices: {
      career_promotion_window: "decline", career_promotion_review: "steady",
      career_responsibility_offer: "decline", career_responsibility_review: "steady",
      job_security_warning: "push", job_security_review: "accept_risk",
      money_relief_choice: "borrow",
      // Ödeyebiliyorsa öder; gerçekten parası yoksa ödeyemez.
      money_relief_due: (state) => (state.finances.balance >= (state.openCases.find((item) => item.payload?.kind === "money_relief" && item.status !== "resolved")?.payload.amount || MONEY_RELIEF_MIN) ? "repay" : "delay"),
      education_path_window: "work", education_window_followup: "postpone",
    },
    week(state, act, step) {
      act("rest");
      if (step % 3 === 0) act("friend");
      act("exercise");
    },
  },
  "education-career": {
    // Önce okur (kayıt ücreti + aylık harç baskısı), diploma yeni bir işi
    // uygun hale getirir, sonra oraya geçer. Uygunluk elle yazılmaz.
    jobPreference: ["specialist", "office", "courier", "market"],
    upgradeEvery: 12,
    housing: [[312, "shared"]],
    education: { pathId: "university", intensity: "part", fromWeek: 12 },
    choices: {
      career_promotion_window: "accept", career_promotion_review: "advance",
      job_security_warning: "recover", job_security_review: "recover",
      education_path_window: "consider", education_window_followup: "pursue",
    },
    week(state, act, step) {
      act("rest");
      if (step % 5 === 0 && state.health.energy >= 60 && !state.education.active) act("overtime");
      act("exercise");
    },
  },
};

const BASE_ADULT_CHOICES = {
  career_responsibility_offer: "accept", career_responsibility_review: "advance",
  family_expectation_window: "commit", family_expectation_followup: "kept",
  privacy_context_event: "boundary", comparison_circle_update: "reflect",
  secret_confrontation: "open", military_window: "defer",
  money_relief_choice: "cut", money_relief_due: "repay",
};

export function runAdultCoreScenario(kind = "balanced", { weeks = 520 } = {}) {
  const policy = ADULT_CORE_POLICIES[kind];
  assert.ok(policy, `bilinmeyen yetişkin çekirdek stratejisi: ${kind}`);
  let state = createNewGame({ name: "Deniz", profile: "balanced", now: "2027-01-01T00:00:00.000Z" });
  const storage = new MemoryStorage();
  const choices = { ...BASE_ADULT_CHOICES, ...policy.choices };

  const checkpoints = {};
  const observed = { costIndex: 0, performance: 0, performanceLow: 100, openCases: 0, ledger: 0, careerHistory: 0, yearFile: 0, memories: 0, npcMemories: 0, reliefAmount: 0, reliefCases: 0, securityCases: 0, balanceLow: Infinity, balanceHigh: -Infinity, savingsMultiple: 0 };
  const counters = { promotions: 0, jobSwitches: 0, jobLosses: 0, resignations: 0, reemployments: 0, warnings: 0, reviewsPassed: 0, reviewsFired: 0, reliefBorrowed: 0, reliefRepaid: 0, reliefDefaults: 0, reliefExpired: 0, unemployedWeeks: 0, overtimeWeeks: 0 };
  // Olaylar tarihçe sınırlarından bağımsız, tam çözüldükleri anda sayılır.
  const observe = (definition, choice) => {
    if (definition.id === "job_security_warning") counters.warnings += 1;
    if (definition.id === "money_relief_choice" && choice.id === "borrow") counters.reliefBorrowed += 1;
    if (definition.id === "money_relief_due") counters[choice.id === "repay" ? "reliefRepaid" : "reliefDefaults"] += 1;
  };
  const settle = () => settleHouseholdEvents(state, choices, observe);

  // Eğitimin açtığı kapı: hangi işin uygunluğu diplomayla değişiyorsa o ölçülür.
  const gateJob = JOBS.find((item) => item.id === (policy.education?.pathId === "university" ? "specialist" : "technician"));
  const education = { enrolledWeek: null, completedWeek: null, enrollmentFee: 0, tuitionPaid: 0, eligibleBefore: null, eligibleAfter: null, transitionWeek: null, salaryBefore: null, salaryAfter: null };
  let previousJobId = state.career.jobId;
  let previousTuitionOwed = 0;
  let previousReliefCaseIds = new Set();

  for (let step = 0; step < weeks; step += 1) {
    settle();
    // Gerçek iş yolu: teklif → bir hafta bekleme → işe başlama olayı.
    // İşsizken arama sürer; işteyken yalnız gerçekten daha iyi bir işe geçilir.
    if (state.career.jobId === null && !state.career.pendingJob && step % 4 === 0) {
      const target = bestEligibleJob(state, policy.jobPreference);
      if (target) acceptJobOffer(state, target);
    } else if (state.career.jobId !== null && policy.upgradeEvery > 0 && step % policy.upgradeEvery === 0) {
      const target = bestEligibleJob(state, policy.jobPreference, { mustBeat: salaryOf(state.career.jobId) });
      if (target) acceptJobOffer(state, target);
    }
    settle();
    if (policy.education && !education.enrolledWeek && step >= policy.education.fromWeek && !state.education.active) {
      const path = EDUCATION_PATHS.find((item) => item.id === policy.education.pathId);
      const before = isEligibleForJob(state, gateJob).ok;
      if (enrollEducation(state, policy.education.pathId, policy.education.intensity).ok) {
        education.enrolledWeek = state.time.absoluteWeek;
        education.enrollmentFee = path.enrollmentFee;
        education.eligibleBefore = before;
        education.salaryBefore = getMonthlySummary(state).salary;
      }
    }
    for (const [fromWeek, homeId] of policy.housing)
      if (step === fromWeek && state.household.homeId !== homeId) moveHome(state, homeId);
    policy.adapt?.(state, step);
    settle();

    const act = (id) => {
      if (canApplyDecision(state, id).ok) {
        assert.equal(applyDecision(state, id).ok, true);
        if (id === "overtime") counters.overtimeWeeks += 1;
        settle();
      }
    };
    policy.week(state, act, step);
    settle();

    assert.equal(advanceWeek(state).ok, true);
    settle();
    assert.equal(validateState(state).ok, true);

    // ---- her hafta yürüyen sert kurallar ----
    assert.ok(state.career.jobId === null || Boolean(getJobById(state.career.jobId)), "geçersiz jobId");
    if (state.career.jobId === null) {
      counters.unemployedWeeks += 1;
      assert.equal(getMonthlySummary(state).salary, 0, "işsizken maaş sıfır olmalı");
      assert.equal(canApplyDecision(state, "overtime").ok, false, "işsizken ek mesai açık olamaz");
      assert.equal(getAvailableDecisions(state).some((item) => item.id === "overtime"), false, "işsizken ek mesai listelenmemeli");
      assert.equal(state.flags.jobSecurityRisk ?? null, null, "işsizken risk bayrağı asılı kalmamalı");
    }
    // İş kimliği değişimleri tarihçe sınırından bağımsız, geçişin kendisinden okunur.
    if (previousJobId !== state.career.jobId) {
      const recent = state.career.history.slice(-4);
      if (state.career.jobId === null) {
        if (recent.some((item) => item.type === "resigned")) counters.resignations += 1;
        else { counters.jobLosses += 1; assert.ok(recent.some((item) => item.type === "involuntary_unemployment"), "iş kaybı geçmişe bir kez yazılmalı"); }
      } else if (previousJobId === null) counters.reemployments += 1;
      else if (recent.some((item) => item.type === "promotion" && item.jobId === state.career.jobId)) counters.promotions += 1;
      else counters.jobSwitches += 1;
      previousJobId = state.career.jobId;
    }
    // İşsizken terfi kaydı doğamaz.
    if (state.career.jobId === null)
      assert.equal(state.career.history.slice(-2).some((item) => item.type === "promotion"), false, "işsiz oyuncu terfi edemez");

    const reliefCases = state.openCases.filter((item) => item.payload?.kind === "money_relief" && item.status !== "resolved");
    assert.ok(reliefCases.length <= 1, "aynı anda birden fazla açık destek dosyası olamaz");
    for (const item of reliefCases) {
      assert.ok(item.payload.amount >= MONEY_RELIEF_MIN && item.payload.amount <= MONEY_RELIEF_MAX, "destek tutarı sınırlar içinde olmalı");
      observed.reliefAmount = Math.max(observed.reliefAmount, item.payload.amount);
    }
    const reliefIds = new Set(reliefCases.map((item) => item.id));
    for (const id of previousReliefCaseIds)
      if (!reliefIds.has(id) && !state.openCases.some((item) => item.id === id && item.status === "resolved")) counters.reliefExpired += 1;
    previousReliefCaseIds = reliefIds;
    observed.reliefCases = Math.max(observed.reliefCases, reliefCases.length);
    const securityCases = state.openCases.filter((item) => item.payload?.kind === "job_security" && item.status !== "resolved");
    assert.ok(securityCases.length <= 1, "aynı anda birden fazla iş güvenliği dosyası olamaz");
    observed.securityCases = Math.max(observed.securityCases, securityCases.length);
    counters.reviewsPassed = state.career.history.filter((item) => item.type === "security_review_passed").length;

    if (state.education.tuitionOwedThisMonth === 0 && previousTuitionOwed > 0) education.tuitionPaid += previousTuitionOwed;
    previousTuitionOwed = state.education.tuitionOwedThisMonth;
    if (policy.education && education.enrolledWeek && !education.completedWeek && !state.education.active) {
      education.completedWeek = state.time.absoluteWeek;
      education.eligibleAfter = isEligibleForJob(state, gateJob).ok;
    }
    if (policy.education && education.completedWeek && !education.transitionWeek && state.career.jobId === gateJob.id) {
      education.transitionWeek = state.time.absoluteWeek;
      education.salaryAfter = getMonthlySummary(state).salary;
    }

    // ---- gözlenen sınırlar ----
    observed.costIndex = Math.max(observed.costIndex, getCostOfLivingIndex(state));
    observed.performance = Math.max(observed.performance, state.career.performance);
    observed.performanceLow = Math.min(observed.performanceLow, state.career.performance);
    observed.openCases = Math.max(observed.openCases, state.openCases.filter((item) => item.status !== "resolved").length);
    observed.ledger = Math.max(observed.ledger, state.finances.ledger.length);
    observed.careerHistory = Math.max(observed.careerHistory, state.career.history.length);
    observed.yearFile = Math.max(observed.yearFile, state.yearlyHistory.length);
    observed.memories = Math.max(observed.memories, state.memories.length);
    observed.npcMemories = Math.max(observed.npcMemories, ...state.people.map((person) => person.memories.length));
    observed.balanceLow = Math.min(observed.balanceLow, state.finances.balance);
    observed.balanceHigh = Math.max(observed.balanceHigh, state.finances.balance);
    observed.savingsMultiple = Math.max(observed.savingsMultiple, savingsMultiple(state));
    assert.ok(state.career.performance >= 0 && state.career.performance <= 100);
    assert.ok(getCostOfLivingIndex(state) <= 1.5);
    assert.ok(state.finances.ledger.length <= 120);
    assert.ok(state.career.history.length <= 40);
    assert.ok(state.yearlyHistory.length <= 80);
    assert.ok(state.memories.length <= 200);
    assert.ok(state.secrets.length <= 30);
    assert.ok(state.people.every((person) => person.memories.length <= 50));

    const week = state.time.absoluteWeek;
    if (ADULT_CORE_CHECKPOINTS.includes(week) && !checkpoints[week]) {
      const summary = getMonthlySummary(state);
      const job = getJobById(state.career.jobId);
      const relief = reliefCases[0] || null;
      checkpoints[week] = {
        week, age: state.player.age,
        jobId: state.career.jobId, jobTitle: job?.title || null, salary: summary.salary,
        performance: state.career.performance, weeksInRole: state.career.weeksInRole,
        jobSecurity: securityCases.length ? "review-pending" : state.flags.jobSecurityRisk ? "at-risk" : "stable",
        balance: Math.round(state.finances.balance),
        monthlyBaselineCost: summary.housing + summary.otherExpenses + summary.tuition + summary.parenting,
        housingCost: getMonthlyHousingCost(state), costIndex: getCostOfLivingIndex(state),
        annualBaselineCost: annualBaselineCost(state), savingsMultiple: savingsMultiple(state),
        relief: relief ? { amount: relief.payload.amount, dueWeek: relief.dueWeek } : null,
        education: { level: state.education.level, fields: [...state.education.fields], active: state.education.active?.pathId || null, tuitionOwedThisMonth: state.education.tuitionOwedThisMonth },
        health: state.health.health, stress: state.health.stress, energy: state.health.energy,
        activeOpenCases: state.openCases.filter((item) => item.status !== "resolved").length,
        careerHistory: state.career.history.length, yearFile: state.yearlyHistory.length,
      };
    }

    if (step % 24 === 0) {
      assert.equal(saveGame(storage, state).ok, true);
      const loaded = loadGame(storage);
      assert.equal(loaded.ok, true);
      assert.deepEqual(loaded.state.career, state.career, "kayıt/yükleme kariyeri bozmamalı");
      assert.equal(loaded.state.finances.balance, state.finances.balance, "kayıt/yükleme kasayı bozmamalı");
      assert.deepEqual(loaded.state.openCases, state.openCases, "kayıt/yükleme açık dosyaları bozmamalı");
      state = loaded.state;
    }
  }

  return {
    kind, weeks: state.time.absoluteWeek, checkpoints, counters, observed,
    education: policy.education ? education : null,
    final: {
      jobId: state.career.jobId, jobTitle: getJobById(state.career.jobId)?.title || null,
      salary: getMonthlySummary(state).salary, performance: state.career.performance,
      balance: Math.round(state.finances.balance), savingsMultiple: savingsMultiple(state),
      annualBaselineCost: annualBaselineCost(state), costIndex: getCostOfLivingIndex(state),
      home: state.household.homeId, educationLevel: state.education.level, fields: [...state.education.fields],
    },
    valid: validateState(state).ok,
  };
}

export function runLifetimeScenario(kind = "balanced-family", { successorYears = 5, generations = 2 } = {}) {
  const family = kind === "balanced-family" || kind === "multiple-heirs";
  const early = family ? runChildScenario("stable", { includeState: true, maxChildren: kind === "multiple-heirs" ? 2 : 1, economicPolicy: true }) : null;
  let state = early?.state || createNewGame({ now: "2027-01-01T00:00:00.000Z" });
  const checkpoints = { ...early?.playerCheckpoints };
  const counts = {};
  const maximums = { memories: 0, npcMemories: 0, history: 0, years: 0, cases: 0, activeCases: 0, ledger: 0, children: 0, adultContexts: 0, reports: 0, secrets: 0, career: 0 };
  const storage = new MemoryStorage();
  const observe = (event) => { counts[event.id] = (counts[event.id] || 0) + 1; };
  const policies = {
    parent_planning: "no", parent_planning_review: "no", family_intent_discussion: "later",
    adult_child_discussion: s => kind === "overwork" ? "direct" : s.finances.balance >= 1500 ? "support" : "space",
    retirement_planning: kind === "overwork" ? "continue" : "plan",
    retirement_transition: kind === "overwork" ? "continue" : "retire",
    health_overload_review: kind === "overwork" ? "continue" : "slow",
    health_recovery_review: kind === "overwork" ? "ignore" : "care",
    health_inactivity_review: kind === "overwork" ? "ignore" : "move",
  };
  const settle = () => settleHouseholdEvents(state, policies, observe);
  const snapshot = () => ({ age: state.player.age, week: state.time.absoluteWeek, job: state.career.jobId,
    retirement: structuredClone(state.career.retirement), money: state.finances.balance,
    health: structuredClone(state.health), children: structuredClone(state.parenthood.children.map(c => ({ id: c.id, age: childAge(state, c), adult: c.adult, trajectory: c.trajectory }))),
    generation: state.lifetime?.generation || 1 });
  const measure = () => {
    const values = { memories: state.memories.length, npcMemories: Math.max(...state.people.map(p => p.memories.length)), history: state.events.history.length,
      years: state.yearlyHistory.length, cases: state.openCases.length, activeCases: state.openCases.filter(c => c.status !== "resolved").length,
      ledger: state.finances.ledger.length, children: state.parenthood.children.length, adultContexts: state.parenthood.children.filter(c => c.adult).length,
      reports: state.lifetime?.reports.length || 0, secrets: state.secrets.length, career: state.career.history.length };
    for (const [k, v] of Object.entries(values)) maximums[k] = Math.max(maximums[k], v);
    assert.ok(values.memories <= 200 && values.npcMemories <= 50 && values.years <= 80 && values.ledger <= 120 && values.reports <= 8, JSON.stringify(values));
    const ids = state.openCases.filter(c => c.status !== "resolved").map(c => c.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.equal(validateState(state).ok, true, validateState(state).errors.join("; "));
  };
  const play = () => {
    settle();
    if (kind !== "overwork" && state.player.age < 55 && !state.education.active && state.education.level !== "lisans" && state.finances.balance >= 8000) enrollEducation(state, "university", "part");
    if (state.career.retirement.status !== "retired" && state.time.absoluteWeek % 24 === 0)
      for (const job of ["specialist", "technician", "office", "courier", "market"]) {
        if (getJobById(job).salary <= (getJobById(state.career.jobId)?.salary || 0)) continue;
        if (acceptJobOffer(state, job).ok) break;
      }
    settle();
    const actions = kind === "overwork" ? ["overtime"] : kind === "health-first" ? ["rest", "exercise"] : ["rest", state.time.absoluteWeek % 4 === 0 ? "family" : "exercise"];
    for (const id of actions) { if (canApplyDecision(state, id).ok) applyDecision(state, id); settle(); }
    assert.equal(advanceWeek(state).ok, true);
    if (!isDeceased(state)) settle();
    measure();
    if (state.time.absoluteWeek % 48 === 0 || isDeceased(state)) {
      assert.equal(saveGame(storage, state).ok, true);
      const loaded = loadGame(storage); assert.equal(loaded.ok, true, loaded.message);
      state = loaded.state;
    }
  };
  for (let step = 0; step < 4500 && !isDeceased(state); step++) {
    play();
    if ([35, 45, 55, 65, 70].includes(state.player.age) && !checkpoints[state.player.age]) checkpoints[state.player.age] = snapshot();
  }
  assert.ok(isDeceased(state), "production lifetime must terminate within the measured horizon");
  const death = structuredClone(state.lifetime.death);
  const report = structuredClone(state.lifetime.reports.at(-1));
  const terminal = snapshot();
  assert.equal(advanceWeek(state).ok, false);
  let successor = null;
  let thirdGeneration = null;
  let lineageEnding = null;
  if (family) {
    assert.ok(state.parenthood.children.some(c => childAge(state, c) >= 18));
    const id = state.parenthood.children[0].id;
    assert.equal(continueGeneration(state, id).ok, true);
    assert.equal(continueGeneration(state, id).ok, false);
    successor = { first: snapshot() };
    for (let week = 1; week <= successorYears * 48; week++) {
      play();
      if (week === 48) successor.year1 = snapshot();
    }
    successor.final = snapshot();
    assert.equal(state.lifetime.generation, 2);
    assert.deepEqual(state.lifetime.reports[0], report);
    for (let generation = 3; generation <= generations; generation++) {
      const remainingWeeks = Math.max(48, (99 - state.player.age) * 48);
      for (let i = 0; i < remainingWeeks && !isDeceased(state); i++) play();
      assert.ok(isDeceased(state));
      const nextChild = state.parenthood.children.find(c => childAge(state, c) >= 18);
      if (!nextChild && generation > 3) {
        assert.equal(continueGeneration(state, "none").ok, false);
        lineageEnding = { generation: state.lifetime.generation, age: state.player.age, reason: "no eligible successor" };
        break;
      }
      assert.ok(nextChild, "next eligible heir must come from runtime family context");
      assert.equal(continueGeneration(state, nextChild.id).ok, true);
      for (let i = 0; i < 48; i++) play();
      thirdGeneration = snapshot();
      assert.equal(thirdGeneration.generation, generation);
      assert.equal(state.lifetime.reports.length, Math.min(generation - 1, 8));
    }
  } else assert.equal(continueGeneration(state, "none").ok, false);
  return { kind, birthWeek: early?.birthWeek || null, checkpoints, terminal, death, successor, thirdGeneration, lineageEnding, counts, maximums, state };
}

export function runAdultCoreMatrix() {
  return Object.fromEntries(["career-focused", "balanced", "financially-strained", "education-career"].map((kind) => [kind, runAdultCoreScenario(kind)]));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
const mode = process.argv[2] || "520";
if (mode.startsWith("lifetime")) {
  const kinds = mode === "lifetime" ? ["balanced-family", "health-first", "overwork", "no-successor", "multiple-heirs"] : [mode.slice(9)];
  console.log(JSON.stringify(kinds.map(k => { const { state, ...result } = runLifetimeScenario(k); return result; }), null, 2));
} else if (mode.startsWith("adult-")) {
  const kind = { "adult-career": "career-focused", "adult-balanced": "balanced", "adult-strained": "financially-strained", "adult-education": "education-career" }[mode];
  console.log(JSON.stringify(kind ? runAdultCoreScenario(kind) : runAdultCoreMatrix(), null, 2));
} else if (mode === "child" || mode === "child-stable" || mode === "child-strained" || mode === "child-separated") {
  const kind = mode === "child" ? "stable" : mode.replace("child-", "");
  console.log(JSON.stringify(runChildScenario(kind), null, 2));
} else if (mode === "child-matrix") {
  console.log(JSON.stringify(Object.fromEntries(["stable", "strained", "separated"].map((k) => [k, runChildScenario(k)])), null, 2));
} else if (mode === "parenthood" || mode === "no-child") {
  console.log(JSON.stringify(runParenthoodScenario({ noChild: mode === "no-child" }), null, 2));
} else if (mode === "household" || mode === "separation") {
  console.log(JSON.stringify(runHouseholdScenario(520, { conflict: mode === "separation" }), null, 2));
} else if (mode === "body") {
  console.log(JSON.stringify(runBodyMatrix(), null, 2));
} else if (mode === "fuzz") {
  const failed = [];
  for (let seed = 1; seed <= 20; seed += 1) {
    const result = run(260, seed);
    if (result.problems.length) failed.push({ seed, problems: result.problems });
  }
  console.log(JSON.stringify({ mode: "fuzz", seeds: 20, weeksPerSeed: 260, failed }, null, 1));
  process.exitCode = failed.length ? 1 : 0;
} else {
  const result = run(Number(mode), Number(process.argv[3] || 1));
  console.log(JSON.stringify(result, null, 1));
  process.exitCode = result.problems.length ? 1 : 0;
}

}
