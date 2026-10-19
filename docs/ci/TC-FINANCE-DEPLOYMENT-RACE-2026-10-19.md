# TC finance production deployment race

- Canonical release: #199,14e50edd00eff73d479bc936844a92e0845d6129.
- Production browser run39334966484: Workers PASS; www job118342038736 failed22:31:06 UTC at fuelRows.length, actual0 versus expected1.
- Vercel production dpl_CH2TSqwgxKXwnpVSs78WVQFaugP1: target production, main14e50ed, READY22:32:31.616 UTC, aliases www.tariklab.com/tariklab.com. The previous alias lookup still reported d980a14 before readiness.
- Root cause: all7 visual/translation fingerprints are unchanged between d980a14 and14e50ed. Only the simulation modules learned fuel accounting, so the old deployment passed the7-file gate while producing no fuel row.
- After deployment readiness, www and Workers life.js SHA256 f0b6dc4e303d09327769635257fb4ec9649663b91b43569ff95a1b23610ee801 and wealth.js be5d2179a8240845902e3c53d458811195f5488576fbb72ab5b4e7da54cfc77d match canonical bytes. Only the failed completed www job was retried; no gameplay change.
- Repair: add exact life.js/wealth.js/locations.js hashes to the existing readiness/browser gate.7→10 paths; preserve origin restrictions, status200, redirect denial, exact content equality and bounded retry. The stale-asset regression covers every path; readiness count derives from the path list.
- This is correctness coverage, not a measured speed improvement. Full main regression/required checks remain. Final retry and PR CI results must be checked separately; this report does not predeclare them PASS.
