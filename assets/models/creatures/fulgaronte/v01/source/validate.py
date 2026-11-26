#!/usr/bin/env python3
"""Independent structural and dimensional inspection of exported Fulgaronte GLB."""
import struct,json,hashlib
from pathlib import Path
import trimesh
p=Path(__file__).resolve().parent.parent/'fulgaronte_v01_blockout.glb'
blob=p.read_bytes();assert blob[:4]==b'glTF';magic,version,length=struct.unpack_from('<4sII',blob,0)
assert version==2 and length==len(blob)
json_len,json_type=struct.unpack_from('<II',blob,12)
assert json_type==0x4E4F534A
gltf=json.loads(blob[20:20+json_len].decode('utf8'))
assert len(gltf.get('skins',[]))==0 and len(gltf.get('animations',[]))==0
assert gltf.get('images') and gltf.get('textures')
assert len(gltf.get('meshes',[]))==1
m=trimesh.load(p,force='scene',process=False)
meshes=list(m.geometry.values());triangles=sum(len(q.faces) for q in meshes)
assert triangles==3124,(triangles,'expected 3124')
assert meshes[0].visual.uv is not None
assert abs(meshes[0].bounds[1,1]-meshes[0].bounds[0,1]-5.1032156)<.02
assert abs(meshes[0].bounds[1,0]-meshes[0].bounds[0,0]-16.0)<.02
print('GLB VALIDADO',{'bytes':len(blob),'sha256':hashlib.sha256(blob).hexdigest(),'meshes':len(meshes),'triangles':triangles,'uv':True,'skins':0,'clips':0,'embedded_images':len(gltf['images'])})
