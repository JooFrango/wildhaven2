#!/usr/bin/env python3
"""Verifica que as duas peças são GLBs reais, texturizados, Head-local e sem rig."""
import json,hashlib,struct
from pathlib import Path
import numpy as np,trimesh
from generate_hairs import HEAD_REST_WORLD
ROOT=Path(__file__).resolve().parents[2]
for key in ['short','mohawk']:
    folder=ROOT/'hair'/f'{key}-v01';model=f'hair_{key}_v01.glb'
    b=(folder/model).read_bytes();m=json.loads((folder/'manifest.json').read_text())
    assert hashlib.sha256(b).hexdigest()==m['sha256']
    assert len(b)==m['bytes']
    assert b[:4]==b'glTF' and struct.unpack_from('<I',b,4)[0]==2
    size=struct.unpack_from('<I',b,12)[0];g=json.loads(b[20:20+size])
    assert g.get('animations') is None
    assert len(g['meshes'])==1 and len(g['materials'])==1 and len(g['images'])==1
    assert 'TEXCOORD_0' in g['meshes'][0]['primitives'][0]['attributes']
    mesh=trimesh.load(folder/model,force='mesh',process=False)
    assert len(mesh.faces)==m['triangles'] and len(mesh.vertices)==m['verticesExported']
    assert mesh.visual.material.baseColorTexture is not None
    world=np.c_[mesh.vertices,np.ones(len(mesh.vertices))]@HEAD_REST_WORLD.T
    assert 1.55 < world[:,1].min() < 1.75 and world[:,1].max() < 1.85
    print('VALIDADO',model,len(mesh.vertices),'verts',len(mesh.faces),'tris')
