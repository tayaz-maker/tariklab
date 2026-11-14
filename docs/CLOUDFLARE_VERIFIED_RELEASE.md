# Cloudflare builds after exact-main verification

The production build used to start at the same time as the main CI push runs.
The build guard correctly refused publication after its 17 × 45-second wait,
while Boardworld's full real-browser life journey could still be running for
40–50 minutes. Retrying the same Git build after those checks passed worked,
but repeated the failure on the next merge. The fix changes when the native
Git build starts; it does not increase that wait, remove tests or weaken the
exact-main publication policy.

`Cloudflare verified release` listens to successful main push completions of
`ci`, `tc-job-start-outcome` and `Boardworld quality`. It uses trusted default-
branch code and a job-scoped GitHub Actions token, without new credentials,
downloaded artifacts or dependency installation. It rereads the latest run
of every required workflow for the event's exact SHA, requires current main,
and advances `cloudflare-production` to that existing commit by fast-forward.
Pending, missing, stale or failed checks cannot advance the pointer. An
older run attempt cannot authorize a newer rerun. Incomplete API responses
and network errors fail closed.

The workflow is serialized with `queue: max`. The existing branch SHA is the
durable duplicate marker: later completion events and retries at that SHA do
nothing. An ambiguous write is never blindly retried. An ancestry check,
`force: false`, the final main reread and branch protection prevent rewinds
or unchecked writes. A newer main or a rerun can still appear after the last
API read; Cloudflare's unchanged exact-main/three-workflow guard and final
main reread remain the publication authority.

## One-time configuration and acceptance

1. Create `cloudflare-production` at the currently verified main commit. For
   this change that is the published Living World 2.0 commit
   `a5ac07a1eca1928593e401a160ace830f65bc6a5`.
2. Protect that exact branch with the same GitHub Actions checks as main:
   `boardworld`, `TC job-start / built`, and `build`; enforce administrators,
   disallow force pushes and deletion. It is an automated pointer, so it
   does not require another PR and does not require strict PR freshness.
   Main's existing PR and strict required-check protection remains intact.
3. With the owner's configuration authorization, set the existing Worker's
   production branch to `cloudflare-production` in Settings → Builds. Keep
   its repository, build command, `npm run deploy:cloudflare`, variables,
   domains and nonproduction preview behavior. Do not create another Worker,
   introduce a hook or deploy directly from a workstation.
4. Merge the repair through protected main. Its main push runs complete
   normally; the release workflow advances the pointer only after all three
   are successful. Confirm this GitHub Actions ref update starts exactly one
   Cloudflare Git build. Do not claim that cross-provider integration works
   from mock tests alone.
5. Verify the build's checked-out SHA equals current main, its Worker version
   receives 100% production traffic, and both production origins serve the
   exact expected assets. Preserve the observed run/build/version evidence.

The old main branch identity remains supported by the build guard for existing
Git build retries, but automatic production should watch only the verified
pointer. The pointer path requires all gates immediately; it never enters the
old wait loop. A failed run is repaired/rerun in GitHub Actions. A transient
release job failure can be rerun after checking its summary and pointer; an
already advanced pointer is a no-op. If Cloudflare failed after a successful
pointer advance, retry that exact Git build after checking current main and
its required checks, without making an empty commit or moving the ref backward.

Targeted tests cover trusted provenance, all three completion event orders,
duplicate attempts, stale main, later reruns, missing/pending/failed checks,
bounded API propagation retries, incomplete responses, ancestry, concurrent
ref changes and ambiguous write receipts. Existing publication and wait
negative controls remain. The actual first pointer-triggered build is a
separate release acceptance requirement.

References: [Cloudflare production branches](https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/),
[Workers build trigger restrictions](https://developers.cloudflare.com/workers/ci-cd/builds/troubleshoot/#invalid-request-body-12002-when-updating-branch-patterns),
[GitHub queued concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency),
[GitHub ref updates](https://docs.github.com/en/rest/git/refs#update-a-reference).
