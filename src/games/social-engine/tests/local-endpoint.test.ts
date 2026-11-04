import test from "node:test";
import assert from "node:assert/strict";
import { createLocalEndpoint } from "../worker/local-endpoint.ts";
import { createWorld, applyCommand, stepWorld, canonicalState } from "../simulation/engine.ts";
import type { WorldState } from "../domain/types.ts";
test("worker-unavailable compatibility mode keeps full authority, same tick results and only reduces visible presentation", async () => {
  const endpoint = await createLocalEndpoint();
  const messages: Record<string, unknown>[] = [];
  let pending: ((e: MessageEvent) => void) | null = null;
  endpoint.onmessage = (e) => {
    messages.push(e.data);
    pending?.(e);
  };
  const wait = (type: string, message: Record<string, unknown>) =>
    new Promise<Record<string, unknown>>((resolve) => {
      pending = (e) => {
        if (e.data.type === type) {
          pending = null;
          resolve(e.data);
        }
      };
      endpoint.postMessage({ v: 1, ...message });
    });
  try {
    const ready = await wait("READY", { type: "INIT", seed: 37, qa: true });
    const projection = ready.projection as {
      population: number;
      visualAgentLimit: number;
      npcs: unknown[];
    };
    assert.equal(projection.population, 1100);
    assert.equal(projection.visualAgentLimit, 8);
    assert.equal(projection.npcs.length, 100);
    endpoint.postMessage({ v: 1, type: "PAUSE", paused: true });
    const command = { v: 1 as const, id: "fallback:move", type: "MOVE_TO", args: { x: 27, y: 16 } };
    await wait("RESULT", { type: "COMMANDS", commands: [command] });
    await wait("DELTA", { type: "STEP", count: 40 });
    const snapshot = await wait("SNAPSHOT", { type: "SNAPSHOT_REQUEST", requestId: "fallback" });
    const direct = createWorld(37);
    applyCommand(direct, command);
    for (let i = 0; i < 40; i++) stepWorld(direct);
    assert.equal(canonicalState(snapshot.state as WorldState), canonicalState(direct));
  } finally {
    endpoint.terminate();
  }
  const count = messages.length;
  endpoint.postMessage({ v: 1, type: "INIT" });
  await new Promise((r) => setTimeout(r, 120));
  assert.equal(messages.length, count);
});
