#!/usr/bin/env python3
"""Brejaveo v03 Wildhaven: real static anatomical blockout glTF/GLB.
Coordinate system: X positive backwards, Y lateral, Z upwards (meters).
Single painted UV atlas for body patterns and wing membrane colors; no decorative color meshes.
"""
from __future__ import annotations
import math, json, hashlib, random
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import trimesh
from trimesh.visual.texture import TextureVisuals
from trimesh.visual.material import PBRMaterial

ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'brejaveo-v03-anatomia-blockout.glb'
TEX=ROOT/'textures/brejaveo-v03-atlas-uv.png'
RNG=random.Random(9327)
S=1024

def paint_atlas():
    """Organic painted UV atlas, color only in UV, geometry only for anatomy."""
    yy,xx=np.mgrid[0:S,0:S]
    img=np.zeros((S,S,3),dtype=np.uint8)
    u=xx/510.;v=yy/S
    dorsal=np.minimum(v,1-v)
    under=np.clip((dorsal-.285)/.165,0,1)
    # olive green mantle + pale underside + deep wine dorsal markings
    top=np.stack((84+12*u+6*np.cos(u*8),133+13*u+5*np.cos(u*9),43+8*u),axis=-1)
    vent=np.stack((200+6*u,183+5*u,148+5*u),axis=-1)
    c=top*(1-under[:,:,None])+vent*under[:,:,None]
    noise=3.0*np.sin(31*u+39*v)+2.8*np.cos(67*u-22*v)+2.0*np.sin(97*u+43*v)
    c+=noise[:,:,None]
    c=np.clip(c,0,255).astype(np.uint8)
    img[:]=c
    w=(xx>=512);wU=np.clip((xx-512)/511,0,1);wV=yy/1023
    orange=np.stack((238-20*wV+9*np.sin(5*wU),159-39*wV+13*wU,57-16*wV+9*wU),axis=-1)
    img[w]=np.clip(orange[w],0,255).astype(np.uint8)
    im=Image.fromarray(img,'RGB');d=ImageDraw.Draw(im)
    # Dorsal plum mottles, patches shaped like scales not simple circles
    for _ in range(155):
        u0=RNG.randint(18,495);v0=RNG.randint(0,1005)
        t=min(v0,1024-v0)/1024
        if t>.27:continue
        rx=RNG.randint(8,35); ry=RNG.randint(4,17)
        shade=RNG.choice([(79,58,77),(95,52,72),(56,56,58),(108,68,77),(66,60,67)])
        pts=[(u0-rx,v0-ry*.25),(u0-rx*.35,v0-ry),(u0+rx*.60,v0-ry*.8),
             (u0+rx,v0),(u0+rx*.24,v0+ry),(u0-rx*.55,v0+ry*.65)]
        d.polygon(pts,fill=shade)
    # Under the lizard's spine: broad plum stripes and olive broken streaks
    for j in range(17):
        x=35+j*27; s=RNG.randint(6,16)
        if x>505:continue
        for y in (RNG.randint(9,45),RNG.randint(974,1012)):
            d.polygon([(x,y),(x+s,y-4),(x+s+9,y+4),(x+2,y+9)], fill=(81,61,78))
    for _ in range(180):
        x=RNG.randint(20,503);y=RNG.randint(0,1023)
        if min(y,1023-y)/1024>.29:continue
        r=RNG.randint(1,5)
        d.ellipse((x-r,y-r*.5,x+r,y+r*.5),fill=(151,181,75))
    # Membrane veins painted into UV: they ARE NOT independent meshes
    for k in range(10):
        px=540+35*k
        d.line([(px,1023),(px+47,760),(px+110,345),(1000,40)],fill=(189,95,32),width=3)
    for _ in range(110):
        x=RNG.randint(526,1013);y=RNG.randint(8,1015)
        r=RNG.randint(1,3)
        d.ellipse((x-r,y-r,x+r,y+r),fill=(203,111,42))
    im.save(TEX)
    return im
ATLAS=paint_atlas()
MATERIAL=PBRMaterial(name='Brejaveo_UV_pintada',baseColorTexture=ATLAS,metallicFactor=0,roughnessFactor=.91,doubleSided=True)
materials={}

