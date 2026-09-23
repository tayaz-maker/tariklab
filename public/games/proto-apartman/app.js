// Apartment community prototype: DOM layer. Rules live in sim.js.
import {
  APPROACHES,
  DUES,
  HOUSEHOLDS,
  ISSUES,
  PERIODS,
  SYSTEMS,
  SYSTEM_IDS,
  TAGS,
  WINGS,
} from "./data.js";
import * as S from "./sim.js";

const KEY = "tariklab.proto-apartman.v1";
const root = document.getElementById("app");
const byIssue = Object.fromEntries(ISSUES.map((i) => [i.id, i]));
const byHH = Object.fromEntries(HOUSEHOLDS.map((h) => [h.id, h]));

const lang = () => (window.tlabI18n?.getLang?.() === "en" ? "en" : "tr");
const t = (tr, en) => (lang() === "en" ? en : tr);
const pair = (p) => (Array.isArray(p) ? t(p[0], p[1]) : p);
const h = (v) =>
  String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const tl = (n) =>
  new Intl.NumberFormat(lang() === "en" ? "en-GB" : "tr-TR").format(Math.round(n)) + " TL";
const signed = (n) => (n > 0 ? `+${n}` : String(n));
const sysName = (k) => t(SYSTEMS[k].tr, SYSTEMS[k].en);
const periodName = (i) => t(PERIODS[i].tr, PERIODS[i].en);

let state = load();
let draftPlan = [...S.DEFAULT_PLAN];
let notice = "";

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? S.normalize(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}
function save() {
  try {
    if (state) localStorage.setItem(KEY, JSON.stringify(state));
    else localStorage.removeItem(KEY);
  } catch {
    /* Storage may be unavailable; the game still runs for this visit. */
  }
}

// ---------- building plan (top-down courtyard) ----------

const CELLS = (() => {
  const out = {};
  const a = HOUSEHOLDS.filter((x) => x.wing === "A");
  a.forEach((x, i) => (out[x.id] = { x: 40 + i * 53.3, y: 22, w: 51, h: 62 }));
  const b = HOUSEHOLDS.filter((x) => x.wing === "B");
  b.forEach((x, i) => (out[x.id] = { x: 318, y: 92 + i * 46, w: 62, h: 44 }));
  const c = HOUSEHOLDS.filter((x) => x.wing === "C");
  c.forEach((x, i) => (out[x.id] = { x: 20, y: 92 + i * 46, w: 62, h: 44 }));
  return out;
})();
const centre = (id) => [CELLS[id].x + CELLS[id].w / 2, CELLS[id].y + CELLS[id].h / 2];

