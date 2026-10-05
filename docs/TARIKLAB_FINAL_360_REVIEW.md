# TarikLab — final 360° inceleme intake'i ve yayın kapıları

Tarih: **2026-10-05 (Türkiye)**. Sahip: **Astra — inceleme, dar düzeltme ve release kapanışının tamamı**. Bu belge final 360° için gelecekteki kabul checklist'idir; final inceleme başlamadı. Anatomi A kaynak/rota keşfi tamamlandı; foundation uygulaması başlamadı. Ayrı release/repro kanıtları aşağıdaki tarihli checkpoint'lerde belirtilir. Yeni kaynak planı/özellik de bu hazırlıkta denetlenmez.

Dokümantasyon branch'i: `astra/release-evidence-a1-a2-d5`; yayın kanıtı tabanı `a534289490f502f68e12d91803fbc3883de7d790`. Önceki `astra/review-release-gates` checkpoint'leri tarihsel olarak korunur. Bu SHA bütün ürünlerin final incelemesinden geçmiş sayılmaz; aşağıdaki kapsamlı envanter review'ün başladığı veya geçtiği anlamına gelmez.


## Nihai tek kaynak sözleşme — 2026-10-05 01:56 UTC

Bu bölüm önceki çelişen kapsam, stil ve onay notlarının üstündedir. Kullanıcının tekrar onayı gerekmez. Her oyunda 300, üç oyunda toplam 900 kart zorunludur; örnek veya pilot DONE değildir. **B7: AI plaka ve fotogerçekçi dış asset yok; özgün prosedürel SVG, vektör veya katmanlı render kullanılacak.** Önceki raster talimatıyla üretilen denemeler git dışında **SUPERSEDED** olarak işaretlendi; production'a eklenmedi ve yeni işte kullanılmayacak. Kabul edilmiş yeni prosedürel production kartı **0/900**. Mevcut prototip metadata'sı ve UI'sı tek başına kabul edilmiş kart sanatı değildir. Reddedilmiş #112 geometrik proof yayılmayacak. Kurmaca yetişkin görsellerde doğru anatomi, ışık, perspektif, materyal ve anlamsal sahne çeşitliliği kalite kapısıdır; yüz, oda veya poz yalnız renk değiştirilerek çoğaltılamaz.

**Güncel checkpoint — 2026-10-05 04:00 UTC:** A1/A2/A3 **CLOSED**. #113 merge `375b837`, #111 merge `a534289`; exact-head CI ve sıralı normal merge tamam. A2 main CI `37258787799` SUCCESS; iki hostta Wave1 13'er, Çete 17'şer production vaka; özel HAN run `37258787888` 6/6 gerçek reload/save vakası. D5 #114 exact-head 8/8 checks + Vercel SUCCESS sonrası `0383d24dce3e45fc1db16773da8b3a135bf51b6e` olarak merge edildi; bu SHA'nın main CI/production run `37260245958` **SUCCESS**. İki hostta Wave1 13'er / Çete 17'şer, VETO/GETT eski-save/arşiv ve24 deterministik UI vaka PASS. B sanat kabulü 0/900; 300×3 semantik taslak hazır. Önceki pending/açık kayıtlar tarihsel kanıttır; aşağıdaki güncel tablo ve son kanıt eki önceliklidir.

| Madde | Durum / kapsam | Owner / PR | Somut kapanış kapısı |
| --- | --- | --- | --- |
| A1 | CLOSED — #113 merge `375b837`; main CI `37256148777` SUCCESS; iki-host production `37256148798` 6/6 PASS | Astra / #113 merged | www + Workers ×1440/390/320 gerçek iki reload/save, exact SW/19 dosya ve temiz hata/overflow assertion'ları; tam eski-cache kohortu D3'te açık |
| A2 | CLOSED — #111 `a534289`; exact head `eb5913d` 10/10 checks+Vercel SUCCESS; main CI `37258787799` SUCCESS | Astra / #111 merged | Wave1 iki hostta13/13; özel HAN6/6 reload/save; artifact/hash/screenshot ayrımı aşağıda. Racon capture açığı C3'te korunur |
| A3 | CLOSED — dar HAN düzeltmesi aynı A1 merge/iki-host kanıtıyla kapandı; main full CI SUCCESS | Astra / #113 merged | Kapanış yalnız repro edilen reload kapsamıdır; genel lifecycle/offline upgrade ve fiziksel GPU kabulü değildir |
| B1 | DEVAM — 900 kart / 12 pilot ID doğrulandı; 60 çekirdek dosya için hash koruması hazır; gameplay değişmedi | Astra / ayrı oyun PR'ları henüz yok | Kart verisi, motor, save, i18n, a11y, ölçü ve etkileşim semantiği değişmez |
| B2 | OPEN — frame ve ana illüstrasyon yenilemesi tamam değil | Astra / ayrı VETO, GETT, DARBE PR'ları | Aktif eski ilkel veya belirsiz asset kalıntısı yok; referans, build ve offline kontrolleri |
| B3 | DEVAM — kullanıcının üç referansı yalnız kalite yönü için | Astra | Kompozisyon, kişi, yazı veya logo türetme ve kopyalama yok |
| B4 | OPEN — VETO'nun 300 kartı tamam değil | Astra / PR henüz yok | Aydınlık kurmaca seçim/bürokrasi; krem, yeşil, ahşap ve sınırlı kırmızı |
| B5 | OPEN — GETT'nin 300 kartı tamam değil | Astra / PR henüz yok | Sıcak kurmaca mahalle; doğal insan ve mekân çeşitliliği |
| B6 | OPEN — DARBE'nin 300 kartı tamam değil; #112 yeni üretim kanıtı değil | Astra / PR henüz yok | Sivil bürokratik noir; özgün lacivert, füme ve mat altın; askerî, parti veya şiddet dili yok |
| B7 | BLOKE KALİTE — üretilmiş raster denemeler git dışında SUPERSEDED; kabul edilmiş yeni prosedürel production kartı 0/900 | Astra | Özgün kod ve katmanlı render; farklı yetişkin yüzleri, bedenleri ve pozları; anatomi, perspektif ve ışık doğrulaması. Metadata/UI prototipi sanat kabulü sayılmaz |
| B8 | DEVAM — mevcut kart metni korunur | Astra | Sanata slogan, motto, flavour text, tabela veya rastgele UI metni gömülmez |
| B9 | OPEN — üç frame üretime girmedi | Astra | Bağımsız kimlik; 320/390'da isim, yıldız, görsel ve ATK/DEF okunur; ölçü ve UI davranışı sabit |
| B10 | OPEN — oyun başına 300/300 manifest, bütçe, offline ve düello kabulünün hiçbiri kapanmadı | Astra / her oyun için ayrı PR | ID/asset/provenance ve kalıntı kontrolü; üç genişlikte browser; klavye, reduced motion, ekran okuyucu, save ve 24 düello testi |
| B11 | P1 İDDİASI AÇIK — motor21/21 ve #118 gerçek UI12/12 fixture PASS; NOT_REPRODUCED_IN_VALID_UI_FIXTURES; doğal maç/AI/etkilenen kullanıcı kaydı doğrulanmadı | Astra / ayrı kural PR'ı yok | UI/özgül save repro'su; motor karşı kanıtı kullanıcı kaydını veya browser kapısını kapatmaz; sanat PR'ından ayrı |
| C1 | OPEN/KISMİ — Çete/Wave 1 kanıtı ve #117 TC job-start merge539df6e; TC iki-host kanıtı pending; 12 oyun tamam değil | Astra / mevcut #109/#110; diğer PR'lar yok | Oyuna özgü gerçek state sonucu; sessiz, kısa, atlanabilir, erişilebilir ve anlamlı sahne |
| C2 | OPEN — kalan oyunların sinematik/gerçekçi görsel kalite kapısı açık | Astra | Oyun dünyasına özgü doğru ışık, katman ve malzeme; çocuk estetiği, ikon kolajı veya renk değiştirerek kopyalama yok |
| C3 | LATER/KISMİ — #111 çalışması tüm yüzeyler için uygulanabilirlik kararı yerine geçmez | Astra / #111 | Yedi yüzeyde fallback, context loss, resize, pan/zoom, üç genişlik, offline ve save; Racon/TC SIM/JITEM için kanıtlı DONE/P1/N-A |
| D1 | OPEN — bu checkpoint tüm ürünlerin sessizlik taraması değildir | Astra | Tüm oyunlarda audio, music, speech, vibrate ve autoplay: 0 |
| D2 | LATER + İNSAN | Astra; PL ana dil inceleyicisi atanmadı | TR/EN/PL gövde ve UI metni, encoding ve taşma; PL için bağımsız dil kalitesi incelemesi |
| D3 | OPEN — tüm offline rotalar ve upgrade matrisi açık | Astra | SW/cache sürümleri, yeni asset'ler, eski save/migration, bozuk kayıt ve online dönüş |
| D4 | OPEN — tüm asset, repo ve git ağırlığı denetimi açık | Astra / #111 kısmi ölçüm | Rota başına byte/istek/FMP/lazy ölçümü, portal asset izolasyonu ve ölçülmüş tablo; referans taraması olmadan silme yok |
| D5 | KISMİ — brace-expansion CLOSED: #114 merge `0383d24`;14/14 yerel, exact-head8/8+Vercel ve main `37260245958` SUCCESS; iki-host production geçti | Astra / #114 merged | Bağımlılık bulgusu kapandı; genel CSP/provenance/statik-path denetimi açık. `npm audit` NOT RUN: otomatik onay incelemesi metadata dışa aktarımını reddetti; alternatif yoldan denenmedi |
| D6 | LATER/KORUNDU — Novella, #78/#79 ve eski dallar açılmadı | Astra | Yetkisiz yeniden açma veya merge yok; SON KÖY WIP açıkça DEFERRED |
| E1 | OPEN — A keşfi tamam; foundation uygulaması/PR yok | Astra | Ayrı offline ürün; özgün klinik 2.5D yetişkin varyantları, iskelet ve büyük organlar; dış fotoğraf, model veya CDN yok |
| E2 | OPEN — kaynak/review şeması keşifte; uygulama yok | Astra + bağımsız uzman | Eğitim amaçlı/tıbbi tavsiye değildir notu; kaynak URL'si, tarih ve review durumu; uzman olmadan tam/klinik kesinlik iddiası yok; ek sistemler LATER |
| E3 | İNSAN/DONANIM-GEREKLİ | Atanacak anatomi uzmanı ve fiziksel GPU testçisi; koordinasyon Astra | Gerçek insan ve donanım inceleme kaydı; model veya SwiftShader bu kapıyı kapatmaz |
| F | LATER/BAŞLAMADI — bu belge intake/checkpoint | Astra | Son merge/deploy sonrasında bütün rota × viewport × dil için A–G; gerçek kanıt, SHA ve PR; dar P0/P1 düzeltmeleri |

