import {
  DISTRICTS,
  SCENARIOS,
  EDUCATIONS,
  TRAITS,
  SKILLS,
  JOBS,
  HOMES,
  COURSES,
  ITEMS,
  NPCS,
  EVENTS,
} from "./content.mjs";

/** The only gameplay writer. No wall-clock, DOM, browser storage, or Math.random. */
const DAY = 1440,
  MAX_MONEY = 1_000_000_000;
const clamp = (n, min = 0, max = 100) => Math.min(max, Math.max(min, n));
const lookup = (list, id) => list.find((item) => item.id === id);
const has = (list, id) => list.some((item) => item.id === id);
const dayOf = (s) => Math.floor(s.time / DAY) + 1;
const minuteOf = (s) => s.time % DAY;
const weekdayOf = (day) => (day - 1) % 7;
const money = (n) => Math.round(clamp(n, 0, MAX_MONEY));
const skilled = (s, id) => s.player.skills[id];
const total = (s) => s.cash + s.bank;
const home = (s) => lookup(HOMES, s.housing.id);
const onWorkday = (job, day) =>
  job.restDay !== weekdayOf(day) && (job.weekends || weekdayOf(day) < 5);
const fmt = (n) => Math.round(n).toLocaleString("tr-TR");
function log(s, text) {
  s.history.push({ day: dayOf(s), time: minuteOf(s), text });
  s.history = s.history.slice(-160);
}
function record(s, label, amount, account) {
  s.transactions.push({ day: dayOf(s), label, amount, account });
  s.transactions = s.transactions.slice(-160);
}
function memory(s, id, text) {
  const n = s.npcs[id];
  n.memories.push({ day: dayOf(s), text });
  n.memories = n.memories.slice(-12);
}
function change(s, values) {
  for (const key of ["health", "energy", "hunger", "stress"])
    if (values[key]) s.player[key] = Math.round(clamp(s.player[key] + values[key]) * 10) / 10;
}
function skill(s, id, amount) {
  s.player.skills[id] = clamp(s.player.skills[id] + amount);
}
function receive(s, amount, label, account = "cash") {
  amount = money(amount);
  const before = s[account];
  s[account] = money(before + amount);
  record(s, label, s[account] - before, account);
}
function spend(s, amount, label, account = "cash") {
  amount = money(amount);
  if (account === "total") {
    const bank = Math.min(s.bank, amount);
    s.bank -= bank;
    if (bank) record(s, label, -bank, "bank");
    s.cash -= amount - bank;
    if (amount - bank) record(s, label, -(amount - bank), "cash");
  } else {
    s[account] -= amount;
    if (amount) record(s, label, -amount, account);
  }
}
function payBill(s, amount, label, arrears = false) {
  const paid = Math.min(total(s), amount);
  spend(s, paid, label, "total");
  const unpaid = amount - paid;
  if (!unpaid) return;
  if (arrears) {
    s.housing.arrears = money(s.housing.arrears + unpaid);
    record(s, label + " · ödenmeyen", unpaid, "arrears");
  } else {
    s.debt = money(s.debt + unpaid);
    record(s, label + " · borca eklendi", unpaid, "debt");
  }
  log(
    s,
    `${label}: ${fmt(unpaid)} TL ödenemedi; ${arrears ? "kira birikimine" : "borca"} eklendi.`,
  );
}
function document(s, id, title, text) {
  if (s.documents.some((d) => d.id === id)) return;
  s.documents.push({ id, title, text, day: dayOf(s) });
  s.documents = s.documents.slice(-64);
}
function news(s, text) {
  s.world.news.push({ day: dayOf(s), text });
  s.world.news = s.world.news.slice(-12);
}
function roll(s) {
  s.rng = (Math.imul(s.rng, 1664525) + 1013904223) >>> 0;
  return 1 + (s.rng % 6);
}
function count(s, key, amount = 1) {
  s.flags[key] = Number(s.flags[key] || 0) + amount;
}

