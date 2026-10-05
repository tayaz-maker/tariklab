import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root = fileURLToPath(new URL('../../', import.meta.url));
export const sourcePath = 'public/games/veto-h/source-cards.json';
export const protectedSourceSha256 = 'b876fdb69eeb4ddcfd1d06e397df14e14070cf3131ad4d210b4608e8fe7b4acd';
const digest = input => createHash('sha256').update(input).digest('hex');
// Each row was authored against the actual ID/name/effect list, not inferred by a keyword classifier.
// Fields: numeric ID | class | subject and action | setting | camera | relation to existing effect.
const authoredRows = String.raw`
001|character|Yaşlı sivil görevli zarfları dikkatle sıraya koyar; boşalan tepsiye yeni zarf yerleştirir|pencere ışıklı sandık odası|medium|Görev devrinden sonra yeni bilgiye erişim; yok olmayı insan şiddeti olarak resmetme
002|character|Kıvırcık kır saçlı kadın gözlemci sayım masasını yandan izler; kapalı zarf grubuna bakar|sayım sırası kenarı|over-shoulder|Kapalı bilgiye kontrollü bakış
003|character|Orta yaşlı mahalle adayı iki yetişkin sakini dinleyip boş sandalyeyi görüşmeye açar|kurgusal bakkal önü|three-person|Sandık kadrosunu bulup ekibe katma
004|object|Amblemsiz otobüsün açık kapısından farklı yaşlarda yetişkinler biner|sabah mahalle durağı|wide-diagonal|Doğrudan erişim ile sınırlı etki arasındaki ödünleşim; saldırı fiziksel değildir
005|location|Sebze kasaları arasındaki tezgâh dar yaya akışını yan koridora yönlendirir|açık semt pazarı|environment|Savunmada hedefi başka yöne yönlendirme
006|action|Üç yetişkin gönüllü boş broşür paketini yeni gelen ekip arkadaşına bırakır|apartman önündeki dağıtım noktası|close-action|Bir ekibin görevini devrederek başka Sandık kadrosunu getirmesi
007|character|İlçe yazmanı kapalı ayrı bir dosyanın yanında evrak sırasını düzenler|dar yazı işleri gişesi|side-profile|Kapalı Skandal varlığına bağlı güçlenme; belge içeriği gösterilmez
008|character|Bisikletinden inen kurye çantasının üst zarfını teslim öncesi kontrol eder|avlu teslim masası|full-scene|Üstteki kaydı kontrol edip uygun olanı seçme
009|character|Olgun kadın çay dağıtıcısı son tepsiyi yeni görevliye devreder|delege dinlenme salonu|close-action|Görev devrinin ardından kaynak rahatlaması
010|action|İki yetişkin gönüllü kapıları farklı aşamalarda açık apartman sahanlığında ilerler|çok katlı bina iç avlusu|high-angle|Karşıdaki kapalı durumların sayısı arttıkça saha emeğinin değeri
011|object|Yıpranmış fakat sağlam seçim çantası onarım iğnesi ve yedek kayışla durur|sandık odası taburesi|still-life|Dayanıklılığın sürekli bakım bedeli
012|character|Yedek gözlemci dinlenme odasından çağrılıp bir evrakın ilerlemesini eliyle durdurur|koridor kapı eşiği|two-shot|Atılmış kayıttan tek kullanımlık itiraz; görevli görünmez olmaz
013|character|Genel sekreter yan raftaki kapalı dosyayı hazır bekleyen görevliye uzatır|uzun toplantı masası başı|medium|Önceden hazırlanmış kampanyayı cevap anında kullanma
014|character|Sivil sözcü açıklama masasındayken karşısındaki dinleyici bir evrakını çantasına kaldırır|amblemsiz basın odası|two-shot|Çağrı sonrasında rakip eldeki seçenek kaybı
015|character|Grup başkanvekili eşit yükseklikteki iki konuşma masasından birinde itirazını anlatır|yuvarlak müzakere odası|wide-diagonal|Aynı kademedeki karşılaşmada ek tartışma etkisi
016|character|İlçe başkanı iki saha görevlisine çalışma malzemesini paylaştırır|küçük teşkilat avlusu|three-person|Sandık ekibinin birlikte güçlenmesi
017|character|Teşkilatçı açık kapıda tek yetişkin sandık gönüllüsünü karşılar ve boş çalışma yerini gösterir|gönüllü kayıt bankosu|full-scene|Uygun düşük kademeli Sandık kadrosunu elden veya desteden devreye alma; sahne koşulsuz çağrı ya da yemin töreni değildir
018|character|Lobici karşı masadaki sunumu dinlerken kendi dosyasına yeni not kâğıdı ekler|konferans dinlenme alanı|side-profile|Karşı kampanya etkinleşmesinden yarar sağlama
019|character|Danışman henüz açılmamış ekip dosyalarının önüne koruyucu kapak yerleştirir|gizli olmayan hazırlık odası|close-action|Kapalı kadroların açıklanana kadar korunması
020|character|Anketör üç sonuç klasöründen birini seçip diğer ikisini sırayla bırakır|saha araştırması kontrol bankosu|top-down|Üç kaydı inceleyip birini alma; yazı veya sayı resmedilmez
021|institution|Sivil karşılayıcı ve düzenli koltuk sırası açık toplantı mekânını çevreler|aydınlık kabul holü|environment|Saha koşulu sürerken korunma
022|character|Kampanya direktörü yeni vardiyaya bir boş çalışma masası hazırlar|geçici saha merkezi|full-scene|Düşük kademeli ek görevlendirme
023|character|Medya koordinatörü iki hazırlık ekibi arasında hızlıca görüntü dosyasını aktarır|yayın kurgu bölmesi|over-shoulder|Hızlı kampanyanın daha güçlü etkisi; ek sonuç yazılmaz
024|character|Sivil hukukçu şüpheli dosyanın üstüne işlem bekleten düz ayırıcı koyar|başvuru danışma masası|close-action|Tuzak etkisini yalnız bu tur durdurma
025|character|Gölge yazarı boş sayfaları çekmeceye yerleştirip masasını yeni görevliye bırakır|yan ışıklı yazı odası|side-profile|Ayrılıştan sonra kapalı Skandal hazırlığı
026|character|Görüşmeci iki çalışma alanı arasındaki sandalyeyi geçici görüşmeye çeker|bölmeli sivil ortak ofis|wide-diagonal|Küçük kadronun geçici kontrol değişimi; zorlama gösterilmez
027|character|Belediye başkanı kapalı bir proje dosyasını müzakere masasında açar|kurgusal kent toplantı salonu|medium|Kapalı rakip durumla tartışmada ek etki
028|character|Milletvekili yorgun ekibin yanında kürsüye yaklaşır|sade sivil toplantı salonu|low-angle|Düşük kaynakta artan mücadele gücü
029|character|Bakan adayı ayrılan görevlinin bıraktığı dosyayı devralır|kurumsal kabul odası|two-shot|İstifa ile göreve gelişin yeni bilgi kazandırması
030|character|Büyükşehir adayı yüksek geçitten çoklu ulaşım düğümünü inceler|tanınmayan kurgusal kent merkezi|wide-diagonal|Belirli saha varken doğrudan erişim
031|character|Parti sözcüsü eski dolaptan kapalı dosya çıkarıp hazırlık sehpasına koyar|amblemsiz açıklama kulisi|over-shoulder|Atılmış Skandalı yeniden sete hazırlama
032|character|İki fraksiyon temsilcisi aynı konuşma platformunda yan yana durur|geniş sivil forum|two-shot|Başka Kürsü kadrosunun varlığına bağlı güçlenme
033|character|Yaşlı sivil yönetici açık geçiş ile bekleyen heyet arasında sakin biçimde durur|ahşap kapılı kabul salonu|full-scene|Savunmadayken doğrudan erişimi engelleme
034|character|Sendika başkanı iki yetişkin delegeye boş sandalye ve dosya devreder|işçi dayanışma toplantısı|three-person|Bir görev devrinden iki Delege oluşması
035|institution|Farklı mesleklerden siviller sabah ortak masaya çalışma çantalarını bırakır|odalar ortak toplantı alanı|group|Tur başında düzenli kaynak desteği
036|character|Televizyon yorumcusu yeni getirilen dosyayı yayına girmeden inceler|logosuz stüdyo yan masası|over-shoulder|Yeni çekilen kartın türünü açığa çıkarma
037|character|Gazete yöneticisi kapalı dosya açıldığı sırada çalışanların boşalan malzeme rafını görür|matbaa idare balkonu|full-scene|Karşıdaki kapalı kaydın açılmasının kaynak bedeli
038|character|Üniversite hocası iki ayrı saydam araştırma katmanını karşılaştırır|yetişkin seminer odası|close-action|Anket incelemesini iki kez yapma
039|character|Deneyimli lobici arşivdeki eski kampanya dosyasını yeni görüşme girişine bırakır|konferans arşiv nişi|side-profile|Giriş bedelini farklı kayıtla ödeme
040|institution|Yetişkin komşular aynı kumaştan iki boş masa örtüsünü birleştirir|hemşehri dayanışma avlusu|group|Aynı seriden iki kadronun ortak güçlenmesi
041|character|İş insanı destekçi malzeme sandığını ekibe teslim ederken kendi rafı boşalır|sivil tedarik deposu|full-scene|Yüksek ilk bedelin artan güce dönüşmesi
042|character|Üniformasız emekli yaşlı sivil eski çalışma masasını kapatırken karşı masadaki bir sandalye boşalır|amblemsiz emeklilik görüşme odası|wide-diagonal|Karşılıklı kadro kaybı yalnız görevden çekilme metaforu; askerî simge yok
043|character|Genel başkan ayrılan ekipten dosya devralıp karşıdaki kapalı tepsiyi açtırır|genel merkez sivil toplantı odası|three-person|İstifa sonrası eldeki ve kapalı seçeneklere eşzamanlı baskı
044|character|Kurmaca üst düzey aday geniş sivil toplantının girişindeki geçişi düzenler|amblemsiz aday tanıtım holü|full-scene|Doğrudan etkinin sınırlanması ve küçük kadro girişinin kapanması
045|character|Koalisyon mimarı iki ayrı toplantı masasını tek uzun masaya yaklaştırır|ortak çalışma atölyesi|high-angle|Malzeme olarak ayrılan kadroların koalisyona dönüşmesi
046|institution|Aşınmış sivil arşiv kapısının tek kullanımlık yedek takozu yerinde durur; ikinci takoz yoktur|sivil arşiv giriş koridoru|environment|Tur başına tek savaşta yok olmama hakkının sınırlı dayanıklılık metaforu; kalıcı dokunulmazlık veya hasar iptali değildir
047|character|Medya yöneticisi rafın ön sırasındaki yayına hazır paketi doğrudan görevliye verir|büyük yayın dağıtım galerisi|medium|Hazır kampanyaya desteden hızlı erişim
048|character|Sandık sorumlusu sayım masasının üstüne ortak koruma örtüsü açar|yüksek pencereli sayım salonu|wide-diagonal|Sandık ekibine sürekli dayanıklılık sağlama
049|institution|Sivil görüşme heyeti randevu dosyalarını bir sonraki bölmeye taşır|amblemsiz hukuk danışma bekleme alanı|top-down|Tuzak açılmasına bir tur gecikme; gerçek mahkeme iddiası yok
050|object|Uzak destek masasında dolu tedarik kutusu ve ayrılmış tek evrak bulunur|ulus ve bayrak belirtmeyen ortak depo|still-life|Kaynak kazanımı karşılığında elden kayıt bırakma
051|institution|Azalan malzemeleri olan ekip yakın oturup birbirine siper olacak dosya panoları kurar|sivil kriz koordinasyon odası|group|Düşük kaynakta savunmanın artması
052|object|İki hazır görev çantası açılmış dolap önünde bekler|aday kabul odasının hazırlık rafı|still-life|İki Sandık görevlisinin çağrılması; aynı tur saldırmama bekleyişi
053|object|Üç araştırma klasörü arasından bir kadro zarfı ayrılır|sabah anket sonuç tezgâhı|top-down|Tekrarlanan üst üç incelemesi ve kadro seçimi
054|character|Kararsız yetişkin seçmen iki boş sandalyenin arasında düşünür|sivil bilgi görüşmesi alanı|medium|İki düşük güçlü yardımcı olanağın ortaya çıkışı
055|action|Görevli yüksek raftaki dosyayı geçici inceleme için alçak rafa indirir|seçim kayıt deposu|close-action|Geçici kademe azaltımı; güç veya feda değişimi resmedilmez
056|event|İki araştırmacı kapalı zarf dizisini kısa süre inceleyip tekrar örter|çıkış görüşmesi kontrol çadırı|high-angle|Bütün kapalı bilgilerin geçici görülmesi
057|object|Eş yükseklikte iki zarf grubundan biri işleme ayrılır|oy ayrıştırma masası|still-life|Aynı kademede karşı kadronun ayrılması
058|event|Farklı yaşlardan yetişkinler düzenli ve sakin kuyruğa katılır|aydınlık sandık binası avlusu|crowd|Katılım artışından kaynak kazanımı
059|object|İşaretsiz beyaz zarf masa lambasının aydınlattığı korunaklı cam altında durur|sessiz oy inceleme köşesi|macro|Savunmadaki zararın sıfırlanması
060|action|Görevli kullanılmayan boş zarfı teslim sırasının önünden geri çeker|zarf kabul bankosu|close-action|Bir sonraki çekişi engellemek için elden bırakma
061|object|Farklı boyda iki kâğıt yığını arasında ölçüsüz boşluk görünür|sayım karşılaştırma tezgâhı|still-life|Etkinin iki kaynak düzeyi farkına bağlı olması; sayı yazılmaz
062|event|İki sivil ekip dosyalarını ortak üçüncü masada birleştirir|aydınlık uzlaşma atölyesi|wide-diagonal|İki küçük kadrodan koalisyon kurma
063|event|Sakin avluda unutulmuş çalışma sandalyesi yeniden kullanıma alınır|mahallenin erken sabah buluşması|environment|Atılmış küçük kadronun dönüşü karşılığında aracının ayrılması
064|institution|Arka sıradaki yetişkin dinleyiciler sessizce birbirine yer açar|sivil halk toplantısının gölgeli sıraları|crowd|Kapalı kadroların savunma dayanıklılığı
065|character|Kurultay delegesi arşivdeki kimliksiz görev dosyasını toplantı girişine getirir|delegasyon kayıt kapısı|medium|Atılan kaydın tek seferlik ritüel malzemesi olması
066|character|Yedek delege bekleme bankından kalkıp katlanır dosyasını açar|kurultay yedek kabul sahanlığı|full-scene|Yedek kaydın tek seferlik malzeme katkısı
067|character|Liste düzenleyicisi arşiv kutusundan ek boş dosyayı hazırlık grubuna ekler|kurultay kayıt deposu|over-shoulder|Ek arşiv malzemesi kullanabilme
068|character|Ortak aday iki ayrı ekipten gelen sade dosyaları birlikte taşır|ortak aday kabul kapısı|medium|İki kadronun birleşmesi ve yeni bilgi açılması
069|object|İki farklı dokulu dosya sağlam bir bağla aynı masada tutulur|kulis ve saha ekipleri arasındaki imza alanı|macro|Kulis ve Sandık birleşiminden iptal edilemeyen hazırlık
070|institution|Üç sivil grubun masaları açık bir geçitte birleşir|amblemsiz adaylık çalışma salonu|high-angle|Üç kadronun birleşmesiyle doğrudan erişim; ulusal simge yok
071|institution|İki yetişkin danışman çalışma ışığını perde arkasında paylaşır|kapalı planlama odası|two-shot|İki Kulis kaynağının karşı hızlı kampanyayı sınırlaması
072|event|Kürsü görevlisi ve saha çalışanı kalabalık masalara ortak dosya götürür|açık ittifak çalıştayı|group|Gücün sahadaki kadro sayısıyla büyümesi
073|event|Konuşmacı ve araştırmacı kapalı rakip öneri tepsisini birlikte kaldırır|ittifak analiz odası|three-person|Kürsü ve Anket birleşiminden kapalı seçenek kaldırma
074|character|Aday hazırlık süreci bitmiş kabul dosyasını teslim alır|amblemsiz sivil kayıt holü|medium|Kurultay şartıyla geliş ve kaynak kazanımı
075|character|Bağımsız aday tek dosyasını gösterip ortak girişten ayrı kapıyı seçer|adaylık kayıt avlusu|full-scene|Eldeki kadroyu göstererek giriş ve adın geçici kullanım kısıtı
076|institution|Eski çalışma odasında birikmiş görev dosyaları yeniden ekibe dağıtılır|devralınan gönüllü merkezi|environment|Yeterli arşiv kadrosu koşuluyla yeni yapılanma
077|character|Liste başı aday konferans sıralarını yukarıdan değerlendirir|kurultay salonu yan balkonu|low-angle|Yüksek giriş şartı ve karşı kadro gücüne bağlı ek etki
078|object|İki farklı el aynı sade bildiri dosyasını bir sonraki masaya uzatır|ortak metin çalışma masası|close-action|Malzeme olma ve çekildikten sonra yerini yeni karta bırakma
079|institution|İki delege grubunun sandalyeleri tek ortak toplantıya yaklaşır|kurultay ana salonu|wide-diagonal|İki blok birlikteyken koalisyon olanağı
080|institution|Yedek delege sırası ana toplantının açık yan kapısına ilerler|yedek delegasyon bekleme alanı|crowd|Yedek blokların birleşerek koalisyon açması
081|location|Amblemsiz sivil toplanma platformu boş görüş hattı boyunca yükselir|gündüz açık forum meydanı|environment|Geçici güç ve doğrudan etkinin tamamlanması
082|event|Görevli art arda iki görüşmeden dosya alıp birini ayırır|uzun saha ziyaret günü|triptych-depth|İki seçenek alıp birini bırakma; vaat yazısı yok
083|event|Katlanmış işaretsiz kâğıtlar dağıtım sepetinden gönüllüye aktarılır|rüzgârlı mahalle dağıtım noktası|close-action|Desteden Sandık kadrosuna erişim
084|event|Bir çalışma sandalyesi karşı masadan kalkarken aynı ölçüde başka sandalye hazırlanır|sivil ekip değişim holü|wide-diagonal|Eş kademede karşılıklı görev değişimi; patlama yok
085|event|Eski görevli toplantı halkasındaki boş yerine geri çağrılır|mahalle teşkilat toplantısı|group|Küçük arşiv kadrosunun dönüşü
086|action|Araştırmacı açılan görüşme dosyalarından bir kampanya paketini ayırır|kamuoyu araştırması bölmesi|over-shoulder|Elde saklanan seçenekleri görüp kampanyayı eleme
087|event|Bir muhabir açık hat başında haberleşirken arka hazırlık tepsileri kapalı kalır|logosuz canlı yayın bağlantı alanı|medium|O tur tuzak açılmasını engelleme; ses üretilmez
088|event|Yeni sivil hizmet alanının kapısı ilk ziyaretçilere açılır|amblemsiz mahalle hizmet avlusu|full-scene|Açılışın doğrudan kaynak katkısı
089|action|Yetişkin destekçi yorgun görevlinin çalışma yükünü yanında tutar|yağmurdan korunmuş forum girişi|two-shot|Hedef kadronun o tur dayanması
090|object|Katlanmış boş açıklama kâğıdı söndürülmüş masa ışığının yanında durur|sessiz açıklama odası|still-life|Etkinin geçici kapanması ve kısmi kaynak rahatlaması
091|action|Toplantı masasında bir görev sandalyesi geri çekilir; dosya tepsisi alternatif olarak bırakılır|sivil görüşme salonu|high-angle|Kadro bırakma veya eldeki kayıttan vazgeçme
092|action|İki görevli mühürsüz saydam kutuyu boş masaya taşır|sandık odaları arasındaki koridor|full-scene|Kendi kapalı kaydını boş konuma taşıma
093|event|Yetişkin komşular ortak kahvaltıda çalışma çantalarını yan yana koyar|mahalle derneği terası|group|Sandık ekibine geçici ortak katkı
094|event|Sivil destek yemeğinde dolu masadan ortak proje odasına dosya aktarılır|sade yemek salonu yan bölmesi|wide-diagonal|Yüksek kaynak bedeliyle koşullu koalisyon
095|action|Eski ses ekipmanı yerine eski kampanya klasörü yeniden dağıtım tepsisine konur|kampanya malzeme arşivi|close-action|Kullanılmış normal kampanyayı geri alma; yazılı slogan yok
096|action|Arşiv kapısından yarı açık dosya görünür; görevli ayırıcı tepsiyi hazırlar|kilitli olmayan evrak arşivi|door-framing|Kapalı bilgiye bakma ve bedelli kaldırma seçeneği
097|event|İki sayım görevlisi çalışmayı durdurup zarfları yeniden sıralar|ortak sayım tezgâhı|top-down|Karşılıklı hasarsız ara ve iki tarafın yeni bilgisi
098|object|Alçak görev dosyaları kapalı geçiş şeridinin gerisinde bekler|adaylık süreç kontrol masası|still-life|Küçük kadroların o tur ilerleyememesi; gerçek baraj haritası yok
099|action|Görevli farklı kadro dosyaları arasından birini seçer|aday kabul çekmecesi|close-action|Tür sınırlaması olmadan kadro seçimi
100|object|Eski sade gazete demeti arasından kişi dosyası geri çıkarılır|yerel gazete arşiv rafı|macro|Arşiv kadrosunu tekrar ele alma; hiçbir basılı haber gösterilmez
101|action|Tedarik kutusu doldurulurken bir dosya çıkış rafına bırakılır|sivil kampanya bütçe odası|over-shoulder|Kaynak kazanımının elden bırakma bedeli
102|object|Beş zarf iki ön ve üç alt bölmeye ayrılır|kapalı araştırma çekmecesi|top-down|Üst beşten iki seçim ve kalanların alta taşınması
103|event|Karşılıklı iki katılımcı koltuğundan kalkıp konuşma alanına yaklaşır|açık tartışma salonu|two-shot|İki tarafı da aktif konuma çağırma
104|action|Tek aday dosyası rafa dönerken iki görüşme dosyası masaya gelir|liste pazarlığı yan masası|close-action|Eldeki kadroyu değiştirip iki yeni seçenek alma
105|event|Küçük çalışma masaları iki tarafta da kapanırken ortada tek yeni dosya kalır|boşalan teşkilat salonu|environment|Karşılıklı küçük kadroların ayrılması ve yeni bilgi
106|event|Sivil basın sorusu karşısında görevli kapalı dosyanın kapağını açar|logosuz basın toplantı masası|three-person|Karşı kapalı seçeneğin açığa çıkması
107|object|Sabah teslim edilen tek haber zarfı kapalı hazırlık rafına ayrılır|gün doğumu haber bankosu|still-life|Yeni kartı alıp uygunsa sete koyma
108|location|Akşam yayın odasının ışığı çalışma masasını ve hızlı teslim hattını aydınlatır|logosuz akşam stüdyosu|environment|Hızlı kampanyaya o tur ek etki
109|event|Yayın görevlisinin eli boş ekran hattının fiziksel anahtarını kapatır|kurgu masasının kablo bölümü|macro|Etkiyi kesme; görüntü veya ses oynatılmaz
110|object|Önceki kapalı dosyanın üzerine yeni sade düzeltme zarfı konur|basın düzeltme gişesi|still-life|Skandalın iptali ve kaldırılması; metin yazılmaz
111|action|Araştırmacı iki farklı doluluktaki tepsiyi yer değiştirir|hızlı anket değerlendirme masası|top-down|Saldırı ve savunma değerlerinin geçici değişimi
112|action|Sivil görevli ilerleyen evrak tepsisinin önüne açık avucunu koyar|kurum işlem penceresi|close-action|Hedef ilerleyişi iptal; bekleyin yazısı resmedilmez
113|object|Kurgu masasındaki tek boş bant diğer kutuların açılmasını kapatır|reklam hazırlık tezgâhı|macro|Cevap zincirinde ek açılışları sınırlama
114|location|Tanımlanamayan kurgusal şehirde meydan, mahalle ve ulaşım geçişleri katmanlanır|özgün soyut büyükşehir görünümü|aerial-fiction|Kürsü ve Sandık gruplarına farklı saha katkısı
115|location|Alçak yapılı küçük yerleşimin avluları korunaklı dar geçitlere bağlanır|özgün kırsal sivil yerleşim|environment|Küçük kadroların savunması ve doğrudan etkinin azalması; sancak yok
116|location|Boş kameralar ve hazır dosyalar akşam vardiyasının çevresini sarar|gece stüdyo çalışma katı|wide-diagonal|Karşı turda erişim karşılığında her kullanımın bedeli
117|object|Aşınmış ama sağlam sivil makam koltuğu sade çalışma masasının önünde durur|küçük yönetici odası|still-life|Donanımın iki güç ve ek kademe katkısı
118|event|Markasız sivil araçlar kişiyi yağmurdan koruyan girişe bırakır|kurumun kapalı taşıt avlusu|full-scene|Hedef seçilmeye karşı koruma; silahlı konvoy veya üniforma yok
119|object|Kapağı yıpranmış rapor dosyası altında yeni sade bilgi zarfını korur|evrak inceleme masası|macro|Kadro ayrıldığında yeni kart açılması
120|event|Yeni gelen konuşmacının hazırlık dosyası açılmadan bekleme sandalyesine yöneltilir|canlı açıklama kulisi|three-person|Normal çağrının kapalı savunmaya geçmesi
121|object|Eski telefon boş ekranıyla kapalı dosyanın üzerine bırakılır|sosyal medya kayıt inceleme sehpası|still-life|Kapalı kadroya geçmiş kayıt üzerinden müdahale; marka veya tweet metni yok
122|object|İşaretsiz diploma kâğıdı iki farklı doku nedeniyle büyüteç altında incelenir|belge doğrulama tezgâhı|macro|Yüksek kademeli etkilerin kalıcı durdurulması; gerçek diploma kopyası yok
123|object|Sade kayıt cihazı kapatılan kampanya klasörünün yanında bulunur|sivil inceleme çekmecesi|still-life|Kampanya etkinleşmesini iptal; gerçek ses kaydı yok
124|object|Kapalı iddia dosyası boş inceleme tepsisinde bekler; hiçbir para aktarımı veya suçlanan kişi görünmez|kurgusal etik inceleme gişesi|still-life|İddianın o turluk güç etkisi; rüşvetin gerçekleştiği resmedilmez
125|institution|Aynı aileden yetişkinler işletme masasındaki iki azalan malzeme tepsisini inceler|markasız aile işletmesi ofisi|group|İki tarafın eşit olmayan kaynak kaybı
126|event|Sivil denetçiler kapalı bütün evrak raflarını birlikte incelemeye boşaltır|seçim işlem deposu|wide-diagonal|Her iki tarafın kapalı desteklerinin kaldırılması
127|event|Boş sivil toplanma alanında yarıda bırakılmış konuşma platformu güvenle kapatılır|dağılmış ama hasarsız forum meydanı|environment|Tartışma evresinin atlanması; saldırı görüntüsü veya yaralı yok
128|object|Kapalı yayın dolabı ile elde bekleyen dosya arasında kilitsiz durdurma çubuğu bulunur|basın kontrol odası|still-life|O tur elden kampanya açılmasının kapanması
129|event|Karşılıklı iki sivil toplantı grubu konuşmayı durdurup kendi oturma alanına döner|iki bölümlü açık forum|crowd|Doğrudan ilerleyişin iptali ve savunmaya dönüş
130|event|Delege masasında kalkmak üzere olan görevlinin dosyası ortak ellerce yerinde tutulur|kurultay çalışma halkası|close-action|İlan edilen görevden vazgeçişi iptal; şiddet yok
131|object|İncelenecek anket dosyasının kapağı seçim yapılmadan kapanır|araştırma kontrol masası|macro|Bakıp alma sürecini durdurma
132|object|Aynı ölçüde kapalı evrak zarflarının arasından tek zarf yan bölmeye ayrılmıştır; seçen kişi görünmez|tasnif tepsili ortak evrak masası|still-life|Rakip elden tek rastgele seçeneğin atılması metaforu; zarf içeriği ve kaynak kimliği ileri sürülmez
133|action|Boşalan görev sandalyesi ile eksilen kaynak kutusu aynı görüşmede karşı karşıyadır|zor sivil müzakere odası|wide-diagonal|Kadro bırakma ile yüksek kaynak ödeme seçimi
134|event|İki sayım ekibi ellerini masadan çekip itiraz dosyasını ortaya bırakır|ortak itiraz tezgâhı|top-down|İki tarafa da geçici hasarsızlık
135|event|Beklenmedik sivil denetimde yan odadaki tek kapalı dosya incelemeye alınır|toplantı kulis kapısı|door-framing|Kapalı rakip seçeneğin kaldırılması; baskın şiddeti yok
136|event|Dinleyiciler konuşmacıya yüz çevirirken açık konuşma yeri boş kalır|sivil tartışma salonu|crowd|Etki ve ilerleme kaybı; aşağılayıcı yazı veya jest yok
137|object|Yarım reklam şeridi taşıyan boş ekran aparatı yerinden sökülür|yayın hazırlık stüdyosu|macro|Sürekli veya saha desteğini kaldırma
138|action|Düzeltme dosyası açılacak kuşkulu evrakın önüne teslim edilir|basın evrak kabul masası|close-action|Skandal açılışına karşı iptal
139|event|Teknisyen acele yayına hazır tepsiyi kontrol rafına geri koyar|stüdyo çıkış kapısı|side-profile|Hızlı kampanyanın durdurulması
140|object|Sivil işlem talebi giriş tepsisinden bekleme tepsisine alınır|amblemsiz hukuk başvuru bankosu|top-down|Özel girişin iptali; yargı sembolü yok
141|object|İşaretsiz opak bir bant açık dosyanın işleme giden kısmını örter|yayın kontrol tezgâhı|macro|Kart etkisini engelleme; metin sansürlenmiş gibi yazılmaz
142|action|Editör iki uyumsuz görüntü çerçevesini ayırıp görevli dosyasını masada tutar|sivil kurgu inceleme odası|over-shoulder|Kadro kaybı ve zararı engelleme; gerçek görüntü yok
143|event|Boş teslim hattındaki bağlantı fişi gevşer; yeni zarf karşı tarafa ulaşmaz|yayın bağlantı masası|close-action|Yalnız çekiş bölümünün durması
144|institution|Amblemsiz sivil kurul iki tarafa da yeni dosya vererek önceki işlemi durdurur|aydınlık ortak karar odası|group|Etkinleşmenin iptali ve iki tarafın yeni bilgisi
145|character|Yetişkin nöbetçi kapalı evrak tepsisinin yanında sandık odasını sakin izler|akşam sivil sayım odası|medium|Kapalı tuzak varken hedeflenmeme
146|character|Liste dışında kalan aday boş yardımcı dosya rafıyla tek başına hazırlık yapar|bağımsız aday çalışma nişi|portrait|Koalisyon kalmadığında bireysel güçlenme
147|object|İşaretsiz katlanmış oy kâğıtları yeni görevli gelişi için açık tepside bekler|kabul masasının güneşli köşesi|still-life|Her normal çağrıdan küçük kaynak katkısı
148|object|Mühür simgesi olmayan kapalı güvenlik çantası eski dosyaların önünde durur|arşiv emanet rafı|macro|Atılan kayıtlara erişimi engelleme
149|object|Ortak masada bir sandalye eksik olmasına rağmen dosya birleşimi hazırlanır|sivil ittifak çalışma köşesi|top-down|Bir kez daha az malzeme ile koalisyon kurma
150|event|Gece ışıkları altındaki sayım salonunda iki ekip yorgunlukla dosya bırakır|amblemsiz seçim gecesi merkezi|wide-diagonal|Artan tartışma etkisi ve iki tarafın tur sonu kaybı
151|character|Genç yetişkin tutanak yazmanı boş formu teslim ederek saha dosyası alır|sandık kayıt masasının dar ucu|close-action|Giriş bedeli karşılığında küçük Sandık kadrosu bulma
152|character|Gezici gözlemci eski ziyaret dosyasını çantasından çıkarıp dinlenmeye geçer|okullar arası sivil dinlenme durağı|full-scene|Bedelli arşiv dönüşü ve o tur tartışmadan vazgeçme
153|character|Sandık avukatı gözlemciyle birlikte kapalı destek dosyasını inceler|geçici hukuk destek bankosu|two-shot|Takım savunması ve kapalı desteğe bakış
154|character|Bölge sorumlusu azalan malzemeleri farklı saha gruplarına dağıtır|tanınmayan bölgesel koordinasyon deposu|high-angle|Sürekli ekip gücü karşılığında düzenli bedel
155|character|Okul temsilcisi kendi görev çantasını daha yeni yetişkin gönüllüye bırakır|boş okul koridoru|two-shot|Küçük Sandık kadrosu için görev devri ve ara
156|character|Veri uzmanı karşı dosyayı beklemeye alıp kendi saha ekibine doğrulanmış paket uzatır|seçim verisi işleme tezgâhı|over-shoulder|Bedelle rakibi savunmaya çevirip dostu güçlendirme
157|character|İlçe koordinatörü devredilmiş çantaları toplar ve eskiden ayrılan görevlinin zarfını saklar|iki katlı gönüllü merkezi merdiveni|full-scene|Giriş fedalarından güç ve ayrılışta küçük kadro dönüşü
158|character|Kadın randevu sekreteri boş saat dilimine kimliksiz dosya ekler|aydınlık randevu kabul camı|medium|Bedelli Kulis kadrosu araması
159|character|Koridor habercisi uzak emanet bölmesinden dosya getirir|uzun kurumsal sivil koridor|full-scene|Oyun dışındaki Kulis kaydını geri alma
160|character|Yaşlı teşkilat emektarı azalan kaynakların yanında genç yetişkini geriye oturtur|eski gönüllü lokali|two-shot|Kritik kaynakta savunma ve dostu koruma konumuna alma
161|character|Liste pazarlıkçısı küçük ekiplerin dosyalarını korurken kendi malzeme kutusu incelir|yuvarlak liste hazırlık sehpası|top-down|Küçük Kulis kadrolarına düzenli bedelli savunma
162|character|İl delegesi yedek dosyayı teslim edip eski görevliye yerini bırakır|delegasyon taşıma kapısı|close-action|Arşivdeki küçük Kulis kadrosunu geri çağırma ve ara
163|character|Arabulucu açık karşı öneriyi sahibine iade ederek iki ekibin oturmasını sağlar|bölmesiz görüşme salonu|three-person|Bedelli açık destek iadesi
164|character|Kapalı oturum başkanı devredilmiş dosyalarla masayı devralır|perdeli ama sivil toplantı odası|medium|Malzeme katkısıyla güç ve ayrılıştan sonra Kulis kaydı dönüşü
165|character|Komisyon raportörü yeni rapor dosyasını alırken masadaki malzemesinden vazgeçer|komisyon rapor kabul nişi|side-profile|Bedel karşılığında küçük Kürsü kadrosu araması
166|character|Oturum kâtibi kapalı paketi kontrollü açıp konuşmacının evraklarını kapak altında toplar|toplantı masası yan bankosu|over-shoulder|Gizli bilgiye bakış ve dost savunması
167|character|Usul savunucusu yanında bir başka konuşmacı varken görev dosyasını ortak havuza bırakır|sivil müzakere sırası|two-shot|Ortak kadroyla güç ve ayrılışta kaynak katkısı
168|character|Meclis sözcüsü kapalı arka dosya önünde başka konuşmacıya koruyucu dosya kapağı verir|kurmaca sivil meclis hazırlık alanı|three-person|Kapalı hazırlıktan güç ve bedelli dost koruması
169|character|Soru önergesi yazarı eski emanet kaydını almak için kendi dosyasını bırakır|önerge teslim penceresi|close-action|Görev devriyle oyun dışı Kürsü kaydı ve kaynak dönüşü
170|character|Bütçe denetçisi eski karşı dosyayı ayrı kutuya kaldırıp kendi çalışma paketini güçlendirir|bütçe kontrol arşivi|top-down|Bedelli arşiv dışlama ve küçük dost katkısı
171|character|Komisyon başkanı devredilen görev dosyalarını sıralar; bir eski dosyayı çıkışa ayırır|uzun komisyon çalışma masası|wide-diagonal|Giriş malzemesine bağlı güç ve ayrılışta kayıt geri dönüşü
172|character|İmar arşivcisi kurgusal bina kesitleri arasından yetişkin görev dosyası seçer|belediye teknik arşivi|over-shoulder|Bedelli küçük Belediye kadrosu erişimi; gerçek harita yok
173|character|Park bahçe şefi eski alet çantasını ekibe geri getirip işi dinlenmeye alır|bitki bakım deposu|full-scene|Bedelli arşiv dönüşü ve tartışma arası
174|character|Afet koordinatörü yetişkin yardım görevlisiyle kapalı malzeme kaydını kontrol eder|sakin sivil hazırlık çadırı|two-shot|Takım dayanıklılığı ve kapalı desteğe erişim; felaket mağduru yok
175|character|Mahalle meclisi başkanı ortak avluda tükenen kırtasiyeyi çalışma gruplarına paylaştırır|mahalle toplantı bahçesi|group|Sürekli Belediye gücünün dönemsel bedeli
176|character|Fen işleri mühendisi ölçüm aletini genç yetişkin meslektaşına bırakır|işaretsiz bakım atölyesi|close-action|Küçük Belediye görevine devir ve o tur ara
177|character|İhale gözlemcisi karşı dosyayı beklemeye alırken kendi inceleme tepsisini öne çeker|şeffaf sivil teklif kabul masası|top-down|Bedelli rakip konum değişimi ve dost desteği
178|character|Kent plancısı özgün hacim maketlerini devredilen çizimlerle birleştirir|kurgusal kent tasarım atölyesi|wide-diagonal|Malzeme katkısıyla güç ve eski görevin dönüşü; gerçek coğrafya yok
179|character|Gece editörü raflardan yeni haber görevlisinin dosyasını alır|logosuz küçük gece haber odası|side-profile|Bedelli küçük Basın kadrosu araması
180|character|Yerel muhabir uzak emanet dolabındaki eski röportaj dosyasına ulaşır|sade mahalle haber bürosu|door-framing|Oyun dışındaki Basın kaydını geri getirme
181|character|Doğrulama editörü yorgun muhabiri sakin kontrol masasına davet eder|az malzemeli doğrulama bölmesi|two-shot|Kaynak azlığında savunma ve dostu geriye alma
182|character|Yayın yönetmeni küçük haber ekibinin dosyalarını örtü altında birleştirir|yayın planlama galerisi|group|Düşük kademeli Basın savunması karşılığında düzenli bedel
183|character|Saha kameramanı markasız kamerasını bırakıp eski meslektaşına yer açar|dış çekim dönüş holü|full-scene|Arşiv Basın kadrosunu çağırma ve tartışmaya ara
184|character|Basın ombudsmanı açık itiraz paketini sahibine sakin biçimde iade eder|bağımsız okur başvuru masası|close-action|Bedelle karşı açık desteğin ele dönmesi
185|character|Araştırmacı gazeteci farklı dosyaları birleştirip yedek kaynak dosyasını ayırır|sade araştırma kütüphanesi|over-shoulder|Giriş katkısıyla güç ve ayrılışta küçük Basın geri dönüşü
186|character|Örneklem uzmanı farklı zarflardan tek araştırmacı görev dosyası seçer|düzenli örneklem çalışma bankosu|top-down|Bedelli küçük Anket kadrosu araması
187|character|Telefon anketçisi işaretsiz cihaz yanında kapalı dosyayı açıp ekip klasörünü korur|sessiz araştırma görüşme bölmesi|medium|Bedelle kapalı bilgiye bakış ve dost savunması; ses yok
188|character|Veri temizleyicisi iki araştırmacının karışık kâğıtlarını ayırıp artık malzemeyi devreder|veri doğrulama tezgâhı|close-action|Ekipten güç ve ayrılışta kaynak katkısı
189|character|Araştırma direktörü kapalı plan dosyasını saklarken başka araştırmacının klasörünü sağlamlaştırır|araştırma yönetim balkonu|two-shot|Kapalı hazırlıkla güç ve bedelli Anket savunması
190|character|Odak grup moderatörü boşalan sandalyesini geri çağrılan yetişkin katılımcıya bırakır|dairesel görüşme odası|group|Kendi görevinden vazgeçerek oyun dışı kadroyu geri alma
191|character|Hata payı analisti uyumsuz arşiv örneğini ayrı çekmeceye kaldırır|ölçüm karşılaştırma masası|macro|Bedelle karşı arşivden çıkarma ve dost katkısı
192|character|Seçmen davranışçısı farklı saha dosyalarını uzun görüşme boyunca karşılaştırır|sivil davranış araştırması odası|portrait|Giriş katkılarıyla güç ve ayrılışta küçük Anket dönüşü
193|character|Evrak memuru kabul tepsisinden yeni kurum görevlisinin dosyasını bulur|yüksek camlı evrak gişesi|medium|Bedelli küçük Kurum kadrosu araması
194|character|Arşiv denetmeni eski dosyayı geri alıp incelemeyi sakin bekleme rafına koyar|kurum arşiv çapraz koridoru|full-scene|Bedelli arşiv dönüşü ve tartışma arası
195|character|Etik kurul üyesi başka sivil uzmanla kapalı başvuru dosyasını inceler|amblemsiz etik toplantı nişi|two-shot|Takım dayanıklılığı ve kapalı destek bilgisi
196|character|Kurum sekreteri azalan malzemeyi birden fazla işleme hazır dosyaya dağıtır|kurumsal dağıtım bankosu|high-angle|Tüm Kurum kadrolarına düzenli bedelli güç
197|character|Saha müfettişi çalışma çantasını yeni yetişkin denetçiye bırakır|sivil denetim hareket kapısı|close-action|Küçük Kurum kadrosu için görev devri ve ara
198|character|Kamu denetçisi karşı işlem tepsisini bekletip kendi kurum dosyasını öne alır|kamusal başvuru inceleme alanı|over-shoulder|Bedelle rakibi savunmaya çevirip dostu güçlendirme
199|character|İdari yargıç amblemsiz sivil kıyafetle devralınmış dosyaları karar öncesi inceler|simgesiz hukuk çalışma odası|side-profile|Giriş katkısıyla güç ve küçük Kurum kaydı dönüşü
200|character|Toplantı asistanı bir hazırlık kutusu harcayarak yeni katılımcı dosyasını bulur|konferans servis koridoru|full-scene|Bedelli küçük Lobi kadrosu erişimi
201|character|Sektör temsilcisi ayrı emanet alanındaki dosyayı görüşmeye geri taşır|markasız meslek odası fuayesi|medium|Oyun dışındaki Lobi kaydını geri alma
202|character|Uyum danışmanı az kaynaklı ekibi daha korunaklı oturma düzenine alır|ortak çalışma uyum odası|group|Düşük puanda savunma ve dost konum değişimi
203|character|Müzakere başkanı küçük ekiplerin çevresine dosya panoları kurar|uzun müzakere masası|wide-diagonal|Küçük Lobi kadrolarına düzenli bedelli savunma
204|character|Sendika delegesi eski temsilcinin dosyasını yeniden masaya koyup ayrılır|sivil dayanışma salonu çıkışı|two-shot|Küçük Lobi kadrosunu geri çağırma ve tartışma arası
205|character|Çıkar çatışması uzmanı açık öneriyi ortaklık sınırını göstererek sahibine iade eder|bağımsız uyum danışma bankosu|close-action|Lobi varlığıyla bedelli karşı destek iadesi
206|character|Bağış denetçisi devredilmiş tedarik kayıtlarını incelerken eski görev dosyasını saklar|logosuz bağış malzeme deposu|over-shoulder|Giriş fedalarıyla güç ve ayrılışta Lobi kaydı dönüşü
207|character|Yetişkin kampüs gönüllüsü malzeme sepetini teslim ederek yeni çalışma arkadaşını karşılar|üniversite yetişkin gönüllü masası|two-shot|Bedelli küçük Gençlik kadrosu erişimi
208|character|Yetişkin öğrenci temsilcisi kapalı başvuru dosyasını inceler ve arkadaşının klasörünü korur|kampüs sivil temsilci odası|medium|Bedelli kapalı bilgi ve dost savunması
209|character|Forum kolaylaştırıcısı iki yetişkin katılımcının konuşmasını düzenleyip görevi devreder|açık kampüs forumu|three-person|Ortak kadroyla güç ve görev devrinden kaynak
210|character|Genç yetişkin koordinatör kapalı hazırlık dosyası yanında çalışma arkadaşına destek örtüsü uzatır|kampüs gönüllü hazırlık çadırı|close-action|Kapalı tuzakla güç ve bedelli dost koruması
211|character|Bisikletli yetişkin gönüllü gidon çantasını bırakıp eski ekip arkadaşını getirir|kampüs bisiklet parkı|full-scene|Görev devriyle oyun dışı kadro ve kaynak dönüşü
212|character|Burs izleyicisi eski uyumsuz başvuruyu ayrı rafa alıp geçerli paketi güçlendirir|yetişkin öğrenci destek arşivi|top-down|Bedelli karşı arşivden çıkarma ve dost katkısı
213|character|Yetişkin kampüs sözcüsü devralınan dosyalarla sivil forumda konuşmaya hazırlanır|amblemsiz kampüs açık salonu|portrait|Malzeme katkılı güç ve küçük Gençlik geri dönüşü
214|character|Dilekçe yazarı kırtasiye paketini harcayıp yeni hukuk görevlisinin dosyasını seçer|sivil dilekçe yardım masası|close-action|Bedelli küçük Hukuk kadrosu araması
215|character|Yetişkin stajyer avukat eski vaka dosyasını getirip çalışma sırasını beklemeye alır|hukuk bürosu arşiv köşesi|side-profile|Bedelli arşiv dönüşü ve tartışmadan vazgeçme
216|character|Hak savunucusu bir meslektaşıyla kapalı başvurunun ayrıntısını kontrol eder|erişilebilir sivil destek bankosu|two-shot|Takım savunması ve kapalı desteğe bakış
217|character|Kriz hukukçusu azalan evrak malzemesini birden çok danışmana dağıtır|sivil danışma koordinasyon odası|group|Hukuk ekibine sürekli gücün kaynak bedeli
218|character|Adliye muhabiri markasız kayıt defterini yeni yetişkin meslektaşına bırakır|amblemsiz hukuk binası dış sahanlığı|full-scene|Küçük Hukuk kadrosu için devir ve ara
219|character|Dosya incelemecisi karşı paketi bekleme çekmecesine alıp dost dosyasını tamamlar|hukuk dosyası kontrol tezgâhı|over-shoulder|Bedelle karşı savunma ve dost güçlenmesi
220|character|Anayasa profesörü çeşitli kaynak klasörlerini birleştirip eski öğrenci dosyasını ayırır|yetişkin hukuk seminer çalışma odası|medium|Giriş katkısına bağlı güç ve küçük Hukuk geri dönüşü
221|character|Protokol yazmanı hazırlık malzemesini kullanarak ortak heyet dosyasını seçer|ortak çalışma kayıt masası|top-down|Bedelli küçük Koalisyon kadrosu erişimi
222|character|Heyet sekreteri ayrı salondaki emanet dosyasını ortak masaya getirir|heyetler arası geçiş galerisi|full-scene|Oyun dışındaki Koalisyon kaydını geri alma
223|character|Uzlaşı gözlemcisi azalan malzemeler arasında tarafları korunaklı oturmaya yönlendirir|sivil uzlaşma bekleme alanı|three-person|Düşük puanda savunma ve dostu koruma konumuna alma
224|character|Ortak masa sözcüsü küçük heyetlerin dosyalarını çevreleyen ortak kapağı açar|çok taraflı sivil çalışma masası|wide-diagonal|Küçük Koalisyon ekibine düzenli bedelli savunma
225|character|Heyet kuryesi eski temsilcinin dosyasını getirip kendi teslim çantasını bırakır|ortak görüşme kapısı|close-action|Küçük Koalisyonun arşivden çağrılması ve ara
226|character|Mutabakat denetçisi açık karşı öneriyi sahibine iade edip ortak kaydı tutar|sivil mutabakat inceleme nişi|two-shot|Koalisyon varlığıyla bedelli açık destek iadesi
227|character|İttifak müzakerecisi devredilmiş dosyaları tek masaya toplar; eski heyet kaydını ayırır|tarafsız müzakere salonu|over-shoulder|Malzeme katkısıyla güç ve küçük Koalisyon geri dönüşü
228|character|Depo sayımcısı bir kutu tüketip yeni lojistik görev çantasını bulur|sivil kampanya malzeme deposu|high-angle|Bedelli küçük Lojistik kadrosu araması
229|character|Otobüs koordinatörü kapalı sefer dosyasını açıp ekibin çalışma paketini korur|markasız taşıt garajı ofisi|medium|Bedelli gizli bilgi ve dost savunması
230|character|Sivil sahne görevlisi bir meslektaşıyla amblemsiz platformun güvenli geçişini düzenler|şiddetsiz açık forum sahnesi yanı|full-scene|Ortak Lojistik gücü ve görev devrinden kaynak
231|character|Saha operasyon şefi kapalı plan çantasının yanında çalışma arkadaşına koruma kapağı verir|geçici lojistik kontrol çadırı|two-shot|Kapalı hazırlıktan güç ve bedelli dost koruması
232|character|Yetişkin dağıtıcı yazısız afiş rulolarını bırakıp eski ekibe yeniden ulaşır|kampanya kâğıt deposu çıkışı|close-action|Görev devriyle oyun dışı Lojistik ve kaynak dönüşü
233|character|Akaryakıt denetçisi markasız tedarik kayıtlarından uyumsuz eski dosyayı ayırır|sivil servis garajı kayıt bankosu|top-down|Bedelli karşı arşiv dışlama ve dost katkısı; yakıt tehlikesi resmedilmez
234|character|Miting organizatörü devredilen sahne çantalarını yerleştirip eski görev dosyasını saklar|amblemsiz sivil etkinlik kurulum alanı|wide-diagonal|Giriş katkılarıyla güç ve küçük Lojistik geri dönüşü
235|institution|Saha ve kulis ekipleri iki ayrı kurgusal kent çalışma masasını birleştirir|kentler ortak sivil koordinasyon holü|group|Sandık ve Kulis malzemesiyle bedelli açık destek iadesi
236|institution|Konuşma ve belediye görevlileri açık öneri dosyasını ortak tepsiden geri verir|amblemsiz ortak seçim çalışma kurulu|three-person|Kürsü ve Belediye birleşimiyle karşı desteği iade
237|institution|Basın görevlisi ve araştırmacı bağımsız inceleme masasında karşı evrakı geri uzatır|tarafsız sivil denetim odası|two-shot|Basın ve Anket malzemesiyle bedelli destek iadesi
238|institution|Kurum ve meslek temsilcileri ortak uzlaşma masasında açık öneriyi yeniden görüşmeye yollar|toplumsal sivil görüşme salonu|group|Kurum ve Lobi birleşimiyle açık desteğin ele dönüşü
239|action|Sayım itiraz dosyasından yeni görevli kaydı seçilir; bir eski zarf dışarı ayrılır|sandık itiraz tezgâhı|top-down|Bedelli kadro araması sonrası elden kayıt bırakma
240|event|Randevu için koridorda bekleyen görevli iki dosyadan birini inceler|dar görüşme bekleme sahanlığı|door-framing|Kulis koşuluyla üst iki kayıttan sınırlı seçim
241|object|Boş zaman bölmeli komisyon takvimi iki arşiv dosyasını farklı raflara yönlendirir|komisyon planlama masası|still-life|Kendi eski kaydını alma ve karşı arşiv kaydını çıkarma
242|object|Gerçek coğrafya olmayan yapı krokisi askı panosundan geri alınır|sivil imar danışma avlusu|environment|Açık desteği iade edip Belediye savunmasını artırma
243|action|Editör yazısız haber tomarlarından uygun görev dosyasını seçip başka birini bırakır|matbaa tarama tezgâhı|over-shoulder|Bedelli Basın araması ve elden bırakma
244|object|Üç ham veri zarfı bozulmamış sırayla tutulur; biri incelemeye ayrılır|anket veri kabul masası|macro|Anket koşuluyla üst üçten en fazla bir seçim
245|action|Arşiv talebinde kendi dosyası teslim edilirken karşı dosya emanet dışına ayrılır|kurum arşiv teslim penceresi|close-action|Kendi arşiv dönüşü ve karşı arşiv dışlama
246|object|Saydam bağış kutusu yanında açık öneri geri teslim edilir|sivil malzeme bağışı kontrol masası|still-life|Bedelli açık destek iadesi ve Lobi savunması
247|event|Yetişkin kampüs forumunda bir yeni görevli dosyası alınır, eski görüşme kâğıdı bırakılır|açık üniversite avlusu|crowd|Bedelli Gençlik kadrosu araması ve el değişimi
248|action|Hukuk görevlisi dört dosyayı sırayla inceler; birini dava hazırlığına ayırır|sivil dava hazırlık kütüphanesi|high-angle|Hukuk koşuluyla üst dörtte sınırlı seçim
249|object|İki tarafın boş ortak çalışma kâğıdı arşivdeki dosyaları ayrı yönlere taşır|ortak metin birleştirme bankosu|macro|Kendi Koalisyon dönüşü ve karşı arşiv dışlama
250|object|Markasız sefer çizelgesi basılı sayı olmadan dosya tepsilerini yeniden sıralar|sivil garaj planlama odası|still-life|Bedelli karşı destek iadesi ve Lojistik koruması
251|object|Asıl tutanağın yazısız yedek kopyası eski görev çantasının üstüne konur|sandık emanet dolabı|macro|Küçük Sandık kadrosunu geri çağırıp tartışmaya ara
252|action|Kapalı eski liste dosyası yeni bir hazırlık tepsisine yerleştirilir|kulis revizyon masası|close-action|Arşiv tuzağını yeniden setleme; hemen açılmama
253|event|Komisyon sandalyesi boş kalırken eski karşı dosya kaldırılır ve yeni zarf gelir|oturum arası sivil salon|environment|Kürsü koşuluyla arşiv dışlama ve yeni kart
254|action|Bakım görevlisi komşu ekibin küçük araç tezgâhını geçici görev için devralır|belediye onarım atölyesi|full-scene|Koşullu geçici küçük kadro kontrolü; zor kullanma yok
255|object|Eski baskı kalıbı yerine yazısız yeni kâğıt destesi işleme alınır|küçük matbaa ikinci vardiyası|still-life|Küçük Basın kadrosunun dönüşü ve tartışma arası
256|action|Örneklem uzmanı eski kapalı inceleme paketini yeniden ayrı tepsiye kurar|anket onarım çalışma masası|top-down|Arşiv tuzağını beklemeli yeniden hazırlama
257|object|Açık kamu dosyası yanında kaldırılan eski karşı kayıt ve yeni zarf durur|sivil bilgi erişim bankosu|still-life|Kurum koşuluyla arşiv dışlama ve bilgi çekişi
258|action|Yetişkin uzman çıkar beyanını boş dosyayla sunup karşı küçük ekibin görevini geçici alır|şeffaf sivil uyum görüşmesi|three-person|Lobi ve boş yer koşuluyla geçici kontrol
259|action|Bisikletli yetişkin gönüllülerden biri eski görevliyi ekibe geri yönlendirir|özgün kampüs ve mahalle geçişi|wide-diagonal|Küçük Gençlik kadrosunun dönüşü ve ara; harita yok
260|object|Kapalı itiraz dosyası sade kum saati yanında yeniden bekleme tepsisine konur|hukuk süre takip rafı|macro|Arşiv tuzağını kurma ve aynı tur açamama
261|event|Sivil ortak masaya yeni bölüm eklenir; eski karşı dosya kaldırılıp yeni zarf bırakılır|koalisyon çalıştayı salonu|high-angle|Koalisyon koşuluyla arşiv dışlama ve yeni kart
262|action|Teknisyen sessiz markasız ses masasını başka küçük ekipten geçici devralır|etkinlik teknik kontrol bölmesi|over-shoulder|Lojistik koşuluyla geçici kontrol; ses veya autoplay yok
263|object|Dayanıklı kumaş oy torbası birkaç saha çantasını aynı rafta tutar|sandık ekipman köşesi|still-life|Donatılan savunma ve Sandık ekibine ortak güç
264|event|İki sivil temsilci açık görüşme alanından sessiz bir yan bölmeye geçer|kulis danışma nişi|two-shot|Bireysel güç-savunma ödünleşimi ve ekip koruması
265|institution|Geçici küçük komisyonun taşınabilir masaları kurulur|sivil ortak bina boş salonu|environment|Donatılan koruma ve küçük Kürsü kadrolarına katkı
266|object|Markasız belediye servis otobüsü gecede bekleyen yetişkin ekibi taşır|tanınmayan kent gece durağı|wide-diagonal|Bireysel koruma ve Belediye ekip gücü
267|object|Sade bağlantı kablosu iki yayın çalışma masasını birbirine bağlar|logosuz basın bağlantı koridoru|macro|Bireysel güç-savunma ödünleşimi ve Basın koruması
268|action|Anket görevlisi sahada küçük ekibin zarf ve çantalarını kontrol eder|kurgusal mahalle araştırma noktası|full-scene|Bireysel savunma ve küçük Anket ekibine katkı
269|object|Yazısız karbon kopyalı makbuz katları kurum dosyası kapağına sıkıştırılır|sivil işlem gişesi|macro|Donatılan savunma ve Kurum ortak gücü
270|object|Toplantı oturma düzenini yalnız boş yerlerle gösteren sade protokol dosyası açılır|meslek temsilcileri toplantı masası|top-down|Bireysel güç-savunma ödünleşimi ve Lobi koruması
271|object|Markasız öğrenci servisine yalnız yetişkinler çalışma çantalarıyla biner|üniversite ulaşım cebi|full-scene|Donatılan koruma ve küçük Gençlik kadrolarına güç
272|object|Kapalı tedbir talebi dayanıklı dosya kapağının altına alınır|sivil hukuk başvuru tezgâhı|still-life|Donatılan savunma ve Hukuk ekibine katkı
273|event|Farklı heyetler ortak masada dosya birleştirirken kenarda korunaklı bir bölüm bırakır|sivil koalisyon çalıştayı|group|Bireysel güç-savunma ödünleşimi ve Koalisyon koruması
274|object|Katlanır amblemsiz konuşma platformu küçük lojistik ekibi tarafından açılır|sivil etkinlik kurulum avlusu|low-angle|Donatılan koruma ve küçük Lojistik kadrolarına katkı
275|event|İki sivil taraf acele görüşmede ikişer dosya alıp bırakır; konuşma sahası boş kalır|geç saat uzlaşma masası|two-shot|Bedelli iki alıp iki bırakma ve tartışmaya ara
276|object|Birbirine uymayan iki işaretsiz kilit parçası sandık dosyasının açılmasını durdurur|sayım kontrol bankosu|macro|İlerleyiş iptali ve küçük Sandık kaydının dönüşü; gerçek mühür yok
277|event|Yarı aralık kapıda görünen randevu dosyası görüşmeyi durdurur|kulis bekleme koridoru|door-framing|Bedelli iptal ve küçük Kulis kaydı geri dönüşü
278|action|Sivil usul görevlisi ilerleyen konuşma dosyasını durdurup eski kayıt tepsisini geri alır|komisyon masa sırası|close-action|Bedelli saldırı iptali ve küçük Kürsü dönüşü
279|object|Eksik boş bölmeli ruhsat dosyası bakım çantasını girişte bekletir|belediye başvuru camı|still-life|İptal sonrası küçük Belediye kaydının dönüşü
280|action|Editör düzeltme zarfını öne sürerek yeni açıklamayı durdurur; eski dosyayı geri alır|basın yanıt kabul masası|over-shoulder|Bedelli iptal ve küçük Basın kaydı dönüşü
281|object|Uyumsuz boş örnek zarfları saha hareketini durduran ayrı tepside durur|anket tutarlılık kontrol köşesi|top-down|İptal ile küçük Anket kaydını yeniden alma
282|object|Eksik dosya izi bırakan boş rafın yanında eski kayıt geri bulunur|kurum arşiv boş gözü|still-life|Bedelli durdurma ve küçük Kurum kaydının dönüşü
283|action|Bağış paketi inceleme masasında bekletilirken önceki temsilci dosyası geri alınır|sivil bağış teslim alanı|close-action|İptal ve küçük Lobi geri dönüşü
284|event|Yetişkin forum katılımcıları sessizce oturumu durdurur; eski katılımcı dosyası geri getirilir|yazısız ve şiddetsiz kampüs forumu|crowd|Bedelli iptal ve küçük Gençlik kaydı dönüşü
285|object|İşleme giden dosyanın önüne sade bekleme kapağı konur|amblemsiz hukuk süreç bankosu|macro|İlerleyişi durdurma ve küçük Hukuk kaydı dönüşü
286|event|Bir heyet ortak oturma düzenindeki boşluğu fark edip görüşmeyi durdurur|sivil ortak protokol salonu|group|İptal ve küçük Koalisyon kaydını geri alma
287|object|Markasız servis kapısı kapalıdır; eski görev çantası iade tepsisinde bekler|sivil sefer başlangıç garajı|environment|İptal ve küçük Lojistik kaydı dönüşü
288|object|İki yazısız tutanak kopyası yan yana açılıp yeni işlem tepsisini kapatır|sandık kayıt karşılaştırma masası|top-down|Destek iptali ardından Sandık savunması
289|location|Görüşme kapısı kapanır; içerideki dosya güvenli rafta kalır|kulis yan oda eşiği|door-framing|Destek açılışını etkisizleştirme ve Kulis koruması
290|object|Boşalan sade kum saati yanında komisyon işlem tepsisi kapanır|oturum süre kontrol masası|macro|Destek iptali ve Kürsü savunması
291|action|Özgün bina hacim maketi yanındaki itiraz zarfı açık projenin ilerlemesini durdurur|belediye plan inceleme atölyesi|close-action|Destek iptali ve Belediye koruması; gerçek harita yok
292|object|Markasız açık mikrofon boş konuşma masasında fark edilir; dosyalar örtülür|logosuz basın hazırlık stüdyosu|still-life|Destek iptali ve Basın savunması; ses yok
293|object|Birbirine uymayan iki sayısız veri dizisi araştırma tepsisini durdurur|anket karşılaştırma ışık masası|top-down|Destek iptali ve Anket savunması
294|event|Sivil denetçiler beklenmedik biçimde girince açık işlem masası kontrollü kapanır|amblemsiz kurum evrak odası|full-scene|Destek iptali ve Kurum koruması; baskın şiddeti yok
295|event|Bir temsilcinin iki ayrı teklif dosyası çakışınca toplantı işlemi durur|sivil çıkar beyanı inceleme masası|two-shot|Destek iptali ve Lobi savunması
296|event|Yetişkin öğrenciler boş toplantı salonunun dışında sessizce bekler|yazısız kampüs katılım alanı|crowd|Destek iptali ve Gençlik savunması; propaganda yok
297|action|Gece gelen kurye işaretsiz tebligat zarfını kapıya teslim eder|sivil hukuk ofisi gece eşiği|door-framing|Destek iptali ve Hukuk koruması
298|event|Bir heyet masadan kalkarken kalan dosyalar koruyucu kapağın altında toplanır|sivil ortak çalışma salonu çıkışı|wide-diagonal|Destek iptali ve Koalisyon savunması
299|object|Eksik ekipman gözünün önünde açık sefer dosyası bekletilir|lojistik depo rafı|still-life|Destek iptali ve Lojistik koruması
300|action|Yetişkin görevli son itiraz zarfını doğrudan geçiş önüne uzatır; yeni dosya açılır|sandık karar kapısının eşiği|close-action|Düelloda bir kez doğrudan ilerleyişi iptal ve yeni kart; zafer uydurulmaz
`.trim().split('\n').map(row => row.split('|'));

