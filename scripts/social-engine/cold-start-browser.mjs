// Stall the application module itself: the static character form is already interactive HTML.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium, firefox, webkit } from "playwright";
const base = process.env.SE_BASE || "http://127.0.0.1:8097";
const engine = process.env.SE_BROWSER || "chromium";
const launcher = { chromium, firefox, webkit }[engine];
assert.ok(launcher);
const out = "artifacts/social-engine/cold-start-" + engine;
await mkdir(out, { recursive: true });
const hash = (b) => createHash("sha256").update(b).digest("hex");
const current = hash(await readFile("public/games/social-engine/build-manifest.json"));
const report = {
  startedAt: new Date().toISOString(),
  status: "UNVERIFIED",
  engine,
  manifestSha256: current,
  checks: [],
  errors: [],
};
const browser = await launcher.launch({
  headless: true,
  ...(engine === "chromium" && process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
    : {}),
});
let release;
try {
  const page = await browser.newPage(),
    navigations = [];
  const response = await page.request.get(base + "/games/social-engine/build-manifest.json");
  assert.equal(hash(await response.body()), current);
  page.on("pageerror", (err) => report.errors.push(err.message));
  page.on("request", (r) => {
    if (r.isNavigationRequest()) navigations.push(r.url());
  });
  let reached;
  const held = new Promise((r) => (reached = r)),
    resume = new Promise((r) => (release = r));
  await page.route("**/app-*.js", async (r) => {
    reached();
    await resume;
    await r.continue();
  });
  await page.goto(base + "/games/social-engine/index.html", { waitUntil: "commit" });
  await held;
  const name = page.getByLabel("Karakter adı"),
    start = page.getByRole("button", { name: "Hikâyene başla" });
  assert.ok(await start.isDisabled());
  assert.ok(await page.locator("#continue").isDisabled());
  await name.fill("Ekin Deniz");
  await name.press("Enter");
  assert.equal(await name.inputValue(), "Ekin Deniz");
  assert.equal(navigations.length, 1);
  assert.ok(await page.getByText("Mahalle hazırlanıyor…").isVisible());
  report.checks.push(
    "Both actions wait for code; an early Enter retains the typed character without navigating.",
  );
  release();
  await page.waitForFunction(
    () =>
      !!document.querySelector("form")?.onsubmit &&
      !document.querySelector("[type=submit]").disabled,
  );
  assert.equal(await name.inputValue(), "Ekin Deniz");
  await start.click();
  await page.locator("#hud").waitFor({ state: "visible" });
  await page.locator("#hud").getByText("Ekin Deniz", { exact: true }).waitFor({ state: "visible" });
  assert.equal(navigations.length, 1);
  assert.ok(navigations.every((url) => !new URL(url).searchParams.has("name")));
  assert.deepEqual(report.errors, []);
  report.checks.push(
    "Resumed module starts the chosen character; no form data or second document request.",
  );
  report.status = "PASS";
} catch (e) {
  report.status = "FAIL";
  report.reason = String(e.stack || e);
  process.exitCode = 1;
} finally {
  release?.();
  await browser.close();
  report.finishedAt = new Date().toISOString();
  await writeFile(out + "/results.json", JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report));
}
