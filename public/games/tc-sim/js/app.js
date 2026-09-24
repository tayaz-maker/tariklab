import { compactNavigation } from "../../shared/compact-navigation.js";
import { arrangeLifeDesk } from "./desk.js?v=10";
import { adultChildSummary, adultEventContext, continueGeneration } from "./lifetime.js?v=10";
import {
  LIFESTYLE_TIERS, SUBSCRIPTIONS, DURABLES, VEHICLES, INVESTMENTS, MARKET,
  getWealthActionAvailability, applyWealthAction, netWorth, marketEffectText, durableBenefit, investmentPL, economyText,
} from "./wealth.js?v=10";
import { renderLifetimeTerminal, renderLineage } from "./lifetime-ui.js?v=10";
import { parenthoodSummary } from "./parenthood.js?v=10";
import { getHouseholdSummary } from "./household.js?v=10";
import {
  WEEKS_PER_MONTH,
  BACKGROUND_OPTIONS,
  PRIORITY_OPTIONS,
  createNewGame,
  getTendencyLabel,
  getWeeklyActivityLimit,
  isCriticalHealth,
  setYearlyPriorities,
} from "./state.js?v=10";
import { getKnownOpenCases, getPlayerVisibleOpenCases } from "./calendar.js?v=10";
import { snapshotWeekState, summarizeWeek } from "./weekly-feedback.js?v=10";
import {
  getChoiceEffectSummary,
  getEventDefinition,
  getEventChoiceAvailability,
  resolveEvent,
} from "./events.js?v=10";
import { advanceWeek, applyDecision, canApplyDecision, getAvailableDecisions } from "./time.js?v=10";
import { getBodyEventContext } from "./body-events.js?v=10";
import {
  getBodyRiskSummary,
  getKnownBodyConditions,
  getBodyCareContext,
} from "./body-systems.js?v=10";
import { clearSaves, loadGame, saveGame, listSlots, loadSlot, setActiveSlot, getActiveSlot } from "./save.js?v=10";
import {
  HOMES,
  JOBS,
  acceptJobOffer,
  enrollEducation,
  getCommuteLoad,
  getCommuteExplanation,
  getHomeById,
  getJobById,
  getMonthlySummary,
  getMonthlyHousingBreakdown,
  getPlayerLifeStage,
  getRetirementEligibility,
  getRetirementIncomePreview,
  getMoveCost,
  moveHome,
  quitJob,
  stopEducation,
  PRIVACY_CONTEXT,
} from "./life.js?v=10";
import {
  EDUCATION_PATHS,
  JOB_FAMILY_LABELS,
  describeJobRequirements,
  getCareerBand,
  getEducationLevelLabel,
  getEducationProgress,
  getFamilyExperience,
  getFieldLabel,
  getIntensityLabel,
  getPathDurationWeeks,
  isEligibleForJob,
} from "./education.js?v=10";
import { ERAS, PRESENT_DAY_ERA_ID, getEraById } from "./eras.js?v=10";
import { NAVIGATION_ITEMS, getNavigationTarget } from "./navigation.js?v=10";
import {
  RELATIONSHIP_STAGES,
  SOCIAL_ROLE_LABELS,
  applySocialAction,
  getAvailableSocialActions,
  getOpenSocialCase,
  getPerson,
  getPersonalDebt,
  getRelationship,
  getRelationshipStage,
} from "./social.js?v=10";
import { getRelationshipContext } from "./depth2-systems.js?v=10";
import { getReputationContext, getSocialDistanceContext } from "./depth3-systems.js?v=10";
import { renderHelpModal } from "./help.js?v=10";
import { LIFE_ARC_LABELS, LIFE_DEPTH_EVENTS, economyCausality, refreshLifeArcs } from "./life-depth.js?v=10";
import { DOMAIN_LABEL, STREAK_PAYOFF, decisionTags, weekPlan } from "./decision-network.js?v=10";
import { actorVoiceLine } from "./life-content.js?v=10";

const app = document.querySelector("#app");

// This app rebuilds app.innerHTML from Turkish templates on every render(), so
// the site-wide EN phrase pass (which only walks the DOM once at page boot)
// never sees post-boot content. Re-running it after each render is what makes
// EN mode reach navigation/buttons/modals instead of only the very first paint.
function applyLangPhrases() {
  if (window.tlabI18n?.getLang() === "en") window.tlabI18n.applyPhrases(app);
}

// window.confirm() dialogs are native browser chrome, invisible to the DOM
// phrase walker - they need an explicit EN string for critical destructive
// actions (generation succession, quitting education, wiping the save).
function confirmText(tr, en) {
  return window.tlabI18n?.getLang() === "en" ? en : tr;
}

let state = null;
let notice = "";
let saveStatus = "";
let activeView = "dashboard";
let selectedPersonId = "mehmet";
// Haftanın başındaki durum. Yalnız bu oturumda, bellekte tutulur; save'e yazılmaz.
let weekStartSnapshot = null;
// Nasıl Oynanır modalı yalnız görüntü durumudur; save/state'e hiç yazılmaz.
let helpOpen = false;
let startLoadResult = null;
// The opening screen used to open directly on a nine-field character form
// with no title card or premise in front of it — the most "raw HTML form"
// first impression in the whole catalog. This just gates that same form,
// unchanged, behind one editorial step; returning-player slots/continue
// stay on the front step since resuming a life is not character creation.
let showCreationForm = false;

const money = (value) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(value);
const escapeText = (value) =>
  String(value).replace(
    /[&<>'"]/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char],
  );

function openCaseLabel(item) {
  if (item.type === "adult-child")
    return `${state.parenthood.children.find((c) => c.id === item.payload.childId)?.name || "Yetişkin çocuk"} ile yetişkinlik görüşmesi`;
  if (item.type === "parenting-followup")
    return (
      {
        planning: "Çocuk planını görüşme",
        preparation: "Doğum hazırlığı",
        birth: "Doğum zamanı",
        care: "Bakım düzenini görüşme",
        budget: "Çocuk giderlerini görüşme",
        support: "Aile desteğini görüşme",
        housing: "Çocuk için yaşam alanı",
      }[item.payload?.kind] || "Aile görüşmesi"
    );
  if (item.type === "household-followup")
    return (
      {
        cohabitation: "Ortak ev kararı",
        adjustment: "Ev sorumluluklarını görüşme",
        marriage: "Evlilik kararı",
        family: "Aileyle ortak yaşam görüşmesi",
        settlement: "Ayrılık sonrası görüşme",
        planning: "Ortak niyetleri görüşme",
      }[item.payload?.kind] || "Ortak yaşam görüşmesi"
    );
  if (item.type === "health-followup") return "Planlanan beden takibi";
  if (item.type === "job-start") return "İş başlangıcı";
  if (item.type === "social-obligation") return "Verilen yardım sözü";
  if (item.type === "friend-loan") return "Mehmet'e verilen borç";
  if (item.type === "personal-debt") {
    const person = getPerson(state, item.payload?.personId);
    return `${person ? person.name : "Bir arkadaşa"} verilen borç`;
  }
  if (item.type === "social-followup") return "Bekleyen sosyal mesele";
  if (item.type === "depth2-followup") {
    const labels = {
      career_promotion: "Terfi değerlendirmesi",
      family_expectation: "Aile sorumluluğu",
      money_relief: "Geçici borç geri ödemesi",
      education_window: "Eğitim kayıt kararı",
      midlife_family_obligation: "Aileye ayrılan zaman",
      retirement_transition: "Emeklilik kararı",
    };
    return labels[item.payload?.kind] || "Bekleyen yaşam kararı";
  }
  if (item.type === "favor-obligation") return "Verilen iyiliğin karşılığı";
  if (item.type === "depth3-followup")
    return item.payload?.networkType === "network_referral_followup"
      ? "İş bağlantısı görüşmesi"
      : "Bekleyen çevre fırsatı";
  return "Bekleyen mesele";
}

const BODY_AXIS_LABELS = { energy: "Enerji", stress: "Stres", health: "Sağlık" };

function describeWeeklyChange(change) {
  if (change.kind === "money")
    return `Para: ${change.amount >= 0 ? "+" : ""}${money(change.amount)}`;
  if (change.kind === "body")
    return `${BODY_AXIS_LABELS[change.axis]}: ${change.from} → ${change.to}`;
  if (change.kind === "age") return `${change.age} yaşına girdin.`;
  if (change.kind === "education")
    return `Eğitim seviyen değişti: ${getEducationLevelLabel(change.level)}`;
  if (change.kind === "relationship") {
    const person = getPerson(state, change.personId);
    const name = person ? person.name : "Biri";
    if (change.axis === "closeness")
      return `${name} ile yakınlığın ${change.direction === "up" ? "arttı" : "azaldı"}.`;
    if (change.axis === "trust")
      return `${name} sana daha ${change.direction === "up" ? "çok" : "az"} güveniyor.`;
    return `${name} ile aranda gerilim ${change.direction === "up" ? "arttı" : "azaldı"}.`;
  }
  if (change.kind === "obligation") return `Yeni yükümlülük: ${openCaseLabel(change.case)}`;
  if (change.kind === "housing") return `Yaşam yerin değişti: ${getHomeById(change.homeId).title}`;
  return "";
}

function weeksAgoLabel(week) {
  const diff = state.time.absoluteWeek - week;
  if (diff <= 0) return "Bu hafta";
  if (diff === 1) return "1 hafta önce";
  return `${diff} hafta önce`;
}

function weeksAheadLabel(week) {
  const diff = Math.max(0, week - state.time.absoluteWeek);
  if (diff === 0) return "Bu hafta";
  if (diff === 1) return "1 hafta içinde";
  return `${diff} hafta içinde`;
}

function currentCommuteExplanation() {
  if (state.career.retirement?.status === "retired")
    return {
      label: "Emekli — iş ulaşımı yok",
      detail: "Emeklilikten sonra haftalık işe gidiş yükü uygulanmaz.",
    };
  return getCommuteExplanation(state.household.homeId, state.career.jobId, state);
}

function getAllPersonalDebts() {
  return state.people
    .map((person) => ({ person, debt: getPersonalDebt(state, person.id) }))
    .filter((entry) => entry.debt);
}

function persist(message = "Otomatik kaydedildi.") {
  const result = saveGame(localStorage, state);
  saveStatus = result.ok ? `${message} (${Math.ceil(result.bytes / 1024)} KB)` : result.message;
  return result;
}

function startScreen(loadResult) {
  startLoadResult = loadResult;
  const slots = listSlots(localStorage);
  const active = getActiveSlot(localStorage);
  const introMarkup = `
        <p class="eyebrow">TARIKLAB · HAYAT SİMÜLASYONU</p>
        <h1 id="start-title">TC SIM</h1>
        <p class="tagline">18 yaşında, İstanbul'da aile evinde başlayan küçük bir hayat.</p>
        <p>Her hafta yalnız iki önemli karar verebilirsin: kariyer, eğitim, ilişkiler, para — hepsi birbirini besliyor, hepsi yıllarca sürüyor.</p>
        <div class="slot-row" role="group" aria-label="Kayıt yerleri">${slots
          .map(
            (item) =>
              `<button class="button button-quiet slot-btn ${item.slot === active ? "is-current" : ""}" data-slot="${item.slot}">Slot ${item.slot}${item.empty ? " · boş" : ` · ${escapeText(item.name || "kayıt")}`}</button>`,
          )
          .join("")}</div>
        ${loadResult.ok ? `<div class="continue-box"><strong>${escapeText(loadResult.state.player.name)} · ${loadResult.state.time.year}, ${loadResult.state.time.month}. ay</strong><button class="button button-primary" id="continue-game">Slot ${active} devam</button></div>` : `<p class="result">${escapeText(loadResult.message)}</p>`}
        <button class="button button-primary" type="button" id="show-creation-form">Hayatını Başlat</button>`;
  const formMarkup = `
        <p class="eyebrow">TC SIM</p>
        <h1 id="start-title">Hayatını kur</h1>
        <p>Bu seçimler başlangıç noktan olur; hayat oynadıkça kendi yolunu bulur.</p>
        <form id="new-game-form" class="form-grid">
          <label>İsim<input name="name" maxlength="40" value="Deniz" required /></label>
          <label>Kimlik<select name="gender"><option value="unspecified">Belirtmek istemiyorum</option><option value="woman">Kadın</option><option value="man">Erkek</option></select></label>
          <label>Başlangıç profili<select name="profile"><option value="balanced">Dengeli</option><option value="ambitious">Hırslı</option><option value="social">Sosyal</option></select></label>
          <label>Aile ortamı<select name="familyBackground">${Object.entries(
            BACKGROUND_OPTIONS.family,
          )
            .map(([id, label]) => `<option value="${id}">${escapeText(label)}</option>`)
            .join("")}</select></label>
          <label>Maddi başlangıç<select name="economicBackground">${Object.entries(
            BACKGROUND_OPTIONS.economic,
          )
            .map(([id, label]) => `<option value="${id}">${escapeText(label)}</option>`)
            .join("")}</select></label>
          <label>Eğitim geçmişi<select name="educationBackground">${Object.entries(
            BACKGROUND_OPTIONS.education,
          )
            .map(([id, label]) => `<option value="${id}">${escapeText(label)}</option>`)
            .join("")}</select></label>
          <label>Sosyal çevre<select name="socialBackground">${Object.entries(
            BACKGROUND_OPTIONS.social,
          )
            .map(([id, label]) => `<option value="${id}">${escapeText(label)}</option>`)
            .join("")}</select></label>
          <label>Aile yapısı<select name="familyType">${Object.entries(
            BACKGROUND_OPTIONS.familyType,
          )
            .map(([id, label]) => `<option value="${id}">${escapeText(label)}</option>`)
            .join("")}</select></label>
          <label>Askerlik durumu<select name="militaryApplicable"><option value="false">Bu yaşamda yükümlülük yok</option><option value="true">Yükümlülük var</option></select></label>
          <label>Başlangıç dönemi<select name="eraId" disabled>${ERAS.map((era) => `<option value="${era.id}" ${era.id === PRESENT_DAY_ERA_ID ? "selected" : ""}>${escapeText(era.title)} · aktif</option>`).join("")}</select><small>Diğer dönemler daha sonra eklenecek.</small></label>
        <div class="row">
          <button class="button button-quiet" type="button" id="back-to-intro">← Geri</button>
          <button class="button button-primary" type="submit">Bu slota yeni hayat</button>
        </div>
        </form>`;
  app.innerHTML = `
    <main class="start-wrap">
      <a class="start-exit" href="/">← Oyunlar</a>
      <section class="start-card" aria-labelledby="start-title">
        ${showCreationForm ? formMarkup : introMarkup}
      </section>
    </main>`;
  document.documentElement?.classList?.toggle("embedded", window.self !== window.top);
  applyLangPhrases();

  document.querySelectorAll("[data-slot]").forEach((button) => {
    button.addEventListener("click", () => {
      const slot = Number(button.getAttribute("data-slot"));
      const result = loadSlot(localStorage, slot);
      startScreen(result);
    });
  });

  document.querySelector("#continue-game")?.addEventListener("click", () => {
    state = loadResult.state;
    notice = loadResult.message;
    saveStatus = loadResult.source === "backup" ? "Yedekten devam ediliyor." : "Kayıt hazır.";
    weekStartSnapshot = null;
    render();
  });
  document.querySelector("#show-creation-form")?.addEventListener("click", () => {
    showCreationForm = true;
    startScreen(loadResult);
  });
  document.querySelector("#back-to-intro")?.addEventListener("click", () => {
    showCreationForm = false;
    startScreen(loadResult);
  });
  document.querySelector("#new-game-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    state = createNewGame({
      name: data.get("name"),
      gender: data.get("gender"),
      profile: data.get("profile"),
      familyBackground: data.get("familyBackground"),
      economicBackground: data.get("economicBackground"),
      educationBackground: data.get("educationBackground"),
      socialBackground: data.get("socialBackground"),
      familyType: data.get("familyType"),
      militaryApplicable: data.get("militaryApplicable") === "true",
      eraId: PRESENT_DAY_ERA_ID,
      seed: Date.now() >>> 0,
    });
    notice = "Yeni hayat başladı.";
    weekStartSnapshot = null;
    persist("İlk kayıt oluşturuldu.");
    render();
  });
}

