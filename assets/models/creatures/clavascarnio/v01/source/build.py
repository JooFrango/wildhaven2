#!/usr/bin/env python3
"""Clavascarnio Wildhaven v01 blockout. Geometry + UV texture baked into GLB.
Explicitly a *static* form-review blockout: no rig, animations or LODs.
Run: python source/build.py [destination directory]
"""
import math, os, sys, json, hashlib
from pathlib import Path
from collections import Counter
import numpy as np
from PIL import Image
import trimesh

OUT=Path(sys.argv[1] if len(sys.argv)>1 else Path(__file__).resolve().parents[1]);OUT.mkdir(parents=True,exist_ok=True)
np.random.seed(34777)
G=trimesh.Scene()
parts=[]

# Purpose-built UV paint atlas: all colors, spots and scutes live in this one image.
# Geometry components only exist for actual structure (cuticle, eyes, joints, teeth).
COLORS=[(156,80,41),(204,118,53),(74,42,31),(209,173,111),
        (120,57,38),(237,198,124),(40,27,26),(188,119,65)]
N=1024
tex=np.zeros((N,N,3),dtype=np.uint8)
rng=np.random.default_rng(116)
for i,color in enumerate(COLORS):
    r,c=divmod(i,4);yy,xx=np.mgrid[0:512,0:256]
    noise=rng.normal(0,7,(512,256))
    bands=11*np.sin(xx/16 + 0.6*np.cos(yy/24))+4*np.sin(yy/11+xx/29)
    spots=(np.sin(xx*.151+np.cos(yy*.07)*4)*np.cos(yy*.141+np.sin(xx*.08)*5)>0.74).astype(float)
    value=noise+bands-23*spots
    sample=np.clip(np.asarray(color)[None,None,:]+value[:,:,None],0,255).astype(np.uint8)
    tex[r*512:(r+1)*512,c*256:(c+1)*256,:]=sample
im=Image.fromarray(tex,'RGB');im.save(OUT/'clavascarnio-uv-v01.png',optimize=True)
MAT=trimesh.visual.material.PBRMaterial(name='Clavascarnio_ochre_UVpaint',baseColorTexture=im,metallicFactor=0.0,roughnessFactor=0.96,doubleSided=True)

def add(mesh,name,palette=0):
    if not isinstance(mesh,trimesh.Trimesh):raise TypeError(name)
    mesh=mesh.copy(); mesh.unmerge_vertices() # true flat normals per facet
    xyz=np.asarray(mesh.vertices)
    # Repeatable UV for each physical body part, within one unique region of atlas.
    mn=xyz.min(0);sp=np.maximum(np.ptp(xyz,axis=0),.12)
    a=(xyz[:,0]-mn[0])/sp[0];b=(xyz[:,2]-mn[2])/sp[2]
    # Smaller details use vertical location to introduce painted plane changes.
    if sp[2]<.22:b=(xyz[:,1]-mn[1])/sp[1]
    # Texcoords glTF start at bottom; PIL atlas r0 is top.
    col=palette%4;row=palette//4
    u=(col*256+12+a*232)/1024
    v=1-(row*512+15+b*482)/1024
    mesh.visual=trimesh.visual.texture.TextureVisuals(uv=np.stack([u,v],axis=1),material=MAT)
    G.add_geometry(mesh,node_name=name,geom_name=name)
    parts.append({'name':name,'triangles':int(len(mesh.faces)),'palette':palette})

def rings_along(points,radii,sides=8,phase=0):
    """Section-controlled anisotropic anatomical loft; point and each radius are xyz tuples."""
    pts=np.asarray(points,float); rr=np.asarray(radii,float)
    sections=[]
    for i,p in enumerate(pts):
        d=pts[min(i+1,len(pts)-1)]-pts[max(i-1,0)]
        d=d/(np.linalg.norm(d)+1e-12)
        guide=np.array([0.,0.,1.]) if abs(d[2])<.83 else np.array([0.,1.,0.])
        u=np.cross(d,guide);u=u/(np.linalg.norm(u)+1e-12)
        v=np.cross(d,u)
        t=np.linspace(0,2*np.pi,sides,endpoint=False)+phase
        ring=np.stack([p+rr[i,0]*math.cos(theta)*u+rr[i,1]*math.sin(theta)*v for theta in t]);sections.extend(ring)
    faces=[]
    for i in range(len(pts)-1):
        for j in range(sides):
            a=i*sides+j;b=i*sides+(j+1)%sides;c=(i+1)*sides+j;d=(i+1)*sides+(j+1)%sides
            if (i+j)%2==0:faces.extend([[a,c,b],[b,c,d]])
            else:faces.extend([[a,c,d],[a,d,b]])
    # end caps are deliberately faceted
    verts=np.array(sections)
    low=len(verts);verts=np.vstack([verts,pts[0],pts[-1]])
    for j in range(sides):
        faces.append([low,(j+1)%sides,j]);a=(len(pts)-1)*sides+j;b=(len(pts)-1)*sides+(j+1)%sides
        faces.append([low+1,a,b])
    m=trimesh.Trimesh(vertices=verts,faces=faces,process=False)
    trimesh.repair.fix_normals(m)
    return m

