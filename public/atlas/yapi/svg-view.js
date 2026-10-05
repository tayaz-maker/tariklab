import { buildAtlasGeometry } from "./geometry.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const LAYERS = ["surface", "skeleton", "organs"];
const TONES = {
  skin: ["#eddac4", "#d2b295", "#97745e"],
  "skin-shadow": ["#896a57", "#a0816c", "#bea187"],
  "skin-highlight": ["#fff0d8", "#f0d7b7", "#dfbb94"],
  bone: ["#fff9e2", "#e4d1ad", "#a68d69"],
  "bone-shadow": ["#d7c7a8", "#b5a17f", "#8e7e63"],
  "bone-highlight": ["#fffbee", "#f5eacf", "#d6c3a0"],
  brain: ["#d5b5b0", "#ad827c", "#735957"],
  heart: ["#c88b7c", "#a1564c", "#653d38"],
  lung: ["#d9b4b0", "#b98b89", "#825f61"],
  liver: ["#af7a68", "#885647", "#583d33"],
  stomach: ["#e0b4a4", "#c38874", "#865d50"],
  kidney: ["#c49686", "#a36757", "#70483e"],
};

let instanceCount = 0;

function svgNode(tag, attributes = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) {
    node.setAttribute(name, String(value));
  }
  return node;
}

