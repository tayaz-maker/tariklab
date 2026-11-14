import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  createGame,
  getActions,
  loadExpansionRuntime,
  resolveAction,
} from "../public/games/tc-sim-boardworld/engine.mjs";
import { exportGame } from "../public/games/tc-sim-boardworld/persistence.mjs";
import {
  translateExpansionAction,
  localizeExpansionOutcome,
} from "../public/games/tc-sim-boardworld/expansion-ui.mjs";

const { getExpansionView } = await loadExpansionRuntime();
const languages = ["tr", "en", "pl"];

test("regional consolidation preserves action order, terms, results and save bytes", () => {
  let state = createGame({ scenario: "restart", seed: 303, expansion: true });
  state.bank = 140000;
  const replay = createHash("sha256");
  function record(value) {
    replay.update(JSON.stringify(value) + "\n");
  }
  function take(id) {
    const actions = getActions(state);
    const before = exportGame(state);
    record(before);
    record(getExpansionView(state));
    record(
      actions.map((action) =>
        languages.map((lang) => {
          const { description, ...terms } = translateExpansionAction(action, lang);
          assert.equal(typeof description, "string");
          return terms;
        }),
      ),
    );
    const result = resolveAction(state, id);
    assert.ok(result.ok, `${id} · ${result.message}`);
    assert.equal(exportGame(state), before);
    record(result.message);
    assert.equal(localizeExpansionOutcome(result.message, "tr"), result.message);
    for (const language of ["en", "pl"])
      assert.equal(typeof localizeExpansionOutcome(result.message, language), "string");
    state = result.state;
  }

  while (state.pendingEvents.length)
    take(getActions(state).find((a) => a.id.startsWith("event:") && !a.disabled).id);
  for (const id of [
    "economy:mortgage:istanbul:room",
    "economy:occupy:istanbul:room",
    "family:reserve",
    "family:adopt",
    "world:move:ankara",
    "world:shift",
    "world:meal",
    "world:rest",
    "economy:rent:ankara:studio",
    "business:start:repair",
    "business:fund:2000",
    "economy:hire",
    "business:pause",
    "world:move:izmir",
    "economy:buy:izmir:room",
    "economy:let:izmir:room",
  ])
    take(id);
  record(exportGame(state));
  // Captured from the unchanged recovery baseline at 9626ee6b.
  assert.equal(
    replay.digest("hex"),
    "1a8927e854f34fa80fd705b3062dfd116546614103835d8a6fcc2e47de090c60",
  );
});

test("concise regional descriptions retain financial terms and regional effects in all locales", () => {
  let state = createGame({ scenario: "restart", seed: 303, expansion: true });
  while (state.pendingEvents.length) {
    const opening = getActions(state).find((a) => a.id.startsWith("event:") && !a.disabled);
    state = resolveAction(state, opening.id).state;
  }
  const actions = getActions(state);
  const mortgage = actions.find(({ id }) => id === "economy:mortgage:istanbul:room");
  const title = actions.find(({ id }) => id === "economy:buy:istanbul:room");
  assert.ok(title.cost > 0);
  assert.equal(mortgage.cost, Math.ceil(title.cost * 0.25));
  const translated = languages.map((lang) => translateExpansionAction(mortgage, lang));
  for (const [index, words] of [
    [/Aylık/, /faiz/, /anapara/, /tasfiye/],
    [/Monthly/, /interest/, /principal/, /Foreclosure|foreclosure/],
    [/Miesięcznie/, /odsetek/, /kapitału/, /przejęcie/],
  ].entries()) {
    assert.equal(translated[index].cost, mortgage.cost);
    assert.match(translated[index].description, /peşinat|deposit|wkład własny/);
    assert.match(translated[index].description, /0[.,]8%|%0,8/);
    assert.match(translated[index].description, /4%|%4/);
    for (const word of words) assert.match(translated[index].description, word);
  }

  const move = getActions(state).find(({ id }) => id === "world:move:ankara");
  for (const [lang, words] of [
    ["tr", [/aile/, /borç/, /mülk/]],
    ["en", [/Family/, /debts/, /property/]],
    ["pl", [/rodzinę/, /długi/, /nieruchomości/]],
  ]) {
    const { description } = translateExpansionAction(move, lang);
    for (const word of words) assert.match(description, word);
  }
});
