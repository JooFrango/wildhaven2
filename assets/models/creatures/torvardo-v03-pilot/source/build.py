#!/usr/bin/env python3
"""Wildhaven Torvardo V03 — rig-free angular anatomy approval blockout.

Original triangle-mesh model only. No primitive spheres, voxel smoothing,
SDF marching cubes, fake AI model photos or misleading animation claims.
Each shape is intentionally faceted and composed of bespoke cross-sections.
X: forward, Y: up, Z: lateral.
"""
from __future__ import annotations
import json, math, hashlib, colorsys
from pathlib import Path
import numpy as np
import trimesh

BASE=Path(__file__).resolve().parent.parent
OUT=BASE/'torvardo-v03-anatomy-blockout.glb'
PARTS=[]
RNG=np.random.default_rng(4)

PALETTE={
 'coat': '#73452d', 'coat_light':'#8e5937', 'coat_top':'#965e39',
 'belly':'#553626','dark':'#30231e', 'muzzle':'#674938',
 'nose':'#3a302a','mane':'#38251f','mane_mid':'#4e3228','mane_tip':'#67402c',
 'brow':'#4a352a','keratin':'#b6a080','keratin_dark':'#776956',
 'horn':'#a49a7e','horn_tip':'#413d34','hoof':'#363029','hoof_high':'#594b3a',
 'eyes':'#171916','iris':'#aa7840','cream':'#dfc49a',
}

def rgb(code):
 c=PALETTE.get(code,code).lstrip('#');return np.array([int(c[i:i+2],16) for i in (0,2,4)],dtype=np.uint8)

def join_mesh(name,v,faces,color,variation=0.07):
 v=np.asarray(v,dtype=np.float32)
 f=np.asarray(faces,dtype=np.int64)
 if len(f)==0:return
 # Duplicate per triangle: explicitly flat normals, no rounded SDF appearance.
 n=v[f.reshape(-1)].reshape(-1,3)
 f2=np.arange(len(n),dtype=np.int64).reshape(-1,3)
 faces_light=(0.95+RNG.random(len(f))*.10) if variation else np.ones(len(f))
 cols=np.empty((len(n),4),dtype=np.uint8)
 base=rgb(color)
 for i,fac in enumerate(f):
  col=np.clip(base.astype(float)*faces_light[i],0,255).astype(np.uint8)
  cols[3*i:3*i+3,:3]=col
 cols[:,3]=255
 m=trimesh.Trimesh(vertices=n,faces=f2,process=False)
 m.visual.vertex_colors=cols
 PARTS.append((name,m))

def rings_x(name,sections,color,side_count=14,phase=0.0,verts_extra=None):
 vv=[];ff=[]
 for x,y,ry,rz in sections:
  for i in range(side_count):
   angle=math.pi*2*i/side_count+phase
   # Faceted deliberately, no smoothing, with distinct dorsoventral and flank planes.
   vv.append((x,y+ry*math.cos(angle),rz*math.sin(angle)))
 for i in range(len(sections)-1):
  for j in range(side_count):
   a=i*side_count+j;b=i*side_count+(j+1)%side_count
   c=(i+1)*side_count+j;d=(i+1)*side_count+(j+1)%side_count
   ff.extend(((a,c,b),(b,c,d)))
 for j in range(1,side_count-1):ff.append((0,j+1,j))
 end=(len(sections)-1)*side_count
 for j in range(1,side_count-1):ff.append((end,end+j,end+j+1))
 join_mesh(name,vv,ff,color)

def rings_y(name,sections,color,sides=10,phase=0.0):
 # Elliptical cross-sections along Y, with independent x and z radii and shifted centers.
 v=[];f=[]
 for cx,y,cz,rx,rz in sections:
  for k in range(sides):
   a=2*math.pi*k/sides+phase
   v.append((cx+rx*math.cos(a),y,cz+rz*math.sin(a)))
 for i in range(len(sections)-1):
  for k in range(sides):
   a=i*sides+k;b=i*sides+(k+1)%sides;c=(i+1)*sides+k;d=(i+1)*sides+(k+1)%sides
   f.extend(((a,b,c),(b,d,c)))
 for j in range(1,sides-1):f.append((0,j,j+1))
 end=(len(sections)-1)*sides
 for j in range(1,sides-1):f.append((end,end+j+1,end+j))
 join_mesh(name,v,f,color)

