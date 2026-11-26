#!/usr/bin/env python3
"""Independent, read-only checker for the concrete exported GLB files and UV atlases.
Optional renders checks when called after render.py. Zero claims about skinning/animation.
"""
import json,hashlib,struct
from pathlib import Path
from PIL import Image
import numpy as np
import trimesh
ROOT=Path(__file__).resolve().parent.parent
m=json.loads((ROOT/'manifest.json').read_text())
geom=[];count=0
for item in m['variants']:
 path=ROOT/item['glb'];raw=path.read_bytes()
 assert raw[:4]==b'glTF',path
 assert struct.unpack_from('<I',raw,8)[0]==len(raw)
 assert len(raw)==item['bytes'] and hashlib.sha256(raw).hexdigest()==item['sha256']
 l=struct.unpack_from('<I',raw,12)[0];gl=json.loads(raw[20:20+l]);assert len(gl['meshes'])==len(gl['materials'])==len(gl['textures'])==len(gl['images'])==1
 assert 'TEXCOORD_0' in gl['meshes'][0]['primitives'][0]['attributes']
 assert not gl.get('animations',[]) and not gl.get('skins',[])
 s=trimesh.load(path,force='scene',process=False)
 g=list(s.geometry.values());assert len(g)==1
 g=g[0];assert len(g.faces)==item['tris'] and len(g.vertices)==item['vertices']
 assert np.isfinite(g.vertices).all() and np.isfinite(g.visual.uv).all()
 assert np.max(g.visual.uv)<=1 and np.min(g.visual.uv)>=0
 geom.append((g.vertices,g.faces,g.visual.uv))
 tex=ROOT/item['texture_filename'];assert hashlib.sha256(tex.read_bytes()).hexdigest()==item['texture_sha256']
 assert Image.open(tex).size==(1024,1024)
 for view in ['three_quarter','side','front']:
  pic=ROOT/'previews'/f'escarvao_{item["variant"]}_real_glb_{view}.png'
  if pic.exists():
   with Image.open(pic) as img: assert img.size==(1050,830)
   assert pic.stat().st_size>50000
 print(item['variant'],'OK',len(raw),'bytes',len(g.faces),'tris',len(g.visual.uv),'UV coords')
 count+=1
for v,f,uv in geom[1:]:
 assert np.array_equal(v,geom[0][0]) and np.array_equal(f,geom[0][1]) and np.array_equal(uv,geom[0][2]), 'Variants must have identical geometry, only painted texture differs'
assert len({it['texture_sha256'] for it in m['variants']})==3
assert count==3
print('OK: three distinct UV textures, 1 mesh + 1 material each; identical anatomy; no rig/clips claimed')
