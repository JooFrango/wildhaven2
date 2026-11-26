#!/usr/bin/env python3
"""Varrisco v07 candidate: existing approved v06, preserve all animation tracks.
Replace geometric pigment overlays with a real UV atlas, repair side-specific
skin bindings, refine structural facets and sickle silhouette. No runtime changes.
"""
import hashlib, io, json, math, struct, sys
from pathlib import Path
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT.parent/'v06'/'varrisco-animated-v06-LOD0.glb'
raw=BASE.read_bytes()
assert hashlib.sha256(raw).hexdigest()=='7ecfc5f3c71ce9617c561de65151da771b1c0a945170291d8080266ba2b45d57'
jl=struct.unpack_from('<I',raw,12)[0]
g=json.loads(raw[20:20+jl]); b=bytearray(raw[28+jl:])
p=g['meshes'][0]['primitives'][0]
assert len(g['animations'])==49 and len(g['skins'][0]['joints'])==22
A=g['accessors']; V=g['bufferViews']
def get(i,dtype,width):
 a=A[i];v=V[a['bufferView']]
 return np.frombuffer(b,dtype=dtype,count=a['count']*width,offset=v.get('byteOffset',0)+a.get('byteOffset',0)).copy().reshape(-1,width)
pos=get(p['attributes']['POSITION'],'<f4',3)
col=get(p['attributes']['COLOR_0'],'u1',4)
J=get(p['attributes']['JOINTS_0'],'<u2',4)
W=get(p['attributes']['WEIGHTS_0'],'<f4',4)
idx=get(p['indices'],'<u4',1).ravel()
assert len(idx)==8262 and np.array_equal(idx,np.arange(8262))
# Exact triangle ranges derived from the frozen v01 source in original repo PR49.
parts=[]
def part(name,a,z):parts.append((name,a,z))
part('trunk',0,220);part('belly',220,312)
for n,a,z in [('haunchR',312,328),('flankR',328,340),('haunchL',340,356),('flankL',356,368),('tail',368,544)]:part(n,a,z)
part('pigment_tail',544,784)
for side,o in [('R',784),('L',1172)]:
 for n,a,z in [('thigh',0,76),('shin',76,144),('hock',144,212),('toe',212,338),('raised',338,376),('sickle',376,380),('pigment_crease',380,388)]:part(n+side,o+a,o+z)
for n,a,z in [('neck',1560,1666),('head',1666,1782),('rostrum',1782,1878),('jaw',1878,1954),('faceR',1954,2038),('faceL',2038,2122)]:part(n,a,z)
for side,o in [('R',2122),('L',2300)]:
 for n,a,z in [('shoulder',0,50),('forearm',50,94),('finger',94,178)]:part(n+side,o+a,o+z)
part('quills',2478,2562);part('feathers',2562,2634);part('pigment_flank',2634,2754)
assert sum(z-a for _,a,z in parts)==2754
names={g['nodes'][n]['name']:i for i,n in enumerate(g['skins'][0]['joints'])}
assert set(['handL','handR','forearmL','forearmR','thighL','thighR'])<=names.keys()
def weights(v,j,w,name):
 side=name[-1]
 if name.startswith(('finger','shoulder','forearm','toe','raised','sickle','hock','shin','thigh')) and side in 'LR':
  if name.startswith('finger'): pairs=[('hand'+side,1.)]
  elif name.startswith('shoulder'):
   t=np.clip((v[1]-.94)/.13,0,1)*.38;pairs=[('shoulder'+side,1-t),('thorax',t)]
  elif name.startswith('forearm'):
   t=np.clip((.88-v[1])/.10,0,1)*.18;pairs=[('forearm'+side,1-t),('hand'+side,t)]
  elif name.startswith('thigh'):
   t=np.clip((v[1]-.92)/.26,0,1)*.35;pairs=[('thigh'+side,1-t),('pelvis',t)]
  elif name.startswith('shin'):
   t=np.clip((v[1]-.48)/.18,0,1)*.4;pairs=[('shin'+side,1-t),('thigh'+side,t)]
  elif name.startswith('hock'):
   t=np.clip((v[1]-.13)/.10,0,1)*.35;pairs=[('foot'+side,1-t),('shin'+side,t)]
  else:pairs=[('foot'+side,1.)]
  jj=np.zeros(4,np.uint16);ww=np.zeros(4,np.float32)
  for i,(k,a) in enumerate(pairs):jj[i]=names[k];ww[i]=a
  return jj,ww
 return j.copy(),w.copy()