function renderPeople() {
  const en = window.tlabI18n?.getLang?.() === "en";
  return state.people
    .map((person) => {
      const voice = actorVoiceLine(person.id, en);
      return `<div class="person"><p><strong>${escapeText(person.name)}</strong><small>${escapeText(person.relationType)} · ${escapeText(personStageLabel(person.id))} · ${person.memories.length} hatıra</small>${voice ? `<em>${escapeText(voice)}</em>` : ""}</p><div class="relation-wrap"><i><span style="width:${Number.isFinite(state.relationships[person.id]) ? state.relationships[person.id] : 44}%"></span></i><b class="relation">${Number.isFinite(state.relationships[person.id]) ? state.relationships[person.id] : 44}</b></div></div>`;
    })
    .join("");
}

function weeksSinceContact(person) {
  return Math.max(0, state.time.absoluteWeek - person.social.lastMeaningfulContactWeek);
}

function renderRelationshipMetrics(person) {
  const relationship = getRelationship(state, person.id);
  return `<div class="social-metrics"><span>Yakınlık <b>${relationship.closeness}</b></span><span>Güven <b>${relationship.trust}</b></span><span>Gerilim <b>${relationship.tension}</b></span></div><p class="social-metrics-note">Yakınlık bağın gücünü, güven sana duyulan inancı, gerilim ise aranızdaki sürtüşmeyi gösterir.</p>`;
}

function personStageLabel(personId) {
  if (personId === state.social.currentPartnerNpcId) return getHouseholdSummary(state).status;
  if (
    getPerson(state, personId)?.social.romanceStatus === "none" &&
    state.household.history?.some(
      (entry) => entry.kind === "divorce" && entry.personId === personId,
    )
  )
    return "Eski eş";
  return RELATIONSHIP_STAGES[getRelationshipStage(state, personId)];
}

function renderPeopleScreen() {
  const selected = getPerson(state, selectedPersonId) || state.people[0];
  selectedPersonId = selected.id;
  const stage = personStageLabel(selected.id);
  const openCase = getOpenSocialCase(state, selected.id);
  const actions = getAvailableSocialActions(state, selected.id);
  const memories = selected.memories.slice(-5).reverse();
  const milestone = selected.lifeMilestones
    ?.filter((item) => selected.knownMilestones?.includes(item.id))
    .at(-1);
  const voice = actorVoiceLine(selected.id, window.tlabI18n?.getLang?.() === "en");
  const voiceNote = voice ? `<p class="context-note person-voice">${escapeText(voice)}</p>` : "";
  return `<div class="workspace-head"><div><p class="eyebrow">KİŞİLER</p><h1>Sosyal çevre</h1></div>${renderWeekControl()}</div>
    <div class="social-layout"><section class="panel people-directory"><div class="panel-head"><div><p class="eyebrow">ÇEVRE</p><h2>Önemli kişiler</h2></div><span>${state.people.length}</span></div>${state.people.map((person) => `<button class="person-select ${person.id === selected.id ? "is-current" : ""}" data-person="${person.id}"><span><strong>${escapeText(person.name)}</strong><small>${escapeText(SOCIAL_ROLE_LABELS[person.roleId])}</small></span><b>${escapeText(personStageLabel(person.id))}</b></button>`).join("")}</section>
    <section class="panel person-detail"><div class="panel-head"><div><p class="eyebrow">KİŞİ DOSYASI</p><h2>${escapeText(selected.name)}</h2></div><span>${escapeText(stage)}</span></div><p class="context-note">${escapeText(SOCIAL_ROLE_LABELS[selected.roleId])} · Son anlamlı temas ${weeksSinceContact(selected)} hafta önce${openCase ? ` · ${Math.max(0, openCase.dueWeek - state.time.absoluteWeek)} hafta içinde açık söz` : ""}</p>${voiceNote}<p class="context-note">${escapeText(getSocialDistanceContext(state, selected.id))}</p>${selected.id === state.social.currentPartnerNpcId ? renderHouseholdContext() : ""}${milestone ? `<p class="context-note">Bilinen gelişme: ${escapeText(milestone.text)}</p>` : ""}${getRelationshipContext(
      state,
      selected.id,
    )
      .map((note) => `<p class="context-note">${escapeText(note)}</p>`)
      .join(
        "",
      )}${renderRelationshipMetrics(selected)}<div class="social-actions">${actions.map((action) => `<button class="button decision" data-social-action="${action.id}" data-person-id="${selected.id}" ${action.availability.ok ? "" : "disabled"} title="${escapeText(action.availability.reason || "")}"><strong>${escapeText(action.title)}</strong><small>${escapeText(action.detail)}</small></button>`).join("")}</div><div class="person-memories"><p class="panel-kicker">SON ÖNEMLİ ANILAR</p>${memories.length ? memories.map((memory) => `<p><span>${memory.year}</span>${escapeText(memory.text)}</p>`).join("") : `<p class="empty">Henüz ortak bir anı yok.</p>`}</div><p class="result" role="status">${escapeText(notice || "Bir sosyal etkileşim haftalık zaman ve odak kullanır.")}</p></section></div>`;
}

function renderParenthoodContext() {
  const context = parenthoodSummary(state);
  const lines = [
    context.pregnancy,
    ...context.children,
    ...adultChildSummary(state).map((c) => c.text),
    context.care,
  ].filter(Boolean);
  return lines.length ? `<p class="context-note">${lines.map(escapeText).join("<br>")}</p>` : "";
}

function renderHouseholdContext() {
  const context = getHouseholdSummary(state);
  if (!context.partnerName) return renderParenthoodContext();
  return `<p class="context-note">${escapeText(context.partnerName)} · ${escapeText(context.status)} · ${escapeText(context.residence)}${context.space ? `<br>${escapeText(context.space)}` : ""}${context.familyPlanning ? `<br>${escapeText(context.familyPlanning)}` : ""}</p>${renderParenthoodContext()}`;
}

