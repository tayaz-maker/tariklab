import assert from "node:assert/strict";
import test from "node:test";
import {
  createGame,
  getActions,
  loadExpansionRuntime,
  resolveAction,
  validateState,
} from "../public/games/tc-sim-boardworld/engine.mjs";
import { exportGame, importGame } from "../public/games/tc-sim-boardworld/persistence.mjs";
import {
  localizeUnderworldText,
  underworldDistrictModifiers,
} from "../public/games/tc-sim-boardworld/expansion-underworld.mjs";

const runtime = await loadExpansionRuntime();
const view = (s) => runtime.getExpansionView(s).underworld;
const actions = (s, prefix = "underworld:") =>
  getActions(s).filter(({ id }) => id.startsWith(prefix));
const enabled = (s, id) => getActions(s).some((a) => a.id === id && !a.disabled);
const funds = (s) => s.cash + s.bank;
const DAY = 1440;

function act(s, id) {
  const result = resolveAction(s, id);
  assert.ok(result.ok, `${id} at ${s.time}: ${result.message}`);
  assert.ok(validateState(result.state), id);
  return result.state;
}
function trace(s, ids) {
  return ids.reduce(act, s);
}
function rejects(s, id) {
  const bytes = exportGame(s);
  const result = resolveAction(s, id);
  assert.equal(result.ok, false, id);
  assert.equal(result.state, s);
  assert.equal(exportGame(s), bytes);
}
function until(s, time) {
  while (s.time < time) {
    const all = getActions(s);
    const event = all.find((a) => !a.disabled && a.id.startsWith("event:"));
    const long = time - s.time > 60 && all.find((a) => !a.disabled && a.id === "wait:60");
    s = act(s, event?.id || long?.id || "wait:15");
  }
  return s;
}
function idle(s, time, consider = () => {}) {
  while (s.time < time) {
    const available = getActions(s).filter((a) => !a.disabled);
    const event = available.find((a) => a.id.startsWith("event:"));
    const sleep = available.find((a) => a.id === "sleep");
    s = act(s, event?.id || sleep?.id || "wait:60");
    consider(s);
  }
  return s;
}
function start() {
  return act(createGame({ expansion: true, seed: 49 }), "event:welcome:work");
}
function join() {
  return trace(until(start(), 550), [
    "visit:kadikoy-cafe",
    "underworld:recruit:moda",
    "underworld:join:moda",
  ]);
}
function caseOpened(witness = true) {
  let s = trace(join(), ["travel:besiktas", "visit:besiktas-work"]);
  if (!witness) s = until(s, 915);
  const n = s.expansion.underworld.nextIncident;
  const before = s;
  s = act(s, "underworld:raid:iskele");
  const x = s.expansion.underworld;
  const incident = x.incidents.find(({ id }) => id === n);
  assert.equal(incident.at, s.time);
  assert.equal(incident.venueId, "besiktas-work");
  assert.equal(incident.personId, s.expansion.playerId);
  assert.equal(incident.offscreen, false);
  assert.equal(incident.evidence.length, witness ? 2 : 1);
  assert.equal(s.bank - before.bank, 120);
  assert.equal(x.chapters.moda.treasury, before.expansion.underworld.chapters.moda.treasury - 120);
  assert.equal(x.chapters.moda.stock, before.expansion.underworld.chapters.moda.stock + 1);
  assert.equal(x.chapters.iskele.stock, before.expansion.underworld.chapters.iskele.stock - 1);
  assert.deepEqual(view(s).cases.find(({ id }) => id === n).evidence, []);
  rejects(s, `underworld:report:${n}`);
  s = trace(s, ["visit:besiktas-academy", `underworld:report:${n}`, `underworld:inspect:${n}`]);
  assert.equal(view(s).cases.find(({ id }) => id === n).evidence.length, 1);
  assert.ok(
    !view(s)
      .cases.find(({ id }) => id === n)
      .evidence.some(({ kind }) => /tanık/.test(kind)),
  );
  rejects(s, `underworld:report:${n}`);
  rejects(s, `underworld:inspect:${n}`);
  return { s, id: n };
}

