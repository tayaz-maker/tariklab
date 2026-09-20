// Read-only player view. Never reads actual values, including the actual-backed
// inflation stored in yearDigest. Presentation thresholds do not affect simulation.
import { POLICIES, EVENTS, PERIODS } from "../next-wave/devlet-data.js";
import { HELP_SECTIONS } from "./help.js";
import { implementationRate, previewPolicy } from "../next-wave/devlet-sim.js";
import { escapeHtml as h, helpPanel, loc, text as t } from "../next-wave/shared/runtime.js";
import {
  eventById,
  POLICY_PROSE,
  STATE_FORM_FLAVOR,
  CADRE_PROFILES,
} from "../next-wave/devlet-content.js";

const names = {
  us: ["ABD", "United States"],
  nato: ["NATO", "NATO"],
  eu: ["Avrupa Birliği", "European Union"],
  ru: ["Rusya", "Russia"],
  ir: ["İran", "Iran"],
  gulf: ["Körfez ülkeleri", "Gulf states"],
  gr: ["Yunanistan", "Greece"],
  cy: ["Kıbrıs dosyası", "Cyprus dossier"],
  quake: ["Deprem hazırlığı", "Earthquake readiness"],
  education: ["Eğitim", "Education"],
  pension: ["Emeklilik", "Pensions"],
  housing: ["Konut", "Housing"],
  energy: ["Enerji", "Energy"],
  water: ["Su", "Water"],
  migration: ["Göç", "Migration"],
  infra: ["Altyapı", "Infrastructure"],
  legal: ["Hukuk", "Justice"],
  region: ["Bölgesel hizmetler", "Regional services"],
};
export const displayName = (key) =>
  names[key] ? t(...names[key]) : t("Diğer dosya", "Other dossier");
const number = (v) => (Number.isFinite(v) ? Math.round(v * 10) / 10 : 0);
export function band(value, kind = "strength") {
  const rows = {
    strength: [
      ["Çok zayıf", "Very weak"],
      ["Zayıf", "Weak"],
      ["Orta", "Moderate"],
      ["Güçlü", "Strong"],
      ["Çok güçlü", "Very strong"],
    ],
    confidence: [
      ["Çok düşük", "Very low"],
      ["Düşük", "Low"],
      ["Orta", "Moderate"],
      ["Yüksek", "High"],
      ["Çok yüksek", "Very high"],
    ],
    tension: [
      ["Sakin", "Calm"],
      ["Düşük", "Low"],
      ["Belirgin", "Elevated"],
      ["Yüksek", "High"],
      ["Kritik", "Critical"],
    ],
    foreign: [
      ["Çok gergin", "Very strained"],
      ["Gergin", "Strained"],
      ["Dengeli", "Balanced"],
      ["Yakın", "Close"],
      ["Çok yakın", "Very close"],
    ],
    treasury: [
      ["Çok dar", "Very tight"],
      ["Dar", "Tight"],
      ["Dengeli", "Balanced"],
      ["Rahat", "Comfortable"],
      ["Geniş", "Ample"],
    ],
  };
  // Treasury is a 0–220 simulation index, not TL or a percentage.
  const cut = kind === "treasury" ? [20, 45, 90, 150] : [20, 40, 60, 80];
  return t(...rows[kind][cut.filter((n) => value >= n).length]);
}
const meter = (value, kind = "strength") =>
  `<div class="metric-line"><span>${h(band(value, kind))}</span><b>${number(value)} / 100</b></div><meter min="0" max="100" value="${number(value)}" aria-label="${h(band(value, kind))}">${number(value)}</meter>`;
const detail = (title, copy) =>
  `<details class="metric-help"><summary>${title}</summary><p>${copy}</p></details>`;
const confidence = (s, key) => Math.round((s.known?.[key]?.confidence || 0) * 100);
const policies = (s) => POLICIES[s.eraId] || POLICIES["2002"];
const policyOf = (id) =>
  Object.values(POLICIES)
    .flat()
    .find((p) => p.id === id);
const eventOf = (id) =>
  Object.values(EVENTS)
    .flat()
    .find((e) => e.id === id);
const policyName = (id) => loc(policyOf(id)?.name || t("Kayda alınan karar", "Recorded decision"));
const fileName = (f) =>
  loc(
    f.title ||
      eventOf(f.id)?.title ||
      t("İzlemeye alınan kamu dosyası", "Public dossier under review"),
  );
