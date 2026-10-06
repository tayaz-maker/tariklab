import assert from "node:assert/strict";

export async function deskLanguageSwitch(page, surface, lang, setup = false) {
  const snapshot = () => page.evaluate(() => JSON.stringify(Object.fromEntries(
    Object.entries(localStorage).filter(([key]) => key !== "tariklab.language"))));
  const before = await snapshot();
  const fields = () => surface.locator("#new-game-form [name]").evaluateAll(nodes => nodes.map(node => [node.name, node.value]));
  const draft = setup ? await fields() : null;
  for (const next of [lang === "tr" ? "en" : "tr", lang]) {
    await page.getByRole("button", { name: next.toUpperCase(), exact: true }).click();
    if (setup) {
      await surface.locator('#new-game-form button[type="submit"]').filter({ hasText: next === "en" ? "New life" : "Bu slota" }).waitFor();
      assert.deepEqual(await fields(), draft, "Language switch erased setup draft");
    } else {
      if (await surface.locator(".desk-search-label").count())
        await surface.locator(".desk-search-label").filter({ hasText: next === "en" ? "Search this section" : "Bu bölümde ara" }).waitFor();
      else
        await surface.locator("#advance-week").filter({ hasText: next === "en" ? "Review the week" : "Haftayı değerlendir" }).waitFor();
    }
    assert.equal(await snapshot(), before, "Language switch mutated game storage");
  }
}

export async function deskFlows(page, surface, id, lang, out) {
  if (!["tc-sim", "tc-sim-devlet"].includes(id)) return;
  const attr = id === "tc-sim" ? "data-view" : "data-screen";
  const targets = id === "tc-sim" ? ["career", "education", "market", "finance", "people", "body", "dashboard"] : ["policy", "institutions", "foreign", "regions", "society", "economy", "home"];
  const before = await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage))));
  for (const screen of targets) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await surface.locator(`.compact-nav [${attr}="${screen}"]`).click();
    const rows = surface.locator(".desk-row");
    const count = await rows.count();
    if (screen === "career") assert.equal(count, 58);
    if (screen === "education") assert.equal(count, 18);
    if (screen === "market") assert.equal(await surface.locator('[data-wealth-action="spend"]').count(), 57);
    if (screen === "policy") assert.equal(count, 48);
    if (!count) continue;
    if (screen === "career" || screen === "education") {
      const columns = await surface.locator(".detail-summary").first().evaluate(node => getComputedStyle(node).gridTemplateColumns.split(" ").length);
      assert.equal(columns, 3, "Desktop summary must stay compact rather than becoming a tall card stack");
    }
    assert.equal(await surface.locator(".desk-record").count(), count);
    await rows.last().click();
    assert.equal(await rows.last().getAttribute("aria-expanded"), "true");
    const detail = surface.locator(".desk-record:not([hidden])");
    assert.ok((await detail.innerText()).trim().length > 5);
    const search = surface.locator(".desk-search");
    const searchable = screen === "people" ? ".person-select" : ".desk-row";
    const searchableCount = await surface.locator(searchable).count();
    await search.fill("unmatched-qa-zzzz");
    assert.equal(await surface.locator(`${searchable}:not([hidden])`).count(), 0);
    assert.equal(await surface.locator(".desk-empty").isVisible(), true);
    await search.fill("");
    assert.equal(await surface.locator(`${searchable}:not([hidden])`).count(), searchableCount);
    if (screen === "people") {
      await page.setViewportSize({ width: 390, height: 844 });
      const person = surface.locator(".person-select").nth(1);
      const name = await person.locator("strong").innerText();
      await person.click();
      assert.equal(await surface.locator('.management-inspector[role="dialog"]').isVisible(), true, "A person tap must open their sheet immediately");
      assert.ok((await surface.locator(".desk-record:not([hidden])").innerText()).includes(name));
      await surface.locator(".inspector-close").press("Escape");
      assert.equal(await surface.locator(".person-select.is-current").evaluate(node => node === document.activeElement), true);
      await page.setViewportSize({ width: 1440, height: 900 });
    }
    await rows.first().click();
    await surface.evaluate(() => { document.scrollingElement.scrollTop = 0; });
    await page.screenshot({ path: `${out}/desk-${id}-${screen}-${lang}.png`, fullPage: false });
    for (const [width, height] of [[320,568],[360,800],[390,844],[430,932],[740,390],[768,1024],[820,1180],[1024,768],[1280,800],[1920,1080]]) {
      await page.setViewportSize({ width, height });
      await rows.first().click();
      assert.ok(await surface.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), `${id}/${screen}/${width}: overflow`);
      if (width <= 900) {
        const sheet = surface.locator('.management-inspector[role="dialog"]');
        assert.equal(await sheet.isVisible(), true);
        assert.equal(await sheet.getAttribute("aria-modal"), "true");
        assert.ok(await sheet.evaluate(node => node.scrollHeight >= node.clientHeight && node.getBoundingClientRect().height <= innerHeight + 1));
        if (width === 390) await page.screenshot({ path: `${out}/desk-${id}-${screen}-${lang}-sheet.png`, fullPage: false });
        await surface.locator(".inspector-close").press("Escape");
        assert.equal(await sheet.count(), 0);
        const returned = screen === "people" ? surface.locator(".person-select.is-current") : rows.first();
        assert.equal(await returned.evaluate(node => node === document.activeElement), true);
        assert.equal(await surface.locator("[inert]").count(), 0);
      }
    }
  }
  const after = await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage))));
  assert.equal(after, before, `${id}: selecting/filtering/navigating/resizing changed save data`);
  await deskLanguageSwitch(page, surface, lang);
}
