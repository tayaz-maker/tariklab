import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createStaticGameServer } from "./static-game-server.mjs";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";

const args = process.argv.slice(2);
const arg = (key, fallback) => (args.includes(key) ? args[args.indexOf(key) + 1] : fallback);
const output = resolve(arg("--output", "../evidence/transactions.json"));
mkdirSync(resolve(output, ".."), { recursive: true });
const released = "d695119186cad42c079a911a60c372f201b3b64b";
const temp = mkdtempSync(join(tmpdir(), "boardworld-transaction-"));
writeFileSync(
  join(temp, "release.tar"),
  execFileSync("git", ["archive", released, "public/games/tc-sim-boardworld"], {
    maxBuffer: 32 * 1024 * 1024,
  }),
);
execFileSync("tar", ["-xf", join(temp, "release.tar"), "-C", temp]);
const server = createStaticGameServer(arg("--serve", "public"));
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;
const report = { status: "RUNNING", released, results: [] };
let browser;
const check = async (name, fn) => {
  console.log(`START ${name}`);
  let timer;
  let evidence;
  try {
    evidence = await Promise.race([
      fn(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Timed out: ${name}`)), 30_000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
  report.results.push({ case: name, pass: true, ...evidence });
  writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
};
const boot = async (page) => {
  await page.bringToFront();
  await page.route("**/transaction-harness.html", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Boardworld transaction test</title>",
    }),
  );
  await page.goto(`${origin}/games/tc-sim-boardworld/transaction-harness.html`);
  await page.evaluate(async () => {
    window.p = await import("/games/tc-sim-boardworld/persistence.mjs");
  });
  await page.evaluate(async () => {
    window.e = await import("/games/tc-sim-boardworld/engine.mjs");
    window.next = (s) =>
      e
        .getActions(s)
        .map((a) => e.resolveAction(s, a.id))
        .find((r) => r.ok).state;
    window.head = () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open(`${p.SAVE_KEY}.transactions`, 1);
        request.onsuccess = () => {
          const db = request.result,
            tx = db.transaction("state");
          const get = tx.objectStore("state").get("head");
          tx.oncomplete = () => {
            db.close();
            resolve(get.result);
          };
          tx.onabort = () => {
            db.close();
            reject(tx.error);
          };
        };
        request.onerror = () => reject(request.error);
      });
    window.corrupt = (both) =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open(`${p.SAVE_KEY}.transactions`, 1);
        request.onsuccess = () => {
          const db = request.result,
            tx = db.transaction("state", "readwrite");
          const store = tx.objectStore("state"),
            get = store.get("head");
          get.onsuccess = () => {
            const record = get.result,
              slots = new Map(record.slots);
            slots.set(p.SAVE_KEY, "corrupt");
            if (both) slots.set(p.BACKUP_KEY, "corrupt-backup");
            record.slots = [...slots];
            store.put(record, "head");
          };
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onabort = () => {
            db.close();
            reject(tx.error);
          };
        };
      });
  });
};
try {
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
  });
  const errors = [];
  for (let version = 1; version <= 6; version++)
    for (const scenario of ["newcomer", "graduate", "restart"]) {
      await check(
        `authentic v${version}/${scenario}: transactional migration, save and explicit released6 rollback recovery`,
        async () => {
          const context = await browser.newContext();
          await context.route("**/released6/*.mjs", (route) => {
            const name = new URL(route.request().url()).pathname.split("/").at(-1);
            return route.fulfill({
              contentType: "text/javascript",
              body: readFileSync(join(temp, "public/games/tc-sim-boardworld", name)),
            });
          });
          const [a, b] = await Promise.all([context.newPage(), context.newPage()]);
          for (const page of [a, b]) page.on("pageerror", (e) => errors.push(e.message));
          for (const page of [a, b]) await boot(page);
          const bytes = readFileSync(
            `scripts/fixtures/boardworld/v${version}-fresh-${scenario}.json`,
            "utf8",
          );
          await a.evaluate(
            ({ version, bytes }) => localStorage.setItem(`tariklab.boardworld.v${version}`, bytes),
            { version, bytes },
          );
          const loads = await Promise.all(
            [a, b].map((page) => page.evaluate(() => p.loadGameLocked())),
          );
          assert.deepEqual(loads[0].state, loads[1].state);
          assert.deepEqual(loads[0].token, loads[1].token, "migration promotes once");
          await a.bringToFront();
          const evidence = await a.evaluate(
            async ({ version, bytes, token }) => {
              const expected = p.importGame(bytes).state;
              const migrated = await p.loadGameLocked();
              const candidate = next(migrated.state);
              const saved = await p.saveGameLocked(candidate, undefined, token);
              const afterSave = await p.loadGameLocked();
              const old = await import("/released6/persistence.mjs");
              const oldEngine = await import("/released6/engine.mjs");
              const oldLoaded = old.loadGame().state;
              let continued = oldLoaded;
              // Multiple real released6 writes, not merely reading/exporting a fixture.
              for (let i = 0; i < 3; i++) {
                continued = oldEngine
                  .getActions(continued)
                  .map((a) => oldEngine.resolveAction(continued, a.id))
                  .find((r) => r.ok).state;
                if (!old.saveGame(continued).ok) throw Error("released6 save failed");
              }
              const returned = await p.loadGameLocked();
              const recoveryPreserved = returned.recoverySaves.some(
                (copy) =>
                  JSON.stringify(p.importGame(copy.bytes).state) === JSON.stringify(continued),
              );
              const imported = await p.saveGameLocked(
                p.importGame(old.exportGame(continued)).state,
                undefined,
                returned.token,
              );
              const selected = await p.loadGameLocked();
              const archived =
                version < 6
                  ? localStorage.getItem(`tariklab.boardworld.v${version}.original-v${version}`)
                  : bytes;
              return {
                expected,
                migrated: migrated.state,
                candidate,
                saved: saved.ok,
                afterSave: afterSave.state,
                oldLoaded,
                continued,
                automatic: returned.state,
                recoveryPreserved,
                imported: imported.ok,
                returned: selected.state,
                archiveUnchanged: archived === bytes,
                legacyUnchanged:
                  version === 6 ||
                  localStorage.getItem(`tariklab.boardworld.v${version}`) === bytes,
                generationUnchangedOnLoad: returned.token.generation === afterSave.token.generation,
                generationAdvanced: selected.token.generation > afterSave.token.generation,
              };
            },
            { version, bytes, token: loads[0].token },
          );
          assert.deepEqual(evidence.migrated, evidence.expected);
          assert.equal(evidence.saved, true);
          assert.deepEqual(evidence.afterSave, evidence.candidate);
          assert.deepEqual(evidence.oldLoaded, evidence.candidate);
          assert.deepEqual(
            evidence.automatic,
            evidence.candidate,
            "old writes never become automatic rollback intent",
          );
          assert.equal(evidence.recoveryPreserved, true);
          assert.equal(evidence.generationUnchangedOnLoad, true);
          assert.equal(evidence.imported, true);
          assert.deepEqual(evidence.returned, evidence.continued);
          assert.equal(evidence.archiveUnchanged, true);
          assert.equal(evidence.legacyUnchanged, true);
          assert.equal(evidence.generationAdvanced, true);
          await context.close();
          return { version, scenario, released6Actions: 3, archiveUnchanged: true };
        },
      );
    }
  const context = await browser.newContext(),
    page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await boot(page);
  const bytes = readFileSync("scripts/fixtures/boardworld/v5-fresh-newcomer.json", "utf8");
  await page.evaluate((bytes) => localStorage.setItem(p.LEGACY_V5_SAVE_KEY, bytes), bytes);
  await page.evaluate(async () => {
    const loaded = await p.loadGameLocked();
    await p.saveGameLocked(next(loaded.state), undefined, loaded.token);
  });
  for (const when of ["before-put", "after-put-success"])
    await check(`IDB abort ${when}: no false success or partial slots`, async () => {
      const result = await page.evaluate(async (when) => {
        const loaded = await p.loadGameLocked(),
          before = await head(),
          mirror = p.readSaveToken();
        const put = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function (...args) {
          if (this.name === "state") {
            if (when === "before-put") throw new DOMException("quota", "QuotaExceededError");
            const request = put.apply(this, args);
            request.addEventListener("success", () => this.transaction.abort(), { once: true });
            return request;
          }
          return put.apply(this, args);
        };
        let result;
        try {
          result = await p.saveGameLocked(next(loaded.state), undefined, loaded.token);
        } finally {
          IDBObjectStore.prototype.put = put;
        }
        return { result, before, after: await head(), mirror, afterMirror: p.readSaveToken() };
      }, when);
      assert.equal(result.result.ok, false);
      assert.equal(result.result.token, undefined);
      assert.deepEqual(result.after, result.before);
      assert.deepEqual(result.afterMirror, result.mirror);
      return { ok: false, durableSlotsUnchanged: true };
    });
  await check(
    "warm validation cannot rotate checksum-invalid primary bytes into the backup",
    async () => {
      const result = await page.evaluate(async () => {
        const loaded = await p.loadGameLocked();
        const warm = await p.saveGameLocked(loaded.state, undefined, loaded.token);
        if (!warm.ok) throw Error(warm.message);
        const envelope = JSON.parse(warm.token.primary);
        // Same checksum and decoded state, different bytes: checksum must fail.
        envelope.payload += " ";
        const damaged = JSON.stringify(envelope);
        await new Promise((resolve, reject) => {
          const request = indexedDB.open(`${p.SAVE_KEY}.transactions`, 1);
          request.onsuccess = () => {
            const db = request.result,
              tx = db.transaction("state", "readwrite");
            const store = tx.objectStore("state"),
              get = store.get("head");
            get.onsuccess = () => {
              const record = get.result,
                slots = new Map(record.slots);
              slots.set(p.SAVE_KEY, damaged);
              record.slots = [...slots];
              store.put(record, "head");
            };
            tx.oncomplete = () => {
              db.close();
              resolve();
            };
            tx.onabort = () => {
              db.close();
              reject(tx.error);
            };
          };
          request.onerror = () => reject(request.error);
        });
        const recovered = await p.loadGameLocked();
        const candidate = next(recovered.state);
        const repaired = await p.saveGameLocked(candidate, undefined, recovered.token);
        return {
          warm: warm.ok,
          damagedRejected: p.importGame(damaged).state === null,
          recovered: recovered.state,
          expected: loaded.state,
          repaired: repaired.ok,
          backup: repaired.token?.backup,
          healthyBytes: warm.token.primary,
          after: (await p.loadGameLocked()).state,
          candidate,
        };
      });
      assert.equal(result.warm, true);
      assert.equal(result.damagedRejected, true);
      assert.deepEqual(result.recovered, result.expected);
      assert.equal(result.repaired, true);
      assert.equal(result.backup, result.healthyBytes);
      assert.deepEqual(result.after, result.candidate);
      return { changedBytesRevalidated: true, healthyBackupPreserved: true };
    },
  );
  await check(
    "warm byte validation never validates a subsequently mutated state object",
    async () => {
      const result = await page.evaluate(async () => {
        const loaded = await p.loadGameLocked(),
          state = loaded.state;
        const warm = await p.saveGameLocked(state, undefined, loaded.token);
        if (!warm.ok) throw Error(warm.message);
        const before = await head(),
          mirror = p.readSaveToken();
        state.player.health = 101;
        const rejected = await p.saveGameLocked(state, undefined, warm.token);
        return {
          ok: rejected.ok,
          token: rejected.token,
          before,
          after: await head(),
          mirror,
          afterMirror: p.readSaveToken(),
        };
      });
      assert.equal(result.ok, false);
      assert.equal(result.token, undefined);
      assert.deepEqual(result.after, result.before);
      assert.deepEqual(result.afterMirror, result.mirror);
      return { invalidLiveStateRejected: true, durableSlotsUnchanged: true };
    },
  );
  await check(
    "valid bytes from an aborted save cannot authorize a stale retry after another commit",
    async () => {
      const result = await page.evaluate(async () => {
        const loaded = await p.loadGameLocked(),
          candidate = next(loaded.state);
        const put = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function (...args) {
          const request = put.apply(this, args);
          if (this.name === "state")
            request.addEventListener("success", () => this.transaction.abort(), { once: true });
          return request;
        };
        let aborted;
        try {
          aborted = await p.saveGameLocked(candidate, undefined, loaded.token);
        } finally {
          IDBObjectStore.prototype.put = put;
        }
        const other = e.createGame({ seed: 91373, name: "Validation Cache Writer" });
        const winner = await p.saveGameLocked(other, undefined, loaded.token);
        const before = await head(),
          mirror = p.readSaveToken();
        const rejected = await p.saveGameLocked(candidate, undefined, loaded.token);
        return {
          aborted: aborted.ok,
          winner: winner.ok,
          rejected,
          before,
          after: await head(),
          mirror,
          afterMirror: p.readSaveToken(),
          expected: other,
          state: (await p.loadGameLocked()).state,
        };
      });
      assert.equal(result.aborted, false);
      assert.equal(result.winner, true);
      assert.equal(result.rejected.ok, false);
      assert.equal(result.rejected.conflict, true);
      assert.deepEqual(result.after, result.before);
      assert.deepEqual(result.afterMirror, result.mirror);
      assert.deepEqual(result.state, result.expected);
      return { abortedBytesNotAuthority: true, staleRetryRejected: true };
    },
  );
  await check(
    "localStorage mirror failure after commit: durable success, repair on reload",
    async () => {
      const result = await page.evaluate(async () => {
        const loaded = await p.loadGameLocked(),
          candidate = next(loaded.state);
        const set = Storage.prototype.setItem;
        Storage.prototype.setItem = function (key, bytes) {
          if (key === p.SAVE_KEY) throw new DOMException("quota", "QuotaExceededError");
          return set.call(this, key, bytes);
        };
        let saved;
        try {
          saved = await p.saveGameLocked(candidate, undefined, loaded.token);
        } finally {
          Storage.prototype.setItem = set;
        }
        const recovered = await p.loadGameLocked();
        return {
          saved: { ok: saved.ok, mirrorFailed: saved.mirrorFailed },
          candidate,
          recovered: recovered.state,
          mirror: p.importGame(localStorage.getItem(p.SAVE_KEY)).state,
        };
      });
      assert.deepEqual(result.saved, { ok: true, mirrorFailed: true });
      assert.deepEqual(result.recovered, result.candidate);
      assert.deepEqual(result.mirror, result.candidate);
      return { atomicCommitPreserved: true, mirrorRepaired: true };
    },
  );
  await check("unavailable IndexedDB: export-only, no localStorage fallback write", async () => {
    const result = await page.evaluate(async () => {
      const before = p.readSaveToken(),
        descriptor = Object.getOwnPropertyDescriptor(window, "indexedDB");
      Object.defineProperty(window, "indexedDB", { value: undefined, configurable: true });
      try {
        const loaded = await p.loadGameLocked();
        const saved = await p.saveGameLocked(next(loaded.state), undefined, loaded.token);
        return {
          ok: saved.ok,
          before,
          after: p.readSaveToken(),
          exportable: !!p.importGame(p.exportGame(loaded.state)).state,
        };
      } finally {
        Object.defineProperty(window, "indexedDB", descriptor);
      }
    });
    assert.equal(result.ok, false);
    assert.equal(result.exportable, true);
    assert.deepEqual(result.after, result.before);
    return { exportable: true, localStorageUnchanged: true };
  });
  await check(
    "unreadable localStorage does not hide or overwrite authoritative progress",
    async () => {
      const result = await page.evaluate(async () => {
        const before = await p.loadGameLocked(),
          candidate = next(before.state);
        const get = Storage.prototype.getItem;
        Storage.prototype.getItem = function (key) {
          if (key.startsWith("tariklab.boardworld"))
            throw new DOMException("denied", "SecurityError");
          return get.call(this, key);
        };
        let loaded, saved;
        try {
          loaded = await p.loadGameLocked();
          saved = await p.saveGameLocked(candidate, undefined, loaded.token);
        } finally {
          Storage.prototype.getItem = get;
        }
        return {
          before: before.state,
          loaded: loaded.state,
          saved: saved.ok,
          candidate,
          after: (await p.loadGameLocked()).state,
        };
      });
      assert.deepEqual(result.loaded, result.before);
      assert.equal(result.saved, true);
      assert.deepEqual(result.after, result.candidate);
    },
  );
  await check(
    "corrupt compatibility copy cannot roll back healthy committed progress",
    async () => {
      const result = await page.evaluate(async () => {
        const before = await p.loadGameLocked();
        localStorage.setItem(p.SAVE_KEY, "corrupt");
        localStorage.setItem(p.BACKUP_KEY, "also-corrupt");
        const after = await p.loadGameLocked();
        return { before: before.state, after: after.state };
      });
      assert.deepEqual(result.after, result.before);
    },
  );
  await check("corrupt authoritative primary recovers healthy v6 backup", async () => {
    const before = await page.evaluate(
      async () => p.importGame((await p.loadGameLocked()).token.backup).state,
    );
    await page.evaluate(() => corrupt(false));
    assert.deepEqual(await page.evaluate(async () => (await p.loadGameLocked()).state), before);
  });
  await check(
    "both authoritative v6 slots corrupt: immutable v5 archive migrates atomically",
    async () => {
      await page.evaluate(() => corrupt(true));
      const result = await page.evaluate(async (bytes) => {
        const loaded = await p.loadGameLocked();
        return {
          expected: p.importGame(bytes).state,
          actual: loaded.state,
          protected: loaded.protected,
          archive: localStorage.getItem(p.ORIGINAL_V5_BACKUP_KEY),
        };
      }, bytes);
      assert.deepEqual(result.actual, result.expected);
      assert.equal(result.protected, true);
      assert.equal(result.archive, bytes);
    },
  );
  await context.close();
  await check("no Web Locks: legacy load/export never promotes or writes", async () => {
    const context = await browser.newContext(),
      page = await context.newPage();
    await boot(page);
    const result = await page.evaluate(async (bytes) => {
      localStorage.setItem(p.LEGACY_V5_SAVE_KEY, bytes);
      Object.defineProperty(navigator, "locks", { value: undefined });
      const before = JSON.stringify(localStorage),
        loaded = await p.loadGameLocked();
      const saved = await p.saveGameLocked(next(loaded.state), undefined, loaded.token);
      return {
        unchanged: before === JSON.stringify(localStorage),
        ok: saved.ok,
        protected: loaded.protected,
        exportable: !!p.importGame(p.exportGame(loaded.state)).state,
      };
    }, bytes);
    assert.deepEqual(result, { unchanged: true, ok: false, protected: false, exportable: true });
    await context.close();
  });
  await check(
    "foreign fork survives reload and UI download; only explicit file import replaces the winner",
    async () => {
      const context = await browser.newContext();
      await context.route("**/released6/*.mjs", (route) =>
        route.fulfill({
          contentType: "text/javascript",
          body: readFileSync(
            join(
              temp,
              "public/games/tc-sim-boardworld",
              new URL(route.request().url()).pathname.split("/").at(-1),
            ),
          ),
        }),
      );
      const old = await context.newPage();
      await boot(old);
      const native = readFileSync("scripts/fixtures/boardworld/v6-fresh-newcomer.json", "utf8");
      await old.evaluate(async (bytes) => {
        window.legacy = await import("/released6/persistence.mjs");
        window.legacyEngine = await import("/released6/engine.mjs");
        localStorage.setItem(legacy.SAVE_KEY, bytes);
        window.retained = legacy.loadGame().state;
      }, native);
      const writer = await context.newPage();
      await boot(writer);
      const winner = await writer.evaluate(async () => {
        const loaded = await p.loadGameLocked();
        const result = e.resolveAction(loaded.state, "event:welcome:work");
        const saved = await p.saveGameLocked(result.state, undefined, loaded.token);
        if (!saved.ok) throw Error(saved.message);
        return result.state;
      });
      const fork = await old.evaluate(() => {
        const result = legacyEngine.resolveAction(retained, "event:welcome:learn");
        if (!legacy.saveGame(result.state).ok) throw Error("old writer failed");
        return result.state;
      });
      const denied = await writer.evaluate(async () => {
        const put = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function (...args) {
          if (this.name === "seen" && args[1] === "recovery")
            throw new DOMException("quota", "QuotaExceededError");
          return put.apply(this, args);
        };
        try {
          return await p.loadGameLocked();
        } finally {
          IDBObjectStore.prototype.put = put;
        }
      });
      assert.deepEqual(
        denied.state,
        winner,
        "a failed recovery archive cannot fall back to the foreign fork",
      );
      assert.equal(denied.token, null, "failed recovery remains export-only");
      const ui = await context.newPage();
      ui.on("pageerror", (e) => errors.push(e.message));
      await ui.goto(`${origin}/games/tc-sim-boardworld/index.html`);
      await ui.waitForFunction(() => window.boardworldInspect?.());
      assert.deepEqual(await ui.evaluate(() => window.boardworldInspect()), winner);
      assert.match(await ui.locator("#notice").innerText(), /Farklı bir kayıt kopyası korundu/);
      await ui.reload();
      await ui.waitForFunction(() => window.boardworldInspect?.());
      assert.deepEqual(await ui.evaluate(() => window.boardworldInspect()), winner);
      await ui.locator("[data-ui=menu]").click();
      const [download] = await Promise.all([
        ui.waitForEvent("download"),
        ui.locator('[data-ui="recovery:0"]').click(),
      ]);
      const recovered = readFileSync(await download.path());
      const exported = await ui.evaluate(
        async (bytes) => (await import("./persistence.mjs")).importGame(bytes).state,
        recovered.toString(),
      );
      assert.deepEqual(exported, fork, "download contains the exact old divergent move");
      assert.deepEqual(
        await ui.evaluate(() => window.boardworldInspect()),
        winner,
        "downloading never imports",
      );
      await ui.locator("#import-file").setInputFiles({
        name: "chosen-recovery.json",
        mimeType: "application/json",
        buffer: recovered,
      });
      await ui.waitForFunction(
        (expected) => JSON.stringify(window.boardworldInspect()) === JSON.stringify(expected),
        fork,
      );
      await ui.reload();
      await ui.waitForFunction(() => window.boardworldInspect?.());
      assert.deepEqual(
        await ui.evaluate(() => window.boardworldInspect()),
        fork,
        "the selected file import survives reload",
      );
      const backup = await ui.evaluate(async () => {
        const p = await import("./persistence.mjs");
        return p.importGame((await p.loadGameLocked()).token.backup).state;
      });
      assert.deepEqual(backup, winner, "the replaced Gold winner remains the rolling backup");
      await context.close();
      return {
        automaticWinnerPreserved: true,
        recoveryAbortSafe: true,
        exactUiDownload: true,
        explicitImportPersisted: true,
        winnerRetainedAsBackup: true,
      };
    },
  );
  assert.deepEqual(errors, []);
  report.status = "PASS";
} catch (error) {
  report.status = "FAIL";
  report.error = error.stack;
  throw error;
} finally {
  writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ status: report.status, passed: report.results.length, output }));
  await browser?.close();
  server.close();
  rmSync(temp, { recursive: true, force: true });
}
