import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { pools } from "./duel-pools.mjs";
import { validateDeck } from "../public/games/duel-core/deckgen.js";
import {
  DECK_COPY,
  DECK_SCHEMA_VERSION,
  deckBreakdown,
  deckCopy,
  expandDeck,
  findPreset,
  isPresetShape,
  presetCardIds,
} from "../public/games/duel-core/decks.js";
import { copyKey } from "../public/games/duel-core/card-data.js";
import { relatedCards, reasonFor, REASON_LABELS } from "../public/games/duel-core/relationships.js";
import { deckHeading, deckIntro } from "../public/games/duel-core/setup-flow.js";
import { duelHelpSections } from "../public/games/duel-core/help-duel.js";
import { createDuel, dispatch } from "../public/games/duel-core/rules.js";
import { legalActions } from "../public/games/duel-core/actions.js";
import { publicView } from "../public/games/duel-core/projection.js";
import { chooseAction } from "../public/games/duel-core/ai.js";

const THEMES = ["veto-h", "gett-oh"];
const decksOf = (theme) => JSON.parse(readFileSync(`public/games/${theme}/decks.json`, "utf8"));

/* ---------------------------------------------------------------- decks */

for (const theme of THEMES) {
  test(`${theme}: every preset is a legal, playable 40-card deck`, () => {
    const pool = pools[theme];
    const doc = decksOf(theme);
    assert.equal(doc.schemaVersion, DECK_SCHEMA_VERSION);
    assert.equal(doc.theme, theme);
    assert.equal(doc.decks.length, 5);
    const byId = new Map(pool.map((c) => [c.id, c]));
    for (const preset of doc.decks) {
      assert.ok(isPresetShape(preset), `${preset.id}: bad shape`);
      const ids = presetCardIds(preset);
      assert.equal(ids.length, 40, `${preset.id}: main deck size`);
      for (const id of ids) {
        const card = byId.get(id);
        assert.ok(card, `${preset.id}: unknown card ${id}`);
        assert.equal(card.deckLocation, "main", `${preset.id}: ${id} is not a main-deck card`);
      }
      for (const entry of preset.auxiliary || []) {
        const card = byId.get(entry.id);
        assert.ok(card, `${preset.id}: unknown auxiliary ${entry.id}`);
        assert.equal(card.deckLocation, "auxiliary", `${preset.id}: ${entry.id} is not auxiliary`);
      }
      // Copy limits count the shared rules identity, not the display name.
      const copies = new Map();
      for (const id of ids) {
        const key = copyKey(byId.get(id));
        copies.set(key, (copies.get(key) || 0) + 1);
      }
      for (const [key, n] of copies) assert.ok(n <= 3, `${preset.id}: ${n} copies of ${key}`);
      assert.ok(validateDeck(expandDeck(preset, pool, 7), pool), `${preset.id}: illegal deck`);
    }
  });

  test(`${theme}: preset ids, copy and archive listing all line up`, () => {
    const doc = decksOf(theme);
    const copyIds = Object.keys(DECK_COPY[theme]);
    assert.deepEqual(
      doc.decks.map((d) => d.id),
      copyIds,
      "decks.json order must match the player-facing copy table",
    );
    for (const preset of doc.decks)
      for (const lang of ["tr", "en"]) {
        const copy = deckCopy(theme, preset.id, lang);
        assert.ok(copy.name && copy.name !== "—", `${preset.id}/${lang}: missing name`);
        assert.ok(copy.blurb?.length > 20, `${preset.id}/${lang}: missing strategy blurb`);
      }
  });

  test(`${theme}: a preset deals exactly its own contents`, () => {
    const pool = pools[theme];
    const doc = decksOf(theme);
    for (const preset of doc.decks) {
      const dealt = expandDeck(preset, pool, 123);
      const sort = (list) => [...list].sort().join(",");
      assert.equal(sort(dealt.main), sort(presetCardIds(preset)), `${preset.id}: contents drifted`);
      // The seed only changes order, never the cards.
      const other = expandDeck(preset, pool, 999);
      assert.equal(sort(other.main), sort(dealt.main), `${preset.id}: seed changed contents`);
      assert.notEqual(
        other.main.join(","),
        dealt.main.join(","),
        `${preset.id}: order never varies`,
      );
    }
  });

  test(`${theme}: every preset can complete a duel without stalling`, () => {
    const pool = pools[theme];
    const doc = decksOf(theme);
    for (const [i, preset] of doc.decks.entries()) {
      const foe = doc.decks[(i + 1) % doc.decks.length];
      let s = createDuel(pool, theme, 4242 + i, i % 2, [
        expandDeck(preset, pool, 11 + i),
        expandDeck(foe, pool, 77 + i),
      ]);
      let steps = 0;
      for (; steps < 3000 && !s.result; steps++) {
        const player = s.choice?.player ?? s.pending?.responding ?? s.active;
        const action = chooseAction(publicView(s, player), legalActions(s, player));
        assert.ok(action, `${preset.id}: no legal action at step ${steps}`);
        const result = dispatch(s, action);
        assert.ok(result.ok, `${preset.id}: ${result.error}`);
        s = result.state;
      }
      assert.ok(s.result, `${preset.id}: duel never finished (${steps} steps)`);
    }
  });

  test(`${theme}: deck breakdown matches the cards actually listed`, () => {
    const pool = pools[theme];
    for (const preset of decksOf(theme).decks) {
      const counts = deckBreakdown(preset, pool);
      assert.equal(counts.unit + counts.spell + counts.trap, 40, `${preset.id}: breakdown total`);
      assert.ok(counts.unit >= 22 && counts.unit <= 24, `${preset.id}: units ${counts.unit}`);
      assert.ok(counts.spell >= 10 && counts.spell <= 12, `${preset.id}: spells ${counts.spell}`);
      assert.ok(counts.trap >= 6 && counts.trap <= 8, `${preset.id}: traps ${counts.trap}`);
    }
  });
}

