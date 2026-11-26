#!/usr/bin/env python3
"""Varrisco v02 — rigged faceted biped, native glTF 2.0 weighted skin and clips.
Rebuilds the APPROVED v01 geometry from a frozen blockout_source.py.
X forward / Y up / Z side, SI metres. Reproducible, no asset replacement.
"""
from __future__ import annotations
import runpy, json, math, hashlib, struct, base64, os
from pathlib import Path
from dataclasses import dataclass
import numpy as np
from scipy.spatial.transform import Rotation
BASE=Path(__file__).resolve().parent.parent
PREV=BASE/'varrisco-v01-anatomy-blockout.glb'
# Original generator is retained bit-for-bit so its anatomical triangles/colors are unchanged.
source=runpy.run_path(str(Path(__file__).with_name('blockout_source.py')))
PARTS=source['PARTS']
G=['root','pelvis','thorax','neck','head','jaw','tailA','tailB','tailC','tailD',
   'thighL','shinL','footL','thighR','shinR','footR',
   'shoulderL','forearmL','handL','shoulderR','forearmR','handR']
N=len(G); IDX={v:i for i,v in enumerate(G)}
# joint hierarchy and global bind positions, already scaled to v01's 0.79 X.
info={
 'root':(None,(0,0,0)),
 'pelvis':('root',(-.43*.79,1.02,0)),
 'thorax':('pelvis',(.18*.79,1.02,0)),
 'neck':('thorax',(.55*.79,1.11,0)),
 'head':('neck',(.86*.79,1.35,0)),
 'jaw':('head',(1.07*.79,1.23,0)),
 'tailA':('pelvis',(-.98*.79,1.012,0)),
 'tailB':('tailA',(-1.34*.79,1.004,0)),
 'tailC':('tailB',(-1.72*.79,.953,0)),
 'tailD':('tailC',(-2.10*.79,.917,0)),
 'thighL':('pelvis',(-.45*.79,1.01,.245)),
 'shinL':('thighL',(.00*.79,.568,.311)),
 'footL':('shinL',(-.17*.79,.169,.331)),
 'thighR':('pelvis',(-.45*.79,1.01,-.245)),
 'shinR':('thighR',(.00*.79,.568,-.311)),
 'footR':('shinR',(-.17*.79,.169,-.331)),
 'shoulderL':('thorax',(.36*.79,1.061,.20)),
 'forearmL':('shoulderL',(.445*.79,.828,.263)),
 'handL':('forearmL',(.625*.79,.817,.263)),
 'shoulderR':('thorax',(.36*.79,1.061,-.20)),
 'forearmR':('shoulderR',(.445*.79,.828,-.263)),
 'handR':('forearmR',(.625*.79,.817,-.263)),
}
assert len(info)==N
parents={k:info[k][0] for k in G}; centers={k:np.array(info[k][1],float) for k in G}
# First assemble exact original vertices, triangles, colors; retain independent hard normals.
vv=[];ff=[];cc=[];parts=[]
for part,m in PARTS:
 p=m.vertices.astype(np.float32).copy();p[:,0]*=.79
 f=m.faces.astype(np.uint32).copy(); offset=len(vv)
 vv.extend(p);ff.extend(f+offset);cc.extend(np.asarray(m.visual.vertex_colors,dtype=np.uint8)[:,:4]);parts.extend([part]*len(p))
VV=np.array(vv,dtype=np.float32);FF=np.array(ff,dtype=np.uint32);CC=np.array(cc,dtype=np.uint8)
assert len(FF)==2754 and FF.max()<len(VV)
# Each original triangle had distinct vertices: facet normals match the original blockout.
tri=VV[FF];norm=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]);norm/=np.maximum(np.linalg.norm(norm,axis=1,keepdims=True),1e-10)
NORMALS=np.zeros_like(VV);NORMALS[FF.reshape(-1)]=np.repeat(norm,3,axis=0)

def blend(v,items):
 items=[(IDX[name],float(max(0.,w))) for name,w in items if w>0]
 items=sorted(items,key=lambda it:-it[1])[:4];outJ=np.zeros(4,dtype=np.uint16);outW=np.zeros(4,dtype=np.float32)
 if not items: items=[(IDX['pelvis'],1.)]
 for k,(j,w) in enumerate(items):outJ[k]=j;outW[k]=w
 outW/=outW.sum();return outJ,outW

