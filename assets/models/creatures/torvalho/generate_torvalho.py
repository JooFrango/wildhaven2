#!/usr/bin/env python3
"""Wildhaven — TORVALHO v0.1. Original mid-poly sculptural bovine, glTF 2.0 GLB.
All geometry, skin and action clips are authored procedurally; no borrowed models.
Coordinates: Y up; animal looks along -Z; measurements are metres.
Requirements: Python 3.11+, numpy.
"""
from __future__ import annotations
import math, json, struct, hashlib, random
from pathlib import Path
from collections import defaultdict
import numpy as np
D=Path(__file__).resolve().parent
LOD=0
def n(high,low):return high if LOD==0 else low
V=lambda *v:np.array(v,dtype=np.float64)
PALETTES={
'forest':{
 'body':(.30,.155,.085),'body_light':(.405,.225,.115),'body_dark':(.21,.112,.075),
 'shoulder':(.19,.11,.075),'shoulder_gold':(.32,.17,.09),'back':(.365,.20,.105),
 'belly':(.25,.135,.100),'mane':(.135,.075,.055),'mane_light':(.215,.118,.068),
 'mane_copper':(.29,.148,.073),'tuft_dark':(.095,.060,.045),'forelock':(.155,.082,.048),
 'face':(.285,.148,.090),'muzzle':(.375,.247,.180),'muzzle_top':(.30,.185,.130),
 'nose':(.155,.122,.095),'nostril':(.043,.037,.032),'mouth':(.083,.052,.040),
 'eye_rim':(.11,.065,.052),'eye':(.35,.21,.075),'pupil':(.048,.029,.022),'eye_glint':(.94,.83,.61),
 'horn_base':(.385,.292,.220),'horn':(.70,.605,.453),'horn_light':(.86,.78,.622),'horn_tip':(.932,.869,.735),
 'hoof':(.17,.14,.12),'hoof_edge':(.26,.22,.18),'tail':(.36,.196,.121),
 'fetlock':(.257,.163,.113),'hoof_shade':(.135,.119,.102),'ear':(.38,.208,.147),'ear_inner':(.57,.318,.255)
}}
# Bone offsets are local to the parent bone. Keep each body region skinned to one
# bone for v0.1 (rigid mechanical skin). More organic weighting requires later polish.
BONES=[
 ('Root',None,(0,0,0)),
 ('Body','Root',(0,1.26,0)),
 ('ShoulderHump','Body',(0,.18,-.47)),
 ('Neck','Body',(0,.065,-.67)),
 ('Head','Neck',(0,.13,-.30)),
 ('Jaw','Head',(0,-.13,-.19)),
 ('Horn_L','Head',(-.27,.19,-.055)),('Horn_R','Head',(.27,.19,-.055)),
 ('Tail_Base','Body',(0,.055,.78)),('Tail_Mid','Tail_Base',(0,-.15,.28)),('Tail_Tip','Tail_Mid',(0,-.18,.31)),
 ('ForeUpper_L','Body',(-.32,-.115,-.58)),('ForeLower_L','ForeUpper_L',(0,-.54,-.015)),('ForeHoof_L','ForeLower_L',(0,-.46,-.035)),
 ('ForeUpper_R','Body',(.32,-.115,-.58)),('ForeLower_R','ForeUpper_R',(0,-.54,-.015)),('ForeHoof_R','ForeLower_R',(0,-.46,-.035)),
 ('HindUpper_L','Body',(-.345,-.17,.60)),('HindLower_L','HindUpper_L',(0,-.50,.12)),('HindHoof_L','HindLower_L',(0,-.47,-.11)),
 ('HindUpper_R','Body',(.345,-.17,.60)),('HindLower_R','HindUpper_R',(0,-.50,.12)),('HindHoof_R','HindLower_R',(0,-.47,-.11)),
]
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
 # Deep compact barrel chest; smaller round haunches; slight saddle across back.
 tube('Body','body',[(0,-.02,-.77),(0,.00,-.62),(0,.04,-.35),(0,.03,0),(0,.015,.36),(0,.045,.63),(0,.075,.82)],
      [.08,.35,.45,.465,.40,.31,.08],sides=22,ellipses=[(1,.84),(1,.93),(1,1.10),(1,1.08),(1,1),(1,.91),(1,.85)])
 ellipsoid('Body','body_light',(0,-.07,.26),(.429,.385,.54),12,18)
 ellipsoid('Body','back',(0,.20,.145),(.40,.246,.655),10,18)
 ellipsoid('Body','belly',(0,-.307,-.05),(.349,.144,.61),10,18)
 ellipsoid('Body','body_dark',(0,-.095,.633),(.323,.310,.285),10,16)
 # Sculpted muscular hump and strong lowered neck; each separate from barrel.
 ellipsoid('ShoulderHump','shoulder',(0,.075,-.04),(.492,.495,.52),14,22,tilt=(-.14,0,0))
 ellipsoid('ShoulderHump','shoulder_gold',(0,.195,.084),(.37,.295,.39),10,18)
 ellipsoid('Neck','mane',(0,-.07,-.075),(.416,.452,.370),13,18,tilt=(-.12,0,0))
 ellipsoid('Neck','mane_light',(0,-.18,-.21),(.355,.312,.360),10,16)
 ellipsoid('Neck','tuft_dark',(0,-.215,-.16),(.316,.246,.270),9,16)
 # Long dark mane: real small angular tufts around shoulder/neck/hump surface.
 for bone,center,radius,tuft_count in [
  ('ShoulderHump',(0,.025,-.065),(.475,.442,.49),n(245,63)),
  ('Neck',(0,-.085,-.08),(.41,.433,.365),n(150,37))]:
  cx,cy,cz=center;rx,ry,rz=radius
  for j in range(tuft_count):
   phi=rng.uniform(-math.pi,math.pi); q=rng.uniform(-.7,1)
   theta=math.acos(max(-.99,min(.99,q)))
   # avoid tufts inside body; hair visible mainly along sides and neck bottom
   sp=math.sin(theta);xp=math.cos(phi)*sp;yp=math.cos(theta);zp=math.sin(phi)*sp
   if bone=='ShoulderHump' and zp>.75 and yp<.12:continue
   p=(cx+rx*xp,cy+ry*yp,cz+rz*zp)
   direction=(.42*xp,-.55+.45*yp,.18+.3*zp)
   length=rng.uniform(.075,.17) if bone=='ShoulderHump' else rng.uniform(.10,.245)
   col=rng.choices(['mane','mane_light','mane_copper','tuft_dark'],[47,27,17,9])[0]
   tuft(bone,col,p,direction,length, rng.uniform(.018,.036),5)
 # Short hair coat on hind barrel and back, sparse and directional.
 for j in range(n(200,38)):
  z=rng.uniform(-.36,.67);phi=rng.uniform(0,2*math.pi)
  # body elliptical shading surface: primarily top & lateral body
  xp=math.cos(phi);yp=math.sin(phi)
  if yp<-.65:continue
  rx=.432*math.sqrt(max(.28,1-(z/.97)**2));ry=.36*math.sqrt(max(.28,1-(z/.98)**2))
  p=(rx*xp,.023+ry*yp,z)
  c=rng.choice(['body','body_light','back','body_dark'])
  tuft('Body',c,p,(xp*.17,yp*.33,-.65),rng.uniform(.043,.086),rng.uniform(.010,.018),4)
 # Clear ear pair, angular cup pointing outside; ear ridge from two tapered tubes
 for side in (-1,1):
  ellipsoid('Head','ear',(side*.265,.063,.050),(.135,.07,.155),9,12,tilt=(0,0,side*.33))
  ellipsoid('Head','ear_inner',(side*.306,.067,-.017),(.087,.036,.077),7,10,tilt=(.25,0,side*.25))
 # Slightly low-set elongated skull, very broad forehead; soft muzzle without human expression.
 ellipsoid('Head','face',(0,.012,-.015),(.302,.277,.343),lat=14,lon=22,tilt=(-.08,0,0))
 ellipsoid('Head','body_light',(0,.148,.052),(.29,.12,.245),lat=9,lon=18)
 ellipsoid('Head','muzzle_top',(0,-.144,-.245),(.207,.155,.212),lat=11,lon=18,tilt=(.18,0,0))
 ellipsoid('Head','muzzle',(0,-.223,-.354),(.232,.115,.155),lat=10,lon=20)
 ellipsoid('Jaw','muzzle',(0,-.022,-.155),(.203,.085,.194),lat=10,lon=18,tilt=(.11,0,0))
 ellipsoid('Head','nose',(0,-.235,-.497),(.214,.070,.045),lat=8,lon=18)
 # Lips / muzzle line: narrow dark lines, NOT teeth.
 tube('Head','mouth',[(0,-.285,-.512),(0,-.317,-.450),(0,-.328,-.405)],[.007,.005,.003],sides=6)
 for side in (-1,1):
  ellipsoid('Head','eye_rim',(side*.268,.021,-.177),(.025,.045,.057),9,14)
  ellipsoid('Head','eye',(side*.286,.025,-.188),(.012,.031,.031),8,12)
  ellipsoid('Head','pupil',(side*.296,.029,-.192),(.006,.021,.012),8,12)
  ellipsoid('Head','eye_glint',(side*.301,.042,-.201),(.003,.005,.004),6,10)
  ellipsoid('Head','nostril',(side*.154,-.217,-.493),(.024,.016,.020),7,11,tilt=(0,0,.35*side))
  tube('Head','muzzle_top',[(side*.267,.072,-.204),(side*.28,.1,-.133),(side*.23,.105,-.071)],[.02,.027,.009],7)
  # Horns: heavy curved forward then outward/up; no branches, no antlers.
  b='Horn_L' if side<0 else 'Horn_R'
  pts=[(0,0,0),(side*.12,.05,.03),(side*.27,.075,.075),(side*.41,.12,.09),
       (side*.51,.25,.073),(side*.54,.38,.04),(side*.51,.52,-.012),(side*.43,.585,-.055)]
  radii=[.108,.101,.087,.073,.056,.037,.019,.0025]
  tube(b,'horn',pts,radii,sides=12)
  ellipsoid(b,'horn_base',(0,.004,0),(.127,.112,.129),9,16)
  # Keratin transverse irregular ridges create real surface variation.
  for j in range(1,5):
   pp=np.array(pts[j],dtype=float)
   rr=radii[j]+.005
   aa=np.array([pp+V(0,-.013,0),pp+V(0,.014,0)])
   tube(b,'horn_base' if j<3 else 'horn_light',aa,[rr,rr*.87],10)
  tuft('Head','forelock',(side*.135,.26,-.225),(side*.05,.7,-.45),.15,.040,5)
 # Forelock strongly ruffled into face, sculpted from tapered polygon strands.
 for i in range(n(42,16)):
  x=rng.uniform(-.23,.23);z=rng.uniform(-.31,.12)
  ht=.245+.018*rng.random()
  tuft('Head','forelock' if rng.random()<.58 else 'mane_light',(x,ht,z),(.15*x,.4,-1),rng.uniform(.07,.18),rng.uniform(.017,.036),5)
 # Broad chin beard, angular drooping lock clusters.
 for j in range(n(40,14)):
  x=rng.uniform(-.19,.19);z=rng.uniform(-.32,.05)
  tuft('Jaw','tuft_dark' if j%3==0 else 'mane',(x,-.105,z),(x*.12,-1,-.26),rng.uniform(.09,.21),rng.uniform(.012,.033),5)
 # Thick bull tail with swinging tip and tuft.
 tube('Tail_Base','tail',[(0,.02,-.04),(0,-.065,.15),(0,-.135,.30)],[.095,.068,.049],10)
 tube('Tail_Mid','tail',[(0,.01,-.03),(0,-.065,.18),(0,-.12,.31)],[.053,.039,.031],8)
 tube('Tail_Tip','tail',[(0,.01,-.03),(0,-.11,.13),(0,-.22,.28)],[.031,.028,.022],8)
 ellipsoid('Tail_Tip','tuft_dark',(0,-.21,.27),(.069,.075,.154),9,12,tilt=(-.24,0,0))
 for j in range(n(22,12)):
  a=2*math.pi*j/22
  tuft('Tail_Tip','mane' if j%3 else 'mane_light',(.051*math.cos(a),-.21+.06*math.sin(a),.27),(.18*math.cos(a),-.45+math.sin(a)*.16,.7),rng.uniform(.12,.24),.018,4)
 # Muscular four limbs; split cloven hoof, brown bony fetlock; no reptilian toes.
 for front in (True,False):
  for side,letter in ((-1,'L'),(1,'R')):
   prefix='Fore' if front else 'Hind';upper=prefix+'Upper_'+letter;lower=prefix+'Lower_'+letter;hoof=prefix+'Hoof_'+letter
   if front:
    ellipsoid(upper,'shoulder',(0,-.16,-.005),(.160,.286,.192),11,16,tilt=(.10,0,0))
    tube(upper,'body',[(0,.065,0),(0,-.22,-.01),(0,-.50,-.01)],[.136,.105,.080],sides=12)
    tube(lower,'body_dark',[(0,.04,0),(0,-.22,-.005),(0,-.46,-.025)],[.075,.07,.085],sides=11)
    ellipsoid(lower,'fetlock',(0,-.31,-.025),(.086,.157,.092),10,12)
   else:
    ellipsoid(upper,'body_light',(0,-.10,.005),(.183,.250,.222),12,16,tilt=(-.22,0,0))
    tube(upper,'body',[(0,.085,0),(0,-.235,.10),(0,-.515,.12)],[.15,.12,.092],sides=12)
    tube(lower,'body_dark',[(0,.04,.09),(0,-.24,-.02),(0,-.47,-.11)],[.086,.071,.081],sides=11)
    ellipsoid(lower,'fetlock',(0,-.34,-.052),(.085,.142,.09),9,12)
   # Cloth-like lower mane/feather around the ankle is geometry, not decals.
   for j in range(n(16,7)):
    a=2*math.pi*j/16
    tuft(lower,'fetlock' if j%2 else 'body_dark',(.067*math.cos(a),-.32,.06*math.sin(a)),(.35*math.cos(a),-.75,.35*math.sin(a)),rng.uniform(.055,.09),.021,5)
   ellipsoid(hoof,'hoof_shade',(0,-.028,-.060),(.138,.100,.119),8,16)
   # Two halves, with a dark central gap. Individual hoof toe is dorsally convex.
   for s in (-1,1):
    ellipsoid(hoof,'hoof',(s*.071,-.085,-.126),(.071,.075,.122),10,12,tilt=(.015,0,-s*.07))
    # no extra round toe cap (true split hoof rather than paws)
    pass
   tube(hoof,'hoof_shade',[(0,-.014,-.10),(0,-.078,-.213)],[.013,.01],sides=6)
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
  samp=[];chs=[]
  for bone,attribs in curves.items():
   for path,kfs in attribs.items():
    times=np.asarray([t for t,v in kfs],dtype=np.float32);vals=np.asarray([v for t,v in kfs],dtype=np.float32)
    if abs(times[0])>1e-5 or abs(times[-1]-dur)>1e-4:raise ValueError((name,bone,path,times[0],times[-1],dur))
    ia=binary.accessor(times,5126,'SCALAR',minmax=True);oa=binary.accessor(vals,5126,'VEC4' if path=='rotation' else 'VEC3')
    si=len(samp);samp.append({'input':ia,'output':oa,'interpolation':'LINEAR'})
    chs.append({'sampler':si,'target':{'node':BONE_ID[bone],'path':path}})
  clips.append({'name':name,'channels':chs,'samplers':samp,'extras':{'durationSeconds':dur,'loop':loop,'note':note}})
 def br(fr):return {'rotation':rotseq(fr)}
 def ar(fr,ax='x'):return {'rotation':rotseq(fr,ax)}
 def body(fr):return {'translation':trseq([(tt,(0,dy,dz)) for tt,dy,dz in fr],'Body')}
 legs=['ForeUpper_L','ForeUpper_R','HindUpper_L','HindUpper_R']
 lows=['ForeLower_L','ForeLower_R','HindLower_L','HindLower_R']
 hooves=['ForeHoof_L','ForeHoof_R','HindHoof_L','HindHoof_R']
 def gait(name,duration,swing,body_h,knee,offset=0):
  c={'Body':body([(0,0,0),(.25*duration,body_h,0),(.5*duration,-body_h*.27,0),(.75*duration,body_h,0),(duration,0,0)]),
    'Neck':br([(0,0),(.25*duration,-3),(.5*duration,2),(.75*duration,-3),(duration,0)]),
    'Head':br([(0,0),(.25*duration,-2),(.5*duration,1),(.75*duration,-2),(duration,0)]),
    'Tail_Base':ar([(0,-7),(.5*duration,7),(duration,-7)],'y'),
    'Tail_Mid':ar([(0,6),(.5*duration,-6),(duration,6)],'y')}
  for i,l in enumerate(legs):
   # diagonal pattern for walk/trot; gallop variant uses near-unison fore/hind.
   phase=(0 if i in (0,3) else .5) if offset==0 else (0 if i<2 else .5)
   signs=[1,0,-1,0,1] if phase==0 else [-1,0,1,0,-1]
   c[l]=br([(j*duration/4,swing*v) for j,v in enumerate(signs)])
   ls=[0,knee*.65,knee,0,0] if phase==0 else [knee,knee*.15,0,knee*.60,knee]
   c[lows[i]]=br([(j*duration/4,ls[j]) for j in range(5)])
   c[hooves[i]]=br([(j*duration/4,-ls[j]*.20) for j in range(5)])
  add(name,duration,c,note='In-place 4-leg gait. Use game controller for world displacement.')
 gait('walk',1.75,13,.019,13)
 gait('trot',1.05,23,.034,21)
 gait('run',.77,31,.065,29,offset=1)
 gait('calf_follow',1.25,18,.020,16)
 add('idle',3.0,{'Body':body([(0,0,0),(.8,.007,0),(1.6,0,0),(2.4,.007,0),(3,0,0)]),
  'Head':ar([(0,-5),(.85,6),(1.6,-2),(2.3,3),(3,-5)],'y'),
  'Tail_Base':ar([(0,0),(.8,12),(2,-9),(3,0)],'y'),
  'Jaw':br([(0,0),(1.2,3),(2.0,0),(3,0)])},note='Deep breathing, calm observation and tail movement')
 add('graze',3.0,{'Neck':br([(0,0),(.5,24),(1,37),(2.25,38),(2.7,16),(3,0)]),
  'Head':br([(0,0),(.55,15),(1,17),(2.3,15),(3,0)]),
  'Jaw':br([(0,0),(1.2,10),(1.4,0),(1.7,12),(1.95,0),(2.2,10),(2.5,0),(3,0)])},note='Lower head for grass then chew')
 add('chew',1.2,{'Jaw':br([(0,0),(.22,9),(.40,0),(.63,10),(.82,0),(1.02,9),(1.2,0)]),
  'Head':ar([(0,0),(.4,2),(.8,-3),(1.2,0)],'z')},note='Rumination chewing with lower jaw')
 add('ruminate',3.2,{'Jaw':br([(0,0),(.28,7),(.55,0),(.83,9),(1.10,0),(1.46,8),(1.75,0),(2.03,9),(2.32,0),(2.60,7),(2.85,0),(3.2,0)]),
 'Neck':br([(0,0),(1.6,-3),(3.2,0)])},note='Resting ruminant mandible pattern')
 add('sniff_air',2.4,{'Neck':br([(0,0),(.55,-12),(1.45,-11),(2.4,0)]),
 'Head':ar([(0,0),(.6,-16),(1.2,15),(2.4,0)],'y'),
 'Tail_Base':ar([(0,0),(1.0,9),(2.4,0)],'y')},note='Raise muzzle; smell source modulated by wind')
 add('watch',2.8,{'Neck':br([(0,0),(.6,-13),(2.1,-10),(2.8,0)]),
 'Head':ar([(0,0),(.5,-23),(1.45,-20),(2.15,18),(2.8,0)],'y')},note='Vigilant scan of surroundings')
 add('alert',1.9,{'Neck':br([(0,0),(.26,-15),(1.42,-15),(1.9,0)]),
 'Head':ar([(0,0),(.45,-10),(1.3,-6),(1.9,0)],'y'),
 'Tail_Base':br([(0,0),(.3,-7),(1.4,-7),(1.9,0)])},note='Sudden head lift and frozen warning posture')
 add('alarm_bellow',2.15,{'Neck':br([(0,0),(.3,-20),(1.7,-20),(2.15,0)]),
 'Jaw':br([(0,0),(.4,21),(.85,16),(1.4,23),(1.72,15),(2.15,0)]),
 'Head':br([(0,0),(.5,-7),(1.4,-10),(2.15,0)])},note='Low bellow warning with visible mouth opening')
 add('herd_guard',2.8,{'Neck':br([(0,0),(.35,15),(1.9,16),(2.8,0)]),
 'Head':ar([(0,0),(.55,-16),(1.2,17),(2.1,0),(2.8,0)],'y'),
 'ForeUpper_L':br([(0,0),(.6,-9),(2.2,-9),(2.8,0)]),
 'ForeUpper_R':br([(0,0),(.6,9),(2.2,9),(2.8,0)])},note='Calves behind shoulder barrier; lower horns and scan predator')
 add('stomp',1.3,{'ForeUpper_R':br([(0,0),(.3,-26),(.58,-30),(.75,7),(1.3,0)]),
 'ForeLower_R':br([(0,0),(.34,29),(.55,28),(.76,0),(1.3,0)]),
 'ForeHoof_R':br([(0,0),(.4,-15),(.58,-12),(.78,0),(1.3,0)]),
 'Body':body([(0,0,0),(.62,.016,0),(.77,-.045,0),(1.3,0,0)])},False,'Heavy intimidation stomp; optionally trigger sound and dust event')
 add('charge_windup',1.1,{'Body':body([(0,0,0),(.35,-.062,.045),(.87,-.060,.045),(1.1,0,0)]),
 'Neck':br([(0,0),(.22,28),(.77,29),(1.1,24)]),
 'Head':br([(0,0),(.3,12),(.9,12),(1.1,8)])},False,'Telegraphed lowering of the horns and muscular coil')
 add('charge',.73,{'Body':body([(0,.012,0),(.18,-.025,.02),(.37,.055,-.02),(.56,-.025,.02),(.73,.012,0)]),
 'Neck':br([(0,24),(.24,27),(.56,25),(.73,24)]),
 'ForeUpper_L':br([(0,-27),(.18,18),(.36,31),(.56,-19),(.73,-27)]),
 'ForeUpper_R':br([(0,26),(.18,-19),(.36,-28),(.56,20),(.73,26)]),
 'HindUpper_L':br([(0,19),(.18,-20),(.36,-22),(.56,25),(.73,19)]),
 'HindUpper_R':br([(0,-17),(.18,25),(.36,17),(.56,-26),(.73,-17)]),
 'Tail_Base':br([(0,-5),(.36,12),(.73,-5)])},note='Fast head-down charge loop, actual translation controlled by navigation')
 add('horn_sweep',1.4,{'Neck':ar([(0,0),(.24,-16),(.64,26),(1.1,-4),(1.4,0)],'y'),
 'Head':ar([(0,0),(.28,-23),(.67,28),(1.08,-10),(1.4,0)],'y'),
 'Body':ar([(0,0),(.42,-5),(.87,7),(1.4,0)],'z')},False,'Short lateral defensive horn sweep, requires hitbox window')
 add('head_toss',1.4,{'Neck':br([(0,0),(.30,28),(.63,-23),(1.05,-16),(1.4,0)]),
 'Head':br([(0,0),(.27,16),(.60,-14),(1.4,0)])},False,'Bull head toss and display')
 add('drink',3.0,{'Neck':br([(0,0),(.7,35),(2.2,37),(3,0)]),
 'Head':br([(0,0),(.7,14),(1.3,21),(2.2,18),(3,0)]),
 'Jaw':br([(0,0),(1.2,5),(1.48,0),(1.8,4),(2.2,0),(3,0)])},note='Lower nose into river, drink and return')
 add('rest',4.1,{'Body':body([(0,0,0),(1.15,-.35,0),(3.2,-.36,0),(4.1,0,0)]),
 'Neck':br([(0,0),(1.1,17),(3.2,15),(4.1,0)]),
 **{l:br([(0,0),(1.2,37),(3.2,37),(4.1,0)]) for l in legs}},False,'Kneel/lower, transition to sleep')
 add('sleep',4.0,{'Body':body([(0,-.35,0),(1,-.36,0),(2,-.342,0),(3,-.36,0),(4,-.35,0)]),
 'Neck':br([(0,17),(2,19),(4,17)]),
 'Jaw':br([(0,0),(2,2),(4,0)])},note='Slow breathing in lowered rest pose')
 add('dust_bath',3.0,{'Body':{'rotation':rotseq([(0,0),(.55,-14),(1.2,14),(1.9,-15),(2.45,11),(3,0)],'z'),
  'translation':trseq([(0,(0,0,0)),(.4,(0,-.16,0)),(2.45,(0,-.15,0)),(3,(0,0,0))],'Body')},
 'Neck':br([(0,0),(.7,14),(2.2,15),(3,0)]),
 'Tail_Base':ar([(0,0),(.6,21),(1.4,-19),(2.4,18),(3,0)],'y')},False,'Heavy rolling dust-bath posture; dust particles separate')
 add('tail_swish',2.0,{'Tail_Base':ar([(0,0),(.4,22),(1.0,-25),(1.5,20),(2,0)],'y'),
 'Tail_Mid':ar([(0,0),(.4,-20),(1,24),(1.5,-14),(2,0)],'y'),
 'Tail_Tip':ar([(0,0),(.4,16),(1,-19),(1.5,18),(2,0)],'y')},note='Fly swatting')
 add('turn_left',1.1,{'Root':ar([(0,0),(.55,23),(1.1,45)],'y'),
 'Head':ar([(0,0),(.44,12),(1.1,0)],'y'),
 'Tail_Base':ar([(0,0),(.6,-14),(1.1,-9)],'y')},False,'Pivot rotation in place')
 add('turn_right',1.1,{'Root':ar([(0,0),(.55,-23),(1.1,-45)],'y'),
 'Head':ar([(0,0),(.44,-12),(1.1,0)],'y'),
 'Tail_Base':ar([(0,0),(.6,14),(1.1,9)],'y')},False,'Pivot rotation in place')
 add('hurt',.9,{'Body':ar([(0,0),(.23,-8),(.52,10),(.9,0)],'z'),
 'Neck':br([(0,0),(.26,-16),(.50,9),(.9,0)]),
 'Head':ar([(0,0),(.32,-17),(.65,6),(.9,0)],'y')},False,'Hit reaction')
 add('death',3.4,{'Body':{'rotation':rotseq([(0,0),(.8,-8),(1.65,-46),(2.65,-84),(3.4,-84)],'z'),
 'translation':trseq([(0,(0,0,0)),(.85,(0,-.09,0)),(1.9,(.03,-.30,0)),(3.4,(.03,-.44,0))],'Body')},
 'Neck':br([(0,0),(1,-14),(2.6,-33),(3.4,-33)]),
 'ForeUpper_L':br([(0,0),(2,31),(3.4,31)]),
 'HindUpper_R':br([(0,0),(2,-28),(3.4,-28)])},False,'Non-loop fall and final stillness')
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
 nodes.append({'name':'Torvalho_MidPoly','mesh':0,'skin':0})
 nodes.append({'name':'Torvalho_v01','children':[0,len(nodes)-1]})
 ibms=[]
 for n,p,o in BONES:
  m=np.eye(4,dtype=np.float32);m[:3,3]=-REST[n];ibms.append(m.T.reshape(-1))
 ibm=binary.accessor(np.asarray(ibms,dtype=np.float32),5126,'MAT4')
 anim=build_anims(binary)
 gltf={'asset':{'version':'2.0','generator':'Wildhaven Torvalho procedural skinned 0.1','copyright':'Original fictional creature asset for Wildhaven'},
 'scene':0,'scenes':[{'name':'Wildhaven Torvalho','nodes':[len(nodes)-1]}],
 'nodes':nodes,'meshes':[{'name':f'Torvalho_LOD{lod}','primitives':primitives}],
 'skins':[{'name':'Torvalho_Rig','inverseBindMatrices':ibm,'joints':list(range(len(BONES))),'skeleton':0}],
 'materials':materials,'animations':anim,'bufferViews':binary.views,'accessors':binary.accessors,
 'buffers':[{'byteLength':len(binary.b)}],
 'extras':{'speciesId':'torvalho','version':'0.1.0','units':'metres',
  'artDirection':'Mid-poly woodland bison-like bovine with heavy mane, curved horns and cleft hooves',
  'limitations':['rigid weighted skin','in-place locomotion','no physics/collision/AI yet'],
  'clipNames':[a['name'] for a in anim]}}
 js=json.dumps(gltf,ensure_ascii=False,separators=(',',':')).encode('utf-8')
 js+=b' '*((-len(js))%4)
 blob=bytes(binary.b)+b'\x00'*((-len(binary.b))%4)
 out=struct.pack('<4sII',b'glTF',2,12+8+len(js)+8+len(blob))+struct.pack('<I4s',len(js),b'JSON')+js+struct.pack('<I4s',len(blob),b'BIN\0')+blob
 path=D/('torvalho_animated_v01.glb' if lod==0 else 'torvalho_LOD1_animated_v01.glb');path.write_bytes(out)
 verts=np.vstack([np.asarray(g['vertices']) for g in G.values()])
 result={'species':'torvalho','version':'0.1.0','lod':lod,'file':path.name,'bytes':len(out),'sha256':hashlib.sha256(out).hexdigest(),
  'vertices':vc,'triangles':tc,'joints':len(BONES),'materials':len(materials),'animationCount':len(anim),
  'clips':{a['name']:a['extras']['durationSeconds'] for a in anim},
  'boundingBoxM':[verts.min(axis=0).round(4).tolist(),verts.max(axis=0).round(4).tolist()],
  'notProductionReady':['rigid skin deformation','no IK grounding','in-place animations','no hitboxes or physics','no AI integration']}
 return result
if __name__=='__main__':
 results=[save(0),save(1)]
 (D/'torvalho_manifest.json').write_text(json.dumps({'speciesId':'torvalho','version':'0.1.0','variants':results},indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
 print(json.dumps(results,indent=2,ensure_ascii=False))
