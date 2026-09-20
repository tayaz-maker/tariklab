import { progressOf, regionOf, REGION_NAMES, SPECIALIZATIONS, PROJECT_QUOTAS, projectRequirements } from "./campaign.js";
import {
  createGame,
  advance,
  dispatch,
  getRates,
  getBuildCost,
  getTravelEstimate,
  getCampaign,
  getSettlementAt,
  getPlayerSettlements,
  getFaction,
  getCapacity,
  getExpansionCost,
  getTileKnowledge,
  getSettlementRole,
  getTradeCapacity,
} from "./engine.js";
import { RESOURCES, TERRAINS, POIS, BUILDINGS, UNITS } from "./data.js";
import { getTile } from "./world.js";
import { createMap } from "./map.js";
import { SaveManager } from "./save.js";

const $ = (id) => document.getElementById(id);
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char],
  );
const fmt = (value) =>
  Number.isFinite(Number(value)) ? Math.floor(Number(value)).toLocaleString("tr-TR") : "—";
// Whole resource counts round down (fmt above), but sub-1 upkeep rates
// (e.g. a scout's 0.9/hour) would all floor to the same "0" and lose the
// difference between unit types. One decimal keeps that distinction
// without ever showing a raw binary-float tail like 0.8999999999999999.
const fmtRate = (value) =>
  Number.isFinite(Number(value)) ? Number(value).toLocaleString("tr-TR", { maximumFractionDigits: 1 }) : "—";
const keys = Object.keys(RESOURCES);
// Position-matched to `keys` (food, wood, stone, iron): which building
// produces which resource, for the settlement screen's rate line.
const PRODUCTION_BUILDINGS = ["farm", "lumber", "quarry", "mine"];
// A building card only ever showed the CURRENT rate, so upgrading was a
// blind bet — the player had no way to tell whether the next level was
// worth its cost. getRates()'s per-resource formula is linear in the
// building's own level, so temporarily reading it one level higher (then
// restoring the real level) gives the exact post-upgrade rate without
// duplicating that formula here.
function nextLevelRate(town, buildingKey, resourceKey) {
  const before = town.buildings[buildingKey] || 0;
  const pending = town.queue.filter((q) => q.kind === "build" && q.building === buildingKey).length;
  town.buildings[buildingKey] = before + pending + 1;
  const rate = getRates(state, town)[resourceKey];
  town.buildings[buildingKey] = before;
  return rate;
}
const labels = {
  stewardship: "İdare",
  warfare: "Savaş",
  commerce: "Ticaret",
  diplomacy: "Diplomasi",
  intrigue: "Entrika",
};
// Divan reports are tagged internally (engine.js's report() calls) with a
// short English category key for the game's own bookkeeping. That key must
// never render as-is — a plain "welcome" or "shortage" next to otherwise
// fully Turkish copy reads as a leaked internal field, not a real label.
const REPORT_TYPE_LABELS = {
  welcome: "Karşılama",
  milestone: "Dönüm noktası",
  build: "İnşa",
  train: "Eğitim",
  scout: "Keşif",
  return: "Dönüş",
  settlement: "Yerleşim",
  claim: "Toprak iddiası",
  trade: "Ticaret",
  diplomacy: "Diplomasi",
  battle: "Muharebe",
  threat: "Tehdit",
  shortage: "Kaynak sıkıntısı",
  blocked: "Engellendi",
  campaign: "Kampanya",
  dynasty: "Hanedan",
  victory: "Zafer",
};
const reportTypeLabel = (type) => REPORT_TYPE_LABELS[type] || "Rapor";
const missionNames = {
  scout: "Keşif",
  attack: "Sefer",
  claim: "Stratejik nokta",
  expand: "Yerleşim kafilesi",
  trade: "Kervan",
  return: "Dönüş",
};
const saves = new SaveManager();
let state = null,
  activeId = null,
  selected = null,
  view = "map",
  toastTimer,
  lastFrame = 0,
  accumulator = 0,
  sinceSave = 0,
  busy = false,
  councilTab = "reports";
let uiPointerActive = false;
let cachedSlots = {},
  storageMessage = "",
  readyOffline = false;
