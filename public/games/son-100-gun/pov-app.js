// Son 100 Gün — single-seat point-of-view interface. Silent by design.
import * as G from "./pov.js";
import { SCENARIOS, ROUTINES, ENDINGS, EPILOGUE, PHASES } from "./pov-data.js";

const root = document.querySelector("#app");
const LEGACY_KEYS = [1, 2, 3].map((n) => `tariklab.nextwave.son-100-gun.slot${n}`);

function lang() {
  let raw = window.tlabI18n?.getLang?.();
  if (!raw) {
    try {
      raw = localStorage.getItem("tariklab.language");
    } catch {
      raw = "tr";
    }
  }
  // Polish has no authored game text yet: an honest English fallback.
  return raw === "en" || raw === "pl" ? "en" : "tr";
}

const UI = {
  tr: {
    kicker: "Tek kişilik yaşam oyunu",
    lede: "Yüz gün kaldı. Her dönem yalnız bir şeye zaman ayırabilirsin; seçmediklerin bekler ya da kaybolur.",
    slots: "Kayıtlar",
    slot: "Kayıt",
    empty: "Boş",
    cont: "Devam et",
    del: "Sil",
    delAsk: "Bu kayıt silinsin mi?",
    delYes: "Evet, sil",
    cancel: "Vazgeç",
    newGame: "Yeni yüz gün",
    how: "Nasıl oynanır",
    howList: [
      "Her dönem üç durum gelir; yalnız birine karar verirsin.",
      "Her seçenek niyetini, kesin bedelini, belirsizliğini ve sonraki günlere taşınan etkisini gösterir.",
      "15. günde bir ritim kurarsın; 57. günde en zayıf yerin kırılır.",
      "Sonu tek bir sayı değil, en çok neye yatırım yaptığın belirler.",
    ],
    legacy: (n) =>
      `Önceki sürümden ${n} kayıt bu cihazda duruyor. Silinmedi; bu oyun ayrı bir kayıt alanı kullanır ve onları açmaz.`,
    silent: "Sessiz oyun: ses ya da müzik yok. Kayıtlar yalnız bu cihazda tutulur.",
    who: "Kim olarak?",
    whoNote: "Üç ayrı hayat; başlangıç değerleri, yakınları ve bir kartı farklı.",
    where: "Kayıt yeri",
    overwrite: "dolu — üzerine yazılır",
    start: "Başla",
    back: "← Kayıtlar",
    day: "Gün",
    left: (n) => `${n} gün kaldı`,
    save: "Kayıt",
    saveNote: (n, d) =>
      `Kayıt ${n}. Her karardan sonra kendiliğinden kaydedilir. Son kayıt: gün ${d}.`,
    toMenu: "Kayıtlara dön",
    period: (a, b) => (a === b ? `Gün ${a}` : `Gün ${a}–${b}`),
    deskNote: "Bu dönem tek karar. Seçmediğin durumlar bekler; bazıları bedel yazar.",
    ifSkipped: "Seçmezsen",
    certain: "Kesin",
    uncertain: (p) => `Belirsiz · %${p}`,
    lasting: "Sonraya taşar",
    noReturn: "Geri dönüşü yok",
    stays: "Karar açık kalır",
    intent: "Niyet",
    cost: "Şimdi",
    none: "Etkisi yok",
    odds: "Belirsizlik",
    oddsWin: (p) => `%${p} ihtimalle`,
    oddsLose: (p) => `%${p} ihtimalle`,
    sure: "Sonuç kesin; zar yok.",
    later: "Sonraki günlere",
    close: (d) => `Dönem sonu (gün ${d})`,
    closeNote: "Bedenin yıpranması, gelir-gider, ritim ve mesafe.",
    lapses: "Bırakılan durumlar",
    rhythmFrom: "Bundan sonra her dönem",
    commit: "Bu kararı yaşa",
    blockedBody: (n) => `Gücün yetmiyor (beden en az ${n}).`,
    blockedTold: "Önce birine söylemiş olman gerekir.",
    blockedQuit: "İşi bıraktın.",
    blockedSecret: "Kimse bilmiyor.",
    decision: "Karar",
    waited: "Bekleyenler",
    closed: (n) => `Dönem kapanışı · ${n} gün`,
    arrived: "Şimdi gelen",
    you: "Sen",
    people: "Yakınların",
    rhythm: "Ritim",
    noRhythm: "Henüz yok. 15. günde kurulacak.",
    carried: "Taşınanlar",
    nothingCarried: "Bekleyen etki yok.",
    marks: "Kalıcı izler",
    noMarks: "Henüz geri dönülmez bir karar yok.",
    journal: "Günlük",
    endings: "Sonlara uzaklık",
    endingsNote: (b) => `Bir sona ulaşmak için ilgili değer ${b} olmalı. En yükseği belirler.`,
    stats: { body: "Beden", money: "Birikim", peace: "İç huzur", mark: "İz" },
    money: (v) => (v < 0 ? `${Math.abs(v)} bin ₺ borç` : `${v} bin ₺`),
    moneyChip: (v) => `${v > 0 ? "+" : "−"}${Math.abs(v)} bin`,
    axes: { door: "Açık kapı", mark: "Kalan iz", still: "Sükûnet" },
    axisHint: { door: "yakınların ortalaması", mark: "bıraktığın iz", still: "iç huzur ve beden" },
    end: "Son",
    early: (d) => `Beden ${d}. günde durdu; yüz gün dolmadı.`,
    full: "Yüz gün doldu.",
    lastArrived: "Son güne yetişen etkiler",
    story: "Yüz günün kaydı",
    again: "Yeni yüz gün",
    win: "tuttu",
    lose: "tutmadı",
    flags: {
      told: "Haberi kendin verdin.",
      secret: "Haberi sakladın.",
      treatment: "Yoğun tedaviyi seçtin.",
      responding: "Tedavi işe yarıyor: beden daha yavaş yoruluyor.",
      comfort: "Ağrı kontrolünü seçtin: her dönem iç huzur +1.",
      quit: "İşi bıraktın.",
      will: "Vasiyetin hazır.",
      "trip-later": "Kıyı yolculuğunu erteledin.",
      "trip-lost": "Kıyı yolculuğu olmayacak.",
      reconciled: "Barıştınız.",
      handed: "İşini devrettin.",
      sold: "Bir şey sattın.",
      "let-go": "Bir kapıyı kapalı bıraktın.",
      "kin-moved": "Yakının yanına taşındı.",
      trial: "Deneysel tedaviye girdin.",
      letters: "Mektupları yazdın.",
      debt: "Borç var.",
    },
  },
  en: {
    kicker: "A one-seat life game",
    lede: "A hundred days are left. Each period you can give your time to only one thing; what you pass over waits or fades.",
    slots: "Saves",
    slot: "Save",
    empty: "Empty",
    cont: "Continue",
    del: "Delete",
    delAsk: "Delete this save?",
    delYes: "Yes, delete",
    cancel: "Cancel",
    newGame: "New hundred days",
    how: "How it plays",
    howList: [
      "Each period brings three situations; you decide on only one.",
      "Every option shows its intent, its certain cost, its uncertainty and what carries into later days.",
      "On day 15 you set a rhythm; on day 57 your weakest area breaks.",
      "The ending is not one score: it follows what you invested in most.",
    ],
    legacy: (n) =>
      `${n} save(s) from the previous version remain on this device. They were not deleted; this game uses a separate save area and does not open them.`,
    silent: "A silent game: no sound or music. Saves stay on this device only.",
    who: "Who are you?",
    whoNote: "Three different lives: different starting values, people and one card of their own.",
    where: "Save slot",
    overwrite: "occupied — will be overwritten",
    start: "Begin",
    back: "← Saves",
    day: "Day",
    left: (n) => `${n} days left`,
    save: "Save",
    saveNote: (n, d) => `Save ${n}. Saved automatically after each decision. Last saved: day ${d}.`,
    toMenu: "Back to saves",
    period: (a, b) => (a === b ? `Day ${a}` : `Days ${a}–${b}`),
    deskNote: "One decision this period. What you pass over waits; some of it costs you.",
    ifSkipped: "If you pass",
    certain: "Certain",
    uncertain: (p) => `Uncertain · ${p}%`,
    lasting: "Carries forward",
    noReturn: "No way back",
    stays: "Decision stays open",
    intent: "Intent",
    cost: "Now",
    none: "No effect",
    odds: "Uncertainty",
    oddsWin: (p) => `${p}% chance`,
    oddsLose: (p) => `${p}% chance`,
    sure: "The outcome is certain; no roll.",
    later: "Later days",
    close: (d) => `Period close (day ${d})`,
    closeNote: "Wear on the body, income and spending, rhythm and distance.",
    lapses: "Situations passed over",
    rhythmFrom: "From now on, every period",
    commit: "Live this decision",
    blockedBody: (n) => `Not enough strength (body at least ${n}).`,
    blockedTold: "You need to have told someone first.",
    blockedQuit: "You left work.",
    blockedSecret: "Nobody knows.",
    decision: "Decision",
    waited: "Passed over",
    closed: (n) => `Period close · ${n} days`,
    arrived: "Arriving now",
    you: "You",
    people: "Your people",
    rhythm: "Rhythm",
    noRhythm: "None yet. It is set on day 15.",
    carried: "Carried forward",
    nothingCarried: "Nothing is waiting.",
    marks: "Lasting marks",
    noMarks: "No irreversible decision yet.",
    journal: "Journal",
    endings: "Distance to the endings",
    endingsNote: (b) => `An ending needs its value at ${b}. The highest one decides.`,
    stats: { body: "Body", money: "Savings", peace: "Calm", mark: "Mark" },
    money: (v) => (v < 0 ? `₺${Math.abs(v)}k in debt` : `₺${v}k`),
    moneyChip: (v) => `${v > 0 ? "+" : "−"}${Math.abs(v)}k`,
    axes: { door: "An open door", mark: "What remains", still: "Stillness" },
    axisHint: { door: "average of your people", mark: "the mark you leave", still: "calm and body" },
    end: "Ending",
    early: (d) => `The body stopped on day ${d}; the hundred days did not run out.`,
    full: "The hundred days ran out.",
    lastArrived: "Effects that reached the last day",
    story: "The record of a hundred days",
    again: "New hundred days",
    win: "held",
    lose: "did not hold",
    flags: {
      told: "You told them yourself.",
      secret: "You kept the news to yourself.",
      treatment: "You chose the intensive treatment.",
      responding: "The treatment is working: the body tires more slowly.",
      comfort: "You chose pain control: calm +1 every period.",
      quit: "You left work.",
      will: "Your will is ready.",
      "trip-later": "You postponed the coast trip.",
      "trip-lost": "The coast trip will not happen.",
      reconciled: "You made peace.",
      handed: "You handed your work on.",
      sold: "You sold something.",
      "let-go": "You left a door shut.",
      "kin-moved": "Family moved in with you.",
      trial: "You joined the experimental treatment.",
      letters: "You wrote the letters.",
      debt: "There is debt.",
    },
  },
};

