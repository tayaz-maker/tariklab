"""Independent mathematical scene; NumPy ray intersections, no renderer/asset imports.

One primary ray per pixel, deterministic area-light shadow samples, one specular
reflection. This is a bounded ray-tracing feasibility proof, not a path tracer
convergence/production-quality claim. All dimensions are authored in metres.
"""
from pathlib import Path
import argparse, hashlib, json, math, resource, time
import numpy as np
from PIL import Image

F = np.float32
START = time.perf_counter()
DEADLINE = START + 175
COUNTERS = {'trace_calls': 0, 'sdf_evaluated_points': 0}

def norm(a):
    return a / np.maximum(np.linalg.norm(a, axis=-1, keepdims=True), 1e-8)

def box(p, c, b, radius=0):
    q = np.abs(p - np.array(c, dtype=F)) - np.array(b, dtype=F)
    return np.linalg.norm(np.maximum(q, 0), axis=1) + np.minimum(np.max(q, axis=1), 0) - radius

def bag_field(p, material=False):
    COUNTERS['sdf_evaluated_points'] += len(p)
    x, y, z = p.T
    q = p.copy()
    # Authored cloth deformation changes the actual ray-intersected surface.
    q[:,0] -= .008*np.sin(11*y + 3*z) + .008*np.sin(7*y)*np.sin(12*z)
    q[:,2] -= (.010*np.sin(23*x + 3*y) + .005*np.sin(43*x - 8*y)) * np.sin(np.clip(y/.86,0,1)*math.pi)
    q[:,1] += .023*(1-(x/.66)**2)*np.exp(-((y-.83)/.15)**2)
    d = box(q, (0,.447,0), (.55,.345,.16), .071)
    m = np.full(len(p), 3, dtype=np.int8)
    def add(nd, nm):
        nonlocal d,m
        take=nd<d
        d=np.minimum(d,nd)
        if material: m[take]=nm
    # The front pocket and side gusset are volumes, not projected decals.
    pq=p.copy(); pq[:,2]-=.006*np.sin(32*x)*np.sin(12*y)
    add(box(pq,(0,.405,.233),(.379,.230,.008),.031),3)
    add(box(p,(.587,.42,-.005),(.014,.242,.133),.018),3)
    # Raised pocket seam with a rounded rectangular cross-section.
    rim=np.abs(box(p[:,:2],(0,.405),(.378,.230),.030))-.0038
    add(np.maximum(rim,np.abs(z-.267)-.004),4)
    # Two leather carrying straps pass in front of the pocket.
    for sx in [-.446,.446]:
        add(box(p,(sx,.458,.267),(.030,.330,.005),.005),4)
        # Hollow matte-metal buckle, distinct inner aperture.
        outer=box(p,(sx,.643,.287),(.043,.037,.007),.005)
        inner=box(p,(sx,.643,.287),(.031,.025,.024),.002)
        add(np.maximum(outer,-inner),5)
        add(box(p,(sx,.643,.299),(.032,.002,.002),.001),5)
    # Bent leather handles have real thickness and empty negative space.
    for hz in [-.143,.143]:
        r=np.sqrt((x/.286)**2+((y-.867)/.322)**2)
        ring=np.abs(r-1)*.270-.020
        handle=np.maximum(np.maximum(ring,np.abs(z-hz)-.013),.821-y)
        add(handle,4)
    add(box(p,(0,.844,0),(.447,.009,.008),.009),4)
    return (d,m) if material else d

def slab(origin, direction, lo, hi):
    inverse=np.divide(1,direction,out=np.full_like(direction,1e15),where=np.abs(direction)>1e-10)
    a=(np.asarray(lo,dtype=F)-origin)*inverse
    b=(np.asarray(hi,dtype=F)-origin)*inverse
    return np.max(np.minimum(a,b),axis=1),np.min(np.maximum(a,b),axis=1)

PAPERS=[((-.825,.015,.285),(.275,.009,.187),-.19),((-.798,.036,.277),(.256,.010,.176),-.13),((-.830,.057,.296),(.255,.006,.174),-.08)]

