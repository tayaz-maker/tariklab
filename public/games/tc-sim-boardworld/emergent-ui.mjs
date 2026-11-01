/** Public-view presentation only. Every gameplay control resolves an engine descriptor. */
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const money = (v) => `${Math.round(Number(v) || 0).toLocaleString("tr-TR")} ₺`;
const at = (v) =>
  `${Math.floor(v / 1440) + 1}. gün · ${String(Math.floor((v % 1440) / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
const names = {
  employment: "İş hayatı",
  housing: "Barınma",
  neighborhood: "Mahalle",
  transport: "Ulaşım",
  education: "Eğitim",
  friendship: "Arkadaşlık",
  romance: "Yakınlık",
  household: "Ortak yaşam",
  health: "Sağlık",
  debt: "Borç",
  enterprise: "İşletme",
  institutions: "Kurumlar",
};
const states = {
  active: "Karar bekliyor",
  pending: "Karar bekliyor",
  waiting: "Sonucu bekleniyor",
  resolved: "Karar verildi",
  complete: "Sonuçlandı",
  completed: "Sonuçlandı",
  expired: "Süresi doldu",
  stale: "Koşullar değişti",
  closed: "Kapandı",
  none: "Henüz yok",
  stable: "Düzen sürüyor",
  notice: "Ayrılık bildirimi",
  dispute: "Anlaşmazlık",
  open: "Açık",
  settled: "Hesap kapandı",
};
const list = (values) =>
  (values || [])
    .map((v) => (typeof v === "string" ? v : v.text || v.name || v.label || ""))
    .filter(Boolean);
const history = (items = []) =>
  items.length
    ? `<ol class="causal-history">${items
        .slice(-8)
        .reverse()
        .map(
          (h) =>
            `<li><time>${h.at !== undefined ? esc(at(h.at)) : `${h.day}. gün`}</time>${h.title ? `<strong>${esc(h.title)}</strong>` : ""}<p>${esc(h.text || h.message || h.outcome)}</p>${h.source ? `<small>${esc(h.source)}</small>` : ""}</li>`,
        )
        .join("")}</ol>`
    : '<p class="tiny">Yeni kararların ve ödemelerin burada iz bırakacak.</p>';
const metric = (label, value) =>
  `<div><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;
const controls = (ids, actions, actionCard) =>
  actions
    .filter((a) => ids?.includes(a.id))
    .map((a) => actionCard(a, true))
    .join("");

export function renderSystemicEvents(view, actions, actionCard, { compact = false } = {}) {
  const live = (view?.events || []).filter(
    (e) => e.actionIds?.length || ["active", "pending", "waiting"].includes(e.status),
  );
  if (!live.length) return "";
  if (compact)
    return `<section class="systemic-prompt"><span class="causal-mark" aria-hidden="true">↳</span><div><strong>${live.length} şehir gelişmesi</strong><span>${esc(live[0].title)} · ${esc(live[0].why)}</span></div><button class="secondary" data-tab="stories">Nedenini ve seçenekleri gör ↗</button></section>`;
  return `<section class="systemic-events" aria-label="Koşullarından doğan şehir olayları">${live
    .map(
      (e) =>
        `<article class="systemic-card" data-systemic="${esc(e.id)}"><div class="systemic-kicker"><span>${esc(names[e.family] || "Şehir hayatı")}</span><b>${esc(states[e.status] || e.status)}</b></div><h3>${esc(e.title)}</h3><div class="causal-why"><span class="eyebrow">NEDEN ŞİMDİ?</span><p>${esc(e.why)}</p></div><div class="systemic-meta">${e.source ? `<span>Kaynak: ${esc(e.source)}</span>` : ""}${e.location ? `<span>${esc({ kadikoy: "Kadıköy", besiktas: "Beşiktaş", sisli: "Şişli" }[e.location] || e.location)}</span>` : ""}${e.deadline ? `<span>Son karar: ${esc(at(e.deadline))}</span>` : ""}${list(e.actors).length ? `<span>${list(e.actors).map(esc).join(" · ")}</span>` : ""}</div>${
          e.consequences?.length
            ? `<div class="causal-consequences"><span class="eyebrow">BU KARARIN İZİ</span><ul>${list(
                e.consequences,
              )
                .map((c) => `<li>${esc(c)}</li>`)
                .join("")}</ul></div>`
            : ""
        }${e.parentId ? '<p class="tiny">Bu gelişme daha önceki bir kararının devamı.</p>' : ""}<div class="action-grid systemic-choices">${controls(e.actionIds, actions, actionCard)}</div></article>`,
    )
    .join("")}</section>`;
}

