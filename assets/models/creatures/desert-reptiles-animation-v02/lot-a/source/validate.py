#!/usr/bin/env python3
"""Reimport and independently validate Wildhaven four desert reptile weighted GLBs."""
from __future__ import annotations
import argparse,hashlib,json,os,struct
from pathlib import Path
import numpy as np
from PIL import Image
import trimesh
from render import Reader,ROOT

def check(spec,require_previews=False):
 base=ROOT/spec/'v02';m=json.loads((base/'manifest.json').read_text());glb=base/m['glb']['path'];blob=glb.read_bytes()
 assert blob[:4]==b'glTF' and struct.unpack_from('<I',blob,8)[0]==len(blob)
 assert m['glb']['bytes']==len(blob) and m['glb']['sha256']==hashlib.sha256(blob).hexdigest()
 r=Reader(glb);old=ROOT.parent/'desert_reptiles_v01'/spec
 # Local layout differs in GH Actions; accept independent original source root.
 v01root=Path(os.environ.get('WILDHAVEN_CREATURE_ROOT',str(ROOT.parent/'desert_reptiles_v01')))/spec
 original=next(iter(trimesh.load(v01root/f'{spec}-v01-textured-blockout.glb',force='scene',process=False).geometry.values()))
 v01manifest=json.loads((v01root/'manifest.json').read_text())
 assert hashlib.sha256((v01root/f'{spec}-v01-textured-blockout.glb').read_bytes()).hexdigest()==m['v01_base']['sha256']==v01manifest['sha256']
 assert np.max(abs(r.xyz-original.vertices[original.faces.reshape(-1)])) < 5e-7
 assert np.max(abs(r.uv-original.visual.uv[original.faces.reshape(-1)])) < 1e-6
 assert np.array_equal(np.asarray(r.img),np.asarray(original.visual.material.baseColorTexture.convert('RGB')))
 assert len(r.faces)==v01manifest['triangle_count'] and r.njoints==26 and len(r.clips)==16
 assert r.obj['materials'][0]['pbrMetallicRoughness']['metallicFactor']==0
 assert np.max(abs(r.posed()-r.xyz))<5e-6
 assert all(np.isfinite(r.posed(c,.37*r.clips[c]['extras']['durationSeconds'])).all() for c in r.clips)
 active={}
 for c,v in r.clips.items():
  assert len(v['channels'])>=1 and len(v['samplers'])>=1
  d=v['extras']['durationSeconds']
  disps=[float(np.linalg.norm(r.posed(c,t*d/8)-r.xyz,axis=1).max()) for t in range(9)]
  disp=max(disps);assert disp>.004,(spec,c,disp)
  assert disp<1.,(spec,c,disp)
  active[c]=round(disp,5)
 assert all(n in r.clips for n in m['defense_specials'])
 if require_previews:
  assert m['glb_reimport_sha256']==r.sha
  assert m['animation_playback_validation']['reimport_sha256']==r.sha
  for filename,record in m['previews'].items():
   pic=base/'previews'/filename
   assert pic.is_file() and pic.stat().st_size==record['bytes']
   assert hashlib.sha256(pic.read_bytes()).hexdigest()==record['sha256']
  assert len(m['previews'])>=7, (spec,len(m['previews']))
  for clip in ('walk',*m['defense_specials']):assert (base/'previews'/f'{spec}-v02-{clip}-real-glb.gif').exists()
  for angle in ('profile','front','three-quarter'):assert (base/'previews'/f'{spec}-v02-real-glb-{angle}.png').exists()
 print('PASSED',spec,'bytes',len(blob),'SHA256',r.sha,'triangles',len(r.faces),'bones',r.njoints,'clips',len(r.clips),'special',m['defense_specials'],flush=True)
 return True

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--species',nargs='+',choices=['caudraco','lajurim','cornevio','fossario'],default=['caudraco','lajurim','cornevio','fossario']);p.add_argument('--require-previews',action='store_true');a=p.parse_args()
 for sp in a.species:check(sp,a.require_previews)
