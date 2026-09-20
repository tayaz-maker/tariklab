import {
  SCENARIOS,
  MILESTONES,
  ACTIONS as A100,
  EVENTS as SON_EVENTS,
  SON_CALLBACKS,
  SON_ENDINGS,
} from "./son100-data.js";

export const clamp = (n, a = 0, b = 100) => Math.max(a, Math.min(b, n));

const SUICIDE = /suicid|intihar|self[-_]?harm|kendine\s*zarar/i;

export const SON_PHASES = [
  {
    id: "preparation",
    min: 81,
    label: ["Hazırlık", "Preparation"],
    note: [
      "Teşhis kesin. Para, beden ve insan bağları için tampon kurma zamanı.",
      "The diagnosis is certain. Build buffers for money, health and people.",
    ],
    pressure: 2,
    families: ["health", "money", "family"],
  },
  {
    id: "fracture",
    min: 61,
    label: ["İlk kırılmalar", "First fractures"],
    note: [
      "İlk sinyaller sonuç üretmeye başlıyor; hazırlıkların artık gerçek bir karşılığı var.",
      "The first signals are becoming consequences; preparation now has a real payoff.",
    ],
    pressure: 3,
    families: ["work", "legal", "family"],
  },
  {
    id: "scarcity",
    min: 41,
    label: ["Kaynak krizi", "Resource crisis"],
    note: [
      "Nakit, enerji ve zaman aynı anda daralıyor. Her koruma başka bir alanı açıkta bırakır.",
      "Cash, energy and time are tightening together. Protecting one area exposes another.",
    ],
    pressure: 4,
    families: ["money", "health", "work"],
  },
  {
    id: "collapse",
    min: 21,
    label: ["Sistemik çöküş", "Systemic collapse"],
    note: [
      "İlişkiler, hukuk ve beden birbirini tetikliyor. Eski dosyalar geri dönüyor.",
      "Relationships, law and health now trigger one another. Old files return.",
    ],
    pressure: 5,
    families: ["family", "legal", "health"],
  },
  {
    id: "finale",
    min: 1,
    label: ["Son hesap", "Final reckoning"],
    note: [
      "Yeni hayat kurmak değil; neyi, kimi ve hangi sözü koruduğun belirleyici.",
      "This is no longer about building a new life, but what, whom and which promise you protect.",
    ],
    pressure: 6,
    families: ["legacy", "family", "faith"],
  },
];

export function sonPhase(s) {
  const left = s.remainingDays ?? 100;
  if (left <= 0)
    return {
      id: "death",
      label: ["Gün 0", "Day 0"],
      note: [
        "Artık karar yok. Hüküm kayıtta duruyor.",
        "There are no decisions left. The verdict is in the file.",
      ],
      pressure: 0,
      families: [],
    };
  return SON_PHASES.find((phase) => left >= phase.min) || SON_PHASES.at(-1);
}

const CRISIS_CHAINS = [
  {
    id: "diagnosis",
    phase: "preparation",
    family: "health",
    due: 92,
    title: ["Tetkik sonucu", "Test result"],
    risk: 42,
  },
  {
    id: "income-break",
    phase: "fracture",
    family: "money",
    due: 73,
    title: ["Gelir kırılması", "Income fracture"],
    risk: 50,
  },
  {
    id: "care-shortage",
    phase: "scarcity",
    family: "people",
    due: 53,
    title: ["Bakım açığı", "Care shortage"],
    risk: 58,
  },
  {
    id: "legal-return",
    phase: "collapse",
    family: "legal",
    due: 33,
    title: ["Eski dosya", "Old case"],
    risk: 64,
  },
  {
    id: "last-promise",
    phase: "finale",
    family: "legacy",
    due: 13,
    title: ["Son söz", "Final promise"],
    risk: 70,
  },
];

const PREP_ACTIONS = {
  health: new Set(["rest", "doctor", "travel"]),
  money: new Set(["work", "pay", "min"]),
  people: new Set(["family", "visit-friend", "call-ex", "forgive"]),
  legal: new Set(["report-crime", "confess", "write-will"]),
  legacy: new Set(["legacy", "write-will", "donate", "protect"]),
};

const deterministicRoll = (s, key) => {
  let n = (s.meta?.seed || 73129) ^ ((s.day || 1) * 2654435761);
  for (const ch of key) n = Math.imul(n ^ ch.charCodeAt(0), 16777619);
  return ((n >>> 0) % 1000) / 10;
};

export function emptySoul() {
  return {
    fear: 40,
    acceptance: 20,
    conscience: 40,
    faith: 20,
    hedonism: 20,
    anger: 20,
    harm: 0,
    mercy: 0,
    betrayal: 0,
    crime: 0,
    courage: 20,
    forgiveness: 10,
    legacy: 0,
    violence: 0,
    love: 0,
    selfish: 0,
    repent: 0,
  };
}

export function sonSoul(s) {
  return { ...emptySoul(), ...(s.flags?.soul || {}) };
}

function setSoul(s, patch) {
  const soul = sonSoul(s);
  for (const [key, value] of Object.entries(patch)) {
    if (typeof soul[key] === "number" && Number.isFinite(value))
      soul[key] = clamp(soul[key] + value, 0, 100);
  }
  s.flags.soul = soul;
}

function rel(s, key, d) {
  const r = (s.relationships || []).find((x) => x.id === key);
  if (r) r.value = clamp(r.value + d);
}

