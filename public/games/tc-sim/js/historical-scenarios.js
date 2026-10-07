import { dateAtWeek, syncGameDate } from "./game-date.js?v=10";
const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, Number(value) || 0));

export const HISTORICAL_END_DATE = "2030-01-01";
export const HISTORICAL_SCENARIO_VERSION = 2;
export const HISTORICAL_SOURCES = {
  tcmb1980: { title: "Merkez Bankası Tarihçesi — 1980 Sonrası Dönem", url: "https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Banka+Hakkinda/Tarihce/", date: "Yayın tarihi belirtilmemiş; erişim 30 Eylül 2026", role: "TCMB kurumsal tarih sayfası; 24 Ocak kararları anlatısı", claim: "24 Ocak 1980 kararlarının Türkiye ekonomisinde yapısal dönüşüm başlattığını kaydediyor." },
  tcmb1994: { title: "Merkez Bankası Tarihçesi — 1980 Sonrası Dönem", url: "https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Banka+Hakkinda/Tarihce/", date: "Yayın tarihi belirtilmemiş; erişim 30 Eylül 2026", role: "TCMB kurumsal tarih sayfası; 1994 finansal kriz anlatısı", claim: "1994'ün ilk çeyreğinde finansal kriz yaşandığını kaydediyor." },
  tcmb2000: { title: "Merkez Bankası Tarihçesi — 2001 Krizi ve Sonrası", url: "https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Banka+Hakkinda/Tarihce/", date: "Yayın tarihi belirtilmemiş; erişim 30 Eylül 2026", role: "TCMB kurumsal tarih sayfası; 2000 programı anlatısı", claim: "2000 yılında döviz kuruna dayalı istikrar programının yürürlüğe konduğunu kaydediyor." },
  tcmb2001: { title: "Para Politikası Çerçevesi — 2001 Krizi Sonrası Yapısal Değişiklikler", url: "https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Temel+Faaliyetler/Para+Politikasi/Para+Politikasi+Cerceve", date: "Yayın tarihi belirtilmemiş; erişim 30 Eylül 2026", role: "TCMB resmî para politikası açıklaması; kriz sonrası rejim anlatısı", claim: "2001 krizi sonrasında programın sona erdiğini ve 22 Şubat'ta dalgalı kura geçildiğini kaydediyor." },
  tcmb2005: { title: "TCMB Sanal Müze — Banknot Basımının Tarihçesi", url: "https://sanalmuze.tcmb.gov.tr/wps/wcm/connect/sanalmuze/tr/main%20menu/banknotlar/banknot%20basiminin%20tarihcesi", date: "Yayın tarihi belirtilmemiş; erişim 30 Eylül 2026", role: "TCMB Sanal Müze; resmî banknot dolaşıma giriş tarihçesi", claim: "Altı sıfırın atıldığını ve Yeni Türk lirası banknotlarının 1 Ocak 2005'te dolaşıma verildiğini kaydediyor." },
  tcmb2008: { title: "2009 Yıllık Rapor", url: "https://www.tcmb.gov.tr/wps/wcm/connect/95d30d54-335f-4540-847d-9068a4322c69/09turkce.pdf", date: "2009 (rapor yılı)", role: "TCMB yıllık ekonomik raporu", claim: "2008 sonlarında derinleşen küresel finansal krizi ve ekonomik etkinlik etkilerini kaydediyor." },
  wb2020: { title: "Turkey Economic Monitor — World Bank announcement", url: "https://www.worldbank.org/en/news/press-release/2020/08/11/in-turkey-continued-containment-of-virus-support-to-vulnerable-households-and-effective-economic-policy-mix-key-to-building-sustained-recovery-says-world-bank", date: "11 Ağustos 2020", role: "Dünya Bankası ekonomik izleme duyurusu", claim: "Pandeminin ekonomik etkileri ve Türkiye'nin ekonomik yanıtını değerlendiriyor." },
};
export const HISTORICAL_STARTS = [
  { id: "present_day", title: "Günümüz", startDate: null, endDate: null, playable: true },
  { id: "1999-04-18", title: "18 Nisan 1999", startDate: "1999-04-18", endDate: HISTORICAL_END_DATE, playable: true, seedRequired: false },
  { id: "2017-04-18", title: "18 Nisan 2017", startDate: "2017-04-18", endDate: "2030-01-01", playable: true, seedRequired: false },
  { id: "1980s", title: "1980'lerden rastgele başlangıç", startDate: null, endDate: HISTORICAL_END_DATE, playable: true, seedRequired: true },
];

