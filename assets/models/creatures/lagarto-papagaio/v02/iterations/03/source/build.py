#!/usr/bin/env python3
"""Original procedural anatomical blockout, closed component meshes, painted UV atlas."""
from pathlib import Path
import json,math,hashlib
import numpy as np
from PIL import Image
import trimesh
from trimesh.visual.texture import TextureVisuals
from trimesh.visual.material import PBRMaterial
ROOT=Path(__file__).resolve().parents[1]
ROOT.mkdir(exist_ok=True)
N=384; TILES=['body','limb','head','jaw','crest','claw','eye','mouth','tooth']
# One UV atlas; all chromatic markings are painted on existing surfaces.
def make_atlas():
    tex=np.zeros((N*3,N*3,3),dtype=np.uint8)
    y,x=np.mgrid[0:N,0:N];u=(x+.5)/N;v=(y+.5)/N
    rng=np.random.default_rng(14)
    for i,t in enumerate(TILES):
        a=np.zeros((N,N,3),float); a[:]=[46,116,47]
        if t in ('body','limb','head','jaw','crest'):
            dorsal=np.cos(2*np.pi*v); belly=np.clip((-dorsal-.19)/.62,0,1)
            green=np.array([65,155,40]); dark=np.array([12,74,44]); lime=np.array([139,191,40]); gold=np.array([255,218,26]); cream=np.array([231,191,67])
            a[:]=green; a=a*(1-np.maximum(dorsal,0)[...,None]*.55)+dark*np.maximum(dorsal,0)[...,None]*.55
            belly=belly*(.28 if t=='limb' else 1.)
            a=a*(1-belly[...,None])+cream*belly[...,None]
            if t in ('body','limb'):
                # Chevron/irregular yellow bands, dark emerald borders, fading toward ventral plane.
                freq=12.0 if t=='body' else 2.1
                ph=freq*u+0.50*np.sin(2*np.pi*v)+.045*np.sin(u*53+v*18)+.022*np.sin(u*111-v*37)
                d=np.abs((ph+.5)%1-.5); mask=np.clip((.91-belly)*4,0,1)
                outer=(d<.31)*mask; inner=(d<.17+.025*np.sin(u*38+v*29))*mask
                a=a*(1-outer[...,None])+dark*outer[...,None];a=a*(1-inner[...,None])+gold*inner[...,None]
                flank=np.exp(-((np.abs(dorsal)-.22)/.18)**2)*.18*(1-belly)
                a=a*(1-flank[...,None])+lime*flank[...,None]
            elif t=='head':
                # Bold angular eye stripes running from rear of jaw toward snout.
                stripe=np.abs(np.abs(v-.5)-(.27+.065*np.sin(u*3.1)))
                band=(stripe<.10)*(1-belly); core=(stripe<.047)*(1-belly)
                a=a*(1-band[...,None])+dark*band[...,None];a=a*(1-core[...,None])+gold*core[...,None]
                ridge=(np.abs(v-.5)>.42)*.35;a=a*(1-ridge[...,None])+dark*ridge[...,None]
            elif t=='jaw':a[:]=cream; a+=12*np.sin(v[...,None]*np.pi)
            else:
                a[:]=dark; k=np.clip((u-.48)*3,0,1);a=a*(1-k[...,None])+gold*k[...,None]
            # Small overlapping scale impressions; no geometry used for color.
            row=np.floor(v*24); sx=(u*36+(row%2)*.5)%1; sy=(v*24)%1
            edge=np.minimum(np.abs(sx-.5)*2+np.abs(sy-.5)*.86,1)
            a+=(-28*np.maximum((edge-.80)/.20,0)+11*np.sin(sy*np.pi))[...,None]
        elif t=='eye':
            a[:]=[205,149,28]; pupil=np.abs(u-.5)<(.05+.045*np.abs(v-.5)); a[pupil]=[8,13,8]; rim=((u-.5)**2+(v-.5)**2)>.22; a[rim]=[49,60,16]
        else:a[:]=dict(claw=[66,56,35],mouth=[55,20,21],tooth=[222,208,162])[t]
        a+=rng.normal(0,1.5,(N,N,1));tex[i//3*N:(i//3+1)*N,i%3*N:(i%3+1)*N]=np.clip(a,0,255).astype('uint8')
    im=Image.fromarray(tex);im.save(ROOT/'papagaio_uv_v02.png',optimize=True);return im
parts=[]
def add(v,f,uv,t,name):
    v=np.array(v,float);f=np.array(f,int);uv=np.array(uv,float)
    # Check closed authored shell after merging coincident UV seam vertices.
    chk=trimesh.Trimesh(vertices=v,faces=f,process=True);trimesh.repair.fix_normals(chk)
    # Global orientation for this shell, using original indices to preserve UV.
    orig=trimesh.Trimesh(vertices=v,faces=f,process=False)
    if orig.volume<0:f=f[:,::-1]
    assert chk.is_watertight, name
    assert np.isfinite(v).all()
    i=TILES.index(t); uv=np.clip(uv,.008,.992);uv=np.column_stack(((i%3+uv[:,0])/3,1-(i//3+uv[:,1])/3))
    parts.append((v,f,uv,name))
def loft(rings,t,name,sides=12,axis='x',power=1.):
    # rings = (center XYZ, width radius, vertical radius); orientation follows path.
    c=np.array([r[0] for r in rings]);v=[];uv=[];f=[]
    for i,(p,w,h) in enumerate(rings):
        if axis=='x': a=np.array([0,1,0]);b=np.array([0,0,1])
        else:
            tangent=c[min(i+1,len(c)-1)]-c[max(i-1,0)];tangent/=np.linalg.norm(tangent)
            ref=np.array([0.,1,0.]) if abs(tangent[1])<.92 else np.array([1.,0,0])
            a=ref-tangent*np.dot(ref,tangent);a/=np.linalg.norm(a);b=np.cross(tangent,a)
        for j in range(sides+1):
            ang=2*np.pi*(j%sides)/sides;si=np.sin(ang);co=np.cos(ang)
            v.append(np.array(p)+a*w*np.sign(si)*abs(si)**power+b*h*np.sign(co)*abs(co)**power)
            uv.append([i/(len(rings)-1),j/sides])
    for i in range(len(rings)-1):
        for j in range(sides):
            k=i*(sides+1)+j;l=k+sides+1;f.extend([[k,l,k+1],[k+1,l,l+1]])
    for i in [0,len(rings)-1]:
        k=len(v);v.append(c[i]);uv.append([i/(len(rings)-1),.5]);b=i*(sides+1)
        for j in range(sides):f.append([k,b+j,b+j+1] if i==0 else [k,b+j+1,b+j])
    add(v,f,uv,t,name)
def L(rows,t,n,s=12,power=1.):loft([((x,0,z),w,h) for x,z,w,h in rows],t,n,s,power=power)
def P(rows,t,n,s=8):loft(rows,t,n,s,axis='path')
# continuous core: tapering tail, muscular haunches, rib cage, shoulder, raised neck
L([(-3.32,.42,.025,.024),(-3.08,.40,.057,.051),(-2.75,.38,.10,.10),(-2.37,.43,.16,.145),(-1.99,.55,.24,.20),(-1.64,.69,.31,.26),(-1.27,.83,.40,.32),(-.91,.91,.52,.42),(-.57,.95,.56,.48),(-.19,.94,.55,.47),(.20,.92,.51,.41),(.56,.91,.49,.41),(.82,.98,.38,.33),(1.04,1.09,.30,.29),(1.25,1.22,.265,.26),(1.46,1.30,.265,.23)],'body','core',16, .87)
# Flattened wedge skull, sculpted cheek and snout instead of a generic round head.
L([(1.20,1.30,.205,.20),(1.37,1.36,.30,.25),(1.53,1.39,.325,.24),(1.70,1.39,.285,.19),(1.87,1.35,.222,.145),(2.06,1.31,.177,.105),(2.23,1.28,.132,.085),(2.31,1.265,.09,.060)],'head','upper_skull',16,.66)
# slight open mouth: separate lower jaw and recessed inner mouth, no fake colour meshes
L([(1.29,1.21,.20,.13),(1.46,1.13,.275,.15),(1.64,1.015,.235,.12),(1.85,.96,.18,.084),(2.05,.93,.128,.056),(2.22,.945,.082,.038)],'jaw','lower_jaw',12,.68)
L([(1.32,1.22,.17,.10),(1.48,1.18,.235,.13),(1.69,1.12,.175,.10),(1.91,1.055,.12,.065),(2.10,1.03,.06,.035)],'mouth','mouth_interior',10,.8)
# legs: forelimb elbow back, hindlimb knee forward, ankle and spread feet
for side in (-1,1):
    for front in (True,False):
        name=('fore' if front else 'hind')+str(side)
        if front: rows=[((.57,side*.30,1.07),.245,.28),((.54,side*.52,.86),.29,.285),((.32,side*.73,.62),.21,.21),((.43,side*.82,.40),.153,.18),((.68,side*.85,.17),.125,.115),((.82,side*.86,.115),.17,.093)]
        else:rows=[((-.94,side*.32,1.0),.30,.32),((-.81,side*.55,.84),.33,.31),((-.55,side*.77,.62),.235,.23),((-.76,side*.87,.39),.155,.17),((-.94,side*.93,.19),.135,.125),((-.77,side*.94,.115),.18,.095)]
        P(rows,'limb',name,12)
        fx,fy,fz=rows[-1][0]
        for j in range(4):
            o=(j-1.5)*.093;dx=.24+.065*(1-abs(j-1.5)/1.5);dy=side*o
            a=(fx-.015,fy+dy*.65,.108);b=(fx+dx*.66,fy+dy*1.45,.085);c=(fx+dx,fy+dy*1.85,.067)
            P([(a,.061,.051),(b,.050,.041),(c,.033,.029)],'limb',name+'_toe'+str(j),7)
            P([(c,.034,.03),((c[0]+.105,c[1]+dy*.17,.073),.024,.022),((c[0]+.165,c[1]+dy*.24,.023),.004,.006)],'claw',name+'_claw'+str(j),7)
# Eyes with dark pupil texture, situated in the side of skull; brows as silhouette structures.
for side in (-1,1):
    # sphere around y axis, mapped eye texture so pupil faces side
    c=np.array([1.66,side*.279,1.455]);vs=[];uv=[];fs=[];s=12;r=6
    # use ring layout with poles capped small instead of degenerate triangles
    for k in range(r+1):
        th=.035+(math.pi-.07)*k/r
        for j in range(s+1):
            ph=2*math.pi*(j%s)/s;vs.append(c+[.079*math.sin(th)*math.cos(ph),side*.042*math.sin(th)*math.sin(ph),.065*math.cos(th)]);uv.append([.5+.47*math.sin(th)*math.cos(ph),.5+.47*math.cos(th)])
    for k in range(r):
        for j in range(s):
            a=k*(s+1)+j;b=a+s+1;fs.extend([[a,b,a+1],[a+1,b,b+1]])
    for k in [0,r]:
        i=len(vs);vs.append(c+[0,0,.065*math.cos(.035+(math.pi-.07)*k/r)]);uv.append([.5,.5+.47*(1 if k==0 else -1)])
        for j in range(s):fs.append([i,k*(s+1)+j,k*(s+1)+j+1] if k==0 else [i,k*(s+1)+j+1,k*(s+1)+j])
    add(vs,fs,uv,'eye','eye'+str(side))
    P([((1.39,side*.22,1.52),.084,.07),((1.54,side*.28,1.55),.077,.054),((1.70,side*.28,1.51),.062,.036),((1.86,side*.22,1.445),.04,.024),((1.99,side*.175,1.39),.012,.012)],'head','brow'+str(side),8)
    # teeth anchored within upper jaw, visible in narrow gape
    for j in range(6):
        x=1.67+j*.10;y=side*(.175-.018*j);z=np.interp(x,[1.53,1.70,1.87,2.06,2.23,2.31],[1.39-.24,1.39-.19,1.35-.145,1.31-.105,1.28-.085,1.265-.06])+.063
        P([((x,y,z),.029,.025),((x+.006,y,z-.055-(.025 if j==3 else 0)),.016,.016),((x-.017,y,z-.095-(.045 if j==3 else 0)),.003,.003)],'tooth','tooth'+str(side)+str(j),6)
    # recessed-looking nostril, small anatomical dark cavity shell
    P([((2.145,side*.139,1.319),.027,.021),((2.19,side*.139,1.31),.018,.012)],'mouth','nostril'+str(side),6)
    # smaller lower teeth, rooted in jaw, directed upward and slightly back
    for j in range(4):
        x=1.72+j*.12;y=side*(.15-.019*j);z=np.interp(x,[1.64,1.85,2.05,2.22],[1.015+.12,.96+.084,.93+.056,.945+.038])-.025
        P([((x,y,z),.022,.02),((x+.005,y,z+.045),.013,.012),((x-.02,y,z+.073),.003,.003)],'tooth','lower_tooth'+str(side)+str(j),5)
# Low swept nape/dorsal scales: each has a closed root intersecting the core.
for i,(x,z,h,w) in enumerate([(1.37,1.51,.18,.10),(1.16,1.41,.18,.11),(.96,1.35,.17,.12),(.74,1.30,.16,.12),(.49,1.31,.16,.12),(.24,1.32,.15,.12),(-.02,1.38,.15,.12),(-.27,1.40,.14,.11),(-.54,1.40,.13,.10),(-.80,1.33,.11,.09),(-1.05,1.24,.10,.08),(-1.30,1.10,.085,.065),(-1.56,.94,.07,.05)]):
    P([((x+.09,0,z-.065),w*1.12,.075),((x-.005,0,z+.025),w*.86,.050),((x-.19,0,z+h*.72),.006,.008)],'crest','crest'+str(i),7)
for side in (-1,1):
    for j,(x,z,y) in enumerate([(1.44,1.50,.19),(1.26,1.46,.19),(1.08,1.38,.18)]):
        P([((x+.045,side*y,z-.045),.075,.045),((x-.065,side*(y+.035),z+.025),.063,.029),((x-.205,side*(y+.045),z+.075),.004,.004)],'crest','nape'+str(side)+str(j),7)
# Sweep tail gently in plan, leaving pelvis/limbs untouched.
for vv,ff,tt,nn in parts:
    if nn=='core':
        k=np.clip((-vv[:,0]-1.25)/2.07,0,1);vv[:,1]+=.68*k*k;vv[:,0]-=.20*k*k
# merge into one primitive, flat triangles, per-corner UVs preserve seams.
vertices=[];faces=[];uv=[]
for v,f,t,n in parts:
    off=len(vertices);vv=v[f].reshape(-1,3);uu=t[f].reshape(-1,2);vertices.extend(vv);uv.extend(uu);faces.extend(np.arange(off,off+len(vv)).reshape(-1,3))
v=np.array(vertices);v[:,2]-=v[:,2].min();v=v[:,[0,2,1]];v[:,2]*=-1 # Y up, right handed
f=np.array(faces);m=trimesh.Trimesh(vertices=v,faces=f,process=False)
assert len(f)<=5000 and m.area_faces.min()>1e-10
# explicit flat normals
m.vertex_normals=np.repeat(m.face_normals,3,axis=0)
m.visual=TextureVisuals(uv=np.array(uv),material=PBRMaterial(name='Escamas UV',baseColorTexture=make_atlas(),metallicFactor=0.,roughnessFactor=.86,doubleSided=False))
scene=trimesh.Scene();scene.add_geometry(m,geom_name='LagartoPapagaio_v02',node_name='LagartoPapagaio_v02');path=ROOT/'lagarto-papagaio-v02.glb';path.write_bytes(scene.export(file_type='glb'))
loaded=trimesh.load(path,force='scene',process=False);meshes=list(loaded.geometry.values());assert len(meshes)==1 and len(meshes[0].faces)==len(f) and meshes[0].visual.uv is not None
w=meshes[0].copy();w.merge_vertices(merge_tex=True,merge_norm=True);shells=w.split(only_watertight=False);bad=sum(not s.is_watertight or not s.is_winding_consistent or s.volume<=0 for s in shells)
assert bad==0, bad
manifest=dict(species='lagarto-papagaio',version='v02',stage='blockout statico — aprovacao da forma pendente',triangles=len(f),meshes=1,skins=0,animations=0,bytes=path.stat().st_size,sha256=hashlib.sha256(path.read_bytes()).hexdigest(),bounds_m=loaded.extents.tolist(),closed_authored_parts=len(parts),reimported_shells=len(shells),shells_nonclosed_or_negative=int(bad),uv=True,texture='papagaio_uv_v02.png',notes='Cascas sobrepostas independentes, nao soldadas entre si; rig posterior exige revisao. Nome provisório. Comprimento de design ~5,7 m.')
(ROOT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');print(json.dumps(manifest,ensure_ascii=False))
