import test from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, readFileSync } from "node:fs";
import {
  getActions,
  getEmergentView,
  getNpcLocation,
  resolveAction,
  validateState,
} from "../public/games/tc-sim-boardworld/engine.mjs";
import { exportGame, importGame } from "../public/games/tc-sim-boardworld/persistence.mjs";
import { EVENTS } from "../public/games/tc-sim-boardworld/content.mjs";
import { playLife, selectLifeAction } from "./boardworld-scenarios.mjs";
import {
  selectEmergentLifeAction,
  majorDecision,
  maintenanceAction,
  normalizeAction,
} from "./boardworld-emergent-scenarios.mjs";

const dayOf = (s) => Math.floor(s.time / 1440) + 1;
const funds = (s) => s.cash + s.bank;
const summaries = [];
for (const style of ["career", "social", "entrepreneur"])
  for (const seed of [2026, 91373])
    test(`${style}/${seed}:365 legal days retain meaningful delayed choices, solvency and exact save replay`, () => {
      const births = new Set(),
        families = new Set(),
        finishes = [],
        decisions = [],
        checkpoints = [],
        societyOffers = new Map(),
        receivedReports = new Set(),
        penalizedEpisodes = new Set();
      let noGainPractice = 0,
        noGainRest = 0,
        maintenance = 0,
        major = 0,
        householdBills = 0;
      const normalized = new Set();
      const result = playLife({
        scenario: "restart",
        style,
        seed,
        days: 365,
        checkpoints: [30, 90, 180, 365],
        selector: selectEmergentLifeAction,
        onAction: ({ before, state, action }) => {
          for (const offer of state.society.offers) societyOffers.set(offer.id, offer.status);
          for (const [receiver, facts] of Object.entries(state.society.knowledge))
            for (const fact of facts) {
              const episode = `${receiver}:${fact.id}`;
              if (fact.hops > 0) receivedReports.add(episode);
              if (fact.appliedTrust < 0) {
                const old = before.society.knowledge[receiver]?.find((f) => f.id === fact.id);
                if (!old || old.learnedAt !== fact.learnedAt)
                  assert.equal(
                    penalizedEpisodes.has(episode),
                    false,
                    "forgetting a bounded report cannot charge the same reputation penalty again",
                  );
                penalizedEpisodes.add(episode);
              }
            }
          normalized.add(normalizeAction(action.id));
          if (maintenanceAction.test(action.id)) maintenance++;
          if (majorDecision.test(action.id)) {
            major++;
            decisions.push(dayOf(before));
          }
          if (
            action.id.startsWith("practice:") &&
            JSON.stringify(before.player.skills) === JSON.stringify(state.player.skills)
          )
            noGainPractice++;
          if (
            action.id === "rest" &&
            before.player.energy === state.player.energy &&
            before.player.stress === state.player.stress &&
            before.player.health === state.player.health
          )
            noGainRest++;
          for (const e of state.emergent.events)
            if (!births.has(e.id)) {
              births.add(e.id);
              families.add(e.family);
            }
          if (/^systemic:.*:finish$/.test(action.id)) {
            const e = before.emergent.events.find((e) => action.id === `systemic:${e.id}:finish`);
            assert.ok(e.stage === 1 && before.time >= e.followAt);
            assert.ok(
              before.time - e.createdAt >= 5 * 1440,
              "follow-up takes real days between choices",
            );
            assert.equal(state.emergent.events.find((x) => x.id === e.id).status, "resolved");
            const again = resolveAction(state, action.id);
            assert.equal(again.ok, false, "completed causal reward cannot repeat");
            assert.strictEqual(again.state, state);
            finishes.push({ day: dayOf(before), family: e.family });
          }
          const population = Object.values(state.living.population.districts).reduce(
            (n, p) => n + p.employed + p.students + p.jobseekers,
            0,
          );
          assert.equal(
            population + state.life.secondary.length,
            450,
            "promotion conserves the same residents",
          );
          assert.ok(state.life.secondary.length <= 6);
          assert.equal(
            new Set(state.life.secondary.map((n) => n.id)).size,
            state.life.secondary.length,
          );
          assert.ok(state.emergent.events.length <= 72 && state.emergent.history.length <= 96);
          assert.ok(
            state.emergent.events.filter((e) => ["active", "waiting"].includes(e.status)).length <=
              3,
          );
          if (before.life.household && state.life.household?.id === before.life.household.id) {
            const oldKeys = new Set(before.life.household.billRecords.map((b) => b.key));
            householdBills += state.life.household.billRecords.filter(
              (b) => !oldKeys.has(b.key),
            ).length;
          }
        },
        onCheckpoint: ({ days, state, actions, elapsedMs }) => {
          assert.equal(dayOf(state), days + 1);
          assert.ok(state.player.health >= 50);
          assert.equal(state.housing.arrears, 0);
          assert.ok(funds(state) > 1000);
          assert.deepEqual(importGame(exportGame(state)).state, state);
          const previous = checkpoints.at(-1)?.completeDays || 0;
          const intervalFinishes = finishes.filter((f) => f.day > previous && f.day <= days + 1);
          assert.ok(
            intervalFinishes.length >= 2,
            `real completed follow-ups remain after day${previous}`,
          );
          checkpoints.push({
            completeDays: days,
            actions,
            elapsedMs,
            normalizedActions: normalized.size,
            majorDecisions: major,
            decisionsThisInterval: decisions.filter((d) => d > previous && d <= days + 1).length,
            finishedThisInterval: intervalFinishes.length,
            totalFinishes: finishes.length,
            families: [...families],
            maintenance,
            practiceWithNoImmediateSkillGain: noGainPractice,
            restWithNoImmediateTargetGain: noGainRest,
            saveBytes: Buffer.byteLength(exportGame(state)),
            societyBytes: Buffer.byteLength(JSON.stringify(state.society)),
            autonomousOffers: societyOffers.size,
            receivedNpcReports: receivedReports.size,
            retainedOffers: state.society.offers.length,
            retainedChronology: state.society.feed.length,
            retainedKnownEdges: state.society.knownEdges.length,
            health: state.player.health,
            cash: state.cash,
            bank: state.bank,
            debt: state.debt,
            rentArrears: state.housing.arrears,
            secondary: state.life.secondary.map((n) => n.id),
            householdBills,
            completedMeetings: state.calendar.stats.completed,
            completedProjects: state.living.projects.filter((p) => p.status === "complete").length,
          });
        },
      });
      const s = result.state;
      assert.equal(dayOf(s), 366);
      assert.equal(noGainPractice, 0, "capped practice is not selected as fake progression");
      assert.equal(noGainRest, 0, "full-need rest is not selected as fake recovery");
      assert.ok(births.size >= 40 && finishes.length >= 30);
      assert.ok(families.size >= (style === "entrepreneur" ? 6 : 7) && normalized.size >= 35);
      for (const family of ["housing", "neighborhood", "education", "household", "debt"])
        assert.ok(families.has(family));
      if (style === "entrepreneur") {
        assert.ok(families.has("enterprise"));
        assert.equal(families.has("employment"), false);
      }
      assert.ok(result.observed.npcContacts > 100);
      assert.ok(societyOffers.size > 0, "NPCs initiate opportunities in an actual year of play");
      assert.ok(result.observed.moved.length && result.observed.careers.length);
      assert.ok(s.life.secondary.length >= 1);
      assert.ok(Buffer.byteLength(exportGame(s)) < 500000);
      if (style === "career") {
        assert.equal(s.job.id, "repair");
        assert.ok(result.counts.work >= 230 && result.counts.promote >= 4);
        assert.ok(s.documents.some((d) => d.id === "certificate-repair"));
      } else if (style === "social") {
        assert.ok(
          s.life.household && householdBills >= 20,
          "earned household survives real monthly settlements",
        );
        assert.ok(result.counts["household:chore"] >= 30);
        assert.ok(s.calendar.stats.completed >= 45 && s.calendar.stats.missed === 0);
      } else {
        assert.equal(s.job, null);
        assert.ok(
          result.counts["business:serve"] >= 300 && result.counts["freelance:deliver"] >= 80,
        );
        assert.ok(s.deep.business.revenue > s.deep.business.costs);
        assert.equal(s.deep.business.arrears, 0);
        assert.ok(
          result.counts["business:stock:6"] > 80,
          "profit consumes actual replenished stock",
        );
      }
      summaries.push({
        style,
        seed,
        checkpoints,
        actions: result.actions.length,
        counts: result.counts,
        families: [...families],
        finishes: finishes.length,
        observed: result.observed,
        society: {
          autonomousOffers: societyOffers.size,
          receivedNpcReports: receivedReports.size,
          uniquePenalizedEpisodes: penalizedEpisodes.size,
          outcomes: [...societyOffers.values()].reduce((counts, status) => {
            counts[status] = (counts[status] || 0) + 1;
            return counts;
          }, {}),
        },
      });
      if (process.env.BOARDWORLD_ACCEPTANCE_REPORT)
        writeFileSync(
          process.env.BOARDWORLD_ACCEPTANCE_REPORT,
          JSON.stringify({ lives: summaries }, null, 2) + "\n",
        );
    });