PR belirtilmeyen açık maddelerde henüz uygulama PR'ı yok; sahibi Astra. Zorunlu bitmemiş işler OPEN; yalnız açıkça ertelenen Novella/ek anatomi sistemleri/korunan SON KÖY WIP LATER veya DEFERRED. Tarihsel LATER satırları tamamlanmış iş değildir.

Her PR sırası: yerel gate → CI → merge → iki hostta gerçek production doğrulaması → status. A1–A3 kanıtı kapandı; her yeni kart/ürün PR'ı kendi güncel CI/production kapıları kapanmadan yayımlanmış sayılmaz. En geç 60–75 dakikada anlamlı checkpoint bırakılır; beklerken yalnız bağımsız işler yapılır, boş polling yok. Bütün maddeleri kapsayan nihai kapanış henüz yapılmadı.

> Aşağıdaki tarihsel checkpoint kayıtları kendi tarihlerindeki durumu gösterir; güncel madde tablosu ve son merge/production eki önceliklidir. Eski onay bekleme notları yürürlükte değildir.

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

## 2026-10-05 06:24 UTC — bounded checkpoint, final review still NOT STARTED

A1–A3 remain closed. #116 proof-only fix merged `9e50404c0573e1cf9e2dd7e623c9c8bd98b95e56` after exact-head8/8+Vercel; its main37270312084 and both deploy checks SUCCESS. www+Workers each passed24 duel UI scenarios, VETO/GETT300-card archives/unchanged legacy saves, actual origins and11 asset hashes;8 production screenshots opened after verifying artifact11328870080 SHA256 `083ea42076c3048004c9b906f7bb6db6a264831dec2f679793c0f0978c4dad19`. **This closes only the B10 evidence defect; B10 full-art acceptance remains OPEN.**

B1–B9 remain0/900 accepted. Original CPU SND-011 render `fc0c7e1` was rejected for rigid geometry/material artifacts; no new assets published. B11 preparation `f18ff4d` has10 passing Node tests and requires12 actual browser cases, but browser NOT_RUN; prior engine counterproof does not close the reported P1. C1 TC candidate `0de03d8` has22 targeted tests and36 unchanged protected files; People/Finance mobile result visibility is a source-supported review finding being fixed, with no browser/CI/release acceptance. C2/C3 and D1–D4/general D5 remain open; only brace-expansion is closed. DEVLET's six synthetic runtime cases did not reproduce data loss; default backup recovery is not implemented and no real-browser/archived-save acceptance is claimed.

D6 remains preserved. E foundation NOT IMPLEMENTED; factual-source drafts do not satisfy independent expert review. Physical GPU, PL native quality and anatomy expert gates remain human requirements. F has not begun. Detailed evidence and preparation-branch SHAs: [checkpoint JSON](evidence/2026-10-05-b10-readiness-checkpoint.json). Older pending statements below are historical; this block takes precedence only for its explicitly measured scope.

## Durum sözleşmesi

| Durum | Anlam |
| --- | --- |
| PASS | İlgili gerçek SHA'ya bağlı tamamlanmış sınırlı kanıt. A1–A3 release kanıtları vardır; final360 rota matrisi henüz incelenmedi |
| P1 | Öncelikli kayıt; repro/doğrulama durumu ayrıca açıklanır. DRB-237–240 geçerli motor fixture'larında doğrulanmadı; özgül eski-save/browser incelemesi açık |
| LATER | Bu belgedeki bütün teknik satırlar için **önkoşul bekliyor / NOT REVIEWED**; açıkça ertelenen işlerde ayrıca gerekçe belirtilir |
| insan-inceleme-gerekli | İsim/tarih/kapsam/karar kaydı gereken insan kapısı; model veya CI ile kapatılamaz |

Genel durum **LATER — önkoşul bekliyor / NOT REVIEWED**. Kanıt toplanmadığı için boş alanları başarı varsayımıyla doldurmak yasaktır.

## Ayrı başlangıç kapıları

