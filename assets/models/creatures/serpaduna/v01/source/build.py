#!/usr/bin/env python3
"""Serpáduna v01 - Wildhaven: anatomy-first STATIC blockout GLB.
One deformable tubular body, parametrized by arclength, intentionally without rig.
No geometry overlays to paint colors; blotches and ventral scutes live in UV map.
"""
from pathlib import Path
import json, hashlib, math
import numpy as np
from scipy.interpolate import CubicSpline
from scipy.spatial.transform import Rotation
from PIL import Image, ImageDraw, ImageFilter
import trimesh
from trimesh.visual.texture import TextureVisuals
from trimesh.visual.material import PBRMaterial

ROOT=Path(__file__).resolve().parent.parent
ROOT.mkdir(parents=True,exist_ok=True)
OUTPUT=ROOT/'serpaduna_v01_blockout.glb'
TEX=ROOT/'serpaduna_v01_uv_body.png'
RNG=np.random.default_rng(1112)

# Helper geometry: faceted mesh with UV material or solid color.
def faceted_mesh(v, f, color, name, uv=None, image=None):
    vertices=np.asarray(v,dtype=np.float64)
    faces=np.asarray(f,dtype=np.int64)
    mesh=trimesh.Trimesh(vertices=vertices,faces=faces,process=False,validate=False)
    if image is not None and uv is not None:
        material=PBRMaterial(name=name,baseColorFactor=[255,255,255,255],baseColorTexture=image,roughnessFactor=0.97,metallicFactor=0.)
        mesh.visual=TextureVisuals(uv=np.asarray(uv,dtype=np.float64),material=material)
    else:
        mesh.visual.vertex_colors=np.tile(np.array(color,dtype=np.uint8),(len(vertices),1))
    return mesh

def loft_sections(sections,N=10,color=[155,119,78,255],name='loft'):
    # sections: center x,y,z; width radius and vertical radius. UV not required.
    verts=[];fac=[]
    for x,y,z,wy,hz in sections:
        for j in range(N):
            a=2*np.pi*j/N
            verts.append([x,y+wy*np.sin(a),z+hz*np.cos(a)])
    for i in range(len(sections)-1):
        for j in range(N):
            j1=(j+1)%N
            a=i*N+j;b=i*N+j1;c=(i+1)*N+j1;d=(i+1)*N+j
            fac.extend([[a,b,c],[a,c,d]])
    fac.extend([[0,j+1,j] for j in range(1,N-1)])
    fac.extend([[(len(sections)-1)*N, (len(sections)-1)*N+j,(len(sections)-1)*N+j+1] for j in range(1,N-1)])
    return faceted_mesh(verts,fac,color,name)

def ellipsoid(center,radii,color,subdiv=1):
    m=trimesh.creation.icosphere(subdivisions=subdiv,radius=1.0)
    m.vertices=m.vertices*np.asarray(radii)+np.asarray(center)
    m.visual.vertex_colors=np.tile(np.array(color,dtype=np.uint8),(len(m.vertices),1))
    return m

def wedge(points, color):
    # irregular sharp plate from 3D triangle with thickened double surface
    a,b,c=np.array(points,dtype=float)
    n=np.cross(b-a,c-a);n=n/(np.linalg.norm(n)+1e-9)*.012
    v=[a+n,b+n,c+n,a-n,b-n,c-n]
    f=[[0,1,2],[5,4,3],[0,3,4],[0,4,1],[1,4,5],[1,5,2],[2,5,3],[2,3,0]]
    return faceted_mesh(v,f,color,'spike')

