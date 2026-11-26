#!/usr/bin/env python3
"""Wildhaven / Arenoceto v02: weighted armature + glTF 2.0 animation clips.

Preserves v01 POSITION, TEXCOORD_0, topology, material, embedded UV paint byte-for-byte.
Adds a real skin with multi-joint normalized WEIGHTS_0/JOINTS_0 and animation
samplers on armature TRS. This is not rigid pivot-only animation.

No LODs at this stage. Original v01 is never overwritten.
"""
from __future__ import annotations
import copy,importlib.util,hashlib,json,math,struct
from pathlib import Path
import numpy as np

THIS = Path(__file__).resolve()
V02 = THIS.parent.parent
# Local and GitHub Actions layout: assets/models/creatures/arenoceto/v02/source
V01 = V02.parent / 'v01'
BASE_GLB = V01/'arenoceto-v01-textured-blockout.glb'
BASE_SCRIPT= V01/'source'/'build.py'
OUTPUT = V02/'arenoceto-v02-skinned-animated-LOD0.glb'
MANIFEST = V02/'manifest.json'
RNG_SEED=20261109

JOINTS = [
 # (name,parent,world bind position). Root parent=None
 ('root',None,(0,0,0)),
 ('body_rear','root',(-9.2,3.80,0)),
 ('body_mid','body_rear',(-3.2,3.88,0)),
 ('body_front','body_mid',(4.2,4.20,0)),
 ('neck','body_front',(9.25,4.70,0)),
 ('skull','neck',(13.10,4.9,0)),
 ('jaw','skull',(9.52,2.40,0)),
 ('tail_base','body_rear',(-14.2,3.48,0)),
 ('tail_mid','tail_base',(-17.2,3.60,0)),
 ('tail_tip','tail_mid',(-19.7,4.35,0)),
 ('fin_L_root','body_front',(4.00,3.55,3.20)),
 ('fin_L_mid','fin_L_root',(-1.0,3.10,6.00)),
 ('fin_L_tip','fin_L_mid',(-6.20,2.50,9.35)),
 ('fin_R_root','body_front',(4.00,3.55,-3.20)),
 ('fin_R_mid','fin_R_root',(-1.0,3.10,-6.00)),
 ('fin_R_tip','fin_R_mid',(-6.20,2.50,-9.35)),
]
JNAMES=[j[0] for j in JOINTS]
JIDX={n:i for i,n in enumerate(JNAMES)}
REST={n:np.array(x,dtype=np.float64) for n,p,x in JOINTS}
CHILDREN={n:[] for n in JNAMES}
for name,parent,pos in JOINTS:
 if parent is not None: CHILDREN[parent].append(name)

# Replay v01 generator to recover accurate per-triangle semantic provenance.
# The actual mesh binary positions and UVs are reused FROM THE ORIGINAL GLB.
def tags_from_original():
    spec=importlib.util.spec_from_file_location('wildhaven_arenoceto_v01',BASE_SCRIPT)
    m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
    class Tagged(m.Sculpt):
        def __init__(self):
            super().__init__();self.tags=[]
        def triangle(self,a,b,c,ta,tb,tc,name):
            super().triangle(a,b,c,ta,tb,tc,name)
            self.tags.extend([name,name,name])
    t=Tagged().make()
    return np.asarray(t.vertices,dtype=np.float32),np.asarray(t.uv,dtype=np.float32),t.tags,t.parts

def base_glb():
    data=BASE_GLB.read_bytes()
    assert data[:4]==b'glTF'
    length=struct.unpack_from('<I',data,8)[0]
    assert length==len(data)
    jsonlength,typ=struct.unpack_from('<I4s',data,12);assert typ==b'JSON'
    source=json.loads(data[20:20+jsonlength])
    offset=20+jsonlength
    binlen,typ=struct.unpack_from('<I4s',data,offset);assert typ==b'BIN\x00'
    binary=bytes(data[offset+8:offset+8+binlen])
    assert len(binary)>=source['buffers'][0]['byteLength']
    return source,bytearray(binary),hashlib.sha256(data).hexdigest()

