#!/usr/bin/env python3
"""Original offline 2.5D surface study; no photos, models, fonts or sampled texture.

Builds vector masks from original Bezier controls, then lights analytic relief
surfaces. The output is a bounded study, never a runtime art replacement.
"""
from pathlib import Path
import argparse, hashlib, json, math, re, time
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy.ndimage import gaussian_filter

ROOT = Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser()
parser.add_argument('--output',type=Path,default=ROOT / 'outputs/card-realism/gett-surface-study')
args=parser.parse_args()
OUT=args.output
S = 3
W,H = 400*S,300*S
rng = np.random.default_rng(100104)
Y,X = np.mgrid[:H,:W].astype(np.float32)/S
LIGHT = np.array([.52,-.72,.48],np.float32); LIGHT /= np.linalg.norm(LIGHT)
noise = gaussian_filter(rng.normal(0,1,(H,W)).astype(np.float32), .7)
canvas = np.zeros((H,W,3),np.float32)

def curve(d):
    tokens=re.findall(r'[MLCQZmlcqz]|-?(?:\d*\.)?\d+',d)
    i=0; pts=[]; current=np.array([0.,0.]); start=current.copy(); cmd=None
    while i<len(tokens):
        if re.match('[A-Za-z]',tokens[i]): cmd=tokens[i]; i+=1
        if cmd=='Z': pts.append(start.copy()); cmd=None; continue
        n={'M':2,'L':2,'C':6,'Q':4}[cmd]
        vals=np.array([float(v) for v in tokens[i:i+n]]).reshape(-1,2);i+=n
        if cmd in ('M','L'):
            current=vals[0];pts.append(current.copy())
            if cmd=='M': start=current.copy();cmd='L'
        else:
            orig=current.copy()
            length=np.linalg.norm(vals[-1]-orig)
            for t in np.linspace(0,1,max(8,int(length*1.3)))[1:]:
                if cmd=='C': p=(1-t)**3*orig+3*(1-t)**2*t*vals[0]+3*(1-t)*t*t*vals[1]+t**3*vals[2]
                else: p=(1-t)**2*orig+2*(1-t)*t*vals[0]+t*t*vals[1]
                pts.append(p)
            current=vals[-1]
    return [(float(a)*S,float(b)*S) for a,b in pts]

def mask(d):
    im=Image.new('L',(W,H));ImageDraw.Draw(im).polygon(curve(d),fill=255)
    return np.asarray(im,dtype=np.float32)/255

def g(cx,cy,rx,ry,amp=1): return amp*np.exp(-.5*((X-cx)/rx)**2-.5*((Y-cy)/ry)**2)

def blend(color,m):
    global canvas
    c=np.asarray(color,dtype=np.float32)
    if c.ndim==1:c=c[None,None,:]
    canvas=canvas*(1-m[:,:,None])+c*m[:,:,None]

def flat(d,color,alpha=1):blend(color,mask(d)*alpha)

def shade(d,base,z,rough=.7,texture=.8,extra=0):
    dy,dx=np.gradient(z,1/S,1/S)
    length=np.sqrt(dx*dx+dy*dy+1)
    diffuse=np.clip((-dx*LIGHT[0]-dy*LIGHT[1]+LIGHT[2])/length,0,1)
    illumination=.32+.99*diffuse
    spec=np.maximum(0,(-dx*.27-dy*(-.38)+.88)/length)**(18+70*(1-rough))
    c=np.array(base)[None,None,:]*illumination[:,:,None]
    c+=spec[:,:,None]*(1-rough)*84*np.array([1,.82,.59])
    c+=(noise*texture)[:,:,None]
    if not np.isscalar(extra): c+=extra[:,:,None]
    blend(np.clip(c,0,255),mask(d))

def line(d,col,width=1,alpha=1,blur=0):
    im=Image.new('L',(W,H));ImageDraw.Draw(im).line(curve(d),fill=255,width=max(1,round(width*S)),joint='curve')
    if blur:im=im.filter(ImageFilter.GaussianBlur(blur*S))
    blend(col,np.asarray(im,dtype=np.float32)/255*alpha)

def ellipse(box,col,alpha=1,blur=0):
    im=Image.new('L',(W,H));ImageDraw.Draw(im).ellipse(tuple(round(v*S) for v in box),fill=255)
    if blur:im=im.filter(ImageFilter.GaussianBlur(blur*S))
    blend(col,np.asarray(im,dtype=np.float32)/255*alpha)

def wood(d,base,grainx=.3,grainy=1):
    field=1.1*np.sin(X*grainx+np.sin(Y*.08)*2)+.35*np.sin(X*.96+Y*grainy)
    shade(d,base,np.ones((H,W),np.float32)*.1,.88,2.1,extra=field)

