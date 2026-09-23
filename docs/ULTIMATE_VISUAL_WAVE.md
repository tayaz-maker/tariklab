# Ultimate visual wave — review candidate

Base: `b07f75f90d4c8389592fb30be4d4ab33cfbe0562`.
Branch: `astra/hanedanian-darbe-ultimate-visual`.
Stacked on `sonnet/hanedanian-darbe-design-refinement`. Do not merge automatically.

## HANEDANIAN

The terrain cache now contains a continuous material field sampled from the existing world, directional relief, contour engraving, traced mountain-belt axes, scattered forest canopy and field parcels. It no longer paints an ellipse at each cell or draws a mesh of cell-boundary ridges. Close and distant caches have different vector detail densities. Roads, rivers, positions and picking remain anchored to the authoritative 49×49 grid. Dark forest/brass chrome replaces the pastel surfaces without increasing HUD dimensions.

The simulation/world/save files are unchanged. Visual variation uses an independent deterministic hash and consumes no gameplay RNG. The existing single-world/single-mode offscreen cache remains; regular pan/resize uses a blit and visible overlays.

Actual Chromium screenshots: [1280×720](ultimate-preview/map-1280.webp), [1920×1080](ultimate-preview/map-1920.webp), [390×844](ultimate-preview/map-390.webp), [whole world](ultimate-preview/map-world.webp).

Measured changed-screen render: cached resize frames ~7–16 ms; first close terrain cache ~1.8 s; first whole-world cache ~0.36 s in this environment. No horizontal document overflow at the requested viewports. These are observed samples, not a universal FPS guarantee.

Remaining limits: the preserved generated world's broad north–south biome bands are still visible at world zoom. Close-cache construction is synchronous and can cause a one-time pause when switching detail mode. The illustration remains algorithmic cartography, not hand-painted terrain.

## DARBE-H!

See [editorial plate architecture and real screens](darbe-h/EDITORIAL_PLATES.md). Sixty original illustrated scenes supply 300 camera editions, retaining the existing 300 SVG addresses and manifest schema. Local WebP is embedded into SVG transport; shared lazy loading is unchanged. Full card corpus is 13.39 MB. This is sixty original paintings with editions, not 300 independent paintings.

Card data, decks, stats, text, balance, RNG, save, first-150 and 90/35/25 are unchanged. VETO/GETT/İHTİLÂL files are unchanged.

## Focused verification

Changed map camera/gesture tests and updated renderer contract passed; DARBE art contract and changed-file lint passed. Production build and typecheck passed. Actual desktop/mobile hand, archive, detail, and sixty-scene sheet were visually reviewed. No full-site audit or soak was run.
