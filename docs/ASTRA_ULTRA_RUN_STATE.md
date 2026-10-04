# Astra Ultra — game-by-game run state

Updated: 2026-09-26 (UTC). Release monitoring belongs to Terra / Sol / Luna; this run does not poll CI, wait for merges/deployments or run unattended soaks.

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
