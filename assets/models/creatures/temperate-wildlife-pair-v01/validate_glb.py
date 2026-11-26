#!/usr/bin/env python3
"""Structural, skin and animation validation of Carniroca/Tufrilo four real GLBs."""
import json,struct,hashlib
from pathlib import Path
import numpy as np
import trimesh
D=Path(__file__).resolve().parent
REPORT={}
for creature, clips, joints in [('carniroca',25,18),('tufrilo',25,20)]:
 for lod in (0,1):
  p=D/f'{creature}_{"LOD1_" if lod else ""}animated_v01.glb';raw=p.read_bytes()
  assert struct.unpack_from('<4sII',raw)==(b'glTF',2,len(raw)),str(p)
  js,typ=struct.unpack_from('<I4s',raw,12);assert typ==b'JSON'
  d=json.loads(raw[20:20+js]);off=20+js
  length,typ=struct.unpack_from('<I4s',raw,off);assert typ==b'BIN\0'
  payload=raw[off+8:off+8+length];assert len(payload)==length and d['buffers'][0]['byteLength']<=len(payload)
  assert len(d['skins'])==1 and len(d['skins'][0]['joints'])==joints
  assert len(d['animations'])==clips
  assert len(set(a['name'] for a in d['animations']))==clips
  def aget(idx):
   a=d['accessors'][idx];v=d['bufferViews'][a['bufferView']];num={'SCALAR':1,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']];dtype={5123:'<u2',5125:'<u4',5126:'<f4'}[a['componentType']]
   return np.frombuffer(payload,dtype=dtype,offset=v.get('byteOffset',0)+a.get('byteOffset',0),count=a['count']*num).reshape((a['count'],num))
  polys=0;vcounts=0
  for prim in d['meshes'][0]['primitives']:
   attrs=prim['attributes'];assert all(v in attrs for v in ['POSITION','NORMAL','JOINTS_0','WEIGHTS_0'])
   xyz=aget(attrs['POSITION']);normal=aget(attrs['NORMAL']);js=aget(attrs['JOINTS_0']);weights=aget(attrs['WEIGHTS_0']);indices=aget(prim['indices']).ravel()
   assert len(indices)%3==0 and np.max(indices)<len(xyz)
   assert np.all(np.isfinite(xyz)) and np.all(np.isfinite(normal))
   assert np.max(js)<joints and np.allclose(weights.sum(axis=1),1)
   polys+=len(indices)//3;vcounts+=len(xyz)
  for anim in d['animations']:
   assert anim['channels'] and anim['samplers'],anim['name']
   for channel in anim['channels']:
    sm=anim['samplers'][channel['sampler']];times=aget(sm['input']).ravel();values=aget(sm['output'])
    assert len(times)==len(values) and len(times)>1 and abs(times[0])<.001
    assert np.all(np.diff(times)>0) and np.all(np.isfinite(values))
    if channel['target']['path']=='rotation':assert np.max(np.abs(np.linalg.norm(values,axis=1)-1))<.01
  loaded=trimesh.load(str(p),force='scene',process=False)
  assert len(loaded.geometry)>0
  REPORT[p.name]={'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw),'triangles':polys,'vertices':vcounts,'joints':joints,'clips':[a['name'] for a in d['animations']],'trimesh_meshes':len(loaded.geometry),'validated':True}
  print(f'{p.name} PASS {polys} triangles {joints} joints {clips} clips',flush=True)
(D/'validation.json').write_text(json.dumps(REPORT,ensure_ascii=False,indent=2)+'\n')