- **Anatomi A keşfi:** A1/A2 kapanışı sonrasında tamamlandı; [kaynak/rota handoff](ANATOMY_FOUNDATION_DISCOVERY.md). Foundation, uzman incelemesi ve release kabulü değildir.
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
| 1 — Üç kart oyunu / B1–B11 | Son sözleşme üstündür: VETO-H!, GETT-OH!, DARBE-H! her biri300 kart; frame ve ana illüstrasyon yeniden tasarlanır, mevcut oyun verisi/motor/save/i18n/a11y/ölçü ve davranış korunur. Kullanıcıdan yeni stil onayı beklenmez. B7 özgün prosedürel/vektör/katmanlı render kalitesi zorunlu; AI plaka ve dış asset yok. #112 eski geometrik proof yayılmaz. DARBE237–240 ayrı P1 kaydıdır. | AÇIK — accepted art0/900 |
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
| 1a — DRB-237–240 | Kullanıcının **tetiklenmeme P1 kaydı**; 21/21 gerçek motor fixture'ında NOT REPRODUCED. Browser/özgül eski-save state/önkoşul/eylem/beklenen-gerçek tetik doğrulaması açık. Doğrulanırsa güçlü regresyon testli **ayrı dar kural fix PR'ı** gerekir; görsel Wave 4 PR'ında çözülmez | **P1 — doğrulama bekliyor / NOT REVIEWED** |

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
| UI/yayın | `unpublished` üretimde görünmez; `educational-draft` açık taslak etiketi taşır ve uzman onaylı/tam/klinik kesin diye sunulmaz; ilk kullanım/Kaynaklar notu, kaynak erişimi ve focus | LATER |
| Schema | Kimlik/kaynak tarihi-sürümü/owner/review status alanları; eksik/geçersiz içerik için publish kapısı | LATER |
| Offline/save | Yayınlanan kaynak/uyarı/review verisinin offline erişimi; SW upgrade ve eski save migration/rollback/bozuk kayıt; unpublished/eski içerik sızıntısı veya veri kaybı olmaması | LATER |
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

### 2026-10-05 00:52 UTC — açık blocker ve ikinci fixture sonucu