function pushHist(s, row) {
  s.history = (s.history || []).concat(row).slice(-80);
}

function countActs(s, id) {
  return (s.history || []).filter((row) => row.type === "act" && row.id === id).length;
}

function usedToday(s, id) {
  return (s.history || []).some((row) => row.type === "act" && row.id === id && row.day === s.day);
}

export function ensureSonState(s) {
  if (!s || typeof s !== "object") return s;
  s.meta = { ...(s.meta || {}), id: "son-100-gun", version: 2, seed: s.meta?.seed || 73129 };
  s.flags = s.flags || {};
  s.focusMax = Number.isFinite(s.focusMax) ? s.focusMax : 8;
  s.focusRemaining = Number.isFinite(s.focusRemaining)
    ? s.focusRemaining
    : Math.max(0, (s.actionsRemaining ?? 2) * 4);
  s.flags.soul = { ...emptySoul(), ...(s.flags.soul || {}) };
  s.flags.milestones = Array.isArray(s.flags.milestones) ? s.flags.milestones : [];
  s.flags.workStreak = Number.isFinite(s.flags.workStreak) ? s.flags.workStreak : 0;
  s.flags.donateCount = Number.isFinite(s.flags.donateCount) ? s.flags.donateCount : 0;
  s.flags.prayCount = Number.isFinite(s.flags.prayCount) ? s.flags.prayCount : 0;
  s.flags.crimeCount = Number.isFinite(s.flags.crimeCount) ? s.flags.crimeCount : 0;
  s.flags.legalRisk = Number.isFinite(s.flags.legalRisk) ? s.flags.legalRisk : 0;
  s.flags.gambleDay = Number.isInteger(s.flags.gambleDay) ? s.flags.gambleDay : 0;
  s.flags.sonArcs =
    s.flags.sonArcs && typeof s.flags.sonArcs === "object" ? s.flags.sonArcs : {};
  s.openCases = Array.isArray(s.openCases) ? s.openCases : [];
  s.opportunities = Array.isArray(s.opportunities) ? s.opportunities : [];
  s.missed = Array.isArray(s.missed) ? s.missed : [];
  s.goalProgress = s.goalProgress || { money: 0, relationship: 0, health: 0, work: 0 };
  if (!s.relationships?.length) {
    s.relationships = [
      { id: "family", value: 48 },
      { id: "friend", value: 46 },
      { id: "work", value: 44 },
      { id: "partner", value: 40 },
    ];
  } else if (!s.relationships.some((item) => item.id === "partner")) {
    s.relationships.push({ id: "partner", value: 40 });
  }
  const oldDepth = s.depth && typeof s.depth === "object" ? s.depth : {};
  s.depth = {
    version: 2,
    preparations: {
      health: 0,
      money: 0,
      people: 0,
      legal: 0,
      legacy: 0,
      ...(oldDepth.preparations || {}),
    },
    actors: Array.isArray(oldDepth.actors)
      ? oldDepth.actors
      : s.relationships.map((r) => ({ id: r.id, trust: r.value, memory: [] })),
    chains: oldDepth.chains && typeof oldDepth.chains === "object" ? oldDepth.chains : {},
    phaseTrace: Array.isArray(oldDepth.phaseTrace) ? oldDepth.phaseTrace : [],
    resolved: Array.isArray(oldDepth.resolved) ? oldDepth.resolved : [],
    eventDirector:
      oldDepth.eventDirector && typeof oldDepth.eventDirector === "object"
        ? oldDepth.eventDirector
        : { recent: [] },
  };
  for (const actor of s.depth.actors) {
    actor.memory = Array.isArray(actor.memory) ? actor.memory.slice(-6) : [];
    actor.trust = Number.isFinite(actor.trust) ? clamp(actor.trust) : 50;
  }
  s.depth.phaseTrace = s.depth.phaseTrace.slice(-5);
  s.depth.resolved = s.depth.resolved.slice(-20);
  s.depth.eventDirector.recent = Array.isArray(s.depth.eventDirector.recent)
    ? s.depth.eventDirector.recent.slice(-12)
    : [];
  const phase = sonPhase(s);
  if (phase.id !== "death" && !s.depth.phaseTrace.some((row) => row.id === phase.id)) {
    s.depth.phaseTrace.push({ id: phase.id, day: s.day, left: s.remainingDays });
  }
  return s;
}

export function validateSonState(s) {
  if (
    !s ||
    s.meta?.id !== "son-100-gun" ||
    ![1, 2].includes(s.meta?.version) ||
    !Number.isInteger(s.day) ||
    s.day < 1 ||
    s.day > 101 ||
    !Number.isInteger(s.remainingDays) ||
    s.remainingDays < 0 ||
    s.remainingDays > 100 ||
    !Number.isInteger(s.actionsRemaining) ||
    s.actionsRemaining < 0 ||
    s.actionsRemaining > 2 ||
    !Number.isFinite(s.focusRemaining) ||
    s.focusRemaining < 0 ||
    s.focusRemaining > (s.focusMax || 8) ||
    !s.resources ||
    ![s.resources.money, s.resources.energy, s.resources.hope].every(Number.isFinite) ||
    !Array.isArray(s.relationships) ||
    !Array.isArray(s.obligations) ||
    !Array.isArray(s.opportunities) ||
    !Array.isArray(s.openCases) ||
    new Set(s.openCases.map((item) => item.id)).size !== s.openCases.length ||
    !Array.isArray(s.history) ||
    !s.flags ||
    !s.ui
  )
    return false;
  if (s.meta.version === 2) {
    if (
      !s.depth ||
      !s.depth.preparations ||
      !Array.isArray(s.depth.actors) ||
      !Array.isArray(s.depth.phaseTrace) ||
      !Array.isArray(s.depth.resolved) ||
      s.depth.actors.some((x) => !Array.isArray(x.memory) || x.memory.length > 6) ||
      s.depth.phaseTrace.length > 5 ||
      s.depth.resolved.length > 20
    )
      return false;
  }
  return true;
}