function mix(a, b, k) {
  const pa = a.match(/\w\w/g).map((x) => parseInt(x, 16));
  const pb = b.match(/\w\w/g).map((x) => parseInt(x, 16));
  return (
    "#" +
    pa
      .map((v, i) =>
        Math.round(v + (pb[i] - v) * k)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
const NEED_COLOUR = {
  water: "#6f9fb0",
  power: "#d0a24a",
  security: "#9a8fc2",
  structure: "#b9744f",
};

function cellFill(s, id) {
  const st = s.households.find((x) => x.id === id);
  if (s.ui.layer === "tolerance") return mix("262a2a", "7fb3a6", st.tolerance / 100);
  if (s.ui.layer === "needs") return NEED_COLOUR[byHH[id].needs];
  return mix("2a2521", "f0bf6a", st.trust / 100); // warm window light = trust
}

function overlay(s) {
  const k = s.ui.layer;
  if (!SYSTEM_IDS.includes(k)) return "";
  const c = s.systems[k].cond;
  const col = c < 40 ? "#d8694a" : c < 60 ? "#d0a24a" : "#8fb39a";
  const common = `stroke="${col}" fill="none" stroke-linecap="round"`;
  if (k === "water")
    return `<g ${common} stroke-width="3"><rect x="186" y="6" width="28" height="12" rx="2"/><path d="M200 18 V88 M200 88 H349 V320 M200 88 H51 V320"/></g>`;
  if (k === "power")
    return `<g ${common} stroke-width="2.5" stroke-dasharray="6 4"><rect x="226" y="334" width="22" height="14"/><path d="M237 334 V300 H349 V92 M237 300 H51 V92 M237 300 V88"/></g>`;
  if (k === "security")
    return `<g ${common} stroke-width="3"><path d="M170 344 H230"/><circle cx="200" cy="344" r="7"/><circle cx="51" cy="324" r="5"/><circle cx="349" cy="324" r="5"/><circle cx="200" cy="90" r="5"/></g>`;
  return `<g ${common} stroke-width="2.5" stroke-dasharray="3 5"><rect x="34" y="16" width="332" height="74"/><path d="M26 150 l14 18 l-6 12 l12 16"/><path d="M120 200 q80 40 160 0"/></g>`;
}

function planSvg(s, focus) {
  const hot = new Set(focus ? S.affected(byIssue[focus]) : []);
  const sel = s.ui.selected;
  const ties = sel
    ? S.neighbours(sel)
        .map((n) => {
          const [x1, y1] = centre(sel),
            [x2, y2] = centre(n);
          return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="tie"/>`;
        })
        .join("")
    : "";
  const cells = HOUSEHOLDS.map((x) => {
    const c = CELLS[x.id];
    const cls = ["flat", hot.has(x.id) ? "is-hot" : "", sel === x.id ? "is-sel" : ""].join(" ");
    const label = `${x.flat} · ${x.name}`;
    return `<g class="${cls}" data-flat="${x.id}" role="button" tabindex="0" aria-label="${h(label)}"><rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" rx="3" fill="${cellFill(s, x.id)}"/><text x="${c.x + 6}" y="${c.y + 15}">${x.flat}</text><text class="floor" x="${c.x + c.w - 6}" y="${c.y + c.h - 6}" text-anchor="end">${x.floor === 0 ? t("Z", "G") : x.floor}</text></g>`;
  }).join("");
  return `<svg class="plan" viewBox="0 0 400 360" role="img" aria-label="${h(t("Avlulu binanın kuşbakışı planı", "Top-down plan of the courtyard building"))}">
    <rect x="0" y="0" width="400" height="360" class="ground"/>
    <path d="M14 14 H386 V330 H250 M150 330 H14 Z" class="walls"/>
    <rect x="88" y="92" width="224" height="232" class="court"/>
    <g class="paving">${Array.from({ length: 6 }, (_, i) => `<line x1="${100 + i * 40}" y1="100" x2="${100 + i * 40}" y2="316"/>`).join("")}</g>
    <circle cx="200" cy="206" r="30" class="tree"/><circle cx="200" cy="206" r="4" class="trunk"/>
    <rect x="150" y="330" width="100" height="22" class="street"/><text x="200" y="345" text-anchor="middle" class="street-label">${h(t("SOKAK · KAPI", "STREET · GATE"))}</text>
    <rect x="148" y="86" width="14" height="10" class="stair"/><rect x="238" y="86" width="14" height="10" class="stair"/><rect x="82" y="200" width="10" height="14" class="stair"/><rect x="308" y="200" width="10" height="14" class="stair"/>
    ${ties}${cells}${overlay(s)}
  </svg>`;
}

const LAYERS = [
  ["trust", "Güven", "Trust"],
  ["tolerance", "Tahammül", "Tolerance"],
  ["needs", "İhtiyaç", "Needs"],
  ...SYSTEM_IDS.map((k) => [k, SYSTEMS[k].tr, SYSTEMS[k].en]),
];

function planPanel(s) {
  const legend =
    s.ui.layer === "trust"
      ? t(
          "Pencere ışığı ne kadar sıcaksa hane kurula o kadar güveniyor.",
          "The warmer the window light, the more the household trusts the board.",
        )
      : s.ui.layer === "tolerance"
        ? t(
            "Açık ton: gürültü ve iş kesintisine sabır var.",
            "Lighter: patience for noise and disruption.",
          )
        : s.ui.layer === "needs"
          ? SYSTEM_IDS.map(
              (k) => `<span class="swatch" style="--c:${NEED_COLOUR[k]}"></span>${h(sysName(k))}`,
            ).join(" ")
          : `${h(sysName(s.ui.layer))}: ${h(t(SYSTEMS[s.ui.layer].partTr, SYSTEMS[s.ui.layer].partEn))} · ${t("durum", "condition")} ${s.systems[s.ui.layer].cond}`;
  return `<section class="panel plan-panel" aria-labelledby="plan-h">
    <div class="panel-head"><h2 id="plan-h">${t("Bina", "Building")}</h2>
      <div class="layers" role="group" aria-label="${h(t("Plan katmanı", "Plan layer"))}">${LAYERS.map(([k, tr, en]) => `<button type="button" data-layer="${k}" aria-pressed="${s.ui.layer === k}">${h(t(tr, en))}</button>`).join("")}</div></div>
    ${planSvg(s, s.ui.focus)}
    <p class="legend">${legend}</p>
    ${household(s)}
  </section>`;
}

function household(s) {
  const id = s.ui.selected;
  if (!id)
    return `<p class="hint">${t("Bir daireye dokun: kim olduğunu, kiminle konuştuğunu ve neye ihtiyaç duyduğunu gör.", "Tap a flat to see who lives there, who they talk to and what they need.")}</p>
      <details class="hh-list"><summary>${t("Hane listesi", "Household list")}</summary><ul>${HOUSEHOLDS.map((x) => `<li><button type="button" data-flat="${x.id}">${x.flat} · ${h(x.name)}</button></li>`).join("")}</ul></details>`;
  const m = byHH[id],
    st = s.households.find((x) => x.id === id);
  return `<article class="hh" aria-live="polite"><header><strong>${m.flat} · ${h(m.name)}</strong><button type="button" class="ghost" data-flat="">${t("Kapat", "Close")}</button></header>
    <p>${h(t(m.noteTr, m.noteEn))}</p>
    <p class="tags">${m.tags.map((k) => `<span>${h(t(TAGS[k].tr, TAGS[k].en))}</span>`).join("")}<span>${h(t(WINGS[m.wing].tr, WINGS[m.wing].en))}</span></p>
    <dl><div><dt>${t("Güven", "Trust")}</dt><dd>${bar(st.trust)}</dd></div><div><dt>${t("Tahammül", "Tolerance")}</dt><dd>${bar(st.tolerance)}</dd></div><div><dt>${t("En çok önemsediği", "Cares most about")}</dt><dd>${h(sysName(m.needs))}</dd></div></dl>
    <p class="ties">${t("Konuştuğu komşular", "Talks with")}: ${S.neighbours(id)
      .map(
        (n) =>
          `<button type="button" class="link" data-flat="${n}">${byHH[n].flat} ${h(byHH[n].name)}</button>`,
      )
      .join(", ")}</p></article>`;
}

const bar = (v, max = 100) =>
  `<span class="bar" role="meter" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${v}"><span style="width:${Math.max(0, Math.min(100, (v / max) * 100))}%"></span></span><b>${v}</b>`;

// ---------- decision queue ----------

function issueCard(s, id, index) {
  const i = byIssue[id];
  const who = S.affected(i);
  const back = S.returns(s, id);
  const chosen = s.choices[id] || "defer";
  const options = ["defer", ...i.allow]
    .map((a) => {
      const c = a === "defer" ? { ok: true } : S.canChoose(s, id, a);
      const cost = S.issueCost(s, i, a);
      const on = chosen === a;
      const why = c.ok || on ? "" : ` (${pair(c.reason)})`;
      const label = `${APPROACHES[a][lang()][0]} — ${cost ? tl(cost) : t("masraf yok", "no cost")}, ${APPROACHES[a].attention} ${t("mesai", "time")}${why}`;
      return `<option value="${a}" ${on ? "selected" : ""} ${!c.ok && !on ? "disabled" : ""}>${h(label)}</option>`;
    })
    .join("");
  const scope = i.who.all
    ? t("Tüm bina", "Whole building")
    : i.who.wing
      ? t(WINGS[i.who.wing].tr, WINGS[i.who.wing].en)
      : i.who.floor === 0
        ? t("Zemin kat", "Ground floor")
        : t("Üst kat", "Top floor");
  return `<article class="order sys-${i.system}" id="issue-${id}" data-focus="${id}">
    <p class="order-meta"><span class="order-no">${t("İŞ EMRİ", "WORK ORDER")} ${s.period}.${index + 1}</span><span>${h(sysName(i.system))}</span><span>${h(scope)} · ${who.length} ${t("hane", "households")}</span>${back ? `<span class="warn">${t("tekrar", "again")} ×${back + 1}</span>` : ""}</p>
    <h3>${h(pair([i.tr[0], i.en[0]]))}</h3><p class="order-body">${h(pair([i.tr[1], i.en[1]]))}</p>
    <label class="order-pick"><span>${t("Kurul kararı", "Board decision")}</span><select data-issue="${id}">${options}</select></label>
    <p class="order-note">${h(APPROACHES[chosen][lang()][1])}</p></article>`;
}

function previewBox(s) {
  const r = S.preview(s);
  if (!r) return "";
  const d = (k) => r.after[k] - r.before[k];
  const row = (label, a, b, good) =>
    `<div><dt>${label}</dt><dd><span>${a}</span> → <b class="${good === null ? "" : good ? "up" : "down"}">${b}</b></dd></div>`;
  return `<section class="preview" aria-labelledby="pv-h"><h3 id="pv-h">${t("Dönem sonu önizlemesi", "End-of-period preview")}</h3>
    <p class="small">${t("Bu sayılar kapatınca uygulanacak sayıların aynısıdır.", "These are the exact numbers that apply when you close.")}</p>
    <dl class="pv">
      ${row(t("Kasa", "Cash"), tl(r.before.cash), tl(r.after.cash), d("cash") >= 0)}
      ${row(t("Güven", "Trust"), r.before.trust, r.after.trust, d("trust") >= 0)}
      ${row(t("Bakım borcu", "Maintenance debt"), r.before.debt, r.after.debt, d("debt") <= 0)}
      ${row(t("Dayanışma", "Solidarity"), r.before.solidarity, r.after.solidarity, d("solidarity") >= 0)}
    </dl>
    <p class="small">${t("Harcama", "Spend")} ${tl(r.spent)} · ${t("aidat", "dues")} +${tl(r.income)} · ${t("işletme", "running")} −${tl(r.running)}</p>
    <p class="${r.promise.kept ? "ok" : "bad"}">${r.promise.kept ? t("Söz tutuluyor", "Promise kept") : t("Söz tutulmuyor", "Promise broken")}: ${h(sysName(r.promise.system))}${r.planRevised ? " · " + t("plan değişti (−2 güven)", "plan changed (−2 trust)") : ""}</p>
    ${r.incidents.length ? `<p class="bad">${t("Arıza riski gerçekleşecek", "A failure will happen")}: ${r.incidents.map(sysName).join(", ")}</p>` : ""}
    ${r.echoes.length ? `<p class="small">${r.echoes.length} ${t("komşu yankısı", "neighbour echoes")}</p>` : ""}
  </section>`;
}

function duesBox(s) {
  return `<fieldset class="dues"><legend>${t("Aidat kararı", "Dues decision")}</legend>${Object.entries(
    DUES,
  )
    .map(([k, v]) => {
      const locked = k === "raise" && s.duesRate > 1;
      return `<label class="${locked ? "locked" : ""}"><input type="radio" name="dues" value="${k}" ${s.dues === k ? "checked" : ""} ${locked ? "disabled" : ""}><span><b>${h(v[lang()][0])}</b> ${h(locked ? t("Zaten artırıldı.", "Already raised.") : v[lang()][1])}</span></label>`;
    })
    .join("")}</fieldset>`;
}

function queuePanel(s) {
  if (s.phase === "outcome") return outcomePanel(s);
  if (s.phase === "end") return endPanel(s);
  return `<section class="panel queue" aria-labelledby="q-h">
    <div class="panel-head"><h2 id="q-h">${t("Bu dönemin sorunları", "This period's problems")}</h2><span class="attn" aria-live="polite">${t("Kurul mesaisi", "Board time")} <b>${S.attentionUsed(s)}/${S.ATTENTION}</b> · ${t("ayrılan", "committed")} <b>${tl(S.cashCommitted(s))}</b></span></div>
    <p class="small">${t("Önce oku, sonra öncelik ver: mesai üç birim. Seçilmeyen her sorun ertelenir.", "Read first, then prioritise: board time is three units. Anything not chosen is deferred.")}</p>
    ${s.issues.map((id, n) => issueCard(s, id, n)).join("")}
    ${duesBox(s)}
    ${previewBox(s)}
    <button type="button" class="primary" id="commit">${t("Dönemi kapat", "Close the period")}</button>
  </section>`;
}

function outcomePanel(s) {
  const r = s.report;
  const lines = r.lines
    .map((l) => {
      const i = byIssue[l.issue];
      return `<li><b>${h(pair([i.tr[0], i.en[0]]))}</b>: ${h(APPROACHES[l.approach][lang()][0])}${l.cost ? " · " + tl(l.cost) : ""}</li>`;
    })
    .join("");
  const echoes = r.echoes
    .slice(0, 8)
    .map(
      (e) =>
        `<li>${h(byHH[e.from].name)} → ${h(byHH[e.to].name)} <b class="${e.delta > 0 ? "up" : "down"}">${signed(e.delta)}</b></li>`,
    )
    .join("");
  const last = s.period >= S.PERIOD_COUNT;
  return `<section class="panel queue outcome" aria-labelledby="o-h">
    <h2 id="o-h">${periodName(r.period - 1)} · ${t("sonuç ve yankı", "outcome and echo")}</h2>
    <ul class="lines">${lines}</ul>
    <p class="${r.promise.kept ? "ok" : "bad"}">${r.promise.kept ? t("Söz tutuldu", "Promise kept") : t("Söz tutulmadı", "Promise broken")}: ${h(sysName(r.promise.system))}</p>
    ${r.incidents.length ? `<p class="bad">${t("Arıza", "Failure")}: ${r.incidents.map(sysName).join(", ")} · −8.000 TL, ${t("herkeste güven −6", "trust −6 for everyone")}</p>` : ""}
    <h3>${t("Avluda konuşulanlar", "Talk in the courtyard")}</h3>
    ${echoes ? `<ul class="echoes">${echoes}</ul>` : `<p class="small">${t("Bu dönem kimse kimseye bir şey anlatmadı.", "Nobody told anyone anything this period.")}</p>`}
    <dl class="pv">${["cash", "trust", "debt", "solidarity"].map((k) => `<div><dt>${metricName(k)}</dt><dd>${k === "cash" ? tl(r.before[k]) : r.before[k]} → <b>${k === "cash" ? tl(r.after[k]) : r.after[k]}</b></dd></div>`).join("")}</dl>
    <button type="button" class="primary" id="next">${last ? t("Sonucu gör", "See the result") : t("Sonraki dönem", "Next period")}</button>
  </section>`;
}

function endPanel(s) {
  const v = S.verdict(s);
  return `<section class="panel queue end" aria-labelledby="e-h"><p class="eyebrow">${t("Üç dönem tamamlandı", "Three periods complete")}</p><h2 id="e-h">${h(t(v.tr[0], v.en[0]))}</h2><p>${h(t(v.tr[1], v.en[1]))}</p>
    <dl class="pv"><div><dt>${t("Bina sağlığı", "Building health")}</dt><dd><b>${S.health(s)}</b></dd></div><div><dt>${t("Topluluk", "Community")}</dt><dd><b>${S.community(s)}</b></dd></div>${["cash", "trust", "debt", "solidarity"].map((k) => `<div><dt>${metricName(k)}</dt><dd><b>${k === "cash" ? tl(S.metrics(s)[k]) : S.metrics(s)[k]}</b></dd></div>`).join("")}</dl>
    <ol class="history">${s.history.map((x) => `<li>${periodName(x.period - 1)}: ${x.promise.kept ? t("söz tutuldu", "promise kept") : t("söz tutulmadı", "promise broken")} (${h(sysName(x.promise.system))})${x.incidents.length ? " · " + t("arıza", "failure") : ""}</li>`).join("")}</ol>
    <button type="button" class="primary" id="restart">${t("Yeni bina", "New building")}</button></section>`;
}

const metricName = (k) =>
  ({
    cash: t("Kasa", "Cash"),
    trust: t("Güven", "Trust"),
    debt: t("Bakım borcu", "Maintenance debt"),
    solidarity: t("Dayanışma", "Solidarity"),
  })[k];

// ---------- ledger ----------

function ledgerPanel(s) {
  const m = S.metrics(s);
  const plan = s.plan
    .map((k, i) => {
      const past = s.history.find((x) => x.period === i + 1);
      const editable = s.phase === "decide" && i >= s.period - 1;
      const control = editable
        ? `<select data-plan="${i}" aria-label="${h(periodName(i) + " " + t("odağı", "focus"))}">${SYSTEM_IDS.map((x) => `<option value="${x}" ${x === k ? "selected" : ""}>${h(sysName(x))}</option>`).join("")}</select>`
        : `<b>${h(sysName(k))}</b>`;
      const status = past
        ? `<span class="${past.promise.kept ? "ok" : "bad"}">${past.promise.kept ? "✓" : "✗"}</span>`
        : i === s.period - 1 && s.phase === "decide"
          ? `<span class="now">${t("şimdi", "now")}</span>`
          : "";
      return `<li class="${i === s.period - 1 ? "is-now" : ""}"><span>${periodName(i)}</span>${control}${status}</li>`;
    })
    .join("");
  return `<section class="panel ledger" aria-labelledby="l-h"><h2 id="l-h">${t("Defter", "Ledger")}</h2>
    <dl class="metrics"><div><dt>${t("Kasa", "Cash")}</dt><dd class="${m.cash < 0 ? "bad" : ""}">${tl(m.cash)}</dd></div>
      <div><dt>${t("Güven", "Trust")}</dt><dd>${bar(m.trust)}</dd></div>
      <div><dt>${t("Bakım borcu", "Maintenance debt")}</dt><dd>${bar(m.debt, 200)}</dd></div>
      <div><dt>${t("Dayanışma", "Solidarity")}</dt><dd>${bar(m.solidarity)}</dd></div></dl>
    <h3>${t("Üç dönemlik bakım sözü", "Three-period maintenance promise")}</h3>
    <p class="small">${t("Her dönem bir sisteme söz verirsin. O sistemde kalıcı onarım ya da ortak çalışma yaparsan herkesin güveni +3; yapmazsan −4. Sözü değiştirmek −2.", "Each period you promise one system. A proper repair or shared work there gives everyone +3 trust; otherwise −4. Changing the promise costs −2.")}</p>
    <ol class="plan-list">${plan}</ol>
    <h3>${t("Ortak sistemler", "Shared systems")}</h3>
    <ul class="systems">${SYSTEM_IDS.map((k) => `<li><button type="button" class="link" data-layer="${k}">${h(sysName(k))}</button><span class="sysbar">${bar(s.systems[k].cond)}</span><span class="debt">${t("borç", "debt")} ${s.systems[k].debt}</span></li>`).join("")}</ul>
  </section>`;
}

// ---------- shell ----------

function help() {
  return `<details class="help"><summary>${t("Nasıl oynanır", "How to play")}</summary><div>
    <p>${t("On altı hanelik, üç kanatlı avlulu bir binanın kurulundasın. Üç dönem (sonbahar, kış, bahar) boyunca ortak sistemleri ayakta tutarken komşuların güvenini ve dayanışmayı korumaya çalışırsın.", "You sit on the board of a sixteen-household building with three wings around a courtyard. Over three periods (autumn, winter, spring) you keep the shared systems running while holding on to the neighbours' trust and solidarity.")}</p>
    <ul><li>${t("Her dönem dört sorun çıkar; kurul mesaisi üç birimdir. Hızlı yama 1, kalıcı onarım 2, ortak çalışma 2 mesai ister.", "Each period raises four problems; board time is three units. A quick patch takes 1, a proper repair 2, working together 2.")}</li>
    <li>${t("Ertelenen ve yamanan sorunlar daha pahalı döner. Kalıcı onarım gürültülüdür: evden çalışan ve gece çalışan komşuların sabrını tüketir.", "Deferred and patched problems come back more expensive. Proper repairs are noisy and wear down neighbours who work from home or at night.")}</li>
    <li>${t("Bir hanenin yaşadığı, konuştuğu komşulara da yansır (yankı).", "What a household experiences also reaches the neighbours it talks to (echo).")}</li>
    <li>${t("Klavye: 1–4 sorunlara gider, L plan katmanını değiştirir.", "Keyboard: 1–4 jump to problems, L cycles the plan layer.")}</li></ul></div></details>`;
}

function start() {
  root.innerHTML = `<main class="start"><div class="start-card">
    <p class="eyebrow">${t("PROTOTİP · ADI HENÜZ YOK", "PROTOTYPE · NOT YET NAMED")}</p>
    <h1>${t("Apartman topluluğu", "Apartment community")}</h1>
    <p>${t("On altı hane, dört ortak sistem, üç dönem. Kasayı rahatlatan her karar bir yerde borç bırakır; her borç birinin kapısını çalar.", "Sixteen households, four shared systems, three periods. Every decision that eases the cash leaves a debt somewhere, and every debt knocks on someone's door.")}</p>
    <fieldset class="plan-setup"><legend>${t("Üç dönemlik bakım sözün", "Your three-period maintenance promise")}</legend>
      ${draftPlan.map((k, i) => `<label>${periodName(i)}<select data-draft="${i}">${SYSTEM_IDS.map((x) => `<option value="${x}" ${x === k ? "selected" : ""}>${h(sysName(x))}</option>`).join("")}</select></label>`).join("")}</fieldset>
    <div class="row">${state ? `<button type="button" id="resume">${t("Kaldığın yerden", "Resume")}</button>` : ""}<button type="button" class="primary" id="begin">${t("Kurula otur", "Take your seat")}</button></div>
    ${help()}<p class="small"><a href="/">${t("← Oyunlar", "← Games")}</a></p></div></main>`;
}

function render() {
  document.documentElement.lang = lang();
  if (!state || state.ui.view === "start") return start();
  const s = state;
  const tab = s.ui.tab || "queue";
  const m = S.metrics(s);
  const pn = s.ended
    ? t("Bitti", "Finished")
    : `${periodName(s.period - 1)} ${s.period}/${S.PERIOD_COUNT}`;
  root.innerHTML = `<main class="game" data-tab="${tab}">
    <header class="top"><a href="/" class="back">${t("← Oyunlar", "← Games")}</a><span class="period">${pn}</span><div class="title"><strong>${t("Apartman topluluğu", "Apartment community")}</strong><span class="proto">${t("prototip", "prototype")}</span></div><span class="lang-slot"></span><button type="button" id="menu">${t("Menü", "Menu")}</button></header>
    <p class="strip" aria-label="${h(t("Özet", "Summary"))}">${t("Avluda dayanışma", "Solidarity in the courtyard")} <b>${m.solidarity}</b>, ${t("kurula güven", "trust in the board")} <b>${m.trust}</b>, ${t("bakım borcu", "maintenance debt")} <b>${m.debt}</b>; ${t("kasada", "cash")} <b class="${m.cash < 0 ? "bad" : ""}">${tl(m.cash)}</b>. ${t("Kurul mesaisi", "Board time")} <b>${S.attentionUsed(s)}/${S.ATTENTION}</b>.</p>
    <nav class="tabs" role="tablist" aria-label="${h(t("Bölümler", "Sections"))}">${[
      ["queue", "Öncelikler", "Priorities"],
      ["plan", "Bina", "Building"],
      ["ledger", "Defter", "Ledger"],
    ]
      .map(
        ([k, tr, en]) =>
          `<button type="button" role="tab" data-tab="${k}" aria-selected="${tab === k}">${t(tr, en)}</button>`,
      )
      .join("")}</nav>
    <p class="notice" role="status">${h(notice)}</p>
    <div class="work"><div class="col col-plan">${planPanel(s)}</div><div class="col col-queue">${queuePanel(s)}</div><div class="col col-ledger">${ledgerPanel(s)}${help()}</div></div>
  </main>`;
  window.tlabI18n?.mountLangToggle?.(root.querySelector(".lang-slot"));
}

function update(fn, msg = "") {
  fn();
  notice = msg;
  save();
  render();
}

root.addEventListener("click", (e) => {
  const el = e.target.closest("button, [data-flat]");
  if (!el) return;
  if (el.id === "begin") {
    state = S.createGame({ seed: (Date.now() % 100000) + 1, plan: draftPlan });
    return update(
      () => {},
      t("Kurul toplandı. Önce sorunları oku.", "The board is seated. Read the problems first."),
    );
  }
  if (el.id === "resume") return update(() => (state.ui.view = "game"));
  if (!state) return;
  if (el.id === "menu") return update(() => (state.ui.view = "start"));
  if (el.id === "restart") return update(() => (state = null));
  if (el.dataset.tab) return update(() => (state.ui.tab = el.dataset.tab));
  if (el.dataset.layer) return update(() => (state.ui.layer = el.dataset.layer));
  if (el.dataset.flat !== undefined)
    return update(() => (state.ui.selected = el.dataset.flat || null));
  if (el.id === "commit") {
    S.commit(state);
    return update(() => {}, t("Dönem kapandı.", "Period closed."));
  }
  if (el.id === "next") {
    S.nextPeriod(state);
    return update(
      () => (state.ui.focus = null),
      state.ended ? "" : t("Yeni dönem, yeni sorunlar.", "A new period, new problems."),
    );
  }
});

root.addEventListener("change", (e) => {
  const el = e.target;
  if (el.dataset.draft) {
    draftPlan[Number(el.dataset.draft)] = el.value;
    return;
  }
  if (!state) return;
  if (el.name === "dues") return update(() => S.setDues(state, el.value));
  if (el.dataset.issue) {
    const ok = S.choose(state, el.dataset.issue, el.value);
    return update(
      () => (state.ui.focus = el.dataset.issue),
      ok ? "" : pair(S.canChoose(state, el.dataset.issue, el.value).reason),
    );
  }
  if (el.dataset.plan)
    return update(
      () => S.setPlan(state, Number(el.dataset.plan), el.value),
      t(
        "Söz değişti: bu dönem herkesin güveni −2.",
        "Promise changed: −2 trust for everyone this period.",
      ),
    );
});

root.addEventListener("keydown", (e) => {
  const flat = e.target.closest?.("g[data-flat]");
  if (flat && (e.key === "Enter" || e.key === " ")) {
    e.preventDefault();
    return update(() => (state.ui.selected = flat.dataset.flat));
  }
});

document.addEventListener("keydown", (e) => {
  if (!state || e.target.matches?.("input, select, textarea") || e.metaKey || e.ctrlKey || e.altKey)
    return;
  if (/^[1-4]$/.test(e.key) && state.phase === "decide") {
    const id = state.issues[Number(e.key) - 1];
    if (!id) return;
    state.ui.tab = "queue";
    state.ui.focus = id;
    render();
    const pick = document.querySelector(`#issue-${id} select`);
    pick?.focus();
    pick?.scrollIntoView({ block: "nearest" });
  } else if (e.key === "l" || e.key === "L") {
    const i = LAYERS.findIndex(([k]) => k === state.ui.layer);
    update(() => (state.ui.layer = LAYERS[(i + 1) % LAYERS.length][0]));
  }
});

window.tlabI18n?.onLang?.(render);
render();
