import test from "node:test";
import assert from "node:assert/strict";
import {
  createWorld,
  applyCommand,
  advanceMinutes,
  stepWorld,
  canonicalState,
} from "../simulation/engine.ts";
import {
  initializeSocial,
  tickSocial,
  validateSocial,
  shareRumor,
  reconcileSocialAfterDeath,
  recordTestimony,
} from "../simulation/social.ts";
import { emit } from "../simulation/events.ts";
import { reconcile } from "../simulation/ledger.ts";
import type { WorldState } from "../domain/types.ts";
let id = 0;
const act = (
  s: WorldState,
  type: string,
  args: Record<string, unknown> = {},
  key = `socialtest:${id++}`,
) => applyCommand(s, { v: 1, id: key, type, args });
const fresh = () => {
  const s = createWorld(20261103);
  if (!s.social) initializeSocial(s);
  return s;
};
const valid = (s: WorldState) => {
  assert.deepEqual(validateSocial(s), []);
  assert.deepEqual(reconcile(s), []);
};
const join = (s: WorldState, factionId = "dock") => {
  s.player.reputation = 10;
  assert.equal(act(s, "JOIN_FACTION", { factionId }).ok, true);
};

test("social initialization and migration add no money and preserve observed knowledge only", () => {
  const s = fresh(),
    before = { ...s.accounts },
    opening = s.openingTotal;
  initializeSocial(s, true);
  for (const [account, balance] of Object.entries(before))
    assert.equal(s.accounts[account], balance);
  assert.equal(s.openingTotal, opening);
  assert.equal(s.social.factions.length, 3);
  assert.ok(
    s.social.factions.every(
      (f) =>
        f.members.filter((m) => m.role === "leader").length === 1 &&
        s.accounts[f.treasuryAccount] === 0,
    ),
  );
  valid(s);
});
test("faction membership is unique, donation exact-once, service funded and territory changes gradually", () => {
  const s = fresh();
  join(s);
  const original = canonicalState(s);
  assert.equal(act(s, "JOIN_FACTION", { factionId: "dock" }).ok, false);
  assert.equal(
    s.social.factions.filter((f) => f.members.some((m) => m.personId === "player")).length,
    1,
  );
  assert.equal(act(s, "FACTION_DONATE", { amount: 10000 }, "donate-once").ok, true);
  const money = s.accounts.player;
  assert.equal(act(s, "FACTION_DONATE", { amount: 10000 }, "donate-once").ok, false);
  assert.equal(s.accounts.player, money);
  s.player.location = { x: 7, y: 9, scene: "b-market" };
  const zone = s.social.territories.find((z) => z.id === "market")!,
    before = { ...zone.influence };
  assert.equal(act(s, "FACTION_SERVICE", { territoryId: "market" }, "service-once").ok, true);
  assert.equal(zone.influence.dock, before.dock + 1);
  assert.equal(
    Object.values(zone.influence).reduce((a, b) => a + b, 0),
    100,
  );
  assert.equal(act(s, "FACTION_SERVICE", { territoryId: "market" }).ok, false);
  assert.equal(s.accounts["faction:dock"], 8000);
  assert.notEqual(canonicalState(s), original);
  valid(s);
});
test("invalid social payments and unavailable service preserve every financial account and role", () => {
  const s = fresh();
  join(s);
  const before = JSON.stringify({
    accounts: s.accounts,
    factions: s.social.factions,
    territories: s.social.territories,
  });
  for (const amount of [-100, NaN, Infinity, 1.1, 100001])
    assert.equal(act(s, "FACTION_DONATE", { amount }).ok, false);
  assert.equal(act(s, "FACTION_SERVICE", { territoryId: "market" }).ok, false);
  assert.equal(
    JSON.stringify({
      accounts: s.accounts,
      factions: s.social.factions,
      territories: s.social.territories,
    }),
    before,
  );
  valid(s);
});
test("betrayal cannot be farmed and leaves protected memories and a persistent distrust edge", () => {
  const s = fresh();
  join(s);
  const leader = s.social.factions[0].members.find((m) => m.role === "leader")!.personId;
  assert.equal(act(s, "JOIN_FACTION", { factionId: "night" }).ok, false);
  advanceMinutes(s, 1440);
  assert.equal(act(s, "JOIN_FACTION", { factionId: "night" }).ok, true);
  tickSocial(s);
  assert.ok(s.relations.some((r) => r.from === leader && r.to === "player" && r.trust <= -20));
  assert.ok(
    s.social.knowledge[leader].some(
      (m) => m.critical && s.events.find((e) => e.id === m.eventId)?.kind === "faction_betrayal",
    ),
  );
  assert.equal(
    s.social.factions.filter((f) => f.members.some((m) => m.personId === "player")).length,
    1,
  );
  valid(s);
});
test("rumors require known nearby source, attenuate confidence and cannot become certain or circular", () => {
  const s = fresh();
  s.npcs[1].location = { ...s.npcs[0].location, x: s.npcs[0].location.x + 0.3 };
  s.npcs[2].location = { ...s.npcs[0].location, x: s.npcs[0].location.x + 0.4 };
  const secret = emit(
    s,
    "private_note",
    "Yalnızca iki kişinin bildiği olay.",
    ["n0"],
    "n50",
    "private",
  );
  tickSocial(s);
  assert.ok(!s.social.knowledge.n50?.some((m) => m.eventId === secret.id));
  assert.equal(shareRumor(s, "n99", "n1", secret.id), false);
  assert.equal(shareRumor(s, "n0", "n1", secret.id), true);
  assert.equal(shareRumor(s, "n1", "n2", secret.id), true);
  const memory = s.social.knowledge.n2.find((m) => m.eventId === secret.id)!;
  assert.equal(memory.confidence, 56);
  assert.deepEqual(memory.chain, ["n0", "n1", "n2"]);
  assert.equal(shareRumor(s, "n2", "n0", secret.id), false);
  assert.ok(!s.social.knowledge.player?.some((m) => m.eventId === secret.id));
  valid(s);
});
test("memory salience decays deterministically while critical memories survive routine churn", () => {
  const s = fresh();
  const critical = emit(s, "faction_betrayal", "Önemli geçmiş.", ["n0"], null, "private");
  for (let n = 0; n < 100; n++) emit(s, "routine_note", String(n), ["n0"], null, "private");
  tickSocial(s);
  assert.ok(s.social.knowledge.n0.some((m) => m.eventId === critical.id));
  assert.equal(s.social.knowledge.n0.length, 64);
  const clone = JSON.parse(canonicalState(s)) as WorldState;
  advanceMinutes(s, 1440);
  advanceMinutes(clone, 1440);
  assert.equal(canonicalState(s), canonicalState(clone));
  assert.ok(s.social.knowledge.n0.find((m) => m.eventId === critical.id)!.salience >= 25);
  valid(s);
});
test("dead faction leader is replaced synchronously by one living adult and treasury is unchanged", () => {
  const s = fresh(),
    f = s.social.factions[0],
    leader = f.members.find((m) => m.role === "leader")!.personId;
  s.npcs.find((n) => n.id === leader)!.alive = false;
  const before = s.accounts[f.treasuryAccount];
  reconcileSocialAfterDeath(s, leader);
  assert.equal(f.members.filter((m) => m.role === "leader").length, 1);
  assert.ok(!f.members.some((m) => m.personId === leader));
  assert.equal(s.accounts[f.treasuryAccount], before);
  valid(s);
});
test("false testimony stays separate from evidence and can be contradicted only after reported eyewitness evidence", () => {
  const s = fresh();
  s.crimes.push({
    id: "case-test",
    offender: "player",
    victim: "n0",
    witnesses: ["n1"],
    evidence: ["saw:n1"],
    reported: false,
    status: "unreported",
    tick: 0,
    fine: 1000,
  });
  const physical = JSON.stringify(s.crimes[0].evidence);
  const report = recordTestimony(s, "player", "case-test", "n2")!;
  assert.equal(report.status, "unverified");
  s.minute += 11;
  s.tick += 110;
  tickSocial(s);
  assert.equal(report.status, "unverified");
  assert.equal(JSON.stringify(s.crimes[0].evidence), physical);
  s.crimes[0].reported = true;
  tickSocial(s);
  assert.equal(report.status, "contradicted");
  assert.equal(JSON.stringify(s.crimes[0].evidence), physical);
  assert.equal(s.player.reputation, -10);
  const rep = s.player.reputation;
  tickSocial(s);
  assert.equal(s.player.reputation, rep);
  assert.equal(recordTestimony(s, "player", "case-test", "n2"), null);
  valid(s);
});
test("study club is independent of criminal membership and requires real attendance for hierarchy", () => {
  const s = fresh();
  s.player.location = { x: 7, y: 9, scene: "b-school" };
  assert.equal(act(s, "CLUB_JOIN").ok, true);
  assert.equal(s.flags.faction, "");
  assert.equal(act(s, "CLUB_SESSION").ok, true);
  s.player.location = { x: 27, y: 16, scene: "outside" };
  stepWorld(s);
  assert.equal(s.social.club.activity, null);
  assert.equal(s.social.club.members.find((m) => m.personId === "player")!.standing, 0);
  s.player.location = { x: 7, y: 9, scene: "b-school" };
  assert.equal(act(s, "CLUB_SESSION").ok, true);
  advanceMinutes(s, 30);
  assert.equal(s.social.club.members.find((m) => m.personId === "player")!.standing, 10);
  assert.equal(act(s, "CLUB_SESSION").ok, false);
  advanceMinutes(s, 60);
  assert.equal(act(s, "CLUB_SESSION").ok, true);
  advanceMinutes(s, 30);
  assert.equal(s.social.club.members.find((m) => m.personId === "player")!.role, "member");
  assert.equal(s.flags.faction, "");
  valid(s);
});
test("social validator rejects duplicate leaders, forged rumor chains and underage membership", () => {
  const s = fresh();
  s.social.factions[0].members[1].role = "leader";
  assert.ok(validateSocial(s).some((e) => e.startsWith("faction-leader")));
  s.social.factions[0].members[1].role = "member";
  s.npcs.find((n) => n.id === s.social.factions[0].members[1].personId)!.age = 12;
  assert.ok(validateSocial(s).some((e) => e.startsWith("faction-member")));
  const b = fresh();
  const e = emit(b, "private_note", "secret", ["n0"], null, "private");
  tickSocial(b);
  b.social.knowledge.n0[0].chain = ["n99", "n0"];
  b.social.knowledge.n0[0].eventId = e.id;
  assert.ok(validateSocial(b).some((e) => e.startsWith("knowledge")));
});

