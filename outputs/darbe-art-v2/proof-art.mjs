/**
 * DARBE-H editorial art study. Original geometry; no borrowed illustrations,
 * fonts, logos, generated bitmaps, animation or runtime game changes.
 * Run: node outputs/darbe-art-v2/proof-art.mjs
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const PALETTE = Object.freeze({ paper: '#f2e8d9', ink: '#202830', aubergine: '#302b37', sage: '#6a847b', clay: '#ca775b' });
const { paper, ink, aubergine, sage, clay } = PALETTE;
const xml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const p = (d, fill, opacity = 1, stroke = '', sw = 1) => `<path d="${d}" fill="${fill}"${opacity === 1 ? '' : ` opacity="${opacity}"`}${stroke ? ` stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"` : ''}/>`;
const line = (d, color = ink, sw = 1, opacity = 1) => p(d, 'none', opacity, color, sw);
const rect = (x,y,w,h,fill,rx=0,opacity=1) => `<rect x="${x}" y="${y}" width="${w}" height="${h}"${rx?` rx="${rx}"`:''} fill="${fill}"${opacity===1?'':` opacity="${opacity}"`}/>`;
const ellipse = (cx,cy,rx,ry,fill,opacity=1) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}"${opacity===1?'':` opacity="${opacity}"`}/>`;
const group = (transform,body) => `<g transform="${transform}">${body}</g>`;
// Blank form grids are physical structure, not invented writing or symbols.
const form = (x,y,w,h,fill=paper) => rect(x,y,w,h,fill)+rect(x+3,y+3,w-6,4,sage,0,.3)+line(`M${x+3} ${y+11}H${x+w-3}M${x+3} ${y+18}H${x+w-3}M${x+w*.58} ${y+11}V${y+h-4}`,ink,.65,.35);
const feet = (d) => line(d,ink,1,.19);

export const SCENES = Object.freeze([
  { id:'DRB-001', title:'Dosya Kâtibi', concept:'Görev devri: masadan ayrılan dosya, açık hizmet kapısında yeni bir görevliyi karşılar.', effectLink:'Kâtibin kendisi arşive gider; desteden kademe 3 veya altı bir Dosya görevlisi özel çağrılır.', composition:'Yakın yan bakış; masa, dosya ve eşik arasında tek yönlü göz hareketi.' },
  { id:'DRB-022', title:'Arşiv Raportörü', concept:'Açılan arşiv çekmecelerinin arasından çıkarılan tek rapor; yer değiştiren tasnif kartları.', effectLink:'Çağrılma 200 KP sağlar; karıştırma ayrı kullanılabilen etkidir. Çizim yeni raporu ve yeniden tasnifi ayırır.', composition:'Derin arşiv koridoru; öndeki açık çekmece ile uzaktaki sivil raportör farklı ölçeklerde.' },
  { id:'DRB-072', title:'Yedek Kabine', concept:'İki farklı kayıt kaynağı ortak masada bir dosyaya dönüşür; bir destek dosyası iade tepsisine çekilir.', effectLink:'Kabine ve Arşiv malzemeleriyle kurulur; 900 KP karşılığında rakibin açık bir desteğini sahibinin eline gönderir.', composition:'Yukarıdan oval kurul masası; birleşen iki renk, masadan dışarı çıkan tek dosya.' },
  { id:'DRB-082', title:'Gece Brifingi', concept:'Lambanın sınırlı ışığında kapanan işlem dosyası, masanın ucuna ulaşmak üzere olan kâğıdın yolunu keser.', effectLink:'İlan edilen işlemi iptal eder; çizim arşivleme ya da kart yok etme iddiası taşımaz.', composition:'Karanlık oda; tek lambanın ışık düzlemi ve kesilen diyagonal akış.' },
  { id:'DRB-084', title:'Zeyil Cümlesi', concept:'Açılmış zeyil sayfası, aynı çalışma odasındaki masalar üzerinde ortak bir örtüye dönüşür.', effectLink:'Alan etkisi Karargah görevlilerine 300 ATK ve 300 DEF verir; güçlendirme tek kişiye değil ortak alana bağlıdır.', composition:'Mimari kesit; geniş katlanmış sayfanın altında üç ayrı sivil çalışma yeri.' },
  { id:'DRB-091', title:'Dosya Devri', concept:'Bir dosya derin arşiv tepsisine bırakılırken diğer taraftaki çekmeceden temiz bir sayfa alınır.', effectLink:'Desteden seçilen bir kart arşive gönderilir, ardından bir kart çekilir. İki işlem birbirinden okunabilir.', composition:'Çapraz üst görünüş; koyu kabul tepsisi ile aydınlık çıkış çekmecesi.' },
  { id:'DRB-264', title:'Uzun Brifing', concept:'Uzun ortak masa, iki ayrı toplantı grubunu bağlar; boş yere çekilmiş tek koltuğun geri dönüş izi görünür.', effectLink:'1550 KP, bir Meşruiyet görevlisi ve boş bölge gerektirir; rakibin açık kademe 4 veya altı görevlisinin kontrolü yalnız bu tur alınır.', composition:'Güçlü kaçış perspektifi; taşınan koltuk ve geride kalan yer izi geçiciliği anlatır.' },
  { id:'DRB-269', title:'Zeyil Eki', concept:'Dosyaya eklenen uzun yaprak ileri uzanır, gerideki desteği açığa çıkarır; alttaki çoğaltma şeritleri diğer istasyonlara uzanır.', effectLink:'Donatılan görevli +450 ATK ve −200 DEF alır; Telex görevlilerine ayrıca +100 DEF sağlar.', composition:'Makro cilt ayrıntısı; ileri çıkan ek ile eksilen arka dayanak karşılıklı görünür.' },
  { id:'DRB-127', title:'İhtar: Yanlış Suret', concept:'Işıklı doğrulama tablasında üst üste gelmeyen iki form; yanlış suret giriş eşiğinden arşiv ağzına katlanır.', effectLink:'Motor etkisi çağrıyı iptal ederek ilgili kartı arşive yollar; görünür iptal ve arşivleme aynı sahnede ayrıdır.', composition:'Kesit yakın planı; sayfa kenarlarının uyumsuzluğu ve aşağı yönelen arşiv kanalı.' },
  { id:'DRB-300', title:'İhtar: Masa Boşaldı', concept:'Boş kalan masaya uzanan karanlık, kapanan kapı eşiğinde durur; açık çekmecede yeni bir sayfa kalır.', effectLink:'Düelloda bir kez, doğrudan saldırıda 1000 KP ödenir; saldırı iptal edilir ve bir kart çekilir.', composition:'Geniş ve sessiz oda; insan yokluğu, kesilen ışık izi ve tek yeni belge.' },
].map(({effectLink,...meta})=>({...meta,mechanic:effectLink})));

const drawings = {
  'DRB-001': () => [
    rect(0,0,240,160,paper),rect(147,12,69,115,sage),rect(156,21,47,105,aubergine),
    p('M157 21H193V126H157Z',paper,.15),p('M203 21L226 12V134L203 126Z',ink),
    line('M154 126H216M148 12V130M219 17V132',ink,1.2,.55),
    p('M0 119L147 100 240 130V160H0Z',sage,.22),p('M155 126L215 126 240 158 187 158Z',aubergine,.13),
    rect(23,21,78,40,sage,1,.22),line('M30 27V54M37 27V54M44 27V54M51 27V54M58 27V54M65 27V54M72 27V54M79 27V54M86 27V54M93 27V54',paper,2,.65),
    p('M36 95Q29 82 35 70L48 64 63 73 69 103 55 119 33 114Z',aubergine),
    p('M42 63Q31 60 35 48Q38 41 47 44L53 53 51 64Z',clay),p('M35 49Q33 41 43 40L51 45 52 54 44 48Z',ink),
    p('M49 73L62 79 82 86 84 92 60 89 49 84Z',sage),p('M81 86L92 84 101 88 95 91 84 92Z',clay),
    p('M24 103L53 104 61 151H52L43 122 34 151H25Z',ink),
    p('M28 89L134 80 171 101 61 117Z',sage),p('M61 117L171 101V110L61 128Z',ink),p('M28 89L61 117V128L28 99Z',aubergine),
    line('M45 116V152M149 110V151',ink,5),line('M47 116V151M151 110V149',sage,1.2),
    p('M85 89L119 85 135 93 101 99Z',clay),p('M88 87L116 84 130 91 101 96Z',paper),line('M98 89L117 87M102 92L124 89',sage,.7),
    p('M167 112L168 88Q171 78 181 78Q190 81 193 95L193 113Z',sage),
    p('M172 78L170 70Q171 62 179 64L184 69 182 78Z',paper),p('M170 70L171 64 179 62 184 67 184 71 177 68Z',ink),
    p('M169 95L155 102 146 101 145 106 157 108 175 101Z',paper),
    p('M168 112H193L196 135H187L181 119 177 135H168Z',ink),
    line('M63 122L132 111',paper,.7,.25),feet('M171 143L180 141M163 151L172 149'),
  ].join(''),

  'DRB-022': () => [
    rect(0,0,240,160,aubergine),p('M103 24L162 24 161 133 87 160H34Z',sage),
    p('M108 27L151 30 151 113 109 119Z',paper,.7),p('M109 119L151 113 234 160H42Z',paper,.16),
    p('M0 0H90L109 27V140L71 160H0Z',ink),p('M13 17L83 17 96 28 23 29Z',clay,.9),
    p('M23 29L96 28V66L23 78Z',sage),p('M23 29L13 17V67L23 78Z',aubergine),
    p('M22 42L72 36V42L22 51Z',paper,.52),rect(66,47,16,3,ink,1),
    p('M14 80L92 66 98 87 20 111Z',paper),p('M20 111L98 87V120L20 145Z',sage),
    p('M14 80L20 111V145L10 112Z',clay),p('M23 84L87 72 91 84 27 103Z',ink),
    p('M29 82L46 77 49 96 32 101Z',paper),p('M44 80L60 75 64 92 48 97Z',sage),
    p('M58 76L76 71 80 88 63 94Z',clay),p('M75 73L86 70 90 84 81 88Z',paper),
    line('M34 119L76 105M38 122L71 111',paper,1,.4),p('M47 116L62 111 64 115 49 120Z',ink),
    p('M169 0H240V160L157 133V27Z',ink),
    ...[0,1,2].map(i=>{const y=18+i*35;return p(`M174 ${y}L229 ${y-8}V${y+20}L170 ${y+19}Z`,sage,.45)+line(`M174 ${y+22}L231 ${y+26}`,paper,.75,.26)+p(`M180 ${y+8}L196 ${y+6}V${y+9}L180 ${y+11}Z`,clay,.75);}),
    p('M125 85Q117 90 119 104L116 126 129 135 147 123 143 96 136 84Z',aubergine),
    ellipse(131,75,8,10,clay),p('M123 73Q122 61 134 65L140 70 138 76 133 71Z',ink),
    p('M135 92L149 85 155 100 140 108Z',paper),line('M141 94L149 91M143 98L151 95',sage,.8),
    p('M137 102L146 101 149 106 139 110Z',clay),
    p('M121 123L128 124 126 145 121 147Z',ink),p('M136 124L141 122 146 143 139 144Z',ink),
    line('M101 137L73 157M155 137L180 157',paper,.9,.25),
  ].join(''),

  'DRB-072': () => [
    rect(0,0,240,160,paper),p('M0 0H240V39L193 62 37 48 0 28Z',sage,.18),
    p('M29 3H62V51L28 64Z',aubergine),p('M32 10H58V18H32ZM32 27H58V35H32ZM32 44H58V49L32 58Z',sage),
    p('M178 0H211V63L178 49Z',ink),p('M182 9H207V19H182ZM182 28H207V38H182ZM182 47H207V57L182 49Z',clay),
    ellipse(121,103,90,43,aubergine,.13),ellipse(111,82,86,41,ink),ellipse(111,76,86,41,sage),
    ellipse(111,74,77,34,paper),ellipse(111,74,71,29,sage,.12),
    p('M103 49L122 45 137 55 130 94 110 102 90 91Z',ink,.15),
    p('M86 59L111 51 110 86 86 92Z',sage),p('M111 51L136 58 135 93 110 86Z',clay),
    p('M90 62L109 55 108 82 90 88Z',paper),p('M113 55L131 61 130 89 112 83Z',paper),
    line('M110 54V86M94 68L104 65M118 64L127 67M94 76L104 73M118 74L127 77',ink,.85,.45),
    p('M149 81L177 86 170 108 140 100Z',clay),p('M151 83L173 88 166 102 146 97Z',paper),
    p('M184 92L219 99 208 124 174 116Z',ink),p('M185 94L216 101 205 120 178 113Z',sage),
    line('M174 99L191 105',clay,2),line('M176 94L190 100',paper,1.5),
    p('M71 35Q58 29 47 39L46 55 61 64 73 53Z',aubergine),ellipse(61,33,7,8,clay),
    p('M66 52L78 58 86 62 83 68 71 62 62 59Z',ink),p('M83 62L93 63 92 68 83 68Z',clay),
    p('M140 35Q151 29 162 38L169 54 154 63 141 53Z',ink),ellipse(151,32,7,8,sage),
    p('M149 53L139 59 134 64 129 60 138 52Z',aubergine),
    p('M50 104L43 117 49 134 62 137 73 125 67 111Z',aubergine),ellipse(60,108,7,8,clay),
    p('M127 118L116 130 122 146 138 146 147 133 140 121Z',ink),ellipse(132,120,7,8,sage),
    line('M58 141L48 148M136 150L147 155',ink,3),
  ].join(''),

  'DRB-082': () => [
    rect(0,0,240,160,aubergine),rect(153,11,66,77,ink),rect(158,16,55,65,sage,0,.4),
    line('M160 25H210M160 34H210M160 43H210M160 52H210M160 61H210M160 70H210',ink,4),line('M180 17V79',ink,3),
    p('M0 113L151 83 240 110V160H0Z',ink),p('M41 111L155 93 230 119 104 151Z',sage,.25),
    p('M51 39L120 39 181 121 39 124Z',paper,.16),p('M62 46L101 46 156 115 60 131Z',paper,.14),
    p('M38 26Q77 6 110 25L114 42H34Z',sage),p('M34 42H114L106 49H43Z',ink),ellipse(75,44,28,3,paper),
    line('M48 24L32 8H17M22 8V114',sage,4),ellipse(24,116,19,5,aubergine),
    p('M48 101L108 85 127 104 67 122Z',paper),line('M56 104L99 93M62 112L91 105',sage,1),
    p('M109 74L159 91 147 125 96 105Z',clay),p('M109 74L116 52 166 69 159 91Z',aubergine),
    p('M116 52L166 69 160 74 110 57Z',paper,.7),p('M107 80L150 96 143 117 101 103Z',ink,.35),
    p('M115 68L138 75 138 90 117 83Z',sage),
    p('M161 105L207 115 190 138 148 126Z',paper,.25),p('M184 136L214 125 219 132 190 145Z',sage,.3),
    line('M43 147L96 155M13 128L43 124',paper,.6,.2),
  ].join(''),

  'DRB-084': () => [
    rect(0,0,240,160,paper),p('M14 53L115 12 225 45V137L119 160 14 118Z',sage,.2),
    p('M14 53L115 12V91L14 128Z',sage),p('M115 12L225 45V137L115 99Z',aubergine),
    p('M33 63L89 41V76L33 97Z',ink,.48),line('M46 59V90M62 53V85M78 47V79',paper,1,.4),
    p('M133 41L208 64V107L133 84Z',ink),
    p('M13 120L115 83 225 120 125 160Z',paper),line('M20 121L124 155 216 122',sage,.8,.6),
    p('M23 51L100 19 120 25 202 49 216 58 134 38 112 39 37 69Z',paper),
    p('M37 69L112 39 134 38 216 58V65L135 48 113 49 37 78Z',clay),
    p('M37 69L37 78 23 61V51Z',ink),line('M45 57L102 34M142 29L196 45',sage,1.1,.65),
    line('M37 78V124M113 49V100M216 65V127',sage,3),
    p('M36 98L67 87 91 97 60 109Z',paper),p('M60 109L91 97V104L60 116Z',sage),line('M43 104V130M83 105V129',ink,3),
    p('M92 113L122 102 149 112 119 124Z',paper),p('M119 124L149 112V119L119 131Z',sage),line('M101 120V145M141 120V142',ink,3),
    p('M152 94L181 85 210 95 180 106Z',paper),p('M180 106L210 95V102L180 113Z',sage),line('M162 102V125M203 103V125',ink,3),
    p('M55 83Q51 75 58 71Q65 70 66 78L64 85Z',clay),p('M49 92L54 84 64 84 74 92 66 98Z',ink),
    p('M111 98Q107 90 114 86Q121 85 122 93L120 100Z',sage),p('M105 107L110 99 120 99 131 107 122 114Z',aubergine),
    p('M172 79Q168 71 175 67Q182 66 183 74L181 81Z',clay),p('M165 88L171 80 181 80 192 88 182 95Z',ink),
    p('M72 94L81 97 70 101 63 98Z',clay),p('M127 111L137 114 126 118 119 115Z',clay),p('M189 92L200 96 190 100 180 96Z',clay),
  ].join(''),

  'DRB-091': () => [
    rect(0,0,240,160,sage),p('M0 0H101L218 160H0Z',paper,.2),
    p('M13 20L81 7 131 51 62 70Z',aubergine),p('M13 20L62 70V99L13 50Z',ink),p('M62 70L131 51V78L62 99Z',clay),
    p('M23 24L77 14 118 51 64 64Z',ink),p('M31 30L48 27 86 61 69 65Z',sage,.6),
    p('M80 17L108 12 151 49 123 57Z',paper),p('M123 57L151 49 132 73 104 80Z',paper),
    line('M93 24L112 20M102 32L124 27M114 49L136 43',sage,1),
    p('M145 71L208 58 238 86 174 104Z',paper),p('M174 104L238 86V112L174 133Z',ink),p('M145 71L174 104V133L145 105Z',aubergine),
    p('M157 76L203 66 226 87 180 98Z',ink),
    p('M177 90L208 82 230 104 196 115Z',clay),p('M196 115L230 104V121L196 134Z',clay),
    p('M183 92L207 86 225 103 200 111Z',paper),line('M190 96L209 92M198 103L216 99',sage,1),
    p('M192 117L215 109 215 113 193 121Z',ink),
    p('M17 130L49 118 89 149 68 160H48Z',aubergine),p('M49 118L66 112 83 117 109 117 111 123 91 130 75 130 68 139Z',paper),
    p('M203 0H240V23L202 56 183 52 183 44 194 37Z',aubergine),p('M183 44L176 51 177 62 187 65 197 57 204 43 199 35Z',clay),
    line('M116 83L129 94M121 79L134 90',paper,1.3,.65),feet('M7 116L28 108M91 150L134 137'),
  ].join(''),

  'DRB-264': () => [
    rect(0,0,240,160,paper),rect(0,0,240,39,aubergine),p('M0 39L114 56 240 39V160H0Z',sage,.2),
    p('M82 24L125 23 211 160H6Z',sage),p('M101 25L121 25 178 160H69Z',paper),
    p('M82 24L85 37 17 160H6Z',ink),p('M125 23L133 37 222 160H211Z',aubergine),
    p('M85 27L122 26 180 133 40 132Z',paper),p('M86 29L102 29 86 130H44Z',sage,.35),p('M105 29L121 28 176 130H94Z',clay,.28),
    line('M101 30L91 131',ink,.8,.23),
    p('M33 116L49 113 61 121 57 146 43 151 31 138Z',aubergine),p('M35 105L50 99 57 104 54 121 36 126Z',ink),
    line('M41 146L35 156M54 142L60 154',ink,2),
    p('M168 90L185 91 191 104 181 115 165 109Z',sage),p('M180 80L192 81 197 95 184 104Z',aubergine),
    p('M169 105L168 121 177 123 183 111Z',ink),line('M169 121L160 128M177 123L187 128',ink,2),
    p('M166 77Q160 67 168 62Q177 61 179 69L178 78Z',clay),
    p('M159 80L166 75 178 78 185 95 176 105 158 98Z',aubergine),p('M159 84L151 81 139 83 139 89 154 91 162 94Z',paper),
    p('M154 77L181 81 194 102 184 116', 'none',.42,clay,1),
    p('M206 53L219 55 226 76 215 84 202 73Z','none',.55,ink,1),
    feet('M181 113Q208 109 215 84M185 118Q214 113 221 85'),
    ...[[67,51,1],[56,69,1.1],[139,45,.75]].map(([x,y,s])=>group(`translate(${x} ${y}) scale(${s})`,ellipse(0,-4,4,5,clay)+p('M-8 5L-4 0H4L10 10 1 15-9 10Z',ink))),
    p('M93 53L111 53 119 66 97 65Z',paper),line('M99 57H111M100 61H114',sage,.8),
  ].join(''),

  'DRB-269': () => [
    rect(0,0,240,160,paper),p('M0 114L240 43V160H0Z',sage,.18),
    p('M22 87L115 42 158 83 62 133Z',aubergine),p('M28 87L111 48 150 83 62 126Z',sage),
    p('M62 126L150 83V93L63 142 22 97V87Z',ink),
    p('M34 81L106 47 145 81 70 119Z',paper),
    p('M104 47L161 20 220 65 147 100 145 81Z',clay),p('M110 48L162 26 212 64 147 95 145 79Z',paper),
    p('M147 95L212 64 199 100 150 122Z',paper),p('M147 95L150 122 140 105Z',sage),
    line('M120 53L164 34M127 60L176 41M135 67L185 47M160 97L194 81M159 102L192 87',sage,1,.65),
    p('M62 126L44 151 121 114 141 101 150 93 150 83Z',clay,.8),
    p('M22 97L35 101 35 132 44 151 18 128Z',sage),p('M35 132L62 126 44 151Z',ink),
    line('M19 84L102 44',ink,1.4),
    p('M93 33L101 29 113 42 110 55 102 58 95 46Z',aubergine),
    line('M99 33L107 42 105 51',paper,1.5),
    p('M151 123L184 111 206 121 173 134Z',sage),p('M177 139L211 126 234 138 200 151Z',sage),
    line('M133 102L135 131 173 134M125 107L130 143 200 151',ink,1.1,.48),
    p('M155 123L179 115 194 121 171 129Z',paper),p('M182 139L208 130 223 138 200 146Z',paper),
    line('M44 75L69 63M53 86L88 70M61 96L96 80',sage,1),
  ].join(''),

  'DRB-127': () => [
    rect(0,0,240,160,aubergine),p('M0 115L80 97 240 116V160H0Z',ink),
    p('M12 107L40 47 144 32 174 100Z',sage),p('M20 106L48 55 139 42 163 98Z',paper),
    p('M20 106L163 98V111L20 120Z',clay),p('M12 107L20 120V127L9 115Z',ink),
    p('M55 66L117 57 134 93 70 98Z',sage,.4),
    p('M67 53L128 50 146 84 82 92Z',paper,.9),line('M67 53L128 50 146 84 82 92Z',ink,1.2),
    line('M73 62L125 59M78 73L130 70M113 59L125 85',sage,1),
    line('M55 66L117 57 134 93 70 98Z',clay,1.6),
    p('M143 91L191 79 221 95 172 111Z',ink),p('M150 94L190 84 210 95 172 106Z',aubergine),
    p('M160 77L192 71 212 83 181 92Z',paper),p('M181 92L212 83 203 126 173 136Z',paper),
    p('M181 92L173 136 167 116Z',sage),line('M184 102L203 96M181 112L200 106',sage,1),
    p('M143 91L172 111V150L143 134Z',sage),p('M172 111L221 95V137L172 150Z',ink),
    line('M182 126L212 117M182 135L212 126',paper,.9,.22),
    p('M39 9L51 11 76 34 79 48 68 52 57 38 31 22Z',sage),
    p('M68 38L73 31 82 35 94 40 97 47 91 54 80 54 72 49Z',clay),
    line('M174 22L178 32M192 29L187 36M199 45L190 46',paper,1,.22),
  ].join(''),

  'DRB-300': () => [
    rect(0,0,240,160,paper),p('M0 0H240V81L106 106 0 74Z',sage),p('M0 74L106 106 240 81V160H0Z',paper),
    rect(28,12,51,72,ink),p('M34 17H74V80H34Z',aubergine),
    p('M45 18L74 18V79L45 89Z',paper),p('M45 18L40 22V89L45 89Z',clay),
    line('M28 85H77M26 12V88',paper,1.1,.6),
    p('M34 82L42 84 53 91 93 160H0V123Z',ink,.78),
    p('M45 89L74 80 174 141 131 158Z',paper),
    p('M146 13L213 17V56L146 54Z',paper,.34),line('M151 20L207 23M151 29L207 32M151 38L207 41M151 47L207 49',paper,1.4,.45),
    p('M77 89L148 74 213 97 140 116Z',aubergine),p('M78 87L148 72 213 94 140 112Z',paper),
    p('M140 112L213 94V103L140 122Z',ink),p('M78 87L140 112V122L78 97Z',clay),
    line('M86 99V141M200 107V150M143 123V157',ink,4),
    p('M144 122L181 112 194 123 155 137Z',sage),p('M155 137L194 123V135L155 150Z',aubergine),
    p('M149 123L179 116 188 123 159 134Z',paper),line('M156 123L176 119M160 128L182 123',sage,.9),
    p('M216 103L230 108 235 130 221 137 207 127Z',ink),p('M219 85L236 91V113L219 106Z',aubergine),
    line('M221 137L213 150M231 134L238 144',ink,2),
    ellipse(182,90,8,3,sage,.3),line('M115 95L130 92',sage,1.2,.5),feet('M213 151L188 155M203 143L182 146'),
  ].join(''),
};

export function renderScene(id) {
  const meta = SCENES.find(scene => scene.id === id);
  if (!meta || !drawings[id]) throw new RangeError(`Unknown proof scene: ${id}`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160" viewBox="0 0 240 160" role="img" aria-labelledby="title desc"><title id="title">${xml(meta.title)}</title><desc id="desc">${xml(meta.concept)}</desc>${drawings[id]()}</svg>\n`;
}

export function buildProofScenes(cards) {
  if (!Array.isArray(cards)) throw new TypeError('Pass the actual buildCards result.');
  return SCENES.map(meta => {
    const card = cards.find(c => c.id === meta.id);
    if (!card || card.name.tr !== meta.title) throw new Error(`Card metadata mismatch: ${meta.id}`);
    const svg = renderScene(meta.id);
    const bytes = Buffer.byteLength(svg);
    if (bytes > 12 * 1024) throw new Error(`SVG budget exceeded: ${meta.id}`);
    return { ...meta, path:`scenes/${meta.id}.svg`, width:240, height:160, bytes, sha256:createHash('sha256').update(svg).digest('hex'), card:{kind:card.kind,subtype:card.subtype,series:card.series,text:card.text.tr,effects:card.effects,costs:card.costs,traits:card.traits,triggers:card.triggers,response:card.response}, svg };
  });
}

async function writeProof() {
  const [{ buildCards }, { designs }, source] = await Promise.all([
    import('../../public/games/duel-core/card-data.js'),
    import('../../public/games/darbe-h/designs.js'),
    readFile(new URL('../../public/games/darbe-h/source-cards.json',import.meta.url),'utf8'),
  ]);
  const scenes=buildProofScenes(buildCards(JSON.parse(source),designs,'darbe-h'));
  const totalBytes=scenes.reduce((n,s)=>n+s.bytes,0);
  if (totalBytes > 100 * 1024) throw new Error('Combined SVG budget exceeded.');
  await mkdir(new URL('./scenes/',import.meta.url),{recursive:true});
  for (const scene of scenes) await writeFile(new URL(scene.path,import.meta.url),scene.svg);
  const manifest={schema:1,status:'style-proof-only',game:'darbe-h',palette:PALETTE,provenance:'Original code-drawn geometry. No external art, old art generator, fonts, filters, animation or visible SVG text.',width:240,height:160,totalBytes,sourceCardsSha256:createHash('sha256').update(source).digest('hex'),builtCardsSha256:createHash('sha256').update(JSON.stringify(scenes.map(scene=>scene.card))).digest('hex'),summary:{coverage:scenes.length,width:240,height:160,totalBytes,maxBytes:Math.max(...scenes.map(scene=>scene.bytes))},cards:Object.fromEntries(scenes.map(scene=>[scene.id,{bytes:scene.bytes,sha256:scene.sha256,concept:scene.concept,mechanic:scene.mechanic}])),scenes:scenes.map(({svg,...meta})=>meta)};
  await writeFile(new URL('./manifest.json',import.meta.url),JSON.stringify(manifest,null,2)+'\n');
  console.log(JSON.stringify({scenes:scenes.length,totalBytes,maxBytes:Math.max(...scenes.map(s=>s.bytes)),output:'outputs/darbe-art-v2/scenes'}));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await writeProof();
