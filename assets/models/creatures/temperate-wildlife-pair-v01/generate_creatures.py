#!/usr/bin/env python3
"""Wildhaven original creatures: real geometric 3D GLB 2.0 + joint animations.
Pure NumPy procedural mesh + articulated skin. Deterministic generation.
Species: Carniroca carrion bird and Tufrilo woodland herbivore.
Usage: python generate_creatures.py
"""
from __future__ import annotations
import math, json, struct, hashlib, sys
from pathlib import Path
from collections import defaultdict
import numpy as np
D=Path(__file__).resolve().parent
V=lambda *v:np.array(v,float)

def qrot(axis,deg):
 a=math.radians(float(deg))/2; vec=V(*axis);vec=vec/np.linalg.norm(vec)
 return np.r_[vec*math.sin(a),math.cos(a)]
def qmul(a,b):
 x,y,z,w=a; X,Y,Z,W=b
 return V(w*X+x*W+y*Z-z*Y,w*Y-x*Z+y*W+z*X,w*Z+x*Y-y*X+z*W,w*W-x*X-y*Y-z*Z)
def quat(pitch=0,yaw=0,roll=0):return (lambda x:x/np.linalg.norm(x))(qmul(qmul(qrot((0,1,0),yaw),qrot((1,0,0),pitch)),qrot((0,0,1),roll)))

class Geometry:
 def __init__(self,creature,lod=0):
  self.creature=creature;self.lod=lod
  self.bones=(BIRD_BONES if creature=='carniroca' else TUFRILO_BONES)
  self.names=[b[0] for b in self.bones];self.pmap={b:p for b,p,_ in self.bones};self.trans={b:V(*t) for b,p,t in self.bones};self.ids={b:i for i,b in enumerate(self.names)}
  def rest(b):
   p=V(0,0,0)
   while b is not None:p=p+self.trans[b];b=self.pmap[b]
   return p
  self.rest={b:rest(b) for b in self.names};self.groups=defaultdict(lambda:{'v':[],'f':[],'j':[]});self.materials=(BIRD_COLORS if creature=='carniroca' else TUFRILO_COLORS)
  self.lat=8 if lod else 12;self.lon=12 if lod else 18
 def add(self,bone,mat,verts,faces):
  if len(verts)==0:return
  g=self.groups[mat];off=len(g['v']);org=self.rest[bone];g['v'].extend((np.asarray(verts,float)+org).tolist());g['f'].extend([[int(a)+off,int(b)+off,int(c)+off] for a,b,c in faces]);g['j'].extend([self.ids[bone]]*len(verts))
 def sphere(self,bone,mat,c,r,lat=None,lon=None,tilt=0):
  lat=lat or self.lat;lon=lon or self.lon; verts=[];faces=[];rx,ry,rz=r
  ct,st=math.cos(tilt),math.sin(tilt)
  for i in range(lat+1):
   theta=math.pi*i/lat
   for j in range(lon):
    phi=2*math.pi*j/lon
    x=rx*math.sin(theta)*math.cos(phi);y=ry*math.cos(theta);z=rz*math.sin(theta)*math.sin(phi)
    verts.append((c[0]+x,c[1]+y*ct-z*st,c[2]+y*st+z*ct))
  for i in range(lat):
   for j in range(lon):
    a=i*lon+j;b=i*lon+(j+1)%lon;c0=(i+1)*lon+j;d=(i+1)*lon+(j+1)%lon
    faces.extend([[a,b,c0],[b,d,c0]])
  self.add(bone,mat,verts,faces)
 def link(self,bone,mat,a,b,r0,r1=None,sides=None):
  sides=sides or (6 if self.lod else 9);r1=r0 if r1 is None else r1
  a=V(*a);b=V(*b);delta=b-a;length=np.linalg.norm(delta)
  if length<1e-8:return
  axis=delta/length;u=np.cross(axis,V(0,0,1));u=u/(np.linalg.norm(u)+1e-15) if np.linalg.norm(u)>1e-7 else V(1,0,0);v=np.cross(axis,u)
  verts=[];faces=[]
  for origin,r in ((a,r0),(b,r1)):
   for j in range(sides):
    ph=j*math.tau/sides;verts.append(origin+r*(u*math.cos(ph)+v*math.sin(ph)))
  for j in range(sides):
   k=(j+1)%sides;faces.extend([[j,k,j+sides],[k,k+sides,j+sides]])
  for j in range(1,sides-1):faces.extend([[0,j,j+1],[sides,sides+j+1,sides+j]])
  self.add(bone,mat,verts,faces)
 def feather(self,bone,mat,a,b,width,thick=.006,arch=.01,segments=None):
  # closed convex curved vanes, real 3D not billboards
  seg=segments or (3 if self.lod else 5);a=V(*a);b=V(*b);delta=b-a;ld=np.linalg.norm(delta)
  if ld<1e-8:return
  direction=delta/ld;n=V(0,1,0);cross=np.cross(direction,n)
  if np.linalg.norm(cross)<.01:cross=np.cross(direction,V(0,0,1))
  cross=cross/np.linalg.norm(cross);n=np.cross(cross,direction)
  verts=[];faces=[]
  for i in range(seg+1):
   t=i/seg;w=width*(.13+.87*math.sin(math.pi*(.03+.93*t))**.8)*(1-t**7)
   p=a+delta*t+n*(arch*math.sin(math.pi*t))
   verts.extend([p-cross*w,p+n*thick,p+cross*w,p-n*thick*.5])
  for i in range(seg):
   s=i*4;t=(i+1)*4
   faces.extend([[s,t,s+1],[s+1,t,t+1],[s+1,t+1,s+2],[s+2,t+1,t+2],[s+2,t+2,s+3],[s+3,t+2,t+3],[s+3,t+3,s],[s,t+3,t]])
  self.add(bone,mat,verts,faces)
 def capsule(self,bone,mat,center,r,dir=(0,0,0)):
  self.sphere(bone,mat,center,r,tilt=dir[0] if dir else 0)
 def head_eye(self,bone,side,base,pupil='pupil',amber='eye'):
  x,y,z=base;self.sphere(bone,'eye_rim',(x,y,z),(.028,.031,.030),lat=8,lon=12)
  self.sphere(bone,amber,(x+side*.013,y,z-.010),(.019,.023,.020),lat=8,lon=12)
  self.sphere(bone,pupil,(x+side*.027,y,z-.014),(.010,.013,.013),lat=8,lon=12)
  self.sphere(bone,'glint',(x+side*.035,y+.010,z-.022),(.005,.006,.005),lat=6,lon=8)

