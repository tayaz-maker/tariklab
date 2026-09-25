// PixiJS scene for the Kıyı Eşiği coastal map. Consumes the same render
// model as the SVG fallback (map-model.js) and mirrors its visual language
// (node box colours, dashed water/slope strokes, twin highlight line on an
// active link). Static scene: nothing here animates, so the shared adapter
// renders once per `update()` call and the ticker stays stopped.
import { mountPixiScene } from "../shared/pixi-adapter.js";

const VIEW_W = 320;
const VIEW_H = 260;
const COLORS = {
  water: 0x12343a,
  boxOn: 0x1d3a32,
  boxOff: 0x17211c,
  strokeFault: 0xe0b15a,
  strokeNode: 0xd7c7a2,
  label: 0xf3ead7,
  lineIdle: 0x6d7c74, // matches .line-idle in style.css
  lineActive: 0xe7d7a8, // matches .line-active in style.css
  lineTwin: 0x2f6f62,
};

function drawWater(g) {
  g.moveTo(0, 168)
    .bezierCurveTo(40, 150, 80, 190, 140, 176)
    .bezierCurveTo(190, 164, 230, 196, 320, 170)
    .lineTo(320, 260)
    .lineTo(0, 260)
    .closePath()
    .fill(COLORS.water);
}

function drawLinks(g, model, by) {
  for (const link of model.links) {
    const a = by[link.a];
    const b = by[link.b];
    if (link.active) {
      g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: 4, color: COLORS.lineActive });
      const dx = b.y - a.y;
      const dy = a.x - b.x;
      const len = Math.hypot(dx, dy) || 1;
      const ox = (dx / len) * 4;
      const oy = (dy / len) * 4;
      g.moveTo(a.x + ox, a.y + oy)
        .lineTo(b.x + ox, b.y + oy)
        .stroke({ width: 1.5, color: COLORS.lineTwin });
    } else {
      const dash = link.index % 2 ? [2, 6] : [8, 5];
      dashedLine(g, a.x, a.y, b.x, b.y, dash, { width: 2, color: COLORS.lineIdle });
    }
  }
}

// PixiJS's Graphics stroke has no native dash-pattern option; approximate
// the SVG `stroke-dasharray` by drawing short segments along the line.
function dashedLine(g, x1, y1, x2, y2, pattern, style) {
  const [on, off] = pattern;
  const len = Math.hypot(x2 - x1, y2 - y1);
  const ux = (x2 - x1) / (len || 1);
  const uy = (y2 - y1) / (len || 1);
  let pos = 0;
  let draw = true;
  while (pos < len) {
    const step = draw ? on : off;
    const next = Math.min(pos + step, len);
    if (draw) g.moveTo(x1 + ux * pos, y1 + uy * pos).lineTo(x1 + ux * next, y1 + uy * next);
    pos = next;
    draw = !draw;
  }
  g.stroke(style);
}

// Traces the four straight edges of the node box as dashes -- matches the
// SVG renderer's `stroke-dasharray` on the whole rect outline (the small
// corner radius is not worth dashing separately at this size).
function dashedBoxOutline(g, w, h, pattern, style) {
  const x = -w / 2;
  const y = -h / 2;
  dashedLine(g, x, y, x + w, y, pattern, style);
  dashedLine(g, x + w, y, x + w, y + h, pattern, style);
  dashedLine(g, x + w, y + h, x, y + h, pattern, style);
  dashedLine(g, x, y + h, x, y, pattern, style);
}

function drawNode(PIXI, node, lang) {
  const c = new PIXI.Container();
  c.x = node.x;
  c.y = node.y;
  const g = new PIXI.Graphics();
  g.roundRect(-16, -14, 32, 22, 3).fill(node.active ? COLORS.boxOn : COLORS.boxOff);
  const strokeColor = node.fault ? COLORS.strokeFault : COLORS.strokeNode;
  const style = { width: 1, color: strokeColor };
  if (node.water) dashedBoxOutline(g, 32, 22, [2, 2], style);
  else if (node.slope) dashedBoxOutline(g, 32, 22, [6, 3], style);
  else g.roundRect(-16, -14, 32, 22, 3).stroke(style);
  c.addChild(g);
  if (node.kind === "stair") {
    const steps = new PIXI.Graphics();
    for (const step of [0, 1, 2]) steps.moveTo(-8, -4 + step * 4).lineTo(8, -4 + step * 4);
    steps.stroke({ width: 1, color: COLORS.label });
    c.addChild(steps);
  }
  const label = new PIXI.Text({
    text: node[lang] || node.tr,
    style: { fill: COLORS.label, fontSize: 10, fontFamily: "system-ui, sans-serif" },
  });
  label.anchor.set(0.5, 0);
  label.y = 22;
  c.addChild(label);
  return c;
}

/**
 * Mounts (or, if `scene` is passed, rebuilds) the coast map as a PixiJS
 * scene. Returns the scene handle (`{app, update, destroy}`) or null if
 * PixiJS is unavailable/failed — the caller must fall back to `mapSvg()`.
 */
export async function mountCoastPixi({ container, model, lang }) {
  let layer;
  const handle = await mountPixiScene({
    container,
    width: VIEW_W,
    height: VIEW_H,
    build({ app, PIXI }) {
      layer = new PIXI.Container();
      app.stage.addChild(layer);
      paint(PIXI, layer, model, lang);
    },
  });
  if (!handle) return null;
  return {
    app: handle.app,
    update(nextModel, nextLang) {
      layer.removeChildren();
      paint(handle.PIXI, layer, nextModel, nextLang ?? lang);
      handle.render();
    },
    destroy: handle.destroy,
  };
}

function paint(PIXI, layer, model, lang) {
  const water = new PIXI.Graphics();
  drawWater(water);
  layer.addChild(water);
  const links = new PIXI.Graphics();
  const by = Object.fromEntries(model.nodes.map((n) => [n.id, n]));
  drawLinks(links, model, by);
  layer.addChild(links);
  for (const node of model.nodes) layer.addChild(drawNode(PIXI, node, lang));
}

export const VIEWBOX = { width: VIEW_W, height: VIEW_H };
