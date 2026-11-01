# Boardworld 5.0 — bağımsız kabul kanıtları

Bu kayıt yeni kaynak üzerinde yeniden üretilen kabul ve performans kanıtlarını içerir. Son üretim derlemesi, tam repo testleri ve eş cihaz tarayıcı/API ölçümleri tamamlandı. PR/merge ve Cloudflare üretim kanıtları yayın sırasında ayrıca doğrulanır. Önceki sürüm raporları yeni sürümün testi olarak kullanılmaz.

## Kaynak ve kayıt uyumluluğu

Başlangıç `c2e7f352d471b819c6d955b6ff106aaf3b26226c`, ağaç `6a83d1a4c14503e6bee5ef4a2421e2f35b80b745`. Yeni P0 ölçümü: 2.748 test, typecheck/build başarılı; lint 0 hata, aynı 62 eski uyarı. Canlı 24 dosyanın SHA256 değerleri başlangıç kaynağıyla aynıydı; gerçek üretim tarayıcısında 4.0 ve özgün TC SIM kayıt/yükleme akışları yeniden çalıştırıldı. Ayrıntılar `BOARDWORLD_5_BASELINE.json` ve `BOARDWORLD_5_AUDIT.md` içindedir.

Kanonik kayıt `tariklab.boardworld.v5` ve `.backup` kullanır. 1/2/3/4 ana ve yedek alanları salt okunur; özgün dosya baytları ilk yeni yazımdan önce kendi değişmez arşivine alınır. Eski kayıt yükleme yeni kanonik alanı dönüşten önce oluşturur. Açık kalan gerçek 1/2/3/4 yazıcıları yeni ilerlemeyi değiştiremez. Toplam 20 gerçek 4.0 zarfı ve altı 365 günlük eylem izi, donmuş kaynak/yazıcı hashleriyle `scripts/fixtures/boardworld/v4-provenance.json` altında korunmuştur. İlk sürümlerden gelen özgün testler kaldırılmadı.

110 kayıt testi; tam eski alan koruması, saf/idempotent geçiş, özgün checksum ve şema doğrulaması, kota ve sessiz yazım hataları, yedek önceliği, bozuk ithalat, gerçek eski yazıcıların iç içe çalışması ve aynı nesnenin sonradan değiştirilmesine karşı her çağrıda yeni doğrulama içerir. Önbellek düzeltmesinden sonra 110 kayıt + 11 bağımsız kabul testi birlikte geçti (121/121). Yeni kontroller aynı checksum taşıyan değiştirilmiş zarfı, üç girdilik sınırdan atılan eski baytların tekrar doğrulanmasını ve yüklenen nesnelerin birbirinden bağımsızlığını doğrular.

## Sürüm uyumluluk matrisi

| Kaynak |          Gerçek özgün zarf | Geçiş ve özgün arşiv                                                         | Eski açık sekme / yeni kayıt                                                                   |
| ------ | -------------------------: | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 1.0    |                          4 | Özgün checksum/şema, saf ve idempotent 5.0 geçişi; `v1.original-v1` değişmez | Gerçek donmuş 1.0 yazıcısı v5 ana/yedeği değiştiremez                                          |
| 2.0    |                         13 | Aynı koruma; randevu ücret/grace bilgisi ve `v2.original-v2` korunur         | Gerçek 2.0 yazıcısı izole; tarayıcıda eski yazım olayları, reload ve yeni sekme eşitleme geçer |
| 3.0    |                         18 | Aynı koruma; takvim/proje/işletme ve `v3.original-v3` korunur                | Gerçek 3.0 yazıcısı izole; tarayıcı geçiş/kayıt akışı korunur                                  |
| 4.0    |                         20 | Aynı koruma; aktif ortak ev/sistemik sonuçlar ve `v4.original-v4` korunur    | Gerçek 4.0 yazıcısı izole; yeni Society tarayıcı akışında doğrulanır                           |
| 5.0    | Yeni durum + uzun hayatlar | Her içe aktarma/yükleme ayrı doğrulanmış nesne; tam RNG/durum gidiş-dönüşü   | Kanonik `v5`, dönen `.backup`, bozuk ana kayıt kurtarması ve güncel sekme eşitlemesi           |

