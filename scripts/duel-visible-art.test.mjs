import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { visibleHandArtInBrowser } from "./duel-visible-art.mjs";

// Geometry/async contract tests, not browser or production evidence. The separate
// Playwright fixture exercises real layout, lazy loading and image error events.
const origin = "http://duel-art.test";
const defaults = {
  display: "block",
  visibility: "visible",
  opacity: "1",
  overflowX: "visible",
  overflowY: "visible",
};
function fixture({ count = 1, width = 80, missingImage = false, imageSize = 80, decode } = {}) {
  const node = (left, top, width, height, parentElement, styles = {}) => ({
    parentElement,
    styles: { ...defaults, ...styles },
    clientLeft: 0,
    clientTop: 0,
    clientWidth: width,
    clientHeight: height,
    getBoundingClientRect: () => ({
      left,
      top,
      right: left + width,
      bottom: top + height,
      width,
      height,
    }),
  });
  const hand = node(0, 0, width, 60, null, { overflowX: "auto" });
  hand.isConnected = true;
  const expected = [],
    images = [],
    cards = [];
  for (let i = 0; i < count; i++) {
    const uid = `card-${i}`;
    const card = node(i * 80, 0, 80, 60, hand);
    card.dataset = { card: uid };
    const well = node(i * 80, 0, 80, 60, card);
    const image = node(i * 80, 0, imageSize, Math.min(imageSize, 60), well);
    Object.assign(image, {
      src: `${origin}/${uid}.svg`,
      currentSrc: `${origin}/${uid}.svg`,
      complete: true,
      naturalWidth: 80,
      naturalHeight: 60,
      decode: decode || (() => Promise.resolve()),
    });
    card.querySelector = () => well;
    well.querySelector = () => (missingImage ? null : image);
    expected.push({ uid, id: uid, src: `/${uid}.svg`, width: 80, height: 60 });
    cards.push(card);
    images.push(image);
  }
  hand.querySelectorAll = () => cards;
  const run = (options = {}) =>
    vm.runInNewContext(`(${visibleHandArtInBrowser.toString()})(hand, options)`, {
      hand,
      options: { expected, ...options },
      innerWidth: 390,
      innerHeight: 844,
      document: { baseURI: `${origin}/` },
      URL,
      setTimeout,
      clearTimeout,
      requestAnimationFrame: (callback) => setImmediate(callback),
      getComputedStyle: (element) => element.styles,
    });
  return { run, expected, cards, images, hand };
}

test("visible delayed decode is awaited and evidence identifies the decoded card", async () => {
  let release, started;
  const decoded = new Promise((resolve) => {
    release = resolve;
  });
  const decoding = new Promise((resolve) => {
    started = resolve;
  });
  const f = fixture({
    decode: () => {
      started();
      return decoded;
    },
  });
  let returned = false;
  const result = f.run().then((value) => {
    returned = true;
    return value;
  });
  await decoding;
  assert.equal(returned, false);
  release();
  const evidence = await result;
  assert.equal(evidence.visible.length, 1);
  assert.equal(evidence.visible[0].id, "card-0");
  assert.equal(evidence.visible[0].url, `${origin}/card-0.svg`);
  assert.equal(evidence.visible[0].naturalWidth, 80);
  assert.equal(evidence.visible[0].visibleRect.width, 80);
});

test("fully ancestor-clipped art is never decoded; a one-pixel visible portion is required", async () => {
  const f = fixture({ count: 2 });
  let calls = 0;
  f.images[1].decode = () => {
    calls++;
    return Promise.reject(new Error("broken clipped image"));
  };
  assert.equal((await f.run()).visible.length, 1);
  assert.equal(calls, 0);
  f.hand.clientWidth = 81;
  await assert.rejects(f.run(), /decode failed for card-1/);
  assert.equal(calls, 1);
});

for (const [name, make, options, error] of [
  [
    "placeholder replacing image",
    () => fixture({ missingImage: true }),
    {},
    /missing image\/placeholder/,
  ],
  [
    "absent fixture card",
    () => fixture({ count: 0 }),
    { expected: [{ uid: "missing" }] },
    /expected 1 cards, found 0/,
  ],
  ["empty fixture cohort", () => fixture({ count: 0 }), {}, /expected fixture cohort is empty/],
  [
    "tiny image inside large well",
    () => fixture({ imageSize: 1 }),
    {},
    /no meaningful visible art area/,
  ],
  [
    "never resolving decode",
    () => fixture({ decode: () => new Promise(() => {}) }),
    { timeoutMs: 25 },
    /readiness timed out after 25ms/,
  ],
  ["all images offscreen", () => fixture({ width: 0 }), {}, /found 0/],
])
  test(`${name} hard-fails without placeholder success`, async () => {
    await assert.rejects(make().run(options), error);
  });

test("wrong source, natural dimensions and removed fixture UID fail", async () => {
  const source = fixture();
  source.images[0].src = `${origin}/wrong.svg`;
  await assert.rejects(source.run(), /wrong source/);
  const dimensions = fixture();
  dimensions.images[0].naturalWidth = 1;
  await assert.rejects(dimensions.run(), /invalid dimensions/);
  const identity = fixture();
  identity.cards[0].dataset.card = "wrong";
  await assert.rejects(identity.run(), /missing\/duplicate fixture card/);
});

test("replacement after decode cannot supply evidence for a stale image", async () => {
  const f = fixture();
  f.images[0].decode = async () => {
    f.cards[0].querySelector().querySelector = () => null;
  };
  await assert.rejects(f.run(), /missing image\/placeholder/);
});
