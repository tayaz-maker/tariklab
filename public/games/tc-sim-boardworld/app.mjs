import {
  createGame,
  resolveAction,
  getActions,
  getClock,
  getGoals,
  getNpcLocation,
  getDeepView,
  previewAction,
  getCalendarView,
  getAppointmentOptions,
  getCityView,
  getLivingView,
  getIntentActions,
  getEmergentView,
  getLifeView,
  getSocietyView,
  getDecisionView,
} from "./engine.mjs";
import {
  DISTRICTS,
  SCENARIOS,
  JOBS,
  NPCS,
  COURSES,
  HOMES,
  EVENTS,
  TRAITS,
  EDUCATIONS,
  SKILLS,
  ITEMS,
} from "./content.mjs";
import { getStoryView } from "./life-chains.mjs";
import {
  renderCareer,
  renderFreelance,
  renderFinance,
  renderNetwork,
  renderStoryCards,
  renderStoryPrompt,
  renderPlanning,
  renderBusiness,
  renderPreview,
} from "./deep-ui.mjs";
import {
  renderToday,
  renderCityMap,
  renderCalendar,
  renderProjects,
  renderPublicNpc,
  renderIntentComposer,
  renderWorldBulletin,
  renderLivingEconomy,
} from "./living-ui.mjs";
import {
  renderSystemicEvents,
  renderCausalHistory,
  renderPolicies,
  renderHousehold,
  renderSecondaryContacts,
  renderSecondaryProfile,
  renderRoles,
  renderEmployer,
  renderDistrictConditions,
  renderFirstFive,
  renderHabits,
} from "./emergent-ui.mjs";
import { loadGame, saveGame, exportGame, importGame, SAVE_KEY } from "./persistence.mjs";
import {
  initLocale,
  localizeTree,
  markOriginalRecords,
  translateText,
  money as formatMoney,
  getLanguage,
  chooseLanguage,
} from "./i18n.mjs";
import {
  renderDecisionDesk,
  renderRoutineRecovery,
  renderSocietyOffers,
  renderSocietyChronology,
  renderSocietyProfile,
  renderSocietyDistrict,
} from "./society-ui.mjs";

const $ = (selector, root = document) => root.querySelector(selector);
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const money = formatMoney;
const title = (value) => value?.name ?? value?.title ?? "";
const lookup = (list, id) => list.find((entry) => entry.id === id);
const clockText = (minute) =>
  typeof minute === "number"
    ? `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`
    : minute;
const achievementNames = {
  "first-30-days": "İlk 30 gün",
  "first-certificate": "İlk sertifika",
  partnership: "Paylaşılan hayat",
  "first-shift": "İlk vardiya",
};
const districtName = (id) => title(lookup(DISTRICTS, id)) || id;
const initials = (name) =>
  String(name)
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toLocaleUpperCase("tr-TR");
const duration = (minutes) =>
  !minutes
    ? "Anında"
    : minutes >= 60
      ? `${Math.floor(minutes / 60)} sa${minutes % 60 ? ` ${minutes % 60} dk` : ""}`
      : `${minutes} dk`;
const tabDefs = [
  ["board", "Şehir", "◈"],
  ["plan", "Ajanda", "◷"],
  ["projects", "Projeler", "◇"],
  ["work", "Kariyer", "▤"],
  ["enterprise", "İşletme", "▧"],
  ["life", "Yaşam", "⌂"],
  ["people", "Telefon", "◎"],
  ["study", "Gelişim", "↗"],
  ["wallet", "Cüzdan", "₺"],
  ["bag", "Çanta", "▱"],
  ["stories", "Hikâyeler", "◬"],
  ["goals", "Hedefler", "◇"],
  ["log", "Günlük", "≡"],
];
let state = null,
  tab = "board",
  selectedDistrict = "kadikoy",
  selectedNpc = NPCS[0]?.id,
  actions = [],
  deepView = null,
  storyViews = [],
  cityView = null,
  livingView = null,
  calendarView = null,
  emergentView = null,
  lifeView = null,
  societyView = null,
  decisionView = null,
  householdChoice = "",
  calendarDay = null,
  calendarMode = "day",
  appointmentDraft = null,
  editingEntry = "",
  previewPayload = null,
  intentOpen = false,
  intentFilters = { intent: "all", query: "", npcId: "", location: "" },
  lastOutcome = null,
  saveStatus = "",
  busy = false;
const app = $("#app"),
  dialog = $("#menu-dialog");
const embedded = window.self !== window.top;
if (embedded) document.documentElement.classList.add("embedded");
let noticeTimer;
let initialLoad;
try {
  initialLoad = loadGame();
  state = initialLoad.state;
  saveStatus = initialLoad.message || "";
} catch {
  initialLoad = {
    message: "Tarayıcı kaydına ulaşılamadı. Oyunu oynayabilir, kaydını dosyaya indirebilirsin.",
  };
}
if (state) selectedDistrict = state.location;
const languageControl = () =>
  embedded
    ? ""
    : `<label class="language-field"><span class="sr-only">Dil</span><select data-game-language aria-label="Dil">${["tr", "en", "pl"].map((l) => `<option value="${l}" ${l === getLanguage() ? "selected" : ""}>${l.toUpperCase()}</option>`).join("")}</select></label>`;
const option = (entry, selected) =>
  `<option value="${esc(entry.id)}" ${entry.id === selected ? "selected" : ""}>${esc(title(entry))}</option>`;

