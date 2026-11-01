# TC SIM: Boardworld 3.0 — Yaşayan Şehir kabul kaydı

Bu belge tekrar çalıştırılabilir kayıt, oyun akışı ve performans kanıtını açıklar. Yerel test, GitHub CI ve Cloudflare production yayını ayrı kontrollerdir; bu belge tek başına yayın kanıtı değildir.

## Doğrulanan 2.0 başlangıcı

Başlangıç commit’i `467ef16e9f06ea3089f001592aa13aebd9cc069d`, kaynak değişmeden ayrı bir kopyada çalıştırıldı:

- `npm test`: **2.558 geçti, 0 başarısız, 0 atlandı**; 2.497 JavaScript + 61 TypeScript testi.
- Production build ve typecheck geçti. Lint: **0 hata, önceden var olan 62 uyarı**.
- Gerçek Chromium ile 1440/390/320 px: Deep Life panelleri, iş/işletme/hikâye/rutin, kayıt ve iki sekme denetimleri geçti. Ayrı eski tarayıcı akışı, özgün TC SIM’de karakter oluşturma, eylem, kayıt ve yeniden yüklemeyi doğruladı.
- İlk Git arşivi denemesinde üç test `.git` gerektirdi. Aynı commit’in Git metadata’sı eklenerek bütün testler yeniden çalıştırıldı; yukarıdaki sonuç ikinci, temiz çalıştırmadır.
- Ölçülen 2.0 oyun dosyaları toplamı **390.426 bayt**. 390 px ajanda yaklaşık 3.480 px yüksekliğindeydi; tahta birbirinden ayrı büyük mahalle kartlarıydı. 3.0 gün/hafta şeridi, bağlantılı harita ve bugünün yükümlülükleri bu gözlenen gezinme sorununa yöneliktir.

## Tekrar çalıştırma

```sh
node --test scripts/boardworld-save.test.mjs scripts/boardworld-deep-acceptance.test.mjs scripts/boardworld-living-acceptance.test.mjs
node --expose-gc scripts/boardworld-performance.mjs --output boardworld-performance.json
```

Son kaynakla ilk komut **109 geçti, 0 başarısız, 0 atlandı** sonucunu verdi: 52 kayıt, 44 korunmuş Deep Life kabul ve 13 yeni Yaşayan Şehir kabul testi. Yeni dosyalar da `npm test` kapsamındadır. Takvim/motor/yaşayan dünya odaklı regresyonları ve üç gerçek tarayıcı betiği ayrıca çalıştırılır.

| 2.0 kısıtı                              | 3.0 davranışı                                                                                 | Kanıt kaynağı                                                        |
| --------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Sabit ertesi gün randevusu              | Seçilen tarih/saat/yer, karşı teklif, iptal, yeniden planlama, geç kalma, tekrarlanan taahhüt | `boardworld-calendar.test.mjs`, `boardworld-living-browser.mjs`      |
| Mahalle seçimi ağırlıklı tahta          | Bağlantılar, saatli mekânlar, ulaşım bedeli/süresi, sonraki randevuya yetişme                 | Takvim/yaşayan dünya testleri, üç genişlikte gerçek harita kullanımı |
| NPC değişimleri günlük kurallarda       | Sınırlı karar bütçesi, yer/iş/para kısıtları, karşılıklı temas ve bilgi kaynağı               | `boardworld-living-world.test.mjs`, 90/180 günlük akışlar            |
| Kişisel bütçeden doğrudan mikro işletme | İşletme sermayesi, stok, kapasite, talep, gider, tasfiye                                      | Ekonomi odaklı testler ve girişimci akışı                            |
| Eylem listelerinden ilerleme            | Desteklenen niyetlerden gerçek eylem önerileri, öngörü ve maliyet/bütçe denetimi              | Takvim testleri ve gerçek tarayıcı eylemleri                         |
| 1.0’dan 2.0’a ayrı kayıt                | 1.0/2.0’dan 3.0’a saf geçiş; eski sekmelerden ayrı anahtar                                    | 52 kayıt testi ve iki sekmeli tarayıcı deneyi                        |

## Son depo kapıları

- `npm test`: **2.635 / 2.635 geçti, 0 başarısız, 0 atlandı**; 2.574 JavaScript + 61 TypeScript testi. Süre: yaklaşık 260,2 sn + 0,5 sn.
- Son production build ve typecheck geçti. Tam lint: **0 hata / başlangıçla aynı 62 uyarı**.
- İlk son-sürüm denemesinde sandbox TCP dinleme izni nedeniyle 17 ilgisiz sunucu testi `EPERM` verdi. Yetkili ağ ortamında bütün depo tekrar çalıştırıldı; yukarıdaki sonuç bu temiz tekrarın sonucudur, ilk başarısız deneme gizlenmemiştir.
- Üç production Chromium paketi geçti; ayrıntıları aşağıdadır. Bu yerel kapılar Cloudflare yayını yerine geçmez.

