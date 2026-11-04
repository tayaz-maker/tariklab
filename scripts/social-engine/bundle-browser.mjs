import { chromium } from "playwright";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
const base = process.env.SE_BASE || "http://127.0.0.1:8097";
const out = "artifacts/social-engine/startup-network";
await mkdir(out, { recursive: true });
const manifest = JSON.parse(
  await readFile("public/games/social-engine/build-manifest.json", "utf8"),
);
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
    (process.platform === "darwin"
      ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
      : chromium.executablePath()),
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } }),
  requests = new Set(),
  errors = [];
page.on("request", (r) => {
  const url = new URL(r.url());
  if (url.pathname.startsWith("/games/social-engine/"))
    requests.add(url.pathname.replace("/games/social-engine/", ""));
});
page.on("pageerror", (e) => errors.push(e.message));
const started = performance.now();
const report = {
  status: "UNVERIFIED",
  manifestSha256: createHash("sha256").update(JSON.stringify(manifest)).digest("hex"),
  sourceDigest: manifest.sourceDigest,
  environment: {
    browser: browser.version(),
    os: process.platform,
    viewport: { width: 1920, height: 1080 },
    coldContext: true,
  },
  errors,
};
try {
  await page.goto(base + "/games/social-engine/index.html?qa=1");
  await page.getByLabel("Karakter adı").fill("Yükleme Test");
  await page.getByRole("button", { name: "Hikâyene başla" }).click();
  await page.waitForFunction(() => window.__socialEngine?.projection()?.population >= 1100, {
    timeout: 30000,
  });
  await page.waitForTimeout(600);
  const loaded = manifest.assets.filter((a) => requests.has(a.file));
  const js = loaded.filter((a) => a.file.endsWith(".js"));
  report.requestedFiles = [...requests];
  report.loadedRuntime = loaded;
  report.initialJsGzipBytes = js.reduce((n, a) => n + a.gzipBytes, 0);
  report.allGeneratedRuntimeGzipBytes = manifest.totalGzipBytes;
  report.playableAssetBytes = manifest.playableAssets
    .filter((a) => requests.has(a.file))
    .reduce((n, a) => n + a.bytes, 0);
  report.timeToPlayableWithFormMs = performance.now() - started;
  report.resourceTiming = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .filter((r) => r.name.includes("/games/social-engine/"))
      .map((r) => ({
        name: r.name.split("/games/social-engine/")[1],
        duration: r.duration,
        transferSize: r.transferSize,
        encodedBodySize: r.encodedBodySize,
        decodedBodySize: r.decodedBodySize,
      })),
  );
  assert.deepEqual(errors, []);
  assert.ok(
    requests.has(manifest.worker),
    "authoritative worker included in observed startup transfer",
  );
  assert.ok(
    report.initialJsGzipBytes <= 250 * 1024,
    `initial JS ${report.initialJsGzipBytes} exceeds250KiB`,
  );
  assert.ok(
    report.playableAssetBytes + loaded.reduce((n, a) => n + a.gzipBytes, 0) <= 3 * 1024 * 1024,
  );
  report.status = "PASS";
} catch (e) {
  report.status = "FAIL";
  report.reason = e.message;
  process.exitCode = 1;
} finally {
  report.finished = new Date().toISOString();
  await writeFile(out + "/results.json", JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify({
      status: report.status,
      initialJsGzipBytes: report.initialJsGzipBytes,
      total: report.allGeneratedRuntimeGzipBytes,
      reason: report.reason,
      errors,
    }),
  );
  await browser.close();
}
