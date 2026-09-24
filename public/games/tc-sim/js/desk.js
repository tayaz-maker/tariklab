import { managementDesk, managementDeck } from "../../shared/management-desk.js";

// Display translations for labels exposed by the new compact desk. Canonical
// event/catalog text and persisted records remain unchanged.
const labels = {
  "Ürün, hizmet ve deneyim": "Products, services and experiences",
  "Tüketim burada. Finans yalnız kasa, borç ve yatırımdır. Riskli alışveriş yasal market gibi durmaz.": "Consumption belongs here. Finance contains cash, debt and investments. Risky purchases are distinct from legal shopping.",
  "Kategori": "Category", "Günlük yaşam": "Daily life", "Kişisel bakım": "Personal care",
  "Ev kolaylığı": "Home convenience", "Hediye": "Gift", "Eğlence": "Entertainment",
  "Ev eğlencesi": "Home entertainment", "Hobi": "Hobbies", "18+ sosyal yaşam": "18+ social life",
  "Seyahat": "Travel", "Günlük": "Daily", "Giyim / Statü": "Clothing / Status",
  "Teknoloji": "Technology", "Ev": "Home", "Ulaşım": "Commute", "Sağlık / Spor": "Health / Sport",
  "Yetişkin / Gece": "Adult / Nightlife", "Riskli / Yasadışı": "Risky / Illegal", "Hediyeler": "Gifts",
  "Çalışma hayatı": "Working life", "Çalışma durumu": "Employment status", "Aylık maaş": "Monthly salary",
  "Maaş": "Salary", "İş yükü": "Workload", "Güvence": "Security", "Emeklilik": "Retirement",
  "Henüz uygun değil": "Not yet eligible", "Emeklilik değerlendirmesi 60 yaşından sonra açılır.": "Retirement assessment becomes available after age 60.",
  "Ev ve iş yakın; haftalık ek ulaşım yükü yok.": "Home and work are close; no extra weekly commute burden.",
  "Aktif iş": "Current job", "İş alanı": "Career field", "Alan": "Field", "Hizmet": "Service",
  "Haftalık etki": "Weekly effect", "Deneme süresi": "Probation", "Gereksinim": "Requirements",
  "Gereksinim yok": "No requirements", "Teklifi kabul et": "Accept offer", "İş fırsatları": "Job opportunities",
  "Deneyim": "Experience", "Performans": "Performance", "Eğitim düzeyi": "Education level",
  "Birikmiş deneyim": "Accumulated experience", "Kariyer bandı": "Career band", "Mevcut işten ayrıl": "Leave current job",
  "Alan deneyimi": "Field experience", "Değerlendirme": "Review", "İşten ayrıl": "Leave job",
  "Çevre": "Social circle", "Önemli kişiler": "Key people", "Kişi dosyası": "Person file",
  "Son önemli anılar": "Recent meaningful memories", "Gerilim": "Tension", "Arkadaş": "Friend",
  "Yakınlık bağın gücünü, güven sana duyulan inancı, gerilim ise aranızdaki sürtüşmeyi gösterir.": "Closeness measures the bond, trust measures confidence in you, and tension measures friction between you.",
  "Bir sosyal etkileşim haftalık karar hakkı kullanır.": "A social interaction uses a weekly decision.",
  "Aile evi sosyal planlar için daha fazla koordinasyon istiyor.": "Living with family requires more coordination for social plans.",
  "Eğitim hayatı": "Education", "Eğitim programları": "Education programs", "Programlar": "Programs",
  "Kayıt ücreti": "Enrollment fee", "Aylık ücret": "Monthly tuition", "Süre": "Duration",
  "Tam zamanlı": "Full-time", "Yarı zamanlı": "Part-time", "Seviye": "Level",
  "Fiziksel ve zihinsel durum": "Physical and mental condition", "Genel durum": "Overall condition",
  "Bilinen durumlar": "Known conditions", "Ulaşım yükü": "Commute burden", "Eğitim yükü": "Study burden",
  "Bilinen kalıcı bir durum yok.": "No known lasting condition.", "Yok": "None",
  "Hayat merkezi": "Life desk", "Bu hafta": "This week", "Haftanın öncelikleri": "Weekly priorities",
  "Hayat kayıtları": "Life records", "Tamamlanan yıllar": "Completed years", "Yıl özetleri": "Annual summaries",
  "İlk yıl tamamlandığında burada bir dosya oluşacak.": "A file will appear here when the first year ends.",
  "Mali durum ve net servet": "Finances and net worth", "Bakiye": "Balance", "Net servet": "Net worth",
  "Aylık gelir": "Monthly income", "Aylık gider": "Monthly expenses", "Ay sonu tahmini": "Month-end projection",
  "Yaşam standardı": "Living standard", "Gündelik düzen": "Daily routine", "Tüketim": "Consumption",
  "Daha yüksek standart yalnız daha fazla seçenek ve düzenli gider sağlar; mutluluk satın alınmaz.": "A higher standard provides more options and recurring expenses; it cannot buy happiness.",
  "Günlük harcama, gece hayatı, hediye ve riskli alışveriş MARKET ekranında.": "Daily spending, nightlife, gifts and risky purchases are on the MARKET screen.",
  "Market'e geç": "Open Market", "ayrı ekran": "separate screen", "Abonelikler": "Subscriptions",
  "Düzenli hizmetler": "Recurring services", "Yatırımlar": "Investments", "Sahip oldukların": "Owned assets",
  "Borçlar": "Debts", "Alacaklar": "Receivables", "İşlemler": "Transactions", "Son işlemler": "Recent transactions",
  "Eğitim ve yeterlilik": "Education and qualifications", "Eğitim seviyesi": "Education level", "Alanlar": "Fields",
  "Henüz alan yok": "No field yet", "Aktif program": "Active program", "Bu ay eğitim gideri": "This month's tuition",
  "Şu an bir programa kayıtlı değilsin.": "You are not currently enrolled in a program.",
  "Ay sonunda tahsil edilir.": "Charged at the end of the month.", "Eğitim yolları": "Education pathways",
  "Mesleki Eğitim Kursu": "Vocational training course", "Üniversite": "University", "Lise mezunu": "High-school graduate",
  "Haftalık yük": "Weekly workload", "Kazandırır": "Grants", "Tam zamanlı başla": "Start full-time", "Yarı zamanlı başla": "Start part-time",
  "Karakter": "Character", "Yaşam dönemi": "Life stage", "Yaşam yeri": "Residence", "İş": "Job",
  "Enerji": "Energy", "Stres": "Stress", "Sosyal": "Social", "Sevgili yok": "No partner",
  "Gündem": "Agenda", "Gelen kutusu": "Inbox", "Hayat kaydı": "Life record", "Önceliklerin": "Your priorities",
  "Enerji ve stres; haftalık kararlar, iş yükü ve ulaşım tarafından etkilenir.": "Energy and stress are affected by weekly decisions, workload and commuting.",
  "Temel kararlar her hafta açık. Diğer seçenekler hayat durumuna göre değişir.": "Basic decisions are available every week. Other options depend on your life situation.",
  // Decision network (week plan and decision tags).
  "ACİL BASKI": "URGENT PRESSURE", "HEDEF": "GOAL", "FIRSAT": "OPPORTUNITY", "SONUÇ ZİNCİRİ": "CONSEQUENCE CHAIN",
  "Zaman": "Time", "Para": "Money", "İlişki": "Relationship", "Hedef": "Goal", "Önceki": "Earlier",
  "Bu hafta acil bir baskı yok": "No urgent pressure this week", "Planlama için iyi bir hafta.": "A good week for planning.",
  "Açık bir orta vadeli hedef yok": "No open medium-term goal", "Bir hedef açılınca seçimler ona bağlanır.": "When a goal opens, choices connect to it.",
  "Belirgin bir fırsat yok": "No clear opportunity", "Hedefe ayrılan haftalar fırsat doğurur.": "Weeks given to a goal create openings.",
  "Zincirde bekleyen sonuç yok": "Nothing waiting in the chain", "Sonraya taşan seçimler burada görünür.": "Choices that carry forward appear here.",
  "Ay sonu eksiye düşüyor": "Month-end goes negative",
  "Üç haftalık iş odağı iş yükünü hafifletti.": "Three weeks of work focus eased the workload.",
  "Üç haftalık para düzeni stresi azalttı.": "Three weeks of money order eased stress.",
  "Üç haftalık para düzeni konut adımını yakınlaştırdı.": "Three weeks of money order brought the housing step closer.",
  "Üç hafta aileye ayrılan zaman güven bıraktı.": "Three weeks of family time left trust behind.",
  "Üç hafta süren ilgi dostlukta güven bıraktı.": "Three weeks of attention built trust in the friendship.",
  "Üç haftalık bakım düzeni bedende karşılık buldu.": "Three weeks of care showed in the body.",
  "Üç haftalık odak eğitimi hızlandırdı.": "Three weeks of focus sped up education.",
  "Üç hafta süren ilgi ilişkideki gerilimi azalttı.": "Three weeks of attention eased tension in the relationship.",
  "Hedefe ayrılan seri bu hafta kesildi.": "The run of weeks for the goal broke this week.",
  "İlgisiz geçen haftalar bir yakınla mesafeyi büyüttü.": "Weeks without attention widened the distance with someone close.",
  "Bakımsız geçen haftalar stresi artırdı.": "Weeks without care raised stress.",
  "Yakınlara zaman ayırmazsan gelecek hafta mesafe başlar": "If you give no time to your people, distance starts next week",
  "Geçmiş bir karar geri dönecek": "A past decision will come back",
};
const english = new Map(Object.entries(labels).map(([tr, en]) => [tr.toLocaleLowerCase("tr"), en]));
export function deskEnglish(value) {
  const trimmed = value.trim();
  const exact = english.get(trimmed.toLocaleLowerCase("tr"));
  if (exact) return value.replace(trimmed, exact);
  return value.replace(/Otomatik kaydedildi\./g, "Autosaved.")
    .replace(/Elle kaydedildi\./g, "Saved manually.")
    .replace(/(\d+)\. ay \/ H(\d+)/g, "month $1 / W$2")
    .replace(/Son anlamlı temas (\d+) hafta önce/g, "Last meaningful contact $1 weeks ago")
    .replace(/(\d+) hafta · Düzenli vardiya/g, "$1 weeks · Regular shifts")
    .replace(/Aile Yanında ulaşımı/g, "Commute from family home")
    .replace(/Bu düzende yaşıyorsun\./g, "This is your current lifestyle.")
    .replace(/Tam (\d+) hafta · Yarı (\d+) hafta/g, "Full-time $1 weeks · Part-time $2 weeks")
    .replace(/(\d+) hafta\b/g, "$1 weeks").replace(/(\d+) ay\b/g, "$1 months")
    .replace(/Tam: enerji/g, "Full-time: energy").replace(/Yarı: enerji/g, "Part-time: energy")
    .replace(/Teknik alanı/g, "Technical field").replace(/(\d+) hak kaldı/g, "$1 decisions left")
    .replace(/(\d+) açık sosyal mesele/g, "$1 open social issues")
    .replace(/Ay sonu tahmini:/g, "Month-end projection:")
    .replace(/\bAylık /g, "Monthly ").replace(/\bNakit /g, "Cash ").replace(/\bYatırım /g, "Investments ")
    .replace(/Gayrimenkul /g, "Property ").replace(/Araç\/eşya /g, "Vehicle/durables ").replace(/Borç /g, "Debt ")
    .replace(/Maaş /g, "Salary ").replace(/Konut /g, "Housing ").replace(/Yaşam\/varlık /g, "Lifestyle/assets ").replace(/Diğer /g, "Other ")
    .replace(/\bEnerji /g, "Energy ").replace(/\bStres /g, "Stress ")
    .replace(/yakınlık ([+−-]?\d+)/g, "closeness $1").replace(/güven ([+−-]?\d+)/g, "trust $1");
}
function translateDesk(root) {
  const walker = root.ownerDocument.createTreeWalker(root, 4);
  while (walker.nextNode()) walker.currentNode.nodeValue = deskEnglish(walker.currentNode.nodeValue);
}
let openPerson = false;

