# TC SIM mobile final pass — 2026-10-08

Baseline: main `51ee5ccf5b249c7a18df7b3dba2340b8025c4c34` (PR #144), exact-SHA Vercel production READY verified before work. PR #135–144 remains intact.

## Observed and corrected

Real Chromium baseline: 130 screen/state captures at 320, 360, 390, 430 and 1440 CSS px, 900 px height. No document overflow or uncaught JavaScript errors. These checks alone did not mean visual acceptance.

- At 320 px the header's shrinking action row split “Nasıl Oynanır” and “Kaydet” mid-word. Mobile-only two-column action layout retains every action and existing order.
- Language controls were about 21 px high; top shortcuts were 42 px; ledger summaries about 40 px. Mobile targets now use the existing 44 px control token. Inline source links remain prose links.
- Creation form grid styling overrode the native hidden attribute on the conditional seed field. Mobile hidden fields now stay hidden; 1980s still exposes its existing seed control.
- Istanbul map labels split Mecidiyeköy and Bayrampaşa mid-word. Mobile label width/anchor alignment now keeps names legible and separates the two banks; underlying locations, costs and coordinates are unchanged.

Only TC SIM CSS changes at <=820/700/600 px. No runtime JavaScript, state, save schema, mechanics, content, dependencies, shared-game files or desktop styles changed.

## Verification

`scripts/tc-sim-job-start-mobile.mjs` runs isolated local contexts against the built static output. It exercises all 14 menus with real compact navigation, last-record detail dialogs, all six body regions, Istanbul map selections, help, historical selectors, actual 18 April 2017 creation, FX/gold buy/sell, business start/expansion, body rest, event choices, weekly advance and saved reload. Checks include overflow, clipped controls, standalone target size, input zoom risk, state persistence and navigation without save mutation. Screenshots and JSON are CI artifacts (`tc-mobile-final`).

Existing job-start browser regression retains language/reduced-motion, offline, synthetic old-save, body, marriage, city and canonical shell checks. Production visual/gameplay acceptance belongs to the user.

Local full TC + management regression: 532/532 PASS. Build/typecheck PASS; exact static build closure 83/83. Final browser/release details are recorded in the PR.

## Limits

Chromium viewport/touch emulation, not physical iOS/Android certification. Native select option sheets and OS keyboard/safe-area variations still need device acceptance. Desktop baseline images were unchanged except pointer-hover paint on four top shortcut buttons; dimensions were unchanged. No full-site/mobile redesign.
