/** Real-time browser soak. QA STEP, clock jumps and direct state mutations are deliberately absent. */
import { chromium } from "playwright";
import { windowlessRendererOptions } from "./windowless-launch.mjs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { assessSoakCoverage } from "./soak-coverage.mjs";

let requestedStop = null;
process.once("SIGINT", () => {
  requestedStop = "SIGINT";
});
process.once("SIGTERM", () => {
  requestedStop = "SIGTERM";
});
const base = process.env.SE_BASE || "http://127.0.0.1:8097";
const targetMinutes = Number(process.env.SE_PERF_MINUTES || 120);
if (!Number.isFinite(targetMinutes) || targetMinutes <= 0 || targetMinutes > 240)
  throw Error("SE_PERF_MINUTES must be in (0,240].");
const runId = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const out = path.resolve("artifacts/social-engine/performance", runId);
await mkdir(out, { recursive: true });
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const files = async (dir) => {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...(await files(p)));
    else result.push(p);
  }
  return result.sort();
};
const sourceFiles = await files("src/games/social-engine");
const sourceManifest = [];
for (const file of sourceFiles) {
  const bytes = await readFile(file);
  sourceManifest.push({ file, bytes: bytes.length, sha256: hash(bytes) });
}
const sourceDigest = hash(JSON.stringify(sourceManifest));
await writeFile(path.join(out, "source-manifest.json"), JSON.stringify(sourceManifest, null, 2));
const manifestBytes = await readFile("public/games/social-engine/build-manifest.json");
await writeFile(path.join(out, "build-manifest.json"), manifestBytes);
let gitHead = null,
  dirty = null;
try {
  gitHead = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  dirty = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim().length > 0;
} catch {
  /* Git metadata remains explicitly unavailable. */
}
const harnessBytes = await readFile(new URL(import.meta.url));
await writeFile(path.join(out, "harness.mjs"), harnessBytes);
const report = {
  schemaVersion: 2,
  runId,
  status: "RUNNING",
  startedAt: new Date().toISOString(),
  targetMinutes,
  scenario:
    "Real-time mixed neighborhood play, 100 persistent local +1000 background NPCs; no time acceleration",
  base,
  build: {
    gitHead,
    dirty,
    sourceDigest,
    compiledSourceDigest: JSON.parse(manifestBytes).sourceDigest ?? null,
    manifestSha256: hash(manifestBytes),
    harnessSha256: hash(harnessBytes),
    attribution:
      "Actual served asset SHA-256 hashes recorded. Worktree source digest is capture-time context; this is not a verified deployed commit.",
  },
  environment: {
    platform: os.platform(),
    release: os.release(),
    arch: os.arch(),
    cpus: os.cpus().map((c) => c.model),
    logicalCpus: os.cpus().length,
    totalMemoryBytes: os.totalmem(),
    viewport: { width: 1920, height: 1080 },
    dpr: 1,
    headless: true,
    concurrentWork:
      "Full legacy tests,365-day simulation,build/development may contend for CPU during this run; not an isolated reference-PC result.",
  },
  checkpoints: [],
  minuteSamples: [],
  actions: [],
  errors: [],
  loadedAssets: [],
  acceptance: { "SE-049": "UNVERIFIED", "SE-050": "UNVERIFIED", "SE-051": "UNVERIFIED" },
  limits: [
    "macOS host is not the specified four-core reference PC.",
    "Automated playback does not satisfy the two real human playtests.",
    "GPU and total browser-process memory are not inferred from JS heap; page and simulation worker isolates are measured separately.",
    "IPC transfer latency is UNVERIFIED unless instrumented by the application.",
    "CDP garbage collection once per minute perturbs timing and is recorded.",
  ],
};
const saveReport = async () => {
  await writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2));
  if (process.env.SE_PERF_NO_LATEST !== "1")
    await writeFile(
      "artifacts/social-engine/performance/latest.json",
      JSON.stringify(
        {
          runId,
          path: out,
          status: report.status,
          elapsedMinutes: report.elapsedMinutes ?? 0,
          checkpoints: report.checkpoints,
        },
        null,
        2,
      ),
    );
};
await saveReport();
const browser = await chromium
  .launch({
    headless: true,
    ...windowlessRendererOptions(),
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
      (process.platform === "darwin"
        ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
        : chromium.executablePath()),
  })
  .catch(async (error) => {
    report.status = "FAILED_TO_START";
    report.finishedAt = new Date().toISOString();
    report.failure = { message: error.message };
    await saveReport();
    throw error;
  });
