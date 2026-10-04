/* Original courtyard schematic. Pure projection: never normalizes/mutates the live save. */
(function (w) {
  "use strict";
  const COLORS = {
    sen: "#89ad92",
    rakip: "#c17665",
    bos: "#8e8a80",
    paper: "#202524",
    line: "#59645d",
    ink: "#e7e0cc",
    gold: "#d9bc72",
  };
  /* Static façade marks share one geometry in SVG and Pixi. Keep them in the
     perimeter bands, clear of the unchanged street label and button geometry. */
  function streetMarks(
    signal = {},
    { x = 0, y = 0, half = 76, narrow = false, reduced = false } = {},
  ) {
    const value = (v) => (Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 0),
      trust = value(signal.sadakat),
      pressure = value(signal.heat),
      compact = narrow || reduced,
      left = x - half + 16,
      open = trust >= 35 && pressure < 60,
      order = signal.karar;
    const marks = [
      {
        type: "rect",
        role: "door-frame",
        x: left,
        y: y - 62,
        width: 8,
        height: 13,
        color: COLORS.line,
        alpha: 1,
      },
      {
        type: "rect",
        role: open ? "door-open" : "door-closed",
        x: left + 2,
        y: y - 60,
        width: open ? 2 : 4,
        height: 11,
        color: open ? COLORS.gold : COLORS.paper,
        alpha: 1,
      },
      {
        type: "rect",
        role: "trust-light",
        x: left + 15,
        y: y - 60,
        width: compact ? 6 + Math.floor(trust / 25) : 6,
        height: 5,
        color: trust >= 35 ? COLORS.gold : COLORS.line,
        alpha: trust >= 35 ? 0.95 : 0.6,
      },
    ];
    if (!compact) {
      marks.push(
        {
          type: "rect",
          role: "trust-light",
          x: left + 25,
          y: y - 60,
          width: 6,
          height: 5,
          color: trust >= 60 ? COLORS.gold : COLORS.line,
          alpha: trust >= 60 ? 0.95 : 0.6,
        },
        {
          type: "rect",
          role: "trust-light",
          x: left + 35,
          y: y - 60,
          width: 6,
          height: 5,
          color: trust >= 80 ? COLORS.gold : COLORS.line,
          alpha: trust >= 80 ? 0.95 : 0.6,
        },
      );
    }
    if (pressure >= 30)
      marks.push({
        type: "line",
        role: "pressure",
        x1: left + 6,
        y1: y + 60,
        x2: left + (compact ? 6 + Math.ceil(pressure / 10) : 12),
        y2: y + 60,
        color: pressure >= 60 ? COLORS.rakip : COLORS.gold,
        width: 2,
        alpha: 0.9,
      });
    if (!compact && pressure >= 60)
      marks.push({
        type: "line",
        role: "pressure",
        x1: left + 16,
        y1: y + 60,
        x2: left + 22,
        y2: y + 60,
        color: COLORS.rakip,
        width: 2,
        alpha: 0.9,
      });
    if (!compact && pressure >= 80)
      marks.push({
        type: "line",
        role: "pressure",
        x1: left + 26,
        y1: y + 60,
        x2: left + 32,
        y2: y + 60,
        color: COLORS.rakip,
        width: 2,
        alpha: 0.9,
      });
    if (order && ["koru", "yatirim", "cekil", "iliski"].includes(order.kind)) {
      const orderWidth = { koru: 12, yatirim: 16, cekil: 6, iliski: 10 }[order.kind];
      marks.push({
        type: "rect",
        role: "active-order",
        x: x + half - 42,
        y: y + 57,
        width: orderWidth,
        height: 5,
        color: COLORS.gold,
        alpha: 0.95,
      });
      if (!compact)
        marks.push({
          type: "line",
          role: "order-time",
          x1: x + half - 42,
          y1: y + 64,
          x2:
            x +
            half -
            42 +
            Math.max(1, Math.min(4, Number.isFinite(order.left) ? order.left : 1)) * 4,
          y2: y + 64,
          color: COLORS.gold,
          width: 1,
          alpha: 0.75,
        });
    }
    return marks;
  }
  function model(S, options = {}) {
    const Ag = w.RaconAg,
      ag = Ag.normalize(S.ag),
      narrow = options.narrow !== false,
      reduced = options.reduced === true;
    const selected = options.selected || S.streetHome,
      layer = options.layer || "control";
    const next = Ag.forecast(S),
      plan = options.kind ? Ag.preview(S, selected, options.kind, options.target) : null;
    const width = narrow ? 360 : 660,
      height = narrow ? 600 : 420;
    const nodes = S.streets.map((st, i) => {
      const cell = Ag.cell(st.id, narrow ? "narrow" : "wide", i),
        x = narrow ? 90 + cell[0] * 180 : 110 + cell[0] * 220,
        y = narrow ? 100 + cell[1] * 200 : 105 + cell[1] * 210;
      const signal = Ag.signals(S, st, {
        touch: S.flags?.touchJobs?.[st.id] || 0,
        randevu: (S.calendar || []).some((c) => c.status === "bekler" && c.ref?.sokakId === st.id),
      });
      const people = (S.people || []).filter((p) => p.streetId === st.id),
        favor = people.reduce((v, p) => v + (Number.isFinite(p.favor) ? p.favor : 0), 0);
      const incoming = (ag.flow?.queue || []).filter((p) => p.to === st.id),
        prediction = next.streets.find((p) => p.id === st.id);
      const influence = plan?.spread.find((p) => p.to === st.id),
        half = narrow ? 76 : 92;
      const shape = [
        [x - half, y - 68],
        [x + half - 19, y - 68],
        [x + half, y - 49],
        [x + half, y + 48],
        [x + half - 20, y + 68],
        [x - half + 12, y + 68],
        [x - half, y + 56],
      ];
      const metric =
        layer === "trust"
          ? signal.sadakat
          : layer === "risk"
            ? signal.tehditPuan
            : layer === "resource"
              ? signal.gelir
              : layer === "favor"
                ? favor
                : null;
      const color =
        layer === "risk"
          ? metric >= 60
            ? COLORS.rakip
            : metric >= 30
              ? COLORS.gold
              : COLORS.sen
          : layer === "trust"
            ? metric < 35
              ? COLORS.rakip
              : metric < 60
                ? COLORS.gold
                : COLORS.sen
            : COLORS[signal.kontrol] || COLORS.bos;
      return {
        id: st.id,
        name: Ag.NAMES[st.id] || "Adsız Avlu",
        x,
        y,
        half,
        shape,
        signal,
        marks: streetMarks(signal, { x, y, half, narrow, reduced }),
        favor,
        incoming,
        prediction,
        influence,
        metric,
        color,
        selected: st.id === selected,
      };
    });
    const links = Ag.links(S).map((l) => {
      const a = nodes.find((n) => n.id === l.a),
        b = nodes.find((n) => n.id === l.b);
      const packets = (ag.flow?.queue || []).filter(
        (p) => (p.from === l.a && p.to === l.b) || (p.from === l.b && p.to === l.a),
      );
      const previews =
        plan?.spread.filter(
          (p) => (p.from === l.a && p.to === l.b) || (p.from === l.b && p.to === l.a),
        ) || [];
      return {
        ...l,
        aNode: a,
        bNode: b,
        packets,
        previews,
        delayAB: Ag.delay(S, l.a, l.b),
        delayBA: Ag.delay(S, l.b, l.a),
        color: previews.length
          ? COLORS.gold
          : packets.length
            ? COLORS.ink
            : COLORS[l.kind === "hat" ? "sen" : l.kind === "sinir" ? "rakip" : "bos"],
      };
    });
    return {
      width,
      height,
      narrow,
      reduced,
      selected,
      layer,
      nodes,
      links,
      plan,
      next,
      history: ag.flow?.history || [],
      orders: ag.orders.length,
      capacity: Ag.capacity(S),
      week: S.week,
      colors: COLORS,
    };
  }
  w.RaconMapModel = { model, streetMarks, COLORS };
})(typeof window !== "undefined" ? window : globalThis);
