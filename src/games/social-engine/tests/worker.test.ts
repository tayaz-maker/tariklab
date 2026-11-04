import { stepWorld, applyCommand, canonicalState } from "../simulation/engine.ts";
import type { WorldState, Command } from "../domain/types.ts";
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { build } from "esbuild";
const bundle = await build({
  entryPoints: ["src/games/social-engine/worker/entry.ts"],
  bundle: true,
  format: "iife",
  write: false,
  target: "es2022",
});
function worker() {
  let callback: (() => void) | null = null,
    interval = 0;
  const messages: Record<string, unknown>[] = [];
  const tasks = new Map<number, () => void>();
  let nextTask = 0;
  const context = vm.createContext({
    performance,
    setTimeout: (fn: () => void) => {
      tasks.set(++nextTask, fn);
      return nextTask;
    },
    clearTimeout: (id: number) => {
      tasks.delete(id);
    },
    structuredClone,
    crypto,
    postMessage: (m: Record<string, unknown>) => messages.push(m),
    setInterval: (fn: () => void, ms: number) => {
      callback = fn;
      interval = ms;
      return 1;
    },
    clearInterval: () => {
      callback = null;
    },
  });
  vm.runInContext(bundle.outputFiles[0].text, context);
  const send = (message: Record<string, unknown>) =>
    context.onmessage({ data: { v: 1, ...message } });
  return {
    messages,
    send,
    tick: () => callback?.(),
    interval: () => interval,
    nextTask: () => {
      const next = tasks.entries().next().value;
      if (!next) return false;
      tasks.delete(next[0]);
      next[1]();
      return true;
    },
    snapshot: () => {
      send({ type: "SNAPSHOT_REQUEST", requestId: "test" });
      return messages.at(-1)!.state as {
        tick: number;
        minute: number;
        mobility: { speed: number };
        progression: { retired: boolean };
      };
    },
  };
}
test("GD16 worker speeds change wall cadence while each callback advances one fixed step", () => {
  const w = worker();
  w.send({ type: "INIT", seed: 20261103 });
  assert.equal(w.messages[0].type, "READY");
  assert.equal(w.interval(), 100);
  let tick = 0;
  for (const speed of [2, 0.5, 1]) {
    w.send({
      type: "COMMANDS",
      commands: [{ v: 1, id: "speed:" + speed, type: "SET_TIME_SPEED", args: { speed } }],
    });
    w.tick();
    tick++;
    assert.equal(w.interval(), 100 / speed);
    assert.equal(w.snapshot().tick, tick);
    assert.equal(w.snapshot().mobility.speed, speed);
    assert.ok(w.messages.some((m) => m.type === "RESULT" && m.id === "speed:" + speed));
  }
});
test("GD16 paused settings acknowledge queued commands without advancing or losing their IDs", () => {
  const w = worker();
  w.send({ type: "INIT" });
  w.send({
    type: "COMMANDS",
    commands: [{ v: 1, id: "stop-before-pause", type: "STOP", args: {} }],
  });
  w.send({ type: "PAUSE", paused: true });
  assert.ok(w.messages.some((m) => m.type === "RESULT" && m.id === "stop-before-pause"));
  w.send({
    type: "COMMANDS",
    commands: [{ v: 1, id: "paused-speed", type: "SET_TIME_SPEED", args: { speed: 2 } }],
  });
  assert.ok(w.messages.some((m) => m.type === "RESULT" && m.id === "paused-speed"));
  assert.equal(w.interval(), 50);
  w.tick();
  assert.equal(w.snapshot().tick, 0);
  w.send({ type: "PAUSE", paused: false });
  w.tick();
  assert.equal(w.snapshot().tick, 1);
});
test("GD14 retirement freezes the world until a real resume command is acknowledged", () => {
  const w = worker();
  w.send({ type: "INIT" });
  w.send({ type: "COMMANDS", commands: [{ v: 1, id: "retire", type: "RETIRE", args: {} }] });
  w.tick();
  assert.equal(w.snapshot().progression.retired, true);
  for (let i = 0; i < 20; i++) w.tick();
  assert.equal(w.snapshot().tick, 0);
  w.send({ type: "COMMANDS", commands: [{ v: 1, id: "resume", type: "RESUME_CAREER", args: {} }] });
  w.tick();
  assert.equal(w.snapshot().tick, 1);
  assert.equal(w.snapshot().progression.retired, false);
});
test("SE-038 production worker rejects accelerated STEP without explicit QA initialization", () => {
  const w = worker();
  w.send({ type: "INIT" });
  w.send({ type: "STEP", count: 100 });
  assert.equal(w.messages.at(-1)!.type, "ERROR");
  assert.equal(w.snapshot().tick, 0);
});

