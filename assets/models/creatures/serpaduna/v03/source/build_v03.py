#!/usr/bin/env python3
"""Serpáduna v03 — corrigir permanentemente a pose de repouso enrolada.
Lê GLB v02 real; preserva UV, geometria facial, morphs, pesos e nomes dos clipes.
Remodela a malha corporal em pose alongada e REFaz bind pose, IBM e animações.
Adiciona coil_enter e coil_exit reais sem modificar arquivos v01/v02 nem a Alpha.
"""
import struct, json, hashlib, math
from pathlib import Path
import numpy as np
from scipy.spatial.transform import Rotation as R
ROOT=Path(__file__).resolve().parents[1]
IN=ROOT.parent/'v02'/'serpaduna_v02_rig_animated.glb'
OUT=ROOT/'serpaduna_v03_uncoiled_rigged.glb'
b=IN.read_bytes()
assert struct.unpack_from('<III',b)==(0x46546c67,2,len(b))
p=12;chunks=[]
while p<len(b):
 n,k=struct.unpack_from('<I4s',b,p);p+=8;chunks.append((k,b[p:p+n]));p+=n
G=json.loads(next(x for k,x in chunks if k==b'JSON'))
buf=bytearray(next(x for k,x in chunks if k==b'BIN\0'))
num={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
dtypes={5126:'<f4',5123:'<u2',5121:'<u1',5125:'<u4'}
def info(ai):
 a=G['accessors'][ai];bv=G['bufferViews'][a['bufferView']];dt=np.dtype(dtypes[a['componentType']]);n=num[a['type']];off=bv.get('byteOffset',0)+a.get('byteOffset',0);return a,bv,dt,n,off
def read(ai):
 a,bv,dt,n,off=info(ai)
 assert bv.get('byteStride',n*dt.itemsize)==n*dt.itemsize, 'interleaved not supported'
 return np.frombuffer(buf,offset=off,count=a['count']*n,dtype=dt).reshape(a['count'],n).copy()
def replace(ai,arr):
 a,bv,dt,n,off=info(ai);arr=np.ascontiguousarray(arr,dtype=dt)
 assert arr.shape==(a['count'],n),(ai,arr.shape,a['count'],n)
 buf[off:off+arr.nbytes]=arr.tobytes()
 if 'min' in a:a['min']=np.min(arr,axis=0).astype(float).tolist()
 if 'max' in a:a['max']=np.max(arr,axis=0).astype(float).tolist()
def add(arr,typ,component=5126):
 global buf
 arr=np.ascontiguousarray(arr,dtype=np.dtype(dtypes[component]));assert len(arr.shape)==2
 while len(buf)%4:buf.append(0)
 offset=len(buf);buf.extend(arr.tobytes());bvno=len(G['bufferViews']);G['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':arr.nbytes})
 index=len(G['accessors']);a={'bufferView':bvno,'componentType':component,'count':len(arr),'type':typ}
 if typ=='SCALAR':a['min']=[float(np.min(arr))];a['max']=[float(np.max(arr))]
 G['accessors'].append(a);return index
# Extract original 190×17 body rings straight from actual GLB.
attr=G['meshes'][0]['primitives'][0]['attributes'];xyz=read(attr['POSITION']).astype(float)
NR,NV=190,17; assert len(xyz)==NR*NV
coiled=xyz.reshape(NR,NV,3)[:,:16].mean(axis=1)
cum=np.r_[0,np.cumsum(np.linalg.norm(np.diff(coiled,axis=0),axis=1))]
q=cum/cum[-1]
assert 13.5<cum[-1]<14.5
# Rest form: 15 m nose-to-tail; almost straight lateral axis and raised neck.
# A gently lifted final 2.5 m preserves ground clearance without coiling.
def smoother(x):
 x=np.clip(x,0,1);return x*x*(3-2*x)
base=np.column_stack([6.95-14.02*q, .12*np.sin(np.pi*q)*np.sin(2*np.pi*q), .47+.67*smoother((q-.82)/.18)])
assert (base[0,0]-base[-1,0])>13.9

