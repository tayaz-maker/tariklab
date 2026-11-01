/** Boardworld 3.0 presentation. Reads public views; commands belong to engine.mjs. */
import { neighborhoodArt } from "./deep-ui.mjs";
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const money = (v) => `${Math.round(Number(v) || 0).toLocaleString("tr-TR")} ₺`;
const clock = (v) =>
  `${String(Math.floor((v % 1440) / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
const label = (v) => (typeof v === "string" ? v : v?.label || v?.name || v?.title || "");
const districtNames = { kadikoy: "Kadıköy", besiktas: "Beşiktaş", sisli: "Şişli" };
const initials = (name) =>
  String(name)
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("");
const button = (a) =>
  a
    ? `<button class="secondary" data-action="${esc(a.id)}" data-focus="action:${esc(a.id)}" ${a.disabled ? "disabled" : ""}>${esc(a.label)}</button>${a.disabled ? `<small class="action-reason">${esc(a.reason)}</small>` : ""}`
    : "";
const options = (list, selected) =>
  list
    .map((item) => {
      const id = typeof item === "string" ? item : item.id;
      return `<option value="${esc(id)}" ${id === selected ? "selected" : ""}>${esc(label(item))}</option>`;
    })
    .join("");

export function renderToday(view, state, actions) {
  const next = view.nextEvent,
    today = Math.floor(state.time / 1440) + 1;
  const active = view.entries.filter(
    (e) =>
      e.status === "confirmed" && e.start >= state.time && Math.floor(e.start / 1440) + 1 === today,
  );
  const advance = actions.find((a) => a.id === "calendar:next");
  return `<section class="today-desk" aria-label="Bugünün planı"><div><span class="eyebrow">BUGÜNÜN İPİ SENDE</span><strong>${active.length ? `${active.length} planın var` : "Gününü sen kur"}</strong><span>${active[0] ? `${esc(active[0].startLabel || clock(active[0].start))} · ${esc(active[0].title)}` : "Mekânı seç, zamanı ayır, koşulları gör."}</span></div><div class="today-next"><span class="eyebrow">SIRADAKİ ANLAMLI AN</span><strong>${esc(next?.label || "Takvimde yeni bir plan için yer var.")}</strong><span>${next ? `${next.day}. gün · ${esc(next.timeLabel)}` : "İş, eğitim ve görüşmeler aynı takvimde."}</span></div><div class="today-controls"><button class="secondary" data-tab="plan">Günü planla ↗</button>${advance ? `<button class="text-button" data-action="${esc(advance.id)}" data-focus="action:${esc(advance.id)}" ${advance.disabled ? "disabled" : ""}>${esc(advance.label)}</button>` : ""}</div></section>`;
}

export function renderCityMap({
  state,
  city,
  calendar,
  npcs,
  getLocation,
  selectedDistrict,
  actions,
  actionCard,
  conditions = "",
}) {
  const districts = city.districts || [],
    venues = city.venues || [];
  const selected = districts.find((d) => d.id === selectedDistrict) || districts[0];
  const routeActions = actions.filter(
    (a) => a.category === "travel" && a.id.split(":").includes(selected?.id),
  );
  const destinations = city.routes.filter(
    (r) => r.from === state.location && r.to !== state.location,
  );
  const unique = destinations.filter((r, i, all) => all.findIndex((x) => x.to === r.to) === i);
  const tokens = (id) =>
    calendar.entries.filter(
      (e) =>
        ["confirmed", "counter"].includes(e.status) && e.district === id && e.end >= state.time,
    ).length;
  const venueCards = venues.filter((v) => v.district === selected?.id);
  return `<section class="living-map" aria-label="Bağlantılı İstanbul oyun haritası"><div class="map-title"><div><span class="eyebrow">İSTANBUL / BAĞLANTILI ŞEHİR</span><p>Üç semt. Birbirine bağlı hayatlar.</p></div><span class="map-edition">04</span></div><div class="city-schematic"><svg class="city-connections" viewBox="0 0 900 340" aria-hidden="true"><path class="city-water" d="M570 -20C480 95 610 190 550 370L700 370C760 200 620 100 720 -20Z"/><path class="city-route-line" d="M180 90L370 245M370 245L735 195M180 90L735 195"/><path class="city-ferry-line" d="M370 245Q560 310 735 195"/><text x="607" y="70" transform="rotate(18 607 70)">BOĞAZ</text></svg>${districts
    .map((d) => {
      const here = state.location === d.id,
        residents = here ? npcs.filter((n) => getLocation(state, n.id) === d.id) : [],
        count = tokens(d.id);
      return `<article class="city-node node-${esc(d.id)} ${here ? "current" : ""} ${selectedDistrict === d.id ? "selected" : ""}" data-region="${esc(d.id)}"><button class="neighborhood-select" data-district="${esc(d.id)}" data-focus="district:${esc(d.id)}" aria-pressed="${selectedDistrict === d.id}">${neighborhoodArt(d.id)}<span class="node-title"><strong>${esc(d.name)}</strong>${here ? "<em>Taşın burada</em>" : ""}</span><span class="node-activity">${here ? `${residents.length} kişi` : "Gidince keşfet"} · ${venues.filter((v) => v.district === d.id && v.open).length} açık mekân${count ? ` · ${count} plan` : ""}</span></button><div class="node-tokens">${here ? `<span class="map-player" title="${esc(state.player.name)}">${esc(initials(state.player.name))}</span>` : ""}${residents
        .slice(0, 3)
        .map(
          (n) =>
            `<button class="map-npc" data-npc="${esc(n.id)}" aria-label="${esc(n.name)} profilini aç" title="${esc(n.name)}">${esc(initials(n.name))}</button>`,
        )
        .join(
          "",
        )}${count ? `<button class="map-plan-marker" data-calendar-district="${esc(d.id)}" aria-label="${esc(d.name)} planlarını aç">◷ ${count}</button>` : ""}</div></article>`;
    })
    .join("")}</div><div class="route-ribbon" aria-label="Bulunduğun semtten bağlantılar">${unique
    .map((r) => {
      const travel = actions.find((a) => a.id === `travel:${r.to}`);
      return `<div class="direct-route"><button data-district="${esc(r.to)}" class="route-connection"><span>${esc(districtNames[r.from])} <b aria-hidden="true">↗</b> ${esc(districtNames[r.to])}</span><strong>${r.minutes} dk · ${money(r.cost)}</strong></button>${travel ? `<button class="route-go" data-action="${esc(travel.id)}" data-focus="action:${esc(travel.id)}" aria-label="${esc(travel.label)} · ${travel.minutes} dakika · ${money(travel.cost)}" ${travel.disabled ? "disabled" : ""}>Git →</button>` : ""}</div>`;
    })
    .join(
      "",
    )}</div><p class="map-simulation-note">Şematik oyun haritası. Süreler ve fiyatlar simülasyona aittir; canlı ulaşım verisi değildir.</p></section><section class="location-dossier"><div class="location-heading"><span class="eyebrow">SEÇİLİ SEMT</span><h3>${esc(selected?.name)}</h3><p>${esc(selected?.summary)}</p></div><ul class="location-advantages">${(selected?.features || []).map((f) => `<li>${esc(f)}</li>`).join("")}</ul>${conditions}${
    state.location !== selected?.id
      ? `<div class="route-options"><div class="subheading"><h3>Yolunu seç</h3><span class="tiny">Süre, bedel ve takvim birlikte hesaplanır.</span></div><div class="action-grid">${routeActions.map((a) => actionCard(a, true)).join("")}</div>${destinations
          .filter((r) => r.to === selected?.id)
          .flatMap((r) => r.conflicts || [])
          .map((c) => `<p class="route-conflict">${esc(c)}</p>`)
          .join("")}</div>`
      : `<div class="map-context-actions" aria-label="Bulunduğun semtte yapabileceklerin"><div class="subheading"><h3>Şimdi burada</h3><button class="text-button" data-intent-open>Diğer hamleler ↗</button></div><div class="context-action-grid">${actions
          .filter(
            (a) =>
              !a.disabled &&
              (["work", "study", "cook", "rest"].includes(a.id) ||
                a.id.startsWith("apply:") ||
                (a.category === "social" &&
                  a.npcId &&
                  npcs.some(
                    (n) => n.id === a.npcId && getLocation(state, n.id) === state.location,
                  ))),
          )
          .slice(0, 4)
          .map(
            (a) =>
              `<div class="context-action"><button data-action="${esc(a.id)}" data-focus="action:${esc(a.id)}"><strong>${esc(a.label)}</strong><span>${a.minutes} dk · ${a.cost ? money(a.cost) : "Ücretsiz"}</span></button><button class="context-preview" data-preview="${esc(a.id)}" aria-label="${esc(a.label)} sonucunu önceden gör">↗</button></div>`,
          )
          .join("")}</div></div>`
  }<div class="local-venues"><div class="subheading"><h3>Mekânlar & saatler</h3><span class="tiny">${state.location === selected?.id ? "Bulunduğun semt" : "Ulaşımı da hesaba kat"}</span></div><div class="venue-grid">${venueCards
    .map((v) => {
      const visit = actions.find((a) => a.id === `visit:${v.id}`);
      return `<article class="venue-card ${state.city?.venue === v.id ? "at-venue" : ""}"><div><strong>${esc(v.name)}</strong><span>${esc(label(v.hours))} · <b class="${v.open ? "venue-open" : "venue-closed"}">${v.open ? "Açık" : "Kapalı"}</b></span>${state.city?.venue === v.id ? "<em>Şu anda buradasın</em>" : ""}</div>${visit ? button(visit) : ""}</article>`;
    })
    .join(
      "",
    )}</div></div><div class="district-links"><button class="secondary" data-tab="work">İş olanakları ↗</button><button class="secondary" data-tab="people">İnsanlar ↗</button><button class="secondary" data-tab="life">Gündelik ihtiyaçlar ↗</button></div></section>`;
}

function renderCalendarEntry(entry, actions) {
  const related = actions.filter(
    (a) => a.id.startsWith("calendar:") && a.id.endsWith(`:${entry.id}`),
  );
  return `<article class="calendar-entry status-${esc(entry.status)}" data-entry="${esc(entry.id)}"><div class="entry-time"><strong>${esc(entry.startLabel || clock(entry.start))}</strong><span>${esc(entry.endLabel || clock(entry.end))}</span></div><div class="entry-body"><span class="entry-status">${esc(entry.statusLabel || entry.status)}</span><h4>${esc(entry.title)}</h4><p>${esc(entry.venueName || entry.venue)} · ${esc(districtNames[entry.district])}</p>${entry.outcome ? `<p class="entry-outcome">${esc(entry.outcome)}</p>` : ""}${entry.status === "counter" ? '<p class="counter-note">Karşı teklif var. Bu zaman, kabul edene kadar takviminde kesinleşmez.</p>' : ""}<div class="entry-actions">${related.map((a) => (a.id.startsWith("calendar:reschedule:") ? `<button class="secondary" data-calendar-edit="${esc(entry.id)}" ${a.disabled ? "disabled" : ""}>Yeniden planla</button>` : button(a))).join("")}</div></div></article>`;
}

export function renderCalendar({
  view,
  state,
  actions,
  mode,
  draft,
  slots,
  editing,
  npcs,
  stories,
}) {
  const selectedDay = draft.day || view.day,
    today = Math.floor(state.time / 1440) + 1;
  const visible = view.entries.filter((e) => Math.floor(e.start / 1440) + 1 === view.day);
  const statuses = ["confirmed", "counter"];
  const hints = (view.reminders || []).map((r) => label(r)).filter(Boolean);
  const kinds = slots.kinds || view.kinds || [],
    venues = slots.venues || view.venues || [];
  const subjects = (slots.subjects || view.subjects || []).filter(
    (s) => !s.kind || s.kind === draft.kind,
  );
  const days = view.days || [];
  const weekStart = today + Math.floor((view.day - today) / 7) * 7;
  const weekDays = days.filter((d) => d.day >= weekStart && d.day < weekStart + 7);
  const summaryDay = days.find((d) => d.day === view.day);
  const planningStories = stories.filter(
    (s) => s.status === "waiting" && s.dueDay >= view.day && s.dueDay < view.day + 7,
  );
  return `<section class="calendar-board" data-calendar="board"><div class="calendar-toolbar"><div><span class="eyebrow">${esc(summaryDay?.dateLabel || `${view.day}. gün`)}</span><h3>${esc(summaryDay?.weekday || "Planların")}</h3></div><div class="calendar-switch" aria-label="Takvim görünümü"><button data-calendar-mode="day" aria-pressed="${mode === "day"}">Gün</button><button data-calendar-mode="week" aria-pressed="${mode === "week"}">Hafta</button></div></div><div class="calendar-navigation"><button class="secondary" data-calendar-week="-1" ${view.day <= today ? "disabled" : ""} aria-label="Önceki hafta">←</button><button class="text-button" data-calendar-day="${today}">Bugüne dön</button><button class="secondary" data-calendar-week="1" ${weekDays.at(-1)?.day === days.at(-1)?.day ? "disabled" : ""} aria-label="Sonraki hafta">→</button></div><div class="calendar-day-strip">${weekDays.map((d) => `<button data-calendar-day="${d.day}" aria-pressed="${d.day === view.day}" class="${d.day === view.day ? "selected" : ""}"><span>${esc(d.weekday)}</span><strong>${d.day}</strong><small>${view.entries.filter((e) => statuses.includes(e.status) && Math.floor(e.start / 1440) + 1 === d.day).length} plan</small></button>`).join("")}</div>${
    hints.length
      ? `<div class="calendar-reminders">${hints
          .slice(0, 4)
          .map((h) => `<p>${esc(h)}</p>`)
          .join("")}</div>`
      : ""
  }<div class="calendar-content ${mode}">${
    mode === "week"
      ? weekDays
          .map(
            (d) =>
              `<section class="calendar-week-day"><button class="week-day-title" data-calendar-day="${d.day}"><b>${esc(d.dateLabel)}</b><span>${esc(d.weekday)} ↗</span></button>${
                view.entries
                  .filter((e) => Math.floor(e.start / 1440) + 1 === d.day)
                  .map((e) => renderCalendarEntry(e, actions))
                  .join("") || '<p class="calendar-free">Henüz bir plan yok.</p>'
              }</section>`,
          )
          .join("")
      : visible.map((e) => renderCalendarEntry(e, actions)).join("") ||
        '<div class="calendar-empty"><strong>Bu güne henüz söz vermedin.</strong><p>Aşağıdan bir görüşme, iş, ders veya kişisel zaman planlayabilirsin.</p></div>'
  }</div>${planningStories.length ? `<div class="timeline-days story-calendar-links">${planningStories.map((s) => `<button class="timeline-link" data-tab="stories"><span>${s.dueDay}. gün</span><strong>${esc(s.title)}</strong><span aria-hidden="true">↗</span></button>`).join("")}</div>` : '<div class="timeline-days story-calendar-links"></div>'}</section><section class="calendar-proposal"><div class="subheading"><div><span class="eyebrow">ZAMANI BİRLİKTE SEÇİN</span><h3>${editing ? "Planını yeniden düzenle" : "Takvimine bir niyet ekle"}</h3></div>${editing ? '<button class="text-button" data-calendar-reset>Vazgeç</button>' : ""}</div><form id="appointment-form" tabindex="-1" data-focus="calendar-form"><div class="proposal-fields"><label class="field">Ne planlıyorsun?<select name="kind">${options(kinds, draft.kind)}</select></label>${draft.kind === "meeting" ? `<label class="field">Kiminle?<select name="npcId">${options(npcs, draft.npcId)}</select></label>` : `<label class="field">Konu<select name="subjectId">${options(subjects, draft.subjectId)}</select></label>`}<label class="field">Oyun tarihi<select name="day">${days.map((d) => `<option value="${d.day}" ${d.day === selectedDay ? "selected" : ""}>${esc(d.dateLabel)} · ${esc(d.weekday)}</option>`).join("")}</select></label><label class="field">Nerede?<select name="venue">${venues.map((v) => `<option value="${esc(v.id)}" ${v.id === draft.venue ? "selected" : ""}>${esc(v.name)} · ${esc(districtNames[v.district])}</option>`).join("")}</select></label><label class="field">Başlangıç saati<select name="minute">${(slots.slots || []).map((t) => `<option value="${t.minute}" ${t.minute === draft.minute ? "selected" : ""}>${esc(t.label)}${t.available ? "" : " · uygunluk kontrolü"}</option>`).join("")}</select></label><label class="field">Ayırdığın süre<select name="duration">${(["meeting", "personal"].includes(draft.kind) ? [30, 60, 90, 120] : [draft.duration]).map((n) => `<option value="${n}" ${n === draft.duration ? "selected" : ""}>${n} dakika</option>`).join("")}</select></label><label class="field">Tekrar<select name="repeat"><option value="none" ${draft.repeat === "none" ? "selected" : ""}>Bir kez</option>${["personal", "class", "shift"].includes(draft.kind) ? `<option value="weekly" ${draft.repeat === "weekly" ? "selected" : ""}>Her hafta</option>` : ""}</select></label></div>${slots.slots?.find((t) => t.minute === draft.minute)?.reason ? `<p class="slot-reason">${esc(slots.slots.find((t) => t.minute === draft.minute).reason)}</p>` : ""}<p class="tiny">Tarih ve saat oyun takvimine aittir. Ulaşım, mekân saatleri ve herkesin mevcut planı birlikte kontrol edilir. Karşı teklif kesin bir randevu değildir.</p><div class="proposal-submit"><button class="primary" type="submit" data-testid="propose-appointment">${editing ? "Yeni zamanı öner" : "Planı öner"}</button><button class="secondary" type="button" data-calendar-preview>Önce sonucunu gör ↗</button></div></form></section>${view.recurrences?.length ? `<section class="calendar-proposal recurring-plans"><div class="subheading"><h3>Tekrar eden taahhütler</h3></div>${view.recurrences.map((r) => `<article><strong>${esc(r.label)}</strong><p class="tiny">Sonraki oluşum: ${Math.floor(r.nextStart / 1440) + 1}. gün. Tekrarı durdurmak mevcut onaylı planı iptal etmez.</p>${button(actions.find((a) => a.id === `calendar:repeat-stop:${r.id}`))}</article>`).join("")}</section>` : ""}`;
}

export function renderProjects(
  view,
  actions,
  actionCard,
  selectedType = "qualification",
  selectedAction = "",
) {
  const projects = view.projects || [];
  const types = [
    { id: "qualification", name: "Bir beceride uzmanlaş" },
    { id: "relocation", name: "Yeni bir eve taşın" },
    { id: "enterprise", name: "Bir işletme kur" },
    { id: "relationship", name: "Kalıcı bir bağ kur" },
  ];
  const starts = actions.filter(
    (a) => a.category === "project" && a.id.startsWith(`project:start:${selectedType}:`),
  );
  const chosen = starts.find((a) => a.id === selectedAction) || starts[0];
  const cards = projects
    .map((p) => {
      const controls = actions.filter(
        (a) => p.actionIds?.includes(a.id) || a.id.startsWith(`project:budget:${p.id}:`),
      );
      return `<article class="project-card status-${esc(p.status)}" data-project="${esc(p.id)}"><div class="project-heading"><span class="eyebrow">UZUN VADELİ PROJE</span><b>${esc(p.statusLabel || { active: "Devam ediyor", available: "Başlamaya hazır", completed: "Tamamlandı", complete: "Tamamlandı", failed: "Sonuçlanmadı", cancelled: "Vazgeçildi" }[p.status] || p.status)}</b></div><h3>${esc(p.title)}</h3><p>${esc(p.description)}</p>${p.status !== "available" ? `<progress max="${p.total || 1}" value="${p.progress || 0}" aria-label="${esc(p.title)} ilerlemesi"></progress><div class="project-metrics"><span>İlerleme<strong>${p.progress || 0} / ${p.total || 1}</strong></span><span>Bütçe<strong>${money(p.budget)}</strong></span><span>Harcama<strong>${money(p.spent)}</strong></span><span>Hedef gün<strong>${p.dueDay || "—"}</strong></span></div>` : `<p class="tiny">Başlangıç bütçe sınırı ${money(p.budget)} · ${p.total} gerçek aşama</p>`}${p.nextMilestone ? `<div class="project-milestone"><span class="eyebrow">SIRADAKİ GERÇEK ADIM</span><p>${esc(p.nextMilestone)}</p></div>` : ""}${p.consequences?.length ? `<ul class="project-consequences">${p.consequences.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>` : ""}<div class="project-actions">${p.status === "available" ? `<button class="secondary" data-project-type="${esc(p.id.replace("available-", ""))}">Hedefini ve süreni seç ↗</button>` : controls.map(button).join("")}</div></article>`;
    })
    .join("");
  return `<section class="project-launcher"><div class="subheading"><div><span class="eyebrow">BİR YÖN SEÇ</span><h3>Neyi adım adım kuracaksın?</h3></div></div><form id="project-form"><div class="project-selectors"><label class="field">Hayat alanı<select name="type">${options(types, selectedType)}</select></label><label class="field">Hedef ve süre<select name="action">${starts.map((a) => `<option value="${esc(a.id)}" ${a.id === chosen?.id ? "selected" : ""}>${esc(a.label)}</option>`).join("")}</select></label></div></form><div class="project-chosen">${chosen ? actionCard(chosen, true) : '<p class="empty-state">Bu alandaki hedeflerin zaten proje dosyanda. Diğer yaşam alanlarını seçebilirsin.</p>'}</div></section><div class="project-board">${cards || '<p class="empty-state">Bir yaşam yönü seç. İlerlemen gerçek eğitim, iş, taşınma ve ilişkilerinden doğar.</p>'}</div>`;
}

export function renderPublicNpc(view, social) {
  if (!view) return "";
  return `<section class="npc-depth public-npc" data-deep="npc-profile"><div class="deep-stats"><div class="deep-stat"><span>Saygı</span><strong>${Math.round(social?.respect || 0)}</strong></div><div class="deep-stat"><span>Kırgınlık</span><strong>${Math.round(social?.resentment || 0)}</strong></div></div><div class="deep-note"><span class="eyebrow">SENİNLE PAYLAŞTIĞI HAYATI</span><p>${esc(view.knownProfession || "Mesleği hakkında henüz konuşmadınız.")}</p>${view.knownHome ? `<p>Yaşadığı çevre: ${esc(districtNames[view.knownHome] || view.knownHome)}</p>` : ""}${view.goalSummary ? `<p>${esc(view.goalSummary)}</p>` : ""}</div><p class="tiny"><b>Uygunluğu:</b> ${esc(label(view.availability) || "Görüşme teklifinde takvimine bakar.")}</p><details class="knowledge-file"><summary>Duydukların ve gördüklerin <span>${view.observedChanges?.length || 0}</span></summary>${
    view.observedChanges?.length
      ? `<ol>${view.observedChanges
          .slice(-8)
          .reverse()
          .map((c) => `<li><b>${Math.floor(c.at / 1440) + 1}. gün</b> ${esc(c.text)}</li>`)
          .join("")}</ol>`
      : "<p>Bir değişiklik ancak sana ulaştığında bu dosyaya girer.</p>"
  }</details>${view.offers?.length ? `<ul class="npc-offers">${view.offers.map((o) => `<li>${esc(o)}</li>`).join("")}</ul>` : ""}<button class="secondary" data-schedule-npc="${esc(view.id)}">Bir zaman öner ↗</button></section>`;
}

export const INTENTS = [
  { id: "all", label: "Seçeneklerimi keşfet", categories: [] },
  { id: "earn", label: "Gelirimi artır", categories: ["work", "business"] },
  { id: "connect", label: "Birine zaman ayır", categories: ["social", "calendar"] },
  { id: "learn", label: "Kendimi geliştir", categories: ["education", "project"] },
  { id: "balance", label: "Bütçemi toparla", categories: ["finance", "household"] },
  { id: "care", label: "Kendime bak", categories: ["life", "household"] },
  { id: "build", label: "Bir proje büyüt", categories: ["project", "business"] },
];
export function renderIntentComposer({
  intent,
  query,
  npcId,
  location,
  results,
  npcs,
  districts,
  actionCard,
  fallbackActions = [],
}) {
  const chosen = INTENTS.find((i) => i.id === intent) || INTENTS[0];
  const matched = chosen.categories.length
    ? results.filter(
        (a) =>
          chosen.categories.includes(a.category) ||
          (intent === "connect" && a.id.startsWith("calendar:")),
      )
    : results;
  const alternatives = matched.some((a) => !a.disabled)
    ? []
    : fallbackActions
        .filter(
          (a) => !a.disabled && !a.id.startsWith("schedule:") && !a.id.startsWith("calendar:"),
        )
        .slice(0, 3);
  const ordered = [
    ...matched.filter((a) => !a.disabled),
    ...matched.filter((a) => a.disabled),
  ].slice(0, 12);
  return `<section class="intent-composer" data-intent="composer"><div class="subheading"><div><span class="eyebrow">NİYETİNİ BİR HAMLEYE DÖNÜŞTÜR</span><h3>Bugün neyi değiştirmek istersin?</h3></div></div><form id="intent-form"><div class="intent-fields"><label class="field">Niyetin<select name="intent">${INTENTS.map((i) => `<option value="${i.id}" ${intent === i.id ? "selected" : ""}>${esc(i.label)}</option>`).join("")}</select></label><label class="field">Bir kişi<select name="npcId"><option value="">Herkes</option>${options(npcs, npcId)}</select></label><label class="field">Bir semt<select name="location"><option value="">Bütün semtler</option>${options(districts, location)}</select></label><label class="field">Eylem ara<input name="query" value="${esc(query)}" maxlength="60" placeholder="İş, ders, borç…"></label></div><button class="secondary" type="submit">Uygulanabilir hamleleri bul ↗</button></form><p class="tiny">Arama, oyunun mevcut eylemleriyle sınırlı. Her sonuç gerçek süre, bütçe ve konum koşullarına bağlıdır.</p>${intent === "connect" ? `<button class="primary" data-schedule-npc="${esc(npcId || npcs[0]?.id)}">Belirli bir zaman için görüşme öner</button>` : ""}<div class="intent-results"><span class="eyebrow">${matched.length} DESTEKLENEN SEÇENEK${matched.length > 12 ? " · İLK 12 SONUÇ" : ""}</span><div class="action-grid">${ordered.map((a) => actionCard(a, true)).join("") || '<div class="empty-state">Bu filtrelerle bir hamle yok. Kişi veya semt filtresini kaldır; gündelik bakım, iş ve eğitim seçeneklerini yeniden gör.</div>'}</div>${alternatives.length ? `<div class="subheading"><h3>Şimdi yapılabilecek diğer hamleler</h3></div><div class="action-grid">${alternatives.map((a) => actionCard(a, true)).join("")}</div>` : ""}</div></section>`;
}

export function renderWorldBulletin(view) {
  return `<section class="world-bulletin"><div class="subheading"><h3>Şehir kendi hayatını sürdürüyor.</h3><span class="tiny">Yalnızca sana ulaşan haberler</span></div><div class="population-strip">${(view.population || []).map((p) => `<article><strong>${esc(p.name || districtNames[p.district])}</strong><p>${esc(p.summary)}</p></article>`).join("")}</div>${
    view.feed?.length
      ? `<ol class="public-feed">${view.feed
          .slice(-6)
          .reverse()
          .map(
            (f) =>
              `<li><span>${Math.floor(f.at / 1440) + 1}. gün</span><p>${esc(f.text)}${f.source ? `<small>${esc(f.source)}</small>` : ""}</p></li>`,
          )
          .join("")}</ol>`
      : ""
  }</section>`;
}

export function renderLivingEconomy(view, section) {
  const data = view[section];
  if (!data) return "";
  if (section === "enterprise")
    return `<section class="deep-card"><div class="deep-heading"><span class="eyebrow">İŞİN GÜNLÜK GERÇEĞİ</span><h3>Sermaye, kapasite ve talep.</h3></div><p>${esc(data.summary)}</p><div class="deep-stats"><div class="deep-stat"><span>İşletme sermayesi</span><strong>${money(data.capital)}</strong></div><div class="deep-stat"><span>Malzeme / stok</span><strong>${data.stock}</strong></div><div class="deep-stat"><span>Hizmet kapasitesi</span><strong>${data.capacity}</strong></div><div class="deep-stat"><span>Talep</span><strong>${data.demand}%</strong></div></div></section>`;
  return `<section class="deep-card household-file"><div class="deep-heading"><span class="eyebrow">EVİNİN GÜNDELİK DÜZENİ</span><h3>Barınmak, bir düzen sürdürmek.</h3></div><p>${esc(data.summary)}</p>${data.maintenanceDue ? `<p class="tiny">Yaklaşan bakım: ${esc(data.maintenanceDue)}</p>` : ""}${data.assets?.length ? `<ul>${data.assets.map((a) => `<li><strong>${esc(a.name)}</strong><p>${esc(a.effect)}</p></li>`).join("")}</ul>` : ""}</section>`;
}
