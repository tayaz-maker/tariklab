import { bankFinanceHelp } from "./banks-presentation.js?v=10";
/**
 * Nasıl Oynanır içeriği. Saf veri/render — DOM'a dokunmaz, state okumaz,
 * hiçbir yan etki yaratmaz. `app.js` bunu bir modal içinde gösterir/gizler.
 */

export const HELP_SECTIONS = [
  {
    title: "Amaç",
    body: "18 yaşında, İstanbul'da aile evinde başlayan tek bir hayatı haftalık kararlarla yönetiyorsun. Kariyer, para, ilişkiler ve sağlık birbirini etkiler; amaç mükemmel bir plan değil, sürdürülebilir bir denge kurmak.",
  },
  {
    title: "Haftalık döngü",
    body: "Her hafta 7 hakkın var. Düzenli iş, okul ve çocuk bakımı yoksa 8, sağlığın kötüyse 3. İş, okul, aile, aşk ve dinlenme aynı haftayı paylaşır. Haftayı erken kapatabilirsin. Maaş, kira, kredi ve dükkân ay sonunda işler.",
  },
  {
    title: "Kontroller",
    body: "Üst şeritten Gelenler, Hafta, Para, Yakınlar ve Beden'e doğrudan geçersin. Alışveriş Çarşı'da, ev ve araç Emlak'tadır. Diğer bölümler aşağıdaki menüdedir. Gelenler bekleyen kararları ve son gelişmeleri tek yerde toplar; açık olay bitmeden hafta ilerlemez.",
  },
  {
    title: "İş ve finans",
    body: bankFinanceHelp("tr"),
  },
  {
    title: "Tarihsel rota ve yetişkin hayatı",
    body: "1999 ya da 1980'lerden başlayan rotalar 1 Ocak 2030'a ulaşır; 2026–2029 olayları kurgu olasılıklarıdır. Yetişkin ilişkisinde karşılıklı rıza varsa korunma ve seks seçimi açılır; kondomsuz ilişkide gebelik sonucu gecikmeli gelebilir. Söz, nişan, düğün, takı, evlilik ve çocuk bakımının hem duygusal hem mali sonuçları vardır. Bunlar oyun mekaniğidir, sağlık tavsiyesi değildir.",
  },
  {
    title: "İlerleme ve göstergeler",
    body: "Beden ekranı enerji/stres/sağlığını, Hafta bekleyen randevu ve gecikmiş sonuçlarını, Yıl dosyası her yılın özetini tutar. İnsanlar ve Yakınlar sekmeleri güven, yakınlık ve gerilim gibi ilişkisel göstergeleri taşır.",
  },
  {
    title: "Risk ve sonuçlar",
    body: "Sağlığı boşlarsan haftalık hakkın düşer ve işin etkilenir. İlişkiyi boşlarsan soğur. Bazı sonuçlar hemen değil, haftalar sonra bir olay, bir mesaj ya da bir kira kâğıdı olarak döner. İş, okul, ilişki, aile, borç, ev, çevre, sağlık ve kriz aynı hayatta birikir. Rastgele kart değil.",
  },
  {
    title: "Kayıt",
    body: "Üç ayrı kayıt yerin (Slot) var; başlangıç ekranından birini seçersin. Oyun seçili slota tarayıcının yerel deposunda otomatik kaydedilir, üstteki Kaydet ile elle de kaydedebilirsin. Yeni oyun, seçili slottaki mevcut hayatı tamamen siler ve onay ister; diğer slotlar etkilenmez.",
  },
  {
    title: "İlk oyun için ipuçları",
    body: "Önce bir iş bul ve birkaç hafta düzen kur. Sağlığın kritik seviyeye inmeden dinlenmeye zaman ayır. Elindeki parayı hepsini harcamadan bir miktar nakit tut. Aile ve yakın çevrenle bağını koparma; ilerideki birçok fırsat bu bağa dayanır.",
  },
  {
    title: "İleri hayat: emeklilik, miras ve nesil",
    body: "60'lı yaşlardan sonra yeterli çalışma geçmişiyle emekliliği değerlendirebilirsin. Hayat sona erdiğinde bir Yaşam Raporu çıkar ve varsa yetişkin bir çocuğunla yeni bir kuşak olarak devam edebilirsin; servetin ve aile bağların bir sonraki hayata iz bırakır.",
  },
  {
    title: "Kaynaklar",
    body: "Hayat kurgudur. Gözlenen sayılar sınırlıdır. 1999–2025 net asgari ücret Çalışma ve Sosyal Güvenlik Bakanlığı çizelgesindendir; 2025 net 22.104,67 TL. 1999 öncesi yıllık TÜFE, Dünya Bankası FP.CPI.TOTL (Türkiye, 2010=100, 6 Ekim 2026 indirimi): https://data.worldbank.org/indicator/FP.CPI.TOTL?locations=TR . Ücret çizelgesi: https://www.csgb.gov.tr/Media/t2qlvwrg/asgari-%C3%BCcret-net-br%C3%BCt-i%C5%9Fverene-maliyet.pdf ve https://www.csgb.gov.tr/Media/f4xjys1e/2025-asgari-%C3%BCcret_.pdf . Diğer fiyat, kira ve banka oranı aynı ücret ölçeğindeki oyun bütçesidir; ilan değildir. 2026–2030 için ücret ve fiyat tahmini yoktur. Kurlar TCMB bülteninden çeyreklik alınır (7 Ekim 2026). Altın, Dünya Bankası aylık ons verisidir: https://thedocs.worldbank.org/en/doc/74e8be41ceb20fa0da750cda2f6b9e4e-0050012026/related/CMO-Historical-Data-Monthly.xlsx . Ziynet gramı kuyumcu fiyatı değildir. Veri ufkundan sonrası kurgu diye işaretlenir. Tarihli karttaki TCMB veya Dünya Bankası bağlantısı o olayın yanında durur.",
  },
];

