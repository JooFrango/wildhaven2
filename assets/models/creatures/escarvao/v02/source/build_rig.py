#!/usr/bin/env python3
"""Escarvao v02: add weighted skeletal animation to the *original* v01 textured GLBs.

No remodeling or changes to UVs, texture bytes or vertex positions. Rest pose equals v01.
X forward, Y up, Z sideways. Skeletal clips are in-place (no gameplay AI or IK).

Run from any working directory: python source/build_rig.py
"""
from __future__ import annotations
import hashlib, json, math, struct
from pathlib import Path
import numpy as np

BASE=Path(__file__).resolve().parent.parent
V01=BASE.parent/'v01'
VARIANTS=('cobre','rubro','oliva')


def parse_glb(path):
    b=Path(path).read_bytes()
    assert b[:4]==b'glTF' and struct.unpack_from('<I',b,8)[0]==len(b)
    n,t=struct.unpack_from('<II',b,12);assert t==0x4e4f534a
    o=json.loads(b[20:20+n]);bp=20+n
    size,kind=struct.unpack_from('<II',b,bp);assert kind==0x004e4942
    raw=b[bp+8:bp+8+size]
    assert len(raw)==size
    return o,raw


def glb_bytes(doc,blob):
    raw=json.dumps(doc,ensure_ascii=False,separators=(',',':')).encode()
    raw+=b' ' * ((-len(raw))%4)
    blob+=b'\x00' * ((-len(blob))%4)
    return (struct.pack('<4sII',b'glTF',2,12+8+len(raw)+8+len(blob))+
            struct.pack('<I4s',len(raw),b'JSON')+raw+
            struct.pack('<I4s',len(blob),b'BIN\x00')+blob)


def read_accessor(doc,data,index):
    a=doc['accessors'][index];bv=doc['bufferViews'][a['bufferView']]
    dtype={5121:'u1',5123:'<u2',5125:'<u4',5126:'<f4'}[a['componentType']]
    n={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]
    sz=np.dtype(dtype).itemsize*n
    off=bv.get('byteOffset',0)+a.get('byteOffset',0)
    stride=bv.get('byteStride',sz)
    if stride==sz:
        return np.frombuffer(data,dtype=dtype,count=a['count']*n,offset=off).reshape(a['count'],n).copy()
    return np.stack([np.frombuffer(data,dtype=dtype,count=n,offset=off+i*stride) for i in range(a['count'])])


def add_bytes(doc,storage,raw,target=None):
    """Append a 4-byte-aligned binary chunk and register its bufferView."""
    storage.extend(b'\x00' * ((-len(storage))%4))
    offset=len(storage);storage.extend(raw)
    bv={'buffer':0,'byteOffset':offset,'byteLength':len(raw)}
    if target is not None: bv['target']=target
    doc['bufferViews'].append(bv)
    return len(doc['bufferViews'])-1


def add_accessor(doc,storage,data,kind,component_type=5126,target=None):
    arr=np.asarray(data)
    expected={5123:np.uint16,5125:np.uint32,5126:np.float32}[component_type]
    arr=np.ascontiguousarray(arr.astype(expected))
    bv=add_bytes(doc,storage,arr.tobytes(),target)
    a={'bufferView':bv,'componentType':component_type,'count':len(arr),'type':kind}
    if kind=='SCALAR' and len(arr):
        a['min']=[float(arr.min())];a['max']=[float(arr.max())]
    doc['accessors'].append(a)
    return len(doc['accessors'])-1


def qxyz(ax=0,ay=0,az=0):
    """Quaternion as normalized [x,y,z,w], XYZ rotation order."""
    sx,cx=math.sin(ax/2),math.cos(ax/2)
    sy,cy=math.sin(ay/2),math.cos(ay/2)
    sz,cz=math.sin(az/2),math.cos(az/2)
    q=np.array([sx*cy*cz+cx*sy*sz,
                cx*sy*cz-sx*cy*sz,
                cx*cy*sz+sx*sy*cz,
                cx*cy*cz-sx*sy*sz],np.float32)
    return q / np.linalg.norm(q)


