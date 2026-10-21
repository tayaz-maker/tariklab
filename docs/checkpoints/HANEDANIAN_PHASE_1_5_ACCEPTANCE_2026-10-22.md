# HANEDANIAN Faz 1–5 kabul kaydı — 2026-10-22

Başlangıç main: `401122f7c17108bb26dd9c02b660c5d83627b8bb` (GitHub'dan doğrulandı).
Faz 0 raporu GitHub main'de yoktu; mevcut Codex çalışma alanındaki `docs/checkpoints/HANEDANIAN_MASTER_GAMEPLAY_AUDIT_2026-10-21.md` kullanıldı. Denetim yeniden yapılmadı.

## Paketler

1. #235: tek ücretli katkı veya yalnız mevcut yatırım aşaması için saatlik katkı emri. Mevcut 1.500/kaynak sınırı, 500 stok ve gerçek zaman korunur; iptal/duraklatma/kayıt desteklenir.
2. #236 → #235: dört mevcut AI kimliği, mevcut guarded komutlarda farklı gelişim/asker/ticaret/ateşkes/genişleme/hedef önceliği kullanır. Aynı puanı tekrar hesaplamadan aynı aday sıralaması/RNG korunur.
3. #237 → #236: gerçek keşif bilgisi, ücretli tek kuşatma merkezi, altı birlik bütçesi, yedi AI yurt sınırı ve yoldaki kurucu rezervasyonu. Mevcut savaş/ETA/başkent koruması; akın/fetih aralıkları. Kaybedilen yatırım merkezi aynı bölgedeki uygun yurtta 15 nüfuzla devam edebilir; ödenen kotalar silinmez.
4. #238 → #237: mevcut skor ve son sekiz gerçek olay, taraf ayrımı olmadan hedef seçimine bağlanır. Gerçek dış teslimat küçük/aralıklı ilişki etkisi yapar; iç döngü ticaret etki basmaz. Mevcut barış/vassal kuralları üstün kalır.
5. #239 → #238: mevcut Divan içinde 64 önemli olaylık hafıza ve mevcut zafer kartı/diyaloğunda, zafer anında dondurulan gerçek koşullar. Eski kayıtlara sahte tarih veya sahte hanedan yok oluşu eklenmez.

PR'ların son head SHA ve test ağacı makbuzları bu sohbetin `outputs/hanedanian-development/` tesliminde ayrıca kaydedilir. Her remote ağaç, yerelde test edilen ağaçla birebir doğrulanır; bağımlı PR'lar öncekinin güncel head'ine dayanır.

## Kabul

- Birleşik 102 hedefli test PASS: katkı, kişilik, fetih/rezervasyon, ilişki, kronik/zafer, mevcut core/progression/logistics/save/UI/orders/outcome. Son rezervasyon değişikliğinde ilgili dokuz test; gerçek kayıp→kronik ve zafer dahil 10 çapraz test de PASS.
- Build, typecheck, scoped lint PASS. Başka oyunda, CSS/harita varlıklarında, save formatında veya CI/Cloudflare altyapısında değişiklik yok.
- İki tohum × ekonomi/hâkimiyet/siyaset: 6/6 yasal zafer. Pasif/boş genişleme/dairesel ticaret: 0/3 zafer. Erken zafer, negatif/sonsuz/out-of-capacity ekonomi yok. İnsan zorluk/oyun süresi araştırması değildir.
- #236 tekil CI başarısızlığı TL-CAMPAIGN-1/hâkimiyet, eski botun saldırı uyarılarını yok saymasıyla yeniden üretildi. Yasal ücretli ateşkes tepkisi kendi Faz 2 paketine taşındı; aynı senaryo 40.560 dakikada tüm gereksinimleri sağlayarak geçti. Faz 3 ayrıca kayıp merkezi yeniden ferman edebilir. Kaynak/asker/zafer enjekte edilmez; zafer assertion'ları korunur.
- Katkı ölçümü: aynı ekonomi tohumu 1.747 yerine 932 başarılı oyuncu emri; yalnız 18 saatlik aşama emri, sıfır tekrarlı tek-katkı emri. Zaman/kota/kaynak maliyetleri gerçek; erken zafer yok.
- Mevcut built Chromium: 1280/1920/360/390, 20 kontrol PASS. Harita/zoom/touch/seçim, gerçek inşa/keşif/bağlama/yurt, save/reload ve Back korunur.
- Gerçek scoped service worker + IndexedDB: ağın gerçekten kapandığı doğrulandı; ikinci offline reload, ücretli offline işlem, manual save, önceki otomatik kayıt kurtarma, geçerli/geçersiz import, reconnect PASS.
- Yeni özellik kabulü 390/1440: gerçek katkı/iptal düğmeleri, 1.500 kaynak ödemesi, offline manual reload, chronicle ve zafer facts kalıcılığı, gerçek guarded zafer UI PASS. Yeni kaynaklar built paketle eşleşir. Ekran görüntüleri incelendi.
- Eski V1 alanı olmayan kayıtların byte eşdeğer roundtrip'i, checksum/future version, legacy HANEDAN ham kayıt kurtarma testleri korunur. Yeni hafıza alanları isteğe bağlı/doğrulanmış/sınırlıdır.

Yeni 20 dakikalık soak veya fiziksel iOS/Android kabulü iddia edilmez. Nihai GitHub CI durumunu merge koordinatörü exact head üzerinden kontrol etmelidir. Merge veya deployment yapılmadı.