def path_tube(name,points,radii,color,sides=9):
 p=np.asarray(points,float);v=[];f=[]
 for i,c in enumerate(p):
  a=p[max(0,i-1)];b=p[min(len(p)-1,i+1)];axis=b-a;axis/=np.linalg.norm(axis)
  helper=np.array([0,1.,0])
  if abs(np.dot(axis,helper))>.93:helper=np.array([0,0,1.])
  u=np.cross(axis,helper);u/=np.linalg.norm(u);w=np.cross(axis,u)
  for j in range(sides):
   t=2*math.pi*j/sides
   v.append(c+radii[i]*(math.cos(t)*u+math.sin(t)*w))
 for i in range(len(p)-1):
  for j in range(sides):
   a=i*sides+j;b=i*sides+(j+1)%sides;c=(i+1)*sides+j;d=(i+1)*sides+(j+1)%sides
   f.extend(((a,b,c),(b,d,c)))
 for j in range(1,sides-1):f.append((0,j,j+1))
 off=(len(p)-1)*sides
 for j in range(1,sides-1):f.append((off,off+j+1,off+j))
 join_mesh(name,v,f,color)

def poly_shell(name,points,thickness,color):
 """Sharp edged anatomical plate: n-sided upper ridged face, beveled skirt."""
 p=np.asarray(points,float)
 center=np.mean(p,axis=0)
 outer=p.copy()
 inner=outer.copy(); inner[:,1]-=thickness
 peak=center.copy();peak[1]+=.045
 v=np.concatenate([outer,inner,peak[None,:]])
 nn=len(outer);f=[]
 for i in range(nn):
  j=(i+1)%nn
  f.extend(((i,j,nn*2),(i,nn+i,j),(j,nn+i,nn+j)))
 join_mesh(name,v,f,color)

def triangular_tuft(name,base_a,base_b,root,tip,color,thickness=.045):
 # A flat wedge w/ recessed root. The two root corners embed into the coat.
 a=np.array(base_a,float);b=np.array(base_b,float);c=np.array(root,float);t=np.array(tip,float)
 vec=np.array([0,0,thickness])
 v=[a,b,c,t, a-vec,b-vec,c-vec,t-vec]
 f=[(0,1,3),(1,2,3),(4,7,5),(5,7,6), (0,4,1),(1,4,5),(1,5,2),(2,5,6), (2,6,3),(3,6,7),(3,7,0),(0,7,4)]
 join_mesh(name,v,f,color,.06)

# 1. RUMP AND HIGH SHOULDER BODY — intentional 14-face structural planes.
rings_x('01_weight-bearing_thorax',[
 (-2.15,1.63,.16,.22),(-2.03,1.58,.57,.66),
 (-1.82,1.63,.72,.79),(-1.52,1.65,.76,.85),
 (-1.21,1.67,.72,.84),(-.92,1.68,.69,.83),
 (-.56,1.72,.72,.85),(-.26,1.80,.82,.94),
 (.10,1.90,.94,1.02),(.44,2.00,1.02,1.04),
 (.77,2.03,1.03,1.05),(1.09,1.95,.88,.90),
 (1.36,1.86,.61,.71),(1.56,1.84,.33,.47),(1.64,1.82,.10,.16)],'coat',14,math.pi/14)

# 2. DIFFERENT FACE PLANES — throat, neck, massive lower jaw. No round spheres.
rings_x('02_neck_chest_transition',[
 (1.24,1.78,.51,.62),(1.49,1.82,.59,.67),(1.73,1.84,.53,.61),
 (1.95,1.85,.40,.52),(2.10,1.87,.20,.34)],'coat_light',12,math.pi/12)
