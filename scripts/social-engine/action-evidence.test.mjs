import test from "node:test";
import assert from "node:assert/strict";
import { createSimulationRuntime } from "../../src/games/social-engine/worker/runtime.ts";
import { createWorld, applyCommand } from "../../src/games/social-engine/simulation/engine.ts";
import { replayActionEvidence, installActionObserver } from "./action-evidence.mjs";

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
