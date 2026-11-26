#!/usr/bin/env python3
"""Wildhaven Serpaduna v02: skin de coluna axial real e clipes glTF embutidos.
Derivado exclusivamente do GLB v01 aprovado para rig pelo diretor.
Sem efeitos ficticios de runtime; exporta JOINTS_0, WEIGHTS_0, skins e animations.
Implementa 4 morph targets de bolus para degluticao, sem overlays de cor.
"""
from pathlib import Path
import json, math, struct, hashlib, copy, zipfile, sys
import numpy as np
from scipy.spatial.transform import Rotation as R

ROOT=Path(__file__).resolve().parents[1]
V1=Path(sys.argv[1]) if len(sys.argv)>1 else ROOT.parent/'v01'/'serpaduna_v01_blockout.glb'
OUT=ROOT/'serpaduna_v02_rig_animated.glb'
META=ROOT/'manifest.json'
BONES=70

v1=V1.read_bytes()
magic,version,total=struct.unpack_from('<III',v1)
assert magic==0x46546c67 and version==2 and total==len(v1)
p=12;chunks=[]
while p<len(v1):
    n,k=struct.unpack_from('<I4s',v1,p);p+=8; chunks.append((k,v1[p:p+n]));p+=n
G=json.loads(next(c for k,c in chunks if k==b'JSON'))
oldbin=next(c for k,c in chunks if k==b'BIN\0')
# use vertex ring centers from the *actual v01 exported GLB*
def acc(aid):
    a=G['accessors'][aid]; bv=G['bufferViews'][a['bufferView']]
    d={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]
    fmt={5126:'<f4',5123:'<u2',5121:'<u1',5125:'<u4'}[a['componentType']]
    off=bv.get('byteOffset',0)+a.get('byteOffset',0)
    result=np.frombuffer(oldbin,dtype=np.dtype(fmt),count=a['count']*d,offset=off).reshape((a['count'],d))
    return result.copy()
body_xyz=acc(G['meshes'][0]['primitives'][0]['attributes']['POSITION'])
assert len(body_xyz)==190*17
centers=body_xyz.reshape(190,17,3)[:,:16,:].mean(axis=1)
# sample skeleton in arch length, preserving rest coil coordinate and neck rise
cum=np.r_[0,np.cumsum(np.linalg.norm(np.diff(centers,axis=0),axis=1))]
bone_s=np.linspace(0,cum[-1],BONES)
bp=np.stack([np.interp(bone_s,cum,centers[:,j]) for j in range(3)],axis=1).astype(np.float32)
assert 13.0<cum[-1]<15.5, cum[-1]

# New binary buffer references are all appended to the existing embedded GLB data
newbin=bytearray(oldbin)
def pad4():
    while len(newbin)%4: newbin.append(0)
def add_accessor(ar,typ,component=5126,normalized=False,target=None,include_minmax=False):
    ar=np.ascontiguousarray(ar)
    count=ar.shape[0];
    dat=ar.tobytes()
    pad4();start=len(newbin);newbin.extend(dat)
    bv={'buffer':0,'byteOffset':start,'byteLength':len(dat)}
    if target is not None:bv['target']=target
    bvid=len(G['bufferViews']);G['bufferViews'].append(bv)
    a={'bufferView':bvid,'componentType':component,'count':count,'type':typ}
    if normalized:a['normalized']=True
    if include_minmax:
        a['min']=np.min(ar,axis=0).tolist();a['max']=np.max(ar,axis=0).tolist()
    idx=len(G['accessors']);G['accessors'].append(a)
    return idx

# Bones in a true parent-child chain. Rest local translation follows the approved coil.
rig_root=len(G['nodes'])
node_names=[]
for i in range(BONES):
    name=f'axis_{i:02d}_'+('tail_tip' if i==0 else 'neck_end' if i==BONES-1 else 'spine')
    node_names.append(name)
    G['nodes'].append({'name':name,'translation':(bp[i]-(bp[i-1] if i else np.zeros(3))).astype(float).tolist()})
    if i>0:G['nodes'][rig_root+i-1]['children']=[rig_root+i]
G['nodes'][0]['children'].append(rig_root)
# Jaw and forked tongue: distinct bones; local origin at anatomical hinge.
head=bp[-1].astype(float)
jaw_pivot=head+np.array([-.15,0.,-.20])
tongue_pivot=head+np.array([-.50,0.,-.37])
jaw_id=len(G['nodes']);G['nodes'].append({'name':'mandible_hinge','translation':(jaw_pivot-head).tolist()})
tongue_id=len(G['nodes']);G['nodes'].append({'name':'tongue_fork_hinge','translation':(tongue_pivot-head).tolist()})
G['nodes'][rig_root+BONES-1]['children']=[jaw_id,tongue_id]
joint_ids=list(range(rig_root,rig_root+BONES))+[jaw_id,tongue_id]
J=len(joint_ids)
# Inverse bind global rest matrices, column-major as mandated by glTF 2.0.
rest_positions=np.vstack([bp,jaw_pivot,tongue_pivot])
ibm=np.zeros((J,16),dtype=np.float32)
for i,pos in enumerate(rest_positions):
    M=np.eye(4,dtype=np.float32);M[:3,3]=-pos
    ibm[i,:]=M.T.flatten()
