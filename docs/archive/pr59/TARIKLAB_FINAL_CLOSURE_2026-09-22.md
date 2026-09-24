# TarikLab — Final Closure Kaydı

**Karar: `NOT CLOSED`**

Üç PR'ın hiçbiri `main`i hedeflemiyor. Handoff'un değişmez kuralı 3 ("hedef `main` değil ise dur ve raporla") ve yürütme promptunun kuralı 2 gereği **hiçbir merge ve hiçbir production deploy yapılmadı**. Bu kayıttaki her değer GitHub API'si veya yerel `git` çıktısından alındı; doğrulanamayan maddeler açıkça BLOCKED / NOT VERIFIED olarak işaretlendi.

| Alan | Değer |
|---|---|
| Yürütme zamanı | 2026-09-22, keşif ~20:35Z – kayıt 20:50Z (UTC) |
| Ortam | Claude Code uzak Linux konteyneri (x86_64, headless Chromium 1194); dış trafik ajan proxy'si üzerinden |
| Çalışma alanı | `/home/user/cete-savaslari` (tariklab), `/home/user/jitem-derin-ag`; testler ayrık `git worktree`lerde (scratchpad) |
| Referans handoff | `TARIKLAB_FINALIZATION_HANDOFF_2026-09-22.md` |
| Önceki kapanış dosyası | `TARIKLAB_CLOSURE_2026-09-22.md` — diskte ve repolarda **bulunamadı** (`find /` ile arandı) |

---

## Aşama 0 — Keşif ve çalışma alanı güvenliği

### Yerel checkout'lar (değiştirilmedi)

| Yol | Remote | Branch | HEAD | `git status --short` |
|---|---|---|---|---|
| `/home/user/cete-savaslari` | tayaz-maker/cete-savaslari (→ tariklab) | `sonnet/hanedanian-darbe-design-refinement` | `b07f75f90d4c8389592fb30be4d4ab33cfbe0562` | temiz |
| `/home/user/jitem-derin-ag` | tayaz-maker/jitem-derin-ag | `sonnet/jitem-product-design-refinement` | `c7bf22f9aa729da26bec78e7f41a846b0d33ca78` | temiz |
| `/home/user/tayaz-maker/jitem-derin-ag` | tayaz-maker/jitem-derin-ag | `main` | `85bfa63635cfa5358ed3472cb59eb887887dda9d` | temiz |
| `/home/user/worktrees/darbe-repair-2` | tayaz-maker/cete-savaslari | `grok/darbe-h-balance-repair-2` | `df44df475f5ca172785eec987e41d29a67cf415f` | temiz |
| `/home/user/worktrees/dh-fv2` | tayaz-maker/cete-savaslari | `claude/darbe-h-final-verification-2` | `6052b48b49511a4f1ff0092d24457ce0574500e3` | temiz |
| `/home/user/tariklab-content` | tayaz-maker/tariklab-content | `opus/gameplay-balance-clarity` | `70ab4f365a782018d8d5dc048903949361dcf118` | temiz |

Hiçbir yerel değişiklik silinmedi, stash'lenmedi veya commit'lenmedi.

### Canonical `main` (merge öncesi = şu an, değişmedi)

| Repo | `origin/main` |
|---|---|
| tayaz-maker/tariklab | `3f9264235a31a01c29dd1bcc21eaced7af5ed0e3` — "fix: sync JITEM embedded scroll runtime" |
| tayaz-maker/jitem-derin-ag | `99836618c77b448a90a83c136e5a86fca21b4d9b` |

### PR kaydı (GitHub API)