function rememberActor(s, id, action, delta) {
  const actor = s.depth.actors.find((item) => item.id === id);
  if (!actor) return;
  actor.trust = clamp(actor.trust + delta);
  actor.memory.push({ day: s.day, action, delta });
  actor.memory = actor.memory.slice(-6);
}

export function sonForecast(s) {
  ensureSonState(s);
  const next = CRISIS_CHAINS.find((chain) => !s.depth.chains[chain.id]);
  const active =
    CRISIS_CHAINS.map((chain) => ({ ...chain, state: s.depth.chains[chain.id] }))
      .filter((chain) => chain.state?.stage === "signal")
      .sort((a, b) => b.due - a.due)[0] || next;
  if (!active) return null;
  const prep = s.depth.preparations[active.family] || 0;
  const legal = active.family === "legal" ? s.flags.legalRisk || 0 : 0;
  const chance = clamp(active.risk + sonPhase(s).pressure * 2 + legal * 2 - prep * 7, 8, 92);
  return {
    id: active.id,
    title: active.title,
    family: active.family,
    due: active.due,
    days: Math.max(0, (s.remainingDays ?? 100) - active.due),
    preparation: prep,
    chance,
    band:
      chance >= 70
        ? ["çok yüksek", "very high"]
        : chance >= 50
          ? ["yüksek", "high"]
          : chance >= 30
            ? ["orta", "medium"]
            : ["düşük", "low"],
  };
}

export function sonActionForecast(s, actionId) {
  ensureSonState(s);
  const family = Object.keys(PREP_ACTIONS).find((key) => PREP_ACTIONS[key].has(actionId));
  if (!family) return null;
  const labels = {
    health: ["sağlık", "health"],
    money: ["nakit", "cash"],
    people: ["insanlar", "people"],
    legal: ["hukuk", "legal"],
    legacy: ["miras", "legacy"],
  };
  return {
    family,
    label: labels[family],
    gain: 1,
    tradeoff:
      actionId === "work"
        ? ["enerji ve ilişki baskısı", "energy and relationship pressure"]
        : ["başka bir hazırlık alanından vazgeçersin", "you forgo preparation in another area"],
  };
}

export function availableSonActions(s) {
  ensureSonState(s);
  const phase = sonPhase(s).id;
  const left = s.remainingDays ?? 100;
  const energy = s.resources?.energy ?? 50;
  const money = s.resources?.money ?? 0;
  const soul = sonSoul(s);
  const ids = new Set(["work", "rest", "family", "pay"]);
  const windows = (s.opportunities || []).filter((item) => item.status === "open");
  for (const window of windows) for (const choice of window.choices || []) ids.add(choice);
  if (energy < 35) ids.add("rest");
  if (money < 400) ids.add("work");
  if (phase === "preparation") {
    ids.add("doctor");
    ids.add("hide");
    ids.add("work");
  }
  // Crisis-chain preparation actions (write-will/forgive/confess/donate/
  // report-crime/legacy) are added before the wide "chaos" option block below
  // so the final slice(0, 10) truncation can't silently drop them. They used
  // to be added after quit/party/drink/travel/confront/sex/pray, which by
  // itself already fills the 10-slot cap during fracture/scarcity/collapse -
  // making write-will (the only real prep for the legal crisis chain)
  // effectively never appear on screen during its entire due window.
  if (left <= 40) ids.add("write-will");
  if (left <= 30) ids.add("forgive");
  if (left <= 20) ids.add("confess");
  if (money > 800) ids.add("donate");
  if (soul.crime >= 4 || s.flags.legalRisk >= 6) ids.add("crime");
  if (s.flags.legalRisk >= 8) ids.add("report-crime");
  if (left <= 14) {
    ids.add("legacy");
    ids.add("call-ex");
    ids.add("visit-friend");
  }
  if (["fracture", "scarcity", "collapse"].includes(phase)) {
    ids.add("quit");
    ids.add("party");
    ids.add("drink");
    ids.add("travel");
    ids.add("confront");
    ids.add("sex");
    ids.add("pray");
  }
  if (soul.anger >= 12 || phase === "fracture") ids.add("revenge");
  if (soul.faith >= 8 || phase === "collapse" || phase === "finale") ids.add("pray");
  if (phase === "fracture" && money > 300) ids.add("gamble");
  if (phase === "fracture" && soul.hedonism >= 8) {
    ids.add("drugs");
    ids.add("escort");
  }
  if (left <= 3) {
    return ["family", "pray", "confess", "forgive", "write-will", "legacy"].filter((id) =>
      A100.some((action) => action.id === id),
    );
  }
  const list = [...ids].filter(
    (id) => A100.some((action) => action.id === id) && !SUICIDE.test(id),
  );
  return list.slice(0, 10);
}

