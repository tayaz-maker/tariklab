/** Presentation-only Boardworld 2.0 surfaces. All commands are resolved by engine.mjs. */
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const cash = (value) => `${Math.round(Number(value) || 0).toLocaleString("tr-TR")} ₺`;
const initials = (name) =>
  String(name)
    .split(" ")
    .slice(0, 2)
    .map((x) => x[0])
    .join("");
const stat = (label, value, tone = "") =>
  `<div class="deep-stat ${tone}"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;
const note = (label, text) =>
  `<div class="deep-note"><span class="eyebrow">${esc(label)}</span><p>${esc(text)}</p></div>`;
const iso = (x, y, z = 0) => [160 + (x - y) * 1.08, 92 + (x + y) * 0.5 - z];
const polygon = (points, fill, extra = "") =>
  `<polygon points="${points.map((p) => p.join(",")).join(" ")}" fill="${fill}" ${extra}/>`;
const rectIso = (x, y, w, d, z = 0) => [
  iso(x, y, z),
  iso(x + w, y, z),
  iso(x + w, y + d, z),
  iso(x, y + d, z),
];
function building(x, y, w, d, h, kind = "stone") {
  const tones = {
    stone: ["#f6eee0", "#cdbfa8", "#b3aa98"],
    brick: ["#bd7962", "#9d5e4d", "#e3ae83"],
    glass: ["#a8c6c0", "#5f8e8b", "#d5e5dd"],
    cream: ["#f6e7b9", "#c6af7d", "#fff4ce"],
  }[kind];
  const base = rectIso(x, y, w, d),
    top = rectIso(x, y, w, d, h);
  let result =
    polygon([base[1], base[2], top[2], top[1]], tones[1]) +
    polygon([base[2], base[3], top[3], top[2]], tones[0]) +
    polygon(top, tones[2]);
  const floors = Math.max(1, Math.floor(h / 13));
  for (let f = 0; f < floors; f++)
    for (let p = 6; p < w - 4; p += 9) {
      const a = iso(x + p, y + d, 8 + f * 12),
        b = iso(x + p + 4, y + d, 8 + f * 12);
      result += `<path d="M${a[0]} ${a[1]}L${b[0]} ${b[1]}v-5l-4.32-2z" fill="#345d5b" opacity=".67"/>`;
    }
  return result;
}
function tree(x, y) {
  const p = iso(x, y, 0);
  return `<path d="M${p[0]} ${p[1]}v-16" stroke="#8d765a" stroke-width="3"/><ellipse cx="${p[0]}" cy="${p[1] - 19}" rx="9" ry="12" fill="#719887"/><ellipse cx="${p[0] - 3}" cy="${p[1] - 22}" rx="5" ry="8" fill="#9ab59b"/>`;
}
export function neighborhoodArt(id) {
  const ground =
    polygon(rectIso(-65, -25, 128, 82, -5), "#b9b7a0") +
    polygon(rectIso(-65, -25, 128, 82), "#e7dfc7");
  const road =
    polygon(rectIso(-66, 10, 130, 13, 0.3), "#c9c4b5") +
    polygon(rectIso(-10, -26, 12, 84, 0.4), "#c9c4b5");
  const walk =
    polygon(rectIso(-66, 9, 130, 2, 1), "#f6f2e3") +
    polygon(rectIso(-66, 24, 130, 2, 1), "#f6f2e3");
  let scene = "";
  if (id === "kadikoy")
    scene =
      building(-56, -18, 23, 21, 25, "brick") +
      building(-27, -20, 18, 24, 34, "cream") +
      building(6, -19, 24, 24, 22, "brick") +
      building(37, -17, 17, 21, 28, "stone") +
      building(-54, 31, 25, 20, 20, "cream") +
      building(-22, 32, 19, 19, 24, "brick") +
      tree(22, 40) +
      tree(43, 40) +
      polygon(rectIso(11, 30, 19, 12, 1), "#86a393");
  else if (id === "besiktas")
    scene =
      polygon(rectIso(-66, 37, 130, 21, 0.7), "#a8cec4") +
      building(-54, -19, 27, 24, 24, "cream") +
      building(-21, -21, 18, 25, 32, "brick") +
      building(8, -18, 25, 21, 20, "stone") +
      building(39, -17, 17, 21, 26, "cream") +
      tree(-41, 30) +
      tree(10, 30) +
      tree(29, 29) +
      `<path d="M128 129l27 12 21-10-27-12z" fill="#fff7df"/><path d="M142 132l12 6 10-5-12-6z" fill="#bc6a55"/>`;
  else
    scene =
      building(-55, -20, 23, 25, 55, "glass") +
      building(-27, -22, 20, 27, 69, "glass") +
      building(8, -19, 25, 24, 44, "stone") +
      building(39, -17, 17, 23, 38, "glass") +
      building(-52, 31, 25, 20, 31, "stone") +
      building(-20, 31, 20, 20, 40, "glass") +
      tree(26, 37) +
      tree(45, 43);
  return `<svg class="neighborhood-art" viewBox="0 0 320 180" aria-hidden="true" focusable="false"><ellipse cx="160" cy="139" rx="121" ry="28" fill="#172d32" opacity=".08"/>${ground}${road}${walk}${scene}</svg>`;
}
export function renderNeighborhoodBoard({ state, districts, selectedDistrict, npcs, getLocation }) {
  const profiles = Object.fromEntries(districts.map((d) => [d.id, d]));
  const order = ["sisli", "besiktas", "kadikoy"];
  return `<div class="neighborhood-board" aria-label="İstanbul 2.5 boyutlu şehir tahtası"><div class="board-atlas-heading"><span class="eyebrow">İSTANBUL / ÜÇ FARKLI HAYAT RİTMİ</span><span class="board-edition">02</span></div><div class="atlas-transit" aria-hidden="true"><span>AVRUPA</span><i></i><span>BOĞAZ HATTI</span><i></i><span>ANADOLU</span></div><div class="neighborhood-grid">${order
    .map((id, i) => {
      const d = profiles[id];
      if (!d) return "";
      const here = state.location === id,
        people = npcs.filter((n) => getLocation(state, n.id) === id);
      return `<article class="neighborhood-tile ${here ? "is-current" : ""} ${selectedDistrict === id ? "is-selected" : ""}" data-region="${id}"><button class="neighborhood-select" data-district="${id}" aria-pressed="${selectedDistrict === id}"><span class="neighborhood-number">0${i + 1}</span>${here ? '<span class="you-are-here">TAŞIN BURADA</span>' : ""}${neighborhoodArt(id)}<span class="neighborhood-label"><strong>${esc(d.name)}</strong><span>${esc(d.summary || d.description)}</span></span><span class="neighborhood-explore">${selectedDistrict === id ? "Seçili semt" : "Semti incele"} <b aria-hidden="true">↗</b></span></button><div class="neighborhood-residents"><span>${people.length} kişi burada</span><span class="resident-chips">${here ? `<i class="resident-player" title="${esc(state.player.name)}">${esc(initials(state.player.name))}</i>` : ""}${people
        .slice(0, 4)
        .map((n) => `<i title="${esc(n.name)}">${esc(initials(n.name))}</i>`)
        .join(
          "",
        )}${people.length > 4 ? `<small>+${people.length - 4}</small>` : ""}</span></div></article>`;
    })
    .join(
      "",
    )}</div><div class="atlas-key"><span><i class="resident-player"></i> Sen</span><span><i></i> Gündelik rutinindeki insanlar</span><span>Konum; iş, kira ve ulaşımını etkiler.</span></div></div>`;
}
export function renderDistrictProfile(profile) {
  return profile
    ? `<div class="strategic-profile"><span class="eyebrow">BU SEMTTE YAŞAMAK</span><ul>${(profile.features || []).map((f) => `<li>${esc(f)}</li>`).join("")}</ul></div>`
    : "";
}
export function renderCareer(view) {
  if (!view) return "";
  return `<section class="deep-card career-context" data-deep="career"><div class="deep-heading"><span class="eyebrow">İŞ YERİNİN İÇİNDEN</span><h3>${esc(view.employer || "İş hayatına ilk adım")}</h3></div><div class="deep-stats">${stat("Mesleki itibar", view.reputation ?? 0)}${stat("Anlaşılan ek ücret", cash(view.negotiatedBonus))}${stat("İş güvencesi", view.security ?? "—")}${stat("Esneklik", view.flexibility ?? "—")}</div>${view.manager ? `<p class="context-person"><span>Yöneticin</span><strong>${esc(view.manager)}</strong></p>` : ""}${view.coworkers?.length ? `<p class="tiny">Ekip: ${view.coworkers.map(esc).join(" · ")}</p>` : ""}${view.expectations?.length ? note("SENDEN BEKLENENLER", view.expectations.join(" · ")) : ""}</section>`;
}
export function renderFreelance(view) {
  if (!view) return "";
  return `<section class="deep-card freelance-context" data-deep="freelance"><div class="deep-heading"><span class="eyebrow">SERBEST ÇALIŞMA</span><h3>${esc(view.active?.title || "Bir projeden, bir portfolyoya.")}</h3></div>${view.active ? `<p>${view.active.dueDay}. güne kadar ${view.active.requiredSessions} çalışma oturumu. Teslim bedeli ${cash(view.active.reward)}.</p><progress max="${Math.max(1, view.active.requiredSessions)}" value="${view.active.sessions}" aria-label="Proje ilerlemesi"></progress><p class="tiny">${view.active.sessions} / ${view.active.requiredSessions} oturum tamamlandı.</p>` : "<p>Becerine uygun bir proje seç. Teslim tarihi, müşteri güveni ve iş kalitesi bir sonraki teklifini etkiler.</p>"}<div class="deep-stats">${stat("Teslim edilen proje", view.completed ?? 0)}${stat("Müşteri itibarı", view.reputation ?? 0)}</div></section>`;
}
export function renderFinance(view) {
  if (!view) return "";
  return `<section class="deep-card finance-context" data-deep="finance"><div class="deep-heading"><span class="eyebrow">GELECEK ÖDEMELER</span><h3>Bugünün bakiyesi, yarının yükü.</h3></div><p>${esc(view.summary)}</p><div class="deep-stats">${stat("Ayrılan güvence", cash(view.reserve))}${stat("Otomatik ödemeler", view.autoPay ? "Açık" : "Kapalı")}${stat("Borç planı", typeof view.debtPlan === "object" ? view.debtPlan?.name || "Tanımlı" : view.debtPlan || "Yok")}</div>${
    view.forecast?.length
      ? `<ol class="finance-forecast">${view.forecast
          .slice(0, 8)
          .map(
            (f) =>
              `<li><span class="forecast-day">${f.day}. gün</span><span>${esc(f.label)}</span><strong class="${f.amount > 0 ? "income" : "expense"}">${f.amount > 0 ? "+" : ""}${cash(f.amount)}</strong></li>`,
          )
          .join("")}</ol>`
      : '<p class="tiny">Yaklaşan ödeme bulunmuyor.</p>'
  }</section>`;
}
export function renderNpcDepth(view, state) {
  if (!view) return "";
  return `<section class="npc-depth" data-deep="npc-profile"><div class="deep-stats">${stat("Saygı", view.respect ?? 0)}${stat("Kırgınlık", view.resentment ?? 0, "warm")}${stat("İşi", view.profession || "—")}</div>${note("KENDİ HAYATINDA", view.goal || "")}${note("SENDEN BEKLENTİSİ", view.expectation || "")}${view.schedule ? `<p class="tiny"><b>Günün ritmi:</b> ${esc(view.schedule)}</p>` : ""}${view.employer ? `<p class="tiny"><b>İş yeri:</b> ${esc(view.employer)}</p>` : ""}<details class="knowledge-file"><summary>Senin hakkında bildikleri <span>${view.knownFacts?.length || 0}</span></summary>${
    view.knownFacts?.length
      ? `<ol>${view.knownFacts
          .slice(-8)
          .reverse()
          .map(
            (f) =>
              `<li><b>${f.day}. gün</b> ${esc(f.text)}${f.source ? `<small>Kaynak: ${esc(f.source)}</small>` : ""}</li>`,
          )
          .join("")}</ol>`
      : "<p>Henüz paylaşılmış bir bilgi yok. Bire bir konuşmalar ve çevreniz duyduklarını değiştirebilir.</p>"
  }</details>${
    view.changes?.length
      ? `<details class="knowledge-file"><summary>Onun hayatında olanlar <span>${view.changes.length}</span></summary><ol>${view.changes
          .slice(-6)
          .reverse()
          .map((c) => `<li><b>${c.day}. gün</b> ${esc(c.text)}</li>`)
          .join("")}</ol></details>`
      : ""
  }${state.flags.partner === view.id ? '<p class="relationship-caption">Hayatınız artık ortak kararlar da içeriyor.</p>' : ""}</section>`;
}
export function renderNetwork(npcs, state, selected) {
  const points = npcs.map((n, i) => ({
    n,
    x: 280 + Math.cos((i / npcs.length) * Math.PI * 2 - Math.PI / 2) * 230,
    y: 138 + Math.sin((i / npcs.length) * Math.PI * 2 - Math.PI / 2) * 104,
  }));
  const chosen = npcs.find((n) => n.id === selected),
    chosenPoint = points.find((p) => p.n.id === selected);
  return `<details class="social-network" open><summary>İlişki haritan <span>${npcs.length} kalıcı karakter</span></summary><p>Bir kişiyi seç. Kalın çizgi güçlü güveni, kesikli çizgi onun çevresindeki bağlantıları gösterir.</p><svg viewBox="0 0 560 285" aria-label="Kişiler ve aralarındaki ilişkiler" class="network-map">${points.map((p) => `<path d="M280 138L${p.x} ${p.y}" class="network-edge" stroke-width="${1 + Math.max(0, state.npcs[p.n.id]?.trust || 0) / 32}"/>`).join("")}${
    chosenPoint
      ? (chosen?.ties || [])
          .map((t) => {
            const other = points.find((p) => p.n.id === t.id);
            return other
              ? `<path d="M${chosenPoint.x} ${chosenPoint.y}L${other.x} ${other.y}" class="network-tie"/>`
              : "";
          })
          .join("")
      : ""
  }<circle cx="280" cy="138" r="24" class="network-player"/><text x="280" y="142" text-anchor="middle" class="network-center-text">SEN</text>${points.map((p) => `<g class="network-person ${p.n.id === selected ? "selected" : ""}" role="button" tabindex="0" data-network-npc="${esc(p.n.id)}" aria-label="${esc(p.n.name)} profilini aç"><circle cx="${p.x}" cy="${p.y}" r="20"/><text x="${p.x}" y="${p.y + 4}" text-anchor="middle">${esc(initials(p.n.name))}</text><title>${esc(p.n.name)}</title></g>`).join("")}</svg><div class="network-selected"><strong>${esc(chosen?.name)}</strong><span>${chosen?.ties?.length ? chosen.ties.map((t) => esc(t.name)).join(" · ") : "Yakın çevresi zamanla görünür olur."}</span></div></details>`;
}
export function renderStoryCards(stories, actions, actionCard) {
  if (!stories.length)
    return '<div class="empty-state">İlk bağlar henüz kurulmadı. Çevrendeki insanlarla konuş, çalış ve yaşamına yön ver; hikâyeler seçimlerinle açılacak.</div>';
  return `<div class="story-grid">${stories
    .map(
      (s) =>
        `<article class="story-chain ${s.status}" data-story="${esc(s.id)}"><div class="story-kicker"><span>HİKÂYE ZİNCİRİ</span><b>${s.status === "complete" ? "TAMAMLANDI" : s.status === "waiting" ? "GELİŞME BEKLENİYOR" : "KARAR ZAMANI"}</b></div><div class="story-progress" aria-label="${Math.min(s.stage + 1, s.totalStages)} / ${s.totalStages} aşama">${Array.from({ length: s.totalStages }, (_, i) => `<i class="${i < s.stage ? "done" : i === s.stage ? "current" : ""}"></i>`).join("")}</div><h3>${esc(s.title)}</h3><p class="story-summary">${esc(s.summary)}</p><div class="story-current"><span class="eyebrow">${s.status === "complete" ? "KALICI SONUÇ" : `${Math.min(s.stage + 1, s.totalStages)}. AŞAMA · ${esc(s.stageTitle)}`}</span><p>${esc(s.status === "complete" ? s.outcome : s.body)}</p>${s.status === "waiting" ? `<span class="story-due">${s.dueDay}. gün yeniden haber var</span>` : ""}</div>${
          s.status === "active"
            ? `<div class="action-grid story-actions">${actions
                .filter((a) => a.category === "story" && a.id.startsWith(`story:${s.id}:`))
                .map((a) => actionCard(a, true))
                .join("")}</div>`
            : ""
        }${s.history?.length ? `<details class="story-history"><summary>Bu noktaya nasıl geldin? <span>${s.history.length} karar</span></summary><ol>${s.history.map((h) => `<li><b>${h.day}. gün</b><p>${esc(h.text || h.choice)}</p></li>`).join("")}</ol></details>` : ""}</article>`,
    )
    .join("")}</div>`;
}
export function renderStoryPrompt(stories) {
  const active = stories.filter((s) => s.status === "active");
  return active.length
    ? `<section class="story-prompt"><span class="story-token">◇</span><div><strong>${active.length} hikâyede sıradaki kararın bekleniyor.</strong><span>${active
        .slice(0, 2)
        .map((s) => esc(s.title))
        .join(
          " · ",
        )}</span></div><button class="secondary" data-tab="stories">Hikâyeleri aç ↗</button></section>`
    : "";
}
export function renderPlanning(
  view,
  { state, clock, stories, npcs, districtName },
  actions,
  actionCard,
) {
  const settings = view?.settings || {},
    timeline = [];
  for (const a of state.appointments.filter((a) => a.status === "scheduled"))
    timeline.push({
      day: a.day,
      time: a.minute,
      label: `${npcs.find((n) => n.id === a.npcId)?.name || "Buluşma"} · ${districtName(a.location)}`,
      type: "appointment",
      npcId: a.npcId,
    });
  for (const story of stories.filter((s) => s.status === "waiting"))
    timeline.push({ day: story.dueDay, time: 540, label: story.title, type: "story" });
  for (const promise of view?.promises || [])
    if (["open", "pending", "Bekliyor"].includes(promise.status))
      timeline.push({
        day: promise.dueDay,
        time: 1080,
        label: `${promise.name} · ${promise.kind} · ${promise.description}`,
        type: "promise",
        npcId: promise.npcId,
      });
  timeline.sort((a, b) => a.day - b.day || a.time - b.time);
  const scheduleActions = actions.filter((a) => a.category === "schedule");
  const controls = scheduleActions.filter((a) => a.id.startsWith("schedule:toggle:"));
  const budgets = scheduleActions.filter((a) => a.id.startsWith("schedule:budget:"));
  const run = scheduleActions.filter((a) => a.id.startsWith("schedule:run:"));
  const timelineMarkup = Array.from({ length: 7 }, (_, i) => {
    const day = clock.day + i,
      entries = timeline.filter((t) => t.day === day);
    return `<article class="timeline-day ${i === 0 ? "today" : ""}"><div><b>${day}</b><span>${i === 0 ? "Bugün" : i === 1 ? "Yarın" : `${day}. gün`}</span></div><ul>${entries.length ? entries.map((e) => `<li class="${e.type}"><time>${String(Math.floor(e.time / 60)).padStart(2, "0")}:${String(e.time % 60).padStart(2, "0")}</time><button class="timeline-link" ${e.type === "story" ? 'data-tab="stories"' : `data-npc="${esc(e.npcId)}"`}>${esc(e.label)} <span aria-hidden="true">↗</span></button></li>`).join("") : '<li class="free-time">Planlanmış görüşme yok.</li>'}</ul></article>`;
  }).join("");
  return `<section class="timeline-panel"><div class="subheading"><h3>Önündeki yedi gün</h3><span class="tiny">Randevular ve gelişmeler</span></div><div class="timeline-days">${timelineMarkup}</div></section><section class="deep-card routine-desk" data-deep="schedule"><div class="deep-heading"><span class="eyebrow">KONTROL SENDE KALIR</span><h3>Rutin kur. İstisnalarda dur.</h3></div><p>${esc(view?.summary || "Günlük düzenini belirle. Bir olay, randevu veya kaynak eksiği olduğunda rutin durur.")}</p><div class="routine-controls" aria-label="Rutin tercihleri">${controls
    .map((a) => {
      const key = a.id.split(":").at(-1),
        enabled = settings[key];
      return `<button class="routine-control ${enabled ? "on" : ""}" data-action="${esc(a.id)}" data-focus="action:${esc(a.id)}" aria-pressed="${!!enabled}" ${a.disabled ? "disabled" : ""}><span>${esc({ work: "İşe git", study: "Derse katıl", shopping: "Erzak al" }[key])}</span><strong>${enabled ? "Açık" : "Kapalı"}</strong><i aria-hidden="true"></i></button>`;
    })
    .join(
      "",
    )}</div><p class="tiny">Tercihler sadece planını değiştirir. Zamanı aşağıdaki yürütme düğmeleri ilerletir. Otomatik ödemeler: <button class="inline-link" data-tab="wallet">${settings.autoPay ? "açık" : "kapalı"} ↗</button></p><fieldset class="routine-budget"><legend>Korunacak kullanılabilir bakiye</legend><p>Bir harcama bu sınırı aşacaksa rutin durur.</p><div>${budgets.map((a) => `<button class="secondary ${a.disabled ? "chosen" : ""}" data-action="${esc(a.id)}" data-focus="action:${esc(a.id)}" aria-pressed="${a.disabled}" ${a.disabled ? "disabled" : ""}>${cash(Number(a.id.split(":").at(-1)))}</button>`).join("")}</div></fieldset>${view?.stopReason ? note("SON DURMA NEDENİ", view.stopReason) : ""}${view?.lastRun ? `<p class="tiny">Son rutin: ${esc(view.lastRun)}</p>` : ""}<div class="action-grid routine-run">${run.map((a) => actionCard(a, true)).join("")}</div></section>`;
}
export function renderBusiness(view, actions, actionCard) {
  return `<section class="deep-card enterprise-status" data-deep="business"><div class="deep-heading"><span class="eyebrow">KENDİ İŞİNİN HİKÂYESİ</span><h3>${esc(view?.name || "Bir müşteriden fazlası.")}</h3></div><p>${esc(view?.summary || "Sermayeni, becerini ve zamanını bir işe dönüştür. Müşteri kazanmak kadar giderleri karşılamak da senin sorumluluğunda.")}</p>${view ? `<div class="deep-stats">${stat("Müşteri", view.clients)}${stat("İşletme itibarı", view.reputation)}${stat("Toplam gelir", cash(view.revenue))}${stat("Toplam gider", cash(view.costs))}${stat("Kâr / zarar", cash(view.profit))}${stat("Haftalık sabit gider", cash(view.weeklyOverhead))}</div><p class="tiny">Durum: ${esc(view.status)} · ${esc({ kadikoy: "Kadıköy", besiktas: "Beşiktaş", sisli: "Şişli" }[view.location] || view.location)}</p>` : ""}</section><div class="action-grid enterprise-actions">${actions
    .filter((a) => a.category === "business")
    .map((a) => actionCard(a))
    .join("")}</div>`;
}
export function renderPreview(forecast, action) {
  const metrics = [
    ["cash", "Nakit", cash],
    ["bank", "Banka", cash],
    ["debt", "Borç", cash],
    ["reserve", "Güvence", cash],
    ["energy", "Enerji", String],
    ["hunger", "Tokluk", String],
    ["stress", "Stres", String],
    ["health", "Sağlık", String],
  ];
  const delta = (n, format) => `${n > 0 ? "+" : ""}${format(n)}`;
  return `<span class="eyebrow">HAMLEDEN ÖNCE</span><h2 id="dialog-title">${esc(action.label)}</h2><p class="preview-description">${esc(action.description)}</p><div class="preview-time">${forecast.ok ? `${forecast.minutes} dakika geçer` : "Önce eylemin koşullarını tamamla"}</div><div class="deep-stats">${metrics
    .filter(([key]) => forecast[key])
    .map(([key, label, format]) => stat(label, delta(forecast[key], format)))
    .join("")}${(forecast.skills || [])
    .filter((x) => x.delta)
    .map((x) => stat(x.name, delta(x.delta, String)))
    .join(
      "",
    )}</div>${forecast.risk ? note("BELİRSİZLİK & RİSK", forecast.risk) : ""}${forecast.consequences?.length ? `<ul class="preview-consequences">${forecast.consequences.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>` : ""}${forecast.relations?.length ? `<p class="tiny">İlişkiler: ${forecast.relations.map((r) => `${esc(r.name)} · güven ${r.trust > 0 ? "+" : ""}${r.trust}, yakınlık ${r.affinity > 0 ? "+" : ""}${r.affinity}`).join(" / ")}</p>` : ""}<div class="menu-actions"><button class="primary" data-preview-commit="${esc(action.id)}" ${!forecast.ok || action.disabled ? "disabled" : ""}>Kararı uygula</button><button class="secondary" data-ui="close">Düşünmeye devam et</button></div>${!forecast.ok ? `<p class="action-reason">${esc(forecast.message)}</p>` : ""}`;
}
