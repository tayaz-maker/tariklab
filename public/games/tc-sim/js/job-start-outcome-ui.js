const h = (value) => String(value).replace(/[&<>"']/g, (char) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const signed = (number) => `${number > 0 ? "+" : ""}${number}`;

// Local draft translations; no shared dictionary or game data is changed.
// Polish still requires native review before a release-quality claim.
const pl = {
  "Bu seçimde nakit değişmedi": "Ta decyzja nie zmieniła gotówki",
  "Bu seçimde nakit": "Zmiana gotówki przy tej decyzji",
  "ek odak harcanmadı": "nie zużyto dodatkowego skupienia",
  "kullanılan odak değişimi": "zmiana zużytego skupienia",
  enerji: "energia", stres: "stres", sağlık: "zdrowie",
  "Aylık maaş düzeni": "Miesięczny plan wynagrodzenia",
  "Toplam haftalık yük": "Łączne obciążenie tygodniowe",
  "ulaşım payı": "udział dojazdów",
  "Mevcut iş, ulaşım ve eğitim düzeniyle haftalık enerji": "Tygodniowa energia przy obecnej pracy, dojazdach i nauce",
  "İŞ BAŞLADI": "PRACA ROZPOCZĘTA",
  "Beklenen hafta": "Tygodnie oczekiwania",
  "Vurguyu kapat": "Wyłącz wyróżnienie", "Vurgu kapalı": "Wyróżnienie wyłączone",
  "Bu seçimde gerçekleşti": "Skutek tej decyzji",
  "Sonraki haftaların düzeni": "Plan na kolejne tygodnie",
  "Haftalık yük ayrıntısı": "Szczegóły obciążenia tygodniowego",
  "Maaş şimdi ödenmedi.": "Wynagrodzenie nie zostało teraz wypłacone.",
  "Maaş ay sonundaki gelir düzenidir; burada gösterilen tutar şimdi ödenmedi. Haftalık yük sonraki hafta işlendiğinde uygulanır; koşullar değişebilir.": "Wynagrodzenie należy do planu dochodów na koniec miesiąca; pokazana kwota nie została teraz wypłacona. Obciążenie zostanie zastosowane podczas rozliczania następnego tygodnia; warunki mogą się zmienić.",
};
export const jobOutcomeText = (language, tr, en) => language === "pl" ? (pl[tr] || en) : language === "en" ? en : tr;

export function jobStartOutcomeCopy(model, t, money) {
  const now = model.now;
  const actual = [
    now.cash === 0 ? t("Bu seçimde nakit değişmedi", "No cash changed in this choice")
      : `${t("Bu seçimde nakit", "Cash in this choice")}: ${money(now.cash)}`,
    now.focus === 0 ? t("ek odak harcanmadı", "no extra focus spent")
      : `${t("kullanılan odak değişimi", "change in focus used")}: ${signed(now.focus)}`,
    ...[["energy", "enerji", "energy"], ["stress", "stres", "stress"], ["health", "sağlık", "health"]]
      .filter(([key]) => now[key] !== 0).map(([key, tr, en]) => `${t(tr, en)} ${signed(now[key])}`),
  ].join(" · ");
  const salary = `${t("Aylık maaş düzeni", "Monthly salary schedule")}: ${money(model.schedule.salaryBefore)} → ${money(model.schedule.salary)}`;
  const load = `${t("Toplam haftalık yük", "Total weekly load")}: ${model.schedule.loadBefore} → ${model.schedule.load} · ${t("ulaşım payı", "commute component")}: ${model.schedule.commute}`;
  const effects = `${t("Mevcut iş, ulaşım ve eğitim düzeniyle haftalık enerji", "Weekly energy with the current job, commute and study schedule")}: ${signed(model.schedule.energy)} · ${t("stres", "stress")}: ${signed(model.schedule.stress)}`;
  return { actual, salary, load, effects };
}

export function renderJobStartOutcome(model, { t, money, announce = false, emphasize = false, settled = false } = {}) {
  const copy = jobStartOutcomeCopy(model, t, money);
  return `<section class="result job-start-moment${emphasize ? " is-emphasized" : ""}${settled ? " is-settled" : ""}" data-job-start-moment data-outcome-key="${h(model.key)}" ${announce ? 'role="status" aria-live="polite" aria-atomic="true"' : 'aria-live="off"'}>
    <div class="job-start-moment__head"><div><strong>${h(t("İŞ BAŞLADI", "JOB STARTED"))}</strong><p>${h(model.jobTitle)}${model.waitedWeeks === null ? "" : ` · ${h(t("Beklenen hafta", "Weeks waited"))}: ${model.waitedWeeks}`}</p></div>
    <button type="button" class="button button-quiet" data-outcome-close aria-pressed="${settled}">${h(settled ? t("Vurgu kapalı", "Highlight off") : t("Vurguyu kapat", "Close highlight"))}</button></div>
    <div class="job-start-moment__periods"><div><b>${h(t("Bu seçimde gerçekleşti", "Happened in this choice"))}</b><p>${h(copy.actual)}.</p></div>
    <div><b>${h(t("Sonraki haftaların düzeni", "Schedule for coming weeks"))}</b><p>${h(copy.salary)}. ${h(t("Maaş şimdi ödenmedi.", "Salary was not paid now."))}</p><details><summary>${h(t("Haftalık yük ayrıntısı", "Weekly load details"))}</summary><p>${h(copy.load)}.</p><p>${h(copy.effects)}.</p><small>${h(t("Maaş ay sonundaki gelir düzenidir; burada gösterilen tutar şimdi ödenmedi. Haftalık yük sonraki hafta işlendiğinde uygulanır; koşullar değişebilir.", "Salary belongs to the month-end income schedule; the amount shown was not paid now. Weekly load applies when the next week is processed; conditions can change."))}</small></details></div></div>
  </section>`;
}

// Only the brief visual emphasis closes; its readable result stays in the same
// panel. Never move focus, rerender the app or create another live region.
export function bindJobStartOutcome(root, onSettled, t) {
  const panel = root.querySelector?.("[data-job-start-moment]");
  if (!panel) return;
  const button = panel.querySelector("[data-outcome-close]");
  let settled = panel.classList.contains("is-settled");
  const settle = () => {
    if (settled) return;
    settled = true;
    panel.setAttribute("aria-live", "off");
    panel.classList.remove("is-emphasized");
    panel.classList.add("is-settled");
    button?.setAttribute("aria-pressed", "true");
    if (button) button.textContent = t("Vurgu kapalı", "Highlight off");
    onSettled();
  };
  button?.addEventListener("click", settle);
  // Opening optional detail is deliberate reading, not another live update.
  panel.querySelector("summary")?.addEventListener("click", settle);
  panel.addEventListener("keydown", (event) => { if (event.key === "Escape") settle(); });
  panel.addEventListener("animationend", (event) => {
    if (event.animationName === "tc-job-start-trace") settle();
  });
}