BIRD_COLORS={
 'charcoal':(.155,.169,.156),'blueblack':(.105,.132,.14),'shadow':(.09,.106,.108),'warm_black':(.212,.18,.153),
 'rust':(.57,.245,.122),'copper':(.735,.36,.16),'ochre':(.69,.50,.27),'bone':(.76,.70,.57),
 'neck':(.49,.365,.335),'neck_dark':(.36,.25,.225),'face':(.48,.31,.27),'beak':(.71,.67,.57),'beak_tip':(.38,.37,.325),
 'eye_rim':(.145,.115,.115),'eye':(.91,.60,.20),'pupil':(.08,.052,.045),'glint':(.98,.93,.75),
 'feet':(.42,.40,.35),'feet_dark':(.32,.31,.29),'claw':(.79,.75,.64)
}
BIRD_BONES=[
 ('Root',None,(0,.66,0)),('Body','Root',(0,.045,.015)),('Neck','Body',(0,.18,-.17)),('Head','Neck',(0,.19,-.06)),('Jaw','Head',(0,-.046,-.073)),
 ('Wing_L','Body',(-.16,.12,.0)),('Forewing_L','Wing_L',(-.32,-.02,.015)),('Wingtip_L','Forewing_L',(-.30,-.02,.017)),
 ('Wing_R','Body',(.16,.12,.0)),('Forewing_R','Wing_R',(.32,-.02,.015)),('Wingtip_R','Forewing_R',(.30,-.02,.017)),
 ('Tail','Body',(0,-.012,.24)),('Thigh_L','Root',(-.102,-.13,.13)),('Shank_L','Thigh_L',(0,-.225,.002)),('Foot_L','Shank_L',(0,-.175,-.012)),
 ('Thigh_R','Root',(.102,-.13,.13)),('Shank_R','Thigh_R',(0,-.225,.002)),('Foot_R','Shank_R',(0,-.175,-.012))
]
TUFRILO_COLORS={
 'moss':(.325,.365,.233),'bark':(.365,.284,.188),'russet':(.56,.36,.185),'warm':(.65,.45,.265),'dark':(.222,.24,.185),'stripe':(.71,.66,.37),
 'cream':(.88,.80,.61),'belly':(.78,.68,.52),'ear_in':(.72,.47,.40),'ear_edge':(.51,.41,.24),'snout':(.77,.66,.53),
 'nose':(.31,.21,.18),'eye_rim':(.27,.21,.18),'eye':(.80,.53,.21),'pupil':(.105,.075,.048),'glint':(.97,.96,.83),'paws':(.41,.34,.26),'claw':(.69,.60,.43)
}
TUFRILO_BONES=[
 ('Root',None,(0,.255,0)),('Body','Root',(0,.015,0)),('Neck','Body',(0,.035,-.145)),('Head','Neck',(0,.055,-.105)),
 ('Ear_L','Head',(-.072,.105,-.025)),('Ear_R','Head',(.072,.105,-.025)),('Jaw','Head',(0,-.067,-.091)),('Tail','Body',(0,.038,.222)),
 ('FrontUpper_L','Body',(-.116,-.071,-.145)),('FrontLower_L','FrontUpper_L',(0,-.094,-.014)),('FrontFoot_L','FrontLower_L',(0,-.067,-.018)),
 ('FrontUpper_R','Body',(.116,-.071,-.145)),('FrontLower_R','FrontUpper_R',(0,-.094,-.014)),('FrontFoot_R','FrontLower_R',(0,-.067,-.018)),
 ('HindUpper_L','Body',(-.122,-.045,.160)),('HindLower_L','HindUpper_L',(0,-.105,.018)),('HindFoot_L','HindLower_L',(0,-.080,-.046)),
 ('HindUpper_R','Body',(.122,-.045,.160)),('HindLower_R','HindUpper_R',(0,-.105,.018)),('HindFoot_R','HindLower_R',(0,-.080,-.046))
]

