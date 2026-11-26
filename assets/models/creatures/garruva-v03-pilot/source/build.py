#!/usr/bin/env python3
"""Wildhaven Garruva v03: original terrestrial reptilian scavenger, angular blockout.
Real trimesh glTF 2.0 GLB; no rig/animations until silhouette approval.
X forward, Y up, Z left-right. Distinct from herbivorous Raizauro.
"""
from __future__ import annotations
import json, hashlib, math
from pathlib import Path
import numpy as np
import trimesh
BASE=Path(__file__).resolve().parent.parent
OUT=BASE/'garruva-v03-anatomy-blockout.glb'
PARTS=[]
RNG=np.random.default_rng(371)
PALETTE={
 'body':'#47483d','body_top':'#585548','body_flank':'#545044',
 'underbelly':'#34342f','shadow':'#252621','shoulder':'#62604d',
 'plate':'#77705a','plate_lit':'#92816a','plate_dark':'#333a34',
 'rust':'#874d3d','rust_dark':'#643c32',
 'head':'#6c604e','jaw':'#504739','eye_ring':'#2d2926',
 'eye':'#141512','iris':'#b48b45','glint':'#ecdbab',
 'beak':'#c0a777','beak_base':'#81735a','beak_tip':'#665c4f',
 'claw':'#292b26','claw_lit':'#5b584d','nostril':'#1e1f1c',
 'scale':'#817861','tail':'#424438','throat':'#915340','tooth':'#d7bd91',
 'band':'#33372f'
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


# 01. Compact but long deep ribcage — no eggs/capsules assembled as body.
# Eleven deliberate changes of flank plane provide the lizard's recognizable profile.
rings_x('01_long_wedge_torso',[(-1.48,.85,.09,.14),(-1.33,.87,.31,.45),
 (-1.08,.91,.43,.62),(-.70,.93,.46,.70),(-.30,.93,.48,.74),
 (.10,.94,.50,.76),(.48,.96,.51,.73),(.74,.94,.46,.64),
 (.96,.92,.33,.48),(1.08,.91,.14,.20)],'body',14,math.pi/14)
rings_x('02_braced_cervical_throat',[(.74,.80,.35,.52),(1.04,.82,.37,.48),
 (1.30,.87,.33,.42),(1.53,.89,.28,.39),(1.70,.91,.17,.30)],'body_flank',12,math.pi/12)
# Lower jaw / underside: the red throat pocket is stylized as faceted planes.
rings_x('03_maroon_gullet',[(.80,.68,.17,.45),(1.08,.66,.21,.43),
 (1.39,.70,.18,.35),(1.68,.73,.095,.26)],'throat',10,math.pi/10)

# 02. BACK RIDGE — axial scale clusters shallow and embedded, NOT Raizauro armor.
# Broad dark scutes climb into the primary body surface as chord-shaped plates.
for i,xx in enumerate(np.linspace(-1.18,.84,10)):
  # Follow dorsal level (body y≈1.40, fade out at hips and neck).
  elevation=.06 if i in (0,9) else .13
  yy=1.31+(.10 if i>2 else -.015)+elevation
  poly_shell('04_spine_facet_%02d'%i,[
     (xx-.16,yy-.14,-.20),(xx-.105,yy+.04,-.095),
     (xx+.015,yy+.11,0),(xx-.105,yy+.04,.095),
     (xx-.16,yy-.14,.20),(xx+.15,yy-.075,.245),
     (xx+.20,yy-.07,0),(xx+.15,yy-.075,-.245)
     ],.045,'plate_dark' if i%3==0 else 'plate')
# Raised shoulder keels / small osteoderms are integrated into the flank silhouette.
for side in (-1,1):
 for i in range(7):
  xx=-1.08+i*.32;zz=side*(.56 if i==0 else .69)
  y=1.02+(.12 if i in (2,3,4) else 0.)
  poly_shell(f'05_flank_recessed_shield_{side}_{i}',[
   (xx-.16,y+.16,zz*.90),(xx+.055,y+.20,zz*.95),
   (xx+.22,y-.10,zz*1.02),(xx+.015,y-.25,zz*1.06),
   (xx-.17,y-.15,zz*1.02)],.038,
   'plate_dark' if i%3==0 else 'body_top')
  if i in (1,3,5):
   triangular_tuft(f'06_lateral_short_crest_{side}_{i}',
      (xx-.09,1.30,side*.54),(xx+.10,1.31,side*.56),
      (xx+.10,1.21,side*.63),(xx-.01,1.385,side*.51),
      'body_top',.034)

# 03. COUNTERBALANCE TAIL — wedged linear geometry, flattening naturally toward tip.
tail_sections=[(-1.43,.83,.34,.48),(-1.67,.80,.31,.43),(-1.94,.75,.27,.36),
 (-2.20,.68,.22,.29),(-2.45,.62,.17,.23),(-2.71,.55,.12,.17),
 (-2.96,.49,.08,.12),(-3.22,.44,.036,.055),(-3.39,.42,.008,.015)]
rings_x('07_sharp_long_tail',tail_sections,'tail',10,math.pi/10)
for k in range(6):
 x,y,ry,rz=tail_sections[k+1]
 poly_shell(f'08_tail_integrated_strip_{k}',[
 (x-.11,y+ry*.60,-rz*.82),(x-.10,y+ry*.93,-rz*.22),
 (x+.06,y+ry*1.045,0),(x-.10,y+ry*.93,rz*.22),
 (x-.11,y+ry*.60,rz*.82),(x+.10,y+ry*.59,rz*.58),
 (x+.16,y+ry*.57,0),(x+.10,y+ry*.59,-rz*.58)
 ],.026,'plate_dark' if k%2 else 'band')

# 04. DISTINCT GARRUVA ANATOMY: four running/walking limbs, not shovel arms.
# Staggered elbow and ankle positions read as a scavenging lizard, not a root digger.
for family,x,z in [('fore',.56,-.58),('fore',.56,.58),('hind',-1.02,-.57),('hind',-1.02,.57)]:
 side='L' if z>0 else 'R'
 front=family=='fore'
 if front:
  limb=[(x-.04,1.01,z*.89,.29,.275),
       (x+.04,.83,z*1.07,.29,.275),
       (x+.15,.63,z*1.16,.23,.25),
       (x+.27,.48,z*1.20,.20,.21),
       (x+.18,.30,z*1.25,.19,.195),
       (x+.13,.14,z*1.28,.145,.18)]
 else:
  limb=[(x,1.02,z*.89,.33,.285),
       (x-.15,.79,z*1.04,.31,.285),
       (x-.18,.63,z*1.12,.24,.24),
       (x-.02,.44,z*1.17,.18,.21),
       (x+.12,.25,z*1.20,.14,.175),
       (x+.16,.14,z*1.23,.125,.17)]
 rings_y(f'09_{family}_{side}_angled_weightbearing_limb',limb,
       'body_flank' if front else 'body',10,math.pi/10)
 # Dorsolateral elbow tendon plane: small bounded plates, not bubbles.
 for k in range(2):
  cy=.64-k*.18
  px=x+.10 if front else x-.10
  zz=z*1.19
  poly_shell(f'10_{family}_{side}_tendon_facets_{k}',[
       (px-.12,cy+.10,zz*.91),(px+.09,cy+.10,zz*1.04),
       (px+.17,cy-.10,zz*1.05),(px-.06,cy-.13,zz*.96)],
       .015,'body_top' if k else 'rust_dark')
 toe_x=limb[-1][0]
 toe_z=limb[-1][2]
 for k in range(4):
  zg=toe_z+(k-1.5)*.118
  rings_x_offset(f'11_{family}_{side}_toe_{k}',[
    (toe_x-.075,.133,zg,.095,.082),
    (toe_x+.055,.096,zg,.101,.080),
    (toe_x+.18,.075,zg,.070,.058),
    (toe_x+.25,.055,zg,.031,.034)],'body_flank',7)
  path_tube(f'12_{family}_{side}_nail_{k}',[
    (toe_x+.195,.088,zg),(toe_x+.284,.070,zg),
    (toe_x+.335,.036,zg+.011*np.sign(k-1.5))],
    [.043,.035,.004],'claw' if k%2 else 'claw_lit',6)

# 05. VISIBLY PREDATORY CRANIUM WITH BILATERAL TEMPORAL ARCHES.
# This long wedge protrudes prominently ahead of shoulders, distinct from blunt Raizauro.
rings_x('13_scalene_neck',[(1.03,.92,.33,.42),(1.28,.96,.30,.395),
 (1.49,1.00,.29,.37),(1.68,1.05,.26,.345)],'body_flank',12,math.pi/12)
rings_x('14_thick_reptile_skull',[(1.49,1.08,.18,.26),(1.65,1.10,.29,.37),
 (1.82,1.10,.31,.395),(2.03,1.09,.27,.35),
 (2.25,1.08,.22,.29),(2.48,1.06,.155,.22),
 (2.60,1.03,.065,.13)],'head',12,math.pi/12)
# The long jaw hangs slightly below the skull as its own triangular belt.
rings_x('15_fixed_lower_mandible',[(1.65,.86,.12,.28),(1.85,.84,.155,.34),
 (2.10,.84,.155,.32),(2.34,.83,.13,.275),
 (2.54,.83,.08,.17),(2.61,.84,.02,.08)],'jaw',10,math.pi/10)
# Sharp but restrained nose taper with upper cutting lip.
rings_x('16_keratinous_nasal_ridge',[(2.23,1.13,.17,.27),(2.38,1.13,.17,.265),
 (2.51,1.12,.13,.225),(2.62,1.08,.075,.155)],'beak_base',10)
for s in (-1,1):
 # Splayed cheekbone = central identity of a carcass scavenger.
 poly_shell(f'17_zygomatic_angular_flare_{s}',[
    (1.58,1.17,s*.32),(1.81,1.29,s*.38),
    (2.02,1.16,s*.38),(2.19,.99,s*.31),
    (2.08,.85,s*.33),(1.81,.86,s*.38),
    (1.58,.96,s*.35)],.027,'rust')
 # Brow and deep inset eye: flat face geometry, no stuck-on eyeballs.
 poly_shell(f'18_upper_brow_hard_{s}',[
    (1.80,1.32,s*.34),(1.98,1.34,s*.33),
    (2.10,1.26,s*.32),(1.89,1.23,s*.365)],.019,'plate_dark')
 poly_shell(f'19_eye_socket_{s}',[
    (1.83,1.225,s*.389),(1.96,1.235,s*.39),
    (2.025,1.13,s*.377),(1.88,1.116,s*.398)],.006,'eye_ring')
 poly_shell(f'20_eye_amber_{s}',[
    (1.875,1.203,s*.405),(1.952,1.208,s*.404),
    (1.992,1.146,s*.398),(1.896,1.143,s*.412)],.003,'iris')
 poly_shell(f'21_eye_pupil_{s}',[
    (1.927,1.198,s*.418),(1.945,1.195,s*.417),
    (1.96,1.157,s*.418),(1.939,1.156,s*.420)],.002,'eye')
 # Not a beak. Emphasized elongated nostrils and angular upper mouth seam.
 poly_shell(f'22_nostril_{s}',[
    (2.39,1.188,s*.226),(2.47,1.187,s*.221),
    (2.505,1.134,s*.214),(2.42,1.133,s*.223)],.006,'nostril')
 path_tube(f'23_strong_mouth_cutline_{s}',[
    (1.79,.913,s*.345),(2.00,.899,s*.344),
    (2.25,.900,s*.285),(2.45,.906,s*.224),
    (2.59,.912,s*.13)], [.025,.022,.019,.011,.004],'shadow',5)
 # Exposed triangular upper teeth are READABLE from side, small to avoid fantasy spikes.
 for k in range(5):
    xx=1.95+k*.115; zz=s*(.332-.027*k)
    y=.906+.004*k
    triangular_tuft(f'24_gripping_tooth_{s}_{k}',
        (xx-.038,y+.012,zz),(xx+.041,y+.012,zz),
        (xx,y+.001,zz+s*.012),(xx+.019,y-.085,zz),
        'tooth',.017)
 # Small integumentary throat stripes matching scavenger palette (NOT scales armor).
 for k in range(4):
    xx=1.06+k*.16
    poly_shell(f'25_neck_rust_mark_{s}_{k}',[
       (xx,.97,s*.40),(xx+.13,.98,s*.40),
       (xx+.18,.81,s*.375),(xx+.03,.79,s*.38)],.009,
       'rust_dark' if k%2 else 'rust')

# 06. A few nasal and frontal scale polygons, not indiscriminate details.
for i,xx in enumerate((1.67,1.84,2.02,2.19,2.35)):
 poly_shell(f'26_head_axis_scale_{i}',[
   (xx-.07,1.32,-.17),(xx+.075,1.35,-.105),
   (xx+.115,1.365,0),(xx+.075,1.35,.105),
   (xx-.07,1.32,.17),(xx+.11,1.29,.17),
   (xx+.12,1.27,0),(xx+.11,1.29,-.17)],.018,
   'body_top' if i%2 else 'plate')

# Scale independent of normalized prior author's units: target 3.8m length.
body=trimesh.util.concatenate([m for _,m in PARTS]);body.vertices*=.625
scene=trimesh.Scene();scene.add_geometry(body,node_name='Garruva_Faceted_Anatomy_v03',geom_name='Garruva_LOD0_Blockout')
OUT.parent.mkdir(parents=True,exist_ok=True)
OUT.write_bytes(scene.export(file_type='glb'))
tris=len(body.faces)
manifest={
 'creature':'Garruva','version':'v03 blockout',
 'species_role':'terrestrial_reptilian_scavenger_not_bird',
 'stage':'silhouette_anatomy_in_artistic_review',
 'status':'artistic_review_pending',
 'glb':OUT.name,'authoring_parts':len(PARTS), 'export_mesh_groups':1,
 'triangles':tris,'bytes':OUT.stat().st_size,
 'sha256':hashlib.sha256(OUT.read_bytes()).hexdigest(),
 'animations':[],'rig':'NOT YET — anatomical approval first',
 'scale_basis':'designed length approx 3.8m in scene units (X span)',
 'visual_features':[
  'long wedge-like predatory skull and cutting tooth line',
  'amber recessed eyes in flattened angular brow',
  'dark red skin around neck and jaw; no feathers or wings',
  'elongated powerful faceted axial mass, not Raizauro herbivore shell',
  'splayed forelimbs, visible elbows, running hocks, individual claws',
  'low axial scute ridge and lightweight integrated osteoderms',
  'lengthened tapered tail as counterbalance',
  'flat-shaded original 3D geometry with per-face natural palette'
 ]}
(BASE/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(manifest,ensure_ascii=False,indent=2))