import assert from "node:assert/strict";
import test from "node:test";
import {
  createGame,
  getActions,
  getClock,
  getDeepView,
  getNpcLocation,
  previewAction,
  resolveAction,
  validateState,
} from "../public/games/tc-sim-boardworld/engine.mjs";
import { SCENARIOS, EVENTS } from "../public/games/tc-sim-boardworld/content.mjs";
import { exportGame, importGame } from "../public/games/tc-sim-boardworld/persistence.mjs";
import {
  DISTRICT_RULES,
  EMPLOYERS,
  NPC_PROFILES,
  FREELANCE_BRIEFS,
  BUSINESS_TYPES,
} from "../public/games/tc-sim-boardworld/deep-content.mjs";
import { STORY_CHAINS } from "../public/games/tc-sim-boardworld/life-chains.mjs";

const legal = (state) => getActions(state).filter((action) => !action.disabled);
const available = (state, id) => legal(state).some((action) => action.id === id);
function sound(state) {
  assert.equal(validateState(state), true, "all interconnected state remains valid");
  assert.equal(state.version, 2);
  for (const key of ["cash", "bank", "debt"])
    assert.ok(
      Number.isSafeInteger(state[key]) && state[key] >= 0,
      `${key} remains nonnegative integer lira`,
    );
  for (const key of ["health", "energy", "hunger", "stress"])
    assert.ok(state.player[key] >= 0 && state.player[key] <= 100, `${key} is bounded`);
  assert.ok(Number.isSafeInteger(state.time) && state.time >= 0);
}
function take(state, id) {
  const before = structuredClone(state);
  const result = resolveAction(state, id);
  assert.deepEqual(state, before, `${id} leaves input immutable`);
  assert.equal(result.ok, true, `${id}: ${result.message}`);
  sound(result.state);
  assert.ok(result.state.time >= state.time, "time cannot reverse");
  assert.ok(result.state.revision > state.revision, "accepted decisions advance revision");
  return result.state;
}
function reject(state, id) {
  const before = structuredClone(state);
  const result = resolveAction(state, id);
  assert.equal(result.ok, false, `${id} must be rejected`);
  assert.strictEqual(result.state, state, "invalid actions retain original state reference");
  assert.deepEqual(state, before);
}

// This policy uses only public actions. No dates, balances, relationships, story
// stages or needs are patched in endurance lives or their replay branches.
function workingPolicy(state, { stories = true, work = true } = {}) {
  const actions = legal(state);
  const pick = (id) => actions.find((action) => action.id === id);
  if (state.pendingEvents.length)
    return (
      actions.find((action) => action.id.startsWith("event:") && action.cost === 0) ||
      actions.find((action) => action.id.startsWith("event:"))
    );
  if (state.cash < 400 && state.bank > 0) {
    const cash = pick("withdraw:1000") || pick("withdraw:all");
    if (cash) return cash;
  }
  if (state.player.hunger < 48) {
    const food =
      pick("cook") || pick("soup") || pick("eat") || pick("snack") || pick("buy:groceries");
    if (food) return food;
  }
  const story =
    stories && actions.find((action) => action.id.startsWith("story:") && action.cost === 0);
  if (story) return story;
  if (work && !state.job && pick("apply:retail")) return pick("apply:retail");
  if (work && state.job && pick("promote")) return pick("promote");
  if (work && state.job && pick("work")) return pick("work");
  if (getClock(state).minute >= 1080 && pick("sleep")) return pick("sleep");
  if (state.player.stress > 45 || state.player.energy < 50) {
    if (pick("rest")) return pick("rest");
  }
  return pick("practice:communication") || pick("exercise") || pick("wait:60");
}

// Short focused cases may use a valid initial fixture to isolate a contract.
// They never claim to be earned progression; endurance above always starts fresh.
function focused(options = {}) {
  const state = createGame({ seed: 751, ...options });
  state.pendingEvents = [];
  state.resolvedEvents = EVENTS.map((event) => event.id);
  sound(state);
  return state;
}

test("Deep Life exposes a coherent content set and readable player decision previews", () => {
  assert.equal(DISTRICT_RULES.length, 3);
  assert.equal(EMPLOYERS.length, 7);
  assert.equal(NPC_PROFILES.length, 12);
  assert.ok(FREELANCE_BRIEFS.length >= 3);
  assert.ok(BUSINESS_TYPES.length >= 3);
  assert.ok(STORY_CHAINS.length >= 10);
  for (const collection of [
    DISTRICT_RULES,
    EMPLOYERS,
    NPC_PROFILES,
    FREELANCE_BRIEFS,
    BUSINESS_TYPES,
    STORY_CHAINS,
  ])
    assert.equal(new Set(collection.map((item) => item.id)).size, collection.length);
  const state = createGame({ seed: 88 });
  const before = structuredClone(state);
  assert.ok(getDeepView(state), "UI receives a real derived simulation view");
  for (const action of getActions(state)) {
    const preview = previewAction(state, action.id);
    assert.ok(preview && typeof preview === "object", `preview ${action.id}`);
  }
  assert.deepEqual(state, before, "views and previews never advance the world");
});