// Context is intentionally qualitative. Player choice effects use existing game scales,
// not invented historical statistics.
const COMMON_EFFECTS = {
  work: { career: 2, money: 1, health: -1 },
  study: { education: 3, energy: -2 },
  save: { money: 2, stress: 1, access: -1 },
  family: { family: 3, energy: -1, money: -1 },
  move: { access: 2, money: -2, family: -1 },
  rest: { health: 2, stress: -2, career: -1 },
};
const choices = (labels = ["İşe ve beceriye yatırım yap", "Eğitime zaman ayır", "Harcamayı kıs ve birikim yap", "Aile/çevre desteğini güçlendir", "Yeni yere/olanağa yönel", "Yükü azaltıp dinlen"]) =>
  labels.map((label, index) => ({ id: ["work", "study", "save", "family", "move", "rest"][index], label }));

const PACKS = {
  "1999-04-18": {
    title: "18 Nisan 1999 — uzun dönem yaşam rotası",
    atmosphere: "Dönemin ekonomik belirsizliği ve değişen gündelik imkânlar, iş, eğitim, aile ve birikim kararlarının ağırlığını etkiler.",
    events: [
      [1999, "Başlangıç düzeni", "Yeni bir yaşam düzeni kuruyorsun. Yakın çevrenin desteği, ilk iş ve eğitim tercihlerini etkileyebilir.", "life"],
      [1999, "Gündelik ihtiyaçlar", "Gelir ve temel harcamalar arasındaki dengeyi yeniden kurman gerekiyor.", "life"],
      [2000, "Fiyat istikrarı arayışı", "Türkiye'de döviz kuruna dayalı istikrar programı uygulanmaya başladı; oyun, bunun hane bütçesi kararlarına olası etkisini kurgular.", "historical", ["tcmb2000"]],
      [2001, "Ekonomik daralma", "2001 krizi sonrasında kur rejiminde değişiklik yaşandı; kısa vadeli gelir ile uzun vadeli beceri arasında seçim yap.", "historical", ["tcmb2001"]],
      [2002, "Yeni çalışma koşulları", "İş ve eğitim seçenekleri arasında kendi önceliğini belirle.", "life"],
      [2005, "Yeni para düzeni", "1 Ocak 2005'te Türk lirasından altı sıfır atıldı. Bütçeni ve hedeflerini gözden geçir.", "historical", ["tcmb2005"]],
      [2008, "Küresel belirsizlik", "2008'de derinleşen küresel finansal kriz Türkiye'deki iktisadi gelişmeleri de etkiledi.", "historical", ["tcmb2008"]],
      [2011, "Yaşam alanını düzenleme", "Ulaşım, konut ve iş fırsatları arasında yeni bir denge kurman gerekiyor.", "life"],
      [2018, "Hane bütçesi kararı", "Tasarruf, eğitim ve aile desteği arasında sınırlı kaynaklarını nasıl paylaşacağını seç.", "life"],
      [2020, "Gündelik hayatın kesintisi", "COVID-19 pandemisinin ekonomik etkileri sürerken sağlık, gelir ve yakın bağların bakımını birlikte düşün.", "historical", ["wb2020"]],
      [2023, "Yeniden kurma dönemi", "İş, eğitim ve yaşam alanı planını yeniden değerlendir.", "life"],
      [2025, "Dönüm noktası", "Geçmiş kararlarının yükünü ve kazancını tart. Önünde dört yıllık yeni bir dönem var.", "life"],
      [2026, "Yeni düzen", "İş, ev ve yakın ilişkilerinde hangi yükü sürdürebileceğini seç. Bundan sonrası tarihsel kayıt değil, olası bir yaşam senaryosudur.", "future"],
      [2027, "Değişen ihtiyaçlar", "Beceri, bakım ve geçim planını yeni koşullara göre yeniden kur.", "future"],
      [2028, "Uzun vadeli karar", "Bugünkü rahatlık ile gelecekteki dayanıklılık arasında yeni bir denge kur.", "future"],
      [2029, "2030'a yaklaşırken", "Son yılların kararları bütçende, bedeninde ve ilişkilerinde nasıl birikti?", "future"],
    ],
  },
  "1980s": {
    title: "1980'ler — seed ile seçilen başlangıç",
    atmosphere: "Başlangıç yılı seed ile seçilir. Dönem koşulları iş, eğitim, aile ve gündelik erişim üzerinde niteliksel baskı/fırsat oluşturur.",
    events: [
      [1980, "Başlangıç düzeni", "24 Ocak 1980 kararları Türkiye ekonomisinde yapısal dönüşüm başlattı. Yaşam rotası ve kişisel sonuçlar kurgudur.", "historical", ["tcmb1980"]],
      [1981, "İş ve geçim", "Hane gelirini korumak ile beceri geliştirmek arasında zaman ve kaynak paylaş.", "life"],
      [1984, "Gündelik fırsatlar", "Yeni çalışma ve eğitim yolları açılabilir; bunlara ulaşmanın da bir bedeli vardır.", "life"],
      [1985, "Hane bütçesi", "Temel giderlerin baskısı, birikim ve yakınlara destek kararlarını öne çıkarıyor.", "life"],
      [1989, "Yeni yön arayışı", "İş, eğitim ve aile planlarının arasında kendi önceliğini belirle.", "life"],
      [1994, "Finansal daralma", "1994 ekonomik krizi iş, gelir ve hane planlarında belirsizlik yarattı.", "historical", ["tcmb1994"]],
      [1999, "Yüzyıl dönümünde yaşam", "Gündelik düzenin ve gelir planın yeni koşullara uyum istiyor.", "life"],
      [2001, "Ekonomik daralma", "2001 krizi sonrasında kur rejiminde değişiklik yaşandı; kısa vadeli gelir ile uzun vadeli beceri arasında seçim yap.", "historical", ["tcmb2001"]],
      [2008, "Küresel belirsizlik", "2008'de derinleşen küresel finansal kriz Türkiye'deki iktisadi gelişmeleri de etkiledi.", "historical", ["tcmb2008"]],
      [2020, "Gündelik hayatın kesintisi", "COVID-19 pandemisinin ekonomik etkileri sürerken sağlık, gelir ve yakın bağların bakımını birlikte düşün.", "historical", ["wb2020"]],
      [2023, "Yeniden kurma dönemi", "İş, eğitim ve yaşam alanı planını yeniden değerlendir.", "life"],
      [2025, "Dönüm noktası", "Geçmiş kararlarının yükünü ve kazancını tart. Önünde dört yıllık yeni bir dönem var.", "life"],
      [2026, "Yeni düzen", "İş, ev ve yakın ilişkilerinde hangi yükü sürdürebileceğini seç. Bundan sonrası tarihsel kayıt değil, olası bir yaşam senaryosudur.", "future"],
      [2027, "Değişen ihtiyaçlar", "Beceri, bakım ve geçim planını yeni koşullara göre yeniden kur.", "future"],
      [2028, "Uzun vadeli karar", "Bugünkü rahatlık ile gelecekteki dayanıklılık arasında yeni bir denge kur.", "future"],
      [2029, "2030'a yaklaşırken", "Son yılların kararları bütçende, bedeninde ve ilişkilerinde nasıl birikti?", "future"],
    ],
  },
};