export function renderCausalHistory(view) {
  return `<section class="causal-ledger" data-emergent="history"><div class="subheading"><div><span class="eyebrow">NEDEN → KARAR → SONUÇ</span><h3>Şehrin sana dönen karşılığı.</h3></div></div>${history(view?.history)}</section>`;
}

export function renderHabits(view, category = "practice") {
  const items = view?.habits?.[category] || [];
  return items.length
    ? `<section class="habit-panel" data-emergent="habits"><span class="eyebrow">TEKRARIN BİR SINIRI VAR</span><h3>${category === "practice" ? "Gelişimin ritmi" : "İlişkilerde karşılıklı alan"}</h3><div class="habit-items">${items.map((h) => `<article><strong>${esc(h.name || h.label)}</strong>${h.today !== undefined ? `<span>Bugün ${h.today} · ${category === "practice" ? `Bu hafta ${h.week}` : `${h.streak || 0} gün üst üste`}</span>` : ""}<p>${esc(h.reason || h.summary || (category === "contacts" ? "Sık görüşmek tek başına güveni sınırsız artırmaz." : ""))}</p></article>`).join("")}</div></section>`
    : "";
}

export function renderPolicies(view, actions) {
  const policy = view?.policy || {},
    groups = new Map();
  for (const a of actions.filter(
    (a) => a.category === "policy" && !a.id.startsWith("policy:day:"),
  )) {
    const field = a.id.split(":")[1];
    if (!groups.has(field)) groups.set(field, []);
    groups.get(field).push(a);
  }
  const labels = {
    meal: "Yemek düzeni",
    meals: "Yemek düzeni",
    commute: "Ulaşım tercihi",
    practice: "Gelişim odağı",
    practiceQuota: "Günlük pratik sayısı",
    business: "İşletme hizmeti",
    businessService: "İşletme hizmeti",
    householdChores: "Ortak ev işleri",
    autoWithdraw: "Nakit çekme",
    serviceQuota: "Günlük hizmet sınırı",
    bedtime: "Uyku saati",
  };
  const run = actions.filter((a) => a.id.startsWith("schedule:run:"));
  const selectedLabels = actions
    .filter(
      (a) =>
        a.category === "policy" &&
        a.disabled &&
        /seçili|zaten/.test(a.reason || "") &&
        ["meal", "commute", "practice", "bedtime"].includes(a.id.split(":")[1]),
    )
    .map((a) => a.label);
  return `<section class="policy-desk" data-emergent="policy"><div class="subheading"><div><span class="eyebrow">GÜNLÜK DÜZENİN</span><h3>Küçük işleri plana bırak.</h3></div></div><div class="planning-shortcuts"><button class="secondary" data-calendar-new>Takvime plan ekle ↗</button><button class="text-button" data-calendar-browse>Günü / haftayı gör ↗</button></div><div class="policy-run-first"><p class="policy-current">${selectedLabels.map(esc).join(" · ")}</p><div class="policy-run-controls">${run.map((a) => `<div><button class="primary" data-action="${esc(a.id)}" data-focus="action:${esc(a.id)}" ${a.disabled ? "disabled" : ""}>${esc(a.label)} →</button><button class="text-button" data-preview="${esc(a.id)}">Önce öngörüyü incele ↗</button></div>`).join("")}</div><p class="tiny">Son duruş: ${esc(view?.routine?.stopReason || "Henüz çalıştırılmadı.")}</p></div><p>Tercihlerin zamanı ilerletmez. Alttaki planı yürüttüğünde uygulanır; olay, bütçe veya sağlık riski kararı sana geri verir.</p><p class="policy-budget-hint">Uzun plan için öğün, ulaşım ve nakit tercihini seç. Bankada para olsa da nakit biterse rutin durabilir. Dilersen “Nakit çekme” alanından otomatik nakit tamamlamayı seç; bu tercih kendiliğinden açılmaz.</p><div class="policy-grid">${[...groups].map(([field, choices]) => `<label class="field">${esc(labels[field] || choices[0].description?.split(".")[0] || "Rutin tercihi")}<select data-policy-field="${esc(field)}" aria-label="${esc(labels[field] || field)}">${choices.map((a) => `<option value="${esc(a.id)}" ${String(policy[field]) === a.id.split(":").slice(2).join(":") || (a.disabled && /seçili|zaten|aynı/i.test(a.reason || "")) ? "selected" : ""} ${a.disabled && !/seçili|zaten|aynı/i.test(a.reason || "") ? "disabled" : ""}>${esc(a.label.replace(/^[^:]+:\s*/, ""))}</option>`).join("")}</select></label>`).join("")}</div><div class="policy-week"><p class="tiny">Planın çalışacağı günler</p><div class="policy-days">${actions
    .filter((a) => a.id.startsWith("policy:day:"))
    .map(
      (a) =>
        `<button data-action="${esc(a.id)}" data-focus="action:${esc(a.id)}" aria-pressed="${!!policy.days?.[Number(a.id.split(":").at(-1))]}" ${a.disabled ? "disabled" : ""}>${esc(["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"][Number(a.id.split(":").at(-1))])}</button>`,
    )
    .join("")}</div></div>${
    view?.routine
      ? `<details class="routine-trace"><summary>Son planın izi · ${view.routine.performedCount || 0} eylem</summary><p>${esc(view.routine.stopReason)}</p>${
          view.routine.lastActions?.length
            ? `<ol>${list(view.routine.lastActions)
                .map((x) => `<li>${esc(x)}</li>`)
                .join("")}</ol>`
            : ""
        }${
          view.routine.skipped?.length
            ? `<p>Atlanan işler</p><ul>${list(view.routine.skipped)
                .map((x) => `<li>${esc(x)}</li>`)
                .join("")}</ul>`
            : ""
        }</details>`
      : ""
  }<p class="tiny policy-boundary">İş değiştirmek, yatırım yapmak, ilişki veya olay kararı vermek otomatik değildir.</p>${view?.habits?.summary ? `<p class="habit-note">${esc(view.habits.summary)}</p>` : ""}</section>`;
}