def carniroca_model(g):
 lo=g.lod
 # muscular body with tapered breast and upper back. facing -Z
 g.sphere('Body','charcoal',(0,.005,.012),(.20,.22,.285),lat=11 if lo else 16,lon=15 if lo else 24,tilt=-.16)
 g.sphere('Body','warm_black',(0,-.09,-.151),(.155,.142,.168),tilt=.18)
 g.sphere('Body','shadow',(0,.155,.06),(.171,.066,.195))
 for side in (-1,1):
  # rows of layered feather scales on breast/flanks
  for k in range(3 if lo else 5):
   for j in range(5 if lo else 8):
    z=-.13+j*.044; x=side*(.14+.01*math.sin(k+j))
    y=.10-k*.058
    mat=['blueblack','charcoal','rust','warm_black','shadow'][(k+2*j)%5]
    g.feather('Body',mat,(x*.8,y,z),(x*1.03,y-.029,z+.07),.019 if lo else .013)
 # featherless highly articulated S-shaped neck
 g.sphere('Neck','neck',(0,.068,-.025),(.095,.157,.105),tilt=-.17)
 g.sphere('Neck','neck_dark',(0,.124,-.064),(.071,.095,.077))
 for side in (-1,1):
  for j in range(3 if lo else 5):
   g.feather('Neck','warm_black',(side*.06,-.03+j*.039,.034),(side*.082,-.060+j*.037,.073),.015)
 # angular head and bare facial features
 g.sphere('Head','face',(0,.001,-.025),(.098,.087,.116),lat=11,lon=16,tilt=-.19)
 g.sphere('Head','neck_dark',(0,-.034,-.105),(.065,.043,.055),lat=8,lon=12)
 for side in (-1,1):
  g.head_eye('Head',side,(side*.081,.021,-.072))
  g.sphere('Head','neck',(side*.073,-.047,-.013),(.034,.032,.07))
 # hooked beak: tapered prominent pointed downward beak as curved segmented hard shell
 g.link('Head','beak',(0,-.028,-.112),(0,-.057,-.205),.057,.031,sides=11)
 g.link('Head','beak_tip',(0,-.052,-.196),(0,-.113,-.229),.033,.007,sides=9)
 g.link('Jaw','beak',(0,.002,-.01),(0,-.015,-.107),.033,.006,sides=7)
 # discrete flared nostrils
 for side in (-1,1):g.sphere('Head','shadow',(side*.032,-.029,-.151),(.009,.006,.011),lat=6,lon=8)
 # each extended wing, flight feathers and midwing feathers on upper and distal bones
 for side, names in ((-1,('Wing_L','Forewing_L','Wingtip_L')),(1,('Wing_R','Forewing_R','Wingtip_R'))):
  a,b,c=names
  g.sphere(a,'warm_black',(side*.14,-.016,.02),(.186,.060,.119),lat=8,lon=16)
  g.link(a,'blueblack',(0,0,0),(side*.33,-.022,.012),.078,.064,sides=11)
  g.sphere(b,'charcoal',(side*.145,-.009,.015),(.165,.056,.095),lat=8,lon=12)
  g.link(b,'blueblack',(0,0,0),(side*.30,-.005,.012),.063,.041,sides=11)
  g.sphere(c,'shadow',(side*.105,0,0),(.112,.038,.074),lat=7,lon=12)
  for bone,reach,count in [(a,.34,6 if lo else 10),(b,.32,6 if lo else 10),(c,.21,5 if lo else 8)]:
   for i in range(count):
    t=i/(count-1); sx=side*(.04+.07*t); y=.013-.006*t;z=-.05+t*.12
    length=reach*(.92-.32*t)
    g.feather(bone, ['charcoal','rust','blueblack','copper','warm_black'][(i+2)%5],(sx,y,z),
      (sx+side*length,-.04-.035*t,z+.09+.08*t),.040*(.85+.25*t) if not lo else .052,arch=.012)
  for bone,count in [(a,5 if lo else 9),(b,4 if lo else 7)]:
   for i in range(count):
    t=i/(count-1)
    g.feather(bone,['rust','copper','warm_black'][i%3],(side*(.04+i*.032),.044,-.075+t*.14),
     (side*(.15+i*.033),-.022,-.065+t*.15),.013 if not lo else .019)
 # tail fan, wings not glued to it
 g.sphere('Tail','charcoal',(0,-.02,.075),(.094,.064,.125))
 for k in range(7 if lo else 13):
  t=(k-(6 if not lo else 3))/(6 if not lo else 3)
  g.feather('Tail',['rust','warm_black','shadow','copper','charcoal'][k%5],(t*.035,0,.07),(t*.205,-.055,.36-abs(t)*.06),.030 if lo else .021,arch=.014)
 # sturdy talons, fully separated legs
 for side in (-1,1):
  thigh,shank,foot=('Thigh_L','Shank_L','Foot_L') if side<0 else ('Thigh_R','Shank_R','Foot_R')
  g.sphere(thigh,'charcoal',(0,-.052,0),(.082,.121,.100),lat=8,lon=12)
  g.link(thigh,'feet_dark',(0,-.09,.013),(0,-.218,.0),.036,.028)
  g.link(shank,'feet',(0,.008,0),(0,-.172,0),.028,.023)
  g.sphere(foot,'feet',(0,-.008,-.018),(.045,.030,.070))
  for j in (-1,0,1):
   t=(j*.066,-.019,-.116+abs(j)*.015)
   g.link(foot,'feet',(0,-.012,-.018),t,.022,.012,sides=7)
   g.link(foot,'claw',t,(t[0]*1.16,-.037,t[2]-.056),.013,.001,sides=7)
  g.link(foot,'feet_dark',(0,-.012,-.012),(side*.03,-.018,.066),.017,.004,sides=6)

