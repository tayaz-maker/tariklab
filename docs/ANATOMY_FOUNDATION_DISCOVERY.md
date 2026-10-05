# Anatomi foundation — E1/E2 keşif kaydı

2026-10-05 · Owner **Astra** · kaynak main **`a534289490f502f68e12d91803fbc3883de7d790`** · branch `astra/anatomy-foundation-discovery`.

**DISCOVERY ONLY.** Bu belge ad/kaynak/entegrasyon sınırlarını ve gelecekteki kabul kapılarını önerir. Foundation uygulaması başlamadı; ürün, çizim, kod, üretilmiş asset veya yeni PR yok. E1/E2 **LATER**; uzman onayı alınmadı, tam atlas veya klinik doğruluk kabulü yok. Bu keşif final 360 incelemesini başlatmaz. Kaynak okuması ve web başlık kontrolü yapıldı; runtime/browser/performance testleri **NOT RUN**.

## Ad ve sınır

2026-10-05 kamuya açık başlık araması: **“İnsan Anatomisi Atlası” başlığı zaten kullanılıyor**. Nobel Akademik kataloğunda [İnsan Anatomisi Atlası — 3 Cilt](https://www.nobelyayin.com/insan-anatomisi-atlasi-3-cilt-14979.html), Tacchetti & Anastasi, ISBN 978-975-2480-10-0, bulunuyor. Bu yalnız yayımlanmış başlık kullanımı kanıtıdır; marka/tescil araştırması veya hukuki izin sonucu değildir. Kitabın içerik ve görselleri kullanılmayacak.

Geçici ayrıştırıcı çalışma adı: **TarikLab Yapı Atlası — Temel Anatomi**. `"TarikLab Yapı Atlası"` sınırlı kamu aramasında birebir bir ürün sonucu saptanmadı; bu benzersizlik veya hukuki uygunluk garantisi değildir. Son ad yayına bağlanmadan tekrar kontrol edilir; mevcut görev kullanıcıdan yeni stil/onay bekleme kapısı oluşturmaz.

İlk kullanım ve Kaynaklar yüzeyinde sakin, klavyeyle erişilebilir not önerisi: **“Eğitim amaçlı anatomi taslağıdır; tıbbi tavsiye, tanı veya tedavi için kullanılmaz.”** İncelenmemiş içerik `educational-draft` veya `unpublished` kalır; kaynak bağlantısı uzman onayı yerine geçmez.

“Tam anatomi sistemleri daha sonra ayrı içerik dalgalarında eklenecek.”

“Anatomik doğruluk için kaynak ve uzman inceleme kaydı olmadan tam/klinik kesin iddiası koymayacağız.”

## Mevcut entegrasyon sınırı ve önerilen ayrı rota

| Kaynakta görülen sınır | Foundation için öneri; henüz uygulanmadı |
| --- | --- |
| `src/lib/games.ts`: 20 canlı oyun; `HTML5_SLUGS` ve oyun kategori/save kimlikleri. Anatomi kaydı yok. | Atlas ayrı eğitim ürünü olarak tutulur; oyun slug/save namespace'i ödünç alınmaz. İleride ayrı portal girişinin lazy sınırı ölçülür. |
| `src/routes/oyna.$slug.tsx`: allowlist kontrolü ve `/games/{slug}/index.html` iframe'i. | Önerilen canonical giriş **`/atlas/yapi/`**, statik entry adayı `public/atlas/yapi/index.html`; `/oyna/$slug` içine zorla sokulmaz. `/atlas/yapi/index.html` ve kaynak derin bağlantıları iki hostta ayrıca doğrulanır. Route/canonical/sitemap değişikliği sonraki ayrı PR kapsamıdır. |
| `public/sw.js`: sabit `cete-offline-v5`, Çete shell'i; diğer dosyalar runtime cache. Install hatası paket bütünlüğünü kanıtlamıyor. | Atlas için `/atlas/yapi/sw.js`, scope `/atlas/yapi/`, ayrı `tariklab-anatomy-*` cache alanı önerilir. Mevcut kök worker'ın ilk ziyaret/aktifleştirme ve asset cache etkileşimi ayrıca ayrıştırılmalı; sadece yeni worker eklemek yeterli kabul edilmez. Diğer oyun cache/save'leri silinmez. |
| `scripts/offline-sw-plugin.mjs`: app build asset injection ve HANEDANIAN'a özel content-hash worker sürümleme; atlas paketi yok. | Kendi HTML/JS/CSS, içerik, TR/EN/PL etiketler ve özgün SVG/katman geometrisini içeren sürümlü manifest. Kurulum tüm gövdeler/MIME/hash doğrulanınca atomik; kesintide eski sağlam paket korunur. Paket hazır ve etkin olmadan “offline hazır” gösterilmez. Kaynak metaverisi/notu offline okunur, dış bağlantılar yalnız isteğe bağlı online açılır. |

Kullanıcı sağlık verisi, fotoğraf, belirti, hasta kaydı, hesap veya sağlık profili alınmaz. Gerekirse yalnız yerel dil/görünüm/seçili yapı tercihleri, sürümlü ve sıfırlanabilir ayrı anahtarda tutulur; sağlık günlüğü veya serbest metin yok. Bu turda storage/API eklenmedi.

## Sınırlı foundation içerik önerisi

Özgün bilimsel **2.5D** katmanlar: yetişkin beden varyantları, ön/arka görünüm, iskeletin büyük grupları (kafatası, omurga, göğüs kafesi, pelvis, uzuvlar) ve seçilebilir büyük organlar için ilk envanter (beyin, kalp, akciğerler, karaciğer, mide, bağırsaklar, böbrekler, mesane). Bu bir **taslak kapsam listesi**; her yapının biçim/konum/komşuluk/etiketi kaynak ve inceleme kaydına bağlanır. `unpublished` üretimde görünmez; `educational-draft` açık taslak etiketi taşır. Bağımsız uzman incelemesi kapanmadan içerik doğrulanmış, uzman onaylı, tam veya klinik kesin diye yayımlanmaz. Tam kemik/organ sayımı veya bütün bireyleri temsil iddiası yok.

İlk etkileşimler: katman görünürlüğü, yapı seçimi/izolasyonu, yakınlaştırma/sıfırlama ve kısa kaynaklı açıklama; görünüm ile metin seçimi aynı yapıya bağlı. SVG/DOM erişilebilir liste başlangıç seçeneğidir; ek renderer ancak ölçülmüş faydayla lazy eklenir. Kadavra/gerçek kişi görüntüsü, indirilen model, dış fotoğraf/CDN, raster/AI plaka, OpenStax veya başka atlasın görsel/metin kopyası yok; kaynak göstermek dış asset kullanımına izin sayılmaz.

**LATER:** ayrıntılı kas tutunmaları, damar/sinir dalları, lenfatik/endokrin/duyu/üreme sistemlerinin tam kapsamı, histoloji ve diğer eğitim içeriği dalgaları. Foundation bunların tamamlanmış karşılığı değildir. **Ürün kapsamı dışı:** kişisel sağlık verisi, semptom değerlendirmesi, tanı/tedavi/doz önerisi, acil yönlendirme veya klinik karar aracı; bunlar sonraki dalga vaadi değildir.

## Kaynak ve review şeması önerisi

Her **sistem, yapı, etiket ve açıklama** bağımsız kayıttır; yalnız bütün atlas için tek genel kaynak yeterli değildir.

| Alan | Zorunlu anlam / varsayılan |
| --- | --- |
| `id`, `kind`, `schemaVersion`, `contentVersion`, `owner` | Kararlı ID; system/structure/label/explanation; sürümlü kayıt; owner Astra. |
| `locale`, `parentId`, `structureIds`, `text`, `geometryRef` | TR/EN/PL metni ve ilişkilendirilen yapı/geometri. Yok alan açıkça null; uydurma çeviri veya referans yok. |
| `sources[]` | Her maddede **`sourceUrl`, `sourceDate`, `sourceDateKind`, `accessedAt`, `sourceVersion`, `locator`, `supportedClaim`**. `sourceDate` yayımlanma/güncellenme/review tarihidir; erişim tarihiyle karıştırılmaz. Sayfada yoksa null + açık gerekçe; release sahibi bu eksikliği kapatır veya taslak bırakır. |
| `reviewer`, `reviewerQualification`, `reviewedAt`, `reviewedContentHash`, `reviewStatus` | Varsayılan null / `not-reviewed`; süreç `not-reviewed → in-review → approved` veya `changes-requested`. Gerçek bağımsız uzmanın adı/yetkinliği, tarih, kapsam ve exact içerik hash'i olmadan approved olamaz. Metin/geometri değişince review geçersizleşir. |
| `publicationStatus`, `limitations`, `provenance` | Varsayılan **`unpublished`**; açık draft yayını gerekiyorsa `educational-draft` etiketi ve kaynak durumuyla. Özgün geometri/kod üretim kaydı; belirsiz asset yayımlanmaz. `reviewStatus` ile yayın durumu ayrı tutulur. |

Keşifte açılan **birincil NLM/NIH kaynakları** (erişim `2026-10-05`; içerik review'u henüz `not-reviewed`, reviewer null):

| Kaynak | Kaynak tarihi / bu keşifteki sınırlı kullanım |
| --- | --- |
| [NLM — Introduction to MeSH](https://www.nlm.nih.gov/mesh/introduction.html) | Sayfada “Last Reviewed” **2025-07-10**. Terim ve sürüm/provenance tasarımına başlangıç kaynağı; organ geometrisini doğrulamaz. |
| [NCBI/NLM — Anatomy, MeSH D000715](https://www.ncbi.nlm.nih.gov/mesh/68000715) | İncelenen kayıtta güncelleme tarihi saptanmadı: `sourceDate=null`. Kimlik/terim eşleme örneği; her yapı için özel kayıt ayrıca bulunmalı. |
| [NLM — Visible Human Project overview](https://www.nlm.nih.gov/research/visible/visible_human.html) | İncelenen sayfanın kaynak güncelleme tarihi saptanmadı: `sourceDate=null`; tarihsel dataset yılları güncelleme tarihi diye kullanılmaz. Referans portali olarak kaydedildi; hiçbir görüntü/model/dataset indirilmedi veya türetilmedi. |

Bu üç genel sayfa tek başına iskelet/organ çizim doğruluğuna kaynak değildir. İleride her açıklama ve konum ilişkisi için **özel birincil NLM/NIH kaydı**, uygun kaynak tarihi ve bağımsız uzman kararı gerekir; arama sonucu veya model bilgisiyle boşluk doldurulmaz. Kaynakların adı/URL'si özgün kısa açıklamalarla saklanır; metin ve görseller kopyalanmaz. PL dil incelemesi de ayrı insan kapısıdır.

## Önerilen bütçe ve gelecekteki kabul kapıları

Bunlar ölçülmüş sonuç değil, ilk uygulama için başlangıç bütçeleridir: atlas girişinde sıkıştırılmış transfer **≤350 KiB / ≤12 istek**, seçili temel katmanlarla toplam **≤1.5 MiB**, tam foundation offline paketi **≤5 MiB**; portalda atlas geometri/renderer isteği **0**. 390 px referans cihaz/Chromium ve ağ/CPU profili kayda alınarak ilk anlamlı içerik hedefi **≤2.5 s**, seçime yanıt p95 **≤100 ms**; aynı koşulda baseline/adayı raporlanır. Bütçe aşımı sessizce gevşetilmez; katman sadeleştirme/lazy paketleme gerekçesi yazılır.

1. **Schema/içerik:** her sistem/etiket/açıklama kaynak+date+owner+reviewStatus taşır; eksik/bozuk kayıt güvenle draft/unpublished kalır. Review hash uyumsuzluğu, missing locale, foreign ID ve eski tercih şeması testleri; eğitim notu ilk kullanımda ve Kaynaklar'da erişilebilir. Kaynak/uzman olmadan tam/klinik kesinlik metni release'i bloke eder.
2. **UI/lifecycle:** 1440×900, 390×844, 320 px; TR/EN/PL, klavye ve ekran okuyucu, focus/restore, okunur hedefler, 200% metin/zoom, kontrast, reduced motion. Tıklama/etiket eşleşmesi; resize/geri/ileri/derin link/reload ve DOM fallback. Ek WebGL varsa gerçek context loss/low-memory/destroy/resize testleri; ticker idle'da durur, fiziksel GPU kanıtı ayrıca tutulur. Ses/müzik/vibrate/autoplay yok.
3. **Offline/tercihler:** ilk tam online kurulum→offline derin rota; eski worker+eski içerik A→yeni paket B; açık eski/yeni sekme, kesintili kurulum, kota/eviction, rollback ve reconnect; kaynak notu/etiket/geometry aynı kohortta. Kök worker ile scope yarışması ve ayrı oyun cache/save'lerinin korunması gerçek browser'da doğrulanır.
4. **Performans/provenance:** manifest hash ve byte/istek bütçesi; portal lazy sınırı; tekrar mount/unmount sonrası canvas/listener/bellek büyümesi; tüm asset'lerin özgün kaynak kaydı. Dış image/model/CDN ve belirsiz kopya yokluğu statik tarama + gerçek network kanıtıyla doğrulanır.
5. **Release:** ayrı foundation PR'ı yetkilendirilmiş bağımlılık sırasında sırası geldiğinde; yerel kontroller→exact-head CI→merge→`https://www.tariklab.com` ve `https://tariklab.tayaz29.workers.dev` üzerinde gerçek SHA/build+asset hash, screenshot/DOM/console/offline kanıtı. Uzman/PL insan kararları CI ile kapatılamaz. Bu discovery commit'i, E1/E2 veya final F için DONE/PASS değildir.

**Sonraki adım:** root bu keşif önerisini mevcut E1/E2 backlog'una bağlar; foundation uygulaması, kaynakları yapıya indirme ve bağımsız uzman ataması ayrı iş olarak kalır. Özgün keşif checkpoint'i `56192748b6fea995054aeb642c8675de664e71a6` yalnız bu Markdown dosyasını içerir; ürün uygulaması/deploy yok. Keşif bu release-evidence dokümantasyon paketinde kalıcılaştırılır.
