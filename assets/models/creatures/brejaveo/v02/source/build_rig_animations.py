#!/usr/bin/env python3
"""Wildhaven Brejaveo v02 — GLB 2.0 skinned and animated, from approved-concept v01 blockout.

Python-only glTF binary pipeline, preserving every original 3D primitive/UV/material.
Adds real skin joint indices+blend weights to each of 89 source primitives, a 33-joint
nested skeleton, inverse bind matrices and 24 playable animation timelines.
No rig/animation claimed as biomechanical simulation: tongue hooking and contact
remain gameplay dependent. The v01 GLB is never overwritten.
"""
import json,struct,math,hashlib
from collections import Counter
from pathlib import Path
import numpy as np
from scipy.spatial.transform import Rotation as R

HERE=Path(__file__).resolve().parent.parent
SOURCE=HERE.parent/'brejaveo_v01'/'brejaveo-v01-anatomia-blockout.glb'
OUT=HERE/'brejaveo-v02-skinned-animated-LOD0.glb'
M=HERE/'manifest.json'

class GLB:
    def __init__(self,p):
        data=Path(p).read_bytes()
        mag,ver,total=struct.unpack_from('<4sII',data,0)
        assert mag==b'glTF' and ver==2 and total==len(data)
        pos=12; js=None; bn=None
        while pos<len(data):
            size,ctype=struct.unpack_from('<II',data,pos);pos+=8
            chunk=data[pos:pos+size];pos+=size
            if ctype==0x4e4f534a: js=json.loads(chunk)
            if ctype==0x004e4942: bn=chunk
        assert js is not None and bn is not None
        self.doc=js;self.buffer=bytearray(bn)
    def array(self,index):
        a=self.doc['accessors'][index];v=self.doc['bufferViews'][a['bufferView']]
        dtype={5121:np.uint8,5123:np.uint16,5125:np.uint32,5126:np.float32}[a['componentType']]
        n={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]
        offset=v.get('byteOffset',0)+a.get('byteOffset',0)
        if 'byteStride' in v:
            bs=v['byteStride'];assert bs>=np.dtype(dtype).itemsize*n
            arr=np.array([np.frombuffer(self.buffer,dtype=dtype,count=n,offset=offset+i*bs) for i in range(a['count'])])
        else:
            arr=np.frombuffer(self.buffer,dtype=dtype,count=n*a['count'],offset=offset).reshape(a['count'],n).copy()
        return arr
    def add(self,arr,component,atype,target=None):
        a=np.ascontiguousarray(arr)
        while len(self.buffer)%4:self.buffer.append(0)
        start=len(self.buffer);self.buffer.extend(a.tobytes());size=a.nbytes
        view={'buffer':0,'byteOffset':start,'byteLength':size}
        if target is not None: view['target']=target
        bvi=len(self.doc['bufferViews']);self.doc['bufferViews'].append(view)
        dims=1 if atype=='SCALAR' else 16 if atype=='MAT4' else int(atype[-1]);
        val={'bufferView':bvi,'componentType':component,'count':len(a),'type':atype}
        if atype!='MAT4':
            v=a.reshape(len(a),dims);val['min']=np.min(v,axis=0).tolist();val['max']=np.max(v,axis=0).tolist()
        idx=len(self.doc['accessors']);self.doc['accessors'].append(val);return idx
    def save(self,p):
        self.doc['buffers'][0]['byteLength']=len(self.buffer)
        j=json.dumps(self.doc,ensure_ascii=False,separators=(',',':')).encode('utf8')
        j+=b' ' *((-len(j))%4)
        b=bytes(self.buffer)+b'\0' *((-len(self.buffer))%4)
        glb=struct.pack('<4sII',b'glTF',2,12+8+len(j)+8+len(b))
        glb+=struct.pack('<II',len(j),0x4e4f534a)+j
        glb+=struct.pack('<II',len(b),0x004e4942)+b
        Path(p).write_bytes(glb)

