/** Independent Gold-preparation policies: every change uses a public action. */
import { getActions } from "../public/games/tc-sim-boardworld/engine.mjs";
import { selectEmergentLifeAction } from "./boardworld-emergent-scenarios.mjs";

export const GOLD_STARTS = ["newcomer", "graduate", "restart"];
export const GOLD_STRATEGIES = ["career", "social", "entrepreneur"];
export const GOLD_SEEDS = [2026, 91373];

// The released entrepreneur policy assumed restart's earned craft skill/tools.
// Other origins first earn a qualification and startup savings through retail;
// they give notice and resign explicitly before becoming full-time proprietors.
export function selectGoldLifeAction(state, strategy, memory = {}) {
  if (strategy !== "entrepreneur" || state.deep.business)
    return selectEmergentLifeAction(state, strategy, memory);
  const actions = getActions(state),
    available = actions.filter((a) => !a.disabled),
    pick = (id) => available.find((a) => a.id === id),
    base = selectEmergentLifeAction(state, "career", memory),
    day = Math.floor(state.time / 1440) + 1;
  if (
    state.pendingEvents.length ||
    /^(calendar:|withdraw:|cook$|eat$|soup$|snack$|buy:groceries|story:)/.test(base?.id || "")
  )
    return base;
  const ready = state.player.skills.craft >= 35 && state.cash + state.bank >= 8000;
  if (ready && !state.inventory.tools) {
    const buy = pick("buy:tools"),
      descriptor = actions.find((a) => a.id === "buy:tools");
    if (buy) return buy;
    if (descriptor && state.cash < descriptor.cost)
      return pick("withdraw:1000") || pick("withdraw:all") || base;
  }
  if (ready && state.inventory.tools) {
    if (state.job) {
      if (!state.deep.career.noticeDay && pick("career:notice")) return pick("career:notice");
      if (state.deep.career.noticeDay && day >= state.deep.career.noticeDay && pick("resign"))
        return pick("resign");
      return base;
    }
    const start = pick("business:start:repair"),
      descriptor = actions.find((a) => a.id === "business:start:repair");
    if (start) return start;
    if (descriptor && state.cash < descriptor.cost)
      return pick("withdraw:1000") || pick("withdraw:all") || base;
  }
  return base;
}