const context = await browser.newContext({
  viewport: report.environment.viewport,
  deviceScaleFactor: 1,
});
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
await cdp.send("Performance.enable");
const browserProtocol = await browser.newBrowserCDPSession();
report.environment.browser = await browser.version();
try {
  const browserCDP = await browser.newBrowserCDPSession();
  report.environment.systemInfo = await browserCDP.send("SystemInfo.getInfo");
  await browserCDP.detach();
} catch (e) {
  report.environment.systemInfo = { status: "UNVERIFIED", reason: e.message };
}
const assetSeen = new Set();
const assetPromises = [];
context.on("response", (response) => {
  if (!response.url().includes("/games/social-engine/")) return;
  const key = response.url();
  if (assetSeen.has(key)) return;
  assetSeen.add(key);
  assetPromises.push(
    (async () => {
      try {
        const bytes = await response.body();
        report.loadedAssets.push({
          url: key,
          status: response.status(),
          bytes: bytes.length,
          sha256: hash(bytes),
        });
      } catch (e) {
        report.loadedAssets.push({ url: key, status: response.status(), error: e.message });
      }
    })(),
  );
});
page.on("pageerror", (e) =>
  report.errors.push({ kind: "pageerror", message: e.message, at: new Date().toISOString() }),
);
page.on("console", (m) => {
  if (m.type() === "error")
    report.errors.push({ kind: "console", message: m.text(), at: new Date().toISOString() });
});
await page.addInitScript(() => {
  const probe = { frames: [], longTasks: [], last: 0, active: false };
  window.__sePerfProbe = probe;
  if (PerformanceObserver.supportedEntryTypes.includes("longtask"))
    new PerformanceObserver((list) => {
      if (probe.active)
        for (const e of list.getEntries())
          probe.longTasks.push({ start: e.startTime, duration: e.duration });
    }).observe({ type: "longtask", buffered: true });
  const loop = (now) => {
    if (probe.active && probe.last) probe.frames.push(now - probe.last);
    probe.last = now;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
});
const allFrames = [],
  simSamples = [],
  heapSamples = [],
  allLongTasks = [];
let gameStart = 0,
  browserStart = 0,
  lastTick = -1,
  lastCollectedSimTick = -1,
  stalledSeconds = 0;
const startedMono = performance.now();
const quantile = (values, q) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
};
const summary = (values) => ({
  count: values.length,
  p50: quantile(values, 0.5),
  p95: quantile(values, 0.95),
  p99: quantile(values, 0.99),
});
const slope = (points, field = "combinedJsHeapUsed") => {
  if (points.length < 2 || points.some((p) => !Number.isFinite(p[field]))) return null;
  const n = points.length,
    meanX = points.reduce((s, p) => s + p.minute, 0) / n,
    meanY = points.reduce((s, p) => s + p[field] / 1048576, 0) / n;
  let top = 0,
    bottom = 0;
  for (const p of points) {
    top += (p.minute - meanX) * (p[field] / 1048576 - meanY);
    bottom += (p.minute - meanX) ** 2;
  }
  return bottom ? top / bottom : 0;
};
const cmd = async (type, args = {}) => {
  const t = performance.now();
  let result;
  try {
    result = await page.evaluate(({ type, args }) => window.__socialEngine.command(type, args), {
      type,
      args,
    });
  } catch (e) {
    result = { ok: false, reason: e.message };
  }
  report.actions.push({
    minute: (performance.now() - gameStart) / 60000,
    type,
    args,
    ok: result.ok,
    reason: result.reason,
    roundTripMs: performance.now() - t,
  });
  return result;
};
const projection = () =>
  page.evaluate(() => {
    const p = window.__socialEngine.projection();
    return p
      ? {
          tick: p.tick,
          minute: p.minute,
          player: p.player,
          npcs: p.npcs,
          vehicles: p.vehicles,
          quests: p.quests,
          population: p.population,
          simMs: p.simMs,
        }
      : null;
  });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function navigate(point, scene = "outside") {
  let p = await projection();
  if (!p) return false;
  if (p.player.vehicleId) {
    await cmd("DRIVE", { throttle: -1, steer: 0 });
    for (let i = 0; i < 12; i++) {
      await wait(300);
      p = await projection();
      const vehicle = p.vehicles.find((v) => v.id === p.player.vehicleId);
      if (!vehicle || vehicle.speed <= 0.6) break;
    }
    await cmd("VEHICLE_EXIT");
    p = await projection();
  }
  if (p.player.location.scene !== "outside" && scene === "outside") {
    await cmd("MOVE_TO", { x: 7, y: 10 });
    for (let i = 0; i < 20; i++) {
      await wait(250);
      p = await projection();
      if (Math.hypot(p.player.location.x - 7, p.player.location.y - 10) < 1.7) break;
    }
    await cmd("EXIT");
  }
  return (await cmd("MOVE_TO", point)).ok;
}
async function performMinute(index) {
  const p = await projection();
  if (!p) return;
  const phase = index % 12;
  if (p.player.wanted) {
    await cmd("SURRENDER");
    return;
  }
  if (p.player.health < 40 && (p.player.inventory.medicine ?? 0) > 0)
    await cmd("USE_ITEM", { item: "medicine" });
  if (p.player.hunger > 35 && (p.player.inventory.simit ?? 0) > 0)
    await cmd("USE_ITEM", { item: "simit" });
  switch (phase) {
    case 0: {
      await navigate({ x: 27, y: 14.7 });
      break;
    }
    case 1: {
      await cmd("ENTER", { buildingId: "b-market" });
      await cmd("BUY", { businessId: "market", item: "simit", quantity: 5 });
      await cmd("APPLY_JOB", { jobId: "retail" });
      await cmd("START_SHIFT");
      break;
    }
    case 2: {
      if (p.player.shift) {
        for (let i = 0; i < 12; i++) {
          if (!(await projection()).player.shift) break;
          await wait(1000);
        }
      }
      await navigate({ x: 8.5, y: 31.7 });
      break;
    }
    case 3: {
      await cmd("ENTER", { buildingId: "b-cafe" });
      const here = await projection(),
        person = here.npcs.find(
          (n) =>
            n.location.scene === here.player.location.scene &&
            Math.hypot(
              n.location.x - here.player.location.x,
              n.location.y - here.player.location.y,
            ) <= 1.8,
        );
      if (person) await cmd("TALK", { npcId: person.id, topic: "greet" });
      await cmd("BUY", { businessId: "tea", item: "tea", quantity: 1 });
      break;
    }
    case 4: {
      await navigate({ x: 50, y: 49.7 });
      break;
    }
    case 5: {
      const q = p.quests.find((q) => q.kind === "delivery" && q.status === "offered");
      if (q) await cmd("ACCEPT_QUEST", { questId: q.id });
      const current = await projection(),
        active = current.quests.find((q) => q.kind === "delivery" && q.status === "active");
      if (active) await cmd("COMPLETE_QUEST", { questId: active.id });
      await navigate({ x: 27, y: 17 });
      break;
    }
    case 6: {
      const now = await projection(),
        v = now.vehicles.find(
          (v) =>
            !v.driverId &&
            Math.hypot(v.location.x - now.player.location.x, v.location.y - now.player.location.y) <
              1.8,
        );
      if (v) {
        await cmd("VEHICLE_ENTER", { vehicleId: v.id });
        await cmd("DRIVE", { throttle: 1, steer: 0 });
      } else if (now.vehicles.some((v) => !v.driverId))
        await navigate(now.vehicles.find((v) => !v.driverId).location);
      break;
    }
    case 7: {
      if (p.player.vehicleId) await cmd("DRIVE", { throttle: 1, steer: index % 2 ? 1 : -1 });
      else {
        const free = p.vehicles.find(
          (v) =>
            !v.driverId &&
            Math.hypot(v.location.x - p.player.location.x, v.location.y - p.player.location.y) <
              1.8,
        );
        if (free) {
          await cmd("VEHICLE_ENTER", { vehicleId: free.id });
          await cmd("DRIVE", { throttle: 1, steer: 0 });
        } else await navigate({ x: 53, y: 13.7 });
      }
      break;
    }
    case 8: {
      await navigate({ x: 9, y: 49.7 });
      break;
    }
    case 9: {
      await cmd("ENTER", { buildingId: "b-school" });
      await cmd("TRAIN", { skill: "academic" });
      break;
    }
    case 10: {
      await navigate({ x: 6.5, y: 13.7 });
      break;
    }
    case 11: {
      await cmd("ENTER", { buildingId: "b-home" });
      await cmd("REST");
      break;
    }
  }
}
async function workerHeap() {
  let sessionId;
  try {
    const targets = await browserProtocol.send("Target.getTargets");
    const target = targets.targetInfos.find(
      (t) => t.type === "worker" && t.url.includes("/games/social-engine/"),
    );
    if (!target) return { status: "UNVERIFIED", reason: "Simulation worker CDP target absent" };
    ({ sessionId } = await browserProtocol.send("Target.attachToTarget", {
      targetId: target.targetId,
      flatten: false,
    }));
    let sequence = 0;
    const request = (method) =>
      new Promise((resolve, reject) => {
        const id = ++sequence;
        const cleanup = () => {
          clearTimeout(timer);
          browserProtocol.off("Target.receivedMessageFromTarget", receive);
        };
        const receive = (event) => {
          if (event.sessionId !== sessionId) return;
          const message = JSON.parse(event.message);
          if (message.id !== id) return;
          cleanup();
          if (message.error) reject(Error(JSON.stringify(message.error)));
          else resolve(message.result);
        };
        const timer = setTimeout(() => {
          cleanup();
          reject(Error("Worker CDP response timed out"));
        }, 5000);
        browserProtocol.on("Target.receivedMessageFromTarget", receive);
        browserProtocol
          .send("Target.sendMessageToTarget", {
            sessionId,
            message: JSON.stringify({ id, method, params: {} }),
          })
          .catch((error) => {
            cleanup();
            reject(error);
          });
      });
    const started = performance.now();
    await request("HeapProfiler.collectGarbage");
    const gcMs = performance.now() - started;
    const usage = await request("Runtime.getHeapUsage");
    return { status: "MEASURED", targetUrl: target.url, gcMs, ...usage };
  } catch (error) {
    return { status: "UNVERIFIED", reason: error.message };
  } finally {
    if (sessionId)
      await browserProtocol.send("Target.detachFromTarget", { sessionId }).catch(() => {});
  }
}
async function sample(minute) {
  const raw = await page.evaluate(() => {
    const probe = window.__sePerfProbe,
      p = window.__socialEngine.projection(),
      m = window.__socialEngine.metrics();
    return {
      browserNow: performance.now(),
      frames: probe.frames.splice(0),
      longTasks: probe.longTasks.splice(0),
      projection: {
        tick: p.tick,
        minute: p.minute,
        population: p.population,
        scene: p.player.location.scene,
      },
      renderer: m.renderer,
      sim: m.sim,
      ipc: m.ipc,
      save: m.save,
      errors: m.errors,
    };
  });
  allFrames.push(...raw.frames);
  allLongTasks.push(...raw.longTasks);
  const firstSimTick = raw.projection.tick - raw.sim.length + 1;
  const newSim = raw.sim.filter((_, i) => firstSimTick + i > lastCollectedSimTick);
  simSamples.push(...newSim);
  lastCollectedSimTick = raw.projection.tick;
  const gcStart = performance.now();
  await cdp.send("HeapProfiler.collectGarbage");
  const gcMs = performance.now() - gcStart;
  const metrics = await cdp.send("Performance.getMetrics");
  const metric = Object.fromEntries(metrics.metrics.map((m) => [m.name, m.value]));
  const worker = await workerHeap();
  const heap = {
    minute: (performance.now() - gameStart) / 60000,
    jsHeapUsed: metric.JSHeapUsedSize,
    jsHeapTotal: metric.JSHeapTotalSize,
    gcMs,
    worker,
    workerJsHeapUsed: worker.status === "MEASURED" ? worker.usedSize : null,
    combinedJsHeapUsed:
      worker.status === "MEASURED" ? metric.JSHeapUsedSize + worker.usedSize : null,
  };
  heapSamples.push(heap);
  const entry = {
    minute,
    at: new Date().toISOString(),
    elapsedMs: raw.browserNow - browserStart,
    projection: raw.projection,
    frameMs: summary(raw.frames),
    longTaskCount: raw.longTasks.length,
    longTaskMs: raw.longTasks.reduce((s, t) => s + t.duration, 0),
    heap,
    simMs: summary(newSim),
    renderer: raw.renderer,
    ipcMs: raw.ipc?.length
      ? summary(raw.ipc)
      : { status: "UNVERIFIED", reason: "Application does not instrument projection IPC latency" },
    saveMs: summary(raw.save),
    errors: raw.errors,
  };
  report.minuteSamples.push(entry);
  report.elapsedMinutes = entry.elapsedMs / 60000;
  await writeFile(
    path.join(out, `minute-${String(minute).padStart(3, "0")}.json.gz`),
    zlib.gzipSync(
      JSON.stringify({ entry, rawFrames: raw.frames, rawSimMs: newSim, longTasks: raw.longTasks }),
    ),
  );
  const continuity = assessSoakCoverage(report, Math.min(minute, targetMinutes));
  report.continuity = continuity;
  if (continuity.status !== "VERIFIED") {
    const error = Error(
      "Continuous gameplay time could not be verified: " + JSON.stringify(continuity.issues),
    );
    error.code = "SE_SOAK_CONTINUITY";
    throw error;
  }
  for (const threshold of [30, 60, 120])
    if (minute >= threshold && !report.checkpoints.some((c) => c.minute === threshold)) {
      const elapsed = performance.now() - gameStart,
        longTaskMs = allLongTasks.reduce((s, t) => s + t.duration, 0);
      const checkpoint = {
        minute: threshold,
        elapsedMs: elapsed,
        frameMs: summary(allFrames),
        longTaskRatio: longTaskMs / elapsed,
        heapSlopeMiBPerMinute: slope(heapSamples),
        mainHeapSlopeMiBPerMinute: slope(heapSamples, "jsHeapUsed"),
        workerHeapSlopeMiBPerMinute: slope(heapSamples, "workerJsHeapUsed"),
        heapMeasurementScope:
          "page plus simulation-worker JS isolates; excludes GPU and process memory",
        workerSimMs: summary(simSamples),
        population: raw.projection.population,
        errors: report.errors.length + raw.errors.length,
        sourceDigest,
        manifestSha256: report.build.manifestSha256,
        referencePC: false,
        engineVersion: report.build.engineVersion,
        automated: true,
        continuity,
      };
      report.checkpoints.push(checkpoint);
      // Capture measured thresholds separately from acceptance: reference-device/manual evidence remains unmet.
      checkpoint.measuredThresholds = {
        frameP95AtMost33_3ms: checkpoint.frameMs.p95 <= 33.3,
        longTaskRatioAtMost5Percent: checkpoint.longTaskRatio <= 0.05,
        heapSlopeAtMost1MiBPerMinute:
          checkpoint.heapSlopeMiBPerMinute === null ? null : checkpoint.heapSlopeMiBPerMinute <= 1,
      };
      await page.screenshot({ path: path.join(out, `checkpoint-${threshold}min.png`) });
      console.log(
        JSON.stringify({
          checkpoint: threshold,
          ...checkpoint.measuredThresholds,
          p95: checkpoint.frameMs.p95,
          elapsedMinutes: elapsed / 60000,
        }),
      );
    }
  await saveReport();
}
try {
  await page.goto(base + "/games/social-engine/index.html?qa=1", { waitUntil: "networkidle" });
  await page.locator("[name=name]").fill("Deniz Ölçüm");
  await page.getByRole("button", { name: "Hikâyene başla" }).click();
  await page.waitForFunction(() => window.__socialEngine?.projection()?.population === 1100, {
    timeout: 30000,
  });
  const state = await page.evaluate(() => window.__socialEngine.state());
  report.build.engineVersion = state.engineVersion;
  report.seed = state.seed;
  report.initialPopulation = state.npcs.length;
  // Match tick and wall-clock samples in the same browser task, before heap collection.
  const anchor = await page.evaluate(() => {
    const p = window.__sePerfProbe;
    p.frames = [];
    p.longTasks = [];
    p.last = 0;
    p.active = true;
    return { now: performance.now(), tick: window.__socialEngine.projection().tick };
  });
  report.initialTick = anchor.tick;
  browserStart = anchor.now;
  gameStart = performance.now();
  report.measurementStartedAt = new Date().toISOString();
  await page.screenshot({ path: path.join(out, "start.png") });
  await Promise.allSettled(assetPromises);
  await saveReport();
  console.log(
    JSON.stringify({
      started: runId,
      out,
      targetMinutes,
      engineVersion: state.engineVersion,
      initialTick: report.initialTick,
      manifestSha256: report.build.manifestSha256,
    }),
  );
  await cmd("TALK", { npcId: "n0", topic: "greet" });
  await performMinute(0);
  for (let index = 0; index < Math.ceil(targetMinutes); index++) {
    const deadline = gameStart + Math.min(index + 1, targetMinutes) * 60000;
    while (performance.now() < deadline) {
      if (requestedStop)
        throw new Error(
          `Benchmark stopped by ${requestedStop}; incomplete checkpoints remain unverified.`,
        );
      await wait(Math.min(1000, Math.max(1, deadline - performance.now())));
      const p = await projection();
      if (!p) throw Error("Projection disappeared");
      if (p.tick === lastTick) stalledSeconds++;
      else stalledSeconds = 0;
      lastTick = p.tick;
      if (stalledSeconds >= 10)
        throw Error("Authoritative tick failed to advance for ten consecutive seconds");
      if (p.population !== 1100) throw Error("Population changed unexpectedly");
    }
    await sample(index + 1);
    if (performance.now() - gameStart >= targetMinutes * 60000) break;
    await performMinute(index + 1);
  }
  report.continuity = assessSoakCoverage(report, targetMinutes);
  if (report.continuity.status !== "VERIFIED")
    throw Object.assign(Error("Final gameplay coverage is incomplete"), {
      code: "SE_SOAK_CONTINUITY",
    });
  report.status = "COMPLETED";
  report.finalState = await page.evaluate(async () => {
    const s = await window.__socialEngine.state();
    return {
      tick: s.tick,
      minute: s.minute,
      population: s.npcs.length,
      engineVersion: s.engineVersion,
      accounts: s.accounts.player,
      income: s.player.income,
      completedShifts: Number(s.flags.shiftsCompleted ?? 0),
      drivenDistance: Number(s.flags.drivenDistance ?? 0),
      events: s.eventCount,
      ledgerCount: s.ledgerCheckpoint.count + s.ledger.length,
    };
  });
} catch (error) {
  report.status = requestedStop
    ? "STOPPED_EARLY"
    : error.code === "SE_SOAK_CONTINUITY"
      ? "INTERRUPTED_OBSERVATION"
      : "FAILED";
  report.failure = { message: error.message, stack: error.stack };
  report.errors.push({ kind: "harness", message: error.message, at: new Date().toISOString() });
  console.error(error.stack);
  process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  report.elapsedMinutes = gameStart ? (performance.now() - gameStart) / 60000 : 0;
  report.wallClockMs = performance.now() - startedMono;
  report.frameMs = summary(allFrames);
  report.workerSimMs = summary(simSamples);
  report.heapSlopeMiBPerMinute = slope(heapSamples);
  report.mainHeapSlopeMiBPerMinute = slope(heapSamples, "jsHeapUsed");
  report.workerHeapSlopeMiBPerMinute = slope(heapSamples, "workerJsHeapUsed");
  report.longTaskRatio = gameStart
    ? allLongTasks.reduce((s, t) => s + t.duration, 0) / (performance.now() - gameStart)
    : null;
  report.heapSamples = heapSamples;
  await Promise.allSettled(assetPromises);
  await saveReport();
  await context.close();
  await browser.close();
  console.log(
    JSON.stringify({
      status: report.status,
      out,
      elapsedMinutes: report.elapsedMinutes,
      checkpoints: report.checkpoints,
    }),
  );
}