src=GLB(SOURCE);doc=src.doc
assert len(doc['meshes'])==89 and len(doc['nodes'])==90
assert sum(sum(len(src.array(p['indices'])) for p in m['primitives']) for m in doc['meshes'])==3692*3
origtri=3692

# Joint parent indices, REST WORLD xyz in meters (actual skeletal pivots); each joint inherits parent.
joints=[]
def add(name,at,parent=None):
    jid=len(joints);joints.append({'name':name,'at':np.array(at,dtype=np.float64),'parent':parent});return jid
root=add('root_world',[0,0,0]);body=add('spine_chest',[0,0,1.44],root)
neck1=add('neck_base',[-1.2,0,1.53],body);neck2=add('neck_flex',[-1.72,0,1.74],neck1)
head=add('skull',[-2.17,0,1.90],neck2);jaw=add('jaw_lower',[-2.09,0,1.77],head)
tongue=add('tongue_retractor',[-2.08,0,1.72],head)
tail0=add('tail_base',[1.12,0,1.36],body);tail1=add('tail_mid',[1.63,0,1.38],tail0);tail2=add('tail_distal',[2.17,0,1.50],tail1);tail3=add('tail_tip',[2.52,0,1.60],tail2)
parts={}
for s,lab in [(-1,'D'),(1,'E')]:
    hip=add(f'hip_{lab}',[.84,s*.43,1.33],body)
    knee=add(f'knee_{lab}',[1.10,s*.64,.84],hip)
    ankle=add(f'hock_{lab}',[.97,s*.74,.28],knee)
    foot=add(f'webbed_hindfoot_{lab}',[.65,s*.79,.13],ankle)
    shoulder=add(f'wing_shoulder_{lab}',[-.80,s*.50,1.66],body)
    elbow=add(f'wing_elbow_{lab}',[-.99,s*1.06,1.16],shoulder)
    wrist=add(f'wing_wrist_{lab}',[-1.28,s*1.48,.25],elbow)
    fingers=add(f'wing_ground_digits_{lab}',[-1.56,s*1.51,.10],wrist)
    wingbend=add(f'wing_spar_bend_{lab}',[-.32,s*1.86,2.05],shoulder)
    wingtip=add(f'wing_tip_{lab}',[.18,s*3.44,2.63],wingbend)
    rear=add(f'wing_rear_margin_{lab}',[.92,s*2.34,1.65],wingbend)
    parts[lab]=dict(hip=hip,knee=knee,ankle=ankle,foot=foot,shoulder=shoulder,elbow=elbow,wrist=wrist,fingers=fingers,wingbend=wingbend,wingtip=wingtip,rear=rear)
assert len(joints)==33, len(joints)

# Add glTF joint nodes at absolute REST locations but with parent-relative translations.
base_node=len(doc['nodes'])
nodeindex=[base_node+j for j in range(len(joints))]
for j,info in enumerate(joints):
    par=info['parent'];local=info['at']-(joints[par]['at'] if par is not None else np.array([0,0,0]))
    doc['nodes'].append({'name':info['name'],'translation':local.astype(float).tolist(),'rotation':[0,0,0,1]})
for j,info in enumerate(joints):
    if info['parent'] is None:doc['nodes'][0].setdefault('children',[]).append(nodeindex[j])
    else:doc['nodes'][nodeindex[info['parent']]].setdefault('children',[]).append(nodeindex[j])
# A joint at rest world translation T transforms a bound mesh by I when paired with inverse(T).
ibms=np.stack([np.array([[1,0,0,-q['at'][0]],[0,1,0,-q['at'][1]],[0,0,1,-q['at'][2]],[0,0,0,1]],np.float32).reshape(16,order='F') for q in joints])
inv_access=src.add(ibms,5126,'MAT4')
doc['skins']=[{'name':'Brejaveo_33Joint_WeightedSkin','inverseBindMatrices':inv_access,'skeleton':nodeindex[root],'joints':nodeindex}]

# Weight curves: continuous 1-2 bone blends along torso/neck/tail and the locomotor joints.
def blend(A,B,t):
    f=float(np.clip(t,0,1));f=f*f*(3-2*f)
    return [(A,1-f),(B,f)]
