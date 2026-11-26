#!/usr/bin/env python3
"""Validate exported Mastélio GLB geometry and genuine prints (no artistic claims)."""
from pathlib import Path
import hashlib, json, struct
import numpy as np
import trimesh

ROOT=Path(__file__).resolve().parent.parent
DOC=json.loads((ROOT/'manifest.json').read_text(encoding='utf-8'))
GLB=ROOT/DOC['glb']
raw=GLB.read_bytes()
assert len(raw)>=20 and raw[:4]==b'glTF', 'GLB magic mismatch'
version,length=struct.unpack_from('<II',raw,4)
assert version==2 and length==len(raw), 'GLB header mismatch'
assert DOC['bytes']==len(raw)
assert DOC['sha256']==hashlib.sha256(raw).hexdigest()
chunk_length,kind=struct.unpack_from('<I4s',raw,12)
assert kind==b'JSON' and chunk_length%4==0
model=json.loads(raw[20:20+chunk_length])
assert model['asset']['version']=='2.0'
assert model.get('animations') in (None, []), 'Blockout cannot contain legacy animation clips'
assert model.get('skins') in (None, []), 'Blockout intentionally has no rig'
loaded=trimesh.load(GLB,force='scene')
assert len(loaded.geometry)==1, f'Expected one unified mesh, got {len(loaded.geometry)}'
mesh=next(iter(loaded.geometry.values()))
assert len(mesh.faces)==DOC['triangles'] and len(mesh.faces)>2500
assert len(mesh.vertices)==len(mesh.faces)*3, 'Flat facets must have independent triangle vertices'
assert np.isfinite(mesh.vertices).all()
assert mesh.visual.kind=='vertex'
colors=np.unique(mesh.visual.vertex_colors[:,:3],axis=0)
assert len(colors)>20, 'Face color gradations missing'
span=mesh.bounds[1]-mesh.bounds[0]
assert (span>.1).all() and span[0]>span[1]
assert mesh.bounds[0][1]>-.08, 'Feet must touch ground within scale tolerance'
for angle in ('side','front','three_quarter'):
 file=ROOT/'previews'/f'mastelio-v03-real-glb-{angle}.png'
 assert file.is_file() and file.stat().st_size>20000
 assert file.read_bytes().startswith(b'\x89PNG\r\n\x1a\n')
print(json.dumps({'status':'passed','meshGroups':len(loaded.geometry),'triangles':len(mesh.faces),
                  'colors':len(colors),'previewCount':3,'sha256':DOC['sha256'],
                  'animations':0,'rigged':False},indent=2))