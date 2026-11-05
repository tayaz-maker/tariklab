import test from "node:test";
import assert from "node:assert/strict";
import { createSimulationRuntime } from "../../src/games/social-engine/worker/runtime.ts";
import { createWorld, applyCommand } from "../../src/games/social-engine/simulation/engine.ts";
import {
  replayActionEvidence,
  installActionObserver,
  stepRetiredWorld,
} from "./action-evidence.mjs";

function harness(save) {
  let tick;
  const originalInterval = globalThis.setInterval;
  const originalClear = globalThis.clearInterval;
  globalThis.setInterval = (fn) => {
    tick = fn;
    return 1;
  };
  globalThis.clearInterval = () => {};
  const received = [];
  const scope = { postMessage: (data) => received.push(structuredClone(data)), onmessage: null };
  const runtime = createSimulationRuntime(scope);
  const send = (data) => scope.onmessage({ data: { v: 1, ...data } });
  send({ type: "INIT", seed: 20261103, save, qa: true });
  send({ type: "SNAPSHOT_REQUEST", requestId: "baseline" });
  const baseline = received.at(-1);
  return {
    received,
    baseline,
    send,
    tick: () => tick(),
    close() {
      runtime.dispose();
      globalThis.setInterval = originalInterval;
      globalThis.clearInterval = originalClear;
    },
  };
}

test("full runtime journal proves dodge at action tick even when observation arrives after its window", () => {
  const h = harness();
  try {
    const command = { v: 1, id: "keyboard:dodge", type: "DODGE", args: {} };
    h.send({ type: "COMMANDS", commands: [command] });
    for (let i = 0; i < 20; i++) h.tick();
    h.send({ type: "SNAPSHOT_REQUEST", requestId: "late" });
    const late = h.received.at(-1).state;
    assert.ok(
      late.flags.dodgeUntil <= late.tick,
      "old later-snapshot assertion reproduces failure",
    );
    const action = replayActionEvidence({ ...h, sent: [command] }, "DODGE");
    assert.ok(action.state.flags.dodgeUntil > action.state.tick);
    assert.ok(action.state.flags.dodgeUntil <= action.state.tick + 6);
    assert.equal(action.operation.endingTick, action.state.tick);
    const missing = h.received.filter((m) => m.type !== "JOURNAL_BATCH");
    assert.throws(
      () =>
        replayActionEvidence({ baseline: h.baseline, sent: [command], received: missing }, "DODGE"),
      /full worker journal/,
    );
  } finally {
    h.close();
  }
});

test("rumor evidence requires successful real command ID and selected recipient provenance", () => {
  const save = createWorld(20261103);
  for (const [i, type] of ["RETIRE", "RESUME_CAREER"].entries())
    assert.equal(applyCommand(save, { v: 1, id: `setup:${i}`, type, args: {} }).ok, true);
  const event = save.social.knowledge.player.at(-1);
  save.npcs[0].location = { ...save.player.location };
  const h = harness(save);
  try {
    const command = {
      v: 1,
      id: "dom:rumor",
      type: "SHARE_RUMOR",
      args: { npcId: save.npcs[0].id, eventId: event.eventId },
    };
    h.send({ type: "COMMANDS", commands: [command] });
    assert.equal(
      h.received.some((m) => m.type === "RESULT" && m.id === command.id),
      false,
      "observation before worker tick cannot prove completion",
    );
    h.tick();
    h.send({ type: "SNAPSHOT_REQUEST", requestId: "after" });
    const action = replayActionEvidence({ ...h, sent: [command] }, "SHARE_RUMOR");
    const learned = action.state.social.knowledge[command.args.npcId].find(
      (k) => k.eventId === event.eventId && k.sourceId === "player",
    );
    assert.ok(learned);
    assert.ok(learned.confidence < event.confidence);
  } finally {
    h.close();
  }
});

test("passive Worker observer preserves outgoing messages and captures actual RESULT IDs", () => {
  const originalWindow = globalThis.window;
  class NativeWorker extends EventTarget {
    postMessage(...args) {
      this.last = args;
      return "native-return";
    }
  }
  globalThis.window = { Worker: NativeWorker };
  try {
    installActionObserver();
    const worker = new window.Worker();
    const command = { id: "actual:1", type: "DODGE" };
    const message = { type: "COMMANDS", commands: [command] };
    window.__actionWire.armed = true;
    assert.equal(worker.postMessage(message), "native-return");
    assert.equal(worker.last[0], message);
    const data = { type: "RESULT", id: command.id, result: { ok: true } };
    worker.dispatchEvent(new MessageEvent("message", { data }));
    assert.equal(window.__actionWire.sent[0], command);
    assert.equal(window.__actionWire.received[0], data);
  } finally {
    globalThis.window = originalWindow;
  }
});