def trace(origin,direction,limit=None,need_normal=True):
    if time.perf_counter()>DEADLINE: raise TimeoutError('Single-render wall-clock budget exceeded')
    COUNTERS['trace_calls']+=1
    n=len(origin); distance=np.full(n,1e6,dtype=F); ids=np.full(n,-1,dtype=np.int8)
    normals=np.zeros((n,3),dtype=F)
    for axis,value,mat,normal in [(1,0,1,(0,1,0)),(2,-1.48,0,(0,0,1))]:
        t=np.divide(value-origin[:,axis],direction[:,axis],out=np.full(n,1e6,dtype=F),where=np.abs(direction[:,axis])>1e-8)
        take=(t>.0006)&(t<distance)
        distance[take]=t[take];ids[take]=mat;normals[take]=normal
    # Three blank envelopes: independent rotated slab intersections.
    for center,half,angle in PAPERS:
        c,s=math.cos(angle),math.sin(angle)
        rot=np.array([[c,0,-s],[0,1,0],[s,0,c]],dtype=F)
        ro=(origin-np.array(center,dtype=F))@rot.T; rd=direction@rot.T
        near,far=slab(ro,rd,-np.array(half,dtype=F),half)
        take=(near>.0006)&(far>=near)&(near<distance)
        if np.any(take):
            lp=ro[take]+rd[take]*near[take,None]
            face=np.argmax(np.abs(lp)/np.array(half),axis=1)
            nn=np.zeros_like(lp);nn[np.arange(len(lp)),face]=np.sign(lp[np.arange(len(lp)),face])
            normals[take]=nn@rot;distance[take]=near[take];ids[take]=2
    near,far=slab(origin,direction,(-.70,.015,-.34),(.70,1.22,.34))
    far=np.minimum(far,distance)
    if limit is not None: far=np.minimum(far,limit)
    active=np.flatnonzero((far>=np.maximum(near,.0008))&(far>0))
    t=np.maximum(near[active],.001)
    for _ in range(100):
        if not len(active): break
        p=origin[active]+direction[active]*t[:,None]
        d=bag_field(p)
        hit=d<.00045
        if np.any(hit):
            at=active[hit];hp=p[hit]
            distance[at]=t[hit];ids[at]=bag_field(hp,True)[1]
            if need_normal:
                grad=[]
                for ax in range(3):
                    eps=np.zeros(3,dtype=F);eps[ax]=.0005
                    grad.append(bag_field(hp+eps)-bag_field(hp-eps))
                normals[at]=norm(np.array(grad,dtype=F).T)
        t=t+np.maximum(d*.73,.00015)
        keep=(~hit)&(t<far[active])
        active=active[keep];t=t[keep]
    return distance,ids,normals

def material(p,ids,n):
    x,y,z=p.T;colors=np.zeros_like(p);rough=np.full(len(p),.85,dtype=F)
    weave=(np.sin(x*1600)*np.sin(y*1690)+np.sin(y*390+np.sin(x*47)))*.5
    mottled=np.sin(x*67+np.sin(y*42))*np.sin(y*61+z*21)
    for mat,base in [(0,(.59,.57,.47)),(1,(.31,.147,.065)),(2,(.74,.70,.57)),(3,(.17,.22,.108)),(4,(.062,.034,.018)),(5,(.39,.30,.13))]:
        colors[ids==mat]=base
    cloth=ids==3
    colors[cloth]*=(1+.095*weave[cloth]+.065*mottled[cloth])[:,None]
    # Micro-weave perturbs shading normal only; macro folds above are geometry.
    n[cloth,0]+=.055*np.cos(x[cloth]*1250)*np.sin(y[cloth]*1400)
    n[cloth,1]+=.045*np.cos(y[cloth]*1400)*np.sin(x[cloth]*1250)
    wood=ids==1
    grain=np.sin(z*235+3*np.sin(x*1.8)+1.4*np.sin(z*20+x*2))
    bands=np.sin(z*900+np.sin(x*4))
    colors[wood]*=(1+.10*grain[wood]+.025*bands[wood])[:,None]
    plank=np.minimum(np.mod(z+.91,.29),.29-np.mod(z+.91,.29))
    colors[wood&(plank<.002)]*=.34
    # A subtle varnish reflection is traced, not an overlaid silhouette.
    rough[wood]=.32; rough[ids==4]=.5; rough[ids==5]=.25
    paper=ids==2
    colors[paper]*=(1+.018*np.sin(x[paper]*760)*np.sin(z[paper]*910))[:,None]
    # Envelope folds, with blank paper and no markings or symbols.
    for center,half,angle in PAPERS:
        c,s=math.cos(angle),math.sin(angle)
        lx=(x-center[0])*c-(z-center[2])*s;lz=(x-center[0])*s+(z-center[2])*c
        fold=np.abs(np.abs(lx)*.57+lz-.07)<.0017
        top=paper&(np.abs(y-(center[1]+half[1]))<.0015)
        colors[top&fold]*=.79
    colors[ids==4]*=(1+.025*np.sin(x[ids==4]*850+y[ids==4]*370))[:,None]
    return np.clip(colors,0,1),rough,norm(n)

LIGHT=np.array([-1.65,2.75,1.10],dtype=F)
LIGHT_COLOR=np.array([1.0,.86,.67],dtype=F)