for (const scenario of SCENARIOS)
  for (const seed of [7, 2026, 91373])
    test(`${scenario.id}/${seed}: 90 complete legal days survive rent, autonomous NPC life and save replay`, () => {
      let state = createGame({ scenario: scenario.id, seed });
      const initial = structuredClone(state);
      let replay = createGame({ scenario: scenario.id, seed });
      const played = new Map();
      const moved = new Set();
      const changedProfession = new Set();
      for (let turn = 0; getClock(state).day < 91 && turn < 3500; turn++) {
        const action = workingPolicy(state);
        assert.ok(
          action,
          `legal next step on day ${getClock(state).day} at ${getClock(state).time}`,
        );
        const previous = state;
        state = take(state, action.id);
        for (const id of Object.keys(state.deep.npcs)) {
          if (state.deep.npcs[id].home !== previous.deep.npcs[id].home) moved.add(id);
          if (state.deep.npcs[id].profession !== previous.deep.npcs[id].profession)
            changedProfession.add(id);
        }
        const replayed = resolveAction(replay, action.id);
        assert.equal(replayed.ok, true, `save replay action ${action.id}`);
        replay = replayed.state;
        if (turn % 37 === 0) replay = importGame(exportGame(replay)).state;
        assert.deepEqual(state, replay, `deterministic persisted turn ${turn}`);
        played.set(action.id, (played.get(action.id) || 0) + 1);
      }
      assert.ok(getClock(state).day >= 91, "90 complete calendar days, not a patched date");
      assert.ok((played.get("work") || 0) >= 65, "income came from actual completed shifts");
      assert.ok((played.get("sleep") || 0) >= 80, "the life maintained a real daily rhythm");
      assert.equal(state.job?.id, "retail");
      assert.equal(state.job.level, 2, "both promotions were earned");
      assert.equal(played.get("promote"), 2);
      assert.equal(state.housing.arrears, 0);
      assert.ok(state.housing.dueDay > 91, "three successive rents were paid");
      assert.ok(state.flags.billsPaid >= 3, "three utility periods were paid");
      assert.ok(state.player.health >= 50, "viable play remains healthy");
      assert.ok(state.cash + state.bank > 8000, "normal work supports recurrent costs");
      assert.ok(state.resolvedEvents.length >= 10);
      const evolved = Object.keys(state.deep.npcs).filter(
        (id) => JSON.stringify(state.deep.npcs[id]) !== JSON.stringify(initial.deep.npcs[id]),
      );
      assert.equal(evolved.length, 12, "all twelve NPCs have autonomous lives");
      assert.ok(
        evolved.some((id) => state.deep.npcs[id].changes.length > 2),
        "NPCs retain autonomous history",
      );
      assert.ok(
        evolved.some((id) => state.deep.npcs[id].savings !== initial.deep.npcs[id].savings),
        "NPC income changes their own savings",
      );
      assert.ok(moved.size > 0, "an NPC independently changes home during the run");
      assert.ok(changedProfession.size > 0, "an NPC independently changes profession");
      assert.ok(
        ![...played.keys()].some((id) => id.startsWith("talk:")),
        "autonomous changes did not need player conversations",
      );
      assert.deepEqual(importGame(exportGame(state)).state, state);
    });

test("unavailable Deep Life actions and invented commands never debit or advance the world", () => {
  const state = focused();
  for (const id of [
    "routine:invented",
    "business:invented",
    "story:invented:choice",
    ...getActions(state)
      .filter((a) => a.disabled)
      .map((a) => a.id),
  ])
    reject(state, id);
  assert.equal(available(state, "work"), false);
});

