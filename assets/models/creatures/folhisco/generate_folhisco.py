#!/usr/bin/env python3
"""Wildhaven Folhisco v0.1 — procedural skinned 3D model and 15 glTF clips.

Python 3.10+, numpy. Emits a complete self-contained .glb with a bone hierarchy,
JOINTS_0/WEIGHTS_0, inverse bind matrices, and discrete action animation clips.
All geometry is real mid-poly triangles, not billboard art or impostor textures.

Not a substitute for a hand-sculpted/weight-painted production hero asset.
"""
from __future__ import annotations
import json, math, struct, os, hashlib
from pathlib import Path
from collections import defaultdict
import numpy as np

OUT = Path(__file__).resolve().parent
S = 0.84  # procedural editor -> world metres; target height roughly 0.44 m
V = lambda *p: np.array(p, dtype=np.float64)

MATERIALS = {
    'russet': (0.53,0.205,0.095),
    'rust_highlight': (0.73,0.305,0.125),
    'burnt_umber': (0.275,0.108,0.060),
    'sienna': (0.43,0.155,0.070),
    'deep_brown': (0.20,0.115,0.085),
    'cream': (0.89,0.78,0.56),
    'warm_cream': (0.94,0.83,0.65),
    'pale_gold': (0.90,0.67,0.36),
    'feather_tan': (0.68,0.47,0.28),
    'feather_grey': (0.47,0.38,0.31),
    'comb_orange': (0.82,0.23,0.065),
    'comb_copper': (0.92,0.38,0.10),
    'wattle_red': (0.71,0.175,0.095),
    'beak': (0.32,0.315,0.278),
    'beak_tip': (0.23,0.235,0.215),
    'leg': (0.30,0.31,0.27),
    'leg_light': (0.44,0.42,0.35),
    'claw': (0.61,0.56,0.46),
    'eye_amber': (0.79,0.56,0.18),
    'iris_dark': (0.13,0.085,0.053),
    'glint': (0.99,0.96,0.81),
}

# All rotations in rest pose are identity; inverse bind is just a negative world translation.
BONES = [
    ('Body', None, (0,.115,0)),
    ('Neck', 'Body', (0,.151,-.109)),
    ('Head', 'Neck', (0,.102,-.047)),
    ('LowerBeak', 'Head', (0,-.023,-.086)),
    ('Wing_L', 'Body', (-.124,.129,-.005)),
    ('Wing_R', 'Body', (.124,.129,-.005)),
    ('Tail', 'Body', (0,.132,.17)),
    ('Thigh_L', 'Body', (-.065,.006,.067)),
    ('Thigh_R', 'Body', (.065,.006,.067)),
    ('Shank_L', 'Thigh_L', (0,-.067,-.010)),
    ('Shank_R', 'Thigh_R', (0,-.067,-.010)),
]
BONE_TRANSLATIONS = {b: V(*t) for b,p,t in BONES}
BONE_PARENTS = {b:p for b,p,t in BONES}
def rest_pos(b):
    p=np.zeros(3)
    while b is not None:
        p += BONE_TRANSLATIONS[b]
        b=BONE_PARENTS[b]
    return p
REST={b:rest_pos(b)*S for b,_,_ in BONES}
BONE_ID={b:i for i,(b,p,t) in enumerate(BONES)}

# Geometry buffer by material; vertices are in global rest pose (scaled metres).
PARTS=defaultdict(lambda:{'vertices':[],'triangles':[],'joints':[]})

def add_geo(bone, material, verts, tris):
    if len(verts)==0: return
    part=PARTS[material]
    base=len(part['vertices'])
    wp=REST[bone]
    part['vertices'].extend((np.asarray(verts,dtype=np.float64)*S+wp).tolist())
    part['triangles'].extend([[base+a,base+b,base+c] for a,b,c in tris])
    part['joints'].extend([BONE_ID[bone]]*len(verts))


