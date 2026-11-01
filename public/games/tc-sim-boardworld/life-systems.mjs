import { NPCS, JOBS, HOMES, SKILLS, DISTRICTS } from "./content.mjs";
import { EMPLOYERS, BUSINESS_TYPES } from "./deep-content.mjs";
import {
  SECONDARY_PEOPLE,
  SOCIAL_ROLES,
  HOUSEHOLD_PLANS,
  DISTRICT_PHASES,
} from "./life-content.mjs";
const DAY = 1440,
  MAX = 1e9,
  find = (xs, id) => xs.find((x) => x.id === id),
  cap = (n, min = 0, max = 100) => Math.max(min, Math.min(max, n)),
  money = (n) => Math.round(cap(n, 0, MAX)),
  day = (s) => Math.floor(s.time / DAY) + 1,
  available = (s) => s.cash + s.bank;
const homeKey = (s) => {
  const prefix = `${s.housing.id}:`,
    doc = s.documents
      .slice()
      .reverse()
      .find((d) => d.title === find(HOMES, s.housing.id).name + " · sözleşme");
  return doc
    ? prefix + doc.id
    : s.life?.lease?.homeKey?.startsWith(prefix)
      ? s.life.lease.homeKey
      : prefix + "origin";
};
const rawBusinessKey = (s) =>
  s.deep.business
    ? `${s.deep.business.id}:${s.deep.business.openedDay}:${
        s.documents
          .slice()
          .reverse()
          .find((d) => d.id.startsWith("business-"))?.id || "legacy"
      }`
    : "";
export function getLifeBusinessKey(s) {
  if (!s.deep.business) return "";
  const prefix = `${s.deep.business.id}:${s.deep.business.openedDay}:`;
  return s.life?.businessKey?.startsWith(prefix) ? s.life.businessKey : rawBusinessKey(s);
}
const businessKey = (s) => getLifeBusinessKey(s);
const rawJobKey = (s) =>
  s.job
    ? `${s.job.id}:${s.job.hiredDay}:${
        s.documents
          .slice()
          .reverse()
          .find((d) => d.id.startsWith("employment-"))?.id || "legacy"
      }`
    : "";
const jobKey = (s) =>
  s.job
    ? s.life?.employers[s.job.id]?.contractKey?.startsWith(`${s.job.id}:${s.job.hiredDay}:`)
      ? s.life.employers[s.job.id].contractKey
      : rawJobKey(s)
    : "";
