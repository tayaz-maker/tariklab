# Visual differentiation

> **Not legal advice.** Design-side record comparing only *abstract principles* with the
> reference category, and stating TarikLab's own decisions. Each slice PR appends its
> as-built evidence (screenshots of TarikLab's own screens only) and the adversarial
> similarity review result.

| Axis | Reference category (abstract only) | Apartment slice | Transit slice | Novella slice |
|---|---|---|---|---|
| Theme | Building/city management; transit puzzle; interactive book | Social memory and maintenance debt of one courtyard building | Rhythm network of a fictional coastal city at night | Municipal archive mystery about a vanished building |
| Primary view | — | Top-down courtyard plan (avlu) with wings and stairwells, beside a decision queue and ledger | Night cartography: water, contour lines, slopes; districts as labelled plates | Single reading column on an archive folder, with index-card choices |
| Palette | — | Dark stone and oxidised metal, warm window light, one terracotta accent | Deep navy and smoke, matte teal/ochre/rose line colours, no neon | Manila folder, graphite ink, a rubber-stamp red used only for state marks |
| Type | — | System serif for headings, system sans for data | System sans, tabular figures | System serif for body, readable at 18–22 px; user-adjustable |
| Symbols | — | Household doors with small trust/tolerance ticks; system gauges drawn as pipes/cables | District plates with need-bar glyphs; mode-specific line strokes (ferry wake dashes, lift steps, tram double rail, bridge span) | Folder tabs, stamps, card edges |
| Interaction | — | Turn = period: read → prioritise → choose approach → outcome and social echo | Turn = rhythm window: build/assign → run window → see coverage and fragility | Read → choose → consequence shown in prose and in the folder's stamp log |
| Motion | — | Minimal; state changes fade | Flow pulses along lines once per resolved window; respects reduced motion | Page transition is a short fade; respects reduced motion |
| Audio | — | None | None | None |
| Layout | — | Desktop: three-column workspace. Mobile: priority queue first, plan as an optional detail view | Desktop: map with side ledger. Mobile: map full-width, ledger as a bottom sheet with tabs | Centred column; controls in a top toolbar; mobile identical content, larger touch targets |

## Rules every slice PR must meet

1. No screenshot, crop, colour pick, measurement or layout grid from a reference.
2. No reference product name, logo, slogan or character in UI, metadata or copy.
3. A separate adversarial similarity review (Claude Sonnet subagent) compares the
   built screens with the reference category and records findings in the PR.
4. Any finding rated "close" is fixed before the PR can be marked ready.
