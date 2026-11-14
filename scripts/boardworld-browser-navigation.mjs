/** Drive the real navigation controls in current and frozen released clients. */
import assert from "node:assert/strict";

const areaFor = {
  dashboard: "dashboard", life: "dashboard", plan: "dashboard", work: "dashboard",
  study: "dashboard", projects: "dashboard", goals: "dashboard",
  board: "board", stories: "board", log: "board", "expansion-world": "board",
  people: "people", expansion: "people",
  wallet: "wallet", enterprise: "wallet", "expansion-finance": "wallet",
};

export async function waitForBoardworldNavigation(surface) {
  await surface.locator(".primary-nav, .game-tabs").waitFor();
}

export async function boardworldTabControl(surface, id) {
  await waitForBoardworldNavigation(surface);
  if (await surface.locator(".game-tabs").count())
    return surface.locator(`.game-tabs [data-tab="${id}"]`);
  if (id === "bag") {
    const menu = surface.locator(".utility-nav");
    if (!(await menu.locator(`[data-tab="${id}"]`).isVisible()))
      await menu.locator("summary").click();
    return menu.locator(`[data-tab="${id}"]`);
  }
  assert.ok(areaFor[id], `known Boardworld destination: ${id}`);
  const primary = surface.locator(`.primary-nav [data-tab="${areaFor[id]}"]`);
  if ((await primary.getAttribute("aria-current")) !== "page") await primary.click();
  return surface.locator(`.section-nav > [data-tab="${id}"]`);
}

export async function openBoardworldTab(surface, id) {
  const control = await boardworldTabControl(surface, id);
  await control.click();
}

export async function boardworldDestinations(surface) {
  await waitForBoardworldNavigation(surface);
  const ids = locator => locator.evaluateAll(buttons => buttons.map(button => button.dataset.tab));
  if (await surface.locator(".game-tabs").count())
    return ids(surface.locator(".game-tabs [data-tab]"));
  const primary = await ids(surface.locator(".primary-nav [data-tab]"));
  assert.deepEqual(primary, ["dashboard", "board", "people", "wallet"], "four primary areas");
  const current = surface.locator('.section-nav > [aria-current="page"]');
  const selected = await current.count() ? await current.getAttribute("data-tab") : "bag";
  const language = await surface.locator("html").getAttribute("lang");
  const labels = {
    tr: ["Kurumlar & şehirler", "Mülk & servet"],
    en: ["Institutions & cities", "Property & wealth"],
    pl: ["Instytucje i miasta", "Nieruchomości i majątek"],
  }[language];
  assert.ok(labels, `supported interface language: ${language}`);
  const destinations = [];
  for (const area of primary) {
    await surface.locator(`.primary-nav [data-tab="${area}"]`).click();
    destinations.push(...await ids(surface.locator(".section-nav > [data-tab]")));
    if (area === "board" || area === "wallet") {
      const destination = area === "board" ? "expansion-world" : "expansion-finance";
      assert.equal(await surface.locator(`.section-nav > [data-tab="${destination}"]`).innerText(),
        labels[area === "board" ? 0 : 1], `${destination} names its actual destination`);
    }
  }
  destinations.push(...await ids(surface.locator(".utility-nav [data-tab]")));
  await openBoardworldTab(surface, selected || "dashboard");
  return [...new Set(destinations)];
}