def bind_skin(part,v):
 s='L' if any(x in part for x in ['_1','_L']) else 'R'  # signed parts use +/- 1, not _L
 if '_-1' in part:s='R'
 if part.startswith(('07_','08_','09_','10_','11_','12_','13_','14_')):
  if part.startswith(('07_','14_')):return blend(v,[(f'thigh{s}',1.)])
  if part.startswith(('08_',)):
   t=np.clip((.63-v[1])/.22,0,1)
   return blend(v,[(f'thigh{s}',.22*(1-t)),(f'shin{s}',.78+.22*t)])
  return blend(v,[(f'foot{s}',1.)])
 if part.startswith(('24_','25_','26_','27_')):
  bone=('shoulder' if part.startswith('24_') else 'forearm' if part.startswith('25_') else 'hand')+s
  return blend(v,[(bone,1.)])
 if part.startswith(('05_','06_')):
  # weighted tail bridges; the varying sections can curve without tearing.
  x=v[0]
  anchors=[('pelvis',-.72*.79),('tailA',-.98*.79),('tailB',-1.34*.79),('tailC',-1.72*.79),('tailD',-2.10*.79)]
  if x>=anchors[0][1]:return blend(v,[('pelvis',1.)])
  for (n0,x0),(n1,x1) in zip(anchors,anchors[1:]):
   if x0>=x>=x1:
    t=np.clip((x0-x)/(x0-x1),0,1)
    return blend(v,[(n0,1-t),(n1,t)])
  return blend(v,[('tailD',1.)])
 if part.startswith(('16_','17_','19_','20_','21_','22_','23_')):return blend(v,[('head',1.)])
 if part.startswith('18_'):return blend(v,[('jaw',1.)])
 if part.startswith('15_'):
  t=np.clip((v[1]-1.04)/.30,0,1)
  return blend(v,[('neck',.75+.25*t),('head',.25*t),('thorax',.25*(1-t))])
 if part.startswith('28_'):return blend(v,[('head',.85),('neck',.15)])
 if part.startswith(('26_','27_')):return blend(v,[(f'hand{s}',1.)])
 if part.startswith('01_'):
  t=np.clip((v[0]+.28)/.55,0,1)
  return blend(v,[('pelvis',1-t),('thorax',t)])
 if part.startswith(('03_','04_','30_')):
  t=np.clip((v[0]+.35)/.65,0,1)
  return blend(v,[('pelvis',1-t),('thorax',t)])
 return blend(v,[('thorax',1.)])

JOINTS=np.empty((len(VV),4),dtype=np.uint16);WEIGHTS=np.empty((len(VV),4),dtype=np.float32)
for i,(p,v) in enumerate(zip(parts,VV)):
 JOINTS[i],WEIGHTS[i]=bind_skin(p,v)
assert np.allclose(WEIGHTS.sum(axis=1),1,atol=1e-6)
# Local rest pose translation = global joint origin minus global parent origin.
localpos={g:centers[g]-(centers[parents[g]] if parents[g] else np.zeros(3)) for g in G}
# glTF matrices are column-major, inverses of rest global translations.
INV=np.stack([np.eye(4) for _ in G])
for i,g in enumerate(G):INV[i,:3,3]=-centers[g]