def tapered_curved_polyline(points,radii, color, sides=7):
    vertices=[];faces=[]
    P=np.array(points,dtype=float)
    for i,p in enumerate(P):
        tangent=(P[min(i+1,len(P)-1)]-P[max(0,i-1)])
        tangent=tangent/(np.linalg.norm(tangent)+1e-9)
        axis=np.cross(tangent,[0,0,1.])
        if np.linalg.norm(axis)<1e-3:axis=np.cross(tangent,[0,1.,0])
        axis/=np.linalg.norm(axis)
        axis2=np.cross(tangent,axis)
        for j in range(sides):
            a=2*np.pi*j/sides
            vertices.append(p+radii[i]*(np.cos(a)*axis+np.sin(a)*axis2))
        if i>0:
            for j in range(sides):
                j1=(j+1)%sides
                a=(i-1)*sides+j;b=(i-1)*sides+j1;c=i*sides+j1;d=i*sides+j
                faces.extend([[a,b,c],[a,c,d]])
    faces.extend([[0,j+1,j] for j in range(1,sides-1)])
    faces.extend([[(len(P)-1)*sides,(len(P)-1)*sides+j,(len(P)-1)*sides+j+1] for j in range(1,sides-1)])
    return faceted_mesh(vertices,faces,color,'taper')

# UV body texture, dorsal blotches, ventral scutes, fine scales -- all painted UV.
def make_texture():
    W,H=2048,1024
    im=Image.new('RGB',(W,H)); p=im.load()
    for yy in range(H):
        v=yy/H
        down=np.cos(2*np.pi*v)  # v=.5 is belly, v=0/1 is back
        if down<-.28:
            c=np.array([205,176,124])+int(11*(-down))
        else:
            c=np.array([149,122,82])+int(17*down)
        for xx in range(W):
            grain=(xx*19+yy*13)%43
            p[xx,yy]=tuple(np.uint8(np.clip(c+(grain-21)*.14,0,255)))
    d=ImageDraw.Draw(im,'RGB')
    # longitudinal angled scale seams on flanks, not polygon layering
    for ui in np.arange(.015,.995,.018):
        x=int(ui*W)
        for vi in np.arange(0,1,.052):
            yy=int(vi*H)
            if .27<vi<.73:
                if .33<vi<.66:
                    d.line([(x,yy),(x+26,yy+4)],fill=(170,139,96),width=2)
                continue
            d.line([(x,yy),(x+18,yy+14),(x+2,yy+29)],fill=(111,91,60),width=2)
            d.line([(x+20,yy+15),(x+37,yy+1)],fill=(206,174,117),width=2)
    # broad round-irregular patch clusters on dorsal half, wrapping UV seam
    for u in np.linspace(.13,.91,21):
        shift=RNG.normal(0,.009)
        for center_v in [0.08,.91]:
            v=float(center_v+RNG.normal(0,.028))
            rux=float(RNG.uniform(.015,.027))*W
            rvy=float(RNG.uniform(.052,.085))*H
            x=(u+shift)*W;y=v*H
            vertices=[]
            count=11
            for i in range(count):
                a=2*np.pi*i/count
                rr=float(RNG.uniform(.78,1.19))
                vertices.append((int(x+np.cos(a)*rux*rr),int(y+np.sin(a)*rvy*rr)))
            shade=int(RNG.integers(81,111))
            d.polygon(vertices,fill=(shade+15,shade+10,shade+2))
            d.line(vertices+[vertices[0]],fill=(93,75,51),width=3)
    # scattered small diamond scale speckles
    for k in range(1700):
        xx=int(RNG.integers(5,W-5));yy=int(RNG.integers(4,H-4))
        v=yy/H
        if .3<v<.7:continue
        c=(118,98,68) if RNG.random()<.5 else (193,161,108)
        r=int(RNG.integers(1,4))
        d.line((xx-r,yy,xx,yy-r,xx+r,yy),fill=c,width=1)
    # ventral scutes crosswise, alternating dark borders
    for u in np.arange(.06,1.,.018):
        x=int(u*W)
        d.line((x,int(H*.35),x+9,int(H*.65)),fill=(155,124,82),width=3)
        d.line((x+4,int(H*.38),x+13,int(H*.62)),fill=(233,202,150),width=2)
    im.save(TEX)
    return im
tex=make_texture()

