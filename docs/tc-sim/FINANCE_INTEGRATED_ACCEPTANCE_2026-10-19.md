# TC SIM Finans Paketi — bütünleşik kabul tasarımı

Tarih: 2026-10-19. Bu belge test tasarımıdır; yeni sonuç veya tamamlanma iddiası değildir.
Canonical başlangıç: `fce8950a08f5b1198391bf7b035c19c7a4d062c4`.
Sıra: #179 → #180 → #181. Bu hazırlık için yeni geliştirme PR'ı açılmaz; mevcut CI head'leri değiştirilmez.

## Sabit sözleşmeler

- SAVE_VERSION 6; V5/V6 kayıtları, D0 muhasebesi ve mevcut ekranlar korunur.
- Tüm hesaplar tam sayı oyun bütçesi birimindedir. Dönemsel TL gösterimi yalnız sunum dönüşümüdür; 1980/2017 etiketleri muhasebe hesabına geri sokulmaz.
- Maaş mevcut net tutardır. Vergi/SGK gerekçesiyle ikinci kesinti yapılmaz. İşletme vergisi zaten net işletme tahsilatının içindedir.
- Mortgage toplam yükümlülüğü = kalan anapara + tahakkuk etmiş ödenmemiş faiz. Geciken taksit bu toplamın alt kümesidir; üçüncü borç kalemi değildir.
- Anapara başlangıcı = ödenen anapara + kalan anapara. Tahakkuk etmiş faiz = ödenen faiz + kalan faiz. Gelecek faiz erken kapamaya eklenmez.
- İcra talebi, kaynak temerrüt borcunun temsilidir; ikisi birlikte iki kez sayılmaz. Kaynağa bağlı kısım ve bağımsız masraflar ayrılır. Borç tavanı yükümlülük silmez.
- Nakit değişimi = gerçekleşmiş giriş − çıkış + açıkça ayrılmış muhasebe düzeltmesi. Borç tahsilatı gider toplamının alt kümesidir.
- SGK takibi yalnız gözlenen tamamlanmış katalog işi haftalarını sayar. Eski deneyimden prim üretilmez; resmî prim günü/işveren ödeme kaydı iddia edilmez.
- Kapsam dışı: maaş pazarlığı, aile mali tasfiye, yeni ekonomik kriz/afet mekanikleri. Beş paket korunur; V2/V3 yeni motor yazımı anlamına gelmez.

## Kanıt ve sonuç biçimi

Her koşu şu çıktıları üretmeli: canonical/head/tree SHA; seed ve başlangıç dönemi; profil; gerçek takvim tarihi ve tamamlanan hafta; nakit/varlık/anapara/faiz/temerrüt/aktif talep; kredi sicili; gözlenen çalışma haftası; ay sonu gerçekleşmiş kart; save öncesi/sonrası fark; olay occurrence ve işlem sayısı; doğrulama hataları.
Her vaka ayrı PASS/FAIL/NOT RUN alır. Tasarım, kontrollü modül testi, tam advanceWeek oyunu, gerçek browser ve fiziksel cihaz ayrı kanıttır. Fiziksel cihaz testi kullanıcıya aittir.

## Deterministik kabul matrisi

