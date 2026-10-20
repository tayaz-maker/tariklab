# FINAL UPDATE — Cloudflare migration and Racon A CLOSED / PASS

Main remains 15ca52a07e504c7244556bd377012b842d998bf6.
Production run39454897150 completed SUCCESS, attempt2: www and Workers each passed 70 exact compiled/source file hashes, 108 route/language/viewport cases, six IHTILAL and six Kiyi archive save/action/reload cases, original Wave1 24 corrupt-save/storage-fault cases and original TC suite126 result rows. Chromium151.0.7922.34.
Both artifact ZIPs independently downloaded, SHA256 checked and selected screenshots inspected:
- Workers12281001981: d06f4d70f63addc3e97fd1ad9b5954a3b6424ade1376efa6d008edb3e23e2300
- www12280299752: 498d24037ed2383ccf4fb8ddd1cc8c5f9e4eab74092f2d263f0ee52dd9deeb4d
The earlier www artifact12280187123 is FAILED historical evidence; do not confuse it with the final artifact.

The offline failure was Cloudflare automatically injected RUM POSTs to /cdn-cgi/rum while the network was deliberately offline. Diagnostic39456147763 identified exact failed URLs; no game/save/assertion bug was inferred. RUM site configuration (previously enable excluding EU) was set to Disable and saved. Actual served TC HTML no longer contains the beacon; original unchanged suite then passed. This disables browser performance measurements, not WAF/security monitoring/SSL. No game code or assertion was relaxed.

The existing extension briefly stopped responding. Cloud Browser fallback reached sign-in; secure auth selected Google, but reading the Google authentication screen was rejected by automatic review as outside Cloudflare scope. No workaround read Google state. The already-authorized original Cloudflare session resumed and is used for all subsequent work; Google account inspection is unnecessary.

B#212 was cleanly reconciled with identical prepared tree4523c43260e07bea267154f94a744e68ee640f90; head72a40678568779d2b004144bd0d23b63ed5b987b, same PR retargeted to main and marked ready, ten-file scope. Current required CI must finish before merge. New runs: ci39458757447, TC39458757555, Racon39458757612. Retarget superseded earlier ci39458755013 and TC39458754952 by existing concurrency; their cancellation is not an accepted test result.
C#213 remote unchanged/draft until B closure. Local clean C cherry-pick retains exact prepared tree6de5ef32710ed31860b319f18b78ec278e4588df.
18-game audit readiness is preserved alongside this checkpoint. Full narrative translation and physical device certification are NOT claimed. No deferred program restarted.

Everything below is the chronological preparation checkpoint, including resolved failures.

---

# Cloudflare migration checkpoint — 20 Ekim 2026

