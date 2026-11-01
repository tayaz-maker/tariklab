import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createGame,
  getActions,
  resolveAction,
  validateState,
  migrateState,
  getSocietyView,
  getDeepView,
  getAppointmentOptions,
} from "../public/games/tc-sim-boardworld/engine.mjs";
import { EVENTS } from "../public/games/tc-sim-boardworld/content.mjs";
import { initLiving, getNpcPlan } from "../public/games/tc-sim-boardworld/world-life.mjs";
import { initLife, afterLifeAction } from "../public/games/tc-sim-boardworld/life-systems.mjs";
import { initEmergent } from "../public/games/tc-sim-boardworld/emergent-life.mjs";
import { createNpcOffer, reviseNpcOffer } from "../public/games/tc-sim-boardworld/calendar.mjs";
import { venueById } from "../public/games/tc-sim-boardworld/city.mjs";
import { reveal } from "../public/games/tc-sim-boardworld/deep-life.mjs";
import { exportGame, importGame } from "../public/games/tc-sim-boardworld/persistence.mjs";
import {
  initSociety,
  validateSociety,
  tickSociety,
  nextSocietyAt,
  societyLearn,
  societyContact,
  societyNpcOptions,
  societyNpcOutcome,
  societyNpcWork,
  afterSocietyAction,
  getSocietyDistrictEffects,
} from "../public/games/tc-sim-boardworld/society-systems.mjs";
const DAY = 1440;
function fixture(at = 480) {
  const s = createGame({ scenario: "restart", seed: 7 });
  s.pendingEvents = [];
  s.resolvedEvents = EVENTS.map((e) => e.id);
  s.cash = 20000;
  s.bank = 20000;
  if (at !== s.time) {
    s.time = at;
    s.calendar.lastTick = at;
    initLiving(s);
    initLife(s);
    initEmergent(s);
    initSociety(s);
  }
  assert.ok(validateState(s));
  return s;
}
const action = (s, id) => getActions(s).find((a) => a.id === id);
function act(s, id, payload) {
  const before = structuredClone(s),
    r = resolveAction(s, id, payload);
  assert.equal(r.ok, true, `${id}: ${r.message}`);
  assert.deepEqual(s, before);
  assert.ok(validateState(r.state));
  return r.state;
}
function wait(s, at) {
  while (s.time + 60 <= at) s = act(s, "wait:60");
  while (s.time + 15 <= at) s = act(s, "wait:15");
  return s;
}
function firstOffer() {
  let s = fixture();
  for (let i = 0; i < 90 && !s.society.offers.some((o) => o.status === "open"); i++)
    s = act(s, "wait:60");
  const o = s.society.offers.find((o) => o.status === "open");
  assert.ok(o, "actual NPC needs generate an invitation");
  return s;
}
const api = {
  reveal,
  createNpcOffer,
  reviseNpcOffer,
  playerPresent: () => false,
  log() {},
  news() {},
  memory(s, id, text) {
    s.npcs[id].memories.push({ day: Math.floor(s.time / DAY) + 1, text });
    s.npcs[id].memories = s.npcs[id].memories.slice(-12);
  },
  record(s, label, amount, account) {
    s.transactions.push({ day: Math.floor(s.time / DAY) + 1, label, amount, account });
    s.transactions = s.transactions.slice(-160);
  },
  change(s, values) {
    for (const [k, v] of Object.entries(values))
      s.player[k] = Math.max(0, Math.min(100, s.player[k] + v));
  },
};
const fact = (s, id, changes = {}) => ({
  id: "promise:unit-episode",
  topic: "reliability",
  value: "Gerçek ve kaynaklı yükümlülük sonucu",
  originActorId: id,
  sourceActorId: id,
  eventAt: s.time,
  credibility: 100,
  privacy: "shareable",
  hops: 0,
  negative: true,
  corrected: false,
  proof: "promise:unit-episode",
  disclosed: true,
  ...changes,
});
function contact(s, from = "mert", to = "ece", apiValue = api) {
  societyContact(
    s,
    from,
    to,
    { kind: "social", start: s.time - 60, end: s.time, place: s.deep.npcs[to].home },
    apiValue,
  );
}
function promotion(s) {
  const before = structuredClone(s);
  s.city.visits[s.location] = 3;
  afterLifeAction(s, `visit:${s.location}-park`, before, api);
  afterSocietyAction(s, "wait:15", before, api);
  return s;
}

