import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { createStaticGameServer } from "/workspace/tariklab/scripts/static-game-server.mjs";
import { cityFixture } from "/workspace/tariklab/scripts/tc-sim-city-fixture.mjs";

async function pinsFit(page, name) {
  const boxes = await page.evaluate(() => {
    const map = document.querySelector(".location-map").getBoundingClientRect();
    const pins = [...document.querySelectorAll(".location-pin")].map((node) => {
      const rect = node.getBoundingClientRect();
      return { id: node.dataset.locationSelect, x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom };
    });
    return { map: { x: map.x, y: map.y, right: map.right, bottom: map.bottom }, pins };
  });
  const overlap = (a, b) => a.x < b.right - 2 && b.x < a.right - 2 && a.y < b.bottom - 2 && b.y < a.bottom - 2;
  for (let i = 0; i < boxes.pins.length; i += 1) {
    const pin = boxes.pins[i];
    assert.ok(pin.x >= boxes.map.x - 1 && pin.right <= boxes.map.right + 1, `${name} ${pin.id} outside x ${JSON.stringify(pin)}`);
    assert.ok(pin.y >= boxes.map.y - 1 && pin.bottom <= boxes.map.bottom + 1, `${name} ${pin.id} outside y`);
    for (let j = i + 1; j < boxes.pins.length; j += 1) {
      assert.equal(overlap(pin, boxes.pins[j]), false, `${name} ${pin.id} overlaps ${boxes.pins[j].id}`);
    }
  }
}

