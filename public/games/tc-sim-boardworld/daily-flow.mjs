import { HOMES, JOBS } from "./content.mjs";

const DAY = 1440;
const day = (s) => Math.floor(s.time / DAY) + 1;
const by = (xs, id) => xs.find((x) => x.id === id);
const sum = (s) => s.cash + s.bank;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export function initFlow(s) {
  s.flow = {
    version: 1,
    initializedAt: s.time,
    settlements: "review",
    consent: null,
    stop: null,
  };
}

// Revision and journals are deliberately absent: recording a failed attempt
// cannot make that identical attempt legal again.
export function routineFingerprint(s) {
  const text = JSON.stringify([
    s.time,
    s.location,
    s.city.venue,
    s.cash,
    s.bank,
    s.debt,
    s.player.health,
    s.player.energy,
    s.player.hunger,
    s.player.stress,
    s.inventory.groceries || 0,
    s.job,
    s.course,
    s.housing,
    s.deep.routine.settings,
    s.deep.routine.budgetFloor,
    s.deep.finance.autoPay,
    s.deep.finance.debtPlan,
    s.emergent.policy,
    s.flow?.settlements,
    s.flow?.consent,
    s.pendingEvents,
    Object.entries(s.stories).map(([id, e]) => [id, e.status, e.stage]),
    s.emergent.events.map((e) => [e.id, e.status, e.stage, e.choice]),
    s.calendar.entries.map((e) => [e.id, e.status, e.start, e.end]),
    s.deep.finance.bills.map((b) => [b.id, b.status]),
    s.deep.promises.map((p) => [p.id, p.status, p.dueDay]),
    s.life.household?.status,
    s.life.household?.playerDue,
    s.life.lease.stage,
    s.life.lease.homeKey,
    s.life.jobKey,
    s.life.businessKey,
    s.flags.partner || "",
    s.deep.business,
    s.living.enterprise,
    s.player.skills,
    s.life.districts,
    s.society?.districts,
  ]);
  let a = 2166136261,
    b = 3339675911;
  for (let i = 0; i < text.length; i++) {
    a = Math.imul(a ^ text.charCodeAt(i), 16777619) >>> 0;
    b = Math.imul(b ^ text.charCodeAt(i), 2246822519) >>> 0;
  }
  return text.length + ":" + a.toString(16) + ":" + b.toString(16);
}

const TARGETS = {
  event: "stories",
  story: "stories",
  bill: "wallet",
  promise: "people",
  lease: "life",
  health: "life",
  meal: "life",
  work: "work",
  duty: "life",
  appointment: "plan",
  budget: "wallet",
  payment: "wallet",
  weekday: "plan",
  unavailable: "plan",
  boundary: "plan",
  contract: "plan",
};
const diagnostic = (code, reason) => ({ code, reason, target: { tab: TARGETS[code] || "plan" } });

export function routineBlocker(s, { care = false, useRecorded = true } = {}) {
  if (!s.flow) return null;
  if (s.pendingEvents.length || s.emergent.events.some((e) => e.status === "active"))
    return diagnostic("event", "Yeni olay kartı kararını bekliyor; önce seçimini yap.");
  if (Object.values(s.stories).some((x) => x.status === "active"))
    return diagnostic("story", "Bir yaşam hikâyesi önemli kararını bekliyor.");
  if (!care && !s.emergent.policy.days[(day(s) - 1) % 7])
    return diagnostic(
      "weekday",
      "Bugün planın kapalı. Gün tercihini değiştir veya yalnız ihtiyaçlarını toparla.",
    );
  if (s.deep.finance.bills.some((b) => b.status === "due"))
    return diagnostic("bill", "Manuel ödeme bekleyen fatura var; ödeme kararını kendin ver.");
  if (
    s.deep.promises.some(
      (p) => p.direction === "player" && p.status === "pending" && p.dueDay <= day(s),
    )
  )
    return diagnostic("promise", "Bugün verdiğin bir yardım sözünün son günü.");
  if (
    s.life.household?.status === "notice" ||
    ["warning", "negotiation", "notice"].includes(s.life.lease.stage)
  )
    return diagnostic("lease", "Ev sözleşmesindeki bildirim bir karar gerektiriyor.");
  if (s.player.health < 30)
    return diagnostic("health", "Sağlık 30’un altında; önce bakım kararını ver.");
  if (
    useRecorded &&
    s.flow.stop?.scope === (care ? "care" : "routine") &&
    s.flow.stop.blocked &&
    s.flow.stop.fingerprint === routineFingerprint(s)
  )
    return diagnostic(s.flow.stop.code, s.flow.stop.reason);
  return null;
}