test("pure v4 migration preserves every old authority and initializes neutral society", () => {
  const envelope = JSON.parse(
    readFileSync(new URL("./fixtures/boardworld/v4-career-day91.json", import.meta.url), "utf8"),
  );
  const old = JSON.parse(envelope.payload),
    before = structuredClone(old),
    next = migrateState(old);
  assert.equal(next.version, 5);
  assert.deepEqual(old, before);
  for (const [k, v] of Object.entries(old)) if (k !== "version") assert.deepEqual(next[k], v, k);
  assert.ok(validateState(next));
  assert.equal(next.society.offers.length, 0);
  assert.equal(next.society.feed.length, 0);
  assert.deepEqual(migrateState(next), next);
});
test("one autonomous offer creates exactly one canonical counter and reserves no player commitment", () => {
  const s = firstOffer(),
    o = s.society.offers[0],
    entry = s.calendar.entries.find((e) => e.id === o.calendarId);
  assert.equal(s.calendar.entries.length, 1);
  assert.equal(entry.status, "counter");
  assert.equal(o.type, "meeting");
  assert.ok(o.expiresAt < entry.start);
  assert.equal(s.society.offers.filter((o) => o.status === "open").length, 1);
  const before = structuredClone(s);
  getActions(s);
  getSocietyView(s);
  assert.deepEqual(s, before);
});
test("own tentative reservation does not self-conflict on actual acceptance", () => {
  let s = firstOffer();
  const o = s.society.offers[0],
    entry = s.calendar.entries.find((e) => e.id === o.calendarId),
    beforeFunds = s.cash + s.bank;
  s = act(s, `calendar:accept:${entry.id}`);
  assert.equal(s.calendar.entries.find((e) => e.id === entry.id).status, "confirmed");
  assert.equal(s.society.offers[0].status, "accepted");
  assert.equal(s.cash + s.bank, beforeFunds);
  assert.equal(resolveAction(s, `calendar:accept:${entry.id}`).ok, false);
});
test("finite reschedule is pure when previewed and keeps the same canonical offer entry", () => {
  let s = firstOffer();
  const o = s.society.offers[0],
    old = s.calendar.entries.find((e) => e.id === o.calendarId),
    before = structuredClone(s);
  const candidates = [1, 2].map((k) => action(s, `society:reschedule:${o.id}:${k}`));
  assert.deepEqual(s, before);
  const legal = candidates.find((a) => !a.disabled);
  assert.ok(legal);
  s = act(s, legal.id);
  assert.equal(s.calendar.entries.length, 1);
  assert.equal(s.calendar.entries[0].id, old.id);
  assert.ok(s.calendar.entries[0].start > old.start);
  assert.equal(s.society.offers[0].revised, true);
  assert.equal(action(s, legal.id).disabled, true);
  s = act(s, `calendar:accept:${old.id}`);
  assert.equal(s.calendar.entries[0].status, "confirmed");
});
test("expired ignored invitation releases its slot once without broken-promise penalties", () => {
  let s = firstOffer();
  const o = s.society.offers[0],
    trust = s.npcs[o.npcId].trust;
  s = wait(s, o.expiresAt + 60);
  assert.equal(s.society.offers.find((x) => x.id === o.id).status, "expired");
  assert.equal(s.calendar.entries.find((e) => e.id === o.calendarId).status, "rejected");
  assert.equal(s.npcs[o.npcId].trust, trust);
  const once = structuredClone(s);
  tickSociety(s, api);
  assert.deepEqual(s, once);
});
test("NPC departure or unavailable money refuses acceptance without revealing balances", () => {
  const s = firstOffer(),
    o = s.society.offers[0];
  s.deep.npcs[o.npcId].cash = 0;
  const a = action(s, `calendar:accept:${o.calendarId}`);
  assert.ok(a.disabled);
  assert.doesNotMatch(a.reason, /0 TL|bakiye.*0/);
  const before = structuredClone(s),
    r = resolveAction(s, a.id);
  assert.equal(r.ok, false);
  assert.strictEqual(r.state, s);
  assert.deepEqual(s, before);
});
test("actual invited attendance debits each participant's real venue fee exactly once", () => {
  let s = firstOffer();
  const o = s.society.offers[0];
  s = act(s, `calendar:accept:${o.calendarId}`);
  const e = s.calendar.entries.find((e) => e.id === o.calendarId);
  if (s.location !== e.district) s = act(s, `travel:${e.district}`);
  s = act(s, `visit:${e.venue}`);
  s = wait(s, e.start - 30);
  const npcCash = s.deep.npcs[o.npcId].cash,
    fee = venueById(e.venue).fee,
    playerCash = s.cash;
  s = act(s, `calendar:attend:${e.id}`);
  assert.equal(s.deep.npcs[o.npcId].cash, npcCash - fee);
  assert.equal(s.cash, playerCash - fee);
  assert.equal(s.calendar.entries.find((x) => x.id === e.id).status, "completed");
  assert.equal(resolveAction(s, `calendar:attend:${e.id}`).ok, false);
});