test("optional authority is pure before the first successful cloned action or day tick", () => {
  const s = start();
  const bytes = exportGame(s);
  const originalRandom = s.rng;
  assert.ok(view(s).chapters.length === 7);
  assert.deepEqual(underworldDistrictModifiers(s, "kadikoy"), {
    demand: 0,
    rentPressure: 0,
    jobOpenings: 0,
    serviceDelay: 0,
    security: 0,
    influence: 0,
  });
  assert.ok(actions(s).length > 0);
  rejects(s, "underworld:recruit:moda");
  assert.equal(Object.hasOwn(s.expansion, "underworld"), false);
  assert.equal(s.rng, originalRandom);
  assert.deepEqual(importGame(bytes).state, s);
  assert.equal(exportGame(s), bytes);
});

test("membership tasks transfer funded stock, pay once, unlock promotion and preserve former status", () => {
  let s = join();
  const chapter = () => s.expansion.underworld.chapters.moda;
  rejects(s, "underworld:join:moda");
  rejects(s, "underworld:promote");
  s = trace(s, ["visit:kadikoy-work", "underworld:accept:delivery"]);
  const before = s;
  const treasury = chapter().treasury;
  const stock = chapter().stock;
  const priorFirms = structuredClone(s.expansion.economy.firms);
  const deliveryId = `underworld:complete:${s.expansion.underworld.memberships[0].task.id}`;
  s = act(s, deliveryId);
  assert.equal(s.bank - before.bank, 145);
  const buyers = Object.keys(priorFirms).filter(
    (id) => s.expansion.economy.firms[id].stock !== priorFirms[id].stock,
  );
  assert.equal(buyers.length, 1);
  const [buyer] = buyers;
  const paid = priorFirms[buyer].cash - s.expansion.economy.firms[buyer].cash;
  assert.ok(paid > 0);
  assert.equal(s.expansion.economy.firms[buyer].stock, priorFirms[buyer].stock + 1);
  assert.equal(chapter().stock, stock - 1);
  assert.equal(chapter().treasury, treasury + paid - 145);
  assert.deepEqual(act(importGame(exportGame(before)).state, deliveryId), s);
  rejects(s, deliveryId);
  s = trace(s, [
    "underworld:accept:sorting",
    "underworld:complete:2",
    "visit:kadikoy-cafe",
    "underworld:promote",
  ]);
  assert.equal(view(s).membership.rank, "Üye");
  assert.equal(view(s).membership.trust, 56);
  assert.equal(view(s).membership.responsibility, 3);
  s = trace(s, ["visit:kadikoy-work", "underworld:accept:dispatch", "underworld:leave"]);
  assert.equal(view(s).membership.status, "Ayrıldı");
  assert.equal(view(s).membership.task.status, "İptal edildi");
  assert.equal(view(s).membership.leftAt, s.time);
  rejects(s, "underworld:complete:3");
  assert.ok(getActions(s).some(({ id }) => id.startsWith("apply:")));
  assert.deepEqual(importGame(exportGame(s)).state, s);
});

