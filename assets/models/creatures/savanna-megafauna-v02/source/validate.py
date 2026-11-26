#!/usr/bin/env python3
"""Audit actual GLB binary files and manifests, all LODs and actual 3D preview PNGs."""
from __future__ import annotations
import argparse, json, hashlib, struct
from pathlib import Path
import numpy as np
from optimize import load_glb,read_accessor,source_stats
from generate_species import SPECS

ROOT=Path(__file__).resolve().parents[1]
EXPECTED={
 'torvardo':['idle','walk','trot','charge','graze','stomp','headbutt','alert','threat','rest','death','drink'],
 'raizauro':['idle','walk','crawl','dig','root_pull','chew','bask','tail_sweep','threat','alert','rest','death'],
 'mastelio':['idle','walk','trot','forage','pluck_fruit','curl_trunk','chew','drink','alert','defend','rest','death'],
 'garruva':['idle','walk','prowl','run','sniff','carcass_feed','tear_flesh','jaw_snap','threat','tail_sweep','rest','death','alert']}

def audit(root:Path):
 report={'status':'PASS','species':{},'trianglesLOD0Total':0,'totalGLBs':0,'totalClipsInLOD0':0}
 for sid in SPECS:
  folder=root/'models'/sid
  man=json.loads((folder/f'{sid}-manifest-v02.json').read_text())
  assert man['clipNames']==EXPECTED[sid],sid
  assert man['gameplayIntegrated'] is False
  d=[]
  for i in range(3):
   path=folder/f'{sid}-savanna-animated-v02-LOD{i}.glb'
   raw=path.read_bytes(); assert raw[:4]==b'glTF' and struct.unpack_from('<II',raw,4)==(2,len(raw))
   gltf,bin=load_glb(path)
   assert len(bin)==gltf['buffers'][0]['byteLength']
   assert gltf['asset']['version']=='2.0' and len(gltf['meshes'])>5
   assert len(gltf['skins'])==1
   assert len(gltf['skins'][0]['joints'])==(19 if sid=='mastelio' else 17)
   assert [c['name'] for c in gltf['animations']]==EXPECTED[sid]
   tris=sum(source_stats(gltf,bin))
   assert tris==man['lods'][i]['triangles']
   assert hashlib.sha256(raw).hexdigest()==man['lods'][i]['sha256']
   assert len(raw)==man['lods'][i]['bytes']
   assert all(any(p.get('mode',4)==4 for p in m['primitives']) for m in gltf['meshes'])
   for a in gltf['animations']:
    assert a['channels'] and a['samplers']
    for ch in a['channels']:
     assert ch['target']['node']<len(gltf['nodes']) and ch['sampler']<len(a['samplers'])
    for sampler in a['samplers']:
     assert len(read_accessor(gltf,bin,sampler['input']))>=12
     assert len(read_accessor(gltf,bin,sampler['output']))>=12
   found_weight=False
   for mesh in gltf['meshes']:
    for p in mesh['primitives']:
     a=p['attributes']
     if 'WEIGHTS_0' in a:
      vals=read_accessor(gltf,bin,a['WEIGHTS_0'])
      assert np.max(np.abs(vals.sum(axis=1)-1))<1e-3
      found_weight=True
   assert found_weight
   d.append(tris);report['totalGLBs']+=1
  assert d[0]>d[1]>d[2],(sid,d)
  for ang in ('side','front','three_quarter'):
   png=root/'previews'/f'{sid}-real-3d-{ang}-v02.png'
   assert png.is_file() and png.stat().st_size>20000
   assert png.read_bytes()[:8]==b'\x89PNG\r\n\x1a\n'
  report['species'][sid]={'lodTriangles':d,'skinJoints':man['skinJoints'],'clips':len(EXPECTED[sid]),
                         'sourceTriangles':man['sourceGeometryTriangles'],'previewCount':3}
  report['trianglesLOD0Total']+=d[0];report['totalClipsInLOD0']+=len(EXPECTED[sid])
 assert report['totalGLBs']==12 and report['totalClipsInLOD0']==49
 (root/'validation-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 return report
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--root',type=Path,default=ROOT);a=p.parse_args()
 print(json.dumps(audit(a.root),ensure_ascii=False,indent=2))