CLIPS={
 'idle':(3.6,24,True),'walk':(1.35,30,True),'run':(.73,30,True),
 'stalk':(2.35,24,True),'turn_left':(1.15,24,False),'turn_right':(1.15,24,False),
 'alert':(1.55,24,False),'sniff':(1.90,24,True),'bite':(.92,30,False),
 'claw_slash':(1.0,30,False),'pounce':(1.24,32,False),
 'feed':(2.30,24,True),'drink':(2.20,24,True),
 'threat_display':(2.10,24,True),'rest':(3.25,24,True),
 'hurt':(1.05,24,False),'death':(2.6,30,False),
}
# Rotations in radians around Y (yaw), Z (sagittal flex), and X (lateral roll).
def pose(clip,t,duration):
 phase=2*math.pi*t/duration
 xyz={g:np.zeros(3,dtype=float) for g in G};tr={g:np.zeros(3,dtype=float) for g in G}
 breath=math.sin(2*phase)
 xyz['thorax'][2]=.018*breath
 xyz['neck'][2]=.017*(math.sin(phase+.5)-math.sin(.5))
 xyz['head'][2]=.013*(math.sin(phase+1.)-math.sin(1.))
 xyz['tailA'][1]=.024*(math.sin(phase+.5)-math.sin(.5));xyz['tailB'][1]=.032*(math.sin(phase+1.1)-math.sin(1.1))
 xyz['tailC'][1]=.043*(math.sin(phase+1.6)-math.sin(1.6));xyz['tailD'][1]=.038*(math.sin(phase+2.1)-math.sin(2.1))
 tr['pelvis'][1]=.007*breath
 if clip in ('walk','run','stalk'):
  amp={'walk':.44,'run':.77,'stalk':.24}[clip];knee={'walk':.27,'run':.58,'stalk':.16}[clip]
  for s,shift in [('L',0.),('R',math.pi)]:
   a=math.sin(phase+shift); swing=max(0.,math.cos(phase+shift))
   xyz['thigh'+s][2]=amp*a
   xyz['shin'+s][2]=-knee*(swing+.28)+.09*a
   xyz['foot'+s][2]=-(.35*amp*a-.25*knee*swing)
   xyz['shoulder'+s][2]=-.15*a
   xyz['forearm'+s][2]=.13*a
  xyz['thorax'][2]=-.07 if clip=='run' else .01*math.sin(phase)
  tr['pelvis'][1]=(0.018 if clip=='walk' else .03 if clip=='run' else .009)*(1-math.cos(2*phase))
  xyz['pelvis'][0]=.022*math.sin(phase)
  xyz['tailA'][2]=.07*math.sin(phase+1.4)
  xyz['head'][1]=.035*math.sin(phase+1.3)
 elif clip in ('turn_left','turn_right'):
  sign=1 if clip=='turn_left' else -1
  u=math.sin(math.pi*t/duration)**2
  xyz['root'][1]=sign*.55*(.5-.5*math.cos(math.pi*t/duration))
  xyz['head'][1]=sign*.19*u
  xyz['tailA'][1]=-sign*.25*u;xyz['tailB'][1]=-sign*.18*u
  xyz['thighL'][2]=sign*.08*u;xyz['thighR'][2]=-sign*.08*u
 elif clip=='alert':
  u=math.sin(math.pi*min(t/duration,1))**2
  xyz['neck'][2]=-.17*u;xyz['head'][2]=.12*u
  xyz['head'][1]=.24*u;xyz['tailA'][1]=-.14*u
 elif clip=='sniff':
  u=.5-.5*math.cos(2*phase)
  xyz['neck'][2]=.19*u;xyz['head'][2]=.21*u
  xyz['head'][1]=.11*math.sin(phase);tr['pelvis'][1]=-.022*u
 elif clip=='bite':
  q=t/duration;u=math.sin(math.pi*min(q/.8,1))**2 if q<.8 else 0
  xyz['neck'][2]=.30*u;xyz['head'][2]=-.40*u
  xyz['jaw'][2]=-.31*max(0,math.sin(math.pi*q))
  xyz['thorax'][2]=.095*u
 elif clip=='claw_slash':
  q=t/duration;u=math.sin(math.pi*q)**2
  xyz['shoulderL'][2]=-.65*u;xyz['forearmL'][2]=-.58*u
  xyz['shoulderR'][2]=.28*u;xyz['thorax'][1]=.13*u
  xyz['neck'][2]=-.11*u
 elif clip=='pounce':
  q=t/duration;u=math.sin(math.pi*q)
  xyz['thighL'][2]=-.32*u;xyz['thighR'][2]=-.32*u
  xyz['shinL'][2]=-.38*u;xyz['shinR'][2]=-.38*u
  xyz['thorax'][2]=-.28*u
  xyz['shoulderL'][2]=-.60*u;xyz['shoulderR'][2]=-.60*u
  tr['pelvis'][1]=.24*max(0,u)**2
  tr['pelvis'][0]=.16*u
  xyz['tailA'][2]=.20*u
 elif clip in ('feed','drink'):
  d=clip=='drink';u=.5-.5*math.cos(phase)
  xyz['neck'][2]=(.45 if d else .27)*u
  xyz['head'][2]=(.22 if d else .3)*u
  xyz['jaw'][2]=-.10*(.5-.5*math.cos(3*phase))
  xyz['thorax'][2]=.025*u
 elif clip=='threat_display':
  u=.5-.5*math.cos(phase)
  xyz['neck'][2]=-.22*u;xyz['head'][2]=-.11*u
  xyz['jaw'][2]=-.25*u
  xyz['shoulderL'][0]=-.20*u;xyz['shoulderR'][0]=.20*u
  xyz['tailA'][1]=.18*math.sin(phase);xyz['tailB'][1]=.14*math.sin(phase+1)
 elif clip=='rest':
  u=.60+.08*math.sin(phase)
  tr['pelvis'][1]=-.23*u
  xyz['thighL'][2]=-.24*u;xyz['thighR'][2]=-.24*u
  xyz['shinL'][2]=.42*u;xyz['shinR'][2]=.42*u
  xyz['neck'][2]=.11*u;xyz['head'][2]=.20*u
 elif clip=='hurt':
  u=math.sin(math.pi*t/duration)
  xyz['thorax'][1]=.22*u;xyz['neck'][2]=.18*u
  xyz['head'][1]=-.18*u;xyz['thighR'][2]=.20*u
 elif clip=='death':
  q=t/duration;u=q*q*(3-2*q)
  # Sprawling fall; remains at final pose, non-looping.
  xyz['root'][0]=.68*u;xyz['root'][2]=-.19*u
  tr['root'][1]=-.43*u
  xyz['neck'][2]=.39*u;xyz['head'][2]=.35*u;xyz['jaw'][2]=-.12*u
  xyz['thighL'][2]=-.52*u;xyz['thighR'][2]=.30*u
  xyz['shinL'][2]=.48*u;xyz['shinR'][2]=-.24*u
  xyz['tailA'][2]=-.16*u
 else:
  pass
 return xyz,tr