def limb(name,points,widths,cat=1,sides=7):
    return add(rings_along(points,[(x,x*.76) for x in widths],sides=sides,phase=.33),name,cat)

def conical(name,base,tip,rb,rt=.015,cat=3,sides=5):
    a=np.array(base,float);b=np.array(tip,float);delta=b-a
    p=[a,a+delta*.2,a+delta*.73,b];r=[(rb*.64,rb*.57),(rb,rb*.80),(rb*.30,rb*.27),(rt,rt)]
    add(rings_along(p,r,sides=sides),name,cat)

def sphere_facet(name,at,scale,cat=0,subdiv=1):
    m=trimesh.creation.icosphere(subdivisions=subdiv)
    m.vertices=m.vertices*np.array(scale)+np.array(at)
    add(m,name,cat)

# Ventral segmented protective abdomen, not a color overlay
shell=[([0,0.91,0.03],(0.82,0.57)),([0,1.03,.02],(.98,.76)),
       ([0,1.18,.02],(1.03,.92)),([0,1.41,.01],(1.08,.96)),
       ([0,1.63,.03],(1.01,.86)),([0,1.77,.08],(.79,.72)),
       ([0,1.89,.12],(.40,.40)),([0,1.92,.13],(.13,.13))]
# Horizontal crab-shell loft with ring sections in X-Z. The outline is scalloped.
verts=[];faces=[];sides=16
for i,(c,(rx,rz)) in enumerate(shell):
    for j in range(sides):
        t=(j/sides)*math.tau
        ripple=1+.035*math.sin(8*t+i*.22)
        verts.append([c[0]+rx*math.cos(t)*ripple,c[1]+.025*math.cos(6*t),c[2]+rz*math.sin(t)*ripple])
for i in range(len(shell)-1):
    for j in range(sides):
        a=i*sides+j;b=i*sides+(j+1)%sides;c=(i+1)*sides+j;d=(i+1)*sides+(j+1)%sides
        faces.extend([[a,b,c],[b,d,c]])
verts.extend([[0,.85,.01],[0,1.92,.13]])
for j in range(sides):
    faces.append([len(verts)-2,j,(j+1)%sides])
    a=(len(shell)-1)*sides+j;b=(len(shell)-1)*sides+(j+1)%sides
    faces.append([len(verts)-1,a,b])
add(trimesh.Trimesh(vertices=verts,faces=faces,process=False),'cephalothorax_carapace_primary',0)

# Carapace keels (raised load-bearing edges) and front brow
for sign,side in [(-1,'L'),(1,'R')]:
    limb('carapace_keel_'+side,[[sign*.40,1.75,.62],[sign*.76,1.66,.42],[sign*1.04,1.47,-.06],[sign*.85,1.43,-.72]], [.18,.19,.15,.10],4,6)
    limb('front_brow_'+side,[[sign*.09,1.62,-.88],[sign*.40,1.69,-.84],[sign*.83,1.58,-.68]], [.10,.15,.12],1,6)

# Segmented underside breastplates: each is physical ventral cuticle.
for i in range(5):
    z=-.63+i*.32
    add(rings_along([[0,.88,z-.1],[0,.81,z],[0,.88,z+.11]],[(.56,.085),(.66,.13),(.56,.08)],8,phase=.39),f'ventral_scutum_{i+1:02}',3)

# Defensive rim spines: required silhouette, not added for cosmetic coloring.
for s,side in [(-1,'L'),(1,'R')]:
    for j,z in enumerate([-.67,-.28,.12,.48,.78]):
        x=s*(.85+.17*math.cos(j*.6));y=1.54-(j*.018)
        conical(f'rim_spur_{side}_{j+1:02}',[x,y,z],[x+s*(.31 if j%2 else .26),y+.12,z+(.09 if j<3 else .17)],.11,.006,4)
    for j,z in enumerate([-.50,-.16,.20,.48]):
        x=s*(.48+.065*(j%2));y=1.82-.03*j
        conical(f'dorsal_spike_{side}_{j+1:02}',[x,y,z],[x+s*.15,y+.23-(j*.027),z+.09],.085,.006,1)

