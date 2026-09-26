# İHTİLÂL — havza akışları checkpoint · 2026-09-26

- Oyuncu değeri: Oyuncu artık bir havzadaki kararın komşulara ne zaman, hangi yoldan ve hangi bedelle yayılacağını anlayıp etkileyebiliyor.
- Branch: `astra/ihtilal-basin-currents`; test edilmiş kod SHA: `b5474c000947d1b3dd10e54e700cd8803b5deadd` (sonraki commit yalnız bu kayıt).
- Dosyalar: `public/games/ihtilal/{solo.js,solo-app.js,solo.css,basin-map.js,basin-network.js}`; `scripts/ihtilal-{basin-network.test,ultra-browser,browser}.mjs`, v1 fixture; web ledger/asset register A024.
- Kayıt: `tariklab.ihtilal.solo.v1` ve zarf v1 korundu; eski açılış/yankı/eşik/final kayıtları, yedek kurtarma ve hatalı veri reddi doğrulandı.
- Test: son hedefli 62/62; bir tam repo koşusu 1.624 PASS, 0 FAIL, 1 mevcut isteğe bağlı skip; build/typecheck PASS; lint 0 hata (58 mevcut uyarı).
- Tarayıcı: 1440/390/320 × gerçek Pixi/zorlanmış SVG, 43 kontrol PASS; mevcut campaign akışı 1280/360 PASS; save/reload, kota, gerçek context-loss, resize, menü/reset ve odak doğrulandı.
- Ölçüm: son pakette başlangıç 96–188 ms; ölçülen CPU çizim medyanı 1,1 ms, en yüksek 4,2 ms; sürekli ticker yok, en çok bir canvas, eski kayıttan güvenli geçiş var. FPS iddiası değildir.
- Açık risk: runner SwiftShader; fiziksel GPU/production smoke Terra/Sol’da. Tüm 17 oyun dosyası temiz build ile birebir eşleşti; son küçük düzeltmeler hedefli/browser testleriyle kapatıldı.
- Release: PR açılıyor; Terra/Sol gerçek PR head’inde zorunlu CI yeşilken merge etsin; `/oyna/ihtilal` ve `/games/ihtilal/index.html` smoke. #101/Luna/Novella değiştirilmedi.
- Sonraki adım: handoff sonrası temiz worktree’de Racon discovery; bu tur ikinci çekirdek sistem yok, CI/merge/production beklenmez. Novella LATER.
