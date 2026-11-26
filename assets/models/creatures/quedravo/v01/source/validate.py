#!/usr/bin/env python3
"""Independent blockout GLB validator (real binary on disk)."""
from pathlib import Path
import numpy as np, trimesh, hashlib, json, struct
ROOT=Path(__file__).resolve().parent.parent
p=ROOT/'quedravo_v01_blockout.glb'; raw=p.read_bytes()
assert raw[:4]==b'glTF' and struct.unpack_from('<I',raw,8)[0]==len(raw)
scene=trimesh.load(p,force='scene',process=False)
tris=sum(len(g.faces) for g in scene.geometry.values())
assert tris>5000 and len(scene.geometry)<=15
assert len(scene.graph.nodes_geometry)==len(scene.geometry)
assert all(getattr(g.visual,'kind',None)=='texture' for g in scene.geometry.values())
assert all(len(g.visual.uv)==len(g.vertices) for g in scene.geometry.values())
assert all(np.isfinite(g.vertices).all() and np.isfinite(g.visual.uv).all() for g in scene.geometry.values())
assert all(g.visual.material.baseColorTexture is not None for g in scene.geometry.values())
a,b=scene.bounds
assert 10.5< (b[2]-a[2]) <12.5
assert 2.7<(b[1]-a[1])<4.8
# Embedded texture existence checked via glTF JSON, not loose PNG path.
import json as JS
json_size,json_type=struct.unpack_from('<I4s',raw,12)
assert json_type==b'JSON'
doc=JS.loads(raw[20:20+json_size].decode())
assert len(doc.get('images',[]))>=1 and all('bufferView' in im for im in doc['images'])
assert not doc.get('skins') and not doc.get('animations')
assert 'JOINTS_0' not in str(doc)
report={'validation':'passed','glb_bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),
        'glb_meshes':len(scene.geometry),'glb_triangles':tris,'glb_images':len(doc.get('images',[])),
        'skins':len(doc.get('skins',[])),'clips':len(doc.get('animations',[])),
        'bounds_min':np.round(a,5).tolist(),'bounds_max':np.round(b,5).tolist(),
        'standing_height_m':round(float(b[1]-a[1]),3),'span_m':round(float(b[2]-a[2]),3),
        'uv_texture_embedded':True,'reimport_library':'trimesh','external_preview_importer':'vtkGLTFImporter'}
(ROOT/'validation.json').write_text(JS.dumps(report,indent=2,ensure_ascii=False))
print(JS.dumps(report,indent=2,ensure_ascii=False))
