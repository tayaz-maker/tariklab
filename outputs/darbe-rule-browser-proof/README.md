# B11 — DRB-237–240 browser counterproof preparation

Status: **B11 OPEN; browser NOT_RUN; no production conclusion.** Owner: Astra/root after #116. No PR, workflow, gate, shared engine, card data, runtime or artwork change. Browser launch was deliberately not attempted because local Chrome SIGSEGV is already known.

Base: `dfbab3f15b74df5336fecf9f7d4247184cbb9222`. Prior 21/21 real-engine investigation: `a0bc478295a16d0a7120b7d200b0df61dc86af29`, `outputs/darbe-rule-repro`. This narrow preparation does not repeat or overrule that investigation and does not close the reported P1 UI/trigger finding.

| Card | Field materials | Exact cost | Expected effect |
| --- | --- | ---: | --- |
| DRB-237 | DRB-005 + DRB-006 | 900 KP | Open enemy DRB-097 returns to enemy hand |
| DRB-238 | DRB-007 + DRB-008 | 1000 KP | Same target condition and destination |
| DRB-239 | DRB-009 + DRB-010 | 1100 KP | Same target condition and destination |
| DRB-240 | DRB-011 + DRB-012 | 1200 KP | Same target condition and destination |

These are `fusion` auxiliary material summons, **not ritual summons**: actual UI says `Special Summon` / `Özel Çağır`. Source: `public/games/darbe-h/designs.js`, `duel-core/summoning.js`, `actions.js`, `app.js`, `labels.js`. Existing auxiliary instances are reused to avoid duplicate names in the pile selector. The engine chooses a legal landing position; these material plans contain no explicit slot/enabler.

`fixtures.mjs` imports existing Node fixture/engine APIs and builds four synthetic, validated saved positions: own turn 3/main1, 8000 KP each, two correct face-up field materials, one auxiliary boss and one open opposing support DRB-097. This is a valid saved-state fixture, **not proof of natural-match reachability, AI frequency or a full match**. Engine validation and exact serializer/checksum round trips are required before browser use. Negative hand-only-material control also runs.

Public browser path: Continue → own auxiliary pile → named card → Special Summon → summoned board card → Activate Effect → reload pending choice → Continue → Choose → exact effect → reload. The single eligible target is intentionally auto-selected by the existing UI when Choose is clicked; there is no fabricated target-dialog click. No browser engine import, window state hook, direct dispatch, disabled validator or private API. Browser `evaluate` only seeds/reads localStorage and measures DOM overflow.

Save contract: `tariklab.darbe-h.duel`, existing version-1 checksum envelope from `duel-core/save.js`; each UI command also preserves its previous valid record as `.backup`. Driver saves before/summoned/choice/after records and backups, screenshots and summaries; verifies costs/material locations/target owner and destination, reload equality, errors and overflow. Intended sizes: 1440×900, 390×844, 320×844, English labels, reduced motion. **None executed yet.** Service workers are blocked to isolate this rule investigation; offline/SW, other languages, natural play and full production smoke remain outside this proof.

Executed on 2026-10-05:

```sh
node --test outputs/darbe-rule-browser-proof/fixtures.test.mjs
node outputs/darbe-rule-browser-proof/prepare.mjs
node --check outputs/darbe-rule-browser-proof/browser-driver.mjs
# Existing installed ESLint + repo config, these four .mjs files only.
```

Result: **5/5 Node tests PASS**, four reproducible checksum saves generated locally, driver syntax PASS, targeted ESLint PASS (0 findings). Protected 1049 tracked files under DARBE/duel-core/scripts/.github unchanged against the base. `preparation-results.json` contains measured Node stages and fixture hashes; it explicitly labels browser NOT_RUN. Initial test caught a test-only assumption about explicit summon slots; corrected from actual legal actions. No production defect was inferred from that test authoring error.

`prepare.mjs [evidence-directory]` recreates all four `.save.json` fixtures (default `/workspace/screenshots/darbe-rule-browser-preparation`). `browser-driver.mjs` only exports `runDarbeRuleBrowserProof(browser, origin, evidenceDirectory)` and **does not launch a browser or server**. Root may integrate it with an already-running authorized Playwright browser after #116; inspect actual screenshots before interpreting a successful machine result. Console/network/overflow failures remain failures. No test can mark browser PASS until the driver really runs.