def reshape(v,name):
 x,y,z=map(float,v)
 # Restrained changes, keep joints and overall lengths; emphasize hindquarters and brow.
 if name in ('trunk','haunchL','haunchR','flankL','flankR'):
  t=math.exp(-((x+.40)/.27)**2); z*=1+.045*t
  y+=.016*t*max(0,(y-1)/.30)
 if name.startswith('thigh'):
  t=math.exp(-((y-.85)/.15)**2); z+=math.copysign(.012*t,z)
 if name=='head':
  t=math.exp(-((x-.74)/.13)**2);y+=.012*t*max(0,(y-1.30)/.20)
 return np.array([x,y,z],np.float32)
def mix(j,w):
 d={}
 for a,b0 in zip(j,w):
  for k,v in zip(a,b0):d[int(k)]=d.get(int(k),0)+float(v)/len(j)
 js=np.zeros(4,np.uint16);ws=np.zeros(4,np.float32)
 for i,(k,v) in enumerate(sorted(d.items(),key=lambda x:-x[1])[:4]):js[i]=k;ws[i]=v
 ws/=ws.sum();return js,ws
# Replace only purely chromatic shells (tail bands, flanks, tendon lines);
# retain physical feathers, brow, teeth and claws.
eligible=[]
for name,a,z in parts:
 if name.startswith(('trunk','tail','thigh','neck','shin')):
  for f in range(a,z):
   v=pos[f*3:f*3+3]; area=np.linalg.norm(np.cross(v[1]-v[0],v[2]-v[0]))
   eligible.append((float(area),f))
split=set(f for _,f in sorted(eligible,reverse=True)[:134])
faces=[]
def emit(v,j,w,c,name):
 if np.linalg.norm(np.cross(v[1]-v[0],v[2]-v[0]))<1e-10:raise ValueError('degenerate '+name)
 faces.append((np.array(v,np.float32),np.array(j,np.uint16),np.array(w,np.float32),np.array(c,np.float32),name))
for name,a,z in parts:
 if name.startswith('pigment'):continue
 if name.startswith('sickle'):
  # Original tetra order from claw(): first triangle base0,base1,tip, second base1,base2,tip.
  vv=pos[a*3:z*3];base=np.array([vv[0],vv[1],vv[4]]);tip=vv[2]
  center=base.mean(axis=0);mid=center+.56*(tip-center)+np.array([.024,.014,0])
  ring=mid+(base-center)*.55;points=np.vstack([base,ring,tip])
  fs=[(0,2,1)]
  for k in range(3):
   q=(k+1)%3;fs.extend([(k,q,k+3),(q,q+3,k+3),(k+3,q+3,6)])
  volume=sum(np.dot(points[i],np.cross(points[j],points[k])) for i,j,k in fs)
  if volume<0:fs=[(i,k,j) for i,j,k in fs]
  for f in fs:
   v=points[list(f)];jw=[weights(q,J[a*3],W[a*3],name) for q in v]
   emit(v,[q[0] for q in jw],[q[1] for q in jw],col[a*3:a*3+3,:3],name)
  continue
 for f in range(a,z):
  sl=slice(f*3,f*3+3);v=np.array([reshape(q,name) for q in pos[sl]])
  jw=[weights(q,j,w,name) for q,j,w in zip(v,J[sl],W[sl])]
  j=np.array([x[0] for x in jw]);w=np.array([x[1] for x in jw]);c=col[sl,:3].astype(float)
  if f in split:
   # Centroid subdivision adds no T-junctions on shell boundaries.
   mj,mw=mix(j,w)
   for k in range(3):
    q=(k+1)%3;emit([v[k],v[q],v.mean(0)],[j[k],j[q],mj],[w[k],w[q],mw],[c[k],c[q],c.mean(0)],name)
  else:emit(v,j,w,c,name)