function advanceToDay(state, target, options = {}) {
  for (let turns = 0; getClock(state).day < target && turns < 1200; turns++) {
    const action = workingPolicy(state, { stories: false, ...options });
    assert.ok(action, "legal action while awaiting a delayed consequence");
    state = take(state, action.id);
  }
  assert.equal(getClock(state).day, target, "no day is skipped or patched during the wait");
  return state;
}
function storyFixture() {
  let state = focused({ scenario: "restart" });
  state.cash = 100000;
  state.bank = 10000;
  state.debt = 5000;
  for (const skill of Object.keys(state.player.skills)) state.player.skills[skill] = 55;
  Object.assign(state.inventory, { laptop: 1, tools: 1, book: 1, groceries: 20 });
  sound(state);
  state = take(state, "apply:retail");
  // A fixture of an established adult life isolates all story prerequisites.
  // Every story decision, waiting interval and resulting effect below is real.
  state.time = 24 * 1440 + 480;
  sound(state);
  return take(state, "wait:60");
}
const chainRoutes = {
  "shared-roof": ["share", "inspect", "record"],
  "portfolio-bridge": ["pilot", "deliver", "publish"],
  "community-table": ["time", "organize", "network"],
  "learning-circle": ["prepare", "teach", "reference"],
  "debt-crossroads": ["disclose", "repay", "review"],
  "workplace-voice": ["discuss", "coordinate", "record"],
  "health-rhythm": ["push", "rest", "plan"],
  "new-neighborhood": ["compare", "local", "review"],
  "relationship-space": ["friend", "explain", "respect"],
  "first-customer": ["accept", "deliver", "reference"],
};

for (const [chainId, choices] of Object.entries(chainRoutes))
  test(`${chainId}: three decisions advance in authored order over real days and cannot repeat`, () => {
    let state = storyFixture();
    const started = getClock(state).day;
    const chain = STORY_CHAINS.find((entry) => entry.id === chainId);
    assert.equal(state.stories[chainId].status, "active");
    for (let stage = 0; stage < 3; stage++) {
      const id = `story:${chainId}:${choices[stage]}`;
      assert.equal(state.stories[chainId].stage, stage);
      assert.equal(state.stories[chainId].status, "active");
      const earlier = choices.slice(0, stage);
      for (const choice of earlier) reject(state, `story:${chainId}:${choice}`);
      state = take(state, id);
      const progress = state.stories[chainId];
      assert.equal(progress.stage, stage + 1);
      assert.equal(progress.history.length, stage + 1);
      assert.deepEqual(
        progress.history.map((entry) => entry.stage),
        Array.from({ length: stage + 1 }, (_, i) => i),
      );
      assert.equal(progress.history[stage].choice, choices[stage]);
      reject(state, id);
      if (stage < 2) {
        assert.equal(progress.status, "waiting");
        const due = progress.dueDay;
        assert.ok(due >= getClock(state).day + chain.steps[stage + 1].delay);
        reject(state, `story:${chainId}:${choices[stage + 1]}`);
        state = advanceToDay(state, due - 1);
        assert.equal(state.stories[chainId].status, "waiting");
        reject(state, `story:${chainId}:${choices[stage + 1]}`);
        state = advanceToDay(state, due);
        assert.equal(state.stories[chainId].status, "active");
        state = importGame(exportGame(state)).state;
      }
    }
    assert.equal(state.stories[chainId].status, "complete");
    assert.ok(state.stories[chainId].outcome.length > 20);
    assert.ok(
      getClock(state).day - started >= 10,
      "chain spans weeks or substantial parts of weeks",
    );
    const finished = structuredClone(state.stories[chainId]);
    state = advanceToDay(state, getClock(state).day + 7);
    assert.deepEqual(state.stories[chainId], finished, "completed chain does not reopen or repay");
    for (const choice of choices) reject(state, `story:${chainId}:${choice}`);
  });

for (const [chainId, paidStart, unpaidStart, delivery, reward, label] of [
  [
    "portfolio-bridge",
    "pilot",
    "learn",
    "deliver",
    1200,
    "Pilot proje · 7 gün sonra teslim ücreti",
  ],
  ["first-customer", "accept", "practice", "deliver", 650, "İlk müşteri · vadeli teslim ücreti"],
])
  test(`${chainId}: contractual payment arrives seven days after real delivery, exactly once`, () => {
    const payouts = (state) => state.transactions.filter((entry) => entry.label === label);
    let paid = storyFixture();
    let unpaid = structuredClone(paid);
    paid = take(paid, `story:${chainId}:${paidStart}`);
    unpaid = take(unpaid, `story:${chainId}:${unpaidStart}`);
    paid = advanceToDay(paid, paid.stories[chainId].dueDay);
    unpaid = advanceToDay(unpaid, unpaid.stories[chainId].dueDay);
    paid = take(paid, `story:${chainId}:${delivery}`);
    unpaid = take(unpaid, `story:${chainId}:${delivery}`);
    const due = paid.stories[chainId].dueDay;
    assert.equal(due, getClock(paid).day + 7);
    assert.equal(payouts(paid).length, 0, "delivery is not an immediate cash button");
    paid = advanceToDay(paid, due - 1);
    assert.equal(payouts(paid).length, 0);
    paid = advanceToDay(paid, due);
    assert.deepEqual(payouts(paid), [{ day: due, label, amount: reward, account: "bank" }]);
    unpaid = advanceToDay(unpaid, unpaid.stories[chainId].dueDay);
    assert.equal(
      payouts(unpaid).length,
      0,
      "practice without a paid contract cannot generate wages",
    );
    for (let i = 0; i < 6; i++) {
      paid = importGame(exportGame(paid)).state;
      paid = take(paid, "wait:60");
      assert.equal(
        payouts(paid).length,
        1,
        "load or another action cannot duplicate arrival money",
      );
    }
  });

