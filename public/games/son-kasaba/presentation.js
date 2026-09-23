import { HELP_SECTIONS } from "./help.js";
import {
  BUILDINGS,
  COHORTS,
  GROUPS,
  NPCS,
  INVESTORS,
  EVENTS,
  IDENTITIES,
  ENDINGS,
  ROLE_TEXT,
} from "./data.js";
import {
  youngPopulation,
  indicators,
  economy,
  actionInfo,
  CIVIC_ACTIONS,
  TOWN_STAGES,
  investorTerms,
  triage,
  nextCapacity,
  capacityLimit,
  BASE_CAPACITY,
  STRETCH_MAX,
  RESERVE_AT,
  RESERVE_BONUS,
} from "./sim.js";
import { escapeHtml as h, helpPanel, language, text as t } from "../next-wave/shared/runtime.js";
export const tr = (p) => t(p[0], p[1]);
export const number = (n) => Math.round(n).toLocaleString(language() === "en" ? "en-GB" : "tr-TR");
export const NAV = [
  ["center", "KÖY MERKEZİ", "VILLAGE CENTRE"],
  ["agenda", "GÜNDEM", "AGENDA"],
  ["budget", "BÜTÇE", "BUDGET"],
  ["services", "HİZMETLER", "SERVICES"],
  ["business", "İŞLETMELER", "BUSINESSES"],
  ["population", "NÜFUS / GÖÇ", "POPULATION / MIGRATION"],
  ["people", "İNSANLAR", "PEOPLE"],
  ["groups", "GRUPLAR", "GROUPS"],
  ["investors", "YATIRIMCILAR", "INVESTORS"],
  ["files", "DOSYALAR", "FILES"],
  ["history", "GEÇMİŞ", "HISTORY"],
  ["report", "AY RAPORU", "MONTHLY REPORT"],
];
export const LABELS = {
  budget: ["Bütçe", "Budget"],
  debt: ["Borç", "Debt"],
  road: ["Yol", "Road"],
  supply: ["Stok", "Supply"],
  prices: ["Fiyat endeksi", "Price index"],
  rent: ["Kira baskısı", "Rent pressure"],
  water: ["Su", "Water"],
  energy: ["Enerji altyapısı", "Power network"],
  jobs: ["İş imkânı", "Jobs"],
  trust: ["Halk güveni", "Public trust"],
  health: ["Sağlık hizmeti", "Healthcare"],
  school: ["Eğitim hizmeti", "Education"],
  services: ["Hizmet kalitesi", "Service quality"],
  social: ["Sosyal hayat", "Social life"],
  pollution: ["Kirlilik", "Pollution"],
  reputation: ["İtibar", "Reputation"],
  localIdentity: ["Yerel kimlik", "Local identity"],
  inequality: ["Eşitsizlik", "Inequality"],
  company: ["Şirket kontrolü", "Company control"],
  production: ["Üretim", "Production"],
  agriculture: ["Tarım", "Agriculture"],
  tourism: ["Turizm", "Tourism"],
  enterprise: ["Girişim", "Enterprise"],
};
const CHAIN_LABELS = {
  "road-supply": ["Yol ve stok", "Road and supply"],
  "school-families": ["Okul ve aileler", "School and families"],
  "investor-dependency": ["Yatırımcı bağımlılığı", "Investor dependency"],
  "town-charter": ["Köy şartı", "Village charter"],
};
const CHAIN_STAGES = {
  signal: ["sinyal", "signal"],
  risk: ["risk", "risk"],
  crisis: ["kriz", "crisis"],
  stable: ["dengede", "stable"],
  "teacher-left": ["öğretmen ayrıldı", "teacher left"],
  dependency: ["bağımlılık", "dependency"],
  bargained: ["pazarlıklı", "bargained"],
  available: ["erişilebilir", "available"],
};
const INSTITUTIONS = {
  council: [
    "▣ Konsey",
    "▣ Council",
    "Muhtarlık defteri. Grup baskısını dengeler; aylık halk güvenine +1.",
    "Village-office ledger. Balances group pressure; +1 public trust each month.",
  ],
  "service-board": [
    "✚ Hizmet kurulu",
    "✚ Service board",
    "Ocak ve okul sırası. Sağlık, eğitim ve toplam hizmet göstergelerine +4.",
    "Clinic and school queue. +4 to health, education and overall services.",
  ],
  "market-desk": [
    "▤ Pazar masası",
    "▤ Market desk",
    "Tezgâh defteri. Yerel işletme gelirine %5.",
    "Stall ledger. +5% local business income.",
  ],
  "planning-office": [
    "⌖ Planlama ofisi",
    "⌖ Planning office",
    "Saha krokisi. Bakım ve altyapı giderlerini %7 azaltır.",
    "Field sketch. Reduces maintenance and infrastructure costs by 7%.",
  ],
  "social-council": [
    "◎ Sosyal konsey",
    "◎ Social council",
    "Göç masası. Tüm hanelerin aylık göç baskısını azaltır.",
    "Migration desk. Reduces monthly migration pressure for every cohort.",
  ],
  "town-charter": [
    "❦ Köy şartı",
    "❦ Village charter",
    "Mühürlü söz. Şirket kontrolünü ayda 1 azaltır; yerel kimliği korur.",
    "Sealed word. Reduces company control by 1 monthly and protects local identity.",
  ],
};
const band = (v, inverse = false) => {
  const n = inverse ? 100 - v : v;
  return n < 30
    ? t("Kritik", "Critical")
    : n < 50
      ? t("Kırılgan", "Fragile")
      : n < 70
        ? t("İdare ediyor", "Holding up")
        : t("Güçlü", "Strong");
};
function meter(label, value, inverse = false) {
  return `<div class="town-meter"><span>${h(label)}</span><strong>${number(value)}/100 · ${band(value, inverse)}</strong><meter min="0" max="100" value="${value}" aria-label="${h(label)}"></meter></div>`;
}
/** The month's field capacity as cells: used, free, and the stretch zone. */
export function capacityCells(s) {
  const max = s.capacityMax || BASE_CAPACITY,
    used = s.capacityUsed || 0;
  const cells = Array.from({ length: capacityLimit(s) }, (_, k) =>
    `<i class="${k < used ? (k >= max ? "is-stretch" : "is-used") : k >= max ? "is-zone" : ""}"></i>`,
  ).join("");
  return `<span class="cap-cells" role="img" aria-label="${h(t(`Kapasite ${used}/${max}, ${STRETCH_MAX} zorlama payı`, `Capacity ${used}/${max}, ${STRETCH_MAX} stretch points`))}">${cells}</span>`;
}
export function button(s, cmd, label) {
  const a = actionInfo(s, cmd);
  const stretch = !a.reason && a.stretch ? ` · ${t(`${a.stretch} zorlama`, `${a.stretch} stretch`)}` : "";
  return `<button type="button" data-command="${h(cmd)}" ${a.reason ? "disabled" : ""} class="${stretch ? "is-stretching" : ""}"><strong>${h(label || tr(a.label))}</strong><small>${a.effort} ${t("kapasite", "capacity")} · ${number(a.cost)} TL${stretch}${a.reason ? ` · ${h(tr(a.reason))}` : ""}</small></button>`;
}
/** This month's plan: what the capacity buys, what is urgent, what can wait. */
function monthPlan(s) {
  const max = s.capacityMax || BASE_CAPACITY,
    used = s.capacityUsed || 0,
    next = nextCapacity(s),
    q = triage(s);
  const status =
    used > max
      ? t(`Ekip zorlanıyor: gelecek ay kapasite ${next}.`, `The team is stretched: next month's capacity is ${next}.`)
      : max - used >= RESERVE_AT
        ? t(`${max - used} boş: böyle kapatırsan gelecek ay +${RESERVE_BONUS} kapasite.`, `${max - used} free: close like this and next month gains +${RESERVE_BONUS}.`)
        : t(`${max - used} kapasite kaldı. ${STRETCH_MAX} puana kadar zorlayabilirsin; her puan gelecek aydan düşer.`, `${max - used} capacity left. You can stretch up to ${STRETCH_MAX}; each point comes off next month.`);
  const row = (x, tone) =>
    `<li><button type="button" class="plan-item ${tone}" data-screen="${x.screen}"><strong>${h(tr(x.label))}</strong><small>${h(tr(x.reason))}</small></button></li>`;
  return `<section class="month-plan" aria-label="${t("Bu ayın planı", "This month's plan")}"><div class="month-plan__head"><div><p class="eyebrow">${t("BU AYIN PLANI", "THIS MONTH'S PLAN")}</p><p class="month-plan__cap"><strong>${used}/${max}</strong> ${t("saha kapasitesi", "field capacity")}</p></div>${capacityCells(s)}</div><p class="month-plan__status">${h(status)}</p><div class="month-plan__lists"><div><h3 class="is-urgent">${t("Acil", "Urgent")}</h3>${q.urgent.length ? `<ul>${q.urgent.map((x) => row(x, "is-urgent")).join("")}</ul>` : `<p class="empty">${t("Bu ay düşecek dosya ya da çöken altyapı yok.", "Nothing lapses this month and no infrastructure is failing.")}</p>`}</div><div><h3 class="is-invest">${t("Yatırım · bekleyebilir", "Investment · can wait")}</h3>${q.invest.length ? `<ul>${q.invest.map((x) => row(x, "is-invest")).join("")}</ul>` : `<p class="empty">${t("Açık fırsat yok.", "No open opportunity.")}</p>`}</div></div></section>`;
}
const effects = (e) =>
  Object.entries(e)
    .map(
      ([k, v]) =>
        `${tr(LABELS[k] || [k, k])} ${v > 0 ? "+" : ""}${number(v)}${["budget", "debt"].includes(k) ? " TL" : ""}`,
    )
    .join(" · ");