def frame(path):
 t=np.gradient(path,axis=0);t/=np.linalg.norm(t,axis=1)[:,None]
 side=np.cross(np.tile([0,0,1.],(len(path),1)),t)
 for i in range(len(path)):
  if np.linalg.norm(side[i])<.025:side[i]=side[i-1] if i else np.array([0.,-1,0.])
 side/=np.maximum(np.linalg.norm(side,axis=1)[:,None],1e-8)
 up=np.cross(t,side);up/=np.maximum(np.linalg.norm(up,axis=1)[:,None],1e-8)
 # Original spine's early-upward flips are intentionally kept consistent with ring orientation.
 return t,side,up
origT,origSide,origUp=frame(coiled)
newT,newSide,newUp=frame(base)
# The v01 generator flips side/up whenever up.z < 0 in the main body.
# Our original frames from cross(t, cross(z,t)) are up-positive already.
radial=xyz.reshape(NR,NV,3)-coiled[:,None,:]
lat=np.einsum('ijk,ik->ij',radial,origSide)
vert=np.einsum('ijk,ik->ij',radial,origUp)
newxyz=base[:,None,:]+lat[:,:,None]*newSide[:,None,:]+vert[:,:,None]*newUp[:,None,:]
replace(attr['POSITION'],newxyz.reshape(-1,3))
# Morph target offsets transform with exactly the same local radial frames.
for m in G['meshes'][0]['primitives'][0]['targets']:
 aid=m['POSITION'];v=read(aid).reshape(NR,NV,3)
 sideAmp=np.einsum('ijk,ik->ij',v,origSide)
 upAmp=np.einsum('ijk,ik->ij',v,origUp)
 newV=sideAmp[:,:,None]*newSide[:,None,:]+upAmp[:,:,None]*newUp[:,None,:]
 replace(aid,newV.reshape(-1,3))
# Cranial details were authored in global coordinates; all head meshes translate
# together, retaining the approved skull, venom fangs and lower jaw geometry.
head_shift=base[-1]-coiled[-1]
for mi in range(1,len(G['meshes'])):
 prim=G['meshes'][mi]['primitives'][0];aid=prim['attributes']['POSITION'];v=read(aid).astype(float)
 if 46<=mi<=50: # five functional dorsal tail spines, not coloring overlays
  ri=3+(mi-46)*5
  rr=v-coiled[ri];a=rr@origT[ri];bb=rr@origSide[ri];cc=rr@origUp[ri]
  v=base[ri]+a[:,None]*newT[ri]+bb[:,None]*newSide[ri]+cc[:,None]*newUp[ri]
 else:
  v=v+head_shift
 replace(aid,v)
# Skeleton must now bind to the STRAIGHT body. Changing only animation rotations
# would leave a permanent coil and incorrect inverse bind matrices.
skin=G['skins'][0];joints=skin['joints'];root=skin['skeleton']; B=70
bq=np.linspace(0,1,B)
bp=np.column_stack([np.interp(bq,q,base[:,i]) for i in range(3)])
oldhead=coiled[-1]
rest_positions=np.vstack([bp,bp[-1]+[-.15,0.,-.20],bp[-1]+[-.50,0.,-.37]])
for i in range(B):
 d=bp[i]-(bp[i-1] if i else np.zeros(3))
 G['nodes'][joints[i]]['translation']=d.astype(float).tolist()
 G['nodes'][joints[i]].pop('rotation',None)
for jidx in (B,B+1):
 G['nodes'][joints[jidx]]['translation']=(rest_positions[jidx]-bp[-1]).tolist()
 G['nodes'][joints[jidx]].pop('rotation',None)
ibm=np.array([np.eye(4,dtype='<f4') for _ in joints])
for k,pt in enumerate(rest_positions):ibm[k,:3,3]=-pt
replace(skin['inverseBindMatrices'],ibm.transpose(0,2,1).reshape(-1,16))
# Prevent initial pose from being overridden by old coiled channels.
G['animations']=[]
# Animation world heading is applied progressively from tail to head. Converting
# world rotations to parent-local quaternions yields a true articulated chain.
# The coiling spiral tightens along arclength to avoid stacked circles.
S=np.linspace(0,1,B)
def pulse(u,a,b,c,d):
 return smoother((u-a)/(b-a))*(1-smoother((u-c)/(d-c)))