function queueCase(s, spec) {
  if (!spec?.id) return;
  if (s.openCases.some((item) => item.id === spec.id && item.status !== "resolved")) return;
  s.openCases.push({
    id: spec.id,
    title: spec.title,
    due: s.day + (spec.delay || 12),
    status: "open",
    kind: spec.kind || "callback",
    payload: spec.payload || {},
  });
}

export function sonActionCost(act) {
  if (!act) return 8;
  if (["rest", "pray", "call-ex", "forgive"].includes(act.id)) return 2;
  if (["doctor", "work", "write-will", "report-crime", "travel"].includes(act.id)) return 4;
  return Math.abs(act.energy || 0) >= 10 || (act.risk || 0) >= 8 ? 4 : 3;
}

export function applySonAction(s, actId) {
  ensureSonState(s);
  if (s.flags.finalReport || (s.remainingDays ?? 1) <= 0) return s;
  if (SUICIDE.test(actId || "")) return s;
  const act = A100.find((a) => a.id === actId);
  if (!act) return s;
  const focusCost = sonActionCost(act);
  if ((s.focusRemaining ?? 8) < focusCost) return s;
  if (act.id === "donate" && s.flags.donateCount >= 3) return s;
  if (act.id === "pray" && usedToday(s, "pray")) return s;
  if (act.id === "gamble" && s.flags.gambleDay === s.day) return s;
  if (act.id === "crime" && s.flags.crimeCount >= 5) return s;

  s.resources.energy = clamp(s.resources.energy + (act.energy || 0));
  s.resources.money += act.money || 0;
  s.resources.hope = clamp(s.resources.hope + (act.hope || 0));
  if (act.family) rel(s, "family", act.family);
  if (act.friend) rel(s, "friend", act.friend);
  if (act.work) rel(s, "work", act.work);
  if (act.partner) rel(s, "partner", act.partner);
  if (act.work) s.goalProgress.work += act.work;
  if (act.family || act.friend || act.partner) s.goalProgress.relationship += 1;
  if (act.money && act.money > 0) s.goalProgress.money += act.money;
  if (act.id === "rest") s.goalProgress.health += 2;
  if (act.risk) s.flags.risk = (s.flags.risk || 0) + act.risk;
  if (act.id === "work") s.flags.workStreak = (s.flags.workStreak || 0) + 1;
  else s.flags.workStreak = 0;
  if ((s.flags.workStreak || 0) >= 4) {
    rel(s, "friend", -4);
    rel(s, "family", -3);
    s.resources.hope = clamp(s.resources.hope - 3);
    s.resources.energy = clamp(s.resources.energy - 4);
  }

  const late = (s.remainingDays ?? 100) <= 10;
  const weight = late && ["pray", "donate", "forgive", "confess"].includes(act.id) ? 1 : 2;
  const soulPatch = act.soul || {};
  const scaled = {};
  for (const [key, value] of Object.entries(soulPatch))
    scaled[key] = value > 0 ? Math.max(1, Math.round(value * (weight / 2))) : value;
  if (Object.keys(scaled).length) setSoul(s, scaled);

  if (act.id === "donate") {
    s.flags.donateCount += 1;
    if (s.flags.donateCount >= 3) setSoul(s, { mercy: 0, selfish: 1 });
  }
  if (act.id === "pray") s.flags.prayCount += 1;
  if (act.id === "gamble") {
    s.flags.gambleDay = s.day;
    const swing = s.day % 3 === 0 ? 420 : -380;
    s.resources.money += swing;
    setSoul(s, { hedonism: 2, fear: swing < 0 ? 2 : 0 });
  }
  if (act.id === "crime") {
    s.flags.crimeCount += 1;
    s.flags.legalRisk = (s.flags.legalRisk || 0) + 4;
    setSoul(s, { crime: 3, harm: 2, courage: 1 });
    if (s.flags.crimeCount === 2)
      queueCase(s, { id: "police-file", title: "İfade çağrısı", delay: 9, kind: "legal" });
  }
  if (act.id === "sex" || act.id === "escort") {
    setSoul(s, {
      hedonism: 3,
      love: act.id === "sex" ? 1 : 0,
      betrayal: act.id === "escort" ? 1 : 0,
    });
    if (act.id === "escort")
      queueCase(s, {
        id: "partner-learns",
        title: "Partner bir şey sezdi",
        delay: 16,
        kind: "affair",
      });
  }
  if (act.id === "revenge") {
    setSoul(s, { anger: 3, harm: 3, courage: 2 });
    queueCase(s, { id: "revenge-back", title: "Karşı hamle", delay: 11, kind: "revenge" });
  }
  if (act.id === "help-stranger" || act.id === "protect")
    setSoul(s, { mercy: 3, courage: 2, legacy: 1 });
  if (act.id === "write-will" || act.id === "legacy") setSoul(s, { legacy: 4, acceptance: 2 });
  if (act.id === "forgive") setSoul(s, { forgiveness: 4, anger: -3, conscience: 2 });
  if (act.id === "confess") setSoul(s, { conscience: 3, repent: 3, courage: 2 });
  if (act.id === "lie" || act.id === "hide") setSoul(s, { betrayal: 1, fear: 2 });
  if (act.id === "quit") {
    rel(s, "work", -8);
    setSoul(s, { courage: 2, selfish: 1 });
  }

  for (const [family, actions] of Object.entries(PREP_ACTIONS)) {
    if (!actions.has(act.id)) continue;
    s.depth.preparations[family] = clamp(s.depth.preparations[family] + 1, 0, 8);
  }
  if (act.family) rememberActor(s, "family", act.id, Math.sign(act.family));
  if (act.friend) rememberActor(s, "friend", act.id, Math.sign(act.friend));
  if (act.work) rememberActor(s, "work", act.id, Math.sign(act.work));
  if (act.partner) rememberActor(s, "partner", act.id, Math.sign(act.partner));

  const hit = (s.opportunities || []).find(
    (o) => o.status === "open" && (o.choices || []).includes(act.id),
  );
  if (hit) {
    hit.status = "done";
    s.resources.hope = clamp(s.resources.hope + 2);
    if (hit.soul) setSoul(s, hit.soul);
    if (hit.callback) queueCase(s, hit.callback);
    const src = SON_EVENTS.find((event) => event.id === (hit.src || hit.id.split("_")[0]));
    if (src) {
      s.flags.sonArcs =
        s.flags.sonArcs && typeof s.flags.sonArcs === "object" ? s.flags.sonArcs : {};
      if (src.exclusive) s.flags.sonArcs[src.exclusive] = src.branch || src.id;
      if (src.setArc) s.flags.sonArcs[src.setArc] = src.branch || src.id;
    }
    pushHist(s, { type: "opportunity", id: hit.id, result: "caught" });
  }
  if (act.id === "pay" || act.id === "min") {
    const ob = s.obligations.find((o) => o.status === "open");
    if (ob) {
      ob.status = act.id === "pay" ? "paid" : "min";
      s.resources.money -= Math.max(0, (ob.cost || 0) - 200);
      if (act.id === "pay") setSoul(s, { conscience: 1, legacy: 1 });
      else setSoul(s, { selfish: 1 });
    }
  }
  s.focusRemaining = Math.max(0, (s.focusRemaining ?? 8) - focusCost);
  s.actionsRemaining = Math.max(0, Math.ceil(s.focusRemaining / 4));
  pushHist(s, { type: "act", id: act.id, day: s.day, focusCost });
  return s;
}

