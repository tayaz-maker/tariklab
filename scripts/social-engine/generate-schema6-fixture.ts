import {
  createWorld,
  stepWorld,
  applyCommand,
  canonicalState,
} from "../../src/games/social-engine/persistence/historical/candidate5/simulation/engine.ts";
import {
  encodeSave,
  sha256,
} from "../../src/games/social-engine/persistence/historical/candidate5/persistence/codec.ts";
import {
  newJournalMeta,
  encodeJournal,
} from "../../src/games/social-engine/persistence/historical/candidate5/persistence/journal.ts";
import { gzipSync } from "node:zlib";
import { writeFileSync } from "node:fs";
const snapshot = createWorld(20261104);
for (let i = 0; i < 200; i++) stepWorld(snapshot, []);
const envelope = await encodeSave("auto", snapshot);
const base = await newJournalMeta(envelope, { epoch: "genuine-f14e13f", cursor: 0 });
const state = structuredClone(snapshot),
  operations: any[] = [];
let cursor = 0;
for (let i = 0; i < 40; i++) {
  const commands =
    i === 0 ? [{ v: 1, id: "old-move", type: "MOVE", args: { x: 1, y: 0, sprint: false } }] : [];
  stepWorld(state, commands);
  operations.push({ cursor: ++cursor, type: "TICK", endingTick: state.tick, commands });
}
const commands = [{ v: 1, id: "old-speed", type: "SET_TIME_SPEED", args: { speed: 2 } }];
commands.forEach((c) => applyCommand(state, c));
operations.push({ cursor: ++cursor, type: "APPLY_WHILE_PAUSED", tick: state.tick, commands });
const record = await encodeJournal(base, {
  epoch: base.epoch,
  fromCursor: 0,
  toCursor: cursor,
  operations,
});
const meta = {
  ...base,
  cursor,
  lastHash: record.hash,
  bytes: record.byteLength,
  currentTick: state.tick,
};
const fixture = {
  sourceCommit: "f14e13f",
  envelope,
  meta,
  record,
  expectedCanonicalSha256: await sha256(canonicalState(state)),
};
writeFileSync(
  "src/games/social-engine/persistence/fixtures/v6-auto-with-tail.json.gz",
  gzipSync(JSON.stringify(fixture)),
);