def shade(origin,direction,t,ids,n,light_samples=8):
    p=origin+direction*t[:,None]
    base,rough,n=material(p,ids,n.copy())
    result=base*np.array([.092,.104,.115],dtype=F)*(0.45+.55*np.maximum(n[:,1],0))[:,None]
    view=-direction
    for i in range(light_samples):
        # Stratified positions on one large window-like area emitter.
        u=((i%4)+.5)/4-.5; v=((i//4)+.5)/2-.5
        light=LIGHT+np.array([u*.65,v*1.0,u*.38],dtype=F)
        to=light-p;dist=np.linalg.norm(to,axis=1);ld=to/dist[:,None]
        lam=np.maximum(np.sum(n*ld,axis=1),0)
        eligible=lam>0
        vis=np.zeros(len(p),dtype=F)
        if np.any(eligible):
            st,_,_=trace(p[eligible]+n[eligible]*.0015,ld[eligible],dist[eligible]-.004,False)
            vis[eligible]=st>dist[eligible]-.005
        h=norm(ld+view);ndh=np.maximum(np.sum(n*h,axis=1),0);ndv=np.maximum(np.sum(n*view,axis=1),.001)
        alpha=rough*rough; alpha2=alpha*alpha
        ggx=alpha2/(math.pi*((ndh*ndh)*(alpha2-1)+1)**2+1e-6)
        k=(rough+1)**2/8
        g=(lam/(lam*(1-k)+k))*(ndv/(ndv*(1-k)+k))
        fres=.04+.96*(1-np.clip(np.sum(view*h,axis=1),0,1))**5
        spec=(ggx*g*fres/(4*ndv*np.maximum(lam,.001)+1e-5))
        spec[ids==5]*=4.5
        illumination=21.0/(dist*dist)
        result+=(base/math.pi+spec[:,None])*LIGHT_COLOR*(vis*lam*illumination/light_samples)[:,None]
    result[ids<0]=np.array([.16,.17,.16])
    return result,p,n

def run(width,height,out):
    yy,xx=np.mgrid[0:height,0:width]
    camera=np.array([1.70,1.18,2.72],dtype=F);target=np.array([-.035,.56,.0],dtype=F)
    forward=norm(target-camera);right=norm(np.cross(forward,[0,1,0]));up=np.cross(right,forward)
    sensor=.70
    px=((xx.ravel()+.5)/width-.5)*sensor*width/height
    py=(.5-(yy.ravel()+.5)/height)*sensor
    direction=norm(forward+right*px[:,None]+up*py[:,None]).astype(F)
    origin=np.broadcast_to(camera,direction.shape).copy()
    trace_start=time.perf_counter();t,ids,n=trace(origin,direction)
    color,p,n=shade(origin,direction,t,ids,n)
    # One measured geometrical reflection from varnished timber and hardware.
    reflective=(ids==1)|(ids==5)
    rn=n[reflective];rd=direction[reflective]-2*np.sum(direction[reflective]*rn,axis=1)[:,None]*rn
    rp=p[reflective]+rn*.002
    rt,ri,rnormal=trace(rp,rd)
    rc,_,_=shade(rp,rd,rt,ri,rnormal,4)
    fres=.035+.965*(1-np.clip(-np.sum(direction[reflective]*rn,axis=1),0,1))**5
    amount=np.minimum(fres,.24)
    color[reflective]=color[reflective]*(1-amount[:,None])+rc*amount[:,None]
    # Filmic response is applied to computed radiance, no painted highlights.
    color=np.maximum(color*1.16,0)
    color=(color*(2.51*color+.03))/(color*(2.43*color+.59)+.14)
    rgb=np.uint8(np.clip(color,0,1)**(1/2.2)*255).reshape(height,width,3)
    out.mkdir(parents=True,exist_ok=True)
    path=out/'SND-011-cpu-raytrace.png';Image.fromarray(rgb).save(path,optimize=True)
    canonical=out/'SND-011-canonical-576.png'
    Image.fromarray(rgb).resize((576,384),Image.Resampling.LANCZOS).save(canonical,optimize=True)
    elapsed=time.perf_counter()-START
    metrics={'status':'CANDIDATE_ONLY_ROOT_REVIEW_REQUIRED','acceptedCards':0,'width':width,'height':height,'primarySamplesPerPixel':1,'directAreaShadowSamples':8,'reflectionAreaShadowSamples':4,'specularBounces':1,'notClaimed':['converged path tracing','physical GPU','anatomy','production acceptance'],'seconds':round(elapsed,3),'raytracingSeconds':round(time.perf_counter()-trace_start,3),'maxRssKiB':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,'counters':COUNTERS,'files':[]}
    for file in [path,canonical]:
        metrics['files'].append({'name':file.name,'bytes':file.stat().st_size,'sha256':hashlib.sha256(file.read_bytes()).hexdigest()})
    print(json.dumps(metrics,indent=2));(out/'render-measurement.json').write_text(json.dumps(metrics,indent=2)+'\n')

if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--width',type=int,default=864);ap.add_argument('--height',type=int,default=576);ap.add_argument('--out',type=Path,required=True);args=ap.parse_args()
    run(args.width,args.height,args.out)