def tufrilo_model(g):
 lo=g.lod
 # compact pear shape, distinct from a mouse/rabbit. brown moss with cream collar
 g.sphere('Body','moss',(0,0,.022),(.183,.165,.251),lat=11 if lo else 17,lon=15 if lo else 24,tilt=-.10)
 g.sphere('Body','belly',(0,-.085,-.073),(.15,.084,.161),lat=8,lon=16)
 g.sphere('Body','bark',(0,.119,.06),(.132,.057,.163),lat=8,lon=18)
 # dyed natural stripe segments and coat pattern (actual surface geometry, not texture)
 for side in (-1,1):
  for i in range(3 if lo else 5):
   z=-.12+i*.072
   for j in range(1 if lo else 2):
    g.feather('Body','stripe' if i%2==0 else 'russet',(side*.126,.072-j*.045,z),
      (side*.17,.038-j*.04,z+.043),.018 if lo else .012,thick=.003)
  # independent leafy dorsal bristles / mane
  for j in range(4 if lo else 8):
   z=-.17+j*.063; x=side*.047
   g.feather('Body','dark' if j%3 else 'warm',(x,.153,z),(side*.081,.197+(j%2)*.009,z+.034),.016 if lo else .010,arch=.008)
 g.sphere('Neck','warm',(0,.003,-.025),(.136,.119,.139))
 g.sphere('Neck','cream',(0,-.054,-.065),(.109,.073,.11))
 g.sphere('Head','bark',(0,.003,-.035),(.131,.118,.131),lat=10 if lo else 14,lon=15 if lo else 20,tilt=-.15)
 g.sphere('Head','cream',(0,-.049,-.103),(.103,.057,.091))
 g.sphere('Head','snout',(0,-.050,-.16),(.074,.047,.081),lat=8,lon=12)
 g.sphere('Head','nose',(0,-.035,-.238),(.032,.018,.025),lat=7,lon=10)
 g.link('Jaw','cream',(0,.0,0),(0,-.025,-.098),.044,.027,sides=8)
 for side in (-1,1):
  g.head_eye('Head',side,(side*.109,.028,-.082))
  g.sphere('Head','belly',(side*.085,-.043,-.102),(.044,.057,.054),lat=8,lon=10)
  # two long leaf ears with flesh middle, upright at neutral pose
  ear='Ear_L' if side<0 else 'Ear_R'
  g.feather(ear,'ear_edge',(0,0,0),(side*.025,.20,.012),.055 if not lo else .059,thick=.009,arch=.007,segments=5)
  g.feather(ear,'ear_in',(side*.001,.030,-.011),(side*.021,.172,-.004),.037 if not lo else .041,thick=.003,arch=.006,segments=5)
  for i in range(3 if lo else 5):
   g.feather('Head','cream',(side*.06,.071,-.042+i*.02),(side*.105,.104+i*.004,-.039+i*.018),.012)
 # tufted short tail
 g.sphere('Tail','warm',(0,0,.041),(.066,.076,.065))
 for i in range(5 if lo else 9):
  t=(i-(4 if not lo else 2))/(4 if not lo else 2)
  g.feather('Tail','cream' if i%2 else 'russet',(t*.024,0,.037),(t*.095,.055,.153),.019 if lo else .014,arch=.008)
 for side in (-1,1):
  for isfront in (True,False):
   prefix='Front' if isfront else 'Hind';sfx='_L' if side<0 else '_R';a,b,c=[prefix+x+sfx for x in ('Upper','Lower','Foot')]
   if isfront:
    g.sphere(a,'moss',(0,-.023,.007),(.063,.093,.067),lat=8,lon=11)
    g.link(a,'paws',(0,-.045,.0),(0,-.100,-.015),.035,.028)
    g.link(b,'paws',(0,.015,.008),(0,-.071,-.019),.029,.021)
    g.sphere(c,'paws',(0,0,-.021),(.045,.025,.069))
   else:
    g.sphere(a,'bark',(0,-.025,.003),(.109,.113,.114),lat=9,lon=13)
    g.link(a,'paws',(0,-.08,.021),(0,-.132,.018),.051,.037)
    g.link(b,'paws',(0,.004,.005),(0,-.077,-.018),.036,.028)
    g.sphere(c,'paws',(0,0,-.036),(.069,.032,.094),lat=8,lon=12)
   for j in (-1,0,1):
    x=j*(.028 if isfront else .039);z=-.072 if isfront else -.109
    g.link(c,'claw',(x*.65,-.016,z+.034),(x,-.025,z-.018),.011,.001,sides=6)

