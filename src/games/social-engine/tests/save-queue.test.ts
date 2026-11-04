import test from "node:test";
import assert from "node:assert/strict";
import { createSaveQueue } from "../ui/save-queue.ts";
test("manual save waits behind active automatic write and reports success only after its own commit", async () => {
  const world = {},
    order: string[] = [];
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const save = createSaveQueue(
    () => world,
    async (slot) => {
      order.push("start:" + slot);
      if (slot === "auto") await gate;
      order.push("done:" + slot);
      return true;
    },
  );
  const auto = save("auto", true);
  await Promise.resolve();
  const manual = save("slot-2");
  assert.equal(await save("auto", true), false);
  assert.deepEqual(order, ["start:auto"]);
  release();
  assert.equal(await auto, true);
  assert.equal(await manual, true);
  assert.deepEqual(order, ["start:auto", "done:auto", "start:slot-2", "done:slot-2"]);
});
test("queued snapshot cannot silently save a replacement world and a failed write does not block later requests", async () => {
  let world = { id: 1 },
    release!: () => void;
  const gate = new Promise<void>((r) => (release = r)),
    saved: string[] = [];
  const save = createSaveQueue(
    () => world,
    async (slot) => {
      if (slot === "auto") {
        await gate;
        throw Error("quota");
      }
      saved.push(slot);
      return true;
    },
  );
  const a = save("auto"),
    rejection = assert.rejects(a, /quota/);
  await Promise.resolve();
  const b = save("slot-1");
  world = { id: 2 };
  release();
  await rejection;
  assert.equal(await b, false);
  assert.deepEqual(saved, []);
  assert.equal(await save("slot-2"), true);
  assert.deepEqual(saved, ["slot-2"]);
});
test("manual queue is bounded while explicit auto-slot clicks retain manual semantics", async () => {
  const world = {};
  let release!: () => void,
    busy = 0;
  const gate = new Promise<void>((r) => (release = r));
  const save = createSaveQueue(
    () => world,
    async () => {
      await gate;
      return true;
    },
    () => busy++,
  );
  const pending = Array.from({ length: 8 }, () => save("auto"));
  assert.equal(await save("slot-1"), false);
  assert.equal(busy, 1);
  release();
  assert.deepEqual(await Promise.all(pending), Array(8).fill(true));
});
