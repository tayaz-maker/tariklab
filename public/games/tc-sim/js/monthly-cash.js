import { debtBalance } from "./mortgage.js?v=10";
// Actual cash postings, independent of the capped display ledger and forecasts.
const sums = ["inflow", "outflow", "debtPayments", "adjustments", "count"];
const integer = n => Number.isSafeInteger(n);
const detailKeys = ["housing", "interestAccrued", "interestPaid", "taxIncluded", "internalTransfers", "bankInflow", "bankOutflow", "bankTransfers", "businessInterest", "businessPrincipal"];
function optionalFields(raw) {
  const result = {};
  if (raw.breakdown && typeof raw.breakdown === "object") {
    const entries = detailKeys.filter(k => integer(raw.breakdown[k]) && (["internalTransfers", "bankTransfers"].includes(k) || raw.breakdown[k] >= 0)).map(k => [k, raw.breakdown[k]]);
    if (entries.length) result.breakdown = Object.fromEntries(entries);
  }
  for (const key of ["openingBank", "closingBank", "openingWorth", "closingWorth"]) if (integer(raw[key])) result[key] = raw[key];
  if (raw.wealthPartial === true) result.wealthPartial = true;
  return result;
}
export function captureMonthlyWealth(state, worth) {
  const book = beginMonthlyCash(state);
  if (!integer(book.openingWorth) && integer(worth?.total)) {
    book.openingWorth = worth.total; book.openingBank = worth.bank || 0;
    book.wealthPartial = book.count > 0 || book.partial;
  }
  return book;
}
export function recordMonthlyDetail(state, key, amount) {
  if (!detailKeys.includes(key) || !integer(amount) || !amount) return;
  const book = beginMonthlyCash(state); book.breakdown ||= {};
  book.breakdown[key] = (book.breakdown[key] || 0) + amount;
}
export function recordMonthlyBank(state, amount, _reason, category) {
  if (!integer(amount) || !amount) return;
  recordMonthlyDetail(state, category === "bank-transfer" ? "bankTransfers" : amount > 0 ? "bankInflow" : "bankOutflow", category === "bank-transfer" ? amount : Math.abs(amount));
}
function validBook(raw) {
  return raw && raw.version === 1 && integer(raw.year) && raw.year > 0 && raw.year < 10000 &&
    integer(raw.month) && raw.month >= 1 && raw.month <= 12 && integer(raw.openingBalance) &&
    sums.every(k => integer(raw[k]) && (k === "adjustments" || raw[k] >= 0)) && raw.debtPayments <= raw.outflow;
}
function copyBook(raw) {
  return { version: 1, year: raw.year, month: raw.month, openingBalance: raw.openingBalance,
    ...Object.fromEntries(sums.map(k => [k, raw[k]])), partial: raw.partial === true, ...optionalFields(raw) };
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
export function beginMonthlyCash(state, partial = true, worth = null) {
  if (!state.finances.monthCash) state.finances.monthCash = {
    version: 1, year: state.time.year, month: state.time.month,
    openingBalance: state.finances.balance, inflow: 0, outflow: 0,
    debtPayments: 0, adjustments: 0, count: 0, partial,
  };
  const book = state.finances.monthCash;
  if (worth && integer(worth.total) && !integer(book.openingWorth)) {
    book.openingWorth = worth.total; book.openingBank = worth.bank || 0;
    if (book.count || book.partial) book.wealthPartial = true;
  }
  return book;
}
export function recordMonthlyCash(state, amount, reason, category) {
  if (!amount) return;
  const book = beginMonthlyCash(state);
  // A freshly created life can receive its initial balance before its first posting.
  if (!book.count) book.openingBalance = state.finances.balance;
  const adjustment = reason === "Nakit açığı temerrüt borcuna aktarıldı" || reason === "İcra kalan borç tavan aşımı";
  if (category === "bank-transfer") {
    book.adjustments += amount;
    recordMonthlyDetail(state, "internalTransfers", amount);
  } else if (adjustment) book.adjustments += amount;
  else if (amount > 0) book.inflow += amount;
  else {
    book.outflow -= amount;
    if (category === "debt" || /^İcra /u.test(reason) || reason === "Aile borcu kapanışı") book.debtPayments -= amount;
  }
  if (category === "housing" && amount < 0) recordMonthlyDetail(state, "housing", -amount);
  book.count += 1;
}
export function closeMonthlyCash(state, worth = null) {
  const book = beginMonthlyCash(state);
  // Close only across the existing calendar boundary, never on reload/render.
  if (book.year === state.time.year && book.month === state.time.month) return null;
  if (!book.count) book.openingBalance = state.finances.balance;
  const closingBalance = state.finances.balance;
  const otherChange = closingBalance - book.openingBalance - book.inflow + book.outflow - book.adjustments;
  const creditArrears = integer(worth?.debt) ? worth.debt : (state.wealth?.debts || []).reduce((n, d) => n + debtBalance(d), 0)
    + Math.max(0, state.finances.arrears || 0) + (state.finances.banking?.cards || []).reduce((n, c) => n + c.balance, 0);
  state.finances.lastMonthClose = { ...copyBook(book), closingBalance, otherChange, creditArrears,
    ...(integer(worth?.total) ? { closingWorth: worth.total, closingBank: worth.bank || 0 } : {}) };
  state.finances.monthCash = null;
  beginMonthlyCash(state, false, worth);
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
  const extra = {
    tr: ["Dönem başı nakit", "Dönem sonu nakit", "Konut / kira ödemesi (çıkışa dahil)", "Tahakkuk eden finansman gideri", "Ödenen konut kredisi faizi (ödemeye dahil)", "İşletme vergisi (net işletme sonucuna dahil)", "Nakit ↔ banka aktarımı", "Dönem başı banka", "Dönem sonu banka", "Net servet değişimi", "Banka girişleri", "Banka çıkışları", "Banka iç transferleri", "Servet başlangıcı izlemeye başlandığı andır; tam ay karşılaştırması değildir.", "İşletme faizi (net sonuca dahil)", "İşletme anapara taksiti (net sonuca dahil)"],
    en: ["Opening cash", "Closing cash", "Housing / rent paid (included in outflows)", "Financing cost accrued", "Mortgage interest paid (included in payments)", "Business tax (included in net business result)", "Cash ↔ bank transfers", "Opening bank balance", "Closing bank balance", "Net worth change", "Bank inflows", "Bank outflows", "Internal bank transfers", "Opening wealth is measured when tracking began; this is not a full-month comparison.", "Business interest (included in net result)", "Business principal payment (included in net result)"],
    pl: ["Gotówka na początek", "Gotówka na koniec", "Mieszkanie / czynsz (w odpływach)", "Naliczony koszt finansowania", "Zapłacone odsetki hipoteczne (w płatnościach)", "Podatek firmy (w wyniku netto firmy)", "Przelewy gotówka ↔ bank", "Saldo banku na początek", "Saldo banku na koniec", "Zmiana majątku netto", "Wpływy bankowe", "Odpływy bankowe", "Przelewy wewnętrzne banku", "Majątek początkowy zmierzono od rozpoczęcia ewidencji; to nie jest porównanie pełnego miesiąca.", "Odsetki firmy (w wyniku netto)", "Spłata kapitału firmy (w wyniku netto)"],
  }[language] || ["Dönem başı nakit", "Dönem sonu nakit"];
  const rows = [[extra[0], receipt.openingBalance], [extra[1], receipt.closingBalance], [l[1], receipt.inflow], [l[2], receipt.outflow], [l[3], receipt.debtPayments],
    [l[4], receipt.closingBalance - receipt.openingBalance], [l[5], receipt.creditArrears]];
  const b = receipt.breakdown || {};
  if (receipt.adjustments - (b.internalTransfers || 0)) rows.push([l[7], receipt.adjustments - (b.internalTransfers || 0)]);
  for (const [key, index] of [["housing", 2], ["interestAccrued", 3], ["interestPaid", 4], ["taxIncluded", 5], ["internalTransfers", 6], ["bankInflow", 10], ["bankOutflow", 11], ["bankTransfers", 12], ["businessInterest", 14], ["businessPrincipal", 15]]) if (b[key]) rows.push([extra[index], b[key]]);
  if (integer(receipt.openingBank)) rows.push([extra[7], receipt.openingBank]);
  if (integer(receipt.closingBank)) rows.push([extra[8], receipt.closingBank]);
  if (integer(receipt.openingWorth) && integer(receipt.closingWorth)) rows.push([extra[9], receipt.closingWorth - receipt.openingWorth]);
  if (receipt.otherChange) rows.push([l[8], receipt.otherChange]);
  return `<section class="panel monthly-cash-card" data-monthly-cash="${period}"><div class="panel-head"><h2>${l[0]} · ${period}</h2></div>${receipt.partial ? `<p class="context-note">${l[9]}</p>` : ""}${receipt.wealthPartial ? `<p class="context-note">${extra[13]}</p>` : ""}<div class="detail-summary">${rows.map(([label, value]) => `<div><span>${label}</span><strong>${money(value, receipt)}</strong></div>`).join("")}<div><span>${l[6]}</span><strong>${Math.max(0, Math.floor(remaining))}</strong></div></div><p class="context-note">${l[10]}</p></section>`;
}
