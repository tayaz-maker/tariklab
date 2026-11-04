# SOCIAL ENGINE acceptance evidence

Tested runtime commit: 0aced0368b8664300a6ff8654bac3919d34876e9. Runtime manifest: 1d2cb9211926fa48c9d555d5120dfd8c1ff7074fb97405a4b1b65f2fdb3e9438.

Decision: **BLOCKED**. These results cover the local candidate. Human sessions, physical reference hardware, production identity and live smoke require separate evidence.

## PASS (31)

| ID | Priority | Criterion | Evidence / reason |
|---|---|---|---|
| SE-001 | P0 | URL aç → Menü hatasız açılır | [browser-chromium](../../artifacts/social-engine/current-receipts/55272cf8fb084749507541a512b94d9748e5cdb3c0d7342898cec583b31e4601.json) — Fresh browser opened the character menu. |
| SE-002 | P0 | Yeni oyun → Tek oyuncu oluşur | [browser-chromium](../../artifacts/social-engine/current-receipts/55272cf8fb084749507541a512b94d9748e5cdb3c0d7342898cec583b31e4601.json) — New profile created the canonical player with 1,100 NPCs. |
| SE-004 | P0 | Karakter oluştur → Seçimler korunur | [browser-chromium](../../artifacts/social-engine/current-receipts/55272cf8fb084749507541a512b94d9748e5cdb3c0d7342898cec583b31e4601.json) — Player name, background and appearance matched the selected values. |
| SE-005 | P0 | Geçersiz ad → Güvenli doğrulama | [browser-chromium](../../artifacts/social-engine/current-receipts/55272cf8fb084749507541a512b94d9748e5cdb3c0d7342898cec583b31e4601.json) — Invalid name produced a form error and kept character creation open. |
| SE-007 | P1 | WASD ve tıklama → Doğru koordinat | [browser-chromium](../../artifacts/social-engine/current-receipts/55272cf8fb084749507541a512b94d9748e5cdb3c0d7342898cec583b31e4601.json) — Physical D moved screen-right and real canvas clicks arrived within 0.2 world units. |
| SE-008 | P1 | Kamera takip → Sınır korunur | [browser-evidence](../../artifacts/social-engine/current-receipts/325feb633301d6ea43c6baeddec5fcf924a7a92a4a45f31b9901b9fb64e3638b.json) — Camera keeps player visible at four traversable world edges at three zoom levels |
| SE-009 | P1 | Pencereyi boyutlandır → Hedef kaymaz | [browser-chromium](../../artifacts/social-engine/current-receipts/55272cf8fb084749507541a512b94d9748e5cdb3c0d7342898cec583b31e4601.json) — Canvas destination matched inverse picking at both 1440×900 and 1280×720. |
| SE-013 | P1 | İçeri gir → Doğru sahne | [browser-chromium](../../artifacts/social-engine/current-receipts/55272cf8fb084749507541a512b94d9748e5cdb3c0d7342898cec583b31e4601.json) — Market entry succeeded and an interior purchase worked. |
| SE-014 | P0 | Dışarı çık → Doğru kapı | [browser-chromium](../../artifacts/social-engine/current-receipts/55272cf8fb084749507541a512b94d9748e5cdb3c0d7342898cec583b31e4601.json) — Exit returned the player outside within 0.1 world units of the expected door. |
| SE-016 | P0 | Konuş → Doğru diyalog | [browser-chromium](../../artifacts/social-engine/current-receipts/55272cf8fb084749507541a512b94d9748e5cdb3c0d7342898cec583b31e4601.json) — The nearby named NPC accepted the greeting and a social edge was present. |
| SE-018 | P1 | Eşzamanlı konuş → Çift işlem yok | [browser-evidence](../../artifacts/social-engine/current-receipts/325feb633301d6ea43c6baeddec5fcf924a7a92a4a45f31b9901b9fb64e3638b.json) — Concurrent dialogue commands resolve once in one authoritative tick |
| SE-019 | P1 | Vardiya tamamla → Ücret ödenir | [browser-chromium](../../artifacts/social-engine/current-receipts/55272cf8fb084749507541a512b94d9748e5cdb3c0d7342898cec583b31e4601.json) — The completed retail shift raised the player balance and produced one payroll entry. |
| SE-022 | P0 | Ürün al → Stok ve nakit mutabık | [browser-chromium](../../artifacts/social-engine/current-receipts/55272cf8fb084749507541a512b94d9748e5cdb3c0d7342898cec583b31e4601.json) — Completed explicit browser assertion SE-022-stock-cash. |
| SE-026 | P0 | Kaydet yükle → Grafik korunur | [late-save](../../artifacts/social-engine/current-receipts/582695cec28134c52b74b972d487985d07bf9c6be6a73b7bea3ef6397071658a.json) — Three browser engines each verified 20 changing mature-world canonical hashes through IndexedDB save/load, covering the complete relation graph. |
| SE-029 | P0 | Tanık ve polis tetikle → Kurala uygun tepki | [browser-chromium](../../artifacts/social-engine/current-receipts/55272cf8fb084749507541a512b94d9748e5cdb3c0d7342898cec583b31e4601.json) — Assault damaged the target, created a case and triggered a wanted state. |
| SE-030 | P1 | Kaç veya teslim ol → Takip sonlanır | [browser-chromium](../../artifacts/social-engine/current-receipts/55272cf8fb084749507541a512b94d9748e5cdb3c0d7342898cec583b31e4601.json) — Surrender ended the active pursuit. |
| SE-031 | P1 | Saldır savun → Can stamina tutarlı | [browser-chromium](../../artifacts/social-engine/current-receipts/55272cf8fb084749507541a512b94d9748e5cdb3c0d7342898cec583b31e4601.json) — Completed explicit browser assertion SE-031-stamina-block. |
| SE-033 | P0 | Bin sür kaydet → Konum korunur | [browser-chromium](../../artifacts/social-engine/current-receipts/55272cf8fb084749507541a512b94d9748e5cdb3c0d7342898cec583b31e4601.json), [browser-evidence](../../artifacts/social-engine/current-receipts/325feb633301d6ea43c6baeddec5fcf924a7a92a4a45f31b9901b9fb64e3638b.json) — Completed explicit browser assertion SE-033-exact-position. / Driven vehicle, lane progress and player coordinates survive real IndexedDB save/load exactly |
| SE-035 | P0 | Bitir ödülü tekrarla → Tek ödül | [browser-chromium](../../artifacts/social-engine/current-receipts/55272cf8fb084749507541a512b94d9748e5cdb3c0d7342898cec583b31e4601.json) — The second quest completion was rejected and cash stayed unchanged. |
| SE-039 | P0 | İki kez çalıştır → Hash eşit | [late-save](../../artifacts/social-engine/current-receipts/582695cec28134c52b74b972d487985d07bf9c6be6a73b7bea3ef6397071658a.json) — Three browser engines each verified 20 changing mature-world canonical hashes through IndexedDB save/load, covering the complete relation graph. |
| SE-040 | P0 | Kaydet yükle → State eşdeğer | [late-save](../../artifacts/social-engine/current-receipts/582695cec28134c52b74b972d487985d07bf9c6be6a73b7bea3ef6397071658a.json) — Three browser engines each verified 20 changing mature-world canonical hashes through IndexedDB save/load, covering the complete relation graph. |
| SE-041 | P0 | Sekmeyi kapat → Sağlam kayıt korunur | [persistence-browser](../../artifacts/social-engine/current-receipts/889d5aacaae34d503ea948dc7951640b33e61802b681a2f93d7496782ed501d1.json) — closing a tab during an active write preserves the last committed state |
| SE-042 | P0 | Sil kopyala → Kayıp veya çoğalma yok | [persistence-browser](../../artifacts/social-engine/current-receipts/889d5aacaae34d503ea948dc7951640b33e61802b681a2f93d7496782ed501d1.json) — export/import/copy/delete preserve world and unrelated slots |
| SE-043 | P0 | Migrate et → Veri korunur | [persistence-browser](../../artifacts/social-engine/current-receipts/889d5aacaae34d503ea948dc7951640b33e61802b681a2f93d7496782ed501d1.json), [persistence-browser-firefox](../../artifacts/social-engine/current-receipts/1e2f2f40d21677a98878c6346fb9af4be520a2ca67b9c20c704c6b1830db0683.json), [persistence-browser-webkit](../../artifacts/social-engine/current-receipts/b59ec7689a95105f1c3468e06024699237e7aa5d9887f86433f5a218797aee8d.json) — migration is atomic, retryable and retains frozen source bytes; authentic v2 save migrates through an explicit journal to schema4; authentic v3 lifecycle history migrates through explicit3-to4 journal / An authentic compressed v5 snapshot and a nonempty command journal must both survive the upgrade to v6. / An authentic compressed v5 snapshot and a nonempty command journal must both survive the upgrade to v6. / An authentic compressed v5 snapshot and a nonempty command journal must both survive the upgrade to v6. |
| SE-044 | P0 | Kes yeniden dene → İdempotent | [persistence-browser](../../artifacts/social-engine/current-receipts/889d5aacaae34d503ea948dc7951640b33e61802b681a2f93d7496782ed501d1.json) — migration is atomic, retryable and retains frozen source bytes |
| SE-045 | P0 | SE aç → Eski namespace değişmez | [v4-browser](../../artifacts/social-engine/current-receipts/40b7181e708f62110b4c4d02448d9974d122570d2dbab8d2e807001b02e83862.json) — Actual legacy TC SIM save creation, SE save, byte-preserved legacy keys and legacy reload. |
| SE-052 | P0 | Kritik akışı oyna → Fatal hata yok | [browser-chromium](../../artifacts/social-engine/current-receipts/55272cf8fb084749507541a512b94d9748e5cdb3c0d7342898cec583b31e4601.json) — Local chromium 151.0.7922.34: 14 recorded critical-flow cases, 0 page errors. |
| SE-053 | P1 | Kritik akışı oyna → Temel işlevler çalışır | [browser-firefox](../../artifacts/social-engine/current-receipts/88220ea5daee656c4e3aec2de2cec1078612c72e4d66c50494cf371b6d816bbb.json) — Local firefox 153.0: 14 recorded critical-flow cases, 0 page errors. |
| SE-054 | P1 | Kritik akışı oyna → Temel işlevler çalışır | [browser-webkit](../../artifacts/social-engine/current-receipts/cd0efd5d720235592c72323dd3e1ba701fe105c007009435fe44d86d045b9359.json) — Local webkit 26.5: 14 recorded critical-flow cases, 0 page errors. |
| SE-055 | P0 | Değerleri değiştir → HUD tutarlı | [browser-chromium](../../artifacts/social-engine/current-receipts/55272cf8fb084749507541a512b94d9748e5cdb3c0d7342898cec583b31e4601.json), [browser-evidence](../../artifacts/social-engine/current-receipts/325feb633301d6ea43c6baeddec5fcf924a7a92a4a45f31b9901b9fb64e3638b.json) — Completed explicit browser assertion SE-055-dom-hud. / Visible HUD cash and needs match authoritative projection after shopping and eating |
| SE-057 | P1 | Ekranı değiştir → Kontroller taşmaz | [browser-chromium](../../artifacts/social-engine/current-receipts/55272cf8fb084749507541a512b94d9748e5cdb3c0d7342898cec583b31e4601.json) — No horizontal document overflow across 1280, 1920 and 390 pixel viewports. |

