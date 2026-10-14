import test from "node:test";
import assert from "node:assert/strict";
import { SAVE_VERSION, createNewGame } from "../public/games/tc-sim/js/state.js";
import { MARKET, spendLifestyle } from "../public/games/tc-sim/js/wealth.js";

function game(seed) {
  const state = createNewGame({ name: "Kumar", now: "2027-01-01T00:00:00.000Z", seed });
  state.finances.balance = 1000000;
  state.events.active = null;
  state.events.queue = [];
  state.player.age = 27;
  return state;
}

test("kaçak bahis ve kumar masası kazanır da kaybeder de; küçük kayıp çoğunlukta", () => {
  assert.equal(SAVE_VERSION, 6);
  assert.equal(MARKET.betting.cost, 1200);
  assert.equal(MARKET.casino.cost, 3500);
  for (const id of ["betting", "casino"]) {
    let wins = 0;
    let losses = 0;
    let smallLosses = 0;
    let big = 0;
    let net = 0;
    const cost = MARKET[id].cost;
    for (let seed = 1; seed <= 400; seed += 1) {
      const state = game(seed * 7919);
      const anne = state.relationships.anne;
      const stress = state.health.stress;
      const result = spendLifestyle(state, id);
      assert.equal(result.ok, true);
      assert.equal(Number.isInteger(result.payout), true);
      assert.equal(Number.isInteger(state.finances.balance), true);
      assert.equal(state.finances.balance, 1000000 - cost + result.payout);
      assert.equal(state.flags.gamblingWeeks, 1);
      assert.ok(state.health.stress >= stress);
      assert.equal(state.relationships.anne, anne);
      const cash = result.effects.cash;
      net += cash;
      if (cash > 0) wins += 1;
      if (cash < 0) losses += 1;
      if (result.payout > 0 && result.payout < cost) smallLosses += 1;
      if (result.payout >= cost * 3) big += 1;
    }
    assert.ok(wins >= 20, `${id} wins ${wins}`);
    assert.ok(losses > wins, `${id} losses ${losses} wins ${wins}`);
    assert.ok(smallLosses > losses / 2, `${id} small ${smallLosses} of ${losses}`);
    assert.ok(big > 0 && big < 40, `${id} big ${big}`);
    assert.ok(net < 0, `${id} net ${net}`);
  }
});
