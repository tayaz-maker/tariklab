// Screenshot evidence only: do not scroll, promote lazy images, or change game state.
export async function waitForVisibleHandArt(hand, options) {
  return hand.evaluate(visibleHandArtInBrowser, { timeoutMs: 5000, ...options });
}

export async function visibleHandArtInBrowser(
  hand,
  { expected, minVisible = 1, timeoutMs = 5000 },
) {
  const fail = (message) => {
    throw new Error(`Visible hand art: ${message}`);
  };
  if (!expected?.length) fail("expected fixture cohort is empty");
  const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
  const clippedRect = (element) => {
    const rect = element.getBoundingClientRect();
    let left = Math.max(0, rect.left),
      top = Math.max(0, rect.top);
    let right = Math.min(innerWidth, rect.right),
      bottom = Math.min(innerHeight, rect.bottom);
    for (let ancestor = element; ancestor; ancestor = ancestor.parentElement) {
      const style = getComputedStyle(ancestor);
      if (style.display === "none" || style.visibility !== "visible" || Number(style.opacity) === 0)
        return null;
      const box = ancestor.getBoundingClientRect();
      if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) {
        left = Math.max(left, box.left + ancestor.clientLeft);
        right = Math.min(right, box.left + ancestor.clientLeft + ancestor.clientWidth);
      }
      if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) {
        top = Math.max(top, box.top + ancestor.clientTop);
        bottom = Math.min(bottom, box.top + ancestor.clientTop + ancestor.clientHeight);
      }
    }
    return right > left && bottom > top
      ? { left, top, width: right - left, height: bottom - top }
      : null;
  };
  const snapshot = () => {
    if (!hand.isConnected) fail("hand detached before capture");
    const cards = [...hand.querySelectorAll(":scope > .playing-card[data-card]")];
    if (cards.length !== expected.length)
      fail(`expected ${expected.length} cards, found ${cards.length}`);
    const visible = [];
    for (const wanted of expected) {
      const matches = cards.filter((card) => card.dataset.card === wanted.uid);
      if (matches.length !== 1) fail(`missing/duplicate fixture card ${wanted.uid}`);
      const well = matches[0].querySelector(".card-art");
      if (!well) fail(`missing art well for ${wanted.id}`);
      if (!clippedRect(well)) continue;
      const image = well.querySelector("img");
      if (!image) fail(`missing image/placeholder for visible ${wanted.id}`);
      const url = new URL(wanted.src, document.baseURI).href;
      if (image.src !== url || (image.currentSrc && image.currentSrc !== url))
        fail(`wrong source for ${wanted.id}: ${image.currentSrc || image.src}`);
      const visibleRect = clippedRect(image);
      if (!visibleRect) fail(`image hidden inside visible well for ${wanted.id}`);
      visible.push({ wanted, image, visibleRect });
    }
    if (visible.length < minVisible)
      fail(`expected at least ${minVisible} visible arts, found ${visible.length}`);
    if (!visible.some(({ visibleRect }) => visibleRect.width >= 32 && visibleRect.height >= 32))
      fail("no meaningful visible art area (32×32 minimum)");
    return visible;
  };
  let timer;
  try {
    return await Promise.race([
      (async () => {
        // Observe resize/layout, then require both decoding and a subsequent paint opportunity.
        await frame();
        const before = snapshot();
        await Promise.all(
          before.map(async ({ wanted, image }) => {
            try {
              await image.decode();
            } catch {
              fail(`decode failed for ${wanted.id}`);
            }
            if (
              !image.complete ||
              image.naturalWidth !== wanted.width ||
              image.naturalHeight !== wanted.height
            )
              fail(
                `invalid dimensions for ${wanted.id}: ${image.naturalWidth}×${image.naturalHeight}`,
              );
          }),
        );
        await frame();
        await frame();
        const after = snapshot();
        if (
          after.length !== before.length ||
          after.some(({ image }, i) => image !== before[i].image)
        )
          fail("visible cohort changed during capture readiness");
        return {
          expectedHand: expected.map(({ uid, id }) => ({ uid, id })),
          viewport: { width: innerWidth, height: innerHeight },
          visible: after.map(({ wanted, image, visibleRect }) => {
            if (
              !image.complete ||
              image.naturalWidth !== wanted.width ||
              image.naturalHeight !== wanted.height
            )
              fail(`image changed after decode for ${wanted.id}`);
            const rect = image.getBoundingClientRect();
            return {
              uid: wanted.uid,
              id: wanted.id,
              url: image.currentSrc || image.src,
              naturalWidth: image.naturalWidth,
              naturalHeight: image.naturalHeight,
              rendered: { width: rect.width, height: rect.height },
              visibleRect,
            };
          }),
        };
      })(),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Visible hand art: readiness timed out after ${timeoutMs}ms`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
