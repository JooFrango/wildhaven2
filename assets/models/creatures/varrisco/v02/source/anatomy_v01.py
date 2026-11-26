#!/usr/bin/env python3
"""Wildhaven Varrisco v01 — approved concept -> anatomy/planes blockout.

Authoring uses deliberate cross-section lofts, fully triangulated flat faces,
recessed features and integrated planes; no sphere/capsule/SDF massing.
Units: metres. X forward, Y up, Z lateral. Origin on the ground.
The blockout is intentionally static: zero rig, skins, joints, animation clips.
Reference language: Torvardo v03; Mastélio/Garruva v03 complements.
"""
from __future__ import annotations
import hashlib, json, math
from pathlib import Path
import numpy as np
import trimesh

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'varrisco-v01-anatomy-blockout.glb'
RNG=np.random.default_rng(117)
PARTS=[]
P={
 'sand':'#b88348','sand_bright':'#cc9459','ochre':'#b77a42',
 'gold':'#d4a368','cream':'#ceb58b','underside':'#a57e57',
 'rust':'#97502f','rust_light':'#b56739','rust_dark':'#6b382d',
 'clay':'#8f6246','shale':'#463c36','slate':'#393738',
 'dark':'#302d2a','scute':'#80634d','claw':'#2c3030',
 'bone':'#cbb78e','eye':'#c68b38','pupil':'#171917',
 'nostril':'#2e2b29','mouth':'#322a27',
}
def rgb(col):
 h=P.get(col,col).strip('#');return np.array([int(h[i:i+2],16) for i in (0,2,4)],dtype=float)

def add(name, vertices, faces, palette='sand', tone=None):
 """Duplicate the vertices of each triangle to set hard face normals."""
 f=np.asarray(faces,dtype=np.int64)
 v=np.asarray(vertices,dtype=np.float64)
 if not len(f):return
 pts=v[f].reshape(-1,3)
 if callable(palette): colors=[palette(k, v[face].mean(axis=0)) for k,face in enumerate(f)]
 else: colors=[palette]*len(f)
 rgba=np.empty((len(f)*3,4),dtype=np.uint8)
 for i,c in enumerate(colors):
  n=1.0 + (RNG.random()-.5)*(.045 if tone is None else tone)
  rgba[3*i:3*i+3,:3]=np.clip(rgb(c)*n,0,255).astype('uint8')
  rgba[3*i:3*i+3,3]=255
 mesh=trimesh.Trimesh(vertices=pts,faces=np.arange(len(pts),dtype=np.int64).reshape(-1,3),process=False)
 mesh.visual.vertex_colors=rgba
 PARTS.append((name,mesh))

def loft_x(name, rows, color, sides=12, phase=0):
 """X-axis anatomical sections (x,cy,cz,rY,rZ), variable center and radii."""
 verts=[];tris=[];meta=[]
 for x,y,z,ry,rz in rows:
  for i in range(sides):
   theta=2*math.pi*i/sides+phase
   verts.append((x,y+ry*math.cos(theta),z+rz*math.sin(theta)))
 for k in range(len(rows)-1):
  for j in range(sides):
   a=k*sides+j;b=k*sides+(j+1)%sides;c=(k+1)*sides+j;d=(k+1)*sides+(j+1)%sides
   tris.extend([(a,c,b),(b,c,d)])
 for j in range(1,sides-1):tris.append((0,j+1,j))
 last=(len(rows)-1)*sides
 for j in range(1,sides-1):tris.append((last,last+j,last+j+1))
 add(name,verts,tris,color)

def tube(name,points,radii,color,sides=9):
 """Controlled sweep. Joined cross sections with tangent-aligned frames."""
 ps=np.asarray(points,dtype=float);v=[];f=[]
 if isinstance(radii,(int,float)):radii=[radii]*len(ps)
 for i,p in enumerate(ps):
  tangent=ps[min(len(ps)-1,i+1)]-ps[max(0,i-1)]
  tangent=tangent/np.linalg.norm(tangent)
  helper=np.array([0,0,1.]) if abs(tangent[2])<.85 else np.array([0,1.,0])
  u=np.cross(tangent,helper);u=u/np.linalg.norm(u)
  w=np.cross(tangent,u)
  for j in range(sides):
   a=2*math.pi*j/sides+math.pi/sides
   v.append(p+radii[i]*(u*math.cos(a)+w*math.sin(a)))
 for k in range(len(ps)-1):
  for j in range(sides):
   a=k*sides+j;b=k*sides+(j+1)%sides;c=(k+1)*sides+j;d=(k+1)*sides+(j+1)%sides
   f.extend([(a,b,c),(b,d,c)])
 for j in range(1,sides-1):f.append((0,j,j+1))
 last=(len(ps)-1)*sides
 for j in range(1,sides-1):f.append((last,last+j+1,last+j))
 add(name,v,f,color)

