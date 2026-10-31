import { NPCS, JOBS, DISTRICTS, COURSES, SKILLS } from "./content.mjs";
import {
  DISTRICT_RULES,
  EMPLOYERS,
  NPC_PROFILES,
  FREELANCE_BRIEFS,
  BUSINESS_TYPES,
} from "./deep-content.mjs";
const find = (list, id) => list.find((x) => x.id === id);
const cap = (n, min = 0, max = 100) => Math.min(max, Math.max(min, n));
const amount = (n) => Math.round(cap(n, 0, 1_000_000_000));
const day = (s) => Math.floor(s.time / 1440) + 1;
const minute = (s) => s.time % 1440;
const funds = (s) => s.cash + s.bank;
const npcName = (id) => find(NPCS, id)?.name || id;
const districtName = (id) => find(DISTRICTS, id)?.name || id;
const offDay = (d, index) => (d - 1) % 7 === index % 7 || (d - 1) % 7 === (index + 1) % 7;
const npcChange = (s, id, text) => {
  const n = s.deep.npcs[id];
  n.changes.push({ day: day(s), text });
  n.changes = n.changes.slice(-12);
};
const roles = [
  "Kafe ekip sorumlusu",
  "Usta teknisyen",
  "Teknik ekip lideri",
  "Kültür programcısı",
  "Klinik ekip sorumlusu",
  "Bağımsız tasarım danışmanı",
  "Topluluk koordinatörü",
  "Finans operasyon uzmanı",
  "Eğitim programcısı",
  "Bölge mağaza sorumlusu",
  "Konut işletme sorumlusu",
  "Proje planlama uzmanı",
];
export function initDeep(s) {
  const d = day(s);
  s.deep = {
    version: 1,
    initializedDay: d,
    lastProcessedDay: d,
    npcs: Object.fromEntries(
      NPCS.map((n, i) => [
        n.id,
        {
          home: n.home,
          work: n.work,
          profession: n.role,
          employer: `${districtName(n.work)} · ${n.role}`,
          employment: "employed",
          salary: NPC_PROFILES[i].salary,
          cash: 1700 + i * 210,
          savings: 3000 + i * 370,
          debt: i % 4 === 1 ? 1800 : 0,
          rent: NPC_PROFILES[i].rent,
          tenure: 0,
          skill: 24 + (i % 5) * 4,
          level: 0,
          priority: NPC_PROFILES[i].priority,
          goalProgress: 0,
          respect: cap(s.npcs[n.id].trust / 2),
          resentment: 0,
          knownFacts: [],
          ties: {
            [NPCS[(i + 1) % NPCS.length].id]: 32 + (i % 5) * 5,
            [NPCS[(i + 5) % NPCS.length].id]: 20 + (i % 4) * 6,
          },
          changes: [],
          lastHelpDay: 0,
          lastDisclosureDay: 0,
          lastPromiseDay: 0,
          lastMoveDay: 0,
          lastJobChangeDay: 0,
          jobSearchDays: 0,
          request: null,
        },
      ]),
    ),
    career: {
      reputation: cap(20 + (s.job?.level || 0) * 10),
      employerJobId: s.job?.id || null,
      negotiatedBonus: 0,
      negotiatedDay: 0,
      noticeDay: 0,
      lastReviewDay: 0,
      experience: Object.fromEntries(
        JOBS.map((j) => [j.id, s.job?.id === j.id ? s.job.shifts : 0]),
      ),
    },
    finance: { reserve: 0, autoPay: true, debtPlan: null, bills: [] },
    business: null,
    freelance: { active: null, completed: 0, reputation: 20, lastAcceptedDay: 0 },
    promises: [],
    routine: {
      settings: { work: true, study: true, shopping: true },
      budgetFloor: 300,
      stopReason: "Henüz çalıştırılmadı.",
      lastRun: 0,
      lastActions: [],
    },
  };
  return s;
}
export function reveal(s, npcId, factId, value, source = "Doğrudan anlattın") {
  if (!s.deep?.npcs[npcId]) return;
  const n = s.deep.npcs[npcId];
  const fact = {
    id: String(factId).slice(0, 80),
    value: String(value).slice(0, 300),
    day: day(s),
    source: String(source).slice(0, 100),
  };
  const old = n.knownFacts.findIndex((f) => f.id === fact.id);
  if (old >= 0) n.knownFacts.splice(old, 1);
  n.knownFacts.push(fact);
  n.knownFacts = n.knownFacts.slice(-24);
}
export function deepNpcLocation(s, id) {
  if (!s.deep) return null;
  const i = NPCS.findIndex((n) => n.id === id),
    n = s.deep.npcs[id];
  if (!n) return null;
  const m = minute(s),
    d = day(s),
    base = NPCS[i];
  if (m < 540 || m >= 1260) return n.home;
  if (n.employment === "searching" && m < 1020) return "sisli";
  if (offDay(d, i)) return m < 1080 ? base.leisure : n.home;
  return m < 1020 ? n.work : base.leisure;
}
function settleNpc(s, id, index, api) {
  const n = s.deep.npcs[id],
    d = day(s),
    p = NPC_PROFILES[index],
    prior = d - 1;
  if (n.employment === "employed" && !offDay(prior, index)) {
    n.cash = amount(n.cash + n.salary);
    n.tenure++;
  }
  const living = 180 + Math.round(n.rent / 30);
  const paid = Math.min(n.cash, living);
  n.cash -= paid;
  n.debt = amount(n.debt + living - paid);
  if (n.debt && n.cash > 1000) {
    const repayment = Math.min(n.debt, 250, n.cash - 700);
    n.cash -= repayment;
    n.debt -= repayment;
  }
  if (n.cash > 3500) {
    const saved = Math.min(600, n.cash - 2500);
    n.cash -= saved;
    n.savings = amount(n.savings + saved);
  }
  if ((d + index) % 7 === 0) {
    const fee = 90;
    if (n.cash >= fee) {
      n.cash -= fee;
      n.skill = cap(n.skill + 2);
      npcChange(s, id, `Mesleki çalışmaya ${fee} TL ayırdı; becerisi ${n.skill} oldu.`);
    }
    for (const otherId of Object.keys(n.ties)) {
      const other = s.deep.npcs[otherId];
      const nearby = n.home === other.home || n.work === other.work;
      n.ties[otherId] = cap(n.ties[otherId] + (nearby ? 3 : -1));
      if (nearby && n.ties[otherId] >= 45 - find(DISTRICT_RULES, n.work).socialRisk) {
        const learned = other.knownFacts.at(-1);
        if (learned && !n.knownFacts.some((f) => f.id === learned.id && f.day >= learned.day))
          reveal(s, id, learned.id, learned.value, `${npcName(otherId)} anlattı`);
      }
    }
  }
  if (
    n.employment === "employed" &&
    n.level < 2 &&
    n.tenure >= 14 &&
    n.skill >= 28 + n.level * 10 &&
    p.priority === "career"
  ) {
    n.level++;
    n.salary = Math.round(n.salary * 1.1);
    n.work = DISTRICTS[(index + n.level) % 3].id;
    n.profession = roles[index];
    n.employer = `${districtName(n.work)} · ${n.level === 1 ? "Yeni ekip" : "Kıdemli ekip"}`;
    n.lastJobChangeDay = d;
    n.tenure = 0;
    const text = `${n.profession} olarak ${districtName(n.work)}’ta yeni işe geçti; günlük ücreti ${n.salary} TL.`;
    npcChange(s, id, text);
    api.memory(s, id, text);
    if (s.npcs[id].affinity >= 15) api.news(s, `${npcName(id)}: ${text}`);
  }
  if (n.employment === "employed" && (d + index * 5) % 67 === 0 && d > s.deep.initializedDay + 14) {
    n.employment = "searching";
    n.jobSearchDays = 0;
    n.lastJobChangeDay = d;
    const text = "İş sözleşmesi kapandı; yeni iş arıyor ve birikimini kullanıyor.";
    npcChange(s, id, text);
    api.memory(s, id, text);
    if (s.npcs[id].affinity >= 15) api.news(s, `${npcName(id)}: ${text}`);
  }
  if (n.employment === "searching") {
    n.jobSearchDays++;
    if (n.jobSearchDays >= 4 + (index % 3)) {
      n.employment = "employed";
      n.work = DISTRICTS[(index + Math.floor(d / 30)) % 3].id;
      n.employer = `${districtName(n.work)} · Yeni bağlantı`;
      n.tenure = 0;
      n.lastJobChangeDay = d;
      n.salary = Math.round(n.salary * 0.98);
      npcChange(s, id, `İş arayışı sonuçlandı; ${districtName(n.work)}’ta yeni sözleşme imzaladı.`);
    }
  }
  if (
    p.priority === "home" &&
    n.savings >= 12000 &&
    d - n.lastMoveDay >= 30 &&
    d > s.deep.initializedDay + 14
  ) {
    const destination = DISTRICTS[(DISTRICTS.findIndex((x) => x.id === n.home) + 1) % 3].id;
    n.savings -= 4500;
    n.home = destination;
    n.rent = Math.max(3500, n.rent - 300);
    n.lastMoveDay = d;
    const text = `${districtName(destination)}’a taşındı; 4.500 TL taşınma/depozito ayırdı, aylık gideri ${n.rent} TL.`;
    npcChange(s, id, text);
    api.memory(s, id, text);
    if (s.npcs[id].affinity >= 15) api.news(s, `${npcName(id)}: ${text}`);
  }
  n.goalProgress = cap(
    p.priority === "career"
      ? n.level * 35 + n.tenure
      : p.priority === "home"
        ? (n.lastMoveDay ? 55 : 0) + n.savings / 500
        : p.priority === "security"
          ? (n.savings - n.debt) / 250
          : Object.values(n.ties).reduce((a, b) => a + b, 0) / 2,
  );
  if (!n.request && (d + index) % 14 === 0) {
    n.request = { kind: n.cash < 600 ? "loan" : "help", sinceDay: d, deadlineDay: d + 4 };
    npcChange(
      s,
      id,
      n.request.kind === "loan"
        ? "Nakit sıkışıklığı için destek arıyor."
        : "Kendi hedefi için iki saatlik yardıma ihtiyaç duyuyor.",
    );
    if (s.npcs[id].affinity >= 15)
      api.news(s, `${npcName(id)} senden haber bekliyor: telefonunda destek talebi var.`);
  }
  if (n.request && d > n.request.deadlineDay) n.request = null;
  // Only known, expressly shared facts drive expectations about the player.
  const knownWork = n.knownFacts.find((f) => f.id === "career");
  if (
    knownWork &&
    p.sensitivity === "learning" &&
    d % 14 === index % 14 &&
    s.npcs[id].trust >= 35
  ) {
    n.respect = cap(n.respect + 1);
    api.memory(s, id, `Bana anlattığın meslek planını hatırlıyorum: ${knownWork.value}`);
  }
  if (n.resentment > 0 && d % 7 === index % 7) n.resentment = cap(n.resentment - 1);
}
export function deepDaily(s, api) {
  const d = day(s);
  if (!s.deep || s.deep.lastProcessedDay >= d) return;
  s.deep.lastProcessedDay = d;
  for (const [i, n] of NPCS.entries()) settleNpc(s, n.id, i, api);
  for (const promise of s.deep.promises) {
    if (
      promise.status !== "pending" ||
      (promise.direction === "npc" ? d < promise.dueDay : d <= promise.dueDay)
    )
      continue;
    const n = s.deep.npcs[promise.npcId],
      base = s.npcs[promise.npcId];
    if (promise.direction === "npc") {
      if (n.cash >= promise.amount + 200 && n.employment === "employed") {
        n.cash -= promise.amount;
        api.receive(s, promise.amount, `${npcName(promise.npcId)} · söz verilen destek`);
        promise.status = "kept";
        base.trust = cap(base.trust + 4);
        api.memory(s, promise.npcId, "Söz verdiğim desteği zamanında gönderdim.");
      } else {
        promise.status = "broken";
        base.trust = cap(base.trust - 6);
        api.memory(
          s,
          promise.npcId,
          "Kendi nakit sıkışıklığım nedeniyle söz verdiğim desteği gönderemedim.",
        );
      }
    } else {
      promise.status = "broken";
      base.trust = cap(base.trust - 10);
      base.affinity = cap(base.affinity - 5);
      n.resentment = cap(n.resentment + 12);
      n.respect = cap(n.respect - 5);
      reveal(
        s,
        promise.npcId,
        "promise",
        `${promise.dueDay}. gün yardım sözünü tutmadı`,
        "Verdiğin sözü kendim biliyorum",
      );
      api.memory(
        s,
        promise.npcId,
        "Yardım edeceğine söz verdin ama gelmedin. Beklentim karşılanmadı.",
      );
    }
    api.log(
      s,
      `${npcName(promise.npcId)}: ${promise.status === "kept" ? "destek sözü yerine geldi" : "bir söz tutulmadı"}.`,
    );
  }
  const f = s.deep.freelance;
  if (f.active && d > f.active.dueDay) {
    api.log(
      s,
      `${find(FREELANCE_BRIEFS, f.active.id).name}: teslim tarihi kaçtı. Masraflar iade edilmedi, serbest iş itibarı −8.`,
    );
    f.reputation = cap(f.reputation - 8);
    f.active = null;
  }
  const finance = s.deep.finance;
  for (const bill of finance.bills) {
    if (bill.status !== "due" || d <= bill.dueDay + 7) continue;
    bill.status = "overdue";
    if (bill.kind === "rent") s.housing.arrears = amount(s.housing.arrears + bill.amount);
    else if (bill.kind !== "debt") s.debt = amount(s.debt + bill.amount);
    api.record(
      s,
      bill.label + " · 7 gün gecikme",
      bill.amount,
      bill.kind === "rent" ? "arrears" : "debt",
    );
    api.log(
      s,
      `${bill.label} yedi gün ödenmedi; ${bill.kind === "rent" ? "kira birikimine" : "borç kaydına"} işlendi.`,
    );
  }
  const plan = finance.debtPlan;
  if (plan && d >= plan.nextDay) {
    const payment = Math.min(plan.weeklyPayment, s.debt);
    if (payment && finance.autoPay && funds(s) >= payment) {
      api.spend(s, payment, "Haftalık borç planı", "total");
      s.debt -= payment;
      api.record(s, "Planlı anapara ödemesi", -payment, "debt");
      plan.missed = 0;
    } else if (payment) {
      plan.missed++;
      if (!finance.autoPay) queueBill(s, payment, "Haftalık borç planı", "debt");
      api.log(s, "Borç planı ödemesi tamamlanmadı; finans panelini kontrol et.");
    }
    plan.nextDay += 7;
    if (!s.debt) finance.debtPlan = null;
    else if (plan.missed >= 2) {
      finance.debtPlan = null;
      api.log(s, "İki borç planı ödemesi aksadı. Plan kapandı; sonraki aylık faiz %3.");
    }
  }
  const b = s.deep.business;
  if (b) {
    if (d - Math.max(b.lastServiceDay, b.openedDay) >= 7 && d % 7 === 0)
      b.clients = Math.max(0, b.clients - 1);
    if (d >= b.nextOverheadDay) {
      if (b.accruedOverhead > 0) {
        const fee = Math.ceil(b.accruedOverhead);
        b.accruedOverhead = 0;
        b.costs = amount(b.costs + fee);
        if (funds(s) >= fee) api.spend(s, fee, "Mikro işletme · haftalık sabit gider", "total");
        else {
          const paid = funds(s);
          api.spend(s, paid, "Mikro işletme · kısmi gider", "total");
          b.arrears = amount(b.arrears + fee - paid);
          b.status = "paused";
          api.log(
            s,
            "İşletme gideri karşılanamadı. İşletme durdu; borcu ödemeden yeni müşteri hizmeti verilemez.",
          );
        }
      }
      b.nextOverheadDay += 7;
    }
  }
  if (s.deep.career.employerJobId && !s.job) {
    s.deep.career.reputation = cap(s.deep.career.reputation - 7);
    s.deep.career.employerJobId = null;
    s.deep.career.negotiatedBonus = 0;
  }
}
export function accrueDeepTime(s, minutes) {
  const b = s.deep?.business;
  if (b?.status === "active")
    b.accruedOverhead = Math.min(
      1_000_000_000,
      b.accruedOverhead + (businessOverhead(b) * minutes) / 10080,
    );
}
export function queueBill(s, value, label, kind) {
  const d = day(s);
  const id = `bill-${d}-${kind}-${s.deep.finance.bills.length}`;
  if (s.deep.finance.bills.some((b) => b.dueDay === d && b.kind === kind && b.status === "due"))
    return;
  s.deep.finance.bills.push({ id, label, amount: amount(value), dueDay: d, kind, status: "due" });
  s.deep.finance.bills = s.deep.finance.bills.slice(-24);
}
const businessOverhead = (b) =>
  Math.round(
    find(BUSINESS_TYPES, b.id).overhead *
      find(DISTRICT_RULES, b.location).overhead *
      (1 + (b.level - 1) * 0.25),
  );