const unresolved = {
  'SND-046': 'The executable once-per-turn battle-destruction protection is clear; the identity meant by “Eski Devlet” remains unspecified. A supported civic doorway is an authored durability metaphor awaiting visual-author review, not a literal source identification.',
  'SND-132': 'Random opponent-hand discard is explicit in text and executable operations. “Kaynaklar” still does not identify people, records or funding; a separated sealed file is a provisional lost-option metaphor, not proof of an informant, leak or intentionally anonymous source.'
};

// B4/B8 source-only recheck of the 13 original interpretation flags.
// SOURCE_BOUNDED means the cited source settles the narrow meaning, NOT that art is approved.
const grounding = {
  'SND-017': {
    expectedName:'Teşkilatçı',disposition:'SOURCE_BOUNDED_NOT_ART_APPROVED',
    sourceFacts:'The immutable Turkish text retains “Sandık yemini”; source.textEn and designs[17] explicitly specify one Level 3 or lower Ballot unit from own hand or deck when summoned. The typed summon helper adds kind:unit; runtime also requires an empty unit slot and specialAllowed.',
    visualInterpretation:'One adult ballot volunteer welcomed into an available work position represents the executable recruitment effect. This is an authored scene, not an oath ceremony.',
    notImpliedBySource:'This resolves the visual recruitment reading, not permission to correct Turkish copy or bypass summon eligibility. No pledge, ritual, invented type or guaranteed summon is implied.',
    retainedConstraints:['Keep source.text and all other card fields byte-for-byte unchanged.','No oath text, religious ritual or invented card type.','Exactly one arriving adult; do not depict unlimited reinforcements.'],
    runtimeEvidence:{authority:'Read-only source and executable-operation inspection; not an individual gameplay replay or art approval.',paths:['public/games/veto-h/designs.js:105-111','public/games/duel-core/card-dsl.js:49-51','public/games/duel-core/effects.js:433-445','public/games/duel-core/selection.js:21-31'],existingTestBoundary:'duel-parity.test.mjs checks the Special Summon cap for both seats; no dedicated SND-017 scenario was found or run in this brief review.'}
  },
  'SND-042': {
    expectedName:'Emekli Paşa',disposition:'SOURCE_BOUNDED_NOT_ART_APPROVED',
    sourceFacts:'Unit/effect title denotes a retired rank-holder. The effect triggers when this card is destroyed in battle and makes the opponent destroy one unit.',
    visualInterpretation:'A retired civilian leaves his desk while an opposing working position empties; this is a nonviolent role-loss metaphor.',
    notImpliedBySource:'The source supplies no face, real person, uniform, insignia, historical event or physical violence requirement.',
    retainedConstraints:['Civilian adult clothing only; no uniform or rank badge.','Do not show injury, death or a recognisable historical person.','Retirement and two work positions must remain readable without extra text.']
  },
  'SND-046': {
    expectedName:'Eski Devlet',disposition:'UNRESOLVED_SOURCE_AMBIGUITY',
    sourceFacts:'Unit/effect card; designs[46].traits.battleProtection is turn. rules.js consumes card.used.protection for the current turn on the first battle-destruction attempt. This does not itself cancel battle damage or grant protection from effects.',
    visualInterpretation:'An aged civic doorway with one temporary support proposes limited durability; the doorway and support are authored metaphors, not source-defined objects.',
    notImpliedBySource:'No literal person, institution, era, regime, building or political identity is specified.',
    retainedConstraints:['Keep the doorway and support marked as provisional metaphor; no invulnerability halo.','No real institution, historical identity, national boundary or emblem.'],
    runtimeEvidence:{authority:'Read-only executable-operation inspection; unresolved literal identity remains, not a mechanical ambiguity.',paths:['public/games/veto-h/designs.js:266-268','public/games/duel-core/rules.js:236-245'],existingTestBoundary:'duel-mechanics.test.mjs:174 tests destruction protection without damage cancellation using GETT cards, not SND-046; no dedicated SND-046 scenario was found or run.'}
  },
  'SND-049': {
    expectedName:'Yargı Lobisi',disposition:'SOURCE_BOUNDED_NOT_ART_APPROVED',
    sourceFacts:'Unit/effect card delays opposing trap activation by one additional turn after setting; the source explicitly writes gecikme +1.',
    visualInterpretation:'Moving a meeting file to the next waiting compartment represents delay.',
    notImpliedBySource:'The game effect does not establish a factual allegation about any real court, corruption or institution.',
    retainedConstraints:['Fictional civilian waiting area only.','No real court logo, robe, emblem, accused person or corruption scene.','Do not replace exact timing text with extra in-art rules.']
  },
  'SND-070': {
    expectedName:'Milli Liste',disposition:'SOURCE_BOUNDED_NOT_ART_APPROVED',
    sourceFacts:'Unit/fusion card whose effect text specifies three units and permission to attack directly.',
    visualInterpretation:'Three separate civilian work groups join beside an open route.',
    notImpliedBySource:'No actual nation, country border, flag, political party or slogan is named.',
    retainedConstraints:['Exactly three contributing groups as composition cue, not new rules.','No national or party symbols; no propaganda lettering.']
  },
  'SND-084': {
    expectedName:'Transfer Bombası',disposition:'SOURCE_BOUNDED_NOT_ART_APPROVED',
    sourceFacts:'Normal spell sends one opposing level4-or-lower unit to discarded cards and special-summons one own unit of the same level from hand.',
    visualInterpretation:'One working position empties while an equal-height replacement is prepared on the other side.',
    notImpliedBySource:'The specified effect is a role exchange, not detonation, area damage or destruction of a physical place.',
    retainedConstraints:['No explosive, weapon, blast or injury.','Equal level is only a visual correspondence; preserve exact rule text outside art.']
  },
  'SND-118': {
    expectedName:'Koruma Konvoyu',disposition:'SOURCE_BOUNDED_NOT_ART_APPROVED',
    sourceFacts:'Equip spell prevents the equipped unit from being targeted by an opposing effect.',
    visualInterpretation:'Unbranded civilian transport brings its passenger into a sheltered entrance.',
    notImpliedBySource:'Target protection does not grant blanket invulnerability, battle survival or an armed escort.',
    retainedConstraints:['Civilian unbranded vehicles; no armed guards, uniforms or weapons.','Rain shelter is a visual protection metaphor, not a new weather mechanic.']
  },
  'SND-121': {
    expectedName:'Eski Tweet',disposition:'SOURCE_BOUNDED_NOT_ART_APPROVED',
    sourceFacts:'Normal trap targeting a yüzüstü unit for destruction; the exact state wording stays in source.text.',
    visualInterpretation:'An older unbranded device rests beside a closed case file; no content is shown.',
    notImpliedBySource:'No actual post, author, platform interface, quotation or real allegation is supplied.',
    retainedConstraints:['Keep immutable title; never invent a tweet or quote in the illustration.','No platform logo, copied UI, readable screen or identifiable person.']
  },
  'SND-124': {
    expectedName:'Rüşvet İddiası',disposition:'SOURCE_BOUNDED_NOT_ART_APPROVED',
    sourceFacts:'Normal trap makes the target unit ATK0 for this turn. The title explicitly says an allegation, not an established act.',
    visualInterpretation:'A sealed allegation file waits for review, with no payment, exchange or accused face shown.',
    notImpliedBySource:'The source does not establish guilt, a completed bribe, permanent power loss or a real case.',
    retainedConstraints:['Show only a pending fictional file; no money handover.','No identifiable accused person, verdict text or factual corruption claim.']
  },
  'SND-127': {
    expectedName:'Mitinğe Saldırı',disposition:'SOURCE_BOUNDED_NOT_ART_APPROVED',
    sourceFacts:'Normal trap activates at the start of the Debate Phase, skips that phase and goes to Move2.',
    visualInterpretation:'An empty civic speaking platform is closed for an interrupted session.',
    notImpliedBySource:'The specified rule does not require depiction of an attacker, injury, weapon, damaged building or historical event.',
    retainedConstraints:['Show interruption aftermath only: empty and physically unharmed setting.','No attack, injured person, weapon or real incident reference.','Do not imply the whole turn is skipped.']
  },
  'SND-132': {
    expectedName:'Kaynaklar',disposition:'UNRESOLVED_SOURCE_AMBIGUITY',
    sourceFacts:'Normal trap; designs[132] composes discard(1,true,true). The discard primitive selects one opposing-hand UID with seeded random(state) and moves it to grave if present; an empty hand yields no discarded card.',
    visualInterpretation:'One identical sealed file separated from a group represents a lost option without a visible choosing hand; the scene does not identify what Sources refers to.',
    notImpliedBySource:'Source identity and even the meaning of sources are unspecified. Intentional anonymity, an informant, financing or evidence collection cannot be asserted.',
    retainedConstraints:['The file metaphor remains provisional; do not assert anonymity or a leak as source facts.','No invented source identity, journalist, payment or factual disclosure.','No chooser selecting a valuable visible file; no guaranteed reward or empty-hand loss.'],
    runtimeEvidence:{authority:'Read-only executable-operation inspection; unresolved narrative referent remains, not a mechanical ambiguity.',paths:['public/games/veto-h/designs.js:741','public/games/duel-core/card-dsl.js:11-16','public/games/duel-core/effects.js:59-69'],existingTestBoundary:'duel-mechanics.test.mjs:202 tests non-random SND-014 hidden-hand choice, not this random discard; no dedicated SND-132 scenario was found or run.'}
  },
  'SND-199': {
    expectedName:'İdari Yargıç',disposition:'SOURCE_BOUNDED_NOT_ART_APPROVED',
    sourceFacts:'Unit/effect card requires one tribute to enter, gains200ATK per summon tribute, and on battle destruction returns one level3-or-lower Kurum unit from discarded cards to hand.',
    visualInterpretation:'A civilian legal worker reviews handed-over files and keeps an older institutional file aside.',
    notImpliedBySource:'The source specifies no actual court, official robe, badge, judgement, real jurisdiction or judicial outcome.',
    retainedConstraints:['Retain title exactly while using fictional civilian attire.','No court insignia or claim of institutional endorsement.','File handover illustrates tribute abstractly; no human sacrifice.']
  },
  'SND-262': {
    expectedName:'Ses Kontrolü',disposition:'SOURCE_BOUNDED_NOT_ART_APPROVED',
    sourceFacts:'Normal spell costs1550OP, temporarily takes an opposing face-up level4-or-lower unit for this turn, and requires an own Lojistik unit plus an empty unit slot.',
    visualInterpretation:'A technician temporarily takes responsibility for an unbranded sound desk from another team.',
    notImpliedBySource:'The card title does not create permission or a requirement for audio playback, microphone access or autoplay.',
    retainedConstraints:['Static silent art only; no media files or audio API.','Technical equipment must be unbranded; no invented control duration or permanent transfer.']
  }
};

