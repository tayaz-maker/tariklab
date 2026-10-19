# TC SIM Package 3 acceptance checkpoint

Prepared 2026-10-19; release order #193 → #195 → #194. No fourth PR.
Canonical main at preparation: 8ff952c7b7b3c9575b25df57299e889c4aea7d91.
This is preparation, not canonical acceptance or a claim that Package 3 is DONE.

## Existing evidence

- Combined social3C/3D, depth3, promise reputation, risk and full frozen guard: 79/79 PASS on #193 reconciled source. This includes V5/V6 promise resolution and reload; it does not prove every future legal feature.
- #193 connects existing promise resolution to circle evidence; preserve fee, trust, NPC memory and exact-once behavior.
- #194 preserves deceased NPC history and old liabilities while refusing new offers; its canonical readiness/network/social/guard subset passed39/39 locally. Release still requires reconciliation after upstream merges and fresh CI.
- Existing risk-layer.js has heat, adult decisions, bounded risk logs, delayed cases, detention and release. Existing icra.js consumes due risk cases with fineEnforced protection.
- No explicit conviction/sabika model was located in the inspected TC JS and targeted tests. Detention or a pending risk case must not be treated as a conviction. Existing debt-account review is not a criminal trial.

## Remaining implementation groups after current releases

1. **Case history and outcomes:** reuse openCases IDs, calendar processing and existing save normalization. Distinguish pending investigation, detention, resolved case and any explicitly authored adverse outcome. Health-only risk cases must never create criminal history. Do not introduce presumed convictions from old saves. Define game assumptions separately from verified law before coding.
2. **Social and work consequences:** reuse NPC memory, circle reputation and existing career eligibility. Effects need a known source, bounded consequence and a visible explanation. Neither indefinite blanket employment exclusion nor cash/debt deletion is acceptable. No salary negotiation or finance scope reopening.
3. **Recovery:** use existing weekly actions, education, work, favors and fulfilled promises to support lawful return and rebuilding trust. Release from detention resumes existing work gates; it must not erase past liabilities or automatically clear a case/history. Avoid passive cash rewards and a new recovery screen.

## Deterministic acceptance cases

| Chain | Required assertions |
|---|---|
| Pending case → reload | Same case ID/status/due week; no second charge or duplicate evidence |
| Detention → release | No automatic conviction; blocked decisions during detention; work resumes after release |
| Health-only risk case | No criminal-record or employment penalty inferred from health data |
| Adverse outcome | Only an explicit eligible outcome records history; replay/reload cannot duplicate consequences |
| Known social consequence | Only authored witnesses/affected circles change; source is traceable, unrelated NPCs unchanged |
| Lawful recovery | Existing effort has bounded, explainable effect; old debt and case outcome remain intact |
| V5/V6 | Missing optional fields normalize safely; no invented history; SAVE_VERSION remains6 |
| Long play | 25 game years, bounded logs/cases, finite integer TL, debt/asset invariants |
| Browser | TR/EN/PL ×1280/390 Chromium, real choices, feedback and save/reload; no overlay bypass |

## Release gate

Targeted tests, lint, typecheck, build, current required CI and appropriate Chromium QA must PASS. Run canonical combined acceptance once after the group merges. Physical-device QA remains UNKNOWN/user-owned. Full statutory court/SGK simulation is not claimed. Current financial engine/UI and excluded scopes remain unchanged.
