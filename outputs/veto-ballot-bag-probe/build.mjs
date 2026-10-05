import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
const root=new URL('../../',import.meta.url),dir=new URL('./',import.meta.url);
const source=readFileSync(new URL('public/games/veto-h/source-cards.json',root));
const hash=x=>createHash('sha256').update(x).digest('hex');
assert.equal(hash(source),'b876fdb69eeb4ddcfd1d06e397df14e14070cf3131ad4d210b4608e8fe7b4acd');
const card=JSON.parse(source).find(c=>c.id==='SND-011');
assert.equal(card.name,'Sandık Çantası');
assert.equal(card.text,'Savaşta yok olmaz. Her Hazırlık Aşaması’nda OP −200.');
let seed=110011;
const rnd=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
const n=x=>Number(x.toFixed(2));
const p=(d,f,e='')=>`<path d="${d}" fill="${f}" ${e}/>`;
const l=(d,c,w=1,o=1,e='')=>p(d,'none',`stroke="${c}" stroke-width="${w}" opacity="${o}" stroke-linecap="round" stroke-linejoin="round" ${e}`);
const el=(x,y,rx,ry,c,e='')=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${c}" ${e}/>`;
const front='M390 361C438 344 528 346 603 348L930 374C952 435 970 519 974 602L964 712C884 744 781 750 656 740L419 710C400 655 389 589 389 500Z';
const side='M930 374L1071 310C1093 348 1107 415 1106 498L1096 625C1061 665 1017 694 964 712L972 584C965 490 951 419 930 374Z';
const a=[];
a.push(`<svg xmlns="http://www.w3.org/2000/svg" width="576" height="384" viewBox="0 0 1440 960"><defs>
<linearGradient id="wall" x1="0" y1="0" x2="1" y2=".55"><stop stop-color="#f7eddb"/><stop offset=".55" stop-color="#c2b9a4"/><stop offset="1" stop-color="#6b7567"/></linearGradient>
<linearGradient id="floor" x1=".12" y1="0" x2=".8" y2="1"><stop stop-color="#aa8057"/><stop offset=".48" stop-color="#795a3f"/><stop offset="1" stop-color="#3e372d"/></linearGradient>
<linearGradient id="wood" x1="0" y1="0" x2=".9" y2="1"><stop stop-color="#dcc199"/><stop offset=".3" stop-color="#b68d5e"/><stop offset=".65" stop-color="#946740"/><stop offset="1" stop-color="#66432d"/></linearGradient>
<linearGradient id="edge" x2="0" y2="1"><stop stop-color="#916947"/><stop offset=".16" stop-color="#b28352"/><stop offset=".38" stop-color="#6d4a30"/><stop offset="1" stop-color="#352c23"/></linearGradient>
<linearGradient id="canvas" x1=".05" y1="0" x2=".88" y2=".95"><stop stop-color="#9ba185"/><stop offset=".16" stop-color="#7b876e"/><stop offset=".44" stop-color="#536953"/><stop offset=".75" stop-color="#3d5543"/><stop offset="1" stop-color="#263e34"/></linearGradient>
<linearGradient id="gusset" x1="0" y1=".25" x2=".9" y2=".6"><stop stop-color="#4b6250"/><stop offset=".45" stop-color="#3d5545"/><stop offset=".75" stop-color="#263f34"/><stop offset="1" stop-color="#172f28"/></linearGradient>
<linearGradient id="top" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#c0bea1"/><stop offset=".3" stop-color="#8f9979"/><stop offset="1" stop-color="#526b52"/></linearGradient>
<linearGradient id="fold" x1="0" y1="0" x2="1" y2=".4"><stop stop-color="#dde0b3" stop-opacity="0"/><stop offset=".4" stop-color="#bac69b" stop-opacity=".36"/><stop offset=".65" stop-color="#bbc79a" stop-opacity=".05"/><stop offset=".86" stop-color="#152d21" stop-opacity=".2"/><stop offset="1" stop-color="#152d21" stop-opacity="0"/></linearGradient>
<linearGradient id="leather" x1="0" y1="0" x2="1" y2=".2"><stop stop-color="#644c34"/><stop offset=".16" stop-color="#9c7951"/><stop offset=".36" stop-color="#795632"/><stop offset=".76" stop-color="#4a3525"/><stop offset="1" stop-color="#2c271e"/></linearGradient>
<linearGradient id="handle" x1="0" y1="0" x2=".4" y2="1"><stop stop-color="#b08c5c"/><stop offset=".22" stop-color="#7a5635"/><stop offset=".7" stop-color="#43301e"/><stop offset="1" stop-color="#261e17"/></linearGradient>
<linearGradient id="metal" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="#eee2b8"/><stop offset=".22" stop-color="#b8a882"/><stop offset=".42" stop-color="#656956"/><stop offset=".53" stop-color="#d2c39a"/><stop offset=".66" stop-color="#76745c"/><stop offset="1" stop-color="#414b3d"/></linearGradient>
<linearGradient id="paper" x1="0" y1="0" x2=".55" y2="1"><stop stop-color="#f8f0db"/><stop offset=".4" stop-color="#e0d8bd"/><stop offset="1" stop-color="#aaa88c"/></linearGradient>
<radialGradient id="faceLight" cx=".14" cy=".12" r=".88"><stop stop-color="#f0e3b4" stop-opacity=".28"/><stop offset=".6" stop-color="#e8dcba" stop-opacity="0"/><stop offset="1" stop-color="#001b13" stop-opacity=".12"/></radialGradient>
<radialGradient id="vignette" cx=".46" cy=".4" r=".75"><stop offset=".48" stop-color="#1a261b" stop-opacity="0"/><stop offset="1" stop-color="#142119" stop-opacity=".37"/></radialGradient>
<filter id="shadow" x="-.25" y="-.5" width="1.6" height="2"><feGaussianBlur stdDeviation="13"/></filter>
<filter id="soft" x="-.2" y="-.2" width="1.4" height="1.4"><feGaussianBlur stdDeviation="3"/></filter>
<filter id="background" x="-.1" y="-.1" width="1.2" height="1.2"><feGaussianBlur stdDeviation="1.3"/></filter>
<pattern id="weave" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M0 .6H5M.6 0V5" stroke="#ebe7c7" stroke-width=".6" opacity=".1"/><path d="M0 3H5M3 0V5" stroke="#132a1c" stroke-width=".55" opacity=".14"/><path d="M.8 1H2.4M3.2 3.3H4.6" stroke="#e7e2bf" stroke-width=".65" opacity=".13"/></pattern>
<pattern id="leatherPore" width="13" height="9" patternUnits="userSpaceOnUse"><path d="M1 2l1 .1M7 6l1.5-.3M10 1l.6 .5M3 7l.6.2" stroke="#e1be80" stroke-width=".7" opacity=".18"/><path d="M4 3l1.2-.3M11 7l.9.4" stroke="#1b2018" stroke-width=".8" opacity=".2"/></pattern>
<clipPath id="frontClip"><path d="${front}"/></clipPath><clipPath id="sideClip"><path d="${side}"/></clipPath>
<clipPath id="tableClip"><path d="M90 546L998 410 1410 733 362 978-75 729Z"/></clipPath>
</defs>`);
// Context: a quiet civic packing table, with one upper-left window key light.
a.push(p('M0 0H1440V960H0Z','url(#wall)'));
a.push(p('M0 402L1440 296V960H0Z','url(#floor)'));
a.push(p('M0 388L1440 289V309L0 418Z','#4a5947'));
a.push(`<g filter="url(#background)">`);
a.push(p('M-40-20H240L275 336 0 353Z','#bdb197'));
a.push(p('M-15-5H215L244 315 0 333Z','#f7eed4'));
a.push(p('M60-10L86 326 101 325 77-10Z','#b3aa8d'));
a.push(p('M-4 139L230 121 231 137 0 158Z','#aca78b'));
a.push(p('M270 327L319 350 933 463 730 515 0 402V357Z','#efe2ba','opacity=".22"'));
a.push(p('M1104 190L1328 173 1334 459 1111 485Z','#425943'));
a.push(p('M1119 204L1312 190 1317 438 1125 461Z','#334c3b'));
a.push(l('M1131 335L1309 315','#d5caaa',1.2,.2));
a.push(p('M85 443L158 427 205 648 139 662Z','#67583e'));
a.push(p('M107 457L145 449 168 570 131 580Z','#a99066'));
a.push('</g>');
a.push(p('M265 843L322 854 313 1010 270 1010Z','#4a3827'));
a.push(p('M1264 745L1301 739 1324 965 1281 965Z','#3b3227'));
a.push(p('M89 558L996 423 1410 741 1412 766 361 1001-75 754-75 729Z','url(#edge)'));
a.push(p('M90 546L998 410 1410 733 362 978-75 729Z','url(#wood)'));
a.push(`<g clip-path="url(#tableClip)">`);
for(let i=0;i<38;i++){
  const y=411+i*16.2;
  a.push(l(`M-120 ${n(y)}C250 ${n(y-38)} 717 ${n(y-58)} 1560 ${n(y-152)}`,'#e9cfa4',n(.55+rnd()*1.1),n(.05+rnd()*.09)));
  a.push(l(`M-120 ${n(y+4)}C241 ${n(y-33)} 704 ${n(y-50)} 1560 ${n(y-149)}`,'#3e3727',.7,.09));
}
for(const x of [195,513,859,1204]) a.push(l(`M${x} 369L${x+192} 1040`,'#3b2d21',2.5,.38));
a.push(el(545,868,32,8,'none',`stroke="#754d2d" stroke-width="2" opacity=".42" transform="rotate(-12 545 868)"`));
a.push(l('M350 624C471 601 504 622 657 597M970 853l95-18M204 691l110-19M394 911l85-14','#f3d7a8',1,.28));
a.push('</g>');
// Repaired bag casts its entire shadow towards the lower-right, away from the window.
a.push(p('M450 669C708 627 1007 607 1196 697L1307 822C1056 894 766 837 544 796Z','#15251d','opacity=".37" filter="url(#shadow)"'));
a.push(el(780,715,349,56,'#0b2118','opacity=".33" filter="url(#soft)"'));
// Rear canvas lip and the plain envelopes identify ballot transport without a logo or lettering.
a.push(p('M421 326L932 349 1060 278C898 236 769 220 646 222L442 269Z','#283f31'));
a.push(p('M447 275L613 226 670 308 500 360Z','url(#paper)'));
a.push(l('M447 275L558 296 613 226M558 296L500 360','#b7af91',1,.7));
a.push(p('M501 277L660 243 701 332 542 373Z','url(#paper)'));
a.push(l('M501 277L604 302 660 243M604 302L542 373','#b4ac8c',1.3,.8));
a.push(p('M566 262L727 255 732 345 573 360Z','url(#paper)'));
a.push(l('M566 262L648 305 727 255M648 305L573 360','#b6af91',1.2,.7));
a.push(p('M745 269L892 283 882 354 735 340Z','url(#paper)'));
a.push(l('M745 269L811 313 892 283','#a9a58b',1.1,.7));
// The handles are closed loops with real interior voids and independent cast shadows.
a.push(p('M761 348L779 348 786 233C790 179 861 172 876 223L887 323 905 318 893 219C880 150 777 153 766 226Z','url(#handle)'));
a.push(l('M773 345L779 232C785 174 866 171 885 221L898 319','#d1b57a',2,.38));
a.push(p('M555 341L579 340 576 237C574 178 593 143 638 148 681 151 694 178 699 232L704 354 730 356 723 224C718 158 687 117 637 119 566 118 548 166 552 228Z','url(#handle)'));
a.push(l('M562 337L561 231C555 160 579 133 631 134 687 132 709 172 712 231L719 354','#bfa16a',2.2,.6));
a.push(l('M574 334L570 230C570 179 582 152 608 147','#2d2419',2,.6));
a.push(p('M556 153C570 131 589 125 616 124L647 124 646 151 623 149C596 149 584 160 576 178Z','#ad8e5c','opacity=".3"'));
// Main three-dimensional canvas body and the right-hand gusset.
a.push(p(side,'url(#gusset)'));
a.push(p(side,'url(#weave)'));
a.push(p(front,'url(#canvas)'));
a.push(p(front,'url(#weave)'));
a.push(p(front,'url(#faceLight)'));
a.push(p('M419 363C511 329 673 329 930 374L1071 310 1059 278C892 318 762 305 643 287 535 274 465 292 415 322Z','url(#top)'));
a.push(p('M419 363C511 329 673 329 930 374L1071 310 1059 278C892 318 762 305 643 287 535 274 465 292 415 322Z','url(#weave)'));
a.push(l('M423 359C536 329 701 339 930 375L1066 310','#c4c9a4',3.2,.65));
a.push(l('M422 365C536 341 704 350 929 383L1064 318','#163627',4,.42));
// Organic canvas weight, folds, edge roll and natural abrasion.
a.push(p('M423 371C440 454 423 548 448 636L465 702 505 720C463 641 470 514 483 372Z','url(#fold)','clip-path="url(#frontClip)"'));
a.push(p('M810 364C822 427 810 489 788 552L805 704 839 735C804 609 851 535 858 450L854 369Z','url(#fold)','clip-path="url(#frontClip)"'));
a.push(p('M654 361C646 432 652 530 684 617L681 736 717 740C725 664 691 585 685 507L704 366Z','url(#fold)','clip-path="url(#frontClip)"'));
a.push(p('M437 683C579 693 730 741 957 688L967 708C826 761 600 738 420 710Z','#182f25','opacity=".27"'));
a.push(l('M405 370C401 478 407 600 430 695C591 724 797 756 951 709','#bcc4a0',3,.25));
a.push(l('M942 390C969 475 973 600 961 699','#a6b893',2.2,.28));
a.push(l('M409 381C403 488 412 606 435 688C596 719 797 747 946 704','#1c3a2d',1.2,.7,`stroke-dasharray="2 7"`));
a.push(l('M1037 342C1045 387 1058 414 1043 482 1030 535 1050 557 1058 637','#b0bea0',3,.18));
a.push(l('M1011 355C991 434 1028 490 1007 550L986 671','#132d23',5,.26));
a.push(l('M1072 329C1089 418 1101 513 1084 616L979 694','#8da27e',2,.42,`stroke-dasharray="3 5"`));
// Narrow wear marks follow the load-bearing corners, not a generic texture overlay.
for(let i=0;i<46;i++){
  const x=414+rnd()*25,y=584+rnd()*118;
  a.push(l(`M${n(x)} ${n(y)}l${n(3+rnd()*8)} ${n(1+rnd()*3)}`,'#c5c2a0',n(.3+rnd()*.8),n(.13+rnd()*.16),'clip-path="url(#frontClip)"'));
}
for(let i=0;i<24;i++){
  const x=927+rnd()*27,y=633+rnd()*77;
  a.push(l(`M${n(x)} ${n(y)}l${n(-3-rnd()*6)} ${n(1+rnd()*2)}`,'#a8b69b',.75,n(.13+rnd()*.14),'clip-path="url(#frontClip)"'));
}
// Leather attachment straps, hardware with a void, stitch channels and real rivets.
for(const [x,y,lean]of[[549,355,-8],[710,367,16]]){
  a.push(p(`M${x-8} ${y-8}L${x+30} ${y-7} ${x+lean+37} ${y+286}Q${x+lean+17} ${y+302} ${x+lean-3} ${y+286}Z`,'#152b21','opacity=".33" transform="translate(6 5)"'));
  const strap=`M${x-8} ${y-8}L${x+30} ${y-7} ${x+lean+37} ${y+286}Q${x+lean+17} ${y+302} ${x+lean-3} ${y+286}Z`;
  a.push(p(strap,'url(#leather)'));a.push(p(strap,'url(#leatherPore)'));
  a.push(l(`M${x-2} ${y-4}L${x+lean+3} ${y+284}M${x+24} ${y-3}L${x+lean+30} ${y+284}`,'#d1b583',1.3,.57,`stroke-dasharray="3 5"`));
  a.push(p(`M${x-12} ${y+54}Q${x-12} ${y+47} ${x-5} ${y+47}L${x+34} ${y+49}Q${x+41} ${y+49} ${x+42} ${y+57}L${x+44} ${y+102}Q${x+44} ${y+109} ${x+36} ${y+109}L${x-4} ${y+106}Q${x-10} ${y+105} ${x-10} ${y+99}ZM${x-2} ${y+58}L${x} ${y+96} ${x+33} ${y+98} ${x+31} ${y+60}Z`,'url(#metal)',`fill-rule="evenodd"`));
  a.push(l(`M${x+15} ${y+52}L${x+17} ${y+98}`,'#ded5b2',3,.84));
  a.push(l(`M${x-9} ${y+53}L${x+35} ${y+56}`,'#fff0c3',1.3,.7));
  for(let i=0;i<6;i++)a.push(el(x+12+lean*(i/20),y+145+i*18,2.1,2.8,'#241f18',`transform="rotate(-3 ${x+12} ${y+145+i*18})"`));
  for(const [rx,ry]of[[x+9,y+5],[x+lean+16,y+266]]){a.push(el(rx,ry,5,5,'url(#metal)'));a.push(el(rx-1.1,ry-1.5,1.5,1,'#efe2b4'));}
}
// Reinforced mending patch occupies a stressed corner: not a label or insignia.
a.push(p('M815 619L902 628 910 702 822 699Z','#385541'));
a.push(p('M815 619L902 628 910 702 822 699Z','url(#weave)'));
a.push(l('M821 625L896 634 903 695 828 693Z','#c5bf92',1.8,.72,`stroke-dasharray="3 4"`));
for(let i=0;i<8;i++)a.push(l(`M${845+i*4} ${648+i*.5}L${847+i*4} ${669+i*.5}`,'#baa779',1.4,.63));
a.push(l('M844 658L878 662','#173425',1.6,.9));
// Repair supplies sit on the same plane; a subtle recurring-cost metaphor, not game values.
a.push(p('M920 780C989 747 1087 738 1142 770L1190 812C1133 857 1008 871 947 832Z','#17271c','opacity=".22" filter="url(#soft)"'));
a.push(p('M963 780C987 749 1029 751 1050 773L1118 815 1097 828 1030 788C1010 774 991 778 978 796Z','url(#leather)'));
a.push(l('M969 782C989 759 1025 760 1047 779L1108 817','#c8a56b',1.6,.55,`stroke-dasharray="3 4"`));
a.push(p('M1035 793L1048 785 1059 795 1046 804Z','url(#metal)'));
a.push(p('M1120 724L1156 716 1176 774 1141 782Z','#8e3b2e'));
a.push(el(1137,720,20,8,'#d6b893',`transform="rotate(-13 1137 720)"`));
a.push(el(1158,778,22,8,'#b39267',`transform="rotate(-13 1158 778)"`));
for(let i=0;i<13;i++)a.push(l(`M${1123+i*1.35} ${727+i*3.55}q18 1 34-8`,'#c07051',1,.65));
a.push(l('M1155 755C1201 763 1215 801 1168 803 1124 805 1134 847 1069 843','#b5694f',1.6,.88));
a.push(l('M1069 843L1190 804','#d7d4ba',2.5,.94));
a.push(l('M1183 806L1189 804','#fcf0d2',3,.8));
// A closed, unmarked envelope on the left balances the packing context without becoming a prop collage.
a.push(p('M200 743L323 700 435 764 304 814Z','#1c2c21','opacity=".2" filter="url(#soft)"'));
a.push(p('M196 733L324 691 433 751 303 801Z','url(#paper)'));
a.push(l('M196 733L310 751 324 691M310 751L303 801','#b5ab8e',1.5,.8));
a.push(p('M0 0H1440V960H0Z','url(#vignette)'));
a.push('</svg>');
const svg=a.join('\n');
writeFileSync(new URL('SND-011.svg',dir),svg);
const manifest={schema:1,status:'REJECT_FOR_PRODUCTION',id:card.id,sourceCard:card,sourceCardFile:'public/games/veto-h/source-cards.json',sourceFileSha256:hash(source),sourceRecordSha256:hash(JSON.stringify(card)),base:'3c1c8d1ec3035b697761a9c86fd0bfa553c6aec0',branch:'astra/veto-ballot-bag-vector-probe',sourceAuthorship:'New original authored SVG geometry, gradients, weave patterns and seeded wear marks. No image generation, image tracing, downloaded model or raster source.',externalAssets:[],embeddedImages:0,visibleText:false,people:false,animation:false,artworkDimensions:[576,384],masterViewBox:[0,0,1440,960],bytes:Buffer.byteLength(svg),gzipBytes:gzipSync(svg,{level:9}).length,sha256:hash(svg),semanticRelation:{fact:card.text,interpretation:'Reinforced heavy canvas transport bag remains intact; repair stitches, spare leather and thread suggest upkeep. The200OP amount and battle rule remain solely in unchanged UI text.',doesNotClaim:['Invulnerability outside battle','A new repair action or resource','Actual election institution or event']},quality:{accepted:false,completedProductionCards:0,humanArtStillBlocked:true,full300Expansion:false,reviewer:'Root assistant visual inspection of both renders; not independent human review',decision:'REJECT_FOR_PRODUCTION',reason:'Meaning and cream-green identity are legible, but broad schematic folds, uniform weave, flat wall/wood and weak perspective/material depth remain stylized vector, below the B3/B7 realism target.',retryAllowed:false},scope:{publicChanges:false,engineChanges:false,saveChanges:false,uiChanges:false},crop:{canonicalAssetAspect:'3:2',source:'public/games/duel-core/theme-meta.js art.width576/art.height384',layout:'Unchanged design.css uses flex art wells and object-fit:cover; actual responsive DOM crop not measured by this standalone renderer.'}};
writeFileSync(new URL('evidence.json',dir),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({bytes:manifest.bytes,gzipBytes:manifest.gzipBytes,sha256:manifest.sha256}));