| PR | Başlık | Source → **Base** | Head SHA | Durum | Draft | mergeable_state |
|---|---|---|---|---|---|---|
| [tariklab#57](https://github.com/tayaz-maker/tariklab/pull/57) | Polish TarikLab install identity on the existing portal categories | `astra/portal-identity-categories` → **`terra/portal-game-categories`** | `2388234674ce19a12be29f3b578551e34b1aad35` | open | evet | unstable* |
| [tariklab#58](https://github.com/tayaz-maker/tariklab/pull/58) | Close preserved HANEDANIAN and DARBE-H! visual candidate | `astra/hanedanian-darbe-ultimate-visual` → **`sonnet/hanedanian-darbe-design-refinement`** | `2af76e73df344dbf0e64fd69737cef18a2c6e7bf` | open | evet | unstable* |
| [jitem-derin-ag#14](https://github.com/tayaz-maker/jitem-derin-ag/pull/14) | Complete the existing JITEM product wave and repair its stale regression test | `astra/jitem-ultimate-product-wave` → **`sonnet/jitem-product-design-refinement`** | `0d0319532d6a02f42583edf9fcd38ba154c5c786` | open | evet | clean |

\* İlk okumada `campaign-browser` işi `in_progress` idi; sonradan her iki PR'da da `success` ile tamamlandı (aşağıda CI tablosu).

Üç PR'ın gövdesinde de açıkça **"Do not merge automatically."** yazıyor.

### Yığın (stack) zinciri — `main`e merge edilirse fiilen neler girer

| Hedef PR | Zincir (alttan üste) | Alttaki PR'lar merge edilmiş mi? |
|---|---|---|
| #57 | `main` ← [#56](https://github.com/tayaz-maker/tariklab/pull/56) `0c372fa` ← #57 `2388234` | #56 open, "Not merged by design." |
| #58 | `main` ← [#54](https://github.com/tayaz-maker/tariklab/pull/54) `c89300d` ← [#55](https://github.com/tayaz-maker/tariklab/pull/55) `3ec421f`,`b07f75f` ← #58 `2af76e7` | #54 open ("Do not merge without explicit instruction"), #55 open/draft ("Do not merge — WIP") |
| #14 | `main` ← #12 `faf6a06` ← [#13](https://github.com/tayaz-maker/jitem-derin-ag/pull/13) `c7bf22f`,`9d5b520` ← #14 `5e8c4ae`,`0d03195` | #12 ve #13 open, merge edilmemiş |

Yani herhangi bir PR'ı `main`e almak, açıkça "merge etme" denmiş 5 ayrı PR'ı da örtük olarak `main`e taşır.

---

## Aşama 1 — Diff, ancestry ve yeniden test kapısı

### Ancestry / diff kanıt tablosu

| Kontrol | #57 | #58 | #14 |
|---|---|---|---|
| Beklenen SHA | `2388234674ce…` | `2af76e73df34…` | `0d0319532d6a…` |
| Gerçek PR head | `2388234674ce…` (aynı) | `2af76e73df34…` (aynı) | `0d0319532d6a…` (aynı) |
| `merge-base --is-ancestor <beklenen> <head>` | YES | YES | YES |
| `merge-base(origin/main, head)` | `3f92642` (güncel main) | `3f92642` (güncel main) | `9983661` (güncel main) |
| `main..head` commit sayısı | 2 | 4 | 5 |
| `origin/main...head` diffstat | 20 dosya, +137 / −36 | 389 dosya, +4940 / −6030 | 28 dosya, +1817 / −278 |
| Yalnız PR'ın kendi diff'i (base..head) | 17 dosya, +55 / −31 | 383 dosya, +4784 / −6310 | 16 dosya, +864 / −106 |
| `package.json` / lockfile / `wrangler.*` / workflow değişikliği | yok | yok | yok |
| **Base = `main`?** | **HAYIR** | **HAYIR** | **HAYIR** |

Not: `/home/user/jitem-derin-ag` sığ (shallow) klon; `merge-base` yine de güncel `main` SHA'sını döndürdü.

### Diff kapsamı değerlendirmesi

- **#57 yığını** — portal kategori gruplaması (#56) + PWA kimliği: `public/manifest.webmanifest`, `public/brand/*` ikonlar (192/512/maskable/apple-touch), `src/components/portal/portal-home.tsx`, `src/lib/games.ts`, `src/lib/i18n.ts`, `src/routes/__root.tsx`, `src/lib/og/site.json`, iki test ve `docs/portal-identity/*`. Beyan edilen kapsamla tutarlı.
- **#58 yığını** — 363 dosya `public/games/darbe-h/*`, 2 dosya `public/games/hanedanian/*`, DARBE üretim/QA scriptleri ve testleri. Ayrıca PR #55'ten gelen **Kaynaklar atıf temizliği** (`public/i18n/tlab-i18n.js`, `scripts/site-credits-help.test.mjs`, `scripts/i18n-layer.test.mjs`) — "HANEDANIAN/DARBE-H!" başlığının dışında ama yığında taşınıyor.
- **#14 yığını** — JITEM `src/` oyun/UI değişiklikleri (#12 + #13 + #14).
- **Çapraz çakışma:** #57 ve #58 yığınlarının ikisi de `docs/WEB_APP_SYNC_LEDGER.md` dosyasını değiştiriyor — sıralı merge'de conflict olasılığı var (test edilmedi, merge yapılmadı).

### CI / check durumu (GitHub, son okuma 20:50Z)

| Check | #57 (`2388234`) | #58 (`2af76e7`) | #14 |
|---|---|---|---|
| `build` (npm test, duel stress, typecheck, lint, build, responsive regression) | success | success | — |
| `campaign-balance` | success | success | — |
| `campaign-browser` | success (20:40:51Z) | success (20:45:53Z) | — |
| Workers Builds: tariklab (Cloudflare) | success | success | — |
| Vercel Preview Comments | success | success | — |
| Toplam | 5/5 yeşil | 5/5 yeşil | **0 check tanımlı** (repo'da CI yok) |

### Bu oturumda PR head'lerinde yerel olarak yeniden koşulan testler

Her head ayrı, detached bir `git worktree` içinde çalıştırıldı (bağımlılıklar değişmediği için `node_modules` mevcut checkout'tan bağlandı).

| PR / head | Komut | Sonuç | Handoff'taki önceki kayıt |
|---|---|---|---|
| #57 `2388234` | `node --experimental-strip-types --test scripts/portal-categories.test.mjs scripts/grok-pwa-plugin.test.mjs` | **49/49 PASS** | 49/49 PASS ✔ |
| #57 | `tsc --noEmit` | PASS (exit 0) | PASS ✔ |
| #57 | `npm run build` | PASS — `.output/server/wrangler.json` üretildi (Cloudflare preset) | PASS ✔ |
| #58 `2af76e7` | `node --test scripts/hanedanian-map.test.mjs scripts/darbe-h-art.test.mjs` | **12/12 PASS** | 12/12 PASS ✔ |
| #58 | + `scripts/i18n-layer.test.mjs scripts/site-credits-help.test.mjs` (değişen tüm test dosyaları) | **43/43 PASS** | — |
| #58 | `tsc --noEmit` | PASS (exit 0) | PASS ✔ |
| #58 | `npm run build` | PASS — `.output/server/wrangler.json` üretildi | PASS ✔ |
| #14 `0d03195` | `tsc --noEmit` | PASS (exit 0) | PASS ✔ |
| #14 | `npm run test:game` | **83/83 PASS** | 83/83 PASS ✔ |
| #14 | `npm test` (iki runner) | **149/149** + **107/107 PASS** | — |

`npm run build` içindeki `db:migrate` adımı `DATABASE_URL` olmadığından "skipping" dedi (beklenen davranış).

### Merge kapısı sonucu

| Şart | #57 | #58 | #14 |
|---|---|---|---|
| Head beklenen değişikliği içeriyor | ✔ | ✔ | ✔ |
| Hedef dal `main` | ✘ | ✘ | ✘ |
| Merge conflict yok | NOT VERIFIED (`main`e karşı açılmış PR yok) | NOT VERIFIED | NOT VERIFIED |
| Zorunlu kontroller yeşil | ✔ (5/5) | ✔ (5/5) | ✘ (hiç check yok; yerel yeniden doğrulama ✔) |
| Diff açıklanan kapsamla tutarlı | ✔ (ama #56'yı da taşıyor) | kısmen (#54, #55 ve Kaynaklar değişikliğini de taşıyor) | ✔ (ama #12, #13'ü de taşıyor) |
| Gizli/yerel konfigürasyon farkı yok | ✔ | ✔ | ✔ |
| **Kapı** | **FAIL** | **FAIL** | **FAIL** |

PR'ların base'ini `main`e çevirmek ya da alttaki PR'ları sırayla merge etmek "başka bir PR/branch ile tahmin yürütme" olacağından yapılmadı.

---

## Aşama 2 — Merge ve canonical SHA kaydı

| Repo | Merge öncesi `main` | Merge edilen PR | Merge commit | Merge sonrası `main` | Merge sonrası test |
|---|---|---|---|---|---|
| tariklab | `3f9264235a31a01c29dd1bcc21eaced7af5ed0e3` | — (yok) | — | `3f9264235a31a01c29dd1bcc21eaced7af5ed0e3` (değişmedi) | N/A |
| jitem-derin-ag | `99836618c77b448a90a83c136e5a86fca21b4d9b` | — (yok) | — | `99836618c77b448a90a83c136e5a86fca21b4d9b` (değişmedi) | N/A |

**BLOCKED** — Aşama 1 kapısı üç PR'da da başarısız.

---

## Aşama 3 — Cloudflare production deploy

### Mevcut production mekanizması (repo kanıtı)

`OPS.md` ("Production deploy — Cloudflare Workers"):

- Canonical production: mevcut Cloudflare Worker **`tariklab`** → `https://tariklab.tayaz29.workers.dev/`
- Mekanizma: **Cloudflare Workers Builds**, GitHub repo `tayaz-maker/tariklab`, **production branch `main`**
- Build: `npm run build`; deploy: `npx wrangler deploy`; worker adı Nitro `cloudflare-module` preset'inden (`vite.config.ts`)
- Token Cloudflare tarafında yönetiliyor; repo'da `wrangler.*` dosyası ve deploy scripti yok. Vercel canonical hedef değil.

Doğrulama: PR check'lerindeki `Workers Builds: tariklab` bağlantısı `dash.cloudflare.com/…/workers/services/view/tariklab/production/builds/…` gösteriyor. Mekanizma `main`e push ile tetikleniyor.

### Deploy sonucu

| Alan | Değer |
|---|---|
| Deploy yapıldı mı | **HAYIR — BLOCKED** (merge yok; production branch `main` değişmedi) |
| Deploy ID / timestamp | yok |
| Şu an canlı olan içerik | `main` `3f92642` ile eşleşiyor (aşağıda) |

### Canlı production'ın hangi commit olduğu (içerik parmak izi)

Versiyon endpoint'i yok (`/version.json`, `/__version`, `/api/version` → 404). Canlı dosyalar SHA1 ile git içeriğiyle karşılaştırıldı:

| Dosya | Canlı hash | Eşleşen ref'ler |
|---|---|---|
| `manifest.webmanifest` | `5f89e69976` | main, #58 (#57 değil) |
| `games/hanedanian/map.js` | `8b1d7cfb9b` | main, #57 (#58 değil) |
| `games/duel-core/design.css` | `fe8a4c6eba` | main, #57 (#58 değil) |
| `credits.html` | `2ebdb925bd` | main, #57 (#58 değil) |
| `i18n/tlab-i18n.js` | `704637b947` | main, #57 (#58 değil) |
| `sw.js` | `296c274167` | yok — tek fark build anında enjekte edilen `BUILD_ASSETS` listesi (beklenen) |

**Sonuç:** canlı production = `main` `3f92642`. Üç PR'ın hiçbir içeriği canlıda değil.

### JITEM deploy kararı (konfigürasyon kanıtı)

TarikLab, JITEM'i ayrı bir deploy'dan değil, **vendor edilmiş statik runtime** olarak sunuyor: `/oyna/jitem-derin-ag` → iframe `/games/jitem-derin-ag/index.html?embed=1&lang=tr`. `public/games/jitem-derin-ag/SOURCE.json`:

```json
{ "standaloneSha": "99836618c77b448a90a83c136e5a86fca21b4d9b", "saveKey": "jitem-derin-ag-v3", "schemaVersion": 5 }
```

Bu yüzden jitem-derin-ag #14 merge edilse bile **production'daki JITEM tek başına değişmez**. Ayrıca tariklab'de vendor runtime'ı yeniden üretip `SOURCE.json`'u güncelleyen bir sync commit'i gerekir. İncelenen iki tariklab yığınının hiçbiri `public/games/jitem-derin-ag/` altında değişiklik içermiyor (0 dosya).

---

## Aşama 4 — Production smoke QA

Yeni sürüm deploy edilmediği için **release doğrulaması yapılamadı**. Aşağıdaki tablo, mevcut canlı production'ın (`main` `3f92642`) **baseline** durumudur. PR içeriğini doğrulamaz.

Ortam: headless Chromium 1194, ajan proxy'si üzerinden. Proxy'nin TLS CA'sı Chromium'un NSS deposuna `certutil` ile eklendi; TLS doğrulaması devre dışı bırakılmadı.

| Kontrol | Sonuç | Kanıt |
|---|---|---|
| Ana sayfa + temel yönlendirme | PASS (baseline) | `/` 200, 19 oyun kartı render; masaüstü + mobil ekran görüntüsü |
| Oyun rotaları | PASS (baseline) | `/oyna/hanedanian`, `/oyna/darbe-h`, `/oyna/jitem-derin-ag` 200; iframe içerikleri render (metin uzunluğu 244–1054) |
| PWA manifest / service worker | PASS (baseline, HTTP) | `/manifest.webmanifest` 200 `application/manifest+json`; `/sw.js` 200 `text/javascript` |
| Mobil viewport (390×844) | PASS (baseline) | 5 rotada yatay taşma yok; JITEM mobil başlangıç ekranı görsel olarak doğrulandı |
| JITEM kritik akış | PASS (baseline, yükleme düzeyi) | başlangıç ekranı ve hat kartları render; tam oynanış bu turda koşulmadı |
| HANEDANIAN / DARBE-H! kritik akış | PASS (baseline) | HANEDANIAN'da yeni kampanya → harita → seçim → inspector (3/3 koşu); DARBE-H! giriş render |
| Konsol hataları (first-party) | PASS (baseline) | 10 rota×viewport yüklemesinde 0 konsol hatası, 0 pageerror |
| Üçüncü taraf ağ hataları | yok | 0 başarısız istek, 0 4xx (Fonts/Grok bu ortamda sorunsuz yüklendi) |
| HTTPS / 404 / kırık asset | PASS (baseline) | tüm hedef rotalar HTTPS 200; bilinmeyen yol 404 veriyor; first-party 4xx/başarısız istek yok. Not: TLS proxy tarafından yeniden sonlandırıldığı için production'ın **gerçek sertifika zinciri bu ortamdan NOT VERIFIED** |
| **Release smoke (merge sonrası sürüm)** | **BLOCKED** | deploy yok |

### Mac Dock / PWA

| Adım | Sonuç |
|---|---|
| Yüklenebilir PWA olarak açma | **BLOCKED — doğrulama ortamı yok** |
| Dock'a ekleme / kurulum | **BLOCKED — doğrulama ortamı yok** |
| Dock'tan standalone başlatma | **BLOCKED — doğrulama ortamı yok** |
| Yeniden açılışta içerik | **BLOCKED — doğrulama ortamı yok** |

Ortam Linux konteyneri; macOS ve Safari yok. Ayrıca PWA kimlik değişikliği (#57) production'da değil. #57'nin kendi gövdesi de "Native macOS Dock/install UI remains untested" diyor.

### HANEDANIAN ilk yakınlaşma duraklaması

Ölçüm: `PerformanceObserver('longtask')` + haritanın kendi `canvas.dataset.renderMs` değeri. Her koşu temiz bir tarayıcı bağlamında, 1440×900. İki akış ölçüldü: (A) kampanya başlangıcındaki ilk yakın görünüm; (B) "Dünya" → `+` ile tekrar yakın moda geçiş (yakın cache'in yeniden kurulduğu an).

| Hedef | Koşu | A: ilk yakın görünüm, en uzun long task | B: dünya→yakın, en uzun long task | Sonrasında UI (karo seçimi → inspector) | Page error |
|---|---|---|---|---|---|
| **Canlı production** (`main` `3f92642`) | 1 / 2 / 3 | 63 / 108 / 61 ms | 0 / 0 / 0 ms | ✔ ✔ ✔ | 0 |
| #54 head `c89300d` (yakın cache 40 px/karo) | 1 / 2 / 3 | 289 / 173 / 178 ms | 261 / 162 / 153 ms | ✔ ✔ ✔ | 0 |
| #55 head `b07f75f` (yakın cache 76 px/karo) | 1 / 2 / 3 | 270 / 384 / 299 ms | 477 / 575 / 292 ms | ✔ ✔ ✔ | 0 |
| **#58 head `2af76e7`** (production build, yerel servis) | 1 / 2 / 3 | **1246 / 939 / 1019 ms** | **1269 / 1266 / 1126 ms** | ✔ ✔ ✔ | 0 |

Değerlendirme:

- Canlı production'da duraklama yok, çünkü `main`deki `map.js` terrain cache kullanmıyor (`ensureTerrainCache` sayısı: 0).
- Duraklama #54 ile gelen senkron tüm-dünya terrain cache mimarisinden geliyor ve yığın boyunca büyüyor. #55'teki `b07f75f` commit'i (bu oturumu yürüten ajanın önceki işi) yakın cache'i 40'tan 76 px/karoya çıkararak canvas alanını ~3,6× büyüttü ve dünya→yakın süresini yaklaşık ikiye katladı. #58 üstüne ağır boyama ekleyerek ~1,0–1,3 sn'ye çıkardı.
- Duraklama **yalnız ilk açılışta değil, her dünya→yakın mod geçişinde** tekrar ediyor (tek cache, mod değişince yeniden kuruluyor).
- İşlevi bozmuyor: 3/3 koşuda harita render oldu, karo seçimi ve inspector çalıştı, page error yok. Bu nedenle handoff kriterine göre QA FAIL değil, **açık risk**. Önceki kapanıştaki ~1,8 sn bu donanımda ~1,0–1,3 sn olarak ölçüldü; daha yavaş cihazlarda daha uzun olması beklenir.
- Bu ölçüm production'da değil, #58'in yerel production build'inde yapıldı; #58 deploy edilmediği için canlı ölçüm mümkün değildi.

---

## Üçüncü taraf konsol / ağ uyarıları

| Kaynak | Bu turdaki durum | İşlevsel etki |
|---|---|---|
| Google Fonts CSS | Canlı smoke'ta sorunsuz yüklendi | yok |
| Grok `extensions.js` | Canlı smoke'ta hata yok | yok |
| Yerel dev/test sırasında `net::ERR_PROXY_CONNECTION_FAILED` | Yalnız sabit/eski proxy portu kullanan eski test scriptlerinde görüldü; first-party değil | yok (ortam kaynaklı) |

Önceki kapanışta sıkı konsol smoke'unu kirleten Fonts/Grok hataları bu ortamda tekrar etmedi.

---

## Bu oturumda ortamda yapılan değişiklikler

- Yalnız okuma amaçlı `git worktree`ler (scratchpad): #57, #58, #54, #55 ve #14 head'leri. İş sonunda kaldırıldı.
- `libnss3-tools` kuruldu ve ajan proxy CA'sı `/root/.pki/nssdb`'ye eklendi (proxy README'sinin "aracı CA paketine yönlendir" yönergesi; TLS doğrulaması kapatılmadı).
- GitHub'da: hiçbir PR merge edilmedi, base'i değiştirilmedi, yorum yapılmadı. Yalnız bu rapor `claude/grok-game-screen-design-8fa30d` dalına commit edildi.

---

## Kalan riskler ve BLOCKED maddeler

1. **Merge BLOCKED** — üç PR da yığınlı ve `main`i hedeflemiyor; hepsi draft ve gövdeleri "Do not merge automatically" diyor.
2. **Örtük merge riski** — herhangi birini `main`e almak #54, #55, #56, #12 ve #13'ü de (açıkça "merge etme" denmiş işler) production'a taşır.
3. **HANEDANIAN duraklaması** — #58 yığınında her dünya→yakın geçişte ~1,0–1,3 sn ana iş parçacığı bloğu; canlıda yok.
4. **JITEM production'a otomatik gitmez** — #14 merge edilse bile tariklab'de vendor runtime sync'i gerekir; bu iş hiçbir PR'da yok.
5. **JITEM repo'sunda CI yok** — #14 için yalnız yerel doğrulama mevcut.
6. **`docs/WEB_APP_SYNC_LEDGER.md` çakışması** — #57 ve #58 yığınları aynı dosyayı değiştiriyor.
7. **Mac Dock/PWA BLOCKED** — macOS ortamı yok.
8. **Production TLS zinciri NOT VERIFIED** — proxy yeniden sonlandırıyor.
9. **#58 kapsam taşıması** — Kaynaklar atıf temizliği (#55) de bu yığında taşınıyor.

## Önerilen takip işleri (karar sahibinin onayıyla)

1. Hangi yığınların production'a gideceğine karar verin. Seçenekler: alttan başlayarak sırayla her PR'ı `main`e merge etmek (#56 → #57; #54 → #55 → #58; #12 → #13 → #14), ya da her yığını tek bir `main` hedefli PR'a toplamak.
2. #58 merge edilmeden önce yakın cache kurulumunu ana iş parçacığından çıkarın (parçalı/idle kurulum, `OffscreenCanvas`/worker ya da görünür alanla sınırlı cache), veya ~1 sn'lik duraklamayı bilinçli olarak kabul edin.
3. JITEM #14 merge edilirse, tariklab'de `public/games/jitem-derin-ag/` runtime'ını yeni jitem `main`inden yeniden üretip `SOURCE.json` `standaloneSha` değerini güncelleyen ayrı bir PR açın.
4. jitem-derin-ag repo'suna en azından `typecheck` + `npm test` + `build` çalıştıran bir CI ekleyin.
5. Merge sonrası Workers Builds `main` deploy'u tamamlandığında bu raporun Aşama 2–4 tablolarını canlı verilerle yeniden doldurun ve Mac Dock/PWA'yı gerçek bir macOS cihazında doğrulayın.

---

**Karar: `NOT CLOSED`.** Merge ve deploy handoff'un güvenlik kuralları gereği yapılmadı; production hâlâ `main` `3f9264235a31a01c29dd1bcc21eaced7af5ed0e3`.