# Four distinct *walking* legs per side, each with 3 recognizable hinged regions.
for side in (-1,1):
    tag='L' if side<0 else 'R'
    for i,z0 in enumerate([-.57,-.19,.29,.68]):
        sx=side
        # splayed foreleg -> rear sweep. All feet rest at y >= 0.
        aft=[-.42,-.11,.34,.64][i]
        hip=np.array([sx*.78,1.21,z0])
        knee=np.array([sx*(1.18+.10*i),1.39 if i<2 else 1.31,z0+.02])
        elbow=np.array([sx*(1.76+.11*(i%2)),.79,z0+aft])
        foot=np.array([sx*(2.14+(.11 if i in (1,2) else -.07)),.095,z0+aft+.19])
        # femur is large, angular armored, tibia long and muscular, pointed sand foot
        limb(f'walk_{tag}{i+1}_coxa',[hip,hip*.30+knee*.70,knee],[.23,.28,.19],2)
        limb(f'walk_{tag}{i+1}_femur',[knee,knee*.48+elbow*.52,elbow],[.25,.26,.135],1)
        limb(f'walk_{tag}{i+1}_tibia',[elbow,elbow*.48+foot*.52,foot],[.17,.105,.053],4)
        end=foot+np.array([sx*.17,-.07,-.10])
        conical(f'walk_{tag}{i+1}_digging_claw',foot,end,.09,.009,3)
        sphere_facet(f'walk_{tag}{i+1}_hinge',[*knee],(.165,.14,.16),2,0)
        sphere_facet(f'walk_{tag}{i+1}_tarsal_hinge',[*elbow],(.155,.13,.15),2,0)
        # One structurally raised apophysis on each arm joint.
        tip=knee+np.array([sx*.045,.20,.055])
        conical(f'walk_{tag}{i+1}_spur',knee,tip,.11,.01,4)

# Huge asymmetrical pincers: primary crush claw left and fast slicing claw right.
for side,tag,factor in [(-1,'L',1.0),(1,'R',.79)]:
    # Articulated upper limb points to front rather than an impossible shoulder connection.
    sx=side
    shoulder=np.array([sx*.74,1.39,-.63])
    elbow=np.array([sx*(1.09+.18*factor),1.31,-1.06])
    wrist=np.array([sx*(1.34+.16*factor),1.75+(factor-.8)*.2,-1.38])
    limb(f'cheliped_{tag}_merus',[shoulder,shoulder*.44+elbow*.56,elbow],[.33*factor,.39*factor,.30*factor],2,9)
    sphere_facet(f'cheliped_{tag}_elbow',elbow,(.27*factor,.24*factor,.27*factor),2,1)
    limb(f'cheliped_{tag}_carpus',[elbow,elbow*.37+wrist*.63,wrist],[.33*factor,.35*factor,.39*factor],1,9)
    # Size of massive claw palm. Upper part thick, lower margin taper; 8-sided sections.
    x=sx*(1.34+.16*factor)
    yc=1.94+(factor-.8)*.22
    base=np.array([x,yc,-1.43]);palm=np.array([x+s*.09,yc+.16*factor,-1.80]);neck=np.array([x+s*.08,yc+.13*factor,-2.09])
    limb(f'chela_{tag}_palm',[wrist,base,palm,neck],[.36*factor,.51*factor,.46*factor,.28*factor],0,11)
    # Curved crushing upper pincer
    big=np.array([[x+s*.10,yc+.32*factor,-1.87],[x+s*.10,yc+.72*factor,-2.10],
                  [x+s*.06,yc+.82*factor,-2.52],[x+s*.05,yc+.60*factor,-2.81]])
    limb(f'chela_{tag}_fixed_finger',big,[.30*factor,.25*factor,.16*factor,.014],1,9)
    # Opposable (mobile) lower pincer, visibly separated from fixed one
    small=np.array([[x-s*.07,yc-.24*factor,-1.90],[x-s*.07,yc-.37*factor,-2.25],
                    [x-s*.05,yc-.29*factor,-2.59],[x-s*.06,yc+.04*factor,-2.80]])
    limb(f'chela_{tag}_opposing_finger',small,[.24*factor,.20*factor,.13*factor,.014],1,9)
    # Teeth point into the open gap; real serrated hard structures.
    for j in range(4):
        z=-2.19-j*.15
        u=(j+.5)/4
        p=big[1]*(1-u)+big[2]*u
        p[2]=z
        conical(f'chela_{tag}_upper_tooth_{j+1}',p,p+np.array([0,-.16*factor,-.03]),.07*factor,.004,3,5)
        p=small[1]*(1-u)+small[2]*u
        p[2]=z-.01
        conical(f'chela_{tag}_lower_tooth_{j+1}',p,p+np.array([0,.14*factor,-.03]),.063*factor,.004,3,5)
    # Shell spikes grow around the gripping palm with functional silhouettes.
    for j in range(4):
        p=np.array([x+s*(.17+.02*j),yc+.14+j*.08,-1.50-j*.13])
        conical(f'chela_{tag}_armored_spur_{j}',p,p+np.array([s*.18,.18,.03]),.10*factor,.006,4,5)

