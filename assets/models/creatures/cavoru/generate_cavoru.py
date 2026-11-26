#!/usr/bin/env python3
"""WILDHAVEN | Cavoru 3D original procedural generator v0.1
Pure NumPy, glTF 2.0 GLB with 27 real skeletal animation clips, two habitats × two LODs.
Coordinates: meters; Y-up; face toward negative Z. Does not include game AI.
"""
from __future__ import annotations
import json,math,random,hashlib,struct
from pathlib import Path
from collections import defaultdict
import numpy as np
HERE=Path(__file__).resolve().parent
V=lambda *x: np.array(x,dtype=np.float64)
LOD=0; REGION='forest'; SZ=np.ones(3)
COLORS={
'forest':{
'coat':(.345,.269,.171),'belly':(.63,.54,.385),'dorsal':(.215,.194,.125),
'shoulder':(.332,.276,.174),'hip':(.366,.29,.19),'throat':(.58,.474,.320),
'face':(.55,.406,.26),'muzzle':(.64,.50,.345),'snout_bridge':(.43,.327,.231),
'shovel':(.265,.239,.196),'shovel_highlight':(.46,.386,.304),'nostril':(.065,.052,.041),
'mouth':(.116,.079,.063),'jaw':(.46,.338,.243),'eye_rim':(.205,.15,.10),'eye':(.78,.512,.142),
'pupil':(.035,.026,.023),'glint':(.975,.84,.55),'ear':(.447,.322,.204),
'ear_inner':(.608,.394,.324),'ear_edge':(.268,.204,.140),'fur':(.204,.194,.124),
'fur_gold':(.525,.374,.211),'stripe':(.735,.671,.467),'stripe_dark':(.415,.347,.23),
'paw':(.292,.225,.15),'toe':(.404,.306,.215),'claw':(.68,.596,.445),
'brush':(.272,.220,.155),'brush_light':(.51,.403,.265),'tail':(.345,.274,.170),
'whisker':(.79,.732,.61),'brow':(.390,.298,.197)
},
'plains':{
'coat':(.660,.348,.158),'belly':(.81,.659,.438),'dorsal':(.499,.247,.123),
'shoulder':(.68,.372,.193),'hip':(.647,.345,.169),'throat':(.773,.56,.343),
'face':(.755,.476,.260),'muzzle':(.865,.631,.425),'snout_bridge':(.628,.370,.201),
'shovel':(.383,.248,.177),'shovel_highlight':(.596,.425,.301),'nostril':(.092,.053,.035),
'mouth':(.167,.084,.051),'jaw':(.63,.382,.230),'eye_rim':(.292,.169,.095),'eye':(.860,.575,.182),
'pupil':(.039,.026,.020),'glint':(.991,.90,.60),'ear':(.673,.390,.211),
'ear_inner':(.791,.496,.343),'ear_edge':(.468,.254,.135),'fur':(.49,.240,.121),
'fur_gold':(.83,.53,.294),'stripe':(.81,.59,.335),'stripe_dark':(.496,.242,.105),
'paw':(.469,.279,.150),'toe':(.58,.365,.205),'claw':(.82,.704,.50),
'brush':(.439,.215,.117),'brush_light':(.70,.387,.177),'tail':(.63,.33,.166),
'whisker':(.88,.76,.61),'brow':(.575,.320,.171)
}}
# Keep identical 24-joint rig naming across regional variants.
BONES=[('Root',None,(0,0,0)),('Body','Root',(0,.94,0)),('Spine','Body',(0,.07,.10)),
('Neck','Body',(0,-.075,-.67)),('Head','Neck',(0,.055,-.33)),('Jaw','Head',(0,-.115,-.18)),
('Ear_L','Head',(-.208,.175,.085)),('Ear_R','Head',(.208,.175,.085)),
('Crest','Body',(0,.255,-.20)),('Tail_Base','Body',(0,.08,.77)),
('Tail_Mid','Tail_Base',(0,-.05,.22)),('Tail_Tip','Tail_Mid',(0,-.02,.15)),
('ForeUpper_L','Body',(-.365,-.19,-.52)),('ForeLower_L','ForeUpper_L',(0,-.29,-.055)),
('ForePaw_L','ForeLower_L',(0,-.33,-.06)),
('ForeUpper_R','Body',(.365,-.19,-.52)),('ForeLower_R','ForeUpper_R',(0,-.29,-.055)),
('ForePaw_R','ForeLower_R',(0,-.33,-.06)),
('HindUpper_L','Body',(-.36,-.20,.53)),('HindLower_L','HindUpper_L',(0,-.30,.105)),
('HindPaw_L','HindLower_L',(0,-.30,-.03)),
('HindUpper_R','Body',(.36,-.20,.53)),('HindLower_R','HindUpper_R',(0,-.30,.105)),
('HindPaw_R','HindLower_R',(0,-.30,-.03))]
BID={name:i for i,(name,p,o) in enumerate(BONES)}
PARENT={name:p for name,p,o in BONES}
OFF={name:V(*o) for name,p,o in BONES}
REST={};G=defaultdict(lambda:dict(vertices=[],faces=[],joints=[]))
def setup(region,lod):
 global REGION,LOD,SZ,OFF,REST
 REGION=region;LOD=lod
 SZ=V(.99,.94,.925) if region=='forest' else V(1.03,.985,1.055)
 OFF={name:V(*o)*SZ for name,p,o in BONES}
 def pos(name):
  p=V(0,0,0)
  while name is not None:
   p+=OFF[name];name=PARENT[name]
  return p
 REST={name:pos(name) for name,_,_ in BONES}
 G.clear()
