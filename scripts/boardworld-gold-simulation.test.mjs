import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createGame,
  resolveAction,
  getActions,
  getDecisionView,
  getSocietyView,
  validateState,
  migrateState,
  runCare,
  runRoutine,
  runUntilNext,
} from "../public/games/tc-sim-boardworld/engine.mjs";
import { EVENTS } from "../public/games/tc-sim-boardworld/content.mjs";
import { initCalendar, createNpcOffer } from "../public/games/tc-sim-boardworld/calendar.mjs";
import { initLiving, tickLiving } from "../public/games/tc-sim-boardworld/world-life.mjs";
import { initLife } from "../public/games/tc-sim-boardworld/life-systems.mjs";
import { initEmergent } from "../public/games/tc-sim-boardworld/emergent-life.mjs";
import {
  initFlow,
  rememberRoutineStop,
  getRoutineReport,
} from "../public/games/tc-sim-boardworld/daily-flow.mjs";
import {
  initSociety,
  tickSociety,
  societyLearn,
  societyNpcOptions,
  societyNpcOutcome,
  societyNpcWork,
  societyContact,
  getSocietySupplyPlan,
  getSocietyDistrictEffects,
  validateSociety,
} from "../public/games/tc-sim-boardworld/society-systems.mjs";
import { travelMinutes } from "../public/games/tc-sim-boardworld/city.mjs";
import { exportGame, importGame } from "../public/games/tc-sim-boardworld/persistence.mjs";
const DAY = 1440;
function fixture(at = 600, scenario = "restart") {
  const s = createGame({ scenario, seed: 2026 });
  s.pendingEvents = [];
  s.resolvedEvents = EVENTS.map((e) => e.id);
  s.time = at;
  s.cash = 20000;
  s.bank = 30000;
  s.player.hunger = 90;
  s.player.energy = 90;
  initCalendar(s);
  initLiving(s);
  initLife(s);
  initEmergent(s);
  initSociety(s);
  initFlow(s);
  assert.ok(validateState(s));
  return s;
}
function act(s, id) {
  const before = structuredClone(s),
    r = resolveAction(s, id);
  assert.ok(r.ok, id + ": " + r.message);
  assert.deepEqual(s, before);
  assert.ok(validateState(r.state), id);
  return r.state;
}
const api = {
  societyNpcOptions,
  societyNpcOutcome,
  societyNpcWork,
  societyContact,
  travelMinutes,
  playerPresent: () => false,
  memory() {},
  log() {},
  news() {},
  reveal() {},
};
const a = (s, id) => getActions(s).find((a) => a.id === id);

test("v5 to v6 upgrade preserves every stored society field without economic replay", () => {
  const envelope = JSON.parse(
    readFileSync(new URL("./fixtures/boardworld/v5-fresh-restart.json", import.meta.url), "utf8"),
  );
  const old = JSON.parse(envelope.payload),
    before = structuredClone(old);
  const next = migrateState(old);
  assert.equal(next.version, 6);
  assert.deepEqual(old, before);
  for (const [key, value] of Object.entries(old))
    if (key !== "version") assert.deepEqual(next[key], value, key);
  assert.deepEqual(migrateState(next), next);
  assert.ok(validateState(next));
});

test("an exhausted NPC actually reserves rest before discretionary career or study", () => {
  const s = fixture(5 * DAY + 540),
    n = s.deep.npcs.mert,
    x = s.living.npcs.mert;
  x.energy = 8;
  x.plan = [];
  x.nextDecisionAt = s.time + 15;
  n.employment = "searching";
  const oldCash = n.cash,
    before = structuredClone(s);
  const options = societyNpcOptions(s, "mert");
  assert.deepEqual(s, before);
  assert.ok(options.some((o) => o.kind === "rest" && o.score > 110));
  s.time += 15;
  tickLiving(s, api);
  const rest = x.plan.find((p) => p.kind === "rest");
  assert.ok(rest);
  assert.equal(rest.location, n.home);
  s.time = rest.end;
  tickLiving(s, api);
  assert.equal(x.energy, 32);
  assert.equal(n.cash, oldCash);
});

test("cash-poor NPC draws actual savings before another discretionary activity, without minting wealth", () => {
  const s = fixture(5 * DAY + 540),
    n = s.deep.npcs.mert,
    x = s.living.npcs.mert;
  n.cash = 100;
  n.savings = 1200;
  n.debt = 0;
  x.energy = 80;
  x.plan = [];
  x.nextDecisionAt = s.time + 15;
  const wealth = n.cash + n.savings;
  s.time += 15;
  tickLiving(s, api);
  const budget = x.plan.find((p) => p.kind === "budget");
  assert.ok(budget);
  s.time = budget.end;
  tickLiving(s, api);
  assert.equal(n.cash, 1300);
  assert.equal(n.savings, 0);
  assert.equal(n.cash + n.savings, wealth);
});

