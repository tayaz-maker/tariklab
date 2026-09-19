# İHTİLAL — final-upgrade audit and design freeze

Baseline: canonical main `9e747eb` (2026-09-19). Scope: the standalone İHTİLAL runtime and its tests. The attached HANEDANIAN + İHTİLAL mandate governs this work.

## Diagnosis

**A — UX, primary. B — feedback, primary. C — a measured counter-window pacing defect and terminal-state defect; targeted engine fixes required. D — no evidence requiring concept replacement.**

The existing game has a coherent two-player institutional card contest: five contested desks, 3-presence locks, ten-point Ruling victory, lock tenure, counter windows, delayed files, ink/seal costs and a shared Heat alternative ending. The problem is that the interface used thematic terms before explaining the decisions. It showed an unlabeled `0 · 0` per desk; playing a selected file required discovering that the desk was the button; ending the turn was the strongest call to action. The six-page briefing interrupted play and outcomes were only inferable from changed small numbers.

The baseline 1,296-match seeded balance matrix finished with a median of 11 turns and a p95 of 25; 1,235 runs ended on Ruling, 51 on turn limit and 10 on Heat. This establishes that the loop functions and offers alternate outcomes. It does not establish that a new person understands it or enjoys five minutes of play.

## The twelve audit questions

| Question | Before | Required intervention / current implementation |
| --- | --- | --- |
| 1. Understand the aim in 30 seconds? | Unreliable: metaphorical pitch, goal hidden in help. | Menu says who the player is and “Reach 10 Ruling before your rival”; the same objective remains above play. |
| 2. Meaningful decision within two minutes? | Rules support it, but setup and six tutorial pages delay it. | One-click guided start; a legal first-card suggestion leads to actual target choice and cost/effect preview. No tutorial overlay. |
| 3. Main objective visible? | A mixed score meter with no explicit goal explanation. | A prominent score race, 10-point target and desk-lock rule. |
| 4. Resource purposes clear? | Ink, Seal, Heat were unexplained labels. | Ink: per-turn file cost. Seal: heavy-file cost and Heat finale. Heat: alternate ending. Values remain visible. |
| 5. Clear button result? | Card selection and actual play were conflated; no deltas. | Selection inspects; explicit “Desk · Play file” commits. Engine-derived preview, actual deltas, action history and persistent result. |
| 6. Understand defeat? | Finish trigger shown; winner comparison absent. | “You lost” plus actual Ruling/Seal/lock totals and the rule used. |
| 7. Understand victory? | Thematic headline; trigger only. | “You won” plus actual comparison. No unsupported promise that one changed move would reverse the result. |
| 8. Next sensible action visible? | No; end-turn button dominated. | Phase-aware instruction, suggested legal card, enabled exact targets, clear counter/pass or no-playable/end-turn states. |
| 9. Too much equal-weight information? | Meters, desks, hand, inspector, ledger and saves competed. | Objective → current decision → board/hand → outcome. Story, logs, saves and advanced setup are progressive disclosure. |
| 10. Dashboard or game? | Mostly unlabeled meters and archive jargon. | Contested desks show ownership and remaining influence; a two-player score race frames each card decision. Original paper/archive identity is retained. |
| 11. Loop in one sentence? | Yes in rules, poorly communicated on screen. | See frozen loop below; every word is reflected in the interface. |
| 12. Five-minute enjoyment signal? | Cannot infer enjoyment from simulation; initial uncertainty was a blocker. | Meaningless counter interruptions removed. Human-like first-run, desktop/mobile and five-minute browser evidence must be recorded by the integration owner; automated tests do not replace this check. |

## Frozen core loop

**Oyuncu kriz kurulundaki siyasi odağını yönetir; her tur dosyalarla beş masada nüfuz kurup rakibinin hamlelerine yanıt verir, masaları kilitleyerek rakibinden önce 10 Hüküm kazanmayı hedefler ve ortak Isı 100’e ulaşırsa sonucu belirleyen Mühür dengesini gözetir.**

