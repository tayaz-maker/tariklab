/** Empty bootstrap remains available; an existing canonical claim never adopts a foreign life. */
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { createStaticGameServer } from "./static-game-server.mjs";

const args = process.argv.slice(2);
const arg = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const output = resolve(
  arg(
    "--out",
    join(
      process.env.RUNNER_TEMP || tmpdir(),
      "screenshots/boardworld-legacy-bootstrap/result.json",
    ),
  ),
);
mkdirSync(dirname(output), { recursive: true });
const prior = "b0c25495a7c162eb4a653e32c0d999144aefb300";
const git = (...args) => execFileSync("git", args, { maxBuffer: 32 * 1024 * 1024 });
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const temp = mkdtempSync(join(tmpdir(), "boardworld-legacy-bootstrap-"));
const archive = git("archive", prior, "public/games/tc-sim-boardworld");
writeFileSync(join(temp, "prior.tar"), archive);
execFileSync("tar", ["-xf", join(temp, "prior.tar"), "-C", temp]);
const bytes = readFileSync("scripts/fixtures/boardworld/v2-progressed-restart-day46.json", "utf8");
const server = createStaticGameServer(arg("--serve", "public"));
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;
const report = {
  status: "RUNNING",
  commit: git("rev-parse", "HEAD").toString().trim(),
  trackedDiffSha256: hash(git("diff", "HEAD")),
  runnerSha256: hash(readFileSync(new URL(import.meta.url))),
  prior,
  archiveSha256: hash(archive),
  fixtureSha256: hash(bytes),
  serving: arg("--serve", "public"),
  results: [],
};
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
  });
  report.browser = browser.version();
  for (const mode of [
    "preseed-v2",
    "empty-ui-then-v2",
    "prior-empty-head-then-v2",
    "claimed-head-then-v2",
    "damaged-claimed-head-then-v2",
  ]) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await context.route("**/bootstrap-harness.html", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<!doctype html><title>Bootstrap regression</title>",
      }),
    );
    await context.route("**/prior-empty/*.mjs", (route) =>
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
    await page.bringToFront();
    await page.goto(`${origin}/bootstrap-harness.html`);
    if (mode === "empty-ui-then-v2") {
      await page.goto(`${origin}/games/tc-sim-boardworld/index.html`, { waitUntil: "networkidle" });
      assert.equal(
        await page.evaluate(() => window.boardworldInspect()),
        null,
        "first launch is actually empty",
      );
    }
    const setup = await page.evaluate(
      async ({ mode, bytes }) => {
        window.p = await import("/games/tc-sim-boardworld/persistence.mjs");
        window.e = await import("/games/tc-sim-boardworld/engine.mjs");
        const expectedLegacy = window.p.importGame(bytes).state;
        if (!expectedLegacy) throw Error("authentic v2 fixture rejected");
        let empty,
          winner = null;
        if (mode === "prior-empty-head-then-v2") {
          const prior = await import("/prior-empty/persistence.mjs");
          empty = await prior.loadGameLocked();
          if (empty.state || empty.token.generation !== 1)
            throw Error("prior protocol did not produce its real empty head");
        } else if (mode !== "preseed-v2") empty = await window.p.loadGameLocked();
        if (mode.includes("claimed-head")) {
          winner = window.e.createGame({ seed: 839, name: "Canonical winner" });
          const saved = await window.p.saveGameLocked(winner, undefined, empty.token);
          if (!saved.ok) throw Error("canonical claim failed");
          if (mode === "damaged-claimed-head-then-v2") {
            await new Promise((resolve, reject) => {
              const request = window.indexedDB.open(`${window.p.SAVE_KEY}.transactions`, 1);
              request.onsuccess = () => {
                const db = request.result,
                  tx = db.transaction("state", "readwrite"),
                  store = tx.objectStore("state"),
                  get = store.get("head");
                get.onsuccess = () => {
                  const head = get.result,
                    slots = new Map(head.slots);
                  slots.set(window.p.SAVE_KEY, null);
                  slots.set(window.p.BACKUP_KEY, null);
                  head.slots = [...slots];
                  store.put(head, "head");
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
          }
        }
        window.localStorage.setItem("tariklab.boardworld.v1", bytes);
        return {
          expected: mode === "damaged-claimed-head-then-v2" ? null : winner || expectedLegacy,
          emptyToken: empty?.token,
          winner,
        };
      },
      { mode, bytes },
    );
    await page.goto(`${origin}/games/tc-sim-boardworld/index.html`, { waitUntil: "networkidle" });
    const loaded = await page.evaluate(async () => {
      const p = await import("/games/tc-sim-boardworld/persistence.mjs");
      return {
        ui: window.boardworldInspect(),
        loaded: await p.loadGameLocked(),
        legacy: window.localStorage.getItem("tariklab.boardworld.v1"),
        original: window.localStorage.getItem(p.ORIGINAL_V2_BACKUP_KEY),
      };
    });
    assert.deepEqual(
      loaded.ui,
      setup.expected,
      `${mode}: real UI must show the exact selected life`,
    );
    assert.deepEqual(loaded.loaded.state, setup.expected);
    assert.equal(loaded.legacy, bytes, "mutable legacy source bytes remain exact");
    if (setup.winner)
      assert.equal(
        loaded.loaded.recoverySaves.some(
          (copy) => copy.key === "tariklab.boardworld.v1" && copy.bytes === bytes,
        ),
        true,
        "foreign legacy bytes remain explicitly recoverable, even for a damaged canonical claim",
      );
    else assert.equal(loaded.original, bytes, "v2 original is archived before promotion");
    if (setup.emptyToken && !setup.winner) {
      const stale = await page.evaluate(async (token) => {
        const p = await import("/games/tc-sim-boardworld/persistence.mjs"),
          e = await import("/games/tc-sim-boardworld/engine.mjs");
        return p.saveGameLocked(e.createGame({ seed: 913 }), undefined, token);
      }, setup.emptyToken);
      assert.equal(stale.ok, false);
      assert.equal(
        stale.conflict,
        true,
        "empty-page token cannot overwrite the newly migrated life",
      );
    }
    await page.reload({ waitUntil: "networkidle" });
    assert.deepEqual(await page.evaluate(() => window.boardworldInspect()), setup.expected);
    assert.deepEqual(errors, []);
    report.results.push({
      case: mode,
      pass: true,
      uiExact: true,
      reloadExact: true,
      legacyBytesExact: true,
      foreignQuarantined: Boolean(setup.winner),
      staleEmptyRejected: Boolean(setup.emptyToken && !setup.winner),
    });
    writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    await context.close();
  }
  {
    const context = await browser.newContext();
    await context.route("**/bootstrap-harness.html", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<!doctype html><title>Aborted bootstrap</title>",
      }),
    );
    await context.route("**/prior-empty/*.mjs", (route) =>
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
    const page = await context.newPage();
    await page.goto(`${origin}/bootstrap-harness.html`);
    const result = await page.evaluate(async (bytes) => {
      const prior = await import("/prior-empty/persistence.mjs");
      await prior.loadGameLocked();
      const p = await import("/games/tc-sim-boardworld/persistence.mjs");
      window.localStorage.setItem("tariklab.boardworld.v1", bytes);
      const before = p.readSaveToken(),
        put = window.IDBObjectStore.prototype.put;
      window.IDBObjectStore.prototype.put = function (...args) {
        const request = put.apply(this, args);
        if (this.name === "state")
          request.addEventListener("success", () => this.transaction.abort(), { once: true });
        return request;
      };
      let loaded;
      try {
        loaded = await p.loadGameLocked();
      } finally {
        window.IDBObjectStore.prototype.put = put;
      }
      const save = await p.saveGameLocked(loaded.state, undefined, loaded.token);
      return {
        loaded,
        save,
        expected: p.importGame(bytes).state,
        before,
        after: p.readSaveToken(),
        legacy: window.localStorage.getItem("tariklab.boardworld.v1"),
        original: window.localStorage.getItem(p.ORIGINAL_V2_BACKUP_KEY),
      };
    }, bytes);
    assert.deepEqual(
      result.loaded.state,
      result.expected,
      "failed promotion still exposes the exact exportable legacy life",
    );
    assert.equal(result.loaded.protected, false);
    assert.equal(
      result.loaded.token?.generation,
      undefined,
      "failed bootstrap never grants a committed token",
    );
    assert.equal(result.save.ok, false, "export-only fallback cannot claim a successful write");
    assert.deepEqual(result.after, result.before);
    assert.equal(result.legacy, bytes);
    assert.equal(result.original, null, "aborted migration does not mirror an uncommitted archive");
    report.results.push({
      case: "prior-empty-promotion-abort",
      pass: true,
      exportableExact: true,
      noFalseSuccess: true,
      mirrorUnchanged: true,
    });
    await context.close();
  }
  // Two independently created lives from the same empty origin, really queued together.
  const context = await browser.newContext();
  await context.route("**/bootstrap-harness.html", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>First creation race</title>",
    }),
  );
  const pages = [await context.newPage(), await context.newPage(), await context.newPage()];
  for (const page of pages) {
    await page.bringToFront();
    await page.goto(`${origin}/bootstrap-harness.html`);
    await page.evaluate(async () => {
      window.p = await import("/games/tc-sim-boardworld/persistence.mjs");
      window.e = await import("/games/tc-sim-boardworld/engine.mjs");
    });
  }
  const [a, b, holder] = pages;
  const snapshots = await Promise.all(
    [a, b].map((page, index) =>
      page.evaluate(async (index) => {
        window.snapshot = await window.p.loadGameLocked();
        window.life = window.e.createGame({ seed: 1000 + index, name: `Writer ${index}` });
        return { state: window.snapshot.state, token: window.snapshot.token };
      }, index),
    ),
  );
  assert.equal(snapshots[0].state, null);
  assert.equal(snapshots[1].state, null);
  assert.deepEqual(snapshots[0].token, snapshots[1].token);
  await holder.evaluate(() => {
    void window.navigator.locks.request(window.p.SAVE_LOCK, async () => {
      window.held = true;
      await new Promise((r) => (window.release = r));
    });
  });
  await holder.waitForFunction(() => window.held);
  await Promise.all(
    [a, b].map((page) =>
      page.evaluate(() => {
        void window.p
          .saveGameLocked(window.life, undefined, window.snapshot.token)
          .then((result) => {
            window.result = result;
            window.done = true;
          });
      }),
    ),
  );
  await holder.waitForFunction(
    async () =>
      (await window.navigator.locks.query()).pending.filter((l) => l.name === window.p.SAVE_LOCK)
        .length === 2,
  );
  assert.deepEqual(await holder.evaluate(() => window.p.readSaveToken()), {
    primary: null,
    backup: null,
  });
  await holder.evaluate(() => window.release());
  await Promise.all([a, b].map((page) => page.waitForFunction(() => window.done)));
  const writers = await Promise.all(
    [a, b].map((page) =>
      page.evaluate(() => ({
        ok: window.result.ok,
        conflict: window.result.conflict === true,
        life: window.life,
      })),
    ),
  );
  assert.equal(writers.filter((w) => w.ok).length, 1);
  assert.equal(writers.filter((w) => !w.ok && w.conflict).length, 1);
  const persisted = await holder.evaluate(async () => (await window.p.loadGameLocked()).state);
  assert.deepEqual(persisted, writers.find((w) => w.ok).life);
  report.results.push({
    case: "independent-empty-origin-writers",
    pass: true,
    queuedWriters: 2,
    success: 1,
    conflict: 1,
    winnerExact: true,
  });
  await context.close();
  report.status = "PASS";
} catch (error) {
  report.status = "FAIL";
  report.error = String(error.stack);
  process.exitCode = 1;
} finally {
  writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(
    JSON.stringify({
      status: report.status,
      cases: report.results.length,
      error: report.error?.slice(0, 1400),
      output,
    }),
  );
  await browser?.close();
  await new Promise((r) => server.close(r));
  rmSync(temp, { recursive: true, force: true });
}