function take(s, id, payload) {
  const before = structuredClone(s),
    result = resolveAction(s, id, payload);
  assert.equal(result.ok, true, `${id}: ${result.message}`);
  assert.deepEqual(s, before);
  assert.equal(validateState(result.state), true);
  return result.state;
}
let earnedHousehold;
function sharedDay31() {
  earnedHousehold ||= playLife({
    style: "social",
    seed: 2026,
    days: 30,
    replay: false,
    selector: selectEmergentLifeAction,
  }).state;
  assert.ok(earnedHousehold.life.household);
  return structuredClone(earnedHousehold);
}

for (const auto of [true, false])
  test(`earned shared household pays the full next monthly bill once with autoPay=${auto}`, () => {
    let s = sharedDay31();
    if (!auto) s = take(s, "finance:autopay");
    const memory = {};
    let beforeMidnight;
    for (let i = 0; dayOf(s) < 61 && i < 1500; i++) {
      const a = selectEmergentLifeAction(s, "social", memory);
      const before = s;
      s = take(s, a.id, a.payload);
      if (dayOf(s) === 61) beforeMidnight = before;
    }
    assert.ok(beforeMidnight && s.life.household);
    const rent = beforeMidnight.housing.rent;
    const records = s.life.household.billRecords.filter((b) => /^(rent|utilities):61:/.test(b.key));
    assert.equal(records.length, 2);
    const share = records.reduce((n, r) => n + r.paid, 0);
    assert.equal(share, Math.floor(rent * 0.4) + 360);
    assert.equal(
      new Set(s.life.household.billRecords.map((r) => r.key)).size,
      s.life.household.billRecords.length,
    );
    const expected = rent + 900 - share;
    if (auto) {
      const charges = s.transactions.filter(
        (t) =>
          t.day === 61 &&
          ["Aylık kira", "Elektrik, su ve telefon"].includes(t.label) &&
          t.account !== "household",
      );
      assert.equal(-charges.reduce((n, t) => n + t.amount, 0), expected);
    } else {
      const bills = s.deep.finance.bills.filter(
        (b) => b.dueDay === 61 && ["rent", "utilities"].includes(b.kind),
      );
      assert.equal(bills.length, 2);
      assert.equal(
        bills.reduce((n, b) => n + b.amount, 0),
        expected,
      );
      const money = funds(s),
        npcMoney = s.deep.npcs[s.life.household.memberId].cash;
      for (const b of bills) s = take(s, `finance:bill:${b.id}`);
      assert.equal(funds(s), money - expected);
      assert.equal(
        s.deep.npcs[s.life.household.memberId].cash,
        npcMoney,
        "manual player payment never charges NPC a second time",
      );
      for (const b of bills) assert.equal(resolveAction(s, `finance:bill:${b.id}`).ok, false);
    }
    const count = s.life.household.billRecords.length;
    s = importGame(exportGame(s)).state;
    s = take(s, "wait:15");
    assert.equal(s.life.household.billRecords.length, count);
    assert.equal(s.housing.arrears, 0);
    assert.ok(getActions(s).length > 0);
  });