test("malformed story progress and invented history cannot pass save validation", () => {
  for (const mutate of [
    (state) => {
      delete state.stories["shared-roof"];
    },
    (state) => {
      state.stories.ghost = structuredClone(state.stories["shared-roof"]);
    },
    (state) => {
      state.stories["shared-roof"].stage = -1;
    },
    (state) => {
      state.stories["shared-roof"].status = "complete";
    },
    (state) => {
      state.stories["shared-roof"].status = "waiting";
    },
    (state) => {
      state.stories["shared-roof"].context.job = "invented-job";
    },
    (state) => {
      state.stories["shared-roof"].extra = 1;
    },
    (state) => {
      state.stories["shared-roof"].context.extra = 1;
    },
  ]) {
    const state = focused();
    mutate(state);
    assert.equal(validateState(state), false, String(mutate));
    assert.throws(() => exportGame(state));
  }
  let state = storyFixture();
  state = take(state, "story:shared-roof:share");
  for (const mutate of [
    (entry) => {
      entry.choice = "invented-choice";
    },
    (entry) => {
      entry.stage = 2;
    },
    (entry) => {
      entry.day = getClock(state).day + 10;
    },
    (entry) => {
      entry.extra = "unknown";
    },
  ]) {
    const broken = structuredClone(state);
    mutate(broken.stories["shared-roof"].history[0]);
    assert.equal(validateState(broken), false, String(mutate));
    assert.throws(() => exportGame(broken));
  }
});

const funds = (state) => state.cash + state.bank;
const wealth = (state) => funds(state) + state.deep.finance.reserve - state.debt;

test("emergency reserves transfer real money, stay separate from spending, and cannot duplicate wealth", () => {
  let state = focused();
  state.cash = 15000;
  state.bank = 5000;
  const before = wealth(state);
  for (const amount of [500, 2000, 5000]) {
    const availableBefore = funds(state);
    state = take(state, `finance:reserve:${amount}`);
    assert.equal(funds(state), availableBefore - amount);
    assert.equal(wealth(state), before);
  }
  assert.equal(state.deep.finance.reserve, 7500);
  state = take(state, "finance:reserve-withdraw");
  assert.equal(state.deep.finance.reserve, 0);
  assert.equal(wealth(state), before);
  reject(state, "finance:reserve-withdraw");
});

test("manual rent and utility invoices become real arrears once after their grace period", () => {
  let state = focused({ scenario: "newcomer" });
  state.time = 29 * 1440 + 23 * 60;
  state.cash = 30000;
  state.bank = 0;
  state = take(state, "finance:autopay");
  const initialCash = state.cash;
  state = take(state, "wait:60");
  assert.equal(state.cash, initialCash, "turning off autopay leaves due invoices unpaid");
  const invoices = state.deep.finance.bills;
  assert.equal(invoices.filter((bill) => bill.status === "due").length, 2);
  const rent = invoices.find((bill) => bill.kind === "rent");
  const utilities = invoices.find((bill) => bill.kind === "utilities");
  assert.equal(rent.dueDay, 31);
  state = take(state, `finance:bill:${rent.id}`);
  assert.equal(state.cash, initialCash - rent.amount);
  reject(state, `finance:bill:${rent.id}`);
  state = advanceToDay(state, 38, { work: false });
  assert.equal(state.deep.finance.bills.find((bill) => bill.id === utilities.id).status, "due");
  const debtBefore = state.debt;
  state = advanceToDay(state, 39, { work: false });
  assert.equal(state.deep.finance.bills.find((bill) => bill.id === utilities.id).status, "overdue");
  assert.equal(state.debt, debtBefore + utilities.amount);
  assert.equal(state.housing.arrears, 0, "paid rent cannot also become rent arrears");
  state = advanceToDay(state, 40, { work: false });
  assert.equal(state.debt, debtBefore + utilities.amount, "overdue charge is posted once");
});

