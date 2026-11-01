/** Run with node --expose-gc; measurements are observations, not machine-independent promises. */
import { performance } from "node:perf_hooks";
import { createHash } from "node:crypto";
import { writeFileSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";
import {
  createGame,
  getActions,
  getCalendarView,
  getAppointmentOptions,
  getEmergentView,
  getLifeView,
  resolveAction,
} from "../public/games/tc-sim-boardworld/engine.mjs";
import {
  saveGame,
  exportGame,
  importGame,
} from "../public/games/tc-sim-boardworld/persistence.mjs";
import { playLife } from "./boardworld-scenarios.mjs";
import {
  selectEmergentLifeAction,
  majorDecision,
  normalizeAction,
} from "./boardworld-emergent-scenarios.mjs";

const samples = 31;
function measure(fn) {
  for (let i = 0; i < 3; i++) fn();
  const values = [];
  for (let i = 0; i < samples; i++) {
    const start = performance.now();
    fn();
    values.push(performance.now() - start);
  }
  values.sort((a, b) => a - b);
  return {
    samples,
    p50Ms: values[Math.floor(samples * 0.5)],
    p95Ms: values[Math.floor(samples * 0.95)],
    maxMs: values.at(-1),
  };
}
function methods(state) {
  const encoded = exportGame(state),
    map = new Map(),
    storage = {
      getItem: (key) => map.get(key) ?? null,
      setItem: (key, value) => map.set(key, value),
    };
  const action =
    getActions(state).find((a) => !a.disabled && a.id === "wait:15") ||
    getActions(state).find((a) => !a.disabled);
  const draft = {
    kind: "meeting",
    npcId: "leyla",
    subjectId: "",
    day: Math.floor(state.time / 1440) + 2,
    venue: "kadikoy-cafe",
    duration: 60,
    repeat: "none",
  };
  return {
    getActions: measure(() => getActions(state)),
    getCalendarView: measure(() => getCalendarView(state)),
    getEmergentView: measure(() => getEmergentView(state)),
    getLifeView: measure(() => getLifeView(state)),
    getAppointmentOptions: measure(() => getAppointmentOptions(state, draft)),
    resolveAction: measure(() => resolveAction(state, action.id)),
    exportGame: measure(() => exportGame(state)),
    importGame: measure(() => importGame(encoded)),
    saveGame: measure(() => saveGame(state, storage)),
  };
}
const gameRoot = resolve("public/games/tc-sim-boardworld"),
  assets = readdirSync(gameRoot)
    .filter((name) => statSync(resolve(gameRoot, name)).isFile())
    .map((file) => {
      const bytes = readFileSync(resolve(gameRoot, file));
      return {
        file,
        rawBytes: bytes.length,
        gzipBytes: gzipSync(bytes).length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      };
    });
const report = {
  environment: {
    node: process.version,
    platform: process.platform,
    architecture: process.arch,
    gcAvailable: typeof global.gc === "function",
    methodology:
      "31 samples after3 warmups per API, measured after each life so microbenchmarks do not inflate simulation time. Node wall-clock; excludes browser paint/network. Simulation timings include action selection, strict validation, input immutability checks and periodic GC. Retained heap includes the test action trace and up to5 serialized checkpoints; it is not peak memory. Compressed sizes use local gzip, not a network transfer claim.",
  },
  assets,
  rawGameBytes: assets.reduce((n, a) => n + a.rawBytes, 0),
  gzipGameBytes: assets.reduce((n, a) => n + a.gzipBytes, 0),
  lives: [],
};
for (const style of ["career", "social", "entrepreneur"])
  for (const seed of [2026, 91373]) {
    global.gc?.();
    const base = process.memoryUsage().heapUsed;
    const checkpoints = [
      {
        day: 1,
        elapsedMs: 0,
        actions: 0,
        saveBytes: Buffer.byteLength(exportGame(createGame({ scenario: "restart", seed }))),
        serialized: exportGame(createGame({ scenario: "restart", seed })),
      },
    ];
    const life = playLife({
      scenario: "restart",
      seed,
      style,
      days: 365,
      checkpoints: [30, 90, 180, 365],
      selector: selectEmergentLifeAction,
      replay: false,
      onCheckpoint: ({ days, state, actions, elapsedMs }) => {
        global.gc?.();
        checkpoints.push({
          day: days + 1,
          completeDays: days,
          elapsedMs,
          actions,
          saveBytes: Buffer.byteLength(exportGame(state)),
          retainedHeapDeltaBytes: process.memoryUsage().heapUsed - base,
          serialized: exportGame(state),
        });
      },
    });
    for (const checkpoint of checkpoints) {
      checkpoint.methods = methods(importGame(checkpoint.serialized).state);
      delete checkpoint.serialized;
    }
    report.lives.push({
      style,
      seed,
      checkpoints,
      normalizedActionKinds: new Set(life.actions.map((a) => normalizeAction(a.id))).size,
      majorDecisions: life.actions.filter((a) => majorDecision.test(a.id)).length,
      actions: life.actions.length,
      actionMix: life.counts,
      final: {
        health: life.state.player.health,
        cash: life.state.cash,
        bank: life.state.bank,
        debt: life.state.debt,
        rentArrears: life.state.housing.arrears,
        completedMeetings: life.state.calendar.stats.completed,
        completedProjects: life.state.living.projects.filter((p) => p.status === "complete").length,
      },
      observed: life.observed,
    });
  }
const args = process.argv.slice(2),
  output = args.includes("--output")
    ? args[args.indexOf("--output") + 1]
    : "../bw4-performance.json";
writeFileSync(resolve(output), JSON.stringify(report, null, 2) + "\n");
console.log(
  JSON.stringify(
    {
      output: resolve(output),
      rawGameBytes: report.rawGameBytes,
      gzipGameBytes: report.gzipGameBytes,
      lives: report.lives.map((l) => ({
        style: l.style,
        seed: l.seed,
        actions: l.actions,
        final: l.final,
        checkpoints: l.checkpoints.map(({ day, elapsedMs, saveBytes, retainedHeapDeltaBytes }) => ({
          day,
          elapsedMs,
          saveBytes,
          retainedHeapDeltaBytes,
        })),
      })),
    },
    null,
    2,
  ),
);