def interp_path(x,knots):
    if x<=knots[0][0]:return [(knots[0][1],1.0)]
    if x>=knots[-1][0]:return [(knots[-1][1],1.0)]
    for (a,ja),(b,jb) in zip(knots,knots[1:]):
        if a<=x<=b:return blend(ja,jb,(x-a)/(b-a))
    return [(knots[-1][1],1.)]
def skin_vertex(n,v):
    x,y,z=map(float,v)
    idx=int(n[:2]) if n[:2].isdigit() else 0
    lab='D' if '_D' in n else 'E'
    P=parts[lab]
    if idx==1:
        if x< -1.0:return blend(body,neck1,(-x-1.0)/.27*.23)
        if x> .95:return blend(body,tail0,(x-.95)/.27*.25)
        return [(body,1.)]
    if idx==2:return interp_path(x,[(-2.1,head),(-1.91,neck2),(-1.63,neck1),(-1.1,body)])
    if idx==3:return interp_path(x,[(1.05,tail0),(1.60,tail1),(2.18,tail2),(2.65,tail3)])
    if idx==6 or idx==17:return [(jaw,1.)]
    if idx==8:return [(tongue,1.)]
    if idx==7:return interp_path(x,[(-2.14,head),(-1.9,neck2),(-1.68,neck1),(-1.47,body)])
    if idx in (4,5,9,10,11,12,13,14,15,16):return [(head,1.)]
    if idx==18:return blend(P['hip'],P['knee'],(1.25-z)/.48)
    if idx==19:return blend(P['knee'],P['ankle'],(.91-z)/.68)
    if idx==20:return blend(P['ankle'],P['foot'],(.29-z)/.17)
    if idx in (21,22):return [(P['foot'],1.)]
    if idx==23:return blend(P['shoulder'],P['elbow'],(1.68-z)/.52)
    if idx==24:return blend(P['elbow'],P['wrist'],(1.18-z)/.91)
    if idx in (25,26):return [(P['fingers'],1.)]
    if idx in (27,29,30,31,32):
        # Membrane spans multiple supporting bones. Pivots depend on radial distance
        # and trailing-edge shape, not just the mesh node label.
        ya=abs(y)
        if x> .55 and ya>1.65:return [(P['rear'],.72),(P['wingbend'],.28)]
        if ya>2.8:return blend(P['wingbend'],P['wingtip'],(ya-2.8)/.62)
        if ya>1.55:return blend(P['shoulder'],P['wingbend'],(ya-1.55)/.95)
        return [(P['shoulder'],1.)]
    if idx==28:return blend(P['elbow'],P['wingbend'],(abs(y)-.75)/1.2)
    if idx==33:return [(body,1.)]
    return [(body,1.)]

counts=Counter(); norm_errors=0
for mesh in doc['meshes']:
    name=mesh['name']
    for primitive in mesh['primitives']:
        arr=src.array(primitive['attributes']['POSITION'])
        js=np.zeros((len(arr),4),dtype=np.uint16);ws=np.zeros((len(arr),4),dtype=np.float32)
        for i,v in enumerate(arr):
            pairs=skin_vertex(name,v)
            tot=sum(w for _,w in pairs)
            assert tot>0
            for k,(j,w) in enumerate(pairs[:4]):js[i,k]=j;ws[i,k]=w/tot;counts[j]+=1
            if abs(float(sum(ws[i]))-1)>1e-5:norm_errors+=1
        primitive['attributes']['JOINTS_0']=src.add(js,5123,'VEC4',34962)
        primitive['attributes']['WEIGHTS_0']=src.add(ws,5126,'VEC4',34962)
for n in doc['nodes'][:base_node]:
    if 'mesh' in n:n['skin']=0
assert norm_errors==0 and len(counts)==len(joints)-1, (norm_errors,len(counts))

