# D5 — brace-expansion development dependency remediation

Scope: a local, same-major lockfile correction from main
`562831dba3b16be2a0bc8b2aec2e613eb1b80f45` on
`astra/security-brace-expansion`. No gameplay, application source, package.json,
dependency override, CI workflow, save contract or native content change.

## Exact dependency scope

| Actual locked consumer chain | Before | After |
| --- | --- | --- |
| eslint 9.39.5 → minimatch 3.1.5 → brace-expansion (`^1.1.7`) | 1.1.18 | 1.1.21 |
| typescript-eslint 8.67.0 → @typescript-eslint/typescript-estree 8.67.0 → minimatch 10.2.6 → brace-expansion (`^5.0.8`) | 5.0.9 | 5.0.12 |

Both brace-expansion nodes and their parent chains are marked `dev: true` in
package-lock.json; neither is a direct dependency. ESLint's config-array and
eslintrc also consume the same root minimatch. Existing ranges, package paths,
MIT licenses, engines and child dependencies remain unchanged. Only each node's
`version`, `resolved` and `integrity` fields changed: six fields, six removed and
six added lines. A textual reconstruction verified no npm formatting drift;
lockfileVersion remains 3. This is dependency-graph scope, not a claim that all
development tooling or deployed code has been security-audited.

## Verified upstream advisories

Official sources checked 2026-10-05. These are distinct defects in the unscoped
`brace-expansion` package, not `@isaacs/brace-expansion`.

| Advisory | Effect / severity | First fixed 1.x / 5.x |
| --- | --- | --- |
| [GHSA-6j4f-fj2g-mc7p / CVE-2026-102276](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p) | parseCommaParts stack exhaustion; High | 1.1.19 / 5.0.10 |
| [GHSA-qhr7-859c-m2p7 / CVE-2026-102278](https://github.com/advisories/GHSA-qhr7-859c-m2p7) | nested brace expansion stack exhaustion; High | 1.1.20 / 5.0.11 |
| [GHSA-q2hr-2g5m-vwhr / CVE-2026-102277](https://github.com/juliangruber/brace-expansion/security/advisories/GHSA-q2hr-2g5m-vwhr) | quadratic rewrite CPU denial of service; Moderate | 1.1.21 / 5.0.12 |

The earlier [GHSA-rgw5-rvv9-x895](https://github.com/juliangruber/brace-expansion/security/advisories/GHSA-rgw5-rvv9-x895)
is already fixed in the previous 1.1.18 / 5.0.9 lock. It is not the open finding
being remediated here. The historical note in
`docs/sources/TANSTACK_SECURITY_2026-09-30.md` names one high package-level
brace-expansion finding but omits its advisory ID; this record does not invent
an exact historical advisory identity.

## Registry provenance and installation

Metadata obtained using `npm view brace-expansion@<version> version dist engines
dependencies license --json --registry=https://registry.npmjs.org`:

- [1.1.21](https://registry.npmjs.org/brace-expansion/1.1.21), tarball
  `https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.21.tgz`,
  integrity `sha512-9zeA+KLZNNzglF2TPKRQEDyx6Yby7daAkuy8MiPzpXPsYDWi/DRM8jmwUDxokQjYqBpv5DgPiwD4h4ZZSy1Ujw==`.
- [5.0.12](https://registry.npmjs.org/brace-expansion/5.0.12), tarball
  `https://registry.npmjs.org/brace-expansion/-/brace-expansion-5.0.12.tgz`,
  integrity `sha512-YovQ3rzhaLMIrDjNDMkNS01tea93qhEhG5xy8f6+R0l+dw3Ki+5sCoIoI942iuLZTHWogWktgwVDhU09iNEimQ==`.

Node 24.19.0 / npm 11.9.0 completed
`npm ci --ignore-scripts --no-audit --no-fund` (449 packages) into this clean
worktree's own node_modules directory, confirmed not to be a symlink. npm's
normal tarball integrity validation applied. No shared node_modules was changed;
no npm lockfile rewrite was used.

## Bounded local verification

`scripts/brace-expansion-security.test.mjs` resolves each brace implementation
from its actual installed minimatch consumer. Ordinary alternatives, padded and
descending ranges, nesting, escaping, matching/non-matching files and dotfiles
are covered. Each advisory runs independently through direct brace expansion
and the real minimatch API, for both major families, in a child process with a
3-second kill deadline and 128 MiB V8 heap cap. The heap cap does not represent
a measured process-RSS ceiling. All patterns remain below minimatch's 65,536
character length guard. Over-budget literal results are allowed; crashes,
timeouts and excessive results are not.

Reproduce the unchanged installed baseline without mutating it:

```sh
BRACE_EXPANSION_TEST_ROOT=/path/to/unchanged-checkout node --test scripts/brace-expansion-security.test.mjs
node --test scripts/brace-expansion-security.test.mjs
node --test scripts/ip-register.test.mjs
npm run lint
npm run typecheck
npm run build
```

Observed baseline 1.1.18 / 5.0.9: **2 normal-behavior tests passed, 12 advisory
tests failed**. Eight stack-exhaustion cases threw RangeError; all four quadratic
cases hit the 3-second deadline and were killed. Payloads ran locally only.

Patched-run results are recorded in `docs/ASTRA_ULTRA_RUN_STATE.md`.
`scripts/ip/third-party-notices.mjs` was read and its render compared without
writing: all 55 client entries matched THIRD_PARTY_NOTICES.md byte for byte.
brace-expansion is absent from that client manifest, so no notice regeneration
or unrelated version churn was necessary.

## Limits and handoff

The attempted `npm audit --json --package-lock-only` was blocked by automatic
approval review because it exports private dependency metadata to the npm
registry beyond the scoped install/test authorization. It was not retried or
worked around. This patch reports public advisory/version checks and local
behavioral regression evidence; it claims neither a current npm-audit result
nor general security clearance or proven production exploitability.

No remote CI, push, PR, merge or deployment was performed for this checkpoint.
Release ownership remains with the parent/release agent after review. Broader
dependency updates, the existing lint warnings and unrelated advisories are
outside this change.


Release preparation: rebased onto repaired main `375b83752df3d5e16c960797cf99634af0405d31` after #113's exact two-host production proof (run37256148798, six cases). The sync-ledger conflict retained both historical entries. Dependency and test bytes are unchanged by the rebase. This narrow security branch is independent from #111's renderer work; remote CI and normal gated release remain required.
