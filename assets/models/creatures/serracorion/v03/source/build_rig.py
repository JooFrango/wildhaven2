#!/usr/bin/env python3
"""Serracorion v03 actual weighted glTF rig and authored action clips.

Preserves original v02 GLB POSITION/indices/UV/PNG, dorsal scute geometry.
Creates glTF skin, hierarchy, inverse binds, real keyframed quaternion animation.
Source of truth: approved Serracorion v02 with physically embedded back spines.
"""
from __future__ import annotations
import hashlib, json, math, struct, importlib.util
from pathlib import Path
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
V02=ROOT.parent/'wildhaven_serracorion_v02' if ROOT.parent.name=='data' else ROOT.parent/'v02'
# For CI, v03 is in .../serracorion/v03 and v02 is its sibling.
if not (V02/'serracorion-v02-espinhos-integrados.glb').exists():
    V02=ROOT.parent/'v02'
BASE=V02/'serracorion-v02-espinhos-integrados.glb'
SOURCE=V02/'source'/'build.py'
OUTPUT=ROOT/'serracorion-v03-rig-animado-LOD0.glb'
MANIFEST=ROOT/'manifest.json'

JOINTS=[
 ('root',None,(0.,0.,0.)),
 ('body_center','root',(0.,3.0,0.)),
 ('body_front','body_center',(-2.20,3.03,0.)),
 ('body_rear','body_center',(2.40,3.0,0.)),
 ('head','body_front',(-4.15,3.04,0.)),
 ('jaw','head',(-4.05,1.53,0.)),
 ('chelicera_L','head',(-4.68,2.43,1.03)),
 ('chelicera_R','head',(-4.68,2.43,-1.03))]
for side,sg in [('L',1),('R',-1)]:
    JOINTS += [
        (f'chela_{side}_shoulder','body_front',(-2.63,2.99,sg*1.51)),
        (f'chela_{side}_elbow',f'chela_{side}_shoulder',(-3.40,2.48,sg*2.70)),
        (f'chela_{side}_palm',f'chela_{side}_elbow',(-5.60,1.74,sg*4.05)),
        (f'chela_{side}_finger',f'chela_{side}_palm',(-5.99,1.55,sg*4.38))]
    for index,x in enumerate([-1.10,1.35,3.23]):
        f=-.35 if index==0 else (.45 if index==2 else .10)
        p='body_front' if index==0 else 'body_rear'
        hip=f'leg_{side}_{index}_hip';knee=f'leg_{side}_{index}_knee';ankle=f'leg_{side}_{index}_ankle'
        JOINTS += [(hip,p,(x,2.89,sg*1.66)),
                   (knee,hip,(x+f,2.00,sg*(3.03+(.15 if index==1 else 0)))),
                   (ankle,knee,(x+f+.47,.90,sg*3.45))]
TAIL_P=[(4.1,2.92,0),(5.55,3.30,0),(6.40,4.07,0),(6.84,5.96,0),
        (6.62,7.0,0),(5.99,7.91,0),(4.01,8.90,0),(1.74,8.83,0),(-1.35,7.15,0)]
for i,pt in enumerate(TAIL_P):
    JOINTS.append((f'tail_{i}', 'body_rear' if i==0 else f'tail_{i-1}',pt))
NAMES=[a for a,b,c in JOINTS];IDX={n:i for i,n in enumerate(NAMES)}
REST={n:np.array(v,float) for n,p,v in JOINTS}
PARENT={n:p for n,p,v in JOINTS}
CHILDREN={n:[] for n in NAMES}
for n,p,_ in JOINTS:
    if p:CHILDREN[p].append(n)
assert len(JOINTS)==43,(len(JOINTS),NAMES)


def import_glb(path):
    b=path.read_bytes();assert b[:4]==b'glTF' and struct.unpack_from('<I',b,8)[0]==len(b)
    n,t=struct.unpack_from('<I4s',b,12); assert t==b'JSON'
    j=json.loads(b[20:20+n]);ofs=20+n
    k,t=struct.unpack_from('<I4s',b,ofs); assert t==b'BIN\0'
    return j,bytearray(b[ofs+8:ofs+8+k]),hashlib.sha256(b).hexdigest()