function renderRelationshipsOverview() {
  const partner = state.social.currentPartnerNpcId
    ? getPerson(state, state.social.currentPartnerNpcId)
    : null;
  const attention = [...state.people].sort(
    (a, b) => b.social.tension + weeksSinceContact(b) - (a.social.tension + weeksSinceContact(a)),
  )[0];
  const knownCases = getKnownOpenCases(state);
  const personalDebts = getAllPersonalDebts();
  const obligationCount = knownCases.length + personalDebts.length;
  const recentDevelopments = state.people
    .flatMap((person) => person.memories.map((memory) => ({ person, memory })))
    .sort((a, b) => b.memory.year - a.memory.year || b.memory.week - a.memory.week)
    .slice(0, 6);
  const knownSecrets = (state.secrets || []).filter(
    (secret) => secret.knownBy?.includes("player") && secret.status !== "resolved",
  );

  return `<div class="workspace-head"><div><p class="eyebrow">AİLE / İLİŞKİLER</p><h1>Bağların</h1></div>${renderWeekControl()}</div>
    <section class="detail-summary panel">
      <div><span>Romantik durum</span><strong>${partner ? `${escapeText(partner.name)} · ${escapeText(getHouseholdSummary(state).status)}` : "Sevgili yok"}</strong></div>
      <div><span>İlgi isteyen ilişki</span><strong>${escapeText(attention.name)}</strong><small>${attention.social.tension >= 40 ? "Gerilim yükselmiş" : `${weeksSinceContact(attention)} haftadır anlamlı temas yok`}</small></div>
      <div><span>Açık sosyal mesele</span><strong>${obligationCount}</strong></div>
    </section>
    ${renderHouseholdContext()}
    <section class="panel"><div class="panel-head"><div><p class="eyebrow">ÖNEMLİ BAĞLAR</p><h2>Kişiler</h2></div></div><div class="overview-grid">${state.people
      .map(
        (person) =>
          `<article class="panel relationship-summary"><p class="panel-kicker">${escapeText(SOCIAL_ROLE_LABELS[person.roleId])}</p><h2>${escapeText(person.name)}</h2><p>${escapeText(personStageLabel(person.id))}</p>${renderRelationshipMetrics(person)}<button class="button button-quiet" data-open-person="${person.id}">Kişi dosyasını aç</button></article>`,
      )
      .join("")}</div></section>
    <section class="panel"><div class="panel-head"><div><p class="eyebrow">SON GELİŞMELER</p><h2>Yakın zamanda olanlar</h2></div></div><div class="history">${
      recentDevelopments.length
        ? recentDevelopments
            .map(
              ({ person, memory }) =>
                `<div class="memory"><strong>${escapeText(person.name)}</strong> · ${escapeText(memory.text)}</div>`,
            )
            .join("")
        : `<p class="empty">Henüz kayda değer bir gelişme yok.</p>`
    }</div></section>
    <section class="panel"><div class="panel-head"><div><p class="eyebrow">AÇIK MESELELER</p><h2>Sözler ve borçlar</h2></div><span>${obligationCount}</span></div>${
      obligationCount
        ? `${knownCases
            .map(
              (item) =>
                `<p class="open-case"><b>${escapeText(openCaseLabel(item))}</b><span>${escapeText(weeksAheadLabel(item.dueWeek))}</span></p>`,
            )
            .join("")}${personalDebts
            .map(
              ({ person, debt }) =>
                `<p class="open-case"><b>${escapeText(person.name)}: ${money(debt.payload.amount)} borçlu</b><span>Bekleniyor</span></p>`,
            )
            .join("")}`
        : `<p class="empty">Şu anda açık bir sosyal mesele yok.</p>`
    }</section>
    ${knownSecrets.length ? `<section class="panel"><div class="panel-head"><div><p class="eyebrow">ÖZEL MESELELER</p><h2>Bildiklerin</h2></div><span>${knownSecrets.length}</span></div>${knownSecrets.map((secret) => `<p class="open-case"><b>${escapeText(secret.summary)}</b><span>${secret.status === "exposed" ? "Paylaşıldı" : "Sende kaldı"}</span></p>`).join("")}</section>` : ""}
    <section class="panel"><div class="panel-head"><div><p class="eyebrow">ÇEVRELER</p><h2>Hayatındaki farklı bakışlar</h2></div></div>${[
      "family",
      "professional",
      "friends",
      "acquaintances",
    ]
      .map((circle) => {
        const context = getReputationContext(state, circle);
        return `<p class="open-case"><b>${escapeText(circle === "family" ? "Aile" : circle === "professional" ? "İş" : circle === "friends" ? "Arkadaşlar" : "Tanıdıklar")}</b><span>${escapeText(context.label)}</span></p>`;
      })
      .join("")}</section>
    <section class="panel"><div class="panel-head"><div><p class="eyebrow">KIYAS ÇEVRESİ</p><h2>Çevrenden haberler</h2></div></div>${(state.comparisonCircle?.peers || []).map((peer) => `<p class="open-case"><b>${escapeText(peer.name)} · ${escapeText(peer.relation)}</b><span>${escapeText(peer.status)}</span></p>`).join("") || `<p class="empty">Henüz çevrenden haber yok.</p>`}</section>`;
}

function renderMemories() {
  const items = state.memories.slice(-5).reverse();
  return items.length
    ? items
        .map(
          (memory) =>
            `<div class="memory"><strong>${memory.year}</strong> · ${escapeText(memory.text)}</div>`,
        )
        .join("")
    : `<p class="empty">Henüz önemli bir geçmiş oluşmadı.</p>`;
}

function renderYearHistory() {
  const year = state.yearlyHistory.at(-1);
  if (!year) return `<p class="empty">İlk yıl tamamlandığında burada bir dosya oluşacak.</p>`;
  return `<p class="open-case"><strong>${year.year}</strong><br>Başlangıç ${money(year.startingBalance)} · Bitiş ${money(year.endingBalance)}<br>${year.importantMemories.length} önemli kayıt</p>`;
}

function renderAgenda() {
  const active = state.events.active ? getEventDefinition(state.events.active.eventId) : null;
  const latestMemory = state.memories.at(-1);
  if (active) {
    return `<p class="agenda-title">${escapeText(active.title)}</p><p>${escapeText(active.text)}</p><span class="agenda-status">Kararın bekleniyor</span>`;
  }
  if (notice) {
    return `<p class="agenda-title">Son gelişme</p><p>${escapeText(notice)}</p><span class="agenda-status">${state.time.year} · ${state.time.month}. ay · ${state.time.weekOfMonth}. hafta</span>`;
  }
  if (latestMemory) {
    return `<p class="agenda-title">Hayat kaydı</p><p>${escapeText(latestMemory.text)}</p><span class="agenda-status">${latestMemory.year}</span>`;
  }
  return `<p class="agenda-title">Sakin başlangıç</p><p>Hayatın ilk kararlarını vermek için bu haftayı kullan.</p><span class="agenda-status">Gündem açık</span>`;
}

function renderNav() {
  return NAVIGATION_ITEMS.map(
    ({ label, view }) =>
      `<button type="button" class="nav-item ${view === activeView ? "is-active" : ""}" ${view ? `data-view="${view}"${view === activeView ? ' aria-current="page"' : ""}` : 'disabled aria-disabled="true"'}><span class="nav-mark"></span><span>${label}</span></button>`,
  ).join("");
}

function lifeLabel(value) {
  return ["Çok düşük", "Düşük", "Orta", "Yüksek", "Çok yüksek"][Math.min(4, value)] || "Düşük";
}

function bodyRiskText() {
  if (isCriticalHealth(state))
    return "Sağlığın kritik: bu hafta yalnız bir karar verebilirsin ve ek mesaiye kalkışamazsın. Dinlen ve toparlan.";
  if (state.health.energy <= 45 && getCommuteLoad(state.household.homeId, state.career.jobId) >= 2)
    return "Düşük enerji, yüksek ulaşım yüküyle birlikte yol yorgunluğu olayını açabilir.";
  if (state.health.stress >= 70) return "Yüksek stres yorgunluk uyarısı doğurabilir.";
  if (state.health.stress >= 65 && getJobById(state.career.jobId)?.load >= 3)
    return "Yoğun iş ve stres birlikte iş baskısı olayı doğurabilir.";
  const longTerm = getBodyRiskSummary(state);
  if (longTerm && !longTerm.includes("yönetilebilir")) return longTerm;
  if (state.player.age >= 65)
    return "İleri yaşta haftalık toparlanma daha yavaş; düzenli dinlenme sağlıklı yaşlanmayı destekliyor.";
  if (state.player.age >= 55)
    return "Geç kariyerde yoğun haftaların toparlanması daha uzun sürüyor; iş yükü ve dinlenme dengesi önem kazandı.";
  if (state.player.age >= 45)
    return "Orta yaşamda toparlanma payı daralıyor; mevcut sağlık ve dinlenme seçimlerin belirleyici.";
  return "Enerji ve stres; haftalık kararlar, iş yükü ve ulaşım tarafından etkilenir.";
}

function renderWeekPlan(activeCases, projectedBalance) {
  const plan = weekPlan(state, {
    openCases: activeCases,
    caseLabel: openCaseLabel,
    projected: projectedBalance,
    effectLabel: (effect) => LIFE_DEPTH_EVENTS.find((e) => e.id === effect.eventId)?.title || "Geçmiş bir karar geri dönecek",
  });
  const week = state.time.absoluteWeek;
  const goal = plan.goal
    ? `<strong>${escapeText(plan.goal.label)}</strong><small>İlerleme ${plan.goal.progress}% · ${plan.goal.wait ? `taahhüt karşılığı ${plan.goal.wait} hafta sonra` : `taahhüt ${plan.goal.streak}/${STREAK_PAYOFF} hafta`}</small>`
    : `<strong>Açık bir orta vadeli hedef yok</strong><small>Bir hedef açılınca seçimler ona bağlanır.</small>`;
  const pressure = plan.pressure
    ? `<strong>${escapeText(plan.pressure.text)}</strong>${plan.pressures.slice(1).map((p) => `<small>${escapeText(p.text)}</small>`).join("")}`
    : `<strong>Bu hafta acil bir baskı yok</strong><small>Planlama için iyi bir hafta.</small>`;
  const opportunity = plan.opportunity
    ? `<strong>${escapeText(plan.opportunity)}</strong>`
    : `<strong>Belirgin bir fırsat yok</strong><small>Hedefe ayrılan haftalar fırsat doğurur.</small>`;
  const chain = plan.chain.length
    ? `<ol class="network-chain">${plan.chain.map((x) => `<li class="${x.future ? "is-future" : "is-past"}"><span>${x.future ? `+${Math.max(0, x.week - week)} hf` : "Önceki"}</span>${escapeText(x.text)}</li>`).join("")}</ol>`
    : `<strong>Zincirde bekleyen sonuç yok</strong><small>Sonraya taşan seçimler burada görünür.</small>`;
  // Two blocks: on phones the decisions sit between them, so the choice stays
  // one screen away; on wide screens both sit above the decisions for planning.
  return {
    top: `<section class="network-plan is-top" aria-label="Haftanın baskısı ve hedefi">
      <article class="network-cell is-pressure"><p class="panel-kicker">ACİL BASKI</p>${pressure}</article>
      <article class="network-cell is-goal"><p class="panel-kicker">HEDEF</p>${goal}</article>
    </section>`,
    more: `<section class="network-plan is-more" aria-label="Fırsat ve sonuç zinciri">
      <article class="network-cell is-opportunity"><p class="panel-kicker">FIRSAT</p>${opportunity}</article>
      <article class="network-cell is-chain"><p class="panel-kicker">SONUÇ ZİNCİRİ</p>${chain}</article>
    </section>`,
  };
}

function renderDecisionTags(decisionId) {
  return `<span class="decision-tags">${decisionTags(state, decisionId)
    .map((tag) => `<span class="decision-tag is-${tag.domain}${tag.sign > 0 ? " is-up" : " is-down"}"><span>${escapeText(DOMAIN_LABEL[tag.domain])}</span> ${tag.domain === "zaman" ? "1" : tag.sign > 0 ? "+" : "−"}${tag.carry ? ` · ${escapeText(tag.carry)}` : ""}</span>`)
    .join("")}</span>`;
}

