import { bankAccount, bankCard, bankPost, bankTotals, businessOwnerKey, fundWalletFromAccount, normalizeBanking } from "./bank-accounts.js?v=10";
import { CARD_ADVANCE_FEE_BPS, payCardBalance } from "./bank-cards.js?v=10";
import { banksForDate } from "./banks-presentation.js?v=10";
import { bankCreditPolicy, bankRecord, recordBankLoan } from "./bank-record.js?v=10";
import { creditOffer, manageBusiness, takeCredit } from "./bank-business.js?v=10";
import { applyWealthAction, normalizeWealth, netWorth, VEHICLES } from "./wealth.js?v=10";
import { captureMonthlyWealth, recordMonthlyDetail } from "./monthly-cash.js?v=10";
import { debtBalance, isAmortizingMortgage, reconcileMortgageClaims, settleMortgagePayment } from "./mortgage.js?v=10";
import { getMonthlySummary } from "./life.js?v=10";
import { getWeeklyActivityLimit, transact, validateState } from "./state.js?v=10";

const fail = reason => ({ ok: false, reason });
const ok = message => ({ ok: true, message });
const amountValid = value => Number.isSafeInteger(value) && value > 0;
function decision(state, key) {
  if (state.weekly.selectedIds.includes(key) || state.weekly.used >= getWeeklyActivityLimit(state)) return false;
  state.weekly.selectedIds.push(key); state.weekly.used += 1; return true;
}
export function cardLimitAvailable(state) {
  const income = getMonthlySummary(state).income;
  const cap = Math.floor(income * (bankRecord(state).score !== null && bankRecord(state).score < 40 ? .5 : 1.5));
  const used = (state.finances?.banking?.cards || []).reduce((n, c) => n + c.limit, 0);
  return Math.max(0, Math.min(10000, cap - used));
}
function walletToBank(state, a, amount, reason) {
  if (state.finances.balance < amount) return false;
  transact(state, -amount, reason, "bank-transfer"); bankPost(state, a.id, amount, reason); return true;
}
function execute(state, request) {
  const b = normalizeBanking(state), { action, accountId, amount } = request;
  const a = bankAccount(state, accountId);
  if (state.lifetime?.death || state.events?.active) return fail("Önce açık kararı tamamla; yaşam sona erdiyse hesaplar salt okunurdur.");
  if (action === "open") {
    if (!banksForDate(state.time.date).some(x => x.id === request.bankId)) return fail("Bu banka dönemde kullanılamıyor.");
    if (!["personal", "commercial"].includes(request.kind)) return fail("Hesap türü geçersiz.");
    const businessKey = request.kind === "commercial" ? businessOwnerKey(state) : null;
    if (request.kind === "commercial" && !businessKey) return fail("Ticari hesap için açık işletmen olmalı.");
    const id = `bank-${request.bankId}-${request.kind}`, old = b.accounts.find(x => x.id === id);
    if (old && !old.closed) return fail("Bu bankada aynı türde hesabın zaten var.");
    if (old) { old.closed = false; old.businessKey = businessKey; }
    else b.accounts.push({ id, bankId: request.bankId, kind: request.kind, balance: 0,
      openedWeek: state.time.absoluteWeek, closed: false, businessKey, history: [] });
    if (request.kind === "commercial" && !state.flags.business.bankAccountId) state.flags.business.bankAccountId = id;
    return ok("Hesap açıldı. Açılış ücretsiz; hesaba para yatırabilirsin.");
  }
  if (!a) return fail("Hesap bulunamadı veya kapalı.");
  // Winding down an old sole-proprietor account must always allow recovery;
  // only the currently owned business may receive new commercial financing.
  const currentBusiness = a.kind === "commercial" && a.businessKey === businessOwnerKey(state);
  if (action === "close") {
    if (a.balance || bankCard(state, a.id)?.balance || state.wealth.debts.some(d => d.accountId === a.id)
      || state.flags.business?.bankAccountId === a.id && state.flags.business.debt > 0)
      return fail("Kapatmadan önce bakiyeyi çek, kartı ve bağlı kredileri öde.");
    b.cards = b.cards.filter(c => c.accountId !== a.id); a.closed = true;
    if (state.flags.business?.bankAccountId === a.id) delete state.flags.business.bankAccountId;
    return ok("Boş hesap kapatıldı; işlem geçmişi korundu.");
  }
  if (["deposit", "withdraw", "transfer", "card-advance", "card-pay", "repay", "commercial-repay"].includes(action) && !amountValid(amount))
    return fail("Tutar pozitif, tam oyun TL'si olmalı.");
  if (action === "deposit") {
    if (a.kind === "commercial" && !currentBusiness) return fail("Bu ticari hesap artık mevcut işletmeye ait değil; bakiyeyi çekip kapatabilirsin.");
    return walletToBank(state, a, amount, a.kind === "commercial" ? "Nakit → ticari hesap: işletme sermayesi" : "Nakit → bireysel hesap")
      ? ok("Para nakitten seçili hesaba yatırıldı; toplam varlık değişmedi.") : fail("Nakit bakiyen yetersiz.");
  }
  if (action === "withdraw") {
    if (a.balance < amount) return fail("Hesap bakiyesi yetersiz.");
    fundWalletFromAccount(state, a.id, amount, transact, a.kind === "commercial" ? "Ticari hesap → nakit: sahibine çekim" : "Bireysel hesap → nakit");
    return ok("Para seçili hesaptan nakde geçti; toplam varlık değişmedi.");
  }
  if (action === "transfer") {
    const target = bankAccount(state, request.targetId);
    if (!target || target.id === a.id) return fail("Farklı bir açık hedef hesap seç.");
    if (a.kind !== target.kind || a.kind === "commercial" && a.businessKey !== target.businessKey)
      return fail("Bireysel ve ticari hesaplar ayrı tutulur. Sermaye yatırma/çekme işlemini nakit üzerinden yap.");
    if (a.balance < amount) return fail("Kaynak hesap bakiyesi yetersiz.");
    bankPost(state, a.id, -amount, `Kendi hesabına transfer → ${target.bankId}`);
    bankPost(state, target.id, amount, `Kendi hesabından transfer ← ${a.bankId}`);
    return ok("Kendi hesapların arası transfer tamamlandı; toplam varlık değişmedi.");
  }
  if (action === "commercial-primary") {
    if (!currentBusiness) return fail("Mevcut işletmenin ticari hesabı gerekiyor.");
    state.flags.business.bankAccountId = a.id;
    return ok("İşletmenin aylık gelir ve giderleri bu ticari hesaba bağlandı.");
  }
  if (action === "commercial-repay") {
    if (!currentBusiness || state.flags.business.bankAccountId !== a.id) return fail("İşletmenin bağlı ticari hesabını seç.");
    const paid = Math.min(amount, state.flags.business.debt);
    if (!paid || a.balance < paid) return fail("Ticari borç veya hesap bakiyesi yetersiz.");
    if (!decision(state, "bank:commercial-repay")) return fail("Bu hafta geri ödeme için karar hakkı kalmadı.");
    fundWalletFromAccount(state, a.id, paid, transact, "Ticari kredi ödemesi için hesaptan aktarım");
    transact(state, -paid, "Ticari kredi ek/erken ödeme", "debt"); state.flags.business.debt -= paid;
    return ok(`${paid} işletme hesabından ticari krediye ödendi.`);
  }
  if (action === "card-open") {
    const policy = bankCreditPolicy(state, "small"); if (!policy.ok) return policy;
    const limit = cardLimitAvailable(state);
    if (a.kind !== "personal" || bankCard(state, a.id) || limit < 100) return fail("Bireysel hesap, kullanılabilir gelir limiti ve kartsız hesap gerekiyor.");
    b.cards.push({ accountId: a.id, bankId: a.bankId, limit, balance: 0, statement: 0, minimumDue: 0,
      overdue: 0, missed: 0, interest: 0, paid: 0, lastMonth: Math.floor((state.time.absoluteWeek - 1) / 4), blocked: false });
    return ok(`Oyun kartı açıldı. Limit ${limit}; bankalar toplam limiti gelirle sınırlıdır.`);
  }
  if (action === "card-advance" || action === "card-pay") {
    const card = bankCard(state, a.id); if (!card) return fail("Bu hesapta kart yok.");
    if (action === "card-pay") {
      const paid = Math.min(amount, card.balance);
      if (!paid || a.balance < paid) return fail("Kart borcu veya seçili hesap bakiyesi yetersiz.");
      fundWalletFromAccount(state, a.id, paid, transact, "Kart ödemesi için hesaptan aktarım");
      transact(state, -paid, "Kart borcu ödemesi", "debt"); payCardBalance(card, paid);
      return ok(`${paid} seçili hesaptan kart borcuna ödendi; aynı tutar borçtan düştü.`);
    }
    const policy = bankCreditPolicy(state, "small"); if (!policy.ok) return policy;
    const fee = Math.ceil(amount * CARD_ADVANCE_FEE_BPS / 10000);
    if (card.blocked || card.overdue || card.balance + amount + fee > card.limit) return fail("Kart limiti yetersiz veya gecikme nedeniyle kullanım kapalı.");
    if (!decision(state, `bank:card-advance:${a.bankId}`)) return fail("Bu kart için haftalık karar hakkı kalmadı.");
    card.balance += amount + fee;
    recordMonthlyDetail(state, "interestAccrued", fee);
    bankPost(state, a.id, amount, "Kart nakit avansı", "debt");
    return ok(`${amount} seçili hesaba geçti. ${fee} oyun işlem bedeli dahil ${amount + fee} kart borcu oluştu.`);
  }
  if (action === "loan") {
    const policy = bankCreditPolicy(state, request.product === "personal" ? request.offer || "small" : request.product);
    if (!policy.ok) return policy;
    if (request.product === "commercial") {
      if (!currentBusiness) return fail("Ticari kredi için mevcut işletmenin ticari hesabını seç.");
      const before = state.finances.balance, result = manageBusiness(state, "loan");
      if (!result.ok) return result;
      const granted = state.finances.balance - before;
      transact(state, -granted, "Ticari kredi → işletme hesabı", "bank-transfer");
      bankPost(state, a.id, granted, "Ticari kredi → işletme hesabı");
      state.flags.business.bankAccountId = a.id; state.flags.business.bankId = a.bankId;
      return ok(`Ticari kredi ${granted} işletme hesabına geçti; mevcut iş motorunun geri ödeme planı uygulanır.`);
    }
    if (a.kind !== "personal") return fail("Kişisel kredi, araç ve konut için bireysel hesap seç.");
    const previous = new Set(state.wealth.debts.map(d => d.id));
    let result;
    if (request.product === "personal") {
      const offer = creditOffer(state, request.offer || "small"); if (!offer) return fail("Kredi seçeneği bulunamadı.");
      result = takeCredit(state, request.offer || "small");
      if (result.ok) {
        transact(state, -offer.cash, "İhtiyaç kredisi → bireysel hesap", "bank-transfer");
        bankPost(state, a.id, offer.cash, "İhtiyaç kredisi → bireysel hesap");
      }
    } else if (request.product === "vehicle" || request.product === "mortgage") {
      const tier = request.vehicle || "used", down = request.product === "vehicle" ? Math.ceil((VEHICLES[tier]?.price || 0) * .35) : 144000;
      if (!down || a.balance < down) return fail("Seçili hesapta peşinat yetersiz.");
      fundWalletFromAccount(state, a.id, down, transact, "Finansman peşinatı için hesaptan aktarım");
      result = applyWealthAction(state, request.product === "vehicle" ? "vehicle-finance" : "property-owner", request.product === "vehicle" ? tier : "mortgage");
    } else return fail("Kredi ürünü tanınmadı.");
    if (!result.ok) return result;
    const debt = state.wealth.debts.find(d => !previous.has(d.id));
    if (!debt) throw new Error("Kredi kaydı oluşmadı.");
    debt.bankId = a.bankId; debt.accountId = a.id;
    return result;
  }
  if (action === "repay") {
    const debt = state.wealth.debts.find(d => d.id === request.debtId && d.accountId === a.id);
    if (!debt) return fail("Bu hesaba bağlı kredi bulunamadı.");
    const paid = Math.min(amount, debtBalance(debt));
    if (a.balance < paid) return fail("Seçili hesap bakiyesi geri ödemeye yetmiyor.");
    if (!decision(state, `bank:repay:${debt.id}`)) return fail("Bu kredi için haftalık karar hakkı kalmadı.");
    fundWalletFromAccount(state, a.id, paid, transact, "Kredi ödemesi için hesaptan aktarım");
    transact(state, -paid, "Banka kredisi ek/erken ödeme", "debt");
    if (isAmortizingMortgage(debt)) {
      const prior = debt.mortgage.interestPaid;
      settleMortgagePayment(debt, paid);
      recordMonthlyDetail(state, "interestPaid", debt.mortgage.interestPaid - prior);
    } else debt.principal -= paid;
    if (!debtBalance(debt)) { state.wealth.debts = state.wealth.debts.filter(d => d !== debt); recordBankLoan(state, "closed"); }
    reconcileMortgageClaims(state);
    return ok(`${paid} seçili hesaptan kredi borcuna ödendi.`);
  }
  return fail("Banka işlemi tanınmadı.");
}
// Rendered revision is the command nonce. Retried clicks/refreshes with the old
// revision cannot post twice; failed validation or a partial engine mutation
// never commits any part of the isolated draft to the live save.
export function applyBankAction(state, request) {
  try {
    const draft = structuredClone(state); normalizeBanking(draft); normalizeWealth(draft);
    if (!request || request.revision !== draft.finances.banking.revision) return fail("Hesaplar değişti. Güncel ekranı kullan; işlem tekrarlanmadı.");
    captureMonthlyWealth(draft, netWorth(draft));
    const result = execute(draft, request);
    if (!result.ok) return result;
    draft.finances.banking.revision += 1;
    if (!Number.isSafeInteger(draft.finances.balance) || !validateState(draft).ok) return fail("İşlem doğrulanamadı. Para ve kayıt değiştirilmedi.");
    Object.assign(state, draft);
    return { ...result, totals: bankTotals(state) };
  } catch { return fail("İşlem tamamlanamadı. Para ve kayıt değiştirilmedi."); }
}