function civic(s, ids) {
  return `<div class="town-actions">${CIVIC_ACTIONS.filter((a) => ids.includes(a.id))
    .map((a) => `<article>${button(s, `civic:${a.id}`)}<p>${h(effects(a.effects))}</p></article>`)
    .join("")}</div>`;
}
function agenda(s, limit = 10) {
  const rows = s.events.filter((e) => e.status === "open").slice(0, limit);
  return (
    rows
      .map((e) => {
        const d = EVENTS.find((d) => d.id === e.id);
        return `<article class="agenda-card"><p class="eyebrow">${t("SON YANIT", "REPLY BY")} · ${t("AY", "MONTH")} ${e.expires}</p><h3>${h(tr(d.title))}</h3><p>${h(tr(d.text))}</p><div class="town-actions">${d.choices.map((c) => `<div>${button(s, `event:${e.id}:${c.id}`, tr(c.label))}<p class="effect-preview">${h(effects(c.effects))}${c.delay ? ` · ${t("Takip dosyası açılır; sonuç sonraki aylarda gelir.", "Opens a follow-up file; consequences arrive in later months.")}` : ""}</p></div>`).join("")}</div></article>`;
      })
      .join("") ||
    `<p class="empty">${t("Şu an açık talep yok. Hizmetlere ve gelecek ayın bütçesine bakabilirsin.", "No open requests. You can review services and next month's budget.")}</p>`
  );
}
function buildingCards(s, ids) {
  return `<div class="town-grid">${BUILDINGS.filter((d) => ids.includes(d.id))
    .map((d) => {
      const b = s.buildings.find((b) => b.id === d.id);
      return `<article><div class="card-title"><h3>${h(tr(d.name))}</h3><span class="stamp">${b.open ? t("AÇIK", "OPEN") : t("KAPALI", "CLOSED")}</span></div><p>${h(tr(ROLE_TEXT[d.role]))}</p>${meter(t("Fiziksel durum", "Condition"), b.condition)}<p>${t("Aylık bakım", "Monthly maintenance")}: ${number(d.upkeep * (b.open ? 1 : 0.15))} TL</p><div class="town-actions">${button(s, `repair:${d.id}`, t("Onar · durum +30", "Repair · condition +30"))}${button(s, `toggle:${d.id}`, b.open ? t("Geçici kapat", "Temporarily close") : t("Yeniden aç", "Reopen"))}</div><small>${t("Kapalı bina hizmet/gelir vermez; koruma gideri %15 sürer.", "Closed buildings provide no services or income; 15% preservation costs remain.")}</small></article>`;
    })
    .join("")}</div>`;
}
const lineRows = (rows, labels) =>
  Object.entries(rows)
    .map(
      ([k, v]) =>
        `<div class="money-row"><span>${h(tr(labels[k]))}</span><strong>${number(v)} TL</strong></div>`,
    )
    .join("");
