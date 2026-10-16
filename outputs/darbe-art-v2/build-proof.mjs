// Proof-only build. Reads production definitions/rendering; writes this folder's two HTML viewers.
import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {buildCards} from '../../public/games/duel-core/card-data.js';
import {labels} from '../../public/games/duel-core/labels.js';
import {themeMeta} from '../../public/games/duel-core/theme-meta.js';
import {designs} from '../../public/games/darbe-h/designs.js';
import {cardFace} from '../../public/games/darbe-h/card-face.js';
import {SCENES, renderScene} from './proof-art.mjs';

const here = new URL('./', import.meta.url);
const root = new URL('../../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const esc = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const hash = value => createHash('sha256').update(value).digest('hex');
const svgURL = markup => 'data:image/svg+xml;base64,' + Buffer.from(markup).toString('base64');
const sourceText = await read('public/games/darbe-h/source-cards.json');
const faceCSS = await read('public/games/darbe-h/card-face.css');
const designCSS = await read('public/games/duel-core/design.css');
const tableCSS = await read('public/games/duel-core/table.css');
const palette = designCSS.match(/body\[data-theme="darbe-h"\]\s*\{[\s\S]*?\n\}/)?.[0];
const ratio = tableCSS.match(/--card-ratio:\s*59\s*\/\s*86\s*;/)?.[0];
if (!palette || !ratio) throw Error('Production DARBE palette/card ratio not found; do not silently substitute styling.');
const cards = buildCards(JSON.parse(sourceText), designs, 'darbe-h');
const byID = new Map(cards.map(card => [card.id, card]));
if (SCENES.length !== 10 || new Set(SCENES.map(scene => scene.id)).size !== 10) throw Error('Proof requires exactly ten distinct finished scenes.');
const themeLabels = themeMeta('darbe-h').labels.tr;
const t = key => typeof key === 'string' ? themeLabels[key] || labels.tr[key] || key : '';
const text = value => typeof value === 'string' ? value : value?.tr || '';

// Minimal build-time DOM serializer, not an alternate card renderer. The actual
// cardFace function constructs every inner node/label/stat; only its final art URL is substituted.
class ProofNode {
  constructor(tag = null, content = '') { this.tag = tag; this.content = content; this.children = []; this.attributes = new Map(); }
  append(...children) { this.children.push(...children); }
  setAttribute(key, value) { this.attributes.set(key, String(value)); }
  get lastChild() { return this.children.at(-1); }
  addEventListener() {} // cardFace's image-load recovery is irrelevant after embedding verified SVG bytes.
}
function serialize(node, art) {
  if (!(node instanceof ProofNode)) return esc(node);
  if (!node.tag) return esc(node.content);
  const attrs = new Map(node.attributes);
  if (node.className) attrs.set('class', node.className);
  for (const key of ['src', 'alt', 'width', 'height', 'loading', 'decoding']) if (node[key] != null) attrs.set(key, node[key]);
  if (node.tag === 'img') attrs.set('src', art);
  const open = '<' + node.tag + [...attrs].map(([key,value]) => ' ' + key + '="' + esc(value) + '"').join('') + '>';
  if (node.tag === 'img') return open;
  return open + (node.innerHTML || '') + node.children.map(child => serialize(child, art)).join('') + '</' + node.tag + '>';
}
function face(card, art) {
  const prior = {document: globalThis.document, Node: globalThis.Node};
  try {
    globalThis.Node = ProofNode;
    globalThis.document = {createElement: tag => new ProofNode(tag), createTextNode: content => new ProofNode(null, content)};
    const inner = cardFace({card, down: false, hidden: false, lang: 'tr', t, text}).map(node => serialize(node, art)).join('');
    return '<article class="playing-card" data-kind="' + esc(card.kind) + '" aria-label="' + esc(text(card.name)) + '">' + inner + '</article>';
  } finally {
    for (const [key,value] of Object.entries(prior)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
  }
}
function verifySVG(markup, id, version) {
  if (typeof markup !== 'string' || !/<svg\b/.test(markup) || !/viewBox=["']0 0 240 160["']/.test(markup)) throw Error(`${id} ${version}: expected a complete 240×160 SVG scene.`);
  if (/<(?:script|foreignObject|animate|animateTransform|set|image)\b|\bon\w+\s*=|(?:href|src)\s*=|url\(\s*["']?(?!#)/i.test(markup)) throw Error(`${id} ${version}: only self-contained static SVG drawing is allowed.`);
}
const entries = [];
for (const scene of SCENES) {
  const card = byID.get(scene.id);
  if (!card) throw Error('Unknown source card ' + scene.id);
  for (const key of ['title','concept','mechanic']) if (typeof scene[key] !== 'string' || !scene[key].trim()) throw Error(`${scene.id}: missing ${key}.`);
  const before = await read(`public/games/darbe-h/assets/card-art/${scene.id}.svg`);
  const after = renderScene(scene.id);
  verifySVG(before, scene.id, 'original'); verifySVG(after, scene.id, 'new');
  if (before === after) throw Error(scene.id + ': a new scene is required, not a placeholder.');
  const illustration = (variant, markup) => {
    const art = svgURL(markup), label = variant === 'new' ? 'Yeni çizim' : 'Mevcut çizim';
    return `<figure class="proof-variant" data-variant="${variant}"${variant === 'old' ? ' hidden' : ''}><figcaption>${label}</figcaption><div class="proof-visuals"><div class="proof-face">${face(card, art)}</div><div class="proof-scene"><img src="${art}" width="240" height="160" alt="${esc(label + ' · ' + text(card.name))}" decoding="async"><p>240 × 160 · tam sahne</p></div></div></figure>`;
  };
  const rules = text(card.text);
  const rulesNote = card.rulesNote ? `<p class="proof-rule-note">${esc(text(card.rulesNote))}</p>` : '';
  entries.push(`<article class="proof-entry" id="${scene.id}" data-proof-card="${scene.id}" aria-labelledby="title-${scene.id}"><header class="proof-card-heading"><p class="proof-id">${scene.id} · ${esc(t(card.subtype === 'fusion' ? 'fusion' : card.kind))}</p><h2 id="title-${scene.id}">${esc(text(card.name))}</h2></header><div class="proof-comparisons">${illustration('old',before)}${illustration('new',after)}</div><section class="proof-rules" aria-labelledby="rules-${scene.id}"><h3 id="rules-${scene.id}">Kartın tam metni</h3><p data-card-rules="${scene.id}">${esc(rules)}</p>${rulesNote}</section><dl class="proof-notes"><div><dt>Sahne</dt><dd>${esc(scene.title)}</dd></div><div><dt>Görsel fikir</dt><dd>${esc(scene.concept)}</dd></div><div><dt>Mekanik bağlantı</dt><dd>${esc(scene.mechanic)}</dd></div></dl></article>`);
}

const galleryCSS = `
:root{color-scheme:dark;${ratio}font-family:system-ui,-apple-system,"Segoe UI",sans-serif;font-size:16px;line-height:1.5}
${palette}
*{box-sizing:border-box}body{margin:0;background:var(--background);color:var(--foreground)}[hidden]{display:none!important}button{font:inherit;min-height:44px;min-width:44px;cursor:pointer}button:focus-visible{outline:3px solid var(--paper);outline-offset:3px}
.proof-header,.proof-main{max-width:1440px;margin:auto;padding:24px}.proof-header{border-bottom:1px solid var(--frame-edge)}.proof-kicker,.proof-id{color:var(--brass);letter-spacing:.1em;font-size:12px;font-weight:700}.proof-header h1{font:700 clamp(27px,3vw,42px)/1.15 Georgia,serif;margin:8px 0 12px}.proof-intro{max-width:850px;color:var(--foreground);margin:0}.proof-context{font-size:13px;color:var(--muted);margin:10px 0 0}.proof-toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:20px}.proof-toolbar span{font-size:13px;color:var(--muted);margin-right:8px}.proof-toggle{border:1px solid var(--frame-edge);border-radius:4px;background:var(--surface);color:var(--foreground);padding:8px 14px}.proof-toggle[aria-pressed=true]{background:var(--paper);color:var(--ink);border-color:var(--paper)}
.proof-gallery{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}.proof-entry{min-width:0;border:1px solid var(--frame-edge);border-radius:8px;padding:20px;background:var(--surface)}.proof-card-heading{margin-bottom:18px}.proof-id{margin:0 0 5px}.proof-card-heading h2{font:700 24px/1.2 Georgia,serif;margin:0;overflow-wrap:anywhere}.proof-comparisons{display:grid;grid-template-columns:minmax(0,1fr);gap:20px}.proof-variant{margin:0;min-width:0}.proof-variant figcaption{font-size:13px;color:var(--muted);margin-bottom:10px}.proof-visuals{display:grid;grid-template-columns:minmax(0,177px) minmax(0,1fr);gap:24px;align-items:center}.proof-face{width:177px;max-width:100%;justify-self:center}.proof-face .playing-card{width:100%;aspect-ratio:var(--card-ratio);margin:0;min-height:0}.proof-scene{min-width:0;text-align:center}.proof-scene img{display:block;width:240px;max-width:100%;height:auto;aspect-ratio:3/2;margin:auto;border:1px solid var(--frame-edge)}.proof-scene p{font-size:12px;color:var(--muted);margin:8px 0 0}.proof-rules{margin-top:20px;padding-top:16px;border-top:1px solid var(--line)}.proof-rules h3{font-size:13px;margin:0 0 6px;color:var(--brass)}.proof-rules p{font-size:15px;line-height:1.55;margin:0;white-space:pre-wrap;overflow-wrap:anywhere;max-height:none;overflow:visible}.proof-rules .proof-rule-note{margin-top:8px;color:var(--muted)}.proof-notes{font-size:13px;margin:18px 0 0;display:grid;gap:8px}.proof-notes div{display:grid;grid-template-columns:106px minmax(0,1fr);gap:10px}.proof-notes dt{color:var(--muted)}.proof-notes dd{margin:0;overflow-wrap:anywhere}.proof-footer{max-width:1440px;margin:auto;padding:0 24px 28px;color:var(--muted);font-size:12px}
body[data-proof-mode=both] .proof-comparisons{grid-template-columns:repeat(2,minmax(0,1fr))}body[data-proof-mode=both] .proof-visuals{grid-template-columns:minmax(0,1fr);gap:14px}
@media(max-width:1050px){.proof-gallery{grid-template-columns:minmax(0,1fr)}}
@media(max-width:560px){.proof-header,.proof-main{padding:16px 12px}.proof-entry{padding:14px}.proof-gallery{gap:16px}.proof-visuals{grid-template-columns:minmax(0,1fr);gap:14px}.proof-card-heading h2{font-size:22px}.proof-notes div{grid-template-columns:minmax(0,1fr);gap:2px}.proof-notes dt{font-weight:600}.proof-toolbar{gap:6px}.proof-toolbar span{width:100%}body[data-proof-mode=both] .proof-comparisons{grid-template-columns:minmax(0,1fr);gap:24px}.proof-footer{padding:0 12px 20px}}
`;
// The original face stylesheet remains intact below. Proof-only overrides remove
// interactive movement on static figures; no new face skin or gameplay CSS is substituted.
const staticFaceCSS = `body[data-theme="darbe-h"] .proof-face .playing-card{transition:none!important;animation:none!important;transform:none!important;pointer-events:none}body[data-theme="darbe-h"] .proof-face .playing-card:hover{border-color:var(--frame-edge);box-shadow:inset 0 3px 0 var(--dh-kind),inset 0 0 0 1px #c4a57426,0 4px 8px #0009}`;
const index = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>DARBE-H! · 10 kart görsel incelemesi</title><style>${galleryCSS}</style><style data-original-card-face-css="${hash(faceCSS)}">${faceCSS}</style><style>${staticFaceCSS}</style></head><body data-theme="darbe-h" data-proof-mode="new"><header class="proof-header"><p class="proof-kicker">DARBE-H! · GÖRSEL İNCELEME · 10 KART</p><h1>Kartların içindeki sahne</h1><p class="proof-intro">Yeni çizimleri mevcut kart yüzünün içinde ve 240 × 160 tam sahnede karşılaştırın. Kart adları, sayılar ve kart metinleri mevcut tanımlardan gelir.</p><p class="proof-context">Bu dosya bir görsel öneri incelemesidir. Düello başlatmaz, kayıt oluşturmaz ve oyunun çevrimdışı çalıştığını doğrulamaz.</p><div class="proof-toolbar" role="group" aria-label="Çizim karşılaştırması"><span>Görünüm</span><button type="button" class="proof-toggle" data-proof-view="new" aria-pressed="true">Yeni çizim</button><button type="button" class="proof-toggle" data-proof-view="old" aria-pressed="false">Mevcut çizim</button><button type="button" class="proof-toggle" data-proof-view="both" aria-pressed="false">Yan yana</button></div><p id="proof-status" class="proof-context" role="status" aria-live="polite">10 yeni çizim gösteriliyor.</p></header><main class="proof-main"><div class="proof-gallery">${entries.join('\n')}</div></main><footer class="proof-footer">Statik figürler · mevcut 59/86 kart oranı ve DARBE-H! kart yüzü · ses, ağ isteği veya kayıt işlemi yok</footer><script>document.querySelectorAll('[data-proof-view]').forEach(function(button){button.addEventListener('click',function(){var mode=button.dataset.proofView;document.body.dataset.proofMode=mode;document.querySelectorAll('[data-proof-view]').forEach(function(item){item.setAttribute('aria-pressed',String(item===button));});document.querySelectorAll('[data-variant]').forEach(function(figure){figure.hidden=mode!=='both'&&figure.dataset.variant!==mode;});document.getElementById('proof-status').textContent=mode==='both'?'10 kartın mevcut ve yeni çizimleri gösteriliyor.':mode==='new'?'10 yeni çizim gösteriliyor.':'10 mevcut çizim gösteriliyor.';});});</script></body></html>`;

// JSON escaping keeps the nested HTML/scripts inert until assigned to srcdoc.
const srcdoc = JSON.stringify(index).replaceAll('<','\\u003c').replaceAll('\u2028','\\u2028').replaceAll('\u2029','\\u2029');
const review = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-src 'self' data: blob:; base-uri 'none'; form-action 'none'"><title>DARBE-H! · CSS genişlik incelemesi</title><style>*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:#121820;color:#e8dcc4;font:14px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}.review-header{padding:16px 20px;border-bottom:1px solid #8a6a3a;background:#1a2433}.review-header h1{font:700 23px/1.2 Georgia,serif;margin:0 0 8px}.review-header p{margin:6px 0;color:#b7c0c9}.review-controls{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.review-controls button{font:inherit;cursor:pointer;min-width:72px;min-height:44px;padding:8px 14px;border:1px solid #8a6a3a;border-radius:4px;background:#243044;color:#e8dcc4}.review-controls button[aria-pressed=true]{background:#d8dde4;color:#121820;border-color:#d8dde4}.review-controls button:focus-visible{outline:3px solid #e8dcc4;outline-offset:3px}#review-status{font-variant-numeric:tabular-nums;color:#e8dcc4}.review-stage{padding:16px 10px;overflow:hidden}.review-frame-shell{position:relative;margin:auto;background:#121820;outline:1px solid #8a6a3a}iframe{display:block;position:absolute;left:0;top:0;border:0;transform-origin:top left;background:#121820}@media(max-width:390px){.review-header{padding:12px}.review-header h1{font-size:20px}.review-stage{padding:12px 0}}</style></head><body><header class="review-header"><h1>DARBE-H! · genişlik incelemesi</h1><p>Düğmeler iç sayfanın CSS viewport genişliğini ayarlar. Bu, cihaz emülasyonu değildir. Geniş görünüm pencereye sığacak ölçekte gösterilir.</p><div class="review-controls" role="group" aria-label="İç sayfa CSS genişliği"><button type="button" data-width="320" aria-pressed="false">320 px</button><button type="button" data-width="390" aria-pressed="false">390 px</button><button type="button" data-width="1440" aria-pressed="true">1440 px</button></div><p id="review-status" role="status" aria-live="polite"></p></header><main class="review-stage"><div class="review-frame-shell"><iframe id="review-frame" title="10 kartlık DARBE-H! görsel incelemesi" sandbox="allow-scripts"></iframe></div></main><script>var source=${srcdoc};var frame=document.getElementById('review-frame'),shell=document.querySelector('.review-frame-shell'),stage=document.querySelector('.review-stage'),width=1440;frame.srcdoc=source;function fit(){var available=Math.max(1,stage.clientWidth-20),scale=Math.min(1,available/width),height=Math.max(420,window.innerHeight-document.querySelector('.review-header').getBoundingClientRect().height-34);frame.style.width=width+'px';frame.style.height=Math.ceil(height/scale)+'px';frame.style.transform='scale('+scale+')';shell.style.width=(width*scale)+'px';shell.style.height=height+'px';document.getElementById('review-status').textContent='İç CSS viewport: '+width+' px · önizleme ölçeği: %'+Math.round(scale*100)+(width===1440?' · tam masaüstü yerleşimi':'');}document.querySelectorAll('[data-width]').forEach(function(button){button.addEventListener('click',function(){width=Number(button.dataset.width);document.querySelectorAll('[data-width]').forEach(function(item){item.setAttribute('aria-pressed',String(item===button));});fit();});});window.addEventListener('resize',fit);fit();</script></body></html>`;
await writeFile(new URL('index.html',here),index);
await writeFile(new URL('review.html',here),review);
console.log(JSON.stringify({cards:SCENES.map(scene=>scene.id),index:fileURLToPath(new URL('index.html',here)),review:fileURLToPath(new URL('review.html',here)),bytes:{index:Buffer.byteLength(index),review:Buffer.byteLength(review)},sourceHash:hash(sourceText),cardFaceCSSHash:hash(faceCSS),scope:'Static art comparison only; no duel/save/offline-product acceptance.'},null,2));
