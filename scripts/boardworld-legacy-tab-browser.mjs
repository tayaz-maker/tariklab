/** Regression: a suspended, unpatched released6 writer must not replace Gold progress. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { chromium } from "playwright";
import { createStaticGameServer } from "./static-game-server.mjs";

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  assert.ok(args[index + 1] && !args[index + 1].startsWith("--"), `${name} requires a value`);
  return args[index + 1];
};
const repo = resolve(arg("--repo", process.cwd()));
const serving = resolve(repo, arg("--serve", "public"));
const output = resolve(
  arg(
    "--out",
    join(process.env.RUNNER_TEMP || tmpdir(), "screenshots", "boardworld-legacy-tab", "result.json"),
  ),
);
const released = "d695119186cad42c079a911a60c372f201b3b64b";
const releasedTree = "2350d4eb908d260fee1919e97ec27278c30bafb1";
const git = (...values) => execFileSync("git", values, { cwd: repo, maxBuffer: 32 * 1024 * 1024 });
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const stateHash = (state) => hash(JSON.stringify(state));
const runtime = "games/tc-sim-boardworld";
const temp = mkdtempSync(join(tmpdir(), "boardworld-legacy-tab-"));
const report = {
  command: process.argv,
  cwd: process.cwd(),
  repository: repo,
  commit: git("rev-parse", "HEAD").toString().trim(),
  tree: git("rev-parse", "HEAD^{tree}").toString().trim(),
  trackedDiffSha256: hash(git("diff", "HEAD")),
  runnerSha256: hash(readFileSync(new URL(import.meta.url))),
  serving,
  releasedCommit: released,
  releasedTree,
  startedAt: new Date().toISOString(),
  environment: { node: process.version, platform: process.platform, architecture: process.arch },
  status: "RUNNING",
  checks: {},
};
let server, browser;
try {
  assert.equal(git("rev-parse", `${released}^{tree}`).toString().trim(), releasedTree);
  const archive = git("archive", released, `public/${runtime}`);
  report.releasedArchiveSha256 = hash(archive);
  writeFileSync(join(temp, "source.tar"), archive);
  execFileSync("tar", ["-xf", join(temp, "source.tar"), "-C", temp]);
  const frozen = join(temp, "public", runtime);
  report.servedModuleSha256 = Object.fromEntries(
    readdirSync(join(serving, runtime))
      .filter((name) => name.endsWith(".mjs"))
      .sort()
      .map((name) => [name, hash(readFileSync(join(serving, runtime, name)))]),
  );
  report.sourceModuleSha256 = Object.fromEntries(
    ["engine.mjs", "persistence.mjs", "save-codec.mjs"].map((name) => [
      name,
      hash(readFileSync(join(repo, "public", runtime, name))),
    ]),
  );
  server = createStaticGameServer(serving);
  await new Promise((done, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", done);
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
  });
  report.browser = browser.version();
  const context = await browser.newContext();
  const errors = [];
  context.on("page", (page) => page.on("pageerror", (error) => errors.push(error.message)));
  // This same-origin old tab retains the entire exact released module graph.
  // No current validator/writer is substituted and no protocol internals are read.
  await context.route("**/released6/*.mjs", (route) => {
    const name = new URL(route.request().url()).pathname.split("/").at(-1);
    return route.fulfill({
      contentType: "text/javascript",
      body: readFileSync(join(frozen, name)),
    });
  });
  await context.route("**/legacy-tab-harness.html", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Released6 save regression</title>",
    }),
  );
  const open = async (prefix) => {
    const page = await context.newPage();
    await page.goto(`${origin}/legacy-tab-harness.html`);
    await page.evaluate(async (base) => {
      window.persistence = await import(`${base}/persistence.mjs`);
      window.engine = await import(`${base}/engine.mjs`);
    }, prefix);
    return page;
  };
  const old = await open("/released6");
  const seed = readFileSync(
    join(repo, "scripts/fixtures/boardworld/v6-fresh-newcomer.json"),
    "utf8",
  );
  report.seedSha256 = hash(seed);
  await old.evaluate((bytes) => {
    localStorage.setItem(persistence.SAVE_KEY, bytes);
    window.stale = persistence.loadGame().state;
  }, seed);
  const gold = await open(`/${runtime}`);
  const winner = await gold.evaluate(async () => {
    const loaded = await persistence.loadGameLocked();
    const action = engine.resolveAction(loaded.state, "event:welcome:work");
    if (!action.ok) throw new Error(action.message);
    return {
      state: action.state,
      saved: await persistence.saveGameLocked(action.state, undefined, loaded.token),
    };
  });
  assert.equal(winner.saved.ok, true, "Gold must first save its winner successfully");
  report.checks.goldSave = true;
  const fork = await old.evaluate(() => {
    const action = engine.resolveAction(stale, "event:welcome:learn");
    if (!action.ok) throw new Error(action.message);
    window.stale = action.state;
    return { state: stale, saved: persistence.saveGame(stale) };
  });
  assert.equal(fork.saved.ok, true, "actual unpatched6 writer must execute its write");
  assert.notDeepEqual(fork.state, winner.state, "branches must diverge, even at equal revision");
  report.checks.released6StaleWrite = true;
  // A genuinely new current-client tab must retain the winner after that old write.
  const fresh = await open(`/${runtime}`);
  const returned = await fresh.evaluate(async () => (await persistence.loadGameLocked()).state);
  const exportedFork = await old.evaluate(
    () => persistence.importGame(persistence.exportGame(stale)).state,
  );
  assert.deepEqual(
    exportedFork,
    fork.state,
    "the old in-memory fork must remain exactly exportable",
  );
  report.checks.staleForkExportable = true;
  report.winnerStateSha256 = stateHash(winner.state);
  report.staleForkStateSha256 = stateHash(fork.state);
  report.returnedStateSha256 = stateHash(returned);
  report.checks.goldWinnerPreserved = stateHash(returned) === stateHash(winner.state);
  report.oldForkSilentlyAdopted = stateHash(returned) === stateHash(fork.state);
  report.pageErrors = errors;
  assert.deepEqual(errors, []);
  assert.deepEqual(
    returned,
    winner.state,
    "New Gold load must preserve the complete Gold winner after an unpatched released6 stale write",
  );
  report.status = "PASS";
} catch (error) {
  report.status = "FAIL";
  report.error = { name: error.name, message: String(error.message).slice(0, 2000) };
  process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  report.exitCode = process.exitCode || 0;
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(
    JSON.stringify(
      {
        status: report.status,
        checks: report.checks,
        commit: report.commit,
        serving,
        report: output,
      },
      null,
      2,
    ),
  );
  await browser?.close();
  if (server?.listening) await new Promise((done) => server.close(done));
  rmSync(temp, { recursive: true, force: true });
}
