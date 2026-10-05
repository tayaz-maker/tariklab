# Özgün geometri → SVG deneyinin reddi

- Owner: Astra; branch `astra/darbe-geometry-export-probe`; hazırlık tabanı `931429dba20bf521877aa4f6ad4ad8bc591827e4`.
- Yöntem gerçekten farklıdır: özgün implicit hacimler → VTK CPU yüzey çıkarma/decimation → anatomik eklem zinciri → tek kamera/ana ışık hesabı → üçgen vektör projeksiyon. Eski Bézier probe pathleri, fotoğraf/AI plaka, dış asset/mesh veya tracing kullanılmadı.
- **Kalite FAIL:** yüz şişkin mask/oyuncak gibi; göz kapakları/yanak/saç anatomisi inandırıcı değil. Üçgen sınırları ve saç-baş örtüşmesi görünür; ten/kumaş malzeme ayrımı yetersiz. Bu teknik pipeline gerçekçi yetişkin sanat üretmiş sayılmaz.
- **Temas FAIL:** başparmak arka kâğıt düzleminden 0.084 sahne birimi uzak; serçe uç koordinatı kâğıdın XY sınırı dışında. Diğer üç uç için basitleştirilmiş kapsül-düzlem mesafesi 0 olması gerçek remesh deri temasını kanıtlamaz. Hiçbir anatomik PASS yok.
- **Bütçe FAIL:** 4,821 mesh noktası / 9,563 üçgen; SVG 5,052 path, 358,836 B ham / 65,814 B gzip. Mevcut en büyük DARBE assetinin 26.28 katı; 300 aynı ağırlık yaklaşık 107.65 MB ham eder. Bu aktarım veya browser performans ölçümü değildir.
- Teknik tarama PASS: XML, byte/hash/path hesabı, raster/dış URL/script/filter-image/metin yokluğu. Bu sınırlı PASS sanat veya yayın kabulü değildir.
- CPU geometri+export 2.250 s; Inkscape rasterizasyonu 800 px tam sahne 0.321 s, 400 px crop 0.295 s, 144 px crop 0.280 s. Fiziksel GPU/browser ölçümü değildir.
- Crop kaynağı düzeltildi: aktif `public/games/darbe-h/card-face.css:89` içindeki `.dh-art img` cover + varsayılan merkez; inspector `.dh-art` 3:2. Shared `.card-art img` %38 kuralı aktif custom `.dh-art`a uygulanmaz. Frame/CSS/ölçü/UI davranışı değiştirilmedi.
- Gerçek yerel render: `/workspace/screenshots/darbe-geometry-probe/full.png`; merkez cover 3:2: `inspector-cover-400.png`, `inspector-cover-144.png`. Sonuncusu küçük ölçekte aynı crop kanıtıdır; 320/390 browser viewport PASS değildir. Ham sahne aralığı `viewBox 0 0 800 1120`; crop `0 293.333333 800 533.333333`.
- Ağır SVG/PNG çıktıları commit dışında; kaynak betiği yeniden üretir, SVG/PNG hashleri `metrics.json` içinde kayıtlıdır.
- Tek farklı yöntem denemesinde duruldu; kozmetik revizyon veya 300 çoğaltma yapılmadı. **Kabul edilmiş yeni sanat 0/300; production eligibility false.**
- Sonraki karar: bu başarısız yüz/hand/mesh taslağını genişletmek yok. B7 sınırları içinde doğal anatomi ve çok daha verimli yüzey/örtüşme çözümü için bağımsız sanat/topoloji çalışması gerekir; yeni otomatik probe bu checkpoint tarafından başlatılmaz.