## Canonical source and preserved handoff
Main verified from GitHub: `15ca52a07e504c7244556bd377012b842d998bf6` (Racon A #211).
Main CI [39448854353](https://github.com/tayaz-maker/tariklab/actions/runs/39448854353) and TC [39448854330](https://github.com/tayaz-maker/tariklab/actions/runs/39448854330) SUCCESS.
All current check runs were read; build, changes, build-core, browser-regression, campaign-browser, campaign-balance, TC www/workers and Workers Builds succeeded.
The existing main branch reports protected=false and rulesets=[]; no protection or required check was removed or weakened.
Vercel remains FAILURE: "Deployment rate limited — retry in 24 hours." This is a legacy deployment quota failure, not a code/test PASS and not the canonical release gate.

Read actual GitHub handoffs:
- 17:20 handoff at 477e86a573902c61e47129b8c801e6eb14740a0a.
- Continuation, Racon A blocker and game-quality continuity at 9e83027eea19d9c078d9fb00ef49de96702fbb56.
- Master handoff was not found in the main/checkpoint GitHub trees or exact-name code search. The exact-named saved Library copy TARIKLAB-MASTER-HANDOFF-2026-10-20(1).md was read separately; it is not falsely attributed to GitHub.
All completed TC SIM/JITEM/archives/Wave 1 decisions and deferred programs remain binding.

## Existing infrastructure, no new Worker
Account: 1c23838a8ed57b3cabd47e117b6ebb62.
Existing Worker: tariklab; endpoint https://tariklab.tayaz29.workers.dev.
Git integration already connected tayaz-maker/tariklab main, root /, npm run build.
Production A build: 96dea54e-80f7-4a81-8c24-6ee30b451490, version label 1a0557a0, 100% traffic.
Rollback candidate: pre-A 272c5ea08340de09e777ee60a03b0ccd4da96632, build 0ef3d6dc-ac72-4a03-9d79-155d176069da, version label 8ed58b71.
Nitro cloudflare-module emits .output/server/wrangler.json: name tariklab, index.mjs, nodejs_compat, ASSETS ../public.
Same-main local build: 1,676 static files, 98,070,160 bytes; largest 9,107,446 bytes, no file above 25 MiB. Free static limits: 20,000 files and 25 MiB/file. No paid upgrade or purchase.
Runtime secrets BETTER_AUTH_SECRET and DATABASE_URL already exist and remain encrypted; values were never revealed or changed. Supabase client dependency remains https://omzpbtqdycimveepkylz.supabase.co; no database/data migration was performed.

## DNS/HTTPS changed after actual Worker acceptance
Before: www CNAME 9505bdd839309649.vercel-dns-017.com, DNS only, Auto; apex A 76.76.21.21, DNS only, Auto.
The old www record was replaced by a Cloudflare-managed Worker custom domain targeting the existing tariklab Worker.
Apex A is now 192.0.2.0, proxied, Auto, with an enabled Single Redirect:
- filter: (http.host eq "tariklab.com")
- target: concat("https://www.tariklab.com", http.request.uri.path)
- status 308, preserve query string=true.
Always Use HTTPS enabled; HTTP www now redirects 301 to the same HTTPS path/query.
Observed HTTPS and HTTP apex redirects preserve /oyna/racon?migration=1. Valid active Universal/managed edge certificates observed.
Mail MX/SPF/DKIM and _vercel verification records retained. Vercel project not deleted. No domain transfer.
Both www and workers.dev now reach ONE Worker deployment, not two independent releases.

## Racon A acceptance
[39453421549](https://github.com/tayaz-maker/tariklab/actions/runs/39453421549) final SUCCESS, attempt 2.
Workers passed before DNS change. Initial www failure correctly identified stale A bytes. After DNS migration, retry only failed www job passed unchanged assertions.
Each origin: 14 exact source files, six region/weekly-seal Chromium cases, six portal full serialized save/reload cases. TR/EN/PL x 390/1280.
Workers artifact 12278688819, ZIP SHA256 3a0a457f4b4269612ca9ff7b2c086f1dbf166a7ceeece3bbf3448e4ea8436504 independently downloaded/verified; selected mobile/desktop screenshots inspected.
www artifact 12278844782, GitHub digest 3c3016703464428cc966230392d7649348628258b4bb85dec3faec915be2eadc. Connector download returned a URL but local transfer twice returned 503; do not claim an independent local ZIP verification.
Actual www Chrome rendering inspected and screenshot captured.
A has known untranslated legacy atmosphere/navigation text covered by pending C; A acceptance is not a full corpus translation certificate.

## Broader migration acceptance: NOT CLOSED
QA branch qa/cloudflare-migration-20261020, head ba9a4094d6bcf2ee6cbba8bf650b3f7f0f60605c.
First proof 39454536282 failed because generated HANEDANIAN SW was compared to raw source. Corrected to exact same-commit compiled output, no equality/assertion removed.
Run 39454897150: 108 live route cases per origin (18 games x TR/EN/PL x 390/1280), exact file hashes, six IHTILAL and six Kiyi archive save/action/reload cases passed; original Wave 1 24 save/corrupt-save/storage-fault cases passed on www.
The www TC offline original suite then FAILED with two ERR_INTERNET_DISCONNECTED console messages at its unchanged errors=[] assertion. Gameplay/state checks preceding it passed. Do not waive this failure or close migration.
Diagnostic commit 7a1f8ed1206b8e4478c36c569e95ec1246ac8ed8 / qa/cloudflare-offline-diagnostic-20261020 adds request/console URL diagnostics without changing any acceptance assertion.
TC Workers broader run pending at checkpoint. Physical QA remains UNKNOWN/user-owned.

## Release policy, preserved test gates
Workers Builds production command changed and saved from npx wrangler deploy to npx wrangler versions upload.
Main pushes build/upload candidates but do NOT automatically move production traffic before GitHub CI.
For every release:
1. Reconcile small PR on current canonical main and require all current-head mandatory code/Chromium checks PASS.
2. Vercel quota FAILURE remains visible and explicitly classified; it cannot replace or hide a failed mandatory test.
3. Squash merge; verify new main CI and exact matching Workers candidate.
4. Promote only that verified main version, keep prior version for rollback.
5. Run exact-source/compiled-SW and actual-host Chromium acceptance; close only when PASS.
No login/device flow, personal API token, new secret, paid plan, or protection bypass.

## B/C and next action
#212 and #213 remain open drafts, unchanged remote heads/bases. Neither was merged.
B locally clean-cherry-picked onto main; exact tree 4523c43260e07bea267154f94a744e68ee640f90 matches the prepared B tree.
Prepared reconciled Git object 72a40678568779d2b004144bd0d23b63ed5b987b is NOT yet installed on the remote B branch.
Next: diagnose/fix the actual offline resource failure, pass full migration acceptance, then B retarget/current-head CI/squash/Cloudflare acceptance, then C. Do not restart completed TC/JITEM or deferred art/performance programs.
