# DARBE-H! editorial noir artwork

The procedural room illustration generator is replaced by sixty original scene
plates. They use different spaces, camera positions, focal lengths and lighting:
command rooms, corridors, archive aisles, machinery, chambers, windows, vehicles,
material closeups and institutional exteriors. They are fictional illustration,
not historical photographs or documentary evidence; no real-person portraits.

## Runtime architecture

- Sixty 512 × 512 WebP plates in `assets/plates/`, generated specifically for this
  game using the built-in image-generation tool, then extracted from ten
  six-panel production sheets. No downloaded third-party artwork.
- `scripts/build-darbe-h-art.py` packages the plates as embedded WebP in each
  existing 400 × 560 SVG. The SVG adds only framing and source-derived identity.
- The existing 300 URLs, manifest structure/dimensions, asynchronous image decode,
  lazy loading and fallback remain intact. No runtime requests for remote images,
  no new image-generation code in the browser, no canvas render loop.
- Sixty original scenes have five camera editions, dispersed across the catalogue.
  This is **60 original scenes / 300 card editions**, not 300 independently painted
  scenes. The complete card payload is 13,389,526 bytes, about 44.6 KB per card;
  only visible cards are requested by the unchanged lazy loader.
- IDs, text, stats, kinds, tiers, decks, balance, first-150 pool, RNG, saves,
  designs and the duel engine are unchanged. VETO/GETT/İHTİLÂL are untouched.

## Presentation

`presentation.css` is loaded only by the DARBE entry page. Dark green/brass card
frames replace the pale document presentation. Hand and archive cards allocate
most of their height to artwork. Desktop card detail places the whole illustration
next to rules and combinations; phone detail stacks them with existing scrolling.
No additional game controls or HUD panels are introduced.

## Review evidence

- [60 representative cards, spanning the full catalogue](ultimate-preview/contact-60.webp)
- [Actual archive](ultimate-preview/archive.webp)
- [Actual card detail](ultimate-preview/detail.webp)
- [Actual desktop hand](ultimate-preview/hand-desktop.webp)
- [Actual phone hand](ultimate-preview/hand-mobile.webp)
- [Actual phone detail](ultimate-preview/detail-mobile.webp)

Targeted art contract tests passed. A focused actual-browser pass covered menu,
archive, detail and a started duel at desktop and 390 × 844, with no page errors
or horizontal document overflow. The visual QA script is
`scripts/darbe-premium-visual-qa.mjs`; set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` when
using a separately installed browser.

## Reproduction and creative provenance

Run `python scripts/build-darbe-h-art.py` to rebuild the 300 transports and manifest
from the retained local WebP masters. This needs only Python's standard library.
The production prompt is recorded in `editorial-generation-prompts.json`. The
sixty ordered composition names are also in the generator's `SCENES` constant.
All production masters are bundled with the repository; scratch-generated sheets
are not runtime dependencies.