test("support prioritization uses a recent directly learned need, not another person's hidden wallet", () => {
  const s = fixture(8 * DAY + 600),
    n = s.deep.npcs.mert;
  n.cash = 2000;
  s.living.npcs.mert.energy = 80;
  s.living.graph.mert.ece.trust = 40;
  s.living.graph.ece.mert.owed = 0;
  s.deep.npcs.ece.cash = 0;
  const favors = () => societyNpcOptions(s, "mert").filter((o) => o.kind === "favor");
  assert.deepEqual(favors(), []);
  societyLearn(
    s,
    "mert",
    {
      id: "need:ece:9",
      topic: "finance",
      value: "Geçici destek aradığını kendisi anlattı.",
      originActorId: "ece",
      sourceActorId: "ece",
      eventAt: 8 * DAY,
      credibility: 100,
      privacy: "private",
      hops: 0,
      negative: false,
      corrected: false,
      proof: "",
      disclosed: false,
    },
    api,
  );
  assert.equal(favors().length, 1);
  const knownChoice = favors();
  s.deep.npcs.ece.cash = 50000;
  assert.deepEqual(favors(), knownChoice, "private changes cannot teach the initiator new facts");
  assert.deepEqual(getSocietyView(s).profiles.find((p) => p.id === "mert").knownFacts, []);
  n.cash = 300;
  assert.deepEqual(favors(), [], "cannot lend money it does not have");
  n.cash = 2000;
  s.time += 5 * DAY;
  assert.deepEqual(favors(), [], "stale needs do not drive perpetual lending");
});

test("the real v6 scheduler cannot turn an indirect report plus a hidden balance into a loan decision", () => {
  const s = fixture(8 * DAY + 540),
    from = s.deep.npcs.mert,
    to = s.deep.npcs.ece;
  from.cash = 2000;
  from.employment = "employed";
  from.level = 2;
  from.home = to.home;
  to.cash = 0;
  to.request = { kind: "loan", sinceDay: 9, deadlineDay: 13 };
  for (const [id, x] of Object.entries(s.living.npcs)) {
    x.plan = [];
    x.nextDecisionAt = s.time + 240;
    x.energy = 80;
    x.social = 100;
    for (const e of Object.values(s.living.graph[id])) {
      e.owed = 0;
      e.dueAt = 0;
      e.lastContactAt = s.time;
      e.conflict = 0;
    }
  }
  s.living.npcs.mert.nextDecisionAt = s.time + 15;
  s.living.graph.mert.ece.affinity = 100;
  s.living.graph.mert.ece.trust = 40;
  societyLearn(
    s,
    "mert",
    {
      id: "need:ece:9",
      topic: "finance",
      value: "Bir başkasından duyulan destek haberi.",
      originActorId: "ece",
      sourceActorId: "leyla",
      eventAt: 8 * DAY,
      credibility: 60,
      privacy: "shareable",
      hops: 1,
      disclosed: false,
    },
    api,
  );
  assert.ok(validateState(s));
  const wealthy = structuredClone(s);
  wealthy.deep.npcs.ece.cash = 50000;
  for (const state of [s, wealthy]) {
    state.time += 15;
    tickLiving(state, api);
    assert.ok(validateState(state));
    assert.ok(!state.living.npcs.mert.plan.some((p) => p.kind === "favor"));
  }
  assert.deepEqual(
    s.living.npcs.mert.plan,
    wealthy.living.npcs.mert.plan,
    "the same learned information produces the same choice regardless of the hidden wallet",
  );
  assert.equal(s.deep.npcs.mert.cash, 2000);
  assert.equal(s.deep.npcs.ece.cash, 0);
});