export function getClock(s) {
  const day = dayOf(s),
    minute = minuteOf(s),
    hour = Math.floor(minute / 60);
  const date = new Date(Date.UTC(2026, 8, 7) + (day - 1) * 86400000);
  const weekdays = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
  return {
    day,
    minute,
    hour,
    weekday: weekdays[weekdayOf(day)],
    date: new Intl.DateTimeFormat("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(date),
    time: `${String(hour).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`,
  };
}
export function getNpcLocation(s, id) {
  const npc = lookup(NPCS, id);
  if (!npc) return null;
  const minute = minuteOf(s),
    weekend = weekdayOf(dayOf(s)) >= 5;
  const appointment = s.appointments.find(
    (a) =>
      a.npcId === id &&
      a.status === "scheduled" &&
      a.day === dayOf(s) &&
      Math.abs(minute - a.minute) <= 60,
  );
  if (appointment) return appointment.location;
  if (minute < 540 || minute >= 1260) return npc.home;
  if (weekend) return minute < 1080 ? npc.leisure : npc.home;
  return minute < 1020 ? npc.work : npc.leisure;
}
function updateLocations(s) {
  for (const npc of NPCS) s.npcs[npc.id].location = getNpcLocation(s, npc.id);
}
export function createGame(options = {}) {
  const scenario = lookup(SCENARIOS, options.scenario) || SCENARIOS[0];
  const education =
    lookup(EDUCATIONS, options.education) ||
    (scenario.id === "graduate" ? EDUCATIONS[2] : EDUCATIONS[0]);
  const trait = lookup(TRAITS, options.trait) || TRAITS[0];
  const seed = Number.isSafeInteger(options.seed) ? options.seed >>> 0 : 2026;
  const skills = { ...scenario.skills };
  skills[education.skill] += education.bonus;
  const h = lookup(HOMES, scenario.home);
  const s = {
    version: 1,
    revision: 0,
    seed,
    rng: seed,
    time: 480,
    location: h.district,
    player: {
      name:
        String(options.name || "Deniz")
          .trim()
          .slice(0, 36) || "Deniz",
      scenario: scenario.id,
      education: education.id,
      trait: trait.id,
      skills,
      health: 94,
      energy: 90,
      hunger: 80,
      stress: 18,
    },
    cash: scenario.cash,
    bank: scenario.bank,
    debt: scenario.debt,
    housing: { id: h.id, rent: h.rent, dueDay: 31, deposit: h.deposit, arrears: 0 },
    job: null,
    inventory: { phone: 1, groceries: 3, snack: 1 },
    documents: [],
    appointments: [],
    npcs: Object.fromEntries(
      NPCS.map((n, i) => [
        n.id,
        {
          affinity: n.id === "leyla" ? 20 : 8,
          trust: n.id === "leyla" ? 25 : 10,
          romance: 0,
          mood: 55 + (i % 4) * 8,
          location: n.home,
          lastTalkDay: 0,
          lastCallDay: 0,
          lastGiftDay: 0,
          lastApologyDay: 0,
          lastDateDay: 0,
          lastMentorDay: 0,
          memories: [
            {
              day: 1,
              text:
                n.id === "leyla"
                  ? "İlk ayın kira ödemesini ve oda anahtarını teslim ettik."
                  : "Mahallede yeni bir yüz olduğunu duydum.",
            },
          ],
        },
      ]),
    ),
    course: null,
    world: {
      weather: "Açık",
      priceIndex: 1,
      news: [{ day: 1, text: "Eylül İstanbul’u. İş ilanları açık; ilk ayın barınması hazır." }],
    },
    pendingEvents: [{ id: "welcome", day: 1 }],
    resolvedEvents: [],
    flags: { travels: 0, volunteers: 0, coursesCompleted: 0, workDays: 0, billsPaid: 0 },
    history: [],
    transactions: [],
    achievements: [],
  };
  if (scenario.id === "restart") s.inventory.tools = 1;
  document(
    s,
    "identity",
    "Kimlik ve ikamet",
    "İstanbul’da yaşayan yetişkin bir karakter. Tüm NPC’ler yetişkindir.",
  );
  document(
    s,
    "education",
    `${education.name} diploması`,
    "Başlangıç eğitim belgesi. İş ve kurs koşullarında kullanılır.",
  );
  document(
    s,
    "lease-1",
    h.name + " · kira sözleşmesi",
    `30 günlük kira ${fmt(h.rent)} TL. İlk dönem peşin ödendi; sonraki vade gün 31. Depozito ${fmt(h.deposit)} TL. Elektrik, su ve telefon toplamı 30 günde 900 TL.`,
  );
  if (s.debt)
    document(
      s,
      "loan-start",
      "Eski borç sözleşmesi",
      `${fmt(s.debt)} TL anapara; 30 günde bir %3 faiz. Erken ödeme cezası yok.`,
    );
  log(s, "Yeni hayat başladı. Önce başlangıç kartını seç; ardından iş ve günlük düzenini kur.");
  updateLocations(s);
  return s;
}

function daily(s, previousDay) {
  const day = dayOf(s);
  // Wages are earned only by completed shifts. Payday runs even if the player sleeps across it.
  if (s.job) {
    const j = lookup(JOBS, s.job.id);
    if (
      onWorkday(j, previousDay) &&
      previousDay > s.job.hiredDay &&
      s.job.lastWorkDay !== previousDay
    ) {
      s.job.missed++;
      s.job.performance = clamp(s.job.performance - 12);
      change(s, { stress: 7 });
      log(s, `${j.name}: ${previousDay}. gün vardiyası kaçırıldı (${s.job.missed}/3).`);
    }
    if (day >= s.job.payDay) {
      receive(s, s.job.earned, j.name + " · haftalık maaş", "bank");
      log(s, `${fmt(s.job.earned)} TL kazanılmış maaş bankana yattı.`);
      s.job.earned = 0;
      s.job.payDay += 7;
    }
    if (s.job.missed >= 3) {
      receive(s, s.job.earned, "İşten ayrılma · kazanılmış ücret", "bank");
      document(
        s,
        `termination-${s.revision}`,
        j.name + " · iş sözleşmesi sona erdi",
        "Arka arkaya üç çalışma gününde vardiya tamamlanmadı. Hak edilen ücret ödendi. Yeniden başvurabilirsin.",
      );
      log(s, "Üç devamsızlık nedeniyle iş sözleşmen sona erdi. Kazandığın ücret korunur.");
      s.job = null;
    }
  }
  while (day >= s.housing.dueDay) {
    const amount = s.housing.rent;
    if (amount) {
      const before = s.housing.arrears;
      payBill(s, amount, "Aylık kira", true);
      if (before === s.housing.arrears) count(s, "billsPaid");
      log(s, `${fmt(amount)} TL kira vadesi işlendi.`);
    }
    s.housing.dueDay += 30;
  }
  if (day > 1 && (day - 1) % 30 === 0) {
    if (s.debt) {
      const interest = Math.ceil(s.debt * 0.03);
      s.debt = money(s.debt + interest);
      record(s, "30 günlük borç faizi · %3", interest, "debt");
      log(s, `${fmt(interest)} TL borç faizi işlendi.`);
    }
    if (s.bank) {
      const interest = Math.floor(s.bank * 0.005);
      receive(s, interest, "30 günlük birikim getirisi · %0,5", "bank");
    }
    payBill(s, s.housing.id === "shelter" ? 120 : 900, "Elektrik, su ve telefon");
    news(
      s,
      "Yeni ay: faturalar ve borç faizi hesaplandı. Kira sözleşmelerini ve finans günlüğünü kontrol et.",
    );
    if (s.housing.rent && !s.flags.rentDiscount) s.housing.rent = money(s.housing.rent * 1.05);
  }
  if (s.housing.rent && s.housing.arrears >= s.housing.rent * 3) {
    const deposit = Math.min(s.housing.deposit, s.housing.arrears);
    s.housing.arrears -= deposit;
    record(s, "Depozito · kira birikiminden düşüldü", -deposit, "arrears");
    s.housing = {
      id: "shelter",
      rent: 0,
      dueDay: day + 30,
      deposit: 0,
      arrears: s.housing.arrears,
    };
    s.location = "kadikoy";
    log(
      s,
      "Üç aylık kira birikimi nedeniyle oda sözleşmesi bitti. Depozito borçtan düştü; dayanışma misafirhanesinde yerin hazır.",
    );
  }
  if (s.flags.friendRepayDay && day >= s.flags.friendRepayDay) {
    receive(s, Number(s.flags.friendRepayAmount), "Mert · borç iadesi");
    memory(s, "mert", "Zor günümde verdiğin borcu bugün geri ödedim.");
    delete s.flags.friendRepayDay;
    delete s.flags.friendRepayAmount;
  }
  s.world.priceIndex = Math.min(2, 1 + Math.floor((day - 1) / 7) * 0.007);
  s.world.weather = ["Açık", "Bulutlu", "Açık", "Yağmurlu", "Rüzgârlı", "Açık", "Bulutlu"][
    (day + s.seed) % 7
  ];
  for (const [index, npc] of NPCS.entries()) {
    const n = s.npcs[npc.id];
    n.mood = clamp(45 + ((day * 13 + index * 7 + s.seed) % 41));
    if (day - n.lastTalkDay > 3 && day % 3 === 0) n.affinity = clamp(n.affinity - 1);
    if (day - n.lastTalkDay > 10 && day % 7 === 0) n.trust = clamp(n.trust - 1);
    if ((day + index) % 7 === 0) {
      const personal = [
        "İş yerinde yeni bir sorumluluk aldım.",
        "Bu hafta kendime daha çok dinlenme ayırıyorum.",
        "Bir arkadaşımla mahalle etkinliği planlıyorum.",
        "Kendi bütçemi gözden geçiriyorum.",
      ][(Math.floor(day / 7) + index) % 4];
      memory(s, npc.id, personal);
      if (n.affinity >= 25) news(s, `${npc.name}: ${personal}`);
    }
    if (n.trust >= 50 && day % 14 === index) {
      memory(s, npc.id, "Güvendiğim için yeni bir tanıdığa senden söz ettim.");
      const other = NPCS[(index + 1) % NPCS.length];
      s.npcs[other.id].affinity = clamp(s.npcs[other.id].affinity + 3);
      news(s, `${npc.name}, seni ${other.name} ile aynı çevreye taşıdı.`);
    }
  }
  if (s.player.hunger < 20) change(s, { health: -6, stress: 5 });
  if (s.player.energy < 15) change(s, { health: -4, stress: 5 });
  if (s.player.stress > 85) change(s, { health: -4 });
  if (s.player.health <= 10) {
    change(s, { health: 18, energy: 15 });
    s.location = home(s).district;
    news(
      s,
      "Sağlık ekibi ücretsiz ilk yardım sağladı. Düzenli yemek ve dinlenmeyle toparlanabilirsin.",
    );
  }
}
function advance(s, minutes, { sleeping = false } = {}) {
  const end = s.time + minutes;
  while (s.time < end) {
    const boundary = (Math.floor(s.time / DAY) + 1) * DAY;
    const next = Math.min(end, boundary),
      elapsed = next - s.time,
      hours = elapsed / 60;
    change(s, { hunger: -hours * (sleeping ? 0.7 : 1.7), energy: sleeping ? 0 : -hours * 1.4 });
    if (!sleeping && s.player.energy < 10) change(s, { health: -hours * 0.9 });
    const prior = dayOf(s);
    s.time = next;
    if (next === boundary) daily(s, prior);
  }
  for (const appointment of s.appointments) {
    const deadline = (appointment.day - 1) * DAY + appointment.minute + 60;
    if (appointment.status === "scheduled" && s.time > deadline) {
      appointment.status = "missed";
      const n = s.npcs[appointment.npcId];
      n.trust = clamp(n.trust - 12);
      n.affinity = clamp(n.affinity - 6);
      memory(s, appointment.npcId, "Buluşmaya gelmedin. Bir açıklama ve özür bekliyorum.");
      log(s, `${lookup(NPCS, appointment.npcId).name} ile randevu kaçtı; güven −12.`);
    }
  }
  updateLocations(s);
}
function condition(s, id) {
  const d = dayOf(s),
    p = s.player;
  switch (id) {
    case "welcome":
      return true;
    case "book-club":
      return d >= 3 && s.location === "kadikoy";
    case "repair-home":
      return d >= 5 && s.housing.id !== "shelter";
    case "commute":
      return d >= 3 && s.flags.travels >= 2;
    case "market":
      return d >= 7;
    case "portfolio":
      return d >= 5 && p.skills.technical >= 20;
    case "mentor":
      return d >= 7 && s.npcs.selin.trust >= 35;
    case "illness":
      return p.health < 65;
    case "burnout":
      return p.stress >= 70;
    case "wallet":
      return s.flags.travels >= 4;
    case "team-conflict":
      return s.job?.shifts >= 4;
    case "overtime":
      return d >= 8 && s.job?.shifts >= 3;
    case "friend-help":
      return d >= 10 && s.npcs.mert.trust >= 35;
    case "showcase":
      return s.flags.coursesCompleted >= 1 && d >= 12;
    case "rent-talk":
      return d >= 25 && s.housing.rent > 0;
    case "family-call":
      return d >= 12 && p.energy < 80;
    case "power-cut":
      return d >= 16 && s.housing.id !== "shelter" && s.location === home(s).district;
    case "rain":
      return d >= 10 && s.world.weather === "Yağmurlu" && s.location === "kadikoy";
    case "craft-project":
      return p.skills.craft >= 25 && s.inventory.tools > 0;
    case "career-review":
      return s.job?.shifts >= 10 && s.job.performance >= 65;
    case "arrears":
      return s.housing.arrears > 0;
    case "romance":
      return Object.values(s.npcs).some((n) => n.romance >= 20);
    case "community":
      return s.flags.volunteers >= 2 && s.npcs.aylin.trust >= 25;
    case "debt-letter":
      return d >= 7 && s.debt > 0;
    case "digital":
      return d >= 6 && s.inventory.laptop > 0;
    case "graduation":
      return s.flags.coursesCompleted >= 1;
    case "festival":
      return d >= 21 && weekdayOf(d) >= 5;
    case "month":
      return d >= 30;
    default:
      return false;
  }
}
function refreshEvents(s) {
  if (s.pendingEvents.length) return;
  const event = EVENTS.find((e) => !s.resolvedEvents.includes(e.id) && condition(s, e.id));
  if (event) s.pendingEvents.push({ id: event.id, day: dayOf(s) });
}
function effects(s, values) {
  change(s, values);
  for (const [id, amount] of Object.entries(values.skills || {})) skill(s, id, amount);
  if (values.cash) receive(s, values.cash, "Olay kartı");
  if (values.bank) receive(s, values.bank, "Olay kartı", "bank");
  if (values.npc) {
    const { id, ...changes } = values.npc;
    for (const [key, amount] of Object.entries(changes))
      s.npcs[id][key] = clamp(s.npcs[id][key] + amount);
  }
  if (values.allAffinity)
    for (const n of Object.values(s.npcs)) n.affinity = clamp(n.affinity + values.allAffinity);
  if (values.performance && s.job)
    s.job.performance = clamp(s.job.performance + values.performance);
  Object.assign(s.flags, values.flags || {});
  if (values.flags?.rentDiscount) s.housing.rent = money(s.housing.rent * 0.95);
  for (const [id, amount] of Object.entries(values.items || {}))
    s.inventory[id] = Math.min(999, (s.inventory[id] || 0) + amount);
  if (values.document)
    document(
      s,
      values.document,
      values.document === "portfolio" ? "Portfolyo" : "Topluluk katılım belgesi",
      "Olayda verdiğin emek sonucunda kazanıldı; kalıcı yaşam kaydın.",
    );
  if (values.repayment) {
    s.flags.friendRepayDay = dayOf(s) + 7;
    s.flags.friendRepayAmount = values.repayment;
  }
}
function requirement(s, r) {
  if (!r) return "";
  if (r.skill && skilled(s, r.skill) < r.value)
    return `${lookup(SKILLS, r.skill).name} ${r.value} gerekir.`;
  if (r.npc && s.npcs[r.npc].trust < r.trust)
    return `${lookup(NPCS, r.npc).name} güveni ${r.trust} gerekir.`;
  return "";
}
function qualification(s, j) {
  for (const [id, level] of Object.entries(j.requirements))
    if (skilled(s, id) < level)
      return `${lookup(SKILLS, id).name} ${level} gerekir (şu an ${skilled(s, id)}).`;
  if (j.item && !s.inventory[j.item]) return `${lookup(ITEMS, j.item).name} gerekir.`;
  if (
    j.credential &&
    s.player.education !== "university" &&
    !s.documents.some((d) => d.id === `certificate-${j.credential}`)
  )
    return "Üniversite diploması veya ilgili kurs sertifikası gerekir.";
  return "";
}
const hours = (s, start, end) => minuteOf(s) >= start * 60 && minuteOf(s) < end * 60;
function makeActions(s) {
  const actions = [],
    d = dayOf(s),
    m = minuteOf(s),
    p = s.player;
  function add(id, label, description, category, minutes, cost, reason, run, options = {}) {
    const available = options.pay === "total" ? total(s) : options.pay === "bank" ? s.bank : s.cash;
    const why =
      reason ||
      (available < cost
        ? `${fmt(cost)} TL ${options.pay === "total" ? "toplam bakiye" : options.pay === "bank" ? "banka bakiyesi" : "nakit"} gerekir.`
        : "");
    actions.push({
      id,
      label,
      description,
      category,
      minutes,
      cost,
      disabled: Boolean(why),
      reason: why,
      run,
      ...options,
    });
  }
  if (s.pendingEvents.length) {
    const e = lookup(EVENTS, s.pendingEvents[0].id);
    for (const c of e.choices)
      add(
        `event:${e.id}:${c.id}`,
        c.name,
        c.description,
        "event",
        c.minutes,
        c.cost,
        requirement(s, c.requires),
        (next) => {
          effects(next, c.effects);
          let detail = "";
          if (c.roll) {
            const die = roll(next),
              bonus = Math.floor(skilled(next, c.roll.skill) / 20),
              success = die + bonus >= c.roll.target;
            effects(next, success ? c.roll.success : c.roll.failure);
            detail = ` Zar ${die} + beceri ${bonus} = ${die + bonus}; hedef ${c.roll.target}. ${success ? "Başarılı." : "Sonuç beklediğin gibi olmadı."}`;
          }
          next.resolvedEvents.push(e.id);
          next.pendingEvents.shift();
          if (c.effects.npc)
            memory(next, c.effects.npc.id, `${e.name}: “${c.name}” kararını hatırlıyorum.`);
          return `${e.name}: ${c.name}.${detail}`;
        },
      );
    return actions;
  }
  for (const district of DISTRICTS) {
    if (district.id === s.location) continue;
    const across = district.id === "kadikoy" || s.location === "kadikoy";
    const rush = (m >= 480 && m < 600) || (m >= 1020 && m < 1140);
    const travelMinutes =
      (across ? 50 : 30) + (rush ? 15 : 0) + (s.world.weather === "Yağmurlu" ? 10 : 0);
    const fare = across ? 45 : 35;
    add(
      `travel:${district.id}`,
      `${district.name} · ${across ? "vapur + yürüyüş" : "otobüs"}`,
      `Konum değişir. ${rush ? "Yoğun saat: +15 dk. " : ""}${s.world.weather === "Yağmurlu" ? "Yağmur: +10 dk. " : ""}Toplu taşıma 06.00–00.00.`,
      "travel",
      travelMinutes,
      fare,
      hours(s, 6, 24) ? "" : "Seferler 06.00’da başlar.",
      (next) => {
        next.location = district.id;
        count(next, "travels");
        return `${district.name}’a ulaştın.`;
      },
    );
    add(
      `walk:${district.id}`,
      `${district.name} · ${across ? "ücretsiz dayanışma servisi" : "yürü"}`,
      across
        ? "Mahalle servisinin dolambaçlı güzergâhı. Ücretsiz, 150 dk; enerji −10."
        : "90 dk yürüyüş; enerji −12, sağlık +2.",
      "travel",
      across ? 150 : 90,
      0,
      p.energy < 20
        ? "En az 20 enerji gerekir."
        : !hours(s, 6, 23)
          ? "Ücretsiz güzergâhlar 06.00–23.00 arası açık."
          : "",
      (next) => {
        next.location = district.id;
        change(next, { energy: across ? -10 : -12, health: across ? 0 : 2 });
        count(next, "travels");
        return `${district.name}’a ulaştın.`;
      },
    );
  }
  const atHome = s.location === home(s).district;
  const sleepMinutes = m >= 1080 ? DAY - m + 480 : 480;
  add(
    "sleep",
    "Uyu · yeni güne hazırlan",
    `${home(s).name}. ${m >= 1080 ? "Ertesi gün 08.00’e kadar" : "8 saat"} uyu. Enerji +${home(s).rest}; stres −16. Tokluk gece de azalır.`,
    "life",
    sleepMinutes,
    0,
    !atHome
      ? `Önce ${lookup(DISTRICTS, home(s).district).name}’daki evine dön.`
      : m >= 480 && m < 1080 && s.flags.lastSleepDay === d
        ? "Gündüz uykunu kullandın. Dinlenebilir veya akşamı bekleyebilirsin."
        : "",
    (next) => {
      change(next, {
        energy:
          home(next).rest +
          (next.player.trait === "balanced" ? 5 : 0) +
          Number(next.flags.homeComfort || 0),
        stress: -16,
        health: next.player.hunger >= 35 ? 4 : 0,
      });
      next.flags.lastSleepDay = d;
      return "Dinlendin; takvim, ödemeler ve mahalle hayatı ilerledi.";
    },
    { sleeping: true },
  );
  add(
    "rest",
    "Dinlen",
    "90 dk; enerji +24, stres −8. Bir banka veya evine çekil.",
    "life",
    90,
    0,
    "",
    (next) => {
      change(next, { energy: 24, stress: -8 });
      return "Kısa bir mola iyi geldi.";
    },
  );
  add(
    "eat",
    "Esnaf lokantasında ye",
    "45 dk; tokluk +62, sağlık +2.",
    "life",
    45,
    Math.round(180 * s.world.priceIndex),
    !hours(s, 7, 23) ? "Lokanta 07.00–23.00 arası açık." : "",
    (next) => {
      change(next, { hunger: 62, health: 2 });
      return "Sıcak yemeğini yedin.";
    },
  );
  add(
    "soup",
    "Mahalle mutfağında ye",
    "Günde bir ücretsiz öğün; 45 dk, tokluk +55.",
    "life",
    45,
    0,
    s.flags.lastSoupDay === d
      ? "Bugünkü ücretsiz öğününü kullandın."
      : !hours(s, 7, 22)
        ? "Mahalle mutfağı 07.00–22.00 açık."
        : "",
    (next) => {
      next.flags.lastSoupDay = d;
      change(next, { hunger: 55 });
      return "Mahalle mutfağında bir öğün paylaştın.";
    },
  );
  add(
    "cook",
    "Evde yemek pişir",
    "Bir erzak harca; 45 dk, tokluk +65, zanaat +1.",
    "life",
    45,
    0,
    !atHome
      ? "Yemek pişirmek için evinin bulunduğu semtte olmalısın."
      : !s.inventory.groceries
        ? "Envanterinde erzak yok."
        : "",
    (next) => {
      next.inventory.groceries--;
      change(next, { hunger: 65 });
      skill(next, "craft", 1);
      return "Evde yemek hazırladın; bir erzak kullanıldı.";
    },
  );
  add(
    "snack",
    "Sandviçi ye",
    "Bir sandviç; 10 dk, tokluk +28.",
    "life",
    10,
    0,
    !s.inventory.snack ? "Envanterinde sandviç yok." : "",
    (next) => {
      next.inventory.snack--;
      change(next, { hunger: 28 });
      return "Sandviçini yedin.";
    },
  );
  add(
    "medicine",
    "Bakım paketini kullan",
    "Günde bir; 60 dk, sağlık +12, enerji +8.",
    "life",
    60,
    0,
    !s.inventory.medicine
      ? "Bakım paketin yok."
      : s.flags.lastMedicineDay === d
        ? "Bugün bakım paketi kullandın."
        : "",
    (next) => {
      next.inventory.medicine--;
      next.flags.lastMedicineDay = d;
      change(next, { health: 12, energy: 8 });
      return "Bakım yapıp dinlendin.";
    },
  );
  add(
    "clinic",
    "Sağlık kontrolü",
    "90 dk; sağlık +35, stres −8. Şişli sağlık merkezi.",
    "life",
    90,
    350,
    s.location !== "sisli"
      ? "Sağlık merkezi Şişli’de."
      : !hours(s, 8, 20)
        ? "Sağlık merkezi 08.00–20.00 açık."
        : "",
    (next) => {
      change(next, { health: 35, stress: -8 });
      return "Kontrol ve bakım tamamlandı.";
    },
  );
  add(
    "exercise",
    "Parkta hareket et",
    "45 dk; sağlık +5, stres −9, enerji −9. Günde bir.",
    "life",
    45,
    0,
    p.energy < 25
      ? "En az 25 enerji gerekir."
      : s.flags.lastExerciseDay === d
        ? "Bugünkü egzersizini yaptın."
        : "",
    (next) => {
      next.flags.lastExerciseDay = d;
      change(next, { health: 5, stress: -9, energy: -9 });
      return "Şehirden kısa bir nefes aldın.";
    },
  );
  add(
    "volunteer",
    "Mahallede gönüllü ol",
    "120 dk; Aylin güven +6, iletişim +2, enerji −8. Günde bir.",
    "social",
    120,
    0,
    s.location !== "kadikoy"
      ? "Gönüllü masası Kadıköy’de."
      : !hours(s, 9, 19)
        ? "Gönüllü masası 09.00–19.00 açık."
        : s.flags.lastVolunteerDay === d
          ? "Bugünkü gönüllü görevini tamamladın."
          : "",
    (next) => {
      next.flags.lastVolunteerDay = d;
      count(next, "volunteers");
      skill(next, "communication", 2);
      change(next, { energy: -8, stress: -7 });
      next.npcs.aylin.trust = clamp(next.npcs.aylin.trust + 6);
      next.npcs.aylin.affinity = clamp(next.npcs.aylin.affinity + 5);
      memory(next, "aylin", "Mahalle çalışmasına zaman ayırdın; bunu unutmadım.");
      return "Mahalle masasına emek verdin.";
    },
  );
  add(
    "wait:60",
    "Bir saat bekle",
    "Takvim ve NPC rutinleri ilerler; ihtiyaçların azalmaya devam eder.",
    "life",
    60,
    0,
    "",
    () => "Bir saat geçti.",
  );
  for (const item of ITEMS.filter((i) => i.price > 0)) {
    const price = Math.round(item.price * s.world.priceIndex * (s.flags.shoppingPlan ? 0.95 : 1));
    add(
      `buy:${item.id}`,
      `${item.name} satın al`,
      item.description,
      "life",
      15,
      price,
      !hours(s, 7, 23)
        ? "Dükkânlar 07.00–23.00 açık."
        : !item.consumable && s.inventory[item.id]
          ? "Bu eşyaya zaten sahipsin."
          : s.inventory[item.id] >= 99
            ? "Bu eşya için çanta sınırına ulaştın."
            : "",
      (next) => {
        next.inventory[item.id] = (next.inventory[item.id] || 0) + 1;
        return `${item.name} çantana eklendi.`;
      },
    );
  }
  for (const h of HOMES) {
    if (h.id === s.housing.id) continue;
    const cost = h.id === "shelter" ? 0 : h.rent + h.deposit + 300;
    add(
      `move:${h.id}`,
      `${h.name} · taşın`,
      `${h.description} ${h.rent ? `İlk kira ${fmt(h.rent)} + depozito ${fmt(h.deposit)} + taşıma 300 TL. Eski depozito biriken kiradan düşülür; kalanı iade edilir.` : "Eski depozito biriken kiradan düşülür; kalanı iade edilir."}`,
      "life",
      180,
      cost,
      s.location !== h.district ? `Önce ${lookup(DISTRICTS, h.district).name}’a git.` : "",
      (next) => {
        const old = next.housing,
          offset = Math.min(old.deposit, old.arrears),
          refund = old.deposit - offset;
        if (offset) record(next, "Taşınma · depozito kira birikimine sayıldı", -offset, "arrears");
        if (refund) receive(next, refund, "Eski kira depozitosu iadesi", "bank");
        next.housing = {
          id: h.id,
          rent: h.rent,
          dueDay: d + 30,
          deposit: h.deposit,
          arrears: old.arrears - offset,
        };
        document(
          next,
          `lease-${next.revision}`,
          h.name + " · sözleşme",
          `30 günlük kira ${fmt(h.rent)} TL; depozito ${fmt(h.deposit)} TL; sonraki vade gün ${d + 30}.`,
        );
        return `${h.name} için taşınma tamamlandı. Eski depozitodan ${fmt(refund)} TL iade edildi.`;
      },
      { pay: "total" },
    );
  }
  for (const j of JOBS) {
    const current = s.job?.id === j.id;
    const reason = current
      ? "Zaten bu işte çalışıyorsun."
      : s.location !== j.district
        ? `Görüşme için ${lookup(DISTRICTS, j.district).name}’a git.`
        : !hours(s, 8, 17)
          ? "İş görüşmeleri 08.00–17.00 yapılır."
          : qualification(s, j);
    add(
      `apply:${j.id}`,
      `${j.name} · başvur`,
      `${j.description} Vardiya ${j.hours} saat; taban ${fmt(j.wage)} TL/vardiya, ücret her 7 günde bankaya. Başlangıç ${String(j.start).padStart(2, "0")}.00–${String(j.end).padStart(2, "0")}.00. ${j.weekends ? `Hafta sonu vardiya; ${j.restDay === 1 ? "Salı" : "Çarşamba"} izin.` : "Hafta sonu izin."} ${s.job && !current ? "Kabul edersen mevcut işin sona erer; biriken ücretin ödenir." : ""}`,
      "work",
      30,
      0,
      reason,
      (next) => {
        if (next.job) receive(next, next.job.earned, "İş değişikliği · hak edilmiş maaş", "bank");
        next.job = {
          id: j.id,
          level: 0,
          shifts: 0,
          performance: 55,
          earned: 0,
          payDay: d + 7,
          lastWorkDay: 0,
          missed: 0,
          hiredDay: d,
        };
        document(
          next,
          `employment-${next.revision}`,
          j.name + " · iş sözleşmesi",
          `${j.hours} saatlik tamamlanan vardiya başına ${fmt(j.wage)} TL; ilk ödeme gün ${d + 7}. Üç ardışık devamsızlıkta sözleşme sona erer. Terfi: 10/20 vardiya, 70 performans, 30/45 mesleki beceri.`,
        );
        return `${j.name} olarak işe kabul edildin. Başarı, yeterliliklerinle belirlendi; zar atılmadı.`;
      },
    );
  }
  if (s.job) {
    const j = lookup(JOBS, s.job.id),
      wage = Math.round(j.wage * (1 + s.job.level * 0.25));
    const reason =
      s.location !== j.district
        ? `İşin ${lookup(DISTRICTS, j.district).name}’ta.`
        : !onWorkday(j, d)
          ? "Bugün haftalık izin günün."
          : s.job.lastWorkDay === d
            ? "Bugünkü vardiyan tamamlandı."
            : !hours(s, j.start, j.end)
              ? `Vardiyaya ${j.start}.00–${j.end}.00 arasında başla.`
              : p.energy < 35
                ? "Vardiya için en az 35 enerji gerekir."
                : p.hunger < 25
                  ? "Vardiya için en az 25 tokluk gerekir."
                  : p.health < 25
                    ? "Önce sağlığını en az 25’e çıkar."
                    : "";
    add(
      "work",
      "Vardiyayı çalış",
      `${j.levels[s.job.level]} · ${j.hours} saat. ${fmt(wage)} TL hak ediş; sonraki maaş günü ${s.job.payDay}. Enerji −16, stres +10; mesleki beceri +1.`,
      "work",
      j.hours * 60,
      0,
      reason,
      (next) => {
        next.job.lastWorkDay = d;
        next.job.shifts++;
        next.job.missed = 0;
        next.job.earned = money(next.job.earned + wage);
        next.job.performance = clamp(next.job.performance + 3);
        count(next, "workDays");
        skill(next, j.skill, 1);
        change(next, {
          energy: -16 - (next.player.trait === "outgoing" ? 2 : 0),
          stress: next.player.trait === "resilient" ? 6 : next.player.trait === "focused" ? 12 : 10,
        });
        record(next, j.name + " · hak edilen ücret", wage, "earned");
        return `Vardiya tamamlandı. ${fmt(wage)} TL kazanıldı; ${next.job.payDay}. gün bankaya yatacak.`;
      },
    );
    const target = s.job.level + 1;
    add(
      "promote",
      "Terfi görüşmesi",
      `Bir üst rol: ${j.levels[target] || "Son kademedesin"}. Her terfi taban vardiya ücretini %25 artırır.`,
      "work",
      60,
      0,
      target > 2
        ? "Bu kariyerin en üst kademesindesin."
        : s.location !== j.district
          ? "İşyerinin bulunduğu semtte olmalısın."
          : !hours(s, 8, 18)
            ? "Görüşmeler 08.00–18.00 yapılır."
            : s.job.shifts < target * 10
              ? `${target * 10} tamamlanmış vardiya gerekir.`
              : s.job.performance < 70
                ? "Performans 70 gerekir."
                : skilled(s, j.skill) < 15 + target * 15
                  ? `${lookup(SKILLS, j.skill).name} ${15 + target * 15} gerekir.`
                  : "",
      (next) => {
        next.job.level++;
        document(
          next,
          `promotion-${next.revision}`,
          j.levels[next.job.level],
          `Deneyim ve beceri koşulları sağlandı. Vardiya ücreti ${fmt(Math.round(j.wage * (1 + next.job.level * 0.25)))} TL.`,
        );
        change(next, { stress: -10 });
        return `${j.levels[next.job.level]} oldun.`;
      },
    );
    add(
      "resign",
      "İşten ayrıl",
      "Biriken ücret bankaya ödenir. Yeni bir işe başvurabilirsin.",
      "work",
      30,
      0,
      "",
      (next) => {
        receive(next, next.job.earned, "İstifa · hak edilmiş maaş", "bank");
        next.job = null;
        change(next, { stress: -10 });
        return "İş sözleşmen kapandı, kazanılmış ücretin bankaya aktarıldı.";
      },
    );
  }
  for (const c of COURSES) {
    const fee = Math.round(c.cost * (s.flags.courseDiscount ? 0.8 : 1));
    add(
      `enroll:${c.id}`,
      `${c.name} · kaydol`,
      `${c.description} ${c.sessions} oturum, her gün en çok bir ders. Oturum başına ${lookup(SKILLS, c.skill).name} +${c.gain}.`,
      "education",
      30,
      fee,
      s.course
        ? "Önce devam eden kursunu tamamla veya bırak."
        : s.documents.some((x) => x.id === `certificate-${c.id}`)
          ? "Bu sertifikaya zaten sahipsin."
          : s.location !== c.district
            ? `Kayıt yeri: ${lookup(DISTRICTS, c.district).name}.`
            : !hours(s, 8, 21)
              ? "Kurs kaydı 08.00–21.00 yapılır."
              : "",
      (next) => {
        next.course = { id: c.id, sessions: 0, lastStudyDay: 0 };
        document(
          next,
          `enrollment-${next.revision}`,
          c.name + " · kayıt",
          `${fmt(fee)} TL kayıt bedeli. ${c.sessions} ders; bırakılırsa ücret iade edilmez, kazanılan beceri korunur.`,
        );
        return `${c.name} kaydın tamamlandı.`;
      },
    );
  }
  if (s.course) {
    const c = lookup(COURSES, s.course.id);
    add(
      "study",
      `${c.name} · derse katıl`,
      `${s.course.sessions}/${c.sessions} tamamlandı. ${lookup(SKILLS, c.skill).name} +${c.gain}; son derste sertifika.`,
      "education",
      c.minutes,
      0,
      s.location !== c.district
        ? `Ders ${lookup(DISTRICTS, c.district).name}’ta.`
        : s.course.lastStudyDay === d
          ? "Bugünkü dersi tamamladın."
          : !hours(s, 8, 21)
            ? "Derse 08.00–21.00 arasında başlayabilirsin."
            : p.energy < 20
              ? "En az 20 enerji gerekir."
              : "",
      (next) => {
        next.course.sessions++;
        next.course.lastStudyDay = d;
        skill(next, c.skill, c.gain + (next.player.trait === "focused" ? 1 : 0));
        change(next, { energy: -8, stress: 3 });
        if (next.course.sessions >= c.sessions) {
          document(
            next,
            `certificate-${c.id}`,
            c.name + " · sertifika",
            `${c.sessions} oturum tamamlandı. Mesleki yeterlilik olarak kalıcıdır.`,
          );
          count(next, "coursesCompleted");
          next.course = null;
          return `${c.name} tamamlandı; sertifikan belgelere eklendi.`;
        }
        return "Ders tamamlandı, becerin kalıcı olarak gelişti.";
      },
    );
    add(
      "leave-course",
      "Kurstan ayrıl",
      "Kazanılmış becerilerin korunur; kayıt bedeli iade edilmez.",
      "education",
      10,
      0,
      "",
      (next) => {
        next.course = null;
        return "Kurs kaydını kapattın.";
      },
    );
  }
  for (const sk of SKILLS)
    add(
      `practice:${sk.id}`,
      `${sk.name} · bireysel çalış`,
      `90 dk; ${sk.name} +${2 + (s.inventory.book ? 1 : 0) + (p.trait === "focused" ? 1 : 0)}. Her beceri günde bir kez.`,
      "education",
      90,
      0,
      s.flags[`practice-${sk.id}`] === d
        ? "Bugün bu beceriyi çalıştın."
        : p.energy < 15
          ? "En az 15 enerji gerekir."
          : sk.id === "technical" && !s.inventory.laptop && s.location !== "sisli"
            ? "Teknoloji için dizüstü veya Şişli kütüphanesi gerekir."
            : "",
      (next) => {
        next.flags[`practice-${sk.id}`] = d;
        skill(
          next,
          sk.id,
          2 + (next.inventory.book ? 1 : 0) + (next.player.trait === "focused" ? 1 : 0),
        );
        change(next, { energy: -5, stress: 2 });
        return `${sk.name} becerin gelişti.`;
      },
    );
  for (const n of NPCS) {
    const relation = s.npcs[n.id],
      here = getNpcLocation(s, n.id) === s.location;
    const socialReason = !hours(s, 9, 21)
      ? "İnsanlar 09.00–21.00 arasında görüşebilir."
      : !here
        ? `${n.name} şu an ${lookup(DISTRICTS, getNpcLocation(s, n.id)).name}’ta.`
        : "";
    add(
      `talk:${n.id}`,
      `${n.name} · sohbet`,
      `${n.role}. Yakınlık +${8 + (p.trait === "outgoing" ? 3 : 0)}, güven +3; iletişim +1. Günde bir yüz yüze sohbet.`,
      "social",
      45,
      0,
      socialReason || (relation.lastTalkDay === d ? "Bugün uzun bir sohbet ettiniz." : ""),
      (next) => {
        const r = next.npcs[n.id];
        r.affinity = clamp(r.affinity + 8 + (p.trait === "outgoing" ? 3 : 0));
        r.trust = clamp(r.trust + 3);
        r.lastTalkDay = d;
        skill(next, "communication", 1);
        change(next, { stress: -6 });
        memory(next, n.id, `Yüz yüze sohbet ettik. ${next.player.name} beni dinledi.`);
        return `${n.name} seni biraz daha iyi tanıyor.`;
      },
    );
    add(
      `call:${n.id}`,
      `${n.name} · telefon et`,
      "15 dk; yakınlık +3, stres −3. Her yerden, günde bir kez.",
      "social",
      15,
      0,
      !hours(s, 9, 21)
        ? "Arama için 09.00–21.00 arasını bekle."
        : relation.lastCallDay === d
          ? "Bugün aradın."
          : "",
      (next) => {
        const r = next.npcs[n.id];
        r.lastCallDay = d;
        r.affinity = clamp(r.affinity + 3);
        change(next, { stress: -3 });
        memory(next, n.id, "Telefonla halimi hatırımı sordun.");
        return `${n.name} ile telefonda konuştun.`;
      },
    );
    add(
      `gift:${n.id}`,
      `${n.name} · hediye ver`,
      "Çantadan bir küçük hediye; yakınlık +8, güven +4. Günde bir.",
      "social",
      15,
      0,
      socialReason ||
        (!s.inventory.gift
          ? "Çantanda küçük hediye yok."
          : relation.lastGiftDay === d
            ? "Bugün hediye verdin."
            : ""),
      (next) => {
        next.inventory.gift--;
        const r = next.npcs[n.id];
        r.lastGiftDay = d;
        r.affinity = clamp(r.affinity + 8);
        r.trust = clamp(r.trust + 4);
        memory(next, n.id, "Bana düşünülmüş bir hediye getirdin.");
        return `${n.name} hediyeni hatırlayacak.`;
      },
    );
    add(
      `apologize:${n.id}`,
      `${n.name} · gönlünü al`,
      "30 dk; güven +5, yakınlık +2. Kaçırılan randevular için özür dileyebilirsin.",
      "social",
      30,
      0,
      socialReason ||
        (relation.lastApologyDay === d
          ? "Bugün bu konuyu konuştunuz."
          : relation.trust >= 70
            ? "Aranızdaki güven zaten güçlü."
            : ""),
      (next) => {
        const r = next.npcs[n.id];
        r.lastApologyDay = d;
        r.trust = clamp(r.trust + 5);
        r.affinity = clamp(r.affinity + 2);
        memory(next, n.id, "Aramızdaki gerginliği konuşup sorumluluk aldın.");
        return "Kırgınlığı konuştunuz; güveni yeniden kurmak zaman alır.";
      },
    );
    add(
      `conflict:${n.id}`,
      `${n.name} · sınır koy`,
      "15 dk; stres −8, yakınlık −8, güven −5. Günde bir; kararın hafızada kalır.",
      "social",
      15,
      0,
      socialReason || (s.flags[`conflict-${n.id}`] === d ? "Bugün sınırını dile getirdin." : ""),
      (next) => {
        next.flags[`conflict-${n.id}`] = d;
        const r = next.npcs[n.id];
        r.affinity = clamp(r.affinity - 8);
        r.trust = clamp(r.trust - 5);
        change(next, { stress: -8 });
        memory(next, n.id, "Sert bir biçimde sınır koydun; aramızda mesafe oluştu.");
        return "Sınırını koydun; ilişkiniz bu karardan etkilendi.";
      },
    );
    add(
      `mentor:${n.id}`,
      `${n.name} · birlikte öğren`,
      `${lookup(SKILLS, n.skill).name} +3; 90 dk. Güven 40, günde bir.`,
      "social",
      90,
      0,
      socialReason ||
        (relation.trust < 40
          ? "Birlikte çalışmak için güven 40 gerekir."
          : relation.lastMentorDay === d
            ? "Bugün birlikte çalıştınız."
            : ""),
      (next) => {
        next.npcs[n.id].lastMentorDay = d;
        skill(next, n.skill, 3);
        change(next, { energy: -5 });
        memory(next, n.id, "Birlikte çalıştık, bildiklerimi paylaştım.");
        return `${n.name} ile ${lookup(SKILLS, n.skill).name.toLowerCase()} çalıştın.`;
      },
    );
    const scheduled = s.appointments.filter((a) => a.status === "scheduled");
    add(
      `schedule:${n.id}`,
      `${n.name} · randevu ayarla`,
      `Yarın 18.00, ${lookup(DISTRICTS, n.leisure).name}. Yakınlık 20 gerekir. Zamanında gelmek güven kazandırır.`,
      "social",
      5,
      0,
      relation.affinity < 20
        ? "Yakınlık 20 gerekir."
        : scheduled.some((a) => a.npcId === n.id)
          ? "Bu kişiyle bekleyen randevun var."
          : scheduled.some((a) => a.day === d + 1 && a.minute === 1080)
            ? "Yarın 18.00 için başka bir randevun var."
            : scheduled.length >= 3
              ? "En çok üç bekleyen randevu olabilir."
              : "",
      (next) => {
        next.appointments.push({
          id: `appointment-${next.revision}`,
          npcId: n.id,
          day: d + 1,
          minute: 1080,
          location: n.leisure,
          status: "scheduled",
        });
        next.appointments = next.appointments.slice(-48);
        memory(
          next,
          n.id,
          `Yarın saat 18.00’de ${lookup(DISTRICTS, n.leisure).name}’ta buluşacağız.`,
        );
        return "Randevu telefon takvimine eklendi.";
      },
    );
    if (n.romance) {
      add(
        `date:${n.id}`,
        `${n.name} · buluşma teklif et`,
        "120 dk, 240 TL; yakınlık +8, güven +5, romantizm +12. Yakınlık 40, güven 30 gerekir.",
        "social",
        120,
        240,
        socialReason ||
          (relation.affinity < 40 || relation.trust < 30
            ? "Karşılıklı yakınlık 40 ve güven 30 gerekir."
            : relation.lastDateDay === d
              ? "Bugün birlikte özel zaman geçirdiniz."
              : s.flags.partner && s.flags.partner !== n.id
                ? "Bir ilişkin var. Önce mevcut ilişkin hakkında açık bir karar ver."
                : ""),
        (next) => {
          const r = next.npcs[n.id];
          r.lastDateDay = d;
          r.affinity = clamp(r.affinity + 8);
          r.trust = clamp(r.trust + 5);
          r.romance = clamp(r.romance + 12);
          change(next, { stress: -14 });
          memory(next, n.id, "Birlikte özel bir akşam geçirdik; yakınlığımız arttı.");
          return `${n.name} teklifini kabul etti; birlikte zaman geçirdiniz.`;
        },
      );
      add(
        `partner:${n.id}`,
        `${n.name} · ilişkiyi konuş`,
        "İlişkiye başlamak için yakınlık 55, güven 45, romantizm 24 gerekir. Karşılıklı hazır oluş esas alınır.",
        "social",
        45,
        0,
        socialReason ||
          (s.flags.partner
            ? "Önce mevcut ilişkin hakkında bir karar ver."
            : relation.affinity < 55 || relation.trust < 45 || relation.romance < 24
              ? "Yakınlık 55, güven 45, romantizm 24 gerekir."
              : ""),
        (next) => {
          next.flags.partner = n.id;
          memory(next, n.id, "İlişkimizi birlikte adlandırdık.");
          change(next, { stress: -10 });
          return `${n.name} ile bir ilişkiye başladınız.`;
        },
      );
      if (s.flags.partner === n.id)
        add(
          `breakup:${n.id}`,
          `${n.name} · ilişkiyi bitir`,
          "30 dk; romantizm sıfırlanır, yakınlık −15, stres +10. Anılar silinmez.",
          "social",
          30,
          0,
          socialReason,
          (next) => {
            delete next.flags.partner;
            const r = next.npcs[n.id];
            r.romance = 0;
            r.affinity = clamp(r.affinity - 15);
            change(next, { stress: 10 });
            memory(next, n.id, "İlişkimizi açık bir konuşmayla bitirdik.");
            return "İlişkiniz sona erdi; ortak geçmişiniz hafızada kalır.";
          },
        );
    }
  }
  for (const appointment of s.appointments.filter((a) => a.status === "scheduled")) {
    const n = lookup(NPCS, appointment.npcId),
      remaining = (appointment.day - 1) * DAY + appointment.minute - s.time;
    add(
      `meet:${appointment.id}`,
      `${n.name} · randevuya katıl`,
      `Gün ${appointment.day}, 18.00, ${lookup(DISTRICTS, appointment.location).name}. Yakınlık +12, güven +10. ±30 dk aralığında katıl.`,
      "social",
      60,
      0,
      s.location !== appointment.location
        ? "Randevu semtine git."
        : Math.abs(remaining) > 30
          ? "Randevu saatinin 30 dk öncesi ile 30 dk sonrası arasında katılabilirsin."
          : "",
      (next) => {
        next.appointments.find((a) => a.id === appointment.id).status = "completed";
        const r = next.npcs[n.id];
        r.trust = clamp(r.trust + 10);
        r.affinity = clamp(r.affinity + 12);
        r.lastTalkDay = d;
        memory(next, n.id, "Randevuya zamanında geldin. Sözüne güveniyorum.");
        change(next, { stress: -10 });
        return "Randevuya geldin; sözünü tutman hatırlandı.";
      },
    );
    add(
      `cancel:${appointment.id}`,
      `${n.name} · randevuyu iptal et`,
      "5 dk; güven −2. Haber vermemek yerine önceden iptal edebilirsin.",
      "social",
      5,
      0,
      "",
      (next) => {
        next.appointments.find((a) => a.id === appointment.id).status = "cancelled";
        next.npcs[n.id].trust = clamp(next.npcs[n.id].trust - 2);
        memory(next, n.id, "Buluşmayı iptal edeceğini önceden haber verdin.");
        return "Randevu iptal edildi.";
      },
    );
  }
  for (const amount of [500, 1000, 5000]) {
    add(
      `deposit:${amount}`,
      `${fmt(amount)} TL bankaya yatır`,
      "Nakit bankaya geçer. Kira ve faturalar önce bankadan çekilir.",
      "finance",
      5,
      amount,
      "",
      (next) => {
        receive(next, amount, "Nakit yatırma", "bank");
        return "Para bankaya yatırıldı.";
      },
    );
    add(
      `withdraw:${amount}`,
      `${fmt(amount)} TL nakit çek`,
      "Banka bakiyesi nakde geçer. Toplam paran değişmez.",
      "finance",
      5,
      amount,
      "",
      (next) => {
        receive(next, amount, "Bankadan çekme");
        return "Nakit çekildi.";
      },
      { pay: "bank" },
    );
    add(
      `repay:${amount}`,
      `${fmt(amount)} TL borç öde`,
      "Borç anaparası azalır; sonraki 30 günlük faiz daha küçük tutara işler.",
      "finance",
      5,
      amount,
      s.debt < amount ? "Borç bu tutardan az. Tümünü ödeme seçeneğini kullan." : "",
      (next) => {
        next.debt -= amount;
        record(next, "Anapara ödemesi", -amount, "debt");
        return `${fmt(amount)} TL borç ödendi.`;
      },
      { pay: "total" },
    );
  }
  if (s.bank)
    add(
      "withdraw:all",
      `${fmt(s.bank)} TL · tüm bakiyeyi çek`,
      "Banka bakiyenin tamamını nakde çevir. Toplam paran değişmez.",
      "finance",
      5,
      s.bank,
      "",
      (next) => {
        receive(next, s.bank, "Tüm bakiyeyi çekme");
        return "Banka bakiyen nakde çevrildi.";
      },
      { pay: "bank" },
    );
  if (s.debt)
    add(
      "repay:all",
      `${fmt(s.debt)} TL · borcu kapat`,
      "Tüm borç ödenir, bir sonraki dönem borç faizi doğmaz.",
      "finance",
      5,
      s.debt,
      "",
      (next) => {
        record(next, "Borç kapama", -next.debt, "debt");
        next.debt = 0;
        return "Borç tamamen kapandı.";
      },
      { pay: "total" },
    );
  add(
    "loan",
    "5.000 TL ihtiyaç kredisi",
    "Bankaya +5.000 TL, borca +5.000 TL. Her 30 günde %3 faiz. Toplam borç sınırı 20.000 TL.",
    "finance",
    30,
    0,
    s.debt + 5000 > 20000 ? "Toplam borç sınırı 20.000 TL." : "",
    (next) => {
      next.debt += 5000;
      record(next, "Yeni kredi", 5000, "debt");
      receive(next, 5000, "Kredi kullandırım", "bank");
      document(
        next,
        `loan-${next.revision}`,
        "İhtiyaç kredisi sözleşmesi",
        "5.000 TL; her 30 günde %3 faiz; erken ödeme cezası yok.",
      );
      return "5.000 TL kredi bankana yatırıldı; aynı tutar borcuna eklendi.";
    },
  );
  if (s.housing.arrears)
    add(
      "arrears:pay",
      `${fmt(s.housing.arrears)} TL · biriken kirayı öde`,
      "Ödenmeyen kira kapanır; ev sahibi güveni +5.",
      "finance",
      10,
      s.housing.arrears,
      "",
      (next) => {
        record(next, "Birikmiş kira kapama", -next.housing.arrears, "arrears");
        next.housing.arrears = 0;
        next.npcs.leyla.trust = clamp(next.npcs.leyla.trust + 5);
        memory(next, "leyla", "Gecikmiş kirayı ödedin.");
        return "Biriken kira kapandı.";
      },
      { pay: "total" },
    );
  return actions;
}

export function getActions(s) {
  return makeActions(s).map(({ run: _run, pay: _pay, sleeping: _sleeping, ...action }) => action);
}
export function getGoals(s) {
  const friends = Object.values(s.npcs).filter((n) => n.trust >= 50 && n.affinity >= 45).length;
  const specialist = Math.max(...Object.values(s.player.skills));
  const independent = s.housing.id === "studio" || s.housing.id === "apartment";
  return [
    {
      id: "foundation",
      title: "Sağlam bir temel",
      description:
        "30. güne ulaş; 10 vardiya tamamla, sağlık en az 60 ve biriken kira sıfır olsun.",
      current: Math.min(30, dayOf(s)),
      target: 30,
      complete:
        s.achievements.includes("foundation") ||
        (dayOf(s) >= 30 &&
          s.flags.workDays >= 10 &&
          s.player.health >= 60 &&
          s.housing.arrears === 0),
    },
    {
      id: "security",
      title: "Kendi ayakların üzerinde",
      description:
        "Kendi stüdyo veya dairene taşın; borcun ve biriken kiran sıfır, toplam birikimin 15.000 TL olsun.",
      current: Math.min(15000, total(s)),
      target: 15000,
      complete:
        s.achievements.includes("security") ||
        (independent && s.debt === 0 && s.housing.arrears === 0 && total(s) >= 15000),
    },
    {
      id: "circle",
      title: "Bu şehirde yalnız değilsin",
      description: "Üç kişiyle yakınlık 45 ve güven 50 kur; en az bir randevuna katıl.",
      current: friends,
      target: 3,
      complete:
        s.achievements.includes("circle") ||
        (friends >= 3 && s.appointments.some((a) => a.status === "completed")),
    },
    {
      id: "mastery",
      title: "İşinin ustası",
      description: "Bir beceriyi 70’e çıkar, bir sertifika al ve kariyerinde terfi et.",
      current: Math.min(70, specialist),
      target: 70,
      complete:
        s.achievements.includes("mastery") ||
        (specialist >= 70 && s.flags.coursesCompleted >= 1 && Boolean(s.job && s.job.level >= 1)),
    },
  ];
}
function achievements(s) {
  const candidates = [
    ...getGoals(s)
      .filter((g) => g.complete)
      .map((g) => g.id),
  ];
  if (dayOf(s) >= 30) candidates.push("first-30-days");
  if (s.flags.coursesCompleted >= 1) candidates.push("first-certificate");
  if (s.flags.partner) candidates.push("partnership");
  if (s.flags.workDays >= 1) candidates.push("first-shift");
  for (const id of candidates)
    if (!s.achievements.includes(id)) {
      s.achievements.push(id);
      log(
        s,
        `Başarı açıldı: ${getGoals(s).find((g) => g.id === id)?.title || { "first-30-days": "İlk 30 gün", "first-certificate": "İlk sertifika", partnership: "Paylaşılan hayat", "first-shift": "İlk vardiya" }[id]}.`,
      );
    }
}
export function resolveAction(state, actionId) {
  if (typeof actionId !== "string" || !validateState(state))
    return { state, ok: false, message: "Oyun durumu veya eylem geçersiz." };
  const action = makeActions(state).find((a) => a.id === actionId);
  if (!action)
    return {
      state,
      ok: false,
      message: state.pendingEvents.length
        ? "Önce masadaki olay kartını çöz."
        : "Bu eylem şu anda mevcut değil.",
    };
  if (action.disabled) return { state, ok: false, message: action.reason };
  const s = structuredClone(state);
  s.revision++;
  spend(s, action.cost, action.label, action.pay || "cash");
  const message = action.run(s) || action.label;
  advance(s, action.minutes, { sleeping: Boolean(action.sleeping) });
  log(s, message);
  achievements(s);
  refreshEvents(s);
  if (!validateState(s)) throw new Error(`Boardworld invariant failed after ${actionId}`);
  return { state: s, ok: true, message };
}

/** Reject malformed imports before any nested state is accessed. */
export function validateState(s) {
  try {
    const obj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
    const num = (v, min = 0, max = MAX_MONEY) =>
      typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
    const int = (v, min = 0, max = MAX_MONEY) => num(v, min, max) && Number.isInteger(v);
    const str = (v, max = 2000) => typeof v === "string" && v.length <= max;
    const arr = (v, max) => Array.isArray(v) && v.length <= max;
    if (
      !obj(s) ||
      s.version !== 1 ||
      !int(s.revision, 0, 100000000) ||
      !int(s.seed, 0, 4294967295) ||
      !int(s.rng, 0, 4294967295) ||
      !int(s.time, 0, 525600000) ||
      !has(DISTRICTS, s.location)
    )
      return false;
    const p = s.player;
    if (
      !obj(p) ||
      !str(p.name, 36) ||
      !p.name.trim() ||
      !has(SCENARIOS, p.scenario) ||
      !has(EDUCATIONS, p.education) ||
      !has(TRAITS, p.trait) ||
      !obj(p.skills) ||
      Object.keys(p.skills).length !== 4 ||
      !SKILLS.every((k) => num(p.skills[k.id], 0, 100))
    )
      return false;
    if (
      !["health", "energy", "hunger", "stress"].every((k) => num(p[k], 0, 100)) ||
      !["cash", "bank", "debt"].every((k) => int(s[k]))
    )
      return false;
    const h = s.housing;
    if (
      !obj(h) ||
      !has(HOMES, h.id) ||
      !["rent", "deposit", "arrears"].every((k) => int(h[k])) ||
      !int(h.dueDay, 1, 400000)
    )
      return false;
    if (s.job !== null) {
      const j = s.job;
      if (
        !obj(j) ||
        !has(JOBS, j.id) ||
        !int(j.level, 0, 2) ||
        !int(j.shifts) ||
        !num(j.performance, 0, 100) ||
        !int(j.earned) ||
        !int(j.payDay, 1, 400000) ||
        !int(j.lastWorkDay, 0, 400000) ||
        !int(j.missed, 0, 3) ||
        !int(j.hiredDay, 1, 400000)
      )
        return false;
    }
    if (
      !obj(s.inventory) ||
      Object.keys(s.inventory).length > ITEMS.length ||
      !Object.entries(s.inventory).every(([id, n]) => has(ITEMS, id) && int(n, 0, 999))
    )
      return false;
    if (
      !arr(s.documents, 64) ||
      !s.documents.every(
        (d) =>
          obj(d) &&
          str(d.id, 80) &&
          str(d.title, 200) &&
          str(d.text, 2000) &&
          int(d.day, 1, 400000),
      )
    )
      return false;
    if (
      !arr(s.appointments, 48) ||
      !s.appointments.every(
        (a) =>
          obj(a) &&
          str(a.id, 80) &&
          has(NPCS, a.npcId) &&
          int(a.day, 1, 400000) &&
          int(a.minute, 0, 1439) &&
          has(DISTRICTS, a.location) &&
          ["scheduled", "completed", "missed", "cancelled"].includes(a.status),
      )
    )
      return false;
    if (
      !obj(s.npcs) ||
      Object.keys(s.npcs).length !== NPCS.length ||
      !NPCS.every((n) => {
        const r = s.npcs[n.id];
        return (
          obj(r) &&
          ["affinity", "trust", "romance", "mood"].every((k) => num(r[k], 0, 100)) &&
          has(DISTRICTS, r.location) &&
          [
            "lastTalkDay",
            "lastCallDay",
            "lastGiftDay",
            "lastApologyDay",
            "lastDateDay",
            "lastMentorDay",
          ].every((k) => int(r[k], 0, 400000)) &&
          arr(r.memories, 12) &&
          r.memories.every((m) => obj(m) && int(m.day, 1, 400000) && str(m.text, 1000))
        );
      })
    )
      return false;
    if (s.course !== null) {
      const c = s.course;
      if (
        !obj(c) ||
        !has(COURSES, c.id) ||
        !int(c.sessions, 0, lookup(COURSES, c.id).sessions - 1) ||
        !int(c.lastStudyDay, 0, 400000)
      )
        return false;
    }
    if (
      !obj(s.world) ||
      !["Açık", "Bulutlu", "Yağmurlu", "Rüzgârlı"].includes(s.world.weather) ||
      !num(s.world.priceIndex, 1, 2) ||
      !arr(s.world.news, 12) ||
      !s.world.news.every((n) => obj(n) && int(n.day, 1, 400000) && str(n.text, 1000))
    )
      return false;
    if (
      !arr(s.pendingEvents, 1) ||
      !s.pendingEvents.every((e) => obj(e) && has(EVENTS, e.id) && int(e.day, 1, 400000)) ||
      !arr(s.resolvedEvents, EVENTS.length) ||
      new Set(s.resolvedEvents).size !== s.resolvedEvents.length ||
      !s.resolvedEvents.every((id) => has(EVENTS, id)) ||
      s.pendingEvents.some((e) => s.resolvedEvents.includes(e.id))
    )
      return false;
    const counters = ["travels", "volunteers", "coursesCompleted", "workDays", "billsPaid"];
    const dayFlags = [
      "lastSleepDay",
      "lastSoupDay",
      "lastMedicineDay",
      "lastExerciseDay",
      "lastVolunteerDay",
      "friendRepayDay",
      ...SKILLS.map((k) => `practice-${k.id}`),
      ...NPCS.map((n) => `conflict-${n.id}`),
    ];
    const boolFlags = [
      "bookInvitation",
      "shoppingPlan",
      "portfolio",
      "courseDiscount",
      "overtime",
      "showcaseWin",
      "rentDiscount",
      "rentReviewed",
      "familyConnected",
      "careerPlan",
      "arrearsPlan",
      "housingSupport",
      "romanceTalk",
      "communityLeader",
      "debtPlan",
      "digitalAware",
      "firstMonth",
      "returnedWallet",
    ];
    if (
      !obj(s.flags) ||
      Object.keys(s.flags).length > 100 ||
      !counters.every((k) => int(s.flags[k], 0, 100000000))
    )
      return false;
    if (
      !Object.entries(s.flags).every(([k, v]) =>
        counters.includes(k)
          ? int(v, 0, 100000000)
          : dayFlags.includes(k)
            ? int(v, 1, 400000)
            : boolFlags.includes(k)
              ? typeof v === "boolean"
              : k === "partner"
                ? has(NPCS, v) && lookup(NPCS, v).romance
                : k === "homeComfort"
                  ? num(v, 0, 20)
                  : k === "friendRepayAmount"
                    ? int(v, 1, 5000)
                    : false,
      )
    )
      return false;
    if (
      !arr(s.history, 160) ||
      !s.history.every(
        (h) => obj(h) && int(h.day, 1, 400000) && int(h.time, 0, 1439) && str(h.text, 2000),
      )
    )
      return false;
    if (
      !arr(s.transactions, 160) ||
      !s.transactions.every(
        (t) =>
          obj(t) &&
          int(t.day, 1, 400000) &&
          str(t.label, 250) &&
          num(t.amount, -MAX_MONEY, MAX_MONEY) &&
          ["cash", "bank", "debt", "arrears", "earned"].includes(t.account),
      )
    )
      return false;
    const allowed = [
      "foundation",
      "security",
      "circle",
      "mastery",
      "first-30-days",
      "first-certificate",
      "partnership",
      "first-shift",
    ];
    if (
      !arr(s.achievements, allowed.length) ||
      new Set(s.achievements).size !== s.achievements.length ||
      !s.achievements.every((id) => allowed.includes(id))
    )
      return false;
    return true;
  } catch {
    return false;
  }
}
