# TC SIM: Boardworld 2.0 — Deep Life kabul kaydı

Bu belge, 2.0 kayıt geçişinin ve birbirine bağlı simülasyonun otomatik kabul kanıtını açıklar. Tarayıcı, production build, GitHub CI ve Cloudflare dağıtım sonuçları ayrıca doğrulanır; bu testlerin geçmesi tek başına yayın kanıtı değildir.

## Başlangıç ve doğrulanabilir komut

- Başlangıç: `main` commit `977cd576dc535f1e65d2e5589e8d4168a65a8e17`.
- Değişikliklerden önce `npm test`: **2.475 geçti, 0 başarısız** (2.414 JavaScript testi ve 61 TypeScript testi).
- Bağımsız 2.0 kayıt/kabul kontrolü: **66 geçti, 0 başarısız** — 44 Deep Life kabul testi, 22 kayıt testi.

```sh
node --test scripts/boardworld-save.test.mjs scripts/boardworld-deep-acceptance.test.mjs
```

Test kaynakları: [kayıt testleri](../../scripts/boardworld-save.test.mjs), [Deep Life kabul testleri](../../scripts/boardworld-deep-acceptance.test.mjs). Bunlar `npm test` tarafından da çalıştırılır. Ayrıca [motorun odaklı regresyonları](../../scripts/boardworld-deep.test.mjs) ve [mevcut Boardworld motor testleri](../../scripts/boardworld-engine.test.mjs) korunur.

## 90 günlük gerçek eylem akışları

Üç başlangıç (`newcomer`, `graduate`, `restart`) × üç seed (`7`, `2026`, `91373`) ile **dokuz hayatın her biri 91. güne ulaşır**. Testler bu akışlarda tarih, para, ihtiyaç, NPC, iş, hikâye veya ilişki durumunu doğrudan değiştirmez. Karakter oluşturulur; yalnızca motorun sunduğu uygun eylemler seçilir.

Her hayat için doğrulananlar:

- En az 65 tamamlanmış iş vardiyası ve 80 gerçek uyku eylemi.
- Deneyim ve beceriyle kazanılmış iki terfi, mağaza kariyerinin son seviyesi.
- Üç kira dönemi; kira birikimi sıfır; sağlık en az 50; kullanılabilir bakiye 8.000 TL üzerinde.
- En az on çözümlenmiş koşullu olay, geçerli ve sınırları korunan tüm simülasyon durumu.
- Oyuncu konuşma eylemi seçmeden 12 NPC’nin hayatının değişmesi; kendi birikimleri ve kayıtlı geçmişleri; çalışma boyunca gözlenen bağımsız taşınma ve meslek değiştirme.
- Aynı eylem dizisinin ikinci bir simülasyonda tekrarı. İkinci hayat her 37 eylemde dosyaya aktarılıp geri yüklenir ve **her turda bütün durum ilk hayatla eşit** kalır.

Taşınma kontrolü yalnızca ilk ve son semti karşılaştırmaz: bir NPC dönem içinde birkaç kez taşınıp ilk semte dönebilir. Gerçek semt değişimleri eylemler arasında gözlenir.

## Hikâyeler ve gecikmiş sonuçlar

Aşağıdaki on zincirin üç aşaması gerçek eylemlerle sırayla tamamlanır. Bekleme sırasında normal yemek, uyku, iş ve zaman eylemleri kullanılır. Erken seçim, eski aşamayı tekrar seçme ve tamamlanmış zinciri yeniden çalıştırma reddedilir.

| Zincir                       | Denenen seçim yolu                                |
| ---------------------------- | ------------------------------------------------- |
| Aynı çatının altında         | bakım payı → kontrol → tutanak                    |
| Bir portfolyonun yolculuğu   | ücretli pilot → teslim → yayımlama                |
| Bir sofradan mahalleye       | hazırlık → organizasyon → çevre                   |
| Öğrenciden yol arkadaşına    | hazırlık → öğretme → referans                     |
| Borçtan çıkış rotası         | paylaşım → gerçek anapara ödemesi → değerlendirme |
| İş yerinde söz hakkı         | konuşma → ekip planı → kariyer kaydı              |
| Ritmini yeniden bul          | dinlenmeyi erteleme → toparlanma → bakım planı    |
| Adres değişir, çevre değişir | karşılaştırma → mevcut mahalle → değerlendirme    |
| Yakınlığın sınırları         | arkadaşlık → açık bildirim → sınırları kabul      |
| İlk müşteriden itibara       | sipariş → teslim → referans                       |

