"""Original authored implicit surfaces -> CPU mesh -> shaded SVG triangles.
Internal experiment; no image plates, tracing, external assets or runtime library.
All coordinates below are authored for this experiment, not anatomical scans.
"""
from pathlib import Path
import time,json,gzip,hashlib,math
import numpy as np
import vtk
from vtk.util.numpy_support import numpy_to_vtk,vtk_to_numpy
ROOT=Path(__file__).resolve().parent
START=time.perf_counter();meshes=[]

def sm(a,b,k=.05):
 h=np.maximum(k-np.abs(a-b),0)/k
 return np.minimum(a,b)-h*h*k*.25

def ell(x,y,z,c,r):
 q=np.stack(np.broadcast_arrays((x-c[0])/r[0],(y-c[1])/r[1],(z-c[2])/r[2]),-1)
 return (np.sqrt((q*q).sum(-1))-1)*min(r)

def cap(x,y,z,a,b,r):
 q=np.stack(np.broadcast_arrays(x-a[0],y-a[1],z-a[2]),-1);ba=np.array(b)-a
 h=np.clip((q*ba).sum(-1)/(ba@ba),0,1)
 return np.linalg.norm(q-h[...,None]*ba,axis=-1)-r

def head_field(x,y,z):
 # Authored continuous volumes, cheek/jaw joins; eye and mouth recesses are subtraction.
 d=ell(x,y,z,(-.48,2.02,.05),(.39,.55,.35))
 for c,r,k in [((-.48,1.67,.18),(.27,.27,.31),.11),((-.72,1.85,.22),(.19,.18,.19),.07),((-.24,1.85,.22),(.19,.18,.19),.07),((-.48,1.5,.12),(.20,.18,.24),.06),((-.48,1.22,.02),(.18,.32,.18),.07),((-.48,1.99,.38),(.064,.19,.10),.035),((-.48,1.86,.48),(.10,.073,.072),.04),((-.54,1.845,.428),(.06,.045,.065),.015),((-.42,1.845,.428),(.06,.045,.065),.015),((-.48,1.70,.408),(.143,.027,.042),.015),((-.48,1.653,.411),(.128,.028,.038),.015),((-.86,1.94,.04),(.055,.12,.078),.022),((-.10,1.94,.04),(.055,.12,.078),.022)]:
  d=sm(d,ell(x,y,z,c,r),k)
 for ex in [-.64,-.32]:
  d=np.maximum(d,-ell(x,y,z,(ex,2.056,.35),(.112,.058,.055)))
 d=np.maximum(d,-ell(x,y,z,(-.48,1.679,.440),(.112,.008,.025)))
 return d

# Four fingers with distinct authored kinematic joint chains; tips meet one plane.
FINGERS=[
 {'name':'index','r':.035,'joints':[(.74,.76,.77),(.81,.845,.78),(.92,.88,.745),(1.015,.855,.729)]},
 {'name':'middle','r':.036,'joints':[(.69,.73,.78),(.78,.79,.83),(.91,.81,.775),(1.020,.785,.730)]},
 {'name':'ring','r':.034,'joints':[(.66,.695,.77),(.74,.73,.83),(.865,.742,.78),(.97,.724,.728)]},
 {'name':'little','r':.029,'joints':[(.64,.66,.74),(.70,.66,.82),(.805,.665,.78),(.89,.663,.724)]},
 {'name':'thumb','r':.042,'joints':[(.75,.62,.71),(.84,.68,.66),(.94,.755,.638),(1.015,.805,.652)]},
]
PAPER_FRONT=.694;PAPER_BACK=.610

def hand_field(x,y,z):
 d=ell(x,y,z,(.665,.685,.744),(.125,.126,.075))
 d=sm(d,cap(x,y,z,(.40,.56,.67),(.59,.665,.735),.091),.05)
 for finger in FINGERS:
  for a,b in zip(finger['joints'],finger['joints'][1:]):d=sm(d,cap(x,y,z,a,b,finger['r']),.017)
 return d

