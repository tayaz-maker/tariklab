import assert from "node:assert/strict";
export async function townBrowser(page, surface, id, lang, out) {
  if (id !== "son-kasaba") return;
  await page.setViewportSize({ width: 1440, height: 900 });
  const key = "tariklab.nextwave.son-kasaba.slot1",
    read = () => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), key);
  await surface.locator('[data-screen="agenda"]').click();
  const original = await read();
  assert.equal(original.month, 1);
  assert.equal(original.used.length, 0);
  await surface.locator('[data-command="event:road:act"]').dblclick();
  let saved = await read();
  assert.equal(saved.budget, original.budget - 14000);
  assert.equal(saved.used.length, 1);
  assert.equal(saved.pending.length, 1);
  await page.waitForTimeout(180);
  await surface.locator('[data-screen="center"]').click();
  await surface.locator('[data-command="civic:water"]').click();
  await page.waitForTimeout(180);
  await surface.locator('[data-command="civic:support"]').click();
  assert.equal((await read()).used.length, 3);
  assert.equal(await surface.locator('[data-command="civic:road"]').isDisabled(), false);
  await page.waitForTimeout(180);
  await surface.locator('[data-command="civic:road"]').click();
  assert.equal((await read()).used.length, 4);
  assert.ok((await read()).capacityUsed <= (await read()).capacityMax);
  await page.reload({ waitUntil: "networkidle" });
  surface = await (await page.locator("iframe").elementHandle()).contentFrame();
  assert.equal(await surface.locator(".slot-card").count(), 3);
  await surface.locator("#menu-continue").click();
  assert.equal((await read()).used.length, 4);
  assert.equal((await read()).pending.length, 1);
  await surface.locator("#town-advance").dblclick();
  assert.equal((await read()).month, 2);
  assert.equal((await read()).completedMonths, 1);
  await page.waitForTimeout(180);
  await surface.locator("#town-advance").click();
  assert.equal((await read()).month, 3);
  assert.equal((await read()).pending.length, 0);
  assert.equal((await read()).openCases.filter((c) => c.id === "event-road").length, 1);
  await surface.locator('[data-screen="people"]').click();
  await page.waitForTimeout(180);
  await surface.locator('[data-command="talk:cem"]').click();
  assert.ok((await read()).npcs.find((n) => n.id === "cem").memory.length);
  await surface.locator('[data-screen="groups"]').click();
  await page.waitForTimeout(180);
  await surface.locator('[data-command="coalition:workers:green"]').click();
  assert.equal((await read()).coalitions.length, 1);
  await page.waitForTimeout(180);
  await surface.locator("#town-advance").click();
  await surface.locator('[data-screen="investors"]').click();
  await page.waitForTimeout(180);
  await surface.locator('[data-command="investor:hotel:negotiate"]').click();
  assert.equal((await read()).investors.find((i) => i.id === "hotel").negotiated, true);
  await page.waitForTimeout(180);
  await surface.locator("#town-advance").click();
  await surface.locator('[data-screen="investors"]').click();
  await page.waitForTimeout(180);
  await surface.locator('[data-command="investor:hotel:accept"]').click();
  assert.equal((await read()).investors.find((i) => i.id === "hotel").status, "accepted");
  assert.equal(await surface.locator('[data-command="investor:hotel:accept"]').isDisabled(), true);
  await surface.locator('[data-screen="center"]').click();
  await page.screenshot({ path: `${out}/son-kasaba-${lang}-desktop.png`, fullPage: false });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${out}/son-kasaba-${lang}-mobile.png`, fullPage: false });
  await page.setViewportSize({ width: 1440, height: 900 });
  // A complete campaign through the same real month control, never a fixture tick.
  while (!(await read()).ended) {
    await page.waitForTimeout(160);
    await surface.locator("#town-advance").click();
  }
  saved = await read();
  assert.equal(saved.completedMonths, 24);
  assert.ok(saved.ending.id);
  assert.equal(await surface.locator("#town-advance").isDisabled(), true);
  assert.ok((await surface.locator(".final-file").innerText()).length > 100);
  await surface.locator(".save-menu > summary").click();
  await surface.locator('[data-save-slot="2"]').click();
  const slot2 = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("tariklab.nextwave.son-kasaba.slot2")),
  );
  assert.deepEqual(slot2.ending, saved.ending);
  await page.reload({ waitUntil: "networkidle" });
  surface = await (await page.locator("iframe").elementHandle()).contentFrame();
  await surface.locator("#menu-continue").click();
  assert.equal(await surface.locator("#town-advance").isDisabled(), true);
  await page.screenshot({ path: `${out}/son-kasaba-${lang}-final.png`, fullPage: false });
}
