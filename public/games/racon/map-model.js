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
  function model(S, options = {}) {
    const Ag = w.RaconAg,
      ag = Ag.normalize(S.ag),
      narrow = options.narrow !== false;
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
  w.RaconMapModel = { model, COLORS };
})(typeof window !== "undefined" ? window : globalThis);