const u = () => UI[lang()];
const tx = (pair) => (pair ? (pair[lang()] ?? pair.tr) : "");
const esc = (v) =>
  String(v).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

let view = "menu";
let slot = 1;
let game = null;
let sel = null;
let setup = { scenario: null, slot: 1 };
let askDelete = null;
let focusAfter = null;

const key = (n) => `${G.SAVE_PREFIX}.slot${n}`;
function readSlot(n) {
  try {
    const raw = localStorage.getItem(key(n));
    return raw ? G.restore(raw) : null;
  } catch {
    return null;
  }
}
function writeSlot(n, s) {
  try {
    localStorage.setItem(key(n), G.serialize(s));
  } catch {
    /* private mode: play continues unsaved */
  }
}
function deleteSlot(n) {
  try {
    localStorage.removeItem(key(n));
  } catch {
    /* ignore */
  }
}
function legacyCount() {
  try {
    return LEGACY_KEYS.filter((k) => localStorage.getItem(k) != null).length;
  } catch {
    return 0;
  }
}

/** Fill {kin}, {kin.dat}, {Job}, {target}, {left} … for the current life. */
function fill(text, s, target) {
  const sc = G.scenario(s.scenario);
  const l = lang();
  const person = (k, form) => {
    const p = sc.people[k];
    if (!p) return "";
    return l === "tr" && form ? p[form] : p.name;
  };
  const cap = (v) => v.charAt(0).toLocaleUpperCase(l === "tr" ? "tr-TR" : "en-GB") + v.slice(1);
  return text.replace(/\{(\w+)(?:\.(\w+))?\}/g, (m, name, form) => {
    if (G.PEOPLE.includes(name)) return person(name, form);
    if (name === "target") return target ? person(target, form) : "";
    if (name === "left") return String(G.daysLeft(s));
    const low = name.toLowerCase();
    if (["job", "work", "asset"].includes(low)) {
      const v = tx(sc[low]);
      return name === low ? v : cap(v);
    }
    return m;
  });
}

