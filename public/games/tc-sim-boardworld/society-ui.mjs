/** Only public learned snapshots are presented here. All decisions use engine action IDs. */
import { t, translateText, number, money, signed } from "./i18n.mjs";
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const text = (v) => esc(translateText(v));
const at = (value) =>
  value === null || value === undefined
    ? "—"
    : t("{day}. gün · {time}", {
        day: number(Math.floor(value / 1440) + 1),
        time: `${String(Math.floor((value % 1440) / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`,
      });
const target = (value = {}) =>
  `data-decision-target="${esc(value.tab || "plan")}" ${value.npcId ? `data-target-npc="${esc(value.npcId)}"` : ""} ${value.districtId ? `data-target-district="${esc(value.districtId)}"` : ""} ${value.calendarDay ? `data-target-day="${value.calendarDay}"` : ""} ${value.eventId ? `data-target-event="${esc(value.eventId)}"` : ""}`;
function controls(ids, actions, { limit = 4 } = {}) {
  return (ids || [])
    .map((id) => actions.find((a) => a.id === id))
    .filter(Boolean)
    .slice(0, limit)
    .map((a) => {
      const review = a.id === "flow:payments:authorized";
      return `<div class="society-action"><button class="${review ? "secondary" : "action-button"}" ${review ? `data-preview="${esc(a.id)}"` : `data-action="${esc(a.id)}" data-focus="action:${esc(a.id)}"`} ${a.disabled ? "disabled" : ""}><span>${text(a.label)}</span><small>${a.variableCost || a.id.startsWith("flow:care") ? text("Plana bağlı") : `${number(a.minutes || 0)} ${text("dk")} · ${a.cost ? money(a.cost) : text("Ücretsiz")}`}</small></button>${!review ? `<button class="context-preview" data-preview="${esc(a.id)}" aria-label="${text("Öngörüyü incele")}: ${text(a.label)}">↗</button>` : ""}${a.disabled && a.reason ? `<p class="action-reason">${text(a.reason)}</p>` : ""}</div>`;
    })
    .join("");
}
function decision(item, actions, urgent = false) {
  return `<article class="daily-decision ${urgent ? "urgent" : "opportunity"}" data-decision="${esc(item.id)}"><div><h3>${text(item.title)}</h3><p>${text(item.summary || item.why)}</p>${item.dueAt !== null && item.dueAt !== undefined ? `<small>${text("Son zaman")}: ${esc(at(item.dueAt))}</small>` : ""}</div><div class="society-action-row">${controls(item.actionIds, actions, { limit: urgent ? 3 : 2 })}</div><button class="text-button" ${target(item.target)}>${text("Bağlamı ve tüm seçenekleri gör")} ↗</button></article>`;
}
export function renderDecisionDesk(view, actions) {
  if (!view) return "";
  const urgent = view.urgent || [],
    opportunities = view.opportunities || [],
    background = view.background || [];
  return `<section class="decision-desk" data-society="decision-desk" aria-label="${text("Günün karar masası")}"><div class="decision-desk-heading"><span class="eyebrow">${text("BUGÜNÜN KARARLARI")}</span><div class="decision-counts"><span class="${urgent.length ? "urgent-count" : ""}">${number(urgent.length)} ${text("öncelik")}</span><span>${number(opportunities.length)} ${text("fırsat")}</span></div></div>${urgent.length ? decision(urgent[0], actions, true) : `<p class="daily-clear">${text("Acil bir karar yok. Gününü kendi hedefinle kur.")}</p>`}${
    urgent.length > 1
      ? `<details class="decision-fold"><summary>${t("{n} diğer sorumluluk", { n: number(urgent.length - 1) })}</summary>${urgent
          .slice(1)
          .map((i) => decision(i, actions, true))
          .join("")}</details>`
      : ""
  }${opportunities.length ? `<details class="decision-fold"><summary>${text("Anlamlı fırsatlar")} <span>${number(opportunities.length)}</span></summary>${opportunities.map((i) => decision(i, actions)).join("")}</details>` : ""}${background.length ? `<details class="decision-fold background"><summary>${text("Arka plandaki düzen")}</summary>${background.map((i) => `<p><strong>${text(i.title)}</strong> · ${text(i.summary)} <button class="text-button" ${target(i.target)}>${text("İncele")} ↗</button></p>`).join("")}</details>` : ""}</section>`;
}
export function renderRoutineRecovery(view, actions, debtPlan = null) {
  const r = view?.routine;
  if (!r) return "";
  return `<section class="routine-recovery ${r.blocked ? "is-blocked" : "is-ready"}" data-society="routine-recovery" data-stop-code="${esc(r.code)}"><div><span class="eyebrow">${text(r.blocked ? "PLANIN SÖZÜ SANA BIRAKTI" : "PLANIN DURUMU")}</span><h3>${text(r.blocked ? "Önce bu düğümü çöz." : "Sıradaki adımı sen seç.")}</h3><p>${text(r.reason)}</p>${r.blocked ? `<p class="tiny">${text("Aynı durumu yeniden denemek zamanı ilerletmez. Aşağıdaki gerçek seçeneklerden birini seç.")}</p>` : ""}</div>${r.blocked ? `<div class="society-action-row">${controls(r.actionIds, actions, { limit: 6 })}</div><button class="text-button" ${target(r.target)}>${text("İlgili koşulları aç")} ↗</button>` : ""}<details class="settlement-consent"><summary>${text("Rutin ve sözleşme ödemeleri")}</summary><p>${text("Mevcut sözleşme giderleri için izin verebilirsin. Yeni borç, yeni kira veya ilişki kararı bu izne dahil değildir.")}</p>${debtPlan ? `<p class="payment-plan-review">${esc(t("Mevcut haftalık plan: {0} TL; sıradaki ödeme {1}. gün. İzin bu kurulmuş plana da uygulanır.", { 0: number(debtPlan.weeklyPayment), 1: number(debtPlan.nextDay) }))}</p>` : ""}<div class="payment-context-links"><button class="text-button" data-decision-target="wallet">${text("Borç ve fatura planlarını incele")} ↗</button><button class="text-button" data-decision-target="life">${text("Kira koşullarını incele")} ↗</button><button class="text-button" data-decision-target="enterprise">${text("İşletme giderlerini incele")} ↗</button></div><div class="society-action-row">${controls(
    actions.filter((a) => a.id.startsWith("flow:payments:")).map((a) => a.id),
    actions,
  )}</div></details></section>`;
}
export function renderSocietyOffers(view, actions, npcId = "") {
  const offers = (view?.offers || []).filter((o) => !npcId || o.npcId === npcId);
  if (!offers.length) return "";
  return `<section class="society-offers" data-society="offers"><div class="subheading"><h3>${text("Sana gelen öneriler")}</h3><span class="tiny">${text("Onaylamadan söz vermiş olmazsın.")}</span></div>${offers.map((o) => `<article class="society-offer" data-offer="${esc(o.id)}"><span class="eyebrow" data-person-name>${esc(o.actor?.name)}</span><h3>${text(o.title)}</h3><p>${text(o.why)}</p><div class="social-times">${o.start ? `<span>${text("Önerilen zaman")} <b>${esc(at(o.start))}</b></span>` : ""}<span>${text("Yanıt süresi")} <b>${esc(at(o.expiresAt))}</b></span></div><div class="society-action-row">${controls(o.actionIds, actions)}</div></article>`).join("")}</section>`;
}
export function renderSocietyChronology(view, actions, { npcId = "", limit = 12 } = {}) {
  const rows = (view?.chronology || [])
    .filter(
      (e) => !npcId || e.actors?.some((a) => a.id === npcId) || e.relatedNpcIds?.includes(npcId),
    )
    .slice()
    .sort((a, b) => b.learnedAt - a.learnedAt)
    .slice(0, limit);
  return `<section class="society-chronology" data-society="chronology"><div class="subheading"><div><span class="eyebrow">${text("KİM → NEDEN → SONUÇ")}</span><h3>${text("Sana ulaşan hayatlar")}</h3></div></div><p class="tiny">${text("Burada yalnız öğrendiğin gelişmeler görünür. Bilginin ulaştığı zaman, olayın zamanından farklı olabilir.")}</p>${rows.length ? rows.map((e) => `<details class="society-episode" data-episode="${esc(e.id)}"><summary><span><strong>${text(e.title)}</strong><small>${e.actors?.map((a) => esc(a.name)).join(" · ") || text("Mahalle")} · ${esc(at(e.learnedAt))}</small></span>${e.requiresAction ? `<b>${text("Karar bekliyor")}</b>` : '<span aria-hidden="true">+</span>'}</summary><div class="episode-body"><div><span class="eyebrow">${text("NEDEN")}</span><p>${text(e.why)}</p></div><div><span class="eyebrow">${text("NE DEĞİŞTİ?")}</span><p>${text(e.change)}</p></div><dl class="episode-evidence"><div><dt>${text("Olay zamanı")}</dt><dd>${esc(at(e.happenedAt))}</dd></div><div><dt>${text("Öğrendiğin zaman")}</dt><dd>${esc(at(e.learnedAt))}</dd></div><div><dt>${text("Kaynak")}</dt><dd>${text(e.source?.label || "Doğrudan bilgi")}</dd></div><div><dt>${text("Güvenilirlik")}</dt><dd>${number(e.source?.credibility ?? 0)}/100</dd></div></dl>${e.parentId ? `<p class="tiny">${text("Önceki olayın devamı")}: ${text((view.chronology || []).find((row) => row.id !== e.id && (row.id === e.parentId || row.parentId === e.parentId))?.title || e.title)}</p>` : ""}${e.requiresAction ? `<div class="society-action-row">${controls(e.actionIds, actions)}</div>` : `<p class="tiny">${text("Şu anda yanıt vermen gerekmiyor.")}</p>`}</div></details>`).join("") : `<p class="empty-state">${text("Henüz sana ulaşan yeni bir toplum haberi yok.")}</p>`}</section>`;
}
export function renderSocietyProfile(view, npcId, actions) {
  const p = view?.profiles?.find((p) => p.id === npcId);
  if (!p) return "";
  const known = (p.knownFacts || []).slice(-4).reverse(),
    ties = (p.ties || []).slice(-5);
  return `${renderSocietyOffers(view, actions, npcId)}<details class="society-profile" data-society="profile"><summary>${text("Öğrendiğin sosyal bağlam")} <span>${number(known.length + ties.length)}</span></summary><p class="tiny">${text("Bu profil, gizli hesaplara veya özel ilişkilere açılan bir pencere değildir.")}</p>${known.length ? known.map((f) => `<article><p>${text(f.value)}</p><small>${text(f.source?.label)}${f.originActor?.name ? ` · ${esc(f.originActor.name)}` : ""} · ${number(f.credibility)}/100</small><small>${text("Olay zamanı")}: ${esc(at(f.happenedAt))} · ${text("Öğrendiğin zaman")}: ${esc(at(f.learnedAt))}</small><span class="privacy-tag">${text(f.privacy === "private" ? "Özel: başkasına iletilmez" : "Kaynak belirtilerek paylaşılabilir")}${f.corrected ? ` · ${text("Güven kaybı kanıtla onarıldı")}` : ""}</span></article>`).join("") : `<p>${text("Henüz paylaşılmış yeni bir bilgi yok.")}</p>`}${controls(
    actions
      .filter(
        (a) => a.category === "society" && a.npcId === npcId && a.id.startsWith("society:clarify:"),
      )
      .map((a) => a.id),
    actions,
  )}${ties.length ? `<h4>${text("Bilinen bağlantılar")}</h4>${ties.map((e) => `<article class="known-edge"><strong data-person-name>${esc(e.from.name)} ↔ ${esc(e.to.name)}</strong><p>${text({ colleague: "İş çevresi", neighbor: "Komşuluk", friend: "Arkadaşlık", acquaintance: "Tanışıklık" }[e.type] || e.type)} · ${text("Güven")} ${number(e.trust)} · ${text("Karşılıklılık")} ${number(e.reciprocity)}</p><small>${text(e.source?.label)} · ${esc(at(e.learnedAt))}</small></article>`).join("")}` : ""}</details>`;
}
export function renderSocietyDistrict(view, id, actions) {
  const d = view?.districts?.find((d) => d.id === id);
  if (!d) return "";
  const e = d.effects || {};
  return `<details class="district-society" data-society="district"><summary><strong>${text("Mahallenin bugünkü dengesi")}</strong><span>${text("Erzak")} ${number(d.foodStock)} · ${text("Malzeme")} ${number(d.materialStock)}</span></summary><div class="district-supply">${Number.isFinite(d.foodPricePct) ? `<div><span>${text("Gıda fiyatı")}</span><b>${number(d.foodPricePct)}%</b></div>` : ""}<div><span>${text("Malzeme fiyatı")}</span><b>${number(d.materialPricePct ?? e.stockPricePct)}%</b></div><div><span>${text("Hizmet beklemesi")}</span><b>+${number(e.serviceDelay)} ${text("dk")}</b></div><div><span>${text("Yeni kira baskısı")}</span><b>${signed(e.rentPressure, 0)}%</b></div><div><span>${text("İş fırsatları")}</span><b>${number(e.jobOpenings)}</b></div></div><p>${text(d.why)}</p><p class="tiny">${text("%100 temel fiyatı gösterir; stok ve yoğunluk gerçek alışveriş ve bakım koşullarını değiştirir.")}</p>${d.nextStock && Number.isFinite(d.nextDeliveryAt) ? `<p class="district-delivery">${text("Sıradaki stok öngörüsü")}: ${esc(at(d.nextDeliveryAt))} · ${text("Erzak")} ${number(d.nextStock.food)} · ${text("Malzeme")} ${number(d.nextStock.material)}. ${text("Öngörü, bilinen giriş ve tüketimi içerir; yeni alışverişlerle değişebilir.")}</p>` : ""}<p class="tiny">${text("Sıradaki değerlendirme")}: ${esc(at(d.validUntil))}. ${text("Mevcut kira geriye dönük değişmez.")}</p><div class="society-action-row">${controls(d.actionIds, actions)}</div></details>`;
}
