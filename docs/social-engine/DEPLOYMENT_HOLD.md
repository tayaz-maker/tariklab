# SOCIAL ENGINE release status

**GOLD_BLOCKED.** The owner now authorizes merge and the existing Cloudflare deploy hook after *all* mandatory quality gates pass. Current work is a [draft PR](https://github.com/tayaz-maker/tariklab/pull/256), not a verified production deployment.

The game is SOCIAL ENGINE; the first district is DARAMCIK. The public route and catalog are present in the candidate site build. A generic production route returning HTTP 200 does not prove this release is live. The source release candidate is 99d9148734a7ec81a18366f74e1bdb9c02988450; its complete runtime manifest SHA-256 is f99509aa3dcccb828b95d91266db8b0f6d66e065e3bbd38d341195326810cb5e.

The owner deferred human playtests. Physical low-end measurements and the Firefox late-save latency gate have not been satisfied. Require completed replay, soak, exact-head CI, the production serialization lock, deployment ID, traffic and public smoke. Preserve all old games and their save namespaces. See [release operations](upgrade/RELEASE_OPERATIONS.md) and [issue register](upgrade/ISSUES.md).
