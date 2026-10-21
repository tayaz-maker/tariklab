import { mortgageDue } from "./mortgage.js?v=10";
const labels = {
  tr: ["Nakit", "Banka toplamı", "Net servet", "Aylık borç / gecikme", "Sağlık / enerji", "Kalan karar", "Gün / hafta", "Durum özeti"],
  en: ["Cash", "Bank total", "Net worth", "Monthly debt / overdue", "Health / energy", "Decisions left", "Date / week", "Status overview"],
  pl: ["Gotówka", "Suma w bankach", "Majątek netto", "Dług miesięczny / zaległy", "Zdrowie / energia", "Pozostałe decyzje", "Data / tydzień", "Podsumowanie stanu"],
};
export function statusFacts(state, worth, remaining) {
  return {
    cash: state.finances.balance,
    bank: worth.bank || 0,
    wealth: worth.total,
    due: (state.wealth?.debts || []).reduce((sum, debt) => sum + mortgageDue(debt), 0),
    arrears: Math.max(0, state.finances.arrears || 0),
    health: state.health.health, energy: state.health.energy,
    remaining: Math.max(0, remaining), date: state.time.date, week: state.time.weekOfMonth,
  };
}
export function renderLifeStatus(state, { worth, remaining, money, language = "tr" }) {
  const l = labels[language] || labels.tr, f = statusFacts(state, worth, remaining);
  const rows = [[l[6], `${f.date} · ${f.week}`], [l[0], money(f.cash)], [l[1], money(f.bank)],
    [l[2], money(f.wealth)], [l[3], `${money(f.due)} / ${money(f.arrears)}`], [l[4], `${f.health} / ${f.energy}`], [l[5], f.remaining]];
  return `<dl class="life-status" aria-label="${l[7]}">${rows.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join("")}</dl>`;
}