test("a debt plan pays actual principal and lowers interest; two unfunded instalments terminate it", () => {
  let funded = focused({ scenario: "restart" });
  funded.cash = 20000;
  funded.bank = 0;
  funded.debt = 10000;
  funded = take(funded, "finance:debt-plan");
  assert.equal(funded.cash, 19800, "contract fee is real");
  funded = advanceToDay(funded, 8, { work: false });
  assert.equal(funded.debt, 9000);
  assert.equal(funded.deep.finance.debtPlan.nextDay, 15);
  funded = advanceToDay(funded, 31, { work: false });
  assert.equal(funded.debt, 6120, "four real 1000 TL payments, then 2% interest on 6000");
  let unfunded = focused({ scenario: "restart" });
  unfunded.cash = 200;
  unfunded.bank = 0;
  unfunded.debt = 10000;
  unfunded = take(unfunded, "finance:debt-plan");
  unfunded = advanceToDay(unfunded, 8, { work: false });
  assert.equal(unfunded.deep.finance.debtPlan.missed, 1);
  assert.equal(unfunded.debt, 10000);
  unfunded = advanceToDay(unfunded, 15, { work: false });
  assert.equal(unfunded.deep.finance.debtPlan, null, "the second miss ends the concession safely");
  assert.equal(unfunded.debt, 10000, "failed instalments cannot erase principal");
  unfunded = advanceToDay(unfunded, 22, { work: false });
  sound(unfunded);
});

for (const brief of FREELANCE_BRIEFS)
  test(`${brief.id}: freelancing requires equipment, real sessions, delivery and a customer cooldown`, () => {
    let state = focused();
    state.cash = 20000;
    state.bank = 0;
    state.location = brief.district;
    state.player.skills[brief.skill] = brief.required;
    reject(state, `freelance:accept:${brief.id}`);
    state.inventory[brief.item] = 1;
    sound(state);
    const started = state.time;
    state = take(state, `freelance:accept:${brief.id}`);
    assert.equal(funds(state), 20000 - brief.cost);
    reject(state, "freelance:deliver");
    for (let session = 0; session < brief.sessions; session++) {
      state = take(state, "freelance:work");
      assert.equal(state.deep.freelance.active.sessions, session + 1);
    }
    assert.ok(state.time - started >= brief.sessions * brief.minutes);
    reject(state, "freelance:work");
    state = take(state, "freelance:deliver");
    assert.equal(state.deep.freelance.completed, 1);
    assert.equal(state.deep.freelance.active, null);
    assert.equal(funds(state), 20000 - brief.cost + brief.reward);
    assert.equal(state.bank, brief.reward);
    reject(state, "freelance:deliver");
    reject(state, `freelance:accept:${brief.id}`);
  });

test("missing a freelance deadline loses sunk costs and reputation without creating income", () => {
  let state = focused({ scenario: "restart" });
  state.player.skills.craft = 40;
  const beforeReputation = state.deep.freelance.reputation;
  const beforeMoney = funds(state);
  state = take(state, "freelance:accept:repair");
  assert.equal(funds(state), beforeMoney - 350);
  const deadline = state.deep.freelance.active.dueDay;
  state = advanceToDay(state, deadline + 1, { work: false });
  assert.equal(state.deep.freelance.active, null);
  assert.equal(state.deep.freelance.reputation, beforeReputation - 8);
  assert.equal(state.deep.freelance.completed, 0);
  assert.ok(!state.transactions.some((entry) => entry.label.includes("teslim ücreti")));
  reject(state, "freelance:deliver");
});

function businessFixture(district = "kadikoy") {
  const state = focused({ scenario: "restart" });
  state.cash = 50000;
  state.bank = 0;
  state.location = district;
  state.player.skills.craft = 50;
  sound(state);
  return state;
}

test("microbusiness needs capital, acquisition and labour; each service has real costs and daily limits", () => {
  let state = businessFixture();
  const startTime = state.time;
  state = take(state, "business:start:repair");
  assert.equal(funds(state), 50000 - 3600);
  reject(state, "business:serve");
  state = take(state, "business:acquire");
  assert.equal(state.deep.business.clients, 1);
  reject(state, "business:acquire");
  const before = funds(state);
  state = take(state, "business:serve");
  assert.ok(state.time - startTime >= 480, "setup, acquisition and service consume eight hours");
  assert.equal(state.deep.business.revenue, 624);
  assert.ok(state.deep.business.costs >= 3600 + 180 + 160);
  assert.equal(funds(state) - before, 624 - 160);
  reject(state, "business:serve");
  reject(state, "business:start:digital");
  reject(state, "business:upgrade");
});

