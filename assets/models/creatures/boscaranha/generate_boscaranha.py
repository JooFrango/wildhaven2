#!/usr/bin/env python3
"""Wildhaven Boscaranha — original animated spider-like ambush predator, glTF 2.0.
Original procedural mesh and 22 authored skeletal clips. +Y up, -Z forward.
MIT-style original project code for Wildhaven; art owned by Wildhaven project.
Requirements: Python 3.11+, NumPy. 
"""
from __future__ import annotations
import math,json,struct,hashlib,random
from collections import defaultdict
from pathlib import Path
import numpy as np
D=Path(__file__).resolve().parent
LOD=0
V=lambda *v: np.array(v,dtype=np.float64)
def n(a,b):return a if LOD==0 else b
PALETTES={'forest':{
 'chitin':(.19,.124,.072),'chitin_dark':(.112,.078,.056),'chitin_light':(.32,.225,.135),
 'bark':(.33,.218,.120),'bark_deep':(.223,.141,.085),'bark_amber':(.52,.27,.115),
 'moss':(.245,.306,.15),'moss_light':(.35,.42,.20),'moss_deep':(.16,.23,.125),
 'forest_orange':(.69,.30,.092),'leaf_old':(.36,.256,.115),'leaf_dark':(.21,.204,.10),
 'eye_rim':(.092,.065,.053),'eye':(.047,.035,.029),'eye_glow':(.81,.52,.21),'eye_glint':(.95,.83,.57),
 'fang':(.65,.52,.32),'fang_tip':(.9,.79,.62),'joint':(.095,.067,.053),
 'leg':(.275,.192,.11),'leg_band':(.155,.10,.070),'leg_highlight':(.44,.29,.16),
 'silk':(.77,.77,.61),'underside':(.133,.112,.086),'spinner':(.48,.395,.27)
}}
BONES=[('Root',None,(0,0,0)),('Body','Root',(0,.61,0)),
 ('Cephalothorax','Body',(0,.017,-.30)),('Abdomen','Body',(0,.045,.48)),
 ('Spinnerets','Abdomen',(0,-.12,.52)),
 ('Chelicera_L','Cephalothorax',(-.14,-.10,-.29)),('Chelicera_R','Cephalothorax',(.14,-.10,-.29)),
 ('Pedipalp_L','Cephalothorax',(-.26,-.08,-.27)),('Pedipalp_R','Cephalothorax',(.26,-.08,-.27))]
for side,label in [(-1,'L'),(1,'R')]:
 for k,z in enumerate([-.39,-.16,.105,.355],1):
  hip=f'Leg_{label}{k}_Hip';knee=f'Leg_{label}{k}_Knee';tip=f'Leg_{label}{k}_Tip'
  BONES.extend([(hip,'Body',(side*.28,-.04,z)),(knee,hip,(side*.42,.075,(-.24 if k==1 else -.11 if k==2 else .06 if k==3 else .20))),
   (tip,knee,(side*.29,-.20,(-.25 if k==1 else -.07 if k==2 else .04 if k==3 else .17)))])

BONE_ID={n:i for i,(n,p,o) in enumerate(BONES)}; PA={n:p for n,p,o in BONES}; OFF={n:V(*o) for n,p,o in BONES}
def position(n):
 out=np.zeros(3)
 while n is not None:
  out+=OFF[n];n=PA[n]
 return out
REST={n:position(n) for n,_,_ in BONES}
G=defaultdict(lambda:{'vertices':[],'faces':[],'joints':[]})
def add_geo(bone,mat,verts,faces):
 if not len(verts):return
 g=G[mat];base=len(g['vertices']);p=REST[bone]
 g['vertices'].extend((np.asarray(verts,dtype=float)+p).tolist())
 g['faces'].extend([[base+a,base+b,base+c] for a,b,c in faces]);g['joints'].extend([BONE_ID[bone]]*len(verts))
