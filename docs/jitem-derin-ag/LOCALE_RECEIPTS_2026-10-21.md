# JITEM English receipts and atlas labels — 2026-10-21

Baseline standalone source: `e1d5bf742d012ef9355f7d822fa31bc896cd7c8d`. Reviewed upstream candidate: [PR #30](https://github.com/tayaz-maker/jitem-derin-ag/pull/30), exact head `696d14fd4dcf5b0d7e6da55e002086c2517a16ef`.

## Observed defects and scope

English sessions showed the Turkish raw budget-action receipt and family reconstruction addendum in the footer/report, while the interactive copy/event modal already had English presentation. The selected atlas connection also rendered raw `GÜÇLÜ` and `idari / saha` in readout, previews, return schedules and accessible controls.

Translate at render time only. Existing translated action receipts are reused on exact source-text matches; the repeated budget receipt has a narrow translation. Family addenda follow the same evidence-distinction helper as EventModal. The observed connection label is translated across its readout, preview changes, return schedule, target panel and accessible SVG presentations; evidence grades use the existing dictionaries. Canonical metadata, historical/source content, calculations, random streams, replay/save bytes, storage key `jitem-derin-ag-v3`, schema 5, atlas-pixi and artwork are unchanged. Unknown legacy source records remain intact.

## Local verification

- Upstream own-lock `npm ci`; full receipt-fix suite: 151 JavaScript + 157 TypeScript = 308 PASS.
- Label follow-up: 24 focused copy/atlas model tests PASS; typecheck and production build PASS. Scoped lint: zero errors, one existing unused `actionCopy` import warning.
- Actual generated embed: product TR/EN × 320/390/1024/1440, 8/8 PASS; primary/backup/previous-generation recovery and exact reload, 4/4 PASS.
- Final visible-label atlas regression: 7/7 PASS. Actual Pixi and SVG preview equivalence, nonmutating preview, real commit/reload, context loss, resize and no-WebGL backup recovery. All console arrays empty. English readout rejects raw Turkish evidence/observed connection label; saved receipts retain original source bytes.
- Desktop and mobile screenshots visually inspected. No physical-device or human campaign-duration claim.
- Rebuilt using the unchanged TarikLab embed builder and canonical upstream lock. Only `assets/runtime.js` changes among the 30 generated files. Runtime SHA256: `687d785f05eb69153811815b41e7060b33d96e3d771a37b00047bcc4852e0ee3`.

Remote current-head CI, canonical merged source pin and product release acceptance are separate required gates. The product integration receipt must use the eventual upstream merge SHA, never the candidate head or an older checkpoint.

React review: hooks, state subscriptions, effect dependencies, model identity and DOM layout remain unchanged. Added metadata formatting is pure and constant-time; keyboard/SVG accessible labels follow the same dictionary as visible evidence text.

## Canonical continuation

Upstream PR #30 merged as `006c7e73af0f2bf4fa208ae3a46556bf903f5e33`, also the read-back upstream main. Decision atlas run `39501126952` finished SUCCESS on the exact reviewed head `696d14fd4dcf5b0d7e6da55e002086c2517a16ef`. Canonical merge tree `8af44852e1405ded48c8e360069696761403b5f2` exactly equals the tested head tree.

Fetched and checked out that canonical SHA, with unchanged upstream own-lock dependencies (`package-lock.json` SHA256 `4019853dab2595aee90979cf01b8d7bd317029a4121290f9a679b55bb93c491c`), then regenerated the embed using the unchanged portal builder. The canonical runtime equals the earlier accepted candidate bytes; all 30 generated files equal portal source and built output. SOURCE.json and integration assertion pin the canonical merge SHA; candidateStatus is removed; product identity is current.

The dedicated `scripts/jitem-canonical-browser.mjs` checks the real portal wrapper in TR/EN/PL at 390/1280. Each case starts a field campaign, applies an actual budget decision, checks schema-5 saved progress, changes the outer language twice without changing saved bytes, reloads the wrapper and restores the exact save. PL remains a Polish shell with the explicitly documented English JITEM iframe fallback; full Polish standalone content is not claimed. Source and real Cloudflare production-build preview each PASS six cases and all 31 exact game-file hashes; both JSON matrices and all hashes are identical. Source desktop/mobile screenshots were visually inspected. Evidence: `work/screenshots/jitem-canonical-source/results.json` and `work/screenshots/jitem-canonical-built/results.json`; portal build/typecheck, scoped lint and final integration 2/2 PASS.

React review: hooks, state subscriptions, effect dependencies, model identity and DOM layout remain unchanged. Added metadata formatting is pure and constant-time; keyboard/SVG accessible labels follow the same dictionary as visible evidence text.

Portal current-head CI, safe merge, new-main CI/TC and exact-main two-host production acceptance remain separate required release gates. This source integration does not claim production completion.

Merged portal main `f7da2f1854a0ab04cef571ca5537e6d9011ea942` without conflicts before final integration checks. Its archive/catalog changes are retained. Integration2/2, typecheck and production build PASS on the combined branch.

Final current-main-built matrix also PASS6/6 and31/31 exacthashes, identical to the source matrix. Durable local evidence: [canonical integration receipt](evidence/CANONICAL_INTEGRATION_2026-10-21.json).
