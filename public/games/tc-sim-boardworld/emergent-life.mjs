import { NPCS, JOBS, HOMES, COURSES, SKILLS, DISTRICTS } from "./content.mjs";
import { EMPLOYERS, BUSINESS_TYPES } from "./deep-content.mjs";
import { SYSTEMIC_FAMILIES, POLICY_FIELDS } from "./emergent-content.mjs";
import { SECONDARY_PEOPLE } from "./life-content.mjs";
import {
  lifeSignals,
  fulfillHouseholdDuty,
  getLifeJobKey,
  getLifeBusinessKey,
  lifeActorMessage,
  lifeActorRelation,
} from "./life-systems.mjs";
const DAY = 1440,
  cap = (n, min = 0, max = 100) => Math.min(max, Math.max(min, n));
const day = (s) => Math.floor(s.time / DAY) + 1,
  week = (s) => Math.floor((day(s) - 1) / 7);
const by = (xs, id) => xs.find((x) => x.id === id),
  funds = (s) => s.cash + s.bank;
const active = (e) => e.status === "active" || e.status === "waiting";
const named = (id) => by(NPCS, id)?.name || by(SECONDARY_PEOPLE, id)?.name || "Ev arkadaşı";
const districtName = (id) => by(DISTRICTS, id)?.name || id;
const phaseName = (id) =>
  ({
    calm: "dengeli dönem",
    roadworks: "yol çalışması",
    investment: "yeni iş çevresi",
    pressure: "yaşam gideri baskısı",
  })[id];
const jobKey = getLifeJobKey;
const homeKey = (s) => s.life.lease.homeKey;
const businessKey = getLifeBusinessKey;
const partnerKey = (s) => s.flags.partner || "";
const skillCertificate = (s, id) =>
  s.documents.some(
    (d) => d.id.startsWith("certificate-") && by(COURSES, d.id.slice(12))?.skill === id,
  );
