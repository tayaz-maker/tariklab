# İhtilâl

> Hüküm yazılır. Arşiv unutmaz.

## What is this game?

An original TarikLab institutional card game. Two Kalem sit on a fictional
republic's Extraordinary File Board and drop files onto five desks. Desks lock.
A ruling is written — or the board dissolves.

This is **not** a digitization of the 2015 physical board game İhtilâl
(Kene Yapım / Tunca Zeki Berkkurt), and it is **not** a VETO-H! reskin.

## Status

**LIVE.** Canonical play is `/oyna/ihtilal`. `/ihtilal` redirects there.

## Runtime

`public/games/ihtilal/` — own engine, cards, AI, save, UI and CSS.

- Game id: `ihtilal`
- Save: `tariklab.ihtilal.v1.slot{1,2,3}` (fail-closed, checksum, 3 slots)
- Schema version: 1
- Seeded LCG in `rng.js` (no `Math.random` in the ruleset)

## Original rules (short)

- **Objective:** write **Hüküm 10**, mostly by locking desks.
- **Desks:** Sicil, Kasa, Manşet, Koridor, Nöbet. Not parliament / police / army / university / capital.
- **Meters:** Mürekkep 0–8 (turn ink), Mühür 0–20 (seal), shared Isı 0–100 (heat).
- **Turn:** refill ink, draw 1, resolve due aftershocks, play up to 2 files, optional counter window, lock check, discard to 7.
- **Lock:** 3 presence and a lead. +2 Hüküm. Holding two locks writes +1 Hüküm each turn. Stealable unless protected.
- **Dissolve:** heat 100 → higher seal wins, else draw.
- **Exhaustion / silence / turn 40:** locked desks, then seal, else draw.
- **Anti-loop:** same file cannot land on the same desk twice; three repeats on one desk raise heat; archive cap 12; log cap 80.

## Content

- 204 unique authored files (`ITL-001` …)
- 6 archetypes: Kalemci, Hesapçı, Manşetçi, Koridorcu, Nöbetçi, Heyetçi
- 21 multi-step chains, 32 delayed aftershocks, 9 exclusive families
- Deterministic AI profiles: aggressive, defensive, tempo, control, resource, adaptive

## Originality

Placeholder teaser copy (ALTI OK / KIRAT, 1950–80 map, Meclis·Polis·Ordu·Üniversite·Sermaye, dice/tokens, “inspired by İhtilâl 2015”) is **removed**. The name `İHTİLÂL` is kept. Expression, taxonomy, visual language and rules presentation are TarikLab-original (archive folders, oxblood stamp, carbon-copy paper).

## Shared engine

Not applicable. Duel-core and next-wave runtimes are not imported. Only generic ideas were reused: seeded RNG family, 3-slot fail-closed saves, bounded logs.

## Historical note

Older placeholder docs that listed “9 regions / 5 institutions / election every four rounds” were speculative coming-soon copy and are superseded by this file.

## Final upgrade (2026-09-19)

The gameplay model, cards, AI, v1 schema and manual slots remain compatible.
Two engine transitions are corrected: impossible counter windows no longer
interrupt play, and passing a counter resolves a reached victory threshold.
The first-run flow now starts directly with a legal guided move, visible win
condition, explicit card/target actions, real effect previews, numeric outcomes
and delayed-file timing. Resources and turn-end lock timing are explained in
context. The result screen shows the actual winner comparison.

Automatic continuation uses `tariklab.ihtilal.v1.resume` and its `.backup`, with
the same checksum envelope as manual slots. The new `briefing.js` presentation
adapter belongs in the offline app-shell cache. No network or new dependency
is required by the core or the first-run UI.

Audit, all twelve diagnostic answers, the frozen loop, limits and verification
scope: [FINAL_UPGRADE_AUDIT.md](./FINAL_UPGRADE_AUDIT.md).