assert len(faces)==2658,(len(faces),len(split))
# Triangle islands with padded edge pixels; anatomically continuous pigment computed
# from bind coordinates rather than extra geometry. Texture-only material.
SIZE=2048;CELL=32;GRID=64
atlas=np.zeros((SIZE,SIZE,3),np.uint8)
yy,xx=np.mgrid[0:CELL,0:CELL]
u=(xx+.5-3.5)/24;v=(yy+.5-3.5)/24
bary=np.stack([1-u-v,u,v],-1);bary=np.maximum(bary,0);bary/=bary.sum(axis=-1,keepdims=True)
P=[];N=[];JJ=[];WW=[];UV=[]
for i,(p0,j,w,c,name) in enumerate(faces):
 r=i//GRID;k=i%GRID
 points=bary@p0; x,y,z=np.moveaxis(points,-1,0);color=bary@c
 # Preserve original pigment palette, move markings onto actual body surface.
 if name in ('trunk','belly','haunchL','haunchR','flankL','flankR','tail','neck'):
  belly=np.clip((.94-y)/.19,0,1)
  if name!='tail':color=color*(1-.55*belly[...,None])+np.array([219,194,147])*.55*belly[...,None]
 if name=='tail':
  t=np.minimum.reduce([np.abs(x-a) for a in [-1.525,-1.304,-1.066,-.837]])
  band=np.clip((.062-t)/.018,0,1)
  color=color*(1-band[...,None])+np.array([65,47,37])*band[...,None]
 if name in ('trunk','haunchL','haunchR','flankL','flankR'):
  phase=x-.34*(y-1.08)
  t=np.minimum.reduce([np.abs(phase-a) for a in [-.48,-.31,-.14,.03,.20]])
  mask=np.clip((.035-t)/.014,0,1)*np.clip((np.abs(z)-.15)/.10,0,1)*np.clip((y-.91)/.09,0,1)
  color=color*(1-.82*mask[...,None])+np.array([71,49,35])*.82*mask[...,None]
 if name.startswith(('trunk','tail','thigh','shin','neck','head','rostrum','shoulder','forearm')):
  # Low contrast irregular dermal texture, no extra vertices.
  noise=np.sin(91*x+37*y+53*z)*np.sin(47*x-73*y+29*z)
  grain=np.sin(163*x+127*y)*np.sin(149*z-81*y)
  color*=1+(.042*noise+.022*grain)[...,None]
 atlas[r*CELL:(r+1)*CELL,k*CELL:(k+1)*CELL]=np.clip(color,0,255).astype(np.uint8)
 UV.extend([[(k*CELL+3.5)/SIZE,(r*CELL+3.5)/SIZE],[(k*CELL+27.5)/SIZE,(r*CELL+3.5)/SIZE],[(k*CELL+3.5)/SIZE,(r*CELL+27.5)/SIZE]])
 n=np.cross(p0[1]-p0[0],p0[2]-p0[0]);n/=np.linalg.norm(n)
 P.extend(p0);N.extend([n]*3);JJ.extend(j);WW.extend(w)
def append(data,target=None):
 data=bytes(data);b.extend(b'\0'*(-len(b)%4));offset=len(b);b.extend(data)
 view={'buffer':0,'byteOffset':offset,'byteLength':len(data)}
 if target:view['target']=target
 V.append(view);return len(V)-1
def acc(data,ct,kind,target,minmax=False):
 arr=np.ascontiguousarray(data);vi=append(arr.tobytes(),target)
 a={'bufferView':vi,'componentType':ct,'count':len(arr),'type':kind}
 if minmax:a.update(min=arr.min(0).tolist(),max=arr.max(0).tolist())
 A.append(a);return len(A)-1
