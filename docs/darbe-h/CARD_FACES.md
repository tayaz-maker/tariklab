# DARBE-H! card faces

This is a from-scratch redesign of the DARBE-H! card component, with one original illustration per card.

**What does not change:**

- The logo, the main screen and the page layout
- The palette
- The table geometry and slot sizes
- The match flow and every UI surface outside the cards
- VETO-H! and GETT-OH!, which keep duel-core's card markup untouched

## 1. Card inventory (from `source-cards.json` + `designs.js`)

**Kinds and subtypes (300 cards):**

| Kind             | Subtype                             | Count |
| ---------------- | ----------------------------------- | ----- |
| Görevli (unit)   | effect                              | 158   |
| Görevli (unit)   | fusion (Birleşim, Yedek Heyet deck) | 12    |
| Emirname (spell) | normal                              | 52    |
| Emirname (spell) | equip                               | 13    |
| Emirname (spell) | quick                               | 10    |
| Emirname (spell) | field                               | 2     |
| Emirname (spell) | continuous                          | 2     |
| İhtar (trap)     | normal                              | 45    |
| İhtar (trap)     | counter                             | 5     |
| İhtar (trap)     | continuous                          | 1     |

**Series.** There are 12 bureaus: Dosya, Paraf, Heyet, Karargâh, Telex, Muhtıra, Zeyil, Brifing, Kabine, Arşiv, Tebligat and Meşruiyet.

- Görevli: 13–16 cards per bureau
- Emirname: 5–7 per bureau
- İhtar: 26 carry the İhtar series; the rest are spread 2–3 per bureau

**Rank and stats:**

- Rank (kademe) spread for Görevli: 1:4, 2:24, 3:76, 4:22, 5:22, 6:6, 7:12, 8:4
- ATK ranges 0–2800 and DEF 200–2600

**Effect summaries.** Every card shows a two-word summary, taken from the strongest operation in its rules data:

| Summary            | Count |
| ------------------ | ----- |
| KP etkiler         | 52    |
| Taşır              | 50    |
| Kalıcı etki        | 43    |
| Güç değiştirir     | 26    |
| Kart çeker         | 21    |
| Etkisiz kılar      | 19    |
| Saldırıyı durdurur | 15    |
| Krizi atlatır      | 14    |
| Yok eder           | 10    |
| Çağırır            | 8     |
| Bakar              | 8     |
| Karıştırır         | 7     |
| Kurar              | 6     |
| Açığa çıkarır      | 6     |
| Attırır            | 5     |
| Kısıtlar           | 3     |
| Ele geçirir        | 3     |
| Çağrıyı bozar      | 2     |
| Jeton koyar        | 2     |

**Triggers.** 81 cards also name when they fire:

| Trigger      | Count |
| ------------ | ----- |
| Çağrılınca   | 32    |
| Yok olunca   | 16    |
| Tur başında  | 12    |
| Açılınca     | 12    |
| Gönderilince | 6     |
| Arşivden     | 2     |
| Emirnamede   | 1     |

## 2. Card anatomy

The same four bands appear on every card, top to bottom:

1. **Name and rank.** The name is a two-line Georgia serif, matching the game's title voice. Görevli cards add a brass `★ kademe` pill.
2. **Illustration.** Inside it:
   - bottom-left: a kind tab (glyph and word: GÖREVLİ, EMİRNAME, İHTAR or BİRLEŞİM) in the kind colour
   - top-right: a three-letter bureau stamp
3. **Effect summary.** The trigger (brass) and the verb, for example _Çağrılınca · Taşır_. The full rule text stays in Kart Ayrıntısı.
4. **Footer.**
   - Görevli: ATK and DEF plates with tabular numbers. A modified value turns brass ▲ or red ▼.
   - Emirname and İhtar: the subtype (Normal, Hızlı, Donanım, Alan, Sürekli, Karşı) in the kind colour.

A 3 px kind rail runs along the top of every card:

- Görevli: `--accent` steel
- Emirname: `--brass`
- İhtar: `--red`

The kind is always given by the rail, the glyph and the word together, never by colour alone.

## 3. Sizes

