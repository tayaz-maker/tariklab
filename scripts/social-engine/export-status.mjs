// Export a local handoff. Only evidence attributed to this build may become a current result.
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { resolve, basename } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { assessSoakCoverage } from "./soak-coverage.mjs";
import { footprintEvidence } from "./footprint-evidence.mjs";
const dir = "artifacts/social-engine/",
  destination = resolve(process.env.SE_DELIVERY_OUTPUT || "../../outputs");
const read = async (file) => {
  try {
    return JSON.parse(await readFile(dir + file));
  } catch (e) {
    if (e.code === "ENOENT") return null;
    throw e;
  }
};
const sha = (b) => createHash("sha256").update(b).digest("hex");
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const file = "public/games/social-engine/build-manifest.json";
const bytes = await readFile(file),
  manifest = JSON.parse(bytes),
  id = sha(bytes),
  runtimeCommit = git("log", "-1", "--format=%H", "--", file);
assert.equal(sha(execFileSync("git", ["show", runtimeCommit + ":" + file])), id);
const acceptance = await read("results.json");
assert.equal(acceptance.runtimeManifestSha256, id, "Reconcile current evidence first");
const gates = acceptance.required_evidence_status;
const current = (o) => o?.manifestSha256 === id || o?.build?.manifestSha256 === id;
const portable = await read("portable-candidate/package.json"),
  pkgSmoke = await read("portable-candidate/results.json");
const validPackage =
  current(portable) &&
  current(pkgSmoke) &&
  pkgSmoke.status === "PASS" &&
  portable.crcCheck === "PASS" &&
  sha(await readFile(resolve(destination, basename(portable.file)))) === portable.sha256;
const rawUnit = await read("acceptance-unit.json"),
  unit = current(rawUnit) ? { status: rawUnit.status, counts: rawUnit.counts } : null;
const full = await read("baseline/frozen-full-regression.json"),
  sim = await read("simulation-365/results.json"),
  parity = await read("browser-determinism/results.json");
const sourceFiles = sim?.environment?.sourceFiles ?? [],
  sourceHash = createHash("sha256");
for (const p of sourceFiles) sourceHash.update(p).update(await readFile(p));
const simFresh =
  sourceFiles.length > 0 && sim.environment.sourceSha256 === sourceHash.digest("hex");
const route = await read("route-browser/results.json"),
  net = await read("startup-network/results.json");
const latest = await read("performance/latest.json"),
  perf = latest && (await read("performance/" + latest.runId + "/report.json"));
const samePerf = current(perf) ? perf : null,
  sample = samePerf?.minuteSamples?.at(-1);
