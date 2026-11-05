import { draw } from "./random.ts";
/** Stable identity, independent of array ordering and random draw call order.
 * Derived fields need no save migration. Animation may read phase, never write physics. */
export type NpcMovementTraits = {
  scheduleOffset: number;
  speed: number;
  phase: number;
  decisionOffset: number;
  socialVenue: number;
};
export function npcMovementTraits(seed: number, id: string): NpcMovementTraits {
  let identity = 2166136261;
  for (const c of id) identity = Math.imul(identity ^ c.charCodeAt(0), 16777619);
  return {
    scheduleOffset: (draw(seed, 1101, 0, identity) % 91) - 30,
    speed: (80 + (draw(seed, 1102, 0, identity) % 46)) / 100,
    phase: (draw(seed, 1103, 0, identity) % 1000) / 1000,
    decisionOffset: draw(seed, 1104, 0, identity) % 20,
    socialVenue: draw(seed, 1105, 0, identity) % 4,
  };
}