| ID | Başlangıç ve gerçek işlem zinciri | Kabul değişmezi | Mevcut kanıt / kalan bütünleşik koşu |
|---|---|---|---|
| F01 | 285.000 birim semt konutunu satın al; yükle; net serveti tekrar aç | Nakit varlığa dönüşür, net servet satın almada kaybolmaz; kiralık ev sayılmaz | tc-sim-housing-net-worth.test.mjs; browser çapraz koşu |
| F02 | Aynı varlığı semt/wealth temsillerinde göster, ilişkili mortgage ekle | Aynı varlık ve gerçek borç bir kez sayılır; okuma state değiştirmez | housing-net-worth + mortgage testleri |
| F03 | 480.000 ev, %30 peşinat, 336.000 anapara, aylık oyun oranı 50 bps, 120 ay | Taksit 3.731; 120 kontrollü ayda 336.000 anapara + 111.610 faiz = 447.610 tahsilat | tc-sim-mortgage.test.mjs; tam takvim zinciri ek koşu |
| F04 | İlk 12 ay normal ödeme; 5.000 ek ödeme; reload; erken kapama | Önce mevcut faiz, sonra anapara; gelecek faiz yok; stale click tek ödeme | mortgage + lifetime-ui + outcome-browser |
| F05 | Mortgage al; geliri kes; üç karşılanmamış ay geçir | Nakit yokken hayalî anapara tahsilatı yok; temerrüt/sicil ve yeni kredi yasağı birlikte görünür | mortgage + credit-policy testleri; iş kaybı olayından başlayan çapraz koşu |
| F06 | Gecikmiş mortgage'ı bir kez yapılandır; yeni planı tamamla | Anapara/faiz affı veya faiz kapitalizasyonu yok; ikinci yapılandırma yok; gizli son balon yok | mortgage tests; ara kayıtlarla tam takvim koşusu |
| F07 | Gecikmiş mortgage bağlı evi sat | Gerçek anapara ve tahakkuk faiz bir kez kapanır; varlık silinir; yetersiz satış borcu kaybolmaz | mortgage tests; cebrî satış ayrı NOT IMPLEMENTED |
| F08 | 4.000 temerrüt → %40 peşinat/masraf → bir taksit → erken kapama | Hayalet 600 kalmaz; bağımsız temerrüt korunur; nakit gideri ve kalan talep tutarlı | tc-sim-icra.test.mjs + monthly-cash |
| F09 | 300.600 talep haciz → borç tavanı → tekrarlanan işlem → V5/V6 yükleme | 300.000 temerrüt + negatif nakitte 600 korunur; ikinci haciz tahsilatı yok | D0 icra cap/legacy testleri |
| F10 | Bildirim → itiraz → inceleme → gerçek tezgâh haftası → karar → ödeme/taksit/haciz | İncelemede haciz/tezgâh kesintisi durur; borç durur, silinmez; karar güncel kalan tutardır; tekrar itiraz yok | #180 icra tests; aylık kesişim kabulü |
| F11 | İtirazın açtığı family_late_night olayı → reload → truth seçimi → ödeme | Modal kayıtla korunur; menü üstünden zorlanmaz; occurrence bir kez çözülür; yeni masraf yok | #180 lifetime-ui + TR/EN/PL outcome-browser |
| F12 | İnceleme sırasında tamamını öde; karar tarihini geçir; reload | Dosya ve kaynak borç kapanır; ödenmiş borç yeniden yazılmaz | #180 icra tests |
| F13 | Sicili olmayan V5/V6 kayıtta banka/mortgage teklifi aç | Uydurma puan yok; gelir/yük sınırları çalışır; sıfır/kapalı talep sahte yasak yaratmaz | tc-sim-credit-policy.test.mjs |
| F14 | Gerçek gecikme/sicil 38 → ödenebilir küçük kredi → finanse edilmiş ay ödemesi → sicil 40 | Büyük kredi başlangıçta yasak; iyileşme gerçek ödemeyle; kredi aç/kapat puan çiftliği yok | credit-policy + bank-record tests |
| F15 | Aktif mortgage + diğer kredi taksiti + emeklilik geliriyle teklif aç | Aynı yük bir kez; yetersiz kapasitede UI ve backend birlikte reddeder; mevcut ödeme/yapılandırma engellenmez | credit-policy + social-insurance tests |
| F16 | Çalışma → aynı hafta tekrar → reload → iş değiştirme → işsizlik/askerlik/gözaltı/emeklilik | Yalnız tamamlanan uygun hafta bir kez sayılır; para kesilmez; eski kayıt geçmişi bilinmiyor | #181 social-insurance tests |
| F17 | İşletme ay kapanışı → vergi raporu aç → tekrar kapanış → reload | Pozitif oyun vergi matrahının %20'si mevcut net sonuca bir kez dahildir; rapor tahsilat yapmaz; zararda vergi sıfır | bank-business + social-insurance tests; zarar+reload çapraz koşusu |
| F18 | Mevcut emeklilik olayı → ay kapanışı → reload → banka kapasitesi | Net maaş durur, mevcut aylık bir kez yatar; prim takibi eski hakkı iptal etmez; ikinci vergi/SGK kesintisi yok | tc-sim-late-life + social-insurance tests |
| F19 | Ay kapanışıyla aynı haftaya taksit, tezgâh geliri ve icra tahsilatı koy | Gerçekleşmiş tek kart nakitle uzlaşır; forecast gelir sayılmaz; işlem/borç alt toplamı iki kez eklenmez | monthly-cash tests; birleşik tek timeline koşusu gerekli |
| F20 | Her finans kararını canlı event, yetersiz zaman, yetersiz nakit ve stale handler altında dene | Reddedilen karar para/borç/varlık/haftalık hak değiştirmez; UI kapısı backend ile aynıdır | lifetime-ui + ilgili domain tests |

## Uzun oyun profilleri

Sabit seed seti: 7, 17, 28. Her profil ayrı koşu; aynı envanterle tekrarlanabilir işlem politikası kaydedilir.

| Profil | Koşu ilkesi | Beklenen davranış |
|---|---|---|
| Düşük gelir | 2.000 kontrollü bütçe; yalnız uygun teklif; kira ve temel gider önceliği | Taşınamayan mortgage reddedilir; borç affıyla veya kredi spam ile zenginleşme yok |
| Orta gelir | 9.000 katalog maaşı; tek mortgage; düzenli ödeme | Ödeme yükü ve varlık korunumu; maaş bir kez yatar; yeni kesinti yok |
| Girişimci | Mevcut repair işi; gerçek net ay kapanışı; sabit harcama politikası | Vergi ikinci kez alınmaz; işletme neti nakit ve ay sonu kartıyla uzlaşır |
| Borçlu | Mevcut taksit + temerrüt; bildirim/itiraz/taksit yolu | İcra ve kredi sicili birlikte işler; stok/yükümlülük kaybolmaz |
| Aileli | Mevcut ortak hane bütçesi ve emeklilik yolu | Mevcut giderler korunur; aile mali tasfiye eklenmez; nakit şokları borç muhasebesinden kopmaz |