for (const counter of [false, true])
  test(`an accepted invitation keeps its NPC fee after a public ${counter ? "counter-offer" : "direct"} reschedule`, () => {
    let s = firstOffer();
    const offerId = s.society.offers[0].id,
      oldId = s.society.offers[0].calendarId,
      npcId = s.society.offers[0].npcId;
    s = act(s, `calendar:accept:${oldId}`);
    if (s.time % DAY >= 1260) s = wait(s, (Math.floor(s.time / DAY) + 1) * DAY + 555);
    else if (s.time % DAY < 540) s = wait(s, Math.floor(s.time / DAY) * DAY + 555);
    let chosen;
    for (let offset = 2; offset <= 5 && !chosen; offset++) {
      const p = {
        kind: "meeting",
        npcId,
        subjectId: "",
        day: Math.floor(s.time / DAY) + 1 + offset,
        venue: "besiktas-cafe",
        duration: 60,
        repeat: "none",
      };
      const slot = getAppointmentOptions(s, { ...p, ignoreId: oldId }).slots.find(
        (q) => q.available && !q.rejectionExpected && q.counterExpected === counter,
      );
      if (slot) chosen = { ...p, minute: slot.minute };
    }
    assert.ok(chosen);
    s = act(s, `calendar:reschedule:${oldId}`, chosen);
    const replacementId = s.calendar.entries.findLast((e) => e.replacesId === oldId).id;
    if (counter) {
      assert.equal(s.society.offers.find((o) => o.id === offerId).calendarId, oldId);
      const poor = structuredClone(s);
      poor.deep.npcs[npcId].cash = 0;
      assert.ok(action(poor, `calendar:accept:${replacementId}`).disabled);
      s = act(s, `calendar:accept:${replacementId}`);
    }
    assert.equal(s.society.offers.find((o) => o.id === offerId).calendarId, replacementId);
    const entry = s.calendar.entries.find((e) => e.id === replacementId);
    s = act(s, `visit:${entry.venue}`);
    s = wait(s, entry.start - 15);
    const before = s.deep.npcs[npcId].cash,
      fee = venueById(entry.venue).fee;
    s = act(s, `calendar:attend:${replacementId}`);
    assert.equal(s.deep.npcs[npcId].cash, before - fee);
    assert.equal(resolveAction(s, `calendar:attend:${replacementId}`).ok, false);
  });