export function buildManifest() {
  const sourceBytes = readFileSync(root+sourcePath);
  assert.equal(digest(sourceBytes),protectedSourceSha256,'Immutable source-card contract changed; stop and review, do not rewrite data.');
  const cards=JSON.parse(sourceBytes);
  assert.equal(cards.length,300);
  assert.equal(authoredRows.length,300);
  const byId=new Map(authoredRows.map(([n,...brief])=>['SND-'+n,brief]));
  assert.equal(byId.size,300,'Explicit authored rows must have unique IDs.');
  const entries=cards.map(source=>{
    const row=byId.get(source.id);assert.ok(row,`Missing authored scene for ${source.id}`);
    const [sceneClass,subjectAction,setting,composition,effectRelationship]=row;
    assert.equal(row.length,5);
    if(grounding[source.id])assert.equal(source.name,grounding[source.id].expectedName,'Grounding record no longer matches canonical title.');
    return {
      id:source.id,
      source, // Exact original object: names, types, effects, stats, localization and deck metadata stay intact.
      sourceRecordSha256:digest(JSON.stringify(source)),
      sceneClass,subjectAction,setting,composition,
      effectRelationship:{kind:'visual_metaphor_not_rule_rewrite',description:effectRelationship,mechanicalAuthority:'source.text'},
      ...(grounding[source.id]?{sourceGrounding:{...grounding[source.id],evidence:{name:source.name,kind:source.kind,subtype:source.subtype,effectText:source.text},authority:grounding[source.id].runtimeEvidence?'Canonical bilingual source plus read-only typed-operation inspection; not a dedicated gameplay replay or rendered-art review':'Canonical card text only; not a runtime-rule test or rendered-art review'}}:{}),
      implementationStatus:'PLANNED_NOT_DRAWN',
      qualityGate:'BLOCKED_BY_FAILED_VECTOR_REALISM_PROBE',
      reviewStatus:unresolved[source.id]?'SEMANTIC_REVIEW_REQUIRED':'ASSISTANT_BRIEF_ONLY_NOT_ART_APPROVAL',
      unresolved:unresolved[source.id]??null
    };
  });
  const countBy=key=>Object.fromEntries([...new Set(entries.map(e=>e[key]))].sort().map(k=>[k,entries.filter(e=>e[key]===k).length]));
  return {
    schema:1,game:'veto-h',status:'ART_PREPARATION_ONLY',reviewStatus:'AUTHOR_DRAFT',owner:'Astra',branch:'astra/veto-semantic-art-preparation',base:'a534289490f502f68e12d91803fbc3883de7d790',
    sourcePath,protectedSourceSha256,sourceCardCount:cards.length,
    authorship:'Explicit per-ID scene rows authored after inspecting all 300 original names, types and effect texts. No regex classifier generates subjects or settings.',
    constraints:{artMode:'Original SVG/vector/layered rendering only',noRasterPlate:true,noImageGeneration:true,noExternalAssets:true,noTrace:true,noVisibleLettersOrNumbers:true,noExtraFlavorText:true,noRealPersonOrInstitution:true,noFlagsLogosUniformsOrWeapons:true,noViolence:true,adultsOnly:true,noAudio:true,mechanicsUnchanged:true,cardAndArtDimensionsUnchanged:true,intrinsicArtDimensions:[576,384],preserveLocalizationAccessibility:true},
    visualDirection:{palette:['cream','forest green','warm wood','restrained red'],lighting:'Coherent window/daylight for most scenes; scene-required night/studio lighting stays restrained.',characterDiversity:'Distinct fictional adult identities and anatomically credible hands/faces; identities must be designed per scene, never reuse one face with a wardrobe change.',compositionPolicy:'Composition labels are planning categories, not reusable plate templates. Every scene retains its explicit subject, action, setting and effect relation.',nonnumericEffects:'Art suggests actions and trade-offs; all exact costs, timings and rewards remain solely in unchanged source/UI text.'},
    production:{completedCards:0,publishedCards:0,approvedCards:0,browserTested:false,offlineTested:false,saveTested:false,PR:null,gate:'Do not scale failed SND-001 probe or claim these briefs are completed cards.',futurePipeline:'Replacing only public WebP is insufficient: approved final art must update scripts/duel-art-packs and truthful manifests with offline/version and immutable-data regression evidence.'},
    coverage:{entries:entries.length,uniqueIds:new Set(entries.map(e=>e.id)).size,uniqueSubjectActions:new Set(entries.map(e=>e.subjectAction)).size,uniqueSettings:new Set(entries.map(e=>e.setting)).size,sceneClasses:countBy('sceneClass'),compositions:countBy('composition'),sourceGrounding:{reviewedIds:Object.keys(grounding),sourceBoundedCount:Object.values(grounding).filter(e=>e.disposition==='SOURCE_BOUNDED_NOT_ART_APPROVED').length,unresolvedCount:Object.keys(unresolved).length,artApprovedCount:0},unresolvedIds:Object.keys(unresolved)},
    cards:entries
  };
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const manifest=buildManifest();
  writeFileSync(new URL('./semantic-art-briefs.json',import.meta.url),JSON.stringify(manifest,null,2)+'\n');
  console.log(JSON.stringify(manifest.coverage,null,2));
}
