const STORAGE_KEY = "tariklab.language";

export const getLang = () => (localStorage.getItem(STORAGE_KEY) === "en" ? "en" : "tr");
export const pick = (tr, en) => (getLang() === "en" ? en : tr);

const EN = new Map(Object.entries({
  "TOPRAK · YOL · HANEDAN": "LAND · ROAD · DYNASTY",
  "Kayıt hazırlanıyor": "Preparing save",
  "Yerel kayıt hazır": "Local save ready",
  "Kısa oyun rehberi": "Quick game guide",
  "Kayıtlar ve oyun menüsü": "Saves and game menu",
  "Menü": "Menu",
  "Aktif yerleşimin kaynakları": "Active settlement resources",
  "Yeni bir çağ": "A new age",
  "Zaman senin elinde.": "Time is in your hands.",
  "Zaman kontrolü": "Time controls",
  "Zamanı duraklat": "Pause time",
  "Yerleşimler ve kampanya": "Settlements and campaign",
  "Strateji haritası. Sürükleyerek gezin, tekerlek veya iki parmakla yakınlaşın. Ok tuşlarıyla karo seçin, Escape ile seçimi kaldırın.": "Strategy map. Drag to pan; use the wheel or two fingers to zoom. Select tiles with arrow keys and clear with Escape.",
  "Harita kontrolleri": "Map controls",
  "Haritadan uzaklaş": "Zoom out",
  "Haritaya yaklaş": "Zoom in",
  "Aktif yerleşime dön": "Return to active settlement",
  "Merkez": "Center",
  "Dünya": "World",
  "Yerleşim panelini daralt veya aç": "Collapse or open settlements",
  "Panel": "Panel",
  "YERYÜZÜ DEFTERİ": "WORLD LEDGER",
  "İlk adımlar": "First steps",
  "İLK OCAK": "FIRST HEARTH",
  "Reis sensin. Hedefin bir Kurultay yolu tamamlamak.": "You lead this house. Complete one Council path to win.",
  "İlk adımlar panelini kapat": "Close first steps",
  "Üret": "Build",
  "Yerleşimden bir yapı geliştir.": "Upgrade one building in your settlement.",
  "Zamanı başlat": "Start time",
  "4× veya 12× ile kuyruğu ilerlet.": "Use 4× or 12× to advance the queue.",
  "Keşfet": "Scout",
  "Bir karo seç; değerini oku ve gözcü gönder.": "Select a tile, read its value and send scouts.",
  "İlk yapımı seç": "Choose first build",
  "Tüm rehber": "Full guide",
  "Harita hazırlanıyor…": "Preparing map…",
  "Seçili bölge": "Selected area",
  "Oyun bölümleri": "Game sections",
  "Harita": "Map", "Yerleşim": "Settlement", "Ordu": "Army", "Divan": "Council", "Hanedan": "Dynasty",
  "Bir ocak yak.\nBir yol aç.\nBir iz bırak.": "Light a hearth.\nOpen a road.\nLeave a mark.",
  "Bir ocak yak.": "Light a hearth.", "Bir yol aç.": "Open a road.", "Bir iz bırak.": "Leave a mark.",
  "ANADOLU'DAN ESİNLENEN ÖZGÜN BİR DÜNYA": "AN ORIGINAL WORLD INSPIRED BY ANATOLIA",
  "TARIKLAB · TEK OYUNCULU STRATEJİ": "TARIKLAB · SINGLE-PLAYER STRATEGY",
  "Toprak bir başlangıç.\nHanedan, verdiğin kararlar.": "Land is only a beginning.\nYour decisions become a dynasty.",
  "Toprak bir başlangıç.": "Land is only a beginning.", "Hanedan, verdiğin kararlar.": "Your decisions become a dynasty.",
  "Yerleşimini geliştir, yolları keşfet ve sınırlarını genişlet. Sekiz rakip hanedanın arasında gücünü toprakla, ticaretle veya diplomasiyle kur.": "Develop settlements, scout roads and expand your reach. Build power through land, trade or diplomacy among eight rival dynasties.",
  "49 × 49 dünya": "49 × 49 world", "Çevrimdışı oyun": "Offline play", "Zaman kontrolü sende": "You control time",
  "Kayıtlar okunuyor…": "Reading saves…", "Eski HANEDAN kayıtların mı var?": "Have old HANEDAN saves?",
  "Yeni strateji kampanyası farklı kurallar kullanır. Eski oyunun ve kayıtların korunuyor; oradan devam edebilir veya yedeğini alabilirsin.": "The new strategy campaign uses different rules. Your old game and saves remain available to continue or export.",
  "Eski kayıtları aç →": "Open old saves →", "Oyunlara dön": "Back to games", "Pencereyi kapat": "Close window",
  "Erzak": "Food", "Kereste": "Timber", "Taş": "Stone", "Demir": "Iron", "Nüfuz": "Influence",
  "Bereketli ova": "Fertile plain", "Sedir ormanı": "Cedar forest", "Taşlık dağ": "Rocky mountain", "Demir sırtı": "Iron ridge", "Nehir vadisi": "River valley", "Kervan yolu": "Caravan road", "Dağ geçidi": "Mountain pass", "Kıraç yamaç": "Arid slope", "Bozkır": "Steppe",
  "Serin yayla": "Cool highland", "Kızıl damar": "Red vein", "Kadim sedirlik": "Ancient cedar grove", "Beyaz taş ocağı": "White quarry", "Yedi Kapı Hanı": "Seven Gates Inn", "Kilit geçit": "Key pass", "Gözetleme tepesi": "Watch hill", "Sessiz divan": "Silent council",
  "Erzak üretimi güçlü. Yeni bir tarım merkezi için uygun.": "Strong food output; a natural site for a farming center.",
  "Kereste bol; orman savunmayı güçlendirir, yürüyüşü yavaşlatır.": "Timber is plentiful; forest strengthens defense but slows marches.",
  "Taş ve savunma avantajı. Erzak ve seyahat maliyeti yüksek.": "Strong stone and defense; food support and travel are costly.",
  "Demir ordunun omurgasıdır. Bu merkez erzak desteği ister.": "Iron is the army's backbone. This site needs food support.",
  "Su, erzak ve kereste sağlar. Bütün nehir geçişleri yürünebilir.": "Provides water, food and timber. Every river crossing remains passable.",
  "Birlikler ve kervanlar hızlanır. Ticaret merkezi için uygun.": "Armies and caravans move faster; well suited to a trade center.",
  "Dağlar arasında hızlı ve savunulabilir geçiş.": "A fast, defensible route through the mountains.",
  "Kıt erzak karşılığında taş ve demir. Lojistik gerekir.": "Stone and iron at the cost of scarce food; logistics are essential.",
  "Hızlı hareket, dengeli gelişim; sınır yerleşimi için elverişli.": "Fast movement and balanced growth; useful for a frontier settlement.",
  "Bağlı yerleşime %35 erzak üretimi.": "+35% food output for the linked settlement.",
  "Bağlı yerleşime %40 demir üretimi.": "+40% iron output for the linked settlement.",
  "Bağlı yerleşime %35 kereste üretimi.": "+35% timber output for the linked settlement.",
  "Bağlı yerleşime %35 taş üretimi.": "+35% stone output for the linked settlement.",
  "Kervan kapasitesi %50 ve ticaret geliri %10 artar.": "+50% caravan capacity and +10% trade income.",
  "Bağlı yerleşimden çıkan birliklerin yolculuğu %15 kısalır.": "Armies leaving the linked settlement travel 15% faster.",
  "Çevresindeki 12 karoda yabancı birlikleri görür.": "Reveals foreign armies within 12 tiles.",
  "İlk keşifte 15 nüfuz ve hanedan deneyimi verir.": "The first expedition grants 15 influence and dynasty experience.",
  "Ambar tarlaları": "Granary fields", "Sedir atölyesi": "Cedar workshop", "Taş işliği": "Stoneworks", "Demir ocağı": "Iron mine", "Depolar": "Warehouses", "Talimgâh": "Training yard", "Sınır suru": "Border wall", "Kervan avlusu": "Caravan court", "Hanedan konağı": "Dynasty hall",
  "Erzak üretir. Askerlerin iaşesi buradan karşılanır.": "Produces food and supplies the army.",
  "Yapı ve kervanlar için kereste üretir.": "Produces timber for construction and caravans.",
  "Surlar ve büyük yapılar için taş üretir.": "Produces stone for walls and major buildings.",
  "Teçhizat ve gelişmiş yapılar için demir üretir.": "Produces iron for equipment and advanced buildings.",
  "Her kaynak için depolama sınırını 600 artırır.": "Raises storage by 600 for every resource.",
  "Seviye 1: milis, mızraklı, gözcü; 2: okçu; 3: atlı; 4: kuşatma.": "Level 1: militia, spearmen and scouts; 2: archers; 3: riders; 4: siege.",
  "Her seviyede savunmayı %15 artırır; kuşatma hasarını sınırlar.": "+15% defense per level and reduced siege damage.",
  "Dost yerleşimlere mal taşır; mesafeye bağlı ticaret primi kazanır.": "Moves goods between friendly settlements and earns a distance-based trade premium.",
  "Genişleme menzilini, inşa hızını ve siyasi ağı artırır.": "Extends expansion range, construction speed and political reach.",
  "Milis": "Militia", "Mızraklı": "Spearman", "Okçu": "Archer", "Atlı": "Rider", "Gözcü": "Scout", "Koçbaşı": "Battering ram",
  "Hâkimiyet": "Dominion", "Zenginlik": "Wealth", "Kuruluş": "Founding", "Yerel Güç": "Local Power", "Bölgesel Güç": "Regional Power", "Büyük Hanedan": "Great Dynasty",
  "İaşe merkezi": "Supply center", "Üretim merkezi": "Production center", "Ticaret merkezi": "Trade center", "Ordu merkezi": "Military center", "Siyasi merkez": "Political center",
  "Yapı geliştir": "Upgrade a building", "İkinci yurt": "Second settlement", "Yerleşilen bölge": "Settled region", "Uzmanlık çeşidi": "Specialization types", "İkmal hattı": "Supply route", "Bölgesel yatırım aşaması": "Regional investment levels", "Gelişmiş bölge": "Developed regions", "Finali tamamlanan yol": "Completed victory path",
  "Yerleşim ağı": "Settlement network", "III. seviye ekonomik bölge": "Level III economic regions", "III. seviye askeri bölge": "Level III military regions", "III. seviye siyasi bölge": "Level III political regions", "Kervan avlusu toplamı": "Total caravan court levels", "Büyük rakibe karşı kazanılan meydan": "Major rivals defeated", "Ordu gücü": "Army power", "Bağlı hanedan": "Vassal dynasties", "Diplomasi yeteneği": "Diplomacy skill", "Bölgesel final hazırlığı": "Regional finale preparations", "Bölgesel keşif": "Regional scouting", "Bölgede bağlı stratejik nokta": "Linked strategic points in region",
  "İdare": "Stewardship", "Savaş": "Warfare", "Ticaret": "Trade", "Diplomasi": "Diplomacy", "Entrika": "Intrigue",
  "Karşılama": "Welcome", "Dönüm noktası": "Milestone", "İnşa": "Construction", "Eğitim": "Training", "Keşif": "Scouting", "Dönüş": "Return", "Toprak iddiası": "Claim", "Muharebe": "Battle", "Tehdit": "Threat", "Kaynak sıkıntısı": "Shortage", "Engellendi": "Blocked", "Kampanya": "Campaign", "Zafer": "Victory", "Rapor": "Report",
  "Sefer": "Campaign", "Stratejik nokta": "Strategic point", "Yerleşim kafilesi": "Settler caravan", "Kervan": "Caravan", "Birlik yok": "No troops",
  "NEDEN ÖNEMLİ?": "WHY DOES IT MATTER?", "SONRAKİ KARAR": "NEXT DECISION", "Gizli": "Unknown", "Bilinmiyor": "Unknown",
  "Hedef seç": "Pick a target", "Emri seç": "Pick an order", "Önizle ve onayla": "Preview and confirm", "Zamanı başlat, sonucu izle": "Start time, watch the result", "Emir adımları": "Order steps",
  "EMİR ÖNİZLEMESİ": "ORDER PREVIEW", "Bedel": "Cost", "Sonuç": "Result", "Bedelsiz": "No cost", "Henüz onaylanamaz:": "Cannot confirm yet:", "Şimdi yapılamaz:": "Not possible now:",
  "Onaylarsan tam olarak bu uygulanır; dünya sen onaylayana kadar durur.": "Confirming applies exactly this; the world waits until you confirm.",
  "DÖNEM ÖZETİ": "PERIOD SUMMARY", "Dönem özeti": "Period summary", "Dönem özetini kapat": "Close period summary", "Divan’da oku →": "Read in the Council →", "Askerî güç": "Military power", "Yoldaki birlik": "Troops on the road", "Kuyruktaki iş": "Queued jobs",
  "Lejant": "Legend", "Sınırlar": "Borders", "Sınır katmanını aç veya kapat": "Toggle the border layer", "Senin sınırın": "Your border", "Rakip hanedan sınırı": "Rival dynasty border", "Seçili yerleşimin alanı": "Selected settlement's area", "Özel nokta · adı yakında görünür": "Special point · named when zoomed in", "Bölge adları dünya görünümünde": "Region names in world view", "Sınır katmanı kapalı. Etki alanı halkaları gösteriliyor.": "Border layer off. Influence rings are shown.",
  "Katmanlar": "Layers", "Bölgeler": "Regions", "Tehdit ve seferler": "Threats and campaigns", "Menzil": "Range", "BÖLGE": "REGION", "YERLEŞİM": "SETTLING", "BAĞLAMA": "CLAIM", "TEHDİT": "THREAT",
  "Kaydet": "Save", "Devam et": "Continue", "Kampanyaya devam et": "Continue campaign", "Yeni oyun": "New game", "Yeni hanedan kur": "Found a new dynasty", "Yedekten kampanya aç": "Open a campaign backup", "Elle kaydet": "Manual save", "Dışa aktar": "Export", "İçe aktar": "Import", "İptal": "Cancel", "Kapat": "Close", "Onayla": "Confirm",
}));