test("a cash-poor authored NPC can initiate a free contact without a phantom appointment or private balance disclosure", () => {
  let s = fixture(DAY + 1050);
  const n = s.deep.npcs.mert;
  for (const id of Object.keys(s.npcs)) s.society.cooldowns[id] = 2;
  s.society.cooldowns.mert = 0;
  s.society.lastInitiationDay = 1;
  s.society.lastTick = s.time - 1;
  s.npcs.mert.trust = 30;
  s.npcs.mert.affinity = 30;
  n.cash = 0;
  n.savings = 0;
  n.request = { kind: "loan", sinceDay: 2, deadlineDay: 6 };
  s.living.npcs.mert.social = 20;
  s.living.npcs.mert.plan = [];
  const cash = s.cash + s.bank,
    count = s.calendar.entries.length;
  tickSociety(s, api);
  const offer = s.society.offers[0];
  assert.equal(offer.npcId, "mert");
  assert.equal(offer.type, "contact");
  assert.equal(offer.calendarId, "");
  assert.equal(s.calendar.entries.length, count);
  assert.equal(n.cash, 0);
  assert.equal(s.cash + s.bank, cash);
  assert.ok(validateState(s));
  const view = getSocietyView(s).offers[0];
  assert.ok(view.actionIds.includes("call:mert"));
  assert.doesNotMatch(view.why, /0 TL|bakiye|50000/);
  s = act(s, "wait:15");
  s = act(s, "call:mert");
  assert.equal(s.society.offers[0].status, "accepted");
  assert.equal(s.calendar.entries.length, count);
  const row = s.society.feed.findLast((r) => r.parentId === offer.id);
  assert.equal(row.changeKey, "contactAccepted");
  assert.ok(validateSociety(s));
  const legacy = structuredClone(s);
  legacy.version = 5;
  assert.equal(validateSociety(legacy), false, "v5 schema still rejects v6 primary contact offers");
});

test("accepted free contacts never bind to an unrelated later meeting with an empty replacesId", () => {
  let s = fixture(600);
  const npcId = "mert";
  s.npcs[npcId].affinity = 50;
  s.npcs[npcId].trust = 50;
  s.deep.npcs[npcId].cash = 3000;
  let proposed;
  search: for (const day of [2, 3, 4])
    for (const minute of [1080, 1140, 1200]) {
      proposed = createNpcOffer(
        s,
        {
          kind: "meeting",
          npcId,
          subjectId: "",
          day,
          minute,
          venue: `${s.deep.npcs[npcId].home}-cafe`,
          duration: 60,
          repeat: "none",
        },
        api,
      );
      if (proposed.ok) break search;
    }
  assert.ok(proposed.ok);
  const entry = s.calendar.entries.find((e) => e.id === proposed.entryId);
  const contact = {
    id: `offer-${s.society.nextId++}`,
    npcId,
    calendarId: "",
    type: "contact",
    createdAt: s.time,
    expiresAt: s.time + DAY,
    status: "accepted",
    reason: "requestWhy",
    revised: false,
  };
  s.society.offers.push(contact, {
    ...contact,
    id: `offer-${s.society.nextId++}`,
    calendarId: entry.id,
    type: "meeting",
    status: "open",
    expiresAt: entry.start - 60,
    reason: "invitationWhy",
  });
  assert.ok(validateState(s));
  s = act(s, `calendar:accept:${entry.id}`);
  assert.equal(s.society.offers.find((o) => o.id === contact.id).calendarId, "");
  assert.equal(s.society.offers.filter((o) => o.calendarId === entry.id).length, 1);
  assert.ok(validateState(s));
});

test("a known need creates an actual scheduled NPC loan and reciprocal obligation with conserved cash", () => {
  const s = fixture(8 * DAY + 540),
    from = s.deep.npcs.mert,
    to = s.deep.npcs.ece;
  from.cash = 2000;
  to.cash = 0;
  to.debt = 0;
  from.home = to.home;
  s.living.graph.mert.ece.trust = 40;
  s.living.graph.ece.mert.owed = 0;
  for (const [id, x] of Object.entries(s.living.npcs)) {
    x.nextDecisionAt = s.time + 240;
    if (["mert", "ece"].includes(id)) {
      x.plan = [];
      x.energy = 80;
    }
  }
  s.living.npcs.mert.nextDecisionAt = s.time + 15;
  societyLearn(
    s,
    "mert",
    {
      id: "need:ece:9",
      topic: "finance",
      value: "Geçici destek gerekiyor.",
      originActorId: "ece",
      sourceActorId: "ece",
      eventAt: 8 * DAY,
      credibility: 100,
      privacy: "private",
      hops: 0,
      negative: false,
      corrected: false,
      proof: "",
      disclosed: false,
    },
    api,
  );
  const total = from.cash + to.cash;
  s.time += 15;
  tickLiving(s, api);
  const plan = s.living.npcs.mert.plan.find((p) => p.kind === "favor" && p.target === "ece");
  assert.ok(plan);
  assert.ok(
    s.living.npcs.ece.plan.some(
      (p) => p.kind === "visit" && p.target === "mert" && p.end === plan.end,
    ),
  );
  const resumed = importGame(exportGame(s)).state;
  assert.deepEqual(resumed, s, "an unsettled paired loan survives compact save/reload exactly");
  s.time = plan.end;
  resumed.time = plan.end;
  tickLiving(s, api);
  tickLiving(resumed, api);
  assert.deepEqual(resumed, s, "reload neither loses nor duplicates the paired settlement");
  assert.equal(from.cash, 1700);
  assert.equal(to.cash, 300);
  assert.equal(from.cash + to.cash, total);
  assert.equal(to.debt, 300);
  assert.equal(s.living.graph.ece.mert.owed, 300);
  assert.equal(s.living.graph.ece.mert.dueAt, s.time + 7 * DAY);
  tickLiving(s, api);
  assert.equal(to.cash, 300, "no duplicate transfer at the same boundary");
  const settled = importGame(exportGame(s)).state;
  tickLiving(settled, api);
  assert.deepEqual(settled, s, "a save after settlement cannot replay the loan a second time");
});