## Gerçek 90 ve 180 günlük hayatlar

[Senaryo yürütücüsü](../../scripts/boardworld-scenarios.mjs) karakter oluşturup yalnız sunulan, önkoşulları sağlanan eylemleri seçer. Uzun koşularda tarih, para, ihtiyaç, NPC, iş, proje veya ilişki alanları doğrudan değiştirilmez. Her çözümlemede girişin değişmediği, durumun geçerli olduğu ve zamanın geri gitmediği denetlenir. İkinci simülasyon aynı eylem/payload dizisini tekrarlar; her 37 eylemde dışa/içe aktarılır ve bütün durum her turda birebir karşılaştırılır.

- Üç başlangıç × iki seed (`7`, `91373`): **altı ayrı 180 günlük hayat**. Her biri 181. güne ulaşır, altı kira dönemi ve en az 120 gerçek vardiya tamamlar; en az 170 uyku, en az üç terfi ve gerçek mağaza → bakım/onarım meslek değişimi içerir. Konut borcu sıfır, sağlık en az 50, kullanılabilir bakiye 5.000 TL üzerindedir. Eğitim projesi tamamlanır, eski iş deneyimi korunur.
- Korunmuş Deep Life kabulünde üç başlangıç × üç seed: **dokuz ayrı 90 günlük hayat** ve aynı kesin kayıtlı tekrar denetimi. On hikâye zincirinin üç aşaması, 7 gün geciken ücretler, yeni kira/iş sözleşmesine eski yararın taşınmaması, borç/faiz/fatura ve rutin sınırları korunur.
- Borçlu `restart` başlangıcı/seed `2026`: **üç farklı 90 günlük strateji**; hepsi gerçek kira ve ihtiyaç ödemeleri yapar, borcu sihirli biçimde silmez. En az on koşullu olay ve yirmi farklı eylem kimliği görülür.

| Strateji     | Gerçek karar karışımı ve doğrulanan sonuç                                                                                                                                                                        |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kariyer      | Mağaza vardiyaları, altı eğitim oturumu, beceri çalışması, kazanılmış terfiler, ayrılma bildirimi ve onarım işine giriş. Mesleki belge ve yeterlilik projesi; iki işte toplam en az dört terfi.                  |
| İlişkiler    | Gelir sağlayan vardiyalar yanında teklif/karşı teklif, mekâna seyahat, en az 12 tamamlanan ve hiç kaçırılmayan buluşma; konuşma, telefon, mentorluk. En az üç güçlü arkadaşlık ve iki tamamlanan ilişki projesi. |
| Girişimcilik | Maaşlı iş olmadan gerçek sermaye aktarma, ücretli stok, müşteri edinme, en az 70 hizmet ve 20 serbest iş teslimi. Pozitif net işletme geliri, sıfır işletme borcu, tamamlanan işletme projesi.                   |

Bu politikalar bütün seçeneklerin en iyi stratejisi olduğu iddiası taşımaz. İş ve uyku hayat simülasyonunun tekrar eden çekirdeğidir; üç yolun gelir kaynağı, zaman ayırdığı eylemler ve sosyal/mesleki sonuçları farklıdır. İncelenen akışlarda tek sıfır-maliyetli para düğmesi veya zorunlu çıkmaz bulunmadı. Hedefli testler ayrıca başarısız teslim, işletme kaybı/ara verme, yetersiz bakiye, borç taksiti, kapanış ve geri dönüş maliyetlerini kapsar.

Her uzun koşuda oyuncu görüşme seçmese de NPC’lerin taşınması, meslek değiştirmesi ve birbirleriyle 50’den fazla teması gözlenir. Planlar NPC başına en fazla 16, günlük kararlar en fazla 4, takvim geçmişi en fazla 96 kayıtla sınırlıdır. Bunlar son durum farkından çıkarım değil, her eylem arasında gözlenen değişimlerdir.

## Atomiklik ve bulunup düzeltilen sınırlar