function brighten(hex) {
  const channels = hex
    .slice(1)
    .match(/../g)
    .map((value) => parseInt(value, 16));
  return `#${channels
    .map((value) =>
      Math.round(value + (255 - value) * 0.13)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

function materialFor(tone, colors) {
  if (tone === "skin-highlight" || tone === "skin-shadow") {
    const highlight = tone === "skin-highlight";
    return {
      tag: "radialGradient",
      attributes: {
        // An object-relative circle becomes an ellipse following each body plane.
        // Keeping its outside transparent softens the drawn plane without a blur.
        gradientUnits: "objectBoundingBox",
        cx: "50%",
        cy: "50%",
        r: "50%",
        fx: highlight ? "37%" : "61%",
        fy: highlight ? "29%" : "64%",
      },
      stops: [
        [0, colors[0], highlight ? 0.92 : 0.74],
        [25, colors[0], highlight ? 0.69 : 0.54],
        [51, colors[1], highlight ? 0.34 : 0.29],
        [76, colors[2], 0.07],
        [96, colors[2], 0],
        [100, colors[2], 0],
      ],
    };
  }

  if (tone === "skin") {
    return {
      tag: "linearGradient",
      // One body-space light field keeps separately shaped wrists/hands/ears
      // continuous with the torso instead of creating material seams.
      attributes: { gradientUnits: "userSpaceOnUse", x1: "90", y1: "150", x2: "345", y2: "625" },
      stops: [
        [0, colors[0], 1],
        [22, "#e8d0b5", 1],
        [48, colors[1], 1],
        [76, "#bc987b", 1],
        [100, colors[2], 1],
      ],
    };
  }

  if (tone.startsWith("bone")) {
    return {
      tag: "linearGradient",
      attributes: { x1: "4%", y1: "22%", x2: "96%", y2: "71%" },
      stops: [
        [0, colors[0], 1],
        [23, colors[0], 1],
        [52, colors[1], 1],
        [100, colors[2], 1],
      ],
    };
  }

  return {
    tag: "radialGradient",
    attributes: {
      gradientUnits: "objectBoundingBox",
      cx: "44%",
      cy: "42%",
      r: "74%",
      fx: "26%",
      fy: "20%",
    },
    stops: [
      [0, colors[0], 1],
      [42, colors[1], 1],
      [100, colors[2], 1],
    ],
  };
}

function createToneDefinitions(prefix) {
  const defs = svgNode("defs");
  for (const [tone, colors] of Object.entries(TONES)) {
    const material = materialFor(tone, colors);
    for (const selected of [false, true]) {
      const gradient = svgNode(material.tag, {
        id: `${prefix}-${tone}${selected ? "-selected" : ""}`,
        ...material.attributes,
      });
      material.stops.forEach(([offset, color, opacity]) => {
        gradient.append(
          svgNode("stop", {
            offset: `${offset}%`,
            "stop-color": selected ? brighten(color) : color,
            "stop-opacity": opacity,
          }),
        );
      });
      defs.append(gradient);
    }
  }
  return defs;
}

function finiteNumber(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp(value, lower, upper) {
  return Math.min(upper, Math.max(lower, value));
}

/**
 * Original SVG display of the local, schematic anatomy geometry.
 * All text, keyboard controls and source/review status belong to the sibling DOM.
 * This visual surface has no independent accessibility tree or focus targets.
 */
export function createAtlasView({ onSelect } = {}) {
  const prefix = `atlas-body-${++instanceCount}`;
  const element = document.createElement("div");
  element.className = "atlas-view";

  const svg = svgNode("svg", {
    class: "atlas-view__svg",
    viewBox: "0 0 420 780",
    preserveAspectRatio: "xMidYMid meet",
    "aria-hidden": "true",
    focusable: "false",
    "data-renderer": "svg",
  });
  const viewport = svgNode("g", { class: "atlas-view__viewport" });
  svg.append(createToneDefinitions(prefix), viewport);
  element.append(svg);

  const cache = new Map();
  const state = {
    variant: "male",
    view: "front",
    layers: { surface: true, skeleton: true, organs: true },
    selectedId: null,
    zoom: 1,
    panX: 0,
    panY: 0,
  };
  let current = null;
  let destroyed = false;

  function paint(tone, selected = false) {
    return `url(#${prefix}-${Object.hasOwn(TONES, tone) ? tone : "skin"}${selected ? "-selected" : ""})`;
  }

  function strokePaint(stroke) {
    return Object.hasOwn(TONES, stroke) ? paint(stroke) : (stroke ?? "none");
  }

  function geometryGroup(variant, view) {
    const key = `${variant}-${view}`;
    if (cache.has(key)) return cache.get(key);

    const geometry = buildAtlasGeometry({ variant, view });
    const group = svgNode("g", {
      class: "atlas-view__body",
      "data-variant": variant,
      "data-view": view,
      "data-geometry-version": geometry.version,
    });
    const layers = new Map();
    const paths = [];
    for (const layer of LAYERS) {
      const layerGroup = svgNode("g", {
        class: `atlas-view__layer atlas-view__layer--${layer}`,
        "data-layer": layer,
      });
      layers.set(layer, layerGroup);
      group.append(layerGroup);
    }

    for (const descriptor of geometry.paths) {
      const layer = layers.get(descriptor.layer);
      if (!layer) continue;
      const fill = descriptor.fill === "none" ? "none" : paint(descriptor.tone);
      const stroke = strokePaint(descriptor.stroke);
      const strokeWidth = finiteNumber(descriptor.strokeWidth, 0.8);
      const path = svgNode("path", {
        class: "atlas-view__structure",
        d: descriptor.d,
        fill,
        stroke,
        "stroke-width": strokeWidth,
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        "vector-effect": "non-scaling-stroke",
        opacity: clamp(finiteNumber(descriptor.opacity, 1), 0, 1),
        "data-key": descriptor.key,
        "data-layer": descriptor.layer,
        "data-selected": "false",
      });
      if (descriptor.structureId) path.setAttribute("data-id", descriptor.structureId);
      layer.append(path);
      paths.push({ path, descriptor, fill, stroke, strokeWidth, selected: false });
    }

    const entry = { group, layers, paths };
    group.setAttribute("display", "none");
    viewport.append(group);
    cache.set(key, entry);
    return entry;
  }

  function update(next = {}) {
    if (destroyed) return;
    if (next.variant === "male" || next.variant === "female") state.variant = next.variant;
    if (next.view === "front" || next.view === "back") state.view = next.view;
    if (next.layers && typeof next.layers === "object") {
      for (const layer of LAYERS) {
        if (typeof next.layers[layer] === "boolean") state.layers[layer] = next.layers[layer];
      }
    }
    if (Object.hasOwn(next, "selectedId")) {
      state.selectedId = typeof next.selectedId === "string" ? next.selectedId : null;
    }
    state.zoom = clamp(finiteNumber(next.zoom, state.zoom), 1, 3);
    // The bounded pan keeps the body reachable after resize or restored view state.
    const panLimitX = 210 * (state.zoom - 1);
    const panLimitY = 390 * (state.zoom - 1);
    state.panX = clamp(finiteNumber(next.panX, state.panX), -panLimitX, panLimitX);
    state.panY = clamp(finiteNumber(next.panY, state.panY), -panLimitY, panLimitY);

    const entry = geometryGroup(state.variant, state.view);
    if (current !== entry) {
      current?.group.setAttribute("display", "none");
      entry.group.removeAttribute("display");
      current = entry;
    }

    for (const layer of LAYERS) {
      const layerGroup = entry.layers.get(layer);
      const shown = state.layers[layer];
      layerGroup.setAttribute("display", shown ? "inline" : "none");
      layerGroup.setAttribute("pointer-events", shown ? "visiblePainted" : "none");
      const opacity =
        layer === "surface"
          ? state.layers.organs
            ? 0.14
            : state.layers.skeleton
              ? 0.24
              : 1
          : layer === "skeleton" && state.layers.organs
            ? 0.68
            : 1;
      layerGroup.setAttribute("opacity", String(opacity));
    }

    for (const record of entry.paths) {
      const selected = Boolean(
        state.selectedId && record.descriptor.structureId === state.selectedId,
      );
      if (record.selected === selected) continue;
      record.selected = selected;
      record.path.setAttribute("data-selected", String(selected));
      record.path.setAttribute(
        "fill",
        selected && record.fill !== "none" ? paint(record.descriptor.tone, true) : record.fill,
      );
      record.path.setAttribute(
        "stroke",
        selected ? "var(--atlas-view-selection, #b77a22)" : record.stroke,
      );
      record.path.setAttribute(
        "stroke-width",
        String(selected ? Math.max(record.strokeWidth, 1.25) : record.strokeWidth),
      );
    }

    viewport.setAttribute(
      "transform",
      `translate(${210 + state.panX} ${390 + state.panY}) scale(${state.zoom}) translate(-210 -390)`,
    );
    element.dataset.variant = state.variant;
    element.dataset.view = state.view;
    element.dataset.zoom = String(state.zoom);
    element.dataset.selected = state.selectedId ?? "";
  }

  function handleClick(event) {
    if (destroyed || typeof onSelect !== "function") return;
    const target = event.target;
    if (!target || typeof target.closest !== "function") return;
    const path = target.closest(".atlas-view__structure[data-id]");
    if (!path || !current?.group.contains(path) || !state.layers[path.dataset.layer]) return;
    onSelect(path.dataset.id);
  }

  svg.addEventListener("click", handleClick);
  update();

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    svg.removeEventListener("click", handleClick);
    cache.clear();
    current = null;
    element.replaceChildren();
    element.remove();
  }

  return { element, update, destroy };
}
