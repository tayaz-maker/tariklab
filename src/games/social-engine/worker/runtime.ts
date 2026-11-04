import type { JournalOperation, JournalBatch, JournalPoint } from "../persistence/journal.ts";
import type { Command, Profile, WorldState } from "../domain/types.ts";
import { SIM_STEP_MS } from "../domain/content.ts";
import {
  createWorld,
  projectWorld,
  stepWorld,
  validateState,
  applyCommand,
} from "../simulation/engine.ts";

export type SimulationScope = {
  postMessage: (message: unknown) => void;
  onmessage: ((event: MessageEvent) => void) | null;
};
export function createSimulationRuntime(scope: SimulationScope, projectionLimit = 100) {
  let state: WorldState | null = null,
    paused = false,
    qa = false,
    commands: Command[] = [],
    timer: ReturnType<typeof setInterval> | null = null,
    initialized = false,
    scheduledSpeed = 1;
  let qaRemaining = 0,
    qaElapsed = 0,
    qaCount = 0;
  let qaTimer: ReturnType<typeof setTimeout> | null = null;
  let epoch = "",
    cursor = 0,
    lastFlushAt = performance.now(),
    journal: JournalOperation[] = [];
  const point = (): JournalPoint => ({ epoch, cursor });
  function flushJournal(): void {
    if (!journal.length) return;
    const batch: JournalBatch = {
      epoch,
      fromCursor: journal[0].cursor - 1,
      toCursor: cursor,
      operations: journal,
    };
    journal = [];
    lastFlushAt = performance.now();
    scope.postMessage({ v: 1, type: "JOURNAL_BATCH", batch });
  }
  function record(
    operation:
      | Omit<Extract<JournalOperation, { type: "TICK" }>, "cursor">
      | Omit<Extract<JournalOperation, { type: "APPLY_WHILE_PAUSED" }>, "cursor">
      | Omit<Extract<JournalOperation, { type: "PAUSE_CONTROL" }>, "cursor">,
  ): void {
    journal.push({ ...structuredClone(operation), cursor: ++cursor } as JournalOperation);
    if (journal.length >= 10 || performance.now() - lastFlushAt >= 1000) flushJournal();
  }
  function sendProjection(type = "DELTA", simMs = 0): void {
    if (!state) return;
    const projection = projectWorld(state);
    projection.simMs = simMs;
    projection.visualAgentLimit = projectionLimit;
    scope.postMessage({
      v: 1,
      type,
      projection,
      journal: point(),
      sentAt: performance.timeOrigin + performance.now(),
    });
  }
  function fail(error: unknown): void {
    flushJournal();
    paused = true;
    if (qaTimer !== null) clearTimeout(qaTimer);
    qaTimer = null;
    qaRemaining = 0;
    if (timer) clearInterval(timer);
    timer = null;
    scope.postMessage({
      v: 1,
      type: "ERROR",
      code: "SIMULATION_HALTED",
      recoverable: true,
      message: error instanceof Error ? error.message : "Simülasyon durduruldu.",
    });
  }
  function schedule(): void {
    if (timer) clearInterval(timer);
    scheduledSpeed = state?.mobility.speed ?? 1;
    timer = setInterval(runTick, SIM_STEP_MS / scheduledSpeed);
  }
  function runTick(): void {
    if (!state || paused || qaRemaining > 0) return;
    try {
      const started = performance.now(),
        pending = commands;
      commands = [];
      const beforeTick = state.tick;
      const results = stepWorld(state, pending);
      if (state.tick !== beforeTick || pending.length)
        record({ type: "TICK", endingTick: state.tick, commands: pending });
      pending.forEach((command, index) =>
        scope.postMessage({ v: 1, type: "RESULT", id: command.id, result: results[index] }),
      );
      if ((state.tick !== beforeTick || pending.length) && state.tick % 600 === 0) {
        const errors = validateState(state);
        if (errors.length) throw new Error(errors.slice(0, 5).join("; "));
      }
      sendProjection("DELTA", performance.now() - started);
      if (state.mobility.speed !== scheduledSpeed) schedule();
    } catch (error) {
      fail(error);
    }
  }
  function runQaChunk(): void {
    qaTimer = null;
    if (!state || !qaRemaining) return;
    try {
      const started = performance.now();
      // Yield between bounded chunks so snapshots/control messages cannot sit behind
      // a whole accelerated day. Each operation retains its original fixed-tick order.
      const count = Math.min(500, qaRemaining);
      for (let i = 0; i < count; i++) {
        const pending = commands;
        commands = [];
        const beforeTick = state.tick;
        const results = stepWorld(state, pending);
        if (state.tick !== beforeTick || pending.length)
          record({ type: "TICK", endingTick: state.tick, commands: pending });
        pending.forEach((command, index) =>
          scope.postMessage({ v: 1, type: "RESULT", id: command.id, result: results[index] }),
        );
      }
      qaRemaining -= count;
      qaElapsed += performance.now() - started;
      flushJournal();
      if (qaRemaining) qaTimer = setTimeout(runQaChunk, 0);
      else {
        const errors = validateState(state);
        if (errors.length) throw new Error(errors.join("; "));
        sendProjection("DELTA", qaElapsed / qaCount);
        if (state.mobility.speed !== scheduledSpeed) schedule();
      }
    } catch (error) {
      fail(error);
    }
  }
  scope.onmessage = (event: MessageEvent): void => {
    const message = event.data as Record<string, unknown>;
    if (!message || message.v !== 1 || typeof message.type !== "string") {
      scope.postMessage({
        v: 1,
        type: "ERROR",
        code: "PROTOCOL_VERSION",
        recoverable: true,
        message: "Desteklenmeyen iletişim sürümü.",
      });
      return;
    }
    try {
      switch (message.type) {
        case "INIT": {
          if (initialized) throw new Error("Bu worker zaten başlatıldı.");
          const candidate = message.save
            ? structuredClone(message.save as WorldState)
            : createWorld(Number(message.seed ?? 20261103), message.profile as Profile | undefined);
          const errors = validateState(candidate);
          if (errors.length)
            throw new Error(`Dünya doğrulanamadı: ${errors.slice(0, 5).join("; ")}`);
          state = candidate;
          epoch = crypto.randomUUID();
          cursor = 0;
          journal = [];
          lastFlushAt = performance.now();
          initialized = true;
          paused = false;
          qa = message.qa === true;
          commands = [];
          sendProjection("READY");
          schedule();
          break;
        }
        case "COMMANDS": {
          if (
            !state ||
            !Array.isArray(message.commands) ||
            message.commands.length > 100 ||
            commands.length + message.commands.length > 200 ||
            message.commands.some((value: unknown) => {
              const c = value as Command;
              return (
                !c ||
                c.v !== 1 ||
                typeof c.id !== "string" ||
                !/^[\w:.-]{1,120}$/.test(c.id) ||
                typeof c.type !== "string" ||
                !c.args ||
                typeof c.args !== "object" ||
                Array.isArray(c.args)
              );
            })
          )
            throw new Error("Geçersiz veya aşırı komut kuyruğu.");
          if (paused) {
            for (const command of message.commands as Command[])
              scope.postMessage({
                v: 1,
                type: "RESULT",
                id: command.id,
                result: applyCommand(state, command),
              });
            record({
              type: "APPLY_WHILE_PAUSED",
              tick: state.tick,
              commands: message.commands as Command[],
            });
            flushJournal();
            sendProjection();
            if (state.mobility.speed !== scheduledSpeed) schedule();
          } else commands.push(...(message.commands as Command[]));
          break;
        }
        case "PAUSE":
          paused = message.paused === true;
          if (paused && state) {
            for (const command of commands)
              scope.postMessage({
                v: 1,
                type: "RESULT",
                id: command.id,
                result: applyCommand(state, command),
              });
            if (commands.length) record({ type: "APPLY_WHILE_PAUSED", tick: state.tick, commands });
            state.flags.moveX = 0;
            state.flags.moveY = 0;
            state.flags.throttle = 0;
            state.flags.steer = 0;
            commands = [];
          }
          if (state) {
            record({ type: "PAUSE_CONTROL", tick: state.tick, paused });
            flushJournal();
          }
          break;
        case "SNAPSHOT_REQUEST": {
          if (!state || typeof message.requestId !== "string")
            throw new Error("Geçersiz anlık görüntü isteği.");
          flushJournal();
          // Message handlers execute between fixed ticks; structured clone owns immutable snapshot bytes.
          scope.postMessage({
            v: 1,
            type: "SNAPSHOT",
            requestId: message.requestId,
            state: structuredClone(state),
            journal: point(),
          });
          break;
        }
        case "STEP": {
          if (
            !qa ||
            !state ||
            !Number.isSafeInteger(message.count) ||
            Number(message.count) < 1 ||
            Number(message.count) > 100000
          )
            throw new Error("QA adım isteği reddedildi.");
          if (qaRemaining) throw new Error("QA adım isteği zaten sürüyor.");
          qaRemaining = qaCount = Number(message.count);
          qaElapsed = 0;
          runQaChunk();
          break;
        }
        default:
          scope.postMessage({
            v: 1,
            type: "ERROR",
            code: "UNKNOWN_MESSAGE",
            recoverable: true,
            message: "Bilinmeyen ileti.",
          });
      }
    } catch (error) {
      fail(error);
    }
  };

  return {
    dispose() {
      flushJournal();
      if (qaTimer !== null) clearTimeout(qaTimer);
      qaTimer = null;
      qaRemaining = 0;
      if (timer) clearInterval(timer);
      timer = null;
      scope.onmessage = null;
      state = null;
      commands = [];
    },
  };
}