test("a real shared household survives warning periods, then forced lease loss refunds escrow once", () => {
  let s = sharedDay31();
  // Focused stress fixture: an existing earned household faces accumulated rent.
  // All warning dates, choices, work, needs, eviction and recovery remain real actions.
  s.housing.arrears = s.housing.rent * 4;
  assert.equal(validateState(s), true);
  const memberId = s.life.household.memberId,
    deposit = s.life.household.deposit;
  const originalLease = s.life.lease.homeKey,
    stages = new Set(),
    memory = {};
  let beforeLoss;
  for (let i = 0; s.housing.id !== "shelter" && i < 1500; i++) {
    stages.add(s.life.lease.stage);
    const before = s;
    let a = selectEmergentLifeAction(s, "social", memory);
    if (a.id === "calendar:next") {
      const attempt = resolveAction(s, a.id);
      if (!attempt.ok) {
        assert.match(attempt.message, /sözleşme|bildirim/);
        assert.strictEqual(attempt.state, s, "notice blocks automation without altering the world");
        a = { id: "wait:15" }; // Explicitly continue living through the notice, not a fast-forward bypass.
      }
    }
    s = take(s, a.id, a.payload);
    if (s.housing.id === "shelter") {
      beforeLoss = before;
      assert.deepEqual(resolveAction(before, a.id, a.payload).state, s);
    }
  }
  assert.ok(beforeLoss, "unpaid rent has a real terminal outcome after notice");
  assert.ok(stages.has("warning") && stages.has("negotiation") && stages.has("notice"));
  assert.ok(dayOf(s) - 31 >= 28, "the lease cannot disappear without its stated notice periods");
  assert.equal(s.life.household, null);
  assert.notEqual(s.life.lease.homeKey, originalLease);
  assert.ok(s.housing.arrears > 0, "the unpaid balance is not silently forgiven");
  const refunds = s.transactions.filter(
    (t) => t.label === "Ev arkadaşının kullanılmayan depozitosu iade edildi",
  );
  assert.equal(refunds.length, 1);
  assert.equal(
    -refunds[0].amount,
    deposit - Math.min(deposit, beforeLoss.life.obligations[memberId] || 0),
  );
  assert.ok(s.npcs[memberId].memories.some((m) => m.text.includes("Ortak yaşam kapandı")));
  s = importGame(exportGame(s)).state;
  const money = funds(s),
    npcMoney = s.deep.npcs[memberId].cash;
  const retry = resolveAction(s, "household:leave");
  assert.equal(retry.ok, false);
  assert.strictEqual(retry.state, s);
  assert.equal(funds(s), money);
  assert.equal(s.deep.npcs[memberId].cash, npcMoney);
  // Safe housing leaves manual recovery actions usable after a major loss.
  const recovery = getActions(s).find(
    (a) => !a.disabled && ["rest", "eat", "soup", "wait:15"].includes(a.id),
  );
  assert.ok(recovery);
  s = take(s, recovery.id);
  assert.equal(s.transactions.filter((t) => t.label === refunds[0].label).length, 1);
});