A player controls a faction on a crisis board, plays files to build presence and answer the rival across five desks, and locks desks to reach ten Ruling first while watching the Seal balance that decides an early Heat-100 ending.

## Preserve / change boundary

Preserved: seeded decks and AI, all authored cards, archetypes, costs, locks, tempo, counter windows, anti-loop protections, match results, route/iframe contract, v1 schema, three manual save-slot keys and their backups. Audio remains disabled.

Changed: two targeted engine transitions described below; responsive UI hierarchy, bilingual action/resource/rules copy, non-modal first action guidance, selected-file target buttons, engine-derived read-only preview, persistent human result plus last three AI replies, own delayed-file queue, explicit outcome comparisons, automatic resume and backup. No dependency added.

New `briefing.js` is a presentation adapter over the existing engine. It snapshots public metrics, derives deltas, previews actions on a normalized clone, and suggests a legal action using the player's known cards and public desk state. It does not call the opponent AI, use the hidden hand to choose a move, or commit any preview mutation. It must be included in the app-shell offline cache.

Automatic continuation uses `tariklab.ihtilal.v1.resume` plus `.backup` with the existing checksum envelope and normalization. Manual slot keys and version remain unchanged. A storage exception is surfaced; the in-memory game remains available through the menu. New matches intentionally replace automatic continuation, while manual saves remain untouched.

## User addendum and second engine assessment

The user's follow-up explicitly permits replacing the current engine if necessary. Engine preservation is therefore a judgment, not a constraint. The extended assessment found a concrete pacing issue rather than evidence for replacing the game's central concept:

- `enterKarsi` opened a response window merely because the opponent held a Counter card. Unaffordable, wrong-desk or already-played counters still forced a meaningless pass.
- Across 50 seeded suggested-player/adaptive-AI matches, **350 of 419 response windows (84%) had no playable response**. Total actions: 1,964.
- The engine now opens a response window only when `canPlay` validates an actual response. The same 50-seed exercise has **69 response windows, zero empty windows, and 1,613 total actions**. This removes 351 interactions (about 18%) while keeping actual response decisions.
- Passing a valid response window after a first file reached 10 Ruling failed to run terminal checks when one normal move remained. The engine now resolves the result immediately after the response is passed. A focused regression test reaches this exact state.
- Old saves already inside an empty response window remain valid; the pass action closes them safely. Schema and card values do not change.

The final 1,296-match balance matrix passes: 608/656 seat wins and 32 draws, median **10 turns**, p95 **25**. End reasons: 1,237 Ruling, 48 turn limit, 11 Heat. The measured changes support a focused engine correction; arbitrary concept replacement would discard working agency without evidence.

## Verification owned by this workstream

`node --test scripts/ihtilal*.test.mjs` passes all **43 tests**: core/save/guard tests, 1,296-match matrix, read-only preview equivalence across all six archetypes, delayed-effect due dates, truthful end-report comparison, non-modal first choice, human result retention after AI, autosave-to-fresh-document continuation, keyboard help focus and stale AI callback cancellation. UI lifecycle tests use the real engine and controlled timers with a small DOM fixture; they are not a browser substitute.

Browser, mobile, offline app-shell reload, complete first-run and production checks are owned by the integration workstream. No “real mobile” or production claim is made from the DOM fixture.

## Remaining real limits

- This is an authored fictional institutional card contest, not a country-management campaign; no concept replacement was justified.
- Suggested actions are simple public-state guidance, not an optimal strategy solver.
- Delayed files show exact due turns for the player; the rival's hidden delayed identities stay hidden.
- Automatic saves are local to the device/browser; clearing site storage removes them. Storage failure is reported.
- The existing turn-based contest remains, with empty counter windows removed and result timing repaired; browser usability evidence and external player feedback remain different kinds of validation.
