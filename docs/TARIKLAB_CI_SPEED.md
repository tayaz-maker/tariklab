# TarikLab CI routing

The `changes` job fails closed: workflow, platform, shared renderer, i18n,
package, source and unknown paths run the full browser matrix before merge.

For a one-game change, the shared unit/type/lint/build gate still runs, while
browser regression is restricted to that game's route. TC SIM: DEVLET also
runs its dedicated Pixi transition test. HANEDANIAN and İHTİLAL retain their
campaign browser coverage; HANEDANIAN also retains deterministic balance.
Documentation-only changes skip browser suites. `main` always receives the
full production checks. The `ci-<PR number>` concurrency group cancels only
obsolete commits from the same PR.
