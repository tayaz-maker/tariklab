# TarikLab — final 360° inceleme intake'i ve yayın kapıları

Tarih: **2026-10-05 (Türkiye)**. Sahip: **Astra — inceleme, dar düzeltme ve release kapanışının tamamı**. Bu belge yalnız gelecekteki kabul checklist'idir; ürün incelemesi, anatomi A keşfi, repro, uzman incelemesi veya production testi başlatılmış değildir. Yeni kaynak planı/özellik de bu hazırlıkta denetlenmez.

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
| SON KÖY | Korunmuş kirli worktree'ye dokunulmaz; iş ayrı PR veya sahibi/gerekçesi olan LATER kaydı olarak sınıflandırılır. Şimdi audit, taşıma veya merge yok | LATER |
| `brace-expansion` dev/high | Güncel advisory, sürüm ve bağımlılık yolu yeniden doğrulanır; ayrı dar PR veya sürüm/etki/erişilebilirlik/azaltım/sahip içeren açık blocker kaydı. Eski bulgu kapanmış veya güncel diye varsayılmaz | LATER |
| Fiziksel GPU | SwiftShader/llvmpipe/softpipe fiziksel GPU/Pixi kanıtı değildir; gerçek aygıt ve renderer kanıtı ayrıca gerekir | LATER |
| PL ana dil | Ana dili Lehçe olan insanın isim/tarih/kapsam ve düzeltme kaydı | insan-inceleme-gerekli |
| Anatomi uzmanı | Bağımsız yetkin uzmanın kaynak/sürüm/kapsam/tarih/karar kaydı | insan-inceleme-gerekli |
| Eski branch kabulü | Yalnız açık PR, bağlayıcı kaynak planı veya açık kullanıcı talebiyle eşleşen branch alınır; eski olması otomatik kapsam oluşturmaz | LATER |

Gerekçeli LATER kaydı DONE değildir ve zorunlu bir release kapısını kendiliğinden kaldırmaz. Astra mevcut kullanıcı yetkisiyle release kapanışını da sahiplenir; başka ajana zorunlu handoff şartı yoktur.

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
| 1 — DARBE-H! / Wave 4 | Mevcut **300 özgün/prosedürel SVG kart** ve ölçüleri korunur. Yalnız mevcut state'ten türeyen sessiz sonuç anı ve masa/eldeki kart/arşiv için hafif erişilebilir katman; reduced motion, skip, okunabilir metin. Kart verisi/denge/deste/save/ortak duel engine değişmez. Gerçek kişi/kurum/parti/askerî sembol, şiddet estetiği, dış asset ve kopya UI yok. DRB kaydı aşağıda ayrı | LATER |
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