test("three paid services unlock officer hierarchy; leaving cannot erase the old loyalty bond", () => {
  const s = fresh();
  join(s);
  assert.equal(act(s, "FACTION_DONATE", { amount: 10000 }).ok, true);
  s.player.location = { x: 7, y: 9, scene: "b-market" };
  assert.equal(act(s, "FACTION_PROMOTE").ok, false);
  for (let i = 0; i < 3; i++) {
    assert.equal(act(s, "FACTION_SERVICE", { territoryId: "market" }).ok, true);
    if (i < 2) advanceMinutes(s, 60);
  }
  assert.equal(act(s, "FACTION_PROMOTE").ok, true);
  assert.equal(s.social.factions[0].members.find((m) => m.personId === "player")!.role, "officer");
  assert.equal(act(s, "LEAVE_FACTION").ok, true);
  tickSocial(s);
  assert.equal(s.flags.faction, "");
  assert.ok(s.social.bonds.some((b) => b.from === "player" || b.to === "player"));
  valid(s);
});
test("public rumor and statement commands validate reachability, source and station prerequisites", () => {
  const s = fresh();
  s.npcs[1].location = { ...s.player.location, x: s.player.location.x + 0.5 };
  const memory = emit(s, "private_note", "Oyuncunun gözlemi.", ["player"], null, "private");
  tickSocial(s);
  assert.equal(act(s, "SHARE_RUMOR", { npcId: "n1", eventId: memory.id }).ok, true);
  assert.equal(act(s, "SHARE_RUMOR", { npcId: "n1", eventId: memory.id }).ok, false);
  s.crimes.push({
    id: "public-statement",
    offender: "n2",
    victim: "n0",
    witnesses: [],
    evidence: [],
    reported: false,
    status: "unreported",
    tick: s.tick,
    fine: 1000,
  });
  assert.equal(
    act(s, "FILE_TESTIMONY", { crimeId: "public-statement", accusedId: "n2" }).ok,
    false,
  );
  s.player.location = { x: 7, y: 9, scene: "b-police" };
  assert.equal(act(s, "FILE_TESTIMONY", { crimeId: "public-statement", accusedId: "n2" }).ok, true);
  assert.equal(s.social.testimonies.at(-1)!.status, "unverified");
  assert.deepEqual(s.crimes[0].evidence, []);
  valid(s);
});
test("concurrent course or training start cancels club attendance rather than awarding both", () => {
  const s = fresh();
  s.player.location = { x: 7, y: 9, scene: "b-school" };
  assert.equal(act(s, "CLUB_JOIN").ok, true);
  assert.equal(act(s, "CLUB_SESSION").ok, true);
  assert.equal(act(s, "TRAIN", { skill: "academic" }).ok, true);
  stepWorld(s);
  assert.equal(s.social.club.activity, null);
  assert.equal(s.social.club.members.find((m) => m.personId === "player")!.standing, 0);
  valid(s);
});
test("malformed social containers fail closed without throwing in the save validator", () => {
  for (const mutate of [
    (s: WorldState) => {
      s.social.factions[0] = null as never;
    },
    (s: WorldState) => {
      s.social.factions[0].members[0] = null as never;
    },
    (s: WorldState) => {
      s.social.territories[0] = null as never;
    },
    (s: WorldState) => {
      s.social.knowledge.player = [null as never];
    },
    (s: WorldState) => {
      s.social.testimonies = [null as never];
    },
    (s: WorldState) => {
      s.social.club.members[0] = null as never;
    },
  ]) {
    const s = fresh();
    mutate(s);
    assert.ok(validateSocial(s).length > 0);
  }
});

test("dead tombstones keep historical memories but cannot learn newly emitted events", () => {
  const s = fresh();
  const old = emit(s, "private_note", "Yaşarken gözlendi.", ["n0"], null, "private");
  tickSocial(s);
  s.npcs[0].alive = false;
  const current = emit(s, "private_note", "Ölüm sonrası olay.", ["n0", "n1"], null, "private");
  tickSocial(s);
  assert.ok(s.social.knowledge.n0.some((m) => m.eventId === old.id));
  assert.ok(!s.social.knowledge.n0.some((m) => m.eventId === current.id));
  assert.ok(s.social.knowledge.n1.some((m) => m.eventId === current.id));
});