function statLabel(k, s) {
  if (G.PEOPLE.includes(k)) return G.scenario(s.scenario).people[k].name;
  return u().stats[k];
}

function chips(fx, s, cls = "") {
  const entries = Object.entries(fx || {}).filter(([, v]) => v);
  if (!entries.length) return `<span class="chip is-none">${esc(u().none)}</span>`;
  return entries
    .map(([k, v]) => {
      const val = k === "money" ? u().moneyChip(v) : `${v > 0 ? "+" : "−"}${Math.abs(v)}`;
      return `<span class="chip ${v > 0 ? "is-up" : "is-down"} ${cls}">${esc(statLabel(k, s))} ${esc(val)}</span>`;
    })
    .join("");
}

function light(day) {
  if (day <= 20) return "sabah";
  if (day <= 45) return "ogle";
  if (day <= 70) return "ikindi";
  if (day <= 88) return "aksam";
  return "gece";
}

function persist() {
  if (game) writeSlot(slot, game);
}

// ——— Screens ———

function renderMenu() {
  const t = u();
  const legacy = legacyCount();
  const cards = [1, 2, 3]
    .map((n) => {
      const s = readSlot(n);
      let body = `<p class="slot-state">${esc(t.empty)}</p>`;
      if (s) {
        const sc = G.scenario(s.scenario);
        const status = s.ending
          ? `${t.end}: ${tx(ENDINGS[s.ending.id].title)}`
          : `${t.day} ${s.day} · ${tx(PHASES[G.phaseOf(s.day)])}`;
        body = `<p class="slot-state"><strong>${esc(tx(sc.name))}</strong><span>${esc(status)}</span></p>`;
      }
      const actions =
        askDelete === n
          ? `<p class="slot-ask" role="alert">${esc(t.delAsk)}</p>
             <div class="slot-actions"><button type="button" data-del-yes="${n}">${esc(t.delYes)}</button>
             <button type="button" data-del-no>${esc(t.cancel)}</button></div>`
          : s
            ? `<div class="slot-actions"><button type="button" class="primary" data-load="${n}">${esc(t.cont)}</button>
               <button type="button" data-del="${n}" aria-label="${esc(`${t.del} · ${t.slot} ${n}`)}">${esc(t.del)}</button></div>`
            : "";
      return `<article class="slot-card ${s ? "is-filled" : ""}" aria-labelledby="slot-h-${n}">
        <h3 id="slot-h-${n}">${esc(t.slot)} ${n}</h3>${body}${actions}</article>`;
    })
    .join("");
  return `<main class="pov pov-menu">
    <header class="menu-head">
      <a class="home" href="/">← TarikLab</a>
      <p class="kicker">${esc(t.kicker)}</p>
      <h1>Son 100 Gün</h1>
      <p class="lede">${esc(t.lede)}</p>
    </header>
    <section class="menu-slots" aria-labelledby="slots-h">
      <h2 id="slots-h">${esc(t.slots)}</h2>
      <div class="slots">${cards}</div>
      <button type="button" id="menu-new" class="primary wide">${esc(t.newGame)}</button>
    </section>
    <section class="how" aria-labelledby="how-h">
      <h2 id="how-h">${esc(t.how)}</h2>
      <ol>${t.howList.map((x) => `<li>${esc(x)}</li>`).join("")}</ol>
    </section>
    ${legacy ? `<p class="fine">${esc(t.legacy(legacy))}</p>` : ""}
    <p class="fine">${esc(t.silent)}</p>
  </main>`;
}

