# ASTRA ULTRA | TC SIM BOARDWORLD 6.0
## GOLD PREPARATION: TEK GÖREV, KOD, TEST, MERGE, PRODUCTION

**Repo:** `tayaz-maker/tariklab`
**Canlı oyun:** https://www.tariklab.com/oyna/tc-sim-boardworld
**5.0 referansı:** PR #252, merge `78ec4ee339051840037e48e80f4b07518d5a1424`
**Ürün hedefi:** Boardworld 5.0'dan **doğrudan 6.0** üret. 5.1/5.2 oluşturma. 6.0, 7.0 Gold Release öncesindeki son kapsamlı oynanış ve mimari geliştirme sürümüdür.

## A. Yetki ve değişmez kurallar

Bu belge uygulama sözleşmesidir, tasarım önerisi değildir. Sen oyun tasarımcısı, simülasyon mühendisi, UI/UX lideri, QA ve release mühendisi olarak **tek çalışma görevinde** analiz et, kodla, test et, düzelt, PR aç, merge et ve canlıya çıkar. Ara prompt veya rutin onay isteme. Gerçek erişim, güvenlik, dal koruması veya çalışma sınırlarını aşma. Süre/bellek sınırında güvenli commit ve devam notu bırak; bitmeyeni bitmiş gösterme.

Önce güncel `main` HEAD, `AGENTS.md`, `AGENTS.project.md`, mevcut Boardworld belgeleri, CI ve Cloudflare release guard'larını oku. 5.0 SHA'sını geçmiş referans olarak kullan; güncel değişiklikleri ezme. Mevcut özellikleri envanterle ve eksik/kusurlu olanları düzelt. Orijinal `/oyna/tc-sim` ve diğer oyunlara dokunma; Boardworld rotasını koru. v1–v5 gerçek kayıtlarını, değişmez arşivleri, eski sekme korumasını, TR/EN/PL dil desteğini koru. Yeni Worker kurma, Vercel'e dokunma, var olmayan hook'u uydurma; mevcut Cloudflare Git entegrasyonunu kullan.

## B. Ölçülmüş 5.0 tabanı ve hedefler

5.0 teslim raporundaki referanslar: 2.886 test geçti; altı 365 günlük simülasyon; 33 canlı varlık; 1440/390/320 px handler p95: 14,8/14,8/15,0 ms; Türkçe ilk yük gzip 242.205 bayt; tüm dillerin toplam gzip'i 377.295 bayt; 365 günlük kayıtlar yaklaşık 401–435 KB; lint 0 hata/62 mevcut uyarı. TR ilk yük 4.0'a göre +%17,42, tüm diller toplamı +%82,91 büyüdü. Ölçümleri güncel aynı cihaz ve eşleştirilmiş iş yükünde doğrula. Bu verileri otomatik başarı ilanı olarak kullanma.