Tablodaki anahtarlar `tariklab.boardworld.` öneki kullanır. Bütün eski ana/yedek yuvalar salt okunur kalır. İlk yükleme korumalı v5 yazımını dönüşten önce yapar; kota/sessiz yazım başarısızsa özgün baytları koruyup açık başarısızlık bildirir. 1/2/3/4 için yükleme, ithalat ve 5.0 dışa aktarma eşitliği ayrı test edilir. Özgün TC SIM oyun dosyaları değiştirilmedi; gerçek tarayıcıda başlatma ve kayıt/yükleme smoke testi geçer.

## Aynı rutin deneyi

Aynı 2026/91373 tohumları ve 4.0 politika denetleyicisi kullanıldı: yeni başlangıçtan 365 gün, açıkça seçilen mevcut tutumlu yemek ve nakit çekme tercihleri, gerçek vardiyalar, olay ve hikâye seçimleri. Yeni otomatik sözleşme ödeme izni verilmedi. Sayılar arayüzde insanın kaydırma/gezinme hareketi değil, simülasyon komutlarıdır.

| Ölçüt / tohum                     | 4.0 / 2026 | 5.0 / 2026 | 4.0 / 91373 | 5.0 / 91373 |
| --------------------------------- | ---------: | ---------: | ----------: | ----------: |
| Açık bakım/ödeme kurtarma komutu  |         14 |         14 |          14 |          14 |
| Zaman ilerletmeyen rutin denemesi |         14 |          2 |          14 |           2 |
| Gerekli seçim ve kurulum komutu   |        169 |        169 |         169 |         169 |
| Rutin çalıştırma komutu           |        151 |        139 |         150 |         138 |
| Toplam dış komut                  |        334 |        322 |         333 |         321 |
| Gerçek tamamlanan vardiya         |        312 |       ≥300 |         312 |        ≥300 |
| Kira gecikmesi                    |          0 |          0 |           0 |           0 |

Önceden açıklanan kaçınılabilir komut tanımı bakım kurtarması + sıfır ilerlemeli tekrar denemesidir: 28→16, **%42,9 azalma**. Bu kazanım 12 gereksiz tekrarın önlenmesidir. Gerekli 14 bakım/ödeme kararı azalmadı; değişen kira koşulları hâlâ oyuncunun incelemesini gerektirir. Tüm komutlarda azalma yaklaşık %3,6'dır. Mevcut 4.0 haftalık otomasyonu yeni 5.0 özelliği olarak sayılmadı. Aynı iki rutin hayatı artık CI testinde de saf eylemler ve kayıt üzerinden tam tekrar yürütür.

Banka ve borç birlikte yüksek kalabildi; bu denetleyici borcu kendiliğinden kapatmaz. Yeni karar görünümü gerçek faiz ve açık geri ödeme seçeneklerini gösterir. Gerçek 4.0 girişimci 366. gün kaydı, 5.0'a taşındıktan sonra oyuncunun açık borç kapatma, acil fon ayırma ve işletmeye sermaye aktarma eylemleriyle yeni işletme hedefine ulaştı. Bir iş sözleşmesi gerektirmedi; varlık azalması yalnızca ödenen borca eşitti.

## Altı ayrı 365 günlük hayat

