import test from "node:test";
import assert from "node:assert/strict";
import { createWorld, applyCommand, validateState, canonicalState } from "../simulation/engine.ts";
import {
  processBirth,
  processDeath,
  assignGuardian,
  familyMinute,
  validateFamily,
} from "../simulation/family.ts";
import { mobilityMinute } from "../simulation/mobility.ts";
import { reconcileProgression } from "../simulation/progression.ts";
import { transfer, reconcile } from "../simulation/ledger.ts";
import { encodeSave, decodeSave } from "../persistence/codec.ts";
import type { WorldState } from "../domain/types.ts";
let seq = 0;
const act = (s: WorldState, type: string, args: Record<string, unknown> = {}) =>
  applyCommand(s, { v: 1, id: `family-test:${++seq}`, type, args });
const valid = (s: WorldState) => {
  assert.deepEqual(validateFamily(s), []);
  assert.deepEqual(reconcile(s), []);
  assert.deepEqual(validateState(s), []);
};
function parents() {
  const s = createWorld(20261103),
    n = s.npcs[0];
  n.age = 30;
  n.location = { ...s.player.location, x: s.player.location.x + 0.5 };
  n.path = [];
  n.destination = null;
  n.goal = "idle";
  s.relations.push({
    from: n.id,
    to: "player",
    trust: 90,
    affection: 90,
    fear: 0,
    resentment: 0,
    lastContact: s.minute,
  });
  assert.equal(act(s, "ASK_DATE", { npcId: n.id }).ok, true);
  assert.equal(act(s, "PROPOSE_MARRIAGE", { npcId: n.id }).ok, true);
  return s;
}
function loan(s: WorldState, id: string, value: number) {
  assert.equal(transfer(s, `test-loan:${++seq}`, "bank", id, value, "test-loan"), true);
  const n = s.npcs.find((n) => n.id === id)!;
  n.debt += value;
  s.flags[`loanAsset:${id}`] = n.debt;
}
function drain(s: WorldState, id: string) {
  if (s.accounts[id])
    assert.equal(
      transfer(s, `test-drain:${++seq}`, id, "external", s.accounts[id], "test-drain"),
      true,
    );
}
const day = (s: WorldState, value: number) => {
  s.minute = value * 1440;
  s.tick = (s.minute - 480) * 10;
  mobilityMinute(s);
  familyMinute(s);
  reconcileProgression(s);
};
test("two current adult consents create one capacity-safe background child with no minted money", () => {
  const s = parents(),
    total = s.openingTotal;
  assert.equal(processBirth(s, ["player", "n0"], "unconsented").ok, false);
  assert.equal(act(s, "REQUEST_CHILD").ok, true);
  const child = s.npcs.at(-1)!;
  assert.match(child.id, /^born:/);
  assert.equal(child.age, 0);
  assert.equal(child.local, false);
  assert.equal(child.jobId, null);
  assert.equal(s.accounts[child.id], 0);
  assert.equal(s.openingTotal, total);
  assert.deepEqual(s.life.guardians[child.id], ["player", "n0"]);
  assert.equal(s.npcs.length, 1101);
  assert.equal(s.npcs.filter((n) => n.local).length, 100);
  valid(s);
  const before = canonicalState(s);
  assert.equal(processBirth(s, ["player", "n0"], s.life.births[0].id).ok, false);
  assert.equal(canonicalState(s), before);
});
test("birth capacity, parental cooldown, adult consent and global growth cap are enforced", () => {
  const s = parents(),
    home = s.life.properties.find((p) => p.id === s.player.homeId)!;
  home.capacity = 2;
  assert.equal(act(s, "REQUEST_CHILD").ok, false);
  assert.equal(s.life.births.length, 0);
  home.capacity = 4;
  assert.equal(act(s, "REQUEST_CHILD").ok, true);
  assert.equal(act(s, "REQUEST_CHILD").ok, false);
  valid(s);
  const limited = parents();
  limited.life.demography.maxBirths = 0;
  assert.equal(act(limited, "REQUEST_CHILD").ok, false);
  assert.equal(limited.npcs.length, 1100);
});
test("guardian decisions require an adult, preserve residency and are idempotent", () => {
  const s = parents();
  assert.equal(act(s, "REQUEST_CHILD").ok, true);
  const child = s.npcs.at(-1)!,
    home = child.homeId;
  assert.equal(assignGuardian(s, child.id, child.id, "invalid-guardian").ok, false);
  assert.equal(assignGuardian(s, child.id, "municipality", "public-care").ok, true);
  assert.equal(child.homeId, home);
  const before = canonicalState(s);
  assert.equal(assignGuardian(s, child.id, "municipality", "public-care").ok, false);
  assert.equal(canonicalState(s), before);
  valid(s);
});
test("guardian care spends actual funds and consumes actual stock before improving child needs", () => {
  const s = parents();
  assert.equal(act(s, "REQUEST_CHILD").ok, true);
  const child = s.npcs.at(-1)!,
    market = s.businesses.find((b) => b.id === "market")!;
  child.hunger = 80;
  const cash = s.accounts.player,
    stock = market.stock.simit;
  day(s, 1);
  assert.equal(s.accounts.player, cash - market.prices.simit * 2);
  assert.equal(market.stock.simit, stock - 2);
  assert.equal(child.hunger, 15);
  valid(s);
});
test("death retains tombstone, closes employment and social membership, pays debt before heirs", () => {
  const s = parents();
  assert.equal(act(s, "REQUEST_CHILD").ok, true);
  loan(s, "n0", 50000);
  const bank = s.accounts.bank,
    total = s.openingTotal;
  assert.equal(processDeath(s, "n0", "death-n0").ok, true);
  const n = s.npcs[0],
    estate = s.life.estates[0];
  assert.equal(n.alive, false);
  assert.equal(n.jobId, null);
  assert.equal(n.debt, 0);
  assert.equal(s.accounts.bank, bank + 50000);
  assert.equal(estate.status, "settled");
  assert.equal(estate.debts[0].paid, 50000);
  assert.equal(s.accounts[estate.accountId], 0);
  assert.ok(!s.households.some((h) => h.members.includes("n0")));
  assert.equal(s.life.partnerships.find((p) => p.a === "player")!.status, "widowed");
  assert.deepEqual(s.life.guardians[s.npcs.at(-1)!.id], ["player"]);
  assert.equal(s.openingTotal, total);
  valid(s);
  const before = canonicalState(s);
  assert.equal(processDeath(s, "n0", "repeat-death").ok, false);
  assert.equal(canonicalState(s), before);
  assert.equal(processDeath(s, "player", "player-death").ok, false);
});
test("estate insolvency records lender loss explicitly without negative money or inherited debt", () => {
  const s = createWorld(20261103);
  drain(s, "n20");
  loan(s, "n20", 12000);
  drain(s, "n20");
  const total = s.openingTotal;
  assert.equal(processDeath(s, "n20", "insolvent").ok, true);
  const estate = s.life.estates[0];
  assert.equal(estate.debts[0].writtenOff, 12000);
  assert.equal(s.flags["estateWriteOff:bank"], 12000);
  assert.equal(s.flags["loanAsset:n20"], 0);
  assert.equal(s.openingTotal, total);
  valid(s);
});
test("collectible estate assets block inheritance and forced purchase until a real buyer pays", () => {
  const s = createWorld(20261103);
  drain(s, "n0");
  loan(s, "n0", 2_000_000);
  drain(s, "n0");
  assert.equal(processDeath(s, "n0", "pending-estate").ok, true);
  const estate = s.life.estates[0];
  assert.equal(estate.status, "settling");
  assert.ok(estate.assets.includes("market"));
  assert.equal(estate.distributions.length, 0);
  valid(s);
  assert.equal(
    transfer(s, `buyer:${++seq}`, "external", "n30", 2_000_000, "test-buyer-capital"),
    true,
  );
  day(s, 1);
  assert.equal(estate.status, "settled");
  assert.equal(s.businesses.find((b) => b.id === "market")!.ownerId, "n30");
  assert.equal(estate.debts[0].paid, 1_200_000);
  assert.equal(estate.debts[0].writtenOff, 800000);
  valid(s);
});
test("executor death cannot inherit another unresolved estate or leave a dead titleholder", () => {
  const s = createWorld(20261103);
  drain(s, "n0");
  loan(s, "n0", 2_000_000);
  drain(s, "n0");
  assert.equal(processDeath(s, "n0", "first-estate").ok, true);
  const first = s.life.estates[0],
    executor = first.executorId;
  assert.equal(processDeath(s, executor, "executor-death").ok, true);
  assert.notEqual(first.executorId, executor);
  assert.ok(!s.life.estates[1].assets.includes("market"));
  assert.equal(s.businesses.find((b) => b.id === "market")!.ownerId, first.executorId);
  valid(s);
});
test("birth and debt-first estate state roundtrip preserves full references and no repeated inheritance", async () => {
  const s = parents();
  assert.equal(act(s, "REQUEST_CHILD").ok, true);
  assert.equal(processDeath(s, "n0", "saved-death").ok, true);
  const loaded = (await decodeSave(await encodeSave("slot-1", s))).state;
  assert.equal(canonicalState(loaded), canonicalState(s));
  const before = canonicalState(loaded);
  assert.equal(processDeath(loaded, "n0", "saved-death").ok, false);
  assert.equal(canonicalState(loaded), before);
  valid(loaded);
});
test("child adult roles, missing guardians and duplicate births fail invariant checks", () => {
  const s = parents();
  assert.equal(act(s, "REQUEST_CHILD").ok, true);
  const child = s.npcs.at(-1)!;
  child.jobId = "retail";
  assert.ok(validateFamily(s).some((e) => e.startsWith("family-child-adult-role:")));
  child.jobId = null;
  delete s.life.guardians[child.id];
  assert.ok(validateFamily(s).some((e) => e.startsWith("family-guardian:")));
  s.life.births.push({ ...s.life.births[0] });
  assert.ok(validateFamily(s).includes("family-duplicate-birth"));
});
test("a child ages on elapsed birth date rather than only calendar-year boundaries", () => {
  const s = parents();
  assert.equal(act(s, "REQUEST_CHILD").ok, true);
  const child = s.npcs.at(-1)!;
  day(s, 365);
  assert.equal(child.age, 0);
  day(s, 366);
  assert.equal(child.age, 1);
  const before = child.age;
  familyMinute(s);
  assert.equal(child.age, before);
  valid(s);
});
test("daily demographic events reproduce identical births deaths guardians and estates for a year", () => {
  const a = parents(),
    b = structuredClone(a);
  assert.equal(act(a, "REQUEST_CHILD").ok, true);
  const commandId = a.life.births[0].id;
  assert.equal(applyCommand(b, { v: 1, id: commandId, type: "REQUEST_CHILD", args: {} }).ok, true);
  for (let i = 1; i <= 365; i++) {
    day(a, i);
    day(b, i);
    if (i % 30 === 0) {
      valid(a);
      valid(b);
      assert.equal(canonicalState(a), canonicalState(b));
    }
  }
  assert.equal(canonicalState(a), canonicalState(b));
  assert.ok(a.life.births.length <= 24);
  assert.ok(a.life.deaths.length > 0);
  valid(a);
});
