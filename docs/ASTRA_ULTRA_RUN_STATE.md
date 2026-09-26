# Racon Manager — avlu sonuçları checkpoint · 2026-09-26

- Hedef/oyuncu değeri: Oyuncu artık sokak kararının bugünkü bedelini ve komşulara gecikmeli güven/baskı etkisini görüp yayılımın yönünü seçebiliyor.
- Branch: `astra/racon-neighbourhood-consequences`; test edilmiş kod SHA: `0d13c4fb06ccb29dd581c612028c8399fba817a2`; son kayıt commit’i yalnız doküman.
- Dosyalar: `public/games/racon/{index.html,content.js,network.js,map-model.js,map-view.js}`; 5 Racon test/browser/harness dosyası; web ledger ve A025.
- Bug: `__proto__`/kalıtılmış emir, geçersiz süre/çift emir reddi; Koru/Çekil dosya izinin yeniden hesapta silinmesi repro + regresyonla kapandı.
- Sistem: 1/2/3 kapanışlık komşu yayılımı; +₺250 tek komşuda yoğunlaşma; baskı 60+ güveni yarılar; karşılıklı izler ve yalnız ağ/ısınma kapanış provası haritada.
- Save: üç slot ve `RACON/1`/`racon_v1`, sokak/nesne ID’leri korundu; eski kayıtlar açılır, yön/kuyruk/geçmiş reload’da kalır; kuyruğa 72/geçmişe 12 sınırı.
- Test: son hedefli 67/67; bir tam repo koşusu 1.623 PASS, 0 FAIL, 1 mevcut skip; son küçük düzeltmeler hedefli/browser ile kapandı; build/typecheck PASS, lint 0 hata/58 mevcut uyarı.
- Browser: 1440/390/320 × Pixi/SVG, 47 kontrol PASS; yeni oyun, save/reload, gerçek context-loss, geç init iptali, ekran/menü/BFCache temizliği, odak/taşma; CPU çizim medyanı 0,8 ms, en çok 7,7 ms (FPS değil); temiz build 6/6 dosya eşit.
- Release/risk: [PR #105](https://github.com/tayaz-maker/tariklab/pull/105) handoff hazır; Terra/Sol gerçek head’de zorunlu CI yeşilken merge + iki hostta `/oyna/racon` ve `/games/racon/index.html` smoke. Runner SwiftShader; fiziksel GPU release aşamasında; CI beklenmez.
- Sonraki adım: sıradaki JITEM: Derin Ağ için canonical upstream keşfi; TarikLab vendor sync yalnız upstream merge sonrası; Racon’da ikinci sistem (daha uzun emir zaman çizelgesi) sonraki tura. #101/#102/#104/Luna değişmedi; Novella LATER.
