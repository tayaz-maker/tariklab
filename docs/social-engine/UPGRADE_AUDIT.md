# SOCIAL ENGINE 2.0 upgrade audit

Baseline: `dc302b29344021c87382d661290ecaf454a1245d`. Audit started 2026-11-04. Production manifest SHA-256 `e7ac6b6902a8e9e8183a565550049a1de8f39224346a164a9e52065a2c8087b5`. The supplied screenshot and our 1366×768 headless production capture show the same scene. This is a living inventory, not a completed acceptance verdict.

## Confirmed findings

| Priority | Finding | Reproduction / evidence |
|---|---|---|
| P1 | The visual hierarchy hides character identity and activity: people are tiny against repetitive, dominant roofs and shop facades. | Create Deniz Saha, enter the world at the default zoom, observe the market scene in the supplied screenshot or `outputs/production-baseline/world.png`. `renderer.ts` creates person sprites at scale 0.65. |
| P1 | Stopped cars retain a positive authoritative speed; resumption can therefore be abrupt and speed cannot be interpreted as actual displacement. | On unmodified source, `createWorld(920)` followed by 12 calls to `stepWorld` leaves v3 at (44, 21.02) on consecutive ticks while its speed remains 1.8. `simulation/traffic.ts` skips blocked movement without reducing speed. This is simulation behavior, not evidence of incorrect sprite orientation. |
| P1 | Seven permanent traffic drivers cannot take meal breaks. | `upgrade/DRIVER_BREAKS.txt` documents their routes, lack of safe parking and vehicle association, and a zero-wallet driver. `upgrade/ISSUES.md` explicitly excludes them from the 93-person liveness recovery. |
| P2 | Building identity is weak: roof material, massing and shopfront pattern repeat across the viewport. | Default world view, screenshot above; inspect repeated gabled roofs and similar awnings at Bereket, Sağlık and Dayanışma. |
| P2 | HUD elements are distributed across all four corners and top centre, competing with the scene. The player and nearby prompts are partially obscured by the busy centre. | Default 1366×768 production capture; inspect title, status, clock, onboarding, minimap, shortcut strip and interaction prompt. |
| P2 | Characters have four directional frames and four shared walk frames, with no separate rendered interaction or combat poses. | Inspect `rendering/renderer.ts` actor texture selection and the generated atlas; animation offset is already seeded per ID, so a shared clock alone does not prove synchronized behavior. |
| P2 | Vehicle presentation quantizes orientation to eight atlas directions. | `vehicleFrame` in `rendering/renderer.ts` picks one of eight frames using projected direction; abrupt frame changes remain possible on curves. Historical 201/201 movement alignment is evidence for that measured run, not proof for every turn. |
| P2 | Release confidence is incomplete. | `ACCEPTANCE_MATRIX.md` records 38 unverified acceptance criteria for an earlier runtime, including representative hardware and soak; `DEPLOYMENT_HOLD.md` records software-renderer journal timeouts. These are evidence gaps, not proof of corruption. |

## What was checked

- Repository modules: `domain`, `simulation`, `worker`, `persistence`, `rendering`, `ui`, tests and original asset generation scripts. Existing design, acceptance matrix, upgrade issues, visual brief, traffic brief and deployment hold reviewed.
- Live headless Chromium production smoke: asset hashes matched the checked-in manifest; character creation, district label, recorded conversation, physical D movement and save/reload location, money and conversation history passed; no page errors. This is a short automated interaction, not a human 30-minute playtest.
- The provided image was inspected alongside the live capture. A single still cannot prove motion, clipping or crowd behavior.
- Historical evidence in the matrix belongs to its recorded runtime and must not be presented as a test of changed code. Unverified release gates remain open. No low-end hardware claim is made.

## Compatibility and scope

Simulation owns traffic, navigation, determinism and save-state integrity in a separate worktree. Existing schema-8 journals replay simulation rules; changes to those rules require a preserved historical authority and migration/replay evidence. Visual work must not change simulation behavior. Test the integrated output against real projections and report fixtures separately.