# Playable timeline assembly. All active rotations use local joint axes.
# Quaternion x,y,z,w, right-handed. Neutral pose is read from the original GLB.
FK=[j['name'] for j in joints]
name_to_joint={x:i for i,x in enumerate(FK)}
def qrot(x=0,y=0,z=0):return R.from_euler('xyz',[x,y,z],degrees=True).as_quat().astype(np.float32)
def periodic(t,d):return math.sin(2*math.pi*t/d)
def ease01(t):
    x=float(np.clip(t,0,1));return x*x*(3-2*x)
def pulse(t,a,b,c,d):return ease01((t-a)/(b-a))* (1-ease01((t-c)/(d-c)))

def pose(clip,t,d):
    rt=np.zeros(3,dtype=np.float32);rot={};tong_scale=np.ones(3,dtype=np.float32)
    s=periodic(t,d)
    def put(j,x=0,y=0,z=0):rot[j]=qrot(x,y,z)
    # Mild spine and breathing in all living clips
    if clip not in ('death',):
        put(body,0,1.2*math.sin(2*math.pi*t/1.7),1.2*s)
        put(neck1,0,1.3*s,0);put(neck2,0,1.5*s,0)
        put(tail0,0,0,2.5*s);put(tail1,0,0,3*s);put(tail2,0,0,4.5*s);put(tail3,0,0,6*s)
        put(jaw,0,-.9*math.sin(2*math.pi*t/1.8),0)
    if clip in ('walk','run','wade','stalk'):
        run=clip=='run';pace=clip=='wade'
        phase=2*math.pi*t/(.72 if run else 1.3 if pace else 1.7 if clip=='stalk' else 1.3)
        swing=29 if run else 18 if clip=='walk' else 11
        rt[2]=(.035 if run else .021)*abs(math.sin(phase))
        put(body,0,2*math.sin(phase),3*math.sin(phase))
        for sgn,lab in [(-1,'D'),(1,'E')]:
            p=parts[lab]; ph=phase+(math.pi if lab=='E' else 0)
            put(p['hip'],0,swing*math.sin(ph),0)
            put(p['knee'],0,17+18*max(0,math.sin(ph+.75)),0)
            put(p['ankle'],0,-10*max(0,math.sin(ph+.75)),0)
            put(p['foot'],0,-8*math.sin(ph),0)
            put(p['shoulder'],0,-swing*.75*math.sin(ph+math.pi),0)
            put(p['elbow'],0,-12-7*max(0,math.cos(ph)),0)
            put(p['wrist'],0,10*max(0,math.cos(ph)),0)
            put(p['wingbend'],sgn*(3+3*math.sin(ph)),0,0)
            put(p['wingtip'],sgn*(2.5*math.sin(ph)),0,0)
    if clip in ('takeoff','fly','glide','landing','turn_left','turn_right'):
        if clip=='takeoff':
            a=ease01(t/d);flap=math.sin(t*2*math.pi/0.68)*a
            rt[2]=.85*a;put(body,0,-9*a,0)
        elif clip=='landing':
            a=ease01(t/d);flap=math.sin(t*2*math.pi/0.86)*(1-a)
            rt[2]=.85*(1-a);put(body,0,9*a,0)
        elif clip=='glide':
            a=1;flap=.15*s;rt[2]=.82+ .05*s;put(body,0,-6,0)
        else:
            a=1;flap=math.sin(t*2*math.pi/(.9 if clip=='fly' else 1.1));rt[2]=.9+.05*s
            put(body,0,-5,8*s if clip=='turn_left' else -8*s if clip=='turn_right' else 0)
        for sgn,lab in [(-1,'D'),(1,'E')]:
            p=parts[lab]
            put(p['hip'],0,-23,0);put(p['knee'],0,43,0)
            put(p['ankle'],0,21,0)
            put(p['shoulder'],sgn*(24*a+27*flap),-15*a,0)
            put(p['elbow'],sgn*(14*a+9*flap),-18*a,0)
            put(p['wrist'],0,11*a,0)
            put(p['wingbend'],sgn*(23*a+29*flap),0,0)
            put(p['wingtip'],sgn*(19*a+17*flap),0,0)
            put(p['rear'],sgn*(9*a+9*flap),0,0)
    if clip in ('tongue_aim','tongue_strike','tongue_hook_pull','bite_swallow','ambush','feed'):
        # Anchor root of tongue in mouth. Scale on longitudinal X is real skin transform,
        # not detached mesh; body/horns kept aligned with the original v01.
        if clip=='tongue_aim':
            a=ease01(t/d);put(head,0,0,-7*a);put(jaw,0,-9*a,0)
        elif clip=='tongue_strike':
            a=pulse(t,.07*d,.28*d,.64*d,.92*d)
            put(head,0,1.8*a,0);put(jaw,0,-34*a,0)
            tong_scale=np.array([1+3.0*a,1-.28*a,1-.28*a],np.float32)
            put(tongue,0,4*a,0)
        elif clip=='tongue_hook_pull':
            out=ease01(t/(d*.17))*(1-ease01((t-d*.37)/(d*.56)))
            tong_scale=np.array([1+3.0*out,1-.28*out,1-.28*out],np.float32)
            put(jaw,0,-31*out,0);put(head,0,-8*math.sin(math.pi*t/d),0)
            rt[0]=.1*math.sin(math.pi*t/d)
        elif clip=='bite_swallow':
            a=pulse(t,.05*d,.24*d,.60*d,.91*d)
            put(jaw,0,-35*a,0);put(head,0,8*a,0)
            put(neck1,0,7*a,0)
        elif clip=='ambush':
            a=pulse(t,.18*d,.36*d,.51*d,.75*d)
            rt[0]=-.27*a;rt[2]=.14*a
            put(head,0,-15*a,0);put(jaw,0,-14*a,0)
        else:
            a=.4+.6*abs(periodic(t,d));put(jaw,0,-18*a,0);put(head,0,7*a,0)
    if clip in ('hide','rest','sleep','alert','threat','hurt','death','idle','perch'):
        if clip in ('hide','rest','sleep','perch'):
            a=.65 if clip=='rest' else .85 if clip=='sleep' else .43 if clip=='perch' else .94
            rt[2]=-.3*a
            put(neck2,0,-13*a,0);put(head,0,14*a,0)
            for lab in ('D','E'):
                p=parts[lab];put(p['knee'],0,28*a,0);put(p['elbow'],0,20*a,0)
        if clip in ('alert','threat'):
            a=.8+.2*s;put(head,0,-8*a,0);put(neck2,0,8*a,0)
            if clip=='threat':
                put(jaw,0,-22*a,0)
                for sgn,lab in [(-1,'D'),(1,'E')]:put(parts[lab]['wingbend'],sgn*(13*a),0,0)
        if clip=='hurt':
            a=pulse(t,.10*d,.25*d,.53*d,.81*d)
            put(body,0,-13*a,8*a);put(head,0,16*a,0);rt[2]=-.12*a
        if clip=='death':
            a=ease01(t/(d*.73));rt[2]=-.50*a
            put(body,0,0,55*a);put(neck1,0,-17*a,0);put(head,0,13*a,0)
            for lab in ('D','E'):
                p=parts[lab];put(p['knee'],0,37*a,0);put(p['elbow'],0,18*a,0)
        if clip=='idle':
            put(head,0,3*math.sin(2*math.pi*t/3),3*math.sin(2*math.pi*t/4))
    if clip in ('turn_left','turn_right'):
        sign=1 if clip=='turn_left' else -1
        put(neck1,0,0,12*sign*s);put(head,0,0,12*sign*s)
        put(tail0,0,0,-10*sign*s);put(tail2,0,0,-13*sign*s)
    return rt,rot,tong_scale

