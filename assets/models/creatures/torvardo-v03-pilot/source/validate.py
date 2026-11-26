#!/usr/bin/env python3
"""Torvardo v03 reproducible blockout checks. No animation claims."""
from pathlib import Path
import json,hashlib,struct
import trimesh
ROOT=Path(__file__).resolve().parent.parent
path=ROOT/'torvardo-v03-anatomy-blockout.glb'
raw=path.read_bytes()
assert len(raw)>1000 and raw[:4]==b'glTF'
assert struct.unpack_from('<II',raw,4)==(2,len(raw))
size,typ=struct.unpack_from('<I4s',raw,12)
assert typ==b'JSON'
gltf=json.loads(raw[20:20+size])
assert gltf['asset']['version']=='2.0' and len(gltf['meshes'])==1
assert not gltf.get('animations') and not gltf.get('skins')
scene=trimesh.load(path,force='scene')
assert len(scene.geometry)==1
mesh=next(iter(scene.geometry.values()))
assert len(mesh.faces)==3910
assert mesh.visual.kind=='vertex'
manifest=json.loads((ROOT/'manifest.json').read_text())
assert manifest['sha256']==hashlib.sha256(raw).hexdigest()
assert manifest['triangles']==len(mesh.faces)
assert manifest['export_mesh_groups']==1
assert manifest['animations']==[]
for angle in ('side','front','three_quarter'):
    img=ROOT/'previews'/('torvardo-v03-real-glb-'+angle+'.png')
    assert img.read_bytes().startswith(b'\x89PNG\r\n\x1a\n')
    assert img.stat().st_size>50000
print('PASS: real GLB imported, one mesh, 3910 triangles, checksum and 3 rendered PNGs')