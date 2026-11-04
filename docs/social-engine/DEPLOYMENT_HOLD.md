# SOCIAL ENGINE release hold and rollback preparation

Current status: **BLOCKED — PRODUCTION_NOT_DEPLOYED**. The user explicitly suspended automatic merge and production and requested local commits. No production traffic, Cloudflare deployment, main push or other-agent PR mutation is authorized. A successful local build is not a deployment.

The user additionally prohibited visible test windows and screen/focus interference. Continue only headless/background work on this computer. `native-browser.mjs` now refuses to launch by default; any future visible-window verification belongs on a separate dedicated QA display with that operator's authorization. Do not enable its override on this user's computer. Human playtests remain deferred.

## Current integration

- Owned branch: `feature/social-engine-development`, independent checkout under this task's `work/tariklab`.
- Dedicated route: `/oyna/social-engine`; source/assets/IndexedDB belong only to SOCIAL ENGINE.
- Normal production build leaves the route disabled. `VITE_SOCIAL_ENGINE_PREVIEW=1` enables the game in an isolated preview build; `VITE_PREVIEW_MODE=1` allows the local full-site preview context.
- Local actual TanStack/Cloudflare Worker route: `http://127.0.0.1:8096/oyna/social-engine`. Independent static game: `http://127.0.0.1:8097/games/social-engine/index.html`.
- Latest read-only GitHub audit is `artifacts/social-engine/remote-isolation-audit.json`. Main remained `d695119186cad42c079a911a60c372f201b3b64b`; the other agent's open Boardworld PR254 was left untouched. Recheck before integration.
- The old external temporary preview belongs to an earlier checkpoint and is not verification of this candidate. No current provider deployment ID, immutable hosted preview or production SHA is asserted.

## Later publication sequence

1. Complete and reconcile every original criterion, all mandatory human/device evidence and unresolved findings. Keep historical failures.
2. When Git authentication is available and publishing is again requested, verify remote ownership of the intended SOCIAL ENGINE branch. Push normally only if its expected remote ancestor still matches; otherwise use a new isolated branch. Never force-push or overwrite the other agent.
3. Open a separate draft PR using the prepared review description. Reconcile shared route registration/catalogue work with the other agent's completed integration in a new ordinary commit. Re-run affected tests and exact-candidate CI.
4. Use the existing Cloudflare Git preview workflow, if available. Verify served asset hashes, provider deployment ID, commit SHA and actual preview browser play. Do not infer deployment from HTTP200.
5. Wait for the other agent's release to finish and obtain explicit user merge/production approval. This file does not grant it. Only then use the existing guarded merge/deployment process.
6. Verify production URL, commit/provider/alias identity, new gameplay and original game saves/routes; record the evidence. Report RELEASE_VERIFIED only after those checks pass.

## Rollback plan — NOT rehearsed in production

Before any authorized production promotion, record the currently serving provider deployment/version ID, traffic bindings and commit, and verify that the existing Cloudflare process can restore it. If the new release fails, hold promotion or restore that recorded previous version through the established provider workflow. An isolated game feature-off build can remove entry to SOCIAL ENGINE while retaining the old games, but must also use the established approval and deployment process.

Retain player save/export bytes and previous good revisions. Never clear IndexedDB or downgrade future saves to make an older build load. A rollback affecting save compatibility must provide a safe export/recovery path rather than silently discarding history.

After rollback, verify provider/traffic identity and actual TC SIM, Boardworld and Racon gameplay, then report the failed candidate and rollback outcome separately. No provider rollback trial has been performed in this task; its acceptance status remains UNVERIFIED.