def ellipsoid(bone,mat,c,rad,lat=9,lon=14,tilt=(0,0,0)):
 if LOD:lat=max(5,round(lat*.65));lon=max(8,round(lon*.65))
 rx,ry,rz=rad;X,Y,Z=tilt
 sx,cx=math.sin(X),math.cos(X);sy,cy=math.sin(Y),math.cos(Y);sz,cz=math.sin(Z),math.cos(Z)
 R=np.array([[cz,-sz,0],[sz,cz,0],[0,0,1]])@np.array([[cy,0,sy],[0,1,0],[-sy,0,cy]])@np.array([[1,0,0],[0,cx,-sx],[0,sx,cx]])
 v=[];f=[]
 for i in range(lat+1):
  th=math.pi*i/lat
  for j in range(lon):
   ph=2*math.pi*j/lon
   u=V(rx*math.sin(th)*math.cos(ph),ry*math.cos(th),rz*math.sin(th)*math.sin(ph))
   v.append(V(*c)+R@u)
 for i in range(lat):
  for j in range(lon):
   a=i*lon+j;b=i*lon+(j+1)%lon;c0=(i+1)*lon+j;d=(i+1)*lon+(j+1)%lon
   f.extend([[a,b,c0],[b,d,c0]])
 add_geo(bone,mat,v,f)
def tube(bone,mat,pts,rads,sides=8,ellipses=None,caps=True):
 if LOD:sides=max(5,round(sides*.73))
 ps=[V(*p) for p in pts];v=[];f=[]
 for k,p in enumerate(ps):
  tangent=ps[min(k+1,len(ps)-1)]-ps[max(0,k-1)];tangent=tangent/max(1e-9,np.linalg.norm(tangent))
  u=np.cross(tangent,V(1,0,0))
  if np.linalg.norm(u)<.08:u=np.cross(tangent,V(0,0,1))
  u=u/np.linalg.norm(u);w=np.cross(tangent,u)
  for i in range(sides):
   t=2*math.pi*i/sides;er=ellipses[k] if ellipses is not None else (1,1)
   v.append(p+rads[k]*(math.cos(t)*u*er[0]+math.sin(t)*w*er[1]))
 for k in range(len(ps)-1):
  for i in range(sides):
   a=k*sides+i;b=k*sides+(i+1)%sides;c=(k+1)*sides+i;d=(k+1)*sides+(i+1)%sides
   f.extend([[a,c,b],[b,c,d]])
 if caps:
  for j in range(1,sides-1):f.append([0,j+1,j])
  off=(len(ps)-1)*sides
  for j in range(1,sides-1):f.append([off,off+j,off+j+1])
 add_geo(bone,mat,v,f)
def tuft(bone,mat,base,direction,length=.12,width=.038,sides=5):
 p=V(*base);v=V(*direction);v=v/(max(1e-8,np.linalg.norm(v)))
 # points out to an irregular tip with a slight bend
 tube(bone,mat,[p,p+v*length*.42+V(0,-length*.09,0),p+v*length],[width,width*.75,.001],sides=sides)


