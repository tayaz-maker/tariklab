// Küçük gelir, hafif ceza ve kısa haftalık duyuru. Yeni motor yok; kasa, hatır ve semt kaydı kullanılır.
import { getJobById } from "./catalog.js?v=10";
import { SHOPS, QUARTERS } from "./quarters.js?v=10";
import {
  addMemory,
  addNpcMemory,
  adjustHealth,
  transact,
  updateRelationship,
} from "./state.js?v=10";

export const POCKET_CATALOG = Object.freeze([
  ["ikramiye", "İkramiye"],
  ["performans", "Performans primi"],
  ["fazla-mesai", "Fazla mesai gönüllü primi"],
  ["gece", "Gece vardiyası primi"],
  ["zam", "Maaş zammı"],
  ["terfi", "Terfi primi"],
  ["izin", "Yıllık izin ücreti"],
  ["bahsis", "Bahşiş"],
  ["anne-zarf", "Aile desteği"],
  ["bayram", "Bayram harçlığı"],
  ["altin", "Altın bozdurma"],
  ["esy", "Eski eşya satışı"],
  ["miras", "Küçük miras payı"],
  ["vergi", "Vergi iadesi"],
  ["referans", "Referans bonusu"],
  ["kidem", "Kıdem"],
  ["asgari", "Kredi kartı asgari gecikme"],
  ["aile-borc", "Aile içi borç"],
  ["spor", "Düzenli spor"],
  ["gonullu", "Gönüllü iş"],
  ["beklenmedik", "Beklenmedik ikramiye"],
  ["eski-borc", "Eski borçludan gelen"],
  ["komsu", "Komşu yardımı"],
  ["ucuz", "Ucuz eşya fırsatı"],
  ["erken-kira", "Kiracının erken ödemesi"],
  ["iyi-hafta", "Tezgâhın iyi haftası"],
  ["tadilat", "Ev yenileme değer artışı"],
  ["ceza-iptal", "Trafik cezası iptali"],
  ["aidat", "Aidat kolaylığı"],
  ["eski-referans", "Eski işveren referansı"],
]);

const TIP_FAMILIES = new Set(["hizmet", "yemeicme", "ticaret", "freelance"]);
const NIGHT_FAMILIES = new Set(["guvenlik", "uretim", "saglik", "lojistik"]);
const whole = (value) => Math.round(Number(value) || 0);

export function raisedSalary(state) {
  const base = getJobById(state?.career?.jobId)?.salary || 0;
  const pct = Math.min(40, Math.max(0, whole(state?.flags?.pocket?.wagePct)));
  if (!base || pct <= 0) return base;
  return Math.round((base * (100 + pct)) / 100);
}

function jobOf(state) {
  return getJobById(state?.career?.jobId);
}

function employed(state) {
  return Boolean(jobOf(state));
}

function rentouts(state) {
  return (state.household?.semt?.holdings || []).filter(
    (item) => item?.mode === "owned" && item.occupancy === "rentout",
  );
}

function liveHolding(state) {
  const semt = state.household?.semt;
  if (!semt?.live?.holdingId) return null;
  return (semt.holdings || []).find((item) => item.id === semt.live.holdingId) || null;
}

export function normalizePocket(state) {
  if (!state.flags || typeof state.flags !== "object") state.flags = {};
  const src = state.flags.pocket && typeof state.flags.pocket === "object" ? state.flags.pocket : {};
  const mark = {};
  if (src.mark && typeof src.mark === "object") {
    for (const [key, value] of Object.entries(src.mark)) {
      if (typeof key === "string" && Number.isInteger(value)) mark[key] = value;
    }
  }
  const debt = src.familyDebt;
  const familyDebt =
    debt && Number.isInteger(debt.amount) && debt.amount > 0 && Number.isInteger(debt.dueWeek)
      ? { amount: debt.amount, dueWeek: debt.dueWeek, nagWeek: Number.isInteger(debt.nagWeek) ? debt.nagWeek : 0 }
      : null;
  state.flags.pocket = {
    mark,
    wagePct: Math.min(40, Math.max(0, whole(src.wagePct))),
    gold: src.gold === true,
    inheritance: src.inheritance === true,
    referralReady: src.referralReady === true,
    referralGiven: src.referralGiven === true,
    exJobId: typeof src.exJobId === "string" ? src.exJobId : null,
    leftWeek: Number.isInteger(src.leftWeek) ? src.leftWeek : 0,
    sport: Number.isInteger(src.sport) ? src.sport : 0,
    volunteer: Number.isInteger(src.volunteer) ? src.volunteer : 0,
    cheapUntil: Number.isInteger(src.cheapUntil) ? src.cheapUntil : 0,
    workedYear: Number.isInteger(src.workedYear) ? src.workedYear : 0,
    taxYear: Number.isInteger(src.taxYear) ? src.taxYear : 0,
    paidYear: Number.isInteger(src.paidYear) ? src.paidYear : 0,
    paidTotal: Number.isInteger(src.paidTotal) ? src.paidTotal : 0,
    familyDebt,
    doneWeek: Number.isInteger(src.doneWeek) ? src.doneWeek : 0,
    banner: src.banner && typeof src.banner.text === "string" && Number.isInteger(src.banner.week)
      ? { text: src.banner.text, week: src.banner.week }
      : null,
    renoNoted: Array.isArray(src.renoNoted) ? src.renoNoted.filter((id) => typeof id === "string").slice(0, 8) : [],
  };
  return state.flags.pocket;
}

