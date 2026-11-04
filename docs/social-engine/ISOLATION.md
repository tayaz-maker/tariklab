# Ownership and merge lock

- Owner task: SOCIAL ENGINE autonomous production mission, Codex chat2026-11-03.
- Exclusive branch: `feature/social-engine-development`.
- Base main: `d695119186cad42c079a911a60c372f201b3b64b`.
- Preserved checkpoint parent: `762c050ead437c99901332d10078817dfc375eb1`.
- Independent working directory and independent Git object database; no shared worktree/index/node_modules.
- Exclusive source: `src/games/social-engine`, `public/games/social-engine`, `scripts/social-engine*`, `docs/social-engine`, `artifacts/social-engine`.
- Minimal common integration: new explicit route, generated route registration, and two ESLint ignore entries limited to generated SOCIAL ENGINE bundles/evidence. The shared ESLint file was byte-identical in the parallel Boardworld branch at audit. Catalogue/shared sync ledger deferred because the other agent owns current edits there.

**MERGE / PRODUCTION LOCKED BY USER.** No direct main push, force push, rebase, reset-hard, PR merge, production deployment or traffic change. A passing CI or preview does not override this lock. Before any authorized future merge: verify other agent complete, refresh main, preserve both branches, run mandatory gates, obtain explicit user approval.

Push rule: read exact remote branch head immediately before push. If absent, create only this branch with normal push. If present, expected head must equal our last published checkpoint; otherwise stop that push and investigate ownership without overwriting anything.
