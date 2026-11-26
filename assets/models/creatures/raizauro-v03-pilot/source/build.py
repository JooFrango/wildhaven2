#!/usr/bin/env python3
"""Wildhaven Raizauro v03 - angular anatomy approval blockout only.

Original GLB geometry in genuine 3D. No spheres/capsule assembly, no smooth
marching-cubes, no texture pretending to be silhouette details, no animation.
Coordinates: X forward, Y up, Z lateral. Versions v01/v02 preserved.
"""
from __future__ import annotations
import json, math, hashlib
from pathlib import Path
import numpy as np
import trimesh

BASE=Path(__file__).resolve().parent.parent
OUT=BASE/'raizauro-v03-anatomy-blockout.glb'
PARTS=[]
RNG=np.random.default_rng(31)
PALETTE={
'body':'#625f45','body_top':'#75694d','body_flank':'#766c50',
'underbelly':'#494536','shadow':'#343227','shoulder':'#877350',
'plate':'#8b744f','plate_lit':'#a48754','plate_dark':'#63553e',
'rust':'#91583b','rust_dark':'#74462d',
'head':'#806f51','jaw':'#746144','eye_ring':'#443d2c',
'eye':'#231f19','iris':'#c9933b','glint':'#e1c989',
'beak':'#ae9a76','beak_base':'#746148','beak_tip':'#554c3c',
'claw':'#4b4436','claw_lit':'#8b775a','nostril':'#292924',
'scale':'#c0a171', 'tail':'#685b46'
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

def rings_x_offset(name,sections,color,sides=8):
    """Longitudinal closed loft centered on 3D per-ring x,y,z offsets."""
    verts=[];faces=[]
    for x,y,z,ry,rz in sections:
        for j in range(sides):
            a=2*math.pi*j/sides+math.pi/sides
            verts.append((x, y+ry*math.cos(a), z+rz*math.sin(a)))
    for i in range(len(sections)-1):
        for j in range(sides):
            a=i*sides+j;b=i*sides+(j+1)%sides
            c=(i+1)*sides+j;d=(i+1)*sides+(j+1)%sides
            faces.extend(((a,c,b),(b,c,d)))
    for j in range(1,sides-1):faces.append((0,j+1,j))
    end=(len(sections)-1)*sides
    for j in range(1,sides-1):faces.append((end,end+j,end+j+1))
    join_mesh(name,verts,faces,color)


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


# 1. SINGLE FACETED AXIAL MASS, broad reptile trunk, expanded scapular shelf.
# The y/radius values describe low massive support with a gently high dorsal ridge.
rings_x('01_axial_trunk_faceted',[
 (-2.26,1.31,.11,.16),(-2.14,1.32,.38,.54),
 (-1.89,1.36,.59,.85),(-1.49,1.38,.67,1.03),
 (-.99,1.40,.67,1.11),(-.53,1.42,.69,1.16),
 (-.07,1.46,.70,1.19),(.42,1.49,.73,1.22),
 (.87,1.50,.75,1.17),(1.20,1.48,.69,.99),
 (1.51,1.45,.55,.79),(1.72,1.43,.36,.53),
 (1.87,1.42,.14,.22)],'body',14,math.pi/14)
# Chest wedge underneath aligns with throat and shoulder without visible sphere joints.
rings_x('02_sternum_transition',[
 (1.01,1.25,.38,.76),(1.35,1.28,.48,.70),
 (1.73,1.34,.52,.61),(2.04,1.44,.43,.50),
 (2.28,1.55,.26,.36),(2.47,1.61,.08,.17)],'body_flank',12,math.pi/12)

# 2. ARMOR SEGMENTS that trace the actual roof curve; large bevels, tight overlaps.
# Segment edges are anchored into the torso, instead of an unrelated armor layer.
rows=[(-1.95,.59,.76),(-1.54,.78,.94),(-1.13,.83,1.04),(-.72,.86,1.08),
      (-.31,.88,1.13),(.10,.88,1.13),(.51,.86,1.09),(.91,.83,1.03),(1.31,.73,.82)]
for i,(x,height,span) in enumerate(rows):
 base_y=1.43+height*.83
 # Wide vertebral scutes; apex is a true bevelled dorsal ridge.
 poly_shell(f'03_dorsal_shingle_{i:02d}',[
 (x-.30,base_y-.14,-.53),(x-.22,base_y+.08,-.24),
 (x-.06,base_y+.14,0),(x-.22,base_y+.08,.24),
 (x-.30,base_y-.14,.53),(x+.20,base_y-.08,.65),
 (x+.28,base_y+.02,0),(x+.20,base_y-.08,-.65)
 ],.16,'plate' if i%3 else 'plate_lit')
 # Knobby dorsal blade (one broad lateral chamfered wedge with an integrated root)
 if 1<=i<=7:
  for s in [-1,1]:
   triangular_tuft(f'04_dorsal_lateral_blade_{i}_{s}',
      (x-.22,base_y-.07,s*.47),(x+.07,base_y-.055,s*.49),
      (x+.12,base_y-.17,s*.64),(x-.07,base_y+.11+(i%2)*.04,s*.74),
      'plate_dark' if (i+s)%3 else 'plate_lit',.066)
 # Lateral broad interlocking osteoderms follow the ribs rather than repeat spikes.
 if i>0 and i<8:
  for s in [-1,1]:
   poly_shell(f'05_lateral_osteo_{i}_{s}',[
    (x-.28,base_y-.20,s*.77),(x+.14,base_y-.23,s*.76),
    (x+.34,base_y-.49,s*1.04),(x+.06,base_y-.63,s*1.13),
    (x-.27,base_y-.52,s*1.00)],.065,
    'plate_dark' if i%3==0 else 'plate')

# 3. FORE SHOULDER SHIELDS grow out of shoulder facets, with armored lip.
for s in [-1,1]:
 poly_shell(f'06_shoulder_cap_{s}',[
   (.50,2.01,s*.76),(.89,2.11,s*.91),(1.28,2.05,s*.86),
   (1.50,1.75,s*.95),(1.30,1.42,s*1.05),
   (.96,1.23,s*1.19),(.55,1.47,s*1.17),(.36,1.78,s*.98)],.13,'shoulder')
 poly_shell(f'07_shoulder_cap_ridge_{s}',[
   (.50,1.95,s*.97),(.86,2.02,s*1.04),(1.32,1.84,s*1.05),
   (1.30,1.68,s*1.17),(.88,1.68,s*1.25),(.43,1.73,s*1.09)],.045,'plate_lit')
 # Angular ridge breaks the leg-plate boundary, not a floating shield.
 triangular_tuft(f'08_backward_scapular_tooth_{s}',
   (.42,2.05,s*.85),(.73,2.10,s*.86),(.60,1.90,s*.98),
   (.25,2.35,s*.92),'plate_dark',.06)

# 4. HEAVY FOUR-LEGGED ANATOMY: continuous faceted limb-section lofts.
# Forelimbs wider, slightly forward and splayed into shovel-like digits.
for type_name,cx,z in [('front',1.03,-.93),('front',1.03,.93),
                      ('hind',-1.52,-.85),('hind',-1.52,.85)]:
 side='R' if z<0 else 'L';fore=type_name=='front'
 if fore:
  sections=[(cx-.08,1.79,z*.88,.44,.39),
    (cx+.02,1.54,z*1.06,.45,.42),
    (cx+.13,1.28,z*1.16,.46,.42),
    (cx+.20,1.02,z*1.28,.42,.40),
    (cx+.28,.72,z*1.38,.39,.38),
    (cx+.37,.43,z*1.46,.36,.35),
    (cx+.48,.21,z*1.49,.29,.31)]
 else:
  sections=[(cx-.06,1.70,z*.93,.40,.36),
    (cx-.09,1.44,z*1.06,.41,.40),
    (cx-.23,1.15,z*1.15,.43,.37),
    (cx-.22,.86,z*1.24,.36,.36),
    (cx-.14,.56,z*1.30,.32,.30),
    (cx-.02,.34,z*1.35,.28,.27),
    (cx+.04,.18,z*1.38,.25,.26)]
 rings_y(f'09_{type_name}_{side}_continuously_sculpted',sections,
         'body_flank' if fore else 'body',10,math.pi/10)
 toe_cx,foot_y,toe_z=sections[-1][0],sections[-1][1],sections[-1][2]
 # Scaled dorsal band encases the limb near its anterolateral face.
 for k in range(3 if fore else 2):
  cy=1.15-k*.30 if fore else 1.00-k*.33
  x= cx+.22 if fore else cx-.06
  zz=z*1.28
  poly_shell(f'10_{type_name}_{side}_wrinkle_shell_{k}',[
      (x-.19,cy+.12,zz*.93),(x+.09,cy+.17,zz*1.04),
      (x+.27,cy-.06,zz*1.08),(x+.12,cy-.17,zz*1.06),
      (x-.14,cy-.11,zz*.96)],.043,
      'rust' if k%2==0 else 'plate_dark')
 # Four flattened toes point forward; claws grow from their tapered tips.
 for k in range(4):
  offset=(k-1.5)*.206
  ztoe=toe_z+offset
  span=.18 if fore else .15
  ring=[(toe_cx-.10,.255,ztoe,.22,span*.93),
        (toe_cx+.18,.18,ztoe,.22,span),
        (toe_cx+.42,.11,ztoe,.16,span*.70),
        (toe_cx+.53,.084,ztoe,.06,span*.36)]
  # rings_x is horizontal ellipse centered at xyz, two-dimensional cross-sections
  rings_x_offset(f'11_{type_name}_{side}_broad_toe_{k}',ring,'body_flank',8)
  path_tube(f'12_{type_name}_{side}_digging_claw_{k}',[
      (toe_cx+.44,.13,ztoe),(toe_cx+.63,.105,ztoe),
      (toe_cx+.85,.052,ztoe+.016*np.sign(offset))],
      [.125 if fore else .095,.095 if fore else .075,.005],
      'claw_lit' if (k+int(fore))%2==0 else 'claw',7)

# 5. THICK TAPERED ARMORED TAIL, polygonal S-curve, not a hose.
tail_sections=[(-2.20,1.26,.44,.65),(-2.43,1.21,.41,.57),
 (-2.72,1.12,.35,.47),(-3.02,1.00,.31,.39),(-3.30,.86,.26,.31),
 (-3.57,.72,.21,.25),(-3.84,.60,.15,.19),(-4.08,.49,.105,.13),
 (-4.27,.43,.065,.085),(-4.46,.38,.018,.025)]
rings_x('13_long_polygonal_counterbalance_tail',tail_sections,'tail',10,math.pi/10)
for i in range(8):
 x,y,rad,rz=tail_sections[i+1]
 # Each osteoderm is a small embedded axial roof-plate, following tail slope.
 poly_shell(f'14_integrated_tail_shingle_{i}',[
  (x-.21,y+rad*.61,-rz*.78),(x-.07,y+rad*.93,-rz*.38),
  (x+.11,y+rad*1.14,0),(x-.07,y+rad*.93,rz*.38),
  (x-.21,y+rad*.61,rz*.78),(x+.11,y+rad*.55,rz*.72),
  (x+.16,y+rad*.65,0),(x+.11,y+rad*.55,-rz*.72)],.05,
  'plate' if i%3 else 'rust_dark')
 # Small triangular spine at tail ridge, root submerged.
 triangular_tuft(f'15_tail_back_keel_{i}',
  (x-.12,y+rad*.80,-.045),(x+.08,y+rad*.79,.045),
  (x+.06,y+rad*.70,0),(x-.06,y+rad*(1.10 if i<4 else 1.08),0),
  'plate_dark',.035)

# 6. NECK and expressive angular skull, tapered profile and cutting hooked keratin beak.
rings_x('16_neck_braced_into_chest',[
 (1.64,1.48,.43,.56),(1.89,1.53,.48,.60),
 (2.12,1.63,.49,.57),(2.35,1.73,.48,.55),
 (2.57,1.80,.39,.48)],'body_flank',12,math.pi/12)
rings_x('17_skull_temporal_flares_and_eyebrows',[
 (2.39,1.84,.37,.48),(2.64,1.86,.43,.58),
 (2.89,1.88,.41,.57),(3.12,1.88,.33,.49),
 (3.36,1.84,.29,.41),(3.52,1.80,.19,.34)],'head',12,math.pi/12)
# Distinct wedge underjaw from cheekbone to beak root.
rings_x('18_weighted_reptile_mandible',[
 (2.62,1.52,.20,.43),(2.83,1.49,.19,.47),
 (3.07,1.48,.17,.42),(3.35,1.47,.13,.34),
 (3.59,1.47,.05,.18)],'jaw',10)
# Hard triangular keratin beak with a hooked downturned tip, NOT a soft bump.
rings_x('19_keratin_cutting_beak',[
 (3.39,1.74,.20,.33),(3.59,1.76,.22,.34),
 (3.80,1.76,.18,.30),(3.95,1.65,.15,.22),
 (4.03,1.49,.07,.13),(4.01,1.43,.014,.026)],'beak',10,math.pi/10)
# Dorsal beak ridge and straight jaw-cutting surface.
poly_shell('20_hard_keel_on_beak',[
 (3.58,1.92,-.21),(3.77,1.99,-.13),(3.97,1.77,0),
 (3.77,1.99,.13),(3.58,1.92,.21),(3.69,1.88,0)],.04,'beak_base')
for s in [-1,1]:
 # Lateral skull jaw guards integrated with cheek and neck skin.
 poly_shell(f'21_large_angular_jowl_{s}',[
 (2.52,1.96,s*.43),(2.83,2.07,s*.52),
 (3.13,1.92,s*.51),(3.34,1.67,s*.39),
 (3.17,1.51,s*.43),(2.79,1.51,s*.49),
 (2.55,1.66,s*.53)],.045,'rust')
 poly_shell(f'22_bony_eye_eyebrow_{s}',[
 (2.83,2.12,s*.485),(3.02,2.11,s*.52),
 (3.16,2.01,s*.49),(3.00,1.99,s*.54),
 (2.83,2.02,s*.53)],.031,'plate_dark')
 # Recessed eye disk flat on cheek, with dark lid and small amber iris.
 poly_shell(f'23_ocular_socket_{s}',[
 (2.92,2.012,s*.558),(3.042,2.018,s*.555),
 (3.08,1.932,s*.561),(2.97,1.906,s*.568),
 (2.90,1.957,s*.561)],.008,'eye_ring')
 poly_shell(f'24_deep_golden_eye_{s}',[
 (2.968,1.997,s*.574),(3.029,1.982,s*.574),
 (3.033,1.936,s*.573),(2.975,1.931,s*.577)],.004,'iris')
 poly_shell(f'25_pupil_{s}',[
 (3.000,1.983,s*.579),(3.020,1.981,s*.579),
 (3.022,1.948,s*.581),(3.001,1.949,s*.581)],.003,'eye')
 # Functional visible nostril on front-facing upper beak; slit flush to form.
 poly_shell(f'26_nostril_{s}',[
 (3.62,1.925,s*.209),(3.74,1.924,s*.211),
 (3.79,1.866,s*.215),(3.66,1.869,s*.219)],.007,'nostril')
 # Strict, inset line at mouth, not floating snout seam.
 path_tube(f'27_cutting_mouth_seam_{s}',[
 (3.28,1.557,s*.335),(3.52,1.542,s*.327),
 (3.75,1.523,s*.246)], [.027,.020,.008],'shadow',5)
 # Cheek keratin mosaic of large simple facets (avoid dense repeated cones).
 for j in range(3):
  xx=2.55+j*.21
  poly_shell(f'28_suborbital_cheek_plate_{s}_{j}',[
   (xx,1.86,s*.51),(xx+.14,1.89,s*.53),
   (xx+.22,1.74,s*.53),(xx+.10,1.68,s*.52)],.032,
   'plate' if j%2 else 'body_top')

# 7. Shoulder and cervical skin overlaps: larger armor follows neck-to-shoulder.
for s in [-1,1]:
 for i in range(3):
  xx=1.57+i*.30
  poly_shell(f'29_cervical_integrated_scute_{i}_{s}',[
   (xx,1.90,s*.49),(xx+.18,2.05,s*.52),
   (xx+.33,1.95,s*.63),(xx+.28,1.75,s*.64),
   (xx+.09,1.70,s*.56)],.055,'plate_dark' if i%2 else 'plate')

# One actual raster-efficient mesh while keeping all face color islands as geometry.
body=trimesh.util.concatenate([m for _,m in PARTS])
scene=trimesh.Scene();scene.add_geometry(body,node_name='Raizauro_Faceted_Anatomy_v03',geom_name='Raizauro_LOD0_Blockout')
OUT.parent.mkdir(parents=True,exist_ok=True)
OUT.write_bytes(scene.export(file_type='glb'))
triangle_count=sum(len(m.faces) for _,m in PARTS)
report={'creature':'Raizauro','version':'v03 blockout','workflow':'silhouette/anatomy/planes review before rig/animation',
 'status':'artistic_review_pending','source_reference':'raizauro_escavador_na_savana.png',
 'glb':OUT.name,'authoring_parts':len(PARTS),'export_mesh_groups':1,'triangles':triangle_count,
 'bytes':OUT.stat().st_size,'sha256':hashlib.sha256(OUT.read_bytes()).hexdigest(),'animations':[],
 'rig':'NOT YET — visual approval first','feature_map':['broad armored reptile trunk',
 'faceted overlapped dorsal scutes integrated with back','heavy flared shoulder shield',
 'massive forelimbs with separate digging toes and keratin claws',
 'thick sectioned tail with integrated dorsal scutes',
 'bony cheeks and brow with recessed ochre eyes','hooked digging beak',
 'deep jaw line and throat','flat-shaded faces with restrained palette']}
(BASE/'manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2))