test("regional redistribution conserves every unit and external flow is finite and explainable", () => {
  const s = fixture();
  const d = s.society.districts;
  d.kadikoy.foodStock = 0;
  d.kadikoy.materialStock = 0;
  d.besiktas.foodStock = 140;
  d.besiktas.materialStock = 110;
  d.sisli.foodStock = 90;
  d.sisli.materialStock = 80;
  const before = structuredClone(s),
    plan = getSocietySupplyPlan(s);
  assert.deepEqual(s, before);
  for (const kind of ["food", "material"]) {
    const incoming = plan.reduce((n, p) => n + p[kind + "TransferredIn"], 0);
    const outgoing = plan.reduce((n, p) => n + p[kind + "TransferredOut"], 0);
    assert.equal(incoming, outgoing);
    assert.ok(incoming > 0);
    const initial = Object.values(d).reduce((n, p) => n + p[kind + "Stock"], 0);
    const outside = plan.reduce((n, p) => n + p[kind + "In"] - p[kind + "Out"], 0);
    assert.equal(
      plan.reduce((n, p) => n + p[kind], 0),
      initial + outside,
    );
    assert.ok(plan.every((p) => Number.isInteger(p[kind]) && p[kind] >= 0));
  }
  assert.deepEqual(JSON.parse(JSON.stringify(plan)), plan);
});

test("midnight applies the public supply calculation once and never changes an individual's wallet", () => {
  const s = fixture(6 * DAY + 1380);
  s.society.districts.kadikoy.materialStock = 2;
  s.society.districts.besiktas.materialStock = 115;
  const before = structuredClone(s),
    prediction = getSocietySupplyPlan(s);
  s.time = 7 * DAY;
  tickSociety(s, api);
  for (const p of prediction) {
    const d = s.society.districts[p.id];
    assert.equal(d.foodStock, p.food);
    assert.equal(d.materialStock, p.material);
    assert.equal(d.history.at(-1).materialIn, p.materialIn + p.materialTransferredIn);
    assert.equal(d.history.at(-1).materialOut, p.materialOut + p.materialTransferredOut);
  }
  for (const key of ["cash", "bank", "debt", "npcs", "deep", "transactions"])
    assert.deepEqual(s[key], before[key], key);
  const once = structuredClone(s.society);
  tickSociety(s, api);
  assert.deepEqual(s.society, once);
});

test("depleted food and material change their own real price immediately, within the existing cap", () => {
  let s = fixture(540);
  const base = a(s, "buy:groceries").cost;
  s.society.districts.kadikoy.foodStock = 3;
  const priced = a(s, "buy:groceries");
  assert.ok(priced.cost > base);
  assert.equal(priced.societyCost.pricePct, 107);
  const before = s.cash;
  s = act(s, "buy:groceries");
  assert.equal(s.cash, before - priced.cost);
  assert.equal(s.society.districts.kadikoy.foodStock, 2);
  s = act(s, "business:start:repair");
  s = act(s, "business:fund:2000");
  s.society.districts.kadikoy.materialStock = 3;
  const stock = a(s, "business:stock:3"),
    capital = s.living.enterprise.capital;
  s = act(s, stock.id);
  assert.equal(s.living.enterprise.capital, capital - stock.societyCost.amount);
  assert.equal(s.society.districts.kadikoy.materialStock, 0);
  assert.equal(a(s, stock.id).disabled, true);
  assert.ok(getSocietyDistrictEffects(s, "kadikoy").stockPricePct <= 110);
});

test("clinic capacity affects the next real service before the weekly update and keeps care reachable", () => {
  let s = fixture();
  s.location = "sisli";
  s.player.health = 15;
  s.society.districts.sisli.serviceUsed = 15;
  const before = s.time,
    clinic = a(s, "clinic");
  assert.equal(clinic.minutes, 105);
  s = act(s, clinic.id);
  assert.equal(s.time, before + 105);
  assert.ok(s.player.health > 15);
  assert.equal(a(s, "clinic").minutes, 110);
});