export function renderHousehold(view, actions, actionCard, selected = "") {
  if (!view) return "";
  const h = view.household,
    lease = view.lease;
  const invitations = actions.filter(
    (a) => h?.actionIds.includes(a.id) && a.id.startsWith("household:invite:"),
  );
  const chosen =
    invitations.find((a) => a.id === selected) ||
    invitations.find((a) => !a.disabled) ||
    invitations[0];
  const invitePicker = chosen
    ? `<div class="household-invite"><label class="field">Kiminle, hangi ev düzeni?<select data-household-choice>${invitations.map((a) => `<option value="${esc(a.id)}" ${chosen.id === a.id ? "selected" : ""}>${esc(a.label)}${a.disabled ? " · koşulları incele" : ""}</option>`).join("")}</select></label>${actionCard(chosen, true)}</div>`
    : "";

  return `<section class="household-board" data-life="household">${
    h
      ? `<article class="life-contract"><div class="contract-heading"><span class="eyebrow">PAYLAŞILAN EV</span><span class="badge">${h.active ? "Ortak düzen" : "Kendi düzenin"}</span></div><h3>${esc(h.title)}</h3>${h.memberName ? `<p>Ev arkadaşın: <b>${esc(h.memberName)}</b></p>` : "<p>Aynı ev, açık sorumluluklar. Uygun birini davet ettiğinde koşulları birlikte belirlersiniz.</p>"}${h.active ? `<div class="life-metrics">${metric("Kira payı", money(h.rentShare))}${metric("Fatura payı", money(h.utilityShare))}${metric("Emanet depozito", money(h.deposit))}${metric("Ödenmeyen pay", money(h.unpaidShare))}${metric("Senin sorumluluğun", h.playerDue ? `${h.playerDue}. gün` : "Güncel")}${metric("Ortak sorumluluk", h.memberDue ? `${h.memberDue}. gün` : "Güncel")}</div><p class="tiny">${esc(typeof h.chores === "string" ? h.chores : h.chores?.summary || "Ev işleri, kira ve faturalar ortak geçmişinizde tutulur.")}${h.noticeDay ? ` · Ayrılık günü: ${h.noticeDay}` : ""}</p>` : ""}<div class="action-grid">${invitePicker}${controls(
          h.actionIds?.filter((id) => !id.startsWith("household:invite:")),
          actions,
          actionCard,
        )}</div><details class="contract-history"><summary>Ortak hesap ve sorumluluk geçmişi</summary>${history(h.history)}</details></article>`
      : ""
  }${lease ? `<article class="life-contract" data-life="lease"><div class="contract-heading"><span class="eyebrow">KİRA DOSYAN</span><span class="badge">${esc(states[lease.status] || lease.status)}</span></div><h3>${esc(lease.title)}</h3><div class="life-metrics">${metric("Sözleşmedeki kira", money(lease.rent))}${metric("Gecikmiş kira", money(lease.arrears))}${metric("Yenileme", lease.renewDay ? `${lease.renewDay}. gün` : "—")}${metric("Ödeme", lease.dueDay ? `${lease.dueDay}. gün` : "—")}</div>${lease.planLabel ? `<p>${esc(lease.planLabel)}</p>` : ""}<div class="action-grid">${controls(lease.actionIds, actions, actionCard)}</div><details class="contract-history"><summary>Kontrat ve anlaşmazlık geçmişi</summary>${history(lease.history)}</details></article>` : ""}${view.obligations?.length ? `<article class="life-contract"><span class="eyebrow">KAPANMAYAN ORTAK HESAPLAR</span>${view.obligations.map((o) => `<h3>${esc(o.name)} · ${money(o.amount)}</h3><div class="action-grid">${controls(o.actionIds, actions, actionCard)}</div>`).join("")}</article>` : ""}</section>`;
}