function historical(file) {
  return importGame(readFileSync(new URL(`./fixtures/boardworld/${file}`, import.meta.url), "utf8"))
    .state;
}
function focusFamily(s, family) {
  // Isolate eligibility timing, not a fabricated event, outcome or progression.
  // All tested events below are created by the public resolver from real conditions.
  for (const [id, meta] of Object.entries(s.emergent.families))
    if (id !== family) meta.lastDay = dayOf(s);
  assert.equal(validateState(s), true);
  return s;
}
function pursue(s, target, destination, limit = 18) {
  const stop = dayOf(s) + limit,
    memory = {};
  for (let i = 0; i < 1500 && dayOf(s) < stop; i++) {
    if (typeof target === "function" && target(s)) return s;
    const actions = getActions(s).filter((a) => !a.disabled);
    const wanted = typeof target === "string" && actions.find((a) => a.id === target);
    if (wanted) return take(s, wanted.id);
    const place = typeof destination === "function" ? destination(s) : destination;
    const move = place && s.location !== place && actions.find((a) => a.id === `travel:${place}`);
    const a = move || selectLifeAction(s, "career", memory);
    assert.ok(a);
    s = take(s, a.id, a.payload);
  }
  assert.fail(
    `public-action target not reached: ${target} day${dayOf(s)}; ${JSON.stringify({ location: s.location, reason: getActions(s).find((a) => a.id === target)?.reason, enterprise: s.living.enterprise })}`,
  );
}
function closeRealFollowup(s, id, destination) {
  const opened = s.emergent.events.find((e) => e.id === id);
  assert.equal(opened.status, "waiting");
  assert.equal(resolveAction(s, `systemic:${id}:finish`).ok, false);
  s = pursue(s, (n) => n.emergent.events.find((e) => e.id === id).status === "active");
  assert.ok(s.time >= opened.followAt);
  assert.ok(s.time - opened.createdAt >= 5 * 1440);
  s = pursue(s, `systemic:${id}:finish`, destination);
  assert.equal(s.emergent.events.find((e) => e.id === id).status, "resolved");
  const final = importGame(exportGame(s)).state;
  assert.deepEqual(final, s);
  const retry = resolveAction(final, `systemic:${id}:finish`);
  assert.equal(retry.ok, false);
  assert.strictEqual(retry.state, final);
  return final;
}

