#!/usr/bin/env python3
"""Validate Cavoru GLB LODs, rig, skin weights, and 27 animation clips for both ecotypes."""
from pathlib import Path
import struct,json,hashlib
import numpy as np
from jsonschema import validate as js_validate
import trimesh
D=Path(__file__).parent
expected_names={'idle','breathing','walk','trot','short_sprint','turn_left','turn_right','graze','sniff_ground','dig_shallow','pull_tuber','chew','drink','lookout','freeze','warning_call','regroup','flee_start','dodge','push_defense','dust_roll','groom','rest','sleep','hurt','death','juvenile_follow'}
results=[]
for variant,lod in [(v,l) for v in ['forest','plains'] for l in (0,1)]:
 path=D/f'cavoru_{variant}_{"LOD1_" if lod else ""}animated_v01.glb'
 raw=path.read_bytes();assert len(raw)>=32
 magic,version,length=struct.unpack_from('<4sII',raw)
 assert magic==b'glTF' and version==2 and length==len(raw)
 jlen,jtype=struct.unpack_from('<I4s',raw,12); assert jtype==b'JSON'
 data=json.loads(raw[20:20+jlen]);binpos=20+jlen
 blen,btype=struct.unpack_from('<I4s',raw,binpos);assert btype==b'BIN\0'
 payload=raw[binpos+8:binpos+8+blen]
 assert len(payload)==blen and data['buffers'][0]['byteLength']<=blen
 assert len(data['skins'])==1 and len(data['skins'][0]['joints'])==24
 assert len(data['animations'])==27
 names={a['name'] for a in data['animations']};assert names==expected_names, names^expected_names
 assert all(len(a['channels']) and len(a['samplers']) for a in data['animations'])
 def acc(n):
  a=data['accessors'][n];v=data['bufferViews'][a['bufferView']];ncomp={'SCALAR':1,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]
  dtype={5121:'u1',5123:'<u2',5125:'<u4',5126:'<f4'}[a['componentType']];off=v.get('byteOffset',0)+a.get('byteOffset',0)
  arr=np.frombuffer(payload,dtype=dtype,offset=off,count=a['count']*ncomp).reshape((a['count'],ncomp));return arr
 total=0;verts=0
 for prim in data['meshes'][0]['primitives']:
  attrs=prim['attributes'];assert all(x in attrs for x in ['POSITION','NORMAL','JOINTS_0','WEIGHTS_0'])
  pos=acc(attrs['POSITION']);total+=len(acc(prim['indices']))//3;verts+=len(pos)
  assert np.isfinite(pos).all() and np.isfinite(acc(attrs['NORMAL'])).all()
  assert np.max(acc(attrs['JOINTS_0'])) < 24
  assert np.allclose(acc(attrs['WEIGHTS_0']).sum(axis=1),1)
 for ani in data['animations']:
  for chan in ani['channels']:
   sampler=ani['samplers'][chan['sampler']];t=acc(sampler['input']).ravel();v=acc(sampler['output'])
   assert len(t)==len(v) and len(t)>=2 and abs(t[0])<.0001
   assert np.all(np.diff(t)>0) and np.isfinite(v).all()
   if chan['target']['path']=='rotation': assert np.allclose(np.linalg.norm(v,axis=1),1,atol=.001)
 try:
  s=trimesh.load(str(path),force='scene');assert len(s.geometry)>0
  imported=len(s.geometry)
 except Exception as e:raise RuntimeError(f'trimesh import failed for {path}: {e}')
 results.append({'variant':variant,'lod':lod,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),
    'joints':len(data['skins'][0]['joints']),'animations':len(names),'vertices':verts,'triangles':total,'importedMeshes':imported,'valid':True})
print(json.dumps(results,indent=2,ensure_ascii=False))
(D/'cavoru_validation.json').write_text(json.dumps(results,indent=2,ensure_ascii=False)+'\n')