1. 720 haftalık kontrollü modül koşuları önce karşılaştırılabilir muhasebe kanıtı verir; mevcut mortgage/SGK testleri bu sınıftadır.
2. Ayrı tam oyun koşusu gerçek `advanceWeek`, olay seçimleri ve save/load ile 720 tamamlanan haftayı işler. Yalnız state'i temizleyerek olay atlanmaz; occurrence ve seçimler kaydedilir.
3. 25 yıllık final QA ayrı koşudur. 720 hafta 25 yıl değildir. 1999 başlangıcıyla 2024 hedef tarihine kadar gerçek takvim ilerletilir; 2030 tarihsel sonu devre dışı bırakılmaz. Ölüm/terminal sonuç başarısızlık gibi gizlenmez; tamamlanan süre ve gerçek sonuç raporlanır.
4. Sınırsız bekleme yok: test maksimum adım/olay sayısıyla bounded olur; sınır aşımı FAIL olarak kanıt bırakır.

## Kayıt ve browser çarpanı

- V5/V6: nötr sicil, eski faizsiz kredi, aktif yeni mortgage, gecikme, yapılandırma, notice/plan/court, kapalı dosya ve SGK kaydı olan/olmayan fixture.
- Karardan hemen önce/hemen sonra, taksit öncesi, ay kapanışı ve olay modalında save/load; hem asıl slot hem mevcut kurtarma/backup sözleşmesi.
- Gelecek mortgage/SGK alt formatı sessizce borç veya geçmiş sıfırlamaz; kontrollü doğrulama hatası.
- TR/EN/PL ×1280/390 gerçek browser: Para/Bankalar/Emlak/İş arasında okuma, erişilebilir isimler, normal klavye/focus, olay çözümü, işlem, reload, taşma ve konsol.
- Offline kanıt: gerekli modüller önbelleğe alınmışken aynı finans işlemi/kayıt; ağdan gelmeyen kaynağın başarı varsayımı yapılmaz.
- Production: canonical SHA READY ve exact-byte asset kontrolü, sonra kritik rotalar. Deploy yarışı yalnız eski commit hash'i kanıtıyla ayrılır; assertion gevşetilmez.

## #181 sonrasında durum ve Paket 2 geçiş kapısı

Bu tablo şimdilik kaynak değerlendirmesidir; PR release/CI tamamlanması ayrıca gereklidir.

| Mekanik | Kaynak durumu | Finans kapanışı için kalan |
|---|---|---|
| Konut net serveti / D0 borç korunumu / gerçekleşmiş ay kartı | DONE, mevcut hedefli testlerle | Bütünleşik timeline ve production kabulü |
| Kredi sicili ve uygunluk | #179 hazır | Main entegrasyonu, güncel CI ve production |
| Faizli mortgage/amortisman/erken ödeme/yapılandırma | DONE (#178) | Gelir kaybından başlayan birleşik kabul |
| Mortgage temerrüt → cebrî konut kaybı → kalan borç | MISSING | Tek yükümlülükle teminat satış/eksik tahsilat/fazla bedel zinciri |
| İcra bildirimi/taksit/haciz/tahsilat | PARTIAL | Maaş kesintisi, teminatlı mortgage bağlantısı ve birleşik muhasebe |
| Mahkeme | PARTIAL (#180 yalnız inceleme) | İtirazın esası/delil, avukat, daha geniş dava sonucu kapsamı tamamlanmadı |
| İşletme vergisi | PARTIAL | Mevcut soyut vergi çalışır; yeni gerçek vergi tarifesi veya tam vergi sistemi iddia edilmez |
| SGK | PARTIAL (#181) | Prospektif oyun çalışma haftası sayacı testli; gerçek prim ödeme/işveren/kanun sistemi yok |
| Emeklilik | Mevcut soyut kural ve ödeme DONE; bağlantılar #181 | Tam timeline, eski kayıt ve gelir/borç kabulü |

Üç PR'ın kapanması tüm finans kapsamının tamamlandığı anlamına gelmez. Paket 2 uygulamasına geçiş: yukarıdaki kabul koşuları PASS, canonical main/production doğrulanmış ve eksik finans mekanikleri açıkça tamamlanmış veya ayrı bir ürün kararıyla ertelenmiş olmalı. Bu belge bir erteleme kararı değildir. Paket 2 için yeni kod/PR bu checkpoint'te açılmaz.
