import assert from "node:assert/strict";
import { replayJournal } from "../../src/games/social-engine/persistence/journal.ts";

/** Test-only passive wire tap: original messages and scheduling are unchanged. */
export function installActionObserver() {
  const NativeWorker = window.Worker;
  window.__actionWire = { armed: false, sent: [], received: [] };
  window.Worker = class extends NativeWorker {
    constructor(...args) {
      super(...args);
      this.addEventListener("message", ({ data }) => {
        if (
          window.__actionWire.armed &&
          ["SNAPSHOT", "JOURNAL_BATCH", "RESULT"].includes(data?.type)
        )
          window.__actionWire.received.push(data);
      });
    }
    postMessage(message, ...rest) {
      if (window.__actionWire.armed && message?.type === "COMMANDS")
        window.__actionWire.sent.push(...message.commands);
      return super.postMessage(message, ...rest);
    }
  };
}

export function replayActionEvidence({ baseline, sent, received }, type) {
  const commands = sent.filter((c) => c.type === type);
  assert.equal(commands.length, 1, `exactly one real ${type} command`);
  const command = commands[0];
  const acknowledgement = received.find((m) => m.type === "RESULT" && m.id === command.id);
  assert.ok(acknowledgement, "real worker acknowledgement");
  assert.equal(acknowledgement.result.ok, true, acknowledgement.result.reason);
  const batches = received.filter((m) => m.type === "JOURNAL_BATCH").map((m) => m.batch);
  assert.ok(
    batches.every((b) => b.epoch === baseline.journal.epoch),
    "single authoritative epoch",
  );
  const operations = batches
    .flatMap((b) => b.operations)
    .filter((op) => op.cursor > baseline.journal.cursor);
  const index = operations.findIndex((op) => op.commands?.some((c) => c.id === command.id));
  assert.ok(index >= 0, "acknowledged command exists in full worker journal");
  const prefix = operations.slice(0, index + 1);
  // replayJournal checks every cursor, command, tick and final state invariant.
  const beforeState = replayJournal(baseline.state, baseline.journal, prefix.slice(0, -1));
  const state = replayJournal(baseline.state, baseline.journal, prefix);
  const operation = operations[index];
  return {
    state,
    beforeState,
    command,
    acknowledgement,
    operation,
    replayedOperations: prefix.length,
  };
}

export async function observeAction(page, type, action) {
  const baseline = await page.evaluate(async () => {
    const wire = window.__actionWire;
    wire.armed = true;
    wire.sent = [];
    wire.received = [];
    await window.__socialEngine.state();
    return wire.received.filter((m) => m.type === "SNAPSHOT").at(-1);
  });
  assert.ok(baseline?.journal, "full authoritative baseline and journal cursor");
  await action();
  // Same 6000ms budget as the previous dodge acknowledgment; no fixed sleep.
  await page.waitForFunction(
    (type) => {
      const wire = window.__actionWire;
      const command = wire.sent.find((c) => c.type === type);
      return command && wire.received.some((m) => m.type === "RESULT" && m.id === command.id);
    },
    type,
    { polling: 50, timeout: 6000 },
  );
  const evidence = await page.evaluate(async () => {
    await window.__socialEngine.state(); // flushes pending full worker journal
    const wire = window.__actionWire;
    wire.armed = false;
    return { sent: wire.sent, received: wire.received };
  });
  return replayActionEvidence({ baseline, ...evidence }, type);
}

/** A retired world intentionally cannot reach tick+count. A <=500-step QA request
 * runs in one synchronous worker chunk; the following snapshot is its FIFO barrier. */
export async function stepRetiredWorld(page, count) {
  assert.ok(Number.isSafeInteger(count) && count > 0 && count <= 500);
  return page.evaluate(async (count) => {
    const qa = window.__socialEngine;
    const before = await qa.state();
    if (!before.progression.retired)
      throw new Error("Retired-world step requires actual retirement");
    qa.step(count);
    const after = await qa.state();
    if (!after.progression.retired || after.tick !== before.tick)
      throw new Error("Actual retired worker advanced during requested QA steps");
    return { beforeTick: before.tick, afterTick: after.tick, requestedSteps: count };
  }, count);
}
