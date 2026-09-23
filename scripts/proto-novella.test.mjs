// Interactive novella prototype: structure, meaningful choices, saves, reader settings.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PASSAGES } from "../public/games/proto-novella/story.js";
import * as R from "../public/games/proto-novella/rules.js";

function allRuns() {
  const out = [];
  const walk = (r) => {
    if (R.finished(r)) return out.push(r);
    const opts = R.options(r).filter((o) => o.ok);
    assert.ok(opts.length > 0, `dead end at ${R.current(r)}`);
    for (const o of opts) {
      const next = structuredClone(r);
      assert.ok(R.choose(next, o.id));
      walk(next);
    }
  };
  walk(R.createRead());
  return out;
}

test("every passage is bilingual, balanced and reachable; no dead ends", () => {
  const seen = new Set();
  for (const r of allRuns()) for (const id of r.path) seen.add(id);
  for (const [id, p] of Object.entries(PASSAGES)) {
    assert.ok(seen.has(id), `${id} unreachable`);
    assert.equal(p.tr.length, p.en.length, `${id} TR/EN paragraph count`);
    assert.ok(p.heading.tr && p.heading.en && p.stamp.tr && p.stamp.en);
    for (const c of p.choices || [])
      assert.ok(c.tr && c.en && (c.next === "fork" || PASSAGES[c.next]));
    for (const v of Object.values(p.variants || {})) assert.ok(v.tr && v.en);
  }
});

test("start, exactly three choices and one of exactly two endings on every path", () => {
  const runs = allRuns();
  const endings = new Set();
  for (const r of runs) {
    assert.equal(r.took.length, 3);
    assert.equal(r.path[0], "start");
    endings.add(R.current(r));
  }
  assert.deepEqual([...endings].sort(), ["end-folder", "end-record"]);
  assert.equal(Object.values(PASSAGES).filter((p) => p.ending).length, 2);
});

test("choices are meaningful: each one changes what follows or how it can end", () => {
  const runs = allRuns();
  const key = (r) => r.took.join(">");
  const endOf = Object.fromEntries(runs.map((r) => [key(r), R.current(r)]));
  // Choice 1 and choice 2 each lead to their own passage.
  for (const p of ["start", "choice2"]) {
    const nexts = PASSAGES[p].choices.map((c) => c.next);
    assert.equal(new Set(nexts).size, nexts.length, `${p} choices share a passage`);
  }
  // Every first and second choice changes the ending for at least one continuation.
  for (const level of [0, 1]) {
    const groups = {};
    for (const r of runs) {
      const rest = r.took.filter((_, i) => i !== level).join(">");
      (groups[rest] ||= new Set()).add(endOf[key(r)]);
    }
    assert.ok(
      Object.values(groups).some((s) => s.size > 1),
      `choice ${level + 1} never changes the ending`,
    );
  }
  // Following the head's instruction always closes the file.
  for (const r of runs) if (r.took[2] === "follow") assert.equal(R.current(r), "end-folder");
  // Giving photographs needs photographs.
  const noPhoto = R.createRead();
  R.choose(noPhoto, "basement");
  R.choose(noPhoto, "refnum");
  assert.equal(R.options(noPhoto).find((o) => o.id === "give").ok, false);
  assert.equal(R.choose(noPhoto, "give"), false);
});

test("the path shapes the prose: variants and ending extras follow earlier choices", () => {
  const a = R.createRead();
  R.choose(a, "call");
  R.choose(a, "photo");
  R.choose(a, "give");
  assert.equal(R.current(a), "end-record");
  const withCall = R.paragraphs(a, "end-record", "tr").join(" ");
  assert.match(withCall, /Tamarisk|çaydanlık/);
  const b = R.createRead();
  R.choose(b, "request");
  const v = R.paragraphs(b, "choice2", "en").join(" ");
  assert.match(v, /torn-out page/);
});

test("saves replay choices; tampered saves are cut at the first invalid step", () => {
  const r = R.createRead();
  R.choose(r, "basement");
  R.choose(r, "photo");
  assert.deepEqual(R.normalize(JSON.parse(JSON.stringify(r))), r);
  const bad = R.normalize({
    v: 1,
    took: ["basement", "nonsense", "give"],
    vars: { evidence: 99 },
    endings: ["start", "end-record"],
  });
  assert.deepEqual(bad.took, ["basement"]);
  assert.equal(bad.vars.evidence, 1, "variables come from replay, never from the save");
  assert.deepEqual(bad.endings, ["end-record"]);
  assert.equal(R.normalize({ v: 2, took: [] }), null);
  const again = R.restart(bad);
  assert.deepEqual(again.took, []);
  assert.deepEqual(again.endings, ["end-record"], "restart keeps the endings seen");
});

test("reader settings are bounded", () => {
  assert.deepEqual(R.normalizeSettings(null), R.defaultSettings());
  const s = R.normalizeSettings({
    size: 99,
    theme: "neon",
    font: "comic",
    spacing: "wide",
    letters: "wide",
  });
  assert.equal(s.size, R.defaultSettings().size);
  assert.equal(s.theme, "manila");
  assert.equal(s.font, "serif");
  assert.equal(s.spacing, "wide");
  assert.equal(s.letters, "wide");
  assert.ok(R.SIZES.every((x, i) => i === 0 || x > R.SIZES[i - 1]));
});

test("original text only; unlisted, silent, no illustration or narration", () => {
  const dir = "../public/games/proto-novella/";
  const html = readFileSync(new URL(dir + "index.html", import.meta.url), "utf8");
  assert.match(html, /name="robots" content="noindex,nofollow"/);
  assert.doesNotMatch(html, /og:|twitter:|rel="icon"/);
  for (const f of ["../src/lib/games.ts", "../public/sitemap.xml"])
    assert.doesNotMatch(readFileSync(new URL(f, import.meta.url), "utf8"), /proto-novella/);
  for (const f of ["story.js", "rules.js", "reader.js", "style.css"]) {
    const src = readFileSync(new URL(dir + f, import.meta.url), "utf8");
    assert.doesNotMatch(src, /AudioContext|new Audio|\.mp3|\.ogg|\.wav|speechSynthesis/);
    assert.doesNotMatch(src, /url\(|\.png|\.jpe?g|\.webp/, `${f} loads an image`);
  }
  const story = readFileSync(new URL(dir + "story.js", import.meta.url), "utf8");
  assert.match(story, /original short interactive novella written for\s*\/\/ TarikLab/);
});