def ellipsoid(bone,mat,center,radii,lat=10,lon=16,tilt=(0,0,0)):
    # UV ellipsoid with side poles and faceted silhouette.
    rx,ry,rz=radii
    x,y,z=tilt
    cx,sx=math.cos(x),math.sin(x)
    cy,sy=math.cos(y),math.sin(y)
    cz,sz=math.cos(z),math.sin(z)
    R=np.array([[cz,-sz,0],[sz,cz,0],[0,0,1]])@np.array([[cy,0,sy],[0,1,0],[-sy,0,cy]])@np.array([[1,0,0],[0,cx,-sx],[0,sx,cx]])
    verts=[];tri=[]
    for i in range(lat+1):
        theta=math.pi*i/lat
        for j in range(lon):
            phi=2*math.pi*j/lon
            u=V(rx*math.sin(theta)*math.cos(phi), ry*math.cos(theta), rz*math.sin(theta)*math.sin(phi))
            verts.append(V(*center)+R@u)
    for i in range(lat):
        for j in range(lon):
            a=i*lon+j;b=i*lon+(j+1)%lon;c=(i+1)*lon+j;d=(i+1)*lon+(j+1)%lon
            tri.extend([[a,b,c],[b,d,c]])
    add_geo(bone,mat,verts,tri)


def cylinder_between(bone, mat, a, b, radius0, radius1=None, sides=8):
    a=V(*a);b=V(*b)
    if radius1 is None:radius1=radius0
    d=b-a;L=np.linalg.norm(d)
    if L<1e-7:return
    ax=d/L
    u=np.cross(ax,V(0,0,1))
    if np.linalg.norm(u)<1e-7: u=np.cross(ax,V(0,1,0))
    u/=np.linalg.norm(u);v=np.cross(ax,u)
    verts=[]
    for p, r in ((a,radius0),(b,radius1)):
        for j in range(sides):
            ang=2*math.pi*j/sides
            verts.append(p+r*(u*math.cos(ang)+v*math.sin(ang)))
    faces=[]
    for j in range(sides):
        k=(j+1)%sides
        faces += [[j,k,sides+j],[k,sides+k,sides+j]]
    faces += [[0,j+1,j] for j in range(1,sides-1)]
    faces += [[sides,sides+j,sides+j+1] for j in range(1,sides-1)]
    add_geo(bone,mat,verts,faces)


def feather(bone,mat,origin,tip,width=.02,normal=(0,1,0),bend=0,tip_material=None,segments=7):
    # Lenticular, tapering *closed* geometry: slightly curved vane, spine ridge.
    p=V(*origin);q=V(*tip);n=V(*normal);n/=np.linalg.norm(n)
    f=q-p;L=np.linalg.norm(f)
    if L<1e-6:return
    f/=L
    side=np.cross(f,n)
    if np.linalg.norm(side)<1e-6:side=np.cross(f,V(1,0,0))
    side/=np.linalg.norm(side)
    verts=[];faces=[]
    for i in range(segments+1):
        t=i/segments
        # wider near base, pointed near distal tip
        w=width*(0.12+0.88*(math.sin(math.pi*(t*.88+.05))**.78))*(1-t**7)
        mid=p+(q-p)*t+n*(bend*math.sin(math.pi*t))
        verts.extend([mid-side*w,mid+n*(.003+.006*math.sin(math.pi*t)),mid+side*w,mid-n*.003])
    for i in range(segments):
        a=i*4;b=(i+1)*4
        faces+= [[a,b,a+1],[a+1,b,b+1],[a+1,b+1,a+2],[a+2,b+1,b+2],
                 [a+3,b+3,a],[a,b+3,b],[a+2,b+2,a+3],[a+3,b+2,b+3]]
    add_geo(bone,mat,verts,faces)
    if tip_material:
        tipstart=p+.8*(q-p)
        # colored tip is a separate thin feather overlay along the same vane
        feather(bone,tip_material,tipstart,q+0.0008*n,width*.50,n,bend*.12,segments=3)


def eye(bone, side):
    x=side*.059
    ellipsoid(bone,'burnt_umber',(x,.012,-.039),(.018,.018,.020),8,12)
    ellipsoid(bone,'eye_amber',(x+side*.006,.012,-.043),(.013,.013,.013),8,12)
    ellipsoid(bone,'iris_dark',(x+side*.014,.012,-.046),(.0075,.009,.008),8,12)
    ellipsoid(bone,'glint',(x+side*.019,.017,-.051),(.0028,.003,.003),6,8)

# ----- Assemble meshes -----
# Body silhouette and pale breast
ellipsoid('Body','russet',(0,.092,.027),(.124,.116,.199),lat=14,lon=22,tilt=(.13,0,0))
ellipsoid('Body','sienna',(0,.159,.041),(.110,.044,.155),lat=8,lon=18,tilt=(.09,0,0))
ellipsoid('Body','cream',(0,.083,-.111),(.094,.108,.106),lat=12,lon=18,tilt=(-.09,0,0))
ellipsoid('Body','warm_cream',(0,.037,-.068),(.080,.061,.110),lat=9,lon=16)