İki ücretli zincirde ödeme ayrıca karşılaştırılır: pilotun **1.200 TL** ve ilk müşterinin **650 TL** ücreti yalnızca ücretli sözleşmenin gerçek tesliminden **yedi gün sonra** bankaya gelir. Ücretsiz çalışma yolu aynı ücreti kazanmaz. Yükleme, bekleme veya tekrar tıklama ikinci ödeme üretmez.

Konut ve iş sonuçları sözleşme kimliğine bağlıdır. Başka eve taşınıp aynı konut türüne dönmek eski bakımın konforunu yeni kiraya taşımaz. İstifa edip aynı mesleğe yeniden girmek eski iş sözleşmesinin bekleyen performans primini yeni sözleşmeye taşımaz.

## Ekonomi, kariyer ve sosyal nedensellik

| Alan                  | Doğrulanan davranış                                                                                                                                                                                                                 |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Acil durum fonu       | Gerçek kullanılabilir bakiye azalır; toplam servet değişmez; çözüm yalnız bir kez yapılabilir.                                                                                                                                      |
| Manuel faturalar      | Kira ve elektrik/su/telefon ayrı vadelerdir. Ödenen kira tekrar borç olmaz; yedi günlük süreden sonra ödenmeyen fatura bir kez borca eklenir.                                                                                       |
| Borç planı            | Sözleşme gideri ödenir; haftalık ödeme anaparayı gerçekten azaltır; kalan anaparaya %2 faiz uygulanır. İki karşılanamayan taksit planı sonlandırır, anaparayı silmez.                                                               |
| Üç serbest iş         | Ekipman, beceri ve semt koşulları; üç gerçek çalışma oturumu; teslimden önce ödeme yok; teslim sonrasında ücret; tekrar ödeme yok; yeni iş için bekleme. Kaçırılan teslim, gider ve itibar kaybı yaratır.                           |
| Mikro işletme         | Sermaye, ücretli müşteri edinimi, malzeme ve hizmet süresi; günlük hizmet/edinim sınırları. Açık kalınan sürede sabit gider birikir. Ara verip açmak borcu veya vade saatini sıfırlamaz. Aç-kapat döngüsü sermaye kaybettirir.      |
| Semt stratejisi       | Aynı eylemin gerçek lokanta bedeli, uygun işletmenin hizmet geliri ve haftalık gideri semte göre değişir.                                                                                                                           |
| Kariyer               | Çalışılan vardiyalar itibar ve deneyim üretir. Müzakere nakit vermez; sonraki gerçek vardiyaya ücret eki getirir. Bildirim sonrası istifada kazanılmış maaş ve meslek deneyimi korunur; yeni iş eski sözleşmenin primini devralmaz. |
| NPC bilgisi           | Başlangıçta oyuncunun mali/mesleki bilgisi bilinmez. Açıklama yalnız ilgili NPC’yi bilgilendirir. Yakın ve güçlü bir sosyal bağ bilgiyi daha sonraki temas gününde, kaynağıyla öğrenebilir.                                         |
| Oyuncunun yardım sözü | Tutmak zaman ve para harcatır; NPC’nin gerçek nakit/becerisini ve güvenini artırır. Tutmamak güveni düşürür, kırgınlık ve kalıcı bilgi/hafıza bırakır.                                                                              |
| NPC’nin destek sözü   | Para söz verildiğinde oluşmaz. Vadesinde NPC’nin kendi bütçesinden çıkar. İşsiz ve nakitsiz NPC sözünü tutamayabilir.                                                                                                               |