- Erken katılım, gerçek ayrılmış bitiş saatine kadar sürer. NPC bütün aralıkta meşgul kalır; aradaki gün/saat sınırı onu ikinci görüşmeye açmaz. Tamamlanma ve ücret ikinci tıklama veya yeniden yüklemede tekrarlanmaz.
- Eski 2.0 randevusunun ücretsiz olması, ±30 dakika katılım penceresi ve başlangıçtan sonraki 60 dakikalık kaçırma süresi korunur. Güncel toplantının ücreti ayrı ve gerçek maliyettir.
- Gerçek ücretli toplantıda 55 TL’lik proje bütçesi sınırı sınanır: 54 TL kalan bütçe eylemi para/zaman/takvim/geçmiş değişmeden reddeder; 55 TL izin verir ve gideri bir kez yazar. Ücretsiz eski randevu sıfır proje bütçesinde hâlâ yapılabilir.
- Gelecekteki iki etkinlik arasındaki ulaşım, planı yazdığımız saatin değil önceki etkinliğin gerçek çıkış saatinin yoğunluğuna göre hesaplanır. Reddedilen/karşı teklifli yeniden planlama, eski kesin randevuyu onay gelmeden silmez.
- NPC özel hayat değişimi, yalnız iç durum değişti diye oyuncu hafızasına yazılmaz. Gözlem veya gerçek haberleşme gerekir. Oyuncuya açık okuma modeli NPC nakit, borç ve özel değişim listesini göstermez.
- İşletme hesabına para koyup çekmek toplam servet yaratmaz. Stok alınırken malzeme bedeli bir kez ödenir; hizmette tekrar aynı malzeme kesilmez. Tasfiye gerçek sermaye, stokun sınırlı geri alım değeri, kuruluş bedelinin sınırlı kısmı ve borçla hesaplanır; ikinci kapanış reddedilir.
- Takvim ileri sarma ve rutin, olay/karar veya zorunlu mali sınır öncesinde durur. Öngörü de eylem de giriş durumunu değiştirmez.

Belirli sınırları yalıtan kısa testlerde geçerli bakiye, beceri veya koşul fixtürü kullanılabilir. Bu hazırlıklar kazanılmış ilerleme sayılmaz; yukarıdaki uzun hayatlar bütünüyle gerçek eylemlerden oluşur.

## Gerçek eski kayıtlar ve sekme izolasyonu

[2.0 provenansı](../../scripts/fixtures/boardworld/v2-provenance.json), kaynak commit’ini, özgün modüllerin SHA-256 değerlerini, fixtür bayt/hash değerlerini ve oynanan eylemleri içerir. Yeni motor yazılmadan özgün 2.0 modülleriyle **13 kayıt** üretildi: üç ilk gün, üç başlangıcın 46. ve 91. günleri, seçilmiş aktif randevu ve onun gerçek tamamlanmış/iptal/kaçırılmış sürümleri. Önceden dondurulan gerçek 1.0 fixtürleri de korunur.

[Dondurulmuş 2.0 kayıt modülünün](../../scripts/fixtures/boardworld/v2-persistence.mjs) yalnız motor import yolu değişiktir; bu yol normalleştirildiğinde SHA-256 `102f47418039047994a86639fa6d9376dd1bf689729775530f331880b1f59c7e` olmalıdır. Test bunun yanında gerçek 1.0 yazıcısını da çalıştırır; eski yazıcı davranışı taklit edilmiş bir stub değildir.

| Anahtar                                 | Davranış                                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------------------------- |
| `tariklab.boardworld.v3` / `.v3.backup` | Yalnız yeni 3.0 yazımları; sağlıklı ana kayıt, sonra sağlıklı dönüşümlü yedek önceliklidir. |
| `tariklab.boardworld.v2` / `.v2.backup` | Yalnız okunur; eski sekmenin yazımı 3.0 kopyalarını değiştiremez.                           |
| `tariklab.boardworld.v1` / `.v1.backup` | Yalnız okunur; erken önizlemede bu anahtara yazılmış geçerli 2.0 zarfı da desteklenir.      |
| `.v2.original-v2` / `.v1.original-v1`   | İlk korunan özgün dosyanın aynı baytları; hiçbir sonraki tur bu yedeği döndürmez.           |

Kaynak checksum ve kaynak sürümün katı şeması **geçişten önce** doğrulanır. Geçiş saf ve idempotenttir; eski alanları korur, zamanı ilerletmez, geçmiş ücreti/faizi yeniden ödemez. Yeni `calendar`, `city`, `living` alanları eklenir. Eski randevu tarihi, süresi, semti ve durumu korunur.

