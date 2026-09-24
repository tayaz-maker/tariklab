// Karar ağı: haftalık seçimleri zaman, para, ilişki, enerji ve uzun vadeli
// hedef tek bir ağda birbirine bağlar. Taahhüt ve ihmal sonraki haftalara taşınır.
// Saf fonksiyonlar; DOM yok. Durum `state.decisionNetwork` altında tutulur ve
// eski kayıtlarda boş başlar.
import { adjustHealth, updateRelationship } from "./state.js?v=10";
import { applyRelationshipDelta } from "./social.js?v=10";
import { economyCausality, refreshLifeArcs } from "./life-depth.js?v=10";

export const DOMAINS = ["zaman", "para", "iliski", "enerji", "hedef"];
export const DOMAIN_LABEL = {
  zaman: "Zaman",
  para: "Para",
  iliski: "İlişki",
  enerji: "Enerji",
  hedef: "Hedef",
};

/** Hangi karar hangi alana dokunur; hedef ise hangi yaşam arkını besler. */
export const DECISION_LINKS = {
  overtime: { para: 1, enerji: -1, iliski: -1, arcs: ["career", "finance"] },
  family: { iliski: 1, enerji: -1, arcs: ["family"] },
  friend: { iliski: 1, para: -1, enerji: -1, arcs: ["social"] },
  rest: { enerji: 1, arcs: ["health"] },
  "body-care": { enerji: 1, para: -1, arcs: ["health"] },
  exercise: { enerji: 1, para: -1, arcs: ["health"] },
  "help-friend": { iliski: 1, arcs: ["social", "career"] },
  "lend-friend": { iliski: 1, para: -1, arcs: ["social"] },
  "quiet-evening": { enerji: 1, arcs: ["health"] },
  "reset-routine": { enerji: 1, arcs: ["health"] },
  "budget-check": { para: 1, arcs: ["finance", "housing"] },
  "job-search": { para: 1, arcs: ["career"] },
  "call-anne": { iliski: 1, arcs: ["family"] },
  "reconnect-mehmet": { iliski: 1, enerji: -1, arcs: ["social"] },
  "parent-plan": { iliski: 1, arcs: ["family"] },
  "parent-budget": { para: 1, iliski: 1, arcs: ["family", "finance"] },
  "parent-care": { iliski: 1, enerji: -1, arcs: ["family"] },
};

// Taahhüt: aynı hedefe art arda üç hafta zaman ayırmak bir kez karşılık verir.
export const STREAK_PAYOFF = 3;
// Karşılık en fazla çeyrekte bir gelir; aksi halde aynı rota her üç haftada bir
// kalıcı bonus toplar ve tek bir en iyi yol doğar.
export const PAYOFF_COOLDOWN = 12;
// İhmal: bu kadar hafta dokunulmayan alan kendi bedelini yazmaya başlar.
export const NEGLECT = { iliski: 4, enerji: 3 };

const PAYOFF = {
  career: {
    // Taahhüt performansı doğrudan yükseltmez: kalıcı performans birikimi terfi
    // eşiklerini zorlar ve tek bir rotayı baskın yapar. Karşılığı iş yükünün
    // hafiflemesidir.
    text: "Üç haftalık iş odağı iş yükünü hafifletti.",
    apply: (s) => adjustHealth(s, { stress: -3 }),
  },
  finance: {
    text: "Üç haftalık para düzeni stresi azalttı.",
    apply: (s) => adjustHealth(s, { stress: -4 }),
  },
  housing: {
    text: "Üç haftalık para düzeni konut adımını yakınlaştırdı.",
    apply: (s) => adjustHealth(s, { stress: -3 }),
  },
  family: {
    text: "Üç hafta aileye ayrılan zaman güven bıraktı.",
    apply: (s) => applyRelationshipDelta(s, "anne", { trust: 3, tension: -2 }),
  },
  social: {
    text: "Üç hafta süren ilgi dostlukta güven bıraktı.",
    apply: (s) => applyRelationshipDelta(s, "mehmet", { trust: 3, tension: -2 }),
  },
  health: {
    text: "Üç haftalık bakım düzeni bedende karşılık buldu.",
    apply: (s) => adjustHealth(s, { health: 2, stress: -3 }),
  },
  education: {
    text: "Üç haftalık odak eğitimi hızlandırdı.",
    apply: (s) => {
      if (s.education?.active)
        s.education.active.progress = Math.min(100, (s.education.active.progress || 0) + 4);
    },
  },
  relationship: {
    text: "Üç hafta süren ilgi ilişkideki gerilimi azalttı.",
    apply: (s) => {
      if (s.social?.currentPartnerNpcId)
        applyRelationshipDelta(s, s.social.currentPartnerNpcId, { tension: -4 });
    },
  },
};

