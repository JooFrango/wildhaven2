#!/usr/bin/env python3
"""Wildhaven — Mastélio v03. Authored faceted anatomy blockout.

Reference: approved Mastélio savanna concept. X forward, Y up, Z lateral.
Genuine three-dimensional triangulated geometry, no voxel/SDF sculpting,
no smooth shading, no fake normal-map anatomy. Deliberately no rig/animations
until the silhouette and anatomy are reviewed by the user.
"""
from __future__ import annotations
import json, math, hashlib
from pathlib import Path
import numpy as np
import trimesh

ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'mastelio-v03-anatomy-blockout.glb'
PARTS=[]
RNG=np.random.default_rng(20261109)
COL={
 'coat':'#835338','coat_top':'#915f40','coat_shade':'#69442f','coat_warm':'#9f6847',
 'flank':'#9b6747','inner':'#573c30','belly':'#6b4937','patch':'#d7ba92','patch_dark':'#c6a77e',
 'mane':'#503629','mane_lit':'#795039','face':'#946347','face_shadow':'#6b4636',
 'ear':'#976347','ear_edge':'#6e422f','ear_inner':'#bd8b68', 'ear_high':'#d09e75',
 'trunk':'#945f43','trunk_tip':'#794832','trunk_fold':'#b08059',
 'eye_rim':'#4a3328','eye':'#221b19','eye_amber':'#c18a40','glint':'#f1d1a3',
 'nail':'#a58b6a','nail_shadow':'#5d5042','tail':'#754a34','tail_tip':'#432f27',
 'mouth':'#3f2d28','nostril':'#2f2827'
}

def rgb(col):
 c=COL.get(col,col).lstrip('#');return np.array([int(c[i:i+2],16) for i in (0,2,4)],dtype=np.uint8)

def add(name,verts,faces,col,shade=.065,face_colors=None):
 v=np.asarray(verts,dtype=np.float32);f=np.asarray(faces,dtype=np.int64)
 if not len(f):return
 flat=v[f.reshape(-1)]
 tr=np.arange(len(flat),dtype=np.int64).reshape(-1,3)
 colors=np.zeros((len(flat),4),dtype=np.uint8)
 for i in range(len(f)):
  base=rgb(face_colors[i] if face_colors is not None else col)
  brightness=(.965+RNG.random()*.07) if shade else 1.0
  colors[3*i:3*i+3,:3]=np.clip(base*brightness,0,255).astype('uint8')
 colors[:,3]=255
 mesh=trimesh.Trimesh(vertices=flat,faces=tr,process=False)
 mesh.visual.vertex_colors=colors
 PARTS.append((name,mesh))

def loft_x(name,sections,col,sides=12,paint=None,phase=math.pi/12):
 verts=[];faces=[];colors=[]
 for x,y,ry,rz in sections:
  for j in range(sides):
   a=2*math.pi*j/sides+phase
   verts.append((x,y+ry*math.cos(a),rz*math.sin(a)))
 for i in range(len(sections)-1):
  for j in range(sides):
   a=i*sides+j;b=i*sides+(j+1)%sides
   c=(i+1)*sides+j;d=(i+1)*sides+(j+1)%sides
   face1=(a,c,b);face2=(b,c,d)
   faces.extend((face1,face2))
   colors.extend([(paint(np.mean(np.asarray(verts)[list(ff)],axis=0),i,j) if paint else col) for ff in (face1,face2)])
 for j in range(1,sides-1):faces.append((0,j+1,j));colors.append(col)
 end=(len(sections)-1)*sides
 for j in range(1,sides-1):faces.append((end,end+j,end+j+1));colors.append(col)
 add(name,verts,faces,col,face_colors=colors)

