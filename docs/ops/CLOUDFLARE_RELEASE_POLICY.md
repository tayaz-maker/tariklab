# TarikLab Cloudflare release policy

Canonical production is the existing tariklab Worker. www.tariklab.com is its Cloudflare-managed custom domain; tariklab.tayaz29.workers.dev is the same deployment.

Native Workers Builds Git integration: tayaz-maker/tariklab, main, root /, build npm run build. Production and preview upload command: npx wrangler versions upload. A main push prepares a candidate; it must not automatically take production traffic before mandatory GitHub CI. Promotion is deliberately gated and is not an unattended automatic deployment.

For A/B/C and subsequent releases:
1. Current canonical main must be read from GitHub. Reconcile the narrow change; preserve saves, RNG, existing engines and tests.
2. Require current-head latest mandatory CI, dedicated game checks and real source/built Chromium PASS before squash merge. Existing canceled/superseded runs remain history and cannot count as PASS.
3. Require the resulting main CI PASS and a ready Cloudflare candidate whose commit is that exact main SHA. Promote that candidate to100% only then. Keep the last accepted Worker version and source SHA for rollback.
4. Require a real actual-host production acceptance run: exact source/compiled hashes, relevant gameplay and full serialized save/reload, TR/EN/PL and390/1280. The migration baseline additionally covers all18 routes, archived routes, JITEM and real offline/corrupt-save scenarios.
5. Record source/main SHA, Cloudflare build/version, CI and production run IDs, raw artifact IDs/digests, scope and any limitation in a GitHub checkpoint. Until production PASS, the release stays OPEN/BLOCKED.
6. Never remove/loosen assertions, invent READY, merge a failed mandatory test, bypass protection or delete user data to make a gate green.

Vercel is legacy hosting. Its "Deployment rate limited — retry in24hours" FAILURE remains visible and is classified separately from code/mandatory CI. It is not a successful deployment and cannot satisfy a Cloudflare release gate. The existing repository had protected=false/rulesets=[] when inspected; none were removed.

DNS rollback values are retained in CLOUDFLARE_MIGRATION_2026-10-20_TR.md. Vercel project/mail records are retained; no domain transfer, new Worker, personal token or paid service was needed. Cloudflare native Git integration uses its existing managed build token. The two production hostnames are not independent redundancy.

RUM auto-injection is disabled because its offline telemetry requests broke the unchanged console acceptance. This only stops browser performance analytics; do not turn it back on without repeating real offline acceptance. Always Use HTTPS is enabled, apex308 preserves path/query to canonical HTTPS www, and edge certificates are active.