function entry(s, e, text, api) {
  const row = {
    eventId: e.id,
    family: e.family,
    title: e.title,
    at: s.time,
    text,
    source: e.source,
    parentId: e.parentId,
  };
  s.emergent.history.push(row);
  s.emergent.history = s.emergent.history.slice(-96);
  e.consequences.push(text);
  e.consequences = e.consequences.slice(-8);
  api.log(s, `${e.title}: ${text}`);
}
export function initEmergent(s) {
  s.emergent = {
    version: 1,
    initializedAt: s.time,
    nextId: 1,
    lastTick: s.time,
    lastSpawnDay: day(s),
    events: [],
    history: [],
    families: Object.fromEntries(
      SYSTEMIC_FAMILIES.map((f) => [f.id, { lastDay: 0, count: 0, lastId: "" }]),
    ),
    policy: {
      meal: "home",
      commute: "transit",
      practice: "none",
      practiceQuota: 1,
      bedtime: 1320,
      businessService: false,
      householdChores: false,
      autoWithdraw: false,
      days: [true, true, true, true, true, true, true],
    },
    habits: {
      day: day(s),
      week: week(s),
      practiceDay: Object.fromEntries(SKILLS.map((k) => [k.id, 0])),
      practiceWeek: Object.fromEntries(SKILLS.map((k) => [k.id, 0])),
      contacts: Object.fromEntries(NPCS.map((n) => [n.id, { lastDay: 0, streak: 0, today: 0 }])),
      recent: [],
    },
    routine: {
      stopReason: "Henüz çalıştırılmadı.",
      lastActions: [],
      skipped: [],
      performedCount: 0,
    },
    decisions: 0,
  };
  return s;
}
function resetHabits(s) {
  const h = s.emergent.habits;
  if (h.week !== week(s)) {
    h.week = week(s);
    for (const k of SKILLS) h.practiceWeek[k.id] = 0;
  }
  if (h.day !== day(s)) {
    h.day = day(s);
    for (const k of SKILLS) h.practiceDay[k.id] = 0;
    for (const n of Object.values(h.contacts)) n.today = 0;
  }
}
function seed(s, f) {
  const sig = lifeSignals(s),
    j = s.job && by(JOBS, s.job.id),
    b = s.deep.business,
    h = by(HOMES, s.housing.id),
    d = day(s);
  const base = {
    family: f.id,
    actors: [],
    source: "Gözlenen yaşam koşulları",
    contract: "",
    location: s.location,
    target: "",
    baseline: 0,
    why: "",
  };
  switch (f.id) {
    case "employment":
      if (j && s.job.shifts >= 4)
        return {
          ...base,
          variant: s.job.performance < 65 || s.player.stress > 60 ? "pressure" : "opportunity",
          actors: [by(EMPLOYERS, j.id).manager],
          source: "İşverenin yazılı plan daveti",
          contract: jobKey(s),
          location: j.district,
          baseline: s.job.shifts,
          why: `${s.job.shifts} tamamlanan vardiya, ${Math.round(s.job.performance)} performans ve ${Math.round(s.player.stress)} stres; ekip ihtiyacı ${{ balanced: "dengeli", busy: "yoğun", quiet: "sakin" }[sig.career.employerNeed] || "belirtilmedi"}.`,
        };
      break;
    case "housing":
      if (s.housing.rent && d >= s.housing.dueDay - 10)
        return {
          ...base,
          variant: s.housing.arrears ? "arrears" : "renewal",
          actors: ["leyla"],
          source: "Kira sözleşmesinin yaklaşan vadesi",
          contract: homeKey(s),
          location: h.district,
          baseline: s.housing.arrears,
          why: `Kira günü ${s.housing.dueDay}; aylık ${s.housing.rent} TL, birikmiş kira ${s.housing.arrears} TL.`,
        };
      break;
    case "neighborhood":
      if (d >= 14 && s.city.visits[s.location] >= 1)
        return {
          ...base,
          variant: sig.district.phase === "roadworks" ? "works" : "network",
          source: "Mahalledeki gözlenebilir ekonomik değişim",
          contract: s.location,
          why: `Bu semtin dönemi ${phaseName(sig.district.phase)}; yol gecikmesi ${sig.district.travelDelay} dk, hizmet katsayısı %${sig.district.servicePct}.`,
        };
      break;
    case "transport":
      if (s.flags.travels >= 3 && j && j.district !== h.district)
        return {
          ...base,
          variant: sig.district.travelDelay > 5 ? "disruption" : "commute",
          source: "Ev ve iş arasındaki gerçek güzergâh",
          contract: jobKey(s) + "|" + homeKey(s),
          location: h.district,
          baseline: s.flags.travels,
          why: `Ev ${districtName(h.district)}, iş ${districtName(j.district)}; ${s.flags.travels} yolculuk yaptın. İşe ayırdığın zamanın içinde yol da var.`,
        };
      break;
    case "education": {
      const k = SKILLS.filter((k) => s.player.skills[k.id] >= 35).sort(
        (a, b) => s.player.skills[b.id] - s.player.skills[a.id],
      )[0];
      if (k)
        return {
          ...base,
          variant: skillCertificate(s, k.id) ? "application" : "plateau",
          source: "Kendi beceri ve belge dosyan",
          target: k.id,
          baseline: s.player.skills[k.id],
          why: `${k.name} ${s.player.skills[k.id]}; ilgili sertifika ${skillCertificate(s, k.id) ? "var" : "yok"}. Tekrar ile uygulama arasındaki fark artık önemli.`,
        };
      break;
    }
    case "friendship": {
      const n = NPCS.filter(
        (n) => s.npcs[n.id].trust >= 35 && s.npcs[n.id].lastTalkDay > 0 && n.id !== s.flags.partner,
      ).sort(
        (a, b) => s.npcs[a.id].lastTalkDay - s.npcs[b.id].lastTalkDay || a.id.localeCompare(b.id),
      )[0];
      if (n)
        return {
          ...base,
          variant: d - s.npcs[n.id].lastTalkDay > 6 ? "distance" : "support",
          actors: [n.id],
          source: `${n.name} doğrudan haber gönderdi`,
          contract: n.id,
          location: s.deep.npcs[n.id].home,
          baseline: s.npcs[n.id].lastTalkDay,
          why: `${n.name} ile son yüz yüze konuşman ${s.npcs[n.id].lastTalkDay}. gündü; bu davet yalnız ikinizin bildiği geçmişe dayanıyor.`,
        };
      break;
    }
    case "romance":
      if (s.flags.partner)
        return {
          ...base,
          variant: d - s.npcs[s.flags.partner].lastDateDay > 7 ? "neglect" : "balance",
          actors: [s.flags.partner],
          source: "Partnerinin doğrudan görüşme isteği",
          contract: partnerKey(s),
          location: s.deep.npcs[s.flags.partner].home,
          baseline: s.npcs[s.flags.partner].lastDateDay,
          why: `Birlikte ayrılan son özel gün ${s.npcs[s.flags.partner].lastDateDay || "henüz yok"}. İlişki takvimde somut zaman istiyor.`,
        };
      break;
    case "household":
      if (h.id !== "shelter" && d >= 10)
        return {
          ...base,
          variant: sig.household.active ? "shared" : "upkeep",
          actors: sig.household.active ? [sig.household.actorId] : [],
          source: "Evdeki açık bakım listesi",
          contract: homeKey(s) + (sig.household.active ? "|" + sig.household.contractKey : ""),
          location: h.district,
          baseline: sig.household.missedChores,
          why: sig.household.active
            ? `Paylaşılan evde ${sig.household.missedChores} aksayan görev ve ${sig.household.unpaidShare} TL ortak sorumluluk var.`
            : "Küçük bakım işini bugün yapmak, sonraki günlerdeki dinlenme kalitesini etkiler.",
        };
      break;
    case "health":
      if (d >= 7 && (s.player.health < 72 || s.player.stress > 58 || s.player.energy < 30))
        return {
          ...base,
          variant: s.player.health < 72 ? "fatigue" : "balance",
          source: "Kendi ihtiyaç göstergelerin",
          location: h.district,
          baseline: s.player.health,
          why: `Sağlık ${Math.round(s.player.health)}, enerji ${Math.round(s.player.energy)}, stres ${Math.round(s.player.stress)}. Yoğun tempo günlük seçimlerin sonucudur.`,
        };
      break;
    case "debt":
      if (s.debt >= 1000 && d >= 7)
        return {
          ...base,
          variant: s.debt > funds(s) ? "burden" : "buffer",
          source: "Kendi borç ve banka dökümün",
          baseline: s.debt,
          why: `${s.debt} TL borç, ${funds(s)} TL kullanılabilir bakiye; mevcut geri ödeme planı ${s.deep.finance.debtPlan ? "açık" : "yok"}.`,
        };
      break;
    case "enterprise":
      if (b && d - b.openedDay >= 5 && b.clients > 0)
        return {
          ...base,
          variant: s.living.enterprise.stock < b.clients ? "shortage" : "quality",
          source: "İşletmenin kendi hizmet ve stok defteri",
          contract: businessKey(s),
          location: b.location,
          baseline: b.revenue,
          why: `${b.clients} müşteri, ${s.living.enterprise.stock} stok, ${s.living.enterprise.capital} TL işletme kasası; haftalık sabit gider sürüyor.`,
        };
      break;
    case "institutions":
      if (d >= 21 && (s.flags.coursesCompleted || s.flags.volunteers >= 3))
        return {
          ...base,
          variant: s.flags.coursesCompleted ? "qualification" : "community",
          source: "Eğitim/mahalle başvuru ilanı",
          location: "kadikoy",
          baseline: s.flags.coursesCompleted || s.flags.volunteers,
          why: `${s.flags.coursesCompleted} sertifika ve ${s.flags.volunteers} gönüllü gününün ardından somut başvuru hakkın var.`,
        };
      break;
  }
  return null;
}
function stale(s, e) {
  switch (e.family) {
    case "employment":
      return jobKey(s) !== e.contract;
    case "housing":
      return homeKey(s) !== e.contract;
    case "transport":
      return jobKey(s) + "|" + homeKey(s) !== e.contract;
    case "household": {
      const h = lifeSignals(s).household;
      return homeKey(s) + (h.active ? "|" + h.contractKey : "") !== e.contract;
    }
    case "romance":
      return partnerKey(s) !== e.contract;
    case "enterprise":
      return businessKey(s) !== e.contract;
    default:
      return false;
  }
}
function told(s, e, text, api) {
  for (const id of e.actors) lifeActorMessage(s, id, text, api);
}
function relation(s, e, trust, affinity, api, text) {
  for (const id of e.actors) lifeActorRelation(s, id, { trust, affinity }, text, api);
}
function close(s, e, status, text, api) {
  e.status = status;
  e.followAt = 0;
  entry(s, e, text, api);
}
export function tickEmergent(s, api) {
  if (!s.emergent) return;
  resetHabits(s);
  const x = s.emergent;
  for (const e of x.events.filter(active)) {
    if (stale(s, e)) {
      close(
        s,
        e,
        "cancelled",
        "Bağlı sözleşme veya ilişki değişti; eski koşullardan sonuç/ödül uygulanmadı.",
        api,
      );
      continue;
    }
    if (s.time >= e.deadline) {
      if (e.stage === 1 && e.choice === "commit")
        relation(s, e, -4, -2, api, "Üstlendiğin takip işini süresinde tamamlamadın.");
      close(
        s,
        e,
        "expired",
        e.stage
          ? "Takip süresi doldu; önceki gerçek bedeller ve kazanımlar korunur. Yeni bir çözüm için sonraki fırsatı bekle."
          : "Davetin süresi doldu; üstlenilmemiş bir söz için ceza uygulanmadı.",
        api,
      );
      continue;
    }
    if (e.status === "waiting" && s.time >= e.followAt) {
      e.status = "active";
      e.stage = 1;
      e.parentId = e.id + ":opening";
      entry(
        s,
        e,
        "Takip günü geldi. İlk kararın sonucunu tamamla, yeniden düzenle veya kapat.",
        api,
      );
    }
  }
  x.lastTick = s.time;
  if (s.pendingEvents.length || day(s) <= x.lastSpawnDay || x.events.filter(active).length >= 3)
    return;
  // Oldest eligible family first prevents health or employment from starving other real causes.
  const eligible = SYSTEMIC_FAMILIES.map((f, i) => ({ f, i, meta: x.families[f.id] })).sort(
    (a, b) => a.meta.lastDay - b.meta.lastDay || a.i - b.i,
  );
  for (const { f, meta } of eligible) {
    if (
      day(s) < 7 ||
      (meta.lastDay && day(s) - meta.lastDay < f.cooldown) ||
      x.events.some((e) => e.family === f.id && active(e))
    )
      continue;
    const c = seed(s, f);
    if (!c) continue;
    const e = {
      ...c,
      id: `sys-${x.nextId++}`,
      title: f.variants[c.variant],
      createdAt: s.time,
      startAt: s.time,
      deadline: s.time + f.window * DAY,
      followAt: 0,
      status: "active",
      stage: 0,
      choice: "",
      parentId: "",
      consequences: [],
      progress: 0,
    };
    x.events.push(e);
    while (x.events.length > 72) {
      const i = x.events.findIndex((e) => !active(e));
      if (i < 0) break;
      x.events.splice(i, 1);
    }
    meta.lastDay = day(s);
    meta.count++;
    meta.lastId = e.id;
    x.lastSpawnDay = day(s);
    entry(s, e, c.why, api);
    break;
  }
}
export function nextEmergentAt(s) {
  return Math.min(
    Infinity,
    ...(s.emergent?.events || [])
      .filter(active)
      .flatMap((e) => [e.deadline, ...(e.status === "waiting" ? [e.followAt] : [])])
      .filter((t) => t > s.time),
  );
}
function progress(s, e) {
  switch (e.family) {
    case "employment":
      return (
        (s.job?.shifts || 0) >= e.baseline + 3 &&
        (e.variant !== "pressure" || s.job.performance >= 70)
      );
    case "housing":
      return s.housing.arrears === 0;
    case "neighborhood":
      return e.progress >= 1;
    case "transport":
      return s.flags.travels >= e.baseline + 2;
    case "education":
      return e.variant === "application"
        ? e.progress >= 2
        : s.player.skills[e.target] > e.baseline || skillCertificate(s, e.target);
    case "friendship":
      return s.npcs[e.contract].lastTalkDay > Math.floor(e.startAt / DAY) + 1;
    case "romance":
      return s.npcs[e.contract]?.lastDateDay > Math.floor(e.startAt / DAY) + 1;
    case "household":
      return (
        e.progress >= 1 &&
        (e.variant !== "shared" ||
          (s.life.household?.playerDue > day(s) && !lifeSignals(s).household.unpaidShare))
      );
    case "health":
      return s.player.health >= (e.variant === "fatigue" ? 75 : 70) && s.player.stress <= 60;
    case "debt":
      return s.debt <= Math.max(0, e.baseline - 500);
    case "enterprise":
      return (s.deep.business?.revenue || 0) > e.baseline;
    case "institutions":
      return e.progress >= 1;
    default:
      return false;
  }
}
const goals = {
  employment: "Üç gerçek vardiya tamamla.",
  housing: "Biriken kirayı kapat; gerekirse ana finans panelinden ödeme yap.",
  neighborhood: "Bu semtte bir gönüllü çalışma, iş vardiyası veya yüz yüze görüşme yap.",
  transport: "Ev–iş düzeninde en az iki gerçek yolculuk yap.",
  education: "İlgili beceriyi geliştir veya ilgili sertifikayı tamamla.",
  friendship: "Davet sonrası başka bir günde yüz yüze konuş.",
  romance: "Davet sonrası başka bir günde partnerinle gerçek bir randevu yap.",
  household: "Ev bakımını tamamla; ortak evde atanmış görevi yap.",
  health: "Sağlığı en az 70, stresi en çok 60 düzeyine getir.",
  debt: "Anaparayı en az 500 TL azalt.",
  enterprise: "İşletmende gerçek bir hizmet geliri üret.",
  institutions: "Bir ders veya gönüllü günü daha tamamla.",
};
function reward(s, e, api, partial = false) {
  const scale = partial ? 1 : 2;
  switch (e.family) {
    case "employment":
      s.job.performance = cap(s.job.performance + scale * 2);
      s.deep.career.reputation = cap(s.deep.career.reputation + scale);
      break;
    case "housing":
      if (!partial && e.variant === "renewal")
        s.housing.rent = Math.max(1, Math.round(s.housing.rent * 0.98));
      relation(s, e, scale, 0, api, "İlettiğin konut bütçesi planını takip ettin.");
      break;
    case "neighborhood":
      api.skill(s, "communication", scale);
      api.change(s, { stress: -scale * 2 });
      break;
    case "transport":
      api.change(s, { stress: -scale * 3, energy: scale * 2 });
      break;
    case "education":
      api.skill(s, e.target, scale);
      s.deep.freelance.reputation = cap(s.deep.freelance.reputation + scale);
      break;
    case "friendship":
      relation(
        s,
        e,
        scale * 2,
        scale * 2,
        api,
        "Ayırdığın zaman karşılıklı güvenimizi güçlendirdi.",
      );
      break;
    case "romance":
      relation(
        s,
        e,
        scale * 2,
        scale,
        api,
        "Birlikte zaman ayırma sözünü gerçek bir görüşmeyle takip ettin.",
      );
      if (s.flags.partner)
        s.npcs[s.flags.partner].romance = cap(s.npcs[s.flags.partner].romance + scale * 2);
      break;
    case "household":
      api.change(s, { stress: -scale * 3, energy: scale * 2 });
      break;
    case "health":
      api.change(s, { health: scale * 2, stress: -scale * 2 });
      break;
    case "debt":
      api.change(s, { stress: -scale * 3 });
      break;
    case "enterprise":
      s.deep.business.reputation = cap(s.deep.business.reputation + scale * 2);
      break;
    case "institutions":
      s.deep.career.reputation = cap(s.deep.career.reputation + scale * 2);
      api.document(
        s,
        `systemic-proof-${s.revision}`,
        "Doğrulanmış uygulama kaydı",
        e.variant === "qualification"
          ? "Sertifikalı beceri ve gerçek uygulama kayda geçti."
          : "Mahallede tamamlanan emek kayda geçti.",
      );
      break;
  }
}
const terms = {
  employment: {
    cost: 0,
    minutes: 60,
    alternative: 30,
    altCost: 0,
    lead: 7,
    commit: "Gelişim dosyanı ilet",
    alternativeLabel: "İş yükü sınırını yazılı bildir",
    effect: "Stres +4; bir haftada üç vardiya ile takip. Başarı: performans +4, itibar +2.",
    altEffect: "Stres −8, performans −2; takipte daha küçük itibar kazanımı.",
  },
  housing: {
    cost: 200,
    minutes: 45,
    alternative: 30,
    altCost: 0,
    lead: 6,
    commit: "Bakım ve bütçe dosyasını hazırla",
    alternativeLabel: "Ödeme takvimi önerini ilet",
    effect: "200 TL hazırlık; takipte borçsuz yenilemede aylık kira %2 azalır.",
    altEffect: "Bedelsiz görüşme, stres +2; kira/borç silinmez, takipte güven kazanılır.",
  },
  neighborhood: {
    cost: 0,
    minutes: 90,
    alternative: 30,
    altCost: 60,
    lead: 5,
    commit: "Mahalle çalışmasına zaman ayır",
    alternativeLabel: "Yerel ihtiyaçları araştır",
    effect: "Enerji −10; gerçek yerel katılımı takipte iletişime dönüştür.",
    altEffect:
      "60 TL, 30 dk; daha küçük iletişim kazanımı, yatırım getirisi veya bedelsiz para yok.",
  },
  transport: {
    cost: 0,
    minutes: 60,
    alternative: 30,
    altCost: 0,
    lead: 5,
    commit: "İki yolculukluk düzeni dene",
    alternativeLabel: "Sınırlarını yeniden planla",
    effect: "Gerçek yolculuk ücret ve süreleri ayrıca geçerli; takipte stres/enerji rahatlaması.",
    altEffect: "Daha az taahhüt; takipte küçük stres rahatlaması. Ücretsiz ulaşım verilmez.",
  },
  education: {
    cost: 180,
    minutes: 120,
    alternative: 60,
    altCost: 0,
    lead: 7,
    commit: "Uygulama dosyası hazırla",
    alternativeLabel: "Beceri açığını değerlendir",
    effect:
      "180 TL, enerji −10; gerçek gelişim veya belge ardından beceri +2 ve serbest iş itibarı +2.",
    altEffect:
      "Ücretsiz değerlendirme; gerçek öğrenme olmadan tam başarı yok. Takipte küçük kazanım.",
  },
  friendship: {
    cost: 0,
    minutes: 30,
    alternative: 15,
    altCost: 0,
    lead: 6,
    commit: "Görüşmek için söz ver",
    alternativeLabel: "Bu hafta sınırını açıkla",
    effect: "Sonraki günlerde gerçek yüz yüze konuşma gerekir; tamamlanırsa güven/yakınlık +4.",
    altEffect: "Dürüst sınır: güven −1, takipte küçük onarım; tutulmamış söz oluşmaz.",
  },
  romance: {
    cost: 0,
    minutes: 45,
    alternative: 30,
    altCost: 0,
    lead: 7,
    commit: "Birlikte zaman için söz ver",
    alternativeLabel: "Beklentilerini yazılı açıkla",
    effect: "Gerçek randevu gerekir; takipte güven/romantizm +4. Zamanı yetiştiremezsen güven −4.",
    altEffect: "Yakınlık −2; takipte daha küçük onarım. Otomatik bağlılık kurulmaz.",
  },
  household: {
    cost: 80,
    minutes: 60,
    alternative: 30,
    altCost: 0,
    lead: 6,
    commit: "Bakımı bizzat üstlen",
    alternativeLabel: "Gider ve görevi değerlendir",
    effect:
      "80 TL, 60 dk gerçek bakım; ortak evde mevcut görev tamamlanır. Takipte dinlenme rahatlaması.",
    altEffect: "Bakım borcu silinmez; sonraki gerçek görevden sonra küçük rahatlama.",
  },
  health: {
    cost: 0,
    minutes: 120,
    alternative: 60,
    altCost: 0,
    lead: 5,
    commit: "Temponu azalt ve dinlen",
    alternativeLabel: "Kısa toparlanma arası ver",
    effect: "Enerji +24, stres −12; takipte sağlık ≥70 / stres ≤60 ise sağlık +4.",
    altEffect:
      "Enerji +10, stres −5; daha küçük takip kazanımı. Tedavi veya bedelsiz tam sağlık değildir.",
  },
  debt: {
    cost: 500,
    minutes: 30,
    alternative: 30,
    altCost: 0,
    lead: 7,
    commit: "500 TL anapara öde",
    alternativeLabel: "Ödeme gücünü yeniden değerlendir",
    effect: "500 TL gerçek anapara ödemesi, nakit/banka −500 ve borç −500; takipte stres rahatlar.",
    altEffect: "Borç/faiz silinmez. Sonraki haftada gerçek ödeme yaparsan küçük stres rahatlaması.",
  },
  enterprise: {
    cost: 120,
    minutes: 90,
    alternative: 45,
    altCost: 0,
    lead: 7,
    commit: "Kalite ve müşteri dosyasını hazırla",
    alternativeLabel: "Stok riskini değerlendir",
    effect: "120 TL kişisel danışma gideri, enerji −8; gerçek hizmet geliri sonrası itibar +4.",
    altEffect: "Ücretsiz stok değerlendirmesi; stok/sermaye yaratılmaz, takipte itibar +2.",
  },
  institutions: {
    cost: 150,
    minutes: 90,
    alternative: 45,
    altCost: 0,
    lead: 7,
    commit: "Uygulama doğrulamasına başvur",
    alternativeLabel: "Dosyadaki eksiği öğren",
    effect: "150 TL başvuru; bir gerçek ders/gönüllü günü ardından belge ve mesleki itibar +4.",
    altEffect: "Ücretsiz ön görüşme; sonraki gerçek katılımla daha küçük itibar kazanımı.",
  },
};
function eventTerms(e) {
  const t = { ...terms[e.family] };
  switch (e.family) {
    case "employment":
      if (e.variant === "pressure") {
        t.minutes = 90;
        t.lead = 5;
        t.effect =
          "90 dk, stres +4; beş gün sonra üç gerçek vardiya ve en az 70 performans ile toparlanma takibi.";
      }
      break;
    case "housing":
      if (e.variant === "arrears") {
        t.cost = 0;
        t.effect =
          "Ücretsiz bütçe dosyası; gerçek kira birikimi kapandıktan sonra güven artar. Borç ve kira silinmez.";
      }
      break;
    case "neighborhood":
      if (e.variant === "works") {
        t.minutes = 120;
        t.effect =
          "Yol çalışmasının etkisini yerinde izle:120 dk, enerji −10. Sonraki yerel katılımla takip edilir.";
      }
      break;
    case "transport":
      if (e.variant === "disruption") {
        t.minutes = 90;
        t.lead = 7;
        t.effect =
          "90 dk güzergâh araştırması, bir haftada iki gerçek yolculuk; ücret ve gecikmeler ayrıca uygulanır.";
      }
      break;
    case "education":
      if (e.variant === "application") {
        t.cost = 250;
        t.minutes = 150;
        t.effect =
          "250 TL,150 dk; mevcut sertifikaya ek iki gerçek uygulama oturumu gerekir. Takipte beceri ve serbest iş itibarı +2.";
      }
      break;
    case "friendship":
      if (e.variant === "distance") {
        t.minutes = 45;
        t.lead = 7;
        t.effect =
          "45 dk iletişim planı; sonraki günlerde gerçek yüz yüze görüşme ve bir haftalık takip. Güven/yakınlık +4.";
      }
      break;
    case "romance":
      if (e.variant === "neglect") {
        t.minutes = 60;
        t.lead = 9;
        t.effect =
          "60 dk beklenti değerlendirmesi; dokuz gün içinde gerçek randevu ile takip. Tutulmamış söz güveni etkiler.";
      }
      break;
    case "household":
      if (e.variant === "upkeep") {
        t.cost = 120;
        t.minutes = 90;
        t.effect =
          "120 TL,90 dk ev bakımı; altı gün sonraki takipte enerji +4 ve stres −6. Ortak evdeki80 TL göreviyle aynı işlem değildir.";
      }
      break;
    case "health":
      if (e.variant === "fatigue") {
        t.minutes = 180;
        t.effect =
          "180 dk dinlenme, enerji +24/stres −12; takipte sağlık en az 75 ve stres en çok 60 olmalı.";
      }
      break;
    case "debt":
      if (e.variant === "buffer") {
        t.cost = 1000;
        t.commit = "1.000 TL anapara öde";
        t.effect =
          "1.000 TL gerçek anapara ödemesi; kullanılabilir bakiye ve borç aynı miktarda azalır. Acil durum için daha az nakit kalır.";
      }
      break;
    case "enterprise":
      if (e.variant === "shortage") {
        t.cost = 0;
        t.minutes = 60;
        t.effect =
          "60 dk stok planı; malzeme veya sermaye verilmez. Gerçek stok alımı ve ücretli hizmetten sonra itibar takibi.";
      }
      break;
    case "institutions":
      if (e.variant === "community") {
        t.cost = 0;
        t.minutes = 120;
        t.lead = 10;
        t.effect =
          "120 dk ücretsiz mahalle dosyası; on gün içindeki gerçek gönüllü günüyle belge ve itibar takibi.";
      }
      break;
  }
  return t;
}
function opening(s, e, route, api) {
  e.choice = route;
  e.status = "waiting";
  e.followAt = s.time + eventTerms(e).lead * DAY;
  e.deadline = e.followAt + 7 * DAY;
  const commit = route === "commit";
  if (commit) {
    if (e.family === "employment") api.change(s, { stress: 4 });
    if (["neighborhood", "education"].includes(e.family)) api.change(s, { energy: -10 });
    if (e.family === "enterprise") api.change(s, { energy: -8 });
    if (e.family === "household") {
      fulfillHouseholdDuty(s, api);
      e.progress = 1;
      api.change(s, { energy: -6 });
    }
    if (e.family === "health") api.change(s, { energy: 24, stress: -12 });
    if (e.family === "debt") {
      const paid = eventTerms(e).cost;
      s.debt -= paid;
      api.record(s, "Nedensel ödeme planı · anapara", -paid, "debt");
    }
  } else {
    if (e.family === "employment") {
      api.change(s, { stress: -8 });
      s.job.performance = cap(s.job.performance - 2);
    }
    if (e.family === "housing") api.change(s, { stress: 2 });
    if (e.family === "friendship")
      relation(s, e, -1, 0, api, "Bu haftaki zaman sınırını açıkça anlattın.");
    if (e.family === "romance")
      relation(s, e, 0, -2, api, "Birlikte ayrılabilecek zamanı mesajında açıkça anlattın.");
    if (e.family === "health") api.change(s, { energy: 10, stress: -5 });
  }
  told(
    s,
    e,
    commit
      ? "Takip planını doğrudan yazılı olarak ilettin."
      : "Bu hafta daha sınırlı bir yol seçtiğini mesajla ilettin.",
    api,
  );
  s.emergent.decisions++;
  entry(
    s,
    e,
    `${commit ? terms[e.family].commit : terms[e.family].alternativeLabel}. Takip günü ${Math.floor(e.followAt / DAY) + 1}. ${goals[e.family]}`,
    api,
  );
}
export function emergentActions(s, api) {
  if (!s.emergent) return [];
  const actions = [];
  const add = (id, label, description, minutes, cost, reason, run, extra = {}) =>
    actions.push({
      id,
      label,
      description,
      minutes,
      cost,
      category: "systemic",
      disabled: !!reason,
      reason,
      run,
      pay: "total",
      ...extra,
    });
  for (const e of s.emergent.events.filter((e) => e.status === "active")) {
    const prefix = `systemic:${e.id}:`,
      t = eventTerms(e),
      where = s.location !== e.location ? "Önce kartın gösterdiği semte git." : "",
      staleReason = stale(s, e) ? "Bu kartın bağlı olduğu sözleşme değişti." : "";
    if (e.stage === 0) {
      for (const route of ["commit", "adapt"]) {
        const cost = route === "commit" ? t.cost : t.altCost,
          mins = route === "commit" ? t.minutes : t.alternative;
        add(
          prefix + route,
          route === "commit" ? t.commit : t.alternativeLabel,
          (e.actors.length
            ? "Bu bir yazılı plan ve kişisel hazırlıktır; karşı tarafın takvimini ayırmaz. "
            : "") +
            (route === "commit" ? t.effect : t.altEffect) +
            ` ${t.lead} gün sonra takip. ${goals[e.family]}`,
          mins,
          cost,
          staleReason ||
            where ||
            (s.player.energy < 15 ? "En az 15 enerji gerekir." : "") ||
            (e.family === "debt" && route === "commit" && s.debt < cost
              ? "Anapara seçilen ödeme miktarından az."
              : "") ||
            (funds(s) < cost ? "Bu kararın gerçek bedeli için bakiyen yetersiz." : ""),
          (n) => {
            opening(
              n,
              n.emergent.events.find((x) => x.id === e.id),
              route,
              api,
            );
            return "Takip planı kayda geçti; sonuç hemen verilmedi.";
          },
        );
      }
      if (e.family === "enterprise") {
        const type = by(BUSINESS_TYPES, s.deep.business?.id);
        add(
          prefix + "trial",
          "Yeni hizmeti küçük bir örnekle dene",
          "250 TL kişisel deney gideri, bir hazır stok ve 90 dk. Müşteri geri bildirimi belirsiz: d6 + ilgili beceri 50 ise 1; toplam 4+ işletme itibarı +5, aksi durumda −3. Para ödülü yok; yedi gün sonraki takip gerçek satış gerektirir.",
          90,
          250,
          staleReason ||
            where ||
            (!s.living.enterprise.stock ? "Deneme için önceden alınmış bir stok gerekir." : "") ||
            (funds(s) < 250 ? "250 TL gerçek deney gideri gerekir." : "") ||
            (s.player.energy < 20 ? "En az 20 enerji gerekir." : ""),
          (n) => {
            const x = n.emergent.events.find((item) => item.id === e.id);
            opening(n, x, "adapt", api);
            x.choice = "trial";
            n.living.enterprise.stock--;
            n.deep.business.costs = Math.min(1e9, n.deep.business.costs + 250);
            const die = api.roll(n),
              bonus = n.player.skills[type.skill] >= 50 ? 1 : 0;
            const gain = die + bonus >= 4 ? 5 : -3;
            n.deep.business.reputation = cap(n.deep.business.reputation + gain);
            api.change(n, { energy: -8, stress: gain < 0 ? 5 : -2 });
            entry(
              n,
              x,
              `Hizmet örneği: zar ${die} + beceri ${bonus}; işletme itibarı ${gain > 0 ? "+" : ""}${gain}. Bir stok tüketildi; para kazanılmadı.`,
              api,
            );
            return "Denemenin gerçek gideri ve belirsiz geri bildirimi kayda geçti.";
          },
          { uncertain: true },
        );
      }
    } else {
      const ready = progress(s, e);
      add(
        prefix + "finish",
        "Takibi tamamla",
        `${goals[e.family]} ${ready ? "Koşul sağlandı." : "Henüz sağlanmadı."} ${e.choice === "commit" ? t.effect : t.altEffect}`,
        30,
        0,
        staleReason || where || (!ready ? "İlk kararın takip koşulu henüz sağlanmadı." : ""),
        (n) => {
          const x = n.emergent.events.find((x) => x.id === e.id);
          reward(n, x, api, x.choice !== "commit");
          n.emergent.decisions++;
          close(
            n,
            x,
            "resolved",
            "İlk karar, aradaki gerçek faaliyetler ve bugünkü takip birlikte kalıcı sonucu oluşturdu.",
            api,
          );
          return "Takip tamamlandı; sonuç yaşam durumuna işlendi.";
        },
      );
      add(
        prefix + "repair",
        "Eksik planı kapat ve toparlan",
        "90 dk, 100 TL; tam ödül verilmez. Tutulmamış beklenti açıkça kapatılır; stres −3. Aynı kart yeniden gelir üretmez.",
        90,
        100,
        staleReason || where || (funds(s) < 100 ? "100 TL gerçek toparlanma gideri gerekir." : ""),
        (n) => {
          const x = n.emergent.events.find((x) => x.id === e.id);
          api.change(n, { stress: -3 });
          told(n, x, "Planı tamamlayamadığını söyleyip eksik yükümlülüğü kapattın.", api);
          n.emergent.decisions++;
          close(
            n,
            x,
            "resolved",
            "Eksik plan emek ve giderle kapatıldı; tam başarı ödülü uygulanmadı.",
            api,
          );
          return "Plan kapatıldı; yeni bir düzen kurabilirsin.";
        },
      );
    }
    add(
      prefix + "decline",
      e.stage ? "Takibi bırak" : "Bu fırsatı üstlenme",
      "5 dk. Başlangıçta üstlenilmeyen söz için ceza yok; verilmiş takip sözü bırakılırsa ilgili kişilerin güveni −4. Önceki bedeller iade edilmez.",
      5,
      0,
      "",
      (n) => {
        const x = n.emergent.events.find((x) => x.id === e.id);
        if (x.stage && x.choice === "commit")
          relation(n, x, -4, -2, api, "Verdiğin takip sözünden açıkça vazgeçtin.");
        n.emergent.decisions++;
        close(
          n,
          x,
          "resolved",
          x.stage
            ? "Takipten vazgeçildi; önceki sonuçlar silinmedi."
            : "Davet üstlenilmedi; başka alanlara zaman bırakıldı.",
          api,
        );
        return "Kararın kayda geçti.";
      },
    );
  }
  for (const f of POLICY_FIELDS)
    for (const [value, label, description] of f.choices) {
      const v = ["businessService", "householdChores", "autoWithdraw"].includes(f.id)
        ? value === "true"
        : ["bedtime", "practiceQuota"].includes(f.id)
          ? Number(value)
          : value;
      actions.push({
        id: `policy:${f.id}:${value}`,
        label: `${f.title}: ${label}`,
        description,
        category: "policy",
        minutes: 0,
        cost: 0,
        disabled: s.emergent.policy[f.id] === v,
        reason: s.emergent.policy[f.id] === v ? "Bu politika zaten seçili." : "",
        run: (n) => {
          n.emergent.policy[f.id] = v;
          return "Rutin politikası açık seçiminle güncellendi.";
        },
      });
    }
  for (let i = 0; i < 7; i++)
    actions.push({
      id: `policy:day:${i}`,
      label: `${["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"][i]}: ${s.emergent.policy.days[i] ? "rutin açık → kapat" : "rutin kapalı → aç"}`,
      description: "Kapalı günde otomasyon zaman atlamaz; günü kendin yönetirsin.",
      category: "policy",
      minutes: 0,
      cost: 0,
      disabled: false,
      reason: "",
      run: (n) => {
        n.emergent.policy.days[i] = !n.emergent.policy.days[i];
        return "Haftalık rutin günü güncellendi.";
      },
    });
  return actions;
}
export function practiceStatus(s, id) {
  const h = s.emergent.habits,
    today = h.day === day(s) ? h.practiceDay[id] : 0,
    w = h.week === week(s) ? h.practiceWeek[id] : 0;
  const reason =
    s.player.skills[id] >= 100
      ? "Bu beceri üst sınırında; tekrar gelişim sağlamaz."
      : s.player.skills[id] >= 85 && !skillCertificate(s, id)
        ? "85 üzeri bireysel uzmanlık çalışması için ilgili kurs sertifikası gerekir."
        : today >= 2
          ? "Bugün bu beceride iki oturumu tamamladın."
          : w >= 5
            ? "Bu hafta beş bireysel oturum tamamlandı; ders, uygulama veya dinlenmeye geç."
            : "";
  return { today, week: w, reason, factor: (w >= 3 ? 0.5 : 1) * (today ? 0.5 : 1) };
}
export function adaptEmergentActions(s, actions, _api) {
  if (!s.emergent) return actions;
  for (const a of actions) {
    if (a.id.startsWith("practice:")) {
      const id = a.id.split(":")[1],
        p = practiceStatus(s, id);
      if (!p.reason && a.reason === "Bugün bu beceriyi çalıştın.") {
        a.disabled = false;
        a.reason = "";
      }
      if (p.reason) {
        a.disabled = true;
        a.reason = p.reason;
      }
      a.description = a.description.replace(
        "Her beceri günde bir kez.",
        "En çok iki oturum; ikinci oturum yarı getiri.",
      );
      a.description += ` Bu hafta ${p.week}/5; ${p.factor < 1 ? "dördüncü ve beşinci oturumda yarı getiri." : "ilk üç oturum tam getiri."} 85 üzeri ilgili sertifika gerektirir.`;
      const run = a.run;
      a.run = (n) => {
        const before = n.player.skills[id],
          msg = run(n);
        const earned = n.player.skills[id] - before;
        // Keep a genuinely earned fractional gain visible at the mastery boundary.
        // Rounding must not turn an enabled, paid-in-time session into zero progress.
        n.player.skills[id] = cap(
          Math.round(
            (before + (earned > 0 ? Math.max(0.1, Math.round(earned * p.factor * 10) / 10) : 0)) *
              10,
          ) / 10,
        );
        return msg;
      };
    }
    if (a.id === "rest" && s.player.energy >= 95 && s.player.stress === 0) {
      a.disabled = true;
      a.reason = "Enerji ve stres zaten dengede; zaman için bekleme veya takvim eylemi seç.";
    }
    if (/^(talk|call):/.test(a.id)) {
      const id = a.id.split(":")[1],
        h = s.emergent.habits.contacts[id];
      if (!h) continue;
      const streak = h.lastDay >= day(s) - 1 ? h.streak : 0,
        factor = h.today || streak >= 4 ? 0.25 : streak >= 2 ? 0.5 : 1;
      a.description +=
        factor < 1
          ? " Aynı kişiye ardışık tekrar: olumlu ilişki artışı azalır; yeni bilgi, söz ve çatışmalar gerçek etkisini korur."
          : "";
      const run = a.run;
      a.run = (n) => {
        const before = { trust: n.npcs[id].trust, affinity: n.npcs[id].affinity },
          msg = run(n);
        for (const k of ["trust", "affinity"])
          if (n.npcs[id][k] > before[k])
            n.npcs[id][k] =
              Math.round((before[k] + (n.npcs[id][k] - before[k]) * factor) * 10) / 10;
        return msg;
      };
    }
  }
  return actions;
}
export function afterEmergentAction(s, id, before, api) {
  if (!s.emergent) return;
  resetHabits(s);
  const h = s.emergent.habits;
  if (id.startsWith("practice:")) {
    const k = id.split(":")[1];
    h.practiceDay[k]++;
    h.practiceWeek[k]++;
  }
  if (/^(talk|call):/.test(id)) {
    const n = h.contacts[id.split(":")[1]];
    if (n) {
      const d = day(s);
      if (n.lastDay !== d) n.streak = n.lastDay === d - 1 ? Math.min(30, n.streak + 1) : 1;
      n.lastDay = d;
      n.today = Math.min(8, n.today + 1);
    }
  }
  if (!id.startsWith("policy:")) {
    h.recent.push({ id: id.slice(0, 120), at: s.time });
    h.recent = h.recent.slice(-32);
  }
  for (const e of s.emergent.events.filter((e) => e.status === "waiting")) {
    if (
      e.family === "neighborhood" &&
      before.location === e.location &&
      (id === "work" || id === "volunteer" || id.startsWith("talk:"))
    )
      e.progress = Math.min(100, e.progress + 1);
    if (e.family === "household" && (id.includes("chore") || id.includes("maintenance")))
      e.progress = 1;
    if (
      e.family === "education" &&
      (id === `practice:${e.target}` ||
        (id === "study" && by(COURSES, before.course?.id)?.skill === e.target) ||
        (id === "work" && by(JOBS, before.job?.id)?.skill === e.target))
    )
      e.progress = Math.min(100, e.progress + 1);
    if (e.family === "institutions" && (id === "study" || id === "volunteer")) e.progress = 1;
  }
  tickEmergent(s, api);
}
export function getEmergentView(s) {
  if (!s.emergent)
    return {
      events: [],
      history: [],
      policy: null,
      habits: { practice: [], contacts: [], recent: [] },
      summary: { activeDecisions: 0, waitingFollowups: 0, nextDeadline: 0, headline: "" },
    };
  const x = s.emergent,
    events = x.events.filter(active).map((e) => ({
      id: e.id,
      family: e.family,
      title: e.title,
      variant: e.variant,
      why: e.why,
      source: e.source,
      actors: e.actors.map((id) => ({ id, name: named(id) })),
      location: e.location,
      startAt: e.startAt,
      deadline: e.deadline,
      status: e.status,
      parentId: e.parentId,
      consequences: [...e.consequences],
      actionIds:
        e.status === "active"
          ? [
              ...(e.stage
                ? ["finish", "repair"]
                : ["commit", "adapt", ...(e.family === "enterprise" ? ["trial"] : [])]),
              "decline",
            ].map((c) => `systemic:${e.id}:${c}`)
          : [],
      followAt: e.followAt,
      goal:
        goals[e.family] +
        (e.family === "education" && e.variant === "application"
          ? " İki gerçek uygulama oturumu gerekir."
          : ""),
      ready: progress(s, e),
    }));
  return {
    events,
    history: x.history.map((h) => ({ ...h })),
    policy: { ...x.policy, days: [...x.policy.days] },
    habits: {
      practice: SKILLS.map((k) => ({ id: k.id, name: k.name, ...practiceStatus(s, k.id) })),
      contacts: NPCS.filter((n) => x.habits.contacts[n.id].lastDay).map((n) => ({
        id: n.id,
        name: n.name,
        ...x.habits.contacts[n.id],
      })),
      recent: x.habits.recent.map((r) => ({ ...r })),
    },
    summary: {
      activeDecisions: events.filter((e) => e.status === "active").length,
      waitingFollowups: events.filter((e) => e.status === "waiting").length,
      nextDeadline: events.length ? Math.min(...events.map((e) => e.deadline)) : 0,
      headline: events.some((e) => e.status === "active")
        ? "Koşullarından doğan bir karar seni bekliyor."
        : "Dünya ve verdiğin sözler zamanla sonuç üretir.",
    },
    routine: {
      ...x.routine,
      lastActions: [...x.routine.lastActions],
      skipped: [...x.routine.skipped],
    },
  };
}
export function validateEmergent(s) {
  try {
    const x = s.emergent,
      obj = (v) => v && typeof v === "object" && !Array.isArray(v),
      keys = (v, ks) =>
        obj(v) && Object.keys(v).sort().join(" ") === ks.split(" ").sort().join(" "),
      int = (v, a = 0, b = 1e9) => Number.isInteger(v) && v >= a && v <= b,
      str = (v, n = 1000) => typeof v === "string" && v.length <= n,
      arr = (v, n) => Array.isArray(v) && v.length <= n,
      district = (v) => ["kadikoy", "besiktas", "sisli"].includes(v),
      time = (v) => int(v, 0, 525600000),
      ids = SYSTEMIC_FAMILIES.map((f) => f.id);
    if (
      !keys(
        x,
        "version initializedAt nextId lastTick lastSpawnDay events history families policy habits routine decisions",
      ) ||
      x.version !== 1 ||
      !time(x.initializedAt) ||
      x.initializedAt > s.time ||
      !time(x.lastTick) ||
      x.lastTick > s.time ||
      !int(x.nextId, 1) ||
      !int(x.lastSpawnDay, 1, 400000) ||
      !int(x.decisions) ||
      !keys(x.families, ids.join(" "))
    )
      return false;
    for (const m of Object.values(x.families))
      if (
        !keys(m, "lastDay count lastId") ||
        !int(m.lastDay, 0, 400000) ||
        !int(m.count) ||
        !str(m.lastId, 40)
      )
        return false;
    const p = x.policy;
    if (
      !keys(
        p,
        "meal commute practice practiceQuota bedtime businessService householdChores autoWithdraw days",
      ) ||
      !["home", "frugal", "eat"].includes(p.meal) ||
      !["transit", "free"].includes(p.commute) ||
      !["none", ...SKILLS.map((k) => k.id)].includes(p.practice) ||
      ![1, 2].includes(p.practiceQuota) ||
      ![1200, 1320, 1380].includes(p.bedtime) ||
      !["businessService", "householdChores", "autoWithdraw"].every(
        (k) => typeof p[k] === "boolean",
      ) ||
      !arr(p.days, 7) ||
      p.days.length !== 7 ||
      !p.days.every((v) => typeof v === "boolean")
    )
      return false;
    const h = x.habits;
    if (
      !keys(h, "day week practiceDay practiceWeek contacts recent") ||
      !int(h.day, 1, 400000) ||
      !int(h.week, 0, 60000) ||
      !keys(h.practiceDay, SKILLS.map((k) => k.id).join(" ")) ||
      !keys(h.practiceWeek, SKILLS.map((k) => k.id).join(" ")) ||
      !Object.values(h.practiceDay).every((v) => int(v, 0, 2)) ||
      !Object.values(h.practiceWeek).every((v) => int(v, 0, 7)) ||
      !keys(h.contacts, NPCS.map((n) => n.id).join(" ")) ||
      !arr(h.recent, 32) ||
      !h.recent.every((r) => keys(r, "id at") && str(r.id, 120) && time(r.at))
    )
      return false;
    if (
      !Object.values(h.contacts).every(
        (c) =>
          keys(c, "lastDay streak today") &&
          int(c.lastDay, 0, 400000) &&
          int(c.streak, 0, 30) &&
          int(c.today, 0, 8),
      )
    )
      return false;
    const r = x.routine;
    if (
      !keys(r, "stopReason lastActions skipped performedCount") ||
      !str(r.stopReason, 2000) ||
      !arr(r.lastActions, 96) ||
      !r.lastActions.every((v) => str(v, 120)) ||
      !arr(r.skipped, 32) ||
      !r.skipped.every((v) => str(v, 500)) ||
      !int(r.performedCount, 0, 96)
    )
      return false;
    if (
      !arr(x.events, 72) ||
      new Set(x.events.map((e) => e.id)).size !== x.events.length ||
      x.events.filter(active).length > 3
    )
      return false;
    for (const e of x.events) {
      const f = by(SYSTEMIC_FAMILIES, e.family);
      if (
        !keys(
          e,
          "family actors source contract location target baseline why variant id title createdAt startAt deadline followAt status stage choice parentId consequences progress",
        ) ||
        !f ||
        !Object.hasOwn(f.variants, e.variant) ||
        !/^sys-[1-9]\d*$/.test(e.id) ||
        Number(e.id.slice(4)) >= x.nextId ||
        !str(e.title, 160) ||
        !arr(e.actors, 2) ||
        !e.actors.every(
          (id) => str(id, 80) && (by(NPCS, id) || s.life.secondary.some((n) => n.id === id)),
        ) ||
        !str(e.source, 160) ||
        !str(e.contract, 200) ||
        !district(e.location) ||
        !["", ...SKILLS.map((k) => k.id)].includes(e.target) ||
        typeof e.baseline !== "number" ||
        !Number.isFinite(e.baseline) ||
        e.baseline < 0 ||
        e.baseline > 1e9 ||
        !str(e.why) ||
        !["createdAt", "startAt", "deadline", "followAt"].every((k) => time(e[k])) ||
        e.deadline <= e.createdAt ||
        e.createdAt > s.time ||
        !["active", "waiting", "resolved", "expired", "cancelled"].includes(e.status) ||
        ![0, 1].includes(e.stage) ||
        !["", "commit", "adapt", "trial"].includes(e.choice) ||
        (e.choice === "trial" && e.family !== "enterprise") ||
        !str(e.parentId, 80) ||
        !arr(e.consequences, 8) ||
        !e.consequences.every((v) => str(v, 2000)) ||
        !int(e.progress, 0, 100)
      )
        return false;
      if (new Set(e.actors).size !== e.actors.length || e.startAt !== e.createdAt) return false;
      if (e.family === "education" ? !by(SKILLS, e.target) : e.target !== "") return false;
      if (
        ["friendship", "romance"].includes(e.family) &&
        (e.actors.length !== 1 || !by(NPCS, e.contract) || e.actors[0] !== e.contract)
      )
        return false;
      if (e.family === "romance" && !by(NPCS, e.contract)?.romance) return false;
      if (e.stage === 1 && !e.choice) return false;
      if (e.status === "active" && (e.stage === 0 ? e.choice !== "" : e.followAt > s.time))
        return false;
      if (active(e) && e.deadline <= s.time) return false;
      if (active(e) && stale(s, e)) return false;
      if (
        e.status === "waiting" &&
        (!e.followAt || e.stage !== 0 || !e.choice || e.followAt >= e.deadline)
      )
        return false;
    }
    return (
      arr(x.history, 96) &&
      x.history.every(
        (r) =>
          keys(r, "eventId family title at text source parentId") &&
          str(r.eventId, 40) &&
          ids.includes(r.family) &&
          str(r.title, 160) &&
          time(r.at) &&
          r.at <= s.time &&
          str(r.text, 2000) &&
          str(r.source, 160) &&
          str(r.parentId, 80),
      )
    );
  } catch {
    return false;
  }
}