# 24 ecologically relevant pose clips (not a gameplay state machine).
CLIPS={
 'idle':3.0,'walk':1.3,'run':.75,'wade':1.55,'stalk':1.8,
 'takeoff':1.7,'fly':1.8,'glide':2.4,'landing':1.7,
 'tongue_aim':1.4,'tongue_strike':1.45,'tongue_hook_pull':1.6,
 'bite_swallow':1.6,'ambush':1.3,'feed':2.1,
 'hide':2.0,'rest':3.0,'sleep':3.4,'alert':1.7,'threat':1.7,
 'hurt':1.2,'death':2.3,'turn_left':1.9,'turn_right':1.9,
}
assert len(CLIPS)==24
# register pose animation glTF: bind translations + pose animation root offset, quaternion rotations, tongue longitudinal scale
all_tracks={}
for clip,duration in CLIPS.items():
    fps=12 if clip in ('idle','sleep','rest','hide') else 18
    times=np.linspace(0,duration,int(duration*fps)+1).astype(np.float32)
    timeid=src.add(times[:,None],5126,'SCALAR')
    values=[pose(clip,float(t),duration) for t in times]
    samp=[];chn=[]
    def channel(node,path,values,type_):
        v=np.asarray(values,dtype=np.float32)
        assert np.isfinite(v).all()
        idx=src.add(v,5126,type_)
        n=len(samp);samp.append({'input':timeid,'output':idx,'interpolation':'LINEAR'});
        chn.append({'sampler':n,'target':{'node':node,'path':path}})
    channel(nodeindex[root],'translation',[v[0] for v in values],'VEC3')
    # QUAT always normalized
    for k in range(1,len(joints)):
        vals=[v[1].get(k,qrot()) for v in values]
        assert all(abs(np.linalg.norm(qq)-1)<1e-5 for qq in vals)
        if any(np.max(abs(val-qrot()))>1e-6 for val in vals):channel(nodeindex[k],'rotation',vals,'VEC4')
    if any(abs(float(v[2][0])-1)>1e-7 for v in values):channel(nodeindex[tongue],'scale',[v[2] for v in values],'VEC3')
    doc.setdefault('animations',[]).append({'name':clip,'samplers':samp,'channels':chn,'extras':{'duration_seconds':duration,'sample_rate_fps':fps}})
    all_tracks[clip]={'duration':duration,'frames':len(times),'channels':len(chn)}

