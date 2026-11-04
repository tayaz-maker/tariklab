# SOCIAL ENGINE — ACCEPTANCE_TESTS.md

**Sürüm:** 1.0. **Durum:** Kabul şartnamesi, henüz test yürütülmedi.

## Kurallar

Astra önce TarikLab, TC SIM, TC SIM Boardworld ve Racon Manager kodlarını, mevcut testleri, kayıt alanlarını ve deployment mekanizmasını inceler; `artifacts/inventory.json` üretir. Eski oyunlar değiştirilemez veya bozulamaz. SOCIAL ENGINE ayrı rota ve kayıt namespace kullanır.

**PASS:** kanıtlı başarı. **FAIL:** ihlal. **SKIP:** gerekçeli atlama. **UNVERIFIED:** kanıt yok, test çalıştırılamadı veya sonuç kararsız. SKIP/UNVERIFIED PASS değildir. **P0:** herhangi bir PASS dışı sonuç production BLOCK. **P1:** herhangi bir PASS dışı sonuç Gold BLOCK. **P2:** belgelenmiş kusur, açık onayla ertelenebilir. Kapsam değişiklikleri yazılı onay ister.

Her test sonucu `id, precondition, action, expected, priority, automation, status, evidence, seed, environment, build_sha, duration_ms` alanlarını taşır. Gerçek tarayıcı testleri, simülasyon invariant testleri ve manuel oynanış ayrı raporlanır. Test sayısı kalite kanıtı değildir.

## Test kataloğu


### İlk açılış

| ID | Önem | Önkoşul | İşlem | Beklenen sonuç | Otomasyon |
|---|---|---|---|---|---|
| SE-001 | P0 | Temiz profil | URL aç | Menü hatasız açılır | Playwright |
| SE-002 | P0 | Kayıt yok | Yeni oyun | Tek oyuncu oluşur | E2E |
| SE-003 | P1 | Başlatma ekranı | Çift tıkla | Çift kayıt oluşmaz | E2E |

### Karakter oluşturma

| ID | Önem | Önkoşul | İşlem | Beklenen sonuç | Otomasyon |
|---|---|---|---|---|---|
| SE-004 | P0 | Form açık | Karakter oluştur | Seçimler korunur | E2E |
| SE-005 | P0 | Form açık | Geçersiz ad | Güvenli doğrulama | E2E |
| SE-006 | P1 | Puan bütçesi | Limiti aş | Aşım engellenir | Property |

### İzometrik hareket ve kamera

| ID | Önem | Önkoşul | İşlem | Beklenen sonuç | Otomasyon |
|---|---|---|---|---|---|
| SE-007 | P1 | Harita açık | WASD ve tıklama | Doğru koordinat | E2E |
| SE-008 | P1 | Harita kenarı | Kamera takip | Sınır korunur | E2E |
| SE-009 | P1 | Oyun açık | Pencereyi boyutlandır | Hedef kaymaz | E2E |

### Çarpışma ve navigasyon

| ID | Önem | Önkoşul | İşlem | Beklenen sonuç | Otomasyon |
|---|---|---|---|---|---|
| SE-010 | P0 | Duvar var | Duvara koş | Duvar geçilmez | Physics |
| SE-011 | P0 | Kapalı yol | Rota iste | Geçerli rota veya ret | Graph |
| SE-012 | P0 | Harita sınırı | Dışarı yürü | Geçersiz konum yok | Fuzz |

### Bina giriş çıkış

| ID | Önem | Önkoşul | İşlem | Beklenen sonuç | Otomasyon |
|---|---|---|---|---|---|
| SE-013 | P1 | Bina açık | İçeri gir | Doğru sahne | E2E |
| SE-014 | P0 | İç mekân | Dışarı çık | Doğru kapı | E2E |
| SE-015 | P1 | Geçiş aktif | Etkileşimi tekrarla | Çift oyuncu yok | Invariant |

### NPC etkileşimleri