- #111 head `2011a59aeced3600d46363bb6c24708673e49052`: **9/9 check + Vercel SUCCESS**. Merge yapılmadı; #110 Workers production arızası açık.
- Ayrı taslak [#113](https://github.com/tayaz-maker/tariklab/pull/113), `2a59e4de1033084c5d06015208d132ac56db6ab0`: yalnız redirected HTML cache yanıtını normalize eden aday, unit17/17/lint/typecheck/build PASS. Production kök nedeninin ve bu adayın browser kabulünün kapandığı iddia edilmez.
- İkinci hedefli run `37248756789`, job `111571847240`, artifact `11320051287` **FAIL**: 30s baseline scoped-worker activation beklemesi. Fixed vaka ve gerçek reload assertion çalışmadı. Root SW `activated`, HAN SW `installing`, yalnız `cete-offline-v5` cache; HAN package yok. İlk index.html307→200/style/app yanıtları tamamlanmış; kalan HAN pre-cache istekleri görünmüyor. Worker error kaydı boş. Statik fixture'da root `/` ve `/cete-savaslari`404, fakat bunun HAN kurulumunu kilitlediği kanıtlanmış değil.
- Kullanıcının iki başarısız deneme kuralı uygulandı: üçüncü tahmini patch/retry yapılmaz. Sonraki dar ölçüm seçenekleri: gerçek yerel preview/SSR ile fixture404 sapmasını kontrollü karşılaştırmak veya portal shell bağımsız minimal worker fixture'ında per-asset fetch/body tamamlanmasını ölçmek; sonra aynı HTTP307 koşulunda baseline/fixed/save/offline karşılaştırması. Server finish browser gövdesi tüketildi anlamına gelmez; HTTP header kaydı bu artifact'ta boş. Timeout/assertion/kapsam gevşetilmez.
- #112 DARBE10 stil örneği ve 6/6 browser kanıtı kullanıcıya sunulur; 300 kart uygulaması için açık stil onayı gerekir. Genel campaign CI henüz pending, merge yok. Ürün düello/legacy-save/cold-offline kabulü gelecekte ayrıca gerekir.
- Final360 hâlâ başlamadı. Fiziksel GPU, PL ana dil, anatomi uzmanı, eski cache/migration matrisi ve DRB237–240 kural repro kapıları açık. Kanıt: `docs/evidence/2026-10-05-darbe-proof-release.json`.

### 2026-10-05 01:54 UTC — kullanıcı kapsam güncellemesi / açık sahiplik

Kart görsel yönü artık kullanıcı ekindeki gerçekçi sinematik referanslardır; reddedilmiş geometrik #112 örnekleri300 karta çoğaltılmaz. Üç oyun için300'er kart kapsam yetkisi vardır; önce12 temsil kartında kalite kanıtı, sonra oyun-özel çakışmayan PR'lar. Kart adı/ID/sayı/kural/denge/shared engine/save/i18n/a11y/ölçü/etkileşim korunur. Görsel içine motto/ek metin/logo/gerçek kişi konmaz. #112 mevcut taslağı production kabulü veya yeni gerçekçi pilot kanıtı değildir.

| Açık iş | Owner | PR / durum | Kapanış kanıtı |
| --- | --- | --- | --- |
| #110 Workers HAN reload | Astra | #113 aday; browser repro FAIL, kullanıcı önceliği P0 | Aynı baseline/fixed browser repro; CI green; iki hostta gerçek reload/save/console |
| Statik harita cache yayını | Astra | #111 green head2011a59; merge BLOCKED | Yukarıdaki blocker kapanışı; güncel main rebase/CI; iki-host smoke |
| VETO-H300 gerçekçi kart görseli | Astra | Ayrı oyun PR'ı henüz açılmadı;12pilotun4 kartı hazırlanıyor | Anlamsal ID/asset/provenance, immutable veri,320/390/1440,save/duel/offline,bütçe |
| GETT-OH300 gerçekçi kart görseli | Astra | Ayrı oyun PR'ı henüz açılmadı;12pilotun4 kartı hazırlanıyor | Aynı kapılar; prebuild art-pack geri yazma zinciri dahil |
| DARBE-H300 gerçekçi kart görseli | Astra | #112 eski geometrik proof; yeni ayrı uygulama PR'ı henüz yok | Aynı kapılar; aktif card-art ve eski whole-card asset ayrımı |
| Wave2–4 outcome/kalıcı görsel işleri | Astra | LATER / tamam değil; yeni uygulama PR'ı yok | Oyun-özel gerçek karar sonucu, sessizlik/a11y/browser ve iki-host |
| Wave2–4 dışında kalan oyunların visual/outcome kapsamı | Astra | LATER / tamam değil; kapsam envanteri ve PR eşlemesi yapılacak | Her rota için gerçek değişiklik ve kanıt; dalga adıyla toplu DONE yok |
| Anatomi Atlas foundation | Astra; bağımsız uzman içerik kapısı | LATER / BAŞLAMADI; PR yok | Ayrı offline ürün; eğitim notu,kaynak/tarih/owner/review; tam/klinik kesinlik iddiası yok |
| Final360 review | Astra | LATER / BAŞLAMADI; bu dosya intake/backlog | Önkoşullar sonrası rota×viewport×dil A–G kanıtı; P0/P1 dar fix'ler |
| DRB-237–240 tetik sorunu | Astra | P1 — repro bekliyor; ayrı kural PR'ı yok | Önkoşullu gerçek test, güçlü regresyon; kart sanat PR'ında çözülmez |
| Racon / TC SIM / JITEM karar haritası uygulanabilirliği | Astra | LATER — karar ve testler kapanmadı | Güncel gerçek karar yüzeyi, renderer/fallback/perf/save/offline; peşinen dekor/N-A yok |
| SW/offline/eski save upgrade | Astra | LATER; yalnız kapsamlı matrisle kapanır | Her offline rota, yeni/eski cache ve save, rollback/reconnect/bozuk kayıt |
| Asset transfer / repo ve git ağırlığı | Astra | LATER; #111 ölçümü global audit yerine geçmez | Route bytes/requests, lazy, kullanılmayan/tekrar asset; referans+route+build ile dar temizlik |
| brace-expansion dev/high | Astra | Açık — güncel sürüm/erişilebilirlik yeniden doğrulanmadı; ayrı security PR yok | Advisory/bağımlılık zinciri, güvenli pin/test/NOTICE veya somut mitigasyon |
| PL ana dil kalite incelemesi | Atanacak PL ana dil inceleyici; koordinasyon Astra | İNSAN-İNCELEME-GEREKLİ / yapılmadı | Sürüme bağlı yazılı insan inceleme kaydı; model/CI kapatmaz |
| Bağımsız anatomi uzmanı | Atanacak bağımsız anatomi uzmanı; koordinasyon Astra | İNSAN-İNCELEME-GEREKLİ / yapılmadı | Etiket/sistem/açıklama ve sürüme bağlı uzman kararı; release gate |
| Fiziksel GPU/Pixi | Atanacak fiziksel GPU testçisi; koordinasyon Astra | İNSAN/DONANIM-DOĞRULAMASI-GEREKLİ / yapılmadı | GerçekGPU/browser/context-loss/resize kanıtı; SwiftShader buna eşit değil |
| SON KÖY korunmuş WIP | Astra | DEFERRED — ayrı dal korunur, mevcut dalgaya alınmadı | Önce kapsam sınıflandırma; alınırsa ayrı PR |
| Novella / kapalı#78–79 | Astra | LATER / kapalı kalır | Yeniden açma/merge yok; kapanış gerekçeleri korunur |

Yayın sırası bağlayıcı: #110 hotfix → iki-host gerçek production kanıtı → #111 güncelmain green/merge/production. Kart dalları/CI bağımsız ilerleyebilir; bu blocker kapanmadan kartlar production'a alınmaz. Hiçbir yukarıdaki açık satır DONE sayılmaz.

2026-10-05 01:52 UTC son kullanıcı kararı: kalan kapsam için tekrar kullanıcı/stil onayı istenmez; iç kalite kapıları, ayrı PR'lar ve yeşil CI/iki-host yayın sırası geçerlidir. Önceki onay-bekleme kayıtları tarihsel kalır ve bu kararla geçersizdir. HAN reload operasyonel P0 önceliğidir. Bütün kalan görseller yetişkin, sinematik/gerçekçi, özgün ve bütçeli olacaktır. Anatomi bundan farklı olarak özgün bilimsel2.5D klinik diyagramdır; fotogerçekçi dış beden/indirilen3D yok, kaynak+bağımsız uzman kapısı bu yetkiyle kaldırılmaz.


### A1/A3 doğrulanmış tarayıcı sonucu — 2026-10-05 02:14 UTC

PR #113 `cac09e1`, run [37254296791](https://github.com/tayaz-maker/tariklab/actions/runs/37254296791), ikinci job `111588570839` **SUCCESS**. İlk job yalnız preview'ın eski SW SHA'sını servis etmesi nedeniyle kırmızıydı; Workers build tamamlandıktan sonra yalnız başarısız job yeniden koştu. CI assertion veya timeout değiştirilmedi.

- Yerel gerçek Chromium: küçültülmüş eski baseline'da `net::ERR_FAILED`; adayda tam 19 dosya, online/offline reload ve gerçek farm queue/seed korunması PASS. Tam eski paket kurulumunun geçtiği iddia edilmez.
- Workers **preview**, Chromium 154.0.8037.57: 1440/390/320, her genişlikte iki gerçek reload; console/page/network/HTTP errors ve horizontal overflow sıfır. Dört snapshot'ta da 19/19 paket; worker SHA256 `8f44b24062a076d29b4d771f940f31f713d4685f8a1c1fd33ef43bfaa2811d39`.
- Preview kanıtı artifact `11321769395`, SHA256 `9957891f8d8741ad00b1b62d9a9cffae178392aabddd50b2f3be59e0b7c7439c`; 12 screenshot, üç trace ve results.json. Bu production veya fiziksel GPU kanıtı değildir.
- Vercel preview resmi bağlı fetch aracı erişimi reddetti; koruma ayarı değiştirilmedi ve yetki engeli aşılmadı. Genel CI sürüyor; normal merge sonrası www + Workers public production smoke zorunlu. A1/A3 production kapanışı ve A2 hâlâ BLOCKED.

### D5 yeniden doğrulama — 2026-10-05, kaynak snapshot 562831d

Salt okunur lockfile + resmi advisory doğrulaması; güncelleme/kurulum/genel audit henüz yapılmadı. Owner Astra; ayrı dar security PR **LATER**, açık dev/high bulgusu **DONE değil**.

| Geliştirme bağımlılığı zinciri | Kilit | Önerilen aynı-major hedef |
| --- | --- | --- |
| eslint 9.39.5 → minimatch 3.1.5 (^1.1.7) | brace-expansion 1.1.18, dev:true | 1.1.21 |
| typescript-eslint 8.67.0 → typescript-estree 8.67.0 → minimatch 10.2.6 (^5.0.8) | brace-expansion 5.0.9, dev:true | 5.0.12 |

Resmi kaynaklar, 2026-10-05 kontrolü: [GHSA-6j4f-fj2g-mc7p](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p) High parse recursion (1.1.19/5.0.10); [GHSA-qhr7-859c-m2p7](https://github.com/advisories/GHSA-qhr7-859c-m2p7) High nested recursion (1.1.20/5.0.11); [GHSA-q2hr-2g5m-vwhr](https://github.com/juliangruber/brace-expansion/security/advisories/GHSA-q2hr-2g5m-vwhr) Moderate quadratic CPU DoS (1.1.21/5.0.12). Bunlar farklı advisory'lerdir. Önceki GHSA-rgw5-rvv9-x895 mevcut kilitlerde zaten düzeltilmiştir; eski kapanış kaydı GHSA kimliği içermediğinden tarihsel bulgunun birebir aynısı olduğu söylenmez. Güncel iki düğüm de yeni aralıklardan etkilenir. Dar çözüm aynı-major lock refresh + lint/test/build/NOTICE kanıtıdır; global 5.x override uygun değildir. Production saldırılabilirliği veya genel güvenlik PASS sonucu çıkarılmadı.


### B4–B7 bağımsız prosedürel kalite denemesi — 2026-10-05 02:24 UTC

Üç ayrı dalda yalnız birer SVG sahne yerel olarak çizildi ve render edildi. Raster/AI plaka kullanılmadı; public, kart verisi, motor, save ve ölçüler değişmedi. XML, kaynak hash ve dış asset yokluğu teknik kontrolleri görsel kalite kabulünün yerine geçmez. Astra ekranları inceleyip üçünü de **FAIL_REALISM / production'a uygun değil** olarak bıraktı; 300'e çoğaltılmadılar. Bu bir kullanıcı onayı bekleme durumu değildir. Kabul edilen yeni production sanatı **0/900**.

| Madde / dal | Yerel deneme | Ölçüm / gerçek kalite engeli | Durum |
| --- | --- | --- | --- |
| B4/B7 `astra/veto-cinematic-vector-300` | SND-001; taban562831d, commit/push yok | 50.234 B,576×384; yüz/el/kumaş stilize, poz ve bakış sert | FAIL, 0/300 |
| B5/B7 `astra/gett-cinematic-vector-300` | RCN-001; taban562831d, commit/push yok | 73.963 B,400×300; yüz/saç/kumaş vektör illüstrasyon gibi | FAIL, 0/300 |
| B6/B7 `astra/darbe-cinematic-vector-300` | DRB-001; yalnız yerel checkpoint `d6dec0c2e1ea307f7a7b02678046d468b909d622` | 55.181 B; yüz oranları stilize, saç mekanik, el-kâğıt teması ikna edici değil | FAIL, 0/300 |

Aynı başarısız çizim yaklaşımını 900 karta çoğaltmak kabul şartını karşılamaz. Bir sonraki teknik seçenek özgün katmanlı geometri ve malzeme render için ayrı ölçülmüş kalite denemesidir; henüz uygulanmış veya başarılı sayılmaz. B1–B11 kapsamı açık ve owner Astra; eski düşük kaliteli sanatın kaldırılması ancak onay ölçütlerini karşılayan 300'lük oyun paketi ve B10 regresyonlarıyla yapılacak.


### B11 — gerçek motor karşı kanıtı, 2026-10-05

[Kalıcı test kaydı](https://github.com/tayaz-maker/tariklab/blob/a0bc478295a16d0a7120b7d200b0df61dc86af29/outputs/darbe-rule-repro/repro.test.mjs) ile **21/21 PASS**; 43 korunan production dosyası baseline `562831d` ile aynı ve testten sonra değişmedi. DRB-237/238/239/240 doğru sahadaki seri malzemeleriyle gerçek `legalActions`/`dispatch` üzerinden çağrılıp aktive oldu; hedef seçimi sırasında save/reload sonrası rakibin açık DRB-097 desteği sahibinin eline döndü, gerçek KP bedelleri900/1000/1100/1200. Kapalı hedef, eksik KP, eldeki malzeme ve ikinci aktivasyon doğru reddedildi. Sentetik fixture kurulduğu açık; baştan oynanmış maç iddiası yok.

**NOT_REPRODUCED_IN_VALID_ENGINE_FIXTURES**. Bu sonuç kullanıcı P1 bildirimini kapatmaz: browser etkileşimi veya özgül eski save hâlâ incelenmedi. `triggers: []` tek başına hata değildir; bu kartların açıklanan etkileri aktive edilen `costs → select → move` yolunda. Ayrı kural düzeltmesi için önce gerçek başarısız UI/save repro gerekir. Kart sanatından bağımsız; oyun kodu değişmedi. Kaynak test + sonuç JSON'u sürümlenir; dört sentetik fixture komutla yeniden üretilir.

### D5 — dar düzeltme yerel kabulü, 2026-10-05

Ayrı `astra/security-brace-expansion` dalı; yerel HEAD `ace1faef469bbf85557876ee557bda60d57ebe16`, tree `484600e12f490fa0dbc10e64bafc2126a8c8a39f`. İki lock düğümünde yalnız altı alan değişti. Eski kurulum2 normal PASS/12 advisory FAIL (8 stack overflow,4 bounded timeout); yeni1.1.21/5.0.12 kurulum14/14 PASS/3.05s. Build/typecheck/lint PASS;59 mevcut lint uyarısı; IP3/3 ve55 NOTICE girdisi birebir aynı. Henüz PR/push/CI/merge/production yok; D5 tamam sayılmaz.

`npm audit --json --package-lock-only` otomatik onay denetiminde bağımlılık metadata aktarımı nedeniyle reddedildi ve **NOT RUN** olarak kaldı. Yeniden deneme/aşma yapılmadı. Güvenli alternatif doğrulama resmi advisory + gerçek yüklü consumer zinciri + sınırlı yerel RED/GREEN testidir; genel güvenlik temizliği iddiası değildir.


### A1/A3 kapanış — 2026-10-05 02:42 UTC

#113 normal merge **375b83752df3d5e16c960797cf99634af0405d31**, önce9/9 listed check + Vercel SUCCESS. [Production run37256148798](https://github.com/tayaz-maker/tariklab/actions/runs/37256148798), job111593543370: **www + Workers ×1440/390/320 =6/6 PASS**, her vakada iki gerçek reload; gerçek farm kuyruğu/seed/duraklatılmış saat korunur. Exact SW `8f44b24062a076d29b4d771f940f31f713d4685f8a1c1fd33ef43bfaa2811d39`,19/19 dosya; console/page/HTTP/network errors ve overflow0.

Artifact11322886877 (GitHub digest403297e1ce46563c3bb3cfd2110e4b861603fff5943911c20ad9d9d168ec5445)24 screenshot,6 trace,2results içerir.33.774.583B artifact32MiB yerel transfer limitini geçti: üretim screenshotları yerelde incelendi diye yazılmaz; gerçek browser assert/log sonucu doğrulandı. #111'in zaten gerekli freshCI turunda yalnız kanıt paketlemesi host başına bölünecek; testler/assertion/timeoutlar aynen korunur. A1/A3 scope kapandı; genel eski-cache/upgrade matrisi D3 olarak açık. #111 A2 artık rebase/freshCI aşamasında; merge henüz yok.

### C3 / D3 — kaynak envanteri ve açık kanıtlar, 2026-10-05

Kaynak: main `375b83752df3d5e16c960797cf99634af0405d31`. Owner **Astra**; bu envanter için **PR yok**. Aşağıdaki satırlar **LATER — kaynak envanteri / runtime NOT RUN**: mevcut test dosyasının bulunması testin bu turda çalıştığı veya ilgili davranışın geçtiği anlamına gelmez. Önceki tarihli A1/A3 kanıtının kapsamı genişletilmedi; #111'in ayrı kabulü, final **F** incelemesi, PL ana dil, bağımsız anatomi uzmanı ve fiziksel GPU kapıları açık kalır.

#### C3 — yedi karar yüzeyinin uygulanabilirliği

Kaynak yolları aksi belirtilmedikçe `public/games/` altındadır. Her yüzeyde 1440/390/320, ekran geçişi, resize, klavye/focus, reduced motion, offline/save ve mevcut pan/zoom davranışının kanıtı gerekir; olmayan mekânsal özellik sırf checklist için eklenmez. Pixi varlığı tek başına fayda veya kabul kanıtı değildir.

| Yüzey | Mevcut karar bağlantısı ve renderer | Açık kanıt / sınıflandırma |
| --- | --- | --- |
| HANEDANIAN | `hanedanian/app.js → map-factory.js → map.js / map-pixi.js / map-dom.js`; Canvas-first, lazy Pixi arazi + Canvas overlay, DOM/SVG; dünya/bölge/yakın görünüm, pan/pinch/wheel/klavye/minimap | Uygulanabilir. Kaynakta context loss sonrası kamera koruyan Canvas, ResizeObserver ve RAF/texture/listener cleanup yolları var; gerçek GPU ve tam lifecycle matrisi açık. A1 altı production reload vakası ayrı kapsam; iki-deploy eski/yeni-client upgrade kanıtı değil. `hanedanian-map-pixi`, `hanedanian-atlas-scheduler`, `hanedanian-offline`, `hanedanian-save` test kaynakları mevcut. |
| İHTİLÂL | `ihtilal/solo-app.js → basin-map.js`; 7 havza/9 bağ, kapasite ve 1–2 dönem temel gecikme/ek yayılım; aynı modelden SVG/Pixi, sabit ağ seçimi; serbest pan/zoom yok | Uygulanabilir. Kaynakta context loss→SVG, menü/pagehide destroy; `ihtilal-basin-network`, `ihtilal-ui-lifecycle`, `wave1-outcome-browser` testleri var. #111 statik işaret/low-memory/DPR değişikliği bu main kaydında tamam sayılmaz. |
| Racon | `racon/index.html → network.js / map-model.js / map-view.js`; altı sokak 2×3/3×2, gerçek emir/kontrol/güven/baskı/varış; SVG/Pixi, serbest kamera yok | Uygulanabilir ve karar yüzeyi kaynakta uygulanmış. Context loss→SVG, resize/async guard, menü/BFCache cleanup yolları; `racon-map-consequences`, `racon-map-browser`, `wave1-outcome-browser` kaynakları var. Cold/warm offline ve kohort paritesi açık; 390/320 screenshot boşluğu aşağıda P1 doğrulama açığıdır. |
| TC SIM: DEVLET | `tc-sim-devlet/maps.js / maps-pixi.js`; bölge önceliği ve diplomasi bedel/sonuçları; SVG/Pixi | Uygulanabilir; **sözleşme çakışması açık**: `maps.js` gerçek kıyı/sınır referanslı Türkiye geometrisini açıkça tarif ediyor, mevcut görev gerçek harita kullanımını dışlıyor. Bu kaynak olgusu kapanmış uygunluk değildir; karar semantiğini koruyan özgün şema için backlog/ayrı dar kapsam gerekir. `devlet-maps`, `devlet-map-pixi`, `devlet-map-transition-browser` kaynakları var; repaint/lifecycle ve save/offline kabulü açık. |
| TC SIM | `tc-sim/js/decision-network.js`, `weekly-feedback.js` ve `app.js`; DOM LifeMap, gerçek zaman bedeli/taahhüt/ihmal/hafta ve NPC sonuçları; Pixi yok | Karar-ağ/zaman yüzeyi uygulanabilir; atlas için otomatik dekoratif/N-A kararı yok. Kamera/WebGL context loss mevcut DOM renderer'a uygulanmaz. `tc-sim-decision-network`, `tc-sim-weekly-feedback` kaynakları var; save/browser lifecycle/perf ve gerçek akışta eksik karar açıklaması backlog'u açık; P1 için repro gerekir. |
| JITEM: Derin Ağ | Canonical upstream `0c1fc08`: `GameApp → NodeGraph → AtlasSurface → atlas-pixi`; plan önizlemesi→gerçek execute, aynı SVG/Pixi modeli, focus crop/full view; serbest pan yok; `jitem-derin-ag/SOURCE.json` | Uygulanabilir. `scripts/jitem-integration.test.mjs` entegrasyon/provenance kaynağıdır. Devralınan upstream context-loss kanıtında resize/remount canvas kaldırıldıktan sonra yapılmış: aktif Pixi resize/remount döngüsü kanıtlanmış sayılmaz. Vendor paritesi, hidden/redraw/low-memory/offline kohortları açık. |
| Kıyı Eşiği | `esik/app.js → map-model.js / map-pixi.js`; kopuk erişim nedeni ve dönem kararı; ortak modelden SVG/lazy Pixi | Uygulanabilir. `mountCoastPixi.update()` her güncellemede `removeChildren()` + yeni nesneler oluşturuyor; ayrılan nesnelerin destroy'u ve app düzeyinde context-loss/destroy entegrasyonu açık. Async unmount/visibility/düşük bellek kabulü yok; bellek sızıntısı runtime repro'su değil: **P1 doğrulama adayı / lifecycle backlog**. `scripts/esik.test.mjs` ve `pixi-adapter` test kaynakları var. |

`docs/TARIKLAB_PIXIJS_MAP_STATUS.md` içindeki Racon/JITEM **NOT STARTED** satırları mevcut render yollarıyla çelişen tarihsel kayıtlardır; güncel uygulanamazlık kararı olarak kullanılmaz. Bu ekte o belge veya oyun kodu değiştirilmedi.

**Racon P1 doğrulama açığı — capture genişliği:** A2 run `37256926906`, [artifact 11323562016](https://github.com/tayaz-maker/tariklab/actions/runs/37256926906/artifacts/11323562016), ZIP SHA-256 `af785b6b96b63eb500a9e85bd1602089175380c679f08b65b609e7775f8cda6f`. `evidence-a2-eb5913d/wave1/{before,source,built}/racon-390-pixi-map.png` her fazda **730×844**, `racon-320-svg-map.png` **621×844**; label viewport genişliğiyle uyuşmuyor. Root/stage DOM before/outcome kontrolleri 390/320, fakat map-layer değişimi noktasında layout assertion yok. Offscreen `.side` drawer full-page sınırına katkı adayıdır; henüz kullanıcı yatay kaydırma/hit-test kusuru veya kök neden kanıtı değildir. Baseline'da aynı olduğundan #111 regresyonu sayılmaz; bütün aşamalar için sıfır overflow iddiası da çıkarılamaz. Owner Astra, dar viewport/gerçek scroll/hit-test doğrulaması bekliyor, yeni PR yok.

#### D3 — yirmi canlı rota / offline ve save envanteri

Rotalar `src/lib/games.ts` kataloğundan alınmıştır. **Kök-NF**: kök worker altında navigation/modül network-first, yalnız önceden alınmış yanıt offline fallback olabilir; tam oyun precache garantisi değildir. **Kök-SWR**: navigation network-first, oyun JS/CSS/art asset'leri stale-while-revalidate; aynı garanti sınırı geçerlidir. Tablo test adları `scripts/` altındadır; `.test.mjs`/browser dosyaları **bu turda çalıştırılmadı**. Legacy/backup boşluğu “envanterde özel kanıt bulunmadı” demektir, kesin veri kaybı teşhisi değildir.

| # / canlı rota | Offline kapsamı | Save / legacy / bozulma için mevcut kaynak ve açık boşluk |
| --- | --- | --- |
| 1 `/cete-savaslari` | Kök shell + build sırasında eklenen bundle'lar | `src/game/closure.test.ts` slot/bozuk load atomikliği; `cete-outcome-browser.mjs` legacy fixture. Ayrı backup ve eski→yeni deployment kohortu açık. |
| 2 `/oyna/hanedanian` | Kendi scoped worker'ı; content-hash, gövde/MIME doğrulanan atomik paket; Pixi/opsiyonel PL body paket dışında, 2D fallback | `hanedanian-save.test.mjs` corruption/önceki kayıt/future schema/journal/quota; `hanedanian-offline.test.mjs`, `hanedanian-browser.mjs`, `hanedanian-redirect-browser.mjs`. Legacy HAN export'u migration kanıtı değildir; açık eski client + yeni deploy aktivasyonu ayrıca gerekli. |
| 3 `/oyna/racon` | Kök-SWR; `MODULE_GAME_PATHS` içinde Racon prefix'i yok | `racon-final.test.mjs` malformed primary→backup/eski save; `racon-save-validation`, `racon-network` kaynakları. Deployment/cache upgrade browser kanıtı açık. |
| 4 `/oyna/tc-sim` | Kök-NF | `tc-sim-core` roundtrip/primary-backup/eski migration; `tc-sim-hardening`, `tlab-save-slots`, `historical-scenarios`, `tc-sim-historical-browser`. Legacy `tc-sim-save` ile cache upgrade birleşimi açık. |
| 5 `/games/bukucu/index.html` | Kendi `smb-shell-v13` worker'ı: beş entry precache, HTML çift fallback, anında aktivasyon/asset SWR | `closure-shared-slots.test.mjs` gerçek slot roundtrip/migrate/loadRaw kaynağı; özel legacy/corrupt-backup browser ve iki-deploy kanıtı açık. Save anahtarı bu envanterde tahmin edilmedi. |
| 6 `/oyna/labirent` | Kök-NF | `tlab-labirent` testleri; özel legacy/backup ve offline upgrade kanıtı açık. |
| 7 `/oyna/peg-solitaire` | Kök-NF | `tlab-tek-tas` testleri; özel legacy/backup ve offline upgrade kanıtı açık. |
| 8 `/oyna/satranc` | Kök-NF | `tlab-satranc` ve AI testleri; özel legacy/backup ve offline upgrade kanıtı açık. |
| 9 `/oyna/amiral-batti` | Kök-NF | `amiral-batti.test.mjs` snapshot/reload kararlılığı; özel legacy/backup ve offline upgrade kanıtı açık. |
| 10 `/oyna/apartman` | Kök-NF | `life-town-save` backup/quota/slot testinin doğrudan fixture'ı; `racon-apartman-content` v1 migration. Eski cache ile gerçek browser birleşimi açık. |
| 11 `/oyna/kayip-telefon` | Kök-NF | `wave3-kayip-deduction` v1/foreign/corrupt; `wave3-kayip-content` mid-case save. Ortak backup runtime'ı var; Apartman fixture'ı bu rota için browser backup kanıtı değildir. |
| 12 `/oyna/son-100-gun` | Kök-NF | Güncel POV `tariklab.son100.pov.v1`; `son100-pov` replay/tamper/version. Eski next-wave kayıtları korunuyor, dönüştürülmüş sayılmaz; `pov-app.js` doğrudan slot read/write yolunda özel backup kanıtı açık. |
| 13 `/oyna/tc-sim-devlet` | Kök-NF | `next-wave-sprint1` save-normalize ve `next-wave-start-flow`; özel eski fixture/corrupt-backup ve cache upgrade browser kanıtı açık. |
| 14 `/oyna/son-koy-manager` | Kök-NF; alias `/oyna/son-kasaba`, iç save kimliği `son-kasaba` | `son-kasaba` invalid/pending/slot; `wave2-depth` v1 idempotent migration. Ortak backup runtime'ı route-specific browser/upgrade kanıtı yerine geçmez; korunmuş atlas WIP bu kaynağa dahil değil. |
| 15 `/oyna/veto-h` | Kök-NF; tam 300 kart paketi precache değil | `duel-expansion` eski payload + sonraki draw/actions; `fixtures/duel/veto-h-old-save.json`, `duel-acceptance` backup/quota; `duel-production.mjs` legacy browser kapsamına dahil. Aynı-ID yeni sanat kohortu açık. |
| 16 `/oyna/gett-oh` | Kök-NF; tam 300 kart paketi precache değil | `duel-expansion`, `fixtures/duel/gett-oh-old-save.json`, `duel-acceptance`; `duel-production.mjs` legacy browser kapsamına dahil. Art-pack build zinciri ve aynı-ID yeni sanat kohortu açık. |
| 17 `/oyna/ihtilal` | Kök-NF | `ihtilal-basin-network` eski solo-v1; `ihtilal-ui-lifecycle` corrupt backup; `ihtilal-ultra-browser` backup fixture. Solo/diğer entry ayrımı ve deployment/cache upgrade birleşimi açık. |
| 18 `/oyna/darbe-h` | Kök-NF; tam 300 kart paketi precache değil | `duel-expansion`, `fixtures/duel/darbe-h-old-save.json`, `duel-acceptance`; mevcut `duel-production.mjs` legacy loop'u yalnız VETO/GETT içeriyor. DARBE legacy browser ve aynı-ID yeni sanat kohortu açık. |
| 19 `/oyna/jitem-derin-ag` | Kök-NF | `jitem-integration` canonical SOURCE `0c1fc08`, `jitem-derin-ag-v3` / schema 5 kaydı; upstream executable migration/backup test kanıtı ayrıca bağlanmalı. Yerel integration testi bu davranışları kanıtlamaz. |
| 20 `/oyna/esik` | Kök-SWR; `MODULE_GAME_PATHS` içinde esik prefix'i yok | `esik.test.mjs` roundtrip/foreign save; özel eski fixture/backup ve offline upgrade kanıtı açık. |

Kök worker kaynakları `public/sw.js`, `scripts/offline-sw-plugin.mjs`, `src/components/game/offline-ready.tsx`: sabit `cete-offline-v5`, shell/bundle precache; oyun ağaçları topluca precache edilmiyor. Install `addAll` hatasını yutup `skipWaiting` yapabiliyor; readiness UI'sı cache bütünlüğünü denetlemiyor. Kayıt Çete entry'sinden (HAN ayrıca kök/scoped, Bük kendi worker'ı) yapılıyor; yalnız portal ziyaretiyle bütün oyunların offline hazır olduğu kanıtlanmış değil. Bunlar **P1 doğrulama adayları / D3 backlog**; bu turda kesintili kurulum veya veri kaybı repro'su yok. `offline-sw-plugin.test.mjs` bundle injection, `tc-sim-production-cache.test.mjs` kaynak route sırası kontrolleri gerçek upgrade browser kanıtı değildir.

**300/300 × üç oyun cache kapısı:** `duel-core/theme-meta.js` kart sanatını sabit `/games/${theme}/assets/cards/${card.id}.${ext}` URL'sinden alıyor; hash/query veya atomik sanat kohortu yok. Kök network-first başarılı yanıtı aynı URL cache'ine yazar, ağ hatasında eski yanıtı döndürebilir; deploy/worker değişimi tek başına 900 sanat URL'sini precache veya invalidate etmez. Bu kaynak davranışı gözlenmiş production kusuru diye sunulmaz. Eski SW+eski sanat A → yeni deploy/sanat B, aynı-ID hash, kesintili kurulum/eviction, offline→online dönüş ve eski save fixture'larının birlikte browser doğrulaması **LATER**, owner Astra, PR yok. Üç 300'lük sanat kabulü bu kapı kapanmadan DONE sayılamaz.

Ayrı ölçüm kaydı: [`docs/evidence/2026-10-05-map-cache-ci.json`](evidence/2026-10-05-map-cache-ci.json), 63 before + 63 after HTTP socket rota ölçümü ve 13 Wave1 vakası/artifact hash ilişkisini tutar. Bu kayıt yeni production, eski açık browser sekmesi veya D3 eski-cache upgrade deneyi yapılmış olduğu anlamına gelmez.


### A2 merge checkpoint — 2026-10-05 03:16 UTC
#111 normal merge `a534289490f502f68e12d91803fbc3883de7d790`; exact head `eb5913d` üzerinde10/10 listed check + Vercel SUCCESS. A1/A3 kapanışı sonrası sıralı yayın yapıldı. İki-host production henüz PENDING; bu kayıt final360 başlangıcı veya tamamlanması değildir. Racon capture boyutu doğrulama açığı yukarıda korunur.


### B4–B10 — 900 kartın anlamsal hazırlığı, 2026-10-05

Üç bağımsız hazırlık dalı güncel main `a534289` tabanında yayımlandı. Bu dallar **AUTHOR_DRAFT / PLANNED_NOT_DRAWN**, PR/merge/deploy yok; accepted art **0/900**. Yalnız taslak sahne şartnameleri/generator/test/kaynak hashleri taşındı; reddedilen probe veya raster aktarılmadı. Kaynak kartların tüm alanları korunur; testler sanat kalitesi veya B10 browser/offline kabulü değildir.

| Madde / oyun | Kalıcı branch / SHA | Anlamsal kapsam ve test | Açık sanat kapısı |
| --- | --- | --- | --- |
| B4 VETO-H! | `astra/veto-semantic-art-preparation` / `3c1c8d1ec3035b697761a9c86fd0bfa553c6aec0` | 300/300; character133/object60/event45/action36/institution19/location7;6/6 hedefli test;13 bayraktan10 kaynakla sınırlandı,3 açık | 0/300; anatomi, gerçekçilik, mobil artwell ve gerçek çizim yok |
| B5 GETT-OH! | `astra/gett-semantic-art-preparation` / `244ab41d59572ee468804b76f57357ff45a79e1b` | 300/300; character151/object60/location26/event25/action22/institution16;5/5 hedefli test;30 bayraktan22 kaynakla sınırlandı,8 açık | 0/300; aynı kalite kapıları; bayraklar kart bazında açık |
| B6 DARBE-H! | `astra/darbe-semantic-art-preparation` / `931429dba20bf521877aa4f6ad4ad8bc591827e4` | 300/300; character128/object63/action59/event27/institution15/location8;6/6 test;652 public/duel dosyası değişmedi | 0/300; bütün taslaklar AUTHOR_DRAFT; B11 ayrı kullanıcı bildirimi açık |

Bağlı GitHub connector ile exact-tree eşleşmesi ve branch readback doğrulandı. CLI push kullanıcı adı bulunamadığı için ilerlemedi; credential ayarı değiştirilmedi. Yerel hash/test edilmiş ağaç normal yetkili connector ile taşındı.


### E1/E2 keşif bağlantısı — uygulama başlamadı
[ANATOMY_FOUNDATION_DISCOVERY.md](ANATOMY_FOUNDATION_DISCOVERY.md): ayrı offline rota/namespace, kaynak-tarih-review şeması, ilk kapsam/bütçe/test kapıları ve sınırlı ad kullanımı kontrolü. Bu bir uygulama, uzman incelemesi veya marka uygunluğu kabulü değildir. E1/E2 foundation, E3 insan kapıları ve F hâlâ açık. Kullanıcıdan yeni yetki veya stil onayı gerekmez.


### A2 iki-host production kapanışı — 2026-10-05

Merge `a534289490f502f68e12d91803fbc3883de7d790`, [main CI37258787799](https://github.com/tayaz-maker/tariklab/actions/runs/37258787799) **SUCCESS**. Browser job111601394043: www+Workers Wave1 **13/13'er**, Çete **17/17'şer**, VETO/GETT300 arşiv ve legacy save production doğrulaması. Campaign job111601394061 HAN20 / İHT43 kontrolü geçti. Bu sonuç DARBE legacy browser veya bütün20rota final-review kabulü değildir.

Özel [HAN run37258787888](https://github.com/tayaz-maker/tariklab/actions/runs/37258787888), job111601366977: iki host ×1440×900/390×844/320×800 **6/6 PASS**; her vakada2 gerçek reload, gerçek farm emri/save/seed/durmuş saat korunuyor;19dosyalık cache; console/page/network/HTTP error0 ve ölçülen yatay overflow0. Aynı SW SHA256 `8f44b24062a076d29b4d771f940f31f713d4685f8a1c1fd33ef43bfaa2811d39`. [Makine kanıtı](evidence/2026-10-05-a2-han-production.json) altı vaka ve host bazlı artifact hashlerini tutar. Chrome154 yazılım tarayıcı kanıtı, fiziksel GPU değildir.

| Host | Artifact / ZIP SHA256 | Gerçek görsel inceleme |
| --- | --- | --- |
| www | [11323133708](https://github.com/tayaz-maker/tariklab/actions/runs/37258787888/artifacts/11323133708),16,569,965B; `a594f7ea78492d75f26ac64e911cdbfd5d278f767ae1e719be7e9cb202a0e877` | Üç genişliğin reload-2 PNG'si açıldı; kayıtlı harita görünür |
| Workers | [11322919338](https://github.com/tayaz-maker/tariklab/actions/runs/37258787888/artifacts/11322919338),16,417,600B; `dffcc2b62ede78499661160b94ecd17a27383214dd863f04e1c4fd8b1726fe4d` | Üç genişliğin reload-2 PNG'si açıldı; kayıtlı harita görünür |

Wave1 production [artifact11323759638](https://github.com/tayaz-maker/tariklab/actions/runs/37258787799/artifacts/11323759638),47,021,215B; GitHub digest `c235a2669e7e4dc61b19b0f1dc82d80027ee5a87bed97c04259e56ad4dcff316`.32MiB indirme sınırını aştığından yerelde açılmadı; başarı gerçek CI browser assertion/log kanıtıdır. Source/built küçük artifact'in incelenmesi production piksel incelemesi diye sunulmaz. Racon390/320 map-layer fullPage capture açığı C3'te açık; bütün sahnelerde overflow0 veya tam eski-cache upgrade iddiası yok.

B7 farklı yöntem için [geometri fizibilitesi](https://github.com/tayaz-maker/tariklab/blob/931429dba20bf521877aa4f6ad4ad8bc591827e4/outputs/darbe-vector-300/LAYERED_GEOMETRY_FEASIBILITY.md) kalıcı hazırlık branch'ine kaydedildi. Özgün anatomik yüzey/eklem + tek kamera/ışık → saf vektör projeksiyon seçeneğinin dosya/ışık/saydamlık riskleri ölçülmeden kabul yok. Bu belge model/render başarısı veya production sanatı değildir; kabul0/900.

D4 ölçüm tablosu: [63 rota/genişlik before–after CSV](evidence/2026-10-05-map-route-costs.csv), yukarıdaki exact-head JSON/artifact verisinden türetildi. `first_readable_ms` testin ilk okunur içerik işaretidir, standart FMP metriği değildir. Byte değerleri HTTP proxy socket ölçümüdür (header + kodlanmış body + chunk framing; TLS/TCP hariç, SW dahil), production HTTPS transfer/latency ölçümü yerine geçmez. Entry overflow sonucu sonraki her oyun sahnesine genellenmez.

B10 provenance/parity kapısı: `AGENTS.project.md` uyarınca yayınlanacak ortak artwork/content kaynağı `tayaz-maker/tariklab-content` içinde sürümlenecek ve web bundle kopyası aynı kaynak/hash ile bağlanacak. Şimdiki outputs taslakları bu içerik yayını değildir; native/Godot hâlâ paused, native uygulama veya gameplay değişikliği açılmaz. Owner Astra; sanat PR'ları henüz yok.


### B7/B10 — farklı geometri yönteminin ölçülü reddi, 2026-10-05

Özgün sürekli yüz/el geometrisi → tek kamera/ışık → saf SVG projeksiyon denendi. Root tam görüntüyü ve aktif `.dh-art img` merkez-cover kırpımını açtı: şişkin/maske benzeri yüz, üçgen arası iz/örtüşme kusurları, ikna edici olmayan kâğıt tutuşu ve malzeme ayrımı nedeniyle **FAIL_REALISM**. Önceki `%38` crop bilgisi shared `.card-art img` içindir; aktif DARBE custom `.dh-art` için geçerli değildir. UI/CSS veya kart ölçüsü değiştirilmedi.

9,563 toplam /5,051 görünen üçgen; SVG358,836B, gzip65,814B; yerel üretim2.25s,800px Inkscape render0.32s. Ham dosya mevcut en büyük DARBE asset'inin26.28 katıdır. Parmak temas mesafesi gibi teknik geometri ölçümleri estetik/anatomik doğruluk kanıtı değildir; başparmak arka kâğıt düzleminden0.084 sahne birimi uzakta ve serçe kâğıt XY alanı dışındadır. Dış image/dataURI bulunmaması kalite veya bütçe kabulü sayılmaz.

Tek farklı yöntem de reddedildi; kozmetik tekrar veya300/900 çoğaltma yok. Kabul hâlâ **0/900**. Public/gameplay/save/engine dokunulmadı; başarısız SVG/PNG production'a alınmadı. Ölçülü teknik kaynak ayrı outputs-only checkpoint'te tutulur. B4–B10 tamam değildir ve insan/asset kalitesi varmış gibi PASS yazılmaz. Owner Astra, sanat PR'ları henüz yok.


### D5 dar güvenlik kapanışı — 2026-10-05 04:02 UTC

[#114](https://github.com/tayaz-maker/tariklab/pull/114) normal merge `0383d24dce3e45fc1db16773da8b3a135bf51b6e`; exact-head8/8 checks + Vercel SUCCESS. [Main37260245958](https://github.com/tayaz-maker/tariklab/actions/runs/37260245958) SUCCESS:1716 Node PASS/0 FAIL/1 mevcut opt-in3000+ DARBE matrix SKIP;61 Vitest PASS;500'er deterministik düello; build/typecheck/lint0error. Her iki production hostta Wave1 13/13 ve Çete17/17 geçti. Bu, yalnız iki development brace-expansion zincirinin üç doğrulanmış advisory düzeltmesidir; genel D5 denetimi tamam değil. [Kaynak/advisory kaydı](sources/BRACE_EXPANSION_SECURITY_2026-10-05.md), [release kanıtı](evidence/2026-10-05-d5-security-release.json).

B10 screenshot-readiness açığı: production duel artifact11325111667 hash'i doğrulandı, VETO390 ve GETT1440 legacy ekranı açıldı. GETT ekranında mevcut elde altı art placeholder görülüyor. Script arşivdeRCN-300 decode'unu bekliyor, restore sonrası el görsellerini beklemeden screenshot alıyor; görüntüdeki eksik readiness gerçek kanıt, kalıcı production art kaybı kök teşhisi henüz yok. Archive300/legacy-save assertion PASS, bütün elde çizim okunurluğu PASS değil. Astra dar browser-evidence doğrulaması hazırlıyor; sanat/engine/rules değişmeyecek, PR henüz yok.

B7 ölçülü ret kaynakları kalıcı ayrı [astra/darbe-geometry-export-probe](https://github.com/tayaz-maker/tariklab/tree/49f0aab04de5e7270f7099a3e077fe876c05bea3/outputs/darbe-geometry-probe) checkpoint'inde; SHA `49f0aab04de5e7270f7099a3e077fe876c05bea3`. Başarısız SVG/PNG remote commit'e veya geçmişine taşınmadı; yalnız yeniden üretilebilir kod/metrik/red raporu. Sanat kabulü0/900.
