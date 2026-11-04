import test from "node:test";
import assert from "node:assert/strict";
import { createWorld, applyCommand, validateState, advanceMinutes } from "../simulation/engine.ts";
import { encodeSave, decodeSave } from "../persistence/codec.ts";
for (const job of ["retail", "mechanic"] as const)
  test(
    job + " shift: physical stock, counterparties, one order even after restore, ordinary payroll",
    async () => {
      let s = createWorld(),
        seq = 0;
      const cmd = (type: string, args: Record<string, unknown> = {}) =>
        applyCommand(s, { v: 1, id: "work:" + ++seq, type, args });
      const shopId = job === "retail" ? "market" : "garage",
        get = (id: string) => s.businesses.find((b) => b.id === id)!;
      s.player.location = { scene: get(shopId).buildingId, x: 7, y: 9 };
      assert.ok(cmd("APPLY_JOB", { jobId: job }).ok);
      assert.ok(cmd("START_SHIFT", { workOrder: true }).ok);
      const wage = s.player.shift!.wage,
        cash = s.accounts.player,
        balance = s.accounts["business:" + shopId],
        inventory = get(shopId).stock.simit,
        parts = get(shopId).stock.parts,
        other = get("tea").stock.simit,
        metal = s.economy.wholesaler.metal;
      assert.equal(cmd("FINISH_WORK_ORDER", { choice: "forged" }).ok, false);
      const choice = job === "retail" ? "tea" : "batch";
      assert.ok(cmd("FINISH_WORK_ORDER", { choice }).ok);
      if (job === "retail") {
        assert.equal(get("market").stock.simit, inventory - 6);
        assert.equal(get("tea").stock.simit, other + 6);
        assert.ok(s.accounts["business:market"] > balance);
      } else {
        assert.equal(get("garage").stock.parts, parts + 3);
        assert.equal(s.economy.wholesaler.metal, metal - 3);
        assert.ok(s.accounts["business:garage"] < balance);
      }
      assert.equal(s.accounts.player, cash);
      s = (await decodeSave(await encodeSave("slot-1", s))).state;
      assert.equal(cmd("FINISH_WORK_ORDER", { choice }).ok, false);
      advanceMinutes(s, 60);
      assert.equal(s.player.shift, null);
      assert.equal(s.accounts.player, cash + wage);
      assert.deepEqual(validateState(s), []);
    },
  );
