import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../public/games/apartman/app.js", import.meta.url), "utf8");
const games = readFileSync(new URL("../src/lib/games.ts", import.meta.url), "utf8");

test("Kapı Nöbeti desk is a courtyard with three decisions and the old public name is gone", () => {
  assert.match(app, /class="courtyard"/);
  assert.match(app, /ranked\.slice\(0, 3\)/);
  assert.match(app, /data-pane="queue"/);
  assert.match(app, /KAPI NÖBETİ/);
  assert.doesNotMatch(app, /Apartman Yöneticisi/);
  assert.match(games, /title: "Kapı Nöbeti"/);
  assert.doesNotMatch(games, /Apartman Yöneticisi/);
});
