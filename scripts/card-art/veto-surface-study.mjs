// Original SND-001 surface study. All geometry is authored here; no input image,
// downloaded mesh, font, reference-image sampling or random runtime work.
// Run: node scripts/card-art/veto-surface-study.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const out = fileURLToPath(new URL('../../outputs/card-realism/veto-surface-study/', import.meta.url));
const g = [], defs = [];
let state = 100137;
const rand = () => ((state = (Math.imul(state,1664525)+1013904223)>>>0) / 4294967296);
const n = v => Number(v.toFixed(2));
const path = (d, fill, attrs='') => g.push(`<path d="${d}" fill="${fill}" ${attrs}/>`);
const line = (d, c, w=1, opacity=1, attrs='') => path(d,'none',`stroke="${c}" stroke-width="${w}" opacity="${opacity}" stroke-linecap="round" ${attrs}`);
const ellipse = (x,y,rx,ry,fill,attrs='') => g.push(`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" ${attrs}/>`);
const grad = (id, stops, attrs='x1="0" y1="0" x2="1" y2="1"', radial=false) => defs.push(`<${radial?'radialGradient':'linearGradient'} id="${id}" ${attrs}>${stops.map(([at,c,o=1])=>`<stop offset="${at}" stop-color="${c}" stop-opacity="${o}"/>`).join('')}</${radial?'radialGradient':'linearGradient'}>`);
const stop = (...colors) => colors.map((c,i)=>[i/(colors.length-1),c]);
grad('wall',stop('#6c776c','#929987','#c5cbb1'),'x1="0" y1=".5" x2="1" y2=".2"');
grad('window',stop('#f3edcd','#dae8dc','#c2d4c9'),'x1="0" y1="0" x2="0" y2="1"');
grad('wood',stop('#b38a52','#906038','#764b2b'),'x1=".8" y1="0" x2=".2" y2="1"');
grad('paper',stop('#f3ebcf','#d7cdb0'),'x1="1" y1="0" x2="0" y2="1"');
grad('shirt',stop('#2b3e38','#5e7263','#acb2a0'),'x1=".05" y1=".8" x2=".98" y2=".1"');
grad('sleeve',stop('#3f5147','#8b9987','#c3c7af'),'x1="0" y1="1" x2=".9" y2="0"');
grad('neck',stop('#725039','#b58158','#e6ba89'),'x1="0" y1="1" x2="1" y2="0"');
grad('skin',stop('#6e4c38','#a47150','#c89569','#e3b98a'),'x1="0" y1=".65" x2="1" y2=".2"');
grad('forehead',[[0,'#eed1a6'],[.5,'#d7ad7d'],[1,'#a77950']],'cx=".8" cy=".15" r=".95"',true);
grad('cheek',[[0,'#e4b287'],[.35,'#d3a077'],[.75,'#ac7656'],[1,'#926344']],'cx=".65" cy=".3" r=".76"',true);
grad('nose',stop('#966146','#d6a276','#f0c695'),'x1="0" y1=".6" x2="1" y2=".2"');
grad('chin',stop('#9c6d4e','#cf9c75','#e2b58a'),'x1="0" y1="1" x2=".9" y2="0"');
grad('hand',stop('#92613f','#bf8a5e','#e8bd89'),'x1=".1" y1="1" x2=".6" y2="0"');
grad('hair',stop('#4b4b3d','#666452','#aaa486'),'x1="0" y1=".8" x2="1" y2="0"');
grad('glass',[[0,'#dce8dc',.19],[.36,'#e7ecd6',.04],[.8,'#f5f5dc',.13],[1,'#c6dbd1',.25]],'x1="0" y1="1" x2="1" y2="0"');
grad('edgeLight',[[0,'#fcf5d5',.65],[1,'#d4e0ca',.04]],'x1="1" y1="0" x2="0" y2="1"');
grad('vignette',[[.25,'#23382d',0],[1,'#1d2b25',.42]],'cx=".59" cy=".44" r=".76"',true);
defs.push('<filter id="blur"><feGaussianBlur stdDeviation="2.4"/></filter><filter id="contact"><feGaussianBlur stdDeviation=".7"/></filter>');
defs.push('<clipPath id="desk"><path d="M0 286L354 209 576 264V384H0Z"/></clipPath>');
defs.push('<clipPath id="head"><path d="M167 81C183 55 218 53 237 75C247 84 253 101 249 119L260 134 268 139Q273 144 264 147L258 149Q261 156 258 160Q264 164 260 171C260 178 252 188 239 191L217 208 182 191 172 161C163 156 159 145 163 133L157 109Z"/></clipPath>');
defs.push('<clipPath id="body"><path d="M136 190C116 195 80 201 55 226C28 250 3 293-20 333L-9 408 334 403 339 318C317 291 297 265 280 239L238 215 212 197Z"/></clipPath>');
// Room: receding glazed window and anonymized voting booth; no flags/signs.
path('M0 0H576V384H0Z','url(#wall)');
path('M337 0H576V237L339 204Z','#abb29e');
path('M395 0H576V196L397 175Z','#8e9c8b');
path('M405 0H576V180L406 160Z','url(#window)');
path('M472 0H480V170L471 169Z','#edeacf');
path('M407 67L576 76V83L407 73Z','#e9ead4');
path('M399 169L576 190V200L395 180Z','#e8e7c9');
path('M395 180L576 200V206L392 184Z','#626f60');
path('M342 0L348 212 336 209 332 0Z','#b7bcaa');
path('M316 203L396 176 576 206V253L418 280Z','#f8edb9','opacity=".14"');
path('M15 42L113 46 116 219 20 238Z','#66684e');
path('M24 48L103 53 106 211 28 227Z','#868069');
line('M34 51L38 222M54 52L59 217M80 54L84 214','#3f503e',1,.23);
// A dark wood chair is part of the room, not a silhouette symbol.
path('M270 179L313 181 317 240 279 236Z','#414b3d');
path('M279 187L306 189 308 214 283 212Z','#736e51');
line('M278 240L277 267M312 242L323 265','#494733',4);
path('M0 286L354 209 576 264V384H0Z','url(#wood)');
g.push('<g clip-path="url(#desk)">');
for(let i=0;i<51;i++){const y=211+i*3.8;line(`M-30 ${n(y+92)}C142 ${n(y+30)} 371 ${n(y-22)} 633 ${n(y+71)}`,i%3?'#edc78d':'#493320',n(.25+rand()*.6),n(.1+rand()*.1));}
line('M48 384L375 216M366 384L489 245','#57371f',1,.5);
g.push('</g>');
// Ballot receptacle: empty generic transparent container; blank envelopes only.
path('M422 252L440 271 561 293 576 276 477 246Z','#322f24','opacity=".26" filter="url(#blur)"');
path('M427 152L488 140 559 159 497 174Z','#c3cbc0','opacity=".72"');
path('M427 152L497 174V274L429 252Z','url(#glass)','stroke="#d9dec8" stroke-width="1"');
path('M497 174L559 159 558 254 497 274Z','url(#glass)','stroke="#ecedd3" stroke-width="1"');
path('M454 157L489 151 511 157 477 164Z','#344b3d');
path('M455 157L487 153 507 158 477 162Z','#738579');
g.push('<g opacity=".75">');
for(const [d,c] of [ ['M436 241L469 222 489 243 462 253Z','#eee5c7'],['M483 247L518 221 541 243 517 263Z','#ddd5b6'],['M453 248L478 225 500 252 476 264Z','#f4ebcf'],['M515 246L549 230 544 253 522 263Z','#cac7ad']])path(d,c);
line('M437 241L460 242 469 222M483 247L512 248 518 221M453 248L478 249 478 225','#9a9a81',.65,.8);
g.push('</g>');
line('M431 155L433 246M501 179V267M553 165L552 249','#f2f3de',1.4,.69);
path('M508 179L521 175 519 245 507 251Z','#ecf1dc','opacity=".08"');
line('M429 150L490 137 563 157M428 155L497 177 561 162','#f6f2d6',1.1,.83);
// Contact shadow under torso/working arm.
path('M33 320C134 280 275 265 363 290 413 306 402 331 304 356L72 384Z','#29332a','opacity=".45" filter="url(#blur)"');
// Linen shirt: connected shoulder/chest, visible tension and compression folds.
path('M136 190C116 195 80 201 55 226C28 250 3 293-20 333L-9 408 334 403 339 318C317 291 297 265 280 239L238 215 212 197Z','url(#shirt)');
path('M178 173L178 202 151 211 204 252 243 221 220 187Z','url(#neck)');
path('M183 183C194 199 211 204 226 192L219 211 201 224 181 202Z','#653e2e','opacity=".35" filter="url(#blur)"');
path('M146 196L174 198 204 234 218 218 233 207 253 224 229 264 204 244 188 266 134 215Z','#273e34');
path('M148 194L173 201 204 236 186 261 141 216 131 211Z','url(#sleeve)');
path('M222 207L236 211 250 226 230 259 207 236Z','#b0bba4');
line('M142 211L184 254M236 217L229 249','#d5d5ba',.65,.65);
path('M204 242L210 308 214 390 226 393 219 304 216 246Z','#42594a');
line('M212 252L218 381','#b5bda5',1,.56);
for(const [x,y]of [[216,275],[219,317],[223,365]]){ellipse(x,y,2,2.1,'#c9c7aa');ellipse(x+.2,y,.45,.5,'#5e6c58');}
g.push('<g clip-path="url(#body)">');
path('M46 270C76 247 99 238 117 247L69 273 59 294 32 348 12 360Z','#152f28','opacity=".3"');
path('M103 230C125 225 148 236 164 262L179 301 167 286 144 251Z','#d1d0b4','opacity=".14"');
path('M93 272C125 280 149 308 171 345L146 323 127 302 86 294Z','#d0cab0','opacity=".13"');
path('M178 272C162 296 152 308 151 343L140 363 134 385 146 384 164 338Z','#213f34','opacity=".4"');
path('M257 245C275 260 285 273 296 302L266 281 266 292 243 277Z','#e0d9b9','opacity=".12"');
for(let i=0;i<47;i++){const x=20+rand()*290,y=220+rand()*168;line(`M${n(x)} ${n(y)}l${n(5+rand()*13)} ${n(-.7+rand()*1.4)}`,'#ccd0b9',.25,.08);}
g.push('</g>');
// Face: mature side profile. One near eye; occluded far eye isn't invented.
path('M167 81C183 55 218 53 237 75C247 84 253 101 249 119L260 134 268 139Q273 144 264 147L258 149Q261 156 258 160Q264 164 260 171C260 178 252 188 239 191L217 208 182 191 172 161C163 156 159 145 163 133L157 109Z','url(#skin)');
g.push('<g clip-path="url(#head)">');
path('M195 75C211 61 235 76 243 91L249 114 237 123 214 116 207 93Z','url(#forehead)');
path('M196 118C208 111 230 117 244 132L250 155 237 176 213 181 197 163Z','url(#cheek)');
path('M174 105C182 119 196 132 204 154L201 178 217 195 209 207 184 190 172 160Z','#6c4535','opacity=".27" filter="url(#blur)"');
path('M217 153C227 160 235 164 244 163L257 168 254 179 239 189 221 186 209 178Z','url(#chin)');
path('M236 120C242 124 248 129 253 138L267 140 267 144 257 147 248 143 244 135 236 130Z','url(#nose)');
path('M221 151C231 145 237 137 241 128L242 143 249 154 241 163Z','#f1c296','opacity=".14" filter="url(#contact)"');
path('M225 162C239 159 246 157 253 159L259 164 248 166 240 163Z','#825241','opacity=".65"');
path('M235 169C243 171 249 170 255 168L253 172 245 175 237 173Z','#e8b18b','opacity=".65"');
line('M238 165Q248 167 257 163','#644331',.95,.87);
line('M242 168Q249 169 254 167','#e0ab86',.75,.62);
path('M247 146Q253 150 257 146Q253 142 250 144Z','#684834');
line('M232 146C234 151 238 155 240 158','#956044',1,.5);
line('M233 147C232 153 235 157 238 160','#f0bc90',.7,.35);
// Eye is compressed naturally by downward gaze; reflected light is subtle.
path('M219 123Q231 118 242 126L238 130 226 130Z','#8d6548');
path('M222 125Q231 122 240 127Q231 132 222 125Z','#c9b899');
ellipse(233.4,126.4,2.5,2,'#665e45');
ellipse(234,127,1.25,1.4,'#35392d');
line('M221 124Q231 121 241 127','#443e2d',1.05,.95);
line('M223 130Q232 134 239 131','#b18460',1,.76);
ellipse(234.5,125.4,.52,.44,'#ddd9b4');
path('M215 117C225 112 236 115 244 121L242 123C232 119 224 118 217 121Z','#70634c');
line('M219 117L224 117M227 117L232 119M234 119L239 121','#b0a17c',.5,.55);
// Anatomical plane and age detail, subordinated to the larger form.
line('M203 99Q220 96 236 103M203 103Q219 101 233 106','#a47a54',.5,.6);
line('M208 97Q221 96 233 102','#eed0a2',.65,.37);
line('M208 119L216 123M209 123L217 126M209 128L216 129','#9d6e51',.6,.4);
line('M221 133Q229 137 237 134M220 135Q228 140 235 139','#987052',.6,.5);
line('M211 160Q215 173 225 179M213 180Q224 189 235 187','#8b5c44',.7,.4);
for(let i=0;i<130;i++){const x=198+rand()*48,y=101+rand()*83;ellipse(n(x),n(y),n(.12+rand()*.25),n(.12+rand()*.25),i%3?'#553e2e':'#f5ce9f',`opacity="${n(.08+rand()*.08)}"`);}
g.push('</g>');
// Ear is modeled within hairline, not a symbol pasted onto the face.
path('M175 125C166 121 162 129 165 140L168 153C171 162 179 161 182 154L181 132Z','url(#skin)');
path('M174 130C168 128 167 136 171 143L174 145 172 151 176 156 179 150 175 141 177 134Z','#81533c');
line('M173 130Q168 129 168 136L171 142M175 145L175 151','#d1a279',.85,.8);
// Hairline has volume, directional fibres, visible receding forehead.
path('M163 128C151 112 155 91 164 78 174 61 192 50 211 55 224 53 238 64 243 77L235 78 225 70 213 71 206 78 194 82 186 98 184 117 179 129 177 137 170 133Z','url(#hair)');
path('M164 116C156 94 173 66 195 59L212 59 194 65 183 81 178 106 173 128Z','#d1c2a0','opacity=".16"');
for(let i=0;i<90;i++){const t=i/89,x=158+t*77,y=105-45*Math.sin(t*Math.PI*.94);line(`M${n(x)} ${n(y)}q${n(-4-rand()*4)} ${n(-4-rand()*5)} ${n(1+rand()*6)} ${n(-8-rand()*5)}`,i%4===0?'#d8ccb0':i%3===0?'#454a3b':'#a59d7f',n(.25+rand()*.5),n(.2+rand()*.36));}
for(let i=0;i<15;i++){const x=178+rand()*8,y=104+rand()*27;line(`M${n(x)} ${n(y)}l${n(-1-rand()*2)} ${n(4+rand()*4)}`,'#a5a083',.4,.5);}
// Far arm rests on desk; near sleeve points toward one precise paper grip.
path('M254 242C282 249 300 261 316 275L339 286 325 311C301 302 278 291 263 282L239 263Z','url(#sleeve)');
path('M77 235C111 223 137 248 147 272 158 289 198 304 231 304L242 331C207 349 162 339 135 322 112 307 90 286 79 270Z','url(#sleeve)');
path('M80 257C108 285 122 305 143 315 165 328 198 333 234 321L238 329C210 343 173 336 148 325 117 309 92 288 81 275Z','#30483b','opacity=".35"');
line('M92 246Q119 246 130 270M95 254Q113 266 121 285M115 292Q132 284 145 287M140 307Q154 301 169 306M184 321L217 319','#d3d4b9',1,.38);
line('M104 252Q125 263 130 275M124 293L140 297M151 315L171 319','#3a5545',1,.45);
path('M225 301L244 305 251 326 237 335 228 331Z','#c6c9ae');
line('M230 304L242 328','#6b7e65',.9,.66);
// Desk paper geometry: varied edge warps rather than repeated square icons.
path('M254 324L348 299 420 324 324 354Z','#312e23','opacity=".3" filter="url(#contact)"');
for(let i=12;i>=0;i--){const z=i*.62;path(`M267 ${n(304+z)}L345 ${n(284+z)} 400 ${n(304+z)} 322 ${n(329+z)}Z`,i%3?'#d9d0b0':'#ede4c5',`stroke="#a49d80" stroke-width=".35"`);}
line('M268 305L322 314 344 284','#b3aa8d',.75,.7);
// Stabilising hand (partial fingers occluded by paper, not extra visible digits).
path('M244 307C255 305 264 300 272 302L288 304 307 300C313 300 315 303 311 306L298 311 312 309C318 309 320 313 314 316L301 320 311 319C316 320 316 324 311 326L296 331 280 333 268 329 253 328 247 325Z','url(#hand)');
line('M279 309L297 308M283 317L299 313M283 323L299 319M280 329L293 325','#87583e',.65,.57);
path('M255 310C263 305 271 305 278 307L293 312C297 315 295 318 291 318L277 314 267 318 257 319Z','#d8aa79');
line('M275 309L283 312M286 313L291 315','#ecc497',.7,.8);
// Raised blank envelope and the working hand support each other physically.
path('M324 272L388 238 425 274 357 312Z','url(#paper)','stroke="#a79e80" stroke-width=".6"');
path('M324 272L369 279 388 238Z','#ede3c6');
line('M326 274L369 280 422 274','#b9ae8c',.7,.8);
line('M359 309L369 280','#d1c5a4',.7,.6);
path('M333 286C340 278 345 265 350 260L356 256C360 254 363 256 361 260L355 271 361 267 366 257C369 252 373 254 372 258L367 271 373 269 379 260C382 257 385 259 383 263L378 273 383 273 389 267C392 265 394 268 391 271L384 280 373 287 357 299 347 304 336 303 326 300Z','url(#hand)');
path('M336 291C341 284 347 282 353 284L366 286C371 287 371 291 367 292L356 292 348 299 338 302Z','#d2a474');
line('M348 271L353 277M360 271L364 278M369 274L372 280M378 277L380 280','#8e6344',.65,.7);
line('M350 265L354 260M367 260L366 264M379 263L377 267','#efc79a',.8,.65);
line('M340 287Q344 284 348 285M337 292Q341 289 345 291','#9b6c4b',.5,.7);
// Foreground bound ledger and a pen carry use marks, no fake text.
path('M360 376L477 315 576 341V384H384Z','#263e34');
path('M376 374L480 322 576 348V384H393Z','#ddd3b5');
line('M388 374L483 327 570 349M398 380L488 336M420 376L481 345','#b4ae92',.55,.5);
path('M444 352L507 329 511 332 448 356Z','#273b32');
line('M445 352L506 329','#b6bdab',.8,.7);
path('M511 329L519 327 513 333 508 332Z','#d5d5bd');
// Single window-source edge light and a restrained optical vignette.
path('M0 0H576V384H0Z','url(#vignette)');
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="576" height="384" viewBox="0 0 576 384"><defs>${defs.join('')}</defs>${g.join('')}</svg>\n`;
mkdirSync(out,{recursive:true});
writeFileSync(`${out}SND-001-study.svg`,svg);
writeFileSync(`${out}provenance.json`,JSON.stringify({id:'SND-001',title:'Sandık Görevlisi',status:'REJECTED_FOR_PRODUCTION',artAccepted:false,production:false,method:'Original authored SVG contours, material gradients and seeded surface marks',source:'scripts/card-art/veto-surface-study.mjs',referenceUse:'Quality direction only; reference pixels are neither sampled nor embedded',externalAssets:[],width:576,height:384,bytes:Buffer.byteLength(svg),sha256:createHash('sha256').update(svg).digest('hex'),seed:100137,light:'One large daylight opening at upper right; room bounce only',composition:'Older fictional adult in side profile on left, sorting blank envelopes diagonally across tabletop; transparent receptacle rear right',protectedScope:'No gameplay, card metadata, frame, runtime or public asset changes',rejection:['Facial planes remain stylized instead of realistic','Clothing folds and boundaries have hard vector edges','Raised fingers read as a stiff spread instead of a credible paper grip','Material appearance lacks photographic microstructure and light transport'],rolloutEligible:false},null,2)+'\n');
console.log(JSON.stringify({file:`${out}SND-001-study.svg`,bytes:Buffer.byteLength(svg)}));