# Back/lower back ruffled contour feathers
for side in (-1,1):
    for layer in range(4):
        for j in range(8):
            t=j/7
            x=side*(.025+.092*t)
            z=-.085 + layer*.085 + .014*math.sin(j*1.4)
            h=.178 + .045*math.sqrt(max(0,1-(x/.128)**2)) - layer*.010
            color=['rust_highlight','sienna','russet','feather_tan'][int((j+layer)%7==0)*3 if j%7==0 else (j+layer)%3]
            feather('Body', color,(x*.83,h,z), (x*1.03,h-.028,z+.080),width=.014,normal=(side*.30,.95,0),bend=.005)

# Feathered neck rises to head
ellipsoid('Neck','russet',(0,.038,-.026),(.068,.092,.064),lat=11,lon=16,tilt=(-.30,0,0))
ellipsoid('Neck','cream',(0,.040,-.066),(.052,.086,.037),lat=10,lon=16,tilt=(-.24,0,0))
for side in (-1,1):
    for i in range(6):
        y=-.028+i*.021
        z=-.080 + .009*math.sin(i)
        feather('Neck','warm_cream' if i%2==0 else 'cream',(side*.025,y,z),(side*.032,y-.028,z-.016),width=.011,normal=(0,0,-1),bend=.003)

# Head with slightly darker cheek patches
ellipsoid('Head','russet',(0,0,-.003),(.065,.065,.069),lat=12,lon=18)
ellipsoid('Head','cream',(0,-.021,-.046),(.043,.035,.041),lat=9,lon=12)
for side in (-1,1):
    ellipsoid('Head','feather_tan',(side*.038,-.024,-.039),(.024,.025,.026),lat=8,lon=10)
    eye('Head',side)
    # little red facial wattle, near beak bottom
    ellipsoid('Head','wattle_red',(side*.025,-.052,-.074),(.012,.020,.014),lat=7,lon=10)

# upper/lower beak cones with honest separate lower jaw bone
cylinder_between('Head','beak',(0,-.023,-.066),(0,-.033,-.121),.028,.004,6)
cylinder_between('LowerBeak','beak_tip',(0,.001,.001),(0,-.019,-.030),.020,.002,6)
# comb and feathered crown (distinctive silhouette)
for i in range(5):
    x=(i-2)*.012;z=-.014+i*.016
    feather('Head','comb_copper' if i%2==0 else 'comb_orange',(x,.045,z),(x*1.5,.101-(i-2)**2*.004,z+.019),width=.011,normal=(0,0,-1),bend=.005)
# offset sweeping head plume
for side in (-1,1):
    feather('Head','comb_orange',(side*.024,.043,.016),(side*.036,.099,.055),width=.014,normal=(0,0,-1),bend=.005)

# Pair of patterned wing shields, with overlapping flight feathers
for side,bone in ((-1,'Wing_L'),(1,'Wing_R')):
    # side relative x outward; closer to back than chest
    ellipsoid(bone,'burnt_umber',(side*.019,-.008,.054),(.035,.054,.121),lat=9,lon=16,tilt=(.34,0,-side*.19))
    ellipsoid(bone,'russet',(side*.034,.012,.029),(.027,.034,.082),lat=8,lon=12,tilt=(.32,0,0))
    for row in range(3):
        for j in range(7):
            z=-.038+j*.027 + row*.018
            y=.026-row*.025 + (j/6)*(-.022)
            x=side*(.043+row*.005)
            dest=(x+side*.007, y-.029-row*.006, z+.061)
            palette=['rust_highlight','feather_tan','cream','russet','warm_cream','sienna']
            mat=palette[(j*3+row*2+int(side>0))%len(palette)]
            feather(bone,mat,(x,y,z),dest,width=.014 + .003*row,normal=(side,0,0),bend=.003)
    for k in range(9):
        z=.04+k*.015
        y=-.020 -k*.004
        x=side*.047
        feather(bone,'deep_brown' if k%3!=0 else 'feather_grey',(x,y,z),(x+side*.018,y-.044,z+.065),width=.015,normal=(side,0,0),bend=.004,tip_material='feather_tan' if k%2==0 else None)