def surface(name,field,bounds,res,target,color):
 t=time.perf_counter();lo=np.array(bounds[::2]);hi=np.array(bounds[1::2]);dims=np.array(res)
 xx,yy,zz=np.meshgrid(*[np.linspace(lo[i],hi[i],dims[i]) for i in range(3)],indexing='ij')
 values=field(xx,yy,zz).astype('float32')
 im=vtk.vtkImageData();im.SetDimensions(*dims.tolist());im.SetOrigin(*lo.tolist());im.SetSpacing(*((hi-lo)/(dims-1)).tolist());im.GetPointData().SetScalars(numpy_to_vtk(values.ravel(order='F'),deep=True))
 iso=vtk.vtkFlyingEdges3D();iso.SetInputData(im);iso.SetValue(0,0);iso.Update()
 dec=vtk.vtkQuadricDecimation();dec.SetInputData(iso.GetOutput());dec.SetTargetReduction(max(0,1-target/max(1,iso.GetOutput().GetNumberOfCells())));dec.Update()
 norm=vtk.vtkPolyDataNormals();norm.SetInputData(dec.GetOutput());norm.ComputePointNormalsOn();norm.SplittingOff();norm.ConsistencyOn();norm.AutoOrientNormalsOn();norm.Update();poly=norm.GetOutput()
 pts=vtk_to_numpy(poly.GetPoints().GetData()).copy();tri=vtk_to_numpy(poly.GetPolys().GetData()).reshape(-1,4)[:,1:].copy();norms=vtk_to_numpy(poly.GetPointData().GetNormals()).copy()
 meshes.append({'name':name,'points':pts,'tri':tri,'normals':norms,'color':np.array(color),'generationSeconds':time.perf_counter()-t,'rawTriangles':iso.GetOutput().GetNumberOfCells()})

surface('authored-continuous-adult-head',head_field,[-1.0,.04,.85,2.66,-.40,.63],[89,129,85],4200,[.57,.39,.28])
surface('authored-articulated-paper-contact-hand',hand_field,[.23,1.14,.38,1.01,.52,.99],[102,91,77],2300,[.60,.42,.29])
# Eyeballs are independent anatomical surfaces seated in the eye recesses, not painted circle icons.
for ex in [-.64,-.32]:
 surface('sclera',lambda x,y,z,ex=ex:ell(x,y,z,(ex,2.055,.346),(.088,.040,.046)),[ex-.092,ex+.092,2.009,2.102,.293,.399],[25,19,20],150,[.56,.53,.44])
 surface('iris',lambda x,y,z,ex=ex:ell(x,y,z,(ex+.010,2.055,.387),(.021,.026,.008)),[ex-.018,ex+.038,2.022,2.089,.375,.400],[18,18,10],90,[.10,.11,.085])
# Original continuous hair cap: upper/back shell. No per-person stock mesh.
def hair_field(x,y,z):
 outer=ell(x,y,z,(-.49,2.10,.002),(.407,.49,.37))
 opening=np.maximum(2.18-y,z-.15)
 capfield=np.maximum(outer,-opening)
 bun=ell(x,y,z,(-.63,2.21,-.35),(.17,.16,.17))
 return sm(capfield,bun,.03)
surface('hair-cap',hair_field,[-.93,-.045,1.92,2.66,-.56,.40],[65,58,62],700,[.20,.205,.20])
# Civilian shirt and forearm carry the experimental head and contact hand in a coherent space.
def jacket(x,y,z):
 d=ell(x,y,z,(-.50,.69,-.04),(.59,.57,.29))
 for a,b,r in [((-.13,.84,.015),(.03,.57,.33),.16),((.03,.57,.33),(.43,.57,.67),.11),((-.91,.87,-.005),(-1.00,.31,.15),.15)]:d=sm(d,cap(x,y,z,a,b,r),.09)
 return d
surface('civilian-knit-garment',jacket,[-1.22,.52,.04,1.29,-.43,.88],[70,67,71],1800,[.095,.125,.135])

# Paper is a rigid slab to make front/back contact distances auditable.
def box(name,lo,hi,color):
 p=np.array([[x,y,z]for x in [lo[0],hi[0]]for y in [lo[1],hi[1]]for z in [lo[2],hi[2]]],float)
 f=np.array([[0,2,6],[0,6,4],[1,5,7],[1,7,3],[0,4,5],[0,5,1],[2,3,7],[2,7,6],[0,1,3],[0,3,2],[4,6,7],[4,7,5]])
 n=np.zeros_like(p)
 for ids in f:
  v=np.cross(p[ids[1]]-p[ids[0]],p[ids[2]]-p[ids[0]]);v/=np.linalg.norm(v);n[ids]+=v
 n/=np.linalg.norm(n,axis=1)[:,None]
 meshes.append({'name':name,'points':p,'tri':f,'normals':n,'color':np.array(color),'generationSeconds':0,'rawTriangles':12})