function renderDashboard() {
  const depth = refreshLifeArcs(state);
  const causalEconomy = economyCausality(state);
  const remaining = Math.max(0, getWeeklyActivityLimit(state) - state.weekly.used);
  const activeCases = getPlayerVisibleOpenCases(state);
  const job = getJobById(state.career.jobId);
  const home = getHomeById(state.household.homeId);
  const monthly = getMonthlySummary(state);
  const projectedBalance = state.finances.balance + monthly.income - monthly.expenses;
  const weekPlanHtml = renderWeekPlan(activeCases, projectedBalance);
  const socialCases = activeCases.filter((item) => item.type === "social-obligation");
  const partner = state.social.currentPartnerNpcId
    ? getPerson(state, state.social.currentPartnerNpcId)
    : null;
  return `<div class="workspace-head"><div><p class="eyebrow">ANA SAYFA</p><h1>Hayat merkezi</h1></div>${renderWeekControl()}</div>
    ${renderParenthoodContext()}
    <section class="overview-grid" aria-label="Hayat özeti">
      <article class="profile-panel"><p class="panel-kicker">KARAKTER</p><h2>${escapeText(state.player.name)}</h2><p>${escapeText(state.player.profile)} · İstanbul · ${escapeText(getEraById(state.world.eraId).title)}</p><dl><div><dt>Yaşam dönemi</dt><dd>${escapeText(getPlayerLifeStage(state).label)}</dd></div><div><dt>Yaşam yeri</dt><dd>${escapeText(home.title)}</dd></div><div><dt>İş</dt><dd>${escapeText(state.career.retirement?.status === "retired" ? "Emekli" : job?.title || "İşsiz")}</dd></div><div><dt>Ulaşım yükü</dt><dd>${escapeText(currentCommuteExplanation().label)}</dd></div></dl></article>
      <article class="metric-panel"><p>FİNANS</p><strong>${money(state.finances.balance)}</strong><span>Aylık ${money(monthly.income)} gelir · ${money(monthly.expenses)} gider</span><small>Ay sonu tahmini: ${money(projectedBalance)}</small></article>
      <article class="body-panel"><p>BEDEN</p><div class="body-row"><span>Enerji</span><i><b style="width:${state.health.energy}%"></b></i><strong>${state.health.energy}</strong></div><div class="body-row stress"><span>Stres</span><i><b style="width:${state.health.stress}%"></b></i><strong>${state.health.stress}</strong></div><div class="body-row"><span>Sağlık</span><i><b style="width:${state.health.health}%"></b></i><strong>${state.health.health}</strong></div><small class="body-note">${escapeText(bodyRiskText())}</small></article>
      <article class="metric-panel"><p>SOSYAL</p><strong>${partner ? escapeText(partner.name) : "Sevgili yok"}</strong><span>${socialCases.length} açık sosyal mesele</span><small>${escapeText(RELATIONSHIP_STAGES[getRelationshipStage(state, "mehmet")])}: Mehmet</small></article>
    </section>
    <section class="panel life-depth-panel"><div class="panel-head"><div><p class="eyebrow">YAŞAM HARİTASI</p><h2>${depth.phase === "opening" ? "Kuruluş dönemi" : depth.phase === "midgame" ? "Yön ve yük dönemi" : "Miras dönemi"}</h2></div><span>${depth.goals.length} hedef</span></div>
      <div class="overview-grid">${Object.values(depth.arcs).filter((arc) => arc.stage !== "start" || arc.unresolvedIssue).slice(0, 6).map((arc) => `<article class="metric-panel"><p>${escapeText(LIFE_ARC_LABELS[arc.id][0].toUpperCase())}</p><strong>${escapeText({ development: "Gelişiyor", tension: "Gerilim", crisis: "Kriz", turning: "Kırılma", outcome: "Sonuç", start: "Başlangıç" }[arc.stage])}</strong><small>${escapeText(arc.unresolvedIssue || arc.opportunities[0] || "Süreç açık")}</small></article>`).join("")}</div>
      <div class="detail-summary"><div><span>Nakit güvenliği</span><strong>${Math.round(causalEconomy.safety)}/100</strong></div><div><span>Zaman baskısı</span><strong>${Math.round(causalEconomy.timePressure)}/100</strong></div><div><span>Borç</span><strong>${money(causalEconomy.debt)}</strong></div></div>
      <div class="history">${depth.goals.map((goal) => `<p class="open-case"><b>${escapeText(goal.label)}</b><span>${Math.round(goal.progress)}%</span></p>`).join("") || `<p class="empty">Şu anda ayrı bir orta vadeli hedef yok.</p>`}</div>
      ${depth.echoes.length ? `<p class="context-note">Son yankı: ${escapeText(depth.echoes.at(-1).text)}</p>` : ""}
    </section>
    <div class="dashboard-grid">
      <section class="panel week-panel"><div class="panel-head"><div><p class="eyebrow">BU HAFTA</p><h2>Zamanını nasıl kullandın?</h2></div><span>${remaining} odak kaldı</span></div><p class="decision-context">Her seçim zaman, enerji, para veya ilişki bedeli taşır. Haftayı doldurmak zorunda değilsin; yorgunluk ve ertelenen işler sonraki haftaya yansır.</p>${weekPlanHtml.top}<div class="decisions">${getAvailableDecisions(
        state,
      )
        .map((decision) => {
          const check = canApplyDecision(state, decision.id);
          return `<button class="button decision" data-decision="${decision.id}" ${check.ok ? "" : "disabled"} title="${escapeText(check.reason || "")}"><strong>${escapeText(decision.title)}</strong><small>${escapeText(decision.detail)}</small>${renderDecisionTags(decision.id)}</button>`;
        })
        .join(
          "",
        )}</div>${weekPlanHtml.more}<p class="result" role="status">${escapeText(notice || "Bu haftanın kararlarını ver veya zamanı ilerlet.")}</p></section>
      <aside class="right-column"><section class="panel agenda-panel"><div class="panel-head"><div><p class="eyebrow">GÜNDEM</p><h2>Gelen kutusu</h2></div></div>${renderAgenda()}</section><section class="panel people-panel"><div class="panel-head"><div><p class="eyebrow">İLİŞKİLER</p><h2>Önemli kişiler</h2></div><span>/ 100</span></div><div class="people">${renderPeople()}</div></section></aside>
      <section class="panel history-panel"><div class="panel-head"><div><p class="eyebrow">GEÇMİŞ</p><h2>Son hayat kayıtları</h2></div><span>${state.memories.length}</span></div><div class="history">${renderMemories()}</div></section>
      <section class="panel cases-panel"><div class="panel-head"><div><p class="eyebrow">AÇIK MESELELER</p><h2>Bekleyen sonuçlar</h2></div><span>${activeCases.length}</span></div>${activeCases.length ? activeCases.map((item) => `<p class="open-case"><b>${escapeText(openCaseLabel(item))}</b><span>${Math.max(0, item.dueWeek - state.time.absoluteWeek)} hafta kaldı</span></p>`).join("") : `<p class="empty">Şu anda açık dosya yok.</p>`}<div class="year-file"><span>Yıl dosyası</span>${renderYearHistory()}</div></section>
    </div>`;
}

function renderWeekControl() {
  return `<div class="week-control"><span>Zaman / odak <b>${state.weekly.used} / ${Math.max(getWeeklyActivityLimit(state), state.weekly.used)}</b></span><button class="button button-primary" id="advance-week" ${state.events.active ? "disabled" : ""}>Haftayı değerlendir</button></div>`;
}

function renderDeskLedger() {
  const entries = [...state.finances.ledger].reverse().slice(0, 40);
  return `<details class="management-deck life-ledger" open><summary>${confirmText("KASA / SON HAREKETLER", "CASH / RECENT TRANSACTIONS")}</summary><div class="ledger-scroll"><table><thead><tr><th>${confirmText("Zaman", "When")}</th><th>${confirmText("Açıklama", "Description")}</th><th>${confirmText("Tutar (TRY)", "Amount (TRY)")}</th></tr></thead><tbody>${entries.map(entry => `<tr><td>${escapeText(weeksAgoLabel(entry.week))}</td><td>${escapeText(entry.reason)}</td><td>${money(entry.amount)}</td></tr>`).join("") || `<tr><td colspan="3">${confirmText("Henüz işlem yok.", "No transactions yet.")}</td></tr>`}</tbody></table></div></details>`;
}

function renderCareer() {
  const active = getJobById(state.career.jobId);
  const retired = state.career.retirement?.status === "retired";
  const retirement = getRetirementEligibility(state);
  const home = getHomeById(state.household.homeId);
  const experience = experienceSummary();
  return `<div class="workspace-head"><div><p class="eyebrow">İŞ</p><h1>Çalışma hayatı</h1></div>${renderWeekControl()}</div>
    <section class="detail-summary panel"><div><span>Çalışma durumu</span><strong>${retired ? "Emekli" : active ? escapeText(active.title) : "İşsiz"}</strong><small>${retired ? `${money(state.career.retirement.monthlyIncome)} aylık gelir` : escapeText(getPlayerLifeStage(state).label)}</small></div><div><span>Aylık maaş</span><strong>${money(active?.salary || 0)}</strong></div><div><span>İş yükü</span><strong>${lifeLabel(active?.load || 0)}</strong></div><div><span>Güvence</span><strong>${active?.security || "—"}</strong></div><div><span>Emeklilik</span><strong>${retired ? "Tamamlandı" : retirement.eligible ? "Karar verilebilir" : "Henüz uygun değil"}</strong><small>${retired ? `H${state.career.retirement.retiredWeek}` : retirement.eligible ? `Tahmini gelir ${money(getRetirementIncomePreview(state))}` : escapeText(retirement.reason)}</small></div><div><span>${escapeText(home.title)} ulaşımı</span><strong>${escapeText(getCommuteExplanation(home.id, active?.id || null).label)}</strong><small>${escapeText(getCommuteExplanation(home.id, active?.id || null).detail)}</small></div></section>
    <section class="detail-summary panel"><div><span>İş alanı</span><strong>${escapeText(experience.familyLabel)}</strong></div><div><span>Alan deneyimi</span><strong>${experience.weeks} hafta</strong><small>${experience.months} ay</small></div><div><span>Kariyer bandı</span><strong>${escapeText(experience.band.label)}</strong></div><div><span>İş performansı</span><strong>${state.career.performance}</strong><small>${state.career.weeksInRole} hafta bu rolde</small></div><div><span>Eğitim seviyesi</span><strong>${escapeText(getEducationLevelLabel(state.education.level))}</strong><small>${state.education.fields.length ? escapeText(state.education.fields.map((field) => getFieldLabel(field)).join(" · ")) : "Alan yok"}</small></div></section>
    ${state.career.pendingJob ? `<p class="result">${escapeText(getJobById(state.career.pendingJob.jobId).title)} başlangıcı ${Math.max(0, state.career.pendingJob.startWeek - state.time.absoluteWeek)} hafta sonra.</p>` : ""}
    <section class="panel"><div class="panel-head"><div><p class="eyebrow">FIRSATLAR</p><h2>İş teklifleri</h2></div></div><div class="option-grid">${JOBS.map(
      (job) => {
        const commute = getCommuteExplanation(home.id, job.id);
        const isCurrent = state.career.jobId === job.id;
        const eligibility = isEligibleForJob(state, job);
        const disabled =
          retired ||
          isCurrent ||
          !eligibility.ok ||
          state.career.pendingJob ||
          state.weekly.used >= getWeeklyActivityLimit(state);
        const blockReason = retired
          ? "Emeklilikten sonra normal iş teklifleri kapalı."
          : isCurrent
          ? "Zaten bu işte çalışıyorsun."
          : !eligibility.ok
            ? eligibility.reason
            : state.career.pendingJob
              ? "Önce bekleyen iş başlangıcı sonuçlanmalı."
              : state.weekly.used >= getWeeklyActivityLimit(state)
                ? "Bu haftanın aktivite hakkı bitti."
                : "";
        return `<article class="option-card ${isCurrent ? "is-current" : ""} ${eligibility.ok ? "" : "is-locked"}"><div><p class="panel-kicker">${isCurrent ? "AKTİF İŞ" : eligibility.ok ? "İŞ TEKLİFİ" : "KİLİTLİ"}</p><h3>${escapeText(job.title)}</h3></div><dl><div><dt>Maaş</dt><dd>${money(job.salary)}</dd></div><div><dt>Alan</dt><dd>${escapeText(JOB_FAMILY_LABELS[job.family] || job.family)}</dd></div><div><dt>İş yükü</dt><dd>${lifeLabel(job.load)}</dd></div><div><dt>Ulaşım</dt><dd>${escapeText(commute.label)}</dd></div><div><dt>Haftalık etki</dt><dd>Enerji ${job.energy + commute.energy} · Stres +${job.stress + commute.stress}</dd></div><div><dt>Güvence</dt><dd>${job.security}</dd></div><div><dt>Deneme süresi</dt><dd>${job.terms?.probationWeeks || 0} hafta · ${escapeText(job.terms?.review || "")} </dd></div><div><dt>Gereksinim</dt><dd>${escapeText(describeJobRequirements(job))}</dd></div></dl>${eligibility.ok ? "" : `<p class="context-note">${escapeText(eligibility.reason)}</p>`}<button class="button" data-job-offer="${job.id}" ${disabled ? "disabled" : ""} title="${escapeText(blockReason)}">Teklifi kabul et</button></article>`;
      },
    ).join(
      "",
    )}</div>${active ? `<button class="button button-danger action-footer" id="quit-job" ${state.career.pendingJob || state.weekly.used >= getWeeklyActivityLimit(state) ? "disabled" : ""}>İşi bırak</button>` : ""}<div class="history career-history">${
      state.career.history?.length
        ? state.career.history
            .slice(-5)
            .reverse()
            .map(
              (entry) =>
                `<div class="memory"><strong>${entry.year}</strong> · ${escapeText(entry.label)}</div>`,
            )
            .join("")
        : `<p class="empty">Henüz bir kariyer dönüm noktası yok.</p>`
    }</div><p class="result" role="status">${escapeText(notice || "Teklif kabulü bir karar hakkı kullanır ve iş gelecek hafta başlar.")}</p></section>`;
}

function experienceSummary() {
  const job = getJobById(state.career.jobId);
  const familyId = job?.family || null;
  const weeks = familyId ? getFamilyExperience(state, familyId) : 0;
  return {
    familyLabel: familyId ? JOB_FAMILY_LABELS[familyId] || familyId : "—",
    weeks,
    months: Math.floor(weeks / 4),
    band: getCareerBand(weeks),
  };
}

