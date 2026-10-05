# TarikLab — final 360° inceleme intake'i ve yayın kapıları

Tarih: **2026-10-05 (Türkiye)**. Sahip: **Astra — inceleme, dar düzeltme ve release kapanışının tamamı**. Bu belge final 360° için gelecekteki kabul checklist'idir; final inceleme ve anatomi A keşfi başlamadı. Ayrı release/repro kanıtları aşağıdaki tarihli checkpoint'lerde belirtilir. Yeni kaynak planı/özellik de bu hazırlıkta denetlenmez.

Dokümantasyon branch'i: `astra/review-release-gates`. Fresh fetch ile alınan taban: `b4ebc2babe7c754493d84421051c9531fc09215e` (`origin/main`). Bu SHA gelecekteki birleşik release'in incelenmiş SHA'sı değildir. Hazırlık yalnız bu dosyadır; kayıt altına alınması review'ün başladığı veya geçtiği anlamına gelmez.

## Durum sözleşmesi

| Durum | Anlam |
| --- | --- |
| PASS | İlgili gerçek SHA'ya bağlı tamamlanmış kanıt; şu anda hiçbir inceleme satırı PASS değildir |
| P1 | Öncelikli kayıt; repro/doğrulama durumu ayrıca açıklanır. DRB-237–240 yalnız kullanıcıdan devralınmış, doğrulama bekleyen kayıttır |
| LATER | Bu belgedeki bütün teknik satırlar için **önkoşul bekliyor / NOT REVIEWED**; açıkça ertelenen işlerde ayrıca gerekçe belirtilir |
| insan-inceleme-gerekli | İsim/tarih/kapsam/karar kaydı gereken insan kapısı; model veya CI ile kapatılamaz |

Genel durum **LATER — önkoşul bekliyor / NOT REVIEWED**. Kanıt toplanmadığı için boş alanları başarı varsayımıyla doldurmak yasaktır.

## Ayrı başlangıç kapıları

- **Anatomi A keşfi:** yalnız #110/#111 CI root-fix kapanışından sonra başlayabilir. Foundation'ın veya bütün 360° turun tamamlanması bu keşfin önkoşulu değildir.
- **Final 360° inceleme:** tüm mevcut ürün/visual/performance/anatomy foundation işleri merge edilip production kanıtıyla kapandıktan sonra başlar. Anatomi A keşfi ile bu kapı birleştirilmez.

Aşağıdaki PR ve çalışma notları kullanıcının devir kayıtlarıdır; bu hazırlıkta yeniden sorgulanmamış ve kapanmış kabul edilmemiştir.

| Kapı / korunacak iş | Gelecekte gereken kapanış | Durum |
| --- | --- | --- |
| #110 → #111 | Önce #110 kırmızı kontrolünün kök nedeni dar repro/fix ile kapatılır; baseline HTTP ve gerçek browser kapanışı olmadan #111 merge edilmez. Düzeltilmiş tabana rebase'in push/CI sonucunu bu belge doğrulamaz | LATER |
| #109 | Browser CI ve production kanıtı olmadan DONE değildir | LATER |
| Mevcut release dalgaları | Ürün/visual/performance/anatomy foundation PR → merge SHA → iki host production kanıtı; bundan sonra birleşik 360° hedef SHA'sı kesinleşir | LATER |
| SON KÖY | `astra/son-koy-maintenance-atlas` / `95099f9` korunmuş WIP: `son-kasaba/app.js` atlas aç/kapat/karar masası geçişi; untracked `atlas-model.js` bakım borcu ve kopya state önizlemesi; `atlas.js` SVG kesit/filtre/klavye. CSS/test/offline/mobil/PL kanıtı eksik. Wave3'te güncel main'den ayrı PR'a seçici aktarım adayı; şimdi dosyalar değişmedi ve branch bütünü merge edilmez. Sahip Astra | **LATER — gerekçeli deferred, kayıp iş değil** |
| `brace-expansion` dev/high | Güncel advisory, sürüm ve bağımlılık yolu yeniden doğrulanır; ayrı dar PR veya sürüm/etki/erişilebilirlik/azaltım/sahip içeren açık blocker kaydı. Eski bulgu kapanmış veya güncel diye varsayılmaz | LATER |
| Fiziksel GPU | SwiftShader/llvmpipe/softpipe fiziksel GPU/Pixi kanıtı değildir; gerçek aygıt ve renderer kanıtı ayrıca gerekir | LATER |
| PL ana dil | Ana dili Lehçe olan insanın isim/tarih/kapsam ve düzeltme kaydı | insan-inceleme-gerekli |
| Anatomi uzmanı | Bağımsız yetkin uzmanın kaynak/sürüm/kapsam/tarih/karar kaydı | insan-inceleme-gerekli |
| Eski branch kabulü | Yalnız açık PR, bağlayıcı kaynak planı veya açık kullanıcı talebiyle eşleşen branch alınır; eski olması otomatik kapsam oluşturmaz | LATER |