def motions(name,u):
 wave=np.zeros(B); pitch=np.zeros(B); jaw=0.;tongue=0.;coiling=0.; rootmove=np.zeros(3)
 if name=='idle':
  wave=.018*np.sin(2*np.pi*(2.1*S-u))*np.sin(np.pi*S)**.5
  pitch=.012*np.sin(2*np.pi*u)*smoother((S-.82)/.18)
 elif name=='slither':
  wave=.23*np.sin(2*np.pi*(2.4*S-u))*np.sin(np.pi*S)**.28
  pitch=.008*np.sin(2*np.pi*(S-u))*np.sin(np.pi*S)
 elif name=='fast_slither':
  wave=.34*np.sin(2*np.pi*(3.1*S-2*u))*np.sin(np.pi*S)**.28
 elif name=='coil_enter':coiling=smoother(u)
 elif name=='coil_exit':coiling=1-smoother(u)
 elif name=='coil_defend':
  coiling=1.;wave=.018*np.sin(2*np.pi*u)*np.sin(np.pi*S)
  pitch=.02*np.sin(2*np.pi*u)*smoother((S-.85)/.15);jaw=.13*math.sin(math.pi*u)**2
 elif name=='alert':
  wave=.04*np.sin(2*np.pi*u)*smoother((S-.79)/.21)
  pitch=.09*np.sin(2*np.pi*u)*smoother((S-.85)/.15)
  tongue=.18*math.sin(4*np.pi*u);jaw=.05
 elif name=='tongue_flick':
  tongue=.5*math.sin(4*np.pi*u);jaw=.11
 elif name=='ambush_strike':
  strike=pulse(u,.22,.38,.58,.84)
  wave=.14*strike*smoother((S-.79)/.21)
  pitch=(-.20*pulse(u,.04,.14,.25,.39)+.32*strike)*smoother((S-.82)/.18)
  jaw=.32*strike
 elif name=='venom_bite':
  bite=pulse(u,.15,.26,.67,.85)
  wave=.08*bite*smoother((S-.79)/.21)
  pitch=.15*bite*smoother((S-.85)/.15)
  jaw=.51*bite;tongue=.16*math.sin(6*np.pi*u)*bite
 elif name=='swallow_whole':
  wave=.024*np.sin(2*np.pi*(S-u))*np.sin(np.pi*S)
  pitch=.07*np.sin(2*np.pi*u)*smoother((S-.85)/.15)
  jaw=.17*(1-smoother((u-.13)/.67))
 elif name=='rest':
  wave=.007*np.sin(2*np.pi*(S-u))*np.sin(np.pi*S)
 elif name=='death':
  onset=smoother(u/.34)
  wave=.09*np.sin(2*np.pi*(1.4*S+3*u))*np.exp(-3*u)*np.sin(np.pi*S)
  pitch=-.45*onset*smoother((S-.78)/.22);jaw=.1*pulse(u,.19,.29,.55,.72)
 else:raise ValueError(name)
 # World yaw difference: gradually growing curvature, increasing for smaller headward radius.
 yaw=wave+2*np.pi*(.92*S+.35*S*S)*coiling
 # Root pulls toward the center as the snake coils, unwinds back to tail position.
 rootmove=np.array([-6.15*coiling,.15*coiling,0.])
 world=[R.from_euler('zy',[float(yaw[i]),float(pitch[i])]) for i in range(B)]
 local=[];prev=R.identity()
 for rot in world:
  local.append((prev.inv()*rot).as_quat())
  prev=rot
 return np.array(local,dtype='<f4'),R.from_euler('y',jaw).as_quat().astype('<f4'),R.from_euler('z',tongue).as_quat().astype('<f4'),(bp[0]+rootmove).astype('<f4')