const int = (v, d) => (Number.isInteger(v) ? v : d);

export function ensureDecisionNetwork(state) {
  // Normalised in place so every caller holds the same object.
  if (
    !state.decisionNetwork ||
    typeof state.decisionNetwork !== "object" ||
    Array.isArray(state.decisionNetwork)
  )
    state.decisionNetwork = {};
  const net = state.decisionNetwork;
  const week = int(state.time?.absoluteWeek, 0);
  const tended = net.tended && typeof net.tended === "object" ? net.tended : {};
  net.goalId = typeof net.goalId === "string" ? net.goalId : null;
  net.streak = Math.max(0, Math.min(STREAK_PAYOFF, int(net.streak, 0)));
  net.nextPayoff = Math.max(0, Math.min(week + PAYOFF_COOLDOWN, int(net.nextPayoff, 0)));
  net.tended = Object.fromEntries(DOMAINS.map((d) => [d, Math.min(week, int(tended[d], week))]));
  net.chain = Array.isArray(net.chain)
    ? net.chain.filter((x) => x && typeof x.text === "string" && Number.isInteger(x.week)).slice(-8)
    : [];
  for (const key of Object.keys(net))
    if (!["goalId", "streak", "nextPayoff", "tended", "chain"].includes(key)) delete net[key];
  return net;
}

/** The goal the week plan leans on: the life-depth goal with the lowest progress. */
export function currentGoal(state) {
  const depth = refreshLifeArcs(state);
  const goals = [...(depth.goals || [])].sort((a, b) => a.progress - b.progress);
  return goals[0] || null;
}

export function feedsGoal(decisionId, goal) {
  return Boolean(goal && DECISION_LINKS[decisionId]?.arcs.includes(goal.arc));
}

/** Weeks until commitment can pay again (0 = ready). */
export function payoffWait(state) {
  const net = ensureDecisionNetwork(state);
  return Math.max(0, net.nextPayoff - int(state.time?.absoluteWeek, 0));
}

/** Chips shown on a decision button. */
export function decisionTags(state, decisionId) {
  const link = DECISION_LINKS[decisionId] || {};
  const goal = currentGoal(state);
  const tags = [{ domain: "zaman", sign: -1 }];
  for (const d of ["para", "iliski", "enerji"])
    if (link[d]) tags.push({ domain: d, sign: link[d] });
  const net = ensureDecisionNetwork(state);
  if (feedsGoal(decisionId, goal)) {
    const next = net.goalId === goal.id ? net.streak + 1 : 1;
    const wait = payoffWait(state);
    tags.push({
      domain: "hedef",
      sign: 1,
      carry: wait ? `${wait} hf` : `${Math.min(next, STREAK_PAYOFF)}/${STREAK_PAYOFF}`,
    });
  }
  return tags;
}

function neglectWeeks(state, domain) {
  const net = ensureDecisionNetwork(state);
  return Math.max(0, int(state.time?.absoluteWeek, 0) - net.tended[domain]);
}

function push(state, text) {
  // A repeating effect keeps one line with its latest week, so the chain
  // stays a list of distinct consequences instead of the same note twice.
  const net = ensureDecisionNetwork(state);
  net.chain = net.chain
    .filter((x) => x.text !== text)
    .concat({ week: state.time.absoluteWeek, text })
    .slice(-8);
}

/**
 * Week close. Runs before the weekly selection is cleared: records which areas
 * were tended, advances or breaks the goal commitment, and writes neglect costs.
 */
