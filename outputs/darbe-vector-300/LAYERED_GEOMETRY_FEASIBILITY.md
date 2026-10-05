# B7/B10 — özgün geometri → vektör sahne fizibilitesi

**Karar: araştırılabilir, kalite kanıtlanmadı.** Başarısız DRB-001'in Bézier yüzüne daha fazla çizgi eklemek önerilmiyor. Yeni yol, özgün üç boyutlu anatomik yüzey/poz geometrisini kurup aynı kamera ve lamba altında hesaplanan katmanları SVG'ye projekte etmek. Bu keşifte yeni probe, görüntü, mesh veya production asset üretilmedi. Kabul edilmiş sanat **0/300**.

## Gözlenen sorun → farklı çözüm mekanizması

| DRB-001'deki gözlem | Geometri yaklaşımı | Kalan kalite riski |
|---|---|---|
| Yüz açılı/düzlemsel; kafa-gövde oranı çizimden çizime kayıyor | Özgün kafa landmarkları, kafatası/çene/orbita hacimleri ve sürekli eğrilikli subdivision yüzeyi; tek perspektif kamera | Modelin varlığı doğal yüz sağlamaz. Göz kapağı, burun-ağız ilişkisi ve yaş değişimi hâlâ tek tek anatomik sanat çalışması gerektirir. |
| Parmakların kâğıdı kavraması ikna edici değil | Başparmak karşıtlığı dahil özgün eklem zinciri; kâğıt düzleminde tanımlı temas noktaları; eklem sınırı ve penetrasyon ölçümü; bağlı yumuşak deri yüzeyi | İskelet/çarpışma PASS yalnız geometrik tutarlılıktır; ten kıvrımı ve ikna edici kavrayış ayrıca görüntüyle incelenir. |
| Saç eş aralıklı çizgi taraması gibi | Kafa yüzeyine bağlı, farklı kalınlık/eğrilikte özgün üç boyutlu tutamlar; kök yönü ve yerçekimi ile tutarlı akış | Yüzler/tutamlar kartlar arasında kopyalanamaz; salt seed değiştirmek çeşitlilik sayılmaz. |
| Kumaş ve cilt farklı malzemeler gibi davranmıyor | Poz üzerine ayrı kalınlıklı giysi yüzeyi; omuz/dirsek/bilekte gerilim yönüne göre özgün kıvrım geometrisi; ten/kumaş/kâğıt/metal için ayrı hesaplanan yansıma | Fotoğraf dokusu veya AI plaka olmadan mikrodetay pahalı; plastik/oyuncak görünümü yeniden doğabilir. |
| Elle yerleştirilen tonlar tek lamba ile tam bağlanmıyor | Tek ana lamba, yüzey normalleri, görüş yönü, geometrik gölge/örtüşme hesabı; aynı fiziksel oda koordinatları | SVG export materyal/ışık hesabını eksiksiz taşımayabilir. Exportu gözle ve veriyle karşılaştırmadan gerçekçi render iddiası yok. |
| El ve evrak alt kenarda kesilme riski taşıyor | Kamera kadrajı mevcut kart artwell sınırına göre kurulmalı; yüz, temas eli ve etkili nesne güvenli kesişimde kalmalı | Mevcut 400×560 manifest değişmez. Aktif custom `.dh-art img` cover + varsayılan merkez; inspector `.dh-art` 3:2 (`card-face.css:89,333`). Shared `.card-art img` %38 kuralı bu custom seçiciye uygulanmaz. 320/390/1440 browser kırpımı henüz test edilmedi. |

## Yerelde gerçekten bulunan araçlar

| Araç | Doğrulanan durum | Sınır |
|---|---|---|
| Python + NumPy 2.3.5 + SciPy 1.17.0 | Import edildi | Özgün yüzey, eklem ve perspektif hesabı mümkün; hazır anatomi yok. |
| VTK 9.3.1 | `vtkSampleFunction`, `vtkFlyingEdges3D`, `vtkParametricSpline`, `vtkLoopSubdivisionFilter`, `vtkPolyDataNormals` mevcut | Örtük hacmi mesh'e çevirme/yumuşatma/normaller için yapı taşları. Render veya SVG export çalıştırılmadı. |
| VTK `vtkGL2PSExporter` | SVG seçimi, BSP sıralama ve `Write3DPropsAsRasterImageOff` metotları mevcut; raster bayrağı varsayılan 0 | Kurulu sınıf belgesi karmaşık sahnede büyük çıktı/uzun export ve saydamlık sorununu açıkça belirtiyor. Raster açarak aşmak B7'ye aykırı. |
| Inkscape 1.2.2 | Sürüm komutu; önceki SVG probe rasterizasyonu çalıştı | Sadece inceleme görüntüsü üretir; doğru anatomi veya geometrik ışık üretmez. |
| OpenSCAD 2021.01 | Sürüm komutu çalıştı | Oda/masa/dosya geometrisi için uygun; organik insan yüzü için birincil yöntem önerilmiyor. |
| Blender, trimesh, skimage, moderngl, pyvista, open3d | Bu oturumda bulunmadı | Kurulum/indirme yapılmadı. Mevcut VTK/NumPy ile bağımsız teknik keşif mümkün. |

## Sınırlandırılmış sonraki teknik karar

1. **Ayrı yöntem için tek kapı:** önce yalnız özgün yüz ve kâğıt tutan elin hacim/temas/ışık alt sahnesi. DRB-001'in mevcut yüz/elin pathlerini taşımak veya üçüncü kozmetik varyantını yapmak yok. Özgün landmark ve topoloji kaydı zorunlu; indirilmiş mesh, taranmış yüz, fotoğraf/AI dokusu veya referans izleme yok.
2. **Önce export riski:** özgün yüzeyin saf SVG projeksiyonu; dış kaynak, `<image>`, raster/data URI, filter image, script ve animasyon için fail-closed tarama. VTK SVG kabul edilemez şekilde rasterlaştırıyor veya şişiyorsa bu yol durur; runtime WebGL veya raster plaka ekleyerek kapsam değiştirilmez.
3. **Gösterilen ölçümler:** tepe/üçgen/path sayısı, ham/gzip byte, export süresi, SVG decode/rasterizasyon süresi, tam boyut ve gerçek artwell küçük boyut görüntüsü; temas mesafeleri ve yüzey çakışması. Bu keşifte bu ölçümler **YAPILMADI**.
4. **Bütçe karşılaştırması:** mevcut manifest 300 kart için 2,450,904 B; ortalama 8,170 B, P95 11,131 B, en büyük 13,654 B. Başarısız bağımsız probe 55,181 B idi; aynı ağırlığı 300'e yaymak yaklaşık 16.55 MB ham sahne eder. İnce anatomiyi binlerce poligonla vektörleştirmek daha da büyüyebilir. Kaliteyi ve ağırlığı birlikte ölçmeden 300 yayılım kararı yok; bu rakamlar transfer ölçümü değildir.
5. **Sanat kabulü ayrı:** temas/parmak sayısı, yüz oranları, tek lamba, malzeme ayrımı, yetişkin doğal figür, farklı kompozisyon ve mevcut artwell okunurluğu görüntü kanıtıyla geçmeden art sayısı 0 kalır. Teknik geometri testi tek başına B6/B7 PASS değildir.

Owner: Astra. Çalışma yalnız `outputs/darbe-vector-300` hazırlığıdır. Public/gameplay/save/shared engine, frame/ölçü, production ve release hattı değişmedi. Yeni yöntem için uygulama henüz başlamadı; 300 semantik taslak üretim kabulü değildir.