ibm_id=add_accessor(ibm,'MAT4')
G['skins']=[{'name':'SerpadunaAxialSkin_v02','joints':joint_ids,'inverseBindMatrices':ibm_id,'skeleton':rig_root}]
# Each mesh contributes vertices to the SAME deforming skin. No fake pivot-only rig.
for mi,mesh in enumerate(G['meshes']):
    for prim in mesh['primitives']:
        verts=acc(prim['attributes']['POSITION'])
        count=len(verts)
        inds=np.zeros((count,4),dtype=np.uint16)
        weights=np.zeros((count,4),dtype=np.float32)
        if mi==0:
            # 4 non-negative cubic B-spline weights along arc length. Normalized.
            t=np.repeat(np.interp(cum,bone_s,np.arange(BONES,dtype=float)),17)
            ii=np.floor(t).astype(int)
            u=t-ii
            basis=np.stack([(1-u)**3/6, (3*u**3-6*u**2+4)/6,
                            (-3*u**3+3*u**2+3*u+1)/6,u**3/6],axis=1)
            picks=np.stack([ii-1,ii,ii+1,ii+2],axis=1)
            picks=np.clip(picks,0,BONES-1)
            inds[:]=picks.astype(np.uint16)
            weights[:]=basis.astype(np.float32)
        else:
            idx=BONES-1
            detail=mi-4
            if mi==2 or detail in list(range(26,30))+list(range(35,39)):
                idx=BONES
            elif detail in (39,40,41):
                idx=BONES+1
            elif 42<=detail<=46:
                midpoint=np.mean(verts,axis=0)
                idx=int(np.argmin(np.sum((bp-midpoint)**2,axis=1)))
            inds[:,0]=idx;weights[:,0]=1.0
        aidx=add_accessor(inds,'VEC4',5123,target=34962)
        widx=add_accessor(weights,'VEC4',5126,target=34962)
        prim['attributes']['JOINTS_0']=aidx
        prim['attributes']['WEIGHTS_0']=widx
    G['nodes'][mi+1]['skin']=0

# Morph targets: spherical swallowed-prey bolus traveling down the neck and chest.
# A morph changes the physical body profile, never overlays or recolors the mesh.
q=np.repeat(cum/cum[-1],17)
radial=body_xyz-np.repeat(centers,17,axis=0)
radial_norm=np.linalg.norm(radial,axis=1,keepdims=True)
radial/=np.maximum(radial_norm,1.e-5)
bolus_centers=[.92,.84,.76,.68]
for x in bolus_centers:
    mag=(.26*np.exp(-.5*((q-x)/.038)**2))[:,None]
    # never introduce vertex count changes: strict morph-index correspondence
    delta=(radial*mag).astype('<f4')
    aid=add_accessor(delta,'VEC3',5126,target=34962)
    G['meshes'][0]['primitives'][0].setdefault('targets',[]).append({'POSITION':aid})
G['meshes'][0]['weights']=[0.0]*4
G['meshes'][0]['extras']={'morphTargetNames':['bolus_throat','bolus_neck','bolus_shoulder','bolus_trunk']}

# Build world-orientations for each axial bone. All motions are cyclical or
# one-shot; bone translations remain the anatomical rest lengths.
# The local quaternions ensure rotations physically propagate through a chain.
def smoothstep(x):
    x=np.clip(x,0,1);return x*x*(3-2*x)
def pulse(x,a,b,c,d):return smoothstep((x-a)/(b-a))* (1-smoothstep((x-c)/(d-c)))

