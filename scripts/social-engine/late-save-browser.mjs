/** Captured long-history save integrity and latency. No simulated-time performance claim. */
import { chromium, firefox, webkit } from "playwright";
import { build } from "esbuild";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import {
  readTransactionBits,
  writeTransactionBits,
} from "../../src/games/social-engine/simulation/ledger.ts";
import { canonicalState, validateState, stepWorld } from "../../src/games/social-engine/simulation/engine.ts";
import assert from "node:assert/strict";
import { migrateState } from "../../src/games/social-engine/persistence/codec.ts";
const sampleCount = Number(process.env.SE_LATE_SAVE_SAMPLES ?? 20);
assert.ok(Number.isInteger(sampleCount) && sampleCount >= 3 && sampleCount <= 100);
const file = process.env.SE_LONG_WORLD_FIXTURE || "../day180-world-v5.json.gz";
const raw = await readFile(file),
  source = JSON.parse(gunzipSync(raw));
for (const key in source.flags)
  if (/^tx(?:set|exact):/.test(key))
    source.flags[key] = writeTransactionBits(readTransactionBits(source.flags[key]));
const world = migrateState(source);
assert.deepEqual(validateState(world), []);
const fixture = canonicalState(world),
  hash = (text) => createHash("sha256").update(text).digest("hex");
// Retain full cross-engine expected hashes. The measured saves are genuinely
// different; compute independent reference values and simulated work outside the timer.
const expectedStates = [], oracle = structuredClone(world);
for (let sample = 0; sample < sampleCount; sample++) {
  for (let t=0;t<5;t++) stepWorld(oracle);
  expectedStates.push(hash(canonicalState(oracle)));
}
const bundle = (
  await build({
    stdin: {
      contents:
        "export * from './src/games/social-engine/persistence/index.ts'; export {canonicalState,stepWorld} from './src/games/social-engine/simulation/engine.ts';",
      resolveDir: process.cwd(),
      loader: "ts",
    },
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    write: false,
  })
).outputFiles[0].text;
const out = "artifacts/social-engine/late-save";
await mkdir(out, { recursive: true });
const report = {
  status: "UNVERIFIED",
  sampleCount,
  ticksBetweenSaves: 5,
  finalExpectedHash: expectedStates.at(-1),
  worldTick: world.tick,
  fixtureSha256: hash(fixture),
  capturedFileSha256: hash(raw),
  probeSha256: hash(bundle),
  cases: [],
  note: "Captured 180-day world; transaction index normalization and production schema migration before timing. Real browser IndexedDB roundtrips of a captured late world, separate from the initial-state measurement. Sample count and concurrent local test load are disclosed.",
};
const server = createServer((req, res) => {
  res.setHeader("content-type", req.url === "/bundle.js" ? "text/javascript" : "application/json");
  res.end(req.url === "/bundle.js" ? bundle : req.url === "/fixture.json" ? fixture : "{}");
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
try {
  for (const [name, launcher] of Object.entries({ chromium, firefox, webkit })) {
    let browser;
    try {
      browser = await launcher.launch({
        headless: true,
        ...(name === "chromium" && process.platform === "darwin"
          ? {
              executablePath:
                process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
                "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            }
          : {}),
      });
      const page = await browser.newPage();
      await page.goto(base);
      const measurement = await page.evaluate(async (expectedStates) => {
        const api = await import("/bundle.js"),
          world = await (await fetch("/fixture.json")).json(),
          repo = new api.SaveRepository();
        const hash = async (text) =>
          [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)))]
            .map((x) => x.toString(16).padStart(2, "0"))
            .join("");
        const expected = await hash(api.canonicalState(world)),
          samples = [];
        for (let i = 0; i < expectedStates.length; i++) {
          for(let t=0;t<5;t++) api.stepWorld(world);
          const start = performance.now();
          await repo.save("slot-1", world);
          const saved = performance.now();
          const reader = i % 2 === 0 ? new api.SaveRepository() : repo;
          const loaded = await reader.load("slot-1"),
            end = performance.now();
          if ((await hash(api.canonicalState(loaded))) !== expectedStates[i])
            throw Error("Long-history roundtrip differs");
          samples.push({
            tick: loaded.tick,
            saveMs: saved - start,
            loadMs: end - saved,
            roundtripMs: end - start,
            loadMode: i % 2 === 0 ? "new IndexedDB connection" : "warm connection",
          });
          if (reader !== repo) await reader.close();
        }
        return { samples, slots: await repo.list(), expected };
      }, expectedStates);
      assert.equal(measurement.expected, report.fixtureSha256);
      const values = measurement.samples.map((x) => x.roundtripMs).sort((a, b) => a - b);
      const p95 = values[Math.ceil(values.length * 0.95) - 1];
      report.cases.push({
        browser: name,
        version: browser.version(),
        status: "PASS",
        ...measurement,
        latencyBudget: {
          milliseconds: 1000,
          status: sampleCount >= 20 ? (p95 <= 1000 ? "PASS" : "FAIL") : "UNVERIFIED",
          p95Ms: p95,
          maxMs: values.at(-1),
          note: "Nearest-rank observed p95;20or more samples required. Alternating warm/new IndexedDB connections. This is host-specific, not reference-PC evidence.",
        },
      });
    } catch (e) {
      report.cases.push({ browser: name, status: "FAIL", reason: e.stack });
    } finally {
      await browser?.close();
    }
    await writeFile(out + "/results.json", JSON.stringify(report, null, 2));
  }
  report.saveIntegrityStatus = report.cases.every((x) => x.status === "PASS") ? "PASS" : "FAIL";
  report.latencyStatus = report.cases.every((x) => x.latencyBudget?.status === "PASS")
    ? "PASS"
    : report.cases.some((x) => x.latencyBudget?.status === "FAIL")
      ? "FAIL"
      : "UNVERIFIED";
  report.status =
    report.saveIntegrityStatus === "PASS" && report.latencyStatus === "PASS"
      ? "PASS"
      : report.saveIntegrityStatus === "FAIL" || report.latencyStatus === "FAIL"
        ? "FAIL"
        : "UNVERIFIED";
} finally {
  await new Promise((r) => server.close(r));
  await writeFile(out + "/results.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}
if (report.status !== "PASS") process.exitCode = 1;