test("eight future accepted invitations retain their canonical links and throttle new offers", () => {
  let s = firstOffer();
  const o = s.society.offers[0];
  s = act(s, `calendar:accept:${o.calendarId}`);
  const entry = s.calendar.entries.find((e) => e.id === o.calendarId);
  for (let i = 1; i < 8; i++) {
    const e = {
      ...structuredClone(entry),
      id: `cal-${s.calendar.nextId++}`,
      start: entry.start + i * DAY,
      end: entry.end + i * DAY,
    };
    s.calendar.entries.push(e);
    s.society.offers.push({
      ...s.society.offers[0],
      id: `offer-${s.society.nextId++}`,
      calendarId: e.id,
    });
  }
  const links = s.society.offers.map((q) => q.calendarId),
    count = s.calendar.entries.length;
  s.time = (Math.floor(s.time / DAY) + 1) * DAY + 1050;
  s.society.lastInitiationDay = Math.floor(s.time / DAY);
  tickSociety(s, api);
  assert.deepEqual(
    s.society.offers.map((q) => q.calendarId),
    links,
  );
  assert.equal(s.calendar.entries.length, count, "no orphan counter is created at capacity");
  assert.ok(validateSociety(s));
});
test("private learned facts never leak through either public profile or the legacy copy loop", () => {
  const s = fixture(1110),
    beforeSociety = getSocietyView(s),
    beforeDeep = getDeepView(s);
  societyLearn(
    s,
    "mert",
    fact(s, "leyla", {
      id: "need:leyla:1",
      topic: "finance",
      privacy: "private",
      disclosed: false,
      negative: false,
    }),
    api,
  );
  assert.deepEqual(getSocietyView(s), beforeSociety);
  assert.deepEqual(getDeepView(s), beforeDeep);
  s.living.graph.mert.ece.trust = 90;
  s.time += 60;
  contact(s);
  assert.equal(s.society.transmissions.length, 0);
});
test("real contact queues a past fact snapshot with delay, reduced credibility and once-only effect", () => {
  let s = fixture(1050);
  societyLearn(s, "mert", fact(s, "mert"), api);
  s.living.graph.mert.ece.trust = 90;
  s.living.graph.mert.ece.conflict = 0;
  s.time += 60;
  contact(s);
  const q = s.society.transmissions.find((q) => q.to === "ece");
  assert.ok(q);
  assert.ok(q.dueAt >= s.time + 15);
  assert.ok(q.fact.credibility < 100);
  const value = q.fact.value;
  s.society.knowledge.mert[0].value = "Sonradan değişen özel içerik";
  const before = s.npcs.ece.trust;
  s.time = q.dueAt;
  tickSociety(s, api);
  const learned = s.society.knowledge.ece.find((f) => f.id === q.fact.id);
  assert.equal(learned.value, value);
  assert.equal(learned.hops, 1);
  assert.equal(s.npcs.ece.trust, before + learned.appliedTrust);
  const once = structuredClone(s);
  tickSociety(s, api);
  assert.deepEqual(s, once);
  societyLearn(s, "ece", q.fact, api);
  assert.deepEqual(s, once);
});
test("proven correction reverses only the actually applied reputation penalty once", () => {
  const s = fixture(1110);
  const f = fact(s, "mert", { sourceActorId: "mert", credibility: 60, disclosed: false });
  societyLearn(s, "ece", f, api);
  const penalized = s.npcs.ece.trust,
    record = s.society.knowledge.ece[0];
  assert.ok(record.appliedTrust < 0);
  societyLearn(s, "ece", { ...f, corrected: true, disclosed: true }, api);
  assert.equal(s.npcs.ece.trust, penalized - record.appliedTrust);
  const once = structuredClone(s);
  societyLearn(s, "ece", { ...f, corrected: true, disclosed: true }, api);
  assert.deepEqual(s, once);
});