Eski kayıt yüklenirken ilk kullanıcı eylemi beklenmeden özgün baytlar arşivlenir ve ayrı 3.0 alanı yazılıp geri okunur. Kota/erişim/sessiz yazma hatasında korunduğu iddia edilmez; kaynak eski alanlar değişmeden bellek durumu ve açık uyarı döner. Sağlıklı 3.0 yüklemesi salt okunurdur; ilgisiz bozuk eski dosya onu engellemez.

Kurtarma sırası: 3.0 ana/yedek → 2.0 ana/yedek/özgün → 1.0 ana/yedek/özgün. Eski revizyon daha yüksek olsa bile sağlıklı 3.0 kazanır. Her iki güncel kopya bozuksa eski kayda dönüşün daha yeni ilerlemeyi içermeyebileceği açıklanır. İki eski gerçek yazıcıyla tekrar tekrar yazımdan sonra 3.0 ana/yedek ve özgün arşivler aynı baytlarda kalır. Mevcut TC SIM’in ayrı anahtarlarına dokunulmadığı ayrıca denetlenir.

## Ölçüm yöntemi ve sonuçlar

Ölçümler Node 24.21.0 / macOS arm64 üzerinde yapılır. Her API için üç ısınmadan sonra 31 örnek alınır; p95 tabloya raporlanır. API ölçümleri hayat bittikten sonra alınır; toplam simülasyon süresine eklenmez. Süreler eylem seçimi, katı doğrulama, giriş değişmezliği denetimi ve dönemsel GC içerir; tarayıcı çizim/ağ süresi değildir. İlk gün henüz karşılama kartı açıktır, bu yüzden `getActions` özellikle ucuzdur.

Son kaynakta 18 oyun dosyası **569.636 raw bayt / 153.937 yerel gzip bayt**: 2.0’a göre +179.210 bayt, **%45,9 artış**. Yeni takvim/şehir/NPC/proje motorları, kompakt harita ve ajanda arayüzü bu artışın karşılığıdır; büyük resim paketi, yeni bağımlılık veya 3D motor eklenmedi. Bu toplam oyun dizinidir; ortak TarikLab portal kabuğunun ilk yükleme ağı bu sayıya dahil değildir.

| Strateji     | 30 gün | 90 gün   | 180 gün  | 180 gün eylem | 180 gün kayıt | GC sonrası tutulan heap farkı (180 gün) |
| ------------ | ------ | -------- | -------- | ------------- | ------------- | --------------------------------------- |
| Kariyer      | 449 ms | 1.335 ms | 2.721 ms | 1.006         | 129.481 bayt  | 7,66 MiB                                |
| İlişkiler    | 708 ms | 2.314 ms | 5.490 ms | 1.637         | 147.369 bayt  | 5,67 MiB                                |
| Girişimcilik | 540 ms | 1.857 ms | 3.902 ms | 1.607         | 136.063 bayt  | 5,15 MiB                                |

Kayıtlar ilk gün 37.414 bayt; 30 gün sonunda 97.999–102.623, 90 gün sonunda 117.849–130.618 bayttır. 2.0’ın önceki dokuz basit çalışma hayatı ölçümünde 30/90/180 gün sırasıyla 192–266 / 734–824 / 1.615–1.718 ms; 180 günlük kayıt 72.086–74.585 bayttı. O ölçüm birebir gölge tekrar içerirken 3.0 performans koşusu içermez ve stratejileri farklıdır; bu sonuçlar aynı iş yükünde hızlanma/yavaşlama oranı olarak yorumlanmaz. Kesin tekrar ayrı kabul testinde doğrulanır.

Aşağıdaki değerler üç stratejinin **en yüksek p95 API süresi**, milisaniyedir. 91. ve 181. gün satırları sırasıyla 90 ve 180 tamamlanmış günü ifade eder.

| Oyun günü | Eylem listesi | Takvim görünümü | Randevu seçenekleri | Eylem çözümü | Dışa aktar | İçe aktar | Kayıt + yedek |
| --------- | ------------- | --------------- | ------------------- | ------------ | ---------- | --------- | ------------- |
| 1         | <0,01         | 1,36            | 0,27                | 0,60         | 0,75       | 0,71      | 2,24          |
| 31        | 0,51          | 0,97            | 0,13                | 1,33         | 1,77       | 1,86      | 6,47          |
| 91        | 0,60          | 0,99            | 0,20                | 2,11         | 2,10       | 2,43      | 6,56          |
| 181       | 0,56          | 1,48            | 0,23                | 1,70         | 2,93       | 2,68      | 7,73          |

