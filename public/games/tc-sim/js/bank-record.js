// Fictional 0–100 game indicator, not a real-world credit rating or bank rule.
// Observe new transactions only. Legacy debt never implies a payment history.
const CHANGE = Object.freeze({ paid: 2, missed: -8, default: -12 });
const PRIORITY = { paid: 1, missed: 2, default: 3 };
const count = n => Number.isSafeInteger(n) && n >= 0 ? Math.min(n, 1000000) : 0;
const score = n => Math.max(0, Math.min(100, n));
const monthOf = state => Math.max(0, Math.floor(((state.time?.absoluteWeek || 1) - 1) / 4));
const neutral = () => ({ version: 1, score: null, originated: 0, closed: 0,
  paid: 0, missed: 0, default: 0, lastMonth: -1, outcome: null, monthBase: 50, history: [] });

export function bankRecord(state) {
  const raw = state.flags?.bankRecord;
  if (!raw || raw.version !== 1 || !Number.isInteger(raw.score) || raw.score < 0 || raw.score > 100)
    return neutral();
  const validMonth = Number.isSafeInteger(raw.lastMonth) && raw.lastMonth >= 0
    && raw.lastMonth <= monthOf(state) && Object.hasOwn(CHANGE, raw.outcome)
    && Number.isInteger(raw.monthBase) && raw.monthBase >= 0 && raw.monthBase <= 100;
  return { version: 1, score: raw.score, originated: count(raw.originated), closed: count(raw.closed),
    paid: count(raw.paid), missed: count(raw.missed), default: count(raw.default),
    lastMonth: validMonth ? raw.lastMonth : -1, outcome: validMonth ? raw.outcome : null,
    monthBase: validMonth ? raw.monthBase : raw.score,
    history: Array.isArray(raw.history) ? raw.history.filter(e => e &&
      ["opened", "closed", "paid", "missed", "default"].includes(e.kind)
      && Number.isSafeInteger(e.month) && e.month >= 0 && e.month <= monthOf(state))
      .slice(-24).map(e => ({ kind: e.kind, month: e.month })) : [] };
}

export function normalizeBankRecord(state) {
  if (state.flags && Object.hasOwn(state.flags, "bankRecord")) state.flags.bankRecord = bankRecord(state);
}
function persist(state, record) {
  state.flags ||= {};
  state.flags.bankRecord = record;
}
export function recordBankLoan(state, kind) {
  if (!["opened", "closed"].includes(kind)) return;
  const record = bankRecord(state);
  record.score ??= 50;
  const field = kind === "opened" ? "originated" : "closed";
  record[field] = count(record[field] + 1);
  // Opening/early closing a loan cannot farm a positive rating.
  record.history.push({ kind, month: monthOf(state) });
  record.history = record.history.slice(-24);
  persist(state, record);
}
export function recordBankMonth(state, outcome) {
  if (!Object.hasOwn(CHANGE, outcome)) return;
  const record = bankRecord(state), month = monthOf(state);
  if (month < record.lastMonth || (month === record.lastMonth
    && PRIORITY[outcome] <= PRIORITY[record.outcome])) return;
  record.score ??= 50;
  if (record.lastMonth === month) {
    // One aggregate observation per period. A later uncovered payment/default
    // replaces the reward, regardless of debt iteration order or repeated calls.
    record[record.outcome] = Math.max(0, record[record.outcome] - 1);
    record.history = record.history.filter(e => e.month !== month || !Object.hasOwn(CHANGE, e.kind));
  } else record.monthBase = record.score;
  record[outcome] = count(record[outcome] + 1);
  record.lastMonth = month;
  record.outcome = outcome;
  record.score = score(record.monthBase + CHANGE[outcome]);
  record.history.push({ kind: outcome, month });
  record.history = record.history.slice(-24);
  persist(state, record);
}

export function bankRecordText(state, language = "tr") {
  const r = bankRecord(state);
  const texts = {
    tr: ["Banka sicili", "Henüz gözlenen işlem yok; eski kayıtlardan geçmiş ödeme çıkarılmaz.",
      "Oyun kredi puanı", "zamanında ödeme dönemi", "nakitle karşılanamayan ödeme dönemi", "temerrüt dönemi",
      "0–100 oyun göstergesidir; gerçek bir kredi notu değildir. Şimdilik kredi koşullarını değiştirmez."],
    en: ["Bank history", "No observed transactions yet; past payments are not inferred from old saves.",
      "Game credit score", "funded payment periods", "unfunded payment periods", "default periods",
      "A 0–100 game indicator, not a real credit rating. It does not yet change loan terms."],
    pl: ["Historia bankowa", "Brak zaobserwowanych transakcji; stare zapisy nie służą do odtwarzania spłat.",
      "Punktacja kredytowa w grze", "okresy spłat z pokryciem", "okresy spłat bez pokrycia", "okresy niewypłacalności",
      "Wskaźnik gry 0–100, a nie rzeczywista ocena kredytowa. Na razie nie zmienia warunków kredytu."],
  };
  const t = texts[language] || texts.tr;
  return `${t[0]} · ${r.score === null ? t[1] : `${t[2]}: ${r.score}/100 · ${r.paid} ${t[3]} · ${r.missed} ${t[4]} · ${r.default} ${t[5]}`} ${t[6]}`;
}
