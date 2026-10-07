import { syncGameDate } from "./game-date.js?v=10";
import { createNewGame, addMemory, transact, clamp, adjustHealth } from "./state.js?v=10";
import { childAge, childStage, childAcademicStanding } from "./parenthood.js?v=10";
import { netWorth, neutralWealth } from "./wealth.js?v=10";

export const LIFE_REPORT_LIMIT = 8;
export const CLOSED_LIFE_CASE_LIMIT = 128;
export const TERMINAL_REASON =
  "Bu yaşam tamamlandı. Yaşam raporunu inceleyebilir, uygunsa bir yetişkin çocukla devam edebilirsin.";
export const isDeceased = (state) => Boolean(state.lifetime?.death);
export function normalizeLifetime(state) {
  state.lifetime ??= { generation: 1, bornWeek: null, death: null, reports: [], family: [] };
  return state.lifetime;
}
export function validateLifetime(state) {
  const life = state.lifetime;
  if (!life) return true; // Additive v5 migration: no invented past events.
  return (
    Number.isSafeInteger(life.generation) &&
    life.generation >= 1 &&
    (life.bornWeek === null || Number.isInteger(life.bornWeek)) &&
    Array.isArray(life.reports) &&
    life.reports.length <= LIFE_REPORT_LIMIT &&
    life.reports.every(
      (r) =>
        r &&
        typeof r.id === "string" &&
        typeof r.name === "string" &&
        r.name.length <= 40 &&
        Number.isInteger(r.age) &&
        r.age >= 0 &&
        Array.isArray(r.memories) &&
        r.memories.length <= 20 &&
        Array.isArray(r.years) &&
        r.years.length <= 8 &&
        Array.isArray(r.children) &&
        r.children.length <= 8 &&
        Array.isArray(r.career?.history) &&
        r.career.history.length <= 40 &&
        validEstate(r.estate),
    ) &&
    new Set(life.reports.map((r) => r.id)).size === life.reports.length &&
    Array.isArray(life.family) &&
    life.family.length <= 8 &&
    (!life.death ||
      (Number.isInteger(life.death.week) &&
        life.death.week <= state.time.absoluteWeek &&
        life.reports.some(
          (r) =>
            r.id === life.death.reportId &&
            r.generation === life.generation &&
            JSON.stringify(r.estate) === JSON.stringify(life.death.estate),
        ) &&
        validEstate(life.death.estate))) &&
    (state.parenthood?.children || []).every(
      (c) =>
        !c.adult ||
        (["studying", "working", "between"].includes(c.adult.path) &&
          typeof c.adult.independent === "boolean" &&
          Number.isInteger(c.adult.milestones) &&
          c.adult.milestones >= 0 &&
          c.adult.milestones <= 15 &&
          (!c.adult.family ||
            (typeof c.adult.family.partnerName === "string" &&
              typeof c.adult.family.child?.id === "string" &&
              typeof c.adult.family.child?.name === "string" &&
              Number.isInteger(c.adult.family.child.bornWeek) &&
              c.adult.family.child.bornWeek >= 1 &&
              c.adult.family.child.bornWeek <= state.time.absoluteWeek))),
    )
  );
}
function validEstate(e) {
  if (!e?.settled || !Array.isArray(e.shares) || e.shares.length > 8) return false;
  const gross = Number.isSafeInteger(e.gross) ? e.gross : e.cash;
  return (
    [e.cash, gross, e.obligations, e.net, e.unallocated].every(Number.isSafeInteger) &&
    e.obligations >= 0 &&
    e.net === Math.max(0, gross - e.obligations) &&
    e.unallocated >= 0 &&
    e.shares.every(
      (s) => typeof s?.childId === "string" && Number.isSafeInteger(s.amount) && s.amount >= 0,
    ) &&
    new Set(e.shares.map((s) => s.childId)).size === e.shares.length &&
    e.shares.reduce((n, share) => n + share.amount, e.unallocated) === e.net
  );
}