def glass(cx,cy,scale=1):
    # Tulip-shaped glass on a shallow ceramic saucer, physically grounded.
    ellipse((cx-13*scale,cy+26*scale,cx+16*scale,cy+34*scale),(8,7,5),.7,2.2*scale)
    ellipse((cx-15*scale,cy+22*scale,cx+15*scale,cy+30*scale),(152,137,111))
    ellipse((cx-13*scale,cy+22*scale,cx+13*scale,cy+27*scale),(224,213,180))
    ellipse((cx-8*scale,cy+23*scale,cx+8*scale,cy+27*scale),(84,55,34),.8)
    def tr(pts):
        tok=re.findall(r'[MLCQZ]|-?(?:\d*\.)?\d+',pts);out=[];n=0
        for t in tok:
            if t.isalpha():out.append(t);n=0
            else:out.append(str((cx if n%2==0 else cy)+float(t)*scale));n+=1
        return ' '.join(out)
    body=tr('M -9 0 C -8 8 -4 12 -5 17 C -6 22 -8 24 -7 26 C -3 29 4 29 8 26 C 9 24 7 22 6 17 C 5 12 9 7 10 0 Z')
    shade(body,(75,44,19),g(cx,cy+15*scale,7*scale,20*scale,5*scale),.07,.1)
    tea=tr('M -8 6 C -5 14 -5 17 -7 24 C -4 27 4 28 8 24 C 5 17 5 14 8 6 Z')
    shade(tea,(115,31,4),g(cx,cy+17*scale,4*scale,12*scale,3.2*scale),.1,.1,extra=g(cx-4*scale,cy+20*scale,2*scale,9*scale,29))
    ellipse((cx-8*scale,cy+4.5*scale,cx+8*scale,cy+8*scale),(68,20,4))
    line(tr('M -9 0 C -8 7 -5 11 -5 16 C -5 21 -7 24 -7 26'),(235,204,150),.7*scale,.95)
    line(tr('M 10 0 C 8 8 5 13 6 17 C 6 21 9 23 8 26'),(153,138,103),.5*scale,.8)
    line(tr('M -6 2 C -5 8 -2 13 -3 19 C -4 23 -4 24 -3 26'),(246,218,158),.55*scale,.95)
    ellipse((cx-9*scale,cy-1*scale,cx+10*scale,cy+2*scale),(234,207,155))
    ellipse((cx-8.5*scale,cy-.6*scale,cx+9.5*scale,cy+1.5*scale),(62,49,32))
    line(tr('M -5 29 Q 0 30 6 28'),(225,203,157),.6*scale)

start=time.perf_counter()
# Receding architecture. Sole strong light is the right overhead pendant;
# cool far glazing is low-energy environmental bounce, not a second key.
blend(np.stack([28+g(280,90,150,180,19),27+g(280,90,150,180,12),22+g(280,90,150,180,5)],axis=-1),np.ones((H,W)))
flat('M 0 0 L 100 0 L 119 177 L 0 235 Z',(43,42,35))
flat('M 12 26 L 79 34 L 89 180 L 12 216 Z',(32,44,43))
for y in [44,72,98,119,141]:
    line(f'M 14 {y} L 84 {y+7}',(54,60,52),1,.5)
wood('M 0 0 L 12 0 L 12 240 L 0 245 Z',(61,43,24))
wood('M 79 0 L 93 0 L 111 209 L 97 217 Z',(65,46,25))
line('M 89 0 L 105 214',(153,112,58),1.2,.35)
# Deep green wall tiles, uneven reflected values, no random lettering.
for row in range(5):
    y=102+row*25
    for col in range(7):
        x=108+col*43
        base=np.array([38,43,33])+rng.integers(-3,4)
        flat(f'M {x} {y} L {x+41} {y-2} L {x+41} {y+21} L {x} {y+23} Z',base)
        line(f'M {x+1} {y} L {x+40} {y-2}',(105,103,71),.35,.22)
# Recessed shelves with cups, visually quiet and depth-correct.
for top in [48,91]:
    wood(f'M 225 {top} L 400 {top-6} L 400 {top+7} L 225 {top+10} Z',(61,40,22),.07,.02)
    flat(f'M 226 {top+10} L 400 {top+7} L 400 {top+13} L 226 {top+15} Z',(19,16,11))
