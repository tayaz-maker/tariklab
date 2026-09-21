import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.env.QA_BASE ?? "http://127.0.0.1:8080";
const executablePath = process.env.CHROMIUM_PATH;
const viewports = [
  { name: "1280x720", width: 1280, height: 720, touch: false },
  { name: "1920x1080", width: 1920, height: 1080, touch: false },
  { name: "360x800", width: 360, height: 800, touch: true },
  { name: "390x844", width: 390, height: 844, touch: true },
];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const metrics = (frame) => frame.locator(".start-screen-shell").evaluate((node) => ({
  top: node.scrollTop,
  height: node.scrollHeight,
  client: node.clientHeight,
  root: document.querySelector("#root")?.getBoundingClientRect().height,
  inner: window.innerHeight,
  owners: [...document.querySelectorAll("*")]
    .filter((element) => {
      const style = getComputedStyle(element);
      return /(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 1;
    })
    .map((element) => element.className || element.id || element.tagName),
}));

async function boot(page) {
  await page.goto(`${base}/oyna/jitem-derin-ag`, { waitUntil: "networkidle" });
  const handle = await page.locator("iframe").elementHandle();
  const frame = await handle.contentFrame();
  await frame.locator(".start-screen-shell").waitFor();
  await wait(120);
  return { frame, iframe: page.locator("iframe") };
}

async function wheel(page, frame) {
  const shell = frame.locator(".start-screen-shell");
  await shell.hover();
  const before = await metrics(frame);
  await page.mouse.wheel(0, 640);
  await wait(180);
  const after = await metrics(frame);
  return { before, after };
}

async function pageDown(page, frame) {
  await frame.locator(".start-screen-shell button").first().focus();
  const before = await metrics(frame);
  await page.keyboard.press("PageDown");
  await wait(180);
  const after = await metrics(frame);
  return { before, after };
}

async function swipe(page, iframe, frame) {
  const box = await iframe.boundingBox();
  assert.ok(box, "embedded iframe must have a visible box");
  const client = await page.context().newCDPSession(page);
  const x = Math.round(box.x + box.width / 2);
  const y = Math.round(box.y + Math.min(420, box.height - 50));
  const before = await metrics(frame);
  await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] });
  await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y - 320, id: 1 }] });
  await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await wait(220);
  const after = await metrics(frame);
  return { before, after };
}

function assertEmbeddedOwnership(label, before, after, outerBefore, outerAfter) {
  assert.equal(Math.round(after.root), Math.round(after.inner), `${label}: embedded root must equal iframe viewport`);
  if (after.height > after.client + 1) {
    assert.equal(after.owners.length, 1, `${label}: exactly one start-screen scroll owner expected (${after.owners.join(", ")})`);
  } else {
    assert.equal(after.owners.length, 0, `${label}: a fitting screen must not create a hidden scroll owner`);
  }
  assert.equal(outerAfter, outerBefore, `${label}: outer TarikLab shell must not receive the scroll`);
}

async function assertBottomControls(frame, label) {
  const controls = frame.locator(".start-screen-shell button");
  assert.equal(await controls.count(), 5, `${label}: four roles and help must exist`);
  for (const [index, text] of ["Saha", "İdari", "Araştırmacı", "Hukuk", "Nasıl oynanır"].entries()) {
    const control = controls.nth(index);
    assert.match(await control.innerText(), new RegExp(text, "i"), `${label}: ${text} label`);
    assert.ok(await control.isVisible(), `${label}: ${text} must be visible`);
    assert.ok(await control.isEnabled(), `${label}: ${text} must be clickable`);
  }
}