Gerekçeli LATER kaydı DONE değildir ve zorunlu bir release kapısını kendiliğinden kaldırmaz. Astra mevcut kullanıcı yetkisiyle release kapanışını da sahiplenir; başka ajana zorunlu handoff şartı yoktur.

### 2026-10-05 release önkoşulu kanıtı — final review başlamadı

- #110 `64f20ffd03b555808e2f2db6ffb505d2dc37a567`: run `37238892501` dört Actions job SUCCESS;
  ayrıca görünen Workers/Vercel check ve Vercel status SUCCESS. Required-check yönetim API'si 403;
  bağımsız required kümesi okundu iddiası yok, GitHub normal merge koruması atlanmaz.
- Artifact `11317021469`: before/source/built her fazda üç oyun × 1440/390/320 = 9 başarılı
  senaryo; save/reload/no-replay ve errors=[] kayıtları. Source/built dört outcome modülünün
  SHA-256'sı exact head ile eşleşir. Bütün dosyalar/deploy SHA veya fiziksel GPU kanıtı değildir.
- #109 head `04aeacbc` #110'un tam atasıdır (compare ahead 6 / behind 0). #109 source/built
  Çete browser adımları PASS; PR koşusunun production adımları SKIPPED. Production hâlâ kapıdır.
- #111 eski `457213a` run `37240215425` / job `111547271911`: 44 baseline vaka sonrası
  HANEDANIAN/320 worker `request.sizes()` timeout. Yeni `fec5f66` tam HTTP byte ölçümü ve
  bounded metadata teşhisi içerir; 30 yerel regression, ESLint/build PASS. Yeni run `37241690633`
  route-costs SUCCESS, artifact `11317803281`: before/after 63+63, errors=[], ölçülmüş overflow=0.
  Metadata kontrolü before/Han390'da response promise'inin çözülmediğini doğruladı; aynı isteğin
  HTTP 200 / 1260 gövde baytı / finished=true ağ kaydı mevcut. Genel CI `37241690632` build job `111551601225`, 25 dakika toplam job tavanında CANCELLED;
  TC SIM adımı yarım kaldı. Bu satır tam #111 veya release PASS değildir. #110 ve #111 ikisi green olmadan merge yok.
- Güncel dar CI fix `889cd133`: aynı core/browser kontrolleri ayrı 25 dakika işlerde;
  required `build` always gate bütün bağımlılıkları exact success olarak doğrular. Failure,
  cancelled, skipped, missing veya bozuk payload FAIL; 20 yerel regression + ESLint/build PASS.
  #110 head `fea0d0c`, CI `37244054041`; #111 head `de4c416`, CI `37244258514`,
  ölçüm `37244258417`: yayın anında pending, yeni head için PASS verilmedi. #111 ürün/src/save
  ve bağımlılık dosyaları eski `fec5f66` ile aynı; 9 commit rebase edildi, eski head backup ref'te.
- Sonraki dar fix: `de4c416` ölçüm run `37244258417` / job `111558890122`, TC SIM DEVLET390
  iframe henüz body oluşturmadan `innerText` okunduğu için FAIL. Fix `24c76754` null body'de
  bekler; aynı trim length>20 / 20 saniye ve bütün hata/byte/overflow kapıları korunur.
  20 hedefli regression + ESLint/build PASS. Güncel #111 head `9c47c0d293a0f47dbce62822d94637151ccaceb4`;
  CI `37244773929` pending, map `37244773932` in_progress. #110 `fea0d0c` build-core SUCCESS,
  browser/soak henüz in_progress. Hiçbir merge veya yeni production PASS yok.
- Görsel kanıt sınırı: #110 Racon 390/320 full-page PNG genişliği 730/621 px, sağ boşluk
  baseline/source/built'te aynı; DOM scrollWidth 390/320. Yeni regresyon doğrulanmadı.
  Final B/C incelemesinde viewport screenshot + gerçek yatay kaydırma/hit-test ile sınıflandırılacak;
  yalnız DOM testiyle “bütün görsel taşma temiz” denmeyecek.
