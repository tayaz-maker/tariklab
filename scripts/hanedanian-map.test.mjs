import test from 'node:test';
import assert from 'node:assert/strict';
import { StrategyMap, worldAtScreen, zoomAtPoint, visibleTileBounds } from '../public/games/hanedanian/map.js';

// Input tests use the actual camera/gesture methods without a renderer or clock.
// Browser smoke separately verifies real pointer capture and canvas presentation.
function fixture() {
  const map = Object.create(StrategyMap.prototype);
  const selected = [], hovered = [];
  map.width = 800;
  map.height = 600;
  map.zoom = 1;
  map.center = { x: 24.5, y: 24.5 };
  map.pointers = new Map();
  map.gesture = null;
  map.pinch = null;
  map.selected = null;
  map.hover = null;
  map.options = { onSelect: (tile) => selected.push(tile), onHover: (tile) => hovered.push(tile) };
  map.state = { playerId: 'player', world: { size: 49, tiles: Array.from({ length: 2401 }, (_, i) => ({ x: i % 49, y: Math.floor(i / 49), terrain: 'plain' })) }, settlements: [{ id: 'home', ownerId: 'player', name: 'Sedirhisar', x: 24, y: 24 }] };
  map.canvas = { style: {}, focus() {}, setPointerCapture() {}, hasPointerCapture() { return false; }, releasePointerCapture() {}, setAttribute() {}, getBoundingClientRect() { return { left: 20, top: 40 }; } };
  map.invalidate = () => {};
  const event = (id, x, y, extra = {}) => ({ pointerId: id, clientX: x + 20, clientY: y + 40, button: 0, pointerType: 'touch', preventDefault() {}, ...extra });
  return { map, selected, hovered, event };
}

test('zoom preserves the world point under the cursor at noncentral anchors', () => {
  const view = { width: 800, height: 600, zoom: .9, center: { x: 19.5, y: 20.5 } };
  const pointer = { x: 123, y: 411 };
  const before = worldAtScreen(pointer, view);
  const result = zoomAtPoint(view, 1.9, pointer);
  const after = worldAtScreen(pointer, { ...view, ...result });
  assert.ok(Math.abs(before.x - after.x) < 1e-10);
  assert.ok(Math.abs(before.y - after.y) < 1e-10);
});

test('viewport bounds cull a 49 by 49 world and stay valid at its edge', () => {
  const view = { width: 360, height: 440, zoom: 1, center: { x: 24.5, y: 24.5 } };
  const b = visibleTileBounds(view, 49);
  assert.ok((b.maxX - b.minX + 1) * (b.maxY - b.minY + 1) < 120);
  const edge = visibleTileBounds({ ...view, center: { x: 0, y: 49 } }, 49);
  assert.equal(edge.minX, 0);
  assert.equal(edge.maxY, 48);
});

test('a stationary touch selects precisely one tile and dragging does not select', () => {
  const { map, selected, event } = fixture();
  map.pointerDown(event(1, 400, 300));
  map.pointerEnd(event(1, 400, 300), false);
  assert.equal(selected.length, 1);
  assert.deepEqual(map.selected, { x: 24, y: 24 });
  map.pointerDown(event(2, 400, 300));
  map.pointerMove(event(2, 512, 300));
  map.pointerEnd(event(2, 512, 300), false);
  assert.equal(selected.length, 1);
  assert.equal(map.center.x, 22.5);
});

test('pinch zoom is anchored, allows subsequent pan, and never produces a ghost selection', () => {
  const { map, selected, event } = fixture();
  map.pointerDown(event(1, 250, 250));
  map.pointerDown(event(2, 350, 250));
  const anchor = { ...map.pinch.anchor };
  map.pointerMove(event(1, 200, 250));
  map.pointerMove(event(2, 400, 250));
  assert.equal(map.zoom, 2);
  const after = worldAtScreen({ x: 300, y: 250 }, map.getView());
  assert.ok(Math.abs(anchor.x - after.x) < 1e-10);
  assert.ok(Math.abs(anchor.y - after.y) < 1e-10);
  map.pointerEnd(event(2, 400, 250), false);
  const beforePan = map.center.x;
  map.pointerMove(event(1, 220, 250));
  assert.ok(map.center.x < beforePan);
  map.pointerEnd(event(1, 220, 250), false);
  assert.equal(selected.length, 0);
  map.pointerDown(event(3, 400, 300));
  map.pointerEnd(event(3, 400, 300), false);
  assert.equal(selected.length, 1, 'a fresh tap after pinching must still work');
});

test('pointer cancellation and window blur cannot trigger taps or leave input stuck', () => {
  const { map, selected, event } = fixture();
  map.pointerDown(event(1, 400, 300));
  map.pointerEnd(event(1, 400, 300), true);
  assert.equal(selected.length, 0);
  assert.equal(map.pointers.size, 0);
  map.pointerDown(event(2, 400, 300));
  map.cancelGesture();
  map.pointerEnd(event(2, 400, 300), false);
  assert.equal(selected.length, 0);
  assert.equal(map.gesture, null);
  assert.equal(map.canvas.style.cursor, 'grab');
});

test('keyboard navigation is bounded, escape deselects, and home returns to the capital', () => {
  const { map, selected } = fixture();
  const key = (value) => map.keyDown({ key: value, preventDefault() {} });
  map.select(0, 0, { notify: false });
  key('ArrowLeft'); key('ArrowUp');
  assert.deepEqual(map.selected, { x: 0, y: 0 });
  key('ArrowRight');
  assert.deepEqual(map.selected, { x: 1, y: 0 });
  key('Escape');
  assert.equal(map.selected, null);
  assert.equal(selected.at(-1), null);
  key('Home');
  assert.deepEqual(map.selected, { x: 24, y: 24 });
  assert.deepEqual(map.center, { x: 24.5, y: 24.5 });
});

test('world zoom fits the entire world; camera cannot get lost outside the map', () => {
  const { map } = fixture();
  map.focus(-1000, 1000);
  assert.ok(map.center.x >= 0 && map.center.y <= 49);
  map.setZoom('world');
  assert.deepEqual(map.center, { x: 24.5, y: 24.5 });
  assert.equal(map.mode, 'world');
  const a = worldAtScreen({ x: 0, y: 0 }, map.getView());
  const b = worldAtScreen({ x: map.width, y: map.height }, map.getView());
  assert.ok(a.x <= 0 && a.y <= 0 && b.x >= 49 && b.y >= 49);
  map.zoomBy(1e10);
  assert.equal(map.zoom, 2.6);
});

test('minimap tap changes camera without selecting an underlying tile', () => {
  const { map, selected, event } = fixture();
  map.minimapRect = { x: 660, y: 440, size: 116 };
  map.pointerDown(event(1, 700, 480));
  map.pointerEnd(event(1, 700, 480), false);
  assert.equal(selected.length, 0);
  assert.ok(map.center.x < 24.5 && map.center.y < 24.5);
});

test('right-click cannot begin a drag, and tiny finger jitter remains a tap', () => {
  const { map, selected, event } = fixture();
  map.pointerDown(event(1, 300, 200, { button: 2, pointerType: 'mouse' }));
  assert.equal(map.pointers.size, 0);
  map.pointerDown(event(2, 400, 300));
  map.pointerMove(event(2, 403, 302));
  map.pointerEnd(event(2, 403, 302), false);
  assert.equal(selected.length, 1);
  assert.deepEqual(map.center, { x: 24.5, y: 24.5 });
});
