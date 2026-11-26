#!/usr/bin/env python3
"""Wildhaven mountain wyvern anatomical concept blockouts, one shared mesh per variant.

Coordinates X=front, Y=up, Z=side. True wyvern anatomy: TWO hind legs and TWO
wing-forelimbs; NO additional arms. Broad snake skull with open jaw and long
front fangs. Surface patterns use UV-painted texture, not overlay mesh paint.
Four outputs: red male/gold female x wild/saddled. Static blockouts for
approval before refinements, skeletal deformation or animation.
"""
from __future__ import annotations
import hashlib, io, json, math, random
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from trimesh import Trimesh, Scene
from trimesh.visual.texture import TextureVisuals
from trimesh.visual.material import PBRMaterial

BASE=Path(__file__).resolve().parent.parent
ATLAS=2048
COLS=4; ROWS=4; CELL=512
TILES=['body','back','belly','neck','face','jaw','headplate','spines','wing','wingbone','membrane','dark','fang','eyes','leather','bronze']
PALETTES={
 'macho':{
  'body':(143,47,53),'back':(115,35,49),'belly':(219,190,156),'neck':(178,65,67),
  'face':(164,52,59),'jaw':(126,43,50),'headplate':(114,35,47),'spines':(190,69,68),
  'wing':(129,49,53),'wingbone':(107,33,39),'membrane':(158,69,65),'dark':(43,25,34),
  'fang':(229,215,185),'eyes':(220,169,82),'leather':(103,66,44),'bronze':(171,129,72),
 },
 'femea':{
  'body':(191,125,53),'back':(158,93,39),'belly':(232,204,163),'neck':(215,158,82),
  'face':(219,151,62),'jaw':(169,109,54),'headplate':(170,105,42),'spines':(230,174,85),
  'wing':(181,127,63),'wingbone':(141,89,44),'membrane':(204,151,96),'dark':(56,39,35),
  'fang':(235,223,192),'eyes':(196,117,38),'leather':(103,66,44),'bronze':(174,136,75),
 }
}