| ID | Önem | Önkoşul | İşlem | Beklenen sonuç | Otomasyon |
|---|---|---|---|---|---|
| SE-016 | P0 | NPC yakın | Konuş | Doğru diyalog | E2E |
| SE-017 | P0 | NPC hareketli | Sahne değiştir | Tek canonical konum | Invariant |
| SE-018 | P1 | NPC meşgul | Eşzamanlı konuş | Çift işlem yok | Race |

### Meslekler ve kazanç

| ID | Önem | Önkoşul | İşlem | Beklenen sonuç | Otomasyon |
|---|---|---|---|---|---|
| SE-019 | P1 | İş var | Vardiya tamamla | Ücret ödenir | E2E |
| SE-020 | P0 | Vardiya bitti | İki kez tahsil | Tek ödeme | Ledger |
| SE-021 | P1 | İki iş var | İş değiştir | Takvim güncel | Integration |

### Ekonomi alışveriş borç

| ID | Önem | Önkoşul | İşlem | Beklenen sonuç | Otomasyon |
|---|---|---|---|---|---|
| SE-022 | P0 | Bakiye var | Ürün al | Stok ve nakit mutabık | Ledger |
| SE-023 | P0 | Bakiye yetersiz | Ürün al | Yetkisiz negatif yok | Property |
| SE-024 | P0 | Borç var | Faiz ve ödeme | Borç defteri mutabık | Ledger |

### Sosyal ilişkiler hafıza

| ID | Önem | Önkoşul | İşlem | Beklenen sonuç | Otomasyon |
|---|---|---|---|---|---|
| SE-025 | P1 | İki karakter | Etkileş | İlişki değişir | Simulation |
| SE-026 | P0 | İlişki var | Kaydet yükle | Grafik korunur | Roundtrip |
| SE-027 | P1 | Gizli olay | NPC bilgisini kontrol et | Nedensiz bilgi yok | Invariant |

### Çete itibar polis

| ID | Önem | Önkoşul | İşlem | Beklenen sonuç | Otomasyon |
|---|---|---|---|---|---|
| SE-028 | P0 | İtibar aktif | Puan değiştir | Etkiler tutarlı | Simulation |
| SE-029 | P0 | Suç var | Tanık ve polis tetikle | Kurala uygun tepki | Scenario |
| SE-030 | P1 | Takip var | Kaç veya teslim ol | Takip sonlanır | FSM |

### Dövüş ve araçlar

| ID | Önem | Önkoşul | İşlem | Beklenen sonuç | Otomasyon |
|---|---|---|---|---|---|
| SE-031 | P1 | Dövüş var | Saldır savun | Can stamina tutarlı | E2E |
| SE-032 | P0 | Yol grafı | Araç rotası | Yalnız sürülebilir kenarlar | Graph |
| SE-033 | P0 | Araç var | Bin sür kaydet | Konum korunur | E2E |

### Dinamik görevler

| ID | Önem | Önkoşul | İşlem | Beklenen sonuç | Otomasyon |
|---|---|---|---|---|---|
| SE-034 | P1 | Üretici var | 100 görev üret | Geçerli hedefler | Property |
| SE-035 | P0 | Görev var | Bitir ödülü tekrarla | Tek ödül | FSM |
| SE-036 | P1 | Hedef kayıp | Timeout uygula | Sonsuz döngü yok | Fault |

### Simülasyon tutarlılığı

| ID | Önem | Önkoşul | İşlem | Beklenen sonuç | Otomasyon |
|---|---|---|---|---|---|
| SE-037 | P0 | 1000 NPC | 100000 tick | Tek konum | Invariant |
| SE-038 | P0 | Ekonomi var | İşlem döngüsü | Ledger mutabık | Invariant |
| SE-039 | P0 | Seed sabit | İki kez çalıştır | Hash eşit | Determinism |

### Kayıt ve yükleme

| ID | Önem | Önkoşul | İşlem | Beklenen sonuç | Otomasyon |
|---|---|---|---|---|---|
| SE-040 | P0 | Dolu dünya | Kaydet yükle | State eşdeğer | Roundtrip |
| SE-041 | P0 | Yazma sürüyor | Sekmeyi kapat | Sağlam kayıt korunur | Fault |
| SE-042 | P0 | Çoklu slot | Sil kopyala | Kayıp veya çoğalma yok | E2E |