box('unmarked-paper-folio',[.92,.52,PAPER_BACK],[1.58,1.28,PAPER_FRONT],[.72,.65,.49])
box('desk',[-1.7,.0,-.3],[1.9,.12,1.12],[.16,.095,.055])
for i in range(5):box('blank-archive-volume',[-1.50+i*.145,.20,-.21],[-1.365+i*.145,.83,-.04],[.12+i*.008,.14,.14])
# No raster renderer: CPU projection and per-triangle Lambert/specular vertex averages.
EYE=np.array([3.2,2.50,6.3]);TARGET=np.array([-.13,1.35,.15]);F=(TARGET-EYE);F/=np.linalg.norm(F);R=np.cross(F,[0,1,0]);R/=np.linalg.norm(R);U=np.cross(R,F)
LIGHT=np.array([1.8,3.7,3.2]);W,H=800,1120;focal=1450
allfaces=[]
for mesh in meshes:
 pts=mesh['points'];rel=pts-EYE;cx=rel@R;cy=rel@U;cz=rel@F
 xy=np.column_stack([W/2+focal*cx/cz,H/2-focal*cy/cz])
 light=LIGHT-pts;light/=np.linalg.norm(light,axis=1)[:,None]
 view=EYE-pts;view/=np.linalg.norm(view,axis=1)[:,None]
 normal=mesh['normals'];diff=np.clip((normal*light).sum(1),0,1)
 halfv=light+view;halfv/=np.linalg.norm(halfv,axis=1)[:,None]
 spec=np.maximum(0,(normal*halfv).sum(1))**32
 lit=mesh['color'][None,:]*(.18+.91*diff[:,None])+spec[:,None]*.07
 lit=np.clip(lit,0,1)**(1/1.6)
 for tri in mesh['tri']:
  tri3=pts[tri];fn=np.cross(tri3[1]-tri3[0],tri3[2]-tri3[0]);toward=EYE-tri3.mean(0)
  if fn@toward<=0:continue
  rgb=np.clip(np.round(lit[tri].mean(0)*255),0,255).astype(int)
  coords=xy[tri];allfaces.append((float(cz[tri].mean()),coords,'#'+''.join(f'{c:02x}'for c in rgb)))
allfaces.sort(key=lambda x:-x[0])
svg=[f'<svg xmlns="http://www.w3.org/2000/svg" width="400" height="560" viewBox="0 0 {W} {H}" role="img" aria-label="Original authored geometry experiment; not accepted art">',f'<path d="M0 0H{W}V{H}H0Z" fill="#10171c"/>']
for _,pts,color in allfaces:
 svg.append('<path d="M'+'L'.join(f'{p[0]:.2f} {p[1]:.2f}'for p in pts)+'Z" fill="'+color+'"/>')
svg.append('</svg>');data='\n'.join(svg).encode();(ROOT/'geometry-export.svg').write_bytes(data)
contacts=[]
for f in FINGERS:
 tip=np.array(f['joints'][-1]);side='back'if f['name']=='thumb'else'front'
 surface_z=tip[2]+f['r'] if side=='back' else tip[2]-f['r'];plane=PAPER_BACK if side=='back' else PAPER_FRONT
 contacts.append({'finger':f['name'],'intendedPaperSide':side,'tipJoint':tip.tolist(),'radius':f['r'],'signedSurfaceDistanceToPlane':float(surface_z-plane),'absoluteSurfaceDistanceToPlane':abs(float(surface_z-plane)),'insidePaperXY':bool(.92<=tip[0]<=1.58 and .52<=tip[1]<=1.28)})
metrics={'status':'EXPERIMENT_ONLY_UNREVIEWED','method':'Original implicit continuous surfaces + articulated capsule-chain hand; VTK CPU marching surface/decimation; custom camera/light CPU SVG triangle projection','noImportedOrGeneratedArt':True,'rawBytes':len(data),'gzipBytes':len(gzip.compress(data,mtime=0)),'svgPathCount':len(allfaces)+1,'sha256':hashlib.sha256(data).hexdigest(),'meshVertices':sum(len(m['points'])for m in meshes),'meshTriangles':sum(len(m['tri'])for m in meshes),'generationAndExportSeconds':time.perf_counter()-START,'meshes':[{'name':m['name'],'vertices':len(m['points']),'triangles':len(m['tri']),'rawTriangles':m['rawTriangles'],'seconds':m['generationSeconds']}for m in meshes],'contacts':contacts,'camera':{'eye':EYE.tolist(),'target':TARGET.tolist(),'focalPixels':focal},'light':{'position':LIGHT.tolist(),'kind':'single point key plus constant ambient approximation','shadows':'not ray-traced; occlusion uses face-depth sorting'},'knownLimitations':['Authored proportions not expert anatomical validation','Depth-average painter sorting can fail at intersecting meshes','No true cast-shadow/subsurface/microfabric solution','Contact distances are simplified capsule endpoints, not exact remeshed skin contact','No approved art or browser viewport result'],'productionEligibility':False,'acceptedArt':0}
(ROOT/'metrics.json').write_text(json.dumps(metrics,indent=2)+'\n')
print(json.dumps({k:metrics[k]for k in ['rawBytes','gzipBytes','svgPathCount','meshVertices','meshTriangles','generationAndExportSeconds']}))
print(json.dumps(contacts))
