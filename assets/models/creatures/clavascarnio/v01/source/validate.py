#!/usr/bin/env python3
from pathlib import Path
import sys, json, hashlib, struct
import trimesh
r=Path(sys.argv[1] if len(sys.argv)>1 else Path(__file__).resolve().parents[1]);m=json.loads((r/'manifest.json').read_text())
blob=(r/m['asset']).read_bytes()
assert hashlib.sha256(blob).hexdigest()==m['sha256']
magic,version,size=struct.unpack_from('<4sII',blob,0)
assert (magic,version,size)==(b'glTF',2,len(blob))
jslen,_=struct.unpack_from('<I4s',blob,12)
meta=json.loads(blob[20:20+jslen])
assert len(meta.get('skins',[]))==len(meta.get('animations',[]))==0
assert len(meta['textures'])==1
assert all('TEXCOORD_0' in prim['attributes'] for mesh in meta['meshes'] for prim in mesh['primitives'])
scene=trimesh.load(r/m['asset'],force='scene',process=False)
assert sum(len(mesh.faces) for mesh in scene.geometry.values())==m['triangles_reimported']
assert len(scene.geometry)==m['meshes']
assert abs((scene.bounds[1]-scene.bounds[0])[1]-3.0)<1e-3
for view in ['perfil','frente','tres-quartos']:
    assert (r/'previews'/f'clavascarnio-v01-glb-real-{view}.png').is_file()
print('VALIDADO:',len(blob),'bytes,',m['sha256'],',',m['triangles_reimported'],'tris, UV incorporada, GLB reimportado')