function announce(message, error = false) {
  const el = $("#notice");
  el.textContent = translateText(message);
  el.className = `notice visible${error ? " error" : ""}`;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => el.classList.remove("visible"), error ? 12000 : 6500);
}
function badge(text, kind = "") {
  return `<span class="badge ${kind}">${esc(text)}</span>`;
}
function sectionHeader(eyebrow, heading, copy = "") {
  return `<header class="section-heading"><span class="eyebrow">${esc(eyebrow)}</span><h2 tabindex="-1" id="panel-heading">${esc(heading)}</h2>${copy ? `<p>${esc(copy)}</p>` : ""}</header>`;
}
function meter(label, value, inverse = false) {
  const v = Math.max(0, Math.min(100, Math.round(value || 0)));
  return `<div class="meter ${inverse ? "inverse" : ""} ${inverse ? (v > 70 ? "low" : "") : v < 30 ? "low" : ""}"><span>${esc(label)} <b>${v}</b></span><meter min="0" max="100" value="${v}" aria-label="${esc(label)}">${v}</meter></div>`;
}
function renderStart() {
  app.innerHTML = `<main class="onboarding" id="main"><section class="start-story"><a href="/" target="_top" class="back-link">← TarikLab oyunları</a><div class="edition">İSTANBUL / BİRBİRİNE BAĞLI HAYATLAR / 05</div><div class="brand-lockup"><span class="brand-seal">TC</span><span>SIM<span class="brand-small">BOARDWORLD</span></span></div><h1>Bu şehirde<br>bir hayatın var.</h1><p class="start-lead">İşini seç. İnsanları tanı. Bir ev kur.<br>Bir düzen kur. Kararlarının izini şehirde gör.</p><div class="start-board" aria-hidden="true"><span class="start-route"></span><span class="mini-place mini-one">01 <b>Şişli</b><small>Kariyer &amp; eğitim</small></span><span class="mini-place mini-two">02 <b>Beşiktaş</b><small>Sahil &amp; sosyal çevre</small></span><span class="mini-place mini-three">03 <b>Kadıköy</b><small>Yeni başlangıçlar</small><i class="player-piece"></i></span><span class="mini-water">İSTANBUL BOĞAZI</span></div><p class="start-note">Tek oyunculu · Zaman yalnızca karar verdiğinde ilerler.</p></section><section class="creation"><span class="eyebrow">KARAKTER KARTIN</span><h2>İlk sayfayı sen yaz.</h2><p class="muted">Başlangıcın koşullarını değiştirir; geleceğini belirlemez.</p><form id="create-form"><label class="field">Karakter adı<input name="name" id="character-name" autocomplete="off" minlength="2" maxlength="32" required value="Deniz" placeholder="Karakterinin adı"></label><fieldset class="scenario-list"><legend>Nereden başlıyorsun?</legend>${SCENARIOS.map((s, i) => `<label class="scenario-option"><input type="radio" name="scenario" value="${esc(s.id)}" ${i === 0 ? "checked" : ""}><span class="scenario-number">0${i + 1}</span><span><strong>${esc(title(s))}</strong><small>${esc(s.description)}</small></span><span class="radio-dot"></span></label>`).join("")}</fieldset><div class="field-row"><label class="field">Eğitim<select name="education">${EDUCATIONS.map((e) => option(e, "highschool")).join("")}</select></label><label class="field">Kişilik<select name="trait">${TRAITS.map((e) => option(e, "balanced")).join("")}</select></label></div><p class="creation-detail" id="trait-description">${esc(lookup(TRAITS, "balanced")?.description || "")}</p><button class="primary start-button" type="submit" data-testid="create-game">Hayatına başla <span aria-hidden="true">→</span></button></form><div class="start-foot">${languageControl()}<button class="text-button" data-ui="import">Kayıt dosyası yükle</button><button class="text-button" data-ui="help">Nasıl oynanır?</button></div><p class="privacy">Kayıtların bu tarayıcıda tutulur. Cihaz değiştirmek için kayıt dosyanı indir.</p></section></main>`;
}
function actionCard(a, compact = false) {
  const aid = `reason-${a.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  return `<article class="action-card ${a.disabled ? "unavailable" : ""} ${compact ? "compact" : ""}"><div class="action-top"><span class="action-time">◷ ${esc(a.id.startsWith("schedule:run:") || a.id === "calendar:next" ? "Plana bağlı" : duration(a.minutes))}</span>${a.cost > 0 ? `<span class="action-cost">${money(a.cost)}</span>` : a.cost < 0 ? `<span class="action-cost income">+${money(-a.cost)}</span>` : '<span class="action-cost">Ücretsiz</span>'}</div><h3>${esc(a.label)}</h3><p>${esc(a.description)}</p>${a.disabled ? `<p class="action-reason" id="${aid}">${esc(a.reason || "Şu anda uygun değil.")}</p>` : ""}<button class="${compact ? "secondary" : "action-button"}" aria-label="${esc(a.label)}" data-action="${esc(a.id)}" data-focus="action:${esc(a.id)}" ${a.disabled ? `disabled aria-describedby="${aid}"` : ""}>${a.disabled ? "Koşullar eksik" : "Seç"} <span aria-hidden="true">${a.disabled ? "·" : "→"}</span></button><button class="forecast-button" data-preview="${esc(a.id)}" aria-label="${esc(a.label)} için sonuç öngörüsü">Öngörüyü incele <span aria-hidden="true">↗</span></button></article>`;
}
function actionList(category, filter = () => true) {
  const list = actions.filter((a) => a.category === category && filter(a));
  return list.length
    ? `<div class="action-grid">${list.map((a) => actionCard(a)).join("")}</div>`
    : '<p class="empty-state">Şu an bu bölümde yeni bir eylem yok. Zaman, konum ve ilişkiler seçenekleri değiştirir.</p>';
}
function renderEvent() {
  if (!state.pendingEvents?.length) return "";
  const first = state.pendingEvents[0],
    event = lookup(EVENTS, first.id);
  const choices = actions.filter(
    (a) => a.category === "event" && a.id.startsWith(`event:${first.id}:`),
  );
  return `<section class="event-card" aria-label="Bekleyen olay"><div class="event-heading"><span class="event-mark" aria-hidden="true">!</span><div><span class="eyebrow">OLAY KARTI · ${state.pendingEvents.length} BEKLEYEN</span><h2>${esc(title(event) || "Yeni bir karar")}</h2></div></div><p>${esc(event?.description || event?.text || "Şehir sana yeni bir seçenek sunuyor. Devam etmeden önce kararını ver.")}</p><div class="event-choices">${choices.map((a) => actionCard(a, true)).join("")}</div></section>`;
}
function renderBoard() {
  return `<div class="board-heading">${sectionHeader("İSTANBUL / KARARLARININ ŞEHRİ", "Hayatın bu masada.")}</div>${renderFirstFive(state)}${state.pendingEvents.length ? "" : renderDecisionDesk(decisionView, actions)}${renderCityMap({ state, city: cityView, calendar: calendarView, npcs: NPCS, getLocation: getNpcLocation, selectedDistrict, actions, actionCard, conditions: renderDistrictConditions(lifeView, selectedDistrict) + renderSocietyDistrict(societyView, selectedDistrict, actions) })}${renderToday(calendarView, state, actions)}<section class="intent-entry"><div><span class="eyebrow">SIRADAKİ HAMLE SANA BAĞLI</span><h3>Neyi değiştirmek istersin?</h3></div><button class="secondary" data-intent-open aria-expanded="${intentOpen}">${intentOpen ? "Seçenekleri kapat" : "Hamlelerini keşfet ↗"}</button></section>${intentOpen ? renderIntentComposer({ ...intentFilters, fallbackActions: actions.filter((a) => !a.disabled), results: getIntentActions(state, { query: intentFilters.query, npcId: intentFilters.npcId, location: intentFilters.location }), npcs: [...NPCS, ...lifeView.secondary], districts: DISTRICTS, actionCard }) : ""}<details class="city-news-fold"><summary>Şehrin nabzı ve sana ulaşan haberler</summary>${renderWorldBulletin(livingView)}</details>`;
}

function renderWork() {
  const job = state.job && lookup(JOBS, state.job.id);
  return `${sectionHeader("EMEK & İLERLEME", "Bir işten, bir kariyere.", "Yeterliliklerini geliştir, başvurunu yap ve vardiyalarını planla. İşe alım koşullara bağlıdır.")}<section class="status-sheet"><div><span class="eyebrow">${job ? "MEVCUT SÖZLEŞME" : "İŞ ARAMA DURUMU"}</span><h3>${esc(job ? job.levels?.[state.job.level] || title(job) : "Yeni bir kapı aç")}</h3><p>${esc(job ? job.description : "Başvuru için ilandaki semtte ve mesai saatlerinde bulun. Eksik becerilerini Gelişim bölümünden tamamlayabilirsin.")}</p></div>${job ? `<div class="sheet-stats"><span>Seviye <b>${state.job.level + 1}</b></span><span>Vardiya <b>${state.job.shifts}</b></span><span>Performans <b>${state.job.performance}</b></span><span>Birikmiş maaş <b>${money(state.job.earned)}</b></span><span>Ödeme günü <b>${state.job.payDay}. gün</b></span></div>` : ""}</section>${renderEmployer(lifeView, actions, actionCard)}${renderCareer(deepView.career)}${renderFreelance(deepView.freelance)}${actionList("work")}<details class="reference"><summary>Meslek rehberi · ${JOBS.length} seçenek</summary><div class="reference-grid">${JOBS.map((j) => `<article><h3>${esc(title(j))}</h3><span class="eyebrow">${esc(districtName(j.district))}</span><p>${esc(j.description)}</p>${j.wage ? `<p class="tiny">Temel vardiya ücreti: ${money(j.wage)}</p>` : ""}</article>`).join("")}</div></details>`;
}
function renderLife() {
  const home = lookup(HOMES, state.housing.id);
  return `${sectionHeader("BİR EV, BİR DÜZEN", "Kendine iyi bak.", "Tokluk ve enerji günlük kararlarını etkiler. Dinlenmek de bir hamledir.")}<section class="status-sheet"><div><span class="eyebrow">YAŞADIĞIN YER</span><h3>${esc(title(home) || "Geçici barınma")}</h3><p>${esc(home?.description || "Kalıcı bir eve geçmek için koşulları tamamla.")}</p></div><div class="sheet-stats"><span>Aylık kira <b>${money(state.housing.rent)}</b></span><span>Sonraki ödeme <b>${state.housing.dueDay}. gün</b></span><span>Gecikmiş kira <b>${money(state.housing.arrears)}</b></span><span>Depozito <b>${money(state.housing.deposit)}</b></span></div></section>${renderHousehold(lifeView, actions, actionCard, householdChoice)}${renderLivingEconomy(livingView, "household")}${renderNeedsActions()}`;
}
function needRow(a) {
  return `<article class="need-row ${a.disabled ? "unavailable" : ""}"><div class="need-label"><h3>${esc(a.label)}</h3><span>${esc(duration(a.minutes))} · ${a.cost ? money(a.cost) : "Ücretsiz"}</span></div><button class="secondary need-choose" data-action="${esc(a.id)}" data-focus="action:${esc(a.id)}" aria-label="${esc(a.label)}" ${a.disabled ? "disabled" : ""}>${a.disabled ? "Uygun değil" : "Seç →"}</button><details class="need-details"><summary>${a.disabled ? "Eksik koşulları gör" : "Süre ve sonuçlar"}</summary><p>${esc(a.description)}</p>${a.disabled ? `<p class="action-reason">${esc(a.reason)}</p>` : ""}</details><button class="text-button need-preview" data-preview="${esc(a.id)}" aria-label="${esc(a.label)} için sonuç öngörüsü">Öngörü ↗</button></article>`;
}
function renderNeedsActions() {
  const all = actions.filter((a) => a.category === "life");
  const everyday = new Set([
    "cook",
    "eat",
    "soup",
    "snack",
    "rest",
    "sleep",
    "exercise",
    "medicine",
    "doctor",
    "wait:15",
    "wait",
  ]);
  const groups = [
    ["Şimdi kendine bak", all.filter((a) => everyday.has(a.id))],
    ["Alışveriş ve ev düzeni", all.filter((a) => !everyday.has(a.id))],
  ];
  return groups
    .map(
      ([name, items]) =>
        `<section class="needs-action-group"><div class="subheading"><h3>${name}</h3><span class="tiny">${items.filter((a) => !a.disabled).length} uygun seçenek</span></div><div class="action-grid">${items.map(needRow).join("")}</div></section>`,
    )
    .join("");
}
function renderPeople() {
  const secondary = lifeView.secondary.find((n) => n.id === selectedNpc);
  if (secondary)
    return `${sectionHeader("TELEFON & SOSYAL ÇEVRE", "Tanışıklıklar hayata karışır.", "Burada yalnızca sana anlatılan ve birlikte yaşadığınız bilgiler var.")}${renderSecondaryContacts(lifeView, selectedNpc)}${renderSecondaryProfile(secondary, actions, actionCard)}${renderSocietyProfile(societyView, selectedNpc, actions)}<button class="secondary" data-npc="${NPCS[0].id}">Diğer kişilere dön ↗</button>`;
  const npc = lookup(NPCS, selectedNpc) || NPCS[0];
  selectedNpc = npc.id;
  const deepNpc = deepView.npcs.find((n) => n.id === npc.id);
  const publicNpc = livingView.npcs.find((n) => n.id === npc.id);
  const rel = state.npcs[npc.id],
    loc = getNpcLocation(state, npc.id);
  const appointmentIds = state.appointments.filter((a) => a.npcId === npc.id).map((a) => a.id);
  const promiseIds = deepView.promises.filter((p) => p.npcId === npc.id).map((p) => p.id);
  const roleActionIds = new Set(
    lifeView.relationships.find((n) => n.id === npc.id)?.actionIds || [],
  );
  const theirs = actions.filter(
    (a) =>
      a.category === "social" &&
      !roleActionIds.has(a.id) &&
      (a.id.split(":").includes(npc.id) ||
        appointmentIds.some((id) => a.id.split(":").includes(id)) ||
        promiseIds.some((id) => a.id.endsWith(`:${id}`))),
  );
  const community = actions.filter(
    (a) =>
      a.category === "social" &&
      !lifeView.secondary.some((n) => a.npcId === n.id || a.id.split(":").includes(n.id)) &&
      !NPCS.some((n) => a.id.split(":").includes(n.id)) &&
      !state.appointments.some((p) => a.id.split(":").includes(p.id)) &&
      !deepView.promises.some((p) => a.id.endsWith(`:${p.id}`)),
  );
  return `${sectionHeader("TELEFON & SOSYAL ÇEVRE", "Kimse seni unutmaz.", "Bir görüşme, tutulan bir söz, zor bir gün. İlişkilerin ortak geçmişinizle değişir.")}${renderHabits(emergentView, "contacts")}${renderSecondaryContacts(lifeView, selectedNpc)}${renderNetwork(livingView.npcs, state, selectedNpc)}<div class="people-layout"><div class="contact-list" aria-label="Kişiler">${NPCS.map(
    (n) => {
      const r = state.npcs[n.id];
      return `<button class="contact ${selectedNpc === n.id ? "active" : ""}" data-npc="${esc(n.id)}" aria-pressed="${selectedNpc === n.id}"><span class="contact-avatar">${esc(initials(title(n)))}</span><span><strong>${esc(title(n))}</strong><small>${esc(n.role || n.description)}</small><em>${getNpcLocation(state, n.id) === state.location ? "Çevrende" : "Telefonla ulaş"}${r.romance > 0 ? " · Yakınlık" : ""}</em></span><span class="contact-score">${Math.round(r.affinity)}</span></button>`;
    },
  ).join(
    "",
  )}</div><section class="contact-detail"><div class="profile-head" tabindex="-1"><span class="contact-avatar large">${esc(initials(title(npc)))}</span><div><span class="eyebrow">${esc(npc.role || "ŞEHİR SAKİNİ")}</span><h3>${esc(title(npc))}</h3><p>${loc === state.location ? `${esc(districtName(loc))} · Aynı semttesiniz` : "Uygun bir zaman için görüşme öner"}</p></div></div><p>${esc(npc.description)}</p>${state.flags.partner === npc.id ? badge("Birliktesiniz", "positive") : ""}${renderPublicNpc(publicNpc, deepNpc)}${renderSocietyProfile(societyView, npc.id, actions)}${renderRoles(lifeView, npc.id, actions, actionCard)}<div class="relationship-stats">${meter("Arkadaşlık", rel.affinity)}${meter("Güven", rel.trust)}${meter("Romantik yakınlık", rel.romance)}</div>${rel.mood !== undefined ? `<p class="tiny">Ruh hâli: ${esc(typeof rel.mood === "number" ? Math.round(rel.mood) : rel.mood)}</p>` : ""}<div class="memory-note"><span class="eyebrow">ORTAK HAFIZANIZ</span>${
    rel.memories?.length
      ? `<ul>${rel.memories
          .slice(-4)
          .reverse()
          .map((m) => `<li><b>${m.day}. gün</b> ${esc(m.text)}</li>`)
          .join("")}</ul>`
      : "<p>Henüz birlikte bir hikâyeniz yok. İlk adım bir selam olabilir.</p>"
  }</div><div class="action-grid">${theirs.map((a) => actionCard(a, true)).join("")}</div></section></div>${community.length ? `<div class="subheading"><h3>Mahalleye katıl</h3></div><div class="action-grid">${community.map((a) => actionCard(a)).join("")}</div>` : ""}`;
}
function renderStudy() {
  const course = state.course && lookup(COURSES, state.course.id);
  return `${sectionHeader("EĞİTİM & UZMANLAŞMA", "Yarınki kendine yatırım.", "Derslere katıl, becerilerini uygulayarak büyüt ve yeni mesleklerin koşullarını aç.")}${renderHabits(emergentView)}<div class="skills-grid">${SKILLS.map((s) => `<div class="skill-card"><span class="eyebrow">${esc(title(s))}</span><strong>${Math.round(state.player.skills[s.id] || 0)}<small>/100</small></strong><progress max="100" value="${state.player.skills[s.id] || 0}" aria-label="${esc(title(s))}"></progress><p>${esc(s.description)}</p></div>`).join("")}</div>${course ? `<div class="status-sheet"><div><span class="eyebrow">DEVAM EDEN EĞİTİM</span><h3>${esc(title(course))}</h3><p>${state.course.sessions} ders tamamlandı. ${esc(course.description)}</p></div></div>` : ""}${actionList("education")}`;
}
function renderWallet() {
  return `${sectionHeader("HESAPLAR & SORUMLULUKLAR", "Paranın bir hikâyesi var.", "Nakit ile banka bakiyesi ayrıdır. Maaş, kira, faturalar ve faiz aynı takvimde işler.")}<div class="balance-grid"><article><span>Nakit</span><strong>${money(state.cash)}</strong></article><article><span>Banka</span><strong>${money(state.bank)}</strong></article><article class="debt"><span>Kredi borcu</span><strong>${money(state.debt)}</strong></article></div>${renderFinance(deepView.finance)}${actionList("finance")}<section class="ledger"><div class="subheading"><h3>Hesap hareketleri</h3><span class="tiny">Son ${Math.min(state.transactions.length, 30)} işlem</span></div>${
    state.transactions.length
      ? `<div class="transaction-list">${state.transactions
          .slice(-30)
          .reverse()
          .map(
            (t) =>
              `<div><span><strong>${esc(t.label)}</strong><small>${t.day}. gün · ${esc(t.account === "bank" ? "Banka" : t.account === "cash" ? "Nakit" : t.account === "debt" ? "Borç" : t.account === "arrears" ? "Gecikmiş kira" : t.account === "business" ? "İşletme kasası" : t.account === "household" ? "Ortak ev / emanet hesap" : "Hesap")}</small></span><b class="${t.amount >= 0 ? "income" : "expense"}">${t.amount > 0 ? "+" : ""}${money(t.amount)}</b></div>`,
          )
          .join("")}</div>`
      : '<p class="empty-state">İlk hesap hareketin burada görünecek.</p>'
  }</section>`;
}
function renderBag() {
  const inventory = Object.entries(state.inventory).filter(([, count]) => count > 0);
  return `${sectionHeader("EŞYALAR & BELGELER", "Yanında taşıdıkların.", "Aldığın eşyalar kullanılabilir. Belgelerin, imzaladığın sözleşmeler ve başarıların kalıcı kaydını tutar.")}<div class="inventory-grid">${
    inventory
      .map(([id, count]) => {
        const item = lookup(ITEMS, id);
        return `<article class="inventory-card"><span class="inventory-symbol" aria-hidden="true">▱</span><span class="badge">× ${count}</span><h3>${esc(title(item) || id)}</h3><p>${esc(item?.description || "Envanterindeki eşya.")}</p>${actions
          .filter(
            (a) =>
              a.category === "life" &&
              a.id === { groceries: "cook", snack: "snack", medicine: "medicine" }[id],
          )
          .map(
            (a) =>
              `<button class="secondary" data-action="${esc(a.id)}" ${a.disabled ? "disabled" : ""}>${esc(a.label)}</button>${a.disabled ? `<p class="tiny">${esc(a.reason)}</p>` : ""}`,
          )
          .join("")}</article>`;
      })
      .join("") ||
    '<p class="empty-state">Çantan boş. Yaşam bölümünden ihtiyaçlarını alabilirsin.</p>'
  }</div><div class="subheading"><h3>Belge dosyan</h3><span class="tiny">${state.documents.length} belge</span></div><div class="documents">${state.documents.map((d) => `<details class="document"><summary><span class="document-stamp">TC</span><span><strong>${esc(d.title)}</strong><small>${d.day}. gün · Kişisel arşiv</small></span><span aria-hidden="true">＋</span></summary><p>${esc(d.text)}</p></details>`).join("") || '<p class="empty-state">Sözleşme ve sertifikaların burada saklanacak.</p>'}</div>`;
}
function renderGoals() {
  return `${sectionHeader("YAŞAM HEDEFLERİ", "İyi bir hayatın tek tarifi yok.", "Hedeflerini kendi hızında tamamla. Başardıktan sonra şehirde yaşamaya devam edebilirsin.")}<div class="goal-grid">${getGoals(
    state,
  )
    .map(
      (g, i) =>
        `<article class="goal-card ${g.complete ? "complete" : ""}"><span class="goal-number">0${i + 1}</span>${badge(g.complete ? "Tamamlandı" : "Yolculuk sürüyor", g.complete ? "positive" : "")}<h3>${esc(g.title)}</h3><p>${esc(g.description)}</p><progress value="${Math.max(0, Math.min(g.current, g.target))}" max="${Math.max(1, g.target)}" aria-label="${esc(g.title)}"></progress><div class="goal-progress">${esc(g.current)} / ${esc(g.target)} <span>${Math.round(Math.min(1, g.current / Math.max(1, g.target)) * 100)}%</span></div></article>`,
    )
    .join(
      "",
    )}</div><div class="subheading"><h3>Kazandığın izler</h3></div><div class="achievement-list">${state.achievements.length ? state.achievements.map((a) => badge(getGoals(state).find((g) => g.id === a)?.title || achievementNames[a] || a, "positive")).join("") : '<p class="muted">Tamamladığın yaşam hedefleri burada birikecek.</p>'}</div>`;
}
function appointmentOptions() {
  const { kind, npcId, subjectId, day, venue, duration, repeat } = appointmentDraft;
  return getAppointmentOptions(state, {
    kind,
    npcId,
    subjectId,
    day,
    venue,
    duration,
    repeat,
    ...(editingEntry ? { ignoreId: editingEntry } : {}),
  });
}
function normalizeAppointmentDraft() {
  const day = getClock(state).day;
  appointmentDraft ||= {
    kind: "meeting",
    npcId: NPCS.some((n) => n.id === selectedNpc) ? selectedNpc : NPCS[0].id,
    subjectId: "",
    day: calendarDay || day,
    minute: Math.min(1320, Math.ceil(((state.time % 1440) + 60) / 30) * 30),
    venue: "",
    duration: 60,
    repeat: "none",
  };
  const draft = appointmentDraft;
  draft.day = Math.max(day, Math.min(day + 14, draft.day));
  const subjects = calendarView.subjects.filter((x) => x.kind === draft.kind);
  if (draft.kind !== "meeting" && !subjects.some((x) => x.id === draft.subjectId))
    draft.subjectId = subjects[0]?.id || "";
  if (draft.kind === "meeting") {
    draft.subjectId = "";
    if (!NPCS.some((n) => n.id === draft.npcId)) draft.npcId = NPCS[0].id;
  } else draft.npcId = "";
  const subject = subjects.find((x) => x.id === draft.subjectId);
  if (subject?.duration) draft.duration = subject.duration;
  if (["meeting", "personal"].includes(draft.kind)) draft.duration = Math.min(120, draft.duration);
  if (!["personal", "class", "shift"].includes(draft.kind)) draft.repeat = "none";
  const configured = appointmentOptions();
  const venueKind = {
    meeting: "meeting",
    interview: "work",
    shift: "work",
    class: "class",
    personal: "personal",
  }[draft.kind];
  const availableVenues = configured.venues.filter(
    (v) => v.kind === venueKind && (!subject?.district || v.district === subject.district),
  );
  if (!availableVenues.some((v) => v.id === draft.venue))
    draft.venue =
      availableVenues.find((v) => v.district === (subject?.district || state.location))?.id ||
      availableVenues[0]?.id ||
      "";
  const result = appointmentOptions();
  if (!result.slots.some((x) => x.minute === draft.minute))
    draft.minute = (result.slots.find((x) => x.available) || result.slots[0])?.minute ?? 600;
  return { ...result, venues: availableVenues };
}
function renderPlan() {
  const slotOptions = normalizeAppointmentDraft();
  return `${sectionHeader("AJANDA / GÜNLÜK DÜZEN", "Zamanın sende kalsın.", "Küçük işleri planına bırak; önemli kararlarda kontrolü al.")}${renderRoutineRecovery(decisionView, actions, state.deep.finance.debtPlan)}${renderPolicies(emergentView, actions)}${renderPlanning({ ...deepView.schedule, promises: deepView.promises }, { state, clock: getClock(state), stories: storyViews, npcs: NPCS, districtName, hideTimeline: true }, actions, actionCard)}${renderToday(calendarView, state, actions)}${renderCalendar({ view: calendarView, state, actions, mode: calendarMode, draft: appointmentDraft, slots: slotOptions, editing: editingEntry, npcs: NPCS, stories: storyViews })}`;
}

let projectType = "qualification",
  projectAction = "";
function renderProjectPanel() {
  return `${sectionHeader("PROJELER / BİRİKEN KARARLAR", "Bir hayat, küçük adımlarla.", "Bütçeni ve hedef gününü seç. İlerlemen gerçek derslerden, işlerden, ilişkilerden ve taşınmalardan doğar.")}${renderProjects(livingView, actions, actionCard, projectType, projectAction)}`;
}

function renderEnterprise() {
  return `${sectionHeader("GİRİŞİM & MÜŞTERİLER", "Kendi masanın başına geç.", "Bir işletmenin geliri kadar yükü de gerçektir. Müşterilerin, itibarın ve sabit giderlerin aynı hesapta buluşur.")}${deepView.freelance.active ? renderFreelance(deepView.freelance) : ""}${renderLivingEconomy(livingView, "enterprise")}${renderBusiness(deepView.business, actions, actionCard)}`;
}
function renderStories() {
  return `${sectionHeader("BAĞLANTILI YAŞAM HİKÂYELERİ", "Bir karar burada bitmez.", "Tanışmalar, iş fırsatları ve krizler birkaç gün boyunca büyür. Önceki seçimin sonraki kartı değiştirir.")}${renderSocietyOffers(societyView, actions)}${renderSystemicEvents(emergentView, actions, actionCard)}${renderStoryCards(storyViews, actions, actionCard)}${renderCausalHistory(emergentView)}`;
}
function renderLog() {
  return `${sectionHeader("HATIRALAR & ŞEHİR HABERLERİ", "Her kararın bir izi kalır.", "En yeni kayıt en üstte. Günlük, sonuçları ve dünyadaki değişimleri birlikte saklar.")}${renderSocietyChronology(societyView, actions)}${renderCausalHistory(emergentView)}<div class="journal-grid"><section><h3>Senin hikâyen</h3><ol class="journal-list">${state.history
    .slice(-80)
    .reverse()
    .map(
      (h) =>
        `<li><span>${h.day}. gün <b>${esc(clockText(h.time))}</b></span><p>${esc(h.text)}</p></li>`,
    )
    .join(
      "",
    )}</ol></section><section class="news-column"><span class="eyebrow">ŞEHRİN NABZI</span><h3>İstanbul'dan notlar</h3>${
    state.world.news
      .slice(-15)
      .reverse()
      .map(
        (n) =>
          `<article class="news-item"><small>${n.day}. gün</small><p>${esc(n.text)}</p></article>`,
      )
      .join("") || '<p class="muted">Şehirde yeni bir gelişme olduğunda burada görünecek.</p>'
  }</section></div>`;
}
function renderAgenda() {
  const clock = getClock(state),
    upcoming = calendarView.entries
      .filter((a) => ["confirmed", "counter"].includes(a.status) && a.end >= state.time)
      .map((a) => ({
        ...a,
        day: Math.floor(a.start / 1440) + 1,
        minute: a.start % 1440,
        location: a.district,
      }))
      .sort((a, b) => a.start - b.start);
  return `<aside class="daybook"><section class="daybook-section"><div class="subheading"><span class="eyebrow">GÜNÜN RİTMİ</span><span class="day-count">${clock.day}. GÜN</span></div><div class="week-strip">${Array.from({ length: 7 }, (_, i) => `<div class="${i === 0 ? "today" : ""}"><small>${i === 0 ? "BUGÜN" : i === 1 ? "YARIN" : `+${i} GÜN`}</small><b>${clock.day + i}</b>${upcoming.some((a) => a.day === clock.day + i) || state.housing.dueDay === clock.day + i || state.job?.payDay === clock.day + i ? "<i></i>" : ""}</div>`).join("")}</div><ul class="agenda-list">${state.job ? `<li><span class="agenda-icon">▤</span><div><strong>${esc(lookup(JOBS, state.job.id)?.levels?.[state.job.level] || title(lookup(JOBS, state.job.id)))}</strong><small>${state.job.lastWorkDay === clock.day ? "Bugünkü vardiya tamamlandı" : "Vardiya saatlerini Kariyer bölümünde gör"}</small></div></li>` : `<li><span class="agenda-icon">↗</span><div><strong>İlk fırsatını bul</strong><small>İlanları incele; aynı semtte başvur.</small></div></li>`}<li><span class="agenda-icon">⌂</span><div><strong>Kira · ${money(state.housing.rent)}</strong><small>${state.housing.dueDay}. gün${state.housing.arrears ? " · Gecikmiş ödeme var" : ""}</small></div></li>${upcoming
    .slice(0, 3)
    .map(
      (a) =>
        `<li><span class="agenda-icon">◎</span><div><strong>${esc(a.title || title(lookup(NPCS, a.npcId)))}</strong><small>${a.day}. gün ${String(Math.floor(a.minute / 60)).padStart(2, "0")}:${String(a.minute % 60).padStart(2, "0")} · ${esc(districtName(a.location))}</small></div></li>`,
    )
    .join(
      "",
    )}</ul><button class="text-button" data-tab="plan">Ajanda & rutinler →</button></section><section class="daybook-section"><span class="eyebrow">KARAKTER KARTI</span><div class="character-summary"><span class="player-token big">${esc(initials(state.player.name))}</span><div><h3>${esc(state.player.name)}</h3><p>${esc(title(lookup(TRAITS, state.player.trait)))} · ${esc(title(lookup(EDUCATIONS, state.player.education)))}</p></div></div><div class="mini-skills">${SKILLS.map((s) => `<span>${esc(title(s))}<b>${Math.round(state.player.skills[s.id] || 0)}</b></span>`).join("")}</div><button class="text-button" data-tab="study">Kendini geliştir →</button></section><section class="daybook-section"><div class="subheading"><span class="eyebrow">SON HAMLE</span><button class="text-button" data-tab="log">Günlük ↗</button></div><p class="last-entry">${esc(state.history.at(-1)?.text || "Hayatın ilk sayfası açıldı.")}</p></section><p class="save-state" role="status">${esc(saveStatus || "Her hamleden sonra otomatik kayıt")}</p></aside>`;
}
function renderObligations() {
  const next = calendarView.nextEvent;
  return `<div class="obligation-rail" aria-label="Konum ve sıradaki sorumluluklar"><span class="rail-location">◈ ${esc(districtName(state.location))}</span><button data-tab="plan">${next ? `${esc(next.timeLabel)} · ${esc(next.label)}` : "Bugünün planını kur"} ↗</button><button data-tab="wallet">Kira ${state.housing.dueDay}. gün · ${money(state.housing.rent)}</button></div>`;
}
// Resolver states are immutable. Reuse public views during menu/selection changes only.
let viewState = null,
  viewCache = new Map();
function cachedView(key, factory) {
  if (viewState !== state) {
    viewState = state;
    viewCache = new Map();
  }
  if (!viewCache.has(key)) viewCache.set(key, factory());
  return viewCache.get(key);
}
function renderGame() {
  actions = cachedView("actions", () => getActions(state));
  if (["board", "plan", "people", "stories", "log"].includes(tab))
    societyView = cachedView("society", () => getSocietyView(state));
  if (["board", "plan"].includes(tab))
    decisionView = cachedView("decision", () =>
      getDecisionView(state, { actions, society: societyView }),
    );
  storyViews = cachedView("stories", () => getStoryView(state));
  emergentView = cachedView("emergent", () => getEmergentView(state));
  if (["plan", "enterprise", "work", "people", "wallet"].includes(tab))
    deepView = cachedView("deep", () => getDeepView(state));
  if (["board", "projects", "enterprise", "life", "people"].includes(tab))
    livingView = cachedView("living", () => getLivingView(state));
  if (["board", "life", "people", "work"].includes(tab))
    lifeView = cachedView("life", () => getLifeView(state));
  if (tab === "board") cityView = cachedView("city", () => getCityView(state));
  calendarDay = Math.max(getClock(state).day, calendarDay || getClock(state).day);
  calendarView = cachedView(`calendar:${calendarDay}`, () =>
    getCalendarView(state, { day: calendarDay }),
  );
  calendarDay = calendarView.day;
  const clock = getClock(state),
    panels = {
      board: renderBoard,
      plan: renderPlan,
      projects: renderProjectPanel,
      enterprise: renderEnterprise,
      stories: renderStories,
      work: renderWork,
      life: renderLife,
      people: renderPeople,
      study: renderStudy,
      wallet: renderWallet,
      bag: renderBag,
      goals: renderGoals,
      log: renderLog,
    };
  app.innerHTML = `<div class="game-shell edition-four edition-five"><header class="topbar"><${embedded ? "span" : "a"} ${embedded ? "" : 'href="/" target="_top" aria-label="TarikLab oyunlarına dön"'} class="game-brand"><span class="brand-seal small">TC</span><span>SIM <b>BOARDWORLD</b></span></${embedded ? "span" : "a"}><div class="clock-block"><span class="eyebrow">${esc(clock.date)} · ${esc(clock.weekday)}</span><strong>${esc(clock.time)} <small>${esc(state.world.weather)}</small></strong></div><div class="top-actions">${languageControl()}<button class="icon-button" data-ui="save" aria-label="Oyunu kaydet" title="Oyunu kaydet">↓<span>Kaydet</span></button><button class="icon-button" data-ui="menu" aria-label="Oyun menüsü" title="Oyun menüsü">☰</button></div></header><div class="resource-bar"><div class="cash-resource"><span>CEBİNDE</span><strong>${money(state.cash)}</strong><button class="text-button" data-tab="wallet">Banka ${money(state.bank)} ↗</button></div><div class="needs">${meter("Sağlık", state.player.health)}${meter("Enerji", state.player.energy)}${meter("Tokluk", state.player.hunger)}${meter("Stres", state.player.stress, true)}</div><div class="location-chip"><span class="eyebrow">KONUMUN</span><strong>${esc(districtName(state.location))}</strong></div></div>${renderObligations()}<nav class="game-tabs" aria-label="Oyun bölümleri">${tabDefs.map(([id, label, icon]) => `<button data-tab="${id}" class="${tab === id ? "active" : ""}" aria-current="${tab === id ? "page" : "false"}"><span aria-hidden="true">${icon}</span>${label}${id === "plan" && calendarView.entries.some((a) => a.status === "confirmed" || a.status === "counter") ? "<i></i>" : ""}</button>`).join("")}</nav><div class="play-layout"><main id="main" class="play-main">${lastOutcome ? `<section class="outcome-strip" aria-label="Hamle sonucu"><span class="outcome-check">✓</span><div><strong>${esc(lastOutcome.message)}</strong><p>${esc(lastOutcome.delta)}</p></div><button class="icon-button" data-ui="dismiss-outcome" aria-label="Sonucu kapat">×</button></section>` : ""}${renderEvent()}${tab !== "stories" ? renderSystemicEvents(emergentView, actions, actionCard, { compact: true }) + renderStoryPrompt(storyViews) : ""}${panels[tab]()}</main>${renderAgenda()}</div><footer class="game-footer"><span>TC SIM: BOARDWORLD</span><span>Kararlar sende. Hikâye şehirde.</span><button class="text-button" data-ui="help">Oyun rehberi</button></footer></div>`;
}
function render({ focus = null } = {}) {
  const active = document.activeElement;
  const focusKey = focus || active?.dataset?.focus;
  const x = window.scrollX,
    y = window.scrollY;
  if (state) renderGame();
  else renderStart();
  markOriginalRecords(app);
  localizeTree(app);
  if (focusKey) {
    const target = [...app.querySelectorAll("[data-focus]")].find(
      (el) => el.dataset.focus === focusKey && !el.disabled,
    );
    (target || $("#panel-heading"))?.focus({ preventScroll: true });
  }
  window.scrollTo(x, y);
}
function commit(id, payload) {
  if (!state || busy) return;
  busy = true;
  try {
    const before = state,
      result = resolveAction(state, id, payload);
    if (!result.ok) {
      announce(result.message, true);
      return result;
    }
    state = result.state;
    if (id === "calendar:propose" || id.startsWith("calendar:reschedule:")) {
      const entry = state.calendar.entries.at(-1);
      if (entry) calendarDay = Math.floor(entry.start / 1440) + 1;
    }
    const deltas = [];
    if (state.time !== before.time) deltas.push(`+${duration(state.time - before.time)}`);
    if (state.cash !== before.cash)
      deltas.push(`Nakit ${state.cash > before.cash ? "+" : ""}${money(state.cash - before.cash)}`);
    if (state.bank !== before.bank)
      deltas.push(`Banka ${state.bank > before.bank ? "+" : ""}${money(state.bank - before.bank)}`);
    for (const [key, label] of [
      ["energy", "Enerji"],
      ["hunger", "Tokluk"],
      ["stress", "Stres"],
      ["health", "Sağlık"],
    ]) {
      const diff = Math.round(state.player[key] - before.player[key]);
      if (diff) deltas.push(`${label} ${diff > 0 ? "+" : ""}${diff}`);
    }
    lastOutcome = {
      message: result.message,
      delta: deltas.join(" · ") || "Kararın hikâyene kaydedildi.",
    };
    const saved = saveGame(state);
    saveStatus =
      saved.message || (saved.ok ? "Otomatik kaydedildi" : "Kayıt yapılamadı; dosyaya indir.");
    if (state.location !== before.location) selectedDistrict = state.location;
    render({ focus: `action:${id}` });
    announce(saved.ok ? result.message : `${result.message} ${saved.message}`, !saved.ok);
    return result;
  } catch (error) {
    announce(`Hamle tamamlanamadı: ${error.message}`, true);
  } finally {
    busy = false;
  }
}
function showLocalizedDialog() {
  markOriginalRecords(dialog);
  localizeTree(dialog);
  if (!dialog.open) dialog.showModal();
}
function openDialog(kind) {
  const content = {
    character: state
      ? `<span class="eyebrow">KARAKTER KARTIN</span><h2 id="dialog-title" data-person-name>${esc(state.player.name)}</h2><p>${esc(title(lookup(TRAITS, state.player.trait)))} · ${esc(title(lookup(EDUCATIONS, state.player.education)))}</p><div class="life-metrics">${SKILLS.map((s) => `<div><span>${esc(title(s))}</span><strong>${Math.round(state.player.skills[s.id])} / 100</strong></div>`).join("")}</div><p class="tiny">${esc(title(lookup(HOMES, state.housing.id)))} · ${esc(districtName(state.location))}</p>`
      : "",
    menu: `<span class="eyebrow">OYUN MASASI</span><h2 id="dialog-title">Biraz ara verebilirsin.</h2><p>Her başarılı hamlede kayıt alınır. Dosya yedeği, farklı bir cihazda da kaldığın yerden devam etmeni sağlar.</p><div class="menu-actions"><button class="primary" data-ui="save">Şimdi kaydet</button><button class="secondary" data-ui="export">Kayıt dosyasını indir</button><button class="secondary" data-ui="import">Kayıt dosyası yükle</button><button class="secondary" data-ui="character">Karakter kartın</button><button class="secondary" data-ui="help">Oyun rehberi</button><button class="text-button danger" data-ui="restart">Yeni bir hayat başlat</button></div><p class="tiny">${esc(saveStatus)}</p>`,
    restart: `<span class="eyebrow">YENİ BAŞLANGIÇ</span><h2 id="dialog-title">Yeni bir hayat?</h2><p>Yeni karakteri oluşturduğunda mevcut otomatik kaydın yerini alır. İstersen önce kayıt dosyanı indir.</p><div class="menu-actions"><button class="secondary" data-ui="export">Mevcut kaydı indir</button><button class="primary" data-ui="confirm-restart">Karakter oluşturmaya geç</button><button class="secondary" data-ui="close">Vazgeç</button></div>`,
    help: `<span class="eyebrow">MASANIN KURALLARI</span><h2 id="dialog-title">İlk günün için bir rehber.</h2><ol class="help-steps"><li><strong>Şehri tanı.</strong> Tahtada bir semti seç. Ulaşım kartında süre ve bedeli gör; hareket etmek için kartı seç.</li><li><strong>Bir iş bul.</strong> Kariyer ekranında koşulları oku. İlanın olduğu semte git, başvur. İşe alım ve maaş, beceri ve emeğine bağlıdır.</li><li><strong>Kendine bak.</strong> Yaşam ekranından yemek, dinlenme, sağlık ve konut kararlarını ver. Tokluk ve enerji yüksek, stres düşük olduğunda işler kolaylaşır.</li><li><strong>Sözünü tut.</strong> Telefonundaki kişiler günlük rutinlerini sürdürür. Görüş, arayıp hatır sor, buluşma planla. Takvimindeki saat ve semte dikkat et.</li><li><strong>Bir yön seç.</strong> Gelişimden eğitim al, Cüzdandan hesaplarını yönet. Hedefler ilerlemeni gösterir; onları tamamlayınca da oyun sürer.</li></ol><div class="rule-note"><strong>Bir zaman öner, sonucu önceden gör.</strong><p>Ajandada kişi, gün, saat ve mekân seç. Karşı teklifleri kabul et; ulaşımı ve çakışmaları hesaba kat. Projeler gerçek eylemlerinle ilerler. Şehir tahtasındaki Hamlelerini keşfet düğmesi desteklenen seçenekleri bulur. Ajanda ile çalışma ve bakım rutinlerini seç. Rutin yeni olaylarda durur. Öngörü, bir kararın zamanını, hesaplarını ve risklerini açıklar. Hikâyeler bölümündeki çok aşamalı zincirler eski seçimlerini hatırlar. Telefon rehberindeki ilişki haritası, insanların birbirinden ne duyabileceğini gösterir.</p></div><div class="rule-note"><strong>Zaman senin elinde.</strong><p>Menülerde gezinmek zaman harcamaz. Her eylemin süre ve maliyeti kartında yazar. Bazı belirsiz karşılaşmalarda zar kullanılır; iş, ders ve maaş zar değildir.</p></div><p class="tiny">Oyun ekonomisi tasarlanmış bir simülasyondur; gerçek fiyatları veya finansal tavsiyeyi temsil etmez. Kayıt yalnızca bu tarayıcıdadır. Ses kapalıdır.</p>`,
  };
  dialog.innerHTML = `<div class="dialog-inner"><button class="dialog-close icon-button" data-ui="close" aria-label="Pencereyi kapat">×</button>${content[kind] || content.menu}</div>`;
  showLocalizedDialog();
}
function handleUi(id) {
  if (id === "menu" || id === "restart" || id === "help" || id === "character") {
    openDialog(id);
    return;
  }
  if (id === "close") {
    dialog.close();
    return;
  }
  if (id === "save" && state) {
    const result = saveGame(state);
    saveStatus = result.message;
    announce(result.message, !result.ok);
    if (!dialog.open) render();
    return;
  }
  if (id === "export" && state) {
    try {
      const blob = new Blob([exportGame(state)], { type: "application/json" }),
        url = URL.createObjectURL(blob),
        link = document.createElement("a");
      link.href = url;
      link.download = `tc-sim-boardworld-gun-${getClock(state).day}.json`;
      link.click();
      URL.revokeObjectURL(url);
      announce("Kayıt dosyan indirildi.");
    } catch (error) {
      announce(`Kayıt indirilemedi: ${error.message}`, true);
    }
    return;
  }
  if (id === "import") {
    $("#import-file").click();
    return;
  }
  if (id === "confirm-restart") {
    dialog.close();
    state = null;
    lastOutcome = null;
    render();
    $("#character-name")?.focus();
    return;
  }
  if (id === "dismiss-outcome") {
    lastOutcome = null;
    render();
  }
}
function readAppointmentForm(form) {
  const data = new FormData(form),
    kind = String(data.get("kind") || "meeting");
  return {
    kind,
    npcId: kind === "meeting" ? String(data.get("npcId") || "") : "",
    subjectId: kind === "meeting" ? "" : String(data.get("subjectId") || ""),
    day: Number(data.get("day")),
    minute: Number(data.get("minute")),
    venue: String(data.get("venue") || ""),
    duration: Number(data.get("duration") || appointmentDraft?.duration || 60),
    repeat: String(data.get("repeat") || "none"),
  };
}
function handleLivingControl(button) {
  const data = button.dataset;
  if ("calendarNew" in data || "calendarBrowse" in data) {
    tab = "plan";
    if ("calendarNew" in data) {
      calendarDay = getClock(state).day;
      appointmentDraft = null;
      editingEntry = "";
    }
    render();
    const target = "calendarNew" in data ? $(".calendar-proposal") : $(".calendar-board");
    target?.scrollIntoView({ block: "start" });
    $("calendarNew" in data ? "#appointment-form [name=kind]" : "[data-calendar-mode=day]")?.focus({
      preventScroll: true,
    });
    return true;
  }
  if ("intentOpen" in data) {
    intentOpen = !intentOpen;
    render();
    if (intentOpen) $("#intent-form select")?.focus({ preventScroll: true });
    return true;
  }
  if (data.projectType) {
    projectType = data.projectType;
    projectAction = "";
    render();
    $("#project-form")?.scrollIntoView({ block: "center" });
    $("#project-form [name=action]")?.focus({ preventScroll: true });
    return true;
  }
  if (data.calendarMode) {
    calendarMode = data.calendarMode;
    render();
    return true;
  }
  if (data.calendarDay) {
    calendarDay = Number(data.calendarDay);
    if (appointmentDraft) appointmentDraft.day = calendarDay;
    tab = "plan";
    render();
    return true;
  }
  if (data.calendarWeek) {
    calendarDay = Math.max(getClock(state).day, calendarDay + Number(data.calendarWeek) * 7);
    if (appointmentDraft) appointmentDraft.day = calendarDay;
    render();
    return true;
  }
  if (data.calendarDistrict) {
    selectedDistrict = data.calendarDistrict;
    tab = "plan";
    render();
    return true;
  }
  if ("calendarReset" in data) {
    editingEntry = "";
    appointmentDraft = null;
    render();
    return true;
  }
  if (data.scheduleNpc) {
    selectedNpc = data.scheduleNpc;
    tab = "plan";
    calendarDay = getClock(state).day;
    appointmentDraft = null;
    editingEntry = "";
    render();
    $(".calendar-proposal")?.scrollIntoView({ block: "start" });
    $("#appointment-form [name=npcId]")?.focus({ preventScroll: true });
    return true;
  }
  const entryId =
    data.calendarEdit ||
    (data.action?.startsWith("calendar:reschedule:")
      ? data.action.slice("calendar:reschedule:".length)
      : "");
  if (entryId) {
    const entry = state.calendar.entries.find((e) => e.id === entryId);
    if (!entry) return true;
    editingEntry = entry.id;
    calendarDay = Math.floor(entry.start / 1440) + 1;
    tab = "plan";
    appointmentDraft = {
      kind: entry.kind,
      npcId: entry.npcId,
      subjectId: entry.subjectId,
      day: calendarDay,
      minute: entry.start % 1440,
      venue: entry.venue,
      duration: entry.end - entry.start,
      repeat: entry.recurrenceId ? "weekly" : "none",
    };
    render();
    $(".calendar-proposal")?.scrollIntoView({ block: "start" });
    $("#appointment-form [name=minute]")?.focus({ preventScroll: true });
    return true;
  }
  if ("calendarPreview" in data) {
    const payload = readAppointmentForm($("#appointment-form")),
      id = editingEntry ? `calendar:reschedule:${editingEntry}` : "calendar:propose";
    const forecast = previewAction(state, id, payload),
      action = {
        id,
        label: editingEntry ? "Planını yeniden öner" : "Takvim önerisi",
        description: `${payload.day}. gün ${clockText(payload.minute)} · ${payload.duration} dakika. Uygunluk ve yolculuk aynı takvimde kontrol edilir.`,
      };
    previewPayload = payload;
    dialog.innerHTML = `<div class="dialog-inner forecast-dialog"><button class="dialog-close icon-button" data-ui="close" aria-label="Pencereyi kapat">×</button>${renderPreview(forecast, action)}</div>`;
    showLocalizedDialog();
    return true;
  }
  return false;
}
document.addEventListener("click", (event) => {
  const network = event.target.closest("[data-network-npc]");
  if (network) {
    selectedNpc = network.dataset.networkNpc;
    tab = "people";
    render();
    $(".profile-head")?.focus({ preventScroll: true });
    $(".profile-head")?.scrollIntoView({ block: "start" });
    return;
  }
  const button = event.target.closest("button");
  if (!button || button.disabled) return;
  if (button.dataset.decisionTarget) {
    tab = button.dataset.decisionTarget;
    if (button.dataset.targetNpc) selectedNpc = button.dataset.targetNpc;
    if (button.dataset.targetDistrict) selectedDistrict = button.dataset.targetDistrict;
    if (button.dataset.targetDay) calendarDay = Number(button.dataset.targetDay);
    render();
    const id = button.dataset.targetEvent;
    const destination = id
      ? document.querySelector(
          `[data-systemic="${CSS.escape(id)}"],[data-story="${CSS.escape(id)}"]`,
        )
      : tab === "people"
        ? $(".profile-head")
        : $("#panel-heading");
    destination?.scrollIntoView({ block: "start" });
    destination?.focus({ preventScroll: true });
    return;
  }
  if (handleLivingControl(button)) return;
  if (button.dataset.preview) {
    const action = actions.find((a) => a.id === button.dataset.preview);
    if (!action) return;
    previewPayload = null;
    const forecast = previewAction(state, action.id);
    dialog.innerHTML = `<div class="dialog-inner forecast-dialog"><button class="dialog-close icon-button" data-ui="close" aria-label="Pencereyi kapat">×</button>${renderPreview(forecast, action)}</div>`;
    showLocalizedDialog();
    return;
  }
  if (button.dataset.previewCommit) {
    const id = button.dataset.previewCommit;
    dialog.close();
    const result = commit(id, previewPayload || undefined);
    if (result?.ok && (id === "calendar:propose" || id.startsWith("calendar:reschedule:"))) {
      editingEntry = "";
      render();
    }
    previewPayload = null;
    return;
  }
  if (button.dataset.action) {
    commit(button.dataset.action);
    return;
  }
  if (button.dataset.tab) {
    tab = button.dataset.tab;
    render();
    $("#panel-heading")?.focus({ preventScroll: true });
    $("#panel-heading")?.scrollIntoView({ block: "start" });
    return;
  }
  if (button.dataset.district) {
    selectedDistrict = button.dataset.district;
    render();
    return;
  }
  if (button.dataset.npc) {
    selectedNpc = button.dataset.npc;
    tab = "people";
    render();
    $("#panel-heading")?.focus({ preventScroll: true });
    $("#panel-heading")?.scrollIntoView({ block: "start" });
    return;
  }
  if (button.dataset.ui) handleUi(button.dataset.ui);
});
document.addEventListener("keydown", (event) => {
  if ((event.key === "Enter" || event.key === " ") && event.target.matches("[data-network-npc]")) {
    event.preventDefault();
    event.target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  }
});
document.addEventListener("submit", (event) => {
  if (event.target.id === "appointment-form") {
    event.preventDefault();
    const payload = readAppointmentForm(event.target);
    const id = editingEntry ? `calendar:reschedule:${editingEntry}` : "calendar:propose";
    const result = commit(id, payload);
    if (result?.ok) {
      editingEntry = "";
      render({ focus: "calendar-form" });
    }
    return;
  }
  if (event.target.id === "project-form") {
    event.preventDefault();
    return;
  }
  if (event.target.id === "intent-form") {
    event.preventDefault();
    const data = new FormData(event.target);
    intentFilters = {
      intent: String(data.get("intent") || "all"),
      query: String(data.get("query") || ""),
      npcId: String(data.get("npcId") || ""),
      location: String(data.get("location") || ""),
    };
    render();
    $(".intent-results")?.scrollIntoView({ block: "start" });
    return;
  }
  if (event.target.id !== "create-form") return;
  event.preventDefault();
  const data = new FormData(event.target),
    name = String(data.get("name") || "").trim();
  if (name.length < 2) {
    announce("Karakter adı en az iki harf olmalı.", true);
    $("#character-name").focus();
    return;
  }
  state = createGame({
    name,
    scenario: String(data.get("scenario")),
    education: String(data.get("education")),
    trait: String(data.get("trait")),
    seed: 2026,
  });
  tab = "board";
  calendarDay = null;
  appointmentDraft = null;
  editingEntry = "";
  selectedDistrict = state.location;
  const saved = saveGame(state);
  saveStatus = saved.message;
  render();
  announce(
    "Hayatın başladı. Önce başlangıç olay kartından bir seçim yap; sonra Kariyer bölümündeki işleri incele.",
  );
  $("#panel-heading")?.focus({ preventScroll: true });
});
document.addEventListener("change", (event) => {
  if (event.target.matches("[data-game-language]")) {
    void chooseLanguage(event.target.value);
    return;
  }
  if (event.target.matches("[data-household-choice]")) {
    householdChoice = event.target.value;
    render();
    $("[data-household-choice]")?.focus({ preventScroll: true });
    return;
  }
  if (event.target.matches("[data-policy-field]")) {
    const field = event.target.dataset.policyField;
    commit(event.target.value);
    $(`[data-policy-field="${field}"]`)?.focus({ preventScroll: true });
    return;
  }
  if (event.target.closest("#project-form")) {
    const values = new FormData(event.target.form);
    projectType = String(values.get("type") || "qualification");
    projectAction = event.target.name === "type" ? "" : String(values.get("action") || "");
    const name = event.target.name;
    render();
    $(`#project-form [name="${name}"]`)?.focus({ preventScroll: true });
    return;
  }
  if (event.target.closest("#appointment-form")) {
    appointmentDraft = readAppointmentForm(event.target.form);
    if (event.target.name === "kind") {
      appointmentDraft.subjectId = "";
      appointmentDraft.venue = "";
      if (appointmentDraft.kind === "meeting") appointmentDraft.npcId = selectedNpc;
    }
    if (event.target.name === "subjectId") appointmentDraft.venue = "";
    if (event.target.name === "day") calendarDay = appointmentDraft.day;
    const name = event.target.name;
    render();
    $(`#appointment-form [name="${name}"]`)?.focus({ preventScroll: true });
    return;
  }
  if (event.target.name === "scenario" && event.target.value === "graduate")
    $('select[name="education"]').value = "university";
  if (event.target.name === "trait")
    $("#trait-description").textContent = translateText(
      lookup(TRAITS, event.target.value)?.description || "",
    );
});
$("#import-file").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  try {
    if (file.size > 2_000_000) {
      announce("Bu kayıt dosyası çok büyük.", true);
      return;
    }
    const imported = importGame(await file.text());
    if (!imported.state) {
      announce(imported.message || "Kayıt geçersiz. Mevcut oyun korundu.", true);
      return;
    }
    const saved = saveGame(imported.state);
    if (!saved.ok) {
      announce(saved.message || "Kayıt saklanamadı. Mevcut oyun korundu.", true);
      return;
    }
    state = imported.state;
    calendarDay = null;
    appointmentDraft = null;
    editingEntry = "";
    previewPayload = null;
    saveStatus = saved.message;
    lastOutcome = null;
    selectedDistrict = state.location;
    tab = "board";
    dialog.close();
    render();
    announce(imported.message || "Kayıt yüklendi; kaldığın yerden devam edebilirsin.");
  } catch (error) {
    announce(`Dosya okunamadı. Mevcut oyun korundu: ${error.message}`, true);
  }
});
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) {
    const r = dialog.getBoundingClientRect();
    if (
      event.clientX < r.left ||
      event.clientX > r.right ||
      event.clientY < r.top ||
      event.clientY > r.bottom
    )
      dialog.close();
  }
});
// Read-only diagnostics: browser acceptance can inspect the same state rendered by the UI.
window.boardworldInspect = () => (state ? structuredClone(state) : null);
window.addEventListener("storage", (event) => {
  if (event.key !== SAVE_KEY || !event.newValue) return;
  try {
    const loaded = loadGame();
    if (loaded.state) {
      state = loaded.state;
      calendarDay = null;
      appointmentDraft = null;
      editingEntry = "";
      previewPayload = null;
      dialog.close();
      saveStatus = loaded.message;
      selectedDistrict = state.location;
      lastOutcome = null;
      render();
      announce("Başka bir sekmedeki güncel kaydın yüklendi. Oyun aynı noktadan devam ediyor.");
    }
  } catch {
    announce("Diğer sekmenin kaydı okunamadı. Bu sekmedeki ilerlemeni dosyaya indir.", true);
  }
});
await initLocale(() => {
  dialog.close();
  $("#notice").classList.remove("visible");
  $("#notice").textContent = "";
  $(".skip-link").textContent = "Oyuna geç";
  render();
  localizeTree($(".skip-link"));
});
render();
localizeTree($(".skip-link"));
if (initialLoad?.message) announce(initialLoad.message);