def pose(clip,t,duration):
    u=t/duration
    si=np.linspace(0,1,BONES)
    phase=2*np.pi*(2.75*si-u)
    wave=np.zeros(BONES)
    yaw=np.zeros(BONES)
    pitch=np.zeros(BONES)
    jaw=0.0;tongue=0.0;root=[0.,0.,0.]
    if clip=='idle':
        yaw=.025*np.sin(phase)*np.sin(np.pi*si)**.5
        pitch=.013*np.sin(2*np.pi*u)*smoothstep((si-.83)/.17)
        jaw=.035*np.sin(2*np.pi*u)
    elif clip=='slither':
        slither_phase=2*np.pi*(3.52*si-2*u)  # two complete spatial-wave cycles per loop
        yaw=.14*np.sin(slither_phase)*np.sin(np.pi*si)**.5
        pitch=.022*np.sin(slither_phase+.7)*np.sin(np.pi*si)
        root=[0.08*np.sin(2*np.pi*u),0.08*np.cos(2*np.pi*u)-.08,0]
    elif clip=='fast_slither':
        fast_phase=2*np.pi*(4.40*si-3*u)  # three complete cycles: no seam at loop
        yaw=.22*np.sin(fast_phase)*np.sin(np.pi*si)**.55
        pitch=.032*np.sin(fast_phase+.6)*np.sin(np.pi*si)
        root=[.11*np.sin(2*np.pi*u),.11*np.cos(2*np.pi*u)-.11,0]
    elif clip=='coil_defend':
        yaw=(.10+.11*np.sin(2*np.pi*u))*np.sin(2*np.pi*si)*np.sin(np.pi*si)
        pitch=.07*np.sin(2*np.pi*u)*smoothstep((si-.82)/.18)
        jaw=-.02+.10*np.sin(2*np.pi*u)**2
    elif clip=='alert':
        yaw=.06*np.sin(2*np.pi*u)*smoothstep((si-.75)/.25)
        pitch=.12*np.sin(2*np.pi*u)*smoothstep((si-.82)/.18)
        tongue=.24*np.sin(4*np.pi*u)
        jaw=.07+.05*np.sin(2*np.pi*u)
    elif clip=='tongue_flick':
        yaw=.035*np.sin(2*np.pi*u)*smoothstep((si-.85)/.15)
        tongue=.5*np.sin(4*np.pi*u)
        jaw=.10
    elif clip=='ambush_strike':
        crouch=pulse(u,.03,.13,.24,.4)
        strike=pulse(u,.27,.43,.62,.87)
        yaw=.07*np.sin(phase)*np.sin(np.pi*si)+.28*strike*smoothstep((si-.82)/.18)
        pitch=-.20*crouch*smoothstep((si-.85)/.15)+.35*strike*smoothstep((si-.82)/.18)
        jaw=-.05+.20*strike
        root=[0.06*strike,0.,0.]
    elif clip=='venom_bite':
        attack=pulse(u,.08,.28,.61,.83)
        close=pulse(u,.25,.42,.59,.82)
        yaw=.12*attack*smoothstep((si-.79)/.21)
        pitch=.18*attack*smoothstep((si-.84)/.16)
        jaw=.56*close
        tongue=.18*np.sin(6*np.pi*u)*attack
    elif clip=='swallow_whole':
        yaw=.035*np.sin(2*np.pi*(1.6*si-u))*np.sin(np.pi*si)
        pitch=.08*np.sin(2*np.pi*u)*smoothstep((si-.83)/.17)
        jaw=.17*(1-smoothstep((u-.14)/.65))
        tongue=.05*np.sin(4*np.pi*u)
    elif clip=='rest':
        yaw=.009*np.sin(phase)*np.sin(np.pi*si)
        pitch=.007*np.sin(2*np.pi*u)*smoothstep((si-.83)/.17)
        jaw=-.05
    elif clip=='death':
        onset=smoothstep(u/.23)
        yaw=(.2*np.sin(2*np.pi*(si*1.5+u*3))*np.exp(-u*3)*np.sin(np.pi*si))
        pitch=-.80*onset*smoothstep((si-.74)/.26)
        jaw=-.04+.24*pulse(u,.25,.34,.56,.74)
    else:raise ValueError(clip)
    out=np.zeros((BONES,4),dtype=np.float32)
    prev=R.identity()
    for i in range(BONES):
        current=R.from_euler('zy',[yaw[i],pitch[i]])
        out[i]=(prev.inv()*current).as_quat().astype(np.float32)
        prev=current
    # explicit jaw and tongue rotations around the two distinct hinge bones
    jq=R.from_euler('y',jaw).as_quat().astype(np.float32)
    tq=R.from_euler('z',tongue).as_quat().astype(np.float32)
    return out,jq,tq,np.asarray(root,dtype=np.float32)

