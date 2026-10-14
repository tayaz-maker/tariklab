import { eligibleSuccessors } from "./lifetime.js?v=10";
import { getHomeById, getJobById } from "./catalog.js?v=10";
import { getEducationLevelLabel } from "./education.js?v=10";
import { BACKGROUND_OPTIONS } from "./state.js?v=10";
const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const money = (value) => `₺${Number(value || 0).toLocaleString("tr-TR")}`;
export function renderLifeReport(report) {
  if (!report) return "";
  return `<article class="panel"><h2>${escape(report.name)} — Yaşam raporu</h2>
    <p>${report.generation}. kuşak · ${report.age} yaş · ${report.year} · ${escape(report.cause)}</p>
    <p>Başlangıç: ${Object.entries(report.background)
      .map(([k, v]) => escape(BACKGROUND_OPTIONS[k]?.[v] || "Kayıt yok"))
      .join(" · ")}.</p>
    <p>Eğitim: ${escape(getEducationLevelLabel(report.education.level))}${report.education.active ? " · devam eden eğitim vardı" : ""}.</p>
    <p>Emeklilik: ${report.career.retirement.status === "retired" ? `Emekli · aylık ${money(report.career.retirement.monthlyIncome)}` : "Emekli olmadı"}. Son konut: ${escape(getHomeById(report.homeId)?.title)} (kiralık/aile konutu; terekeye eklenmez).</p>
    <h3>Kariyerden kayıtlar</h3>${report.career.history.map((h) => `<p>${escape(h.label)}</p>`).join("") || "<p>Kayıt yok.</p>"}
    <h3>Aile</h3><p>${report.partner ? `Partner: ${escape(report.partner)}` : "Yaşam sonunda kayıtlı partner yok."}</p>
    ${report.children.map((c) => `<p>${escape(c.name)} · ${c.age} yaş · ${c.trajectory === "education-focused" ? "eğitim yönünde" : c.trajectory === "work-focused" ? "çalışma yönünde" : "yönü henüz açık"} · güven ${c.relationship.trust}</p>`).join("") || "<p>Çocuk yok.</p>"}
    <h3>Beden ve geçmiş</h3><p>Son sağlık: ${report.health.health}/100 · stres: ${report.health.stress}/100.</p>
    <p>Oyuncunun bildiği uzun dönem beden durumu: ${report.conditions.length} kayıt.</p>
    ${report.householdHistory
      .slice(-8)
      .map((h) => `<p>${escape(h.text)}</p>`)
      .join("")}
    ${report.memories.map((m) => `<p>${escape(m.year)} · ${escape(m.text)}</p>`).join("")}
    <h3>Son yıl dosyaları</h3>${report.years.map((y) => `<p>${escape(y.year)} · yıl sonu ${money(y.endingBalance)} · ${y.career?.retirementStatus === "retired" ? "emekli" : escape(getJobById(y.career?.jobId)?.title || "aktif iş yok")}</p>`).join("")}
    <h3>Servet ve tereke</h3><p>Yaşam standardı: ${escape({ modest: "İdare eder", comfortable: "Rahat", comfort: "Evi düzgün", high: "Gösterişli" }[report.wealth?.lifestyle] || "İdare eder")}.</p>
    <p>Nakit ${money(report.estate.cash)}${Number.isFinite(report.estate.investments) ? ` · yatırımlar ${money(report.estate.investments)} · gayrimenkul ${money(report.estate.property)} · araç/eşya ${money((report.estate.vehicle || 0) + (report.estate.durables || 0))}` : ""} · kayıtlı yükümlülükler ${money(report.estate.obligations)} · dağıtılabilir ${money(report.estate.net)}.</p>
    <p>TC SIM'in basitleştirilmiş paylaşımıdır; hukuk hesabı değildir. Negatif bakiye çocuklara borç olarak yüklenmez.</p>
    ${report.lifeDossier ? `<h3>HAYAT DOSYASI</h3><p><strong>${escape({ balanced: "Dengeli hayat", "successful-but-alone": "Başarılı ama yalnız", "simple-with-strong-bonds": "Sade ve güçlü bağlar", "financially-secure": "Maddi güvenlik", "wealthy-but-burned-out": "Varlıklı ama tükenmiş", "burned-out": "Tükenmiş hayat", "debt-burdened": "Borç yüküyle kapanan hayat" }[report.lifeDossier.outcome] || report.lifeDossier.outcome)}</strong> · ${escape(report.lifeDossier.phase)}</p><p>Kariyer ${escape(report.lifeDossier.career.stage)} · aile ${escape(report.lifeDossier.family.stage)} · ilişki ${escape(report.lifeDossier.relationships.stage)} · sağlık ${escape(report.lifeDossier.health.stage)}.</p>${report.lifeDossier.traces.map((trace) => `<p>${escape(trace.text)}</p>`).join("")}` : ""}
    ${report.estate.shares.map((s) => `<p>${escape(s.name)}: ${money(s.amount)}</p>`).join("")}
  </article>`;
}
export function renderLifetimeTerminal(state) {
  const death = state.lifetime?.death;
  if (!death) return "";
  const report = state.lifetime.reports.find((r) => r.id === death.reportId);
  const heirs = eligibleSuccessors(state);
  return `<div class="workspace-head"><div><p class="eyebrow">TAMAMLANAN YAŞAM</p><h1>${escape(state.player.name)}</h1></div></div>
    ${renderLifeReport(report)}<section class="panel"><h2>${heirs.length ? "Bir sonraki kuşak" : "Bu yaşamın kaydı tamamlandı"}</h2>
    <p>${heirs.length ? "Seçtiğin yetişkin çocuk yeni oyuncu olur. Geçmiş yaşam raporu saklanır; bu seçim geri alınmaz." : "Uygun yetişkin çocuk yok. Raporunu kaydedebilir veya yeni oyun başlatabilirsin."}</p>
    ${heirs.map((c) => `<button class="button" data-successor="${escape(c.id)}">${escape(c.name)} ile devam et</button>`).join("")}</section>`;
}
export function renderLineage(state) {
  const life = state.lifetime;
  if (!life?.reports.length) return "";
  return `<section class="panel"><h2>${life.generation}. kuşak — aile geçmişi</h2>
    ${life.family.map((p) => `<p>${escape(p.name)} · ${p.relation === "sibling" ? "kardeş" : p.alive ? "ebeveyn" : "hayatını kaybeden ebeveyn"}</p>`).join("")}
    ${life.reports.map((r) => `<details><summary>${escape(r.name)} · ${r.generation}. kuşak · ${r.age} yaş</summary>${renderLifeReport(r)}</details>`).join("")}</section>`;
}