const GUIDE_KEY = "tariklab::hanedanian:field-guide:v1";
const map = createMap($("world-map"), {
  onSelect(tile) {
    selected = tile ? { x: tile.x, y: tile.y } : null;
    renderInspector();
  },
  onHover(tile, point) {
    const el = $("hover-info");
    if (!tile || !state) {
      el.hidden = true;
      return;
    }
    const town = getSettlementAt(state, tile.x, tile.y);
    el.innerHTML = `<strong>${esc(town?.name || POIS[tile.poi?.type]?.label || TERRAINS[tile.terrain]?.label)}</strong><br>${tile.x} · ${tile.y}${town ? ` · ${esc(getFaction(state, town.ownerId)?.name)}` : ""}`;
    el.style.left = `${Math.max(8, Math.min(point.x + 14, $("map-workspace").clientWidth - 235))}px`;
    el.style.top = `${Math.max(64, Math.min(point.y + 14, $("map-workspace").clientHeight - 75))}px`;
    el.hidden = false;
  },
  onViewChange(info) {
    $("map-caption").innerHTML =
      `${info.mode === "world" ? "HANEDANLAR ATLASI" : info.mode === "region" ? "BÖLGE DEFTERİ" : "YERYÜZÜ DEFTERİ"} <span>${state?.world.size || 49} × ${state?.world.size || 49}</span>`;
  },
});
function activeTown() {
  const own = state ? getPlayerSettlements(state) : [];
  return own.find((t) => t.id === activeId) || own[0];
}
function player() {
  return state && getFaction(state, state.playerId);
}
function gameDate(time = state?.time || 0) {
  return `Gün ${Math.floor(time / 1440) + 1} · ${String(Math.floor((time % 1440) / 60)).padStart(2, "0")}:${String(time % 60).padStart(2, "0")}`;
}
function duration(minutes) {
  return minutes === 0
    ? "0 dk"
    : minutes >= 1440
      ? `${(minutes / 1440).toFixed(1)} gün`
      : minutes >= 60
        ? `${Math.floor(minutes / 60)} sa ${Math.ceil(minutes % 60)} dk`
        : `${Math.max(1, Math.ceil(minutes))} dk`;
}
function costText(cost) {
  if (!cost) return "";
  if (Array.isArray(cost))
    return keys
      .map((k, i) => (cost[i] ? `${fmt(cost[i])} ${RESOURCES[k].label}` : ""))
      .filter(Boolean)
      .join(" · ");
  return Object.entries(cost)
    .filter(([, v]) => typeof v === "number" && v > 0)
    .map(([k, v]) => `${fmt(v)} ${RESOURCES[k]?.label || (k === "influence" ? "Nüfuz" : k)}`)
    .join(" · ");
}
function troopsText(troops = {}) {
  return (
    Object.entries(troops)
      .filter(([, n]) => n > 0)
      .map(([k, n]) => `${fmt(n)} ${UNITS[k]?.label || k}`)
      .join(" · ") || "Birlik yok"
  );
}
function notice(message, error = false) {
  const el = $("toast");
  el.textContent = message;
  el.hidden = false;
  if ($("dialog").open) {
    $("dialog-notice").textContent = message;
    $("dialog-notice").hidden = false;
    $("dialog-notice").classList.toggle("danger", error);
  }
  el.style.background = error ? "#853e30" : "";
  // The toast floats over whatever section the player is on; reserving its
  // own height at the bottom of that section's scroll area for as long as
  // it is shown means it can sit in space the layout set aside for it
  // instead of overlapping a card's cost line or action buttons.
  document.body.classList.add("toast-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.hidden = true;
    document.body.classList.remove("toast-visible");
  }, 6500);
}
function updateSaveStatus() {
  const status = saves.status();
  const el = $("save-status");
  el.classList.toggle("storage-warning", !!status.error || !status.available);
  el.textContent =
    storageMessage ||
    (status.error
      ? "Kayıt hatası · yedek al"
      : status.unsaved
        ? "Kaydedilmemiş ilerleme"
        : status.lastSavedAt
          ? `Kaydedildi ${new Date(status.lastSavedAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}`
          : status.available
            ? "Yerel kayıt hazır"
            : "Kalıcı kayıt kullanılamıyor");
}
async function persist(slot = "auto", announce = false) {
  if (!state) return false;
  const result = await saves.save(state, slot);
  storageMessage = result.ok ? "" : result.message;
  updateSaveStatus();
  if (announce || !result.ok)
    notice(
      result.ok
        ? slot === "manual"
          ? "Elle kayıt alındı."
          : "Kampanya kaydedildi."
        : result.message,
      !result.ok,
    );
  return result.ok;
}
function doAction(action) {
  if (!state) return;
  const result = dispatch(state, action);
  notice(result.message, !result.ok);
  if (result.ok) {
    render();
    void persist();
  }
  return result;
}
function setView(next) {
  view = next;
  $("game").dataset.view = view;
  document
    .querySelectorAll("[data-view]")
    .forEach((b) => b.setAttribute("aria-current", b.dataset.view === view ? "page" : "false"));
  $("map-workspace").hidden = view !== "map";
  $("inspector").hidden = view !== "map";
  $("section-view").hidden = view === "map";
  $("hover-info").hidden = true;
  if (view === "map") {
    map.resize();
    renderInspector();
  } else renderSection();
}
function useTown(id, focus = false) {
  if (!getPlayerSettlements(state).some((t) => t.id === id)) return;
  activeId = id;
  render();
  if (focus) {
    setView("map");
    const town = activeTown();
    map.focus(town.x, town.y);
    map.select(town.x, town.y);
  }
}
function renderHeader() {
  if (!state) return;
  const town = activeTown(),
    rates = town ? getRates(state, town) : {};
  const capacity = town ? getCapacity(town) : 0;
  $("resources").innerHTML =
    keys
      .map(
        (k) =>
          `<div class="resource" title="${esc(town?.name)} · Depo ${fmt(capacity)}"><span>${RESOURCES[k].label.toLocaleUpperCase("tr")}</span><b>${fmt(town?.resources[k])}</b><small>${rates[k] >= 0 ? "+" : ""}${fmt((rates[k] || 0) * 60)}/saat</small></div>`,
      )
      .join("") +
    `<div class="resource influence"><span>NÜFUZ</span><b>${fmt(player()?.influence)}</b><small>Siyasi güç</small></div>`;
  $("game-date").textContent = gameDate();
  $("clock-state").textContent = state.paused
    ? "Dünya duraklatıldı"
    : `${state.speed}× · 1 sn = ${state.speed} oyun dk`;
  document.querySelectorAll("[data-speed]").forEach((b) => {
    const on = Number(b.dataset.speed) === (state.paused ? 0 : state.speed);
    b.classList.toggle("active", on);
    b.setAttribute("aria-pressed", String(on));
  });
  const campaign = getCampaign(state);
  const goal = campaign.goals.find((g) => !g.done);
  $("campaign-strip").innerHTML =
    `<div><strong>${esc(campaign.label)}</strong><small class="campaign-date">${esc(gameDate())}</small><span>${esc(goal ? `${goal.label}: ${fmt(goal.current)} / ${fmt(goal.target)}` : "Kurultay yolları açılıyor. Hanedan sekmesini incele.")}</span></div><button data-view="dynasty">Hedefler →</button>`;
}
function syncFieldGuide(force = false) {
  const guide = $("field-guide");
  if (!guide || !state) return;
  let dismissed = false;
  try { dismissed = localStorage.getItem(GUIDE_KEY) === "done"; } catch { /* Storage is optional. */ }
  guide.hidden = !force && (dismissed || state.time > 180);
}
function goalHTML(goal) {
  return `<div class="goal"><div><span>${esc(goal.label)}</span><span>${fmt(goal.current)} / ${fmt(goal.target)}</span></div><progress max="${goal.target}" value="${Math.min(goal.current, goal.target)}" aria-label="${esc(goal.label)}"></progress></div>`;
}
function renderRail() {
  if (!state) return;
  const towns = getPlayerSettlements(state),
    campaign = getCampaign(state);
  $("settlement-rail").innerHTML =
    `<div class="rail-head"><p class="eyebrow">YERLEŞİMLERİN</p><span class="badge">${towns.length}</span></div>${towns.map((t) => `<button class="settlement-card ${t.id === activeTown()?.id ? "active" : ""}" data-town="${esc(t.id)}"><strong>${esc(t.name)}</strong><small>${esc(getSettlementRole(state, t))} · ${t.x}, ${t.y}</small></button>`).join("")}<div class="rail-objective"><p class="eyebrow">${esc(campaign.label)}</p>${campaign.goals.map(goalHTML).join("")}</div><p class="rail-tip">Kaynaklar yerleşimlere aittir. İkinci yerleşimden sonra kervanlarla birbirini besleyen bir ağ kur.</p><button class="panel-button" data-view="council">Divan raporları →</button><p class="rail-tip">Dünya tohumu<br><strong>${esc(state.world.seed)}</strong><br>${readyOffline ? "Çevrimdışı paket hazır" : "Çevrimdışı paket hazırlanıyor"}</p>`;
}
function renderInspector() {
  const el = $("inspector");
  if (!state) return;
  if (!selected) {
    el.classList.remove("has-selection");
    el.innerHTML = `<p class="eyebrow">HARİTA REHBERİ</p><h2>Bir sonraki adımın<br>nerede?</h2><p class="muted">Bir bölge seç. Araziyi, mesafeyi ve kazancını karşılaştır.</p><div class="note">Önce yerleşiminde bir üretim yapısı geliştir. Ardından bir gözcü gönder; yeni toprağa çıkmadan önce bilgi topla.</div><div class="tile-actions"><button class="primary" data-view="settlement">Yerleşimi geliştir</button><button data-map="home">Merkezimi bul</button></div><p class="rail-tip">Sürükle: gezin · Tekerlek/iki parmak: yakınlaş<br>Ok tuşları: seç · Escape: bırak</p>`;
    return;
  }
  const tile = getTile(state.world, selected.x, selected.y);
  if (!tile) {
    selected = null;
    return renderInspector();
  }
  const town = getSettlementAt(state, tile.x, tile.y),
    from = activeTown(),
    terrain = TERRAINS[tile.terrain],
    poi = POIS[tile.poi?.type],
    owner = town
      ? getFaction(state, town.ownerId)
      : tile.poi?.ownerId
        ? getFaction(state, tile.poi.ownerId)
        : null,
    own = town?.ownerId === state.playerId,
    estimate = from ? getTravelEstimate(state, from, tile, { scout: 1 }) : null;
  const valueSummary = poi
    ? `${poi.label}, bağlandığı yerleşime kalıcı bir bölgesel avantaj verir.`
    : `${terrain.label}; ${RESOURCES[keys[terrain.rates.indexOf(Math.max(...terrain.rates))]].label.toLocaleLowerCase("tr")} için güçlü bir üretim zemini.`;
  const nextMove = own
    ? "Burayı Yerleşim ekranından geliştir; yapı seçimin bu merkezin rolünü belirler."
    : town || tile.poi
      ? "Önce gözcüyle bilgiyi doğrula. Ardından yeterli birlik varsa sefer veya bağlama kararı ver."
      : "Gözcü riski azaltır. Yerleşim kafilesi ise kaynak ve nüfuz harcayarak bu karoyu kalıcı merkeze çevirir.";
  el.classList.add("has-selection");
  el.innerHTML = `<div class="inspector-head"><p class="coordinate">${tile.x} · ${tile.y} / ${state.world.size} × ${state.world.size}</p><button data-action="deselect" aria-label="Bölge bilgisini kapat">×</button></div><h2>${esc(town?.name || poi?.label || terrain.label)}</h2><span class="badge">${esc(owner?.name || "Bağımsız toprak")}</span><div class="decision-brief"><span>NEDEN ÖNEMLİ?</span><p>${esc(valueSummary)}</p><span>SONRAKİ KARAR</span><p>${esc(nextMove)}</p></div><p class="muted tile-description">${esc(terrain.description)}</p><div class="terrain-summary">${keys.map((k, i) => `<div><span>${RESOURCES[k].label}</span> ×${terrain.rates[i].toFixed(2)}</div>`).join("")}<div><span>Savunma</span> ×${terrain.defense}</div><div><span>Hareket</span> ×${terrain.movement}</div></div>${poi ? `<div class="note"><strong>${esc(poi.label)}</strong><p>${esc(poi.description)}</p><p>${tile.poi.ownerId ? "Bağlı nokta" : "Bağımsız muhafızlı nokta"} · Koruma gücü ${fmt(poi.guard * (tile.poi.ownerId ? 2.4 : 1))}</p></div>` : ""}${town && own ? `<p>${esc(getSettlementRole(state, town))}</p><div class="mini-stats">${keys.map((k) => `<div>${RESOURCES[k].label}: <strong>${fmt(town.resources[k])}</strong></div>`).join("")}</div><p class="muted tile-troops">${esc(troopsText(town.troops))}</p>` : town || tile.poi ? intelHTML(tile) : ""}<div class="tile-actions">${own ? `<button class="primary" data-open-town="${esc(town.id)}">Yerleşimi yönet</button>` : `<p>Çıkış: <strong>${esc(from?.name || "Yerleşim yok")}</strong>${estimate ? ` · ${estimate.distance.toFixed(1)} karo · Gözcü ${duration(estimate.minutes)}` : ""}</p><button class="primary" data-action="scout">Gözcü gönder</button>${!town && !tile.poi ? '<button data-action="expand">Buraya yerleş</button>' : ""}${town || tile.poi ? `<button data-action="${tile.poi ? "claim" : "attack"}">${tile.poi ? "Noktayı bağla" : "Sefer hazırla"}</button>` : ""}`}<button data-action="mark">${isMarked(tile) ? "İşareti kaldır" : "Haritada işaretle"}</button></div>`;
}
function intelHTML(tile) {
  const knowledge = getTileKnowledge(state, tile.x, tile.y);
  const intel = knowledge.intel;
  const publicInfo = knowledge.settlement
    ? `<p class="cost">Yaklaşık nüfus ${fmt(knowledge.settlement.population)}</p>`
    : "";
  if (!intel)
    return (
      publicInfo +
      '<div class="note">Garnizon ve depolar bilinmiyor. Gözcü yollayarak kararını bilgiye dayandır.</div>'
    );
  return `${publicInfo}<p class="intel-age">Son doğrulama: ${duration(Math.max(0, state.time - intel.time))} önce · Bilgi değişmiş olabilir.</p><p style="font-size:12px;margin-top:8px">${esc(troopsText(intel.troops))}</p><p class="cost">${esc(costText(intel.resources))}</p>${
    intel.buildings
      ? `<p class="cost">${Object.entries(intel.buildings)
          .filter(([, v]) => v > 0)
          .map(([k, v]) => `${esc(BUILDINGS[k]?.label || k)} ${v}`)
          .join(" · ")}</p>`
      : ""
  }`;
}
function isMarked(tile) {
  return state.settings.markers?.some((p) => p.x === tile.x && p.y === tile.y);
}
function settlementSelect() {
  return `<select id="town-select" aria-label="Yönetilecek yerleşim">${getPlayerSettlements(state)
    .map(
      (t) =>
        `<option value="${esc(t.id)}" ${t.id === activeTown()?.id ? "selected" : ""}>${esc(t.name)} · ${esc(getSettlementRole(state, t))}</option>`,
    )
    .join("")}</select>`;
}
function renderSection() {
  if (!state) return;
  const el = $("section-view");
  switch (view) {
    case "settlement":
      el.innerHTML = settlementHTML();
      break;
    case "army":
      el.innerHTML = armyHTML();
      break;
    case "council":
      el.innerHTML = councilHTML();
      break;
    case "dynasty":
      el.innerHTML = dynastyHTML();
      break;
  }
}
function sectionHead(kicker, title, desc, select = false) {
  return `<div class="section-head"><div><p class="eyebrow">${esc(kicker)}</p><h2>${esc(title)}</h2><p>${esc(desc)}</p></div>${select ? settlementSelect() : ""}</div>`;
}
function settlementHTML() {
  const town = activeTown();
  if (!town)
    return '<div class="empty-state">Yerleşimin kalmadı. Hanedan ekranından sonucu incele.</div>';
  const rates = getRates(state, town);
  return (
    sectionHead(
      "YERLEŞİM DEFTERİ",
      town.name,
      `${getSettlementRole(state, town)} · ${TERRAINS[getTile(state.world, town.x, town.y).terrain].label}. Üretim zaman ilerledikçe depolara eklenir.`,
      true,
    ) +
    `<div class="section-grid"><div class="card wide"><div class="row spread"><h3>İnşa ve eğitim kuyruğu</h3><span class="badge">Depo: ${fmt(getCapacity(town))} / kaynak</span></div>${queueHTML(town)}<p style="margin-top:12px">Zaman duruyorsa sağ üstten 1×, 4× veya 12× seç. Oyundan çıktığında dünya da durur.</p></div>${Object.entries(
      BUILDINGS,
    )
      .map(([key, b]) => {
        const actual = town.buildings[key] || 0;
        const pending = town.queue.filter((q) => q.kind === "build" && q.building === key).length;
        const lv = actual + pending;
        const cost = getBuildCost(state, town, key);
        const resourceIndex = PRODUCTION_BUILDINGS.indexOf(key);
        const rateLine =
          resourceIndex === -1
            ? ""
            : `<p class="rate">Şu anda +${fmt(rates[keys[resourceIndex]] * 60)}/saat${
                lv >= b.maxLevel ? "" : ` → ${lv + 1}. seviyede +${fmt(nextLevelRate(town, key, keys[resourceIndex]) * 60)}/saat`
              }</p>`;
        return `<article class="card"><div class="card-meta"><h3>${esc(b.label)}</h3><span class="badge">Seviye ${actual}${pending ? ` +${pending} sırada` : ""}</span></div><p>${esc(b.description)}</p>${rateLine}<p class="cost">${lv >= b.maxLevel ? "En yüksek seviye" : esc(costText(cost))}</p><button data-build="${key}" ${lv >= b.maxLevel ? "disabled" : ""}>${lv >= b.maxLevel ? "Tam gelişmiş" : `${lv + 1}. seviyeyi inşa et`}</button></article>`;
      })
      .join(
        "",
      )}<div class="card wide"><h3>Yerleşim ağı</h3><p>Kendi veya sana bağlı hanedanların yerleşimlerine kervan gönder. Kaynak doğru yerdeyse sınırdaki şehir de büyür.</p><button data-action="trade">Kervan hazırla</button><button data-map="home">Haritada göster</button></div></div>`
  );
}
function queueHTML(town) {
  return town.queue.length
    ? `<div class="queue-list">${town.queue
        .map((q) => {
          const name =
            BUILDINGS[q.building]?.label || UNITS[q.unit]?.label || q.label || "Hazırlık";
          const end = q.finishAt ?? q.completeAt ?? q.endAt ?? q.arriveAt ?? 0;
          const start = q.startAt ?? q.startedAt ?? state.time;
          return `<div class="queue-item"><div class="row spread"><strong>${esc(name)}${q.count ? ` ×${q.count}` : ""}</strong><span>${duration(Math.max(0, end - state.time))} kaldı</span></div>${Number.isFinite(q.startAt) ? `<progress value="${Math.max(0, state.time - start)}" max="${Math.max(1, end - start)}" aria-label="${esc(name)} ilerlemesi"></progress>` : ""}</div>`;
        })
        .join("")}</div>`
    : '<p style="margin-top:12px">Kuyruk boş. Aşağıdan bir yapı geliştir veya Ordu bölümünden birlik eğit.</p>';
}
function armyHTML() {
  const town = activeTown();
  if (!town) return sectionHead("SEFER DEFTERİ", "Ordular", "Yerleşimin kalmadı.");
  const moving = state.armies.filter((a) => a.ownerId === state.playerId);
  return (
    sectionHead(
      "SEFER DEFTERİ",
      "Yol da savaşın parçası.",
      "Birlikler harita üzerinde yol alır. Uzak bir hedefe çıkan asker, yoldayken yerleşimini savunamaz.",
      true,
    ) +
    `<div class="section-grid"><div class="card wide"><h3>Yoldaki birlikler · ${moving.length}</h3>${moving.length ? moving.map((a) => `<div class="report"><div class="row spread"><strong>${esc(missionNames[a.mission] || a.mission)}${a.returning ? " · Dönüşte" : ""}</strong><span class="badge">${duration(a.arriveAt - state.time)}</span></div><div class="army-route">${a.from.x},${a.from.y} → ${a.to.x},${a.to.y}</div><p>${esc(troopsText(a.troops))}</p>${!a.returning ? `<button data-recall="${esc(a.id)}">Geri çağır</button>` : ""}</div>`).join("") : '<p style="margin-top:12px">Şu anda yolda birlik yok. Haritadan bir hedef seçip keşif veya sefer başlat.</p>'}</div>${Object.entries(
      UNITS,
    )
      .map(
        ([key, u]) =>
          `<article class="card"><div class="card-meta"><h3>${esc(u.label)}</h3><span class="badge">${fmt(town.troops[key])} hazır</span></div><p>Saldırı ${u.attack} · Savunma ${u.defense} · Hız ×${u.speed}</p><p class="cost">Bir asker: ${esc(costText(u.cost))}</p><p class="cost">Gereken talimgâh: seviye ${u.barracks} · İaşe ${fmtRate(u.upkeep * 60)}/saat</p><button data-train="${key}" ${town.buildings.barracks < u.barracks ? "disabled" : ""}>${town.buildings.barracks < u.barracks ? "Talimgâhı geliştir" : "Birlik eğit"}</button><button data-demobilize="${key}" ${town.troops[key]?"":"disabled"}>Terhis et</button></article>`,
      )
      .join("")}</div>`
  );
}
function councilHTML() {
  return (
    sectionHead(
      "DİVAN",
      "Dünya ne yapıyor?",
      "Raporlarda kararlarının sonuçlarını izle. Diplomasiyle bir cepheyi kapat, ticaretle yeni bir ilişki aç.",
    ) +
    `<div class="tabs-inline"><button class="${councilTab === "reports" ? "active" : ""}" data-council="reports">Raporlar</button><button class="${councilTab === "diplomacy" ? "active" : ""}" data-council="diplomacy">Hanedanlar</button></div>` +
    (councilTab === "reports"
      ? `<div class="card">${state.reports.map((r) => `<article class="report ${r.critical ? "critical" : ""}"><small>${gameDate(r.time)} · ${esc(reportTypeLabel(r.type))}</small><h3>${esc(r.title)}</h3><p>${esc(r.text)}</p></article>`).join("") || "<p>İlk kararını verdiğinde sonuçları burada göreceksin.</p>"}</div>`
      : `<div class="section-grid">${state.factions
          .filter((f) => f.id !== state.playerId)
          .map((f) => {
            const rel = player()?.relations?.[f.id] || {};
            const count = state.settlements.filter((t) => t.ownerId === f.id).length;
            return `<article class="card"><div class="card-meta"><h3>${esc(f.name)}</h3><span class="badge">${count} yerleşim</span></div><p>${esc(f.archetypeLabel || { merchant: "Tüccar", fortress: "Kale beyi", raider: "Akıncı", expansionist: "Yayılmacı", opportunist: "Fırsatçı", ambitious: "Hırslı" }[f.archetype] || f.archetype)}</p><p style="margin-top:12px">İlişki: ${fmt(rel.score || 0)}${rel.truceUntil > state.time ? ` · Anlaşma: ${duration(rel.truceUntil - state.time)}` : ""}${f.relations?.[state.playerId]?.vasal ? " · Sana bağlı hanedan" : rel.vasal ? " · Üst hanedan" : ""}</p><div class="row"><button data-diplomacy="gift" data-faction="${esc(f.id)}">Hediye</button><button data-diplomacy="truce" data-faction="${esc(f.id)}">Anlaşma</button><button data-diplomacy="vasal" data-faction="${esc(f.id)}">Bağlılık</button></div><button data-find-faction="${esc(f.id)}">Haritada bul →</button></article>`;
          })
          .join("")}</div>`)
  );
}
function regionalHTML() {
  const town = activeTown(), p = progressOf(state), region = regionOf(state, town);
  return `<article class="card wide"><p class="eyebrow">BÖLGESEL GELİŞİM</p><h3>${esc(town.name)} · ${esc(REGION_NAMES[region])}</h3><p>Her aşamanın dört kaynak maliyeti vardır: yarısı yerel katkı, yarısı başka bölgeden ikmal. Yük yatırımda tüketilir; aynı malı dolaştırarak zafer kazanılmaz.</p><div class="row">${Object.entries(SPECIALIZATIONS).map(([key,label])=>`<button data-specialty="${key}" ${p.specializations[town.id]===key?'disabled':''}>${esc(label)}</button>`).join('')}</div>${p.supply[town.id]?'<button data-cancel-supply="true">İkmal emrini durdur</button>':''}<p>Uzmanlık: konak 2 ve her kaynaktan 180. İaşe +%30 erzak / −%15 demir; üretim +%15 malzeme / −%20 erzak. Diğer merkezler ilgili yatırımı açar.</p></article>` + ['wealth','dominion','dynasty'].map(path=>{
    const info = projectRequirements(state,town,path), project=p.projects[`${path}:${region}`];
    return `<article class="card"><h3>${esc({wealth:'Ekonomik',dominion:'Askeri',dynasty:'Siyasi'}[path])} bölge · ${info.level}/3</h3>${info.requirements.map(goalHTML).join('')}${project?.active?`<p>Her kaynak için yerel katkı: ${fmt(project.paid)} / ${fmt(PROJECT_QUOTAS[project.level])}<br>İthal ikmal: ${fmt(project.imported)} / ${fmt(PROJECT_QUOTAS[project.level])}</p><button data-contribute="${path}">Yerel katkı yap (500 stok korunur)</button>`:`<button data-project="${path}" ${info.level>=3?'disabled':''}>${info.level>=3?'Bölge tamamlandı':'Yatırım fermanı · 15 nüfuz'}</button>`}<p>Final ikmali: ${fmt(p.finales[path]?.[region]||0)} / 12.000 (her kaynak). Diğer yol koşulları tamamlanınca ikmal hatları finali besler.</p><button data-supply-setup="${path}">Bu yurttan ikmal hattı kur</button></article>`;
  }).join('');
}
// Regional specialization only pays off once a second settlement exists to
// supply it (the ikmal mechanic literally requires a town in another
// region), yet its full four-card breakdown — three 12.000-resource
// endgame targets — used to render at full detail from turn one, next to
// a "Kuruluş: 0/1" checklist that hadn't even unlocked it yet. A native
// <details> keeps every number reachable in one click without deleting or
// renaming anything, and opens on its own once it is actually actionable.
function regionalSectionHTML() {
  const unlocked = getPlayerSettlements(state).length > 1;
  return `<details class="card wide region-disclosure"${unlocked ? " open" : ""}><summary><p class="eyebrow">BÖLGESEL GELİŞİM</p><h3>${unlocked ? "Bölge yatırımların" : "İkinci bir yerleşimden sonra açılır"}</h3>${unlocked ? "" : "<p>Farklı bir bölgede yerleşim kurduğunda buradan ikmal hatları ve bölge uzmanlıkları yönetebilirsin.</p>"}</summary>${regionalHTML()}</details>`;
}
function supplyDialog(path) {
  const town=activeTown(), targets=getPlayerSettlements(state).filter(t=>regionOf(state,t)!==regionOf(state,town));
  openDialog('Bölgeler arası ikmal', `<p>Yatırım merkezini seç. Otomatik kervanlar her kaynaktan 500 güvenlik stoğu bırakır. Yeni emir eskisinin yerini alır.</p>${targets.map(t=>`<button data-supply-target="${esc(t.id)}" data-path="${path}">${esc(t.name)} · ${esc(REGION_NAMES[regionOf(state,t)])}</button>`).join('') || '<p>Önce farklı bir bölgede yerleşim kur.</p>'}`);
}