Kariyer, sosyal yaşam ve girişimcilik × 2026/91373 tohumları: altı ayrı 365 günlük hayat tam kayıt tekrarlarıyla geçti (6/6). Her hamlede girdi değişmezliği ve şema; 30/90/180/365. günlerde kayıt eşitliği; mevcut terfi, iş değiştirme, aylık ödeme, ortak ev, stokla hizmet ve günler sonra sonuçlanan sistemik olay eşikleri korundu. 2.611–3.769 gerçek komut, 53–123 NPC daveti ve 376–1.138 gecikmeli alınmış NPC haberi gözlendi. Alınan haber oyuncunun otomatik bildiği haber anlamına gelmez. Son kayıtlar 401.114–434.998 bayttır ve mevcut 500 KB kabul tavanını aşmadı. Son tam repo kapısındaki altı hayat ve iki rutin hayatı geçti. Matris süreleri eylem doğrulaması ve tekrar yürütme içerir; kullanıcı etkileşim gecikmesi değildir. Bu sorumlu politikalar negatif itibar cezası üretmedi; gerçek söz bozma ve düzeltme kapsamı ayrı olumsuz durum testlerindedir.

## Bağımsız olumsuz durumlar

Yeni 11 kabul testi gerçek eylemlerle şu sonuçları doğruladı:

- İstenmeden gelen davet isteğe bağlıdır; görmezden gelinmesi söz bozulması değildir. Açık kabulden sonra gelmemek tek bir kalıcı sonuç üretir.
- Davet kabul edildikten sonra NPC'nin görüşme giderini karşılayamaması, katılımda yeniden kontrol edilir; başarısız hamle taraflardan para alamaz.
- Aynı saatteki kişisel plan, davetin kabulünü atomik olarak engeller.
- Kabul edilmiş davetin normal takvimden başka semte ertelenmesi, NPC bağlantısını ve yeni mekânın tek ücret tahsilatını korur.
- Gerçek kaçırılmış buluşma, sonraki gerçek sohbet ve tamamlanan planla onarılabilir; eski gelmeme kaydı silinmez ve açıklama tekrar güven üretemez.
- Rutinin gerçekten çalıştırdığı ücretli vardiya, elle çalışılan vardiya gibi kaynaklı iş bilgisi üretir.
- Kayıt/yükleme veya yalnızca revizyon değişikliği, bilinen sıfır ilerlemeli durmayı aşamaz; doğrudan nakit çekme eylemi gerçek kurtarma sağlar.
- Gerçek uzun ömürlü işletme, açık mali tercihlerle yeni hedefi kazanır.
- Stok ve nakit tükenince ücretsiz yemekle toparlanma mümkündür; stok eksiye inmez.
- Yerel malzeme fiyatına bir lira yetmeyen işletme, para/stok/zaman değişmeden reddedilir.
- Doğru checksum taşıyan fakat sahte kimlik sayacı, yinelenmiş takvim bağlantısı, bilinmeyen kaynak veya gelecekten bilgi içeren kayıt reddedilir.

Eski bilgi aktarımı kabul testi de gerçek onarım vardiyasının Mert tarafından gözlenmesi, Ece ile gerçek bağımsız temas, gecikmeli bilgi alımı ve oyuncunun sonraki gerçek konuşması zincirini kullanır. Özel mali açıklamalar paylaşım izni varmış gibi yayılmaz. 180 günlük mezun kariyer denetleyicisinde davet ücretleri nakdi alet takımı fiyatının altına düşürdüğünde, banka yeterliyse açık nakit çekme adımı eklendi; terfi, iş değiştirme ve diğer kabul eşikleri düşürülmedi.

## Performans ve son kapılar

Son donmuş kaynak üzerinde tam repo çalışması **2.886/2.886** geçti: **2.825 JavaScript (379,48 saniye) + 61 TypeScript (0,480 saniye)**, 0 hata/atlanan test. Son typecheck ve production build başarılı; lint **0 hata ve başlangıçla aynı 62 eski uyarı**. Bu tam çalışma kayıt önbelleğini, son çeviri/görünüm düzeltmelerini ve yeni olumsuz durum testlerini içerir; önceki 2.881 testlik adayın veya ayrı odaklı çalışmaların sayıları bu toplama eklenmez.

