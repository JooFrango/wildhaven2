#!/usr/bin/env python3
"""Wildhaven: Varrisco v01, original faceted medium biped predator blockout.
Concept approved 2026-11-09. Static GLB only. X forward, Y up, Z lateral.
Geometry made of controlled anatomical sections; no skinned rig or animation.
"""
from __future__ import annotations
import math, json, hashlib
from pathlib import Path
import numpy as np
import trimesh
ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'varrisco-v01-anatomy-blockout.glb'
RNG=np.random.default_rng(11209)
PARTS=[]
P={
    'body':'#a96a38','body_top':'#bc7940','flank':'#b57c46','belly':'#dbc293',
    'hip':'#b36f37','thigh':'#a76535','shin':'#ae794b','neck':'#b77a43',
    'head':'#a96837','jaw':'#c99760','muzzle':'#64462f','brow':'#5a3b29',
    'crest':'#7d3926','crest_light':'#a4512c','feather':'#994b2d',
    'dark':'#382e27','band':'#4b382e','band_light':'#73513a','claw':'#302d29',
    'eye':'#151616','iris':'#d8ae54','tooth':'#ddd1ad','throat':'#d5b283',
    'speck':'#d09a59','sole':'#524337','line':'#6f4430',
}
def rgba(name):
    h=P.get(name,name).lstrip('#')
    return np.array([int(h[i:i+2],16) for i in (0,2,4)]+[255],dtype=np.uint8)

def add(name, verts, faces, color, variation=.035):
    verts=np.asarray(verts,dtype=np.float64)
    faces=np.asarray(faces,dtype=np.int64)
    if not len(faces):return
    # Independent triangles produce hard, sculpted planes rather than rubbery shading.
    points=verts[faces.ravel()].reshape((-1,3))
    tri=np.arange(len(points)).reshape((-1,3))
    colors=np.tile(rgba(color),(len(points),1))
    scales=(1.+(RNG.random(len(tri))-.5)*variation)
    colors[:,:3]=np.repeat(np.clip(colors[::3,:3].astype(float)*scales[:,None],0,255).astype(np.uint8),3,axis=0)
    mesh=trimesh.Trimesh(vertices=points,faces=tri,process=False)
    mesh.visual.vertex_colors=colors
    PARTS.append((name,mesh))

def loft_x(name, sections, color, n=12, phase=math.pi/12):
    # (x,y,z,ry,rz) cross-sections; independent center/width/height per station.
    vv=[]; ff=[]
    for x,y,z,ry,rz in sections:
        for j in range(n):
            a=math.pi*2*j/n+phase
            vv.append((x,y+ry*math.cos(a),z+rz*math.sin(a)))
    for k in range(len(sections)-1):
        for j in range(n):
            a=k*n+j;b=k*n+(j+1)%n;c=(k+1)*n+j;d=(k+1)*n+(j+1)%n
            ff.extend(((a,c,b),(b,c,d)))
    for j in range(1,n-1):ff.append((0,j+1,j))
    t=(len(sections)-1)*n
    for j in range(1,n-1):ff.append((t,t+j,t+j+1))
    add(name,vv,ff,color)

def loft_path(name,points,r_y,r_z,color,n=9):
    pp=np.asarray(points,float); vv=[];ff=[]
    for i,c in enumerate(pp):
        axis=pp[min(len(pp)-1,i+1)]-pp[max(0,i-1)]
        axis/=np.linalg.norm(axis)
        h=np.array([0.,0.,1.]);
        if abs(np.dot(axis,h))>.92:h=np.array([0.,1.,0.])
        u=np.cross(axis,h);u/=np.linalg.norm(u)
        v=np.cross(axis,u)
        for j in range(n):
            a=2*math.pi*j/n
            p=c+u*(r_y[i]*math.cos(a))+v*(r_z[i]*math.sin(a))
            vv.append(p)
    for k in range(len(pp)-1):
        for j in range(n):
            a=k*n+j;b=k*n+(j+1)%n;c=(k+1)*n+j;d=(k+1)*n+(j+1)%n
            ff.extend(((a,b,c),(b,d,c)))
    for j in range(1,n-1):ff.append((0,j,j+1))
    t=(len(pp)-1)*n
    for j in range(1,n-1):ff.append((t,t+j+1,t+j))
    add(name,vv,ff,color)

