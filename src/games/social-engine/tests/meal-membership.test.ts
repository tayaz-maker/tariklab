import test from "node:test";
import assert from "node:assert/strict";
import {
  mealAddress,
  parseMealId,
  mealIds,
  addMeal,
  hasMeal,
  validMealMembership,
  compactLegacyMeals,
} from "../simulation/meal-membership.ts";
import { compactMealMemberships } from "../simulation/meal-migration.ts";
import { createWorld, canonicalState, validateState } from "../simulation/engine.ts";
import {
  transfer,
  readTransactionBits,
  writeTransactionBits,
  reconcile,
} from "../simulation/ledger.ts";
const id = (family: string, business: string, tick: number, npc: number) =>
  family === "v5"
    ? `meal:v5:${business}:${tick}:n${npc}`
    : `meal:queue:${business}:n${npc}:${tick}`;
// Independent predecessor addressing, used to test exact inverse compatibility.
function oldAddress(value: string) {
  const m = /^(.*?)(0|[1-9]\d*)(\D*)$/.exec(value)!;
  const n = Number(m[2]);
  return {
    key: `txset:${JSON.stringify([m[1], m[3], Math.floor(n / 4096)])}`,
    bit: 1n << BigInt(n % 4096),
  };
}
function insertOld(flags: Record<string, unknown>, value: string) {
  const a = oldAddress(value);
  flags[a.key] = writeTransactionBits(
    (flags[a.key] === undefined ? 0n : readTransactionBits(String(flags[a.key]))) | a.bit,
  );
}
function independentInverse(flags: Record<string, unknown>) {
  const result: Record<string, unknown> = {},
    bits = new Map<string, bigint>();
  for (const [k, v] of Object.entries(flags)) {
    if (!k.startsWith("txmeal:")) {
      result[k] = v;
      continue;
    }
    const [family, business, bucket] = JSON.parse(k.slice(7));
    for (const token of String(v).split(",")) {
      const pair = parseInt(token, 36),
        tick = bucket * 1024 + Math.floor(pair / 65536),
        npc = pair % 65536;
      const a = oldAddress(id(family, business, tick, npc));
      bits.set(a.key, (bits.get(a.key) ?? 0n) | a.bit);
    }
  }
  for (const [k, v] of bits) result[k] = writeTransactionBits(v);
  return result;
}
test("canonical meal identities retain family, business, every same-tick person and bucket boundaries exactly", () => {
  const flags: Record<string, string> = {},
    identities: string[] = [];
  for (const family of ["v5", "queue"])
    for (const business of ["market", "garage"])
      for (const tick of [0, 1, 1023, 1024, 4095, 4096, Number.MAX_SAFE_INTEGER])
        for (const npc of [0, 1, 4095, 4096, 65535]) {
          const value = id(family, business, tick, npc),
            a = mealAddress(value)!;
          identities.push(value);
          flags[a.key] = addMeal(flags[a.key], a.code);
          assert.ok(hasMeal(flags[a.key], a.code));
        }
  const recovered = Object.entries(flags).flatMap(([k, v]) => [...mealIds(k, v)]);
  assert.equal(new Set(recovered).size, identities.length);
  assert.deepEqual(recovered.sort(), identities.sort());
  for (const [k, v] of Object.entries(flags)) assert.ok(validMealMembership(k, v));
});
test("unrecognized meal forms remain on the predecessor addressing path", () => {
  for (const value of [
    "meal:v5:market:01:n0",
    "meal:v5:market:1:n01",
    "meal:v5:market:1:n65536",
    "meal:v5:market:9007199254740992:n0",
    "meal:v5:market:-1:n0",
    "meal:queue:market:n00:1",
    "meal:v5:market:1:n0:extra",
    "other:4",
  ])
    assert.equal(parseMealId(value), null, value);
  const state = createWorld(303);
  const value = "meal:v5:market:1:n65536";
  assert.equal(transfer(state, value, "n0", "business:market", 1, "test"), true);
  assert.equal(transfer(state, value, "n0", "business:market", 1, "test"), false);
  assert.equal(Object.keys(state.flags).filter((k) => k.startsWith("txmeal:")).length, 0);
  assert.ok(state.flags[oldAddress(value).key]);
});
test("malformed compact memberships fail closed without aliases or overflow", () => {
  for (const value of ["", "00", "1,1", "2,1", "A", "zzzzzz", "1,", "1,,2", "-1", "0,00"])
    assert.equal(validMealMembership('txmeal:["v5","market",0]', value), false, value);
  for (const key of [
    'txmeal:["other","market",0]',
    'txmeal:["v5","market",-1]',
    'txmeal:["v5","market",0,1]',
    'txmeal:["v5", "market",0]',
    "txmeal:garbage",
  ])
    assert.equal(validMealMembership(key, "1"), false, key);
  const lastBucket = Math.floor(Number.MAX_SAFE_INTEGER / 1024);
  assert.equal(
    validMealMembership(
      `txmeal:["v5","market",${lastBucket}]`,
      (1023 * 65536 + 65535).toString(36),
    ),
    true,
  );
  const state = createWorld(304);
  state.flags['txmeal:["v5","market",0]'] = "1,1";
  assert.ok(validateState(state).some((e) => e.startsWith("invalid-meal-membership:")));
});
test("migration is lossless, idempotent and preserves arbitrary flags and unrecognized historical identities", () => {
  const flags: Record<string, unknown> = {
    arbitrary: "keep",
    "txset:unrecognized": "1",
    'txset:["meal:v5:market:0:n","",99]': "1",
    'txset:["meal:v5:market:999:n","",1]': "0",
  };
  for (const family of ["queue", "v5"])
    for (const tick of [0, 1, 15, 1023, 1024, 4095, 4096])
      for (const npc of [0, 1, 15, 4095, 4096, 65535])
        insertOld(flags, id(family, "market", tick, npc));
  const before = structuredClone(flags),
    receipt = compactLegacyMeals(flags, readTransactionBits);
  assert.ok(receipt.keys > 0);
  assert.equal(receipt.members, 2 * 7 * 6);
  assert.deepEqual(independentInverse(flags), before);
  assert.equal(flags.arbitrary, "keep");
  const once = structuredClone(flags);
  assert.deepEqual(compactLegacyMeals(flags, readTransactionBits), { keys: 0, members: 0 });
  assert.deepEqual(flags, once);
});
test("owned-world conversion changes only known membership representation and requires no schema hook", () => {
  const state = createWorld(305);
  insertOld(state.flags, "meal:v5:market:1024:n0");
  insertOld(state.flags, "meal:queue:market:n0:1024");
  const before = structuredClone(state);
  assert.equal(compactMealMemberships(state), state);
  const expanded = structuredClone(state);
  expanded.flags = independentInverse(state.flags) as typeof state.flags;
  assert.equal(canonicalState(expanded), canonicalState(before));
  assert.equal(state.schemaVersion, before.schemaVersion);
  assert.equal(state.engineVersion, before.engineVersion);
});
test("old and compacted historical memberships both prevent a second debit outside the retained journal", () => {
  const state = createWorld(306),
    value = "meal:v5:market:1024:n0";
  assert.ok(!state.ledger.some((e) => e.id === value));
  insertOld(state.flags, value);
  const balances = structuredClone(state.accounts);
  assert.equal(transfer(state, value, "n0", "business:market", 1, "food"), false);
  compactMealMemberships(state);
  assert.equal(transfer(state, value, "n0", "business:market", 1, "food"), false);
  assert.deepEqual(state.accounts, balances);
  for (const value of [
    "meal:v5:market:1024:n1",
    "meal:v5:market:1025:n0",
    "meal:queue:market:n0:1024",
  ]) {
    assert.equal(transfer(state, value, "n0", "business:market", 1, "food"), true);
    assert.equal(transfer(state, value, "n0", "business:market", 1, "food"), false);
  }
  assert.deepEqual(reconcile(state), []);
  assert.deepEqual(validateState(state), []);
});
test("corrupt existing compact authority aborts migration before any source flag is deleted", () => {
  const flags: Record<string, unknown> = {};
  insertOld(flags, "meal:v5:market:1024:n0");
  flags['txmeal:["v5","market",1]'] = "00";
  const before = structuredClone(flags);
  assert.throws(() => compactLegacyMeals(flags, readTransactionBits));
  assert.deepEqual(flags, before);
});
