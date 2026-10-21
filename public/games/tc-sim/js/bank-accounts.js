// Optional V6 extension. Wallet cash remains finances.balance; deposits are
// independent assets. No network, credentials, real accounts or real bank rates.
import { recordMonthlyBank } from "./monthly-cash.js?v=10";
export const BANK_IDS = Object.freeze(["ziraat", "isbank", "garanti"]);
export const BANK_HISTORY_LIMIT = 40;
const whole = n => Number.isSafeInteger(n) && n >= 0;
const list = state => state.finances?.banking?.accounts || [];
export const bankAccount = (state, id) => list(state).find(a => a.id === id && !a.closed);
export const bankCard = (state, id) => state.finances?.banking?.cards?.find(c => c.accountId === id);
export const businessOwnerKey = state => state.flags?.business ? `${state.flags.business.id}:${state.flags.business.startedWeek}` : null;
export function bankTotals(state) {
  const accounts = list(state), cards = state.finances?.banking?.cards || [];
  const sum = kind => accounts.filter(a => !a.closed && (!kind || a.kind === kind)).reduce((n, a) => n + a.balance, 0);
  return { personal: sum("personal"), commercial: sum("commercial"), total: sum(),
    cardDebt: cards.reduce((n, c) => n + c.balance, 0),
    minimumDue: cards.reduce((n, c) => n + c.minimumDue, 0),
    overdue: cards.reduce((n, c) => n + c.overdue, 0) };
}
export function validBanking(state) {
  const b = state.finances?.banking;
  if (b === undefined) return true;
  if (!b || b.version !== 1 || !whole(b.revision) || !Array.isArray(b.accounts) || b.accounts.length > 6
    || !Array.isArray(b.cards) || b.cards.length > 3) return false;
  if (new Set(b.accounts.map(a => a?.id)).size !== b.accounts.length || new Set(b.cards.map(c => c?.accountId)).size !== b.cards.length) return false;
  for (const a of b.accounts) {
    if (!a || !BANK_IDS.includes(a.bankId) || !["personal", "commercial"].includes(a.kind)
      || a.id !== `bank-${a.bankId}-${a.kind}` || !whole(a.balance) || !whole(a.openedWeek)
      || typeof a.closed !== "boolean" || (a.closed && a.balance !== 0)
      || !(a.businessKey === null || typeof a.businessKey === "string")
      || !Array.isArray(a.history) || a.history.length > BANK_HISTORY_LIMIT
      || a.history.some(h => !h || !whole(h.week) || !Number.isSafeInteger(h.amount) || !whole(h.balance)
        || typeof h.reason !== "string" || h.reason.length > 180 || typeof h.category !== "string")) return false;
    if (!Number.isSafeInteger(bankTotals(state).total)) return false;
  }
  for (const c of b.cards) {
    const a = bankAccount(state, c?.accountId);
    if (!a || a.kind !== "personal" || c.bankId !== a.bankId || !whole(c.limit) || !c.limit
      || !["balance", "statement", "minimumDue", "overdue", "missed", "interest", "paid"].every(k => whole(c[k]))
      || !Number.isSafeInteger(c.lastMonth) || c.lastMonth < -1 || c.minimumDue > c.balance
      || c.overdue > c.minimumDue || c.statement > c.balance || typeof c.blocked !== "boolean") return false;
  }
  return Number.isSafeInteger(bankTotals(state).cardDebt);
}
export function normalizeBanking(state) {
  const f = state.finances;
  if (!f) return null;
  if (f.banking === undefined) {
    // Old production V5/V6 uses balance for wallet cash and wealth.investments
    // for invested deposits. Only an explicit legacy bankBalance is migrated;
    // never infer a second asset from cash or from an investment position.
    const legacy = f.bankBalance ?? 0;
    if (!whole(legacy)) throw new Error("Eski banka bakiyesi geçersiz; kayıt korunuyor.");
    f.banking = { version: 1, revision: 0, accounts: [], cards: [] };
    if (legacy) f.banking.accounts.push({ id: "bank-ziraat-personal", bankId: "ziraat", kind: "personal",
      balance: legacy, openedWeek: state.time?.absoluteWeek || 1, closed: false, businessKey: null,
      history: [{ week: state.time?.absoluteWeek || 1, amount: legacy, balance: legacy, reason: "Eski banka bakiyesi", category: "migration" }] });
    if (Object.hasOwn(f, "bankBalance")) delete f.bankBalance;
  }
  if (!validBanking(state)) throw new Error("Banka kaydı geçersiz; bakiye değiştirilmedi.");
  return f.banking;
}
export function bankPost(state, id, amount, reason, category = "bank-transfer") {
  const b = normalizeBanking(state), a = bankAccount(state, id);
  if (!a || !Number.isSafeInteger(amount) || !whole(a.balance + amount)) throw new Error("Hesap veya bakiye yetersiz.");
  recordMonthlyBank(state, amount, reason, category);
  a.balance += amount;
  a.history.push({ week: state.time.absoluteWeek, amount, balance: a.balance,
    reason: String(reason).slice(0, 180), category });
  a.history = a.history.slice(-BANK_HISTORY_LIMIT);
  b.revision += 1;
  if (!validBanking(state)) throw new Error("Banka toplamı geçersiz.");
  return amount;
}
// Bridge through the existing cash ledger: the internal transfer is separate
// from the original loan/business/legal posting, preserving cash reconciliation.
export function fundWalletFromAccount(state, id, requested, postWallet, reason = "Hesaptan ödeme için aktarım") {
  const a = bankAccount(state, id), paid = Math.min(a?.balance || 0, Math.max(0, Math.round(requested)));
  if (paid) { bankPost(state, id, -paid, reason); postWallet(state, paid, reason, "bank-transfer"); }
  return paid;
}
export function settleCommercialAccounts(state, postWallet) {
  for (const a of list(state).filter(a => a.kind === "commercial" && !a.closed)) {
    fundWalletFromAccount(state, a.id, a.balance, postWallet, "İşletme kapanışı: sahibine sermaye iadesi");
    a.closed = true;
    state.finances.banking.revision += 1;
  }
}
export function linkedAccountBalance(state, debt) { return bankAccount(state, debt?.accountId)?.balance || 0; }