# Puffed tail fans: tapering tapered vanes spreading from rump
ellipsoid('Tail','russet',(0,.010,.022),(.065,.056,.07),lat=8,lon=12)
for i in range(13):
    t=(i-6)/6
    start=(t*.019, .009 + (1-abs(t))*.022, .023)
    end=(t*.110,.088 + .038*(1-abs(t)), .175 +.060*(1-abs(t)))
    palette=['deep_brown','burnt_umber','feather_grey','feather_tan','russet']
    feather('Tail',palette[i%5],start,end,width=.021,normal=(0,.96,-.27),bend=.022,tip_material='cream' if i%5==2 else None)

# Legs are structurally separated at articulated hip/knee/shank, allowing IK-like gait clips.
for side,thigh,shank in ((-1,'Thigh_L','Shank_L'),(1,'Thigh_R','Shank_R')):
    ellipsoid(thigh,'russet',(0,-.008,.005),(.035,.047,.046),lat=8,lon=12)
    cylinder_between(thigh,'leg',(0,-.020,.001),(0,-.066,-.010),.013,.010,sides=8)
    ellipsoid(thigh,'feather_tan',(0,-.014,.017),(.027,.034,.029),lat=7,lon=10)
    cylinder_between(shank,'leg_light',(0,0,0),(0,-.052,-.004),.010,.009,sides=8)
    cylinder_between(shank,'leg',(0,-.049,-.004),(0,-.060,-.008),.014,.011,sides=8)
    # toes splay forward -Z, each with small ivory claw
    for i in (-1,0,1):
        toe=(i*.030,-.059,-.072 + abs(i)*.013)
        cylinder_between(shank,'leg',(0,-.056,-.004),toe,.009,.005,sides=6)
        clawstart=toe
        clawtip=(toe[0]*1.15,-.060,toe[2]-.020)
        cylinder_between(shank,'claw',clawstart,clawtip,.005,0.0009,sides=6)
    cylinder_between(shank,'leg',(0,-.054,-.002),(side*.008,-.055,.048),.008,.003,sides=6)

# ----- Build valid self-contained GLB 2.0 -----
class Binary:
    def __init__(self):
        self.b=bytearray();self.views=[];self.accessors=[]
    def append(self,data):
        while len(self.b)%4:self.b.append(0)
        off=len(self.b);self.b.extend(data);return off,len(data)
    def accessor(self, arr, component, typ, target=None, minmax=False):
        arr=np.asarray(arr)
        dtype={5121:np.uint8,5123:np.uint16,5125:np.uint32,5126:np.float32}[component]
        arr=arr.astype(dtype)
        data=arr.tobytes(order='C');off,l=self.append(data)
        view={'buffer':0,'byteOffset':off,'byteLength':l}
        if target:view['target']=target
        viewid=len(self.views);self.views.append(view)
        accessor={'bufferView':viewid,'byteOffset':0,'componentType':component,'count':int(arr.shape[0]),'type':typ}
        if minmax:
            accessor['min']=np.asarray(arr).min(axis=0).tolist()
            accessor['max']=np.asarray(arr).max(axis=0).tolist()
        n=len(self.accessors);self.accessors.append(accessor)
        return n
bin=Binary()

matlist=[];matidx={}
for n,color in MATERIALS.items():
    matidx[n]=len(matlist)
    matlist.append({'name':n,'pbrMetallicRoughness':{'baseColorFactor':[float(v) for v in color]+[1.0],'metallicFactor':0.0,'roughnessFactor':.87},'doubleSided':True})

primitives=[];total_triangles=0
for mat,buf in PARTS.items():
    xyz=np.array(buf['vertices'],dtype=np.float32)
    faces=np.array(buf['triangles'],dtype=np.uint32)
    # smooth normals, preserving sculptured faceting at feather edges with distinct vertices
    nrm=np.zeros_like(xyz)
    ee=np.cross(xyz[faces[:,1]]-xyz[faces[:,0]],xyz[faces[:,2]]-xyz[faces[:,0]])
    for j in range(3):np.add.at(nrm,faces[:,j],ee)
    ll=np.linalg.norm(nrm,axis=1)
    nrm=nrm/np.maximum(ll[:,None],1e-10)
    joints=np.zeros((len(xyz),4),dtype=np.uint16)
    joints[:,0]=np.array(buf['joints'],dtype=np.uint16)
    weights=np.zeros((len(xyz),4),dtype=np.float32);weights[:,0]=1
    pos_acc=bin.accessor(xyz,5126,'VEC3',target=34962,minmax=True)
    nrm_acc=bin.accessor(nrm,5126,'VEC3',target=34962)
    jnt_acc=bin.accessor(joints,5123,'VEC4',target=34962)
    wgt_acc=bin.accessor(weights,5126,'VEC4',target=34962)
    ind_acc=bin.accessor(faces.reshape(-1),5125,'SCALAR',target=34963)
    primitives.append({'attributes':{'POSITION':pos_acc,'NORMAL':nrm_acc,'JOINTS_0':jnt_acc,'WEIGHTS_0':wgt_acc},'indices':ind_acc,'material':matidx[mat], 'mode':4})
    total_triangles+=len(faces)

