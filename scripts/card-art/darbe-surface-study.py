#!/usr/bin/env python3
"""Original DRB-001 surface study. No imported pixels, fonts, mesh or reference tracing.
Only writes isolated study artifacts. This is NOT a production art generator.
"""
from pathlib import Path
import random, json, hashlib

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'outputs/card-realism/darbe-surface-study'
R=random.Random(1001)
p=[]
def emit(s): p.append(s)
def path(d,fill,stroke=None,sw=1,extra=''):
    emit(f'<path d="{d}" fill="{fill}"'+(f' stroke="{stroke}" stroke-width="{sw}"' if stroke else '')+f' {extra}/>')
def line(d,c,w=1,opacity=1): path(d,'none',c,w,f'opacity="{opacity}" stroke-linecap="round" stroke-linejoin="round"')
def rect(x,y,w,h,c,extra=''): emit(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{c}" {extra}/>')
def ellipse(x,y,rx,ry,c,extra=''): emit(f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="{c}" {extra}/>')

def scene():
 p.clear(); R.seed(1001)
 emit('''<svg xmlns="http://www.w3.org/2000/svg" width="720" height="480" viewBox="0 0 720 480" role="img" aria-labelledby="title desc">
<title id="title">Dosya Kâtibi — original surface study</title><desc id="desc">A fictional older civilian clerk aligns a paper file at an angled archive counter under a single warm task lamp. Dark shelves recede behind him. No visible lettering or insignia.</desc>
<defs>
 <linearGradient id="wall" x2=".8" y2="1"><stop stop-color="#22282a"/><stop offset=".5" stop-color="#141e23"/><stop offset="1" stop-color="#070d13"/></linearGradient>
 <radialGradient id="wallLight" cx=".21" cy=".25" r=".68"><stop stop-color="#73624a" stop-opacity=".22"/><stop offset="1" stop-color="#25272b" stop-opacity="0"/></radialGradient>
 <linearGradient id="wood" x1=".05" y1=".08" x2=".75" y2="1"><stop stop-color="#57412b"/><stop offset=".34" stop-color="#6f5031"/><stop offset=".64" stop-color="#392d25"/><stop offset="1" stop-color="#0c1418"/></linearGradient>
 <linearGradient id="metal" x2=".9" y2=".2"><stop stop-color="#131a1b"/><stop offset=".2" stop-color="#4d5149"/><stop offset=".34" stop-color="#b7a77d"/><stop offset=".5" stop-color="#4c524a"/><stop offset=".74" stop-color="#252c2a"/><stop offset="1" stop-color="#0b141b"/></linearGradient>
 <linearGradient id="paper" x1=".1" y1="0" x2=".7" y2="1"><stop stop-color="#d9ccb1"/><stop offset=".45" stop-color="#c4b493"/><stop offset="1" stop-color="#7d7262"/></linearGradient>
 <linearGradient id="paperCurl" x2=".8" y2="1"><stop stop-color="#5d4a31"/><stop offset=".26" stop-color="#d8caab"/><stop offset=".46" stop-color="#e5d7b6"/><stop offset=".6" stop-color="#bca98b"/><stop offset="1" stop-color="#918065"/></linearGradient>
 <linearGradient id="linen" x1=".05" y1=".1" x2=".95" y2=".85"><stop stop-color="#b5a88a"/><stop offset=".27" stop-color="#8b806e"/><stop offset=".6" stop-color="#4d514c"/><stop offset="1" stop-color="#242e30"/></linearGradient>
 <linearGradient id="sleeve" x1=".1" y1=".1" x2=".88" y2=".8"><stop stop-color="#b1a38c"/><stop offset=".3" stop-color="#9b8e77"/><stop offset=".47" stop-color="#69665a"/><stop offset=".74" stop-color="#53584f"/><stop offset="1" stop-color="#253136"/></linearGradient>
 <linearGradient id="vest" x1="0" y1=".3" x2="1" y2=".8"><stop stop-color="#4a4740"/><stop offset=".3" stop-color="#323738"/><stop offset=".75" stop-color="#1b252b"/><stop offset="1" stop-color="#0d1821"/></linearGradient>
 <radialGradient id="face" cx=".25" cy=".32" r=".8"><stop stop-color="#d1a477"/><stop offset=".27" stop-color="#bd9068"/><stop offset=".57" stop-color="#9c7154"/><stop offset=".78" stop-color="#674d3e"/><stop offset="1" stop-color="#3c3832"/></radialGradient>
 <radialGradient id="cheek" cx=".22" cy=".17" r=".86"><stop stop-color="#d5aa7c"/><stop offset=".36" stop-color="#b88964"/><stop offset=".7" stop-color="#876044"/><stop offset="1" stop-color="#705242" stop-opacity="0"/></radialGradient>
 <radialGradient id="nose" cx=".1" cy=".4" r="1"><stop stop-color="#e5bc88"/><stop offset=".3" stop-color="#c89b6c"/><stop offset=".7" stop-color="#a1734f"/><stop offset="1" stop-color="#795138"/></radialGradient>
 <linearGradient id="neck" x1="0" y1=".4" x2="1" y2=".75"><stop stop-color="#a77950"/><stop offset=".38" stop-color="#8d674a"/><stop offset=".68" stop-color="#584634"/><stop offset="1" stop-color="#33352e"/></linearGradient>
 <linearGradient id="hand" x1="0" y1=".2" x2=".7" y2="1"><stop stop-color="#dab083"/><stop offset=".35" stop-color="#bf946c"/><stop offset=".74" stop-color="#916c4c"/><stop offset="1" stop-color="#5d4c39"/></linearGradient>
 <linearGradient id="finger" x1="0" y1="0" x2=".3" y2="1"><stop stop-color="#dec399"/><stop offset=".2" stop-color="#cba77c"/><stop offset=".47" stop-color="#a98057"/><stop offset="1" stop-color="#715238"/></linearGradient>
 <linearGradient id="hair" x1="0" y1=".1" x2="1" y2="1"><stop stop-color="#b9af95"/><stop offset=".32" stop-color="#716f60"/><stop offset=".62" stop-color="#383f3c"/><stop offset="1" stop-color="#1c292b"/></linearGradient>
 <radialGradient id="lampGlow"><stop stop-color="#ffedc2" stop-opacity=".19"/><stop offset="1" stop-color="#d9bd84" stop-opacity="0"/></radialGradient>
 <radialGradient id="vignette" r=".7"><stop offset=".47" stop-color="#020811" stop-opacity="0"/><stop offset="1" stop-color="#020811" stop-opacity=".6"/></radialGradient>
 <filter id="blur1"><feGaussianBlur stdDeviation="1.2"/></filter><filter id="blur2"><feGaussianBlur stdDeviation="2.5"/></filter><filter id="blur6"><feGaussianBlur stdDeviation="6"/></filter>
 <filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".83" numOctaves="2" seed="17" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".055"/></feComponentTransfer><feBlend in2="SourceGraphic" mode="soft-light"/></filter>
 <clipPath id="bodyBack"><path d="M0 0H720V335L334 285 0 348Z"/></clipPath>
 <clipPath id="frame"><rect width="720" height="480"/></clipPath>
 <clipPath id="counter"><path d="M0 348L334 285 720 335V480H0Z"/></clipPath>
 <clipPath id="shirtClip"><path d="M489 219C508 220 544 238 571 270L605 363 458 400 410 298 438 245Z"/></clipPath>
 <clipPath id="headClip"><path d="M505 109C498 78 476 71 452 82 434 90 428 107 432 126L430 145 416 164Q410 171 422 174L428 175 428 181 424 186 429 191Q427 203 440 209L459 214 473 202Q491 193 495 175L507 149Z"/></clipPath>
</defs><g clip-path="url(#frame)">''')
 rect(0,0,720,480,'url(#wall)');rect(0,0,720,400,'url(#wallLight)')
 # Deep left shelving: one coherent vanishing direction, no readable labels.
 emit('<g filter="url(#blur1)">')
 path('M0 24L327 57V305L0 335Z','#10191d')
 for i,y in enumerate([34,100,169,240,313]):
  path(f'M0 {y}L326 {y+(57-y)*.045+24:.1f}V{y+28}L0 {y+9}Z','#393c36')
  line(f'M0 {y+2}L326 {y+25}', '#6f6c56',.7,.5)
 for x in [7,88,174,253,320]:
  path(f'M{x} 25L{x+8} 26V319L{x} 322Z','#27302e')
 for row in range(4):
  for col in range(11):
   x=14+col*27+R.uniform(-2,2);y=40+row*69+x*.071
   w=R.uniform(12,21);h=R.uniform(42,56)
   color=R.choice(['#363d39','#49483b','#4b4940','#2a3536','#626052'])
   path(f'M{x:.1f} {y:.1f}l{w:.1f} 1.4v{h:.1f}l-{w:.1f} -1.4z',color)
   line(f'M{x+1:.1f} {y+2:.1f}v{h-3:.1f}', '#898470',.65,.4)
   rect(round(x+4,1),round(y+h*.22,1),max(4,round(w-7,1)),7,'#bab094','opacity=".18"')
   ellipse(round(x+w/2,1),round(y+h*.74,1),2,2.8,'#101a1d')
 emit('</g>')
 # Rear passage and side cabinet, surfaces subdued beyond plane of subject.
 path('M330 0H391V295L330 305Z','#10191f');line('M335 0V301','#5b6257',1.2,.35)
 path('M608 0H720V335L624 310Z','#111d24')
 for i in range(4):
  y=42+i*62
  path(f'M620 {y}L720 {y-4}V{y+51}L620 {y+54}Z','#1b2a2f')
  line(f'M624 {y+1}L719 {y-3}', '#576158',.8,.4)
  path(f'M650 {y+22}h39v5h-39z','url(#metal)')
  line(f'M653 {y+23}h32','#b7b08f',.6,.4)
 # Counter receiving every object, perspective and worn grain oriented consistently.
 path('M0 349L334 285 720 335V480H0Z','url(#wood)')
 emit('<g clip-path="url(#counter)">')
 for i in range(42):
  y=293+i*6.2
  line(f'M-20 {y+65:.1f}C195 {y+35:.1f} 392 {y-4:.1f} 735 {y+43:.1f}',R.choice(['#977552','#1c2424','#ab8460']),R.choice([.4,.7,1.1]),R.uniform(.06,.14))
 ellipse(206,335,189,49,'#d5b875','opacity=".095" filter="url(#blur6)"')
 emit('</g>')
 # Figure cast shadow on table follows upper-left lamp.
 path('M491 304C541 321 570 338 563 356L651 445 529 451 382 363Z','#050d12',extra='opacity=".5" filter="url(#blur6)"')
 # Far forearm and hand, the near hand will be drawn above the document.
 path('M460 245C438 248 425 264 421 285L397 316 348 329 355 348 417 344C439 338 462 305 476 284Z','url(#sleeve)')
 path('M423 278C435 281 445 283 450 276L439 301 413 329 398 325Z','#333e3d',extra='opacity=".5"')
 line('M439 253C423 270 423 284 418 291M430 290L410 317M426 311L441 301','#c3b497',1.5,.3)
 path('M348 328C337 325 324 331 313 331L296 339Q292 344 300 347L316 344 334 350 357 344Z','url(#hand)')
 path('M300 337Q291 338 287 345Q289 349 298 348L313 343 329 343','url(#finger)')
 # Torso is behind the counter; only the bent near arm crosses its occlusion edge.
 emit('<g clip-path="url(#bodyBack)">')
 # Torso in a civilian wool waistcoat over linen. No insignia or uniform.
 path('M489 219C508 220 544 238 571 270L605 363 458 400 410 298 438 245Z','url(#linen)')
 path('M495 231Q520 235 544 253L553 297 580 370 488 402 458 323 437 255 458 231 476 255Z','url(#vest)')
 path('M458 230L437 252 456 303 474 272Z','#5c584b')
 path('M458 232L446 247 459 281 473 271Z','#b2a188')
 path('M492 221L505 232 493 264 475 251Z','#a69b82')
 line('M497 237L486 264 503 383','#797465',1,.4)
 line('M457 298Q477 335 483 384','#807d6c',.6,.25)
 path('M516 300L544 293 548 307 521 313Z','#19252b');line('M516 300L544 293','#65665a',1,.6)
 for x,y in [(488,282),(495,320),(504,360)]:
  ellipse(x,y,2.8,3.3,'#1a211f');ellipse(x-.7,y-.9,.8,1,'#8c846b')
 emit('</g>')
 # shirt shoulder, anatomically continuous upper arm into bent near elbow.
 path('M522 234C548 235 573 255 585 276L593 312C595 330 586 345 569 352L516 354 490 339 532 323 543 304 527 280C519 265 515 247 522 234Z','url(#sleeve)')
 path('M538 241Q566 254 574 278L579 309Q576 319 566 323L548 319 553 302Q545 282 539 269Z','#c1ad88',extra='opacity=".2" filter="url(#blur2)"')
 path('M545 286C555 295 559 306 554 316L535 331 555 325 574 327 583 315 580 294Z','#2b3637',extra='opacity=".38"')
 line('M532 249Q530 267 547 284M547 301L551 312 534 327M546 332Q567 342 581 325','#d0bb97',1.2,.25)
 line('M534 259Q537 271 545 279M563 273L576 295M555 319L572 314','#36413f',1.3,.5)
 # Rolled cuff wrapping around forearm, elliptical tension contour.
 path('M491 326C497 323 506 322 513 327L525 344Q523 354 514 358L496 347Z','#a69a7e')
 path('M492 327Q505 323 512 330L522 345 515 351 502 339Z','#c0b18f')
 line('M497 329L509 339 516 350','#6a6958',1.5,.8)
 # Neck partially hidden behind collar. No disconnected mannequin junction.
 path('M465 189L494 180Q489 210 500 227L483 249 459 231 465 214Z','url(#neck)')
 path('M469 203Q476 222 480 235L470 236 462 230Z','#d1a172',extra='opacity=".3" filter="url(#blur1)"')
 emit('<g transform="rotate(-20 481 207)">')
 # Head: deliberately asymmetrical older male, downward gaze in side three-quarter view.
 path('M505 109C498 78 476 71 452 82 434 90 428 107 432 126L430 145 416 164Q410 171 422 174L428 175 428 181 424 186 429 191Q427 203 440 209L459 214 473 202Q491 193 495 175L507 149Z','url(#face)')
 emit('<g clip-path="url(#headClip)">')
 ellipse(446,112,33,32,'#e2b98a','opacity=".34" filter="url(#blur6)"')
 path('M466 130C455 139 438 146 438 165Q433 177 438 196C447 204 460 202 470 189L486 165Z','url(#cheek)')
 path('M467 149C457 156 455 170 459 177L449 198Q460 205 473 190L482 170Z','#604b3c',extra='opacity=".45" filter="url(#blur2)"')
 path('M431 133Q442 132 451 140L446 151 432 149Z','#6b503d',extra='opacity=".55" filter="url(#blur2)"')
 path('M441 150Q438 161 441 171L438 180 433 177Q428 175 421 174L418 170 431 148Z','url(#nose)')
 path('M439 158Q439 169 435 171L425 170Q419 171 420 174L429 177 439 175 444 169Z','#795039',extra='opacity=".75"')
 ellipse(432,173,4,1.3,'#4a3629','transform="rotate(15 432 173)"')
 line('M420 168Q424 164 427 163','#f0ca94',.9,.5)
 # Upper lids have a sloping orbital socket rather than circular cartoon eyes.
 path('M432 146Q440 144 449 150Q441 151 434 149Z','#352f27')
 path('M434 148Q440 148 444 150L436 150Z','#bdac8c')
 ellipse(438.5,149,1.2,.8,'#1f2726');line('M432 143Q440 140 449 147','#473c2d',2,.8)
 line('M448 151L454 151M442 155Q447 157 452 155','#79553e',.65,.65)
 path('M428 183Q435 181 441 184L437 186 425 186Z','#76503c')
 path('M426 187Q434 189 440 186L439 190 432 192Z','#aa7e5d')
 line('M428 187Q434 187 439 186','#473528',.9,.9)
 path('M442 176Q448 181 443 189M445 192Q444 198 437 199','none','#6c4c39',.8,'opacity=".55"')
 path('M432 196Q441 199 450 196L454 203Q443 209 434 204Z','#ce9c6d',extra='opacity=".46" filter="url(#blur1)"')
 # Age: continuous forehead creases and subtle temple texture, not symbols.
 for d in ['M437 109Q448 105 460 109','M436 115Q446 111 457 115','M436 121Q444 117 453 120']:
  line(d,'#8d694b',.7,.38)
 for i in range(95):
  x=R.uniform(438,474);y=R.uniform(111,201)
  ellipse(round(x,2),round(y,2),R.uniform(.16,.36),R.uniform(.15,.4),'#e5be90',f'opacity="{R.uniform(.07,.17):.2f}"')
 emit('</g>')
 # Ear placed behind mandibular hinge, helix highlights from key lamp.
 path('M482 148C491 143 495 151 492 164 489 177 481 182 476 174L476 165Z','url(#face)')
 path('M481 154Q490 149 488 160L483 168 479 166Q485 161 481 158Z','#634937')
 line('M484 152Q491 150 489 162L484 172','#c09469',1,.7)
 # Sparse hair wraps cranium; not separate helmet edge.
 path('M431 113C427 96 435 82 453 76 477 66 500 78 508 99Q516 123 507 145L494 158 489 147 491 132Q473 119 459 111 444 104 431 113Z','url(#hair)')
 path('M436 98C448 77 476 74 494 91L496 114C480 104 462 94 447 98Z','#c3b296',extra='opacity=".2" filter="url(#blur2)"')
 path('M433 111Q431 86 455 79C468 75 482 78 490 86Q467 83 458 94L448 113Z','url(#face)')
 line('M435 103Q444 96 453 98M436 109Q443 103 451 105','#77513c',.6,.5)
 for i in range(37):
  t=i/36;x=469+32*t;y=92+17*t+R.uniform(-3,3)
  line(f'M{x:.2f} {y:.2f}q{R.uniform(-8,-2):.2f} 5 -1 12',R.choice(['#b1ad97','#666e61','#253331']),R.uniform(.35,.7),R.uniform(.25,.65))
 line('M502 110Q507 126 498 145','#bec0a1',1,.25)
 emit('</g>')
 # Open file: physical paper stack and two bent leaves, no decorative pseudo-writing.
 path('M194 355L377 311 478 352 280 421Z','#070e13',extra='opacity=".62" filter="url(#blur2)"')
 path('M184 344L378 304 472 350 276 409Z','#4b4131')
 for i in range(8):
  d=i*1.15
  path(f'M{191+d*.25:.2f} {340-d:.2f}L376 {301-d:.2f} 462 {345-d:.2f} 276 {402-d:.2f}Z',R.choice(['#95866b','#b9aa8e','#cabb9a','#a7997d']))
 path('M190 330L367 295Q390 310 402 320L273 388Z','url(#paper)')
 path('M273 388L402 320Q421 308 442 317L476 341 295 399Z','url(#paperCurl)')
 line('M190 330L367 295','#eadbb7',.9,.65)
 line('M276 390L401 322','#5b4c37',1.5,.55)
 # Loose sewing tape and flat spine band: narrative contact target for the near hand.
 path('M281 340L303 336 335 353 313 360Z','#73765c')
 line('M299 339L322 353','#babba0',1,.5)
 path('M312 350C319 339 329 335 336 341S330 354 319 353','#b4a584',extra='stroke="#645a43" stroke-width=".7"')
 # Near forearm enters open file; each finger has a continuous base, tendon and contact shadow.
 path('M499 326C477 325 457 331 441 335L414 337 389 344 378 356 387 363 410 356 437 356 467 349 513 351Z','url(#hand)')
 path('M508 341C488 342 474 339 458 343L435 351 411 350 390 360 387 366 418 359 445 360 480 352 514 350Z','#77563d',extra='opacity=".5"')
 path('M414 337C404 333 392 332 381 334L363 340 345 343Q340 346 343 349 346 352 353 349L368 347 384 344 398 348 411 349Z','url(#hand)')
 # Flattened index presses the cloth tab, with far fingers progressively occluded.
 path('M389 343C378 342 369 345 362 347L339 351Q335 352 337 356 341 359 348 355L372 352 390 351Z','url(#finger)')
 path('M392 350L374 352 351 357Q346 359 349 362 352 364 358 361L377 357 394 358Z','url(#finger)')
 path('M400 355L384 358 366 364Q362 366 365 369 369 370 375 367L389 363 404 362Z','url(#finger)')
 path('M409 355L397 363 385 369Q382 372 386 373 391 373 399 368L416 359Z','url(#finger)')
 path('M377 338C371 332 364 330 361 333L356 340Q355 344 360 345L368 340 381 346Z','url(#finger)')
 # Contact remains darker, with nails small and inset, never floating shapes.
 for d in ['M338 356L348 353','M350 362L358 359','M366 369L373 366','M385 372L393 368']:
  line(d,'#352e21',1,.65)
 path('M343 351l7-1 1 2-7 2q-2-1-1-3Z','#d0ad86',extra='opacity=".75"')
 path('M351 357l7-1 1 2-6 2Z','#c9a67f',extra='opacity=".65"')
 line('M372 346Q376 350 374 352M387 344L391 348M396 339Q412 342 420 341M406 346L430 342','#71563e',.75,.48)
 # Metal clips, neutral stationery: grounding contact and specular material response.
 path('M208 336L227 332 232 345 213 350Z','#202726')
 line('M212 337L215 329Q217 325 220 329L225 336','#c5b18a',1.8,.9)
 line('M213 348L229 343','#9c9e8a',.7,.8)
 # A low tray in the front-left, foreshortened rather than a repeating pile wall.
 path('M-21 390L111 363 230 415 98 464Z','#0c171c')
 path('M-18 381L111 357 228 405 99 450Z','url(#metal)')
 path('M-12 379L111 362 216 405 98 444Z','#2d3230')
 for i in range(7):
  d=i*2.15
  path(f'M-12 {376-d:.1f}L108 {356-d:.1f} 201 {396-d:.1f} 83 {433-d:.1f}Z',R.choice(['#7d765f','#a3997c','#8e856c']))
  line(f'M-12 {376-d:.1f}L83 {433-d:.1f} 201 {396-d:.1f}','#d3c6a0',.55,.45)
 path('M-10 363L111 344 213 384 86 423Z','url(#paper)')
 path('M-10 363L111 344 118 347 85 423Z','#aea388',extra='opacity=".18"')
 # Task lamp upper left, single principal light with a consistent table-facing cone.
 path('M78 328L92 83 102 66','none','#171e20',7)
 line('M81 326L95 83 103 66','#7a7a64',1.6,.7)
 ellipse(75,327,33,9,'url(#metal)')
 path('M101 64Q110 39 133 43L174 57 181 81 91 93Z','url(#metal)')
 ellipse(136,86,47,11,'#dcc28d','transform="rotate(-8 136 86)"')
 ellipse(138,86,34,6.5,'#f1dcab','transform="rotate(-8 138 86)"')
 path('M90 86Q129 64 181 75L177 82Q134 73 95 94Z','#151f22')
 ellipse(152,121,97,68,'url(#lampGlow)')
 # Entire original drawing receives faint material grain only, no bitmap texture.
 # No full-frame pale wash: preserve the lamp contrast and dark material separation.

 rect(0,0,720,480,'url(#vignette)')
 emit('</g></svg>')
 return '\n'.join(p)+'\n'

if __name__=='__main__':
 OUT.mkdir(parents=True,exist_ok=True)
 svg=scene(); dest=OUT/'DRB-001-surface-study.svg';dest.write_text(svg)
 manifest={'id':'DRB-001','name':'Dosya Kâtibi','status':'STUDY_NOT_ACCEPTED','productionEligible':False,'authoredSource':'scripts/card-art/darbe-surface-study.py','sourceMethod':'original cubic Bezier contours, layered analytical gradients, seeded procedural microtexture','artworkOnly':True,'noExternalInput':True,'visibleText':False,'width':720,'height':480,'nativeWidth':240,'nativeHeight':160,'bytes':len(svg.encode()),'sha256':hashlib.sha256(svg.encode()).hexdigest(),'seed':1001,'referenceUse':'quality observation only; no reference pixels, geometry, composition, person, typography or emblem used as input'}
 (OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
 print(json.dumps(manifest))