export function afterDeepAction(s, actionId, before, api) {
  if (!s.deep) return;
  const career = s.deep.career,
    d = day(s);
  if (actionId.startsWith("travel:") || actionId.startsWith("walk:"))
    api.change(s, { stress: Math.floor(find(DISTRICT_RULES, s.location).socialRisk / 2) });
  if (actionId.startsWith("apply:")) {
    career.employerJobId = s.job.id;
    career.negotiatedBonus = 0;
    career.negotiatedDay = 0;
    career.noticeDay = 0;
    const e = find(EMPLOYERS, s.job.id);
    reveal(
      s,
      e.manager,
      "career",
      `${find(JOBS, s.job.id).name} sözleşmesi`,
      "İş görüşmesine katıldım",
    );
  }
  if (actionId === "work" && s.job) {
    const job = find(JOBS, s.job.id),
      e = find(EMPLOYERS, s.job.id);
    career.reputation = cap(career.reputation + 1);
    career.experience[s.job.id]++;
    if (career.negotiatedBonus) {
      s.job.earned = amount(s.job.earned + career.negotiatedBonus);
      api.record(s, "Müzakere edilmiş vardiya primi", career.negotiatedBonus, "earned");
    }
    reveal(
      s,
      e.manager,
      "attendance",
      `${d}. gün vardiya tamamlandı`,
      "İşverenin vardiya raporu bana ulaştı",
    );
    s.deep.npcs[e.manager].respect = cap(s.deep.npcs[e.manager].respect + 1);
    if (career.experience[job.id] % 5 === 0)
      for (const id of e.coworkers) {
        if (s.deep.npcs[id].employment !== "employed" || s.deep.npcs[id].work !== job.district)
          continue;
        s.npcs[id].affinity = cap(s.npcs[id].affinity + 2);
        api.memory(s, id, "Aynı çalışma çevresinde emeğini gördüm.");
      }
  }
  if (actionId === "resign") {
    const planned = career.noticeDay && day(before) >= career.noticeDay;
    career.reputation = cap(career.reputation + (planned ? 2 : -3));
    career.employerJobId = null;
    career.negotiatedBonus = 0;
    career.noticeDay = 0;
  }
  if (actionId === "study" && before.course) {
    const c = find(COURSES, before.course.id),
      rule = find(DISTRICT_RULES, s.location);
    if (c.skill === rule.skill) api.skill(s, c.skill, 1);
    if (!s.course) career.reputation = cap(career.reputation + 3);
  }
  if (actionId === "promote") career.reputation = cap(career.reputation + 5);
  const [type, id] = actionId.split(":");
  if (
    [
      "talk",
      "call",
      "gift",
      "apologize",
      "conflict",
      "date",
      "mentor",
      "partner",
      "breakup",
    ].includes(type) &&
    s.deep.npcs[id]
  ) {
    const n = s.deep.npcs[id],
      p = find(NPC_PROFILES, id);
    if (type === "talk") {
      reveal(s, id, "location", districtName(s.location), "Yüz yüze görüştük");
      if (p.sensitivity === "honesty") n.respect = cap(n.respect + 2);
    }
    if (type === "gift" && p.sensitivity === "help") n.respect = cap(n.respect + 1);
    if (type === "conflict") {
      n.resentment = cap(n.resentment + 8 + find(DISTRICT_RULES, s.location).socialRisk);
      n.respect = cap(n.respect + (p.sensitivity === "honesty" ? 2 : -2));
    }
    if (type === "apologize") {
      n.resentment = cap(n.resentment - 5);
      if (p.sensitivity === "reliability") n.respect = cap(n.respect + 2);
    }
    if (type === "mentor" && p.sensitivity === "learning") n.respect = cap(n.respect + 3);
    if (type === "date" && n.resentment >= 30) {
      s.npcs[id].romance = cap(s.npcs[id].romance - 8);
      api.memory(s, id, "Birlikte vakit geçirdik ama çözülmemiş kırgınlığım sürüyor.");
    }
  }
  if (actionId.startsWith("meet:")) {
    const id = before.appointments.find((a) => a.id === actionId.slice(5))?.npcId;
    if (id) {
      s.deep.npcs[id].respect = cap(s.deep.npcs[id].respect + 5);
      reveal(s, id, "reliability", "Randevuya geldi", "Randevuda gözlemledim");
    }
  }
}
export function deepActions(s, api) {
  if (!s.deep) return [];
  const result = [],
    d = day(s),
    m = minute(s),
    deep = s.deep;
  const add = (id, label, description, category, minutes, cost, reason, run, pay = "total") => {
    const available = pay === "cash" ? s.cash : pay === "bank" ? s.bank : funds(s);
    const why = reason || (available < cost ? `${cost} TL kullanılabilir bakiye gerekir.` : "");
    result.push({
      id,
      label,
      description,
      category,
      minutes,
      cost,
      disabled: !!why,
      reason: why,
      run,
      pay,
    });
  };
  const sameNpc = (id) => deepNpcLocation(s, id) === s.location;
  const social = (id) =>
    m < 540 || m >= 1260
      ? "Görüşmeler 09.00–21.00 arasında."
      : !sameNpc(id)
        ? `${npcName(id)} şu an ${districtName(deepNpcLocation(s, id))}’ta.`
        : "";
  for (const n of NPCS) {
    const current = deep.npcs[n.id],
      relation = s.npcs[n.id];
    add(
      `deep:disclose:${n.id}`,
      `${n.name} · planlarını açıkla`,
      "Kariyerini ve borç durumunu kendin paylaş. Bu kişi yalnızca anlattıklarını bilir; güven duyduğu çevresine aktarabilir.",
      "social",
      30,
      0,
      social(n.id) || (current.lastDisclosureDay === d ? "Bugün planlarını anlattın." : ""),
      (next) => {
        const target = next.deep.npcs[n.id];
        target.lastDisclosureDay = d;
        reveal(
          next,
          n.id,
          "career",
          next.job ? find(JOBS, next.job.id).name : "Yeni bir iş arıyorum",
        );
        reveal(
          next,
          n.id,
          "finances",
          next.debt > 0 ? "Borçlarımı kapatmaya çalışıyorum" : "Borçsuz bir düzen kuruyorum",
        );
        target.respect = cap(target.respect + 3);
        next.npcs[n.id].trust = cap(next.npcs[n.id].trust + 2);
        api.memory(next, n.id, "Meslek ve bütçe planlarını kendin anlattın; bunu biliyorum.");
        return `${n.name} planlarını artık biliyor.`;
      },
    );
    if (current.request) {
      add(
        `deep:promise:${n.id}`,
        `${n.name} · yardım sözü ver`,
        `${current.request.kind === "loan" ? "Nakit sıkışıklığı" : "Kendi yaşam hedefi"} için iki gün içinde 120 dk ve 100 TL malzeme ayırmayı taahhüt et. Tutulmazsa güven −10.`,
        "social",
        10,
        0,
        relation.affinity < 15
          ? "Yakınlık 15 gerekir."
          : deep.promises.some(
                (p) => p.npcId === n.id && p.status === "pending" && p.direction === "player",
              )
            ? "Bu kişiye bekleyen bir sözün var."
            : "",
        (next) => {
          next.deep.promises.push({
            id: `promise-${next.revision}`,
            npcId: n.id,
            direction: "player",
            kind: "help",
            dueDay: d + 2,
            status: "pending",
            amount: 100,
          });
          next.deep.promises = next.deep.promises.slice(-48);
          next.deep.npcs[n.id].request = null;
          reveal(
            next,
            n.id,
            "promise",
            `${d + 2}. güne kadar yardım edecek`,
            "Birlikte kararlaştırdık",
          );
          api.memory(next, n.id, `${d + 2}. güne kadar yardımcı olacağına söz verdin.`);
          return "Yardım sözü takvim ve beklentilere eklendi.";
        },
      );
      add(
        `deep:decline:${n.id}`,
        `${n.name} · yardım talebini açıkça reddet`,
        "Vaktin olmadığını söyle. Boş söz vermezsin; yakınlık −1.",
        "social",
        5,
        0,
        "",
        (next) => {
          next.deep.npcs[n.id].request = null;
          next.npcs[n.id].affinity = cap(next.npcs[n.id].affinity - 1);
          api.memory(next, n.id, "Yardım edemeyeceğini dürüstçe söyledin.");
          return "Talebi açıkça yanıtladın.";
        },
      );
    }
    add(
      `deep:support:${n.id}`,
      `${n.name} · destek iste`,
      "Güven 50 gerekir. Üç gün sonra 300 TL destek sözü alırsın. Kendi işi veya bütçesi bozulursa sözünü tutamayabilir.",
      "social",
      30,
      0,
      social(n.id) ||
        (relation.trust < 50
          ? "Güven 50 gerekir."
          : d - current.lastPromiseDay < 21 && current.lastPromiseDay
            ? "Son destek talebinden 21 gün geçmeli."
            : deep.promises.some(
                  (p) => p.npcId === n.id && p.status === "pending" && p.direction === "npc",
                )
              ? "Bu kişiden zaten bir söz bekliyorsun."
              : ""),
      (next) => {
        next.deep.npcs[n.id].lastPromiseDay = d;
        next.deep.promises.push({
          id: `promise-${next.revision}`,
          npcId: n.id,
          direction: "npc",
          kind: "support",
          dueDay: d + 3,
          status: "pending",
          amount: 300,
        });
        next.deep.promises = next.deep.promises.slice(-48);
        api.memory(
          next,
          n.id,
          `${d + 3}. gün için sana 300 TL destek sözü verdim; kendi durumum da önemli.`,
        );
        return "Destek sözü alındı; para henüz hesabında değil.";
      },
    );
  }
  for (const p of deep.promises.filter((p) => p.status === "pending" && p.direction === "player"))
    add(
      `deep:fulfill:${p.id}`,
      `${npcName(p.npcId)} · yardım sözünü tut`,
      `${p.dueDay}. gün sonuna kadar. 120 dk, ${p.amount} TL; güven +10, saygı +8; NPC becerisi ve bütçesi somut olarak gelişir.`,
      "social",
      120,
      p.amount,
      social(p.npcId),
      (next) => {
        next.deep.promises.find((x) => x.id === p.id).status = "kept";
        const n = next.deep.npcs[p.npcId];
        n.cash = amount(n.cash + p.amount);
        n.skill = cap(n.skill + 3);
        n.respect = cap(n.respect + 8);
        n.resentment = cap(n.resentment - 6);
        n.lastHelpDay = d;
        next.npcs[p.npcId].trust = cap(next.npcs[p.npcId].trust + 10);
        next.npcs[p.npcId].affinity = cap(next.npcs[p.npcId].affinity + 4);
        api.memory(next, p.npcId, "Söz verdiğin yardıma geldin; hem işim hem bütçem rahatladı.");
        reveal(next, p.npcId, "promise", "Yardım sözünü tuttu", "Birlikte çalıştık");
        return "Sözünü tuttun; karşındaki kişinin yaşamı da değişti.";
      },
    );
  if (s.job) {
    const employer = find(EMPLOYERS, s.job.id),
      manager = deep.npcs[employer.manager],
      job = find(JOBS, s.job.id);
    add(
      "career:review",
      "Yöneticiyle gelişim görüşmesi",
      `${employer.name}: performans +4, yönetici güveni +3, mesleki itibar +2. En çok haftada bir.`,
      "work",
      60,
      0,
      s.location !== job.district
        ? "İşyerinin bulunduğu semte git."
        : m < 480 || m > 1080
          ? "Görüşme 08.00–18.00 arasında."
          : d - deep.career.lastReviewDay < 7 && deep.career.lastReviewDay
            ? "Son görüşmeden yedi gün geçmeli."
            : "",
      (next) => {
        next.deep.career.lastReviewDay = d;
        next.deep.career.reputation = cap(next.deep.career.reputation + 2);
        next.job.performance = cap(next.job.performance + 4);
        next.npcs[employer.manager].trust = cap(next.npcs[employer.manager].trust + 3);
        next.deep.npcs[employer.manager].respect = cap(manager.respect + 3);
        api.memory(next, employer.manager, "İş hedeflerini birlikte somutlaştırdık.");
        return "Gelişim beklentilerini yöneticiyle görüştün.";
      },
    );
    const maxBonus = Math.round(job.wage * 0.2),
      bonusStep = Math.round(job.wage * 0.1);
    add(
      "career:negotiate",
      "Ücretini müzakere et",
      `İtibar 35, performans 70, 8 vardiya ve yönetici güveni 25 gerekir. Vardiya başına +${bonusStep} TL; en çok +${maxBonus} TL. Zar kullanılmaz.`,
      "work",
      60,
      0,
      s.location !== job.district
        ? "İşyerinin bulunduğu semte git."
        : deep.career.reputation < 35
          ? "Mesleki itibar 35 gerekir."
          : s.job.performance < 70
            ? "Performans 70 gerekir."
            : s.job.shifts < 8
              ? "Sekiz tamamlanmış vardiya gerekir."
              : s.npcs[employer.manager].trust < 25
                ? "Yönetici güveni 25 gerekir."
                : deep.career.negotiatedBonus >= maxBonus
                  ? "Bu sözleşmenin ücret primi üst sınırında."
                  : deep.career.negotiatedDay && d - deep.career.negotiatedDay < 14
                    ? "İki görüşme arasında 14 gün geçmeli."
                    : "",
      (next) => {
        next.deep.career.negotiatedBonus = Math.min(
          maxBonus,
          next.deep.career.negotiatedBonus + bonusStep,
        );
        next.deep.career.negotiatedDay = d;
        api.document(
          next,
          `salary-${next.revision}`,
          "Ücret eki",
          `Tamamlanan her vardiyaya ${next.deep.career.negotiatedBonus} TL ek hak ediş.`,
        );
        return "Yeterlilik ve performansınla ücret eki aldın.";
      },
    );
    add(
      "career:notice",
      "Ayrılma niyetini önceden bildir",
      "Üç gün daha çalışıp sonra istifa edersen mesleki itibar +2; bildirimsiz ayrılık −3. Hak edilmiş maaş her durumda ödenir.",
      "work",
      30,
      0,
      deep.career.noticeDay ? "Ayrılma bildirimin zaten kayıtlı." : "",
      (next) => {
        next.deep.career.noticeDay = d + 3;
        api.document(
          next,
          `notice-${next.revision}`,
          "Ayrılma bildirimi",
          `${d + 3}. günden itibaren planlı ayrılık yapılabilir.`,
        );
        return `Ayrılma bildirimin kayda geçti; ${d + 3}. gün sonrası istifa planlı sayılır.`;
      },
    );
  }
  for (const value of [500, 2000, 5000])
    add(
      `finance:reserve:${value}`,
      `${value} TL acil durum fonuna ayır`,
      "Günlük harcamalardan ayrılır; faturalar bu fona kendiliğinden dokunmaz.",
      "finance",
      5,
      value,
      "",
      (next) => {
        next.deep.finance.reserve = amount(next.deep.finance.reserve + value);
        return "Acil durum fonu büyüdü.";
      },
    );
  if (deep.finance.reserve)
    add(
      "finance:reserve-withdraw",
      `${deep.finance.reserve} TL · acil durum fonunu çöz`,
      "Fonun tamamı bankaya aktarılır; toplam servet değişmez.",
      "finance",
      5,
      0,
      "",
      (next) => {
        api.receive(next, next.deep.finance.reserve, "Acil durum fonu çözümü", "bank");
        next.deep.finance.reserve = 0;
        return "Acil durum fonu kullanılabilir bakiyeye döndü.";
      },
    );
  add(
    "finance:autopay",
    `Fatura otomatik ödemesini ${deep.finance.autoPay ? "kapat" : "aç"}`,
    "Açıksa kira ve faturalar vadesinde bakiyeden ödenir. Kapalıysa yedi gün içinde manuel ödenmeli; sonra kira birikimine/borca geçer.",
    "finance",
    0,
    0,
    "",
    (next) => {
      next.deep.finance.autoPay = !next.deep.finance.autoPay;
      return `Otomatik ödeme ${next.deep.finance.autoPay ? "açıldı" : "kapandı"}.`;
    },
  );
  for (const bill of deep.finance.bills.filter((b) => b.status === "due")) {
    const payable = bill.kind === "debt" ? Math.min(bill.amount, s.debt) : bill.amount;
    add(
      `finance:bill:${bill.id}`,
      `${bill.label} · ${payable} TL öde`,
      `${bill.dueDay}. gün vadesi; yedi günlük ödeme süresi.`,
      "finance",
      5,
      payable,
      "",
      (next) => {
        next.deep.finance.bills.find((b) => b.id === bill.id).status = "paid";
        if (bill.kind === "debt") {
          next.debt = Math.max(0, next.debt - payable);
          api.record(next, "Planlı anapara ödemesi", -payable, "debt");
        }
        return "Bekleyen ödeme kapandı.";
      },
    );
  }
  if (!deep.finance.debtPlan)
    add(
      "finance:debt-plan",
      "Haftalık borç planı yap",
      "200 TL sözleşme masrafı; haftada en çok 1.000 TL anapara. Aylık faiz %3’ten %2’ye iner. İki ödeme aksarsa plan biter.",
      "finance",
      45,
      200,
      s.debt < 1000 ? "En az 1.000 TL borç gerekir." : "",
      (next) => {
        next.deep.finance.debtPlan = { weeklyPayment: 1000, nextDay: d + 7, missed: 0 };
        api.document(
          next,
          `debtplan-${next.revision}`,
          "Borç ödeme planı",
          "Haftada 1.000 TL’ye kadar anapara; %2 aylık faiz. İki aksama sonrası eski %3 koşulu geçerli.",
        );
        return "Borç ödeme planı başladı.";
      },
    );
  else
    add(
      "finance:cancel-plan",
      "Borç planını sonlandır",
      "Sonraki aylık faiz tekrar %3 olur; mevcut anapara korunur.",
      "finance",
      10,
      0,
      "",
      (next) => {
        next.deep.finance.debtPlan = null;
        return "Plan sonlandırıldı; mevcut borç değişmedi.";
      },
    );
  for (const brief of FREELANCE_BRIEFS)
    add(
      `freelance:accept:${brief.id}`,
      `${brief.name} · işi üstlen`,
      `${brief.description} Malzeme ${brief.cost} TL; ${brief.sessions} oturum ×${brief.minutes} dk; ${brief.due} günde teslim edersen ${brief.reward} TL.`,
      "business",
      30,
      brief.cost,
      deep.freelance.active
        ? "Önce mevcut serbest işi teslim et veya bırak."
        : s.location !== brief.district
          ? `Müşteri ${districtName(brief.district)}’ta.`
          : s.player.skills[brief.skill] < brief.required
            ? `${find(SKILLS, brief.skill).name} ${brief.required} gerekir.`
            : !s.inventory[brief.item]
              ? `${brief.item === "laptop" ? "Dizüstü" : brief.item === "tools" ? "Alet takımı" : "Çalışma kitabı"} gerekir.`
              : deep.freelance.lastAcceptedDay && d - deep.freelance.lastAcceptedDay < 3
                ? "Yeni müşteri işi için üç gün ara gerekir."
                : "",
      (next) => {
        next.deep.freelance.active = {
          id: brief.id,
          dueDay: d + brief.due,
          sessions: 0,
          acceptedDay: d,
        };
        next.deep.freelance.lastAcceptedDay = d;
        api.document(
          next,
          `freelance-${next.revision}`,
          brief.name + " · sözleşme",
          `${d + brief.due}. güne kadar ${brief.sessions} oturum ve teslim. Ücret ${brief.reward} TL; ön maliyet iade edilmez.`,
        );
        return "Serbest iş sözleşmesi başladı; gelir teslimden sonra.";
      },
    );
  if (deep.freelance.active) {
    const active = deep.freelance.active,
      brief = find(FREELANCE_BRIEFS, active.id);
    add(
      "freelance:work",
      "Serbest işte bir oturum çalış",
      `${active.sessions}/${brief.sessions} oturum. Enerji −10, stres +5; beceri +1.`,
      "business",
      brief.minutes,
      0,
      active.sessions >= brief.sessions
        ? "Çalışma hazır; müşteriye teslim et."
        : s.player.energy < 25
          ? "En az 25 enerji gerekir."
          : "",
      (next) => {
        next.deep.freelance.active.sessions++;
        api.change(next, { energy: -10, stress: 5 });
        api.skill(next, brief.skill, 1);
        return "Serbest işte bir çalışma oturumu tamamlandı.";
      },
    );
    add(
      "freelance:deliver",
      "Serbest işi müşteriye teslim et",
      `${brief.reward} TL bankaya; serbest iş itibarı +5. Son gün ${active.dueDay}.`,
      "business",
      45,
      0,
      active.sessions < brief.sessions
        ? "Bütün oturumlar tamamlanmalı."
        : s.location !== brief.district
          ? `Teslim yeri ${districtName(brief.district)}.`
          : "",
      (next) => {
        api.receive(next, brief.reward, brief.name + " · teslim ücreti", "bank");
        next.deep.freelance.completed++;
        next.deep.freelance.reputation = cap(next.deep.freelance.reputation + 5);
        next.deep.freelance.active = null;
        next.deep.career.reputation = cap(next.deep.career.reputation + 2);
        return "İş teslim edildi; sözleşme ücreti bankana yattı.";
      },
    );
    add(
      "freelance:abandon",
      "Serbest işi bırak",
      "Ön maliyet iade edilmez; müşteri itibarı −8.",
      "business",
      15,
      0,
      "",
      (next) => {
        next.deep.freelance.active = null;
        next.deep.freelance.reputation = cap(next.deep.freelance.reputation - 8);
        return "Serbest iş kapatıldı; malzeme maliyeti kayıp olarak kaldı.";
      },
    );
  }
  if (!deep.business)
    for (const type of BUSINESS_TYPES)
      add(
        `business:start:${type.id}`,
        `${type.name} · kur`,
        `${type.description} Kurulum ${type.startup} TL; haftalık sabit gider semte göre yaklaşık ${Math.round(type.overhead * find(DISTRICT_RULES, s.location).overhead)} TL. Müşteri ve aktif emek olmadan gelir yok.`,
        "business",
        180,
        type.startup,
        s.player.skills[type.skill] < type.required
          ? `${find(SKILLS, type.skill).name} ${type.required} gerekir.`
          : !s.inventory[type.item]
            ? "İşletmenin mesleki ekipmanı gerekir."
            : "",
        (next) => {
          next.deep.business = {
            id: type.id,
            location: next.location,
            status: "active",
            level: 1,
            clients: 0,
            reputation: 20,
            revenue: 0,
            costs: type.startup,
            lastServiceDay: 0,
            lastAcquireDay: 0,
            nextOverheadDay: d + 7,
            openedDay: d,
            arrears: 0,
            accruedOverhead: 0,
          };
          api.document(
            next,
            `business-${next.revision}`,
            type.name + " · işletme kaydı",
            `Kurulum ${type.startup} TL. Bir seferde bir işletme, en çok sekiz müşteri. Haftalık gider ve hizmet başına malzeme maliyeti var.`,
          );
          return "Mikro işletmen açıldı. Önce müşteri bulmalısın.";
        },
      );
  if (deep.business) {
    const b = deep.business,
      type = find(BUSINESS_TYPES, b.id),
      capacity = 2 + b.level,
      maxClients = Math.min(8, 2 + b.level * 2),
      served = Math.min(b.clients, capacity),
      cost = served * type.unitCost,
      rule = find(DISTRICT_RULES, b.location),
      price = Math.round(type.unitPrice * (rule.business === b.id ? rule.demand : 1)),
      quality = s.player.energy < 35 ? 0.65 : 1,
      revenue = Math.round(served * price * quality);
    add(
      "business:acquire",
      "İşletmeye müşteri bul",
      `120 dk ve 180 TL tanıtım; müşteri +1. Günlük bir edinim, mevcut kapasite ${maxClients}.`,
      "business",
      120,
      180,
      b.status !== "active"
        ? "Önce işletmeyi yeniden aç."
        : s.location !== b.location
          ? `İşletmen ${districtName(b.location)}’ta.`
          : b.clients >= maxClients
            ? "Mevcut kapasite dolu."
            : b.lastAcquireDay === d
              ? "Bugünkü müşteri edinimini yaptın."
              : "",
      (next) => {
        next.deep.business.clients++;
        next.deep.business.lastAcquireDay = d;
        next.deep.business.costs = amount(next.deep.business.costs + 180);
        api.change(next, { energy: -7, stress: 4 });
        return "Somut tanıtım çalışmasıyla bir müşteri kazandın.";
      },
    );
    add(
      "business:serve",
      "İşletmede müşterilere hizmet ver",
      `${served} müşteri; 180 dk, ${cost} TL malzeme → ${revenue} TL gelir. ${quality < 1 ? "Düşük enerji hizmet kalitesini ve geliri %35 azaltıyor." : "Enerji −18, stres +8."} Günde bir hizmet vardiyası.`,
      "business",
      180,
      cost,
      b.status !== "active"
        ? "İşletme durmuş durumda."
        : s.location !== b.location
          ? `İşletmen ${districtName(b.location)}’ta.`
          : !served
            ? "Önce müşteri bul."
            : b.lastServiceDay === d
              ? "Bugün hizmet vardiyası yaptın."
              : s.player.energy < 20
                ? "En az 20 enerji gerekir."
                : "",
      (next) => {
        const business = next.deep.business;
        business.lastServiceDay = d;
        business.costs = amount(business.costs + cost);
        business.revenue = amount(business.revenue + revenue);
        business.reputation = cap(business.reputation + (quality === 1 ? 3 : -5));
        if (quality < 1) business.clients = Math.max(0, business.clients - 1);
        api.receive(next, revenue, "Mikro işletme · müşteri hizmeti", "bank");
        api.change(next, { energy: -18, stress: 8 });
        api.skill(next, type.skill, 1);
        return `Müşteri hizmeti tamamlandı: ${revenue - cost} TL değişken gider sonrası sonuç; haftalık sabit gider ayrıca işlenir.`;
      },
    );
    add(
      "business:upgrade",
      "İşletme kapasitesini büyüt",
      "2.500 TL yatırım; seviye +1, müşteri ve hizmet kapasitesi artar. Haftalık gider yükselir. En çok seviye3.",
      "business",
      180,
      2500,
      b.level >= 3
        ? "Üst kapasiteye ulaştın."
        : b.reputation < 40
          ? "İşletme itibarı 40 gerekir."
          : b.status !== "active"
            ? "İşletme açık olmalı."
            : "",
      (next) => {
        next.deep.business.level++;
        next.deep.business.costs = amount(next.deep.business.costs + 2500);
        return "İşletme kapasitesi ve sabit gideri büyüdü.";
      },
    );
    add(
      "business:pause",
      b.status === "active" ? "İşletmeye ara ver" : "İşletmeyi yeniden aç",
      b.status === "active"
        ? `Açık kaldığı süre için ${Math.ceil(b.accruedOverhead)} TL gider hesaplanır; ödenemeyen kısmı işletme borcuna geçer. Arada yeni gider işlemez.`
        : "Biriken işletme giderini öde. Özgün haftalık ödeme tarihi ertelenmez.",
      "business",
      30,
      b.status === "paused" ? b.arrears : Math.min(funds(s), Math.ceil(b.accruedOverhead)),
      "",
      (next) => {
        const business = next.deep.business;
        if (business.status === "active") {
          const fee = Math.ceil(business.accruedOverhead);
          business.arrears = amount(business.arrears + Math.max(0, fee - funds(s)));
          business.costs = amount(business.costs + fee);
          business.accruedOverhead = 0;
          business.status = "paused";
        } else {
          business.status = "active";
          business.arrears = 0;
        }
        return business.status === "active"
          ? "İşletme yeniden açıldı."
          : "İşletme dinlenmeye alındı.";
      },
    );
    add(
      "business:close",
      "İşletmeyi kapat",
      `Kurulumun %25’i (${Math.floor(type.startup / 4)} TL) geri kazanılır; birikmiş gider bu tutardan ve bakiyeden düşer. Müşteri ağı kapanır.`,
      "business",
      60,
      Math.max(0, b.arrears + Math.ceil(b.accruedOverhead) - Math.floor(type.startup / 4)),
      "",
      (next) => {
        api.receive(
          next,
          Math.max(0, Math.floor(type.startup / 4) - b.arrears - Math.ceil(b.accruedOverhead)),
          "İşletme tasfiye değeri",
          "bank",
        );
        api.document(
          next,
          `closure-${next.revision}`,
          type.name + " · kapanış",
          `Toplam gelir ${b.revenue} TL, maliyet ${b.costs} TL. İşletme kapatıldı.`,
        );
        next.deep.business = null;
        return "İşletme kapandı; gelir/gider belgesi saklandı.";
      },
    );
  }
  for (const [key, label] of [
    ["work", "Haftalık iş planı"],
    ["study", "Planlı eğitim"],
    ["shopping", "Rutin erzak alışverişi"],
  ])
    add(
      `schedule:toggle:${key}`,
      `${label}: ${deep.routine.settings[key] ? "açık → kapat" : "kapalı → aç"}`,
      "Sadece planı değiştirir. Zaman geçirme düğmesi çalıştırana kadar hiçbir eylem uygulanmaz.",
      "schedule",
      0,
      0,
      "",
      (next) => {
        next.deep.routine.settings[key] = !next.deep.routine.settings[key];
        return "Rutin tercihi güncellendi.";
      },
    );
  for (const floor of [0, 300, 1000, 3000])
    add(
      `schedule:budget:${floor}`,
      `Rutin bütçe tabanı: ${floor} TL`,
      "Planlı harcama kullanılabilir bakiyeyi bu tutarın altına indirecekse otomasyon durur.",
      "schedule",
      0,
      0,
      deep.routine.budgetFloor === floor ? "Bu bütçe tabanı zaten seçili." : "",
      (next) => {
        next.deep.routine.budgetFloor = floor;
        return "Rutin bütçe tabanı güncellendi.";
      },
    );
  for (const length of [1, 7])
    add(
      `schedule:run:${length}`,
      length === 1 ? "Planı bir gün yürüt" : "Planı en çok bir hafta yürüt",
      "Yemek, uyku, ulaşım, çalışma, seçili ders ve erzak eylemlerini uygular. Olay veya hikâye kararı, söz/randevu çakışması, bütçe veya sağlık sorunu görünce durur; önemli kararları seçmez.",
      "schedule",
      0,
      0,
      "",
      () => "Plan çalıştırılıyor.",
    );
  return result;
}
export function getDeepView(s) {
  if (!s.deep) return null;
  const d = s.deep,
    job = s.job && find(JOBS, s.job.id),
    employer = job && find(EMPLOYERS, job.id),
    business = d.business,
    type = business && find(BUSINESS_TYPES, business.id),
    active = d.freelance.active,
    brief = active && find(FREELANCE_BRIEFS, active.id);
  return {
    districts: DISTRICT_RULES.map((x) => ({
      id: x.id,
      name: x.name,
      summary: x.summary,
      features: x.features,
    })),
    npcs: NPCS.map((n) => {
      const x = d.npcs[n.id],
        p = find(NPC_PROFILES, n.id);
      return {
        id: n.id,
        name: n.name,
        profession: x.profession,
        employer: x.employment === "searching" ? "İş arıyor" : x.employer,
        home: x.home,
        work: x.work,
        goal: `${p.goal} · ${Math.round(x.goalProgress)} / 100`,
        schedule:
          x.employment === "searching"
            ? "Gündüz Şişli’de iş arıyor; akşam kendi çevresinde."
            : `09.00–17.00 ${districtName(x.work)}; haftada iki izin günü, akşam ${districtName(n.leisure)}.`,
        money: x.cash,
        wealth: x.cash + x.savings - x.debt,
        respect: x.respect,
        resentment: x.resentment,
        expectation: p.expectation,
        knownFacts: x.knownFacts.map((f) => ({
          day: f.day,
          text: `${{ career: "Meslek planı", finances: "Bütçe paylaşımı", promise: "Verilen söz", attendance: "Vardiya", location: "Görüşme yeri", reliability: "Sözünü tutma", "story-contact": "Paylaşılan hikâye", debt: "Borç planı", job: "İş durumu", health: "Sağlık paylaşımı" }[f.id] || "Bildiği konu"}: ${f.value}`,
          source: f.source,
        })),
        ties: Object.entries(x.ties).map(([id, strength]) => ({ id, name: npcName(id), strength })),
        changes: x.changes,
      };
    }),
    career: {
      employer: employer?.name || "Aktif iş sözleşmesi yok",
      manager: employer ? npcName(employer.manager) : "—",
      coworkers: employer
        ? employer.coworkers
            .filter(
              (id) => d.npcs[id].employment === "employed" && d.npcs[id].work === job.district,
            )
            .map(npcName)
        : [],
      reputation: d.career.reputation,
      negotiatedBonus: d.career.negotiatedBonus,
      expectations: employer?.expectations || ["Yeterliliklerine uygun bir ilana başvur."],
      flexibility: employer?.flexibility || "Kendi planını kurabilirsin.",
      security: employer?.security || "Gelir yalnızca tamamlanan işten doğar.",
    },
    finance: {
      reserve: d.finance.reserve,
      autoPay: d.finance.autoPay,
      debtPlan: d.finance.debtPlan
        ? `Haftada ${d.finance.debtPlan.weeklyPayment} TL; sonraki gün ${d.finance.debtPlan.nextDay}; aylık faiz %2.`
        : "Aktif plan yok; borç için aylık faiz %3.",
      forecast: [
        { day: s.housing.dueDay, label: "Kira", amount: -s.housing.rent },
        ...(s.job ? [{ day: s.job.payDay, label: "Kazanılmış maaş", amount: s.job.earned }] : []),
        ...d.finance.bills
          .filter((b) => b.status === "due")
          .map((b) => ({ day: b.dueDay, label: b.label + " · bekliyor", amount: -b.amount })),
        ...(business
          ? [
              {
                day: business.nextOverheadDay,
                label: "İşletme sabit gideri",
                amount: business.status === "active" ? -businessOverhead(business) : 0,
              },
            ]
          : []),
      ].sort((a, b) => a.day - b.day),
      summary: `Kullanılabilir ${funds(s)} TL; ayrı acil fon ${d.finance.reserve} TL. Otomatik ödeme ${d.finance.autoPay ? "açık" : "kapalı"}.`,
    },
    business: business
      ? {
          name: type.name,
          status: business.status === "active" ? "Açık" : "Ara verildi",
          clients: business.clients,
          reputation: business.reputation,
          revenue: business.revenue,
          costs: business.costs,
          profit: business.revenue - business.costs,
          weeklyOverhead: businessOverhead(business),
          location: business.location,
          summary: `Seviye ${business.level}/3; biriken işletme gideri ${business.arrears} TL. Gelir için müşteri edinimi ve hizmet eylemi gerekir.`,
        }
      : null,
    freelance: {
      active: active
        ? {
            title: brief.name,
            dueDay: active.dueDay,
            sessions: active.sessions,
            requiredSessions: brief.sessions,
            reward: brief.reward,
          }
        : null,
      completed: d.freelance.completed,
      reputation: d.freelance.reputation,
    },
    schedule: {
      settings: { ...d.routine.settings, autoPay: d.finance.autoPay },
      stopReason: d.routine.stopReason,
      lastRun: d.routine.lastRun ? `${d.routine.lastRun}. gün` : "Henüz çalıştırılmadı",
      summary: `Bütçe tabanı ${d.routine.budgetFloor} TL; son çalıştırmada ${d.routine.lastActions.length} eylem. Her karar noktası yeniden sana gelir.`,
    },
    promises: d.promises.map((p) => ({
      id: p.id,
      npcId: p.npcId,
      name: npcName(p.npcId),
      kind: p.direction === "npc" ? "Sana verilen destek sözü" : "Verdiğin yardım sözü",
      dueDay: p.dueDay,
      status: p.status === "pending" ? "Bekliyor" : p.status === "kept" ? "Tutuldu" : "Tutulmadı",
      description:
        p.direction === "npc"
          ? `${p.amount} TL; NPC’nin kendi bütçesi ve işi belirleyici.`
          : `120 dk ve ${p.amount} TL malzeme taahhüdü.`,
    })),
  };
}
export function validateDeep(s) {
  try {
    const object = (x) => x !== null && typeof x === "object" && !Array.isArray(x),
      integer = (x, min = 0, max = 1_000_000_000) => Number.isInteger(x) && x >= min && x <= max,
      number = (x, min = 0, max = 100) =>
        typeof x === "number" && Number.isFinite(x) && x >= min && x <= max,
      text = (x, max = 1000) => typeof x === "string" && x.length <= max,
      array = (x, max) => Array.isArray(x) && x.length <= max,
      ids = (list, id) => list.some((x) => x.id === id);
    const exact = (v, names) =>
      object(v) && Object.keys(v).sort().join("|") === names.split(" ").sort().join("|");
    const x = s.deep;
    if (
      !exact(
        x,
        "version initializedDay lastProcessedDay npcs career finance business freelance promises routine",
      ) ||
      x.version !== 1 ||
      !integer(x.initializedDay, 1, 400000) ||
      !integer(x.lastProcessedDay, 1, 400000) ||
      !object(x.npcs) ||
      Object.keys(x.npcs).length !== 12
    )
      return false;
    for (const npc of NPCS) {
      const n = x.npcs[npc.id];
      if (
        !exact(
          n,
          "home work profession employer employment salary cash savings debt rent tenure skill level priority goalProgress respect resentment knownFacts ties changes lastHelpDay lastDisclosureDay lastPromiseDay lastMoveDay lastJobChangeDay jobSearchDays request",
        ) ||
        !ids(DISTRICTS, n.home) ||
        !ids(DISTRICTS, n.work) ||
        !text(n.profession, 150) ||
        !text(n.employer, 200) ||
        !["employed", "searching"].includes(n.employment) ||
        !["salary", "cash", "savings", "debt", "rent", "tenure", "jobSearchDays"].every((k) =>
          integer(n[k]),
        ) ||
        !integer(n.level, 0, 2) ||
        !["skill", "respect", "resentment", "goalProgress"].every((k) => number(n[k])) ||
        !["career", "security", "home", "community"].includes(n.priority) ||
        ![
          "lastHelpDay",
          "lastDisclosureDay",
          "lastPromiseDay",
          "lastMoveDay",
          "lastJobChangeDay",
        ].every((k) => integer(n[k], 0, 400000))
      )
        return false;
      if (
        !array(n.knownFacts, 24) ||
        !n.knownFacts.every(
          (f) =>
            exact(f, "id value day source") &&
            text(f.id, 80) &&
            text(f.value, 300) &&
            text(f.source, 100) &&
            integer(f.day, 1, 400000),
        ) ||
        !object(n.ties) ||
        Object.keys(n.ties).length > 12 ||
        !Object.entries(n.ties).every(([id, v]) => id !== npc.id && ids(NPCS, id) && number(v))
      )
        return false;
      if (
        !array(n.changes, 12) ||
        !n.changes.every(
          (c) => exact(c, "day text") && integer(c.day, 1, 400000) && text(c.text, 1000),
        )
      )
        return false;
      if (
        n.request !== null &&
        (!exact(n.request, "kind sinceDay deadlineDay") ||
          !["help", "loan"].includes(n.request.kind) ||
          !integer(n.request.sinceDay, 1, 400000) ||
          !integer(n.request.deadlineDay, n.request.sinceDay, 400000))
      )
        return false;
    }
    const c = x.career;
    if (
      !exact(
        c,
        "reputation employerJobId negotiatedBonus negotiatedDay noticeDay lastReviewDay experience",
      ) ||
      !number(c.reputation) ||
      (c.employerJobId !== null && !ids(JOBS, c.employerJobId)) ||
      !["negotiatedBonus", "negotiatedDay", "noticeDay", "lastReviewDay"].every((k) =>
        integer(c[k]),
      ) ||
      !object(c.experience) ||
      Object.keys(c.experience).length !== 7 ||
      !JOBS.every((j) => integer(c.experience[j.id]))
    )
      return false;
    const f = x.finance;
    if (
      !exact(f, "reserve autoPay debtPlan bills") ||
      !integer(f.reserve) ||
      typeof f.autoPay !== "boolean" ||
      !array(f.bills, 24) ||
      !f.bills.every(
        (b) =>
          exact(b, "id label amount dueDay kind status") &&
          text(b.id, 100) &&
          text(b.label, 200) &&
          integer(b.amount) &&
          integer(b.dueDay, 1, 400000) &&
          ["rent", "utilities", "debt"].includes(b.kind) &&
          ["due", "paid", "overdue"].includes(b.status),
      )
    )
      return false;
    if (
      f.debtPlan !== null &&
      (!exact(f.debtPlan, "weeklyPayment nextDay missed") ||
        !integer(f.debtPlan.weeklyPayment, 1, 1000) ||
        !integer(f.debtPlan.nextDay, 1, 400000) ||
        !integer(f.debtPlan.missed, 0, 2))
    )
      return false;
    const b = x.business;
    if (
      b !== null &&
      (!exact(
        b,
        "id location status level clients reputation revenue costs lastServiceDay lastAcquireDay nextOverheadDay openedDay arrears accruedOverhead",
      ) ||
        !ids(BUSINESS_TYPES, b.id) ||
        !ids(DISTRICTS, b.location) ||
        !["active", "paused"].includes(b.status) ||
        !integer(b.level, 1, 3) ||
        !integer(b.clients, 0, 8) ||
        !number(b.reputation) ||
        !number(b.accruedOverhead, 0, 1_000_000_000) ||
        !["revenue", "costs", "arrears"].every((k) => integer(b[k])) ||
        !["lastServiceDay", "lastAcquireDay", "nextOverheadDay", "openedDay"].every((k) =>
          integer(b[k], 0, 400000),
        ))
    )
      return false;
    const freel = x.freelance;
    if (
      !exact(freel, "active completed reputation lastAcceptedDay") ||
      !integer(freel.completed) ||
      !number(freel.reputation) ||
      !integer(freel.lastAcceptedDay, 0, 400000)
    )
      return false;
    if (
      freel.active !== null &&
      (!exact(freel.active, "id dueDay sessions acceptedDay") ||
        !ids(FREELANCE_BRIEFS, freel.active.id) ||
        !integer(freel.active.dueDay, 1, 400000) ||
        !integer(freel.active.acceptedDay, 1, 400000) ||
        !integer(freel.active.sessions, 0, find(FREELANCE_BRIEFS, freel.active.id).sessions))
    )
      return false;
    if (
      !array(x.promises, 48) ||
      !x.promises.every(
        (p) =>
          exact(p, "id npcId direction kind dueDay status amount") &&
          text(p.id, 100) &&
          ids(NPCS, p.npcId) &&
          ["player", "npc"].includes(p.direction) &&
          ["help", "support"].includes(p.kind) &&
          integer(p.dueDay, 1, 400000) &&
          ["pending", "kept", "broken"].includes(p.status) &&
          integer(p.amount, 0, 1000),
      )
    )
      return false;
    const r = x.routine;
    if (
      !exact(r, "settings budgetFloor stopReason lastRun lastActions") ||
      !object(r.settings) ||
      Object.keys(r.settings).length !== 3 ||
      !["work", "study", "shopping"].every((k) => typeof r.settings[k] === "boolean") ||
      ![0, 300, 1000, 3000].includes(r.budgetFloor) ||
      !text(r.stopReason, 1000) ||
      !integer(r.lastRun, 0, 400000) ||
      !array(r.lastActions, 100) ||
      !r.lastActions.every((a) => text(a, 120))
    )
      return false;
    return true;
  } catch {
    return false;
  }
}