def accessor(j,raw,index):
    a=j['accessors'][index];v=j['bufferViews'][a['bufferView']]
    dims={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]
    types={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}
    return np.frombuffer(raw,dtype=types[a['componentType']],count=a['count']*dims,
        offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,dims).copy()

def recover_tags():
    sp=importlib.util.spec_from_file_location('serracorion_v02_generator',SOURCE)
    mod=importlib.util.module_from_spec(sp);sp.loader.exec_module(mod)
    class Tagged(mod.Shape):
        def __init__(self): super().__init__();self.tags=[]
        def tri(self,a,b,c,ta,tb,tc,label):
            super().tri(a,b,c,ta,tb,tc,label)
            self.tags.extend([label]*3)
    obj=Tagged().build()
    return np.asarray(obj.verts,dtype=np.float32),np.asarray(obj.uv,dtype=np.float32),obj.tags,obj.parts

def smooth(a,b,x):
    u=np.clip((x-a)/(b-a),0,1);return u*u*(3-2*u)

def compute_weights(points,tags):
    ids=np.zeros((len(points),4),np.uint16)
    weights=np.zeros((len(points),4),np.float32)
    FRONT_TAGS={'chela_coxa','chela_forearm','chela_palm','massive_chela_fixed_finger',
                'massive_chela_movable_finger','chela_palm_scute','forearm_protective_plate'}
    LEG_TAGS={'ambulatory_coxa_femur','ambulatory_tibia','tarsal_claw','knee_knuckle_armor','tibial_spur'}
    HEAD_TAGS={'cephalic_shield','oral_cavity','teeth','orbital_rim','eyeball','nasal_crest','horn_brow','horn_temporal'}
    TAIL_TAGS={'segmented_tail','tail_segment_seam','tail_lateral_scutal_spine','caudal_scythe','caudal_blade_keel'}
    BODY_TAGS={'segmented_trunk','ventral_scutum','dorsal_integrated_plate','dorsal_integrated_spine'}
    def w_body(x):
        forward=1-smooth(-2.55,-.40,x);rear=smooth(.55,2.75,x)
        return {'body_front':forward,'body_rear':rear,'body_center':max(0.,1-max(forward,rear))}
    def project_line(q,a,b):
        vec=b-a
        return float(np.clip(np.dot(q-a,vec)/max(1e-8,np.dot(vec,vec)),0,1))
    for i,(q,tag) in enumerate(zip(points,tags)):
        x,y,z=q;sg='L' if z>=0 else 'R';sgn=1 if z>=0 else -1
        vals={}
        def add(n,w):vals[n]=vals.get(n,0)+max(0,float(w))
        if tag in BODY_TAGS:
            for name,w in w_body(x).items():add(name,w)
        elif tag in HEAD_TAGS:
            add('head',.95);add('body_front',.05)
        elif tag in {'lower_jaw','lower_teeth'}:
            add('jaw',.97);add('head',.03)
        elif tag=='chelicerae':
            add('chelicera_'+sg,1.)
        elif tag in FRONT_TAGS:
            shoulder=f'chela_{sg}_shoulder';elbow=f'chela_{sg}_elbow'
            palm=f'chela_{sg}_palm';digit=f'chela_{sg}_finger'
            if tag=='chela_coxa':
                t=project_line(q,REST[shoulder],REST[elbow]);add(shoulder,1-smooth(.40,.90,t));add(elbow,smooth(.40,.90,t))
            elif tag in {'chela_forearm','forearm_protective_plate'}:
                t=project_line(q,REST[elbow],REST[palm]);add(elbow,1-smooth(.70,.98,t));add(palm,smooth(.70,.98,t))
            elif tag=='massive_chela_movable_finger':add(digit,1.)
            else:add(palm,1.)
        elif tag in LEG_TAGS:
            # The x-coordinates of the three pairs are well separated by 2.3 m.
            pair=int(np.argmin(np.abs(np.array([-1.1,1.35,3.23])-x)))
            hip=f'leg_{sg}_{pair}_hip';knee=f'leg_{sg}_{pair}_knee';ankle=f'leg_{sg}_{pair}_ankle'
            if tag=='ambulatory_coxa_femur':
                t=project_line(q,REST[hip],REST[knee]);s=smooth(.50,.89,t);add(hip,1-s);add(knee,s)
            elif tag in {'ambulatory_tibia','knee_knuckle_armor'}:
                if tag=='knee_knuckle_armor':add(knee,1.)
                else:
                    t=project_line(q,REST[knee],REST[ankle]);s=smooth(.55,.91,t);add(knee,1-s);add(ankle,s)
            else:add(ankle,1.)
        elif tag in TAIL_TAGS:
            if tag in {'caudal_scythe','caudal_blade_keel'}:
                # Distal blade and terminal scythe move together on final joint.
                add('tail_8',1.)
            else:
                xyz=np.array(q,float);pts=np.asarray(TAIL_P,float)
                projected=[]
                for k in range(len(pts)-1):
                    t=project_line(xyz,pts[k],pts[k+1]);nearest=pts[k]+t*(pts[k+1]-pts[k])
                    projected.append((np.linalg.norm(xyz-nearest),k,t))
                _,k,t=min(projected)
                s=smooth(.15,.85,t)
                add(f'tail_{k}',1-s);add(f'tail_{k+1}',s)
        else:raise ValueError('Unmapped anatomical label '+tag)
        chosen=sorted(((n,v) for n,v in vals.items() if v>1e-7),key=lambda a:a[1],reverse=True)[:4]
        total=sum(v for _,v in chosen); assert total>0
        for slot,(name,w) in enumerate(chosen):ids[i,slot]=IDX[name];weights[i,slot]=w/total
    assert np.max(np.abs(weights.sum(axis=1)-1))<1e-5
    assert (weights>0.1).any() and ((weights>.10)&(weights<.90)).any()
    assert len(set(ids[weights>.05]))>=40,len(set(ids[weights>.05]))
    return ids,weights

