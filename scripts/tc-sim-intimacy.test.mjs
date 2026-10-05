import test from "node:test";
import assert from "node:assert/strict";
import { createNewGame, assertValidState } from "../public/games/tc-sim/js/state.js";
import { chooseIntimacy, intimacyAvailability, processIntimacyFollowup } from "../public/games/tc-sim/js/intimacy.js";

function adultPartner(seed = 1) {
  const state = createNewGame({ seed });
  const elif = state.people.find((person) => person.id === "elif");
  state.social.currentPartnerNpcId = "elif";
  elif.social.romanceStatus = "partner";
  elif.social.trust = 80;
  elif.social.tension = 0;
  return state;
}

test("adult intimacy needs a trusted adult partner and time", () => {
  const state = adultPartner();
  assert.equal(intimacyAvailability(state, "condom").ok, true);
  state.player.age = 17;
  assert.equal(intimacyAvailability(state, "condom").ok, false);
  state.player.age = 18;
  state.weekly.used = 8;
  assert.equal(intimacyAvailability(state, "condom").ok, false);
});

test("condom choice records a consensual decision without pregnancy follow-up", () => {
  const state = adultPartner();
  assert.equal(chooseIntimacy(state, "condom").ok, true);
  assert.equal(state.weekly.used, 1);
  assert.equal(state.finances.ledger.at(-1).amount, -120);
  assert.equal(state.flags.intimacyFollowup, undefined);
  assert.equal(chooseIntimacy(state, "without_condom").ok, false);
  assert.doesNotThrow(() => assertValidState(state));
});

test("unprotected choice has a delayed, deterministic result and valid state", () => {
  const state = adultPartner(7);
  assert.equal(chooseIntimacy(state, "without_condom").ok, true);
  assert.equal(processIntimacyFollowup(state), "");
  state.time.absoluteWeek += 4;
  const result = processIntimacyFollowup(state);
  assert.ok(result.includes("Gebelik"));
  assert.equal(state.flags.intimacyFollowup, undefined);
  assert.doesNotThrow(() => assertValidState(state));
});

test("an unprotected adult path can enter the existing pregnancy and birth chain", () => {
  const state = adultPartner(7);
  state.player.gender = "man";
  assert.equal(chooseIntimacy(state, "without_condom").ok, true);
  state.meta.rngState = 6;
  state.time.absoluteWeek += 4;
  const result = processIntimacyFollowup(state);
  assert.match(result, /Gebelik haberi/);
  assert.equal(state.parenthood.pregnancy?.otherParentId, "elif");
  assert.ok(state.openCases.some((item) => item.type === "parenting-followup"));
  assert.doesNotThrow(() => assertValidState(state));
});
