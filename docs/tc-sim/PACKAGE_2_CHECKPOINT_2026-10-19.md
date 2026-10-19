# Paket 2 — kanıtlı durum ve devam

Canonical başlangıç1e9265f59834178ff19d813507da0b7334d818ef. Paket1 mevcut oyun kapsamıyla kapalı; yeni finans özelliği açılmaz. Eski TC_SIM_ROADMAP prototip hedefleri güncel kullanıcı kararlarının önüne geçmez: çocuk6–17, maaş pazarlığı, aile mali tasfiye, kriz/afet eklenmez.

| Hedef | Mevcut kanıt | Durum / kalan sınır |
|---|---|---|
| Haftalık yaşam ve zaman | time.js canApplyDecision; state.js getWeeklyActivityLimit; core/3b/hardening testleri | Uygulanmış; kritik sağlık kotası ve iş/eğitim taahhütleri mevcut. Gözaltı karar bypass düzeltmesi bu PR'da |
| Stres ve toparlanma | time.js getRestEnergyGain; body-systems.js processLongTermBody; depth-4 gerçek120/180 haftalık zincirleri | Uygulanmış; dinlenme anlık tam iyileşme sağlamaz; tedavi sonrası toparlanma/nüks mevcut. #188 iş maruziyeti düzeltmesi release bekliyor |
| Sağlık ve çalışma kapasitesi | body-events.js, body-systems.js; time.js body-care/overtime; life.js updateCareerProgress; depth-4 kapasite/bakım testleri | PARTIAL: bakım, kronik etki, kritik sağlık/ek mesai engeli ve performans etkisi var. Ayrıntılı hastane/tedavi ve süreli iş göremezlik yok; DONE sayılmaz |
| Eğitim ve beceri | education.js önkoşul/yük; life.js ilerleme/diploma; tc-sim-3b.test.mjs ve depth-4 eğitim toparlanma testi | Uygulanmış temel model. Kayıt kararı bilerek sıfır aktivite hakkı tüketir (3b test6); haftalık eğitim yükü ayrıca işler, yeniden tasarlanmaz |
| Kariyer sürekliliği | life.js offer/start/progress/experience; depth2 iş güvenliği; 3b/depth2 testleri | Temel uygulanmış; #187 gözaltında çalışılmamış deneyim/yük düzeltmesi release bekliyor; bu PR haftalık kariyer eylemi bypass'ını kapatır |
| Yaşlanma ve uzun vadeli sonuçlar | lifetime.js, late-life/depth-4, finance-acceptance gerçek1200 karar haftası | Mevcut oyun modeli testli; kapsamlı tıbbi/gerçek mevzuat simülasyonu değildir |

Üç küçük düzeltme ayrı davranışları korur: #187 çalışılmamış hafta yükü/deneyimi; #188 otomatik mesleki sağlık maruziyeti; bu PR oyuncunun haftalık iş/taşınma kararının mevcut gözaltı kuralını aşması. Eski kayıt alanı ve UI değiştirilmez. Eğitim, zorunlu olay taşınmaları ve mevcut sağlık zincirleri topluca engellenmez.

Sonraki kesin iş: mevcut sağlık kapasitesi modelindeki süreli iş göremezlik boşluğunu, kayıt/maaş/iş güvenliği etkilerini açıkça ayıran küçük bir uygulama olarak kapatmak; tıbbi doğruluk veya yasal ücret hakkı uydurmamak. Paket2 bütünü henüz DONE değildir. Paket3'e geçiş, kalan hedeflerin testli kabulünden sonra yapılır. En fazla üç açık geliştirme PR'ı; her release yeni canonical main'e uzlaştırılıp güncel CI PASS ile yapılır. Fiziksel cihazlar kullanıcıya aittir.
