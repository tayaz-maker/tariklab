# DARBE-H — Sivil Arşiv, ilk sanat yönü örneği

2026-10-05. Kullanıcının güncel talimatı eski “300 SVG çizimi koru” sınırını kaldırır.
**Bu PR yalnız 10 kartlık stil örneğidir; 300 karta yayılım açık kullanıcı onayından sonra ayrı uygulama PR'ındadır.**
Kart verisi, denge, desteler, kayıt/backup, ortak düello motoru, kart ölçüsü ve erişilebilir metin değişmez.
DRB-237–240 tetik kaydı bağımsız P1 olarak kalır; görsel tasarım bunu çözmez veya doğrulamaz.

## Oyuncu değeri
Oyuncu kartın çağırma, iade, iptal, ortak güçlendirme veya geçici kontrol etkisini birbirinden farklı sivil sahnelerle ayırt edebilir; kesin kural her zaman kart metnindedir.

## Görsel yön
- Sivil arşiv odaları, çalışma masaları, devir eşikleri, kâğıt katmanları ve kararın ardından kalan izler.
- Işık alanı ve boşluk odak yaratır; dekoratif gren, sürekli animasyon, dış görsel, AI plaka, font indirme veya CDN yok.
- Beş özgün ton: kâğıt `#f2e8d9`, mürekkep `#202830`, koyu mürdüm `#302b37`, adaçayı `#6a847b`, kil `#ca775b`.
- Yetişkin figürler yüz ayrıntısı olmayan sivil geometrilerdir. Üniforma, askerî/parti/kurum simgesi, gerçek kişi ve şiddet yok.
- GETT-OH!/VETO-H! yalnız okunurluk/çeşitlilik kalite hedefidir; onların sahne, çerçeve, ikon, palet veya yerleşimi alınmadı.
- Bu örnekte mevcut DARBE kart yüzü fonksiyonu ve CSS aynen kullanılır; yalnız çizim değiştirilerek gerçek dar alanda karşılaştırılır. Çerçeve/oyun yerleşimi canlıda değişmedi.

## Örneklerin kapsamı
DRB-001, 022, 072, 082, 084, 091, 264, 269, 127, 300: görevli/birleşim, normal/hızlı/alan/donanım emirnameleri, normal/karşı ihtarlar; temel ve genişleme setleri.
Her ID için `manifest.json` kavram, mekanik bağlantı, gerçek built-card verisi ve SHA-256 taşır.
Ad/efekt/sayılar kaynak karttan alınır; sanatın içine rastgele harf, kart ismi veya yeni kural basılmaz.
`Dosya Kâtibi`nin uygulanabilir Dosya filtresi kısa metinden daha dardır; bu örnek metni veya kuralı yeniden yazmaz.

## Köken ve bütçe
`outputs/darbe-art-v2/proof-art.mjs` on ayrı elle tanımlanmış vektör kompozisyon üretir; eski motif üreteci veya eski SVG içe aktarılmaz.
240×160 boyut ve mevcut 59/86 dış kart oranı korunur. Yeni 10 SVG toplam **25.758 B**, en büyük **3.144 B**; sınır 12 KB/kart ve 100 KB/örnek seti.
Standalone karşılaştırma HTML'i eski/yeni sahneleri gömer (yaklaşık246KB); genişlik harness'i yaklaşık258KB. Bunlar üretim asset'i değildir, portal/PWA paketine dahil edilmez.
Eski çizimler yalnız açıkça “Mevcut çizim” etiketiyle inceleme içindir; üretim yenilemesinde eski çizim/legacy pack/cache referansları tek tek sınıflandırılacak.
651 mevcut DARBE/ortak düello dosyası hash koruması altında; bu proof hepsini değişmeden bırakır. Hukuki garanti veya insan sanat incelemesi iddiası yok.

## Onaydan sonraki uygulama kapısı
- Her 300 ID için ayrı storyboard/kavram/mekanik/seri eşleşmesi; yalnız tohumu, rengi veya birkaç küçük şekli değiştirerek çoğaltma yok.
- Yeni canonical SVG/generator/manifest ve varsa kullanılan 400×560 legacy paketinin uyumu; eski çizimlerin aktif UI, arşiv veya offline cache'e geri sızmaması.
- Gerekli eski dosyayı silmeden önce referans, route ve build kanıtı. Save/engine/kart ölçüsü/hash sözleşmesi korunur.
- Üretim sanat bütçesi hedefi toplam ≤1,8 MB, kart ≤12 KB; gerçek çizimler kaliteyi koruyarak ölçülür, aşım sessizce kabul edilmez.
- 300 ID ve byte/determinism eşleşmesi; 320/390/1440 gerçek düello, kart inceleyici/arşiv, eski save/reload, offline/SW upgrade, klavye/ekran okuyucu metni ve sessizlik regresyonu.
- Renkler yalnız vurgu içindir; tür, sayılar, etki ve durum metin/şekil ile korunur. Reduced-motion statik.
- Ayrı PR, before/after ekranları, provenance, test/CI ve iki-host production kanıtı. Bu stil proof'u üretim regresyonunun yerine geçmez.

## Bu checkpoint'in kanıtı
Yerel 5/5 test: 10 gerçek ID, deterministik/benzersiz/bütçeli SVG, yasaknode/straytext yokluğu, 651 ürün dosyası değişmezliği, standalone paket sınırı.
DRB-084'te görülen generator `undefined` metni önce regression ile fail edildi, sonra düzeltildi. On SVG gerçek 240×160'da rasterize edilip görsel olarak incelendi; bu insan veya browser testi değildir.
Cloud Browser yerel file protokolünü güvenlik politikasıyla reddetti; bu yol tekrar denenmedi. Responsive/klavye/offline-etkileşim kanıtı ayrı normal CI browser testine bırakıldı.
GitHub `darbe-art-proof` işi 6 gerçekviewport/motion vakası üretir; sonuç gelmeden PASS yazılmaz. Offline etkileşim testi açık paket içindir; oyunun offline/PWA/save kabulü değildir.

Yerel production build (`npm run build`) başarılı; migrate komutu DATABASE_URL olmadığı için beklenen PGLite fallback yolunu bildirdi. Uygulama dosyaları değişmedi.

İlk browser koşusu `37247244015`: altı gerçek viewport/motion ekranı üretildi; ek sandbox iframe kontrolünde Playwright'ın `serviceWorkers:block` init script'i `navigator.serviceWorker` getter'ında SecurityError üretti. Ürün/çizim kaynaklı değildi; upstream paket kodunda satır51294–51297 ile eşleştirildi. Iframe sandbox sınırı korunur. Taze context, yalnız iki HTML belgesini sunan server/route allowlist, sıfır gerçek worker/registration ve sıfır pageerror kapısı kullanılır; hata filtrelenmez. Düzeltmenin yeni CI sonucu beklenir.
