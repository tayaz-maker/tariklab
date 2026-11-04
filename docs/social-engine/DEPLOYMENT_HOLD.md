# SOCIAL ENGINE release status

**GOLD_BLOCKED.** The owner now authorizes merge and the existing Cloudflare deploy hook after *all* mandatory quality gates pass. Current work is a [draft PR](https://github.com/tayaz-maker/tariklab/pull/256), not a verified production deployment.

The game is SOCIAL ENGINE; the first district is DARAMCIK. The public route and catalog are present in the candidate site build. A generic production route returning HTTP 200 does not prove this release is live. The source release candidate is f3c74bb6b7a3ac19ad81d10ebbd5aa1a6a430e3a; its complete runtime manifest SHA-256 is 68235850f445373b0dd4283fb12791bad98c53d4dffbd6b2f829c685bf21210f.

The published PR tree e8b2bd50e5828868edda923bcf61dcb516b0c458 matches this runtime source. In the day-180 checkpoint a whole additional day produced no pedestrian movement and no meals; deterministic replay alone cannot certify playability. The owner deferred human playtests. Physical low-end measurements and the Firefox late-save latency gate have not been satisfied. Require completed replay, soak, exact-head CI, the production serialization lock, deployment ID, traffic and public smoke. Preserve all old games and their save namespaces. See [release operations](upgrade/RELEASE_OPERATIONS.md) and [issue register](upgrade/ISSUES.md).
