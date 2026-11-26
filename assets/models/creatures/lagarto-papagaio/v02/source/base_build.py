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
            green=np.array([49,137,45]); dark=np.array([15,72,38]); lime=np.array([103,157,36]); gold=np.array([246,203,39]); cream=np.array([198,166,75])
            a[:]=green; a=a*(1-np.maximum(dorsal,0)[...,None]*.55)+dark*np.maximum(dorsal,0)[...,None]*.55
            belly=belly*(.28 if t=='limb' else 1.)
            a=a*(1-belly[...,None])+cream*belly[...,None]
            if t in ('body','limb'):
                # Chevron/irregular yellow bands, dark emerald borders, fading toward ventral plane.
                freq=10.2 if t=='body' else 2.7
                ph=freq*u+0.36*np.sin(2*np.pi*v)+.09*np.sin(u*53+v*18)+.04*np.sin(u*111-v*37)
                d=np.abs((ph+.5)%1-.5); mask=np.clip((.91-belly)*4,0,1)
                outer=(d<.22)*mask; inner=(d<.115+.035*np.sin(u*38+v*29))*mask
                a=a*(1-outer[...,None])+dark*outer[...,None];a=a*(1-inner[...,None])+gold*inner[...,None]
                flank=np.exp(-((np.abs(dorsal)-.22)/.18)**2)*.18*(1-belly)
                a=a*(1-flank[...,None])+lime*flank[...,None]
            elif t=='head':
                # Bold angular eye stripes running from rear of jaw toward snout.
                stripe=np.abs(np.abs(v-.5)-(.29+.055*np.sin(u*3.1)))
                band=(stripe<.047)*(1-belly); core=(stripe<.024)*(1-belly)
                a=a*(1-band[...,None])+dark*band[...,None];a=a*(1-core[...,None])+gold*core[...,None]
                ridge=(np.abs(v-.5)>.42)*.35;a=a*(1-ridge[...,None])+dark*ridge[...,None]
            elif t=='jaw':a[:]=cream; a+=12*np.sin(v[...,None]*np.pi)
            else:
                a[:]=dark; k=np.clip((u-.48)*3,0,1);a=a*(1-k[...,None])+gold*k[...,None]
            # Small overlapping scale impressions; no geometry used for color.
            row=np.floor(v*32); sx=(u*45+(row%2)*.5)%1; sy=(v*32)%1
            edge=np.minimum(np.abs(sx-.5)*2+np.abs(sy-.5)*.86,1)
            a+=(-20*np.maximum((edge-.83)/.17,0)+5*np.sin(sy*np.pi))[...,None]
        elif t=='eye':
            a[:]=[205,149,28]; pupil=np.abs(u-.5)<(.05+.045*np.abs(v-.5)); a[pupil]=[8,13,8]; rim=((u-.5)**2+(v-.5)**2)>.22; a[rim]=[49,60,16]
        else:a[:]=dict(claw=[66,56,35],mouth=[55,20,21],tooth=[222,208,162])[t]
        a+=rng.normal(0,1.5,(N,N,1));tex[i//3*N:(i//3+1)*N,i%3*N:(i%3+1)*N]=np.clip(a,0,255).astype('uint8')
    im=Image.fromarray(tex);im.save(ROOT/'papagaio_uv_v01.png',optimize=True);return im
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
L([(-3.32,.23,.025,.024),(-3.08,.26,.047,.044),(-2.75,.30,.085,.078),(-2.37,.38,.128,.12),(-1.99,.52,.19,.17),(-1.64,.68,.27,.23),(-1.27,.78,.36,.30),(-.91,.84,.49,.38),(-.57,.86,.49,.43),(-.19,.86,.48,.45),(.20,.88,.51,.47),(.56,.93,.53,.47),(.82,.99,.43,.38),(1.04,1.08,.32,.32),(1.25,1.18,.255,.26),(1.46,1.24,.245,.235)],'body','core',16, .87)
# Flattened wedge skull, sculpted cheek and snout instead of a generic round head.
L([(1.20,1.27,.20,.19),(1.39,1.32,.285,.23),(1.58,1.35,.31,.22),(1.78,1.34,.255,.16),(2.04,1.30,.205,.11),(2.25,1.29,.155,.086),(2.34,1.285,.09,.061)],'head','upper_skull',16,.66)
# slight open mouth: separate lower jaw and recessed inner mouth, no fake colour meshes
L([(1.32,1.18,.19,.09),(1.50,1.13,.263,.095),(1.71,1.045,.218,.075),(1.94,.99,.175,.058),(2.16,.963,.135,.049),(2.27,.962,.08,.035)],'jaw','lower_jaw',12,.68)
L([(1.37,1.19,.16,.08),(1.51,1.16,.222,.09),(1.73,1.11,.18,.08),(1.97,1.08,.12,.057),(2.13,1.07,.065,.035)],'mouth','mouth_interior',10,.8)
# legs: forelimb elbow back, hindlimb knee forward, ankle and spread feet
for side in (-1,1):
    for front in (True,False):
        name=('fore' if front else 'hind')+str(side)
        if front: rows=[((.58,side*.31,1.03),.23,.28),((.48,side*.52,.79),.25,.27),((.29,side*.73,.53),.19,.19),((.40,side*.82,.35),.145,.16),((.59,side*.87,.14),.115,.105),((.73,side*.87,.095),.155,.079)]
        else:rows=[((-.91,side*.31,.93),.27,.31),((-.77,side*.54,.73),.30,.29),((-.59,side*.78,.51),.225,.21),((-.80,side*.89,.33),.14,.15),((-.93,side*.96,.15),.12,.12),((-.78,side*.98,.095),.17,.08)]
        P(rows,'limb',name,12)
        fx,fy,fz=rows[-1][0]
        for j in range(4):
            o=(j-1.5)*.082;dx=.20+.045*(1-abs(j-1.5)/1.5);dy=side*o
            a=(fx-.015,fy+dy*.7,.096);b=(fx+dx*.66,fy+dy*1.55,.073);c=(fx+dx,fy+dy*1.9,.06)
            P([(a,.054,.045),(b,.047,.037),(c,.033,.029)],'limb',name+'_toe'+str(j),7)
            P([(c,.034,.03),((c[0]+.079,c[1]+dy*.17,.059),.024,.022),((c[0]+.13,c[1]+dy*.24,.026),.004,.006)],'claw',name+'_claw'+str(j),7)
# Eyes with dark pupil texture, situated in the side of skull; brows as silhouette structures.
for side in (-1,1):
    # sphere around y axis, mapped eye texture so pupil faces side
    c=np.array([1.67,side*.278,1.405]);vs=[];uv=[];fs=[];s=12;r=6
    # use ring layout with poles capped small instead of degenerate triangles
    for k in range(r+1):
        th=.035+(math.pi-.07)*k/r
        for j in range(s+1):
            ph=2*math.pi*(j%s)/s;vs.append(c+[.095*math.sin(th)*math.cos(ph),side*.052*math.sin(th)*math.sin(ph),.077*math.cos(th)]);uv.append([.5+.47*math.sin(th)*math.cos(ph),.5+.47*math.cos(th)])
    for k in range(r):
        for j in range(s):
            a=k*(s+1)+j;b=a+s+1;fs.extend([[a,b,a+1],[a+1,b,b+1]])
    for k in [0,r]:
        i=len(vs);vs.append(c+[0,0,.077*math.cos(.035+(math.pi-.07)*k/r)]);uv.append([.5,.5+.47*(1 if k==0 else -1)])
        for j in range(s):fs.append([i,k*(s+1)+j,k*(s+1)+j+1] if k==0 else [i,k*(s+1)+j+1,k*(s+1)+j])
    add(vs,fs,uv,'eye','eye'+str(side))
    P([((1.43,side*.235,1.49),.07,.06),((1.60,side*.28,1.49),.067,.045),((1.79,side*.25,1.475),.05,.04),((1.91,side*.20,1.42),.012,.015)],'head','brow'+str(side),8)
    # teeth anchored within upper jaw, visible in narrow gape
    for j in range(6):
        x=1.68+j*.093;y=side*(.19-.014*j);z=1.208-.009*j
        P([((x,y,z),.029,.025),((x+.006,y,z-.055-(.025 if j==3 else 0)),.016,.016),((x-.017,y,z-.095-(.045 if j==3 else 0)),.003,.003)],'tooth','tooth'+str(side)+str(j),6)
# Low swept nape/dorsal scales: each has a closed root intersecting the core.
for i,(x,z,h,w) in enumerate([(1.37,1.46,.16,.09),(1.16,1.43,.19,.10),(.96,1.35,.18,.11),(.74,1.32,.17,.12),(.49,1.34,.16,.12),(.24,1.32,.145,.11),(-.02,1.29,.14,.10),(-.27,1.27,.13,.10),(-.54,1.25,.12,.09),(-.80,1.21,.11,.09),(-1.05,1.13,.10,.08),(-1.30,1.03,.085,.065),(-1.56,.9,.07,.05)]):
    P([((x+.07,0,z-.055),w,.06),((x-.02,0,z+.045),w*.75,.043),((x-.16,0,z+h),.006,.008)],'crest','crest'+str(i),7)
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
scene=trimesh.Scene();scene.add_geometry(m,geom_name='LagartoPapagaio_v01',node_name='LagartoPapagaio_v01');path=ROOT/'lagarto-papagaio-v01.glb';path.write_bytes(scene.export(file_type='glb'))
loaded=trimesh.load(path,force='scene',process=False);meshes=list(loaded.geometry.values());assert len(meshes)==1 and len(meshes[0].faces)==len(f) and meshes[0].visual.uv is not None
w=meshes[0].copy();w.merge_vertices(merge_tex=True,merge_norm=True);shells=w.split(only_watertight=False);bad=sum(not s.is_watertight or not s.is_winding_consistent or s.volume<=0 for s in shells)
assert bad==0, bad
manifest=dict(species='lagarto-papagaio',version='v01',stage='blockout statico — aprovacao da forma pendente',triangles=len(f),meshes=1,skins=0,animations=0,bytes=path.stat().st_size,sha256=hashlib.sha256(path.read_bytes()).hexdigest(),bounds_m=loaded.extents.tolist(),closed_authored_parts=len(parts),reimported_shells=len(shells),shells_nonclosed_or_negative=int(bad),uv=True,texture='papagaio_uv_v01.png',notes='Cascas sobrepostas independentes, nao soldadas entre si; rig posterior exige revisao. Nome provisório. Comprimento de design ~5,7 m.')
(ROOT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');print(json.dumps(manifest,ensure_ascii=False))