- Release sırası: #110 (aynı #109 kodu dahil) → iki-host gerçek smoke → #111 güncel main
  tabanı/CI → iki-host smoke. Değişen renderer/app/style dosyalarının paritesi ayrıca gerekir;
  dört outcome dosyasının paritesi tüm deploy'u kanıtlamaz. Yeni ürün dalgası henüz başlamadı.

Ek preview keşfi: Cloudflare commit preview `262f19d9` (#111 `fec5f66`) Racon, TR,
1363×936 gerçek tarayıcı/SVG. Boş Slot1 → yeni oyun → Koru: kasa 11000→8500, güven
50→53, 3 kapanışlık emir; Kaydet→reload→Devam aynı değerler, outcome replay=0.
DOM genişlik=scrollWidth=1363; incelenen oyun-origin console error yok. Browser extension
metadata hataları ayrı görüldü. Screenshot `racon-fec5f66-preview-1363-save.jpg` (110510 B).
Bu ek gözlem 320/390/1440, Pixi, iki-host production veya final 360 PASS yerine geçmez.

`11317803281` ölçüm notu (390 px, aynı yerel HTTP forwarder; production HTTPS değildir):
portal 172399→172415 B / 9→9 istek; HANEDANIAN 696509→696525 B / 87→87;
Racon 407249→408850 B / 22→22; İHTİLÂL 206685→207429 B / 19→19.
Portalın üç genişlikte oyun/Pixi isteği yok. Bu giriş maliyetidir; harita seçim maliyeti ayrıca ölçülür.
Baseline ve aday preview stdout'unda aynı PGLite `Invalid URL string` bootstrap kaydı var;
ziyaret edilen oyunların console/ağ assertion'ları geçti. Sunucu log kaydı gizlenmez; C/F review'de
guest oyun akışından ayrı DB kullanan yüzey etkisi doğrulanacak, bu kaynak kaydı tek başına P1 teşhisi değildir.

### #111 tamamlanmış browser artifact'i — eski head kanıtı

Run `37241690632`, head `fec5f66`, [artifact 11317874879](https://github.com/tayaz-maker/tariklab/actions/runs/37241690632/artifacts/11317874879).
ZIP SHA-256 `6d2314f9e34ec2dd15dcd6fdaebf1bd2dfafa1fa04c3f3e4ce7f80874f92d20a` doğrulandı.
Before/source/built sonuçları 9/13/13 senaryo, 42/79/79 kayıt, errors=[]; saveReload/noReplay true.
Built 1440/390/320 harita ve dört low-memory/DPR screenshot'u açılarak incelendi; constrained
senaryolarda Pixi isteği 0, SVG karar yüzeyi mevcut. Context-loss/cleanup ayrı JSON event'i değil:
exact-head scriptindeki `WEBGL_lose_context`, SVG'ye geçiş/sıfır canvas ve ekran cleanup assertion'ları
başarılı son kayıttan önce çalışır. Bu ayrım fiziksel GPU veya production PASS'a dönüştürülmez.

12 seçimde source/built İHTİLÂL ve Racon'un 10'ar senaryosunda kaldırılan statik işaret 0;
baseline 84–384. İHTİLÂL1440 medyan senkron render 1.3→0.5 ms, Racon1440 2.2→0.8 ms.
Bütün başlangıç süreleri iyileşmedi: Racon1440 karar yüzeyi 399→477 ms. Bu tek CI örneği genel
hızlanma iddiası vermez. Racon390/320 after PNG'leri before/source/built arasında piksel olarak aynı
(730×844 / 621×844); yukarıdaki mobil görsel kanıt sınırı açık kalır. Dört outcome modülü hash'i
source/built eş; tüm renderer/deploy paritesi henüz yok. Yeni head `de4c416` CI'sı ayrı kapıdır.

### Harita girişleri — pending CI sırasında yalnız kaynak keşfi

Kaynak ağacı #111 `fec5f66`; aşağıdaki entry/import/test varlığı güncel browser veya production PASS değildir.
Eski map-status dosyasındaki Racon/JITEM “NOT STARTED” notları güncel kaynakla çelişir; İHTİLÂL solo entry'si ayrıca alınır.

| Oyun | Kaynakta doğrulanan karar/render yolu | Güncel review'de tamamlanacak kanıt | Durum |
| --- | --- | --- | --- |
| HANEDANIAN | `app.js → map-factory.js → map/map-pixi/map-dom`; Canvas taban, opsiyonel Pixi atlas, DOM defteri | Fallback/context-loss/texture cleanup, offline/save, gerçek GPU ayrıca; cold entry harita kabulünün yerine geçmez | LATER |
| İHTİLÂL | `solo-app.js → basin-map.js → shared/pixi-adapter`; havza/rota/varış zamanı, SVG/Pixi | #111 low-memory/DPR ve statik işaret testi artifact'i; güncel offline/production | LATER |
| Racon | `index.html → network/map-model/map-view`; emir/komşu gecikmesi, SVG/Pixi | #111 retention/cleanup/low-memory; Racon PNG sınırı; offline/production | LATER |
| TC SIM DEVLET | `app/presentation → maps.js/maps-pixi.js`; bölge kapasitesi/diplomasi, SVG ve Pixi overlay | Tam repaint maliyeti, listener/canvas ömrü, hidden/low-memory/offline; eski #100 kaydı tek başına yeni PASS değil | LATER |
| TC SIM | `js/app → decision-network/weekly-feedback`; gerçek hafta/ilişki/sonuç DOM'u; bu entry'de mekânsal renderer yok | Coğrafya uydurmadan karar-zaman-bağ karşılaştırması; uygulanamaz sayılmaz, eksik fayda gerçek akışla P1/backlog olarak gerekçelendirilir | LATER |
| JITEM | Upstream `0c1fc08`: `GameApp → NodeGraph → AtlasSurface → lazy atlas-pixi`; SVG etiket/klavye, gerçek hamle | Kaynak önce canonical upstream; vendor paritesi, hidden/redraw/low-memory/offline, iki-host; lazy dosya varlığı çalışma kanıtı değil | LATER |
| Kıyı Eşiği | `app → map-model/map-pixi`; SVG ve lazy Pixi, erişim kopukluğu ve dönem kararı | Full redraw/nesne ömrü, context-loss, düşük bellek/visibility, offline; ölçmeden cache dönüşümü yok | LATER |

Test kaynakları: `hanedanian-map-pixi/atlas-scheduler/offline`, `ihtilal-basin-network`, `racon-map-consequences`,
`map-static-cache`, `devlet-map-pixi`, `tc-sim-decision-network/weekly-feedback/production-cache`, `jitem-integration`,
`esik`, `pixi-adapter` testleri ve ilgili browser scriptleri. Yalnız kaynak varlığı burada kaydedildi; final PASS verilmedi.

## A–G kabul kapsamı

| Alan | Gelecekte doğrulanacak ölçüt ve kanıt | Durum |
| --- | --- | --- |
| A — Ürün/oyun | Onboarding, ilk gerçek karar, bedel/sonuç, feedback, ilerleme, kazanma/kaybetme/çıkış, save sınır durumları ve çift bildirim; gerçek başlangıç → karar → sonuç → save/reload akışı | LATER |
| B — Görsel UX | Portal/kategori/oyun/atlas/kaynaklar; 1440×900, 390×844, 320 px; TR/EN/PL; klavye/reduced motion; kontrast, tipografi, tıklama alanları, overlay, loader/error; screenshot + DOM/ölçüm | LATER |
| C — Teknik | Console/404/JS/modül/hydration; deep link/back/refresh; offline/SW upgrade/cache version; SVG/DOM-WebGL/context loss/resize/düşük bellek; legacy save/migration/bozulma/seed; memory/ticker cleanup | LATER |
| D — Performans | Route bytes/istek sayısı/ilk anlamlı render; lazy loading, portal-oyun asset sınırı; duplicate/unused içerik; build ve git geçmişinin gerçek byte etkisi. Aynı cihaz/renderer/ağ/rota koşullarında baseline-aday SHA ile ölçülmüş önce/sonra | LATER |
| E — A11y/i18n | Başlıklar/labels/aria-live, focus trap/restore, hedef boyutu, yalnız renge dayanmayan anlam; TR/EN/PL eksik metin/encoding/taşma; klinik dilin açık sınırı. PL insan kapısı ayrıca kapanır | LATER |
| F — Savunma amaçlı güvenlik | Maskelenmiş secrets/public env, auth bypass/fail-open, CSP/iframe/üçüncü taraf, dependency/CI/deploy, preview-production ayrımı; izinli yerel fixture/kod incelemesi. Canlı saldırı, hesap denemesi veya gerçek veri değişikliği yok | LATER |
| G — Köken/lisans | Kaynak/lisans/NOTICE, dış CDN/asset, gerçek logo/kişi/harita/kopya görsel dil sınırları; anatomi kaynak ve uzman kapısı. Hukuki güvence iddiası yok | LATER |

## Zorunlu on iki maddelik ürün ve release envanteri

| No / kapsam | Gelecekteki somut doğrulama ve değişiklik sınırı | Durum |
| --- | --- | --- |
| 1 — DARBE-H! / Wave 4 | Güncellenmiş sınır: `outputs/ASTRA_WAVE4_DARBE_BOUNDARY.md`; 300 karta yayılım stil onayına bağlıdır. **Güncel kullanıcı talimatı:** 300 SVG kartın görsel tasarımı yenilenecek; önce 8–12 temsil kartı ve desktop/mobile stil onayı, sonra ayrı uygulama PR'ı. Kart verisi/denge/deste/save/ortak duel engine/kart ölçüsü/erişilebilir metin korunur. Her sahne kart türü/etkisi/serisiyle anlamlı ve ayrı; sivil arşiv/karar/belge/iz/sonuç dili, yetişkin ayrıntısız sivil figür olabilir. GETT/VETO layout/palet/çerçeve/ikon/sahne kopyalanmaz. Sessiz sonuç anı ve masa katmanı ayrı gerçek state geri bildirimi; reduced motion/skip okunur kalır. Gerçek kişi/kurum/parti/askerî sembol, şiddet estetiği, dış asset ve kopya UI yok. DRB kaydı aşağıda ayrı | LATER |
| 2 — VETO-H! / GETT-OH! / DARBE-H! | 320/390 px el-masa akışı, focus/restore, reduced motion, legacy save, kart yüzleri ve sessizlik gerçek browser'da test edilir. Yeni kapsamda ortak duel engine'e dokunulmaz; oyun-özel veri sınırı korunur. Gerekli kural düzeltmesi görsel PR'a karıştırılmaz | LATER |
| 3 — HANEDANIAN / İHTİLÂL / Racon / TC SIM: DEVLET / TC SIM / JİTEM / Kıyı Eşiği | Güncel Pixi/SVG/DOM/Canvas durumu doğrulanır; 1440/390/320 px, context loss, resize, pan/zoom, ekran geçişi, offline, save ve overlay test edilir. Haritanın gerçek karara etkisi incelenir; baştan “dekoratif” veya “uygulanamaz” varsayılmaz. Eksik karar yüzeyi açık backlog veya kanıtlı P1 gerekçesiyle kaydedilir | LATER |
| 4 — TC SIM başlangıçları | Günümüz, **1999-04-18**, **1980/1984/1988** başlangıçlarının her biri sabit seed ile **2026-01-01 son akışına kadar** test edilir. Determinizm, gecikmiş etkiler, legacy `tc-sim-save`, save/reload, olay-bazlı kaynaklar ve üç genişlik doğrulanır. Olgular dengeli/kaynaklı; propaganda veya belirsiz iddiayı kesinleştirme yok | LATER |
| 5 — Çete Savaşları / sonuç anları | Gösterim gerçek oyun sonucundan türemeli; sessiz, atlanabilir, reduced-motion uyumlu ve okunabilir olmalı. Mobil/düşük güçlü cihazda sonuç-feedback tutarlılığı ve etkileşim devamlılığı ölçülür | LATER |
| 6 — Tüm ürünler / dil ve sessizlik | Ses/müzik/titreşim/autoplay yokluğu; TR/EN/PL UI ve body; eksik çeviri/encoding/overflow; 404/console doğrulanır. PL ana dil insan kapısı model veya CI ile kapanmaz | LATER |
| 7 — Köken/asset/kod | Özgün kod, lisanslı legacy ve kökeni belirsiz içerik ayrıştırılır; NOTICE/kaynak eşleşmesi, `/__grok/` ve `extensions.js` kalıntılarının sözleşmesi/etkisi, büyük/unused referansların gerçek byte etkisi incelenir. Bu intake silme yetkisi veya hukuki garanti vermez | LATER |
| 8 — Offline / SW | Shell/asset sürümleri; eski→yeni SW upgrade/cache geçişi; offline rotalar, online dönüş/fallback ve eski save migration gerçek browser'da birlikte test edilir. Karışık paket, kayıp asset veya save kaybı olmamalı | LATER |
| 9 — Dependency / güvenlik | Dependencies/NOTICE, `brace-expansion` dev/high sürümü/etkisi, CSP/dış kaynaklar, statik routing/traversal sınırları, loglarda gizli veri ve CI/deploy fail-open; yalnız izinli yerel kanıt. Sadece kanıtlı dar P0/P1 için ayrı fix PR | LATER |
| 10 — Anatomi | Ayrı foundation tam anatomi değildir; tam/klinik kesinlik iddiası yok. Offline kaynak/tarih/owner/review status; eğitim-not-advice UI/schema/test/release kapıları doğrulanır. Tam sistemler ayrı içerik dalgaları için LATER; bağımsız uzman kapısı ayrıca gerekir | LATER |
| 11 — Novella / #78–#79 / eski branch | Novella **LATER** kalır. Kullanıcı kaydındaki **#78/#79 CLOSED**; yeniden açma/merge yok. Kapanış gerekçeleri yalnız review başlayınca kaynak kayıttan alınır, şimdi tahmin edilmez. Eski branch açık PR/kaynak planı/kullanıcı talebi olmadan kapsam değildir | LATER |
| 12 — Son kanıt | Yerel test + gerçek browser CI + iki production host'u, gerçek SHA/build kimliğine bağlanır; screenshot/DOM/console/adım kaydı gerekir. Kanıt olmadan fiziksel GPU veya insan testi iddiası yok; HTTP 200/yeşil CI tek başına yeterli değil | LATER |
| 1a — DRB-237–240 | Kullanıcının **tetiklenmeme P1 kaydı**; bu turda repro/teşhis/gerçek test yok. A/C başladığında state/önkoşul/eylem/beklenen-gerçek tetik ve save/reload doğrulanır. Doğrulanırsa güçlü regresyon testli **ayrı dar kural fix PR'ı** gerekir; görsel Wave 4 PR'ında çözülmez | **P1 — doğrulama bekliyor / NOT REVIEWED** |

## Katalog rota intake'i — işlev veya yayın doğrulaması değildir

Aşağıdaki değerler yalnız bu dokümantasyon tabanındaki `src/lib/games.ts` dosyasından salt okunur alınmıştır. Bu, ürün/atlas keşfi veya production rota testi sayılmaz. Katalogdaki `live` etiketi PASS kanıtı değildir. Her rota gelecekte ayrı kanıtlanacaktır; tüm satırlar LATER durumundadır.

| Katalog grubu | Katalogdaki oyun → href | Durum |
| --- | --- | --- |
| Harita/strateji | Çete Savaşları → `/cete-savaslari`; HANEDANIAN → `/oyna/hanedanian`; Racon Manager → `/oyna/racon`; Son Mahalle Bükücü → `/games/bukucu/index.html`; TC SIM: DEVLET → `/oyna/tc-sim-devlet`; Kıyı Eşiği → `/oyna/esik` | LATER |
| Yaşam | TC SIM → `/oyna/tc-sim`; Kapı Nöbeti → `/oyna/apartman`; SON KÖY MANAGER → `/oyna/son-koy-manager`; Son 100 Gün → `/oyna/son-100-gun` | LATER |
| Dosya | Kayıp Telefon → `/oyna/kayip-telefon`; İhtilâl → `/oyna/ihtilal`; JITEM: Derin Ağ → `/oyna/jitem-derin-ag` | LATER |
| Kart/masa | VETO-H! → `/oyna/veto-h`; GETT-OH! → `/oyna/gett-oh`; DARBE-H! → `/oyna/darbe-h`; Satranç → `/oyna/satranc`; Amiral Battı → `/oyna/amiral-batti`; Tek Taş → `/oyna/peg-solitaire`; Labirent → `/oyna/labirent` | LATER |
| Katalog alias'ları | `hanedan` → `hanedanian`; `son-koy-manager` → `son-kasaba`. Deep link/back/refresh/save davranışları ileride doğrulanır | LATER |

Portal, kategori, kaynaklar ve anatomi foundation'ın kesin rota/yüzey eşlemesi yalnız inceleme başladığında tamamlanır; burada katalogda olmayan URL üretilmez.

## Production görsel matrisi — bu belgenin parçası

Yayın hedefleri **https://www.tariklab.com** ve **https://tariklab.tayaz29.workers.dev**. İki host için SHA/build/yönlendirme sonrası URL/HTTP-içerik türü/görünür içerik/screenshot/DOM kanıtı ayrı tutulur. Bu hazırlıkta iki host da test edilmedi.

Her yüzey her aktif rota için, **iki host × TR/EN/PL × 1440×900 / 390×844 / 320 px** olarak ayrılaştırılır. 320 px yüksekliği ve DPR kaydedilir. Tek screenshot başka host/dil/cihaz hücresini kapatmaz.

| Yüzey | Gelecekteki durum matrisi | Durum |
| --- | --- | --- |
| Portal/kategori | İlk açılış, görünür içerik, loader/error, kart/liste/filtre veya boş durum varsa, doğru oyun geçişi, back/refresh | LATER |
| Her oyun | Onboarding, ilk karar, bedel/sonuç, feedback, kazanma/kaybetme, çıkış, save/reload, hata | LATER |
| Atlas/harita | Seçim/katman, varsa pan/zoom, bilgi paneli/overlay, resize/ekran geçişi, SVG/DOM fallback ve context loss; gerçek karar yüzeyi | LATER |
| Kaynaklar/anatomi foundation | Kaynak/review kaydı, eğitim notu, draft/unpublished sınırı, okunabilirlik ve klavye erişimi | LATER |

Her kombinasyonda: screenshot + DOM ile taşma/kırpılma/örtüşme ölçümü; sticky/overlay/z-index ve mobil üst-alt chrome; tıklama/dokunma hedefleri; klavye/focus/trap/restore; kontrast/tipografi/non-color bilgi; reduced motion; varsa dark/light temalarının ikisi; TR/EN/PL body; console/404/modül/hydration; deep link/back/refresh; offline/SW/legacy save eşliği aranır. Donanım Pixi ile yazılımsal GL/Canvas ve SVG/DOM kanıtları ayrı etiketlenir.

Tek kanıt kaydının zorunlu alanları: **kimlik; A–G alanı; ürün/rota; host/son URL; gerçek commit SHA ve deploy/build kimliği; UTC tarih; cihaz/OS/browser/renderer; viewport/DPR/dil/reduced motion; başlangıç state'i ve adımlar; beklenen/gerçek sonuç; screenshot/DOM/console-ağ-ölçüm dosyaları; baseline/adayı kapsayan aynı koşullu ölçüm; owner; şiddet gerekçesi; dar fix PR'ı; yeniden doğrulama; gerekiyorsa insan inceleme kaydı**. Bu kayıtlar henüz açılmadı.

## Anatomi için bağlayıcı yayın kuralları

“Tam anatomi sistemleri daha sonra ayrı içerik dalgalarında eklenecek.”

“Anatomik doğruluk için kaynak ve uzman inceleme kaydı olmadan tam/klinik kesin iddiası koymayacağız.”

Her **sistem, etiket ve açıklama** ayrı kimlikle izlenir: kaynak künyesi/bağlantısı, baskı/sürüm, **kaynak tarihi**, erişim tarihi, **owner** ve **review status** zorunludur. Kaynağın desteklediği içerik ve sınırları kaydedilir. Bağımsız uzman kaydı isim/yetkinlik/bağımsızlık, incelenen sürüm/kapsam, tarih ve karar içerir. İncelenmemiş içerik **draft veya unpublished** kalır. Henüz içerik veya uzman kaydı doldurulmadı.

İlk kullanımda ve Kaynaklar yüzeyinde sakin, okunabilir, klavyeyle erişilebilir notun gelecekte doğrulanması gerekir: **“Bu içerik eğitim amaçlıdır; tıbbi tavsiye, tanı veya tedavi sunmaz.”** TR/EN/PL anlamı korunur; işlevleri örten modal veya sürekli alarm kullanılmaz. Notun burada yazılması UI'ya eklendiği anlamına gelmez.

| Gelecekteki anatomi kabulü | Somut kanıt | Durum |
| --- | --- | --- |
| UI/yayın | Draft/unpublished içerik görünmezliği; ilk kullanım/Kaynaklar notu; kaynak erişimi ve focus | LATER |
| Schema | Kimlik/kaynak tarihi-sürümü/owner/review status alanları; eksik/geçersiz içerik için publish kapısı | LATER |
| Offline/save | Yayınlanan kaynak/uyarı/review verisinin offline erişimi; SW upgrade ve eski save migration/rollback/bozuk kayıt; draft/eski içerik sızıntısı veya veri kaybı olmaması | LATER |
| Teknik release | Schema testleri, gerçek browser UI/offline/save kanıtı ve iki host SHA eşleşmesi | LATER |
| Bilimsel içerik | Kaynaklı sürüme bağlı bağımsız uzman kararı; model/CI insan kapısını kapatmaz | insan-inceleme-gerekli |

## Uygulama ve kapanış disiplini

- Başlama kapıları kapanınca tek sınırlı inceleme/fix parçası ele alınır. En geç **60–75 dakika aktif çalışmada** veya anlamlı aşamada branch/SHA/değişen dosya/test/açık risk/sonraki adım checkpoint'i bırakılır.
- Önce kanıtlı dar **P0/P1**: kritik güvenlik/veri kaybı/genel kullanılamama veya ana akış/save/erişim engeli. Önce repro, sonra ilgili regresyon testi, ayrı dar PR ve tekrar doğrulama. P2 yalnız somut kullanıcı değeri varsa ele alınır; redesign/yeni özellik ayrı backlog, öncelik kapsam açmak için yükseltilmez.
- Astra release dahil tam sahipliktedir. Başka ajana zorunlu devir yoktur. Kırmızı CI için yalnız ilgili repro/fix/checkpoint yapılır; CI/deploy polling, uzun sleep veya bekleme döngüsü kurulmaz. Kırmızı/pending zorunlu kontrollerle merge olmaz.
- İnceleme başlayınca birleşik hedef SHA, kesin rota listesi, koşul kapanış kanıtı, sorumlu ve başlangıç zamanı kaydedilir. PASS yalnız ilgili yerel/CI/iki-host gerçek browser ve gerekiyorsa insan kanıtlarıyla verilir. Anatomi A için ayrı #110/#111 başlangıç kaydı tutulur.

### 2026-10-05 — güncel release checkpoint

#110 head `fea0d0c`: 8/8 check + Vercel status SUCCESS; #111 head `9c47c0d`: 9/9 + Vercel SUCCESS.
Normal korumalı #110 merge SHA **`562831dba3b16be2a0bc8b2aec2e613eb1b80f45`**. Production henüz kapatılmadı.
#111 onaylanan ağacı değişmeden bu main'e 12 commit rebase edildi; yeni head **`2011a59aeced3600d46363bb6c24708673e49052`**, base main.
Ağaç `5b2a64a013ba032b744be255d13b51f0bff9e0db` eski yeşil head ile eş; yeni CI ve #110 iki-host kanıtı yine zorunlu.
DARBE talimat güncellemesi yalnız ayrı proof branch'ine alındı; 300 uygulama onayı ve DRB P1 birbirinden bağımsız.

### 2026-10-05 00:33 UTC — yeni kanıt, review hâlâ başlamadı

- #110 main run `37246439763`: core/campaign SUCCESS; browser-regression ve aggregate build FAIL. Timeout değil: Workers HANEDANIAN1440 save sonrası reload `net::ERR_FAILED`, `scripts/wave1-outcome-browser.mjs:82`, artifact `11319313487`.
- Çete production www/workers 17/17 ve Wave1 www 9/9 PASS. Workers Wave1 hiçbir tam senaryoyu kapatmadı; ardından duel production SKIPPED. #109'un iki-host Çete kanıtı var; genel release/final360 PASS sonucu çıkarılmaz.
- Workers `index.html` HEAD yanıtı gerçek307, Location oyun kökü; cache'de redirected HTML adayı kontrollü yerel fixture ile araştırılacak. Cloud Browser reload hata protokolüne yönelince URL politikası reddetti; o tarayıcıda tekrar/alternatif protokol denemesi yok. Mevcut www kampanya oturumu eski tam paketini koruyor; kaynak SW tasarımı yükseltmeyi açık oyun istemcileri kapanana dek bekletiyor, tek başına yeni regresyon diye sınıflandırılmadı.
- #111 `2011a59` build+route SUCCESS, campaign pending; release blocker varken merge yok. #110'un önceki yeşil PR CI'si bu yeni production arızasını kapatmaz.
- DARBE güncellenmiş talimat için ayrı taslak #112 `f541bcf`: 10 özgün sahne, 25.758 B; 651 ürün dosyası korunur. Hedefli6/6 browser CI SUCCESS (`37247459967`, artifact `11319492846`), tüm genel CI sonucu henüz yok. Üretim düello/save/offline testlerinin yerine geçmez; 300 kart uygulaması kullanıcı stil onayı bekler.
- DRB-237–240 ayrı P1 doğrulama kaydı değişmedi. Kanıt JSON'u: `docs/evidence/2026-10-05-darbe-proof-release.json`.