function renderSetup() {
  const t = u();
  const lives = SCENARIOS.map((sc) => {
    const on = setup.scenario === sc.id;
    const ppl = Object.values(sc.people)
      .map((p) => `<li><strong>${esc(p.name)}</strong> · ${esc(tx(p.role))}</li>`)
      .join("");
    return `<button type="button" class="life ${on ? "is-on" : ""}" data-scenario="${sc.id}" aria-pressed="${on}">
      <span class="life-name">${esc(tx(sc.name))}</span>
      <span class="life-pitch">${esc(tx(sc.pitch))}</span>
      <ul class="life-people">${ppl}</ul>
    </button>`;
  }).join("");
  const slots = [1, 2, 3]
    .map((n) => {
      const filled = Boolean(readSlot(n));
      const on = setup.slot === n;
      return `<button type="button" class="slot-pick ${on ? "is-on" : ""}" data-slot-pick="${n}" aria-pressed="${on}">
        ${esc(t.slot)} ${n} · ${esc(filled ? t.overwrite : t.empty)}</button>`;
    })
    .join("");
  return `<main class="pov pov-setup">
    <button type="button" class="link" data-go="menu">${esc(t.back)}</button>
    <h1>${esc(t.who)}</h1>
    <p class="lede">${esc(t.whoNote)}</p>
    <div class="lives">${lives}</div>
    <div class="slot-row" role="group" aria-labelledby="where-h"><h2 id="where-h">${esc(t.where)}</h2><div class="slot-picks">${slots}</div></div>
    <button type="button" id="confirm-start" class="primary wide" ${setup.scenario ? "" : "disabled"}>${esc(t.start)}</button>
  </main>`;
}