def add(bone,mat,v,f):
 if not len(v):return
 g=G[mat];base=len(g['vertices'])
 vv=np.asarray(v,dtype=np.float64).copy()
 g['vertices'].extend((vv*SZ+REST[bone]).tolist())
 g['faces'].extend([[base+x,base+y,base+z] for x,y,z in f]);g['joints'].extend([BID[bone]]*len(v))

def ellipsoid(bone,mat,c,rad,lat=10,lon=16,tilt=0):
 if LOD:lat=max(5,int(lat*.64));lon=max(8,int(lon*.65))
 vertices=[];faces=[]
 rx,ry,rz=rad;cz,sz=math.cos(tilt),math.sin(tilt)
 for i in range(lat+1):
  t=i*math.pi/lat
  for j in range(lon):
   phi=2*math.pi*j/lon
   x=rx*math.sin(t)*math.cos(phi);y=ry*math.cos(t);z=rz*math.sin(t)*math.sin(phi)
   vertices.append((c[0]+cz*x-sz*y,c[1]+sz*x+cz*y,c[2]+z))
 for i in range(lat):
  for j in range(lon):
   a=i*lon+j;b=i*lon+(j+1)%lon;c0=(i+1)*lon+j;d=(i+1)*lon+(j+1)%lon
   faces.extend([(a,b,c0),(b,d,c0)])
 add(bone,mat,vertices,faces)

def tube(bone,mat,points,radii,sides=8):
 if LOD:sides=max(5,int(sides*.68))
 ps=[V(*p) for p in points];vertices=[];faces=[]
 for k,p in enumerate(ps):
  tang=ps[min(k+1,len(ps)-1)]-ps[max(k-1,0)]
  tang=tang/max(1e-10,np.linalg.norm(tang))
  u=np.cross(tang,V(1,0,0))
  if np.linalg.norm(u)<.05:u=np.cross(tang,V(0,0,1))
  u/=max(1e-10,np.linalg.norm(u));w=np.cross(tang,u)
  for j in range(sides):
   ang=2*math.pi*j/sides
   vertices.append(p+radii[k]*(u*math.cos(ang)+w*math.sin(ang)))
 for k in range(len(ps)-1):
  for j in range(sides):
   a=k*sides+j;b=k*sides+(j+1)%sides;c=(k+1)*sides+j;d=(k+1)*sides+(j+1)%sides
   faces.extend([(a,c,b),(b,c,d)])
 for j in range(1,sides-1):
  faces.append((0,j+1,j));off=(len(ps)-1)*sides
  faces.append((off,off+j,off+j+1))
 add(bone,mat,vertices,faces)

def spur(bone,mat,p,d,ln=.11,width=.022):
 u=V(*d);u/=max(1e-10,np.linalg.norm(u));p=V(*p)
 tube(bone,mat,[p,p+u*ln*.44,p+u*ln],[width,width*.55,.0008],5)

def wedge(bone,mat,p0,p1,p2,w=.022):
 # A shaded *angular stripe* on the coat, as actual surface geometry (not an image).
 v0=V(*p0);v1=V(*p1);v2=V(*p2)
 a=V(0,w,0)
 add(bone,mat,[v0,v1-a,v1+a,v2],[(0,1,2),(2,1,3),(2,3,0)])


def loft_z(bone, mat, rings, sides=24, taper=0):
 """Contiguous anatomical loft in cross-sections along the front-to-back axis.
 Each ring: local z, x-radius, y-radius, center-y. No primitive beads.
 """
 if LOD:sides=max(12,int(sides*.65))
 verts=[];faces=[]
 for z,rx,ry,cy in rings:
  for k in range(sides):
   a=2*math.pi*k/sides
   x=rx*math.cos(a);y=cy+ry*math.sin(a)
   # mild shoulder muscle planes rather than perfect cylinder
   if taper: x*=1+0.018*math.cos(3*a+z*2)
   verts.append((x,y,z))
 for ri in range(len(rings)-1):
  for k in range(sides):
   a=ri*sides+k;b=ri*sides+(k+1)%sides;c=(ri+1)*sides+k;d=(ri+1)*sides+(k+1)%sides
   faces.extend([(a,c,b),(b,c,d)])
 # cap with centered end points
 for idx,(z,rx,ry,cy) in [(0,rings[0]),(len(rings)-1,rings[-1])]:
  center=len(verts);verts.append((0,cy,z));start=idx*sides
  for k in range(sides):
   if idx==0:faces.append((center,start+k,start+(k+1)%sides))
   else:faces.append((center,start+(k+1)%sides,start+k))
 add(bone,mat,verts,faces)

