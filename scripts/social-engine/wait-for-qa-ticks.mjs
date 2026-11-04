// Worker yields every 500 accelerated ticks; snapshots may legitimately arrive between chunks.
// Its final validated projection is the completion signal. Never infer progress from wall time.
export async function waitForQATicks(page, count) {
  const target = await page.evaluate(async (n) => {
    const qa = window.__socialEngine;
    const tick = (await qa.state()).tick;
    qa.step(n);
    return tick + n;
  }, count);
  await page.waitForFunction(
    (expected) => {
      if (document.querySelector('[role="alertdialog"]'))
        throw Error("Simulation stopped during QA step");
      return window.__socialEngine.projection()?.tick >= expected;
    },
    target,
    { timeout: 60000 },
  );
}