rings_x('03_sculpted_cheeks_and_nasal_bridge',[
 (1.89,1.89,.30,.44),(2.08,1.94,.37,.49),(2.30,1.96,.39,.52),
 (2.51,1.88,.31,.44),(2.72,1.78,.26,.39),(2.95,1.72,.20,.40),
 (3.10,1.72,.16,.31)],'coat_light',12,math.pi/12)
rings_x('04_broad_anatomical_muzzle',[
 (2.88,1.66,.21,.40),(3.04,1.67,.21,.43),(3.18,1.65,.17,.41),(3.27,1.65,.14,.37)],'muzzle',12)
# lower chin/cheek plates taper, eyebrows visually inset rather than ball-eyes
for side in [-1,1]:
 poly_shell('05_angular_jowl_%s'%side,[(2.13,1.84,side*.455),(2.37,1.86,side*.525),
    (2.57,1.71,side*.417),(2.41,1.62,side*.425),(2.20,1.64,side*.39)],.045,'coat')

# 3. ARTICULATED LEG FORM *blockout* as anatomical grouped solid surfaces.
for legtype,cx,z in [('hind',-1.52,-.70),('hind',-1.52,.70),('fore',.86,-.77),('fore',.86,.77)]:
 side='L' if z>0 else 'R'; fore=legtype=='fore'
 # Hidden roots penetrate the torso. Each contiguous leg is an anatomical series of sections.
 # Deliberately angular knee, hock, and pastern; shoulders are broad and load-bearing.
 if fore:
  sections=[(cx,1.88,z,.45,.34),(cx+.03,1.48,z,.45,.37),
  (cx+.06,1.13,z,.37,.31),(cx+.12,.87,z,.29,.28),
  (cx+.10,.58,z,.26,.23),(cx+.09,.34,z,.25,.23),
  (cx+.18,.18,z,.20,.20)]
 else:
  sections=[(cx,1.74,z,.46,.38),(cx-.13,1.41,z,.45,.37),
  (cx-.24,1.07,z,.37,.31),(cx-.17,.78,z,.30,.25),
  (cx-.26,.50,z,.26,.21),(cx-.13,.31,z,.21,.18),
  (cx-.11,.18,z,.21,.18)]
 rings_y('06_%s_%s_continuous_joint_planes'%(legtype,side),sections,'coat',10,math.pi/10)
 xf=sections[-1][0]
 # Segmented cloven hoof, with acute wedge tip and visible cleft.
 for k in [-1,1]:
  toe_z=z+k*.145
  rings_y('07_%s_%s_split_hoof_%s'%(legtype,side,k),[
   (xf,.23,toe_z,.19,.120),(xf+.09,.16,toe_z,.23,.133),
   (xf+.17,.055,toe_z,.26,.125),(xf+.19,.036,toe_z,.24,.13)],
   'hoof',8)
  # upper hoof wall, slight warm over-keratin panel
  poly_shell('08_hoof_top_plane',[(xf-.06,.219,toe_z-.08),
     (xf+.19,.175,toe_z-.08),(xf+.30,.085,toe_z),(xf+.17,.17,toe_z+.09)],.02,'hoof_high')

# 4. GENUINE FACETED SCAPULAR MUSCLE STRIPS, along outside shoulder/haunch.
for sgn in [-1,1]:
 for cx,tag in [(-1.43,'hind'),(.68,'shoulder')]:
  # Anatomical chevron sweep on outer coat plane. Upper trapezius distinct from hip.
  absz=(.91 if tag=='shoulder' else .77)
  pp=[(cx-.36,2.13 if tag=='shoulder' else 1.93,sgn*absz*.88),
      (cx+.12,2.40 if tag=='shoulder' else 2.05,sgn*(absz*.98)),
      (cx+.31,1.94 if tag=='shoulder' else 1.57,sgn*absz),
      (cx+.11,1.29 if tag=='shoulder' else 1.27,sgn*absz*.92),
      (cx-.24,1.42 if tag=='shoulder' else 1.49,sgn*absz*.91)]
  poly_shell('09_%s_scapular_fascia_%s'%(tag,sgn),pp,.035,'coat_light')

