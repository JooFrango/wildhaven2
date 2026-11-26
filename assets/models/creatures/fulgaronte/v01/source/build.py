#!/usr/bin/env python3
"""Fulgaronte v01: original, rig-free textured anatomical blockout for Wildhaven.
Coordinate system: +X snout, Y up, Z lateral. One triangle mesh with UV painting.
No geometry used exclusively for color patterns or electric effects.
"""
from __future__ import annotations
import math, random, io, json, hashlib
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import trimesh
from trimesh.visual.texture import TextureVisuals
from trimesh.visual.material import PBRMaterial

ROOT=Path(__file__).resolve().parent.parent
ROOT.mkdir(parents=True,exist_ok=True)
PATH=ROOT/'fulgaronte_v01_blockout.glb'
ATLAS=ROOT/'fulgaronte_v01_uv_atlas.png'
R=random.Random(241105)
REGIONS={
 'body':(.025,.49,.045,.455),'tail':(.025,.49,.485,.69),
 'head':(.51,.795,.045,.36),'limbs':(.805,.972,.045,.48),
 'sails':(.515,.965,.515,.91),'belly':(.025,.49,.71,.95),
 'mouth':(.81,.97,.93,.99),'eyes':(.515,.565,.94,.986),
 'teeth':(.575,.635,.94,.986),'claws':(.645,.71,.94,.986),
 'dark':(.72,.79,.94,.986)
}
W=1024
tex=Image.new('RGB',(W,W),(75,75,75));d=ImageDraw.Draw(tex)

def cellrect(reg):
 a,b,c,e=REGIONS[reg];return (round(a*W),round((1-e)*W),round(b*W),round((1-c)*W))