**6.0 sayısal hedefleri:** Türkçe ilk yük gzip ≤205.874 bayt (5.0'a göre en az %15 azalma); tüm dil varlıkları toplam gzip ≤301.836 bayt (en az %20 azalma); etkileşim p95'i 1440/390/320 px'te sırasıyla 14,8/14,8/15,0 ms'den kötü olmamalı; 365 günlük kayıtlar güvenli ve kayıpsız biçimde küçülmeli. Ağ transferi, dosyaların gzip toplamı, JS handler süresi ve gerçek kullanıcı algısı ayrı ölçülmeli. Hedeflere veri kaybı, sahte ölçüm veya kritik mekanik çıkararak ulaşma. Sapmayı açık raporla.

## C. Oynanış: gerçek yaşam karar döngüsü

Oyuncunun zamanı, parası, sağlığı, ilişkileri ve fırsatları arasında gerçek tercihler kur. Kariyer, sosyal çevre ve girişimcilik stratejileri 30/90/180/365 günde ölçülebilir farklı hayatlar üretmeli; hibrit stratejiler de mümkün olmalı. Oyuncu yalnızca işe git/maaş al/kira öde döngüsüne mahkûm kalmamalı. Başarısızlıklar toparlanma yolu sunmalı. Eylemlerde önkoşul, süre, konum, para, enerji, risk, sonuç ve gecikmeli etki açık olmalı. Kesin eylemler zarla çözülmemeli; belirsiz sonuçlar deterministik RNG ile tekrar üretilebilir olmalı. Yeni olaylar sadece kart sayısını büyütmesin; mevcut koşullardan nedensel olarak doğsun.

**Rutin sürtünmesini azalt:** Haftalık planlama, toplu eylem ve bütçeli otomasyon ekle/iyileştir. Oyuncunun stratejik kararlarını otomatik verme. Otomasyon bütçe, zaman, ulaşım, randevu ve NPC olaylarını atlamasın; durduğunda gerekçe ve toparlanma seçeneği göstersin. Tek tek eylemlerle toplu yürütmenin ekonomik/zamansal sonuç eşdeğerliğini test et. Rutin bakım sayısı, stratejik karar sayısı ve otomatik sonuç sayısı ayrı ölçülsün.

## D. NPC 6.0: özerk ve tutarlı toplum

Önemli NPC'lerin kimlik, hafıza, söz, sosyal ağ ve geçmiş kayıtlarını koru. Hedefler, zaman bütçesi, ekonomik durum, konum, ilişkiler ve bilgi sınırlarına dayalı kararlar verdir. NPC'ler oyuncu hiçbir şey yapmadığında da olay odaklı ilerlesin; iş, taşınma, sosyal ilişki, fırsat ve çatışmalar kurallara bağlı değişsin. Bir NPC aynı anda iki yerde olamasın, çakışan randevulara katılamasın. Bilginin kaynağı, öğrenilme zamanı, mahremiyet ve yayılma sınırı olsun; karakter bilmediği şeye tepki vermesin. İkincil nüfusu körlemesine çoğaltma; performansla dengeli kimlik sürekliliği sağla. Sosyal kronoloji neden-sonuçları anlaşılır göstersin.

## E. Ekonomi, kariyer, işletme ve barınma

Maaş, terfi, iş kaybı, beceri, serbest çalışma, işletme sermayesi, müşteri, stok, sipariş, kira, depozito, ortak fatura, borç, taksit ve mahalle arzını aynı otoriter muhasebeye bağla. Her işlem tekil ve izlenebilir olsun; para yaratma, çift ödeme, negatif stok, imkânsız sözleşme bulunmasın. İşletme kârı müşteri ve stokla sınırlansın; risk ve fırsat maliyeti olsun. İşsizliğin ve borcun farklı toparlanma yolları bulunsun. Mahalle arzı fiyatları, hizmet erişimini, NPC davranışını ve oyuncu seçeneklerini gerçekten etkilesin. Gold sonrası planlanan büyük genişlemeleri 6.0'a zorla ekleme; yalnızca veri modelinin genişletilebilirliğini sağla.

## F. Şehir tahtası, board RPG ve görsel kalite

Mevcut kompakt 2.5D estetiği koruyarak semtlerin kimliğini güçlendir. Üç semt kartını yalnızca dekor olmaktan çıkar: NPC/fırsat göstergeleri, ekonomik değişim, bağlantı, ulaşım, konum ve sonuçlar haritadan anlaşılabilsin. Hafif SVG/CSS mikroanimasyonları ve durum geri bildirimleri kullan; ağır 3D motor ve gereksiz bağımlılık ekleme. Kartlar, ajanda, sözleşme, proje ve karar panosu gerçek oyun durumuyla bağlı olsun. Başlangıç rehberi ilk beş dakikada anlamlı karar verdirebilsin. Uzun ondalık, içsel `balanced` etiketi, eksik boşluk, taşan metin, kötü kontrast, belirsiz ikon ve gereksiz tıklama gibi kusurları gider. 320/390/1440 px, klavye, dokunmatik, reduced-motion ve ekran okuyucu etiketlerini kontrol et. TR/EN/PL'de sayılar, para ve tarihler düzgün biçimlensin; geçmiş serbest metin özgün dilinde korunsun ve gerekiyorsa etiketlensin.

## G. Performans ve mimari borç

Modül bağımlılık grafiğini, gerçek ilk yük ağ izini, JS/CSS boyutlarını ve büyük sözlükleri incele. Özellikle `locale-keys`, `locale-en`, `locale-pl` tekrarlarını; eager import, kullanılmayan CSS, yinelenen sabitleri, pahalı resolver/export/import yollarını, serileştirme ve kayıt metadata cache'ini optimize et. Dil katalogları gerektiğinde yüklensin, yarış koşulları engellensin. Değişikliklerden önce/sonra aynı donanım ve aynı iş yükünde üç tekrar ölç. 365+ gün kayıt büyümesini ve depolama kotasını kontrol et. Deterministik davranış, geçmiş olaylar ve save checksum korunmalı. Mimariyi gelecekte şehir, NPC ve meslek eklemeye açık yap, ama şimdilik spekülatif genişleme yazma.

## H. v6 kayıt migrasyonu ve güvenilirlik

Sürüm numaralı v6 şema oluştur. Gerçek v1, v2, v3, v4, v5 kayıt örnekleriyle migrasyon, yedek, dışa/içe aktarım, yeniden yükleme, bozuk kayıt kurtarma ve eski sekme yarışlarını test et. Migrasyon saf, idempotent, kayıpsız olsun. Eski orijinaller değişmez arşivde kalsın. Yeni kaydı eski sekme ezemesin. Deterministik seed, ekonomik defter ve olay geçmişi tutarlı olsun. Kayıt boyutunu azaltırken kullanıcı geçmişini sessizce silme.

## I. Kabul testleri ve Gold hazırlığı

Tüm mevcut testleri ve yeni testleri çalıştır; test sayısını şişirmek yerine davranış kapsamasını artır. En az 3 başlangıç × 3 strateji × 2 seed = 18 adet 365 günlük deterministik yaşam testi; ayrıca bir 730 günlük stres senaryosu. Tekli/toplu eylem eşdeğerliği, NPC zaman/konum, bilgi sızıntısı, söz verme/bozma, gecikmeli sonuç, borç-kira-stok muhasebesi, v1–v5 gerçek kayıt migrasyonu, dil yükleme yarışı, mobil/klavye ve orijinal TC SIM regresyon testleri zorunlu. Gerçek tarayıcıda 320/390/1440 px ve üç dil için temel akışları çalıştır. İlk 5 dakika ve 30/90/365. gün ekranları ile eylem günlüklerini değerlendir. Kritik hata, veri kaybı, çift ödeme, bozuk kayıt veya yayın koruması ihlali varken release yapma.

Gold için 7.0'a aktarılacak **ölçülebilir kapanış listesi** hazırla: kalan yüksek/orta öncelikli sorunlar, oyuncu testlerinde doğrulanması gereken sorular, gerçek performans bütçesi, kayıt ve erişilebilirlik kriterleri. 6.0'ı Gold diye etiketleme. 7.0 yalnızca kapanış/QA ve dengeleme için ayrılacak; temel mekanik borçlarını oraya itme.

## J. GitHub merge, Cloudflare production ve nihai teslim

Güncel `main` üzerinden izole dal aç, anlamlı commit'lerle uygula, typecheck/build/lint/testleri çalıştır, PR aç. CI'yi doğrula; dal koruma ve gerekli onayları atlamadan merge et. Mevcut Cloudflare Git entegrasyonu ve güvenli build/deploy guard'ını kullan. İlk Cloudflare build CI bekleme süresinde güvenli biçimde durursa exact-main kontroller tamamlandıktan sonra mevcut akışta güvenli retry uygula; kontrolsüz polling yapma. Yeni Worker ve Vercel değişikliği yok. Canlı `https://www.tariklab.com/oyna/tc-sim-boardworld` üzerinde commit, build, asset hash, kayıt, temel eylemler, dil ve eski TC SIM smoke testini doğrula. HTTP 200 tek başına yeterli değil. Kritik hata varsa güvenli rollback uygula ve başarısızlığı açık raporla.

**Tek nihai rapor:** canlı URL, PR, merge SHA, Cloudflare build/version/% trafik, geçen/başarısız/atlanan test, 18×365 ve 730 günlük test sonucu, eski kayıt uyumluluğu, 5.0→6.0 gzip/p95/save karşılaştırması, ekran görüntüleri, oyuncunun fiziksel kontrol edeceği 5 yenilik, bilinen sınırlamalar ve 7.0 Gold için kalan kesin kapanış listesi. Yerel kanıt dosyalarının yollarını ve mümkünse repoda okunabilir kabul raporunu paylaş. Gerçekte doğrulamadığın hiçbir şeyi başarı diye yazma.

**Son komut:** Plan yazıp durma. Tek görevde Boardworld 6.0'ı tamamla, test et, merge et, Cloudflare üzerinden canlı yayınla ve doğrulanmış teslimi yap. Yasal/teknik yetki veya çalışma sınırını aşma; engelde checkpoint bırak. Ara sürüm çıkarma.