def get_accessor(obj,binary,idx):
    ac=obj['accessors'][idx];view=obj['bufferViews'][ac['bufferView']]
    dt={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[ac['componentType']]
    n={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[ac['type']]
    stride=view.get('byteStride')
    assert stride is None or stride==np.dtype(dt).itemsize*n
    off=view.get('byteOffset',0)+ac.get('byteOffset',0)
    a=np.frombuffer(binary,dtype=dt,count=ac['count']*n,offset=off).reshape(-1,n)
    return a.copy()

def smoothstep(a,b,x):
    t=np.clip((x-a)/(b-a),0.,1.);return t*t*(3-2*t)

def weighted_1d(x,centers,width=5.5):
    centers=np.asarray(centers,float)
    w=np.exp(-((x-centers)/width)**2)
    return w / (w.sum()+1e-9)

def calc_weights(positions,tags):
    out_joint=np.zeros((len(positions),4),dtype=np.uint16)
    out_w=np.zeros((len(positions),4),dtype=np.float32)
    for i,(p,tag) in enumerate(zip(positions,tags)):
        x,y,z=(float(a) for a in p)
        values={}
        def add(name,w): values[name]=values.get(name,0)+max(0,float(w))
        if tag in ('lower_filter_jaw',):
            add('jaw',.97);add('skull',.03)
        elif tag in ('keratin_filter',):
            add('skull',1.)  # keratin baleen rigid relative to upper mouth
        elif tag in ('wedge_cranium','recessed_orbit','amber_eye','pupil','nostril','cranial_shield'):
            w=smoothstep(8.0,12.0,x)
            add('neck',1.-w);add('skull',w)
        elif tag=='mouth_shadow':
            add('skull',.92);add('jaw',.08)
        elif tag.startswith('sand_paddle'):
            sg='L' if z>=0 else 'R';dist=abs(z)
            # Smooth blend from shoulder to paddle tip, not separate rigid polygons.
            first=smoothstep(3.9,6.6,dist);last=smoothstep(6.0,9.6,dist)
            add('fin_'+sg+'_root',1-first)
            add('fin_'+sg+'_mid',first*(1-last))
            add('fin_'+sg+'_tip',first*last)
        elif tag in ('caudal_sail','rear_keel','caudal_peduncle'):
            if x< -18.4:
                add('tail_mid',.24);add('tail_tip',.76)
            else:
                r=smoothstep(-19.,-13.,x)
                add('tail_base',r);add('tail_mid',1-r)
        else:
            centers=[-11.,-4.5,3.7,8.8]
            w=weighted_1d(x,centers,width=5.0)
            for n,a in zip(['body_rear','body_mid','body_front','neck'],w):add(n,a)
            if x<-11:
                fade=.55*(1-smoothstep(-15.,-11.,x))
                for n in list(values):values[n]*=(1-fade)
                add('tail_base',fade)
        # quantize top-four influence to glTF JOINTS_0 / WEIGHTS_0.
        selected=sorted(values.items(),key=lambda v:v[1],reverse=True)[:4]
        w=np.array([q for n,q in selected],dtype=np.float64)
        assert np.all(np.isfinite(w)) and w.sum()>0
        w=w/w.sum()
        for k,((n,_),strength) in enumerate(zip(selected,w)):
            out_joint[i,k]=JIDX[n];out_w[i,k]=strength
    assert np.max(abs(out_w.sum(axis=1)-1))<1e-5
    assert np.any((out_w>.05)&(out_w<.95))
    assert len(set(out_joint[:,0]))>=8
    return out_joint,out_w

def q_axis(axis,radians):
    c=math.cos(radians/2.);s=math.sin(radians/2.)
    return np.array([axis[0]*s,axis[1]*s,axis[2]*s,c],dtype=np.float64)

def qmul(a,b):
    x1,y1,z1,w1=a;x2,y2,z2,w2=b
    return np.array([w1*x2+x1*w2+y1*z2-z1*y2,
                     w1*y2-x1*z2+y1*w2+z1*x2,
                     w1*z2+x1*y2-y1*x2+z1*w2,
                     w1*w2-x1*x2-y1*y2-z1*z2])

def euler(yaw=0.,pitch=0.,roll=0.):
    q=qmul(qmul(q_axis((0,0,1),pitch),q_axis((0,1,0),yaw)),q_axis((1,0,0),roll))
    return (q/np.linalg.norm(q)).astype('float32')

# All clips authored for the ecology and axial mass of this unique sand-swimmer.
# Some are locomotion-in-place (gameplay moves the creature), others intentionally
# animate root lift/depth; not integrated with game AI or terrain here.
SPECS={
 'idle':(6.0,24,True),
 'swim_sand':(4.0,32,True),
 'swim_fast':(2.7,32,True),
 'turn_left':(3.5,28,False),
 'turn_right':(3.5,28,False),
 'dive':(4.0,32,False),
 'surface':(4.0,32,False),
 'burrow':(4.6,32,False),
 'breach':(5.0,40,False),
 'filter_feed':(5.0,32,True),
 'sift_sediment':(5.0,32,True),
 'alert':(3.0,24,False),
 'threat_display':(4.5,32,True),
 'bellow':(4.0,32,False),
 'charge':(2.7,32,True),
 'fin_sweep':(4.0,32,True),
 'tail_slam':(3.3,32,False),
 'hurt':(2.5,24,False),
 'rest':(6.0,24,True),
 'death':(6.0,40,False),
}

def pose(name,t,duration):
    u=np.clip(t/duration,0.,1.);a=2*math.pi*u
    r={j:(0.,0.,0.) for j in JNAMES}  # yaw,pitch,roll radians
    root=np.zeros(3,dtype=np.float32)
    sine=math.sin
    def put(j,yaw=0.,pitch=0.,roll=0.):r[j]=(yaw,pitch,roll)
    def axial(power=1.,rate=1.):
        for j,phase,mag in [('body_rear',0,.10),('body_mid',.75,.07),('body_front',1.35,.065),('neck',1.9,.05),('skull',2.45,.05),('tail_base',-.5,.20),('tail_mid',-1.15,.28),('tail_tip',-1.9,.33)]:
            put(j,yaw=power*mag*sine(a*rate+phase),pitch=power*.018*sine(a*rate+phase-.5))
    def fins(power=1.,rate=1.,wide=False):
        for sg,s in [('L',1),('R',-1)]:
            d=a*rate+(0 if s==1 else math.pi)
            put('fin_'+sg+'_root',yaw=s*power*.11*sine(d),pitch=power*.07*sine(d+.3),roll=s*power*(.08 if not wide else .23)*sine(d))
            put('fin_'+sg+'_mid',yaw=s*power*.13*sine(d-.6),pitch=power*.08*sine(d-.3),roll=s*power*.08*sine(d+.1))
            put('fin_'+sg+'_tip',yaw=s*power*.13*sine(d-1.05),pitch=power*.11*sine(d-.6))
    if name=='idle':
        axial(.20);fins(.13);root[1]=.045*sine(a)
    elif name=='swim_sand':
        axial(1.0);fins(.85,2);root[1]=.13*sine(a*2)
    elif name=='swim_fast':
        axial(1.4);fins(1.4,2);root[1]=.21*sine(2*a)
    elif name=='turn_left' or name=='turn_right':
        side=1 if name=='turn_left' else -1
        angle=side*.48*smoothstep(0,.90,u)
        put('root',yaw=angle);axial(.35)
        put('tail_base',yaw=-side*.25*sine(math.pi*u));put('tail_mid',yaw=-side*.25*sine(math.pi*u))
        put('fin_L_root',yaw=.22*side*sine(math.pi*u));put('fin_R_root',yaw=-.22*side*sine(math.pi*u))
    elif name=='dive':
        root[1]=-3.8*smoothstep(.02,.97,u)
        put('root',pitch=-.20*sine(math.pi*u));axial(.52);fins(.60)
    elif name=='surface':
        root[1]=3.0*smoothstep(.02,.95,u)
        put('root',pitch=.19*sine(math.pi*u));axial(.42);fins(.65)
    elif name=='burrow':
        root[1]=-4.6*smoothstep(.10,.95,u)
        put('root',pitch=-.23*sine(math.pi*u));axial(.82);fins(.92)
    elif name=='breach':
        lift=math.sin(math.pi*u)**2;root[1]=8.0*lift
        put('root',pitch=.28*sine(math.pi*u),roll=.10*sine(2*math.pi*u))
        axial(.8);fins(1.1);put('jaw',pitch=-.10*lift)
    elif name=='filter_feed':
        axial(.1);fins(.13)
        put('jaw',pitch=-.38*(.55+.45*sine(a-.6)));root[1]=.05*sine(a)
    elif name=='sift_sediment':
        axial(.18);fins(.18)
        put('jaw',pitch=-.30*(.65+.35*sine(3*a-.5)))
        put('skull',pitch=.02*sine(2*a))
    elif name=='alert':
        put('neck',pitch=.075*sine(math.pi*u));put('skull',pitch=.06*sine(math.pi*u))
        put('fin_L_root',roll=-.10*sine(math.pi*u));put('fin_R_root',roll=.10*sine(math.pi*u))
    elif name=='threat_display':
        axial(.26);fins(.8,1,True);put('jaw',pitch=-.45*(.5+.5*sine(a)))
        put('neck',pitch=.09*(.5+.5*sine(a)))
    elif name=='bellow':
        h=math.sin(math.pi*u)**2
        put('neck',pitch=.16*h);put('skull',pitch=.12*h);put('jaw',pitch=-.58*h)
        put('tail_base',yaw=.13*sine(a))
        root[1]=.12*h
    elif name=='charge':
        axial(1.5,1.5);fins(1.45,1.5);put('jaw',pitch=-.07*(.5+.5*sine(a)))
        root[1]=.25*sine(3*a)
    elif name=='fin_sweep':
        axial(.22);fins(1.5,1.0,True)
    elif name=='tail_slam':
        h=math.sin(math.pi*u)**3
        put('tail_base',yaw=.40*h);put('tail_mid',yaw=-.8*h);put('tail_tip',yaw=1.05*h)
        put('body_rear',yaw=-.10*h);root[1]=.08*sine(a)
    elif name=='hurt':
        h=math.sin(math.pi*u)**3
        put('root',roll=.12*h,pitch=-.09*h)
        put('body_mid',yaw=-.12*h);put('tail_base',yaw=-.32*h)
        for s in ['L','R']:put('fin_'+s+'_root',roll=(.25 if s=='L' else -.25)*h)
        root[1]=-.30*h
    elif name=='rest':
        root[1]=-.65;axial(.08);fins(.05)
        put('jaw',pitch=-.035*(.5+.5*sine(a)))
    elif name=='death':
        h=smoothstep(.08,.95,u)
        put('root',roll=.55*h,pitch=-.09*h);root[1]=-2.25*h
        put('tail_base',yaw=.3*h);put('tail_mid',yaw=.15*h)
        put('jaw',pitch=-.19*h)
        for s in ['L','R']:put('fin_'+s+'_root',roll=(.20 if s=='L' else -.18)*h)
    # avoid incidental Euler gimbal or invalid transforms
    return {j:euler(*r[j]) for j in JNAMES},root

def pad4(buf):
    while len(buf)%4:buf.append(0)

def add_buffer(obj,data,raw,n_per,componentType,max_min=False,target=None):
    arr=np.asarray(data)
    if componentType==5126:arr=np.asarray(arr,dtype='<f4')
    elif componentType==5123:arr=np.asarray(arr,dtype='<u2')
    else:raise ValueError(componentType)
    if n_per=='MAT4':shape=16
    elif n_per=='SCALAR':shape=1
    else:shape={'VEC2':2,'VEC3':3,'VEC4':4}[n_per]
    assert arr.size%shape==0
    arr=arr.reshape(-1,shape)
    pad4(raw);ofs=len(raw);b=arr.tobytes(order='C');raw.extend(b)
    view={'buffer':0,'byteOffset':ofs,'byteLength':len(b)}
    if target is not None:view['target']=target
    bi=len(obj['bufferViews']);obj['bufferViews'].append(view)
    ac={'bufferView':bi,'componentType':componentType,'count':len(arr),'type':n_per}
    if max_min:
        ac['min']=np.min(arr,axis=0).tolist();ac['max']=np.max(arr,axis=0).tolist()
    ai=len(obj['accessors']);obj['accessors'].append(ac)
    return ai

def main():
    V02.mkdir(parents=True,exist_ok=True)
    obj,raw,base_sha=base_glb()
    prim=obj['meshes'][0]['primitives'][0]
    vertices=get_accessor(obj,raw,prim['attributes']['POSITION']).astype(np.float32)
    uvs=get_accessor(obj,raw,prim['attributes']['TEXCOORD_0']).astype(np.float32)
    source_v,source_uv,labels,structures=tags_from_original()
    assert len(labels)==len(vertices)==6156
    assert np.array_equal(vertices,source_v), 'Must not modify original geometry!'
    assert np.allclose(uvs[:,0],source_uv[:,0],atol=1e-6) and np.allclose(uvs[:,1],1-source_uv[:,1],atol=1e-6), 'Must preserve exported, V-flipped source UV.'
    vj,vw=calc_weights(vertices,labels)
    prim['attributes']['JOINTS_0']=add_buffer(obj,vj,raw,'VEC4',5123)
    prim['attributes']['WEIGHTS_0']=add_buffer(obj,vw,raw,'VEC4',5126)
    # Add actual GLTF skin and parented TRS nodes; mesh keeps same local coordinates.
    node_start=len(obj['nodes'])
    assert obj['nodes'][0]['name']=='world' and obj['nodes'][1].get('mesh')==0
    obj['nodes'][1]['skin']=0
    for name,parent,world in JOINTS:
        world=np.array(world,dtype=np.float64)
        loc=world-(REST[parent] if parent else np.zeros(3))
        node={'name':'arenoceto_'+name,'translation':loc.tolist(),'rotation':[0,0,0,1]}
        if CHILDREN[name]:node['children']=[node_start+JIDX[ch] for ch in CHILDREN[name]]
        obj['nodes'].append(node)
    obj['nodes'][0]['children'].append(node_start+JIDX['root'])
    joints=[node_start+i for i in range(len(JOINTS))]
    bind=[]
    for name,parent,world in JOINTS:
        mat=np.eye(4,dtype=np.float32)
        mat[:3,3]=-np.asarray(world,dtype=np.float32)
        bind.append(mat.T.reshape(16)) # column-major matrices glTF
    ibm_idx=add_buffer(obj,np.asarray(bind),raw,'MAT4',5126)
    obj['skins']=[{'name':'Arenoceto_skin_v02_weighted','inverseBindMatrices':ibm_idx,'joints':joints,'skeleton':joints[0]}]
    animations=[]
    for name,(duration,frames,loop) in SPECS.items():
        times=np.linspace(0,duration,frames+1,dtype=np.float32)
        # ensure exact seam for looped motion
        rotations={j:[] for j in JNAMES}
        root_trans=[]
        for t in times:
            trs,shift=pose(name,float(t),duration)
            for j in JNAMES:rotations[j].append(trs[j])
            root_trans.append(shift)
        if loop:
            for j in JNAMES:rotations[j][-1]=rotations[j][0].copy()
            root_trans[-1]=root_trans[0].copy()
        input_id=add_buffer(obj,times,raw,'SCALAR',5126,max_min=True)
        anim={'name':name,'samplers':[],'channels':[], 'extras':{'loop':loop,'species':'arenoceto','version':'v02'}}
        for j in JNAMES:
            arr=np.asarray(rotations[j],dtype=np.float32)
            # quaternion consistency for linear interpolation
            for k in range(1,len(arr)):
                if np.dot(arr[k-1],arr[k])<0:arr[k]*=-1
            idx=add_buffer(obj,arr,raw,'VEC4',5126)
            samp=len(anim['samplers']);anim['samplers'].append({'input':input_id,'output':idx,'interpolation':'LINEAR'})
            anim['channels'].append({'sampler':samp,'target':{'node':node_start+JIDX[j],'path':'rotation'}})
        tr=add_buffer(obj,root_trans,raw,'VEC3',5126)
        samp=len(anim['samplers']);anim['samplers'].append({'input':input_id,'output':tr,'interpolation':'LINEAR'})
        anim['channels'].append({'sampler':samp,'target':{'node':node_start+JIDX['root'],'path':'translation'}})
        animations.append(anim)
    obj['animations']=animations
    obj['asset']['generator']='Wildhaven Arenoceto v02 weighted skin + self-authored UV-preserving glTF animation exporter'
    obj['buffers'][0]['byteLength']=len(raw)
    # GLB binary layout and correct chunk alignment.
    txt=json.dumps(obj,ensure_ascii=False,separators=(',',':')).encode('utf8')
    txt+=b' '*((-len(txt))%4);pad4(raw)
    data=b'glTF'+struct.pack('<II',2,12+8+len(txt)+8+len(raw))+struct.pack('<I4s',len(txt),b'JSON')+txt+struct.pack('<I4s',len(raw),b'BIN\x00')+raw
    OUTPUT.write_bytes(data)
    report={
        'species':'arenoceto','version':'v02','status':'awaiting_artistic_animation_approval',
        'previous_version':'v01 UV static GLB preserved without changes',
        'original_glb_sha256':base_sha,'glb':OUTPUT.name,
        'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),
        'triangles':2052,'vertices':len(vertices),'meshes':1,
        'skins':1,'joint_count':len(JOINTS),'joint_names':JNAMES,
        'animated_clips':[{'name':n,'duration_seconds':dur,'samples':fr+1,'loop':loop,'channels':len(JOINTS)+1} for n,(dur,fr,loop) in SPECS.items()],
        'animation_count':len(SPECS),'geometry_reused_identically':True,
        'uv_reused_identically':True,'embedded_texture_reused_identically':True,
        'weights':{'scheme':'4-influence MAX, normalized glTF JOINTS_0 and WEIGHTS_0','skin_deformation':'weighted genuine skinning, not pivot-only'},
        'integration':'not_integrated_in_alpha',
        'source':'source/build_rig.py'
    }
    MANIFEST.write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k not in ('animated_clips','joint_names')},indent=2,ensure_ascii=False))
if __name__=='__main__':main()