nodes=[]
for name,parent,t in BONES:
    nodes.append({'name':name,'translation':list(np.array(t)*S),'rotation':[0,0,0,1],'children':[]})
for name,parent,t in BONES:
    if parent:nodes[BONE_ID[parent]]['children'].append(BONE_ID[name])
nodes.append({'name':'Folhisco_SkinnedMesh','mesh':0,'skin':0})
meshnode=len(nodes)-1
nodes.append({'name':'Folhisco_Scene','children':[0,meshnode]})
scene_node=len(nodes)-1
# inverse rest/bind matrix for each bone at bind-pose world position
ibms=[]
for name,_,_ in BONES:
    m=np.eye(4,dtype=np.float32);m[:3,3]=-REST[name]
    ibms.append(m.T.reshape(-1))   # glTF MAT4 is column-major
ibm_acc=bin.accessor(np.array(ibms,dtype=np.float32),5126,'MAT4')

# ----- Animation clips -----
# Each clip: per joint, set keys for T/R; absent joints stay in bind pose.
def quat(axis, angle):
    v=np.array(axis,dtype=np.float64);v/=np.linalg.norm(v)
    return list((v*math.sin(angle/2)).astype(float))+[float(math.cos(angle/2))]
def rot_x(a):return quat((1,0,0),a)
def rot_y(a):return quat((0,1,0),a)
def rot_z(a):return quat((0,0,1),a)
def quateul(x=0,y=0,z=0):
    # yaw * pitch * roll as quaternion product
    qx=np.array(rot_x(x));qy=np.array(rot_y(y));qz=np.array(rot_z(z))
    def mul(a,b):
        x,y,z,w=a;X,Y,Z,W=b
        return np.array([w*X+x*W+y*Z-z*Y,w*Y-x*Z+y*W+z*X,w*Z+x*Y-y*X+z*W,w*W-x*X-y*Y-z*Z])
    q=mul(mul(qy,qx),qz);return (q/np.linalg.norm(q)).tolist()

ANIMS=[]
def clip(name, duration, curves, note):
    """curves {bone: {'rotation': [(time, [xyzw]),...], 'translation':[(time, xyz),...]}}"""
    ch=[];sam=[]
    for bone,keys in curves.items():
        for path,frames in keys.items():
            times=np.array([x[0] for x in frames],dtype=np.float32)
            vals=np.array([x[1] for x in frames],dtype=np.float32)
            assert len(times)>1 and abs(times[0])<1e-6 and abs(times[-1]-duration)<1e-4,(name,bone,path)
            ia=bin.accessor(times,5126,'SCALAR',minmax=True)
            oa=bin.accessor(vals,5126,'VEC4' if path=='rotation' else 'VEC3')
            sid=len(sam);sam.append({'input':ia,'output':oa,'interpolation':'LINEAR'})
            ch.append({'sampler':sid,'target':{'node':BONE_ID[bone],'path':path}})
    ANIMS.append({'name':name,'channels':ch,'samplers':sam,'extras':{'durationSeconds':duration,'behavior':note,'loop':name not in ['death','hurt']}})

def r(frames,ax='x'):
    f={'x':rot_x,'y':rot_y,'z':rot_z}[ax]
    return [(float(t),f(math.radians(deg))) for t,deg in frames]
def t(frames):return [(float(x),[float(k*S) for k in v]) for x,v in frames]
def Tbody(vals):return t([(x,(0,.115+y,z)) for x,y,z in vals])

clip('idle',3.0,{
 'Body':{'translation':Tbody([(0,0,0),(.75,.003,0),(1.5,0,0),(2.25,.003,0),(3,0,0)])},
 'Head':{'rotation':r([(0,0),(.8,5),(1.4,-3),(2.3,2),(3,0)],'y')},
 'Tail':{'rotation':r([(0,0),(.9,5),(1.7,0),(2.5,-4),(3,0)],'x')}
},'Breathing, relaxed vigilance and tiny head shifts')