const out = "/workspace/screenshots/tc-sim-wave-b";
mkdirSync(out, { recursive: true });
const server = createStaticGameServer("/workspace/tariklab/public");
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell",
  args: ["--no-sandbox"],
});
const errors = [];
try {
  for (const [name, width, height] of [["desktop", 1280, 800], ["mobile", 390, 844]]) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: width < 500, hasTouch: width < 500 });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(`${name}:${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(`${name}:${message.text()}`);
    });
    await context.addInitScript((state) => {
      localStorage.setItem("tariklab::tc-sim:1", JSON.stringify(state));
      localStorage.setItem("tariklab::tc-sim:active", "1");
      localStorage.setItem("tariklab.language", "tr");
    }, cityFixture());
    await page.goto(`${origin}/games/tc-sim/index.html`, { waitUntil: "networkidle" });
    await page.locator("#continue-game").click();
    const home = page.locator('.side-nav [data-view="home"]');
    if (!(await home.isVisible())) await page.locator(".side-nav .nav-more").click();
    await home.click();
    await page.locator(".location-map").scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => localStorage.getItem("tariklab::tc-sim:1"));
    const plates = await page.locator(".map-plate").evaluateAll((nodes) =>
      nodes.map((node) => ({ src: node.getAttribute("src"), w: node.naturalWidth, h: node.naturalHeight })),
    );
    assert.deepEqual(plates.map((plate) => plate.src), [
      "./assets/map/quarter-ridge.jpg",
      "./assets/map/quarter-shore.jpg",
      "./assets/map/quarter-edge.jpg",
    ]);
    assert.ok(plates.every((plate) => plate.w >= 900 && plate.h >= 600), JSON.stringify(plates));
    const quarter = await page.locator(".location-quarter").evaluate((node) => ({
      src: node.getAttribute("src"),
      w: node.naturalWidth,
    }));
    assert.equal(quarter.src, "./assets/map/quarter-shore.jpg");
    assert.ok(quarter.w >= 900);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 1, `${name} overflow ${overflow}`);
    const pins = await page.locator("[data-location-select]").evaluateAll((nodes) => nodes.map((node) => node.dataset.locationSelect));
    assert.deepEqual(pins, ["sisli", "kadikoy", "uskudar", "bayrampasa", "avcilar"]);
    for (const id of ["sisli", "avcilar", "kadikoy"]) {
      await page.locator(`[data-location-select="${id}"]`).click();
      assert.equal(await page.locator(`[data-location-select="${id}"]`).getAttribute("aria-pressed"), "true");
    }
    assert.equal(await page.locator(".location-quarter").getAttribute("src"), "./assets/map/quarter-shore.jpg");
    assert.match(await page.locator(".location-map").innerText(), /Sırt/);
    assert.match(await page.locator(".location-map").innerText(), /Kıyı/);
    assert.match(await page.locator(".location-map").innerText(), /Çeper/);
    assert.doesNotMatch(await page.locator(".location-map").innerText(), /Şişli|Bayrampaşa|Avcılar|Üsküdar|Kadıköy/);
    await page.locator('[data-location-city="ankara"]').click();
    const ankaraPlates = await page.locator(".map-plate").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("src")));
    assert.deepEqual(ankaraPlates, ["./assets/map/city-ankara-west.jpg", "./assets/map/city-ankara-east.jpg"]);
    assert.match(await page.locator(".location-map").innerText(), /Batıkent/);
    assert.match(await page.locator(".location-map").innerText(), /Kızılay/);
    await pinsFit(page, `${name}-ankara`);
    await page.locator(".location-map").screenshot({ path: `${out}/${name}-ankara.png` });
    await page.locator('[data-location-city="izmir"]').click();
    const izmirPlates = await page.locator(".map-plate").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("src")));
    assert.deepEqual(izmirPlates, ["./assets/map/city-izmir-konak.jpg", "./assets/map/city-izmir-bornova.jpg"]);
    assert.match(await page.locator(".location-map").innerText(), /Konak/);
    assert.match(await page.locator(".location-map").innerText(), /Bornova/);
    await pinsFit(page, `${name}-izmir`);
    await page.locator(".location-map").screenshot({ path: `${out}/${name}-izmir.png` });
    assert.equal(await page.locator("[data-location-city]").count(), 3);
    await page.locator('[data-location-city="istanbul"]').click();
    assert.equal(await page.evaluate(() => localStorage.getItem("tariklab::tc-sim:1")), before, `${name} map browsing mutated the save`);
    await pinsFit(page, `${name}-istanbul`);
    await page.locator(".location-map").screenshot({ path: `${out}/${name}-map.png` });
    await page.locator(".location-quarter").screenshot({ path: `${out}/${name}-quarter.png` });
    await page.reload({ waitUntil: "networkidle" });
    if (await page.locator("#continue-game").count()) await page.locator("#continue-game").click();
    const homeAgain = page.locator('.side-nav [data-view="home"]');
    if (!(await homeAgain.isVisible()) && (await page.locator(".side-nav .nav-more").count())) {
      await page.locator(".side-nav .nav-more").click();
    }
    await homeAgain.click();
    assert.equal(await page.locator(".map-plate").count(), 3);
    assert.equal(await page.evaluate(() => localStorage.getItem("tariklab::tc-sim:1")), before, `${name} reload changed the save`);
    const market = page.locator('.side-nav [data-view="market"]');
    if (!(await market.isVisible())) await page.locator(".side-nav .nav-more").click();
    await market.click();
    await page.locator('[data-market-shelf="gece"]').click();
    await page.waitForFunction(() => document.body.innerText.includes("Kaçak bahse gir") && document.body.innerText.includes("Kumar masasına otur") && document.body.innerText.includes("Sert içki gecesi"));
    assert.doesNotMatch(await page.locator("body").innerText(), /Oturulan ev|Yasadışı bahis|Yasa dışı esrar/);
    const marketOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(marketOverflow <= 1, `${name} market overflow ${marketOverflow}`);
    await page.screenshot({ path: `${out}/${name}-gece.png`, fullPage: true });
    await context.close();
    console.log(name, "ok", "overflow", overflow);
  }
} finally {
  await browser.close();
  server.close();
}
if (errors.length) {
  console.error(errors);
  process.exit(1);
}
console.log("browser smoke ok");