export function mortalityContext(state) {
  const conditions = (state.body?.conditions || []).filter((c) => c.status !== "resolved");
  const burden = Math.min(
    12,
    conditions.reduce(
      (n, c) => n + (c.status === "chronic" ? 4 : c.status === "managed" ? 1 : 2),
      0,
    ),
  );
  const wear = (state.body?.exposures?.overwork || 0) + (state.body?.exposures?.underRecovery || 0);
  // Simulation abstraction, not medical prognosis. Never kills at age 70.
  const longevity =
    88 + Math.floor((state.health.health - 50) / 6) - burden - Math.floor(wear / 30);
  const thresholdAge = clamp(longevity, 74, 98);
  return {
    thresholdAge,
    eligible: state.player.age >= thresholdAge,
    cause: conditions.length
      ? "Uzun süreli sağlık yükü"
      : state.health.health < 40
        ? "Sağlıkta uzun süreli gerileme"
        : "İleri yaş",
  };
}

export function eligibleSuccessors(state) {
  return state.parenthood.children.filter((c) => childAge(state, c) >= 18 && c.alive !== false);
}
export function estateSnapshot(state) {
  const relief = state.openCases
    .filter((c) => c.status !== "resolved" && c.payload?.kind === "money_relief")
    .reduce((sum, c) => sum + Math.max(0, Number(c.payload.amount) || 0), 0);
  const worth = netWorth(state);
  const obligations =
    relief +
    (state.education.tuitionOwedThisMonth || 0) +
    (state.parenthood.careOwedThisMonth || 0) +
    worth.debt;
  const gross = worth.cash + worth.investments + worth.property + worth.vehicle + worth.durables;
  const net = Math.max(0, gross - obligations);
  const heirs = state.parenthood.children
    .filter((c) => c.alive !== false)
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id));
  const each = heirs.length ? Math.floor(net / heirs.length) : 0;
  return {
    settled: true,
    cash: worth.cash,
    investments: worth.investments,
    property: worth.property,
    vehicle: worth.vehicle,
    durables: worth.durables,
    debt: worth.debt,
    gross,
    obligations,
    net,
    unallocated: heirs.length ? 0 : net,
    shares: heirs.map((c, i) => ({
      childId: c.id,
      name: c.name,
      amount: each + (i < net % heirs.length ? 1 : 0),
    })),
  };
}

function finishLife(state, context) {
  const life = normalizeLifetime(state);
  if (life.death) return false;
  const id = `life-${life.generation}-${state.time.absoluteWeek}`;
  const estate = estateSnapshot(state);
  const report = {
    id,
    generation: life.generation,
    name: state.player.name,
    age: state.player.age,
    year: state.time.year,
    week: state.time.absoluteWeek,
    cause: context.cause,
    background: structuredClone(state.player.background),
    education: structuredClone(state.education),
    career: structuredClone(state.career),
    health: structuredClone(state.health),
    conditions: structuredClone(state.body.conditions.filter((c) => c.knownToPlayer)),
    homeId: state.household.homeId,
    householdHistory: structuredClone(state.household.history),
    partner: state.people.find((p) => p.id === state.social.currentPartnerNpcId)?.name || null,
    children: state.parenthood.children.map((c) => ({
      id: c.id,
      name: c.name,
      age: childAge(state, c),
      otherParentId: c.otherParentId,
      trajectory: c.trajectory || "undecided",
      adult: c.adult ? structuredClone(c.adult) : null,
      relationship: structuredClone(c.relationship),
      school: childAcademicStanding(c),
    })),
    memories: state.memories.slice(-20).map((m) => ({ text: m.text, year: m.year })),
    years: structuredClone(state.yearlyHistory.slice(-8)),
    wealth: { lifestyle: state.wealth?.lifestyle || "modest", netWorth: netWorth(state) },
    estate: structuredClone(estate),
  };
  life.reports = [...life.reports, report].slice(-LIFE_REPORT_LIMIT);
  life.death = {
    week: state.time.absoluteWeek,
    age: state.player.age,
    cause: context.cause,
    reportId: id,
    estate,
  };
  for (const c of state.openCases) {
    c.status = "resolved";
    c.resolutionApplied = true;
  }
  state.events.active = null;
  state.events.queue = [];
  state.career.jobId = null;
  state.career.pendingJob = null;
  state.career.retirement.monthlyIncome = 0;
  state.finances.otherMonthlyIncome = 0;
  state.education.active = null;
  state.weekly = { used: 0, selectedIds: [] };
  return true;
}