def make_geometry():
 rng=random.Random(20051028)
 # Compact segmented cephalothorax + massive patterned abdomen, no imported asset.
 ellipsoid('Cephalothorax','chitin',(0,.01,-.06),(.34,.19,.395),lat=14,lon=22)
 ellipsoid('Cephalothorax','chitin_light',(0,.155,-.13),(.29,.08,.255),lat=10,lon=18)
 ellipsoid('Cephalothorax','underside',(0,-.135,-.06),(.295,.075,.29),lat=9,lon=16)
 ellipsoid('Cephalothorax','bark',(0,.133,-.10),(.19,.041,.19),lat=8,lon=12)
 ellipsoid('Body','chitin_dark',(0,-.055,.08),(.215,.135,.25),lat=10,lon=16)
 ellipsoid('Abdomen','bark',(0,.05,.12),(.455,.295,.565),lat=19,lon=28)
 ellipsoid('Abdomen','underside',(0,-.185,.12),(.39,.11,.48),lat=10,lon=18)
 ellipsoid('Abdomen','bark_deep',(0,.15,.07),(.43,.196,.49),lat=12,lon=22)
 # Raised shield-plates are physical pentagon slabs, brown/orange with green moss.
 for i in range(n(128,47)):
  theta=rng.uniform(.13,1.38); phi=rng.uniform(0,math.pi*2)
  sx=math.sin(theta)*math.cos(phi); sy=math.cos(theta);sz=math.sin(theta)*math.sin(phi)
  z=.12+sz*.53; x=sx*.445; y=.05+sy*.285
  scale=rng.uniform(.047,.105);edge=V(sx,sy,sz)
  u=np.cross(edge,V(0,1,0))
  if np.linalg.norm(u)<.02:u=V(1,0,0)
  u/=np.linalg.norm(u);v=np.cross(edge,u);v/=np.linalg.norm(v)
  center=V(x,y,z)+edge*.025
  verts=[center+edge*.013]+[center + u*scale*math.cos(j*2*math.pi/5)+v*scale*math.sin(j*2*math.pi/5) for j in range(5)]
  faces=[[0,1+j,1+(j+1)%5] for j in range(5)]
  col=rng.choices(['bark','bark_deep','leaf_old','moss','moss_light','forest_orange'],[20,24,15,20,9,12])[0]
  add_geo('Abdomen',col,verts,faces)
 # Low irregular angular bark ridges and orange markings on dorsal center.
 for j in range(n(34,12)):
  z=rng.uniform(-.32,.45);x=rng.uniform(-.25,.25)
  y=.05+.285*math.sqrt(max(.12,1-(x/.46)**2-((z-.12)/.57)**2))
  tuft('Abdomen',rng.choice(['bark_amber','forest_orange','bark_deep']),(x,y+.015,z),(.16*x,.14,rng.choice([-1,1])),rng.uniform(.075,.18),rng.uniform(.017,.038),5)
 # Moss grass and lichen needles visibly attached around dorsal edges.
 for j in range(n(118,36)):
  phi=rng.uniform(0,2*math.pi);z=rng.uniform(-.30,.46)
  sx=math.cos(phi);sy=math.sin(phi)
  if sy<-.15:continue
  frac=math.sqrt(max(.12,1-((z-.12)/.56)**2))
  x=.45*frac*sx;y=.055+.295*frac*sy
  tuft('Abdomen',rng.choice(['moss','moss_light','moss_deep']), (x,y,z),(.14*sx,.65+.30*sy,rng.uniform(-.4,.4)),rng.uniform(.025,.09),rng.uniform(.008,.018),4)
 # Clypeus and eight discreet eyes in two tiers; shiny facets, no compound eyes.
 for side in [-1,1]:
  for j,(x,y,z,rad) in enumerate([
   (.078,.117,-.405,.042),(.17,.115,-.370,.033),(.245,.08,-.305,.026),(.09,.187,-.326,.029)]):
   ellipsoid('Cephalothorax','eye_rim',(side*x,y,z),(rad*1.20,rad*.9,rad*.86),7,10)
   ellipsoid('Cephalothorax','eye',(side*x,y+.003,z-.009),(rad,rad*.84,rad*.82),8,12)
   ellipsoid('Cephalothorax','eye_glint',(side*x-side*.013,y+.013,z-.028),(.008,.009,.007),6,8)
 # Fangs are jointed, oriented down and forward. Pedipalps slender.
 for side,label in [(-1,'L'),(1,'R')]:
  ch='Chelicera_'+label;p='Pedipalp_'+label
  ellipsoid(ch,'chitin_dark',(0,-.033,-.052),(.112,.105,.146),10,14)
  tube(ch,'fang',[(side*.005,-.062,-.10),(side*.022,-.14,-.17),(side*.035,-.25,-.21),(side*.02,-.28,-.18)],[.057,.042,.022,.002],9)
  tube(p,'leg',[(0,0,0),(side*.08,-.055,-.11),(side*.12,-.20,-.15)],[.035,.028,.014],7)
  ellipsoid(p,'leg_highlight',(side*.13,-.20,-.15),(.03,.039,.03),7,9)
 # Spinnerets + silk glands under end of abdomen
 for side in [-1,1]:
  ellipsoid('Spinnerets','spinner',(side*.074,-.028,.045),(.071,.052,.12),9,12)
  tube('Spinnerets','silk',[(side*.05,-.02,.12),(side*.06,-.04,.19)],[.025,.001],6)
 # Eight legs, 24 independently animated leg joints.
 for side,label in [(-1,'L'),(1,'R')]:
  for k in range(1,5):
   hip=f'Leg_{label}{k}_Hip';knee=f'Leg_{label}{k}_Knee';tip=f'Leg_{label}{k}_Tip'
   z_a=(-.24 if k==1 else -.11 if k==2 else .06 if k==3 else .20)
   z_b=(-.25 if k==1 else -.07 if k==2 else .04 if k==3 else .17)
   tube(hip,'leg',[(0,0,0),(side*.16,.07,z_a*.4),(side*.42,.075,z_a)],
      [.067,.057,.044],n(11,7))
   ellipsoid(hip,'joint',(side*.018,.015,0),(.086,.075,.094),n(9,6),n(12,8))
   # spiked chitin flanges along upper legs (not spikes on every joint)
   for j in range(n(6,2)):
    xx=side*(.10+.045*j);zz=z_a*(.30+.115*j)
    tuft(hip,'chitin_light' if j%2 else 'moss',(xx,.105,zz), (side*.20,1,.04),.063,.023,5)
   tube(knee,'chitin_dark',[(0,0,0),(side*.13,-.055,z_b*.35),(side*.29,-.20,z_b)],
      [.049,.041,.027],n(10,6))
   ellipsoid(knee,'leg_band',(side*.012,-.013,0),(.070,.061,.063),n(8,5),n(11,8))
   tube(tip,'leg_band',[(0,0,0),(side*.035,-.12,z_b*.15),(side*.085,-.34,z_b*.22)],
     [.032,.021,.014],n(9,6))
   # claw near ground, angled towards forward
   tube(tip,'fang_tip',[(side*.085,-.34,z_b*.22),(side*.09,-.38,z_b*.22-.064)], [.021,.002],n(8,5))

