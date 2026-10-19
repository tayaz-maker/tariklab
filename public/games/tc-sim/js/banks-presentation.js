// Read-only historical identity/service context. Never creates accounts, money,
// offer eligibility or bank-specific rates. Game offers retain their own engine.
export const BANK_SOURCES = Object.freeze({
  ziraat: "https://www.ziraatbank.com.tr/tr/bankamiz/hakkimizda/bankamiz-tarihcesi",
  isbank: "https://www.isbank.com.tr/bankamizi-taniyin/tarihimiz",
  garanti: "https://www.garantibbva.com.tr/tarihce",
});
export const bankText = (language, tr, en, pl) => ({ tr, en, pl }[language] || tr);
export function banksForDate(date, language = "tr") {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(String(date)) ? date : "1980-01-01";
  const text = (tr, en, pl) => bankText(language, tr, en, pl);
  return [
    day >= "1888-08-15" && { id: "ziraat", name: "Ziraat Bankası", source: BANK_SOURCES.ziraat,
      service: text("Şube bankacılığı; tarım kredileri tarihsel faaliyet alanıdır.", "Branch banking; agricultural lending is a documented historical activity.", "Bankowość oddziałowa; kredyty rolnicze są udokumentowaną działalnością historyczną.") },
    day >= "1924-08-26" && { id: "isbank", name: "Türkiye İş Bankası", source: BANK_SOURCES.isbank,
      service: day >= "1998-01-01" ? text("Şube ve internet bankacılığı. İnternet Şubesi 1997'de açıldı.", "Branch and internet banking. The Internet Branch opened in 1997.", "Bankowość oddziałowa i internetowa. Oddział internetowy uruchomiono w 1997 r.")
        : day >= "1997-01-01" ? text("İnternet Şubesi'nin açıldığı yıl: 1997. Kesin açılış günü burada modellenmez.", "Internet Branch launch year: 1997. The exact launch day is not modeled here.", "Rok uruchomienia oddziału internetowego: 1997. Dokładny dzień nie jest tu modelowany.")
        : text("Şube bankacılığı ve tasarruf hizmetleri. İnternet Şubesi henüz açılmadı.", "Branch banking and savings services. The Internet Branch has not opened yet.", "Bankowość oddziałowa i usługi oszczędnościowe. Oddział internetowy jeszcze nie działa.") },
    day >= "1946-06-21" && { id: "garanti", name: day >= "2019-06-10" ? "Garanti BBVA" : "Garanti Bankası", source: BANK_SOURCES.garanti,
      service: text("Şube bankacılığı. Garanti BBVA markasına geçiş: 10 Haziran 2019.", "Branch banking. The Garanti BBVA brand began on 10 June 2019.", "Bankowość oddziałowa. Marka Garanti BBVA obowiązuje od 10 czerwca 2019 r.") },
  ].filter(Boolean);
}
export function renderBankHistory(date, language = "tr") {
  const text = (tr, en, pl) => bankText(language, tr, en, pl);
  return `<section class="panel" data-bank-history><div class="panel-head"><h2>${text("Dönemin bankaları", "Banks of the period", "Banki danej epoki")}</h2></div><p class="context-note">${text("Adlar ve belirtilen hizmetler tarihsel bilgidir. Aşağıdaki kredi ve yatırım tutarları ise oyun modelidir; bu bankaların gerçek ürünleri veya teklifleri değildir.", "Names and listed services are historical context. The loan and investment amounts below are game models, not these banks' actual products or offers.", "Nazwy i wymienione usługi to informacje historyczne. Poniższe kwoty kredytów i inwestycji są modelem gry, a nie rzeczywistymi produktami lub ofertami tych banków.")}</p><div class="option-grid">${banksForDate(date, language).map(bank => `<details class="option-card" data-bank-id="${bank.id}"><summary>${bank.name}</summary><p>${bank.service}</p><a href="${bank.source}" target="_blank" rel="noopener noreferrer">${text("Resmî tarihçe / hizmet kaynağı", "Official history / service source", "Oficjalne źródło historii / usług")}</a></details>`).join("")}</div></section>`;
}

export const bankFinanceHelp = language => bankText(language,
  "Para ekranında nakit akışı, net servet, borçlar, hesap dökümü ve ay sonu raporu bulunur. Kredi, erken ödeme, mevduat ve yatırım işlemleri ile kredi sicili Bankalar'dadır. Ev, araç ve kalıcı eşya Emlak'ta; günlük alışveriş Çarşı'dadır. Kredi bugün nakit sağlar ve aylık ödeme getirir. Banka adları ve açıklanan hizmetler tarihsel bilgidir; oyun tutarları, getirileri ve kredi koşulları gerçek banka teklifi değildir.",
  "Money contains cash flow, net worth, debts, account statements and month-end reports. Loans, early repayment, deposits, investments and credit history are in Banks. Homes, vehicles and owned goods remain in Property; daily shopping is on Market Street. Credit provides cash now and creates monthly payments. Bank names and listed services are historical context; game amounts, returns and loan terms are not actual bank offers.",
  "Finanse zawierają przepływy pieniężne, majątek netto, długi, wyciągi i raporty miesięczne. Kredyty, wcześniejsze spłaty, lokaty, inwestycje i historia kredytowa są w Bankach. Domy, pojazdy i trwałe przedmioty pozostają w Nieruchomościach; codzienne zakupy są na Targu. Kredyt daje gotówkę teraz i tworzy raty miesięczne. Nazwy banków i wymienione usługi są historyczne; kwoty, zyski i warunki kredytów w grze nie są rzeczywistymi ofertami banków.");