PACKS["2017-04-18"] = {
  title: "18 Nisan 2017 — yetişkinliğe ilk adım",
  atmosphere: "18 yaşındasın. İş, eğitim ve ilk birikim kararların değişen bir dünyada ilerler.",
  events: [[2017, "İlk bağımsız bütçe", "Gelirin, yaşam giderlerin ve eğitim planın arasında sürdürülebilir bir denge kur.", "life"], ...PACKS["1999-04-18"].events.filter(event => event[0] >= 2018)],
};

export function normalizeSeed(value) {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? (parsed >>> 0) || 1 : 1;
}

export function chooseEightiesStartYear(seed) {
  const candidates = [1980, 1984, 1988];
  let x = normalizeSeed(seed);
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  return candidates[(x >>> 0) % candidates.length];
}

export function createScenario(eraId, seed = 1) {
  if (eraId === "present_day" || !eraId) return null;
  const normalizedSeed = normalizeSeed(seed);
  const startDate = eraId === "1980s" ? `${chooseEightiesStartYear(normalizedSeed)}-01-01` : eraId === "2017-04-18" ? "2017-04-18" : "1999-04-18";
  const packId = eraId === "1980s" ? "1980s" : startDate;
  const scenario = {
    version: HISTORICAL_SCENARIO_VERSION,
    id: packId,
    seed: normalizedSeed,
    startDate,
    endDate: HISTORICAL_END_DATE,
    currentDate: startDate,
    startYear: Number(startDate.slice(0, 4)),
    eventCursor: PACKS[packId].events.findIndex((event) => event[0] >= Number(startDate.slice(0, 4))),
    pendingEvent: null,
    delayedEffects: [],
    history: [],
    completed: false,
    pack: PACKS[packId],
  };
  scenario.pendingEvent = scenarioAtWeek(scenario, 1);
  return scenario;
}

