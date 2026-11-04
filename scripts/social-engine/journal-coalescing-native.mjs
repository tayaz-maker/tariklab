/** Experiment-only bounded native check; run after build.mjs, never as a hardware claim. */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { decodeSaveText } from "../../src/games/social-engine/persistence/codec.ts";
import { canonicalState } from "../../src/games/social-engine/simulation/engine.ts";
const out =
  process.env.SE_EXPERIMENT_OUT ||
  "artifacts/social-engine/input-visibility-recovery/native-coalescing";
await mkdir(out, { recursive: true });
const manifestBytes = await readFile("public/games/social-engine/build-manifest.json");
const manifest = JSON.parse(manifestBytes);
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const report = {
  status: "RUNNING",
  startedAt: new Date().toISOString(),
  sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  manifestSha256: sha(manifestBytes),
  sourceDigest: manifest.sourceDigest,
  limits: [
    "One native initialization and400-tick pending tail, not a full suite or hardware A/B.",
    "Existing15s initialization/drain deadlines retained; overall90s process bound.",
    "Transaction instrumentation is passive; actual native callbacks and worker bytes are preserved.",
  ],
  stages: [],
};
let browser;
let page;
const server = createServer(async (request, response) => {
  try {
    const path = resolve("public", "." + new URL(request.url, "http://localhost").pathname);
    if (!path.startsWith(resolve("public") + "/")) throw Error("path");
    const bytes = await readFile(path);
    response.setHeader(
      "content-type",
      path.endsWith(".js")
        ? "text/javascript"
        : path.endsWith(".json")
          ? "application/json"
          : path.endsWith(".css")
            ? "text/css"
            : path.endsWith(".png")
              ? "image/png"
              : "text/html",
    );
    response.end(bytes);
  } catch {
    response.statusCode = 404;
    response.end();
  }
});
const persist = () => writeFile(out + "/results.json", JSON.stringify(report, null, 2));
const watchdog = setTimeout(async () => {
  report.status = "TIME_LIMIT";
  await persist();
  void browser?.close();
  setTimeout(() => process.exit(124), 1000).unref();
}, 90000);
const stage = async (name, operation) => {
  const started = performance.now();
  try {
    const result = await operation();
    report.stages.push({ name, status: "PASS", durationMs: performance.now() - started });
    await persist();
    return result;
  } catch (error) {
    report.stages.push({
      name,
      status: "FAIL",
      durationMs: performance.now() - started,
      error: error.stack,
    });
    throw error;
  }
};
try {
  await new Promise((yes, no) => {
    server.once("error", no);
    server.listen(0, "127.0.0.1", yes);
  });
  browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
      resolve(
        "../browsers/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell",
      ),
    args: ["--use-angle=swiftshader-webgl"],
  });
  page = await browser.newPage();
  page.setDefaultTimeout(15000);
  await page.addInitScript(() => {
    window.__nativeWrites = [];
    const original = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (...args) {
      const tx = original.apply(this, args);
      const start = performance.now();
      if (tx.mode === "readwrite" && this.name === "tariklab-social-engine") {
        const row = { phase: window.__nativePhase || "init", stores: [...tx.objectStoreNames] };
        window.__nativeWrites.push(row);
        tx.addEventListener("complete", () => {
          row.status = "complete";
          row.durationMs = performance.now() - start;
        });
        tx.addEventListener("abort", () => {
          row.status = "abort";
          row.durationMs = performance.now() - start;
        });
      }
      return tx;
    };
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  await stage("init", async () => {
    const response = await page.goto(base + "/games/social-engine/index.html?qa=1");
    const expected = manifest.assets.find((asset) => asset.file === "index.html");
    assert.equal(sha(await response.body()), expected.sha256, "served exact experiment build");
    await page.locator("[name=name]").fill("Günlük Deneyi");
    await page.getByRole("button", { name: "Hikâyene başla" }).click();
    await page.waitForFunction(
      () =>
        window.__socialEngine?.journalStatus()?.handle ||
        window.__socialEngine?.journalStatus()?.failed,
      undefined,
      { polling: 50, timeout: 15000 },
    );
    assert.equal(await page.evaluate(() => window.__socialEngine.journalStatus().failed), null);
    await page.evaluate(() => window.__socialEngine.pause(true));
  });
  const settled = () =>
    page.waitForFunction(
      () => {
        const s = window.__socialEngine.journalStatus();
        return s?.failed || (s?.handle && s.pendingOperations === 0);
      },
      undefined,
      { polling: 50, timeout: 15000 },
    );
  await stage("initial-drain", settled);
  report.renderer = await page.evaluate(() => {
    const canvas = document.querySelector("#world canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  });
  assert.match(report.renderer, /SwiftShader/i);
  const before = await page.evaluate(async () => {
    window.__nativePhase = "pending-tail";
    return window.__socialEngine.state();
  });
  await stage("pending400-ticks", async () => {
    await page.evaluate(() => window.__socialEngine.step(400));
    await page.waitForFunction(
      (tick) => window.__socialEngine.projection()?.tick >= tick,
      before.tick + 400,
      { timeout: 15000 },
    );
  });
  await stage("tail-drain", settled);
  const after = await page.evaluate(() => window.__socialEngine.state());
  report.finalJournal = await page.evaluate(() => window.__socialEngine.journalStatus());
  assert.equal(report.finalJournal.failed, null);
  assert.ok(report.finalJournal.highWater <= 600);
  assert.equal(after.tick, before.tick + 400);
  await stage("verified-native-reload", async () => {
    const exported = await page.evaluate(() => {
      window.__nativePhase = "verified-reload";
      return window.__socialEngine.export("auto");
    });
    const restored = await decodeSaveText(exported);
    assert.equal(canonicalState(restored.state), canonicalState(after));
  });
  report.status = "PASS";
  report.transactions = await page.evaluate(() => window.__nativeWrites);
} catch (error) {
  report.status = "FAIL";
  report.error = error.stack;
  if (page) {
    try {
      report.failureDiagnostics = await Promise.race([
        page.evaluate(() => ({
          journal: window.__socialEngine?.journalStatus?.(),
          transactions: window.__nativeWrites,
          visibility: document.visibilityState,
        })),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("diagnostic sampling bound")), 1000),
        ),
      ]);
    } catch {
      /* Keep the original failure and finite run bound. */
    }
  }
  process.exitCode = 1;
} finally {
  clearTimeout(watchdog);
  report.finishedAt = new Date().toISOString();
  await persist();
  const closeTimer = setTimeout(() => process.exit(process.exitCode || 1), 3000);
  await browser?.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  clearTimeout(closeTimer);
}
console.log(JSON.stringify(report));