# --- timed hand-authored skeletal motion (not fake sprite frame transforms) ---
BIRD_CLIPS=['idle','breathing','walk','hop','takeoff','fly','glide','flap_hard','bank_left','bank_right','land','wing_fold','perch','scan','approach_carcass','peck_carrion','tear_meat','swallow','threaten','call','preen','rest','sleep','hurt','death']
TUFRILO_CLIPS=['idle','breathing','walk','hop','bound','sprint','turn_left','turn_right','sniff','forage','nibble','collect_seed','stash_seed','dig','look_around','alert_call','freeze','flee','hide','groom','drink','rest','sleep','hurt','death']
BIRD_DUR=[3.0,3.2,1.4,.8,1.6,1.45,2.7,.72,2.1,2.1,1.7,1.5,2.5,2.7,1.8,1.55,1.9,1.1,1.3,1.7,2.9,2.5,3.3,.85,2.8]
TUFRILO_DUR=[2.5,3.0,1.05,.82,.7,.52,1.4,1.4,1.6,1.9,1.25,1.55,1.9,1.7,2.3,1.6,1.25,.63,2.4,2.4,1.6,2.5,3.0,.78,2.2]

def motion(g,name,t):
 # output is euler rotations in degrees and absolute root translation in world metres
 cyc=math.tau*t; sin=math.sin;cos=math.cos
 A={}; trans={}
 def rot(b,p=None,y=None,r=None):
  old=A.get(b,(0.,0.,0.));A[b]=(old[0] if p is None else p,old[1] if y is None else y,old[2] if r is None else r)
 def move(b,dx=0,dy=0,dz=0):trans[b]=g.trans[b]+V(dx,dy,dz)
 bird=g.creature=='carniroca'
 wave=sin(cyc);smooth=lambda z:z*z*(3-2*z)
 if bird:
  wingL,foreL,tipL='Wing_L','Forewing_L','Wingtip_L';wingR,foreR,tipR='Wing_R','Forewing_R','Wingtip_R'
  # ground posture: wing joints sweep backwards, avoiding permanent outstretched T-pose
  rot(wingL,y=72);rot(wingR,y=-72);rot(foreL,y=26);rot(foreR,y=-26)
  if name in ('idle','breathing'):
   rot('Body',p=1.4*wave);rot('Neck',p=2*sin(cyc-.7));rot('Head',y=6*sin(cyc*.52));rot('Tail',p=4*sin(cyc*.52))
  if name in ('walk','hop','approach_carcass','takeoff','land'):
   hops={'walk':.018,'hop':.09,'approach_carcass':.006,'takeoff':.15,'land':.13}
   b=hops[name];move('Root',dy=b*(max(0,sin(cyc)) if name not in ('takeoff','land') else (smooth(t) if name=='takeoff' else smooth(1-t))))
   angle=30 if name=='walk' else 46
   rot('Thigh_L',p=angle*sin(cyc));rot('Shank_L',p=-20*sin(cyc+.5));rot('Thigh_R',p=-angle*sin(cyc));rot('Shank_R',p=20*sin(cyc+.5))
   rot('Neck',p=7*sin(cyc));rot('Head',p=-5*sin(cyc));
   if name in ('takeoff','land'):
    fl=sin(cyc*1.5);openwing=(smooth(t) if name=='takeoff' else 1-smooth(t));rot(wingL,y=72*(1-openwing),r=-52*fl-15);rot(wingR,y=-72*(1-openwing),r=52*fl+15)
  if name in ('fly','flap_hard','glide','bank_left','bank_right'):
   if name in ('fly','flap_hard'):
    amp=42 if name=='fly' else 69
    rot(wingL,y=0,r=-amp*sin(cyc));rot(wingR,y=0,r=amp*sin(cyc));rot(foreL,y=0,r=-(amp*.5)*sin(cyc-.3));rot(foreR,y=0,r=(amp*.5)*sin(cyc-.3))
    rot(tipL,r=-14*sin(cyc-.6));rot(tipR,r=14*sin(cyc-.6))
    move('Root',dy=.35+.055*sin(cyc-.2))
   else:
    bank=25 if name=='bank_left' else (-25 if name=='bank_right' else 0)
    move('Root',dy=.33+.015*sin(cyc));rot('Root',r=bank*(.5+.5*sin(cyc*.5)))
    rot(wingL,y=0,r=-11+6*sin(cyc));rot(wingR,y=0,r=11-6*sin(cyc));rot(foreL,y=0);rot(foreR,y=0);rot('Tail',y=bank*.5)
   rot('Thigh_L',p=-28);rot('Thigh_R',p=-28);rot('Shank_L',p=40);rot('Shank_R',p=40);rot('Neck',p=-8)
  if name=='wing_fold':
   f=sin(math.pi*t);rot(wingL,y=72-60*f,r=35*f);rot(wingR,y=-72+60*f,r=-35*f);rot(foreL,y=26-20*f,r=24*f);rot(foreR,y=-26+20*f,r=-24*f)
  if name in ('perch','rest','sleep'):
   w=smooth(min(1,t*2));rot('Thigh_L',p=20*w);rot('Thigh_R',p=20*w);rot('Neck',p=-20*w);rot('Head',y=16*w);move('Root',dy=-.08*w)
  if name in ('scan','preen'):
   rot('Neck',y=32*sin(cyc*.75));rot('Head',y=18*sin(cyc+.3),p=8*sin(cyc*.5));
   if name=='preen':rot('Neck',p=-32);rot('Head',p=-28);rot(wingL,r=-22*sin(cyc));rot(wingR,r=24*sin(cyc+.4))
  if name in ('peck_carrion','tear_meat','swallow'):
   if name=='swallow':
    rot('Neck',p=27*sin(math.pi*t));rot('Head',p=34*sin(math.pi*t));rot('Jaw',p=-18*max(0,sin(cyc*3)))
   else:
    q=.5*(1-cos(cyc));rot('Neck',p=-43*q + (12*sin(cyc*2) if name=='tear_meat' else 0));rot('Head',p=-18*q);rot('Jaw',p=-24*max(0,sin(cyc*3)))
    rot('Body',p=-8*q)
  if name in ('threaten','call'):
   e=abs(math.sin(math.pi*t));rot(wingL,y=18*e+72*(1-e));rot(wingR,y=-18*e-72*(1-e));rot('Neck',p=24*e);rot('Head',p=12*e);rot(wingL,r=-40*e);rot(wingR,r=40*e);rot('Jaw',p=-22*max(0,sin(cyc*3)))
  if name=='hurt':rot('Body',r=19*sin(math.pi*t)*cos(cyc*1.5));rot('Neck',p=-22*sin(math.pi*t))
  if name=='death':
   e=smooth(min(1,t*1.4));rot('Root',r=-85*e);move('Root',dy=-.24*e,dx=-.25*e);rot('Neck',p=-35*e);rot(wingL,r=35*e);rot(wingR,r=-25*e)
 else:
  if name in ('idle','breathing'):
   rot('Body',p=1.9*wave);rot('Head',y=8*sin(cyc*.45));rot('Ear_L',r=-7*sin(cyc*.55));rot('Ear_R',r=7*sin(cyc*.55));rot('Tail',y=8*sin(cyc*.45))
  if name in ('walk','hop','bound','sprint','flee'):
   amp={'walk':16,'hop':28,'bound':43,'sprint':49,'flee':54}[name];jump={'walk':.01,'hop':.095,'bound':.07,'sprint':.034,'flee':.052}[name]
   move('Root',dy=jump*max(0,sin(cyc)))
   rot('FrontUpper_L',p=amp*sin(cyc));rot('FrontLower_L',p=-.48*amp*sin(cyc+.7))
   rot('FrontUpper_R',p=amp*sin(cyc+.8 if name in ('hop','bound') else cyc+math.pi));rot('FrontLower_R',p=-.48*amp*sin(cyc+1.5))
   rot('HindUpper_L',p=-amp*sin(cyc+.4));rot('HindLower_L',p=.62*amp*sin(cyc+.9))
   rot('HindUpper_R',p=-amp*sin(cyc+(1.0 if name=='walk' else .5)));rot('HindLower_R',p=.62*amp*sin(cyc+1.2))
   rot('Head',p=-5*sin(cyc));rot('Tail',p=16*sin(cyc))
   if name=='flee':rot('Ear_L',r=30);rot('Ear_R',r=-30)
  if name in ('turn_left','turn_right'):
   mul=1 if name=='turn_left' else -1
   rot('Root',y=mul*45*(.5-.5*cos(math.pi*t)));rot('Head',y=mul*12*sin(math.pi*t))
  if name in ('sniff','forage','nibble','collect_seed','stash_seed','dig','drink'):
   a=34 if name in ('sniff','forage','drink') else 50
   foraging=.5*(1-cos(cyc));rot('Neck',p=-a*foraging);rot('Head',p=-15*foraging)
   if name in ('nibble','collect_seed','stash_seed'):rot('Jaw',p=11*max(0,sin(cyc*4)))
   if name in ('dig','stash_seed'):
    rot('FrontUpper_L',p=32*sin(cyc*3));rot('FrontUpper_R',p=32*sin(cyc*3+math.pi));rot('FrontLower_L',p=-17*sin(cyc*3));rot('FrontLower_R',p=-17*sin(cyc*3+math.pi))
   if name=='collect_seed':rot('FrontUpper_L',p=-38*max(0,sin(math.pi*t)));rot('FrontUpper_R',p=-38*max(0,sin(math.pi*t)))
  if name in ('look_around','alert_call','freeze'):
   rot('Head',y=27*sin(cyc));rot('Ear_L',r=-25*sin(cyc*.7));rot('Ear_R',r=25*sin(cyc*.7));
   if name=='alert_call':rot('Head',p=20*sin(math.pi*t));rot('Jaw',p=24*max(0,sin(cyc*3)))
   if name=='freeze':rot('Body',p=0);rot('Head',y=10*sin(cyc*.4))
  if name in ('hide','rest','sleep'):
   e=math.sin(math.pi*t) if name=='hide' else smooth(min(1,t*1.3))
   move('Root',dy=-.082*e);rot('Head',p=-12*e);rot('Ear_L',r=35*e);rot('Ear_R',r=-35*e)
  if name=='groom':rot('Head',y=31*sin(cyc));rot('FrontUpper_L',p=-28*sin(cyc));rot('FrontLower_L',p=27*sin(cyc+1))
  if name=='hurt':rot('Body',r=20*sin(math.pi*t)*cos(cyc*2));rot('Head',p=-19*sin(math.pi*t))
  if name=='death':
   e=smooth(min(1,t*1.5));rot('Root',r=85*e);move('Root',dy=-.11*e,dx=.13*e);rot('Head',p=-24*e);rot('Ear_L',r=45*e);rot('Ear_R',r=-45*e)
 return A,trans