test("corroborated loss and witness convict, one source acquits, and hidden testimony cannot be inferred", () => {
  const guilty = caseOpened();
  const weak = caseOpened(false);
  for (const [hasWitness, journey] of [
    [true, guilty],
    [false, weak],
  ]) {
    const { id } = journey;
    let { s } = journey;
    const getRow = () => view(s).cases.find((row) => row.id === id);
    s = until(s, DAY * 2 + 550);
    assert.equal(getRow().evidence.length, 1);
    assert.deepEqual(getRow().actionIds, [`underworld:inspect:${id}`]);
    assert.ok(enabled(s, `underworld:inspect:${id}`));
    s = act(s, `underworld:inspect:${id}`);
    assert.equal(getRow().evidence.length, hasWitness ? 2 : 1);
    if (hasWitness) {
      const testimony = getRow().evidence[1];
      assert.equal(testimony.source, "Okan Eren");
      assert.ok(testimony.learnedAt > testimony.observedAt);
    }
    rejects(s, `underworld:inspect:${id}`);
    s = act(s, "underworld:leave");
    s = until(s, DAY * 4 + 550);
    assert.equal(getRow().status, hasWitness ? "Mahkûmiyet" : "Beraat");
    assert.equal(getRow().fine, hasWitness ? 420 : 0);
    assert.equal(getRow().compensation, hasWitness ? 120 : 0);
    if (hasWitness) {
      const before = s;
      const victim = before.expansion.underworld.chapters.iskele;
      const authority = before.expansion.institutions.regions.istanbul;
      s = trace(s, [`underworld:fine:${id}`, `underworld:compensation:${id}`]);
      assert.equal(funds(before) - funds(s), 540);
      assert.equal(s.expansion.underworld.chapters.iskele.treasury - victim.treasury, 120);
      assert.equal(s.expansion.institutions.regions.istanbul.treasury - authority.treasury, 420);
      assert.equal(getRow().compensation, 0);
      assert.equal(getRow().fine, 0);
      assert.equal(getRow().restrictionUntil, 35);
    }
    rejects(s, `underworld:fine:${id}`);
    rejects(s, `underworld:compensation:${id}`);
    assert.deepEqual(importGame(exportGame(s)).state, s);
  }
});

test("rivals pursue their own witnessed raids and fund judgments after the player leaves", () => {
  let { s } = caseOpened();
  s = trace(s, ["underworld:leave", "travel:kadikoy"]);
  s = idle(s, 46 * DAY);
  const x = s.expansion.underworld;
  const cases = x.cases.filter((_, index) => x.incidents[index].offscreen);
  assert.ok(cases.some((row) => row.status === "acquitted"));
  const conviction = cases.find((row) => row.status === "convicted");
  assert.ok(conviction);
  assert.equal(conviction.finePaid, 420);
  assert.equal(conviction.compensationPaid, 120);
  const incident = x.incidents.find(({ id }) => id === conviction.id);
  assert.equal(incident.evidence.length, 2);
  assert.ok(incident.evidence.every((evidence) => evidence.learnedAt === null));
  assert.ok(x.chapters[incident.offenderChapterId].ledger.liability >= 120);
  const summary = view(s).cases.find((row) => row.id === conviction.id);
  assert.equal(summary.scope, "public");
  assert.deepEqual(summary.evidence, []);
  assert.deepEqual(summary.actionIds, []);
  assert.equal(summary.fine, 0);
  assert.equal(summary.compensation, 0);
});