class Binary:
 def __init__(self):self.b=bytearray();self.views=[];self.accessors=[]
 def accessor(self,array,component,typ,target=None,minmax=False):
  arr=np.asarray(array).astype({5121:np.uint8,5123:np.uint16,5125:np.uint32,5126:np.float32}[component]);data=arr.tobytes()
  while len(self.b)%4:self.b.append(0)
  off=len(self.b);self.b.extend(data)
  v={'buffer':0,'byteOffset':off,'byteLength':len(data)}
  if target:v['target']=target
  vi=len(self.views);self.views.append(v)
  a={'bufferView':vi,'byteOffset':0,'componentType':component,'count':int(arr.shape[0]),'type':typ}
  if minmax:a.update(min=np.min(arr,axis=0).tolist(),max=np.max(arr,axis=0).tolist())
  ai=len(self.accessors);self.accessors.append(a);return ai

def quat(axis,deg):
 a=math.radians(deg)/2;u=V(*axis);u=u/np.linalg.norm(u)
 return [float(u[0]*math.sin(a)),float(u[1]*math.sin(a)),float(u[2]*math.sin(a)),float(math.cos(a))]
def rx(deg):return quat((1,0,0),deg)
def ry(deg):return quat((0,1,0),deg)
def rz(deg):return quat((0,0,1),deg)
def rotseq(fr,axis='x'):
 fn={'x':rx,'y':ry,'z':rz}[axis];return [(float(t),fn(a)) for t,a in fr]
def trseq(fr,bone):
 bas=OFF[bone]
 return [(float(t),(bas+V(*v)).tolist()) for t,v in fr]



