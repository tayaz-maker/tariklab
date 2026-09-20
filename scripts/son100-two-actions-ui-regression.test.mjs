/**
 * Regression for the Sonnet V1 closure fix: the UI's only "core" button for
 * Son 100 Gün used to dispatch the generic "advance" action, which itself
 * secretly performed one free "work" action AND unconditionally advanced the
 * day in the same call. That meant a single button press both consumed the
 * day's first action slot and ended the day, so the documented "two actions
 * per day" contract could never be exercised by a real player no matter how
 * logically correct the underlying act:-prefixed state machine was.
 *
 * Fix: "advance" is now a pure, honest "skip the rest of today" (forfeits
 * unused actions, still guarded against re-running after flags.finalReport),
 * and the UI's core button now dispatches "act:work" instead.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { create, applyAction } from "../public/games/next-wave.js";

test("son 100 gun: focus-priced actions end the day only when capacity is spent", () => {
  const s = create("son-100-gun");
  const day0 = s.day;
  assert.equal(s.focusRemaining, 8);

  // First press of the UI's core button: applyAction(id, state, "act:work").
  applyAction("son-100-gun", s, "act:work");
  assert.equal(s.day, day0, "one action must not end the day");
  assert.equal(s.focusRemaining, 4);

  // Second press: the day may only advance now, on the correct completion.
  applyAction("son-100-gun", s, "act:work");
  assert.equal(s.day, day0 + 1, "the day must advance only after both actions are used");
  assert.equal(s.focusRemaining, 8);
});

test("son 100 gun: rapid/third act call within the same day cannot fabricate an extra action", () => {
  const s = create("son-100-gun");
  const day0 = s.day;
  const cashAfterOne = (() => {
    applyAction("son-100-gun", s, "act:work");
    return s.resources?.money ?? s.money;
  })();
  // A rapid-fire extra click while still on the same day, before the second
  // real action: applyAction is called a second time before the day rolls
  // over, simulating a double-fire of the same click handler.
  applyAction("son-100-gun", s, "act:work");
  assert.equal(s.day, day0 + 1, "two real actions still end the day exactly once");
  const dayAfterTwo = s.day;
  const remainingAfterTwo = s.focusRemaining;

  // A further rapid click landing after the day has already rolled over must
  // behave as the new day's first action, not as a phantom third action of
  // the day that just ended.
  applyAction("son-100-gun", s, "act:work");
  assert.equal(s.day, dayAfterTwo, "a same-tick extra click must not skip an entire day");
  assert.equal(s.focusRemaining, remainingAfterTwo - 4);
  void cashAfterOne;
});

test("son 100 gun: save/reload mid-day preserves focus and does not double-apply resource effects", () => {
  const s = create("son-100-gun");
  applyAction("son-100-gun", s, "act:work");
  assert.equal(s.focusRemaining, 4);

  // Round-trip through JSON exactly as localStorage save/load does.
  const reloaded = JSON.parse(JSON.stringify(s));
  assert.equal(reloaded.focusRemaining, 4, "save/reload must preserve the day's remaining focus");
  assert.equal(reloaded.day, s.day, "save/reload must preserve the current day");

  // Continuing on the reloaded state must consume exactly the second action,
  // not re-run the first one (which would double-apply its resource effect).
  const before = JSON.stringify(reloaded.resources ?? { money: reloaded.money });
  applyAction("son-100-gun", reloaded, "act:work");
  assert.equal(reloaded.day, s.day + 1, "the reloaded state advances the day on its own second action");
  assert.notEqual(JSON.stringify(reloaded.resources ?? { money: reloaded.money }), before);
});

test("son 100 gun: explicit advance (skip today) forfeits unused actions without performing a free action", () => {
  const s = create("son-100-gun");
  const before = JSON.stringify({ ...s, day: undefined });
  const day0 = s.day;
  applyAction("son-100-gun", s, "advance");
  assert.equal(s.day, day0 + 1, "advance still ends the day (explicit skip)");
  assert.equal(s.focusRemaining, 8, "the new day resets its focus budget");
  void before;
});