const status = (key) =>
  t(
    ...({
      open: ["Açık — izleniyor", "Open — under review"],
      sleeping: ["Beklemede — yeniden gündeme gelebilir", "Dormant — may return"],
      reopened: ["Yeniden açıldı", "Reopened"],
      closed: ["Kapandı", "Closed"],
    }[key] || ["İzleniyor", "Under review"]),
  );
export function visibleSnapshot(s) {
  return {
    time: { ...s.time },
    reported: { ...s.reported },
    confidence: Object.fromEntries(
      ["inflation", "treasury", "unemployment"].map((k) => [k, confidence(s, k)]),
    ),
    files: (s.files || []).map((f) => ({ ...f })),
    pending: (s.flags.pendingPolicies || []).map((p) => ({ id: p.id, rate: p.rate })),
    events: (s.events || []).map((e) => e.id),
    macro: { ...(s.devletDepth?.macro || {}) },
    depthConfidence: { ...(s.devletDepth?.confidence || {}) },
    traces: (s.devletDepth?.traces || []).map((row) => ({ ...row })),
  };
}
export function reportCards(s) {
  return `<div class="dashboard-grid">${["treasury", "inflation", "unemployment"]
    .map((key) => {
      const title =
        key === "treasury"
          ? t("Hazine alanı", "Treasury room")
          : key === "inflation"
            ? t("Enflasyon raporu", "Inflation report")
            : t("İşsizlik raporu", "Unemployment report");
      const copy =
        key === "treasury"
          ? t(
              "Harcanabilir kamu alanını temsil eden oyun endeksi; TL veya yüzde değildir. Karar maliyetleri bu alanı daraltır. Motor ölçeği 0–220; masandaki sayı raporlanan tahmindir.",
              "A simulation index of fiscal room, not currency or a percentage. Decision costs reduce this room. The engine scale is 0–220; the figure on your desk is a reported estimate.",
            )
          : t(
              "Raporlanan oran; düşük olması genellikle daha az ekonomik baskı demektir. Sahadaki kesin değer değildir.",
              "A reported rate; lower generally means less economic pressure. It is not the exact field value.",
            );
      return `<article class="report-card"><h3>${title}</h3><strong>${key === "treasury" ? h(band(s.reported[key], "treasury")) : `%${number(s.reported[key])}`}</strong>${key === "treasury" ? `<p>${t("Raporlanan endeks", "Reported index")}: ${number(s.reported[key])}</p>` : ""}<p class="confidence">${t("Rapor güvenilirliği", "Report reliability")}: ${band(confidence(s, key), "confidence")} · %${confidence(s, key)}</p>${detail(t("Bu sayı ne demek?", "What does this mean?"), copy + " " + t("Güven yüzdesi doğrulanmış doğruluk oranı değil, bilgi belirsizliğinin oyun göstergesidir. Düşükse kararı daha temkinli değerlendir.", "Confidence is a simulation indicator of uncertainty, not a measured accuracy rate. Lower confidence calls for caution."))}</article>`;
    })
    .join(
      "",
    )}<article class="report-card"><h3>${t("Kurumların uygulama gücü", "Institutional delivery strength")}</h3><strong>${band(implementationRate(s))}</strong>${meter(implementationRate(s))}${detail(t("Kararlar sahaya nasıl iner?", "How do decisions reach the field?"), t("Ortalama kapasite, kurumsal aşınma, toplumsal gerilim, kurum yaklaşımı ve bilgi kalitesi birlikte etkiler. Bu genel göstergedir; her kararın kendi uygulama oranı vardır.", "Average capacity, institutional wear, social tension, institutional approach and information quality contribute. This is an overall indicator; each decision has its own delivery rate."))}</article></div>`;
}
export function decisionCards(s, pool = policies(s)) {
  return `<div class="decision-grid">${pool
    .map((p) => {
      const selected = (s.flags.decisionIds || []).includes(p.id),
        capacity = s.flags.governanceCapacity || 8,
        used = s.flags.governanceUsed || 0,
        capacityCost = Math.max(1, Math.ceil((p.capacityNeed || 30) / 30) + ((s.heat || 0) >= 70 ? 1 : 0)),
        remaining = capacity - used;
      const preview = previewPolicy(s, p), inst = s.institutions.find((i) => i.id === preview.institution) || s.institutions.find((i) => i.id === p.inst), rate = preview.rate;
      const prose = POLICY_PROSE[p.id];
      const groups = preview.affectedGroups.map(([id, delta]) => `${id} ${delta > 0 ? "+" : ""}${delta}`).join(" · ");
      const inflationDirection = { up: t("yukarı baskı", "upward pressure"), down: t("aşağı baskı", "downward pressure"), neutral: t("yaklaşık nötr", "roughly neutral") }[preview.expected.inflationDirection];
      const proseLine = prose
        ? `${t("Kurum gerekçesi", "Institutional rationale")}: ${h(prose.rationale)} · ${t("Kısa", "Short")}: ${h(prose.short)} · ${t("Orta", "Medium")}: ${h(prose.medium)} · ${t("Uzun", "Long")}: ${h(prose.long)} · ${t("Risk", "Risk")}: ${h(prose.risk)}`
        : "";
      return `<button type="button" class="decision ${selected ? "is-picked" : ""}" data-policy="${h(p.id)}" ${selected || remaining < capacityCost || s.flags.campaignEnd ? "disabled" : ""}><strong>${h(loc(p.name))}</strong><span>${h(loc(p.intent))}</span><small>${t("Sorumlu kurum", "Responsible institution")}: ${h(loc(inst?.name || t("Merkez idare", "Central administration")))} · ${t("Beklenen uygulama", "Expected delivery")}: ${band(rate)} (%${Math.round(rate)}) · ${t("Hazine maliyeti", "Treasury cost")}: ${p.cost} ${t("endeks puanı", "index points")}</small><small>${t("Yönetim yükü", "Administrative load")}: ${capacityCost}/${capacity} · ${t("Kısa vade enflasyon", "Short-term inflation")}: ${inflationDirection} · ${t("Orta büyüme", "Medium growth")}: ${preview.expected.growthDirection === "up" ? t("yukarı", "up") : preview.expected.growthDirection === "down" ? t("aşağı", "down") : t("nötr", "neutral")}</small><small>${t("Etkilenen gruplar", "Affected groups")}: ${h(groups)}${preview.context.length ? ` · ${h(preview.context.join("; "))}` : ""}</small>${proseLine ? `<small>${proseLine}</small>` : ""}<b>${selected ? t("Seçildi — etkiler zaman içinde çözülecek", "Selected — effects resolve over time") : remaining < capacityCost ? t("Kurumların kalan kapasitesi yetmiyor", "Not enough institutional capacity remains") : t("Ayın uygulama programına ekle", "Add to the month's delivery programme")}</b></button>`;
    })
    .join("")}</div>`;
}
export function contentCard(s) {
  const active = s.flags?.contentActive;
  const def = active?.eventId ? eventById(active.eventId) : null;
  if (!def) return "";
  const title = t(def.title, def.en?.title || def.title);
  const text = t(def.text, def.en?.text || def.text);
  const buttons = (def.choices || []).map((row) => {
    const label = t(row.label, def.en?.choices?.[row.id] || row.en || row.label);
    return `<button type="button" class="decision content-choice" data-content="${h(def.id)}:${h(row.id)}"><strong>${h(label)}</strong><small>${h(row.risk || "")}</small></button>`;
  }).join("");
  return `<section class="card content-dossier" role="region"><p class="eyebrow">${t("DEVLET DOSYASI", "STATE DOSSIER")}</p><h2>${h(title)}</h2><p>${h(text)}</p><div class="decision-grid">${buttons}</div><small>${t("Bu dosya aylık iki politika kararını tüketmez. Seçmezsen ay ilerleyince ilk yol izlenir.", "This file does not use the two monthly policy slots. If you skip it, the first path is taken when the month advances.")}</small></section>`;
}
export function feedbackHtml(s, feedback) {
  if (!feedback) return "";
  if (feedback.kind === "content")
    return `<section class="card action-feedback" role="status"><h2>${t("Dosya işlendi", "File processed")}</h2><p>${t("Bu seçim yönetim kapasitesi harcamadı; etkisi hafıza, gerilim ve bilgi katmanında birikir.", "This choice used no governing capacity; its effects accumulate in memory, tension and information.")}</p></section>`;
  if (feedback.kind === "policy" && (s.flags.decisionIds || []).includes(feedback.id))
    return `<section class="card action-feedback" role="status"><h2>${t("Karar alındı", "Decision recorded")}</h2><p>${h(policyName(feedback.id))}</p><p>${t("Ay sonunda uygulanacak. Kalan yönetim kapasitesi", "Delivery is due at month end. Administrative capacity left")}: ${(s.flags.governanceCapacity || 8) - (s.flags.governanceUsed || 0)}</p></section>`;
  if (feedback.kind !== "month" || s.time.turn <= feedback.before.time.turn) return "";
  const b = feedback.before,
    changed = s.files.filter(
      (f) => !b.files.some((old) => old.id === f.id && old.status === f.status),
    );
  return `<section class="card action-feedback" role="status"><h2>${t("Ay sonu raporu", "Month-end report")} · ${s.time.year}/${s.time.month}</h2><p>${b.pending.length ? b.pending.map((p) => `${h(policyName(p.id))} · ${t("uygulama oranı", "delivery rate")} %${Math.round(p.rate)}`).join("<br>") : t("Bu ay yeni politika seçilmedi; mevcut kurumlar ve gündem işledi.", "No new policy was selected; existing institutions and events continued.")}</p><div class="data-grid">${["treasury", "inflation", "unemployment"].map((k) => `<p>${t(...{ treasury: ["Hazine endeksi", "Treasury index"], inflation: ["Enflasyon raporu", "Inflation report"], unemployment: ["İşsizlik raporu", "Unemployment report"] }[k])}: ${number(b.reported[k])} → <b>${number(s.reported[k])}</b><br><small>${t("Rapor güveni", "Report confidence")}: %${b.confidence[k]} → %${confidence(s, k)}</small></p>`).join("")}</div><p>${t("Yeni gündem", "New agenda")}: ${
    s.events
      .filter((e) => !b.events.includes(e.id))
      .map((e) => h(loc(e.title)))
      .join(" · ") || t("Yeni olay kaydı yok", "No new event recorded")
  }</p><p>${t("Dosya değişiklikleri", "Dossier changes")}: ${changed.map((f) => `${h(fileName(f))} — ${status(f.status)}`).join(" · ") || t("Yok", "None")}</p><small>${t("Değişimler raporlara aittir; karar, kurum ve olay etkileri birlikte işler.", "Changes belong to reports; decisions, institutions and events act together.")}</small></section>`;
}
export function helpHtml() {
  return helpPanel(HELP_SECTIONS, [
    t("30 saniyede oyun", "The game in 30 seconds"),
    t("30 saniyede oyun", "The game in 30 seconds"),
  ]);
}
export function screenHtml(
  s,
  { screen = s.ui?.screen || "home", formOf = loc, feedback = null } = {},
) {
  const wrap = (title, body) => `<section class="card"><h2>${title}</h2>${body}</section>`;
  if (screen === "home" || screen === "agenda") {
    const issues = [];
    if (s.reported.inflation > 30)
      issues.push(
        t(
          "Fiyatlar baskı yaratıyor; fiyat istikrarı kararlarını değerlendir.",
          "Prices are under pressure; consider price-stability decisions.",
        ),
      );
    if (s.reported.treasury < 45)
      issues.push(
        t(
          "Hazine alanı dar; maliyetli kararları dikkatle seç.",
          "Fiscal room is tight; choose costly decisions carefully.",
        ),
      );
    if (implementationRate(s) < 55)
      issues.push(
        t(
          "Uygulama gücü sınırlı; kararların tamamı sahaya inmeyebilir.",
          "Delivery strength is limited; decisions may only partly reach the field.",
        ),
      );
    if (s.heat > 55)
      issues.push(t("Toplumsal gerilim yükselmiş durumda.", "Social tension is elevated."));
    const ranked = policies(s)
      .slice()
      .sort((a, b) =>
        s.reported.treasury < 45
          ? a.cost - b.cost
          : s.reported.inflation > 30
            ? a.inflation - b.inflation
            : a.capacityNeed - b.capacityNeed,
      );
    return `<details class="loop-guide" open><summary>${t("Bu ay nasıl oynanır?", "How to play this month")}</summary><p>${t("Gündemi oku → yönetim kapasiteni politika yükleri arasında bölüştür; beklemek de bir tercihtir → ayı ilerlet → uygulama, sürtünme ve raporları incele.", "Read the agenda → allocate administrative capacity across policy workloads; waiting is also a choice → advance the month → review delivery, friction and reports.")}</p></details>${contentCard(s)}${feedbackHtml(s, feedback)}${reportCards(s)}${wrap(
      t("Bu ay ne oluyor?", "What is happening this month?"),
      `<ul>${(issues.length ? issues : [t("Acil baskı yok; uzun vadeli kurum ve hizmet ihtiyaçlarını değerlendir.", "No urgent pressure; consider long-term institutional and service needs.")]).map((x) => `<li>${x}</li>`).join("")}</ul>${s.events
        .slice(-2)
        .map((e) => `<p>${h(loc(e.title))}</p>`)
        .join("")}`,
    )}${wrap(t("Bu ayın kararları", "This month's decisions"), `<p>${t("Raporlarına göre sıralanan seçenekler. Diğer seçenekler Politika ekranında.", "Options ordered by your reports. Other choices are on the Policy screen.")}</p>${decisionCards(s, ranked.slice(0, 4))}<button type="button" data-open-policy>${t("Tüm politikaları incele", "Browse all policies")}</button>`)}${wrap(
      t("Açık dosyalar", "Open dossiers"),
      s.files
        .filter((f) => f.status !== "closed")
        .slice(-3)
        .map((f) => `<p>${h(fileName(f))} · ${status(f.status)}</p>`)
        .join("") || t("Henüz açık dosya yok.", "No open dossiers yet."),
    )}`;
  }
  if (screen === "policy")
    return wrap(
      t("Politika masası", "Policy desk"),
      feedbackHtml(s, feedback) +
        `<p>${t("İki farklı karar seçebilirsin. Tahmini uygulama oranı, sorumlu kurumun kapasitesi ve kurumsal aşınmadan hesaplanır.", "Choose two different decisions. Expected delivery uses the responsible institution's capacity and institutional wear.")}</p>` +
        decisionCards(s),
    );
  if (screen === "economy")
    return wrap(
      t("Raporlanan ekonomi", "Reported economy"),
      reportCards(s) + `<div class="data-grid"><article class="report-card"><h3>${t("Reel büyüme", "Real growth")}</h3><strong>%${number(s.devletDepth?.macro?.realGrowth)}</strong><p>${t("Bütçe dengesi", "Budget balance")}: ${number(s.devletDepth?.macro?.budgetBalance)}</p></article><article class="report-card"><h3>${t("Borç / finansman", "Debt / financing")}</h3><strong>${number(s.devletDepth?.macro?.publicDebt)}/140</strong><p>${t("Faiz", "Interest")}: %${number(s.devletDepth?.macro?.interestRate)} · ${t("Rezerv", "Reserves")}: ${number(s.devletDepth?.macro?.reserves)}</p></article><article class="report-card"><h3>${t("Satın alma gücü", "Purchasing power")}</h3><strong>${number(s.devletDepth?.macro?.purchasingPower)}/100</strong><p>${t("Hane güveni", "Household confidence")}: ${number(s.devletDepth?.confidence?.household)}</p></article><article class="report-card"><h3>${t("Yatırım", "Investment")}</h3><strong>${number(s.devletDepth?.macro?.investment)}/100</strong><p>${t("İş dünyası güveni", "Business confidence")}: ${number(s.devletDepth?.confidence?.business)}</p></article></div><h3>${t("Neden değişti?", "Why did it change?")}</h3>${(s.devletDepth?.traces || []).slice(-4).reverse().map(row => `<p><b>${h(row.source)}</b>: ${h((row.factors || []).join(" · "))}</p>`).join("") || `<p>${t("Henüz nedensellik izi yok.", "No causal trace yet.")}</p>`}` +
        `<h3>${t("Ertelenmiş politika yükü", "Deferred policy burden")}</h3><p>${t("0–100 endeks; yüksek değer birikmiş ihtiyacın büyüklüğünü gösterir.", "0–100 index; higher means greater accumulated needs.")}</p><div class="data-grid">${Object.entries(
          s.policyDebt,
        )
          .map(
            ([k, v]) =>
              `<article class="report-card"><h3>${displayName(k)}</h3>${meter(v, "tension")}</article>`,
          )
          .join(
            "",
          )}<article class="report-card"><h3>${t("Bilgi kalitesi", "Information quality")}</h3>${meter(s.infoQuality)}<p>${t("Yüksek kalite rapor üretimini ve uygulama gücünü destekler.", "Higher quality supports reporting and delivery.")}</p></article><article class="report-card"><h3>${t("Söylenti baskısı", "Rumor pressure")}</h3>${meter(s.rumor, "tension")}<p>${t("Yüksek baskı bilgi kalitesini ve rapor güvenini aşındırır.", "Higher pressure erodes information quality and confidence.")}</p></article></div>`,
    );
  if (screen === "foreign")
    return wrap(
      t("Dış ilişkiler", "Foreign relations"),
      `<p>${t("Senaryo ilişki endeksi, 0–100: düşük daha gergin, yüksek daha yakın; 50 başlangıç orta noktasıdır. Bu ekrandaki sıralama karar almaz veya yeni etki üretmez.", "Scenario relationship index, 0–100: lower is strained, higher is closer; 50 is the starting midpoint. Sorting this view creates no decisions or effects.")}</p><div class="data-grid">${Object.entries(
        s.foreign,
      )
        .sort((a, b) => a[1] - b[1])
        .map(
          ([k, v]) =>
            `<article class="report-card"><h3>${displayName(k)}</h3>${meter(v, "foreign")}</article>`,
        )
        .join("")}</div>`,
    );
  if (screen === "regions") {
    const lowest = s.regions.slice().sort((a, b) => a.impl - b.impl)[0],
      hottest = s.regions.slice().sort((a, b) => b.heat - a.heat)[0];
    return wrap(
      t("Bölgesel durum", "Regional situation"),
      `<p>${t("Dikkat", "Attention")}: ${h(loc(lowest.name))} — ${t("en düşük uygulama hazırlığı", "lowest delivery readiness")}; ${h(loc(hottest.name))} — ${t("en yüksek toplumsal gerilim", "highest social tension")}.</p><div class="data-grid">${s.regions
        .slice()
        .sort((a, b) => a.impl - b.impl)
        .map(
          (r) =>
            `<article class="report-card"><h3>${h(loc(r.name))}</h3><p>${t("Aktivite", "Activity")}: ${number(r.activity)} · ${t("İşsizlik", "Unemployment")}: %${number(r.unemployment)}</p><p>${t("Hizmet", "Services")}: ${number(r.services)} · ${t("Altyapı", "Infrastructure")}: ${number(r.infrastructure)}</p><p>${t("Memnuniyet", "Satisfaction")}: ${number(r.satisfaction)} · ${t("Göç çekimi", "Migration pull")}: ${number(r.migration)}</p>${meter(r.heat, "tension")}</article>`,
        )
        .join("")}</div>`,
    );
  }
  if (screen === "institutions")
    return wrap(
      t("Kurumlar", "Institutions"),
      `<p>${t("Kapasite: kararları uygulama becerisi. Özerklik: kurumun senaryodaki bağımsızlık endeksi. İkisi de 0–100; mevcut kararlarda uygulama oranına doğrudan kapasite girer.", "Capacity: ability to deliver decisions. Autonomy: the institution's scenario independence index. Both use 0–100; capacity directly enters decision delivery rates.")}</p><div class="data-grid">${s.institutions
        .map((i) => {
          const last = s.implementationLog
            .filter((row) => policyOf(row.policy)?.inst === i.id)
            .at(-1);
          const cadre = (s.devletDepth?.cadres || []).find((row) => row.institution === i.id);
          const profile = CADRE_PROFILES.find((row) => row.id === cadre?.profileId);
          const cadreLine = cadre
            ? `<p>${t("Kadro", "Cadre")}: ${h(cadre.name || profile?.name || "")}${cadre.style ? ` · ${h(cadre.style)}` : ""}</p><p>${cadre.motivation ? h(cadre.motivation) : ""}${cadre.publicLine ? ` · ${h(cadre.publicLine)}` : ""}</p>`
            : "";
          return `<article class="report-card"><h3>${h(loc(i.name))}</h3><p>${t("Kapasite", "Capacity")}</p>${meter(i.capacity)}<p>${t("Profesyonellik", "Professionalism")}: ${number(i.professionalism)} · ${t("Güven", "Trust")}: ${number(i.trust)}</p><p>${t("Özerklik", "Autonomy")}: ${number(i.autonomy)} · ${t("Bütçe", "Budget")}: ${number(i.budget)} · ${t("Yorgunluk", "Fatigue")}: ${number(i.fatigue)}</p>${cadreLine}<small>${t("Son ilgili karar", "Last relevant decision")}: ${last ? `${h(policyName(last.policy))} · %${Math.round(last.rate)}` : t("Henüz yok", "None yet")}</small></article>`;
        })
        .join(
          "",
        )}</div><p>${t("Kurumsal aşınma", "Institutional wear")}: ${number(s.entropy)}/100 · ${t("Yüksek değer uygulamayı zorlaştırır.", "Higher values weaken delivery.")}</p>`,
    );
  if (screen === "society")
    return wrap(
      t("Toplum", "Society"),
      `<p>${t("Memnuniyet; reel gelir, iş, hizmet, güven ve grup çıkarından türetilir.", "Satisfaction derives from real income, jobs, services, trust and group interests.")}</p><p>${t("Toplumsal gerilim", "Social tension")}: ${band(s.heat, "tension")} · ${number(s.heat)}/100</p><div class="data-grid">${(s.devletDepth?.groups || [])
        .slice()
        .sort((a, b) => a.satisfaction - b.satisfaction)
        .map(
          (c) =>
            `<article class="report-card"><h3>${h(loc(c.name))}</h3><p>${t("Memnuniyet", "Satisfaction")}</p>${meter(c.satisfaction)}<p>${t("Beklenti", "Expectation")}: ${number(c.expectation)} · ${t("Baskı", "Pressure")}: ${number(c.pressure)} · ${t("Mobilizasyon", "Mobilization")}: ${number(c.mobilization)}</p></article>`,
        )
        .join("")}</div>`,
    );
  if (screen === "files")
    return wrap(
      t("Kamu dosyaları", "Public dossiers"),
      s.files
        .map(
          (f) =>
            `<article class="file"><h3>${h(fileName(f))}</h3><p>${status(f.status)} · ${f.year || s.time.year}</p><p>${t("Gecikmiş veya tartışmalı bir mesele; yeni gelişmeler aylık raporda görünür.", "A delayed or contested issue; new developments appear in monthly reports.")}</p></article>`,
        )
        .join("") ||
        t(
          "Henüz dosya yok. Gecikmiş meseleler burada birikir.",
          "No dossiers yet. Delayed issues accumulate here.",
        ),
    );
  if (screen === "history")
    return wrap(
      t("Karar geçmişi", "Decision history"),
      s.history
        .slice(-20)
        .reverse()
        .map(
          (row) =>
            `<p>${row.year || ""} · ${row.type === "policy" ? `${t("Karar", "Decision")}: ${h(policyName(row.policy))}` : row.type === "file-return" ? `${t("Dosya yeniden açıldı", "Dossier reopened")}: ${h(fileName(row))}` : row.type === "period-transition" ? `${t("Yeni dönem", "New period")}: ${h(loc(PERIODS[row.era]?.name || ""))}` : t("Devletin kuruluş tercihleri kayda alındı.", "The state's founding choices were recorded.")}</p>`,
        )
        .join("") ||
        t("İlk kararın burada kayda geçecek.", "Your first decision will be recorded here."),
    );
  if (screen === "year")
    return wrap(
      t("Yıl dosyası", "Year file"),
      s.yearDigest
        .slice()
        .reverse()
        .map(
          (r) =>
            `<article class="report-card"><h3>${r.year}</h3><p>${t("Toplumsal gerilim", "Social tension")}: ${number(r.heat)}/100 · ${band(r.heat, "tension")}</p><p>${t("Kurumsal aşınma", "Institutional wear")}: ${number(r.entropy)}/100</p><p>${h(formOf(r.form))}</p></article>`,
        )
        .join("") ||
        t(
          "İlk yıl kapanınca kurum ve toplum özeti burada görünür.",
          "The first year-end will add an institutional and social summary here.",
        ),
    );
  const p = PERIODS[s.eraId];
  const formFlavor = STATE_FORM_FLAVOR[s.form];
  const notes = (s.devletDepth?.outcome?.contentNotes || []).slice(0, 4);
  return wrap(
    t("Dönem dosyası", "Period file"),
    `<h3>${h(loc(p?.name || ""))}</h3><p>${h(loc(p?.theme || ""))}</p><p>${t("Devlet biçimi", "State form")}: ${h(formOf(s.form))}</p>${formFlavor ? `<p>${h(formFlavor.persist)}</p><p>${h(formFlavor.trace)}</p>` : ""}<p>${t("Kampanya", "Campaign")}: ${s.scenario.campaign ? t("Büyük kampanya", "Grand campaign") : t("Dönem", "Period")}</p>${notes.length ? `<h3>${t("Nasıl bir devlet?", "What kind of state?")}</h3>${notes.map((line) => `<p>${h(line)}</p>`).join("")}` : ""}`,
  );
}
