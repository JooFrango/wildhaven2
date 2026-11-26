#!/usr/bin/env python3
"""Independent export+reimport validation of Wildhaven desert herbivore blockouts."""
import argparse,hashlib,json,struct,os
from pathlib import Path
import numpy as np
from PIL import Image
import trimesh
ROOT=Path(__file__).resolve().parent.parent
OUTROOT=Path(os.environ.get('WILDHAVEN_MODELS_ROOT',str(ROOT)))


def validate(spec):
    root=(OUTROOT/spec/'v01') if os.environ.get('WILDHAVEN_MODELS_ROOT') else ROOT/spec
    manifest=json.loads((root/'manifest.json').read_text(encoding='utf-8'))
    glb=root/manifest['glb'];buf=glb.read_bytes()
    assert len(buf)==manifest['bytes'] and hashlib.sha256(buf).hexdigest()==manifest['sha256']
    assert buf[:4]==b'glTF' and struct.unpack_from('<I',buf,4)[0]==2 and struct.unpack_from('<I',buf,8)[0]==len(buf)
    chunk_length=struct.unpack_from('<I',buf,12)[0]
    doc=json.loads(buf[20:20+chunk_length]);assert not doc.get('animations') and not doc.get('skins')
    assert len(doc.get('materials',[]))==1 and len(doc.get('textures',[]))==1
    meshes=trimesh.load(glb,force='scene',process=False).geometry
    assert len(meshes)==1
    mesh=list(meshes.values())[0]
    assert len(mesh.faces)==manifest['triangle_count']
    assert np.isfinite(mesh.vertices).all()
    assert len(mesh.visual.uv)==len(mesh.vertices)
    assert mesh.visual.kind=='texture'
    image=mesh.visual.material.baseColorTexture.convert('RGB')
    painted=Image.open(root/manifest['paint_map']).convert('RGB')
    assert image.size==painted.size==tuple(manifest['uv_atlas_px'])
    assert np.array_equal(np.asarray(image),np.asarray(painted))
    assert manifest['skins']==manifest['animations']==manifest['joints']==0
    assert manifest['painted_markings_not_extra_polygons'] is True
    assert manifest['render_evidence_source_sha256']==manifest['sha256']
    for name,metadata in manifest['previews'].items():
        file=root/'previews'/name;dat=file.read_bytes()
        assert dat[:8]==b'\x89PNG\r\n\x1a\n' and len(dat)==metadata['bytes']
        assert hashlib.sha256(dat).hexdigest()==metadata['sha256']
        assert metadata['source_glb_sha256']==manifest['sha256']
    print('VALID',spec,'triangles',len(mesh.faces),'bytes',len(buf),'sha256',manifest['sha256'],'4 real previews',flush=True)

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--species',nargs='+',choices=['caudraco','lajurim','cornevio','fossario'],default=['caudraco','lajurim','cornevio','fossario']);a=p.parse_args()
    for species in a.species: validate(species)
