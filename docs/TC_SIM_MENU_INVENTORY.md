# TC SIM menu and content ownership

Base reviewed: e516b861174b3514513c0befc39504b3b477f1d6. Existing navy/gold shell retained.

## Audit and final inventory

All 16 existing screens remain. Five formerly combined/scroll-only destinations now have explicit presentation routes, giving 21 canonical screens. No mechanic was added. Buttons in the top bar are shortcuts to these same routes.

| Category | Route | Content and canonical actions |
| --- | --- | --- |
| Today / general | dashboard | Life overview, economy context, recent notices and links to decisions/goals |
| Today / general | inbox | Known pending cases and recent messages |
| Today / general | character | Profile, annual priorities, lineage |
| Today / general | calendar | Week, known appointments and deadlines |
| Today / general | decisions | Existing weekly decisions, focus usage, pressures and consequence chains |
| Today / general | goals | Existing life arcs and medium-term goals |
| Today / general | saves | Three existing slot summaries; explicit load and title-screen access |
| Money and Living | finance | Budget, debt/enforcement overview, receivables, lifestyle, subscriptions, large business and regional stalls; one transaction history |
| Money and Living | banks | Existing account, transfer, card, loan, exchange and investment systems |
| Money and Living | emlak | Existing vehicle and durable goods buy/sell controls; route ID retained |
| Money and Living | market | Existing consumption shelves, purchases and risky experiences |
| Work and Development | career | Employment, job offers/changes, retirement and career history |
| Work and Development | education | All 18 programs, enrollment/intensity, progress and withdrawal |
| Relationships and Family | people | Known people, friendships, meetings, obligations and memories |
| Relationships and Family | relationships | Partner/family, marriage, cohabitation, children and existing adult decisions |
| Body and Health | body | Body diagram, selected area, health/energy/stress, existing care/recovery decisions |
| City and Living Area | home | Current home and commute; selected region's housing/move quotes; property buy/rent/sell, mortgage and existing holdings |
| City and Living Area | city | Three original current city maps; 23 directly selectable named districts; regional living/transport/risk information; link to the same home operation |
| Decisions and Events | history | Life event history |
| Decisions and Events | yearbook | Completed annual reports |
| Settings and Help | settings | Existing language/last-screen preferences, accessibility explanation, save/help links |

Help remains the existing accessible modal, usable from the primary menu, header and Settings. Health actions remain context shortcuts to the same decision dispatcher. Shared historical status/event notifications and the week control are common shell context, not another copy of a screen.

## Corrections

- Removed the map/numbered-pin legacy presentation from Home. City and Home have separate route IDs, headings and content; a selected district survives the transition without a save write.
- Replaced the Time/Focus and Goals scroll shortcuts with actual routes. Dashboard no longer owns their full action blocks.
- Moved Work out of Money. Removed the misleading Property vehicle/goods title: housing/property actions now live only in Home; the retained `emlak` route owns vehicles/goods.
- Regional stall actions moved from Home into Money, using the original renderer and action handlers. Only renderer output is filtered; all prices, IDs and economic functions remain unchanged.
- Removed the always-open cash ledger from unrelated screens and its second copy on Money. Lineage belongs to Character instead of appearing on history/yearbook too.
- Save navigation no longer saves/exits the current life. Loading is an explicit button action using the existing slot loader; title/new-game actions retain their original confirmation behavior.
- Added `#screen=<canonical-id>` (and `?screen=` entry) with browser back/forward. Same-origin `/oyna/tc-sim` owns one top-window history; the iframe listens for its back/forward/hash events. Standalone and cross-origin embeds use their own history. Invalid routes fall back safely.
- In-memory form drafts survive route/language rerenders; hidden revision fields are never restored. Successful bank operations consume drafts; errors retain them. No drafts enter V5/V6 records.
- Category/disclosure keys are independent of localized text. Single active navigation item; remembered categories, mobile drawer focus/Escape and desktop collapse retained.

## Asset reference analysis

The only runtime references to the seven old JPEG illustrations were the removed `legacyImages`/`legacyArt` block in app.js. Production source/reference searches found no other consumers. Removed `quarter-ridge.jpg`, `quarter-shore.jpg`, `quarter-edge.jpg`, `city-ankara-west.jpg`, `city-ankara-east.jpg`, `city-izmir-konak.jpg`, `city-izmir-bornova.jpg`. Historical documentation is not a runtime consumer. The three current WebP maps are byte-identical. Legacy districts, Sırt/Kıyı/Çeper contracts, housing and shop IDs remain playable/loadable; artwork removal does not migrate them.

## Compact shared system

One common rem scale: menu/buttons 13px, descriptions 12px, status labels 11px, values 13px, card titles 15–17px, page headings 22px at the default root size. Shared spacing uses 4/8/10/14/16px equivalents. Desktop menu rows are 32px; mobile controls remain at least 44px and editable fields remain 16px. Text enlargement uses rem, wrapping and natural row growth; no fixed content heights or text clipping introduced. Navy/gold colors, 258px/64px sidebar and common shell remain.

## Reproducible checks

`node --test scripts/tc-sim-menu.test.mjs scripts/tc-sim-lifetime-ui.test.mjs scripts/tc-sim-map-visual.test.mjs`

`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=<installed Chromium> node scripts/tc-sim-menu-browser.mjs .output/public built`

The browser matrix covers TR/EN/PL × 320/390/768/1280/1440px × 21 routes: real menu clicks, localized titles, one active item, content ownership, reachability of all owned controls, back navigation, layout/overflow, input drafts and language switches, direct-link reload, 23 map labels, canonical housing transition, category memory, collapsed navigation and unchanged saved bytes. Screenshots are emitted for mobile/desktop TR. Tests use isolated storage; no production or player saves are touched. Merge/deployment are reserved for ChatGPT.

The existing CI UX browser step also imports `tc-sim-menu-contract.mjs` and checks every canonical route, localized heading/weekly heading, unique active item, foreign content and horizontal overflow. No workflow or release guard was changed. The full visual script adds reachability, form drafts, actual map selection and history coverage.

Local verification: 869 TC/shared-management unit checks passed; 24 focused checks passed after the final route/help changes. Lint has zero errors (62 pre-existing warnings), typecheck and production build passed. Chromium completed 315 route/language/viewport combinations, 345 named district selections and 42 routes at 200% text scale. Final UX acceptance rechecked all 21 routes in 12 locale/viewport contexts. The built portal passed direct City entry, Home navigation, browser Back and reload at 390/1440px; the final 768px Polish spot check passed history, drafts and all 23 labels. All production TC files were compared byte-for-byte with the candidate source.
The separate region acceptance passed all 15 locale/viewport cases with no overlapping labels and performed 23 actual rent/move transactions, checking unchanged costs, decision usage, V6 persistence and no replay after reload; legacy district saves remained intact.

Existing job/outcome acceptance passed all 126 browser cases across resumed segments after updating obsolete reload/evidence-screen expectations; all 22 opening/offline cases and 102 operation scenarios passed. The committed script retains the complete default sequence.
