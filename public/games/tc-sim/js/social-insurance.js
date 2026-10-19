// Prospective game coverage for catalog wage jobs, not an SGK contribution
// statement. No statutory day conversion, contribution rate or payroll charge.
const employers = new Set(["market", "office", "waiter", "barista", "factory", "warehouse", "callcenter", "cashier_big", "sales_floor"]);
const emptyService = () => ({ version: 1, days: 0, lastEmployer: null, employers: [] });
function validService(s) {
  if (s === undefined) return true;
  return Boolean(s && s.version === 1 && Number.isSafeInteger(s.days) && s.days >= 0 &&
    (s.lastEmployer === null || employers.has(s.lastEmployer)) && Array.isArray(s.employers) && s.employers.length <= employers.size &&
    new Set(s.employers.map(r=>r.id)).size === s.employers.length &&
    s.employers.every(r=>employers.has(r.id) && Number.isSafeInteger(r.days) && r.days >= 0) &&
    s.employers.reduce((n,r)=>n+r.days,0) === s.days);
}
function copyService(s) { return s === undefined ? emptyService() : validService(s) ? {...s, employers:s.employers.map(r=>({...r}))} : s; }
const count = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
export function normalizeInsurance(value) {
  if (value && value.version !== 1) return value;
  return { version: 1, firstWeek: Number.isSafeInteger(value?.firstWeek) && value.firstWeek >= 0 ? value.firstWeek : null,
    lastWeek: Number.isSafeInteger(value?.lastWeek) && value.lastWeek >= 0 ? value.lastWeek : -1,
    coveredWeeks: count(value?.coveredWeeks), service: copyService(value?.service) };
}
export function validInsurance(value) {
  return Boolean(value && validService(value.service) && value.version === 1 && Number.isSafeInteger(value.coveredWeeks) && value.coveredWeeks >= 0 &&
    Number.isSafeInteger(value.lastWeek) && value.lastWeek >= -1 &&
    (value.firstWeek === null ? value.lastWeek === -1 && value.coveredWeeks === 0 :
      Number.isSafeInteger(value.firstWeek) && value.firstWeek >= 0 && value.lastWeek >= value.firstWeek &&
      value.coveredWeeks <= value.lastWeek - value.firstWeek + 1));
}
export function recordInsuranceWeek(state, covered) {
  const book = normalizeInsurance(state.flags.socialInsurance);
  if (!validInsurance(book)) return false;
  const week = state.time.absoluteWeek;
  if (!Number.isSafeInteger(week) || week < 0 || week <= book.lastWeek) return false;
  book.firstWeek ??= week;
  book.lastWeek = week;
  if (covered) book.coveredWeeks += 1;
  const service = book.service;
  // Four decision weeks model one contribution month. 8/7/8/7 is explicitly
  // game allocation, not the statutory calendar rule for partial employment.
  const employer = covered && state.time.year >= 2020 && employers.has(state.career?.jobId) ? state.career.jobId : null;
  service.lastEmployer = employer;
  if (employer) {
    const days = [8,7,8,7][state.time.weekOfMonth - 1];
    if (Number.isInteger(days)) {
      let row = service.employers.find(r=>r.id===employer);
      if (!row) { row={id:employer,days:0};service.employers.push(row); }
      row.days += days;service.days += days;
    }
  }
  state.flags.socialInsurance = book;
  return true;
}
export function fiscalSocialSummary(state) {
  return { insurance: normalizeInsurance(state.flags?.socialInsurance),
    pension: state.career?.retirement?.status === "retired" ? Math.max(0, Math.round(state.career.retirement.monthlyIncome || 0)) : 0,
    businessTax: Math.max(0, Math.round(state.flags?.business?.lastResult?.tax || 0)),
    hasTaxReport: Boolean(state.flags?.business?.lastResult) };
}
const copy = {
  tr: ["SGK / gözlenen çalışma", "hafta", "Geçmiş prim kaydı bilinmiyor. Bu sürümden itibaren katalog işlerinde tamamlanan çalışma haftaları izlenir; resmî SGK dökümü değildir. Net maaştan ek kesinti yapılmaz. Mevcut emeklilik koşulları korunur.", "Emeklilik aylığı", "Son işletme vergisi", "Henüz kapanmış işletme ayı yok"],
  en: ["Social insurance / observed work", "weeks", "Past contributions are unknown. Completed weeks in catalog wage jobs are tracked from this version; this is not an official SGK statement. Net pay has no additional deduction. Existing retirement conditions remain.", "Monthly pension", "Last business tax", "No settled business month yet"],
  pl: ["Ubezpieczenie społeczne / zaobserwowana praca", "tyg.", "Wcześniejsze składki są nieznane. Od tej wersji śledzimy zakończone tygodnie pracy na etatach z katalogu; nie jest to oficjalny wyciąg SGK. Brak dodatkowego potrącenia z pensji netto. Dotychczasowe warunki emerytury pozostają.", "Miesięczna emerytura", "Ostatni podatek firmy", "Brak rozliczonego miesiąca firmy"],
};
export function renderFiscalSocialSummary(state, money, language = "tr") {
  const t = copy[language] || copy.tr, s = fiscalSocialSummary(state);
  const service=s.insurance.service || emptyService();
  const serviceCopy={tr:["Modellenen prim günü","İş sözleşmesi kayıtları","Son gözlenen durum","Kapsamdaki iş","Kapsam dışı / çalışılmadı","2020 sonrası desteklenen işlerde ay 30 gün olarak modellenir; kısmi ay dağılımı oyun varsayımıdır. İş kaydı işveren yerine kullanılır. Prim tutarı veya resmî bildirim kanıtı değildir."],
    en:["Modeled contribution days","Employment records","Last observed status","Supported job","Outside scope / not worked","Supported jobs from 2020 model a month as 30 days; partial-month allocation is a game assumption. Job records stand in for employers. This is not proof of premium payment or official reporting."],
    pl:["Modelowane dni składkowe","Rejestry zatrudnienia","Ostatni zaobserwowany status","Obsługiwana praca","Poza zakresem / bez pracy","Dla obsługiwanych prac od 2020 roku miesiąc modeluje się jako 30 dni; podział części miesiąca jest założeniem gry. Rejestry pracy zastępują pracodawców. Nie jest to dowód opłacenia składek ani urzędowego zgłoszenia."]}[language] || null;
  const extra=serviceCopy ? `<div data-insurance-service><span>${serviceCopy[0]}</span><strong>${service.days}</strong><small>${serviceCopy[5]}</small></div><div><span>${serviceCopy[1]}</span><strong>${service.employers.length}</strong></div><div><span>${serviceCopy[2]}</span><strong>${service.lastEmployer ? serviceCopy[3] : serviceCopy[4]}</strong></div>` : "";
  return `<section class="detail-summary panel" data-social-insurance><div><span>${t[0]}</span><strong>${s.insurance.coveredWeeks ?? 0} ${t[1]}</strong><small>${t[2]}</small></div><div><span>${t[3]}</span><strong>${money(s.pension)}</strong></div><div><span>${t[4]}</span><strong>${s.hasTaxReport ? money(s.businessTax) : t[5]}</strong></div>${extra}</section>`;
}
