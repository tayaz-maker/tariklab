// Product rule: no TarikLab surface plays sound, music or voice, vibrates the
// device, or autoplays media. This guards the whole shipped tree (portal source,
// every game under public/, and the built client output when present) so a
// future change cannot quietly bring any of it back.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const MEDIA = /\.(mp3|ogg|oga|wav|m4a|aac|flac|opus|mid|midi|weba|webm|mp4|m4v|mov)$/i;
const TEXT = /\.(m?js|cjs|ts|tsx|jsx|html?|css|json|webmanifest|svg)$/i;
// Real APIs and markup that make noise or buzz. React DOM's generic attribute
// table (`autoPlay` in camelCase inside bundled library code) is not a use.
const NOISE = [
  /\bAudioContext\b/,
  /\bwebkitAudioContext\b/,
  /\bOfflineAudioContext\b/,
  /\bcreateOscillator\s*\(/,
  /\bnew\s+Audio\s*\(/,
  /<audio[\s>]/i,
  /<video[\s>]/i,
  /\bspeechSynthesis\b/,
  /\bSpeechSynthesisUtterance\b/,
  /\bnavigator\s*\??\.\s*vibrate\b/,
  /\.vibrate\?*\.?\s*\(/,
  /\bautoplay\b/,
  /["']data:audio\//,
];

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".git")) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else yield path;
  }
}

const trees = ["public", "src", "server", ".output/public"]
  .map((d) => join(root, d))
  .filter((d) => existsSync(d));

test("no audio or video media files ship anywhere", () => {
  const found = [];
  for (const tree of trees)
    for (const file of walk(tree)) if (MEDIA.test(file)) found.push(relative(root, file));
  assert.deepEqual(found, []);
});

test("no sound, voice, vibration or autoplay code in shipped source", () => {
  const hits = [];
  for (const tree of trees)
    for (const file of walk(tree)) {
      if (!TEXT.test(file)) continue;
      const text = readFileSync(file, "utf8");
      for (const re of NOISE) {
        const m = text.match(re);
        if (m) hits.push(`${relative(root, file)}: ${m[0]}`);
      }
    }
  assert.deepEqual(hits, []);
});

test("the game frame does not grant autoplay", () => {
  const frame = readFileSync(join(root, "src/routes/oyna.$slug.tsx"), "utf8");
  const allow = frame.match(/allow="([^"]*)"/);
  assert.ok(allow, "iframe allow list present");
  assert.doesNotMatch(allow[1], /autoplay|microphone|camera/);
});

test("the portal has no vibration setting left", () => {
  assert.equal(existsSync(join(root, "src/lib/haptic.ts")), false);
  const panel = readFileSync(join(root, "src/components/game/me-panel.tsx"), "utf8");
  assert.doesNotMatch(panel, /haptic|Titreşim|Vibration/);
});