test("forgotten episodes cannot cycle reputation penalties and their active effect ends once", () => {
  const s = fixture(1110),
    old = fact(s, "mert"),
    trust = s.npcs.ece.trust;
  societyLearn(s, "mert", old, api);
  societyLearn(s, "ece", old, api);
  assert.ok(s.npcs.ece.trust < trust);
  for (let i = 0; i < 13; i++) {
    s.time++;
    societyLearn(s, "ece", fact(s, "mert", { id: `new:${i}`, negative: false }), api);
  }
  assert.equal(s.npcs.ece.trust, trust);
  assert.ok(!s.society.knowledge.ece.some((f) => f.id === old.id));
  assert.ok(s.society.retiredBefore.ece.mert >= old.eventAt);
  const once = structuredClone(s);
  assert.equal(societyLearn(s, "ece", old, api), false);
  assert.equal(societyLearn(s, "ece", { ...old, corrected: true }, api), false);
  assert.deepEqual(s, once);
  s.living.graph.mert.ece.trust = 90;
  s.time += 60;
  contact(s);
  assert.ok(!s.society.transmissions.some((q) => q.to === "ece" && q.fact.id === old.id));
  assert.equal(s.npcs.ece.trust, trust);
  assert.ok(validateSociety(s));
});

test("out-of-order reports remain learnable before eviction and retained corrections remain exact", () => {
  const s = fixture(1110),
    original = s.npcs.ece.trust;
  societyLearn(
    s,
    "ece",
    fact(s, "mert", { id: "newer", eventAt: s.time - 10, negative: false }),
    api,
  );
  assert.equal(societyLearn(s, "ece", fact(s, "mert", { eventAt: s.time - 30 }), api), true);
  assert.ok(s.npcs.ece.trust < original);
  societyLearn(s, "ece", fact(s, "mert", { eventAt: s.time - 30, corrected: true }), api);
  assert.equal(s.npcs.ece.trust, original);
  for (let i = 0; i < 13; i++) {
    s.time++;
    societyLearn(s, "ece", fact(s, "mert", { id: `after:${i}`, negative: false }), api);
  }
  assert.equal(
    s.npcs.ece.trust,
    original,
    "evicting an already corrected record grants no second refund",
  );
});
test("private graph and offscreen knowledge cannot change the learned network view", () => {
  const s = fixture(1110),
    before = getSocietyView(s);
  s.living.graph.mert.ece.trust = 99;
  s.living.graph.mert.ece.conflict = 70;
  s.deep.npcs.ece.home = "sisli";
  s.deep.npcs.ece.cash = 4;
  assert.deepEqual(getSocietyView(s), before);
});
test("reconciliation is feasible state-dependent and has a cooldown, not guaranteed affinity", () => {
  const s = fixture(15 * DAY + 1110),
    a = s.living.graph.mert.ece,
    b = s.living.graph.ece.mert;
  a.conflict = 40;
  a.trust = 30;
  b.conflict = 35;
  b.trust = 25;
  s.living.npcs.mert.energy = 70;
  const before = structuredClone(s),
    options = societyNpcOptions(s, "mert");
  assert.ok(options.some((o) => o.target === "ece"));
  assert.deepEqual(s, before);
  const plan = {
    kind: "social",
    target: "ece",
    start: s.time - 60,
    end: s.time,
    location: s.deep.npcs.ece.home,
  };
  assert.equal(societyNpcOutcome(s, "mert", plan, api), true);
  assert.equal(a.conflict, 30);
  assert.equal(societyNpcOutcome(s, "mert", plan, api), false);
  const failed = fixture(15 * DAY + 1110);
  failed.living.graph.mert.ece.conflict = 40;
  failed.living.graph.mert.ece.trust = 12;
  failed.living.graph.ece.mert.trust = 5;
  assert.equal(societyNpcOutcome(failed, "mert", plan, api), true);
  assert.equal(failed.living.graph.mert.ece.conflict, 42);
});
test("food stock is consumed atomically and empty stock retains free food recovery", () => {
  let s = fixture(600);
  const before = s.society.districts.kadikoy.foodStock,
    cash = s.cash,
    cost = action(s, "buy:groceries").cost;
  s = act(s, "buy:groceries");
  assert.equal(s.society.districts.kadikoy.foodStock, before - 1);
  assert.equal(s.cash, cash - cost);
  s.society.districts.kadikoy.foodStock = 0;
  const old = structuredClone(s),
    r = resolveAction(s, "buy:groceries");
  assert.equal(r.ok, false);
  assert.deepEqual(s, old);
  assert.ok(action(s, "soup"));
  assert.doesNotMatch(action(s, "soup").reason, /stok/);
});
test("material price affects actual business capital once with conserved stock", () => {
  let s = fixture(540);
  s = act(s, "business:start:repair");
  s = act(s, "business:fund:2000");
  s.society.districts.kadikoy.weeklyDelta.stockPricePct = 110;
  const a = action(s, "business:stock:3"),
    capital = s.living.enterprise.capital,
    stock = s.living.enterprise.stock,
    supply = s.society.districts.kadikoy.materialStock,
    expense = s.deep.business.costs;
  s = act(s, a.id);
  assert.equal(s.living.enterprise.capital, capital - a.societyCost.amount);
  assert.equal(s.deep.business.costs, expense + a.societyCost.amount);
  assert.equal(s.living.enterprise.stock, stock + 3);
  assert.equal(s.society.districts.kadikoy.materialStock, supply - 3);
  s.society.districts.kadikoy.materialStock = 2;
  assert.ok(action(s, "business:stock:3").disabled);
});
test("clinic congestion adds actual reserved time while health recovery remains reachable", () => {
  let s = fixture(600);
  s.location = "sisli";
  s.player.health = 20;
  s.society.districts.sisli.weeklyDelta.serviceDelay = 20;
  const a = action(s, "clinic"),
    start = s.time;
  assert.equal(a.minutes, 110);
  s = act(s, a.id);
  assert.equal(s.time - start, 110);
  assert.ok(s.player.health > 20);
  assert.equal(s.society.districts.sisli.serviceUsed, 1);
});
test("weekly activity has bounded causal district effects and normalizes signed zero for exact saves", () => {
  const s = fixture();
  societyNpcWork(s, "mert", 8000, "kadikoy");
  s.society.districts.kadikoy.weeklyActivity.services = 30;
  s.time = 7 * DAY;
  tickSociety(s, api);
  const fx = getSocietyDistrictEffects(s, "kadikoy");
  assert.ok(fx.demand > 0);
  assert.ok(fx.jobOpenings > 2);
  assert.deepEqual(JSON.parse(JSON.stringify(s.society)), s.society);
  const once = structuredClone(s.society);
  tickSociety(s, api);
  assert.deepEqual(s.society, once);
  assert.ok(s.society.districts.kadikoy.foodStock <= 180);
});
test("secondary promotion adds bounded social edges without changing the450person total", () => {
  const s = promotion(fixture(1110));
  assert.equal(s.life.secondary.length, 1);
  assert.ok(Object.keys(s.society.secondaryEdges).length > 0);
  assert.ok(Object.keys(s.society.secondaryEdges).length <= 48);
  const total =
    Object.values(s.living.population.districts).reduce(
      (n, d) => n + d.employed + d.jobseekers + d.students,
      0,
    ) + s.life.secondary.length;
  assert.equal(total, 450);
  assert.ok(validateState(s));
});
test("society queues and imports reject unknown fields, impossible timestamps and actors", () => {
  const s = fixture();
  for (const mutate of [
    (x) => (x.society.extra = 1),
    (x) => (x.society.districts.kadikoy.foodStock = -1),
    (x) => (x.society.edgeMeta["mert>ece"].reciprocity = Infinity),
    (x) => x.society.knowledge.mert.push(fact(x, "ghost")),
    (x) => (x.society.cooldowns.ghost = 1),
    (x) => (x.society.districts.kadikoy.weeklyDelta.jobOpenings = 5),
  ]) {
    const bad = structuredClone(s);
    mutate(bad);
    assert.equal(validateSociety(bad), false);
    assert.equal(validateState(bad), false);
  }
});
test("new society state remains exact through ordinary export/import and replay", () => {
  let s = firstOffer();
  const exported = exportGame(s),
    loaded = importGame(exported).state;
  assert.deepEqual(loaded, s);
  for (const id of ["wait:15", "rest", "wait:60"]) {
    const a = resolveAction(s, id),
      b = resolveAction(loaded, id);
    assert.equal(a.ok, b.ok);
    assert.deepEqual(a.state, b.state);
  }
  assert.ok(nextSocietyAt(s) > s.time);
  assert.ok(getNpcPlan(s, s.society.offers[0].npcId).every((p) => p.end > p.start));
});