def loft_y(name,sections,col,sides=10,phase=math.pi/10):
 verts=[];faces=[]
 for x,y,z,rx,rz in sections:
  for j in range(sides):
   a=2*math.pi*j/sides+phase
   verts.append((x+rx*math.cos(a),y,z+rz*math.sin(a)))
 for i in range(len(sections)-1):
  for j in range(sides):
   a=i*sides+j;b=i*sides+(j+1)%sides;c=(i+1)*sides+j;d=(i+1)*sides+(j+1)%sides
   faces.extend(((a,b,c),(b,d,c)))
 for j in range(1,sides-1):faces.append((0,j,j+1))
 end=(len(sections)-1)*sides
 for j in range(1,sides-1):faces.append((end,end+j+1,end+j))
 add(name,verts,faces,col)

def loft_xyz(name,sections,col,sides=9):
 """Faceted continuous trunk/curled tail with changing radial profile and a definite end."""
 pts=np.array([r[:3] for r in sections],float)
 verts=[];faces=[]
 for i,(p,radius) in enumerate(zip(pts,[r[3] for r in sections])):
  tangent=pts[min(len(pts)-1,i+1)]-pts[max(i-1,0)];tangent/=np.linalg.norm(tangent)
  helper=np.array([0.,0.,1.])
  if abs(np.dot(tangent,helper))>.9:helper=np.array([0.,1.,0.])
  u=np.cross(tangent,helper);u/=np.linalg.norm(u)
  w=np.cross(tangent,u)
  for j in range(sides):
   a=2*math.pi*j/sides
   vec=p+radius*(u*math.cos(a)+w*math.sin(a))
   verts.append(vec)
 for i in range(len(sections)-1):
  for j in range(sides):
   a=i*sides+j;b=i*sides+(j+1)%sides;c=(i+1)*sides+j;d=(i+1)*sides+(j+1)%sides
   faces.extend(((a,b,c),(b,d,c)))
 for j in range(1,sides-1):faces.append((0,j,j+1))
 off=(len(sections)-1)*sides
 for j in range(1,sides-1):faces.append((off,off+j+1,off+j))
 add(name,verts,faces,col)

def wedge(name,outline,inner_offset,col):
 """Raised polygonal mass with shallow perimeter skirt, not a rounded disk."""
 outer=np.asarray(outline,float)
 if len(outer)<3:raise ValueError(name)
 lower=outer+np.asarray(inner_offset,float)
 centroid=outer.mean(axis=0);centroid[1]+=.04
 vertices=np.concatenate([outer,lower,centroid[None,:]])
 n=len(outer);faces=[]
 for i in range(n):
  j=(i+1)%n
  faces.extend(((i,j,2*n),(i,n+i,j),(j,n+i,n+j)))
 add(name,vertices,faces,col)

def fan_ear(name,side):
 """Solid flared pinna with thickness in both X and lateral Z.

 The ear is diagonally oriented: in side view it is a broad leaf, and in
 frontal view its full lateral spread is visible rather than a thin stick.
 """
 profile=[
  (1.81,2.66,.61),(1.52,2.77,.77),(1.30,3.10,1.10),
  (1.22,3.56,1.41),(1.51,3.88,1.56),(1.90,3.99,1.45),
  (2.18,3.84,1.13),(2.34,3.49,.88),(2.29,3.04,.71),
  (2.08,2.74,.64)]
 outer=np.asarray([(x,y,z*side) for x,y,z in profile],float)
 center=outer.mean(axis=0)
 # Inner face points somewhat towards the muzzle, so it reads from the front.
 top=center.copy();top[0]+=.065;top[2]+=side*.028
 back=outer.copy();back[:,0]-=.085;back[:,2]-=side*.075
 v=np.concatenate([outer,back,top[None,:]])
 n=len(outer);faces=[]
 for i in range(n):
  j=(i+1)%n
  faces.extend(((i,j,2*n),(i,n+i,j),(j,n+i,n+j)))
 add(name+'_angled_cartilage_shell',v,faces,'ear_edge')
 inner_center=np.array([1.80,3.34,1.11*side])
 # Relative inset preserves the angular leaf shape rather than becoming a disc.
 inside=np.array([inner_center + (pt-inner_center)*.73 for pt in outer])
 inside[:,0]+=.08
 mid=np.mean(inside,axis=0);mid[0]+=.062
 v2=np.concatenate([inside,mid[None,:]])
 inner_faces=[(i,(i+1)%len(inside),len(inside)) for i in range(len(inside))]
 add(name+'_deep_copper_inner_ear',v2,inner_faces,'ear_inner',0)
 wedge(name+'_embedded_ear_root',[(1.64,2.86,.61*side),(1.92,2.98,.75*side),
  (2.11,2.75,.70*side),(1.84,2.57,.59*side)],(-.05,-.075,-side*.045),'ear')

