import assert from "node:assert/strict";
import { createNewGame } from "../public/games/tc-sim/js/state.js";
import { acceptJobOffer } from "../public/games/tc-sim/js/life.js";
import { advanceWeek } from "../public/games/tc-sim/js/time.js";

export function readyJobStartState() {
  const state = createNewGame({ seed: 31, now: "2027-01-01T00:00:00.000Z" });
  state.career.jobId = null;
  state.events.active = null;
  state.events.queue = [];
  assert.equal(acceptJobOffer(state, "market").ok, true);
  assert.equal(state.weekly.used, 1, "offer acceptance pays its existing focus cost");
  assert.equal(advanceWeek(state).ok, true);
  assert.equal(state.events.active.eventId, "job_start");
  return state;
}