function renderEducation() {
  const education = state.education;
  const progress = getEducationProgress(state);
  const fields = education.fields.length
    ? education.fields.map((field) => escapeText(getFieldLabel(field))).join(" · ")
    : "Henüz alan yok";
  const blocked = Boolean(education.active) || Boolean(state.events.active);

  return `<div class="workspace-head"><div><p class="eyebrow">EĞİTİM</p><h1>Eğitim ve yeterlilik</h1></div>${renderWeekControl()}</div>
    <section class="detail-summary panel"><div><span>Eğitim seviyesi</span><strong>${escapeText(getEducationLevelLabel(education.level))}</strong></div><div><span>Alanlar</span><strong>${fields}</strong></div><div><span>Aktif program</span><strong>${progress ? escapeText(progress.path.displayName) : "Yok"}</strong>${progress ? `<small>${escapeText(getIntensityLabel(progress.intensity))}</small>` : "<small>Şu an bir programa kayıtlı değilsin.</small>"}</div><div><span>Bu ay eğitim gideri</span><strong>${money(education.tuitionOwedThisMonth)}</strong><small>Ay sonunda tahsil edilir.</small></div></section>
    ${
      progress
        ? `<section class="panel"><div class="panel-head"><div><p class="eyebrow">DEVAM EDEN</p><h2>${escapeText(progress.path.displayName)}</h2></div><span>%${progress.percent}</span></div>
      <div class="body-row"><span>İlerleme</span><i><b style="width:${progress.percent}%"></b></i><strong>${progress.points}/${progress.targetPoints}</strong></div>
      <dl class="edu-facts"><div><dt>Yoğunluk</dt><dd>${escapeText(getIntensityLabel(progress.intensity))}</dd></div><div><dt>Kalan süre</dt><dd>${progress.remainingWeeks} hafta</dd></div><div><dt>Aylık ücret</dt><dd>${money(progress.path.monthlyTuition)}</dd></div><div><dt>Haftalık yük</dt><dd>Enerji ${progress.weeklyLoad.energy} · Stres +${progress.weeklyLoad.stress}</dd></div></dl>
      <button class="button button-danger action-footer" id="stop-education">Eğitimi bırak</button><p class="context-note">Bırakırsan biriken ilerleme silinir, ödenen ücret iade edilmez ve bu ayın eğitim gideri yine tahsil edilir.</p></section>`
        : ""
    }
    <section class="panel"><div class="panel-head"><div><p class="eyebrow">PROGRAMLAR</p><h2>Eğitim yolları</h2></div></div><div class="option-grid">${EDUCATION_PATHS.map(
      (path) => {
        const affordable = state.finances.balance >= path.enrollmentFee;
        const current = education.active?.pathId === path.id;
        const fullLoad = path.load.full || { energy: 0, stress: 0 };
        const partLoad = path.load.part || { energy: 0, stress: 0 };
        return `<article class="option-card ${current ? "is-current" : ""}"><div><p class="panel-kicker">${current ? "DEVAM EDİYOR" : "PROGRAM"}</p><h3>${escapeText(path.displayName)}</h3></div><p class="context-note">${escapeText(path.summary)}</p><dl><div><dt>Süre</dt><dd>Tam ${getPathDurationWeeks(path, "full")} hafta · Yarı ${getPathDurationWeeks(path, "part")} hafta</dd></div><div><dt>Kayıt ücreti</dt><dd>${money(path.enrollmentFee)}</dd></div><div><dt>Aylık ücret</dt><dd>${money(path.monthlyTuition)}</dd></div><div><dt>Haftalık yük</dt><dd>Tam: enerji ${fullLoad.energy} · stres +${fullLoad.stress}<br>Yarı: enerji ${partLoad.energy} · stres +${partLoad.stress}</dd></div><div><dt>Kazandırır</dt><dd>${path.grantsLevel ? `${escapeText(getEducationLevelLabel(path.grantsLevel))} · ` : ""}${escapeText(getFieldLabel(path.grantsField))} alanı</dd></div></dl><div class="edu-actions">${path.allowedIntensity
          .map((intensity) => {
            const disabled = blocked || !affordable;
            const reason = education.active
              ? "Zaten devam eden bir eğitimin var."
              : state.events.active
                ? "Önce açık olayı sonuçlandır."
                : !affordable
                  ? `Kayıt için ${money(path.enrollmentFee)} gerekiyor.`
                  : "";
            return `<button class="button" data-enroll="${path.id}" data-intensity="${intensity}" ${disabled ? "disabled" : ""} title="${escapeText(reason)}">${escapeText(getIntensityLabel(intensity))} başla</button>`;
          })
          .join("")}</div></article>`;
      },
    ).join(
      "",
    )}</div><p class="result" role="status">${escapeText(notice || "Eğitime kaydolmak haftalık karar hakkı kullanmaz; haftalık enerji ve stres yükü getirir.")}</p></section>`;
}

function renderHomes() {
  const activeJob = getJobById(state.career.jobId);
  const activeCommute = currentCommuteExplanation();
  const housing = getMonthlySummary(state).housingBreakdown;
  const owned = state.wealth.properties.filter((property) => property.occupancy === "owner");
  const rentals = state.wealth.properties.filter((property) => property.occupancy !== "owner");
  return `<div class="workspace-head"><div><p class="eyebrow">EV</p><h1>Konut yönetimi</h1></div>${renderWeekControl()}</div>
    ${renderHouseholdContext()}
    <section class="detail-summary panel"><div><span>Aktif konut</span><strong>${escapeText(getHomeById(state.household.homeId).title)}</strong></div><div><span>Aylık maliyet</span><strong>${money(housing.total)}</strong>${housing.partnerContribution ? `<small>Ortak gider +${money(housing.householdExtra)} · Partner payı −${money(housing.partnerContribution)}</small>` : ""}${housing.familyContribution ? `<small>Konut ${money(housing.base)} · Aile katkısı ${money(housing.familyContribution)}</small>` : ""}</div><div><span>Çalışma yeri</span><strong>${escapeText(state.career.retirement?.status === "retired" ? "Emekli" : activeJob?.title || "İşsiz")}</strong></div><div><span>Ulaşım yükü</span><strong>${escapeText(activeCommute.label)}</strong><small>${escapeText(activeCommute.detail)}</small></div></section>
    <p class="context-note">${escapeText(PRIVACY_CONTEXT)}</p>
    <section class="panel"><div class="panel-head"><div><p class="eyebrow">MÜLKİYET</p><h2>Konut varlıkların</h2></div><span>${owned.length + rentals.length}</span></div><p class="context-note">${owned.length ? "Bu evin sahibi sensin; katalog kirası yerine bakım ve varsa konut borcu ödüyorsun." : "Mevcut konut aile veya kiralama düzeninde."}${rentals.length ? ` · ${rentals.length} yatırım mülkü: ${rentals.filter((property) => property.occupancy === "rental").length} kirada.` : ""}</p><button class="button button-quiet" data-view="finance">Alım, satış ve borçları PARA ekranında yönet</button></section>
    <section class="panel"><div class="panel-head"><div><p class="eyebrow">SEÇENEKLER</p><h2>Konut alternatifleri</h2></div></div><div class="option-grid">${HOMES.map(
      (home) => {
        const cost = getMoveCost(home.id);
        const current = state.household.homeId === home.id;
        const affordable = state.finances.balance >= cost;
        const disabled =
          current ||
          !affordable ||
          state.weekly.used >= getWeeklyActivityLimit(state) ||
          state.events.active;
        const commute = getCommuteExplanation(home.id, state.career.jobId, state);
        return `<article class="option-card ${current ? "is-current" : ""}"><div><p class="panel-kicker">${current ? "MEVCUT EV" : "KONUT"}</p><h3>${escapeText(home.title)}</h3></div><dl><div><dt>Mahremiyet</dt><dd>${lifeLabel(home.privacy)}</dd></div><div><dt>Aylık maliyet</dt><dd>${money(home.monthlyCost)}</dd></div><div><dt>İşe ulaşım</dt><dd>${escapeText(commute.label)}</dd></div><div><dt>Haftalık ulaşım</dt><dd>${escapeText(commute.detail)}</dd></div><div><dt>Taşınma</dt><dd>${money(cost)}</dd></div></dl><button class="button" data-move-home="${home.id}" ${disabled ? "disabled" : ""}>${current ? "Burada yaşıyorsun" : affordable ? "Taşın" : "Para yetersiz"}</button></article>`;
      },
    ).join(
      "",
    )}</div><p class="result" role="status">${escapeText(notice || "Taşınma bir karar hakkı ve tek seferlik taşınma maliyeti kullanır.")}</p></section>`;
}

function getFriendLoanAmount() {
  const definition = getEventDefinition("loan_repayment");
  const collect = definition?.choices.find((choice) => choice.id === "collect");
  return Number.isFinite(collect?.effects?.money) ? collect.effects.money : null;
}

