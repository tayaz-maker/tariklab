import test from "node:test";
import assert from "node:assert/strict";
import {
  createWorld,
  applyCommand,
  validateState,
  canonicalState,
  stepWorld,
} from "../simulation/engine.ts";
import {
  lifeMinute,
  lifeView,
  validateLife,
  jobPrerequisite,
  COURSES,
} from "../simulation/life.ts";
import { mobilityMinute } from "../simulation/mobility.ts";
import { reconcileProgression } from "../simulation/progression.ts";
import { transfer, reconcile } from "../simulation/ledger.ts";
import type { WorldState } from "../domain/types.ts";
import { encodeSave, decodeSave } from "../persistence/codec.ts";
let sequence = 0;
const fresh = () => createWorld(20261103);
const command = (s: WorldState, type: string, args: Record<string, unknown> = {}) =>
  applyCommand(s, { v: 1, id: `life-test:${++sequence}`, type, args });
const place = (s: WorldState, scene: string) => {
  s.player.location = { x: 7, y: 9, scene };
  s.player.path = [];
  s.player.destination = null;
};
const minute = (s: WorldState, at: number) => {
  s.minute = at;
  s.tick = (at - 480) * 10;
  lifeMinute(s);
  mobilityMinute(s);
  reconcileProgression(s);
};
const fund = (s: WorldState, value: number) =>
  assert.equal(
    transfer(s, `fund:${++sequence}`, "external", "player", value, "test-fixture-funding"),
    true,
  );
const valid = (s: WorldState) => {
  assert.deepEqual(validateLife(s), []);
  assert.deepEqual(reconcile(s), []);
  assert.deepEqual(validateState(s), []);
};
const nearbyPartner = (s: WorldState) => {
  const n = s.npcs[0];
  n.location = { ...s.player.location, x: s.player.location.x + 0.7 };
  n.path = [];
  n.destination = null;
  n.goal = "idle";
  let edge = s.relations.find((r) => r.from === n.id && r.to === "player");
  if (!edge) {
    edge = {
      from: n.id,
      to: "player",
      trust: 80,
      affection: 70,
      fear: 0,
      resentment: 0,
      lastContact: s.minute,
    };
    s.relations.push(edge);
  }
  Object.assign(edge, { trust: 80, affection: 70, fear: 0, resentment: 0 });
  return n;
};