P=np.array(P,dtype='<f4');N=np.array(N,dtype='<f4');JJ=np.array(JJ,dtype='<u2');WW=np.array(WW,dtype='<f4')
assert np.allclose(WW.sum(1),1,atol=1e-6) and JJ.max()<22
assert np.all(np.isfinite(P)) and np.allclose(np.linalg.norm(N,axis=1),1,atol=1e-5)
p['attributes']={'POSITION':acc(P,5126,'VEC3',34962,True),'NORMAL':acc(N,5126,'VEC3',34962),'TEXCOORD_0':acc(np.array(UV,dtype='<f4'),5126,'VEC2',34962),'JOINTS_0':acc(JJ,5123,'VEC4',34962),'WEIGHTS_0':acc(WW,5126,'VEC4',34962)}
p['indices']=acc(np.arange(len(P),dtype='<u4'),5125,'SCALAR',34963)
im=Image.fromarray(atlas);im.save(ROOT/'varrisco-v07-atlas.png')
s=io.BytesIO();im.save(s,format='PNG');iv=append(s.getvalue())
g['images']=[{'name':'Varrisco v07 pigment atlas','bufferView':iv,'mimeType':'image/png'}]
g['samplers']=[{'magFilter':9729,'minFilter':9729,'wrapS':33071,'wrapT':33071}]
g['textures']=[{'source':0,'sampler':0}]
g['materials'][0]={'name':'Varrisco_v07_UV_matte','doubleSided':False,'pbrMetallicRoughness':{'baseColorTexture':{'index':0},'metallicFactor':0,'roughnessFactor':.94}}
# Remove stale geometry accessors/views; retain all animation bytes untouched.
oldan=json.dumps(g['animations'],sort_keys=True)
used=set(p['attributes'].values())|{p['indices'],g['skins'][0]['inverseBindMatrices']}
for a in g['animations']:
 for s in a['samplers']:used.update((s['input'],s['output']))
ka=sorted(used);am={a:i for i,a in enumerate(ka)}
kv=sorted({A[i]['bufferView'] for i in ka}|{iv});vm={v:i for i,v in enumerate(kv)}
newb=bytearray();nv=[]
for v in kv:
 view=dict(V[v]);off=view.get('byteOffset',0);newb.extend(b'\0'*(-len(newb)%4));view['byteOffset']=len(newb);newb.extend(b[off:off+view['byteLength']]);nv.append(view)
g['accessors']=[dict(A[i],bufferView=vm[A[i]['bufferView']]) for i in ka];g['bufferViews']=nv
p['attributes']={k:am[v] for k,v in p['attributes'].items()};p['indices']=am[p['indices']]
g['skins'][0]['inverseBindMatrices']=am[g['skins'][0]['inverseBindMatrices']]
for a in g['animations']:
 for s in a['samplers']:s['input']=am[s['input']];s['output']=am[s['output']]
g['images'][0]['bufferView']=vm[iv]
g['asset']['generator']='Wildhaven Varrisco v07 UV and anatomy review candidate'
newb.extend(b'\0'*(-len(newb)%4));g['buffers'][0]['byteLength']=len(newb)
h=json.dumps(g,separators=(',',':')).encode();h+=b' '*(-len(h)%4)
out=b'glTF'+struct.pack('<II',2,28+len(h)+len(newb))+struct.pack('<I4s',len(h),b'JSON')+h+struct.pack('<I4s',len(newb),b'BIN\0')+newb
dest=ROOT/'varrisco-v07-candidate.glb';dest.write_bytes(out)
# Independently compare per-animation accessor payloads after remapping.
def extract(data):
 n=struct.unpack_from('<I',data,12)[0];d=json.loads(data[20:20+n]);bb=data[28+n:]
 def digest(i):
  a=d['accessors'][i];v=d['bufferViews'][a['bufferView']];start=v.get('byteOffset',0)+a.get('byteOffset',0)
  widths={'SCALAR':1,'VEC3':3,'VEC4':4};length=a['count']*widths[a['type']]*4
  return hashlib.sha256(bb[start:start+length]).hexdigest()
 return [(a['name'],[(digest(s['input']),digest(s['output']),s.get('interpolation')) for s in a['samplers']],a['channels'],a.get('extras')) for a in d['animations']]
assert extract(raw)==extract(out)
report={'species':'varrisco','stage':'geometry_texture_and_skin_candidate_awaiting_form_review','base_sha256':hashlib.sha256(raw).hexdigest(),'sha256':hashlib.sha256(out).hexdigest(),'bytes':len(out),'triangles_before':2754,'triangles_after':len(faces),'triangle_change_percent':round((len(faces)/2754-1)*100,2),'vertices':len(P),'joints':22,'animations_preserved_bitwise':49,'animation_revision':'not started; requires visual review of new form','pigment_faces_removed':376,'structural_centroid_splits':134,'sickle_faces_added':12,'texture':'2048x2048 embedded PNG, no COLOR_0','concept_image':'not retrieved; original approved species description and v01 source used; direct concept comparison pending','limitations':['separate anatomical shells retained','no terrain IK change','visual review pending','no alpha integration']}
(ROOT/'manifest.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