const PATH_LABELS = {
  studying: "Eğitimine devam ediyor",
  working: "Çalışma hayatında",
  between: "Yönünü değerlendiriyor",
};
export function adultChildSummary(state) {
  return state.parenthood.children
    .filter((c) => c.adult)
    .map((c) => ({
      id: c.id,
      name: c.name,
      text: `${c.name} · ${childAge(state, c)} yaş · ${PATH_LABELS[c.adult.path]} · ${c.adult.independent ? "bağımsız yaşam" : "aile desteğiyle yaşam"}${c.adult.family ? ` · ailesi: ${c.adult.family.partnerName}, ${c.adult.family.child.name}` : ""}`,
    }));
}
function scheduleAdult(state, child, kind, delay) {
  if (
    state.openCases.some(
      (c) => c.type === "adult-child" && c.payload.childId === child.id && c.status !== "resolved",
    )
  )
    return;
  state.openCases.push({
    id: `adult-${child.id}-${kind}`,
    type: "adult-child",
    eventId: "adult_child_discussion",
    createdWeek: state.time.absoluteWeek,
    dueWeek: state.time.absoluteWeek + delay,
    status: "pending",
    payload: { childId: child.id, kind, playerKnown: true },
  });
}
export function processLifetimeWeek(state) {
  if (isDeceased(state)) return;
  const life = normalizeLifetime(state);
  if (life.bornWeek !== null && !state.time.date)
    state.player.age = Math.floor((state.time.absoluteWeek - life.bornWeek) / 48);
  if (state.player.age > 70) {
    const retained = new Set(
      state.openCases.filter((c) => c.status === "resolved").slice(-CLOSED_LIFE_CASE_LIMIT),
    );
    state.openCases = state.openCases.filter((c) => c.status !== "resolved" || retained.has(c));
  }
  for (const child of state.parenthood.children) {
    const age = childAge(state, child);
    if (age < 18) continue;
    if (!child.adult) {
      child.adult = {
        path:
          child.trajectory === "education-focused"
            ? "studying"
            : child.trajectory === "work-focused"
              ? "working"
              : "between",
        independent: false,
        milestones: 0,
      };
    }
    // Late imported relatives do not receive an invented late-age birth.
    if (age >= 45) child.adult.milestones |= 8;
    const kind = !(child.adult.milestones & 1)
      ? "path"
      : age >= 25 && !(child.adult.milestones & 2)
        ? "independence"
        : age >= 30 && !(child.adult.milestones & 8)
          ? "family"
          : age >= 35 && !(child.adult.milestones & 4)
            ? "support"
            : null;
    if (kind) scheduleAdult(state, child, kind, 2);
  }
  const context = mortalityContext(state);
  if (context.eligible) finishLife(state, context);
}
function adultSource(state, source) {
  return (
    source?.type === "adult-child" &&
    source.status !== "resolved" &&
    state.parenthood.children.find((c) => c.id === source.payload.childId && c.adult)
  );
}
export function resolveAdultChoice(state, choice, source) {
  const child = adultSource(state, source);
  if (!child || isDeceased(state)) return;
  const supported = choice === "support";
  adjustHealth(state, { energy: -4, stress: choice === "direct" ? 2 : -2 });
  if (supported) transact(state, -1500, `${child.name}: yetişkinlik desteği`, "family");
  const opposed = choice === "direct";
  const receptive = child.relationship.trust >= 65 && child.relationship.tension <= 35;
  if (source.payload.kind === "path") {
    if (child.adult.path === "between" && supported)
      child.adult.path = child.futurePreference === "education" ? "studying" : "working";
    if (opposed && receptive) child.adult.path = "working";
    child.adult.milestones |= 1;
  } else if (source.payload.kind === "independence") {
    if (child.adult.path === "studying") child.adult.path = "working";
    child.adult.independent = !opposed || !receptive;
    child.livesWithPlayer = !child.adult.independent;
    child.adult.milestones |= 2;
  } else if (source.payload.kind === "family") {
    // Contextual autonomous milestone, not a second marriage/parenthood engine.
    if (child.adult.independent && child.adult.path === "working") {
      child.adult.family = {
        partnerName: "Ekin",
        child: {
          id: `${child.id}-descendant`,
          name: `${child.name} Deniz`.slice(0, 40),
          bornWeek: state.time.absoluteWeek,
        },
      };
      addMemory(
        state,
        `${child.name} kendi ailesini kurdu; ${child.adult.family.child.name} doğdu.`,
        "important",
      );
    }
    child.adult.milestones |= 8;
  } else {
    child.adult.milestones |= 4;
  }
  child.relationship.trust = clamp(child.relationship.trust + (supported ? 3 : opposed ? -3 : 0));
  child.relationship.tension = clamp(child.relationship.tension + (opposed ? 6 : -3));
  addMemory(
    state,
    `${child.name} ile yetişkinlik sorumluluklarını konuştun: ${supported ? "destek verdin" : opposed ? "yön vermeye çalıştın" : "kararına alan bıraktın"}.`,
    "important",
  );
  source.status = "resolved";
  source.resolutionApplied = true;
}
export function adultEventContext(state) {
  const source = state.openCases.find((c) => c.id === state.events.active?.sourceCaseId);
  const child = adultSource(state, source);
  if (!child) return "";
  const topics = {
    path: "Eğitim ve çalışma yönünü konuşuyorsunuz.",
    independence: "Kendi düzenini kurmak istiyor.",
    support: "Yeni aile sorumluluklarında desteğinin sınırlarını konuşuyorsunuz.",
    family: "Kendi ailesini kurma kararı ona ait; seninle bu yeni dönemi paylaşıyor.",
  };
  return `${child.name}: ${PATH_LABELS[child.adult.path]}. ${topics[source.payload.kind]}`;
}
export const LIFETIME_EVENTS = [
  {
    id: "adult_child_discussion",
    repeat: "repeatable",
    lifetime: true,
    title: "Yetişkin çocuğunla yeni bir dönem",
    text: "Eğitim, iş ve bağımsız yaşam artık onun kararları. Desteğinin sınırlarını birlikte konuşabilirsiniz.",
    condition: () => false,
    choices: [
      { id: "support", label: "₺1.500 destek ver, kararını dinle", effects: {} },
      { id: "direct", label: "Kendi önerdiğin yönde ısrar et", effects: {} },
      { id: "space", label: "Kararına alan bırak", effects: {} },
    ],
    validateChoice: (state, definition, choice, source) =>
      !adultSource(state, source)
        ? { ok: false, reason: "Bu görüşme artık açık değil." }
        : choice.id === "support" && state.finances.balance < 1500
          ? { ok: false, reason: "Destek için ₺1.500 gerekiyor." }
          : { ok: true },
  },
];