Every surface keeps its existing outer size. Only the inside of the card is laid out anew.

| Surface             | Size (measured)                     | What the card shows                                                                  |
| ------------------- | ----------------------------------- | ------------------------------------------------------------------------------------ |
| Hand, desktop       | 128×187                             | all four bands                                                                       |
| Hand, 390 px        | 116×169                             | all four bands                                                                       |
| Board slot, desktop | 89×130                              | name, illustration, stats                                                            |
| Board slot, 390 px  | 67×72                               | name and stats (the illustration drops before the text shrinks)                      |
| Support row         | 166×42 (desktop), 67×26 (390 px)    | name, or the card back                                                               |
| Kart Ayrıntısı      | panel width                         | 3:2 illustration, kind, summary, type or stats (the name is already the panel title) |
| Kart Arşivi         | 165×241 (desktop), 173×252 (390 px) | all four bands                                                                       |

**Face-down cards** show one dossier back, the DARBE-H! weave with the existing emblem, for every card.

## 4. States

Every state has a shape or position cue, not just a colour change.

| State                        | Look                                                                                                                                                                                      |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| hover (pointer devices only) | lifts 3 px, brass edge                                                                                                                                                                    |
| press                        | scales to 97 % for 60 ms                                                                                                                                                                  |
| keyboard focus               | 2 px foreground outline                                                                                                                                                                   |
| selected                     | lifts 5 px, 2 px brass outline, brass bottom bar, soft glow; the dark ground and name contrast are kept (duel-core's paper-white hover and selected fill is overridden for DARBE-H! only) |
| valid target                 | 2 px dashed steel outline                                                                                                                                                                 |
| response ready               | red edge                                                                                                                                                                                  |
| not playable right now       | desaturated, 80 % opacity, dashed border                                                                                                                                                  |

**"Not playable right now"** is driven by a new `data-playable` attribute: duel-core sets it from the same legal-action list the inspector uses. The card stays tappable, so it still opens Kart Ayrıntısı and play is unchanged. A real `:disabled` card gets the same look plus a `not-allowed` cursor.

**Motion.** There is no looping animation. Under `prefers-reduced-motion`, all lifts and transitions are off.

## 5. Contrast (WCAG 2.2, existing tokens)

| Pair                                                    | Ratio           |
| ------------------------------------------------------- | --------------- |
| Name `--foreground` on card ground                      | 9.8–11.5        |
| Summary text / trigger (brass) on ground                | 11.5 / 6.7      |
| ATK and DEF numbers / labels on `--ink`                 | 13.1 / 9.7      |
| Rank and kind tab text (`--ink` on brass / steel / red) | 7.6 / 5.6 / 5.4 |
| Subtype colours on `--ink`                              | 5.4–7.6         |
| Selected / target outline against the table             | 6.2 / 4.6       |

Every text pair is at least 4.5:1 and every non-text cue at least 3:1.

**Minimum type size on a card is 10.5 px.** The only exceptions are the 8.5 px ATK/DEF caption and kind word, and those always sit next to a larger number or the glyph.

## 6. Illustrations

There are 300 files in `public/games/darbe-h/assets/card-art/`, one per card. They are generated by `node scripts/build-darbe-h-card-art.mjs`, which is deterministic and records every file in `manifest.json`. Each picture is read from the card's own data, as described below. A per-card seed only nudges placement.

**Setting.** The card's bureau becomes the room:

| Bureau    | Room                  |
| --------- | --------------------- |
| Dosya     | filing cabinets       |
| Paraf     | signing desk and lamp |
| Heyet     | round committee table |
| Karargâh  | pinned map            |
| Telex     | telex machine         |
| Muhtıra   | cork board of memos   |
| Zeyil     | clipped appendix      |
| Brifing   | bar-chart screen      |
| Kabine    | tall blinds           |
| Arşiv     | shelves               |
| Tebligat  | pigeonholes           |
| Meşruiyet | columns               |

**Görevli.** The role in the name sets the pose and prop:

| Role     | Pose and prop                         |
| -------- | ------------------------------------- |
| Kâtip    | types                                 |
| Müsteşar | on the phone                          |
| Müşavir  | advises, pointing                     |
| Kurye    | carries a sealed envelope and satchel |
| Arşivci  | carries boxes, ladder behind          |
| Er       | salutes                               |
| Başkan   | brings down the gavel                 |
| Usta     | stamps                                |
| Yazman   | writes in the ledger                  |
| Çırak    | carries a paper stack                 |
| Sözcü    | at the microphone                     |
| Dizgici  | with type blocks                      |
| …        | …                                     |

Rank sets the shot: kademe 1 is a medium shot, kademe 8 a close-up under a spotlight. Rank pips appear on the lapel. Birleşim cards show two figures joined by a brass arc.

**Emirname and İhtar.** The noun in the title is the subject: envelope, easel, signature, stapled appendix, drawers, committee table, redline, scales, stamp, register, scroll, ribbon, carbon copies, clock, map, door and so on.

The adjectives in the title change it:

| Adjective            | Change              |
| -------------------- | ------------------- |
| Kırmızı / Sarı       | tint                |
| Gizli                | shut eye            |
| Açık                 | opened              |
| Gece / Geç           | moon                |
| Erken                | low sun             |
| Sessiz               | muted               |
| Gürültülü            | noise               |
| Çift                 | doubled             |
| Eksik                | dashed              |
| Kopuk                | broken tape         |
| Kilitli              | padlock             |
| İade / Red / Uyuşmaz | red cross           |
| Şüphe                | question mark       |
| Kayma                | motion lines        |
| Sızıntı              | drip                |
| Erteleme             | hourglass           |
| Zincir               | chain               |
| Dahili / Harici      | closed or open door |

**Event.** The card's strongest effect adds one cue:

| Effect                 | Cue            |
| ---------------------- | -------------- |
| destroy                | burst and tear |
| control                | puppet strings |
| negate                 | red strike     |
| stop attack / restrict | barrier        |
| summon                 | lit doorway    |
| draw                   | flying sheets  |
| power change           | chevrons       |
| KP                     | coins          |
| look                   | eye            |
| shuffle                | cycle          |

İhtar cards are always washed red and carry a hazard strip, so a notice reads as a warning even at board size.

**Style.** The art is flat vector in the existing palette only. There is no text in the art, no raster images, no filters and no remote assets. Plates are 240×160, 4.9 KB on average (9 KB at most), 1.47 MB for all 300.

## 7. Performance

- Illustrations use `<img loading="lazy" decoding="async">` with fixed dimensions, so there is no layout shift. Only visible cards are fetched.
  - An opening hand plus the board fetched 8 plates, about 17–28 KB.
  - An archive page fetched 14–24 plates, 4–12 KB over the wire.
- Plates are same-origin static files, so the existing service worker and HTTP caches apply unchanged.
- The card face adds no timers, observers or animation loops. It only builds a few more elements when duel-core already re-renders a card.
- The stylesheet is loaded once before first paint by `public/games/darbe-h/app.js`.
- HANEDANIAN and its map are not touched.

## 8. Files

| File                                                                                  | Role                                                                                                        |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `public/games/darbe-h/card-face.js`                                                   | Card face renderer and effect summaries (TR/EN)                                                             |
| `public/games/darbe-h/card-face.css`                                                  | Card face styles, all scoped to `body[data-theme="darbe-h"]`                                                |
| `public/games/darbe-h/app.js`                                                         | Loads the stylesheet and passes `{ cardFace }` to duel-core                                                 |
| `public/games/duel-core/app.js`                                                       | Optional `options.cardFace` hook in `cardEl` (legacy markup when absent), plus `data-playable` on own cards |
| `public/games/darbe-h/assets/card-art/*`                                              | 300 illustrations and `manifest.json`                                                                       |
| `scripts/build-darbe-h-card-art.mjs`, `scripts/darbe-h-card-art/{motifs,compose}.mjs` | Illustration generator                                                                                      |
| `scripts/darbe-h-card-face.test.mjs`                                                  | Coverage, determinism, well-formed SVG, size budget, palette, scoping, sibling isolation, summaries         |

The previous art in `assets/cards/` and its manifest and tests are left in place. Release PRs #60 and #61 edit those files, so this PR does not collide with them.