class Skeleton:
    def __init__(self):
        self.bones=[];self.byname={}
    def add(self,name,pivot,parent=None):
        assert name not in self.byname and (parent is None or parent in self.byname)
        p=np.array(pivot,np.float64)
        idx=len(self.bones);self.byname[name]=idx
        self.bones.append({'name':name,'pivot':p,'parent':parent})
    def setup(self):
        self.add('body',[0,.77,0])
        self.add('head',[.75,.81,0],'body')
        for s in (-1,1):
            for i,x in enumerate((.55,.05,-.48,-1.03)):
                l=(1.36,1.57,1.70,1.63)[i];shift=(.32,.13,-.10,-.33)[i]
                p0=[x,.72,s*.55]
                p1=[x+shift*.25,1.05,s*.98]
                p2=[x+shift*.60,.92,s*l]
                p3=[x+shift*.93,.31,s*(l+.12)]
                self.add(f'leg_{s}_{i}_coxa',p0,'body')
                self.add(f'leg_{s}_{i}_femur',p1,f'leg_{s}_{i}_coxa')
                self.add(f'leg_{s}_{i}_tibia',p2,f'leg_{s}_{i}_femur')
                self.add(f'leg_{s}_{i}_tarsus',p3,f'leg_{s}_{i}_tibia')
            self.add(f'pedipalp_{s}',[.83,.64,s*.55],'head')
            self.add(f'forearm_{s}',[1.25,.83,s*.92],f'pedipalp_{s}')
            self.add(f'palm_{s}',[1.66,.63,s*1.27],f'forearm_{s}')
            self.add(f'upper_chela_{s}',[2.20,.68,s*1.50],f'palm_{s}')
            self.add(f'lower_chela_{s}',[2.20,.27,s*1.20],f'palm_{s}')
        pivots=[[-1.50,.80,0],[-1.79,1.02,0],[-2.05,1.31,0],
                [-2.11,1.68,0],[-2.01,2.05,0],[-1.79,2.34,0],
                [-1.49,2.47,0]]
        for i,p in enumerate(pivots):
            self.add(f'tail_{i}',p,'body' if i==0 else f'tail_{i-1}')
        return self


def bone_for(name):
    if name.startswith(('abdomen_','sternum','tergite_','lateral_carapace_tooth_')):return 'body'
    if name.startswith(('cephalothorax','cranial_brow','orbital_socket','recessed_eye','mandible')):return 'head'
    if name.startswith('leg_'):
        parts=name.split('_');s,i,seg=parts[1],parts[2],parts[3]
        if seg=='crest':seg='tibia'
        return f'leg_{s}_{i}_{seg}'
    for prefix in ('upper_chela_tooth_','lower_chela_tooth_'):
        if name.startswith(prefix):
            ss=name[len(prefix):].split('_')[0]
            return prefix.removesuffix('tooth_')+ss
    for prefix in ('pedipalp_','forearm_','palm_','upper_chela_','lower_chela_'):
        if name.startswith(prefix):return name if prefix!='palm_' else 'palm_'+name.split('_')[-1]
    if name.startswith('palm_plate_'):return 'palm_'+name.split('_')[-1]
    if name.startswith('metasoma_segment_'):return 'tail_'+name.split('_')[-1]
    if name.startswith('tail_dorsal_'):return 'tail_'+name.split('_')[-1]
    if name in ('poison_bulb','scimitar_stinger'):return 'tail_6'
    raise ValueError('Unknown anatomical part '+name)