İlk final adayının aynı cihazda üç sıralı tarayıcı tekrarı işlevsel olarak geçti; medyan p95 1440/390/320 genişliklerde 20,20/20,60/19,90 ms idi. 4.0'daki 17,50/18,20/17,30 ms karşısında %13,2–15,4 artış, %10 hedefini karşılamadı. Altı hayat üzerinden ayrı API ölçümü kaydı sıcak yol olarak belirledi (366. günde en yüksek p95 31,10 ms). Bu sonuç saklanır; sonraki optimizasyonun yerine geçirilmez.

Kayıt yazımında yalnızca aynı depolama nesnesinin son üç **tam ve daha önce doğrulanmış kanonik zarf metni** için geçerlilik metaverisi tutulur. Ayrıştırılmış durum veya değiştirilebilir nesne önbelleğe alınmaz. Yeni/değişen baytlar checksum ve tam şema doğrulamasından geçer; her kaydetme girdisi yeniden doğrulanır; her içe aktarma/yükleme yeni durum nesnesi üretir. Yazım sonrası okuma ve kota hata davranışı korunur. Aynı üç olgun durumda, her örnekte sonraki gerçek eylem durumunu kaydeden üç dönüşümlü A/B tekrarında medyan p95 kariyer 11,19→3,91 ms, sosyal 11,62→4,04 ms, girişimci 18,40→6,08 ms oldu (%65–67 azalma). Karşılaştırma önceki `6696fc7` kayıt modülüne karşıdır; farklı ölçüm penceresindeki 31,10 ms ile doğrudan oranlanmaz. Son tarayıcı ve altı hayat API tekrarı aşağıdadır.

365 günlük rutin kayıtları 4.0'da yaklaşık 239 KB, 5.0'da 337–340 KB oldu; artış yaklaşık %41–42. Kayıt büyüklüğü, yayımlanan oyun dosyalarının gzip boyutundan ayrı raporlanır. Tam iki yeni dilin toplam ve ilk açılış yükleri aşağıda ayrı raporlanır; PR/merge ve Cloudflare tamamlanmadan yayın tamamlandı sayılmaz.

## Son eş cihaz performans sonucu

Üç sıralı Chrome tekrarı → altı sıralı Node hayatı düzeni başlangıçla aynıdır. Diğer ajanların tarayıcı/derleme/test süreçleri durduruldu. Aynı Living tarayıcı sürücüsünde başlangıca göre yalnızca yeni dosya listesi ve kayıt sürüm/anahtar beklentileri değişti; eylemler, dallar ve ölçüm noktaları değişmedi. Her tekrarda 1440/390/320 genişlikleri için **20/39/20** gerçek işleyici örneği tutuldu. Ayrı Emergent işlevsel testindeki yeni önkoşul uyarlaması bu karşılaştırmaya dahil değildir.

| Genişlik | 4.0 medyan p95 | 5.0 son medyan p95 | Değişim | En çok %10 artış hedefi |
| -------- | -------------: | -----------------: | ------: | ----------------------- |
| 1440     |       17,50 ms |           14,80 ms |  −%15,4 | Geçti                   |
| 390      |       18,20 ms |           14,80 ms |  −%18,7 | Geçti                   |
| 320      |       17,30 ms |           15,00 ms |  −%13,3 | Geçti                   |

Bütün üç tekrarda oyun, eski kayıt, stale-tab ve güncel sekme eşitleme kontrolleri geçti. Ayrıca son gerçek yerel Worker derlemesinde Core (özgün TC SIM dahil), Society ve Emergent testleri yeni çıktı dizinlerinde geçti: gerçek iş/vardiya, yedek kurtarma, üç dil/genişlik yolculuğu, NPC davetinin ertelenmesi ve katılımı, dil değişim yarış koşulu, 4.0 geçişi, ortak ev ve sistemik karar durması. Deep akışı son kayıt/görünüm optimizasyonundan önce geçti; kapsamın hangi adayda çalıştığı JSON'da ayrıdır. İlk başarısız hedefli adayın sonuçları da JSON'da korunur. Ölçüm işleyici süresidir; boyama/ağ süresi veya bütün cihazlar için hız garantisi değildir.