test("SE-039 worker journal records tick, paused actions and control resets in exact replay order", () => {
  const w = worker();
  w.send({ type: "INIT" });
  const base = structuredClone(w.snapshot()) as unknown as WorldState;
  w.send({
    type: "COMMANDS",
    commands: [
      {
        v: 1,
        id: "buy-recorded",
        type: "BUY",
        args: { businessId: "market", item: "simit", quantity: 1 },
      },
    ],
  });
  for (let i = 0; i < 12; i++) w.tick();
  w.send({ type: "COMMANDS", commands: [{ v: 1, id: "queued-stop", type: "STOP", args: {} }] });
  w.send({ type: "PAUSE", paused: true });
  w.send({
    type: "COMMANDS",
    commands: [{ v: 1, id: "paused-rate", type: "SET_TIME_SPEED", args: { speed: 2 } }],
  });
  w.send({ type: "PAUSE", paused: false });
  for (let i = 0; i < 12; i++) w.tick();
  const expected = w.snapshot() as unknown as WorldState;
  let cursor = 0;
  const kinds = new Set<string>();
  for (const message of w.messages) {
    if (message.type !== "JOURNAL_BATCH") continue;
    const batch = message.batch as {
      fromCursor: number;
      toCursor: number;
      operations: {
        cursor: number;
        type: string;
        endingTick?: number;
        tick?: number;
        commands?: Command[];
        paused?: boolean;
      }[];
    };
    assert.equal(batch.fromCursor, cursor);
    for (const op of batch.operations) {
      assert.equal(op.cursor, ++cursor);
      kinds.add(op.type);
      if (op.type === "TICK") {
        stepWorld(base, op.commands);
        assert.equal(base.tick, op.endingTick);
      } else if (op.type === "APPLY_WHILE_PAUSED") {
        for (const c of op.commands!) applyCommand(base, c);
        assert.equal(base.tick, op.tick);
      } else {
        if (op.paused) {
          base.flags.moveX = 0;
          base.flags.moveY = 0;
          base.flags.throttle = 0;
          base.flags.steer = 0;
        }
        assert.equal(base.tick, op.tick);
      }
    }
    assert.equal(batch.toCursor, cursor);
  }
  assert.deepEqual([...kinds].sort(), ["APPLY_WHILE_PAUSED", "PAUSE_CONTROL", "TICK"]);
  assert.equal(canonicalState(base), canonicalState(expected));
});

test("SE-039 accelerated100000tick burst yields exact snapshots and preserves interleaved command order", () => {
  const w = worker();
  w.send({ type: "INIT", seed: 20261103, qa: true });
  w.send({ type: "PAUSE", paused: true });
  const reference = structuredClone(w.snapshot()) as unknown as WorldState;
  w.send({ type: "STEP", count: 100000 });
  assert.equal(w.snapshot().tick, 500, "Snapshot must be serviced before the full burst finishes");
  // The regular wall clock must not add steps to an accelerated chunk sequence.
  w.send({ type: "PAUSE", paused: false });
  w.tick();
  assert.equal(w.snapshot().tick, 500);
  const command: Command = {
    v: 1,
    id: "between-chunks",
    type: "SET_TIME_SPEED",
    args: { speed: 2 },
  };
  w.send({ type: "COMMANDS", commands: [command] });
  for (let i = 0; i < 500; i++) stepWorld(reference);
  stepWorld(reference, [command]);
  for (let i = 501; i < 100000; i++) stepWorld(reference);
  let chunks = 0;
  while (w.nextTask()) assert.ok(++chunks < 201, "Chunk queue must terminate");
  const actual = w.snapshot() as unknown as WorldState;
  assert.equal(actual.tick, 100000);
  assert.equal(canonicalState(actual), canonicalState(reference));
  assert.equal(w.messages.filter((m) => m.type === "RESULT" && m.id === command.id).length, 1);
  assert.equal(w.messages.filter((m) => m.type === "ERROR").length, 0);
  assert.equal(w.interval(), 50);
});
