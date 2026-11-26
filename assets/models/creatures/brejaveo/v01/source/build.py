#!/usr/bin/env python3
"""Brejaveo v01 Wildhaven: real static anatomical blockout glTF/GLB.
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
OUT=ROOT/'brejaveo-v01-anatomia-blockout.glb'
TEX=ROOT/'textures/brejaveo-v01-atlas-uv.png'
RNG=random.Random(9201)
S=1024

def paint_atlas():
    yy,xx=np.mgrid[0:S,0:S]
    img=np.zeros((S,S,3),dtype=np.uint8)
    # Skin area: x 0..509. Green dorsum, earthy purplish speckles, pale chin/belly.
    u=xx/510.;v=yy/S
    # v=0 (top) green, v=.5 underside pale and v=1 top; texture mirrored seam
    dv=np.minimum(v,1-v)
    low=np.clip((dv-.28)/.15,0,1)
    c0=np.array([89,151,40]); c1=np.array([195,177,135]);
    top_variation=(6*np.sin(13*u+4*dv)+3*np.cos(39*u-20*dv))[:,:,None]
    blend=c0[None,None,:]*(1-low[:,:,None])+c1[None,None,:]*low[:,:,None]+top_variation
    img[:,:,:]=np.clip(blend,0,255).astype(np.uint8)
    # Orange translucent-like sculptural membrane: gradient with depth.
    wing=(xx>=512)
    wv=np.clip((xx-512)/512,0,1); t=np.clip(yy/S,0,1)
    target=np.stack([224+17*(1-t),117+35*t,29+23*t],axis=-1)
    img[wing]=np.clip(target[wing],0,255).astype('uint8')
    im=Image.fromarray(img,mode='RGB'); draw=ImageDraw.Draw(im)
    for _ in range(140):
        x=RNG.randint(18,490); y=RNG.randint(25,999)
        d=min(y,1024-y)/1024
        if d>.32: continue
        r=RNG.randint(3,15)
        hue=(69+RNG.randint(-18,17),54+RNG.randint(-8,17),64+RNG.randint(-9,21))
        draw.ellipse((x-r,y-r*.65,x+r,y+r*.65),fill=hue)
    # Tiny pale green geometric cells; UV texture only.
    for i in range(115):
        x=RNG.randint(20,490);y=RNG.randint(40,970)
        if min(y,1024-y)/1024>.28: continue
        r=RNG.randint(2,5)
        draw.polygon([(x-r,y),(x-r//2,y-r),(x+r,y-r//2),(x+r,y+r),(x-r//3,y+r//2)],fill=(125,185,55))
    # subtle membrane blood vessel stippling and structural edge tonal variation painted on the atlas
    for _ in range(160):
        x=RNG.randint(542,1014);y=RNG.randint(35,995)
        r=RNG.randint(1,3)
        draw.ellipse((x-r,y-r,x+r,y+r),fill=(203,99,30))
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
    m.visual=TextureVisuals(uv=np.asarray(uvs,dtype=np.float64), material=MATERIAL if mat in ('skin','wing') else flat_material(mat,rgb))
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
            UV.append((u0+(u1-u0)*ix/(len(p)-1),j/n))
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

# MAIN CORE: torso + distinct neck + tail, firm sectional planes.
ring_x('01_tronco_anatomico',[
 (-1.16,1.48,.39,.36),(-.93,1.45,.51,.46),(-.62,1.43,.59,.48),(-.20,1.42,.59,.47),(.20,1.41,.53,.45),(.63,1.42,.49,.42),(.92,1.39,.40,.33),(1.23,1.34,.25,.23)
],n=14)
ring_x('02_pescoco_flexivel_base',[
 (-2.10,1.77,.25,.23),(-1.89,1.76,.28,.26),(-1.66,1.68,.30,.31),(-1.43,1.61,.36,.33),(-1.15,1.48,.40,.36)
],n=12)
ring_x('03_cauda_continua',[
 (1.13,1.36,.29,.27),(1.46,1.35,.25,.22),(1.78,1.40,.21,.19),(2.08,1.47,.17,.16),(2.34,1.58,.125,.12),(2.57,1.61,.08,.07),(2.74,1.59,.029,.035)
],n=10)
# head, snout and jaw visibly separate, throat for swallowing
ring_x('04_cranio_amplo',[
 (-2.72,1.88,.19,.155),(-2.57,1.91,.29,.235),(-2.36,1.96,.36,.29),(-2.15,1.93,.35,.30),(-1.98,1.83,.28,.23)
],n=12)
ring_x('05_focinho_em_cunha',[
 (-3.01,1.80,.15,.11),(-2.90,1.84,.22,.14),(-2.70,1.87,.28,.18),(-2.54,1.90,.30,.19)
],n=10)
ring_x('06_mandibula_inferior',[
 (-2.93,1.64,.13,.056),(-2.72,1.64,.21,.09),(-2.48,1.69,.26,.115),(-2.26,1.76,.26,.12),(-2.09,1.80,.22,.15)
],n=10,mat='skin')
ring_x('07_garganta_expandivel',[
 (-2.14,1.70,.23,.125),(-1.93,1.66,.29,.17),(-1.70,1.61,.29,.18),(-1.47,1.55,.27,.20)
],n=10)
# tongue visible as an anatomical prototype, but not extended/fired in blockout
cone_tube('08_lingua_recolhida',[
 (-2.08,0,1.72),(-2.42,0,1.715),(-2.73,0,1.71),(-2.83,0,1.68)
],[.075,.09,.068,.029],mat='tongue',rgb=(.59,.15,.24,1),n=8)
# Eyes, recessed sockets, sculptural brows, upright horns, paired facial spikes
for side,lab in [(-1,'D'),(1,'E')]:
    def pt(x,y,z):return [x,side*y,z]
    ellipsoid('09_cavidade_ocular_'+lab,pt(-2.40,.319,2.040),(.17,.072,.145),'socket',(.18,.22,.13,1))
    ellipsoid('10_olho_ambar_'+lab,pt(-2.425,.370,2.051),(.105,.052,.096),'eye',(.94,.59,.075,1))
    ellipsoid('11_pupila_'+lab,pt(-2.444,.412,2.060),(.049,.025,.069),'pupil',(.075,.062,.035,1))
    cone_tube('12_supercilio_'+lab,[pt(-2.57,.30,2.14),pt(-2.45,.35,2.18),pt(-2.24,.33,2.15)], [.07,.075,.03],n=7)
    cone_tube('13_chifre_frontal_'+lab,[pt(-2.67,.22,2.07),pt(-2.72,.24,2.23),pt(-2.69,.29,2.47),pt(-2.57,.33,2.56)],[.125,.112,.075,.008],mat='horn',rgb=(.18,.26,.13,1))
    cone_tube('14_chifre_templo_'+lab,[pt(-2.22,.27,2.15),pt(-2.14,.39,2.30),pt(-2.11,.40,2.45)],[.086,.06,.007],mat='horn',rgb=(.19,.25,.14,1))
    # nostril is functional dark recess (no generic colored stripes)
    ellipsoid('15_narina_'+lab,pt(-2.87,.157,1.89),(.04,.018,.023),'nostril',(.14,.11,.075,1),sub=(8,5))
    for j in range(4):
        x=-2.87+j*.15
        # teeth are actual geometry, not patterns
        cone_tube('16_canino_superior_'+lab+'_'+str(j),[pt(x,.15+j*.032,1.727+j*.007),pt(x-.02,.15+j*.027,1.64+j*.005)], [.034,.004], mat='tooth',rgb=(.84,.80,.68,1),n=5)
    for j in range(3):
        x=-2.78+j*.18
        cone_tube('17_dente_inferior_'+lab+'_'+str(j),[pt(x,.16+j*.021,1.624+j*.015),pt(x-.027,.17+j*.016,1.705+j*.013)], [.026,.004],mat='tooth',rgb=(.78,.76,.62,1),n=5)
# Hindlimb complex knees ankle and wide feet for bog traction
for side,lab in [(-1,'D'),(1,'E')]:
    def p(x,y,z):return [x,side*y,z]
    ring_path('18_coxa_traseira_'+lab,[p(.86,.43,1.37),p(1.09,.55,1.10),p(1.12,.65,.86)], [.29,.25,.17],n=10)
    ring_path('19_caneleira_traseira_'+lab,[p(1.12,.65,.86),p(.90,.67,.62),p(.97,.74,.28)], [.17,.14,.105],n=8)
    ring_path('20_tarso_traseiro_'+lab,[p(.97,.74,.28),p(.75,.80,.17),p(.61,.82,.13)], [.12,.14,.105],n=8)
    for j in range(3):
        yy=.66+j*.155
        cone_tube('21_dedo_traseiro_'+lab+'_'+str(j),[p(.65,yy,.15),p(.43,yy+(.035 if j==2 else -.020),.095),p(.31,yy+(.02 if j==2 else -.04),.066)], [.085,.068,.021],n=7)
        cone_tube('22_garra_traseira_'+lab+'_'+str(j),[p(.32,yy,.087),p(.20,yy,.071),p(.15,yy,.036)], [.052,.027,.005],mat='claw',rgb=(.18,.16,.15,1),n=6)
# Winged forelimbs = terrestrial support, wing bones are true supporting structures
for side,lab in [(-1,'D'),(1,'E')]:
    def p(x,y,z):return [x,side*y,z]
    shoulder=p(-.82,.50,1.66)
    elbow=p(-.99,1.06,1.16)
    wrist=p(-1.28,1.48,.25)
    wingbend=p(-.32,1.86,2.05)
    wingtip=p(.18,3.44,2.63)
    rear_tip=p(.97,2.34,1.65)
    rear_root=p(.57,.53,1.60)
    # upper wing foreleg body struts, green skin, no extra color meshes
    ring_path('23_ombro_asa_apoio_'+lab,[shoulder,p(-.95,.72,1.49),elbow],[.23,.20,.145],n=10)
    ring_path('24_antebraco_apoio_'+lab,[elbow,p(-1.07,1.28,.70),wrist],[.15,.13,.105],n=9)
    for k in range(3):
        y=1.47+.10*k
        cone_tube('25_dedo_dianteiro_'+lab+'_'+str(k),[wrist,p(-1.52-.065*k,y,.13),p(-1.72-.09*k,y+.02,.07)],[.078,.058,.013],n=6)
        cone_tube('26_garra_dianteira_'+lab+'_'+str(k),[p(-1.73-.09*k,y,.07),p(-1.81-.10*k,y,.04)],[.06,.004],mat='claw',rgb=(.17,.17,.15,1),n=6)
    # two organic membrane fans separated by true spar bones
    wing_panel('27_membrana_principal_'+lab,[shoulder,wingbend,wingtip,p(.67,2.82,2.06),rear_tip,rear_root],side)
    wing_panel('28_membrana_secundaria_'+lab,[shoulder,elbow,wrist,p(-.52,1.58,1.10),wingbend],side)
    # Lengthened support rods are functional skeleton of membrane, not artificial color bands
    cone_tube('29_suporte_asa_principal_'+lab,[shoulder,wingbend,wingtip],[.115,.102,.015],n=8)
    cone_tube('30_vareta_externa_'+lab,[wingtip,p(.67,2.82,2.06),rear_tip],[.057,.044,.014],n=6)
    cone_tube('31_vareta_posterior_'+lab,[rear_root,rear_tip],[.07,.018],n=7)
    cone_tube('32_tala_curta_asa_'+lab,[wingbend,p(-.52,1.58,1.10),wrist],[.055,.045,.02],n=6)
# low structural ridge along dorsal spine: small purposeful scales altering silhouette
for i in range(7):
    x=-1.14+i*.37;z=1.78-.12*(x>0)
    cone_tube('33_espinha_dorsal_%02d'%i,[[x,0,z-.055],[x+.04,0,z+.12],[x+.13,0,z+.18]], [.075,.061,.005],n=5)

# ensure all components have valid faces UV and preview-ready whole scene
scene=trimesh.Scene()
for name,m in PARTS:
    m.vertices[:,0]*=.949
    scene.add_geometry(m,geom_name=name,node_name=name)
GLB=trimesh.exchange.gltf.export_glb(scene,include_normals=True)
OUT.write_bytes(GLB)
sha=hashlib.sha256(GLB).hexdigest()
re=trimesh.load(OUT,force='scene',process=False)
tri=int(sum(len(g.faces) for g in re.geometry.values())); vertices=int(sum(len(g.vertices) for g in re.geometry.values()))
bounds=re.bounds.tolist();dims=(re.bounds[1]-re.bounds[0]).tolist()
manifest={'species':'brejaveo','stage':'blockout','version':'v01','approved_concept':True,'shape_approved':False,'repo_target':'carioca1111/wildhaven-new','file':OUT.name,'bytes':len(GLB),'sha256':sha,'triangles':tri,'vertices':vertices,'meshes':len(re.geometry),'skins':0,'joints':0,'animations':0,'dimensions_xyz_m':[round(a,3) for a in dims],'bounds_xyz_m':bounds,'texture':str(TEX.relative_to(ROOT)),'texture_sha256':hashlib.sha256(TEX.read_bytes()).hexdigest(),'render_source':'reimported GLB','notes':'No meshes added exclusively for spots, skin painting, or membrane color. Wing and limb bones are structural.'}
(ROOT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({k:v for k,v in manifest.items() if k not in ('bounds_xyz_m',)},ensure_ascii=False,indent=2))