// Novella reader: an archive folder with index-card choices and reader controls.
import { PASSAGES, TITLE } from "./story.js";
import * as R from "./rules.js";

const KEY = "tariklab.proto-novella.v1";
const SKEY = "tariklab.proto-novella.settings.v1";
const root = document.getElementById("app");

const lang = () => (window.tlabI18n?.getLang?.() === "en" ? "en" : "tr");
const t = (tr, en) => (lang() === "en" ? en : tr);
const h = (v) =>
  String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Storage may be unavailable; reading still works for this visit. */
  }
}

let story = R.normalize(read(KEY, null));
let settings = R.normalizeSettings(read(SKEY, null));
let opened = Boolean(story && story.took.length && !R.finished(story));
let confirmRestart = false;
let focusLatest = false;

function applySettings() {
  const d = document.documentElement;
  d.dataset.theme = settings.theme;
  d.dataset.font = settings.font;
  d.dataset.spacing = settings.spacing;
  d.dataset.letters = settings.letters;
  d.style.setProperty("--reading-size", `${R.SIZES[settings.size]}px`);
}

function controls() {
  const themeName = {
    manila: t("Dosya kâğıdı", "Folder paper"),
    night: t("Gece", "Night"),
    contrast: t("Yüksek karşıtlık", "High contrast"),
  };
  return `<section class="controls" aria-label="${h(t("Okuma ayarları", "Reading settings"))}">
    <div class="ctl" role="group" aria-label="${h(t("Yazı boyutu", "Text size"))}"><button type="button" data-size="-1" aria-label="${h(t("Yazıyı küçült", "Smaller text"))}" ${settings.size === 0 ? "disabled" : ""}>A−</button><span class="size-read" aria-live="polite">${R.SIZES[settings.size]} px</span><button type="button" data-size="1" aria-label="${h(t("Yazıyı büyüt", "Larger text"))}" ${settings.size === R.SIZES.length - 1 ? "disabled" : ""}>A+</button></div>
    <label class="ctl">${t("Tema", "Theme")}<select data-set="theme">${R.THEMES.map((k) => `<option value="${k}" ${settings.theme === k ? "selected" : ""}>${h(themeName[k])}</option>`).join("")}</select></label>
    <label class="ctl">${t("Yazı", "Typeface")}<select data-set="font"><option value="serif" ${settings.font === "serif" ? "selected" : ""}>${t("Tırnaklı", "Serif")}</option><option value="sans" ${settings.font === "sans" ? "selected" : ""}>${t("Tırnaksız", "Sans")}</option></select></label>
    <label class="ctl check"><input type="checkbox" data-toggle="spacing" ${settings.spacing === "wide" ? "checked" : ""}>${t("Geniş satır aralığı", "Wide line spacing")}</label>
    <label class="ctl check"><input type="checkbox" data-toggle="letters" ${settings.letters === "wide" ? "checked" : ""}>${t("Geniş harf aralığı", "Wide letter spacing")}</label>
  </section>`;
}

function passageHtml(id, index, latest) {
  const p = PASSAGES[id];
  const paras = R.paragraphs(story, id, lang())
    .map((x) => `<p>${h(x)}</p>`)
    .join("");
  return `<article class="sheet ${p.ending ? "is-ending" : ""} ${latest ? "is-latest" : ""}" aria-labelledby="h-${index}">
    <p class="stamp">${h(p.stamp[lang()])}</p>
    <h2 id="h-${index}" tabindex="-1">${h(p.heading[lang()])}</h2>${paras}</article>`;
}

function cards() {
  if (R.finished(story)) {
    const seen = story.endings.length;
    return `<section class="rack end-rack" aria-label="${h(t("Son", "The end"))}">
      <p class="end-note">${t(`Ulaştığın sonlar: ${seen}/2`, `Endings reached: ${seen}/2`)}${seen < 2 ? " · " + t("Başka bir yol, başka bir son.", "Another path, another ending.") : ""}</p>
      <button type="button" class="card-btn" id="again">${t("Dosyayı yeniden aç", "Open the file again")}</button></section>`;
  }
  const opts = R.options(story);
  return `<section class="rack" aria-label="${h(t("Seçimler", "Choices"))}"><p class="rack-label">${t("Bir fiş seç", "Pick a card")}</p>${opts
    .map(
      (c, i) =>
        `<button type="button" class="card-btn" data-choice="${c.id}" ${c.ok ? "" : "disabled"} aria-describedby="${c.ok ? "" : `why-${c.id}`}"><span class="card-no">${i + 1}</span><span class="card-text">${h(c[lang()])}</span>${c.ok ? "" : `<span class="card-why" id="why-${c.id}">${h(c.why[lang()])}</span>`}</button>`,
    )
    .join("")}</section>`;
}