test("romance follow-up requires a real later date after an earned relationship and seven lived days", () => {
  let s = focusFamily(historical("v3-social-day91.json"), "romance");
  s = pursue(s, "date:mert", (n) => getNpcLocation(n, "mert"));
  s = pursue(s, "date:mert", (n) => getNpcLocation(n, "mert"));
  s = pursue(s, "partner:mert", (n) => getNpcLocation(n, "mert"));
  assert.equal(s.flags.partner, "mert");
  s = pursue(s, (n) => getEmergentView(n).events.some((e) => e.family === "romance"));
  const e = getEmergentView(s).events.find((e) => e.family === "romance");
  s = pursue(s, `systemic:${e.id}:commit`, e.location);
  const openingDay = dayOf(s);
  s = pursue(s, (n) => dayOf(n) > openingDay);
  s = pursue(s, "date:mert", (n) => getNpcLocation(n, "mert"));
  assert.ok(s.npcs.mert.lastDateDay > openingDay);
  s = closeRealFollowup(s, e.id, e.location);
  assert.ok(
    s.npcs.mert.memories.some((m) => /birlikte zaman|birlikte özel|Takip|takip/i.test(m.text)),
  );
});

test("transport follow-up is earned by a real changed home and actual commuting over five days", () => {
  let s = focusFamily(historical("v3-career-day91.json"), "transport");
  s = pursue(s, "move:studio", "besiktas");
  assert.equal(s.housing.id, "studio");
  s = pursue(s, (n) => getEmergentView(n).events.some((e) => e.family === "transport"));
  const e = getEmergentView(s).events.find((e) => e.family === "transport");
  s = pursue(s, `systemic:${e.id}:commit`, e.location);
  const trips = s.flags.travels;
  s = pursue(s, (n) => n.flags.travels >= trips + 2);
  s = closeRealFollowup(s, e.id, e.location);
  assert.equal(s.job.id, "repair");
  assert.ok(s.flags.travels >= trips + 2);
});

test("health follow-up consumes real clinical care and recovery days instead of granting immediate full health", () => {
  let s = historical("v3-career-day91.json");
  s.player.health = 60; // A valid focused illness precursor, not endurance progression.
  s.pendingEvents = [];
  s.resolvedEvents = EVENTS.map((event) => event.id); // Isolate the systemic recovery from older one-off medical cards.
  s = focusFamily(s, "health");
  s.emergent.lastSpawnDay = dayOf(s) - 1;
  s = take(s, "wait:15");
  const e = getEmergentView(s).events.find((e) => e.family === "health");
  assert.ok(e);
  s = pursue(s, `systemic:${e.id}:commit`, e.location);
  assert.ok(s.player.health < 70, "the planning decision alone does not cure illness");
  const money = funds(s);
  s = pursue(s, "clinic", "sisli");
  assert.ok(s.player.health >= 70 && funds(s) < money);
  s = closeRealFollowup(s, e.id, e.location);
  assert.ok(s.player.health >= 70);
});

