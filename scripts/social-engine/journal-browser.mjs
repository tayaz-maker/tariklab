/** Independent actual UI/IndexedDB journal integration. Reads DB for evidence; never writes DB directly. */
import { chromium } from "playwright";
import { windowlessRendererOptions } from "./windowless-launch.mjs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const base = process.env.SE_BASE || "http://127.0.0.1:8097",
  out = "artifacts/social-engine/journal-browser";
await mkdir(out, { recursive: true });
const hash = (b) => createHash("sha256").update(b).digest("hex"),
  manifestBytes = await readFile("public/games/social-engine/build-manifest.json"),
  manifest = JSON.parse(manifestBytes);
const report = {
  startedAt: new Date().toISOString(),
  manifestSha256: hash(manifestBytes),
  sourceDigest: manifest.sourceDigest,
  results: [],
  errors: [],
  loadedAssets: [],
  limits: [
    "QA STEP is used only in the explicit100000tick burst, not as real-time performance evidence.",
    "IndexedDB is inspected read-only. All writes go through actual game UI/worker/repository.",
    "No manual save or checkpoint request is made in the crash-tail test.",
  ],
};
await writeFile(out + "/build-manifest.json", manifestBytes);
const browser = await chromium.launch({
  ...windowlessRendererOptions(),
  headless: true,
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
    (process.platform === "darwin"
      ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
      : chromium.executablePath()),
});
const responses = [];
const state = (p) => p.evaluate(() => window.__socialEngine.state());
const command = (p, type, args = {}) =>
  p.evaluate(({ type, args }) => window.__socialEngine.command(type, args), { type, args });