class Binary:
 def __init__(self):self.b=bytearray();self.views=[];self.accessors=[]
 def access(self,arr,component,typ,target=None,minmax=False):
  a=np.asarray(arr,dtype={5123:'<u2',5125:'<u4',5126:'<f4'}[component]);raw=a.tobytes();self.b.extend(b'\0'*((-len(self.b))%4));off=len(self.b);self.b.extend(raw)
  view={'buffer':0,'byteOffset':off,'byteLength':len(raw)}
  if target:view['target']=target
  vid=len(self.views);self.views.append(view);ac={'bufferView':vid,'componentType':component,'count':len(a),'type':typ}
  if minmax:ac['min']=a.min(axis=0).ravel().tolist() if a.ndim>1 else [float(a.min())];ac['max']=a.max(axis=0).ravel().tolist() if a.ndim>1 else [float(a.max())]
  n=len(self.accessors);self.accessors.append(ac);return n

def export(g):
 bi=Binary();mats=[{'name':name,'pbrMetallicRoughness':{'baseColorFactor':list(map(float,col))+[1.0],'metallicFactor':0.0,'roughnessFactor':.88},'doubleSided':True} for name,col in g.materials.items()];mid={s:i for i,s in enumerate(g.materials)}
 prim=[];tri_count=0;vert_count=0;bounds=[]
 for name,buf in g.groups.items():
  xyz=np.array(buf['v'],np.float32);faces=np.array(buf['f'],np.uint32)
  if len(faces)==0:continue
  nrm=np.zeros_like(xyz);n=np.cross(xyz[faces[:,1]]-xyz[faces[:,0]],xyz[faces[:,2]]-xyz[faces[:,0]])
  for i in range(3):np.add.at(nrm,faces[:,i],n)
  nrm/=np.maximum(np.linalg.norm(nrm,axis=1)[:,None],1e-8)
  joint=np.zeros((len(xyz),4),np.uint16);joint[:,0]=buf['j'];weight=np.zeros((len(xyz),4),np.float32);weight[:,0]=1
  attrs={'POSITION':bi.access(xyz,5126,'VEC3',34962,True),'NORMAL':bi.access(nrm,5126,'VEC3',34962),'JOINTS_0':bi.access(joint,5123,'VEC4',34962),'WEIGHTS_0':bi.access(weight,5126,'VEC4',34962)}
  pi={'attributes':attrs,'indices':bi.access(faces.ravel(),5125,'SCALAR',34963),'material':mid[name]};prim.append(pi)
  tri_count+=len(faces);vert_count+=len(xyz);bounds.append(xyz)
 nodes=[{'name':name,'translation':g.trans[name].tolist(),'rotation':[0,0,0,1],'children':[]} for name in g.names]
 for i,(name,parent,tr) in enumerate(g.bones):
  if parent is not None:nodes[g.ids[parent]]['children'].append(i)
 nodes.append({'name':f'{g.creature.title()}_SkinnedMesh','mesh':0,'skin':0});mesh_id=len(nodes)-1
 nodes.append({'name':f'{g.creature.title()}_RootScene','children':[0,mesh_id]});sceneid=len(nodes)-1
 ibm=[]
 for name in g.names:
  m=np.eye(4,dtype=np.float32);m[:3,3]=-g.rest[name];ibm.append(m.T.ravel())
 ibms=bi.access(np.array(ibm,np.float32),5126,'MAT4')
 clips=(BIRD_CLIPS if g.creature=='carniroca' else TUFRILO_CLIPS);durs=(BIRD_DUR if g.creature=='carniroca' else TUFRILO_DUR)
 animations=[]
 for cname,dur in zip(clips,durs):
  times=np.linspace(0,float(dur),14 if cname in ('fly','flap_hard','sprint','flee','dig') else 10,dtype=np.float32)
  # for non-looping use one-shot normalized timeline; for looping t in cycles
  period={'idle':2,'breathing':2,'walk':1,'hop':1,'bound':1,'sprint':1,'flee':1,'fly':2,'flap_hard':3,'glide':1,'bank_left':1,'bank_right':1,'dig':3,'nibble':3,'peck_carrion':2,'tear_meat':2,'alert_call':2,'call':2}.get(cname,1)
  channels=[];samplers=[]
  for bone in g.names:
   rvals=[];tvals=[]
   for progress in np.linspace(0,1,len(times)):
    poses,moves=motion(g,cname,float(progress)*period)
    rvals.append(quat(*poses.get(bone,(0,0,0))))
    tvals.append(moves.get(bone,g.trans[bone]))
   rvals=np.array(rvals,np.float32);tvals=np.array(tvals,np.float32)
   for prop,values in [('rotation',rvals),('translation',tvals)]:
    rest=(np.array([0.,0.,0.,1.],dtype=np.float32) if prop=='rotation' else np.asarray(g.trans[bone],dtype=np.float32))
    if np.max(np.abs(values-rest))<1e-7:continue
    ind=bi.access(times,5126,'SCALAR',minmax=True);out=bi.access(values,5126,'VEC4' if prop=='rotation' else 'VEC3')
    k=len(samplers);samplers.append({'input':ind,'output':out,'interpolation':'LINEAR'});channels.append({'sampler':k,'target':{'node':g.ids[bone],'path':prop}})
  if not channels:
   # valid idle default for motion that happens to return no tracks
   ind=bi.access(times,5126,'SCALAR',minmax=True);out=bi.access(np.array([quat(yaw=3*math.sin(math.tau*u)) for u in np.linspace(0,1,len(times))],np.float32),5126,'VEC4')
   samplers.append({'input':ind,'output':out,'interpolation':'LINEAR'});channels.append({'sampler':0,'target':{'node':g.ids['Head'],'path':'rotation'}})
  animations.append({'name':cname,'channels':channels,'samplers':samplers,'extras':{'durationSeconds':dur,'loop':cname not in ('takeoff','land','hurt','death','alert_call','call','collect_seed','stash_seed')}})
 meta={'creature':g.creature,'speciesId':g.creature,'rig':'anatomical rigid-weight skin regions; joint clips in GLB','clipNames':clips,'lod':g.lod,'version':'0.1.0','license':'Original Wildhaven asset'}
 scene={'asset':{'version':'2.0','generator':'Wildhaven procedural fauna model builder 0.1'},'scene':0,'scenes':[{'nodes':[sceneid]}],'nodes':nodes,'meshes':[{'name':g.creature.title()+'_MidPoly','primitives':prim}],'materials':mats,
 'skins':[{'name':g.creature.title()+'_Rig','inverseBindMatrices':ibms,'joints':list(range(len(g.names))),'skeleton':0}],
 'animations':animations,'buffers':[{'byteLength':len(bi.b)}],'bufferViews':bi.views,'accessors':bi.accessors,'extras':meta}
 jb=json.dumps(scene,ensure_ascii=False,separators=(',',':')).encode();jb+=b' '*((-len(jb))%4);binary=bytes(bi.b);binary+=b'\0'*((-len(binary))%4)
 glb=struct.pack('<4sII',b'glTF',2,12+8+len(jb)+8+len(binary))+struct.pack('<I4s',len(jb),b'JSON')+jb+struct.pack('<I4s',len(binary),b'BIN\0')+binary
 dest=D/(f'{g.creature}_{"LOD1_" if g.lod else ""}animated_v01.glb');dest.write_bytes(glb)
 bbox=np.vstack(bounds);out={'file':dest.name,'sha256':hashlib.sha256(glb).hexdigest(),'bytes':len(glb),'triangles':tri_count,'vertices':vert_count,'joints':len(g.names),'animations':clips,'bbox_m':[bbox.min(axis=0).tolist(),bbox.max(axis=0).tolist()],'skinned':True,'limitations':['Rigid per-part skin weights: no soft tissue bending','Animations mostly in-place; no foot IK or physical wing aerodynamics','No gameplay AI integration yet']}
 print(g.creature,'LOD',g.lod,'triangles',tri_count,'vertices',vert_count,'bytes',len(glb),flush=True);return out

def build():
 info=[]
 for creature in ('carniroca','tufrilo'):
  for lod in (0,1):
   g=Geometry(creature,lod);carniroca_model(g) if creature=='carniroca' else tufrilo_model(g)
   info.append(export(g))
 (D/'creature_manifest.json').write_text(json.dumps({'models':info},indent=2,ensure_ascii=False)+'\n')
if __name__=='__main__':build()
