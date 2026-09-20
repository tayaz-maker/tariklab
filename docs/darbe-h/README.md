# DARBE-H!

> Telex düşer. Masa karar verir.

## What is this game?

The third sibling of the VETO-H! / GETT-OH! deterministic card-duel family.
Two players sit at a fictional Extraordinary Desk and play officers, orders
and notices until one crisis-point total hits zero.

This is **not** İhtilâl 2 and **not** a VETO-H! or GETT-OH! reskin. It reuses
the shared duel engine (`public/games/duel-core/`) and supplies its own
theme, cards, decks, copy and visual identity.

Theme language is fictional institutional crisis: memorandum, dispatch,
cabinet, archive, redaction, legitimacy shock. It does not teach or optimize
real-world coup execution, weapons, assassination, repression, sabotage or
illegal surveillance.

## Status

**LIVE.** Canonical play is `/oyna/darbe-h`.

## Runtime

```text
public/games/darbe-h/
├── index.html
├── app.js                 — startApp("darbe-h", designs)
├── designs.js             — executable bilingual designs
├── source-cards.json      — DRB-001..300
├── decks.json             — five 40-card presets
└── assets/                — emblem, favicon, 300 crisis-desk SVG faces
```

- Game / theme id: `darbe-h`
- Save: `tariklab.darbe-h.duel` (fail-closed, checksum, foreign theme rejected)
- Settings: `tariklab.darbe-h.settings.v1` — **no** shared `tariklab.duel.settings.v1` fallback
- Onboarding: `tariklab.darbe-h.onboarding.v1` — **no** shared onboarding fallback
- History: `tariklab.darbe-h.history.v1`
- Points: KP (Kriz Puanı / Crisis Points)
- Card prefix: `DRB-`

## Decks

Muhtıra, Tebligat, Karargâh, İstişare, Zeyilname — five genuinely different
40-card lists (control, tempo, midrange, grind, recursion). Each desk mixes
free (L1–4) and paraf-costed (L5+) officers. Expansion 151–300 is 90/35/25.

## Shared engine

See [docs/duel/DUEL_ENGINE.md](../duel/DUEL_ENGINE.md). DARBE-H! does not
fork the rules engine. VETO-H! and GETT-OH! cards, saves and settings are
untouched.

## Visual

Ink-navy briefing room, telex amber, cool grey paper. Stamp crimson is a
warning only. Card faces are procedural SVG (unique per id/series), not a
painted VETO/GETT pack and not İhtilâl oxblood carbon-copy.

## Balance repair history

**Repair I** (`cbfbffa1a789b9d2801c34dc7423f9020387ba99`) fixed the generated
level/type curve and the release contracts (see git log). Independent
verification found the deck balance and first-mover metrics still failed:
Karargâh a replacement structural crown (62.5% seat-adjusted, winning 3 of 4
matchups and tying the 4th), İstişare a replacement dead deck (36.7%, no
favourable matchup), and first-mover advantage regressed to 61.8% (opening
worth +23.6 points on mirrored same-seed pairs).

**Repair II** (this branch) root-caused that regression instead of tuning
around it. The six expansion boss fusions (DRB-235..240) special-summon with
`traits.materials` and, like every fusion in the shared engine, draw their
material cost from `zones: ["hand", "units"]` unless a card overrides it
(`public/games/duel-core/summoning.js`). That default let a player fuse a
2300-2800 ATK body **on turn one straight out of the opening hand**, for a
paraf fee alone and zero board investment — an opening bomb, not a payoff.
The fix restricts only DRB-235..240 to `zones: ["units"]` (materials must
already be standing on the field) and updates their bilingual text to say so
(TR "sahadaki", EN "on the field"). Core DRB-068..073 — the first-150
freeze — default to `hand+units` exactly as before; they were not touched.

Over 3000 independent mirrored matches after the fix: deck rates 48.2-58.0%
(9.8pt spread, was 26.2pt), every matchup cell 35-66% (no cell outside
20-80%, no hard lock, no dead deck), first-mover rate 59.5% (was 61.8%),
opening delta 18.9pp over 1500 mirrored pairs (was 23.6pp). The
`scripts/darbe-h-balance-closure.test.mjs` suite (`DARBE_H_CLOSURE=1`) holds
all of this to tight closure bands programmatically.

**Deck-list tuning (the "B2" cut candidates DRB-116/DRB-087 from Karargâh)
was investigated and not applied.** Four independent samples (750, 1000,
2500 and 3000 matches, different seeds) all land inside tight closure bands
without any deck edit. Cutting cards from an already-healthy deck on top of
a fix that already closed the gate would be tuning against noise, not a
defect — the minimum-fix rule this project holds to everywhere else.

**Sibling first-mover A/B (mandatory before any further DARBE-only tuning).**
The same raw first-mover metric run on VETO-H! and GETT-OH! (1000 matches
each) found DARBE-H!'s turn-1 hand-fusion bug is not DARBE-specific at all:
GETT-OH! hand-fuses on turn one in **858/1000** matches and VETO-H! in
**109/1000** — both far worse than DARBE-H! ever was. Their first-mover
rates (55.1% / 55.8%) and opening deltas (10.2pp / 11.6pp) are lower than
DARBE-H!'s residual numbers, but DARBE-H! is not "materially worse" than its
siblings by enough to justify shared-core surgery, and this task does not
touch VETO-H!, GETT-OH! or the shared engine. **This is carried forward as a
master-freeze observation, not fixed here**: the same `zones` default
affects every sibling's own reserve-panel fusions, GETT-OH! most severely.

Known, unchanged limitation: DRB-237 (Muhtıra), DRB-238 (Zeyilname), DRB-239
(İstişare) and DRB-240 (Tebligat) — each deck's own expansion boss other
than Karargâh's DRB-236 — rarely or never fuse in these decks' actual card
mixes, on-field-only or not. This predates Repair II (the same cards were
already rarely played through hand-fusion) and is a content/synergy gap, not
a balance defect; it is not in this task's scope to author new interactions
for it.