function saveMenu() {
  const t = u();
  return `<details class="save-menu">
    <summary>${esc(t.save)}</summary>
    <div class="save-popover">
      <p>${esc(t.saveNote(slot, game.day))}</p>
      <button type="button" data-go="menu">${esc(t.toMenu)}</button>
    </div>
  </details>`;
}

function topBar() {
  const t = u();
  const s = game;
  const status = s.ending ? t.end : tx(PHASES[G.phaseOf(s.day)]);
  return `<header class="bar">
    <div class="bar-title">
      <span class="bar-name">Son 100 Gün</span>
      <strong class="bar-day">${esc(t.day)} ${s.day}</strong>
      <span class="bar-left">${esc(s.ending ? status : t.left(G.daysLeft(s)))}</span>
    </div>
    ${s.ending ? "" : `<span class="phase">${esc(status)}</span>`}
    ${saveMenu()}
  </header>
  <div class="daybar" aria-hidden="true"><span style="width:${Math.min(100, s.day)}%"></span></div>`;
}

function blockedText(o) {
  const t = u();
  const n = o.needs || {};
  if (n.body != null && game.body < n.body) return t.blockedBody(n.body);
  if (n.flag === "told") return t.blockedTold;
  if (n.noflag === "quit") return t.blockedQuit;
  if (n.noflag === "secret") return t.blockedSecret;
  return "";
}

function planBlock(h, o) {
  const t = u();
  const s = game;
  const p = G.preview(s, h.id, o.id);
  const pct = (x) => Math.round(x * 100);
  const risk = p.risk
    ? `<div><dt>${esc(t.odds)}</dt><dd>
        <p><span class="odds">${esc(t.oddsWin(pct(p.risk.p)))}</span> ${chips(p.risk.win, s)}</p>
        <p><span class="odds">${esc(t.oddsLose(100 - pct(p.risk.p)))}</span> ${chips(p.risk.lose, s)}</p>
        ${p.risk.flag ? `<p class="small">${esc(t.flags[p.risk.flag] || "")}</p>` : ""}
      </dd></div>`
    : `<div><dt>${esc(t.odds)}</dt><dd>${esc(t.sure)}</dd></div>`;
  const later = p.later.length
    ? `<div><dt>${esc(t.later)}</dt><dd><ul>${p.later
        .map(
          (l) =>
            `<li><span class="when">${esc(t.day)} ${l.day}</span> ${chips(l.fx, s)} <span class="small">${esc(fill(tx(l.text), s, h.target))}</span></li>`,
        )
        .join("")}</ul></dd></div>`
    : "";
  const lapses = p.lapses.length
    ? `<div><dt>${esc(t.lapses)}</dt><dd><ul>${p.lapses
        .map((l) => `<li>${esc(fill(tx(G.card(l.id).title), s, l.target))}: ${chips(l.fx, s)}</li>`)
        .join("")}</ul></dd></div>`
    : "";
  const rhythm = p.routine
    ? `<p class="rhythm-note"><strong>${esc(t.rhythmFrom)}:</strong> ${esc(tx(ROUTINES[p.routine].each))}</p>`
    : "";
  return `<div class="plan" id="plan">
    <dl>
      <div><dt>${esc(t.intent)}</dt><dd>${esc(fill(tx(o.intent), s, h.target))}</dd></div>
      <div><dt>${esc(t.cost)}</dt><dd>${chips(p.now, s)}</dd></div>
      ${risk}${later}
      <div><dt>${esc(t.close(G.periodEnd(s.turn)))}</dt><dd>${chips(p.close.fx, s)}<p class="small">${esc(t.closeNote)}</p></dd></div>
      ${lapses}
    </dl>
    ${rhythm}
    ${p.irreversible ? `<p class="irrev">${esc(t.noReturn)}</p>` : ""}
    <button type="button" id="commit" class="primary wide">${esc(t.commit)}</button>
  </div>`;
}