clip('walk',1.0,{
 'Body':{'translation':Tbody([(0,0,0),(.25,.006,0),(.5,0,0),(.75,.006,0),(1,0,0)])},
 'Thigh_L':{'rotation':r([(0,24),(.25,0),(.50,-24),(.75,0),(1,24)])},
 'Thigh_R':{'rotation':r([(0,-24),(.25,0),(.50,24),(.75,0),(1,-24)])},
 'Shank_L':{'rotation':r([(0,-10),(.25,18),(.5,30),(.75,-5),(1,-10)])},
 'Shank_R':{'rotation':r([(0,30),(.25,-5),(.5,-10),(.75,18),(1,30)])},
 'Head':{'rotation':r([(0,4),(.25,0),(.5,-4),(.75,0),(1,4)])},
 'Tail':{'rotation':r([(0,0),(.25,3),(.5,0),(.75,-3),(1,0)],'y')}
},'Alternating steps, foot lift and head stabilization')

clip('run',.60,{
 'Body':{'translation':Tbody([(0,0,0),(.15,.016,-.008),(.30,.003,0),(.45,.016,-.008),(.60,0,0)])},
 'Thigh_L':{'rotation':r([(0,36),(.15,0),(.3,-38),(.45,0),(.6,36)])},
 'Thigh_R':{'rotation':r([(0,-38),(.15,0),(.3,36),(.45,0),(.6,-38)])},
 'Shank_L':{'rotation':r([(0,-15),(.15,15),(.3,48),(.45,-8),(.6,-15)])},
 'Shank_R':{'rotation':r([(0,48),(.15,-8),(.3,-15),(.45,15),(.6,48)])},
 'Wing_L':{'rotation':r([(0,-8),(.15,-17),(.3,-8),(.45,-17),(.6,-8)],'z')},
 'Wing_R':{'rotation':r([(0,8),(.15,17),(.3,8),(.45,17),(.6,8)],'z')},
 'Neck':{'rotation':r([(0,-6),(.15,-9),(.3,-6),(.45,-9),(.6,-6)])}
},'High-frequency running/flee cycle with pumping legs')

clip('peck',1.25,{
 'Neck':{'rotation':r([(0,0),(.27,-42),(.43,-49),(.65,-31),(.8,-48),(.95,-10),(1.25,0)])},
 'Head':{'rotation':r([(0,0),(.27,-16),(.43,-28),(.65,-2),(.80,-28),(.95,2),(1.25,0)])},
 'Body':{'translation':Tbody([(0,0,0),(.4,-.006,0),(.9,-.006,0),(1.25,0,0)])}
},'Double rapid beak strike to collect food')

clip('scratch',1.6,{
 'Neck':{'rotation':r([(0,0),(.35,-15),(1.2,-14),(1.6,0)])},
 'Thigh_L':{'rotation':r([(0,0),(.3,-18),(.54,22),(.78,-19),(1.03,25),(1.28,-17),(1.6,0)])},
 'Shank_L':{'rotation':r([(0,0),(.3,38),(.54,-25),(.78,35),(1.03,-20),(1.28,35),(1.6,0)])},
 'Body':{'rotation':r([(0,0),(.5,4),(1,4),(1.6,0)],'z')}
},'Ground scratching with one raised foot')

clip('scan_head',2.8,{
 'Neck':{'rotation':r([(0,0),(.5,0),(.9,-21),(1.25,-21),(1.75,23),(2.15,23),(2.8,0)],'y')},
 'Head':{'rotation':r([(0,0),(.5,10),(.9,-22),(1.25,-14),(1.75,20),(2.15,8),(2.8,0)],'y')},
 'Body':{'rotation':r([(0,0),(1.1,-1),(2.0,1),(2.8,0)],'z')}
},'Independent head turns to sample peripheral visual field')

clip('alert',1.6,{
 'Neck':{'rotation':r([(0,0),(.23,19),(.65,17),(1.05,18),(1.6,0)])},
 'Head':{'rotation':r([(0,0),(.25,-9),(.6,5),(1.05,-6),(1.6,0)],'y')},
 'Wing_L':{'rotation':r([(0,0),(.27,-13),(1.1,-11),(1.6,0)],'z')},
 'Wing_R':{'rotation':r([(0,0),(.27,13),(1.1,11),(1.6,0)],'z')}
},'Raised posture; attentive toward suspicious stimulus')