function pay(state, amount, reason) {
  const rounded = whole(amount);
  if (!rounded) return 0;
  transact(state, rounded, reason, rounded > 0 ? "income" : "expense");
  return rounded;
}

const AUTO_CAP = 1600;

function payAuto(state, pocket, amount, reason) {
  const year = state.time.year;
  if (pocket.paidYear !== year) {
    pocket.paidYear = year;
    pocket.paidTotal = 0;
  }
  const give = Math.min(whole(amount), AUTO_CAP - pocket.paidTotal);
  if (give <= 0) return 0;
  pocket.paidTotal += give;
  return pay(state, give, reason);
}

function cooled(pocket, key, week, gap) {
  const last = pocket.mark[key] || 0;
  return !last || week - last >= gap;
}

function remember(state, text, importance = "normal") {
  addMemory(state, text, importance);
}

export function paySeverance(state) {
  const pocket = normalizePocket(state);
  const job = jobOf(state);
  if (!job) return "";
  const weeks = state.career.weeksInRole || 0;
  pocket.exJobId = job.id;
  pocket.leftWeek = state.time.absoluteWeek;
  if (weeks >= 16) pocket.referralReady = true;
  pocket.referralGiven = false;
  const salary = raisedSalary(state);
  pocket.wagePct = 0;
  if (weeks < 8 || salary <= 0) return "";
  const amount = Math.round(salary * Math.min(2, weeks / 48));
  if (amount <= 0) return "";
  pay(state, amount, "Kıdem");
  remember(state, `İşten ayrılırken kıdemin yattı. ${amount} TL.`, "important");
  return `Kıdem ${amount} TL yattı.`;
}

export function payPromotionBonus(state) {
  const salary = raisedSalary(state);
  if (salary <= 0) return "";
  const amount = Math.min(800, Math.max(200, Math.round(salary * 0.04)));
  pay(state, amount, "Terfi primi");
  remember(state, `Terfi primi yattı. ${amount} TL.`, "important");
  return `Terfi primi ${amount} TL yattı.`;
}

function grantShift(state, pocket) {
  const lines = [];
  const selected = state.weekly?.selectedIds || [];
  const overtime = selected.includes("overtime");
  const job = jobOf(state);
  if (overtime && job) {
    const tip = payAuto(state, pocket, 100, "Fazla mesai gönüllü primi");
    if (tip) lines.push(`Fazla mesai gönüllü primi: ${tip} TL.`);
    const night = NIGHT_FAMILIES.has(job.family) || (state.flags.overtimeStreak || 0) >= 3;
    if (night) {
      const extra = payAuto(state, pocket, 150, "Gece vardiyası primi");
      if (extra) lines.push(`Gece vardiyası primi: ${extra} TL.`);
    }
  } else if (job && NIGHT_FAMILIES.has(job.family) && state.time.weekOfMonth === 4 && (state.career.weeksInRole || 0) >= 8) {
    const extra = payAuto(state, pocket, 150, "Gece vardiyası primi");
    if (extra) lines.push(`Gece vardiyası primi: ${extra} TL.`);
  }
  if (selected.includes("exercise")) {
    pocket.sport += 1;
    if (pocket.sport >= 4 && pocket.sport % 4 === 0) {
      adjustHealth(state, { health: 2 });
      lines.push("Düzenli spor tuttu. Sağlık biraz toparladı.");
    }
  } else pocket.sport = 0;
  return lines;
}