def q_axis(axis,r):
    s=math.sin(r/2);return np.asarray([axis[0]*s,axis[1]*s,axis[2]*s,math.cos(r/2)],dtype=np.float32)

def qmul(a,b):
    x,y,z,w=a;X,Y,Z,W=b
    return np.asarray([w*X+x*W+y*Z-z*Y,w*Y-x*Z+y*W+z*X,w*Z+x*Y-y*X,w*W-x*X-y*Y-z*Z],np.float32)

def orient(yaw=0.,pitch=0.,roll=0.):
    # semantic axes: yaw around up Y; pitch around lateral Z; roll around forward X
    q=qmul(qmul(q_axis((0,1,0),yaw),q_axis((0,0,1),pitch)),q_axis((1,0,0),roll))
    return q/np.linalg.norm(q)

SPECS={
 'idle':(4.0,32,True), 'walk':(3.0,36,True), 'run':(1.8,36,True),
 'turn_left':(2.4,30,False),'turn_right':(2.4,30,False),
 'burrow':(4.2,40,False),'emerge':(3.9,40,False),
 'alert':(2.6,28,False),'threat_display':(3.8,36,True),
 'pincer_grab':(2.5,34,False),'pincer_slam':(2.2,34,False),
 'bite':(1.8,30,False),'tail_sting':(2.3,36,False),
 'tail_sweep':(2.7,36,False),'charge':(2.1,36,True),
 'hurt':(1.5,28,False),'death':(4.7,42,False),
 'rest':(5.0,32,True),'feed':(3.6,36,True),'sand_dig':(3.2,36,True),
}