clip('alarm_call',1.9,{
 'Neck':{'rotation':r([(0,0),(.18,21),(.55,16),(.88,24),(1.33,17),(1.9,0)])},
 'Head':{'rotation':r([(0,0),(.18,9),(.65,17),(1.25,10),(1.9,0)])},
 'LowerBeak':{'rotation':r([(0,0),(.21,-24),(.43,0),(.59,-26),(.78,0),(1.00,-28),(1.18,0),(1.47,-21),(1.9,0)])},
 'Wing_L':{'rotation':r([(0,0),(.22,-15),(1.25,-9),(1.9,0)],'z')},
 'Wing_R':{'rotation':r([(0,0),(.22,15),(1.25,9),(1.9,0)],'z')}
},'Repeated alarm vocalization with moving lower beak')

clip('jump_flap',1.2,{
 'Body':{'translation':Tbody([(0,0,0),(.17,.028,0),(.43,.150,0),(.69,.145,-.012),(.95,.04,0),(1.2,0,0)])},
 'Wing_L':{'rotation':r([(0,0),(.12,-55),(.35,57),(.57,-52),(.79,50),(1.02,-30),(1.2,0)],'z')},
 'Wing_R':{'rotation':r([(0,0),(.12,55),(.35,-57),(.57,52),(.79,-50),(1.02,30),(1.2,0)],'z')},
 'Thigh_L':{'rotation':r([(0,0),(.16,-21),(.48,22),(.9,-18),(1.2,0)])},
 'Thigh_R':{'rotation':r([(0,0),(.16,-21),(.48,22),(.9,-18),(1.2,0)])},
 'Shank_L':{'rotation':r([(0,0),(.16,28),(.52,35),(.92,-8),(1.2,0)])},
 'Shank_R':{'rotation':r([(0,0),(.16,28),(.52,35),(.92,-8),(1.2,0)])}
},'Short nonflying vertical jump with stabilizing wing beats')

clip('hide',2.4,{
 'Body':{'translation':Tbody([(0,0,0),(.46,-.047,.005),(1.6,-.046,.005),(2.4,0,0)])},
 'Neck':{'rotation':r([(0,0),(.45,-31),(1.72,-31),(2.4,0)])},
 'Head':{'rotation':r([(0,0),(.45,-21),(1.8,-17),(2.4,0)])},
 'Wing_L':{'rotation':r([(0,0),(.40,11),(1.9,11),(2.4,0)],'z')},
 'Wing_R':{'rotation':r([(0,0),(.40,-11),(1.9,-11),(2.4,0)],'z')}
},'Crouch into low foliage and hold still')

clip('hurt',.8,{
 'Body':{'rotation':r([(0,0),(.12,-17),(.26,12),(.42,-6),(.8,0)],'z')},
 'Neck':{'rotation':r([(0,0),(.13,-16),(.36,15),(.8,0)])},
 'Wing_L':{'rotation':r([(0,0),(.12,-30),(.33,8),(.8,0)],'z')},
 'Wing_R':{'rotation':r([(0,0),(.12,30),(.33,-8),(.8,0)],'z')}
},'Short stagger after damage; non-looping')

clip('death',2.4,{
 'Body':{'rotation':r([(0,0),(.5,-12),(1.1,-49),(1.7,-92),(2.4,-92)],'z'),
         'translation':t([(0,(0,.115,0)),(.9,(0,.100,0)),(1.7,(.01,.065,0)),(2.4,(.01,.065,0))])},
 'Neck':{'rotation':r([(0,0),(.5,-10),(1.1,-24),(2.4,-33)])},
 'Head':{'rotation':r([(0,0),(.8,-6),(1.4,-23),(2.4,-23)],'y')},
 'Wing_L':{'rotation':r([(0,0),(1,-17),(2.4,-26)],'z')},
 'Wing_R':{'rotation':r([(0,0),(1,19),(2.4,28)],'z')},
 'Thigh_L':{'rotation':r([(0,0),(1.7,30),(2.4,30)])},
 'Thigh_R':{'rotation':r([(0,0),(1.7,-34),(2.4,-34)])}
},'Falls to side and remains motionless; non-looping')