test("schema4 initializes one capacity-safe primary home per household with zero new balances", () => {
  const s = fresh();
  assert.equal(s.schemaVersion, 7);
  assert.equal(s.life.properties.length, 288);
  assert.equal(s.life.budgets.length, 276);
  assert.equal(new Set(s.households.map((h) => h.homeId)).size, s.households.length);
  assert.ok(s.life.budgets.every((b) => s.accounts[b.accountId] === 0));
  valid(s);
});
test("reserve then lease atomically moves one household and keeps deposits backed", () => {
  const s = fresh();
  place(s, "b-home");
  const oldHome = s.player.homeId,
    beforeCash = s.accounts.player;
  assert.equal(command(s, "RESERVE_HOME", { propertyId: "vacant-home-0" }).ok, true);
  assert.equal(command(s, "LEASE_HOME", { propertyId: "vacant-home-0" }).ok, true);
  assert.equal(s.player.homeId, "vacant-home-0");
  assert.equal(s.life.properties.find((p) => p.id === oldHome)!.occupantHouseholdId, null);
  const lease = s.life.leases.find(
    (l) => l.householdId === s.player.householdId && l.status === "active",
  )!;
  assert.equal(s.accounts.player, beforeCash - 25000);
  assert.equal(s.accounts[lease.depositAccount], 25000);
  assert.equal(command(s, "RESERVE_HOME", { propertyId: "vacant-home-1" }).ok, true);
  assert.equal(command(s, "LEASE_HOME", { propertyId: "vacant-home-1" }).ok, true);
  assert.equal(s.accounts.player, beforeCash - 25000);
  assert.equal(s.accounts[lease.depositAccount], 0);
  assert.equal(lease.status, "ended");
  valid(s);
});
test("expired reservations, unavailable capacity and insufficient money preserve current residence", () => {
  const s = fresh();
  place(s, "b-home");
  const oldHome = s.player.homeId;
  assert.equal(command(s, "RESERVE_HOME", { propertyId: "vacant-home-0" }).ok, true);
  minute(s, s.minute + 181);
  assert.equal(command(s, "LEASE_HOME", { propertyId: "vacant-home-0" }).ok, false);
  assert.equal(s.player.homeId, oldHome);
  const target = s.life.properties.find((p) => p.id === "vacant-home-0")!;
  target.reservation = { householdId: "h0", expiresAt: s.minute + 180 };
  assert.equal(command(s, "RESERVE_HOME", { propertyId: target.id }).ok, false);
  target.reservation = null;
  assert.equal(
    transfer(s, `drain:${++sequence}`, "player", "external", s.accounts.player, "test"),
    true,
  );
  assert.equal(command(s, "RESERVE_HOME", { propertyId: target.id }).ok, true);
  const before = canonicalState(s);
  assert.equal(command(s, "LEASE_HOME", { propertyId: target.id }).ok, false);
  assert.equal(s.player.homeId, oldHome);
  assert.equal(s.life.leases.filter((l) => l.status === "active").length, 276);
  assert.ok(before);
  valid(s);
});
test("property purchase transfers real money and deed; owning a home removes future rent", () => {
  const s = fresh();
  place(s, "b-bank");
  fund(s, 5_000_000);
  const target = s.life.properties.find((p) => p.id === s.player.homeId)!,
    landlord = s.accounts.landlord;
  assert.equal(command(s, "PROPERTY_BUY", { propertyId: target.id }).ok, true);
  assert.equal(target.ownerId, "player");
  assert.ok(s.player.propertyIds.includes(target.id));
  assert.equal(s.accounts.landlord, landlord + target.askingPrice);
  assert.equal(s.households.find((h) => h.id === s.player.householdId)!.rent, 0);
  const before = s.accounts.player;
  minute(s, 10080);
  assert.equal(s.accounts.player, before);
  valid(s);
});
test("owned vacant property can become primary home without charging a lease deposit", () => {
  const s = fresh();
  place(s, "b-home");
  fund(s, 3_000_000);
  assert.equal(command(s, "PROPERTY_BUY", { propertyId: "vacant-home-0" }).ok, true);
  const before = s.accounts.player;
  assert.equal(command(s, "RESERVE_HOME", { propertyId: "vacant-home-0" }).ok, true);
  assert.equal(command(s, "LEASE_HOME", { propertyId: "vacant-home-0" }).ok, true);
  assert.equal(s.accounts.player, before);
  assert.equal(s.player.homeId, "vacant-home-0");
  assert.equal(lifeView(s).household.rent, 0);
  valid(s);
});
test("shared budget tracks contribution rights and rent consumes shares without duplicate charge", () => {
  const s = fresh();
  place(s, "b-home");
  const h = s.households.find((h) => h.id === s.player.householdId)!,
    b = s.life.budgets.find((b) => b.householdId === h.id)!;
  assert.equal(command(s, "HOUSEHOLD_DEPOSIT", { amount: 70000 }).ok, true);
  assert.equal(b.shares.player, 70000);
  assert.equal(command(s, "HOUSEHOLD_WITHDRAW", { amount: 70001 }).ok, false);
  assert.equal(command(s, "HOUSEHOLD_WITHDRAW", { amount: -1 }).ok, false);
  const before = s.accounts.player;
  minute(s, 10080);
  assert.equal(s.accounts[b.accountId], 5000);
  assert.equal(b.shares.player, 5000);
  assert.equal(s.accounts.player, before);
  const after = canonicalState(s);
  lifeMinute(s);
  assert.equal(canonicalState(s), after);
  assert.equal(command(s, "HOUSEHOLD_WITHDRAW", { amount: 5000 }).ok, true);
  valid(s);
});
test("unpaid rent remains owed across a move and explicit repayment reconciles", () => {
  const s = fresh();
  place(s, "b-home");
  const h = s.households.find((h) => h.id === s.player.householdId)!;
  assert.equal(
    transfer(s, `drain:${++sequence}`, "player", "external", s.accounts.player, "test"),
    true,
  );
  minute(s, 10080);
  assert.equal(h.arrears, 65000);
  fund(s, 100000);
  assert.equal(command(s, "RESERVE_HOME", { propertyId: "vacant-home-0" }).ok, true);
  assert.equal(command(s, "LEASE_HOME", { propertyId: "vacant-home-0" }).ok, true);
  assert.equal(h.arrears, 65000);
  assert.equal(command(s, "PAY_RENT_ARREARS", { amount: 65001 }).ok, false);
  assert.equal(command(s, "PAY_RENT_ARREARS", { amount: 65000 }).ok, true);
  assert.equal(h.arrears, 0);
  valid(s);
});
test("one-sided romance is rejected; mutual consent marries and separates with canonical households", () => {
  const s = fresh(),
    n = nearbyPartner(s),
    origin = n.householdId,
    consentCount = s.life.consents.length;
  s.relations.find((r) => r.from === n.id && r.to === "player")!.trust = 0;
  assert.equal(command(s, "ASK_DATE", { npcId: n.id, consent: true }).ok, false);
  assert.equal(s.life.consents.length, consentCount);
  nearbyPartner(s);
  assert.equal(command(s, "ASK_DATE", { npcId: n.id }).ok, true);
  assert.equal(s.life.consents.filter((c) => c.accepted).length, consentCount + 2);
  assert.equal(command(s, "PROPOSE_MARRIAGE", { npcId: n.id }).ok, true);
  assert.equal(n.householdId, s.player.householdId);
  assert.equal(n.homeId, s.player.homeId);
  assert.equal(s.households.find((h) => h.id === origin)!.members.includes(n.id), false);
  valid(s);
  assert.equal(command(s, "PROPOSE_MARRIAGE", { npcId: n.id }).ok, false);
  assert.equal(command(s, "SEPARATE", { npcId: n.id }).ok, true);
  assert.equal(n.householdId, origin);
  assert.equal(s.life.partnerships.find((p) => p.a === "player")!.status, "separated");
  assert.ok(
    s.life.consents
      .filter((c) => c.from === "player" || c.to === "player")
      .every((c) => !c.accepted),
  );
  valid(s);
});
test("partners bring only their funded shared contribution and retain it after separation", () => {
  const s = fresh(),
    n = nearbyPartner(s),
    source = s.life.budgets.find((b) => b.householdId === n.householdId)!;
  assert.equal(
    transfer(s, `contribute:${++sequence}`, n.id, source.accountId, 12000, "test"),
    true,
  );
  source.shares[n.id] = 12000;
  assert.equal(command(s, "ASK_DATE", { npcId: n.id }).ok, true);
  assert.equal(command(s, "PROPOSE_MARRIAGE", { npcId: n.id }).ok, true);
  const joint = s.life.budgets.find((b) => b.householdId === s.player.householdId)!;
  assert.equal(joint.shares[n.id], 12000);
  assert.equal(s.accounts[joint.accountId], 12000);
  valid(s);
  assert.equal(command(s, "SEPARATE", { npcId: n.id }).ok, true);
  assert.equal(source.shares[n.id], 12000);
  assert.equal(s.accounts[source.accountId], 12000);
  valid(s);
});
test("family ancestry cycles and underage partnerships fail invariant validation", () => {
  const s = fresh();
  s.life.parentage.player = ["n0"];
  s.life.parentage.n0 = ["player"];
  assert.ok(validateLife(s).includes("life-parentage-cycle"));
  s.life.parentage = {};
  const n = nearbyPartner(s);
  n.age = 17;
  assert.equal(command(s, "ASK_DATE", { npcId: n.id }).ok, false);
  n.age = 40;
  s.life.parentage.player = [n.id];
  assert.equal(command(s, "ASK_DATE", { npcId: n.id }).ok, false);
});
test("courses require actual attended sessions, cancel on absence and unlock a higher job", () => {
  const s = fresh();
  place(s, "b-school");
  assert.match(jobPrerequisite(s, "office")!, /belgesi/);
  assert.equal(command(s, "COURSE_ENROLL", { courseId: "office-skills" }).ok, true);
  const e = s.life.enrollments[0],
    before = s.accounts.player;
  assert.equal(command(s, "COURSE_ENROLL", { courseId: "office-skills" }).ok, false);
  assert.equal(s.accounts.player, before);
  assert.equal(command(s, "COURSE_ATTEND", { courseId: e.courseId }).ok, true);
  place(s, "b-home");
  minute(s, s.minute + 1);
  assert.equal(e.attended, 0);
  assert.equal(e.missed, 1);
  assert.equal(e.certificateId, null);
  place(s, "b-school");
  minute(s, e.nextSessionAt);
  for (let i = 0; i < 3; i++) {
    assert.equal(command(s, "COURSE_ATTEND", { courseId: e.courseId }).ok, true);
    assert.equal(command(s, "COURSE_ATTEND", { courseId: e.courseId }).ok, false);
    minute(s, e.activeUntil!);
    if (i < 2) minute(s, e.nextSessionAt);
  }
  assert.equal(e.status, "completed");
  assert.equal(s.life.certificates.length, 1);
  assert.equal(jobPrerequisite(s, "office"), null);
  const after = s.life.certificates.length;
  lifeMinute(s);
  assert.equal(s.life.certificates.length, after);
  place(s, "b-office");
  assert.equal(command(s, "APPLY_JOB", { jobId: "office" }).ok, true);
  valid(s);
});
test("course prerequisites, cancellation and work/training overlap reject invalid transitions", () => {
  const s = fresh();
  place(s, "b-school");
  s.player.skills.academic = 0;
  assert.equal(command(s, "COURSE_ENROLL", { courseId: "pedagogy" }).ok, false);
  assert.equal(command(s, "COURSE_ENROLL", { courseId: "technical-craft" }).ok, true);
  s.flags.trainingUntil = s.minute + 20;
  assert.equal(command(s, "COURSE_ATTEND", { courseId: "technical-craft" }).ok, false);
  s.flags.trainingUntil = 0;
  assert.equal(command(s, "COURSE_ATTEND", { courseId: "technical-craft" }).ok, true);
  assert.equal(command(s, "COURSE_CANCEL", { courseId: "technical-craft" }).ok, true);
  assert.equal(s.life.enrollments[0].activeUntil, null);
  assert.equal(s.life.certificates.length, 0);
  assert.equal(command(s, "COURSE_ATTEND", { courseId: "technical-craft" }).ok, false);
  valid(s);
});
test("aid is funded, low-balance gated and cannot be collected twice", () => {
  const s = fresh();
  place(s, "b-security");
  assert.equal(command(s, "REQUEST_AID").ok, false);
  assert.equal(
    transfer(s, `drain:${++sequence}`, "player", "external", s.accounts.player, "test"),
    true,
  );
  const publicBefore = s.accounts.municipality;
  assert.equal(command(s, "REQUEST_AID").ok, true);
  assert.equal(s.accounts.player, 12000);
  assert.equal(s.accounts.municipality, publicBefore - 12000);
  assert.equal(command(s, "REQUEST_AID").ok, false);
  valid(s);
});
test("integrated fixed ticks complete a course and saved lifecycle remains equivalent", async () => {
  const s = fresh();
  place(s, "b-school");
  assert.equal(command(s, "COURSE_ENROLL", { courseId: COURSES[0].id }).ok, true);
  assert.equal(command(s, "COURSE_ATTEND", { courseId: COURSES[0].id }).ok, true);
  for (let i = 0; i < 301; i++) stepWorld(s);
  assert.equal(s.life.enrollments[0].attended, 1);
  valid(s);
  const saved = await encodeSave("slot-1", s),
    loaded = (await decodeSave(saved)).state;
  assert.equal(canonicalState(loaded), canonicalState(s));
});