# A 1.25-turn tapered dune coil leading to a lifted neck. Arc-length driven spine.
t=np.linspace(0,1,172)
a=.54+2.58*np.pi*t
r=2.35-1.50*t
xy=np.column_stack([r*np.cos(a),r*np.sin(a)])
raw=np.column_stack([xy,np.full_like(t,.43)])
# Raised neck: from coil toward front, continuous in space.
neck=np.array([
    [-.16,.71,.46],[-.57,.55,.54],[-.95,.23,.80],[-1.25,.08,1.18],[-1.35,.03,1.65],[-1.36,.02,2.10]
])
# End spiral point shall join neck start smoothly (offset neck to exact endpoint)
neck[:,0]+=raw[-1,0]-neck[0,0]
neck[:,1]+=raw[-1,1]-neck[0,1]
raw=np.vstack((raw,neck[1:]))
# cubic spline by chord parameter, resample uniformly by arc length
step=np.linalg.norm(np.diff(raw,axis=0),axis=1)
chord=np.r_[0,np.cumsum(step)]
sp=CubicSpline(chord,raw,axis=0,bc_type='natural')
proto=sp(np.linspace(0,chord[-1],1600))
s=np.r_[0,np.cumsum(np.linalg.norm(np.diff(proto,axis=0),axis=1))]
arc_total=s[-1]
# Skull tip adds about .88m to the 15m total length.
scale=14.12/arc_total
# Scale around coil middle; keep standing neck natural in dimensions
proto=proto*scale
s=np.r_[0,np.cumsum(np.linalg.norm(np.diff(proto,axis=0),axis=1))]
length=s[-1]
ns=190
samp=np.linspace(0,length,ns)
path=np.column_stack([np.interp(samp,s,proto[:,j]) for j in range(3)])
# numerical tangents and stable normals for a continuous skin
T=np.gradient(path,axis=0)
T/=np.linalg.norm(T,axis=1)[:,None]
Side=np.zeros_like(T); Up=np.zeros_like(T)
for i in range(ns):
    tvec=T[i]
    # keep side vector in horizontal plane for stable upright underside through neck
    side=np.cross([0,0,1],tvec)
    if np.linalg.norm(side)<.035:
        side=Side[i-1] if i else np.array([0,1,0])
    side/=np.linalg.norm(side)
    up=np.cross(tvec,side)
    up/=np.linalg.norm(up)
    if up[2]<0 and i<ns-25:up=-up;side=-side
    Side[i]=side;Up[i]=up
N=16
v=[];f=[];uv=[]
for i,(p,st) in enumerate(zip(path,samp)):
    q=st/length
    # long heavy muscular trunk; sharpen tail, wider shoulder before skull
    tail_envelope=np.clip((q+.015)/.12,0,1)**.72
    rad=(.42*(1-.16*q)+.09*np.exp(-((q-.65)/.25)**2))*tail_envelope
    rad*= (1-.18*np.clip((q-.94)/.06,0,1))
    for j in range(N+1): # duplicate seam vertices for UV, same position -> still single anatomical body
        angle=2*np.pi*j/N
        dorsal=max(0,np.cos(angle))
        scute=.012*np.cos(st*35)*dorsal
        # slightly pentagonal dorsal rings, functional ridges in silhouette
        rr=rad*(1+.048*np.cos(5*angle)*max(0,dorsal)) + scute
        point=p+rr*(np.sin(angle)*Side[i]+.83*np.cos(angle)*Up[i])
        v.append(point)
        uv.append([q,j/N])
for i in range(ns-1):
    for j in range(N):
        a=i*(N+1)+j;b=a+1;c=(i+1)*(N+1)+j+1;d=(i+1)*(N+1)+j
        f.extend([[a,c,b],[a,d,c]])
# close ends (topological seam duplicated for UV, visually watertight)
f.extend([[0,j+1,j] for j in range(1,N-1)])
f.extend([[(ns-1)*(N+1),(ns-1)*(N+1)+j,(ns-1)*(N+1)+j+1] for j in range(1,N-1)])
body=faceted_mesh(v,f,[164,139,101,255],'BodyUV',uv,tex)

