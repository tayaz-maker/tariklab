import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  createGame,
  getActions,
  loadExpansionRuntime,
  resolveAction,
} from "../public/games/tc-sim-boardworld/engine.mjs";
import { exportGame, importGame } from "../public/games/tc-sim-boardworld/persistence.mjs";
import {
  translateExpansionAction,
  localizeExpansionOutcome,
} from "../public/games/tc-sim-boardworld/expansion-ui.mjs";

const { getExpansionView } = await loadExpansionRuntime();
const languages = ["tr", "en", "pl"];

test("regional contracts and property preserve terms, money and save bytes across replay", () => {
  let state = createGame({ scenario: "restart", seed: 303, expansion: true });
  // Exact LW2 initial bytes after the additive31-district capability migration.
  // Frozen released byte preservation is tested in boardworld-lw2-save.test.mjs.
  assert.equal(
    createHash("sha256").update(exportGame(state)).digest("hex"),
    "28f77d0ecb86901dae8e10805388b78cbdfbcf54fbeb7fd3b5f47d015a56c26b",
  );
  // Prepared budget for the property and business transactions in this trace.
  state.bank = 140000;
  let replay = importGame(exportGame(state)).state;
  function terms(s) {
    return getActions(s).map((action) =>
      languages.map((lang) => {
        const translated = translateExpansionAction(action, lang);
        assert.equal(typeof translated.description, "string");
        return translated;
      }),
    );
  }
  function take(id) {
    const before = exportGame(state);
    assert.deepEqual(terms(replay), terms(state), id);
    assert.deepEqual(getExpansionView(replay), getExpansionView(state), id);
    const result = resolveAction(state, id);
    const repeated = resolveAction(replay, id);
    assert.ok(result.ok, `${id} · ${result.message}`);
    assert.equal(exportGame(state), before, id);
    assert.deepEqual(repeated, result, id);
    const bytes = exportGame(repeated.state);
    assert.equal(bytes, exportGame(result.state), id);
    replay = importGame(bytes).state;
    assert.deepEqual(replay, result.state, id);
    assert.equal(localizeExpansionOutcome(result.message, "tr"), result.message);
    for (const language of ["en", "pl"])
      assert.equal(typeof localizeExpansionOutcome(result.message, language), "string");
    state = result.state;
  }
  function follow(ids) {
    for (const id of ids) {
      while (state.pendingEvents.length)
        take(getActions(state).find((a) => a.id.startsWith("event:") && !a.disabled).id);
      for (let attempt=0; attempt<48 && getActions(state).find(a=>a.id===id)?.disabled; attempt++) {
        const event=getActions(state).find(a=>a.id.startsWith("event:")&&!a.disabled);
        take(event?.id || "wait:60");
      }
      take(id);
    }
  }

  follow([
    "economy:mortgage:istanbul:room",
    "economy:occupy:istanbul:room",
    "family:reserve",
    "family:adopt",
    "world:move:ankara",
    "district:visit:ankara:kizilay:work",
    "district:apply",
    "world:rest",
    "wait:60",
    "wait:60",
  ]);

  const before = state;
  const { firmId } = before.expansion.districts.job;
  const employer = before.expansion.economy.firms[firmId];
  const shift = getActions(before).find(({ id }) => id === "district:shift");
  assert.equal(shift.disabled, false);
  const pay = Number(/Ücret: (\d+) TL/.exec(shift.description)?.[1]);
  assert.ok(pay > 0);
  take("district:shift");
  assert.equal(state.bank - before.bank, pay);
  assert.equal(employer.cash - state.expansion.economy.firms[firmId].cash, pay);
  assert.equal(state.expansion.economy.firms[firmId].costs - employer.costs, pay);
  assert.equal(state.expansion.districts.job.shifts, before.expansion.districts.job.shifts + 1);
  assert.equal(state.flags.workDays, before.flags.workDays + 1);
  const duplicate = resolveAction(state, "district:shift");
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.state, state);
  assert.deepEqual(resolveAction(replay, "district:shift"), duplicate);

  follow([
    "district:visit:ankara:kizilay:social",
    "world:meal",
    "district:visit:ankara:cankaya:housing",
    "economy:rent:ankara:studio",
    "business:start:repair",
    "business:fund:2000",
    "world:rest",
    ...Array(5).fill("wait:60"),
    "economy:hire",
    "business:pause",
    "world:move:izmir",
    "district:visit:izmir:konak:housing",
    "economy:buy:izmir:room",
    "economy:let:izmir:room",
  ]);
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
