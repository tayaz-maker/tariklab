// Prospective game coverage for catalog wage jobs, not an SGK contribution
// statement. No statutory day conversion, contribution rate or payroll charge.
const count = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
export function normalizeInsurance(value) {
  if (value && value.version !== 1) return value;
  return { version: 1, firstWeek: Number.isSafeInteger(value?.firstWeek) && value.firstWeek >= 0 ? value.firstWeek : null,
    lastWeek: Number.isSafeInteger(value?.lastWeek) && value.lastWeek >= 0 ? value.lastWeek : -1,
    coveredWeeks: count(value?.coveredWeeks) };
}
export function validInsurance(value) {
  return Boolean(value && value.version === 1 && Number.isSafeInteger(value.coveredWeeks) && value.coveredWeeks >= 0 &&
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
  return `<section class="detail-summary panel" data-social-insurance><div><span>${t[0]}</span><strong>${s.insurance.coveredWeeks ?? 0} ${t[1]}</strong><small>${t[2]}</small></div><div><span>${t[3]}</span><strong>${money(s.pension)}</strong></div><div><span>${t[4]}</span><strong>${s.hasTaxReport ? money(s.businessTax) : t[5]}</strong></div></section>`;
}