export function getLifeJobKey(s) {
  return jobKey(s);
}
const names = (id) => find(NPCS, id)?.name || find(SECONDARY_PEOPLE, id)?.name || id;
const region = (id) => find(DISTRICTS, id)?.name || id;
const secondary = (s, id) => s.life.secondary.find((n) => n.id === id);
const person = (s, id) => s.deep.npcs[id] || secondary(s, id);
const relation = (s, id) => s.npcs[id] || secondary(s, id)?.relation;
const context = (s, id) => s.life.relations[id] || secondary(s, id)?.context;
const allActors = (s) => [...NPCS.map((n) => n.id), ...s.life.secondary.map((n) => n.id)];
const emptyContext = (knownWork) => ({
  knownWork,
  reciprocity: 0,
  lastActions: { colleague: 0, neighbor: 0, friend: 0, customer: 0, romance: 0, disclose: 0 },
  order: null,
  history: [],
});
function note(s, text, api) {
  s.life.history.push({ day: day(s), text });
  s.life.history = s.life.history.slice(-48);
  api?.log(s, text);
}
function remember(s, id, text, api) {
  const c = context(s, id);
  c.history.push({ day: day(s), text });
  c.history = c.history.slice(-12);
  if (s.npcs[id]) api?.memory(s, id, text);
  else {
    const n = secondary(s, id);
    n.history.push({ day: day(s), text });
    n.history = n.history.slice(-12);
  }
}
/** Explicit communications only: no private actor state is inferred or shared. */
export function lifeActorMessage(s, id, text, api) {
  if (!s.life || !person(s, id)) return false;
  const value = String(text).slice(0, 100);
  if (s.npcs[id]) api.reveal(s, id, "systemic", value, "Oyuncunun doğrudan gönderdiği plan");
  else {
    const n = secondary(s, id);
    n.facts.push({ id: "systemic", value, day: day(s), source: "Doğrudan gönderdiğin plan" });
    n.facts = n.facts.slice(-8);
  }
  remember(s, id, String(text).slice(0, 400), api);
  return true;
}
export function lifeActorRelation(s, id, changes, text, api) {
  if (!s.life || !person(s, id)) return false;
  addRelation(s, id, { trust: changes.trust || 0, affinity: changes.affinity || 0 });
  remember(s, id, String(text).slice(0, 400), api);
  return true;
}
function leaseState(s) {
  return {
    homeKey: homeKey(s),
    renewDay: day(s) + 60,
    stabilityUntil: 0,
    status: "current",
    stage: "clear",
    dueDay: 0,
    plan: null,
    lastArrears: s.housing.arrears,
    lastReviewDay: 0,
    history: [],
  };
}
export function initLife(s) {
  const d = day(s);
  s.life = {
    version: 1,
    initializedAt: s.time,
    lastDay: d,
    businessKey: rawBusinessKey(s),
    secondary: [],
    promotion: { lastDay: 0 },
    relations: Object.fromEntries(NPCS.map((n) => [n.id, emptyContext(n.work)])),
    household: null,
    obligations: {},
    lease: leaseState(s),
    districts: Object.fromEntries(
      DISTRICTS.map((r) => [
        r.id,
        {
          phase: "calm",
          untilDay: d + 14,
          travelDelay: 0,
          servicePct: 100,
          rentPct: 100,
          demandDelta: 0,
          jobDemand: 60,
          revision: 0,
        },
      ]),
    ),
    employers: Object.fromEntries(
      JOBS.map((j) => [
        j.id,
        {
          needSkill: j.skill,
          needLevel: 35,
          workload: "balanced",
          contractKey: s.job?.id === j.id ? jobKey(s) : "",
          extraMinutes: 0,
          bonus: 0,
          stress: 0,
          reviewDay: d + 14,
          lastReviewDay: 0,
          history: [],
        },
      ]),
    ),
    history: [],
  };
  return s;
}
export function getDistrictEffects(s, id) {
  return (
    s.life?.districts[id] || {
      phase: "calm",
      untilDay: 0,
      travelDelay: 0,
      servicePct: 100,
      rentPct: 100,
      demandDelta: 0,
      jobDemand: 60,
      revision: 0,
    }
  );
}
export function getLifeWorkTerms(s) {
  const e = s.life && s.job && s.life.employers[s.job.id];
  return e && e.contractKey === jobKey(s)
    ? { extraMinutes: e.extraMinutes, bonus: e.bonus, stress: e.stress }
    : { extraMinutes: 0, bonus: 0, stress: 0 };
}
export function npcHousingCost(s, id, base) {
  return s.life?.household?.memberId === id ? 180 : base;
}
export function canNpcMove(s, id) {
  return s.life?.household?.memberId !== id;
}
export function canEndLease(s) {
  return !s.life || (s.life.lease.stage === "notice" && day(s) > s.life.lease.dueDay);
}
function knownUpdate(s, n, text) {
  if (n.relation.trust >= 35) {
    n.known = { home: n.home, profession: n.profession };
    n.context.knownWork = n.work;
    n.history.push({ day: day(s), text: `Kendisi haber verdi: ${text}` });
    n.history = n.history.slice(-12);
  }
}
function addRelation(s, id, { trust = 0, affinity = 0, conflict = 0, reciprocity = 0 }) {
  const r = relation(s, id),
    n = person(s, id),
    c = context(s, id);
  r.trust = cap(r.trust + trust);
  r.affinity = cap(r.affinity + affinity);
  if (s.npcs[id]) n.resentment = cap(n.resentment + conflict);
  else r.conflict = cap(r.conflict + conflict);
  c.reciprocity = cap(c.reciprocity + reciprocity, -100, 100);
}
function secondaryBusy(s, n, minutes = 30) {
  if (n.busyUntil > s.time) return "Kararlaştırılmış bir görüşmesi sürüyor.";
  if (s.life.household?.memberId === n.id && s.life.household.memberTaskEnd > s.time)
    return "Ortak evde bakım sorumluluğunu yerine getiriyor.";
  if (n.move) return "Şu anda görüşmeye uygun değil; daha sonra telefonla sor.";
  const m = s.time % DAY,
    wd = (day(s) - 1) % 7,
    working =
      (n.employment === "employed" && wd < 5) ||
      (n.employment === "studying" && [0, 2, 4].includes(wd));
  if (m < 540 || m + minutes > 1260) return "Görüşme 09.00–21.00 arasında tamamlanmalı.";
  if (working && m < 1080 && m + minutes > 480)
    return "İş, ders veya yolculuk programı dolu; 18.00 sonrasında görüş.";
  return "";
}
function availability(s, id, minutes = 30) {
  const n = person(s, id);
  if (!n) return "Bu kişi henüz çevrende değil.";
  if (!s.npcs[id]) return secondaryBusy(s, n, minutes);
  const m = s.time % DAY;
  if (m < 540 || m + minutes > 1260) return "Görüşme 09.00–21.00 arasında tamamlanmalı.";
  if (
    s.living.npcs[id].plan.some((p) => p.start < s.time + minutes && s.time < p.end) ||
    s.calendar.entries.some(
      (e) =>
        e.npcId === id && e.status === "confirmed" && e.start < s.time + minutes && s.time < e.end,
    )
  )
    return "Kişinin bu sürede başka bir planı var.";
  return "";
}
function rolesFor(s, id) {
  const n = person(s, id),
    r = relation(s, id),
    roles = [];
  if (!n) return roles;
  const sec = secondary(s, id);
  if (
    s.job &&
    context(s, id).knownWork === find(JOBS, s.job.id).district &&
    (sec?.role === "colleague" ||
      find(EMPLOYERS, s.job.id).coworkers.includes(id) ||
      find(EMPLOYERS, s.job.id).manager === id)
  )
    roles.push("colleague");
  const knownHome = sec?.known.home || s.living.known[id]?.home || n.home;
  if (knownHome === find(HOMES, s.housing.id).district) roles.push("neighbor");
  if (r.trust >= 30 && r.affinity >= 35) roles.push("friend");
  if (
    s.deep.business &&
    knownHome === s.deep.business.location &&
    (sec?.role === "customer" || r.affinity >= 20)
  )
    roles.push("customer");
  if (s.flags.partner === id) roles.push("romance");
  return roles;
}
function promote(s, role, district, api) {
  if (
    s.life.secondary.length >= 6 ||
    (day(s) - s.life.promotion.lastDay < 5 && s.life.promotion.lastDay)
  )
    return false;
  const choices = SECONDARY_PEOPLE.filter(
      (p) => p.role === role && p.district === district && !secondary(s, p.id),
    ),
    template = choices[0];
  if (!template) return false;
  const cohort = s.living.population.districts[district];
  if (cohort[template.cohort] < 1) return false;
  cohort[template.cohort]--;
  const n = {
    id: template.id,
    role: template.role,
    sourceCohort: template.cohort,
    sourceDistrict: district,
    promotedAt: s.time,
    home: district,
    work: district,
    profession: template.profession,
    employment:
      template.cohort === "employed"
        ? "employed"
        : template.cohort === "students"
          ? "studying"
          : "searching",
    cash: 2200,
    savings: 1800,
    debt: 0,
    wage: 620,
    rent: 3900,
    skill: 28,
    lastDay: day(s),
    lastJobDay: day(s),
    goal: template.goal,
    preference: template.preference,
    relation: { trust: 18, affinity: 20, conflict: 0 },
    context: emptyContext(district),
    known: { home: district, profession: template.profession },
    facts: [],
    history: [
      {
        day: day(s),
        text: `${region(district)} çevrende gerçek bir ${SOCIAL_ROLES.find((r) => r.id === role).label.toLocaleLowerCase("tr-TR")} olarak tanıştınız.`,
      },
    ],
    move: null,
    busyUntil: 0,
  };
  s.life.secondary.push(n);
  s.life.promotion.lastDay = day(s);
  note(
    s,
    `${template.name} çevrene katıldı; anonim nüfustan ayrılan aynı kişi artık kalıcı bir tanıdık.`,
    api,
  );
  return true;
}
function updateDistricts(s, api) {
  for (const d of DISTRICTS) {
    const x = s.life.districts[d.id];
    if (day(s) < x.untilDay) continue;
    const pop = s.living.population.districts[d.id],
      market = s.living.markets[d.id],
      phase =
        pop.households / pop.capacity > 0.83
          ? "pressure"
          : (x.revision + DISTRICTS.indexOf(d)) % 4 === 2
            ? "roadworks"
            : pop.employed > 95 && market.demand >= 60
              ? "investment"
              : "calm",
      rules = DISTRICT_PHASES[phase];
    Object.assign(x, {
      phase,
      untilDay: day(s) + 14,
      travelDelay: rules.travelDelay,
      servicePct: rules.servicePct,
      rentPct: rules.rentPct,
      demandDelta: rules.demandDelta,
      jobDemand: Math.round(cap(45 + market.demand / 3 - pop.jobseekers / 2)),
      revision: x.revision + 1,
    });
    note(s, `${d.name}: ${rules.label}. ${rules.description}`, api);
  }
}
function updateEmployers(s) {
  for (const job of JOBS) {
    const e = s.life.employers[job.id];
    if (day(s) < e.reviewDay) continue;
    const demand = getDistrictEffects(s, job.district).jobDemand;
    e.needLevel = demand >= 65 ? 45 : 30;
    e.workload = demand >= 65 ? "busy" : demand < 45 ? "quiet" : "balanced";
    e.reviewDay = day(s) + 14;
  }
}
function settleSecondary(s, n) {
  const d = day(s),
    previous = d - 1;
  if (n.lastDay >= d) return;
  n.lastDay = d;
  const wd = (previous - 1) % 7,
    working =
      (n.employment === "employed" && wd < 5) ||
      (n.employment === "studying" && [0, 2, 4].includes(wd)),
    start = (previous - 1) * DAY + 540,
    end = (previous - 1) * DAY + 1020;
  if (working) {
    const minutes = Math.max(0, end - Math.max(start, n.promotedAt));
    n.cash = money(n.cash + Math.floor((n.wage * minutes) / 480));
  }
  const expense = npcHousingCost(s, n.id, 180 + Math.round(n.rent / 30)),
    paid = Math.min(n.cash, expense);
  n.cash -= paid;
  n.debt = money(n.debt + expense - paid);
  if (n.cash < 600 && d - n.lastJobDay >= 7 && n.employment !== "searching") {
    n.employment = "searching";
    n.lastJobDay = d;
    knownUpdate(s, n, "Bütçesi sıkışınca düzenli iş aramaya başladı.");
  } else if (n.employment === "searching" && d - n.lastJobDay >= 5) {
    n.employment = "employed";
    n.lastJobDay = d;
    n.profession = "Yerel hizmet çalışanı";
    knownUpdate(s, n, "İş arama sürecinden sonra düzenli bir sözleşme buldu.");
  }
  if (d % 7 === 0 && n.cash >= 700) {
    const payment = Math.min(n.debt, 200);
    n.cash -= payment;
    n.debt -= payment;
    const focused = n.preference === "reliable" && n.cash >= 790;
    n.cash -= focused ? 90 : 60;
    n.skill = cap(n.skill + (focused ? 2 : 1));
    if (n.cash > 2800) {
      const saving = n.cash - 2200;
      n.cash -= saving;
      n.savings = money(n.savings + saving);
    }
  }
  if (d % 7 === 1 && n.relation.affinity > 0) n.relation.affinity = cap(n.relation.affinity - 1);
  if (canNpcMove(s, n.id) && !n.move && n.savings >= 15000 && d - n.lastJobDay > 60) {
    const destination = DISTRICTS.filter((r) => r.id !== n.home).sort(
      (a, b) => s.living.markets[b.id].vacancies - s.living.markets[a.id].vacancies,
    )[0];
    if (destination && s.living.markets[destination.id].vacancies > 0) {
      n.savings -= 3000;
      n.move = { from: n.home, to: destination.id, end: s.time + 120 };
      n.lastJobDay = d;
    }
  }
}
export function nextLifeAt(s) {
  if (!s.life) return Infinity;
  let at = (Math.floor(s.time / DAY) + 1) * DAY;
  for (const n of s.life.secondary) {
    if (n.move && n.move.end > s.time) at = Math.min(at, n.move.end);
    if (n.busyUntil > s.time) at = Math.min(at, n.busyUntil);
  }
  const h = s.life.household;
  if (h && h.memberTaskEnd > s.time) at = Math.min(at, h.memberTaskEnd);
  if (h && h.memberDue <= day(s) && s.time % DAY < 1200)
    at = Math.min(at, Math.floor(s.time / DAY) * DAY + 1200);
  return at;
}
export function householdBill(s, amount, label, kind, api) {
  const h = s.life?.household;
  if (!h || h.homeKey !== homeKey(s) || !amount || !["rent", "utilities"].includes(kind))
    return amount;
  const key = `${kind}:${day(s)}:${label}:${amount}`;
  const old = h.billRecords.find((b) => b.key === key);
  if (old) return amount - old.paid;
  const n = person(s, h.memberId),
    share = Math.floor((amount * h.share) / 100),
    paid = Math.min(n.cash, share);
  n.cash -= paid;
  h.billRecords.push({ key, paid });
  h.billRecords = h.billRecords.slice(-24);
  const unpaid = share - paid;
  if (unpaid)
    s.life.obligations[h.memberId] = money((s.life.obligations[h.memberId] || 0) + unpaid);
  if (paid)
    api.record(s, `${names(h.memberId)} · ${label} payı doğrudan ödendi`, -paid, "household");
  h.history.push({
    day: day(s),
    text: `${label}: ${share} TL payın ${paid} TL’si ödendi${unpaid ? `, ${unpaid} TL sana karşı yükümlülük kaldı` : ""}.`,
  });
  h.history = h.history.slice(-12);
  return amount - paid;
}
export function closeHousehold(s, reason, api) {
  const h = s.life?.household;
  if (!h) return;
  const n = person(s, h.memberId),
    owed = s.life.obligations[h.memberId] || 0,
    offset = Math.min(h.deposit, owed),
    refund = h.deposit - offset;
  if (offset) {
    s.life.obligations[h.memberId] = owed - offset;
    api.receive(s, offset, "Ev arkadaşı depozitosu · ödenmeyen paya mahsup", "bank");
  }
  n.cash = money(n.cash + refund);
  api.record(s, "Ev arkadaşının kullanılmayan depozitosu iade edildi", -refund, "household");
  remember(
    s,
    h.memberId,
    `Ortak yaşam kapandı: ${reason}. Depozitodan ${offset} TL borca sayıldı, ${refund} TL bana geri döndü.`,
    api,
  );
  s.life.household = null;
  note(s, "Ev paylaşımı kapandı; bakiye yükümlülükler ve geçmiş korunuyor.", api);
}
export function syncLifeHousing(s, api) {
  if (!s.life) return;
  if (s.life.household && s.life.household.homeKey !== homeKey(s))
    closeHousehold(s, "Konut sözleşmesi değişti", api);
  if (s.life.lease.homeKey !== homeKey(s)) s.life.lease = leaseState(s);
}
export function fulfillHouseholdDuty(s, api) {
  const h = s.life?.household;
  if (!h) return false;
  const plan = find(HOUSEHOLD_PLANS, h.plan);
  h.playerDue = day(s) + plan.playerDays;
  h.playerMissed = 0;
  h.tension = cap(h.tension - 12);
  h.history.push({
    day: day(s),
    text: "Senin bakım sorumluluğun gerçek zaman ve giderle tamamlandı.",
  });
  h.history = h.history.slice(-12);
  api.change(s, { energy: -6, stress: 2 });
  addRelation(s, h.memberId, { trust: 2, reciprocity: 3 });
  return true;
}
function householdTick(s, api) {
  const h = s.life.household;
  if (!h) return;
  const n = person(s, h.memberId),
    plan = find(HOUSEHOLD_PLANS, h.plan);
  if (h.memberTaskEnd && s.time >= h.memberTaskEnd) {
    h.memberTaskEnd = 0;
    h.memberDue = day(s) + plan.memberDays;
    h.memberMissed = 0;
    h.tension = cap(h.tension - 8);
    h.history.push({
      day: day(s),
      text: `${names(h.memberId)} kendi bakım sorumluluğunu tamamladı.`,
    });
    h.history = h.history.slice(-12);
  }
  if (
    h.memberDue <= day(s) &&
    s.time % DAY === 1200 &&
    !h.memberTaskEnd &&
    !availability(s, h.memberId, 60) &&
    n.cash >= 80
  ) {
    n.cash -= 80;
    h.memberTaskEnd = s.time + 60;
    if (s.npcs[h.memberId]) {
      const id = h.memberId;
      s.living.npcs[id].plan.push({
        id: `${id}:household:${s.time}`,
        kind: "visit",
        start: s.time,
        end: s.time + 60,
        location: n.home,
        from: n.home,
        to: n.home,
        target: "",
        cost: 0,
        wage: 0,
        status: "planned",
      });
    }
    api.record(s, `${names(h.memberId)} · kendi ev bakım gideri`, -80, "household");
  }
  if (h.status === "notice" && day(s) > h.noticeDay)
    closeHousehold(s, "Önceden bildirilen ayrılma günü geldi", api);
}
function leaseTick(s, api) {
  const l = s.life.lease,
    d = day(s);
  if (!s.housing.rent) return;
  if (d >= l.renewDay && l.status === "current") {
    l.status = "renewal";
    l.history.push({
      day: d,
      text: "Yenileme dönemi geldi; mevcut kira yeni karar verilene kadar sürer.",
    });
  }
  if (!s.housing.arrears) {
    if (l.stage !== "clear")
      l.history.push({ day: d, text: "Gerçek kira birikimi kapandı; uyuşmazlık tamamlandı." });
    l.stage = "clear";
    l.dueDay = 0;
    l.plan = null;
  } else if (l.stage === "clear") {
    l.stage = "warning";
    l.dueDay = d + 7;
    l.history.push({
      day: d,
      text: "Ödenmeyen kira için ilk bildirim: yedi gün içinde görüş veya ödeme yap.",
    });
  } else if (l.stage === "warning" && d > l.dueDay) {
    l.stage = "negotiation";
    l.dueDay = d + 7;
    l.history.push({ day: d, text: "İlk süre geçti; ödeme planı görüşme dönemi açıldı." });
  } else if (l.stage === "negotiation" && d > l.dueDay) {
    l.stage = "notice";
    l.dueDay = d + 14;
    l.history.push({
      day: d,
      text: "Görüşme sonuçlanmadı: 14 günlük son bildirim. Üç kiralık birikim varsa sözleşme sona erebilir.",
    });
  }
  if (l.plan && d >= l.plan.nextDay) {
    const amount = Math.min(l.plan.installment, s.housing.arrears);
    if (available(s) >= amount && s.deep.finance.autoPay) {
      api.spend(s, amount, "Görüşülmüş kira birikimi taksiti", "total");
      s.housing.arrears -= amount;
      api.record(s, "Kira taksiti ile gerçek birikim azaltıldı", -amount, "arrears");
      l.plan.nextDay += 7;
      l.plan.missed = 0;
      if (!s.housing.arrears) {
        l.plan = null;
        l.stage = "clear";
        l.dueDay = 0;
      }
    } else {
      l.plan.missed++;
      l.plan.nextDay = d + 7;
      l.history.push({ day: d, text: "Kira planı taksiti ödenemedi; anapara yeniden eklenmedi." });
      if (l.plan.missed >= 2) {
        l.plan = null;
        l.stage = "notice";
        l.dueDay = d + 14;
      }
    }
  }
  l.lastArrears = s.housing.arrears;
  l.history = l.history.slice(-12);
}
export function tickLife(s, api) {
  if (!s.life) return;
  for (const n of s.life.secondary) {
    if (n.busyUntil && s.time >= n.busyUntil) n.busyUntil = 0;
    if (n.move && s.time >= n.move.end) {
      n.home = n.move.to;
      n.move = null;
      knownUpdate(s, n, `${region(n.home)}’a kendi birikimiyle taşındı.`);
    }
  }
  householdTick(s, api);
  if (s.life.lastDay >= day(s)) return;
  s.life.lastDay = day(s);
  syncLifeHousing(s, api);
  updateDistricts(s, api);
  updateEmployers(s);
  for (const n of s.life.secondary) settleSecondary(s, n);
  const h = s.life.household;
  if (h) {
    if (day(s) > h.playerDue) {
      h.playerMissed++;
      h.tension = cap(h.tension + 8);
      h.playerDue = day(s) + 3;
      addRelation(s, h.memberId, { trust: -3, conflict: 4 });
      remember(s, h.memberId, "Ortak yaşamda kararlaştırdığın bakım gününü kaçırdın.", api);
    }
    if (day(s) > h.memberDue) {
      h.memberMissed++;
      h.tension = cap(h.tension + 4);
    }
    const tensionLimit = secondary(s, h.memberId)?.preference === "quiet" ? 55 : 65;
    if (
      h.status === "active" &&
      (h.playerMissed >= 3 || h.tension >= tensionLimit || h.memberMissed >= 7)
    ) {
      h.status = "notice";
      h.noticeDay = day(s) + 7;
      remember(
        s,
        h.memberId,
        "Ortak düzen sürdürülemedi; yedi gün sonra ayrılacağımı önceden bildirdim.",
        api,
      );
    }
  }
  for (const [id, amount] of Object.entries(s.life.obligations)) {
    const n = person(s, id);
    if (amount > 0 && n.cash > 1000 && day(s) % 7 === 0) {
      const paid = Math.min(amount, n.cash - 800, 1000);
      n.cash -= paid;
      s.life.obligations[id] -= paid;
      api.receive(s, paid, `${names(id)} · gecikmiş ortak gider payı`, "bank");
      remember(s, id, "Geciken ortak gider payımın bir bölümünü kendi paramla kapattım.", api);
    }
  }
  leaseTick(s, api);
  for (const id of allActors(s)) {
    const c = context(s, id);
    if (c.order?.status === "open" && day(s) > c.order.dueDay) {
      c.order.status = "late";
      addRelation(s, id, { trust: -6, conflict: 5, reciprocity: -3 });
      if (s.deep.business && c.order.businessKey === businessKey(s))
        s.deep.business.reputation = cap(s.deep.business.reputation - 5);
      remember(s, id, "Müşteri olarak kararlaştırdığımız teslim günü geçti; ödeme yapmadım.", api);
    }
  }
}
function actionList(s, api) {
  const out = [];
  if (!s.life) return out;
  const d = day(s);
  const add = (id, label, description, category, minutes, cost, reason, run, npcId = "") => {
    const why = reason || (available(s) < cost ? `${cost} TL kullanılabilir bakiye gerekir.` : "");
    out.push({
      id,
      label,
      description,
      category,
      minutes,
      cost,
      pay: "total",
      disabled: !!why,
      reason: why,
      run: (next) => {
        const synchronous =
          npcId &&
          (category === "social" ||
            id.startsWith("household:invite:") ||
            id === "household:reconcile" ||
            id.startsWith("life:deliver:"));
        if (synchronous) {
          const n = person(next, npcId);
          if (next.npcs[npcId])
            next.living.npcs[npcId].plan.push({
              id: `${npcId}:life:${next.revision}`,
              kind: "visit",
              start: next.time,
              end: next.time + minutes,
              location: n.home,
              from: n.home,
              to: n.home,
              target: "",
              cost: 0,
              wage: 0,
              status: "planned",
            });
          else n.busyUntil = next.time + minutes;
        }
        return run(next);
      },
      ...(npcId ? { npcId } : {}),
    });
  };
  for (const id of allActors(s)) {
    const n = person(s, id),
      r = relation(s, id),
      c = context(s, id),
      sec = secondary(s, id),
      roles = rolesFor(s, id),
      place = n.home,
      social = (minutes = 30) =>
        availability(s, id, minutes) ||
        (sec && sec.known.home !== place
          ? "Son bildiğin adreste görüşemiyorsunuz; telefonla güncel düzenini sor."
          : s.location !== place
            ? `${names(id)} ile görüşmek için ${region(sec?.known.home || s.living.known[id]?.home || place)}’a git.`
            : ""),
      cooldown = (role) =>
        c.lastActions[role] && d - c.lastActions[role] < 7
          ? "Bu konuda yedi gün ara vermelisiniz."
          : "";
    if (sec) {
      add(
        `life:talk:${id}`,
        `${names(id)} · tanış ve konuş`,
        `${sec.known.profession}. 30 dk; karşılıklı tanışıklık +6, güven +2. Günlük tek anlamlı görüşme.`,
        "social",
        30,
        0,
        social() || (c.lastActions.disclose === d ? "Bugün görüştünüz." : ""),
        (next) => {
          const x = secondary(next, id);
          x.known = { home: x.home, profession: x.profession };
          context(next, id).lastActions.disclose = d;
          addRelation(next, id, { affinity: 6, trust: 2 });
          remember(next, id, "Birlikte konuştuk; güncel işimi ve yaşadığım semti paylaştım.", api);
          return "Tanışıklığınız gerçek bir görüşmeyle ilerledi.";
        },
        id,
      );
      add(
        `life:call:${id}`,
        `${names(id)} · telefonla güncel düzenini sor`,
        "15 dk; yalnızca doğrudan paylaştığı güncel iş ve adres bilgisi görünür. Günlük tek anlamlı görüşme.",
        "social",
        15,
        0,
        availability(s, id, 15) || (c.lastActions.disclose === d ? "Bugün görüştünüz." : ""),
        (next) => {
          const x = secondary(next, id);
          x.known = { home: x.home, profession: x.profession };
          context(next, id).lastActions.disclose = d;
          addRelation(next, id, { affinity: 2, trust: 1 });
          remember(next, id, "Telefonda güncel işimi ve yaşadığım semti kendim anlattım.", api);
          return "Paylaşılan bilgiler güncellendi.";
        },
        id,
      );
      add(
        `life:disclose:${id}`,
        `${names(id)} · planını paylaş`,
        "Kariyerini kendin anlat; bu kişi gizli hesabını veya konuşmadığın olayları öğrenmez. Günde bir, 15 dk.",
        "social",
        15,
        0,
        social(15) || (sec.facts.some((f) => f.day === d) ? "Bugün planını paylaştın." : ""),
        (next) => {
          const x = secondary(next, id);
          x.facts.push({
            id: "career",
            value: next.job ? find(JOBS, next.job.id).name : "İş arıyorum",
            day: d,
            source: "Doğrudan anlattın",
          });
          x.facts = x.facts.slice(-8);
          addRelation(next, id, { trust: 1 });
          return "Sadece anlattığın kariyer bilgisi kaydedildi.";
        },
        id,
      );
    }
    if (roles.includes("colleague"))
      add(
        `life:colleague:${id}`,
        `${names(id)} · teslim notu hazırla`,
        "45 dk; aynı iş çevresine somut teslim notu. Performans +3, mesleki itibar +2; güven +2, haftada bir.",
        "work",
        45,
        0,
        s.location !== find(JOBS, s.job.id).district
          ? "İş semtine git."
          : n.work !== find(JOBS, s.job.id).district
            ? "Bu teslim için güncel çalışma koşulları uygun değil; önce doğrudan görüş."
            : cooldown("colleague"),
        (next) => {
          context(next, id).lastActions.colleague = d;
          next.job.performance = cap(next.job.performance + 3);
          next.deep.career.reputation = cap(next.deep.career.reputation + 2);
          addRelation(next, id, { trust: 2, reciprocity: 3 });
          remember(next, id, "İş teslimini açıklayan notunu ekip kanalından aldım.", api);
          api.change(next, { energy: -5 });
          return "Somut iş teslimi ekip güvenini güçlendirdi.";
        },
        id,
      );
    if (roles.includes("neighbor"))
      add(
        `life:neighbor:${id}`,
        `${names(id)} · ortak bakıma katıl`,
        "60 dk ve 90 TL; birlikte yerel bakım. Güven +3, karşılıklılık +3; ev eşyalarının bakımı en fazla yedi gün uzar. Haftada bir.",
        "social",
        60,
        90,
        social(60) || cooldown("neighbor"),
        (next) => {
          context(next, id).lastActions.neighbor = d;
          addRelation(next, id, { trust: 3, reciprocity: 3, conflict: -3 });
          if (next.living.household.assets.length)
            next.living.household.maintainedUntil = Math.max(
              next.time,
              Math.min(next.living.household.maintainedUntil + 7 * DAY, next.time + 30 * DAY),
            );
          api.change(next, { energy: -7, stress: -3 });
          remember(next, id, "Mahallede gerçek bakım zamanını ve giderini paylaştık.", api);
          return "Komşuluk, ortak bir işin tamamlanmasıyla güçlendi.";
        },
        id,
      );
    if (roles.includes("friend"))
      add(
        `life:friend:${id}`,
        `${names(id)} · karşılıklı destek ver`,
        "90 dk ve 100 TL kendi bütçenden destek; alıcı gerçek parayı alır. Güven +4, karşılıklılık +8. İki haftada bir.",
        "social",
        90,
        100,
        social(90) ||
          (c.lastActions.friend && d - c.lastActions.friend < 14
            ? "Destek sonrası iki hafta ara vermelisin."
            : ""),
        (next) => {
          person(next, id).cash = money(person(next, id).cash + 100);
          context(next, id).lastActions.friend = d;
          addRelation(next, id, { trust: 4, reciprocity: 8, conflict: -3 });
          api.change(next, { energy: -6 });
          remember(
            next,
            id,
            "Kendi zamanından ve bütçenden destek verdin; bunu hatırlıyorum.",
            api,
          );
          return "Destek gerçek bir transferle tamamlandı.";
        },
        id,
      );
    if (roles.includes("romance"))
      add(
        `life:romance:${id}`,
        `${names(id)} · ortak zamanı konuş`,
        "45 dk; ilişkinizin zaman ve sınır beklentilerini açıkça konuş. Kırgınlık −6, stres −8; haftada bir.",
        "social",
        45,
        0,
        social(45) || cooldown("romance"),
        (next) => {
          context(next, id).lastActions.romance = d;
          addRelation(next, id, { trust: 2, conflict: -6, reciprocity: 3 });
          api.change(next, { stress: -8 });
          remember(next, id, "İlişkimizde birlikte zaman ve kişisel sınırlarımızı konuştuk.", api);
          return "Beklentilerinizi birlikte netleştirdiniz.";
        },
        id,
      );
    if (roles.includes("customer") && !c.order) {
      const type = find(BUSINESS_TYPES, s.deep.business.id),
        price = Math.round(type.unitPrice * 0.95);
      add(
        `life:order:${id}`,
        `${names(id)} · müşteri siparişi al`,
        `Üç gün içinde bir stok ve 90 dk hizmet; teslimde ${price} TL alıcının gerçek bütçesinden işletme kasana girer. Şimdiden ödeme yok. İki açık sipariş sınırı.`,
        "business",
        15,
        0,
        s.location !== s.deep.business.location
          ? "İşletmenin semtine git."
          : r.trust < 25
            ? "Müşterinin güveni 25 gerekir."
            : sec?.preference === "quality" && s.deep.business.reputation < 35
              ? "Hizmet kalitesini önemseyen bu müşteri en az 35 işletme itibarı bekliyor."
              : n.cash < price + 200
                ? "Müşteri şu an bu siparişi karşılayamıyor."
                : allActors(s).filter((x) => context(s, x).order?.status === "open").length >= 2
                  ? "Önce iki açık siparişinden birini sonuçlandır."
                  : c.lastActions.customer && d - c.lastActions.customer < 14
                    ? "Aynı müşteriden yeni sipariş için iki hafta geçmeli."
                    : "",
        (next) => {
          context(next, id).lastActions.customer = d;
          context(next, id).order = {
            businessKey: businessKey(next),
            price,
            dueDay: d + 3,
            status: "open",
            extended: false,
          };
          remember(
            next,
            id,
            `Müşteri olarak ${d + 3}. güne teslim için ${price} TL'lik sipariş verdim; ödeme teslimde.`,
            api,
          );
          return "Gerçek müşteri taahhüdü oluştu; para henüz kazanılmadı.";
        },
        id,
      );
    }
    if (c.order) {
      const order = c.order,
        b = s.deep.business;
      add(
        `life:deliver:${id}`,
        `${names(id)} · siparişi teslim et`,
        `${order.dueDay}. gün teslim; ${order.status === "late" ? "gecikmiş sipariş." : "açık taahhüt."} ${order.price} TL gerçek müşteri ödemesi. Bir stok, işletme kasasından 30 TL hizmet gideri ve 90 dk. Geç teslimde itibar ödülü yok.`,
        "business",
        90,
        0,
        !b || businessKey(s) !== order.businessKey
          ? "Siparişin bağlı olduğu işletme kapandı veya değişti."
          : s.location !== b.location
            ? "İşletmenin semtine git."
            : n.home !== b.location
              ? "Müşteri teslim semtinde bulunmuyor; uygun koşulu bekle, süre görüş veya siparişi iptal et."
              : b.status !== "active"
                ? "Önce işletmeyi yeniden aç."
                : !s.living.enterprise.stock
                  ? "Teslim için bir stok gerekir."
                  : s.living.enterprise.capital < 30
                    ? "İşletme kasasında 30 TL gerekir."
                    : n.cash < order.price
                      ? "Müşteri ödeme yapamıyor; süre görüş veya siparişi iptal et."
                      : availability(s, id, 90),
        (next) => {
          const o = context(next, id).order;
          person(next, id).cash -= o.price;
          next.living.enterprise.capital = money(next.living.enterprise.capital + o.price - 30);
          next.living.enterprise.stock--;
          next.deep.business.revenue = money(next.deep.business.revenue + o.price);
          next.deep.business.costs = money(next.deep.business.costs + 30);
          next.deep.business.reputation = cap(
            next.deep.business.reputation + (o.status === "open" ? 3 : 0),
          );
          api.record(next, `${names(id)} · müşteri tahsilatı`, o.price, "business");
          api.record(next, "Özel sipariş hizmet gideri", -30, "business");
          addRelation(next, id, { trust: o.status === "open" ? 4 : 1, reciprocity: 2 });
          context(next, id).order = null;
          api.change(next, { energy: -10, stress: 3 });
          remember(next, id, "Siparişi teslim aldım ve gerçek bütçemden ödedim.", api);
          return "Stok, gerçek ödeme ve gider tek seferde işlendi.";
        },
        id,
      );
      add(
        `life:order-extend:${id}`,
        `${names(id)} · üç gün ek süre iste`,
        "Tek sefer; güven −2. Yeni ödeme oluşmaz.",
        "business",
        15,
        0,
        order.extended
          ? "Siparişin ek süre hakkı kullanıldı."
          : r.trust < 30
            ? "Ek süre için güven 30 gerekir."
            : "",
        (next) => {
          const o = context(next, id).order;
          o.dueDay = Math.max(d, o.dueDay) + 3;
          o.status = "open";
          o.extended = true;
          addRelation(next, id, { trust: -2 });
          return "Müşteri bir kez ek süreyi kabul etti.";
        },
        id,
      );
      add(
        `life:order-cancel:${id}`,
        `${names(id)} · siparişi açıkça iptal et`,
        "Alınmamış para iade edilmez. Güven −4; açık taahhüt kapanır.",
        "business",
        10,
        0,
        "",
        (next) => {
          context(next, id).order = null;
          addRelation(next, id, { trust: -4, conflict: 3 });
          return "Sipariş dürüstçe kapatıldı; güven sonucu korundu.";
        },
        id,
      );
    }
    if (!s.life.household && roles.includes("neighbor") && s.housing.id !== "shelter")
      for (const plan of HOUSEHOLD_PLANS) {
        const deposit = Math.min(2500, Math.ceil((s.housing.rent * plan.share) / 100)),
          why =
            r.trust < 40 || r.affinity < 35
              ? "Ortak yaşam için güven 40 ve tanışıklık 35 gerekir."
              : n.cash + n.savings < deposit + 600
                ? "Komşunun depozito ve güvenli nakit payı hazır değil."
                : s.housing.arrears
                  ? "Önce mevcut kira birikimini çöz."
                  : social(60);
        add(
          `household:invite:${id}:${plan.id}`,
          `${names(id)} · ${plan.name}`,
          `${plan.description} ${deposit} TL depozitoyu ev arkadaşı kendi birikiminden ayrı emanete koyar. Bir ev arkadaşı; açıkça ayrılmadan taşınamazsın.`,
          "household",
          60,
          0,
          why,
          (next) => {
            const x = person(next, id),
              cash = Math.min(x.cash, deposit);
            x.cash -= cash;
            x.savings -= deposit - cash;
            next.life.household = {
              id: `household-${next.revision}`,
              homeKey: homeKey(next),
              homeId: next.housing.id,
              district: next.location,
              memberId: id,
              formedAt: next.time,
              status: "active",
              plan: plan.id,
              share: plan.share,
              deposit,
              playerDue: d + plan.playerDays,
              memberDue: d + plan.memberDays,
              playerMissed: 0,
              memberMissed: 0,
              tension: 0,
              noticeDay: 0,
              memberTaskEnd: 0,
              billRecords: [],
              history: [
                {
                  day: d,
                  text: `${plan.name}: gider payı %${plan.share}, depozito ${deposit} TL. İkiniz de açıkça kabul ettiniz.`,
                },
              ],
            };
            api.record(next, `${names(id)} · ayrı emanet depozito`, deposit, "household");
            remember(
              next,
              id,
              "Aynı semtte ev paylaşımı, gider ve bakım sorumluluklarını birlikte kabul ettik.",
              api,
            );
            return "Paylaşım sözleşmesi yürürlükte; depozito oyuncunun harcanabilir parası değildir.";
          },
          id,
        );
      }
  }
  const h = s.life.household;
  if (h) {
    add(
      "household:chore",
      "Evde kendi bakım payını tamamla",
      "60 dk ve 80 TL. Sonraki bakım tarihi seçtiğin paylaşım düzenine göre ilerler; güven ve karşılıklılık artar.",
      "household",
      60,
      80,
      s.location !== h.district
        ? "Ev semtine git."
        : d < h.playerDue - 2
          ? "Bakım gününe en fazla iki gün kala yapabilirsin."
          : "",
      (next) => {
        fulfillHouseholdDuty(next, api);
        return "Kendi bakım sorumluluğun tamamlandı.";
      },
      h.memberId,
    );
    add(
      "household:leave",
      "Ev paylaşımını anlaşarak bitir",
      "Depozito önce gerçek ödenmemiş paya sayılır; kalanı ev arkadaşına geri gider. Bakiye borç silinmez.",
      "household",
      30,
      0,
      "",
      (next) => {
        closeHousehold(next, "Açıkça ayrılmayı kararlaştırdınız", api);
        return "Ortak yaşam hesabı kapatıldı; artık bağımsız taşınabilirsin.";
      },
    );
    if (h.status === "notice")
      add(
        "household:reconcile",
        "Ayrılma bildirimini birlikte yeniden görüş",
        "Bakım yapılmış, gerilim30’un altında ve güven 45 olmalı; karşılıklı hazır oluş gerekir.",
        "household",
        45,
        0,
        h.tension >= 30 || h.playerDue <= d || relation(s, h.memberId).trust < 45
          ? "Önce sorumluluğunu tamamla ve güveni onar."
          : availability(s, h.memberId, 45),
        (next) => {
          next.life.household.status = "active";
          next.life.household.noticeDay = 0;
          next.life.household.playerMissed = 0;
          remember(
            next,
            h.memberId,
            "Somut bakım ve güven toparlanınca ortak yaşamı sürdürmeyi kabul ettim.",
            api,
          );
          return "Ev arkadaşın somut değişiklik üzerine kalmayı kabul etti.";
        },
        h.memberId,
      );
  }
  for (const [id, amount] of Object.entries(s.life.obligations))
    if (amount > 0)
      add(
        `household:collect:${id}`,
        `${names(id)} · gecikmiş gider payını iste`,
        `${amount} TL yükümlülük; sadece gerçekten mevcut parası kadar tahsil edilir, geçim için 600 TL bırakılır.`,
        "household",
        15,
        0,
        person(s, id).cash <= 600 ? "Karşı tarafın şu an ödeyebileceği nakit yok." : "",
        (next) => {
          const x = person(next, id),
            paid = Math.min(next.life.obligations[id], x.cash - 600);
          x.cash -= paid;
          next.life.obligations[id] -= paid;
          api.receive(next, paid, "Ev arkadaşının gecikmiş gider payı", "bank");
          return `${paid} TL gerçek ödeme alındı.`;
        },
        id,
      );
  const l = s.life.lease;
  if (s.housing.rent) {
    add(
      "lease:renew",
      "Kira dönemini açıkça yenile",
      "600 TL görüşme ve kayıt gideri; yeni semt kira koşulu uygulanır ve60 gün aylık artıştan korunursun. Depozito tekrar alınmaz.",
      "household",
      60,
      600,
      s.location !== find(HOMES, s.housing.id).district
        ? "Kendi ev semtine git."
        : l.status !== "renewal"
          ? "Yenileme dönemi henüz gelmedi."
          : s.housing.arrears
            ? "Önce kira birikimini çöz veya ödeme planını tamamla."
            : "",
      (next) => {
        next.housing.rent = money(
          (next.housing.rent *
            getDistrictEffects(next, find(HOMES, next.housing.id).district).rentPct) /
            100,
        );
        const lease = next.life.lease;
        lease.status = "current";
        lease.renewDay = d + 60;
        lease.stabilityUntil = d + 60;
        lease.history.push({
          day: d,
          text: `Aylık kira ${next.housing.rent} TL olarak60 gün için yenilendi; depozito korundu.`,
        });
        lease.history = lease.history.slice(-12);
        api.document(
          next,
          `renewal-${next.revision}`,
          "Kira dönemi yenilemesi",
          `Aynı konutta kira ${next.housing.rent} TL;${d + 60}.güne kadar aylık artış yok.`,
        );
        return "Sözleşme yeni koşullarıyla kaydedildi.";
      },
    );
    if (s.housing.arrears)
      add(
        "lease:plan",
        "Kira birikimi için somut plan görüş",
        "150 TL görüşme,60 dk. Mevcut birikimin yaklaşık dörtte biri haftalık taksit olur; iki karşılanamayan taksit son bildirim aşamasına döner. Borç yeniden eklenmez.",
        "household",
        60,
        150,
        l.plan
          ? "Zaten geçerli bir kira ödeme planın var."
          : l.lastReviewDay && d - l.lastReviewDay < 14
            ? "Yeni bir plan için14 gün ara gerekir."
            : "",
        (next) => {
          const lease = next.life.lease;
          lease.plan = {
            installment: Math.max(100, Math.ceil(next.housing.arrears / 4)),
            nextDay: d + 7,
            missed: 0,
          };
          lease.stage = "plan";
          lease.dueDay = d + 7;
          lease.lastReviewDay = d;
          lease.history.push({
            day: d,
            text: "Mevcut kira birikimi için haftalık taksit planı kabul edildi.",
          });
          lease.history = lease.history.slice(-12);
          return "Yeni borç oluşmadı; gerçek kira birikimine bağlı ödeme planı kuruldu.";
        },
      );
  }
  if (s.job) {
    const j = find(JOBS, s.job.id),
      e = s.life.employers[j.id],
      terms = getLifeWorkTerms(s);
    add(
      "career:needs",
      "İşverenin güncel ihtiyacını karşıla",
      `${find(SKILLS, e.needSkill).name}${e.needLevel} gerekir;90 dk somut hazırlık. Performans+5, mesleki itibar+3;14 günde bir.`,
      "work",
      90,
      0,
      s.location !== j.district
        ? "İş semtine git."
        : s.player.skills[e.needSkill] < e.needLevel
          ? "Güncel uzmanlık eşiğini karşılamıyorsun."
          : e.lastReviewDay && d - e.lastReviewDay < 14
            ? "İhtiyaç görüşmesinden14 gün geçmeli."
            : "",
      (next) => {
        next.life.employers[j.id].lastReviewDay = d;
        next.job.performance = cap(next.job.performance + 5);
        next.deep.career.reputation = cap(next.deep.career.reputation + 3);
        api.change(next, { energy: -8, stress: 3 });
        return "Beceriye dayalı işveren ihtiyacı somut çalışmayla karşılandı.";
      },
    );
    add(
      "career:workload:extended",
      "Ücret karşılığı ek çalışma yükünü kabul et",
      `Her gerçek vardiya+60 dk,+${Math.round(j.wage * 0.15)} TL ve+5stres. İşverenin yoğun dönemi ve performans 60 gerekir; mevcut takvim vardiyaları yeniden planlanmalıdır.`,
      "work",
      30,
      0,
      terms.extraMinutes
        ? "Zaten ek çalışma sözleşmesi var."
        : e.workload !== "busy"
          ? "İşverenin şu an ek çalışma ihtiyacı yok."
          : s.job.performance < 60
            ? "Performans 60 gerekir."
            : "",
      (next) => {
        const x = next.life.employers[j.id];
        x.contractKey = jobKey(next);
        x.extraMinutes = 60;
        x.bonus = Math.round(j.wage * 0.15);
        x.stress = 5;
        x.history.push({
          day: d,
          text: "Daha yüksek kazanılmış ücret karşılığında 60 dk ek vardiya kabul edildi.",
        });
        x.history = x.history.slice(-12);
        return "Ek süre açıkça kabul edildi; yalnız tamamlanan vardiya kazanır.";
      },
    );
    add(
      "career:workload:standard",
      "Standart vardiya süresine dön",
      "Ek süre ve ek ücret birlikte kalkar; kazanılmış önceki ücret korunur. Takvimde eski süreyi yeniden planla.",
      "work",
      30,
      0,
      !terms.extraMinutes ? "Zaten standart vardiyada çalışıyorsun." : "",
      (next) => {
        const x = next.life.employers[j.id];
        x.extraMinutes = 0;
        x.bonus = 0;
        x.stress = 0;
        x.history.push({
          day: d,
          text: "Ek çalışma yükü ve sonraki vardiyaların primi birlikte kaldırıldı.",
        });
        x.history = x.history.slice(-12);
        return "Standart vardiya koşullarına döndün.";
      },
    );
  }
  return out;
}
export function lifeActions(s, api) {
  return actionList(s, api);
}
export function adaptLifeActions(s, actions, api) {
  if (!s.life) return actions;
  return actions.map((original) => {
    const a = { ...original };
    if (a.id === "work" && s.job) {
      const terms = getLifeWorkTerms(s),
        run = a.run;
      a.minutes += terms.extraMinutes;
      a.description += terms.extraMinutes
        ? ` Kabul edilmiş ek süre ${terms.extraMinutes} dk; gerçek vardiyaya +${terms.bonus} TL, +${terms.stress} stres.`
        : "";
      a.run = (next) => {
        const text = run(next);
        if (terms.bonus && next.job) {
          next.job.earned = money(next.job.earned + terms.bonus);
          api.record(next, "Ek çalışma sözleşmesi · tamamlanan vardiya", terms.bonus, "earned");
          api.change(next, { stress: terms.stress });
        }
        return text;
      };
      if ((s.time % DAY) + a.minutes > 1440 && !a.disabled) {
        a.disabled = true;
        a.reason = "Bu vardiya gün bitmeden tamamlanamaz.";
      }
    }
    if (a.id.startsWith("move:")) {
      const target = find(HOMES, a.id.slice(5));
      if (s.life.household) {
        a.disabled = true;
        a.reason = "Önce ortak yaşam sözleşmesini ve depozitoyu açıkça kapat.";
      }
      if (target?.rent) {
        const rate = getDistrictEffects(s, target.district).rentPct,
          newRent = Math.round((target.rent * rate) / 100),
          run = a.run;
        a.cost = newRent + target.deposit + 300;
        if (available(s) < a.cost) {
          a.disabled = true;
          a.reason = `Yeni semt koşullarıyla${a.cost} TL gerekir.`;
        }
        a.description += ` Güncel semt kira katsayısı%${rate}; yeni aylık kira ${newRent} TL.`;
        a.run = (next) => {
          const text = run(next);
          next.housing.rent = newRent;
          const doc = next.documents.find((d) => d.id === `lease-move-${next.revision}`);
          if (doc)
            doc.text = `30 günlük kira ${newRent} TL; depozito ${next.housing.deposit} TL; sonraki vade gün ${next.housing.dueDay}.`;
          return text + ` Güncel semt koşuluyla kira ${newRent} TL.`;
        };
      }
    }
    return a;
  });
}
export function afterLifeAction(s, id, before, api) {
  if (!s.life) return;
  syncLifeHousing(s, api);
  const contact =
    /^(?:(?:talk|call|date|mentor):|deep:disclose:|life:(?:talk|call|colleague):|calendar:meeting:)([^:]+)$/.exec(
      id,
    )?.[1];
  if (contact && person(s, contact)) context(s, contact).knownWork = person(s, contact).work;
  if (id === "work" && s.job) {
    const workplace = find(JOBS, s.job.id).district;
    for (const n of NPCS) {
      const observed = before.living.npcs[n.id].plan.some(
        (p) =>
          p.kind === "work" &&
          p.status === "planned" &&
          p.location === workplace &&
          p.start < s.time &&
          before.time < p.end,
      );
      if (observed && s.deep.npcs[n.id].work === workplace) context(s, n.id).knownWork = workplace;
    }
  }
  if (!s.deep.business) s.life.businessKey = "";
  else if (
    id.startsWith("business:start:") ||
    !s.life.businessKey.startsWith(`${s.deep.business.id}:${s.deep.business.openedDay}:`)
  )
    s.life.businessKey = rawBusinessKey(s);
  if (s.job) {
    const e = s.life.employers[s.job.id];
    if (id.startsWith("apply:") || e.contractKey !== jobKey(s)) {
      e.contractKey = rawJobKey(s);
      e.extraMinutes = 0;
      e.bonus = 0;
      e.stress = 0;
    }
  }
  if (id === "work" && s.flags.workDays >= 3) promote(s, "colleague", s.location, api);
  if (id === "business:serve" && s.deep.business?.clients >= 2)
    promote(s, "customer", s.deep.business.location, api);
  if (
    (id.startsWith("visit:") || id === "volunteer") &&
    (s.city.visits[s.location] >= 3 || s.flags.volunteers >= 2)
  )
    promote(s, "neighbor", s.location, api);
}
export function lifeSignals(s) {
  if (!s.life) return {};
  const h = s.life.household,
    l = s.life.lease;
  return {
    household: {
      active: !!h,
      contractKey: h?.id || "",
      actorId: h?.memberId || "",
      missedChores: h?.playerMissed || 0,
      unpaidShare: h ? s.life.obligations[h.memberId] || 0 : 0,
      homeKey: homeKey(s),
    },
    lease: { homeKey: l.homeKey, status: l.status, disputeStage: l.stage, renewAt: l.renewDay },
    district: { ...getDistrictEffects(s, s.location) },
    career: {
      contractKey: jobKey(s),
      extraMinutes: getLifeWorkTerms(s).extraMinutes,
      employerNeed: s.job ? s.life.employers[s.job.id].workload : "",
    },
    secondary: { knownIDs: s.life.secondary.map((n) => n.id) },
  };
}
export function getLifeView(s) {
  if (!s.life) return null;
  const descriptors = actionList(s, {}),
    ids = (filter) => descriptors.filter(filter).map((a) => a.id),
    h = s.life.household,
    l = s.life.lease,
    terms = getLifeWorkTerms(s);
  return {
    household: {
      active: !!h,
      title: "Paylaşılan yaşam",
      status: h
        ? h.status === "notice"
          ? "Ayrılma bildirimi"
          : "Etkin sözleşme"
        : "Henüz sözleşme yok",
      memberName: h ? names(h.memberId) : "",
      rentShare: h ? Math.floor((s.housing.rent * h.share) / 100) : 0,
      utilityShare: h ? Math.floor((900 * h.share) / 100) : 0,
      deposit: h?.deposit || 0,
      unpaidShare: h ? s.life.obligations[h.memberId] || 0 : 0,
      chores: h
        ? find(HOUSEHOLD_PLANS, h.plan).description
        : "Komşuluk ve karşılıklı güven kurulunca gider ve sorumluluklar paylaşılabilir.",
      playerDue: h?.playerDue || 0,
      memberDue: h?.memberDue || 0,
      noticeDay: h?.noticeDay || 0,
      history: h?.history.map((x) => ({ ...x })) || [],
      actionIds: ids(
        (a) => a.id.startsWith("household:") && !a.id.startsWith("household:collect:"),
      ),
    },
    lease: {
      title: "Kira sözleşmesi ve uyuşmazlık",
      status: l.status === "renewal" ? "Yenileme bekliyor" : "Güncel",
      stage: l.stage,
      rent: s.housing.rent,
      renewDay: l.renewDay,
      dueDay: l.dueDay,
      arrears: s.housing.arrears,
      planLabel: l.plan
        ? `Haftalık ${l.plan.installment} TL; sonraki gün ${l.plan.nextDay}.`
        : "Aktif taksit planı yok.",
      history: l.history.map((x) => ({ ...x })),
      actionIds: ids((a) => a.id.startsWith("lease:")),
    },
    secondary: s.life.secondary.map((n) => ({
      id: n.id,
      name: names(n.id),
      role: find(SOCIAL_ROLES, n.role).label,
      home: n.known.home,
      profession: n.known.profession,
      goal: `${n.goal}. ${n.preference === "quiet" ? "Düzenli ev ister; ortak yaşamda biriken gerilime daha erken sınır koyar." : n.preference === "reliable" ? "Düzenli mesleği için haftalık beceri çalışmasına daha çok zaman ve para ayırır." : "Sipariş vermeden önce işletmede en az 35 itibar arar."}`,
      availability: secondaryBusy(s, n) || "Görüşmeye uygun; bulunduğu semte git.",
      trust: n.relation.trust,
      familiarity: n.relation.affinity,
      conflict: n.relation.conflict,
      reciprocity: n.context.reciprocity,
      history: n.history.map((x) => ({ ...x })),
      actionIds: ids((a) => a.npcId === n.id && !a.id.startsWith("household:")),
    })),
    relationships: NPCS.map((n) => ({
      id: n.id,
      name: n.name,
      roles: rolesFor(s, n.id).map((id) => ({ ...find(SOCIAL_ROLES, id) })),
      trust: s.npcs[n.id].trust,
      familiarity: s.npcs[n.id].affinity,
      conflict: s.deep.npcs[n.id].resentment,
      reciprocity: s.life.relations[n.id].reciprocity,
      history: s.life.relations[n.id].history.map((x) => ({ ...x })),
      actionIds: ids((a) => a.npcId === n.id && a.id.startsWith("life:")),
    })),
    districts: DISTRICTS.map((d) => {
      const x = getDistrictEffects(s, d.id),
        p = DISTRICT_PHASES[x.phase];
      return {
        id: d.id,
        name: d.name,
        ...x,
        label: p.label,
        description: p.description,
        effects: [
          `Yolculuk +${x.travelDelay} dk`,
          `Hizmet bedeli %${x.servicePct}`,
          `Yeni kira %${x.rentPct}`,
          `İş ihtiyacı ${x.jobDemand}/100`,
        ],
      };
    }),
    employer: s.job
      ? {
          name: find(EMPLOYERS, s.job.id).name,
          need: `${find(SKILLS, s.life.employers[s.job.id].needSkill).name}${s.life.employers[s.job.id].needLevel}`,
          workload: { busy: "Yoğun", quiet: "Sakin", balanced: "Dengeli" }[
            s.life.employers[s.job.id].workload
          ],
          terms: terms.extraMinutes ? "Açıkça kabul edilmiş ek çalışma" : "Standart vardiya",
          bonus: terms.bonus,
          extraMinutes: terms.extraMinutes,
          reviewDay: s.life.employers[s.job.id].reviewDay,
          history: s.life.employers[s.job.id].history.map((x) => ({ ...x })),
          actionIds: ids((a) => a.id.startsWith("career:")),
        }
      : null,
    obligations: Object.entries(s.life.obligations)
      .filter(([, v]) => v > 0)
      .map(([id, amount]) => ({
        id,
        name: names(id),
        amount,
        actionIds: [`household:collect:${id}`],
      })),
    summary: `12 önemli kişi, ${s.life.secondary.length}/6 kalıcı yeni tanıdık. Arka plan nüfusuyla toplam korunur; hukuk ve ekonomi oyun soyutlamalarıdır.`,
  };
}

