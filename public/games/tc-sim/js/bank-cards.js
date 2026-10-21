import { bankAccount, bankPost, normalizeBanking } from "./bank-accounts.js?v=10";
import { recordBankMonth } from "./bank-record.js?v=10";
import { periodContext } from "./period-economy.js?v=10";
import { recordMonthlyDetail } from "./monthly-cash.js?v=10";

// Shared fictional terms for every institution; names never imply real offers.
export const CARD_ADVANCE_FEE_BPS = 200;
export const cardRateBps = state => periodContext(state).inflation > .3 ? 300 : 200;
export const cardMinimum = balance => Math.min(balance, Math.max(100, Math.ceil(balance * .2)));
export function payCardBalance(card, amount) {
  const paid = Math.min(card.balance, Math.max(0, Math.floor(amount)));
  card.balance -= paid;
  card.statement = Math.max(0, card.statement - paid);
  card.minimumDue = Math.max(0, card.minimumDue - paid);
  card.overdue = Math.max(0, card.overdue - paid);
  card.paid += paid;
  if (!card.overdue) card.missed = 0;
  return paid;
}
export function processBankCardsMonth(state, month, postWallet, arrearsCap) {
  const b = normalizeBanking(state);
  for (const card of b.cards) {
    if (card.lastMonth >= month) continue;
    // The statement generated last month is due now. Only the linked account
    // is authorized for automatic card repayment; no silent wallet overdraft.
    const due = card.minimumDue, previousMissed = card.missed, available = bankAccount(state, card.accountId)?.balance || 0;
    const paid = Math.min(due, available);
    if (paid) {
      bankPost(state, card.accountId, -paid, "Kart asgari ödemesi için aktarım", "bank-transfer");
      postWallet(state, paid, "Kart ödemesi için hesaptan aktarım", "bank-transfer");
      postWallet(state, -paid, "Kart asgari ödemesi", "debt");
      payCardBalance(card, paid);
    }
    if (due) {
      card.overdue = Math.max(0, due - paid);
      card.missed = card.overdue ? previousMissed + 1 : 0;
      recordBankMonth(state, card.missed >= 3 ? "default" : card.overdue ? "missed" : "paid");
    }
    const interest = card.balance ? Math.ceil(card.balance * cardRateBps(state) / 10000) : 0;
    card.balance += interest; card.interest += interest;
    recordMonthlyDetail(state, "interestAccrued", interest);
    if (card.missed >= 3) {
      // Transfer, never copy, the exact liability into the existing icra path.
      const total = (state.finances.arrears || 0) + card.balance;
      state.finances.arrears = Math.min(arrearsCap, total);
      if (total > arrearsCap) postWallet(state, -(total - arrearsCap), "İcra kalan borç tavan aşımı", "debt");
      bankPost(state, card.accountId, 0, `Kart temerrüt aktarımı: ${card.balance}`, "default");
      card.balance = 0; card.statement = 0; card.minimumDue = 0; card.overdue = 0; card.blocked = true;
    } else {
      card.statement = card.balance;
      card.minimumDue = Math.min(card.balance, Math.max(card.overdue, cardMinimum(card.balance)));
    }
    card.lastMonth = month; b.revision += 1;
  }
}
