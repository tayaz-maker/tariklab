import type { WorldState } from "../domain/types.ts";
import { readTransactionBits } from "./ledger.ts";
import { compactLegacyMeals } from "./meal-membership.ts";
/** Deterministic transform of an explicitly owned world. Call only AFTER the
 * predecessor journal has been replayed and validated under its original rules.
 * No schema, engine version, economy, positions or unrelated flags are changed.
 * The caller owns the schema boundary and persistence transaction. */
export function compactMealMemberships(ownedWorld: WorldState): WorldState {
  compactLegacyMeals(ownedWorld.flags, readTransactionBits);
  return ownedWorld;
}
