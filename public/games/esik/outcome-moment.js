import { nodeById } from "./sim.js";

/** Ephemeral presentation data only; never enters a save or changes rules. */
export function buildCoastOutcome(before, after, move) {
  if (!before || !after || before === after) return null;
  const kind = move.startsWith("bagla:") ? "link" : move.startsWith("rampa:") ? "ramp" : move === "kapat" ? "period" : "wait";
  const nodeId = kind === "link" ? move.slice(6) : kind === "ramp" ? move.slice(6) : null;
  const node = nodeId ? nodeById(nodeId) : null;
  return {
    kind,
    nodeId,
    nodeName: node ? { tr: node.tr, en: node.en } : null,
    terrain: node?.water ? "water" : node?.kind === "stair" || node?.kind === "slope" ? "slope" : "land",
    period: before.period,
    deltas: {
      resource: after.resource - before.resource,
      trust: after.trust - before.trust,
      risk: after.risk - before.risk,
      access: after.access - before.access,
    },
    fault: after.fault?.reason || null,
    delayed: after.pending.length > before.pending.length,
    ending: after.ending || null,
  };
}