def quat(xyz):
 # z rotation in sagittal plane, applied after yaw and roll.
 return Rotation.from_euler('xyz',xyz).as_quat().astype(np.float32) # xyzw

class Writer:
 def __init__(self):self.blob=bytearray();self.views=[];self.access=[]
 def put(self,arr,component,shape,target=None,normalized=False,minmax=False):
  data=np.ascontiguousarray(arr);offset=len(self.blob)
  self.blob.extend(data.tobytes());self.blob.extend(b'\0'*((-len(self.blob))%4))
  view={'buffer':0,'byteOffset':offset,'byteLength':data.nbytes}
  if target is not None:view['target']=target
  self.views.append(view)
  acc={'bufferView':len(self.views)-1,'componentType':component,'type':shape,'count':len(data)}
  if normalized:acc['normalized']=True
  if minmax:
   vals=np.asarray(data);acc['min']=vals.min(axis=0).astype(float).tolist();acc['max']=vals.max(axis=0).astype(float).tolist()
  self.access.append(acc)
  return len(self.access)-1
 def pack(self,gltf,path):
  gltf['buffers']=[{'byteLength':len(self.blob)}]
  gltf['bufferViews']=self.views;gltf['accessors']=self.access
  h=json.dumps(gltf,separators=(',',':'),ensure_ascii=False).encode();h+=b' '*((-len(h))%4)
  b=bytes(self.blob);b+=b'\0'*((-len(b))%4)
  binary=b'glTF'+struct.pack('<II',2,12+8+len(h)+8+len(b))+struct.pack('<I4s',len(h),b'JSON')+h+struct.pack('<I4s',len(b),b'BIN\x00')+b
  path.write_bytes(binary);return binary

