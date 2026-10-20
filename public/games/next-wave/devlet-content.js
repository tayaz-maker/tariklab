/**
 * Wave 5 max-content for TC SIM: DEVLET.
 * Catalog + monthly scheduling only. Causal math in devlet-depth.js stays frozen.
 */
const cap = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Number.isFinite(n) ? n : lo));
const unique = (rows, key = (row) => row.id) => {
  const seen = new Set();
  return rows.filter((row) => row && !seen.has(key(row)) && seen.add(key(row)));
};
const hash = (seed, value) => {
  let x = (Number(seed) || 12345) >>> 0;
  for (const c of String(value)) x = Math.imul(x ^ c.charCodeAt(0), 16777619) >>> 0;
  return x >>> 0;
};

export const EXCLUSIVE_PAIRS = {
  "fiscal-path": ["tighten", "spend"],
  "security-path": ["posture", "civilian"],
  "housing-path": ["supply", "relief"],
  "eu-path": ["chapter", "pause"],
  "cadre-path": ["merit", "loyalty"],
  "media-path": ["brief", "silence"],
  "region-path": ["east", "west"],
  "inflation-path": ["target", "index"],
  "external-path": ["reserve", "subsidy"],
  "form-spine": ["garrison", "bureau"],
  "form-mandate": ["party", "populist"],
  "local-path": ["devolve", "center"],
};

export const CADRE_PROFILES = [
  { id: "recai-maliye", institution: "maliye", eras: ["1923"], name: "Recai Bey", style: "defter, mühür, itiraz yok", motivation: "kasa görünsün", publicProfile: "sessiz tahsildar", crisisTendency: "vergiyi öne çeker", hidden: "taşra tahsilatını abartmayı alışkanlık sayar", memoryHook: "defter-fazlasi" },
  { id: "sevket-maarif", institution: "maarif", eras: ["1923"], name: "Şevket Hoca", style: "seferberlik cümlesi, kadro fısıltısı", motivation: "mektep tabelası", publicProfile: "muasır vaiz", crisisTendency: "öğretmen yokluğunu gizler", hidden: "sınıf açılmış görünür, sıra boş kalır", memoryHook: "bos-sira" },
  { id: "kazim-ordu", institution: "ordu", eras: ["1923", "1950"], name: "Kâzım Paşa kadrosu", style: "kısa emir, uzun bekleyiş", motivation: "sınır ve düzen", publicProfile: "kurucu asker", crisisTendency: "iç işi güvenlik cümlesine çevirir", hidden: "sivil takvimi iter", memoryHook: "takvim-kaydi" },
  { id: "cevat-dahiliye", institution: "mulkiye", eras: ["1923", "1950"], name: "Cevat Bey", style: "kaymakam raporu, telgraf gecikmesi", motivation: "merkez duysun", publicProfile: "taşra muhabiri", crisisTendency: "raporu yumuşatır", hidden: "kaza sessizliğini 'yol yok' diye yazar", memoryHook: "telgraf-gecikme" },
  { id: "hasan-maliye", institution: "maliye", eras: ["1950"], name: "Hasan Bey", style: "kredi, rıza, tahsilat yarın", motivation: "kır oyu", publicProfile: "tarım bankası dili", crisisTendency: "borcu öne çeker", hidden: "vade gizler", memoryHook: "vade-sis" },
  { id: "celal-belediye", institution: "belediye", eras: ["1950", "1980"], name: "Celal Başkan", style: "yol, çeşme, seçim afişi", motivation: "mahalle görsün", publicProfile: "imar vaadi", crisisTendency: "arsayı konuşur, boruyu unutur", hidden: "keşif defteri şişer", memoryHook: "kesif-sisme" },
  { id: "fahri-ordu", institution: "ordu", eras: ["1950", "1980"], name: "Fahri Paşa hattı", style: "ittifak cümlesi, iç öncelik dipnotu", motivation: "dış yükümlülük", publicProfile: "NATO masası", crisisTendency: "bütçeyi savunmaya kaydırır", hidden: "yatırım satırı kayar", memoryHook: "savunma-kayma" },
  { id: "turgut-maliye", institution: "maliye", eras: ["1980"], name: "Turgut kadrosu", style: "şok, kuyruk, ihracat", motivation: "fiyat düzeltilsin", publicProfile: "istikrar teknokratı", crisisTendency: "hane şokunu istatistik sayar", hidden: "gıda ayrı satırda durur", hiddenFlavor: "kuyruk haneye iner, rapor bir ay gecikir", memoryHook: "kuyruk-gecikme" },
  { id: "yilmaz-yok", institution: "maarif", eras: ["1980"], name: "Yılmaz YÖK hattı", style: "çatı, müfredat, kampüs sessizliği", motivation: "merkezi tempo", publicProfile: "üniversite çatısı", crisisTendency: "özerkliği ısı sanır", hidden: "kampüs tansiyonunu 'sakin' yazar", memoryHook: "kampus-sakin" },
  { id: "kemal-maliye", institution: "maliye", eras: ["2002", "alternatif"], name: "Kemal Bey", style: "faiz dışı fazla, şartlı cümle", motivation: "program tutsun", publicProfile: "istikrar çapası", crisisTendency: "harcamayı dipnota iter", hidden: "saha tahsilatını iyimserleştirir", memoryHook: "fazla-sisme" },
  { id: "sureyya-merkez", institution: "merkez", eras: ["2002", "alternatif", "gunumuz"], name: "Süreyya hattı", style: "örtük hedef, sözle çapa", motivation: "beklenti otursun", publicProfile: "para otoritesi", crisisTendency: "siyasi faizi kapıda tutar", hidden: "gıda yapışkanlığını çekirdek saymaz", memoryHook: "cekirdek-ayrisma" },
  { id: "cemil-icisleri", institution: "mulkiye", eras: ["2002", "gunumuz"], name: "Cemil Vali hattı", style: "il uygulaması, merkez temenni", motivation: "tempo görünsün", publicProfile: "mülki idare", crisisTendency: "yüzde 82 yazar, saha 30 hisseder", hidden: "üç il hangi binada başladığını arar", memoryHook: "saha-merkez" },
  { id: "ayse-yargi", institution: "yargi", eras: ["2002", "alternatif", "gunumuz"], name: "Ayşe Hanım kurul", style: "mevzuat hızı, duruşma yavaşlığı", motivation: "paket çıksın", publicProfile: "uyum kalemi", crisisTendency: "takvimi Brüksel'e göre kurar", hidden: "mahkeme kalemi aynı hızda değildir", memoryHook: "mahkeme-tempo" },
  { id: "haluk-ordu", institution: "ordu", eras: ["2002", "gunumuz"], name: "Haluk Paşa masası", style: "sınır notu, tedarik hattı", motivation: "kapasite kaymasın", publicProfile: "savunma masası", crisisTendency: "iç reformu iki hafta iter", hidden: "bütçe satırı gecikmeli şişer", memoryHook: "sinir-butce" },
  { id: "selim-belediye", institution: "belediye", eras: ["2002", "gunumuz"], name: "Selim İmar", style: "tapu ayrı, tabela ayrı", motivation: "arz konuşulsun", publicProfile: "konut seferi", crisisTendency: "daireyi başarı sayar", hidden: "keşif ve kalite ayrı dosyadır", memoryHook: "tapu-ayri" },
  { id: "leyla-istihbarat", institution: "istikhbarat", eras: ["2002", "gunumuz"], name: "Leyla Koordinasyon", style: "brifing, darboğaz, sentez", motivation: "uyarı zamanında gelsin", publicProfile: "kurumsal değerlendirme", crisisTendency: "belirsizliği abartmamaya çalışır", hidden: "kanal tıkanınca sessizlik de bir bilgi sayılır", memoryHook: "kanal-tikanti" },
  { id: "nuri-hazine", institution: "maliye", eras: ["gunumuz"], name: "Nuri Hazine", style: "fatura, pay, erteleme", motivation: "hane sakinleşsin", publicProfile: "enerji ve afet kalemi", crisisTendency: "faturayı siyaset sayar", hidden: "dış bağımlılık dipnotta kalır", memoryHook: "fatura-dipnot" },
  { id: "melisa-maarif", institution: "maarif", eras: ["gunumuz", "alternatif"], name: "Melisa Öğretim", style: "tabela çoğalır, hoca yetişmez", motivation: "erişim görünsün", publicProfile: "eğitim kapasitesi", crisisTendency: "kontenjanı başarı yazar", hidden: "derslik hesabı şişer", memoryHook: "derslik-sisme" },
  { id: "orkun-merkez-alt", institution: "merkez", eras: ["alternatif", "1923"], name: "Orkun Emisyon", style: "ihtiyat, erken çapa", motivation: "kâğıt refleks sınırlansın", publicProfile: "ihtiyatçı", crisisTendency: "şoku erken keser", hidden: "rıza başka dağılır", memoryHook: "erken-kesim" },
  { id: "pelin-yerel", institution: "belediye", eras: ["alternatif"], name: "Pelin Yerel Pay", style: "il rızası, merkez homurtusu", motivation: "pay anayasası", publicProfile: "yerel idare", crisisTendency: "özerkliği çözüm sayar", hidden: "uygulama illere yayılır, standart dağılır", memoryHook: "standart-dagilma" },
];

export const STATE_FORM_FLAVOR = {
  "Kışla-Devlet": {
    entry: "Güvenlik cümlesi masanın üstüne oturdu. Sivil takvim dipnota indi.",
    persist: "Emir kısa, uygulama uzun. Kurumlar tempo ister, müzakere kapanır.",
    warning: "İstihbarat brifingi 'koordinasyon darboğazı' yazmaya başladı.",
    exit: "Sivil kalem geri geldi. Güvenlik dosyası kapanmadı, yer değiştirdi.",
    trace: "Devlet, güvenlik omurgasıyla yürüdü; sivil kapasite bekletildi.",
  },
  "Bürokrasi-Devlet": {
    entry: "Dosya hükümetten uzun yaşadı. Tempo, imza sırasına indirgendi.",
    persist: "Profesyonellik bir kalkan. Yorgunluk da bir kalkan. İkisi aynı koridorda.",
    warning: "Uygulama yüzdesi şişiyor, saha binayı arıyor.",
    exit: "Siyasi tempo dosyayı ezmeye başladı. Kalem direniyor.",
    trace: "Devlet, bürokratik süreklilikle ayakta kaldı; seçilmiş irade kaydı.",
  },
  "Parti-Devlet": {
    entry: "Merkez, kurum özerkliğini tempo sanıyor. Kadrolar aynı cümleyi ezberliyor.",
    persist: "Mandat yüksek, özerklik alçak. Dosya partinin takvimine bakıyor.",
    warning: "Liyakat CV'si masada, koridor sadakat soruyor.",
    exit: "Kurumlar tekrar kendi saatini kurmaya çalışıyor.",
    trace: "Devlet, siyasi merkezin temposuna bağlandı; kurum saati kaydı.",
  },
  "Sermaye-Devlet": {
    entry: "Yatırım cümlesi kamu cümlesinin önüne geçti. Fatura haneye ayrıca gelir.",
    persist: "İş dünyası güler, hane asık. İki güven endeksi aynı ayı tarif etmez.",
    warning: "Kredi ısınır. Kırılganlık ötelenmiş durur.",
    exit: "Piyasa homurdanır, kamu tekrar masaya oturur.",
    trace: "Devlet, sermaye temposunu omurga sandı; toplumsal rıza ayrı kaldı.",
  },
  "Cemaat-Devlet": {
    entry: "Ağ baskısı kurum profesyonelliğinin boşluğuna yerleşti. İsimler resmi değil.",
    persist: "Kaynak ve erişim, yazılı yetkinin yanında yürüyor.",
    warning: "Yüklenici halkası şartnameden önce konuşuyor.",
    exit: "Profesyonel kalkan inceldiği yerden ağ da incelir — ya da kalınlaşır.",
    trace: "Devlet, resmi olmayan ağ etkisini kurum boşluğunda taşıdı.",
  },
  "Popülist-Devlet": {
    entry: "Hane rahatlatma, kurum tempo kaybının üstünü örttü.",
    persist: "Rıza kısa, kasa uzun. Manşet iddiası dosyadan hızlı.",
    warning: "İstatistik özerkliği siyasi maliyet olarak duruyor.",
    exit: "Fatura ve kira, vaadi geçti. Güven parçalanıyor.",
    trace: "Devlet, kısa rızayı omurga yaptı; kurumsal güven inceldi.",
  },
  "Boş Kabuk": {
    entry: "Karar var, uygulama yok. Tabela duruyor, koridor boş.",
    persist: "Entropy yüksek, kapasite düşük. Her dosya hayalet dosya gibi.",
    warning: "Üç kriz aynı anda aktif; hiçbirinin sahibi yok.",
    exit: "Bir kurum tekrar tempo aldı. Kabuk çatladı, devlet henüz dolmadı.",
    trace: "Devlet, karar üretip sahaya inemediği bir kabuk döneminden geçti.",
  },
};

function bag(state) {
  if (!state.devletDepth || typeof state.devletDepth !== "object") return null;
  const raw = state.devletDepth.content && typeof state.devletDepth.content === "object" ? state.devletDepth.content : {};
  raw.chains = raw.chains && typeof raw.chains === "object" ? raw.chains : {};
  raw.exclusive = raw.exclusive && typeof raw.exclusive === "object" ? raw.exclusive : {};
  raw.once = raw.once && typeof raw.once === "object" ? raw.once : {};
  const waiting = Array.isArray(raw.waiting) ? raw.waiting : [];
  const seen = new Set();
  raw.waiting = waiting.filter((row) => {
    if (!row || typeof row !== "object") return false;
    if (typeof row.id !== "string" || !row.id.startsWith("dc:")) return false;
    if (typeof row.eventId !== "string" || !row.eventId.startsWith("dc_")) return false;
    if (!Number.isFinite(Number(row.dueTurn))) return false;
    if (seen.has(row.id) || seen.has(`event:${row.eventId}`)) return false;
    if (raw.once[`resolved:${row.id}`]) return false;
    seen.add(row.id);
    seen.add(`event:${row.eventId}`);
    row.dueTurn = Math.max(0, Math.trunc(Number(row.dueTurn)));
    row.expectedInst = typeof row.expectedInst === "string" ? row.expectedInst : null;
    row.expectedCrisis = typeof row.expectedCrisis === "string" ? row.expectedCrisis : null;
    row.expectedForm = typeof row.expectedForm === "string" ? row.expectedForm : null;
    return true;
  }).sort((a, b) => a.dueTurn - b.dueTurn || a.id.localeCompare(b.id)).slice(0, 16);
  raw.arcCounts = raw.arcCounts && typeof raw.arcCounts === "object" ? raw.arcCounts : {};
  state.devletDepth.content = raw;
  return raw;
}

export function shownBranch(state, family) {
  const store = bag(state);
  if (!store) return null;
  if (store.exclusive[family]) return store.exclusive[family];
  const branches = EXCLUSIVE_PAIRS[family];
  if (!branches?.length) return null;
  const picked = branches[(hash(state.meta?.seed || 1, `ex:${family}`) >>> 8) % branches.length];
  store.exclusive[family] = picked;
  return picked;
}

export function overlayCadres(state) {
  if (!state?.devletDepth?.cadres) return state;
  const era = state.eraId;
  const used = new Set();
  for (const cadre of state.devletDepth.cadres) {
    const profile = CADRE_PROFILES.find((row) => row.institution === cadre.institution && row.eras.includes(era) && !used.has(row.id))
      || CADRE_PROFILES.find((row) => row.institution === cadre.institution && !used.has(row.id));
    if (!profile) continue;
    used.add(profile.id);
    cadre.name = profile.name;
    cadre.style = profile.style;
    cadre.motivation = profile.motivation;
    cadre.publicLine = profile.publicProfile;
    cadre.crisisTendency = profile.crisisTendency;
    cadre.hiddenFlavor = profile.hidden;
    cadre.profileId = profile.id;
  }
  const store = bag(state);
  if (store) store.roster = CADRE_PROFILES.filter((row) => !used.has(row.id) && (row.eras.includes(era) || row.eras.includes("gunumuz")));
  return state;
}

function inst(state, id) {
  return (state.institutions || []).find((row) => row.id === id) || null;
}
function group(state, id) {
  return (state.devletDepth?.groups || []).find((row) => row.id === id) || null;
}
function region(state, id) {
  return (state.regions || []).find((row) => row.id === id) || null;
}
function cadreOf(state, institution) {
  return (state.devletDepth?.cadres || []).find((row) => row.institution === institution) || null;
}
function activeCrisis(state, family) {
  return (state.devletDepth?.crises?.active || []).some((row) => row.family === family);
}
function eraOk(node, state) {
  if (!node.era) return true;
  const eras = [].concat(node.era);
  return eras.includes(state.eraId) || (eras.includes("grand") && state.scenario?.campaign);
}

function organicOk(state, chain, node) {
  const store = bag(state);
  if (!store) return false;
  if ((Number(store.chains[chain.id]) || 0) !== (node.needStage || 0)) return false;
  if (chain.exclusive && shownBranch(state, chain.exclusive) !== chain.branch) return false;
  if (node.minTurn && state.time.turn < node.minTurn) return false;
  if (node.maxTurn && state.time.turn > node.maxTurn) return false;
  if (!eraOk(node, state)) return false;
  if (node.campaign && !state.scenario?.campaign) return false;
  if (node.form && state.form !== node.form && state.devletDepth?.forms?.dominant !== node.form) return false;
  if (node.needCrisis && !activeCrisis(state, node.needCrisis)) return false;
  if (node.forbidCrisis && activeCrisis(state, node.forbidCrisis)) return false;
  if (node.needInst) {
    const row = inst(state, node.needInst);
    if (!row) return false;
    if (node.minCapacity && row.capacity < node.minCapacity) return false;
    if (node.maxCapacity && row.capacity > node.maxCapacity) return false;
    if (node.minFatigue && row.fatigue < node.minFatigue) return false;
    if (node.maxTrust && row.trust > node.maxTrust) return false;
  }
  if (node.needGroup) {
    const row = group(state, node.needGroup);
    if (!row) return false;
    if (node.minPressure && row.pressure < node.minPressure) return false;
    if (node.maxSatisfaction && row.satisfaction > node.maxSatisfaction) return false;
  }
  if (node.needRegion) {
    const row = region(state, node.needRegion);
    if (!row) return false;
    if (node.maxServices && row.services > node.maxServices) return false;
    if (node.minUnemp && row.unemployment < node.minUnemp) return false;
    if (node.minHeat && row.heat < node.minHeat) return false;
  }
  if (node.minInflation && (state.actual?.inflation || 0) < node.minInflation) return false;
  if (node.minHeat && (state.heat || 0) < node.minHeat && !node.needRegion) return false;
  if (node.minDebt && (state.devletDepth?.macro?.publicDebt || 0) < node.minDebt) return false;
  if (node.minEntropy && (state.entropy || 0) < node.minEntropy) return false;
  if (node.minFragmentation && (state.devletDepth?.media?.fragmentation || 0) < node.minFragmentation) return false;
  if (node.minEnergy && (state.devletDepth?.world?.energyPressure || 0) < node.minEnergy) return false;
  if (node.needCadre && !cadreOf(state, node.needCadre)) return false;
  if (typeof node.if === "function" && !node.if(state)) return false;
  return true;
}

function choice(id, label, en, risk, extra = {}) {
  return { id, label, en, risk, effects: extra.effects || {}, ...extra };
}

function nodeToEvent(chain, node) {
  return {
    id: node.id,
    devletContent: true,
    organic: Boolean(node.organic),
    chain: chain.id,
    stage: node.stage,
    arc: node.arc || chain.arc,
    exclusive: chain.exclusive || null,
    branch: chain.branch || null,
    tags: [...new Set([...(chain.tags || []), ...(node.tags || [])])],
    title: node.title,
    text: node.text,
    en: { title: node.enTitle || node.title, text: node.enText || node.text, choices: Object.fromEntries(node.choices.map((row) => [row.id, row.en || row.label])) },
    organicCheck: node.organic ? (state) => organicOk(state, chain, node) : null,
    era: node.era || chain.era,
    needInst: node.needInst,
    needCrisis: node.needCrisis,
    form: node.form,
    choices: node.choices.map((row) => ({
      id: row.id, label: row.label, risk: row.risk, effects: row.effects || {},
      next: row.next || null, stageTo: row.stageTo, lock: row.lock, echo: row.echo, defer: row.defer,
    })),
  };
}

const CHAINS = [];
const push = (chain) => { if (!chain?.id || CHAINS.some((row) => row.id === chain.id)) return; CHAINS.push(chain); };

function opening(id, opts, title, text, enTitle, enText, a, b) {
  return {
    id, stage: 1, organic: true, title, text, enTitle, enText, choices: [a, b], ...opts,
  };
}
function later(id, opts, title, text, enTitle, enText, a, b) {
  return {
    id, stage: opts.stage || 2, title, text, enTitle, enText, choices: [a, b], ...opts,
  };
}

// --- Period chains ---
push({
  id: "p23-iskan", arc: "admin", era: "1923", tags: ["period", "institution", "group", "region", "cross"],
  nodes: [
    opening("dc_p23_iskan", { era: "1923", needInst: "mulkiye", tags: ["period", "1923", "institution", "rural"] },
      "İskân kervanı, telgraf gecikir",
      "Mübadil kafile kaza hanesini doldurur. Recai defteri dolu yazar. Cevat'ın telgrafı bir hafta geç gelir: yatak yok, un yok.",
      "Resettlement convoy, the telegram is late",
      "The convoy fills the district houses. Recai's ledger looks full. Cevat's telegram arrives a week late: no beds, no flour.",
      choice("place", "Yerleştir, rapor sonra", "Settle them, report later", "Rıza; kâğıt şişer", { effects: { heat: -1 }, stageTo: 1, next: { eventId: "dc_p23_iskan2", dueTurns: 4, key: "p23-iskan2" }, echo: "İskân kâğıtta bitti, odada bitmedi." }),
      choice("hold", "Kafileyi durdur, un bekle", "Hold the convoy, wait for flour", "Düzen; ısı", { effects: { heat: 2 }, stageTo: 9, echo: "Kafile bekletildi; defter boş kaldı." })),
    later("dc_p23_iskan2", { tags: ["period", "1923", "memory", "rural"] },
      "Kışlık çadır, nüfus defteri",
      "Nüfus yazılmış. Çadır sökülmemiş. Maarif 'okul açıldı' der; sıra çamurda.",
      "Winter tents, a population ledger",
      "The names are written. The tents are still up. Education says a school opened. The bench is in the mud.",
      choice("school", "Sıra ve soba iste", "Ask for benches and stoves", "Kapasite", { effects: { info: 1 }, stageTo: 3, next: { eventId: "dc_p23_iskan3", dueTurns: 24, key: "p23-iskan3" } }),
      choice("count", "Defteri kapat, kış bitsin", "Close the ledger, let winter end", "Unutuş", { stageTo: 3 })),
    later("dc_p23_iskan3", { stage: 3, tags: ["period", "1923", "long", "development"] },
      "İki kış sonra aynı kaza",
      "Çadır yok. Okul var. Öğretmen yok. Şevket Hoca 'seferberlik bitti' yazar. Sıra hâlâ yarım.",
      "The same district two winters later",
      "No tents. A school. No teacher. Şevket writes that the mobilisation is over. The bench is still half-built.",
      choice("cadre", "Öğretmen kadrosu kaydır", "Move a teaching post", "Maarif yorgunluğu", { stageTo: 4, echo: "Kadro kaydı seferberliği uzattı." }),
      choice("leave", "Kaza kendi hâline", "Leave the district to itself", "Yerel idare", { stageTo: 4 })),
  ],
});
push({
  id: "p23-vergi", arc: "fiscal", era: "1923", exclusive: "fiscal-path", branch: "tighten", tags: ["period", "fiscal", "institution", "cross"],
  nodes: [
    opening("dc_p23_tax", { era: "1923", needInst: "maliye", tags: ["period", "1923", "fiscal"] },
      "Aşar tartışması, kâğıt gelir",
      "Bütçe satırı dolu. Recai 'tahsilat yürür' der. Çiftçi 'ölçü bozuldu' der. İki cümle aynı hasadı tarif etmez.",
      "Tithe dispute, paper revenue",
      "The budget line is full. Recai says collection is moving. The farmer says the measure is broken. Two sentences do not describe the same harvest.",
      choice("press", "Tahsilatı sıkı tut", "Keep collection tight", "Kasa; kır öfke", { effects: { heat: 3 }, lock: "tighten", stageTo: 1, next: { eventId: "dc_p23_tax2", dueTurns: 5, key: "p23-tax2" }, echo: "Kâğıt gelir sahada yoktu; sıkı tutmak onu yaratmadı." }),
      choice("ease", "Ölçüyü gevşet, rıza al", "Loosen the measure, buy consent", "Rıza; açık", { lock: "tighten", stageTo: 9 })),
    later("dc_p23_tax2", { tags: ["fiscal", "1923", "memory"] },
      "Revizyon bir çeyrek sonra",
      "Tahsilat boşluğu raporlanır. Recai 'mevsim' der. Defter fazlası kaybolmuştur.",
      "A revision a quarter later",
      "The collection gap is reported. Recai says 'the season.' The surplus in the ledger is gone.",
      choice("audit", "Teftiş yazısı çıkar", "Issue an inspection note", "Kurum", { stageTo: 3, next: { eventId: "dc_p23_tax3", dueTurns: 36, key: "p23-tax3" } }),
      choice("close", "Mevsimi kabul et", "Accept the season", "Unutuş", { stageTo: 3 })),
    later("dc_p23_tax3", { stage: 3, tags: ["fiscal", "long", "1923"] },
      "Üç yıl, aynı ölçü tartışması",
      "Aşar kalkmış olsa da ölçü cümlesi durur. Kır, devleti kasa sanır.",
      "Three years, the same argument over the measure",
      "Even if the tithe is gone the sentence about the measure remains. The village still treats the state as a till.",
      choice("cadastre", "Yazımı yenile", "Renew the survey", "Uzun iş", { stageTo: 4 }),
      choice("hold", "Cümleyi kapat", "Close the sentence", "Sükût", { stageTo: 4 })),
  ],
});
push({
  id: "p23-spend", arc: "fiscal", era: "1923", exclusive: "fiscal-path", branch: "spend", tags: ["period", "fiscal", "development", "cross"],
  nodes: [
    opening("dc_p23_spend", { era: "1923", needInst: "maliye", tags: ["period", "1923", "fiscal", "development"] },
      "Maarif seferi, kasa iner",
      "Şevket Hoca seferberlik ister. Recai kasa gösterir. İkisi aynı yılın çocuğu değildir.",
      "Education drive, the till drops",
      "Şevket wants mobilisation. Recai shows the till. They are not children of the same year.",
      choice("fund", "Seferi öne al", "Bring the drive forward", "Eğitim; açık", { lock: "spend", stageTo: 1, next: { eventId: "dc_p23_spend2", dueTurns: 6, key: "p23-spend2" } }),
      choice("wait", "Hasat sonrası", "After the harvest", "Erteleme", { lock: "spend", stageTo: 9 })),
    later("dc_p23_spend2", { tags: ["education", "1923"] },
      "Tabela var, hoca yok",
      "Mektep açılmış görünür. Kadro telgrafı kayıptır.",
      "A signboard, no teacher",
      "The school looks opened. The staffing telegram is missing.",
      choice("move", "Taşradan hoca kaydır", "Move a teacher from the provinces", "Kapasite", { stageTo: 3 }),
      choice("sign", "Tabelayı başarı say", "Count the signboard as success", "Görünürlük", { stageTo: 3 })),
  ],
});
push({
  id: "p50-kadro", arc: "government", era: "1950", tags: ["period", "government", "cadre", "institution", "cross"],
  nodes: [
    opening("dc_p50_kadro", { era: "1950", needInst: "mulkiye", tags: ["period", "1950", "government", "cadre"] },
      "Sandık sonrası kadro",
      "Hükümet değişir, dosya kalır. Cevat valilik temposunu 'yeni tefsir' diye yazar. Fahri Paşa ittifak takvimini değiştirmez.",
      "Posts after the ballot",
      "The government changes. The file remains. Cevat writes the governor's pace as a 'new reading.' Fahri Pasha does not change the alliance calendar.",
      choice("keep", "Dosyayı koru, isimleri değiştirme", "Keep the file, do not change the names", "Süreklilik", { stageTo: 1, next: { eventId: "dc_p50_kadro2", dueTurns: 5, key: "p50-kadro2" }, echo: "Hükümet değişti, kalem aynı kaldı." }),
      choice("sweep", "Valilikleri kaydır", "Move the governors", "Tempo; yorgunluk", { effects: { heat: 1 }, stageTo: 2 })),
    later("dc_p50_kadro2", { tags: ["government", "1950", "memory", "media"] },
      "Radyo saati, koridor başka",
      "Resmî ses akşam yayını. Kahvehane 'kadrolar duruyor' der. İkisi de doğru durur.",
      "Radio hour, another corridor",
      "The official voice is the evening broadcast. The coffeehouse says the posts are staying. Both sound true.",
      choice("brief", "Radyoda süreklilik de", "Say continuity on the radio too", "Anlatı", { stageTo: 3, next: { eventId: "dc_p50_kadro3", dueTurns: 24, key: "p50-kadro3" } }),
      choice("quiet", "Yayını kısa tut", "Keep the broadcast short", "Sessizlik", { stageTo: 3 })),
    later("dc_p50_kadro3", { stage: 3, tags: ["government", "long", "1950"] },
      "İki seçim, aynı dosya",
      "İsimler değişmiş. Rapor şablonu değişmemiş. Devlet hafızası hükümetten uzun.",
      "Two elections, the same file",
      "The names changed. The report template did not. State memory is longer than government.",
      choice("archive", "Şablonu arşivle", "Archive the template", "Hafıza", { stageTo: 4 }),
      choice("rewrite", "Şablonu boz", "Break the template", "Siyaset", { stageTo: 4 })),
  ],
});
push({
  id: "p50-yol", arc: "development", era: "1950", tags: ["period", "development", "region", "group", "cross"],
  nodes: [
    opening("dc_p50_yol", { era: "1950", needInst: "belediye", needRegion: "ic-anadolu", tags: ["period", "1950", "development", "rural"] },
      "Köy yolu talebi",
      "Celal Başkan keşif defterini şişirir. Hasan Bey kredi vaat eder. İç Anadolu rızası kırsalda, kasa merkezde.",
      "A village-road demand",
      "Mayor Celal inflates the survey book. Hasan promises credit. Central Anatolian consent is in the village; the till is in the centre.",
      choice("build", "Yolu öne al", "Bring the road forward", "Rıza; bütçe", { stageTo: 1, next: { eventId: "dc_p50_yol2", dueTurns: 6, key: "p50-yol2" } }),
      choice("credit", "Önce tarım kredisi", "Farm credit first", "Kır gelir", { stageTo: 2 })),
    later("dc_p50_yol2", { tags: ["development", "1950", "region"] },
      "Stabilize yok, afiş var",
      "Yol yarım. Afiş tam. Çiftçi 'kamyon' der, kamyon 'çamur' der.",
      "No base, a poster",
      "The road is half-done. The poster is complete. The farmer says truck. The truck says mud.",
      choice("finish", "Stabilize bitir", "Finish the base", "Altyapı", { stageTo: 3, next: { eventId: "dc_p50_yol3", dueTurns: 36, key: "p50-yol3" } }),
      choice("photo", "Afişi başarı say", "Count the poster as success", "Görünürlük", { stageTo: 3 })),
    later("dc_p50_yol3", { stage: 3, tags: ["development", "long", "region"] },
      "On yıl, aynı viraj",
      "Yol var. Bakım yok. Göç çekimi kente kaymış, viraj hâlâ kaza.",
      "Ten years, the same bend",
      "There is a road. There is no upkeep. Migration pull has shifted to the city. The bend is still an accident.",
      choice("maintain", "Bakım payı yaz", "Write a maintenance share", "Uzun yük", { stageTo: 4 }),
      choice("leave", "Virajı köye bırak", "Leave the bend to the village", "Yerel", { stageTo: 4 })),
  ],
});

// Period + crisis catalog fragment. Concatenate into devlet-content.js after the seeded period chains.
// Helpers already in scope: push, opening, later, choice.

push({
  id: "p23-ordu", arc: "security", era: "1923", exclusive: "security-path", branch: "posture", tags: ["period", "1923", "institution", "form", "cross", "cadre"],
  nodes: [
    opening("dc_p23_ordu", { era: "1923", needInst: "ordu", tags: ["period", "1923", "institution", "cadre"] },
      "Sınır emri, sivil takvim",
      "Kâzım Paşa kadrosu kısa emir ister. Cevat Bey valilik takvimini masaya koyar. İki kâğıt aynı haftayı göstermez.",
      "A border order, a civil calendar",
      "Kâzım Pasha's cadre wants a short order. Cevat Bey puts the governor's calendar on the table. The two papers do not show the same week.",
      choice("order", "Kısa emri yaz", "Write the short order", "Tempo; sivil kayar", { effects: { heat: -2 }, lock: "posture", stageTo: 1, next: { eventId: "dc_p23_ordu2", dueTurns: 5, key: "p23-ordu2" }, echo: "Emir kısa düştü; sivil takvim dipnota indi." }),
      choice("share", "Takvimi vilayetle paylaş", "Share the calendar with the province", "Müzakere", { lock: "posture", stageTo: 9 })),
    later("dc_p23_ordu2", { stage: 2, tags: ["period", "1923", "form", "memory"] },
      "Kışla saati, telgraf bekler",
      "Emir uygulanmış görünür. Cevat'ın telgrafı üç gün geç gelir: kaza hâlâ sivil iş sayar. Kâzım 'iç iş güvenlik cümlesidir' der.",
      "Garrison hour, the telegram waits",
      "The order looks applied. Cevat's telegram arrives three days late: the district still counts it as civil work. Kâzım says inner work is a security sentence.",
      choice("hold", "Güvenlik cümlesini tut", "Keep the security sentence", "Form oturur", { effects: { heat: -1 }, stageTo: 3, next: { eventId: "dc_p23_ordu3", dueTurns: 24, key: "p23-ordu3" } }),
      choice("yield", "Vilayet takvimine dön", "Return to the provincial calendar", "Sivil kalem", { effects: { info: 1 }, stageTo: 3 })),
    later("dc_p23_ordu3", { stage: 3, tags: ["period", "1923", "long", "form"] },
      "İki kış, aynı omurga",
      "Sınır notu arşivde. Sivil kapasite hâlâ bekler. Devlet, güvenlik cümlesiyle yürümeye alışmıştır.",
      "Two winters, the same spine",
      "The border note is in the archive. Civil capacity is still waiting. The state has grown used to walking on a security sentence.",
      choice("spine", "Omurgayı koru", "Keep the spine", "Süreklilik", { stageTo: 4, echo: "Kışla temposu sivil takvimi geride bıraktı." }),
      choice("open", "Sivil kalemi geri çağır", "Call the civil pen back", "Müzakere", { effects: { heat: 1 }, stageTo: 4 })),
  ],
});
push({
  id: "p23-sivil", arc: "security", era: "1923", exclusive: "security-path", branch: "civilian", tags: ["period", "1923", "institution", "form", "cross", "cadre"],
  nodes: [
    opening("dc_p23_sivil", { era: "1923", needInst: "mulkiye", tags: ["period", "1923", "institution", "cadre"] },
      "Valilik saati, kışla kenarı",
      "Cevat Bey vilayet takvimini açık yazmak ister. Kâzım Paşa kenar notu ister: emir içeride kalsın. Aynı gün, iki oda.",
      "A governor's clock, a garrison margin",
      "Cevat Bey wants the provincial calendar written in the open. Kâzım Pasha wants a margin note: keep the order inside. Same day, two rooms.",
      choice("civil", "Takvimi açık tut", "Keep the calendar open", "Sivil tempo", { effects: { info: 1 }, lock: "civilian", stageTo: 1, next: { eventId: "dc_p23_sivil2", dueTurns: 5, key: "p23-sivil2" }, echo: "Vilayet saati yazıldı; kenar notu inceldi." }),
      choice("margin", "Kenar notunu kabul et", "Accept the margin note", "Kapalı tempo", { lock: "civilian", stageTo: 9 })),
    later("dc_p23_sivil2", { stage: 2, tags: ["period", "1923", "form", "memory"] },
      "Kaza bilir, kadro yetişmez",
      "Takvim vilayette asılı. Öğretmen, tahsildar, kâtip aynı haftayı bekler. Cevat 'merkez duysun' yazar; kâğıt duyar, saha duymaz.",
      "The district knows, the posts do not catch up",
      "The calendar hangs in the province. Teacher, collector, clerk wait for the same week. Cevat writes 'let the centre hear'; the paper hears, the field does not.",
      choice("staff", "Sivil kadroyu kaydır", "Move a civil post", "Kapasite", { stageTo: 3, next: { eventId: "dc_p23_sivil3", dueTurns: 36, key: "p23-sivil3" } }),
      choice("paper", "Asılı takvimi yeter say", "Count the hanging calendar as enough", "Görünürlük", { stageTo: 3 })),
    later("dc_p23_sivil3", { stage: 3, tags: ["period", "1923", "long", "form"] },
      "Üç yıl, açık kâğıt",
      "Kışla kenarı durur. Vilayet dosyası hükümetten uzun yaşamıştır. Sivil cümle alışkanlık olmuş, kadro hâlâ ince.",
      "Three years, an open paper",
      "The garrison margin remains. The provincial file has outlived the government. The civil sentence is a habit; the staff is still thin.",
      choice("keep", "Açık dosyayı arşivle", "Archive the open file", "Hafıza", { effects: { info: 1 }, stageTo: 4 }),
      choice("fold", "Kenarı tekrar kalınlaştır", "Thicken the margin again", "Tempo", { stageTo: 4 })),
  ],
});
push({
  id: "p23-kanun", arc: "institution", era: "1923", tags: ["period", "1923", "institution", "cross"],
  nodes: [
    opening("dc_p23_kanun", { era: "1923", needInst: "yargi", tags: ["period", "1923", "institution"] },
      "Mecelle durur, kanun gelir",
      "Mahkeme kalemi eski cümleyi ezberlemiştir. Yeni metin masada, duruşma sırası eski. Recai 'mühür yetmez, hüküm lazım' der.",
      "The old code remains, a statute arrives",
      "The court clerk has memorised the old sentence. The new text is on the table; the hearing queue is the old one. Recai says a seal is not enough, a judgment is required.",
      choice("statute", "Yeni metni öne al", "Bring the new text forward", "Tempo; kalem yorulur", { effects: { heat: 1 }, stageTo: 1, next: { eventId: "dc_p23_kanun2", dueTurns: 6, key: "p23-kanun2" }, echo: "Kanun yazıldı; duruşma aynı sırada kaldı." }),
      choice("wait", "Kalemin ezberini bozma", "Do not break the clerk's memory", "Süreklilik", { stageTo: 9 })),
    later("dc_p23_kanun2", { stage: 2, tags: ["period", "1923", "institution", "memory"] },
      "Metin kısa, sıra uzun",
      "Kanun gazetede. Duruşma salonunda eski ölçü konuşulur. İki hukuk aynı davayı tarif etmez.",
      "The text is short, the queue is long",
      "The statute is in the gazette. In the hearing room they still speak the old measure. Two laws do not describe the same case.",
      choice("train", "Kaleme yeni cümle öğret", "Teach the clerk the new sentence", "Kurum", { effects: { info: 1 }, stageTo: 3, next: { eventId: "dc_p23_kanun3", dueTurns: 36, key: "p23-kanun3" } }),
      choice("dual", "İkisini yan yana bırak", "Leave both side by side", "Belirsizlik", { effects: { rumor: 1 }, stageTo: 3 })),
    later("dc_p23_kanun3", { stage: 3, tags: ["period", "1923", "long", "institution"] },
      "Bir nesil, iki hüküm",
      "Yeni metin alışkanlık olmuştur. Eski ölçü dipnotta durur. Taşra hâlâ 'eski kâğıt geçer' der.",
      "One generation, two judgments",
      "The new text has become a habit. The old measure sits in a footnote. The provinces still say the old paper holds.",
      choice("unify", "Dipnotu kapat", "Close the footnote", "Tek cümle", { stageTo: 4 }),
      choice("live", "Dipnotu yaşat", "Let the footnote live", "İkili hafıza", { stageTo: 4 })),
  ],
});
push({
  id: "p50-nato", arc: "external", era: "1950", tags: ["period", "1950", "external", "fiscal", "institution", "cross"],
  nodes: [
    opening("dc_p50_nato", { era: "1950", needInst: "ordu", tags: ["period", "1950", "external", "fiscal"] },
      "İttifak kalemi, yatırım satırı",
      "Fahri Paşa hattı ittifak takvimini değiştirmez. Hasan Bey tarım kredisini aynı satırda görür. Bütçe, iki işi bir cümle sanır.",
      "An alliance pen, an investment line",
      "Fahri Pasha's line does not change the alliance calendar. Hasan Bey sees farm credit on the same line. The budget treats two jobs as one sentence.",
      choice("ally", "İttifak satırını öne al", "Bring the alliance line forward", "Dış tempo; iç kayar", { effects: { heat: 1 }, stageTo: 1, next: { eventId: "dc_p50_nato2", dueTurns: 6, key: "p50-nato2" }, echo: "Savunma satırı doldu; yatırım dipnota indi." }),
      choice("farm", "Kredi satırını tut", "Hold the credit line", "Kır rızası", { stageTo: 9 })),
    later("dc_p50_nato2", { stage: 2, tags: ["period", "1950", "external", "memory"] },
      "Tedarik gelir, çeşme bekler",
      "İttifak kalemi dolmuştur. Celal Başkan çeşme keşfini hâlâ şişirir. Fahri 'dış yükümlülük iç öncelikten önce' der.",
      "Supply arrives, the fountain waits",
      "The alliance pen is full. Mayor Celal still inflates the fountain survey. Fahri says the external obligation comes before the inner priority.",
      choice("keep", "Yükümlülüğü koru", "Keep the obligation", "Dış çapa", { stageTo: 3, next: { eventId: "dc_p50_nato3", dueTurns: 24, key: "p50-nato3" } }),
      choice("shift", "Çeşme payını geri yaz", "Write the fountain share back", "Yerel rıza", { effects: { heat: -1 }, stageTo: 3 })),
    later("dc_p50_nato3", { stage: 3, tags: ["period", "1950", "long", "external"] },
      "On yıl, aynı dipnot",
      "İttifak cümlesi omurga olmuştur. Yatırım satırı hâlâ kayar. Hasan'ın vadesi unutulmuş, Fahri'nin takvimi unutulmamıştır.",
      "Ten years, the same footnote",
      "The alliance sentence has become a spine. The investment line still slips. Hasan's term is forgotten; Fahri's calendar is not.",
      choice("archive", "Dipnotu kalıcı yaz", "Write the footnote as permanent", "Hafıza", { stageTo: 4 }),
      choice("rebalance", "Yatırımı tekrar aç", "Reopen investment", "İç pay", { stageTo: 4 })),
  ],
});
push({
  id: "p50-radyo", arc: "media", era: "1950", exclusive: "media-path", branch: "brief", tags: ["period", "1950", "media", "government", "cross"],
  nodes: [
    opening("dc_p50_radyo", { era: "1950", tags: ["period", "1950", "media", "government"] },
      "Akşam yayını, kahve tezgâhı",
      "Resmî ses akşam saatinde konuşmak ister. Kahvehane aynı saatte başka cümle kurar. Cevat 'merkez duysun' der; tezgâh zaten duymuştur.",
      "The evening broadcast, the coffee counter",
      "The official voice wants to speak at the evening hour. The coffeehouse builds another sentence at the same hour. Cevat says let the centre hear; the counter has already heard.",
      choice("brief", "Yayını net tut", "Keep the broadcast clear", "Anlatı", { effects: { info: 1, rumor: -1 }, lock: "brief", stageTo: 1, next: { eventId: "dc_p50_radyo2", dueTurns: 4, key: "p50-radyo2" }, echo: "Akşam cümlesi resmi; tezgâh ayrıca konuşur." }),
      choice("short", "Yayını kısa kes", "Cut the broadcast short", "Boşluk", { lock: "brief", stageTo: 9 })),
    later("dc_p50_radyo2", { stage: 2, tags: ["period", "1950", "media", "memory"] },
      "Cümle tutulur, tefsir dağılır",
      "Yayın metni arşivdedir. İlçe 'başka tefsir' der. İki kulak aynı saati dinlemez.",
      "The sentence holds, the reading scatters",
      "The broadcast text is in the archive. The district says another reading. Two ears do not listen to the same hour.",
      choice("repeat", "Aynı cümleyi tekrar et", "Repeat the same sentence", "Anlatı sıkı", { effects: { rumor: -1 }, stageTo: 3, next: { eventId: "dc_p50_radyo3", dueTurns: 24, key: "p50-radyo3" } }),
      choice("leave", "Tefsiri kahveye bırak", "Leave the reading to the coffeehouse", "Söylenti", { effects: { rumor: 2 }, stageTo: 3 })),
    later("dc_p50_radyo3", { stage: 3, tags: ["period", "1950", "long", "media"] },
      "İki seçim, aynı saat",
      "Resmî ses hâlâ akşamdır. Tezgâh kendi arşivini kurmuştur. Devlet cümlesi duyulur, inanılmaz.",
      "Two elections, the same hour",
      "The official voice is still evening. The counter has built its own archive. The state sentence is heard; it is not believed.",
      choice("own", "Saati kurum saati say", "Count the hour as the institution's", "Süreklilik", { stageTo: 4 }),
      choice("cede", "Tezgâh arşivini kabul et", "Accept the counter's archive", "Güven incelir", { effects: { rumor: 1 }, stageTo: 4 })),
  ],
});
push({
  id: "p50-tarim", arc: "fiscal", era: "1950", tags: ["period", "1950", "fiscal", "group", "region"],
  nodes: [
    opening("dc_p50_tarim", { era: "1950", needInst: "maliye", needGroup: "farmers", tags: ["period", "1950", "fiscal", "group"] },
      "Hasat kredisi, vade sisi",
      "Hasan Bey kredi vaat eder, vade gizler. Çiftçi 'bu yıl' der; defter 'gelecek hasat' yazar. İki takvim aynı tarlayı biçmez.",
      "Harvest credit, a fog of terms",
      "Hasan Bey promises credit and hides the term. The farmer says this year; the ledger writes next harvest. Two calendars do not cut the same field.",
      choice("lend", "Krediyi bu yıl yaz", "Write the credit for this year", "Rıza; vade şişer", { effects: { heat: -1 }, stageTo: 1, next: { eventId: "dc_p50_tarim2", dueTurns: 6, key: "p50-tarim2" }, echo: "Kredi düştü; vade sisin içinde kaldı." }),
      choice("fog", "Vadeyi açık yaz", "Write the term in the open", "Info; kır homurdanır", { effects: { info: 1, heat: 1 }, stageTo: 9 })),
    later("dc_p50_tarim2", { stage: 2, tags: ["fiscal", "1950", "memory", "group"] },
      "Taksit günü, harman yok",
      "Gişe ödeme ister. Harman geç kalmıştır. Hasan 'mevsim' der. Çiftçi 'söz' der.",
      "Installment day, no threshing",
      "The window wants payment. The threshing is late. Hasan says the season. The farmer says the promise.",
      choice("roll", "Vadeyi kaydır", "Slide the term", "Borç uzar", { stageTo: 3, next: { eventId: "dc_p50_tarim3", dueTurns: 36, key: "p50-tarim3" } }),
      choice("collect", "Tahsilatı işle", "Run the collection", "Kır ısı", { effects: { heat: 2 }, stageTo: 3 })),
    later("dc_p50_tarim3", { stage: 3, tags: ["fiscal", "long", "1950", "group"] },
      "On hasat, aynı sis",
      "Kredi cümlesi alışkanlık olmuştur. Vade hâlâ sis. Kır, devleti banka sanır.",
      "Ten harvests, the same fog",
      "The credit sentence has become a habit. The term is still fog. The village treats the state as a bank.",
      choice("clear", "Vade cetvelini as", "Hang a term table", "Açık defter", { effects: { info: 1 }, stageTo: 4 }),
      choice("habit", "Sisi bırak", "Leave the fog", "Alışkanlık", { stageTo: 4 })),
  ],
});
push({
  id: "p80-fiyat", arc: "crisis", era: "1980", exclusive: "inflation-path", branch: "target", tags: ["period", "1980", "crisis", "inflation", "fiscal", "cross"],
  nodes: [
    opening("dc_p80_fiyat", { era: "1980", needInst: "maliye", minInflation: 20, tags: ["period", "1980", "crisis", "inflation"] },
      "Fiyat listesi, kuyruk hanesi",
      "Turgut kadrosu listeyi tek satır ister. Hane kuyrukta başka fiyat görür. Rapor bir ay gecikir; çanta gecikmez.",
      "A price list, a household queue",
      "Turgut's cadre wants the list in a single line. The household sees another price in the queue. The report is a month late; the bag is not.",
      choice("list", "Listeyi as, hedefi söyle", "Hang the list, name the target", "Çapa; kuyruk kızar", { effects: { heat: 2 }, lock: "target", stageTo: 1, next: { eventId: "dc_p80_fiyat2", dueTurns: 4, key: "p80-fiyat2" }, echo: "Hedef asıldı; kuyruk hedefi yemedi." }),
      choice("quiet", "Listeyi çekmecede tut", "Keep the list in the drawer", "Sessizlik", { lock: "target", stageTo: 9 })),
    later("dc_p80_fiyat2", { stage: 2, tags: ["crisis", "inflation", "1980", "memory"] },
      "Hedef durur, gıda ayrı",
      "Liste tutulmuş görünür. Gıda satırı ayrı yaşamaktadır. Turgut 'hane şoku istatistiktir' der. Pazar 'istatistik değil' der.",
      "The target holds, food is separate",
      "The list looks held. The food line is living apart. Turgut says the household shock is a statistic. The market says it is not.",
      choice("food", "Gıdayı ayrı hedefle", "Target food separately", "Dar çapa", { effects: { heat: -1 }, stageTo: 3, next: { eventId: "dc_p80_fiyat3", dueTurns: 24, key: "p80-fiyat3" } }),
      choice("core", "Tek satırı koru", "Keep the single line", "Kağıt istikrar", { stageTo: 3 })),
    later("dc_p80_fiyat3", { stage: 3, tags: ["crisis", "inflation", "long", "1980"] },
      "Kuyruk unutulur, refleks kalır",
      "Liste arşivde. Hane hâlâ etiket okur, cümle dinlemez. Fiyat çapa oldu, güven olmadı.",
      "The queue is forgotten, the reflex remains",
      "The list is in the archive. The household still reads the tag and does not listen to the sentence. Price became an anchor; trust did not.",
      choice("keep", "Çapayı kurum say", "Treat the anchor as an institution", "Hafıza", { stageTo: 4 }),
      choice("drop", "Listeyi tarih say", "Treat the list as history", "Unutuş", { stageTo: 4 })),
  ],
});
push({
  id: "p80-index", arc: "crisis", era: "1980", exclusive: "inflation-path", branch: "index", tags: ["period", "1980", "crisis", "inflation", "institution", "cross"],
  nodes: [
    opening("dc_p80_index", { era: "1980", needInst: "merkez", minInflation: 20, tags: ["period", "1980", "crisis", "inflation"] },
      "Endeks cümlesi, ücret ayrı",
      "Merkez kalemi endeksi ayrı yazar. Turgut kadrosu fiyatı tek satır ister. Ücret, ikisinin de altında kalır.",
      "An index sentence, wages apart",
      "The centre's pen writes the index separately. Turgut's cadre wants price in a single line. Wages sit under both.",
      choice("index", "Ücreti endekse bağla", "Tie wages to the index", "Rıza; bekleti şişer", { effects: { heat: -1, rumor: 1 }, lock: "index", stageTo: 1, next: { eventId: "dc_p80_index2", dueTurns: 5, key: "p80-index2" }, echo: "Endeks cümlesi tutuldu; fiyat cümlesi kaçtı." }),
      choice("freeze", "Endeksi ertele", "Defer the index", "Hane ısı", { effects: { heat: 2 }, lock: "index", stageTo: 9 })),
    later("dc_p80_index2", { stage: 2, tags: ["crisis", "inflation", "1980", "memory"] },
      "Bağ vardır, gecikme de",
      "Endeks yayımlanır. Zam üç ay geriden gelir. İşçi 'sayı' der, pazar 'dün' der.",
      "There is a tie, and a lag",
      "The index is published. The rise arrives three months behind. Labour says the number; the market says yesterday.",
      choice("catch", "Gecikmeyi kapat", "Close the lag", "Maliyet", { effects: { heat: 1 }, stageTo: 3, next: { eventId: "dc_p80_index3", dueTurns: 36, key: "p80-index3" } }),
      choice("lag", "Gecikmeyi kural say", "Treat the lag as a rule", "Beklenti", { stageTo: 3 })),
    later("dc_p80_index3", { stage: 3, tags: ["crisis", "inflation", "long", "1980"] },
      "Endeks alışkanlık, fiyat huy",
      "Bağ durur. Herkes endeksi bekler, kimse fiyatı unutmaz. Çapa endeks olmuş, istikrar olmamıştır.",
      "Index is a habit, price is a manner",
      "The tie remains. Everyone waits on the index; no one forgets the price. The anchor became an index; it did not become stability.",
      choice("keep", "Bağı koru", "Keep the tie", "Kurumsal refleks", { stageTo: 4 }),
      choice("cut", "Bağı çöz", "Untie it", "Siyaset", { stageTo: 4 })),
  ],
});
push({
  id: "p80-reset", arc: "crisis", era: "1980", tags: ["period", "1980", "crisis", "institutional", "institution", "cross"],
  nodes: [
    opening("dc_p80_reset", { era: "1980", needInst: "yargi", tags: ["period", "1980", "crisis", "institutional"] },
      "Takvim mühür, duruşma yavaş",
      "Mahkeme kalemi yeni tempo ister. Eski dosya yığılmıştır. Yılmaz YÖK hattı kampüsü 'sakin' yazar; koridor sakin değildir.",
      "A sealed calendar, a slow hearing",
      "The court clerk wants a new pace. Old files are stacked. Yılmaz's YÖK line writes the campus as 'quiet'; the corridor is not.",
      choice("seal", "Takvimi mühürle, sırayı sıfırla", "Seal the calendar, reset the queue", "Düzen; birikim", { effects: { heat: -1 }, stageTo: 1, next: { eventId: "dc_p80_reset2", dueTurns: 6, key: "p80-reset2" }, echo: "Sıra sıfır göründü; dosya yerinde kaldı." }),
      choice("stack", "Yığını eski sırayla işle", "Work the stack in the old order", "Süreklilik", { stageTo: 9 })),
    later("dc_p80_reset2", { stage: 2, tags: ["institutional", "1980", "memory"] },
      "Sıfır görünür, birikim durur",
      "Yeni numara verilmiştir. Eski esas hâlâ çekmecededir. Kurum, sıfırlamayı temizlik sanır.",
      "Zero looks real, the backlog stays",
      "A new number has been issued. The old merits are still in the drawer. The institution mistakes a reset for cleaning.",
      choice("merge", "Eski esası yeni sıraya al", "Bring old merits into the new queue", "Yük", { stageTo: 3, next: { eventId: "dc_p80_reset3", dueTurns: 36, key: "p80-reset3" } }),
      choice("forget", "Çekmeceyi kapat", "Close the drawer", "Unutuş", { effects: { info: -1 }, stageTo: 3 })),
    later("dc_p80_reset3", { stage: 3, tags: ["institutional", "long", "1980"] },
      "Bir nesil, mühürlü saat",
      "Takvim hâlâ mühürlü durur. Duruşma hızı alışkanlık olmamıştır. Kampüs cümlesi 'sakin', arşiv başka türlü.",
      "A generation, a sealed hour",
      "The calendar still looks sealed. Hearing speed never became a habit. The campus sentence is 'quiet'; the archive is otherwise.",
      choice("open", "Mührü gevşet", "Loosen the seal", "Açık tempo", { effects: { heat: 1 }, stageTo: 4 }),
      choice("keep", "Mühürlü saati tut", "Keep the sealed hour", "Form", { stageTo: 4 })),
  ],
});
push({
  id: "p80-ihracat", arc: "development", era: "1980", tags: ["period", "1980", "development", "fiscal", "group", "cross"],
  nodes: [
    opening("dc_p80_ihracat", { era: "1980", needInst: "maliye", tags: ["period", "1980", "development", "fiscal"] },
      "İhracat seferi, iç kuyruk",
      "Turgut kadrosu dış satışı öne alır. Fabrika vardiyası ihracat için kayar. Hane, aynı vardiyada kuyrukta durur.",
      "An export drive, an inner queue",
      "Turgut's cadre brings foreign sales forward. The factory shift slides toward export. The household stands in a queue on the same shift.",
      choice("export", "Seferi öne al", "Bring the drive forward", "Döviz; iç daralma", { effects: { heat: 1 }, stageTo: 1, next: { eventId: "dc_p80_ihracat2", dueTurns: 6, key: "p80-ihracat2" }, echo: "İhracat cümlesi doldu; iç kuyruk uzadı." }),
      choice("home", "İç tedariki tut", "Hold domestic supply", "Kuyruk kısalır", { effects: { heat: -1 }, stageTo: 9 })),
    later("dc_p80_ihracat2", { stage: 2, tags: ["development", "1980", "memory"] },
      "Sipariş var, girdi yok",
      "Dış alıcı bekler. İç girdi kuyruğa takılır. İş dünyası güler, hane asık.",
      "There is an order, no input",
      "The foreign buyer waits. Domestic input catches on the queue. Business smiles; the household does not.",
      choice("input", "Girdi payını ayır", "Set aside an input share", "Kapasite", { stageTo: 3, next: { eventId: "dc_p80_ihracat3", dueTurns: 24, key: "p80-ihracat3" } }),
      choice("push", "Siparişi yine öne al", "Push the order forward again", "Dış tempo", { effects: { rumor: 1 }, stageTo: 3 })),
    later("dc_p80_ihracat3", { stage: 3, tags: ["development", "long", "1980"] },
      "Sefer alışkanlık, kuyruk hafıza",
      "İhracat cümlesi omurga olmuştur. İç kuyruk arşivde durur. İki güven endeksi aynı yılı tarif etmez.",
      "The drive is a habit, the queue is memory",
      "The export sentence has become a spine. The inner queue sits in the archive. Two confidence indexes do not describe the same year.",
      choice("keep", "Seferi kalıcı yaz", "Write the drive as permanent", "Dış omurga", { stageTo: 4 }),
      choice("rebalance", "İç payı geri çağır", "Call the inner share back", "Hane", { stageTo: 4 })),
  ],
});
push({
  id: "p02-imf", arc: "fiscal", era: "2002", tags: ["period", "2002", "fiscal", "institution", "external", "cross"],
  nodes: [
    opening("dc_p02_imf", { era: "2002", needInst: "maliye", tags: ["period", "2002", "fiscal", "external"] },
      "Şartlı cümle, faiz dışı",
      "Kemal Bey faiz dışı fazlayı omurga ister. Harcama dipnota itilir. Hane, dipnotu fatura sanır.",
      "A conditional sentence, a primary surplus",
      "Kemal Bey wants the primary surplus as a spine. Spending is pushed to a footnote. The household mistakes the footnote for a bill.",
      choice("surplus", "Fazla satırını tut", "Hold the surplus line", "Program; rıza incelir", { effects: { heat: 1 }, stageTo: 1, next: { eventId: "dc_p02_imf2", dueTurns: 5, key: "p02-imf2" }, echo: "Şartlı cümle tutuldu; saha tahsilatı iyimser kaldı." }),
      choice("spend", "Dipnotu harcamaya çevir", "Turn the footnote into spending", "Rıza; program kayar", { effects: { heat: -1 }, stageTo: 9 })),
    later("dc_p02_imf2", { stage: 2, tags: ["fiscal", "2002", "memory"] },
      "Program tutar, saha şişer",
      "Fazla kâğıtta durur. Tahsilat iyimser yazılmıştır. Süreyya hattı örtük hedefi kapıda tutar.",
      "The program holds, the field inflates",
      "The surplus sits on paper. Collection is written optimistically. Süreyya's line keeps the implicit target at the door.",
      choice("audit", "Tahsilatı teftiş et", "Inspect the collection", "Info", { effects: { info: 1 }, stageTo: 3, next: { eventId: "dc_p02_imf3", dueTurns: 24, key: "p02-imf3" } }),
      choice("paper", "Kâğıdı program say", "Count the paper as the program", "Görünürlük", { stageTo: 3 })),
    later("dc_p02_imf3", { stage: 3, tags: ["fiscal", "long", "2002"] },
      "Şart biter, refleks kalır",
      "Program kapanmış görünür. Fazla cümlesi hâlâ omurga. Harcama her kapıda dipnot arar.",
      "The condition ends, the reflex remains",
      "The program looks closed. The surplus sentence is still a spine. Spending looks for a footnote at every door.",
      choice("keep", "Refleksi koru", "Keep the reflex", "Mali hafıza", { stageTo: 4 }),
      choice("ease", "Dipnotu sil", "Erase the footnote", "Harcama kapısı", { stageTo: 4 })),
  ],
});
push({
  id: "p02-ab", arc: "external", era: "2002", exclusive: "eu-path", branch: "chapter", tags: ["period", "2002", "external", "institution", "cross"],
  nodes: [
    opening("dc_p02_ab", { era: "2002", needInst: "yargi", tags: ["period", "2002", "external", "institution"] },
      "Fasıl takvimi, mahkeme temposu",
      "Ayşe Hanım kurul paketi Brüksel saatine göre kurar. Mahkeme kalemi aynı hızda değildir. İki takvim aynı dosyayı bitirmez.",
      "A chapter calendar, a court pace",
      "Ayşe Hanım's board sets the package to Brussels time. The court clerk is not at the same speed. Two calendars do not finish the same file.",
      choice("chapter", "Faslın takvimini işle", "Run the chapter calendar", "Uyum; duruşma şişer", { effects: { info: 1 }, lock: "chapter", stageTo: 1, next: { eventId: "dc_p02_ab2", dueTurns: 6, key: "p02-ab2" }, echo: "Paket çıktı; duruşma aynı koridorda kaldı." }),
      choice("court", "Mahkeme temposunu esas al", "Take the court pace as the base", "İç saat", { lock: "chapter", stageTo: 9 })),
    later("dc_p02_ab2", { stage: 2, tags: ["external", "2002", "memory"] },
      "Paket çıkar, kalem yetişmez",
      "Mevzuat hızı görünür. Duruşma yavaşlığı dipnottadır. Ayşe 'takvim uyumdur' der. Kalem 'takvim duruşmadır' der.",
      "The package is out, the clerk does not catch up",
      "Statute speed is visible. Hearing slowness is in the footnote. Ayşe says the calendar is alignment. The clerk says the calendar is the hearing.",
      choice("staff", "Kalemi takvime yaklaştır", "Move the clerk toward the calendar", "Yorgunluk", { stageTo: 3, next: { eventId: "dc_p02_ab3", dueTurns: 36, key: "p02-ab3" } }),
      choice("gap", "Hızı kâğıtta bırak", "Leave the speed on paper", "Kağıt uyum", { stageTo: 3 })),
    later("dc_p02_ab3", { stage: 3, tags: ["external", "long", "2002"] },
      "Fasıl arşivi, koridor başka",
      "Paketler durur. Mahkeme saati kendi alışkanlığını kurmuştur. Uyum cümlesi dışarıda, tempo içeride.",
      "A chapter archive, another corridor",
      "The packages remain. The court hour has built its own habit. The alignment sentence is outside; the pace is inside.",
      choice("keep", "Fasıl alışkanlığını tut", "Keep the chapter habit", "Dış çapa", { stageTo: 4 }),
      choice("home", "İç saati esas yaz", "Write the inner hour as the base", "Kurum", { stageTo: 4 })),
  ],
});
push({
  id: "p02-ab-pause", arc: "external", era: "2002", exclusive: "eu-path", branch: "pause", tags: ["period", "2002", "external", "government", "cross"],
  nodes: [
    opening("dc_p02_ab_pause", { era: "2002", needInst: "mulkiye", tags: ["period", "2002", "external", "government"] },
      "Fasıl ara, iç takvim",
      "Cemil Vali hattı 'önce il uygulaması' der. Ayşe Hanım kurul fasıl satırını bekletmemek ister. Ara, iki tempo arasında durur.",
      "A chapter pause, an inner calendar",
      "Cemil Vali's line says provincial implementation first. Ayşe Hanım's board does not want the chapter line waiting. The pause sits between two paces.",
      choice("pause", "Faslın arasını yaz", "Write the chapter pause", "İç tempo", { effects: { rumor: 1 }, lock: "pause", stageTo: 1, next: { eventId: "dc_p02_ab_pause2", dueTurns: 5, key: "p02-ab-pause2" }, echo: "Ara yazıldı; dış masa takvimi sordu." }),
      choice("keep", "Faslın satırını işler tut", "Keep the chapter line running", "Dış tempo", { lock: "pause", stageTo: 9 })),
    later("dc_p02_ab_pause2", { stage: 2, tags: ["external", "2002", "memory"] },
      "Ara durur, soru gelir",
      "İç takvim dolmuştur. Dış masa 'hangi hafta' diye sorar. Cemil yüzde yazar; saha binayı arar.",
      "The pause holds, a question arrives",
      "The inner calendar is full. The outer desk asks which week. Cemil writes a percentage; the field looks for the building.",
      choice("date", "Bir tarih söyle", "Name a date", "Beklenti", { effects: { info: 1 }, stageTo: 3, next: { eventId: "dc_p02_ab_pause3", dueTurns: 24, key: "p02-ab-pause3" } }),
      choice("fog", "Tarihi sisle", "Fog the date", "Belirsizlik", { effects: { rumor: 2 }, stageTo: 3 })),
    later("dc_p02_ab_pause3", { stage: 3, tags: ["external", "long", "2002"] },
      "Ara alışkanlık olur",
      "Fasıl satırı hâlâ arada. İç uygulama kendi omurgasını kurmuştur. Dış cümle her yıl sorulur, her yıl ertelenir.",
      "The pause becomes a habit",
      "The chapter line is still in between. Inner implementation has built its own spine. The outer sentence is asked every year and postponed every year.",
      choice("habit", "Arayı omurga say", "Count the pause as a spine", "İç form", { stageTo: 4 }),
      choice("resume", "Satırı tekrar aç", "Reopen the line", "Dış çapa", { stageTo: 4 })),
  ],
});
push({
  id: "p02-merit", arc: "government", era: "2002", exclusive: "cadre-path", branch: "merit", tags: ["period", "2002", "government", "cadre", "institution", "cross"],
  nodes: [
    opening("dc_p02_merit", { era: "2002", needInst: "mulkiye", tags: ["period", "2002", "government", "cadre"] },
      "CV masada, koridor sorar",
      "Liyakat dosyası açılır. Cemil Vali hattı yüzde yazar. Koridor sadakat sorar. İki soru aynı kadroyu tarif etmez.",
      "A CV on the table, the corridor asks",
      "The merit file is opened. Cemil Vali's line writes a percentage. The corridor asks for loyalty. Two questions do not describe the same post.",
      choice("merit", "CV'yi esas al", "Take the CV as the base", "Kurum; tempo kayar", { effects: { info: 1 }, lock: "merit", stageTo: 1, next: { eventId: "dc_p02_merit2", dueTurns: 5, key: "p02-merit2" }, echo: "Dosya liyakat dedi; koridor başka soru sordu." }),
      choice("mix", "Koridoru da dinle", "Listen to the corridor too", "Hizalama", { lock: "merit", stageTo: 9 })),
    later("dc_p02_merit2", { stage: 2, tags: ["government", "2002", "cadre", "memory"] },
      "Atama olur, tempo sorulur",
      "İsim liyakatle düşmüştür. Uygulama yüzdesi şişer, saha 30 hisseder. Cemil 'tempo görünsün' der.",
      "The appointment happens, pace is asked",
      "The name fell by merit. The implementation percentage inflates; the field feels 30. Cemil says let the pace be visible.",
      choice("shield", "Dosyayı koru", "Protect the file", "Özerklik", { stageTo: 3, next: { eventId: "dc_p02_merit3", dueTurns: 36, key: "p02-merit3" } }),
      choice("pace", "Tempo için isim kaydır", "Move a name for pace", "Yorgunluk", { effects: { heat: 1 }, stageTo: 3 })),
    later("dc_p02_merit3", { stage: 3, tags: ["government", "long", "cadre", "2002"] },
      "Bir kuşak, CV alışkanlığı",
      "Koridor hâlâ sorar. Dosya hâlâ CV der. Devlet, liyakati kalkan sanmış; yorgunluk da kalkan olmuştur.",
      "A generation, a CV habit",
      "The corridor still asks. The file still says CV. The state took merit for a shield; fatigue became a shield as well.",
      choice("keep", "CV kalkanını tut", "Keep the CV shield", "Kurum saati", { stageTo: 4 }),
      choice("bend", "Koridora yer aç", "Make room for the corridor", "Mandat", { stageTo: 4 })),
  ],
});
push({
  id: "p02-loyalty", arc: "government", era: "2002", exclusive: "cadre-path", branch: "loyalty", tags: ["period", "2002", "government", "cadre", "form", "cross"],
  nodes: [
    opening("dc_p02_loyalty", { era: "2002", needInst: "mulkiye", tags: ["period", "2002", "government", "cadre"] },
      "Tempo isim ister",
      "Merkez, kurum özerkliğini tempo sanır. Cemil Vali hattı isimleri kaydırmak ister. CV masada bekler, koridor konuşur.",
      "Pace wants a name",
      "The centre mistakes institutional autonomy for pace. Cemil Vali's line wants the names moved. The CV waits on the table; the corridor speaks.",
      choice("loyal", "İsimleri tempo ile kaydır", "Move names with the pace", "Hizalama; yorgunluk", { effects: { heat: 1 }, lock: "loyalty", stageTo: 1, next: { eventId: "dc_p02_loyalty2", dueTurns: 4, key: "p02-loyalty2" }, echo: "İsimler kaydı; dosya şablonu aynı kaldı." }),
      choice("hold", "İsimleri tut, tempo yaz", "Hold the names, write the pace", "Süreklilik", { lock: "loyalty", stageTo: 9 })),
    later("dc_p02_loyalty2", { stage: 2, tags: ["government", "2002", "cadre", "memory"] },
      "Yeni isim, eski şablon",
      "Kadro değişmiştir. Rapor cümlesi değişmemiştir. Leyla Koordinasyon 'kanal tıkanınca sessizlik de bilgidir' der.",
      "A new name, the old template",
      "The post has changed. The report sentence has not. Leyla Coordination says when the channel clogs, silence is also information.",
      choice("template", "Şablonu da değiştir", "Change the template too", "Siyaset", { effects: { info: -1 }, stageTo: 3, next: { eventId: "dc_p02_loyalty3", dueTurns: 24, key: "p02-loyalty3" } }),
      choice("keep", "Şablonu bırak", "Leave the template", "Hafıza sızar", { effects: { info: 1 }, stageTo: 3 })),
    later("dc_p02_loyalty3", { stage: 3, tags: ["government", "long", "form", "2002"] },
      "Mandat yüksek, saat alçak",
      "İsimler birkaç kez dönmüştür. Kurum saati merkeze bakmayı alışkanlık sayar. Özerklik bir dipnottur.",
      "Mandate high, the clock low",
      "The names have turned several times. The institution's clock has taken looking at the centre as a habit. Autonomy is a footnote.",
      choice("lock", "Hizayı omurga yaz", "Write the alignment as spine", "Form", { stageTo: 4 }),
      choice("clock", "Kurum saatini geri ver", "Give the institution its clock back", "Özerklik", { stageTo: 4 })),
  ],
});
push({
  id: "pg-kira", arc: "housing", era: "gunumuz", exclusive: "housing-path", branch: "relief", tags: ["period", "gunumuz", "group", "fiscal", "cross"],
  nodes: [
    opening("dc_pg_kira", { era: "gunumuz", needInst: "belediye", tags: ["period", "gunumuz", "fiscal", "group"] },
      "Kira payı, hane nefes",
      "Nuri Hazine faturayı siyaset sayar. Selim İmar daireyi başarı yazar. Hane, ikisini de kira olarak okur.",
      "A rent share, a household breath",
      "Nuri Treasury treats the bill as politics. Selim Zoning writes the flat as success. The household reads both as rent.",
      choice("relief", "Kira payını öne al", "Bring the rent share forward", "Rıza; kasa iner", { effects: { heat: -2 }, lock: "relief", stageTo: 1, next: { eventId: "dc_pg_kira2", dueTurns: 4, key: "pg-kira2" }, echo: "Pay düştü; kira cümlesi durmadı." }),
      choice("bill", "Faturayı olduğu gibi bırak", "Leave the bill as it is", "Kasa", { lock: "relief", stageTo: 9 })),
    later("dc_pg_kira2", { stage: 2, tags: ["gunumuz", "memory", "group"] },
      "Pay vardır, ev sahibi başka",
      "Hane payı görmüştür. Yeni dönem, yeni rakam kapıya yapışır. Belediye 'rahatlama' der; kapıcı 'herkese geldi' der.",
      "There is a share, the landlord is another matter",
      "The household has seen the share. A new term, a new figure sticks to the door. The municipality says relief; the doorman says it came to everyone.",
      choice("extend", "Payı uzat", "Extend the share", "Yük", { stageTo: 3, next: { eventId: "dc_pg_kira3", dueTurns: 24, key: "pg-kira3" } }),
      choice("stop", "Payı dönemlik kapat", "Close the share with the term", "Şok döner", { effects: { heat: 1 }, stageTo: 3 })),
    later("dc_pg_kira3", { stage: 3, tags: ["gunumuz", "long", "fiscal"] },
      "Pay alışkanlık, kira huy",
      "Rahatlatma cümlesi omurga olmuştur. Kira hâlâ ayrı yaşar. Devlet baba refleksi, kasa satırından uzun durur.",
      "The share is a habit, rent is a manner",
      "The relief sentence has become a spine. Rent still lives apart. The father-state reflex sits longer than the till line.",
      choice("keep", "Payı kalıcı yaz", "Write the share as permanent", "Mali yük", { stageTo: 4 }),
      choice("wean", "Payı geri çek", "Pull the share back", "Hane ısı", { effects: { heat: 2 }, stageTo: 4 })),
  ],
});
push({
  id: "pg-konut", arc: "development", era: "gunumuz", exclusive: "housing-path", branch: "supply", tags: ["period", "gunumuz", "development", "region", "cross"],
  nodes: [
    opening("dc_pg_konut", { era: "gunumuz", needInst: "belediye", tags: ["period", "gunumuz", "development"] },
      "Tabela dolar, tapu ayrı",
      "Selim İmar arz konuşulsun ister. Keşif ve kalite ayrı dosyadır. Nuri, faturayı dipnota iter.",
      "The signboard fills, title is separate",
      "Selim Zoning wants supply spoken. Survey and quality are separate files. Nuri pushes the bill into a footnote.",
      choice("supply", "Arz seferini aç", "Open the supply drive", "Görünürlük; keşif şişer", { effects: { rumor: 1 }, lock: "supply", stageTo: 1, next: { eventId: "dc_pg_konut2", dueTurns: 6, key: "pg-konut2" }, echo: "Tabela doldu; tapu başka odada kaldı." }),
      choice("title", "Önce tapu satırını düzelt", "Fix the title line first", "Yavaş arz", { lock: "supply", stageTo: 9 })),
    later("dc_pg_konut2", { stage: 2, tags: ["development", "gunumuz", "memory"] },
      "Daire sayılır, hat yetişmez",
      "Anahtar fotoğrafı vardır. Yol, su, okul ayrı keşifte. Selim daireyi başarı sayar.",
      "Flats are counted, the line does not catch up",
      "There is a photograph of a key. Road, water, school sit in another survey. Selim counts the flat as success.",
      choice("service", "Hizmet keşfini bağla", "Tie in the service survey", "Kapasite", { stageTo: 3, next: { eventId: "dc_pg_konut3", dueTurns: 36, key: "pg-konut3" } }),
      choice("count", "Sayıyı başarı yaz", "Write the number as success", "Kağıt arz", { stageTo: 3 })),
    later("dc_pg_konut3", { stage: 3, tags: ["development", "long", "gunumuz"] },
      "Mahalle var, şehir yok",
      "Daire durur. Hat sonradan gelmiştir. Arz cümlesi alışkanlık, bakım cümlesi yok.",
      "There is a neighbourhood, no city",
      "The flat stands. The line arrived later. The supply sentence is a habit; there is no maintenance sentence.",
      choice("maintain", "Bakım payı yaz", "Write a maintenance share", "Uzun yük", { stageTo: 4 }),
      choice("leave", "Mahalleyi kendi hâline", "Leave the neighbourhood to itself", "Yerel", { stageTo: 4 })),
  ],
});
push({
  id: "pg-afet", arc: "development", era: "gunumuz", tags: ["period", "gunumuz", "development", "region", "institution", "cross"],
  nodes: [
    opening("dc_pg_afet", { era: "gunumuz", needInst: "belediye", tags: ["period", "gunumuz", "development", "region"] },
      "Enkaz kalemi, keşif şişer",
      "Nuri Hazine afet satırını açar. Selim İmar keşfi şişirir. Cemil Vali yüzde 82 yazar; üç il hangi binada başladığını arar.",
      "A rubble line, the survey inflates",
      "Nuri Treasury opens the disaster line. Selim Zoning inflates the survey. Cemil Vali writes 82 percent; three provinces look for which building they started in.",
      choice("fund", "Kalemi öne al", "Bring the line forward", "Rıza; keşif şişer", { effects: { heat: -1 }, stageTo: 1, next: { eventId: "dc_pg_afet2", dueTurns: 5, key: "pg-afet2" }, echo: "Kalem açıldı; keşif defteri doldu, saha binayı aradı." }),
      choice("map", "Önce binayı işaretle", "Mark the building first", "Yavaş yardım", { effects: { info: 1 }, stageTo: 9 })),
    later("dc_pg_afet2", { stage: 2, tags: ["development", "gunumuz", "memory"] },
      "Ödenek var, yer yok",
      "Satır doludur. Parsel tartışması durur. Melisa Öğretim 'derslik açıldı' der; sıra başka ilçededir.",
      "There is an appropriation, no site",
      "The line is full. The parcel argument remains. Melisa Education says a classroom opened; the bench is in another district.",
      choice("parcel", "Parseli kilitle", "Lock the parcel", "Tempo", { stageTo: 3, next: { eventId: "dc_pg_afet3", dueTurns: 36, key: "pg-afet3" } }),
      choice("spread", "Ödeneği ilçelere yay", "Spread the appropriation across districts", "Dağınıklık", { effects: { rumor: 1 }, stageTo: 3 })),
    later("dc_pg_afet3", { stage: 3, tags: ["development", "long", "gunumuz"] },
      "Tabela dikilir, hat gecikir",
      "Bina vardır. Bakım ve hat sonradır. Afet kalemi alışkanlık olmuş, keşif hâlâ şişer.",
      "A sign is planted, the line is late",
      "There is a building. Upkeep and the line come later. The disaster line has become a habit; the survey still inflates.",
      choice("audit", "Keşfi arşivle, şişirmeyi kes", "Archive the survey, cut the inflation", "Kurum", { effects: { info: 1 }, stageTo: 4 }),
      choice("habit", "Kalemi açık tut", "Keep the line open", "Sürekli sefer", { stageTo: 4 })),
  ],
});
push({
  id: "pg-goc", arc: "crisis", era: "gunumuz", tags: ["period", "gunumuz", "crisis", "migration", "region", "group", "cross"],
  nodes: [
    opening("dc_pg_goc", { era: "gunumuz", needRegion: "marmara", needGroup: "urban", tags: ["period", "gunumuz", "migration", "region"] },
      "İlçe nüfus, hizmet aynı",
      "Cemil Vali hattı ilçe nüfusunu 'tempo' yazar. Hat, okul, tapu aynı kadroya bakar. Mahalle iki dilde kira konuşur.",
      "District population, the same services",
      "Cemil Vali's line writes district population as 'pace.' Line, school, title look at the same staff. The neighbourhood talks rent in two languages.",
      choice("absorb", "Hizmet payını ilçeye kaydır", "Shift a service share to the district", "Kapasite; merkez homurdanır", { effects: { heat: -1 }, stageTo: 1, next: { eventId: "dc_pg_goc2", dueTurns: 6, key: "pg-goc2" }, echo: "Pay kaydı; hat aynı kaldı, nüfus değil." }),
      choice("hold", "Kadroya dokunma", "Do not touch the staff", "Yığılma", { effects: { heat: 2 }, stageTo: 9 })),
    later("dc_pg_goc2", { stage: 2, tags: ["migration", "gunumuz", "memory", "region"] },
      "Pay gelir, hat ısınır",
      "Öğretmen kaymış görünür. Servis aynı güzergâhı iki kez döner. Selim İmar 'konut' der; kira başka cümledir.",
      "The share arrives, the line heats",
      "A teacher looks moved. The service runs the same route twice. Selim Zoning says housing; rent is another sentence.",
      choice("rent", "Kira ile hizmeti birlikte yaz", "Write rent and service together", "Çapraz yük", { stageTo: 3, next: { eventId: "dc_pg_goc3", dueTurns: 24, key: "pg-goc3" } }),
      choice("school", "Sadece dersliği çoğalt", "Only multiply classrooms", "Görünürlük", { stageTo: 3 })),
    later("dc_pg_goc3", { stage: 3, tags: ["migration", "long", "gunumuz", "region"] },
      "İlçe alışır, şehir unutmaz",
      "Nüfus cümlesi normalleşmiştir. Hizmet hâlâ geriden gelir. Göç, dönem değil, şehir hali olmuştur.",
      "The district gets used to it, the city does not forget",
      "The population sentence has normalised. Service still arrives from behind. Migration is no longer a period; it is the city's condition.",
      choice("norm", "İlçeyi kalıcı kadroya bağla", "Tie the district to a permanent post", "Uzun kapasite", { stageTo: 4 }),
      choice("temp", "Geçici payı sürdür", "Keep the temporary share", "Belirsizlik", { stageTo: 4 })),
  ],
});
push({
  id: "pg-veri", arc: "media", era: "gunumuz", exclusive: "media-path", branch: "silence", tags: ["period", "gunumuz", "media", "fiscal", "trust", "cross"],
  nodes: [
    opening("dc_pg_veri", { era: "gunumuz", needInst: "maliye", tags: ["period", "gunumuz", "media", "fiscal"] },
      "Sayı çekmecede, manşet boş",
      "Nuri Hazine sayıyı siyasi maliyet sayar. Süreyya hattı örtük hedefi kapıda tutar. Manşet, boşluğu doldurur.",
      "The number in a drawer, an empty headline",
      "Nuri Treasury treats the number as political cost. Süreyya's line keeps the implicit target at the door. The headline fills the gap.",
      choice("silence", "Sayıyı geciktir", "Delay the number", "Sessizlik; söylenti", { effects: { info: -1, rumor: 2 }, lock: "silence", stageTo: 1, next: { eventId: "dc_pg_veri2", dueTurns: 3, key: "pg-veri2" }, echo: "Çekmece kapandı; manşet kendi sayısını yazdı." }),
      choice("release", "Sayıyı saatinde çıkar", "Release the number on the hour", "Maliyet", { effects: { info: 1, heat: 1 }, lock: "silence", stageTo: 9 })),
    later("dc_pg_veri2", { stage: 2, tags: ["media", "gunumuz", "memory", "trust"] },
      "Boşluk dolar, güven incelir",
      "Resmî sayı gelmemiştir. Pazar kendi endeksini kurar. İki sayı aynı ayı tarif etmez.",
      "The gap fills, trust thins",
      "The official number has not come. The market builds its own index. Two numbers do not describe the same month.",
      choice("late", "Gecikmiş sayıyı yine çıkar", "Release the late number anyway", "İtibar", { effects: { info: 1 }, stageTo: 3, next: { eventId: "dc_pg_veri3", dueTurns: 24, key: "pg-veri3" } }),
      choice("hold", "Çekmeceyi kilitli tut", "Keep the drawer locked", "Özerklik kaybı", { effects: { rumor: 2 }, stageTo: 3 })),
    later("dc_pg_veri3", { stage: 3, tags: ["media", "long", "trust", "gunumuz"] },
      "Saat alışkanlık olmaktan çıkar",
      "Açıklama saati artık bir vaat değildir. Hane etiket okur. İstatistik, siyasi maliyet olarak durur.",
      "The hour stops being a habit",
      "Release hour is no longer a promise. The household reads the tag. Statistics sit as political cost.",
      choice("restore", "Saati kurum saati yaz", "Write the hour as the institution's", "Onarım", { effects: { info: 1 }, stageTo: 4 }),
      choice("cost", "Maliyet kuralını bırak", "Leave the cost rule", "Sessizlik kalır", { stageTo: 4 })),
  ],
});
push({
  id: "pa-capa", arc: "monetary", era: "alternatif", exclusive: "external-path", branch: "reserve", tags: ["alternatif", "fiscal", "institution", "external", "cross"],
  nodes: [
    opening("dc_pa_capa", { era: "alternatif", needInst: "merkez", tags: ["alternatif", "fiscal", "institution"] },
      "Erken çapa, rıza dağılır",
      "Orkun Emisyon şoku erken kesmek ister. Süreyya hattı sözle çapa ister. Rıza, ikisinin de dışında dağılır.",
      "An early anchor, consent scatters",
      "Orkun Emission wants to cut the shock early. Süreyya's line wants an anchor in words. Consent scatters outside both.",
      choice("cut", "Erken kesimi yaz", "Write the early cut", "Çapa; rıza kayar", { effects: { heat: 1 }, lock: "reserve", stageTo: 1, next: { eventId: "dc_pa_capa2", dueTurns: 5, key: "pa-capa2" }, echo: "Şok kesildi; rıza başka mahallede dağıldı." }),
      choice("word", "Sözle çapayı dene", "Try the anchor in words", "Beklenti", { effects: { rumor: 1 }, lock: "reserve", stageTo: 9 })),
    later("dc_pa_capa2", { stage: 2, tags: ["alternatif", "memory", "fiscal"] },
      "Kesim tutar, mahalle homurdanır",
      "Kâğıt refleks sınırlanmıştır. Esnaf 'iş yok' der. Orkun 'ihtiyat' der. İki cümle aynı tezgâhı tarif etmez.",
      "The cut holds, the neighbourhood mutters",
      "The paper reflex is bounded. The shopkeeper says there is no work. Orkun says prudence. Two sentences do not describe the same counter.",
      choice("hold", "Kesimi tut", "Hold the cut", "İhtiyat", { stageTo: 3, next: { eventId: "dc_pa_capa3", dueTurns: 24, key: "pa-capa3" } }),
      choice("ease", "Sözle gevşet", "Ease with words", "Rıza", { effects: { heat: -1 }, stageTo: 3 })),
    later("dc_pa_capa3", { stage: 3, tags: ["alternatif", "long", "fiscal"] },
      "Çapa kurum, rıza ayrı",
      "Erken kesim alışkanlık olmuştur. Hane hâlâ fiyat okur. Para otoritesi omurga, toplumsal rıza dipnot.",
      "The anchor is an institution, consent is apart",
      "The early cut has become a habit. The household still reads prices. The monetary authority is a spine; social consent is a footnote.",
      choice("keep", "Çapayı koru", "Keep the anchor", "Kurum", { stageTo: 4 }),
      choice("share", "Rızayı satıra al", "Put consent on the line", "Siyaset", { stageTo: 4 })),
  ],
});
push({
  id: "pa-yerel", arc: "government", era: "alternatif", exclusive: "local-path", branch: "devolve", tags: ["alternatif", "government", "institution", "region", "cross"],
  nodes: [
    opening("dc_pa_yerel", { era: "alternatif", needInst: "belediye", tags: ["alternatif", "government", "institution"] },
      "Pay anayasası, il rızası",
      "Pelin Yerel Pay özerkliği çözüm sayar. Cemil Vali hattı merkez temennisi yazar. Standart, illere yayılınca dağılır.",
      "A share constitution, provincial consent",
      "Pelin Local Share treats autonomy as a solution. Cemil Vali's line writes a centre wish. The standard scatters as it spreads to the provinces.",
      choice("devolve", "Payı ile yaz", "Write the share to the province", "Yerel rıza; standart kayar", { effects: { heat: -1 }, lock: "devolve", stageTo: 1, next: { eventId: "dc_pa_yerel2", dueTurns: 6, key: "pa-yerel2" }, echo: "Pay illere indi; cetvel aynı kalmadı." }),
      choice("wish", "Temenniyi esas tut", "Keep the wish as the base", "Merkez", { lock: "devolve", stageTo: 9 })),
    later("dc_pa_yerel2", { stage: 2, tags: ["alternatif", "memory", "region"] },
      "İl bilir, cetvel kayar",
      "Belediye kendi takvimini kurar. Maarif ve maliye aynı payı başka ölçüyle okur. Pelin 'rızadır' der. Nuri 'fatura ayrı' der.",
      "The province knows, the ruler slips",
      "The municipality builds its own calendar. Education and finance read the same share with another measure. Pelin says it is consent. Nuri says the bill is separate.",
      choice("rule", "Ortak cetvel iste", "Ask for a common ruler", "Standart", { effects: { info: 1 }, stageTo: 3, next: { eventId: "dc_pa_yerel3", dueTurns: 36, key: "pa-yerel3" } }),
      choice("scatter", "İlin ölçüsünü bırak", "Leave the province its measure", "Dağılım", { stageTo: 3 })),
    later("dc_pa_yerel3", { stage: 3, tags: ["alternatif", "long", "government"] },
      "Pay durur, devlet çoğul",
      "Özerklik alışkanlık olmuştur. Merkez homurtusu arşivdedir. Uygulama illere yayılmış, standart dağılmıştır.",
      "The share remains, the state is plural",
      "Autonomy has become a habit. The centre's mutter is in the archive. Implementation spread to the provinces; the standard scattered.",
      choice("keep", "Çoğul payı tut", "Keep the plural share", "Yerel form", { stageTo: 4 }),
      choice("recollect", "Cetveli merkeze çek", "Pull the ruler back to the centre", "Tempo", { stageTo: 4 })),
  ],
});
push({
  id: "pa-center", arc: "government", era: "alternatif", exclusive: "local-path", branch: "center", tags: ["alternatif", "government", "institution", "form", "cross"],
  nodes: [
    opening("dc_pa_center", { era: "alternatif", needInst: "mulkiye", tags: ["alternatif", "government", "institution"] },
      "Merkez temenni, il bekler",
      "Cemil Vali hattı temenniyi emir sanır. Pelin Yerel Pay 'il rızası yok' der. Dosya merkeze bakar, saha binayı arar.",
      "A centre wish, the province waits",
      "Cemil Vali's line mistakes a wish for an order. Pelin Local Share says there is no provincial consent. The file looks at the centre; the field looks for the building.",
      choice("center", "Temenniyi merkeze bağla", "Tie the wish to the centre", "Tempo; il soğur", { effects: { heat: 1 }, lock: "center", stageTo: 1, next: { eventId: "dc_pa_center2", dueTurns: 5, key: "pa-center2" }, echo: "Merkez bağlandı; il uygulama binasını aradı." }),
      choice("ask", "İl rızasını önce al", "Take provincial consent first", "Yavaş tempo", { lock: "center", stageTo: 9 })),
    later("dc_pa_center2", { stage: 2, tags: ["alternatif", "memory", "form"] },
      "Emir iner, bina yok",
      "Yüzde yazılmıştır. Üç il hangi koridorda başladığını sorar. Leyla Koordinasyon darboğaz notu düşer.",
      "The order descends, there is no building",
      "A percentage has been written. Three provinces ask which corridor they started in. Leyla Coordination drops a bottleneck note.",
      choice("coord", "Koordinasyonu öne al", "Bring coordination forward", "Kurum", { effects: { info: 1 }, stageTo: 3, next: { eventId: "dc_pa_center3", dueTurns: 24, key: "pa-center3" } }),
      choice("percent", "Yüzdeyi yeter say", "Count the percentage as enough", "Kağıt merkez", { stageTo: 3 })),
    later("dc_pa_center3", { stage: 3, tags: ["alternatif", "long", "form"] },
      "Merkez alışkanlık, il mesafe",
      "Temenni omurga olmuştur. İl, merkeze bakmayı beklemeyi öğrenmiştir. Devlet tek cümle, saha ayrı saat.",
      "The centre is a habit, the province is distance",
      "The wish has become a spine. The province has learned that looking at the centre is waiting. The state is one sentence; the field is another hour.",
      choice("keep", "Merkez omurgasını tut", "Keep the centre spine", "Form", { stageTo: 4 }),
      choice("share", "İle saat ver", "Give the province an hour", "Pay", { stageTo: 4 })),
  ],
});
push({
  id: "pa-plan", arc: "development", era: "alternatif", tags: ["alternatif", "development", "institution", "cross"],
  nodes: [
    opening("dc_pa_plan", { era: "alternatif", needInst: "maliye", tags: ["alternatif", "development", "fiscal"] },
      "Beş yıllık kâğıt, saha yıl",
      "Kemal Bey program tutsun ister. Melisa Öğretim tabela çoğalsın ister. Plan, iki temponun ortasında kalır.",
      "A five-year paper, a field year",
      "Kemal Bey wants the program to hold. Melisa Education wants signboards to multiply. The plan sits between two paces.",
      choice("plan", "Kâğıdı omurga yaz", "Write the paper as spine", "Tempo; saha iner", { effects: { info: 1 }, stageTo: 1, next: { eventId: "dc_pa_plan2", dueTurns: 7, key: "pa-plan2" }, echo: "Plan asıldı; saha kendi yılını yaşamaya devam etti." }),
      choice("year", "Saha yılını esas al", "Take the field year as the base", "Esneklik", { stageTo: 9 })),
    later("dc_pa_plan2", { stage: 2, tags: ["alternatif", "development", "memory"] },
      "Hedef şişer, derslik boş",
      "Kontenjan başarı yazılmıştır. Hoca yetişmez. Melisa 'erişim' der. Kemal 'satır' der.",
      "The target inflates, the classroom is empty",
      "Quota has been written as success. Teachers do not catch up. Melisa says access. Kemal says the line.",
      choice("cadre", "Hoca satırını plana bağla", "Tie the teacher line to the plan", "Kapasite", { stageTo: 3, next: { eventId: "dc_pa_plan3", dueTurns: 36, key: "pa-plan3" } }),
      choice("sign", "Tabelayı hedef say", "Count the signboard as the target", "Görünürlük", { stageTo: 3 })),
    later("dc_pa_plan3", { stage: 3, tags: ["alternatif", "long", "development"] },
      "Plan arşivi, saha nesli",
      "Beş yıl bitmiş, kâğıt durur. Saha kendi yılını öğretmiştir. Devlet planı omurga sandı; uygulama ayrı nesil oldu.",
      "A plan archive, a field generation",
      "Five years are over; the paper remains. The field has taught its own year. The state took the plan for a spine; implementation became another generation.",
      choice("renew", "Kâğıdı yenile", "Renew the paper", "Devam", { stageTo: 4 }),
      choice("close", "Planı tarih say", "Treat the plan as history", "Saha saati", { stageTo: 4 })),
  ],
});

push({
  id: "cr-inf-wage", arc: "inflation", tags: ["crisis", "inflation", "group", "labor"],
  nodes: [
    opening("dc_cr_inf_wage", { needCrisis: "inflation", needGroup: "labor", tags: ["crisis", "inflation", "group"] },
      "Ücret geride, kira önde",
      "İşçi 'etiket dün değişti' der. Turgut kadrosu hane şokunu istatistik sayar. İki ay, aynı bordro.",
      "Wages behind, rent ahead",
      "Labour says the tag changed yesterday. Turgut's cadre counts the household shock as a statistic. Two months, the same payroll.",
      choice("raise", "Ara zammı yaz", "Write an interim rise", "Rıza; bekleti", { effects: { heat: -2 }, stageTo: 1, next: { eventId: "dc_cr_inf_wage2", dueTurns: 4, key: "cr-inf-wage2" }, echo: "Ara zam düştü; etiket yine önde yürüdü." }),
      choice("wait", "Sözleşmeyi bekle", "Wait for the contract", "Kuyruk kızar", { effects: { heat: 2 }, stageTo: 9 })),
    later("dc_cr_inf_wage2", { stage: 2, tags: ["crisis", "inflation", "memory", "group"] },
      "Zam gelir, etiket kaçmış",
      "Bordro hareket etmiştir. Pazar bir ay ileridedir. İşçi 'sayı' değil 'torba' konuşur.",
      "The rise arrives, the tag has fled",
      "The payroll has moved. The market is a month ahead. Labour talks bags, not numbers.",
      choice("index", "Zammı etiketle bağla", "Tie the rise to the tag", "Endeks huyu", { stageTo: 3, next: { eventId: "dc_cr_inf_wage3", dueTurns: 24, key: "cr-inf-wage3" } }),
      choice("once", "Bir kerelik kapat", "Close it as one-off", "Tekrar kapısı", { stageTo: 3 })),
    later("dc_cr_inf_wage3", { stage: 3, tags: ["crisis", "inflation", "long", "group"] },
      "Ara zam refleks olur",
      "Enflasyon cümlesi durulmuş olsa da bordro her sonbahar ara bekler. Devlet, ücreti kriz kapısı sanır.",
      "The interim rise becomes a reflex",
      "Even if the inflation sentence has settled, payroll waits for an interim every autumn. The state treats wages as a crisis door.",
      choice("rule", "Bağı kural yaz", "Write the tie as a rule", "Kurumsal", { stageTo: 4 }),
      choice("close", "Kapıyı kapat", "Close the door", "Isı döner", { effects: { heat: 1 }, stageTo: 4 })),
  ],
});
push({
  id: "cr-inf-food", arc: "inflation", tags: ["crisis", "inflation", "group", "urban"],
  nodes: [
    opening("dc_cr_inf_food", { needCrisis: "inflation", needGroup: "urban", tags: ["crisis", "inflation", "group"] },
      "Pazar çantası, emekli kuyruğu",
      "Gıda satırı çekirdek sayılmaz. Emekli kuyrukta bekler. Süreyya hattı yapışkanlığı dipnota iter.",
      "A market bag, a pensioner queue",
      "The food line is not counted as core. The pensioner waits in the queue. Süreyya's line pushes stickiness into a footnote.",
      choice("food", "Gıdayı ayrı satır yaz", "Write food as its own line", "Hane nefes; çapa dağılır", { effects: { heat: -1, info: 1 }, stageTo: 1, next: { eventId: "dc_cr_inf_food2", dueTurns: 3, key: "cr-inf-food2" }, echo: "Gıda ayrı yazıldı; çekirdek cümle inceldi." }),
      choice("core", "Çekirdeği tek tut", "Keep core as one", "Kağıt sakin", { effects: { heat: 2 }, stageTo: 9 })),
    later("dc_cr_inf_food2", { stage: 2, tags: ["crisis", "inflation", "memory", "group"] },
      "Satır vardır, çanta ağır",
      "Ayrı hedef asılmıştır. Pazar yine kendi fiyatını söyler. Emekli 'rakam' değil 'öğlen' konuşur.",
      "There is a line, the bag is heavy",
      "A separate target has been hung. The market still names its own price. The pensioner talks noon, not the figure.",
      choice("support", "Kuyruğa pay yaz", "Write a share for the queue", "Mali yük", { effects: { heat: -1 }, stageTo: 3, next: { eventId: "dc_cr_inf_food3", dueTurns: 24, key: "cr-inf-food3" } }),
      choice("talk", "Cümleyi tekrarla", "Repeat the sentence", "Anlatı", { effects: { rumor: 1 }, stageTo: 3 })),
    later("dc_cr_inf_food3", { stage: 3, tags: ["crisis", "inflation", "long", "group"] },
      "Çanta hafızası uzun",
      "Gıda satırı arşivde. Hane hâlâ etiket okur. Çekirdek cümle inandırmaz; öğlen cümlesi durur.",
      "The bag's memory is long",
      "The food line is in the archive. The household still reads the tag. The core sentence does not persuade; the noon sentence remains.",
      choice("keep", "Gıda satırını tut", "Keep the food line", "Hane çapa", { stageTo: 4 }),
      choice("merge", "Satırı çekirdeğe kat", "Fold the line back into core", "Sadeleşme", { stageTo: 4 })),
  ],
});
push({
  id: "cr-rec-factory", arc: "recession", tags: ["crisis", "recession", "group", "labor"],
  nodes: [
    opening("dc_cr_rec_factory", { needCrisis: "recession", needGroup: "labor", tags: ["crisis", "recession", "group"] },
      "Vardiya iner, kapı bekler",
      "Fabrika ikinci vardiyayı kapatır. İşçi kapıda 'geçici' dinler. İş dünyası 'sipariş' der; sipariş yok.",
      "A shift drops, the gate waits",
      "The factory closes the second shift. Labour at the gate hears 'temporary.' Business says orders; there are no orders.",
      choice("shift", "Kısa mesaiyi öne al", "Bring short-time work forward", "Rıza; ciro iner", { effects: { heat: -1 }, stageTo: 1, next: { eventId: "dc_cr_rec_factory2", dueTurns: 5, key: "cr-rec-factory2" }, echo: "Vardiya kısaldı; kapı cümlesi 'geçici'de kaldı." }),
      choice("close", "Kapıyı geçici say", "Treat the gate as temporary", "Isı", { effects: { heat: 2 }, stageTo: 9 })),
    later("dc_cr_rec_factory2", { stage: 2, tags: ["crisis", "recession", "memory", "group"] },
      "Geçici uzar, kıdem konuşulur",
      "Kısa mesai üç ayı geçmiştir. Sendika kıdem cümlesi kurar. İşveren 'sipariş gelince' der.",
      "Temporary lengthens, seniority is spoken",
      "Short-time has passed three months. The union builds a seniority sentence. The employer says when orders come.",
      choice("hold", "Kısa mesaiyi uzat", "Extend short-time", "Kapasite uykusu", { stageTo: 3, next: { eventId: "dc_cr_rec_factory3", dueTurns: 36, key: "cr-rec-factory3" } }),
      choice("sever", "Kıdem kapısını aç", "Open the seniority door", "Kopuş", { effects: { heat: 3 }, stageTo: 3 })),
    later("dc_cr_rec_factory3", { stage: 3, tags: ["crisis", "recession", "long", "group"] },
      "Tezgâh durur, mahalle unutmaz",
      "Vardiya bir kısmı dönmüştür. Kapı hafızası durur. Recesyon bitmiş, 'geçici' cümlesi mahallede kalmıştır.",
      "The bench stands, the neighbourhood does not forget",
      "Part of the shift has returned. Gate memory remains. The recession has ended; the 'temporary' sentence has stayed in the neighbourhood.",
      choice("recall", "Kadro cümlesini yenile", "Renew the post sentence", "Güven onarımı", { stageTo: 4 }),
      choice("leave", "Geçiciyi tarih say", "Treat temporary as history", "Unutuş yok", { stageTo: 4 })),
  ],
});
push({
  id: "cr-rec-credit", arc: "recession", tags: ["crisis", "recession", "group", "business"],
  nodes: [
    opening("dc_cr_rec_credit", { needCrisis: "recession", needGroup: "business", tags: ["crisis", "recession", "group"] },
      "Teminat istenir, ciro yok",
      "Gişe teminat ister. Esnaf cirosunu geçen yılın defterinden okur. Hasan Bey olsa vade gizlerdi; Nuri fatura der.",
      "Collateral is asked, there is no turnover",
      "The window wants collateral. The shopkeeper reads turnover from last year's ledger. Hasan Bey would have hidden the term; Nuri says bill.",
      choice("ease", "Teminatı gevşet", "Loosen collateral", "Kredi; kırılganlık", { effects: { heat: -1 }, stageTo: 1, next: { eventId: "dc_cr_rec_credit2", dueTurns: 4, key: "cr-rec-credit2" }, echo: "Teminat inceldi; ciro cümlesi hâlâ geçen yıl." }),
      choice("strict", "Teminatı tut", "Hold collateral", "Dükkân kapanır", { effects: { heat: 2 }, stageTo: 9 })),
    later("dc_cr_rec_credit2", { stage: 2, tags: ["crisis", "recession", "memory", "group"] },
      "Kredi akar, tahsilat durur",
      "Limit açılmıştır. Geri ödeme takvimi pazar gününe denk gelir. İş dünyası güler görünür, kasa asık.",
      "Credit flows, collection stops",
      "A limit has been opened. The repayment calendar lands on market day. Business looks like a smile; the till does not.",
      choice("roll", "Takvimi kaydır", "Slide the calendar", "Rollover", { stageTo: 3, next: { eventId: "dc_cr_rec_credit3", dueTurns: 24, key: "cr-rec-credit3" } }),
      choice("collect", "Tahsilatı işle", "Run collection", "Kopuş", { effects: { heat: 2 }, stageTo: 3 })),
    later("dc_cr_rec_credit3", { stage: 3, tags: ["crisis", "recession", "long", "group"] },
      "Limit alışkanlık, teminat korku",
      "Recesyon cümlesi kapanmış. Esnaf hâlâ teminat sorar. Kredi kapısı kriz kapısı olarak kalır.",
      "The limit is a habit, collateral is fear",
      "The recession sentence has closed. The shopkeeper still asks about collateral. The credit door remains a crisis door.",
      choice("norm", "Kapıyı olağan yaz", "Write the door as ordinary", "Piyasa", { stageTo: 4 }),
      choice("guard", "Teminatı omurga tut", "Keep collateral as spine", "İhtiyat", { stageTo: 4 })),
  ],
});
push({
  id: "cr-rec-youth", arc: "recession", tags: ["crisis", "recession", "group"],
  nodes: [
    opening("dc_cr_rec_youth", { needCrisis: "recession", needGroup: "youth", tags: ["crisis", "recession", "group"] },
      "İlan durur, diploma bekler",
      "Melisa Öğretim kontenjanı başarı yazar. İlan panosu boştur. Genç 'kadro' der; kadro yaşlı vardiyayı tutar.",
      "Listings stop, the diploma waits",
      "Melisa Education writes quota as success. The notice board is empty. Youth says a post; the post holds the older shift.",
      choice("open", "Geçici kadro aç", "Open a temporary post", "Rıza; bütçe", { effects: { heat: -1 }, stageTo: 1, next: { eventId: "dc_cr_rec_youth2", dueTurns: 6, key: "cr-rec-youth2" }, echo: "Geçici kadro yazıldı; ilan hâlâ kısa." }),
      choice("school", "Okulu uzat, ilanı bekle", "Extend school, wait on listings", "Erteleme", { stageTo: 9 })),
    later("dc_cr_rec_youth2", { stage: 2, tags: ["crisis", "recession", "memory", "group"] },
      "Geçici biter, kapı aynı",
      "Süre dolmuştur. Asıl kadro açılmamıştır. Genç 'tekrar' der. Melisa 'erişim oldu' der.",
      "Temporary ends, the door is the same",
      "The term has run out. A standing post has not opened. Youth says again. Melisa says there was access.",
      choice("convert", "Geçiciyi asıl yaz", "Write temporary as standing", "Mali omurga", { stageTo: 3, next: { eventId: "dc_cr_rec_youth3", dueTurns: 36, key: "cr-rec-youth3" } }),
      choice("end", "Süreyi kapat", "Close the term", "Kopuş", { effects: { heat: 2 }, stageTo: 3 })),
    later("dc_cr_rec_youth3", { stage: 3, tags: ["crisis", "recession", "long", "group"] },
      "Kuşak gecikir, kontenjan durur",
      "Recesyon bitmiş, ilk iş cümlesi gecikmiştir. Diploma arşivi, ilan arşivinden uzundur.",
      "A cohort is late, quota remains",
      "The recession has ended; the first-job sentence is late. The diploma archive is longer than the listings archive.",
      choice("path", "İlk iş satırını tut", "Keep the first-job line", "Uzun politika", { stageTo: 4 }),
      choice("forget", "Kuşağı piyasa say", "Leave the cohort to the market", "Unutuş", { stageTo: 4 })),
  ],
});
push({
  id: "cr-fin-bank", arc: "financial", tags: ["crisis", "financial", "institution", "fiscal"],
  nodes: [
    opening("dc_cr_fin_bank", { needCrisis: "financial", needInst: "maliye", tags: ["crisis", "financial", "institution"] },
      "Likidite cümlesi, gişe kuyruğu",
      "Kemal Bey program cümlesi ister. Gişe önünde başka cümle kurulur. İki kuyruk aynı mevduatı tarif etmez.",
      "A liquidity sentence, a teller queue",
      "Kemal Bey wants a program sentence. Another sentence is built in front of the teller. Two queues do not describe the same deposit.",
      choice("back", "Gişeye çapa yaz", "Write an anchor at the teller", "Güven; kasa", { effects: { heat: -2, rumor: -1 }, stageTo: 1, next: { eventId: "dc_cr_fin_bank2", dueTurns: 3, key: "cr-fin-bank2" }, echo: "Çapa gişede duyuldu; kuyruk bir gece kısaldı." }),
      choice("quiet", "Cümleyi içeride tut", "Keep the sentence inside", "Söylenti", { effects: { rumor: 2 }, stageTo: 9 })),
    later("dc_cr_fin_bank2", { stage: 2, tags: ["crisis", "financial", "memory"] },
      "Çapa durur, bilanço ayrı",
      "Gişe sakin görünür. Defter başka satırda şişer. Nuri 'fatura değil, pay' der. Pay, kimin olduğu belirsizdir.",
      "The anchor holds, the balance sheet is apart",
      "The teller looks calm. The ledger inflates on another line. Nuri says it is not a bill, it is a share. Whose share is unclear.",
      choice("book", "Satırı açık yaz", "Write the line in the open", "Info", { effects: { info: 1 }, stageTo: 3, next: { eventId: "dc_cr_fin_bank3", dueTurns: 24, key: "cr-fin-bank3" } }),
      choice("fold", "Payı dipnota koy", "Put the share in a footnote", "Sis", { effects: { info: -1 }, stageTo: 3 })),
    later("dc_cr_fin_bank3", { stage: 3, tags: ["crisis", "financial", "long"] },
      "Gişe unutur, defter unutmaz",
      "Kuyruk dağılmıştır. Çapa cümlesi arşivde. Her yeni homurtuda gişe aynı geceyi hatırlar.",
      "The teller forgets, the ledger does not",
      "The queue has scattered. The anchor sentence is in the archive. At every new mutter the teller remembers the same night.",
      choice("keep", "Çapayı refleks tut", "Keep the anchor as reflex", "Kurum", { stageTo: 4 }),
      choice("normal", "Geceyi kapat", "Close the night", "Unutuş denemesi", { stageTo: 4 })),
  ],
});
push({
  id: "cr-fin-fx", arc: "financial", tags: ["crisis", "financial", "institution"],
  nodes: [
    opening("dc_cr_fin_fx", { needCrisis: "financial", needInst: "merkez", tags: ["crisis", "financial", "institution"] },
      "Kur şeridi, ihtiyat notu",
      "Süreyya hattı örtük hedefi kapıda tutar. Orkun Emisyon erken kesim ister. Şerit, ikisini de dinlemez.",
      "An exchange ribbon, a reserve note",
      "Süreyya's line keeps the implicit target at the door. Orkun Emission wants an early cut. The ribbon listens to neither.",
      choice("note", "İhtiyat notunu işle", "Run the reserve note", "Çapa; rıza kayar", { effects: { heat: 1 }, stageTo: 1, next: { eventId: "dc_cr_fin_fx2", dueTurns: 4, key: "cr-fin-fx2" }, echo: "İhtiyat konuştu; şerit bir gün durdu, cümle durmadı." }),
      choice("word", "Sadece sözle tut", "Hold it with words only", "Beklenti incelir", { effects: { rumor: 2 }, stageTo: 9 })),
    later("dc_cr_fin_fx2", { stage: 2, tags: ["crisis", "financial", "memory"] },
      "Not işler, şerit döner",
      "İhtiyat satırı hareket etmiştir. Kur homurtusu öğleden sonra geri gelir. İki saat, iki rejim.",
      "The note works, the ribbon returns",
      "The reserve line has moved. The exchange mutter comes back in the afternoon. Two hours, two regimes.",
      choice("repeat", "Notu tekrar yaz", "Write the note again", "Tükeniş", { stageTo: 3, next: { eventId: "dc_cr_fin_fx3", dueTurns: 36, key: "cr-fin-fx3" } }),
      choice("live", "Şeridi fiyat say", "Treat the ribbon as the price", "Geçiş", { effects: { heat: 2 }, stageTo: 3 })),
    later("dc_cr_fin_fx3", { stage: 3, tags: ["crisis", "financial", "long"] },
      "Şerit alışkanlık, not korku",
      "Kur cümlesi sakinleşmiş görünür. Her kıpırdanışta ihtiyat notu hatırlanır. Çapa, korku ile karışır.",
      "The ribbon is a habit, the note is fear",
      "The exchange sentence looks settled. At every stir the reserve note is remembered. The anchor mixes with fear.",
      choice("separate", "Notu istisna yaz", "Write the note as exception", "Kural", { stageTo: 4 }),
      choice("tool", "Notu alet say", "Treat the note as a tool", "Refleks", { stageTo: 4 })),
  ],
});
push({
  id: "cr-fin-debt", arc: "financial", tags: ["crisis", "financial", "fiscal", "institution"],
  nodes: [
    opening("dc_cr_fin_debt", { needCrisis: "financial", needInst: "maliye", tags: ["crisis", "financial", "fiscal"] },
      "Vade duvarı, çevirme cümlesi",
      "Nuri Hazine vade duvarını 'takvim' yazar. Kemal Bey faiz dışı fazlayı gösterir. Duvar, ikisini de beklemez.",
      "A maturity wall, a rollover sentence",
      "Nuri Treasury writes the maturity wall as a calendar. Kemal Bey shows the primary surplus. The wall waits for neither.",
      choice("roll", "Çevirmeyi öne al", "Bring the rollover forward", "Nefes; maliyet", { effects: { heat: 1 }, stageTo: 1, next: { eventId: "dc_cr_fin_debt2", dueTurns: 5, key: "cr-fin-debt2" }, echo: "Vade kaydı; maliyet cümlesi uzadı." }),
      choice("pay", "Duvarı ödemeyle karşıla", "Meet the wall with payment", "Kasa iner", { stageTo: 9 })),
    later("dc_cr_fin_debt2", { stage: 2, tags: ["crisis", "financial", "memory", "fiscal"] },
      "Nefes vardır, faiz konuşur",
      "Çevirme olmuştur. Yeni vade eski duvardan kalındır. Piyasa 'fazla' değil 'yay' sorar.",
      "There is breath, interest speaks",
      "The rollover has happened. The new term is thicker than the old wall. The market asks about spread, not surplus.",
      choice("long", "Vadeyi uzat", "Lengthen the term", "Maliyet", { stageTo: 3, next: { eventId: "dc_cr_fin_debt3", dueTurns: 36, key: "cr-fin-debt3" } }),
      choice("short", "Kısa vadede kal", "Stay short", "Tekrar duvarı", { stageTo: 3 })),
    later("dc_cr_fin_debt3", { stage: 3, tags: ["crisis", "financial", "long", "fiscal"] },
      "Duvar unutulur, yay kalır",
      "Kriz kapanmış görünür. Çevirme cümlesi her sonbaharda kurulur. Devlet, nefes almayı politika sanır.",
      "The wall is forgotten, the spread remains",
      "The crisis looks closed. A rollover sentence is built every autumn. The state mistakes breathing for policy.",
      choice("rule", "Vade cetvelini as", "Hang a term table", "Şeffaflık", { effects: { info: 1 }, stageTo: 4 }),
      choice("habit", "Çevirmeyi refleks tut", "Keep rollover as reflex", "Politika borcu", { stageTo: 4 })),
  ],
});
push({
  id: "cr-mig-urban", arc: "migration", tags: ["crisis", "migration", "group", "region"],
  nodes: [
    opening("dc_cr_mig_urban", { needCrisis: "migration", needGroup: "urban", needRegion: "marmara", tags: ["crisis", "migration", "region", "group"] },
      "İlçe şişer, hat aynı",
      "Marmara ilçesi nüfusu bir kışta dolmuştur. Cemil Vali tempo yazar. Otobüs aynı güzergâhı iki kez döner, yetmez.",
      "The district swells, the line is the same",
      "A Marmara district has filled in one winter. Cemil Vali writes pace. The bus runs the same route twice; it is not enough.",
      choice("line", "Hattı ikiye katla", "Double the line", "Kapasite; bütçe", { effects: { heat: -1 }, stageTo: 1, next: { eventId: "dc_cr_mig_urban2", dueTurns: 5, key: "cr-mig-urban2" }, echo: "Hat çoğaldı; durak aynı kaldı, mahalle değil." }),
      choice("wait", "Geçici say, hat tut", "Call it temporary, hold the line", "Yığılma", { effects: { heat: 2 }, stageTo: 9 })),
    later("dc_cr_mig_urban2", { stage: 2, tags: ["crisis", "migration", "memory", "region"] },
      "Hat çoğalır, kira konuşulur",
      "Servis artmıştır. Ev sahibi yeni rakam yapıştırır. Selim İmar 'arz' der; arz başka ilçededir.",
      "The line multiplies, rent is spoken",
      "Service has increased. The landlord sticks a new figure. Selim Zoning says supply; supply is in another district.",
      choice("rent", "Kira ile hattı birlikte tut", "Hold rent and the line together", "Çapraz", { stageTo: 3, next: { eventId: "dc_cr_mig_urban3", dueTurns: 24, key: "cr-mig-urban3" } }),
      choice("bus", "Sadece seferi koru", "Only keep the service", "Yarım nefes", { stageTo: 3 })),
    later("dc_cr_mig_urban3", { stage: 3, tags: ["crisis", "migration", "long", "region"] },
      "Şişme mahalle olur",
      "Kriz cümlesi kapanır. İlçe kendi nüfusunu normal sayar. Hat kalıcı, kadro hâlâ geçici yazılır.",
      "The swell becomes a neighbourhood",
      "The crisis sentence closes. The district counts its population as normal. The line is permanent; the staff is still written as temporary.",
      choice("staff", "Kadroyu kalıcı yaz", "Write the staff as permanent", "Kurum", { stageTo: 4 }),
      choice("temp", "Geçiciyi sürdür", "Keep it temporary", "Yorgunluk", { stageTo: 4 })),
  ],
});
push({
  id: "cr-mig-east", arc: "migration", tags: ["crisis", "migration", "region", "institution"],
  nodes: [
    opening("dc_cr_mig_east", { needCrisis: "migration", needRegion: "dogu", tags: ["crisis", "migration", "region"] },
      "Doğu defteri, hizmet boş",
      "Cevat olsa telgraf geciktirirdi. Cemil Vali yüzde yazar. Doğu kazası öğretmeni, hekimi, kâtibi aynı hafta kaybetmiş görünür.",
      "An eastern ledger, empty service",
      "Cevat would have delayed the telegram. Cemil Vali writes a percentage. An eastern district looks to have lost teacher, doctor, clerk in the same week.",
      choice("hold", "Kadroya tutma payı yaz", "Write a retention share for the post", "Kapasite", { effects: { heat: -1 }, stageTo: 1, next: { eventId: "dc_cr_mig_east2", dueTurns: 6, key: "cr-mig-east2" }, echo: "Pay yazıldı; kâğıt durdu, isim yine yola çıktı." }),
      choice("report", "Yüzdeyi merkeze bildir", "Report the percentage to the centre", "Kağıt", { effects: { info: 1 }, stageTo: 9 })),
    later("dc_cr_mig_east2", { stage: 2, tags: ["crisis", "migration", "memory", "region"] },
      "Pay durur, isim yolda",
      "Tutma cümlesi vardır. Öğretmen ailesi başka ilde kira bakmaktadır. Melisa 'erişim' der; sıra boştur.",
      "The share holds, the name is on the road",
      "There is a retention sentence. The teacher's family is looking at rent in another province. Melisa says access; the bench is empty.",
      choice("family", "Aile payını ekle", "Add a family share", "Yük", { stageTo: 3, next: { eventId: "dc_cr_mig_east3", dueTurns: 36, key: "cr-mig-east3" } }),
      choice("rotate", "Rotasyonu hızlandır", "Speed the rotation", "Süreklilik yok", { effects: { rumor: 1 }, stageTo: 3 })),
    later("dc_cr_mig_east3", { stage: 3, tags: ["crisis", "migration", "long", "region"] },
      "Boşluk alışkanlık olur",
      "Göç cümlesi durulur. Kaza, hizmeti mevsimlik saymayı öğrenir. Devlet, defteri dolu yazar.",
      "Emptiness becomes a habit",
      "The migration sentence settles. The district learns to count service as seasonal. The state writes the ledger full.",
      choice("fill", "Kadroyu çift yaz", "Write the post twice", "Kapasite iddiası", { stageTo: 4 }),
      choice("season", "Mevsimliği kabul et", "Accept the seasonal", "Yerel gerçek", { stageTo: 4 })),
  ],
});
push({
  id: "cr-mig-return", arc: "migration", tags: ["crisis", "migration", "group", "region"],
  nodes: [
    opening("dc_cr_mig_return", { needCrisis: "migration", needGroup: "rural", tags: ["crisis", "migration", "group", "region"] },
      "Köy dönüşü, tarla boş",
      "Kent kapısı daralınca köy yolu dolmuştur. Tarla, döneni beklememiştir. Hasan Bey olsa kredi vaat ederdi; kredi tarlayı sürmez.",
      "A village return, an empty field",
      "When the city gate narrowed the village road filled. The field did not wait for the returner. Hasan Bey would have promised credit; credit does not plough the field.",
      choice("seed", "Dönüş payını tarlaya yaz", "Write a return share to the field", "Rıza; vade", { effects: { heat: -1 }, stageTo: 1, next: { eventId: "dc_cr_mig_return2", dueTurns: 7, key: "cr-mig-return2" }, echo: "Pay tarlaya yazıldı; harman yine kent takviminde." }),
      choice("city", "Kente dönüşü açık tut", "Keep the road back to the city open", "Geçiş", { stageTo: 9 })),
    later("dc_cr_mig_return2", { stage: 2, tags: ["crisis", "migration", "memory", "group"] },
      "Pay gelir, harman kentte",
      "Tohum vardır. Pazar köyde değildir. Dönen, ürünü yine kente taşır; kira orada bekler.",
      "The share arrives, threshing is in the city",
      "There is seed. The market is not in the village. The returner still carries the crop to the city; rent waits there.",
      choice("market", "Köy pazarını tut", "Hold a village market", "Yerel çapa", { stageTo: 3, next: { eventId: "dc_cr_mig_return3", dueTurns: 24, key: "cr-mig-return3" } }),
      choice("carry", "Kente taşımayı bırak", "Leave the carrying to the city", "Çift hayat", { stageTo: 3 })),
    later("dc_cr_mig_return3", { stage: 3, tags: ["crisis", "migration", "long", "group"] },
      "Dönüş mevsimlik kalır",
      "Köy nüfusu kâğıtta durur. Kış kente, yaz tarlaya. Göç bitmemiş, takvim ikiye bölünmüştür.",
      "Return stays seasonal",
      "Village population sits on paper. Winter to the city, summer to the field. Migration has not ended; the calendar has split in two.",
      choice("split", "Çift takvimi yaz", "Write the split calendar", "Dürüst defter", { effects: { info: 1 }, stageTo: 4 }),
      choice("one", "Köyü tek adres say", "Count the village as one address", "Kağıt iskân", { stageTo: 4 })),
  ],
});
push({
  id: "cr-ins-fatigue", arc: "institutional", tags: ["crisis", "institutional", "institution", "cadre"],
  nodes: [
    opening("dc_cr_ins_fatigue", { needCrisis: "institutional", needInst: "mulkiye", tags: ["crisis", "institutional", "institution"] },
      "İmza yığılır, kalem incelir",
      "Cemil Vali hattı tempo ister. Kalem yorgundur. Profesyonellik bir kalkan, yorgunluk da bir kalkan; ikisi aynı koridorda.",
      "Signatures stack, the pen thins",
      "Cemil Vali's line wants pace. The pen is tired. Professionalism is a shield, fatigue is a shield; both are in the same corridor.",
      choice("pause", "Tempoyu düşür, imzayı ayıkla", "Drop the pace, sort the signatures", "Nefes; görünürlük iner", { effects: { heat: -1, info: 1 }, stageTo: 1, next: { eventId: "dc_cr_ins_fatigue2", dueTurns: 5, key: "cr-ins-fatigue2" }, echo: "Tempo düştü; yığın aynı odada kaldı." }),
      choice("push", "Tempoyu koru", "Keep the pace", "Yorgunluk şişer", { effects: { heat: 1 }, stageTo: 9 })),
    later("dc_cr_ins_fatigue2", { stage: 2, tags: ["crisis", "institutional", "memory", "cadre"] },
      "Ayıklama var, dosya hayalet",
      "İmza sırası kısalmış görünür. Üç dosya sahipsizdir. Leyla Koordinasyon 'kanal tıkalı' yazar.",
      "There is sorting, the file is a ghost",
      "The signature queue looks shorter. Three files have no owner. Leyla Coordination writes that the channel is clogged.",
      choice("own", "Sahipsiz dosyaya sahip yaz", "Write an owner on the ownerless file", "Yük kayar", { stageTo: 3, next: { eventId: "dc_cr_ins_fatigue3", dueTurns: 24, key: "cr-ins-fatigue3" } }),
      choice("close", "Hayaleti kapat", "Close the ghost", "Unutuş", { effects: { info: -1 }, stageTo: 3 })),
    later("dc_cr_ins_fatigue3", { stage: 3, tags: ["crisis", "institutional", "long"] },
      "Yorgunluk omurga olur",
      "Kriz kapanmış görünür. Kalem hâlâ yavaş imza atar. Devlet, yorgunluğu temkin sanır.",
      "Fatigue becomes a spine",
      "The crisis looks closed. The pen still signs slowly. The state mistakes fatigue for prudence.",
      choice("rest", "Nöbet cetveli yaz", "Write a duty roster", "Kapasite", { stageTo: 4 }),
      choice("virtue", "Yavaşlığı erdem say", "Count slowness as virtue", "Form", { stageTo: 4 })),
  ],
});
push({
  id: "cr-ins-align", arc: "institutional", tags: ["crisis", "institutional", "cadre", "form", "intelligence"],
  nodes: [
    opening("dc_cr_ins_align", { needCrisis: "institutional", tags: ["crisis", "institutional", "cadre", "form"] },
      "Aynı cümle, ayrı saat",
      "Kurumlar aynı cümleyi ezberler. Leyla Koordinasyon sentez ister; her masa kendi saatini gösterir. Hizalama, tempo sanılır.",
      "The same sentence, a different hour",
      "Institutions memorise the same sentence. Leyla Coordination wants a synthesis; each desk shows its own hour. Alignment is mistaken for pace.",
      choice("synth", "Sentez notunu işle", "Run the synthesis note", "Info; özerklik incelir", { effects: { info: 1 }, stageTo: 1, next: { eventId: "dc_cr_ins_align2", dueTurns: 4, key: "cr-ins-align2" }, echo: "Sentez yazıldı; masalar aynı cümleyi ayrı saatte okudu." }),
      choice("clock", "Her saati bırak", "Leave each hour", "Dağınıklık", { effects: { rumor: 1 }, stageTo: 9 })),
    later("dc_cr_ins_align2", { stage: 2, tags: ["crisis", "institutional", "memory", "intelligence"] },
      "Sentez var, kanal dar",
      "Tek cümle üretilmiştir. Kanal tıkanınca sessizlik de bilgi sayılır. Leyla 'belirsizliği abartmayın' der; belirsizlik zaten yeter.",
      "There is a synthesis, the channel is narrow",
      "A single sentence has been produced. When the channel clogs, silence is also counted as information. Leyla says do not exaggerate uncertainty; uncertainty is already enough.",
      choice("open", "Kanalı genişlet", "Widen the channel", "Özerklik", { effects: { info: 1 }, stageTo: 3, next: { eventId: "dc_cr_ins_align3", dueTurns: 36, key: "cr-ins-align3" } }),
      choice("one", "Tek cümleyi zorunlu tut", "Keep the single sentence mandatory", "Mandat", { stageTo: 3 })),
    later("dc_cr_ins_align3", { stage: 3, tags: ["crisis", "institutional", "long", "form"] },
      "Ezber kalır, sentez unutulur",
      "Hizalama cümlesi arşivde. Her kurum yine kendi saatini kurar. Kriz, ortak dili öğretmemiş, ortak susmayı öğretmiştir.",
      "The recitation remains, the synthesis is forgotten",
      "The alignment sentence is in the archive. Each institution sets its own hour again. The crisis did not teach a common language; it taught a common silence.",
      choice("lang", "Ortak dili yenile", "Renew the common language", "Koordinasyon", { stageTo: 4 }),
      choice("silence", "Susmayı kural say", "Treat silence as a rule", "Form", { stageTo: 4 })),
  ],
});
push({
  id: "cr-ins-yargi", arc: "institutional", tags: ["crisis", "institutional", "institution"],
  nodes: [
    opening("dc_cr_ins_yargi", { needCrisis: "institutional", needInst: "yargi", tags: ["crisis", "institutional", "institution"] },
      "Paket çıkar, duruşma kalır",
      "Ayşe Hanım kurul mevzuat hızı ister. Duruşma yavaşlığı dipnottadır. Paket, koridoru doldurur; salon boşalmaz.",
      "The package is out, the hearing remains",
      "Ayşe Hanım's board wants statute speed. Hearing slowness is in the footnote. The package fills the corridor; the hall does not empty.",
      choice("hall", "Duruşma payını öne al", "Bring the hearing share forward", "Tempo gerçek", { effects: { heat: 1 }, stageTo: 1, next: { eventId: "dc_cr_ins_yargi2", dueTurns: 6, key: "cr-ins-yargi2" }, echo: "Pay salona yazıldı; paket hâlâ koridorda." }),
      choice("pack", "Paketi başarı say", "Count the package as success", "Kağıt hız", { stageTo: 9 })),
    later("dc_cr_ins_yargi2", { stage: 2, tags: ["crisis", "institutional", "memory"] },
      "Salon dolar, kalem yetişmez",
      "Duruşma sayısı artmıştır. Gerekçe kısa düşer. Ayşe 'uyum' der. Kalem 'gerekçe' der.",
      "The hall fills, the clerk does not catch up",
      "The number of hearings has risen. Reasons come out short. Ayşe says alignment. The clerk says reasons.",
      choice("reason", "Gerekçe süresini koru", "Protect time for reasons", "Kalite", { effects: { info: 1 }, stageTo: 3, next: { eventId: "dc_cr_ins_yargi3", dueTurns: 36, key: "cr-ins-yargi3" } }),
      choice("count", "Sayıyı tut", "Hold the number", "Hız iddiası", { stageTo: 3 })),
    later("dc_cr_ins_yargi3", { stage: 3, tags: ["crisis", "institutional", "long"] },
      "Hız alışkanlık, gerekçe dipnot",
      "Kriz bitmiş, paket refleksi kalmıştır. Salon, sayıyı omurga sanır. Hukuk, dipnotta yaşar.",
      "Speed is a habit, reasons are a footnote",
      "The crisis has ended; the package reflex remains. The hall takes the number for a spine. Law lives in the footnote.",
      choice("restore", "Gerekçeyi satıra al", "Put reasons back on the line", "Kurum", { stageTo: 4 }),
      choice("keep", "Sayı omurgasını tut", "Keep the number spine", "Form", { stageTo: 4 })),
  ],
});
push({
  id: "cr-tru-stat", arc: "trust", tags: ["crisis", "trust", "media", "fiscal", "institution"],
  nodes: [
    opening("dc_cr_tru_stat", { needCrisis: "trust", needInst: "maliye", tags: ["crisis", "trust", "media", "fiscal"] },
      "Açıklanan sayı, hissedilen ay",
      "Resmî sayı çıkar. Pazar başka ay yaşar. Nuri Hazine sayıyı maliyet sayar; maliyet, inancı yemiştir.",
      "The published number, the felt month",
      "The official number is out. The market is living another month. Nuri Treasury treats the number as cost; cost has eaten belief.",
      choice("method", "Yöntemi açık yaz", "Write the method in the open", "Info; tartışma", { effects: { info: 2, rumor: -1 }, stageTo: 1, next: { eventId: "dc_cr_tru_stat2", dueTurns: 4, key: "cr-tru-stat2" }, echo: "Yöntem açıldı; sayı hâlâ başka ayı tarif etti." }),
      choice("defend", "Sayıyı tek cümle tut", "Keep the number as one sentence", "Savunma", { effects: { rumor: 2 }, stageTo: 9 })),
    later("dc_cr_tru_stat2", { stage: 2, tags: ["crisis", "trust", "memory", "media"] },
      "Yöntem durur, kulak kaymış",
      "Açıklama uzundur. Kahve kendi endeksini okur. İki yöntem, tek güven bırakmaz.",
      "The method holds, the ear has slipped",
      "The release is long. The coffeehouse reads its own index. Two methods do not leave one trust.",
      choice("series", "Seriyi bozmadan tut", "Hold the series unbroken", "Kurum", { stageTo: 3, next: { eventId: "dc_cr_tru_stat3", dueTurns: 24, key: "cr-tru-stat3" } }),
      choice("reset", "Seriyi yeni başlat", "Start the series new", "Kopuş", { effects: { rumor: 1 }, stageTo: 3 })),
    later("dc_cr_tru_stat3", { stage: 3, tags: ["crisis", "trust", "long", "media"] },
      "Sayı duyulur, inanılmaz",
      "Yöntem arşivde. Hane etiket okur. İstatistik özerkliği, bir kez maliyet sayılınca geri gelmesi uzun sürer.",
      "The number is heard, not believed",
      "The method is in the archive. The household reads the tag. Once statistical autonomy is counted as cost, its return is long.",
      choice("autonomy", "Saati kuruma geri ver", "Give the hour back to the institution", "Onarım", { effects: { info: 1 }, stageTo: 4 }),
      choice("cost", "Maliyet kuralını bırak", "Leave the cost rule", "Güven incelir", { stageTo: 4 })),
  ],
});
push({
  id: "cr-tru-procure", arc: "trust", tags: ["crisis", "trust", "network", "institution"],
  nodes: [
    opening("dc_cr_tru_procure", { needCrisis: "trust", tags: ["crisis", "trust", "network"] },
      "Şartname sonra, halka önce",
      "Yüklenici halkası şartnameden önce konuşur. Selim İmar keşfi şişirir. Resmî yetki yazılıdır; erişim yazılı değildir.",
      "The specification later, the ring first",
      "The contractor ring speaks before the specification. Selim Zoning inflates the survey. Official authority is written; access is not.",
      choice("spec", "Şartnameyi önce as", "Hang the specification first", "Açık ihale; tempo iner", { effects: { info: 2, rumor: -1 }, stageTo: 1, next: { eventId: "dc_cr_tru_procure2", dueTurns: 5, key: "cr-tru-procure2" }, echo: "Şartname asıldı; halka koridorda bekledi." }),
      choice("pace", "Temoyu bozma", "Do not break the pace", "Ağ durur", { effects: { rumor: 2 }, stageTo: 9 })),
    later("dc_cr_tru_procure2", { stage: 2, tags: ["crisis", "trust", "memory", "network"] },
      "Ası vardır, teklif dar",
      "Kâğıt açık durur. Teklif yine aynı halkadan gelir. Açıklık, katılım sanılmış; katılım gelmemiştir.",
      "There is a hanging, the bid is narrow",
      "The paper hangs in the open. The bid still comes from the same ring. Openness was mistaken for participation; participation did not come.",
      choice("widen", "Süreyi uzat, kapıyı aç", "Extend the term, open the door", "Yavaş iş", { stageTo: 3, next: { eventId: "dc_cr_tru_procure3", dueTurns: 36, key: "cr-tru-procure3" } }),
      choice("award", "Teklifi işle", "Process the bid", "Aynı halka", { stageTo: 3 })),
    later("dc_cr_tru_procure3", { stage: 3, tags: ["crisis", "trust", "long", "network"] },
      "Açıklık tabela, halka hafıza",
      "Şartname alışkanlığı durur. Erişim hâlâ yazılı yetkinin yanında yürür. Güven, kâğıttan değil kapıdan okunur.",
      "Openness is a signboard, the ring is memory",
      "The specification habit remains. Access still walks beside written authority. Trust is read from the door, not from the paper.",
      choice("door", "Kapı kaydını tut", "Keep a door log", "Şeffaflık", { effects: { info: 1 }, stageTo: 4 }),
      choice("sign", "Tabelayı yeter say", "Count the signboard as enough", "Görünürlük", { stageTo: 4 })),
  ],
});
push({
  id: "cr-tru-media", arc: "trust", tags: ["crisis", "trust", "media", "group"],
  nodes: [
    opening("dc_cr_tru_media", { needCrisis: "trust", needGroup: "media", tags: ["crisis", "trust", "media"] },
      "Manşet iddia, dosya geç",
      "Manşet dosyadan hızlıdır. Resmî ses akşamı bekler. Kahve, öğleni çoktan konuşmuştur.",
      "The headline claims, the file is late",
      "The headline is faster than the file. The official voice waits for evening. The coffeehouse has already spoken noon.",
      choice("noon", "Öğlen notunu çıkar", "Issue a noon note", "Tempo; hata payı", { effects: { rumor: -1, info: 1 }, stageTo: 1, next: { eventId: "dc_cr_tru_media2", dueTurns: 3, key: "cr-tru-media2" }, echo: "Öğlen notu çıktı; manşet yine bir cümle önde yürüdü." }),
      choice("evening", "Akşamı bekle", "Wait for evening", "Boşluk", { effects: { rumor: 2 }, stageTo: 9 })),
    later("dc_cr_tru_media2", { stage: 2, tags: ["crisis", "trust", "memory", "media"] },
      "Not vardır, tefsir dağılır",
      "Öğlen cümlesi arşivdedir. Akşam başka tefsir gelir. İki resmi ses, tek güven bırakmaz.",
      "There is a note, the reading scatters",
      "The noon sentence is in the archive. Evening brings another reading. Two official voices do not leave one trust.",
      choice("one", "Tek saat tut", "Keep a single hour", "Disiplin", { stageTo: 3, next: { eventId: "dc_cr_tru_media3", dueTurns: 24, key: "cr-tru-media3" } }),
      choice("both", "İki saati yaşat", "Let both hours live", "Gürültü", { effects: { rumor: 1 }, stageTo: 3 })),
    later("dc_cr_tru_media3", { stage: 3, tags: ["crisis", "trust", "long", "media"] },
      "Saat çoğul, inanç tekil değil",
      "Kriz durulur. Resmî ses hâlâ geç kalır sanılır. Manşet, devlet cümlesinin önünde yürümeyi alışkanlık sayar.",
      "The hour is plural, belief is not singular",
      "The crisis settles. The official voice is still assumed late. The headline takes walking ahead of the state sentence as a habit.",
      choice("hour", "Saati ilan et, tut", "Announce the hour and keep it", "Kurum", { effects: { info: 1 }, stageTo: 4 }),
      choice("chase", "Manşeti kovala", "Chase the headline", "Tempo kaybı", { stageTo: 4 })),
  ],
});
push({
  id: "cr-ext-energy", arc: "external", tags: ["crisis", "external", "fiscal", "institution"],
  nodes: [
    opening("dc_cr_ext_energy", { needCrisis: "external", needInst: "maliye", tags: ["crisis", "external", "fiscal"] },
      "Fatura dipnot, kış önde",
      "Nuri Hazine faturayı siyaset sayar. Dış bağımlılık dipnottadır. Kış, dipnot okumaz.",
      "The bill is a footnote, winter is ahead",
      "Nuri Treasury treats the bill as politics. External dependence sits in a footnote. Winter does not read footnotes.",
      choice("shield", "Hane payını öne al", "Bring the household share forward", "Rıza; kasa", { effects: { heat: -2 }, stageTo: 1, next: { eventId: "dc_cr_ext_energy2", dueTurns: 4, key: "cr-ext-energy2" }, echo: "Pay haneye indi; dipnot dışarıda kaldı." }),
      choice("pass", "Faturayı olduğu gibi ilet", "Pass the bill as it is", "Isı", { effects: { heat: 3 }, stageTo: 9 })),
    later("dc_cr_ext_energy2", { stage: 2, tags: ["crisis", "external", "memory", "fiscal"] },
      "Pay durur, dipnot şişer",
      "Hane sakin görünür. Dış satır büyümüştür. Nuri 'siyaset değil, kalem' der. Kalem, kışı ötelemez.",
      "The share holds, the footnote inflates",
      "The household looks calm. The external line has grown. Nuri says it is not politics, it is a line. The line does not postpone winter.",
      choice("hedge", "Dış satırı açık yaz", "Write the external line in the open", "Info", { effects: { info: 1 }, stageTo: 3, next: { eventId: "dc_cr_ext_energy3", dueTurns: 24, key: "cr-ext-energy3" } }),
      choice("hide", "Dipnotu büyüt", "Grow the footnote", "Sis", { effects: { info: -1 }, stageTo: 3 })),
    later("dc_cr_ext_energy3", { stage: 3, tags: ["crisis", "external", "long", "fiscal"] },
      "Kış unutulur, pay kalır",
      "Kriz cümlesi kapanır. Hane payı alışkanlık olmuştur. Dış bağımlılık hâlâ dipnottur.",
      "Winter is forgotten, the share remains",
      "The crisis sentence closes. The household share has become a habit. External dependence is still a footnote.",
      choice("keep", "Payı kalıcı tut", "Keep the share permanent", "Mali omurga", { stageTo: 4 }),
      choice("wean", "Payı kışa bağla", "Tie the share to winter", "Mevsimlik", { stageTo: 4 })),
  ],
});
push({
  id: "cr-ext-rates", arc: "external", tags: ["crisis", "external", "institution", "fiscal"],
  nodes: [
    opening("dc_cr_ext_rates", { needCrisis: "external", needInst: "merkez", tags: ["crisis", "external", "institution"] },
      "Dış faiz, iç cümle",
      "Dış masa oranı değiştirir. Süreyya hattı iç cümleyi kapıda tutar. İki faiz, aynı haneyi tarif etmez.",
      "An external rate, an inner sentence",
      "The outer desk changes the rate. Süreyya's line keeps the inner sentence at the door. Two rates do not describe the same household.",
      choice("follow", "İç cümleyi dışa yaklaştır", "Move the inner sentence toward the outer", "Çapa; kredi ısınır", { effects: { heat: 1 }, stageTo: 1, next: { eventId: "dc_cr_ext_rates2", dueTurns: 5, key: "cr-ext-rates2" }, echo: "İç cümle dışa kaydı; kredi başka dil konuştu." }),
      choice("hold", "İç cümleyi tut", "Hold the inner sentence", "Makas", { effects: { rumor: 1 }, stageTo: 9 })),
    later("dc_cr_ext_rates2", { stage: 2, tags: ["crisis", "external", "memory"] },
      "Yakınlık var, makas durur",
      "İç oran hareket etmiştir. Kredi hâlâ eski cümleyi okur. İş dünyası 'yay' der. Hane 'taksit' der.",
      "There is closeness, the spread remains",
      "The inner rate has moved. Credit still reads the old sentence. Business says spread. The household says installment.",
      choice("credit", "Kredi cümlesini de kaydır", "Slide the credit sentence too", "Şok", { effects: { heat: 2 }, stageTo: 3, next: { eventId: "dc_cr_ext_rates3", dueTurns: 36, key: "cr-ext-rates3" } }),
      choice("lag", "Gecikmeyi yastık say", "Treat the lag as a cushion", "Belirsizlik", { stageTo: 3 })),
    later("dc_cr_ext_rates3", { stage: 3, tags: ["crisis", "external", "long"] },
      "Dış masa alışkanlık olur",
      "Kriz durulur. İç cümle hâlâ dış kapıya bakar. Para otoritesi omurga, rıza ayrı mahalle.",
      "The outer desk becomes a habit",
      "The crisis settles. The inner sentence still looks at the outer door. The monetary authority is a spine; consent is another neighbourhood.",
      choice("own", "İç saati esas yaz", "Write the inner hour as the base", "Özerklik", { stageTo: 4 }),
      choice("door", "Kapıyı omurga tut", "Keep the door as spine", "Dış çapa", { stageTo: 4 })),
  ],
});
push({
  id: "cr-ext-border", arc: "external", tags: ["crisis", "external", "institution", "form", "intelligence"],
  nodes: [
    opening("dc_cr_ext_border", { needCrisis: "external", needInst: "ordu", tags: ["crisis", "external", "institution"] },
      "Sınır notu, tedarik hattı",
      "Haluk Paşa masası sınır notu düşer. Tedarik hattı bütçe satırını gecikmeli şişirir. İç reform iki hafta bekler; not beklemez.",
      "A border note, a supply line",
      "Haluk Pasha's desk drops a border note. The supply line inflates the budget line with a delay. Inner reform waits two weeks; the note does not.",
      choice("note", "Notu takvime işle", "Put the note on the calendar", "Dış tempo; iç kayar", { effects: { heat: -1 }, stageTo: 1, next: { eventId: "dc_cr_ext_border2", dueTurns: 6, key: "cr-ext-border2" }, echo: "Sınır notu takvime girdi; iç reform satırı kaydı." }),
      choice("inner", "İç reformu öne al", "Bring inner reform forward", "Kapasite iddiası", { stageTo: 9 })),
    later("dc_cr_ext_border2", { stage: 2, tags: ["crisis", "external", "memory", "form"] },
      "Takvim dolu, hat gecikmeli",
      "Not işlenmiştir. Tedarik hâlâ yoldadır. Leyla Koordinasyon darboğazı 'sessizlik de bilgi' diye yazar.",
      "The calendar is full, the line is delayed",
      "The note has been processed. Supply is still on the road. Leyla Coordination writes the bottleneck as silence also being information.",
      choice("supply", "Tedarik satırını açık tut", "Keep the supply line open", "Mali şişme", { stageTo: 3, next: { eventId: "dc_cr_ext_border3", dueTurns: 24, key: "cr-ext-border3" } }),
      choice("cap", "Notu sınırla, hattı bekle", "Bound the note, wait on the line", "İç nefes", { stageTo: 3 })),
    later("dc_cr_ext_border3", { stage: 3, tags: ["crisis", "external", "long", "form"] },
      "Not arşivi, reform dipnot",
      "Sınır cümlesi omurga olmuştur. İç reform hâlâ iki hafta bekler. Devlet, dış notu takvim sanır.",
      "A note archive, reform as footnote",
      "The border sentence has become a spine. Inner reform still waits two weeks. The state mistakes an external note for a calendar.",
      choice("keep", "Not omurgasını tut", "Keep the note spine", "Form", { stageTo: 4 }),
      choice("reform", "İç satırı geri çağır", "Call the inner line back", "Kapasite", { stageTo: 4 })),
  ],
});
push({
  id: "cr-ext-trade", arc: "external", tags: ["crisis", "external", "fiscal", "group"],
  nodes: [
    opening("dc_cr_ext_trade", { needCrisis: "external", needInst: "maliye", tags: ["crisis", "external", "fiscal"] },
      "Kota kapısı, ihracat satırı",
      "Dış masa kapıyı daraltır. Kemal Bey fazla cümlesini gösterir. İhracat satırı, kapıya takılır.",
      "A quota door, an export line",
      "The outer desk narrows the door. Kemal Bey shows the surplus sentence. The export line catches on the door.",
      choice("door", "Kapıya karşı satır aç", "Open a line against the door", "Dış nefes; iç pay", { effects: { heat: 1 }, stageTo: 1, next: { eventId: "dc_cr_ext_trade2", dueTurns: 5, key: "cr-ext-trade2" }, echo: "Karşı satır yazıldı; kapı aynı darlıkta kaldı." }),
      choice("wait", "Kapıyı bekle, satırı tut", "Wait on the door, hold the line", "Stok", { stageTo: 9 })),
    later("dc_cr_ext_trade2", { stage: 2, tags: ["crisis", "external", "memory", "fiscal"] },
      "Satır vardır, alıcı yok",
      "Karşı kapı açılmış görünür. Sipariş gelmez. İş dünyası 'piyasa' der. Maliye 'program' der.",
      "There is a line, no buyer",
      "The counter-door looks opened. The order does not come. Business says market. Finance says program.",
      choice("seek", "Alıcı takvimini kur", "Build a buyer calendar", "Tempo", { stageTo: 3, next: { eventId: "dc_cr_ext_trade3", dueTurns: 36, key: "cr-ext-trade3" } }),
      choice("stock", "Stoku içe çevir", "Turn stock inward", "İç kuyruk azalır", { effects: { heat: -1 }, stageTo: 3 })),
    later("dc_cr_ext_trade3", { stage: 3, tags: ["crisis", "external", "long", "fiscal"] },
      "Kapı alışkanlık, satır hafıza",
      "Kota cümlesi arşivde. Her daralmada aynı karşı satır kurulur. Devlet, kapıyı kader, satırı politika sanır.",
      "The door is a habit, the line is memory",
      "The quota sentence is in the archive. At every narrowing the same counter-line is built. The state takes the door for fate and the line for policy.",
      choice("diversify", "Tek kapıya bağlama", "Do not bind to one door", "Uzun dış", { stageTo: 4 }),
      choice("one", "Aynı kapıyı bekle", "Wait on the same door", "Tekrar", { stageTo: 4 })),
  ],
});

// --- Institution / form / region / group / development / network chains ---
// Concatenated into devlet-content.js. Relies on push, opening, later, choice.

push({
  id: "in-maliye", arc: "fiscal", era: "2002", tags: ["institution", "cadre", "cross", "fiscal"],
  nodes: [
    opening("dc_in_maliye", { era: "2002", needInst: "maliye", needCadre: "maliye", maxTrust: 78, tags: ["institution", "cadre", "fiscal"] },
      "Tahsilat sahası, kâğıt fazla",
      "Kemal Bey faiz dışı fazlayı masaya bırakır. Tahsilat cetveli dolu durur. Üç ilin veznesi aynı ayı boş yazar. Fazla, saha görülmeden şişer.",
      "Field collection, a paper surplus",
      "Kemal Bey sets the primary surplus on the desk. The collection sheet looks full. Three provincial cashiers write the same month empty. The surplus swells before the field is seen.",
      choice("collect", "Saha veznesini aç, fazlayı beklet", "Open the field cashier, hold the surplus", "Dürüstlük; çapa", { effects: { info: 1 }, stageTo: 1, next: { eventId: "dc_in_maliye2", dueTurns: 5, key: "in-maliye2" }, echo: "Fazla sahayı beklemedi; kâğıt onu önden yazdı." }),
      choice("paper", "Fazlayı tut, tahsilatı dipnota it", "Hold the surplus, push collection to a footnote", "Program; sis", { effects: { rumor: 1 }, stageTo: 9, echo: "Dipnot tahsilatı silmedi; sadece gizledi." })),
    later("dc_in_maliye2", { era: "2002", needInst: "maliye", tags: ["institution", "memory", "fiscal"] },
      "Gözden geçirme, vezne boşluğu",
      "Heyet gülümser. Kemal 'program tutuyor' der. Vezne boşluğu bir çeyrek sonra revizyona iner. İyimser üslup, noksanı ertelemiştir.",
      "A review, a cashier gap",
      "The mission smiles. Kemal says the program is holding. The cashier gap drops into a revision a quarter later. Optimistic tone postponed the shortfall.",
      choice("revise", "Revizyonu öne al, cetveli düzelt", "Bring the revision forward, correct the sheet", "Güven", { effects: { info: 1 }, stageTo: 3, next: { eventId: "dc_in_maliye3", dueTurns: 24, key: "in-maliye3" } }),
      choice("tone", "Üslubu koru, mevsim de", "Keep the tone, blame the season too", "İtibar", { effects: { rumor: 1 }, stageTo: 3 })),
    later("dc_in_maliye3", { stage: 3, era: "2002", tags: ["institution", "long", "fiscal", "memory"] },
      "Çıkış yılı, fazla izi",
      "Dış çapa gevşer. Fazla şişmesi bir iz olarak durur. Kemal 'alışkanlık' der. Taşra hâlâ o çeyreğin veznesini arar.",
      "Exit year, a surplus trace",
      "The external anchor loosens. The inflated surplus remains as a trace. Kemal says habit. The provinces still look for that quarter's cashier.",
      choice("habit", "Disiplini içselleştir, izi dosyala", "Internalise the discipline, file the trace", "Kurum", { stageTo: 4, echo: "Fazla izi arşive indi; saha onu unutmadı." }),
      choice("ease", "Sıkışan satırı aç", "Open the squeezed line", "Rıza", { effects: { heat: -1 }, stageTo: 4 })),
  ],
});

push({
  id: "in-merkez", arc: "fiscal", era: "2002", tags: ["institution", "cadre", "cross", "fiscal"],
  nodes: [
    opening("dc_in_merkez", { era: "2002", needInst: "merkez", needCadre: "merkez", minCapacity: 40, tags: ["institution", "cadre", "fiscal"] },
      "Sözle çapa, siyasi faiz",
      "Süreyya hattı örtük hedefi masaya bırakır. Siyaset faizi kapıda tutar. Gıda yapışkanlığı çekirdek sayıya girmez. İki cümle aynı ayı tarif etmez.",
      "A word-anchor, a political rate",
      "Süreyya's line sets an implicit target on the desk. Politics keeps the rate at the door. Food stickiness does not enter the core number. Two sentences do not describe the same month.",
      choice("word", "Sözü tut, gıdayı ayrı izle", "Hold the word, watch food separately", "Otorite; hane", { effects: { info: 1 }, stageTo: 1, next: { eventId: "dc_in_merkez2", dueTurns: 4, key: "in-merkez2" }, echo: "Çekirdek çapa oldu; file başka bir ülkeyi anlattı." }),
      choice("rate", "Siyasi faizi içeri al", "Let the political rate in", "Rıza; çapa kayar", { effects: { rumor: 2 }, stageTo: 9 })),
    later("dc_in_merkez2", { era: "2002", needInst: "merkez", tags: ["institution", "memory", "fiscal"] },
      "Çekirdek ayrışması, pazar filesi",
      "Resmî seri iner. Pazar filesi inmez. Süreyya 'çekirdek' der; emekli hane 'yağ' der. Ayrışma bir dipnot değildir artık.",
      "Core divergence, a market bag",
      "The official series falls. The market bag does not. Süreyya says core; the pensioner household says oil. The split is no longer a footnote.",
      choice("explain", "Ayrışmayı açık anlat", "Explain the split in the open", "Şeffaflık", { effects: { info: 1 }, stageTo: 3, next: { eventId: "dc_in_merkez3", dueTurns: 36, key: "in-merkez3" } }),
      choice("core", "Çekirdekte kal, filesi sokakta", "Stay with the core, leave the bag on the street", "Sis", { effects: { rumor: 1 }, stageTo: 3 })),
    later("dc_in_merkez3", { stage: 3, era: "2002", tags: ["institution", "long", "fiscal", "memory"] },
      "Söz alışkanlığı, hane hafızası",
      "Yıllar sonra çapa bir cümle olarak durur. Hane o kışki fileyi unutmaz. Merkez otorite sandı; sokak bir endeks tuttu.",
      "A habit of words, household memory",
      "Years later the anchor remains as a sentence. The household does not forget that winter's bag. The centre thought it was authority; the street kept an index.",
      choice("dual", "Çift cümleyi yayımlar", "Publish the double sentence", "Kurum", { effects: { info: 1 }, stageTo: 4 }),
      choice("one", "Tek çapa cümlesine dön", "Return to a single anchor-sentence", "Sade", { stageTo: 4 })),
  ],
});

push({
  id: "in-mulkiye", arc: "admin", era: "2002", tags: ["institution", "cadre", "cross"],
  nodes: [
    opening("dc_in_mulkiye", { era: "2002", needInst: "mulkiye", needCadre: "mulkiye", maxCapacity: 72, tags: ["institution", "cadre"] },
      "Yüzde 82, saha binası",
      "Cemil Vali hattı uygulama yüzdesini 82 yazar. Sahadan üç not aynı hafta gelir: hangi binada başladığını arıyorlar. Tempo temennidir; il başka bir takvim tutar.",
      "Eighty-two percent, a field building",
      "Cemil Vali's line writes implementation at 82 percent. Three field notes arrive the same week: they are looking for which building to start in. Pace is a wish; the province keeps another calendar.",
      choice("field", "Saha binasını yaz, yüzdeyi beklet", "Name the field building, hold the percent", "Uygulama", { effects: { info: 1, heat: -1 }, stageTo: 1, next: { eventId: "dc_in_mulkiye2", dueTurns: 6, key: "in-mulkiye2" }, echo: "Yüzde sahayı beklemedi; üç il binayı aradı." }),
      choice("percent", "Yüzdeyi tut, notu yumuşat", "Keep the percent, soften the note", "Tabela", { effects: { rumor: 1 }, stageTo: 9 })),
    later("dc_in_mulkiye2", { era: "2002", needInst: "mulkiye", tags: ["institution", "memory"] },
      "İl uygulaması, merkez temenni",
      "Valilik tempo ister. Merkez 'yönerge gitti' der. Üç il hâlâ odayı arar. Cemil 'başladı' yazar; kaymakam 'anahtar yok' der.",
      "Provincial application, a central wish",
      "The governorate wants pace. The centre says the circular went out. Three provinces still look for the room. Cemil writes started; the district head says there is no key.",
      choice("key", "Anahtarı ve odayı adlandır", "Name the key and the room", "Saha", { effects: { info: 1 }, stageTo: 3, next: { eventId: "dc_in_mulkiye3", dueTurns: 24, key: "in-mulkiye3" } }),
      choice("circular", "Yönergeyi başarı say", "Count the circular as success", "Kâğıt", { stageTo: 3 })),
    later("dc_in_mulkiye3", { stage: 3, era: "2002", tags: ["institution", "long", "memory"] },
      "İki hükümet, aynı yüzde cümlesi",
      "İsimler değişir. Yüzde şablonu değişmez. Cemil hattı 'saha-merkez' izini taşır. Devlet, temenniyi uygulama sandı.",
      "Two governments, the same percent-sentence",
      "The names change. The percent template does not. Cemil's line still carries the field-centre trace. The state mistook a wish for implementation.",
      choice("template", "Şablona saha satırı ekle", "Add a field line to the template", "Hafıza", { stageTo: 4 }),
      choice("keep", "Yüzdeyi devret", "Hand the percent on", "Süreklilik", { stageTo: 4 })),
  ],
});

push({
  id: "in-yargi", arc: "admin", era: "2002", tags: ["institution", "cadre", "cross"],
  nodes: [
    opening("dc_in_yargi", { era: "2002", needInst: "yargi", needCadre: "yargi", minFatigue: 8, tags: ["institution", "cadre"] },
      "Uyum paketi, duruşma takvimi",
      "Ayşe Hanım kurul mevzuatı hızlandırır. Mahkeme kalemi aynı haftayı yazmaz. Paket övülür; duruşma bir ay kayar. İki tempo aynı koridorda durmaz.",
      "An alignment pack, a hearing calendar",
      "Ayşe's board accelerates the statute. The court clerk does not write the same week. The pack is praised; the hearing slips a month. Two tempos do not stand in the same corridor.",
      choice("calendar", "Kalem takvimini öne al", "Bring the clerk calendar forward", "Kapasite; kapı yavaş", { effects: { info: 1 }, stageTo: 1, next: { eventId: "dc_in_yargi2", dueTurns: 7, key: "in-yargi2" }, echo: "Paket takvimi çevirmedi; kalem ayrı kaldı." }),
      choice("pack", "Paketi tut, duruşmayı dipnota yaz", "Hold the pack, footnote the hearing", "Dış kapı", { effects: { rumor: 1 }, stageTo: 9 })),
    later("dc_in_yargi2", { era: "2002", needInst: "yargi", tags: ["institution", "memory"] },
      "Kalem yorgunluğu, Brüksel saati",
      "Ayşe hâlâ fasıl konuşur. Kalem 'dosya yığını' der. Yorgunluk bir istatistik değildir; duruşma listesinde görünür.",
      "Clerk fatigue, Brussels time",
      "Ayşe still talks chapters. The clerk says a pile of files. Fatigue is not a statistic; it shows on the hearing list.",
      choice("staff", "Kalem kadrosu kaydır, yığını say", "Move clerk posts, count the pile", "Kurum", { effects: { heat: -1 }, stageTo: 3, next: { eventId: "dc_in_yargi3", dueTurns: 36, key: "in-yargi3" } }),
      choice("chapter", "Fasıl temposunu tut", "Keep the chapter pace", "Dış", { stageTo: 3 })),
    later("dc_in_yargi3", { stage: 3, era: "2002", tags: ["institution", "long", "memory"] },
      "Fasıl ilerler, kalem yerinde",
      "Takvim Brüksel'e göre yürür. Mahkeme kalemi aynı odadadır. Uyum kâğıtta bir ülke, duruşmada başka.",
      "The chapter advances, the clerk stays put",
      "The calendar walks to Brussels. The court clerk is in the same room. Alignment is one country on paper and another at the hearing.",
      choice("repair", "Kalemi onar, paketi beklet", "Repair the clerk, hold the pack", "İç kapasite", { stageTo: 4 }),
      choice("hold", "Takvimi tut, yığını devret", "Hold the calendar, hand the pile on", "Süreklilik", { stageTo: 4 })),
  ],
});

push({
  id: "in-ordu", arc: "admin", era: "2002", tags: ["institution", "cadre", "cross"],
  nodes: [
    opening("dc_in_ordu", { era: "2002", needInst: "ordu", needCadre: "ordu", minCapacity: 48, tags: ["institution", "cadre"] },
      "Sınır notu, bütçe gecikmesi",
      "Haluk Paşa masası tedarik hattını kısa yazar. Bütçe satırı iki ay geriden şişer. Not 'kapasite kaymasın' der; iç reform takvimi dipnota iner. Operasyon cümlesi yoktur — satır vardır.",
      "A border note, a budget lag",
      "Haluk Pasha's desk writes the supply line short. The budget line swells two months late. The note says do not let capacity slip; the internal-reform calendar drops to a footnote. There is no operations sentence — there is a line.",
      choice("note", "Notu tut, bütçeyi eşle", "Hold the note, match the budget", "Strateji; kasa", { effects: { info: 1 }, stageTo: 1, next: { eventId: "dc_in_ordu2", dueTurns: 6, key: "in-ordu2" }, echo: "Sınır notu bütçeyi beklemedi; satır geriden şişti." }),
      choice("lag", "Bütçeyi öne al, notu beklet", "Bring the budget forward, hold the note", "Kasa; tempo", { effects: { heat: 1 }, stageTo: 9 })),
    later("dc_in_ordu2", { era: "2002", needInst: "ordu", tags: ["institution", "memory"] },
      "Tedarik hattı, sivil takvim",
      "Haluk 'kapasite' der. Sivil kalem 'iki hafta' der. İç reform satırı kaymıştır; ittifak masası aynı cümleyi tekrarlar. Güvenlik omurgası, müzakereyi kapatmadan tempo ister.",
      "A supply line, a civilian calendar",
      "Haluk says capacity. The civilian pen says two weeks. The internal-reform line has slipped; the alliance desk repeats the same sentence. The security spine wants pace without closing negotiation.",
      choice("civil", "Sivil takvimi geri yaz", "Write the civilian calendar back in", "Müzakere", { effects: { heat: -1 }, stageTo: 3, next: { eventId: "dc_in_ordu3", dueTurns: 24, key: "in-ordu3" } }),
      choice("spine", "Tedarik temposunu tut", "Keep the supply pace", "Omurga", { stageTo: 3 })),
    later("dc_in_ordu3", { stage: 3, era: "2002", tags: ["institution", "long", "memory"] },
      "Bütçe izi, sınır cümlesi",
      "Yıllar sonra tedarik alışkanlığı durur. Bütçe gecikmesi bir izdir. Haluk masası 'düzen' der; sivil kalem hâlâ o iki haftayı sayar.",
      "A budget trace, a border sentence",
      "Years later the supply habit remains. The budget lag is a trace. Haluk's desk says order; the civilian pen still counts those two weeks.",
      choice("trace", "Gecikme izini dosyala", "File the lag trace", "Hafıza", { stageTo: 4 }),
      choice("keep", "Notu devret", "Hand the note on", "Süreklilik", { stageTo: 4 })),
  ],
});

push({
  id: "in-maarif", arc: "admin", era: "gunumuz", tags: ["institution", "cadre", "cross", "education"],
  nodes: [
    opening("dc_in_maarif", { era: "gunumuz", needInst: "maarif", needCadre: "maarif", maxCapacity: 68, tags: ["institution", "cadre", "education"] },
      "Tabela çoğalır, hoca yetişmez",
      "Melisa Öğretim kontenjanı başarı yazar. Tabela asılmıştır. Kadro telgrafı bir dönem geridedir. Derslik hesabı şişer; sıra başka bir sayıdır.",
      "Signboards multiply, teachers do not keep up",
      "Melisa counts enrollment as success. The signboard is up. The staffing telegram is a term behind. Classroom arithmetic swells; the bench is another number.",
      choice("teacher", "Hoca kadrosunu öne al, tabelayı beklet", "Bring teacher posts forward, hold the signboard", "Kapasite", { effects: { heat: -1 }, stageTo: 1, next: { eventId: "dc_in_maarif2", dueTurns: 5, key: "in-maarif2" }, echo: "Tabela hocayı beklemedi; kontenjan şişti." }),
      choice("sign", "Tabelayı başarı say, kadroyu dipnota yaz", "Count the signboard as success, footnote the post", "Görünürlük", { effects: { rumor: 1 }, stageTo: 9 })),
    later("dc_in_maarif2", { era: "gunumuz", needInst: "maarif", tags: ["institution", "memory", "education"] },
      "Kontenjan, boş sıra",
      "Sınıf açılmış görünür. Melisa 'erişim' der. Öğretmen yokluğu gizlenmez artık: veliler sıra sayar, bakanlık tabela sayar.",
      "Enrollment, an empty bench",
      "The class looks opened. Melisa says access. Teacher absence is no longer hidden: parents count benches, the ministry counts signboards.",
      choice("shift", "İkili tedrisatı açık yaz", "Write the double shift in the open", "Dürüstlük", { effects: { info: 1 }, stageTo: 3, next: { eventId: "dc_in_maarif3", dueTurns: 36, key: "in-maarif3" } }),
      choice("access", "Erişimi tut, sırayı unut", "Hold access, forget the bench", "Tabela", { stageTo: 3 })),
    later("dc_in_maarif3", { stage: 3, era: "gunumuz", tags: ["institution", "long", "education", "memory"] },
      "Bir kuşak, aynı derslik cümlesi",
      "Tabela çoğalmıştır. Hoca hattı hâlâ yetişmez. Melisa 'sefer bitti' yazar. Sıra yarım kalır; devlet erişimi kapasite sandı.",
      "A generation, the same classroom-sentence",
      "Signboards have multiplied. The teacher line still does not keep up. Melisa writes that the drive is over. The bench stays half-done; the state mistook access for capacity.",
      choice("cadre", "Öğretmen hattını kalıcı yaz", "Write the teacher line as permanent", "Uzun yük", { stageTo: 4 }),
      choice("leave", "Tabelayı arşivle", "Archive the signboard", "Unutuş", { stageTo: 4 })),
  ],
});

push({
  id: "in-belediye", arc: "admin", era: "gunumuz", tags: ["institution", "cadre", "cross"],
  nodes: [
    opening("dc_in_belediye", { era: "gunumuz", needInst: "belediye", needCadre: "belediye", maxTrust: 72, tags: ["institution", "cadre"] },
      "Tapu ayrı, tabela ayrı",
      "Selim İmar daireyi başarı sayar. Tapu bir dosyadır, tabela başka. Keşif defteri şişer; kalite ayrı bir kalemde bekler. Arz konuşulur, boru unutulur.",
      "The title is one file, the signboard another",
      "Selim counts the unit as success. The deed is one file, the signboard another. The survey book swells; quality waits in a separate pen. Supply is spoken of, the pipe is forgotten.",
      choice("quality", "Kalite kalemini öne al", "Bring the quality pen forward", "Saha; tempo düşer", { effects: { info: 1 }, stageTo: 1, next: { eventId: "dc_in_belediye2", dueTurns: 6, key: "in-belediye2" }, echo: "Daire tapuyu beklemedi; keşif kaliteyi unuttu." }),
      choice("title", "Tapuyu konuş, keşfi tut", "Talk the title, keep the survey", "Görünürlük", { effects: { rumor: 1 }, stageTo: 9 })),
    later("dc_in_belediye2", { era: "gunumuz", needInst: "belediye", tags: ["institution", "memory"] },
      "Keşif şişmesi, şikâyet defteri",
      "Daire teslim görünür. Nem ve tesisat ayrı satırda durur. Selim 'arz' der; site yönetimi 'keşif' der. İki defter aynı binayı tarif etmez.",
      "A swollen survey, a complaint ledger",
      "The unit looks handed over. Damp and plumbing sit on a separate line. Selim says supply; the site board says the survey. Two ledgers do not describe the same building.",
      choice("fix", "Şikâyet satırını keşfe bağla", "Tie the complaint line to the survey", "Kalite", { effects: { heat: -1 }, stageTo: 3, next: { eventId: "dc_in_belediye3", dueTurns: 24, key: "in-belediye3" } }),
      choice("supply", "Arzı başarı say", "Count supply as success", "Tabela", { stageTo: 3 })),
    later("dc_in_belediye3", { stage: 3, era: "gunumuz", tags: ["institution", "long", "memory"] },
      "On yıl, aynı nem cümlesi",
      "Tabela durur. Keşif kapanmıştır. Kalite izi site defterinde yaşar. Selim hattı daireyi omurga sandı; boru ayrı kaldı.",
      "Ten years, the same damp-sentence",
      "The signboard stands. The survey is closed. The quality trace lives in the site ledger. Selim's line treated the unit as a spine; the pipe stayed apart.",
      choice("pipe", "Bakım payını yaz", "Write a maintenance share", "Uzun yük", { stageTo: 4 }),
      choice("close", "Keşfi kapat", "Close the survey", "Unutuş", { stageTo: 4 })),
  ],
});
push({
  id: "in-istihbarat", arc: "intelligence", era: "2002",
  tags: ["intelligence", "institution", "cadre", "cross", "media"],
  nodes: [
    opening("dc_in_ist", { era: ["2002", "gunumuz"], needInst: "istikhbarat", tags: ["intelligence", "institution", "cadre", "media"] },
      "Brifing kanalı, sentez masası",
      "Leyla Koordinasyon uyarı kalitesini yazar. Operasyon cümlesi yoktur. Kanal tıkanınca sessizlik de bir bilgidir; sentez gecikir.",
      "A briefing channel, a synthesis desk",
      "Leyla Coordination writes warning quality. There is no operations sentence. When the channel clogs, silence is also information; synthesis is late.",
      choice("open", "Sentez masasını kur", "Set a synthesis desk", "Koordinasyon", { effects: { info: 2 }, stageTo: 1, next: { eventId: "dc_in_ist2", dueTurns: 4, key: "in-ist2" } }),
      choice("quiet", "Tıkanıklığı dipnota al", "Put the clog in a footnote", "Sis", { effects: { rumor: 1 }, stageTo: 9 })),
    later("dc_in_ist2", { tags: ["intelligence", "memory", "institution"] },
      "Uyarı isabeti, abartı eşiği",
      "Leyla belirsizliği abartmamaya çalışır. Erken uyarı kaçınca sessizlik bir karar gibi durur. Bu yöntem değil, kalem sırasıdır.",
      "Warning accuracy, a threshold of exaggeration",
      "Leyla tries not to overstate uncertainty. When an early warning is missed, silence looks like a decision. This is not a method; it is a pen queue.",
      choice("log", "Kaçanı kaydet", "Record the miss", "Öğrenme", { effects: { info: 1 }, stageTo: 2, next: { eventId: "dc_in_ist3", dueTurns: 24, key: "in-ist3" } }),
      choice("smooth", "Sessizliği bilgi say", "Count silence as information", "Sis", { stageTo: 2 })),
    later("dc_in_ist3", { stage: 3, tags: ["intelligence", "long", "institution"] },
      "Koordinasyon alışkanlığı",
      "Üç kurum aynı riski ayrı zarfta taşır. Sentez masası kurulmuşsa daralma azalır; kurulmamışsa her kriz gürültülüyü seçer.",
      "A coordination habit",
      "Three institutions carry the same risk in separate envelopes. If a synthesis desk was set, the bottleneck eases; if not, every crisis picks the loudest family.",
      choice("seven", "Yedi aileyi yan yana yaz", "Write the seven families side by side", "Denge", { stageTo: 4 }),
      choice("loud", "Gürültülüyü öne al", "Put the loud one first", "Tempo", { stageTo: 4 })),
  ],
});
push({
  id: "in-ist-warn", arc: "intelligence", era: ["2002", "gunumuz"],
  tags: ["intelligence", "institution", "cross"],
  nodes: [
    opening("dc_ist_warn", { era: ["2002", "gunumuz"], needInst: "istikhbarat", tags: ["intelligence", "institution"] },
      "Uyarı kalitesi, saha kapasitesi",
      "Uyarı şişebilir; saha kapasitesi şişmez. Leyla 'isabet' der. Merkez 'ton' der.",
      "Warning quality, field capacity",
      "A warning can inflate; field capacity does not. Leyla says accuracy. The centre says tone.",
      choice("acc", "İsabeti ölç", "Measure accuracy", "Kurum", { effects: { info: 1 }, stageTo: 1, next: { eventId: "dc_ist_warn2", dueTurns: 6, key: "ist-warn2" } }),
      choice("tone", "Tonu yumuşat", "Soften the tone", "Siyaset", { stageTo: 9 })),
    later("dc_ist_warn2", { stage: 2, tags: ["intelligence", "memory", "long"] },
      "İsabet defteri",
      "Bir yıl sonra yanlış negatifler sayılır. Defter bir yöntem dosyası değildir; bir kalite izidir.",
      "An accuracy ledger",
      "A year later false negatives are counted. The ledger is not a methods file; it is a quality trace.",
      choice("keep", "Defteri tut", "Keep the ledger", "Hafıza", { stageTo: 3, next: { eventId: "dc_ist_warn3", dueTurns: 24, key: "ist-warn3" } }),
      choice("close", "Defteri kapat", "Close the ledger", "Unutuş", { stageTo: 3 })),
    later("dc_ist_warn3", { stage: 3, tags: ["intelligence", "long"] },
      "Kalite alışkanlık olur",
      "Uyarı cümlesi kısalır ya da uzar. Devlet, isabeti otorite sandı.",
      "Quality becomes a habit",
      "The warning sentence shortens or lengthens. The state mistook accuracy for authority.",
      choice("rule", "İsabet kuralı yaz", "Write an accuracy rule", "Kurum", { stageTo: 4 }),
      choice("flex", "Ton esnekliği tut", "Keep tone flexibility", "Siyaset", { stageTo: 4 })),
  ],
});
push({
  id: "gv-turnover", arc: "government",
  tags: ["government", "cadre", "memory", "cross", "institution"],
  nodes: [
    opening("dc_gv_turn", { tags: ["government", "cadre", "institution", "memory"] },
      "Hükümet değişir, dosya kalır",
      "Mandat yenidir. Rapor şablonu eskidir. Devlet hafızası hükümetten uzun yaşar; oyuncu hükümet değildir.",
      "The government changes, the file remains",
      "The mandate is new. The report template is old. State memory outlives government; the player is not the government.",
      choice("keep", "Dosyayı koru", "Keep the file", "Süreklilik", { stageTo: 1, next: { eventId: "dc_gv_turn2", dueTurns: 5, key: "gv-turn2" } }),
      choice("sweep", "Şablonu boz", "Break the template", "Tempo", { effects: { heat: 1 }, stageTo: 2 })),
    later("dc_gv_turn2", { tags: ["government", "memory"] },
      "Devralınan sorun",
      "Yeni kabine 'temiz masa' der. Açık kriz satırı masanın altındadır. Miras, seçim vaadi değildir.",
      "An inherited problem",
      "The new cabinet says a clean desk. An open crisis line is under the desk. Inheritance is not a campaign promise.",
      choice("name", "Mirası adlandır", "Name the inheritance", "Dürüstlük", { effects: { info: 1 }, stageTo: 3, next: { eventId: "dc_gv_turn3", dueTurns: 24, key: "gv-turn3" } }),
      choice("clean", "Temiz masa anlatısını tut", "Keep the clean-desk story", "Anlatı", { stageTo: 3 })),
    later("dc_gv_turn3", { stage: 3, tags: ["government", "long", "memory"] },
      "İki kabine, aynı şablon",
      "İsimler değişmiş. Dosya değişmemiş. Devlet, hükümeti omurga sanırsa boş kabuğa yürür.",
      "Two cabinets, the same template",
      "The names changed. The file did not. If the state treats government as a spine, it walks toward an empty shell.",
      choice("archive", "Şablonu arşivle", "Archive the template", "Hafıza", { stageTo: 4 }),
      choice("reset", "Şablonu yenile", "Renew the template", "Siyaset", { stageTo: 4 })),
  ],
});
push({
  id: "gv-mandate", arc: "government",
  tags: ["government", "cadre", "cross"],
  nodes: [
    opening("dc_gv_mand", { tags: ["government", "cadre"] },
      "Mandat yüksek, kapasite alçak",
      "Siyasi sermaye tempo ister. Kurum yorgunluğu başka bir takvim tutar. Oyuncu parti yöneticisi değil, devlet organizmasıdır.",
      "Mandate high, capacity low",
      "Political capital wants pace. Institutional fatigue keeps another calendar. The player is not a party manager; it is the state organism.",
      choice("pace", "Mandatı yaz, kapasiteyi ölç", "Write the mandate, measure capacity", "Sürtünme", { stageTo: 1, next: { eventId: "dc_gv_mand2", dueTurns: 4, key: "gv-mand2" } }),
      choice("cap", "Kapasiteyi öne al", "Put capacity first", "Kurum", { stageTo: 2 })),
    later("dc_gv_mand2", { tags: ["government", "memory", "institution"] },
      "Tempo, yorgunluk",
      "İki karar aynı ayda iner. Yorgunluk bir kalkan olur. Mandat yüzde yazar; saha bina arar.",
      "Pace, fatigue",
      "Two decisions land in the same month. Fatigue becomes a shield. The mandate writes a percent; the field looks for a building.",
      choice("rest", "Temposu düşür", "Drop the pace", "Onarım", { stageTo: 3, next: { eventId: "dc_gv_mand3", dueTurns: 36, key: "gv-mand3" } }),
      choice("push", "Mandatı tut", "Hold the mandate", "Yorgunluk", { effects: { heat: 1 }, stageTo: 3 })),
    later("dc_gv_mand3", { stage: 3, tags: ["government", "long"] },
      "Mandat unutulur, yorgunluk kalır",
      "Seçim cümlesi arşivde. Kurum yorgunluğu hâlâ koridordadır.",
      "The mandate is forgotten, fatigue remains",
      "The election sentence is in the archive. Institutional fatigue is still in the corridor.",
      choice("repair", "Yorgunluğu dosyala", "File the fatigue", "Kurum", { stageTo: 4 }),
      choice("story", "Mandatı hatırla", "Remember the mandate", "Anlatı", { stageTo: 4 })),
  ],
});
push({
  id: "gv-coalition", arc: "government",
  tags: ["government", "group", "cross"],
  nodes: [
    opening("dc_gv_coal", { tags: ["government", "group"] },
      "Koalisyon baskısı, dosya temposu",
      "Ortaklık tempo ister, ortaklık veto ister. İkisi aynı ayın çocuğu değildir. Devlet, partilerin masası değil; dosyanın sahibidir.",
      "Coalition pressure, a file pace",
      "The partnership wants pace and also wants a veto. They are not children of the same month. The state is not the parties' table; it owns the file.",
      choice("file", "Dosyayı tut", "Keep the file", "Süreklilik", { stageTo: 1, next: { eventId: "dc_gv_coal2", dueTurns: 6, key: "gv-coal2" } }),
      choice("veto", "Veto satırını yaz", "Write the veto line", "Sürtünme", { effects: { heat: 1 }, stageTo: 2 })),
    later("dc_gv_coal2", { tags: ["government", "memory"] },
      "Ortaklık homurtusu",
      "Bir satır gecikir. Homurtu kriz değildir; mesafe ölçüsüdür.",
      "A partnership murmur",
      "One line is late. The murmur is not a crisis; it is a measure of distance.",
      choice("note", "Mesafeyi kaydet", "Record the distance", "Bilgi", { stageTo: 3, next: { eventId: "dc_gv_coal3", dueTurns: 24, key: "gv-coal3" } }),
      choice("ignore", "Homurtuyu yok say", "Ignore the murmur", "Tempo", { stageTo: 3 })),
    later("dc_gv_coal3", { stage: 3, tags: ["government", "long"] },
      "Ortaklık biter, dosya kalır",
      "Kabine dağılır. Kriz satırı durur. Devlet hafızası ortaklıktan uzun.",
      "The partnership ends, the file remains",
      "The cabinet dissolves. The crisis line remains. State memory is longer than partnership.",
      choice("keep", "Satırı koru", "Keep the line", "Hafıza", { stageTo: 4 }),
      choice("reset", "Satırı yeni kabineye bırak", "Leave the line to a new cabinet", "Siyaset", { stageTo: 4 })),
  ],
});
push({
  id: "gv-inherit", arc: "government",
  tags: ["government", "crisis", "memory", "cross"],
  nodes: [
    opening("dc_gv_inh", { tags: ["government", "crisis", "memory"] },
      "Devralınan kriz satırı",
      "Yeni hükümet 'biz yapmadık' der. Satır yine masadadır. Oyuncu hükümeti değiştirebilir; devleti sıfırlayamaz.",
      "An inherited crisis line",
      "The new government says we did not do this. The line is still on the desk. The player can change governments; it cannot zero the state.",
      choice("own", "Satırı sahiplen", "Own the line", "Süreklilik", { stageTo: 1, next: { eventId: "dc_gv_inh2", dueTurns: 4, key: "gv-inh2" } }),
      choice("blame", "Mirası adlandır, işi ertele", "Name the inheritance, delay the work", "Anlatı", { stageTo: 2 })),
    later("dc_gv_inh2", { tags: ["government", "memory", "crisis"] },
      "Mirası işlemek",
      "Sahiplenmek bir cümledir. İşlemek bir çeyrektir. Artçı hâlâ aktiftir.",
      "Working the inheritance",
      "Owning it is a sentence. Working it is a quarter. The aftershock is still active.",
      choice("work", "Artçıyı işle", "Work the aftershock", "Kapasite", { stageTo: 3, next: { eventId: "dc_gv_inh3", dueTurns: 36, key: "gv-inh3" } }),
      choice("wait", "Artçının inmesini bekle", "Wait for the aftershock to fall", "Erteleme", { stageTo: 3 })),
    later("dc_gv_inh3", { stage: 3, tags: ["government", "long", "memory"] },
      "Miras bir iz olur",
      "Kriz kapanmış görünür. Dossier 'kim yaptı' değil 'nasıl bir devlet kaldı' diye sorar.",
      "Inheritance becomes a trace",
      "The crisis looks closed. The dossier does not ask who did it; it asks what kind of state remained.",
      choice("trace", "İzi tut", "Keep the trace", "Hafıza", { stageTo: 4 }),
      choice("close", "Mirası kapat", "Close the inheritance", "Unutuş", { stageTo: 4 })),
  ],
});
push({
  id: "sf-kisla", arc: "form", exclusive: "form-spine", branch: "garrison",
  tags: ["form", "security", "institution", "cross"],
  nodes: [
    opening("dc_sf_kisla", { form: "Kışla-Devlet", tags: ["form", "security", "institution"] },
      "Güvenlik cümlesi masanın üstüne oturur",
      "Emir kısa, uygulama uzun. Sivil takvim dipnota iner. Bu bir darbe dosyası değildir; bir omurga eğilimidir.",
      "The security sentence sits on the desk",
      "The order is short, delivery is long. The civil calendar drops to a footnote. This is not a coup file; it is a spine tendency.",
      choice("garrison", "Omurgayı kabul et", "Accept the spine", "Düzen", { lock: "garrison", stageTo: 1, next: { eventId: "dc_sf_kisla2", dueTurns: 6, key: "sf-kisla2" } }),
      choice("civil", "Sivil satırı geri yaz", "Write the civil line back", "Müzakere", { lock: "garrison", stageTo: 9 })),
    later("dc_sf_kisla2", { tags: ["form", "memory", "security"] },
      "Uyarı: koordinasyon darboğazı",
      "İstihbarat brifingi 'darboğaz' yazar. Kurumlar tempo ister, müzakere kapanır. Çıkış henüz yoktur.",
      "A warning: coordination bottleneck",
      "The intelligence briefing writes bottleneck. Institutions want pace; negotiation closes. There is no exit yet.",
      choice("warn", "Darboğazı dosyala", "File the bottleneck", "Hafıza", { stageTo: 2, next: { eventId: "dc_sf_kisla3", dueTurns: 24, key: "sf-kisla3" } }),
      choice("hold", "Temposu tut", "Hold the pace", "Omurga", { stageTo: 2 })),
    later("dc_sf_kisla3", { stage: 3, tags: ["form", "long", "memory"] },
      "Sivil kalem geri gelir",
      "Güvenlik dosyası kapanmadı; yer değiştirdi. Devlet, kışla omurgasıyla yürüdü.",
      "The civil pen returns",
      "The security file did not close; it changed place. The state walked with a garrison spine.",
      choice("exit", "Çıkış cümlesini yaz", "Write an exit sentence", "Geçiş", { stageTo: 4 }),
      choice("persist", "Omurgayı tut", "Keep the spine", "Süreklilik", { stageTo: 4 })),
  ],
});
push({
  id: "sf-buro", arc: "form", exclusive: "form-spine", branch: "bureau",
  tags: ["form", "institution", "cross"],
  nodes: [
    opening("dc_sf_buro", { form: "Bürokrasi-Devlet", tags: ["form", "institution"] },
      "Dosya hükümetten uzun yaşar",
      "Tempo imza sırasına iner. Profesyonellik bir kalkan, yorgunluk da bir kalkan. İkisi aynı koridorda.",
      "The file outlives the government",
      "Pace falls to a signature queue. Professionalism is a shield and so is fatigue. Both live in the same corridor.",
      choice("bureau", "Dosyayı omurga say", "Treat the file as a spine", "Süreklilik", { lock: "bureau", stageTo: 1, next: { eventId: "dc_sf_buro2", dueTurns: 6, key: "sf-buro2" } }),
      choice("pace", "Siyasi temposu yaz", "Write a political pace", "Mandat", { lock: "bureau", stageTo: 9 })),
    later("dc_sf_buro2", { tags: ["form", "memory"] },
      "Uygulama yüzdesi şişer",
      "Saha binayı arar. Uyarı işareti budur: kâğıt tempo, boş koridor.",
      "The implementation percent swells",
      "The field looks for a building. That is the warning sign: paper pace, an empty corridor.",
      choice("field", "Sahayı yüzdeye bağla", "Tie the field to the percent", "Dürüstlük", { stageTo: 2, next: { eventId: "dc_sf_buro3", dueTurns: 36, key: "sf-buro3" } }),
      choice("paper", "Yüzdeyi tut", "Keep the percent", "Kâğıt", { stageTo: 2 })),
    later("dc_sf_buro3", { stage: 3, tags: ["form", "long"] },
      "Kalem direnir",
      "Siyasi tempo dosyayı ezmeye başlar. Bürokrasi-Devlet bir class değil, bir eğilimdir; çıkış da bir eğilimdir.",
      "The pen resists",
      "Political pace starts to crush the file. Bureaucracy-State is not a class; it is a tendency, and so is the exit.",
      choice("exit", "Siyasi temposu kabul et", "Accept the political pace", "Geçiş", { stageTo: 4 }),
      choice("persist", "Kalemi tut", "Keep the pen", "Kalkan", { stageTo: 4 })),
  ],
});
push({
  id: "sf-parti", arc: "form", exclusive: "form-mandate", branch: "party",
  tags: ["form", "government", "cadre", "cross"],
  nodes: [
    opening("dc_sf_parti", { form: "Parti-Devlet", tags: ["form", "government", "cadre"] },
      "Merkez, özerkliği tempo sanır",
      "Kadrolar aynı cümleyi ezberler. Mandat yüksek, özerklik alçak. Dosya partinin takvimine bakar.",
      "The centre mistakes autonomy for pace",
      "Cadres memorise the same sentence. Mandate is high, autonomy low. The file looks at the party's calendar.",
      choice("party", "Takvimi tut", "Hold the calendar", "Tempo", { lock: "party", stageTo: 1, next: { eventId: "dc_sf_parti2", dueTurns: 5, key: "sf-parti2" } }),
      choice("auto", "Özerklik dipnotu aç", "Open an autonomy footnote", "Kurum", { lock: "party", stageTo: 9 })),
    later("dc_sf_parti2", { tags: ["form", "memory", "cadre"] },
      "Liyakat CV'si, koridor sorusu",
      "Uyarı işareti: CV masada, koridor sadakat sorar. Bu bir class uzatması değildir.",
      "A merit CV, a corridor question",
      "Warning sign: the CV is on the desk, the corridor asks about loyalty. This is not a class being stretched.",
      choice("merit", "CV'yi tut", "Keep the CV", "Liyakat", { stageTo: 2, next: { eventId: "dc_sf_parti3", dueTurns: 24, key: "sf-parti3" } }),
      choice("loyal", "Koridoru dinle", "Listen to the corridor", "Sadakat", { stageTo: 2 })),
    later("dc_sf_parti3", { stage: 3, tags: ["form", "long"] },
      "Kurumlar kendi saatini kurar",
      "Çıkış: siyasi merkezin temposu gevşer. Parti-Devlet izi kalır, uzatılmaz.",
      "Institutions set their own clock",
      "Exit: the political centre's pace loosens. The Party-State trace remains; it is not prolonged.",
      choice("exit", "Kurum saatini kabul et", "Accept the institution clock", "Geçiş", { stageTo: 4 }),
      choice("hold", "Merkez takvimini tut", "Keep the centre calendar", "Mandat", { stageTo: 4 })),
  ],
});
push({
  id: "sf-pop", arc: "form", exclusive: "form-mandate", branch: "populist",
  tags: ["form", "media", "group", "cross"],
  nodes: [
    opening("dc_sf_pop", { form: "Popülist-Devlet", tags: ["form", "media", "group"] },
      "Hane rahatlatma, kurum tempo kaybı",
      "Rıza kısa, kasa uzun. Manşet iddiası dosyadan hızlı. Bu bir class değil; fatura geçtiğinde parçalanır.",
      "Household relief, institutional pace-loss",
      "Consent is short, the till is long. The headline claim is faster than the file. This is not a class; it fragments when the bill passes.",
      choice("populist", "Manşeti tut", "Keep the headline", "Rıza", { lock: "populist", stageTo: 1, next: { eventId: "dc_sf_pop2", dueTurns: 4, key: "sf-pop2" } }),
      choice("till", "Kasayı konuş", "Talk about the till", "Dürüstlük", { lock: "populist", stageTo: 9 })),
    later("dc_sf_pop2", { tags: ["form", "memory", "trust"] },
      "İstatistik özerkliği maliyet olur",
      "Uyarı: sayı siyasi maliyet olarak durur. Güven parçalanmaya başlar.",
      "Statistical autonomy becomes a cost",
      "Warning: the number sits as political cost. Trust starts to fragment.",
      choice("stat", "Sayıyı tut", "Keep the number", "Güven", { effects: { info: 1 }, stageTo: 2, next: { eventId: "dc_sf_pop3", dueTurns: 24, key: "sf-pop3" } }),
      choice("head", "Manşeti koru", "Protect the headline", "Rıza", { stageTo: 2 })),
    later("dc_sf_pop3", { stage: 3, tags: ["form", "long", "trust"] },
      "Fatura vaadi geçer",
      "Kira ve fatura manşeti geçer. Popülist eğilim uzatılmaz; iz kalır.",
      "The bill passes the promise",
      "Rent and the bill pass the headline. The populist tendency is not prolonged; a trace remains.",
      choice("exit", "Faturayı omurga say", "Treat the bill as a spine", "Geçiş", { stageTo: 4 }),
      choice("persist", "Manşeti arşivle", "Archive the headline", "Anlatı", { stageTo: 4 })),
  ],
});
push({
  id: "sf-sermaye", arc: "form",
  tags: ["form", "network", "group", "cross"],
  nodes: [
    opening("dc_sf_sermaye", { form: "Sermaye-Devlet", tags: ["form", "network", "group"] },
      "Yatırım cümlesi kamu cümlesinin önüne geçer",
      "İş dünyası güler, hane asık. İki güven endeksi aynı ayı tarif etmez.",
      "The investment sentence moves in front of the public sentence",
      "Business smiles, the household is grim. Two confidence indexes do not describe the same month.",
      choice("market", "Yatırımı omurga say", "Treat investment as a spine", "Piyasa", { stageTo: 1, next: { eventId: "dc_sf_sermaye2", dueTurns: 6, key: "sf-sermaye2" } }),
      choice("house", "Hane endeksini yanına yaz", "Write the household index beside it", "Denge", { stageTo: 2 })),
    later("dc_sf_sermaye2", { tags: ["form", "memory", "network"] },
      "Kredi ısınır, kırılganlık ötelenir",
      "Uyarı işareti budur. Fatura haneye ayrıca gelir.",
      "Credit warms, fragility is postponed",
      "That is the warning sign. The bill arrives separately to the household.",
      choice("cool", "Isıyı adlandır", "Name the heat", "İhtiyat", { stageTo: 3, next: { eventId: "dc_sf_sermaye3", dueTurns: 36, key: "sf-sermaye3" } }),
      choice("run", "Isıyı başarı say", "Count the heat as success", "Tempo", { stageTo: 3 })),
    later("dc_sf_sermaye3", { stage: 3, tags: ["form", "long", "network"] },
      "Piyasa homurdanır, kamu masaya döner",
      "Sermaye temposu omurga sandı; toplumsal rıza ayrı kaldı.",
      "The market growls, the public returns to the table",
      "Capital-pace was mistaken for a spine; social consent stayed apart.",
      choice("exit", "Kamu masasını aç", "Open the public table", "Geçiş", { stageTo: 4 }),
      choice("hold", "Yatırım cümlesini tut", "Keep the investment sentence", "Piyasa", { stageTo: 4 })),
  ],
});
push({
  id: "sf-cemaat", arc: "form",
  tags: ["form", "network", "cross"],
  nodes: [
    opening("dc_sf_cemaat", { form: "Cemaat-Devlet", tags: ["form", "network"] },
      "Ağ baskısı, kurum boşluğu",
      "Kaynak ve erişim yazılı yetkinin yanında yürür. İsimler resmi değil. Bu bir tarikat dosyası değil; bir ağ eğilimidir.",
      "Network pressure, an institutional gap",
      "Resources and access walk beside written authority. Names are not official. This is not an order file; it is a network tendency.",
      choice("watch", "Şartnameyi öne al, ağı izle", "Put the specification first, watch the network", "Kurum", { effects: { info: 1 }, stageTo: 1, next: { eventId: "dc_sf_cemaat2", dueTurns: 6, key: "sf-cemaat2" } }),
      choice("gap", "Boşluğu yok say", "Ignore the gap", "Sis", { stageTo: 9 })),
    later("dc_sf_cemaat2", { tags: ["form", "network", "memory"] },
      "Yüklenici halkası şartnameden önce konuşur",
      "Uyarı işareti. Profesyonel kalkan incelmiştir. Ağ resmi yetki değildir.",
      "The contractor ring speaks before the specification",
      "A warning sign. The professional shield has thinned. A network is not official authority.",
      choice("spec", "Şartnameyi kilitle", "Lock the specification", "Kalkan", { stageTo: 2, next: { eventId: "dc_sf_cemaat3", dueTurns: 24, key: "sf-cemaat3" } }),
      choice("ring", "Halkayı yok sayma", "Do not ignore the ring", "Şeffaflık", { stageTo: 2 })),
    later("dc_sf_cemaat3", { stage: 3, tags: ["form", "long", "network"] },
      "Kalkan incelir ya da kalınlaşır",
      "Çıkış: profesyonel kalkan inceldiği yerden ağ da incelir — ya da kalınlaşır. İz, resmi olmayan etki olarak kalır.",
      "The shield thins or thickens",
      "Exit: where the professional shield thinned the network also thins — or thickens. The trace remains as unofficial influence.",
      choice("exit", "Kalkanı kalınlaştır", "Thicken the shield", "Geçiş", { stageTo: 4 }),
      choice("persist", "Boşluğu kabul et", "Accept the gap", "Ağ", { stageTo: 4 })),
  ],
});
push({
  id: "sf-bos", arc: "form",
  tags: ["form", "crisis", "cross"],
  nodes: [
    opening("dc_sf_bos", { form: "Boş Kabuk", minEntropy: 55, tags: ["form", "crisis"] },
      "Karar var, uygulama yok",
      "Tabela duruyor, koridor boş. Entropy yüksek, kapasite düşük. Her dosya hayalet dosya gibi.",
      "There is a decision, there is no delivery",
      "The signboard stands, the corridor is empty. Entropy is high, capacity low. Every file feels like a ghost file.",
      choice("name", "Kabuğu adlandır", "Name the shell", "Dürüstlük", { stageTo: 1, next: { eventId: "dc_sf_bos2", dueTurns: 5, key: "sf-bos2" } }),
      choice("sign", "Tabelayı tut", "Keep the signboard", "Görünürlük", { stageTo: 9 })),
    later("dc_sf_bos2", { tags: ["form", "memory", "crisis"] },
      "Üç kriz, sahipsiz",
      "Uyarı: üç kriz aynı anda aktif; hiçbirinin sahibi yok. Karar üretmek yetmez.",
      "Three crises, no owner",
      "Warning: three crises active at once; none has an owner. Producing decisions is not enough.",
      choice("own", "Bir krize sahip yaz", "Write an owner for one crisis", "Tempo", { stageTo: 2, next: { eventId: "dc_sf_bos3", dueTurns: 24, key: "sf-bos3" } }),
      choice("all", "Üçünü de ilan et", "Announce all three", "Sis", { stageTo: 2 })),
    later("dc_sf_bos3", { stage: 3, tags: ["form", "long"] },
      "Bir kurum tempo alır",
      "Kabuk çatlar, devlet henüz dolmaz. Çıkış bir dolum değil, bir çatlaktır.",
      "One institution takes a pace",
      "The shell cracks; the state is not yet full. Exit is a crack, not a filling.",
      choice("fill", "Temposu çoğalt", "Multiply the pace", "Onarım", { stageTo: 4 }),
      choice("crack", "Çatlağı dosyala", "File the crack", "Hafıza", { stageTo: 4 })),
  ],
});
push({
  id: "rg-marmara", arc: "region", exclusive: "region-path", branch: "west",
  tags: ["region", "group", "development", "cross"],
  nodes: [
    opening("dc_rg_mar", { needRegion: "marmara", tags: ["region", "group", "development"] },
      "Kredi ısısı, şebeke yükü",
      "Marmara kredi yer, konut ısınır. Belediye yükü şişer. Batı 'başarı' der; şebeke 'kapasite' der. Bu bir isim yapıştırması değil: liman, tapu ve kira aynı koridorda sıkışır.",
      "Credit heat, a grid load",
      "Marmara eats credit, housing warms. Municipal load swells. The west says success; the grid says capacity. This is not a name-sticker: port, title and rent jam in the same corridor.",
      choice("west", "Şebeke payı yaz", "Write a grid share", "Altyapı", { lock: "west", stageTo: 1, next: { eventId: "dc_rg_mar2", dueTurns: 6, key: "rg-mar2" } }),
      choice("cool", "Isıyı adlandır, arzı beklet", "Name the heat, hold supply", "İhtiyat", { lock: "west", stageTo: 9 })),
    later("dc_rg_mar2", { tags: ["region", "memory", "development"] },
      "Kira ile tapu aynı dakikaya sığmaz",
      "Daire teslim konuşulur. Sözleşme başka dil. Liman tıkanır, ilçe otobüsü aynı tıkanıklığı taşır.",
      "Rent and title do not fit the same minute",
      "Handover is discussed. The contract is another language. The port clogs; the district bus carries the same clog.",
      choice("bus", "Yükü ilçeye yay", "Spread the load to the district", "Denge", { stageTo: 2, next: { eventId: "dc_rg_mar3", dueTurns: 36, key: "rg-mar3" } }),
      choice("port", "Limanı öne al", "Put the port first", "Dış", { stageTo: 2 })),
    later("dc_rg_mar3", { stage: 3, tags: ["region", "long", "development"] },
      "Isı alışkanlık olur",
      "Kredi ısısı bir omurga sandı. Göç çekimi kente kaymış, şebeke hâlâ aynı kesiti konuşur.",
      "Heat becomes a habit",
      "Credit heat was mistaken for a spine. Migration pull shifted to the city; the grid still talks the same cross-section.",
      choice("grid", "Kesiti büyüt", "Grow the cross-section", "Uzun yük", { stageTo: 4 }),
      choice("leave", "Isıyı piyasa say", "Treat the heat as the market", "Piyasa", { stageTo: 4 })),
  ],
});
push({
  id: "rg-dogu", arc: "region", exclusive: "region-path", branch: "east",
  tags: ["region", "development", "group", "cross"],
  nodes: [
    opening("dc_rg_dogu", { needRegion: "dogu", maxServices: 55, tags: ["region", "development", "group"] },
      "Kamu işi bekler, hizmet satırı ince",
      "Doğu'da kredi cümlesi kısa, kamu işi uzun. Marmara teşviki burada bir iş ilanı değildir; bir yol ve bir poliklinik bekler. İsim yapıştırması değil: kış kapalı, öğretmen kadrosu telgrafta.",
      "Public work waits, the service line is thin",
      "In the east the credit sentence is short and public work is long. A Marmara incentive is not a job ad here; a road and a clinic wait. Not a name-sticker: winter is closed, the teacher post is in a telegram.",
      choice("east", "Hizmet satırını aç", "Open the service line", "Adalet", { lock: "east", stageTo: 1, next: { eventId: "dc_rg_dogu2", dueTurns: 6, key: "rg-dogu2" } }),
      choice("credit", "Kredi cümlesini zorla", "Force a credit sentence", "Piyasa boşluğu", { lock: "east", stageTo: 9 })),
    later("dc_rg_dogu2", { tags: ["region", "memory", "development"] },
      "Yol yarım, poliklinik nöbeti eksik",
      "Pay aktarılmış görünür. Nöbet listesi boş. Göç çekimi kente kayar; kalan hane 'devlet yok' demez, 'devlet geç geliyor' der.",
      "A half road, a missing clinic night-shift",
      "The share looks transferred. The night-shift list is empty. Migration pull shifts to the city; the remaining household does not say there is no state, it says the state arrives late.",
      choice("staff", "Nöbeti kaydır", "Move a night shift", "Kapasite", { stageTo: 2, next: { eventId: "dc_rg_dogu3", dueTurns: 36, key: "rg-dogu3" } }),
      choice("road", "Yolu bitir, nöbeti sonra", "Finish the road, night-shift later", "Tabela", { stageTo: 2 })),
    later("dc_rg_dogu3", { stage: 3, tags: ["region", "long", "development"] },
      "On yıl, aynı geç geliş",
      "Yol vardır. Nöbet hâlâ eksik. İhmal bir teşvik satırıyla silinmez.",
      "Ten years, the same late arrival",
      "There is a road. The night shift is still missing. Neglect is not erased by an incentive line.",
      choice("clinic", "Nöbeti kalıcı yaz", "Write the night shift as permanent", "Uzun yük", { stageTo: 4 }),
      choice("leave", "Geç gelişi kabul et", "Accept the late arrival", "Unutuş", { stageTo: 4 })),
  ],
});
push({
  id: "ex-subsidy", arc: "external", exclusive: "external-path", branch: "subsidy",
  tags: ["external", "fiscal", "group", "cross"],
  nodes: [
    opening("dc_ex_sub", { minEnergy: 50, tags: ["external", "fiscal", "group"] },
      "Fatura yumuşar, dipnot dışarıda kalır",
      "Nuri Hazine faturayı siyaset sayar. Dış bağımlılık dipnotta. Rezerv tutmak başka bir cümledir; bu cümle haneyi öne alır.",
      "The bill softens, the footnote stays outside",
      "Nuri at Treasury treats the bill as politics. External dependence is in a footnote. Holding reserves is another sentence; this one puts the household first.",
      choice("subsidy", "Faturayı yumuşat", "Soften the bill", "Rıza", { lock: "subsidy", stageTo: 1, next: { eventId: "dc_ex_sub2", dueTurns: 4, key: "ex-sub2" }, effects: { heat: -2 } }),
      choice("note", "Dipnotu aç", "Open the footnote", "Dürüstlük", { lock: "subsidy", stageTo: 9, effects: { info: 1 } })),
    later("dc_ex_sub2", { tags: ["external", "memory", "fiscal"] },
      "Yumuşama bir mevsim, bağımlılık bir iz",
      "Hane sakinleşir. Enerji baskısı durmaz. Echo bir yıl sonra kasa satırında duyulur.",
      "Softening lasts a season, dependence is a trace",
      "The household calms. Energy pressure does not stop. The echo is heard a year later on the till line.",
      choice("cap", "Yumuşamaya tavan yaz", "Write a ceiling on the softening", "Disiplin", { stageTo: 2, next: { eventId: "dc_ex_sub3", dueTurns: 24, key: "ex-sub3" } }),
      choice("keep", "Yumuşamayı tut", "Keep the softening", "Rıza", { stageTo: 2 })),
    later("dc_ex_sub3", { stage: 3, tags: ["external", "long", "fiscal"] },
      "Fatura alışkanlık olur",
      "Rezerv başka koşulda tutulurdu. Bu koşulda hane öne alındı. İki yol aynı dövizi tarif etmedi.",
      "The bill becomes a habit",
      "Reserves would have been held in another condition. In this one the household was put first. Two paths did not describe the same currency.",
      choice("wean", "Yumuşamayı indir", "Lower the softening", "Çapa", { stageTo: 4 }),
      choice("habit", "Alışkanlığı kabul et", "Accept the habit", "Rıza", { stageTo: 4 })),
  ],
});
push({
  id: "rg-ege", arc: "region",
  tags: ["region", "development", "external", "cross"],
  nodes: [
    opening("dc_rg_ege", { needRegion: "ege", tags: ["region", "development", "external"] },
      "İhracat iskelesi, su kotası",
      "Ege'de sipariş defteri dolar, baraj kotası inmez. Turizm cümlesi su cümlesini yemez; ikisi aynı yazı aynı kuyuyu tarif etmez.",
      "An export quay, a water quota",
      "In the Aegean the order book fills; the dam quota does not. The tourism sentence does not eat the water sentence; the same summer does not describe the same well.",
      choice("water", "Kota payını yaz", "Write a quota share", "Su", { stageTo: 1, next: { eventId: "dc_rg_ege2", dueTurns: 5, key: "rg-ege2" } }),
      choice("quay", "İskeleyi öne al", "Put the quay first", "Dış", { stageTo: 2 })),
    later("dc_rg_ege2", { tags: ["region", "memory", "development"] },
      "Kuyu, tanker, manşet",
      "Tanker ilçeye iner. Manşet 'sezon' der. Çiftçi kuyu sayar.",
      "A well, a tanker, a headline",
      "The tanker enters the district. The headline says season. The farmer counts wells.",
      choice("well", "Kuyuyu dosyala", "File the well", "Hafıza", { stageTo: 3, next: { eventId: "dc_rg_ege3", dueTurns: 24, key: "rg-ege3" } }),
      choice("season", "Sezonu tut", "Keep the season", "Rıza", { stageTo: 3 })),
    later("dc_rg_ege3", { stage: 3, tags: ["region", "long", "development"] },
      "Sezon geçer, kuyu kalır",
      "İskele durur. Su izi mahallede yaşar.",
      "The season passes, the well remains",
      "The quay stands. The water trace lives in the neighbourhood.",
      choice("infra", "Su payını kalıcı yaz", "Write water as a lasting share", "Uzun yük", { stageTo: 4 }),
      choice("leave", "Sezonu arşivle", "Archive the season", "Unutuş", { stageTo: 4 })),
  ],
});
push({
  id: "rg-akdeniz", arc: "region",
  tags: ["region", "group", "development", "cross"],
  nodes: [
    opening("dc_rg_akd", { needRegion: "akdeniz", tags: ["region", "group", "development"] },
      "Sera, mevsimlik emek, tuzlu su",
      "Akdeniz'de sera dolar, işçi kuyruğu ilçede kurulur. Turizm aynı kuyuyu içer. Bu Ege kopyası değil: örtü altı ve mevsimlik yevmiye aynı günde konuşulur.",
      "Greenhouse, seasonal labour, salt water",
      "In the Mediterranean the greenhouse fills; a labour queue forms in the district. Tourism drinks the same well. This is not an Aegean copy: covered crop and daily wage are spoken on the same day.",
      choice("labor", "Yevmiye satırını yaz", "Write a wage line", "Emek", { stageTo: 1, next: { eventId: "dc_rg_akd2", dueTurns: 5, key: "rg-akd2" } }),
      choice("salt", "Tuzlu suyu öne al", "Put salt water first", "Su", { stageTo: 2 })),
    later("dc_rg_akd2", { tags: ["region", "memory", "group"] },
      "Sezon biter, kuyruk kalır",
      "Sera boşalır. İşçi 'dönüş' der. Belediye yükü inmez.",
      "The season ends, the queue remains",
      "The greenhouse empties. The worker says return. Municipal load does not fall.",
      choice("stay", "Kış payı yaz", "Write a winter share", "Hizmet", { stageTo: 3, next: { eventId: "dc_rg_akd3", dueTurns: 24, key: "rg-akd3" } }),
      choice("end", "Sezonu kapat", "Close the season", "Unutuş", { stageTo: 3 })),
    later("dc_rg_akd3", { stage: 3, tags: ["region", "long", "group"] },
      "Yevmiye bir iz olur",
      "Örtü altı büyümüştür. Mevsimlik emek hâlâ geçici yazılır.",
      "Daily wage becomes a trace",
      "Covered crop grew. Seasonal labour is still written as temporary.",
      choice("perm", "Geçiciyi kalıcı sayma", "Do not count temporary as permanent", "Adalet", { stageTo: 4 }),
      choice("flex", "Mevsimi tut", "Keep the season", "Piyasa", { stageTo: 4 })),
  ],
});
push({
  id: "rg-karadeniz", arc: "region",
  tags: ["region", "development", "group", "cross"],
  nodes: [
    opening("dc_rg_krd", { needRegion: "karadeniz", tags: ["region", "development", "group"] },
      "Fındık deposu, heyelan yolu, giden genç",
      "Karadeniz'de depo dolar, yol kayar. Genç iş ilanı kenttedir. Bu Doğu kopyası değil: yağış, depo rutubeti ve feribot aynı dosyadır.",
      "A hazelnut warehouse, a landslide road, departing youth",
      "In the Black Sea the warehouse fills, the road slips. The youth job ad is in the city. This is not an east copy: rain, warehouse damp and the ferry are the same file.",
      choice("road", "Yolu tut", "Hold the road", "Altyapı", { stageTo: 1, next: { eventId: "dc_rg_krd2", dueTurns: 6, key: "rg-krd2" } }),
      choice("youth", "İlk iş satırını yaz", "Write a first-job line", "Gençler", { stageTo: 2 })),
    later("dc_rg_krd2", { tags: ["region", "memory", "development"] },
      "Depo rutubeti, feribot seferi",
      "Ürün bekler. Sefer iptal. Lojistik bir manşet değil, bir nem ölçüsüdür.",
      "Warehouse damp, a ferry sailing",
      "The crop waits. The sailing is cancelled. Logistics is not a headline; it is a measure of damp.",
      choice("dry", "Depoyu kurut", "Dry the warehouse", "Kalite", { stageTo: 3, next: { eventId: "dc_rg_krd3", dueTurns: 36, key: "rg-krd3" } }),
      choice("sail", "Seferi öne al", "Put the sailing first", "Tempo", { stageTo: 3 })),
    later("dc_rg_krd3", { stage: 3, tags: ["region", "long", "group"] },
      "Giden genç dönmez",
      "Yol düzelmiş olabilir. İş ilanı hâlâ kenttedir. Göç bir aile değil, bir depo ve bir vapurdur.",
      "The departing youth do not return",
      "The road may have been fixed. The job ad is still in the city. Migration is not a family; it is a warehouse and a steamer.",
      choice("job", "İlçe iş satırını tut", "Keep a district job line", "Uzun yük", { stageTo: 4 }),
      choice("accept", "Gidişi kabul et", "Accept the departure", "Unutuş", { stageTo: 4 })),
  ],
});
push({
  id: "rg-guneydogu", arc: "region",
  tags: ["region", "development", "group", "cross"],
  nodes: [
    opening("dc_rg_gd", { needRegion: "guneydogu", tags: ["region", "development", "group"] },
      "Kuyu iner, belediye yükü, genç kuyruğu",
      "Güneydoğu'da kuraklık bir iklim cümlesi değil, bir kuyu ve bir sulama nöbetidir. Belediye tanker sayar; gençler iş ilanı sayar. Doğu kopyası değil: ova, sınır kapısı ve gece sulaması aynı sıcakta.",
      "The well drops, municipal load, a youth queue",
      "In the southeast drought is not a climate sentence; it is a well and an irrigation night-shift. The municipality counts tankers; youth count job ads. Not an east copy: plain, border gate and night watering in the same heat.",
      choice("well", "Sulama nöbetini yaz", "Write an irrigation night-shift", "Su", { stageTo: 1, next: { eventId: "dc_rg_gd2", dueTurns: 5, key: "rg-gd2" } }),
      choice("job", "İş kuyruğunu öne al", "Put the job queue first", "Gençler", { stageTo: 2 })),
    later("dc_rg_gd2", { tags: ["region", "memory", "development"] },
      "Tanker, kapı, yevmiye",
      "Sınır kapısı ticaret konuşur. Ova tanker bekler. İki cümle aynı sıcağı tarif etmez.",
      "A tanker, a gate, a daily wage",
      "The border gate talks trade. The plain waits for a tanker. Two sentences do not describe the same heat.",
      choice("tank", "Tanker payını tut", "Keep the tanker share", "Hizmet", { stageTo: 3, next: { eventId: "dc_rg_gd3", dueTurns: 24, key: "rg-gd3" } }),
      choice("gate", "Kapıyı tut", "Hold the gate", "Dış", { stageTo: 3 })),
    later("dc_rg_gd3", { stage: 3, tags: ["region", "long", "development"] },
      "Kuyu bir iz olur",
      "Kapı açık kalmış olabilir. Kuyu inmişse devlet geç gelir cümlesi durur.",
      "The well becomes a trace",
      "The gate may have stayed open. If the well dropped, the sentence that the state arrives late remains.",
      choice("perm", "Nöbeti kalıcı yaz", "Write the shift as permanent", "Uzun yük", { stageTo: 4 }),
      choice("leave", "Sıcağı mevsim say", "Count the heat as a season", "Unutuş", { stageTo: 4 })),
  ],
});
push({
  id: "rg-icanadolu", arc: "region",
  tags: ["region", "development", "group", "cross"],
  nodes: [
    opening("dc_rg_ica", { needRegion: "ic-anadolu", tags: ["region", "development", "group"] },
      "Silo, kurak yaz, Ankara-Konya çekimi",
      "İç Anadolu'da silo dolar, yağış inmez. Bu köy yolu zinciri değil: tahıl koridoru kent çekimine yenilir. Hasan Bey'in kredi vaadi hasadı öne çeker, silo nemi ayrı dosyadır.",
      "A silo, a dry summer, Ankara-Konya pull",
      "In Central Anatolia the silo fills, rainfall does not. This is not the village-road chain: the grain corridor loses to urban pull. Hasan's credit promise brings the harvest forward; silo damp is a separate file.",
      choice("silo", "Nemi ölç, krediyi beklet", "Measure damp, hold credit", "Kalite", { stageTo: 1, next: { eventId: "dc_rg_ica2", dueTurns: 6, key: "rg-ica2" } }),
      choice("credit", "Krediyi öne al", "Bring credit forward", "Rıza", { stageTo: 2 })),
    later("dc_rg_ica2", { tags: ["region", "memory", "group"] },
      "Hasat, nem, giden hane",
      "Ürün siloda. Nem yüksek. Genç hane kente bakır. Yol afişi bunu tarif etmez.",
      "Harvest, damp, a departing household",
      "The crop is in the silo. Damp is high. A young household looks to the city. A road poster does not describe this.",
      choice("dry", "Silo payı yaz", "Write a silo share", "Altyapı", { stageTo: 3, next: { eventId: "dc_rg_ica3", dueTurns: 36, key: "rg-ica3" } }),
      choice("move", "Göçü istatistik say", "Count migration as a statistic", "Sis", { stageTo: 3 })),
    later("dc_rg_ica3", { stage: 3, tags: ["region", "long", "development"] },
      "Koridor kente yenilir",
      "Silo durur. Çekim Ankara-Konya'dadır. Tahıl omurga sandı; nem ve göç ayrı kaldı.",
      "The corridor loses to the city",
      "The silo stands. Pull is on the Ankara-Konya line. Grain was mistaken for a spine; damp and migration stayed apart.",
      choice("keep", "Silo hattını tut", "Keep the silo line", "Uzun yük", { stageTo: 4 }),
      choice("let", "Çekimi kabul et", "Accept the pull", "Kent", { stageTo: 4 })),
  ],
});

push({
  id: "in-istihbarat-alt", arc: "intelligence", era: "2002", tags: ["institution", "cadre", "cross", "intelligence"],
  nodes: [
    opening("dc_in_istihbarat", { era: "2002", needInst: "istikhbarat", needCadre: "istikhbarat", minFatigue: 8, tags: ["institution", "cadre", "intelligence"] },
      "Brifing masası, kanal sessizliği",
      "Leyla Koordinasyon brifingi zamanında ister. Üç kanal aynı sabah susar. Sessizlik de bir bilgidir; yazılmazsa ısı olur. Sentez yok, yığın var. Uyarı doğruluğu, kanalın açık kalmasına bağlıdır.",
      "A briefing desk, channel silence",
      "Leyla Coordination wants the briefing on time. Three channels go quiet the same morning. Silence is also information; if it is not written it becomes heat. There is no synthesis, there is a pile. Warning accuracy depends on the channel staying open.",
      choice("brief", "Brifingi aç, suskun kanalı yaz", "Open the briefing, write the silent channel", "Bilgi kalitesi", { lock: "brief", effects: { info: 2 }, stageTo: 1, next: { eventId: "dc_in_istihbarat2", dueTurns: 5, key: "in-istihbarat2" }, echo: "Sessizlik yazıldı; yığın sentez olmadı." }),
      choice("silence", "Kanalları kıs, sessizliği bilgi sayma", "Lower the channels, do not count silence as information", "Sis; darboğaz", { lock: "silence", effects: { rumor: 2 }, stageTo: 1, next: { eventId: "dc_in_istihbarat2", dueTurns: 5, key: "in-istihbarat2" } })),
    later("dc_in_istihbarat2", { era: "2002", needInst: "istikhbarat", tags: ["intelligence", "memory", "institution"] },
      "Koordinasyon darboğazı, üç masa",
      "Leyla 'uyarı geldi' der. Üç masa aynı zarfı bekler. Darboğaz bir koridordur: brifing birikir, sentez gecikir. Koordinasyon tıkanınca doğruluk da bekler.",
      "A coordination bottleneck, three desks",
      "Leyla says the warning arrived. Three desks wait for the same envelope. The bottleneck is a corridor: briefings pile up, synthesis is late. When coordination clogs, accuracy waits too.",
      choice("coord", "Masaları birleştir, zarfı tek yaz", "Join the desks, write one envelope", "Sentez", { effects: { info: 1 }, stageTo: 3, next: { eventId: "dc_in_istihbarat3", dueTurns: 24, key: "in-istihbarat3" } }),
      choice("pile", "Yığını tut, her masa kendi notu", "Keep the pile, each desk its own note", "Darboğaz", { effects: { rumor: 1 }, stageTo: 3, next: { eventId: "dc_in_istihbarat3", dueTurns: 36, key: "in-istihbarat3" } })),
    later("dc_in_istihbarat3", { stage: 3, era: "2002", tags: ["intelligence", "long", "memory"] },
      "Sentez cümlesi, uyarı izi",
      "Yıllar sonra brifing alışkanlığı durur. Leyla belirsizliği abartmamaya çalışır. Sentez yapılmışsa uyarı bir cümledir; yapılmamışsa üç not aynı krizi ayrı tarif eder. Bilgi kalitesi, o cümlenin sahibi olup olmamasıdır.",
      "A synthesis sentence, a warning trace",
      "Years later the briefing habit remains. Leyla tries not to overstate uncertainty. If synthesis happened the warning is one sentence; if not, three notes describe the same crisis apart. Information quality is whether that sentence has an owner.",
      choice("own", "Sentez cümlesine sahip çık", "Own the synthesis sentence", "Kurum", { effects: { info: 1 }, stageTo: 4 }),
      choice("notes", "Üç notu arşivle, cümleyi bırak", "Archive the three notes, leave the sentence", "Unutuş", { stageTo: 4 })),
  ],
});

push({
  id: "in-ist-warn-alt", arc: "intelligence", era: ["2002", "gunumuz"], tags: ["intelligence", "cross"],
  nodes: [
    later("dc_in_ist_warn", { organic: true, stage: 2, era: ["2002", "gunumuz"], needInst: "istikhbarat", minTurn: 4, tags: ["intelligence"] },
      "Uyarı doğruluğu, geç kalan not",
      "Leyla hattı uyarıyı teknik doğru yazar. Not üç gün geç masaya iner. Doğruluk zamanında değilse ısı olur. Sessiz kanal, yanlış cümleden pahalıdır.",
      "Warning accuracy, a late note",
      "Leyla's line writes the warning as technically correct. The note reaches the desk three days late. Accuracy that is not on time becomes heat. A silent channel costs more than a wrong sentence.",
      choice("time", "Gecikmeyi doğruluk satırına yaz", "Write the delay onto the accuracy line", "Bilgi", { effects: { info: 1 }, stageTo: 2, next: { eventId: "dc_in_ist_warn2", dueTurns: 6, key: "in-ist-warn2" } }),
      choice("late", "Notu doğru say, saati unut", "Count the note correct, forget the hour", "Sis", { effects: { rumor: 1 }, stageTo: 9 })),
    later("dc_in_ist_warn2", { stage: 3, era: ["2002", "gunumuz"], tags: ["intelligence", "long", "memory"] },
      "Geç uyarı bir hafıza olur",
      "Kriz geçtikten sonra not 'doğruydu' denir. Masa o üç günü unutmaz. Uyarı doğruluğu, saatsiz bir cümle değildir.",
      "A late warning becomes a memory",
      "After the crisis the note is called correct. The desk does not forget those three days. Warning accuracy is not a sentence without a clock.",
      choice("clock", "Saati şablona ekle", "Add the clock to the template", "Kurum", { stageTo: 4 }),
      choice("close", "Doğruyu kapat", "Close the correctness", "Unutuş", { stageTo: 4 })),
  ],
});

push({
  id: "in-ist-coord", arc: "intelligence", era: ["2002", "gunumuz"], tags: ["intelligence", "cross"],
  nodes: [
    later("dc_in_ist_coord", { organic: true, stage: 2, era: ["2002", "gunumuz"], needInst: "istikhbarat", minTurn: 5, tags: ["intelligence"] },
      "Koordinasyon tıkanması, tek zarf",
      "Üç kurum aynı uyarıyı ayrı koridordan yürütür. Leyla 'koordinasyon' der; zarf fotokopide kaybolur. Darboğaz kötü niyet değildir — imza sırasıdır.",
      "A coordination jam, one envelope",
      "Three institutions walk the same warning down separate corridors. Leyla says coordination; the envelope is lost at the photocopier. The bottleneck is not ill will — it is a signature queue.",
      choice("one", "Tek zarf, tek imza sırası", "One envelope, one signature queue", "Tempo", { effects: { info: 1 }, stageTo: 2, next: { eventId: "dc_in_ist_coord2", dueTurns: 7, key: "in-ist-coord2" } }),
      choice("copy", "Fotokopiyi çoğalt, her koridor kendi", "Multiply the copies, each corridor its own", "Dağılım", { effects: { rumor: 1 }, stageTo: 9 })),
    later("dc_in_ist_coord2", { stage: 3, era: ["2002", "gunumuz"], tags: ["intelligence", "long", "memory"] },
      "İmza sırası bir refleks olur",
      "Yıllar sonra aynı uyarı yine üç koridora düşer. Koordinasyon alışkanlık olmadıysa darboğaz kurumdur. Leyla hâlâ tek zarf ister.",
      "The signature queue becomes a reflex",
      "Years later the same warning falls into three corridors again. If coordination did not become a habit the bottleneck is the institution. Leyla still wants one envelope.",
      choice("habit", "Tek zarfı alışkanlık yaz", "Write the single envelope as habit", "Kurum", { stageTo: 4 }),
      choice("leave", "Koridorları bırak", "Leave the corridors", "Süreklilik", { stageTo: 4 })),
  ],
});

push({
  id: "in-ist-assess", arc: "intelligence", era: ["2002", "gunumuz"], tags: ["intelligence", "cross"],
  nodes: [
    later("dc_in_ist_assess", { organic: true, stage: 2, era: ["2002", "gunumuz"], needInst: "istikhbarat", minTurn: 6, tags: ["intelligence"] },
      "Stratejik değerlendirme, üç dipnot",
      "Leyla sentez paragrafı ister. Masa üç dipnotla gelir. Değerlendirme, yığının toplamı değildir; sahibin cümlesidir. Belirsizlik abartılmadan da yazılır.",
      "A strategic assessment, three footnotes",
      "Leyla wants a synthesis paragraph. The desk arrives with three footnotes. Assessment is not the sum of the pile; it is the owner's sentence. Uncertainty can be written without being inflated.",
      choice("para", "Paragrafı yaz, dipnotu altında tut", "Write the paragraph, keep footnotes under it", "Sentez", { effects: { info: 1 }, stageTo: 2, next: { eventId: "dc_in_ist_assess2", dueTurns: 8, key: "in-ist-assess2" } }),
      choice("foot", "Dipnotları bırak, paragrafı ertele", "Leave the footnotes, defer the paragraph", "Yığın", { effects: { rumor: 1 }, stageTo: 9 })),
    later("dc_in_ist_assess2", { stage: 3, era: ["2002", "gunumuz"], tags: ["intelligence", "long", "memory"] },
      "Değerlendirme bir iz bırakır",
      "Kriz bittikten sonra hangi cümlenin sahipliği konuşulur. Sentez yapılmışsa arşiv bir paragraftır; yapılmamışsa üç dipnot aynı boşluğu tarif eder.",
      "The assessment leaves a trace",
      "After the crisis people argue which sentence had an owner. If synthesis happened the archive is a paragraph; if not, three footnotes describe the same gap.",
      choice("archive", "Paragrafı arşivle", "Archive the paragraph", "Hafıza", { stageTo: 4 }),
      choice("gap", "Boşluğu kapatma", "Do not close the gap", "Sükût", { stageTo: 4 })),
  ],
});

push({
  id: "in-ist-risk", arc: "intelligence", era: ["2002", "gunumuz"], tags: ["intelligence", "cross"],
  nodes: [
    later("dc_in_ist_risk", { organic: true, stage: 2, era: ["2002", "gunumuz"], needInst: "istikhbarat", minTurn: 7, tags: ["intelligence"] },
      "Risk sentezi, belirsizlik dozu",
      "Leyla belirsizliği abartmamaya çalışır. Masa ya her şeyi kriz yazar ya hiçbir şeyi. Sentez, doz işidir: az yazılırsa uyarı kaçırılır, çok yazılırsa ısı üretilir.",
      "Risk synthesis, a dose of uncertainty",
      "Leyla tries not to overstate uncertainty. The desk either writes everything as crisis or nothing. Synthesis is a matter of dose: too little and the warning is missed, too much and heat is produced.",
      choice("dose", "Dozu orta yaz, belirsizliği adlandır", "Write a middle dose, name the uncertainty", "Kalite", { effects: { info: 1 }, stageTo: 2, next: { eventId: "dc_in_ist_risk2", dueTurns: 5, key: "in-ist-risk2" } }),
      choice("high", "Her boşluğu kriz yaz", "Write every gap as crisis", "Isı", { effects: { heat: 2 }, stageTo: 9 })),
    later("dc_in_ist_risk2", { stage: 3, era: ["2002", "gunumuz"], tags: ["intelligence", "long", "memory"] },
      "Doz bir refleks olur",
      "Bir sonraki dosyada masa yine abartı ile sükût arasında sallanır. Risk sentezi alışkanlık olmadıysa her belirsizlik ya panik ya körlük olur.",
      "Dose becomes a reflex",
      "On the next file the desk again sways between overstatement and silence. If risk synthesis did not become a habit every uncertainty is either panic or blindness.",
      choice("rule", "Doz kuralını yaz", "Write a dose rule", "Kurum", { stageTo: 4 }),
      choice("swing", "Sallanmayı bırak", "Leave the sway", "Alışkanlık", { stageTo: 4 })),
  ],
});

push({
  id: "in-ist-bureau", arc: "intelligence", era: ["2002", "gunumuz"], tags: ["intelligence", "cross"],
  nodes: [
    later("dc_in_ist_bureau", { organic: true, stage: 2, era: ["2002", "gunumuz"], needInst: "istikhbarat", minTurn: 8, tags: ["intelligence"] },
      "Bürokratik darboğaz, brifing kuyruğu",
      "Uyarı kapıdadır. Paraf sırası üç katta yürür. Leyla 'kanal tıkalı' der; tıkalı olan istihbarat değil, evrak. Bilgi kalitesi kuyrukta düşer.",
      "A bureaucratic bottleneck, a briefing queue",
      "The warning is at the door. The initial queue walks three floors. Leyla says the channel is clogged; what is clogged is not intelligence, it is paperwork. Information quality falls in the queue.",
      choice("skip", "Parafı kısalt, brifingi indirme", "Shorten the initial, do not drop the briefing", "Tempo", { effects: { info: 1 }, stageTo: 2, next: { eventId: "dc_in_ist_bureau2", dueTurns: 8, key: "in-ist-bureau2" } }),
      choice("queue", "Kuyruğu usul say", "Count the queue as procedure", "Usul", { effects: { rumor: 1 }, stageTo: 9 })),
    later("dc_in_ist_bureau2", { stage: 3, era: ["2002", "gunumuz"], tags: ["intelligence", "long", "memory"] },
      "Paraf katı bir omurga olur",
      "Yıllar sonra aynı uyarı yine üç kat çıkar. Bürokratik darboğaz güvenlik cümlesi sanılır. Leyla hâlâ indirmeyi ister.",
      "The initial floor becomes a spine",
      "Years later the same warning still climbs three floors. A bureaucratic bottleneck is mistaken for a security sentence. Leyla still wants it brought down.",
      choice("down", "İndirme kuralını yaz", "Write a bring-down rule", "Kurum", { stageTo: 4 }),
      choice("floor", "Katı tut", "Keep the floor", "Usul", { stageTo: 4 })),
  ],
});

push({
  id: "gv-turnover-alt", arc: "government", era: ["2002", "gunumuz"], tags: ["government", "cadre", "memory", "cross"],
  nodes: [
    opening("dc_gv_turnover", { era: ["2002", "gunumuz"], tags: ["government", "cadre", "memory"] },
      "Hükümet değişir, dosya kalır",
      "Kabine yenilenir. Nuri Hazine açık dosyayı yeni isme devreder gibi durur; kalem aynı satırı tutar. Devlet, koltuğu değil klasörü taşır. Cadre koridorda, hükümet afiştedir.",
      "The government changes, the file remains",
      "The cabinet is renewed. Nuri Treasury looks as if it is handing the open file to a new name; the pen keeps the same line. The state carries the folder, not the chair. The cadre is in the corridor; the government is on the poster.",
      choice("keep", "Klasörü tut, isimleri değiştirme", "Keep the folder, do not change the names", "Süreklilik", { stageTo: 1, next: { eventId: "dc_gv_turnover2", dueTurns: 5, key: "gv-turnover2" }, echo: "Hükümet değişti, kalem aynı kaldı." }),
      choice("rename", "İsimleri kaydır, klasörü yeni say", "Move the names, treat the folder as new", "Tempo; yorgunluk", { effects: { heat: 1 }, stageTo: 9 })),
    later("dc_gv_turnover2", { era: ["2002", "gunumuz"], tags: ["government", "memory", "cadre"] },
      "Yeni afiş, eski satır",
      "Resmî ses 'yeni dönem' der. Koridor aynı evrak numarasını okur. İkisi de doğrudur; devlet hafızası hükümetten uzundur.",
      "A new poster, an old line",
      "The official voice says a new period. The corridor reads the same document number. Both are true; state memory is longer than government.",
      choice("number", "Evrak numarasını açık tut", "Keep the document number in the open", "Hafıza", { effects: { info: 1 }, stageTo: 3, next: { eventId: "dc_gv_turnover3", dueTurns: 24, key: "gv-turnover3" } }),
      choice("period", "Yeni dönem cümlesini tut", "Keep the new-period sentence", "Anlatı", { stageTo: 3 })),
    later("dc_gv_turnover3", { stage: 3, era: ["2002", "gunumuz"], tags: ["government", "long", "memory"] },
      "İki kabine, aynı klasör",
      "Afişler değişmiştir. Klasör şişmiştir. Cadre 'devam' der. Devlet, hükümet değişimini bir kapak saydı; iç sayfa durdu.",
      "Two cabinets, the same folder",
      "The posters have changed. The folder has swollen. The cadre says continue. The state treated the government change as a cover; the inner page stayed.",
      choice("page", "İç sayfayı arşivle", "Archive the inner page", "Hafıza", { stageTo: 4 }),
      choice("cover", "Kapağı yenile", "Renew the cover", "Siyaset", { stageTo: 4 })),
  ],
});

push({
  id: "gv-mandate-alt", arc: "government", era: ["2002", "gunumuz"], tags: ["government", "cadre", "memory", "cross"],
  nodes: [
    opening("dc_gv_mandate", { era: ["2002", "gunumuz"], tags: ["government", "cadre", "memory"] },
      "Mandat yüksek, kapasite alçak",
      "Siyasi sermaye dolu durur. Cemil Vali hattı 'tempo' der; üç kurum yorgunluk yazar. Mandat bir yüzde değildir — uygulama binasıdır. Oyuncu devlettir; hükümet cümlesi kapasiteyi yaratmaz.",
      "Mandate high, capacity low",
      "Political capital looks full. Cemil Vali's line says pace; three institutions write fatigue. Mandate is not a percentage — it is the implementation building. The player is the state; a government sentence does not create capacity.",
      choice("cap", "Kapasite satırını mandatın üstüne yaz", "Write the capacity line above the mandate", "Kurum", { effects: { info: 1 }, stageTo: 1, next: { eventId: "dc_gv_mandate2", dueTurns: 6, key: "gv-mandate2" }, echo: "Mandat kapasiteyi doğurmadı; yorgunluk onu yedi." }),
      choice("mandate", "Mandatı konuş, yorgunluğu dipnota it", "Talk the mandate, footnote the fatigue", "Anlatı", { effects: { rumor: 1 }, stageTo: 9 })),
    later("dc_gv_mandate2", { era: ["2002", "gunumuz"], tags: ["government", "memory"] },
      "Sermaye erir, dosya durur",
      "Halk desteği incelir. Klasör aynı kalır. Cadre 'zaten yazılmıştı' der. Mandat bitince devlet, kapasitesiz cümlelerle kalır.",
      "Capital thins, the file stays",
      "Public support thins. The folder stays the same. The cadre says it was already written. When the mandate ends the state is left with sentences that have no capacity.",
      choice("file", "Dosyayı sadeleştir, tempo isteği kes", "Simplify the file, cut the demand for pace", "Sürdürme", { effects: { heat: -1 }, stageTo: 3, next: { eventId: "dc_gv_mandate3", dueTurns: 36, key: "gv-mandate3" } }),
      choice("push", "Mandat bitene kadar it", "Push until the mandate ends", "Yorgunluk", { effects: { heat: 1 }, stageTo: 3 })),
    later("dc_gv_mandate3", { stage: 3, era: ["2002", "gunumuz"], tags: ["government", "long", "memory"] },
      "Mandat biter, kurum kalır",
      "Seçilmiş irade kayar. Bürokrasi dosyayı tanır. Devlet, yüksek mandatı omurga sandı; omurga yorgunluktı.",
      "The mandate ends, the institution remains",
      "Elected will slips. The bureaucracy recognises the file. The state treated a high mandate as a spine; the spine was fatigue.",
      choice("inst", "Kurum temposunu geri yaz", "Write institutional pace back in", "Süreklilik", { stageTo: 4 }),
      choice("wait", "Yeni mandatı bekle", "Wait for a new mandate", "Boşluk", { stageTo: 4 })),
  ],
});

push({
  id: "gv-coalition-alt", arc: "government", era: ["2002", "gunumuz"], tags: ["government", "cadre", "memory", "cross"],
  nodes: [
    opening("dc_gv_coalition", { era: ["2002", "gunumuz"], tags: ["government", "cadre", "memory"] },
      "Koalisyon protokolü, koridor baskısı",
      "Protokol üç madde yazar. Koridor beş istisna fısıldar. Koalisyon baskısı bir yüzde değil, imza gecikmesidir. Devlet tarafı partiler değil; dosyanın sahibidir.",
      "A coalition protocol, corridor pressure",
      "The protocol writes three articles. The corridor whispers five exceptions. Coalition pressure is not a percentage, it is a delayed signature. The state's side is not the parties; it is the owner of the file.",
      choice("proto", "Protokolü tut, istisnayı yazma", "Hold the protocol, do not write the exception", "Netlik; baskı", { effects: { heat: 1 }, stageTo: 1, next: { eventId: "dc_gv_coalition2", dueTurns: 4, key: "gv-coalition2" } }),
      choice("whisper", "İstisnayı dipnota al, imzayı yürüt", "Take the exception as a footnote, move the signature", "Tempo; sis", { effects: { rumor: 1 }, stageTo: 9 })),
    later("dc_gv_coalition2", { era: ["2002", "gunumuz"], tags: ["government", "memory"] },
      "İmza gecikir, madde şişer",
      "Üç madde beş olur. Cadre 'uygulama' der; her istisna bir veto gibi durur. Baskı, hükümeti değil klasörü yorar.",
      "The signature is late, the article swells",
      "Three articles become five. The cadre says implementation; each exception sits like a veto. The pressure tires the folder, not the government.",
      choice("cut", "Maddeyi üçe indir", "Cut the articles back to three", "Sade", { effects: { heat: -1 }, stageTo: 3, next: { eventId: "dc_gv_coalition3", dueTurns: 24, key: "gv-coalition3" } }),
      choice("five", "Beşi yürüt, herkese pay", "Run all five, a share for everyone", "Dağılım", { stageTo: 3 })),
    later("dc_gv_coalition3", { stage: 3, era: ["2002", "gunumuz"], tags: ["government", "long", "memory"] },
      "Protokol bir alışkanlık olur",
      "Hükümet dağılsa da istisna cümlesi durur. Devlet, koalisyon baskısını geçici sandı; kalem onu şablon yaptı.",
      "The protocol becomes a habit",
      "Even if the government dissolves the exception-sentence remains. The state treated coalition pressure as temporary; the pen made it a template.",
      choice("template", "İstisna şablonunu sil", "Erase the exception template", "Kurum", { stageTo: 4 }),
      choice("keep", "Şablonu devret", "Hand the template on", "Süreklilik", { stageTo: 4 })),
  ],
});

push({
  id: "gv-inherit-alt", arc: "government", era: ["2002", "gunumuz"], tags: ["government", "cadre", "memory", "cross"],
  nodes: [
    opening("dc_gv_inherit", { era: ["2002", "gunumuz"], minTurn: 10, tags: ["government", "cadre", "memory"] },
      "Devralınan açık dosya",
      "Yeni kabine masaya oturur. Eski açık dosyalar gülümser gibi durur: fatura, kira, yarı iş. Nuri 'bu bizim değil' der. Devlet için bizim olmayan dosya yoktur — sadece gecikmiş satır vardır.",
      "An inherited open file",
      "The new cabinet sits down. The old open files look as if they are smiling: a bill, the rent, a half-job. Nuri says this is not ours. For the state there is no file that is not ours — only a late line.",
      choice("own", "Dosyayı sahiplen, gecikmeyi yaz", "Own the file, write the delay", "Hafıza", { effects: { info: 1, heat: 1 }, stageTo: 1, next: { eventId: "dc_gv_inherit2", dueTurns: 7, key: "gv-inherit2" }, echo: "Devralınan dosya yeni hükümetin değildi; devletin idi." }),
      choice("theirs", "Eski satırı onların say", "Count the old line as theirs", "Unutuş", { effects: { rumor: 1 }, stageTo: 9 })),
    later("dc_gv_inherit2", { era: ["2002", "gunumuz"], tags: ["government", "memory"] },
      "Yarı iş, tam fatura",
      "Keşif bitmemiştir. Fatura gelmiştir. Cadre 'devam' ile 'iptal' arasında salınır. Miras, seçilmiş iradenin değil kurumun problemidir.",
      "A half-job, a full bill",
      "The survey is unfinished. The bill has arrived. The cadre sways between continue and cancel. Inheritance is the institution's problem, not the elected will's.",
      choice("continue", "Yarı işi bitir, faturayı taşı", "Finish the half-job, carry the bill", "Yük", { stageTo: 3, next: { eventId: "dc_gv_inherit3", dueTurns: 36, key: "gv-inherit3" } }),
      choice("cancel", "İşin üstünü ört, faturayı taksit", "Cover the job, instalment the bill", "Sis", { effects: { rumor: 1 }, stageTo: 3 })),
    later("dc_gv_inherit3", { stage: 3, era: ["2002", "gunumuz"], tags: ["government", "long", "memory"] },
      "Miras bir omurga olur",
      "Üç kabine sonra aynı yarı iş hâlâ açıktır. Devlet, hükümet değişimini temizlik sandı; klasör kimseyi dinlemedi.",
      "Inheritance becomes a spine",
      "Three cabinets later the same half-job is still open. The state treated government change as a cleaning; the folder listened to no one.",
      choice("close", "Dosyayı kapat, izi bırak", "Close the file, leave the trace", "Hafıza", { stageTo: 4 }),
      choice("carry", "Yarı işi dördüncüye devret", "Hand the half-job to a fourth", "Süreklilik", { stageTo: 4 })),
  ],
});

push({
  id: "sf-kisla-alt", arc: "form", era: ["2002", "gunumuz"], exclusive: "form-spine", branch: "garrison", tags: ["form", "cross"],
  nodes: [
    opening("dc_sf_kisla_alt", { era: ["2002", "gunumuz"], form: "Kışla-Devlet", tags: ["form"] },
      "Güvenlik cümlesi masada",
      "Haluk Paşa masası kısa yazar. Sivil takvim dipnota iner. Emir kısa, uygulama uzun. Kurumlar tempo ister; müzakere kapanmadan kapanmış gibi durur. Bu bir darbe dosyası değildir — omurga kaymasıdır.",
      "A security sentence on the desk",
      "Haluk Pasha's desk writes short. The civilian calendar drops to a footnote. The order is short, the application long. Institutions want pace; negotiation looks closed without having closed. This is not a coup file — it is a spine-shift.",
      choice("civil", "Sivil takvimi geri al", "Take the civilian calendar back", "Müzakere", { effects: { heat: -1 }, stageTo: 1, next: { eventId: "dc_sf_kisla_alt2", dueTurns: 6, key: "sf-kisla-alt2" }, echo: "Güvenlik cümlesi masada kaldı; sivil kalem dipnotta." }),
      choice("spine", "Kısa emri tut, sivil satırı beklet", "Hold the short order, hold the civilian line", "Omurga", { effects: { heat: 1 }, stageTo: 9 })),
    later("dc_sf_kisla_alt2", { era: ["2002", "gunumuz"], form: "Kışla-Devlet", tags: ["form", "memory"] },
      "İstihbarat 'darboğaz' yazar",
      "Leyla koordinasyon darboğazını not düşer. Güvenlik omurgası brifingi hız sanır; sentez gecikir. Kurumsal uyarı, iç işi güvenlik cümlesine çevirmeden durmalıdır.",
      "Intelligence writes bottleneck",
      "Leyla notes a coordination bottleneck. The security spine mistakes briefing for speed; synthesis is late. The institutional warning must stand without turning an internal matter into a security sentence.",
      choice("brief", "Brifingi sivil kaleme de aç", "Open the briefing to the civilian pen too", "Bilgi", { effects: { info: 1 }, stageTo: 3, next: { eventId: "dc_sf_kisla_alt3", dueTurns: 24, key: "sf-kisla-alt3" } }),
      choice("fast", "Tempoda kal", "Stay with pace", "Omurga", { stageTo: 3 })),
    later("dc_sf_kisla_alt3", { stage: 3, era: ["2002", "gunumuz"], form: "Kışla-Devlet", tags: ["form", "long", "memory"] },
      "Sivil kalem geri gelir",
      "Yıllar sonra güvenlik dosyası kapanmaz, yer değiştirir. Devlet, güvenlik omurgasıyla yürüdü; sivil kapasite bekletildi. İz, emrin kısalığında kalır.",
      "The civilian pen comes back",
      "Years later the security file does not close, it changes place. The state walked on a security spine; civilian capacity was made to wait. The trace remains in the shortness of the order.",
      choice("trace", "Kısa emir izini dosyala", "File the short-order trace", "Hafıza", { stageTo: 4 }),
      choice("hold", "Omurgayı tut", "Hold the spine", "Süreklilik", { stageTo: 4 })),
  ],
});

push({
  id: "sf-buro-alt", arc: "form", era: ["2002", "gunumuz"], exclusive: "form-spine", branch: "bureau", tags: ["form", "cross"],
  nodes: [
    opening("dc_sf_buro_alt", { era: ["2002", "gunumuz"], form: "Bürokrasi-Devlet", tags: ["form"] },
      "Dosya hükümetten uzun",
      "Tempo imza sırasına iner. Profesyonellik bir kalkan, yorgunluk da bir kalkan. İkisi aynı koridordadır. Cemil 'yüzde' der; saha binayı arar.",
      "The file outlives the government",
      "Pace reduces to a signature queue. Professionalism is a shield, and so is fatigue. Both are in the same corridor. Cemil says percent; the field looks for the building.",
      choice("sign", "İmza sırasını kısalt, sahayı yaz", "Shorten the signature queue, write the field", "Uygulama", { effects: { info: 1 }, stageTo: 1, next: { eventId: "dc_sf_buro_alt2", dueTurns: 5, key: "sf-buro-alt2" } }),
      choice("shield", "Kalkanı tut, sırayı usul say", "Hold the shield, count the queue as procedure", "Süreklilik", { stageTo: 9 })),
    later("dc_sf_buro_alt2", { era: ["2002", "gunumuz"], form: "Bürokrasi-Devlet", tags: ["form", "memory"] },
      "Uygulama yüzdesi şişer",
      "Kâğıt 82 yazar. Saha 30 hisseder. Bürokrasi-Devlet, şişmeyi koruma sanır. Seçilmiş irade dosyayı ezmeye başlayınca kalem direnir.",
      "The implementation percent swells",
      "Paper writes 82. The field feels 30. The bureaucracy-state mistakes the swell for protection. When elected will starts to crush the file, the pen resists.",
      choice("field", "Sahayı yüzdeye bağla", "Tie the field to the percent", "Dürüstlük", { effects: { info: 1 }, stageTo: 3, next: { eventId: "dc_sf_buro_alt3", dueTurns: 36, key: "sf-buro-alt3" } }),
      choice("resist", "Kalemi direnişte tut", "Keep the pen in resistance", "Kalkan", { stageTo: 3 })),
    later("dc_sf_buro_alt3", { stage: 3, era: ["2002", "gunumuz"], form: "Bürokrasi-Devlet", tags: ["form", "long", "memory"] },
      "Süreklilik bir iz olur",
      "Hükümetler kayar. Dosya tanıdık durur. Devlet, bürokratik süreklilikle ayakta kaldı; seçilmiş irade kaydı. Yorgunluk hâlâ kalkan gibi durur.",
      "Continuity becomes a trace",
      "Governments slip. The file looks familiar. The state stayed on its feet through bureaucratic continuity; elected will slipped. Fatigue still sits like a shield.",
      choice("rest", "Yorgunluğu kalkan olmaktan çıkar", "Stop treating fatigue as a shield", "Tamir", { stageTo: 4 }),
      choice("keep", "Sürekliliği tut", "Hold continuity", "Omurga", { stageTo: 4 })),
  ],
});

push({
  id: "sf-parti-alt", arc: "form", era: ["2002", "gunumuz"], exclusive: "form-mandate", branch: "party", tags: ["form", "cross"],
  nodes: [
    opening("dc_sf_parti_alt", { era: ["2002", "gunumuz"], form: "Parti-Devlet", tags: ["form"] },
      "Kurum saati, merkez temposu",
      "Merkez, kurum özerkliğini tempo sanır. Kadrolar aynı cümleyi ezberler. Liyakat CV'si masadadır; koridor sadakat sorar. Oyuncu parti değildir — dosyanın saatini tutmaya çalışan devlettir.",
      "Institution time, centre pace",
      "The centre mistakes institutional autonomy for pace. Cadres memorise the same sentence. The merit CV is on the desk; the corridor asks about loyalty. The player is not a party — it is the state trying to hold the file's clock.",
      choice("clock", "Kurum saatini tut, cümleyi çoğaltma", "Hold institution time, do not multiply the sentence", "Özerklik", { effects: { info: 1 }, stageTo: 1, next: { eventId: "dc_sf_parti_alt2", dueTurns: 6, key: "sf-parti-alt2" }, echo: "Merkez tempo sandı; kurum saati kaydı." }),
      choice("same", "Aynı cümleyi tut, saati kaydır", "Keep the same sentence, shift the clock", "Mandat", { effects: { rumor: 1 }, stageTo: 9 })),
    later("dc_sf_parti_alt2", { era: ["2002", "gunumuz"], form: "Parti-Devlet", tags: ["form", "memory"] },
      "Dosya partinin takvimine bakar",
      "Ayşe kurul takvimi siyasi tempo ister. Mahkeme kalemi başka haftadır. Mandat yüksek, özerklik alçak. İki takvim aynı ayı yazmaz.",
      "The file looks at the party's calendar",
      "Ayşe's board wants political pace from the calendar. The court clerk is another week. Mandate high, autonomy low. Two calendars do not write the same month.",
      choice("auto", "Özerklik dipnotunu aç", "Open an autonomy footnote", "Kurum", { stageTo: 3, next: { eventId: "dc_sf_parti_alt3", dueTurns: 24, key: "sf-parti-alt3" } }),
      choice("cal", "Siyasi takvimi tut", "Hold the political calendar", "Tempo", { stageTo: 3 })),
    later("dc_sf_parti_alt3", { stage: 3, era: ["2002", "gunumuz"], form: "Parti-Devlet", tags: ["form", "long", "memory"] },
      "Kurumlar kendi saatini arar",
      "Merkez temposu alışkanlık olur. Devlet, siyasi merkeze bağlandı; kurum saati kaydı. Cadre ezber cümleyi unutmaz, uygulamaz da.",
      "Institutions look for their own clock",
      "Centre pace becomes a habit. The state bound itself to the political centre; institution time slipped. The cadre does not forget the memorised sentence, and does not apply it either.",
      choice("own", "Kurum saatini geri kur", "Set institution time again", "Tamir", { stageTo: 4 }),
      choice("bind", "Bağı tut", "Hold the bind", "Süreklilik", { stageTo: 4 })),
  ],
});

push({
  id: "sf-pop-alt", arc: "form", era: ["2002", "gunumuz"], exclusive: "form-mandate", branch: "populist", tags: ["form", "cross"],
  nodes: [
    opening("dc_sf_pop_alt", { era: ["2002", "gunumuz"], form: "Popülist-Devlet", tags: ["form"] },
      "Hane rahatlatma, kurum kaybı",
      "Nuri Hazine faturayı siyaset sayar. Rıza kısa, kasa uzun. Manşet iddiası dosyadan hızlıdır. İstatistik özerkliği siyasi maliyet olarak durur.",
      "Household relief, institutional loss",
      "Nuri Treasury treats the bill as politics. Consent is short, the till is long. The headline claim is faster than the file. Statistical autonomy sits as a political cost.",
      choice("stat", "İstatistiği tut, manşeti beklet", "Hold the statistic, hold the headline", "Kurum; rıza", { effects: { info: 1, heat: 1 }, stageTo: 1, next: { eventId: "dc_sf_pop_alt2", dueTurns: 4, key: "sf-pop-alt2" } }),
      choice("head", "Manşeti tut, faturayı ertele", "Hold the headline, defer the bill", "Rıza; kasa", { effects: { rumor: 2, heat: -1 }, stageTo: 9 })),
    later("dc_sf_pop_alt2", { era: ["2002", "gunumuz"], form: "Popülist-Devlet", tags: ["form", "memory"] },
      "Fatura vaadi geçer",
      "Kira ve fatura manşeti sollar. Güven parçalanır. Kısa rıza omurga yapılmıştı; omurga incelir.",
      "The bill overtakes the promise",
      "Rent and the bill overtake the headline. Trust fragments. Short consent had been made a spine; the spine thins.",
      choice("bill", "Faturayı açık yaz, vaadi kıs", "Write the bill in the open, shorten the promise", "Dürüstlük", { effects: { info: 1, heat: 1 }, stageTo: 3, next: { eventId: "dc_sf_pop_alt3", dueTurns: 24, key: "sf-pop-alt3" } }),
      choice("promise", "Vaadi yenile", "Renew the promise", "Rıza", { effects: { rumor: 1 }, stageTo: 3 })),
    later("dc_sf_pop_alt3", { stage: 3, era: ["2002", "gunumuz"], form: "Popülist-Devlet", tags: ["form", "long", "memory"] },
      "Kısa rıza bir iz bırakır",
      "Kurumsal güven incelmiştir. Devlet, kısa rızayı omurga yaptı. Hane o kışki faturayı unutmaz; manşet unutur.",
      "Short consent leaves a trace",
      "Institutional trust has thinned. The state made short consent a spine. The household does not forget that winter's bill; the headline does.",
      choice("trust", "Kurum güvenini onar", "Repair institutional trust", "Uzun", { stageTo: 4 }),
      choice("short", "Kısa rızada kal", "Stay with short consent", "Alışkanlık", { stageTo: 4 })),
  ],
});

push({
  id: "sf-sermaye-alt", arc: "form", era: ["2002", "gunumuz"], tags: ["form", "network", "cross"],
  nodes: [
    opening("dc_sf_sermaye_alt", { era: ["2002", "gunumuz"], form: "Sermaye-Devlet", tags: ["form", "network"] },
      "Yatırım cümlesi önde",
      "İş dünyası güler. Hane asık durur. İki güven endeksi aynı ayı tarif etmez. Kredi ısınır; kırılganlık ötelenmiş durur. Fatura haneye ayrıca gelir.",
      "The investment sentence goes first",
      "Business smiles. The household looks grim. Two confidence indexes do not describe the same month. Credit heats; fragility sits postponed. The bill arrives at the household separately.",
      choice("house", "Hane endeksini yatırımın yanına yaz", "Write the household index next to investment", "Rıza", { effects: { info: 1, heat: -1 }, stageTo: 1, next: { eventId: "dc_sf_sermaye_alt2", dueTurns: 6, key: "sf-sermaye-alt2" } }),
      choice("invest", "Yatırımı omurga tut", "Keep investment as the spine", "Piyasa", { effects: { rumor: 1 }, stageTo: 9 })),
    later("dc_sf_sermaye_alt2", { era: ["2002", "gunumuz"], form: "Sermaye-Devlet", tags: ["form", "network", "memory"] },
      "Kredi ısısı, ötelenmiş kırılganlık",
      "Büyük kapıdan girer. Anadolu KOBİ teminat duyar. Aynı omurga iki ülke gibi durur. Isı, haneye kira olarak iner.",
      "Credit heat, postponed fragility",
      "The large concern walks in. The Anatolian SME hears collateral. The same spine looks like two countries. Heat arrives at the household as rent.",
      choice("sme", "KOBİ hattını ayır", "Split an SME line", "Adalet", { effects: { heat: -1 }, stageTo: 3, next: { eventId: "dc_sf_sermaye_alt3", dueTurns: 36, key: "sf-sermaye-alt3" } }),
      choice("scale", "Ölçeği başarı say", "Count scale as success", "Tempo", { stageTo: 3 })),
    later("dc_sf_sermaye_alt3", { stage: 3, era: ["2002", "gunumuz"], form: "Sermaye-Devlet", tags: ["form", "long", "network"] },
      "Piyasa homurdanır, kamu oturur",
      "Yıllar sonra yatırım cümlesi yorulur. Devlet, sermaye temposunu omurga sandı; toplumsal rıza ayrı kaldı. Kamu tekrar masaya oturur — oturmuş gibi durur.",
      "The market growls, the public sits down",
      "Years later the investment sentence tires. The state treated capital's pace as a spine; social consent stayed apart. The public sits at the desk again — or looks as if it does.",
      choice("public", "Kamu cümlesini geri yaz", "Write the public sentence back in", "Rıza", { stageTo: 4 }),
      choice("spine", "Sermaye omurgasını tut", "Hold the capital spine", "Piyasa", { stageTo: 4 })),
  ],
});

push({
  id: "sf-cemaat-alt", arc: "form", era: ["2002", "gunumuz"], tags: ["form", "network", "cross"],
  nodes: [
    opening("dc_sf_cemaat_alt", { era: ["2002", "gunumuz"], form: "Cemaat-Devlet", tags: ["form", "network"] },
      "Ağ baskısı, kurum boşluğu",
      "Yüklenici halkası şartnameden önce konuşur. İsimler resmi değildir. Kaynak ve erişim, yazılı yetkinin yanında yürür. Yakınlık bir kadro ilanı değildir — koridor alışkanlığıdır. Emir yoktur; çağrı vardır.",
      "Network pressure, an institutional gap",
      "The contractor ring speaks before the specification. The names are not official. Resource and access walk beside written authority. Affinity is not a vacancy notice — it is a corridor habit. There is no order; there is a call.",
      choice("spec", "Şartnameyi halkadan önce yaz", "Write the specification before the ring", "Usul", { effects: { info: 1, heat: 1 }, stageTo: 1, next: { eventId: "dc_sf_cemaat_alt2", dueTurns: 5, key: "sf-cemaat-alt2" }, echo: "Halka şartnameden önce konuştu; erişim yazılı yetkiyi solladı." }),
      choice("access", "Erişimi tanı, şartnameyi sonra", "Recognise access, specification later", "Ağ", { effects: { rumor: 2 }, stageTo: 9 })),
    later("dc_sf_cemaat_alt2", { era: ["2002", "gunumuz"], form: "Cemaat-Devlet", tags: ["form", "network", "memory"] },
      "Yakınlık, ihale kâğıdı",
      "Kâğıt temiz durur. Koku koridora yayılır. Profesyonel kalkan inceldiği yerden ağ yerleşir. Cadre 'usul' der; halka 'tanıdık' der.",
      "Affinity, tender paper",
      "The paper looks clean. The smell spreads into the corridor. Where the professional shield thins, the network settles. The cadre says procedure; the ring says a familiar face.",
      choice("shield", "Kalkanı kalınlaştır, halkayı dipnota al", "Thicken the shield, footnote the ring", "Kurum", { effects: { info: 1 }, stageTo: 3, next: { eventId: "dc_sf_cemaat_alt3", dueTurns: 24, key: "sf-cemaat-alt3" } }),
      choice("ring", "Tanıdık hattını tut", "Keep the familiar line", "Ağ", { effects: { rumor: 1 }, stageTo: 3 })),
    later("dc_sf_cemaat_alt3", { stage: 3, era: ["2002", "gunumuz"], form: "Cemaat-Devlet", tags: ["form", "long", "network"] },
      "Ağ incelir ya da kalınlaşır",
      "Profesyonel kalkan onarılmışsa halka incelir. Onarılmamışsa erişim yazılı yetkinin yerini alır. Devlet, resmi olmayan ağ etkisini kurum boşluğunda taşıdı — isimsiz, emirsiz, izli.",
      "The network thins or thickens",
      "If the professional shield was repaired the ring thins. If not, access takes the place of written authority. The state carried unofficial network influence in an institutional gap — nameless, without orders, with a trace.",
      choice("repair", "Kalkanı onar, izi dosyala", "Repair the shield, file the trace", "Kurum", { stageTo: 4 }),
      choice("gap", "Boşluğu bırak", "Leave the gap", "Ağ", { stageTo: 4 })),
  ],
});

push({
  id: "sf-bos-alt", arc: "form", era: ["2002", "gunumuz"], tags: ["form", "cross"],
  nodes: [
    opening("dc_sf_bos_alt", { era: ["2002", "gunumuz"], form: "Boş Kabuk", minEntropy: 55, tags: ["form"] },
      "Karar var, uygulama yok",
      "Tabela durur. Koridor boştur. Entropy yüksek, kapasite düşük. Her dosya hayalet dosya gibi. Üç kriz aynı anda aktif olabilir; hiçbirinin sahibi yoktur.",
      "A decision exists, implementation does not",
      "The signboard stands. The corridor is empty. Entropy high, capacity low. Every file is a ghost file. Three crises may be active at once; none of them has an owner.",
      choice("own", "Bir dosyaya sahip ata, diğerini beklet", "Give one file an owner, hold the other", "Sahiplik", { effects: { info: 1, heat: -1 }, stageTo: 1, next: { eventId: "dc_sf_bos_alt2", dueTurns: 4, key: "sf-bos-alt2" }, echo: "Tabela duruyordu; sahip yoktu." }),
      choice("ghost", "Hayalet dosyayı açık tut", "Keep the ghost file open", "Kabuk", { effects: { rumor: 2 }, stageTo: 9 })),
    later("dc_sf_bos_alt2", { era: ["2002", "gunumuz"], form: "Boş Kabuk", tags: ["form", "memory"] },
      "Üç kriz, sıfır sahip",
      "Gündem şişer. Masa 'hepsi acil' der. Acil, sahipsiz demektir. Bir kurum tempo alırsa kabuk çatlar; devlet henüz dolmaz.",
      "Three crises, zero owners",
      "The agenda swells. The desk says they are all urgent. Urgent means unowned. If one institution takes pace the shell cracks; the state is not yet full.",
      choice("one", "Tek krize sahip, diğerini arşiv kuyruğuna", "Own one crisis, queue the rest in the archive", "Sade", { effects: { heat: -1 }, stageTo: 3, next: { eventId: "dc_sf_bos_alt3", dueTurns: 24, key: "sf-bos-alt3" } }),
      choice("all", "Hepsini acil tut", "Keep them all urgent", "Dağılım", { effects: { heat: 2 }, stageTo: 3 })),
    later("dc_sf_bos_alt3", { stage: 3, era: ["2002", "gunumuz"], form: "Boş Kabuk", tags: ["form", "long", "memory"] },
      "Kabuk çatlar, devlet dolmaz",
      "Bir kurum tempo almıştır. Tabela hâlâ durur. Devlet, karar üretip sahaya inemediği bir kabuk döneminden geçti. Dolum, tempo ile aynı şey değildir.",
      "The shell cracks, the state does not fill",
      "One institution has taken pace. The signboard still stands. The state passed through a shell period of producing decisions and not reaching the field. Filling is not the same as pace.",
      choice("fill", "Sahayı doldur, tabelayı sök", "Fill the field, take the signboard down", "Dolum", { stageTo: 4 }),
      choice("sign", "Tabelayı tut", "Keep the signboard", "Kabuk", { stageTo: 4 })),
  ],
});

push({
  id: "rg-marmara-alt", arc: "region", era: ["2002", "gunumuz"], exclusive: "region-path", branch: "west", tags: ["region", "cross"],
  nodes: [
    opening("dc_rg_marmara", { era: ["2002", "gunumuz"], needRegion: "marmara", minHeat: 28, tags: ["region"] },
      "Kredi ısısı, kira, sıkışma",
      "Marmara konut kredisini konuşur. Kira haneyi yer. Çevre yolu aynı saatte durur. Isı bir enflasyon cümlesi değildir — taksit, metre ve dakikadır. Selim daire sayar; yol sayılmaz.",
      "Credit heat, rent, congestion",
      "Marmara talks housing credit. Rent eats the household. The ring road stops at the same hour. Heat is not an inflation sentence — it is the instalment, the metre and the minute. Selim counts units; the road is not counted.",
      choice("rent", "Kirayı izle, krediyi ısı say", "Watch rent, count credit as heat", "Hane", { effects: { heat: -1, info: 1 }, stageTo: 1, next: { eventId: "dc_rg_marmara2", dueTurns: 5, key: "rg-marmara2" } }),
      choice("credit", "Krediyi arz say, dakikayı unut", "Count credit as supply, forget the minute", "Piyasa", { effects: { rumor: 1 }, stageTo: 9 })),
    later("dc_rg_marmara2", { era: ["2002", "gunumuz"], needRegion: "marmara", tags: ["region", "memory"] },
      "Taksit durur, yol durmaz",
      "Faiz konuşulur. Minibüs aynı virajda bekler. Konut stoku kâğıtta artar; oda paylaşımı sahada artar. İki artış aynı başarı değildir.",
      "The instalment pauses, the road does not",
      "Rates are discussed. The minibus waits at the same bend. The housing stock rises on paper; room-sharing rises in the field. Two rises are not the same success.",
      choice("room", "Oda paylaşımını konut satırına yaz", "Write room-sharing onto the housing line", "Dürüstlük", { effects: { info: 1 }, stageTo: 3, next: { eventId: "dc_rg_marmara3", dueTurns: 24, key: "rg-marmara3" } }),
      choice("stock", "Stoku başarı say", "Count stock as success", "Tabela", { stageTo: 3 })),
    later("dc_rg_marmara3", { stage: 3, era: ["2002", "gunumuz"], tags: ["region", "long", "memory"] },
      "Isı bir alışkanlık olur",
      "Yıllar sonra kredi cümlesi değişir. Kira ve dakika durur. Devlet, arzı omurga sandı; sıkışma hanenin omurgası oldu.",
      "Heat becomes a habit",
      "Years later the credit sentence changes. Rent and the minute remain. The state treated supply as a spine; congestion became the household's spine.",
      choice("minute", "Dakikayı hizmet say", "Count the minute as a service", "Altyapı", { stageTo: 4 }),
      choice("leave", "Isıyı piyasaya bırak", "Leave the heat to the market", "Piyasa", { stageTo: 4 })),
  ],
});

push({
  id: "rg-dogu-alt", arc: "region", era: ["2002", "gunumuz"], exclusive: "region-path", branch: "east", tags: ["region", "cross"],
  nodes: [
    opening("dc_rg_dogu_alt", { era: ["2002", "gunumuz"], needRegion: "dogu", maxServices: 62, tags: ["region"] },
      "Kamu işi bekler, hizmet açığı",
      "Doğu'da randevu kışı bekler. Kamu iş ilanı asılmıştır; kadro telgrafı bahara kalır. Hizmet açığı bir güvenlik cümlesi değildir — poliklinik günü ve servis saatidir. Cemil yüzde yazar; ilçe 'perşembe doktor' der.",
      "Public work waits, a services gap",
      "In the east the appointment waits for winter. The public-job notice is posted; the staffing telegram waits for spring. The services gap is not a security sentence — it is clinic day and the bus hour. Cemil writes a percent; the district says the doctor on Thursday.",
      choice("clinic", "Poliklinik gününü yaz, ilanı beklet", "Write the clinic day, hold the notice", "Hizmet", { effects: { heat: -1 }, stageTo: 1, next: { eventId: "dc_rg_dogu_alt2", dueTurns: 6, key: "rg-dogu-alt2" } }),
      choice("notice", "İlanı başarı say", "Count the notice as success", "Tabela", { effects: { rumor: 1 }, stageTo: 9 })),
    later("dc_rg_dogu_alt2", { era: ["2002", "gunumuz"], needRegion: "dogu", tags: ["region", "memory"] },
      "Servis saati, kadro baharı",
      "Kadro gelmiş görünür. Servis hâlâ iki günde bir. Bekleme, işsizlik cümlesine karışır; ikisi aynı açık değildir. Genç, ilanı okur, saati kaçırır.",
      "The bus hour, a staffing spring",
      "The post looks as if it has arrived. The bus is still every other day. Waiting mixes into an unemployment sentence; they are not the same gap. The young person reads the notice and misses the hour.",
      choice("bus", "Servisi kadroya bağla", "Tie the bus to the post", "Hizmet", { effects: { info: 1 }, stageTo: 3, next: { eventId: "dc_rg_dogu_alt3", dueTurns: 36, key: "rg-dogu-alt3" } }),
      choice("post", "Kadroyu tut, saati köye bırak", "Hold the post, leave the hour to the village", "Yerel", { stageTo: 3 })),
    later("dc_rg_dogu_alt3", { stage: 3, era: ["2002", "gunumuz"], tags: ["region", "long", "memory"] },
      "Perşembe doktor bir iz olur",
      "Yıllar sonra ilan çoğalır. Perşembe hâlâ doktor günüdür. Devlet, kamu işini hizmet sandı; hizmet bir takvimdi.",
      "Thursday's doctor becomes a trace",
      "Years later the notices multiply. Thursday is still doctor-day. The state mistook a public job for a service; the service was a calendar.",
      choice("cal", "Takvimi hizmet say", "Count the calendar as the service", "Uzun", { stageTo: 4 }),
      choice("job", "İlanı tut", "Hold the notice", "Tabela", { stageTo: 4 })),
  ],
});

push({
  id: "rg-ege-alt", arc: "region", era: ["2002", "gunumuz"], tags: ["region", "cross"],
  nodes: [
    opening("dc_rg_ege_alt", { era: ["2002", "gunumuz"], needRegion: "ege", tags: ["region"] },
      "İhracat ve turizm, su tablası",
      "Ege zeytini ve sezonu aynı yazı paylaşır. Tanker kuyusu dolar; vana tarlada kısılır. Döviz cümlesi su cümlesini yemez — ikisi aynı kuyudan içer. Belediye 'sezon' der; sulama birliği 'kota' der.",
      "Export and tourism, a water table",
      "The Aegean shares the same summer between olives and the season. The tanker well fills; the valve is throttled in the field. The foreign-exchange sentence does not eat the water sentence — both drink from the same well. The municipality says season; the irrigation union says quota.",
      choice("quota", "Kota yaz, sezonu kuyuya bağla", "Write a quota, tie the season to the well", "Su", { effects: { heat: 1, info: 1 }, stageTo: 1, next: { eventId: "dc_rg_ege_alt2", dueTurns: 7, key: "rg-ege-alt2" } }),
      choice("season", "Sezonu tut, vanayı tarlaya bırak", "Hold the season, leave the valve to the field", "Döviz", { effects: { rumor: 1 }, stageTo: 9 })),
    later("dc_rg_ege_alt2", { era: ["2002", "gunumuz"], needRegion: "ege", tags: ["region", "memory"] },
      "Kuyu iner, otel dolar",
      "Sezon rekor yazar. Tablo başka bir yazı anlatır. Çiftçi 'zeytin' der; tesis 'havuz' der. İki rekor aynı kıtlığı gizler.",
      "The well drops, the hotel fills",
      "The season writes a record. The table describes another summer. The farmer says olives; the facility says pool. Two records hide the same scarcity.",
      choice("table", "Tabloyu sezona yaz", "Write the table onto the season", "Dürüstlük", { effects: { info: 1 }, stageTo: 3, next: { eventId: "dc_rg_ege_alt3", dueTurns: 24, key: "rg-ege-alt3" } }),
      choice("record", "Rekoru tut", "Hold the record", "Tabela", { stageTo: 3 })),
    later("dc_rg_ege_alt3", { stage: 3, era: ["2002", "gunumuz"], tags: ["region", "long", "memory"] },
      "Kota bir hafıza olur",
      "Yıllar sonra sezon yine konuşulur. Kuyu izi durur. Devlet, dövizi omurga sandı; tablo ayrı kaldı.",
      "The quota becomes a memory",
      "Years later the season is spoken of again. The well-trace remains. The state treated hard currency as a spine; the table stayed apart.",
      choice("well", "Kuyuyu altyapı say", "Count the well as infrastructure", "Uzun", { stageTo: 4 }),
      choice("fx", "Sezonu tut", "Hold the season", "Döviz", { stageTo: 4 })),
  ],
});

push({
  id: "rg-akdeniz-alt", arc: "region", era: ["2002", "gunumuz"], tags: ["region", "cross"],
  nodes: [
    opening("dc_rg_akdeniz", { era: ["2002", "gunumuz"], needRegion: "akdeniz", tags: ["region"] },
      "Mevsimlik iş, sera, su",
      "Akdeniz serası kışın da çalışır. Mevsimlik işçi aynı otobüste iner; kayıt ayrı defterdedir. Sulama, turizm broşüründeki mavi değildir — damla ve kuyudur. Ege'nin sezonu bu değildir; bu, naylon ve vardiyadır.",
      "Seasonal labour, greenhouse, water",
      "The Mediterranean greenhouse works in winter too. Seasonal labour gets off the same bus; the register is in another ledger. Irrigation is not the blue in the tourism brochure — it is drip and well. This is not the Aegean season; this is plastic and a shift.",
      choice("register", "Mevsimlik defteri aç, suyu kotaya bağla", "Open the seasonal ledger, tie water to quota", "Kayıt", { effects: { info: 1, heat: -1 }, stageTo: 1, next: { eventId: "dc_rg_akdeniz2", dueTurns: 5, key: "rg-akdeniz2" } }),
      choice("shift", "Vardiyayı tut, defteri sonra", "Hold the shift, ledger later", "Tempo", { effects: { rumor: 1 }, stageTo: 9 })),
    later("dc_rg_akdeniz2", { era: ["2002", "gunumuz"], needRegion: "akdeniz", tags: ["region", "memory"] },
      "Naylon altında ücret, kuyu altında kota",
      "Hasat erken biter. Ücret tartışması kuyuya karışır. Sera ihracatı gülümser; işçi otobüsü baharı bekler. İki takvim aynı ili yazmaz.",
      "A wage under plastic, a quota under the well",
      "Harvest ends early. The wage argument mixes into the well. Greenhouse exports smile; the labour bus waits for spring. Two calendars do not write the same province.",
      choice("wage", "Ücreti hasada bağla", "Tie the wage to the harvest", "Rıza", { effects: { heat: -1 }, stageTo: 3, next: { eventId: "dc_rg_akdeniz3", dueTurns: 36, key: "rg-akdeniz3" } }),
      choice("export", "İhracatı tut", "Hold the export", "Piyasa", { stageTo: 3 })),
    later("dc_rg_akdeniz3", { stage: 3, era: ["2002", "gunumuz"], tags: ["region", "long", "memory"] },
      "Otobüs bir iz olur",
      "Yıllar sonra sera büyür. Otobüs hâlâ baharı bekler. Devlet, naylonu kalkınma sandı; vardiya ayrı kaldı.",
      "The bus becomes a trace",
      "Years later the greenhouse grows. The bus still waits for spring. The state mistook plastic for development; the shift stayed apart.",
      choice("bus", "Otobüsü hizmet yaz", "Write the bus as a service", "Uzun", { stageTo: 4 }),
      choice("plastic", "Serayı tut", "Hold the greenhouse", "Piyasa", { stageTo: 4 })),
  ],
});

push({
  id: "rg-karadeniz-alt", arc: "region", era: ["2002", "gunumuz"], tags: ["region", "cross"],
  nodes: [
    opening("dc_rg_karadeniz", { era: ["2002", "gunumuz"], needRegion: "karadeniz", maxServices: 64, tags: ["region"] },
      "Göç, yol, çay-fındık lojistiği",
      "Karadeniz köyü boşalır. Yaş çay aynı virajda bekler; fındık kamyonu çamurda kalır. Yol bir seçim afişi değildir — hasat saatidir. Çıkış göçü, hizmet açığından önce gelir; ikisi birbirini besler.",
      "Out-migration, the road, tea and hazelnut logistics",
      "The Black Sea village empties. Wet tea waits at the same bend; the hazelnut truck stays in the mud. The road is not an election poster — it is harvest hour. Out-migration comes before the services gap; each feeds the other.",
      choice("road", "Hasat yolunu öne al", "Bring the harvest road forward", "Lojistik", { effects: { heat: -1 }, stageTo: 1, next: { eventId: "dc_rg_karadeniz2", dueTurns: 8, key: "rg-karadeniz2" } }),
      choice("coop", "Kooperatif cümlesini tut, virajı bırak", "Hold the cooperative sentence, leave the bend", "Yerel", { stageTo: 9 })),
    later("dc_rg_karadeniz2", { era: ["2002", "gunumuz"], needRegion: "karadeniz", tags: ["region", "memory"] },
      "Kamyon çamurda, ev kilitli",
      "Yol yarım açılır. Ev kilitlidir; genç kenttedir. Çay fabrikası 'kontenjan' der; kamyon 'viraj' der. Lojistik, tarım politikasından ayrı bir dosyadır.",
      "The truck in the mud, a locked house",
      "The road opens halfway. The house is locked; the young are in the city. The tea plant says quota; the truck says the bend. Logistics is a separate file from farm policy.",
      choice("lock", "Kilitli evi göç satırına yaz", "Write the locked house onto the migration line", "Dürüstlük", { effects: { info: 1 }, stageTo: 3, next: { eventId: "dc_rg_karadeniz3", dueTurns: 24, key: "rg-karadeniz3" } }),
      choice("quota", "Kontenjanı tut", "Hold the quota", "Tabela", { stageTo: 3 })),
    later("dc_rg_karadeniz3", { stage: 3, era: ["2002", "gunumuz"], tags: ["region", "long", "memory"] },
      "Viraj bir alışkanlık olur",
      "Yıllar sonra yol vardır. Bakım yoktur. Göç çekimi kente kaymıştır; çay hâlâ aynı virajı bekler. Devlet, afişi omurga sandı; lojistik ayrı kaldı.",
      "The bend becomes a habit",
      "Years later there is a road. There is no upkeep. Migration pull has shifted to the city; the tea still waits at the same bend. The state treated the poster as a spine; logistics stayed apart.",
      choice("maintain", "Bakım payını yaz", "Write a maintenance share", "Uzun yük", { stageTo: 4 }),
      choice("leave", "Virajı köye bırak", "Leave the bend to the village", "Yerel", { stageTo: 4 })),
  ],
});

push({
  id: "rg-guneydogu-alt", arc: "region", era: ["2002", "gunumuz"], tags: ["region", "cross"],
  nodes: [
    opening("dc_rg_guneydogu", { era: ["2002", "gunumuz"], needRegion: "guneydogu", maxServices: 60, tags: ["region"] },
      "Kuraklık, belediye yükü, genç bekleyişi",
      "Güneydoğu kuyusu iner. Belediye mesaisi uzar: su tankeri, çöp, başvuru kuyruğu. Genç, kamu ilanını değil o kuyruğu sayar. Bu, Doğu'nun perşembe doktoru değildir — tanker ve öğleden sonra kuyruğudur.",
      "Drought, municipal load, youth waiting",
      "The southeast well drops. Municipal overtime lengthens: the tanker, the rubbish, the application queue. The young count that queue, not the public notice. This is not the east's Thursday doctor — it is the tanker and the afternoon line.",
      choice("tanker", "Tankeri hizmet yaz, kuyruğu say", "Write the tanker as a service, count the queue", "Belediye", { effects: { heat: -1, info: 1 }, stageTo: 1, next: { eventId: "dc_rg_guneydogu2", dueTurns: 6, key: "rg-guneydogu2" } }),
      choice("notice", "İlanı tut, tankeri dipnota", "Hold the notice, footnote the tanker", "Tabela", { effects: { rumor: 1 }, stageTo: 9 })),
    later("dc_rg_guneydogu2", { era: ["2002", "gunumuz"], needRegion: "guneydogu", tags: ["region", "memory"] },
      "Mesai şişer, kuyu inmez",
      "Belediye yükü bir kahramanlık cümlesi olur. Kuyu inmeye devam eder. Genç işsizliği kuyrukla karışır; ikisi aynı dosya değildir. Selim 'imar' demez burada; 'tanker' der.",
      "Overtime swells, the well does not rise",
      "Municipal load becomes a hero-sentence. The well keeps dropping. Youth unemployment mixes with the queue; they are not the same file. Selim does not say zoning here; he says tanker.",
      choice("well", "Kuyuyu altyapıya bağla", "Tie the well to infrastructure", "Uzun", { stageTo: 3, next: { eventId: "dc_rg_guneydogu3", dueTurns: 36, key: "rg-guneydogu3" } }),
      choice("hero", "Mesaiyi başarı say", "Count overtime as success", "Anlatı", { stageTo: 3 })),
    later("dc_rg_guneydogu3", { stage: 3, era: ["2002", "gunumuz"], tags: ["region", "long", "memory"] },
      "Kuyruk bir omurga olur",
      "Yıllar sonra tanker hâlâ konuşulur. Belediye yükü alışkanlıktır. Devlet, mesaiyi kapasite sandı; genç kuyruğu ayrı tuttu.",
      "The queue becomes a spine",
      "Years later the tanker is still spoken of. Municipal load is a habit. The state mistook overtime for capacity; it kept the youth queue apart.",
      choice("cap", "Yükü kapasiteye çevir", "Turn the load into capacity", "Kurum", { stageTo: 4 }),
      choice("queue", "Kuyruğu bırak", "Leave the queue", "Yerel", { stageTo: 4 })),
  ],
});

push({
  id: "rg-icanadolu-alt", arc: "region", era: ["2002", "gunumuz"], tags: ["region", "cross"],
  nodes: [
    opening("dc_rg_icanadolu", { era: ["2002", "gunumuz"], needRegion: "ic-anadolu", tags: ["region"] },
      "Kurak yıl, silo, Konya-Ankara çekimi",
      "İç Anadolu silosu dolu görünür. Tarla çatlaktır. Bu, 1950 köy yolu değildir — TMO kapısı, kurak yıl ve koridor çekimidir. Konya düzlüğü Ankara'ya işçi verir; buğday kâğıtta durur. Hasan Bey'in kredi vaadi burada yok; Nuri 'pay' der.",
      "A dry year, a silo, Konya-Ankara pull",
      "The Central Anatolian silo looks full. The field is cracked. This is not a 1950 village road — it is the grain-board gate, a dry year and corridor pull. The Konya plain sends labour to Ankara; the wheat stays on paper. Hasan Bey's credit promise is not here; Nuri says share.",
      choice("silo", "Silo payını tarlaya bağla", "Tie the silo share to the field", "Taban", { effects: { info: 1 }, stageTo: 1, next: { eventId: "dc_rg_icanadolu2", dueTurns: 7, key: "rg-icanadolu2" } }),
      choice("pull", "Koridor çekimini tut, tarlayı bırak", "Hold the corridor pull, leave the field", "Kent", { effects: { heat: 1 }, stageTo: 9 })),
    later("dc_rg_icanadolu2", { era: ["2002", "gunumuz"], needRegion: "ic-anadolu", tags: ["region", "memory"] },
      "Kapı dolu, tarla boş",
      "Silo 'stok' der. Biçerdöver 'verim' der. Genç otobüsü Ankara'ya biner. İki doluluk aynı hasadı tarif etmez; biri kâğıt, biri göç.",
      "The gate is full, the field is empty",
      "The silo says stock. The harvester says yield. The young person's bus boards for Ankara. Two fullnesses do not describe the same harvest; one is paper, one is migration.",
      choice("yield", "Verimi stoka yaz", "Write yield onto stock", "Dürüstlük", { effects: { info: 1 }, stageTo: 3, next: { eventId: "dc_rg_icanadolu3", dueTurns: 24, key: "rg-icanadolu3" } }),
      choice("stock", "Stoku tut", "Hold the stock", "Tabela", { stageTo: 3 })),
    later("dc_rg_icanadolu3", { stage: 3, era: ["2002", "gunumuz"], tags: ["region", "long", "memory"] },
      "Koridor bir alışkanlık olur",
      "Yıllar sonra silo durur. Tarla başka bir kurak yılı anlatır. Devlet, stoku omurga sandı; çekim haneyi kente aldı. Köy yolu dosyası bu değildir — bu, kapı ve otobüstür.",
      "The corridor becomes a habit",
      "Years later the silo stands. The field describes another dry year. The state treated stock as a spine; pull took the household to the city. This is not the village-road file — this is the gate and the bus.",
      choice("field", "Tarla payını yaz", "Write a field share", "Uzun", { stageTo: 4 }),
      choice("bus", "Otobüsü bırak", "Leave the bus", "Göç", { stageTo: 4 })),
  ],
});


push({
  id: "p23-teblig", arc: "media", era: "1923", tags: ["period", "1923", "media", "government", "group", "cross"],
  nodes: [
    opening("dc_p23_teblig", { era: "1923", needGroup: "media", tags: ["period", "1923", "media", "government"] },
      "Resmî tebliğ, pazar fısıltısı",
      "Gazete bir sütun yazar. Pazar aynı haberi başka ağızla taşır. Recai 'mühür yeter' der; tezgâh mühürü okumaz, komşuyu okur. Bu bir propaganda seferi değil: resmî cümle ile saha cümlesi aynı gün iki ülkedir.",
      "An official communiqué, a market whisper",
      "The gazette writes one column. The market carries the same news in another mouth. Recai says the seal is enough; the stall does not read the seal, it reads the neighbour. This is not a propaganda drive: the official sentence and the field sentence are two countries on the same day.",
      choice("print", "Tebliği açık as, fısıltıyı dipnota al", "Hang the communiqué in the open, footnote the whisper", "Resmî ses", { effects: { info: 1 }, stageTo: 1, next: { eventId: "dc_p23_teblig2", dueTurns: 5, key: "p23-teblig2" }, echo: "Tebliğ asıldı; pazar başka sütun kurdu." }),
      choice("listen", "Pazar cümlesini brifinge yaz", "Write the market sentence into the briefing", "Saha kulağı", { effects: { rumor: 1 }, stageTo: 9 })),
    later("dc_p23_teblig2", { stage: 2, tags: ["period", "1923", "media", "memory"] },
      "Sütun durur, ağız çoğalır",
      "Gazete arşivde. Kasaba kahvesi 'bir de şöyle deniyor' ile aynı tebliği çoğaltır. İki kulağın aynı mührü dinlemediği ay, bilgi kalitesi sütun sayısı değildir.",
      "The column stands, mouths multiply",
      "The gazette is in the archive. The town coffeehouse multiplies the same communiqué with 'they also say this.' In a month when two ears do not hear the same seal, information quality is not a column count.",
      choice("join", "Kahve notunu sütuna ekle", "Add the coffeehouse note to the column", "Güven", { effects: { info: 1 }, stageTo: 3, next: { eventId: "dc_p23_teblig3", dueTurns: 24, key: "p23-teblig3" } }),
      choice("seal", "Mührü yeter say", "Count the seal as enough", "Sis", { effects: { rumor: 1 }, stageTo: 3 })),
    later("dc_p23_teblig3", { stage: 3, tags: ["period", "1923", "long", "media", "memory"] },
      "Mühür bir alışkanlık olur",
      "Yıllar sonra aynı pazar hâlâ komşuyu okur. Devlet, tebliği omurga sandı; kulağı dipnota indirdi. Resmî ses duyulur, inanılmazsa sütun bir izdir.",
      "The seal becomes a habit",
      "Years later the same market still reads the neighbour. The state treated the communiqué as a spine and dropped the ear to a footnote. If the official voice is heard and not believed, the column is a trace.",
      choice("ear", "Kulağı arşive yaz", "Write the ear into the archive", "Hafıza", { stageTo: 4 }),
      choice("column", "Sütunu tut", "Keep the column", "Anlatı", { stageTo: 4 })),
  ],
});
push({
  id: "p80-bulten", arc: "media", era: "1980", tags: ["period", "1980", "media", "group", "trust", "cross"],
  nodes: [
    opening("dc_p80_bulten", { era: "1980", needGroup: "media", tags: ["period", "1980", "media", "group"] },
      "Resmî bülten, kuyruk fısıltısı",
      "Ajans bir fiyat cümlesi basar. Kuyruk aynı cümleyi file ile okur. Turgut kadrosu 'düzeltme' der; tezgâh 'yok' der. Bu bir sansür tarifesi değildir: resmî saat ile sokak saati aynı dakikayı göstermez.",
      "An official bulletin, a queue whisper",
      "The agency prints a price sentence. The queue reads the same sentence with a shopping bag. Turgut's cadre says a correction; the stall says there is none. This is not a censorship tariff: the official hour and the street hour do not show the same minute.",
      choice("bulletin", "Bülteni tut, fısıltıyı kaydet", "Keep the bulletin, record the whisper", "İki saat", { effects: { info: 1 }, stageTo: 1, next: { eventId: "dc_p80_bulten2", dueTurns: 4, key: "p80-bulten2" }, echo: "Bülten düzeltme yazdı; kuyruk fileyi yazdı." }),
      choice("queue", "Kuyruk cümlesini öne al", "Put the queue sentence first", "Rıza", { effects: { rumor: 1, heat: -1 }, stageTo: 9 })),
    later("dc_p80_bulten2", { stage: 2, tags: ["period", "1980", "media", "memory", "trust"] },
      "Düzeltme tutulur, file şişer",
      "Ajans serisi 'istikrar' der. Emekli filesi başka sepet şişirir. İki enflasyon aynı ayı tarif etmezse güven, bültenin değil kuyruğun işidir.",
      "The correction holds, the bag swells",
      "The agency series says stability. The pensioner bag inflates another basket. If two inflations do not describe the same month, trust is the queue's job, not the bulletin's.",
      choice("series", "Seriyi açık tut, sepeti ayrı yaz", "Keep the series open, write the basket apart", "Dürüstlük", { effects: { info: 1 }, stageTo: 3, next: { eventId: "dc_p80_bulten3", dueTurns: 36, key: "p80-bulten3" } }),
      choice("tone", "Üslubu düzeltme say", "Count the tone as the correction", "Sis", { effects: { rumor: 2 }, stageTo: 3 })),
    later("dc_p80_bulten3", { stage: 3, tags: ["period", "1980", "long", "media", "trust"] },
      "Bülten bir omurga olur",
      "Kuyruk unutulmuş görünür. File hafızası durur. Devlet, resmi saati sokak saati sandı; iki saat ayrı kaldı.",
      "The bulletin becomes a spine",
      "The queue looks forgotten. The bag's memory remains. The state mistook the official hour for the street hour; the two hours stayed apart.",
      choice("two", "İki saati arşivle", "Archive the two hours", "Hafıza", { stageTo: 4 }),
      choice("one", "Bülteni tek saat say", "Count the bulletin as the only hour", "Anlatı", { stageTo: 4 })),
  ],
});
push({
  id: "p02-manset", arc: "media", era: "2002", tags: ["period", "2002", "media", "government", "group", "cross"],
  nodes: [
    opening("dc_p02_manset", { era: "2002", needGroup: "media", tags: ["period", "2002", "media", "government"] },
      "Brifing saati, saha notu",
      "Kamuoyu brifingi netleşmek ister. Muhabir 'saha başka' der. Kemal Bey program cümlesini okur; ilçe muhabiri vezneyi okur. Bu bir ikna seferi değil: resmî anlatı ile saha notu aynı ayı iki ülke yapar.",
      "A briefing hour, a field note",
      "The public briefing wants to sharpen. The reporter says the field is another country. Kemal Bey reads the program sentence; the district reporter reads the cashier. This is not a persuasion drive: official narrative and field note make the same month two countries.",
      choice("brief", "Brifingi saha notuyla yan yana yaz", "Write the briefing beside the field note", "Güven", { effects: { info: 1 }, stageTo: 1, next: { eventId: "dc_p02_manset2", dueTurns: 5, key: "p02-manset2" }, echo: "Brifing netleşti; saha notu dipnotta kalmadı." }),
      choice("tight", "Brifingi kısa tut, sahayı sonra", "Keep the briefing short, field later", "Sis", { effects: { rumor: 1 }, stageTo: 9 })),
    later("dc_p02_manset2", { stage: 2, tags: ["period", "2002", "media", "memory"] },
      "Manşet tutulur, ilçe ayrı konuşur",
      "Başkent manşeti 'program tutuyor' der. Üç ilin muhabiri vezne boşluğunu yazar. Fragmantasyon bir yüzde değil, iki cümlenin aynı gün yayımlanmasıdır.",
      "The headline holds, the district talks apart",
      "The capital headline says the program is holding. Reporters in three provinces write the cashier gap. Fragmentation is not a percentage; it is two sentences publishing on the same day.",
      choice("both", "İki cümleyi aynı brifinge al", "Take both sentences into the same briefing", "Bilgi", { effects: { info: 1 }, stageTo: 3, next: { eventId: "dc_p02_manset3", dueTurns: 24, key: "p02-manset3" } }),
      choice("cap", "Başkent cümlesini tut", "Keep the capital sentence", "Anlatı", { effects: { rumor: 1 }, stageTo: 3 })),
    later("dc_p02_manset3", { stage: 3, tags: ["period", "2002", "long", "media", "memory"] },
      "İki ülke alışkanlık olur",
      "Program çıkmış olsa da manşet ile ilçe ayrı arşiv tutar. Devlet, resmi sesi tek ülke sandı; saha notu ikinci ülkeyi kurdu.",
      "Two countries become a habit",
      "Even if the program has exited, headline and district keep separate archives. The state mistook the official voice for one country; the field note built a second.",
      choice("one", "Tek arşivi zorla", "Force a single archive", "Kurum", { stageTo: 4 }),
      choice("two", "İki arşivi kabul et", "Accept the two archives", "Parça", { stageTo: 4 })),
  ],
});
push({
  id: "pg-parca", arc: "media", era: "gunumuz", tags: ["period", "gunumuz", "media", "group", "trust", "cross"],
  nodes: [
    opening("dc_pg_parca", { era: "gunumuz", needGroup: "media", minFragmentation: 42, tags: ["period", "gunumuz", "media", "trust"] },
      "Parçalanmış gündem, aynı ay",
      "Resmî kanal ekonomi konuşur. Sokak kanalı kira konuşur. Salience cetveli 'ekonomi' der; hane 'sözleşme' der. Bu bir parti vaadi değil: fragmantasyon, aynı ayın iki ülke gibi durmasıdır.",
      "A fragmented agenda, the same month",
      "The official channel talks economy. The street channel talks rent. The salience ruler says economy; the household says contract. This is not a party promise: fragmentation is the same month looking like two countries.",
      choice("join", "Kira cümlesini ekonomi brifingine al", "Take the rent sentence into the economy briefing", "Güven", { effects: { info: 1 }, stageTo: 1, next: { eventId: "dc_pg_parca2", dueTurns: 4, key: "pg-parca2" }, echo: "Gündem birleşmedi; iki cümle aynı brifinge girdi." }),
      choice("split", "İki kanalı bırak", "Leave the two channels", "Parça", { effects: { rumor: 2 }, stageTo: 9 })),
    later("dc_pg_parca2", { stage: 2, tags: ["media", "gunumuz", "memory", "trust"] },
      "Güven incelir, manşet sertleşir",
      "Medya güveni düşer. Resmî ses netleştikçe saha notu ayrı kalır. Dominant mesele kâğıtta ekonomi, kapıda kira ise brifing bir yalandır — kasıt değil, ölçü hatası.",
      "Trust thins, the headline hardens",
      "Media trust falls. As the official voice sharpens the field note stays apart. If the dominant issue is economy on paper and rent at the door, the briefing is a falsehood — not intent, a measuring error.",
      choice("measure", "Ölçüyü kapıya bağla", "Tie the measure to the door", "Dürüstlük", { effects: { info: 1 }, stageTo: 3, next: { eventId: "dc_pg_parca3", dueTurns: 36, key: "pg-parca3" } }),
      choice("paper", "Kâğıt meselesini tut", "Keep the paper issue", "Sis", { stageTo: 3 })),
    later("dc_pg_parca3", { stage: 3, tags: ["media", "long", "trust", "gunumuz"] },
      "İki ülke bir iz olur",
      "Yıllar sonra aynı ay hâlâ iki dilde anlatılır. Devlet, resmi kanalı omurga sandı; parçalanma bir alışkanlık kaldı.",
      "Two countries become a trace",
      "Years later the same month is still told in two languages. The state treated the official channel as a spine; fragmentation remained a habit.",
      choice("repair", "Ölçü kuralını yaz", "Write a measuring rule", "Kurum", { stageTo: 4 }),
      choice("leave", "İki dili bırak", "Leave the two languages", "Parça", { stageTo: 4 })),
  ],
});
push({
  id: "md-salience", arc: "media", tags: ["media", "group", "government", "cross"],
  nodes: [
    opening("dc_md_salience", { needGroup: "media", minFragmentation: 36, tags: ["media", "group", "government"] },
      "Gündem cetveli, hane kapısı",
      "Salience cetveli bir meseleyi öne alır. Hane başka kapıyı çalar. Medya güveni bu boşlukta incelir. Oyuncu parti yöneticisi değildir; resmi saati sokak saatiyle yan yana yazmak bir iletişim kalitesidir, bir ikna zaferi değil.",
      "An agenda ruler, a household door",
      "The salience ruler puts one issue first. The household knocks on another door. Media trust thins in that gap. The player is not a party manager; writing the official hour beside the street hour is communication quality, not a persuasion victory.",
      choice("door", "Kapı meselesini cetvele yaz", "Write the door issue onto the ruler", "Güven", { effects: { info: 1 }, stageTo: 1, next: { eventId: "dc_md_salience2", dueTurns: 5, key: "md-salience2" }, echo: "Cetvel kapıyı gördü; resmi saat tek başına kalmadı." }),
      choice("ruler", "Cetveli tut, kapıyı sonra", "Keep the ruler, door later", "Sis", { effects: { rumor: 1 }, stageTo: 9 })),
    later("dc_md_salience2", { stage: 2, tags: ["media", "memory", "group"] },
      "Mesele kayar, güven durur",
      "Üst mesele değişmiş görünür. Güven geri gelmez. Fragmantasyon bir kanal sayısı değil, inanılmayan resmi saattir.",
      "The issue shifts, trust stays",
      "The top issue looks changed. Trust does not come back. Fragmentation is not a channel count; it is an official hour that is not believed.",
      choice("trust", "Güven satırını öne al", "Put the trust line first", "Onarım", { effects: { info: 1 }, stageTo: 3, next: { eventId: "dc_md_salience3", dueTurns: 24, key: "md-salience3" } }),
      choice("issue", "Yeni meseleyi başarı say", "Count the new issue as success", "Anlatı", { stageTo: 3 })),
    later("dc_md_salience3", { stage: 3, tags: ["media", "long", "memory"] },
      "Cetvel bir iz bırakır",
      "Hükümet değişir. Gündem cetveli kalır. Devlet, meseleyi omurga sandı; güven dipnotta durdu.",
      "The ruler leaves a trace",
      "The government changes. The agenda ruler remains. The state treated the issue as a spine; trust sat in a footnote.",
      choice("note", "Güven dipnotunu aç", "Open the trust footnote", "Hafıza", { stageTo: 4 }),
      choice("keep", "Cetveli devret", "Hand the ruler on", "Süreklilik", { stageTo: 4 })),
  ],
});

// --- Catalog fragments are concatenated above this scheduler by the Wave 5 build. ---
const EXTRA_NODES = [];
const extraPush = (node) => { EXTRA_NODES.push(node); };
function extra(id, opts, title, text, enTitle, enText, a, b) {
  extraPush({
    id, stage: opts.stage || 1, organic: false, extra: true, title, text, enTitle, enText,
    choices: [a, b], ...opts,
  });
}

extra("dc_x_arrears", { arc: "fiscal", tags: ["fiscal", "memory", "delayed"], expectedInst: "maliye" },
  "Tahsilat boşluğu mektubu",
  "Kâğıt gelir sahada yok. Revizyon bir çeyrek sonra gelir. Recai 'mevsim' der; kasa 'açık' der.",
  "A collection-gap letter",
  "Paper revenue is missing in the field. The revision arrives a quarter later. Recai says the season; the till says a gap.",
  choice("audit", "Teftişi öne al", "Bring the inspection forward", "Kurum", { effects: { info: 1 }, echo: "Tahsilat boşluğu teftişe yazıldı." }),
  choice("wait", "Mevsimi bekle", "Wait for the season", "Unutuş"));
extra("dc_x_reserve", { arc: "external", tags: ["external", "fiscal", "delayed"], expectedInst: "merkez" },
  "Rezerv incelmesi",
  "Süreyya hattı ihtiyat ister. Hazine fatura konuşur. İki cümle aynı dövizi tarif etmez.",
  "Reserves thin out",
  "Süreyya's line wants a buffer. The treasury talks about the bill. Two sentences do not describe the same currency.",
  choice("hold", "Rezervi tut", "Hold the reserve", "Çapa", { lock: "reserve" }),
  choice("spend", "Faturayı öne al", "Bring the bill forward", "Rıza", { lock: "subsidy" }));
extra("dc_x_brief", { arc: "intelligence", tags: ["intelligence", "media", "delayed"], expectedInst: "istikhbarat" },
  "Brifing kanalı tıkanır",
  "Leyla Koordinasyon 'kanal tıkantısı' yazar. Sessizlik de bir bilgidir. Operasyon cümlesi yoktur; sentez gecikir.",
  "The briefing channel clogs",
  "Leyla Coordination writes a channel bottleneck. Silence is also information. There is no operational sentence; the synthesis is late.",
  choice("open", "Kanalı aç, sentezi geciktirme", "Open the channel, do not delay the synthesis", "Bilgi", { effects: { info: 2 } }),
  choice("quiet", "Tıkanıklığı dipnota al", "Put the clog in a footnote", "Sis", { effects: { rumor: 1 } }));
extra("dc_x_fatigue", { arc: "institution", tags: ["institution", "cadre", "delayed"], expectedInst: "mulkiye" },
  "Mülkiye yorgunluğu",
  "Cemil Vali yüzde 82 yazar. Saha 30 hisseder. Yorgunluk bir kalkan gibi durur; tempo isteği onu delmez.",
  "Interior fatigue",
  "Governor Cemil writes 82 percent. The field feels 30. Fatigue sits like a shield; a demand for pace does not pierce it.",
  choice("rest", "Temposu düşür", "Drop the pace", "Onarım"),
  choice("push", "Yüzdeyi tut", "Keep the percentage", "Yorgunluk", { effects: { heat: 1 } }));
extra("dc_x_media_frag", { arc: "media", tags: ["media", "trust", "delayed"] },
  "Parçalanmış manşet",
  "Resmî anlatı netleşir. Saha notu ayrı kalır. Fragmantasyon yükseldikçe aynı ay iki ülke gibi durur.",
  "A fragmented headline",
  "The official narrative sharpens. The field note stays apart. As fragmentation rises the same month looks like two countries.",
  choice("join", "Saha notunu brifinge ekle", "Add the field note to the briefing", "Güven", { effects: { info: 1 } }),
  choice("split", "İki anlatıyı bırak", "Leave the two narratives", "Parça", { effects: { rumor: 2 } }));
extra("dc_x_energy_bill", { arc: "external", tags: ["external", "fiscal", "group", "delayed"] },
  "Fatura haneye iner",
  "Nuri Hazine enerjiyi siyaset sayar. Dış bağımlılık dipnotta kalır. Hane faturayı başka türlü okur.",
  "The bill enters the household",
  "Nuri at Treasury treats energy as politics. External dependence stays in a footnote. The household reads the bill another way.",
  choice("subsidy", "Faturayı yumuşat", "Soften the bill", "Rıza", { lock: "subsidy", effects: { heat: -2 } }),
  choice("reserve", "Dipnotu aç", "Open the footnote", "Dürüstlük", { lock: "reserve", effects: { info: 1 } }));
extra("dc_x_housing_title", { arc: "development", tags: ["development", "region", "delayed"] },
  "Tapu ayrı, tabela ayrı",
  "Selim İmar daireyi başarı sayar. Keşif ve kalite ayrı dosyadır. Konut seferi fotoğrafta bitmiş, tapuda değil.",
  "Title separate, signboard separate",
  "Selim counts apartments as success. Survey and quality are a separate file. The housing drive finished in the photo, not in the title deed.",
  choice("title", "Tapuyu öne al", "Put the title first", "Hukuk"),
  choice("photo", "Tabelayı tut", "Keep the signboard", "Görünürlük"));
extra("dc_x_youth_job", { arc: "group", tags: ["group", "region", "delayed"] },
  "İlk iş kuyruğu",
  "Büyüme döner. İş ilanı dönmez. Gençler kuyrukta; istatistik 'katılım' der.",
  "A first-job queue",
  "Growth turns. Job ads do not. Youth wait in line; statistics say participation.",
  choice("train", "Staj hattı aç", "Open a trainee line", "Kapasite"),
  choice("wait", "Büyümeyi bekle", "Wait for growth", "Erteleme"));
extra("dc_x_retiree_cola", { arc: "group", needGroup: "retirees", tags: ["group", "fiscal", "delayed"] },
  "Aylık, file, endeks",
  "Aktüerya masada. Sokak 'yaş' duyar. Emekli hane filesi resmi sepetten ayrı şişer.",
  "A pension, a bag, an index",
  "Actuarial notes are on the desk. The street hears age. The pensioner bag inflates apart from the official basket.",
  choice("cola", "Filesi ayrı izle", "Watch the bag separately", "Rıza"),
  choice("param", "Parametreyi anlat", "Explain the parameter", "Maliyet", { effects: { heat: 1 } }));
extra("dc_x_farmers_delay", { arc: "group", tags: ["group", "fiscal", "region", "delayed"] },
  "Destek ödeme gecikmesi",
  "Çiftçi sırada. Sistem 'aktarıldı' der. Hasan Bey'in vade sisi hâlâ durur.",
  "A delayed support payment",
  "The farmer is in line. The system says transferred. Hasan Bey's fog of due dates is still there.",
  choice("pay", "Sırayı bitir", "Finish the line", "Rıza", { effects: { heat: -1 } }),
  choice("system", "Aktarıldı yazısını tut", "Keep the transferred note", "Kâğıt"));
extra("dc_x_labor_flex", { arc: "group", tags: ["group", "fiscal", "delayed"] },
  "Esneklik kâğıdı, güvence iner",
  "İstihdam kâğıtta artar. Güvence iner. Çalışanlar aynı büyümeyi başka türlü yaşar.",
  "A flexibility paper, security falls",
  "Employment rises on paper. Security falls. Workers live the same growth another way.",
  choice("note", "Güvence dipnotu yaz", "Write a security footnote", "Rıza"),
  choice("flex", "Kâğıdı tut", "Keep the paper", "Piyasa"));
extra("dc_x_business_rate", { arc: "group", tags: ["group", "fiscal", "delayed"] },
  "Faiz, teminat, Anadolu",
  "İş dünyası güler. Şube 'teminat' der. KOBİ ile ihracatçı aynı kredi cümlesinde değildir.",
  "A rate, collateral, Anatolia",
  "Business smiles. The branch says collateral. The SME and the exporter are not in the same credit sentence.",
  choice("sme", "KOBİ hattını ayır", "Split an SME line", "Adalet"),
  choice("price", "Teminatı piyasa say", "Treat collateral as the market", "Piyasa"));
extra("dc_x_bureaucracy", { arc: "group", needGroup: "bureaucracy", tags: ["group", "institution", "delayed"] },
  "Dosya hükümetten uzun",
  "Kamu kadrosu tempo ister, yorgunluk da ister. İkisi aynı koridorda. Bürokrasi bir kalkan ve bir tıkaç.",
  "The file outlives the government",
  "The public cadre wants pace and also wants rest. Both live in the same corridor. Bureaucracy is a shield and a plug.",
  choice("pace", "Temposu yaz", "Write a pace", "Hükümet"),
  choice("shield", "Kalkanı koru", "Keep the shield", "Süreklilik"));
extra("dc_x_urban_rent", { arc: "group", tags: ["group", "region", "delayed"] },
  "Kira yenileme dalgası",
  "Hane planı bir yıla sığmaz. Resmi ortalama gizler. Kentli orta sınıf dosyayı 'enflasyon' değil 'sözleşme' diye okur.",
  "A rent-renewal wave",
  "The household plan does not fit a year. The official average hides it. The urban middle class reads the file as a contract, not as inflation.",
  choice("relief", "Yenilemeyi yumuşat", "Soften the renewal", "Rıza", { lock: "relief" }),
  choice("supply", "Arz cümlesini tut", "Keep the supply sentence", "Piyasa", { lock: "supply" }));
extra("dc_x_rural_clinic", { arc: "development", tags: ["development", "group", "region", "delayed"] },
  "Poliklinik kuyruğu, nöbet listesi",
  "Tabela asılı. Nöbet listesi eski. Kırsal hizmet, kent dönüşüm diline çevrilince sıra uzar.",
  "A clinic queue, a night-shift list",
  "The sign is up. The night-shift list is old. When rural service is translated into urban-transformation language, the queue lengthens.",
  choice("staff", "Nöbeti kaydır", "Move a night shift", "Kapasite"),
  choice("sign", "Tabelayı başarı say", "Count the sign as success", "Görünürlük"));
extra("dc_x_security_desk", { arc: "group", needGroup: "security", tags: ["group", "security", "form", "delayed"] },
  "Güvenlik masası, sivil dipnot",
  "Güvenlik bürokrasisi tempo ister. Sivil reform iki hafta kayar. Haluk Paşa bütçe satırının gecikmeli şişeceğini bilir.",
  "A security desk, a civil footnote",
  "The security bureaucracy wants pace. Civil reform slips two weeks. Haluk Pasha knows the budget line will swell late.",
  choice("civil", "Sivil dipnotu üstte tut", "Keep the civil footnote on top", "Müzakere", { lock: "civilian" }),
  choice("desk", "Masayı tut", "Hold the desk", "Düzen", { lock: "posture" }));
extra("dc_x_form_entry", { arc: "form", tags: ["form", "memory", "delayed"] },
  "Biçim giriş notu",
  "Devlet biçimi bir sınıf değil, bir eğilimdir. Giriş cümlesi arşive yazılır; çıkış cümlesi henüz yoktur.",
  "A form-entry note",
  "A state form is a tendency, not a class. The entry sentence is written into the archive; the exit sentence does not exist yet.",
  choice("trace", "Giriş izini tut", "Keep the entry trace", "Hafıza"),
  choice("ignore", "Eğilimi konuşma", "Do not discuss the tendency", "Sükût"));
extra("dc_x_world_growth", { arc: "external", tags: ["external", "delayed"] },
  "Küresel büyüme yavaşlar",
  "Dış talep iner. İç yatırım aynı cümlede 'ihracat' demeye devam eder. Precursor içeride bir çeyrek sonra duyulur.",
  "Global growth slows",
  "External demand falls. Domestic investment keeps saying export in the same sentence. The precursor is heard inside a quarter later.",
  choice("buffer", "İç talebi yastık say", "Treat domestic demand as a cushion", "Rıza"),
  choice("cut", "Yatırımı kıs", "Cut investment", "Disiplin", { effects: { heat: 1 } }));
extra("dc_x_world_rates", { arc: "external", tags: ["external", "fiscal", "delayed"] },
  "Küresel faiz, iç çapa",
  "Dış faiz yükselir. İç çapa siyasi maliyet olarak durur. Süreyya kapıda tutulan faizi görür.",
  "Global rates, a domestic anchor",
  "Foreign rates rise. The domestic anchor sits as political cost. Süreyya sees the rate being held at the door.",
  choice("signal", "Sinyali erken ver", "Give the signal early", "Otorite"),
  choice("delay", "Kapıyı tut", "Hold the door", "Maliyet"));
extra("dc_x_trade_demand", { arc: "external", tags: ["external", "development", "delayed"] },
  "Ticaret talebi kayar",
  "Sipariş defteri incelir. Gümrük kapısı aynı fotoğrafı asar. Echo bir yıl sonra istihdamda duyulur.",
  "Trade demand shifts",
  "The order book thins. The customs gate hangs the same photograph. The echo is heard a year later in employment.",
  choice("credit", "İhracat kredisini ayır", "Split export credit", "Piyasa"),
  choice("wait", "Siparişi bekle", "Wait for orders", "Erteleme"));
extra("dc_x_regional_risk", { arc: "external", tags: ["external", "security", "delayed"] },
  "Bölgesel risk notu",
  "Dış masa iç reformu iki hafta öteye iter. Her zaman iter. Haluk bunu bütçe satırına geç yazmak istemez.",
  "A regional-risk note",
  "The foreign desk always postpones internal reform two weeks. Haluk does not want to write that late into the budget line.",
  choice("calendar", "İç takvimi kilitle", "Lock the domestic calendar", "Kurum"),
  choice("defer", "Dış masayı öne al", "Put the foreign desk first", "Güvenlik"));
extra("dc_x_quake_ghost", { arc: "development", tags: ["development", "region", "delayed", "long"] },
  "Afet artığı, hayalet dosya",
  "Eski hasar satırı hâlâ açık. Yeni bütçe onu görmezden gelir. Pay aktarılır; kalite denetimi ayrı satır.",
  "A disaster leftover, a ghost file",
  "The old damage line is still open. The new budget ignores it. Money is transferred; quality control is a separate line.",
  choice("inspect", "Kalite satırını aç", "Open the quality line", "Kurum"),
  choice("pay", "Payı aktar, denetimi sonra", "Transfer the share, inspect later", "Rıza"));
extra("dc_x_water_loss", { arc: "development", tags: ["development", "region", "delayed"] },
  "Su kaybı, kayıp-kaçak",
  "Boru konuşulur. Kayıp-kaçak dipnotta. Belediye keşif defteri şişer; çeşme aynı kalır.",
  "Water loss, leakage",
  "Pipes are discussed. Leakage stays in a footnote. The municipality's survey book swells; the fountain stays the same.",
  choice("pipe", "Boru payı yaz", "Write a pipe share", "Altyapı"),
  choice("note", "Dipnotu kapat", "Close the footnote", "Sükût"));
extra("dc_x_school_desk", { arc: "development", tags: ["development", "cadre", "delayed"] },
  "Derslik hesabı, boş sıra",
  "Melisa Öğretim kontenjanı başarı yazar. Derslik hesabı şişer. Tabela çoğalır, hoca yetişmez.",
  "A classroom count, an empty bench",
  "Melisa in Education writes quotas as success. The classroom count inflates. Signboards multiply; teachers do not keep up.",
  choice("teacher", "Hoca kaydır", "Move a teacher", "Kapasite"),
  choice("quota", "Kontenjanı tut", "Keep the quota", "Tabela"));
extra("dc_x_stat_lag", { arc: "media", tags: ["media", "trust", "intelligence", "delayed"] },
  "Gecikmiş seri, piyasa sayısı",
  "TÜFE takvimi kayar. Piyasa kendi enflasyonunu konuşur. Bilgi kalitesi bir kurum meselesidir, manşet meselesi değil.",
  "A late series, a market number",
  "The CPI calendar slips. The market talks its own inflation. Information quality is an institutional matter, not a headline matter.",
  choice("publish", "Seriyi zamanında çıkar", "Publish the series on time", "Güven", { effects: { info: 2 } }),
  choice("hold", "Takvimi siyasi say", "Treat the calendar as politics", "Sis", { effects: { rumor: 2 } }));
extra("dc_x_gov_capital", { arc: "government", tags: ["government", "memory", "delayed"] },
  "Siyasi sermaye, kurum kısıtı",
  "Mandat yüksek görünür. Uygulama kapasitesi alçak. Hükümet tempo ister; devlet hafızası dosyayı yavaşlatır.",
  "Political capital, an institutional constraint",
  "The mandate looks high. Delivery capacity is low. Government wants pace; state memory slows the file.",
  choice("file", "Dosyayı tut", "Keep the file", "Süreklilik"),
  choice("pace", "Temposu yaz", "Write the pace", "Mandat"));
extra("dc_x_cadre_wrong", { arc: "cadre", tags: ["cadre", "institution", "delayed"] },
  "Yanlış alan, doğru CV",
  "Teknokrat CV'si masada. Koridor sadakat sorar. Uzmanlık alanı ile dosya alanı aynı değilse uygulama düz taban olur.",
  "Wrong domain, a correct CV",
  "A technocrat CV is on the desk. The corridor asks about loyalty. If the expertise domain and the file domain differ, delivery goes flat.",
  choice("fit", "Alanı eşle", "Match the domain", "Liyakat", { lock: "merit" }),
  choice("loyal", "Koridoru dinle", "Listen to the corridor", "Sadakat", { lock: "loyalty" }));
extra("dc_x_east_service", { arc: "region", tags: ["region", "development", "delayed"] },
  "Doğu hizmet satırı",
  "Kamu işi bekler. Marmara kredi yer. Aynı teşvik cümlesi iki bölgeyi tarif etmez.",
  "An eastern service line",
  "Public work waits. Marmara eats credit. The same incentive sentence does not describe two regions.",
  choice("east", "Doğu satırını aç", "Open the eastern line", "Adalet", { lock: "east" }),
  choice("west", "Kredi ısısını izle", "Watch the credit heat", "Piyasa", { lock: "west" }));
extra("dc_x_west_heat", { arc: "region", tags: ["region", "group", "delayed"] },
  "Marmara ısısı, altyapı yükü",
  "Kredi yer, konut ısınır, belediye yükü şişer. Batı 'başarı' der; şebeke 'kapasite' der.",
  "Marmara heat, an infrastructure load",
  "Credit is eaten, housing warms, municipal load swells. The west says success; the grid says capacity.",
  choice("grid", "Şebeke payı yaz", "Write a grid share", "Altyapı", { lock: "west" }),
  choice("cool", "Isıyı Doğu'ya kaydırma", "Do not shift the heat east", "Denge", { lock: "east" }));
extra("dc_x_long_debt", { arc: "fiscal", tags: ["fiscal", "long", "delayed"] },
  "Üç yıl, aynı faiz dışı cümle",
  "Program çıkmış olsa da disiplin cümlesi durur. Kasa, hanenin unuttuğu bir vaadi hatırlar.",
  "Three years, the same primary-surplus sentence",
  "Even if the program has exited the discipline sentence remains. The till remembers a promise the household forgot.",
  choice("keep", "Cümleyi içselleştir", "Internalise the sentence", "Kurum"),
  choice("forget", "Vaadi kapat", "Close the promise", "Rıza"));
extra("dc_x_long_form", { arc: "form", tags: ["form", "long", "memory", "delayed"] },
  "Biçim kalır, hükümet gider",
  "Eğilim class değildir. Yıllar sonra aynı omurga başka isimle yürür. Dossier bunu rakam değil cümle olarak tutar.",
  "The form remains, the government leaves",
  "A tendency is not a class. Years later the same spine walks under another name. The dossier keeps this as a sentence, not a number.",
  choice("name", "Omurgayı adlandır", "Name the spine", "Hafıza"),
  choice("soft", "Eğilimi yumuşat", "Soften the tendency", "Müzakere"));
extra("dc_x_intel_warn", { arc: "intelligence", tags: ["intelligence", "delayed"] },
  "Uyarı isabeti",
  "Leyla 'belirsizliği abartmamaya' çalışır. Erken uyarı kaçınca sessizlik de bir karar gibi durur.",
  "Warning accuracy",
  "Leyla tries not to overstate uncertainty. When an early warning is missed, silence also looks like a decision.",
  choice("log", "Kaçanı kaydet", "Record the miss", "Öğrenme", { effects: { info: 1 } }),
  choice("smooth", "Sessizliği bilgi say", "Count silence as information", "Sis"));
extra("dc_x_intel_coord", { arc: "intelligence", tags: ["intelligence", "institution", "delayed"] },
  "Koordinasyon darboğazı",
  "Üç kurum aynı riski ayrı zarfta taşır. Sentez masası boş kalır. Bu bir operasyon değil, bir bürokrasi tıkanıklığıdır.",
  "A coordination bottleneck",
  "Three institutions carry the same risk in separate envelopes. The synthesis desk stays empty. This is not an operation; it is a bureaucratic clog.",
  choice("desk", "Sentez masasını kur", "Set a synthesis desk", "Koordinasyon"),
  choice("env", "Zarfları ayrı tut", "Keep the envelopes separate", "Özerklik"));
extra("dc_x_intel_assess", { arc: "intelligence", tags: ["intelligence", "external", "delayed"] },
  "Stratejik değerlendirme gecikir",
  "Dış risk iç dosyaya bir ay geç düşer. Uyarı kalitesi, saha kapasitesinden bağımsız şişebilir.",
  "A strategic assessment is late",
  "External risk falls into the domestic file a month late. Warning quality can inflate independently of field capacity.",
  choice("date", "Tarihi açık yaz", "Write the date in the open", "Dürüstlük", { effects: { info: 1 } }),
  choice("glow", "Kaliteyi parlat", "Polish the quality", "İtibar"));
extra("dc_x_intel_risk", { arc: "intelligence", tags: ["intelligence", "crisis", "delayed"] },
  "Risk sentezi, abartı eşiği",
  "Her kriz ailesi aynı brifinge sığmaz. Sentez, en gürültülü aileyi seçerse diğer altı dipnota iner.",
  "Risk synthesis, a threshold of exaggeration",
  "Not every crisis family fits the same briefing. If synthesis picks the loudest family, the other six fall to a footnote.",
  choice("seven", "Yedi aileyi yan yana yaz", "Write the seven families side by side", "Denge"),
  choice("loud", "Gürültülüyü öne al", "Put the loud one first", "Tempo"));
extra("dc_x_intel_bureau", { arc: "intelligence", tags: ["intelligence", "institution", "delayed"] },
  "İstihbarat büro tıkanıklığı",
  "Bilgi var, imza sırası uzun. Darboğaz yöntem değil; kalem ve yetki sırası.",
  "An intelligence office clog",
  "The information exists; the signature queue is long. The bottleneck is not a method; it is a pen and a permission order.",
  choice("sign", "İmza sırasını kısalt", "Shorten the signature queue", "Tempo"),
  choice("queue", "Sırayı kurum say", "Treat the queue as the institution", "Süreklilik"));
extra("dc_x_network_affinity", { arc: "network", tags: ["network", "form", "delayed"] },
  "Ağ yakınlığı, yazılı yetki",
  "Kaynak ve erişim, yazılı yetkinin yanında yürür. Yüklenici halkası şartnameden önce konuşuyorsa profesyonel kalkan incelmiştir.",
  "Network affinity, written authority",
  "Resources and access walk beside written authority. If the contractor ring speaks before the specification, the professional shield has thinned.",
  choice("spec", "Şartnameyi öne al", "Put the specification first", "Kurum"),
  choice("ring", "Halkayı yok sayma, izle", "Do not ignore the ring; watch it", "Şeffaflık", { effects: { info: 1 } }));
extra("dc_x_pop_headline", { arc: "form", tags: ["form", "media", "delayed"] },
  "Manşet iddiası, kasa uzun",
  "Rıza kısa, kasa uzun. Popülist eğilim class değil; fatura ve kira vaadi geçtiğinde güven parçalanır.",
  "A headline claim, a long till",
  "Consent is short, the till is long. A populist tendency is not a class; when the bill and the rent pass the promise, trust fragments.",
  choice("bill", "Faturayı konuş", "Talk about the bill", "Dürüstlük"),
  choice("headline", "Manşeti tut", "Keep the headline", "Rıza"));
extra("dc_x_press_hour", { arc: "media", tags: ["media", "government", "delayed"] },
  "Basın saati, iki cümle",
  "Resmî brifing bir cümle ister. Muhabir ikinciyi sorar. Cevapsız ikinci cümle, ertesi gün saha notu olur. Bu bir ikna zaferi değildir; iletişim kalitesidir.",
  "A press hour, two sentences",
  "The official briefing wants one sentence. The reporter asks for a second. An unanswered second sentence becomes a field note the next day. This is not a persuasion victory; it is communication quality.",
  choice("second", "İkinci cümleyi yaz", "Write the second sentence", "Güven", { effects: { info: 1 } }),
  choice("one", "Tek cümleyi tut", "Keep the one sentence", "Sis", { effects: { rumor: 1 } }));
extra("dc_x_radio_echo", { arc: "media", tags: ["media", "period", "delayed", "long"] },
  "Radyo saatinin eksi",
  "Akşam yayını yıllar sonra hâlâ 'resmî saat' diye anılır. Kahvehane kendi arşivini kurmuştur. Echo, inanılmayan cümlenin tekrar edilmesidir.",
  "The radio hour's echo",
  "Years later the evening broadcast is still called the official hour. The coffeehouse has built its own archive. The echo is the repetition of a sentence that is not believed.",
  choice("archive", "İki arşivi yan yana tut", "Keep the two archives side by side", "Hafıza", { effects: { info: 1 } }),
  choice("official", "Resmî saati tek tut", "Keep only the official hour", "Anlatı"));
extra("dc_x_issue_salience", { arc: "media", tags: ["media", "group", "delayed"] },
  "Üst mesele, kapı meselesi",
  "Salience cetveli bir dosyayı öne alır. Hane başka kapıyı çalar. Güven, cetvelin değil kapının işi olursa resmi saat boşta kalır.",
  "A top issue, a door issue",
  "The salience ruler puts one file first. The household knocks on another door. If trust becomes the door's job and not the ruler's, the official hour sits empty.",
  choice("door", "Kapıyı cetvele bağla", "Tie the door to the ruler", "Güven", { effects: { info: 1 } }),
  choice("ruler", "Cetveli tut", "Keep the ruler", "Sis", { effects: { rumor: 1 } }));


export const EXTRA_CALLBACKS = [
  { eventId: "dc_x_arrears", dueTurns: 4, key: "x-arrears", expectedInst: "maliye", test: (s) => (s.devletDepth?.macro?.taxBurden || 0) >= 40 },
  { eventId: "dc_x_reserve", dueTurns: 5, key: "x-reserve", expectedInst: "merkez", test: (s) => (s.devletDepth?.macro?.reserves || 50) < 40 || (s.devletDepth?.world?.globalRates || 0) > 60 },
  { eventId: "dc_x_brief", dueTurns: 3, key: "x-brief", expectedInst: "istikhbarat", test: (s) => Boolean(inst(s, "istikhbarat")) && (s.infoQuality || 50) < 48 },
  { eventId: "dc_x_fatigue", dueTurns: 4, key: "x-fatigue", expectedInst: "mulkiye", test: (s) => (inst(s, "mulkiye")?.fatigue || 0) >= 28 },
  { eventId: "dc_x_media_frag", dueTurns: 5, key: "x-media-frag", test: (s) => (s.devletDepth?.media?.fragmentation || 0) >= 48 },
  { eventId: "dc_x_energy_bill", dueTurns: 4, key: "x-energy", test: (s) => (s.devletDepth?.world?.energyPressure || 0) >= 58 },
  { eventId: "dc_x_housing_title", dueTurns: 6, key: "x-housing", expectedInst: "belediye", test: (s) => (s.policyDebt?.housing || 0) >= 28 || (s.eraId === "gunumuz") },
  { eventId: "dc_x_youth_job", dueTurns: 6, key: "x-youth", test: (s) => (s.actual?.unemployment || 0) >= 12 || (group(s, "youth")?.pressure || 0) >= 40 },
  { eventId: "dc_x_retiree_cola", dueTurns: 5, key: "x-retiree", test: (s) => (s.actual?.inflation || 0) >= 16 || (group(s, "retirees")?.pressure || 0) >= 36 },
  { eventId: "dc_x_farmers_delay", dueTurns: 6, key: "x-farmers", test: (s) => (group(s, "farmers")?.pressure || 0) >= 32 || s.eraId === "1950" },
  { eventId: "dc_x_labor_flex", dueTurns: 7, key: "x-labor", test: (s) => (group(s, "labor")?.satisfaction || 50) < 46 },
  { eventId: "dc_x_business_rate", dueTurns: 5, key: "x-business", test: (s) => (s.devletDepth?.macro?.interestRate || 0) >= 20 },
  { eventId: "dc_x_bureaucracy", dueTurns: 8, key: "x-bureau", test: (s) => (s.entropy || 0) >= 42 },
  { eventId: "dc_x_urban_rent", dueTurns: 5, key: "x-urban-rent", test: (s) => (group(s, "urban")?.pressure || 0) >= 36 || s.eraId === "gunumuz" },
  { eventId: "dc_x_rural_clinic", dueTurns: 7, key: "x-rural-clinic", test: (s) => (group(s, "rural")?.satisfaction || 50) < 48 },
  { eventId: "dc_x_security_desk", dueTurns: 6, key: "x-security", test: (s) => (s.dna?.security || 50) >= 58 || (group(s, "security")?.pressure || 0) >= 40 },
  { eventId: "dc_x_form_entry", dueTurns: 9, key: "x-form-entry", test: (s) => Boolean(s.form) && (s.time?.turn || 0) >= 8 },
  { eventId: "dc_x_world_growth", dueTurns: 5, key: "x-world-growth", test: (s) => (s.devletDepth?.world?.globalGrowth || 50) < 46 },
  { eventId: "dc_x_world_rates", dueTurns: 5, key: "x-world-rates", test: (s) => (s.devletDepth?.world?.globalRates || 0) >= 55 },
  { eventId: "dc_x_trade_demand", dueTurns: 6, key: "x-trade", test: (s) => (s.devletDepth?.world?.tradeDemand || 50) < 48 },
  { eventId: "dc_x_regional_risk", dueTurns: 6, key: "x-reg-risk", test: (s) => (s.devletDepth?.world?.regionalRisk || 0) >= 55 },
  { eventId: "dc_x_quake_ghost", dueTurns: 12, key: "x-quake", test: (s) => (s.policyDebt?.quake || 0) >= 24 || s.eraId === "gunumuz" },
  { eventId: "dc_x_water_loss", dueTurns: 8, key: "x-water", test: (s) => (s.policyDebt?.water || 0) >= 24 },
  { eventId: "dc_x_school_desk", dueTurns: 8, key: "x-school", expectedInst: "maarif", test: (s) => (s.policyDebt?.education || 0) >= 24 },
  { eventId: "dc_x_stat_lag", dueTurns: 4, key: "x-stat-lag", test: (s) => (s.infoQuality || 50) < 46 || (s.devletDepth?.media?.trust || 50) < 42 },
  { eventId: "dc_x_gov_capital", dueTurns: 6, key: "x-gov-cap", test: (s) => (s.devletDepth?.government?.politicalCapital || 50) < 48 || (s.devletDepth?.government?.mandate || 50) > 62 },
  { eventId: "dc_x_cadre_wrong", dueTurns: 7, key: "x-cadre-wrong", test: (s) => (s.devletDepth?.cadres || []).some((c) => (c.networkRisk || 0) >= 48) },
  { eventId: "dc_x_east_service", dueTurns: 8, key: "x-east", test: (s) => (region(s, "dogu")?.services || 50) < 48 || shownBranch(s, "region-path") === "east" },
  { eventId: "dc_x_west_heat", dueTurns: 8, key: "x-west", test: (s) => (region(s, "marmara")?.heat || 0) >= 44 || shownBranch(s, "region-path") === "west" },
  { eventId: "dc_x_long_debt", dueTurns: 36, key: "x-long-debt", test: (s) => (s.time?.turn || 0) >= 18 && (s.devletDepth?.macro?.publicDebt || 0) >= 50 },
  { eventId: "dc_x_long_form", dueTurns: 24, key: "x-long-form", test: (s) => (s.time?.turn || 0) >= 20 },
  { eventId: "dc_x_intel_warn", dueTurns: 5, key: "x-intel-warn", expectedInst: "istikhbarat", test: (s) => Boolean(inst(s, "istikhbarat")) && (s.infoQuality || 50) < 52 },
  { eventId: "dc_x_intel_coord", dueTurns: 6, key: "x-intel-coord", expectedInst: "istikhbarat", test: (s) => Boolean(inst(s, "istikhbarat")) },
  { eventId: "dc_x_intel_assess", dueTurns: 7, key: "x-intel-assess", expectedInst: "istikhbarat", test: (s) => Boolean(inst(s, "istikhbarat")) && (s.devletDepth?.world?.regionalRisk || 0) >= 40 },
  { eventId: "dc_x_intel_risk", dueTurns: 5, key: "x-intel-risk", expectedInst: "istikhbarat", test: (s) => Boolean(inst(s, "istikhbarat")) && (s.devletDepth?.crises?.active || []).length >= 1 },
  { eventId: "dc_x_intel_bureau", dueTurns: 8, key: "x-intel-bureau", expectedInst: "istikhbarat", test: (s) => Boolean(inst(s, "istikhbarat")) && (inst(s, "istikhbarat")?.fatigue || 0) >= 20 },
  { eventId: "dc_x_network_affinity", dueTurns: 6, key: "x-network", test: (s) => (s.networks || []).some((n) => (n.pressure || 0) >= 14) },
  { eventId: "dc_x_pop_headline", dueTurns: 6, key: "x-pop", test: (s) => s.form === "Popülist-Devlet" || (s.heat || 0) >= 62 },
  { eventId: "dc_x_press_hour", dueTurns: 4, key: "x-press-hour", test: (s) => (s.devletDepth?.media?.trust || 50) < 48 || (s.infoQuality || 50) < 50 },
  { eventId: "dc_x_radio_echo", dueTurns: 24, key: "x-radio-echo", test: (s) => Boolean(bag(s)?.once["seen:dc_p50_radyo"] || bag(s)?.once["seen:dc_p23_teblig"] || s.eraId === "1950") },
  { eventId: "dc_x_issue_salience", dueTurns: 5, key: "x-issue-salience", test: (s) => (s.devletDepth?.media?.fragmentation || 0) >= 40 || (s.devletDepth?.media?.salience?.economy || 0) >= 58 },
];

export const DOSSIER_TRACE_TEMPLATES = [
  { id: "dc-trace-fiscal", test: (s) => Boolean(bag(s)?.exclusive["fiscal-path"]), text: "Kasa ile rıza aynı hasadı tarif etmedi; sıkı tutmak ya da seferi öne almak bir omurga bıraktı." },
  { id: "dc-trace-security", test: (s) => Boolean(bag(s)?.exclusive["security-path"]), text: "Güvenlik cümlesi ile sivil takvim aynı haftaya sığmadı; biri dipnota indi." },
  { id: "dc-trace-housing", test: (s) => Boolean(bag(s)?.exclusive["housing-path"]), text: "Konut ya arz cümlesi oldu ya da yenileme rahatlatması; tapu ayrı dosyada kaldı." },
  { id: "dc-trace-eu", test: (s) => Boolean(bag(s)?.exclusive["eu-path"]), text: "Fasıl takvimi ile mahkeme kalemi aynı tempo olmadı; kapı aralandı ya da iç onarım seçildi." },
  { id: "dc-trace-cadre", test: (s) => Boolean(bag(s)?.exclusive["cadre-path"]), text: "Liyakat CV'si ile koridor sadakati aynı koltuğa sığmadı." },
  { id: "dc-trace-media", test: (s) => Boolean(bag(s)?.exclusive["media-path"]), text: "Resmî ses netleşti ya da kısa tutuldu; saha notu ayrı kaldı." },
  { id: "dc-trace-region", test: (s) => Boolean(bag(s)?.exclusive["region-path"]), text: "Doğu hizmeti ile batı ısısı aynı teşvik cümlesine sığmadı." },
  { id: "dc-trace-inflation", test: (s) => Boolean(bag(s)?.exclusive["inflation-path"]), text: "Çekirdek çapa ile sokak sepeti aynı ayı tarif etmedi." },
  { id: "dc-trace-external", test: (s) => Boolean(bag(s)?.exclusive["external-path"]), text: "Rezerv tutmak ile faturayı yumuşatmak aynı dövizi tarif etmedi." },
  { id: "dc-trace-spine", test: (s) => Boolean(bag(s)?.exclusive["form-spine"]), text: "Devlet omurgası kışla temposu ya da büro dosyası olarak yürüdü." },
  { id: "dc-trace-mandate", test: (s) => Boolean(bag(s)?.exclusive["form-mandate"]), text: "Parti temposu ile kısa rıza aynı mandatı taşımadı." },
  { id: "dc-trace-local", test: (s) => Boolean(bag(s)?.exclusive["local-path"]), text: "Yerel pay ile merkez hattı aynı uygulamayı doğurmadı." },
  { id: "dc-trace-crisis", test: (s) => (s.devletDepth?.crises?.history || []).length >= 1, text: "Kriz aileleri uyarıdan artçıya yürüdü; devlet hafızası hükümetten uzun kaldı." },
  { id: "dc-trace-inst", test: (s) => (s.institutions || []).some((row) => (row.memory || []).length), text: "Bir kurum kurtarıldı ya da yoruldu; kapasite yüzde olarak şişse de saha binayı aradı." },
  { id: "dc-trace-cadre-mem", test: (s) => (s.devletDepth?.cadres || []).some((row) => row.profileId), text: "Kadrolar isim kazandı; uzmanlık alanı ile dosya alanı her zaman eşleşmedi." },
  { id: "dc-trace-gov", test: (s) => (s.devletDepth?.government?.terms || 0) >= 1 || (s.history || []).some((row) => row.type === "period-transition"), text: "Hükümet geldi gitti; dosya kaldı." },
  { id: "dc-trace-region-neg", test: (s) => (s.regions || []).some((row) => (row.services || 50) < 42), text: "İhmal edilen bölge hizmet satırında kaldı; göç çekimi kente kaydı." },
  { id: "dc-trace-dev", test: (s) => Boolean(bag(s)?.once["seen:dc_p50_yol"] || bag(s)?.once["seen:dc_x_water_loss"] || bag(s)?.once["seen:dc_x_quake_ghost"]), text: "Yol, boru ve afet artığı uzun vadeli iz bıraktı; afiş bakımdan hızlıydı." },
  { id: "dc-trace-form", test: (s) => Boolean(s.form), text: "Devlet biçimi bir eğilim olarak yürüdü; giriş cümlesi arşive, çıkış cümlesi sahaya yazıldı." },
  { id: "dc-trace-external-res", test: (s) => (s.devletDepth?.world?.energyPressure || 0) >= 50 || (s.devletDepth?.macro?.externalPressure || 0) >= 50, text: "Dış şok içeride bir çeyrek sonra duyuldu; precursor ile echo aynı ay değildi." },
  { id: "dc-trace-intel", test: (s) => Boolean(inst(s, "istikhbarat")) && (bag(s)?.once["seen:dc_x_brief"] || bag(s)?.once["seen:dc_x_intel_warn"]), text: "İstihbarat brifingi koordinasyon ve sentez darboğazı olarak kaldı; yöntem dosyası açılmadı." },
  { id: "dc-trace-network", test: (s) => (s.networks || []).some((n) => (n.pressure || 0) >= 16) || Boolean(bag(s)?.once["seen:dc_x_network_affinity"]), text: "Ağ baskısı yazılı yetkinin yanında yürüdü; şartname her zaman önce konuşulmadı." },
];

export const POLICY_PROSE = {
  iskan: { period: "1923", rationale: "Mübadil yerleştirme idareyi şişirir; telgraf gecikmesi sahayı gizler.", groups: "Kırsal nüfus, bürokrasi", short: "Hane dolar, rapor gecikir.", medium: "Nüfus defteri dolar, çadır inmez.", long: "Kaza kendi hâline bırakılırsa öğretmen de gelmez.", risk: "Kâğıt şişmesi", reversal: "Yerleştirmeyi durdurmak ısıyı yükseltir.", trace: "İskân kâğıtta bitti, odada bitmedi." },
  "vergi-idare": { period: "1923", rationale: "Kâğıt bütçe ile tahsilat ayrılır.", groups: "Çiftçiler, maliye", short: "Ölçü tartışması hasadı ikiye böler.", medium: "Revizyon bir çeyrek sonra gelir.", long: "Aşar kalksa da ölçü cümlesi kalır.", risk: "Kır öfkesi", reversal: "Gevşetmek rıza alır, açığı büyütür.", trace: "Defter fazlası kayboldu." },
  "maarif-sefer": { period: "1923", rationale: "Uzun elit havuzu; kısa kasa.", groups: "Gençler, kırsal", short: "Tabela asılır.", medium: "Hoca telgrafı kaybolur.", long: "Sıra yarım kalır.", risk: "Görünürlük illüzyonu", reversal: "Hasat sonrasına ertelemek seferi söndürür.", trace: "Mektep açılmış göründü, sıra çamurda kaldı." },
  "kanun-set": { period: "1923", rationale: "Metin hızlanır, uygulama taşrada takılır.", groups: "Bürokrasi, yargı", short: "Set Ankara'da biter.", medium: "Kâtip eski ciltte kalır.", long: "İki hız iki adalet olur.", risk: "Boşluk", reversal: "Seti geri çekmek tempo kaybettirir.", trace: "Kanun seti arşivde tam, taşra cildi yırtık." },
  "merkez-tasra": { period: "1923", rationale: "Telgraf sinir sistemidir.", groups: "Mülkiye, kırsal", short: "Hat kurulur.", medium: "Rapor yumuşar.", long: "Merkez iyimser, kaza sessiz kalır.", risk: "Bilgi kopuğu", reversal: "Yerel özerklik hattı gevşetir.", trace: "Kaymakam raporu kayıptı." },
  "emisyon-ihtiyat": { period: "1923", rationale: "Kâğıt para refleksini sınırlar.", groups: "İş dünyası, hane", short: "Emisyon kısılır.", medium: "Rıza başka dağılır.", long: "Erken kesim alışkanlığı kalır.", risk: "Siyasi maliyet", reversal: "Gevşetmek enflasyonu geri çağırır.", trace: "İhtiyat, rızayı başka dağıttı." },
  "koy-hizmet": { period: "1950", rationale: "Kır rızası; bütçe yatırımı yer.", groups: "Çiftçiler, kırsal", short: "Afiş tam.", medium: "Stabilize yarım.", long: "Bakım yoksa viraj kaza kalır.", risk: "Keşif şişmesi", reversal: "Yolu kesmek rızayı keser.", trace: "Yol vardı, bakım yoktu." },
  "dis-ittifak": { period: "1950", rationale: "Dış güvenlik iç önceliği iter.", groups: "Güvenlik bürokrasisi, maliye", short: "Yükümlülük yazılır.", medium: "Fatura gecikir.", long: "Yatırım satırı alışkanlıkla kayar.", risk: "İç yatırım erimesi", reversal: "Yükümlülüğü ertelemek itibar yer.", trace: "İttifak takvimi iç yatırımı itti." },
  "acilim-ithalat": { period: "1950", rationale: "Tüketim rahatlar, cari açık şişer.", groups: "Kentli, iş dünyası, çiftçi", short: "Rafta mal görünür.", medium: "Cari açık konuşulur.", long: "Milli ekonomi homurdanır.", risk: "Dış bağımlılık", reversal: "Kapatmak kuyruk getirir.", trace: "İthalat açılımı rıza aldı, açık bıraktı." },
  "buro-sureklilik": { period: "1950", rationale: "Hükümet değişir, dosya kalır.", groups: "Bürokrasi", short: "İsimler kayar.", medium: "Şablon kalır.", long: "Devlet hafızası hükümetten uzun.", risk: "Tempo kaybı", reversal: "Süpürmek yorgunluk üretir.", trace: "Sandık sonrası kadro dosyayı korudu." },
  "radyo-hat": { period: "1950", rationale: "Resmî ses yayılır; koridor başka konuşur.", groups: "Medya, kamuoyu", short: "Akşam yayını.", medium: "Kahvehane tefsiri.", long: "Mikrofon kurum olur.", risk: "Güven parçası", reversal: "Sessizlik söylentiyi büyütür.", trace: "Radyo saati ile koridor ayrı kaldı." },
  "tarim-kredi": { period: "1950", rationale: "Kır gelirini öne çeker, tahsilat gecikir.", groups: "Çiftçiler", short: "Kredi vaadi.", medium: "Vade sisi.", long: "On hasat aynı sıra.", risk: "Tahsilat boşluğu", reversal: "Kesmek kır rızasını keser.", trace: "Hasat kredisi vade gizledi." },
  "fiyat-sok": { period: "1980", rationale: "Kuyruk iner, hane şoku çıkar.", groups: "Kentli, emekli, emek", short: "Kuyruk haneye iner.", medium: "Rapor düzeltme yazar.", long: "Kuyruk hafızası kalır.", risk: "Güven şoku", reversal: "Gıdayı istisna yazmak çapayı zayıflatır.", trace: "Ocak şoku istatistik sayıldı." },
  "anayasa-reset": { period: "1980", rationale: "Yetki çizgisi değişir; uygulama yavaşlar.", groups: "Yargı, güvenlik, gençler", short: "Çizgi netleşir ya da sislenir.", medium: "Kampüs 'sakin' yazılır.", long: "Reset cümlesi kuşak taşır.", risk: "Contest", reversal: "Geri sarmak çizgiyi ikiye böler.", trace: "Kurumsal reset sisli gerekçe bıraktı." },
  "guvenlik-duruş": { period: "1980", rationale: "Isı düşer, müzakere kapanır.", groups: "Güvenlik, medya, gençler", short: "Emir kısa.", medium: "Sivil takvim kayar.", long: "Kışla eğilimi kalır.", risk: "Özerklik kaybı", reversal: "Duruşu gevşetmek ısıyı geri çağırır.", trace: "İç güvenlik duruşu sivil kalemi bekletti." },
  "uni-cati": { period: "1980", rationale: "Merkezi müfredat; kampüs özerkliği iner.", groups: "Gençler, maarif", short: "Çatı oturur.", medium: "Özerklik ısı sanılır.", long: "Kampüs tansiyonu arşive sakin yazılır.", risk: "Güven", reversal: "Çatıyı kaldırmak tempo dağıtır.", trace: "Üniversite çatısı özerkliği ısı sandı." },
  "ihracat-acilim": { period: "1980", rationale: "Döviz arar; ücret baskısı sürer.", groups: "İş dünyası, emek", short: "Kapı açılır.", medium: "KOBİ teminat duyar.", long: "Ücret cümlesi yarın kalır.", risk: "Eşitsiz erişim", reversal: "Kapıyı kapatmak dövizi keser.", trace: "İhracat açılımı ücreti bekletti." },
  "belediye-imar": { period: "1980", rationale: "Yerel rant ve konut stoku büyür.", groups: "Kentli, belediye", short: "Yetki genişler.", medium: "Keşif şişer.", long: "Tapu ayrı iş.", risk: "Rant", reversal: "Yetkiyi geri almak yerel rızayı keser.", trace: "İmar yetkisi stoku büyüttü, tapuyu ayırdı." },
  "imf-sba": { period: "2002", rationale: "Faiz dışı fazla harcamayı dipnota iter.", groups: "Maliye, hane, iş dünyası", short: "Program tutulur.", medium: "Saha tahsilatı iyimserleşir.", long: "Çıkışta alışkanlık test edilir.", risk: "Rıza kaybı", reversal: "Gevşetmek çapayı zayıflatır.", trace: "İstikrar çapası harcamayı dipnota itti." },
  "inflation-target": { period: "2002", rationale: "Sözle çapa; gıda yapışkanlığı çekirdek sayılmazsa güven ayrışır.", groups: "Kentli, emekli, iş dünyası", short: "Hedef yazılır.", medium: "Siyasi faiz kapıda durur.", long: "Çekirdek ile sofra ayrışır.", risk: "Beklenti", reversal: "Hedefi bırakmak çapayı siler.", trace: "Örtük hedef gıdayı ayrı bıraktı." },
  "bank-recap": { period: "2002", rationale: "Bilinçli maliyet, kredi kanalını açar.", groups: "İş dünyası, hane", short: "Portföy iner.", medium: "Kim aldığı tartışılır.", long: "Kırılganlık ötelenir.", risk: "Hazine maliyeti", reversal: "Onarımı kesmek kanalı kapatır.", trace: "Bankacılık onarımı maliyetli nefes aldı." },
  "eu-align": { period: "2002", rationale: "Mevzuat hızlanır; mahkeme kalemi yavaştır.", groups: "Yargı, medya, bürokrasi", short: "Paket övülür.", medium: "Uygulama parantezde.", long: "Fasıl ilerler, kalem yerinde.", risk: "Saha boşluğu", reversal: "Paketi geri almak kapıyı kapatır.", trace: "Uyum paketi kâğıtta ülke, duruşmada başka kaldı." },
  "public-admin": { period: "2002", rationale: "Kadrolar direnir; tempo düşer.", groups: "Bürokrasi", short: "Sadeleşme yazılır.", medium: "Yüzde şişer, saha arar.", long: "Dosya hükümetten uzun.", risk: "Yorgunluk", reversal: "Geri doldurmak entropy'yi unutmaz.", trace: "Kamu sadeleştirmesi tempo kaybettirdi." },
  "social-relief": { period: "2002", rationale: "Kısa rıza, orta disiplin riski.", groups: "Hane, emekli, kentli", short: "Hane nefes alır.", medium: "Kasa konuşur.", long: "Popülist eğilim omurga sanılabilir.", risk: "Enflasyon", reversal: "Kesmek ısıyı yükseltir.", trace: "Hane rahatlatma rızayı kısa tuttu." },
  "security-posture": { period: "2002", rationale: "Kapasite kayması, sivil tempo yavaşlar.", groups: "Güvenlik, gençler, medya", short: "Masa kurulur.", medium: "İç reform kayar.", long: "Bütçe gecikmeli şişer.", risk: "Sivil takvim", reversal: "Duruşu indirmek ısıyı geri çağırır.", trace: "İç güvenlik duruşu sivil reformu bekletti." },
  "tax-admin": { period: "2002", rationale: "Kayıt dışına baskı; şikayet artar.", groups: "İş dünyası, çiftçi", short: "Tahsilat sıkı.", medium: "Şikayet büyür.", long: "Ölçü cümlesi kalır.", risk: "Rıza", reversal: "Gevşetmek kâğıt geliri şişirir.", trace: "Vergi idaresi sıkılaştı, şikayet arttı." },
  "local-gov": { period: "2002", rationale: "Belediye yetkisi genişler; merkez-yerel sürtünme.", groups: "Kent, kır, belediye", short: "Yasa çıkar.", medium: "Standart dağılır.", long: "Pay anayasası konuşulur.", risk: "Parça", reversal: "Merkeze çekmek yerel rızayı keser.", trace: "Yerel yönetim yasası sürtünme bıraktı." },
  "kamu-ihale": { period: "2002", rationale: "Kâğıt şeffaflık; yüklenici alışkanlığı direnir.", groups: "İş dünyası, medya", short: "Şartname temiz.", medium: "Halka tanıdık.", long: "Ağ yazılı yetkinin yanında yürür.", risk: "Contest", reversal: "Gevşetmek kalkanı incelir.", trace: "İhale disiplini kâğıtta kaldı." },
  "egitim-reform": { period: "2002", rationale: "Metin değişir, sınıf geç değişir.", groups: "Gençler, kırsal", short: "Müfredat taslağı.", medium: "Eski kitap okunur.", long: "Tabela çoğalır, hoca yetişmez.", risk: "Kapasite", reversal: "Geri almak metni sisler.", trace: "Müfredat temposu sınıfı bekletti." },
  "dis-politika": { period: "2002", rationale: "Dış masa iç reform takvimini iter.", groups: "Güvenlik, maliye", short: "Dosya açılır.", medium: "İç satır kayar.", long: "Alışkanlık kalır.", risk: "Takvim", reversal: "Kapatmak dış ısıyı yükseltir.", trace: "Komşu hat iç takvimi itti." },
  "kamu-bank-gov": { period: "2002", rationale: "Kredi kanalı açılır; siyasi tahsis kokusu kalır.", groups: "İş dünyası, kamu bankası hattı", short: "Yönetişim yazılır.", medium: "Tahsis konuşulur.", long: "Koku arşive işler.", risk: "Güven", reversal: "Sıkılaştırmak kanalı daraltır.", trace: "Kamu bankası yönetişimi tahsis izi bıraktı." },
  "imf-exit-prep": { period: "2002", rationale: "Dış çapa gevşer; disiplin test edilir.", groups: "Maliye, piyasa", short: "Çıkış konuşulur.", medium: "Alışkanlık sarsılır.", long: "İçselleşme ya da unutuş.", risk: "Refleks kaybı", reversal: "Programda kalmak rızayı yer.", trace: "Program çıkışı disiplini test etti." },
  "tax-amnesty": { period: "2002", rationale: "Kasa kısa dolar; ahlak uzun incelir.", groups: "İş dünyası, mükellef", short: "Kasa dolar.", medium: "Adalet homurdanır.", long: "Alışkanlık af bekler.", risk: "Norm", reversal: "Afı kesmek tahsilatı şoklar.", trace: "Kayıt dışı affı ahlakı inceltti." },
  "sme-credit": { period: "2002", rationale: "Anadolu nefes alır; tahsilat gecikir.", groups: "KOBİ, emek", short: "Paket açıklanır.", medium: "Şube teminat der.", long: "Erişim eşitsiz kalır.", risk: "Tahsilat", reversal: "Kesmek Anadolu ısısını yükseltir.", trace: "KOBİ kredisi teminat duvarına çarptı." },
  "agri-support": { period: "2002", rationale: "Çiftçi rızası; bütçe satırı şişer.", groups: "Çiftçiler, kırsal", short: "Destek yazılır.", medium: "Ödeme gecikir.", long: "Sıra alışkanlık olur.", risk: "Kasa", reversal: "Kesmek hasat rızasını keser.", trace: "Tarım destek sadeleştirmesi sırayı uzattı." },
  "energy-unbundle": { period: "2002", rationale: "Fatura konuşulur, hat eski kalır.", groups: "Hane, iş dünyası", short: "Piyasa açılır.", medium: "Fatura siyaset olur.", long: "Dış bağımlılık dipnotta.", risk: "Hane şoku", reversal: "Geri sarmak fiyatı sisler.", trace: "Enerji açılımı faturayı siyaset yaptı." },
  "health-transform": { period: "2002", rationale: "Sevk hızlanır; taşra kadrosu yetişmez.", groups: "Kent, kır, emekli", short: "Tabela asılır.", medium: "Nöbet listesi eski.", long: "Kuyruk kırsalda kalır.", risk: "Kapasite", reversal: "Geri almak sevkı kapatır.", trace: "Sağlık dönüşümü nöbet listesini unuttu." },
  "housing-mass": { period: "2002", rationale: "Arz konuşulur, tapu ayrı iş.", groups: "Kentli, inşaat", short: "Sefer ilan.", medium: "Keşif şişer.", long: "Kalite ayrı dosya.", risk: "Tapu boşluğu", reversal: "Kesmek rızayı keser.", trace: "Toplu konut seferi tapuyu ayırdı." },
  "labor-flex": { period: "2002", rationale: "İstihdam kâğıtta artar; güvence iner.", groups: "Çalışanlar, iş dünyası", short: "Kâğıt iş.", medium: "Güvence incelir.", long: "Aynı büyüme iki hayat.", risk: "Rıza", reversal: "Geri almak esnekliği kapatır.", trace: "İş gücü esnekliği güvenceyi indirdi." },
  "pension-param": { period: "2002", rationale: "Aktüerya konuşulur; sokak yaş duyar.", groups: "Emekliler", short: "Parametre masada.", medium: "Sokak başka duyar.", long: "Güven parçalanır.", risk: "Isı", reversal: "Geri almak kasa ister.", trace: "Emeklilik parametresi yaş olarak duyuldu." },
  "procure-audit": { period: "2002", rationale: "Kâğıt şeffaf; yüklenici koridoru direnir.", groups: "Medya, iş dünyası", short: "Denetim yazılır.", medium: "Koridor direnir.", long: "Ağ izi kalır.", risk: "Contest", reversal: "Gevşetmek kalkanı keser.", trace: "İhale denetimi koridoru durdurmadı." },
  "broadcast-law": { period: "2002", rationale: "Resmî ses netleşir; bağımsız yayın gerilir.", groups: "Medya", short: "Düzen yazılır.", medium: "Saha notu ayrı.", long: "Fragmantasyon artabilir.", risk: "Güven", reversal: "Geri almak sesi dağıtır.", trace: "Yayın düzeni resmi sesi netleştirdi." },
  "judicial-pack": { period: "2002", rationale: "Mevzuat hızlanır; duruşma yavaşlar.", groups: "Yargı, medya", short: "Paket çıkar.", medium: "Takvim kayar.", long: "Kalem yerinde kalır.", risk: "Contest", reversal: "Geri almak tempo dağıtır.", trace: "Yargı paketi duruşmayı bekletti." },
  "local-debt": { period: "2002", rationale: "Yerel kasa görünür; merkez kefalet konuşulur.", groups: "Belediye, maliye", short: "Çerçeve yazılır.", medium: "İl peşin der.", long: "Yük devredilir.", risk: "Kefalet", reversal: "Çerçeveyi kaldırmak sis yapar.", trace: "Belediye borç çerçeve kefaleti konuşturdu." },
  "fx-regime": { period: "2002", rationale: "Beklenti çapası; spekülasyon ayrı satır.", groups: "İş dünyası, hane", short: "Sinyal verilir.", medium: "Spekülasyon ayrı.", long: "Rejim alışkanlık olur.", risk: "Beklenti", reversal: "Sinyali bozmak çapayı kırar.", trace: "Kur rejimi sinyali spekülasyonu ayırdı." },
  "reserve-build": { period: "2002", rationale: "Güven artar; büyüme yavaşlar.", groups: "Piyasa, hane", short: "İhtiyat yazılır.", medium: "Büyüme homurdanır.", long: "Tampon alışkanlık olur.", risk: "Büyüme", reversal: "Erken harcamak tamponu yer.", trace: "Rezerv biriktirme büyümeyi yavaşlattı." },
  "customs-union": { period: "2002", rationale: "Ticaret açılır; tarım şikâyeti büyür.", groups: "Çiftçi, ihracatçı", short: "Kapı derinleşir.", medium: "Tarım homurdanır.", long: "İki sektör iki ülke.", risk: "Kır rızası", reversal: "Derinliği kesmek ticareti keser.", trace: "Gümrük birliği tarımı homurtturdu." },
  "cyprus-track": { period: "2002", rationale: "Dış kapı iç takvimi iter.", groups: "Güvenlik, kamuoyu", short: "Hat açılır.", medium: "İç reform kayar.", long: "Alışkanlık kalır.", risk: "Takvim", reversal: "Hattı kapatmak dış ısıyı yükseltir.", trace: "Kıbrıs hattı iç takvimi itti." },
  "iraq-border": { period: "2002", rationale: "Güvenlik kapasitesi kayar; bütçe şişer.", groups: "Ordu, maliye", short: "Not düşülür.", medium: "Bütçe gecikir.", long: "Satır alışkanlık olur.", risk: "Kasa", reversal: "Notu silmek kapasiteyi dağıtır.", trace: "Güney sınır duruşu bütçeyi geciktirdi." },
  "imf-review-tone": { period: "2002", rationale: "Rapor iyimserleşir; saha aynı kalabilir.", groups: "Maliye, medya", short: "Üslup yumuşar.", medium: "Revizyon gecikir.", long: "Güven ayrışır.", risk: "Bilgi", reversal: "Sert üslup rızayı yer.", trace: "Gözden geçirme üslubu sahayı gizledi." },
  "stat-independence": { period: "2002", rationale: "Sayı güveni artar; siyasi maliyet çıkar.", groups: "Medya, hane", short: "Özerklik yazılır.", medium: "Maliyet konuşulur.", long: "Seri alışkanlık olur.", risk: "Siyaset", reversal: "Özerkliği indirmek sayıyı sisler.", trace: "İstatistik özerkliği siyasi maliyet çıkardı." },
  "cadre-maliye": { period: "2002", rationale: "Sadakat ile liyakat aynı koltuğa sığmaz.", groups: "Maliye kadrosu", short: "Atama yapılır.", medium: "Alan eşleşmesi test edilir.", long: "Hafıza isim taşır.", risk: "Uyum", reversal: "Geri almak yorgunluk üretir.", trace: "Maliye kadrosu liyakat-sadakat izi bıraktı." },
  "cadre-merkez": { period: "2002", rationale: "Beklenti adam seçimine bağlanır.", groups: "Piyasa", short: "İsim sızar.", medium: "Çapa kişileşir.", long: "Kurum kişi sanılır.", risk: "Otorite", reversal: "Değiştirmek çapayı sarsar.", trace: "Merkez kadrosu beklentiyi kişileştirdi." },
  "cadre-yargi": { period: "2002", rationale: "Dosya hızı siyasetle sürtünür.", groups: "Yargı, medya", short: "Kurul dengesi kayar.", medium: "Duruşma tempo değişir.", long: "Contest arşivde kalır.", risk: "Contest", reversal: "Dengeyi bozmak güveni yer.", trace: "Yargı üst kurul dengesi sürtünme bıraktı." },
  "cadre-vali": { period: "2002", rationale: "İl uygulaması değişir; merkez aynı sanır.", groups: "Mülkiye, bölgeler", short: "Valilik kayar.", medium: "Tempo illere göre ayrışır.", long: "Merkez yüzde şişirir.", risk: "Saha-merkez", reversal: "Geri kaydırmak yorgunluk üretir.", trace: "Valilik temposu saha-merkez boşluğu bıraktı." },
  "region-gap": { period: "2002", rationale: "Doğu satırı açılır; Marmara homurdanır.", groups: "Doğu, Marmara, kır", short: "Teşvik yazılır.", medium: "İki bölge iki cümle.", long: "Göç çekimi kayar.", risk: "Adalet algısı", reversal: "Kesmek ihmal izini büyütür.", trace: "Bölgesel teşvik iki cümle bıraktı." },
  "univ-expand": { period: "2002", rationale: "Tabela çoğalır; hoca yetişmez.", groups: "Gençler, maarif", short: "Kampüs açılır.", medium: "Kadro yetişmez.", long: "Kontenjan başarı yazılır.", risk: "Kalite", reversal: "Durdurmak erişimi keser.", trace: "Üniversite dalgası hocayı bekletti." },
  "press-brief": { period: "2002", rationale: "Resmî anlatı netleşir; saha notu ayrı kalır.", groups: "Medya, istihbarat koordinasyonu", short: "Brifing disiplini.", medium: "Saha ayrı konuşur.", long: "İki gerçek alışkanlık olur.", risk: "Güven", reversal: "Sessizlik söylentiyi büyütür.", trace: "Kamuoyu brifingi saha notunu ayırdı." },
  "disaster-law": { period: "2002", rationale: "Kâğıt hazır; tatbikat yoksa hayalet dosya.", groups: "Belediye, hane", short: "Mevzuat yazılır.", medium: "Tatbikat gecikir.", long: "Hasar satırı açık kalır.", risk: "Hayalet dosya", reversal: "Kanunu rafa kaldırmak hazırlığı siler.", trace: "Afet mevzuatı tatbikatsiz hayalet bıraktı." },
  "water-infra": { period: "2002", rationale: "Boru konuşulur; kayıp-kaçak raporlanmaz.", groups: "Kent, kır", short: "Pay yazılır.", medium: "Kaçak dipnotta.", long: "Çeşme aynı kalır.", risk: "Kayıp", reversal: "Payı kesmek şebekeyi bırakır.", trace: "Su altyapı payı kayıp-kaçağı gizledi." },
  "export-credit": { period: "2002", rationale: "Döviz aranır; KOBİ erişimi eşitsiz.", groups: "İhracatçı, KOBİ", short: "Hat açılır.", medium: "Erişim ayrışır.", long: "Ölçek başarı sayılır.", risk: "Adalet", reversal: "Hattı kapatmak dövizi keser.", trace: "İhracat kredisi KOBİ'yi dışarıda bıraktı." },
  "anti-terror-legal": { period: "2002", rationale: "Isı düşer; müzakere kapanır.", groups: "Güvenlik, yargı, medya", short: "Mevzuat yazılır.", medium: "Müzakere daralır.", long: "Duruş alışkanlık olur.", risk: "Contest", reversal: "Geri almak ısıyı yükseltir.", trace: "İç güvenlik mevzuatı müzakereyi daralttı." },
  "eu-chapter": { period: "2002", rationale: "Takvim ilerler; uygulama taşrada takılır.", groups: "Yargı, bürokrasi", short: "Fasıl açılır.", medium: "Kalem yetişmez.", long: "Kapı aralık kalır.", risk: "Kapasite", reversal: "Temposu kesmek kapıyı kapatır.", trace: "Fasıl temposu mahkeme kalemini bekletti." },
  "us-defense": { period: "2002", rationale: "Dış bağımlılık ile kapasite aynı cümlede.", groups: "Ordu, sanayi", short: "Hat açılır.", medium: "Yerli satır dipnotta.", long: "Tedarik alışkanlık olur.", risk: "Bağımlılık", reversal: "Hattı kesmek kapasiteyi keser.", trace: "Savunma tedarik hattı yerli satırı dipnota itti." },
  "neighbor-trade": { period: "2002", rationale: "Kayıt dışı sınır ticareti resmiyete zorlanır.", groups: "Sınır esnafı, maliye", short: "Kapı resmi olur.", medium: "Alışkanlık direnir.", long: "İki rejim yan yana.", risk: "Kayıt", reversal: "Kapıyı kapatmak ticareti yasa dışına iter.", trace: "Komşu ticaret kapısı kayıt dışını zorladı." },
  "budget-transparency": { period: "2002", rationale: "Sayı görünür olur; siyasi maliyet çıkar.", groups: "Medya, maliye", short: "Not yayımlanır.", medium: "Maliyet konuşulur.", long: "Şeffaflık alışkanlık olur.", risk: "Siyaset", reversal: "Notu kapatmak güveni yer.", trace: "Bütçe şeffaflık notu maliyet çıkardı." },
  "deprem-pay": { period: "gunumuz", rationale: "Kısa rıza, uzun kasa; kalite denetlenmezse hayalet dosya.", groups: "Hane, belediye", short: "Pay aktarılır.", medium: "Kalite ayrı satır.", long: "Hasar açık kalır.", risk: "Hayalet", reversal: "Payı kesmek rızayı keser.", trace: "Afet onarım payı kaliteyi ayırdı." },
  "konut-arz": { period: "gunumuz", rationale: "Arz konuşulur, tapu ve imar ayrı iş.", groups: "Kentli", short: "Sefer konuşulur.", medium: "Tapu ayrı.", long: "Isı yer değiştirir.", risk: "Tapu", reversal: "Arzı kesmek kirayı azdırır.", trace: "Konut arzı tapuyu ayırdı." },
  "faiz-sinyal": { period: "gunumuz", rationale: "Beklenti çapası; siyasi maliyet ayrı satır.", groups: "Hane, iş dünyası", short: "Sinyal verilir.", medium: "Maliyet konuşulur.", long: "Çapa kişileşir ya da kurumsallaşır.", risk: "Siyaset", reversal: "Sinyali bozmak çapayı kırar.", trace: "Faiz sinyali siyasi maliyeti ayırdı." },
  "goc-idare": { period: "gunumuz", rationale: "Yerel ısı ile resmi kapasite ayrışır.", groups: "Kent, mülkiye", short: "Tempo yazılır.", medium: "İl ısısı ayrı.", long: "Hizmet yükü kayar.", risk: "Yerel ısı", reversal: "Temposu kesmek kapasiteyi dağıtır.", trace: "Göç idaresi temposu yerel ısıyı ayırdı." },
  "enerji-denge": { period: "gunumuz", rationale: "Hane rahatlar, dış bağımlılık durur.", groups: "Hane, maliye", short: "Fatura yumuşar.", medium: "Dipnot dışarıda kalır.", long: "Bağımlılık izi kalır.", risk: "Kasa", reversal: "Dengeyi bozmak faturayı şişirir.", trace: "Enerji faturası dış bağımlılığı dipnota itti." },
  "bilgi-kalite": { period: "gunumuz", rationale: "Rapor güveni artar; siyasi maliyet çıkar.", groups: "Medya, hane", short: "Seri açılır.", medium: "Maliyet konuşulur.", long: "Güven alışkanlık olur.", risk: "Siyaset", reversal: "Seriyi kapatmak söylentiyi büyütür.", trace: "İstatistik şeffaflığı maliyet çıkardı." },
  "erken-capa": { period: "alternatif", rationale: "Kriz sonrası çapa erken oturursa rıza başka dağılır.", groups: "Hane, piyasa", short: "Çapa erken.", medium: "Rıza kayar.", long: "Karşıolgusal iz.", risk: "Rıza", reversal: "Geç bırakmak krizi uzatır.", trace: "Erken çapa rızayı başka dağıttı." },
  "yerel-pay": { period: "alternatif", rationale: "Merkez zayıflar, uygulama illere yayılır.", groups: "Belediye, bölgeler", short: "Pay yazılır.", medium: "Standart dağılır.", long: "İl rızası merkez homurtusu.", risk: "Parça", reversal: "Payı geri almak yerel rızayı keser.", trace: "Yerel pay anayasası standardı dağıttı." },
  "yargi-omu": { period: "alternatif", rationale: "Dosya yavaşlar, güven uzun vadede artabilir.", groups: "Yargı, medya", short: "Özerklik yazılır.", medium: "Tempo düşer.", long: "Güven birikebilir.", risk: "Tempo", reversal: "Özerkliği indirmek contest açar.", trace: "Yargı özerkliği dosyayı yavaşlattı." },
  "sinir-ticaret": { period: "alternatif", rationale: "Dış bağımlılık sapması.", groups: "Sınır, maliye", short: "Rejim yazılır.", medium: "Kayıt zorlanır.", long: "Sapma kalır.", risk: "Bağımlılık", reversal: "Rejimi kapatmak ticareti kaçırır.", trace: "Sınır ticareti rejimi sapma bıraktı." },
  "plan-sanayi": { period: "alternatif", rationale: "Kapasite seçilir, piyasa homurdanır.", groups: "Sanayi, iş dünyası", short: "Koridor seçilir.", medium: "Piyasa homurdanır.", long: "Seçilmiş kapasite izi.", risk: "Piyasa rızası", reversal: "Planı bırakmak koridoru sisler.", trace: "Planlı sanayi koridoru piyasayı homurtturdu." },
};

const POLICY_PROSE_DEFAULTS = {
  "2002": { period: "2002", rationale: "Program, kurum ve saha aynı cümlede değildir.", groups: "Hane, iş dünyası, bürokrasi", short: "Karar kayda geçer.", medium: "Uygulama oranı sahayı böler.", long: "Alışkanlık hükümetten uzun yaşar.", risk: "Uygulama açığı", reversal: "Geri dönüş yorgunluk ve azalan getiri taşır.", trace: "2002 kararı iz bıraktı." },
  gunumuz: { period: "Günümüz", rationale: "Fatura, kira ve istatistik aynı ayı tarif etmez.", groups: "Hane, kent, kır", short: "Rıza kısa alınır.", medium: "Kasa uzun konuşur.", long: "Hayalet dosya açılır.", risk: "Güven", reversal: "Geri almak manşeti bozar, kasa rahatlar.", trace: "Günümüz kararı fatura izi bıraktı." },
  alternatif: { period: "Alternatif", rationale: "Aynı kriz, başka refleks.", groups: "Kurumlar, yerel idare", short: "Çapa erken oturur ya da pay yayılır.", medium: "Standart dağılır.", long: "Karşıolgusal iz kalır.", risk: "Contest", reversal: "Geri sarmak refleks cümlesini silmez.", trace: "Alternatif refleks iz bıraktı." },
};

export function policyProseOf(policy) {
  if (!policy) return null;
  if (POLICY_PROSE[policy.id]) return POLICY_PROSE[policy.id];
  const era = POLICY_PROSE_DEFAULTS[policy.era] ? policy.era : POLICY_PROSE_DEFAULTS[policy.eraId] ? policy.eraId : "2002";
  const base = POLICY_PROSE_DEFAULTS[era] || POLICY_PROSE_DEFAULTS["2002"];
  return {
    ...base,
    rationale: locIntent(policy),
    trace: `${policy.id} kararı kurumsal iz bıraktı.`,
  };
}
function locIntent(policy) {
  return policy.intent || "Karar kayda geçer.";
}

function extraToEvent(node) {
  return nodeToEvent({
    id: node.chain || `x-${node.id}`,
    arc: node.arc || "memory",
    tags: node.tags || [],
    exclusive: node.exclusive || null,
    branch: node.branch || null,
    era: node.era,
  }, node);
}

export const CONTENT_EVENTS = unique([
  ...CHAINS.flatMap((chain) => chain.nodes.map((node) => nodeToEvent(chain, node))),
  ...EXTRA_NODES.map(extraToEvent),
]);

const EVENT_BY_ID = new Map(CONTENT_EVENTS.map((row) => [row.id, row]));
export const eventById = (id) => EVENT_BY_ID.get(id) || null;

function pushEcho(state, text, id) {
  if (!text) return;
  const row = { year: state.time.year, text, voice: "devlet" };
  const mem = state.memoryState || [];
  mem.push({ ...row, id: id || `dc-echo:${state.time.turn}` });
  state.memoryState = mem.slice(-24);
}

function applyLight(state, effects) {
  if (!effects || typeof effects !== "object") return;
  if (Number.isFinite(effects.heat)) state.heat = cap((state.heat || 40) + effects.heat);
  if (Number.isFinite(effects.info)) state.infoQuality = cap((state.infoQuality || 50) + effects.info);
  if (Number.isFinite(effects.rumor)) state.rumor = cap((state.rumor || 20) + effects.rumor);
}

function instMemory(state, instId, text) {
  const row = inst(state, instId);
  if (!row || !text) return;
  row.memory = Array.isArray(row.memory) ? row.memory : [];
  row.memory.push({ turn: state.time.turn, text });
  if (row.memory.length > 12) row.memory.splice(0, row.memory.length - 12);
}

export function scheduleContent(state, spec, extraMeta = {}) {
  if (!spec?.eventId || !spec?.key) return false;
  if (!EVENT_BY_ID.has(spec.eventId)) return false;
  const id = `dc:${spec.key}`;
  const store = bag(state);
  if (!store) return false;
  if (store.once[id] || store.waiting.some((row) => row.id === id || row.eventId === spec.eventId)) return false;
  if (store.waiting.length >= 15) return false;
  const def = EVENT_BY_ID.get(spec.eventId);
  store.waiting.push({
    id,
    eventId: spec.eventId,
    dueTurn: (state.time.turn || 1) + Math.max(1, spec.dueTurns || 4),
    expectedInst: extraMeta.expectedInst || def?.needInst || null,
    expectedCrisis: extraMeta.expectedCrisis || def?.needCrisis || null,
    expectedForm: extraMeta.expectedForm || def?.form || null,
  });
  store.once[id] = state.time.turn;
  bag(state);
  return true;
}

export function applyContentChoice(state, eventId, choiceId) {
  if (state.flags?.campaignEnd) return false;
  const definition = EVENT_BY_ID.get(eventId);
  if (!definition?.devletContent) return false;
  const choiceRow = definition.choices.find((row) => row.id === choiceId) || definition.choices[0];
  if (!choiceRow) return false;
  const store = bag(state);
  if (!store) return false;
  if (definition.exclusive && definition.branch) store.exclusive[definition.exclusive] = definition.branch;
  if (choiceRow.lock && definition.exclusive) store.exclusive[definition.exclusive] = choiceRow.lock;
  if (definition.chain && Number.isFinite(choiceRow.stageTo)) store.chains[definition.chain] = choiceRow.stageTo;
  if (choiceRow.next) scheduleContent(state, choiceRow.next);
  applyLight(state, choiceRow.effects);
  if (choiceRow.echo) {
    pushEcho(state, choiceRow.echo, `dc-echo:${eventId}:${choiceId}:${state.time.turn}`);
    if (state.devletDepth?.traces) {
      state.devletDepth.traces.push({
        turn: state.time.turn, type: "content", source: definition.chain || eventId,
        factors: [choiceRow.echo],
      });
      if (state.devletDepth.traces.length > 48) state.devletDepth.traces.splice(0, state.devletDepth.traces.length - 48);
    }
  }
  if (definition.needInst) instMemory(state, definition.needInst, choiceRow.echo || definition.title);
  const cadre = definition.needInst ? cadreOf(state, definition.needInst) : null;
  if (cadre) {
    cadre.memory = Array.isArray(cadre.memory) ? cadre.memory : [];
    cadre.memory.push({ turn: state.time.turn, text: definition.title });
    if (cadre.memory.length > 12) cadre.memory.splice(0, cadre.memory.length - 12);
  }
  store.once[`seen:${eventId}`] = state.time.turn;
  if (definition.organic) {
    store.lastTurn = state.time.turn;
    store.arcCounts[definition.arc] = (Number(store.arcCounts[definition.arc]) || 0) + 1;
  }
  if (state.flags?.contentActive?.eventId === eventId) state.flags.contentActive = null;
  if (Array.isArray(state.events) && !state.events.some((row) => row.id === eventId)) {
    state.events.push({ id: eventId, title: definition.title, year: state.time.year, month: state.time.month, devletContent: true });
    if (state.events.length > 36) state.events.splice(0, state.events.length - 36);
  }
  return true;
}

export function settleDevletContent(state) {
  if (state.flags?.campaignEnd) return false;
  const active = state.flags?.contentActive;
  if (!active?.eventId) return false;
  const definition = EVENT_BY_ID.get(active.eventId);
  if (!definition) {
    state.flags.contentActive = null;
    return false;
  }
  const fallback = definition.choices.find((row) => !row.defer) || definition.choices[0];
  return applyContentChoice(state, active.eventId, fallback.id);
}

export function takeDueDevletContent(state) {
  const store = bag(state);
  if (!store) return null;
  while (true) {
    const due = store.waiting.find((row) => Number(row.dueTurn) <= (state.time.turn || 1));
    if (!due) return null;
    store.waiting = store.waiting.filter((row) => row.id !== due.id);
    store.once[`resolved:${due.id}`] = state.time.turn;
    if (due.expectedInst && !inst(state, due.expectedInst)) continue;
    if (due.expectedCrisis && !activeCrisis(state, due.expectedCrisis)) continue;
    if (due.expectedForm && state.form !== due.expectedForm && state.devletDepth?.forms?.dominant !== due.expectedForm) continue;
    if (!EVENT_BY_ID.has(due.eventId)) continue;
    return due.eventId;
  }
}

export function pickDevletContentOrganic(state) {
  const store = bag(state);
  if (!store) return null;
  const turn = state.time.turn || 1;
  if (Number.isInteger(store.lastTurn) && turn - store.lastTurn < 3) return null;
  const eligible = CONTENT_EVENTS.filter((row) =>
    row.organic &&
    !store.once[`seen:${row.id}`] &&
    typeof row.organicCheck === "function" &&
    row.organicCheck(state),
  );
  if (!eligible.length) return null;
  const next = eligible.sort((a, b) => {
    const count = (Number(store.arcCounts[a.arc]) || 0) - (Number(store.arcCounts[b.arc]) || 0);
    if (count) return count;
    return hash(state.meta?.seed || 1, `${turn}:${a.id}`) - hash(state.meta?.seed || 1, `${turn}:${b.id}`);
  })[0];
  return next?.id || null;
}

export function processDevletContentMonth(state) {
  if (!state || state.flags?.campaignEnd) return state;
  const store = bag(state);
  if (!store) return state;
  overlayCadres(state);
  if (store.autoTurn === state.time.turn) return state;
  if (state.flags?.contentActive?.eventId && EVENT_BY_ID.has(state.flags.contentActive.eventId)) return state;
  const dueId = takeDueDevletContent(state);
  if (dueId) {
    state.flags.contentActive = { eventId: dueId, turn: state.time.turn };
    store.autoTurn = state.time.turn;
    decorateDevletDossier(state);
    return state;
  }
  const organicId = pickDevletContentOrganic(state);
  if (organicId) {
    state.flags.contentActive = { eventId: organicId, turn: state.time.turn };
    store.lastTurn = state.time.turn;
    store.autoTurn = state.time.turn;
    decorateDevletDossier(state);
    return state;
  }
  for (const spec of EXTRA_CALLBACKS) {
    if (store.once[`dc:${spec.key}`]) continue;
    let ok = false;
    try { ok = typeof spec.test === "function" ? spec.test(state) : true; } catch { ok = false; }
    if (!ok) continue;
    if (scheduleContent(state, spec, spec)) {
      store.autoTurn = state.time.turn;
      break;
    }
  }
  decorateDevletDossier(state);
  return state;
}

export function decorateDevletDossier(state) {
  const d = state.devletDepth;
  if (!d) return null;
  const flavor = STATE_FORM_FLAVOR[state.form] || STATE_FORM_FLAVOR["Bürokrasi-Devlet"];
  const eligible = DOSSIER_TRACE_TEMPLATES.filter((row) => {
    try { return row.test(state); } catch { return false; }
  });
  // The first twelve traces describe mutually-exclusive authored routes. A
  // straight slice made the first eight permanent winners and starved every
  // institution/crisis/late-campaign trace. Keep both route history and the
  // living state in the dossier, with a deterministic seed order inside each
  // group so save/load cannot reroll the report.
  const ordered = (rows) => rows.slice().sort((a, b) =>
    hash(state.meta?.seed || 1, `dossier:${a.id}`) - hash(state.meta?.seed || 1, `dossier:${b.id}`));
  const routeIds = new Set(DOSSIER_TRACE_TEMPLATES.slice(0, 12).map((row) => row.id));
  const routes = ordered(eligible.filter((row) => routeIds.has(row.id))).slice(0, 4);
  const dynamics = ordered(eligible.filter((row) => !routeIds.has(row.id))).slice(0, 4);
  const selected = [...routes, ...dynamics];
  if (selected.length < 8) {
    const used = new Set(selected.map((row) => row.id));
    selected.push(...ordered(eligible.filter((row) => !used.has(row.id))).slice(0, 8 - selected.length));
  }
  const traces = selected.map((row) => ({ id: row.id, text: row.text }));
  d.outcome = d.outcome && typeof d.outcome === "object" ? d.outcome : {};
  d.outcome.flavor = flavor.trace;
  d.outcome.contentNotes = traces.map((row) => row.text);
  d.outcome.contentTraces = traces;
  if (state.flags?.campaignEnd) {
    const existing = (d.traces || []).filter((row) => !String(row?.source || "").startsWith("dc-trace"));
    d.traces = [...traces.map((row) => ({ turn: state.time.turn, type: "dossier", source: row.id, factors: [row.text] })), ...existing].slice(0, 48);
  }
  return d.outcome;
}

export function coverage() {
  const events = CONTENT_EVENTS;
  const tagged = (tag) => events.filter((row) => (row.tags || []).includes(tag)).length;
  const delayedNodes = events.filter((row) => row.organic !== true);
  const organic = events.filter((row) => row.organic).length;
  const families = Object.keys(EXCLUSIVE_PAIRS);
  const delayedChoices = events.filter((row) => (row.choices || []).some((c) => (c.next?.dueTurns || 0) >= 1)).length;
  const longTerm = events.filter((row) => (row.choices || []).some((c) => (c.next?.dueTurns || 0) >= 24) || (row.tags || []).includes("long")).length;
  const crisisChains = CHAINS.filter((chain) => (chain.tags || []).includes("crisis") || (chain.nodes || []).some((n) => n.needCrisis || (n.tags || []).includes("crisis")));
  return {
    events: events.length,
    chains: CHAINS.length,
    delayedCallbacks: delayedNodes.length,
    delayedAuto: EXTRA_CALLBACKS.length,
    delayedChoices,
    organic,
    exclusive: families.length,
    dossierTraces: DOSSIER_TRACE_TEMPLATES.length,
    cadreProfiles: CADRE_PROFILES.length,
    formFlavor: Object.keys(STATE_FORM_FLAVOR).length,
    longTerm,
    period: tagged("period") + tagged("1923") + tagged("1950") + tagged("1980") + tagged("2002") + tagged("gunumuz") + tagged("alternatif"),
    institution: tagged("institution"),
    group: tagged("group"),
    region: tagged("region"),
    government: tagged("government"),
    media: tagged("media"),
    external: tagged("external"),
    cadre: tagged("cadre"),
    fiscal: tagged("fiscal"),
    development: tagged("development"),
    crisis: tagged("crisis"),
    crisisChains: crisisChains.length,
    form: tagged("form") + tagged("network"),
    intelligence: tagged("intelligence"),
    extras: EXTRA_NODES.length,
    policyProse: Object.keys(POLICY_PROSE).length,
  };
}

export { CHAINS, EXTRA_NODES, bag as devletContentBag };