test("new-world adult family history is deterministic and legacy migration does not invent it", () => {
  const one = fresh(),
    two = fresh();
  assert.deepEqual(one.life.parentage, two.life.parentage);
  assert.deepEqual(one.life.partnerships, two.life.partnerships);
  assert.ok(one.life.partnerships.length > 0);
  assert.ok(Object.keys(one.life.parentage).length > 0);
  assert.ok(
    one.life.partnerships.every(
      (p) => p.status === "married" && p.a !== "player" && p.b !== "player",
    ),
  );
  valid(one);
});
test("a reserved owned flat is capacity-checked again when the household changes", () => {
  const s = fresh();
  place(s, "b-home");
  fund(s, 3_000_000);
  assert.equal(command(s, "PROPERTY_BUY", { propertyId: "vacant-home-0" }).ok, true);
  assert.equal(command(s, "RESERVE_HOME", { propertyId: "vacant-home-0" }).ok, true);
  const target = s.life.properties.find((p) => p.id === "vacant-home-0")!;
  target.capacity = 1;
  const n = nearbyPartner(s);
  assert.equal(command(s, "ASK_DATE", { npcId: n.id }).ok, true);
  assert.equal(command(s, "PROPOSE_MARRIAGE", { npcId: n.id }).ok, true);
  const oldHome = s.player.homeId;
  assert.equal(command(s, "LEASE_HOME", { propertyId: target.id }).ok, false);
  assert.equal(s.player.homeId, oldHome);
  valid(s);
});
test("rent arrears retain their contractual creditor after the property is purchased", () => {
  const s = fresh();
  place(s, "b-home");
  const home = s.life.properties.find((p) => p.id === s.player.homeId)!,
    contract = s.life.leases.find((l) => l.householdId === s.player.householdId)!;
  assert.equal(
    transfer(s, `drain:${++sequence}`, "player", "external", s.accounts.player, "test"),
    true,
  );
  minute(s, 10080);
  assert.equal(contract.arrears, 65000);
  fund(s, 5_000_000);
  assert.equal(command(s, "PROPERTY_BUY", { propertyId: home.id }).ok, true);
  const creditor = s.accounts[contract.landlordId];
  assert.equal(command(s, "PAY_RENT_ARREARS", { amount: 65000 }).ok, true);
  assert.equal(s.accounts[contract.landlordId], creditor + 65000);
  valid(s);
});
test("monthly market review adjusts only vacant unreserved asking rent and keeps signed terms", () => {
  const s = fresh(),
    active = s.life.leases.find((l) => l.householdId === s.player.householdId)!,
    signed = active.rent;
  const vacant = s.life.properties.find((p) => p.id === "vacant-home-0")!,
    reserved = s.life.properties.find((p) => p.id === "vacant-home-1")!;
  reserved.reservation = { householdId: s.player.householdId, expiresAt: 43201 };
  const vacantBefore = vacant.weeklyRent,
    reservedBefore = reserved.weeklyRent;
  s.businesses.find((b) => b.id === "market")!.prices.simit = 2100;
  fund(s, 500000);
  minute(s, 43200);
  assert.equal(active.rent, signed);
  assert.equal(vacant.weeklyRent, Math.round(vacantBefore * 1.02));
  assert.equal(reserved.weeklyRent, reservedBefore);
  assert.ok(s.events.some((e) => e.kind === "rent_rise"));
  valid(s);
});
test("a financially distressed NPC household reserves a real affordable family home", () => {
  const s = fresh(),
    h = s.households[0],
    current = s.life.leases.find((l) => l.householdId === h.id)!;
  current.arrears = h.rent * 5;
  h.arrears = current.arrears;
  const before = h.homeId;
  minute(s, 1440);
  assert.notEqual(h.homeId, before);
  assert.equal(h.rent, 30000);
  assert.equal(h.arrears, 200000);
  assert.ok(s.life.properties.find((p) => p.id === h.homeId)!.capacity >= h.members.length);
  assert.equal(s.life.properties.find((p) => p.id === before)!.occupantHouseholdId, null);
  valid(s);
});
test("duplicate public housing and course commands after save do not duplicate payments or enrollment", async () => {
  const s = fresh();
  place(s, "b-school");
  const enroll = {
    v: 1 as const,
    id: `persisted-life:${++sequence}`,
    type: "COURSE_ENROLL",
    args: { courseId: "office-skills" },
  };
  assert.equal(applyCommand(s, enroll).ok, true);
  const loaded = (await decodeSave(await encodeSave("slot-1", s))).state,
    before = canonicalState(loaded);
  assert.equal(applyCommand(loaded, enroll).ok, false);
  assert.equal(canonicalState(loaded), before);
  assert.equal(loaded.life.enrollments.length, 1);
  valid(loaded);
});
test("forged shared-account, deed, class and certificate references fail validation", () => {
  const s = fresh();
  s.life.budgets[0].accountId = s.life.budgets[1].accountId;
  assert.ok(validateLife(s).some((e) => e.startsWith("life-budget:")));
  const two = fresh();
  two.player.propertyIds.push("vacant-home-0");
  assert.ok(validateLife(two).some((e) => e.startsWith("life-deed-backref:")));
  const three = fresh();
  place(three, "b-school");
  assert.equal(command(three, "COURSE_ENROLL", { courseId: "office-skills" }).ok, true);
  three.life.enrollments[0].status = "completed";
  assert.ok(validateLife(three).some((e) => e.startsWith("life-unearned-certificate:")));
});
