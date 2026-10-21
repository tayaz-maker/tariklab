import { bankAccount, bankCard, bankTotals, businessOwnerKey } from "./bank-accounts.js?v=10";
import { applyBankAction, cardLimitAvailable } from "./bank-actions.js?v=10";
import { cardRateBps } from "./bank-cards.js?v=10";
import { banksForDate, bankText } from "./banks-presentation.js?v=10";
import { creditOffer } from "./bank-business.js?v=10";
import { debtBalance, mortgageDue } from "./mortgage.js?v=10";

const escape = value => String(value).replace(/[&<>"']/g, x => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[x]));
export function renderBankAccounts(state, money, language = "tr") {
  const t = (tr, en, pl = en) => escape(bankText(language, tr, en, pl));
  const b = state.finances.banking || { revision: 0, accounts: [], cards: [] }, totals = bankTotals(state);
  const banks = banksForDate(state.time.date, language);
  const bankName = id => banks.find(x => x.id === id)?.name || id;
  const revision = `<input type="hidden" name="revision" value="${b.revision}">`;
  const hidden = (name, value) => `<input type="hidden" name="${name}" value="${escape(value)}">`;
  const button = label => `<button class="button button-quiet" type="submit">${label}</button>`;
  const amount = (id, value = 1000) => `<label for="${id}">${t("Tutar (oyun TL)", "Amount (game TL)", "Kwota (TL w grze)")}</label><input id="${id}" name="amount" type="number" inputmode="numeric" min="1" step="1" value="${value}" required>`;
  const form = (a, action, body) => `<form class="bank-form" data-bank-form="">${revision}${hidden("accountId", a.id)}${hidden("action", action)}${body}</form>`;
  const accountRows = b.accounts.filter(a => !a.closed).map(a => {
    const card = bankCard(state, a.id), debts = (state.wealth?.debts || []).filter(d => d.accountId === a.id);
    const peers = b.accounts.filter(x => !x.closed && x.id !== a.id && x.kind === a.kind && x.businessKey === a.businessKey);
    const commercial = a.kind === "commercial", current = commercial && a.businessKey === businessOwnerKey(state);
    const loans = commercial ? `<option value="commercial">${t("Ticari kredi · 3 ay, kâr ve kapalı önceki kredi; sermayenin %10'u", "Business loan · 3 profitable months, no prior loan; 10% of invested capital")}</option>`
      : ["small", "medium", "large"].map(id => { const q = creditOffer(state, id); return `<option value="personal:${id}">${t("İhtiyaç", "Personal", "Osobisty")} · ${money(q.cash)} → ${q.months} × ${money(Math.ceil(q.total / q.months))} · ${t("toplam", "total", "łącznie")} ${money(q.total)}</option>`; }).join("")
        + `<option value="vehicle:used">${t("Taşıt · Renault Symbol · %35 peşinat", "Vehicle · Renault Symbol · 35% down")}: ${money(63000)} · 36 × ${money(3250)}</option><option value="mortgage">${t("Konut · %30 peşinat", "Home · 30% down")}: ${money(144000)} · ${t("120 ay, aylık %0,50 oyun faizi", "120 months, 0.50% monthly game interest")}</option>`;
    return `<details class="bank-account-card" data-game-bank-account="${a.id}" open><summary><strong>${escape(bankName(a.bankId))} · ${commercial ? t("Ticari", "Business", "Firmowy") : t("Bireysel", "Personal", "Osobisty")}</strong><span>${money(a.balance)}</span></summary>
      <p class="context-note">${commercial ? t("Şahıs işletmesi hesabı. Yalnız sahibi sermaye yatırabilir/çekebilir; kişisel hesaplara doğrudan transfer yapılmaz.", "Sole-trader account. Only its owner may contribute/withdraw capital; direct transfers to personal accounts are blocked.") : t("Açılış, yatırma, çekme ve kendi hesapların arası transfer ücretsizdir; haftalık karar harcamaz.", "Opening, deposits, withdrawals and self-transfers are free and use no weekly decision.")}</p>
      <div class="bank-form-grid">${form(a, "deposit", amount(`${a.id}-deposit`) + button(t("Nakitten yatır", "Deposit cash", "Wpłać gotówkę")))}${form(a, "withdraw", amount(`${a.id}-withdraw`) + button(t("Nakde çek", "Withdraw cash", "Wypłać gotówkę")))}</div>
      ${peers.length ? form(a, "transfer", `<label for="${a.id}-target">${t("Kendi hedef hesabın", "Your destination account", "Twój rachunek docelowy")}</label><select id="${a.id}-target" name="targetId">${peers.map(p => `<option value="${p.id}">${escape(bankName(p.bankId))}</option>`).join("")}</select>${amount(`${a.id}-transfer`)}${button(t("Transfer et", "Transfer", "Przelej"))}`) : `<p class="context-note">${t("Transfer için başka bankada aynı türde bir hesap aç.", "Open the same account type at another bank to transfer.")}</p>`}
      <details class="bank-products"><summary>${t("Kredi, kart ve geri ödeme", "Loans, cards and repayment", "Kredyty, karty i spłaty")}</summary>
        <p class="context-note">${t("Yeni kredi/avans ve kredi ek ödemesi: 1 haftalık karar. Gelir, mevcut borç, dönem ve oyun sicili değerlendirilir. Taksit önce bağlı hesaptan, kalan tutar mevcut nakit motorundan karşılanır.", "New loans/advances and extra loan payments: 1 weekly decision. Income, existing debt, period and game credit history apply. Installments use the linked account first, then the existing cash engine.")}</p>
        ${form(a, "loan", `<label for="${a.id}-product">${t("Başvuru · oyun koşulları", "Application · game terms", "Wniosek · warunki gry")}</label><select id="${a.id}-product" name="product">${loans}</select>${button(t("Krediye başvur", "Apply for loan", "Złóż wniosek"))}`)}
        ${debts.map(d => `<div class="bank-loan"><p>${t("Bağlı kredi", "Linked loan", "Powiązany kredyt")}: ${money(debtBalance(d))} · ${t("taksit", "installment", "rata")} ${money(mortgageDue(d))}</p>${form(a, "repay", hidden("debtId", d.id) + amount(`${a.id}-${d.id}-repay`, Math.min(1000, debtBalance(d))) + button(t("Hesaptan ek ödeme", "Extra payment from account", "Dodatkowa spłata z rachunku")))}</div>`).join("")}
        ${current ? form(a, "commercial-primary", button(t("İşletme gelir/giderini bu hesaba bağla", "Use for business settlement"))) + (state.flags.business.bankAccountId === a.id && state.flags.business.debt > 0 ? `<p>${t("Ticari borç", "Business debt")}: ${money(state.flags.business.debt)}</p>` + form(a, "commercial-repay", amount(`${a.id}-commercial-pay`) + button(t("Ticari borca ek ödeme", "Extra business repayment"))) : "") : ""}
        ${!commercial && !card ? form(a, "card-open", `<p>${t("Yeni kart limiti", "New card limit", "Limit nowej karty")}: ${money(cardLimitAvailable(state))}. ${t("Bankalar toplam limiti gelirin en fazla 1,5 katıdır.", "Combined bank limits are capped at 1.5 times monthly income.")}</p>${button(t("Oyun kartı aç", "Open game card", "Otwórz kartę gry"))}`) : ""}
        ${card ? `<div class="bank-card-statement"><h3>${t("Kart ekstresi", "Card statement", "Wyciąg karty")}</h3><p>${t("Limit / borç", "Limit / debt", "Limit / dług")}: ${money(card.limit)} / ${money(card.balance)}</p><p>${t("Dönem borcu / asgari / gecikme", "Statement / minimum / overdue", "Wyciąg / minimum / zaległość")}: ${money(card.statement)} / ${money(card.minimumDue)} / ${money(card.overdue)}</p><p class="context-note">${t("Avans bedeli %2; kalan borca aylık oyun faizi", "Advance fee 2%; monthly game interest on remaining debt")}: ${cardRateBps(state) / 100}%. ${t("Asgari %20 (en az 100); sonraki ay bağlı hesaptan. Üç gecikmede kalan borç icraya aktarılır.", "Minimum 20% (at least 100), from linked account next month. After three missed minimums, remaining debt transfers to enforcement.")}</p>${card.blocked ? `<p>${t("Kart kullanıma kapalı; temerrüt borcu Para ekranında.", "Card blocked; default debt is in Money.")}</p>` : form(a, "card-advance", amount(`${a.id}-advance`) + button(t("Hesaba nakit avans", "Advance to account", "Zaliczka na rachunek")))}${card.balance ? form(a, "card-pay", amount(`${a.id}-card-pay`, Math.min(1000, card.balance)) + button(t("Hesaptan kart öde", "Pay card from account", "Spłać kartę z rachunku"))) : ""}</div>` : ""}
      </details>
      <details class="bank-history"><summary>${t("Hesap hareketleri", "Account history", "Historia rachunku")} (${a.history.length})</summary>${a.history.length ? `<ol>${[...a.history].reverse().map(h => `<li><span>${t("Hafta", "Week", "Tydzień")} ${h.week} · ${escape(h.reason)}</span><strong>${h.amount > 0 ? "+" : ""}${money(h.amount)}</strong><small>${t("Bakiye", "Balance", "Saldo")}: ${money(h.balance)}</small></li>`).join("")}</ol>` : `<p>${t("Henüz işlem yok.", "No transactions yet.", "Brak transakcji.")}</p>`}</details>
      ${form(a, "close", button(t("Boş hesabı kapat", "Close empty account", "Zamknij pusty rachunek")))}
    </details>`;
  }).join("");
  return `<section class="panel bank-accounts" data-bank-accounts><div class="panel-head"><h2>${t("Banka hesapların", "Your bank accounts", "Twoje rachunki bankowe")}</h2><strong>${money(totals.total)}</strong></div><p class="context-note">${t("Bunlar oyun içi hesaplardır. Gerçek banka hesabı, erişimi veya güncel ürün teklifi değildir. Tüm kurumlarda aynı açıklanan oyun koşulları uygulanır.", "These are game accounts, with no real bank access or current product offers. All institutions use the same disclosed game terms.")}</p><div class="bank-totals"><span>${t("Nakit", "Cash", "Gotówka")}: ${money(state.finances.balance)}</span><span>${t("Bireysel", "Personal", "Osobisty")}: ${money(totals.personal)}</span><span>${t("Ticari", "Business", "Firmowy")}: ${money(totals.commercial)}</span><span>${t("Kart borcu", "Card debt", "Dług karty")}: ${money(totals.cardDebt)}</span></div>
    <form class="bank-form bank-open" data-bank-form="">${revision}${hidden("action", "open")}<label for="bank-open-institution">${t("Banka", "Bank", "Bank")}</label><select id="bank-open-institution" name="bankId">${banks.map(bank => `<option value="${bank.id}">${escape(bank.name)}</option>`).join("")}</select><label for="bank-open-kind">${t("Hesap türü", "Account type", "Typ rachunku")}</label><select id="bank-open-kind" name="kind"><option value="personal">${t("Bireysel", "Personal", "Osobisty")}</option>${state.flags.business ? `<option value="commercial">${t("Ticari · kendi işletmen", "Business · your business", "Firmowy · twoja firma")}</option>` : ""}</select>${button(t("Ücretsiz hesap aç", "Open free account", "Otwórz bezpłatny rachunek"))}</form>
    ${accountRows || `<p class="empty">${t("Henüz hesabın yok. Nakit bakiyen korunuyor; ücretsiz hesap açarak başlayabilirsin.", "No accounts yet. Your cash is unchanged; open a free account to start.", "Nie masz jeszcze rachunków. Gotówka pozostaje bez zmian; otwórz bezpłatny rachunek.")}</p>`}
  </section>`;
}

export function bindBankAccounts(container, { getState, onResult }) {
  container.querySelectorAll("[data-bank-form]").forEach(form => form.addEventListener("submit", event => {
    event.preventDefault();
    if (form.dataset.submitted) return;
    form.dataset.submitted = "1";
    const data = Object.fromEntries(new FormData(form));
    data.revision = Number(data.revision);
    if (data.amount !== undefined) data.amount = Number(data.amount);
    if (data.product?.includes(":")) {
      const [product, value] = data.product.split(":"); data.product = product;
      if (product === "personal") data.offer = value; else data.vehicle = value;
    }
    const result = applyBankAction(getState(), data);
    onResult(result);
    if (!result.ok && form.isConnected) delete form.dataset.submitted;
  }));
}

// UI-only translation; the canonical ledger keeps its existing Turkish reasons.
export function bankActionMessage(result, language = "tr") {
  const message = result.message || result.reason || "";
  if (language === "tr") return message;
  const messages = {
    "Önce açık kararı tamamla; yaşam sona erdiyse hesaplar salt okunurdur.": "Complete the open decision first. Accounts are read-only after this life ends.",
    "Bu banka dönemde kullanılamıyor.": "This bank is unavailable in this period.",
    "Hesap türü geçersiz.": "Invalid account type.",
    "Ticari hesap için açık işletmen olmalı.": "You need an active business to open a business account.",
    "Bu bankada aynı türde hesabın zaten var.": "You already have this account type at this bank.",
    "Hesap açıldı. Açılış ücretsiz; hesaba para yatırabilirsin.": "Account opened for free. You can now deposit cash.",
    "Hesap bulunamadı veya kapalı.": "Account not found or closed.",
    "Kapatmadan önce bakiyeyi çek, kartı ve bağlı kredileri öde.": "Withdraw the balance and repay the card and linked loans before closing.",
    "Boş hesap kapatıldı; işlem geçmişi korundu.": "Empty account closed; transaction history retained.",
    "Tutar pozitif, tam oyun TL'si olmalı.": "Enter a positive whole amount in game TL.",
    "Bu ticari hesap artık mevcut işletmeye ait değil; bakiyeyi çekip kapatabilirsin.": "This account belongs to a previous business. Withdraw its balance and close it.",
    "Para nakitten seçili hesaba yatırıldı; toplam varlık değişmedi.": "Cash deposited into the selected account; total assets are unchanged.",
    "Nakit bakiyen yetersiz.": "Not enough cash.",
    "Hesap bakiyesi yetersiz.": "Not enough money in this account.",
    "Para seçili hesaptan nakde geçti; toplam varlık değişmedi.": "Money withdrawn from the selected account into cash; total assets are unchanged.",
    "Farklı bir açık hedef hesap seç.": "Choose a different open destination account.",
    "Bireysel ve ticari hesaplar ayrı tutulur. Sermaye yatırma/çekme işlemini nakit üzerinden yap.": "Personal and business accounts are separate. Use cash to contribute or withdraw owner capital.",
    "Kaynak hesap bakiyesi yetersiz.": "Not enough money in the source account.",
    "Kendi hesapların arası transfer tamamlandı; toplam varlık değişmedi.": "Transfer between your accounts completed; total assets are unchanged.",
    "Mevcut işletmenin ticari hesabı gerekiyor.": "Choose an account owned by your active business.",
    "İşletmenin aylık gelir ve giderleri bu ticari hesaba bağlandı.": "Business monthly settlement is now linked to this account.",
    "İşletmenin bağlı ticari hesabını seç.": "Choose the business's linked account.",
    "Ticari borç veya hesap bakiyesi yetersiz.": "No eligible business debt or insufficient account balance.",
    "Bu hafta geri ödeme için karar hakkı kalmadı.": "No repayment decision remains this week.",
    "Bireysel hesap, kullanılabilir gelir limiti ve kartsız hesap gerekiyor.": "A personal account without a card and available income-based credit limit are required.",
    "Bu hesapta kart yok.": "There is no card on this account.",
    "Kart borcu veya seçili hesap bakiyesi yetersiz.": "No card debt or insufficient account balance.",
    "Kart limiti yetersiz veya gecikme nedeniyle kullanım kapalı.": "Insufficient card limit, or borrowing is blocked by overdue payments.",
    "Bu kart için haftalık karar hakkı kalmadı.": "No decision remains for this card this week.",
    "Ticari kredi için mevcut işletmenin ticari hesabını seç.": "Select your active business's account for a business loan.",
    "Kişisel kredi, araç ve konut için bireysel hesap seç.": "Select a personal account for personal, vehicle or home finance.",
    "Kredi seçeneği bulunamadı.": "Loan option not found.",
    "Seçili hesapta peşinat yetersiz.": "Not enough money in the selected account for the down payment.",
    "Kredi ürünü tanınmadı.": "Unknown loan product.",
    "Bu hesaba bağlı kredi bulunamadı.": "No matching loan linked to this account.",
    "Seçili hesap bakiyesi geri ödemeye yetmiyor.": "The selected account cannot cover this repayment.",
    "Bu kredi için haftalık karar hakkı kalmadı.": "No decision remains for this loan this week.",
    "Banka işlemi tanınmadı.": "Unknown bank action.",
    "Hesaplar değişti. Güncel ekranı kullan; işlem tekrarlanmadı.": "Accounts changed. Use the updated screen; the transaction was not repeated.",
    "İşlem doğrulanamadı. Para ve kayıt değiştirilmedi.": "Validation failed. Money and saved data are unchanged.",
    "İşlem tamamlanamadı. Para ve kayıt değiştirilmedi.": "Transaction failed. Money and saved data are unchanged.",
    "Önce gecikmiş borç veya açık icra yükümlülüğünü çözmelisin.": "Resolve overdue debt or open enforcement before borrowing again.",
    "Oyun kuralı: kredi puanı 40'ın altındayken yalnız küçük ihtiyaç kredisi değerlendirilir.": "Below game credit score 40, only the small personal loan is considered.",
  };
  if (messages[message]) return messages[message];
  const patterns = [
    [/^(\d+) işletme hesabından ticari krediye ödendi\.$/, n => `${n} paid from the business account toward its loan.`],
    [/^Oyun kartı açıldı\. Limit (\d+); bankalar toplam limiti gelirle sınırlıdır\.$/, n => `Game card opened with limit ${n}. Combined bank limits are capped by income.`],
    [/^(\d+) seçili hesaptan kart borcuna ödendi; aynı tutar borçtan düştü\.$/, n => `${n} paid from the selected account; card debt fell by the same amount.`],
    [/^(\d+) seçili hesaba geçti\. (\d+) oyun işlem bedeli dahil (\d+) kart borcu oluştu\.$/, (n, fee, debt) => `${n} credited to the selected account. Card debt is ${debt}, including the ${fee} game fee.`],
    [/^Ticari kredi (\d+) işletme hesabına geçti; mevcut iş motorunun geri ödeme planı uygulanır\.$/, n => `Business loan ${n} credited to the business account under the existing repayment rules.`],
    [/^(\d+) seçili hesaptan kredi borcuna ödendi\.$/, n => `${n} paid from the selected account toward its linked loan.`],
  ];
  for (const [pattern, format] of patterns) { const match = message.match(pattern); if (match) return format(...match.slice(1)); }
  return message;
}
