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
  const routeColor = (l, colors) =>
    l.packets.length
      ? colors.ink
      : colors[l.kind === "hat" ? "sen" : l.kind === "sinir" ? "rakip" : "bos"];
  function create() {
    const root = document.createElement("div");
    root.className = "rm-surface";
    root.dataset.renderer = "svg";
    const gpu = document.createElement("div");
    gpu.className = "rm-gpu";
    gpu.setAttribute("aria-hidden", "true");
    const svg = el("svg", { class: "rm-svg", "aria-hidden": "true" }),
      buttons = document.createElement("div"),
      svgLinks = el("g", { "data-map-base": "links" }),
      svgPlan = el("g", { "data-map-overlay": "plan" }),
      svgFlow = el("g", { "data-map-overlay": "flow" }),
      svgBase = el("g", { "data-map-base": "nodes" }),
      svgSelection = el("g", { "data-map-overlay": "selection", class: "rm-shape" });
    svg.append(svgLinks, svgPlan, svgFlow, svgBase, svgSelection);
    buttons.className = "rm-buttons";
    root.append(gpu, svg, buttons);
    let scene = null,
      graphics = null,
      disposed = false,
      forced = false,
      model = null,
      canvas = null,
      starting = false,
      startRequested = false,
      renderCount = 0,
      layoutKey = "",
      renderWidth = 0,
      renderHeight = 0,
      renderScale = 0;
    const domKeys = {},
      gpuKeys = {},
      buttonNodes = new Map(),
      metrics = { paints: 0, maxMs: 0, samples: [] };
    function drawRoute(g, l, color, width) {
      const a = l.aNode,
        b = l.bNode,
        steps = l.kind === "sinir" ? 20 : 1;
      for (let i = 0; i < steps; i += steps === 1 ? 1 : 2)
        g.moveTo(a.x + ((b.x - a.x) * i) / steps, a.y + ((b.y - a.y) * i) / steps)
          .lineTo(a.x + ((b.x - a.x) * (i + 1)) / steps, a.y + ((b.y - a.y) * (i + 1)) / steps)
          .stroke({ width, color: num(color) });
    }
    function paint(next) {
      if (!scene || !model || disposed || document.hidden) return false;
      let changed = false;
      const { width, height } = dimensions(),
        scale = width / model.width;
      if (!width) return false;
      if (renderWidth !== width || renderHeight !== height) {
        scene.app.renderer.resize(width, height);
        renderWidth = width;
        renderHeight = height;
        changed = true;
      }
      if (renderScale !== scale) {
        scene.app.stage.scale.set(scale);
        renderScale = scale;
        changed = true;
      }
      if (gpuKeys.links !== next.links) {
        graphics.links.clear();
        for (const l of model.links) drawRoute(graphics.links, l, routeColor(l, model.colors), 2);
        changed = true;
      }
      if (gpuKeys.plan !== next.plan) {
        graphics.plan.clear();
        for (const l of model.links)
          if (l.previews.length) drawRoute(graphics.plan, l, model.colors.gold, 3);
        changed = true;
      }
      if (gpuKeys.base !== next.base) {
        const g = graphics.base;
        g.clear();
        for (const n of model.nodes) {
          g.poly(n.shape.flat())
            .fill(0x252b28)
            .stroke({ color: num(n.color), width: 1.6 });
          for (const mark of n.marks) {
            if (mark.type === "rect")
              g.rect(mark.x, mark.y, mark.width, mark.height).fill({
                color: num(mark.color),
                alpha: mark.alpha,
              });
            else
              g.moveTo(mark.x1, mark.y1)
                .lineTo(mark.x2, mark.y2)
                .stroke({ color: num(mark.color), alpha: mark.alpha, width: mark.width });
          }
        }
        changed = true;
      }
      if (gpuKeys.selection !== next.selection) {
        graphics.selection.clear();
        for (const n of model.nodes)
          if (n.selected)
            graphics.selection
              .poly(n.shape.flat())
              .stroke({ color: num(model.colors.gold), width: 3 });
        changed = true;
      }
      Object.assign(gpuKeys, next);
      if (changed) {
        scene.render();
        root.dataset.paints = String(++renderCount);
        root.dataset.renderer = "pixi";
      }
      return changed;
    }
    function dimensions() {
      const width = Math.max(0, root.clientWidth);
      return { width, height: model ? (width * model.height) / model.width : 1 };
    }
    function preferSvg() {
      const { width, height } = dimensions(),
        memory = w.navigator?.deviceMemory,
        dpr = w.devicePixelRatio || 1;
      return (Number.isFinite(memory) && memory <= 2) || width * height * dpr * dpr > 2000000;
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
    function resized() {
      if (disposed || document.hidden || !root.clientWidth) return;
      if (model && root.clientWidth < 510 !== model.narrow)
        w.dispatchEvent(new CustomEvent("racon-map-resize"));
      flush();
    }
    function visible() {
      if (disposed || document.hidden) return;
      resized();
    }
    document.addEventListener("visibilitychange", visible);
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(resized) : null;
    observer?.observe(root);
    function keys(m) {
      // Preview-derived link colors and selected node borders never invalidate the base.
      return {
        links: JSON.stringify(
          m.links.map((l) => [
            l.a,
            l.b,
            l.aNode.x,
            l.aNode.y,
            l.bNode.x,
            l.bNode.y,
            l.kind,
            routeColor(l, m.colors),
          ]),
        ),
        base: JSON.stringify([
          m.width,
          m.height,
          m.layer,
          m.narrow,
          m.reduced,
          m.nodes.map((n) => [n.id, n.shape, n.color, n.marks, n.metric, n.favor, n.signal]),
        ]),
        plan: JSON.stringify([
          m.colors.gold,
          m.links
            .filter((l) => l.previews.length)
            .map((l) => [l.a, l.b, l.aNode.x, l.aNode.y, l.bNode.x, l.bNode.y, l.kind]),
        ]),
        flow: JSON.stringify(
          m.links.map((l) => [
            l.a,
            l.b,
            l.aNode.x,
            l.aNode.y,
            l.bNode.x,
            l.bNode.y,
            l.color,
            l.previews,
            l.packets,
            l.delayAB,
            l.delayBA,
          ]),
        ),
        selection: JSON.stringify([
          m.colors.gold,
          m.nodes.filter((n) => n.selected).map((n) => [n.id, n.shape]),
        ]),
      };
    }
    function svgLine(l, color, width) {
      return el("line", {
        x1: l.aNode.x,
        y1: l.aNode.y,
        x2: l.bNode.x,
        y2: l.bNode.y,
        stroke: color,
        "stroke-width": width,
        "stroke-dasharray": l.kind === "sinir" ? "7 7" : "none",
        class: "rm-line",
      });
    }
    function drawSvg(m, next) {
      let changed = false;
      if (domKeys.links !== next.links) {
        svgLinks.replaceChildren(...m.links.map((l) => svgLine(l, routeColor(l, m.colors), 2)));
        changed = true;
      }
      if (domKeys.plan !== next.plan) {
        svgPlan.replaceChildren(
          ...m.links.filter((l) => l.previews.length).map((l) => svgLine(l, m.colors.gold, 3)),
        );
        changed = true;
      }
      if (domKeys.flow !== next.flow) {
        svgFlow.replaceChildren();
        for (const l of m.links) {
          const g = el("g", { "data-link": `${l.a}|${l.b}` });
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
          svgFlow.append(g);
        }
        changed = true;
      }
      if (domKeys.base !== next.base) {
        svgBase.replaceChildren();
        for (const n of m.nodes) {
          const g = el("g", { class: "rm-shape" });
          g.append(
            el("polygon", {
              points: n.shape.map((p) => p.join(",")).join(" "),
              fill: "#252b28",
              stroke: n.color,
              "stroke-width": 1.6,
            }),
          );
          for (const mark of n.marks)
            g.append(
              el(
                mark.type,
                mark.type === "rect"
                  ? {
                      "data-street-mark": mark.role,
                      x: mark.x,
                      y: mark.y,
                      width: mark.width,
                      height: mark.height,
                      fill: mark.color,
                      opacity: mark.alpha,
                    }
                  : {
                      "data-street-mark": mark.role,
                      x1: mark.x1,
                      y1: mark.y1,
                      x2: mark.x2,
                      y2: mark.y2,
                      stroke: mark.color,
                      "stroke-width": mark.width,
                      opacity: mark.alpha,
                    },
              ),
            );
          svgBase.append(g);
        }
        changed = true;
      }
      if (domKeys.selection !== next.selection) {
        svgSelection.replaceChildren(
          ...m.nodes
            .filter((n) => n.selected)
            .map((n) =>
              el("polygon", {
                points: n.shape.map((p) => p.join(",")).join(" "),
                fill: "none",
                stroke: m.colors.gold,
                "stroke-width": 3,
              }),
            ),
        );
        changed = true;
      }
      Object.assign(domKeys, next);
      return changed;
    }
    function drawButtons(m) {
      let changed = false;
      const ids = new Set(m.nodes.map((n) => n.id));
      for (const [id, entry] of buttonNodes) {
        if (ids.has(id)) continue;
        entry.button.remove();
        buttonNodes.delete(id);
        changed = true;
      }
      for (let i = 0; i < m.nodes.length; i++) {
        const n = m.nodes[i],
          key = JSON.stringify([m.width, m.height, m.layer, m.plan?.cost, n]);
        let entry = buttonNodes.get(n.id);
        if (!entry) {
          const b = document.createElement("button");
          b.type = "button";
          b.dataset.act = "street";
          b.dataset.id = n.id;
          const name = document.createElement("b"),
            control = document.createElement("span"),
            metric = document.createElement("span"),
            order = document.createElement("span"),
            wave = document.createElement("span");
          control.className = "rm-control";
          metric.className = "rm-metric";
          order.className = "rm-order";
          wave.className = "rm-wave";
          b.append(name, control, metric, order, wave);
          entry = { button: b, name, control, metric, order, wave, key: "" };
          buttonNodes.set(n.id, entry);
        }
        const { button: b, name, control, metric, order, wave } = entry;
        if (buttons.children[i] !== b) {
          buttons.insertBefore(b, buttons.children[i] || null);
          changed = true;
        }
        if (entry.key === key) continue;
        b.className = `ag-node rm-node ${n.signal.kontrol}${n.selected ? " on" : ""}`;
        b.setAttribute("aria-pressed", String(n.selected));
        b.style.cssText = `left:${((n.x - n.half + 8) / m.width) * 100}%;top:${((n.y - 60) / m.height) * 100}%;width:${((n.half * 2 - 16) / m.width) * 100}%;height:${(120 / m.height) * 100}%;--rm-color:${n.color}`;
        name.textContent = n.name;
        control.textContent = { sen: "SENDE", rakip: "RAKİPTE", bos: "BOŞ" }[n.signal.kontrol];
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
        order.textContent = n.signal.karar
          ? `${w.RaconAg.ORDERS[n.signal.karar.kind].ad} · ${n.signal.karar.left} hf`
          : n.signal.rozet
            ? "◇ Fırsat var"
            : "— Emir yok";
        wave.textContent = n.influence
          ? `${Object.entries(n.influence.fx)
              .map(([k, v]) => (k === "heat" ? "B" : "G") + (v > 0 ? "+" : "") + v)
              .join(" ")} · +${n.influence.first} hf`
          : n.selected && m.plan
            ? `−₺${m.plan.cost} şimdi`
            : n.incoming.length
              ? `${n.incoming.length} iz yolda`
              : `${n.prediction.heatDelta >= 0 ? "+" : ""}${n.prediction.heatDelta} baskı/hf`;
        b.setAttribute(
          "aria-label",
          `${n.name}, ${control.textContent}, güven ${n.signal.sadakat}, baskı ${n.signal.heat}, ${order.textContent}, ${wave.textContent}`,
        );
        entry.key = key;
        changed = true;
      }
      return changed;
    }
    function flush() {
      if (!model || disposed || document.hidden) return;
      const begin = performance.now(),
        next = keys(model),
        layout = `${model.width}/${model.height}`;
      let changed = layoutKey !== layout;
      if (changed) {
        root.style.aspectRatio = layout;
        svg.setAttribute("viewBox", `0 0 ${model.width} ${model.height}`);
        layoutKey = layout;
      }
      changed = drawSvg(model, next) || changed;
      changed = drawButtons(model) || changed;
      if (!forced && preferSvg()) fallback();
      changed = paint(next) || changed;
      if (changed) {
        const duration = performance.now() - begin;
        metrics.paints++;
        metrics.maxMs = Math.max(metrics.maxMs, duration);
        metrics.samples.push(duration);
        if (metrics.samples.length > 60) metrics.samples.shift();
        root.dataset.renderMs = duration.toFixed(2);
      }
      if (startRequested && !starting && !scene && !forced) void start();
    }
    function update(m) {
      if (disposed) return;
      model = m;
      flush();
    }
    async function start() {
      startRequested = true;
      if (starting || disposed || forced || !model || document.hidden || !root.clientWidth) return;
      if (preferSvg()) {
        fallback();
        return;
      }
      starting = true;
      let probe;
      try {
        probe = document.createElement("canvas");
        const gl = probe.getContext("webgl2") || probe.getContext("webgl");
        if (!gl) return;
        gl.getExtension("WEBGL_lose_context")?.loseContext();
        const adapter = await import("../shared/pixi-adapter.js");
        if (disposed || forced) return;
        if (document.hidden || !root.clientWidth) {
          starting = false;
          return;
        }
        if (preferSvg()) {
          fallback();
          return;
        }
        const { width, height } = dimensions();
        const s = await adapter.mountPixiScene({
          container: gpu,
          width,
          height,
          background: 0x1b211e,
          build: ({ app, PIXI }) => {
            graphics = {};
            // Preview routes stay behind node fills, matching the original draw order.
            for (const name of ["links", "plan", "base", "selection"]) {
              const g = new PIXI.Graphics();
              g.label = `racon-${name}`;
              graphics[name] = g;
              app.stage.addChild(g);
            }
          },
        });
        if (disposed || forced) {
          s?.destroy();
          graphics = null;
          return;
        }
        if (!s) return;
        scene = s;
        renderWidth = width;
        renderHeight = height;
        canvas = s.app.canvas;
        canvas.addEventListener("webglcontextlost", lost);
        flush();
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
        document.removeEventListener("visibilitychange", visible);
        fallback();
        buttonNodes.clear();
        model = null;
        root.remove();
      },
      get narrow() {
        return root.clientWidth < 510;
      },
    };
  }
  w.RaconMapView = { create };
})(window);