def pose(name,t,d):
    u=float(np.clip(t/d,0.,1.));a=2*math.pi*u;sin=math.sin
    rot={n:[0.,0.,0.] for n in NAMES} # yaw, pitch, roll
    pos=np.zeros(3,np.float32)
    def setrot(n,yaw=0,pitch=0,roll=0):rot[n]=[float(yaw),float(pitch),float(roll)]
    def breathe(p=.022):
        setrot('body_center',roll=.012*sin(a),pitch=p*sin(a))
        setrot('body_front',pitch=.012*sin(a+.4))
        setrot('head',pitch=.018*sin(a+.6))
        for k in range(1,len(TAIL_P)):
            setrot(f'tail_{k}',pitch=.012*sin(a-k*.28),yaw=.016*sin(a-k*.42))
    def gait(amplitude=.25,frequency=1.0,dig=0):
        for side,sg in [('L',1),('R',-1)]:
            for pair in range(3):
                # alternating tripod of six legs with time-delayed phases
                ph=a*frequency+(0 if ((pair+(sg<0))%2)==0 else math.pi)
                lift=max(0.,sin(ph))
                hip=f'leg_{side}_{pair}_hip';knee=f'leg_{side}_{pair}_knee';ank=f'leg_{side}_{pair}_ankle'
                setrot(hip,pitch=amplitude*sin(ph),roll=-sg*amplitude*.22*lift)
                setrot(knee,pitch=-amplitude*.38*sin(ph)+amplitude*.55*lift)
                setrot(ank,pitch=-amplitude*.42*lift)
        pos[1]=.09*amplitude/.25*sin(2*a*frequency) if amplitude>0 else 0
    def arms(wiggle=.10,closed=0.,raised=0.):
        for side,sg in [('L',1),('R',-1)]:
            setrot(f'chela_{side}_shoulder',pitch=.045*sin(a)+.13*raised,roll=-sg*(.04*wiggle+raised*.20))
            setrot(f'chela_{side}_elbow',yaw=sg*(.05*sin(a+.6)+.16*closed),pitch=-.05*raised)
            setrot(f'chela_{side}_palm',yaw=sg*.08*sin(a+.65))
            setrot(f'chela_{side}_finger',yaw=-sg*.59*closed)
    def tail(wiggle=.11,coiled=0.):
        for k in range(1,len(TAIL_P)):
            setrot(f'tail_{k}',pitch=wiggle*.25*sin(a-k*.46)+coiled*.10*(k/8),
                   yaw=wiggle*.35*sin(a-k*.30))
    if name in ('idle','walk','run','charge','rest','feed','sand_dig','threat_display'):
        breathe(.009 if name=='rest' else .020)
        if name=='idle':gait(.025,.6);arms(.2);tail(.07)
        elif name=='rest':gait(0.);arms(.05);tail(.02);pos[1]=-.36+.035*sin(a)
        elif name=='walk':gait(.26,1.);arms(.5);tail(.16)
        elif name=='run':gait(.45,1.5);arms(.9);tail(.24)
        elif name=='charge':gait(.53,1.6);arms(.75,.25,.15);tail(.38)
        elif name=='feed':gait(.01,.7);arms(.22,.40);tail(.04)
        elif name=='sand_dig':gait(.12,1.5,dig=1);arms(.9,.0,.25);pos[1]=-.20+.05*sin(2*a);tail(.12)
        elif name=='threat_display':gait(.04,1);arms(.6,.65,.95);tail(.45,.5)
        if name=='feed':setrot('jaw',pitch=.17+.12*sin(2*a));setrot('head',pitch=-.08)
        if name=='threat_display':setrot('jaw',pitch=.3*(.5+.5*sin(a)))
    elif name in ('turn_left','turn_right'):
        dire=1 if name=='turn_left' else -1;h=smooth(0,.89,u)
        breathe();gait(.14,1);arms(.3);tail(.22)
        setrot('root',yaw=dire*.55*h)
    elif name in ('burrow','emerge'):
        h=smooth(.03,.95,u);down=h if name=='burrow' else 1-h
        breathe();gait(.32,1.45);arms(.5,.15);tail(.34)
        pos[1]=-2.65*down
        setrot('root',pitch=(-.15 if name=='burrow' else .13)*sin(math.pi*u))
    elif name=='alert':
        breathe();arms(.2,.15,.25*sin(math.pi*u));tail(.1)
        setrot('head',pitch=-.09*sin(math.pi*u));setrot('jaw',pitch=.10*sin(math.pi*u))
    elif name in ('pincer_grab','pincer_slam'):
        h=sin(math.pi*u)**2;gait(.05,1);tail(.15)
        setrot('body_front',pitch=-.08*h)
        for side,sg in [('L',1),('R',-1)]:
            setrot(f'chela_{side}_shoulder',pitch=.24*h,roll=-sg*.28*h)
            setrot(f'chela_{side}_elbow',yaw=sg*(.22 if name=='pincer_grab' else -.22)*h,pitch=.16*h)
            setrot(f'chela_{side}_palm',pitch=-.30*h if name=='pincer_slam' else -.10*h)
            setrot(f'chela_{side}_finger',yaw=-sg*.78*h)
        pos[1]=.20*h
    elif name=='bite':
        h=sin(math.pi*u)**3;breathe();arms(.25);tail(.1)
        setrot('jaw',pitch=.52*h)
        setrot('head',pitch=-.13*h);pos[1]=.06*h
    elif name in ('tail_sting','tail_sweep'):
        h=sin(math.pi*u)**2;breathe();gait(.08,.8);arms(.15,.2)
        for k in range(1,len(TAIL_P)):
            if name=='tail_sting':
                setrot(f'tail_{k}',pitch=-(.42 if k>4 else .12)*h, yaw=.07*sin(a+k*.22))
            else:
                setrot(f'tail_{k}',yaw=(.24+.25*k/8)*h*(1 if k%2==0 else .7),pitch=.03*sin(a+k*.2))
        setrot('body_rear',roll=.07*h)
    elif name=='hurt':
        h=sin(math.pi*u)**2;breathe();tail(.17)
        setrot('root',roll=.16*h);pos[1]=-.22*h
        setrot('head',pitch=.18*h)
    elif name=='death':
        h=smooth(.02,.92,u)
        pos[1]=-1.25*h
        setrot('root',roll=.35*h,pitch=-.16*h)
        setrot('head',pitch=.22*h);setrot('jaw',pitch=.30*h)
        for side,sg in [('L',1),('R',-1)]:
            setrot(f'chela_{side}_shoulder',roll=sg*.27*h)
            for pair in range(3):
                setrot(f'leg_{side}_{pair}_hip',roll=sg*.18*h)
                setrot(f'leg_{side}_{pair}_knee',pitch=.30*h)
        for k in range(1,len(TAIL_P)):
            setrot(f'tail_{k}',pitch=.10*h,yaw=.09*h)
    else:raise KeyError(name)
    # Quaternion for every joint and root translation for true glTF playback.
    return {n:orient(*rot[n]) for n in NAMES},pos