function grantCalendar(state, pocket) {
  const week = state.time.absoluteWeek;
  const month = state.time.month;
  const slot = state.time.weekOfMonth;
  const job = jobOf(state);
  const role = state.career?.weeksInRole || 0;
  const salary = job ? raisedSalary(state) : 0;
  const year = state.time.year;
  const lines = [];

  if (job && role > 0 && role % 48 === 0 && pocket.wagePct < 10 && cooled(pocket, "zam", week, 40)) {
    pocket.mark.zam = week;
    pocket.wagePct = Math.min(10, pocket.wagePct + 2);
    lines.push(`İş yıldönümü. Maaş zammı tuttu. Aylık ücret ${raisedSalary(state)} TL.`);
  }
  if (pocket.referralReady && role === 1 && job && salary > 0 && !pocket.mark.referans) {
    const amount = payAuto(state, pocket, Math.max(250, Math.round(salary * 0.03)), "Referans bonusu");
    if (amount) {
      pocket.referralReady = false;
      pocket.mark.referans = week;
      lines.push(`Referans bonusu yattı. ${amount} TL.`);
    }
  }
  if (!pocket.inheritance && week >= 80 && slot === 2) {
    const amount = payAuto(state, pocket, 600, "Küçük miras payı");
    if (amount) {
      pocket.inheritance = true;
      lines.push(`Uzak bir pay çıktı. Küçük miras: ${amount} TL.`);
    }
  }
  if (lines.length) return lines.join(" ");

  if (job && slot === 1 && (month === 6 || month === 12)) {
    const key = `ikramiye:${year}-${month}`;
    const allowed = month === 12 ? role >= 16 : role >= 40;
    if (allowed && !pocket.mark[key] && salary > 0) {
      const amount = payAuto(state, pocket, Math.round(salary * 0.04), "İkramiye");
      if (amount) {
        pocket.mark[key] = week;
        return `İkramiye yattı. ${amount} TL.`;
      }
    }
  }
  if (slot === 1 && month === 3 && pocket.workedYear === year - 1 && pocket.taxYear !== year) {
    const base = salary || 9000;
    const amount = payAuto(state, pocket, Math.round(base * 0.03), "Vergi iadesi");
    if (amount) {
      pocket.taxYear = year;
      return `Vergi iadesi yattı. ${amount} TL.`;
    }
  }
  if (job && slot === 1 && month === 8 && role >= 20 && cooled(pocket, "izin", week, 40) && salary > 0) {
    const amount = payAuto(state, pocket, Math.round(salary * 0.03), "Yıllık izin ücreti");
    if (amount) {
      pocket.mark.izin = week;
      return `Yıllık izin ücreti yattı. ${amount} TL.`;
    }
  }
  if (slot === 1 && (month === 4 || month === 9) && (state.relationships?.anne || 0) >= 40 && cooled(pocket, `bayram:${year}-${month}`, week, 20)) {
    const amount = payAuto(state, pocket, 150, "Bayram harçlığı");
    if (amount) {
      pocket.mark[`bayram:${year}-${month}`] = week;
      updateRelationship(state, "anne", 1);
      return `Bayram harçlığı geldi. ${amount} TL.`;
    }
  }
  if (job && slot === 3 && month % 3 === 0 && role >= 12 && (state.career.performance || 0) >= 65 && cooled(pocket, "performans", week, 10) && salary > 0) {
    const amount = payAuto(state, pocket, Math.round(salary * 0.03), "Performans primi");
    if (amount) {
      pocket.mark.performans = week;
      return `Performans primi yattı. ${amount} TL.`;
    }
  }
  if (slot === 3 && (state.relationships?.anne || 0) >= 55 && state.finances.balance < 1000 && week >= 10 && cooled(pocket, "anne-zarf", week, 36)) {
    const amount = payAuto(state, pocket, 300, "Aile desteği");
    if (amount) {
      pocket.mark["anne-zarf"] = week;
      updateRelationship(state, "anne", 2);
      addNpcMemory(state, "anne", "Zarfı bıraktım, sorma.");
      return `Annen bir zarf bırakmış. ${amount} TL.`;
    }
  }
  if (slot === 2 && role >= 8 && cooled(pocket, "bahsis", week, 12)) {
    const shop = state.household?.semt?.shop;
    const tipped = (job && TIP_FAMILIES.has(job.family)) || (shop && shop.attentionWeek === week - 1);
    if (tipped) {
      const amount = payAuto(state, pocket, shop && shop.attentionWeek === week - 1 ? 120 : 80, "Bahşiş");
      if (amount) {
        pocket.mark.bahsis = week;
        return `Bahşiş: ${amount} TL.`;
      }
    }
  }
  return "";
}

