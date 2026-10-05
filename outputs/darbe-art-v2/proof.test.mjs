import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {SCENES, renderScene} from './proof-art.mjs';

const root = new URL('../../', import.meta.url);
const read = path => readFileSync(new URL(path, root));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const manifest = JSON.parse(read('outputs/darbe-art-v2/manifest.json'));
const expected = [1, 22, 72, 82, 84, 91, 264, 269, 127, 300].map(n => `DRB-${String(n).padStart(3, '0')}`);

test('exactly ten selected real card IDs, with one original scene per ID', () => {
  const source = JSON.parse(read('public/games/darbe-h/assets/card-art/manifest.json'));
  assert.deepEqual(SCENES.map(s => s.id).sort(), expected.toSorted());
  assert.deepEqual(Object.keys(manifest.cards).sort(), expected.toSorted());
  assert.equal(new Set(SCENES.map(s => s.concept)).size, 10);
  for (const scene of SCENES) {
    assert.ok(source.cards[scene.id], scene.id);
    assert.ok(scene.concept.length > 20 && scene.mechanic.length > 15, scene.id);
  }
});

test('deterministic SVGs preserve 240x160, have unique bytes and stay within the proof budget', () => {
  let total = 0;
  const hashes = new Set();
  for (const {id} of SCENES) {
    const svg = renderScene(id), bytes = Buffer.byteLength(svg);
    assert.equal(svg, renderScene(id));
    assert.equal(read(`outputs/darbe-art-v2/scenes/${id}.svg`).toString(), svg);
    assert.match(svg, /viewBox=["']0 0 240 160["']/);
    assert.ok(bytes <= 12000, `${id}: ${bytes} bytes`);
    assert.equal(manifest.cards[id].bytes, bytes);
    assert.equal(manifest.cards[id].sha256, digest(svg));
    assert.notEqual(digest(svg), digest(read(`public/games/darbe-h/assets/card-art/${id}.svg`)), `${id}: old art reused`);
    hashes.add(digest(svg)); total += bytes;
  }
  assert.equal(hashes.size, 10);
  assert.equal(manifest.summary.totalBytes, total);
  assert.ok(total <= 100000, `${total} bytes`);
  assert.equal(manifest.summary.coverage, 10);
});

test('the art is local vector geometry without visible lettering, scripts, media or animation', () => {
  for (const {id} of SCENES) {
    const svg = renderScene(id);
    assert.doesNotMatch(svg, /<(?:script|image|foreignObject|text|animate|set|audio|video)\b|@import|on\w+\s*=|(?:href|src)=["'](?:https?:|data:)/i, id);
    assert.match(svg, /<title[\s>]/);
    assert.match(svg, /<desc[\s>]/);
    assert.match(svg, /<\/desc>\s*</, `${id}: stray non-vector text after metadata`);
    assert.doesNotMatch(svg, /\b(?:undefined|NaN)\b/, `${id}: invalid generator output`);
  }
});

test('proof leaves every original DARBE asset, rule, save, dimension and shared engine file intact', () => {
  const guard = JSON.parse(read('outputs/darbe-art-v2/protected-files.json'));
  assert.equal(Object.keys(guard.files).length, 651);
  for (const [path, sha] of Object.entries(guard.files)) assert.equal(digest(read(path)), sha, path);
  const scenes = readdirSync(new URL('./scenes/', import.meta.url)).filter(p => p.endsWith('.svg'));
  assert.deepEqual(scenes.sort(), expected.map(id => `${id}.svg`).sort());
});

test('standalone proof keeps network/media absent and clearly marks the approval boundary', () => {
  for (const path of ['index.html', 'review.html']) {
    const html = read(`outputs/darbe-art-v2/${path}`).toString();
    assert.doesNotMatch(html, /<(?:link|script|img)\b[^>]*(?:src|href)=["']https?:|<(?:audio|video)\b|\b(?:localStorage|sessionStorage|indexedDB|AudioContext|vibrate|serviceWorker)\s*[.(]/i);
    assert.match(html, /300/);
    assert.ok(Buffer.byteLength(html) < 650000, `${path}: proof package budget`);
  }
});