## FAIL (0)

| ID | Priority | Criterion | Evidence / reason |
|---|---|---|---|

## SKIP (0)

| ID | Priority | Criterion | Evidence / reason |
|---|---|---|---|

## UNVERIFIED (29)

| ID | Priority | Criterion | Evidence / reason |
|---|---|---|---|
| SE-003 | P1 | Çift tıkla → Çift kayıt oluşmaz | [ui-browser](../../artifacts/social-engine/ui-browser/results.json) — double submit creates one persistent player and preserves chosen profile |
| SE-006 | P1 | Limiti aş → Aşım engellenir | [acceptance-unit.json](../../artifacts/social-engine/acceptance-unit.json), [ui-browser](../../artifacts/social-engine/ui-browser/results.json) — Historical manifest 24559258aacf. Current manifest 1d2cb9211926 remains unverified for this check. / invalid profile names and excessive attribute total are rejected through real form |
| SE-010 | P0 | Duvara koş → Duvar geçilmez | [acceptance-unit.json](../../artifacts/social-engine/acceptance-unit.json) — Historical manifest 24559258aacf. Current manifest 1d2cb9211926 remains unverified for this check. |
| SE-011 | P0 | Rota iste → Geçerli rota veya ret | [acceptance-unit.json](../../artifacts/social-engine/acceptance-unit.json) — Historical manifest 24559258aacf. Current manifest 1d2cb9211926 remains unverified for this check. |
| SE-012 | P0 | Dışarı yürü → Geçersiz konum yok | [acceptance-unit.json](../../artifacts/social-engine/acceptance-unit.json) — Historical manifest 24559258aacf. Current manifest 1d2cb9211926 remains unverified for this check. |
| SE-015 | P1 | Etkileşimi tekrarla → Çift oyuncu yok | [acceptance-unit.json](../../artifacts/social-engine/acceptance-unit.json) — Historical manifest 24559258aacf. Current manifest 1d2cb9211926 remains unverified for this check. |
| SE-017 | P0 | Sahne değiştir → Tek canonical konum | [acceptance-unit.json](../../artifacts/social-engine/acceptance-unit.json) — Historical manifest 24559258aacf. Current manifest 1d2cb9211926 remains unverified for this check. |
| SE-020 | P0 | İki kez tahsil → Tek ödeme | [acceptance-unit.json](../../artifacts/social-engine/acceptance-unit.json) — Historical manifest 24559258aacf. Current manifest 1d2cb9211926 remains unverified for this check. |
| SE-021 | P1 | İş değiştir → Takvim güncel | [acceptance-unit.json](../../artifacts/social-engine/acceptance-unit.json) — Historical manifest 24559258aacf. Current manifest 1d2cb9211926 remains unverified for this check. |
| SE-023 | P0 | Ürün al → Yetkisiz negatif yok | [acceptance-unit.json](../../artifacts/social-engine/acceptance-unit.json) — Historical manifest 24559258aacf. Current manifest 1d2cb9211926 remains unverified for this check. |
| SE-024 | P0 | Faiz ve ödeme → Borç defteri mutabık | [acceptance-unit.json](../../artifacts/social-engine/acceptance-unit.json) — Historical manifest 24559258aacf. Current manifest 1d2cb9211926 remains unverified for this check. |
| SE-025 | P1 | Etkileş → İlişki değişir | [acceptance-unit.json](../../artifacts/social-engine/acceptance-unit.json) — Historical manifest 24559258aacf. Current manifest 1d2cb9211926 remains unverified for this check. |
| SE-027 | P1 | NPC bilgisini kontrol et → Nedensiz bilgi yok | [acceptance-unit.json](../../artifacts/social-engine/acceptance-unit.json) — Historical manifest 24559258aacf. Current manifest 1d2cb9211926 remains unverified for this check. |
| SE-028 | P0 | Puan değiştir → Etkiler tutarlı | [acceptance-unit.json](../../artifacts/social-engine/acceptance-unit.json) — Historical manifest 24559258aacf. Current manifest 1d2cb9211926 remains unverified for this check. |
| SE-032 | P0 | Araç rotası → Yalnız sürülebilir kenarlar | [acceptance-unit.json](../../artifacts/social-engine/acceptance-unit.json) — Historical manifest 24559258aacf. Current manifest 1d2cb9211926 remains unverified for this check. |
| SE-034 | P1 | 100 görev üret → Geçerli hedefler | [acceptance-unit.json](../../artifacts/social-engine/acceptance-unit.json) — Historical manifest 24559258aacf. Current manifest 1d2cb9211926 remains unverified for this check. |
| SE-036 | P1 | Timeout uygula → Sonsuz döngü yok | [acceptance-unit.json](../../artifacts/social-engine/acceptance-unit.json) — Historical manifest 24559258aacf. Current manifest 1d2cb9211926 remains unverified for this check. |
| SE-037 | P0 | 100000 tick → Tek konum | [acceptance-unit.json](../../artifacts/social-engine/acceptance-unit.json), [simulation-365](../../artifacts/social-engine/simulation-365/results.json) — Historical manifest 24559258aacf. Current manifest 1d2cb9211926 remains unverified for this check. / No completed current-source 365-day receipt. Historical results cannot complete this gate. |
| SE-038 | P0 | İşlem döngüsü → Ledger mutabık | [acceptance-unit.json](../../artifacts/social-engine/acceptance-unit.json) — Historical manifest 24559258aacf. Current manifest 1d2cb9211926 remains unverified for this check. |
| SE-046 | P0 | 365 gün çalıştır → Sıfır invariant ihlali | [simulation-365](../../artifacts/social-engine/simulation-365/results.json) — No completed current-source 365-day receipt. Historical results cannot complete this gate. |
| SE-047 | P0 | 365 gün mutabakat → Sıfır açıklanamayan fark | [simulation-365](../../artifacts/social-engine/simulation-365/results.json) — No completed current-source 365-day receipt. Historical results cannot complete this gate. |
| SE-048 | P0 | Yükle 365e devam → Hash aynı | [simulation-365](../../artifacts/social-engine/simulation-365/results.json) — No completed current-source 365-day receipt. Historical results cannot complete this gate. |
| SE-049 | P0 | 30 dk oyna → p95 frame <=33.3ms | [performance/2026-11-04T10-15-03-459Z/report.json](../../artifacts/social-engine/performance/2026-11-04T10-15-03-459Z/report.json) — The Apple M2 host is not the specified four-core reference PC. Its measured frame times cannot satisfy this precondition. |
| SE-050 | P1 | 60 dk çalıştır → Long task <=%5 | [performance/2026-11-04T10-15-03-459Z/report.json](../../artifacts/social-engine/performance/2026-11-04T10-15-03-459Z/report.json) — 60 continuous minutes required; fixed-tick cross-check: UNVERIFIED. Receipt status: RUNNING. |
| SE-051 | P1 | 2 saat soak → Heap eğimi <=1MB/dk | [performance/2026-11-04T10-15-03-459Z/report.json](../../artifacts/social-engine/performance/2026-11-04T10-15-03-459Z/report.json) — 120 continuous minutes required; fixed-tick cross-check: UNVERIFIED. Receipt status: RUNNING. |
| SE-056 | P1 | Klavye ile gezin → Odak görünür | [axe](../../artifacts/social-engine/axe/results.json) — Historical manifest 24559258aacf. Current manifest 1d2cb9211926 remains unverified for this check. |
| SE-058 | P0 | CI çalıştır → Kapılar geçer | [deployment-verification.json](../../artifacts/social-engine/deployment-verification.json) — A local candidate or draft PR does not verify completed applicable CI, the production deployment identity, or a live game smoke test. |
| SE-059 | P0 | ID ve SHA doğrula → Canlı commit doğru | [deployment-verification.json](../../artifacts/social-engine/deployment-verification.json) — A local candidate or draft PR does not verify completed applicable CI, the production deployment identity, or a live game smoke test. |
| SE-060 | P0 | Oyun ve eski oyun smoke → Yeni ve eski oyunlar çalışır | [deployment-verification.json](../../artifacts/social-engine/deployment-verification.json) — A local candidate or draft PR does not verify completed applicable CI, the production deployment identity, or a live game smoke test. |

