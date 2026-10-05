1. D3 / Kıyı Eşiği P1: reject malformed v1 saves before legal moves/rendering; preserve original bytes during recovery.
2. Branch `astra/kiyi-save-hotfix`; base `be160c95eb5283e5ed2ce8bf139ef7aa714d329d`; local implementation only, no PR/push/merge.
3. RED: delete `ramps` from `serialize(apply(createCoast(3), "bagla:merdiven"))`; old deserialize accepts, legal throws on `.includes` (2 initial validation tests failed).
4. Validation: finite bounded state fields, known unique node/ramp IDs, bounded pending/log shapes, fault/phase/ending; invalid input returns null, never repaired.
5. Recovery: valid backup read without mutation; bad primary/backup retained byte-for-byte in up to eight non-evicting slots before replacement; quota/full slots block writes.
6. Compatibility: key `tariklab.kiyi-esigi.v1` / schema 1 unchanged; 500 seeded legal games and all four endings retain exact state and next-move results.
7. Upgrade: entry/app/helper use `?save=2`; app/helper share the same validator URL; actual SW-handler regression accompanies the fix; shared SW unchanged.
8. Scope: formulas through serialize are byte-identical (`7e573a8f7a04d60bc8e4ee535aa81972b488a23f6c9f9eb3f9fb6a883354fb61`); map/render/art/data/dependencies unchanged.
9. UI: calm TR/EN/PL `role=status` messages distinguish backup, preserved record and unsaved in-memory progress; no sound/motion/modal.
10. Local: 28/28 targeted; full suite 1,823 PASS / 1 existing opt-in DARBE skip / 0 FAIL; typecheck/lint/build PASS. One root build hit 2,932 transient `.rsync-tmp` ENOENT paths; retry without source changes passed; migration skipped without DATABASE_URL.
11. Limits: old HTML still opened completely offline uses old code until an online visit; this is not an atomic whole-SW upgrade. No archived real-user save or native Polish review.
12. Next: 37 actual browser cases prepared (36 TR/EN/PL × 320/390/1440 save cases + one old-cache case), exact five file hashes; normal CI/merge/two-host gate. Browser NOT RUN locally; no visual/gameplay wave.
