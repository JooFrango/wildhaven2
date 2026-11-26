#!/usr/bin/env python3
"""Validate exported Fulgaronte v02 GLB without trusting the generator's manifest."""
from pathlib import Path
import json, hashlib, struct
import trimesh,numpy as np
ROOT=Path(__file__).resolve().parent.parent
GLB=ROOT/'fulgaronte_v02_blockout_reconstruido.glb'
B=GLB.read_bytes()
assert len(B)>10000
magic,version,declared_size=struct.unpack('<4sII',B[:12])
assert magic==b'glTF' and version==2 and declared_size==len(B)
scene=trimesh.load(GLB,force='scene',process=False)
tri=sum(len(x.faces) for x in scene.geometry.values())
assert tri==3496,(tri,'triangles')
assert len(scene.geometry)==1
mesh=next(iter(scene.geometry.values()))
assert isinstance(mesh.visual,trimesh.visual.texture.TextureVisuals)
assert len(mesh.visual.uv)==len(mesh.vertices)
assert np.isfinite(mesh.vertices).all()
assert np.isfinite(mesh.visual.uv).all()
assert mesh.visual.material.baseColorTexture is not None
bbox=np.array(scene.bounds);dims=bbox[1]-bbox[0]
assert 15<=dims[0]<=17 and 5.4<=dims[1]<=6.4 and 4<=dims[2]<=6
man=json.loads((ROOT/'manifest.json').read_text())
assert man['sha256']==hashlib.sha256(B).hexdigest() and man['bytes']==len(B)
assert man['skins']==0 and man['clips']==0
for a in ['perfil','frente','tres_quartos']:
 assert (ROOT/'previews'/f'fulgaronte_v02_real_glb_{a}.png').exists()
print('VALIDADO', 'glTF',version,'triangles',tri,'meshes',len(scene.geometry),'size',len(B), 'sha256',man['sha256'],'dims',dims.round(3).tolist())
