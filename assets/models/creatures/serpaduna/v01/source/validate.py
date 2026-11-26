#!/usr/bin/env python3
from pathlib import Path
import hashlib, json, struct
import trimesh
ROOT=Path(__file__).resolve().parent.parent
meta=json.loads((ROOT/'manifest.json').read_text())
p=ROOT/meta['real_glb']
b=p.read_bytes()
assert b[:4]==b'glTF', 'not a binary glTF GLB'
assert struct.unpack_from('<I',b,8)[0]==len(b), 'GLB length header mismatch'
assert hashlib.sha256(b).hexdigest()==meta['sha256']
assert len(b)==meta['bytes']
s=trimesh.load(p,force='scene')
assert len(s.geometry)==meta['mesh_count']
assert sum(len(m.faces) for m in s.geometry.values())==meta['triangles_exported_mesh_definitions']
assert 'BodyContinuousUV' in s.geometry
assert hasattr(s.geometry['BodyContinuousUV'].visual,'uv')
assert len(s.geometry['BodyContinuousUV'].visual.uv)>1000
assert s.bounds[1,2]>2.0
print('PASS: bytes/header/SHA-256/reimport/textured continuous body/tris/geometry bounds')
print('SHA-256',meta['sha256'])
