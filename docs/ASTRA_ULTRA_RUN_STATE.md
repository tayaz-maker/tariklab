# Astra Ultra — game-by-game run state

Updated: 2026-10-05 (UTC). Owner: Astra for non-card implementation, normal protected merges and two-host verification. The 2026-10-05 ownership split assigns all 900 card illustrations/frames/generators/assets to Grok; Astra retains later invariant/quality/release review. Earlier Terra / Sol / Luna handoffs below are historical; the latest dated checkpoint governs current status. No red/pending merge or CI bypass.

## 1. HANEDANIAN — living relief atlas

- Branch: `astra/hanedanian-living-atlas`
- Base: merged #100, `dee186f7c437e2675765bebe7ffdeec9a271cf9c`.
- Published implementation SHA: `421443a18562b627985c6c3a19e5bd3f56c1f571` (subsequent checkpoint commits update this record only).
- Exact tested tree: `940e469faf15df9bcc809f84bea084cf2ad15ec6`, identical to local tested commit `c7f8fdd17e873e74d45eaac2e89dd487af8aa93e`. Shell HTTPS push lacked credentials, so the connected GitHub API published the identical tree; no source changes were introduced during publication.
- Release PR: [#102 — living relief atlas and point logistics](https://github.com/tayaz-maker/tariklab/pull/102).
- First published checkpoint head: `ce3750465bf272176223d49307e04b66b9dc3b2d`; the PR handoff identifies the latest documentation-only head. Gate the actual PR head when releasing.
- Status: **merge-ready checkpoint**; implementation, clean-build browser and real offline gates passed. CI/merge/production belong to the release agent.

### Material change

The existing seeded 49×49 Kuzey Işığı Rölyefi, cached atlas and optional Pixi terrain remain the foundation. Original procedural capitals, walled towns/forts, caravanserais, towers, ruins, quarries, mines, pastures and passes now change silhouette/detail across world, region and near zoom. Road wear, river cuts and real crossings are baked into static terrain. Ownership pennants and the active route remain separate live overlays; unseen route segments are dashed. Mobile hides incidental labels before the active destination.

The inspector explains actual road/rough-terrain travel, pass/inn effects, tower sight, visible hostile exposure and point contribution. An owned point can be reassigned to another eligible town using a five-influence courier: the source keeps its contribution until arrival; ownership/range/capacity are checked again on arrival; a recalled/failed courier refunds once after returning. Pending claims reserve the four-point capacity. Current and proposed marginal production make the old-town loss visible before confirmation.

Real regressions fixed: west/north road endpoint stubs; founder farm forecast; false threats from protected truces/vassals/peaceful couriers; point-slot overbooking; transfer watch-step registration; route details closing on each tick; fallback focus/initial renderer state; overlapping 320 px resource values. Known software WebGL devices now use the same atlas through Canvas after baseline and candidate both reproduced black stale terrain tiles under SwiftShader. Eligible hardware keeps Pixi.

### Changed files

- Map/runtime: `public/games/hanedanian/{map.js,map-pixi.js,map-factory.js,map-dom.js,app.js,index.html,style.css,sw.js}`.
- Rules/decision explanation: `public/games/hanedanian/{engine.js,mapintel.js,orders.js}`.
- Regression proof: `scripts/{hanedanian-logistics.test.mjs,hanedanian-map-relief.test.mjs,hanedanian-map-pixi.test.mjs,hanedanian-ui.test.mjs,hanedanian-ultra-browser.mjs,hanedanian-browser.mjs}`.
- Provenance/continuity: `docs/ip/ASSET_REGISTER.csv` (A023), `docs/WEB_APP_SYNC_LEDGER.md`, this file.

### Save, provenance and fallback contract

- Existing HANEDANIAN schema 1 and storage keys are unchanged. Optional courier metadata is validated. Old saves/ordinary pending claims and courier save/reload are covered by tests.
- Original code geometry only. No imported artwork, real map/person/brand/logo, new runtime dependency, music, sound, autoplay or vibration. Existing pinned Pixi dependency is retained.
- Canvas starts immediately. Pixi swaps in only on eligible WebGL. Failed/unsupported/software GL stays on Canvas. Real context loss replaces the failed Pixi renderer while preserving state/camera/selection. Async initialization, reset and destruction release canvases/textures.
- “Defter” offers an SVG/DOM surface using the same selection, inspector and order flow; lack of Canvas selects it automatically. It includes arbitrary tile coordinates, nearby places, keyboard controls and focus preservation, and is included in the atomic offline package.

### Local proof

- Baseline HANEDANIAN: 109/109 tests passed.
- Full `npm test`: 1,629 passed, zero failed, one existing optional stress test skipped. This full run preceded the final software-device classifier; the final classifier and all HANEDANIAN changes subsequently passed **129/129** focused tests.
- Clean `npm run build`, `npm run typecheck`: passed. `npm run lint`: zero errors, 59 existing warnings.
- Clean output/source parity: all 18 HANEDANIAN files checked; 17 byte-identical, `sw.js` differs only by the intended generated package-version hash. Incremental build had retained stale static files; final browser proof uses the verified clean output.
- Baseline browser: six desktop/mobile Pixi/Canvas scenarios, 90 recorded checks. Candidate before software guard: nine Pixi/Canvas/DOM scenarios, 132 checks, including actual Pixi context-loss recovery. SwiftShader visuals failed despite functional success; those runs are not claimed as successful GPU visual proof.
- Final clean-build browser: **9/9 scenarios, 141 recorded checks, zero failures** at 1440/390/320, across automatic software-device Canvas, forced no-WebGL Canvas and forced no-Canvas SVG/DOM. Campaign start, real build/scout actions, selected orders, zoom bands, pan, layers, resize, five screens, save/reload and new-world reset passed. Root visually inspected desktop decision, 320 atlas and 390 DOM screenshots; no black terrain rectangle or mobile resource overlap.
- Existing real offline/touch/save suite: **20 recorded checks, zero browser/console errors**, `HANEDANIAN_SOAK_MS=0`. Real queues, scout, claim, founding expedition, touch pan/pinch, native history and save/reload passed at 1280/1920/360/390. Real Service Worker + IndexedDB offline reload/edit, failed uncached request with networking disabled, previous-autosave corruption recovery, invalid import and reconnect all passed. Evidence: `/workspace/screenshots/hanedanian/results.json`.

| Forced Canvas viewport | Baseline first interaction | Candidate first interaction | Baseline median CPU draw | Candidate median CPU draw |
| --- | ---: | ---: | ---: | ---: |
| 1440 | 311.2 ms | 279.3 ms | 7.5 ms | 5.6 ms |
| 390 | 305.5 ms | 225.4 ms | 7.2 ms | 4.6 ms |
| 320 | 208.8 ms | 230.7 ms | 4.4 ms | 3.7 ms |

Automatic software fallback first interaction: 301.1 / 413.3 / 251.5 ms and median CPU draw 6.8 / 7.2 / 4.5 ms (1440 / 390 / 320). DOM first interaction: 253.8 / 181.5 / 170.4 ms. These are bounded measurements on this runner, not FPS or universal speed claims; 320 forced-Canvas startup is slightly slower than baseline.

Reproduction: `node --test scripts/hanedanian-*.test.mjs`; `node scripts/hanedanian-ultra-browser.mjs --serve .output/public --label final --expect-renderer canvas` on confirmed software WebGL (omit `--expect-renderer canvas` on a hardware runner so actual Pixi is required). Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` when using a locally supplied Chromium. JSON/screenshots for this session: `/workspace/screenshots/hanedanian-ultra/{baseline,head,final}`; durable measured results are recorded above.

### Open limitations and release ownership

- This runner exposes SwiftShader, not a physical GPU. The final default renderer must be Canvas with an explicit `software` reason; physical-GPU Pixi visual quality requires the release smoke. Hidden renderer names remain eligible rather than assuming hardware failure.
- Browser timings measure CPU draw/submission time, not GPU latency or FPS. Compare Canvas to Canvas; one bounded machine run is not a universal performance claim.
- No schema migration, platform/workflow change, PR #101 edit, TC SIM historical-branch duplication or Novella work is included.
- Terra / Sol / Luna: run the required checks against the actual PR head. At this base these are `ci / build`, `ci / campaign-browser`, and `ci / campaign-balance`; honor current branch protection if #101 changes the job layout. Merge only when required checks are green. Do not fold unrelated fixes into this checkpoint.
- Production routes: `/oyna/hanedanian` and `/games/hanedanian/index.html`. Smoke 1440/390/320: start → world/region/near → select road/point → inspect route and ownership → build/scout → reassign a point to a second town → save/reload/continue → Defter tile/order flow → return to atlas → resize/menu/reset. Confirm one active renderer, no overflow, unchanged save, silence, and physical-GPU Pixi/context-loss fallback. Reproduce any failure narrowly and send it back for a small follow-up checkpoint.

## Next game / boundaries

Immediately after the #102 handoff, a single GitHub search for `head:codex/tc-sim-historical-starts` across all PR states returned no PR (2026-09-26, 13:27 UTC). No Actions/CI/deployment polling followed. Luna's PR/merge result is therefore still an integration prerequisite; her branch was neither modified nor duplicated.

A clean detached discovery worktree was opened at merged #100 (`dee186f7c437e2675765bebe7ffdeec9a271cf9c`): `/workspace/scratch/f69805d9a14c/tariklab-tc-discovery`. Discovery is limited to the existing main's file/contract inventory. Historical-start auditing or implementation starts only when Luna supplies the PR/merge handoff. Preserve `tc-sim-save`; resume with a narrow bug baseline, then life-network consequences and source-by-source historical provenance. Do not skip ahead to İHTİLÂL while this integration prerequisite remains unresolved.

Discovery inventory (no TC SIM code/test changes):

- Correct game: `public/games/tc-sim/`, `/oyna/tc-sim`, `/games/tc-sim/index.html`; `tc-sim-devlet/` is a separate game. At the inspected base, `state.js` is version 6 and `save.js` owns `tc-sim-save`, its backup and three `tariklab::tc-sim:*` slots/migrations.
- Extend existing systems: `time.js::advanceWeek` determines ordering; `decision-network.js` already connects time, money, relationships, energy and goals; `life-depth.js` already carries ten life domains, pending/resolved effects and decision history. Do not create a competing consequence engine.
- Integration boundaries: `life.js`/`education.js` for work–study–energy; `household.js`/`social.js` for costs, trust and timed `openCases`; `wealth.js`/`body-systems.js` for debt, access and wellbeing. `app.js`/`weekly-feedback.js` are the existing preview and observed before/after explanation surfaces. Reconcile these with Luna's result before proposing changes.

PR #101 remains Terra's responsibility. Novella remains **LATER**.
# İHTİLÂL — havza akışları checkpoint · 2026-09-26

- Oyuncu değeri: Oyuncu artık bir havzadaki kararın komşulara ne zaman, hangi yoldan ve hangi bedelle yayılacağını anlayıp etkileyebiliyor.
- Branch: `astra/ihtilal-basin-currents`; test edilmiş kod SHA: `b5474c000947d1b3dd10e54e700cd8803b5deadd` (sonraki commit yalnız bu kayıt).
- Dosyalar: `public/games/ihtilal/{solo.js,solo-app.js,solo.css,basin-map.js,basin-network.js}`; `scripts/ihtilal-{basin-network.test,ultra-browser,browser}.mjs`, v1 fixture; web ledger/asset register A024.
- Kayıt: `tariklab.ihtilal.solo.v1` ve zarf v1 korundu; eski açılış/yankı/eşik/final kayıtları, yedek kurtarma ve hatalı veri reddi doğrulandı.
- Test: son hedefli 62/62; bir tam repo koşusu 1.624 PASS, 0 FAIL, 1 mevcut isteğe bağlı skip; build/typecheck PASS; lint 0 hata (58 mevcut uyarı).
- Tarayıcı: 1440/390/320 × gerçek Pixi/zorlanmış SVG, 43 kontrol PASS; mevcut campaign akışı 1280/360 PASS; save/reload, kota, gerçek context-loss, resize, menü/reset ve odak doğrulandı.
- Ölçüm: son pakette başlangıç 96–188 ms; ölçülen CPU çizim medyanı 1,1 ms, en yüksek 4,2 ms; sürekli ticker yok, en çok bir canvas, eski kayıttan güvenli geçiş var. FPS iddiası değildir.
- Açık risk: runner SwiftShader; fiziksel GPU/production smoke Terra/Sol’da. Tüm 17 oyun dosyası temiz build ile birebir eşleşti; son küçük düzeltmeler hedefli/browser testleriyle kapatıldı.
- Release: [PR #104](https://github.com/tayaz-maker/tariklab/pull/104) handoff Terra/Sol’da; gerçek head’de zorunlu CI yeşilken merge, iki hostta `/oyna/ihtilal` ve `/games/ihtilal/index.html` smoke. #101/Luna değişmedi.
- Sonraki adım: Racon temiz worktree keşfi başladı; 6 sokak DOM/SVG, üç slot v1, hedefli ağ/kayıt 16/16. Sonraki tur: oyuncu eşzamanlı sokak kararlarının haftalık maliyetini ve komşu etkisini haritada karşılaştırabilsin; önce normalize’ın `__proto__` kararını kabul etme repro’sunu düzelt. İHTİLÂL ikinci sistem sonraya; Novella LATER.
# Racon Manager — avlu sonuçları checkpoint · 2026-09-26

- Hedef/oyuncu değeri: Oyuncu artık sokak kararının bugünkü bedelini ve komşulara gecikmeli güven/baskı etkisini görüp yayılımın yönünü seçebiliyor.
- Branch: `astra/racon-neighbourhood-consequences`; test edilmiş kod SHA: `0d13c4fb06ccb29dd581c612028c8399fba817a2`; son kayıt commit’i yalnız doküman.
- Dosyalar: `public/games/racon/{index.html,content.js,network.js,map-model.js,map-view.js}`; 5 Racon test/browser/harness dosyası; web ledger ve A025.
- Bug: `__proto__`/kalıtılmış emir, geçersiz süre/çift emir reddi; Koru/Çekil dosya izinin yeniden hesapta silinmesi repro + regresyonla kapandı.
- Sistem: 1/2/3 kapanışlık komşu yayılımı; +₺250 tek komşuda yoğunlaşma; baskı 60+ güveni yarılar; karşılıklı izler ve yalnız ağ/ısınma kapanış provası haritada.
- Save: üç slot ve `RACON/1`/`racon_v1`, sokak/nesne ID’leri korundu; eski kayıtlar açılır, yön/kuyruk/geçmiş reload’da kalır; kuyruğa 72/geçmişe 12 sınırı.
- Test: son hedefli 67/67; bir tam repo koşusu 1.623 PASS, 0 FAIL, 1 mevcut skip; son küçük düzeltmeler hedefli/browser ile kapandı; build/typecheck PASS, lint 0 hata/58 mevcut uyarı.
- Browser: 1440/390/320 × Pixi/SVG, 47 kontrol PASS; yeni oyun, save/reload, gerçek context-loss, geç init iptali, ekran/menü/BFCache temizliği, odak/taşma; CPU çizim medyanı 0,8 ms, en çok 7,7 ms (FPS değil); temiz build 6/6 dosya eşit.
- Release/risk: [PR #105](https://github.com/tayaz-maker/tariklab/pull/105) handoff hazır; Terra/Sol gerçek head’de zorunlu CI yeşilken merge + iki hostta `/oyna/racon` ve `/games/racon/index.html` smoke. Runner SwiftShader; fiziksel GPU release aşamasında; CI beklenmez.
- Sonraki adım: sıradaki JITEM: Derin Ağ için canonical upstream keşfi; TarikLab vendor sync yalnız upstream merge sonrası; Racon’da ikinci sistem (daha uzun emir zaman çizelgesi) sonraki tura. #101/#102/#104/Luna değişmedi; Novella LATER.

## JITEM — dar vendor/source checkpoint · 2026-10-04
- Hedef: merge edilmiş upstream atlasını TarikLab'e birebir senkronize etmek; yeni oyun/görsel kapsamı yok.
- Oyuncu değeri: #21'deki karar atlası ve güvenli yedek kurtarma aynı davranışla TarikLab paketine taşınır.
- Branch: `astra/jitem-vendor-atlas-sync`; taban `95099f967036782f1cd7e2c43d2ca8286df519d7`.
- Upstream: [#21](https://github.com/tayaz-maker/jitem-derin-ag/pull/21) MERGED; SHA `0c1fc08db3f050ebf34e237ef4fd1018ba223293`; atlas CI 37209063810 SUCCESS.
- Kod checkpoint SHA: `e0544ad40959d932f125aa1b53fe758275f342a8`; sonraki commit yalnız bu kayıt/ledger.
- Dosyalar: JITEM vendor çıktısı/SOURCE, ürün kimliği, source-pin testi, SHA-sabitli Pixi sessizlik istisnası, run-state/ledger.
- Sözleşme: `jitem-derin-ag-v3`, schema 5, tarihsel içerik ve hesap kuralları korundu; kaynak checkout temiz.
- Kanıt: iki embed build 30/30 eş; TarikLab build çıktısı 31/31 eş; hedefli test 7/7, TS test 54/54, build/typecheck/ESLint PASS.
- Tam repo: ilk koşu 1.589 PASS / 1 FAIL / 1 mevcut skip; tek Pixi fixture engeli küçültülmüş repro sonrası 7/7 hedefli testle kapandı; tam yeniden koşu PR CI'ında.
- Açık risk: vendor browser/fiziksel GPU/production doğrulanmadı; yerel Chromium indirilemedi; üretilmiş shader boşlukları korunur.
- Sonraki adım: dar vendor PR'ında gerçek head'in CI'sı ve release doğrulaması; CI bekleme/merge yok. SON KÖY ayrı branch'te korunuyor.

## 2026-10-04 — sıralı release kapanışı

- Hedef: #105 → #107 → #106 yayınlarını CI ve iki-host production kanıtıyla kapatmak.
- Oyuncu değeri: Racon sokak kararları, JITEM kayıt kurtarma/karar atlası ve TC SIM tarihsel başlangıçları canlıda kullanılabiliyor.
- Branch: `astra/release-closure-2026-10-04`; release main: `d1ea695b76fba15c284690c07cf818316cd97f10`.
- Merge SHA: #105 `7315055785fa90a46e87c1264c23cfdbb60b3d7b`; #107 `82c731c91b40894060936d9299a61644c970241f`; #106 `d1ea695b76fba15c284690c07cf818316cd97f10`.
- Değişen kayıtlar: status, closure, run-state, web ledger, TanStack kaynak notu ve `docs/evidence/2026-10-04-release.json`; bu checkpoint ürün kodunu değiştirmez.
- CI: her son head 7/7 success; run 37220177294 / 37220657803 / 37220702175. TanStack pin/lock/notices düzeltildi; koruma bypass edilmedi.
- Production: www + workers, 1440/390; Racon 34'er, JITEM 4'er, TC SIM 10'ar kontrol PASS; 6/31/38 dosya hashleri iki hostta eşleşti, konsol/taşma 0.
- Kanıt: `docs/evidence/2026-10-04-release.json`; test-only branch `astra/closure-production-proof`, main'e merge edilmez.
- Açık risk: fiziksel GPU yok; lint zincirinde bir high `brace-expansion`; TC SIM mevcut alt-kart darlığı. Save key/schema/içerik korunur.
- Sonraki adım: bu üç yayın kapalı; yeni kapsam açma. SON KÖY WIP korunuyor; Novella LATER.

### 2026-10-04 — Çete Savaşları / outcome moment checkpoint
- Hedef: önemli icraatın gerçek sonucu için sessiz 2.2 saniyelik soyut sonuç kartı.
- Oyuncu değeri: nakit/itibar/baskı değişimini, ekip bağını ve gecikmiş tepki zamanını birlikte okuyabilir.
- Branch: `astra/cete-outcome-moments`; taban SHA: `b4ebc2babe7c754493d84421051c9531fc09215e`.
- Kaynak: TarikLab `src/game` + React JobsPanel; vendor/upstream kopyası yok.
- Dosyalar: saf model/test, outcome component/CSS, JobsPanel çağrısı, browser testi ve CI adımı.
- Kayıt: `cete-savaslari-save-v1`, schema 15, slot ve hesap kuralları değişmedi; görsel durum kayda yazılmaz.
- Eşik: ilk başarı, sözleşme kapanışı, çok üyeli operasyon, her 5 seviye; 64 anahtarlı tekrar filtresi ve 2.5 sn burst sınırı.
- Test: baseline 19/19; model + gerçek store eylemi 7/7; typecheck/lint/build PASS; tam suite 1673 PASS, 1 mevcut isteğe bağlı skip.
- Browser: önizlemede gerçek karar/odak PASS; kurulum ipucu örtüşmesi düzeltildi. CI'da dev + built çıktı, TR/EN × 1440/390/320 × motion/reduced; üretimde iki host aynı test.
- Açık risk: yerel Chromium SIGSEGV; browser sonuçları/CI yeşil olmadan merge edilmeyecek.
- Sonraki adım: CI kanıtı, merge, iki host production; başka ürün yok, Novella LATER.

### 2026-10-04 — Dalga 1 / karar izleri checkpoint
- Hedef: HANEDANIAN, İHTİLÂL ve Racon'da gerçek karar sonucu + kalıcı durum işaretleri.
- Oyuncu değeri: ödediği bedeli, taahhüdün zamanını ve haritada biriken güven/baskı/iş ilerlemesini okuyabilir.
- Branch: `astra/wave1-decision-traces`; kod SHA: `2287786007c2dd920fab31f388a61e27569c25ed`.
- Dosyalar: üç saf model/özel UI/harita izi; ortak geçici lifecycle; Han offline paketi; test/CI/provenance kayıtları.
- Sözleşme: hesap, içerik, RNG, save key/schema değişmedi; görsel durum kayda yazılmaz.
- Test: hedefli model 17/17, offline/version 19/19, TS 61/61; typecheck/lint/build PASS.
- Tam suite: JS 1617 PASS, 12 test-harness FAIL, 1 mevcut skip; gerçek runtime yüklenerek aynı 12/12 hedefli test PASS.
- Browser/performans: 1440/390/320 before/source/built ve iki host CI adımları hazır; gerçek sonuç henüz bekleniyor.
- Açık risk: yerel Chromium SIGSEGV; CI browser yeşil olmadan merge/production başarısı iddia edilmeyecek.
- Sonraki adım: dar Dalga 1 PR/CI; #109 kapanışı; ölçülmüş performans ve asset referans temizliği ayrı PR.

### 2026-10-04 — ayrı harita performans checkpoint
- Hedef: İHTİLÂL/Racon statik tabanı koruma ve güvenli GPU bütçesi; görsel dalgadan ayrı PR.
- Oyuncu değeri: seçim/plan değişiminde aynı karar haritasını gereksiz taban çizimi olmadan kullanabilir.
- Branch: `astra/map-static-cache`; kod SHA: `e855c5c0e46ed5ee9cb0726f7b58aff173ae82b4`; taban #110 `53534e2`.
- Dosyalar: iki renderer; gerçek-source VM ve browser/performance ölçümleri; CI/provenance/asset envanteri.
- Test: instrumentation 14/14, birleşik hedefli 38/38; build PASS, değişen JS ESLint PASS; 59 mevcut uyarı.
- Browser: 1440/390/320, save/reload/context/cleanup + düşük bellek/DPR senaryoları hazırlanmış; CI sonucu henüz yok.
- Performans: tüm 20 rota+portal cold before/after; iki haritada 12 seçimlik gerçek redraw ölçümü; kazanım henüz iddia edilmiyor.
- Asset: yanlış tracked build/büyük duplicate yok; referanslı screenshot arşivi korundu; dosya silinmedi.
- Açık risk: kod +10.314 B; sık güncellemelerdeki tasarruf ve görsel eşlik browser kanıtıyla değerlendirilecek.
- Sonraki adım: bağımsız dar PR; #109/#110 yeşil ve production kanıtlı kapanmadan sonraki oyun dalgasına geçme.

### 2026-10-05 — #110/#111 CI kök hata checkpoint
- Hedef: yalnız Wave 1 baseline/browser CI sunucusu; yeni ürün/görsel kapsamı yok.
- Branch: `astra/wave1-decision-traces`; fix SHA: `48372bd1856fb71e3c97de2fe11fea9beb6afe42`.
- Kesin hata: run `37232890491`, job `111526171921`, `wave1-outcome-browser.mjs:16:449` → `ERR_HTTP_HEADERS_SENT`.
- CI önceki head: JS 1629 PASS/1 skip + TS 61 PASS; typecheck/lint/production build PASS; yalnız browser baseline kırmızı.
- Repro: eksik dosyada `writeHead(200)` sonrası ENOENT, ikinci `writeHead(404)` çöküyordu.
- Fix: dosya başlıktan önce okunur; kontrollü 400/403/404; baseline archive İHTİLÂL'in kök `/favicon.svg` bağımlılığını içerir.
- Test: gerçek HTTP/eksik dosya sonrası devam + entry asset/archive kapsamı 2/2 PASS; değişen JS ESLint ve production build PASS (DB yok: migrate doğru skip).
- Browser: yerel Chromium sayfa açılmadan SIGSEGV; yeni CI head'i çalışmadan browser PASS/merge iddia edilmez.
- Sonraki adım: #110 browser kanıtı, sonra #111 düzeltmeyi devralıp CI; kırmızı merge yok; anatomi A keşfi bu kapıdan sonra.

### 2026-10-05 — baseline worker bağımlılığı checkpoint
- Hedef: aynı #110 baseline paketinin eksik kök worker dosyasını tamamlama; oyun kodu değişmedi.
- Branch: `astra/wave1-decision-traces`; fix SHA: `22524cd4791ba365324bc136d351c0c79f5bea39`.
- Kanıt: run `37237784746`, job `111540300782`; HTTP headers çökmesi yok, Han 1440 console iki worker-script 404 ile FAIL.
- Kök: gerçek Han boot `navigator.serviceWorker.register('/sw.js')` çağırıyor; eski archive kök worker'ı içermiyordu (repro: old false / fixed true).
- Fix: aynı sabit baseline SHA'nın tam `public` ağacı; worker ve statik bağımlılıklar birlikte, hata/console kapıları aynen korunur.
- Test: HTTP ve entry/gerçek worker registration/archive 2/2 PASS; ESLint ve production build PASS; DB yoksa migrate doğru skip.
- Açık risk: yerel Chromium SIGSEGV sürüyor; ilgili browser yeni CI'da tekrar doğrulanacak, fiziksel GPU kanıtı yok.
- Sonraki adım: #110 browser PASS olmadan #111 merge yok; #111 bounded ölçüm teşhisi hazır; anatomi ve 360 review başlamadı.

### 2026-10-05 — ortak CI bütçesi checkpoint
- Hedef: #111 gerçek 25 dakika job iptalini test kapsamını azaltmadan gidermek; aynı workflow #110 main geçişini de korur.
- Branch/PR: `astra/wave1-decision-traces` #110 → `astra/map-static-cache` #111; ortak fix SHA `889cd133de67f46c5a7081dfee9203f1b6f06fbb`.
- Kanıt: #111 `fec5f66`, run `37241690632` / job `111551601225`: “The job has exceeded the maximum execution time of 25m0s”; assertion FAIL yok.
- Önce: 1673 JS + 61 TS PASS/1 eski skip; stress/type/lint/build, Wave1, Çete, duel, DEVLET ve sitewide PASS; TC SIM adımı toplam job süresinde iptal.
- Fix: core/browser ayrı 25 dakika; required `build` always aggregate, bütün needs yalnız exact success ise PASS; cancelled/skipped/missing FAIL.
- Korunan: baseline SHA'ları, komutlar, routing/cache/concurrency, browser matrisleri, step timeout'ları ve main production adımları; ürün/save/dependency değişmedi.
- Yerel: 20/20 gate+HTTP/archive regression, scoped ESLint ve production build PASS; migration DATABASE_URL yokken doğru skip.
- #111 ölçüm: run `37241690633`, artifact `11317803281`, 63 before + 63 after PASS; worker response metadata eksikliği gerçek HTTP200/1260 B/finished kaydıyla doğrulandı.
- CI/merge/production: yeni ortak head'ler henüz CI doğrulanmadı; #110/#111 merge edilmedi; production PASS iddiası yok.
- Açık risk: local Chromium SIGSEGV/fiziksel GPU yok; main browser+production toplam süre bütçesi gerçek main koşusunda ayrıca doğrulanmalı.
- Sonraki: #111 ortak fix üstüne rebase; ikisi güncel head green → #110 merge/smoke → #111 main rebase/CI/merge/smoke; yeni ürün dalgası bekler.

### 2026-10-05 — #111 dar CI teşhis checkpoint
- Hedef: düzeltilmiş #110 tabanını devralmak ve route-costs zaman aşımının tam bekleme aşamasını kanıtlamak.
- Branch: `astra/map-static-cache`; diagnostic SHA: `8a6453e66c3afc8e2cbc7f20e810bfc77cb91814`; hedef taban #110 `64f20ff`.
- Rebase: ürün, renderer, save ve bağımlılık dosyaları eski #111 ile aynı; yalnız inherited CI fix + ölçüm teşhisi değişti.
- Kanıt: eski run `37233660896`, job `111528404051`, Han SW isteklerinden sonra 15 dakika job timeout; hangi await olduğu önceki logda yok.
- Ölçüm: request.sizes sınırsız API; URL/SW etiketli 10 saniye sınırı, aşama/cleanup sınırları ve kısmi artifact; eksik ölçüm asla sıfır byte/PASS olmaz.
- Test: gerçek renderer 14 + HTTP/archive 2 + beklemeyen promise regression 5 = 21/21 PASS; ESLint ve production build PASS.
- Açık risk: timeout kök nedeni henüz browser ile doğrulanmadı; fiziksel GPU kanıtı yok; yeni CI/browser/production PASS iddiası yok.
- Sonraki adım: #110 gerçek baseline/browser kapanışı, sonra #111 rebased CI; kırmızı veya pending kontrol ile merge yok.

### 2026-10-05 — #110 browser kapandı; #111 transfer ölçümü checkpoint
- #110 `64f20ff`, run `37238892501` / job `111543489272`: baseline/source/built 1440/390/320 Wave 1 browser PASS; diğer zorunlu kontroller merge kapısıdır.
- Branch: `astra/map-static-cache`; ölçüm fix SHA: `5175ab021486b8782dfde6b25a454c882d63e792`.
- #111 run `37239830196` / job `111546137343`: Han 1440 CSS yanıtı yeni bileşen-validasyonunda FAIL; aşamalar/cleanup tamamlandı, bu koşu takılmadı.
- Repro/kaynak: Playwright 1.62.1 Chromium body=encodedDataLength−headers; body tek başına negatif olabilir. Public sizes dört alan verir, transferSize vermez.
- Fix: sonlu güvenli headers/body ve negatif olmayan gerçek toplam doğrulanır; 200 + (−200) = 0 korunur; clamp/uydurma sıfır yok, gerçek negatif toplam reddedilir.
- Kanıt: ilk negatif bileşen rota başına raw alanlar ve URL/SW ile kaydedilir; console/overflow/deadline kapıları değişmedi.
- Test: metrics 11 + deadline 5 = 16/16 PASS; scoped ESLint ve production build PASS; ürün/save/dependency değişmedi.
- Açık risk: eski 15 dakika takılmasının belirli await'i hâlâ kanıtlanmadı; tam route browser ölçümü yeni CI'da doğrulanacak.
- Sonraki adım: #111 ilgili CI kanıtı; kırmızı/pending merge yok, anatomi A ve 360 inceleme henüz başlamadı.

### 2026-10-05 — #111 worker metadata / gerçek HTTP ölçümü checkpoint
- Hedef: 320 px Han worker metadata takılmasını byte kaybı veya CI kapısı gevşetmeden gidermek.
- Branch/PR: `astra/map-static-cache`, #111; kod SHA `192458bc308dff3ace5c863ba5af2b3fffb2b95e`.
- Repro: run `37240215425` / job `111547271911`, 44 baseline vaka sonrası scoped Han worker `request.sizes()` timeout.
- Fix: her iki sürümde socket HTTP baytları; worker/cache/status korunur, yarım/hatalı/off-origin ölçüm FAIL; metadata aşaması ayrıca bounded kaydedilir.
- Test: 30/30 hedefli regression PASS; ESLint + production build PASS; runtime/save/dependency değişmedi.
- #110: `64f20ff`, run `37238892501` dört Actions job SUCCESS; gerçek before/source/built 3 oyun × 3 genişlik PASS.
- CI/merge/production: yeni #111 CI henüz doğrulanmadı; #110/#111 merge edilmedi, yeni production iddiası yok.
- Açık risk: yerel Chromium SIGSEGV; #110 Racon mobile PNG genişliği baseline'da da mevcut, final review kanıt sınırı; fiziksel GPU doğrulanmadı.
- Sonraki adım: yeni #111 tam 126 route vakası ve tüm required checks; ikisi green olduktan sonra #110→#111 ve iki-host smoke.

### 2026-10-05 — #111 ortak CI fix üstüne rebase checkpoint
- Branch/PR: `astra/map-static-cache`, #111; taban #110 `fea0d0cb3b582c58d1759e0d09b29fc1aaeb846e`.
- SHA: rebase `c7b5b1672f8789ac35c412e69f042a232e3cf7ca`; ölçüm kodu `67b7297c7918472c26c53e4336c9566a10afe04a`; ortak CI fix `889cd133`.
- Değişen: CI workflow, exact-success gate+regression ve run-state; eski head `fec5f66` ile public/src/package/lock byte-identical.
- Test: yeni tabanda gate18 + gerçek HTTP/archive2 =20/20 PASS; ortak fix build/ESLint PASS; browser kanıtı eski head'e aittir.
- Önceki CI: ölçüm126/126 PASS; full build 25 dakika job tavanında CANCELLED; bu iptal PASS sayılmadı.
- CI/merge/production: yeni head kontrolleri kapı; #110/#111 henüz merge ve production doğrulaması yok.
- Açık risk: local Chromium SIGSEGV, fiziksel GPU yok; main production adımları dahil browser işinin toplam süresi ayrıca doğrulanacak.
- Sonraki: iki güncel head yeşil → #110 merge+iki host → #111 main rebase/yeni CI/merge+iki host; Wave2–4/anatomi kodu başlamaz.

### 2026-10-05 — #111 iframe okunurluk yarışı checkpoint
- Hedef: yeni CI'da doğrulanan body-null yarışını kapatmak; #110 `fea0d0c` tabanı değişmedi.
- Branch/PR: `astra/map-static-cache`, #111; fix SHA `24c76754f70224277ae74d3bd2b9929b28e2fb83`.
- Kanıt: head `de4c416`, run `37244258417` / job `111558890122`, TC SIM DEVLET390 / `route-performance.mjs:109`, body.innerText null TypeError.
- Repro: iframe handle mevcutken iç belge body=null; eski predicate aynı TypeError'ı üretir, yeni predicate body hazır olana kadar false.
- Fix: aynı trim length>20 eşiği ve 20 saniye deadline korunur; gerçek getter/document hataları gizlenmez, hiçbir rota/console/overflow/byte kontrolü atlanmaz.
- Test: yeni3 + deadline5 + gerçek HTTP8 + metadata4 =20/20 PASS; scoped ESLint + production build PASS; yerel browser SIGSEGV sınırı sürer.
- Değişen: yalnız route-performance predicate/helper/test ve bu kayıt; ürün/save/dependency değişmedi.
- CI/merge/production: yeni head CI kapısı; #110 hâlâ pending, #111 eski run kırmızı; iki PR da merge edilmedi, production PASS yok.
- Açık risk: yeni tam browser koşusu gerekir; eski FEC 126 ölçüm/9-13-13 Wave1 PASS yeni head yerine kullanılamaz; fiziksel GPU yok.
- Sonraki: yeni #111 CI; iki güncel head green olmadan #110→#111 merge zinciri başlamaz, yeni ürün dalgası açılmaz.


### 2026-10-05 — A2 repaired-main checkpoint
- A1/A3 closed: #113 merge `375b83752df3d5e16c960797cf99634af0405d31`;9/9+Vercel green before normal merge; production run37256148798 six host/viewport cases PASS.
- A2 branch/PR: `astra/map-static-cache` / #111; rebased onto375b837, preserving both ledger sections; previous remotehead2011a59 is superseded by the pending fresh push.
- Player value: unchanged IHTILAL/Racon bases stay mounted while actual decision overlays update; map/save semantics and previous green map implementation bytes are unchanged.
- Fresh local tests:68/68 cache/traffic/deadline/surface/offline/redirect PASS; targeted lint and production build PASS. No repeated local browser attempt in the known-broken local Chromium environment.
- Evidence maintenance: accurate baseline-minimization label and separate provider artifacts; no timeout/assertion/CI gate weakening.
- Release: fresh remote CI pending; #111 merge/production not yet done. A1 production evidence is not substituted for #111 acceptance.
- B–F remaining gates stay open in the final360 contract ledger; no card art, dependency, Atlas or other game scope enters this PR.
- Next: all exact-head checks green → normal merge → paired Wave1/two-host production and route-cost artifacts → status.


### 2026-10-05 — #110 CI geçti / #111 ölçülmüş blocker checkpoint
- Branch'ler: #110 `astra/wave1-decision-traces` / `64f20ffd03b555808e2f2db6ffb505d2dc37a567`; #111 `astra/map-static-cache` / `457213ae75e795f3560bad9b6deb468e413bca73`.
- #110: run `37238892501` dört Actions job'ı SUCCESS; build ve baseline/source/built 1440/390/320 browser PASS; merge/production yapılmadı.
- #111: run `37240215425`, job `111547271911` FAIL; 44 baseline case PASS, Han 320 worker `/games/hanedanian/sw.js` için `request.sizes()` 10 saniyede sonuç vermiyor (`serviceWorker=true`).
- Kanıt: artifact `11317571288`; eski 15 dakika sessiz takılma artık URL/aşama/deadline ile yeniden üretildi; paired before/after ölçüm tamamlanmadı.
- Ayrı ölçüm fix'i doğrulandı: raw CSS headers=249/body=−249/transfer=0; gerçek toplam korunur, bilinmeyen byte sıfıra çevrilmez.
- Test: son fix metrics 11 + deadline 5 PASS, scoped ESLint/build PASS; ürün/save/dependency değişmedi; console/overflow/measurement kapıları açık.
- İki başarısız deneme sınırı: yeni yama zorlanmadı; #111 kırmızı, merge yok; Anatomi A ve final 360 inceleme başlamadı.
- Sonraki bounded tur: SW bootstrap ölçümünü CI-local HTTP cevap-byte sayacı veya doğrulanmış upstream Playwright çözümüyle küçük repro üzerinde karşılaştır; worker kapatma/istek atlama/sahte 0 yok.
- Envanter: `astra/review-release-gates`, kaynak belge commit `22ec07fa1833718fbf889866ce1191c89bfcbfa0`; tek `TARIKLAB_FINAL_360_REVIEW.md` içinde 12 kapsam, DARBE sınırları ve insan kapıları kayıtlı.
- Açık risk: #111 CI blocker; fiziksel GPU/PL anadil/anatomi bağımsız uzman kanıtı yok; SON KÖY korunuyor, Novella LATER, #78/#79 yeniden açılmaz.

### 2026-10-05 — #111 kök neden ve tam ölçüm PASS checkpoint
- Hedef: worker ölçüm takılmasını kapatmak; branch/PR `astra/map-static-cache` / #111, head `fec5f661477d09b62e9a82c53b6affd6deefd6be`.
- Kod SHA `192458bc308dff3ace5c863ba5af2b3fffb2b95e`; ölçer + metadata teşhisi + regression + workflow helper path'leri; runtime/save/dependency değişmedi.
- Gerçek CI: run `37241690633`, job `111551512627` SUCCESS; artifact `11317803281`, 63 before + 63 after, errors=[] ve DOM overflow=0.
- Kök kanıt: requestfinished sonrası worker response promise'i çözülmüyor; aynı Han390 isteği gerçek HTTP 200 / 1260 body B / finished=true olarak tam sayıldı.
- Yerel: 30/30 hedefli test, ESLint/build PASS. Tarayıcı metadata timeout'u ölçümde istek atlama veya uydurma sıfır oluşturmaz.
- #110 `64f20ff`: görünen 6 check + Vercel status SUCCESS; #109 head tam atası, browser PASS fakat production bekliyor.
- Merge/production: #111 genel CI `37241690632` pending; iki PR da merge edilmedi, iki-host production henüz yapılmadı.
- Bağımsız kayıt: final360 checklistine güncel 7 harita entry'si, artifact sınırları ve SON KÖY WIP'in gerekçeli deferred/ayrı Wave3 PR adayı sınıflaması eklendi.
- Risk: fiziksel GPU/PL anadil/anatomi uzmanı yok; Racon eski PNG genişliği ve preview DB bootstrap logu son review için açık; Novella/#78/#79 değişmedi.
- Sonraki: #111 tüm checks green → #110 merge → güncel main'e #111 rebase/CI; her merge sonrası iki-host gerçek smoke ve SHA.

### 2026-10-05 — korumalı CI split ve iki güncel head checkpoint
- Hedef: doğrulanmış 25 dakika seri build iptalini kapatmak; kullanıcı/oyun/save/dependency kapsamı değişmedi.
- Branch/PR: #110 `astra/wave1-decision-traces` head `fea0d0cb3b582c58d1759e0d09b29fc1aaeb846e`; #111 `astra/map-static-cache` head `de4c416e0af57f818a6cdf8262f623bb9fafe241`.
- Ortak fix SHA: `889cd133de67f46c5a7081dfee9203f1b6f06fbb`; workflow + exact-success helper/test; #111 dokuz commit bu tabana rebase, eski `fec5f66` backup ref'te.
- Kök kanıt: run `37241690632` / job `111551601225` açık 25 dakika timeout; assertion failure yok, TC SIM bu tavanda iptal; cancelled PASS değildir.
- Gate: core/browser ayrı 25 dakika; required build always/all-needs success; komutlar, baseline pinleri, routing/cache/concurrency ve production adımları aynı.
- Yerel: 20/20 gate+HTTP/archive, scoped ESLint ve production build PASS; rebase public/src/package/lock byte-identical.
- Gerçek CI: #110 `37244054041`, #111 `37244258514` ve map `37244258417` yayın anında pending.
- Merge/production: ikisi de merge edilmedi; production iddiası yok; önceki 126 ölçüm PASS yalnız eski head kanıtıdır.
- Açık risk: yerel Chromium SIGSEGV, fiziksel GPU / PL ana dil / anatomi uzmanı yok; main browser+production toplam süre bütçesi henüz ölçülmedi.
- Sonraki: iki güncel head green → #110 merge/iki-host → #111 main rebase/CI/merge/iki-host; pendingken yalnız kanıt ve bağımsız kaynak notu.

### 2026-10-05 — son bounded CI checkpoint
- Branch/PR: #110 `astra/wave1-decision-traces` head `fea0d0cb3b582c58d1759e0d09b29fc1aaeb846e`; #111 `astra/map-static-cache` head `9c47c0d293a0f47dbce62822d94637151ccaceb4`.
- SHA: ortak korumalı CI split `889cd133`; iframe readiness fix `24c76754f70224277ae74d3bd2b9929b28e2fb83`.
- Son somut hata: run `37244258417` / job `111558890122`, TC SIM DEVLET390 body-null; aynı >20 metin eşiği/20 saniye süreyle bekleme eklendi.
- Test: readiness/deadline/HTTP/metadata20 PASS, gate/HTTP/archive20 PASS; scoped ESLint ve production build PASS.
- Gerçek CI: #110 `37244054041` core SUCCESS, browser/soak in_progress; #111 `37244773929` pending, map `37244773932` in_progress.
- Merge/production: ikisi de yapılmadı; kırmızı veya pending ile merge yok. Eski FEC126 ölçüm/9-13-13 browser kanıtı yeni head PASS yerine geçmez.
- Kanıt: final360 intake'inde artifact `11317874879`, low-memory/DPR/statik retention ve Racon PNG/performance sınırları; DARBE sınırları ayrı kaynak notunda, kural testi/teşhisi yok.
- Risk: yerel Chromium SIGSEGV, fiziksel GPU yok; main browser+production süre bütçesi ayrıca ölçülecek. PL ve anatomi insan kapıları açık.
- Sonraki: iki güncel head green → #110 merge/iki-host → #111 main rebase/yeni CI/merge/iki-host; Wave2–4/anatomi kodu henüz başlamadı.

### 2026-10-05 — #110 merge / #111 main rebase checkpoint
- Branch/PR: #110 `astra/wave1-decision-traces` / head `fea0d0c`; #111 `astra/map-static-cache` / head `2011a59aeced3600d46363bb6c24708673e49052`.
- Merge SHA: #110 `562831dba3b16be2a0bc8b2aec2e613eb1b80f45`, normal GitHub merge; protection bypass yok.
- Gerçek CI: #110 8/8 + Vercel SUCCESS; #111 eski `9c47c0d` 9/9 + Vercel SUCCESS, 126 route ölçümü tamam/hatasız.
- Rebase: #111 12 commit güncel main üzerine; tree `5b2a64a013ba032b744be255d13b51f0bff9e0db` önceki yeşil tree ile aynı; eski head backup ref'te.
- Production: #110 iki-host smoke henüz kapanmadı; #111 yeni CI kapısı, merge edilmedi.
- Ayrı kullanıcı değişikliği: DARBE 300 görsel yenilemesi onay öncesi10 kartlık proof'a ayrıldı; engine/save/data/ölçü/a11y korunur, uygulama paketi henüz değişmez.
- Değişen kayıtlar: final360 intake ve Wave4 DARBE boundary; eski görseli koru talimatı güncellendi, DRB237–240 ayrı P1 kalır.
- Risk: fiziksel GPU/PL ana dil/anatomi uzmanı açık; main production süresi yeni koşuda ölçülecek.
- Sonraki: #110 iki-host kanıtı + #111 yeni CI → #111 merge/production; DARBE proof kullanıcı incelemesi, onay olmadan300 yayılmaz.

### 2026-10-05 — DARBE stil örneği ve production blocker checkpoint
- Hedef/oyuncu değeri: kartın gerçek etki türünü özgün sivil arşiv sahnesinden ayırt etmek; 300 yayılımı kullanıcı onayı bekler.
- Branch/PR: `astra/darbe-art-direction-proof` / #112; head `f541bcfc0a571b2ad2dd3d9aa1c047343e76ed70`, taslak ve merge edilmedi.
- Değişiklik: 10 SVG/generator/manifest, standalone karşılaştırma, 651 dosya hash koruması, hedefli browser workflow; oyun/save/engine/kart ölçüsü değişmedi.
- Yerel test/build PASS; art CI `37247459967` SUCCESS, artifact `11319492846`: 6/6 viewport-motion, sıfır console/overflow/worker, 25 screenshot. Genel #112 CI henüz pending.
- #110 merge SHA `562831dba3b16be2a0bc8b2aec2e613eb1b80f45`; main run `37246439763` production FAIL: Workers HAN1440 reload `net::ERR_FAILED`; artifact `11319313487`.
- Production geçen kapsam: Çete iki host 17/17; Wave1 www 9/9; campaign www PASS. Workers Wave1 ve sonraki duel production kapalı değil; fiziksel GPU iddiası yok.
- #111 head `2011a59aeced3600d46363bb6c24708673e49052`: build/route SUCCESS, campaign pending; main production blocker nedeniyle merge yok.
- Repro adayı: Workers index.html HTTP307 → oyun kökü doğrulandı; redirected HTML cache yanıtı kontrollü yerel fixture ile ayrıştırılacak. Kör retry veya SW bypass yok.
- Kayıt: final360 intake, Wave4 DARBE boundary ve `docs/evidence/2026-10-05-darbe-proof-release.json`; DRB-237–240 ayrı P1, PL/anatomi insan kapıları açık.
- Sonraki: dar HAN offline redirect repro/fix → green release kapıları; DARBE stil onayından önce 300 karta yayma. Novella/#78/#79/SON KÖY WIP değişmedi.

### 2026-10-05 00:52 UTC — bounded proof/release checkpoint
- Hedef/oyuncu değeri: DARBE kart etkilerini ayrı sivil arşiv sahneleriyle okumak; bu tur 10 örnek, 300 yayılımı onay bekler.
- Stil branch/PR/SHA: `astra/darbe-art-direction-proof` / #112 / `f541bcfc0a571b2ad2dd3d9aa1c047343e76ed70`; taslak, merge yok.
- Proof: yerel 5/5 + build; hedefli browser 6/6 SUCCESS, 320/390/1440 × reduced/default motion, console/overflow 0; 10 SVG 25.758 B, 651 ürün dosyası değişmedi.
- Genel #112 CI: build/browser/core/balance/art SUCCESS, campaign hâlâ pending; gerçek düello/save/PWA kabulü değildir, DRB237–240 ayrı P1 kalır.
- Release: #110 merge `562831dba3b16be2a0bc8b2aec2e613eb1b80f45`; www Wave1 9/9, Çete iki host 17/17; Workers HAN reload FAIL, sonraki duel smoke çalışmadı.
- #111 `2011a59aeced3600d46363bb6c24708673e49052`: 9/9 + Vercel SUCCESS; #110 production blocker nedeniyle merge edilmedi.
- Dar aday #113 `astra/han-offline-redirect-fix`, head `2a59e4de1033084c5d06015208d132ac56db6ab0`: yerel offline/version17/17, lint/typecheck/build PASS; genel CI pending.
- Browser repro ikinci kez setup'ta FAIL: run37248756789/job111571847240, artifact11320051287; root SW activated, HAN SW installing, HAN cache yok; gerçek reload assertion ve fixed case çalışmadı.
- Sınır: iki başarısız deneme sonrası üçüncü tahmin/yama yok; HTTP307 görülmesi ve native regression tek başına production kök neden/çözüm kanıtı sayılmaz.
- Kayıt/sonraki: final360 + evidence JSON güncellendi; izole per-asset fetch/body ölçümü sonraki dar blok; #113 green/iki-host kapanmadan #111 yok, stil onayı olmadan300 yok.


### 2026-10-05 02:13 UTC — A1 release repair checkpoint
- A1/A3 hedef: HANEDANIAN reload hatasını gerçek tarayıcıda kök neden ve kayıt korumasıyla kapatmak; branch `astra/han-offline-redirect-fix`, PR #113.
- A1 SHA: `cac09e1341e6dbfd72ee41298557f88052ddf8c9`; tree `8392027e96aaeec548fc3251d5391f7158ba8429`; main hâlâ `562831dba3b16be2a0bc8b2aec2e613eb1b80f45`.
- A1 değişiklik: HTML redirect metadata normalizasyonu + cache bariyerinden önce gövde tüketimi; SW, hedefli unit/browser/release smoke, workflow ve kanıt belgesi. Gameplay/save değişmedi.
- A1 yerel: küçültülmüş test önce RED; sonra 23/23 hedefli test, lint ve production build PASS. Yeni paket SW SHA256 `8f44b24062a076d29b4d771f940f31f713d4685f8a1c1fd33ef43bfaa2811d39`.
- A1 browser: run `37254296791`, job `111588005984`, artifact `11322227990`: minimal eski kodda gerçek ERR_FAILED; fixed tam19 dosya + online/offline save/reload PASS.
- A1/A3 CI: ilk preview eski SHA'yı reddetti; Workers `6b1db98d` SUCCESS sonrası yalnız başarısız job yeniden koştu ve `111588570839` PASS: 3 genişlik × 2 reload, console/404/overflow0. Genel CI pending; production/merge yok.
- A2: #111 `2011a59aeced3600d46363bb6c24708673e49052` green geçmişi A1'i kapatmaz; rebase/merge BLOCKED.
- B1–B11: yeni prosedürel kabul 0/900; B7 uyarınca raster denemeleri git dışında SUPERSEDED. Üç ayrı 300-kart PR ve B10 kabul kapıları açık; DRB237–240 ayrı P1 repro.
- C1–C3/D1–D6: kalan outcome/map, offline/save/perf/security işleri açık; Novella, #78/#79 ve SON KÖY WIP korunur. Hiçbir toplu DONE yok.
- E1–E3/F: Atlas foundation ve final360 başlamadı; PL ana dil/anatomi uzmanı/fiziksel GPU insan kapıları açık. Tüm madde sahipleri final360 sözleşme tablosunda.
- Sonraki: exact preview + tüm CI → normal #113 merge → iki-host 320/390/1440 gerçek production kanıtı → A2; yanlış SHA/kırmızı CI bypass edilmez.


### 2026-10-05 02:42 UTC — A1/A3 production closure, A2 rebase
- A1/A3: PR #113 normal merge `375b83752df3d5e16c960797cf99634af0405d31`; head `cac09e1` üzerinde9/9 check + Vercel SUCCESS, bypass yok.
- A1 production: run37256148798/job111593543370 SUCCESS; www+Workers ×1440/390/320 =6/6, her vakada2 gerçek reload, gerçek farm save/queue/seed/paused-clock korunması.
- A1 kanıt: worker SHA256 `8f44b24062a076d29b4d771f940f31f713d4685f8a1c1fd33ef43bfaa2811d39`;19/19 paket; console/page/HTTP/network errors0, overflow0.
- A1 artifact11322886877:24 screenshot+6 trace+2results;33.774.583B,32MiB yerel transfer sınırını aştı. Production assertion/log kanıtı var; bu görüntüler yerelde incelendi denmez.
- A2: #111 güncel375b837 üzerine yerel rebase edildi; ledger'ın iki tarihsel eki korundu. Yeni head `eb5913d97ffe387033b315c1560ee25a691f263d` push edildi; fresh CI run37256926906/37256926916/37256926899, merge yok.
- A2 yerel: cache/traffic/deadline/surface/offline/redirect hedefli68/68 PASS, lint ve production build PASS. Kanıt upload'ları host başına bölünüyor, hiçbir test kapısı gevşemiyor.
- B1–B10: yeni kabul0/900; üç prosedürel insan sahnesi kalite FAIL, yayılım/public değişiklik yok. B11 gerçek engine fixture21/21 PASS; bildirilen browser/eski-save P1 henüz doğrulanmadı.
- C1–C3/D1–D6: kalan işler açık; C3 kaynak matrisi hazırlanıyor. D5 ayrı #114, head `316355d72153e1804a906f3e2d5d62f2cd349577`:14/14 RED→GREEN/build/lint/typecheck PASS; fresh CI bekliyor, merge yok.
- E1–E3/F: Atlas ve final360 başlamadı; PL/anatomi/physicalGPU insan kapıları açık. Novella/#78/#79 ve SON KÖY WIP korunur.
- Sonraki: A2 freshCI→normalmerge→iki-host production; D5 bağımsız dar PR. Büyük yeni ürün dalgası açılmadı.


### 2026-10-05 03:16 UTC — A2 merge checkpoint
- A1/A3 CLOSED: #113 merge375b837, iki-host6/6 gerçek saved-game reload kanıtı; main CI SUCCESS.
- A2: #111 head `eb5913d97ffe387033b315c1560ee25a691f263d` üzerinde10/10 checks+Vercel SUCCESS; normal merge `a534289490f502f68e12d91803fbc3883de7d790`, bypass yok.
- A2/D4: 68 local hedefli test/build/lint PASS; route63×2 ve Wave1 built13 browser PASS. Portal9request/~172.4KB, oyun/Pixi isteği0.
- A2 production: bu merge'in iki-host smoke sonucu henüz yok; deploy/production beklerken yeni kapsam başlamadı.
- A2 açık kanıt: Racon320/390 fullPage map capture621/730px; baseline da aynı, kullanıcı-scroll kusuru henüz kanıtlanmadı. AyrıP1 doğrulama, örtülmedi.
- D5: #114 `316355d` üç dosyalık dev dependency fix, local14/14 PASS; fresh CI pending, merge yok.
- B1–B10:0/900 kabul;300×3 semantic brief hazırlığı üretim sanatı değildir. B11 engine21/21 karşı kanıt; özgülbrowser/eski-saveP1 açık.
- C1–C3/D1–D4:7harita/20rota kaynak matrisi tamamlandı, runtimegenelPASS değil; offline kohortlar/ağırlık/geri kalan visual işi açık.
- E1–E3/F: Atlas/final360 başlamadı; PL/anatomi/fizikselGPU insan kapıları açık; D6Novella/#78/#79/SON KÖY WIP korunur.
- Sonraki: A2 exactproduction→D5gatedrelease; kart kalite eşiği düşürülmez.


### 2026-10-05 04:00 UTC — A2 and D5 release closure checkpoint
- Branch `astra/release-evidence-a1-a2-d5`; kanıt belgeleri/ledger/final360 intake + E keşif; ürün/gameplay/save değişikliği yok.
- A1/A3 CLOSED: #113 merge `375b83752df3d5e16c960797cf99634af0405d31`, iki-host1440/390/320 gerçek reload/save6/6.
- A2 CLOSED: #111 merge `a534289490f502f68e12d91803fbc3883de7d790`; exact-head10/10+Vercel, main37258787799 SUCCESS.
- A2 production: iki-hostWave1 13'er/Çete17'şer; özelHAN37258787888 6/6, host artifact hashleri doğrulandı ve altı reload-2 PNG açıldı.
- D5: #114 head316355d8/8+Vercel SUCCESS → normal merge `0383d24dce3e45fc1db16773da8b3a135bf51b6e`;14/14 yerel RED→GREEN, build/lint/typecheck PASS; main37260245958 SUCCESS; iki hostta Wave1 13'er/Çete17'şer PASS.
- B1–B10: üç ayrı kalıcı hazırlık branch'inde300×3 kaynaklı sahne taslağı,17/17 hedefli test; sanat kabulü0/900. B7 farklı geometri deneyi de kalite/temas/bütçe FAIL;359KB SVG yayımlanmadı, raster/AIplaka yok.
- B11:21/21 gerçek engine fixture PASS/NOT REPRODUCED; kullanıcı bildirimine özgü browser/eski-saveP1 hâlâ açık, kural PR'ı yok.
- C1–C3/D1–D4: kalan outcome/görsel/map/offline/eski-save/perf işleri açık; Racon mobil capture farkı ayrıcaP1 doğrulama, tüm-sahne overflow0 iddiası yok.
- D6/E1–E3/F: Novella/#78/#79/SONKÖYWIP korunur; E keşif belgelendi, foundation/final360 başlamadı; PL/anatomi/fizikselGPU insan kapıları açık.
- Sonraki: Bu dar kanıt PR'ı kendi CI/release kapısından geçecek; B7 sanat kalitesi blocker, ölçülü red kaydı korunuyor,300/900 çoğaltma yok.


### 2026-10-05 05:02 UTC — B10 bounded evidence fix checkpoint
- Branch `astra/duel-visible-art-readiness`; implementation commit `13cc3dc11a817b5a064ad4d7cdfc288ac4eff231`; source scripts unchanged by rebase. PR/CI pending.
- Player value: restored hand art must really be visible before screenshot evidence can pass; missing/failed/placeholder images cannot count as success.
- B10: fixture UID + manifest URL/dimensions, viewport clipping, bounded decode and paint; identical actual-app legacy flow runs in local CI and production. No game/data/engine/save/art edits.
- Local gate:28/28 target tests, changed-script lint/typecheck/production build PASS; migrate skipped by existing no-DATABASE_URL contract. Local Chromium SIGSEGV before fixture; no browser PASS claim.
- A1–A3/D5 scoped CLOSED: #113375b837, #111a534289, #1140383d24. Evidence #115 merged `dfbab3f15b74df5336fecf9f7d4247184cbb9222`; its main37264953158 SUCCESS, two-host Wave1 13'er/Çete17'şer.
- #115 artifact11325843219 digest verified; six production screenshots opened. C3 Racon390/320 fullPage730/621px gap remains; no blanket overflow/GPU claim.
- B1–B9/B10 art:0/900 accepted. B7 geometry and separate SND-011 object candidates rejected; source/metrics retained on isolated branches, no rollout. B11 engine21/21 NOT REPRODUCED; browser/old-save P1 open.
- C1–C3/D1–D4/rest of D5 open; TC/DEVLET source-only outcome handoff is not implementation. D6 Novella/#78/#79/SONKÖY WIP preserved.
- E1–E3/F: discovery only; foundation and final360 not started; PL native language/anatomy expert/physical GPU human gates open.
- Next: exact-head CI actual browser fixture+legacy proof → normal merge only if fully green → fresh two-host production; no CI or timeout bypass.


## 2026-10-05 05:40 UTC — B10 checkpoint, release pending
- Owner/branch/PR: Astra; `astra/duel-visible-art-readiness`; #116 head `8f979cbaa2797f1a208cfddb8477ef4b6930180a`, main `dfbab3f`; status branch `astra/b10-production-checkpoint`.
- Hedef/değer: kart kanıtı placeholder veya başka host ile yanlış PASS veremez; oyun, veri, görsel ve save değişmedi.
- A1–A3 CLOSED: #113 `375b837` → #111 `a534289`, önceki gerçek iki-host reload/CI kanıtı geçerli.
- B10: 31/31 local, lint/typecheck/build PASS; CI `37268425509` pending; bu head merge/production kabulü yok.
- B1–B9 AÇIK: kabul0/900; canonical kaynak sınırı doğrulandı, VETO önceki300 görseli korunuyor; B7 kalite eşiği geçilmedi.
- B11 P1 AÇIK:21 geçerli motor fixture'ında NOT REPRODUCED; browser/özgül eski-save henüz yok.
- C1/C2 AÇIK; C3 Racon source-supported drawer/capture teşhisi runtime kanıtı değil; ayrı discovery dalları kanıt JSON'unda.
- D1/D2/D4 AÇIK; D3 P1 karma art-cache kohortu VM'de repro; D5 brace #114 `0383d24` CLOSED, genel security açık; D6 Novella/#78/#79 korunuyor.
- E1 NOT IMPLEMENTED; E2 dört kaynak/draft not-reviewed; E3 fiziksel GPU/PL/anatomi insan kapıları açık; F NOT STARTED.
- Kanıt/sonraki: [JSON](evidence/2026-10-05-b10-readiness-checkpoint.json); #116 exact-head CI green → normal merge → iki-host actual-origin/decode/save proof; kırmızıda yalnız repro fix.


## 2026-10-05 06:24 UTC — B10 release checkpoint
- Owner/branch: Astra; `astra/b10-production-checkpoint`; main/merge #116 `9e50404c0573e1cf9e2dd7e623c9c8bd98b95e56`; no status-only PR opened.
- A1–A3 CLOSED: #113 `375b837` → #111 `a534289`, verified two-host reload/CI evidence remains valid.
- B10 scoped proof CLOSED:31 local +9 real-browser fixture +216 viewport records; exact-head8/8+Vercel, main37270312084 SUCCESS; no gate/budget relaxation.
- B10 production: www+Workers each24 duel scenarios, VETO/GETT archives300 and unchanged legacy saves; actual origins/11 hashes; artifact11328870080 digest verified,8 PNGs opened.
- B1–B9 OPEN:0/900 accepted; CPU SND-011 probe `fc0c7e1` also rejected; no old/rejected/AI art rolled out, gameplay unchanged.
- B11 P1 OPEN: valid engine NOT_REPRODUCED; browser preparation `f18ff4d`,10 Node PASS, browser NOT_RUN.
- C1 partial: TC job-start candidate `0de03d8`,22 tests/36 protected files unchanged; mobile hidden-result review finding being fixed; no PR/browser/build/production acceptance. C2/C3 OPEN.
- D1/D2/D4 OPEN; D3 mixed art-cache P1 remains, DEVLET six synthetic cases did not reproduce data loss; D5 brace #114 CLOSED/general security OPEN; D6 Novella/#78/#79/SON KÖY WIP preserved.
- E1 NOT IMPLEMENTED; E2 four factual-source drafts/not expert-reviewed; E3 physical GPU/PL/anatomy human gates OPEN; F NOT STARTED.
- Evidence/next: [JSON](evidence/2026-10-05-b10-readiness-checkpoint.json); finish the narrow TC visibility/browser/offline gates; B7 quality threshold remains unmet, no900-card completion claim.


## 2026-10-05 07:24 UTC — C1/B11 release checkpoint
- Owner/branch: Astra; `astra/b10-production-checkpoint`; main #117 `539df6ee8cd3fe1e56b4a7833bffcc8953765488`; no status-only PR.
- A1–A3 CLOSED: #113 `375b837` → #111 `a534289`; prior exact-head CI/two-host reload proof retained.
- C1 partial: #117 actual job-start now/future result merged after9/9+Vercel; local1800 PASS/1 existing opt-in skip; built22/22 PASS; no rule/save change.
- C1 production run37276537798: first attempt stopped before browser on exact old-main hash; both deployments subsequently SUCCESS; failed-only attempt2 running, production NOT ACCEPTED yet.
- B11: #118 head `40ab0da`;17 local, built12/12 actual UI PASS; general CI campaign-browser pending, no merge; P1 allegation NOT_REPRODUCED_IN_VALID_UI_FIXTURES, natural-match/affected user save open.
- B1–B10 OPEN: accepted art0/900; existing cramped320 board text remains; no rejected asset rollout, no 300-card completion claim.
- C2/C3 OPEN; D2 TC mixed body translation and desktop narrow Inbox labels recorded as intake, not fixed or final-reviewed; source/DOM follow-up pending.
- D1–D4/general D5 OPEN; D4 inventory `1580d3e`,49 PNG lossless trial −6,117,735 B decoded-RGBA equal, NOT APPLIED/no route or history savings claim; D5 brace #114 CLOSED.
- D6 Novella/#78/#79/SON KÖY WIP preserved; E1 foundation NOT IMPLEMENTED, E2 drafts not reviewed, E3 PL/anatomy/physical-GPU human gates OPEN; F NOT STARTED.
- Evidence/next: [TC](evidence/2026-10-05-tc-job-start-release.json), [B11](evidence/2026-10-05-darbe-b11-release.json), [D4](evidence/2026-10-05-repo-weight-discovery.json); finish real two-host proof, then #118 only all-green normal merge.


## 2026-10-05 07:57 UTC — C1/B11 release and narrow P1 checkpoint
- Owner/branch: Astra; `astra/b10-production-checkpoint`; current main `23fb636cbfb0c30ad86fb52467982785e1e298b5`; current full CI37277755938 SUCCESS.
- A1–A3 CLOSED: #113375b837 → #111a534289; prior two-host reload/CI proof retained; no gate bypass.
- C1 partial CLOSED scope: #117539df6e, PR9/9+Vercel, www+Workers22/22 each, six screenshots/hash proof; own-main run cancelled by successor push, successor full CI green.
- B11 proof #11823fb636: PR9/9+Vercel/main CI green; www+Workers12/12 each,50 hashes/eight screenshots; NOT_REPRODUCED_IN_VALID_UI_FIXTURES, natural-match/AI/affected user save allegation OPEN.
- C1/D2 P1 #119 `astra/tc-dashboard-row-layout` head063aa4e: only8 CSS lines/+324B; local1804 PASS/1 existing skip then15 final target PASS; built22/22, old CSS real failure→readable titles; general CI pending, no merge/production.
- B1–B10 OPEN: accepted art0/900; target reference files unavailable and original vector/CPU probes rejected; no failed artwork rollout or gameplay/data/save change.
- C2/C3 and D1–D3 OPEN; mixed TC body translations, full old-worker/save matrices and other game-specific visual/map gates remain; F has not begun.
- D4 measured-only inventory1580d3e/lossless49-image trial retained, no conversion/deletion/history savings claimed; D5 brace #114 CLOSED, general security/provenance OPEN; D6 Novella/#78/#79/SON KÖY WIP preserved.
- E1 NOT IMPLEMENTED; E2 factual drafts NOT_REVIEWED; E3 physical GPU/PL native/anatomy expert HUMAN REQUIRED; remaining mandatory scope is OPEN, not DONE.
- Evidence/next: [TC](evidence/2026-10-05-tc-job-start-release.json), [B11](evidence/2026-10-05-darbe-b11-release.json), [P1](evidence/2026-10-05-tc-dashboard-layout-release.json); #119 only all-green normal merge→two-host proof; red/pending means no merge.


## 2026-10-05 08:12 UTC — C1/D2 narrow P1 merge checkpoint
- Branch/PR: `astra/tc-dashboard-row-layout`, #119 head063aa4e; normal merge `be160c95eb5283e5ed2ce8bf139ef7aa714d329d`.
- Value: Inbox/Key people titles use the available dashboard width; residual named CSS grid areas removed. No gameplay/save/shared engine/art change.
- Local: full1804 PASS/1 existing opt-in skip, final15 target PASS, build/typecheck/lint; exact-head9/9 checks+Vercel SUCCESS, built22/22 browser PASS.
- Production: run37282054880 and main37282054896 PENDING; no two-host production PASS yet.
- A1–A3 CLOSED; B1–B10 OPEN0/900; B11 bounded12-case proof released but broader affected-save allegation OPEN; C2/C3 and D1–D4/generalD5 OPEN.
- D5 brace #114 CLOSED; D6 Novella/#78/#79/SON KÖY WIP preserved; E1 NOT IMPLEMENTED/E2 drafts/E3 human gates; F NOT STARTED.
- Next: require exact new CSS hash and both-host22 cases/320–390–1440 layout+offline reload; no new large wave while CI pending.


## 2026-10-05 08:34 UTC — C1/D2 dar P1 kapanış checkpoint'i
- Branch: `astra/release-evidence-116-119`; PR #119 merge `be160c95eb5283e5ed2ce8bf139ef7aa714d329d`; uygulama farkı yalnız8 TC CSS satırı/+324B.
- Oyuncu değeri: Gelen kutusu/Önemli kişiler başlıkları masaüstünde tam satır genişliğini kullanıyor; karar ve kayıt hesapları değişmedi.
- Yerel gate: full1804 PASS/1 mevcut opt-in skip; son15 hedefli PASS; build/typecheck/lint PASS; built22/22 browser PASS.
- CI: exact-head9/9+Vercel SUCCESS; main37282054896 SUCCESS; korumalı normal merge, gate değişikliği yok.
- Production37282054880 attempt2: www22/22+Workers22/22; dört exact hash,76 ölçüm/host,320–390–1440/offline reload/sentetik v1; ZIP digestleri ve6 ekran görüntüsü doğrulandı. İlk deneme eski CSS'i doğru reddetti.
- A1–A3 CLOSED (#113375b837 → #111a534289); önceki iki-host reload kanıtı korunuyor.
- B1–B10 OPEN, kabul0/900; B7 gerçekçilik engeli aşılmadı. B11 #118 bounded UI proof12/12/host; özgül kullanıcı kaydı/doğal maç iddiası OPEN.
- C1 KISMİ; C2/C3 OPEN. D2 üç eksik EN kontrol metni+bir PL etiket için ayrı dar çalışma başladı; henüz PR/CI/production yok, kalan karma gövde metni OPEN.
- D1–D4/genelD5 OPEN; D5 brace #114 CLOSED; D6 Novella/#78/#79/korunan SON KÖY WIP değişmedi.
- E1 NOT IMPLEMENTED; E2 kaynaklar taslak/not-reviewed; E3 anatomi uzmanı/fizikselGPU ve D2 PL anadil gereksinimleri OPEN; F NOT STARTED.
- Kanıt: `docs/evidence/2026-10-05-tc-dashboard-layout-release.json`; sonraki yalnız dar D2 test/CI/iki-host zinciri. Bu checkpoint bütün sözleşmenin kapanışı değildir.


## 2026-10-05 11:52 UTC — A1–A3 doğrulandı; B yeniden etkin
- Branch: `astra/release-evidence-116-119`; mevcut main `be160c95eb5283e5ed2ce8bf139ef7aa714d329d`; main CI37282054896 SUCCESS.
- A1/A3 CLOSED: #113 merge375b837; iki-host HANEDANIAN reload/save/320–390–1440 kanıtı37256148798 SUCCESS.
- A2 CLOSED: #111 mergea534289; bağımlılık sırası korunmuş, iki-host production37258787888 SUCCESS; yeni hotfix gerekmedi.
- B3: üç gerçek onaylı hedef dosya kurtarıldı ve pikselleri incelendi; yalnız ışık/materyal/anatomi kalite yönü, kopya/türetme yok.
- B1–B10 OPEN: kabul0/900; önceki başarısız vektör/CPU denemeleri üretime alınmadı. Üç oyun için ayrı kaynak-yüzey uygulaması sürüyor.
- B10: build-time tam300/cohort/hash/provenance doğrulaması ayrı uygulama; henüz runtime/offline çözümü veya production kabulü değil.
- B11: #118 iki-host12/12 gerçek UI fixture; dar koşullarda tetiklenmeme yeniden üretilemedi, özgül eski kullanıcı kaydı/doğal maç iddiası OPEN.
- C1 KISMİ (#117/#119 kanıtlı); C2/C3 OPEN; D2 yerel `astra/tc-week-control-i18n` b32a4dd korunuyor/DEFERRED, PR/CI/production yok.
- D1–D4/genelD5 OPEN; brace #114 CLOSED; D6 Novella/#78/#79/SON KÖY WIP korunuyor; E1 NOT IMPLEMENTED/E2 taslak/E3 insan kapıları; F NOT STARTED.
- Sonraki: B7 gerçekçilik eşiği → oyun başına300 kart/B10 → bağımsız CI/iki-host release. Referans erişimi sanat onayı değildir.


### 2026-10-05 12:15 UTC — user ownership split / Grok handoff
- Branch `astra/grok-card-handoff`, base `be160c95`; docs-only checkpoint, no art/frame/generator/runtime/engine/save changes; PR/CI/merge/production not run for this docs-only handoff.
- B1–B10 production ownership transferred to Grok; Astra stops conflicting art commits/PRs and retains invariant/quality/release review. Replacement art remains 0/900 accepted.
- Handoff: `docs/GROK_CARD_ART_HANDOFF.md`; three immutable remote branches, exact source hashes/IDs, 300×3 existing briefs, private-reference IDs, source/transport/provenance/budget/offline acceptance.
- Validation: source 300 unique IDs/game; all remote preparation trees match local; semantic tests VETO6/6 + GETT5/5 + DARBE6/6 PASS. No new browser/production/art-acceptance claim.
- A1–A3 CLOSED: #113 `375b837` → #111 `a534289`; TC #117/#119 released, main `be160c95`; main CI37282054896 and two-host production37282054880 SUCCESS. Earlier pending entries are historical.
- B11: #118 valid UI fixtures NOT REPRODUCED; natural-match/affected-old-save boundary stays open, no artwork-based rule closure.
- C1–C3/D1–D5/E remain Astra scope; card cache integration must coordinate with Grok. #112, source/preparation branches and rejected studies preserved; local cohort pipeline `ecfbf29` deferred/unwired.
- D6: Novella LATER, closed #78/#79 and stale branches untouched; PL native, anatomy expert and physical GPU remain honest human requirements.
- F: only after all product work and Grok releases reach production; report/classify evidence, then stop broad fixes unless separately tasked. Next: root reviews/publishes this narrow handoff and resumes non-card work.


### 2026-10-05 12:40 UTC — D2/D3 candidate checkpoint; Grok owns B1–B10
- A1–A3 CLOSED: main `be160c95`; #113/#111 and #119 release runs remain verified green, not reopened.
- B1–B10: Grok handoff published `3bc44fb`; 900 semantic briefs/protected sources retained, no new Astra art/frame/generator/asset changes.
- D2: #120 `f1cc533`, `astra/tc-week-control-i18n`; local 1,807 PASS/1 existing skip; built browser22/22 +88 localized-control measurements PASS, artifact11345097869; root inspected EN390, PL320 and TR1440 screenshots.
- D2 CI: build-core/TC built/Workers/Vercel green; shared browser and campaign-browser pending. No merge/production claim for #120.
- D3: #121 `7ea1ba7`, `astra/kiyi-save-hotfix`; missing-ramps crash and unsafe old-cache validator reproduced, valid backup/raw retention/quota path fixed; schema/rules/art/renderers unchanged.
- D3 local:28 target PASS; full1,823 PASS/1 existing skip; build/typecheck/lint PASS. First root build had only transient rsync-tmp ENOENT; unchanged retry passed. CI/built browser now running; no merge/production.
- D3 boundary:37 actual browser cases required; completely offline old HTML remains old until reconnect; no archived-user/Pixi/physical-GPU/native-PL acceptance claim.
- E1:48-line route/offline handoff saved; isolated static product proposed, not implemented. Geometry/source gaps and hash-bound independent anatomy review remain open.
- F NOT STARTED: waits for remaining products and Grok production art; report/classify only, no automatic broad post-report fixes.
- Next: finish both green release gates and exact two-host proof; then Kıyı's one state-derived continuity/outcome upgrade. Novella/#78/#79 untouched.


### 2026-10-05 13:15 UTC — D2/D3 iki-host release checkpoint
- Branch `astra/release-evidence-116-119`; main `9b4e169ab198d1ad37f6dd82f13f4b394adf2045`; yalnız kanıt/handoff belgeleri, runtime farkı yok.
- A1–A3 CLOSED: #113/#111 reload zinciri korunuyor; eski blocker yeniden açılmadı.
- B1–B10 Grok: kısa `GROK_CARD_ART_HANDOFF.md`, 300×3 brief/source/provenance kapıları; Astra sanat commit'i yok. B11 doğal50 maç/6.342 yasal aksiyonda0 hedef çağırma/aktivasyon fırsatı; iddia P1 OPEN, etkilenen eski save yok.
- D2 #120: head`f1cc533` → merge`1700e6a`; exact-head9/9+Vercel SUCCESS; local1.807 PASS/1 skip, built22/22; production37312651467 attempt2 iki-host22/22 +88 kontrol/host ve6hash PASS.
- D3 #121: head`7ea1ba7` → merge`9b4e169`; exact-head9/9+Vercel SUCCESS; local28target/full1.823 PASS/1 skip, build/typecheck/lint; built37/37.
- D3 production37314184260 attempt2: www37/37 +Workers37/37;5hash/host,148 ölçüm/host,console/network/overflow0,111PNG/host;6 ekran açıldı. Bozukprimary→backup, ham veri koruma, kota, eski cache→online→warmoffline PASS; schema1/rules değişmedi.
- CI: #120 main37312651635 successor tarafından CANCELLED; #121 current-main37314184406 IN_PROGRESS, green kapanışı hâlâ gerekli. İlk production denemeleri önceki hash'i doğru reddetti; deploy kanıtından sonra yalnız failed jobs rerun, gate değişmedi.
- C1–C3: Kıyı süreklilik/sonuç sözleşmesi net; `astra/kiyi-continuity-outcome` temiz9b4e169 discovery tabanı, henüz uygulama yok. Apartman/Son100 adayları ayrı discovery handoff.
- D1–D5 genel OPEN; #114 brace CLOSED; PL gövde/anadil, gerçek eski save, tam SW kohortu ve fizikselGPU OPEN. E1 route/source planı var, foundation NOT IMPLEMENTED/uzman atanmamış.
- F NOT STARTED: kalan ürünler ve Grok production release sonrası kanıtlı rapor/sınıflandırma; rapor sonrası geniş fix görevi kullanıcıda. Novella/#78/#79/SON KÖY WIP korunuyor.
- Sonraki: current-main green → Kıyı tek C1/C3 upgrade'i; release JSON'ları `docs/evidence/2026-10-05-{tc-week-control-i18n,kiyi-save-recovery}-release.json`.


### 2026-10-05 13:55 UTC — E1–E3 Atlas first implementation checkpoint
- Branch `astra/anatomy-foundation`, base `686cdf92057eda1c803d20cd631a1769ee8f6855`; Atlas PR/head/CI/merge/production not yet published. #122 documentation checkpoint merged; #121 main37314184406 SUCCESS supersedes earlier pending notes.
- E1 player/learner value: a learner can select a body structure, compare adult front/back layers, and connect approximate location with a sourced function while seeing the drawing's limits.
- E1 implemented: separate `/atlas/yapi/`, female/male, surface/skeleton/six-organ layers,13 structure labels, TR/EN/PL, search, zoom/pan, three-stop exploration and keyboard-accessible DOM equivalents; cached original SVG, no WebGL dependency.
- E2/E3: first learning DRAFT, all content/geometry NOT_REVIEWED; educational/no-medical-advice and scope notes visible online/offline. Independent anatomy expert and native PL review remain unassigned; no clinical/complete/GPU claim.
- Local:52 Atlas target PASS; full suite1,874 PASS/1 existing opt-in skip; typecheck/lint/build PASS. Incremental build stale-geometry mismatch reproduced and fixed with one-snapshot runtime emission; actual HTTP14-file fingerprint PASS. Final layout/browser acceptance remains pending CI.
- Browser local blocker: preview's Wrangler fails at `uv_interface_addresses`; earlier Chromium environment crashes are not retried. Dedicated CI exercises real preview,320/390/1440×TR/EN/PL, clipping/resize, offline and portal isolation; no gate relaxed.
- D3 boundary: new Atlas scoped worker only; existing game saves/cache untouched, sentinel regression only. New save-recovery/migration and deep old-game-cache work DEFERRED by user.
- B1–B10: Grok art / Opus#123 loading+manifest+cache integration; zero overlapping files, duel-core/theme-meta.js and card-art/release-gate surfaces untouched. #112/preparation branches preserved.
- C1–C3: Kıyı visual branch remains preserved/deferred, no implementation; other noncard scene/map work resumes only after Atlas production proof. A1–A3/#113/#111 already CLOSED, not reopened; Novella/#78/#79 untouched.
- F: final360 review explicitly transferred to another agent by user; removed from Astra task list. Historical review entries are superseded; no report preparation in this checkpoint.
- Next: exact-head CI + real browser screenshots → protected merge → exact package/two-host production proof; only then next noncard product wave.