function seedOpportunity(s) {
  s.opportunities = s.opportunities || [];
  const used = new Set(s.opportunities.map((o) => o.src || o.id));
  const phase = sonPhase(s).id;
  const legacyPhase = {
    preparation: "shock",
    fracture: "turn",
    scarcity: "turn",
    collapse: "consequence",
    finale: "reckoning",
  }[phase];
  const recent = new Set(s.depth.eventDirector.recent.slice(-6));
  const pool = SON_EVENTS.filter((event) => {
    if (used.has(event.id)) return false;
    if (recent.has(event.id)) return false;
    if (!sonEventEligibleForPhase(event, phase, s.remainingDays, legacyPhase)) return false;
    if (!sonContentEligible(s, event)) return false;
    return true;
  });
  // Stall prevention may relax the short recent-event window, but it must never
  // bypass phase, chain, preparation or exclusive-branch eligibility.
  const candidates = pool.length
    ? pool
    : SON_EVENTS.filter(
        (event) =>
          !used.has(event.id) &&
          sonEventEligibleForPhase(event, phase, s.remainingDays, legacyPhase) &&
          sonContentEligible(s, event),
      );
  const next = candidates.length
    ? candidates[Math.floor((deterministicRoll(s, phase) / 100) * candidates.length)]
    : null;
  if (!next) return;
  const openCount = s.opportunities.filter((o) => o.status === "open").length;
  if (openCount >= 2) return;
  s.opportunities.push({
    id: next.id + "_" + s.day,
    src: next.id,
    title: next.title,
    text: next.text,
    expiresOn: s.day + (next.window || 3),
    choices: next.choices.slice(),
    domain: next.domain,
    tags: next.tags || [],
    soul: next.soul,
    callback: next.callback,
    status: "open",
  });
  s.depth.eventDirector.recent.push(next.id);
  s.depth.eventDirector.recent = s.depth.eventDirector.recent.slice(-12);
}

export function sonContentEligible(s, event) {
  const arcs = s.flags?.sonArcs || {};
  if (
    event.exclusive &&
    arcs[event.exclusive] &&
    arcs[event.exclusive] !== (event.branch || event.id)
  )
    return false;
  if (event.requireArc) {
    const got = arcs[event.requireArc];
    if (event.requireValue == null) {
      if (!got) return false;
    } else if (got !== event.requireValue) return false;
  }
  if (event.requirePrep) {
    const family = event.requirePrep.family || event.requirePrep;
    const min = Number(event.requirePrep.min || event.requirePrepMin || 1);
    if ((s.depth?.preparations?.[family] || 0) < min) return false;
  }
  if (event.requireMemory) {
    const actor = (s.depth?.actors || []).find((item) => item.id === event.requireMemory);
    if (!actor?.memory?.length) return false;
    if (event.requireTrust && actor.trust < event.requireTrust) return false;
  }
  return true;
}

export function sonEventEligibleForPhase(event, phaseId, remainingDays, mappedPhase) {
  const legacyPhase =
    mappedPhase ||
    {
      preparation: "shock",
      fracture: "turn",
      scarcity: "turn",
      collapse: "consequence",
      finale: "reckoning",
    }[phaseId];
  if (
    event.phase &&
    event.phase !== phaseId &&
    event.phase !== legacyPhase &&
    event.phase !== "any"
  )
    return false;
  if (remainingDays > 14 && event.final) return false;
  if (remainingDays <= 14 && event.final === false) return false;
  return true;
}