test("pausing and reopening cannot erase accrued overhead or postpone its existing billing date", () => {
  let state = businessFixture();
  state = take(state, "business:start:repair");
  const due = state.deep.business.nextOverheadDay;
  state = take(state, "wait:60");
  assert.ok(state.deep.business.accruedOverhead > 0, "time in business accrues real fixed costs");
  const before = funds(state);
  state = take(state, "business:pause");
  assert.ok(funds(state) < before, "pausing settles accrued cost");
  assert.equal(state.deep.business.status, "paused");
  state = take(state, "business:pause");
  assert.equal(state.deep.business.status, "active");
  assert.equal(state.deep.business.nextOverheadDay, due, "toggle cannot reset the weekly bill");
});

test("repeated business opening and liquidation loses capital instead of manufacturing money", () => {
  let state = businessFixture();
  const before = funds(state);
  for (let i = 0; i < 3; i++) {
    state = take(state, "business:start:repair");
    state = take(state, "business:close");
    assert.equal(state.deep.business, null);
    reject(state, "business:close");
  }
  assert.ok(funds(state) <= before - 3 * (3600 - 900));
  assert.ok(state.documents.filter((entry) => entry.id.startsWith("closure-")).length === 3);
});

test("districts change actual meal prices and business economics, not just their descriptions", () => {
  const prices = {};
  const revenues = {};
  const overheads = {};
  for (const district of DISTRICT_RULES) {
    let state = businessFixture(district.id);
    prices[district.id] = getActions(state).find((action) => action.id === "eat").cost;
    state = take(state, "business:start:repair");
    overheads[district.id] = getDeepView(state).business.weeklyOverhead;
    state = take(state, "business:acquire");
    state = take(state, "business:serve");
    revenues[district.id] = state.deep.business.revenue;
  }
  assert.ok(prices.besiktas > prices.kadikoy && prices.sisli > prices.kadikoy);
  assert.ok(revenues.kadikoy > revenues.besiktas && revenues.kadikoy > revenues.sisli);
  assert.ok(overheads.kadikoy < overheads.besiktas && overheads.besiktas < overheads.sisli);
});

test("routine uses the normal resolver, obeys its time horizon and returns consequential choices", () => {
  let state = focused();
  state = take(state, "apply:retail");
  const before = structuredClone(state);
  const result = resolveAction(state, "schedule:run:1");
  assert.equal(result.ok, true);
  assert.deepEqual(state, before);
  state = result.state;
  assert.ok(state.time - before.time <= 1440, "one day never silently becomes more than 24 hours");
  assert.ok(state.deep.routine.lastActions.includes("work"));
  assert.ok(state.job.shifts > before.job.shifts);
  assert.ok(state.deep.routine.lastActions.length <= 96);
  const fresh = createGame();
  const blocked = resolveAction(fresh, "schedule:run:7");
  assert.equal(blocked.ok, false, "an unresolved initial event blocks routine admission");
  assert.equal(blocked.state.time, fresh.time);
  assert.deepEqual(blocked.state.pendingEvents, fresh.pendingEvents);
  assert.deepEqual(blocked.state, fresh);
  assert.match(blocked.message, /olay|karar/);
});

test("routine budget floor includes upcoming midnight rent and bills", () => {
  let state = focused();
  state.cash = 7000;
  state.bank = 0;
  state.time = 29 * 1440 + 18 * 60;
  state.deep.routine.budgetFloor = 3000;
  sound(state);
  const before = structuredClone(state);
  state = take(state, "schedule:run:1");
  assert.ok(funds(state) >= 3000);
  assert.ok(
    state.time < 30 * 1440,
    "automation stops before committing unaffordable midnight obligations",
  );
  assert.equal(state.housing.dueDay, before.housing.dueDay);
  assert.equal(state.deep.finance.bills.length, before.deep.finance.bills.length);
  assert.match(state.deep.routine.stopReason, /bütçe|ödeme|vade|bakiye/);
});

test("routine shopping cannot cross its budget floor or hide an unmet resource condition", () => {
  const state = focused();
  state.cash = 350;
  state.bank = 0;
  state.inventory.groceries = 0;
  state.deep.routine.budgetFloor = 300;
  const result = resolveAction(state, "schedule:run:1");
  assert.equal(result.ok, true);
  assert.equal(result.state.cash, 350);
  assert.equal(result.state.inventory.groceries, 0);
  assert.equal(result.state.time, state.time);
  assert.match(result.state.deep.routine.stopReason, /bütçe/);
});