clip('drink',1.6,{
 'Neck':{'rotation':r([(0,0),(.3,-41),(.48,-45),(.68,-38),(.98,-44),(1.26,-14),(1.6,0)])},
 'Head':{'rotation':r([(0,0),(.35,-5),(.65,-10),(1.04,7),(1.6,0)])},
 'Body':{'translation':Tbody([(0,0,0),(.45,-.013,0),(1.15,-.012,0),(1.6,0,0)])}
},'Lower beak toward a puddle and sip water')

clip('preen',2.2,{
 'Neck':{'rotation':[(0,quateul(0,0,0)),(.45,quateul(-22,0,0)),(.9,quateul(-28,28,-10)),(1.35,quateul(-33,35,-9)),(1.75,quateul(-20,8,0)),(2.2,quateul())]},
 'Head':{'rotation':r([(0,0),(.55,-8),(.95,27),(1.25,10),(1.55,27),(2.2,0)],'y')},
 'Wing_R':{'rotation':r([(0,0),(.7,18),(1.3,24),(2.2,0)],'z')}
},'Groom and rearrange the feathers on the wing')

clip('sleep',3.5,{
 'Body':{'translation':Tbody([(0,0,0),(.8,-.035,0),(2.8,-.036,0),(3.5,0,0)])},
 'Neck':{'rotation':r([(0,0),(.8,-24),(2.8,-26),(3.5,0)])},
 'Head':{'rotation':r([(0,0),(.8,12),(2.8,12),(3.5,0)],'y')},
 'Wing_L':{'rotation':r([(0,0),(.8,8),(2.8,8),(3.5,0)],'z')},
 'Wing_R':{'rotation':r([(0,0),(.8,-8),(2.8,-8),(3.5,0)],'z')}
},'Crouching rest; subtle breathing loop')

# global metadata; optional glTF extras under root
scene={
 'asset':{'version':'2.0','generator':'Wildhaven Folhisco procedural rig builder v0.1','copyright':'Original Wildhaven project asset'},
 'scene':0,'scenes':[{'name':'Wildhaven Folhisco','nodes':[scene_node]}],
 'nodes':nodes,'meshes':[{'name':'Folhisco_MidPoly_L0','primitives':primitives}],
 'skins':[{'name':'Folhisco_Rig','inverseBindMatrices':ibm_acc,'joints':list(range(len(BONES))),'skeleton':0}],
 'materials':matlist,'animations':ANIMS,
 'bufferViews':bin.views,'accessors':bin.accessors,'buffers':[{'byteLength':len(bin.b)}],
 'extras':{'creature':'Folhisco','speciesId':'folhisco','version':'0.1.0','unit':'meter','rig':'skinning rigid per anatomical region','notes':'Original game-ready prototype, not final production rig','clipNames':[a['name'] for a in ANIMS]}
}

def padded(raw):return raw+b' ' * ((-len(raw))%4)
json_bytes=padded(json.dumps(scene,ensure_ascii=False,separators=(',',':')).encode())
bin_bytes=bytes(bin.b)
bin_bytes+=b'\x00'*((-len(bin_bytes))%4)
glb=struct.pack('<4sII',b'glTF',2,12+8+len(json_bytes)+8+len(bin_bytes))
glb+=struct.pack('<I4s',len(json_bytes),b'JSON')+json_bytes
GLB=glb+struct.pack('<I4s',len(bin_bytes),b'BIN\x00')+bin_bytes
filename=OUT/'folhisco_animated_v01.glb'
filename.write_bytes(GLB)
# write JSON metadata only (the binary file is the source for all animation tracks)
positions=np.vstack([np.asarray(v['vertices']) for v in PARTS.values()]);bbox=[positions.min(axis=0).tolist(),positions.max(axis=0).tolist()]
info={'name':'Folhisco','version':'0.1.0','format':'glTF 2.0 / GLB','file':filename.name,
      'assetBytes':len(GLB),'sha256':hashlib.sha256(GLB).hexdigest(),
      'rigJoints':[a[0] for a in BONES], 'vertexCount':len(positions),'triangles':total_triangles,
      'staticGeometryBoundingBoxM':bbox,'durationSecondsByClip':{a['name']:a['extras']['durationSeconds'] for a in ANIMS},
      'skinned':True,'materialCount':len(MATERIALS),'source':'generate_folhisco.py',
      'limitations':['Rigid weighting: no soft skin deformation','Hand-authored procedural stylization, not sculpted production mesh','Prototype animation data is in-place; game movement should drive root transform']}
(OUT/'folhisco_manifest.json').write_text(json.dumps(info,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(info,ensure_ascii=False,indent=2))
