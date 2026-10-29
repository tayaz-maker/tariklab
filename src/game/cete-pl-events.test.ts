import { test } from "node:test";
import assert from "node:assert/strict";
import { pickWorldEvent } from "./events";
import { hydratePlayer, makeRivals } from "./data";
import { polishLog } from "./cete-pl-log";

test("reachable world-event messages render in Polish without changing their source", () => {
  const originalRandom = Math.random;
  let randomState = 123456789;
  Math.random = () => {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return randomState / 4294967296;
  };
  const seen = new Set<string>();
  try {
    for (const rusvet of [0, 30]) {
      const player = hydratePlayer({
        name: "QA",
        neighborhood: "eyup",
        cash: 100000,
        rusvet,
        jobsDone: 7,
        properties: ["r105"],
        saat: 23,
        buzz: 3,
        usdt: 3,
        equippedVehicle: "v101",
        eventCooldown: 0,
      });
      const rivals = makeRivals();
      for (let i = 0; i < 12000; i++) {
        const event = pickWorldEvent({ player, rivals, logs: [] });
        if (!event) continue;
        const original = event.text;
        assert.notEqual(
          polishLog(original),
          original,
          `Missing world-event translation: ${original}`,
        );
        assert.equal(event.text, original);
        seen.add(original.replace(/[\d.]+/g, "#"));
      }
    }
  } finally {
    Math.random = originalRandom;
  }
  assert.ok(seen.size >= 16, `only ${seen.size} event forms reached`);
});