export function recordedStop(s, scope) {
  const stop = s.flow?.stop;
  return stop?.blocked && stop.scope === scope && stop.fingerprint === routineFingerprint(s)
    ? diagnostic(stop.code, stop.reason)
    : null;
}

export function rememberRoutineStop(
  s,
  code,
  reason,
  performedCount,
  blocked = true,
  scope = "routine",
) {
  s.flow.stop = {
    code,
    reason,
    at: s.time,
    performedCount,
    blocked,
    scope,
    fingerprint: blocked ? routineFingerprint(s) : "",
  };
}

export function flowActions(s) {
  if (!s.flow) return [];
  const current = s.flow.settlements;
  return ["review", "authorized"]
    .map((mode) => ({
      id: "flow:payments:" + mode,
      label:
        mode === "authorized"
          ? "Var olan sözleşme ödemelerine rutin izni ver"
          : "Sözleşme ödemelerinden önce rutini durdur",
      description:
        mode === "authorized"
          ? "Yalnız mevcut kira ve faturalar, kurulmuş borç ve kira taksitleri, mevcut borcun bilinen faizi ve açık işletmenin sabit giderleri. Yeni borç, kira değişikliği ve yetersiz bütçede yine durur. Borcun tamamını kendiliğinden ödemez."
          : "Yaklaşan ödeme sınırını kendin incele. Bu tercih zaman veya para harcamaz.",
      category: "policy",
      minutes: 0,
      cost: 0,
      disabled: current === mode && (mode === "review" || validConsent(s)),
      reason:
        current === mode && (mode === "review" || validConsent(s)) ? "Bu tercih zaten seçili." : "",
      run(n) {
        n.flow.settlements = mode;
        n.flow.consent =
          mode === "authorized"
            ? {
                homeKey: n.life.lease.homeKey,
                rent: n.housing.rent,
                debtPresent: n.debt > 0,
                at: n.time,
              }
            : null;
        n.flow.stop = null;
        return mode === "authorized"
          ? "Var olan sözleşme ödemeleri için açık rutin izni kaydedildi."
          : "Ödemelerden önce inceleme tercihi kaydedildi.";
      },
    }))
    .concat({
      id: "flow:care",
      label: "İhtiyaçlarımı şimdi toparla",
      description:
        "Seçili öğün ve nakit tercihinle yemek, erzak ve dinlenme; en fazla 8 gerçek eylem ve 8 saat. Olay, randevu, ödeme ve bütçe sınırlarında durur. İş, yatırım veya ilişki kararı vermez.",
      category: "life",
      minutes: 0,
      cost: 0,
      variableCost: true,
      disabled:
        Boolean(routineBlocker(s, { care: true })) ||
        (s.player.hunger > 65 && s.player.energy > 60),
      reason:
        routineBlocker(s, { care: true })?.reason ||
        (s.player.hunger > 65 && s.player.energy > 60 ? "İhtiyaçların şu anda yeterli." : ""),
      run: () => "",
    });
}

function validConsent(s) {
  return (
    s.flow?.settlements === "authorized" &&
    s.deep.finance.autoPay &&
    s.flow.consent?.homeKey === s.life.lease.homeKey &&
    s.flow.consent.rent === s.housing.rent
  );
}

function appendedTransactions(before, next) {
  const old = before.transactions,
    after = next.transactions;
  for (let count = Math.min(old.length, after.length); count >= 0; count--)
    if (same(old.slice(old.length - count), after.slice(0, count))) return after.slice(count);
  return after;
}