def wedge(name, polygon, color, thickness=.015, axis=(0,0,1)):
    pp=np.array(polygon,float); nn=len(pp)
    back=pp-np.array(axis)*thickness
    vv=np.vstack((pp,back))
    ff=[]
    for j in range(1,nn-1):ff.append((0,j,j+1));ff.append((nn,nn+j+1,nn+j))
    for j in range(nn):
        k=(j+1)%nn
        ff.extend(((j,k,nn+j),(k,nn+k,nn+j)))
    add(name,vv,ff,color,.02)

def claw(name,center,tip,r0=.038,color='claw'):
    c=np.array(center,float);p=np.array(tip,float)
    d=(p-c);L=np.linalg.norm(d);d/=L
    other=np.array([0.,0.,1.]);
    if abs(np.dot(d,other))>.93:other=np.array([0.,1.,0.])
    u=np.cross(d,other);u/=np.linalg.norm(u);v=np.cross(d,u)
    a=c+u*r0; b=c-u*.45*r0+v*.87*r0;c2=c-u*.45*r0-v*.87*r0
    add(name,[a,b,c2,p],[(0,1,3),(1,2,3),(2,0,3),(0,2,1)],color,0)

# 01 — Pelvis / breast: anatomical trunk with controlled cross-sections, not a capsule.
loft_x('01_trunk_ribcage',[(-.86,1.015,0,.11,.15),(-.75,1.02,0,.22,.31),
 (-.55,1.02,0,.275,.375),(-.31,1.014,0,.285,.35),(-.04,1.004,0,.268,.32),
 (.22,.993,0,.235,.28),(.42,1.000,0,.18,.245),(.55,1.007,0,.10,.135)],'body',14)
loft_x('02_near_white_lower_chest',[(.01,.834,0,.075,.23),(.21,.843,0,.102,.24),
 (.41,.847,0,.085,.20),(.52,.86,0,.035,.1)],'belly',12)
# Hip visual plane strips inset into torso, separate broad angled flanks.
for s in (-1,1):
    wedge('03_haunch_plane_'+str(s),[(-.78,1.12,s*.21),(-.53,1.25,s*.305),
     (-.25,1.16,s*.32),(-.22,.95,s*.312),(-.56,.86,s*.31)],'hip',.02,(0,0,s))
    wedge('04_oblique_flank_'+str(s),[(-.28,1.16,s*.30),(.20,1.12,s*.27),
     (.42,.96,s*.215),(.16,.86,s*.272)],'flank',.019,(0,0,s))

# 02 — Tail: long counterbalance, irregular taper; color bands on actual side faces.
loft_x('05_counterbalance_tail',[
 (-2.32,.86,0,.014,.015),(-2.22,.89,0,.041,.046),(-2.07,.92,0,.072,.075),
 (-1.90,.942,0,.094,.098),(-1.69,.967,0,.121,.126),(-1.44,.998,0,.148,.148),
 (-1.18,1.011,0,.16,.178),(-.95,1.012,0,.17,.20),(-.73,1.017,0,.173,.227)],'body',10)
for ib, (x0,midry) in enumerate([(-1.93,.083),(-1.65,.123),(-1.35,.15),(-1.06,.17)]):
    loft_x(f'06a_full_tail_band_{ib}',[(x0-.05,.94 if ib==0 else (.967 if ib==1 else 1.0),0,midry*.99,midry*1.03),
       (x0+.045,.94 if ib==0 else (.967 if ib==1 else 1.0),0,midry*1.01,midry*1.06)],'band',10)
for i,tx in enumerate([-1.94,-1.65,-1.34,-1.06]):
    # Top of tail bands precisely follow narrowing silhouette.
    ry={-1.94:.08,-1.65:.12,-1.34:.15,-1.06:.17}[tx]
    rz=ry*1.03
    for s in (-1,1):
        wedge(f'06_tail_banding_{i}_{s}',[(tx-.078,.94+ry*.55,s*rz*.67),
          (tx+.05,.94+ry*.72,s*rz*.72),(tx+.115,.94+ry*.20,s*rz*.94),
          (tx-.005,.94-ry*.13,s*rz*.99)],'band',.01,(0,0,s))