src.save(OUT)
check=GLB(OUT)
assert len(check.doc['skins'])==1 and len(check.doc['skins'][0]['joints'])==len(joints)
assert len(check.doc['animations'])==len(CLIPS)
assert len(check.doc['meshes'])==89 and len(check.doc['images'])==1
for mes in check.doc['meshes']:
    for p in mes['primitives']:
        ja=check.array(p['attributes']['JOINTS_0']);wa=check.array(p['attributes']['WEIGHTS_0'])
        assert np.max(ja)<len(joints) and np.max(np.abs(np.sum(wa,axis=1)-1))<1e-5
        assert len(check.array(p['attributes']['POSITION']))==len(ja)==len(wa)
manifest={
 'species':'brejaveo','version':'v02','stage':'rig_skinning_animations','status':'technical_validation_pending_art_director_review',
 'base_glb':'../brejaveo_v01/brejaveo-v01-anatomia-blockout.glb',
 'base_sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
 'glb':OUT.name,'bytes':OUT.stat().st_size,'sha256':hashlib.sha256(OUT.read_bytes()).hexdigest(),
 'triangles':origtri,'meshes':len(check.doc['meshes']),'weighted_skin':True,'skins':1,'joints':len(joints),'animations':len(CLIPS),
 'clips':all_tracks,'texture':'embedded_v01_uv_atlas','texture_sha256':hashlib.sha256((HERE/'textures/brejaveo-v01-atlas-uv.png').read_bytes()).hexdigest(),
 'limitations':['Predation/latch contact requires simulation and collision integration; none is claimed.','No Alpha integration, no LOD1/LOD2 at this stage.','Approval of animations by director and independent QA pending.']
}
M.write_text(json.dumps(manifest,indent=2,ensure_ascii=False),encoding='utf8')
print(json.dumps({k:v for k,v in manifest.items() if k not in ('clips',)},ensure_ascii=False,indent=2))