function renderFinance() {
  const monthly = getMonthlySummary(state);
  const worth = netWorth(state);
  const projectedBalance = state.finances.balance + monthly.income - monthly.expenses;
  const personalDebts = getAllPersonalDebts();
  const friendLoan = state.openCases.find(
    (item) => item.type === "friend-loan" && item.status !== "resolved",
  );
  const friendLoanAmount = getFriendLoanAmount();
  const owedToPlayer = [
    ...personalDebts.map(({ person, debt }) => ({
      name: person.name,
      amount: debt.payload.amount,
    })),
    ...(friendLoan && friendLoanAmount ? [{ name: "Mehmet", amount: friendLoanAmount }] : []),
  ];
  const ledger = [...state.finances.ledger].reverse().slice(0, 40);
  const wealthButton = (action, value, label, detail, disabled = false) => {
    const availability = getWealthActionAvailability(state, action, value);
    const reason = disabled && availability.ok ? "Bu seçenek mevcut durumda kullanılamıyor." : availability.reason || "";
    return `<button class="button decision wealth-action" data-wealth-action="${action}" data-wealth-value="${value}" ${disabled || !availability.ok ? "disabled" : ""} title="${escapeText(reason)}"><strong>${escapeText(label)}</strong><small>${escapeText(detail)}${reason ? ` · ${escapeText(reason)}` : ""}</small></button>`;
  };
  return `<div class="workspace-head"><div><p class="eyebrow">FİNANS</p><h1>Mali durum ve net servet</h1></div>${renderWeekControl()}</div>
    <section class="detail-summary panel wealth-summary">
      <div><span>Bakiye</span><strong>${money(state.finances.balance)}</strong></div><div><span>Net servet</span><strong>${money(worth.total)}</strong><small>Nakit ${money(worth.cash)} · Yatırım ${money(worth.investments)} · Gayrimenkul ${money(worth.property)} · Araç/eşya ${money(worth.vehicle + worth.durables)} · Borç −${money(worth.debt)}</small></div>
      <div><span>Aylık gelir</span><strong>${money(monthly.income)}</strong><small>Maaş ${money(monthly.salary)}${monthly.retirementIncome ? ` · Emeklilik ${money(monthly.retirementIncome)}` : ""}${monthly.wealth.income ? ` · Kira ${money(monthly.wealth.income)}` : ""}</small></div>
      <div><span>Aylık gider</span><strong>${money(monthly.expenses)}</strong><small>Konut ${money(monthly.housing)} · Yaşam/varlık ${money(monthly.wealth.expenses)} · Diğer ${money(monthly.otherExpenses)}${monthly.parenting ? ` · Çocuk ${money(monthly.parenting)}` : ""}</small></div>
      <div><span>Ay sonu tahmini</span><strong>${money(projectedBalance)}</strong></div>
    </section>
    <section class="panel"><div class="panel-head"><div><p class="eyebrow">YAŞAM STANDARDI</p><h2>Gündelik düzen</h2></div><span>${escapeText(LIFESTYLE_TIERS[state.wealth.lifestyle].label)}</span></div><p class="context-note">Daha yüksek standart yalnız daha fazla seçenek ve düzenli gider sağlar; mutluluk satın alınmaz.</p><div class="wealth-grid">${Object.entries(
      LIFESTYLE_TIERS,
    )
      .map(([id, tier]) =>
        wealthButton(
          "lifestyle",
          id,
          tier.label,
          `Aylık ${money(tier.monthly)}`,
          state.wealth.lifestyle === id,
        ),
      )
      .join("")}</div></section>
    <section class="panel"><div class="panel-head"><div><p class="eyebrow">TÜKETİM</p><h2>Market</h2></div><span>ayrı ekran</span></div><p class="context-note">Günlük harcama, gece hayatı, hediye ve riskli alışveriş MARKET ekranında.</p><button class="button button-quiet" data-view="market">Market'e geç</button></section>
    <section class="panel"><div class="panel-head"><div><p class="eyebrow">ABONELİKLER</p><h2>Düzenli hizmetler</h2></div><span>${state.wealth.subscriptions.length}</span></div><div class="wealth-grid">${Object.entries(
      SUBSCRIPTIONS,
    )
      .map(([id, item]) => {
        const active = state.wealth.subscriptions.some((x) => x.id === id);
        return wealthButton(
          "subscription",
          id,
          item.label,
          active
            ? `Aktif · aylık ${money(item.monthly)} · kapat`
            : `Aylık ${money(item.monthly)} · başlat`,
        );
      })
      .join("")}</div></section>
    <section class="panel"><div class="panel-head"><div><p class="eyebrow">YATIRIMLAR</p><h2>Soyut varlık sınıfları</h2></div><span>${money(worth.investments)}</span></div><p class="context-note">Değerler ay sonunda deterministik değişir. Her işlemde %1 alış/satış farkı vardır; getiri garanti değildir.</p><div class="wealth-grid">${Object.entries(
      INVESTMENTS,
    )
      .map(([id, item]) => {
        const p = state.wealth.investments.find((x) => x.id === id);
        const pl = investmentPL(p), risk = Math.max(...item.monthlyRates.map(Math.abs)) >= .04 ? economyText("Yüksek", "High") : item.monthlyRates.some(r=>r<0) ? economyText("Orta", "Moderate") : economyText("Düşük", "Low");
        return `<article class="wealth-card"><strong>${escapeText(item.label)}</strong><small>Değer ${money(p?.value || 0)} · Maliyet ${money(p?.basis || 0)}</small><p class="investment-pl">${economyText("Gerçekleşmemiş kâr/zarar", "Unrealized P/L")}: ${money(pl.amount)} (${pl.percent.toFixed(1)}%)</p><small>${economyText("Risk", "Risk")}: ${risk} · ${economyText("Satışta %1 işlem farkı daha düşülür.", "Selling deducts a further 1% fee.")}</small><div class="wealth-actions">${wealthButton("invest-buy", id, "₺5.000 al", "İşlem farkı dahil", state.finances.balance < 5050)}${wealthButton("invest-sell", id, "₺5.000 sat", "Nakit yarat", (p?.value || 0) < 5000)}${wealthButton("invest-sell-all", id, economyText("Tümünü sat", "Sell all"), economyText("Net tutardan %1 düşülür", "A 1% fee is deducted"), !(p?.value > 0))}</div></article>`;
      })
      .join("")}</div></section>
    <section class="panel"><h2>${economyText("Sahip olduğun eşyalar", "Owned items")}</h2>${state.wealth.durables.map(d=>`<p>${escapeText(DURABLES[d.id].label)} · ${escapeText(durableBenefit(d.id))} · ${economyText("İkinci el değeri", "Resale value")} ${money(Math.round(d.price*DURABLES[d.id].resale))}</p>${wealthButton("sell-durable",d.id,economyText("İkinci el sat", "Sell used"),economyText("1 karar; eşyanın faydası sona erer", "1 decision; ownership benefit ends"))}`).join("") || economyText("Henüz kalıcı eşya yok. Market'ten alabilirsin.", "No owned items yet. Buy them in Market.")}</section>
    <section class="panel"><h2>${economyText("Yatırım raporu", "Investment report")}</h2>${state.finances.ledger.filter(row=>row.category==="valuation").slice(-11).map(row=>`<p>${economyText("Hafta", "Week")} ${row.week}: ${escapeText(row.reason)}</p>`).join("") || economyText("İlk ay kapanışında gerçekleşmemiş değer değişimleri görünür.", "Unrealized value changes appear at the first month close.")}</section>
    <section class="panel"><div class="panel-head"><div><p class="eyebrow">ARAÇ</p><h2>Ulaşım varlığı</h2></div><span>${state.wealth.vehicle ? escapeText(VEHICLES[state.wealth.vehicle.tier].label) : "Araç yok"}</span></div><div class="wealth-grid">${
      state.wealth.vehicle
        ? wealthButton(
            "vehicle-sell",
            "current",
            "Aracı sat",
            `Tahmini değer ${money(state.wealth.vehicle.currentValue)}`,
          )
        : Object.entries(VEHICLES)
            .map(
              ([id, item]) =>
                `${wealthButton("vehicle-cash", id, item.label, `${money(item.price)} peşin`, state.finances.balance < item.price)}${wealthButton("vehicle-finance", id, `${item.label} · finansman`, `%35 peşinat · aylık gider ve borç`, state.finances.balance < Math.ceil(item.price * 0.35))}`,
            )
            .join("")
    }</div></section>
    <section class="panel"><div class="panel-head"><div><p class="eyebrow">GAYRİMENKUL</p><h2>Ev ve kiralık mülk</h2></div><span>${state.wealth.properties.length}/3</span></div><p class="context-note">Oturulan evde kira durur; bakım ve varsa konut borcu işler. Kiralık mülk düzenli gelir ve gider yaratır.</p><div class="wealth-grid">${[...state.wealth.properties.flatMap((p) => [wealthButton("property-sell", p.id, p.occupancy === "owner" ? "Oturulan evi sat" : "Yatırım mülkünü sat", `Değer ${money(p.currentValue)}`), ...(p.occupancy === "owner" ? [] : [wealthButton(p.occupancy === "rental" ? "property-vacant" : "property-rent", p.id, p.occupancy === "rental" ? "Boş bırak" : "Kiraya ver", p.occupancy === "rental" ? "Kira geliri durur" : "Aylık kira geliri başlar")])]), wealthButton("property-owner", "cash", "Oturulan ev al", money(480000), state.finances.balance < 480000 || state.wealth.properties.some((p) => p.occupancy === "owner")), wealthButton("property-owner", "mortgage", "Oturulan ev · konut borcu", "%30 peşinat", state.finances.balance < 144000 || state.wealth.properties.some((p) => p.occupancy === "owner")), wealthButton("property-rental", "cash", "Kiralık mülk al", money(420000), state.finances.balance < 420000 || state.wealth.properties.some((p) => p.occupancy === "rental")), wealthButton("property-rental", "mortgage", "Kiralık mülk · konut borcu", "%30 peşinat", state.finances.balance < 126000 || state.wealth.properties.some((p) => p.occupancy === "rental"))].join("")}</div></section>
    <section class="panel"><div class="panel-head"><div><p class="eyebrow">BORÇLAR</p><h2>Varlığa bağlı yükümlülükler</h2></div><span>${money(worth.debt)}</span></div>${state.wealth.debts.length ? state.wealth.debts.map((d) => `<p class="open-case"><b>${d.type === "mortgage" ? "Konut borcu" : d.type === "vehicle" ? "Araç borcu" : "Kişisel borç"}</b><span>${money(d.principal)} · aylık ${money(Math.min(d.principal, d.monthlyPayment))}</span></p>`).join("") : `<p class="empty">Varlığa bağlı borç yok.</p>`}</section>
    <section class="panel"><div class="panel-head"><div><p class="eyebrow">ALACAKLAR</p><h2>Sana borçlu olanlar</h2></div><span>${owedToPlayer.length}</span></div>${owedToPlayer.length ? owedToPlayer.map((item) => `<p class="open-case"><b>${escapeText(item.name)}</b><span>${money(item.amount)}</span></p>`).join("") : `<p class="empty">Şu anda kimsenin sana borcu yok.</p>`}</section>
    <section class="panel"><div class="panel-head"><div><p class="eyebrow">İŞLEMLER</p><h2>Son işlemler</h2></div><span>${state.finances.ledger.length}</span></div><div class="history">${ledger.length ? ledger.map((entry) => `<div class="memory"><strong>${entry.amount >= 0 ? "+" : ""}${money(entry.amount)}</strong> · ${escapeText(entry.reason)} · <span>${escapeText(weeksAgoLabel(entry.week))}</span></div>`).join("") : `<p class="empty">Henüz bir işlem kaydı yok.</p>`}</div><p class="result" role="status">${escapeText(notice || "Varlıklar piyasa değeriyle, borçlar kalan anaparayla gösterilir.")}</p></section>`;
}

function renderMarket() {
  const wealthButton = (action, value, label, detail, disabled = false) => {
    const availability = getWealthActionAvailability(state, action, value);
    const reason = disabled && availability.ok ? "Bu seçenek mevcut durumda kullanılamıyor." : availability.reason || "";
    return `<button class="button decision wealth-action" data-wealth-action="${action}" data-wealth-value="${value}" ${disabled || !availability.ok ? "disabled" : ""} title="${escapeText(reason)}"><strong>${escapeText(label)}</strong><small>${escapeText(detail)}${reason ? ` · ${escapeText(reason)}` : ""}</small></button>`;
  };
  const groups = {};
  for (const [id, item] of Object.entries(MARKET)) {
    const cat = item.category || "Diğer";
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push([id, item]);
  }
  return `<div class="workspace-head"><div><p class="eyebrow">MARKET</p><h1>Ürün, hizmet ve deneyim</h1></div>${renderWeekControl()}</div>
    <p class="context-note">Tüketim burada. Finans yalnız kasa, borç ve yatırımdır. Riskli alışveriş yasal market gibi durmaz.</p>
    ${Object.entries(groups)
      .map(
        ([cat, rows]) =>
          `<section class="panel"><div class="panel-head"><div><p class="eyebrow">KATEGORİ</p><h2>${escapeText(cat)}</h2></div><span>${rows.length}</span></div><div class="wealth-grid">${rows
            .map(([id, item]) => wealthButton("spend", id, item.label, `${money(item.cost)} · ${marketEffectText(state, id)}`))
            .join("")}</div></section>`,
      )
      .join("")}
    <section class="panel"><div class="panel-head"><div><p class="eyebrow">EŞYA</p><h2>Kalıcı kullanım</h2></div></div><div class="wealth-grid">${Object.entries(
      DURABLES,
    )
      .filter(([id]) => ["bed", "office", "entertainment"].includes(id))
      .map(([id, item]) => wealthButton("durable", id, item.label, `${money(item.price)} · ${durableBenefit(id)} · ${economyText("1 karar; tek sahiplik", "1 decision; single ownership")}`, state.finances.balance < item.price))
      .join("")}</div></section>
    <section class="panel"><div class="panel-head"><div><p class="eyebrow">Ulaşım</p><h2>Araç</h2></div></div><div class="wealth-grid">${
      state.wealth.vehicle
        ? wealthButton("vehicle-sell", "current", "Aracı sat", money(state.wealth.vehicle.currentValue))
        : Object.entries(VEHICLES)
            .map(([id, item]) => `${wealthButton("vehicle-cash", id, item.label, money(item.price), state.finances.balance < item.price)}${wealthButton("vehicle-finance", id, `${item.label} kredi`, "peşinatlı", state.finances.balance < Math.ceil(item.price * 0.35))}`)
            .join("")
    }</div></section>`;
}

function renderBody() {
  const job = getJobById(state.career.jobId);
  const commute = currentCommuteExplanation();
  const educationProgress = getEducationProgress(state);
  return `<div class="workspace-head"><div><p class="eyebrow">BEDEN</p><h1>Fiziksel ve zihinsel durum</h1></div>${renderWeekControl()}</div>
    <section class="panel body-panel">
      <p>GENEL DURUM</p>
      <div class="body-row"><span>Enerji</span><i><b style="width:${state.health.energy}%"></b></i><strong>${state.health.energy}</strong></div>
      <div class="body-row stress"><span>Stres</span><i><b style="width:${state.health.stress}%"></b></i><strong>${state.health.stress}</strong></div>
      <div class="body-row"><span>Sağlık</span><i><b style="width:${state.health.health}%"></b></i><strong>${state.health.health}</strong></div>
      <small class="body-note">${escapeText(bodyRiskText())}</small>
      <p class="panel-kicker">BİLİNEN DURUMLAR</p>
      <div class="known-conditions">${
        getKnownBodyConditions(state)
          .map((c) => `<p>${escapeText(c.name)} — ${escapeText(c.outcome)}.</p>`)
          .join("") || `<p class="empty">Bilinen kalıcı bir durum yok.</p>`
      }</div>
      ${state.body?.warningAvailable || getKnownBodyConditions(state).length ? `<small class="body-note">${escapeText(getBodyCareContext(state))}</small>` : ""}
    </section>
    <section class="detail-summary panel">
      <div><span>İş yükü</span><strong>${escapeText(lifeLabel(job?.load || 0))}</strong></div>
      <div><span>Ulaşım yükü</span><strong>${escapeText(commute.label)}</strong><small>${escapeText(commute.detail)}</small></div>
      <div><span>Eğitim yükü</span><strong>${educationProgress ? escapeText(getIntensityLabel(educationProgress.intensity)) : "Yok"}</strong>${educationProgress ? `<small>Enerji ${educationProgress.weeklyLoad.energy} · Stres +${educationProgress.weeklyLoad.stress}</small>` : ""}</div>
    </section>`;
}

