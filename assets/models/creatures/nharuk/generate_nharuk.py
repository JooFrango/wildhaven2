#!/usr/bin/env python3
"""WILDHAVEN | Nharuk original regional predator GLB generator v0.1.
Pure NumPy procedural skinned geometry, glTF 2.0 + 27 nonempty animation clips.
Y-up, nose toward -Z, metres, rigid-v0 skin, no in-game AI/collisions.
"""
from __future__ import annotations
import json,math,random,hashlib,struct
from pathlib import Path
from collections import defaultdict
import numpy as np

HERE=Path(__file__).resolve().parent
V=lambda *x: np.array(x,dtype=np.float64)
LOD=0;REGION='tropical';SZ=np.ones(3)
COLORS={
 'tropical':{
 'coat':(.245,.225,.105),'back':(.175,.170,.090),'flank':(.34,.265,.125),'belly':(.52,.405,.238),
 'hip':(.285,.225,.112),'shoulder':(.30,.235,.118),'face':(.34,.265,.142),'muzzle':(.54,.421,.266),
 'nose':(.105,.078,.064),'nose_light':(.22,.153,.114),'eye':(.84,.53,.13),'eye_rim':(.11,.092,.058),'pupil':(.028,.022,.022),
 'eyeshine':(.98,.86,.50),'ear':(.30,.255,.125),'ear_inner':(.47,.286,.194),'stripe':(.105,.103,.069),
 'stripe_warm':(.39,.155,.085),'crest':(.115,.118,.077),'crest_warm':(.32,.18,.086),
 'tail':(.265,.218,.116),'tuft':(.10,.105,.072),'tuft_warm':(.35,.17,.088),
 'pad':(.16,.13,.10),'claw':(.66,.595,.432),'whisker':(.65,.63,.475),'cheek_plate':(.58,.485,.285),
 'tooth':(.87,.83,.665),'tongue':(.46,.20,.16)},
 'temperate_plains':{
 'coat':(.62,.352,.159),'back':(.48,.244,.119),'flank':(.75,.465,.218),'belly':(.79,.63,.405),
 'hip':(.57,.304,.156),'shoulder':(.65,.365,.18),'face':(.72,.44,.222),'muzzle':(.83,.66,.44),
 'nose':(.16,.105,.076),'nose_light':(.34,.21,.135),'eye':(.91,.635,.19),'eye_rim':(.20,.113,.070),'pupil':(.034,.025,.023),
 'eyeshine':(.99,.92,.55),'ear':(.61,.38,.195),'ear_inner':(.75,.45,.32),'stripe':(.315,.166,.079),
 'stripe_warm':(.83,.55,.259),'crest':(.31,.176,.094),'crest_warm':(.66,.345,.13),
 'tail':(.59,.33,.165),'tuft':(.285,.153,.095),'tuft_warm':(.54,.267,.135),
 'pad':(.215,.165,.126),'claw':(.83,.746,.545),'whisker':(.83,.78,.59),'cheek_plate':(.78,.685,.40),
 'tooth':(.96,.89,.72),'tongue':(.53,.245,.16)}
}
BONES=[('Root',None,(0,0,0)),('Body','Root',(0,1.07,0)),
 ('Spine','Body',(0,.08,.06)),('Neck','Body',(0,.08,-.65)),('Head','Neck',(0,-.04,-.39)),
 ('Jaw','Head',(0,-.12,-.23)),('Ear_L','Head',(-.22,.23,.06)),('Ear_R','Head',(.22,.23,.06)),
 ('Crest','Body',(0,.32,-.50)),('Tail_Base','Body',(0,.075,.79)),('Tail_Mid','Tail_Base',(0,-.17,.42)),('Tail_Tip','Tail_Mid',(0,-.12,.39)),
 ('ForeUpper_L','Body',(-.29,-.19,-.53)),('ForeLower_L','ForeUpper_L',(0,-.39,-.045)),('ForePaw_L','ForeLower_L',(0,-.37,-.065)),
 ('ForeUpper_R','Body',(.29,-.19,-.53)),('ForeLower_R','ForeUpper_R',(0,-.39,-.045)),('ForePaw_R','ForeLower_R',(0,-.37,-.065)),
 ('HindUpper_L','Body',(-.31,-.22,.60)),('HindLower_L','HindUpper_L',(0,-.40,.10)),('HindPaw_L','HindLower_L',(0,-.35,-.13)),
 ('HindUpper_R','Body',(.31,-.22,.60)),('HindLower_R','HindUpper_R',(0,-.40,.10)),('HindPaw_R','HindLower_R',(0,-.35,-.13))]
