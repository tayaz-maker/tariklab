import { chromium, firefox, webkit } from "playwright";
import { build } from "esbuild";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import {
  createWorld,
  advanceMinutes,
  canonicalState,
  validateState,
} from "../../src/games/social-engine/simulation/engine.ts";

const days = Number(process.env.SE_DETERMINISM_DAYS ?? 365),
  seed = 20261103;
if (!Number.isInteger(days) || days < 1 || days > 365)
  throw new Error("SE_DETERMINISM_DAYS must be 1..365");
const selected = process.env.SE_BROWSER;
if (selected && !["chromium", "firefox", "webkit"].includes(selected))
  throw new Error("SE_BROWSER must be chromium, firefox or webkit");
const out = `artifacts/social-engine/browser-determinism${selected ? `-${selected}` : ""}`;
mkdirSync(out, { recursive: true });
const bundled = await build({
  entryPoints: ["src/games/social-engine/simulation/engine.ts"],
  bundle: true,
  format: "iife",
  globalName: "SESimulation",
  write: false,
  target: "es2022",
});
const code = bundled.outputFiles[0].text,
  bundleSha256 = createHash("sha256").update(code).digest("hex");
writeFileSync(`${out}/engine-probe.js`, code);
const expected = createWorld(seed);
advanceMinutes(expected, days * 1440);
const expectedHash = createHash("sha256").update(canonicalState(expected)).digest("hex");
const report = {
  seed,
  days,
  ticks: days * 14400,
  bundleSha256,
  expectedHash,
  expectedErrors: validateState(expected),
  results: [],
  note: "Pure simulation parity across actual JS engines; no renderer, browser FPS or UI acceptance implied.",
};
for (const [name, launcher] of Object.entries({ chromium, firefox, webkit })) {
  if (selected && selected !== name) continue;
  let browser;
  const started = performance.now();
  try {
    browser = await launcher.launch({
      headless: true,
      ...(name === "chromium"
        ? {
            executablePath:
              process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
              (process.platform === "darwin"
                ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
                : chromium.executablePath()),
          }
        : {}),
    });
    const page = await browser.newPage();
    await page.addScriptTag({ content: code });
    const result = await page.evaluate(
      ({ seed, days }) => {
        const state = globalThis.SESimulation.createWorld(seed),
          started = performance.now();
        globalThis.SESimulation.advanceMinutes(state, days * 1440);
        return {
          canonical: globalThis.SESimulation.canonicalState(state),
          errors: globalThis.SESimulation.validateState(state),
          ticks: state.tick,
          elapsedMs: performance.now() - started,
        };
      },
      { seed, days },
    );
    const actualHash = createHash("sha256").update(result.canonical).digest("hex");
    report.results.push({
      browser: name,
      version: await browser.version(),
      status: actualHash === expectedHash && result.errors.length === 0 ? "PASS" : "FAIL",
      actualHash,
      errors: result.errors,
      simulationMs: result.elapsedMs,
      elapsedMs: performance.now() - started,
    });
  } catch (error) {
    report.results.push({
      browser: name,
      status: "UNVERIFIED",
      reason: error.message,
      elapsedMs: performance.now() - started,
    });
  } finally {
    await browser?.close();
  }
  writeFileSync(`${out}/results.json`, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report.results.at(-1)));
}
if (report.results.some((result) => result.status !== "PASS")) process.exitCode = 1;
