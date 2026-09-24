# Apartment community slice: IP evidence and release note

> **Not legal advice.** This is an engineering record. The slice must not be merged,
> which would deploy it, until counsel signs off and the public name is cleared
> (see `../TRADEMARK_CLEARANCE.md`). Until then it ships under a neutral placeholder.

## Release note (for people)

**Apartman topluluğu, prototip** (working name private; not in the catalogue).

- You sit on the board of a sixteen-household courtyard building with three wings.
- Over three periods (autumn, winter, spring) you keep four shared systems working:
  water, power, security and structure.
- Each period raises four problems as *work orders*. Board time is three units, so
  something always waits.
- Each problem allows only the approaches that fit it:
  - quick patch;
  - proper repair;
  - working together, which needs solidarity;
  - defer.
- Patches and deferrals come back more expensive.
- Proper repairs are noisy for neighbours who work from home or at night.
- Whatever a household experiences echoes to the neighbours it talks to.
- A three-period maintenance promise is kept or broken in front of everyone.
- An exact end-of-period preview shows cash, trust, maintenance debt and solidarity
  before you commit.
- The run ends in one of four building outcomes.
- Desktop shows the building plan, the work orders and the ledger side by side.
- On a phone, the priorities come first, and the building and ledger are one tap away.
- The game saves automatically in this browser. It is silent, and it is available in
  Turkish and English.

URL once merged: `/games/proto-apartman/index.html` (unlisted, `noindex`).

## IP register

- Register row: ASSET_REGISTER.csv `A019`.
- Files: `public/games/proto-apartman/{index.html,style.css,app.js,sim.js,data.js}`.
- No image, font, audio, map data or third-party code.
- The building plan is code-drawn SVG.
- All 16 households, 13 problems, outcomes and verdicts were written from scratch for
  this slice.

## Visual differentiation (as built)

- **Main view:** a top-down courtyard plan (avlu). Warm window light encodes trust.
  Toggleable layers show tolerance, needs and each system's pipes, cables, gate
  points and roof line. There is no vertical cut-away and there are no characters.
- **Decisions:** problems are written as ruled *work orders* with a single dropdown
  "board decision". This was changed after review; the first build used a bank of
  priced buttons.
- **Summary line:** a plain sentence that leads with solidarity and trust and puts
  cash last. This was changed after review; the first build used a
  currency-first metric strip.
- **Palette:** dark stone, oxidised metal, warm window light and one terracotta
  accent. Fonts are system serif and sans only.

## Adversarial similarity review

A Claude Sonnet subagent that did not write the code did this review on 2026-09-23. The owner-requested GPT and Grok roles were not available.

- Overall: **Low**. It found no reference names, text or numbers in the content.
- Medium: the decision-card shell of a tag, a title and a bank of priced buttons.
  **Fixed:** replaced with work-order sheets and a per-problem dropdown, and the
  available approaches now differ by problem.
- Medium: the order of the top metric strip. **Fixed:** replaced with a sentence led
  by solidarity and trust, with cash last and the period label on the left.
- No axis was rated Close.

## Tests and QA

- `scripts/proto-apartman.test.mjs` has 11 tests:
  - scope (16 households, 4 systems, 3 periods, valid ties);
  - preview matches commit exactly on 20 seeds and never mutates state;
  - board-time and cash limits;
  - the solidarity gate;
  - problems returning at 1.25× cost;
  - the promise;
  - echo along ties;
  - determinism;
  - save round-trip and hostile saves;
  - that the prototype stays unlisted and silent;
  - balance.
- Balance over 30 seeds:
  - Doing nothing never reaches the best outcome.
  - Patching everything never does either.
  - Planned play (full one-period lookahead) reaches it in ≥30% of seeds but not all.
  - No approach exceeds 65% of planned play's choices.
- Browser QA (Chromium, local static server): three full campaigns each at 1440×900,
  1024×768 and 390×844.
  - 0 console errors.
  - 0 px horizontal overflow at every step.
  - The preview's cash equals the committed cash in 9 of 9 periods.
  - Reload restores the phone tab.
  - No touch target is under 32 px.
  - TR/EN switching works.

## Performance

- Payload: 69 KB uncompressed for 5 files, with no images. `app.js` is 9.6 KB gzipped.
- Measured at 390×844 with 4× CPU throttling:
  - DOMContentLoaded at 64 ms;
  - a decision change to re-render takes 29–39 ms, including the exact preview;
  - one 156 ms long task at start.

## Production verification

- The production build (`npm run build`) passes and emits the slice under
  `.output/public/games/proto-apartman/`.
- Live production verification is **pending by design**. The PR must not be merged
  until counsel signs off and a name is cleared. After a merge, run the standard
  production proof (prodmatch plus a live smoke of this URL).