// Rent and utilities have independent clocks after a move. A weekly principal
// payment can also reduce debt, so a debt-increase check alone misses it.
export function settlementBoundary(before, next) {
  if (
    before.housing.dueDay !== next.housing.dueDay ||
    next.debt > before.debt ||
    (before.deep.finance.debtPlan &&
      before.deep.finance.debtPlan.nextDay !== next.deep.finance.debtPlan?.nextDay) ||
    (before.life.lease.plan && before.life.lease.plan.nextDay !== next.life.lease.plan?.nextDay) ||
    (before.deep.business &&
      next.deep.business &&
      (before.deep.business.status === "active" || before.deep.business.accruedOverhead > 0) &&
      before.deep.business.nextOverheadDay !== next.deep.business.nextOverheadDay)
  )
    return true;
  if (Math.floor(before.time / (30 * DAY)) === Math.floor(next.time / (30 * DAY))) return false;
  return appendedTransactions(before, next).some(
    (t) =>
      t.label === "Elektrik, su ve telefon" &&
      t.amount < 0 &&
      (t.account === "cash" || t.account === "bank"),
  );
}

export function authorizedSettlement(before, next) {
  if (
    !validConsent(before) ||
    before.housing.id !== next.housing.id ||
    before.housing.rent !== next.housing.rent ||
    before.life.lease.homeKey !== next.life.lease.homeKey ||
    next.housing.arrears > before.housing.arrears ||
    next.deep.finance.bills.some((b) => b.status === "due") ||
    sum(next) < before.deep.routine.budgetFloor
  )
    return false;
  const plan = before.deep.finance.debtPlan;
  if (
    plan &&
    ((next.deep.finance.debtPlan && next.deep.finance.debtPlan.missed > plan.missed) ||
      (!next.deep.finance.debtPlan && next.debt > 0))
  )
    return false;
  const leasePlan = before.life.lease.plan;
  if (
    (leasePlan &&
      ((next.life.lease.plan && next.life.lease.plan.missed > leasePlan.missed) ||
        (!next.life.lease.plan && next.housing.arrears > 0))) ||
    (before.deep.business &&
      next.deep.business &&
      (next.deep.business.arrears > before.deep.business.arrears ||
        (before.deep.business.status === "active" && next.deep.business.status !== "active")))
  )
    return false;
  const debtEntries = appendedTransactions(before, next).filter(
    (t) => t.account === "debt" && t.amount > 0,
  );
  if (debtEntries.some((t) => !t.label.startsWith("30 günlük borç faizi ·"))) return false;
  const interest = debtEntries.reduce((n, t) => n + t.amount, 0);
  if (interest && !before.flow.consent.debtPresent) return false;
  return next.debt <= before.debt + interest;
}

export function afterFlowAction(s, id, before) {
  if (!s.flow) return;
  if (
    id.startsWith("loan:") ||
    id === "loan" ||
    id === "finance:debt-plan" ||
    id === "finance:cancel-plan" ||
    id === "lease:plan" ||
    id.startsWith("business:start:") ||
    ["business:upgrade", "business:pause", "business:close"].includes(id) ||
    (id === "finance:autopay" && !s.deep.finance.autoPay) ||
    before.life.lease.homeKey !== s.life.lease.homeKey ||
    before.housing.rent !== s.housing.rent
  ) {
    s.flow.consent = null;
    s.flow.settlements = "review";
  }
}