test("six people enter through real local actions; a seventh encounter cannot duplicate the conserved city population", () => {
  let s = historical("v3-career-day91.json");
  s = pursue(s, "work");
  assert.ok(s.life.secondary.some((n) => n.id === "hakan"));
  for (const district of ["kadikoy", "besiktas"]) {
    const ready = dayOf(s) + 5;
    s = pursue(s, (n) => dayOf(n) >= ready);
    const previous = s.life.secondary.length;
    for (let i = 0; i < 5 && s.life.secondary.length === previous; i++)
      s = pursue(s, `visit:${district}-${i % 2 ? "cafe" : "park"}`, district);
    assert.equal(s.life.secondary.length, previous + 1, `${district} earns a persistent neighbor`);
  }
  let ready = dayOf(s) + 5;
  s = pursue(s, (n) => dayOf(n) >= ready);
  s = pursue(s, "business:start:repair", "kadikoy");
  s = pursue(s, "business:fund:2000");
  s = pursue(s, "business:stock:6", "kadikoy");
  while (s.deep.business.clients < 2) s = pursue(s, "business:acquire", "kadikoy");
  s = pursue(s, "business:serve", "kadikoy");
  assert.ok(s.life.secondary.some((n) => n.id === "sibel"));
  s = pursue(s, "career:notice");
  ready = dayOf(s) + 7;
  s = pursue(s, (n) => dayOf(n) >= ready);
  s = pursue(s, "apply:barista", "besiktas");
  s = pursue(s, "work", "besiktas");
  assert.ok(s.life.secondary.some((n) => n.id === "kerem"));
  assert.equal(s.life.secondary.length, 5);
  ready = dayOf(s) + 5;
  s = pursue(s, (n) => dayOf(n) >= ready);
  s = pursue(s, "business:close");
  s = pursue(s, "travel:besiktas");
  s = pursue(s, "business:start:repair");
  s = pursue(s, "business:fund:2000");
  s = pursue(s, "business:stock:6");
  while (s.deep.business.clients < 2) s = pursue(s, "business:acquire", s.deep.business.location);
  s = pursue(s, "business:serve", s.deep.business.location);
  assert.ok(s.life.secondary.some((n) => n.id === "banu"));
  assert.equal(s.life.secondary.length, 6);
  const six = s.life.secondary.map((n) => n.id);
  ready = dayOf(s) + 5;
  s = pursue(s, (n) => dayOf(n) >= ready);
  s = pursue(s, "business:close");
  s = pursue(s, "travel:sisli");
  s = pursue(s, "business:start:repair");
  s = pursue(s, "business:fund:2000");
  s = pursue(s, "business:stock:6");
  while (s.deep.business.clients < 2) s = pursue(s, "business:acquire", s.deep.business.location);
  s = pursue(s, "business:serve", s.deep.business.location);
  assert.deepEqual(
    s.life.secondary.map((n) => n.id),
    six,
  );
  const population = Object.values(s.living.population.districts).reduce(
    (n, p) => n + p.employed + p.students + p.jobseekers,
    0,
  );
  assert.equal(population, 444);
  assert.equal(new Set(six).size, 6);
  assert.deepEqual(importGame(exportGame(s)).state, s);
});

test("cash-poor routine stops honestly by default, while explicit withdrawal cooks with existing bank money", () => {
  let s = historical("v3-career-day91.json");
  s.pendingEvents = [];
  s.resolvedEvents = EVENTS.map((e) => e.id);
  s.cash = 0;
  s.bank = 10000;
  s.inventory.groceries = 0;
  s.player.hunger = 20;
  assert.equal(validateState(s), true);
  s = take(s, "schedule:toggle:work");
  s = take(s, "schedule:toggle:study");
  for (let i = 0; i < 30; i++) {
    const choices = getActions(s).filter((a) => !a.disabled && a.id.startsWith("story:"));
    if (!choices.length) break;
    s = take(s, (choices.find((a) => a.cost === 0) || choices[0]).id);
  }
  // The focused cash/food precursor is set after pre-existing story choices.
  s.cash = 0;
  s.bank = 10000;
  s.inventory.groceries = 0;
  s.player.hunger = 20;
  const original = structuredClone(s);
  const stopped = take(s, "schedule:run:1");
  assert.equal(stopped.time, s.time);
  assert.equal(stopped.cash, 0);
  assert.equal(stopped.bank, 10000);
  assert.match(stopped.deep.routine.stopReason, /öğün|nakit|çek/i);
  s = take(s, "policy:autoWithdraw:true");
  s = take(s, "schedule:run:1");
  assert.ok(s.deep.routine.lastActions.includes("withdraw:1000"));
  assert.ok(s.deep.routine.lastActions.includes("buy:groceries"));
  assert.ok(s.deep.routine.lastActions.includes("cook"));
  const previousRows = new Set(original.transactions.map((t) => JSON.stringify(t)));
  const transfer = s.transactions.filter(
    (t) => !previousRows.has(JSON.stringify(t)) && /çek/i.test(t.label),
  );
  assert.equal(transfer.length, 2);
  assert.equal(
    transfer.reduce((sum, t) => sum + t.amount, 0),
    0,
  );
  assert.ok(funds(s) < 10000, "food consumes real funds after the conserved internal transfer");
  assert.ok(s.time > original.time);
});