function renderHistory() {
  const entries = [...state.events.history].reverse().slice(0, 60);
  return `<div class="workspace-head"><div><p class="eyebrow">GEÇMİŞ</p><h1>Hayat kayıtları</h1></div>${renderWeekControl()}</div>
    <section class="panel"><div class="panel-head"><div><p class="eyebrow">OLAYLAR</p><h2>Yaşananlar</h2></div><span>${state.events.history.length}</span></div><div class="history">${
      entries.length
        ? entries
            .map((entry) => {
              const definition = getEventDefinition(entry.eventId);
              const choice = definition?.choices.find((item) => item.id === entry.choiceId);
              const title = definition ? definition.title : "Bir olay";
              const summary = choice ? getChoiceEffectSummary(choice) : "";
              return `<div class="memory"><strong>${escapeText(weeksAgoLabel(entry.week))}</strong> · ${escapeText(title)}${choice ? `: ${escapeText(choice.label)}` : ""}${summary ? ` — ${escapeText(summary)}` : ""}</div>`;
            })
            .join("")
        : `<p class="empty">Henüz kayıtlı bir yaşam olayı yok.</p>`
    }</div></section>`;
}

function renderYearbook() {
  const years = [...state.yearlyHistory].reverse();
  return `<div class="workspace-head"><div><p class="eyebrow">YIL DOSYASI</p><h1>Tamamlanan yıllar</h1></div>${renderWeekControl()}</div>
    <section class="panel"><div class="panel-head"><div><p class="eyebrow">YILLAR</p><h2>Yıl özetleri</h2></div><span>${years.length}</span></div>${
      years.length
        ? years
            .map((year) => {
              const net = year.endingBalance - year.startingBalance;
              const job =
                year.career?.retirementStatus === "retired"
                  ? "Emekli"
                  : year.career?.jobId
                    ? getJobById(year.career.jobId)?.title || "İş kaydı"
                    : "İşsiz";
              const home = year.housing?.homeId
                ? getHomeById(year.housing.homeId)?.title || "Konut kaydı"
                : null;
              const education = year.education?.level
                ? getEducationLevelLabel(year.education.level)
                : null;
              const health = year.health;
              const relationshipSummary = Object.entries(year.relationships || {})
                .map(([personId, value]) => {
                  const person = getPerson(state, personId);
                  return person ? `${person.name} ${value}` : null;
                })
                .filter(Boolean)
                .slice(0, 3);
              const details = [
                `İş: ${job}`,
                year.netWorth
                  ? `Net servet: ${money(year.netWorth.total)} · yatırım ${money(year.netWorth.investments)} · gayrimenkul ${money(year.netWorth.property)} · borç ${money(year.netWorth.debt)}`
                  : null,
                year.lifestyle
                  ? `Yaşam standardı: ${LIFESTYLE_TIERS[year.lifestyle]?.label || "Mütevazı"}`
                  : null,
                home ? `Konut: ${home}` : null,
                education ? `Eğitim: ${education}` : null,
                health
                  ? `Beden: enerji ${health.end?.energy ?? health.energy} · stres ${health.end?.stress ?? health.stress} · sağlık ${health.end?.health ?? health.health}`
                  : null,
                health?.start
                  ? `Yıl başı sağlık ${health.start.health} · yıl sonu sağlık ${health.end.health}`
                  : null,
                health?.conditions?.length
                  ? health.conditions
                      .filter((item) => item.name && item.outcome)
                      .map((item) => `${item.name} — ${item.outcome}`)
                      .join(" · ")
                  : null,
                Number.isInteger(year.knownObligations)
                  ? `Bilinen açık mesele: ${year.knownObligations}`
                  : null,
                Number.isInteger(year.meaningfulEvents)
                  ? `Önemli olay: ${year.meaningfulEvents}`
                  : null,
                year.priorities?.length
                  ? `Öncelikler: ${year.priorities.map((id) => PRIORITY_OPTIONS[id] || id).join(" · ")}`
                  : null,
                year.priorityReflection?.length
                  ? `Yılın karşılığı: ${year.priorityReflection.join(" · ")}`
                  : null,
                relationshipSummary.length ? `İlişkiler: ${relationshipSummary.join(" · ")}` : null,
                year.household?.partnerName
                  ? `Ortak yaşam: ${year.household.partnerName} · ${year.household.status} · ${year.household.residence}`
                  : null,
                year.parenting?.children?.length ? year.parenting.children.join(" · ") : null,
                year.parenting?.pregnancy || null,
                year.parenting?.births?.length ? year.parenting.births.join(" · ") : null,
                year.household?.milestones?.length ? year.household.milestones.join(" · ") : null,
                year.career?.milestones?.length
                  ? `Kariyer: ${year.career.milestones.join(" · ")}`
                  : null,
              ].filter(Boolean);
              return `<div class="open-case"><b>${year.year}</b><span>Başlangıç ${money(year.startingBalance)} · Bitiş ${money(year.endingBalance)} · Net ${net >= 0 ? "+" : ""}${money(net)}</span>${details.length ? `<span>${escapeText(details.join(" · "))}</span>` : ""}${year.importantMemories.length ? `<span>${year.importantMemories.map((text) => escapeText(text)).join(" · ")}</span>` : ""}</div>`;
            })
            .join("")
        : `<p class="empty">İlk yıl tamamlandığında burada bir dosya oluşacak.</p>`
    }</section>`;
}

function renderCharacter() {
  const job = getJobById(state.career.jobId);
  const home = getHomeById(state.household.homeId);
  const partner = state.social.currentPartnerNpcId
    ? getPerson(state, state.social.currentPartnerNpcId)
    : null;
  const closest = [...state.people].sort(
    (a, b) => state.relationships[b.id] - state.relationships[a.id],
  )[0];
  const background = state.player.background || {};
  const tendencyRows = [
    ["risk", "Risk yaklaşımı"],
    ["discipline", "Düzen"],
    ["sociability", "Sosyallik"],
    ["frugality", "Harcama"],
  ];
  const priorities = state.yearlyPlan?.year === state.time.year ? state.yearlyPlan.priorities : [];
  return `<div class="workspace-head"><div><p class="eyebrow">BEN</p><h1>${escapeText(state.player.name)}</h1></div>${renderWeekControl()}</div>
    <section class="detail-summary panel">
      <div><span>Yaş</span><strong>${state.player.age}</strong><small>${escapeText(state.player.profile)}</small></div>
      <div><span>Tarih</span><strong>${state.time.year} · ${state.time.month}. ay</strong><small>H${state.time.weekOfMonth} · ${escapeText(getEraById(state.world.eraId).title)}</small></div>
      <div><span>Şehir</span><strong>${escapeText(state.player.city)}</strong></div>
      <div><span>Yaşam yeri</span><strong>${escapeText(home.title)}</strong><small>${home.id === "family" ? "Aileyle birlikte" : "Ayrı yaşıyor"}</small></div>
    </section>
    <section class="detail-summary panel">
      <div><span>İş</span><strong>${escapeText(state.career.retirement?.status === "retired" ? "Emekli" : job?.title || "İşsiz")}</strong>${state.career.pendingJob ? `<small>${escapeText(getJobById(state.career.pendingJob.jobId)?.title || "")} bekleniyor</small>` : ""}</div>
      <div><span>Eğitim</span><strong>${escapeText(getEducationLevelLabel(state.education.level))}</strong>${state.education.active ? `<small>Devam ediyor</small>` : ""}</div>
      <div><span>Bakiye</span><strong>${money(state.finances.balance)}</strong></div>
      <div><span>İlişki durumu</span><strong>${partner ? `${escapeText(partner.name)} · ${escapeText(getHouseholdSummary(state).status)}` : "Sevgili yok"}</strong><small>En yakın: ${escapeText(closest.name)}</small></div>
      <div><span>Beden</span><strong>Enerji ${state.health.energy}</strong><small>Stres ${state.health.stress} · Sağlık ${state.health.health}</small></div>
    </section>
    <section class="panel"><div class="panel-head"><div><p class="eyebrow">ARKA PLAN</p><h2>Hayatının başlangıç koşulları</h2></div></div>
      <p class="context-note">${escapeText(BACKGROUND_OPTIONS.family[background.family] || "Destekleyici aile")} · ${escapeText(BACKGROUND_OPTIONS.economic[background.economic] || "Mütevazı başlangıç")} · ${escapeText(BACKGROUND_OPTIONS.education[background.education] || "Genel lise")} · ${escapeText(BACKGROUND_OPTIONS.social[background.social] || "Yakın çevre")}</p>
      <div class="detail-summary">${tendencyRows.map(([key, label]) => `<div><span>${label}</span><strong>${escapeText(getTendencyLabel(key, state.player.tendencies?.[key] ?? 50))}</strong><small>${state.player.tendencies?.[key] ?? 50}/100</small></div>`).join("")}</div>
    </section>
    <section class="panel"><div class="panel-head"><div><p class="eyebrow">YILLIK ÖNCELİKLER</p><h2>${state.yearlyPlan?.year || state.time.year} yılı</h2></div></div>
      ${priorities.length ? `<p class="context-note">${priorities.map((id) => escapeText(PRIORITY_OPTIONS[id])).join(" · ")}</p>` : `<p class="empty">Bu yıl için henüz bir öncelik seçmedin.</p>`}
      <form id="yearly-plan-form" class="priority-form"><div class="priority-options">${Object.entries(
        PRIORITY_OPTIONS,
      )
        .map(
          ([id, label]) =>
            `<label><input type="checkbox" name="priority" value="${id}" ${priorities.includes(id) ? "checked" : ""}> ${escapeText(label)}</label>`,
        )
        .join(
          "",
        )}</div><button class="button button-quiet" type="submit">Öncelikleri kaydet</button></form>
    </section>`;
}

// "job-start" burada ayrıca listelenmez; aşağıda pendingJob üzerinden daha ayrıntılı gösterilir.

function renderCalendar() {
  const monthly = getMonthlySummary(state);
  const weeksLeftInMonth = WEEKS_PER_MONTH - state.time.weekOfMonth + 1;
  const educationProgress = getEducationProgress(state);
  const knownCases = getKnownOpenCases(state);
  const personalDebts = getAllPersonalDebts();
  const itemCount =
    knownCases.length +
    personalDebts.length +
    (state.career.pendingJob ? 1 : 0) +
    (educationProgress ? 1 : 0) +
    (state.military?.applicable && state.military.status === "pending" && state.military.dueWeek
      ? 1
      : 0);
  return `<div class="workspace-head"><div><p class="eyebrow">TAKVİM</p><h1>Bilinen yükümlülükler</h1></div>${renderWeekControl()}</div>
    <section class="panel"><div class="panel-head"><div><p class="eyebrow">AY SONU</p><h2>Düzenli tahsilat</h2></div></div><p class="context-note">${weeksLeftInMonth} hafta sonra ay kapanır: ${money(monthly.income)} gelir, ${money(monthly.expenses)} gider işlenecek.</p></section>
    <section class="panel"><div class="panel-head"><div><p class="eyebrow">BİLİNEN İŞLER</p><h2>Yaklaşan tarihler</h2></div><span>${itemCount}</span></div>${
      itemCount
        ? `${
            state.career.pendingJob
              ? `<p class="open-case"><b>${escapeText(getJobById(state.career.pendingJob.jobId)?.title || "Yeni iş")} başlıyor</b><span>${escapeText(weeksAheadLabel(state.career.pendingJob.startWeek))}</span></p>`
              : ""
          }${
            educationProgress
              ? `<p class="open-case"><b>${escapeText(educationProgress.path.displayName)} tamamlanıyor</b><span>${educationProgress.remainingWeeks} hafta içinde</span></p>`
              : ""
          }${knownCases
            .map(
              (item) =>
                `<p class="open-case"><b>${escapeText(openCaseLabel(item))}</b><span>${escapeText(weeksAheadLabel(item.dueWeek))}</span></p>`,
            )
            .join("")}${personalDebts
            .map(
              ({ person, debt }) =>
                `<p class="open-case"><b>${escapeText(person.name)}: ${money(debt.payload.amount)} borçlu</b><span>Bekleniyor</span></p>`,
            )
            .join("")}` +
          (state.military?.applicable &&
          state.military.status === "pending" &&
          state.military.dueWeek
            ? `<p class="open-case"><b>Askerlik yükümlülüğü</b><span>${escapeText(weeksAheadLabel(state.military.dueWeek))}</span></p>`
            : "")
        : `<p class="empty">Şu anda bilinen bir yükümlülüğün yok.</p>`
    }</section>`;
}