function recoveryIds(s, code, actions) {
  const enabled = (a) => !a.disabled;
  const ids = (test, limit = 4) =>
    actions
      .filter((a) => enabled(a) && test(a.id))
      .slice(0, limit)
      .map((a) => a.id);
  switch (code) {
    case "event":
      return ids((id) => id.startsWith("event:") || id.startsWith("systemic:"), 6);
    case "story":
      return ids((id) => id.startsWith("story:"), 6);
    case "bill":
      return ids((id) => id.startsWith("finance:bill:"));
    case "promise":
      return ids((id) => id.startsWith("deep:fulfill:"));
    case "lease":
      return ids((id) => id.startsWith("lease:"));
    case "health":
      return ids((id) => ["clinic", "doctor", "rest", "cook", "soup", "flow:care"].includes(id));
    case "weekday":
      return ids((id) => id === "policy:day:" + ((day(s) - 1) % 7) || id === "flow:care");
    case "meal":
      return ids(
        (id) => ["cook", "soup", "eat", "snack", "buy:groceries", "withdraw:1000"].includes(id),
        6,
      );
    case "duty":
      return ids((id) => id === "household:chore" || id.startsWith("travel:"));
    case "appointment":
      return ids(
        (id) =>
          id.startsWith("calendar:attend:") ||
          id.startsWith("visit:") ||
          id.startsWith("calendar:cancel:"),
      );
    case "payment":
      return [
        ...ids((id) => id === "flow:payments:authorized"),
        ...ids((id) => id === "sleep" || id === "wait:routine", 1),
        ...ids((id) => id.startsWith("repay:") || id === "finance:debt-plan", 2),
      ];
    case "budget":
      return ids(
        (id) =>
          id.startsWith("withdraw:") || id.startsWith("schedule:budget:") || id === "flow:care",
      );
    case "work":
      return ids(
        (id) =>
          id === "work" ||
          id === "travel:" + by(JOBS, s.job?.id)?.district ||
          id === "sleep" ||
          id === "wait:routine" ||
          id === "schedule:toggle:work",
      );
    default:
      return ids((id) => id === "flow:care" || id === "sleep" || id === "wait:routine");
  }
}

export function getDecisionView(s, { actions = [], society = null } = {}) {
  if (!s.flow) return null;
  const blocker = routineBlocker(s);
  const urgent = [],
    opportunities = [],
    background = [];
  const item = (id, title, summary, code, dueAt = null) => ({
    id,
    title,
    summary,
    why: summary,
    dueAt,
    actionIds: recoveryIds(s, code, actions),
    target: { tab: TARGETS[code] || "plan" },
    source: "Kendi takvimin ve sözleşmelerin",
  });
  if (blocker)
    urgent.push(item("routine-blocker", "Planın burada duruyor", blocker.reason, blocker.code));
  const batchBlocker = recordedStop(s, "care") || recordedStop(s, "wait");
  if (batchBlocker && batchBlocker.code !== blocker?.code)
    urgent.push(
      item("batch-blocker", "Son ilerleme burada durdu", batchBlocker.reason, batchBlocker.code),
    );
  const soon = s.calendar.entries
    .filter((e) => e.status === "confirmed" && e.end > s.time)
    .sort((a, b) => a.start - b.start)[0];
  if (soon && soon.start - s.time < DAY) {
    const e = item(
      "appointment-" + soon.id,
      "Yaklaşan taahhüdün",
      "Saat ve yolculuk payını birlikte kontrol et.",
      "appointment",
      soon.start,
    );
    e.actionIds = actions
      .filter(
        (a) =>
          !a.disabled && (a.id === "calendar:attend:" + soon.id || a.id === "visit:" + soon.venue),
      )
      .map((a) => a.id);
    e.target.calendarDay = Math.floor(soon.start / DAY) + 1;
    urgent.push(e);
  }
  const repayment = actions
    .filter((a) => !a.disabled && a.id.startsWith("repay:"))
    .map((a) => a.id);
  const rate = s.deep.finance.debtPlan ? 0.02 : 0.03;
  const interest = Math.ceil(s.debt * rate);
  if (s.debt && sum(s) > s.debt + s.deep.routine.budgetFloor)
    opportunities.push({
      ...item(
        "debt-review",
        "Birikimin var, borcun sürüyor",
        "Mevcut borç için sıradaki aylık faiz yaklaşık " +
          interest +
          " TL. Ödeme tutarını sen seç; otomatik kapatma yok.",
        "payment",
      ),
      actionIds: repayment,
      target: { tab: "wallet" },
    });
  for (const offer of society?.offers || [])
    if (offer.status === "open" || offer.status === "pending")
      opportunities.push({
        id: "offer-" + offer.id,
        title: offer.title || "Bir davet var",
        summary: offer.reason || offer.why || "",
        why: offer.reason || offer.why || "",
        dueAt: offer.expiresAt || null,
        actionIds: offer.actionIds || [],
        target: { tab: "people", npcId: offer.npcId },
        source: offer.source || "Doğrudan davet",
      });
  const enabled = actions.filter((a) => !a.disabled);
  if (!s.job && !s.deep.business)
    opportunities.push({
      ...item(
        "income",
        "Bir gelir yolu seç",
        "İş ve işletme seçeneklerini koşullarıyla karşılaştır.",
        "work",
      ),
      actionIds: enabled
        .filter((a) => a.id.startsWith("apply:"))
        .slice(0, 2)
        .map((a) => a.id),
    });
  const home = by(HOMES, s.housing.id),
    job = s.job && by(JOBS, s.job.id);
  background.push({
    id: "home",
    title: "Ev ve günlük düzen",
    summary: (home?.name || "") + (job ? " · " + job.name : ""),
    actionIds: [],
    target: { tab: "life" },
    source: "Kendi sözleşmelerin",
  });
  return {
    urgent: urgent.slice(0, 4),
    opportunities: opportunities.slice(0, 6),
    background,
    routine: {
      code: blocker?.code || s.flow.stop?.code || "ready",
      reason:
        blocker?.reason || s.flow.stop?.reason || "Planını açık tercihlerle çalıştırabilirsin.",
      at: s.flow.stop?.at ?? s.time,
      blocked: Boolean(blocker),
      retryAllowed: !blocker,
      stopKey: blocker ? routineFingerprint(s) : "",
      actionIds: blocker
        ? recoveryIds(s, blocker.code, actions)
        : enabled.filter((a) => /^schedule:run:[17]$/.test(a.id)).map((a) => a.id),
      target: blocker?.target || { tab: "plan" },
      performedCount: s.flow.stop?.performedCount || 0,
    },
    goals: {
      short: "İhtiyaç ve taahhütlerini koru",
      medium: "Gelirini ve sosyal çevreni geliştir",
      long: "Borç, birikim ve yaşam düzenini birlikte değerlendir",
    },
    finance: {
      debt: s.debt,
      available: sum(s),
      monthlyInterest: interest,
      rate,
      repaymentActionIds: repayment,
      consent: validConsent(s),
      consentRequired: !validConsent(s),
    },
  };
}

