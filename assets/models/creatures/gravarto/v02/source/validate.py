#!/usr/bin/env python3
"""Independent structural/animation validation of the exported Gravarto v02 GLB."""
from pathlib import Path
import json,hashlib,sys
import numpy as np
from PIL import Image
from render_animated import Reader
ROOT=Path(__file__).resolve().parent.parent
m=json.loads((ROOT/'manifest.json').read_text())
r=Reader()
assert r.bytes[:4]==b'glTF'
assert len(r.bytes)==m['bytes'] and r.sha==m['sha256']
assert r.obj['asset']['version']=='2.0'
assert r.prim['attributes']['TEXCOORD_0']>=0
assert 'JOINTS_0' in r.prim['attributes'] and 'WEIGHTS_0' in r.prim['attributes']
assert len(r.faces)==4888 and len(r.pos)==14664
assert len(r.obj['skins'])==1 and len(r.obj['skins'][0]['joints'])==27
assert len(r.clips())==17
assert r.texture.size==(2048,2048)
assert np.max(np.abs(r.weights.sum(axis=1)-1))<1e-5
assert r.joints.max()<27
assert np.min(r.uv)>=-1e-4 and np.max(r.uv)<=1+1e-4
assert np.max(np.abs(r.posed(None,0)-r.pos))<3e-5
original=ROOT.parent/'v01'; original=original if original.exists() else ROOT.parent/'gravarto_v01'
src=Image.open(original/'texture'/'gravarto-v01-albedo.png').convert('RGBA')
assert np.array_equal(np.array(src),np.array(r.texture)), 'UV painting modified unexpectedly'
for name,clip in r.clips().items():
 d=float(clip['extras']['durationSeconds'])
 assert d>0 and clip['channels'] and clip['samplers']
 changed=[]
 for t in np.linspace(0,d,7):
  p=r.posed(name,float(t))
  assert np.isfinite(p).all(),name
  assert np.max(np.abs(p))<9,name
  changed.append(np.max(np.linalg.norm(p-r.pos,axis=1)))
 assert max(changed)>.01,name
print('PASS: original painted UV preserved, 4888 triangles, 27 weighted bones, 17 actual sampled GLB animations')
print('File sha256',r.sha,'bytes',len(r.bytes))
print('Render previews', [f.name for f in sorted((ROOT/'previews').glob('*.gif'))])
