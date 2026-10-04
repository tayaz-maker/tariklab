/* Presentation only: accepted street commitments, projected from two real snapshots. */
(function (w) {
  "use strict";
  const finite = (v) => Number.isFinite(v) ? v : 0;
  const bounded = (v) => Math.max(0, Math.min(100, finite(v)));
  const signed = (v) => (v > 0 ? "+" : "") + v;
  const control = { sen: "Sende", bos: "Boş", rakip: "Rakipte" };
  const labels = { koru: "Koru", yatirim: "Yatırım", cekil: "Çekil", iliski: "İlişki kur" };
  function snapshot(state) {
    if (!state) return null;
    return {
      week: finite(state.week), kasa: finite(state.kasa), saygi: finite(state.saygi), dosya: finite(state.dosya),
      streets: (state.streets || []).map((s) => ({ id: s.id, name: w.RaconAg?.NAMES[s.id] || "Adsız Avlu", control: s.sahip,
        trust: bounded(s.sadakatMahalle), pressure: bounded(s.heat), terror: bounded(s.terorMahalle), investment: finite(s.yatirim) })),
      people: (state.people || []).map((p) => ({ id: p.id, street: p.streetId, name: p.ad,
        relationship: Math.max(-100, Math.min(100, (p.mods || []).filter((m) => m.expireWeek === 0 || state.week < m.expireWeek).reduce((n, m) => n + finite(m.delta), 0))),
        favor: finite(p.favor) })),
      orders: (state.ag?.orders || []).map((o) => ({ street: o.street, kind: o.kind, from: o.from, left: o.left, target: o.target || null })),
      queue: (state.ag?.flow?.queue || []).map((p) => ({ id: p.id, from: p.from, to: p.to, left: p.left, kind: p.kind })),
    };
  }
  const orderKey = (o) => [o.street, o.kind, o.from, o.target || ""].join(":");
  function buildOutcomeMoment(before, after, order) {
    if (!before || !after || !order || !Object.hasOwn(labels, order.kind)) return null;
    const accepted = after.orders.find((o) => o.street === order.street && o.kind === order.kind &&
      (o.target || null) === (order.target || null) && !before.orders.some((old) => orderKey(old) === orderKey(o)));
    if (!accepted) return null;
    const old = before.streets.find((s) => s.id === accepted.street), next = after.streets.find((s) => s.id === accepted.street);
    if (!old || !next) return null;
    const changes = [];
    for (const [key, label] of [["trust", "Güven"], ["pressure", "Baskı"], ["terror", "Yerel gerilim"], ["investment", "Yatırım"]]) {
      const delta = next[key] - old[key];
      if (delta) changes.push({ key, label, before: old[key], after: next[key], delta, text: label + " " + signed(delta) });
    }
    if (old.control !== next.control) changes.push({ key: "control", label: "Kontrol", before: old.control, after: next.control, text: (control[old.control] || old.control) + " → " + (control[next.control] || next.control) });
    for (const p of after.people.filter((p) => p.street === accepted.street)) {
      const prev = before.people.find((x) => x.id === p.id);
      if (prev && p.relationship !== prev.relationship) changes.push({ key: "relationship", label: "Esnaf ilişkisi", before: prev.relationship, after: p.relationship, delta: p.relationship - prev.relationship, text: "Esnaf ilişkisi " + signed(p.relationship - prev.relationship) });
    }
    for (const [key, label] of [["saygi", "Saygı"], ["dosya", "Dosya"]]) {
      const delta = after[key] - before[key];
      if (delta) changes.push({ key, label, before: before[key], after: after[key], delta, text: label + " " + signed(delta) });
    }
    const cashDelta = after.kasa - before.kasa;
    const sent = after.queue.filter((p) => p.from === accepted.street && p.kind === accepted.kind && !before.queue.some((old) => old.id === p.id)).map((p) => ({ to: p.to, name: after.streets.find((s) => s.id === p.to)?.name || p.to, left: p.left }));
    const pendingText = accepted.left + " kapanış kaldı · sonuç bekliyor";
    const note = { koru: "Koruma taahhüdü sürüyor; haftalık etkiler henüz işlenmedi.", yatirim: "Yatırım tamamlanmadı; yeni yatırım geliri henüz oluşmadı.", cekil: "Sokak bırakıldı; dosya etkisi kapanışta işlenecek.", iliski: "Görüşmeler sürüyor; bitişteki iyilik henüz oluşmadı." }[accepted.kind];
    const costText = cashDelta ? "Kasa " + (cashDelta < 0 ? "−" : "+") + "₺" + Math.abs(cashDelta).toLocaleString("tr-TR") : "Kasa değişmedi";
    return {
      id: "racon-order:" + orderKey(accepted), kind: accepted.kind, street: accepted.street,
      title: labels[accepted.kind] + " · " + next.name, cashDelta, cost: Math.max(0, -cashDelta), costText, changes,
      trust: { before: old.trust, after: next.trust }, pressure: { before: old.pressure, after: next.pressure },
      control: next.control, pending: { left: accepted.left, text: pendingText, note, sent },
      announcement: labels[accepted.kind] + " kararı kabul edildi. " + next.name + ". " + costText + ". " + changes.map((c) => c.text).join(". ") + ". " + pendingText + ".",
    };
  }
  function render(model) {
    const d = w.document, section = d.createElement("section");
    section.className = "rc-receipt";
    section.setAttribute("data-outcome-moment", "racon");
    section.setAttribute("aria-label", "Mahalle karar makbuzu");
    const add = (tag, cls, text, parent = section) => { const el = d.createElement(tag); el.className = cls; el.textContent = text; parent.appendChild(el); return el; };
    const head = add("div", "rc-receipt-head", "");
    const title = add("div", "", "", head);
    add("span", "rc-receipt-kicker", "MAHALLEYE SÖZ VERİLDİ", title);
    add("h4", "rc-receipt-title", model.title, title);
    const close = add("button", "rc-receipt-close", "Kapat", head);
    close.type = "button"; close.setAttribute("data-outcome-close", ""); close.setAttribute("aria-label", "Karar makbuzunu kapat");
    add("strong", "rc-receipt-cost", model.costText);
    const district = add("div", "rc-receipt-district", "");
    district.setAttribute("aria-hidden", "true");
    for (let i = 0; i < 5; i++) { const block = add("i", "rc-receipt-block", "", district); block.dataset.lit = String(model.trust.after >= (i + 1) * 20); block.dataset.pressure = String(model.pressure.after >= (i + 1) * 20); }
    const traces = add("div", "rc-receipt-traces", "");
    for (const [key, label] of [["trust", "Güven"], ["pressure", "Baskı"]]) {
      const row = add("div", "rc-receipt-trace", "", traces);
      add("span", "", label + " " + model[key].before + " → " + model[key].after, row);
      const line = add("span", "rc-receipt-track " + key, "", row); line.setAttribute("aria-hidden", "true");
      const old = add("i", "rc-receipt-before", "", line), now = add("i", "rc-receipt-after", "", line);
      old.style.width = model[key].before + "%"; now.style.width = model[key].after + "%";
    }
    if (model.changes.length) add("p", "rc-receipt-changes", model.changes.map((c) => c.text).join(" · "));
    add("p", "rc-receipt-pending", model.pending.text);
    add("p", "rc-receipt-note", model.pending.note);
    if (model.pending.sent.length) add("p", "rc-receipt-note", "Yola çıktı: " + model.pending.sent.map((p) => p.name + " · " + p.left + " kapanış sonra").join(" / "));
    else add("p", "rc-receipt-note", "Komşu etkisi henüz sevk edilmedi.");
    return section;
  }
  w.RaconOutcome = { snapshot, buildOutcomeMoment, render };
})(typeof window !== "undefined" ? window : globalThis);
