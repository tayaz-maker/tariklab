# Boardworld 6.0 checkpoint — incomplete

Contract read completely; verbatim copy in BOARDWORLD_6_CONTRACT.md.
Current main freshly fetched: 78ec4ee339051840037e48e80f4b07518d5a1424.
Isolated branch: feature/boardworld-gold-preparation, created from origin/main.
AGENTS.md, AGENTS.project.md, Boardworld CI, cloudflare-deploy.mjs and release-wait.mjs read.
Added standalone save-codec.mjs lossless JSON string interning foundation and two passing behavioral tests (node --test scripts/boardworld-save-codec.test.mjs). NOT integrated into persistence or loaded by runtime; no v6 migration yet. No benchmark runs, browser checks, PR, merge or deployment for6.0. Prior5.0 evidence must NOT count as6.0 acceptance.

Next: independently revalidate live5 hashes and baseline benchmarks; inspect existing docs/modules and required design/game skills before editing. Establish simulation/save/UI contracts. Preserve authenticv5 fixtures before migrating. Implement the complete attached contract, including18x365 plus730day endurance, all languages, lossless v6 persistence, batching equivalence, causal NPC/economy improvements, and byte/p95/save comparisons. Then full regression, guarded PR/main CI, existing Cloudflare Git deployment and live verification. No intermediate release.

Prior verified5 release artifacts are ../../outputs/boardworld-5-*.json relative to repository root. Existing build output remains5.0. Main production last verified5: Cloudflare build6e5c96fb-7024-4300-8c19-f3872d5cb72e / version667cf702-b68c-443c-9996-9bac6503e3bb. Recheck current state before relying on it.

Checkpoint made because the current execution budget was insufficient for the full implementation; no access failure was observed. Do not report6.0 complete.

Resume directly with codec evaluation against authentic v5 saves: measure encoded bytes and gzip, add exact replay/provenance checks, then integrate a versioned envelope only after full old-writer/migration coverage. Current codec preserves duplicate prose via dictionary references and rejects malformed references/duplicate properties/depth overflow; encoding input validation and checksum integration remain to be designed. Do not claim size improvements until measured. All NPC/economy/UI work and18x365/730 gates remain outstanding.

Latest implementation: persistence.mjs now imports codec; exportCompactGame validates through existing export/import and emits a checksum-protected dictionary envelope. importGame recognizes and validates it. Default exportGame/saveGame still write unchanged v5 format: compact bytes must NOT enter old browser slots until v6 isolation exists. Six authentic releasedv5 day366 envelopes from work/bw5-optimized/states passed exact-state roundtrip. Raw UTF8 envelopes shrink417004→288471,418796→289865,401114→278229,402093→278902,433285→303264,434998→304168 bytes. Evidence work/bw6-codec-measurement.json; these are codec tests using old fixtures, NOT new6.0 endurance runs. Save regression log work/bw6-save-tests.log. Next integrate schema6 and isolated slots with authenticv5 provenance/old-writer tests, add compact corruption tests and timing/size benchmarks; all other6.0 mechanics/release gates remain outstanding.