def flat_material(name,rgba):
    if name not in materials:
        materials[name]=PBRMaterial(name=name,baseColorFactor=list(rgba),metallicFactor=0,roughnessFactor=.86,doubleSided=True)
    return materials[name]

def mesh(name,verts,faces,uvs=None,mat='skin',rgb=None):
    v=np.asarray(verts,dtype=np.float64); f=np.asarray(faces,dtype=np.int64)
    if len(v)==0 or len(f)==0:return
    if uvs is None: uvs=np.tile([.2,.12],(len(v),1))
    # trimesh may merge UV seams unless process False
    m=trimesh.Trimesh(vertices=v,faces=f,process=False,validate=False)
    m.visual=TextureVisuals(uv=np.asarray(uvs,dtype=np.float64), material=MATERIAL if mat in ('skin','wing') else flat_material(mat, rgb if rgb is not None else ((.72,.66,.51,1) if mat=='jaw' else (.70,.63,.48,1))))
    PARTS.append((name,m))

PARTS=[]

def ring_x(name,sections,n=12,mat='skin',skin_u_min=.035,skin_u_max=.46,uv_phase=0):
    # (x, z_center, side_radius, vertical_radius) and anatomical sectional transitions.
    V=[];UV=[];F=[]
    x0=sections[0][0];x1=sections[-1][0]
    for ix,(x,z,ry,rz) in enumerate(sections):
        for j in range(n+1):
            theta=2*math.pi*j/n; # top at theta=0
            V.append((x,ry*math.sin(theta),z+rz*math.cos(theta)))
            u=(x-x0)/(x1-x0+1e-9)
            UV.append((skin_u_min+(skin_u_max-skin_u_min)*u,(j/n+uv_phase)%1.00000001))
    for k in range(len(sections)-1):
        for j in range(n):
            a=k*(n+1)+j;b=a+1;c=(k+1)*(n+1)+j;d=c+1
            F.extend(((a,c,b),(b,c,d)))
    # Cap strip with geometry at each end
    for end in [0,len(sections)-1]:
        x,z,_,_=sections[end];ci=len(V);V.append((x,0,z));UV.append((.21,.46))
        for j in range(n):
            a=end*(n+1)+j;b=a+1
            F.append((ci,a,b) if end==0 else (ci,b,a))
    mesh(name,V,F,UV,mat)

def ring_path(name,centers,radii,n=9,mat='skin',u0=.1,u1=.44):
    p=np.asarray(centers,float); V=[];F=[];UV=[]
    for ix,(center,r) in enumerate(zip(p,radii)):
        tangent=p[min(ix+1,len(p)-1)]-p[max(0,ix-1)]
        tangent/=max(1e-8,np.linalg.norm(tangent)); helper=np.array([0,0,1.0])
        if abs(np.dot(tangent,helper))>.9:helper=np.array([0,1.,0])
        A=np.cross(tangent,helper);A/=np.linalg.norm(A);B=np.cross(tangent,A)
        for j in range(n+1):
            a=2*math.pi*j/n
            V.append((center+r*math.cos(a)*A+r*math.sin(a)*B).tolist())
            UV.append((u0+(u1-u0)*ix/(len(p)-1),.085 + .04*math.sin(2*math.pi*j/n)))
    for k in range(len(p)-1):
        for j in range(n):
            a=k*(n+1)+j;b=a+1;c=(k+1)*(n+1)+j;d=c+1
            F.extend(((a,c,b),(b,c,d)))
    mesh(name,V,F,UV,mat)

def prism(name,pts,thickness,mat='bone',rgb=None):
    pts=np.array(pts,float); n=len(pts); centroid=pts.mean(axis=0)
    # offset outwards in z to create a faceted thin plate
    v=np.vstack((pts,pts+np.array([0,0,thickness])))
    f=[]
    for i in range(1,n-1): f.extend(((0,i,i+1),(n,n+i+1,n+i)))
    for i in range(n):j=(i+1)%n;f.extend(((i,j,n+i),(j,n+j,n+i)))
    mesh(name,v,f,mat=mat,rgb=rgb)