def blade(name, root1,root2,ridge,tip,color,thick=.035):
 a=np.asarray(root1,float);b=np.asarray(root2,float);c=np.asarray(ridge,float);d=np.asarray(tip,float)
 # diamond wedge with internal raised edge. Geometric silhouette not a floating decal.
 ctr=(a+b+c+d)/4
 offset=np.array([0,0,thick])
 v=[a,b,c,d,a-offset,b-offset,c-offset,d-offset]
 f=[(0,1,3),(1,2,3),(4,7,5),(5,7,6), (0,4,1),(1,4,5),
    (1,5,2),(2,5,6),(2,6,3),(3,6,7),(3,7,0),(0,7,4)]
 add(name,v,f,color)

def surface(name,points,col,thickness=.009):
 """Embedded angular panel used for brow, skin patches, tendons, etc."""
 v=np.asarray(points,dtype=float)
 center=v.mean(axis=0)
 # Add a center peak for differentiated flat planes; skin changes silhouette minimally.
 vv=list(v)+[center+np.array([0,thickness,0])]
 f=[(i,(i+1)%len(v),len(v)) for i in range(len(v))]
 add(name,vv,f,col)

# MAIN AXIAL MASS, forward +X. 12 distinct section contours, no spheres.
loft_x('01_torso_integrated_hip_to_chest',[
 (-.78,1.095,0,.08,.13),(-.72,1.10,0,.22,.25),
 (-.60,1.12,0,.31,.32),(-.43,1.14,0,.36,.37),
 (-.25,1.155,0,.32,.35),(-.04,1.14,0,.305,.33),
 (.16,1.15,0,.30,.33),(.33,1.17,0,.30,.30),
 (.46,1.18,0,.25,.25),(.55,1.21,0,.12,.16)],'sand',14,math.pi/14)
# Shape refinements integrated into body, not attached eggs.
loft_x('02_back_low_ridge',[
 (-.68,1.37,0,.045,.12),(-.53,1.46,0,.045,.15),
 (-.25,1.45,0,.056,.18),(.02,1.44,0,.062,.19),
 (.24,1.425,0,.05,.18),(.43,1.39,0,.02,.10)],'rust',10)
loft_x('03_underbelly_chest_keel',[
 (-.59,.890,0,.045,.12),(-.36,.815,0,.06,.17),
 (-.07,.830,0,.065,.19),(.19,.863,0,.07,.19),
 (.4,.93,0,.03,.12)],'underside',10)
# Shoulder and scapula planes: intentional diagonal light/dark anatomy.
for s in (-1,1):
 surface(f'04_scapula_planar_{s}',[(.05,1.36,s*.27),(.32,1.41,s*.24),(.49,1.23,s*.22),(.34,1.04,s*.30),(.08,1.12,s*.329)],'sand_bright',.006)
 surface(f'05_rib_sweep_{s}',[(-.33,1.29,s*.32),(-.02,1.34,s*.328),(.10,1.09,s*.33),(-.03,.95,s*.28),(-.34,1.06,s*.30)],'ochre',.009)
 surface(f'06_hip_sweep_{s}',[(-.70,1.31,s*.23),(-.48,1.44,s*.28),(-.25,1.22,s*.34),(-.36,.96,s*.35),(-.62,.99,s*.31)],'sand_bright',.009)
# Neck as rising wedge with deliberate S and lower throat; non-cylinder sections.
loft_x('07_curved_neck',[
 (.35,1.18,0,.26,.27),(.48,1.24,0,.26,.245),
 (.58,1.34,0,.25,.235),(.68,1.43,0,.21,.21),
 (.80,1.465,0,.185,.20),(.94,1.485,0,.15,.185)],'sand',12,math.pi/12)
loft_x('08_throat_cream',[
 (.40,1.01,0,.095,.165),(.57,1.12,0,.09,.16),
 (.67,1.24,0,.095,.16),(.82,1.35,0,.07,.145)],'cream',10,math.pi/10)