def loft_y(bone,mat,rings,sides=15):
 """Continuous tapered limb muscle or forearm with a natural bend, not ball-capsules.
 Each ring: local y, x-radius, z-radius, center-z, center-x.
 """
 if LOD:sides=max(9,int(sides*.68))
 verts=[];faces=[]
 for y,rx,rz,cz,cx in rings:
  for k in range(sides):
   a=2*math.pi*k/sides
   verts.append((cx+rx*math.cos(a),y,cz+rz*math.sin(a)))
 for ri in range(len(rings)-1):
  for k in range(sides):
   a=ri*sides+k;b=ri*sides+(k+1)%sides;c=(ri+1)*sides+k;d=(ri+1)*sides+(k+1)%sides
   faces.extend([(a,b,c),(b,d,c)])
 for idx,(y,rx,rz,cz,cx) in [(0,rings[0]),(len(rings)-1,rings[-1])]:
  center=len(verts);verts.append((cx,y,cz));start=idx*sides
  for k in range(sides):
   if idx==0:faces.append((center,start+(k+1)%sides,start+k))
   else:faces.append((center,start+k,start+(k+1)%sides))
 add(bone,mat,verts,faces)


def leaf_ear(bone,outer,inner,side):
 """Real 3D elongated ear with a closed leaf outline and fleshy inset."""
 def mesh(mat,thin,wscale):
  verts=[];faces=[];N=12;M=10
  for i in range(N+1):
   t=i/N
   y=.00+(.37 if not thin else .29)*t
   w=(.09 if not thin else .065)*wscale*math.sin(math.pi*t)**.77
   z=(-.003 if not thin else -.030)+(-.025*t)
   for j in range(M):
    a=math.tau*j/M
    x=side*.015 + w*math.cos(a)+(side*.020*t)
    dz=z+(.024 if not thin else .006)*math.sin(a)
    verts.append((x,y,dz))
  for i in range(N):
   for j in range(M):
    a=i*M+j;b=i*M+(j+1)%M;c=(i+1)*M+j;d=(i+1)*M+(j+1)%M
    faces.extend([(a,b,c),(b,d,c)])
  add(bone,mat,verts,faces)
 mesh(outer,False,1.)
 mesh(inner,True,.67)

