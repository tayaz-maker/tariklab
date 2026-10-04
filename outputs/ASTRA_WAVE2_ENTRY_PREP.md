# Wave 2 giriş keşfi — kod başlamadı

#110/#111 genel CI/release kapıları beklenirken yalnız ilgili giriş, sonuç ve save kaynakları okundu.
Bu belge yeni ürün PR'ı veya test/PASS kaydı değildir; uygulama release zinciri kapandıktan sonra başlar.

| Oyun | Oyuncu değeri | Gerçek sonuç girişi / tekrar sınırı | Değişmez sözleşme |
| --- | --- | --- | --- |
| JITEM | Oyuncu uyguladığı hamlenin dosya/bağ bedelini ve henüz dönmemiş etkisini tek sonuç kaydında ayırt edebilir. | Canonical `src/game/store.ts::play` gerçek `diffState` ile UI-only `lastResult` üretir; `SidePanel.tsx` zaten sonuç kartı gösterir. İkinci kart/ikinci aria-live yerine mevcut sonucun görsel ritmi geliştirilir; görünmeyen aktör/bağ bilgisi açılmaz. | TarikLab SOURCE ve yerel canonical checkout `0c1fc08` eş; `jitem-derin-ag-v3`, schema 5, tarihsel veri/RNG/hesap değişmez. Uygulama başında upstream main tekrar alınır; önce upstream PR, sonra dar vendor sync. |
| TC SIM | Oyuncu tamamladığı haftanın plan/ilişki kararlarının gerçekleşmiş etkisini bekleyen bilinen yükümlülükten ayırt edebilir. | `js/app.js` advance-week success → `snapshotWeekState/summarizeWeek` → mevcut notice. `weekly-feedback.js` değişmeyeni ve küçük ilişki gürültüsünü dışlar; gizli social-followup görünmez. Mevcut feedback geliştirilir, aynı sonuç iki kez okunmaz. | `tc-sim-save`, backup ve saveVersion 6 korunur. Snapshot/diff saftır; görsel state kayda yazılmaz, reload replay üretmez. Tarihsel seed/içerik ve zaman hesabı değişmez. |

- Görsel ayrım: JITEM dosya/bağ/dönüş izi; TC SIM mekânsal olmayan hafta zinciri. Ödül/başarı uydurma, portre/gerçek harita/dış asset yok.
- Kanıt kaynakları: JITEM `atlas-model/atlas-browser/save-recovery/move-preview`; TC SIM `weekly-feedback/decision-network/historical-browser`. Bu keşifte yeniden çalıştırılmadı.
- Sonraki model testleri: gerçek before/after, no-op/eşik, deterministik seed, input immutability, gizli sonuç dışlama, save/reload no-replay. Browser: 320/390/1440, klavye/close, reduced motion, sessizlik, console/overflow, eski save ve offline.
- İncelenmeyenler: DEVLET/Kıyı Eşiği yeni outcome tetikleri, Wave3/4 implementation ve anatomi; bu not bunları başlatmaz.
