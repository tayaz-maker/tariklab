/** Explicit historical evidence generation; never runs from normal tests. */
import { createWorld, stepWorld, applyCommand, canonicalState } from "../../src/games/social-engine/persistence/historical/candidate7/simulation/engine.ts";
import { packRecords } from "../../src/games/social-engine/persistence/records.ts";
import { canonical } from "../../src/games/social-engine/persistence/historical/candidate7/simulation/random.ts";
import { sha256 } from "../../src/games/social-engine/persistence/codec.ts";
import { newJournalMeta, encodeJournal, type JournalOperation } from "../../src/games/social-engine/persistence/journal.ts";
import { gzipText } from "../../src/games/social-engine/persistence/compression.ts";
import { gzipSync } from "node:zlib";
import { writeFileSync } from "node:fs";
const snapshot = createWorld(920);
for (let i = 0; i < 10; i++) stepWorld(snapshot);
const text = canonical({ ...packRecords(snapshot), rulesVersion: "social-engine-rules-8" });
const packed = await gzipText(text);
const envelope = { format: "social-engine-save" as const, schemaVersion: 8, gameVersion: snapshot.engineVersion,
  slotId: "auto", revisionId: "genuine-41270133-rules8", worldSeed: snapshot.seed, tick: snapshot.tick,
  createdAt: "2026-11-04T00:00:00.000Z", encoding: "canonical-json+gzip-base64" as const,
  ...packed, byteLength: new TextEncoder().encode(packed.payload).byteLength,
  sha256: await sha256(text), payloadSha256: await sha256(packed.payload) };
const point = { epoch: "genuine-41270133", cursor: 0 };
const base = await newJournalMeta(envelope, point), state = structuredClone(snapshot);
const operations: JournalOperation[] = [];
for (let i = 0; i < 40; i++) {
  const commands = i === 0 ? [{ v: 1 as const, id: "old-move", type: "MOVE", args: { x: 1, y: 0, sprint: false } }] : [];
  stepWorld(state, commands);
  operations.push({ cursor: operations.length + 1, type: "TICK", endingTick: state.tick, commands });
}
const commands = [{ v: 1 as const, id: "old-time", type: "SET_TIME_SPEED", args: { speed: 2 } }];
commands.forEach(c => applyCommand(state,c));
operations.push({ cursor: operations.length + 1, type: "APPLY_WHILE_PAUSED", tick: state.tick, commands });
const record = await encodeJournal(base, {epoch: point.epoch,fromCursor:0,toCursor:operations.length,operations});
const meta = {...base,cursor:operations.length,lastHash:record.hash,bytes:record.byteLength,currentTick:state.tick};
const fixture = { sourceCommit: "41270133008356f7a000ffdb691a55473867c58a", envelope, meta, record,
  expectedCanonicalSha256: await sha256(canonicalState(state)) };
writeFileSync("src/games/social-engine/persistence/fixtures/v8-auto-with-tail.json.gz",gzipSync(JSON.stringify(fixture)));