The JSON matrix preserves the original preconditions, actions, expected outcomes, priorities and automation fields. Each completion points to a receipt with a SHA-256 digest. [Machine-readable matrix](../../artifacts/social-engine/results.json) · [Receipt index](../../artifacts/social-engine/current-receipts/index.json)

## Other release gates

- isolated_unit_sources: UNVERIFIED
- cross_engine_365days: UNVERIFIED
- two_human_30_minute_sessions: UNVERIFIED
- reference_PC: UNVERIFIED
- low_end_physical_hardware: UNVERIFIED
- remote_PR_CI: UNVERIFIED
- provider_ID_SHA_live_smoke: UNVERIFIED
- rollback_trial: UNVERIFIED
- headless_true_tab_visibility: UNVERIFIED
- native_200_percent_browser_zoom: UNVERIFIED
- keyboard_menu_visible_focus: UNVERIFIED
- ui_course_certificate_office_access: UNVERIFIED
- measured_process_footprint_600MiB: UNVERIFIED
- renderer_resource_teardown: PASS
- journal_recovery: UNVERIFIED
- integrated_lifecycle_mobility_social: PASS
- asset_fault_recovery: UNVERIFIED
- local_real_worker_route: UNVERIFIED
- bundle_and_cold_network: UNVERIFIED
- indexedDB_firefox: PASS
- indexedDB_webkit: PASS
- stolen_stock_unit_invariants: UNVERIFIED
- stolen_stock_and_restitution_chromium: PASS
- stolen_stock_and_restitution_firefox: PASS
- stolen_stock_and_restitution_webkit: PASS
- cold_start_character_chromium: UNVERIFIED
- cold_start_character_firefox: UNVERIFIED
- cold_start_character_webkit: UNVERIFIED
- native_zoom_and_background: UNVERIFIED
- synthetic_10000_citizens: UNVERIFIED
- twenty_event_branches: UNVERIFIED
- late_save_20_roundtrips_three_engines: PASS
- local_deployed_route: UNVERIFIED
- local_worker_smoke: UNVERIFIED
- local_portable_smoke: PASS
- legacy_district_display: PASS
- retail_and_mechanic_work_orders: PASS
- software_raster_parallel_combat_social: UNVERIFIED
- software_raster_parallel_autosave: UNVERIFIED
- unchanged_game_browser_regressions: PASS
- full_repository_regression: UNVERIFIED
- remaining_contract_obligations: UNVERIFIED

Refresh the evidence from completed local runs with `node scripts/social-engine/refresh-acceptance-receipts.mjs --candidate <tested-checkout> --checks <cases-directory> --legacy <legacy-results.json>`, then run `node scripts/social-engine/reconcile-acceptance.mjs`. Both commands run from the audit checkout. The refresher checks source or manifest identity and records the original evidence bytes.
