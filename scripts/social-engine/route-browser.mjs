import { createHash } from "node:crypto";
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile, readFile } from "node:fs/promises";
const base = process.env.SE_ROUTE_BASE || "http://127.0.0.1:8096";
const out = process.env.SE_ROUTE_OUTPUT || "artifacts/social-engine/route-browser";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
    (process.platform === "darwin"
      ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
      : chromium.executablePath()),
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [],
  requests = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("response", (r) => {
  if (r.status() >= 400) requests.push({ url: r.url(), status: r.status() });
});
const report = {
  base,
  started: new Date().toISOString(),
  browser: browser.version(),
  errors,
  requests,
  status: "UNVERIFIED",
};
try {
  const expected = await readFile("public/games/social-engine/build-manifest.json");
  const served = await (await fetch(base + "/games/social-engine/build-manifest.json")).text();
  report.manifestSha256 = createHash("sha256").update(served).digest("hex");
  assert.equal(report.manifestSha256, createHash("sha256").update(expected).digest("hex"), "Built preview must serve current immutable manifest");
  const response = await page.goto(base + "/oyna/social-engine");
  assert.equal(response.status(), 200);
  const game = page.frameLocator('iframe[title="SOCIAL ENGINE"]');
  await game.getByRole("heading", { name: "Mahalleye hoş geldin." }).waitFor({ timeout: 30000 });
  await game.getByLabel("Karakter adı").fill("Rota Test");
  await game.getByRole("button", { name: "Hikâyene başla" }).click();
  await game.locator("#hud").waitFor();
  await game.getByRole("navigation", { name: "Oyun araçları" }).waitFor();
  await page.screenshot({ path: out + "/route.png" });
  assert.deepEqual(errors, []);
  assert.deepEqual(requests, []);
  report.status = "PASS";
} catch (e) {
  report.status = "FAIL";
  report.reason = e.message;
  process.exitCode = 1;
  await page.screenshot({ path: out + "/failure.png" });
} finally {
  report.finished = new Date().toISOString();
  await writeFile(out + "/results.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}