export function renderSecondaryContacts(view, selected) {
  return view?.secondary?.length
    ? `<section class="secondary-contacts"><div class="subheading"><h3>Hayatına giren şehir sakinleri</h3><span class="tiny">${view.secondary.length} kalıcı tanışıklık</span></div><div class="secondary-list">${view.secondary
        .map(
          (n) =>
            `<button class="contact ${n.id === selected ? "active" : ""}" data-npc="${esc(n.id)}" aria-pressed="${n.id === selected}"><span class="contact-avatar">${esc(
              n.name
                .split(" ")
                .map((v) => v[0])
                .slice(0, 2)
                .join(""),
            )}</span><span><strong>${esc(n.name)}</strong><small>${esc(n.role)}</small><em>${esc(n.availability)}</em></span></button>`,
        )
        .join("")}</div></section>`
    : '<p class="secondary-empty">Mahallene katıldıkça bazı karşılaşmalar kalıcı tanışıklıklara dönüşür.</p>';
}

export function renderSecondaryProfile(n, actions, actionCard) {
  return `<section class="contact-detail secondary-profile" data-life="secondary"><div class="profile-head" tabindex="-1"><div><span class="eyebrow">${esc(n.role)}</span><h3>${esc(n.name)}</h3><p>${esc(n.availability)}</p></div></div><p>${esc(n.goal)}</p><p class="tiny">${esc([n.profession, { kadikoy: "Kadıköy", besiktas: "Beşiktaş", sisli: "Şişli" }[n.home] || n.home].filter(Boolean).join(" · "))}</p><div class="life-metrics">${metric("Güven", n.trust)}${metric("Tanışıklık", n.familiarity)}${metric("Çatışma", n.conflict)}${metric("Karşılıklılık", n.reciprocity)}</div><div class="memory-note"><span class="eyebrow">SENİNLE PAYLAŞTIĞI GEÇMİŞ</span>${history(n.history)}</div><div class="action-grid">${controls(n.actionIds, actions, actionCard)}</div></section>`;
}