test("work reputation, wage negotiation and notice survive a genuine change of employer", () => {
  let state = focused({ scenario: "restart" });
  state.cash = 20000;
  state.player.skills.craft = 35;
  state.player.skills.communication = 25;
  state.npcs.okan.trust = 35;
  state = take(state, "apply:retail");
  reject(state, "career:negotiate");
  state = advanceToDay(state, 22);
  assert.ok(state.job.level >= 1);
  assert.ok(state.deep.career.experience.retail >= 15);
  const withoutBonus = take(state, "work");
  const beforeNegotiation = funds(state);
  state = take(state, "career:negotiate");
  assert.equal(funds(state), beforeNegotiation, "negotiating does not immediately print wages");
  const bonus = state.deep.career.negotiatedBonus;
  assert.ok(bonus > 0);
  reject(state, "career:negotiate");
  state = take(state, "work");
  assert.equal(state.job.earned - withoutBonus.job.earned, bonus);
  state = take(state, "career:notice");
  const noticeDay = state.deep.career.noticeDay;
  reject(state, "career:notice");
  state = advanceToDay(state, noticeDay);
  const earned = state.job.earned;
  const bank = state.bank;
  const reputation = state.deep.career.reputation;
  const oldExperience = state.deep.career.experience.retail;
  state = take(state, "resign");
  assert.equal(state.bank, bank + earned, "earned wages survive resignation");
  assert.equal(state.deep.career.reputation, Math.min(100, reputation + 2));
  state = take(state, "apply:repair");
  state = take(state, "work");
  assert.equal(state.job.id, "repair");
  assert.equal(state.deep.career.experience.retail, oldExperience);
  assert.equal(state.deep.career.experience.repair, 1);
  assert.equal(
    state.deep.career.negotiatedBonus,
    0,
    "old contract's premium is not inherited by new employer",
  );
});

test("NPCs learn only disclosed facts and later hear selected information through their own ties", () => {
  let state = focused({ scenario: "restart" });
  state.time = 9 * 60;
  // Establish a nearby strong tie in a focused fixture; disclosure and all
  // later information propagation must still happen through real actions/time.
  state.deep.npcs.ece.work = "kadikoy";
  state.deep.npcs.ece.ties.mert = 80;
  sound(state);
  for (const npc of Object.values(state.deep.npcs)) assert.deepEqual(npc.knownFacts, []);
  state = take(state, "deep:disclose:mert");
  assert.ok(state.deep.npcs.mert.knownFacts.some((fact) => fact.id === "finances"));
  assert.ok(state.deep.npcs.mert.knownFacts.some((fact) => fact.id === "career"));
  for (const [id, npc] of Object.entries(state.deep.npcs))
    if (id !== "mert") assert.deepEqual(npc.knownFacts, [], `${id} is not omniscient`);
  reject(state, "deep:disclose:mert");
  state = advanceToDay(state, 6, { work: false });
  assert.equal(
    state.deep.npcs.ece.knownFacts.length,
    0,
    "social propagation waits for contact rhythm",
  );
  state = advanceToDay(state, 7, { work: false });
  const heard = state.deep.npcs.ece.knownFacts.find((fact) => fact.id === "finances");
  assert.ok(heard, "a trusted nearby contact later shares a known fact");
  assert.match(heard.source, /Mert/);
  assert.equal(heard.day, 7);
});

function promiseFixture() {
  const state = focused({ scenario: "restart" });
  state.time = 9 * 60;
  state.cash = 10000;
  state.bank = 0;
  state.npcs.mert.affinity = 40;
  state.npcs.mert.trust = 60;
  state.deep.npcs.mert.request = { kind: "help", sinceDay: 1, deadlineDay: 5 };
  sound(state);
  return state;
}

test("keeping and breaking a real help promise lead to different persistent memories and NPC resources", () => {
  let promised = take(promiseFixture(), "deep:promise:mert");
  const promise = promised.deep.promises.at(-1);
  assert.equal(promise.status, "pending");
  assert.equal(promise.dueDay, 3);
  const beforePlayer = funds(promised);
  const beforeNpc = promised.deep.npcs.mert.cash;
  const beforeSkill = promised.deep.npcs.mert.skill;
  const beforeTrust = promised.npcs.mert.trust;
  let kept = take(promised, `deep:fulfill:${promise.id}`);
  assert.equal(funds(kept), beforePlayer - 100);
  assert.equal(kept.deep.npcs.mert.cash, beforeNpc + 100);
  assert.equal(kept.deep.npcs.mert.skill, beforeSkill + 3);
  assert.equal(kept.npcs.mert.trust, beforeTrust + 10);
  assert.equal(kept.deep.promises.at(-1).status, "kept");
  reject(kept, `deep:fulfill:${promise.id}`);
  promised = advanceToDay(promised, 4, { work: false });
  assert.equal(promised.deep.promises.at(-1).status, "broken");
  assert.equal(promised.npcs.mert.trust, beforeTrust - 10);
  assert.ok(promised.deep.npcs.mert.resentment >= 10);
  assert.ok(promised.npcs.mert.memories.some((memory) => /gelmedin|tutmad/.test(memory.text)));
  assert.ok(
    promised.deep.npcs.mert.knownFacts.some(
      (fact) => fact.id === "promise" && /tutmadı/.test(fact.value),
    ),
  );
  kept = importGame(exportGame(kept)).state;
  promised = importGame(exportGame(promised)).state;
  assert.notDeepEqual(kept.deep.npcs.mert.knownFacts, promised.deep.npcs.mert.knownFacts);
});

