# Transit-network slice: IP evidence and release note

> **Not legal advice.** This is an engineering record. The slice must not be merged,
> which would deploy it, until counsel signs off and a public name is cleared. The
> working name "Akış Hatları" collides with an existing web game and stays internal
> (see `../TRADEMARK_CLEARANCE.md`). The slice ships under a neutral placeholder and is
> never described by comparison with any other game.

## Release note (for people)

**Kıyı ritmi ağı, prototip** (working name private; not in the catalogue).

- You connect the daily rhythm of a fictional bay city: ten districts, six days, four
  windows a day.
  - Morning: work and school.
  - Midday: care and health.
  - Evening: the return and care.
  - Night: night life and urgent health.
- Terrain decides the line:
  - bay ferries cross the water;
  - slope lifts climb the hills;
  - neighbourhood trams run on the flat;
  - a footbridge spans the creek.
- Build points buy lines, extra frequency, night service or a ramp.
- Some conditions change what the network can carry:
  - Only lines with night service run at night.
  - Stairs stop half of care and health travellers.
  - Wind halves ferry capacity in the commute windows. The forecast shows today and
    tomorrow.
- Districts offer agreements on days 1, 3 and 5.
  - Keeping one gives build points and eases the district.
  - Breaking one makes the district more fragile.
  - A district that reaches full fragility cuts itself off, and three cut off ends
    the run.
- Before you run a day, an exact forecast shows each window's coverage, accessibility,
  transfer reliability and fragility.
- Desktop shows the map beside the day panel. On a phone, the map, day and ledger are
  tabs, and the map scrolls sideways at a readable size.
- The game saves automatically in this browser. It is silent, and it is available in
  Turkish and English.

URL once merged: `/games/proto-transit/index.html` (unlisted, `noindex`).

## IP register

- Register row: ASSET_REGISTER.csv `A020`.
- Files: `public/games/proto-transit/{index.html,style.css,app.js,sim.js,data.js}`.
- The fictional coastline, contours and district coordinates are hand-authored. No real
  city or map was consulted.
- No image, font, audio, map data or third-party code.

## Visual differentiation (as built)

- **Palette:** deep navy night cartography, matte teal, ochre and rose, with topographic
  contour lines and bay ripples.
- **Districts:** named plates with need glyphs, a housing mark, elevation ticks and a
  fragility rule. There are no geometric station or passenger shapes.
- **Lines:** each mode is drawn differently: a ferry wake as a dashed curve, a lift as a
  stepped line, a tram as a double rail, and a footbridge as a dotted span. Moon and ramp
  marks show upgrades.
- **Time model:** turn-based days made of rhythm windows. There is no clock dial and no
  overflow timer.
- **Economy:** build points and district agreements. There is no weekly vehicle or tunnel
  pick.

## Adversarial similarity review

A Claude Sonnet subagent that did not write the code did this review on 2026-09-23.

- Every axis was rated **Low**: premise, time model, map, colours, station and passenger
  shapes, line style, economy, loss condition, HUD, mobile and text.
- A grep for reference-specific terms found zero matches.
- There were no Medium or Close findings, so no changes were required.

## Tests and QA

- `scripts/proto-transit.test.mjs` has 10 tests:
  - the terrain grammar, with no tram across the bay and no tram up the slope;
  - build points, upgrades and same-day undo;
  - the forecast equals the run on 12 seeds × 3 days and never mutates state;
  - night service, and ramps raising accessibility;
  - wind halving ferries;
  - agreements that are due, kept, broken or declined;
  - the cut-off end condition;
  - hostile saves;
  - that the prototype stays unlisted and silent and is never called a "metro" game;
  - balance.
- Balance over 16 seeds:
  - Doing nothing always ends in the worst outcome ("districts cut off").
  - Building only trams never reaches the best outcome.
  - Planned play (greedy on the exact forecast) reaches the best outcome in ≥40% of
    seeds but not all, and uses at least 3 modes.
- Browser QA (Chromium, local static server): three full six-day runs each at 1440×900,
  1024×768 and 390×844.
  - 0 console errors.
  - 0 px page overflow; on mobile the map scrolls inside its own frame.
  - The forecast equals the result in 18 of 18 days.
  - No touch target is under 32 px.

## Performance

- Payload: 58 KB uncompressed for 5 files, with no images.
- Measured at 390×844 with 4× CPU throttling:
  - DOMContentLoaded at 86 ms;
  - a build click to a re-render takes 90–143 ms, including the exact six-window forecast;
  - 0 long tasks after the forecast was computed once per render. Before that there
    were 2, up to 61 ms.

## Production verification

- The production build passes.
- Live verification is **pending by design**; see the note at the top.