function grantPressure(state, pocket) {
  const lines = [];
  const week = state.time.absoluteWeek;
  if (state.time.weekOfMonth === 4) {
    const arrears = state.finances?.arrears || 0;
    const debt = (state.wealth?.debts || []).find((item) => item.type === "personal");
    const short = arrears > 0 || (debt && state.finances.balance < (debt.monthlyPayment || 0));
    if (short && cooled(pocket, "asgari", week, 3)) {
      const base = arrears > 0 ? arrears : debt.monthlyPayment;
      const fee = Math.max(50, Math.min(350, Math.round(base * 0.02)));
      pay(state, -fee, "Kredi kartı asgari gecikme");
      pocket.mark.asgari = week;
      lines.push(`Kredi kartı asgarisi gecikti. ${fee} TL ceza.`);
    }
  }
  const family = pocket.familyDebt;
  if (family && week >= family.dueWeek && (week - family.dueWeek) % 4 === 0 && family.nagWeek !== week) {
    family.nagWeek = week;
    updateRelationship(state, "anne", -2);
    addNpcMemory(state, "anne", "Faizsiz borç hâlâ duruyor.");
    lines.push("Annenin faizsiz borcu duruyor. Hatır azaldı.");
  }
  return lines;
}

function ambientCandidates(state, pocket) {
  const week = state.time.absoluteWeek;
  const job = jobOf(state);
  const salary = job ? raisedSalary(state) : 0;
  const list = [];
  if (job && salary > 0 && (state.career.weeksInRole || 0) >= 10 && cooled(pocket, "beklenmedik", week, 20)) {
    list.push(() => {
      const amount = payAuto(state, pocket, Math.round(salary * 0.03), "Beklenmedik ikramiye");
      if (!amount) return "";
      pocket.mark.beklenmedik = week;
      return `Beklenmedik ikramiye. ${amount} TL.`;
    });
  }
  const loanOpen = (state.openCases || []).some((item) => item.type === "friend-loan" && item.status !== "resolved");
  if (week >= 20 && !loanOpen && cooled(pocket, "eski-borc", week, 36)) {
    list.push(() => {
      const amount = payAuto(state, pocket, 400, "Eski borçludan gelen");
      if (!amount) return "";
      pocket.mark["eski-borc"] = week;
      return `Eski bir borçlu parasını getirdi. ${amount} TL.`;
    });
  }
  if (state.household?.homeId && state.household.homeId !== "family" && cooled(pocket, "komsu", week, 18)) {
    list.push(() => {
      const amount = payAuto(state, pocket, 200, "Komşu yardımı");
      if (!amount) return "";
      pocket.mark.komsu = week;
      adjustHealth(state, { stress: -2 });
      return `Komşu ustayı savdı. ${amount} TL cebinde kaldı.`;
    });
  }
  if (cooled(pocket, "ucuz", week, 16)) {
    list.push(() => {
      pocket.cheapUntil = week + 6;
      pocket.mark.ucuz = week;
      return "Tanıdık ucuz eşya söyledi. Birkaç hafta işe yarar.";
    });
  }
  const rented = rentouts(state)[0];
  if (rented && cooled(pocket, "erken-kira", week, 12)) {
    list.push({
      id: "erken-kira",
      run: () => {
        const amount = payAuto(state, pocket, Math.min(250, Math.max(100, Math.round((rented.monthly || 0) / 8))), "Kiracının erken ödemesi");
        if (!amount) return "";
        pocket.mark["erken-kira"] = week;
        const name = QUARTERS[rented.quarterId]?.name || "Daire";
        return `${name} kiracısı kirayı erken yatırdı. ${amount} TL.`;
      },
    });
  }
  const shop = state.household?.semt?.shop;
  const shopType = shop ? SHOPS[shop.id] : null;
  if (shopType && shop.openedWeek < week && cooled(pocket, "iyi-hafta", week, 8)) {
    list.push({
      id: "iyi-hafta",
      run: () => {
        const amount = payAuto(state, pocket, Math.min(200, Math.round(shopType.weeklyIn * 0.1)), "Tezgâhın iyi haftası");
        if (!amount) return "";
        pocket.mark["iyi-hafta"] = week;
        return `${shopType.label} iyi hafta geçirdi. ${amount} TL fazla.`;
      },
    });
  }
  const renovated = (state.household?.semt?.holdings || []).find(
    (item) => item?.renovated && item.mode === "owned" && !pocket.renoNoted.includes(item.id),
  );
  if (renovated) {
    list.push({
      id: "tadilat",
      run: () => {
        const bump = Math.max(1, Math.round((renovated.price || renovated.value || 0) * 0.03));
        renovated.value = whole(renovated.value) + bump;
        pocket.renoNoted = [...pocket.renoNoted, renovated.id].slice(-8);
        pocket.mark.tadilat = week;
        const name = QUARTERS[renovated.quarterId]?.name || "Ev";
        return `${name} tadilatı dairenin değerini ${bump} TL oynattı.`;
      },
    });
  }
  if (week >= 16 && cooled(pocket, "ceza-iptal", week, 24)) {
    list.push(() => {
      const amount = payAuto(state, pocket, 150, "Trafik cezası iptali");
      if (!amount) return "";
      pocket.mark["ceza-iptal"] = week;
      return `Trafik cezası iptal oldu. ${amount} TL iade.`;
    });
  }
  const live = liveHolding(state);
  if (live && cooled(pocket, "aidat", week, 20)) {
    list.push(() => {
      const amount = payAuto(state, pocket, Math.min(150, Math.max(80, Math.round((live.upkeep || live.monthly || 400) / 4))), "Aidat kolaylığı");
      if (!amount) return "";
      pocket.mark.aidat = week;
      return `Site yöneticisi aidatta kolaylık tanıdı. ${amount} TL.`;
    });
  }
  if (pocket.exJobId && !pocket.referralGiven && week - pocket.leftWeek >= 6 && week - pocket.leftWeek <= 40) {
    list.push(() => {
      pocket.referralGiven = true;
      pocket.referralReady = !job;
      if (job) {
        state.career.performance = Math.min(100, (state.career.performance || 50) + 2);
        const amount = payAuto(state, pocket, Math.max(200, Math.round(salary * 0.02)), "Eski işveren referansı");
        return amount ? `Eski işveren referans yazdı. ${amount} TL prim düştü.` : "Eski işveren referans yazdı. Sıradaki işte işe yarar.";
      }
      return "Eski işveren referans yazdı. Sıradaki işte işe yarar.";
    });
  }
  return list;
}