/** Extend old 2026 routes without replaying already resolved period choices. */
export function upgradeScenarioTo2030(state) {
  const scenario = state?.world?.scenario;
  if (!scenario || !PACKS[scenario.id] || scenario.version >= HISTORICAL_SCENARIO_VERSION) return false;
  const wasFinished = scenario.completed === true;
  scenario.version = HISTORICAL_SCENARIO_VERSION;
  scenario.endDate = HISTORICAL_END_DATE;
  scenario.pack = PACKS[scenario.id];
  if (wasFinished) {
    scenario.completed = false;
    scenario.final = null;
    scenario.pendingEvent = null;
  }
  // The 2026+ events are appended, so old eventCursor and history stay valid.
  return true;
}

export function scenarioAtWeek(scenario, week) {
  if (!scenario || scenario.completed) return null;
  const event = scenario.pack.events[scenario.eventCursor];
  if (!event || Number((scenario.currentDate || dateAtWeek(scenario.startDate, week - 1)).slice(0, 4)) < event[0]) return null;
  const [year, title, body] = event;
  const [, , , kind, sourceIds = []] = event;
  return { id: `${scenario.id}-${year}-${scenario.eventCursor}`, year, title, body, kind, sourceIds, sources: sourceIds.map((id) => HISTORICAL_SOURCES[id]), choices: choices(), eventIndex: scenario.eventCursor };
}

const AXES = {
  career: (s, n) => { if (s.career) s.career.performance = clamp((s.career.performance || 50) + n); },
  education: (s, n) => {
    if (s.career) s.career.performance = clamp((s.career.performance || 50) + n);
    if (s.education?.active) s.education.active.progressPoints = Math.max(0, (s.education.active.progressPoints || 0) + n * 4);
  },
  money: (s, n) => { if (s.finances) s.finances.balance += n * 150; },
  health: (s, n) => { if (s.health) s.health.health = clamp(s.health.health + n); },
  energy: (s, n) => { if (s.health) s.health.energy = clamp(s.health.energy + n); },
  stress: (s, n) => { if (s.health) s.health.stress = clamp(s.health.stress + n); },
  family: (s, n) => { if (s.relationships) s.relationships.anne = clamp((s.relationships.anne || 0) + n); },
  access: (s, n) => { s.flags.historicalAccess = clamp((s.flags.historicalAccess || 50) + n); },
};