def compute_weights(points,parts,bones):
    idx=np.zeros((len(points),4),dtype=np.uint16)
    w=np.zeros((len(points),4),dtype=np.float32)
    pos=0
    for part in parts:
        count=part['faces']*3;name=part['name']
        key=bone_for(name)
        primary=bones.byname[key];bone=bones.bones[primary]
        assert pos+count<=len(points)
        idx[pos:pos+count,0]=primary
        w[pos:pos+count,0]=1
        parent=bone['parent']
        if parent and (name.startswith(('leg_','pedipalp_','forearm_','palm_','upper_chela_','lower_chela_','metasoma_','tail_dorsal_','scimitar_'))):
            piv=bone['pivot'];d=np.linalg.norm(points[pos:pos+count]-piv,axis=1)
            # True skin-weight blend at hinge roots; not just rigid node parenting.
            soft=(0.24*np.exp(-(d/.27)**2)).astype(np.float32)
            idx[pos:pos+count,1]=bones.byname[parent]
            w[pos:pos+count,0]=1-soft
            w[pos:pos+count,1]=soft
        pos+=count
    assert pos==len(points),(pos,len(points))
    assert np.allclose(w.sum(axis=1),1,atol=1e-6)
    return idx,w

CLIPS={
    'idle': (3.2,True), 'walk':(1.35,True), 'run':(.76,True),
    'scuttle_side':(1.2,True),'turn_left':(1.35,True),'turn_right':(1.35,True),
    'alert':(1.5,False),'threat_display':(2.3,True),
    'pincer_grab':(1.05,False),'pincer_crush':(1.30,False),
    'sting':(1.1,False),'tail_sweep':(1.35,False),
    'burrow':(2.25,False),'emerge':(1.8,False),
    'feed':(2.15,True),'hurt':(.75,False),'rest':(3.3,True), 'death':(2.6,False),
}


def smoothstep(t):
    t=np.clip(t,0,1);return t*t*(3-2*t)