# glTF animation channels store keyframe arrays (real baked poses), sampler interpolation linear.
clip_specs={
    'idle':(6.,24,True),
    'slither':(4.0,28,True),
    'fast_slither':(2.4,28,True),
    'coil_defend':(5.0,24,True),
    'alert':(3.0,20,True),
    'tongue_flick':(1.5,16,True),
    'ambush_strike':(2.2,28,False),
    'venom_bite':(1.8,26,False),
    'swallow_whole':(7.0,48,False),
    'rest':(7.0,24,True),
    'death':(4.0,30,False)
}
G['animations']=[]
for clip,(dur,samples,loop) in clip_specs.items():
    times=np.linspace(0,dur,samples,dtype=np.float32)
    inaid=add_accessor(times.reshape(-1,1),'SCALAR',include_minmax=True)
    poses=[pose(clip,float(t),dur) for t in times]
    # keep animation rotation channels only if they actually vary
    animation={'name':clip,'samplers':[],'channels':[],
               'extras':{'duration_seconds':dur,'loop':loop,'root_motion':'in-place with small looped sway',
                         'intent':clip}}
    def channel(node,path,vals,typ='VEC4'):
        vals=np.asarray(vals,dtype=np.float32)
        oid=add_accessor(vals,typ)
        k=len(animation['samplers'])
        animation['samplers'].append({'input':inaid,'output':oid,'interpolation':'LINEAR'})
        animation['channels'].append({'sampler':k,'target':{'node':node,'path':path}})
    for i in range(BONES):
        arr=np.asarray([po[0][i] for po in poses],dtype=np.float32)
        if float(np.max(np.abs(arr-arr[0])))>.00009:
            channel(rig_root+i,'rotation',arr)
    for node, slot in ((jaw_id,1),(tongue_id,2)):
        arr=np.array([po[slot] for po in poses],dtype=np.float32)
        if float(np.max(np.abs(arr-arr[0])))>.00009 or float(np.max(np.abs(arr[0]-[0,0,0,1])))>.00009:
            channel(node,'rotation',arr)
    translations=np.asarray([bp[0]+po[3] for po in poses],dtype=np.float32)
    if np.max(np.abs(translations-translations[0]))>.0001:
        channel(rig_root,'translation',translations,'VEC3')
    if clip=='swallow_whole':
        # Four actual morph targets animated as a traveling bulge.
        vals=[]
        for t in times:
            weights=[float(np.exp(-.5*((t-(1.5+i*1.1))/.44)**2)) for i in range(4)]
            vals.extend(weights)
        vals=np.asarray(vals,dtype=np.float32).reshape(-1,1)
        oid=add_accessor(vals,'SCALAR')
        k=len(animation['samplers'])
        animation['samplers'].append({'input':inaid,'output':oid,'interpolation':'LINEAR'})
        animation['channels'].append({'sampler':k,'target':{'node':1,'path':'weights'}})
    G['animations'].append(animation)

G['asset']['generator']='Wildhaven Serpaduna axial GLB rig builder v02; originally trimesh v01'
G['asset']['extras']={'species':'serpaduna','stage':'rig+animation_review','v01_preserved':True,'reference':'approved v01 body / concept 75661.png'}
G['extras']={'coordinate_system':'Y lateral, Z up, X longitudinal','skeleton':'axial chain; 70 spine, 1 jaw, 1 tongue','body_morph_targets':4}
G['buffers'][0]['byteLength']=len(newbin)
json_bytes=json.dumps(G,ensure_ascii=False,separators=(',',':')).encode('utf-8')
json_bytes+=b' '*((-len(json_bytes))%4)
pad4()
length=12+8+len(json_bytes)+8+len(newbin)
with OUT.open('wb') as out:
    out.write(struct.pack('<III',0x46546c67,2,length))
    out.write(struct.pack('<I4s',len(json_bytes),b'JSON'));out.write(json_bytes)
    out.write(struct.pack('<I4s',len(newbin),b'BIN\0'));out.write(newbin)
assert OUT.stat().st_size==length
sha=hashlib.sha256(OUT.read_bytes()).hexdigest()
G2=json.loads(json_bytes)
triangles=sum(G['accessors'][p['indices']]['count']//3 for m in G['meshes'] for p in m['primitives'])
meta={'species_id':'serpaduna','version':'v02','stage':'rig_skinning_animation_review',
      'concept_approved':True,'blockout_form_approved_by_user_action':True,
      'previous_version':'v01 unchanged', 'source_model_sha256':hashlib.sha256(v1).hexdigest(),
      'glb':OUT.name,'bytes':OUT.stat().st_size,'sha256':sha,
      'meshes':len(G['meshes']),'triangles':triangles,
      'skins':len(G['skins']),'joints':J,'spine_joints':BONES,
      'morph_targets':4,'animation_clips':len(G['animations']),
      'clips':[{'name':n,'duration_seconds':d,'keyframes':k,'loop':l} for n,(d,k,l) in clip_specs.items()],
      'rig_method':'real parented glTF joints, skin + cubic four-joint weights; no IK runtime',
      'root_motion':'in-place / sway only; navigation has to move entity itself',
      'uv_body_texture':'same material and embedded UV of v01',
      'venom_and_paralysis':'venom_bite is an animation only, no status logic or VFX here',
      'prey_swallowing':'four morph targets with bolus traveling down upper torso; no prey mesh included',
      'alpha_modified':False, 'publication':'pending remote verification'}
META.write_text(json.dumps(meta,indent=2,ensure_ascii=False),encoding='utf-8')
print(json.dumps({x:meta[x] for x in ('bytes','sha256','joints','animation_clips','triangles','morph_targets')},indent=2))