const plain = (x) =>
  x && typeof x === "object" && !Array.isArray(x) && Object.getPrototypeOf(x) === Object.prototype;
const exact = (x, keys) =>
  plain(x) &&
  Object.keys(x).length === keys.split(" ").length &&
  keys.split(" ").every((k) => Object.hasOwn(x, k));
const int = (v, min = 0, max = MAX) => Number.isSafeInteger(v) && v >= min && v <= max;
const text = (v, max = 300) => typeof v === "string" && v.length <= max;
const history = (xs, s, max = 12) =>
  Array.isArray(xs) &&
  xs.length <= max &&
  xs.every((x) => exact(x, "day text") && int(x.day, 1, day(s)) && text(x.text, 500));
const districtId = (id) => DISTRICTS.some((d) => d.id === id);
function validContext(c, s) {
  return (
    exact(c, "knownWork reciprocity lastActions order history") &&
    districtId(c.knownWork) &&
    int(c.reciprocity, -100, 100) &&
    exact(c.lastActions, "colleague neighbor friend customer romance disclose") &&
    Object.values(c.lastActions).every((v) => int(v, 0, day(s))) &&
    history(c.history, s) &&
    (c.order === null ||
      (exact(c.order, "businessKey price dueDay status extended") &&
        text(c.order.businessKey, 150) &&
        int(c.order.price, 1, 2000) &&
        int(c.order.dueDay, 1, day(s) + 6) &&
        ["open", "late"].includes(c.order.status) &&
        typeof c.order.extended === "boolean"))
  );
}
export function validateLife(s) {
  try {
    const l = s.life;
    if (
      !exact(
        l,
        "version initializedAt lastDay businessKey secondary promotion relations household obligations lease districts employers history",
      ) ||
      l.version !== 1 ||
      !int(l.initializedAt, 0, s.time) ||
      !int(l.lastDay, 1, day(s)) ||
      !Array.isArray(l.secondary) ||
      l.secondary.length > 6 ||
      new Set(l.secondary.map((n) => n.id)).size !== l.secondary.length ||
      !exact(l.promotion, "lastDay") ||
      !int(l.promotion.lastDay, 0, day(s)) ||
      !exact(l.relations, NPCS.map((n) => n.id).join(" ")) ||
      !Object.values(l.relations).every((c) => validContext(c, s)) ||
      !history(l.history, s, 48)
    )
      return false;
    for (const n of l.secondary) {
      const template = find(SECONDARY_PEOPLE, n.id);
      if (
        !template ||
        !exact(
          n,
          "id role sourceCohort sourceDistrict promotedAt home work profession employment cash savings debt wage rent skill lastDay lastJobDay goal preference relation context known facts history move busyUntil",
        ) ||
        n.role !== template.role ||
        n.sourceCohort !== template.cohort ||
        n.sourceDistrict !== template.district ||
        !int(n.promotedAt, l.initializedAt, s.time) ||
        ![n.home, n.work].every(districtId) ||
        !text(n.profession, 100) ||
        !["employed", "studying", "searching"].includes(n.employment) ||
        !["cash", "savings", "debt", "wage", "rent"].every((k) => int(n[k])) ||
        !int(n.skill, 0, 100) ||
        !int(n.lastDay, 1, day(s)) ||
        !int(n.lastJobDay, 1, day(s)) ||
        n.goal !== template.goal ||
        n.preference !== template.preference ||
        !exact(n.relation, "trust affinity conflict") ||
        !Object.values(n.relation).every((v) => int(v, 0, 100)) ||
        !validContext(n.context, s) ||
        !exact(n.known, "home profession") ||
        !districtId(n.known.home) ||
        !text(n.known.profession, 100) ||
        !Array.isArray(n.facts) ||
        n.facts.length > 8 ||
        !n.facts.every(
          (f) =>
            exact(f, "id value day source") &&
            ["career", "systemic"].includes(f.id) &&
            text(f.value, 100) &&
            int(f.day, 1, day(s)) &&
            f.source === (f.id === "career" ? "Doğrudan anlattın" : "Doğrudan gönderdiğin plan"),
        ) ||
        !history(n.history, s) ||
        !int(n.busyUntil, 0, s.time + 90) ||
        !(
          n.move === null ||
          (exact(n.move, "from to end") &&
            districtId(n.move.from) &&
            districtId(n.move.to) &&
            n.home === n.move.from &&
            n.move.from !== n.move.to &&
            int(n.move.end, s.time + 1, s.time + 120))
        )
      )
        return false;
    }
    if (
      !text(l.businessKey, 150) ||
      (s.deep.business
        ? !l.businessKey.startsWith(`${s.deep.business.id}:${s.deep.business.openedDay}:`)
        : l.businessKey !== "")
    )
      return false;
    const actors = allActors(s);
    if (
      !plain(l.obligations) ||
      Object.keys(l.obligations).length > 18 ||
      !Object.entries(l.obligations).every(([id, v]) => actors.includes(id) && int(v))
    )
      return false;
    const h = l.household;
    if (h !== null) {
      if (
        !exact(
          h,
          "id homeKey homeId district memberId formedAt status plan share deposit playerDue memberDue playerMissed memberMissed tension noticeDay memberTaskEnd billRecords history",
        ) ||
        !/^household-\d+$/.test(h.id) ||
        h.homeKey !== homeKey(s) ||
        h.homeId !== s.housing.id ||
        h.homeId === "shelter" ||
        h.district !== find(HOMES, s.housing.id).district ||
        !actors.includes(h.memberId) ||
        !int(h.formedAt, l.initializedAt, s.time) ||
        !["active", "notice"].includes(h.status) ||
        !find(HOUSEHOLD_PLANS, h.plan) ||
        h.share !== find(HOUSEHOLD_PLANS, h.plan).share ||
        !int(h.deposit, 0, 2500) ||
        !int(h.playerDue, 1, day(s) + 10) ||
        !int(h.memberDue, 1, day(s) + 10) ||
        !int(h.playerMissed, 0, 10000) ||
        !int(h.memberMissed, 0, 10000) ||
        !int(h.tension, 0, 100) ||
        !int(h.noticeDay, 0, day(s) + 7) ||
        !int(h.memberTaskEnd, 0, s.time + 60) ||
        !Array.isArray(h.billRecords) ||
        h.billRecords.length > 24 ||
        new Set(h.billRecords.map((b) => b.key)).size !== h.billRecords.length ||
        !h.billRecords.every((b) => exact(b, "key paid") && text(b.key, 150) && int(b.paid)) ||
        !history(h.history, s)
      )
        return false;
    }
    const lease = l.lease;
    if (
      !exact(
        lease,
        "homeKey renewDay stabilityUntil status stage dueDay plan lastArrears lastReviewDay history",
      ) ||
      lease.homeKey !== homeKey(s) ||
      !int(lease.renewDay, 1, day(s) + 60) ||
      !int(lease.stabilityUntil, 0, day(s) + 60) ||
      !["current", "renewal"].includes(lease.status) ||
      !["clear", "warning", "negotiation", "plan", "notice"].includes(lease.stage) ||
      !int(lease.dueDay, 0, day(s) + 14) ||
      !int(lease.lastArrears) ||
      !int(lease.lastReviewDay, 0, day(s)) ||
      !history(lease.history, s) ||
      !(
        lease.plan === null ||
        (exact(lease.plan, "installment nextDay missed") &&
          int(lease.plan.installment, 100) &&
          int(lease.plan.nextDay, 1, day(s) + 7) &&
          int(lease.plan.missed, 0, 1))
      )
    )
      return false;
    if (
      !exact(l.districts, DISTRICTS.map((d) => d.id).join(" ")) ||
      !exact(l.employers, JOBS.map((j) => j.id).join(" "))
    )
      return false;
    for (const x of Object.values(l.districts))
      if (
        !exact(x, "phase untilDay travelDelay servicePct rentPct demandDelta jobDemand revision") ||
        !Object.hasOwn(DISTRICT_PHASES, x.phase) ||
        !int(x.untilDay, 1, day(s) + 14) ||
        !int(x.travelDelay, 0, 20) ||
        !int(x.servicePct, 80, 120) ||
        !int(x.rentPct, 80, 120) ||
        !int(x.demandDelta, -15, 15) ||
        !int(x.jobDemand, 0, 100) ||
        !int(x.revision)
      )
        return false;
    for (const [id, e] of Object.entries(l.employers))
      if (
        !exact(
          e,
          "needSkill needLevel workload contractKey extraMinutes bonus stress reviewDay lastReviewDay history",
        ) ||
        e.needSkill !== find(JOBS, id).skill ||
        !int(e.needLevel, 0, 100) ||
        !["balanced", "busy", "quiet"].includes(e.workload) ||
        !text(e.contractKey, 150) ||
        ![0, 60].includes(e.extraMinutes) ||
        !int(e.bonus, 0, Math.round(find(JOBS, id).wage * 0.15)) ||
        ![0, 5].includes(e.stress) ||
        (e.extraMinutes === 0
          ? e.bonus !== 0 || e.stress !== 0
          : e.bonus !== Math.round(find(JOBS, id).wage * 0.15) || e.stress !== 5) ||
        !int(e.reviewDay, 1, day(s) + 14) ||
        !int(e.lastReviewDay, 0, day(s)) ||
        !history(e.history, s)
      )
        return false;
    return true;
  } catch {
    return false;
  }
}