// Only public rendered nodes cross this boundary: no hidden people data,
// simulation state, action dispatch or save function is passed to the desk.
export function arrangeLifeDesk(view, text) {
  const layout = document.querySelector(".game-body");
  const workspace = layout?.querySelector(".workspace");
  if (!workspace) return;
  // Install before app.js binds the original person action: the subsequent
  // render opens the newly selected person's sheet, without a second tap.
  workspace.querySelectorAll(".person-select, [data-open-person]").forEach(button => button.addEventListener("click", () => { openPerson = window.matchMedia("(max-width: 900px)").matches; }));
  if (document.documentElement.lang === "en" || window.tlabI18n?.contentLang?.() === "en") translateDesk(document.querySelector(".game-frame"));
  const operations = document.querySelector(".game-topbar");
  const week = workspace.querySelector(".week-control");
  if (week && operations) operations.append(week);
  const selectors = {
    career: ".option-card",
    education: ".option-card",
    home: ".option-card",
    market: ".wealth-grid > button",
    finance: ".wealth-grid > *, .open-case",
    people: ".person-detail",
    relationships: ".panel",
    dashboard: ".overview-grid > article, .agenda-panel, .people-panel, .cases-panel",
    body: ".panel",
    calendar: ".panel",
    character: ".panel",
    history: ".memory",
    yearbook: ".open-case",
  };
  if (view === "dashboard") {
    const priorities = workspace.querySelector(".week-panel");
    const overview = workspace.querySelector(".overview-grid");
    if (priorities && overview) overview.before(priorities);
  }
  const history = [...workspace.querySelectorAll(".history-panel, .career-history")];
  if (view === "finance") {
    const panels = [...workspace.querySelectorAll(".panel")];
    // Existing transaction and investment reports keep their full entries,
    // amounts and cost basis. No fictitious running balance is reconstructed.
    history.push(...panels.filter(panel => panel.querySelector(".history")));
  }
  managementDeck(layout, history, text("KAYIT / HESAP DÖKÜMÜ", "RECORD / ACCOUNT LEDGER"));
  managementDesk({ workspace, layout, key: `life:${view}`, selector: selectors[view] || ".panel", text, searchSelector: view === "people" ? ".person-select" : undefined, openInitially: view === "people" && openPerson, returnFocusSelector: view === "people" ? ".person-select.is-current" : undefined });
  openPerson = false;
}
