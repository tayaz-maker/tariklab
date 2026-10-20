# IHTILAL → JITEM compatibility and archive gate

Inspected TarikLab source: 133dbbd1912b91f651d474f2e14331e31d7becfe; JITEM source: 1171d15aff54a2758c46c514455bb2795014572f. This is a compatibility assessment, NOT an archive or a claim that a source-code transfer has shipped.

## Verified evidence

`node --test scripts/ihtilal*.test.mjs`: **69/69 PASS**, zero failures/skips, 1.10 seconds. This includes the existing card engine, AI/balance, save/preview/lifecycle and solo basin-network tests. Existing JITEM upstream full acceptance is **285/285 PASS** plus real Chromium atlas 7/7 and product 8/8 at the #25 candidate. Those are independent totals, not a single combined release count.

| IHTILAL system | Existing JITEM counterpart | Decision / status |
|---|---|---|
| Real-implementation read-only previews (briefing, solo preview) | sim/preview.ts runs executeAction on a private copy; move-preview.test.ts compares actual commits across hats/seeds | Existing JITEM equivalent DONE; no duplicate preview engine needed |
| Timed aftershocks and network arrivals | sim/planning.ts pendingPlans/tickPlans, event-family followups | Existing due-turn and projected-result coverage DONE; cross-contract review PARTIAL, do not claim fictional-region network transplanted |
| Conserved aid, no duplicated capacity on extra hops | Existing JITEM bounded resources, action costs and one-shot objective rewards; operations-depth.test.ts | Preserve conservation principle. Fictional-region state and card victory model are incompatible and must not be pasted into JITEM |
| Fail-closed checksum save/backup | sim/save.ts + store backup recovery; save-recovery.test.ts | JITEM recovery DONE for existing schema; envelope formats differ. Do not change key/schema or copy foreign saves |
| End report tied to actual compared values | sim/recap.ts dossier and causal narrative | Existing decision-derived report DONE in present scope; card locks/Ruling/Seals are inapplicable |
| Rumour/pressure propagation and explainable routes | sim/knowledge.ts asymmetric faction knowledge and allies; sim/edges.ts propagation risk; faction memory | Existing foundation DONE; further conditional/covert alliance depth PARTIAL. Extend current knowledge/relationship engines only after a concrete acceptance case |

JITEM retains historical/source/game-reconstruction distinctions, current actors, chronology, original visuals and TR/EN architecture. No TV character, plot, dialogue or source assertion is transferred. PL is not yet a distinct JITEM locale and is not certified here.

## Removal remains blocked on explicit gates

1. Close the compatibility checklist: identify which useful principles already exist, what real missing behaviour needs a small adaptation, and what is deliberately incompatible. Record any adaptation's PR and passing source/product tests. The audit alone is not a completed transfer.
2. Finish #203 and this #25 product sync: current-head CI PASS, reconcile against actual main, merge safely, verify Vercel/Workers and exact live SOURCE/runtime hashes.
3. Preserve a named GitHub archive ref at the exact final pre-removal TarikLab commit. Inventory public/games/ihtilal, docs/ihtilal, docs/ip/ihtilal-*, scripts/ihtilal*, source metadata and save contracts. Keep code/history and user saves; no force push or history rewrite.
4. In a separate reviewed retirement PR, audit catalogue/category/list entries in src/lib/games.ts, localized entries in src/lib/i18n.ts, /ihtilal redirect and /oyna/$slug dispatch, generated routing, Resources links/content, service-worker app-shell entry and direct historical URLs. Preserve unrelated games and caches. Verify no discoverable live catalogue/Resources entry remains and documented archive access works.
5. Do not archive/unpublish until the transfer and preservation gates are explicitly closed. No live route, catalogue, Resources entry, card or asset is removed by this document or sync PR.

Next implementation group: validate meaningful institution/relationship consequences with existing event/faction/knowledge engines. Do not rebuild working preview, save, atlas or delayed-operation systems simply to claim a transfer.