function roll(state, salt) {
  const week = state.time?.absoluteWeek || 1;
  const seed = ((state.meta?.rngState || 1) ^ Math.imul(week, 2246822519) ^ salt) >>> 0;
  return (Math.imul(seed ^ (seed >>> 16), 2246822507) >>> 0) / 4294967296;
}

export function processPocketWeek(state) {
  if (state.lifetime?.death) return "";
  const pocket = normalizePocket(state);
  const week = state.time.absoluteWeek;
  if (pocket.doneWeek === week) return "";
  pocket.doneWeek = week;
  const lines = [...grantShift(state, pocket)];
  const calendar = grantCalendar(state, pocket);
  if (calendar) lines.push(calendar);
  lines.push(...grantPressure(state, pocket));
  if (!calendar && week >= 12) {
    const options = ambientCandidates(state, pocket);
    if (options.length && roll(state, 41) < 0.08) {
      const index = Math.floor(roll(state, 73) * options.length) % options.length;
      const picked = options[index];
      const line = typeof picked === "function" ? picked() : picked.run();
      if (line) lines.push(line);
    }
  }
  if (employed(state)) pocket.workedYear = state.time.year;
  const text = lines.join(" ");
  if (text) {
    remember(state, text);
    pocket.banner = { text, week };
  }
  return text;
}

export function applyPocketMoment(state, id) {
  const pocket = normalizePocket(state);
  const hit = ambientCandidates(state, pocket).find((item) => item?.id === id);
  if (!hit?.run) return "";
  const line = hit.run();
  if (line) remember(state, line);
  return line;
}

export function cashGold(state) {
  const pocket = normalizePocket(state);
  if (pocket.gold) return { ok: false, reason: "Bozduracak altın kalmadı." };
  pocket.gold = true;
  pay(state, 8500, "Altın bozdurma");
  remember(state, "Bilezik bozduruldu. 8.500 TL hesaba geçti.", "important");
  return { ok: true };
}

