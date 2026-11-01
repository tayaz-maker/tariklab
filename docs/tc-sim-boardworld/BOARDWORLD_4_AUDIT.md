# Boardworld 4.0 — doğrulanmış 3.0 başlangıç incelemesi

İncelenen üretim commit’i: `5d22f86c462e22b6fd31793b5f2a81606d9f5603`, ağaç `c67c78f9c1a86f4fc71796c7bf3a4281381456b2`. Kaynak, Git metadata’sıyla ayrı kopyaya alındı; bu kopyadaki motor/UI/kayıt kodu değiştirilmedi. Aşağıdakiler **3.0 başlangıç ölçümleridir**, tamamlanmış 4.0 özellikleri veya yayın kanıtı değildir. Makinece okunabilir özet: [BOARDWORLD_4_BASELINE.json](BOARDWORLD_4_BASELINE.json).

## Tekrarlanan kapılar

- Tam depo: **2.635/2.635 geçti**, 0 başarısız/atlanan; 2.574 JS + 61 TS, yaklaşık 211,2 + 0,5 saniye.
- Production build ve typecheck geçti; lint **0 hata / var olan 62 uyarı**.
- İlk tam çalışmada eski sentetik Git arşivi testi yerel `tar EPIPE` verdi (tar çıkış kodu 0). Aynı değiştirilmemiş testin odaklı tekrarı 2/2, ardından bütün deponun temiz tekrarı 2.635/2.635 geçti. Bu geçici hata gizlenmedi veya test kaldırılarak aşılmadı.
- Üç mevcut Chromium paketi 1440/390/320 px’de geçti: temel oyun/kayıt/yedek kurtarma; Deep Life işletme/hikâye/rutin; Living City harita/takvim/proje/niyet. Özgün TC SIM’de gerçek oluşturma/eylem/kayıt/yeniden yükleme de geçti. 1.0/2.0 aktarımı, değişmez yedek ve eski sekme yazımları doğrulandı.
- Son Living City paketi performans için ayrıca üç kez **seri**, diğer ağır testler bittikten sonra çalıştırıldı; 18 kaynak dosyası production çıktısıyla aynı baytlardadır. Masaüstü harita ve mobil ajanda ekran görüntüleri görsel olarak incelendi.

## Uzun hayatlar: tekrar ile karar derinliğini ayırmak

Üç strateji × seed `2026`/`91373`, borçlu `restart` başlangıcından 30/90/180/365 günlük kontrol noktalarına **gerçek genel motor eylemleriyle** ulaştı. Tarih, para, beceri veya NPC alanı değiştirilmedi. Bütün hayatlar 366. günde sağlık 100 ve kira borcu sıfırdı; başlangıç borcu faizle 17.114 TL olarak sürüyordu. Bu altı politika bütün olası stratejilerin ispatı değildir.

| Manuel politika | 30 günlük komut | 90 günlük komut | 180 günlük komut | 365 günlük komut | 365. gün sonucu                                                                          |
| --------------- | --------------- | --------------- | ---------------- | ---------------- | ---------------------------------------------------------------------------------------- |
| Kariyer         | 165             | 490–491         | 1.006–1.009      | 2.079–2.085      | Mağazadan onarıma geçiş, dört terfi, bir tamamlanan yeterlilik projesi; banka 498.481 TL |
| Sosyal          | 286–290         | 829–830         | 1.619–1.637      | 3.228–3.286      | Üç ilişki projesi, 72 gerçek buluşma, hiç kaçırmama; banka yaklaşık 416 bin TL           |
| Girişimci       | 259–268         | 797–804         | 1.607–1.610      | 3.272–3.276      | 365 hizmet ve 122 serbest iş teslimi; kârlı işletme, banka yaklaşık 319 bin TL           |

Bunlar resolver komutlarıdır, ölçülmüş insan tıklamaları değildir. Dinlenme, uyku ve çalışma tekrarının bir kısmı otomatik test politikasının seçimi; bir kısmı yaşam simülasyonunun doğal döngüsüdür. Yine de aşağıdaki hedefler gerçek kurallardan gözlendi:

- Kariyerde 637–641 beceri çalışması **anlık beceri kazancı olmadan**, 77–100 dinlenme enerji/stres/sağlık değişmeden yapılabildi. 365. gün iletişim ve zanaat 100’dü. Sosyal seed2026 koşusunda 1.714 konuşma/telefon/mentorluk eylemi anlık yakınlık/güven kazancı üretmedi. Hafıza veya diğer yan etkilerin hiç olmadığı iddia edilmiyor.
- Bu politikaların seçtiği tüm özgün olay kartları ilk 30 güne sığdı. Kariyer ve girişimcilikte 90. günden 365. güne yeni olay/hikâye aşaması veya sınıflanan büyük karar yoktu. Sosyal politika yeni randevu kararları üretmeye devam etti. Başka bir hayatın hiç yeni koşul açamayacağı sonucu çıkarılmadı.
- Karar sınıflaması açık ve tekrarlanabilir: olay/hikâye, işe giriş/terfi/bildirim/müzakere, proje, randevu teklif/onay/iptal, işletme kuruluş/yükseltme/kapanış, eğitim kaydı ve kiralama. Seed2026’da toplam komut/böyle karar oranı kariyer 47,25; sosyal 25,87; girişimci 125,85. Bu tasarım göstergesidir; gerçek oyuncunun düşünme süresini ölçmez.
- Randevu örneği kimlikleri normalize edilmeden sosyal eylem çeşitliliği 145 görünürken gerçekte 58 eylem türü vardır. Dinamik `cal-N`/`project-N`/`promise-N` kimlikleri çeşitlilik hesabından ayrıldı.
- Artan servet, sıfır zamanlı sınırsız para açığı kanıtı değildir: kâr 365 gün, stok, hizmet ve teslimlerden geldi. Yine de kariyer 90. günden sonra aynı iş/uyku/çalışma döngüsüne, işletme hizmet/teslim döngüsüne yerleşti; 4.0 yeni anlamlı fırsat ve mali riskleri bu döneme yaymalıdır.

### Mevcut otomasyonu yok saymamak

3.0 zaten `schedule:run:1/7` içerir. Ayrı, sade mağaza hayatında mevcut haftalık rutin **154–155 dış komutla 365 günü**, 1.840–1.842 iç rutin eylemini, 311 vardiyayı ve iki terfiyi tamamladı. Sağlık 100, kira borcu sıfırdı. 20 sıfır-zamanlı duruş ve 24 mali sınır duruşu kaydedildi; oyuncu kararları ayrı verildi.

Dolayısıyla “4.0 otomasyonu 2.079 tıklamayı 155’e düşürdü” denemez: ikinci sayı zaten 3.0’da mümkündür ve farklı bir hedef/politikadır. 4.0 karşılaştırması mevcut rutinle aynı iş yükünü de içermeli; kazanç yeni politika seçenekleri, güvenli duruş açıklamaları, erişilebilir planlama ve ilerleyen aylardaki anlamlı kararlar üzerinden değerlendirilmelidir.

## Gerçek arayüz sürtünmesi ve hedef

| Gözlenen 3.0 davranışı                                                              | Sorun / korunacak özellik                           | 4.0 kabul hedefi                                                                         |
| ----------------------------------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 320 px’de harita belge Y=864’te başlıyor; konum çipi gizli                          | Tahta ve konum ilk bakışta okunmuyor                | Kompakt kaynak/konum/tahta, erişilebilir semt ve rota eylemleri                          |
| Rutin kontrolleri yaklaşık Y=2.300’de                                               | Var olan otomasyon keşfedilmiyor; uzun kaydırma     | Üstte günlük/haftalık politika özeti ve doğrudan çalıştırma; gerçek duruş nedeni         |
| Yaşam paneli 320 px’de yaklaşık 8.333 px                                            | İhtiyaç, eğitim, konut ve seçenekler tek uzun liste | Bağlama göre kısa seçenekler, arama/filtre; hiçbir gerçek seçenek kaybolmasın            |
| Beceri/ilişki tavanında aynı eylem hâlâ seçilebiliyor                               | Politikalar kazançsız tekrar yapabiliyor            | Azalan getiri açıklaması; rutin tavanı görüp başka ihtiyaca geçsin                       |
| 12 tam NPC + toplulaştırılmış nüfus, güvenli takvim ve gerçek işletme sermayesi     | Çalışan temel yeniden yazılmamalı                   | Sınırlı ikincil kişiler, rol farkları ve ortak ev gerçek para/zaman/kimlikle bağlansın   |
| Özgün kartlar ve zincirler tek seferlik; seçilen uzun politikalarda erken tükeniyor | Geç aylarda yeni önemli seçim az                    | En az 12 koşula dayalı olay ailesi, kaynak/neden/sonuç, bekleme süresi ve gecikmiş sonuç |

UI konumları kısa gerçek Chromium sürtünme çalışmasından gelir; üretim testlerinin manuel komut sayılarıyla karıştırılmaz. Aynı genişlik ve başlangıç durumuyla son sürümde tekrar ölçülmelidir.

390 px’de kaydedilen gerçek DOM yolculukları:

| Başlangıç ve görev                          | Gerçek arayüz etkileşimi                                               | Doğrulanan sonuç                                                       |
| ------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Tahtadan uygun mağaza işine başvur          | Kariyer sekmesi + başvur düğmesi: 2 tıklama                            | Gerçek iş sözleşmesi oluştu                                            |
| Tahtadan Beşiktaş’a git, semt kartı yolu    | Semt seç + yolculuk: 2 tıklama; hedef düğme belge Y=2.596              | Gerçek seyahat; bu örnek yol, mümkün olan en kısa yol iddiası değildir |
| Tahtadan Leyla’yı arama koşulunu incele     | Telefon + kişi: 2 tıklama                                              | Meşgul gerekçesi görüldü; tamamlanmış konuşma sayılmadı                |
| Kişilerden yarın için kişisel dinlenme ayır | Ajanda + gönder: 2 tıklama; tür/konu/gün/saat için 4 seçim değişikliği | Toplam 6 ayrık etkileşimle gerçek onaylı takvim kaydı                  |