test("an estate keeps compensation while criminal identity, fine and rank stay with the predecessor", () => {
  let { s, id } = caseOpened();
  s = until(s, DAY * 4 + 550);
  const predecessorId = s.expansion.playerId;
  const predecessor = s.expansion.family.people.find((row) => row.id === predecessorId);
  // Rare branch fixture: place the founder at their last living day. The
  // actual day boundary, succession, attribution and payment use the resolver.
  const deathDay = Math.floor(s.time / DAY) + 2;
  predecessor.born = deathDay - predecessor.lifespan * 30;
  const parent = s.expansion.family.people.find((row) => row.id === predecessor.parents[0]);
  parent.born = predecessor.born - 24 * 30;
  parent.died = 1;
  assert.ok(validateState(s));
  s = until(s, (deathDay - 1) * DAY);
  const person = s.expansion.family.people.find((row) => row.id === predecessorId);
  assert.equal(person.died, deathDay);
  const originalCase = s.expansion.underworld.cases.find((row) => row.id === id);
  assert.equal(originalCase.fineWaived, 420);
  assert.equal(view(s).membership.status, "Ayrıldı");
  const successor = getActions(s).find((a) => a.id.startsWith("family:successor:") && !a.disabled);
  assert.ok(successor);
  s = act(s, successor.id);
  assert.notEqual(s.expansion.playerId, predecessorId);
  assert.equal(view(s).membership, null);
  const inherited = view(s).cases.find((row) => row.id === id);
  assert.equal(inherited.subject, person.name);
  assert.equal(inherited.status, "Tereke tazminatı");
  assert.equal(inherited.fine, 0);
  assert.equal(inherited.compensation, 120);
  assert.equal(inherited.restrictionUntil, null);
  assert.deepEqual(inherited.evidence, []);
  assert.deepEqual(inherited.actionIds, [`underworld:compensation:${id}`]);
  s = act(s, `underworld:compensation:${id}`);
  assert.ok(!view(s).cases.some((row) => row.id === id));
  const forged = structuredClone(s);
  const altered = forged.expansion.family.people.find((row) => row.id === predecessorId);
  const incident = forged.expansion.underworld.incidents.find((row) => row.id === id);
  altered.died = Math.floor(incident.at / DAY) + 1;
  assert.equal(validateState(forged), false);
});

test("long offscreen simulation advances rivalry and replaces leaders without player participation", () => {
  const starter = start();
  const observedOutcomes = new Set();
  const incidents = new Map();
  const leaders = new Map();
  // Real resolver advances every existing day hook even while the player stays
  // in Kadıköy. The player never joins an organization or creates a case.
  const s = idle(starter, 451 * DAY, (s) => {
    if (!s.expansion.underworld) return;
    const x = s.expansion.underworld;
    for (const [index, row] of x.incidents.entries()) {
      incidents.set(row.id, row);
      observedOutcomes.add(x.cases[index].status);
    }
    for (const [id, account] of Object.entries(x.chapters)) {
      if (!leaders.has(id)) leaders.set(id, new Set());
      leaders.get(id).add(account.leader);
    }
    assert.ok(x.cases.length <= 32);
  });
  assert.equal(Object.hasOwn(starter.expansion, "underworld"), false);
  const x = s.expansion.underworld;
  assert.ok(Object.values(x.chapters).every((row) => row.ledger.sales > 0));
  assert.ok([...leaders.values()].some((observed) => observed.size > 1));
  assert.ok(Object.values(x.chapters).some((row) => row.roster[0].generation > 1));
  assert.ok(
    [...incidents.values()].every((row) => row.offscreen && row.personId !== s.expansion.playerId),
  );
  for (const status of ["unreported", "investigation", "review", "acquitted"])
    assert.ok(observedOutcomes.has(status), status);
  assert.ok(view(s).cases.every((row) => row.evidence.length === 0 && row.actionIds.length === 0));
  assert.ok(!actions(s).some(({ id }) => /fine|compensation/.test(id)));
  assert.ok(underworldDistrictModifiers(s, "ankara:kizilay").influence > 0);
  assert.ok(underworldDistrictModifiers(s, "izmir:konak").influence > 0);
  const tampered = structuredClone(s);
  tampered.expansion.underworld.chapters.moda.treasury++;
  assert.equal(validateState(tampered), false);
  const forged = structuredClone(s);
  forged.expansion.underworld.incidents[0].personId = s.expansion.playerId;
  assert.equal(validateState(forged), false);
  assert.deepEqual(importGame(exportGame(s)).state, s);
});