test("import rejects reused episode sequences and two offers bound to one calendar entry", () => {
  const s = firstOffer();
  const reused = structuredClone(s);
  reused.society.nextId = 1;
  assert.equal(validateState(reused), false);
  const duplicate = structuredClone(s);
  duplicate.society.offers.push({
    ...duplicate.society.offers[0],
    id: `offer-${duplicate.society.nextId++}`,
  });
  assert.equal(validateState(duplicate), false);
  const collision = structuredClone(s);
  collision.society.feed[0].id = `soc-${collision.society.offers[0].id.split("-")[1]}`;
  assert.equal(validateState(collision), false);
  const accepted = act(s, `calendar:accept:${s.society.offers[0].calendarId}`);
  accepted.society.offers[0].npcId = accepted.society.offers[0].npcId === "mert" ? "ece" : "mert";
  assert.equal(
    validateState(accepted),
    false,
    "a retained accepted link cannot charge a different actor",
  );
});

test("event, NPC receipt and player disclosure times remain distinct after feed rotation", () => {
  const s = fixture(1110),
    eventAt = s.time - 120;
  societyLearn(s, "ece", fact(s, "mert", { eventAt, disclosed: false }), api);
  const receivedAt = s.society.knowledge.ece[0].learnedAt;
  assert.equal(getSocietyView(s).profiles.find((p) => p.id === "ece").knownFacts.length, 0);
  assert.ok(
    !getActions(s).some((a) => a.id.startsWith("society:clarify:ece:")),
    "undisclosed knowledge must not leak through action descriptors",
  );
  const before = structuredClone(s);
  s.time += 30;
  afterSocietyAction(s, "call:ece", before, api);
  const f = s.society.knowledge.ece[0],
    view = getSocietyView(s),
    row = view.chronology.find((r) => r.parentId === f.id);
  assert.equal(f.learnedAt, receivedAt);
  assert.equal(row.happenedAt, eventAt);
  assert.equal(row.learnedAt, s.time);
  assert.equal(view.profiles.find((p) => p.id === "ece").knownFacts[0].learnedAt, s.time);
  s.society.feed = [];
  assert.equal(
    getSocietyView(s).profiles.find((p) => p.id === "ece").knownFacts[0].learnedAt,
    f.disclosedAt,
  );
  assert.ok(validateSociety(s));
});

