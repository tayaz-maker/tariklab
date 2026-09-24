// TC SIM decision network: commitment and neglect carry across weeks, the week
// plan shows goal / pressure / opportunity / consequence chain, no single route wins.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createNewGame } from "../public/games/tc-sim/js/state.js";
import { advanceWeek, applyDecision, canApplyDecision } from "../public/games/tc-sim/js/time.js";
import {
  DECISION_LINKS,
  STREAK_PAYOFF,
  PAYOFF_COOLDOWN,
  NEGLECT,
  currentGoal,
  decisionTags,
  ensureDecisionNetwork,
  payoffWait,
  processDecisionNetworkWeek,
  weekPlan,
} from "../public/games/tc-sim/js/decision-network.js";

function clearEvents(s) {
  s.events.active = null;
  s.events.queue = [];
}
// Scripted weeks skip the narrative events a decision may open; the network
// itself is what is under test here.
function week(s, ids) {
  for (const id of ids) {
    if (canApplyDecision(s, id).ok) applyDecision(s, id);
    clearEvents(s);
  }
  advanceWeek(s);
  clearEvents(s);
}

test("old saves start with an empty network; bad fields are dropped, not trusted", () => {
  const s = createNewGame({ name: "A", seed: 3 });
  delete s.decisionNetwork;
  const net = ensureDecisionNetwork(s);
  assert.equal(net.streak, 0);
  assert.equal(net.goalId, null);
  assert.deepEqual(net.chain, []);
  s.decisionNetwork = {
    streak: 99,
    goalId: 4,
    tended: { iliski: 10_000 },
    chain: [{ text: 1 }, { week: 2, text: "ok" }],
    nextPayoff: 10_000,
    extra: true,
  };
  const n2 = ensureDecisionNetwork(s);
  assert.equal(n2.streak, STREAK_PAYOFF);
  assert.equal(n2.goalId, null);
  assert.ok(n2.tended.iliski <= s.time.absoluteWeek, "no tending in the future");
  assert.deepEqual(n2.chain, [{ week: 2, text: "ok" }]);
  assert.ok(n2.nextPayoff <= s.time.absoluteWeek + PAYOFF_COOLDOWN, "no cooldown past one quarter");
  assert.equal("extra" in n2, false);
  assert.equal(ensureDecisionNetwork(s), n2, "normalised in place: one shared object");
});

test("every decision is linked to its areas and at least one long-term arc", () => {
  for (const [id, link] of Object.entries(DECISION_LINKS)) {
    assert.ok(Array.isArray(link.arcs) && link.arcs.length, id);
    assert.ok(
      ["para", "iliski", "enerji"].some((d) => link[d]),
      `${id} touches a resource`,
    );
  }
});

test("commitment: three weeks on the current goal pay once, then wait a quarter", () => {
  const s = createNewGame({ name: "A", seed: 7 });
  const goal = currentGoal(s);
  assert.equal(goal.arc, "career");
  const perf = s.career.performance;
  week(s, ["overtime"]);
  week(s, ["overtime"]);
  assert.equal(s.decisionNetwork.streak, 2);
  const plan = weekPlan(s, {});
  assert.match(plan.opportunity, /taahhüt karşılık verir/);
  const tags = decisionTags(s, "overtime");
  assert.deepEqual(
    tags.find((t) => t.domain === "hedef"),
    { domain: "hedef", sign: 1, carry: "3/3" },
  );
  week(s, ["overtime"]);
  assert.equal(s.decisionNetwork.streak, 0);
  assert.ok(s.decisionNetwork.chain.some((x) => /iş yükünü hafifletti/.test(x.text)));
  assert.ok(
    s.career.performance <= perf + 12,
    "the payoff is relief, not a permanent performance bonus",
  );
  // A quarter must pass before commitment pays again: no route farms it weekly.
  // The close ran on the week that just ended, so a full quarter less that week remains.
  assert.equal(payoffWait(s), PAYOFF_COOLDOWN - 1);
  assert.equal(weekPlan(s, {}).goal.wait, PAYOFF_COOLDOWN - 1);
  const paid = () =>
    s.decisionNetwork.chain.filter((x) => /iş yükünü hafifletti/.test(x.text)).length;
  for (let i = 0; i < 4; i += 1) week(s, ["overtime"]);
  assert.equal(paid(), 1, "no second payoff inside the cooldown");
  assert.match(decisionTags(s, "overtime").find((t) => t.domain === "hedef").carry, /hf$/);
  week(s, ["rest"]);
  assert.equal(s.decisionNetwork.streak, 0, "a week away from the goal breaks the run");
  assert.ok(s.decisionNetwork.chain.some((x) => /seri bu hafta kesildi/.test(x.text)));
});

