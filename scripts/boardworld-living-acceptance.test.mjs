import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createGame,
  getActions,
  getCalendarView,
  getLivingView,
  resolveAction,
  validateState,
  migrateState,
} from "../public/games/tc-sim-boardworld/engine.mjs";
import { importGame, exportGame } from "../public/games/tc-sim-boardworld/persistence.mjs";
import { playLife } from "./boardworld-scenarios.mjs";

const dayOf = (s) => Math.floor(s.time / 1440) + 1;
const funds = (s) => s.cash + s.bank;
const legal = (s) => getActions(s).filter((a) => !a.disabled);
function take(s, id, payload) {
  const before = structuredClone(s),
    r = resolveAction(s, id, payload);
  assert.equal(r.ok, true, `${id}: ${r.message}`);
  assert.deepEqual(s, before);
  assert.equal(validateState(r.state), true);
  return r.state;
}
function reject(s, id, payload) {
  const before = structuredClone(s),
    r = resolveAction(s, id, payload);
  assert.equal(r.ok, false, `${id} must be rejected`);
  assert.strictEqual(r.state, s);
  assert.deepEqual(s, before);
}
function drain(s) {
  for (let i = 0; s.pendingEvents.length && i < 40; i++) {
    const a =
      legal(s).find((a) => a.id.startsWith("event:") && a.cost === 0) ||
      legal(s).find((a) => a.id.startsWith("event:"));
    assert.ok(a);
    s = take(s, a.id);
  }
  assert.equal(s.pendingEvents.length, 0);
  return s;
}
function advanceTo(s, target) {
  for (let i = 0; s.time < target && i < 400; i++) {
    s = drain(s);
    const remaining = target - s.time;
    assert.ok(remaining >= 15, "fixture and selected target use the same15min grid");
    s = take(s, remaining >= 60 ? "wait:60" : "wait:15");
  }
  assert.equal(s.time, target);
  return s;
}
function fixture(file) {
  return importGame(readFileSync(new URL(`./fixtures/boardworld/${file}`, import.meta.url), "utf8"))
    .state;
}

for (const scenario of ["newcomer", "graduate", "restart"])
  for (const seed of [7, 91373])
    test(`${scenario}/${seed}: 180 legal days replay through employer change, NPC agency and six rent periods`, () => {
      const r = playLife({ scenario, seed, days: 180, style: "career" });
      const s = r.state;
      assert.equal(dayOf(s), 181);
      assert.ok(s.player.health >= 50);
      assert.equal(s.housing.arrears, 0);
      assert.ok(s.housing.dueDay > 181);
      assert.ok(s.flags.billsPaid >= 6);
      assert.ok(r.counts.work >= 120);
      assert.ok(r.counts.sleep >= 170);
      assert.ok(r.counts.promote >= 3, "promotions were earned across employers");
      assert.equal(s.job.id, "repair");
      assert.ok(s.deep.career.experience.retail >= 25);
      assert.ok(s.deep.career.experience.repair >= 70);
      assert.ok(
        s.living.projects.some((p) => p.type === "qualification" && p.status === "complete"),
      );
      assert.ok(funds(s) > 5000, "steady earned work funds recurring household obligations");
      assert.ok(r.observed.moved.length > 0 && r.observed.careers.length > 0);
      assert.ok(r.observed.npcContacts > 50, "NPC relationships evolve without player meetings");
      assert.ok(s.calendar.entries.length <= 96);
      assert.ok(Object.values(s.living.npcs).every((n) => n.plan.length <= 16 && n.decisions <= 4));
      assert.ok(
        Buffer.byteLength(exportGame(s)) < 500000,
        "bounded180day state remains practical to save",
      );
      assert.deepEqual(importGame(exportGame(s)).state, s);
    });