# Reptilian head has sculpted triangular skull, cheek and long but strong snout.
loft_x('09_cranium_wedge',[
 (.77,1.49,0,.15,.18),(.88,1.50,0,.215,.25),
 (1.025,1.51,0,.23,.27),(1.17,1.51,0,.175,.225),
 (1.29,1.485,0,.135,.18),(1.38,1.45,0,.095,.13)],'sand_bright',12,math.pi/12)
loft_x('10_upper_muzzle_beveled',[
 (1.21,1.465,0,.11,.19),(1.32,1.456,0,.115,.18),
 (1.45,1.45,0,.10,.16),(1.55,1.435,0,.08,.14),
 (1.61,1.415,0,.06,.11)],'clay',10,math.pi/10)
loft_x('11_lower_jaw',[
 (.94,1.35,0,.058,.18),(1.13,1.34,0,.066,.21),
 (1.34,1.35,0,.067,.19),(1.52,1.36,0,.047,.135),
 (1.58,1.375,0,.02,.095)],'underside',10,math.pi/10)
# Distinct mouth seam, cheek sockets and angular brows.
for s in (-1,1):
 surface(f'12_mouth_seam_{s}',[(1.105,1.396,s*.218),(1.315,1.389,s*.176),(1.52,1.391,s*.139),(1.575,1.402,s*.093),(1.40,1.371,s*.17)],'mouth',.005)
 surface(f'13_zygomatic_bone_{s}',[(.91,1.445,s*.235),(1.14,1.46,s*.224),(1.26,1.385,s*.18),(1.07,1.325,s*.205),(.96,1.355,s*.21)],'rust_dark',.005)
 surface(f'14_brow_osseous_{s}',[(.91,1.62,s*.18),(1.055,1.66,s*.2),(1.19,1.60,s*.20),(1.16,1.55,s*.243),(.97,1.55,s*.258)],'rust',.01)
 # Eye recessed in broad charcoal cavity, iris/pupil within contour, non-ball.
 surface(f'15_eye_socket_{s}',[(1.035,1.555,s*.259),(1.13,1.56,s*.257),(1.155,1.52,s*.254),(1.095,1.489,s*.267),(1.04,1.514,s*.264)],'dark',.007)
 surface(f'16_amber_iris_{s}',[(1.065,1.537,s*.272),(1.105,1.55,s*.267),(1.115,1.525,s*.273),(1.083,1.510,s*.277)],'eye',.008)
 surface(f'17_pupil_{s}',[(1.083,1.544,s*.278),(1.10,1.545,s*.278),(1.102,1.518,s*.280),(1.086,1.516,s*.279)],'pupil',.005)
 surface(f'18_nostril_{s}',[(1.49,1.469,s*.154),(1.535,1.468,s*.14),(1.536,1.446,s*.143),(1.496,1.440,s*.16)],'nostril',.004)
 # Shallow terracotta jaw bridge plane, armorless.
 surface(f'19_cheek_bevel_{s}',[(.83,1.50,s*.227),(.93,1.33,s*.20),(1.05,1.30,s*.20),(1.155,1.365,s*.22),(1.135,1.44,s*.23)],'ochre',.004)
# Angular rear occipital crest and short feather/quill structures (not plates).
for i in range(7):
 x=.76-i*.053
 ys=1.645 + max(0,6-i)*.004
 blade(f'20_nape_quill_{i}',(x-.045,ys-.08,-.07),(x+.04,ys-.09,.06),
       (x-.02,ys+.018,-.015),(x-.10,ys+.045+(6-i)*.006,-.01),'rust_light' if i%3 else 'rust',.025)
# Dorsal tiny feather line embedded to break ridge, low height.
for i,x in enumerate(np.linspace(-.46,.3,12)):
 y=1.47 if x<.05 else 1.45
 blade(f'21_short_dorsal_quill_{i}',(x-.045,y-.045,-.055),(x+.035,y-.045,.055),
       (x-.03,y+.02,0),(x-.10,y+.06 if i%3==0 else y+.035,0),'rust_dark' if i%4==0 else 'rust',.018)
# Tail: long taper with intentional cross-section and a notched rust/dark pattern.
loft_x('22_tail_base_structural',[
 (-2.15,1.03,0,.012,.014),(-2.03,1.055,0,.045,.043),
 (-1.84,1.06,0,.070,.062),(-1.65,1.075,0,.100,.092),
 (-1.46,1.085,0,.135,.126),(-1.28,1.095,0,.165,.150),
 (-1.07,1.11,0,.193,.185),(-.88,1.12,0,.215,.225),
 (-.67,1.125,0,.235,.25)],
 lambda k,p: 'slate' if any(abs(p[0]-mid)<width for mid,width in [(-1.84,.065),(-1.49,.10),(-1.12,.09),(-.82,.075)]) else ('rust' if p[1]>1.12 else 'ochre'),10,math.pi/10)
