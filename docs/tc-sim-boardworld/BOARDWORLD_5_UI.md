# Boardworld 5.0 interface and language verification

The 5.0 interface retains the existing thirteen panels, compact paper/ink/teal/coral identity, SVG city board and keyboard paths. The new decision desk prioritizes obligations, folds optional opportunities and background, and links directly to real engine actions or their relevant panel. It does not create a second clock, calendar, wallet or relationship store.

## Decisions and recovery

The board uses `getDecisionView`; a known routine stop shows its actual reason, relevant recovery actions and a contextual link. Repeating an unchanged zero-time blocker stays disabled. Payment authorization opens a read-only forecast before an explicit commit. Its review surface links to current debt/bill plans, housing terms and business overhead, and displays an established weekly debt installment when present. The UI never enables disabled weekdays or changes the player's policies itself.

NPC proposals use the existing calendar acceptance, decline and revision actions. Public chronology distinguishes when an event happened from when the player learned it, and shows the source, credibility, consequence and available response. Internal linkage IDs are not presented as narrative text. Profiles show learned facts and known relationship snapshots; they do not read private balances or future private events. District panels expose actual food/material supply, service delays and price/job/rent effects alongside available actions.

All gameplay mutations still go through `resolveAction`. Pure public views and the already-computed action list are reused by the relevant panels. Long original journals and histories remain folded or in their existing panels.

## TR, EN and PL

The baseline game itself was Turkish, even though the surrounding portal already offered three languages. This release adds game-local selected-language presentation: 2,931 shared catalog keys and aligned English/Polish value arrays, loaded lazily only when needed. Turkish does not download those three locale modules. The game listens to the existing language preference; it neither writes language into simulation state nor changes other games.

Live controls, action descriptions/reasons, current event/story copy, calendar, public society information and numeric displays use the selected language. Player names, authored personal names, district names and fictional company names stay intact. Original saved journal, memory and historical prose stays byte-preserved and is visibly labeled as original Turkish record text in EN/PL. This is a deliberate exception, not a claim that every historical sentence has been translated.

Formatting uses cached `Intl.NumberFormat`, normalizes negative zero and rounds resource forecast deltas. Turkish grouped monetary captures retain their magnitude in EN/PL. Former `busy`/`quiet`/`balanced` employer cause labels are normalized only in current presentation; saved history is untouched. A request counter makes rapid asynchronous language switches last-selection-wins. Changing language clears transient old-language notices and does not change the save.

The complete catalog exceeds the original total gzip growth target. Shared source keys avoid duplicating Turkish strings in both language chunks, and lazy loading limits the initial Turkish payload. Final acceptance reports total assets and initial-language assets separately; it must not describe the total budget as passed.

## Browser and unit coverage

`scripts/boardworld-society-browser.mjs` supports static builds and actual portal/Worker routes. It verifies every game runtime asset against the expected build and exercises 1440px/TR, 390px/EN and 320px/PL with fresh browser contexts. The journeys use actual controls and authentic released 4.0 saves:

- Disable a planning day, observe the blocked retry, use its direct recovery control, review and explicitly authorize existing payments.
- Advance a social life through real work, food, travel and waiting; receive an NPC invitation, revise and accept its canonical appointment, attend, and verify its learned public fact and causal link.
- Import an established enterprise, buy actual finite district stock and repay actual debt; save, reload and compare the state.
- Import an authentic 4.0 save, retain its immutable original, send stale 4.0 writes from a second page, and verify that current 5.0 data remains intact while legitimate 5.0 cross-tab updates still synchronize.
- Delay an EN locale response, select TR before it arrives, and verify that the late response cannot undo the latest choice.

The suite also checks scoped console/page errors, horizontal overflow, keyboard focus, touch targets and reduced-motion preference. Existing core/deep/living/emergent browser suites remain required, including actual original TC SIM play/save/reload. The new broad journey's timings are not interchangeable with the auditor's matched three-run baseline workload.

`scripts/boardworld-i18n.test.mjs` verifies catalog alignment and placeholders, signed zero and rounding, money magnitudes, composed live descriptions, asynchronous language ordering, legacy cause presentation and action copy from four authentic upgraded lives. Final build/browser/performance results are recorded in the release acceptance evidence rather than inferred from these unit checks.
