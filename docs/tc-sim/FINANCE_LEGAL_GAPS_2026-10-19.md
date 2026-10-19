# TC SIM — finans hukuk/SGK açıklıkları ve sınırlı maaş haczi

Başlangıç main: `55769a550f70f057d532703b55dee82e00ad054a` (#183). SAVE_VERSION 6 korunur. Bu belge finans kapanışı veya tam mevzuat uyumu iddiası değildir.

## Doğrulanan kaynaklar (19 Ekim 2026)

- ÇSGB, İş Kanunu SSS, Soru 58: https://www.csgb.gov.tr/sikca-sorulan-sorular/calisma-genel-mudurlugu/%C4%B1s-kanunu — 4857 m.35 kapsamındaki işçi ücretinin haczinde dörtte bir üst sınırı; nafaka ayrı. Bu, bütün çalışan/emekli/serbest meslek grupları için evrensel oran veya her dosyada mutlaka %25 tahsil emri değildir.
- Adalet Bakanlığı UYAP içtihat metni: https://mevzuat.adalet.gov.tr/ictihat/1218215200 — İİK 62 kapsamında tebliğden itibaren yedi günlük itiraz ve İİK 67 itirazın iptali ayrımı. Mevcut dört karar haftası bildirim / iki hafta inceleme gerçek yasal süreler değildir.
- SGK güncel prim tablosu: https://www.sgk.gov.tr/Content/Post/c7812ea8-5087-413f-aeb5-d3c1d153e11a/Isveren-Prim-Oranlari-2026-01-13-04-52-38 — 4/a için sigorta kolları ve işveren/çalışan payları ayrı. Sayfanın güncel oranları geçmiş tüm yıllara taşınamaz; sayfadaki genel başlangıç başlığı tek başına tarihsel oran kanıtı değildir.
- SGK işveren ödeme işlemleri: https://www.sgk.gov.tr/Content/Post/1f3a8bec-bca6-4e83-8e5c-f957a7d28af4/Isverenlerin-Prim-Odeme-Islemleri-2025-02-06-03-29-17 — işveren ödeme yükümlülüğü ve özel dönem kuralları. Net katalog maaşı brüt prime esas kazanç kabul edilmez.

## İlk küçük uygulama — cebrî maaş tahsilatı

Oyuncu onayı gerekmeden, mevcut olağan borç bildirim süresi bittiğinde desteklenen işte aktif net maaş varsa dosya cebrî ücret tahsilatına geçer. Sonraki gerçek ay kapanışında mevcut maaş bir kez tam yatar; en fazla dörtte biri, gerçek kullanılabilir nakit ve kalan borç sınırları içinde aynı icra talebini azaltır. Kaynak borç yeniden sayılmaz. Bir ay tek ödeme işareti ve mevcut dosya yüklemesi kullanılır. İtiraz incelemesi bitmeden ve yenilenen bildirim süresi dolmadan haciz emri kurulmaz.

Sınırlı oyun kapsamı: 2003 ve sonrası; market, office, waiter, barista, factory, warehouse, callcenter, cashier_big, sales_floor. Yıl eşiği ve kataloğun özel işçi eşlemesi oyun kapsam kapısıdır; 2003 yılının tamamına ait günlük yürürlük doğruluğu iddiası değildir. Kamu, emeklilik, serbest meslek ve nafaka modeli eklenmez. Desteklenmeyen iş/işsizlikte emir borcu silmeden bekler. Geçmiş yıllar aynı kaynakla uydurulmaz.

İsteğe bağlı %20 düzenlemesi aynen korunur; cebrî model ayrı compulsory işaretiyle aynı tahsilat yazıcısını kullanır. Mortgage kaynaklı dosyalar mevcut teminatlı cebrî satış yolunda kalır. Kaynak temerrütten ayrı ek masrafı olan dosyalar D0 tavan/eksi nakit korunumunu sağlayan mevcut haciz yolunda kalır. Genel nakit/varlık haczi düğmeleri silinmez. Dörtte birin modelde seçilmesi oyun politikası; dosya süresi, otomatik emir ve iş eşlemesi sadeleştirmedir. Tam hukuki icra iddiası yoktur.

## Üç açık alan / sıradaki küçük adımlar

| Alan | Durum | En küçük güvenli devam |
|---|---|---|
| Mahkeme/delil/avukat/itiraz | PARTIAL | Önce mevcut source/id ile gerçek kalan alacak ve ödeme delilini bağla; karar aynı borcu ikinci kez yaratmasın. Sonraki sınırlı dava/avukat masrafı mevcut openCases ve transact ile, açık oyun masrafı olarak. Geçerli borcu rastgele kazançla affetme. |
| Cebrî maaş haczi | PARTIAL — bu PR test/release bekliyor | Olağan borç ve desteklenen özel işçi ücretleri; kamu/nafaka/dosya sırası/tüm yasal istisnalar tamamlanmadı. |
| SGK prim/işveren | PARTIAL / prim defteri MISSING | Gerçek brüt taban yokken netten prim hesabı uydurma. Ayrı bildirilen kazanç ve işveren yükümlülüğü modeli önce gerekli; yürürlük tarihli doğrulanmış tablolara bağla. Net maaştan ikinci kesinti yapma. Eski çalışma geçmişine prim üretme. |
| Mevcut emeklilik / gözlenen hafta | DONE (soyut oyun modeli) | Mevcut hak/ödeme korunur; tam yasal hak kazanma sistemi değildir. |

Kabul: otomatik geçiş, itiraz koruması, %25 üst sınır, aynı ay/reload tek tahsil, kalan/ilgisiz borç ve net servet korunumu, sıfır nakit/işsizlik/emeklilik/kamu/tarihsel kapsam, D0 ve mortgage cebrî satış, V5/V6 ve tam 25 oyun yılı regresyonları. TR/EN/PL ×1280/390 gerçek haftayı kapatma ve kayıt/yükleme browser kapısı zorunlu. Fiziksel cihazlar kullanıcıya ait. Finans bütünü veya Paket 2 geçişi bu belgeden dolayı DONE sayılmaz.