for cx,cy,s in [(246,45,.85),(269,44,.8),(298,43,.84),(330,42,.8),(363,40,.9),(258,88,.8),(292,87,.95),(325,86,.85)]:
    cup=f'M {cx-7*s} {cy-14*s} Q {cx} {cy-17*s} {cx+7*s} {cy-14*s} L {cx+6*s} {cy} Q {cx} {cy+2*s} {cx-6*s} {cy} Z'
    shade(cup,(122,117,94),g(cx,cy-8,5*s,10*s,4*s),.45,.4)
    line(f'M {cx+6*s} {cy-12*s} C {cx+15*s} {cy-15*s} {cx+15*s} {cy-2*s} {cx+6*s} {cy-2*s}',(104,97,73),1.6*s)
# Overhead brushed metal shade and its underside; not a floating decorative orb.
line('M 321 0 L 321 25',(25,22,15),1.4)
shade('M 315 23 C 309 27 302 29 299 36 Q 321 42 343 36 C 340 29 331 27 327 23 Z',(62,65,49),g(321,29,18,9,9),.22,.4)
ellipse((299,34,343,40),(182,158,99));ellipse((303,35,339,39),(249,216,158))
# Back counter in perspective.
wood('M 104 181 L 400 160 L 400 181 L 107 202 Z',(95,62,29),.04,.3)
flat('M 107 202 L 400 181 L 400 262 L 111 289 Z',(31,25,18))
for x in [121,196,273,352]:
    line(f'M {x} 201 L {x+2} 285',(73,49,26),1,.5)