def build_anims(binary):
 clips=[]
 def add(name,dur,curves,loop=True,note=''):
  samplers=[];channels=[]
  for bone,attrs in curves.items():
   for path,kfs in attrs.items():
    times=np.asarray([t for t,v in kfs],np.float32);vals=np.asarray([v for t,v in kfs],np.float32)
    if abs(times[0])>1e-5 or abs(times[-1]-dur)>1e-4:raise ValueError((name,bone,path,times))
    tacc=binary.accessor(times,5126,'SCALAR',minmax=True)
    vacc=binary.accessor(vals,5126,'VEC4' if path=='rotation' else 'VEC3')
    i=len(samplers);samplers.append({'input':tacc,'output':vacc,'interpolation':'LINEAR'});
    channels.append({'sampler':i,'target':{'node':BONE_ID[bone],'path':path}})
  clips.append({'name':name,'channels':channels,'samplers':samplers,'extras':{'durationSeconds':dur,'loop':loop,'note':note}})
 def r(keys,ax='y'):return {'rotation':rotseq(keys,ax)}
 def trans(bone,keys):return {'translation':trseq(keys,bone)}
 def basic_legs(dur,amplitude=14,lift=12,bob=.012,slow=False):
  c={'Body':trans('Body',[(0,(0,0,0)),(dur*.25,(0,bob,0)),(dur*.5,(0,0,0)),(dur*.75,(0,bob,0)),(dur,(0,0,0))]),
    'Abdomen':r([(0,0),(dur*.25,2.8),(dur*.5,0),(dur*.75,-2.8),(dur,0)],'z'),
    'Pedipalp_L':r([(0,0),(dur*.5,-8),(dur,0)],'x'),
    'Pedipalp_R':r([(0,0),(dur*.5,8),(dur,0)],'x')}
  for side,label in [(-1,'L'),(1,'R')]:
   for k in range(1,5):
    hip=f'Leg_{label}{k}_Hip';knee=f'Leg_{label}{k}_Knee';tip=f'Leg_{label}{k}_Tip'
    # Stable diagonal alternating-tetrapod stance (L1,L3,R2,R4 / L2,L4,R1,R3).
    phase=0 if (k%2==(1 if label=='L' else 0)) else 1
    vals=[1,0,-1,0,1] if phase==0 else [-1,0,1,0,-1]
    c[hip]=r([(j*dur/4,amplitude*v*(1 if side==-1 else -1)) for j,v in enumerate(vals)],'y')
    lev=[0,1,0,0,0] if phase==0 else [0,0,0,1,0]
    c[knee]=r([(j*dur/4,side*lift*v) for j,v in enumerate(lev)],'z')
    c[tip]=r([(0,0),(.25*dur,-side*lift*.2),(.5*dur,0),(.75*dur,side*lift*.2),(dur,0)],'z')
  return c
 add('idle',3.0,{'Abdomen':trans('Abdomen',[(0,(0,0,0)),(.8,(0,.016,0)),(1.5,(0,0,0)),(2.25,(0,.018,0)),(3,(0,0,0))]),
 'Pedipalp_L':r([(0,0),(1,-12),(2,5),(3,0)],'x'),'Pedipalp_R':r([(0,0),(1,6),(2,-10),(3,0)],'x')},note='Quiet ambush respiration')
 add('walk',1.6,basic_legs(1.6,13,12,.012),note='Four-legged alternating tetrapod slow gait, in-place')
 add('scuttle',.90,basic_legs(.90,21,17,.017),note='Lateral quick footsteps, in-place')
 add('sprint',.56,basic_legs(.56,32,24,.035),note='Very short high-speed rush, in-place')
 add('stalk',2.4,{**basic_legs(2.4,8,8,.004),'Body':trans('Body',[(0,(0,0,0)),(.5,(0,-.07,0)),(1.9,(0,-.07,0)),(2.4,(0,0,0))])},note='Low and slow movement')
 add('ambush',3.0,{'Body':trans('Body',[(0,(0,0,0)),(.75,(0,-.17,.01)),(2.4,(0,-.17,.01)),(3,(0,0,0))]),
  'Abdomen':r([(0,0),(1,-7),(2,-7),(3,0)],'x'),
  **{f'Leg_{s}{k}_Hip':r([(0,0),(.9,(-1 if s=='L' else 1)*14),(2.4,(-1 if s=='L' else 1)*14),(3,0)],'y') for s in ('L','R') for k in (1,2)}},note='Crouch beneath foliage and wait')
 add('sense_vibrations',2.0,{'Cephalothorax':r([(0,0),(.35,-7),(1.05,7),(1.7,-4),(2,0)],'y'),
 'Pedipalp_L':r([(0,0),(.5,22),(1.4,-4),(2,0)],'x'),'Pedipalp_R':r([(0,0),(.5,22),(1.4,-4),(2,0)],'x')},note='Ground sensor behavior, not omniscience')
 add('vigilance',2.5,{'Cephalothorax':r([(0,0),(.55,16),(1.25,-19),(2.1,9),(2.5,0)],'y'),
 'Body':trans('Body',[(0,(0,0,0)),(.6,(0,.035,0)),(1.7,(0,.025,0)),(2.5,(0,0,0))])},note='Wait and inspect visually')
 add('pounce',1.28,{'Body':trans('Body',[(0,(0,0,0)),(.28,(0,-.09,.08)),(.55,(0,.18,-.25)),(.85,(0,.07,-.43)),(1.28,(0,0,0))]),
 'Cephalothorax':r([(0,0),(.3,18),(.55,-13),(.85,17),(1.28,0)],'x'),
 **{f'Leg_{s}{k}_Hip':r([(0,0),(.32,(-1 if s=='L' else 1)*20),(.7,(-1 if s=='L' else 1)*-19),(1.28,0)],'y') for s in ('L','R') for k in range(1,5)}},False,'In-place illustrative leap: actual collision and displacement via game controller')
 add('bite',.92,{'Chelicera_L':r([(0,0),(.25,-26),(.48,18),(.92,0)],'z'),
 'Chelicera_R':r([(0,0),(.25,26),(.48,-18),(.92,0)],'z'),
 'Cephalothorax':r([(0,0),(.20,10),(.50,-12),(.92,0)],'x')},False,'Fang strike, no game hitbox included')
 add('silk_wrap',2.4,{'Spinnerets':r([(0,0),(.5,-20),(1.15,20),(1.8,-17),(2.4,0)],'y'),
 'Abdomen':r([(0,0),(.6,9),(1.3,-9),(1.9,11),(2.4,0)],'y'),
 **{f'Leg_{s}{k}_Hip':r([(0,0),(.6,(-1 if s=='L' else 1)*9),(1.3,(-1 if s=='L' else 1)*-9),(2.4,0)],'y') for s in ('L','R') for k in (1,2)}},note='Weaving motion, no generated silk mesh in clip')
 add('feed',3.1,{'Cephalothorax':r([(0,0),(.4,21),(2.5,22),(3.1,0)],'x'),
 'Chelicera_L':r([(0,0),(1,9),(1.4,0),(2,12),(3.1,0)],'z'),
 'Chelicera_R':r([(0,0),(1,-9),(1.4,0),(2,-12),(3.1,0)],'z'),
 'Pedipalp_L':r([(0,0),(1,24),(2,17),(3.1,0)],'x'),'Pedipalp_R':r([(0,0),(1,24),(2,17),(3.1,0)],'x')},note='Consuming immobilized prey')
 add('climb',1.4,{**basic_legs(1.4,17,17,.01),'Body':r([(0,0),(.4,-15),(1,-15),(1.4,0)],'x')},note='Climbing movement requires surface-aware pathfinding')
 add('threat_display',2.0,{'Body':r([(0,0),(.4,-15),(1.6,-18),(2,0)],'x'),
 'Cephalothorax':r([(0,0),(.5,-16),(1.6,-16),(2,0)],'x'),
 'Chelicera_L':r([(0,0),(.5,20),(1.6,20),(2,0)],'z'),'Chelicera_R':r([(0,0),(.5,-20),(1.6,-20),(2,0)],'z'),
 **{f'Leg_{s}{k}_Hip':r([(0,0),(.6,(-1 if s=='L' else 1)*30),(1.6,(-1 if s=='L' else 1)*30),(2,0)],'y') for s in ('L','R') for k in (1,2)}},note='Defensive raised posture')
 add('retreat',1.15,basic_legs(1.15,15,14,.010),note='Reverse scuttle in-place')
 add('turn_left',1.0,{'Root':r([(0,0),(.5,23),(1,45)],'y')},False,'Pivot left; navigation owns rotation')
 add('turn_right',1.0,{'Root':r([(0,0),(.5,-23),(1,-45)],'y')},False,'Pivot right')
 add('groom',2.8,{'Pedipalp_L':r([(0,0),(.55,35),(1.3,-18),(2,27),(2.8,0)],'x'),
 'Pedipalp_R':r([(0,0),(.65,28),(1.45,-13),(2.25,20),(2.8,0)],'x')},note='Cleaning sensory appendages')
 add('nest',3.4,{'Spinnerets':r([(0,0),(.8,-17),(1.5,19),(2.5,-22),(3.4,0)],'y'),
 'Abdomen':r([(0,0),(.7,12),(1.6,-12),(2.5,10),(3.4,0)],'y')},note='Silk-and-leaf shelter building illustrative motion')
 add('rest',4.0,{'Body':trans('Body',[(0,(0,0,0)),(.8,(0,-.11,0)),(3.2,(0,-.11,0)),(4,(0,0,0))]),
 'Abdomen':trans('Abdomen',[(0,(0,0,0)),(1,(0,.011,0)),(2,(0,0,0)),(3,(0,.011,0)),(4,(0,0,0))])},note='Lower and rest under cover')
 add('hurt',.76,{'Body':r([(0,0),(.20,-13),(.44,8),(.76,0)],'z'),
 'Cephalothorax':r([(0,0),(.20,12),(.52,-8),(.76,0)],'y')},False,'Pain recoil')
 add('death',2.7,{'Body':trans('Body',[(0,(0,0,0)),(.7,(0,-.09,0)),(1.55,(0,-.32,0)),(2.7,(0,-.33,0))]),
 **{f'Leg_{s}{k}_Hip':r([(0,0),(.8,(-1 if s=='L' else 1)*20),(1.8,(-1 if s=='L' else 1)*35),(2.7,(-1 if s=='L' else 1)*35)],'y') for s in ('L','R') for k in range(1,5)}},False,'Death collapse, non-loop')
 return clips

