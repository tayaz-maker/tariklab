import test from "node:test";
import assert from "node:assert/strict";
import { createWorld, applyCommand, validateState, advanceMinutes } from "../simulation/engine.ts";
import { processDeath } from "../simulation/family.ts";
import { missionMinute } from "../simulation/missions.ts";
import { reconcile } from "../simulation/ledger.ts";

test("SE-036: unavailable active delivery target closes safely; later timeout cannot loop or refund twice", () => {
  const s = createWorld(20261103);
  const q = s.quests.find((q) => q.kind === "delivery")!;
  assert.ok(q);
  const stock = s.businesses.find((b) => b.id === "warehouse")!.stock.parts;
  assert.equal(
    applyCommand(s, {
      v: 1,
      id: "missing-target:accept",
      type: "ACCEPT_QUEST",
      args: { questId: q.id },
    }).ok,
    true,
  );
  assert.equal(q.status, "active");
  assert.equal(s.player.inventory[`parcel:${q.id}`], 1);
  const playerMoney = s.accounts.player;
  assert.equal(processDeath(s, q.targetId, "missing-target:death").ok, true);
  assert.equal(s.npcs.find((n) => n.id === q.targetId)?.alive, false);
  assert.equal(q.status, "failed");
  assert.equal(s.accounts[`escrow:${q.id}`], 0);
  assert.equal(s.player.inventory[`parcel:${q.id}`], undefined);
  assert.equal(s.businesses.find((b) => b.id === "warehouse")!.stock.parts, stock);
  const refunds = s.ledger.filter((e) => e.id === `death-quest:${q.id}`).length;
  advanceMinutes(s, Math.max(1, q.deadline - s.minute + 1));
  for (let i = 0; i < 10; i++) missionMinute(s);
  assert.equal(q.status, "failed");
  assert.equal(s.ledger.filter((e) => e.id === `death-quest:${q.id}`).length, refunds);
  assert.equal(s.accounts.player, playerMoney);
  assert.equal(
    applyCommand(s, {
      v: 1,
      id: "missing-target:complete",
      type: "COMPLETE_QUEST",
      args: { questId: q.id },
    }).ok,
    false,
  );
  assert.deepEqual(reconcile(s), []);
  assert.deepEqual(validateState(s), []);
});

test("SE-036 fault injection: a missing target reference times out with escrow and parcel returned once", () => {
  const s = createWorld(20261103),
    q = s.quests.find((q) => q.kind === "delivery")!;
  assert.equal(
    applyCommand(s, {
      v: 1,
      id: "missing-ref:accept",
      type: "ACCEPT_QUEST",
      args: { questId: q.id },
    }).ok,
    true,
  );
  q.targetId = "missing-npc-fault"; // Deliberate fault, not a valid save fixture.
  s.minute = q.deadline; // Exercise the actual timeout boundary without inventing a target.
  missionMinute(s);
  assert.equal(q.status, "expired");
  assert.equal(s.accounts[`escrow:${q.id}`], 0);
  assert.equal(s.player.inventory[`parcel:${q.id}`], undefined);
  const refundCount = s.ledger.filter((e) => e.id === `expire:${q.id}`).length;
  for (let i = 0; i < 100; i++) missionMinute(s);
  assert.equal(s.ledger.filter((e) => e.id === `expire:${q.id}`).length, refundCount);
  assert.equal(refundCount, 1);
  assert.deepEqual(reconcile(s), []);
});
