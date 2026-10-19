# TC SIM finans release checkpoint — 2026-10-19

Canonical main: `813a0c638d563374810aae6abfca28e1484bf4da` (#181). Vercel production aynı SHA READY. Main www ve Workers gerçek browser PASS; ilk Workers eski dosya hash hatası yalnız dağıtım tamamlandıktan sonra tek job yeniden çalıştırılarak geçti. Genel main CI ayrıca tamamlanmalı.

#182 head `79b4b78fcf8451d3ec0b992d9ff816d6616efc63` güncel main üzerinde; exact tree `d5a527f96f71184cb70eeef8222be34b9baa0ee7`. TC built gerçek browser PASS; diğer güncel zorunlu CI bekliyor, merge yapılmadı. Main entegrasyonu sonrasında 691/691 domain/entegrasyon testi, lint/typecheck/build PASS. 15×720 hafta, ayrı 1200 karar haftası/25 oyun yılı, gerçek iş kaybı→temerrüt→bildirim→konut satışı zinciri yeniden çalıştırıldı. Sonuçlar fiziksel cihaz veya tüm insan oynanış dengesi onayı değildir.

| Alan | Main / release durumu | Kanıt ve sınır |
|---|---|---|
| D0 borç korunumu, 285.000 konut değerlemesi | DONE | icra/housing-net-worth regresyonları; aynı varlık/borç bir kez |
| Gerçekleşmiş ay kartı | DONE | monthly-cash; tahmin gelir değil, borç ödemesi gider alt kümesi |
| Sicil, kapasite, kredi uygunluğu | DONE | bank-record/credit-policy; eski geçmiş uydurulmaz |
| Faiz/amortisman, erken ödeme, tek yapılandırma | DONE | mortgage; gerçek anapara+tahakkuk faiz korunur |
| Temerrüt→cebrî konut satışı→eksik/fazla bedel | PARTIAL — #182 release bekliyor | mortgage-enforcement 6 vaka + gerçek zincir; yüzde 80 oyun değeri, gerçek ihale yasası değil |
| İcra bildirimi/taksit/masraf/tahsilat | PARTIAL | D0 ve review testli; her yasal tahsilat yolu tamamlanmadı |
| Mahkeme/itiraz | PARTIAL | Tek borç dökümü incelemesi mevcut; delil/avukat/esasa ilişkin tam dava ve geniş kanun yolu yok |
| Cebrî maaş haczi | MISSING | Mevcut tezgâh gelir kesintisi maaş haczi değildir |
| Maaştan ödeme düzenlemesi | PARTIAL — bağımlı küçük değişiklik hazırlanıyor | Gerçek net maaşın yüzde 20’si açık oyun varsayımı; isteğe bağlı, mahkemece zorunlu haciz değil |
| Vergi | PARTIAL | Mevcut soyut işletme vergisi bir kez; gerçek Türkiye vergi sistemi değil |
| SGK çalışma kaydı | DONE (oyun sayacı) | social-insurance; gözlenen uygun hafta tek kez, geçmiş bilinmiyor |
| Yasal SGK primi/işveren bildirimi/kanuni hak kazanma | MISSING | Çalışma haftası primi veya resmî günü kanıtlamaz |
| Mevcut emeklilik geliri ve kredi kapasitesi bağlantısı | DONE | late-life/social-insurance; net maaşa ikinci kesinti yok |
| Yasal emeklilik ayrıntıları | PARTIAL | Mevcut soyut hak/ödeme; tam mevzuat iddiası yok |

## Paket 2 geçiş adayı

Önce #182 güncel zorunlu CI PASS ile release; canonical main üzerinde bütünleşik kabul ve production doğrulaması. Maaştan tahsilat bağımlı değişikliği kendi test/CI kapısından geçmeli. Tam mahkeme ve cebrî maaş haczi için ayrı kaynak bağlantıları ve hedefli davranışlar hâlâ açık; yasal SGK sistemi eklenmeden DONE yazılmaz. Bu checkpoint ürün kapsamını ertelemez veya finansı tamamlanmış ilan etmez; Paket 2 kodu başlatılmadı.

Kalan risk: düşük gelir/işsizlik uzun koşuları yüksek borç biriktirebilir; korunum PASS ekonomik denge için insan kabulü değildir. Fiziksel cihazları kullanıcı doğrular. SAVE_VERSION 6, eski V5/V6, mevcut UI, üç açık PR sınırı ve kapsam dışı kararlar korunur.
