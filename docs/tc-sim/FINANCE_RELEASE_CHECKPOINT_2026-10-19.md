# TC SIM — Paket 1 release ve Paket 2 geçiş checkpoint

19 Ekim 2026. Doğrulanmış canonical main: `dcd9ad65a7cd890bd2ef6091bc90c692afc4d3bd` (#185); production aynı SHA READY. #186 head `90dba614ca0e5546374410f75fdbfc05c1846913` bu main üzerinde, 707/707 yerel test, lint/typecheck/build PASS. Güncel zorunlu CI tamamlanmadan release ve Paket 1 kapanışı ilan edilmez.

Durumlar mevcut oyun uygulamasını değerlendirir; tam Türkiye mevzuatı simülasyonu iddiası değildir. Önceki checkpoint'lerin sonraki iş önerileri tarihsel kayıttır: ürün kararı gereği yeni finans özelliği açılmayacak.

| Alan | Durum | Kanıt / sınır |
|---|---|---|
| D0 borç korunumu, konut/net servet | DONE | icra ve housing-net-worth regresyonları; 285.000 TL konut, kiralık dışlama, tek borç/varlık |
| Gerçekleşmiş ay sonu muhasebesi | DONE | monthly-cash; borç ödemesi giderin alt kümesi, tahmin gerçekleşmiş gelir değil |
| Sicil, ödeme kapasitesi, kredi uygunluğu | DONE | bank-record ve credit-policy; eski geçmiş uydurulmaz |
| Mortgage faiz/amortisman/erken ödeme/yapılandırma | DONE | mortgage; anapara ve tahakkuk korunur |
| Temerrüt, icra, cebrî konut satışı | DONE (oyun modeli) | mortgage-enforcement; eksik borç ve satış fazlası testli; değerleme/ihale sadeleştirilmiş |
| Bildirim, taksit, tahsilat, dosya kapanışı | DONE (oyun modeli) | D0/icra; borç tavanı aşımında yükümlülük kaybolmaz |
| Delil, avukat, itiraz ve karar | DONE (sınırlı oyun akışı) | court; tek ücret, ödenmiş cezanın tekrar doğmaması, canlı kalan alacak ve sınırlı yeniden inceleme |
| Tam yasal mahkeme ve kanun yolları | PARTIAL | Esas yargılaması, tüm delil/usul/avukatlık tarifeleri ve kanun yolları simüle edilmez |
| Cebrî maaş haczi | DONE (sınırlı oyun modeli) | wage; desteklenen özel işçi işleri, gerçek maaş/kalan borç/nakit sınırı, itiraz koruması; tüm hukuki istisnalar yok |
| Vergi | PARTIAL | Soyut işletme vergisi testli; tam vergi mevzuatı yok |
| Gözlenen SGK haftaları | DONE | social-insurance; tek sayım, işsizlik/gözaltı/askerlik/ölüm dışlama |
| Modellenmiş hizmet günleri ve işveren kayıtları | PARTIAL — #186 release bekliyor | Testli 8/7/8/7 oyun dağılımı ve sınırlı iş sözleşmesi vekilleri; eski geçmiş üretilmez |
| Yasal prim tutarı ve resmî işveren bildirimi | MISSING | Net katalog maaşı brüt kabul edilmez; ikinci maaş kesintisi yok |
| Emeklilik hakkı/geliri ve kredi bağlantısı | DONE (soyut oyun modeli) | Eski hak korunur; deneyim ve hizmet toplanıp çift sayılmaz |
| Tam yasal emeklilik hak kazanımı | PARTIAL | Tüm giriş tarihi, statü ve prim istisnaları modellenmez |

## Kapanış kapısı

#186 güncel zorunlu CI ve browser PASS → squash merge → canonical SHA/main CI/production doğrulaması → canonical üzerinde finans kabulü. Bu koşullar sağlandığında **Paket 1 mevcut doğrulanmış oyun kapsamıyla kapatılır**; yukarıdaki yasal sınırlamalar yeni finans geliştirmesi açma gerekçesi değildir.

Bütünleşik kabul: D0, mortgage→temerrüt→cebrî satış, mahkeme→maaş tahsilatı→hizmet kaydı→aylık muhasebe, net maaşta ikinci kesinti olmaması, V5/V6, SAVE_VERSION6. 15 profil/tohum ×720 karar haftası ve ayrı1200 karar haftası/25 oyun yılı; 720 hafta25 yıl diye sunulmaz. TR/EN/PL ve1280/390 gerçek browser CI kapısındadır; fiziksel cihaz testi kullanıcıya aittir. Korunum testleri bütün ekonomik stratejiler için insan denge onayı değildir.

## Paket 2

İlk dar düzeltme #187: gözaltında maaş/SGK/kariyer dururken iş yükü, işe ulaşım ve meslek deneyiminin sürmesi. life.js mevcut gözaltı sınırını yeniden kullanır; çıkışta akış geri gelir. V5/V6 reload/çıkış ve nakit tarafsızlığı testli; birleşik709/709, lint/typecheck/build PASS. #186 kapanmadan merge edilmez.

Mevcut sağlık zincirleri, tedavi/toparlanma, fazla mesai kapasitesi, eğitim yükü ve gecikmiş sonuçlar yeniden yazılmayacak. Sonraki küçük işler bu mekaniklerin kanıtlanmış boşluklarına odaklanacak. Maaş pazarlığı, aile mali tasfiye, ekonomik kriz ve yeni afet mekanikleri kapsam dışıdır.
