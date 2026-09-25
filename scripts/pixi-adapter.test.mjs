// Unit tests for the shared PixiJS render adapter (public/games/shared/pixi-adapter.js).
// Everything here is dependency-injected -- no real browser/WebGL/DOM is needed
// or used; that lets it run in Node like every other script test.
import assert from "node:assert/strict";
import test from "node:test";
import { __resetPixiCacheForTests, loadPixi, prefersReducedMotion, supportsPixi } from "../public/games/shared/pixi-adapter.js";

function fakeWin({ hasWebGL2 = true, hasWebGL = true, reducedMotion = false } = {}) {
  return {
    WebGL2RenderingContext: hasWebGL2 ? function () {} : undefined,
    WebGLRenderingContext: hasWebGL ? function () {} : undefined,
    matchMedia: (q) => ({ matches: /reduce/.test(q) ? reducedMotion : false }),
  };
}

function fakeCanvas({ contextOk = true, throws = false } = {}) {
  return () => {
    if (throws) throw new Error("canvas creation blocked");
    return {
      getContext: (kind) => (contextOk && /webgl/.test(kind) ? { kind } : null),
    };
  };
}

test("supportsPixi: no window at all -> unsupported", () => {
  assert.equal(supportsPixi({ win: undefined }), false);
});

test("supportsPixi: WebGL context APIs absent -> unsupported", () => {
  const win = fakeWin({ hasWebGL2: false, hasWebGL: false });
  assert.equal(supportsPixi({ win, createCanvas: fakeCanvas() }), false);
});

test("supportsPixi: APIs present but getContext returns null for both webgl2 and webgl -> unsupported", () => {
  const win = fakeWin();
  assert.equal(supportsPixi({ win, createCanvas: fakeCanvas({ contextOk: false }) }), false);
});

test("supportsPixi: canvas creation throwing (locked-down environment) -> unsupported, no throw", () => {
  const win = fakeWin();
  assert.doesNotThrow(() => supportsPixi({ win, createCanvas: fakeCanvas({ throws: true }) }));
  assert.equal(supportsPixi({ win, createCanvas: fakeCanvas({ throws: true }) }), false);
});

test("supportsPixi: real WebGL context available -> supported", () => {
  const win = fakeWin();
  assert.equal(supportsPixi({ win, createCanvas: fakeCanvas() }), true);
});

test("supportsPixi: getContext itself throwing (e.g. a hardened browser) -> unsupported, no throw", () => {
  const win = fakeWin();
  const createCanvas = () => ({
    getContext() {
      throw new Error("blocked");
    },
  });
  assert.doesNotThrow(() => supportsPixi({ win, createCanvas }));
  assert.equal(supportsPixi({ win, createCanvas }), false);
});

test("prefersReducedMotion reflects the media query and never throws without a window", () => {
  assert.equal(prefersReducedMotion({ win: fakeWin({ reducedMotion: true }) }), true);
  assert.equal(prefersReducedMotion({ win: fakeWin({ reducedMotion: false }) }), false);
  assert.equal(prefersReducedMotion({ win: undefined }), false);
});

test("loadPixi: memoizes a successful load -- the importer runs once even across many calls", async () => {
  __resetPixiCacheForTests();
  let calls = 0;
  const fakeModule = { Application: class {} };
  const importer = async (url) => {
    calls += 1;
    assert.match(url, /^\/vendor\/pixi\/pixi-[\d.]+\.min\.mjs$/);
    return fakeModule;
  };
  const a = await loadPixi({ importer });
  const b = await loadPixi({ importer });
  assert.equal(a, fakeModule);
  assert.equal(b, fakeModule);
  assert.equal(calls, 1);
});

test("loadPixi: a failed import resolves to null instead of throwing, and can be retried", async () => {
  __resetPixiCacheForTests();
  let calls = 0;
  const importer = async () => {
    calls += 1;
    if (calls === 1) throw new Error("network error");
    return { Application: class {} };
  };
  const first = await loadPixi({ importer });
  assert.equal(first, null);
  const second = await loadPixi({ importer });
  assert.ok(second);
  assert.equal(calls, 2);
});