test("three 90-day player strategies have distinct earned outcomes and viable recovery-start finances", () => {
  const lives = Object.fromEntries(
    ["career", "social", "entrepreneur"].map((style) => [
      style,
      playLife({ scenario: "restart", seed: 2026, style, days: 90 }),
    ]),
  );
  for (const r of Object.values(lives)) {
    assert.equal(dayOf(r.state), 91);
    assert.equal(r.state.housing.arrears, 0);
    assert.ok(r.state.player.health >= 50);
    assert.ok(funds(r.state) > 5000);
    assert.ok(Object.keys(r.counts).length >= 20);
    assert.ok(r.state.debt > 0, "recovery start retains its real debt instead of a scripted reset");
    assert.ok(r.state.resolvedEvents.length >= 10);
  }
  const career = lives.career,
    social = lives.social,
    owner = lives.entrepreneur;
  assert.equal(career.state.job.id, "repair");
  assert.ok(career.counts.promote >= 4);
  assert.ok(career.state.documents.some((d) => d.id === "certificate-repair"));
  assert.ok(social.state.calendar.stats.completed >= 12);
  assert.equal(social.state.calendar.stats.missed, 0);
  assert.ok(
    Object.values(social.state.npcs).filter((n) => n.affinity >= 40 && n.trust >= 30).length >= 3,
  );
  assert.ok(
    social.state.living.projects.filter((p) => p.type === "relationship" && p.status === "complete")
      .length >= 2,
  );
  assert.ok((social.counts["talk:leyla"] || 0) > 30);
  assert.equal(owner.state.job, null);
  assert.ok(owner.counts["business:serve"] >= 70);
  assert.ok(owner.counts["freelance:deliver"] >= 20);
  assert.ok(owner.counts["business:stock:6"] >= 10);
  assert.ok(owner.state.deep.business.revenue > owner.state.deep.business.costs);
  assert.equal(owner.state.deep.business.arrears, 0);
  assert.ok(
    owner.state.living.projects.some((p) => p.type === "enterprise" && p.status === "complete"),
  );
  assert.ok(
    funds(career.state) > funds(owner.state),
    "career and self-employment do not collapse into the same income trace",
  );
  assert.notDeepEqual(career.counts, social.counts);
  assert.notDeepEqual(social.counts, owner.counts);
});

test("legacy appointment early attendance waits for the reserved end, stays free and cannot pay or complete twice", () => {
  let s = fixture("v2-active-appointment-day1.json");
  const entry = s.calendar.entries[0];
  s = take(s, "project:start:relationship:leyla:30");
  s.living.projects[0].budget = 0; // Focused zero-budget boundary; legacy meeting really is free.
  s = take(s, `visit:${entry.venue}`);
  s = advanceTo(s, entry.start - 30);
  const before = funds(s),
    cash = s.cash,
    trust = s.npcs[entry.npcId].trust;
  s = take(s, `calendar:attend:${entry.id}`);
  assert.equal(s.time, entry.end);
  assert.equal(s.calendar.entries[0].status, "completed");
  assert.equal(s.calendar.entries[0].lateBy, 0);
  assert.equal(s.calendar.stats.completed, 1);
  assert.equal(funds(s), before);
  assert.equal(s.cash, cash);
  assert.equal(s.living.projects[0].spent, 0);
  assert.equal(s.npcs[entry.npcId].trust, Math.min(100, trust + 10));
  reject(s, `calendar:attend:${entry.id}`);
  s = importGame(exportGame(s)).state;
  reject(s, `calendar:attend:${entry.id}`);
  assert.equal(s.calendar.stats.completed, 1);
});

test("a real paid meeting honors the target relationship budget and records its exact fee once", () => {
  let s = drain(createGame({ scenario: "restart", seed: 2026 }));
  s = take(s, "project:start:relationship:leyla:30");
  s = take(s, "calendar:propose", {
    kind: "meeting",
    npcId: "leyla",
    subjectId: "",
    day: 2,
    minute: 1080,
    venue: "kadikoy-cafe",
    duration: 60,
    repeat: "none",
  });
  let entry = s.calendar.entries.at(-1);
  if (entry.status === "counter") {
    s = take(s, `calendar:accept:${entry.id}`);
    entry = s.calendar.entries.at(-1);
  }
  s = take(s, `visit:${entry.venue}`);
  // A phone proposal consumes five minutes; use legal fifteen-minute waits into the attendance window.
  s = advanceTo(s, s.time + Math.ceil((entry.start - 30 - s.time) / 15) * 15);
  const command = `calendar:attend:${entry.id}`;
  const fee = getActions(s).find((a) => a.id === command).cost;
  assert.equal(fee, 55);
  const poor = structuredClone(s);
  poor.living.projects[0].budget = fee - 1; // Focused limit setup, all attendance/payment actions stay real.
  assert.equal(validateState(poor), true);
  reject(poor, command);
  assert.match(getActions(poor).find((a) => a.id === command).reason, /bütçe/);
  s.living.projects[0].budget = fee;
  const money = funds(s);
  s = take(s, command);
  assert.equal(funds(s), money - fee);
  assert.equal(s.living.projects[0].spent, fee);
  assert.equal(s.calendar.entries.find((e) => e.id === entry.id).status, "completed");
  assert.deepEqual(s.living.projects[0].progress.slice(0, 2), [true, true]);
  reject(s, command);
  s = importGame(exportGame(s)).state;
  reject(s, command);
  assert.equal(s.living.projects[0].spent, fee);
});