export function continueGeneration(state, childId) {
  const life = state.lifetime;
  if (!life?.death) return { ok: false, reason: "Devam edilecek tamamlanmış bir yaşam yok." };
  if (!validateLifetime(state) || life.generation >= Number.MAX_SAFE_INTEGER)
    return { ok: false, reason: "Kuşak kaydı doğrulanamadı." };
  const child = eligibleSuccessors(state).find((c) => c.id === childId);
  if (!child) return { ok: false, reason: "Geçerli bir yetişkin çocuk seçmelisin." };
  const share = life.death.estate.shares.find((s) => s.childId === childId)?.amount || 0;
  const next = createNewGame({
    name: child.name,
    seed: state.meta.rngState,
    now: state.meta.createdAt,
    gameId: state.meta.gameId,
  });
  next.time = structuredClone(state.time);
  next.player.age = childAge(state, child);
  next.finances.balance = share;
  next.wealth = neutralWealth();
  next.career.jobId = child.adult?.path === "working" ? "market" : null;
  // Broad context cannot justify granting a university diploma or a specialist job.
  next.player.background.education = "general";
  next.lifetime = {
    generation: life.generation + 1,
    bornWeek: child.bornWeek,
    death: null,
    reports: structuredClone(life.reports),
    family: [
      {
        id: `generation-${life.generation}-player`,
        name: state.player.name,
        relation: "deceased_parent",
        alive: false,
      },
      ...state.parenthood.children
        .filter((c) => c.id !== childId)
        .map((c) => ({ id: c.id, name: c.name, relation: "sibling", alive: c.alive !== false })),
      {
        id: `generation-${life.generation}-${child.otherParentId}`,
        name: state.people.find((p) => p.id === child.otherParentId)?.name || "Diğer ebeveyn",
        relation: "parent",
        alive: true,
      },
    ].slice(0, 8),
  };
  next.flags.depth2Enabled = state.flags.depth2Enabled === true;
  next.flags.depth3Enabled = state.flags.depth3Enabled === true;
  next.yearlyPlan.year = state.time.year;
  next.meta.yearStartBalance = share;
  next.social.lastMaintenanceWeek = state.time.absoluteWeek;
  next.parenthood.lastWeek = state.time.absoluteWeek;
  if (child.adult?.family) {
    const family = child.adult.family;
    const partner = next.people.find((p) => p.id === "elif");
    partner.name = family.partnerName;
    partner.social.romanceStatus = "partner";
    next.social.currentPartnerNpcId = partner.id;
    next.parenthood.children = [
      {
        ...structuredClone(family.child),
        otherParentId: partner.id,
        livesWithPlayer: true,
        relationship: { closeness: 60, trust: 60, tension: 0 },
        futurePreference: null,
        trajectory: "undecided",
      },
    ];
    // The relative was born during the previous life. School history is not fabricated.
    next.parenthood.children[0].school = {
      attendancePressure: 0,
      socialPressure: 0,
      issues: [],
      extracurricular: null,
      hiddenIssue: null,
      lastUpdatedWeek: state.time.absoluteWeek,
    };
    next.parenthood.children[0].stageMark = {
      stage: childStage(next, next.parenthood.children[0]),
      transitions: [],
    };
  }
  const otherParent = state.people.find((p) => p.id === child.otherParentId);
  next.people.find((p) => p.id === "anne").name = otherParent?.name || "Diğer ebeveyn";
  const deceasedParent = next.people.find((p) => p.id === "baba");
  deceasedParent.name = state.player.name;
  deceasedParent.deceased = true;
  deceasedParent.available = false;
  deceasedParent.social.trust = child.relationship.trust;
  deceasedParent.social.tension = child.relationship.tension;
  next.relationships.baba = child.relationship.closeness;
  // Existing NPC slots are a neutral new social circle, not inherited secrets.
  for (const p of next.people) {
    p.social.lastMeaningfulContactWeek = state.time.absoluteWeek;
  }
  addMemory(
    next,
    `${state.player.name} yaşamının ardından ${child.name} ile devam ediyorsun. Tereke payın ₺${share}. Eğitim ve iş ayrıntıları için nötr başlangıç kullanıldı.`,
    "important",
  );
  for (const key of Object.keys(state)) delete state[key];
  Object.assign(state, next);
  syncGameDate(state);
  return { ok: true, message: `${child.name} ile yeni kuşak başladı.` };
}