Otomatik kaydırma mesafesi ayrıca kaydedildi; insanın yaptığı kaydırma jesti gibi sayılmadı. Bu küçük görev örnekleri, bütün bir hayatın gerçek insan tıklama yükünün ölçümü değildir.

## Aynı cihazda performans başlangıcı

Oyun dizini **569.636 raw / 153.937 yerel gzip bayt**. Portal kabuğu bu toplama dahil değildir. 4.0 tercih edilen gzip sınırı 220 KB’dır; aşıldığında ölçülen gerekçe gerekir.

| Genişlik | Her koşuda gerçek handler örneği | Üç seri koşunun p95 medyanı | p50 medyanı | Yerel FCP medyanı | +%20 p95 sınırı |
| -------- | -------------------------------- | --------------------------- | ----------- | ----------------- | --------------- |
| 1440 px  | 20                               | 14,8 ms                     | 8,6 ms      | 44 ms             | 17,76 ms        |
| 390 px   | 39                               | 15,4 ms                     | 8,6 ms      | 52 ms             | 18,48 ms        |
| 320 px   | 20                               | 15,2 ms                     | 8,4 ms      | 48 ms             | 18,24 ms        |

Bu, aynı makinedeki yerel production sunucusu ve kurulu Chrome’dur. Üç p95’in medyanı kullanıldı; örnekler tek bir havuzun yüzdelik değeri gibi sunulmadı. Handler süresi paint/ağı dışlar; FCP ayrı ölçümdür. Düşük güçlü mobil cihaz veya canlı ağ performansı iddiası değildir. Son sürüm aynı korunmuş Living City akışıyla karşılaştırılmalı; daha kapsamlı yeni 4.0 akışının örnekleri ayrı raporlanmalıdır.

Node24/macOS arm64 üzerinde altı hayatın ayrı zaman ölçümü (katı doğrulama ve değişmez giriş denetimi dahil, gölge tekrar hariç):

| Politika  | 30 gün     | 90 gün         | 180 gün        | 365 gün        | 365 gün kayıt        |
| --------- | ---------- | -------------- | -------------- | -------------- | -------------------- |
| Kariyer   | 347–392 ms | 1.109–1.204 ms | 2.320–2.441 ms | 4.840–4.918 ms | 132.227–132.565 bayt |
| Sosyal    | 558–652 ms | 1.875–1.985 ms | 4.048–4.161 ms | 8.828–9.099 ms | 167.966–169.721 bayt |
| Girişimci | 508–530 ms | 1.745–1.757 ms | 3.642–3.650 ms | 7.573–7.595 ms | 139.453–139.650 bayt |

365. günde GC sonrası tutulan heap farkı 5,17–8,94 MiB; buna testin eylem izi ve dört seri kontrol noktası dahildir, tepe bellek değildir. Ayrı API mikroölçümünde 31 örnek/üç ısınma kullanıldı. 365. gün altı hayatın en yüksek p95’i: eylem listesi 0,39 ms, takvim 0,91 ms, randevu seçenekleri 0,26 ms, çözümleyici 1,56 ms, dışa aktarım 2,89 ms, içe aktarım 2,91 ms, `Map` depoya kayıt/yedek 8,13 ms. Depolama mikroölçümü gerçek disk gecikmesini temsil etmez.

## Özgün 3.0 geçiş kanıtı

Yeni motor yazılmadan **18 özgün 3.0 zarfı** üretildi: üç başlangıç, üç stratejinin 31/91/181/366. günleri ve etkin randevu/proje/işletme. [Provenans](../../scripts/fixtures/boardworld/v3-provenance.json) kaynak commit/ağaç, 18 modül hash’i, fixtür hash/boyutları ve tam gerçek eylem izlerini gösterir. Özgün kayıt yazıcısının hash’i `4f5f40054c82cadaa40915b3d44a8c5b95dd48ee3c0ccf6bbe5c2fbfdb51338e`; testte yalnız motor import yolu güncel, eski şemayı kabul eden doğrulayıcıya yönlendirilir. 1.0/2.0 fixtürleri değiştirilmez.

4.0 kabulü; saf/idempotent geçişte tüm eski alanların aynılığını, retroaktif ücret/faiz olmamasını, ayrı v4 kayıt anahtarını, yazım öncesi özgün v3 bayt yedeğini, gerçek eski 1/2/3 yazıcılarının yeni ilerlemeyi ezememesini ve kota/bozulma/kurtarma davranışlarını sınamalıdır. Bu inceleme bu kapıların sonucu olarak sunulmaz; sonuçlar son kabul kaydında ayrıca yer alır.
