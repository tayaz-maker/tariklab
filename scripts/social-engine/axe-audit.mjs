import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { chromium } from "playwright";
const base = process.env.SE_BASE || "http://127.0.0.1:8097";
const out = "artifacts/social-engine/axe";
await mkdir(out, { recursive: true });
const axe = await readFile(
  process.env.SE_AXE_PATH || "../qa-deps/node_modules/axe-core/axe.min.js",
  "utf8",
);
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
    (process.platform === "darwin"
      ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
      : chromium.executablePath()),
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const manifestText = await (await fetch(base + "/games/social-engine/build-manifest.json")).text();
const report = {
  criterion: "SE-056",
  base,
  browser: await browser.version(),
  manifest: JSON.parse(manifestText),
  manifestSha256: createHash("sha256").update(manifestText).digest("hex"),
  axeSha256: createHash("sha256").update(axe).digest("hex"),
  started: new Date().toISOString(),
  checks: [],
  scans: [],
  errors,
  limitations: [
    "Automated Axe results and keyboard tests do not establish full screen-reader access to the visual game world.",
    "Axe color-contrast incomplete findings are recorded as unverified; screenshots require visual review. This report PASS applies to SE-056 keyboard focus plus detected Axe violations, not full WCAG compliance.",
  ],
};
async function check(name, fn) {
  try {
    const detail = await fn();
    report.checks.push({ name, status: "PASS", detail });
  } catch (e) {
    report.checks.push({ name, status: "FAIL", reason: e.message });
  }
}
async function scan(name) {
  const result = await page.evaluate(async () =>
    globalThis.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
    }),
  );
  report.scans.push({
    name,
    axeVersion: result.testEngine.version,
    violations: result.violations,
    incomplete: result.incomplete,
    passes: result.passes.map((p) => p.id),
  });
  await page.screenshot({ path: out + "/" + name + ".png" });
}
async function focusInfo() {
  return page.evaluate(() => {
    const e = document.activeElement,
      s = getComputedStyle(e),
      r = e.getBoundingClientRect();
    return {
      tag: e.tagName,
      id: e.id,
      name: e.getAttribute("name"),
      text: e.textContent?.trim().slice(0, 100),
      inDialog: !!e.closest("[role=dialog]"),
      focusVisible: e.matches(":focus-visible"),
      outline: s.outlineStyle,
      width: parseFloat(s.outlineWidth),
      color: s.outlineColor,
      rect: { x: r.x, y: r.y, width: r.width, height: r.height },
    };
  });
}
async function assertFocus() {
  const f = await focusInfo();
  assert.equal(f.focusVisible, true);
  assert.ok(f.width >= 2 && f.outline !== "none");
  assert.ok(f.rect.width > 0 && f.rect.height > 0);
  return f;
}
async function modalKeyboard(name, key) {
  await page.keyboard.press(key);
  await page.getByRole("dialog").waitFor();
  await check(name + " starts with visible close focus", async () => {
    const f = await assertFocus();
    assert.equal(f.id, "close-panel");
    return f;
  });
  await check(name + " Shift+Tab wraps to last control", async () => {
    await page.keyboard.press("Shift+Tab");
    const last = await page.locator("#panel").evaluate((e) => {
      const a = [...e.querySelectorAll('button:not(:disabled),input,select,[tabindex="0"]')];
      return document.activeElement === a.at(-1);
    });
    assert.equal(last, true);
    return assertFocus();
  });
  await check(name + " Tab wraps to first control", async () => {
    await page.keyboard.press("Tab");
    assert.equal((await assertFocus()).id, "close-panel");
  });
  await scan(name);
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "hidden" });
}
try {
  await page.goto(base + "/games/social-engine/index.html?qa=1");
  await page.getByRole("heading", { name: "Mahalleye hoş geldin." }).waitFor();
  await page.addScriptTag({ content: axe });
  await check("Character form keyboard order and visible focus", async () => {
    const order = [];
    for (let i = 0; i < 9; i++) {
      await page.keyboard.press("Tab");
      order.push(await assertFocus());
    }
    assert.deepEqual(
      order.slice(0, 7).map((x) => x.name),
      ["name", "background", "appearance", "body", "mind", "social", "discipline"],
    );
    return order;
  });
  await scan("intro");
  await page.locator("[name=name]").fill("Deniz Erişim");
  await page.getByRole("button", { name: "Hikâyene başla" }).focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => globalThis.__socialEngine?.projection()?.population === 1100);
  await page.evaluate(() => document.activeElement?.blur());
  await scan("world");
  await modalKeyboard("inventory", "KeyI");
  await modalKeyboard("map", "KeyM");
  await modalKeyboard("phone", "KeyP");
  await modalKeyboard("pause", "Escape");
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor();
  await check("Pause settings reached entirely by Tab and Enter", async () => {
    for (let i = 0; i < 3; i++) await page.keyboard.press("Tab");
    assert.equal((await focusInfo()).id, "settings");
    await page.keyboard.press("Enter");
    await page.locator("#ui-scale").waitFor();
    await page.keyboard.press("Tab");
    assert.equal((await assertFocus()).id, "ui-scale");
    await page.keyboard.press("Digit1");
    assert.equal(await page.locator("#ui-scale").inputValue(), "125");
    return await focusInfo();
  });
  await scan("settings");
  await check("Settings checkbox keyboard activation", async () => {
    await page.keyboard.press("Tab");
    assert.equal((await assertFocus()).id, "reduced");
    await page.keyboard.press("Space");
    assert.equal(await page.locator("#reduced").isChecked(), true);
  });
  await page.keyboard.press("Escape");
  await check("HUD focused trigger survives refresh and regains focus after close", async () => {
    await page.locator("[data-panel=map]").focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    await page.waitForTimeout(1000);
    assert.equal(
      await page.evaluate(() => document.activeElement?.getAttribute("data-panel")),
      "map",
    );
    await page.keyboard.press("Enter");
    await page.getByRole("dialog").waitFor();
    await page.keyboard.press("Escape");
    assert.equal(
      await page.evaluate(() => document.activeElement?.getAttribute("data-panel")),
      "map",
    );
    return assertFocus();
  });
} catch (e) {
  report.checks.push({ name: "Audit execution", status: "FAIL", reason: e.stack });
} finally {
  report.status =
    report.checks.every((x) => x.status === "PASS") &&
    report.scans.every((x) => x.violations.length === 0) &&
    errors.length === 0
      ? "PASS"
      : "FAIL";
  report.finished = new Date().toISOString();
  await writeFile(out + "/results.json", JSON.stringify(report, null, 2));
  await context.tracing.stop({ path: out + "/trace.zip" });
  await context.close();
  await browser.close();
  console.log(
    JSON.stringify(
      {
        status: report.status,
        checks: report.checks,
        scans: report.scans.map((x) => ({
          name: x.name,
          violations: x.violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            nodes: v.nodes.length,
          })),
          incomplete: x.incomplete.length,
        })),
        errors,
      },
      null,
      2,
    ),
  );
  if (report.status !== "PASS") process.exitCode = 1;
}
