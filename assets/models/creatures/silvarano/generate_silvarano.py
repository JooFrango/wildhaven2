#!/usr/bin/env python3
"""Wildhaven — Silvarano. Original parametric MID-poly skinned quadruped.
Generates two complete glTF 2.0 GLBs, with 27 action clips for both variants.
Requires numpy. No external 3D assets or images; geometry and skin are authored here.
Body is Y-up, head faces -Z, dimensions in meters. Rigid anatomical skinning
is an intentionally limited v0.1 production prototype, not final soft skin.
"""
from __future__ import annotations
import math, json, struct, hashlib
from pathlib import Path
from collections import defaultdict
import numpy as np
D=Path(__file__).resolve().parent
V=lambda *v:np.array(v,dtype=np.float64)
S=1.0
PALETTES={
 'temperate':{
  'body':(.27,.34,.205), 'body_light':(.39,.43,.275), 'body_shadow':(.18,.245,.165),
  'forest_scale':(.215,.335,.225),'forest_scale_light':(.32,.43,.275),'rust_scale':(.53,.325,.18),
  'rust_highlight':(.69,.43,.235),'dorsal':(.30,.30,.20), 'underbelly':(.73,.67,.49),
  'underbelly_light':(.86,.77,.56), 'head':(.315,.39,.245), 'muzzle':(.45,.46,.32),
  'nose':(.19,.23,.20),'horn':(.55,.39,.24),'horn_highlight':(.76,.56,.32),
  'horn_dark':(.34,.245,.16),'eye_rim':(.15,.19,.14),'eye_amber':(.81,.57,.21),
  'pupil':(.07,.095,.07),'glint':(.98,.93,.73),'claw':(.34,.33,.26),
  'mark':(.56,.56,.33),'spine':(.60,.405,.215),'mouth':(.20,.17,.125),'nostril':(.14,.155,.13)},
 'tropical':{
  'body':(.12,.305,.22),'body_light':(.20,.435,.30),'body_shadow':(.08,.205,.165),
  'forest_scale':(.10,.36,.24),'forest_scale_light':(.17,.49,.31),'rust_scale':(.48,.26,.14),
  'rust_highlight':(.66,.38,.17),'dorsal':(.14,.28,.20),'underbelly':(.66,.69,.49),
  'underbelly_light':(.77,.79,.57),'head':(.19,.39,.285),'muzzle':(.35,.475,.32),
  'nose':(.10,.23,.20),'horn':(.43,.35,.21),'horn_highlight':(.67,.52,.27),
  'horn_dark':(.27,.25,.14),'eye_rim':(.09,.17,.13),'eye_amber':(.86,.62,.22),
  'pupil':(.045,.09,.07),'glint':(.98,.95,.78),'claw':(.27,.32,.23),
  'mark':(.48,.63,.35),'spine':(.51,.35,.17),'mouth':(.13,.18,.14),'nostril':(.08,.17,.14)}
}
BONES=[
 ('Root',None,(0,0,0)),('Body','Root',(0,1.16,0)),
 ('Neck','Body',(0,.19,-.43)),('Head','Neck',(0,.39,-.31)),
 ('Jaw','Head',(0,-.075,-.21)),('Crown','Head',(0,.13,.015)),
 ('Tail_01','Body',(0,.065,.52)),('Tail_02','Tail_01',(0,-.045,.29)),('Tail_03','Tail_02',(0,-.08,.28)),
 ('FrontUpper_L','Body',(-.23,-.075,-.40)),('FrontLower_L','FrontUpper_L',(0,-.50,-.015)),('FrontFoot_L','FrontLower_L',(0,-.46,.0)),
 ('FrontUpper_R','Body',(.23,-.075,-.40)),('FrontLower_R','FrontUpper_R',(0,-.50,-.015)),('FrontFoot_R','FrontLower_R',(0,-.46,.0)),
 ('HindUpper_L','Body',(-.235,-.06,.41)),('HindLower_L','HindUpper_L',(0,-.42,.13)),('HindFoot_L','HindLower_L',(0,-.55,-.18)),
 ('HindUpper_R','Body',(.235,-.06,.41)),('HindLower_R','HindUpper_R',(0,-.42,.13)),('HindFoot_R','HindLower_R',(0,-.55,-.18)),
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
 if not len(verts): return
 g=G[mat];base=len(g['vertices']);p=REST[bone]
 g['vertices'].extend((np.asarray(verts,dtype=float)+p).tolist());g['faces'].extend([[base+a,base+b,base+c] for a,b,c in faces]);g['joints'].extend([BONE_ID[bone]]*len(verts))
def ellipsoid(bone,mat,c,rad,lat=9,lon=14,tilt=(0,0,0)):
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
def tube(bone,mat,pts,rads,sides=8,ellipses=None, caps=True):
 """Jointed tapered tube: each cross-section perpendicular to local tangent."""
 ps=[V(*p) for p in pts];v=[];f=[]
 for k,p in enumerate(ps):
  tangent=ps[min(k+1,len(ps)-1)]-ps[max(0,k-1)]
  tangent=tangent/max(1e-9,np.linalg.norm(tangent))
  u=np.cross(tangent,V(1,0,0))
  if np.linalg.norm(u)<.08:u=np.cross(tangent,V(0,0,1))
  u=u/np.linalg.norm(u);w=np.cross(tangent,u)
  for i in range(sides):
   t=2*math.pi*i/sides
   er=ellipses[k] if ellipses is not None else (1,1)
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
def spike(bone,mat,a,b,rad0=.026, sides=6):tube(bone,mat,[a,b],[rad0,.0013],sides)
def scale(bone,mat,p,edge,normal,width=.07,length=.14,thick=.014):
 """Overlapping arched 3D scale, never a 2D decal."""
 p=V(*p);E=V(*edge);E/=max(1e-9,np.linalg.norm(E));N=V(*normal);N/=max(1e-9,np.linalg.norm(N))
 B=np.cross(E,N);B/=max(1e-9,np.linalg.norm(B));
 # five cross sections, 3x3 facets plus reverse undersurface
 vv=[];faces=[]
 for i,t in enumerate([0,.22,.48,.72,1]):
  ww=width*(.65+.35*math.sin(math.pi*(t*.73+.15)))*(1-.85*t**2)
  mid=p+E*length*t+N*(thick+math.sin(math.pi*t)*thick*.45)
  vv.extend([mid-B*ww,mid+N*thick*.5,mid+B*ww,mid-N*.35*thick])
 for i in range(4):
  a=i*4;c=a+4
  faces.extend([[a,c,a+1],[a+1,c,c+1],[a+1,c+1,a+2],[a+2,c+1,c+2],
                [a+3,c+3,a],[a,c+3,c],[a+2,c+2,a+3],[a+3,c+2,c+3]])
 add_geo(bone,mat,vv,faces)
def make_geometry():
 # Body: long athletic torso, muscular chest, taper at pelvis, no mammalian hooves.
 tube('Body','body',[(0,.025,-.55),(0,.055,-.43),(0,.08,-.22),(0,.055,.0),(0,.03,.24),(0,.065,.45),(0,.095,.60)],
      [.08,.27,.35,.36,.325,.24,.07],sides=18,ellipses=[(1,.8),(1,1.0),(1,1.04),(1,1.0),(1,.88),(1,.9),(1,.85)])
 ellipsoid('Body','body_light',(0,.07,-.29),(.32,.265,.27),10,18,tilt=(.08,0,0))
 ellipsoid('Body','underbelly',(0,-.213,-.14),(.276,.125,.47),10,18,tilt=(-.055,0,0))
 ellipsoid('Body','body_shadow',(0,-.09,.405),(.245,.235,.245),9,14)
 # broad patches along flanks and small overlapping armor scale geometry
 for side in (-1,1):
  for row in range(5):
   yy=-.085+row*.072
   for j in range(12):
    z=-.40+j*.083+(row%2)*.034
    rad=1-(z/.76)**2
    if rad<.32: continue
    x=side*(.286*math.sqrt(rad)+.006 + .015*math.sin(row+j))
    mat=['forest_scale','forest_scale_light','body_light','body','rust_scale'][(j*3+row*2+int(side>0))%5]
    scale('Body',mat,(x,yy,z),(.03*side,-.30,1),(.97*side,.19,0),width=.035,length=.12,thick=.010)
 # ridge scales from rump to shoulders, with raised copper plate outlines
 for j in range(17):
  z=-.49+j*.066
  h=.31*math.sqrt(max(.05,1-(z/.84)**2))+.083
  for side in (-1,1):
   x=side*(.082+.022*math.cos(j*.69))
   scale('Body','rust_scale' if j%3==0 else 'rust_highlight',(x,h,z),(0,-.18,1),(.08*side,.99,.05),width=.054,length=.085,thick=.011)
   if j%4==0:
    spike('Body','spine',(x*.75,h+.02,z),(x*.80,h+.054,z+.045),.016,6)
 # neck S crest, and pale scaly throat; head bone at position (0,1.58,-.74).
 tube('Neck','head',[(0,-.08,.16),(0,-.01,.07),(0,.10,-.07),(0,.24,-.22),(0,.42,-.33)], [.22,.19,.17,.135,.115],14)
 ellipsoid('Neck','underbelly',(0,.15,-.112),(.145,.27,.122),10,14,tilt=(.30,0,0))
 for row in range(9):
  y=-.11+row*.059;z=.08-row*.052
  for side in (-1,1):
   scale('Neck','forest_scale' if row%2 else 'forest_scale_light',(side*.114,y,z),(.0,-.34,-1),(side,.15,-.05),width=.041,length=.067,thick=.010)
 for k in range(9):
  y=-.02+k*.059;z=.12-k*.052
  scale('Neck','spine' if k%3==0 else 'rust_scale',(0,y+.133,z),(.0,.9,-.4),(0,.70,.7),width=.065,length=.064,thick=.010)
 # head reptilian, slim wedge muzzle, no fluffy ears
 ellipsoid('Head','head',(0,.013,-.045),(.132,.138,.192),lat=12,lon=18,tilt=(.05,0,0))
 ellipsoid('Head','muzzle',(0,-.056,-.227),(.101,.072,.151),lat=8,lon=14,tilt=(.16,0,0))
 tube('Head','muzzle',[(0,-.05,-.165),(0,-.064,-.276),(0,-.078,-.355)],[.097,.084,.061],sides=12,ellipses=[(1,.63),(1,.68),(1,.65)])
 ellipsoid('Head','nose',(0,-.056,-.365),(.07,.038,.045),lat=7,lon=12)
 ellipsoid('Jaw','underbelly_light',(0,-.010,-.072),(.091,.029,.157),lat=8,lon=14,tilt=(.12,0,0))
 for side in (-1,1):
  # membranous brow, gold iris and vertical pupil + glint
  ellipsoid('Head','eye_rim',(side*.124,.048,-.123),(.025,.042,.048),8,12)
  ellipsoid('Head','eye_amber',(side*.138,.051,-.129),(.015,.031,.034),9,12)
  ellipsoid('Head','pupil',(side*.151,.052,-.134),(.007,.020,.010),8,10)
  ellipsoid('Head','glint',(side*.156,.064,-.149),(.0035,.006,.005),7,10)
  # aural pit (no mammalian ear)
  ellipsoid('Head','eye_rim',(side*.117,.015,.074),(.007,.028,.017),7,9)
  # nostril on scaly beak
  ellipsoid('Head','nostril',(side*.052,-.028,-.359),(.009,.006,.014),6,9)
  # tapered superciliary ridges
  tube('Head','rust_scale',[(side*.126,.090,-.172),(side*.150,.101,-.115),(side*.127,.082,-.061)],[.012,.017,.006],6)
  # thick cheek scale plates
  for i in range(4):
   scale('Head','forest_scale_light' if i%2 else 'forest_scale',(side*.094,-.032+i*.035,-.068+i*.024),(.07*side,-.28,-1),(side,.07,0),width=.027,length=.062,thick=.010)
 # horns fixed to head through crown bone; branch tubes are 3D not sprites.
 ellipsoid('Crown','horn_dark',(0,.023,-.010),(.145,.049,.105),8,14)
 for side in (-1,1):
  base=(side*.082,.055,-.01)
  trunk=[base,(side*.152,.173,.038),(side*.240,.285,.077),(side*.375,.363,.118),(side*.49,.425,.19)]
  tube('Crown','horn',trunk,[.038,.032,.025,.014,.0025],8)
  tube('Crown','horn_highlight',[(side*.135,.147,.032),(side*.222,.260,.07),(side*.350,.344,.107)],[.008,.006,.001],6)
  for j,p in enumerate([trunk[1],trunk[2],trunk[3]]):
   tip=(p[0]+side*(.11+j*.02),p[1]+(.17-j*.006),p[2]-(.08 if j==0 else .038))
   tube('Crown','horn',[p,(p[0]+side*.04,p[1]+.075,p[2]-.02),tip],[.016,.010,.001],6)
  spike('Crown','horn',trunk[2],(side*.25,.50,.11),.017,6)
  # side temple fin, reptilian crest not ears
  scale('Crown','rust_highlight',(side*.11,.060,.075),(.22*side,.7,.35),(side,.38,0),width=.042,length=.102,thick=.01)
 # articulated tail with visible overlap, narrow tapered tip
 tube('Tail_01','body',[(0,.028,-.065),(0,-.007,.103),(0,-.047,.30)], [.193,.148,.107],sides=12)
 tube('Tail_02','body_shadow',[(0,.0,-.053),(0,-.045,.123),(0,-.080,.29)],[.116,.090,.061],sides=12)
 tube('Tail_03','body',[(0,.0,-.07),(0,-.047,.14),(0,-.10,.35)],[.070,.047,.005],sides=10)
 for b,num in [('Tail_01',7),('Tail_02',6),('Tail_03',5)]:
  for j in range(num):
   z=-.04+j*.065
   rad={'Tail_01':.15,'Tail_02':.092,'Tail_03':.05}[b]*(1-j/(num+2))
   scale(b,'rust_scale' if j%2==0 else 'forest_scale',(0,rad*.75,z),(0,.06,1),(0,1,0),width=max(.015,rad*.62),length=.087,thick=.009)
 # legs and individual toes, bones aligned along hip -> knee -> ankle: NO HOOVES
 for front in (True,False):
  for side,hand in ((-1,'L'),(1,'R')):
   group='Front' if front else 'Hind'
   upper=group+'Upper_'+hand;lower=group+'Lower_'+hand;foot=group+'Foot_'+hand
   if front:
    ellipsoid(upper,'body',(0,-.13,.008),(.112,.20,.112),10,14,tilt=(-.07,0,0))
    tube(upper,'body',[(0,.055,0),(0,-.23,-.008),(0,-.51,-.018)],[.100,.076,.053],sides=11)
    ellipsoid(lower,'forest_scale',(0,-.14,.0),(.061,.26,.062),9,12)
    tube(lower,'body_shadow',[(0,.035,0),(0,-.24,-.008),(0,-.455,0)],[.056,.051,.044],10)
   else:
    ellipsoid(upper,'body',(0,-.13,.018),(.142,.231,.168),10,14,tilt=(-.23,0,0))
    tube(upper,'body',[(0,.08,0),(0,-.23,.076),(0,-.43,.13)],[.144,.108,.066],12)
    ellipsoid(lower,'forest_scale',(0,-.12,-.015),(.075,.24,.076),9,12,tilt=(-.12,0,0))
    tube(lower,'body_shadow',[(0,.035,.085),(0,-.26,-.06),(0,-.55,-.18)],[.062,.053,.043],10)
   # leg scale armor, inside short articulated limb
   for j in range(6):
    z=-.03+j*.013
    scale(upper,'forest_scale_light' if j%2 else 'forest_scale',(side*.061,-.11-j*.062,z),(0,-1,.14),(side,.06,0),width=.025,length=.08,thick=.006)
   # toes splay forward from ankle, each with triangular claws
   ellipsoid(foot,'body_shadow',(0,-.027,-.038),(.075,.055,.100),lat=7,lon=12)
   for i in (-1,0,1):
    x=i*.070;z=-.16 + abs(i)*.018
    tube(foot,'body_shadow',[(i*.022,-.043,-.065),(x*.85,-.057,-.121),(x,-.065,z)],[.031,.023,.014],8)
    tube(foot,'claw',[(x,-.062,z),(x*1.12,-.058,z-.057)],[.014,.0015],sides=6)
   for j in range(4):
    scale(foot,'forest_scale',(side*.04,-.005,-.05+j*.025),(0,-.18,-1),(side,.9,0),width=.015,length=.042,thick=.007)

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
def cyc(fr0,dur):
 return [(float(i*dur/(len(fr0)-1)),v) for i,v in enumerate(fr0)]

def build_anims(binary):
 clips=[]
 def add(name,dur,curves,loop=True,note=''):
  samp=[];chs=[]
  for bone,attribs in curves.items():
   for path,kfs in attribs.items():
    times=np.asarray([t for t,v in kfs],dtype=np.float32);vals=np.asarray([v for t,v in kfs],dtype=np.float32)
    assert abs(times[0])<1e-5 and abs(times[-1]-dur)<1e-5,(name,bone,path,times[-1],dur)
    ia=binary.accessor(times,5126,'SCALAR',minmax=True);oa=binary.accessor(vals,5126,'VEC4' if path=='rotation' else 'VEC3')
    si=len(samp);samp.append({'input':ia,'output':oa,'interpolation':'LINEAR'});chs.append({'sampler':si,'target':{'node':BONE_ID[bone],'path':path}})
  clips.append({'name':name,'channels':chs,'samplers':samp,'extras':{'durationSeconds':dur,'loop':loop,'note':note}})
 def br(fr):return {'rotation':rotseq(fr)}
 def ar(fr,ax='x'):return {'rotation':rotseq(fr,ax)}
 def body(fr):return {'translation':trseq([(tt,(0,dy,dz)) for tt,dy,dz in fr],'Body')}
 # friendly gait helper for 4 alternating legs, standard diagonal trot
 legs=['FrontUpper_L','FrontUpper_R','HindUpper_L','HindUpper_R']
 lows=['FrontLower_L','FrontLower_R','HindLower_L','HindLower_R']
 feet=['FrontFoot_L','FrontFoot_R','HindFoot_L','HindFoot_R']
 def gait(name,duration,swing,body_h,knee,offdiag=0.5):
  c={'Body':body([(0,0,0),(.25*duration,body_h,0),(.5*duration,-body_h*.35,0),(.75*duration,body_h,0),(duration,0,0)]),
   'Neck':br([(0,0),(.25*duration,-4),(.5*duration,3),(.75*duration,-4),(duration,0)]),
   'Tail_01':ar([(0,-4),(.5*duration,4),(duration,-4)],'y'),
   'Tail_02':ar([(0,3),(.5*duration,-3),(duration,3)],'y')}
  for i,l in enumerate(legs):
   phase=0 if i in (0,3) else .5
   # Explicit 5 keys; translated for phase so continuity maintained
   signs=[1,0,-1,0,1] if phase==0 else [-1,0,1,0,-1]
   c[l]=br([(j*duration/4, swing*v) for j,v in enumerate(signs)])
   ls=[-knee*.25,knee*.7,knee,-knee*.25,-knee*.25] if phase==0 else [knee,knee*.2,-knee*.25,knee*.8,knee]
   c[lows[i]]=br([(j*duration/4,ls[j]) for j in range(5)])
   c[feet[i]]=br([(j*duration/4,-ls[j]*.24) for j in range(5)])
  add(name,duration,c,note='Four-legged coordinated procedural gait; in-place')
 gait('walk',1.55,17,.025,18)
 gait('trot',.90,26,.036,24)
 gait('run',.64,33,.058,32)
 gait('sprint',.49,40,.083,39)
 add('idle',3,{'Body':body([(0,0,0),(1,.006,0),(2,0,0),(3,0,0)]), 'Head':ar([(0,-6),(.8,3),(1.9,0),(3,-6)],'y'),'Tail_02':ar([(0,-3),(1.5,4),(3,-3)],'y')},note='Breathing and cautious head scanning')
 add('turn_left',1.0,{'Root':ar([(0,0),(.45,25),(1,45)],'y'), 'Head':ar([(0,0),(.33,22),(1,0)],'y'), 'Tail_01':ar([(0,0),(.5,-13),(1,-8)],'y')},False,'Turning on the spot (root rotation); reverse for opposite direction')
 add('turn_right',1.0,{'Root':ar([(0,0),(.45,-25),(1,-45)],'y'), 'Head':ar([(0,0),(.33,-22),(1,0)],'y'), 'Tail_01':ar([(0,0),(.5,13),(1,8)],'y')},False,'Turning to the right')
 add('browse',2.4,{'Neck':br([(0,0),(.5,-33),(1.0,-42),(1.7,-40),(2.4,0)]), 'Head':br([(0,0),(.5,-13),(1.1,-11),(1.55,-18),(2.4,0)]),'Jaw':br([(0,0),(1.1,13),(1.30,0),(1.52,12),(1.76,0),(2.4,0)])},note='Reaches leaves with neck, tears and chews')
 add('chew',1.15,{'Jaw':br([(0,0),(.17,12),(.36,1),(.54,13),(.78,0),(1.15,0)]),'Head':ar([(0,0),(.5,-3),(1.15,0)],'z')},note='Plant-chewing mandibular cycle')
 add('drink',2.8,{'Neck':br([(0,0),(.62,-47),(1.55,-50),(2.18,-36),(2.8,0)]), 'Head':br([(0,0),(.7,-19),(1.4,-12),(1.78,-21),(2.8,0)]),'Jaw':br([(0,0),(1.22,9),(1.50,0),(1.80,8),(2.8,0)])},note='Lower muzzle to water, sip, lift')
 add('rest',3.6,{'Body':body([(0,0,0),(.8,-.34,0),(2.85,-.35,0),(3.6,0,0)]),'Neck':br([(0,0),(1,-25),(2.8,-24),(3.6,0)]),**{l:br([(0,0),(1,-36),(2.8,-36),(3.6,0)]) for l in ['FrontUpper_L','FrontUpper_R','HindUpper_L','HindUpper_R']}},note='Lower to the ground with folded limbs')
 add('sleep',4.0,{'Body':body([(0,-.33,0),(1,-.36,0),(2,-.342,0),(3,-.36,0),(4,-.33,0)]),'Neck':br([(0,-22),(1,-26),(3,-25),(4,-22)]),'Head':ar([(0,8),(2,9),(4,8)],'y')},note='Breathing while lying; transition via rest')
 add('thermoregulate',3.0,{'Neck':br([(0,0),(.7,13),(1.8,18),(3,0)]),'Head':ar([(0,0),(1,17),(2,-10),(3,0)],'y'),'Tail_01':ar([(0,0),(1.5,5),(3,0)],'y')},note='Raise posture and seek sun or cooling')
 add('scan',3.0,{'Neck':ar([(0,0),(.65,-11),(1.25,-11),(2,13),(3,0)],'y'),'Head':ar([(0,0),(.55,-23),(1.1,-18),(2,26),(3,0)],'y'),'Crown':ar([(0,0),(1,.8),(2,-.7),(3,0)],'z')},note='Head tracking and vigilance')
 add('freeze',2.4,{'Neck':br([(0,0),(.22,11),(2.0,11),(2.4,0)]),'Head':ar([(0,0),(.4,-7),(1.4,-7),(2.4,0)],'y'),'Tail_01':br([(0,0),(.3,-6),(2,-6),(2.4,0)])},note='Motionless cautious posture after uncertain stimulus')
 add('alarm_call',1.9,{'Neck':br([(0,0),(.25,15),(.8,13),(1.35,15),(1.9,0)]),'Jaw':br([(0,0),(.28,22),(.48,0),(.78,19),(1.02,0),(1.27,22),(1.52,0),(1.9,0)]),'Head':br([(0,0),(.3,9),(1.4,6),(1.9,0)])},note='Group warning sound with moving jaw')
 add('flee_start',.95,{'Body':body([(0,0,0),(.19,-.065,.04),(.39,.045,-.02),(.67,.09,-.075),(.95,.02,-.02)]),'Neck':br([(0,0),(.2,-16),(.55,19),(.95,0)]),'FrontUpper_L':br([(0,0),(.25,-25),(.60,28),(.95,22)]),'FrontUpper_R':br([(0,0),(.25,-25),(.60,28),(.95,22)]),'HindUpper_L':br([(0,0),(.25,25),(.60,-30),(.95,-20)]),'HindUpper_R':br([(0,0),(.25,25),(.60,-30),(.95,-20)])},False,'Launch into escape; blend into run')
 add('jump',1.3,{'Body':body([(0,0,0),(.22,-.08,.0),(.55,.24,-.09),(.79,.29,-.10),(1.08,.08,-.03),(1.3,0,0)]),'FrontUpper_L':br([(0,0),(.3,-23),(.65,45),(1.08,-12),(1.3,0)]),'FrontUpper_R':br([(0,0),(.3,-23),(.65,45),(1.08,-12),(1.3,0)]),'HindUpper_L':br([(0,0),(.3,24),(.65,-22),(1.08,14),(1.3,0)]),'HindUpper_R':br([(0,0),(.3,24),(.65,-22),(1.08,14),(1.3,0)]),'Tail_01':br([(0,0),(.6,-14),(1.3,0)])},False,'Short leap over obstacle; in-place')
 add('land',.55,{'Body':body([(0,.09,0),(.18,-.05,0),(.35,-.09,0),(.55,0,0)]),'FrontLower_L':br([(0,-27),(.2,23),(.55,0)]),'FrontLower_R':br([(0,-27),(.2,23),(.55,0)]),'Neck':br([(0,0),(.2,-13),(.55,0)])},False,'Absorb landing on four feet')
 add('regroup',2.2,{'Head':ar([(0,0),(.5,-20),(.95,-6),(1.55,20),(2.2,0)],'y'),'Tail_01':ar([(0,0),(.6,10),(1.4,-8),(2.2,0)],'y'),'Jaw':br([(0,0),(.58,7),(.8,0),(2.2,0)])},note='Locate flock and call softly')
 add('social_display',3.0,{'Neck':br([(0,0),(.5,19),(1.8,21),(3,0)]),'Head':ar([(0,0),(.75,-22),(1.7,19),(3,0)],'y'),'Crown':ar([(0,0),(.6,-6),(1.7,6),(3,0)],'z'),'Tail_01':ar([(0,0),(1.0,-15),(2.1,15),(3,0)],'y')},note='Adult raises keratin crest for ritual display')
 add('head_sweep',1.3,{'Neck':ar([(0,0),(.30,-31),(.68,36),(1.04,-10),(1.3,0)],'y'),'Head':ar([(0,0),(.33,-19),(.66,24),(1.3,0)],'y'),'Crown':ar([(0,0),(.45,-5),(.9,6),(1.3,0)],'z')},False,'Short defensive lateral crown swing')
 add('hind_kick',1.0,{'HindUpper_R':br([(0,0),(.22,-34),(.44,34),(.70,-28),(1,0)]),'HindLower_R':br([(0,0),(.18,33),(.42,-42),(.7,20),(1,0)]),'Body':ar([(0,0),(.25,-5),(.65,6),(1,0)],'z'),'Tail_01':br([(0,0),(.40,-17),(1,0)])},False,'Kick backward when cornered')
 add('short_charge',1.1,{'Neck':br([(0,0),(.22,-31),(.66,-35),(1.1,0)]),'Head':br([(0,0),(.32,-17),(.78,-17),(1.1,0)]),'Body':body([(0,0,0),(.3,-.045,.05),(.7,.025,-.08),(1.1,0,0)]),'FrontUpper_L':br([(0,0),(.3,33),(.7,-31),(1.1,0)]),'FrontUpper_R':br([(0,0),(.3,-31),(.7,33),(1.1,0)])},False,'Short defensive head-first lunge; navigation handles displacement')
 add('hurt',.80,{'Body':ar([(0,0),(.15,-9),(.34,12),(.8,0)],'z'),'Neck':br([(0,0),(.21,-19),(.45,9),(.8,0)]),'Tail_01':ar([(0,0),(.2,18),(.5,-9),(.8,0)],'y')},False,'Recoils from impact')
 add('death',2.8,{
 'Body':{'rotation':rotseq([(0,0),(.7,-12),(1.7,-66),(2.2,-88),(2.8,-88)],'z'), 'translation':trseq([(0,(0,0,0)),(.9,(0,-.05,0)),(1.8,(.02,-.27,0)),(2.8,(.02,-.36,0))],'Body')},
 'Neck':br([(0,0),(.9,-19),(1.9,-26),(2.8,-30)]),
 'FrontUpper_L':br([(0,0),(1.7,25),(2.8,31)]),
 'HindUpper_R':br([(0,0),(1.7,-25),(2.8,-31)]),
 'Tail_01':br([(0,0),(1.5,17),(2.8,22)])},False,'Non-loop fall and final stillness')
 add('nest_guard',3.0,{'Neck':br([(0,0),(.35,-18),(2.3,-18),(3,0)]),'Head':ar([(0,0),(.6,-18),(1.5,19),(2.4,-9),(3,0)],'y'),'Tail_01':br([(0,0),(.5,-8),(2.5,-8),(3,0)])},note='Keep watch over a ground nest')
 add('juvenile_follow',1.2,{'Body':body([(0,0,0),(.3,.026,0),(.6,0,0),(.9,.026,0),(1.2,0,0)]),'Neck':br([(0,0),(.4,8),(.9,-5),(1.2,0)]),'FrontUpper_L':br([(0,16),(.3,-16),(.6,16),(.9,-16),(1.2,16)]),'FrontUpper_R':br([(0,-16),(.3,16),(.6,-16),(.9,16),(1.2,-16)]),'HindUpper_L':br([(0,-14),(.3,14),(.6,-14),(.9,14),(1.2,-14)]),'HindUpper_R':br([(0,14),(.3,-14),(.6,14),(.9,-14),(1.2,14)])},note='Scaled juveniles stay near adult')
 return clips

def save(variant):
 G.clear();make_geometry();binary=Binary();materials=[];mids={}
 for k,col in PALETTES[variant].items():
  mids[k]=len(materials);materials.append({'name':k,'doubleSided':True,'pbrMetallicRoughness':{'baseColorFactor':list(col)+[1.0],'roughnessFactor':.86,'metallicFactor':0}})
 prim=[];vc=tc=0
 for mat,g in G.items():
  pts=np.asarray(g['vertices'],dtype=np.float32);tris=np.asarray(g['faces'],dtype=np.uint32)
  norms=np.zeros_like(pts); e=np.cross(pts[tris[:,1]]-pts[tris[:,0]],pts[tris[:,2]]-pts[tris[:,0]])
  for k in range(3):np.add.at(norms,tris[:,k],e)
  lengths=np.maximum(np.linalg.norm(norms,axis=1),1e-8);norms/=lengths[:,None]
  joints=np.zeros((len(pts),4),dtype=np.uint16);joints[:,0]=np.array(g['joints'],dtype=np.uint16)
  weights=np.zeros((len(pts),4),dtype=np.float32);weights[:,0]=1
  prim.append({'attributes':{
   'POSITION':binary.accessor(pts,5126,'VEC3',34962,True),
   'NORMAL':binary.accessor(norms,5126,'VEC3',34962),
   'JOINTS_0':binary.accessor(joints,5123,'VEC4',34962),
   'WEIGHTS_0':binary.accessor(weights,5126,'VEC4',34962)
  },'indices':binary.accessor(tris.reshape(-1),5125,'SCALAR',34963),'material':mids[mat],'mode':4})
  vc+=len(pts);tc+=len(tris)
 nodes=[]
 for n,parent,o in BONES:nodes.append({'name':n,'translation':list(o),'rotation':[0,0,0,1],'children':[]})
 for n,p,o in BONES:
  if p:nodes[BONE_ID[p]]['children'].append(BONE_ID[n])
 nodes.append({'name':'Silvarano_MidPoly','mesh':0,'skin':0});nodes.append({'name':'Silvarano_'+variant,'children':[0,len(nodes)-1]})
 ibms=[]
 for n,p,o in BONES:
  m=np.eye(4,dtype=np.float32);m[:3,3]=-REST[n];ibms.append(m.T.reshape(-1))
 ibm=binary.accessor(np.asarray(ibms,dtype=np.float32),5126,'MAT4')
 anim=build_anims(binary)
 gltf={'asset':{'version':'2.0','generator':'Wildhaven Silvarano procedural skinned v0.1','copyright':'Original Wildhaven creature asset'},
 'scene':0,'scenes':[{'name':'Wildhaven Silvarano '+variant,'nodes':[len(nodes)-1]}],'nodes':nodes,
 'meshes':[{'name':'Silvarano_LOD0_'+variant,'primitives':prim}],
 'skins':[{'name':'Silvarano_Rig','inverseBindMatrices':ibm,'joints':list(range(len(BONES))),'skeleton':0}],
 'materials':materials,'animations':anim,'bufferViews':binary.views,'accessors':binary.accessors,
 'buffers':[{'byteLength':len(binary.b)}],
 'extras':{'speciesId':'silvarano','version':'0.1.0','variant':variant,'units':'metres',
    'style':'real mesh mid-poly, rigid region skinning, three-finger toes with claws',
    'animationClips':[a['name'] for a in anim]}}
 js=json.dumps(gltf,ensure_ascii=False,separators=(',',':')).encode()
 js+=b' '*((-len(js))%4)
 blob=bytes(binary.b)+b'\x00'*((-len(binary.b))%4)
 out=struct.pack('<4sII',b'glTF',2,12+8+len(js)+8+len(blob))+struct.pack('<I4s',len(js),b'JSON')+js+struct.pack('<I4s',len(blob),b'BIN\0')+blob
 f=D/f'silvarano_{variant}_animated_v01.glb';f.write_bytes(out)
 mn=np.vstack([np.asarray(g['vertices']) for g in G.values()])
 return {'variant':variant,'file':f.name,'bytes':len(out),'sha256':hashlib.sha256(out).hexdigest(),
 'vertices':vc,'triangles':tc,'bones':len(BONES),'materials':len(materials),
 'animationCount':len(anim),'clips':{a['name']:a['extras']['durationSeconds'] for a in anim},
 'bboxM':[mn.min(axis=0).round(4).tolist(),mn.max(axis=0).round(4).tolist()]}

if __name__=='__main__':
 a=[save(v) for v in PALETTES]
 (D/'silvarano_manifest.json').write_text(json.dumps({'species':'silvarano','version':'0.1','variants':a,'rig':[[a,b,list(c)] for a,b,c in BONES],'limitations':['rigid skinning with seams','no IK foot planting','in-place locomotion','no collisions or gameplay AI']},indent=2,ensure_ascii=False)+'\n')
 print(json.dumps(a,indent=2,ensure_ascii=False))