export function validateFlow(s) {
  const x = s.flow;
  const exact = (v, keys) =>
    v &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    Object.keys(v).length === keys.length &&
    keys.every((k) => Object.hasOwn(v, k));
  const integer = (v, max = 1000000000) => Number.isInteger(v) && v >= 0 && v <= max;
  if (
    !exact(x, ["version", "initializedAt", "settlements", "consent", "stop"]) ||
    x.version !== 1 ||
    !integer(x.initializedAt, s.time) ||
    !["review", "authorized"].includes(x.settlements)
  )
    return false;
  if (
    x.consent !== null &&
    (!exact(x.consent, ["homeKey", "rent", "debtPresent", "at"]) ||
      typeof x.consent.homeKey !== "string" ||
      x.consent.homeKey.length > 300 ||
      !integer(x.consent.rent) ||
      !integer(x.consent.at, s.time) ||
      typeof x.consent.debtPresent !== "boolean")
  )
    return false;
  if (x.settlements === "review" && x.consent !== null) return false;
  if (
    x.stop !== null &&
    (!exact(x.stop, [
      "code",
      "reason",
      "at",
      "performedCount",
      "blocked",
      "scope",
      "fingerprint",
    ]) ||
      !["routine", "care", "wait"].includes(x.stop.scope) ||
      typeof x.stop.code !== "string" ||
      x.stop.code.length > 40 ||
      typeof x.stop.reason !== "string" ||
      x.stop.reason.length > 1000 ||
      !integer(x.stop.at, s.time) ||
      !integer(x.stop.performedCount, 96) ||
      typeof x.stop.blocked !== "boolean" ||
      typeof x.stop.fingerprint !== "string" ||
      x.stop.fingerprint.length > 12000)
  )
    return false;
  return true;
}
