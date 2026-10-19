# Paket 2 — bütünleşik kabul kapısı

Canonical başlangıç72c04da29c7ee3458fd4349ee8c69517f08b4730 (#187). Release sırası#188→#189→#190. Bu belge yeni özellik talebi veya kapanış iddiası değildir. Son canonical entegrasyonunda hazırlanmış kabul testi de alınmalı; sırf bu hazırlık için çalışan CI head'leri yeniden başlatılmaz.

| Kabul | Kanıt / değişmez |
|---|---|
| Geçici iş göremezlik ve dönüş | tc-sim-work-recovery: gerçek iki advanceWeek, reload, kritik sağlıkta sürenin tek başına işe döndürmemesi, sonra tek çalışılmış hafta |
| Çakışan engeller ve eğitim sürekliliği | tc-sim-package2-acceptance: V5/V6, eğitim+bakım+gözaltı, her hafta gerçek karar/olay/advanceWeek ve reload; her iki engel bitmeden iş deneyimi/kariyer/çalışma sayacı ilerlemez; eğitim taahhüdü ve ücret modeli korunur |
| Maaş ve çalışma kaydı | Aynı testlerde gerçek ay sonu tek net maaş, ikinciSGK kesintisi yok; gözlenen çalışma sayacı yalnız çalışılan haftada artar. Bu, yasal SGK primi veya hastalık ödeneği iddiası değildir |
| Gerçek aşırı çalışma ve toparlanma | depth-4 gerçek120/180 haftalık zincirleri; bakım yönetir, anlık tam iyileştirmez; nüks/iyileşme, ek mesai engeli, eğitimden doğan düşük toparlanma korunur |
| Haftalık zaman ve karar tutarlılığı | detained-work, unavailable-work-health, detained-career-actions; reddedilen karar state/nakit/zamanı değiştirmez. Eğitim kaydı mevcut tasarım gereği sıfır hak; haftalık öğrenim yükü ayrıca uygulanır |
| Eğitim/beceri/kariyer | 3b, hardening, depth2 iş güvenliği ve 3D/depth4; önkoşul/diploma, gecikmiş işe başlama, iş deneyimi ve performans mevcut motorla devam eder |
| Yaşlanma ve uzun vadeli sonuç | late-life/lifetime, gerçek1200 karar haftası/25 oyun yılı ve profil koşuları; ölüm/son durum gizlenmez, para/borçlar affedilmez |
| Save ve UI | V5/V6, SAVE_VERSION6; opsiyonel toparlanma alanı eksikse geçmiş yaratılmaz. TR/EN/PL×1280/390 Body care→mevcut clinic→reload/ücret/metin/overflow gerçek browser CI kapısı |

Hazırlık sonucu: güncel birleşik724/724 tam TC SIM/frozen-baseline koşusuPASS, sıfırfail/skip; lint/typecheck/buildPASS. V5/V6 çakışma kabulü de bu koşuda yer aldı. Browser fixture'da sağlık ocağından sonra mevcut job_security_warning olayı açıldığı kanıtlandı; test artık gerçek recover seçimini yapıp modalın kapanmasını bekler. Oyun motoru değiştirilmedi. Düzeltilmiş1280/390×TR/EN/PL gerçek browser CI sonucu hâlâ release kapısıdır; fiziksel cihazlar kullanıcıya aittir.

Kapanış: üç PR sıralı canonical main'e entegre edilmiş, tüm güncel zorunlu kontrollerPASS, production aynı canonical SHA'daREADY ve bu kabul seti canonical üzerinde çalıştırılmış olmalı. O zaman yalnız doğrulanmış oyun kapsamıDONE; ayrıntılı tıp/kanuni iş göremezlik veya tamSGK simülasyonu iddia edilmez. Kalan gerçek kabul hatası küçük düzeltmeyle kapatılır; yeni kapsam veya dördüncüPR açılmaz. Paket3'e bundan sonra geçilir.