def export(out_file):
 w=Writer()
 pos=w.put(VV.astype('<f4'),5126,'VEC3',target=34962,minmax=True)
 normal=w.put(NORMALS.astype('<f4'),5126,'VEC3',target=34962)
 col=w.put(CC,5121,'VEC4',target=34962,normalized=True)
 joints=w.put(JOINTS.astype('<u2'),5123,'VEC4',target=34962)
 weights=w.put(WEIGHTS.astype('<f4'),5126,'VEC4',target=34962)
 idx=w.put(FF.reshape(-1).astype('<u4'),5125,'SCALAR',target=34963)
 ibm=w.put(INV.astype('<f4').transpose(0,2,1).copy(),5126,'MAT4')
 nodes=[{'name':'varrisco_skinned_mesh','mesh':0,'skin':0}]
 for g in G:
  nd={'name':g,'translation':localpos[g].tolist()}
  kids=[i+1 for i,v in enumerate(G) if parents[v]==g]
  if kids:nd['children']=kids
  nodes.append(nd)
 gltf={'asset':{'version':'2.0','generator':'Wildhaven Varrisco v02 weighted skin custom exporter'},
  'scene':0,'scenes':[{'nodes':[0,1]}], 'nodes':nodes,
  'meshes':[{'name':'Varrisco_v02_facet_silhouette','primitives':[{'attributes':{
     'POSITION':pos,'NORMAL':normal,'COLOR_0':col,'JOINTS_0':joints,'WEIGHTS_0':weights},
      'indices':idx,'material':0,'mode':4}]}],
  'skins':[{'name':'Varrisco_v02_weighted_skin','joints':list(range(1,N+1)),'inverseBindMatrices':ibm,'skeleton':1}],
  'materials':[{'name':'varrisco_matte_vertex_palette','doubleSided':False,'pbrMetallicRoughness':{
    'baseColorFactor':[1,1,1,1],'metallicFactor':0.0,'roughnessFactor':0.97}}],
  'animations':[]}
 for clip,(duration,fps,loop) in CLIPS.items():
  times=np.linspace(0,duration,int(math.ceil(duration*fps))+1,dtype=np.float32)
  time_acc=w.put(times.astype('<f4'),5126,'SCALAR',minmax=True)
  channels=[];samplers=[]
  for g in G:
   rs=[];ts=[]
   for t in times:
    rv,tv=pose(clip,float(t),duration);rs.append(quat(rv[g]));ts.append(localpos[g]+tv[g])
   ro=np.stack(rs);tr=np.stack(ts).astype('<f4')
   # avoid identical adjacent quaternions having antipodal signatures
   for i in range(1,len(ro)):
    if np.dot(ro[i],ro[i-1])<0:ro[i]*=-1
   if not np.allclose(ro,np.array([0,0,0,1],dtype=np.float32)):
    out=w.put(ro.astype('<f4'),5126,'VEC4');samplers.append({'input':time_acc,'output':out,'interpolation':'LINEAR'});
    channels.append({'sampler':len(samplers)-1,'target':{'node':IDX[g]+1,'path':'rotation'}})
   if any(np.linalg.norm(tr-localpos[g],axis=1)>1e-6):
    out=w.put(tr,5126,'VEC3');samplers.append({'input':time_acc,'output':out,'interpolation':'LINEAR'});
    channels.append({'sampler':len(samplers)-1,'target':{'node':IDX[g]+1,'path':'translation'}})
  gltf['animations'].append({'name':clip,'samplers':samplers,'channels':channels,
   'extras':{'durationSeconds':duration,'loop':loop,'rootMotion':'in_place' if clip!='pounce' else 'short_lunge'}})
 raw=w.pack(gltf,out_file)
 return len(raw),hashlib.sha256(raw).hexdigest(),gltf

GLB=BASE/'varrisco-animated-v02-LOD0.glb'
size,sha,gltf=export(GLB)
manifest={
 'id':'varrisco','name':'Varrisco','version':'v02','stage':'final_rig_animations','style':'Torvardo v03 faceted anatomical planes',
 'concept':'approved 2026-11-09','form':'user requested continuation to animations 2026-11-09',
 'habitats':['savanna','desert'],'variants':1,'integrated_in_game':False,
 'source_geometry':'v01 original authoring PARTS reused unchanged, X scaled .79',
 'glb':{'path':GLB.name,'bytes':size,'sha256':sha,'mesh_primitives':1,'triangles':int(len(FF)),
        'skin_count':1,'joint_count':N,'weighted_vertices':int(len(VV)),
        'materials':1,'animation_count':len(CLIPS)},
 'clips':[{'name':name,'duration_seconds':v[0],'fps':v[1],'loop':v[2]} for name,v in CLIPS.items()],
 'geometry_stats':{'vertices':len(VV),'triangles':len(FF),'original_faceted_parts':len(PARTS)},
 'limitations':['keyframed weighted skin, no runtime IK','in-place cycles may have foot sliding','physics and ecology integration not part of this asset'],
 'authored_axes':'X-forward Y-up Z-lateral',
 'preview_method':'VTK GLTF importer from exported GLB and animation time updates',
 'previous_version_preserved':'v01 static GLB available separately',
 }
(BASE/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'glb':str(GLB),'size':size,'sha256':sha,'triangles':len(FF),'joints':N,'animations':list(CLIPS)},ensure_ascii=False))