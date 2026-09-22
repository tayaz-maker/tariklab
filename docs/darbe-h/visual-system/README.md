# DARBE-H! visual system: "Kriz Masası" (proposal v1)

This is a design package. **Nothing here changes the game yet.** It lives on its own branch
(`claude/darbe-h-visual-system`), separate from the release PRs #60–#63.

- `mockup.html` renders real cards from `public/games/darbe-h/source-cards.json` with their
  current art, in every state and size. To view it, serve the repository root statically and open
  `/docs/darbe-h/visual-system/mockup.html`.
- `cards.css` is the reference card component.
- `logo/` holds the logo variants. `tools/build-logo.mjs` regenerates them, including the PNGs.
- `screens/` holds screenshots of the mockup at 1440×900 and 390×844 (DPR 2).

## 1. Art directions

| | Direction | Verdict |
|---|---|---|
| A | **Dosya & Mühür**: kraft folders, typewriter type, rubber stamps | Warm, but every kind looks like paper, so cards blur together |
| **B** | **Kriz Masası**: noir command room, ink navy table, telex amber, stamp crimson only for danger | **Recommended.** It keeps the existing DARBE-H! palette and gives each kind its own colour, glyph and word |
| C | **Afiş / Konstrüktivist**: diagonal red/black poster blocks | Not recommended. It reads as real political propaganda, and diagonals fight 300 cards of text |

All three are original. None uses a real emblem, flag, insignia, person or font that needs a licence.

## 2. Tokens

| Token | Value | Use |
|---|---|---|
| `--dh-ink` | `#121820` | table, icon tile |
| `--dh-ink-2` / `--dh-ink-3` | `#19212d` / `#243044` | card body gradient |
| `--dh-paper` | `#efe6d2` | effect slip, rank chip, card name |
| `--dh-text-ink` | `#1a1a17` | text on paper and on the amber/teal tabs |
| `--dh-muted` | `#b9c1c9` | secondary labels |
| `--dh-brass` | `#c4a574` | hairlines, face-down rail |
| `--dh-seal` | `#c8463c` | logo ring, cost tag, YANIT tab, stamps |
| `--dh-seal-text` | `#ff8a7e` | seal-coloured text on dark |
| `--dh-unit` | `#8fb0cc` | **Görevli** rail + glyph |
| `--dh-spell` | `#e0ad4f` | **Emirname** rail + glyph |
| `--dh-trap` | `#f07a6c` | **İhtar** rail + glyph |
| `--dh-select` | `#f2b544` | selected outline and tab |
| `--dh-target` | `#5cc8c2` | valid-target dashed frame and tab |
| `--dh-up` / `--dh-down` | `#7fd6a8` / `#ff8a7e` | modified ATK/DEF (with ▲/▼) |

## 3. Card anatomy (one layout for all 300 cards)

1. **Kind rail**: a colour band, a glyph (person, sealed document, warning triangle) and a word
   (GÖREVLİ, EMİRNAME or İHTAR; fusion units say BİRLEŞİK and get a striped rail). Colour is never
   the only signal.
2. **Rank or timing chip**: `K1`–`K8` for Görevli. Emirname and İhtar show their timing instead:
   ANLIK, HIZLI, TEÇHİZ, SAHA, KALICI, KURULU or KARŞI.
3. **Name**: at most 2 balanced lines.
4. **Art window** with the **bureau stamp**: the series as a 3-letter code (DSY, HYT, TLX, ZYL, KBN,
   TBG, PRF, KRG, MHT, BRF, ARŞ, MŞR; İHTAR for traps).
5. **Effect slip**: dark ink on paper. Tags come first: cost (`−650 KP`), trigger (`TURDA 1`,
   `HER TUR`) and verb (`ÇAĞRI`, `YOK ET`, `KONTROL`…). Then the text, clamped to 3 lines. The
   inspector shows the full text.
6. **Footer**: tabular `ATK` / `DEF` for Görevli, using the same words as the effect texts. Other
   kinds show the kind and the resolution verb.

**Size tiers.** The card is one component using container queries:

| Tier | Width | Used for | What shows |
|---|---|---|---|
| L | 240 px | inspector | everything |
| M | 104–132 px | hand | everything, with the effect text clamped |
| S | 76 px | board | rail, rank or timing, name, art and stats; the effect slip moves to the inspector |

## 4. States

Every state has a cue besides colour. Each maps to data that `duel-core/app.js` `cardEl()` already
computes.

| State | Visual | Existing source |
|---|---|---|
| selected | lifted 8 px, amber outline, `SEÇİLİ` tab | `.selected` (`uid === selected`) |
| valid target | dashed teal frame, `⌖ HEDEF` tab | `.valid-target` |
| not a target while targeting | dimmed to 35 % | `body[data-targeting] .playing-card:not(.valid-target)` |
| playable | amber inner bottom bar | legal `actions()` for the card (new attribute) |
| response ready | `YANIT` tab (pulses unless reduced-motion) | `data-response-ready="true"` |
| used this turn | desaturated, `KULLANILDI` stamp | `data-used="true"` |
| attacked this turn | `✓ SALDIRDI` chip | `data-attacked="true"` |
| defense position | ATK dimmed, DEF framed, rotated 90° on the table | `data-position="defense"` |
| modified stats | ▲ teal / ▼ coral numbers | `attack` vs `baseAttack` |
| face-down | sealed dossier with the mark | `.face-down` |
| disabled | 45 % opacity, not-allowed cursor | `:disabled` |
| result | `−400 KP` float + `YOK EDİLDİ` stamp for about 900 ms before the card moves | battle log event |

**The action bar** always shows three things:
- what is selected (step 1)
- what it will do: a forecast strip (ATK→DEF, destroyed or not, KP change), computed before
  confirming
- the next step: a numbered step bar with the current step outlined

## 5. Contrast (WCAG 2.2, computed in `mockup.html`)

| Pair | Ratio | Target |
|---|---|---|
| Effect text on paper slip | 14.1:1 | 4.5 |
| Name on card body | 13.0:1 | 4.5 |
| Muted label on body | 8.9:1 | 4.5 |
| Rank chip | 14.1:1 | 4.5 |
| Görevli / Emirname / İhtar rail word on `#243044` | ≥ 4.5:1 each | 4.5 |
| Bureau stamp text | 7.8:1 | 4.5 |
| Stat numerals / ▲ / ▼ | 15.4 / 11.0 / 8.3:1 | 4.5 |
| SEÇİLİ / HEDEF / YANIT tabs | 9.5 / 8.7 / 4.8:1 | 4.5 |
| Cost tag | 4.8:1 | 4.5 |
| Selected / target outline vs table | 9.7 / 8.9:1 | 3 (non-text) |

The mockup recomputes the table live, and the QA run reported no failing pair at either viewport.

## 6. Logo

The mark is a seal ring, a geometric **D** whose chamfer is a dossier-tab corner, and one diagonal
**crack** cutting through both: the stamp that breaks the order. It is built only from paths (no
fonts, no filters). The crack is a mask, so it is a true cut-out on any background.

| File | Use |
|---|---|
| `logo/darbe-h-mark.svg` | mark on dark, transparent background |
| `logo/darbe-h-icon.svg`, `-icon-192.png`, `-icon-512.png` | app icon (ink tile, brass hairline) |
| `logo/darbe-h-maskable.svg`, `-maskable-512.png` | maskable PWA icon; the mark stays inside the 80 % safe circle |
| `logo/darbe-h-apple-touch-180.png` | iOS home screen |
| `logo/darbe-h-favicon.svg`, `-favicon-32.png` | favicon; no perforation and a wider crack, so it reads at 16 px |
| `logo/darbe-h-glyph.svg` | single colour (`currentColor`) for inline UI |
| `logo/darbe-h-wordmark.svg`, `-wordmark-mono.svg` | path-built stencil wordmark; hyphen and bang in seal red |
| `logo/darbe-h-lockup.svg` | mark + wordmark for the in-game header and portal hero |
| `logo/portal-game-icon.tsx.txt` | 64-grid, 2 px stroke glyph matching `src/components/portal/game-icons.tsx` |