366. gün altı durum üzerindeki en yüksek p95 (her API için 3 ısınma + 31 örnek):

| API               |      4.0 | 5.0 son |
| ----------------- | -------: | ------: |
| Eylem listesi     |  0,50 ms | 0,76 ms |
| Takvim görünümü   |  1,41 ms | 0,96 ms |
| Eylem çözümleyici |  2,96 ms | 5,27 ms |
| Dışa aktarma      |  5,18 ms | 8,10 ms |
| İçe aktarma       |  5,61 ms | 7,09 ms |
| Otomatik kayıt    | 14,88 ms | 8,31 ms |

Daha zengin simülasyonun çözümleyici ve dosya doğrulaması 4.0'dan yavaştır; tarayıcı toplam işleyici hedefinin geçmesi bütün API'lerin hızlandığı anlamına gelmez. Altı 365 günlük hayat, seçici ve sıkı doğrulama dahil 22,59–34,44 saniye sürdü. Elde tutulan test heap farkı 10,87–17,46 MiB: eylem izi ve beş kayda kadar kontrol noktası içerir; tepe tarayıcı belleği değildir. Bu değer API mikro ölçümlerinden önce alındığı için kayıt önbelleği belleğinin ölçümü olarak sunulmaz. Önbelleğin sınırı her depolama nesnesi başına üç tam zarf metnidir; değişebilir durum tutmaz.

| Politika / tohum  | Gerçek komut | Önemli karar | NPC daveti | Alınan NPC haberi | Son zarf |
| ----------------- | -----------: | -----------: | ---------: | ----------------: | -------: |
| Kariyer / 2026    |         2611 |          290 |         79 |               858 | 417004 B |
| Kariyer / 91373   |         2631 |          290 |         79 |               875 | 418796 B |
| Sosyal / 2026     |         3769 |          380 |        120 |              1130 | 433285 B |
| Sosyal / 91373    |         3733 |          376 |        123 |              1138 | 434998 B |
| Girişimci / 2026  |         3706 |          291 |         53 |               419 | 401114 B |
| Girişimci / 91373 |         3737 |          293 |         53 |               376 | 402093 B |

Son zarflar aynı 4.0 politikalarına göre %46,9–68,6 daha büyük; hepsi 500 KB kabul sınırı içindedir. 30/90/180/365 kontrol noktaları ve sınırlı teklif/haber/ağ sayaçları makine kanıtına dahildir. Haber alınması oyuncunun o bilgiyi öğrendiği anlamına gelmez; gerçek temas veya açık bildirim gerekir.

## Dosya yükü sapması ve kanıt sınırları

Son 33 oyun dosyası **1.306.719 ham / 377.295 gzip bayt**. 4.0'ın 206.279 gzip baytına göre toplam **%82,91 artış**; bütün diller için %15 hedefi **geçmedi**. TR ilk açılış, tembel yüklenen ortak anahtarlar + EN/PL sözlükleri hariç **242.205 gzip bayt**, **%17,42 artış**; bu da %15 hedefini **geçmedi**. Üç dil dosyası toplam 135.090 gzip bayt: ortak anahtarlar 43.405, EN 43.550, PL 48.135. Bu bedel tam iki yeni dil içeriği ve sosyal sistemler için açıkça raporlanır; gizlenmiş bir bütçe başarısı sayılmaz. Rakamlar yerel gzip toplamıdır, ağ aktarımı ölçümü değildir.

Makine raporu `BOARDWORLD_5_ACCEPTANCE.json`, bütün son kaynak hashlerini, üç başarılı tarayıcı tekrarını, ilk aday sonucunu, ayrı A/B kayıt deneyini, altı API hayatını ve iki rutin tekrarını içerir. Son derleme kaynakla aynı 33 dosyayı verdi. Üretim dağıtımı ve canlı smoke test kanıtları PR/yayın raporunda ayrıca verilir; bu belgede henüz gerçekleşmemiş merge, sürüm UUID'si veya Cloudflare başarısı ileri sürülmez.
