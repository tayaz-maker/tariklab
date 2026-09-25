// Pure data -> render-model boundary for the Kıyı Eşiği map. Both the SVG
// renderer (app.js) and the PixiJS renderer (map-pixi.js) build their scene
// from the exact same model, computed here from NODES/LINKS and game state.
// Nothing in this file touches the DOM or PixiJS; it only reads game state.
import { LINKS, NODES } from "./sim.js";

/**
 * @param {ReturnType<typeof import("./sim.js").createCoast>} state
 * @returns {{
 *   nodes: Array<{id: string, kind: string, x: number, y: number, tr: string, en: string, water: boolean, slope: boolean, active: boolean, fault: boolean}>,
 *   links: Array<{a: string, b: string, active: boolean, index: number}>,
 * }}
 */
export function buildMapRenderModel(state) {
  const line = state?.line || [];
  const faultId = state?.fault?.id ?? null;
  return {
    nodes: NODES.map((n) => ({
      id: n.id,
      kind: n.kind,
      x: n.x,
      y: n.y,
      tr: n.tr,
      en: n.en,
      water: !!n.water,
      slope: n.slope > 0,
      active: line.includes(n.id),
      fault: faultId === n.id,
    })),
    links: LINKS.map(([a, b], index) => ({
      a,
      b,
      index,
      active: line.includes(a) && line.includes(b),
    })),
  };
}