def clamp(c):return max(0,min(255,int(c)))
def make_atlas(sex):
 rnd=random.Random(77 if sex=='macho' else 78)
 sheet=Image.new('RGB',(ATLAS,ATLAS),(40,30,28))
 for i,name in enumerate(TILES):
  base=PALETTES[sex][name]; t=Image.new('RGB',(CELL,CELL),base)
  d=ImageDraw.Draw(t,'RGBA')
  # finely shaded facets, scale rows and grain are painted only into the image
  for row in range(14):
   for col in range(17):
    x=col*33+(-9 if row%2 else 0)+rnd.randint(-3,3)
    y=row*36+rnd.randint(-3,3)
    diff=rnd.randint(-23,17)
    c=tuple(clamp(k+diff) for k in base)+(rnd.randint(23,65),)
    if name in {'body','back','belly','neck','face','jaw','headplate','spines','wing','wingbone'}:
     d.line([(x,y+9),(x+12,y),(x+26,y+10),(x+12,y+27)],fill=c,width=2)
     d.arc((x+1,y+1,x+27,y+26),15,170,fill=(30,24,22,22),width=1)
    elif name=='membrane':
     d.line((x,y,x+20,y+40),fill=c,width=2)
    elif name in {'leather','bronze'}:
     d.line((x,y,x+25,y+rnd.randint(-4,6)),fill=c,width=rnd.randint(1,3))
    elif name=='fang':
     d.line((x,y,x+4,y+23),fill=c,width=2)
  if name=='membrane':
   for k in range(11):
    # membrane veins as texture (ribs determining the 3D silhouette remain geometry)
    x=12+k*47
    d.line((10,70,x,450),fill=(62,31,29,75),width=3)
    d.line((x,450,x+30,495),fill=(58,30,29,50),width=2)
  if name=='eyes':
   d.ellipse((85,50,420,475),fill=(*base,255),outline=(41,27,27,170),width=13)
   d.ellipse((230,75,276,460),fill=(30,26,29,235))
  if name=='leather':
   for j in range(7):
    d.line((0,30+j*65,512,30+j*65),fill=(205,152,99,40),width=4)
  ox=(i%COLS)*CELL;oy=(i//COLS)*CELL
  sheet.paste(t,(ox,oy))
 return sheet

def tex_uv(mat,u=0.5,v=0.5):
 index=TILES.index(mat);cc=index%COLS;rr=index//COLS
 u=.055+.89*float(u);v=.055+.89*float(v)
 return ((cc+u)/COLS,1-(rr+v)/ROWS)

class Builder:
 def __init__(self):self.v=[];self.f=[];self.uv=[];self.parts={}
 def add(self,name,verts,faces,uv,mat):
  start=len(self.f)
  for tri in faces:
   a=len(self.v)
   for k in tri:
    self.v.append(tuple(float(t) for t in verts[k]))
    u,v=uv[k]; tile=mat[k] if isinstance(mat,list) else mat
    self.uv.append(tex_uv(tile,u,v))
   self.f.append((a,a+1,a+2))
  self.parts[name]=self.parts.get(name,0)+len(self.f)-start
 def loft_x(self,name,secs,mat,n=12):
  # sections = x,y,z,ry,rz : stiff chest, hips and head sculpted by changing profile
  vs=[];uv=[];fs=[]
  for i,(x,y,z,ry,rz) in enumerate(secs):
   for j in range(n):
    theta=2*math.pi*j/n
    vs.append((x,y+ry*math.cos(theta),z+rz*math.sin(theta)))
    uv.append((i/max(1,len(secs)-1),j/n))
  for i in range(len(secs)-1):
   for j in range(n):
    a=i*n+j;b=i*n+(j+1)%n;c=(i+1)*n+j;d=(i+1)*n+(j+1)%n
    fs.extend(((a,c,b),(b,c,d)))
  for j in range(1,n-1):
   fs.append((0,j+1,j));x=(len(secs)-1)*n;fs.append((x,x+j,x+j+1))
  self.add(name,vs,fs,uv,mat)
 def loft_path(self,name,points,rads,mat,sides=9,cap=True):
  pts=np.asarray(points,dtype=float);vs=[];uv=[];fs=[]
  for i,p in enumerate(pts):
   d=pts[min(len(pts)-1,i+1)]-pts[max(0,i-1)]
   d/=np.linalg.norm(d)
   ax=np.array([0,0,1.]);
   if abs(float(np.dot(d,ax)))>.91:ax=np.array([0,1.,0.])
   u=np.cross(d,ax);u/=np.linalg.norm(u);w=np.cross(d,u)
   rad=rads[i] if hasattr(rads,'__len__') else rads
   if isinstance(rad,tuple):rx,rz=rad
   else:rx=rz=rad
   for j in range(sides):
    a=j*2*math.pi/sides
    off=rx*math.cos(a)*u+rz*math.sin(a)*w
    vs.append(p+off);uv.append((i/max(1,len(pts)-1),j/sides))
  for i in range(len(pts)-1):
   for j in range(sides):
    a=i*sides+j;b=i*sides+(j+1)%sides;c=(i+1)*sides+j;d=(i+1)*sides+(j+1)%sides
    fs.extend(((a,b,c),(b,d,c)))
  if cap:
   for j in range(1,sides-1):
    fs.append((0,j+1,j)); k=(len(pts)-1)*sides;fs.append((k,k+j,k+j+1))
  self.add(name,vs,fs,uv,mat)
 def feather(self,name,root,base_l,base_r,tip,mat,thick=.055):
  # tapered triangular 3D sculpt with high ridge, structural shape / silhouette only
  a=np.array(base_l); b=np.array(base_r); r=np.array(root);t=np.array(tip)
  n=np.array([0,thick,0]);center=(r+a+b)/3+n
  verts=[a,b,r,t,center,a-n,b-n,r-n,t-n]
  faces=[(0,1,4),(1,3,4),(3,2,4),(2,0,4),(5,7,6),(6,7,8),(0,5,1),(1,5,6),(1,6,3),(3,6,8),(3,8,2),(2,8,7),(2,7,0),(0,7,5)]
  uv=[(.06,.1),(.9,.1),(.5,.1),(.5,.94),(.5,.55)]*1+[(.1,.15),(.9,.15),(.5,.1),(.5,.9)]
  self.add(name,verts,faces,uv,mat)
 def patch(self,name,points,mat,uv=None,double=True):
  vs=list(points);n=len(vs)
  if uv is None:uv=[((i%3)/2,(i//3)/3) for i in range(n)]
  faces=[(0,i,i+1) for i in range(1,n-1)]
  if double:faces+=[(c,b,a) for a,b,c in list(faces)]
  self.add(name,vs,faces,uv,mat)
 def membrane(self,name,leading,trailing,mat):
  # envelope with swept scalloped trailing edge: physical vertex geometry for silhouette
  # leading, trailing ordered from wing root toward wing tip. 2x subdivisions in chord.
  nv=len(leading);vs=[];uv=[];faces=[]
  for i,(l,t) in enumerate(zip(leading,trailing)):
   l=np.asarray(l,float);t=np.asarray(t,float)
   for j in range(4):
    p=l*(1-j/3)+t*(j/3)
    p[1]+=math.sin(j/3*math.pi)*.065
    vs.append(p);uv.append((i/max(1,nv-1),j/3))
  for i in range(nv-1):
   for j in range(3):
    a=4*i+j;b=a+1;c=4*(i+1)+j;d=c+1
    faces.extend(((a,b,d),(a,d,c)))
  # Reverse-wound underside displaced by 3 cm: no coplanar z-fighting.
  total=len(vs)
  front_faces=list(faces)
  vs.extend([np.asarray(p,float)-np.array([0,.035,0]) for p in vs[:total]])
  uv.extend(list(uv[:total]))
  faces.extend([(c+total,b+total,a+total) for a,b,c in front_faces])
  self.add(name,vs,faces,uv,mat)
 def export(self,path,texture):
  raw=np.asarray(self.v,dtype=np.float32);faces=np.asarray(self.f,dtype=np.int64)
  uv=np.asarray(self.uv,dtype=np.float32)
  tex=Image.open(texture).convert('RGB')
  material=PBRMaterial(name='Wyvern UV atlas',baseColorTexture=tex,metallicFactor=0.,roughnessFactor=.93,doubleSided=True)
  mesh=Trimesh(vertices=raw,faces=faces,process=False,visual=TextureVisuals(uv=uv,material=material))
  scene=Scene(mesh);scene.export(str(path))
  return len(faces),mesh

def build_creature(sex, saddle):
 b=Builder()
 # Body core is no capsule: anisotropic sculpted thorax/hip with intentional planes.
 b.loft_x('thorax_and_pelvis',[
 (-1.70,1.55,0,.18,.28),(-1.55,1.62,0,.50,.55),(-1.25,1.69,0,.70,.77),
 (-.85,1.75,0,.76,.85),(-.45,1.78,0,.82,.86),(-.08,1.80,0,.86,.88),
 (.30,1.88,0,.91,.88),(.66,1.95,0,.76,.75),(.91,1.97,0,.54,.60),
 (1.10,1.95,0,.32,.43),(1.18,1.94,0,.12,.22)],'body',14)
 # Lower chest / belly under shoulder — this is actual depth, not colored overlay.
 b.loft_x('sternum_contour',[(.35,1.43,0,.44,.50),(.62,1.40,0,.40,.48),(.92,1.48,0,.34,.42),(1.13,1.57,0,.19,.27)],'belly',10)
 # Upright long snake neck with shifting centerline, upper neck flared behind skull.
 b.loft_path('serpentine_neck',[
 (.72,1.83,0),(1.00,2.06,0),(1.23,2.36,0),(1.43,2.66,0),
 (1.66,2.95,0),(1.92,3.17,0),(2.18,3.28,0)],
 [(.57,.54),(.53,.48),(.48,.44),(.42,.39),(.37,.37),(.41,.41),(.48,.43)],'neck',12)
 # Snakelike skull (wide squared crown, eyes side-mounted, narrow frontal snout).
 b.loft_x('snake_upper_skull',[(1.90,3.25,0,.34,.38),(2.11,3.33,0,.42,.48),
   (2.35,3.39,0,.46,.51),(2.61,3.40,0,.40,.46),(2.88,3.35,0,.36,.43),
   (3.18,3.28,0,.29,.39),(3.41,3.22,0,.23,.34),(3.54,3.18,0,.17,.23)],'face',12)
 # Mouth opening as recessed dark interior between jaw + upper snout, broad curved lower jaw.
 b.patch('open_mouth_dark',[(2.39,3.06,-.41),(3.47,2.99,-.28),(3.70,2.68,-.15),
                               (3.67,2.65,.15),(3.47,2.99,.28),(2.39,3.06,.41)],'dark',double=True)
 b.loft_x('lower_snake_jaw',[(2.32,2.99,0,.17,.41),(2.58,2.86,0,.15,.43),
 (2.87,2.72,0,.14,.39),(3.16,2.64,0,.125,.33),(3.47,2.57,0,.11,.27),(3.65,2.61,0,.08,.18)],'jaw',10)
 # Distinct facial scales and brow ridges are structural but same palette via UV.
 for side in (-1,1):
  s=side
  b.patch('snake_brow_%s'%s,[(2.17,3.56,s*.31),(2.45,3.64,s*.44),
    (2.81,3.54,s*.40),(2.68,3.42,s*.47),(2.32,3.48,s*.46)],'headplate')
  # eye inset occupies thin anatomical eye plane (eye is geometry, not color overlay)
  b.patch('gold_eye_%s'%s,[(2.43,3.48,s*.468),(2.57,3.52,s*.478),
    (2.65,3.46,s*.474),(2.57,3.38,s*.495),(2.45,3.40,s*.493)],'eyes')
  b.patch('vertical_pupil_%s'%s,[(2.555,3.50,s*.489),(2.575,3.48,s*.498),
    (2.573,3.41,s*.50),(2.556,3.39,s*.499)],'dark')
  # paired upper saber fangs: two long curved fangs, no dull triangle teeth only
  for px,pz,k in [(3.08,.315,0),(2.64,.395,1)]:
   b.loft_path('fang_%s_%s'%(s,k),[(px,3.10,s*pz),(px+.045,2.98,s*pz*.99),
    (px+.035,2.79,s*(pz-.04)),(px-.035,2.56,s*(pz-.075))],
    [.080,.068,.035,.006],'fang',6)
  # fanged open lower mouth: few small teeth, not separate forelimbs
  for k,x in enumerate([2.75,2.93,3.19,3.39]):
   b.loft_path('lower_tooth_%s_%s'%(s,k),[(x,2.74,s*.29),(x+.035,2.84,s*.26)],
    [.048,.005],'fang',5)
  b.patch('upper_nostril_%s'%s,[(3.34,3.29,s*.316),(3.43,3.285,s*.28),
           (3.40,3.248,s*.310)],'dark')
 # Cranial crest: 2 angled hornlike ridges, no bird beak or extra limbs.
 for side in (-1,1):
  s=side
  for i in range(6):
   x=2.38-i*.17
   y=3.66+i*.01
   z=s*(.40-i*.023)
   b.feather('serpent_cranial_shingle_%s_%s'%(s,i),(x,y,z),
    (x-.10,y+.06,z-s*.05),(x+.08,y+.075,z+s*.04),
    (x-.34,y+.22,z+s*.015),'headplate',.025)
  b.loft_path('rear_horn_%s'%s,[(2.27,3.66,s*.34),(2.00,3.85,s*.49),
                 (1.60,3.94,s*.51)], [.15,.09,.007], 'spines',7)
 # Large ridged spinal features that truly alter silhouette, not painted scales.
 for i in range(11):
  x=.86-i*.34
  yy=2.61+(math.sin(i*.34)*.10)-(max(0,i-4)*.07)
  wd=.16 if i<5 else .12
  b.feather('nuchal_and_back_ridge_%02d'%i,(x,yy-.13,0),
       (x+.10,yy-.14,-wd),(x+.10,yy-.14,wd),
       (x-.21,yy+.15+(i%3)*.025,0),'spines',.028)
 # Strong tapering tail, roughly same back axis and bending laterally slightly.
 tail=[(-1.48,1.66,0),(-1.83,1.61,.02),(-2.22,1.51,.04),(-2.65,1.41,.09),
       (-3.08,1.29,.10),(-3.52,1.16,.11),(-3.94,1.06,.10),(-4.26,1.00,.10)]
 b.loft_path('tapered_balancing_tail',tail,[(.48,.46),(.45,.42),(.38,.36),
  (.31,.29),(.25,.23),(.19,.17),(.12,.10),(.025,.025)],'back',10)
 for i in range(12):
  x=-1.64-i*.225; yy=1.91-i*.069
  for s in (-1,1):
   z=s*(.11-max(0,i-5)*.008)
   b.feather('tail_fin_%s_%02d'%(s,i),(x,yy,z),
       (x-.12,yy-.05,z+s*.11),(x+.08,yy-.05,z-s*.07),
       (x-.39,yy+.12,z+s*.14),'spines',.035)
 # Hind legs, NO other walking arms. Thigh, hock, metatarsus are accurately articulated.
 for side in (-1,1):
  s=side
  b.loft_path('thigh_%s'%s,[(-.97,1.58,s*.57),(-1.13,1.27,s*.64),
     (-.98,.93,s*.63),(-.70,.69,s*.66)],[(.42,.39),(.39,.35),(.32,.28),(.24,.24)],'body',10)
  b.loft_path('scaled_shin_%s'%s,[(-.70,.70,s*.66),(-.84,.46,s*.69),
         (-1.00,.20,s*.70),(-.89,.17,s*.71)],[(.25,.24),(.20,.18),(.15,.14),(.16,.16)],'back',9)
  # wide load bearing reptile feet, 3 toes and talons
  b.loft_path('heel_%s'%s,[(-.92,.18,s*.71),(-.68,.105,s*.73),(-.40,.095,s*.73)],
               [(.19,.23),(.19,.27),(.14,.22)],'back',9)
  for digit in range(3):
   off=(digit-1)*.24
   b.loft_path('toe_%s_%s'%(s,digit),[(-.39,.14,s*.73+off),(-.19,.09,s*.73+off*1.17),
     (.04,.072,s*.73+off*1.35)],[(.13,.13),(.105,.095),(.055,.06)],'body',6)
   b.loft_path('talon_%s_%s'%(s,digit),[(.04,.10,s*.73+off*1.35),
     (.21,.085,s*.73+off*1.37),(.25,.019,s*.73+off*1.39)],
     [.072,.045,.004],'dark',6)
 # Wing-forelimbs only: shoulder-->elbow-->wrist-->fingers. No little arms.
 for side in (-1,1):
  s=side
  shoulder=(.38,2.29,s*.70)
  elbow=(-.18,2.63,s*1.94)
  wrist=(-.67,3.38,s*3.36)
  tip=(-1.18,4.66,s*6.34)
  b.loft_path('wing_forelimb_%s'%s,[shoulder,(.15,2.49,s*1.2),elbow,
       (-.42,2.94,s*2.60),wrist,(-.97,3.97,s*4.79),tip],
       [(.29,.29),(.245,.24),(.18,.18),(.14,.14),(.17,.17),(.11,.11),(.02,.02)],'wingbone',9)
  # Membrane with scalloped free trailing edge, skin web and ribs visible in 3D.
  lead=[(.38,2.27,s*.70),(.15,2.48,s*1.23),elbow,
        (-.42,2.94,s*2.60),wrist,(-.91,3.87,s*4.46),(-1.05,4.30,s*5.50),tip]
  trail=[(-1.06,1.87,s*.74),(-1.54,1.69,s*1.23),(-1.96,1.66,s*1.94),
         (-1.72,1.96,s*2.56),(-2.18,2.42,s*3.32),(-2.19,2.99,s*4.36),
         (-1.77,3.45,s*5.35),tip]
  b.membrane('batlike_membrane_%s'%s,lead,trail,'membrane')
  for idx in (2,4,5,6):
   from_p=elbow if idx<5 else wrist
   end=trail[idx]
   b.loft_path('wing_digit_rib_%s_%s'%(s,idx),[from_p,
       tuple(.55*np.array(from_p)+.45*np.array(end)),end],
       [.095,.075,.005],'wingbone',6)
  # Wingtip hook is part of the wing finger, NOT a standalone arm.
  b.loft_path('wingtip_hook_%s'%s,[tip,(-1.28,4.72,s*6.53),
         (-1.45,4.51,s*6.65)],[.083,.064,.008],'dark',6)
  # lateral scapular surface line that connects the wing to chest anatomically
  b.loft_path('scapular_root_%s'%s,[(.52,2.17,s*.61),(.43,2.30,s*.77),
       (.29,2.32,s*.88)],[(.30,.28),(.27,.25),(.12,.14)],'wing',9)
 # A bit of belly segmentation. Textures give coloration rather than overlay scales.
 # Optional tack: saddle padded on back between wing shoulders and tail.
 if saddle:
  # curved saddle seating, braced away from wing joint's rotation area
  b.loft_path('saddle_padded_seat',[(.16,2.69,0),(-.22,2.76,0),(-.66,2.66,0)],
     [(.20,.46),(.17,.51),(.16,.41)],'leather',10)
  b.loft_path('saddle_front_pommel',[(.12,2.72,0),(.18,2.89,0),(.15,3.00,0)],
              [.12,.105,.085],'bronze',7)
  b.loft_path('saddle_rear_cantle',[(-.70,2.66,0),(-.77,2.82,0),(-.82,2.87,0)],
              [.13,.11,.08],'leather',8)
  for s in (-1,1):
   # straps wrap around chest and behind wing's shoulder, leaving wing membrane unobstructed
   b.patch('flank_harness_%s'%s,[(.19,2.28,s*.80),(-.18,2.21,s*.89),
      (-.45,1.38,s*.83),(-.32,1.31,s*.84)],'leather')
   b.patch('harness_buckle_%s'%s,[(-.20,2.26,s*.89),(-.35,2.26,s*.90),
      (-.38,2.13,s*.91),(-.20,2.12,s*.90)],'bronze')
   b.patch('side_covered_pack_%s'%s,[(-.56,2.54,s*.71),(-1.12,2.45,s*.73),
     (-1.15,2.06,s*.86),(-.55,2.12,s*.89)],'leather')
   b.patch('embroidered_mount_flag_%s'%s,[(-.30,2.60,s*.79),(-.72,2.53,s*.83),
       (-.87,1.91,s*.94),(-.52,1.99,s*.90)],'bronze')
   b.loft_path('saddle_belt_%s'%s,[(.14,2.70,s*.30),(.06,2.62,s*.55),
      (-.10,2.53,s*.77)], [.09,.085,.065],'leather',6)
  b.loft_path('rolled_bedroll',[(-.82,2.85,-.35),(-.82,2.85,.35)],
       [.18,.18],'leather',9)
 return b

def run():
 BASE.mkdir(parents=True,exist_ok=True)
 (BASE/'textures').mkdir(exist_ok=True)
 for sex in ('macho','femea'):
  texture=BASE/'textures'/f'wyvern_{sex}_atlas_v01.png'
  if not texture.is_file():make_atlas(sex).save(texture,optimize=True)
  for saddle in (False,True):
   label='montaria' if saddle else 'selvagem';identity=f'wyvern_{sex}_{label}_v01'
   builder=build_creature(sex,saddle)
   target=BASE/f'{identity}_blockout.glb'
   total,mesh=builder.export(target,texture)
   binary=target.read_bytes()
   manifest={
    'name':'Wyvern das Escarpas','version':'v01_blockout','variant':identity,
    'gender':sex,'with_saddle':saddle,'concept_status':'approved',
    'shape_status':'pending_user_approval','integration':'not_integrated',
    'glb':target.name,'bytes':len(binary),'sha256':hashlib.sha256(binary).hexdigest(),
    'triangles':total,'mesh_groups':1,'materials':1,'UV':True,'atlas':texture.name,
    'joints':0,'skins':0,'animations':0,'LODs':0,
    'anatomy':'two hind legs and two true wing forelimbs; no independent arms; snake head with open mouth and long fangs',
    'part_triangles':builder.parts,
   }
   with (BASE/f'{identity}_manifest.json').open('w',encoding='utf8') as fo:json.dump(manifest,fo,ensure_ascii=False,indent=2)
   print(identity,total,len(binary),manifest['sha256'])
  
if __name__=='__main__':run()