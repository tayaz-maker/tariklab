# HANEDANIAN

HANEDANIAN is TarikLab's single-player, offline-first strategy game. Develop a
settlement, read the terrain, scout opportunities, build an expansion network
and compete with AI dynasties. The new identity replaces the catalog name
HANEDAN; this documentation path is retained so existing documentation links
continue to work. The new game currently plays in Turkish; its portal catalog
entry is available in Turkish and English.

## Routes and legacy saves

- Canonical portal route: `/oyna/hanedanian`.
- Standalone runtime: `/games/hanedanian/index.html`.
- `/oyna/hanedan` resolves to the same new game through `canonicalPlaySlug`.
- The former `/games/hanedan/index.html` entry provides the new-game transition.
- The original squad/raid game remains playable at `/games/hanedan/legacy.html`.

The original HANEDAN simulation and its localStorage records remain intact.
Its crews, weekly raids and contracts cannot be faithfully converted into the
new world's settlements and armies. HANEDANIAN detects those saves and offers
legacy access and an exact backup; it never silently resets or pretends to
convert them. Starting a new strategy campaign is a separate operation.

## Runtime architecture

The active runtime uses dependency-free native ES modules under
`public/games/hanedanian/`. It does not use `duel-core`, the Next Wave engines,
a server simulation, accounts or cloud saves. Audio remains disabled.

| File | Responsibility |
|---|---|
| `data.js` | Original resource, terrain, strategic point, building, unit and faction definitions. |
| `world.js` | Seeded world generation, tile bounds and crossed-terrain travel sampling. |
| `engine.js` | Deterministic fixed-minute simulation, validated commands, economy, construction, armies, combat, scouting, AI, diplomacy and campaign state. |
| `map.js` | Canvas map rendering and input; emits selection/view changes without owning game rules. |
| `save.js` | State validation, corruption checks, atomic IndexedDB saves, recovery and portable exports. |
| `app.js`, `index.html`, `style.css` | Playable UI, state rendering and responsive layout. |

The detailed audit and architecture decision record is
[DESIGN_FREEZE.md](../hanedanian/DESIGN_FREEZE.md). The older Next Wave document's
HANEDAN reference describes the legacy draft/raid family, not this game's
current architecture.

## World and economic decisions

The default world is 49×49. Generation supports bounded sizes from 13×13 to
65×65; the same seed reproduces terrain and point placement. Simulation
randomness is separate from world generation. A guaranteed starting basin
provides nearby resource and scouting opportunities.

Nine terrain types change resource production, defense and movement. Erzak,
Kereste, Taş and Demir belong to settlements; Nüfuz is political capital rather
than a fifth interchangeable production resource. Nine building types and six
unit types support settlement development and specialization. Strategic points
include resource sites, a caravanserai, a pass, a watchtower and a ruin.

Armies travel over time. Travel samples the terrain along the straight overland
corridor between endpoints; this is deliberately not shortest-path roadfinding.
All generated tiles are traversable. Roads crossed by that corridor can shorten
travel, while difficult terrain can lengthen it. Scouting records timestamped
knowledge instead of exposing every opponent's live garrison.

The world supports eight default AI dynasties, four campaign stages and three
explicit achievement routes: Hâkimiyet, Zenginlik and Hanedan. AI actions use
resources, costs and queues and run on scheduled decisions rather than frames.
The player receives an initial attack grace period. Founding capitals remain
recovery anchors and can be raided but not captured; taking later settlements
requires surviving siege units. The dynasty includes five developing stats,
experience, traits and recurring heir decisions.

The 10–20-hour campaign duration in the brief is a balancing target, not an
established playtime measurement.

## Map workspace and input

Canvas2D renders visible tiles with a small buffer; no 2,401-tile DOM grid is
created. The renderer exposes near, region and world views, a minimap, selected
tile highlighting and measured render counters. Drawing is requested when the
view or state changes rather than running a permanent animation loop.

Desktop supports pointer pan, anchored wheel zoom, hover and selection. The
focusable map supports arrow-key selection, plus/minus zoom, Home to the capital
and Escape to deselect. Touch uses pointer capture, one-finger pan and anchored
two-finger pinch; moved/cancelled gestures do not turn into tile taps.

Desktop uses settlement/map/inspector columns with a collapsible settlement
rail. At mobile widths the selection inspector becomes a bounded bottom sheet
and the five primary tabs remain visible. Safe-area padding and reduced-motion
styles are included. These describe implementation contracts, not a substitute
for the measured device/browser acceptance results.

## Time and offline behavior

The player controls pause and simulation speed. Hidden/closed-app time does not
silently run attacks or penalize absence. There is no wall-clock catch-up mode.
The game core operates locally; the service worker supplies the offline shell
and assets after a successful initial online installation.

Browser storage belongs to an origin. A save created on `www.tariklab.com` is
not automatically available on `tariklab-six.vercel.app`, another browser or
another device. Use file export/import for that transfer. First-ever access to
an uncached origin still requires a connection.

## Save contract

The first released world schema is `schemaVersion: 1`. IndexedDB database
`tariklab-hanedanian`, database version 1, uses the `saves` store with slot as
its key. These are three snapshots of a campaign, not three independent
numbered campaign slots:

| Slot | Behavior |
|---|---|
| `auto` | Current autosave. |
| `previous` | Valid predecessor of autosave, rotated in the same atomic transaction. |
| `manual` | Separate explicit manual save. |

The portable envelope has `format: "tariklab-hanedanian"`, `formatVersion: 1`,
`schemaVersion`, `savedAt`, full plain state and a canonical CRC32 checksum.
CRC32 detects accidental corruption; it is not an anti-cheat or authenticity
mechanism. Invalid state, corrupt data and unknown/future versions are refused
without deleting the stored original. Invalid imports do not write anything.

Writes serialize captured snapshots. A newer verified emergency journal at
`tariklab::hanedanian:emergency:v1` can recover interrupted mobile sessions;
otherwise automatic loading prefers the valid current save and falls back to
the previous save if needed. Recovery is reported. Storage unavailability,
quota failures and stale writes produce visible failure rather than a false
success; exporting the in-memory snapshot remains possible.

There was no earlier HANEDANIAN world schema, so no invented version-0
migration exists. Future schema migration must preserve the original, validate
its checksum, migrate sequentially and commit only after successful validation.
Legacy detection/export preserves exact values for `tariklab::hanedan:1..3`
and their `:bak` entries plus `cete_hanedan_v2`, `cete_hanedan_v1` and
`cete_hanedan_bak`.

## Verification and limits

Use the repository's HANEDANIAN core/save/map regression tests and existing
catalog/route tests. Browser acceptance must independently cover small-screen
map input, desktop layout, first online installation, offline reload, save
recovery and reconnect. Passing a source test or HTTP check does not establish
those browser results. Executed release evidence belongs in the upgrade's
release report and [web sync ledger](../WEB_APP_SYNC_LEDGER.md).

The site-wide TarikLab identity and its original crown/dynasty portal glyph
remain unchanged. HANEDANIAN's systems, world names, values and visuals are
original TarikLab work; no third-party game assets, UI screens, text or tables
are bundled.
