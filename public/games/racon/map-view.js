/* Lazy, stopped Pixi Graphics; semantic DOM and SVG use exactly the same model. */
(function (w) {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const el = (tag, attrs = {}, text = "") => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (text) n.textContent = text;
    return n;
  };
  const num = (c) => parseInt(c.slice(1), 16);
  function create() {
    const root = document.createElement("div");
    root.className = "rm-surface";
    root.dataset.renderer = "svg";
    const gpu = document.createElement("div");
    gpu.className = "rm-gpu";
    gpu.setAttribute("aria-hidden", "true");
    const svg = el("svg", { class: "rm-svg", "aria-hidden": "true" }),
      buttons = document.createElement("div");
    buttons.className = "rm-buttons";
    root.append(gpu, svg, buttons);
    let scene = null,
      graphics = null,
      disposed = false,
      forced = false,
      model = null,
      canvas = null,
      starting = false,
      renderCount = 0;
    const metrics = { paints: 0, maxMs: 0, samples: [] };
    function paint() {
      if (!scene || !model || disposed) return;
      const g = graphics;
      g.clear();
      for (const l of model.links) {
        const a = l.aNode,
          b = l.bNode,
          steps = l.kind === "sinir" ? 20 : 1;
        for (let i = 0; i < steps; i += steps === 1 ? 1 : 2)
          g.moveTo(a.x + ((b.x - a.x) * i) / steps, a.y + ((b.y - a.y) * i) / steps)
            .lineTo(a.x + ((b.x - a.x) * (i + 1)) / steps, a.y + ((b.y - a.y) * (i + 1)) / steps)
            .stroke({ width: l.previews.length ? 3 : 2, color: num(l.color) });
      }
      for (const n of model.nodes) {
        g.poly(n.shape.flat())
          .fill(0x252b28)
          .stroke({
            color: num(n.selected ? model.colors.gold : n.color),
            width: n.selected ? 3 : 1.6,
          });
        for (let j = 0; j < 3; j++)
          g.moveTo(n.x - n.half + 6 + j * 7, n.y - 58)
            .lineTo(n.x - n.half + 6 + j * 7, n.y - 36)
            .stroke({ color: num(n.color), alpha: 0.7, width: 2 });
      }
      scene.render();
      renderCount++;
      root.dataset.paints = String(renderCount);
    }
    function size() {
      if (!scene || disposed || !model) return;
      const width = Math.max(1, root.clientWidth);
      scene.app.renderer.resize(width, (width * model.height) / model.width);
      scene.app.stage.scale.set(width / model.width);
      paint();
    }
    function fallback() {
      forced = true;
      if (canvas) canvas.removeEventListener("webglcontextlost", lost);
      canvas = null;
      scene?.destroy();
      scene = null;
      graphics = null;
      gpu.replaceChildren();
      root.dataset.renderer = "svg";
    }
    function lost(e) {
      e.preventDefault();
      fallback();
    }
    const observer =
      typeof ResizeObserver === "function"
        ? new ResizeObserver(() => {
            if (model && root.clientWidth < 510 !== model.narrow)
              w.dispatchEvent(new CustomEvent("racon-map-resize"));
            size();
          })
        : null;
    observer?.observe(root);
    function update(m) {
      const begin = performance.now();
      model = m;
      root.style.aspectRatio = `${m.width}/${m.height}`;
      svg.setAttribute("viewBox", `0 0 ${m.width} ${m.height}`);
      svg.replaceChildren();
      buttons.replaceChildren();
      for (const l of m.links) {
        const g = el("g", { "data-link": `${l.a}|${l.b}` });
        g.append(
          el("line", {
            x1: l.aNode.x,
            y1: l.aNode.y,
            x2: l.bNode.x,
            y2: l.bNode.y,
            stroke: l.color,
            "stroke-width": l.previews.length ? 3 : 2,
            "stroke-dasharray": l.kind === "sinir" ? "7 7" : "none",
            class: "rm-line",
          }),
        );
        const midX = (l.aNode.x + l.bNode.x) / 2,
          midY = (l.aNode.y + l.bNode.y) / 2;
        const directions = [...new Set([...l.previews, ...l.packets].map((p) => p.from))];
        for (const from of directions) {
          const forward = from === l.a,
            a = forward ? l.aNode : l.bNode,
            b = forward ? l.bNode : l.aNode,
            angle = Math.atan2(b.y - a.y, b.x - a.x),
            offset = directions.length > 1 ? 10 : 0;
          const cx = midX + Math.cos(angle) * offset,
            cy = midY + Math.sin(angle) * offset;
          const tip = [cx + Math.cos(angle) * 7, cy + Math.sin(angle) * 7],
            back = [cx - Math.cos(angle) * 5, cy - Math.sin(angle) * 5];
          g.append(
            el("polygon", {
              "data-flow-from": from,
              points: [
                tip,
                [back[0] + Math.sin(angle) * 5, back[1] - Math.cos(angle) * 5],
                [back[0] - Math.sin(angle) * 5, back[1] + Math.cos(angle) * 5],
              ]
                .map((p) => p.join(","))
                .join(" "),
              fill: l.color,
            }),
          );
        }
        const label = l.previews.length
          ? `+${l.previews[0].first} hf`
          : l.packets.length
            ? `${l.packets.length} iz · ${Math.min(...l.packets.map((p) => p.left))} hf`
            : `${l.delayAB === l.delayBA ? l.delayAB : l.delayAB + "/" + l.delayBA} hf`;
        const labelY = Math.abs(l.aNode.y - l.bNode.y) < 1 ? midY + 76 : midY + 7;
        g.append(
          el("rect", { x: midX - 34, y: labelY, width: 68, height: 19, rx: 3, fill: "#171c19" }),
          el(
            "text",
            { x: midX, y: labelY + 14, "text-anchor": "middle", fill: l.color, "font-size": 12 },
            label,
          ),
        );
        svg.append(g);
      }
      for (const n of m.nodes) {
        const g = el("g", { class: "rm-shape" });
        g.append(
          el("polygon", {
            points: n.shape.map((p) => p.join(",")).join(" "),
            fill: "#252b28",
            stroke: n.selected ? m.colors.gold : n.color,
            "stroke-width": n.selected ? 3 : 1.6,
          }),
        );
        for (let j = 0; j < 3; j++)
          g.append(
            el("line", {
              x1: n.x - n.half + 6 + j * 7,
              y1: n.y - 58,
              x2: n.x - n.half + 6 + j * 7,
              y2: n.y - 36,
              stroke: n.color,
              "stroke-width": 2,
              opacity: 0.7,
            }),
          );
        svg.append(g);
        const b = document.createElement("button");
        b.type = "button";
        b.className = `ag-node rm-node ${n.signal.kontrol}${n.selected ? " on" : ""}`;
        b.dataset.act = "street";
        b.dataset.id = n.id;
        b.setAttribute("aria-pressed", String(n.selected));
        b.style.cssText = `left:${((n.x - n.half + 8) / m.width) * 100}%;top:${((n.y - 60) / m.height) * 100}%;width:${((n.half * 2 - 16) / m.width) * 100}%;height:${(120 / m.height) * 100}%;--rm-color:${n.color}`;
        const name = document.createElement("b");
        name.textContent = n.name;
        const control = document.createElement("span");
        control.className = "rm-control";
        control.textContent = { sen: "SENDE", rakip: "RAKİPTE", bos: "BOŞ" }[n.signal.kontrol];
        const metric = document.createElement("span");
        metric.className = "rm-metric";
        metric.textContent =
          m.layer === "trust"
            ? `Güven ${n.metric}`
            : m.layer === "risk"
              ? `Risk ${n.metric} · ${n.signal.tehdit}`
              : m.layer === "resource"
                ? `₺${n.metric}/hf · Y${n.signal.yatirim}`
                : m.layer === "favor"
                  ? `İyilik ${n.favor}`
                  : `G ${n.signal.sadakat} · B ${n.signal.heat}`;
        const order = document.createElement("span");
        order.className = "rm-order";
        order.textContent = n.signal.karar
          ? `${w.RaconAg.ORDERS[n.signal.karar.kind].ad} · ${n.signal.karar.left} hf`
          : n.signal.rozet
            ? "◇ Fırsat var"
            : "— Emir yok";
        const wave = document.createElement("span");
        wave.className = "rm-wave";
        wave.textContent = n.influence
          ? `${Object.entries(n.influence.fx)
              .map(([k, v]) => (k === "heat" ? "B" : "G") + (v > 0 ? "+" : "") + v)
              .join(" ")} · +${n.influence.first} hf`
          : n.selected && m.plan
            ? `−₺${m.plan.cost} şimdi`
            : n.incoming.length
              ? `${n.incoming.length} iz yolda`
              : `${n.prediction.heatDelta >= 0 ? "+" : ""}${n.prediction.heatDelta} baskı/hf`;
        b.append(name, control, metric, order, wave);
        b.setAttribute(
          "aria-label",
          `${n.name}, ${control.textContent}, güven ${n.signal.sadakat}, baskı ${n.signal.heat}, ${order.textContent}, ${wave.textContent}`,
        );
        buttons.append(b);
      }
      size();
      const duration = performance.now() - begin;
      metrics.paints++;
      metrics.maxMs = Math.max(metrics.maxMs, duration);
      metrics.samples.push(duration);
      if (metrics.samples.length > 60) metrics.samples.shift();
      root.dataset.renderMs = duration.toFixed(2);
    }
    async function start() {
      if (starting || disposed || forced) return;
      starting = true;
      let probe;
      try {
        probe = document.createElement("canvas");
        const gl = probe.getContext("webgl2") || probe.getContext("webgl");
        if (!gl) return;
        gl.getExtension("WEBGL_lose_context")?.loseContext();
        const adapter = await import("../shared/pixi-adapter.js");
        if (disposed || forced) return;
        const s = await adapter.mountPixiScene({
          container: gpu,
          width: 1,
          height: 1,
          background: 0x1b211e,
          build: ({ app, PIXI }) => {
            graphics = new PIXI.Graphics();
            app.stage.addChild(graphics);
          },
        });
        if (disposed || forced) {
          s?.destroy();
          return;
        }
        if (!s) return;
        scene = s;
        canvas = s.app.canvas;
        canvas.addEventListener("webglcontextlost", lost);
        root.dataset.renderer = "pixi";
        size();
      } catch {
        fallback();
      }
    }
    return {
      element: root,
      update,
      start,
      fallback,
      metrics,
      destroy() {
        if (disposed) return;
        disposed = true;
        observer?.disconnect();
        fallback();
        root.remove();
      },
      get narrow() {
        return root.clientWidth < 510;
      },
    };
  }
  w.RaconMapView = { create };
})(window);