def cone_tube(name,points,radii,mat='skin',rgb=None,n=7):
    p=np.array(points,float);rads=np.array(radii,float)
    V=[];F=[];UV=[]
    for i,c in enumerate(p):
        t=p[min(i+1,len(p)-1)]-p[max(0,i-1)]
        t/=np.linalg.norm(t)
        h=np.array([0,0,1.0]);
        if abs(np.dot(t,h))>.93:h=np.array([0,1.0,0])
        a=np.cross(t,h);a/=np.linalg.norm(a);b=np.cross(t,a)
        for j in range(n):
            an=2*np.pi*j/n;V.append((c+rads[i]*(math.cos(an)*a+math.sin(an)*b)).tolist());UV.append((.14+j/n*.05,.10))
    for i in range(len(p)-1):
        for j in range(n):
            a=i*n+j;b=i*n+(j+1)%n;c=(i+1)*n+j;d=(i+1)*n+(j+1)%n
            F.extend(((a,b,c),(b,d,c)))
    for i in range(1,n-1):F.extend(((0,i+1,i),((len(p)-1)*n,(len(p)-1)*n+i,(len(p)-1)*n+i+1)))
    mesh(name,V,F,UV,mat=mat,rgb=rgb)

def ellipsoid(name,center,radii,mat,rgb,sub=(10,6),rotate=0):
    n,m=sub;v=[];uv=[];f=[]
    for iy in range(1,m):
        th=math.pi*iy/m
        for ix in range(n):
            ph=2*math.pi*ix/n
            v.append((center[0]+radii[0]*math.sin(th)*math.cos(ph),center[1]+radii[1]*math.sin(th)*math.sin(ph),center[2]+radii[2]*math.cos(th)))
            uv.append((ix/n,iy/m))
    v.extend([(center[0],center[1],center[2]+radii[2]),(center[0],center[1],center[2]-radii[2])]);uv.extend([(.5,0),(.5,1)])
    top=len(v)-2;btm=len(v)-1
    for ix in range(n):f.append((top,ix,(ix+1)%n));f.append((btm,(m-2)*n+(ix+1)%n,(m-2)*n+ix))
    for j in range(m-2):
        for i in range(n):a=j*n+i;b=j*n+(i+1)%n;c=(j+1)*n+i;d=(j+1)*n+(i+1)%n;f.extend(((a,c,b),(b,c,d)))
    mesh(name,v,f,uv,mat,rgb)

