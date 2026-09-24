# Original art replacement — 2026-09-24

Record of the public images that were replaced because their creator or source
was not recorded. This is a production record, not a licence or clearance claim.

## Replaced with code-rendered originals

| File                                            | Size      | How it is made                                              |
| ----------------------------------------------- | --------- | ----------------------------------------------------------- |
| `public/og.jpg`                                 | 1200×630  | `scripts/ip/render-original-art.mjs`                        |
| `public/x-banner.jpg`                           | 1200×264  | same                                                        |
| `public/games/jitem-derin-ag/og.jpg`            | 1200×630  | same                                                        |
| `public/games/jitem-derin-ag/x-banner.jpg`      | 1200×264  | same                                                        |
| `public/games/jitem-derin-ag/images/map.jpg`    | 1792×1008 | same; abstract network and contour lines, no real geography |
| `public/games/jitem-derin-ag/images/office.jpg` | 1792×1008 | same                                                        |
| portal hero background                          | CSS       | radial/linear gradients in `src/styles.css`                 |

The script draws inline SVG/CSS with a seeded pseudo-random generator and
renders it with Playwright/Chromium. The only reused mark is the repo's own
code-drawn T monogram (`public/brand/app-mark.svg`, register A016). No
reference image, screenshot, stock photo, map tile or third-party logo was
opened or traced. Re-running the script reproduces the files.

## Removed

- `public/brand/prism-spectrum.webp` — portal background, creator unrecorded.
- `public/games/jitem-derin-ag/images/road.jpg` — creator unrecorded, not used
  by the runtime.
- `public/games/bukucu/*.png` icons and the Bükücü Web Audio tones / vibration
  (PR #93, `docs/ip/bukucu-silence.md`).

## Follow-up (same day)

The card art that was still pending here was replaced later on 2026-09-24:
VETO-H! and GETT-OH! card art and table backgrounds, and the DARBE-H! plates.
See `docs/ip/card-art-2026-09-24.md`. The standalone `tayaz-maker/jitem-derin-ag`
repo still holds its old images; only the TarikLab copy was replaced (A014).