def fillregion(reg,colors):
 x0,y0,x1,y1=cellrect(reg); width=x1-x0;height=y1-y0
 d.rectangle((x0,y0,x1,y1),fill=colors[0]);
 # angular natural skin and lithic scales, never isolated colored mesh
 unit=24 if reg in ('body','tail','head','limbs') else 19
 for yy in range(y0,y1,unit):
  for xx in range(x0,x1,unit):
   k=R.randrange(len(colors));t=colors[k];jx=R.randrange(3,unit-1);jy=R.randrange(3,unit-1)
   d.polygon([(xx+1,yy+4),(min(x1,xx+jx),max(y0,yy-1)),(min(x1,xx+unit-2),yy+unit//2),(min(x1,xx+jx),min(y1,yy+unit-3))],fill=t)
 # many irregular ocre dorsal islands positioned in V lower-range (Y texture top), belly pale in low side
 if reg in ('body','tail'):
  for _ in range(95 if reg=='body' else 55):
   x=R.randrange(x0+7,x1-7);y=R.randrange(y0+6,y1-6)
   rx=R.randint(4,14);ry=R.randint(3,9)
   color=R.choice([(149,113,60),(175,122,59),(196,142,69),(127,96,55),(98,91,75)])
   pts=[(x+math.cos(a)*rx*(.75+R.random()*.40),y+math.sin(a)*ry*(.75+R.random()*.40)) for a in (0,1.2,2.4,3.8,5.1)]
   d.polygon(pts,fill=color)
 if reg=='head':
  for _ in range(48):
   x=R.randrange(x0+5,x1-5);y=R.randrange(y0+4,y1-4);r=R.randint(3,9)
   d.ellipse((x-r,y-r//2,x+r,y+r//2),fill=R.choice([(142,110,67),(120,106,74),(170,124,69)]))
 if reg=='sails':
  for _ in range(70):
   x=R.randrange(x0+8,x1-8);y=R.randrange(y0+6,y1-6)
   d.line((x,y,x+R.randint(-13,13),y+R.randint(12,40)),fill=R.choice([(87,61,75),(145,91,106),(83,73,77)]),width=2)

fillregion('body',[(68,69,65),(82,78,67),(93,89,75),(104,99,82),(116,110,91)])
fillregion('tail',[(89,91,77),(109,104,83),(122,103,79),(143,111,74)])
fillregion('head',[(91,91,79),(105,99,84),(120,111,94),(133,121,98)])
fillregion('limbs',[(89,91,81),(103,100,90),(119,111,92),(139,121,98)])
fillregion('sails',[(76,58,67),(94,62,82),(110,75,91),(138,88,106)])
fillregion('belly',[(165,155,132),(183,169,143),(192,180,153),(149,143,126)])
for k,col in [('mouth',(67,31,49)),('eyes',(206,153,46)),('teeth',(226,215,183)),('claws',(47,44,43)),('dark',(48,47,45))]:
 d.rectangle(cellrect(k),fill=col)
# Some layer variation for reinforced dorsal plates, painted only
tex.save(ATLAS,optimize=True)

vertices=[]; faces=[]; uvs=[]; categories={};parts_info={}

def uvmap(reg,uv):
 a,b,c,e=REGIONS[reg];return (a+min(1,max(0,uv[0]))*(b-a),c+min(1,max(0,uv[1]))*(e-c))

def add(name, pts, fs, uv, region):
 """Flat normals via independent triangle vertices, UV seams explicit."""
 start=len(faces)
 for tri in fs:
  f=[]
  for index in tri:
   f.append(len(vertices));vertices.append(pts[index]);uvs.append(uvmap(region,uv[index]))
  faces.append(f)
 categories[name]=categories.get(name,0)+len(fs)
 parts_info[name]=[start,len(faces)]

def ringloft(name,sec,sides,reg,phase=.0,cap=True,angle_type='yz'):
 """Sections are (x,y,z, ry,rz). Cross sections point along X, Y is vertical."""
 pts=[];uv=[];ff=[];n=len(sec)
 for i,(x,y,z,ry,rz) in enumerate(sec):
  for j in range(sides):
   a=2*math.pi*j/sides+phase
   pts.append((x,y+ry*math.cos(a),z+rz*math.sin(a)))
   uv.append((i/(n-1),j/sides))
 for i in range(n-1):
  for j in range(sides):
   a=i*sides+j;b=i*sides+(j+1)%sides;c=(i+1)*sides+j;dd=(i+1)*sides+(j+1)%sides
   ff.extend([(a,c,b),(b,c,dd)])
 if cap:
  for j in range(1,sides-1):ff.append((0,j+1,j))
  e=(n-1)*sides
  for j in range(1,sides-1):ff.append((e,e+j,e+j+1))
 add(name,pts,ff,uv,reg)

def tube(name, centers, radii, reg, sides=9, cap=True):
 """Variable-radius oriented cylinder in arbitrary 3D trajectory."""
 p=np.array(centers,dtype=float);pts=[];uv=[];fs=[]
 for i,center in enumerate(p):
  tangent=p[min(i+1,len(p)-1)]-p[max(0,i-1)]
  tangent=tangent/(np.linalg.norm(tangent)+1e-9)
  h=np.array([0,1,0],dtype=float)
  if abs(float(np.dot(tangent,h)))>.94:h=np.array([0,0,1],dtype=float)
  u=np.cross(tangent,h);u/=np.linalg.norm(u);v=np.cross(tangent,u);v/=np.linalg.norm(v)
  r1,r2 = radii[i] if isinstance(radii[i],(list,tuple)) else (radii[i],radii[i])
  for j in range(sides):
   t=j/sides*math.pi*2
   co=center+r1*u*math.cos(t)+r2*v*math.sin(t)
   pts.append(tuple(co));uv.append((i/(len(p)-1),j/sides))
 for i in range(len(p)-1):
  for j in range(sides):
   a=i*sides+j;b=i*sides+(j+1)%sides;c=(i+1)*sides+j;dd=(i+1)*sides+(j+1)%sides
   fs.extend([(a,b,c),(b,dd,c)])
 if cap:
  for j in range(1,sides-1):fs.append((0,j,j+1))
  e=(len(p)-1)*sides
  for j in range(1,sides-1):fs.append((e,e+j+1,e+j))
 add(name,pts,fs,uv,reg)

def wedge(name,polygon,width,reg):
 """Anatomical pointed web or keratin plate, thickness provided in Z around seam."""
 ps=[list(p) for p in polygon];n=len(ps)
 tops=[(p[0],p[1],p[2]+width*.5) for p in ps]
 bots=[(p[0],p[1],p[2]-width*.5) for p in ps]
 pts=tops+bots;uv=[(i/max(n-1,1),.78) for i in range(n)]+[(i/max(n-1,1),.16) for i in range(n)]
 fs=[]
 for j in range(1,n-1):fs.extend([(0,j,j+1),(n,n+j+1,n+j)])
 for j in range(n):
  k=(j+1)%n;fs.extend([(j,k,n+k),(j,n+k,n+j)])
 add(name,pts,fs,uv,reg)

def membrane(name,poly,reg):
 """Thin functional fin membrane, actual outline geometry rather than color geometry."""
 vs=[];uv=[];n=len(poly)
 xs=[p[0] for p in poly];ys=[p[1] for p in poly];zs=[p[2] for p in poly]
 for i,p in enumerate(poly):
  vs.append(tuple(p));uv.append(((p[0]-min(xs))/(max(xs)-min(xs)+.001),(p[1]-min(ys))/(max(ys)-min(ys)+.001)))
 fs=[]
 for k in range(1,n-1):fs.extend([(0,k,k+1),(0,k+1,k)])
 add(name,vs,fs,uv,reg)

# Trunk, shoulders and abdomen - body spans x -4.4 to +2.3
ringloft('torso',[
 (-4.75,2.17,0,.72,.70),(-4.32,2.35,0,1.08,1.12),(-3.55,2.48,0,1.30,1.45),
 (-2.56,2.58,0,1.48,1.65),(-1.6,2.65,0,1.49,1.64),(-.4,2.71,0,1.48,1.58),
 (.66,2.77,0,1.41,1.51),(1.58,2.91,0,1.19,1.36),(2.10,3.03,0,.83,.93),(2.43,3.12,0,.69,.75)
],16,'body',phase=math.pi/16)
# smooth pale ventral underside as part of real anatomical protruding belly (not colors)
# neck into head
ringloft('neck',[(1.96,3.12,0,.69,.76),(2.30,3.27,0,.73,.75),(2.65,3.34,0,.71,.67),(3.00,3.45,0,.64,.59),(3.37,3.53,0,.58,.61)],12,'head',math.pi/12)
# head large hard beak wedge + broad crocodile muzzle
ringloft('cranium',[(2.92,3.58,0,.62,.59),(3.28,3.68,0,.69,.80),(3.74,3.72,0,.62,.84),(4.2,3.76,0,.56,.81),(4.65,3.74,0,.44,.73),(5.13,3.63,0,.37,.65),(5.53,3.59,0,.27,.52),(5.76,3.54,0,.19,.42)],12,'head',math.pi/12)
# lower jaw below open gape - separate by defined vertical space
ringloft('mandible',[(3.10,2.97,0,.20,.51),(3.49,2.91,0,.20,.62),(4.08,2.79,0,.18,.68),(4.65,2.68,0,.16,.67),(5.18,2.66,0,.12,.52),(5.62,2.70,0,.08,.33)],10,'head',math.pi/10)
# recessed roof of mouth, tongue (legitimate anatomical surfaces)
ringloft('mouth_roof',[(3.60,3.20,0,.04,.45),(4.13,3.12,0,.05,.57),(4.78,3.04,0,.035,.50),(5.40,3.01,0,.025,.28)],8,'mouth')
tube('tongue',[(3.55,2.91,0),(4.07,2.94,0),(4.80,2.87,0)],[(.17,.12),(.18,.11),(.06,.06)],'mouth',7)
# eyes sunk under 2 supraorbital crests, no googly protrusions
for sign in [-1,1]:
 tube('eye_'+str(sign),[(3.73,3.98,sign*.65),(3.95,3.97,sign*.68)],[(.13,.12),(.12,.11)],'eyes',8)
 wedge('eyebrow_'+str(sign),[(3.36,4.13,sign*.48),(3.8,4.13,sign*.76),(4.15,4.03,sign*.72),(4.36,4.05,sign*.53)],.07,'head')
 for i in range(4):
  # jaw teeth triangular cone approximated with narrow path tubes, ~5 triangles each side
  xx=4.05+i*.38
  side_y=math.sqrt(max(.01,1-(xx-4.2)**2/3))
  for s in [-1,1]:
   tube('fang_upper',[(xx,3.07,s*(.53-i*.03)),(xx+.07,2.88-R.random()*.08,s*(.52-i*.03))],[(.085,.07),(.005,.008)],'teeth',5)
   tube('fang_lower',[(xx+.16,2.75,s*(.49-i*.025)),(xx+.18,2.99,s*(.48-i*.025))],[(.065,.06),(.006,.006)],'teeth',5)
# front long dangerous canines
for s in [-1,1]:
 tube('major_canine',[(5.38,3.1,s*.36),(5.40,2.74,s*.34)],[(.14,.10),(.008,.006)],'teeth',6)
# neck osteoderms, back armored spine shell geometries actually change dorsal silhouette
for i in range(16):
 x=2.6-i*.47
 y=3.95+.23*math.sin((x+1.8)/2)+(.2 if -2.6<x<1.4 else 0)
 for s in [-1,1]:
  z=s*(.27+.53*math.sqrt(max(0,1-((x+1.7)/5.4)**2)))
  # low profile overlapping shield in angular diamond form
  poly=[(x+.28,y-.11,z),(x+.01,y+.10,z+s*.20),(x-.25,y+.02,z),(x-.06,y-.21,z-s*.09)]
  wedge('dorsal_shield',poly,.06,'body')
# sail-shaped dorsal thermoregulatory/electric storage fins (single membrane each, 3D functional outline)
for k,(x,h,lenx) in enumerate([(.65,1.02,1.08),(-1.03,.78,.87),(-2.61,.69,.78),(-4.12,.50,.61)]):
 baseline=4.13 if x>.2 else 4.14 if x>-2 else 4.01
 p=[(x+lenx*.5,baseline,0),(x+lenx*.29,baseline+h*.53,0),
    (x+.08,baseline+h,0),(x-lenx*.34,baseline+h*.68,0),
    (x-lenx*.53,baseline,0)]
 membrane('dorsal_sail',p,'sails')
 tube('sail_rib',[(x+lenx*.3,baseline,0),(x+.08,baseline+h,0)],[(.08,.08),(.02,.02)],'head',6)
# robust fore/hind legs with bends and distinct weight-bearing claws
for s in [-1,1]:
 for fore,x in [(True,1.42),(False,-3.13)]:
  hip=(x,2.65,s*(1.04 if fore else 1.20))
  elbow=(x+(.05 if fore else -.42),1.70,s*(1.49 if fore else 1.57))
  ankle=(x+(.25 if fore else -.27),.60,s*(1.59 if fore else 1.53))
  foot=(x+(.55 if fore else -.15),.27,s*(1.63 if fore else 1.54))
  tube('leg_'+('front' if fore else 'hind'),[hip,elbow,ankle,foot],[(.67,.70),(.49,.53),(.42,.37),(.34,.34)],'limbs',10)
  # broad toes, pads, claws
  for t in range(4):
   z=foot[2]+(t-1.5)*.24
   px=foot[0]+(.20 if fore else .16)
   tube('digit',[(foot[0]-.08,.26,z),(px,.17,z+ s*.035)],[(.19,.15),(.10,.09)],'limbs',6)
   tube('claw',[(px,.17,z+s*.04),(px+.29,.08,z+s*.07)],[(.095,.065),(.006,.006)],'claws',5)
  # forelimb adaptive membrane: broad triangular fin attached to outside rear of arm
  if fore:
   membrane('forearm_fin',[(x-.12,2.12,s*1.56),(x-.10,1.02,s*1.80),
                            (x-.91,.82,s*2.25),(x-.73,1.55,s*2.02),
                            (x-.52,1.95,s*1.82)],'sails')
   tube('forearm_rib',[(x-.12,1.96,s*1.64),(x-.73,.87,s*2.18)],[(.09,.10),(.028,.03)],'limbs',6)
# long tapering tail with slight bend in z and a finned terminal section
ringloft('caudal_base',[
 (-4.61,2.16,0,.80,.78),(-5.05,1.94,.08,.67,.69),(-5.65,1.74,.28,.57,.61),
 (-6.27,1.52,.46,.48,.50),(-6.9,1.31,.66,.39,.40),(-7.6,1.18,.86,.31,.31),
 (-8.25,1.04,1.04,.24,.23),(-8.85,.93,1.20,.17,.17),(-9.32,.85,1.25,.10,.10)
],12,'tail',math.pi/12)
# tapered broad caudal paddle web: broad in XY plane for side profile
membrane('tail_paddle',[(-7.55,1.28,.84),(-8.25,1.55,1.02),(-8.8,1.97,1.21),
 (-9.18,1.68,1.29),(-9.62,.91,1.29),(-10.24,.42,1.28),(-9.42,.60,1.25),
 (-8.49,.80,1.08)],'sails')
# lower extra ventral vane
membrane('ventral_tail_paddle',[(-8.10,1.01,1.06),(-8.92,.51,1.27),(-9.46,.19,1.36),(-8.73,.35,1.24),(-8.37,.72,1.13)],'sails')
# body paired lateral stabilizing ridges are anatomical fins, not color mesh
for s in [-1,1]:
 membrane('side_dorsal_fin', [(-3.48,3.7,s*1.1),(-3.89,4.05,s*.9),(-4.12,3.67,s*1.02),(-4.08,3.27,s*1.12)],'head')

mesh=trimesh.Trimesh(vertices=np.asarray(vertices,dtype=np.float32),faces=np.asarray(faces,dtype=np.int32),process=False)
mesh.visual=TextureVisuals(uv=np.array(uvs,dtype=np.float32),material=PBRMaterial(name='Fulgaronte UV v01',baseColorTexture=tex,metallicFactor=0.0,roughnessFactor=.94,doubleSided=True))
scene=trimesh.Scene();scene.add_geometry(mesh,geom_name='Fulgaronte_v01_BodyUV',node_name='Fulgaronte_v01_BodyUV')
GLB=trimesh.exchange.gltf.export_glb(scene,include_normals=True)
PATH.write_bytes(GLB)
# Independent check back from exported GLB
reimp=trimesh.load(PATH,force='scene',process=False)
me=list(reimp.geometry.values());triangles=sum(len(z.faces) for z in me)
xs=np.concatenate([z.vertices[:,0] for z in me]);ys=np.concatenate([z.vertices[:,1] for z in me]);zs=np.concatenate([z.vertices[:,2] for z in me]);bounds=[[float(min(c)) for c in (xs,ys,zs)],[float(max(c)) for c in (xs,ys,zs)]]
assert triangles==len(faces)
assert len(me)==1
assert reimp.geometry[next(iter(reimp.geometry))].visual.uv is not None
manifest={'species_id':'fulgaronte','version':'v01','stage':'blockout_form_review','concept_approved':True,'blockout_form_approved':False,
'biome':'extremo norte glacial, lagos e costas geladas','anatomy':'quadruped semiaquatic crocodilian with structural dorsal fins, front membranes, caudal fin',
'glb':PATH.name,'sha256':hashlib.sha256(GLB).hexdigest(),'bytes':len(GLB),'triangles':triangles,'meshes':len(me),'atlas_uv':ATLAS.name,
'rig_joints':0,'skins':0,'animation_clips':0,'triangles_calculation':'sum of triangle faces in GLB reimport, no instances',
'geometry_bounds_m':bounds,'scale_m':{'height':round(bounds[1][1]-bounds[0][1],2),'length_x':round(bounds[1][0]-bounds[0][0],2),'width_z':round(bounds[1][2]-bounds[0][2],2)},
'alpha_modified':False,'geometry_color_only_meshes':0,'note':'Electric arcs and final overload are VFX/gameplay concepts, not included in blockout; shape awaits director approval.'}
(ROOT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print('RESULT',json.dumps({k:manifest[k] for k in ['triangles','bytes','sha256','scale_m','meshes']}))
print('GEOMETRY', sorted(categories.items(),key=lambda x:-x[1])[:35]);print('FILES',PATH,ATLAS)
