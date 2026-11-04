import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import {
  createWorld,
  applyCommand,
  advanceMinutes,
  validateState,
  canonicalState,
} from "../simulation/engine.ts";
import {
  requestService,
  requestNpcMeal,
  servicesMinute,
  serviceOpen,
  serviceHours,
  validateServices,
} from "../simulation/services.ts";
import { reconcileStaffing } from "../simulation/economy.ts";
import { migrateState, encodeSave, decodeSave } from "../persistence/codec.ts";
let sequence = 0;
const buy = (s: ReturnType<typeof createWorld>) =>
  applyCommand(s, {
    v: 1,
    id: `service:${++sequence}`,
    type: "BUY",
    args: { businessId: "market", item: "tea" },
  });
test("opening hours reject closed purchases without money/stock loss and reopen on the fixed clock", () => {
  const s = createWorld(11),
    b = s.businesses.find((b) => b.id === "market")!;
  s.player.location = { x: 7, y: 9, scene: "b-market" };
  advanceMinutes(s, 15 * 60);
  const cash = s.accounts.player,
    stock = b.stock.tea;
  assert.equal(serviceOpen(s, b), false);
  assert.equal(buy(s).ok, false);
  assert.equal(s.accounts.player, cash);
  assert.equal(b.stock.tea, stock);
  advanceMinutes(s, 7 * 60);
  assert.equal(serviceOpen(s, b), true);
  let purchase = buy(s);
  for (
    let minute = 0;
    !purchase.ok && /Sıran korunuyor/.test(purchase.reason) && minute < 8;
    minute++
  ) {
    advanceMinutes(s, 1);
    purchase = buy(s);
  }
  assert.equal(purchase.ok, true, purchase.reason);
  assert.deepEqual(validateState(s), []);
});
test("bounded queue shares service capacity between NPCs and player, preserves FIFO and charges only completed purchases", async () => {
  const s = createWorld(12),
    b = s.businesses.find((b) => b.id === "market")!;
  s.player.location = { x: 7, y: 9, scene: "b-market" };
  for (const n of s.npcs.slice(0, 20)) {
    n.location = { x: 7, y: 7, scene: "b-market" };
    n.goal = "eat";
    n.hunger = 90;
    requestNpcMeal(s, n);
  }
  const before = s.accounts.player;
  assert.equal(buy(s).ok, false);
  assert.equal(s.accounts.player, before);
  assert.equal(s.economy.services.market.queue.length, 21);
  servicesMinute(s);
  assert.equal(s.economy.services.market.served, 12);
  assert.equal(buy(s).ok, false);
  const restored = (await decodeSave(await encodeSave("slot-1", s))).state;
  advanceMinutes(s, 1);
  advanceMinutes(restored, 1);
  assert.equal(canonicalState(s), canonicalState(restored));
  assert.equal(s.economy.services.market.queue[0].personId, "player");
  assert.equal(buy(s).ok, true);
  assert.equal(s.accounts.player, before - b.prices.tea);
  assert.deepEqual(validateState(s), []);
});
test("full waiting area rejects extra identities, stale/leaving reservations expire, forged duplicate queues fail validation", () => {
  const s = createWorld(13),
    b = s.businesses.find((b) => b.id === "market")!;
  for (const n of s.npcs.slice(0, 65)) {
    n.location = { x: 7, y: 7, scene: "b-market" };
    requestService(s, b, n);
  }
  assert.equal(s.economy.services.market.queue.length, 64);
  assert.match(requestService(s, b, s.npcs[64]).reason, /dolu/);
  const q = s.economy.services.market.queue[0];
  s.economy.services.market.queue.push({ ...q });
  assert.ok(validateServices(s).length);
  s.economy.services.market.queue.pop();
  s.npcs[0].location = { x: 27, y: 16, scene: "outside" };
  servicesMinute(s);
  assert.ok(!s.economy.services.market.queue.some((q) => q.personId === "n0"));
});
test("authentic schema4 migration adds empty service reservations and preserves all owned finances and simulation histories", () => {
  const before = JSON.parse(
    gunzipSync(
      readFileSync(new URL("../persistence/fixtures/v4-world.json.gz", import.meta.url)),
    ).toString("utf8"),
  );
  const bytes = JSON.stringify(before),
    after = migrateState(before);
  assert.equal(after.schemaVersion, 7);
  assert.equal(JSON.stringify(before), bytes);
  for (const field of [
    "accounts",
    "player",
    "npcs",
    "ledger",
    "life",
    "social",
    "mobility",
    "progression",
  ] as const)
    assert.deepEqual(after[field], before[field]);
  assert.equal(
    Object.values(after.economy.services).every((d) => !d.queue.length),
    true,
  );
  assert.deepEqual(validateState(after), []);
});
test("distress with unsold output creates a bounded real layoff, healthy businesses and repeat processing cannot fabricate unemployment", () => {
  const s = createWorld(14),
    b = s.businesses.find((b) => b.id === "garage")!;
  b.stock.simit = 600;
  const count = b.employees.length;
  reconcileStaffing(s);
  assert.equal(b.employees.length, count);
  b.status = "distressed";
  reconcileStaffing(s);
  assert.equal(b.employees.length, count - 1);
  const event = [...s.events].reverse().find((e) => e.kind === "layoff")!;
  const person = s.npcs.find((n) => n.id === event.actors[0])!;
  assert.equal(person.jobId, null);
  assert.equal(person.employerId, null);
  assert.equal(
    s.crimes.some((c) => c.offender === person.id),
    false,
  );
  reconcileStaffing(s);
  assert.equal(b.employees.length, count - 1);
  assert.deepEqual(validateState(s), []);
});

test("tea and bank service hours bind actual business identities", () => {
  assert.deepEqual(serviceHours("tea"), [360, 1440]);
  assert.deepEqual(serviceHours("bank"), [480, 1080]);
  const s = createWorld(18);
  advanceMinutes(s, 16 * 60);
  for (const id of ["tea", "bank"])
    assert.equal(
      serviceOpen(
        s,
        s.businesses.find((b) => b.id === id)!,
      ),
      false,
    );
});

test("meal settlements group shared queue ticks while retaining every distinct person and reject forged queue identities", async () => {
  const s = createWorld(19),
    b = s.businesses.find((b) => b.id === "market")!;
  for (const p of s.npcs.slice(0, 12)) {
    p.location = { x: 7, y: 7, scene: "b-market" };
    p.goal = "eat";
    p.hunger = 90;
    requestNpcMeal(s, p);
  }
  servicesMinute(s);
  const settled = s.ledger.filter((e) => e.id.startsWith("meal:v5:"));
  assert.equal(settled.length, 12);
  assert.equal(new Set(settled.map((e) => e.id)).size, 12);
  assert.equal(
    Object.keys(s.flags).filter((k) => k.startsWith('txset:["meal:v5:market:0:n"')).length,
    1,
  );
  const decoded = (await decodeSave(await encodeSave("auto", s))).state;
  assert.equal(canonicalState(decoded), canonicalState(s));
  s.npcs[12].location = { x: 7, y: 7, scene: "b-market" };
  requestService(s, b, s.npcs[12]);
  s.economy.services.market.queue[0].id = "queue:market:n13:0";
  assert.ok(validateServices(s).some((e) => e.includes("reservation")));
});
