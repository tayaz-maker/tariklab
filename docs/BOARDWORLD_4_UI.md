# Boardworld 4.0 — arayüz ve gerçek oyuncu akışı doğrulaması

Bu rapor oyun arayüzünün kapsamını, gerçek DOM etkileşimlerini ve ölçüm sınırlarını kaydeder. Simülasyon sonuçları, tüm ailelerin uzun süreli kabulü ve yayın kanıtı ayrı test/release kayıtlarına aittir.

## Yapı ve uygulanan bağlantılar

- Mevcut 13 bölüm ve `data-tab`/`data-action` test kancaları korunur. Yeni sistemler Şehir, Ajanda, Yaşam, Telefon, Kariyer, Hikâyeler ve Günlük içine yerleşir; yeni bir bölüm yığını oluşturulmaz.
- Şehir tahtası aynı hafif SVG mimarisini kullanır. Semt seçimi, iki doğrudan ulaşım düğmesi, mevcut konumda uygulanabilen iş/bakım hamleleri, açık mekânlar, yol süresi/bedeli ve semt koşulları gerçek eylem tanımlarını kullanır. Mobilde konum ve sıradaki sorumluluklar görünür kalır.
- Ajandada önce seçili politikaların özeti ve bir gün/en çok bir hafta yürütme düğmeleri yer alır. Öğün, ulaşım, pratik, günlük sınır, uyku, mevcut işletme hizmeti, ev işleri, nakit tamamlama ve haftanın günleri yalnız sonlu motor seçenekleriyle değişir. Eski iş/ders/alışveriş/bütçe kontrolleri korunur. Uzun plan kurulumunda öğün/ulaşım/nakit tercihini açıkça seçme hatırlatması vardır; banka bakiyesi nakit yerine kendiliğinden harcanmaz ve otomatik nakit tercihi oyuncu adına açılmaz. Gerçek gerçekleştirilen/atlanan işler ve durma nedeni okunabilir.
- `Takvime plan ekle` formu, `Günü / haftayı gör` takvimi doğrudan açar ve klavye odağını taşır. Bu gezinme zaman veya simülasyon durumunu değiştirmez. Form ile politika kontrolleri aynı ajandada kalır.
- Sistemik kartlar `neden şimdi`, bilinen kaynak/kişiler, konum, son karar zamanı, gerçek seçenekler, öngörü ve biriken sonuçları gösterir. Günlük, aynı olay kimliğine bağlı nedensel geçmişi gösterir. Bir karar otomatik verilmez.
- Yaşam paneli gerçek ortak yaşam sözleşmesini, başka kişiye ait emanet depozitoyu, kira/fatura paylarını, bakım tarihlerini, geçmişi, açık alacakları ve kira uyuşmazlığını gösterir. Çok sayıda davet alternatifi tek bir seçim alanında incelenir; seçilen gerçek teklifin koşulları ve bedeli görünürdür.
- Telefon, sabit karakterlerin rollerini ve en fazla altı kalıcı yeni tanışıklığın yalnız kamuya açık/bilinen profilini gösterir. Yeni kişilerle arama, konuşma ve role bağlı gerçek eylemler kullanılabilir; özel bakiyeler profillere taşınmaz.
- Kariyer paneli işveren ihtiyacı, açıkça kabul edilen ek süre/ücret ve değerlendirme geçmişini sunar. Günlük ihtiyaçlar kompakt satırlardır; tam açıklama/eksik koşullar açılabilir, gerçek eylem ve öngörü düğmeleri görünür kalır.
- İlk yedi oyun gününde açılabilir `İlk 5 dakikan` rehberi gerçek iş, rutin denemesi, takvim ve proje durumundan türetilir. Gizli ödül veya ayrı öğretici oyun durumu yoktur. Mobilde gizlenen yinelenen yan sütunun karakter bilgileri menüdeki `Karakter kartın` üzerinden erişilebilir.
- Bütün oyun yazımları `resolveAction` üzerinden geçer. Arayüz yeni alanlar için `getEmergentView`/`getLifeView` okur. Saf görünümler ve eylem listesi değişmez durum nesnesine göre önbelleklenir; ilgisiz panellerin görünümleri hesaplanmaz. Yeni çerçeve, bağımlılık, ses veya büyük görsel eklenmemiştir.

## Kontrollü 3.0 / 4.0 karşılaştırması

