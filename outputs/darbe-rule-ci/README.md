# B11 CI runner preparation — browser NOT_RUN

Base: `9e50404c0573e1cf9e2dd7e623c9c8bd98b95e56`. Owner: Astra/root. No PR/CI/merge/deploy started. The earlier engine finding remains **NOT_REPRODUCED** in valid synthetic states; real UI is **NOT_RUN** and B11 stays OPEN.

Prepared a separate `darbe-rule-proof` workflow; existing `ci.yml`, static server, #116 helpers, game rules/data/artwork/save format and dependencies are unchanged. Checkout stays shallow with credentials not persisted; only immutable protection base `9e50404` is fetched at depth 1. PR runs may cancel earlier PR runs; main production evidence is not cancelled by a later push. Triggers include package/lock, PL bootstrap and static-server tests. PRs run 12 cases against the exact `.output/public` build on explicit `http://127.0.0.1:8097`. Only main push/manual runs may access the exact two HTTPS allowlisted production origins. Each host receives independent 1440/390/320 screenshots, save envelopes, actual-origin observations and JSON reports. The Workers step still runs if the www proof fails. All errors/count mismatches remain hard failures; no retry/poll/deployment wait.

Before any browser starts, a manifest computed from this checkout's build hashes all 50 top-level DARBE/shared-duel JS/CSS/HTML/JSON files plus the DARBE art manifest and directly included PL bootstrap. Current measured source-byte cohort: 841019 bytes (not browser transfer). The built HTML source remains `games/darbe-h/index.html`, while its requested URL is canonical `/games/darbe-h/`; known hosting normalization is avoided without accepting redirects. Every host response must be HTTP200, same origin, nonredirecting and SHA256-identical. Manifest is fixed before requests; no expectations are learned from production. This is a runtime/data identity gate, not a hash of every rendered SVG or a deployment-platform attestation. Save fixtures use new isolated browser contexts, blocked service workers and no user/account session.

Two source-verified integration exceptions to the copied eight-file preparation were authorized:

- `browser-driver.mjs`: initial fixture-origin and subsequent entry visits now open canonical `/games/darbe-h/` on both loopback and production, check origin before storage mutation, and wait for the existing app-ready marker. The negative origin test additionally asserts this exact first navigation. SSR `.output/public` has no portal root `index.html`; no fake root, redirect adapter or rewritten built asset was added.
- `fixtures.test.mjs`: broad historical scripts/workflow empty-diff assertion replaced by full inventories plus original Git blob hashes for DARBE, shared duel, VETO, GETT, package and lockfile against `9e50404`. Currently **710 protected files**. Missing, changed and new nonignored production files fail. Build-generated ignored unpacked assets remain governed by the existing packer; they are not silently counted as tracked source. New proof scripts/workflow are allowed. All card trigger, costs, target/owner, pending-save, width/count and origin assertions are retained.

Validation on 2026-10-05: **17/17 targeted Node tests PASS**; syntax, workflow YAML/checkout/concurrency checks and targeted ESLint PASS; production build PASS, database migration reports DATABASE_URL absent and documented local fallback. The added real local HTTP test proves canonical HTML source-to-URL mapping and matching hash; a 302 still hard-fails and its destination is never requested. Browser was deliberately not launched (known local Chrome SIGSEGV). Node negative cases establish RED for empty/duplicate widths, redirected origin, wrong production mode/host, wrong hash, missing/changed/new protected files and GREEN for the permitted cohort. These are unit/HTTP checks, not screenshots or browser acceptance.

Commands:

```sh
node --test outputs/darbe-rule-browser-proof/*.test.mjs outputs/darbe-rule-ci/*.test.mjs scripts/static-game-server.test.mjs
npm run build
node outputs/darbe-rule-ci/run.mjs built http://127.0.0.1:8097 EVIDENCE_DIRECTORY
# Production runner also requires GITHUB_REF=refs/heads/main and push/workflow_dispatch.
```

Root review required before PR/CI launch. The historical `outputs/darbe-rule-browser-proof/README.md` and `preparation-results.json` retain original preparation provenance; this document describes only the runner integration exceptions and does not retroactively claim browser execution.