def wing_panel(name,outline,side):
    # Outline is anatomical panels between shoulder, elbow, carpal tip and shoulder edge.
    # Synthetic triangulated membrane, UV all colors in wing texture region. No fake color mesh.
    # Use central fabric tension center for several triangular planes; no coincident duplicates.
    p=np.array(outline,float)
    c=p.mean(axis=0);c[2]+=0.035
    v=p.tolist()+[c.tolist()];UV=[]
    for k in range(len(p)):
        UV.append((.56+.38*(k%3)/2,.13+.77*(k//3)/2 if k<6 else .87))
    UV.append((.72,.55))
    f=[]
    for i in range(len(p)):
        f.append((i,(i+1)%len(p),len(p)))
    mesh(name,v,f,UV,'wing')


# BREJÁVEO v03 — sculpted replacement, NOT a reskin of the rejected v01.
# X-negative = snout forward; Y sideways; Z up. Terrestrial crouched wing pose.
# Green and purple regions are exclusively paint on the shared UV atlas.

ring_x('01_torso_arched_robust',[
 (-1.47,1.42,.26,.30),(-1.27,1.40,.42,.37),(-.99,1.35,.54,.43),
 (-.64,1.32,.61,.45),(-.21,1.28,.59,.44),(.22,1.29,.54,.44),
 (.65,1.28,.51,.40),(.98,1.25,.44,.34),(1.25,1.20,.31,.26),
 (1.44,1.19,.22,.20)
],n=16)
# Neck and skull designed to meet, avoiding disjoint cylindrical hinges
ring_x('02_neck_muscular_flattened',[
 (-2.41,1.62,.235,.22),(-2.23,1.61,.295,.25),(-2.06,1.57,.31,.27),
 (-1.80,1.51,.34,.29),(-1.53,1.45,.42,.33),(-1.36,1.42,.42,.34)
],n=14)
ring_x('03_tail_base_continuous',[
 (1.30,1.19,.285,.24),(1.53,1.15,.265,.225),(1.76,1.16,.23,.2),
 (2.04,1.20,.195,.155),(2.33,1.28,.15,.125),(2.61,1.34,.103,.093),
 (2.83,1.40,.06,.055),(3.01,1.46,.022,.023)
],n=12)
ring_x('04_skull_lean_wedge',[
 (-3.11,1.57,.11,.11),(-3.00,1.62,.18,.145),(-2.85,1.67,.235,.18),
 (-2.65,1.74,.30,.215),(-2.48,1.77,.33,.235),(-2.30,1.72,.29,.23),
 (-2.18,1.65,.22,.18)
],n=14)
# Sharp upper mandible crest and pale articulated lower jaw (bone is actual anatomical volume).
ring_x('05_brow_and_nasal_bridge',[
 (-3.14,1.65,.075,.066),(-3.02,1.69,.18,.075),(-2.85,1.77,.235,.10),
 (-2.66,1.83,.277,.105),(-2.52,1.83,.255,.09)
],n=12)
ring_x('06_mandible_bone_lower',[
 (-3.10,1.44,.12,.059),(-2.93,1.44,.184,.075),(-2.73,1.47,.235,.08),
 (-2.53,1.52,.26,.095),(-2.30,1.56,.24,.11),(-2.13,1.61,.18,.10)
],n=12,mat='jaw',skin_u_min=.10,skin_u_max=.38)
# Throat follows underside, broad enough for swallowing prey after tongue grapple.
ring_x('07_gular_swallowing_pouch',[
 (-2.28,1.42,.19,.08),(-2.05,1.36,.26,.145),(-1.83,1.33,.29,.19),
 (-1.61,1.31,.33,.18),(-1.42,1.30,.31,.13)
],n=12)
# Tongue is folded inside oral cavity in the neutral blockout, not a long exterior spike.
cone_tube('08_rolled_tongue',[
 (-2.15,0,1.49),(-2.36,0,1.48),(-2.60,0,1.47),(-2.78,0,1.48)
],[.075,.085,.07,.025],mat='tongue',rgb=(.48,.14,.22,1),n=9)

# Eye is recessed with a brow bridge, horn sweeps back, and cheek tapers into throat.
for side,tag in [(-1,'R'),(1,'L')]:
 def p(x,y,z):return (x,side*y,z)
 # A low profile socket and layered eye set INTO the head, not perched on top.
 ellipsoid('09_angular_eye_socket_'+tag,p(-2.67,.264,1.817),(.145,.044,.102),'socket',(.20,.17,.13,1),sub=(12,7))
 ellipsoid('10_gold_iris_'+tag,p(-2.692,.297,1.830),(.084,.026,.068),'iris',(.87,.62,.16,1),sub=(11,7))
 ellipsoid('11_black_pupil_'+tag,p(-2.702,.318,1.834),(.030,.012,.054),'pupil',(.045,.052,.030,1),sub=(9,6))
 # Brow is part of the orbital rim and protects the inset eye.
 cone_tube('12_orbital_ridge_'+tag,[p(-2.86,.245,1.85),p(-2.68,.305,1.935),p(-2.45,.29,1.91)],
           [.047,.085,.020],mat='brow',rgb=(.31,.36,.18,1),n=9)
 # Two back-swept keratin crests, elegant and asymmetric to body length.
 cone_tube('13_swept_forehorn_'+tag,[p(-2.85,.19,1.81),p(-2.75,.27,2.02),p(-2.57,.31,2.19),p(-2.36,.34,2.20),p(-2.22,.40,2.21)],
           [.095,.087,.060,.036,.004],mat='horn',rgb=(.31,.34,.19,1),n=9)
 cone_tube('14_swept_temporal_horn_'+tag,[p(-2.43,.265,1.89),p(-2.26,.35,2.03),p(-2.07,.37,2.02),p(-1.98,.41,2.03)],
           [.060,.049,.027,.004],mat='horn',rgb=(.23,.28,.18,1),n=8)
 cone_tube('15_cheek_bony_shelf_'+tag,[p(-2.54,.255,1.57),p(-2.36,.28,1.55),p(-2.12,.26,1.52)],
           [.043,.053,.007],mat='cheek',rgb=(.57,.53,.40,1),n=8)
 ellipsoid('16_nostril_'+tag,p(-3.026,.154,1.708),(.038,.014,.017),'nostril',(.11,.12,.085,1),sub=(8,6))
 # A sparse interlocking tooth set rather than a comb of oversized fangs.
 for j,(xx,yy) in enumerate([(-2.98,.13),(-2.76,.21),(-2.53,.25)]):
  cone_tube(f'17_upper_tooth_{tag}_{j}',[p(xx,yy,1.51),p(xx-.04,yy,1.435)],
            [.029,.003],mat='tooth',rgb=(.79,.76,.64,1),n=6)
 for j,(xx,yy) in enumerate([(-2.87,.17),(-2.63,.23)]):
  cone_tube(f'18_lower_tooth_{tag}_{j}',[p(xx,yy,1.488),p(xx-.045,yy,1.555)],
            [.025,.003],mat='tooth',rgb=(.76,.74,.63,1),n=6)

# Broad, tensed hindquarters with angled shins and rooted toes, suitable for wet mud.
for side,tag in [(-1,'R'),(1,'L')]:
 def p(x,y,z):return (x,side*y,z)
 ring_path('19_one_continuous_hindleg_'+tag,
           [p(.88,.43,1.29),p(.97,.58,1.11),p(1.08,.68,.90),
            p(1.15,.76,.72),p(1.29,.82,.48),p(1.22,.86,.28),
            p(.97,.89,.17),p(.73,.95,.115)],
           [.36,.32,.255,.205,.155,.132,.127,.108],n=12)
 for j in range(4):
  yy=.68+.16*j
  toe_x=.65-.075*j
  cone_tube(f'22_wide_hind_toe_{tag}_{j}',[p(.74,yy,.12),p(toe_x-.17,yy,.078),p(toe_x-.35,yy+(j-1.5)*.055,.062)],
            [.093,.075,.027],n=7)
  cone_tube(f'23_keratin_hind_claw_{tag}_{j}',[p(toe_x-.34,yy,.068),p(toe_x-.45,yy,.052),p(toe_x-.51,yy,.025)],
            [.052,.026,.003],mat='claw',rgb=(.18,.17,.13,1),n=6)

# Winged quadrupedal forelegs: ONE anatomical arm / foreleg per side.
# The folded membrane sweeps backward from shoulder/arm and stays close to the back.
# No extra tiny arms below the wings, and no triangular upright 'sails'.
def membrane(name, pts,uv=None):
 # Triangulate non-convex 3D fan from a physically supported mid-patch node.
 P=np.asarray(pts,float)
 mid=P.mean(axis=0); mid[2]+=.045
 V=np.vstack([P,mid]); N=len(P)
 if uv is None:
  U=np.asarray([(0.53+0.44*(i/N),.15+.68*((i*3)%N)/N) for i in range(N)] +[(.73,.59)],float)
 else:U=np.asarray(uv,float)
 F=[(i,(i+1)%N,N) for i in range(N)]
 mesh(name,V,F,U,'wing')

for side,tag in [(-1,'R'),(1,'L')]:
 def p(x,y,z):return (x,side*y,z)
 shoulder=p(-1.16,.48,1.57)
 shoulder2=p(-1.27,.63,1.37)
 elbow=p(-1.39,.89,.92)
 carpal=p(-1.59,1.27,.24)
 tip1=p(-1.74,1.40,.105)
 # Strengthened scapula, continuous humerus and forearm lowered like the concept.
 ring_path('24_single_foreleg_shoulder_to_wrist_'+tag,
           [shoulder,p(-1.30,.65,1.39),p(-1.39,.84,1.14),elbow,
            p(-1.44,1.02,.71),p(-1.49,1.12,.52),carpal],
           [.28,.235,.188,.17,.15,.139,.113],n=12)
 # Functional wrist webbed fingers bear weight, claws curve downward.
 for j in range(3):
  yy=1.20+j*.135
  xx=-1.78-.09*j
  cone_tube(f'26_ground_finger_{tag}_{j}',[carpal,p(xx+.14,yy,.13),p(xx,yy,.07)],
            [.083,.065,.026],n=8)
  cone_tube(f'27_ground_finger_claw_{tag}_{j}',[p(xx,yy,.07),p(xx-.12,yy,.055),p(xx-.18,yy,.022)],
            [.045,.026,.003],mat='claw',rgb=(.18,.17,.14,1),n=6)
 # The core wing spar grows from the same forelimb. Curved backwards over thorax.
 spur0=p(-1.18,.64,1.51)
 spur1=p(-.64,1.22,1.84)
 spur2=p(.05,1.64,1.70)
 spur3=p(.58,1.63,1.48)
 rear0=p(.66,.60,1.47)
 ring_path('28_leading_finger_bone_'+tag,[spur0,spur1,spur2,spur3],
           [.105,.085,.055,.012],n=8)
 # Scalloped membrane from shoulder to swept wingtip to back. Separate wing-area spans
 # each correspond to a bat's digital webbing, not pure paint/additional color meshes.
 main_outline=[shoulder,spur1,spur2,spur3,p(.70,1.36,1.29),
               p(.32,1.19,1.18),p(-.20,1.15,1.07),p(-.82,1.04,.85),elbow]
 membrane('29_wingmembrane_sweptback_'+tag,main_outline)
 membrane('30_wingmembrane_brachial_'+tag,[shoulder,elbow,carpal,
          p(-1.34,1.42,.49),p(-1.20,1.36,.81),p(-.90,1.14,1.23),spur1])
 # Three curved load-bearing radial fingers, defining membrane scallops.
 cone_tube('31_trailing_digit_long_'+tag,[spur1,p(.24,1.51,1.52),p(.72,1.35,1.28)],
           [.073,.047,.005],n=7)
 cone_tube('32_trailing_digit_mid_'+tag,[spur1,p(-.02,1.35,1.39),p(.31,1.18,1.18)],
           [.052,.034,.004],n=7)
 cone_tube('33_trailing_digit_short_'+tag,[shoulder,p(-.70,1.13,1.08),p(-.22,1.13,1.05)],
           [.073,.046,.004],n=7)
 # Little wrist climbing hook, functional for tree roots, not a vestigial hand.
 cone_tube('34_carpal_hook_'+tag,[p(-1.58,1.28,.30),p(-1.64,1.40,.35),p(-1.75,1.44,.33)],
           [.065,.044,.004],mat='claw',rgb=(.23,.22,.18,1),n=7)

# Purposeful ridges only: asymmetrical low osteoderm points on shoulder/back.
for i in range(6):
 x=-1.16+i*.42
 z=1.65 if x<-.7 else 1.63 if x<.6 else 1.52
 cone_tube(f'35_integrated_low_dorsal_osteoderm_{i}',[(x-.07,0,z-.05),(x+.02,0,z+.038),(x+.12,0,z+.015)],
           [.055,.04,.003],n=6)

# Export and VERIFY the actual glTF/GLB reimport: blockout v03 has no rig/clips.
scene=trimesh.Scene()
for name,m in PARTS:
    m.vertices[:,0] *= .897
    scene.add_geometry(m,geom_name=name,node_name=name)
glb=trimesh.exchange.gltf.export_glb(scene,include_normals=True)
OUT.write_bytes(glb)
re=trimesh.load(OUT,force='scene',process=False)
assert len(re.geometry)==len(PARTS)
tri=sum(len(g.faces) for g in re.geometry.values())
assert tri>3000
bounds=re.bounds.tolist()
manifest={
  'species':'brejaveo', 'version':'v03','stage':'replacement_blockout',
  'shape_approved':False,'original_concept_approved':True,
  'source_art':'/mnt/data/76213.png',
  'replaces_for_review':'v01 and v02 visual direction; files preserved',
  'file':OUT.name, 'bytes':len(glb),'sha256':hashlib.sha256(glb).hexdigest(),
  'triangles':int(tri),'vertices':int(sum(len(g.vertices) for g in re.geometry.values())),
  'mesh_count':len(re.geometry),'dimensions_xyz_m':[round(float(x),3) for x in re.extents],
  'skins':0,'joints':0,'animations':0,'texture':TEX.name,
  'texture_sha256':hashlib.sha256(TEX.read_bytes()).hexdigest(),
  'preview_source':'exported GLB reimported with trimesh and rendered with VTK',
  'review_notes':['Folded backswept wing membrane integrated with front limbs',
      'Low elongated reptilian skull and inset iris with rear-swept horns',
      'Substantial haunches and short strong forearms',
      'Purple mottling + beige underside exclusively by UV atlas',
      'Tongue neutral/resting only; no rig or animation in v03 blockout']
}
(ROOT/'manifest.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False))
print(json.dumps(manifest,indent=2,ensure_ascii=False))