export function sellOldGoods(state) {
  const pocket = normalizePocket(state);
  const week = state.time.absoluteWeek;
  if (!cooled(pocket, "esy", week, 36)) return { ok: false, reason: "Satacak eski eşya birikmedi." };
  const bonus = pocket.cheapUntil >= week ? 400 : 0;
  const amount = pay(state, 1600 + bonus, "Eski eşya satışı");
  pocket.mark.esy = week;
  pocket.cheapUntil = 0;
  remember(state, bonus ? `Eski telefon gitti. Tanıdık fiyatıyla ${amount} TL.` : `Eski telefon ve birkaç eşya gitti. ${amount} TL.`);
  return { ok: true };
}

export function askFamilyDebt(state) {
  const pocket = normalizePocket(state);
  if (pocket.familyDebt) return { ok: false, reason: "Annenin faizsiz borcu hâlâ açık." };
  if ((state.relationships?.anne || 0) < 45) return { ok: false, reason: "Annen bu ara borç konuşmaz." };
  pocket.familyDebt = { amount: 3000, dueWeek: state.time.absoluteWeek + 12, nagWeek: 0 };
  pay(state, 3000, "Aile içi borç");
  updateRelationship(state, "anne", -4);
  addNpcMemory(state, "anne", "Faizsiz 3.000 verdim. Hatır işi.");
  remember(state, "Annenden faizsiz 3.000 TL aldın. On iki hafta içinde kapanmazsa hatır azalır.", "important");
  return { ok: true };
}

export function repayFamilyDebt(state) {
  const pocket = normalizePocket(state);
  const debt = pocket.familyDebt;
  if (!debt) return { ok: false, reason: "Anneye açık borç yok." };
  if (state.finances.balance < debt.amount) return { ok: false, reason: "Borcu kapatacak nakit yok." };
  pay(state, -debt.amount, "Aile borcu kapanışı");
  pocket.familyDebt = null;
  updateRelationship(state, "anne", 6);
  addNpcMemory(state, "anne", "Faizsiz borcu kapattı.");
  remember(state, "Annenin faizsiz borcunu kapattın. Hatır yerine geldi.");
  return { ok: true };
}

export function doVolunteer(state) {
  const pocket = normalizePocket(state);
  pocket.volunteer += 1;
  adjustHealth(state, { energy: -6, stress: -2 });
  if (pocket.volunteer <= 8) {
    updateRelationship(state, "anne", 2);
    updateRelationship(state, "mehmet", 1);
  }
  if (pocket.volunteer === 4) {
    pay(state, 500, "Gönüllü iş");
    updateRelationship(state, "mehmet", 2);
    remember(state, "Gönüllü işin adı bir kapıda geçti. 500 TL.", "important");
  } else remember(state, "Gönüllü işe bir akşam ayırdın.");
  return { ok: true };
}

export const POCKET_DECISIONS = [
  {
    id: "pocket-gold",
    title: "Altın bozdur",
    detail: "bir kez · 8.500 TL",
    contextual: (state) => state.flags?.pocket?.gold !== true,
    apply: cashGold,
  },
  {
    id: "pocket-sell",
    title: "Eski eşyayı sat",
    detail: "telefon ve birkaç parça · 1.600 TL",
    contextual: (state) => {
      const last = state.flags?.pocket?.mark?.esy || 0;
      return !last || state.time.absoluteWeek - last >= 36;
    },
    apply: sellOldGoods,
  },
  {
    id: "pocket-family-debt",
    title: "Anneden faizsiz borç iste",
    detail: "3.000 TL · on iki hafta · hatır iner",
    contextual: (state) =>
      !state.flags?.pocket?.familyDebt &&
      (state.relationships?.anne || 0) >= 45 &&
      state.finances.balance < 12000,
    apply: askFamilyDebt,
  },
  {
    id: "pocket-family-repay",
    title: "Anneye borcu kapat",
    detail: "faiz yok · hatır yerine gelir",
    contextual: (state) => {
      const debt = state.flags?.pocket?.familyDebt;
      return Boolean(debt) && state.finances.balance >= debt.amount;
    },
    apply: repayFamilyDebt,
  },
  {
    id: "pocket-volunteer",
    title: "Gönüllü işe çık",
    detail: "bir akşam · hatır artar · dördüncüde küçük kapı",
    contextual: () => true,
    apply: doVolunteer,
  },
];