def generate_geometry():
 rng=random.Random(603311 if REGION=='forest' else 603361)
 # Organic shoulder-to-rump loft, a single connected trunk: rounded back and deep midsection.
 rings=[(-.98,.06,.08,.012),(-.91,.27,.23,.010),(-.81,.412,.315,.018),
 (-.66,.491,.355,.02),(-.50,.517,.373,.026),(-.35,.510,.391,.035),
 (-.16,.475,.411,.040),(.06,.46,.413,.044),(.28,.453,.396,.037),
 (.48,.424,.374,.027),(.66,.369,.335,.015),(.81,.272,.248,-.015),
 (.915,.12,.125,-.020),(.94,.045,.06,-.020)]
 loft_z('Body','coat',rings,32,1)
 # Belly and dorsal saddle: very shallow overlays, allowing natural continuous silhouette.
 ellipsoid('Body','belly',(0,-.307,.015),(.36,.115,.665),12,20)
 ellipsoid('Spine','dorsal',(0,.228,-.07),(.318,.075,.675),11,20)
 # Shoulder/hip muscular shading is submerged in body, not floating spherical primitives.
 for side in (-1,1):
  ellipsoid('Body','shoulder',(side*.342,-.087,-.56),(.166,.232,.250),11,17)
  ellipsoid('Body','hip',(side*.325,-.088,.50),(.136,.197,.211),10,16)
 # Short thick neck smoothly tapering forward from the body.
 loft_z('Neck','shoulder',[(.21,.28,.262,.02),(.10,.318,.29,.036),(-.06,.312,.285,.048),
 (-.22,.284,.257,.044),(-.37,.229,.208,.037),(-.49,.176,.148,.019)],24,1)
 ellipsoid('Neck','throat',(0,-.165,-.19),(.208,.139,.300),10,17)
 # Broad forehead tapering toward shovel-shaped snout. Skull points downward to forage.
 loft_z('Head','face',[(.20,.15,.13,.03),(.11,.236,.197,.066),(-.02,.263,.224,.055),
 (-.18,.247,.195,.026),(-.35,.199,.151,-.017),(-.49,.168,.111,-.083),
 (-.61,.163,.086,-.109),(-.66,.123,.052,-.116)],25,1)
 ellipsoid('Head','snout_bridge',(0,.098,-.262),(.164,.045,.245),8,17)
 # Flattened spatulate terminal plate and embossed lip groove: distinct from tapir trunk.
 ellipsoid('Head','muzzle',(0,-.103,-.495),(.177,.096,.142),10,19)
 ellipsoid('Head','shovel',(0,-.142,-.636),(.204,.049,.105),10,20)
 ellipsoid('Head','shovel_highlight',(0,-.113,-.650),(.169,.021,.089),7,18)
 tube('Head','shovel',[(0,-.109,-.678),(0,-.143,-.697),(0,-.166,-.705)],[.121,.131,.111],11)
 ellipsoid('Jaw','jaw',(0,-.025,-.239),(.158,.059,.242),9,19)
 ellipsoid('Head','mouth',(0,-.185,-.566),(.118,.015,.093),5,16)
 for side,label in [(-1,'L'),(1,'R')]:
  # Eyes are small and lateral, not forward predatory eyes.
  ellipsoid('Head','eye_rim',(side*.247,.086,-.105),(.035,.060,.071),10,16)
  ellipsoid('Head','eye',(side*.278,.098,-.119),(.014,.034,.043),9,15)
  ellipsoid('Head','pupil',(side*.290,.101,-.130),(.007,.021,.026),9,13)
  ellipsoid('Head','glint',(side*.294,.112,-.144),(.003,.007,.008),6,10)
  # Wide raised brows and elongated ear leaves, animated at independent pivots.
  ellipsoid('Head','brow',(side*.215,.167,-.078),(.048,.026,.170),8,17,tilt=side*.12)
  leaf_ear('Ear_'+label,'ear','ear_inner',side)
  ellipsoid('Ear_'+label,'ear_edge',(side*.010,.004,.0),(.059,.025,.037),8,12)
  # nostrils on flared forward-facing shovel plate.
  ellipsoid('Head','nostril',(side*.118,-.126,-.707),(.038,.013,.019),8,13)
  for k in range(3):
   tube('Head','whisker',[(side*.155,-.096,-.532),
      (side*(.210+k*.016),-.090+k*.015,-.554),
      (side*(.240+k*.023),-.071+k*.022,-.548)],[.0021,.0013,.0003],5)
 # Four digitigrade-plantigrade legs with broad claws for shallow digging.
 for front in (True,False):
  for side,label in [(-1,'L'),(1,'R')]:
   stem='Fore' if front else 'Hind';upper=stem+'Upper_'+label;lower=stem+'Lower_'+label;paw=stem+'Paw_'+label
   if front:
    loft_y(upper,'shoulder',[(.13,.209,.229,.015,0),(.02,.222,.245,.02,0),
      (-.14,.202,.211,.011,0),(-.27,.169,.178,-.006,0),(-.385,.125,.142,-.034,0)],18)
    loft_y(lower,'coat',[(.09,.138,.147,.008,0),(-.07,.125,.144,-.045,0),
      (-.21,.119,.132,-.074,0),(-.34,.139,.141,-.100,0)],16)
   else:
    loft_y(upper,'hip',[(.14,.200,.234,.021,0),(.01,.212,.235,.016,0),
      (-.12,.197,.225,-.010,0),(-.26,.162,.176,.026,0),(-.385,.115,.130,.066,0)],18)
    loft_y(lower,'coat',[(.09,.126,.133,.018,0),(-.06,.114,.121,.047,0),
      (-.20,.103,.122,.054,0),(-.335,.130,.128,.019,0)],16)
   ellipsoid(paw,'paw',(0,-.058,-.113),(.175,.090,.188),10,17)
   for digit in range(4):
    x=(digit-1.5)*.087
    ellipsoid(paw,'toe',(x,-.097,-.252),(.054,.063,.098),8,12)
    tube(paw,'claw',[(x,-.121,-.315),(x,-.136,-.350),(x,-.145,-.377)],[.018,.013,.0007],7)
 # Short muscular tail and terminal brush; side sway animation.
 tube('Tail_Base','tail',[(0,0,-.01),(0,-.015,.085),(0,-.031,.18),(0,-.048,.28)],[.135,.125,.106,.090],12)
 tube('Tail_Mid','tail',[(0,.011,-.045),(0,-.009,.09),(0,-.023,.20)],[.082,.077,.057],11)
 ellipsoid('Tail_Tip','brush',(0,-.025,.112),(.119,.103,.182),10,19)
 for j in range(45 if LOD==0 else 16):
  a=rng.uniform(0,math.tau);z=rng.uniform(.01,.26)
  rad=.09*math.sqrt(max(.05,1-((z-.13)/.16)**2));x=rad*math.cos(a);y=-.025+rad*math.sin(a)
  spur('Tail_Tip','brush' if j%4 else 'brush_light',(x,y,z),(.35*math.cos(a),.29*math.sin(a),1.),rng.uniform(.032,.09),rng.uniform(.006,.016))
 # Dorsal real fur tufts; modest for plains, dense forest mane; no unrealistic long spikes.
 count=(175 if not LOD else 52) if REGION=='forest' else (98 if not LOD else 24)
 for j in range(count):
  z=rng.uniform(-.65,.73)
  a=rng.uniform(.20,math.pi-.20)
  y=.035+np.interp(z,[row[0] for row in rings],[row[3] for row in rings])
  ry=np.interp(z,[row[0] for row in rings],[row[2] for row in rings])
  rx=np.interp(z,[row[0] for row in rings],[row[1] for row in rings])
  yy=y+ry*math.sin(a);xx=rx*math.cos(a)
  if j%6==0 and REGION=='plains':continue
  if j%2==0 and z>.42: continue
  length=rng.uniform(.027,.100) * (1.0 if REGION=='forest' else .76)
  spur('Body','fur' if j%5 else 'fur_gold',(xx,yy,z),(.34*math.copysign(1,xx) if xx else .0,.69,.35),length,rng.uniform(.007,.016))
 # Geometric coat chevrons, physically attached to loft cross sections.
 def surface_x(y,z):
  zz=np.array([a[0] for a in rings]);rx=np.interp(z,zz,[a[1] for a in rings]);ry=np.interp(z,zz,[a[2] for a in rings]);cy=np.interp(z,zz,[a[3] for a in rings]);
  return rx*math.sqrt(max(.015,1-((y-cy)/max(.001,ry))**2))+.008
 stripes=12 if not LOD else 6
 for side in (-1,1):
  for k in range(stripes):
   z=-.77+k*.127+rng.uniform(-.015,.015)
   y=rng.uniform(.03,.21)
   w=rng.uniform(.054,.095) if REGION=='forest' else rng.uniform(.025,.060)
   for shift in (0,.025) if REGION=='forest' else (0,):
    p0=(side*surface_x(y+.045,z-.04),y+.045,z-.04)
    p1=(side*surface_x(y+.009,z+.008+shift),y+.009,z+.008+shift)
    p2=(side*surface_x(y-w,z+.05+shift),y-w,z+.05+shift)
    wedge('Body','stripe' if REGION=='forest' else 'stripe_dark',p0,p1,p2,.005)
 # Flank coat stripes: broad continuous geometrical ribbons following the loft surface.
 # Forest ribbons are creamy like broken leaf patterns; plains stripes are muted.
 for side in (-1,1):
  stripe_count=9 if REGION=='forest' else 5
  for k in range(stripe_count):
   zstart=-.71+k*(.175 if REGION=='forest' else .30)
   levels=[.24,.18,.11,.04,-.035,-.095]
   verts=[];faces=[]
   for m,y in enumerate(levels):
    zcenter=zstart+m*.036+(.018 if k%3==0 and m>2 else 0.)
    bandwidth=(.034 if REGION=='forest' else .020)*(1-m*.055)
    for z in (zcenter-bandwidth,zcenter+bandwidth):
     zz=float(np.clip(z,-.86,.76))
     xx=side*(surface_x(y,zz)+.033)
     verts.append((xx,y,zz))
   for m in range(len(levels)-1):
    a=m*2;b=a+1;c=a+2;d=a+3
    faces.extend([(a,b,c),(b,d,c)])
   add('Body','stripe' if REGION=='forest' else 'stripe_dark',verts,faces)
 # Crest along spine is connected only to body rig; follows idle breathing.
 for j in range(30 if not LOD else 9):
  z=rng.uniform(-.48,.10);x=rng.uniform(-.08,.08)
  spur('Crest','fur' if j%4 else 'fur_gold',(x,.0,z),(.18*x,.85,.28),rng.uniform(.035,.078),rng.uniform(.008,.014))