Bu kısa hedefli testlerin bir bölümü, belirli koşulu izole etmek için geçerli başlangıç fixtüründe beceri, bakiye veya tarih kurar. Bu hazırlıklar kazanılmış ilerleme olarak sunulmaz. Sonraki eylemler, bekleme süreleri ve sonuçlar gerçek genel motor API’sinden geçer. 90 günlük dayanıklılık hayatlarında böyle bir hazırlık yoktur.

## Rutin ve karar önizlemesi

- Normal eylem çözümleyicisini kullanır; ayrı bir para/zaman sistemi çalıştırmaz.
- Tek gün isteği 24 saati aşmaz; bir çalıştırma en fazla 96 eylem içerir.
- Olay veya hikâye kararlarını oyuncu adına seçmez. Randevu ve verilen söz sınırında durur.
- Alışveriş kadar gece yarısı gelecek kira, fatura ve diğer mali sonuçlar da bütçe kontrolüne dahildir. Bütçe tabanını aşacak aday eylem uygulanmadan durulur.
- Çalıştırma ve önizleme giriş durumunu değiştirmez; sonuç yeni durum olarak döner.

## Özgün 1.0 kayıtları ve kurtarma

[Fixtürler](../../scripts/fixtures/boardworld/) 1.0 üretim commit’inin değiştirilmemiş motor/kayıt modülleriyle üretilmiştir. [Provenans](../../scripts/fixtures/boardworld/v1-provenance.json) kaynak commit’i ve ilerletilmiş hayatın tam eylem dizisini içerir:

- Üç başlangıcın ilk gün kayıtları.
- İkinci başlangıçtan 46. güne oynanmış kayıt: **268 gerçek eylem, 37 vardiya, iki terfi**.

Geçişte eski alanlar `version` dışında korunur; yeni `deep` ve `stories` alanları eklenir. Geçiş saf ve tekrarlanabilir; zamanı, maaşı veya olay ödülünü yeniden işletmez. Eski checksum ve eski şema, yeni varsayılanlar uygulanmadan önce doğrulanır.

Tarayıcı anahtarı değişmez:

| Anahtar                              | İşlev                                                                              |
| ------------------------------------ | ---------------------------------------------------------------------------------- |
| `tariklab.boardworld.v1`             | Ana kayıt; yeni yazımın zarf sürümü 2.                                             |
| `tariklab.boardworld.v1.backup`      | Önceki sağlıklı kaydın dönüşümlü yedeği.                                           |
| `tariklab.boardworld.v1.original-v1` | İlk korunmuş özgün 1.0 dosyasının aynı baytları; tekrar yazılmaz veya döndürülmez. |

Özgün 1.0 yedeği yazılıp geri okunarak doğrulanmadan eski ana kayıt değişmez. Dosya içe aktarma da özgün 1.0 baytlarını korur. Kota veya erişim hatası başarısız olarak bildirilir; sağlıklı kayıt silinmez. Kurtarma sırası ana kayıt → dönüşümlü yedek → özgün 1.0 yedeğidir. Son seçenek ilk korunan 1.0 anına döner; en yeni tur olduğu iddia edilmez.

Desteklenmeyen sürüm, değiştirilmiş checksum, eksik/uygunsuz yeni alan, geçersiz hikâye geçmişi, sahte kimlik, prototip anahtarı, aşırı derin ağaç ve boyut sınırı aşımı reddedilir. Eski TC SIM anahtarları bu modül tarafından okunmaz veya yazılmaz; koruma testi ayrı eski TC örneğinin baytlarını denetler.

## Sınırlar

- Bu kayıt sistemi tarayıcıya ve dışa aktarılan dosyaya dayanır; tek başına cihazlar arasında bulut eşitlemesi sağlamaz.
- NPC kararları ve fiyatlar yazılmış deterministik oyun kurallarıdır. Haricî yapay zekâ servisi veya canlı ekonomik veri kullanılmaz.
- Oyun içeriği Türkçedir. Ses kapalıdır; native/Godot çalışması başlatılmamıştır.
- Otomatik test kapsamı yukarıdaki akışları doğrular; tüm olası eylem kombinasyonları için matematiksel eksiksizlik iddiası değildir.