const rules = [
  [/^Gün (\d+) ·/, "Day $1 ·"],
  [/^(\d+(?:[.,]\d+)?) gün$/, "$1 days"],
  [/^(\d+) sa (\d+) dk$/, "$1 hr $2 min"],
  [/^(\d+) dk$/, "$1 min"],
  [/^(\d+)\. seviye$/, "Level $1"],
  [/^Seviye (\d+)$/, "Level $1"],
  [/^Kaydedildi /, "Saved "],
  [/^Bölge (\d+)$/, "Region $1"],
];

export function translate(value) {
  const source = String(value ?? "");
  if (getLang() !== "en" || !source) return source;
  if (EN.has(source)) return EN.get(source);
  const normalized = source.replace(/\s+/g, " ").trim();
  if (EN.has(normalized)) return EN.get(normalized);
  for (const [pattern, replacement] of rules) if (pattern.test(source)) return source.replace(pattern, replacement);
  return source;
}

const originals = new WeakMap();
const originalAttrs = new WeakMap();
const attrs = ["aria-label", "title", "placeholder"];
function paintNode(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    if (!originals.has(node)) originals.set(node, node.nodeValue);
    const source = originals.get(node);
    const leading = source.match(/^\s*/)?.[0] || "";
    const trailing = source.match(/\s*$/)?.[0] || "";
    node.nodeValue = leading + translate(source.trim()) + trailing;
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  for (const attr of attrs) {
    if (!node.hasAttribute(attr)) continue;
    if (!originalAttrs.has(node)) originalAttrs.set(node, {});
    const saved = originalAttrs.get(node);
    if (!(attr in saved)) saved[attr] = node.getAttribute(attr);
    node.setAttribute(attr, getLang() === "en" ? translate(saved[attr]) : saved[attr]);
  }
  node.childNodes.forEach(paintNode);
}

export function applyLanguage(root = document.documentElement) {
  document.documentElement.lang = getLang();
  document.title = getLang() === "en" ? "HANEDANIAN — TarikLab" : "HANEDANIAN — TarikLab";
  paintNode(root);
}

let observer;
export function installLanguage() {
  applyLanguage();
  observer = new MutationObserver((records) => {
    observer.disconnect();
    records.forEach((record) => record.addedNodes.forEach(paintNode));
    observer.observe(document.body, { childList: true, subtree: true });
  });
  observer.observe(document.body, { childList: true, subtree: true });
  const refresh = (event) => {
    if (event.type === "storage" && event.key && event.key !== STORAGE_KEY) return;
    observer.disconnect();
    applyLanguage();
    observer.observe(document.body, { childList: true, subtree: true });
  };
  window.addEventListener("storage", refresh);
  window.addEventListener("tlab-language", refresh);
}