const INCOME = {
  local: ["Yerel vergi", "Local tax"],
  business: ["İşletme vergileri", "Business tax"],
  tourism: ["Turizm", "Tourism"],
  production: ["Üretim", "Production"],
  agriculture: ["Tarım", "Agriculture"],
  support: ["Belediye desteği", "Municipal support"],
  donations: ["Dayanışma bağışları", "Community donations"],
};
const COSTS = {
  staff: ["Personel", "Staff"],
  maintenance: ["Bina bakımı", "Building maintenance"],
  infrastructure: ["Yol / altyapı", "Roads / infrastructure"],
  energy: ["Enerji", "Energy"],
  interest: ["Borç faizi", "Debt interest"],
  health: ["Sağlık", "Healthcare"],
  education: ["Eğitim", "Education"],
  commitments: ["Yatırımcı yükümlülükleri", "Investor commitments"],
};
function report(s) {
  const r = s.report;
  if (!r)
    return `<p>${t("İlk ayı kapattığında gelir, gider, göç ve karar sonuçları burada görünecek.", "Close the first month to see income, costs, migration and consequences here.")}</p>`;
  return `${s.ended ? `<article class="final-file"><p class="eyebrow">${t("24 AYLIK KÖY YÖNETİM DOSYASI", "24-MONTH VILLAGE ADMINISTRATION FILE")}</p><h2>${h(tr(ENDINGS[s.ending.id]))}</h2>${s.ending.reasons.map((r) => `<p>${h(tr(r))}</p>`).join("")}<p>${t("Köy ayakta kaldı mı, yoksa sadece adı mı kaldı?", "Did the village stand, or only its name?")}</p></article>` : ""}<h3>${t("Kapanan ay", "Closed month")} ${r.month}</h3><div class="town-grid"><article><h3>${t("Bütçe", "Budget")}</h3><p>${number(r.before.budget)} → ${number(r.after.budget)} TL</p><p>${t("Gelir", "Income")} ${number(r.finance.totalIncome)} TL · ${t("Gider", "Costs")} ${number(r.finance.totalCosts)} TL</p><p>${t("Borç", "Debt")}: ${number(r.before.debt)} → ${number(r.after.debt)} TL</p></article><article><h3>${t("Kim kaldı?", "Who stayed?")}</h3><p>${number(r.before.population)} → ${number(r.after.population)} ${t("kişi", "people")}</p>${r.cohorts.map((c) => `<div class="money-row"><span>${h(tr(COHORTS.find((x) => x.id === c.id).name))}</span><b>${c.delta > 0 ? "+" : ""}${c.delta}</b></div>`).join("")}</article></div><p>${t("Halk güveni", "Public trust")}: ${number(r.before.trust)} → ${number(r.after.trust)} · ${h(tr(IDENTITIES[r.after.identity]))}</p><p>${t("Bütçe farkı ay sonu nakdidir; önceki karar harcamaları karar tarihinde deftere işlenir. Gecikmiş ödemeler ayrıca sonuç akışında görünür.", "The budget change covers month-end cash; decision costs are recorded when made. Delayed payments appear separately in the consequence feed.")}</p>`;
}
export function townPanel(s) {
  const screen = s.ui.screen,
    i = indicators(s),
    m = s.metrics;
  const stage = TOWN_STAGES.find((x) => x.id === s.progression.stage);
  const pressure =
    m.road < 35 || m.supply < 45
      ? t(
          "Ulaşım → stok → fiyat zinciri kritik.",
          "The transport → supply → price chain is critical.",
        )
      : i.school < 40
        ? t(
            "Okul hizmeti aile göçünü tetikleyebilir.",
            "School services may trigger family migration.",
          )
        : s.debt > 120000
          ? t(
              "Borç faizi hizmet bütçesini sıkıştırıyor.",
              "Debt interest is squeezing the service budget.",
            )
          : t(
              "Ani kriz yok; açık gündem ve gecikmiş dosyaları izle.",
              "No immediate crisis; watch open agenda items and delayed files.",
            );
  if (screen === "center")
    return `<section class="town-lead"><p class="eyebrow">${s.month <= 8 ? t("BOŞALAN KÖY", "THE EMPTYING VILLAGE") : s.month <= 16 ? t("SON FIRSATLAR", "LAST CHANCES") : t("KÖYÜN YOLU", "THE VILLAGE PATH")}</p><h2>${t("Bu ay köyde neyi ayakta tutacağız?", "What will we keep standing in the village this month?")}</h2><p>${t("Her iş saha kapasitesi harcar. Yol, iş ve hizmetler insanların kalma kararını birlikte etkiler; her talebi aynı ay çözemeyeceksin.", "Every job spends field capacity. Roads, jobs and services jointly decide who stays; you cannot solve every request in one month.")}</p><div class="town-risk"><strong>${t("Yaklaşan baskı", "Approaching pressure")}</strong><p>${h(pressure)}</p><small>${t("Yönetim katmanı", "Governance layer")}: ${h(tr(stage.label))} · ${stage.institutions.length} ${t("kurum", "institutions")}</small></div></section>${monthPlan(s)}<div class="town-grid metrics">${[
      ["jobs", i.jobs],
      ["services", i.services],
      ["trust", m.trust],
      ["localIdentity", m.localIdentity],
      ["inequality", m.inequality],
      ["reputation", m.reputation],
    ]
      .map(([k, v]) => `<article>${meter(tr(LABELS[k]), v, k === "inequality")}</article>`)
      .join(
        "",
      )}</div><h3>${t("Masadaki talepler", "Requests on your desk")}</h3>${agenda(s, 2)}<h3>${t("Doğrudan belediye işleri", "Direct municipal work")}</h3>${civic(s, ["road", "water", "support", "festival"])}<details><summary>${t("Göstergeleri nasıl okumalı?", "How should I read the indicators?")}</summary><p>${t("İş, güven, hizmet ve kimlik 0–100 endeksleridir; nüfus kişi, para TL'dir. Eşitsizlik, kira ve kirlilikte düşük iyidir. Fiyat endeksi 100 başlangıç seviyesidir. Yüksek fiyat, işsizlik ve hizmet kaybı farklı haneleri farklı hızda göçe iter. Nüfus grupları birbirinden ayrıdır; aynı kişi iki kez sayılmaz.", "Jobs, trust, services and identity are 0–100 indices; population is people and money is TL. Lower inequality, rent pressure and pollution are better. The starting price index is 100. High prices, unemployment and service loss drive different households away at different rates. Population groups are separate; no person is counted twice.")}</p></details>`;
  if (screen === "agenda") return agenda(s);
  if (screen === "budget") {
    const e = economy(s);
    return `<h2>${t("Gelecek ayın hesabı", "Next month's accounts")}</h2><p>${t("Tahmin mevcut hizmetlerden hesaplanır. Açık bina bakım gideri sürer. Altı aylık yatırım vergi indirimi işletme gelirini azaltır. Borç faizi aylık %1,2; nakit açığı borca eklenir.", "Forecasts use current services. Open buildings retain maintenance costs. Six months of investor tax relief reduce business income. Debt interest is 1.2% monthly; a cash shortfall becomes debt.")}</p><div class="town-grid"><article><h3>${t("Gelir", "Income")} · ${number(e.totalIncome)} TL</h3>${lineRows(e.income, INCOME)}</article><article><h3>${t("Gider", "Costs")} · ${number(e.totalCosts)} TL</h3>${lineRows(e.costs, COSTS)}</article></div>${civic(s, ["loan", "repay"])}`;
  }
  if (screen === "services")
    return `<h2>${t("Açık tutmanın bedeli", "The cost of keeping things open")}</h2>${civic(s, ["road", "water", "energy", "cleanup"])}${buildingCards(s, ["hall", "pharmacy", "clinic", "school", "bus"])}`;
  if (screen === "business")
    return `<h2>${t("Köyün çalışan kapıları", "The village's working doors")}</h2>${civic(s, ["support", "festival", "housing"])}${buildingCards(s, ["market", "fuel", "hotel", "workshop", "cafe", "factory", "farms", "heritage"])}`;
  if (screen === "population")
    return `<h2>${t("Herkes aynı sebeple gitmiyor", "People leave for different reasons")}</h2><p>${t("Son ay net göç", "Last month's net migration")}: ${s.report?.migration ?? 0} ${t("kişi", "people")} · ${t("Genç/eğitimli nüfus", "Young/educated population")}: ${youngPopulation(s)}</p><div class="town-grid">${COHORTS.map(
      (c) => {
        const p = s.cohorts.find((x) => x.id === c.id);
        return `<article><h3>${h(tr(c.name))}</h3><strong class="population-number">${p.count}</strong><p>${t("Son ay", "Last month")}: ${p.lastDelta > 0 ? "+" : ""}${p.lastDelta}</p><p>${t("Başlıca etkenler", "Main drivers")}: ${Object.keys(
          c.weights,
        )
          .map((k) => tr(LABELS[k]))
          .join(", ")}</p></article>`;
      },
    ).join(
      "",
    )}</div><p>${t("Öğretmen", "Teacher")}: ${s.npcs.find((n) => n.id === "elif").present ? t("Elif köyde", "Elif is in the village") : t("Elif ayrıldı; okulu onarıp açmak geri dönüş yoludur.", "Elif left; repair and reopen the school to bring her back.")}</p>`;
  if (screen === "people")
    return `<div class="town-grid">${NPCS.map((d) => {
      const n = s.npcs.find((n) => n.id === d.id);
      return `<article><h3>${h(tr(d.name))}</h3><p>${h(tr(d.goal))}</p>${d.voice ? `<p class="npc-voice">${h(tr(d.voice))}</p>` : ""}<p>${t("Bağlantısı", "Connected to")}: ${h(tr(NPCS.find((p) => p.id === d.relation).name))}</p>${d.redLine ? `<p><small>${t("Kırmızı çizgi", "Red line")}: ${h(tr(d.redLine))}</small></p>` : ""}${d.family ? `<p><small>${h(tr(d.family))}</small></p>` : ""}${meter(t("Sana güveni", "Trust in you"), n.trust)}${meter(t("Köye bağlılık", "Village loyalty"), n.loyalty)}<p>${n.present ? t("Köyde", "In the village") : t("Ayrıldı", "Left the village")}</p><p>${n.memory.length ? h(tr(n.memory.at(-1).text)) : t("Henüz ortak karar anısı yok.", "No shared decision memory yet.")}</p>${button(s, `talk:${d.id}`)}</article>`;
    }).join("")}</div>`;
  if (screen === "groups")
    return `<p>${t("Her grubun önceliği farklı. Etki ağırlığı genel halk güvenine yansır. İki grubun güveni en az 35 ise üç aylık ortak bakım koalisyonu kurabilirsin. Koalisyon bina yıpranmasını ayda 1 azaltır.", "Each group has different priorities. Influence weights contribute to public trust. Two groups with trust of at least 35 can form a three-month maintenance coalition. A coalition reduces monthly building wear by 1.")}</p><div class="town-grid">${GROUPS.map(
      (d) => {
        const g = s.groups.find((g) => g.id === d.id);
        return `<article><h3>${h(tr(d.name))}</h3><p>${h(tr(d.goal))}</p>${d.onMigration ? `<p><small>${t("Göç", "Migration")}: ${h(tr(d.onMigration))}</small></p>` : ""}${d.onStage ? `<p><small>${t("Yönetim", "Governance")}: ${h(tr(d.onStage))}</small></p>` : ""}${meter(t("Güven", "Trust"), g.trust)}<p>${t("Etki ağırlığı", "Influence")}: ${g.influence}</p></article>`;
      },
    ).join(
      "",
    )}</div><h3>${t("Ortak iş teklifleri", "Joint projects")}</h3><div class="town-actions">${[
      ["workers", "green"],
      ["young", "elders"],
      ["trades", "newcomers"],
      ["farmers", "staff"],
    ]
      .map(([a, b]) =>
        button(
          s,
          `coalition:${a}:${b}`,
          `${tr(GROUPS.find((g) => g.id === a).name)} + ${tr(GROUPS.find((g) => g.id === b).name)}`,
        ),
      )
      .join("")}</div>${s.coalitions
      .filter((c) => c.until >= s.month)
      .map(
        (c) =>
          `<p>${t("Ortak bakım sürüyor; son ay", "Shared maintenance active; last month")} ${c.until}</p>`,
      )
      .join("")}`;
  if (screen === "investors")
    return `<h2>${t("Gelen paranın bir sahibi var", "The money has an owner")}</h2><p>${t("Her yeni imzada hibe ve iş getirisi azalır; hizmet/arazi yükü, güven bedeli ve şirket kontrolü büyür. Bazı yatırımlar birbiriyle çatışır. Pazarlık aynı ay kabul edilemez.", "Each additional signature yields fewer grants and jobs while service/land obligations, trust costs and company control grow. Some investments conflict. You cannot accept in the same month as negotiation.")}</p>${INVESTORS.map(
      (d) => {
        const o = s.investors.find((o) => o.id === d.id),
          terms = investorTerms(s, d.id),
          required = TOWN_STAGES.find((stage) => stage.id === terms.requiredStage);
        return `<article class="investor-file"><p class="eyebrow">${t("TEKLİF DOSYASI", "OFFER FILE")} · ${t("En erken ay", "Earliest month")} ${d.month}</p><h3>${h(tr(d.name))}</h3>${d.voice ? `<p class="npc-voice">${h(tr(d.voice))}</p>` : ""}${d.pitch ? `<p>${h(tr(d.pitch))}</p>` : ""}${d.costNote ? `<p><small>${h(tr(d.costNote))}</small></p>` : ""}<p>${t("Bu imzanın net şartı", "Terms for this signature")}: ${t("hibe", "grant")} ${number(terms.grant)} TL · ${t("iş", "jobs")} +${terms.jobs} · ${t("kontrol", "control")} +${terms.control}%</p><p>${t("Aylık hizmet/arazi yükü", "Monthly service/land obligation")}: ${number(terms.monthlyCommitment)} TL · ${t("güven bedeli", "trust cost")} −${terms.trustCost} · ${t("yerel kimlik bedeli", "local identity cost")} −${terms.identityCost}</p><p>${terms.conflict ? t("Mevcut yatırımla çıkar çatışması var.", "Conflicts with an existing investment.") : terms.aligned ? t("Köy kimliğiyle uyumlu.", "Aligned with the village identity.") : t("Köy kimliğiyle tam uyumlu değil.", "Not fully aligned with the village identity.")} · ${t("Gerekli katman", "Required layer")}: ${h(tr(required.label))}</p><p>${o.status === "unseen" ? t("Henüz masada değil; dönem ve en az 25 itibar gerekir.", "Not yet available; requires the period and reputation of at least 25.") : o.status === "accepted" ? t("İmzalandı", "Signed") : o.status === "rejected" ? t("Reddedildi", "Rejected") : o.negotiated ? t("Pazarlıklı teklif", "Negotiated offer") : t("Görüşmeye açık", "Open for discussion")}</p><div class="town-actions">${button(s, `investor:${d.id}:accept`, t("Kabul et", "Accept"))}${button(s, `investor:${d.id}:negotiate`, t("Pazarlık yap", "Negotiate"))}${button(s, `investor:${d.id}:reject`, t("Reddet", "Reject"))}</div></article>`;
      },
    ).join("")}`;
  if (screen === "files")
    return `<h2>${t("Yönetim katmanı ve kurumlar", "Governance layer and institutions")}</h2><p>${h(tr(stage.label))} · ${t("ilerleme puanı", "progress score")} ${s.progression.score}/100</p><div class="town-grid">${stage.institutions.map((id) => `<article><h3>${h(t(INSTITUTIONS[id][0], INSTITUTIONS[id][1]))}</h3><p>${h(t(INSTITUTIONS[id][2], INSTITUTIONS[id][3]))}</p></article>`).join("")}</div><h2>${t("Bugün kapanmayan işler", "Files that do not close today")}</h2><p>${t("Gecikmiş sonuçlar kayıtla birlikte taşınır; ay başında bir kez uygulanır.", "Delayed outcomes persist in your save and apply once at the start of their month.")}</p><h3>${t("Sistem zincirleri", "System chains")}</h3>${
      Object.values(s.chains || {})
        .map(
          (c) =>
            `<p><strong>${h(tr(CHAIN_LABELS[c.id] || [c.id, c.id]))}</strong> · ${h(tr(CHAIN_STAGES[c.stage] || [c.stage, c.stage]))} · ${t("ay", "month")} ${c.month}</p>`,
        )
        .join("") || `<p>${t("Henüz zincir sinyali yok.", "No chain signal yet.")}</p>`
    }${s.pending.map((p) => `<article><h3>${h(tr(EVENTS.find((e) => e.id === p.source)?.title || INVESTORS.find((i) => i.id === p.source)?.name || ["Takip dosyası", "Follow-up file"]))}</h3><p>${t("Beklenen ay", "Expected month")}: ${p.due}</p></article>`).join("") || `<p>${t("Bekleyen dosya yok.", "No pending files.")}</p>`}${s.openCases
      .slice(-8)
      .reverse()
      .map(
        (c) =>
          `<article><span class="stamp">${t("KAPANDI", "CLOSED")}</span><p>${h(tr(c.text))}</p></article>`,
      )
      .join("")}`;
  if (screen === "report") return report(s);
  return `<h2>${t("Köy defteri", "Village ledger")}</h2>${history(s, 100)}`;
}
export function history(s, n = 6) {
  return (
    s.history
      .slice(-n)
      .reverse()
      .map(
        (r) =>
          `<article class="history-row"><small>${t("AY", "MONTH")} ${r.month}</small><p>${h(tr(r.text))}</p></article>`,
      )
      .join("") ||
    `<p>${t("İlk imzanı bekliyor. Kararlar, göç ve gecikmiş sonuçlar ay bilgisiyle bu deftere yazılır.", "Waiting for your first signature. Decisions, migration and delayed consequences are recorded here with their month.")}</p>`
  );
}
export function help() {
  return helpPanel(HELP_SECTIONS, [
    t("Nasıl oynanır?", "How to play?"),
    t("Nasıl oynanır?", "How to play?"),
  ]);
}
