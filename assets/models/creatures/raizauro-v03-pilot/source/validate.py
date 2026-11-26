#!/usr/bin/env python3
"""Validate actual generated GLB, not concept art or file-name assumptions."""
from pathlib import Path
import hashlib,json,struct
import numpy as np
import trimesh
ROOT=Path(__file__).resolve().parent.parent
GLB=ROOT/'raizauro-v03-anatomy-blockout.glb'
manifest=json.loads((ROOT/'manifest.json').read_text())
data=GLB.read_bytes()
assert data[:4]==b'glTF', 'Not a GLB'
assert struct.unpack_from('<I',data,4)[0]==2
assert struct.unpack_from('<I',data,8)[0]==len(data)
assert hashlib.sha256(data).hexdigest()==manifest['sha256']
assert len(data)==manifest['bytes']
loaded=trimesh.load(GLB,force='scene')
assert len(loaded.geometry)==1, f"Expected one mesh: {len(loaded.geometry)}"
mesh=next(iter(loaded.geometry.values()))
assert len(mesh.faces)==manifest['triangles']==4822
assert len(mesh.faces)>0 and len(mesh.vertices)>0
assert np.isfinite(mesh.vertices).all()
assert mesh.visual.kind=='vertex'
colors=mesh.visual.vertex_colors
assert len(colors)==len(mesh.vertices) and len(np.unique(colors[:,:3],axis=0))>12
assert len(mesh.faces)*3==len(mesh.vertices), 'flat shading requires separate vertices per face'
assert not manifest['animations'] and manifest['rig'].startswith('NOT YET')
span=mesh.bounds[1]-mesh.bounds[0]
assert (span > .1).all() and span[0]>span[1]
for a in ('three_quarter','side','front'):
 p=ROOT/'previews'/f'raizauro-v03-real-glb-{a}.png'
 assert p.exists() and p.read_bytes().startswith(b'\x89PNG\r\n\x1a\n') and p.stat().st_size>20000
print('PASS:',len(mesh.faces),'triangles; 1 real flat-shaded GLB mesh;',len(np.unique(colors[:,:3],axis=0)),'vertex colors; 3 real screenshots; SHA256 verified')