function applyEffect(state, effect) {
  for (const [axis, amount] of Object.entries(effect)) AXES[axis]?.(state, amount);
}

export function resolveScenarioChoice(state, choiceId) {
  const scenario = state?.world?.scenario;
  const event = scenario?.pendingEvent;
  const choice = event?.choices.find((item) => item.id === choiceId);
  if (!choice) return { ok: false, message: "Bu dönem kararı artık geçerli değil." };
  const effect = COMMON_EFFECTS[choice.id];
  applyEffect(state, effect);
  const delayed = { dueWeek: state.time.absoluteWeek + 48, effect: { ...effect }, source: event.title };
  scenario.delayedEffects.push(delayed);
  scenario.history.push({ eventId: event.id, year: event.year, title: event.title, choiceId, choiceLabel: choice.label, effect: { ...effect }, delayedWeek: delayed.dueWeek });
  scenario.eventCursor = event.eventIndex + 1;
  scenario.pendingEvent = null;
  return { ok: true, message: `${choice.label}: etkiler işlendi; bir bölümü bir yıl sonra yeniden değerlendirilir.` };
}

export function processScenarioWeek(state) {
  const scenario = state?.world?.scenario;
  if (!scenario) return [];
  const messages = [];
  if (!state.time.dateOrigin) {
    state.time.dateOrigin = scenario.startDate;
    state.time.dateOriginWeek = 1;
  }
  syncGameDate(state);
  for (const item of scenario.delayedEffects) {
    if (!item.applied && item.dueWeek <= state.time.absoluteWeek) {
      // Echoes are smaller than the original decision and remain deterministic.
      applyEffect(state, Object.fromEntries(Object.entries(item.effect).map(([key, value]) => [key, Math.trunc(value / 2)])));
      item.applied = true;
      messages.push(`Gecikmiş sonuç: ${item.source} kararının etkisi yeniden hissedildi.`);
    }
  }
  if (!scenario.pendingEvent && !scenario.completed) scenario.pendingEvent = scenarioAtWeek(scenario, state.time.absoluteWeek);
  if (state.time.date >= scenario.endDate) {
    for (const item of scenario.delayedEffects) {
      if (item.applied) continue;
      applyEffect(state, Object.fromEntries(Object.entries(item.effect).map(([key, value]) => [key, Math.trunc(value / 2)])));
      item.applied = true;
      item.reconciledAtEnd = true;
      messages.push(`2030 sonucu: ${item.source} kararının kalan gecikmiş etkisi yaşam özetine yansıtıldı.`);
    }
    scenario.currentDate = scenario.endDate;
    scenario.completed = true;
    scenario.pendingEvent = null;
    scenario.final = buildScenarioFinal(state);
    state.time.year = 2030;
    if (state.yearlyPlan) state.yearlyPlan.year = 2030;
    messages.push("1 Ocak 2030: yaşam rotası tamamlandı. 2026 sonrası kurgu senaryodur.");
  }
  return messages;
}

export function buildScenarioFinal(state) {
  const scenario = state?.world?.scenario;
  if (!scenario) return null;
  const appliedEchoes = scenario.delayedEffects.filter((item) => item.applied).length;
  return {
    date: HISTORICAL_END_DATE,
    decisions: scenario.history.length,
    delayedEchoes: appliedEchoes,
    balance: Math.round(state.finances?.balance || 0),
    health: Math.round(state.health?.health || 0),
    career: Math.round(state.career?.performance || 0),
    family: Math.round(state.relationships?.anne || 0),
    access: Math.round(state.flags?.historicalAccess || 50),
    summary: `2030'a ${scenario.history.length} dönem kararı ve ${appliedEchoes} gecikmiş sonuçla ulaştın.`,
  };
}

export function scenarioChoiceEffect(choiceId) {
  return COMMON_EFFECTS[choiceId] ? { ...COMMON_EFFECTS[choiceId] } : null;
}