function cardBlock(h) {
  const t = u();
  const s = game;
  const c = G.card(h.id);
  const lapse = c.lapse
    ? `<p class="lapse"><span>${esc(t.ifSkipped)}:</span> ${chips(G.resolveFx(c.lapse.fx, h.target), s)}</p>`
    : "";
  const opts = c.options
    .map((o) => {
      const reason = G.blocked(s, o);
      const on = sel && sel.card === h.id && sel.option === o.id;
      const tags = [
        o.risk ? t.uncertain(Math.round(o.risk.p * 100)) : t.certain,
        o.later?.length ? t.lasting : null,
        o.irreversible ? t.noReturn : null,
        o.keep ? t.stays : null,
      ].filter(Boolean);
      return `<button type="button" class="opt ${on ? "is-on" : ""}" data-card="${h.id}" data-opt="${o.id}" aria-pressed="${on}" ${reason ? "disabled" : ""}>
        <span class="opt-label">${esc(fill(tx(o.label), s, h.target))}</span>
        <span class="opt-intent">${esc(reason ? blockedText(o) : fill(tx(o.intent), s, h.target))}</span>
        <span class="opt-tags">${tags.map((x) => `<span class="tag ${x === t.noReturn ? "is-final" : ""}">${esc(x)}</span>`).join("")}</span>
      </button>`;
    })
    .join("");
  const chosen = sel && sel.card === h.id ? c.options.find((o) => o.id === sel.option) : null;
  return `<article class="dcard ${chosen ? "is-open" : ""}" aria-labelledby="c-${h.id}">
    <h3 id="c-${h.id}">${esc(fill(tx(c.title), s, h.target))}</h3>
    <p class="dcard-text">${esc(fill(tx(c.text), s, h.target))}</p>
    ${lapse}
    <div class="opts" role="group" aria-labelledby="c-${h.id}">${opts}</div>
    ${chosen ? planBlock(h, chosen) : ""}
  </article>`;
}

function outcomeBlock(log) {
  const t = u();
  const s = game;
  const c = G.card(log.card);
  const o = c.options.find((x) => x.id === log.option);
  const text = log.outcome ? tx(o.risk[`${log.outcome}Text`]) : tx(o.result) || "";
  const lapsed = log.lapsed.length
    ? `<p><span class="lbl">${esc(t.waited)}</span> ${log.lapsed.map((l) => chips(l.fx, s)).join("")}</p>`
    : "";
  const matured = log.close.matured.length
    ? `<ul class="arrived">${log.close.matured
        .map((m) => `<li>${esc(fill(tx(m.text), s, null))} ${chips(m.fx, s)}</li>`)
        .join("")}</ul>`
    : "";
  return `<section class="outcome" aria-labelledby="out-h" tabindex="-1" id="outcome">
    <h2 id="out-h">${esc(t.period(log.day, log.day + log.close.span - 1))} · ${esc(fill(tx(c.title), s, log.target))}</h2>
    <p class="out-choice">${esc(fill(tx(o.label), s, log.target))}${log.outcome ? ` — ${esc(log.outcome === "win" ? t.win : t.lose)}` : ""}</p>
    ${text ? `<p class="out-text">${esc(fill(text, s, log.target))}</p>` : ""}
    <p><span class="lbl">${esc(t.decision)}</span> ${chips(log.choiceFx, s)}</p>
    ${lapsed}
    <p><span class="lbl">${esc(t.closed(log.close.span))}</span> ${chips(log.close.fx, s)}</p>
    ${matured ? `<p class="lbl">${esc(t.arrived)}</p>${matured}` : ""}
  </section>`;
}

function bar(v, max = 100) {
  const w = Math.max(0, Math.min(100, (v / max) * 100));
  return `<span class="meter" aria-hidden="true"><span style="width:${w}%"></span></span>`;
}