const status = (p) => p.evaluate(() => window.__socialEngine.journalStatus());
async function instrument(context) {
  const p = await context.newPage();
  p.setDefaultTimeout(15000);
  p.on("pageerror", (e) => report.errors.push(e.message));
  p.on("response", (r) => {
    if (r.url().includes("/games/social-engine/"))
      responses.push(
        (async () => {
          try {
            const b = await r.body();
            report.loadedAssets.push({ url: r.url(), sha256: hash(b), bytes: b.length });
          } catch {
            /* missing body is not evidence */
          }
        })(),
      );
  });
  return p;
}
async function fresh(p, name = "Journal Kanıt") {
  await p.goto(base + "/games/social-engine/index.html?qa=1");
  await p.locator("[name=name]").fill(name);
  await p.getByRole("button", { name: "Hikâyene başla" }).click();
  const deadline = Date.now() + 15000;
  let initialized;
  do {
    initialized = await p.evaluate(() => ({
      journal: window.__socialEngine?.journalStatus?.(),
      toast: document.querySelector("#toast")?.textContent,
      failure: document.querySelector("#form-error")?.textContent,
      visible: document.visibilityState,
    }));
    if (initialized.journal?.handle || initialized.journal?.failed) break;
    await new Promise((resolve) => setTimeout(resolve, 50));
  } while (Date.now() < deadline);
  assert.ok(
    initialized.journal?.handle && !initialized.journal.failed,
    "Fresh journal not armed: " + JSON.stringify(initialized),
  );
  await p.evaluate(() => window.__socialEngine.pause(true));
  await p.waitForTimeout(200);
}
async function db(p) {
  return p.evaluate(async () => {
    const opening = indexedDB.open("tariklab-social-engine", 2);
    const d = await new Promise((resolve, reject) => {
      opening.onsuccess = () => resolve(opening.result);
      opening.onerror = () => reject(opening.error);
    });
    const tx = d.transaction(["journalMeta", "commandJournal", "slots"], "readonly");
    const read = (req) =>
      new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    const [meta, batches, slots] = await Promise.all([
      read(tx.objectStore("journalMeta").get("auto")),
      read(tx.objectStore("commandJournal").getAll()),
      read(tx.objectStore("slots").getAll()),
    ]);
    d.close();
    return {
      meta,
      batches: batches.map((b) => ({
        id: b.id,
        fromCursor: b.fromCursor,
        toCursor: b.toCursor,
        byteLength: b.byteLength,
        payload: b.payload,
      })),
      slots,
    };
  });
}
async function settled(p) {
  // Both test tabs must remain in their natural state. Background rAF is not a
  // clock for an IndexedDB commit; sample the actual journal state over the protocol.
  const deadline = Date.now() + 15000;
  let seen;
  do {
    seen = await status(p);
    if (seen?.failed || (seen?.handle && seen.pendingOperations === 0)) break;
    await new Promise((resolve) => setTimeout(resolve, 50));
  } while (Date.now() < deadline);
  assert.ok(
    seen?.failed || (seen?.handle && seen.pendingOperations === 0),
    "Journal did not settle in 15s: " + JSON.stringify(seen),
  );
  const s = await status(p);
  assert.equal(s.failed, null);
  await p.waitForTimeout(120);
  return s;
}
async function check(id, name, fn) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const p = await instrument(context);
  const start = performance.now();
  try {
    const evidence = await fn(p, context);
    report.results.push({
      id,
      name,
      status: "PASS",
      duration_ms: performance.now() - start,
      evidence,
    });
    await p.screenshot({ path: `${out}/${id}.png` }).catch(() => {});
  } catch (e) {
    report.results.push({
      id,
      name,
      status: "FAIL",
      duration_ms: performance.now() - start,
      reason: e.stack,
    });
    await p.screenshot({ path: `${out}/${id}-failure.png` }).catch(() => {});
  } finally {
    await context.tracing.stop({ path: `${out}/${id}-trace.zip` });
    await context.close();
    await writeFile(out + "/results.json", JSON.stringify(report, null, 2));
  }
}
try {
  await check(
    "tail-reload",
    "Without manual save, committed command tail survives page close and actual auto-load",
    async (p, context) => {
      await fresh(p);
      await settled(p);
      const before = await state(p);
      assert.equal((await command(p, "USE_ITEM", { item: "simit" })).ok, true);
      await settled(p);
      const expected = await state(p),
        persisted = await db(p);
      assert.equal(expected.player.inventory.simit, before.player.inventory.simit - 1);
      assert.ok(persisted.meta.cursor > persisted.meta.baseCursor, "actual journal tail exists");
      assert.ok(
        persisted.batches.some((b) =>
          JSON.parse(b.payload).operations.some((o) =>
            o.commands?.some((c) => c.type === "USE_ITEM"),
          ),
        ),
        "committed tail contains item command",
      );
      await p.close();
      const reopened = await instrument(context);
      await reopened.goto(base + "/games/social-engine/index.html?qa=1");
      await reopened.locator("#continue").click();
      await reopened.locator('[data-load="auto"]').click();
      await reopened.waitForFunction(
        () => window.__socialEngine?.projection()?.population === 1100,
      );
      await reopened.evaluate(() => window.__socialEngine.pause(true));
      const loaded = await state(reopened);
      assert.equal(loaded.player.inventory.simit, expected.player.inventory.simit);
      assert.deepEqual(loaded.accounts, expected.accounts);
      assert.deepEqual(loaded.progression.items.simit, expected.progression.items.simit);
      await reopened.screenshot({ path: out + "/tail-reloaded.png" });
      return {
        before: before.player.inventory.simit,
        after: loaded.player.inventory.simit,
        baseCursor: persisted.meta.baseCursor,
        cursor: persisted.meta.cursor,
        tailBatches: persisted.batches.length,
      };
    },
  );
  await check(
    "burst-compaction",
    "A100000tick worker burst bounds the UI journal mailbox and checkpoints the exact authority state",
    async (p) => {
      await fresh(p);
      await settled(p);
      const before = await state(p);
      await p.evaluate(() => window.__socialEngine.step(100000));
      await p.waitForFunction(
        (t) => window.__socialEngine.projection()?.tick >= t,
        before.tick + 100000,
        { timeout: 120000 },
      );
      await settled(p);
      const after = await state(p);
      const snapshot = await p.evaluate(() => window.__socialEngine.flushJournal());
      const final = await status(p),
        persisted = await db(p);
      assert.equal(after.tick, before.tick + 100000);
      assert.ok(final.highWater <= 600);
      assert.ok(final.pendingOperations <= 600);
      assert.equal(final.failed, null);
      assert.equal(snapshot.tick, after.tick);
      assert.equal(persisted.meta.currentTick, after.tick);
      assert.equal(persisted.meta.baseTick, after.tick);
      assert.equal(persisted.meta.cursor, final.handle.cursor);
      assert.ok(persisted.meta.baseCursor >= 100000);
      return {
        beforeTick: before.tick,
        afterTick: after.tick,
        highWater: final.highWater,
        handle: final.handle,
        meta: persisted.meta,
      };
    },
  );
  await check(
    "tab-conflict",
    "A competing tab stops the stale auto-writer while personal-slot saving remains available",
    async (p, context) => {
      await fresh(p, "Birinci Oturum");
      await settled(p);
      const first = await status(p);
      const other = await instrument(context);
      await fresh(other, "İkinci Oturum");
      await settled(other);
      const second = await status(other);
      assert.notEqual(first.handle.epoch, second.handle.epoch);
      assert.equal((await command(p, "USE_ITEM", { item: "simit" })).ok, true);
      await p.waitForFunction(
        () => Boolean(window.__socialEngine.journalStatus()?.failed),
        undefined,
        { polling: 50, timeout: 15000 },
      );
      const failed = await status(p);
      assert.ok(failed.failed);
      assert.equal(await p.evaluate(() => window.__socialEngine.save("slot-1")), true);
      const persisted = await db(p);
      assert.equal(persisted.meta.epoch, second.handle.epoch);
      assert.ok(persisted.slots.some((s) => s.slotId === "slot-1"));
      return { staleWriter: failed, activeEpoch: persisted.meta.epoch, manualSlotWritten: true };
    },
  );
  await check(
    "fatal-tail-recovery",
    "Real WebGL context loss recovers the newer verified tail from the same epoch",
    async (p) => {
      await fresh(p);
      await settled(p);
      const baseStatus = await status(p);
      assert.equal((await command(p, "USE_ITEM", { item: "simit" })).ok, true);
      await settled(p);
      const expected = await state(p),
        persisted = await db(p);
      assert.ok(persisted.meta.cursor > baseStatus.handle.baseCursor);
      const supported = await p.evaluate(() => {
        const c = document.querySelector("#world canvas"),
          gl = c.getContext("webgl2") || c.getContext("webgl");
        const lose = gl?.getExtension("WEBGL_lose_context");
        if (!lose) return false;
        lose.loseContext();
        return true;
      });
      assert.equal(supported, true, "actual context-loss extension available");
      await p.getByRole("alertdialog").waitFor();
      await p.locator("#restart-worker").click();
      await p.waitForFunction(
        () =>
          window.__socialEngine?.projection()?.population === 1100 &&
          !document.querySelector('[role="alertdialog"]'),
      );
      await p.evaluate(() => window.__socialEngine.pause(true));
      const recovered = await state(p);
      assert.equal(recovered.player.inventory.simit, expected.player.inventory.simit);
      assert.deepEqual(recovered.progression.items.simit, expected.progression.items.simit);
      assert.deepEqual(recovered.accounts, expected.accounts);
      return {
        baseCursor: baseStatus.handle.baseCursor,
        tailCursor: persisted.meta.cursor,
        recoveredSimit: recovered.player.inventory.simit,
        realContextLoss: true,
      };
    },
  );
} finally {
  await Promise.allSettled(responses);
  report.finishedAt = new Date().toISOString();
  report.summary = {
    pass: report.results.filter((r) => r.status === "PASS").length,
    fail: report.results.filter((r) => r.status === "FAIL").length,
  };
  await writeFile(out + "/results.json", JSON.stringify(report, null, 2));
  await browser.close();
  console.log(
    JSON.stringify({
      out,
      summary: report.summary,
      failures: report.results.filter((r) => r.status === "FAIL"),
    }),
  );
}
if (report.results.some((r) => r.status === "FAIL")) process.exitCode = 1;