## 7. Implementation plan (after #60/#61 merge; not part of any release PR)

The card component is shared by VETO-H!, GETT-OH! and DARBE-H!. Everything below is gated on
`theme === "darbe-h"` or scoped under `body[data-theme="darbe-h"]`, so the sibling games are
byte-for-byte unaffected.

| Step | Files | Change |
|---|---|---|
| 1. Card face hook | `public/games/duel-core/app.js` (`cardEl`, around line 847), `public/games/duel-core/theme-meta.js` | Add an optional per-theme `cardFace(card, ctx)` renderer. DARBE-H! returns the rail, name, art, slip and footer markup; the other themes keep the current markup. Keep every existing attribute (`data-used`, `data-attacked`, `data-response-ready`, `data-position`, `.selected`, `.valid-target`) and add `data-playable` and `data-sub`. |
| 2. Effect tags | `public/games/duel-core/card-dsl.js`, `explain.js` (read only), new `public/games/darbe-h/card-tags.js` | Build cost, trigger and verb tags from the parsed card DSL, not regex. Unit-test all 300 cards so none is left without a verb. |
| 3. Styles | `public/games/duel-core/design.css` (DARBE-H! block at lines 75 and 1459), `public/games/duel-core/table.css` (line 1380) | Port `cards.css` under `body[data-theme="darbe-h"]`, including the container-query tiers and states. |
| 4. Art crop | `public/games/darbe-h/assets/art-manifest.json`, `theme-meta.js` `cardArt()` | Add an art `well` rect per edition (`[28, 88, 344, 330]` for the current SVGs) and apply it as the `.legacy-frame` crop. Move to well-only plates when the art pipeline emits them (#58's 60 scene plates). |
| 5. Action bar + forecast | `public/games/duel-core/match-ux.js`, `projection.js`, `battle.js` (read only) | Add the three-step bar and a forecast strip computed from the same projection the AI uses. Hold results on the card for about 900 ms (no hold under reduced-motion). |
| 6. Logo | `public/games/darbe-h/assets/emblem.svg` → lockup / mark, `assets/favicon.svg`, `public/games/darbe-h/index.html` (favicon + apple-touch link), `src/components/portal/game-icons.tsx` (`"darbe-h"` glyph), `public/credits.html` (original-mark note) | Swap in the variants from `logo/`. The header uses `darbe-h-lockup.svg` at 30 px high. |
| 7. Tests + QA | `scripts/darbe-h-*.test.mjs`, a new `scripts/darbe-h-card-face.test.mjs` | Cover the per-theme hook (VETO-H!/GETT-OH! markup unchanged), tags for all 300 cards and the contrast tokens. Browser checks at 1440×900 and 390×844: no overflow, every state reachable in a real duel, and hand cards ≥ 44 px tap height. |

**Acceptance criteria**
- The kind can be told at 76 px by rail, glyph and position alone, with no colour dependence.
- Every text pair meets ≥ 4.5:1.
- VETO-H! and GETT-OH! DOM snapshots are unchanged.
- The same slots appear on all 300 cards.
- The action bar always names the selected card, its forecast result and the next step.
- The favicon is legible at 16 px and the maskable icon survives a circle crop.

## 8. Files needed, by concern

- **Visual production:** `logo/*`, `tools/build-logo.mjs`, `public/games/darbe-h/assets/{emblem,favicon}.svg`,
  `public/games/darbe-h/assets/art-manifest.json` (well rects),
  `src/components/portal/game-icons.tsx`.
- **Card components:** `public/games/duel-core/app.js` (`cardEl`), `theme-meta.js`,
  new `public/games/darbe-h/card-tags.js`, `match-ux.js` (action bar/forecast).
- **Responsive layout:** `public/games/duel-core/design.css` and `table.css`, scoped DARBE-H! blocks
  (container-query tiers S/M/L, hand scroller, board slot size).
- **Accessible contrast:** the tokens in §2 (copied into the scoped DARBE-H! block), the contrast
  pairs in §5 as a unit test, `prefers-reduced-motion` handling for the pulse, lift and result hold.