# Steam urn, lathe profile and coherent broad metallic response.
urn='M 340 116 Q 335 119 335 126 L 336 164 Q 350 171 372 162 L 373 123 Q 373 116 366 114 Z'
uz=8*np.sqrt(np.maximum(0,1-((X-355)/20)**2))
shade(urn,(113,99,68),uz,.15,.4)
line('M 336 126 Q 351 131 372 123',(183,168,122),.8,.7)
line('M 342 130 L 343 159',(220,195,131),1.4,.6)
line('M 336 137 L 330 138 L 330 143 L 327 144',(67,58,41),3)
flat('M 339 111 Q 356 106 370 111 L 371 116 Q 355 120 337 116 Z',(98,88,61))
ellipse((351,105,359,111),(40,37,29));line('M 373 129 C 391 125 392 153 374 154',(30,28,22),4)
# Body geometry and cloth relief: no straight tube limbs or concentric outline face.
body='M 141 106 C 122 109 110 114 104 132 C 97 155 97 201 105 239 L 199 247 C 201 211 217 181 207 149 C 203 130 190 116 179 111 Z'
bz=g(154,180,38,61,16)+g(119,146,19,30,5)+g(192,145,14,27,5)
folds=g(122,178,3,31,1.1)-g(132,172,4,36,.8)+g(188,202,4,32,1.6)-g(181,220,3,25,1.1)
shade(body,(107,100,77),bz+folds,.96,1.4)
# Rolled sleeve of far arm resting at counter.
shade('M 110 139 C 97 147 94 164 97 187 C 97 201 102 218 110 229 L 132 224 C 124 205 121 190 124 173 C 128 153 126 141 110 139 Z',(98,92,71),g(110,180,11,38,5)+g(106,182,6,3,1.1)-g(108,186,7,3,.8),.95,1.1)
shade('M 103 214 C 105 227 113 246 121 254 C 126 256 132 251 131 247 L 123 220 Z',(139,102,72),g(117,235,11,28,6),.85,.8)
# Neck and a small natural collar shadow.
shade('M 148 84 C 151 96 150 106 140 112 C 149 124 168 125 184 116 C 176 108 173 96 177 87 Z',(150,112,82),g(166,102,13,20,8)-g(175,103,7,18,3),.9,.6)
flat('M 148 106 Q 162 120 180 108 L 188 115 Q 164 132 138 116 Z',(39,39,30))
shade('M 139 110 L 131 117 L 147 139 L 159 123 Z',(136,128,97),g(147,123,12,13,3),.9,.8)
shade('M 178 111 L 193 119 L 181 139 L 165 125 Z',(104,98,73),g(181,123,12,16,5),.9,.8)
# Apron drape: unequal folds and tension from a tied waist.
apron='M 136 129 L 180 130 C 181 153 194 169 194 190 L 194 247 L 119 257 C 122 221 120 176 136 129 Z'
az=g(157,190,25,55,5)+g(137,181,3,44,1.2)-g(148,201,4,38,.7)+g(178,193,3,31,1.5)-g(181,205,3,22,1.1)
shade(apron,(39,43,36),az,.98,1.2)
line('M 138 112 L 133 142',(21,24,20),3);line('M 182 115 L 179 145',(24,27,20),3)
line('M 126 191 Q 158 184 190 190',(119,108,72),.5,.5)
line('M 144 219 L 177 216 L 179 235 Q 162 243 146 239 Z',(96,94,65),.5,.45)
line('M 121 233 Q 156 224 194 228',(31,30,23),3)
# Older woman's head, tilted down. Original sculptural height map defines cheek,
# zygoma, brow, orbital recess and philtrum; small tonal landmarks have no outline.
face='M 143 56 C 152 44 171 44 182 54 C 187 59 188 67 187 75 C 187 80 192 83 194 86 C 195 88 192 90 190 90 C 191 93 193 94 192 96 L 189 98 C 191 101 187 107 182 109 C 174 111 159 105 153 98 C 149 95 146 91 144 88 C 139 85 138 79 140 75 C 139 68 139 61 143 56 Z'
fz=g(164,73,19,26,4.4)+g(176,87,9,10,1.6)+g(187,84,4,7,1.4)-g(180,76,6,3,.85)+g(177,69,10,3,.5)-g(187,99,4,3,.45)+g(182,103,8,5,.4)
shade(face,(168,121,83),fz,.87,.65,extra=-g(151,90,5,12,8))
# Ear with helix and concha represented as separate illuminated depressions.
shade('M 148 75 C 141 71 138 77 140 84 C 140 90 145 95 149 91 C 153 86 152 79 148 75 Z',(161,115,80),g(145,83,5,9,4)-g(146,82,2.1,4.5,3),.9,.5)
line('M 147 78 C 140 75 142 87 145 88',(204,157,109),.55,.75)
line('M 148 81 Q 144 81 146 85',(84,58,42),.55,.6)
# One visible relaxed eye looking down at the glass, not an outlined cartoon eye.
line('M 178 77 Q 182 78.5 186 77.8',(65,47,34),.4,.82)
line('M 179 76 Q 183 76 185 76.8',(202,148,100),.55,.55)
ellipse((183,77,184.5,79),(39,32,24),.65)
line('M 176 70 Q 181 69 185 72',(66,53,39),1,.8)
line('M 180 72 Q 183 72 185 73.5',(176,129,86),.5,.7)
# Nose, upper lip and soft age lines.
line('M 186 78 C 185 83 188 87 191 87',(207,152,100),.6,.7)
line('M 190 89 Q 192 90 194 88',(81,53,34),.6,.75)
line('M 183 96 Q 187 96.5 191 96',(87,48,34),.7,.75)
line('M 184 97.2 Q 187 99 189 98',(182,126,90),.6,.65)
line('M 179 87 Q 176 93 178 97',(101,72,49),.4,.32)
line('M 180 91 Q 182 94 184 94',(201,143,94),.4,.3)
line('M 164 98 Q 173 105 182 105',(205,146,95),.4,.27)
# Hair mass and strands follow scalp flow, varied grey localized at temple.
hair='M 137 79 C 129 68 134 51 146 44 C 155 37 174 39 182 47 C 188 54 190 65 185 71 C 181 66 179 63 177 58 C 170 65 153 62 151 77 C 149 74 143 70 141 78 L 143 89 C 137 90 134 85 137 79 Z'
hz=g(158,57,25,18,14)+g(139,68,9,15,6)
shade(hair,(43,36,26),hz,.76,.8)
shade('M 134 60 C 118 58 114 77 123 88 C 129 95 138 91 141 84 C 145 73 142 65 134 60 Z',(39,35,28),g(129,77,11,15,9),.8,.6)
for j in range(30):
    t=j/29;x=136+42*t;y=59-17*math.sin(t*math.pi)
    line(f'M {x:.2f} {y+5:.2f} Q {145+20*t:.2f} {y-10:.2f} {176+7*t:.2f} {58+9*t:.2f}',(101+int(t*20),87+int(t*17),63+int(t*12)),.25,.18+.28*t)
for j in range(12):
    x=138+j*.72
    line(f'M {x} {62+j*.3} Q {x-2} 69 {146-j*.15} {79+j*.28}',(137,126,99),.3,.45)