export function renderRoles(view, id, actions, actionCard) {
  const n = view?.relationships?.find((x) => x.id === id);
  return n
    ? `<section class="relationship-roles"><div class="role-chips">${n.roles.map((r) => `<span class="badge" title="${esc(r.description)}">${esc(r.label)}</span>`).join("")}</div><div class="life-metrics">${metric("Tanışıklık", n.familiarity)}${metric("Karşılıklılık", n.reciprocity)}${metric("Çatışma", n.conflict)}</div><div class="action-grid">${controls(n.actionIds, actions, actionCard)}</div></section>`
    : "";
}

export function renderEmployer(view, actions, actionCard) {
  const e = view?.employer;
  return e
    ? `<section class="life-contract" data-life="employer"><span class="eyebrow">İŞ YERİYLE ANLAŞMAN</span><h3>${esc(e.name)}</h3><p>${esc(e.terms)}</p><div class="life-metrics">${metric("Ek süre", `${e.extraMinutes} dk`)}${metric("Ek kazanç", money(e.bonus))}${metric("Değerlendirme", `${e.reviewDay}. gün`)}</div><p>${esc(e.need)} · ${esc(e.workload)}</p><div class="action-grid">${controls(e.actionIds, actions, actionCard)}</div><details class="contract-history"><summary>İş yeri geçmişin</summary>${history(e.history)}</details></section>`
    : "";
}

export function renderDistrictConditions(view, selected) {
  const d = view?.districts?.find((x) => x.id === selected);
  return d
    ? `<section class="district-condition" data-life="district"><div><span class="eyebrow">${esc(d.name)} / BUGÜNÜN KOŞULLARI</span><h3>${esc(d.label)}</h3><p>${esc(d.description)}</p></div><ul>${(d.effects || []).map((t) => `<li>${esc(t)}</li>`).join("")}</ul><span class="tiny">${d.untilDay}. günde yeniden değerlendirilir.</span></section>`
    : "";
}

export function renderFirstFive(state) {
  if (Math.floor(state.time / 1440) > 6) return "";
  const steps = [
    {
      label: "Geçimini seç",
      copy: state.job ? "İş sözleşmen hazır." : "Semtindeki işi ve koşullarını incele.",
      done: !!state.job,
      tab: "work",
    },
    {
      label: "Günlük düzenini kur",
      copy: state.deep.routine.lastRun
        ? "Planını bir kez denedin."
        : "Yemek, ulaşım ve bütçe sınırını seç.",
      done: !!state.deep.routine.lastRun,
      tab: "plan",
    },
    {
      label: "Birine zaman ayır",
      copy: "Bir görüşme veya kişisel zaman planla.",
      done: !!state.calendar.entries.length,
      tab: "plan",
    },
    {
      label: "Bir yön belirle",
      copy: "Gerçek adımlarla ilerleyen bir proje aç.",
      done: !!state.living.projects.length,
      tab: "projects",
    },
  ];
  return `<details class="first-five" data-emergent="onboarding"><summary><span><b>İlk 5 dakikan</b> · ${steps.filter((x) => x.done).length}/4 adım</span><span>Rehberi aç</span></summary><p>Zaman yalnızca bir hamleyle ilerler. Menüler ücretsizdir. Karar vermeden önce süreyi, bedeli ve öngörüyü gör.</p><div class="first-five-steps">${steps.map((x, i) => `<button data-tab="${x.tab}" class="guide-step"><b>${x.done ? "✓" : `0${i + 1}`}</b><span><strong>${esc(x.label)}</strong><small>${esc(x.copy)}</small></span><span aria-hidden="true">↗</span></button>`).join("")}</div></details>`;
}
