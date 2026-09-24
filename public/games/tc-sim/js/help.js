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
    body: "Her hafta 6 zaman/odak bloğun var (sağlığın kritikse 3'e düşer). İş, eğitim, aile ve sosyal hayat aynı bütçeyi paylaşır; haftayı erken kapatabilir, yorgunluk ve ertelenen sonuçları göze alabilirsin. Maaş, kira ve düzenli giderler ay sonunda otomatik işler.",
  },
  {
    title: "Kontroller",
    body: "Üstteki menüden Ana Sayfa, Ben, Takvim, Finans, Market, İş, Eğitim, Kişiler, Aile/İlişkiler, Ev, Beden, Geçmiş ve Yıl Dosyası bölümlerine geçersin. Bazı seçimler ayrı bir olay penceresi açar; orada verdiğin cevap haftayı ilerletmeden hemen uygulanır.",
  },
  {
    title: "İş ve finans",
    body: "İş bulmak, terfi ve eğitim Finans'ı doğrudan etkiler. Finans ekranı bakiye, aylık gelir/gider ve net servetini gösterir: nakit, yatırım, gayrimenkul, araç/eşya ve borçların toplamı. Yaşam standardını (mütevazıdan yükseğe) ve abonelik harcamalarını da buradan yönetirsin; günlük alışveriş, hediye ve riskli harcamalar ayrı Market ekranındadır.",
  },
  {
    title: "İlerleme ve göstergeler",
    body: "Beden ekranı enerji/stres/sağlığını, Takvim bekleyen randevu ve gecikmiş sonuçlarını, Yıl Dosyası her yılın özetini tutar. Kişiler ve Aile/İlişkiler sekmeleri güven, yakınlık ve gerilim gibi ilişkisel göstergeleri taşır.",
  },
  {
    title: "Risk ve sonuçlar",
    body: "İhmal edilen sağlık karar hakkını düşürür ve iş performansını etkiler; ihmal edilen ilişkiler zamanla soğur. Kararların bazı sonuçları hemen değil, haftalar sonra bir olay, bir mesaj veya bir kira kâğıdı olarak geri döner. Kariyer, eğitim, ilişki, aile, borç, konut, çevre, statü, sağlık ve kriz aynı hayatta birbirine bağlanır — rastgele kart değil, biriktirdiğin hayat.",
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
    {title: "Market: effects and ownership", body: "Read the cost, decision time and body effects before buying. Owned items retain their benefits across saves; buying another does not stack them. Bikes and scooters add monthly upkeep. Risky experiences can harm health, finances or relationships. Gambling shows stake, payout and net cash: losses are more likely in the long run."},
    {title: "Finance: investment profit and loss", body: "Cash is spendable money; net worth also includes assets minus debts. Investment cost basis includes the purchase fee. Unrealized P/L is current value minus basis, not cash income. Monthly reports show valuation changes. Selling deducts a 1% fee and allocates the sold share of basis to calculate realized P/L. Remaining holdings keep their proportional basis."},
  ] : [
    {title: "Market: etkiler ve sahiplik", body: "Almadan önce fiyatı, karar maliyetini ve beden etkilerini oku. Kalıcı eşyanın faydası kayıtta korunur; ikinci alım faydayı biriktirmez. Bisiklet ve motor aylık bakım gideri getirir. Riskli deneyimler sağlığı, parayı veya ilişkileri etkileyebilir. Kumar sonucu bahis, geri dönüş ve net nakdi ayrı gösterir; uzun vadede kayıp riski ağır basar."},
    {title: "Finans: yatırım kâr ve zararı", body: "Nakit harcanabilir paradır; net servet varlıkları ve borçları da içerir. Yatırım maliyeti alış işlem farkını kapsar. Gerçekleşmemiş kâr/zarar, güncel değer eksi maliyettir; nakit gelir değildir. Ay sonu raporu değer değişimlerini gösterir. Satışta %1 işlem farkı ve satılan payın maliyeti düşülerek gerçekleşmiş sonuç hesaplanır. Kalan yatırımın orantılı maliyeti korunur."},
  ];
  const sections = [...source, ...extra].map(
    (section) =>
      `<section class="help-section"><h3>${escapeText(section.title)}</h3><p>${escapeText(section.body)}</p></section>`,
  ).join("");
  return `<div class="help-backdrop" role="presentation"><div class="help-card" role="dialog" aria-modal="true" aria-labelledby="help-title"><div class="help-card-head"><h2 id="help-title">${title}</h2><button class="button button-quiet" id="help-close" aria-label="${close}">${close}</button></div><div class="help-body">${sections}</div></div></div>`;
}
