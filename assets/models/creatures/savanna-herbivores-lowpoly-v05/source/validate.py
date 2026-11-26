#!/usr/bin/env python3
"""Validate GLB, clips, rig, hashes, LOD ordering, real raster screenshots."""
from __future__ import annotations
import argparse, json, hashlib, sys
from pathlib import Path
import numpy as np
from PIL import Image
from optimize import load_glb,source_stats,read_accessor
from build_all import TARGETS

def verify(root:Path):
 report={'models':[],'errors':[]}
 for id in TARGETS:
  folder=root/'assets/models/creatures'/id
  m=json.loads((folder/f'{id}-lowpoly-manifest-v05.json').read_text())
  variant='v05' if id=='talvero' else 'v03'
  assert len(m['lods'])==3
  prev_faces=10**9
  prev_bytes=10**9
  joint_names=None
  anim_names=None
  for i,r in enumerate(m['lods']):
    path=folder/f'{id}-savanna-animated-{variant}-LOD{i}.glb'
    raw=path.read_bytes()
    doc,bb=load_glb(path)
    faces=sum(source_stats(doc,bb))
    assert len(raw)==r['bytes'] and faces==r['triangles'], (path,faces,r['triangles'])
    assert hashlib.sha256(raw).hexdigest()==r['sha256'],path
    assert faces<prev_faces and len(raw)<prev_bytes, (id, i,faces)
    prev_faces,prev_bytes=faces,len(raw)
    assert doc['skins'] and len(doc['skins'][0]['joints'])==17
    clips=[a['name'] for a in doc['animations']]
    assert len(clips)==(10 if id=='talvero' else 11),clips
    assert all(len(a['channels'])>=17 for a in doc['animations'])
    assert len(set(clips))==len(clips)
    if joint_names is None:joint_names=[doc['nodes'][j]['name'] for j in doc['skins'][0]['joints']];anim_names=clips
    else:assert [doc['nodes'][j]['name'] for j in doc['skins'][0]['joints']]==joint_names and clips==anim_names
    for mesh in doc['meshes']:
     for primitive in mesh['primitives']:
       attrs=primitive['attributes'];verts=read_accessor(doc,bb,attrs['POSITION'])
       faces2=read_accessor(doc,bb,primitive['indices']).reshape(-1,3)
       assert len(verts)>0 and len(faces2)>0
       assert int(faces2.max())<len(verts)
       if 'JOINTS_0' in attrs:
        joints=read_accessor(doc,bb,attrs['JOINTS_0'])
        weights=read_accessor(doc,bb,attrs['WEIGHTS_0'])
        assert int(joints.max())<17 and np.max(abs(weights.sum(axis=1)-1))<1e-4
    report['models'].append({'species':id,'lod':i,'triangles':faces,'bytes':len(raw),'sha256':r['sha256'],'clips':len(clips),'joints':17})
  for angle in ('side','front','three_quarter'):
    img=folder/f'{id}-real-3d-{angle}-lowpoly-v05.png'
    assert img.read_bytes().startswith(b'\x89PNG\r\n\x1a\n') and img.stat().st_size>20000
    im=Image.open(img); assert im.width>=1000 and im.height>=800
 print('PASS: four species, 12 real GLBs, 43 total animation clips across species, 12 actual PNG captures')
 print(json.dumps(report,ensure_ascii=False,indent=2))
 return report

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);a=p.parse_args()
 verify(a.root.resolve())