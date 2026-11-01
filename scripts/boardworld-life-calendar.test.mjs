import assert from "node:assert/strict";
import test from "node:test";
import {
  createGame,
  getActions,
  resolveAction,
  validateState,
  getAppointmentOptions,
} from "../public/games/tc-sim-boardworld/engine.mjs";
import { EVENTS } from "../public/games/tc-sim-boardworld/content.mjs";
const option = (s, id) => getActions(s).find((a) => a.id === id);
function act(s, id, payload) {
  const original = structuredClone(s),
    r = resolveAction(s, id, payload);
  assert.equal(r.ok, true, `${id}: ${r.message}`);
  assert.deepEqual(s, original);
  assert.equal(validateState(r.state), true);
  return r.state;
}
function fixture() {
  let s = createGame({ scenario: "restart", seed: 7 });
  s.pendingEvents = [];
  s.resolvedEvents = EVENTS.map((e) => e.id);
  s.cash = 20000;
  s.bank = 20000;
  s = act(s, "apply:retail");
  s.job.performance = 70;
  s.life.employers.retail.workload = "busy";
  return s;
}
const shift = () => ({
  kind: "shift",
  npcId: "",
  subjectId: "retail",
  day: 2,
  minute: 540,
  venue: "kadikoy-work",
  duration: 60,
  repeat: "none",
});
function wait(s, at) {
  while (s.time + 60 <= at) s = act(s, "wait:60");
  while (s.time + 15 <= at) s = act(s, "wait:15");
  return s;
}

test("accepted workload reserves actual extra60minutes and pays only the completed reserved shift", () => {
  let s = act(fixture(), "career:workload:extended");
  const opts = getAppointmentOptions(s, shift());
  assert.ok(opts.slots.some((slot) => slot.minute === 540 && slot.available));
  s = act(s, "calendar:propose", shift());
  const entry = s.calendar.entries.at(-1);
  assert.equal(entry.end - entry.start, 480);
  assert.equal(s.job.earned, 0);
  s = act(s, "visit:kadikoy-work");
  s = wait(s, entry.start - 30);
  const start = s.time,
    earned = s.job.earned;
  s = act(s, `calendar:attend:${entry.id}`);
  assert.equal(s.time, entry.end);
  assert.ok(s.time - start >= 480);
  assert.equal(s.job.earned - earned, 1150);
  assert.equal(s.calendar.entries.find((e) => e.id === entry.id).status, "completed");
  assert.equal(resolveAction(s, "work").ok, false);
});

test("changed workload rejects stale shift atomically and explicit reschedule reserves the new duration", () => {
  let s = act(fixture(), "calendar:propose", shift());
  const original = s.calendar.entries.at(-1);
  assert.equal(original.end - original.start, 420);
  s = act(s, "career:workload:extended");
  assert.match(option(s, `calendar:attend:${original.id}`).reason, /süresi değişti/);
  const before = structuredClone(s),
    rejected = resolveAction(s, `calendar:attend:${original.id}`);
  assert.equal(rejected.ok, false);
  assert.strictEqual(rejected.state, s);
  assert.deepEqual(s, before);
  s = act(s, `calendar:reschedule:${original.id}`, shift());
  const revised = s.calendar.entries.at(-1);
  assert.equal(s.calendar.entries.find((e) => e.id === original.id).status, "cancelled");
  assert.equal(revised.end - revised.start, 480);
  assert.doesNotMatch(option(s, `calendar:attend:${revised.id}`).reason, /süresi değişti/);
});
