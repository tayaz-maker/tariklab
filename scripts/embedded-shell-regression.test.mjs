import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("embedded games defer portal back and language controls to /oyna shell", () => {
  const i18n = read("public/i18n/tlab-i18n.js");
  assert.match(i18n, /window\.self !== window\.top/);
  assert.match(i18n, /html\.tlab-embedded a\[href="\/"\]/);
  assert.match(i18n, /html\.tlab-embedded \[data-lang-host\]/);
  assert.match(i18n, /html\.tlab-embedded \.tlab-lang/);
  assert.match(i18n, /global-chrome:not\(:has\(\.topbar__title\)\):not\(:has\(\.topbar__tools\)\)/);
});

test("TC SIM embedded start follows the shell instead of centering in another viewport", () => {
  const css = read("public/games/tc-sim/styles.css");
  assert.match(css, /html\.embedded \.start-wrap\s*\{[^}]*min-height:\s*0;[^}]*display:\s*block;/s);
  assert.match(css, /html\.embedded \.start-wrap \.start-exit\s*\{[^}]*display:\s*none;/s);
  assert.match(read("public/games/tc-sim/js/app.js"), /classList\?\.toggle\("embedded", window\.self !== window\.top\)/);
});

test("standalone-only controls remain available outside the play shell", () => {
  assert.match(read("public/games/ihtilal/app.js"), /if \(window\.self !== window\.top\) return null;/);
  assert.match(read("public/games/bukucu/index.html"), /if \(window\.self === window\.top\)/);
  assert.match(read("public/games/hanedanian/index.html"), /classList\.toggle\("tlab-embedded", window\.self !== window\.top\)/);
});

test("outer play shell remains compact and owns the global controls", () => {
  const shell = read("src/routes/oyna.$slug.tsx");
  assert.match(shell, /flex h-dvh min-h-0 flex-col/);
  assert.match(shell, /flex h-8 shrink-0/);
  assert.match(shell, /<LanguageToggle/);
  assert.match(shell, /className="block min-h-0 w-full flex-1/);
});