function phraseText(value) {
  return window.tlabI18n?.phrase?.(value) ?? value;
}

/**
 * Olay metni. Taşınan içerik kendi EN karşılığını olay tanımında taşır; kısa
 * ve genel etiketleri ("Ara", "Git") site geneli sözlüğe koymak başka oyunların
 * metinlerini de çevireceği için bilinçli olarak olaya bağlı tutuldu.
 * TR kanonik: EN yoksa mevcut sözlük davranışı aynen sürer.
 */
function eventTitle(definition) {
  if (window.tlabI18n?.getLang?.() === "en" && definition.en?.title) return definition.en.title;
  return phraseText(definition.title);
}
function eventBody(definition) {
  if (window.tlabI18n?.getLang?.() === "en" && definition.en?.text) return definition.en.text;
  return phraseText(definition.text);
}
function eventChoiceLabel(definition, choice) {
  if (window.tlabI18n?.getLang?.() === "en" && definition.en?.choices?.[choice.id])
    return definition.en.choices[choice.id];
  return phraseText(choice.label);
}

function renderEvent() {
  if (!state.events.active) return "";
  const base = getEventDefinition(state.events.active.eventId);
  // Bağlam boşken metni olduğu gibi bırak: sondaki boşluk, sözlük aramasını
  // (tam eşleşme) kaçırdığı için EN çevirisini sessizce devre dışı bırakıyordu.
  const eventContext = adultEventContext(state);
  const definition = base && { ...base, text: eventContext ? `${base.text} ${eventContext}` : base.text };
  if (!definition) return "";
  return `<div class="event-backdrop" role="presentation"><section class="event-card" role="dialog" aria-modal="true" aria-labelledby="event-title"><h2 id="event-title">${escapeText(eventTitle(definition))}</h2><p>${escapeText(eventBody(definition))}</p>${getBodyEventContext(state, definition) ? `<p>${escapeText(phraseText(getBodyEventContext(state, definition)))}</p>` : ""}<div class="event-choices">${definition.choices.map((choice) => `<button class="button event-choice" data-event-choice="${choice.id}" ${getEventChoiceAvailability(state, choice.id).ok ? "" : "disabled"} title="${escapeText(phraseText(getEventChoiceAvailability(state, choice.id).reason || ""))}"><strong>${escapeText(eventChoiceLabel(definition, choice))}</strong><small>${escapeText(phraseText(getChoiceEffectSummary(choice)))}</small></button>`).join("")}</div></section></div>`;
}

const VIEW_RENDERERS = {
  career: renderCareer,
  education: renderEducation,
  people: renderPeopleScreen,
  relationships: renderRelationshipsOverview,
  home: renderHomes,
  finance: renderFinance,
  market: renderMarket,
  body: renderBody,
  history: renderHistory,
  yearbook: renderYearbook,
  character: renderCharacter,
  calendar: renderCalendar,
};

function render() {
  if (!state) return startScreen(loadGame(localStorage));
  if (!weekStartSnapshot) weekStartSnapshot = snapshotWeekState(state);
  const terminal = Boolean(state.lifetime?.death);
  const workspace = terminal
    ? renderLifetimeTerminal(state)
    : (VIEW_RENDERERS[activeView] || renderDashboard)() +
      (["character", "history", "yearbook"].includes(activeView) ? renderLineage(state) : "");
  app.innerHTML = `
    <main class="game-frame">
      <header class="game-topbar">
        <div class="game-brand"><strong>TC SIM</strong><span>Yaşam Yönetimi</span></div>
        <div class="top-meta"><span><b>${escapeText(state.player.name)}</b> · ${state.player.age}</span><span>${state.time.year} / ${state.time.month}. ay / H${state.time.weekOfMonth}</span><span class="top-money">${money(state.finances.balance)}</span></div>
        <div class="save-area"><span class="save-status" role="status">${escapeText(saveStatus)}</span><span class="slot-mini">Slot ${getActiveSlot(localStorage)}</span><button class="button button-quiet" id="help-open" aria-haspopup="dialog">? Nasıl Oynanır</button><button class="button button-quiet" id="save-game">Kaydet</button><button class="button button-quiet" id="main-menu">Ana Menü</button><button class="button button-quiet button-danger" id="new-game">Yeni oyun</button></div>
      </header>
      <div class="game-body">
        <nav class="side-nav" aria-label="Oyun bölümleri">${terminal ? "Yaşam raporu" : renderNav()}</nav>
        <section class="workspace">${workspace}</section>
      </div>
    ${terminal ? "" : renderDeskLedger()}
    ${renderEvent()}
      ${helpOpen ? renderHelpModal() : ""}
      <footer class="game-footer">© 2026 TarikLab. Tüm hakları saklıdır.<br>Oyun tasarımı ve özgün içerik: Tarık Halil Ayaz.</footer>
    </main>`;
  applyLangPhrases();
  if (!terminal) {
    arrangeLifeDesk(activeView, confirmText);
    applyLangPhrases();
  }
  compactNavigation(document.querySelector(".side-nav"), confirmText("Diğer bölümler", "More sections"));

  document.querySelectorAll("[data-successor]").forEach(button => button.addEventListener("click", () => {
    if (!window.confirm(confirmText("Bu çocukla yeni kuşağa geçmek istiyor musun?", "Move on to this child's new generation?"))) return;
    const result = continueGeneration(state, button.dataset.successor);
    notice = result.message || result.reason;
    if (result.ok) { activeView = "dashboard"; weekStartSnapshot = null; }
    persist();
    render();
  }));
  document.querySelectorAll("[data-wealth-action]").forEach((button) => button.addEventListener("click", () => {
    const result = applyWealthAction(state, button.dataset.wealthAction, button.dataset.wealthValue);
    notice = result.message || result.reason;
    persist();
    render();
  }));
  document.querySelectorAll("[data-decision]").forEach((button) =>
    button.addEventListener("click", () => {
      const result = applyDecision(state, button.dataset.decision);
      notice = result.reason || result.message;
      persist();
      render();
    }),
  );
  document.querySelectorAll("[data-view]").forEach((button) =>
    button.addEventListener("click", () => {
      const target = getNavigationTarget(button.dataset.view);
      if (!target) return;
      activeView = target;
      notice = "";
      render();
      if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
    }),
  );
  document.querySelectorAll("[data-person]").forEach((button) =>
    button.addEventListener("click", () => {
      selectedPersonId = button.dataset.person;
      notice = "";
      render();
    }),
  );
  document.querySelectorAll("[data-open-person]").forEach((button) =>
    button.addEventListener("click", () => {
      selectedPersonId = button.dataset.openPerson;
      activeView = "people";
      notice = "";
      render();
    }),
  );
  document.querySelector("#yearly-plan-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const selected = [...event.currentTarget.querySelectorAll("input[name=priority]:checked")].map(
      (input) => input.value,
    );
    setYearlyPriorities(state, selected);
    notice = selected.length
      ? "Yıllık önceliklerin kaydedildi."
      : "Yıllık önceliklerin temizlendi.";
    persist();
    render();
  });
  document.querySelectorAll("[data-social-action]").forEach((button) =>
    button.addEventListener("click", () => {
      const result = applySocialAction(state, button.dataset.personId, button.dataset.socialAction);
      notice = result.reason || result.message;
      persist();
      render();
    }),
  );
  document.querySelectorAll("[data-job-offer]").forEach((button) =>
    button.addEventListener("click", () => {
      const result = acceptJobOffer(state, button.dataset.jobOffer);
      notice = result.reason || result.message;
      persist();
      render();
    }),
  );
  document.querySelectorAll("[data-enroll]").forEach((button) =>
    button.addEventListener("click", () => {
      const result = enrollEducation(state, button.dataset.enroll, button.dataset.intensity);
      notice = result.reason || result.message;
      persist();
      render();
    }),
  );
  document.querySelector("#stop-education")?.addEventListener("click", () => {
    if (!window.confirm(confirmText("Eğitimi bırakırsan biriken ilerleme silinir. Devam edilsin mi?", "Quitting the program erases your accumulated progress. Continue?"))) return;
    const result = stopEducation(state);
    notice = result.reason || result.message;
    persist();
    render();
  });
  document.querySelector("#quit-job")?.addEventListener("click", () => {
    const result = quitJob(state);
    notice = result.reason || result.message;
    persist();
    render();
  });
  document.querySelectorAll("[data-move-home]").forEach((button) =>
    button.addEventListener("click", () => {
      const result = moveHome(state, button.dataset.moveHome);
      notice = result.reason || result.message;
      persist();
      render();
    }),
  );
  document.querySelectorAll("[data-event-choice]").forEach((button) =>
    button.addEventListener("click", () => {
      const result = resolveEvent(state, button.dataset.eventChoice);
      notice = result.message;
      persist();
      render();
    }),
  );
  document.querySelector("#advance-week")?.addEventListener("click", () => {
    const before = weekStartSnapshot || snapshotWeekState(state);
    const result = advanceWeek(state);
    if (result.ok) {
      const changes = summarizeWeek(before, state);
      notice = changes.length
        ? changes.map((change) => describeWeeklyChange(change)).join(" · ")
        : "Sakin bir hafta geçti.";
      weekStartSnapshot = null;
    } else {
      notice = result.messages.join(" ");
    }
    persist();
    render();
  });
  document.querySelector("#help-open")?.addEventListener("click", () => {
    helpOpen = true;
    render();
  });
  document.querySelector("#help-close")?.addEventListener("click", () => {
    helpOpen = false;
    render();
  });
  document.querySelector("#save-game").addEventListener("click", () => {
    persist("Elle kaydedildi.");
    render();
  });
  document.querySelector("#new-game").addEventListener("click", () => {
    if (!window.confirm(confirmText("Mevcut hayatı silip yeni oyuna dönmek istiyor musun?", "Delete the current life and start a new game?"))) return;
    if (!clearSaves(localStorage)) {
      saveStatus = "Eski kayıt silinemedi; mevcut yaşam açık tutuldu.";
      render();
      return;
    }
    state = null;
    notice = "";
    saveStatus = "";
    weekStartSnapshot = null;
    render();
  });
  // The root screen, reached without discarding anything: the life is saved
  // first so returning to it is never a way to lose the run.
  document.querySelector("#main-menu")?.addEventListener("click", () => {
    persist();
    state = null;
    notice = "";
    weekStartSnapshot = null;
    render();
  });
}

// Keep the standalone language control outside the rebuilt app. Embedded play
// uses the portal toggle; this replaces the static-page boot/reload handler.
window.tlabI18n?.applyHtmlLang?.();
const languageHost = document.querySelector("#tc-sim-language");
if (languageHost && window.self === window.top) {
  languageHost.hidden = false;
  window.tlabI18n?.mountLangToggle?.(languageHost);
}

// Language changes are presentation-only: rebuild canonical templates without
// loading/saving again, advancing time, or losing an unfinished setup form.
window.tlabI18n?.onLang?.(() => {
  if (state) {
    render();
    return;
  }
  if (!startLoadResult) return;
  const fields = [...document.querySelectorAll("#new-game-form [name]")]
    .map(field => [field.name, field.value]);
  const focusedName = document.activeElement?.name;
  startScreen(startLoadResult);
  for (const field of document.querySelectorAll("#new-game-form [name]")) {
    const saved = fields.find(([name]) => name === field.name);
    if (saved) field.value = saved[1];
    if (field.name === focusedName) field.focus();
  }
});

window.addEventListener?.("keydown", (event) => {
  if (event.key === "Escape" && helpOpen) {
    helpOpen = false;
    render();
  }
});

render();