# Skull attached at endpoint. Face points toward negative X; earth-toned faceted cranial plates.
end=path[-1]
# skeleton head joint at end; custom x sections anchored to neck. Head length .88m
hx,hy,hz=end
head_sections=[]
for dx,wy,hgt,cz in [
    (.12,.24,.28,.03),(.0,.39,.35,.07),(-.18,.48,.39,.09),(-.42,.52,.34,.04),
    (-.66,.42,.28,-.02),(-.88,.27,.22,-.09),(-.97,.20,.18,-.11)]:
    head_sections.append([hx+dx,hy,hz+cz,wy,hgt*.60])
head=loft_sections(head_sections,12,[139,110,70,255],'cranial-loft')

# Short angular brow ridges create the bony triangular viper silhouette.
cranium=[]
for ysign in (-1,1):
    for i,(dx,sz) in enumerate([(-.15,.095),(-.33,.10),(-.51,.075),(-.73,.045)]):
        xc=hx+dx
        outer=hy+ysign*(.33 if i<2 else .26)
        cranium.append(wedge([[xc,outer,hz+.31],[xc+.20,outer+ysign*.12,hz+.21],[xc-.11,outer+ysign*.045,hz+.12]],[109,86,59,255]))
# forehead broad flat armored crest scales: actual raised geometry with sculptural role
for i in range(3):
    dx=-.10-i*.22
    cranium.append(wedge([[hx+dx,hy,hz+.32],[hx+dx-.17,hy-.22,hz+.22],[hx+dx-.17,hy+.22,hz+.22]],[162-i*7,134-i*4,87-i*5,255]))

# Lower jaw is a separate articulable anatomical element, static open pose only.
jawsecs=[]
for dx,wy,hgt,zshift in [(0,.24,.09,-.22),(-.25,.37,.10,-.39),(-.54,.30,.08,-.56),(-.88,.17,.075,-.66),(-.96,.11,.065,-.66)]:
    jawsecs.append([hx+dx,hy,hz+zshift,wy,hgt])
jaw=loft_sections(jawsecs,10,[158,118,75,255],'lower-jaw')
# Mouth cavity velvety burgundy tapering from open hinge to gape.
upper=np.array([hx-.82,hy,hz-.21]); hinge=np.array([hx-.15,hy,hz-.20]); lower=np.array([hx-.82,hy,hz-.62])
mouth=[]
for sign in (-1,1):
    mouth.append(wedge([
        [hx-.23,hy+sign*.31,hz-.22],
        [hx-.87,hy+sign*.17,hz-.24],
        [hx-.86,hy+sign*.15,hz-.59]], [60,27,32,255]))
# Inner tongue / throat in pale wine color
throat=ellipsoid([hx-.48,hy,hz-.34],[.32,.24,.12],[117,42,49,255],subdiv=1)

# Eye sockets and golden vertical-slit eyes visible on both sides.
eyes=[]
for side in (-1,1):
    eye_center=[hx-.41,hy+side*.446,hz+.16]
    eyes.append(ellipsoid(eye_center,[.105,.040,.091],[49,38,30,255],1))
    eyes.append(ellipsoid([eye_center[0]-.006,eye_center[1]+side*.039,eye_center[2]],[.068,.023,.063],[228,166,58,255],2))
    eyes.append(ellipsoid([eye_center[0]-.008,eye_center[1]+side*.060,eye_center[2]],[.014,.009,.049],[33,25,18,255],1))
    # shallow nostril on tapered muzzle
    eyes.append(ellipsoid([hx-.87,hy+side*.24,hz-.04],[.037,.020,.028],[51,41,31,255],1))