def triangular_blade(name,base_a,base_b,base_root,tip,col,width=.07):
 a=np.array(base_a,float);b=np.array(base_b,float);c=np.array(base_root,float);t=np.array(tip,float)
 zz=np.array([0,0,width]);verts=[a,b,c,t,a-zz,b-zz,c-zz,t-zz]
 faces=[(0,1,3),(1,2,3),(4,7,5),(5,7,6),(0,4,1),(1,4,5),
        (1,5,2),(2,5,6),(2,6,3),(3,6,7),(3,7,0),(0,7,4)]
 add(name,verts,faces,col)

def eye_patch(name,side):
 # Recessed eye with an angular brow and small iris, no bulbous glued sphere.
 z=side*.575
 wedge(name+'_socket',[(2.08,2.74,z),(2.21,2.79,z+side*.008),(2.32,2.70,z),(2.27,2.61,z),(2.12,2.61,z)],(0,-.02,-side*.01),'eye_rim')
 z2=side*.593
 wedge(name+'_almond',[(2.14,2.704,z2),(2.23,2.728,z2),(2.285,2.687,z2),(2.23,2.638,z2),(2.15,2.644,z2)],(0,-.002,-side*.002),'eye_amber')
 wedge(name+'_pupil',[(2.20,2.694,side*.607),(2.243,2.700,side*.607),(2.25,2.658,side*.607),(2.211,2.653,side*.607)],(0,-.001,-side*.001),'eye')
 wedge(name+'_glint',[(2.211,2.69,side*.613),(2.226,2.697,side*.613),(2.226,2.682,side*.613)],(0,-.001,-side*.001),'glint')
 wedge(name+'_brow',[(2.01,2.84,side*.55),(2.23,2.86,side*.58),(2.33,2.75,side*.59),(2.15,2.77,side*.62)],(0,-.02,-side*.025),'face_shadow')

# MAIN ANATOMY: torso taper from rump to forechest; raised scapular shelf and ribcage,
# asymmetric longitudinal section shapes intentionally keep broad flat facet breakage.
sections=[(-2.50,1.88,.17,.23),(-2.34,1.86,.55,.72),(-2.06,1.87,.88,1.02),
 (-1.72,1.89,1.06,1.22),(-1.35,1.91,1.16,1.27),(-.95,1.95,1.21,1.32),
 (-.52,1.98,1.22,1.33),(-.12,2.00,1.21,1.34),(.33,2.03,1.15,1.27),
 (.70,2.10,1.07,1.18),(1.00,2.17,.92,1.01),(1.25,2.25,.76,.78),
 (1.49,2.31,.50,.59),(1.66,2.33,.20,.28)]