Başlangıç: aynı `restart` senaryosu, Deniz, lise/dengeli, seed 2026, aynı ücretsiz başlangıç kartı seçimleri. Oyun saati, konum, nakit, banka ve oyuncu alanları birebir karşılaştırıldı. Yeni bağlamlar kullanıldı. Aşağıdaki tabloda her iki sürümde de sonuç şeridi kapalıdır; sayılar belge başlangıcından CSS pikselidir. Eski ölçümde şerit açıkken alınan Y756/Y864 ile yeni şeritsiz görüntü doğrudan karşılaştırılmadı.

| Ölçüm                           | 1440 px: 3.0 → 4.0 | 390 px: 3.0 → 4.0 | 320 px: 3.0 → 4.0 |
| ------------------------------- | ------------------ | ----------------- | ----------------- |
| Harita başlangıcı               | 546 → 411          | 654 → 392         | 743 → 397         |
| Harita yüksekliği               | 619 → 485          | 653 → 420         | 723 → 429         |
| İlk bir günlük rutin düğmesi    | 2160 → 587         | 2625 → 568        | 3122 → 643        |
| Şehir sayfası toplam yüksekliği | 2082 → 2229        | 3793 → 2650       | 3953 → 2782       |
| Yaşam sayfası toplam yüksekliği | 2872 → 3257        | 5461 → 5547       | 8213 → 5624       |
| Konum göstergesi                | Görünür → görünür  | Gizli → görünür   | Gizli → görünür   |

Sonuç şeridi açıkken harita başlangıcı 1440/390/320 için 3.0'da 633/756/864; 4.0'da 490/489/512 pikseldir. Yeni rehber kapalı halde ölçüme dahildir. İki sürümde de bu örneklerde yatay sayfa taşması yoktur.

390 px'de gerçek DOM olaylarıyla, şehir ekranından başlayarak:

| Görev                                      | 3.0       | 4.0       |
| ------------------------------------------ | --------- | --------- |
| Uygun yerel mağaza işine başvur            | 2 tıklama | 1 tıklama |
| Ölçülen semt kartı yolundan Beşiktaş'a git | 2 tıklama | 1 tıklama |

Her görev sonunda iş veya konum değişimi doğrulandı. Ulaşım satırı, başlangıçta mevcut semt seçiliyken izlenen ölçülmüş yolu anlatır; 3.0'ın bütün olası ekran durumları için evrensel en az tıklama iddiası değildir. Ulaşım iyileştirmesi, gerçek hareket düğmesinin haritadaki bağlantı üzerinde doğrudan ve görünür olmasıdır. Tarayıcının otomatik kaydırması insanın yaptığı ayrı bir hareket gibi sayılmadı. Senaryo testlerinin binlerce resolver çağrısı insan tıklaması olarak adlandırılmadı; 3.0'da da gerçek günlük/haftalık rutin vardır.

Kontrollü kanıtlar çalışma alanında `work/bw4-ui-comparison/result.json`, son gezinme kısayolları dahil 4.0 ölçümleri `work/bw4-ui-final-geometry/result.json` ve aynı dizinlerdeki 1440/390/320 ekran görüntüleridir. Tekrarlanabilir çalışma betikleri `work/bw4-ui-compare.mjs` ve `work/bw4-ui-final-geometry.mjs` olarak tutulmuştur; yayınlanan oyunun parçası değildir.

## Tarayıcı kabulü

`scripts/boardworld-emergent-browser.mjs`, `--serve`, `--base-url`, `--portal` ve `--expected-root` seçeneklerini destekler. Dosyaları `$RUNNER_TEMP/screenshots/boardworld-emergent` altına yazar. Her genişlikte gerçek Chrome ile:

