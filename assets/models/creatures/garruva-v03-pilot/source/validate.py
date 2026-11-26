#!/usr/bin/env python3
"""Validate genuine Garruva v03 binary GLB and its 3 screenshots (not artistic approval)."""
from pathlib import Path
import hashlib, json, struct
import numpy as np
import trimesh

ROOT=Path(__file__).resolve().parent.parent
manifest=json.loads((ROOT/'manifest.json').read_text(encoding='utf-8'))
p=ROOT/manifest['glb']; data=p.read_bytes()
assert len(data)>1000 and data[:4]==b'glTF', 'Invalid GLB header'
version,declared_length=struct.unpack_from('<II',data,4)
assert version==2 and declared_length==len(data), 'Invalid glTF 2 header or byte count'
jlength,typ=struct.unpack_from('<I4s',data,12)
assert typ==b'JSON' and jlength%4==0
payload=json.loads(data[20:20+jlength])
assert payload['asset']['version']=='2.0'
assert not payload.get('animations'), 'Approval blockout must not pretend to have animation'
assert not payload.get('skins'), 'Approval blockout must not pretend to have rig'
assert manifest['sha256']==hashlib.sha256(data).hexdigest()
assert manifest['bytes']==len(data)
model=trimesh.load(p,force='scene')
assert len(model.geometry)==1, 'Expected one render mesh'
mesh=next(iter(model.geometry.values()))
assert len(mesh.faces)==manifest['triangles'] and 3500<len(mesh.faces)<8000
assert len(mesh.vertices)==3*len(mesh.faces), 'Flat facets should have separate normals'
assert np.isfinite(mesh.vertices).all(), 'Invalid positions'
assert mesh.visual.kind=='vertex', 'Missing face colors'
assert len(np.unique(mesh.visual.vertex_colors[:,:3],axis=0))>=18
bounds=mesh.bounds
assert bounds[1][0]-bounds[0][0]>3.5
assert bounds[0][1]>-.1
for angle in ['side','front','three_quarter']:
 image=ROOT/'previews'/f'garruva-v03-real-glb-{angle}.png'
 assert image.stat().st_size>20000
 assert image.read_bytes()[:8]==b'\x89PNG\r\n\x1a\n'
print(json.dumps({'result':'pass','triangles':len(mesh.faces),'groups':len(model.geometry),'bytes':len(data),
 'animations':0,'skinning':False,'sha256':manifest['sha256'],'previews':3},indent=2))