def pattern(point,i,j):
 x,y,z=point
 # Animal's distinctive ivory striations are painted on real polygon faces.
 if (y>1.80 and abs(z)>.53 and -2.29<x<1.02):
  # Two diagonal broad streaks toward rump and a shorter forward shoulder mark.
  curves=[(-1.81,.22),(-1.05,.17),(-.38,.18)]
  for k,(cx,r) in enumerate(curves):
   drift=.14*(y-2.01)*(1 if k%2 else -1)
   if abs(x-cx-drift)<r*(.85 if y>2.74 else 1.15) and y<2.92 and y>1.87:
    return 'patch' if k!=1 else 'patch_dark'
  if x<-.9 and abs(math.sin(6.9*x+3.7*y))>.87 and y>2.28:return 'patch_dark'
  if -.15<x<.55 and y>2.23 and abs(z)>.88 and i%2==0:return 'patch_dark'
 if y<1.29:return 'belly'
 if y>2.65:return 'coat_top'
 if abs(z)>.96:return 'flank'
 return 'coat'
loft_x('01_SINGLE_torso_with_coat_patterns_in_the_mesh',sections,'coat',18,paint=pattern,phase=math.pi/18)
# Anatomical sculpting of visible shoulder/hip plane groups, inset and thin.
for sign in (-1,1):
 # Shoulder fold is a planar change in direction, not a sphere/torus.
 wedge('02_shoulder_to_chest_fold_'+str(sign),[(.46,2.38,sign*1.10),(.88,2.32,sign*1.02),(1.15,1.92,sign*1.01),
    (.98,1.52,sign*1.13),(.57,1.64,sign*1.24),(.32,2.07,sign*1.26)],(0,-.05,-sign*.04),'coat_warm')
 wedge('03_hip_gluteal_facets_'+str(sign),[(-2.12,2.14,sign*.95),(-1.81,2.56,sign*1.08),(-1.55,2.36,sign*1.20),
    (-1.64,1.78,sign*1.25),(-2.03,1.67,sign*1.12)],(0,-.025,-sign*.03),'coat_shade')

# Short neck merges into chest, cranium is recognizable even when trunk hidden.
loft_x('04_neck_wedge_continuous',[(.95,2.29,.59,.75),(1.25,2.42,.67,.75),
 (1.60,2.46,.69,.73),(1.89,2.49,.60,.65),(2.10,2.49,.43,.50)],'face',12)
loft_x('05_skull_big_cheek_bones',[(1.62,2.50,.47,.55),(1.83,2.55,.61,.66),
 (2.06,2.57,.55,.65),(2.29,2.54,.48,.60),(2.53,2.48,.37,.50),
 (2.69,2.39,.28,.39),(2.79,2.33,.20,.27)],'face',14)
loft_x('06_broad_lower_jaw',[(1.92,2.09,.22,.41),(2.20,2.09,.25,.46),
 (2.47,2.08,.21,.38),(2.68,2.09,.14,.28),(2.78,2.11,.06,.16)],'face_shadow',10)
# Underbite line separated by actual geometric slim wedge near rear mouth.
for s in (-1,1):
 wedge(f'07_visible_mouth_cut_{s}',[(2.25,2.19,s*.53),(2.55,2.19,s*.40),
  (2.70,2.20,s*.29),(2.50,2.15,s*.43)],(0,-.012,-s*.014),'mouth')
 wedge(f'08_high_cheek_pale_marking_{s}',[(1.94,2.92,s*.52),(2.11,3.01,s*.49),
  (2.28,2.89,s*.58),(2.34,2.76,s*.59),(2.12,2.77,s*.64)],(0,-.009,-s*.009),'patch_dark')
 fan_ear('09_large_lateral_ear_'+str(s),s)
 eye_patch('10_profile_eye_'+str(s),s)
 # Nose root ridge and side folds on skull.
 wedge(f'11_flat_cheek_facet_{s}',[(1.83,2.48,s*.62),(2.02,2.58,s*.68),
  (2.14,2.31,s*.61),(1.94,2.23,s*.57)],(0,-.02,-s*.012),'coat_warm')

