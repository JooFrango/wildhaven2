#!/usr/bin/env python3
"""Wildhaven Dodarro v02, complete new anatomy; two independently exportable GLBs.

No reuse of v01 geometry. All surface colours/patterns come from one hand-authored
procedural 3072 x 2560 UV atlas, not colour-overlay meshes. Anatomically structural
silhouette feathers, beak, eyes, toes, straps and tack have purposeful geometry.
Coordinate system: X=beak/forward; Y=up; Z=left/right. Triangle counts <= 5000.
"""
from __future__ import annotations
import json, math, hashlib, random
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import trimesh
from trimesh.visual.material import PBRMaterial

ROOT=Path(__file__).resolve().parent.parent
SEED=1032
RNG=random.Random(SEED)
SIZE=2560;NC=5;CELL=SIZE//NC
SWATCH={
 'body': (125,92,82),'body_dark':(102,76,65),'chest':(239,213,175),'chest_light':(244,217,164),
 'neck':(183,110,73),'crest':(190,79,49),'crest_tip':(216,99,56),'wing':(105,117,143),
 'wing_light':(124,136,158),'wing_gold':(195,123,54),'tail':(183,103,64),
 'face':(206,148,86),'beak_base':(206,132,54),'beak_horn':(75,67,77),
 'leg':(113,95,88),'claw':(53,49,55),'eye':(191,120,34),
 'leather':(104,62,39),'leather_light':(153,104,61),'strap':(123,76,44),
 'brass':(170,134,74),'saddle_cloth':(151,58,47),'pack':(106,72,48),
 'roll':(158,93,60),'shadow':(50,37,36),'banner':(152,57,41),
}
# 6 x 5 UV material tiles at 512 px each; no geometry purely for recolouring.
COLS=6;ROWS=5;W=3072;H=2560;S=512
KEYS=list(SWATCH)
assert len(KEYS)==26, len(KEYS)

