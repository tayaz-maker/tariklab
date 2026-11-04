import test from "node:test";
import assert from "node:assert/strict";
import {
  createWorld,
  applyCommand,
  stepWorld,
  validateState,
  canonicalState,
} from "../simulation/engine.ts";
import {
  reconcileProgression,
  validateProgression,
  progressionCommand,
  progressionWageBonus,
} from "../simulation/progression.ts";
import { encodeSave, decodeSave } from "../persistence/codec.ts";
let seq = 0;
const send = (
  s: ReturnType<typeof createWorld>,
  type: string,
  args: Record<string, unknown> = {},
) => applyCommand(s, { v: 1, id: `progression:${++seq}`, type, args });
test("one daily skill allowance covers book, training and other awards and resets once per game day", () => {
  const s = createWorld(20261103),
    before = { ...s.player.skills };
  s.player.skills.academic += 15;
  reconcileProgression(s);
  s.player.skills.technical += 15;
  reconcileProgression(s);
  assert.equal(s.player.skills.academic - before.academic, 15);
  assert.equal(s.player.skills.technical - before.technical, 5);
  assert.equal(s.progression.gainedToday, 20);
  reconcileProgression(s);
  assert.equal(s.progression.gainedToday, 20);
  s.minute += 1440;
  s.tick += 14400;
  reconcileProgression(s);
  s.player.skills.driving += 3;
  reconcileProgression(s);
  assert.equal(s.progression.gainedToday, 3);
  assert.deepEqual(validateProgression(s), []);
});
test("inventory has stable unique owned unit IDs and consumes exactly the removed units", () => {
  const s = createWorld(1),
    original = s.progression.items.simit.map((i) => i.id);
  assert.equal(original.length, 2);
  assert.equal(new Set(original).size, 2);
  assert.equal(send(s, "USE_ITEM", { item: "simit" }).ok, true);
  assert.equal(s.progression.items.simit.length, 1);
  assert.equal(s.progression.items.simit[0].id, original[1]);
  const after = canonicalState(s);
  reconcileProgression(s);
  assert.equal(canonicalState(s), after);
  assert.deepEqual(validateProgression(s), []);
});
test("full item slots reject a new type or delivery before money or mission changes", () => {
  const s = createWorld(2);
  for (let i = 0; i < 12; i++) s.player.inventory[`fixture-${i}`] = 1;
  delete s.player.inventory.simit;
  reconcileProgression(s);
  const before = canonicalState(s);
  assert.equal(
    progressionCommand(s, {
      v: 1,
      id: "slot-buy",
      type: "BUY",
      args: { item: "book", businessId: "market", quantity: 1 },
    })?.ok,
    false,
  );
  assert.equal(canonicalState(s), before);
  const q = s.quests.find((q) => q.kind === "delivery")!;
  assert.ok(q);
  assert.equal(
    progressionCommand(s, { v: 1, id: "slot-quest", type: "ACCEPT_QUEST", args: { questId: q.id } })
      ?.ok,
    false,
  );
});
test("professional perk is earned once and adds a backed fixed wage offer bonus", () => {
  const s = createWorld(3);
  assert.equal(progressionWageBonus(s), 0);
  s.flags.shiftsCompleted = 5;
  reconcileProgression(s);
  reconcileProgression(s);
  assert.deepEqual(s.progression.perks, ["professional"]);
  assert.equal(progressionWageBonus(s), 500);
});
test("voluntary retirement preserves state, freezes time and permits explicit resume", () => {
  const s = createWorld(4);
  const before = s.tick;
  assert.equal(send(s, "RETIRE").ok, true);
  for (let i = 0; i < 30; i++) stepWorld(s);
  assert.equal(s.tick, before);
  assert.equal(send(s, "MOVE", { x: 1, y: 0 }).ok, false);
  assert.equal(send(s, "RESUME_CAREER").ok, true);
  stepWorld(s);
  assert.equal(s.tick, before + 1);
  assert.deepEqual(validateState(s), []);
});
test("wanted or mid-journey player cannot discard obligations by retiring", () => {
  const s = createWorld(5);
  s.player.wanted = 1;
  assert.equal(send(s, "RETIRE").ok, false);
  assert.equal(s.progression.retired, false);
});

test("item IDs, skill allowance and retirement survive an authenticated save roundtrip", async () => {
  const s = createWorld(8);
  send(s, "RETIRE");
  const envelope = await encodeSave("slot-1", s);
  const decoded = await decodeSave(envelope);
  assert.equal(canonicalState(decoded.state), canonicalState(s));
});
test("malformed skill baselines and item metadata cannot bypass daily gains or crash save validation", () => {
  const corruptions: Array<(s: ReturnType<typeof createWorld>) => void> = [
    (s) => (s.progression.lastSkills.academic = 100),
    (s) => (s.progression.lastSkills = null as never),
    (s) => (s.progression.items = null as never),
    (s) => (s.progression.items.simit = null as never),
    (s) => (s.progression.perks = null as never),
    (s) => s.progression.day++,
    (s) => (s.progression.items.simit[0].acquiredTick = -1),
    (s) => (s.progression.retiredAt = 0),
  ];
  for (const corrupt of corruptions) {
    const s = createWorld(19);
    corrupt(s);
    assert.ok(validateProgression(s).length);
    assert.doesNotThrow(() => validateState(s));
    assert.ok(validateState(s).length);
  }
});