const browser = await chromium.launch({ headless: true, executablePath, args: ["--no-sandbox", "--disable-gpu"] });
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      isMobile: viewport.touch,
      hasTouch: viewport.touch,
    });
    const page = await context.newPage();
    const { frame, iframe } = await boot(page);
    const label = `start ${viewport.name}`;
    const outerBefore = await page.evaluate(() => document.scrollingElement.scrollTop);
    const initial = await metrics(frame);
    assertEmbeddedOwnership(label, initial, initial, outerBefore, outerBefore);

    if (initial.height > initial.client + 1) {
      const result = await wheel(page, frame);
      const outerAfter = await page.evaluate(() => document.scrollingElement.scrollTop);
      assert.ok(result.after.top > result.before.top, `${label}: real wheel must increase iframe scrollTop`);
      assertEmbeddedOwnership(`${label} wheel`, result.before, result.after, outerBefore, outerAfter);
      await frame.locator(".start-screen-shell").evaluate((node) => { node.scrollTop = 0; });
      const keyboard = await pageDown(page, frame);
      assert.ok(keyboard.after.top > keyboard.before.top, `${label}: PageDown must increase iframe scrollTop`);
      await frame.locator(".start-screen-shell").hover();
      await page.mouse.wheel(0, 9999);
      await wait(120);
    }
    await assertBottomControls(frame, label);

    if (viewport.touch) {
      await frame.locator(".start-screen-shell").evaluate((node) => { node.scrollTop = 0; });
      const result = await swipe(page, iframe, frame);
      const outerAfter = await page.evaluate(() => document.scrollingElement.scrollTop);
      assert.ok(result.after.top > result.before.top, `${label}: real touch swipe must increase iframe scrollTop`);
      assertEmbeddedOwnership(`${label} touch`, result.before, result.after, outerBefore, outerAfter);
      for (let gesture = 0; gesture < 3; gesture += 1) await swipe(page, iframe, frame);
    }

    await frame.locator(".start-screen-shell button").first().click();
    await frame.locator(".start-screen-shell").waitFor({ state: "detached" });
    await page.reload({ waitUntil: "networkidle" });
    const returning = await (await page.locator("iframe").elementHandle()).contentFrame();
    await returning.locator(".start-screen-shell").waitFor();
    const returningLabel = `returning ${viewport.name}`;
    const returningInitial = await metrics(returning);
    const returningOuter = await page.evaluate(() => document.scrollingElement.scrollTop);
    assertEmbeddedOwnership(returningLabel, returningInitial, returningInitial, returningOuter, returningOuter);
    const returningButtons = returning.locator(".start-screen-shell button");
    assert.equal(await returningButtons.count(), 7, `${returningLabel}: continue, reset, roles and help must exist`);

    if (returningInitial.height > returningInitial.client + 1) {
      const result = await wheel(page, returning);
      const outerAfter = await page.evaluate(() => document.scrollingElement.scrollTop);
      assert.ok(result.after.top > result.before.top, `${returningLabel}: real wheel must increase iframe scrollTop`);
      assertEmbeddedOwnership(`${returningLabel} wheel`, result.before, result.after, returningOuter, outerAfter);
      await returning.locator(".start-screen-shell").hover();
      await page.mouse.wheel(0, 9999);
      await wait(120);
    }
    if (viewport.touch) {
      await returning.locator(".start-screen-shell").evaluate((node) => { node.scrollTop = 0; });
      const result = await swipe(page, page.locator("iframe"), returning);
      const outerAfter = await page.evaluate(() => document.scrollingElement.scrollTop);
      assert.ok(result.after.top > result.before.top, `${returningLabel}: real touch swipe must increase iframe scrollTop`);
      assertEmbeddedOwnership(`${returningLabel} touch`, result.before, result.after, returningOuter, outerAfter);
    }
    await returning.locator(".start-screen-shell").hover();
    await page.mouse.wheel(0, -9999);
    await wait(120);
    const continueButton = returning.getByRole("button", { name: /Devam|Continue/i });
    const resetButton = returning.getByRole("button", { name: /Baştan|From the start/i });
    assert.ok(await continueButton.isVisible(), `${returningLabel}: continue must be reachable after real scrolling`);
    assert.ok(await resetButton.isVisible(), `${returningLabel}: reset must be reachable after real scrolling`);
    await continueButton.click();
    await returning.locator(".start-screen-shell").waitFor({ state: "detached" });
    console.log(`PASS ${viewport.name}`);
    await context.close();
  }
} finally {
  await browser.close();
}

console.log("JITEM embedded start/returning scroll interaction: PASS");
