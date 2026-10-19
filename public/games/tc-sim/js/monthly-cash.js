import { debtBalance } from "./mortgage.js?v=10";
// Actual cash postings, independent of the capped display ledger and forecasts.
const sums = ["inflow", "outflow", "debtPayments", "adjustments", "count"];
const integer = n => Number.isSafeInteger(n);
function validBook(raw) {
  return raw && raw.version === 1 && integer(raw.year) && raw.year > 0 && raw.year < 10000 &&
    integer(raw.month) && raw.month >= 1 && raw.month <= 12 && integer(raw.openingBalance) &&
    sums.every(k => integer(raw[k]) && (k === "adjustments" || raw[k] >= 0)) && raw.debtPayments <= raw.outflow;
}
function copyBook(raw) {
  return { version: 1, year: raw.year, month: raw.month, openingBalance: raw.openingBalance,
    ...Object.fromEntries(sums.map(k => [k, raw[k]])), partial: raw.partial === true };
}
export function normalizeMonthlyCash(state) {
  const f = state.finances;
  f.monthCash = validBook(f.monthCash) ? copyBook(f.monthCash) : null;
  const r = f.lastMonthClose;
  f.lastMonthClose = validBook(r) && integer(r.closingBalance) && integer(r.otherChange) &&
    integer(r.creditArrears) && r.creditArrears >= 0 &&
    r.closingBalance - r.openingBalance === r.inflow - r.outflow + r.adjustments + r.otherChange
    ? { ...copyBook(r), closingBalance: r.closingBalance, otherChange: r.otherChange, creditArrears: r.creditArrears } : null;
}
export function beginMonthlyCash(state, partial = true) {
  if (!state.finances.monthCash) state.finances.monthCash = {
    version: 1, year: state.time.year, month: state.time.month,
    openingBalance: state.finances.balance, inflow: 0, outflow: 0,
    debtPayments: 0, adjustments: 0, count: 0, partial,
  };
  return state.finances.monthCash;
}
export function recordMonthlyCash(state, amount, reason, category) {
  if (!amount) return;
  const book = beginMonthlyCash(state);
  // A freshly created life can receive its initial balance before its first posting.
  if (!book.count) book.openingBalance = state.finances.balance;
  const adjustment = reason === "Nakit açığı temerrüt borcuna aktarıldı" || reason === "İcra kalan borç tavan aşımı";
  if (adjustment) book.adjustments += amount;
  else if (amount > 0) book.inflow += amount;
  else {
    book.outflow -= amount;
    if (category === "debt" || /^İcra /u.test(reason) || reason === "Aile borcu kapanışı") book.debtPayments -= amount;
  }
  book.count += 1;
}
export function closeMonthlyCash(state) {
  const book = beginMonthlyCash(state);
  // Close only across the existing calendar boundary, never on reload/render.
  if (book.year === state.time.year && book.month === state.time.month) return null;
  if (!book.count) book.openingBalance = state.finances.balance;
  const closingBalance = state.finances.balance;
  const otherChange = closingBalance - book.openingBalance - book.inflow + book.outflow - book.adjustments;
  const creditArrears = (state.wealth?.debts || []).reduce((n, d) => n + debtBalance(d), 0) + Math.max(0, state.finances.arrears || 0);
  state.finances.lastMonthClose = { ...copyBook(book), closingBalance, otherChange, creditArrears };
  state.finances.monthCash = null;
  beginMonthlyCash(state, false);
  return state.finances.lastMonthClose;
}
const labels = {
  tr: ["Son kapanan ay", "Gelir ve diğer nakit girişleri", "Gider ve diğer nakit çıkışları", "Borç/taksit için nakit çıkışı", "Net bakiye değişimi", "Kredi + temerrüt bakiyesi", "Bu hafta kalan hak", "Borç aktarımı / muhasebe düzeltmesi", "Diğer bakiye farkı", "Kısmi ay: yalnız izlemeye başlandıktan sonraki işlemler.", "Nakit esaslıdır; kredi ve varlık işlemleri giriş/çıkışlara dahildir, kâr değildir. Borç ödemesi çıkışların içindedir; tekrar eklenmez. Netleştirilen işlemler mevcut kayıttaki net tutarla gösterilir."],
  en: ["Last closed month", "Income and other cash inflows", "Expenses and other cash outflows", "Cash paid toward debt/installments", "Net balance change", "Loan + arrears balance", "Actions left this week", "Debt transfer / accounting adjustment", "Other balance difference", "Partial month: only postings since tracking began.", "Cash basis: loans and asset transactions are included in flows, not profit. Debt payments are already part of outflows. Netted transactions use the net cash amount recorded by the game."],
  pl: ["Ostatni zamknięty miesiąc", "Dochody i pozostałe wpływy gotówki", "Wydatki i pozostałe odpływy gotówki", "Gotówka na spłatę długu/rat", "Zmiana salda netto", "Saldo kredytów i zaległości", "Pozostałe działania w tym tygodniu", "Przeniesienie długu / korekta księgowa", "Inna różnica salda", "Niepełny miesiąc: tylko operacje od rozpoczęcia ewidencji.", "Ujęcie kasowe: kredyty i transakcje majątkowe są częścią przepływów, a nie zyskiem. Spłaty długu są już w odpływach. Operacje kompensowane pokazują kwotę netto zapisaną przez grę."],
};
export function renderMonthlyCashCard(receipt, money, remaining, language = "tr") {
  if (!receipt) return "";
  const l = labels[language] || labels.tr;
  const period = `${receipt.year}-${String(receipt.month).padStart(2, "0")}`;
  const rows = [[l[1], receipt.inflow], [l[2], receipt.outflow], [l[3], receipt.debtPayments],
    [l[4], receipt.closingBalance - receipt.openingBalance], [l[5], receipt.creditArrears]];
  if (receipt.adjustments) rows.push([l[7], receipt.adjustments]);
  if (receipt.otherChange) rows.push([l[8], receipt.otherChange]);
  return `<section class="panel monthly-cash-card" data-monthly-cash="${period}"><div class="panel-head"><h2>${l[0]} · ${period}</h2></div>${receipt.partial ? `<p class="context-note">${l[9]}</p>` : ""}<div class="detail-summary">${rows.map(([label, value]) => `<div><span>${label}</span><strong>${money(value, receipt)}</strong></div>`).join("")}<div><span>${l[6]}</span><strong>${Math.max(0, Math.floor(remaining))}</strong></div></div><p class="context-note">${l[10]}</p></section>`;
}