# Reconstructed prehensile tapir/proboscidean snout: one visibly continuous
# polygonal loft, curling forward/down then up into a grasping hook.
loft_xyz('12_SHORT_STRONG_CURVED_PREHENSILE_TRUNK',[
 (2.60,2.42,0,.35),(2.79,2.34,0,.34),
 (2.98,2.16,0,.32),(3.10,1.93,0,.29),(3.19,1.71,0,.26),
 (3.38,1.52,0,.235),(3.57,1.48,0,.21),
 (3.73,1.57,0,.19),(3.78,1.73,0,.17),
 (3.68,1.84,0,.15),(3.57,1.84,0,.13)
 ],'trunk',11)
# Trunk wrinkles add intentional faceted crest bands instead of ring doughnuts.
for i,(x,y) in enumerate([(3.00,2.13),(3.11,1.93),(3.20,1.72),(3.42,1.52)]):
 for side in (-1,1):
  z=side*(.28-(i*.016))
  wedge(f'13_trunk_folds_{i}_{side}',[(x-.070,y+.065,z),(x+.02,y+.055,z+side*.02),
    (x+.075,y-.043,z+side*.02),(x-.042,y-.065,z)],(0,-.012,-side*.015),'trunk_fold')
# Nasal inlet at curled tip: dark small plate flush with final end plane.
wedge('14_trunk_tip_dark_nostril',[(3.50,1.83,-.090),(3.58,1.89,-.11),
 (3.60,1.89,.11),(3.50,1.83,.090)],(-.012,-.008,0),'nostril')

# Four weight-bearing anatomical columns, not spheres connected by tubes.
# Shoulder and hip volumes partly disappear inside continuous trunk mesh.
for label,cx,cz,front in [('front_L',.72,1.01,True),('front_R',.72,-1.01,True),
                            ('hind_L',-1.75,.94,False),('hind_R',-1.75,-.94,False)]:
 if front:
  ring=[(cx-.08,2.05,cz*.86,.46,.44),(cx-.02,1.81,cz*.96,.46,.46),
    (cx+.09,1.56,cz*1.11,.43,.40),(cx+.15,1.26,cz*1.17,.39,.37),
    (cx+.17,.98,cz*1.20,.34,.34),(cx+.12,.67,cz*1.20,.33,.31),
    (cx+.15,.35,cz*1.21,.34,.34),(cx+.24,.16,cz*1.22,.39,.38)]
 else:
  ring=[(cx-.03,2.10,cz*.90,.46,.39),(cx-.06,1.78,cz*.99,.52,.45),
    (cx+.01,1.46,cz*1.11,.48,.41),(cx-.04,1.15,cz*1.15,.41,.36),
    (cx+.07,.88,cz*1.20,.35,.31),(cx+.14,.58,cz*1.22,.33,.32),
    (cx+.19,.31,cz*1.23,.36,.33),(cx+.28,.14,cz*1.25,.39,.37)]
 loft_y(f'15_{label}_loadbearing_faceted_limb',ring,'flank' if front else 'coat',10)
 # Anatomically readable shoulder/knee angles: planar wedge embedded in joint.
 mid=1.16 if front else 1.0
 wedge(f'16_{label}_knee_anatomical_plane',[(cx+.23,mid+.19,cz*1.17),
  (cx+.41,mid+.04,cz*1.18),(cx+.31,mid-.19,cz*1.18),
  (cx+.12,mid-.07,cz*1.25)],(-.03,-.035,-np.sign(cz)*.042),'coat_warm')
 # Four broad toenails with distinct keratin cap, no glued rounded little toes.
 footx=ring[-1][0]
 footz=ring[-1][2]
 for k in range(4):
  offset=(k-1.5)*.172
  toe_z=footz+offset
  z_sides=.089
  toe=[(footx+.06,.165,.20),(footx+.24,.133,.17),(footx+.42,.10,.13),(footx+.51,.081,.055)]
  seg=[(x,y,toe_z,r,z_sides*r/0.20) for x,y,r in toe]
  # toe loft x uses horizontal circular section centered at z/ypoint.
  def toe_x(name,segments,color,sides=6):
   vv=[];ff=[]
   for x,y,z,ry,rz in segments:
    for j in range(sides):
     a=2*math.pi*j/sides+math.pi/sides
     vv.append((x,y+ry*math.cos(a),z+rz*math.sin(a)))
   for i in range(len(segments)-1):
    for j in range(sides):
     a=i*sides+j;b=i*sides+(j+1)%sides;c=(i+1)*sides+j;d=(i+1)*sides+(j+1)%sides
     ff.extend(((a,c,b),(b,c,d)))
   for j in range(1,sides-1):ff.append((0,j+1,j))
   t=(len(segments)-1)*sides
   for j in range(1,sides-1):ff.append((t,t+j,t+j+1))
   add(name,vv,ff,color)
  toe_x(f'17_{label}_toe_{k}',seg,'coat_shade')
  wedge(f'18_{label}_keratin_nail_{k}',[(footx+.35,.138,toe_z-.083),
    (footx+.50,.142,toe_z-.070),(footx+.59,.075,toe_z),
    (footx+.50,.142,toe_z+.070),(footx+.35,.138,toe_z+.083)],(0,-.043,0),
    'nail' if k%2 else 'nail_shadow')