# 5. MANE. Overlapping chamfered crest plus descending tiered tufts.
# Mane roots from the raised shoulder ridge, integrated frontally into neck.
for i in range(13):
 x= -0.50+i*.171
 # top of shoulder varies by x, all tufts start embedded and follow crest down.
 y=2.43+.53*math.exp(-((x-.52)/.72)**2)
 direction=1 if i%2 else -1
 for k in range(2):
  dz=(-.18 if k==0 else .18)
  base=[(x-.15,y-.11,dz),(x+.04,y-.14,dz),(x+.20,y-.17,dz),
        (x+.13,y+.13,dz*.5),(x-.07,y+.17,dz*.5)]
  poly_shell('10_dorsal_mane_clump_%02d_%d'%(i,k),base,.15,
      'mane' if i%4<2 else 'mane_mid')
# side tiers of broad tapering angular locks - attached to shoulder, not floating pins
for side in [-1,1]:
 for row in range(3):
  for i in range(9):
   x=-.45+i*.26+(row%2)*.11
   yc=2.46-row*.35 + .23*math.exp(-((x-.5)/.80)**2)
   z=side*(.83+(row-1)*.07)
   a=(x-.16,yc+.13,z*.91)
   b=(x+.16,yc+.085,z*.90)
   root=(x+.05,yc-.10,z*1.02)
   tip=(x-.06-(i%3)*.045,yc-.43-(i%2)*.09,z*1.07)
   triangular_tuft('11_mane_tier_%s_%d_%d'%(side,row,i),a,b,root,tip,
        'mane' if (i+row)%3==0 else ('mane_mid' if i%2 else 'mane_tip'),.045)
 # fore-chest fringe extending throat
 for i in range(7):
  x=1.36+i*.105
  y=1.53-(i%2)*.05
  z=side*(.47-(i*.027))
  triangular_tuft('12_sternum_fringe', (x-.08,y+.23,z), (x+.08,y+.21,z),
                   (x+.03,y+.07,z+.02*side),(x+.025,y-.30-(i%3)*.10,z+.05*side),
                   'mane_mid',.035)

# 6. EXTERNAL FRONTAL SHIELD / brow, anatomically angular brow plate at correct height.
# IMPORTANT: forehead is high and horn bases sit BEHIND horn cap, not on nose.
poly_shell('13_keratinized_frontal_boss',[
 (1.87,2.34,-.49),(2.24,2.39,-.60),(2.54,2.34,-.43),
 (2.77,2.18,-.30),(2.77,2.18,.30),(2.54,2.34,.43),
 (2.24,2.39,.60),(1.87,2.34,.49)],.14,'keratin')
# center ridge and shield darker seam
poly_shell('14_frontal_boss_mid_ridge',[(2.05,2.40,-.13),(2.40,2.47,-.10),
 (2.67,2.35,-.08),(2.67,2.35,.08),(2.40,2.47,.10),(2.05,2.40,.13)],.02,'keratin_dark')

