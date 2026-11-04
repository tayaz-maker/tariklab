/** Real IndexedDB fault tests, never imported by production. Run with node --experimental-strip-types. */
import { build } from "esbuild";
import { chromium, firefox, webkit } from "playwright";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import type { SaveEnvelope } from "../persistence/index.ts";

type Api = typeof import("../persistence/journal.ts") &
  typeof import("../persistence/index.ts") &
  typeof import("../simulation/engine.ts");
const browserKind = process.env.SE_BROWSER ?? "chromium";
if (!["chromium", "firefox", "webkit"].includes(browserKind)) throw Error("Invalid browser kind");
const output = resolve(
  "artifacts/social-engine/persistence-browser" +
    (browserKind === "chromium" ? "" : "-" + browserKind),
);
await mkdir(output, { recursive: true });
const bundled = await build({
  stdin: {
    contents:
      "export * from './src/games/social-engine/persistence/index.ts'; export {newJournalMeta,encodeJournal} from './src/games/social-engine/persistence/journal.ts'; export {createWorld,canonicalState,stepWorld,applyCommand} from './src/games/social-engine/simulation/engine.ts';",
    resolveDir: process.cwd(),
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  write: false,
});
const js = bundled.outputFiles[0].text;
const fixture = gunzipSync(
  await readFile("src/games/social-engine/persistence/fixtures/v1-world.json.gz"),
).toString("utf8");
const fixtureV2 = gunzipSync(
  await readFile("src/games/social-engine/persistence/fixtures/v2-world.json.gz"),
).toString("utf8");
const fixtureV3 = gunzipSync(
  await readFile("src/games/social-engine/persistence/fixtures/v3-world.json.gz"),
).toString("utf8");
const fixtureV6 = gunzipSync(
  await readFile("src/games/social-engine/persistence/fixtures/v6-auto-with-tail.json.gz"),
).toString("utf8");
const fixtureV5 = gunzipSync(
  await readFile("src/games/social-engine/persistence/fixtures/v5-auto-with-tail.json.gz"),
).toString("utf8");
const server = createServer((request, response) => {
  response.writeHead(200, {
    "content-type": request.url === "/bundle.js" ? "text/javascript" : "text/html",
    "cache-control": "no-store",
  });
  response.end(
    request.url === "/bundle.js"
      ? js
      : '<!doctype html><html lang="tr"><title>SOCIAL ENGINE persistence QA</title><body><h1>IndexedDB doğrulama</h1></body></html>',
  );
});
await new Promise<void>((resolveServer) => server.listen(0, "127.0.0.1", resolveServer));
const address = server.address();
if (!address || typeof address === "string") throw new Error("Test server address unavailable");
const base = `http://127.0.0.1:${address.port}`;
const launcher = { chromium, firefox, webkit }[browserKind as "chromium" | "firefox" | "webkit"];
const browser = await launcher.launch({
  ...(browserKind === "chromium"
    ? {
        executablePath:
          process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
          (process.platform === "darwin"
            ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
            : chromium.executablePath()),
      }
    : {}),
  headless: true,
});
const context = await browser.newContext();
const page = await context.newPage();
const errors: string[] = [];
page.on("pageerror", (error) => errors.push(error.message));
await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
try {
  await page.goto(base + "/");
  const result = await page.evaluate(
    async ({ fixture, fixtureV2, fixtureV3, fixtureV5, fixtureV6 }) => {
      const bundle = "/bundle.js";
      const api = (await import(bundle)) as Api;
      const repository = new api.SaveRepository();
      const checks: {
        name: string;
        status: "PASS" | "FAIL";
        duration_ms: number;
        detail?: string;
      }[] = [];
      const ensure = (condition: unknown, message: string) => {
        if (!condition) throw new Error(message);
      };
      const canonical = api.canonicalState;
      const fresh = (name: string) => {
        const world = api.createWorld(20261103);
        world.player.name = name;
        world.player.profile.name = name;
        return world;
      };
      const request = <T>(request: IDBRequest<T>) =>
        new Promise<T>((resolve, reject) => {
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
      const raw = async <T>(
        stores: string[],
        mode: IDBTransactionMode,
        action: (tx: IDBTransaction) => Promise<T> | T,
      ): Promise<T> => {
        const db = await request(indexedDB.open(api.DATABASE_NAME, api.DATABASE_VERSION));
        const tx = db.transaction(stores, mode);
        const done = new Promise<void>((resolve, reject) => {
          tx.oncomplete = () => resolve();
          tx.onabort = () => reject(tx.error);
        });
        const value = await action(tx);
        await done;
        db.close();
        return value;
      };
      const slot = async (id: string) =>
        raw(["slots"], "readonly", (tx) => request(tx.objectStore("slots").get(id))) as Promise<{
          revisionId: string;
          previousRevisionId?: string;
        }>;
      const revision = async (id: string) =>
        raw(["revisions"], "readonly", (tx) =>
          request(tx.objectStore("revisions").get(id)),
        ) as Promise<SaveEnvelope>;
      const rejected = async (action: () => Promise<unknown>, code: string) => {
        let error: unknown;
        try {
          await action();
        } catch (failure) {
          error = failure;
        }
        ensure(
          error && typeof error === "object" && "code" in error && error.code === code,
          `Expected ${code}, received ${String(error)}`,
        );
      };
      const check = async (name: string, action: () => Promise<void>) => {
        const start = performance.now();
        try {
          await action();
          checks.push({ name, status: "PASS", duration_ms: performance.now() - start });
        } catch (error) {
          checks.push({
            name,
            status: "FAIL",
            duration_ms: performance.now() - start,
            detail: String(error),
          });
          throw new Error(name + ": " + String(error), { cause: error });
        }
      };
      const first = fresh("İlk Yaşam"),
        second = fresh("İkinci Yaşam");
      const canaries = {
        "tc-sim-save": '{"canary":"tc"}',
        "tariklab::tc-sim:1": "tc-slot",
        "tariklab.boardworld.v6": "boardworld",
        racon_v1: "racon",
        "tariklab::racon:1": "racon-slot",
      };
      for (const [key, value] of Object.entries(canaries)) localStorage.setItem(key, value);
      await check(
        "database version1 upgrades without rewriting existing schema3 bytes",
        async () => {
          const opening = indexedDB.open(api.DATABASE_NAME, 1);
          opening.onupgradeneeded = () => {
            for (const [name, keyPath] of [
              ["slots", "slotId"],
              ["revisions", "revisionId"],
              ["migrationJournal", "id"],
              ["quarantine", "id"],
            ])
              opening.result.createObjectStore(name, { keyPath });
          };
          const old = await request(opening),
            source = JSON.parse(fixtureV3) as SaveEnvelope;
          const tx = old.transaction(["slots", "revisions"], "readwrite");
          const done = new Promise<void>((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onabort = () => reject(tx.error);
          });
          tx.objectStore("revisions").put(source);
          tx.objectStore("slots").put({
            slotId: source.slotId,
            revisionId: source.revisionId,
            tick: source.tick,
            updatedAt: source.createdAt,
            byteLength: source.byteLength,
          });
          await done;
          old.close();
          ensure((await repository.list()).length === 1, "Upgrade lost slot");
          const upgraded = await request(indexedDB.open(api.DATABASE_NAME, api.DATABASE_VERSION));
          ensure(
            upgraded.version === api.DATABASE_VERSION &&
              upgraded.objectStoreNames.contains("commandJournal") &&
              upgraded.objectStoreNames.contains("journalMeta"),
            "Journal stores absent",
          );
          upgraded.close();
          ensure(
            JSON.stringify(await revision(source.revisionId)) === fixtureV3.trim(),
            "DB upgrade rewrote source bytes",
          );
        },
      );
      await check("real IndexedDB state round-trip and UTF-8 profile", async () => {
        await repository.save("slot-1", first);
        ensure(
          canonical(await repository.load("slot-1")) === canonical(first),
          "Saved world differs",
        );
        ensure((await repository.list()).length === 1, "Slot duplicated");
      });
      await check("snapshot captured before a queued caller mutation", async () => {
        const candidate = fresh("Yakalanan An"),
          expected = canonical(candidate),
          saving = repository.save("slot-2", candidate);
        candidate.player.name = "Sonraki An";
        candidate.player.profile.name = "Sonraki An";
        await saving;
        ensure(
          canonical(await repository.load("slot-2")) === expected,
          "Snapshot changed after enqueue",
        );
      });
      await check("export/import/copy/delete preserve world and unrelated slots", async () => {
        const text = await repository.export("slot-1");
        await repository.import("slot-2", text);
        ensure(canonical(await repository.load("slot-2")) === canonical(first), "Import differs");
        await repository.copy("slot-2", "slot-3");
        ensure(canonical(await repository.load("slot-3")) === canonical(first), "Copy differs");
        await repository.delete("slot-2");
        await rejected(() => repository.load("slot-2"), "EMPTY_SLOT");
        ensure(canonical(await repository.load("slot-1")) === canonical(first), "Source changed");
        ensure(
          canonical(await repository.load("slot-3")) === canonical(first),
          "Other slot changed",
        );
      });
      await check("aborted transaction preserves the last verified revision", async () => {
        const before = await slot("slot-1"),
          original = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function (...args) {
          const result = original.apply(this, args);
          if (this.name === "slots") this.transaction.abort();
          return result;
        };
        try {
          await rejected(() => repository.save("slot-1", second), "WRITE_FAILED");
        } finally {
          IDBObjectStore.prototype.put = original;
        }
        ensure(
          (await slot("slot-1")).revisionId === before.revisionId,
          "Aborted pointer was committed",
        );
        ensure(
          canonical(await repository.load("slot-1")) === canonical(first),
          "Aborted data lost previous save",
        );
      });
      await check("quota exception preserves current and previous revisions", async () => {
        const before = await slot("slot-1"),
          original = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function (...args) {
          if (this.name === "revisions")
            throw new DOMException("Injected quota exhaustion", "QuotaExceededError");
          return original.apply(this, args);
        };
        try {
          await rejected(() => repository.save("slot-1", second), "QUOTA_EXCEEDED");
        } finally {
          IDBObjectStore.prototype.put = original;
        }
        ensure(
          (await slot("slot-1")).revisionId === before.revisionId,
          "Quota failure changed slot",
        );
        ensure(
          canonical(await repository.load("slot-1")) === canonical(first),
          "Quota failure lost save",
        );
      });
      await check(
        "corrupt current revision falls back, quarantines and preserves prior state",
        async () => {
          await repository.save("slot-1", second);
          const pointer = await slot("slot-1"),
            newest = await revision(pointer.revisionId);
          await raw(["revisions"], "readwrite", (tx) => {
            tx.objectStore("revisions").put({
              ...newest,
              payload: (newest.payload[0] === "A" ? "B" : "A") + newest.payload.slice(1),
            });
          });
          ensure(
            canonical(await repository.load("slot-1")) === canonical(first),
            "Wrong fallback state",
          );
          ensure(repository.lastRecovery?.includes("kurtarıldı"), "No recovery notice");
          const quarantine = await raw(["quarantine"], "readonly", (tx) =>
            request(tx.objectStore("quarantine").getAll()),
          );
          ensure(quarantine.length === 1, "Bad revision not quarantined");
          const revisions = (await raw(["revisions"], "readonly", (tx) =>
            request(tx.objectStore("revisions").getAll()),
          )) as SaveEnvelope[];
          ensure(
            revisions.filter((row) => row.slotId === "slot-1").length === 2,
            "Revision retention changed",
          );
        },
      );
      await check(
        "future schema refuses downgrade even with a valid previous revision",
        async () => {
          const pointer = await slot("slot-1"),
            current = await revision(pointer.revisionId);
          await raw(["revisions"], "readwrite", (tx) => {
            tx.objectStore("revisions").put({ ...current, schemaVersion: 99 });
          });
          await rejected(() => repository.load("slot-1"), "UNSUPPORTED_VERSION");
          ensure(
            (await slot("slot-1")).revisionId === pointer.revisionId,
            "Future data was rewritten",
          );
          await raw(["revisions"], "readwrite", (tx) => {
            tx.objectStore("revisions").put(current);
          });
        },
      );
      await check("independent repository instances reject stale concurrent writes", async () => {
        const other = new api.SaveRepository();
        await other.load("slot-1");
        await repository.save("slot-1", second);
        await rejected(() => other.save("slot-1", first), "WRITE_CONFLICT");
        ensure(
          canonical(await repository.load("slot-1")) === canonical(second),
          "Stale instance overwrote newer save",
        );
        await other.close();
      });
      await check("migration is atomic, retryable and retains frozen source bytes", async () => {
        const before = canonical(await repository.load("slot-3")),
          original = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function (...args) {
          const result = original.apply(this, args);
          if (this.name === "migrationJournal") this.transaction.abort();
          return result;
        };
        try {
          await rejected(() => repository.import("slot-3", fixture), "WRITE_FAILED");
        } finally {
          IDBObjectStore.prototype.put = original;
        }
        ensure(
          canonical(await repository.load("slot-3")) === before,
          "Interrupted migration changed destination",
        );
        await repository.import("slot-3", fixture);
        const migrated = canonical(await repository.load("slot-3"));
        await repository.import("slot-3", fixture);
        ensure(
          canonical(await repository.load("slot-3")) === migrated,
          "Migration retry changed state",
        );
        const journal = (await raw(["migrationJournal"], "readonly", (tx) =>
          request(tx.objectStore("migrationJournal").getAll()),
        )) as { source: SaveEnvelope; steps: number[]; targetSchema: number }[];
        ensure(journal.length === 1, "Migration retry duplicated journal");
        ensure(
          JSON.stringify(journal[0].steps) === "[1,2,3,4,5,6]" && journal[0].targetSchema === 7,
          "Migration chain missing",
        );
        ensure(
          JSON.stringify(journal[0].source) === fixture.trim(),
          "Migration source bytes changed",
        );
      });
      await check("authentic v2 save migrates through an explicit journal to schema4", async () => {
        await repository.import("slot-3", fixtureV2);
        const state = await repository.load("slot-3");
        ensure(state.schemaVersion === 7 && state.life.version === 2, "Lifecycle migration absent");
        const journal = (await raw(["migrationJournal"], "readonly", (tx) =>
          request(tx.objectStore("migrationJournal").getAll()),
        )) as { source: SaveEnvelope; steps: number[]; targetSchema: number }[];
        const entry = journal.find((row) => row.source.schemaVersion === 2);
        ensure(
          entry && JSON.stringify(entry.steps) === "[2,3,4,5,6]" && entry.targetSchema === 7,
          "V2 chain missing",
        );
        ensure(JSON.stringify(entry!.source) === fixtureV2.trim(), "V2 source bytes changed");
        ensure(
          Object.keys(state.life.parentage).length === 0 && state.life.partnerships.length === 0,
          "Migration invented family history",
        );
      });
      await check(
        "authentic v3 lifecycle history migrates through explicit3-to4 journal",
        async () => {
          await repository.import("slot-3", fixtureV3);
          const state = await repository.load("slot-3");
          ensure(
            state.schemaVersion === 7 && state.life.version === 2,
            "Schema4 family migration missing",
          );
          const rows = (await raw(["migrationJournal"], "readonly", (tx) =>
            request(tx.objectStore("migrationJournal").getAll()),
          )) as { source: SaveEnvelope; steps: number[] }[];
          const source = rows.find((row) => row.source.schemaVersion === 3);
          ensure(source && JSON.stringify(source.steps) === "[3,4,5,6]", "V3 chain missing");
          ensure(JSON.stringify(source!.source) === fixtureV3.trim(), "V3 source bytes changed");
        },
      );
      await check("invalid import never overwrites a valid existing slot", async () => {
        const before = canonical(await repository.load("slot-3"));
        await rejected(() => repository.import("slot-3", '{"invalid":true}'), "INVALID_SAVE");
        ensure(
          canonical(await repository.load("slot-3")) === before,
          "Invalid import changed destination",
        );
      });
      const timings: number[] = [];
      await check("twenty measured saves and loads preserve canonical state", async () => {
        for (let i = 0; i < 20; i++) {
          const start = performance.now();
          await repository.save("auto", first);
          ensure(
            canonical(await repository.load("auto")) === canonical(first),
            "Measured save differs",
          );
          timings.push(performance.now() - start);
        }
      });
      await check(
        "old TC SIM, Boardworld and Racon namespace canaries stay byte-identical",
        async () => {
          for (const [key, value] of Object.entries(canaries))
            ensure(localStorage.getItem(key) === value, `Legacy key changed: ${key}`);
          const rows = await repository.list();
          ensure(
            rows.length === 3 && new Set(rows.map((row) => row.slotId)).size === rows.length,
            "Slot counts inconsistent",
          );
        },
      );
      let head: import("../persistence/journal.ts").JournalHandle;
      let live = fresh("Günlük Dünyası"),
        firstPrefix = structuredClone(live);
      const tickBatch = (world: typeof live, from: number, count: number, epoch: string) => {
        const operations: import("../persistence/journal.ts").JournalOperation[] = [];
        for (let i = 0; i < count; i++) {
          const commands =
            i === 0
              ? [{ v: 1 as const, id: `wal-move:${from}`, type: "MOVE", args: { x: 1, y: 0 } }]
              : [];
          api.stepWorld(world, commands);
          operations.push({ cursor: from + i + 1, type: "TICK", endingTick: world.tick, commands });
        }
        return { epoch, fromCursor: from, toCursor: from + count, operations };
      };
      await check(
        "durable command journal replays exact tick operations after reopening",
        async () => {
          head = await repository.beginJournal(
            "auto",
            live,
            { epoch: "browser-journal", cursor: 0 },
            await repository.inspectJournal(),
          );
          const batch = tickBatch(live, 0, 10, head.epoch);
          head = await repository.appendJournal(head, batch);
          firstPrefix = structuredClone(live);
          const reopened = new api.SaveRepository();
          ensure(
            canonical(await reopened.load("auto")) === canonical(live),
            "Durable tail differs after reopen",
          );
          await reopened.close();
        },
      );
      let beforePause: typeof head, pauseBatch: import("../persistence/journal.ts").JournalBatch;
      await check(
        "paused commands controls and manual copy/export retain exact journal semantics",
        async () => {
          beforePause = { ...head };
          const commands = [
            { v: 1 as const, id: "wal-speed", type: "SET_TIME_SPEED", args: { speed: 2 } },
          ];
          live.flags.moveX = 0;
          live.flags.moveY = 0;
          live.flags.throttle = 0;
          live.flags.steer = 0;
          commands.forEach((c) => api.applyCommand(live, c));
          pauseBatch = {
            epoch: head.epoch,
            fromCursor: head.cursor,
            toCursor: head.cursor + 3,
            operations: [
              { cursor: head.cursor + 1, type: "PAUSE_CONTROL", tick: live.tick, paused: true },
              { cursor: head.cursor + 2, type: "APPLY_WHILE_PAUSED", tick: live.tick, commands },
              { cursor: head.cursor + 3, type: "PAUSE_CONTROL", tick: live.tick, paused: false },
            ],
          };
          head = await repository.appendJournal(head, pauseBatch);
          ensure(
            canonical(await repository.load("auto")) === canonical(live),
            "Paused replay differs",
          );
          ensure(
            canonical((await api.decodeSaveText(await repository.export("auto"))).state) ===
              canonical(live),
            "Export omitted tail",
          );
          await repository.copy("auto", "slot-2");
          ensure(
            canonical(await repository.load("slot-2")) === canonical(live),
            "Manual copy omitted tail",
          );
        },
      );
      await check(
        "journal duplicate retry is idempotent and concurrent tail/checkpoint writes conflict",
        async () => {
          const duplicate = await repository.appendJournal(beforePause, pauseBatch);
          ensure(duplicate.cursor === head.cursor, "Retry duplicated cursor");
          const changed = structuredClone(pauseBatch);
          const op = changed.operations[1];
          if (op.type === "APPLY_WHILE_PAUSED") op.commands[0].args.speed = 0.5;
          await rejected(() => repository.appendJournal(beforePause, changed), "WRITE_CONFLICT");
          const other = new api.SaveRepository(),
            old = await other.inspectJournal(),
            oldState = structuredClone(live),
            batch = tickBatch(live, head.cursor, 1, head.epoch);
          head = await repository.appendJournal(head, batch);
          const conflicting = structuredClone(batch);
          const tick = conflicting.operations[0];
          if (tick.type === "TICK") tick.commands = [];
          await rejected(() => other.appendJournal(old!, conflicting), "WRITE_CONFLICT");
          await rejected(
            () =>
              other.checkpointJournal(old!, oldState, { epoch: old!.epoch, cursor: old!.cursor }),
            "WRITE_CONFLICT",
          );
          ensure(
            canonical(await repository.load("auto")) === canonical(live),
            "Conflict lost newer tail",
          );
          await other.close();
        },
      );
      await check(
        "quota and aborted journal transaction preserve the whole last durable prefix",
        async () => {
          const candidate = structuredClone(live),
            batch = tickBatch(candidate, head.cursor, 1, head.epoch),
            before = canonical(live),
            original = IDBObjectStore.prototype.put;
          IDBObjectStore.prototype.put = function (...args) {
            if (this.name === "commandJournal")
              throw new DOMException("QA journal quota", "QuotaExceededError");
            return original.apply(this, args);
          };
          try {
            await rejected(() => repository.appendJournal(head, batch), "QUOTA_EXCEEDED");
          } finally {
            IDBObjectStore.prototype.put = original;
          }
          ensure(
            canonical(await repository.load("auto")) === before,
            "Quota changed durable prefix",
          );
          IDBObjectStore.prototype.put = function (...args) {
            const request = original.apply(this, args);
            if (this.name === "commandJournal") this.transaction.abort();
            return request;
          };
          try {
            await rejected(() => repository.appendJournal(head, batch), "WRITE_FAILED");
          } finally {
            IDBObjectStore.prototype.put = original;
          }
          ensure(
            canonical(await repository.load("auto")) === before,
            "Abort changed durable prefix",
          );
        },
      );
      await check(
        "corrupt journal suffix quarantines source and replays only verified prefix",
        async () => {
          const rows = (await raw(["commandJournal"], "readonly", (tx) =>
            request(tx.objectStore("commandJournal").getAll()),
          )) as import("../persistence/journal.ts").StoredJournalBatch[];
          const damaged = rows.find((row) => row.fromCursor === 10)!;
          await raw(["commandJournal"], "readwrite", (tx) => {
            tx.objectStore("commandJournal").put({ ...damaged, payload: damaged.payload + " " });
          });
          ensure(
            canonical(await repository.load("auto")) === canonical(firstPrefix),
            "Corrupt tail was replayed or valid prefix lost",
          );
          ensure(!!repository.lastRecovery?.includes("karantina"), "Recovery not disclosed");
          const quarantine = (await raw(["quarantine"], "readonly", (tx) =>
            request(tx.objectStore("quarantine").getAll()),
          )) as { reason: string; source: { batches?: unknown[] } }[];
          ensure(
            quarantine.some(
              (row) => row.reason === "invalid-command-journal" && row.source.batches?.length,
            ),
            "Corrupt journal source missing",
          );
          live = structuredClone(firstPrefix);
          head = repository.lastJournalHandle!;
        },
      );
      await check(
        "atomic checkpoint prunes covered tail and accepts only a rebased suffix",
        async () => {
          const old = { ...head };
          head = await repository.checkpointJournal(head, live, {
            epoch: head.epoch,
            cursor: head.cursor,
          });
          ensure(
            head.baseRevisionId !== old.baseRevisionId && head.baseCursor === old.cursor,
            "Checkpoint did not rebase",
          );
          const rows = await raw(["commandJournal"], "readonly", (tx) =>
            request(tx.objectStore("commandJournal").getAll()),
          );
          ensure((rows as unknown[]).length === 0, "Covered tail not pruned");
          const batch = tickBatch(live, head.cursor, 1, head.epoch);
          await rejected(() => repository.appendJournal(old, batch), "WRITE_CONFLICT");
          head = await repository.appendJournal(head, batch);
          ensure(
            canonical(await repository.load("auto")) === canonical(live),
            "Rebased tail differs",
          );
        },
      );
      await check(
        "corrupt autosave baseline falls back and quarantines its incompatible journal",
        async () => {
          const current = await slot("auto"),
            old = await revision(current.previousRevisionId!),
            expected = (await api.decodeSave(old)).state,
            bad = await revision(current.revisionId);
          await raw(["revisions"], "readwrite", (tx) => {
            tx.objectStore("revisions").put({ ...bad, payload: bad.payload + " " });
          });
          ensure(
            canonical(await repository.load("auto")) === canonical(expected),
            "Corrupt base replayed unrelated tail",
          );
          ensure(
            repository.lastJournalHandle === null,
            "Incompatible journal survived base recovery",
          );
        },
      );
      await check(
        "begin-journal CAS protects another tab tail and explicit delete removes journal records",
        async () => {
          live = fresh("Son Günlük");
          head = await repository.beginJournal(
            "auto",
            live,
            { epoch: "next-session", cursor: 0 },
            await repository.inspectJournal(),
          );
          const other = new api.SaveRepository(),
            observed = await other.inspectJournal(),
            stale = structuredClone(live);
          head = await repository.appendJournal(head, tickBatch(live, 0, 2, head.epoch));
          await rejected(
            () =>
              other.beginJournal("auto", stale, { epoch: "stale-session", cursor: 0 }, observed),
            "WRITE_CONFLICT",
          );
          ensure(
            canonical(await repository.load("auto")) === canonical(live),
            "Begin overwrote another tab tail",
          );
          await other.close();
          await repository.delete("auto");
          ensure((await repository.inspectJournal()) === null, "Delete retained metadata");
          const rows = await raw(["commandJournal"], "readonly", (tx) =>
            request(tx.objectStore("commandJournal").getAll()),
          );
          ensure((rows as unknown[]).length === 0, "Delete retained tail");
          await repository.save("auto", first);
        },
      );
      await check(
        "explicit auto import/copy atomically replaces journal and retains fully replayed rollback",
        async () => {
          live = fresh("Replacement source");
          head = await repository.beginJournal(
            "auto",
            live,
            { epoch: "replace-one", cursor: 0 },
            await repository.inspectJournal(),
          );
          head = await repository.appendJournal(head, tickBatch(live, 0, 5, head.epoch));
          const beforeImport = canonical(live),
            imported = await repository.export("slot-1");
          await repository.import("auto", imported);
          ensure(repository.lastJournalHandle === null, "Import retained active journal");
          ensure(
            canonical(await repository.load("auto")) ===
              canonical((await api.decodeSaveText(imported)).state),
            "Imported state differs",
          );
          const afterImport = await slot("auto");
          ensure(
            canonical(
              (await api.decodeSave(await revision(afterImport.previousRevisionId!))).state,
            ) === beforeImport,
            "Import rollback omitted durable tail",
          );
          live = await repository.load("auto");
          head = await repository.beginJournal(
            "auto",
            live,
            { epoch: "replace-two", cursor: 0 },
            await repository.inspectJournal(),
          );
          head = await repository.appendJournal(head, tickBatch(live, 0, 2, head.epoch));
          const stale = new api.SaveRepository();
          await stale.inspectJournal();
          head = await repository.appendJournal(head, tickBatch(live, 2, 1, head.epoch));
          await rejected(() => stale.copy("slot-1", "auto"), "WRITE_CONFLICT");
          await stale.close();
          const beforeCopy = canonical(live);
          await repository.copy("slot-1", "auto");
          const afterCopy = await slot("auto");
          ensure(
            canonical(
              (await api.decodeSave(await revision(afterCopy.previousRevisionId!))).state,
            ) === beforeCopy,
            "Copy rollback omitted durable tail",
          );
          ensure((await repository.inspectJournal()) === null, "Copy retained journal");
        },
      );
      await check(
        "authentic schema5 snapshot and nonempty journal migrate atomically without activating formerly unknown commands",
        async () => {
          const frozen = JSON.parse(fixtureV5);
          const e: SaveEnvelope = frozen.envelope;
          await raw(["slots", "revisions", "journalMeta", "commandJournal"], "readwrite", (tx) => {
            tx.objectStore("commandJournal").clear();
            tx.objectStore("revisions").put(e);
            tx.objectStore("slots").put({
              slotId: "auto",
              revisionId: e.revisionId,
              tick: e.tick,
              byteLength: e.byteLength,
              updatedAt: e.createdAt,
            });
            tx.objectStore("journalMeta").put(frozen.meta);
            tx.objectStore("commandJournal").put(frozen.record);
          });
          const reader = new api.SaveRepository();
          try {
            const upgraded = await reader.load("auto");
            ensure(
              upgraded.schemaVersion === 7 && upgraded.tick === frozen.meta.currentTick,
              "Verified tail did not become the new baseline",
            );
            const oldShape = { ...upgraded, schemaVersion: 5, engineVersion: "1.0.0-candidate.4" };
            const hash = Array.from(
              new Uint8Array(
                await crypto.subtle.digest(
                  "SHA-256",
                  new TextEncoder().encode(canonical(oldShape)),
                ),
              ),
            )
              .map((n) => n.toString(16).padStart(2, "0"))
              .join("");
            ensure(
              hash === frozen.expectedCanonicalSha256,
              "Migrated world differs from the old engine replay",
            );
            ensure(
              (await revision(e.revisionId)).payload === e.payload,
              "Original revision changed",
            );
            ensure(
              canonical(await reader.load("auto")) === canonical(upgraded),
              "Migrated twice or replayed the tail twice",
            );
          } finally {
            await reader.close();
          }
        },
      );
      await check(
        "genuine f14e13f schema6 snapshot and tail replay before migration; old readers cannot mutate upgraded database",
        async () => {
          const frozen = JSON.parse(fixtureV6),
            e = frozen.envelope;
          await raw(["slots", "revisions", "journalMeta", "commandJournal"], "readwrite", (tx) => {
            tx.objectStore("commandJournal").clear();
            tx.objectStore("revisions").put(e);
            tx.objectStore("slots").put({
              slotId: "auto",
              revisionId: e.revisionId,
              tick: e.tick,
              byteLength: e.byteLength,
              updatedAt: e.createdAt,
            });
            tx.objectStore("journalMeta").put(frozen.meta);
            tx.objectStore("commandJournal").put(frozen.record);
          });
          const reader = new api.SaveRepository();
          try {
            const upgraded = await reader.load("auto");
            ensure(
              upgraded.schemaVersion === 7 && upgraded.tick === frozen.meta.currentTick,
              "Legacy tail missing",
            );
            const oldShape = { ...upgraded, schemaVersion: 6, engineVersion: "1.0.0-candidate.5" };
            const digest = Array.from(
              new Uint8Array(
                await crypto.subtle.digest(
                  "SHA-256",
                  new TextEncoder().encode(canonical(oldShape)),
                ),
              ),
            )
              .map((n) => n.toString(16).padStart(2, "0"))
              .join("");
            ensure(digest === frozen.expectedCanonicalSha256, "Historical replay diverged");
            ensure(
              canonical(await reader.load("auto")) === canonical(upgraded),
              "Tail replayed twice",
            );
            ensure(
              JSON.stringify(await revision(e.revisionId)) === JSON.stringify(e),
              "Source revision altered",
            );
            const provenance = await raw(["migrationJournal"], "readonly", (tx) =>
              request(tx.objectStore("migrationJournal").get(`${e.revisionId}:v7`)),
            );
            ensure(
              JSON.stringify(provenance.sourceJournal.meta) === JSON.stringify(frozen.meta),
              "Source meta not retained",
            );
            ensure(
              JSON.stringify(provenance.sourceJournal.records) === JSON.stringify([frozen.record]),
              "Source tail not retained",
            );
            const blocked = await new Promise<boolean>((resolve) => {
              const opening = indexedDB.open(api.DATABASE_NAME, 2);
              opening.onerror = () => resolve(opening.error?.name === "VersionError");
              opening.onsuccess = () => {
                opening.result.close();
                resolve(false);
              };
            });
            ensure(blocked, "Candidate5 database writer still opens");
          } finally {
            await reader.close();
          }
        },
      );
      await check(
        "corrupted migrated baseline recovers the exact old snapshot plus archived tail and rejects bad archives",
        async () => {
          const frozen = JSON.parse(fixtureV6),
            e = frozen.envelope;
          const head = await slot("auto");
          const current = await revision(head.revisionId);
          const readArchive = () =>
            raw(["migrationJournal"], "readonly", (tx) =>
              request(tx.objectStore("migrationJournal").get(`${e.revisionId}:v7`)),
            );
          const archive = await readArchive();
          const damaged = { ...current, payload: "corrupted" };
          await raw(["revisions"], "readwrite", (tx) => tx.objectStore("revisions").put(damaged));
          const stores = [
            "slots",
            "revisions",
            "journalMeta",
            "commandJournal",
            "migrationJournal",
            "quarantine",
          ];
          const snapshot = () =>
            raw(stores, "readonly", async (tx) =>
              Promise.all(stores.map((s) => request(tx.objectStore(s).getAll()))),
            );
          for (const fault of ["hash", "missing", "truncated"]) {
            const bad = structuredClone(archive);
            if (fault === "hash") bad.sourceJournal.records[0].hash = "0".repeat(64);
            else if (fault === "missing") delete bad.sourceJournal;
            else bad.sourceJournal = { records: [] };
            await raw(["migrationJournal"], "readwrite", (tx) =>
              tx.objectStore("migrationJournal").put(bad),
            );
            const before = JSON.stringify(await snapshot());
            const reader = new api.SaveRepository();
            try {
              await rejected(() => reader.load("auto"), "JOURNAL_CORRUPT");
            } finally {
              await reader.close();
            }
            ensure(
              JSON.stringify(await snapshot()) === before,
              "Bad archive recovery mutated history",
            );
          }
          await raw(["migrationJournal"], "readwrite", (tx) =>
            tx.objectStore("migrationJournal").put(archive),
          );
          const reader = new api.SaveRepository();
          try {
            const state = await reader.load("auto");
            ensure(
              canonical(state) === canonical((await api.decodeSave(current)).state),
              "Archive fallback lost acknowledged old tail",
            );
            ensure(
              canonical(await reader.load("auto")) === canonical(state),
              "Archive fallback replayed twice",
            );
            ensure(
              JSON.stringify((await readArchive()).sourceJournal) ===
                JSON.stringify(archive.sourceJournal),
              "Archive altered during fallback",
            );
          } finally {
            await reader.close();
          }
        },
      );
      await check(
        "incompatible schema6 journal fails without mutating original records",
        async () => {
          const frozen = JSON.parse(fixtureV6),
            e = frozen.envelope;
          for (const fault of ["hash", "clock", "semantic", "missing-meta"]) {
            const meta = structuredClone(frozen.meta),
              record = structuredClone(frozen.record);
            if (fault === "hash") record.hash = "0".repeat(64);
            if (fault === "clock") meta.currentTick++;
            // A structurally valid, checksummed batch with a dishonest tick must also fail closed.
            if (fault === "semantic") {
              const payload = JSON.parse(record.payload);
              payload.operations[0].endingTick += 2;
              const base = await api.newJournalMeta(e, {
                epoch: meta.epoch,
                cursor: meta.baseCursor,
              });
              Object.assign(record, await api.encodeJournal(base, payload));
              meta.lastHash = record.hash;
              meta.bytes = record.byteLength;
            }
            await raw(
              ["slots", "revisions", "journalMeta", "commandJournal"],
              "readwrite",
              (tx) => {
                tx.objectStore("commandJournal").clear();
                tx.objectStore("revisions").put(e);
                tx.objectStore("slots").put({
                  slotId: "auto",
                  revisionId: e.revisionId,
                  tick: e.tick,
                  byteLength: e.byteLength,
                  updatedAt: e.createdAt,
                });
                tx.objectStore("journalMeta").delete("auto");
                if (fault !== "missing-meta") tx.objectStore("journalMeta").put(meta);
                tx.objectStore("commandJournal").put(record);
              },
            );
            const snapshot = async () =>
              raw(
                [
                  "slots",
                  "revisions",
                  "journalMeta",
                  "commandJournal",
                  "migrationJournal",
                  "quarantine",
                ],
                "readonly",
                async (tx) =>
                  Promise.all(
                    [
                      "slots",
                      "revisions",
                      "journalMeta",
                      "commandJournal",
                      "migrationJournal",
                      "quarantine",
                    ].map((s) => request(tx.objectStore(s).getAll())),
                  ),
              );
            const before = JSON.stringify(await snapshot()),
              reader = new api.SaveRepository();
            try {
              await rejected(() => reader.load("auto"), "JOURNAL_CORRUPT");
            } finally {
              await reader.close();
            }
            ensure(
              JSON.stringify(await snapshot()) === before,
              `Failed history changed records: ${fault}`,
            );
          }
          // Restore the valid history for subsequent reopen/crash tests.
          await raw(["journalMeta", "commandJournal"], "readwrite", (tx) => {
            tx.objectStore("commandJournal").clear();
            tx.objectStore("commandJournal").put(frozen.record);
            tx.objectStore("journalMeta").put(frozen.meta);
          });
        },
      );
      await check("close/reopen keeps the authoritative state frozen", async () => {
        const expected = canonical(await repository.load("auto"));
        await repository.close();
        const reopened = new api.SaveRepository();
        ensure(
          canonical(await reopened.load("auto")) === expected,
          "Reopen advanced or changed world",
        );
        await reopened.close();
      });
      timings.sort((a, b) => a - b);
      return {
        checks,
        userAgent: navigator.userAgent,
        viewport: { width: innerWidth, height: innerHeight },
        saveLoad: {
          samples: timings.length,
          p50_ms: timings[Math.floor(timings.length * 0.5)],
          p95_ms: timings[Math.ceil(timings.length * 0.95) - 1],
          max_ms: timings[timings.length - 1],
        },
      };
    },
    { fixture, fixtureV2, fixtureV3, fixtureV5, fixtureV6 },
  );
  const interruptedStart = performance.now();
  const baseline = await page.evaluate(async () => {
    const path = "/bundle.js",
      api = (await import(path)) as Api,
      repo = new api.SaveRepository();
    const state = api.canonicalState(await repo.load("auto"));
    await repo.close();
    return state;
  });
  const interrupted = await context.newPage();
  await interrupted.goto(base + "/");
  await interrupted.evaluate(async () => {
    const path = "/bundle.js",
      api = (await import(path)) as Api,
      repo = new api.SaveRepository(),
      state = await repo.load("auto");
    state.player.name = "Kesilen Kayıt";
    state.player.profile.name = "Kesilen Kayıt";
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      const pending = original.apply(this, args);
      if (this.name === "slots") {
        (globalThis as unknown as Record<string, unknown>).__pendingWrite = true;
        const get = this.get.bind(this);
        const hold = () => {
          const next = get("auto");
          next.onsuccess = hold;
        };
        hold();
      }
      return pending;
    };
    void repo.save("auto", state).catch(() => undefined);
  });
  await interrupted.waitForFunction(
    () => (globalThis as unknown as Record<string, unknown>).__pendingWrite === true,
  );
  await interrupted.close();
  const afterClose = await page.evaluate(async () => {
    const path = "/bundle.js",
      api = (await import(path)) as Api,
      repo = new api.SaveRepository();
    const state = api.canonicalState(await repo.load("auto"));
    await repo.close();
    return state;
  });
  result.checks.push({
    name: "closing a tab during an active write preserves the last committed state",
    status: baseline === afterClose ? "PASS" : "FAIL",
    duration_ms: performance.now() - interruptedStart,
  });
  const journalCloseStart = performance.now();
  const durable = await page.evaluate(async () => {
    const path = "/bundle.js",
      api = (await import(path)) as Api,
      repo = new api.SaveRepository(),
      state = await repo.load("auto");
    let head = await repo.beginJournal(
      "auto",
      state,
      { epoch: "real-tab-journal", cursor: 0 },
      await repo.inspectJournal(),
    );
    const operations: import("../persistence/journal.ts").JournalOperation[] = [];
    for (let i = 0; i < 3; i++) {
      api.stepWorld(state, []);
      operations.push({ cursor: i + 1, type: "TICK", endingTick: state.tick, commands: [] });
    }
    head = await repo.appendJournal(head, {
      epoch: head.epoch,
      fromCursor: 0,
      toCursor: 3,
      operations,
    });
    await repo.close();
    return api.canonicalState(state);
  });
  const interruptedJournal = await context.newPage();
  await interruptedJournal.goto(base + "/");
  await interruptedJournal.evaluate(async () => {
    const path = "/bundle.js",
      api = (await import(path)) as Api,
      repo = new api.SaveRepository(),
      state = await repo.load("auto"),
      head = await repo.inspectJournal();
    if (!head) throw new Error("Missing baseline");
    api.stepWorld(state, []);
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      const pending = original.apply(this, args);
      if (this.name === "commandJournal") {
        (globalThis as unknown as Record<string, unknown>).__pendingJournal = true;
        const get = this.get.bind(this),
          hold = () => {
            const next = get("keep-alive");
            next.onsuccess = hold;
          };
        hold();
      }
      return pending;
    };
    void repo
      .appendJournal(head, {
        epoch: head.epoch,
        fromCursor: head.cursor,
        toCursor: head.cursor + 1,
        operations: [
          { cursor: head.cursor + 1, type: "TICK", endingTick: state.tick, commands: [] },
        ],
      })
      .catch(() => undefined);
  });
  await interruptedJournal.waitForFunction(
    () => (globalThis as unknown as Record<string, unknown>).__pendingJournal === true,
  );
  await interruptedJournal.close();
  const afterJournalClose = await page.evaluate(async () => {
    const path = "/bundle.js",
      api = (await import(path)) as Api,
      repo = new api.SaveRepository();
    const state = api.canonicalState(await repo.load("auto"));
    await repo.close();
    return state;
  });
  result.checks.push({
    name: "closing a tab during journal append retains exactly the last acknowledged durable prefix",
    status: durable === afterJournalClose ? "PASS" : "FAIL",
    duration_ms: performance.now() - journalCloseStart,
  });
  await page.screenshot({ path: resolve(output, "indexeddb-tests.png") });
  const report = {
    ...result,
    build_sha: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    source_status: "working tree candidate",
    bundle_sha256: createHash("sha256").update(js).digest("hex"),
    browser: browser.version(),
    browserKind,
    consoleErrors: errors,
    status:
      result.checks.every((row) => row.status === "PASS") && errors.length === 0 ? "PASS" : "FAIL",
    timestamp: new Date().toISOString(),
  };
  await writeFile(resolve(output, "results.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== "PASS") process.exitCode = 1;
} catch (error) {
  await writeFile(
    resolve(output, "failure.json"),
    JSON.stringify({ status: "FAIL", message: String(error), consoleErrors: errors }, null, 2),
  );
  throw error;
} finally {
  await context.tracing.stop({ path: resolve(output, "trace.zip") });
  await browser.close();
  await new Promise<void>((resolveServer) => server.close(() => resolveServer()));
}
