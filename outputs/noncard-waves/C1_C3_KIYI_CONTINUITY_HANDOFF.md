# C1/C3 — Kıyı Eşiği: sonraki tek görsel/sonuç işi

2026-10-05 · owner Astra · discovery-only; #121 save hotfix yayınından sonra ayrı PR. Mevcut C1/C3 uygulaması tamamlanmış sayılmaz.

**Oyuncu değeri:** Oyuncu rampanın bugünkü kaynak/güven bedelini, kapattığı erişim kopukluğunu ve dönem sonunda gelecek erişim karşılığını haritada ayırt edebiliyor.

## Kanıtlı mevcut yüzey
- `app.js → map-model.js / map-pixi.js`; yedi gerçek NODES ve sekiz LINKS, 320×260 mantıksal harita. Kutu/noktalı bağ tabanı state.line/fault gösteriyor; ramps/pending/access modelde yok.
- #121 built artifact11346062060, SHA256 `a9a635676f31e79b1b4fc21e7e91526b7451000fdb84b75007a2bca36218dac3`: model tarafından açılmış `backup-tr-390-old-cache-open.png`, `quota-pl-320-decision.png`, `invalid-en-1440-decision.png`. Bunlar save hotfix/SVG kanıtı, yeni görsel veya production kabulü değil.
- Source lifecycle açıkları: map-pixi update removeChildren sonrası eski nesneleri destroy etmiyor; app mount callback için unmount generation/context-loss guard yok. Paylaşılan adapter ticker'ı durdurur ve destroy'da visibility listener'ı söker; Kıyı çağrısı bunu yaşam döngüsüne bağlamıyor. Ölçülmüş leak iddiası değil.
- Root SW'de esik module path yok; #121 yalnız yeni save entry/importlarını `?save=2` ile korur. Bütün harita/offline kohortu çözülmüş sayılmaz.

## Tek sistem: erişim sürekliliği makbuzu ve harita izi
- Saf model mevcut node/link kimliklerini korur; rampInstalled, gerçek açık fault, current resource/trust/risk/access, pending erişim/risk sayacı ve seçili yasal hamlenin engine preview sonucunu taşır. Yeni hesap formülü veya save alanı yok.
- outcome(before,after,move) yalnız gerçekten uygulanmış hamlenin net farklarını alır. Anlamlı eşikler: fault açılması/kapanması, rampanın kuyruğa girmesi, gerçekten pending çözen dönem kapanışı veya ending. Invalid hamle/seçim/hydrate/reload tetiklemez.
- Transient ID seed/period/log length/move'dan deterministik olabilir; replay'de son log varlığı tek başına an üretmez. Gerçek sonuç statik okunur kalır; vurgu ~2sn, kapat/atla, odak çalmaz, reduced-motion hareket etmez.
- Dönem kapanışındaki net risk/access farkı esas sonuçtur; pending nominal farkı buna tekrar eklenmez. Bugünkü güven/resource ile sonraki dönem erişimi ayrı etiketlenir.
- Pending ramp kaydında nodeID yok: reload sonrası eski pending erişimini keyfi bir düğüme bağlama. Global dönem tepsisinde toplam bekleyen etki; yeni hamlenin transient hedefi yalnız gerçek move ID'sinden.
- Yerleşik `rampa` node'u ile `merdiven/yokus` üzerine sonradan eklenen rampayı karıştırma. Mevcut preview ve legal sırası/rules/ending korunur.

## Özgün görünüm ve etkileşim sınırı
- Aynı kurmaca coğrafyada taş eşik kesitleri, ahşap iskele/metal köprü, yokuş eğimi ve gölgeli tünel ağzı; kuzeybatıdan tek ışık, küçük kenar/gölge/ıslak yüzey ayrımı. Materyal ve kot node kind/slope/water'dan doğar; gerçek harita/portre/logo/dış asset yok.
- Statik arazi/nesne tabanı bir kez hazırlanır ve yeniden kullanılır; yalnız aktif hat, rampalı geçiş, seçili bedel ve fault/pending overlay değişir. Yalnız renk yerine kesinti/bağ/geçiş biçimi ve DOM metni.
- Harita seçimi ilgili gerçek yasal hamlenin bedelini/fault etkisini görünür kılar; sahte komut ya da yeni mekanik yok. 320/390'da metin/karar önde, ikincil doku geri çekilir; zoom/focus ve kamera sınırı testle kararlaştırılır.
- SVG/DOM önce boyanır; tembel Pixi varsa aynı model. Context loss/init failure/low-memory yolu aynı seçimi ve state'i SVG'de korur. Renderer destroy idempotent, bekleyen mount iptal/generation guard, resize ve pagehide/BFCache açık kontrat.