def evaluate(clip,t,duration,bones):
    """Local animation rotations + optional root translations, authored by biomechanics."""
    u=t/duration;phase=2*math.pi*u
    rot={};move={}
    s=math.sin;pi=math.pi
    def apply(n,x=0,y=0,z=0):rot[n]=(x,y,z)
    body=[0.,0.,0.]
    tailphase=phase*.56
    moving=clip in ('walk','run','scuttle_side','turn_left','turn_right')
    rate={'run':2,'walk':1,'scuttle_side':1,'turn_left':1,'turn_right':1}.get(clip,0)
    if moving:
        amp= .23 if clip=='run' else .13
        body[0]=.018*s(phase*rate)
        body[1]=(.05 if clip=='run' else .029)*(1-math.cos(phase*rate*2))
        body[2]=.026*s(phase*rate)
        if clip=='turn_left':body[1]=.10*smoothstep(u)
        if clip=='turn_right':body[1]=-.10*smoothstep(u)
        if clip=='scuttle_side':body[2]=.045*s(phase)
        for side in (-1,1):
            for i in range(4):
                gait=(i%2+(side==1))%2
                a=phase*rate+gait*pi
                ph=s(a)
                local_sign=side
                yaw=amp*ph*local_sign
                if clip=='scuttle_side': yaw=.20*ph
                if clip=='turn_left': yaw+=(0.10 if side==1 else -.04)*s(phase)
                if clip=='turn_right':yaw+=(0.10 if side==-1 else -.04)*s(phase)
                apply(f'leg_{side}_{i}_coxa',y=yaw,z=.025*s(a+.6))
                apply(f'leg_{side}_{i}_femur',x=.095*local_sign*ph)
                apply(f'leg_{side}_{i}_tibia',x=-.13*local_sign*max(0,ph),z=.03*s(a))
                apply(f'leg_{side}_{i}_tarsus',x=.045*local_sign*s(a+.5))
        for j in range(7):apply(f'tail_{j}',z=.018*s(phase-j*.4))
    elif clip=='idle':
        body[0]=.014*s(phase);body[2]=.012*s(phase+.7)
        for j in range(7):apply(f'tail_{j}',y=.02*s(phase*.55+j*.35),z=.026*s(tailphase+j*.5))
        for side in (-1,1):apply(f'upper_chela_{side}',z=.028*s(phase+side*.7))
    elif clip=='alert':
        k=math.sin(pi*smoothstep(u))
        body[0]=-.05*k;apply('head',z=.08*k)
        for j in range(7):apply(f'tail_{j}',z=(-.025- j*.012)*k)
        for side in (-1,1):apply(f'pedipalp_{side}',y=side*.14*k)
    elif clip=='threat_display':
        k=.5+.5*s(phase-.5)
        body[0]=-.042*k
        for j in range(7):apply(f'tail_{j}',y=.058*s(phase+j*.21),z=-.045*k)
        for side in (-1,1):
            apply(f'pedipalp_{side}',y=side*(.12+.09*k))
            apply(f'upper_chela_{side}',z=+.15*k)
            apply(f'lower_chela_{side}',z=-.17*k)
    elif clip in ('pincer_grab','pincer_crush'):
        k=smoothstep(min(1,u*3))* (1-smoothstep((u-.72)/.28))
        if clip=='pincer_crush': k=smoothstep(min(1,u*5))*(1-smoothstep((u-.82)/.18))
        body[0]=-.042*k
        for side in (-1,1):
            apply(f'pedipalp_{side}',y=side*.06*k)
            apply(f'palm_{side}',x=side*.04*k)
            apply(f'upper_chela_{side}',z=-.26*k)
            apply(f'lower_chela_{side}',z=.28*k)
    elif clip=='sting':
        k=smoothstep((u-.08)/.36)*(1-smoothstep((u-.50)/.50))
        body[0]=-.09*k;apply('head',z=-.06*k)
        for j in range(7):apply(f'tail_{j}',z=(-.06-.032*j)*k,y=.022*j*k)
    elif clip=='tail_sweep':
        k=s(pi*min(1,u))
        for j in range(7):apply(f'tail_{j}',y=(.06+.045*j)*k,z=.018*s(phase))
    elif clip in ('burrow','emerge'):
        k=smoothstep(u) if clip=='burrow' else 1-smoothstep(u)
        body[0]=-.42*k;apply('head',z=-.10*k)
        for side in (-1,1):
            for i in range(4):
                apply(f'leg_{side}_{i}_coxa',x=side*.14*k,y=.06*k)
                apply(f'leg_{side}_{i}_tibia',x=-side*.22*k)
            apply(f'pedipalp_{side}',y=-side*.12*k)
        for j in range(7):apply(f'tail_{j}',z=.08*k)
    elif clip=='feed':
        k=.5+.5*s(phase*2)
        apply('head',z=-.06*k);body[0]=-.014*k
        for side in (-1,1):
            apply(f'pedipalp_{side}',y=side*.08*k)
            apply(f'upper_chela_{side}',z=-.11*k)
            apply(f'lower_chela_{side}',z=.13*k)
    elif clip=='hurt':
        k=s(pi*u)*(1-u*.45)
        body[0]=-.10*k;body[1]=.12*k
        apply('head',z=.16*k)
        for side in (-1,1):
            apply(f'pedipalp_{side}',y=side*.17*k)
        for j in range(7):apply(f'tail_{j}',y=.05*s(phase*.75+j*.2),z=.035*k)
    elif clip=='rest':
        body[0]=-.16*(.75+.07*s(phase))
        for side in (-1,1):
            for i in range(4):apply(f'leg_{side}_{i}_femur',x=side*.12)
        for j in range(7):apply(f'tail_{j}',z=.045)
    elif clip=='death':
        k=smoothstep(u)
        body[0]=-.30*k;body[1]=.20*k;body[2]=-.16*k
        for side in (-1,1):
            for i in range(4):
                apply(f'leg_{side}_{i}_coxa',y=side*.27*k)
                apply(f'leg_{side}_{i}_femur',x=side*.30*k)
                apply(f'leg_{side}_{i}_tibia',x=-side*.21*k)
            apply(f'pedipalp_{side}',y=side*.21*k)
            apply(f'upper_chela_{side}',z=.07*k)
            apply(f'lower_chela_{side}',z=-.06*k)
        for j in range(7):apply(f'tail_{j}',z=.14*k)
    if any(abs(a)>1e-8 for a in body):apply('body',*body)
    return rot,move, {'body':[0.,.77+(-.24 if clip=='burrow' else 0),0]} if False else {}


