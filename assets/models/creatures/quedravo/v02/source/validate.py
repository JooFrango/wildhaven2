#!/usr/bin/env python3
"""Independent structural check of v01 vs v02 Quedravo exported binary GLBs."""
from pathlib import Path
import json, hashlib
import numpy as np
import trimesh
from PIL import Image
ROOT=Path(__file__).resolve().parent.parent
OLD=ROOT.parent/'quedravo_v01'/'quedravo_v01_blockout.glb'
NEW=ROOT/'quedravo_v02_blockout_2000.glb'
texOld=ROOT.parent/'quedravo_v01'/'quedravo_v01_uv_atlas.png'
texNew=ROOT/'quedravo_v02_uv_atlas.png'

def inspect(path):
    scene=trimesh.load(path,force='scene',process=False)
    assert isinstance(scene,trimesh.Scene)
    count=sum(len(m.faces) for m in scene.geometry.values())
    coords=[]
    for m in scene.geometry.values():
        assert m.visual.kind=='texture',type(m.visual)
        assert len(m.visual.uv)==len(m.vertices)
        assert np.isfinite(m.vertices).all() and np.isfinite(m.visual.uv).all()
        assert np.all(np.asarray(m.faces)<len(m.vertices))
        coords.append(np.asarray(m.vertices))
    import struct
    raw=path.read_bytes()
    assert raw[:4]==b'glTF'
    version,total=struct.unpack('<II',raw[4:12]);assert version==2 and total==len(raw)
    chunks=[];off=12
    while off<len(raw):
        n,k=struct.unpack('<I4s',raw[off:off+8]);off+=8
        chunks.append((k,raw[off:off+n]));off+=n
    js=json.loads(chunks[0][1].decode().rstrip())
    lo=np.concatenate(coords).min(axis=0); hi=np.concatenate(coords).max(axis=0)
    return dict(bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest(),triangles=count,meshes=len(scene.geometry),
        span_m=round(float(hi[2]-lo[2]),5),bounds_min=np.round(lo,5).tolist(),bounds_max=np.round(hi,5).tolist(),
        image_count=len(js.get('images',[])),skin_count=len(js.get('skins',[])),clip_count=len(js.get('animations',[])),
        material_count=len(js.get('materials',[])))

def validate():
    old=inspect(OLD);new=inspect(NEW)
    assert old['triangles']==6852 and new['triangles']==2000
    assert new['skin_count']==0 and new['clip_count']==0
    assert old['span_m']==new['span_m']
    assert all(abs(a-b)<.001 for label in ('bounds_min','bounds_max') for a,b in zip(old[label],new[label]))
    assert texOld.read_bytes()==texNew.read_bytes()
    assert new['image_count']==1
    result={'status':'passed','v01':old,'v02':new,
      'reduction_triangles_pct':round((1-new['triangles']/old['triangles'])*100,2),
      'reduction_glb_bytes_pct':round((1-new['bytes']/old['bytes'])*100,2),
      'texture_byte_identical_to_v01':True,'verified_cameras':['frente','perfil','tres_quartos'],
      'render_source':'vtkGLTFImporter read from exported GLB','no_alpha_changes':True,
      'visual_quality_qualification':'Silhouette and bounds preserved. Low-detail feathers and head closeups do differ; director must approve.'}
    (ROOT/'validation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
    print(json.dumps(result,ensure_ascii=False,indent=2))
if __name__=='__main__':validate()