function cover() {
  const seen = story ? story.endings.length : 0;
  root.innerHTML = `<main class="cover"><div class="folder-front">
    <p class="tab">${t("DOSYA", "FILE")} · ILGIN 7</p>
    <p class="eyebrow">${t("PROTOTİP · SERİ ADI HENÜZ YOK", "PROTOTYPE · SERIES NOT YET NAMED")}</p>
    <h1>${h(TITLE[lang()])}</h1>
    <p class="lede">${t("Belediye arşivinde bir gece vardiyası. Kayıtlara göre hiç var olmamış bir bina ve onun kırk yılını kanıtlamaya çalışan bir kadın. Kısa, etkileşimli bir öykü: üç seçim, iki son. Yaklaşık 10 dakika.", "A night shift in a municipal archive. A building the records say never existed, and a woman trying to prove forty years of her life. A short interactive story: three choices, two endings. About 10 minutes.")}</p>
    <div class="row">${story && story.took.length && !R.finished(story) ? `<button type="button" class="card-btn" id="resume">${t("Kaldığın yerden devam et", "Continue where you left off")}</button>` : ""}<button type="button" class="card-btn primary" id="open">${story && story.took.length ? t("Baştan oku", "Read from the start") : t("Dosyayı aç", "Open the file")}</button></div>
    ${seen ? `<p class="small">${t(`Ulaştığın sonlar: ${seen}/2`, `Endings reached: ${seen}/2`)}</p>` : ""}
    <p class="small">${t("Tüm kişiler, yerler ve olaylar kurmacadır. Metin TarikLab için özgün olarak yazılmıştır.", "All people, places and events are fictional. The text was written originally for TarikLab.")}</p>
    <p class="small"><a href="/">${t("← Oyunlar", "← Games")}</a></p></div></main>`;
}

function render() {
  document.documentElement.lang = lang();
  applySettings();
  if (!opened || !story) return cover();
  const sheets = story.path
    .map((id, i) => passageHtml(id, i, i === story.path.length - 1))
    .join("");
  root.innerHTML = `<main class="reader">
    <header class="bar"><a href="/" class="back">${t("← Oyunlar", "← Games")}</a><strong class="book">${h(TITLE[lang()])}</strong><span class="proto">${t("prototip", "prototype")}</span><span class="lang-slot"></span>
      <details class="settings"><summary>${t("Okuma ayarları", "Reading settings")}</summary>${controls()}</details>
      ${confirmRestart ? `<span class="confirm" role="alertdialog" aria-label="${h(t("Baştan başla", "Start over"))}">${t("Seçimlerin silinsin mi?", "Clear your choices?")} <button type="button" id="restart-yes">${t("Evet", "Yes")}</button><button type="button" id="restart-no">${t("Hayır", "No")}</button></span>` : `<button type="button" id="restart">${t("Baştan", "Start over")}</button>`}</header>
    <div class="desk"><div class="folder">${sheets}${cards()}</div>
      <aside class="log" aria-label="${h(t("Damga kaydı", "Stamp log"))}"><p class="log-title">${t("Damga kaydı", "Stamp log")}</p><ol>${story.path.map((id) => `<li>${h(PASSAGES[id].stamp[lang()])}</li>`).join("")}</ol></aside></div>
    <p class="sr-only" aria-live="polite">${h(PASSAGES[R.current(story)].heading[lang()])}</p></main>`;
  window.tlabI18n?.mountLangToggle?.(root.querySelector(".lang-slot"));
  if (focusLatest) {
    focusLatest = false;
    const hEl = root.querySelector(".sheet.is-latest h2");
    hEl?.focus({ preventScroll: true });
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    root
      .querySelector(".sheet.is-latest")
      ?.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
  }
}

function save() {
  if (story) write(KEY, story);
  write(SKEY, settings);
}

root.addEventListener("click", (e) => {
  const el = e.target.closest("button");
  if (!el) return;
  if (el.id === "open") {
    story = story ? R.restart(story) : R.createRead();
    opened = true;
    focusLatest = true;
  } else if (el.id === "resume") {
    opened = true;
    focusLatest = true;
  } else if (el.id === "restart") confirmRestart = true;
  else if (el.id === "restart-no") confirmRestart = false;
  else if (el.id === "restart-yes" || el.id === "again") {
    story = R.restart(story);
    confirmRestart = false;
    focusLatest = true;
  } else if (el.dataset.choice) {
    if (R.choose(story, el.dataset.choice)) focusLatest = true;
  } else if (el.dataset.size) {
    settings.size = Math.max(
      0,
      Math.min(R.SIZES.length - 1, settings.size + Number(el.dataset.size)),
    );
    save();
    render();
    root.querySelector("details.settings")?.setAttribute("open", "");
    return;
  } else return;
  save();
  render();
});

root.addEventListener("change", (e) => {
  const el = e.target;
  if (el.dataset.set) settings[el.dataset.set] = el.value;
  else if (el.dataset.toggle) settings[el.dataset.toggle] = el.checked ? "wide" : "normal";
  else return;
  settings = R.normalizeSettings(settings);
  save();
  render();
  // Keep the settings panel open while the reader is adjusting it.
  root.querySelector("details.settings")?.setAttribute("open", "");
});

document.addEventListener("keydown", (e) => {
  if (
    !opened ||
    !story ||
    e.metaKey ||
    e.ctrlKey ||
    e.altKey ||
    e.target.matches?.("input, select, textarea")
  )
    return;
  if (/^[1-3]$/.test(e.key)) {
    const c = R.options(story)[Number(e.key) - 1];
    if (c && R.choose(story, c.id)) {
      focusLatest = true;
      save();
      render();
    }
  }
});

window.tlabI18n?.onLang?.(render);
render();
