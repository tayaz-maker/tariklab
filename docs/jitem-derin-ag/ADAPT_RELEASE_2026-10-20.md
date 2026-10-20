# JITEM ADAPT release — 2026-10-20

Astra detailed handoff section 8 was read before implementation. Only its three ADAPT groups were developed; no direct transfer. #24–26 were retained rather than reimplemented.

| Group | Source PR / canonical | Tests | Current-head Chromium | CI / artifact |
|---|---|---:|---:|---|
| Save reliability | #27 / 2a07f673fff67779326ec38fa561d59c3850dae4 | 293 | 31 | 39420170785 / 12262774437 |
| Due consistency | #28 / 042e5f489ad35dc29d723595e681a87d185181d6 | 298 | 51 | 39421711722 / 12264375976 |
| Relationship rumor | #29 / e1d5bf742d012ef9355f7d822fa31bc896cd7c8d | 307 | 63 | 39423394167 / 12264883127 |

All source CI, lint, typecheck and build PASS. Source PRs are separate and independently tested; the final rumor acceptance includes 400 deterministic campaigns across the existing eight balance styles. Final source tree c5078bf2620b56ebcda91c5ad501700d0e7f4e09.

Exact merged-source embed regeneration changes only assets/runtime.js, SHA-256 31deba68d1bcc5cd7cef9c813bd033a11b3cc1a40c95fee3c74918a998ad18f4. Other 29 generated files remain byte-identical. SOURCE.json pins source and runtime; schema 5 and save key jitem-derin-ag-v3 are unchanged. No generated runtime is edited manually.

Product CI and live acceptance remain separate from source acceptance. Live verification checks all 31 files including the receipt on each exact production origin, and real Chromium exercises the retained 36-case production scope plus 36 new save/due/rumor cases. A local direct HTTP 403 is not a Workers browser failure or success; only exact-origin runner/browser evidence certifies Workers. Physical-device acceptance remains with the user.
