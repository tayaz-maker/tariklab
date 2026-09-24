import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("Bükücü has no sound control or audio playback", () => {
  const src = readFileSync(new URL("../public/games/bukucu/index.html", import.meta.url), "utf8");
  assert.doesNotMatch(src, /AudioContext|webkitAudioContext|new Audio\(|\.mp3|\.ogg|\.wav|speechSynthesis|Ses açık|data-act": "snd"/);
});
