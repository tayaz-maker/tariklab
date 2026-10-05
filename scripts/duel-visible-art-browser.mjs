import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { waitForVisibleHandArt } from "./duel-visible-art.mjs";

// Synthetic image/DOM fixture only; no game asset, network host or save mutation.
const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="60"><rect width="80" height="60" fill="gold"/></svg>';
const card = (uid, src, extra = "") =>
  `<article class="playing-card" data-card="${uid}"><span class="card-art"><img src="${src}" width="80" height="60" loading="lazy" ${extra}></span></article>`;
const expected = (uid, src = "/ready.svg") => ({ uid, id: uid, src, width: 80, height: 60 });
const html = (cards, width = 180) => `<base href="http://duel-art.test/"><style>
  body{margin:0}.hand-row{display:flex;width:${width}px;overflow-x:auto;gap:0}
  .playing-card{flex:0 0 80px;width:80px}.card-art{display:block;width:80px;height:60px;overflow:hidden}
  img{display:block;width:80px;height:60px}
  </style><section class="hand-row">${cards}</section>`;

export async function runVisibleArtFixtures(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const results = [];
  try {
    const setup = async (markup, routeHandler) => {
      const page = await context.newPage();
      await page.route(
        "http://duel-art.test/**",
        routeHandler || ((route) => route.fulfill({ contentType: "image/svg+xml", body: svg })),
      );
      await page.setContent(markup, { waitUntil: "domcontentloaded" });
      return page;
    };
    // Hold the actual image response until we prove readiness has not returned.
    let release;
    const requested = new Promise((resolve) => {
      release = resolve;
    });
    let page = await setup(html(card("late", "/late.svg")), (route) => release(route));
    let complete = false;
    const late = waitForVisibleHandArt(page.locator(".hand-row"), {
      expected: [expected("late", "/late.svg")],
    }).then((value) => {
      complete = true;
      return value;
    });
    const held = await Promise.race([
      requested,
      late.then(() => assert.fail("undecoded art passed")),
    ]);
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
    assert.equal(complete, false, "capture must wait for the delayed visible response/decode");
    await held.fulfill({ contentType: "image/svg+xml", body: svg });
    const decoded = await late;
    assert.equal(decoded.visible[0].naturalWidth, 80);
    assert.equal(decoded.visible[0].id, "late");
    assert.match(decoded.visible[0].url, /\/late\.svg$/);
    results.push("delayed visible response waits and records decoded art");
    await page.close();

    page = await setup(
      html(
        card("broken", "/broken.svg", "onerror=\"this.replaceWith(document.createTextNode('◈'))\""),
      ),
      (route) => route.fulfill({ status: 404, body: "broken" }),
    );
    await page.waitForFunction(() => document.querySelector(".card-art").textContent === "◈");
    await assert.rejects(
      waitForVisibleHandArt(page.locator(".hand-row"), {
        expected: [expected("broken", "/broken.svg")],
      }),
      /missing image\/placeholder/,
    );
    results.push("real onerror replacement cannot pass as an empty image cohort");
    await page.close();

    page = await setup(html(card("broken", "/broken.svg")), (route) =>
      route.fulfill({ contentType: "image/svg+xml", body: "not an image" }),
    );
    await assert.rejects(
      waitForVisibleHandArt(page.locator(".hand-row"), {
        expected: [expected("broken", "/broken.svg")],
      }),
      /decode failed/,
    );
    results.push("visible undecodable bytes fail");
    await page.close();

    page = await setup(html(""));
    await assert.rejects(
      waitForVisibleHandArt(page.locator(".hand-row"), { expected: [expected("absent")] }),
      /expected 1 cards, found 0/,
    );
    await assert.rejects(
      waitForVisibleHandArt(page.locator(".hand-row"), { expected: [] }),
      /expected fixture cohort is empty/,
    );
    results.push("absent cards and empty expected cohort fail");
    await page.close();

    page = await setup(html(card("wrong", "/other.svg")));
    await assert.rejects(
      waitForVisibleHandArt(page.locator(".hand-row"), { expected: [expected("wrong")] }),
      /wrong source/,
    );
    await assert.rejects(
      waitForVisibleHandArt(page.locator(".hand-row"), { expected: [expected("missing")] }),
      /missing\/duplicate fixture card/,
    );
    results.push("wrong source and fixture UID fail");
    await page.close();

    page = await setup(html(card("visible", "/ready.svg") + card("clipped", "/offscreen.svg"), 80));
    await page.locator('[data-card="clipped"] img').evaluate((image) => {
      image.decode = () => {
        window.offscreenDecodeCalled = true;
        return Promise.reject(new Error("must stay lazy"));
      };
    });
    const cohort = [expected("visible"), expected("clipped", "/offscreen.svg")];
    const visible = await waitForVisibleHandArt(page.locator(".hand-row"), { expected: cohort });
    assert.deepEqual(
      visible.visible.map(({ uid }) => uid),
      ["visible"],
    );
    assert.equal(await page.evaluate(() => Boolean(window.offscreenDecodeCalled)), false);
    assert.equal(await page.locator('[data-card="clipped"] img').getAttribute("loading"), "lazy");
    // A one-pixel intersection makes the second art required, even though it is mostly clipped.
    await page.locator(".hand-row").evaluate((hand) => {
      hand.style.width = "81px";
    });
    await assert.rejects(
      waitForVisibleHandArt(page.locator(".hand-row"), { expected: cohort }),
      /decode failed for clipped/,
    );
    results.push("ancestor-clipped lazy art ignored; partially visible art required");
    await page.close();

    page = await setup(html(card("tiny", "/ready.svg")));
    await page.locator("img").evaluate((image) => {
      image.style.width = "1px";
      image.style.height = "1px";
    });
    await assert.rejects(
      waitForVisibleHandArt(page.locator(".hand-row"), { expected: [expected("tiny")] }),
      /no meaningful visible art area/,
    );
    results.push("large empty well with a one-pixel image cannot pass");
    await page.close();

    page = await setup(html(card("never", "/ready.svg")));
    await page.locator("img").evaluate((image) => {
      image.decode = () => new Promise(() => {});
    });
    await assert.rejects(
      waitForVisibleHandArt(page.locator(".hand-row"), {
        expected: [expected("never")],
        timeoutMs: 100,
      }),
      /readiness timed out after 100ms/,
    );
    results.push("never-resolving decode hard-fails within the explicit bound");
    await page.close();

    page = await setup(html(card("below", "/ready.svg")));
    await page.locator(".hand-row").evaluate((hand) => {
      hand.style.marginTop = "900px";
    });
    await assert.rejects(
      waitForVisibleHandArt(page.locator(".hand-row"), { expected: [expected("below")] }),
      /found 0/,
    );
    results.push("zero viewport-visible art cannot pass");
    await page.close();
    return results;
  } finally {
    await context.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ["--no-sandbox"],
  });
  try {
    console.log("DUEL_VISIBLE_ART_PASS", JSON.stringify(await runVisibleArtFixtures(browser)));
  } finally {
    await browser.close();
  }
}