function selfPanels() {
  const t = u();
  const s = game;
  const sc = G.scenario(s.scenario);
  const stats = G.STATS.map((k) => {
    const v = s[k];
    const shown = k === "money" ? t.money(v) : String(v);
    return `<li><span>${esc(t.stats[k])}</span><b>${esc(shown)}</b>${k === "money" ? bar(Math.max(0, v), 60) : bar(v)}</li>`;
  }).join("");
  const people = G.PEOPLE.map(
    (k) =>
      `<li><span>${esc(sc.people[k].name)} <small>${esc(tx(sc.people[k].role))}</small></span><b>${s.people[k]}</b>${bar(s.people[k])}</li>`,
  ).join("");
  const rhythm = s.routine
    ? `<p><strong>${esc(tx(ROUTINES[s.routine].name))}</strong></p><p class="small">${esc(tx(ROUTINES[s.routine].each))}</p>`
    : `<p class="small">${esc(t.noRhythm)}</p>`;
  const pending = s.pending.length
    ? `<ul class="carried">${[...s.pending]
        .sort((a, b) => a.due - b.due)
        .map(
          (p) =>
            `<li><span class="when">${esc(t.day)} ${G.CALENDAR[p.due] ?? G.LAST_DAY}</span> ${chips(p.fx, s)} <span class="small">${esc(fill(tx(p.text), s, p.target))}</span></li>`,
        )
        .join("")}</ul>`
    : `<p class="small">${esc(t.nothingCarried)}</p>`;
  const marks = s.flags.filter((f) => t.flags[f]);
  const scores = G.scores(s);
  const axes = ["door", "mark", "still"]
    .map(
      (k) =>
        `<li><span>${esc(t.axes[k])} <small>${esc(t.axisHint[k])}</small></span><b>${scores[k]}/${G.ENDING_BAR}</b>${bar(scores[k])}</li>`,
    )
    .join("");
  const journal = s.log
    .slice(-5)
    .reverse()
    .map((l) => {
      const c = G.card(l.card);
      const o = c.options.find((x) => x.id === l.option);
      return `<li><span class="when">${esc(t.day)} ${l.day}</span> ${esc(fill(tx(c.title), s, l.target))} → ${esc(fill(tx(o.label), s, l.target))}</li>`;
    })
    .join("");
  return `<aside class="self" aria-label="${esc(t.you)}">
    <section class="panel"><h2>${esc(t.you)}</h2><ul class="stats">${stats}</ul></section>
    <section class="panel"><h2>${esc(t.people)}</h2><ul class="stats">${people}</ul></section>
    <section class="panel"><h2>${esc(t.endings)}</h2><ul class="stats">${axes}</ul><p class="small">${esc(t.endingsNote(G.ENDING_BAR))}</p></section>
    <section class="panel"><h2>${esc(t.rhythm)}</h2>${rhythm}</section>
    <section class="panel"><h2>${esc(t.carried)}</h2>${pending}</section>
    <section class="panel"><h2>${esc(t.marks)}</h2>${
      marks.length
        ? `<ul class="marks">${marks.map((f) => `<li>${esc(t.flags[f])}</li>`).join("")}</ul>`
        : `<p class="small">${esc(t.noMarks)}</p>`
    }</section>
    ${journal ? `<section class="panel"><h2>${esc(t.journal)}</h2><ul class="journal">${journal}</ul></section>` : ""}
  </aside>`;
}

function strip() {
  const t = u();
  const s = game;
  return `<ul class="strip" aria-label="${esc(t.you)}">${G.STATS.map(
    (k) =>
      `<li><span>${esc(t.stats[k])}</span><b>${esc(k === "money" ? t.money(s[k]) : s[k])}</b></li>`,
  ).join("")}</ul>`;
}

function renderGame() {
  const t = u();
  const s = game;
  const last = s.log.at(-1);
  const to = G.periodEnd(s.turn) - 1;
  return `<div class="pov pov-game">
    ${topBar()}
    <div class="layout">
      <section class="desk" aria-labelledby="desk-h">
        ${last ? outcomeBlock(last) : ""}
        ${strip()}
        <h2 id="desk-h" class="desk-h">${esc(t.period(s.day, Math.max(s.day, to)))}</h2>
        <p class="desk-note">${esc(t.deskNote)}</p>
        <div class="cards">${s.hand.map(cardBlock).join("")}</div>
      </section>
      ${selfPanels()}
    </div>
  </div>`;
}

function renderEnd() {
  const t = u();
  const s = game;
  const e = s.ending;
  const def = ENDINGS[e.id];
  const epi = Object.keys(EPILOGUE).filter((f) => s.flags.includes(f));
  const axes = ["door", "mark", "still"]
    .map(
      (k) =>
        `<li class="${k === e.id ? "is-top" : ""}"><span>${esc(t.axes[k])} <small>${esc(t.axisHint[k])}</small></span><b>${e.scores[k]}/${G.ENDING_BAR}</b>${bar(e.scores[k])}</li>`,
    )
    .join("");
  const story = s.log
    .map((l) => {
      const c = G.card(l.card);
      const o = c.options.find((x) => x.id === l.option);
      return `<li><span class="when">${esc(t.day)} ${l.day}</span> ${esc(fill(tx(c.title), s, l.target))} → ${esc(fill(tx(o.label), s, l.target))}${
        l.outcome
          ? ` <span class="small">(${esc(l.outcome === "win" ? t.win : t.lose)})</span>`
          : ""
      }</li>`;
    })
    .join("");
  const arrived = e.arrived.length
    ? `<section class="panel"><h2>${esc(t.lastArrived)}</h2><ul class="carried">${e.arrived
        .map((a) => `<li>${esc(fill(tx(a.text), s, null))} ${chips(a.fx, s)}</li>`)
        .join("")}</ul></section>`
    : "";
  return `<div class="pov pov-end">
    ${topBar()}
    <main class="ending">
      <p class="kicker">${esc(e.early ? t.early(e.day) : t.full)}</p>
      <h1 id="end-h" tabindex="-1">${esc(tx(def.title))}</h1>
      <p class="lede">${esc(fill(tx(def.text), s, null))}</p>
      ${epi.length ? `<ul class="epilogue">${epi.map((f) => `<li>${esc(fill(tx(EPILOGUE[f]), s, null))}</li>`).join("")}</ul>` : ""}
      <section class="panel"><h2>${esc(t.endings)}</h2><ul class="stats">${axes}</ul></section>
      ${arrived}
      <section class="panel"><h2>${esc(t.story)}</h2><ol class="journal">${story}</ol></section>
      <div class="end-actions">
        <button type="button" class="primary" id="end-new">${esc(t.again)}</button>
        <button type="button" data-go="menu">${esc(t.toMenu)}</button>
      </div>
    </main>
  </div>`;
}