const checkpoints = (samePerf?.checkpoints ?? []).filter(
  (c) => assessSoakCoverage(samePerf, c.minute).status === "VERIFIED",
);
const footprints = (await footprintEvidence(id)).samples.map((s) => ({
  minute: s.thresholdMinute,
  elapsedMinutes: s.elapsedMinutes,
  scope: s.scope,
  totalFootprintMiB: s.totalFootprintMiB,
  thresholdStatus: s.thresholdStatus,
  runId: s.runId,
}));
const sameRoute = current(route) && route.status === "PASS" ? route : null;
const lastFrame = checkpoints.at(-1)?.frameMs ?? sample?.frameMs;
const legacy = await read("baseline/legacy-source-preservation.json");
const late = await read("late-save/results.json");
const legacyBrowser = await read("legacy-browser/final-local/summary.json");
const metal = await read("windowless-metal/results.json");
const report = {
  generatedAt: new Date().toISOString(),
  decision: "BLOCKED",
  productionStatus: "PRODUCTION_NOT_DEPLOYED",
  branch: git("branch", "--show-current"),
  localCheckpoint: git("rev-parse", "HEAD"),
  runtimeCommit,
  manifestSha256: id,
  sourceDigest: manifest.sourceDigest,
  localIntegratedRoute: sameRoute ? sameRoute.base + "/oyna/social-engine" : null,
  prUrl: null,
  verifiedProductionUrl: null,
  mergeCommitSha: null,
  cloudflareDeploymentId: null,
  portableCandidate: validPackage ? portable : null,
  unit,
  fullRepository: current(full) ? full : null,
  acceptance: { counts: acceptance.counts, blockingIds: acceptance.blocking_ids, gates },
  simulation365: simFresh
    ? {
        status: sim.status,
        days: sim.simulatedDays ?? sim.completedDays,
        ticksPerRun: sim.actualTicksPerFullRun,
        finalHash: sim.finalHash,
        replayHash: sim.replayHash,
        resumedHash: sim.resumedHash,
        ledgerTransfers: sim.ledgerTransfers,
        unexplainedMoneyDifference: sim.unexplainedMoneyDifference,
        zeroInvariantViolations: sim.zeroInvariantViolations,
      }
    : null,
  crossEngine365:
    gates.cross_engine_365days === "PASS"
      ? parity.results.map((r) => ({
          browser: r.browser,
          status: r.status,
          hash: r.actualHash ?? r.hash,
        }))
      : null,
  lateSave: {
    gate: gates.late_save_20_roundtrips_three_engines,
    measurements:
      gates.late_save_20_roundtrips_three_engines !== "UNVERIFIED"
        ? late?.cases?.map((c) => ({
            browser: c.browser,
            integrity: c.status,
            latency: c.latencyBudget,
          }))
        : null,
  },
  performance: {
    runId: samePerf?.runId ?? null,
    status: samePerf?.status ?? "UNVERIFIED",
    environment: samePerf
      ? {
          cpu: samePerf.environment.cpus?.[0],
          browser: samePerf.environment.browser,
          viewport: samePerf.environment.viewport,
          headless: samePerf.environment.headless,
          concurrentWork: samePerf.environment.concurrentWork,
        }
      : null,
    elapsedMinutes: samePerf?.elapsedMinutes ?? null,
    continuousCheckpoints: checkpoints,
    frameMs: lastFrame ?? null,
    frameScope: checkpoints.length ? "Continuous checkpoint" : "Latest one-minute sample only",
    workerSimMs: checkpoints.at(-1)?.workerSimMs ?? sample?.simMs ?? null,
    heapSlopeMiBPerMinute: checkpoints.at(-1)?.heapSlopeMiBPerMinute ?? null,
    osFootprints: footprints,
    windowlessMetalProfile: current(metal) ? metal : null,
    downloadInitialJsGzipBytes: current(net) ? net.initialJsGzipBytes : null,
    builtRuntimeGzipBytes: manifest.totalGzipBytes,
    initialPlayableBytes: manifest.initialPlayableBytes,
  },
  legacySource: legacy,
  legacyBrowser: current(legacyBrowser) ? legacyBrowser : null,
  completedSystems: [
    "DARAMCIK: izometrik hareket, kamera, çarpışma, 14 iç mekân, telefon ve harita",
    "100 yerel, 1.000 arka plan vatandaşı; 10 meslek, işletmeler, aile, eğitim, ilişkiler ve fırsatlar",
    "Kiralama, otobüs, şeritli araç kullanma, trafik, dövüş, tanık, polis ve iade edilebilir çalıntı mal",
    "IndexedDB, 3 manuel slot, otomatik kayıt, komut günlüğü, dışa/içe aktarma ve kayıt biçimi 1–5’ten 6’ya geçiş",
  ],
  limitations: [
    "İki insanın 30’ar dakikalık ilk oynanış değerlendirmesi kullanıcı isteğiyle bekliyor.",
    "Referans PC, düşük donanım ve gerçek arka plan sekmesi ayrı test bilgisayarı gerektiriyor.",
    "14 iç mekân aynı temel planı paylaşır. Araçlar belirli şeritleri kullanır. Ses yoktur.",
    "Önceki adayın tam Chrome süreç ölçümleri 600 MiB sınırını aştı. Yeni headless-shell ölçümü farklı tarayıcıdır; referans donanım yerine geçmez.",
    "Eşzamanlı yükte yazılımsal çizim kullanılırken kaçınma ve iki sekmeli kayıt kontrolleri zamanında yanıt vermedi. Aynı sürüm Metal ile her iki tam test grubunu geçti; önceki hatalar saklandı.",
    "Yerel commit sınırı ve merge/yayın kilidi sürüyor. PR, uzak CI, doğrulanmış Cloudflare dağıtımı veya geri alma tatbikatı yok.",
  ],
  rollbackPlan:
    "İzin verilecek bir yayın öncesinde mevcut Cloudflare sürüm kimliği ve SHA kaydedilir; doğrulama başarısızsa önceki sürüme dönülür veya özellik kapatılır. Oyuncu kayıtları silinmez. Bu bir plan; canlı tatbikat yapılmadı.",
};
const counts = report.acceptance.counts,
  simReport = report.simulation365;