# Functional venom fangs: paired enlarged teeth, with smaller staggered tooth row.
teeth=[]
for side in (-1,1):
    y=hy+side*.245
    teeth.append(tapered_curved_polyline([
        [hx-.73,y,hz-.19], [hx-.77,y+side*.018,hz-.35],
        [hx-.79,y+side*.018,hz-.47]], [.058,.041,.003],[238,215,169,255],7))
    # four maxillary side teeth
    for j in range(4):
        x=hx-.23-j*.12
        yy=hy+side*(.38-.037*j)
        teeth.append(tapered_curved_polyline([[x,yy,hz-.18],[x-.027,yy,hz-.25-j*.012]],
                                             [.028,.002],[226,203,158,255],5))
    for j in range(4):
        x=hx-.30-j*.13
        yy=hy+side*(.32-.04*j)
        teeth.append(tapered_curved_polyline([[x,yy,hz-.40-j*.035],[x-.012,yy,hz-.30-j*.025]],
                                             [.019,.001],[220,194,148,255],5))
# Thin forked tongue curling out of open mouth, no snake arms!
tongue=tapered_curved_polyline([
    [hx-.49,hy,hz-.38],[hx-.91,hy,hz-.45],[hx-1.12,hy,hz-.47],
    [hx-1.28,hy,hz-.43]], [.046,.036,.026,.014],[112,52,60,255],6)
forks=[]
for side in (-1,1):
    forks.append(tapered_curved_polyline([
        [hx-1.26,hy,hz-.43],[hx-1.43,hy+side*.10,hz-.44],[hx-1.54,hy+side*.18,hz-.49]],
        [.019,.012,.002],[107,45,55,255],5))

# True dorsal defensive tail-point spikes, 5 integrated small low-poly cones.
tail_spines=[]
for i in range(5):
    idx=3+i*5
    p=path[idx];dz=Up[idx]
    length_sp=.11+.045*i
    base=p+dz*(.11+.06*i)
    tip=base+dz*length_sp+Side[idx]*(.12 if i%2 else -.10)
    tail_spines.append(tapered_curved_polyline([base,base+(tip-base)*.50,tip],
                             [.060,.038,.002],[119,96,68,255],5))

# Separate meaningful surfaces allowed: articulated jaw, eyes, fangs, plates.
scene=trimesh.Scene()
scene.add_geometry(body,geom_name='BodyContinuousUV',node_name='body_deformable_static')
scene.add_geometry(head,geom_name='Skull',node_name='skull')
scene.add_geometry(jaw,geom_name='Jaw',node_name='lower_jaw_articulatable')
scene.add_geometry(throat,geom_name='Throat',node_name='mouth_palate')
for i,g in enumerate([*cranium,*mouth,*eyes,*teeth,tongue,*forks,*tail_spines]):
    scene.add_geometry(g,geom_name=f'anatomical_detail_{i:03}',node_name=f'detail_{i:03}')
scene.export(OUTPUT,file_type='glb')
# Independent exported artifact reopening/mesh count; don't count static nodes as bones.
loaded=trimesh.load(OUTPUT,force='scene')
tris=sum(len(m.faces) for m in loaded.geometry.values())
sha=hashlib.sha256(OUTPUT.read_bytes()).hexdigest()
meta={
 'species_id':'serpaduna', 'version':'v01','stage':'blockout_statico','concept_approved':True,
 'blockout_form_approved':False,'real_glb':OUTPUT.name,
 'path':'assets/models/creatures/serpaduna/v01/'+OUTPUT.name,
 'bytes':OUTPUT.stat().st_size,'sha256':sha,
 'mesh_count':len(loaded.geometry),'triangles_exported_mesh_definitions':tris,
 'scene_graph_nodes':len(loaded.graph.nodes),'skins':0,'joints':0,'animation_clips':0,
 'body_mesh_geometry':'single continuous cross-section loft; seam duplicated for UV, static',
 'scale':'meters; spine from tail to skull ~14.12m plus cranium ~0.97m',
 'uv_texture':TEX.name,'UV_paint_only_for_coloration':True,
 'concept_source':'approved user supplied 75661.png; size override 15m',
 'locomotion_design':'future long axial rig + spline IK / parallel transport; surface deformation, ventral grip; not yet implemented',
 'alpha_modified':False,'lods_at_stage':[]}
(ROOT/'manifest.json').write_text(json.dumps(meta,indent=2,ensure_ascii=False),encoding='utf-8')
print(json.dumps(meta,indent=2,ensure_ascii=False))