# 03 — Powerful hind limbs: joint centers engineered for a digitigrade biped.
for s in (-1,1):
    z=s*.242
    loft_path(f'07_hip_thigh_{s}',[(-.47,1.063,z*.78),(-.43,.93,z*1.03),
      (-.20,.74,z*1.22),(.00,.56,z*1.28)],[.20,.20,.14,.084],[.17,.182,.115,.081],'thigh',10)
    loft_path(f'08_knee_shin_{s}',[(.003,.573,z*1.28),(-.105,.47,z*1.33),
      (-.23,.245,z*1.34),(-.19,.158,z*1.34)],[.095,.089,.057,.044],
      [.082,.071,.050,.041],'shin',9)
    # heel / long metatarsal shank / lifted arch
    loft_path(f'09_hock_and_metatarsal_{s}',[(-.19,.17,z*1.34),(-.13,.125,z*1.35),
       (.04,.112,z*1.37),(.13,.089,z*1.39)],[.047,.043,.04,.052],[.043,.044,.040,.051],'body',9)
    for j,off in enumerate([-.075,.0,.075]):
        zz=z*1.39+off
        loft_path(f'10_weight_toe_{s}_{j}',[(.11,.092,zz),(.205,.057,zz+s*.006),
         (.316,.047,zz+s*.009)],[.05,.043,.025],[.040,.038,.024],'body',7)
        claw(f'11_toe_claw_{s}_{j}',(.308,.049,zz+s*.007),(.403,.031,zz+s*.012),.027)
    # enlarged recurved second sickle claw raised off the floor (signature).
    zsc=z*1.39-s*.095
    loft_path(f'12_elevated_digit_{s}',[(.105,.105,zsc),(.18,.16,zsc),(.20,.22,zsc)],
              [.05,.037,.025],[.034,.026,.021],'body',7)
    claw(f'13_sickle_claw_{s}',(.205,.211,zsc),(.27,.12,zsc+s*.018),.053)
    # dark angled tendon overlays to make knee and hock changes readable
    wedge(f'14_thigh_crease_{s}',[(-.30,.78,s*.38),(-.07,.59,s*.36),
       (-.19,.62,s*.375)],'line',.012,(0,0,s))

# 04 — Upright S-shaped cervical column and a sharp cranial silhouette.
loft_path('15_s_neck',[(.45,.995,0),(.55,1.068,0),(.585,1.20,0),
   (.68,1.294,0),(.78,1.318,0)],[.14,.155,.135,.11,.11],
   [.166,.158,.132,.12,.116],'neck',11)
loft_x('16_angular_cranium',[(.705,1.325,0,.08,.10),(.78,1.35,0,.128,.138),
   (.93,1.359,0,.15,.165),(1.075,1.35,0,.133,.15),(1.18,1.322,0,.10,.105)],'head',12)
loft_x('17_tapered_upper_rostrum',[(1.09,1.317,0,.082,.13),(1.20,1.301,0,.081,.118),
   (1.38,1.276,0,.055,.088),(1.51,1.252,0,.032,.061),(1.57,1.249,0,.019,.03)],'muzzle',10)
loft_x('18_lower_mandible',[(.93,1.247,0,.029,.107),(1.11,1.221,0,.038,.117),
   (1.38,1.213,0,.024,.083),(1.53,1.231,0,.015,.040)],'jaw',10)
for s in (-1,1):
    # broad zygomatic and brow plane with recessed inset eye (no googly spheres).
    wedge(f'19_eye_brow_{s}',[(.83,1.417,s*.116),(1.0,1.412,s*.153),
       (1.10,1.373,s*.136),(.93,1.355,s*.154)],'brow',.014,(0,0,s))
    wedge(f'20_recessed_eye_{s}',[(.926,1.380,s*.153),(.977,1.371,s*.157),
       (.985,1.342,s*.161),(.937,1.337,s*.164)],'eye',.003,(0,0,s))
    wedge(f'21_amber_iris_{s}',[(.951,1.365,s*.162),(.966,1.361,s*.165),
       (.970,1.348,s*.167),(.951,1.348,s*.167)],'iris',.002,(0,0,s))
    wedge(f'22_nostril_{s}',[(1.405,1.279,s*.069),(1.446,1.272,s*.060),
       (1.433,1.257,s*.065)],'dark',.002,(0,0,s))
    # five small embedded ivory teeth; not a sawtooth full jaw.
    for i in range(5):
        x=1.18+i*.067
        wedge(f'23_small_tooth_{s}_{i}',[(x,1.24,s*(.105-i*.013)),
          (x+.033,1.24,s*(.10-i*.013)),(x+.018,1.208,s*(.102-i*.013))],
          'tooth',.012,(0,0,s))