def clamp(x):return int(max(0,min(255,x)))
def paint_atlas():
 im=Image.new('RGB',(W,H),(88,68,58)); d=ImageDraw.Draw(im)
 for i,name in enumerate(KEYS):
  x0=(i%COLS)*S; y0=(i//COLS)*S
  col=SWATCH[name]
  # brushed ground: independent, continuous low-frequency tones; no geometry used for colours
  tile=Image.new('RGB',(S,S),col);dr=ImageDraw.Draw(tile,'RGBA')
  rr=random.Random(325+i*131)
  for k in range(380):
   x=rr.randint(1,S-1);y=rr.randint(1,S-1)
   thick=rr.randint(1,4)
   change=rr.choice([-21,-14,-10,-6,6,10,15,22])
   c=tuple(clamp(j+change) for j in col)+(rr.randint(22,58),)
   if name in ('body','body_dark','chest','chest_light','neck','crest','crest_tip','wing','wing_light','wing_gold','tail'):
    L=rr.randint(14,58)
    dr.arc((x-11,y-L/2,x+11,y+L/2),0,90,fill=c,width=thick)
    dr.line((x,y-L*.23,x-rr.randint(0,7),y+L*.22),fill=c,width=1)
   elif name in ('leather','leather_light','strap','saddle_cloth','pack','roll'):
    dr.line((x,y,x+rr.randint(12,40),y+rr.randint(-8,8)),fill=c,width=thick)
   elif name in ('beak_horn','beak_base','leg','claw'):
    dr.line((x,y,x+rr.randint(-20,20),y+rr.randint(8,35)),fill=c,width=thick)
   else:dr.ellipse((x,y,x+rr.randint(1,8),y+rr.randint(1,8)),fill=c)
  # some feather-barb striations are painted in the atlas rather than authored meshes
  if name in ('wing','wing_light','wing_gold','crest','tail','chest'):
   center=S//2
   for j in range(8):
    y=52+j*52
    dr.line((center-64,y,center+4,y+28,center+75,y),fill=(24,15,12,28),width=2)
  if name=='banner':
   # ornate weathered sun emblem is paint, never extra geometry
   gold=(214,169,94,220)
   cx=cy=S//2
   dr.ellipse((cx-56,cy-56,cx+56,cy+56),outline=gold,width=10)
   for k in range(12):
    a=2*math.pi*k/12
    dr.line((cx+72*math.cos(a),cy+72*math.sin(a),cx+100*math.cos(a),cy+100*math.sin(a)),fill=gold,width=9)
   dr.ellipse((cx-11,cy-11,cx+11,cy+11),fill=gold)
  im.paste(tile,(x0,y0))
 return im
ATLAS=paint_atlas()

def uvmap(name,uv):
 # tile's 512 px image padded to avoid bilinear bleeding
 idx=KEYS.index(name);col=idx%COLS;row=idx//COLS
 u,v=uv;u=.04+.92*u;v=.04+.92*v
 return ((col+u)/COLS,1-(row+v)/ROWS)

class Builder:
 def __init__(self):self.v=[];self.uv=[];self.f=[];self.parts={}
 def add(self,name,v,f,uv,mat):
  old=len(self.f);vv=np.asarray(v,float); uvs=list(uv)
  for tri in f:
   a=len(self.v)
   tile=mat(vv[np.asarray(tri,dtype=np.int32)].mean(axis=0)) if callable(mat) else mat
   for idx in tri:
    self.v.append(vv[idx].tolist());self.uv.append(uvmap(tile,uvs[idx]))
   self.f.append((a,a+1,a+2))
  self.parts[name]=len(self.f)-old
 def loft_x(self,name,secs,mat,n=12,phase=0):
  # cross-sectional custom deformable solid, sections (x,y,ry,rz,cz)
  v=[];uv=[];f=[]
  for i,(x,y,ry,rz,cz) in enumerate(secs):
   for j in range(n+1):
    a=2*math.pi*j/n+phase
    yy=y+ry*math.cos(a); zz=cz+rz*math.sin(a)
    v.append((x,yy,zz));uv.append((i/max(1,len(secs)-1),j/n))
  for i in range(len(secs)-1):
   for j in range(n):
    a=i*(n+1)+j;bb=a+1;c=a+n+1;dd=c+1
    f +=[(a,c,bb),(bb,c,dd)]
  for j in range(1,n-1):
   f +=[(0,j+1,j)]
   k=(len(secs)-1)*(n+1);f +=[(k,k+j,k+j+1)]
  self.add(name,v,f,uv,mat)
 def loft_y(self,name,secs,mat,n=10):
  # x,y,z,rx,rz; fast and anatomically controllable neck/leg continuation
  v=[];uv=[];f=[]
  for i,(x,y,z,rx,rz) in enumerate(secs):
   for j in range(n+1):
    a=2*math.pi*j/n
    v.append((x+rx*math.cos(a),y,z+rz*math.sin(a)))
    uv.append((j/n,i/max(1,len(secs)-1)))
  for i in range(len(secs)-1):
   for j in range(n):
    a=i*(n+1)+j;bb=a+1;c=a+n+1;dd=c+1
    f +=[(a,bb,c),(bb,dd,c)]
  for j in range(1,n-1):
   f +=[(0,j,j+1)]
   k=(len(secs)-1)*(n+1);f +=[(k,k+j+1,k+j)]
  self.add(name,v,f,uv,mat)
 def tube(self,name,points,radii,mat,sides=7):
  points=np.array(points,float);radi=np.array(radii if hasattr(radii,'__len__') else [radii]*len(points),float)
  v=[];f=[];uv=[]
  for i,p in enumerate(points):
   ax=points[min(i+1,len(points)-1)]-points[max(i-1,0)];ax/=max(1e-6,np.linalg.norm(ax))
   helper=np.array([0.,0.,1.])
   if abs(np.dot(helper,ax))>.9:helper=np.array([0.,1.,0.])
   t=np.cross(ax,helper);t/=np.linalg.norm(t);s=np.cross(ax,t)
   for j in range(sides+1):
    a=2*math.pi*j/sides
    v.append(p+radi[i]*(math.cos(a)*t+math.sin(a)*s));uv.append((i/max(1,len(points)-1),j/sides))
  for i in range(len(points)-1):
   for j in range(sides):
    a=i*(sides+1)+j;b=a+1;c=a+sides+1;d=c+1
    f.extend(((a,c,b),(b,c,d)))
  for j in range(1,sides-1):
   f.append((0,j+1,j))
   s=(len(points)-1)*(sides+1);f.append((s,s+j,s+j+1))
  self.add(name,v,f,uv,mat)
 def leaf(self,name,root,tip,width,mat,normal=None,arc=0.06):
  # Five/few real geometric faces: integrated curved feather silhouette with ridge, NOT colour layer
  root=np.array(root,float);tip=np.array(tip,float)
  axis=tip-root;axis/=max(1e-6,np.linalg.norm(axis))
  normal=np.array([0,0,1.0 if root[2]>=0 else -1.0] if normal is None else normal,float)
  plane=np.cross(normal,axis);plane/=max(np.linalg.norm(plane),1e-6)
  if np.linalg.norm(plane)<1e-7:plane=np.array([0,1.0,0])
  p0=root-plane*width*.38;p1=root+plane*width*.38
  center=root*.47+tip*.53+normal*arc
  p2=center-plane*width*.82;p3=center+plane*width*.82
  ridge=center+normal*arc*.60
  verts=[p0,p1,p2,p3,ridge,tip]
  faces=[(0,2,4),(0,4,1),(1,4,3),(2,5,4),(3,4,5)]
  uv=[(.32,.06),(.68,.06),(.08,.48),(.92,.48),(.5,.54),(.50,.96)]
  self.add(name,verts,faces,uv,mat)
 def patch(self,name,points,mat,offset=.008):
  # thin physically present article of gear (not pure colour overlay)
  points=np.asarray(points,float);n=len(points)
  normal=np.cross(points[1]-points[0],points[2]-points[0]);normal/=max(np.linalg.norm(normal),1e-6)
  verts=list(points)+list(points+normal*offset)
  mn=points.min(axis=0);ma=points.max(axis=0)
  plane_dims=np.argsort(ma-mn)[-2:]
  uv=[tuple((p[plane_dims]-mn[plane_dims])/np.maximum(ma[plane_dims]-mn[plane_dims],1e-5)) for p in verts]
  f=[]
  for j in range(1,n-1):f.extend(((0,j,j+1),(n,n+j+1,n+j)))
  for j in range(n):
   k=(j+1)%n;f.extend(((j,k,n+k),(j,n+k,n+j)))
  self.add(name,verts,f,uv,mat)
 def ribbon(self,name,points,width,mat,sideaxis=(0,0,1)):
  pts=[np.array(p,float) for p in points];axis=np.array(sideaxis,float)
  vv=[];uv=[];ff=[]
  for j,p in enumerate(pts):
   d=pts[min(j+1,len(pts)-1)]-pts[max(0,j-1)];d/=max(np.linalg.norm(d),1e-6)
   t=np.cross(d,axis)
   if np.linalg.norm(t)<1e-6:t=np.cross(d,[1,0,0])
   t/=max(np.linalg.norm(t),1e-6)
   vv.extend((p+t*width*.5,p-t*width*.5));uv.extend(((0,j/(len(pts)-1)),(1,j/(len(pts)-1))))
  for j in range(len(pts)-1):
   a=2*j;c=a+2;ff.extend(((a,c,a+1),(a+1,c,c+1)))
  self.add(name,vv,ff,uv,mat)
 def mesh(self):
  m=trimesh.Trimesh(vertices=np.array(self.v,np.float32),faces=np.array(self.f,np.int64),process=False)
  mat=PBRMaterial(baseColorTexture=ATLAS,metallicFactor=0,roughnessFactor=.93,doubleSided=True)
  m.visual=trimesh.visual.TextureVisuals(uv=np.array(self.uv,np.float32),material=mat)
  return m

# CONCEPT proportions: 3.05m beak to tail, 2.4m tall, body a forward-high wedge,
# lush feathers, strong wide torso, brisk thick legs, heavy multi-tone beak.

def build(saddled=False):
 B=Builder()
 # 1. Single dominant load bearing anatomical torso - lifted chest, broad flank, tucked abdomen
 B.loft_x('A01_seamless_chest_flank_hip',[
  (-1.22,1.51,.075,.11,0),(-1.11,1.50,.26,.31,0),(-1.00,1.53,.43,.44,0),
  (-.82,1.52,.52,.53,0),(-.57,1.51,.55,.60,0),(-.31,1.53,.58,.61,0),
  (-.05,1.55,.58,.57,0),(.22,1.59,.53,.50,0),(.45,1.64,.40,.40,0),
  (.58,1.68,.25,.29,0),(.69,1.70,.08,.10,0)
 ],lambda p:'chest' if p[0]>-.39 and p[1]<1.86 else 'body',n=16,phase=math.pi/16)
 # cranial slope & neck should flow forward, not stick straight out of body.
 B.loft_y('A02_fleshy_S_neck',[
  (.44,1.48,0,.38,.34),(.55,1.66,0,.34,.31),(.63,1.83,0,.28,.25),
  (.68,1.99,0,.24,.20),(.72,2.15,0,.22,.20),(.77,2.27,0,.20,.20),
  (.84,2.33,0,.19,.18)
 ],lambda p:'neck' if p[0]<.61 else 'chest',n=14)
 # chest plumage sweep anatomical in front of neck and keel (not floating spines)
 for row in range(5):
  for i in range(6):
   s=(-1 if i<3 else 1)
   pos=(i%3)-1
   yy=1.73+row*.105
   x=.87+row*.018
   z=s*(.09+(pos+1)*.085)
   tail=(x-.17,yy-.17,z+s*.045)
   B.leaf(f'A03_neck_down_{row}_{i}',(x,yy,z),tail,.128,'chest' if row<3 else 'chest_light',normal=(.42,.04,s*.75),arc=.031)
 # Decorative color on this breast is UV paint; feathers here sculpt the outer contour.
 for side in (-1,1):
  for row in range(4):
   for j in range(6):
    x=.52-j*.13-row*.04
    yy=1.55+row*.095
    zz=side*(.29+row*.022+j*.012)
    B.leaf(f'A04_breast_coverts_{side}_{row}_{j}',(x,yy,side*(.47+row*.025+j*.004)),
       (x-.14,yy-.205,side*(.55+row*.023+j*.003)),.165,
       'chest_light' if row%3==0 else 'chest',normal=(.2,-.1,side*.8),arc=.025)
 # Additional chest apron follows curved front of keel and creates overlap, not a flat fake colour.
 for side in (-1,1):
  for row in range(3):
   for j in range(7):
    x=.50-j*.115
    y=1.36+row*.10
    z=side*(.34+row*.055)
    B.leaf(f'A05_deep_keel_coverts_{side}_{row}_{j}',(x,y,z),
        (x-.13,y-.19,z+side*.085),.148,
        'chest' if row!=1 else 'chest_light',normal=(.3,.0,side*.9),arc=.033)
 # 2. Independent planar sculpted head with robust angular cheekbones
 B.loft_x('B01_anatomical_head_skull',[
  (.64,2.27,.125,.15,0),(.69,2.33,.21,.21,0),(.81,2.36,.25,.275,0),
  (.96,2.35,.25,.275,0),(1.10,2.30,.20,.245,0),(1.20,2.255,.14,.20,0)
 ],lambda p:'wing' if p[1]>2.50 and p[0]<.97 else ('chest' if p[1]<2.28 else 'face'),n=14,phase=math.pi/14)
 # cheek-jowls are structural (not colour overlays)
 for side in (-1,1):
  z=side
  B.patch(f'B02_lateral_cheek_{side}',[(.82,2.28,z*.258),(1.06,2.27,z*.270),(1.19,2.19,z*.20),(.99,2.12,z*.22),(.80,2.17,z*.23)],'face',offset=.015)
  # defined eyebrow brow expression incl inset eyelid and eyeball; actual ocular structure
  B.patch(f'B03_socket_{side}',[(.854,2.405,z*.280),(.929,2.433,z*.284),(1.00,2.399,z*.277),(1.015,2.349,z*.280),(.946,2.310,z*.282),(.870,2.342,z*.280)],'body_dark',offset=.010)
  B.patch(f'B04_amber_eye_{side}',[(.872,2.373,z*.299),(.884,2.402,z*.299),(.914,2.417,z*.303),(.950,2.410,z*.303),(.980,2.384,z*.301),(.982,2.352,z*.303),(.953,2.328,z*.302),(.908,2.329,z*.299)],'eye',offset=.012)
  B.patch(f'B05_pupil_{side}',[(.925,2.389,z*.323),(.952,2.389,z*.324),(.962,2.361,z*.326),(.945,2.347,z*.326),(.925,2.362,z*.324)],'shadow',offset=.006)
  # Eyelid silhouette and orbital brow are included in the sculpted eye socket.
 # Beak mandibles, chunky ochre basal cere followed by heavy distinctly hooked tip
 B.loft_x('B07_orange_upper_cere',[
  (1.12,2.275,.135,.19,0),(1.23,2.265,.162,.216,0),
  (1.37,2.254,.156,.21,0),(1.49,2.25,.13,.175,0)],'beak_base',n=12,phase=math.pi/12)
 B.loft_x('B08_black_curtained_hook',[
  (1.35,2.258,.147,.20,0),(1.48,2.245,.19,.215,0),
  (1.63,2.231,.19,.21,0),(1.77,2.207,.154,.168,0),
  (1.85,2.154,.129,.125,0),(1.86,2.073,.097,.08,0),
  (1.80,1.996,.070,.057,0),(1.77,1.975,.015,.017,0)
 ],'beak_horn',n=12,phase=math.pi/12)
 B.loft_x('B09_lower_beak_kiefer',[(1.17,2.182,.055,.175,0),(1.37,2.18,.069,.177,0),
    (1.57,2.165,.056,.153,0),(1.70,2.119,.028,.095,0)],'beak_base',n=10)
 # textured nostrils inset at either side; no extra recolouring layer
 for side in (-1,1):
  z=side
  B.patch(f'B10_nostril_{side}',[(1.28,2.318,z*.199),(1.342,2.32,z*.202),(1.359,2.289,z*.20),(1.29,2.279,z*.204)],'shadow',offset=.003)
 # Deep rich crest, strongly swept back over head - layered real geometry that affects silhouette
 for side in (-1,1):
  for i in range(9):
   x=.75-(i//3)*.075+(i%3)*.025
   z=side*(.08+(i%3)*.080)
   y=2.54-.023*i
   B.leaf(f'B11_cranial_plumes_{side}_{i}',(x,y,z),
     (.33-(i%3)*.09-(i//3)*.09,2.78-i*.073,z+side*.085),.135 if i<4 else .15,
     'crest_tip' if i<3 else 'crest',normal=(0,.48,side*.46),arc=.038)
  # back-of-neck deep layered red feathers, smooth laminar overlap; no floating fragments
  for r in range(3):
   for j in range(7):
    yy=2.23-j*.093
    x=.58-r*.063-j*.011
    z=side*(.27+r*.018)
    B.leaf(f'B12_neck_mane_{side}_{r}_{j}',(x,yy,z),
      (x-.16-r*.027,yy-.23-r*.020,z+side*.028),.145,
      'neck' if j<3 else ('crest' if r==0 else 'neck'),normal=(-.2,.0,side*.8),arc=.032)
 # 3. Wing support volumes and truly layered blue/navy/gold feathers
 for side in (-1,1):
  z=side
  B.loft_x(f'C01_scapular_wing_base_{side}',[
   (-.94,1.64,.16,.11,z*.48),(-.75,1.70,.23,.14,z*.49),
   (-.48,1.73,.245,.16,z*.51),(-.15,1.74,.217,.145,z*.50),
   (.13,1.70,.17,.11,z*.45),(.33,1.63,.08,.06,z*.41)
  ],'wing',n=10)
  # start at front high on wing and layer along rear, sizes change with anatomy
  for row in range(3):
   for j in range(11):
    x=.26-j*.124-row*.030
    y=1.81-row*.100-.025*(j>6)
    zz=z*(.56+row*.043 +.025*math.sin(j*.5))
    length=(.25 if row==0 else .32 if row==1 else .42)*(1-.025*j)
    B.leaf(f'C02_structural_wing_flight_{side}_{row}_{j}',(x,y,zz),
      (x-.27-row*.045,y-length,z*(.65+row*.082)),.155 if row<2 else .185,
      'wing' if row<2 else ('wing_light' if j%4 else 'wing_gold'),normal=(0,.0,z),arc=.040)
  # upper mantel feathers: golden highlights at critical points, *actual feathers* not just color overlay
  for j in range(9):
   x=.05-j*.128;y=1.91-.014*(j>4)
   B.leaf(f'C03_scapular_broad_{side}_{j}',(x,y,z*.61),(x-.23,y-.20,z*.70),.16,
          'wing_gold' if j in (1,6) else 'wing',normal=(0,.2,z),arc=.025)
 # 4. Tail a large fan, multiple winglike orange tips at rear; avoid pin needle quills
 for j in range(13):
  angle=(j-6)/6
  zz=angle*.22
  x=-1.13
  B.leaf(f'D01_lush_tail_fan_{j}',(x,1.74,zz),
         (-1.68+abs(angle)*.15,1.95-.23*abs(angle),angle*.52),
         .19,'tail' if j%4 else 'crest_tip',normal=(0,.2,1),arc=.035)
 for side in (-1,1):
  # low side tail plumes, silhouette falls below wing, no ugly needles
  for j in range(5):
   B.leaf(f'D02_side_tail_{side}_{j}',(-.91-j*.06,1.58,side*.48),
          (-1.46-j*.040,1.38+j*.04,side*(.59+j*.036)),.14,
          'tail',normal=(0,0,side),arc=.025)
 # 5. Large weight-bearing anatomy, deeply grounded three-toe feet, thick shanks and haunch
 for side in (-1,1):
  z=side*.34
  B.loft_y(f'E01_hip_cushion_{side}',[
    (-.58,1.36,z,.31,.27),(-.52,1.18,z,.29,.26),
    (-.43,.96,z,.245,.21),(-.30,.79,z,.18,.16),(-.22,.69,z,.15,.14)
  ],'body_dark',n=12)
  B.loft_y(f'E02_knee_and_tarsus_{side}',[
    (-.21,.77,z,.165,.15),(-.16,.65,z,.16,.15),
    (-.20,.47,z,.138,.133),(-.24,.27,z,.127,.125),
    (-.19,.15,z,.164,.155)
  ],'leg',n=10)
  B.tube(f'E03_metatarsal_{side}',[(-.23,.20,z),(-.10,.12,z),(.11,.095,z)],
    (.154,.18,.19),'leg',9)
  for k in range(3):
   dz=(k-1)*.178; off=.06 if k==1 else 0
   B.tube(f'E04_big_digit_{side}_{k}',[(.04,.11,z+dz*.25),(.21,.075,z+dz*.75),(.39+off,.061,z+dz)],
           (.115,.107,.071),'leg',7)
   B.tube(f'E05_recurved_claw_{side}_{k}',[(.36+off,.064,z+dz),(.47+off,.057,z+dz*1.06),
         (.53+off,.019,z+dz*1.08)],(.084,.055,.012),'claw',7)
  # subtler short rear hallux, the natural extra bird-toe
  B.tube(f'E06_dewclaw_{side}',[(-.25,.15,z),(-.37,.10,z+side*.064),(-.42,.057,z+side*.072)],
         (.062,.055,.015),'claw',6)
 # Fine horizontal keratin segmentation is TEXTURE, not extra surface meshes.
 if saddled:
  # Real saddle follows barrel and leaves neck and wing shoulder anatomy unobscured.
  B.patch('F01_underlay_swept_saddle_blanket',[
    (-.83,2.065,-.42),(-.53,2.105,-.46),(-.14,2.093,-.38),
    (-.14,2.093,.38),(-.53,2.105,.46),(-.83,2.065,.42)
  ],'saddle_cloth',.022)
  B.patch('F02_low_seat_leather',[
    (-.76,2.10,-.31),(-.51,2.17,-.32),(-.24,2.16,-.29),(-.17,2.09,-.24),
    (-.17,2.09,.24),(-.24,2.16,.29),(-.51,2.17,.32),(-.76,2.10,.31)
  ],'leather',.029)
  B.tube('F03_saddle_cantle_back',[(-.75,2.105,-.30),(-.79,2.24,0),(-.75,2.105,.30)],
         (.058,.066,.058),'leather_light',6)
  B.tube('F04_saddle_pommel_front',[(-.18,2.10,-.26),(-.17,2.19,0),(-.18,2.10,.26)],
         (.054,.066,.054),'leather_light',6)
  # attach stirrups to saddle, NOT wing; leather chest strap under neck
  for side in (-1,1):
   z=side
   B.ribbon(f'F05_breastplate_{side}',[(.12,1.92,z*.39),(.33,1.73,z*.52),(.38,1.54,z*.43)],
      .055,'strap',(0,0,z))
   B.ribbon(f'F06_girth_strap_{side}',[(-.46,2.095,z*.40),(-.50,1.79,z*.68),(-.50,1.48,z*.63)],
      .068,'strap',(0,0,z))
   B.ribbon(f'F07_saddle_stirrup_{side}',[(-.43,1.72,z*.69),(-.44,1.46,z*.71),(-.33,1.46,z*.71),(-.31,1.53,z*.71)],
      .035,'brass',(0,0,z))
   # leather side pouch behind rider, structurally 3D pocket, not just flat colour overlay
   B.loft_x(f'F08_side_pouch_{side}',[
     (-.95,1.79,.055,.06,z*.59),(-.85,1.75,.17,.104,z*.63),
     (-.66,1.75,.18,.107,z*.64),(-.59,1.75,.08,.06,z*.61)
   ],'pack',n=7)
   B.patch(f'F09_leather_flap_{side}',[
     (-.89,1.87,z*.70),(-.67,1.86,z*.73),(-.67,1.70,z*.74),(-.89,1.70,z*.71)
   ],'leather_light',.013)
   # decorative banner is a hanging cloth rectangle, its sun emblem is TEXTURE not geometry
   B.patch(f'F10_banner_{side}',[
     (-.52,1.92,z*.69),(-.23,1.92,z*.69),(-.24,1.40,z*.69),(-.35,1.31,z*.69),(-.51,1.40,z*.69)
   ],'banner',.008)
  # saddle skirt leather panel takes the weight against the wing, not a floating chair
  # rolled bedroll behind rider sits low rather than big vertical wooden chair
  B.tube('F11_bedroll_across_saddle',[(-.88,2.12,-.30),(-.89,2.13,0),(-.88,2.12,.30)],
       (.125,.125,.125),'roll',8)
  for z in (-.24,.24):
   B.ribbon(f'F12_roll_binding_{z}',[(-.95,2.16,z),(-.88,2.25,z),(-.81,2.17,z)],
      .037,'strap',(0,0,1))
  # a simple head halter avoiding nose obstruction
  for side in (-1,1):
   z=side
   B.ribbon(f'F13_cheek_halter_{side}',[(.85,2.36,z*.26),(1.14,2.235,z*.23),
                                      (1.28,2.30,z*.20)],.039,'strap',(0,0,z))
 return B

def check_glb(path, expected_tri):
 data=path.read_bytes()
 assert data[:4]==b'glTF' and int.from_bytes(data[8:12],'little')==len(data)
 n=int.from_bytes(data[12:16],'little');info=json.loads(data[20:20+n]);scene=trimesh.load(str(path),force='scene')
 tri=sum(len(x.faces) for x in scene.geometry.values())
 assert tri==expected_tri,(tri,expected_tri)
 assert len(info['materials'])==1 and len(info['textures'])==1 and len(info['images'])==1
 assert len(info.get('skins',[]))==0 and len(info.get('animations',[]))==0
 assert all('TEXCOORD_0' in p['attributes'] for x in info['meshes'] for p in x['primitives'])
 assert 1000<tri<=5000,tri
 return data,tri

def make(saddled):
 variant='montaria' if saddled else 'selvagem'
 B=build(saddled)
 scene=trimesh.Scene();scene.add_geometry(B.mesh(),geom_name=f'dodarro_v02_{variant}')
 path=ROOT/f'dodarro_{variant}_v02_blockout.glb';scene.export(file_obj=str(path),file_type='glb')
 raw,tri=check_glb(path,len(B.f))
 manifest={
  'species_id':'dodarro','variant':variant,'version':'v02 complete anatomical rebuild from approved concept',
  'concept_approved':True,'blockout_approved':False,'revision_of':'v01, not modifying v01',
  'stage':'anatomical_blockout_review',
  'glb':path.name,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),
  'triangles':tri,'textures':{'atlas':'textures/dodarro_uv_atlas_v02.png','resolution':[3072,2560],'embedded':True,'material_count':1,'uv0':True},
  'bones':0,'skins':0,'clips':0,'lods':0,'source':'source/build_dodarro_v02.py',
  'anatomy_parts_triangles':B.parts,
  'notes':'All colour/shading/pattern is in UV atlas. No extra meshes to change colour. Silhouette feathers + equipment physically modelled; rig, animation and gameplay not implemented.'}
 (ROOT/f'manifest_{variant}_v02.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
 print('GLB',variant,tri,len(raw),'sha256',manifest['sha256'])
 return manifest

if __name__=='__main__':
 (ROOT/'textures').mkdir(exist_ok=True,parents=True)
 ATLAS.save(ROOT/'textures/dodarro_uv_atlas_v02.png',optimize=True)
 mans=[make(False),make(True)]
 (ROOT/'manifest_v02.json').write_text(json.dumps({'variants':mans},ensure_ascii=False,indent=2),encoding='utf-8')