def authored_animation(doc,storage,bones):
    bone_node_idx={b['name']:b['node'] for b in bones.bones}
    named=[]
    for clip,(duration,loop) in CLIPS.items():
        frames=21 if duration>2 else 17
        times=np.linspace(0,duration,frames,dtype=np.float32)
        in_idx=add_accessor(doc,storage,times,'SCALAR')
        channels=[];samplers=[]
        allangles={b['name']:[] for b in bones.bones}
        translations=[]
        for ti in times:
            angles,_,_=evaluate(clip,float(ti),duration,bones)
            for name in allangles:allangles[name].append(qxyz(*angles.get(name,(0,0,0))))
            u=float(ti/duration)
            if clip=='burrow':offset=-.40*smoothstep(u)
            elif clip=='emerge':offset=-.40*(1-smoothstep(u))
            elif clip=='death':offset=-.30*smoothstep(u)
            elif clip in ('walk','run'):offset=.032*(1-math.cos(2*math.pi*u*(2 if clip=='run' else 1)*2))
            elif clip=='rest':offset=-.15
            else:offset=0.
            translations.append([0,.77+offset,0])
        for name,values in allangles.items():
            v=np.asarray(values,dtype=np.float32)
            if np.max(np.abs(v-v[0]))<1e-5 and np.max(np.abs(v-np.array([0,0,0,1],np.float32)))<1e-5:continue
            a_idx=add_accessor(doc,storage,v,'VEC4')
            s_idx=len(samplers);samplers.append({'input':in_idx,'output':a_idx,'interpolation':'LINEAR'})
            channels.append({'sampler':s_idx,'target':{'node':bone_node_idx[name],'path':'rotation'}})
        tr=np.asarray(translations,np.float32)
        if not np.allclose(tr,tr[0]) or not np.allclose(tr[0],[0,.77,0]):
            a_idx=add_accessor(doc,storage,tr,'VEC3')
            s_idx=len(samplers);samplers.append({'input':in_idx,'output':a_idx,'interpolation':'LINEAR'})
            channels.append({'sampler':s_idx,'target':{'node':bone_node_idx['body'],'path':'translation'}})
        assert channels,clip
        doc['animations'].append({'name':clip,'channels':channels,'samplers':samplers,
                                  'extras':{'duration_seconds':duration,'loop':loop,'root_motion':'in_place',
                                            'note':'authored transform curves, not terrain IK'}})
        named.append({'name':clip,'seconds':duration,'loop':loop,'animated_channels':len(channels)})
    return named