- Üç semt, 13 bölüm, görünür konum, taşmasız yerleşim; haritadan tek gerçek ulaşım düğmesi ve motor öngörüsüyle aynı para/zaman farkı.
- En az 20 gerçek politika değişikliği; gün düğmesini klavyeyle değiştirme; takvimin gün/hafta görünümünü Enter ile çalıştırma; yeni randevu kısayolunun doğru odağı taşıması ve durumu değiştirmemesi.
- Karakter menüsü, açılabilir ihtiyaç koşulları, dosya kaydı ve aynı durumla yeniden yükleme; 320 px'de azaltılmış hareket tercihi.
- Gerçek değişmez 3.0 91. gün kaydını dosya seçicisinden yükleme; birebir eski baytların arşivlenmesi; ikinci sekmeden iki eski 3.0 yazımının gerçek `storage` olayları; güncel 4.0 bellek/ana kayıt/yedek korunması; yeniden yükleme ve güncel sekmeler arası eşitleme.
- Uygun zaman penceresi beklenerek gerçek ev arkadaşı daveti; emanet depozitonun oyuncu harcanabilir bakiyesine eklenmemesi; etkin sözleşmeyle kayıt/yükleme; açık ayrılık ve aynı depozitonun ikinci kez iade edilememesi.
- Gerçek mekân ziyaretleriyle kalıcı sakin terfisi; halka açık profil ve gerçek telefon konuşması.
- Eski kayıttaki mevcut görüşme için gerçek mekâna gidip katılma; daha sonra yaşam koşullarının ürettiği iş olayı; sebebin kartta bulunması, öngörünün salt okunur olması, rutinin kararın üzerinden atlamaması ve gerçek seçimin nedensel geçmişe yazılması.

Kaynak arayüz kabulü `work/bw4-ui-verified/screenshots/boardworld-emergent/result.json` altında geçti; konsol/asset hatası görülmedi. Önceki çekirdek ve derin yaşam tarayıcıları da 1440/390/320'de geçti (`work/bw4-ui-core`, `work/bw4-ui-deep`); eski iş/vardiya/seyahat, iş kurma, hikâye gecikmesi, ağ klavyesi, rutin, dışa/içe aktarma, yedek kurtarma ve 1.0 geçiş kapsamları kaldırılmadı. Nihai build ve canlı dağıtım tekrarları release sürecinde ayrıca yapılmalıdır.

## Okunabilirlik ve ölçüm sınırı

Oyun ve kendi pencerelerinde kullanılan ana palette kağıt zemin üzerinde ölçülen kontrast: ana yazı 12.19:1, ikincil yazı 4.92:1, uyarı 4.75:1, koyu sarı vurgu 4.71:1, yeşil 5.29:1. Eski ikincil yazı 4.32:1 ve uyarı 3.61:1 olduğu için yalnız Boardworld'e ait renk değişkenleri koyulaştırıldı. Bu, bütün olası dinamik durumların bağımsız erişilebilirlik sertifikası değildir. Yeni düğme/seçim/özet hedefleri en az 44 CSS piksel yüksekliği, görünür klavye odağı ve azaltılmış hareket desteği kullanır.

Tarayıcı raporu her 24 oyun dosyasının ham/gzip boyutunu ve SHA-256 değerini kaydeder. Genişletilmiş 4.0 betiğinin politika ağırlıklı gecikme örnekleri eski Living City akışıyla aynı iş yükü değildir; bunlar birbirine karşı hızlanma kanıtı olarak kullanılmaz. Karşılaştırılabilir seri Living City p95 ve nihai sıkıştırılmış yük ölçümü ayrı kabul/performance raporundadır.

## Açık sınırlar ve tasarım bedelleri

- Şehir üç semtli şematik bir oyun tahtasıdır. Harita/fiyatlar canlı ulaşım servisi değildir. Niyet araması desteklenen sonlu eylemler içindir.
- Yeni kalıcı sakinler telefon/sohbet/rol/hane eylemlerine sahiptir; ayrıntılı saat önerme formu mevcut 12 ana karakterle sınırlıdır. Bu kısıt arayüzde gizli sahte takvim düğmesiyle örtülmez.
- Ajandaya yeni politika kontrolleri eklenmiştir; ayrıntılı form sayfada daha aşağıdadır. Görünür `Takvime plan ekle` kısayolu formu bir tıklamayla açıp odağı taşır. Tam ajanda yüksekliği mobilde 3.0'dan daha kısa olduğu iddia edilmez.
- Yaşam paneline iki gerçek sözleşme dosyası eklendiği için 390 px'de toplam uzunluk hafif artar; 320 px'de kompakt ihtiyaç satırları belirgin düşüş sağlar. Bütün bölümlerin her durumda kısaldığı iddia edilmez.
- Mobilde 13 ana bölüm yatay kaydırılabilir. Sonuç ve açıklamalar korunur; ağır bir harita motoru veya okunamayacak yazı küçültmesi kullanılmaz.
- Kayıtlar tarayıcıya aittir; cihazlar arası aktarım dosya dışa/içe aktarmayla yapılır. Bu rapor tek başına GitHub CI veya Cloudflare production başarısı anlamına gelmez.
