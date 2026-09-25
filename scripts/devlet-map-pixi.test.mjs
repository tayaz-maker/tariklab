// Unit tests for the TC SIM: DEVLET PixiJS map overlay (maps-pixi.js).
// This game rebuilds its whole screen via `document.body.innerHTML = ...`
// on every render (see draw() in app.js), so the overlay approach differs
// from HANEDANIAN's subclassed canvas: everything here is exercised through
// a fake DOM/PIXI fixture that models that rebuild pattern -- no real
// browser or WebGL context. Real render output (position sync over the
// live svg, hover/focus highlighting) is verified separately by browser QA.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

test('maps-pixi.js never statically imports pixi-adapter.js -- it is a deliberately optional, opportunistically-cached dependency (public/sw.js MODULE_GAME_PATHS is network-first, not a mandatory precache list)', () => {
  const src = readFileSync(new URL('../public/games/tc-sim-devlet/maps-pixi.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /^\s*import\s+.*pixi-adapter\.js/m, 'pixi-adapter.js must only be reached via a dynamic import()');
  assert.match(src, /import\(['"]\.\.\/shared\/pixi-adapter\.js['"]\)/, 'pixi-adapter.js must still be loaded, just dynamically');
});

test('maps-pixi.js consumes the shared render models instead of recomputing region/axis data itself', () => {
  const src = readFileSync(new URL('../public/games/tc-sim-devlet/maps-pixi.js', import.meta.url), 'utf8');
  assert.match(src, /import \{ regionsRenderModel, foreignRenderModel \} from "\.\/maps\.js"/);
});

test('supportsDevletPixi() degrades to false instead of throwing when pixi-adapter.js cannot be loaded (Node has no window/WebGL)', async () => {
  const { supportsDevletPixi } = await import('../public/games/tc-sim-devlet/maps-pixi.js');
  assert.equal(await supportsDevletPixi(), false);
});

test('syncDevletMapOverlay() is fire-and-forget -- never throws or returns a rejected promise synchronously, even before any DOM/window exists to fail against', async () => {
  const { syncDevletMapOverlay } = await import('../public/games/tc-sim-devlet/maps-pixi.js');
  const fakeRoot = { querySelector: () => null };
  assert.doesNotThrow(() => syncDevletMapOverlay(fakeRoot, null, { region: null, axis: null, metric: 'satisfaction' }));
});

test('app.js calls syncDevletMapOverlay after every draw(), on both the front-menu path and the in-campaign path, and never inside the map svgs it builds', () => {
  const src = readFileSync(new URL('../public/games/tc-sim-devlet/app.js', import.meta.url), 'utf8');
  assert.match(src, /import \{ syncDevletMapOverlay \} from "\.\/maps-pixi\.js"/);
  const calls = src.match(/syncDevletMapOverlay\(/g) || [];
  assert.equal(calls.length, 2, 'expected one call on the front-menu (no-state) path and one on the in-campaign draw path');
});

test('the overlay never touches game state, save data or the shared bootGame session -- only camera-free DOM plumbing', () => {
  const src = readFileSync(new URL('../public/games/tc-sim-devlet/maps-pixi.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /localStorage/);
  assert.doesNotMatch(src, /SaveManager|\.save\(|createGame\(|\bsession\.\w/, 'the overlay must never call into the game session -- it only reads the state object app.js already passes in');
});

test('the overlay repositions/resizes itself on window resize, not only on the next draw() -- a bare viewport resize with no game interaction never calls draw(), so without this the canvas stays stuck at its last-measured pixel size and can overflow a narrower viewport (the real bug CI\'s sitewide-responsive.mjs caught: overlay sized at 390px, then the viewport shrank to 320px with no click in between, and the canvas never shrank with it)', () => {
  const src = readFileSync(new URL('../public/games/tc-sim-devlet/maps-pixi.js', import.meta.url), 'utf8');
  assert.match(src, /addEventListener\(["']resize["']/, 'must listen for window resize and reposition/resize the overlay independent of draw()');
});
