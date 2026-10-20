/**
 * The first-duel guide must be short, complete in both languages, and never
 * something a player can get stuck inside.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  ONBOARDING_KEY,
  markOnboardingSeen,
  onboardingSeen,
  onboardingSteps,
  resetOnboarding,
} from "../public/games/duel-core/onboarding.js";

const NULLISH =
  /(?<![\p{L}\p{N}_])(null|undefined)(?![\p{L}\p{N}_])|(?<![\p{L}\p{N}_])NaN(?![\p{L}\p{N}_])|\[object Object\]/u;
const words = { unit: "Kadro", battle: "Tartışma" };

test("the guide stays short and every step says something", () => {
  for (const theme of ["veto-h", "gett-oh"])
    for (const lang of ["tr", "en"]) {
      const steps = onboardingSteps(theme, lang, words);
      assert.ok(steps.length >= 5 && steps.length <= 8, `${theme}/${lang}: ${steps.length} steps`);
      for (const step of steps) {
        assert.ok(step.id && step.anchor && step.title, `${theme}/${lang}: incomplete step`);
        assert.ok(step.body.length > 40, `${theme}/${lang}/${step.id}: body too thin`);
        assert.ok(!NULLISH.test(step.body + step.title), `${theme}/${lang}/${step.id}: nullish`);
      }
      assert.equal(new Set(steps.map((s) => s.id)).size, steps.length, "duplicate step ids");
    }
});

test("both languages describe the same steps, anchored to the real layout", () => {
  const tr = onboardingSteps("veto-h", "tr", words);
  const en = onboardingSteps("veto-h", "en", words);
  assert.deepEqual(
    tr.map((s) => s.id),
    en.map((s) => s.id),
  );
  assert.deepEqual(
    tr.map((s) => s.anchor),
    en.map((s) => s.anchor),
  );
  // Anchors must be parts of the board that already exist — the guide is not
  // allowed to require new chrome.
  for (const step of tr)
    assert.match(
      step.anchor,
      /^\.(hand-row|phase-strip|player-field\.player|action-dock|ledger|inspector)$/,
    );
});

test("the guide explains the action economy it is describing", () => {
  const tr = onboardingSteps("veto-h", "tr", words).find((s) => s.id === "economy");
  // If the per-turn rule changes, this copy has to change with it.
  assert.match(tr.body, /bir normal çağrı/);
  assert.match(tr.body, /bir özel çağrı/);
  assert.match(tr.body, /iki destek/);
  assert.match(tr.body, /aynı/, "it must say the opponent plays by the same rules");
});

test("seen state is remembered, resettable, and safe without storage", () => {
  const mem = new Map();
  const storage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, v),
    removeItem: (k) => mem.delete(k),
  };
  assert.equal(onboardingSeen(storage), false, "a new player sees the guide");
  markOnboardingSeen(storage);
  assert.equal(onboardingSeen(storage), true, "and not again");
  assert.equal(mem.get(ONBOARDING_KEY), "done");
  resetOnboarding(storage);
  assert.equal(onboardingSeen(storage), false, "replaying from Help brings it back");

  // A blocked store must never turn into a guide that nags on every duel.
  const blocked = {
    getItem: () => {
      throw Error("blocked");
    },
    setItem: () => {
      throw Error("blocked");
    },
    removeItem: () => {
      throw Error("blocked");
    },
  };
  assert.equal(onboardingSeen(blocked), true);
  assert.doesNotThrow(() => markOnboardingSeen(blocked));
  assert.doesNotThrow(() => resetOnboarding(blocked));
});

test("VETO-H! and GETT-OH! first-duel guides do not share a seen flag", () => {
  const mem = new Map();
  const storage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, v),
    removeItem: (k) => mem.delete(k),
  };
  markOnboardingSeen(storage, "veto-h");
  assert.equal(onboardingSeen(storage, "veto-h"), true);
  assert.equal(onboardingSeen(storage, "gett-oh"), false);
  markOnboardingSeen(storage, "gett-oh");
  resetOnboarding(storage, "veto-h");
  assert.equal(onboardingSeen(storage, "veto-h"), false);
  assert.equal(onboardingSeen(storage, "gett-oh"), true);
});

test("legacy onboarding migrates once and reset sentinel stays theme-local", () => {
  const mem = new Map([[ONBOARDING_KEY, "done"]]);
  const storage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, v),
    removeItem: (k) => mem.delete(k),
  };
  assert.equal(onboardingSeen(storage, "veto-h"), true);
  assert.equal(mem.get("tariklab.veto-h.onboarding.v1"), "done");
  resetOnboarding(storage, "veto-h");
  assert.equal(onboardingSeen(storage, "veto-h"), false);
  assert.equal(onboardingSeen(storage, "gett-oh"), true);
  assert.equal(mem.get("tariklab.gett-oh.onboarding.v1"), "done");
  mem.delete(ONBOARDING_KEY);
  assert.equal(onboardingSeen(storage, "gett-oh"), true, "migrated state survives legacy deletion");
});
