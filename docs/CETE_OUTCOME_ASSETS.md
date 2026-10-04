# Çete Savaşları — outcome asset record

- Authoring: original deterministic TypeScript + inline SVG + scoped CSS in this repository; no third-party image, icon, scene or asset.
- `src/game/outcome-moment.ts`: seeded seven-block abstract ledger; connection paths derived from those block coordinates. Seed identifies the completed milestone, never gameplay RNG.
- `src/components/game/outcome-moment.tsx`: original folded record and hexagonal trace stamp; no place, institution, person, vehicle or weapon representation.
- `src/components/game/outcome-moment.css`: existing Çete palette/font tokens; bounded 200/1600/2000 ms entry/trace/stamp. No new font/download/canvas/audio. Reduced motion disables all animation.
- Information hierarchy: actual cash/reputation/pressure delta, net energy, committed crew duration, newly set/extended reaction clock. The visual depicts a recorded action; the numbers are engine output, not a forecast or reward grant.
- Screens: current pre-decision and post-decision views at 1440/390/320, TR/EN, normal/reduced motion. CI artifact `cete-outcome/{preview,built}/*-{before,after}.png`; the main run adds `{www,workers}`. These are paired interaction screenshots, not a claim of different engine versions.
- Save/engine unchanged: schema 15, legacy key `cete-savaslari-save-v1`; slot hydration never invokes the model. Presentation is discarded on screen/save-world change.
