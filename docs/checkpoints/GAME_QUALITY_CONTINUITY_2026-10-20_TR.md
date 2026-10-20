# Oyun kalitesi — mevcut kod ve kanıt uzlaştırması

Kaynak tabanı: Kıyı Eşiği sonrası main272c5ea; Racon A/B/C için ayrı hazırlık. Canlı katalog18 oyun, bağımsız iki arşiv. Bu kayıt tamamlanan işleri yeniden geliştirmemek içindir; yeni bir bütün-katalog fiziksel cihaz veya insan oynanış sertifikası değildir. Fiziksel QA kullanıcıdadır. CI izleme18:09 talimatıyla kullanıcıya devredilmiştir.

| Oyun | Mevcut güvence ve korunan karar | Bu devam turunun işlemi |
|---|---|---|
| Çete Savaşları | src/game formül/saat/closure/outcome testleri; cete-quality/outcome browser | Motor/UI yeniden yazılmadı; mevcut kapılar korunuyor |
| HANEDANIAN | hanedanian-save/offline/ui testleri, campaign-probe, kalite/soak akışı | Eski audit'teki float için fmtRate, welcome için REPORT_TYPE_LABELS ve üretim önizlemesi zaten mevcut; yeniden uygulanmadı |
| Racon Manager | region, crew-police, save-validation, quality, network, longrun | A#211, B#212, C#213 ayrı PR; C kesik checkpoint kurtarıldı ve dil/uzun koşu tamamlandı; henüz release denmez |
| TC SIM | Tamamlanmış beş paket, SAVE_VERSION6 ve V5/V6; korunmuş master kaynak guard'ı | Kapsam yeniden açılmadı; yalnız mevcut testler birleşik regresyonda yer aldı |
| Son Mahalle Bükücü | strategy-final, bukucu-qa, wave1-bukucu-fixture/browser | Runtime değişmedi; #209 iki hostta tam kural/dört mod + gerçek slot satın alma/reload kabulü PASS |
| Labirent | tlab-labirent: her zorluk/tohum çözümü, geçiş/duvar sınırı, determinism, sonlanma | Yeni çözücü/oyun yazılmadı |
| Tek Taş | tlab-tek-tas ve mevcut solitaire motoru/arayüzü | Mevcut hareket/sonuç/kayıt sözleşmesi korunuyor |
| Satranç | tlab-satranc, tlab-satranc-ai: legal hamle, şah, mat/pat, rok/terfi/en passant, stale worker iptali | AI/motor yeniden geliştirilmedi |
| Amiral Battı | amiral-batti ve wave1-amiral-save: üç CPU düzeyi, no-cheat, nested save doğrulama, final sonrası engel | #208 tamam; yeniden uygulanmadı |
| Kapı Nöbeti | wave1-decision-repair/browser, final-language-neutrality | #209: odaklanan sistem onarımı ve tek tüketimli takip etkisi yayımlandı; iki host gerçek kabul PASS |
| Kayıp Telefon | wave1-pov-phone-save ve discovery graph/sonuç testleri | #208 bozuk UI pointer kurtarma tamam; yeniden uygulanmadı |
| Son100 Gün | wave1-pov-phone-save, POV ve yaşam içerik testleri | #208 gerçek save başarısı ve tekrarsız retry tamam; yeniden uygulanmadı |
| TC SIM: DEVLET | devlet-content/depth/sim, wave5 final ve longrun, wave1-decision | #209 sıfır hazine ve doğal final sonrası mutasyon engeli yayımlandı; iki host gerçek kabul PASS |
| SON KÖY MANAGER | wave1-town-save, life-town-save, son-koy-maintenance | #208 dinamik geçerli tarihçe sınırı tamam; yeniden uygulanmadı |
| VETO-H! | Ortak duel-core/acceptance/parity/mechanics/save/balance ve responsive akışı | İçerik/sanat/kimlik korunuyor; yeni kart üretimi yok |
| GETT-OH! | Aynı ortak motorun tema bağımsızlığı, özgün havuz/öğretici/save namespace testleri | İçerik/sanat/kimlik korunuyor |
| DARBE-H! | Ayrı300 kart havuzu, ortak motor ve darbe-h denge/face kaynak testleri | DARPE-H! ad kararı kaynakta henüz uygulanmamış; DONE denmez. Kart programı dondurulmuş |
| JITEM: Derin Ağ | Standalone e1d5bf742d012ef9355f7d822fa31bc896cd7c8d; ADAPT entegrasyonu, runtime31deba68… | Standalone main yeniden doğrulandı; Kıyı production kabulünde SOURCE/runtime kesin hash ve portal sürekliliği PASS; ADAPT tekrarlanmadı |

## Arşivler

İHTİLÂL#207 ve Kıyı Eşiği#210, kaynakları ve kayıtları silmeden arşiv rotalarında korunuyor. Son Kıyı iki-host kabulü: her host16 dosya hash'i, altı Kıyı ve altı İHTİLÂL TR/EN/PL×390/1280 mevcut save→hamle→reload senaryosu, sitemap dışlama ve JITEM sürekliliği PASS. Arşiv oyunlarının eski anlatı/harita sanatını bu tur yeniden düzenleme.

## Açık sınırlar ve doğru devam

- Racon A/B/C kod/test hazırlığı tamam; CI ve sıralı main/production kapıları geçilmeden yayımlandı denmez. B/C küçük diff'i korumak için önceki paket branch'ine bağlı taslaktır; o branch'e merge edilmez, önceki release tamamlanınca canonical main'e uzlaştırılıp aynı PR retarget edilir.
- PL seçimi ve kayıt davranışının test edilmesi, bütün anlatı korpusunun yüzde100 Lehçe olduğu anlamına gelmez. Görsel incelemede DEVLET'in bazı PL açıklamalarında EN fallback, korunmuş Kıyı arşivinde bazı harita/metrik etiketlerinde EN fallback gözlendi. Bu tur yeni tam çeviri projesi başlatılmadı; Racon kapanışı sonrasındaki hedefli dil kuyruğuna yazıldı.
- Mevcut genel testlerde bir koşullu uzun DARBE-H closure skip'i var; yeni skip veya test bypass eklenmedi. Son birleşik temel:2335 PASS,0 FAIL,1 mevcut skip. C'nin son24 atmosfer metni için final124 odaklı ve kaynak6/temiz-build6 dil senaryosu ayrıca PASS.
- Kart651/900, kalan249; Anatomi Atlası, TC SIM/HANEDANIAN çizgi roman haritaları, site boyut/performans ve kapsam dışı TC SIM genişletmeleri ertelenmiş olarak kalır.