function escapeText(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch],
  );
}

/** Modal HTML'i. Salt görüntü — hiçbir alanı state'e yazmaz. */
export function renderHelpModal() {
  const I = typeof window !== "undefined" ? window.tlabI18n : null;
  const source = I && I.contentLang() === "en" ? I.TCSIM_HELP_EN : HELP_SECTIONS;
  const title = I && I.contentLang() === "en" ? "How to Play" : "Nasıl Oynanır";
  const close = I && I.contentLang() === "en" ? "Close" : "Kapat";
  const extra = I && I.contentLang() === "en" ? [
    {title: "Market street: effects and ownership", body: "Read the cost, decision time and body effects before buying. Shelves split the list. Owned goods, vehicles and housing are on Property, not here. Owned items retain their benefits across saves; buying another does not stack them. Bikes and scooters add monthly upkeep. Risky experiences can harm health, finances or relationships. Gambling shows stake, payout and net cash: losses are more likely in the long run."},
    {title: "Finance: investment profit and loss", body: "Cash is spendable money; net worth also includes assets minus debts. Investment cost basis includes the purchase fee. Unrealized P/L is current value minus basis, not cash income. Monthly reports show valuation changes. Selling deducts a 1% fee and allocates the sold share of basis to calculate realized P/L. Remaining holdings keep their proportional basis."},
  ] : [
    {title: "Çarşı", body: "Almadan önce fiyatı, süreyi ve bedene etkisini oku. Liste raflara ayrılır. Eşya, araba ve ev Emlak'tadır. Aldığın eşya kayıtta kalır; aynısından ikinciyi almak ek fayda vermez. Bisiklet ve motor aylık bakım ister. Riskli seçimler sağlığı, parayı ya da ilişkiyi etkiler. Kumar tutarı, dönüşü ve net parayı ayrı yazar. Çoğunlukla az kaybedersin. Kazanmak daha seyrek, büyük oynama nadirdir."},
    {title: "Para: yatırım", body: "Nakit harcayabildiğin paradır. Servet buna malı ve borcu da katar. Yatırım maliyeti alış masrafını içerir. Henüz bozdurmadığın kâr veya zarar nakit değildir. Ay sonu değer değişimini yazar. Satışta %1 masraf düşer. Kalan payın maliyeti durur."},
  ];
  const language = I?.getLang?.() || "tr";
  const sections = [...source, ...extra].map((section, index) => index === 3 ? { ...section, body: bankFinanceHelp(language) } : section).map(
    (section) =>
      `<section class="help-section"><h3>${escapeText(section.title)}</h3><p>${escapeText(section.body)}</p></section>`,
  ).join("");
  return `<div class="help-backdrop" role="presentation"><div class="help-card" role="dialog" aria-modal="true" aria-labelledby="help-title"><div class="help-card-head"><h2 id="help-title">${title}</h2><button class="button button-quiet" id="help-close" aria-label="${close}">${close}</button></div><div class="help-body">${sections}</div></div></div>`;
}
