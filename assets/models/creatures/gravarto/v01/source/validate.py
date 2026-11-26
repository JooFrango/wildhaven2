#!/usr/bin/env python3
"""Structural glTF/texture/metrics validation on the published binary GLB."""
import struct,json,hashlib
from pathlib import Path
import trimesh
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
f=ROOT/'gravarto-v01-anatomy-blockout.glb'
b=f.read_bytes()
assert b[:4]==b'glTF' and struct.unpack_from('<I',b,4)[0]==2
assert struct.unpack_from('<I',b,8)[0]==len(b)
sz,typ=struct.unpack_from('<I4s',b,12)
assert typ==b'JSON'
g=json.loads(b[20:20+sz]);assert len(g['meshes'])==1
assert len(g.get('textures',[]))>=1 and len(g.get('images',[]))>=1
assert len(g.get('materials',[]))==1
assert not g.get('skins',[]) and not g.get('animations',[])
assert any('TEXCOORD_0' in prim.get('attributes',{}) for mesh in g['meshes'] for prim in mesh['primitives'])
scene=trimesh.load(f,force='scene'); meshes=list(scene.geometry.values())
triangles=sum(len(mesh.faces) for mesh in meshes)
assert triangles>=4000 and triangles<=25000,triangles
assert len(meshes)==1,len(meshes)
m=meshes[0]
assert len(m.visual.uv)==len(m.vertices)
assert m.visual.material.baseColorTexture is not None
assert m.visual.material.baseColorTexture.size==(2048,2048)
assert m.bounds[0][1]>-.04,m.bounds
assert m.bounds[1][0]-m.bounds[0][0]>5.5,m.bounds
manifest=json.loads((ROOT/'manifest.json').read_text())
assert manifest['glb']['sha256']==hashlib.sha256(b).hexdigest()
assert manifest['glb']['bytes']==len(b)
assert manifest['geometry']['triangles_drawn']==triangles
assert manifest['paint']['markings_via_extra_polygons'] is False
assert (ROOT/'texture/gravarto-v01-albedo.png').is_file()
if (ROOT/'previews').exists():
  for name in ['profile','front','three-quarter']:
    p=ROOT/f'previews/gravarto-v01-real-glb-{name}.png'
    if p.exists():
      assert p.read_bytes().startswith(bytes.fromhex('89504e470d0a1a0a'))
      assert p.stat().st_size>100_000
      assert Image.open(p).size == (1480,1000)
print('OK: GLB reloaded, UV-albedo physically embedded, 1 mesh, 0 skins, 0 animations,',triangles,'triangles,',len(b),'bytes',hashlib.sha256(b).hexdigest())
