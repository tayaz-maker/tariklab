// Indexed game-budget contract; not a Turkish bank offer, legal rate or APR.
// Existing loans without this optional contract retain their original terms.
export const MORTGAGE_TERMS = Object.freeze({ rateBps: 50, months: 120, downPercent: 30 });
const whole = n => Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
export function amortizedPayment(principal, rateBps, months) {
  principal = whole(principal); months = Math.max(1, whole(months));
  const rate = whole(rateBps) / 10000;
  return principal ? Math.ceil(rate ? principal * rate / -Math.expm1(-months * Math.log1p(rate)) : principal / months) : 0;
}
export function newMortgage(principal) {
  return { version: 1, rateBps: MORTGAGE_TERMS.rateBps, monthsLeft: MORTGAGE_TERMS.months,
    interestDue: 0, overdue: 0, missedMonths: 0, restructures: 0, lastMonth: -1,
    originalPrincipal: whole(principal), interestAccrued: 0, interestPaid: 0, principalPaid: 0 };
}
export function normalizeMortgage(raw) {
  if (raw === undefined || raw === null) return undefined;
  // Preserve the version: unsupported contracts fail validation rather than
  // silently reverting to an interest-free legacy loan and losing liabilities.
  return { version: raw.version, rateBps: whole(raw.rateBps), monthsLeft: whole(raw.monthsLeft),
    interestDue: whole(raw.interestDue), overdue: whole(raw.overdue), missedMonths: whole(raw.missedMonths),
    restructures: whole(raw.restructures), lastMonth: Number.isSafeInteger(raw.lastMonth) ? raw.lastMonth : -1,
    originalPrincipal: whole(raw.originalPrincipal), interestAccrued: whole(raw.interestAccrued),
    interestPaid: whole(raw.interestPaid), principalPaid: whole(raw.principalPaid) };
}
export const isAmortizingMortgage = debt => debt.type === "mortgage" && debt.mortgage?.version === 1;
export const debtBalance = debt => whole(debt.principal) + whole(debt.mortgage?.interestDue);
export function mortgageDue(debt, accrue = true) {
  if (!isAmortizingMortgage(debt)) return Math.min(whole(debt.principal), whole(debt.monthlyPayment));
  const m = debt.mortgage, interest = accrue ? Math.round(debt.principal * m.rateBps / 10000) : 0;
  const owed = debtBalance(debt) + interest;
  return Math.min(owed, m.monthsLeft <= 1 ? owed : debt.monthlyPayment + m.overdue);
}
export function mortgageStatus(debt) {
  const m = debt.mortgage;
  return m.overdue > 0 ? m.missedMonths >= 3 ? "default" : "late" : m.restructures ? "restructured" : "current";
}
export function settleMortgagePayment(debt, amount) {
  const m = debt.mortgage, paid = Math.min(whole(amount), debtBalance(debt));
  const interest = Math.min(paid, m.interestDue), capital = paid - interest;
  m.interestDue -= interest; debt.principal -= capital;
  m.interestPaid += interest; m.principalPaid += capital;
  m.overdue = Math.max(0, m.overdue - paid);
  if (!m.overdue) m.missedMonths = 0;
  return paid;
}
export function settleMortgageMonth(debt, availableCash, month) {
  const m = debt.mortgage;
  if (m.lastMonth >= month) return null;
  const previousMissed = m.missedMonths;
  const interest = Math.round(debt.principal * m.rateBps / 10000);
  m.interestDue += interest; m.interestAccrued += interest;
  const required = mortgageDue(debt, false);
  const payment = settleMortgagePayment(debt, Math.min(whole(availableCash), required));
  m.overdue = Math.max(0, required - payment);
  m.missedMonths = m.overdue ? previousMissed + 1 : 0;
  m.monthsLeft = Math.max(0, m.monthsLeft - 1); m.lastMonth = month;
  return { payment, interest, required, missed: m.overdue > 0 };
}
function restructuredPayment(principal, interestDue, rateBps, months) {
  // Find a fixed integer payment against the actual interest-first schedule.
  // This avoids a hidden final balloon without capitalizing past interest.
  const closes = payment => {
    let capital = principal, interest = interestDue;
    for (let month = 0; month < months && capital + interest > 0; month++) {
      interest += Math.round(capital * rateBps / 10000);
      const paid = Math.min(payment, capital + interest), towardInterest = Math.min(paid, interest);
      interest -= towardInterest; capital -= paid - towardInterest;
    }
    return capital + interest === 0;
  };
  let low = Math.ceil((principal + interestDue) / months), high = principal + interestDue + Math.round(principal * rateBps / 10000);
  while (low < high) { const mid = Math.floor((low + high) / 2); if (closes(mid)) high = mid; else low = mid + 1; }
  return low;
}
export function restructureMortgage(debt) {
  const m = debt.mortgage;
  if (!m.overdue || m.restructures) return false;
  const term = Math.min(180, Math.max(12, m.monthsLeft) + 60);
  // Past interest remains separately owed; it is neither forgiven nor included
  // in interest-bearing principal. The new schedule spreads this liability.
  debt.monthlyPayment = restructuredPayment(debt.principal, m.interestDue, m.rateBps, term);
  m.monthsLeft = term; m.overdue = 0; m.missedMonths = 0; m.restructures += 1;
  return true;
}
export function validMortgage(debt) {
  const m = debt.mortgage;
  return !m || isAmortizingMortgage(debt) && m.rateBps <= 10000 && m.monthsLeft <= 180
    && m.restructures <= 1 && Object.entries(m).every(([key, value]) => Number.isSafeInteger(value) && value >= (key === "lastMonth" ? -1 : 0))
    && m.interestAccrued === m.interestPaid + m.interestDue
    && m.originalPrincipal === m.principalPaid + debt.principal && m.overdue <= debtBalance(debt);
}
const copy = {
  tr: { affordability: "Oyun kuralı: toplam aylık kredi ödemeleri düzenli gelirin %50’sini aşamaz.", collateral: "İpotekli konut", restructureDetail: "Bir kez, aynı faizle daha uzun vade; birikmiş faiz korunur.", heading: "Konut kredisi", note: "Yeni kredi: %30 peşinat, 120 ay, aylık %0,50 sabit oyun faizi. Gerçek banka oranı veya teklif değildir.", principal: "Kalan anapara", interest: "Ödenmemiş faiz", due: "Sıradaki ödeme", months: "Kalan ay", current: "Güncel", late: "Gecikmiş", default: "Temerrüt", restructured: "Yapılandırılmış", extra: "Ek ödeme yap", close: "Konut kredisini kapat", restructure: "Yapılandır", paid: "Konut kredisi ödemesi işlendi.", changed: "Borç korunarak ödeme planı uzatıldı.", unavailable: "Bu konut kredisi işlemi şu anda kullanılamıyor.", cash: "Bu ödeme için yeterli nakit yok.", principalPayment: "Anapara ödemesi", interestPayment: "Faiz ödemesi" },
  en: { affordability: "Game rule: total monthly loan payments cannot exceed 50% of regular income.", collateral: "Mortgaged property", restructureDetail: "One extension at the same rate; accrued interest remains owed.", heading: "Home loan", note: "New loan: 30% down, 120 months, fixed monthly game interest 0.50%. Not an actual bank rate or offer.", principal: "Remaining principal", interest: "Unpaid interest", due: "Next payment", months: "Months left", current: "Current", late: "Overdue", default: "Default", restructured: "Restructured", extra: "Make extra payment", close: "Pay off home loan", restructure: "Restructure", paid: "Home-loan payment recorded.", changed: "Payment schedule extended with the full debt retained.", unavailable: "This home-loan action is currently unavailable.", cash: "Not enough cash for this payment.", principalPayment: "Principal payment", interestPayment: "Interest payment" },
  pl: { affordability: "Zasada gry: łączne miesięczne raty nie mogą przekroczyć 50% regularnego dochodu.", collateral: "Nieruchomość obciążona hipoteką", restructureDetail: "Jedno wydłużenie przy tej samej stopie; naliczone odsetki pozostają należne.", heading: "Kredyt mieszkaniowy", note: "Nowy kredyt: 30% wkładu, 120 miesięcy, stałe miesięczne oprocentowanie w grze 0,50%. To nie jest rzeczywista stopa ani oferta banku.", principal: "Pozostały kapitał", interest: "Niezapłacone odsetki", due: "Następna płatność", months: "Pozostałe miesiące", current: "Bieżący", late: "Zaległy", default: "Niewypłacalność", restructured: "Po restrukturyzacji", extra: "Wpłać dodatkowo", close: "Spłać kredyt mieszkaniowy", restructure: "Restrukturyzuj", paid: "Zapisano spłatę kredytu mieszkaniowego.", changed: "Wydłużono harmonogram bez umorzenia długu.", unavailable: "Ta operacja kredytu mieszkaniowego jest teraz niedostępna.", cash: "Za mało środków na tę płatność.", principalPayment: "Spłata kapitału", interestPayment: "Spłata odsetek" },
};
export const mortgageText = (key, language = "tr") => (copy[language] || copy.tr)[key];
