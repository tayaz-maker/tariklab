# TarikLab original releases — closure

Record of what shipped from the 2026-09-24 original-release wave. Not a legal opinion. No claim that a title is free of third-party rights.

## Products

| Wave | Public name | PR | Notes |
|---|---|---|---|
| A | Kapı Nöbeti | [#91](https://github.com/tayaz-maker/tariklab/pull/91) | Slug stays `apartman`. Save version 2 is unchanged. A simple web search found an active app named Apartman Yöneticisi, so that phrase is not the public name. Night courtyard desk, at most three open decisions. |
| B | Kıyı Eşiği | [#92](https://github.com/tayaz-maker/tariklab/pull/92) | Fictional coast. Unit is a threshold. Save key `tariklab.kiyi-esigi.v1`. A paced full route can end `surekli`; a shorter ramped route can end `mahalle`. |
| C | Bükücü silence and asset record | [#93](https://github.com/tayaz-maker/tariklab/pull/93) | Generated tones and vibrate calls removed. Unrecorded PNG icons replaced with a hand-written SVG. |

Draft PRs [#78](https://github.com/tayaz-maker/tariklab/pull/78) and [#79](https://github.com/tayaz-maker/tariklab/pull/79) stay open and unmerged. They are marked do-not-merge.

## Assets

- Replaced: `public/games/bukucu/icon-180.png`, `icon-192.png`, `icon-512.png` with `public/games/bukucu/icon.svg`. Record: `docs/ip/bukucu-silence.md` and register row A015.
- Redrawn from code in #94: portal `og.jpg` and `x-banner.jpg`, the JITEM share images, map and office images, and the portal background. Record: `docs/ip/original-art-2026-09-24.md`.
- VETO-H!, GETT-OH! and DARBE-H! card art: redrawn from code in #95 (`docs/ip/card-art-2026-09-24.md`). No pending line is left on Resources.
- No audio file was added to any game.

## Production

Canonical `main` SHA and the Cloudflare `www` / workers smoke result are filled in after each green PR merges. A row stays blank until that check exists.

| PR | main SHA | www smoke | workers smoke |
|---|---|---|---|
| #91 | `a6cf31c` | `/oyna/apartman` 390: 200, avlu + 3 iş, hata yok; `app.js` byte-aynı | 1280: aynı, 6/6 dosya byte-aynı |
| #92 | `d941d85` | `/oyna/esik` 390: 200, kıyı SVG + 8 hamle, hata yok; `app.js` byte-aynı | 1280: aynı, 6/6 dosya byte-aynı |
| #93 | `e431508` | `/games/bukucu/` 390: 200, ses kodu 0, `icon.svg` 200 | 1280: aynı, 6/6 dosya byte-aynı |

## Remaining, not claimed done

- Creator and tool terms for the pending images above are still unrecorded.
- Novella slice was not touched.
- No Mac Dock test and no human playtest.