test("NPC support arrives on the stated day from their own budget, while an unemployed NPC can fail", () => {
  const initial = promiseFixture();
  let supported = take(initial, "deep:support:mert");
  const promise = supported.deep.promises.at(-1);
  assert.equal(supported.bank, initial.bank);
  assert.equal(supported.cash, initial.cash, "a promise is not an immediate payment");
  supported = advanceToDay(supported, promise.dueDay, { work: false });
  const control = advanceToDay(initial, promise.dueDay, { work: false });
  assert.equal(supported.deep.promises.at(-1).status, "kept");
  assert.equal(
    control.deep.npcs.mert.cash - supported.deep.npcs.mert.cash,
    300,
    "support comes from actual NPC cash",
  );
  const payment = supported.transactions.find((entry) => /söz verilen destek/.test(entry.label));
  assert.equal(payment.day, promise.dueDay);
  assert.equal(payment.amount, 300);
  reject(supported, "deep:support:mert");
  let unemployed = promiseFixture();
  unemployed.time = 18 * 60;
  unemployed.deep.npcs.mert.employment = "searching";
  unemployed.deep.npcs.mert.cash = 0;
  unemployed.deep.npcs.mert.jobSearchDays = 0;
  unemployed.location = getNpcLocation(unemployed, "mert");
  sound(unemployed);
  unemployed = take(unemployed, "deep:support:mert");
  const due = unemployed.deep.promises.at(-1).dueDay;
  if (unemployed.location !== "kadikoy") unemployed = take(unemployed, "travel:kadikoy");
  unemployed = advanceToDay(unemployed, due, { work: false });
  assert.equal(unemployed.deep.promises.at(-1).status, "broken");
  assert.ok(!unemployed.transactions.some((entry) => /söz verilen destek/.test(entry.label)));
});

test("moving away and back to the same home type cannot inherit an old lease's pending maintenance", () => {
  let state = storyFixture();
  const homeId = state.housing.id;
  state = take(state, "story:shared-roof:share");
  state = advanceToDay(state, state.stories["shared-roof"].dueDay);
  state = take(state, "story:shared-roof:inspect");
  const due = state.stories["shared-roof"].dueDay;
  const oldLease = state.stories["shared-roof"].context.lease;
  let unchangedLease = structuredClone(state);
  state = take(state, "travel:besiktas");
  state = take(state, "move:studio");
  state = take(state, "travel:kadikoy");
  state = take(state, `move:${homeId}`);
  assert.equal(state.housing.id, homeId, "same catalogue type, a genuinely new signed lease");
  assert.notEqual(
    state.documents.filter((document) => document.id.startsWith("lease-")).at(-1).id,
    oldLease,
  );
  const before = state.flags.homeComfort || 0;
  state = advanceToDay(state, due);
  unchangedLease = advanceToDay(unchangedLease, due);
  assert.equal(
    state.flags.homeComfort || 0,
    before,
    "old maintenance cannot improve a different lease",
  );
  assert.equal(
    unchangedLease.flags.homeComfort || 0,
    before + 4,
    "remaining on the original lease earns the delayed benefit",
  );
});

test("resigning and rejoining the same career cannot inherit a prior contract's delayed performance", () => {
  let state = storyFixture();
  state = take(state, "story:workplace-voice:discuss");
  state = advanceToDay(state, state.stories["workplace-voice"].dueDay);
  state = take(state, "story:workplace-voice:coordinate");
  const due = state.stories["workplace-voice"].dueDay;
  const oldContract = state.stories["workplace-voice"].context.employment;
  state = take(state, "resign");
  state = take(state, "apply:retail");
  assert.equal(state.job.id, "retail");
  assert.notEqual(
    state.documents.filter((document) => document.id.startsWith("employment-")).at(-1).id,
    oldContract,
  );
  state = advanceToDay(state, due - 1);
  while (getClock(state).minute < 1080) {
    const action = workingPolicy(state, { stories: false });
    assert.ok(action);
    state = take(state, action.id);
  }
  const performance = state.job.performance;
  state = take(state, "sleep");
  assert.equal(getClock(state).day, due);
  assert.equal(state.stories["workplace-voice"].status, "active");
  assert.equal(
    state.job.performance,
    performance,
    "prior contract cannot add +5 to a new employment contract",
  );
});