## Kabul ve yayın sınırı
- #121'in save-store.js ve sim hesap/serialize/validation sınırı korunur; bu işi save hotfix'e yığma. Shared adapter/diğer oyun/kart alanlarını değiştirmeden oyun-local çözüm tercih edilir.
- Saf model: immutability/determinism/gerçek delta/pending çift sayım/fault+ramp eşleşmesi/invalid/no replay. Browser:320/390/1440, klavye/close/reduced motion, karar→save/reload, SVG ve aktif Pixi resize/remount/context loss, görünürlük/cleanup, console/overflow.
- Önce/sonra aynı profil transfer/request/paint ve lazy-Pixi maliyeti ölçülür; sürekli ticker yok. Static identity/update allocation ölçülür; gerçek fiziksel GPU yapılmış sayılmaz.
- Yeni JS/model/çizimlerin eski root-worker cache ve offline reload uyumu ayrıca sınanır; gerekirse küçük game-local atomik offline paket, başka oyun cache/save'lerine dokunmadan. Local→CI→merge→iki host kanıtı olmadan DONE yok.

## 13:10 UTC — seçim ve gerçek net etki sınırı (uygulama değil)
- Seçili node/son makbuz yalnız bellekte. SVG/DOM ve Pixi üstündeki ortak semantik kontrol aynı selectNode yolunu kullanır; seçim apply/persist çağırmaz. Yasal bagla:id/rampa:id yoksa başka hedefe otomatik atlanmaz.
- Pixi canvas aria-hidden; erişilebilir seçim yüzeyi renderer değişiminde kalır. Mevcut legal aksiyonlar aynı sırada ayrı yürütme yoludur. Her commit sonrası preview yeniden doğrulanır.
- Dönem makbuzu before.period içindir. Fault başka eşiğe kaydıysa bütün hat açıldı denmez; ancak after.fault null ise süreklilik sağlandı.
- Seed3 gerçek sim gözlemi: merdiven bağla → kaynak6/güven50/risk18/erişim0/fault; rampa → kaynak4/güven57/risk18/erişim0/pendingAccess1/faultnull; kapat → dönem2/kaynak6/güven57/risk18/erişim1/pending0. Nominal pending net farkın üzerine eklenmez.
- Kabul ekleri: iki açık eşikte kısmi onarım, terminal sonuç, illegal hedef ve frozen-state; async mount sırasında ekran ayrılma, context-loss sonrası aynı seçim; hydrate/reload/timer kaynaklı yeni sonuç yok.

## D3 atomik offline sınırı — ayrı oyun paketi tasarımı
- /games/esik/sw.js yalnız oyun scope'u; root SW ve başka oyun cache'leri değişmez. HAN worker örneğinin body-read/MIME/tamamlık ve redirected navigation Response-normalization korumaları alınır; shared bağımlılıkları optional sayılmaz.
- App/sim/save/model/render/style/HTML ile Pixi adapter+vendor ve PL body/dictionary baytları hash manifestine dahil. Pixi828.971B yalnız oyun girişi paketi; render importu lazy kalır. Build version tüm bu baytlardan türemeli; portal root precache'e eklenmez.
- Yeni paket eksik veya hash hatalıysa eski cache+save kalır; yalnız başarısız yeni Kıyı cache'i temizlenir. Upgrade'de skipWaiting yok. Query'li save=2 ve düz path aynı doğrulanmış pakete çözülür.
- Root→dar-worker controller scriptURL, scope ve manifest-tamlık cevabı gerçek browser ile kanıtlanır; ready tek başına yeterli değil. Controller değişimi eski yüklenmiş graph'ı güncellemez; başarılı dar-worker reload ayrıca doğrulanır.
- Eski A sayfası açıkken B waiting, eksik B'de A offline, tüm Kıyı sekmeleri kapandıktan sonra B active testleri. Tamamen offline eski kurulum yeni kod alamaz; bu sınır korunur. Sentetik izole browser context dışında kullanıcı cache/save temizliği yok.