test("TR, EN and PL cover dynamic quotes, role labels, evidence and outcomes", () => {
  const s = trace(join(), ["travel:besiktas", "visit:besiktas-work"]);
  const raid = actions(s).find((a) => a.id === "underworld:raid:iskele");
  assert.match(raid.description, /120.*420.*120.*30/);
  for (const language of ["en", "pl"]) {
    const label = localizeUnderworldText(raid.label, language);
    assert.ok(label.startsWith("İskele Hamalları Birliği · "));
    assert.notEqual(label, raid.label);
    assert.match(localizeUnderworldText(raid.description, language), /120.*420.*120.*30/);
    for (const text of [raid.description, "Aday", "Doğrudan tanık ifadesi", "Mahkûmiyet", "Beraat"])
      assert.notEqual(localizeUnderworldText(text, language), text);
  }
  assert.equal(localizeUnderworldText(raid.description, "tr"), raid.description);
});

test("the task deadline uses the same minute in the shared clock and manual waiting", () => {
  let base = trace(join(), ["visit:kadikoy-work", "underworld:accept:sorting"]);
  const dueAt = view(base).membership.task.dueAt;
  base = until(base, dueAt - 10);
  assert.equal(view(base).membership.task.status, "Kabul edildi");
  const manual = until(base, dueAt + 1);
  const member = manual.expansion.underworld.memberships[0];
  assert.equal(member.task.resolvedAt, dueAt + 1);
  assert.equal(member.task.status, "missed");
  assert.equal(member.trust, 12);
  const missed = manual.expansion.events.filter(
    (row) => row.detail === "Görevin süresi doldu; güven azaldı.",
  );
  assert.equal(missed.length, 1);
  assert.equal(missed[0].at, dueAt + 1);
  rejects(manual, "underworld:complete:1");
  const reload = importGame(exportGame(base)).state;
  assert.deepEqual(until(reload, dueAt + 1), manual);
});

test("staff retirement preserves a pending fine reserve and charges the former actor after decision", () => {
  let s = idle(start(), 471 * DAY);
  const initial = s.expansion.underworld;
  const chapter = initial.chapters.moda;
  const outgoing = chapter.roster[1];
  assert.equal(outgoing.generation, 1);
  // Rare branch fixture: a scheduled receiving shift on day 471 identifies
  // a runner with retirement on day 473, before the day 476 verdict.
  const victim = "iskele";
  const midnight = 470 * DAY;
  const id = initial.nextIncident++;
  initial.incidents.push({
    id,
    personId: "moda:staff:1:1",
    offscreen: true,
    chapterId: victim,
    offenderChapterId: "moda",
    venueId: "besiktas-work",
    at: midnight,
    actionId: "underworld:night-raid:iskele",
    evidence: [
      { kind: "stock", source: victim, observedAt: midnight, learnedAt: null },
      { kind: "witness", source: "iskele:staff:2:1", observedAt: midnight, learnedAt: null },
    ],
  });
  initial.cases.push({
    id,
    status: "investigation",
    reportedAt: midnight + DAY,
    inventoryInspectedAt: null,
    reviewInspectedAt: null,
    reviewDay: 474,
    decidedAt: null,
    restrictionUntil: null,
    fineDue: 0,
    finePaid: 0,
    fineWaived: 0,
    fineArchived: 0,
    personalReserve: 0,
    compensationDue: 0,
    compensationPaid: 0,
  });
  outgoing.purse = 500;
  assert.ok(validateState(s));
  s = until(s, 472 * DAY);
  let row = s.expansion.underworld.cases.find((entry) => entry.id === id);
  assert.equal(row.status, "investigation");
  assert.equal(row.personalReserve, 420);
  assert.equal(s.expansion.underworld.chapters.moda.roster[1].generation, 2);
  s = until(s, 476 * DAY);
  row = s.expansion.underworld.cases.find((entry) => entry.id === id);
  assert.equal(row.status, "convicted");
  assert.equal(row.fineDue, 0);
  assert.equal(row.finePaid, 420);
  assert.equal(row.fineWaived, 0);
  assert.equal(row.personalReserve, 0);
  const displayed = view(s).cases.find((entry) => entry.id === id);
  assert.equal(displayed.subject, "Derya Kutlu");
  assert.equal(displayed.scope, "public");
  assert.deepEqual(displayed.actionIds, []);
});