# Dark tail bands conform to tapered loft, no coplanar decorative boxes.
for j,(x,r) in enumerate([(-1.84,.079),(-1.48,.14),(-1.12,.193),(-.84,.23)]):
 for s in (-1,1):
  # Skin ribbon just above visible flank surface, transitions under tail edge.
  rows=[(x-.070,1.065+.1*j/3,s*(r*.56)),(x-.055,1.09+.1*j/3,s*(r*.90)),
        (x+.11,1.09+.1*j/3,s*(r*.90)),(x+.13,1.045+.1*j/3,s*(r*.58))]
  surface(f'23_tail_dark_band_{j}_{s}',rows,'slate',.006)
# A few longer crest feathers at the tail root, embedded.
for i,x in enumerate(np.linspace(-.97,-.48,7)):
 base=1.305 + .07*(i/6)
 blade(f'24_tail_root_feather_{i}',(x-.06,base-.03,-.06),(x+.055,base-.025,.06),
       (x-.015,base+.015,0),(x-.12,base+.085,0),'rust' if i%2==0 else 'rust_light',.018)
# Hind limbs — weight-bearing, complex bent axes and deliberate ankle/hock.
for s in (-1,1):
 z=s*.285; hip=(-.425,1.115,z)
 # thigh: bulky at hip, bends forward toward knee, shaped by 7 controlled sections.
 tube(f'25_hind_femur_{s}',[(-.47,1.11,z),(-.405,1.07,z),(-.28,.90,z),(-.17,.72,z),(-.135,.615,z),(-.175,.56,z)],
      [.295,.29,.255,.193,.150,.105],'sand',11)
 surface(f'26_femoral_plane_{s}',[(-.53,1.21,z+s*.23),(-.31,1.00,z+s*.24),(-.135,.73,z+s*.18),(-.24,.64,z+s*.14),(-.50,.87,z+s*.20)],'ochre',.008)
 # Shin set back from knee, thick and angular near upper tendon.
 tube(f'27_shin_tibia_{s}',[(-.16,.615,z),(-.195,.52,z),(-.28,.40,z),(-.355,.27,z),(-.345,.17,z)],
      [.149,.125,.100,.069,.064],'sand',10)
 # Narrow ankle-hock to fore-foot metatarsal, no floating foot.
 tube(f'28_ankle_metatarsal_{s}',[(-.345,.24,z),(-.33,.175,z),(-.27,.12,z),(-.185,.09,z)],
      [.077,.074,.085,.080],'ochre',9)
 surface(f'29_achilles_dark_{s}',[(-.34,.44,z+s*.085),(-.40,.34,z+s*.075),(-.39,.23,z+s*.067),(-.36,.20,z+s*.060),(-.30,.39,z+s*.095)],'clay',.006)
 # Distinct three anterior toes with integrated dark pointed claws; central lifted sickle.
 for t,dz in enumerate([-.085,.016,.112]):
  tz=z+dz
  tube(f'30_toe_{s}_{t}',[(-.24,.095,tz),(-.116,.073,tz),(.010,.071,tz),(.093,.061,tz)],
       [.083,.067,.055,.027],'ochre',8)
  tube(f'31_toe_claw_{s}_{t}',[(.066,.08,tz),(.132,.058,tz),(.196,.049,tz),(.219,.036,tz)],
       [.047,.04,.027,.003],'claw',8)
 # Enlarged sickle toe II; lifted curved keratin blade anchored above ground.
 tz=z+s*.12
 tube(f'32_raised_sickle_claw_{s}',[(-.025,.138,tz),(.054,.212,tz),(.103,.237,tz),(.156,.224,tz),(.197,.178,tz)],
      [.052,.060,.043,.025,.0025],'claw',9)
 # Angular individual side pedal scale at tarsus.
 surface(f'33_dorsal_metatarsal_scute_{s}',[(-.33,.198,z+s*.055),(-.23,.194,z+s*.076),(-.12,.115,z+s*.079),(-.27,.12,z+s*.088)],'clay',.008)