test("public district forecasts never reveal private NPC balances or decisions", () => {
  const s = fixture(),
    before = getSocietyView(s).districts;
  s.deep.npcs.mert.cash = 0;
  s.deep.npcs.ece.savings = 900000;
  s.deep.npcs.leyla.home = "sisli";
  assert.deepEqual(getSocietyView(s).districts, before);
  for (const d of before) {
    assert.equal(d.nextDeliveryAt, DAY);
    assert.ok(d.nextDelivery.food >= 0 && d.nextStock.food >= 0);
  }
});

test("meal recovery points to the actual home and preserves policy, while appointment recovery targets only the real commitment", () => {
  const s = fixture();
  s.location = "sisli";
  s.player.hunger = 30;
  rememberRoutineStop(s, "meal", "Öğün için eve dön.", 0);
  const choices = getDecisionView(s).routine.actionIds;
  assert.ok(choices.includes("travel:kadikoy") || choices.includes("walk:kadikoy"));
  assert.equal(s.emergent.policy.meal, "home");
  // Use descriptors to audit routing independently of calendar command setup.
  const r = structuredClone(s);
  r.calendar.entries = [
    {
      id: "cal-real",
      status: "confirmed",
      district: "besiktas",
      venue: "besiktas-cafe",
      start: r.time + 30,
      end: r.time + 90,
    },
  ];
  rememberRoutineStop(r, "appointment", "Randevun yaklaşıyor.", 0);
  const actions = [
    "visit:sisli-park",
    "visit:besiktas-cafe",
    "travel:besiktas",
    "calendar:cancel:cal-other",
    "calendar:cancel:cal-real",
  ].map((id) => ({ id, disabled: false }));
  const view = getDecisionView(r, { actions });
  assert.deepEqual(view.routine.actionIds, [
    "visit:besiktas-cafe",
    "travel:besiktas",
    "calendar:cancel:cal-real",
  ]);
});

for (const scenario of ["graduate", "newcomer", "restart"])
  test(`real maintenance batching and manual replay are economically and socially identical (${scenario})`, () => {
    const s = fixture(600, scenario);
    s.player.hunger = 30;
    s.player.energy = 30;
    s.inventory.groceries = 6;
    s.deep.routine.settings = { work: false, study: false, shopping: true };
    const result = runCare(s);
    assert.ok(result.ok);
    assert.ok(result.actions.length > 0);
    let replay = s;
    for (const id of result.actions) replay = act(replay, id);
    for (const key of [
      "time",
      "rng",
      "cash",
      "bank",
      "debt",
      "player",
      "npcs",
      "calendar",
      "city",
      "inventory",
      "transactions",
      "deep",
      "living",
      "life",
      "society",
      "stories",
    ])
      assert.deepEqual(result.state[key], replay[key], key);
  });

test("weekly routine and next-event batching preserve manual action outcomes", () => {
  for (const run of [runRoutine, runUntilNext]) {
    const s = fixture(5 * DAY + 600);
    s.deep.routine.settings = { work: false, study: false, shopping: false };
    s.emergent.policy.practice = "none";
    s.emergent.policy.businessService = false;
    const result = run(s);
    assert.ok(result.ok);
    let replay = s;
    if (run === runRoutine) for (const id of result.actions) replay = act(replay, id);
    else {
      while (replay.time + 60 <= result.state.time) replay = act(replay, "wait:60");
      while (replay.time + 15 <= result.state.time) replay = act(replay, "wait:15");
      assert.equal(replay.time, result.state.time, "same legal wait durations reach the boundary");
    }
    for (const key of [
      "time",
      "rng",
      "cash",
      "bank",
      "debt",
      "player",
      "npcs",
      "calendar",
      "city",
      "inventory",
      "transactions",
      "society",
      "living",
      "life",
      "stories",
    ])
      assert.deepEqual(result.state[key], replay[key], `${run.name}/${key}`);
    assert.ok(validateState(result.state));
    if (run === runRoutine) {
      const report = getRoutineReport(result.state);
      assert.equal(report.total, result.actions.length);
      assert.deepEqual(report.actionIds, result.actions);
      assert.equal(report.strategicDecisions, 0);
      assert.equal(
        report.total,
        ["maintenance", "work", "education", "enterprise", "travel", "waiting", "other"].reduce(
          (n, k) => n + report[k],
          0,
        ),
      );
    }
  }
});
