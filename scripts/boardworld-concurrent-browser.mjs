// Independent real renderer snapshots, queued behind a third client's Web Lock.
// No sleeps, synthetic lock manager, storage-event delivery or result retries.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createStaticGameServer } from "./static-game-server.mjs";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const arg = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const output = resolve(arg("--output", "../evidence/concurrent.json"));
mkdirSync(resolve(output, ".."), { recursive: true });
const server = createStaticGameServer(arg("--serve", "public"));
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/games/tc-sim-boardworld/index.html`;
let browser;
const report = { status: "RUNNING", results: [] };
try {
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
  });
  const context = await browser.newContext();
  await context.addInitScript(() => {
    window.addEventListener("storage", (e) => e.stopImmediatePropagation(), true);
    window.trace = [];
    const mark = (event) =>
      window.trace.push({ at: performance.timeOrigin + performance.now(), ...event });
    const identity = (text) => {
      try {
        return JSON.parse(text)?.checksum ?? text;
      } catch {
        return text;
      }
    };
    for (const method of ["getItem", "setItem"]) {
      const native = Storage.prototype[method];
      Storage.prototype[method] = function (key, ...rest) {
        const result = native.call(this, key, ...rest);
        if (key.startsWith("tariklab.boardworld.v6"))
          mark({ event: method, key, value: identity(method === "getItem" ? result : rest[0]) });
        return result;
      };
    }
    const summary = (head) =>
      head && {
        generation: head.generation,
        slots: head.slots.map(([key, bytes]) => [key, identity(bytes)]),
      };
    const transaction = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (...args) {
      const tx = transaction.apply(this, args);
      for (const event of ["complete", "abort"])
        tx.addEventListener(event, () => mark({ event: `idb:${event}`, mode: tx.mode }));
      return tx;
    };
    for (const method of ["get", "put"]) {
      const native = IDBObjectStore.prototype[method];
      IDBObjectStore.prototype[method] = function (...args) {
        const request = native.apply(this, args);
        if (this.name === "state")
          request.addEventListener("success", () =>
            mark({
              event: `idb:${method}`,
              head: summary(method === "get" ? request.result : args[0]),
            }),
          );
        return request;
      };
    }
    const request = navigator.locks.request.bind(navigator.locks);
    navigator.locks.request = (name, callback) => {
      mark({ event: "queued", name });
      return request(name, async (lock) => {
        mark({ event: "acquired", name });
        try {
          const result = await callback(lock);
          mark({ event: "completed", ok: result?.ok, conflict: result?.conflict });
          return result;
        } finally {
          mark({ event: "released", name });
        }
      });
    };
  });
  const [a, b, holder] = await Promise.all([
    context.newPage(),
    context.newPage(),
    context.newPage(),
  ]);
  await Promise.all([a, b, holder].map((p) => p.goto(url)));
  for (const p of [a, b, holder])
    await p.evaluate(async () => {
      window.p = await import("./persistence.mjs");
      window.e = await import("./engine.mjs");
    });
  const errors = [];
  for (const page of [a, b, holder]) page.on("pageerror", (e) => errors.push(e.message));
  for (let i = 0; i < Number(arg("--repeats", "50")); i++) {
    const mode = arg("--mode", ["same-action", "different-actions", "no-op"][i % 3]);
    const initialized = await holder.evaluate(async (seed) => {
      const loaded = await p.loadGameLocked();
      const state = e.createGame({ seed });
      const created = await p.saveGameLocked(state, undefined, loaded.token);
      if (!created.ok) return created;
      // A legitimate manual save without a move makes both rolling slots equal.
      return p.saveGameLocked(state, undefined, created.token);
    }, i + 100);
    assert.equal(initialized.ok, true);
    await Promise.all(
      [a, b].map((page, index) =>
        page.evaluate(
          async ({ mode, index }) => {
            const loaded = await p.loadGameLocked();
            window.snapshot = loaded;
            const choices = e
              .getActions(loaded.state)
              .filter((a) => !a.disabled)
              .map((a) => ({ id: a.id, result: e.resolveAction(loaded.state, a.id) }))
              .filter((a) => a.result.ok);
            window.candidate =
              mode === "no-op"
                ? { id: "manual-save", result: { state: loaded.state } }
                : choices[mode === "same-action" ? 0 : index];
            window.trace = [];
            return { revision: loaded.state.revision, token: loaded.token };
          },
          { mode, index },
        ),
      ),
    );
    const snapshots = await Promise.all(
      [a, b].map((page) =>
        page.evaluate(() => ({
          revision: snapshot.state.revision,
          token: snapshot.token,
          action: candidate.id,
        })),
      ),
    );
    assert.deepEqual(snapshots[0].token, snapshots[1].token);
    assert.equal(snapshots[0].revision, snapshots[1].revision);
    if (args.includes("--stale-cache"))
      await b.evaluate(() => {
        // Deterministic adversarial control in addition to the unmodified-cache runs.
        // The native baseline reproduced this very visibility failure naturally.
        const native = Storage.prototype.getItem;
        Storage.prototype.getItem = function (key) {
          if (key === p.SAVE_KEY) return snapshot.token.primary;
          if (key === p.BACKUP_KEY) return snapshot.token.backup;
          return native.call(this, key);
        };
      });
    await holder.evaluate(() => {
      window.held = false;
      void navigator.locks.request(p.SAVE_LOCK, async () => {
        window.held = true;
        await new Promise((r) => (window.release = r));
      });
    });
    await holder.waitForFunction(() => window.held);
    await Promise.all(
      [a, b].map((page) =>
        page.evaluate(() => {
          window.done = false;
          void p.saveGameLocked(candidate.result.state, undefined, snapshot.token).then((r) => {
            window.result = { ok: r.ok, conflict: r.conflict === true, message: r.message };
            window.done = true;
          });
        }),
      ),
    );
    await holder.waitForFunction(
      async () =>
        (await navigator.locks.query()).pending.filter((l) => l.name === p.SAVE_LOCK).length === 2,
    );
    const heldSlots = await holder.evaluate(() => p.readSaveToken());
    assert.deepEqual(
      heldSlots,
      { primary: snapshots[0].token.primary, backup: snapshots[0].token.backup },
      "neither queued request writes before acquiring the lock",
    );
    await holder.evaluate(() => window.release());
    await Promise.all([a, b].map((page) => page.waitForFunction(() => window.done)));
    const writers = await Promise.all(
      [a, b].map((page, index) =>
        page.evaluate(
          (index) => ({
            writer: index,
            revision: snapshot.state.revision,
            generation: snapshot.token.generation,
            action: candidate.id,
            ...result,
            trace,
          }),
          index,
        ),
      ),
    );
    const persisted = await holder.evaluate(async () => {
      const loaded = await p.loadGameLocked();
      return { revision: loaded.state.revision, token: loaded.token };
    });
    const record = { iteration: i + 1, mode, queuedWriters: 2, writers, persisted };
    const actualToken = persisted.token;
    // Tokens contain the entire save; trace identities retain compact byte evidence.
    record.persisted.token = Object.fromEntries(
      Object.entries(persisted.token).map(([k, v]) => [
        k,
        typeof v === "string" && v.startsWith("{") ? JSON.parse(v).checksum : v,
      ]),
    );
    report.results.push(record);
    writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    assert.equal(writers.filter((r) => r.ok).length, 1, JSON.stringify(writers));
    assert.equal(writers.filter((r) => r.conflict && !r.ok).length, 1);
    assert.equal(persisted.revision, snapshots[0].revision + Number(mode !== "no-op"));
    assert.equal(actualToken.backup, snapshots[0].token.primary);
    if (!args.includes("--baseline"))
      assert.equal(persisted.token.generation, snapshots[0].token.generation + 1);
    const winner = writers.findIndex((r) => r.ok);
    if (!args.includes("--baseline")) {
      assert.equal(writers[winner].trace.filter((x) => x.event === "idb:put").length, 1);
      assert.equal(writers[1 - winner].trace.filter((x) => x.event === "idb:put").length, 0);
      assert.equal(
        writers[1 - winner].trace.filter((x) => x.event === "idb:get").at(-1).head.generation,
        snapshots[0].token.generation + 1,
        "the losing writer re-reads the committed generation after lock acquisition",
      );
      const committed = writers[winner].trace
        .filter((x) => x.event === "idb:complete" && x.mode === "readwrite")
        .at(-1);
      assert.ok(committed.at <= writers[winner].trace.find((x) => x.event === "completed").at);
    }
    const expected = await [a, b][winner].evaluate(() => candidate.result.state);
    assert.deepEqual(
      await holder.evaluate(async () => (await p.loadGameLocked()).state),
      expected,
      "the complete winning move persists, including all history and RNG",
    );
    const loser = 1 - winner;
    const retry = await [a, b][loser].evaluate(() =>
      p.saveGameLocked(candidate.result.state, undefined, snapshot.token),
    );
    assert.equal(retry.ok, false);
    assert.equal(retry.conflict, true, "an unchanged stale token never becomes writable");
    const offline = await [a, b][loser].evaluate(
      () =>
        JSON.stringify(p.importGame(p.exportGame(candidate.result.state)).state) ===
        JSON.stringify(candidate.result.state),
    );
    assert.equal(
      offline,
      true,
      "the losing move stays exportable without being silently discarded",
    );
    const finalToken = await holder.evaluate(async () => (await p.loadGameLocked()).token);
    assert.deepEqual(
      finalToken,
      actualToken,
      "a rejected retry changes no authoritative slot or generation",
    );
  }
  assert.deepEqual(errors, []);
  report.status = "PASS";
} catch (error) {
  report.status = "FAIL";
  report.error = error.message;
  throw error;
} finally {
  writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ status: report.status, races: report.results.length, output }));
  await browser?.close();
  server.close();
}
