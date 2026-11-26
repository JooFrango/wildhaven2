#!/usr/bin/env python3
"""Validate actual exported GLB binaries, UVs, atlas, manifests and 3 live screenshots."""
import hashlib, json, struct
from pathlib import Path
import trimesh
from PIL import Image
BASE=Path(__file__).resolve().parent.parent
for sex in ('macho','femea'):
 for kind in ('selvagem','montaria'):
  ident=f'wyvern_{sex}_{kind}_v01'
  f=BASE/f'{ident}_blockout.glb'
  raw=f.read_bytes();assert raw[:4]==b'glTF' and struct.unpack_from('<I',raw,8)[0]==len(raw)
  jsonlen=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+jsonlen])
  assert doc['meshes'] and doc['materials'] and doc['textures'] and doc['images']
  assert not doc.get('skins') and not doc.get('animations')
  assert all('TEXCOORD_0' in prim['attributes'] for mesh in doc['meshes'] for prim in mesh['primitives'])
  geom=trimesh.load(str(f),force='scene');tris=sum(len(m.faces) for m in geom.geometry.values())
  m=json.loads((BASE/f'{ident}_manifest.json').read_text())
  assert tris==m['triangles'] and 3000<=tris<=8000
  assert len(raw)==m['bytes']
  assert hashlib.sha256(raw).hexdigest()==m['sha256']
  assert not m['joints'] and not m['skins'] and not m['animations']
  for view in ('perfil','frente','tres_quartos'):
   p=BASE/'previews'/f'{ident}_REAL_{view}.png'
   assert p.stat().st_size>100_000
   with Image.open(p) as im:im.verify()
  print(f'OK {ident}: {tris:,} tris, {len(raw):,} bytes, GLB import + texture + 3 renders')