function resolveCases(s) {
  for (const item of s.openCases) {
    if (item.status !== "open" || item.due > s.day) continue;
    item.status = "resolved";
    const spec = SON_CALLBACKS.find((row) => row.id === item.id) || item;
    if (spec.hope) s.resources.hope = clamp(s.resources.hope + spec.hope);
    if (spec.money) s.resources.money += spec.money;
    if (spec.energy) s.resources.energy = clamp(s.resources.energy + spec.energy);
    if (spec.rel) for (const [key, value] of Object.entries(spec.rel)) rel(s, key, value);
    if (spec.soul) setSoul(s, spec.soul);
    if (spec.legal) s.flags.legalRisk = (s.flags.legalRisk || 0) + spec.legal;
    pushHist(s, { type: "callback", id: item.id, title: spec.title || item.title });
  }
}

function updateCrisisChains(s) {
  const phase = sonPhase(s).id;
  for (const chain of CRISIS_CHAINS) {
    let state = s.depth.chains[chain.id];
    if (!state && chain.phase === phase) {
      state = s.depth.chains[chain.id] = {
        stage: "signal",
        signalled: s.day,
        due: chain.due,
        family: chain.family,
      };
      pushHist(s, { type: "signal", id: chain.id, title: chain.title, due: chain.due });
    }
    if (!state || state.stage !== "signal" || s.remainingDays > state.due) continue;
    const prep = s.depth.preparations[chain.family] || 0;
    const legal = chain.family === "legal" ? s.flags.legalRisk || 0 : 0;
    const risk = clamp(chain.risk + sonPhase(s).pressure * 2 + legal * 2 - prep * 7, 8, 92);
    const hit = deterministicRoll(s, chain.id) < risk;
    state.stage = "resolved";
    state.resolvedDay = s.day;
    state.risk = risk;
    state.outcome = hit ? "crisis" : "prepared";
    if (hit) {
      const effects = {
        health: { energy: -14, hope: -5, money: -180 },
        money: { energy: -5, hope: -7, money: -520 },
        people: { energy: -6, hope: -9, money: -120 },
        legal: { energy: -7, hope: -8, money: -360 },
        legacy: { energy: -4, hope: -10, money: 0 },
      }[chain.family];
      s.resources.energy = clamp(s.resources.energy + effects.energy);
      s.resources.hope = clamp(s.resources.hope + effects.hope);
      s.resources.money += effects.money;
      if (chain.family === "people") rel(s, "family", -9);
      if (chain.family === "legal") s.flags.legalRisk = Math.max(0, s.flags.legalRisk - 2);
    } else {
      s.resources.hope = clamp(s.resources.hope + 4);
      setSoul(s, { acceptance: 2, courage: 1 });
    }
    s.depth.resolved.push({
      id: chain.id,
      title: chain.title,
      day: s.day,
      family: chain.family,
      risk,
      outcome: state.outcome,
      preparation: prep,
    });
    s.depth.resolved = s.depth.resolved.slice(-20);
    pushHist(s, { type: "crisis", id: chain.id, title: chain.title, result: state.outcome, risk });
  }
}

export function sonAdvanceDay(s) {
  ensureSonState(s);
  if (s.flags.finalReport) return s;
  s.day += 1;
  s.remainingDays = Math.max(0, s.remainingDays - 1);
  s.actionsRemaining = s.remainingDays === 0 ? 0 : 2;
  s.focusRemaining = s.remainingDays === 0 ? 0 : (s.focusMax || 8);
  s.resources.energy = clamp(s.resources.energy - sonPhase(s).pressure);
  if (s.remainingDays <= 14) setSoul(s, { fear: 1, acceptance: s.flags.soul.faith >= 12 ? 1 : 0 });
  for (const o of s.obligations) {
    if (o.status === "open") {
      o.due -= 1;
      if (o.due <= 0) {
        o.status = "missed";
        s.missed.push(o.id);
        s.resources.hope = clamp(s.resources.hope - 8);
        s.resources.money -= Math.round((o.cost || 0) * 0.15);
        rel(s, "family", o.domain === "family" || o.domain === "home" ? -6 : -1);
        setSoul(s, { selfish: 1, conscience: -1 });
      }
    }
  }
  for (const op of s.opportunities || []) {
    if (op.status === "open" && op.expiresOn <= s.day) {
      op.status = "expired";
      s.missed.push(op.id);
      s.resources.hope = clamp(s.resources.hope - 3);
      if (op.domain === "friend") rel(s, "friend", -5);
      if (op.domain === "family") rel(s, "family", -4);
      if (op.domain === "work") rel(s, "work", -3);
      pushHist(s, { type: "opportunity", id: op.id, result: "expired" });
    }
  }
  resolveCases(s);
  updateCrisisChains(s);
  if (s.obligations.filter((o) => o.status === "open").length < 2 && s.remainingDays > 8) {
    s.obligations.push({
      id: "wave_" + s.day,
      title: s.day % 3 === 0 ? "Fatura" : "Randevu",
      due: 6 + (s.day % 5),
      cost: 120 + (s.day % 7) * 20,
      domain: s.day % 2 ? "money" : "bureaucracy",
      status: "open",
    });
  }
  const cadence = s.remainingDays <= 14 ? 2 : 4;
  if (s.day % cadence === 0) seedOpportunity(s);
  for (const m of MILESTONES) {
    if (s.remainingDays === m && !(s.flags.milestones || []).includes(m)) {
      s.flags.milestones = (s.flags.milestones || []).concat(m);
      pushHist(s, { type: "milestone", left: m });
    }
  }
  if (s.remainingDays === 0) finalizeSon(s);
  s.opportunities = s.opportunities
    .filter((item) => item.status === "open" || item.expiresOn >= s.day - 24)
    .slice(-40);
  s.missed = s.missed.slice(-40);
  s.openCases = s.openCases
    .filter((item) => item.status === "open" || item.due >= s.day - 20)
    .slice(-40);
  pushHist(s, { type: "day", day: s.day });
  return s;
}