# 7. horn curves, EAR, EYEBROW, FOCUS. Eyes recessed, not protruding spheres.
for side in [-1,1]:
 path_tube('15_lateral_horn_%s'%side,[(2.14,2.27,side*.48),
   (2.12,2.36,side*.76),(2.03,2.48,side*1.03),
   (1.92,2.69,side*1.19),(1.82,2.89,side*1.16),
   (1.80,3.04,side*1.05)], [.205,.205,.169,.127,.071,.008], 'horn',10)
 # darker on horn tip; discrete ring gives keratin gradient not metallic shine
 path_tube('16_darkened_horn_tip_%s'%side,[(1.86,2.79,side*1.18),
   (1.82,2.91,side*1.13),(1.80,3.04,side*1.05)],[.073,.055,.004],'horn_tip',8)
 # Ear on lateral head, behind boss, pointed
 poly_shell('17_distinct_ear_%s'%side,[(1.78,2.18,side*.54),
  (1.75,2.42,side*.72),(1.53,2.52,side*.76),
  (1.50,2.25,side*.61)],.03,'coat_light')
 # Oval eye socket defined by polygon rim, iris inside back socket.
 # no bright white sphere!
 rings_x('18_eye_brow_arc_%s'%side,[(2.26,2.115,.085,.03),(2.37,2.116,.070,.030),
  (2.46,2.113,.038,.025)],'brow',8)
 # dark orbital cup, using thin polygons on outer head side
 poly_shell('19_recessed_eye_socket_%s'%side,[(2.33,2.134,side*.513),
  (2.45,2.137,side*.504),(2.47,2.072,side*.508),
  (2.38,2.046,side*.524),(2.31,2.082,side*.521)],.005,'eyes')
 poly_shell('20_amber_iris_%s'%side,[(2.37,2.12,side*.527),
  (2.412,2.119,side*.531),(2.43,2.081,side*.530),
  (2.395,2.069,side*.534),(2.365,2.088,side*.529)],.004,'iris')
 # nostrils on broad leathery muzzle, dark inset slits instead of pasted ball.
 poly_shell('21_nostril_%s'%side,[(3.08,1.795,side*.342),
  (3.17,1.787,side*.356),(3.19,1.736,side*.366),
  (3.10,1.740,side*.365)],.008,'nose')
 # mouth line is a dark thin segmented knife-edge, lower than nostril.
 path_tube('22_mouth_line_%s'%side,[(2.95,1.601,side*.35),
   (3.12,1.575,side*.366),(3.20,1.578,side*.317)], [.019,.016,.009],'dark',6)

# 8. Tail: bony taper with broad flat tuft that continues silhouette; no hose.
path_tube('23_tail_spine',[(-2.06,1.55,0),(-2.33,1.36,0),(-2.58,1.08,0),(-2.67,.78,0)],
    [.14,.10,.072,.045],'coat',8)
for side in [-1,1]:
 triangular_tuft('24_tail_tuft_'+str(side),(-2.61,.88,side*.09),
 (-2.74,.86,side*.09),(-2.70,.66,side*.13),(-2.70,.37,side*.08),'mane',.028)

# Combine 145 semantic detail pieces into ONE game-friendly vertex-colored mesh.
# This preserves face normals and individual colors, drastically reducing draw calls.
scene=trimesh.Scene()
mesh=trimesh.util.concatenate([m for _,m in PARTS])
scene.add_geometry(mesh,node_name='Torvardo_Faceted_Anatomy_v03',geom_name='Torvardo_Body_LOD0')
OUT.parent.mkdir(parents=True,exist_ok=True)
OUT.write_bytes(scene.export(file_type='glb'))
geom_count=len(PARTS);tris=sum(len(m.faces) for _,m in PARTS)
report={'creature':'Torvardo','version':'v03 blockout','workflow':'silhouette/anatomy/planes approval before rig','status':'artistic_review_pending',
 'glb':OUT.name,'authoring_parts':geom_count,'export_mesh_groups':1,'triangles':tris,'bytes':OUT.stat().st_size,
 'sha256':hashlib.sha256(OUT.read_bytes()).hexdigest(),'animations':[],
 'rig':'NOT YET — intentionally deferred until blockout approved',
 'feature_map':['pronounced thoracic hump','flat-sculpt shoulder/haunch planes','keratin forehead boss',
 'two outward-curled horns','layered shingle-mane','recessed eyes and nostrils',
 'differentiated fetlocks and cleft hooves','non-tubular flanks','faceted head']}
(BASE/'manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False,indent=2))