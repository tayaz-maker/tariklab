# TanStack Start release dependency — CVE-2026-102989

Verified 2026-10-04 against the maintainer advisory and npm package metadata.

| Package | Existing lock | First patched release | Dependency origin |
| --- | --- | --- | --- |
| `@tanstack/react-start` | `1.168.48` | `1.168.60` | Direct dependency, previously `^1.168.0` |
| `@tanstack/start-server-core` | `1.169.30` | `1.169.39` | Transitive exact dependency of React Start |

Primary sources:
- https://github.com/TanStack/router/security/advisories/GHSA-qx66-fv34-fjm8
- https://tanstack.com/blog/tanstack-start-security-update-cve-2026-102989
- https://registry.npmjs.org/@tanstack/react-start/1.168.60

The advisory identifies affected React Start versions as `>=1.143.12 <1.168.60`
and affected server-core versions as `>=1.143.12 <1.169.39`. The first patched
React Start release declares server-core `1.169.39` exactly. npm also reports
Node `>=22.12.0` and Vite `>=7.0.0`, compatible with this repository's CI/runtime.

Main `95099f9` and PR heads #105 `d4c52d3`, #107 `5b381bc`, #106 `55aa196`
resolve both affected versions. This is a shared dependency exposure, not a
TC SIM content change. Pin React Start to `1.168.60` and regenerate the lock
using npm; required TanStack dependencies and their compatible supporting
packages follow that release. No game rules, source data, save keys or schemas
change. The security fix must be rebuilt and deployed to protect production.

GitHub Actions were successful on the old #105/#107 heads, while their separate
Vercel commit statuses reported `failure`. The user supplied the #106 security
rejection for React Start `1.168.48`; the connected Vercel API cannot independently
read deployment details under team `cete-d532` (403). Do not claim a verified
Vercel-specific error cause for #105/#107 until their deployment result confirms
it. The version choice is grounded in the package maintainer's advisory; no
security policy, deployment protection or required check is disabled.

Release order remains Racon (#105), JITEM vendor (#107), then historical TC SIM
(#106). Record each actual final head/merge SHA and production evidence in the
closure status after release. Previous green checks apply only to their old heads.

CI reproducibility: GitHub uses Node 22.23.3/npm 10.9.9. npm 11's initial lock
regeneration omitted Nitro's optional peer `lru-cache`, although local npm 11
`ci` succeeded. npm 10.9.9 reproduced `Missing: lru-cache@11.5.3 from lock file`.
Regenerating with npm 10.9.9 restored that entry (plus one dependency-classification
flag), and npm 10.9.9 `ci --dry-run` passed. The patch also regenerates the existing
third-party notices with `scripts/ip/third-party-notices.mjs`; license texts stay
unchanged while their recorded package versions follow the lock.