test("neglect: weeks without your people cost closeness; tending them stops it", () => {
  const s = createNewGame({ name: "A", seed: 11 });
  const start = { anne: s.relationships.anne, mehmet: s.relationships.mehmet };
  for (let i = 0; i < NEGLECT.iliski + 2; i += 1) week(s, ["rest"]);
  assert.ok(s.decisionNetwork.chain.some((x) => /mesafeyi büyüttü/.test(x.text)));
  assert.equal(
    s.decisionNetwork.chain.filter((x) => /mesafeyi büyüttü/.test(x.text)).length,
    1,
    "a repeating cost keeps one line in the chain",
  );
  const t = createNewGame({ name: "A", seed: 11 });
  for (let i = 0; i < NEGLECT.iliski + 2; i += 1) week(t, ["rest", "family"]);
  assert.ok(!t.decisionNetwork.chain.some((x) => /mesafeyi büyüttü/.test(x.text)));
  assert.ok(t.relationships.anne > s.relationships.anne, "tending holds the bond");
  assert.ok(start.anne >= 0);
});

test("the week plan puts urgent pressure first and names what is coming back", () => {
  const s = createNewGame({ name: "A", seed: 5 });
  s.health.stress = 88;
  const plan = weekPlan(s, { projected: -200 });
  assert.equal(plan.pressure.text.startsWith("Stres 88"), true);
  assert.ok(plan.pressures.some((p) => /Ay sonu eksiye/.test(p.text)));
  s.lifeDepth.pendingEffects.push({
    id: "x",
    eventId: "life_depth_overwork_echo",
    dueWeek: s.time.absoluteWeek + 3,
    status: "pending",
    actorId: "burak",
  });
  const again = weekPlan(s, { effectLabel: () => "Aylar önceki fazla mesai" });
  assert.deepEqual(again.chain[0], {
    week: s.time.absoluteWeek + 3,
    text: "Aylar önceki fazla mesai",
    future: true,
  });
});

function run(policy, seed) {
  const s = createNewGame({ name: "P", seed });
  for (let i = 0; i < 24; i += 1) week(s, policy);
  return {
    perf: s.career.performance,
    bonds: (s.relationships.anne + s.relationships.mehmet) / 2,
    stress: s.health.stress,
    money: s.finances.balance,
  };
}

test("no single route wins: work, people and care each lead on their own axis and pay on another", () => {
  const seeds = [2, 9, 21];
  const avg = (policy) => {
    const rows = seeds.map((seed) => run(policy, seed));
    const out = {};
    for (const k of Object.keys(rows[0])) out[k] = rows.reduce((n, r) => n + r[k], 0) / rows.length;
    return out;
  };
  const work = avg(["overtime", "exercise"]);
  const people = avg(["family", "friend"]);
  const care = avg(["rest", "exercise"]);
  assert.ok(work.money > people.money && work.money > care.money, "work leads on money");
  assert.ok(people.bonds > work.bonds && people.bonds > care.bonds, "people lead on bonds");
  assert.ok(care.stress < work.stress, "care leads on stress over work");
  assert.ok(
    work.bonds < people.bonds && work.stress > care.stress,
    "work pays in bonds and stress",
  );
  for (const [name, r] of Object.entries({ work, people, care })) {
    const others = [work, people, care].filter((x) => x !== r);
    const dominates = others.every(
      (o) => r.money >= o.money && r.bonds >= o.bonds && r.stress <= o.stress && r.perf >= o.perf,
    );
    assert.equal(dominates, false, `${name} dominates every axis`);
  }
});

test("the week close is idempotent per call and never throws on an empty week", () => {
  const s = createNewGame({ name: "A", seed: 1 });
  const out = processDecisionNetworkWeek(s, []);
  assert.equal(out.fed, false);
  assert.equal(s.decisionNetwork.streak, 0);
});

test("UI contract: pressure and goal before the decisions, opportunity and chain after on phones", () => {
  const app = readFileSync(new URL("../public/games/tc-sim/js/app.js", import.meta.url), "utf8");
  const top = app.indexOf('${weekPlanHtml.top}<div class="decisions">');
  const more = app.indexOf('</div>${weekPlanHtml.more}<p class="result"');
  assert.ok(top > 0 && more > top);
  assert.match(app, /renderDecisionTags\(decision\.id\)/);
  const css = readFileSync(new URL("../public/games/tc-sim/styles.css", import.meta.url), "utf8");
  assert.match(css, /@media \(min-width: 901px\)[\s\S]*\.network-plan\.is-more \{\s*order: 2;/);
  const desk = readFileSync(new URL("../public/games/tc-sim/js/desk.js", import.meta.url), "utf8");
  for (const tr of ["ACİL BASKI", "SONUÇ ZİNCİRİ", "Bu hafta acil bir baskı yok"])
    assert.ok(desk.includes(`"${tr}"`), tr);
});