class Bin:
 def __init__(self):self.b=bytearray();self.views=[];self.acc=[]
 def accessor(self,arr,comp,typ,target=None,minmax=False):
  arr=np.asarray(arr,dtype={5121:np.uint8,5123:np.uint16,5125:np.uint32,5126:np.float32}[comp])
  while len(self.b)%4:self.b.append(0)
  offset=len(self.b);self.b.extend(arr.tobytes());v={'buffer':0,'byteOffset':offset,'byteLength':arr.nbytes}
  if target:v['target']=target
  vi=len(self.views);self.views.append(v)
  a={'bufferView':vi,'byteOffset':0,'componentType':comp,'count':len(arr),'type':typ}
  if minmax:a.update(min=arr.min(axis=0).tolist(),max=arr.max(axis=0).tolist())
  ai=len(self.acc);self.acc.append(a);return ai

def quat(axis,deg):
 a=math.radians(deg)/2;u=V(*axis)/np.linalg.norm(V(*axis));return [float(u[0]*math.sin(a)),float(u[1]*math.sin(a)),float(u[2]*math.sin(a)),float(math.cos(a))]
def rx(x):return quat((1,0,0),x)
def ry(x):return quat((0,1,0),x)
def rz(x):return quat((0,0,1),x)
def rotations(seq,axis='x'):
 fn={'x':rx,'y':ry,'z':rz}[axis];return [(float(t),fn(v)) for t,v in seq]
def translations(bone,seq):return [(float(t),(OFF[bone]+V(*p)*SZ).tolist()) for t,p in seq]


