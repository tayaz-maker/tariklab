# C1 — bakım / POV sonuç yüzeyleri: keşif, uygulama değil

2026-10-05 · kaynak `be160c95` · owner Astra · bağımsız read-only keşif; runtime/PR/browser/production değişikliği yok.

| Oyun | Tek oyuncu değeri | Tek dar yüzey |
| --- | --- | --- |
| Kapı Nöbeti / Apartman | Oyuncu bakım kararının kasa ve bina sistemindeki gerçek değişimini, hangi haftada geri dönecek yük bıraktığını ayırt edebiliyor. | Mevcut Son oylama yüzeyi bakım makbuzu olur; avluda yalnız değişen sistem kısa aydınlanır. |
| Son 100 Gün | Oyuncu seçimin doğrudan bedelini, geride bıraktığı fırsatı ve o dönem ulaşan eski karar sonucunu birbirine karıştırmadan okuyabiliyor. | Mevcut dönem sonucu: seçim / vazgeçilen / dönem kapanışı; kısa değişim izi ardından statik kayıt. |

## Kapı Nöbeti — mevcut sınırlar
- Giriş `apartman/index.html → app.js → next-wave/shared/runtime.js::bootGame`; gerçek işlemler `next-wave.js::applyApartmanProposal/tickApartman`; veri `apartman-data.js`, `apartman-chains.js`.
- Save `tariklab.nextwave.apartman.slot1..3`, `.backup`, `.active`; `meta.id=apartman`, version2 ve v1 normalization. Eski `02_STATE_AND_EVENT_CONTRACT.md` içindeki `tariklab::apartman`/v1 taslağı güncel sözleşme değildir.
- Tetik: gerçek `proposal:` hamlesiyle `lastMeeting` değişince before/after cash, `building.parts[].condition`, confidence/trust ve yeni `delayedEffects` okunur; focus/prepare/setUI/load ve aynı haftaki reddedilmiş ikinci öneri tetiklemez.
- Bakım hedefi ilk açık sistemli meseleden seçiliyor; `flags.focusIssue` tek başına hedef kanıtı değil. Gerçek part farkı veya üretilen `effect.system` kullanılmalı.
- Cheap patch +3 hafta, dues opposition +2, durable investment +4 kayıtları gerçekleşmiş ödül değil, bekleyen etkidir. Mevcut vote-result / memory / ledger / notice üstüne ikinci toast eklenmez.
- Ortak runtime semantiği değişmeden game-local applyAction wrapper transient modeli tutabilir; save alanı eklenmez. Gece yeşili avlu, taş/metal bakım izi ve tek sıcak nöbet ışığı; portre/dış asset/GPU gereksiz.
- Mevcut hedef testler15/15 PASS (`depth-rework`, `racon-apartman-content`, `next-wave-start-flow` ilgili kapsam); özel outcome/focus/reduced-motion/320-390-1440 browser kabulü henüz yok.

## Son 100 Gün — güncel POV sınırı
- Giriş `index.html → pov-app.js + pov.css → pov.js/pov-data.js`; eski `app.js`, next-wave Son100 dosyaları ve WAVE2_IMPLEMENTATION güncel oynanabilir entry kabul edilmez.
- Save `tariklab.son100.pov.v1.slot1..3`, VERSION1; yalnız `{v,scenario,seed,took}` saklanır, restore replay yapar. Eski nextwave Son100 slotları korunur fakat açılmaz/dönüştürülmez. Current direct slot I/O backup içermez; D3 ayrı iş, görsel PR migration eklemez.
- `choose()` gerçek `choiceFx`, `lapsed`, `close.fx`, `close.matured` ve risk log'u verir. UI commit sonrası persist ve `#outcome`/`#end-h` focus davranışı korunur.
- `outcomeBlock(log)` mevcut sonuç yüzeyidir; bağımsız ikinci toast yok. Yeni-an tetikleyicisi commit-only transient olmalı: restore aynı log'u üretir, log varlığı animasyon sebebi değildir.
- `close.fx` olgunlaşan pending etkilerini zaten içerir; matured.fx ikinci kez toplanmaz. Lapse/matured nominal authored etkiler clamp yüzünden gerçek net değişimden ayrılabilir; açık alt iz olarak etiketlenir.
- Son kararda `renderEnd()`/ending.arrived korunur; yapay başarı/ikinci ekran yok. Gün ilerlemesinden ışık dönemi, kâğıt/takvim/cam; Apartman avlusunun renkli kopyası değil. Reduced motion statik, sessiz ve atlanabilir.
- Mevcut POV10/10 PASS: replay/tamper/version/preview/ending/silence/image-free. PL arayüz kısmi; hikâye/journal EN fallback açık. Gerçek browser close/reload/no-replay ve üç genişlik henüz yok.

Bu bulgular sonraki bağımsız küçük C1 PR'ları içindir; DONE veya final360 kabulü değildir. PL anadil/gerçek eski kullanıcı arşivi/fiziksel GPU incelemesi iddia edilmez.