const lines = [
  "SOCIAL ENGINE — DARAMCIK | Yerel oynanabilir aday",
  report.generatedAt,
  "",
  "Karar: BLOCKED — PRODUCTION_NOT_DEPLOYED",
  "Branch: " + report.branch,
  "Oyun kodu: " + runtimeCommit,
  "Yerel checkpoint: " + report.localCheckpoint,
  "",
  validPackage
    ? "Paket: " +
      basename(portable.file) +
      " (" +
      portable.bytes +
      " bayt); SHA-256: " +
      portable.sha256
    : "Paket henüz bu rapora bağlanmadı.",
  "ZIP’i aç. Node.js 22 veya üzeriyle klasörde node start.mjs çalıştır. Oynamak istediğinde yazdırılan adresi kendin aç. Pencere otomatik açılmaz; npm veya internet gerekmez.",
  "Doğrulanmış yerel site rotası: " + (report.localIntegratedRoute ?? "henüz yok"),
  "",
  ...report.completedSystems,
  "",
  "Oyun testleri: " +
    (unit?.counts ? unit.counts.pass + "/" + unit.counts.tests : (unit?.status ?? "UNVERIFIED")) +
    "; tam depo: " +
    (current(full)
      ? full.counts
        ? full.counts.pass + "/" + full.counts.tests + " (" + full.status + ")"
        : full.status
      : "UNVERIFIED") +
    ". Sayılar birbirine eklenmez.",
  "Orijinal kabul matrisi: " +
    counts.PASS +
    " geçti, " +
    counts.FAIL +
    " başarısız, " +
    counts.UNVERIFIED +
    " doğrulanmadı. Ek kapılar JSON raporunda.",
  "365 günlük simülasyon: " +
    (simReport?.status ?? "UNVERIFIED") +
    (simReport?.days ? " · " + simReport.days + " gün" : "") +
    (simReport?.finalHash ? " · son hash " + simReport.finalHash : "") +
    ".",
  "Eski oyunlar: " +
    legacy?.files_compared +
    " izlenen dosyada " +
    legacy?.changed?.length +
    " değişiklik. Eski tarayıcı oturumları tarihli kanıt olarak saklanıyor.",
  current(legacyBrowser)
    ? "TC SIM: " +
      legacyBrowser.tcSim.passedRows +
      " PASS; Boardworld: " +
      legacyBrowser.boardworld.viewports.join("/") +
      " px PASS; Racon: " +
      legacyBrowser.racon.screenChecks +
      " PASS."
    : "",
  "Performans: " +
    report.performance.status +
    "; doğrulanmış kesintisiz eşikler: " +
    (checkpoints.map((c) => c.minute + " dk").join(", ") || "henüz yok") +
    ".",
  current(metal) && metal.status === "MEASURED"
    ? "Penceresiz Apple M2 Metal, 1920×1080: " +
      metal.segments.map((s) => s.actualFps.toFixed(1) + " FPS").join(" / ") +
      " (üç ayrı 20 saniyelik kesit; uzun koşu veya başka donanım sonucu değildir)."
    : "",
  "Tüm oyun kodu gzip: " +
    manifest.totalGzipBytes +
    " bayt. Süre ve bellek için kapsamı belirtilmiş ölçümler JSON raporunda.",
  "",
  ...report.limitations,
  "",
  report.rollbackPlan,
  "",
];
await mkdir(destination, { recursive: true });
for (const [name, content] of [
  ["SOCIAL_ENGINE_TEST_STATUS.json", JSON.stringify(report, null, 2) + "\n"],
  ["SOCIAL_ENGINE_DELIVERY.txt", lines.join("\n")],
]) {
  const path = resolve(destination, name);
  await writeFile(path + "." + process.pid + ".tmp", content);
  await rename(path + "." + process.pid + ".tmp", path);
}
console.log(
  JSON.stringify({
    decision: report.decision,
    counts,
    manifest: id,
    runtimeCommit,
    packageVerified: validPackage,
  }),
);