# A differentiated low-poly mane is a series of broad coalescing hard planes,
# not an independent fuzzy sphere or repeated skinny spikes.
for i in range(17):
 x=-.16+i*.138
 height=3.0+.34*math.sin(math.pi*i/17)
 triangular_blade(f'19_crest_wedge_{i}',(x-.14,height-.14,-.11),
   (x+.05,height-.15,.12),(x-.09,height-.31,0),
   (x-.18,height+.17+(i%3)*.043,0),'mane_lit' if i%4==0 else 'mane',.07)
# Small tapered tail with a clean tuft (not a rubber hose).
loft_xyz('20_rump_tail',[
 (-2.35,1.94,0,.15),(-2.62,1.85,0,.13),(-2.88,1.70,0,.105),
 (-3.10,1.47,0,.085),(-3.18,1.23,0,.06)],'tail',7)
for i in range(5):
 triangular_blade(f'21_terminal_tail_tuft_{i}',
  (-3.12,1.26,-.09+i*.039),(-3.16,1.18,-.07+i*.039),
  (-3.19,1.29,-.07+i*.039),(-3.22-.08*(i%2),.95+i*.055,-.05+i*.039),
  'tail_tip',.037)

joined=trimesh.util.concatenate([mesh for _,mesh in PARTS])
scene=trimesh.Scene()
scene.add_geometry(joined,node_name='Mastelio_Anatomia_Facetada_V03',geom_name='Mastelio_v03_LOD0_Approval_Blockout')
OUT.parent.mkdir(parents=True,exist_ok=True)
OUT.write_bytes(scene.export(file_type='glb'))
raw=OUT.read_bytes()
report={
 'creature':'Mastélio','version':'v03 pilot blockout','stage':'silhouette_anatomy_in_artistic_review',
 'previous_versions_unchanged':True,'concept':'mastélio_na_savana_dourada.png',
 'pipeline':'anatomical_blockout -> user_visual_approval -> rig/animation -> LODs',
 'glb':OUT.name,'authoring_parts':len(PARTS),'export_mesh_groups':1,
 'triangles':int(sum(len(mesh.faces) for _,mesh in PARTS)),
 'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),
 'animations':[],'rig':'NOT YET: blockout before rig',
 'features':['distinct huge fan ears with concave inner pinna','squared head/jaw and brow',
 'continuous low-poly curl of prehensile proboscis','upper neck mane made from layered wedges',
 'faceted deep torso with ivory coat patches baked into faces','hip and shoulder directional planes',
 'four robust weight-bearing columnar limbs','separate toe nails / accurate ground support',
 'short tapered tufted tail'],
 'style_reference':'Torvardo v03 faceted silhouette and Wildhaven official 3D creature guide v1.0'
}
(ROOT/'manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2))