test("findPreset falls back safely for an unknown id", () => {
  const doc = decksOf("veto-h");
  assert.equal(findPreset(doc.decks, "no-such-deck"), null);
  assert.equal(findPreset(null, "halkci"), null);
});

/* ------------------------------------------------------- setup headings */

test("deck headings name a deck, not a cosmetic approach", () => {
  assert.equal(deckHeading("veto-h", "tr"), "Kampanya Destesi");
  assert.equal(deckHeading("gett-oh", "tr"), "Racon Destesi");
  assert.equal(deckHeading("veto-h", "en"), "Campaign Deck");
  assert.equal(deckHeading("gett-oh", "en"), "Racon Deck");
  for (const theme of THEMES)
    for (const lang of ["tr", "en"]) {
      const intro = deckIntro(theme, lang);
      assert.match(intro, /40/, `${theme}/${lang}: intro must state the deck size`);
    }
});

/* --------------------------------------------------------- card content */

const normalize = (value) =>
  String(value || "")
    .trim()
    .toLocaleLowerCase("tr")
    .replace(/\s+/g, " ")
    .replace(/[’'`´]/g, "'")
    .replace(/[.,;:!?]/g, "");

for (const theme of THEMES) {
  test(`${theme}: visible card names are present and unique in both languages`, () => {
    const pool = pools[theme];
    for (const lang of ["tr", "en"]) {
      const seen = new Map();
      for (const card of pool) {
        const name = card.name[lang];
        assert.ok(name && String(name).trim(), `${card.id}: empty ${lang} name`);
        const key = normalize(name);
        assert.ok(
          !seen.has(key),
          `${lang} name "${name}" is shared by ${seen.get(key)} and ${card.id}`,
        );
        seen.set(key, card.id);
      }
    }
  });

  test(`${theme}: card names stay short enough to fit a card frame`, () => {
    for (const card of pools[theme])
      for (const lang of ["tr", "en"])
        assert.ok(
          String(card.name[lang]).length <= 24,
          `${card.id}: ${lang} name too long (${card.name[lang]})`,
        );
  });

  test(`${theme}: Turkish card text reads as sentences`, () => {
    for (const card of pools[theme]) {
      const text = card.text.tr;
      assert.ok(text && text.trim(), `${card.id}: empty Turkish text`);
      assert.match(text, /[.!?…]$/, `${card.id}: text does not end as a sentence — "${text}"`);
      assert.doesNotMatch(text, /'/, `${card.id}: ASCII apostrophe in "${text}"`);
      // "token" stays: it is part of card names such as "Kararsız Token".
      assert.doesNotMatch(
        text,
        /\b(normal summon|special summon|end phase|main phase|battle phase)\b/i,
        `${card.id}: untranslated English in "${text}"`,
      );
    }
  });

  test(`${theme}: the reprinted pair keeps one shared rules identity`, () => {
    const pool = pools[theme];
    const byId = new Map(pool.map((c) => [c.id, c]));
    if (theme !== "veto-h") return;
    for (const [a, b] of [
      ["SND-065", "SND-066"],
      ["SND-079", "SND-080"],
    ]) {
      assert.equal(copyKey(byId.get(a)), copyKey(byId.get(b)), `${a}/${b}: copy identity split`);
      assert.notEqual(byId.get(a).name.tr, byId.get(b).name.tr, `${a}/${b}: names still identical`);
    }
  });
}

/* -------------------------------------------------------------- combos */

for (const theme of THEMES) {
  test(`${theme}: every shown combo carries a real, labelled reason`, () => {
    const pool = pools[theme];
    const byId = new Map(pool.map((c) => [c.id, c]));
    for (const card of pool) {
      const rows = relatedCards(card, pool, 4);
      for (const row of rows) {
        assert.ok(byId.has(row.id), `${card.id}: combo points at unknown ${row.id}`);
        assert.ok(REASON_LABELS[row.why], `${card.id}→${row.id}: unlabelled reason ${row.why}`);
        // The reason must be re-derivable, never a leftover score artefact.
        assert.equal(reasonFor(card, row.card), row.why, `${card.id}→${row.id}: reason not stable`);
        for (const lang of ["tr", "en"])
          assert.ok(REASON_LABELS[row.why][lang], `${row.why}: missing ${lang} label`);
      }
    }
  });

  test(`${theme}: a pair with no derivable reason is never offered`, () => {
    const pool = pools[theme];
    for (const card of pool.slice(0, 40))
      for (const other of pool.slice(0, 40))
        if (card.id !== other.id && !reasonFor(card, other))
          assert.ok(
            !relatedCards(card, pool, 12).some((row) => row.id === other.id),
            `${card.id}→${other.id}: shown without a reason`,
          );
  });
}

/* ---------------------------------------------------------------- help */

for (const theme of THEMES) {
  for (const lang of ["tr", "en"]) {
    test(`${theme}/${lang}: the duel guide teaches a complete beginner`, () => {
      const guide = duelHelpSections(theme, lang);
      assert.ok(guide.length >= 10, `${theme}/${lang}: only ${guide.length} sections`);
      const blob = JSON.stringify(guide);
      assert.doesNotMatch(blob, /undefined|null|TODO|Lorem/i, "placeholder copy in the guide");
      for (const section of guide) {
        assert.ok(section.h?.trim(), "section without a heading");
        assert.ok(
          (section.p?.length || 0) + (section.list?.length || 0) > 0,
          `${section.h}: empty`,
        );
      }
      // The points a first-time player cannot play without.
      const required =
        lang === "tr"
          ? [/8000/, /40/, /Kademe 1–4/, /6/, /Teslim Ol/, /Esc/]
          : [/8000/, /40/, /Levels 1–4/, /6/, /Surrender/, /Esc/];
      for (const pattern of required)
        assert.match(blob, pattern, `${theme}/${lang}: guide never mentions ${pattern}`);
    });
  }
}

test("every playable catalog game ships teaching content", () => {
  const catalog = readFileSync("src/lib/games.ts", "utf8");
  const slugs = [...catalog.matchAll(/slug: "([^"]+)",[\s\S]*?status: "(live|soon)"/g)]
    .filter((m) => m[2] === "live")
    .map((m) => m[1]);
  assert.ok(slugs.length >= 16, `catalog parse found only ${slugs.length} live games`);

  // Where each game's player-facing teaching content lives.
  const sources = {
    "cete-savaslari": ["src/components/game/help-panel.tsx", "src/components/game"],
    hanedanian: ["public/games/hanedanian/app.js"],
    racon: ["public/games/racon/index.html"],
    "tc-sim": ["public/games/tc-sim/js/help.js"],
    bukucu: ["public/games/bukucu/index.html"],
    labirent: ["public/games/labirent/index.html"],
    "peg-solitaire": ["public/games/peg-solitaire/index.html"],
    satranc: ["public/games/satranc/index.html"],
    "amiral-batti": ["public/games/amiral-batti/index.html"],
    apartman: ["public/games/apartman/help.js"],
    esik: ["public/games/esik/app.js"],
    "kayip-telefon": ["public/games/kayip-telefon/help.js"],
    "son-100-gun": ["public/games/son-100-gun/pov-app.js"],
    "tc-sim-devlet": ["public/games/tc-sim-devlet/help.js"],
    "son-kasaba": ["public/games/son-kasaba/help.js"],
    "veto-h": ["public/games/duel-core/help-duel.js"],
    "gett-oh": ["public/games/duel-core/help-duel.js"],
    "darbe-h": ["public/games/duel-core/help-duel.js"],
    ihtilal: ["public/games/ihtilal/copy.js"],
    "jitem-derin-ag": ["public/games/jitem-derin-ag/assets/runtime.js"],
  };

  for (const slug of slugs) {
    const candidates = sources[slug];
    assert.ok(candidates, `${slug}: no teaching content is mapped for this live game`);
    const found = candidates.find((path) => existsSync(path));
    assert.ok(found, `${slug}: none of ${candidates.join(", ")} exists`);
    const body = readFileSync(found, "utf8");
    assert.match(
      body,
      /Nasıl oynanır|Nasıl Oynanır|NASIL OYNANIR|How to play|How to Play|How it plays|HELP_SECTIONS|Amaç/,
      `${slug}: ${found} has no how-to-play surface`,
    );
    assert.doesNotMatch(body, />\s*(undefined|null)\s*</, `${slug}: placeholder copy in ${found}`);
  }
});

test("structured help sections carry no placeholder copy", async () => {
  for (const path of [
    "public/games/apartman/help.js",
    "public/games/kayip-telefon/help.js",
    "public/games/son-kasaba/help.js",
    "public/games/tc-sim-devlet/help.js",
  ]) {
    const { HELP_SECTIONS } = await import(`../${path}`);
    assert.ok(HELP_SECTIONS.length >= 5, `${path}: only ${HELP_SECTIONS.length} sections`);
    for (const section of HELP_SECTIONS) {
      assert.equal(section.h.length, 2, `${path}: heading must be [tr, en]`);
      for (const row of [...(section.p || []), ...(section.list || [])]) {
        assert.equal(row.length, 2, `${path}: copy must be [tr, en]`);
        for (const value of row) assert.ok(value?.trim(), `${path}: empty copy in ${section.h[0]}`);
      }
    }
  }
});
