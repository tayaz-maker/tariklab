// Exercise the actual responsive drawer and category disclosure, never DOM-click
// hidden controls. Shared by TC's existing gameplay and visual acceptance suites.
export async function revealTcNavigation(page, view) {
  const target = page.locator(`.side-nav [data-view="${view}"]`);
  const toggle = page.locator('.side-nav .nav-more');
  if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
  const group = target.locator('xpath=ancestor::details[1]');
  if (await group.count() && await group.getAttribute('open') === null) await group.locator('summary').click();
  return target;
}
export async function navigateTc(page, view) {
  await (await revealTcNavigation(page, view)).click();
}