BID={name:i for i,(name,p,o) in enumerate(BONES)}
PARENT={name:p for name,p,o in BONES}
OFF={name:V(*o) for name,p,o in BONES}
REST={};G=defaultdict(lambda:dict(vertices=[],faces=[],joints=[]))

def setup(region,lod):
 global REGION,LOD,SZ,OFF,REST
 REGION=region;LOD=lod
 # The tropical form is shorter, lower, slimmer, with lighter forequarters.
 SZ=V(.81,.748,.815) if region=='tropical' else V(1,1,1)
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
 g['vertices'].extend((np.asarray(v,dtype=np.float64)*SZ+REST[bone]).tolist())
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

def generate_geometry():
 rng=random.Random(9007 if REGION=='tropical' else 2907)
 # Long wedge-shaped torso, raised shoulder and lean haunch; not a standard jaguar mesh.
 ellipsoid('Body','coat',(0,.00,0),(.365,.342,.92),14,24)
 ellipsoid('Body','flank',(0,-.12,.1),(.358,.286,.73),12,20)
 ellipsoid('Body','belly',(0,-.31,-.05),(.31,.12,.67),9,16)
 ellipsoid('Spine','back',(0,.19,-.13),(.312,.139,.69),10,20)
 ellipsoid('Body','hip',(0,.04,.60),(.345,.31,.36),12,18)
 ellipsoid('Body','shoulder',(0,.035,-.54),(.397 if REGION=='temperate_plains' else .365,.365,.39),12,20)
 ellipsoid('Neck','shoulder',(0,.00,-.10),(.295,.27,.42),11,18,tilt=-.12)
 ellipsoid('Neck','flank',(0,-.12,-.27),(.238,.21,.25),8,14)
 # Flattened mask-like head, distinctive brow and muzzle, keratin cheek edges.
 ellipsoid('Head','face',(0,.025,-.08),(.275,.244,.298),13,20)
 ellipsoid('Head','back',(0,.154,-.12),(.259,.133,.235),9,18)
 ellipsoid('Head','muzzle',(0,-.137,-.302),(.206,.134,.169),10,18)
 ellipsoid('Head','nose_light',(0,-.151,-.408),(.17,.086,.08),8,16)
 ellipsoid('Head','nose',(0,-.133,-.469),(.139,.06,.04),8,15)
 ellipsoid('Jaw','muzzle',(0,-.028,-.16),(.181,.085,.185),9,16)
 ellipsoid('Jaw','tongue',(0,.035,-.218),(.087,.013,.075),6,10)
 for side in (-1,1):
  label='L' if side<0 else 'R'
  ellipsoid('Head','eye_rim',(side*.236,.055,-.217),(.046,.066,.055),9,14)
  ellipsoid('Head','eye',(side*.272,.065,-.226),(.017,.042,.037),9,12)
  ellipsoid('Head','pupil',(side*.287,.071,-.229),(.009,.034,.012),8,10)
  ellipsoid('Head','eyeshine',(side*.291,.085,-.249),(.005,.008,.005),6,10)
  ellipsoid('Head','nose',(side*.093,-.142,-.47),(.024,.013,.012),6,9)
  ellipsoid('Head','cheek_plate',(side*.255,-.087,-.202),(.032,.056,.107),9,12,tilt=side*.24)
  ellipsoid('Head','stripe',(side*.25,.143,-.22),(.032,.018,.14),7,10,tilt=-side*.16)
  # Tall split shape of mobile ear: bone attachment, geometric inner cup.
  ellipsoid('Ear_'+label,'ear',(side*.047,.075,0),(.097,.15,.075),10,12,tilt=side*.22)
  ellipsoid('Ear_'+label,'ear_inner',(side*.051,.083,-.052),(.06,.105,.028),8,10,tilt=side*.22)
  # Directly modeled short fangs and whiskers.
  tube('Head','tooth',[(side*.118,-.246,-.36),(side*.11,-.286,-.38),(side*.115,-.32,-.395)],[.022,.013,.001],7)
  for j in range(3):
   a=-.16+j*.11
   tube('Head','whisker',[(side*.145,-.153,-.39),(side*(.23+j*.014),-.153+a,-.47),(side*(.27+j*.018),-.14+a*1.5,-.45)],[.004,.003,.0005],5)
 # Nape crest drawn as real fine polygon tapered bristles, compact enough for distance rendering.
 for j in range(112 if LOD==0 else 33):
  z=rng.uniform(-.29,.37);xx=rng.uniform(-.25,.25)
  ht=.055-.032*(abs(z)/.4)
  p=(xx,ht,z-.11)
  spur('Crest','crest' if j%3 else 'crest_warm',p,(xx*.8,.85,.20),rng.uniform(.045,.15),rng.uniform(.012,.026))
 # Angular broken side stripes, not round spots or rosettes.
 for side in (-1,1):
  for k in range(19 if LOD==0 else 9):
   z=-.62+k*.068+rng.uniform(-.02,.02)
   y=rng.uniform(-.11,.19)
   ratio=max(.16,1-(z/.98)**2-(y/.48)**2)
   xx=side*(.359*math.sqrt(ratio)+.022)
   length=rng.uniform(.07,.15)
   p0=(xx,y+.03,z-length*.43)
   p1=(xx+side*.010,y+.035,z+length*.16)
   p2=(xx,y-.045,z+length*.53)
   wedge('Body','stripe' if k%4 else 'stripe_warm',p0,p1,p2,w=.026)
  # Four stripes along cheek margins, clearly distinguish Nharuk from jaguar.
  for k in range(3):
   z=-.25+k*.10
   wedge('Head','stripe',(side*.254,.01,z-.025),(side*.265,.01,z),(side*.256,-.085,z+.10),.018)
 # Strong padded paws, claws. Legs jointed in three segments.
 for front in (True,False):
  for side,label in ((-1,'L'),(1,'R')):
   prefix='Fore' if front else 'Hind';up=prefix+'Upper_'+label;lo=prefix+'Lower_'+label;paw=prefix+'Paw_'+label
   ellipsoid(up,'shoulder' if front else 'hip',(0,-.135,0),(.173,.28,.178 if front else .195),11,14,tilt=.08*side)
   tube(up,'coat',[(0,.075,.00),(0,-.20,-.020 if front else .075),(0,-.39,-.045 if front else .105)], [.127,.111,.073],11)
   ellipsoid(lo,'flank',(0,-.17,-.016 if front else -.01),(.087,.23,.108),10,12)
   tube(lo,'coat',[(0,.03,.0),(0,-.17,-.018),(0,-.37,-.065 if front else -.13)],[.08,.063,.078],10)
   ellipsoid(paw,'pad',(0,-.034,-.105),(.140,.087,.188),8,16)
   ellipsoid(paw,'coat',(0,.014,-.093),(.154,.077,.183),9,15)
   for toe in range(4):
    x=(toe-1.5)*.069
    ellipsoid(paw,'flank',(x,-.034,-.215),(.044,.054,.093),7,9)
    tube(paw,'claw',[(x,-.024,-.253),(x,-.04,-.296),(x,-.071,-.315)],[.023,.016,.001],7)
 # Long counterweight tail, with recognizable terminal flattened paddle-like plume.
 tube('Tail_Base','tail',[(0,0,0),(0,-.025,.19),(0,-.11,.43)],[.090,.080,.064],11)
 tube('Tail_Mid','tail',[(0,.01,-.03),(0,-.05,.20),(0,-.04,.40)],[.067,.053,.045],10)
 tube('Tail_Tip','tail',[(0,.01,-.03),(0,-.05,.18),(0,-.045,.29)],[.046,.04,.027],9)
 ellipsoid('Tail_Tip','tuft',(0,-.045,.37),(.106,.098,.228),10,16)
 ellipsoid('Tail_Tip','tuft_warm',(0,.037,.38),(.087,.055,.17),7,12)
 for j in range(46 if LOD==0 else 15):
  a=rng.random()*math.tau
  zz=rng.uniform(.24,.56);rr=.085*math.sqrt(max(.02,1-((zz-.37)/.25)**2))
  spur('Tail_Tip','tuft' if j%3 else 'tuft_warm',(rr*math.cos(a),-.045+rr*math.sin(a),zz),(.4*math.cos(a),.4*math.sin(a),1),rng.uniform(.045,.13),rng.uniform(.010,.017))
 # Sparse guard hairs for silhouette, actual tapered low-poly strands.
 for j in range(130 if LOD==0 else 28):
  z=rng.uniform(-.55,.67);phi=rng.uniform(-.1,math.pi+.1)
  u=math.cos(phi);v=math.sin(phi)
  rr=math.sqrt(max(.1,1-(z/.96)**2));p=(u*.353*rr,v*.339*rr,z)
  spur('Body','back' if j%4 else 'stripe_warm',p,(u*.20,v*.30,1),rng.uniform(.028,.073),rng.uniform(.008,.013))

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
    times=np.asarray([t for t,val in vals],np.float32);result=np.asarray([val for t,val in vals],np.float32)
    assert len(times)==len(result) and len(times)>1 and abs(times[0])<1e-5 and abs(times[-1]-d)<1e-4,(name,joint,path)
    i=b.accessor(times,5126,'SCALAR',minmax=True)
    o=b.accessor(result,5126,'VEC4' if path=='rotation' else 'VEC3');k=len(samplers)
    samplers.append({'input':i,'output':o,'interpolation':'LINEAR'})
    channels.append({'sampler':k,'target':{'node':BID[joint],'path':path}})
  clips.append({'name':name,'samplers':samplers,'channels':channels,'extras':{'durationSeconds':d,'loop':loop}})
 def rot(fr,ax='x'):return {'rotation':rotations(fr,ax)}
 def bob(fr):return {'translation':translations('Body',[(t,(0,h,z)) for t,h,z in fr])}
 legs=['ForeUpper_L','ForeUpper_R','HindUpper_L','HindUpper_R']
 knees=['ForeLower_L','ForeLower_R','HindLower_L','HindLower_R']
 paws=['ForePaw_L','ForePaw_R','HindPaw_L','HindPaw_R']
 def gait(name,d,angle,knee,air,style='diagonal'):
  cs={'Body':bob([(0,0,0),(.25*d,air,0),(.5*d,air*.15,0),(.75*d,air,0),(d,0,0)]),
    'Neck':rot([(0,0),(.25*d,-3),(.5*d,3),(.75*d,-3),(d,0)]),
    'Head':rot([(0,0),(.25*d,-2),(.5*d,2),(.75*d,-2),(d,0)]),
    'Tail_Base':rot([(0,-9),(.5*d,10),(d,-9)],'y'),
    'Tail_Mid':rot([(0,6),(.5*d,-7),(d,6)],'y')}
  for j,n in enumerate(legs):
   phase=(j in (0,3)) if style=='diagonal' else (j<2)
   sign=[-1,0,1,0,-1] if phase else [1,0,-1,0,1]
   cs[n]=rot([(t*d/4,angle*val) for t,val in enumerate(sign)])
   kneesgn=[knee,5,0,knee*.6,knee] if phase else [0,knee*.65,knee,0,0]
   cs[knees[j]]=rot([(t*d/4,float(kneesgn[t])) for t in range(5)])
   cs[paws[j]]=rot([(t*d/4,-.30*float(kneesgn[t])) for t in range(5)])
  add(name,d,cs)
 gait('walk',1.60,17,18,.020)
 gait('trot',.92,28,26,.04)
 gait('run',.66,39,40,.082,'gallop')
 gait('cub_follow',1.30,18,19,.018)
 add('idle',3.0,{'Body':bob([(0,0,0),(.75,.011,0),(1.5,0,0),(2.25,.009,0),(3,0,0)]),'Head':rot([(0,0),(1,-7),(2.0,6),(3,0)],'y'),'Tail_Base':rot([(0,0),(.7,12),(1.6,-12),(3,0)],'y')})
 add('breathing',2.7,{'Body':bob([(0,0,0),(1.35,.015,0),(2.7,0,0)]),'Neck':rot([(0,0),(1.4,-2),(2.7,0)])})
 add('stalk',2.4,{'Body':bob([(0,-.08,0),(.6,-.11,0),(1.2,-.08,0),(1.8,-.11,0),(2.4,-.08,0)]),'Head':rot([(0,7),(.8,6),(1.6,8),(2.4,7)]),'ForeUpper_L':rot([(0,11),(.6,-10),(1.2,11),(1.8,-10),(2.4,11)]),'HindUpper_R':rot([(0,11),(.6,-10),(1.2,11),(1.8,-10),(2.4,11)])})
 add('crouch',1.5,{'Body':bob([(0,0,0),(.42,-.19,0),(1.1,-.20,0),(1.5,-.20,0)]),'Neck':rot([(0,0),(.45,13),(1.5,13)]),'Head':rot([(0,0),(.55,8),(1.5,8)]),**{p:rot([(0,0),(.5,20),(1.5,20)]) for p in knees}},False)
 add('ambush',1.8,{'Body':bob([(0,-.17,0),(.65,-.21,0),(1.2,-.16,0),(1.8,-.17,0)]),'Head':rot([(0,6),(.75,-6),(1.8,6)],'y'),'Tail_Base':rot([(0,-6),(.9,4),(1.8,-6)],'y')})
 add('pounce',1.3,{'Body':bob([(0,-.16,0),(.22,-.19,0),(.46,.20,-.12),(.66,.28,-.20),(1.02,.03,0),(1.3,0,0)]),'Neck':rot([(0,12),(.32,-10),(.68,-8),(1.3,0)]),'ForeUpper_L':rot([(0,15),(.47,-55),(.73,-40),(1.12,23),(1.3,0)]),'ForeUpper_R':rot([(0,15),(.47,-55),(.73,-40),(1.12,23),(1.3,0)]),'HindUpper_L':rot([(0,-13),(.37,26),(.63,30),(1.3,0)]),'HindUpper_R':rot([(0,-13),(.37,26),(.63,30),(1.3,0)])},False)
 add('bite',1.15,{'Neck':rot([(0,0),(.22,18),(.54,-24),(.82,-20),(1.15,0)]),'Jaw':rot([(0,0),(.33,30),(.61,4),(.90,18),(1.15,0)]),'Head':rot([(0,0),(.55,-9),(1.15,0)])},False)
 add('claw_sweep',1.3,{'Body':rot([(0,0),(.35,7),(.76,-8),(1.3,0)],'z'),'ForeUpper_R':rot([(0,0),(.32,-36),(.7,28),(1.3,0)]),'ForeLower_R':rot([(0,0),(.32,34),(.75,-22),(1.3,0)]),'Head':rot([(0,0),(.6,18),(1.3,0)],'y')},False)
 add('drag_prey',2.1,{'Neck':rot([(0,0),(.4,23),(1.5,23),(2.1,0)]),'Head':rot([(0,0),(.4,15),(1.2,12),(2.1,0)]),'Jaw':rot([(0,0),(.52,6),(1.55,6),(2.1,0)]),'Body':bob([(0,0,0),(.55,0,-.07),(1.3,0,.03),(2.1,0,0)])})
 add('feed',2.7,{'Neck':rot([(0,0),(.45,20),(2.2,21),(2.7,0)]),'Head':rot([(0,0),(.55,10),(1.3,5),(2.0,12),(2.7,0)]),'Jaw':rot([(0,0),(.65,19),(.93,0),(1.25,16),(1.55,0),(1.95,15),(2.7,0)])})
 add('drink',2.8,{'Neck':rot([(0,0),(.6,28),(2.0,29),(2.8,0)]),'Head':rot([(0,0),(.6,15),(2.05,15),(2.8,0)]),'Jaw':rot([(0,0),(1.1,6),(1.6,0),(2,5),(2.8,0)])})
 add('sniff',2.0,{'Neck':rot([(0,0),(.5,-11),(1.45,-10),(2,0)]),'Head':rot([(0,0),(.5,-18),(1.25,19),(2,0)],'y'),'Ear_L':rot([(0,0),(.65,-9),(2,0)],'z'),'Ear_R':rot([(0,0),(.65,9),(2,0)],'z')})
 add('listen',2.2,{'Head':rot([(0,0),(.55,-12),(1.4,9),(2.2,0)],'y'),'Ear_L':rot([(0,0),(.35,-19),(1.4,14),(2.2,0)],'z'),'Ear_R':rot([(0,0),(.35,-12),(1.3,17),(2.2,0)],'z')})
 add('alert',1.5,{'Neck':rot([(0,0),(.22,-20),(1.1,-19),(1.5,0)]),'Head':rot([(0,0),(.28,-14),(1.05,9),(1.5,0)],'y'),'Tail_Base':rot([(0,0),(.3,-11),(1.5,0)])},False)
 add('growl',2.1,{'Neck':rot([(0,0),(.35,-9),(1.6,-10),(2.1,0)]),'Jaw':rot([(0,0),(.43,10),(.83,17),(1.2,12),(1.65,22),(2.1,0)]),'Head':rot([(0,0),(.6,-5),(1.4,4),(2.1,0)])})
 add('threat_display',2.4,{'Crest':rot([(0,0),(.5,-15),(1.65,-13),(2.4,0)]),'Neck':rot([(0,0),(.5,-15),(1.85,-14),(2.4,0)]),'Jaw':rot([(0,0),(.55,22),(1.8,19),(2.4,0)]),'Tail_Base':rot([(0,0),(.7,17),(1.5,-10),(2.4,0)],'y')})
 add('groom',3.1,{'Neck':rot([(0,0),(.65,20),(2.45,19),(3.1,0)]),'Head':rot([(0,0),(.6,25),(1.1,18),(2,24),(3.1,0)],'y'),'Jaw':rot([(0,0),(1.2,5),(1.5,0),(2.1,8),(3.1,0)])})
 add('rest',3.2,{'Body':bob([(0,0,0),(.85,-.29,0),(2.4,-.31,0),(3.2,0,0)]),'Neck':rot([(0,0),(.9,10),(2.5,12),(3.2,0)]),**{p:rot([(0,0),(.9,32),(2.4,31),(3.2,0)]) for p in knees}},False)
 add('sleep',4.0,{'Body':bob([(0,-.30,0),(1,-.315,0),(2,-.30,0),(3,-.31,0),(4,-.30,0)]),'Neck':rot([(0,11),(2,14),(4,11)]),'Head':rot([(0,4),(2,6),(4,4)])})
 add('hurt',.84,{'Body':rot([(0,0),(.2,-11),(.5,9),(.84,0)],'z'),'Head':rot([(0,0),(.23,17),(.57,-7),(.84,0)],'y')},False)
 add('death',2.8,{'Body':{'rotation':rotations([(0,0),(.7,-14),(1.6,-67),(2.8,-87)],'z'),'translation':translations('Body',[(0,(0,0,0)),(.8,(0,-.14,0)),(1.9,(0,-.38,0)),(2.8,(0,-.41,0))])},'Neck':rot([(0,0),(1.2,22),(2.8,35)]),'Jaw':rot([(0,0),(1.6,12),(2.8,12)])},False)
 add('turn_left',1.1,{'Root':rot([(0,0),(.55,25),(1.1,45)],'y'),'Head':rot([(0,0),(.5,16),(1.1,0)],'y')},False)
 add('turn_right',1.1,{'Root':rot([(0,0),(.55,-25),(1.1,-45)],'y'),'Head':rot([(0,0),(.5,-16),(1.1,0)],'y')},False)
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
 nodes.append({'name':'Nharuk_MidPoly','mesh':0,'skin':0})
 nodes.append({'name':'Nharuk_v01','children':[0,len(nodes)-1]})
 inv=[]
 for name,_,_ in BONES:
  m=np.eye(4,dtype=np.float32);m[:3,3]=-REST[name];inv.append(m.T.reshape(-1))
 inverse=b.accessor(np.asarray(inv,np.float32),5126,'MAT4')
 anim=animations(b)
 gltf={'asset':{'version':'2.0','generator':'Wildhaven Nharuk mid-poly articulated procedural 0.1','copyright':'Original fictional creature Wildhaven'},'scene':0,'scenes':[{'name':'Nharuk','nodes':[len(nodes)-1]}],
  'nodes':nodes,'meshes':[{'name':f'Nharuk_{region}_LOD{lod}','primitives':primitives}],
  'skins':[{'name':'Nharuk_Rig','joints':list(range(len(BONES))),'inverseBindMatrices':inverse,'skeleton':0}],
  'materials':materials,'animations':anim,'bufferViews':b.views,'accessors':b.acc,'buffers':[{'byteLength':len(b.b)}],
  'extras':{'speciesId':'nharuk','region':region,'version':'0.1.0','unit':'metre','animationCount':len(anim),'limitations':['rigid region skin weights','in-place motion','missing collision and AI','concept prototype awaiting visual approval']}}
 js=json.dumps(gltf,ensure_ascii=False,separators=(',',':')).encode('utf-8');js+=b' '*((-len(js))%4)
 binary=bytes(b.b)+b'\0'*((-len(b.b))%4)
 blob=struct.pack('<4sII',b'glTF',2,12+8+len(js)+8+len(binary))+struct.pack('<I4s',len(js),b'JSON')+js+struct.pack('<I4s',len(binary),b'BIN\0')+binary
 filename=f'nharuk_{region}_{"LOD1_" if lod else ""}animated_v01.glb';path=HERE/filename;path.write_bytes(blob)
 bbox=np.vstack([np.asarray(v['vertices']) for v in G.values()])
 return {'file':filename,'region':region,'lod':lod,'bytes':len(blob),'sha256':hashlib.sha256(blob).hexdigest(),'vertices':vertex_count,'triangles':triangles,'joints':len(BONES),'materials':len(materials),'clips':[x['name'] for x in anim],'boundsMin':bbox.min(axis=0).round(4).tolist(),'boundsMax':bbox.max(axis=0).round(4).tolist()}

if __name__=='__main__':
 entries=[export(region,lod) for region in ('tropical','temperate_plains') for lod in (0,1)]
 (HERE/'nharuk_manifest.json').write_text(json.dumps({'speciesId':'nharuk','version':'0.1.0','files':entries},indent=2,ensure_ascii=False)+'\n')
 print(json.dumps([{'file':e['file'],'bytes':e['bytes'],'tris':e['triangles'],'verts':e['vertices'],'animations':len(e['clips'])} for e in entries],indent=2))