def save(lod=0):
 global LOD
 LOD=lod
 G.clear();make_geometry();binary=Binary();materials=[];mids={}
 for k,col in PALETTES['forest'].items():
  mids[k]=len(materials)
  materials.append({'name':k,'doubleSided':True,'pbrMetallicRoughness':{
     'baseColorFactor':list(col)+[1.0],'roughnessFactor':.92 if k not in ('horn','horn_light','horn_tip') else .73,
     'metallicFactor':0}})
 primitives=[];vc=tc=0
 for mat,g in G.items():
  pts=np.asarray(g['vertices'],dtype=np.float32);tris=np.asarray(g['faces'],dtype=np.uint32)
  norms=np.zeros_like(pts);vnorm=np.cross(pts[tris[:,1]]-pts[tris[:,0]],pts[tris[:,2]]-pts[tris[:,0]])
  for k in range(3):np.add.at(norms,tris[:,k],vnorm)
  norms/=np.maximum(np.linalg.norm(norms,axis=1),1e-8)[:,None]
  joints=np.zeros((len(pts),4),dtype=np.uint16);joints[:,0]=np.asarray(g['joints'],dtype=np.uint16)
  weights=np.zeros((len(pts),4),dtype=np.float32);weights[:,0]=1
  primitives.append({'attributes':{
   'POSITION':binary.accessor(pts,5126,'VEC3',34962,True),
   'NORMAL':binary.accessor(norms,5126,'VEC3',34962),
   'JOINTS_0':binary.accessor(joints,5123,'VEC4',34962),
   'WEIGHTS_0':binary.accessor(weights,5126,'VEC4',34962)},
   'indices':binary.accessor(tris.reshape(-1),5125,'SCALAR',34963),'material':mids[mat],'mode':4})
  vc+=len(pts);tc+=len(tris)
 nodes=[]
 for n,parent,o in BONES:nodes.append({'name':n,'translation':list(o),'rotation':[0,0,0,1],'children':[]})
 for n,p,o in BONES:
  if p:nodes[BONE_ID[p]]['children'].append(BONE_ID[n])
 nodes.append({'name':'Boscaranha_MidPoly','mesh':0,'skin':0})
 nodes.append({'name':'Boscaranha_v01','children':[0,len(nodes)-1],'scale':[.62,.62,.62]})
 ibms=[]
 for n,p,o in BONES:
  m=np.eye(4,dtype=np.float32);m[:3,3]=-REST[n];ibms.append(m.T.reshape(-1))
 ibm=binary.accessor(np.asarray(ibms,dtype=np.float32),5126,'MAT4')
 anim=build_anims(binary)
 gltf={'asset':{'version':'2.0','generator':'Wildhaven Boscaranha procedural skinned 0.1','copyright':'Original fictional creature asset for Wildhaven'},
 'scene':0,'scenes':[{'name':'Wildhaven Boscaranha','nodes':[len(nodes)-1]}],
 'nodes':nodes,'meshes':[{'name':f'Boscaranha_LOD{lod}','primitives':primitives}],
 'skins':[{'name':'Boscaranha_Rig','inverseBindMatrices':ibm,'joints':list(range(len(BONES))),'skeleton':0}],
 'materials':materials,'animations':anim,'bufferViews':binary.views,'accessors':binary.accessors,
 'buffers':[{'byteLength':len(binary.b)}],
 'extras':{'speciesId':'boscaranha','version':'0.1.0','units':'metres',
  'artDirection':'Mid-poly moss-and-bark armored ambush arachnid with eight articulated legs',
  'limitations':['rigid region weighted skin','in-place locomotion','no physics/collision/AI yet'],
  'clipNames':[a['name'] for a in anim]}}
 js=json.dumps(gltf,ensure_ascii=False,separators=(',',':')).encode('utf-8')
 js+=b' '*((-len(js))%4)
 blob=bytes(binary.b)+b'\x00'*((-len(binary.b))%4)
 out=struct.pack('<4sII',b'glTF',2,12+8+len(js)+8+len(blob))+struct.pack('<I4s',len(js),b'JSON')+js+struct.pack('<I4s',len(blob),b'BIN\0')+blob
 path=D/('boscaranha_animated_v01.glb' if lod==0 else 'boscaranha_LOD1_animated_v01.glb');path.write_bytes(out)
 verts=np.vstack([np.asarray(g['vertices']) for g in G.values()])
 result={'species':'boscaranha','version':'0.1.0','lod':lod,'file':path.name,'bytes':len(out),'sha256':hashlib.sha256(out).hexdigest(),
  'vertices':vc,'triangles':tc,'joints':len(BONES),'materials':len(materials),'animationCount':len(anim),
  'clips':{a['name']:a['extras']['durationSeconds'] for a in anim},
  'boundingBoxM':[(verts.min(axis=0)*.62).round(4).tolist(),(verts.max(axis=0)*.62).round(4).tolist()],
  'notProductionReady':['rigid skin deformation','no IK grounding','in-place animations','no hitboxes or physics','no AI integration']}
 return result
if __name__=='__main__':
 results=[save(0),save(1)]
 (D/'boscaranha_manifest.json').write_text(json.dumps({'speciesId':'boscaranha','version':'0.1.0','variants':results},indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
 print(json.dumps(results,indent=2,ensure_ascii=False))