export function processDecisionNetworkWeek(state, selectedIds = []) {
  const net = ensureDecisionNetwork(state);
  const week = state.time.absoluteWeek;
  for (const id of selectedIds) {
    const link = DECISION_LINKS[id];
    if (!link) continue;
    for (const d of ["para", "iliski", "enerji"]) if (link[d] > 0) net.tended[d] = week;
  }
  if (selectedIds.length) net.tended.zaman = week;
  const goal = currentGoal(state);
  const fed = goal && selectedIds.some((id) => feedsGoal(id, goal));
  if (fed) {
    net.tended.hedef = week;
    net.streak = Math.min(STREAK_PAYOFF, net.goalId === goal.id ? net.streak + 1 : 1);
    net.goalId = goal.id;
    if (net.streak >= STREAK_PAYOFF && week >= net.nextPayoff) {
      const payoff = PAYOFF[goal.arc];
      if (payoff) {
        payoff.apply(state);
        push(state, payoff.text);
      }
      net.streak = 0;
      net.nextPayoff = week + PAYOFF_COOLDOWN;
    }
  } else if (net.streak) {
    push(state, "Hedefe ayrılan seri bu hafta kesildi.");
    net.streak = 0;
  }
  const effects = [];
  if (neglectWeeks(state, "iliski") >= NEGLECT.iliski) {
    const who =
      (state.relationships?.anne ?? 50) <= (state.relationships?.mehmet ?? 50) ? "anne" : "mehmet";
    updateRelationship(state, who, -1);
    applyRelationshipDelta(state, who, { tension: 1 });
    effects.push("İlgisiz geçen haftalar bir yakınla mesafeyi büyüttü.");
  }
  if (neglectWeeks(state, "enerji") >= NEGLECT.enerji && (state.health?.stress ?? 0) >= 60) {
    adjustHealth(state, { stress: 2 });
    effects.push("Bakımsız geçen haftalar stresi artırdı.");
  }
  for (const text of effects) push(state, text);
  return { fed: Boolean(fed), streak: net.streak, effects };
}

/** The four-part week plan: goal, urgent pressure, opportunity, consequence chain. */
export function weekPlan(state, context = {}) {
  const net = ensureDecisionNetwork(state);
  const goal = currentGoal(state);
  const depth = refreshLifeArcs(state);
  const eco = economyCausality(state);
  const week = state.time.absoluteWeek;
  const pressures = [];
  const due = (context.openCases || [])
    .filter((c) => c.status !== "resolved" && Number.isInteger(c.dueWeek) && c.dueWeek - week <= 2)
    .sort((a, b) => a.dueWeek - b.dueWeek)[0];
  if (due)
    pressures.push({
      score: 90 - (due.dueWeek - week) * 10,
      text: `${context.caseLabel ? context.caseLabel(due) : "Açık mesele"} · ${Math.max(0, due.dueWeek - week)} hafta`,
    });
  if ((state.health?.stress ?? 0) >= 70)
    pressures.push({
      score: state.health.stress,
      text: `Stres ${state.health.stress}: bakım seçmezsen artmaya devam eder`,
    });
  if ((state.health?.energy ?? 100) <= 30)
    pressures.push({
      score: 100 - state.health.energy,
      text: `Enerji ${state.health.energy}: yoğun seçimler zorlanır`,
    });
  if (Number.isFinite(context.projected) && context.projected < 0)
    pressures.push({ score: 85, text: "Ay sonu eksiye düşüyor" });
  const relNeglect = neglectWeeks(state, "iliski");
  if (relNeglect >= NEGLECT.iliski - 1)
    pressures.push({
      score: 50 + relNeglect * 5,
      text:
        relNeglect >= NEGLECT.iliski
          ? `${relNeglect} haftadır yakınlara zaman yok: mesafe büyüyor`
          : "Yakınlara zaman ayırmazsan gelecek hafta mesafe başlar",
    });
  pressures.sort((a, b) => b.score - a.score);
  const arcOpp = Object.values(depth.arcs || {}).find(
    (a) => ["development", "turning"].includes(a.stage) && a.opportunities?.length,
  );
  const opportunity =
    goal && net.goalId === goal.id && net.streak >= STREAK_PAYOFF - 1 && !payoffWait(state)
      ? `Bu hafta "${goal.label}" için bir adım daha: taahhüt karşılık verir`
      : arcOpp
        ? arcOpp.opportunities[0]
        : null;
  const chain = [
    ...(depth.pendingEffects || [])
      .filter((x) => x.status === "pending")
      .map((x) => ({
        week: x.dueWeek,
        text: context.effectLabel ? context.effectLabel(x) : "Geçmiş bir karar geri dönecek",
        future: true,
      })),
    ...net.chain
      .slice(-3)
      .reverse()
      .map((x) => ({ week: x.week, text: x.text, future: false })),
  ].slice(0, 4);
  return {
    goal: goal
      ? {
          id: goal.id,
          label: goal.label,
          progress: Math.round(goal.progress),
          streak: net.goalId === goal.id ? net.streak : 0,
          wait: payoffWait(state),
        }
      : null,
    pressure: pressures[0] || null,
    pressures: pressures.slice(0, 3),
    opportunity,
    chain,
    safety: Math.round(eco.safety),
  };
}