Bu örneklerde bir ek önbellek veya bağımlılığı gerektiren darboğaz görülmedi. Kayıt mikroölçümü `Map` tabanlı depolama ile doğrulama/seri hale getirme/yedekleme kodunu kapsar; gerçek disk gecikmesi ve tarayıcı localStorage davranışı ayrıca iki sekmeli Chromium testinde sınanır. Performans betiği tüm oyun dosyalarının raw/gzip boyutlarını ve SHA-256 değerlerini, 30/90/180 günlük eylem dağılımını, kayıt boyutunu, ayrı API örneklerini ve GC sonrası tutulan heap değişimini JSON olarak üretir. Tutulan heap; testin eylem izini ve en fazla üç seri hale getirilmiş kontrol noktasını içerir; **tepe bellek ölçümü değildir**. Yerel gzip boyutu, gerçek ağ aktarım miktarı olarak sunulmaz.

## Üretim çıktısında gerçek tarayıcı kabulü

Üç Chromium betiği son production build ile **1440, 390 ve 320 px genişliklerin tamamında geçti**. Sunulan 18 oyun dosyası kaynakla aynı baytlardadır; toplam 569.636 bayttır. Konsol/çalışma zamanı hatası ve yatay taşma yoktur.

- Temel akış: işe giriş, vardiya, mahalle seyahati, tüm paneller, kayıt/yükleme, dosya aktarımı ve bozuk ana kayıttan yedek kurtarma. Özgün TC SIM’de ayrı gerçek oluşturma/eylem/kayıt/yeniden yükleme kontrolü de geçti.
- Deep Life: eylem öngörüsü, klavyeyle ilişki ağı, rutin ayar/çalıştırma, iki sekme eşitlemesi. 390 px’de gerçek işletme kurma → sermaye → stok → müşteri → hizmet ve geciken hikâye sonucu; 320 px’de azaltılmış hareket denetimi.
- Yaşayan Şehir: bağlantılı tahta ve mekânlar, niyet önerisi, randevu öngörüsü/taahhüt, yeniden planlama, çakışmanın reddi, seyahat/katılım, tekrar ve gerçek proje ilerlemesi. Karşı teklif, kaçırma, geç kalma ve sabit görüşme süresi ayrıntıları 390 px’de ayrıca denendi.
- Gerçek 1.0 ve 2.0 46. gün dosyası aktarımı; değişmez özgün bayt yedeği; ikinci sayfadan iki ayrı eski kayıt yazımının gerçek `storage` olayı; güncel ana/yedek/UI korunması; yeniden yükleme ve güncel 3.0 sekmeler arası ilerleme.

| Genişlik | Gerçek tıklama örneği | Handler p50 | Handler p95 | Yerel ilk içerik çizimi |
| -------- | --------------------- | ----------- | ----------- | ----------------------- |
| 1440 px  | 20                    | 9,5 ms      | 17,3 ms     | 108 ms                  |
| 390 px   | 39                    | 9,4 ms      | 16,8 ms     | 92 ms                   |
| 320 px   | 20                    | 9,5 ms      | 20,9 ms     | 116 ms                  |

Handler ölçümü DOM güncellemesine kadar olan tıklama işleyicisini kapsar, sonraki paint/ağ süresini kapsamaz. İlk içerik çizimi yerel production sunucusunda ölçülmüştür; canlı ağ veya düşük güçlü mobil cihaz performansı iddiası değildir. Bu akışların PR önizlemesi ve production adresinde tekrar geçmesi yayın kapısıdır.

## Sınırlar ve yayın ayrımı

- 12 önemli NPC ayrıntılı simüle edilir; arka plan nüfusu 450 kişi / 240 hanelik toplulaştırılmış modeldir. Her vatandaşın ayrı tam yapay zekâsı olduğu iddia edilmez.
- Takvim oyun günlerini/dakikalarını kullanır. Semt mesafeleri, yoğunluk, fiyatlar ve istihdam oyun değerleridir; canlı İstanbul ulaşım/ekonomi verisi değildir.
- Niyet oluşturucu sınırlı, doğrulanan eylemler önerir. Serbest dilde sınırsız davranış veya haricî LLM servisi yoktur.
- Kayıt tarayıcıya ve indirilen dosyaya dayanır; cihazlar arasında kendiliğinden bulut eşitlemesi sağlamaz.
- Oyun Türkçedir; ses kapalı, native/Godot çalışması duraklatılmıştır. Paylaşılan sanat varlıkları değişmemiştir.
- Senaryo ve sınır testleri bütün olası kombinasyonların matematiksel ispatı değildir. Tam depo test/build/typecheck/lint, production Chromium, PR CI, gerçek merge SHA ve Cloudflare aktif sürümü yayın sırasında ayrıca doğrulanır.