clips={
 'idle':(6.,25,True),'slither':(4.,49,True),'fast_slither':(2.4,49,True),
 'coil_enter':(6.,65,False),'coil_defend':(5.,41,True),'coil_exit':(6.,65,False),
 'alert':(3.,25,True),'tongue_flick':(1.5,25,True),'ambush_strike':(2.2,34,False),
 'venom_bite':(1.8,33,False),'swallow_whole':(7.,57,False),
 'rest':(7.,25,True),'death':(4.,41,False)
}
for clip,(duration,samples,loop) in clips.items():
 times=np.linspace(0,duration,samples,dtype='<f4'); tid=add(times.reshape(-1,1),'SCALAR')
 poses=[motions(clip,float(t/duration)) for t in times]
 anim={'name':clip,'samplers':[],'channels':[],'extras':{'loop':loop,'duration_seconds':duration,'root_motion':'coil root moves as body contracts; locomotion in-place','source':'GLB v03 rest-pose corrective rebuild'}}
 def channel(joint,path,values,typ='VEC4'):
  ar=np.asarray(values,dtype='<f4')
  # Keep static channels out for filesize, but root position is always included when coiled.
  if np.max(np.abs(ar-ar[0]))<1e-6:
   if path=='rotation' and np.max(np.abs(ar[0]-np.array([0,0,0,1])))<1e-6:return
   if path=='translation' and np.max(np.abs(ar[0]-bp[0]))<1e-6:return
  aid=add(ar,typ);k=len(anim['samplers']);anim['samplers'].append({'input':tid,'output':aid,'interpolation':'LINEAR'});anim['channels'].append({'sampler':k,'target':{'node':joint,'path':path}})
 for bi in range(B):channel(joints[bi],'rotation',[p[0][bi] for p in poses])
 channel(joints[B],'rotation',[p[1] for p in poses]);channel(joints[B+1],'rotation',[p[2] for p in poses])
 channel(root,'translation',[p[3] for p in poses],typ='VEC3')
 if clip=='swallow_whole':
  weights=np.array([[np.exp(-.5*((float(t)-(1.5+j*1.1))/.44)**2) for j in range(4)] for t in times],dtype='<f4')
  # glTF morph weight animation output uses one scalar per target per sample.
  aid=add(weights.reshape(-1,1),'SCALAR');k=len(anim['samplers']);anim['samplers'].append({'input':tid,'output':aid,'interpolation':'LINEAR'});anim['channels'].append({'sampler':k,'target':{'node':1,'path':'weights'}})
 G['animations'].append(anim)
G['asset']['generator']='Wildhaven Serpaduna v03 uncoiled rest-pose rebuild'
G['asset']['extras']={'species':'serpaduna','version':'v03','source_glb':'serpaduna_v02_rig_animated.glb','source_sha256':hashlib.sha256(b).hexdigest(),'replaces_in_place':False}
G['extras']={'bugfix':'uncoiled neutral geometry and skin bind pose; coiling animated only','axis':'X forward negative, Z vertical','alpha_modified':False,'joints':72,'morph_targets':4}
G['buffers'][0]['byteLength']=len(buf)
while len(buf)%4:buf.append(0)
G['buffers'][0]['byteLength']=len(buf)
js=json.dumps(G,ensure_ascii=False,separators=(',',':')).encode();js+=b' '*((-len(js))%4)
with OUT.open('wb') as o:
 o.write(struct.pack('<III',0x46546c67,2,12+8+len(js)+8+len(buf)))
 o.write(struct.pack('<I4s',len(js),b'JSON'));o.write(js)
 o.write(struct.pack('<I4s',len(buf),b'BIN\0'));o.write(buf)
assert OUT.stat().st_size==12+8+len(js)+8+len(buf)
tri=sum(G['accessors'][p['indices']]['count']//3 for m in G['meshes'] for p in m['primitives'])
meta={'id':'serpaduna','version':'v03','bug':'v02 was permanently coiled by rest mesh and inverse bind pose','fix':'uncoiled neutral mesh + corrected joint hierarchy bind positions, inverseBindMatrices, reauthored 13 clips, coil_enter/exit','source_sha256':hashlib.sha256(b).hexdigest(),'output':OUT.name,'sha256':hashlib.sha256(OUT.read_bytes()).hexdigest(),'bytes':OUT.stat().st_size,'skins':1,'joints':72,'body_joints':70,'triangles':tri,'morph_targets':4,'animations':[{'name':name,'seconds':dur,'loop':loop} for name,(dur,_,loop) in clips.items()],'alpha_modified':False,'published':False,'approval':'pending director + quality review'}
(ROOT/'manifest.json').write_text(json.dumps(meta,indent=2,ensure_ascii=False))
print(json.dumps(meta,indent=2,ensure_ascii=False))