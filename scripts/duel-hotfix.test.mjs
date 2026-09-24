/**
 * Regression cover for the duel parity / viewport / navigation hotfix.
 *
 * The browser gate (scripts/duel-browser.mjs) owns the geometry assertions
 * that need a real layout. What can be checked without a browser lives here:
 * the text guards that stop nullish values reaching the player, and the
 * navigation affordances every playable game must ship.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { detailLine, joinText, localized, plain } from "../public/games/duel-core/render-safe.js";
import { labels } from "../public/games/duel-core/labels.js";

// Read the live HTML5 list so a rename or new game cannot silently escape this gate.
const catalog = readFileSync("src/lib/games.ts", "utf8");
const html5List = catalog.match(/export const HTML5_SLUGS = \[([\s\S]*?)\] as const/);
assert.ok(html5List, "canonical HTML5 game list must be readable");
const HTML5_SLUGS = [...html5List[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
assert.equal(HTML5_SLUGS.length, 18, "all current HTML5 games must be checked");

test("text guards never turn a missing value into words on screen", () => {
  for (const empty of [null, undefined, NaN, Infinity, {}, [], false, true, () => {}]) {
    assert.equal(plain(empty), "", `plain(${String(empty)})`);
    assert.equal(joinText([empty]), "", `joinText([${String(empty)}])`);
  }
  // Zero is a real value in a card game and must survive every guard.
  assert.equal(plain(0), "0");
  assert.equal(joinText([0, null, 5]), "0, 5");
  assert.equal(detailLine([0, undefined, "ATK"]), "0 · ATK");
  assert.equal(plain(-3), "-3");
});

test("localized text falls back across languages without leaking objects", () => {
  assert.equal(localized({ tr: "Tuzak", en: "Trap" }, "en"), "Trap");
  assert.equal(localized({ tr: "Tuzak" }, "en"), "Tuzak");
  assert.equal(localized({ en: "Trap" }, "tr"), "Trap");
  assert.equal(localized({}, "tr"), "");
  assert.equal(localized(null), "");
  assert.equal(localized(["a", "b"]), "");
  assert.equal(localized("düz metin"), "düz metin");
});

test("joined lists drop blanks instead of printing empty separators", () => {
  assert.equal(joinText(["a", "", "  ", "b"]), "a, b");
  assert.equal(detailLine(["SND-001", "", null]), "SND-001");
  assert.equal(joinText("not a list"), "");
});

test("the duel keeps three distinct navigation labels", () => {
  for (const lang of ["tr", "en"]) {
    const l = labels[lang];
    // `up` is one level, `menu` is the root, `back` leaves for the portal.
    // Collapsing any two of them is what made Geri and Kapat interchangeable.
    assert.ok(l.up && l.menu && l.back && l.close, `${lang}: a navigation label is missing`);
    const distinct = new Set([l.up, l.menu, l.back, l.close]);
    assert.equal(distinct.size, 4, `${lang}: navigation labels overlap (${[...distinct]})`);
  }
});

test("every playable game ships a visible way out of itself", () => {
  for (const slug of HTML5_SLUGS) {
    if (slug === "jitem-derin-ag") {
      const route = readFileSync("src/routes/oyna.$slug.tsx", "utf8");
      assert.match(route, /to="\/"/, "JITEM embedded runtime must use the outer shell exit");
      assert.match(route, /embed=1/, "JITEM must not duplicate the outer shell");
      continue;
    }
    const sources = [`public/games/${slug}/index.html`, ...extraSources(slug)];
    const found = sources.some((file) => {
      let text = "";
      try {
        text = readFileSync(file, "utf8");
      } catch {
        return false;
      }
      // Either a plain link home, or the duel shell's own portal anchor.
      return /href=["'`]\/["'`]|href: ["'`]\/["'`]/.test(text);
    });
    assert.ok(found, `${slug}: no link back out of the game`);
  }
});

test("legacy HANEDAN runtime and redirect keep a way back to the portal", () => {
  for (const file of ["public/games/hanedan/legacy.html", "public/games/hanedan/index.html"]) {
    const body = readFileSync(file, "utf8");
    assert.match(body, /href=["'`]\/["'`]|href: ["'`]\/["'`]/, `${file}: no portal exit`);
  }
});

function extraSources(slug) {
  // Games that build their chrome in script rather than in the page.
  return {
    "tc-sim": ["public/games/tc-sim/js/app.js"],
    "tc-sim-devlet": ["public/games/tc-sim-devlet/app.js"],
    "son-kasaba": ["public/games/son-kasaba/app.js"],
    apartman: ["public/games/apartman/app.js"],
    esik: ["public/games/esik/app.js"],
    "kayip-telefon": ["public/games/kayip-telefon/app.js"],
    "son-100-gun": ["public/games/son-100-gun/pov-app.js"],
    "veto-h": ["public/games/duel-core/app.js"],
    "gett-oh": ["public/games/duel-core/app.js"],
    "darbe-h": ["public/games/duel-core/app.js"],
    ihtilal: ["public/games/ihtilal/app.js"],
  }[slug] || [];
}