# Paired forelimbs: muscular shoulders, pronounced elbows, distinct three-finger grips.
for s in (-1,1):
 z=s*.235
 tube(f'34_forelimb_humerus_{s}',[(.32,1.21,z),(.34,1.10,z+s*.035),(.44,1.00,z+s*.07),(.53,.99,z+s*.08)],
      [.145,.142,.115,.092],'sand',10)
 tube(f'35_forelimb_forearm_{s}',[(.53,.99,z+s*.08),(.625,.985,z+s*.12),(.685,.918,z+s*.12),(.70,.88,z+s*.12)],
      [.105,.087,.074,.059],'ochre',9)
 surface(f'36_forelimb_tendon_plane_{s}',[(.36,1.16,z+s*.105),(.45,1.08,z+s*.161),(.57,1.005,z+s*.14),(.52,.97,z+s*.15),(.34,1.05,z+s*.109)],'clay',.006)
 for t,dz in enumerate([-.058,0,.064]):
  zz=z+s*.12+dz
  tube(f'37_three_fingers_{s}_{t}',[(.69,.89,zz),(.73,.824,zz),(.754,.76,zz),(.768,.74,zz)],
       [.032,.027,.021,.012],'sand',7)
  tube(f'38_finger_claw_{s}_{t}',[(.758,.77,zz),(.772,.735,zz),(.755,.702,zz),(.734,.689,zz)],
       [.026,.025,.015,.003],'claw',7)

# A few embedded belly-side markings to make the one shared savanna/desert phenotype legible.
for s in (-1,1):
 for i,x in enumerate([-.48,-.12,.23]):
  rr=.305 if x<0 else .287
  surface(f'39_dark_flank_chevron_{s}_{i}',[(x-.105,1.34,s*rr*.94),
    (x+.008,1.275,s*rr*1.05),(x+.11,1.06,s*rr*1.05),
    (x+.025,1.11,s*rr*.97)],'rust_dark' if i==0 else 'clay',.002)

meshes=[x[1] for x in PARTS]
combined=trimesh.util.concatenate(meshes)
# Match the user-approved medium-predator dimensions: 3.08m long, ~1.44m high.
combined.apply_scale(.82)
# Explicit single authoring/export mesh group, no animation or skin metadata.
scene=trimesh.Scene()
scene.add_geometry(combined,geom_name='varrisco-v01-faceted-anatomy',node_name='Varrisco_Static_Anatomy')
payload=trimesh.exchange.gltf.export_glb(scene,include_normals=True)
OUT.write_bytes(payload)
# Reimport to measure actual geometry; no reliance on generator-only bookkeeping.
actual=trimesh.load(OUT,force='scene',process=False)
triangles=sum(len(g.faces) for g in actual.geometry.values())
mins,maxs=actual.bounds
blob=OUT.read_bytes()
manifest={
 'species':'varrisco','version':'v01','stage':'anatomy_blockout','status':'awaiting_user_blockout_approval',
 'concept_status':'approved_in_chat_2026-11-09',
 'art_direction':'Torvardo v03 principal; Mastelio v03 and Garruva v03 complementary',
 'habitats':['savanna','desert'],'variant_count':1,'diet':'medium_carnivore',
 'scale_units':'metres','coordinate_system':'X forward, Y up, Z lateral',
 'glb':OUT.name,'bytes':len(blob),'sha256':hashlib.sha256(blob).hexdigest(),
 'triangles_exported_reimported':triangles,
 'triangle_measure_method':'sum of triangles in trimesh-loaded GLB mesh geometries; one instance',
 'authoring_parts':len(PARTS),'mesh_definitions':len(actual.geometry),
 'skins':0,'joints':0,'animations':[], 'lods':['blockout'],
 'bounding_box_m':{'min':np.round(mins,4).tolist(),'max':np.round(maxs,4).tolist()},
 'previews':{'profile':'previews/varrisco-v01-real-glb-profile.png',
             'front':'previews/varrisco-v01-real-glb-front.png',
             'three_quarter':'previews/varrisco-v01-real-glb-three-quarter.png'},
 'source':'source/build.py','render_source':'source/render.py',
 'publication':'local_pending_git_remote_validation','integration':'not_integrated',
 'notes':'Static blockout. No rig, skin, animation, LOD1/LOD2 or runtime implementation; concept approval distinct from form approval.'
}
(ROOT/'manifest.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n',encoding='utf8')
print(f'{OUT} | {len(blob)} bytes | {triangles} triangles | {len(PARTS)} authored parts | sha256={manifest["sha256"]}')
print('Bounds',manifest['bounding_box_m'])