function render() {
  document.documentElement.lang = lang();
  const day = view === "game" && game ? game.day : 1;
  document.body.dataset.light = view === "game" && game?.ending ? "gece" : light(day);
  if (view === "menu") root.innerHTML = renderMenu();
  else if (view === "setup") root.innerHTML = renderSetup();
  else if (game?.ending) root.innerHTML = renderEnd();
  else root.innerHTML = renderGame();
  if (focusAfter) {
    const target = focusAfter;
    const el = root.querySelector(target);
    focusAfter = null;
    if (el) {
      el.focus({ preventScroll: true });
      // Screen changes move to their heading; in-place choices keep the scroll position.
      // The ending opens at the top so its first line (how the days ended) stays in view.
      if (target === "#end-h") window.scrollTo(0, 0);
      else if (/^(#|h1)/.test(target)) el.scrollIntoView({ block: "start", behavior: "auto" });
    }
  }
}

function openSlot(n) {
  const s = readSlot(n);
  if (!s) return;
  slot = n;
  game = s;
  sel = null;
  view = "game";
  focusAfter = s.ending ? "#end-h" : "#desk-h";
}

root.addEventListener("click", (event) => {
  const el = event.target.closest("button, [data-go]");
  if (!el || el.disabled) return;
  const d = el.dataset;
  if (el.id === "menu-new" || el.id === "end-new") {
    const free = [1, 2, 3].find((n) => !readSlot(n));
    setup = { scenario: null, slot: el.id === "end-new" ? slot : free || 1 };
    view = "setup";
    askDelete = null;
    focusAfter = "h1";
  } else if (d.go === "menu") {
    view = "menu";
    sel = null;
    focusAfter = "h1";
  } else if (d.load) {
    openSlot(Number(d.load));
  } else if (d.del) {
    askDelete = Number(d.del);
    focusAfter = `[data-del-yes="${d.del}"]`;
  } else if (d.delYes) {
    deleteSlot(Number(d.delYes));
    askDelete = null;
    focusAfter = "#menu-new";
  } else if ("delNo" in d) {
    askDelete = null;
    focusAfter = "#menu-new";
  } else if (d.scenario) {
    setup.scenario = d.scenario;
    focusAfter = `[data-scenario="${d.scenario}"]`;
  } else if (d.slotPick) {
    setup.slot = Number(d.slotPick);
    focusAfter = `[data-slot-pick="${d.slotPick}"]`;
  } else if (el.id === "confirm-start") {
    if (!setup.scenario) return;
    slot = setup.slot;
    const seed = (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
    game = G.createGame(setup.scenario, seed);
    persist();
    sel = null;
    view = "game";
    focusAfter = "#desk-h";
  } else if (d.card && d.opt) {
    sel =
      sel && sel.card === d.card && sel.option === d.opt ? null : { card: d.card, option: d.opt };
    focusAfter = `[data-card="${d.card}"][data-opt="${d.opt}"]`;
  } else if (el.id === "commit") {
    if (!sel || !G.choose(game, sel.card, sel.option)) return;
    sel = null;
    persist();
    focusAfter = game.ending ? "#end-h" : "#outcome";
  } else {
    return;
  }
  render();
});

root.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  const open = root.querySelector("details.save-menu[open]");
  if (open) {
    open.open = false;
    open.querySelector("summary").focus();
  }
});

window.tlabI18n?.onLang?.(() => render());
window.addEventListener("storage", (event) => {
  if (event.key === "tariklab.language" && !window.tlabI18n) render();
});

render();