def align4(raw):
    while len(raw)%4:raw.append(0)

def add_accessor(doc,raw,data,typ,comp,limits=False,target=None):
    dtype={5126:'<f4',5123:'<u2'}[comp]
    dims={'SCALAR':1,'VEC3':3,'VEC4':4,'MAT4':16}[typ]
    ar=np.asarray(data,dtype=dtype).reshape(-1,dims)
    align4(raw);off=len(raw);raw.extend(ar.tobytes())
    view={'buffer':0,'byteOffset':off,'byteLength':ar.nbytes}
    if target:view['target']=target
    idx=len(doc['bufferViews']);doc['bufferViews'].append(view)
    acc={'bufferView':idx,'componentType':comp,'count':len(ar),'type':typ}
    if limits:acc.update({'min':ar.min(axis=0).tolist(),'max':ar.max(axis=0).tolist()})
    doc['accessors'].append(acc);return len(doc['accessors'])-1

def main():
    assert BASE.exists(),BASE
    ROOT.mkdir(exist_ok=True,parents=True)
    doc,raw,basehash=import_glb(BASE)
    primitive=doc['meshes'][0]['primitives'][0]
    xyz=accessor(doc,raw,primitive['attributes']['POSITION']).astype(np.float32)
    uv=accessor(doc,raw,primitive['attributes']['TEXCOORD_0']).astype(np.float32)
    src_xyz,src_uv,tags,parts=recover_tags()
    assert len(xyz)==len(src_xyz)==len(tags)==4815*3,(len(xyz),len(src_xyz),len(tags))
    assert np.array_equal(xyz,src_xyz),'v02 geometry mismatch; would change user-approved mesh'
    assert np.allclose(uv[:,0],src_uv[:,0],atol=1e-6)
    assert np.allclose(uv[:,1],1-src_uv[:,1],atol=1e-6)
    ids,weights=compute_weights(xyz,tags)
    primitive['attributes']['JOINTS_0']=add_accessor(doc,raw,ids,'VEC4',5123)
    primitive['attributes']['WEIGHTS_0']=add_accessor(doc,raw,weights,'VEC4',5126)
    node_start=len(doc['nodes']);doc['nodes'][1]['skin']=0
    for n,p,v in JOINTS:
        local=(REST[n]-REST[p]) if p else REST[n]
        node={'name':'serracorion_'+n,'translation':local.tolist(),'rotation':[0,0,0,1]}
        if CHILDREN[n]:node['children']=[node_start+IDX[ch] for ch in CHILDREN[n]]
        doc['nodes'].append(node)
    doc['nodes'][0]['children'].append(node_start)
    bind=[]
    for n,p,v in JOINTS:
        M=np.eye(4,dtype=np.float32);M[:3,3]=-REST[n]
        bind.append(M.T.reshape(16))
    ibm=add_accessor(doc,raw,np.asarray(bind),'MAT4',5126)
    doc['skins']=[{'name':'Serracorion_v03_WeightedRig','joints':[node_start+i for i in range(len(JOINTS))],
                   'inverseBindMatrices':ibm,'skeleton':node_start}]
    animations=[]
    for name,(duration,frames,loop) in SPECS.items():
        ts=np.linspace(0,duration,frames+1,dtype=np.float32)
        timeline=add_accessor(doc,raw,ts,'SCALAR',5126,limits=True)
        qs={n:[] for n in NAMES};tr=[]
        for t in ts:
            q,p=pose(name,float(t),duration)
            for n in NAMES:qs[n].append(q[n])
            tr.append(p)
        if loop:
            for n in NAMES:qs[n][-1]=qs[n][0].copy()
            tr[-1]=tr[0].copy()
        anim={'name':name,'samplers':[],'channels':[],
              'extras':{'loop':loop,'species':'serracorion','version':'v03','weighted_skin':True}}
        for n in NAMES:
            rotations=np.asarray(qs[n],np.float32)
            # Same hemisphere for interpolation; cyclic last key exact match.
            for ix in range(1,len(rotations)):
                if np.dot(rotations[ix-1],rotations[ix])<0:rotations[ix]*=-1
            if loop:rotations[-1]=rotations[0].copy()
            data=add_accessor(doc,raw,rotations,'VEC4',5126)
            sid=len(anim['samplers']);anim['samplers'].append({'input':timeline,'output':data,'interpolation':'LINEAR'})
            anim['channels'].append({'sampler':sid,'target':{'node':node_start+IDX[n],'path':'rotation'}})
        data=add_accessor(doc,raw,tr,'VEC3',5126)
        sid=len(anim['samplers']);anim['samplers'].append({'input':timeline,'output':data,'interpolation':'LINEAR'})
        anim['channels'].append({'sampler':sid,'target':{'node':node_start,'path':'translation'}})
        animations.append(anim)
    doc['animations']=animations
    doc['asset']['generator']='Wildhaven Serracorion v03 rig, 43 joints 20 animations, UV v02 identical'
    doc['buffers'][0]['byteLength']=len(raw)
    js=json.dumps(doc,ensure_ascii=False,separators=(',',':')).encode('utf-8');js+=b' '*(-len(js)%4)
    align4(raw)
    b=b'glTF'+struct.pack('<II',2,12+8+len(js)+8+len(raw))+struct.pack('<I4s',len(js),b'JSON')+js+struct.pack('<I4s',len(raw),b'BIN\0')+raw
    OUTPUT.write_bytes(b)
    man={'species':'Serracorion','version':'v03','stage':'rig_and_animations','parent':'v02',
         'base_glb_sha256':basehash,'glb':OUTPUT.name,'sha256':hashlib.sha256(b).hexdigest(),
         'bytes':len(b),'triangles':4815,'vertices':len(xyz),'meshes':1,'materials':1,
         'texture_resolution':[2048,2048],'joint_count':len(JOINTS),'joint_names':NAMES,
         'skins':1,'animation_count':len(SPECS),
         'clips':[{'name':n,'duration_s':duration,'keyframes':frames+1,'loop':loop} for n,(duration,frames,loop) in SPECS.items()],
         'geometry_indices_uv_albedo_identical_to_v02':True,'color_patches_extra_meshes':0,
         'dorsal_spines':'8 physically embedded anatomical spine bases from v02 unchanged',
         'status':{'v02_shape':'approved_to_advance_to_rig_by_user','v03_animations':'awaiting_review','merge':'draft_only','alpha':'not_integrated'},
         'lods_generated':0}
    MANIFEST.write_text(json.dumps(man,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    print(json.dumps({k:v for k,v in man.items() if k not in ('clips','joint_names')},ensure_ascii=False,indent=2))

if __name__=='__main__':main()