def rig_variant(variant,parts,bones):
    inp=V01/f'escarvao_{variant}_blockout_v01.glb'
    doc,orig=parse_glb(inp)
    assert not doc.get('skins') and not doc.get('animations')
    old_len=len(orig)
    orig_views=[{k:v for k,v in view.items()} for view in doc['bufferViews']]
    prim=doc['meshes'][0]['primitives'][0]
    pts=read_accessor(doc,orig,prim['attributes']['POSITION']).astype(np.float32)
    uvs=read_accessor(doc,orig,prim['attributes']['TEXCOORD_0'])
    assert len(pts)==10461 and len(uvs)==len(pts)
    idx,w=compute_weights(pts,parts,bones)
    buffer=bytearray(orig)
    jint=add_accessor(doc,buffer,idx,'VEC4',5123,34962)
    weit=add_accessor(doc,buffer,w,'VEC4',5126,34962)
    prim['attributes']['JOINTS_0']=jint;prim['attributes']['WEIGHTS_0']=weit
    original_node_count=len(doc['nodes'])
    for bone in bones.bones:
        parent=bone['parent']
        parent_pos=bones.bones[bones.byname[parent]]['pivot'] if parent else np.zeros(3)
        local=bone['pivot']-parent_pos
        node={'name':bone['name'],'translation':[float(v) for v in local]}
        bone['node']=len(doc['nodes']);doc['nodes'].append(node)
        if parent:doc['nodes'][bones.bones[bones.byname[parent]]['node']].setdefault('children',[]).append(bone['node'])
    doc['nodes'][0].setdefault('children',[]).append(bones.bones[0]['node'])
    assert doc['nodes'][1].get('mesh')==0
    doc['nodes'][1]['skin']=0
    ibms=np.stack([np.eye(4,dtype=np.float32) for _ in bones.bones])
    for i,b in enumerate(bones.bones):
        ibms[i,:3,3]=-b['pivot']
    # glTF MAT4 is column-major, store columns consecutively.
    inverse_acc=add_accessor(doc,buffer,ibms.transpose(0,2,1).reshape(len(ibms),16),'MAT4')
    doc['skins']=[{'name':'Escarvao_v02_weighted_skin','skeleton':bones.bones[0]['node'],
                   'joints':[b['node'] for b in bones.bones], 'inverseBindMatrices':inverse_acc}]
    doc['animations']=[]
    clips=authored_animation(doc,buffer,bones)
    doc['asset']['generator']='Wildhaven Escarvao v02 weighted skin rig exporter (v01 source preserved)'
    doc['asset'].setdefault('extras',{}).update({'base':'escarvao-v01','authoring':'conserves original atlas UV geometry and texture bytes'})
    doc['buffers'][0]['byteLength']=len(buffer)
    path=BASE/f'escarvao_{variant}_rig_anim_v02.glb'
    exported=glb_bytes(doc,bytes(buffer));path.write_bytes(exported)
    reopened,rb=parse_glb(path)
    assert rb[:old_len]==orig and reopened['bufferViews'][:len(orig_views)]==orig_views
    assert len(reopened['skins'][0]['joints'])==len(bones.bones)
    assert len(reopened['animations'])==len(CLIPS)
    return {'variant':variant,'path':path.name,'bytes':path.stat().st_size,
            'sha256':hashlib.sha256(exported).hexdigest(),'git_blob_sha1':hashlib.sha1(b'blob '+str(len(exported)).encode()+b'\x00'+exported).hexdigest(),
            'base_sha256':hashlib.sha256(inp.read_bytes()).hexdigest(),
            'vertex_count':len(pts),'triangle_count':len(pts)//3,'mesh_count':len(doc['meshes']),
            'material_count':len(doc['materials']),'skins':1,'joints':len(bones.bones),
            'animations':clips,'total_clip_channels':sum(x['animated_channels'] for x in clips),
            'skinned_vertices':int((w[:,0]<1).sum()),'source_texture_preserved_binary':True}


def main():
    m=json.loads((V01/'manifest.json').read_text())
    parts=m['part_triangles']
    assert sum(p['faces'] for p in parts)==3487
    bone=Skeleton().setup()
    outputs=[rig_variant(v,parts,bone) for v in VARIANTS]
    manifest={'species':'escarvao','revision':'v02','stage':'rig_and_animations',
              'base_branch':'wildhaven-escarvao-uv-blockout-v01','base_pr':72,
              'preserves_v01':True,'joint_names':[b['name'] for b in bone.bones],
              'coordinate_frame':'X forward, Y up, Z lateral; metres',
              'animation_contract':{'clips':list(CLIPS),'sampling':'LINEAR quaternion glTF keyframes',
                'support':'in-place on flat ground; no terrain IK, gameplay collisions or AI'},
              'weights':'weighted joints 2 of up to 4 at pivot seams, otherwise single dominant influence; JOINTS_0+WEIGHTS_0',
              'variants':outputs,'approval':{'form':'v01 concept approved; v02 rig motion review pending'},
              'publication':{'status':'local_generated; GitHub verification pending'}}
    (BASE/'manifest_v02.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    for x in outputs:print(x['variant'],x['bytes'],'bytes',x['sha256'],'joints',x['joints'],'clips',len(x['animations']),'weighted vertices',x['skinned_vertices'])

if __name__=='__main__':main()