def animations(b):
 clips=[]
 def add(name,d,curves,loop=True):
  samplers=[];channels=[]
  for joint,attrs in curves.items():
   for path,vals in attrs.items():
    ts=np.asarray([t for t,x in vals],np.float32);out=np.asarray([x for t,x in vals],np.float32)
    assert len(ts)>1 and abs(ts[0])<1e-5 and abs(ts[-1]-d)<1e-4,(name,joint,path)
    i=b.accessor(ts,5126,'SCALAR',minmax=True);o=b.accessor(out,5126,'VEC4' if path=='rotation' else 'VEC3')
    idx=len(samplers);samplers.append({'input':i,'output':o,'interpolation':'LINEAR'});channels.append({'sampler':idx,'target':{'node':BID[joint],'path':path}})
  clips.append({'name':name,'samplers':samplers,'channels':channels,'extras':{'durationSeconds':d,'loop':loop}})
 def rot(seq,axis='x'):return {'rotation':rotations(seq,axis)}
 def bob(seq):return {'translation':translations('Body',[(t,(0,h,z)) for t,h,z in seq])}
 upper=['ForeUpper_L','ForeUpper_R','HindUpper_L','HindUpper_R']
 lower=['ForeLower_L','ForeLower_R','HindLower_L','HindLower_R']
 paws=['ForePaw_L','ForePaw_R','HindPaw_L','HindPaw_R']
 def gait(name,d,ang,knee,bounce,style='diagonal'):
  seq={'Body':bob([(0,0,0),(d*.25,bounce,0),(d*.5,bounce*.18,0),(d*.75,bounce,0),(d,0,0)]),
       'Neck':rot([(0,0),(d*.25,3),(d*.5,-3),(d*.75,3),(d,0)]),
       'Head':rot([(0,0),(d*.25,2),(d*.5,-2),(d*.75,2),(d,0)]),
       'Tail_Base':rot([(0,-9),(d*.5,9),(d,-9)],'y')}
  for j,joint in enumerate(upper):
   phase=(j in [0,3]) if style=='diagonal' else j<2
   signs=[-1,0,1,0,-1] if phase else [1,0,-1,0,1]
   seq[joint]=rot([(k*d/4,ang*s) for k,s in enumerate(signs)])
   bends=[knee,knee*.35,0,knee*.55,knee] if phase else [0,knee*.65,knee,0,0]
   seq[lower[j]]=rot([(k*d/4,float(bends[k])) for k in range(5)])
   seq[paws[j]]=rot([(k*d/4,float(-.28*bends[k])) for k in range(5)])
  add(name,d,seq)
 gait('walk',1.57,14,15,.014)
 gait('trot',.92,22,24,.032)
 gait('short_sprint',.67,32,35,.061,'gallop')
 gait('juvenile_follow',1.24,18,17,.021)
 add('idle',3.2,{'Body':bob([(0,0,0),(.8,.011,0),(1.6,0,0),(2.4,.010,0),(3.2,0,0)]),'Head':rot([(0,0),(.8,-7),(2,9),(3.2,0)],'y'),'Tail_Base':rot([(0,-6),(1.6,7),(3.2,-6)],'y'),'Ear_L':rot([(0,0),(1.6,-6),(3.2,0)],'z')})
 add('breathing',2.6,{'Body':bob([(0,0,0),(1.3,.014,0),(2.6,0,0)]),'Neck':rot([(0,0),(1.3,2),(2.6,0)])})
 add('graze',3.1,{'Neck':rot([(0,0),(.50,-26),(2.5,-27),(3.1,0)]),'Head':rot([(0,0),(.50,-21),(1.25,-16),(2.0,-19),(3.1,0)]),'Jaw':rot([(0,0),(1.0,9),(1.4,1),(2.0,8),(3.1,0)])})
 add('sniff_ground',2.4,{'Neck':rot([(0,0),(.55,-30),(1.85,-28),(2.4,0)]),'Head':rot([(0,0),(.55,15),(1.2,-14),(1.88,11),(2.4,0)],'y'),'Ear_R':rot([(0,0),(.7,15),(2.4,0)],'z')})
 add('dig_shallow',3.5,{'Neck':rot([(0,0),(.6,-34),(2.9,-35),(3.5,0)]),
  'Head':rot([(0,0),(.6,-20),(1.05,-26),(1.45,-19),(1.95,-26),(2.35,-19),(2.9,-21),(3.5,0)]),
  'ForeUpper_L':rot([(0,0),(.55,16),(1.0,-38),(1.55,15),(2.05,-38),(2.72,15),(3.5,0)]),
  'ForeUpper_R':rot([(0,0),(.60,-22),(1.25,13),(1.72,-30),(2.35,17),(3.0,-30),(3.5,0)]),
  'ForePaw_L':rot([(0,0),(.94,-27),(1.6,13),(2.1,-27),(3.5,0)]),
  'ForePaw_R':rot([(0,0),(1.15,-26),(1.8,11),(2.95,-26),(3.5,0)]),
  'Body':bob([(0,0,0),(.6,-.07,0),(2.85,-.055,0),(3.5,0,0)])})
 add('pull_tuber',2.0,{'Neck':rot([(0,0),(.5,-31),(.93,-26),(1.23,11),(2,0)]),'Head':rot([(0,0),(.46,-18),(.9,-13),(1.23,17),(2,0)]),'Jaw':rot([(0,0),(.65,16),(1.3,7),(2,0)])},False)
 add('chew',2.2,{'Jaw':rot([(0,0),(.4,13),(.7,1),(1.1,13),(1.5,1),(1.8,11),(2.2,0)]),'Head':rot([(0,0),(.7,4),(1.4,2),(2.2,0)])})
 add('drink',2.9,{'Neck':rot([(0,0),(.6,-30),(2.2,-31),(2.9,0)]),'Head':rot([(0,0),(.6,-20),(1.1,-18),(1.7,-20),(2.9,0)]),'Jaw':rot([(0,0),(1,5),(1.5,0),(2.0,5),(2.9,0)])})
 add('lookout',2.7,{'Neck':rot([(0,0),(.45,-16),(2.25,-15),(2.7,0)]),'Head':rot([(0,0),(.6,-18),(1.5,15),(2.7,0)],'y'),'Ear_L':rot([(0,0),(.45,-20),(1.6,12),(2.7,0)],'z'),'Ear_R':rot([(0,0),(.45,14),(1.6,-13),(2.7,0)],'z')})
 add('freeze',1.35,{'Neck':rot([(0,0),(.2,-18),(1.35,-18)]),'Head':rot([(0,0),(.18,-10),(1.35,-10)]),'Ear_L':rot([(0,0),(.2,-20),(1.35,-20)],'z')},False)
 add('warning_call',1.9,{'Neck':rot([(0,0),(.24,-18),(1.1,-17),(1.9,0)]),'Head':rot([(0,0),(.3,-20),(1.0,-15),(1.9,0)]),'Jaw':rot([(0,0),(.42,22),(.72,8),(1.1,20),(1.9,0)])},False)
 add('regroup',1.95,{'Head':rot([(0,0),(.45,-21),(1.25,20),(1.95,0)],'y'),'Body':bob([(0,0,0),(.5,.02,0),(1.1,0,0),(1.95,0,0)]),'Tail_Base':rot([(0,0),(.65,19),(1.95,0)],'y')})
 add('flee_start',1.1,{'Body':bob([(0,0,0),(.19,-.09,0),(.51,.13,-.03),(.8,.12,-.06),(1.1,0,0)]),'Neck':rot([(0,0),(.2,-16),(.75,9),(1.1,0)]),'ForeUpper_L':rot([(0,0),(.3,22),(.63,-32),(1.1,0)]),'ForeUpper_R':rot([(0,0),(.3,22),(.63,-32),(1.1,0)]),'HindUpper_L':rot([(0,0),(.3,-18),(.63,20),(1.1,0)]),'HindUpper_R':rot([(0,0),(.3,-18),(.63,20),(1.1,0)])},False)
 add('dodge',1.0,{'Root':rot([(0,0),(.45,22),(1.0,0)],'y'),'Body':{'translation':translations('Body',[(0,(0,0,0)),(.5,(.09,.06,0)),(1,(0,0,0))])},'Neck':rot([(0,0),(.5,-12),(1.0,0)])},False)
 add('push_defense',1.45,{'Body':bob([(0,0,0),(.30,-.055,.03),(.63,.025,-.06),(1.05,.055,-.10),(1.45,0,0)]),'Neck':rot([(0,0),(.34,16),(.65,-20),(1.45,0)]),'Head':rot([(0,0),(.6,-15),(1.45,0)]),'ForeUpper_L':rot([(0,0),(.65,-17),(1.45,0)]),'ForeUpper_R':rot([(0,0),(.65,-17),(1.45,0)])},False)
 add('dust_roll',2.8,{'Body':{'rotation':rotations([(0,0),(.6,-20),(1.4,-65),(2.1,-42),(2.8,0)],'z'),'translation':translations('Body',[(0,(0,0,0)),(.7,(0,-.12,0)),(1.5,(0,-.22,0)),(2.2,(0,-.16,0)),(2.8,(0,0,0))])},'Head':rot([(0,0),(1.2,9),(2.8,0)],'y')},False)
 add('groom',3.0,{'Neck':rot([(0,0),(.5,14),(2.35,13),(3.0,0)]),'Head':rot([(0,0),(.7,24),(1.5,-15),(2.4,19),(3.0,0)],'y'),'Jaw':rot([(0,0),(1.0,9),(1.5,0),(2.1,8),(3.0,0)])})
 add('rest',3.2,{'Body':bob([(0,0,0),(.9,-.23,0),(2.4,-.25,0),(3.2,0,0)]),'Neck':rot([(0,0),(1.0,14),(2.3,15),(3.2,0)]),**{p:rot([(0,0),(.9,25),(2.4,25),(3.2,0)]) for p in lower}},False)
 add('sleep',4.0,{'Body':bob([(0,-.25,0),(1,-.259,0),(2,-.25,0),(3,-.258,0),(4,-.25,0)]),'Neck':rot([(0,18),(2,20),(4,18)]),'Head':rot([(0,5),(2,6),(4,5)])})
 add('hurt',.85,{'Body':rot([(0,0),(.22,-9),(.52,8),(.85,0)],'z'),'Head':rot([(0,0),(.23,15),(.6,-8),(.85,0)],'y')},False)
 add('death',2.9,{'Body':{'rotation':rotations([(0,0),(.7,-14),(1.6,-69),(2.9,-86)],'z'),'translation':translations('Body',[(0,(0,0,0)),(.8,(0,-.13,0)),(1.9,(0,-.34,0)),(2.9,(0,-.36,0))])},'Neck':rot([(0,0),(1.4,22),(2.9,25)])},False)
 add('turn_left',1.15,{'Root':rot([(0,0),(.55,23),(1.15,43)],'y'),'Head':rot([(0,0),(.45,12),(1.15,0)],'y')},False)
 add('turn_right',1.15,{'Root':rot([(0,0),(.55,-23),(1.15,-43)],'y'),'Head':rot([(0,0),(.45,-12),(1.15,0)],'y')},False)
 assert len(clips)==27,len(clips)
 return clips