# Eye stalks and sensory feelers emerge from the front of the carapace.
for s,side in [(-1,'L'),(1,'R')]:
    limb('eyestalk_'+side,[[s*.27,1.68,-.85],[s*.29,1.84,-1.01],[s*.34,2.02,-1.10]], [.075,.069,.055],2,7)
    sphere_facet('compound_eye_'+side,[s*.35,2.07,-1.11],(.105,.125,.115),6,1)
    conical('eye_brow_spike_'+side,[s*.37,2.03,-1.16],[s*.46,2.25,-1.20],.052,.005,3)
    for j in range(2):
        p=[s*(.16+.17*j),1.56,-.91]
        q=[s*(.18+.22*j),1.45,-1.12]
        end=[s*(.20+.25*j),1.27,-1.21]
        limb(f'palp_{side}_{j}',[p,q,end],[.105,.088,.038],2,6)
    conical('facial_horn_'+side,[s*.58,1.66,-.77],[s*.80,1.98,-.97],.105,.007,4)

# Central multilobed oral apparatus, suited to tearing carrion.
for j in range(7):
    x=(j-3)*.125
    y=1.33-.10*abs(j-3)/3
    limb(f'oral_maxilliped_{j+1:02}',[[x*.65,y+.13,-.78],[x*1.1,y,-.98],[x*1.3,y-.16,-1.13]], [.105,.092,.022],2,6)
for i in range(5):
    x=(i-2)*.15
    conical(f'oral_cutting_tooth_{i}',[x,1.24,-1.04],[x*.94,1.10,-1.23],.065,.009,3,5)

GLB=OUT/'clavascarnio-v01-blockout.glb'
G.export(str(GLB))
# Validate the exact GLB by re-importing it, never just geometry before export.
reimport=trimesh.load(GLB,force='scene',process=False)
tri_import=sum(len(m.faces) for m in reimport.geometry.values())
tri_source=sum(x['triangles'] for x in parts)
assert tri_source==tri_import,(tri_source,tri_import)
assert tri_import>1500
assert reimport.bounds is not None
# Creature height is 3 m from sand to the tallest raised claw.
b=reimport.bounds; span=b[1]-b[0]
# Reposition all geometries uniformly so top = 3 m and feet at y~0.
# The independent conceptual 3m limit is more important than 2.4m on illustration.
scale=3.0/(span[1]); lower=b[0][1]
if abs(scale-1)>.001 or abs(lower)>.01:
    # y terrain rests at 0, uniform scale applies to all axes preserving proportions
    for node,child in list(G.graph.transforms.children.items()): pass
    for name in G.geometry:
        geom=G.geometry[name]
        geom.vertices=(geom.vertices-np.array([0,lower,0]))*scale
    G.export(str(GLB))
    reimport=trimesh.load(GLB,force='scene',process=False)
    tri_import=sum(len(m.faces) for m in reimport.geometry.values())
b=reimport.bounds;span=b[1]-b[0]
from collections import Counter
manifest={
 'species_id':'clavascarnio', 'name':'Clavascárnio — Caçador Couraçado das Dunas',
 'stage':'static blockout pending director form approval','version':'v01',
 'concept':'User-provided Clavascárnio illustration (approved 2026-11-12)',
 'reference':'Torvardo v03 with Mastélio v03 and Garruva v03 as secondary style examples',
 'asset':GLB.name,'bytes':GLB.stat().st_size,
 'sha256':hashlib.sha256(GLB.read_bytes()).hexdigest(),
 'meshes':len(reimport.geometry),'nodes':len(list(reimport.graph.nodes)),
 'triangles_source':tri_source,'triangles_reimported':tri_import,
 'joint_count':0,'skins':0,'animations':0,'LOD_levels':['blockout only'],
 'bounds_m':[[float(round(x,4)) for x in v] for v in b],
 'dimensions_m':{'width_x':round(float(span[0]),3),'height_y':round(float(span[1]),3),'length_z':round(float(span[2]),3)},
 'materials_uv':1,'texture_atlas':'clavascarnio-uv-v01.png',
 'parts':parts,
 'approval':{'concept':'approved','blockout':'pending','rig':'not started','final':'not started'},
 'integration':'Not integrated into Alpha or runtime.',
}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False),encoding='utf8')
print(json.dumps({k:v for k,v in manifest.items() if k not in ['parts']},indent=2,ensure_ascii=False))
