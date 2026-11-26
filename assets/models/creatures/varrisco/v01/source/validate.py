#!/usr/bin/env python3
"""Verify Varrisco v01 static export, checksums and GLB-import screenshot outputs."""
from __future__ import annotations
import hashlib,json,struct
from pathlib import Path
import trimesh
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
m=json.loads((ROOT/'manifest.json').read_text(encoding='utf8'))
glb=ROOT/m['glb']; b=glb.read_bytes()
assert b[:4]==b'glTF', 'Not a binary glTF file'
assert struct.unpack_from('<I',b,4)[0]==2,'Not GLB 2.0'
assert struct.unpack_from('<I',b,8)[0]==len(b),'GLB length mismatch'
json_length=struct.unpack_from('<I',b,12)[0]
assert b[16:20]==b'JSON', 'Missing JSON chunk'
header=json.loads(b[20:20+json_length]); assert not header.get('animations',[])
assert not header.get('skins',[])
assert len(b)==m['bytes']
sha=hashlib.sha256(b).hexdigest();assert sha==m['sha256']
assert m['rendered_glb_sha256']==sha
scene=trimesh.load(glb,force='scene',process=False)
tris=sum(len(g.faces) for g in scene.geometry.values())
assert tris==m['triangles_exported_reimported'],(tris,m['triangles_exported_reimported'])
assert len(scene.geometry)==m['mesh_definitions']
for view,rel in m['previews'].items():
 p=ROOT/rel; assert p.is_file(); dat=p.read_bytes()
 with Image.open(p) as im: assert im.size==(1500,1100) and im.mode in ('RGB','RGBA')
 assert hashlib.sha256(dat).hexdigest()==m['previews_sha256'][p.name]
 print(f'OK {view}: {len(dat)} bytes, image 1500x1100')
print(f'OK GLB {len(b)} bytes; SHA256 {sha}; {tris} reimported triangles; skins=0; animations=0')