function dynastyHTML() {
  const d = state.dynasty,
    campaign = getCampaign(state);
  const person = (p) => (typeof p === "string" ? p : p?.name || p?.label || "Hanedan mensubu");
  return (
    sectionHead(
      "HANEDAN DEFTERİ",
      d.name,
      "Toprak, zenginlik veya siyasi bağlılık. Büyük Kurultay’a giden yolu sen seç.",
    ) +
    `<div class="section-grid"><div class="card"><p class="eyebrow">REİS</p><h2 style="margin:8px 0">${esc(person(d.ruler))}</h2><p>Varis: ${esc(person(d.heir))} · Deneyim: ${fmt(d.xp)}</p><div class="stat-list">${Object.entries(
      d.stats || {},
    )
      .map(
        ([k, v]) =>
          `<div><span>${esc(labels[k] || k)}</span><strong>${fmt(v)}</strong><button data-dynasty="${esc(k)}" aria-label="${esc(labels[k] || k)} geliştir">Geliştir</button></div>`,
      )
      .join(
        "",
      )}</div><p style="margin-top:12px">${(d.traits || []).map(esc).join(" · ")}</p></div><div class="card"><p class="eyebrow">KAMPANYA</p><h2 style="margin:8px 0">${esc(campaign.label)}</h2>${campaign.goals.map(goalHTML).join("")}<p style="margin-top:18px">Nüfuz; keşif, gelişim ve siyasi başarıyla kazanılır. Yeni yerleşimler ve anlaşmalar için harcanır.</p></div>${regionalSectionHTML()}${campaign.paths.map((path) => `<article class="card"><div class="card-meta"><h3>${esc(path.label)}</h3><span class="badge">Kurultay yolu</span></div>${path.requirements.map(goalHTML).join("")}<button class="primary" data-victory="${esc(path.id)}" ${path.ready ? "" : "disabled"}>${path.ready ? "Kurultayı topla" : "Koşullar hazırlanıyor"}</button></article>`).join("")}${state.campaign.victory ? `<div class="card wide"><h2>${state.campaign.victory === "defeat" ? "Hanedanın sınırı" : "Adın deftere yazıldı."}</h2><p>${esc(typeof state.campaign.victory === "string" ? state.campaign.victory : state.campaign.victory.path || "Kurultay tamamlandı")}</p><button class="primary" data-action="continue">Dünyada devam et</button><button data-action="new">Yeni kampanya</button></div>` : ""}${d.pendingEvent || state.pendingEvent ? `<div class="card wide"><h3>Varisin yolu</h3><p>Bir sonraki kuşağa nasıl bir miras bırakacaksın?</p><div class="row"><button data-event="mentor">Reisin yanında yetiştir</button><button data-event="marry">Siyasi bağ kur</button><button data-event="study">Bilgiyle güçlendir</button></div></div>` : ""}</div>`
  );
}
function render() {
  if (!state) return;
  const focus = document.activeElement;
  const focusData = focus?.tagName === "BUTTON" ? JSON.stringify(focus.dataset) : null;
  activeId = activeTown()?.id || null;
  renderHeader();
  renderRail();
  map.setState(state);
  syncFieldGuide();
  if (view === "map") renderInspector();
  else renderSection();
  if (focusData && !document.contains(focus)) {
    const replacement = [...document.querySelectorAll("button")].find(
      (b) => JSON.stringify(b.dataset) === focusData,
    );
    replacement?.focus({ preventScroll: true });
  }
}
function openDialog(title, body) {
  if (state && !$("dialog").open) {
    dispatch(state, { type: "setSpeed", speed: 0 });
    renderHeader();
  }
  $("dialog-notice").hidden = true;
  $("dialog-title").textContent = title;
  $("dialog-body").innerHTML = body;
  $("dialog-body").className = "dialog-body";
  if (!$("dialog").open) $("dialog").showModal();
}
function closeDialog() {
  if ($("dialog").open) $("dialog").close();
  /* Deliberately stay paused: player resumes after reviewing. */
}
function newCampaign() {
  openDialog(
    "Yeni bir hanedan",
    `<form id="new-form"><label>Hanedanın adı<input name="name" maxlength="32" value="Sedir Hanedanı" required></label><label>Dünya tohumu<input name="seed" maxlength="48" value="TL-${Math.floor(
      Date.now() / 1000,
    )
      .toString(36)
      .toUpperCase()}" required></label><p class="form-note">Aynı tohum aynı coğrafyayı üretir. Dünya 49 × 49, rakip hanedan sayısı 8. Zaman sen başlatana kadar durur.</p>${state || cachedSlots.auto ? '<p class="note">Yeni kampanya otomatik kaydın yerini alır. Mevcut kampanyanın önceki kaydı korunur; önemli ilerlemen için önce dışa aktar.</p>' : ""}<button class="primary" type="submit">Ocağımı kur</button></form>`,
  );
}
async function enterGame(next) {
  state = next;
  state.paused = true;
  map.select(null, null, { notify: false });
  activeId = getPlayerSettlements(state)[0]?.id || null;
  selected = null;
  view = "map";
  $("welcome").hidden = true;
  $("game").classList.remove("menu-mode");
  setView("map");
  render();
  const town = activeTown();
  if (town) {
    map.focus(town.x, town.y);
    map.setZoom("near");
  }
  lastFrame = 0;
  accumulator = 0;
  sinceSave = 0;
}
async function continueGame(slot = "auto") {
  busy = true;
  const result = await saves.load(slot);
  busy = false;
  if (!result.ok) {
    notice(result.message, true);
    return;
  }
  closeDialog();
  await enterGame(result.state);
  if (result.warning) notice(result.warning, true);
  else if (result.recovered) notice(result.message);
  else notice("Kampanya açıldı. Dünya duraklatılmış durumda.");
  updateSaveStatus();
}
async function menu() {
  if (state) {
    dispatch(state, { type: "setSpeed", speed: 0 });
    renderHeader();
  }
  cachedSlots = await saves.list();
  openDialog(
    "Oyun ve kayıtlar",
    `<div class="stack">${state ? '<button class="primary" data-action="resume">Oyuna dön</button><button data-action="manual-save">Elle kayıt al</button>' : ""}${[
      "auto",
      "previous",
      "manual",
    ]
      .map((slot) => {
        const meta =
          slot === "auto" && !cachedSlots.auto?.valid
            ? cachedSlots.journal || cachedSlots.previous
            : cachedSlots[slot];
        return `<button data-load="${slot}" ${meta?.valid ? "" : "disabled"}>${{ auto: "Otomatik kaydı aç", previous: "Önceki otomatik kayda dön", manual: "Elle kaydı aç" }[slot]}<small style="display:block">${meta ? (meta.valid ? `${esc(meta.worldSeed)} · ${gameDate(meta.gameTime)} · ${new Date(meta.savedAt).toLocaleString("tr-TR")}` : "Kayıt okunamıyor; veri korundu.") : "Henüz kayıt yok"}</small></button>`;
      })
      .join(
        "",
      )}${state ? '<button data-action="export">Kampanyayı dışa aktar</button>' : ""}<button data-action="import">Yedek içe aktar</button><button data-action="new">Yeni kampanya</button><button data-action="help">Nasıl oynanır?</button><a href="/" target="_top">TarikLab oyunlarına dön →</a><a href="/games/hanedan/legacy.html">Eski HANEDAN kayıtları →</a>${saves.legacySaves().length ? '<button data-action="legacy-export">Eski kayıtların ham yedeğini indir</button>' : ""}${state ? '<button data-action="quit">Kaydet ve ana menüye dön</button>' : ""}<p class="form-note">${readyOffline ? "Çevrimdışı paket hazır." : "Çevrimdışı paket henüz doğrulanmadı."} Kayıtlar bu cihaz ve bu alan adına aittir; başka cihaz için dışa aktar. Oyundan uzaktayken dünya ilerlemez.</p><p class="form-note ${saves.status().error ? "storage-warning" : ""}">${esc(saves.status().error || "Otomatik + önceki otomatik + elle kayıt ayrı tutulur.")}</p></div>`,
  );
}
function download(text, name) {
  const blob = new Blob([text], { type: "application/json" }),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function showExport() {
  try {
    const text = saves.export(state);
    openDialog(
      "Kampanya yedeği",
      `<p class="form-note">Bu yedek dünya, ordular ve kayıt sürümünü içerir. İndir veya aşağıdaki metni sakla.</p><textarea id="export-text" readonly aria-label="Kampanya yedek metni">${esc(text)}</textarea><button class="primary" data-action="download">Yedek dosyasını indir</button>`,
    );
  } catch (e) {
    notice(e.message, true);
  }
}
function showImport() {
  openDialog(
    "Yedek içe aktar",
    `<form id="import-form"><p class="form-note">HANEDANIAN yedeğini seç veya yapıştır. Bütünlük ve sürüm doğrulandıktan sonra elle kayıt alanına yazılır; otomatik kayıt silinmez.</p><label>Dosya seç<input id="import-file" type="file" accept="application/json,.json"></label><label>Yedek metni<textarea name="save" id="import-text" required></textarea></label><button class="primary" type="submit">Doğrula ve kampanyayı aç</button></form>`,
  );
}
function help() {
  openDialog(
    "İlk ocağından Kurultay’a",
    `<div class="stack"><div class="note"><strong>Sen bir hanedanın reisisin.</strong><p>Yerleşimini büyüt; toprak, ticaret veya nüfuz hedeflerinden birini tamamlayıp Büyük Kurultay’ı topla.</p></div><p><strong>1. Üret:</strong> Yerleşim bölümünden tarlayı veya atölyeyi geliştir. Maliyet hemen ödenir, yapı kuyruktaki süresi bitince açılır.</p><p><strong>2. Zamanı başlat:</strong> 1× / 4× / 12× kontrolleri dünyayı ilerletir. Kritik haberlerde otomatik durur. Oyundan çıkınca da durur.</p><p><strong>3. Keşfet:</strong> Haritada bir hedef seç, gözcü gönder. Mesafe ve arazi yol süresini değiştirir; düşman bilgisi zamanla eskir.</p><p><strong>4. Yayıl:</strong> Boş ve menzilindeki bir karoya kaynak ve nüfuzla yerleşim kafilesi gönder. Özel noktaları askerlerle mevcut yerleşimine bağla.</p><p><strong>5. Ağ kur:</strong> Kervanlar, anlaşmalar ve birbirini besleyen yerleşimler kur. Sonuçları Divan raporlarında, hedefleri Hanedan bölümünde izle.</p><p class="form-note">Dokunarak seç · tek parmakla taşı · iki parmakla yakınlaş. Masaüstünde tekerlek, ok tuşları ve Escape de çalışır. Ses yoktur.</p><button class="primary" data-action="resume">Hazırım</button></div>`,
  );
}
function expansionDialog() {
  const town = activeTown();
  const cost = getExpansionCost(state, state.playerId);
  openDialog(
    "Yeni yerleşim kafilesi",
    `<form id="expand-form"><p>${esc(town.name)} → ${selected.x}, ${selected.y}</p><p class="form-note">Konak seviyesine bağlı menzil: ${8 + town.buildings.hall * 2} karo. Diğer yerleşimlere ve kuruculara en az 3 karo uzaklık gerekir. Kaynaklar ve nüfuz ödenir. Kafile hedefe ulaşınca yeni yerleşimin kurulur; aynı hedefe rakip senden önce ulaşabilir.</p><p class="cost">${esc(costText(cost))}</p><label>Yerleşimin adı<input name="name" maxlength="32" value="${esc(TERRAINS[getTile(state.world, selected.x, selected.y).terrain].label)} Yurdu" required></label><button class="primary" type="submit">Kafileyi yola çıkar</button></form>`,
  );
}
function armyDialog(mission) {
  const town = activeTown();
  openDialog(
    mission === "claim" ? "Stratejik noktayı bağla" : "Sefer hazırla",
    `<form id="army-form" data-mission="${mission}"><p>${esc(town.name)} → ${selected.x}, ${selected.y}</p><p class="form-note">${mission === "claim" ? "Nokta bağlama 5 nüfuz harcar; en çok 7 karo uzakta ve yurt başına en fazla 4 nokta olabilir." : "Başkentler yağmalanabilir ama ele geçirilemez. Diğer yerleşimler zafer sonunda en az 2 sağ koçbaşı varsa ele geçirilir."} Birlikler yol boyunca merkezin savunmasına katılamaz. Keşif yapmadan çıkılan sefer daha belirsizdir. Zafer ve sağ kalanlar Divan’da raporlanır.</p><div class="unit-inputs">${Object.entries(
      UNITS,
    )
      .map(
        ([key, u]) =>
          `<label>${esc(u.label)} · ${fmt(town.troops[key])}<input type="number" name="${key}" min="0" max="${town.troops[key]}" step="1" value="0" inputmode="numeric"></label>`,
      )
      .join(
        "",
      )}</div><p id="army-eta" class="form-note">Birlik seçerek süreyi gör.</p><button class="primary" type="submit">Birlikleri gönder</button></form>`,
  );
}
function scoutDialog() {
  const town = activeTown();
  if (!town || !selected) return;
  openDialog(
    "Keşif birliği",
    `<form id="scout-form"><p>${esc(town.name)} → ${selected.x}, ${selected.y}</p><p class="form-note">Kalabalık gözcü birliği karşı istihbaratı aşabilir. Rapor varışta Divan’a düşer; 6 oyun saati sonra eski sayılır.</p><label>Gözcü sayısı · ${fmt(town.troops.scout)} hazır<input name="count" type="number" min="1" max="${Math.min(100, town.troops.scout)}" value="1" required></label><button class="primary" type="submit" ${town.troops.scout ? "" : "disabled"}>Gözcüleri gönder</button>${town.troops.scout ? "" : '<p class="note">Önce Ordu bölümünden gözcü eğit.</p>'}</form>`,
  );
}
function trainDialog(unit) {
  const u = UNITS[unit];
  openDialog(
    `${u.label} eğitimi`,
    `<form id="train-form" data-unit="${unit}"><p class="form-note">Bir asker: ${esc(costText(u.cost))} · ${u.minutes} oyun dakikası. Eğitim bitince garnizona katılır.</p><label>Asker sayısı<input name="count" type="number" min="1" max="100" value="5" required step="1" inputmode="numeric"></label><p id="training-cost" class="cost">Toplam: ${esc(costText(u.cost.map((n) => n * 5)))}</p><button class="primary" type="submit">Eğitimi kuyruğa ekle</button></form>`,
  );
}
function demobilizeDialog(unit) {
  const town=activeTown();
  openDialog('Birliği terhis et', `<p>Eğitim maliyeti iade edilmez; iaşe ihtiyacı azalır. Yoldaki birlikler terhis edilemez.</p><form id="demobilize-form" data-unit="${unit}"><label>Asker sayısı<input name="count" type="number" min="1" max="${town.troops[unit]}" value="1" required></label><button class="primary" type="submit">Terhis et</button></form>`);
}
function tradeDialog() {
  const town = activeTown();
  const targets = state.settlements.filter(
    (t) =>
      t.id !== town.id &&
      (t.ownerId === state.playerId ||
        player().relations?.[t.ownerId]?.vasal ||
        getFaction(state, t.ownerId)?.relations?.[state.playerId]?.vasal),
  );
  openDialog(
    "Kervan hazırla",
    targets.length
      ? `<form id="trade-form"><label>Varış yerleşimi<select name="target">${targets.map((t) => `<option value="${esc(t.id)}">${esc(t.name)} · ${esc(getFaction(state, t.ownerId)?.name)}</option>`).join("")}</select></label><div class="unit-inputs">${keys.map((k) => `<label>${RESOURCES[k].label}<input name="${k}" type="number" value="0" min="0" max="${Math.floor(town.resources[k])}" step="1"></label>`).join("")}</div><p class="form-note">Kervan avlusu gerekir. Kapasite ${fmt(getTradeCapacity(state, town))} yük. Kaynak hedefe teslim edilir; mesafeye bağlı demir primi geri gelir. Dolu depoya sığmayan yük teslim edilmez.</p><button class="primary" type="submit">Kervanı gönder</button></form>`
      : '<div class="note">Henüz uygun hedef yok. İkinci yerleşimini kur veya Divan’dan bir hanedanı bağlılığa ikna et.</div>',
  );
}
function diplomacyDialog(factionId, mode) {
  const name = getFaction(state, factionId)?.name;
  openDialog(
    `${name} · ${mode === "gift" ? "Hediye" : mode === "truce" ? "Anlaşma" : "Bağlılık"}`,
    `<div class="stack"><p>${mode === "gift" ? `Başkentten 100 erzak, 100 kereste ve 4 nüfuz harcar. İlişkiyi +${18 + state.dynasty.stats.diplomacy} iyileştirir.` : "truce" === mode ? "Ateşkes 12 nüfuz harcar ve saldırıları 40 oyun saati durdurur. İlişki en az 15 veya rakibin en az %75’i kadar askeri güç gerekir." : "Bağlılık için ilişki 60, nüfuz 45, en az 3 yurt ve rakipten güçlü ordu gerekir. Kabul edilince 45 nüfuz harcanır, ilk bağlılık başarısı 30 nüfuz geri kazandırır."}</p><p class="form-note">Koşullar yetmezse kaynak harcanmaz; eksik koşul açıkça bildirilir.</p><button class="primary" data-diplomacy-confirm="${mode}" data-faction="${esc(factionId)}">${mode === "gift" ? "Hediye gönder" : mode === "truce" ? "Anlaşmayı teklif et" : "Bağlılık teklif et"}</button></div>`,
  );
}

document.addEventListener("pointerdown", (event) => {
  uiPointerActive = !!event.target.closest("button,input,select,textarea,a");
});
window.addEventListener("pointerup", () => {
  uiPointerActive = false;
});
window.addEventListener("pointercancel", () => {
  uiPointerActive = false;
});
window.addEventListener("blur", () => {
  uiPointerActive = false;
});
document.addEventListener("click", async (event) => {
  const b = event.target.closest("button");
  if (!b || b.disabled || busy) return;
  if (b.dataset.view) {
    if (b.closest("#field-guide")) {
      try { localStorage.setItem(GUIDE_KEY, "done"); } catch { /* Storage is optional. */ }
      $("field-guide").hidden = true;
    }
    setView(b.dataset.view);
    return;
  }
  if (b.dataset.guide === "dismiss") {
    try { localStorage.setItem(GUIDE_KEY, "done"); } catch { /* Storage is optional. */ }
    $("field-guide").hidden = true;
    return;
  }
  if (b.dataset.cancelSupply) { doAction({type:'cancelSupply',settlementId:activeTown().id}); return; }
  if (b.dataset.demobilize) { demobilizeDialog(b.dataset.demobilize); return; }
  if (b.dataset.specialty) { doAction({type:'specialize',settlementId:activeTown().id,specialty:b.dataset.specialty}); return; }
  if (b.dataset.project || b.dataset.contribute) { doAction({type:b.dataset.project?'project':'contribute',settlementId:activeTown().id,path:b.dataset.project||b.dataset.contribute}); return; }
  if (b.dataset.supplySetup) { supplyDialog(b.dataset.supplySetup); return; }
  if (b.dataset.supplyTarget) { doAction({type:'supplyOrder',settlementId:activeTown().id,targetId:b.dataset.supplyTarget,path:b.dataset.path}); return; }
  if (b.dataset.speed !== undefined) {
    doAction({ type: "setSpeed", speed: Number(b.dataset.speed) });
    return;
  }
  if (b.dataset.town) {
    useTown(b.dataset.town, true);
    return;
  }
  if (b.dataset.openTown) {
    useTown(b.dataset.openTown);
    setView("settlement");
    return;
  }
  if (b.dataset.map) {
    const key = b.dataset.map;
    if (key === "in") map.zoomBy(1.35);
    if (key === "out") map.zoomBy(1 / 1.35);
    if (key === "world") map.setZoom("world");
    if (key === "rail") {
      $("game").classList.toggle("rail-collapsed");
      map.resize();
    }
    if (key === "home") {
      const town = activeTown();
      if (town) {
        setView("map");
        map.focus(town.x, town.y);
        map.select(town.x, town.y);
      }
    }
    return;
  }
  if (b.dataset.build) {
    doAction({ type: "build", settlementId: activeTown().id, building: b.dataset.build });
    return;
  }
  if (b.dataset.train) {
    trainDialog(b.dataset.train);
    return;
  }
  if (b.dataset.recall) {
    doAction({ type: "recall", armyId: b.dataset.recall });
    return;
  }
  if (b.dataset.council) {
    councilTab = b.dataset.council;
    renderSection();
    return;
  }
  if (b.dataset.dynasty) {
    doAction({ type: "dynasty", choice: b.dataset.dynasty });
    return;
  }
  if (b.dataset.event) {
    doAction({ type: "event", choice: b.dataset.event });
    return;
  }
  if (b.dataset.victory) {
    const result = doAction({ type: "victory", path: b.dataset.victory });
    if (result?.ok) {
      setView("dynasty");
      openDialog(
        "Büyük Kurultay",
        `<div class="note"><h2>Bir hanedan, bir miras.</h2><p>${esc(result.message)}</p></div><button class="primary" data-action="continue">Dünyada devam et</button>`,
      );
    }
    return;
  }
  if (b.dataset.diplomacy) {
    diplomacyDialog(b.dataset.faction, b.dataset.diplomacy);
    return;
  }
  if (b.dataset.diplomacyConfirm) {
    const result = doAction({
      type: "diplomacy",
      factionId: b.dataset.faction,
      mode: b.dataset.diplomacyConfirm,
    });
    if (result?.ok) closeDialog();
    return;
  }
  if (b.dataset.findFaction) {
    const town = state.settlements.find((t) => t.ownerId === b.dataset.findFaction);
    if (town) {
      setView("map");
      map.focus(town.x, town.y);
      map.select(town.x, town.y);
    } else notice("Bu hanedanın haritada yerleşimi kalmadı.");
    return;
  }
  if (b.dataset.load) {
    await continueGame(b.dataset.load);
    return;
  }
  switch (b.dataset.action) {
    case "deselect":
      selected = null;
      map.select(null, null);
      renderInspector();
      break;
    case "scout":
      scoutDialog();
      break;
    case "expand":
      expansionDialog();
      break;
    case "attack":
    case "claim":
      armyDialog(b.dataset.action);
      break;
    case "mark": {
      const list = state.settings.markers || (state.settings.markers = []);
      const i = list.findIndex((p) => p.x === selected.x && p.y === selected.y);
      if (i >= 0) list.splice(i, 1);
      else if (list.length < 24) list.push({ ...selected });
      else {
        notice("En fazla 24 bölge işaretleyebilirsin.", true);
        break;
      }
      render();
      void persist();
      break;
    }
    case "trade":
      tradeDialog();
      break;
    case "resume":
      closeDialog();
      break;
    case "new":
      newCampaign();
      break;
    case "help":
      if (b.closest("#field-guide")) {
        try { localStorage.setItem(GUIDE_KEY, "done"); } catch { /* Storage is optional. */ }
        $("field-guide").hidden = true;
      }
      help();
      break;
    case "manual-save":
      b.disabled = true;
      try {
        await persist("manual", true);
        if ($("dialog").open && $("dialog-title").textContent === "Oyun ve kayıtlar") await menu();
      } finally { b.disabled = false; }
      break;
    case "export":
      showExport();
      break;
    case "download":
      download(
        saves.export(state),
        `HANEDANIAN-${String(state.world.seed).replace(/[^a-z0-9_-]/gi, "-")}-gun-${Math.floor(state.time / 1440) + 1}.json`,
      );
      break;
    case "import":
      showImport();
      break;
    case "legacy-export":
      download(saves.exportLegacy(), "HANEDAN-eski-kayitlar.json");
      break;
    case "continue": {
      closeDialog();
      doAction({ type: "continue" });
      setView("map");
      break;
    }
    case "quit":
      if (await persist("auto", true)) {
        closeDialog();
        state = null;
        $("welcome").hidden = false;
        $("game").classList.add("menu-mode");
        await renderWelcome();
      }
      break;
  }
});
$("menu-button").addEventListener("click", () => void menu());
$("guide-button").addEventListener("click", help);
$("dialog-close").addEventListener("click", closeDialog);
document.addEventListener("change", (event) => {
  if (event.target.id === "town-select") useTown(event.target.value);
  if (event.target.id === "import-file") {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      notice("Yedek dosyası en fazla 4 MB olabilir.", true);
      return;
    }
    file
      .text()
      .then((text) => {
        $("import-text").value = text;
      })
      .catch(() => notice("Dosya okunamadı.", true));
  }
});
document.addEventListener("input", (event) => {
  const form = event.target.closest("form");
  if (form?.id === "army-form") {
    const troops = Object.fromEntries(
      Object.keys(UNITS).map((k) => [k, Number(form.elements[k].value)]),
    );
    const estimate = getTravelEstimate(state, activeTown(), selected, troops);
    $("army-eta").textContent =
      `Tahmini yol: ${duration(estimate.minutes)} · ${estimate.distance.toFixed(1)} karo`;
  }
  if (form?.id === "train-form") {
    $("training-cost").textContent =
      `Toplam: ${costText(UNITS[form.dataset.unit].cost.map((n) => n * Math.max(0, Number(form.elements.count.value))))}`;
  }
});
document.addEventListener("submit", async (event) => {
  const form = event.target;
  if (
    ![
      "demobilize-form",
      "new-form",
      "expand-form",
      "army-form",
      "train-form",
      "trade-form",
      "import-form",
      "scout-form",
    ].includes(form.id)
  )
    return;
  event.preventDefault();
  if (busy) return;
  const data = new FormData(form);
  let result;
  if (form.id === "new-form") {
    busy = true;
    try {
      const next = createGame({
        seed: String(data.get("seed")).trim(),
        dynastyName: String(data.get("name")).trim(),
        size: 49,
        aiCount: 8,
      });
      closeDialog();
      await enterGame(next);
      // The İLK OCAK field guide (below the map, dismissible) is now the
      // one first-run explanation channel. A "Kampanya kaydedildi." toast
      // right on top of it repeated its own first line and, on the Army
      // tab, floated over the unit cards for its full 6.5s — the header's
      // own #save-status ("Kaydedildi HH:MM") already confirms this
      // autosave without a floating banner over live content.
      await persist("auto");
    } catch (error) {
      notice(`Kampanya başlatılamadı: ${error.message}`, true);
    } finally {
      busy = false;
    }
    return;
  }
  if (form.id === "import-form") {
    busy = true;
    result = await saves.import(String(data.get("save")), "manual");
    busy = false;
    if (result.ok) {
      closeDialog();
      await enterGame(result.state);
      notice("Yedek doğrulandı ve elle kayıt alanına alındı.");
    } else notice(result.message, true);
    updateSaveStatus();
    return;
  }
  if (form.id === "demobilize-form") result = doAction({type:"demobilize",settlementId:activeTown().id,unit:form.dataset.unit,count:Number(data.get("count"))});
  if (form.id === "scout-form")
    result = doAction({
      type: "scout",
      settlementId: activeTown().id,
      x: selected.x,
      y: selected.y,
      count: Number(data.get("count")),
    });
  if (form.id === "expand-form")
    result = doAction({
      type: "expand",
      settlementId: activeTown().id,
      x: selected.x,
      y: selected.y,
      name: String(data.get("name")).trim(),
    });
  if (form.id === "army-form")
    result = doAction({
      type: form.dataset.mission,
      settlementId: activeTown().id,
      x: selected.x,
      y: selected.y,
      troops: Object.fromEntries(Object.keys(UNITS).map((k) => [k, Number(data.get(k))])),
    });
  if (form.id === "train-form")
    result = doAction({
      type: "train",
      settlementId: activeTown().id,
      unit: form.dataset.unit,
      count: Number(data.get("count")),
    });
  if (form.id === "trade-form")
    result = doAction({
      type: "trade",
      settlementId: activeTown().id,
      targetId: String(data.get("target")),
      cargo: Object.fromEntries(keys.map((k) => [k, Number(data.get(k))])),
    });
  if (result?.ok) closeDialog();
});
function checkpoint() {
  if (!state) return;
  dispatch(state, { type: "setSpeed", speed: 0 });
  const result = saves.checkpoint(state);
  if (!result.ok) {
    storageMessage = result.message;
    updateSaveStatus();
  }
  void persist();
  lastFrame = 0;
  accumulator = 0;
}
document.addEventListener("visibilitychange", () => {
  if (document.hidden) checkpoint();
  else {
    lastFrame = 0;
    accumulator = 0;
    renderHeader();
  }
});
window.addEventListener("pagehide", checkpoint);
window.addEventListener("online", () => {
  void prepareOffline();
  notice("Bağlantı geldi. Kampanyan bu cihazda devam ediyor.");
});
window.addEventListener("offline", () =>
  notice(
    readyOffline
      ? "Çevrimdışısın. Oyun ve yerel kayıt devam ediyor."
      : "Çevrimdışısın. Bu açık oyun devam eder; yeniden açılma henüz doğrulanmadı.",
  ),
);
function frame(now) {
  if (!lastFrame) lastFrame = now;
  const elapsed = Math.min(100, now - lastFrame);
  lastFrame = now;
  if (state && !document.hidden && !state.paused && !$("dialog").open) {
    accumulator += elapsed;
    if (accumulator >= 1000) {
      accumulator -= 1000;
      const before = state.reports[0]?.id;
      advance(state, state.speed);
      if (!uiPointerActive) render();
      else {
        renderHeader();
        map.setState(state);
      }
      sinceSave += 1000;
      if (state.paused && state.reports[0]?.id !== before)
        notice(state.reports[0].title + " · Dünya duraklatıldı.");
      if (sinceSave >= 15000 || state.paused) {
        sinceSave = 0;
        void persist();
      }
    }
  } else accumulator = 0;
  requestAnimationFrame(frame);
}
async function renderWelcome() {
  cachedSlots = await saves.list();
  const status = saves.status();
  $("welcome-actions").className = "welcome-actions";
  $("welcome-actions").innerHTML =
    `${cachedSlots.auto?.valid || cachedSlots.previous?.valid || cachedSlots.journal?.valid ? `<button class="primary" data-load="auto">Kampanyaya devam et <small style="color:inherit;display:block">${esc((cachedSlots.auto?.valid ? cachedSlots.auto : cachedSlots.journal || cachedSlots.previous).worldSeed)} · ${gameDate((cachedSlots.auto?.valid ? cachedSlots.auto : cachedSlots.journal || cachedSlots.previous).gameTime)}</small></button>` : ""}<button class="${cachedSlots.auto?.valid || cachedSlots.previous?.valid || cachedSlots.journal?.valid ? "" : "primary"}" data-action="new">Yeni hanedan kur</button><button data-action="import">Yedekten kampanya aç</button>${cachedSlots.auto && !cachedSlots.auto.valid ? '<p class="note danger">Otomatik kayıt okunamadı; veri silinmedi. Menüden önceki kaydı deneyebilir veya bir yedek açabilirsin.</p>' : ""}${!status.available ? '<p class="note danger">Kalıcı kayıt şu anda kullanılamıyor. Oynarsan ilerlemeni dışa aktarmalısın.</p>' : ""}`;
  updateSaveStatus();
}
async function prepareOffline() {
  if (!("serviceWorker" in navigator) || !("caches" in window)) return;
  try {
    await navigator.serviceWorker.register("/sw.js");
    const registration = await navigator.serviceWorker.register("./sw.js", { scope: "./" });
    const check = (worker) => {
      if (!worker) return;
      const channel = new MessageChannel();
      channel.port1.onmessage = (e) => {
        if (e.data?.type === "HANEDANIAN_OFFLINE_READY") {
          readyOffline = !!e.data.ok;
          if (state) renderRail();
          channel.port1.close();
        }
      };
      worker.postMessage({ type: "CACHE_HANEDANIAN" }, [channel.port2]);
    };
    if (registration.active) check(registration.active);
    const installing = registration.installing;
    if (installing)
      installing.addEventListener("statechange", () => {
        if (installing.state === "activated") check(installing);
      });
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed" && registration.waiting)
          notice("Yeni sürüm hazır. Kaydet ve oyun sekmelerini kapatıp yeniden aç.");
        if (worker.state === "activated") check(worker);
      });
    });
  } catch {
    readyOffline = false;
  }
}
async function boot() {
  await saves.init();
  await renderWelcome();
  const recovered = await saves.load("auto");
  if (recovered.ok && recovered.recovered) {
    $("welcome-actions").insertAdjacentHTML(
      "afterbegin",
      `<button class="primary" data-load="auto">Kurtarılan kampanyayı aç</button><p class="note">${esc(recovered.message)}</p>`,
    );
  }
  requestAnimationFrame(frame);
  void prepareOffline();
}
boot().catch((error) => {
  $("welcome-actions").innerHTML =
    '<p class="note danger">Kayıt katmanı açılamadı. Veriler silinmedi. Sayfayı yeniden açmayı deneyebilirsin.</p>';
  notice(error.message, true);
});
