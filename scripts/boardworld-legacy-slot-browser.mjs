/** Every compatibility slot is independently preserved before mirror repair. */
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
    join(process.env.RUNNER_TEMP || tmpdir(), "screenshots/boardworld-legacy-slot/result.json"),
  ),
);
mkdirSync(dirname(output), { recursive: true });
const released = "d695119186cad42c079a911a60c372f201b3b64b";
const git = (...args) => execFileSync("git", args, { maxBuffer: 32 * 1024 * 1024 });
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const temp = mkdtempSync(join(tmpdir(), "boardworld-legacy-slot-"));
const archive = git("archive", released, "public/games/tc-sim-boardworld");
writeFileSync(join(temp, "release.tar"), archive);
execFileSync("tar", ["-xf", join(temp, "release.tar"), "-C", temp]);
const server = createStaticGameServer(arg("--serve", "public"));
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;
const report = {
  status: "RUNNING",
  commit: git("rev-parse", "HEAD").toString().trim(),
  tree: git("rev-parse", "HEAD^{tree}").toString().trim(),
  trackedDiffSha256: hash(git("diff", "HEAD")),
  runnerSha256: hash(readFileSync(new URL(import.meta.url))),
  released,
  archiveSha256: hash(archive),
  serving: arg("--serve", "public"),
  results: [],
};
const originalA = readFileSync("scripts/fixtures/boardworld/v5-fresh-newcomer.json", "utf8");
const originalB = readFileSync("scripts/fixtures/boardworld/v5-fresh-graduate.json", "utf8");
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
  });
  report.browser = browser.version();
  for (const mode of [
    "known-primary",
    "same-primary",
    "corrupt-primary",
    "original-only",
    "en",
    "pl",
  ]) {
    const context = await browser.newContext();
    const errors = [];
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
    await context.route("**/slot-harness.html", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<!doctype html><title>Legacy slot regression</title>",
      }),
    );
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${origin}/slot-harness.html`);
    const result = await page.evaluate(
      async ({ mode, originalA, originalB }) => {
        const p = await import("/games/tc-sim-boardworld/persistence.mjs");
        const e = await import("/games/tc-sim-boardworld/engine.mjs");
        const old = await import("/released6/persistence.mjs");
        const oe = await import("/released6/engine.mjs");
        const initial = oe.createGame({ seed: 2026 }),
          initialBytes = old.exportGame(initial);
        localStorage.setItem(old.SAVE_KEY, initialBytes);
        localStorage.setItem(p.ORIGINAL_V5_BACKUP_KEY, originalA);
        const loaded = await p.loadGameLocked();
        const winner = e.resolveAction(loaded.state, "event:welcome:work").state;
        const gold = await p.saveGameLocked(winner, undefined, loaded.token);
        const fork = oe.resolveAction(initial, "event:welcome:learn").state;
        const forkBytes = old.exportGame(fork);
        const first = old.saveGame(fork);
        const second = old.saveGame(
          mode === "same-primary" || mode === "original-only" ? winner : initial,
        );
        const backupBefore = localStorage.getItem(old.BACKUP_KEY);
        if (mode === "corrupt-primary") localStorage.setItem(old.SAVE_KEY, "{broken");
        if (mode === "original-only") {
          localStorage.setItem(old.BACKUP_KEY, gold.token.backup);
          localStorage.setItem(p.ORIGINAL_V5_BACKUP_KEY, originalB);
        }
        const before = p.readSaveToken();
        const current =
          mode === "en" || mode === "pl"
            ? await p.saveGameLocked(winner, undefined, gold.token)
            : await p.loadGameLocked();
        const returned = await p.loadGameLocked();
        const foreignBytes = mode === "original-only" ? originalB : forkBytes;
        const preserved = returned.recoverySaves.find((copy) => copy.bytes === foreignBytes);
        const again = await p.loadGameLocked();
        let notice;
        if (mode === "en" || mode === "pl") {
          const i18n = await import("/games/tc-sim-boardworld/i18n.mjs");
          await i18n.chooseLanguage(mode);
          notice = i18n.translateText(current.message);
        }
        return {
          goldSaved: gold.ok,
          firstOldSave: first.ok,
          secondOldSave: second.ok,
          forkInBackupBefore: backupBefore === forkBytes,
          primaryBefore: before.primary,
          initialBytes,
          winnerBytes: old.exportGame(winner),
          winner,
          returned: returned.state,
          generationBefore: gold.token.generation,
          generationAfter: returned.token.generation,
          foreignBytes,
          preservedBytes: preserved?.bytes,
          preservedState: preserved && p.importGame(preserved.bytes).state,
          expectedForeignState: p.importGame(foreignBytes).state,
          archiveAfter: localStorage.getItem(p.ORIGINAL_V5_BACKUP_KEY),
          archiveExpected: originalA,
          count: returned.recoverySaves.length,
          againCount: again.recoverySaves.length,
          notice,
          saved: current.ok,
          mirror: old.loadGame().state,
        };
      },
      { mode, originalA, originalB },
    );
    const evidence = {
      case: mode,
      goldSaved: result.goldSaved,
      firstOldSave: result.firstOldSave,
      secondOldSave: result.secondOldSave,
      forkInBackupBefore: result.forkInBackupBefore,
      winnerPreserved: JSON.stringify(result.returned) === JSON.stringify(result.winner),
      foreignCopyPreserved: result.preservedBytes === result.foreignBytes,
      originalUnchanged: result.archiveAfter === result.archiveExpected,
      notice: result.notice,
    };
    report.results.push(evidence);
    writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    assert.equal(result.goldSaved, true);
    assert.equal(result.firstOldSave, true);
    assert.equal(result.secondOldSave, true);
    assert.equal(
      result.forkInBackupBefore,
      true,
      "the two real old writes must move B into the backup",
    );
    if (mode === "known-primary") assert.equal(result.primaryBefore, result.initialBytes);
    if (mode === "same-primary" || mode === "original-only")
      assert.equal(result.primaryBefore, result.winnerBytes);
    assert.deepEqual(result.returned, result.winner);
    assert.equal(
      result.preservedBytes,
      result.foreignBytes,
      "every valid divergent slot must survive mirror repair independently of the primary",
    );
    assert.deepEqual(result.preservedState, result.expectedForeignState);
    assert.equal(
      result.archiveAfter,
      result.archiveExpected,
      "authoritative immutable original stays exact",
    );
    assert.equal(result.againCount, result.count, "reloading deduplicates without dropping copies");
    assert.deepEqual(result.mirror, result.winner);
    assert.equal(
      result.generationAfter,
      result.generationBefore + Number(mode === "en" || mode === "pl"),
    );
    if (mode === "en")
      assert.equal(
        result.notice,
        "Saved in this browser. A different save copy was preserved. Download it from the Save menu and import it explicitly; your current save was kept.",
      );
    if (mode === "pl")
      assert.equal(
        result.notice,
        "Zapisano w tej przeglądarce. Zachowano inną kopię zapisu. Pobierz ją z menu zapisu i jawnie zaimportuj; bieżący zapis pozostał bez zmian.",
      );
    if (mode === "en" || mode === "pl") assert.equal(result.saved, true);
    if (mode === "en" || mode === "pl") {
      const ui = await context.newPage();
      ui.on("pageerror", (error) => errors.push(error.message));
      await ui.addInitScript(() =>
        window.addEventListener("storage", (event) => event.stopImmediatePropagation(), true),
      );
      await ui.goto(`${origin}/games/tc-sim-boardworld/index.html`);
      await ui.waitForFunction(() => window.boardworldInspect?.());
      assert.deepEqual(await ui.evaluate(() => window.boardworldInspect()), result.winner);
      const nextForkBytes = await page.evaluate(async () => {
        const old = await import("/released6/persistence.mjs");
        const e = await import("/released6/engine.mjs");
        const initial = e.createGame({ seed: 2026 });
        const fork = e.resolveAction(initial, "event:welcome:learn").state;
        const next = e
          .getActions(fork)
          .map((a) => e.resolveAction(fork, a.id))
          .find((r) => r.ok).state;
        if (!old.saveGame(next).ok || !old.saveGame(initial).ok) throw Error("old writes failed");
        return old.exportGame(next);
      });
      await ui.waitForFunction(
        (bytes) => localStorage.getItem("tariklab.boardworld.v6.backup") === bytes,
        nextForkBytes,
      );
      await ui.locator("[data-ui=menu]").click();
      await ui.locator("#menu-dialog [data-ui=save]").click();
      await ui.waitForFunction(
        (expected) => document.querySelector("#notice").textContent === expected,
        result.notice,
      );
      const messages = await ui.evaluate(() => ({
        notice: document.querySelector("#notice").textContent,
        status: document.querySelector(".save-state").textContent,
        state: window.boardworldInspect(),
      }));
      assert.equal(messages.notice, result.notice);
      assert.equal(messages.status, result.notice);
      assert.deepEqual(messages.state, result.winner);
      const uiCopyPreserved = await ui.evaluate(async (bytes) => {
        const p = await import("/games/tc-sim-boardworld/persistence.mjs");
        return (await p.loadGameLocked()).recoverySaves.some((copy) => copy.bytes === bytes);
      }, nextForkBytes);
      assert.equal(
        uiCopyPreserved,
        true,
        "manual UI save preserves the new divergent backup exactly",
      );
      evidence.uiNotice = messages.notice;
      evidence.uiStatus = messages.status;
      evidence.uiCopyPreserved = uiCopyPreserved;
      await ui.locator("#menu-dialog [data-ui=close]").click();
      await ui.screenshot({ path: resolve(dirname(output), `combined-notice-${mode}.png`) });
    }
    assert.deepEqual(errors, []);
    evidence.pass = true;
    await context.close();
  }
  report.status = "PASS";
} catch (error) {
  report.status = "FAIL";
  report.error = error.stack;
  process.exitCode = 1;
} finally {
  writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ status: report.status, cases: report.results.length, output }));
  await browser?.close();
  server.close();
  rmSync(temp, { recursive: true, force: true });
}