### Şema migrasyonu

| ID | Önem | Önkoşul | İşlem | Beklenen sonuç | Otomasyon |
|---|---|---|---|---|---|
| SE-043 | P0 | Eski SE fixture | Migrate et | Veri korunur | Migration |
| SE-044 | P0 | Migrasyon sürüyor | Kes yeniden dene | İdempotent | Fault |
| SE-045 | P0 | Eski TC SIM kaydı | SE aç | Eski namespace değişmez | Regression |

### 365 gün simülasyon

| ID | Önem | Önkoşul | İşlem | Beklenen sonuç | Otomasyon |
|---|---|---|---|---|---|
| SE-046 | P0 | 1000 NPC | 365 gün çalıştır | Sıfır invariant ihlali | Headless |
| SE-047 | P0 | Ekonomi var | 365 gün mutabakat | Sıfır açıklanamayan fark | Ledger |
| SE-048 | P0 | 180 gün kayıt | Yükle 365e devam | Hash aynı | Determinism |

### Performans bellek

| ID | Önem | Önkoşul | İşlem | Beklenen sonuç | Otomasyon |
|---|---|---|---|---|---|
| SE-049 | P0 | Referans PC | 30 dk oyna | p95 frame <=33.3ms | Trace |
| SE-050 | P1 | 1000 NPC | 60 dk çalıştır | Long task <=%5 | Trace |
| SE-051 | P1 | GC kontrollü | 2 saat soak | Heap eğimi <=1MB/dk | Profiler |

### Tarayıcı uyumluluğu

| ID | Önem | Önkoşul | İşlem | Beklenen sonuç | Otomasyon |
|---|---|---|---|---|---|
| SE-052 | P0 | Chromium güncel | Kritik akışı oyna | Fatal hata yok | Playwright |
| SE-053 | P1 | Firefox güncel | Kritik akışı oyna | Temel işlevler çalışır | Playwright |
| SE-054 | P1 | WebKit güncel | Kritik akışı oyna | Temel işlevler çalışır | Playwright |

### UI erişilebilirlik

| ID | Önem | Önkoşul | İşlem | Beklenen sonuç | Otomasyon |
|---|---|---|---|---|---|
| SE-055 | P0 | HUD açık | Değerleri değiştir | HUD tutarlı | E2E |
| SE-056 | P1 | Menü açık | Klavye ile gezin | Odak görünür | Axe |
| SE-057 | P1 | İki viewport | Ekranı değiştir | Kontroller taşmaz | Visual |

### Deployment production

| ID | Önem | Önkoşul | İşlem | Beklenen sonuç | Otomasyon |
|---|---|---|---|---|---|
| SE-058 | P0 | PR hazır | CI çalıştır | Kapılar geçer | CI |
| SE-059 | P0 | Deploy tamam | ID ve SHA doğrula | Canlı commit doğru | Provider API |
| SE-060 | P0 | Canlı URL | Oyun ve eski oyun smoke | Yeni ve eski oyunlar çalışır | Playwright |

## Zorunlu invariantlar

- Her NPC için her tick yalnız bir canonical konum; sahne geçişinde çift aktif konum yasak.
- Tüm parasal işlemler tamsayı kuruş/fixed-point ve çift taraflı defter ile mutabık; yetkisiz negatif bakiye, negatif stok, çift ödeme yasak.
- Kayıtlar atomik, checksum kontrollü, benzersiz slot ID'li; save/load ve migrasyon idempotent; eski TC SIM namespace'i korunur.
- Oyuncu collider'ı duvarla kesişemez; araç rotası yalnız bağlı, yönü ve türü izinli yol kenarlarından oluşur.
- Görevler tanımlı FSM ve terminal/timeout/iptal yolu içerir; ödül tam bir kez verilir.
- Aynı seed, olay akışı, sürüm ve sanal saat aynı canonical state hash üretir.

## Test çalıştırma matrisi