export function sonDeathScene(s) {
  const family = s.relationships?.find((item) => item.id === "family")?.value ?? 50;
  const partner = s.relationships?.find((item) => item.id === "partner")?.value ?? 40;
  const energy = s.resources?.energy ?? 50;
  if (energy < 25)
    return "Hastane odası. Monitör düz çizgiye yaklaşırken koridor hâlâ ayakkabı sesi.";
  if (family >= 62 && partner >= 55)
    return "Ev. Aile ve partner aynı odada. Kimse film müziği açmıyor; ellerin duruyor.";
  if (family >= 58) return "Ev. Annan ya da evladın kapı eşiğinde. Cümle yok, nefes var.";
  if (partner >= 58)
    return "Evin odası. Partnerin omzuna ağırlık veriyorsun. Dışarıda normal bir akşam.";
  if (energy < 40) return "Hospice koridoru. Çay soğumuş. Ölüm resmi bir form kadar sakin.";
  return "Yalnız oda. Telefon masada. Kimse aramadı, sen de kimseyi aramadın.";
}

function scoreOf(s) {
  const soul = sonSoul(s);
  const family = s.relationships?.find((item) => item.id === "family")?.value ?? 50;
  const partner = s.relationships?.find((item) => item.id === "partner")?.value ?? 40;
  const money = s.resources?.money ?? 0;
  const missed = (s.missed || []).length;
  return {
    mercy: soul.mercy,
    harm: soul.harm,
    betrayal: soul.betrayal,
    violence: soul.violence,
    crime: soul.crime,
    family: family,
    love: soul.love + Math.round(partner / 10),
    selfish: soul.selfish,
    faith: soul.faith,
    repent: soul.repent,
    debt: money < 0 ? 1 : 0,
    courage: soul.courage,
    forgiveness: soul.forgiveness,
    hedonism: soul.hedonism,
    legacy: soul.legacy,
    unresolved: (s.openCases || []).filter((item) => item.status === "open").length + missed,
    acceptance: soul.acceptance,
    fear: soul.fear,
    conscience: soul.conscience,
    anger: soul.anger,
    money,
  };
}

export function sonVerdict(s) {
  const sc = scoreOf(s);
  const heaven =
    sc.mercy >= 16 &&
    sc.harm <= 8 &&
    sc.betrayal <= 4 &&
    sc.crime <= 4 &&
    (sc.faith >= 14 || sc.legacy >= 12) &&
    sc.family >= 52 &&
    sc.repent + sc.forgiveness >= 8;
  const hell =
    sc.harm >= 18 &&
    sc.betrayal >= 8 &&
    sc.crime + sc.violence >= 10 &&
    sc.mercy <= 6 &&
    sc.repent <= 4 &&
    sc.family < 48;
  if (heaven) return SON_ENDINGS.find((item) => item.id === "heaven");
  if (hell) return SON_ENDINGS.find((item) => item.id === "hell");
  const specific =
    (sc.legacy >= 14 && sc.family >= 58 && "child-future") ||
    (sc.faith >= 16 && sc.repent >= 8 && "found-faith") ||
    (countActs(s, "forgive") >= 3 && sc.forgiveness >= 10 && "forgave-self") ||
    (countActs(s, "confess") >= 3 && sc.conscience >= 45 && "stopped-lying") ||
    (sc.harm >= 12 && sc.anger >= 16 && "eaten-revenge") ||
    (sc.family >= 62 && sc.love >= 10 && "loved-room") ||
    (sc.family >= 60 && sc.legacy >= 8 && "left-family") ||
    (sc.money < 0 && (s.missed || []).length >= 2 && "left-debt") ||
    (sc.family < 40 && "no-one-called") ||
    (sc.acceptance >= 22 && sc.family >= 55 && "peace") ||
    (sc.hedonism >= 28 && "burned-out") ||
    (sc.unresolved >= 6 && "unfinished");
  if (specific) return SON_ENDINGS.find((item) => item.id === specific);
  const ranked = SON_ENDINGS.filter((item) => item.id !== "heaven" && item.id !== "hell").map(
    (item) => {
      let score = 0;
      for (const [key, need] of Object.entries(item.need || {})) {
        const value = sc[key] ?? 0;
        score += need >= 0 ? (value >= need ? 3 : value - need) : value <= Math.abs(need) ? 3 : -2;
      }
      return { item, score };
    },
  );
  ranked.sort((a, b) => b.score - a.score);
  return ranked[0]?.item || SON_ENDINGS.find((item) => item.id === "unfinished");
}