test("a missed meeting records its actual calendar boundary, not the enclosing wait's end", () => {
  let s = firstOffer();
  const offer = s.society.offers[0];
  s = act(s, `calendar:accept:${offer.calendarId}`);
  const start = s.calendar.entries.find((e) => e.id === offer.calendarId).start;
  s = wait(s, start + 120);
  const entry = s.calendar.entries.find((e) => e.id === offer.calendarId);
  const f = s.society.knowledge[offer.npcId].find((f) => f.id === `calendar:${entry.id}`);
  assert.equal(entry.status, "missed");
  assert.equal(f.eventAt, entry.updatedAt);
  assert.ok(f.learnedAt > f.eventAt);
  const publicRow = getSocietyView(s).chronology.find((r) => r.parentId === f.id);
  assert.equal(publicRow.happenedAt, entry.updatedAt);
  assert.equal(publicRow.learnedAt, f.disclosedAt);
});
test("secondary contacts reserve both real schedules and settle once with no invented funds", () => {
  const s = promotion(fixture(4 * DAY + 1229)),
    n = s.life.secondary[0];
  for (const e of Object.values(s.society.secondaryEdges)) e.lastContactAt = 0;
  s.time++;
  tickSociety(s, api);
  assert.equal(s.society.sessions.length, 1);
  const session = s.society.sessions[0],
    e = s.society.secondaryEdges[`${session.from}>${session.to}`],
    trust = e.trust;
  assert.ok(validateSociety(s));
  for (const corrupt of [
    (n) => (n.life.secondary[0].busyUntil = 0),
    (n) => (n.living.npcs[session.to].plan = []),
    (n) => delete n.society.secondaryEdges[`${session.from}>${session.to}`],
  ]) {
    const invalid = structuredClone(s);
    corrupt(invalid);
    assert.equal(validateSociety(invalid), false);
  }
  assert.equal(n.busyUntil, session.endsAt);
  assert.ok(
    s.living.npcs[session.to].plan.some(
      (p) => p.id === `${session.id}:to` && p.end === session.endsAt,
    ),
  );
  const total = n.cash + s.deep.npcs[session.to].cash;
  s.time = session.endsAt;
  tickSociety(s, api);
  assert.equal(s.society.sessions.length, 0);
  assert.equal(e.trust, trust + 2);
  assert.equal(n.cash + s.deep.npcs[session.to].cash, total);
  const once = structuredClone(s);
  tickSociety(s, api);
  assert.deepEqual(s, once);
});
test("a departed participant cancels an offscreen session without fictitious contact or knowledge", () => {
  const s = promotion(fixture(4 * DAY + 1229));
  for (const e of Object.values(s.society.secondaryEdges)) e.lastContactAt = 0;
  s.time++;
  tickSociety(s, api);
  const session = s.society.sessions[0];
  assert.ok(session);
  const before = structuredClone(s.society.secondaryEdges);
  s.deep.npcs[session.to].home = session.place === "sisli" ? "kadikoy" : "sisli";
  s.time = session.endsAt;
  tickSociety(s, api);
  assert.equal(s.society.sessions.length, 0);
  for (const [key, value] of Object.entries(before))
    assert.deepEqual(s.society.secondaryEdges[key], value);
  assert.equal(s.society.transmissions.length, 0);
});
test("two-hop information cannot propagate a third time or queue the same episode twice", () => {
  const s = fixture(1110);
  societyLearn(s, "mert", fact(s, "mert", { hops: 2 }), api);
  s.living.graph.mert.ece.trust = 90;
  s.time += 60;
  contact(s);
  assert.equal(s.society.transmissions.length, 0);
  societyLearn(s, "mert", fact(s, "mert", { id: "work:another", negative: false, hops: 0 }), api);
  s.time += 60;
  contact(s);
  const count = s.society.transmissions.length;
  assert.ok(count > 0);
  contact(s);
  assert.equal(s.society.transmissions.length, count);
});
test("discounted supply respects actual capital and zero cash cannot bypass an expense", () => {
  let s = fixture(540);
  s = act(s, "business:start:repair");
  s = act(s, "business:fund:2000");
  s.society.districts.kadikoy.weeklyDelta.stockPricePct = 90;
  const cost = action(s, "business:stock:3").societyCost.amount;
  s.living.enterprise.capital = cost;
  assert.equal(action(s, "business:stock:3").disabled, false);
  s = act(s, "business:stock:3");
  assert.equal(s.living.enterprise.capital, 0);
  s.cash = 0;
  s.bank = 20000;
  const old = structuredClone(s),
    r = resolveAction(s, "buy:groceries");
  assert.equal(r.ok, false);
  assert.deepEqual(s, old);
});