test("heavy keyboard command cost is proven at action tick after later idle regeneration erased it", () => {
  const save = createWorld(20261103);
  save.npcs[0].location = { ...save.player.location };
  const h = harness(save);
  try {
    const command = {
      v: 1,
      id: "keyboard:heavy",
      type: "ATTACK",
      args: { npcId: save.npcs[0].id, heavy: true },
    };
    h.send({ type: "COMMANDS", commands: [command] });
    for (let i = 0; i < 80; i++) h.tick();
    h.send({ type: "SNAPSHOT_REQUEST", requestId: "regenerated" });
    const late = h.received.at(-1).state;
    assert.equal(
      late.player.stamina,
      h.baseline.state.player.stamina,
      "old delayed stamina assertion reproduces failure after natural regeneration",
    );
    const action = replayActionEvidence({ ...h, sent: [command] }, "ATTACK");
    assert.equal(action.command.args.heavy, true);
    assert.ok(action.beforeState.player.stamina - action.state.player.stamina >= 23.5);
    const assault = late.crimes.find((crime) => crime.victim === command.args.npcId);
    assert.ok(assault);
    assert.equal(assault.fine, 25000);
    assert.ok(action.beforeState.npcs[0].health - late.npcs[0].health >= 24);
  } finally {
    h.close();
  }
});

test("actual RETIRE then30 requested frozen QA steps and actual RESUME are verified by journal and FIFO snapshot", async () => {
  const h = harness();
  const originalWindow = globalThis.window;
  try {
    const retire = { v: 1, id: "button:retire", type: "RETIRE", args: {} };
    h.send({ type: "COMMANDS", commands: [retire] });
    h.tick();
    h.send({ type: "SNAPSHOT_REQUEST", requestId: "retired" });
    const action = replayActionEvidence({ ...h, sent: [retire] }, "RETIRE");
    assert.equal(action.beforeState.progression.retired, false);
    assert.equal(action.state.progression.retired, true);
    let requestedSteps;
    globalThis.window = {
      __socialEngine: {
        state: async () => {
          h.send({ type: "SNAPSHOT_REQUEST", requestId: "barrier" });
          return h.received.at(-1).state;
        },
        step: (count) => {
          requestedSteps = count;
          h.send({ type: "STEP", count });
        },
      },
    };
    const page = { evaluate: (fn, argument) => fn(argument) };
    const frozen = await stepRetiredWorld(page, 30);
    assert.equal(requestedSteps, 30, "original QA request is retained");
    assert.equal(frozen.beforeTick, action.state.tick);
    assert.equal(frozen.afterTick, action.state.tick);
    const resume = { v: 1, id: "button:resume", type: "RESUME_CAREER", args: {} };
    h.send({ type: "COMMANDS", commands: [resume] });
    h.tick();
    h.send({ type: "SNAPSHOT_REQUEST", requestId: "resumed" });
    const resumed = replayActionEvidence({ ...h, sent: [retire, resume] }, "RESUME_CAREER");
    assert.equal(resumed.beforeState.progression.retired, true);
    assert.equal(resumed.state.progression.retired, false);
    assert.equal(resumed.state.player.id, action.state.player.id);
    assert.ok(resumed.state.tick > action.state.tick);
    await assert.rejects(stepRetiredWorld(page, 501));
    await assert.rejects(stepRetiredWorld(page, 30), /requires actual retirement/);
  } finally {
    globalThis.window = originalWindow;
    h.close();
  }
});

test("rejected distant rumor remains a failure and reports authoritative action-time distance", () => {
  const save = createWorld(20261103);
  for (const [i, type] of ["RETIRE", "RESUME_CAREER"].entries())
    assert.equal(
      applyCommand(save, { v: 1, id: `setup:diagnostic:${i}`, type, args: {} }).ok,
      true,
    );
  const event = save.social.knowledge.player.at(-1);
  save.npcs[0].location = { ...save.player.location, x: save.player.location.x + 5 };
  const h = harness(save);
  try {
    const command = {
      v: 1,
      id: "dom:out-of-range",
      type: "SHARE_RUMOR",
      args: { npcId: save.npcs[0].id, eventId: event.eventId },
    };
    h.send({ type: "COMMANDS", commands: [command] });
    h.tick();
    h.send({ type: "SNAPSHOT_REQUEST", requestId: "after-rejection" });
    assert.throws(
      () => replayActionEvidence({ ...h, sent: [command] }, "SHARE_RUMOR"),
      (e) => {
        assert.match(e.message, /action-time context/);
        const context = JSON.parse(e.message.split("action-time context: ")[1]);
        assert.equal(context.npcId, save.npcs[0].id);
        assert.equal(context.senderKnows, true);
        assert.ok(context.distance > 3);
        return true;
      },
    );
  } finally {
    h.close();
  }
});