**Unit/property:** her PR'da ledger, pathfinding, FSM, migrasyon, kayıt, invariant fuzz. **Simülasyon:** sabit seed ile en az 1.000 NPC, 365 gün, günlük checkpoint ve ledger denetimi. **Gerçek tarayıcı:** Playwright Chromium, Firefox, WebKit, temiz profil; karakter → hareket → NPC → iş → alışveriş → görev → kaydet → yükle; video, trace, console, ekran görüntüsü. **Manuel:** en az iki ayrı 30 dakikalık gerçek insan oynanış oturumu; serbest dolaşım ve ekonomi/sosyal/suç döngüsü; kayıtlı bulgular. **Regresyon:** TC SIM, TC SIM Boardworld ve Racon Manager rotaları ve kayıtları bozulmamış olmalı.

Performans referansı: 4 çekirdekli orta sınıf PC, 16 GB RAM, 1080p, güncel Chromium; CPU/GPU/OS/ağ koşulları raporlanır. Eşikler başlangıç hedefidir; değiştirmek için gerekçeli ve onaylı karar gerekir. 365 günlük test yalnız simülasyon kanıtıdır, gerçek tarayıcı oynanışı yerine geçmez.

## Yayın kapısı

```text
inventory(); unit_property_invariants(); migration(); simulate_365_days()
real_browser_chromium_firefox_webkit(); legacy_regression()
manual_playtest_evidence(); performance_audit()
if any(P0.status != PASS) or missing_required_evidence: BLOCK_PRODUCTION
if any(P1.status != PASS): BLOCK_GOLD
verify_staging_sha_and_smoke()
if staging_failed: BLOCK_PRODUCTION
deploy_production()
verify_provider_deployment_id_sha_alias_and_live_browser_smoke()
if verification_failed: ROLLBACK_OR_HOLD; REPORT_FAIL
else: RELEASE_VERIFIED
```

Deployment komutunun başarılı dönmesi, HTTP 200 veya build sonucu yeterli değildir. Canlı URL, gerçek trafik/alias, provider deployment ID ve commit SHA eşleşmesi, yeni oyun ve eski oyunlar için production smoke zorunludur. Rollback planı önceden sınanır.

## Kanıt ve teslim raporu

Dosyalar: `artifacts/results.json`, `artifacts/browser/`, `artifacts/invariants/`, `artifacts/simulation-365/`, `artifacts/performance/`, `artifacts/manual-playtest.md`, `artifacts/legacy-regression.json`, `artifacts/deployment-verification.json`, `artifacts/release-report.md`.

Sonuçlar **PASS**, **FAIL**, **SKIP**, **UNVERIFIED** olarak dört ayrı tabloya ayrılır; her kayıtta ID, neden, kanıt yolu, sorumlu ve yeniden deneme bilgisi bulunur. Tarayıcı, invariant ve manuel testlerin her birinin ayrı kabul kararı verilir.

```yaml
product: SOCIAL ENGINE
release_decision: BLOCKED | GOLD_BLOCKED | RELEASE_VERIFIED
commit_sha: REQUIRED_FULL_SHA
pull_request_url: REQUIRED
deployment_provider: REQUIRED
deployment_id: REQUIRED
deployment_commit_sha: REQUIRED
production_url: REQUIRED
production_verified_at_utc: REQUIRED
results: {pass: 0, fail: 0, skip: 0, unverified: 0}
real_browser_results: REQUIRED_EVIDENCE
invariant_results: REQUIRED_EVIDENCE
manual_playtest_results: REQUIRED_EVIDENCE
simulation_365_days: REQUIRED_EVIDENCE
legacy_regressions: REQUIRED_EVIDENCE
performance: {device: REQUIRED, p95_frame_ms: REQUIRED, long_task_ratio: REQUIRED, heap_slope_mb_min: REQUIRED, lcp_p75_ms: REQUIRED, cls: REQUIRED}
known_issues: []
blocking_issues: []
rollback_plan_and_status: REQUIRED
evidence_manifest: REQUIRED
```

Eksik SHA, PR, deployment kimliği, performans ölçümü veya test kanıtı uydurulmaz; `UNVERIFIED` işaretlenir ve ilgili yayın kapısı kapanır.