test("legacy appointment keeps the original30min attendance window and60min no-show grace", () => {
  let s = fixture("v2-active-appointment-day1.json");
  const entry = s.calendar.entries[0];
  s = take(s, `visit:${entry.venue}`);
  s = advanceTo(s, entry.start + 30);
  const late = take(s, `calendar:attend:${entry.id}`);
  assert.equal(late.calendar.entries[0].status, "completed");
  assert.equal(late.calendar.entries[0].lateBy, 30);
  const missedStart = advanceTo(s, entry.start + 60);
  assert.equal(missedStart.calendar.entries[0].status, "confirmed");
  reject(missedStart, `calendar:attend:${entry.id}`);
  let missed = take(missedStart, "wait:15");
  assert.equal(missed.calendar.entries[0].status, "missed");
  assert.equal(missed.calendar.stats.missed, 1);
  const trust = missed.npcs[entry.npcId].trust;
  missed = take(missed, "wait:60");
  assert.equal(missed.calendar.stats.missed, 1);
  assert.equal(missed.npcs[entry.npcId].trust, trust);
});

test("business transfers conserve wealth, stock costs are paid once and liquidation cannot repeat", () => {
  let s = drain(createGame({ scenario: "restart", seed: 12 }));
  s.cash = 20000;
  s.bank = 0;
  assert.equal(validateState(s), true); // Focused solvent setup, not endurance.
  s = take(s, "business:start:repair");
  const wealth = funds(s) + s.living.enterprise.capital;
  for (let i = 0; i < 4; i++) {
    s = take(s, "business:fund:2000");
    s = take(s, "business:withdraw:2000");
    assert.equal(funds(s) + s.living.enterprise.capital, wealth);
  }
  s = take(s, "business:fund:2000");
  const capital = s.living.enterprise.capital,
    costs = s.deep.business.costs;
  s = take(s, "business:stock:6");
  assert.equal(s.living.enterprise.capital, capital - 960);
  assert.equal(s.deep.business.costs, costs + 960);
  s = take(s, "business:acquire");
  const previousCosts = s.deep.business.costs,
    previousStock = s.living.enterprise.stock;
  s = take(s, "business:serve");
  assert.equal(s.living.enterprise.stock, previousStock - 1);
  assert.equal(s.deep.business.costs, previousCosts + 30);
  const payout =
    s.living.enterprise.capital +
    Math.floor(s.living.enterprise.stock * 160 * 0.35) +
    900 -
    Math.ceil(s.deep.business.accruedOverhead) -
    s.deep.business.arrears;
  const before = funds(s);
  s = take(s, "business:close");
  assert.equal(funds(s) - before, payout);
  assert.equal(s.deep.business, null);
  assert.equal(s.living.enterprise.stock, 0);
  assert.equal(s.living.enterprise.capital, 0);
  reject(s, "business:close");
});

test("fast-forward preserves input and stops at unpaid mandatory obligations instead of silently skipping them", () => {
  const legacy = JSON.parse(
    JSON.parse(
      readFileSync(
        new URL("./fixtures/boardworld/v2-fresh-newcomer.json", import.meta.url),
        "utf8",
      ),
    ).payload,
  );
  legacy.time = 29 * 1440 + 23 * 60 + 45;
  legacy.pendingEvents = [];
  legacy.cash = 7000;
  legacy.bank = 0;
  legacy.deep.finance.autoPay = false;
  let s = migrateState(legacy);
  const before = structuredClone(s);
  const r = resolveAction(s, "calendar:next");
  assert.deepEqual(s, before);
  assert.equal(validateState(r.state), true);
  s = r.state;
  assert.ok(s.time <= 30 * 1440, "cannot skip a mandatory bill boundary");
  if (s.deep.finance.bills.some((b) => b.status === "due")) {
    const stopped = resolveAction(s, "calendar:next");
    assert.equal(stopped.state.time, s.time);
  }
});

test("public NPC view is pure, contains sourced observations and omits private financial or planning state", () => {
  let s = drain(createGame({ seed: 21 }));
  const before = structuredClone(s),
    view = getLivingView(s);
  assert.deepEqual(s, before);
  for (const npc of view.npcs) {
    for (const key of ["cash", "savings", "debt", "plan", "nextDecisionAt", "changes"])
      assert.equal(Object.hasOwn(npc, key), false);
  }
  const calendar = getCalendarView(s);
  assert.ok(Array.isArray(calendar.entries));
  assert.deepEqual(s, before);
  // A foreign actor's undisclosed private change cannot become a public fact by
  // merely rendering the phone. The actual world updates the private authority.
  s.deep.npcs.ece.profession = "Özel test görevi";
  s.deep.npcs.ece.cash += 150;
  const after = getLivingView(s).npcs.find((n) => n.id === "ece");
  assert.notEqual(after.knownProfession, "Özel test görevi");
  assert.equal(JSON.stringify(after).includes("Özel test görevi"), false);
});