# 05 — Short grasping forearms with bent elbows and fused wrist planes.
for s in (-1,1):
    z=s*.197
    loft_path(f'24_shoulder_upperarm_{s}',[(.35,1.061,z),(.46,.966,s*.253),
     (.44,.823,s*.264)],[.087,.075,.051],[.079,.065,.043],'body',9)
    loft_path(f'25_elbow_to_wrist_{s}',[(.44,.832,s*.265),(.575,.795,s*.278),
     (.625,.827,s*.265)],[.050,.043,.037],[.043,.035,.032],'thigh',8)
    for k in (-1,1):
        zc=s*.265+k*.025
        loft_path(f'26_grasping_finger_{s}_{k}',[(.615,.824,zc),(.697,.811,zc),
          (.727,.785,zc)],[.034,.024,.018],[.021,.017,.013],'body',7)
        claw(f'27_hand_claw_{s}_{k}',(.727,.789,zc),(.762,.732,zc),.024)

# 06 — Single dryland plumage identity, as small integrated angular neck feather wedges.
for k in range(7):
    x=.56+k*.076
    # Quills root on neck/head silhouette and lean backwards; tall enough to read.
    y=1.30 + (.115 if k>=3 else .045*k) - max(k-4,0)*.012
    wedge(f'28_nape_quill_{k}',[(x-.035,y-.055,-.052),(x+.035,y-.03,.051),
         (x-.105,y+.073,0),(x+.012,y+.017,-.047)],
         'crest' if k%2==0 else 'crest_light',.021,(0,0,1))
# Short low-slung angular feather panels along upper dorsum, not generic spikes.
for k in range(6):
    x=-.42+k*.16
    wedge(f'29_spine_feather_{k}',[(x-.10,1.246,-.05),(x+.08,1.251,-.04),
         (x-.02,1.283,.008),(x-.115,1.254,.045)],
          'feather' if k%2 else 'crest_light',.012,(0,0,1))

# 07 — darker triangular flank bars, respecting body curvature and angular material composition.
for s in (-1,1):
    for k in range(5):
        x=-.58+k*.21
        z=s*(.394 if k<2 else (.362 if k==2 else .314))
        wedge(f'30_flank_angled_bar_{s}_{k}',[(x-.064,1.167,z*.985),
          (x+.03,1.102,z*1.015),(x+.106,.972,z*1.01),(x+.020,1.034,z*1.02)],
          'band',.012,(0,0,s))

assert PARTS
# Export as single real mesh, separate vertices per face preserve flat normals.
mesh=trimesh.util.concatenate([m for _,m in PARTS])
# Compress X dimension to keep the approved medium-body design length near 3.1 m.
mesh.apply_transform(np.diag([.79,1.,1.,1.]))
scene=trimesh.Scene()
scene.add_geometry(mesh,geom_name='varrisco-v01-anatomy-blockout')
OUT.write_bytes(scene.export(file_type='glb'))
read=trimesh.load(OUT,force='scene')
tri=int(sum(len(m.faces) for m in read.geometry.values()))
if not (1500 <= tri <= 12000):raise RuntimeError(f'bad mesh triangles: {tri}')
assert sum(len(m.faces) for m in scene.geometry.values())==tri
bounds=np.array(read.bounds)
assert bounds.shape==(2,3) and bounds[0,1]>=-.02
assert bounds[1,1]>1.30 and bounds[1,0]>1.20
raw=OUT.read_bytes()
manifest={
 'species':'Varrisco','id':'varrisco','version':'v01','stage':'static_anatomy_blockout',
 'concept_status':'approved_by_user_2026-11-09','blockout_art_status':'awaiting_user_form_approval',
 'technical_status':'exported_and_reimported_trimesh',
 'integrated_into_game':False,'models':[{'path':OUT.name,'sha256':hashlib.sha256(raw).hexdigest(),
 'bytes':len(raw),'triangles_unique_mesh_definitions':tri,'skins':0,'joints':0,'animation_clips':0}],
 'meshes_exported':len(read.geometry),'authoring_parts':len(PARTS),'materials':'baked vertex colors',
 'coordinate_system':'X forward, Y up, Z lateral; meters (proposal)',
 'extents_m':[round(float(x),3) for x in read.extents],
 'body_proposal':{'length_m':[2.7,3.1],'height_m':[1.3,1.5],'mass_kg':[55,85],
 'habitats':['savanna','desert'],'versions_for_biomes':1,'diet':'carnivore'},
 'rendered_from':'reimported GLB (see previews/ and source/render.py)',
 'next_stage':'user_approval_of_blockout_form_before_refinement_rig_animation'
}
(ROOT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(manifest,ensure_ascii=False,indent=2))