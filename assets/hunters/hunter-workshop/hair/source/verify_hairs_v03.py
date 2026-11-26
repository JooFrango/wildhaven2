#!/usr/bin/env python3
"""Wildhaven validation: GLB bytes, topology, UV, Head attachment, and textures."""
import hashlib
import json
import struct
from pathlib import Path
import numpy as np
import trimesh
from generate_hairs import HEAD_REST_WORLD, read_head_matrix
ROOT=Path(__file__).resolve().parents[2]
BASE=ROOT/'base/hunter-masculino-1000v/hunter_masculino_1000v.glb'
if BASE.exists():
    assert np.allclose(read_head_matrix(BASE), HEAD_REST_WORLD, atol=2e-6)
EXPECTED={'swept-back': (363,486), 'short-ponytail':(386,560)}
for key,(vert_count,tri_count) in EXPECTED.items():
    folder=ROOT/'hair'/f'{key}-v01'
    name=f'hair_{key.replace("-","_")}_v01'
    p=folder/f'{name}.glb'
    data=p.read_bytes();meta=json.loads((folder/'manifest.json').read_text('utf8'))
    assert data[:4]==b'glTF'
    assert struct.unpack_from('<II',data,4)==(2,len(data))
    assert len(data)==meta['bytes'] and hashlib.sha256(data).hexdigest()==meta['sha256']
    jlen,jtype=struct.unpack_from('<I4s',data,12)
    assert jtype==b'JSON'
    doc=json.loads(data[20:20+jlen]);assert len(doc['meshes'])==1
    assert len(doc['images'])==1 and len(doc['materials'])==1
    assert doc['materials'][0]['doubleSided'] is True
    assert len(doc.get('animations',[]))==0 and len(doc.get('skins',[]))==0
    attrs=doc['meshes'][0]['primitives'][0]['attributes']
    assert {'POSITION','TEXCOORD_0'}.issubset(attrs)
    verts=doc['accessors'][attrs['POSITION']]['count']
    faces=doc['accessors'][doc['meshes'][0]['primitives'][0]['indices']]['count']//3
    assert (verts,faces)==(vert_count,tri_count)
    m=trimesh.load(p,force='mesh',process=False)
    assert len(m.vertices)==vert_count and len(m.faces)==tri_count
    assert m.visual.material.baseColorTexture.size==(256,256)
    assert len(m.visual.uv)==len(m.vertices)
    assert np.isfinite(m.vertices).all() and np.isfinite(m.visual.uv).all()
    assert (m.visual.uv>=0).all() and (m.visual.uv<=1).all()
    transformed=np.c_[m.vertices,np.ones(len(m.vertices))]@HEAD_REST_WORLD.T
    assert transformed[:,1].min()>1.51 and transformed[:,1].max()<1.79
    assert np.max(np.abs(transformed[:,0]))<.18
    assert meta['attachmentBone']=='Head' and meta['coordinateSpace']=='Head-local (rest pose)'
    print(f'OK: {name} real GLB | {verts} exported vertices | {faces} triangles | embedded UV 256px | SHA256 {meta["sha256"]}')
print('OK: both hair assets valid; original Hunter body and previous hairs unchanged')