def export(region,lod):
 setup(region,lod);generate_geometry();b=Bin()
 materials=[];mi={}
 for name,rgb in COLORS[region].items():
  mi[name]=len(materials)
  materials.append({'name':name,'doubleSided':True,'pbrMetallicRoughness':{'baseColorFactor':list(rgb)+[1], 'metallicFactor':0.,'roughnessFactor':.87}})
 primitives=[];vertex_count=triangles=0
 for mat,data in G.items():
  v=np.asarray(data['vertices'],np.float32);f=np.asarray(data['faces'],np.uint32)
  normals=np.zeros_like(v);cross=np.cross(v[f[:,1]]-v[f[:,0]],v[f[:,2]]-v[f[:,0]])
  for k in range(3):np.add.at(normals,f[:,k],cross)
  normals/=np.maximum(np.linalg.norm(normals,axis=1),1e-8)[:,None]
  j=np.zeros((len(v),4),dtype=np.uint16);j[:,0]=data['joints']
  w=np.zeros((len(v),4),dtype=np.float32);w[:,0]=1.
  primitives.append({'attributes':{'POSITION':b.accessor(v,5126,'VEC3',34962,True),'NORMAL':b.accessor(normals,5126,'VEC3',34962),'JOINTS_0':b.accessor(j,5123,'VEC4',34962),'WEIGHTS_0':b.accessor(w,5126,'VEC4',34962)},'indices':b.accessor(f.reshape(-1),5125,'SCALAR',34963),'material':mi[mat],'mode':4})
  vertex_count+=len(v);triangles+=len(f)
 nodes=[]
 for name,parent,offset in BONES:
  nodes.append({'name':name,'translation':OFF[name].tolist(),'rotation':[0,0,0,1],'children':[]})
 for name,parent,_ in BONES:
  if parent:nodes[BID[parent]]['children'].append(BID[name])
 nodes.append({'name':'Cavoru_MidPoly_v01','mesh':0,'skin':0})
 nodes.append({'name':'Cavoru_v01','children':[0,len(nodes)-1]})
 inv=[]
 for name,_,_ in BONES:
  m=np.eye(4,dtype=np.float32);m[:3,3]=-REST[name];inv.append(m.T.reshape(-1))
 inverse=b.accessor(np.asarray(inv,np.float32),5126,'MAT4')
 anim=animations(b)
 gltf={'asset':{'version':'2.0','generator':'Wildhaven Cavoru mid-poly articulated 0.1','copyright':'Original creature for Wildhaven'},'scene':0,'scenes':[{'name':'Cavoru','nodes':[len(nodes)-1]}],
  'nodes':nodes,'meshes':[{'name':f'Cavoru_{region}_LOD{lod}','primitives':primitives}],
  'skins':[{'name':'Cavoru_Rig','joints':list(range(len(BONES))),'inverseBindMatrices':inverse,'skeleton':0}],
  'materials':materials,'animations':anim,'bufferViews':b.views,'accessors':b.acc,'buffers':[{'byteLength':len(b.b)}],
  'extras':{'speciesId':'cavoru','region':region,'version':'0.1.0','unit':'metre','animationCount':len(anim),'limitations':['rigid segment skin weights, IK future work','in-place motion','missing collision, AI, and facial blendshapes','concept prototype awaiting visual approval']}}
 js=json.dumps(gltf,ensure_ascii=False,separators=(',',':')).encode('utf-8');js+=b' '*((-len(js))%4)
 binary=bytes(b.b)+b'\0'*((-len(b.b))%4)
 blob=struct.pack('<4sII',b'glTF',2,12+8+len(js)+8+len(binary))+struct.pack('<I4s',len(js),b'JSON')+js+struct.pack('<I4s',len(binary),b'BIN\0')+binary
 filename=f'cavoru_{region}_{"LOD1_" if lod else ""}animated_v01.glb';path=HERE/filename;path.write_bytes(blob)
 bbox=np.vstack([np.asarray(v['vertices']) for v in G.values()])
 return {'file':filename,'region':region,'lod':lod,'bytes':len(blob),'sha256':hashlib.sha256(blob).hexdigest(),'vertices':vertex_count,'triangles':triangles,'joints':len(BONES),'materials':len(materials),'clips':[x['name'] for x in anim],'boundsMin':bbox.min(axis=0).round(4).tolist(),'boundsMax':bbox.max(axis=0).round(4).tolist()}

if __name__=='__main__':
 entries=[export(region,lod) for region in ('forest','plains') for lod in (0,1)]
 (HERE/'cavoru_manifest.json').write_text(json.dumps({'speciesId':'cavoru','version':'0.1.0','files':entries},indent=2,ensure_ascii=False)+'\n')
 print(json.dumps([{'file':e['file'],'bytes':e['bytes'],'tris':e['triangles'],'verts':e['vertices'],'animations':len(e['clips'])} for e in entries],indent=2))