export function sonDossierTraces(s) {
  const arcs = s.flags?.sonArcs || {};
  const prep = s.depth?.preparations || {};
  const actors = s.depth?.actors || [];
  const traces = [];
  const stayed = actors.filter((a) => a.trust >= 55).map((a) => a.id);
  const left = actors.filter((a) => a.trust < 35).map((a) => a.id);
  if (stayed.length)
    traces.push([stayed.join(", ") + " yanında durdu.", stayed.join(", ") + " stayed by your side."]);
  if (left.length)
    traces.push([left.join(", ") + " uzaklaştı.", left.join(", ") + " drifted away."]);
  const useful = Object.entries(prep)
    .filter(([, v]) => v >= 3)
    .map(([k]) => k);
  if (useful.length)
    traces.push([
      "Hazırlık tutan alanlar: " + useful.join(", ") + ".",
      "Preparations that held: " + useful.join(", ") + ".",
    ]);
  const missed = (s.depth?.resolved || []).filter((row) => row.outcome === "crisis");
  if (missed.length) {
    const ids = missed.map((row) => row.id).join(", ");
    traces.push(["Kaçırılan kriz: " + ids + ".", "Crisis missed: " + ids + "."]);
  }
  if (arcs["partner-door"] === "stay") traces.push(["Partner kapıda kaldı.", "Your partner stayed at the door."]);
  if (arcs["partner-door"] === "leave") traces.push(["Partner bavulu aldı.", "Your partner took the suitcase."]);
  if (arcs["sister-key"] === "keep") traces.push(["Kız kardeşin anahtarı sende kaldı.", "You kept your sister's key."]);
  if (arcs["sister-key"] === "give") traces.push(["Kız kardeşe anahtarı verdin.", "You gave your sister the key."]);
  if (arcs["boss-file"] === "speak") traces.push(["İş dosyasını açtın.", "You opened the workplace file."]);
  if (arcs["boss-file"] === "silence") traces.push(["İş dosyasını kapalı tuttun.", "You kept the workplace file closed."]);
  if (arcs["will-draft"])
    traces.push(["Vasiyet taslağı dosyada duruyor.", "The draft of your will remains in the file."]);
  if ((s.flags.donateCount || 0) >= 2) traces.push(["Sadaka izi rapora işlendi.", "Your donations entered the record."]);
  return traces.slice(0, 10);
}

export function finalizeSon(s) {
  ensureSonState(s);
  const verdict = sonVerdict(s);
  const sc = scoreOf(s);
  s.flags.finalReport = true;
  s.actionsRemaining = 0;
  s.flags.report = {
    money: s.resources.money,
    energy: s.resources.energy,
    hope: s.resources.hope,
    missed: s.missed.slice(),
    goals: { ...s.goalProgress },
    workStreakMax: s.flags.workStreak || 0,
    caught: (s.opportunities || []).filter((o) => o.status === "done").length,
    expired: (s.opportunities || []).filter((o) => o.status === "expired").length,
    mercy: sc.mercy,
    harm: sc.harm,
    faith: sc.faith,
    endingId: verdict.id,
    verdictTitle: verdict.title,
    verdictKicker: verdict.kicker,
    verdictLine: verdict.line,
    verdictText: verdict.text,
    helped: sc.mercy >= 6 ? ["Birine gerçekten yardım ettin."] : [],
    harmed: sc.harm >= 8 ? ["Birine bilinçli zarar verdin."] : [],
    unresolved: (s.openCases || [])
      .filter((item) => item.status === "open")
      .map((item) => item.title),
    scene: sonDeathScene(s),
    phases: s.depth.phaseTrace.map((row) => ({ ...row })),
    preparations: { ...s.depth.preparations },
    crises: s.depth.resolved.map((row) => ({ ...row })),
    actors: s.depth.actors.map((actor) => ({
      id: actor.id,
      trust: actor.trust,
      memories: actor.memory.slice(-3),
    })),
    turningPoints: s.history
      .filter((row) => ["crisis", "callback", "opportunity"].includes(row.type))
      .slice(-8),
    traces: sonDossierTraces(s),
  };
  return s;
}

export function applySonScenario(s, scenarioId) {
  const sc = SCENARIOS.find((item) => item.id === scenarioId) || SCENARIOS[0];
  ensureSonState(s);
  s.scenarioId = sc.id;
  s.resources = { ...sc.resources };
  s.relationships = Object.entries(sc.relations || {}).map(([id, value]) => ({ id, value }));
  if (!s.relationships.some((item) => item.id === "partner"))
    s.relationships.push({ id: "partner", value: sc.partner || 40 });
  s.obligations = (sc.obligations || []).map((o) => ({ ...o, status: "open" }));
  s.missed = [];
  s.openCases = [];
  s.flags = {
    milestones: [],
    finalReport: false,
    workStreak: 0,
    soul: { ...emptySoul(), ...(sc.soul || {}) },
    donateCount: 0,
    prayCount: 0,
    crimeCount: 0,
    legalRisk: sc.legalRisk || 0,
    gambleDay: 0,
    hook: sc.hook || sc.goal,
    burden: sc.burden || sc.obligations?.[0]?.title,
  };
  s.meta = {
    ...(s.meta || {}),
    id: "son-100-gun",
    version: 2,
    seed: 73129 + SCENARIOS.indexOf(sc) * 977,
  };
  s.depth = null;
  ensureSonState(s);
  const opener =
    SON_EVENTS.find((event) => event.scenario === sc.id) || SON_EVENTS[1] || SON_EVENTS[0];
  s.opportunities = opener
    ? [
        {
          id: opener.id,
          src: opener.id,
          title: opener.title,
          text: opener.text,
          expiresOn: 1 + (opener.window || 3),
          choices: opener.choices,
          domain: opener.domain,
          status: "open",
        },
      ]
    : [];
  updateCrisisChains(s);
  return s;
}