# Foreground working arm: articulated elbow, volume-bearing cloth folds.
arm='M 187 131 C 197 129 206 140 212 156 C 215 165 220 176 228 183 C 239 188 253 187 266 189 L 270 203 C 251 211 226 206 214 199 C 201 190 193 176 188 163 C 184 151 179 139 187 131 Z'
az=g(200,151,11,24,5)+g(214,181,12,15,3)+g(242,197,29,8,2.8)+g(213,183,9,2,1)-g(215,187,11,2,.65)+g(244,195,26,1.5,.55)
shade(arm,(116,109,82),az,.95,1.1)
line('M 191 146 Q 199 163 207 168',(173,158,113),.7,.45)
line('M 213 188 Q 222 196 230 193',(44,46,35),1,.5)
line('M 229 196 Q 246 193 261 195',(174,157,110),.7,.5)
shade('M 256 187 Q 263 188 269 189 L 273 204 Q 264 210 257 205 Z',(152,140,102),g(264,198,6,11,2)+np.sin(Y*1.1)*.24,.9,.8)
# Main counter: finite surface, edge depth and subtle anisotropic grain.
wood('M 0 273 L 271 217 L 400 225 L 400 300 L 0 300 Z',(91,59,29),.06,.58)
for n in range(37):
    y=268+n*1.7
    line(f'M 0 {y} C 123 {y-22} 252 {y-40} 400 {y-36}',(139,100,51),.35,.1)
line('M 0 273 L 271 217 L 400 225',(185,138,72),1,.7)
# Supporting left hand against the table; palm/fingers are individually curved.
shade('M 119 246 C 123 244 127 245 131 249 L 143 252 C 146 253 147 256 144 257 L 135 255 C 140 258 147 259 145 262 C 143 264 137 260 133 259 C 136 263 142 265 139 267 C 137 269 132 264 128 262 C 130 266 134 269 131 270 C 128 270 122 262 119 259 C 116 254 116 249 119 246 Z',(147,105,73),g(127,252,9,8,5)+g(136,257,10,4,2),.9,.6)
# Glass and foreground tea service; ceramic and amber are distinct from wood.
glass(291,207,1.12)
glass(345,246,1.28)
# Serving hand overlaps rim with thumb/index pinch; no fist/mitten symbol.
hand='M 268 190 C 274 189 279 190 284 191 C 288 191 291 194 293 197 L 297 204 C 299 207 297 209 295 207 L 290 200 C 287 198 285 198 283 197 C 286 202 290 204 291 207 C 292 210 289 212 287 209 L 282 204 C 281 208 284 210 283 212 C 281 214 276 210 274 207 C 270 209 266 205 266 202 Z'
hz=g(277,199,10,7,4)+g(290,201,6,5,2)-g(284,203,3,4,1.4)
shade(hand,(163,118,79),hz,.87,.7)
line('M 285 194 Q 289 195 291 198',(225,171,110),.5,.5)
line('M 273 197 Q 278 202 281 202',(102,70,47),.4,.5)
line('M 289 206 Q 290 208 289 209',(193,147,106),.7,.6)
# Stirring spoon on table, follows plane perspective.
line('M 317 270 L 281 278',(20,17,12),2,.6,1)
line('M 317 268 L 281 276',(166,159,126),1.5)
ellipse((276,274,285,278),(102,106,85));line('M 278 274.8 L 284 275.4',(236,220,162),.5,.8)
# Extremely restrained tea steam; original splines, not smoke particles.
for offset in [0,2.5]:
    line(f'M {291+offset} 204 C {286+offset} 194 {297+offset} 186 {290+offset} 176 C {287+offset} 173 {287+offset} 170 {290+offset} 164',(178,163,130),.65,.14,.8)
# Film response and lens falloff preserve detail; no imported grain/texture.
vignette=np.clip(1-.25*(((X-222)/270)**2+((Y-153)/200)**2),.55,1)
canvas*=vignette[:,:,None]
canvas=np.clip(canvas+(noise*.6)[:,:,None],0,255).astype(np.uint8)
image=Image.fromarray(canvas,'RGB')
OUT.mkdir(parents=True,exist_ok=True)
# Full-size master stays reproducible and local; do not ship large studies.
image.save(OUT/'RCN-001-study-master.png',optimize=True)
for width in [400,160]:
    resized=image.resize((width,round(width*.75)),Image.Resampling.LANCZOS)
    resized.save(OUT/f'RCN-001-study-{width}.webp',quality=91,method=6)
    resized.save(OUT/f'RCN-001-study-{width}.png',optimize=True)
metrics={'cardId':'RCN-001','name':'Çaycı','status':'REJECTED_REALISM_NOT_PRODUCTION','source':'original Bezier masks + analytic relief lighting + deterministic procedural material fields','inputs':['Python source only'],'sourceSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'iterations':2,'externalInputs':0,'imagegen':False,'runtimeChanges':False,'seed':100104,'masterSize':[W,H],'elapsedSeconds':round(time.perf_counter()-start,3),'outputs':[]}
for p in sorted(OUT.glob('RCN-*.webp')):
    metrics['outputs'].append({'path':p.name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
(OUT/'metrics.json').write_text(json.dumps(metrics,indent=2)+'\n')
print(json.dumps(metrics,indent=2))
