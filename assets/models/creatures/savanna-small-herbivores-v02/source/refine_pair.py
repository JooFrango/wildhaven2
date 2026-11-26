#!/usr/bin/env python3
"""Wildhaven: Sevilho and Arbelio v02. Reuses exact v01 rig and clip contracts.
Rebuilds the v01 generator with flat, defined planes and species-specific ears,
head detail, and limb accents. Never replaces v01. No gameplay integration.
"""
from __future__ import annotations
import importlib.util
import json
import hashlib
from pathlib import Path
import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]  # assets/models/creatures
PREV = ROOT / 'savanna-small-herbivores-v01' / 'source' / 'generate.py'
spec = importlib.util.spec_from_file_location('wildhaven_fauna_v01', PREV)
v1 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(v1)

def planar_mesh(vertices, triangles, colors=None):
    """Expand indexed triangles for true split normals on all polygonal surfaces."""
    original_vertices = np.asarray(vertices, np.float32).reshape(-1,3)
    f = np.asarray(triangles, np.uint32).reshape(-1,3)
    raw = original_vertices[f]
    cr = np.cross(raw[:,1]-raw[:,0],raw[:,2]-raw[:,0])
    lens = np.linalg.norm(cr,axis=1)
    cr = cr/np.maximum(1e-8,lens)[:,None]
    normals = np.repeat(cr,3,axis=0).astype('<f4')
    vertex_colors = None
    if colors is not None:
        vertex_colors = np.asarray(colors,dtype='<f4')[f].reshape(-1,4)
    verts = raw.reshape(-1,3).astype('<f4')
    faces = np.arange(len(verts),dtype='<u4').reshape(-1,3)
    return verts,faces,normals,vertex_colors

v1.mesh=planar_mesh
orig_sphere=v1.sphere

def facet_ellipsoid(center,radii,rings=9,sides=15,colors=None):
    return orig_sphere(center,radii,min(6,rings),min(10,sides),colors)

v1.sphere=facet_ellipsoid
orig_loft=v1.loft

def firm_loft(rings,sides=20,palette=None,pattern=None,sidew=1.0):
    return orig_loft(rings,min(sides,14),palette,pattern,sidew)

v1.loft=firm_loft

def ear_solid(fig,side,scale=1.):
    """Asymmetric 3D ear blade with inset front and folded faceted contour."""
    base_z=side*.117
    z=side*.034
    a=np.asarray([
      [-.041,.092,base_z-z], [.060,.095,base_z-z],
      [-.060,.212,base_z-z], [.041,.273,base_z-z],
      [-.016,.392,base_z-z],
      [-.041,.092,base_z+z], [.060,.095,base_z+z],
      [-.060,.212,base_z+z], [.041,.273,base_z+z],
      [-.016,.392,base_z+z],
    ],float)
    a[:,:2] *= scale
    faces=[(0,1,3),(0,3,2),(2,3,4),(5,8,6),(5,7,8),(7,9,8)]
    edge=[0,1,3,4,2]
    for j in range(5):
        p,q=edge[j],edge[(j+1)%5]
        faces.extend([(p,q,q+5),(p,q+5,p+5)])
    fig.add(fig.head,'coat2',v1.mesh(a,faces))
    inner=np.asarray([[-.024,.132,base_z+side*.039],[.028,.142,base_z+side*.040],
          [.016,.245,base_z+side*.043],[-.024,.296,base_z+side*.043]],float)
    inner[:,:2] *= scale
    fig.add(fig.head,'pink',v1.mesh(inner,[(0,1,2),(0,2,3)]))

def ridge(fig, side, x, y, z, s, material='coat2'):
    pts=[(x,y,z),(x-.045*s,y+.06*s,z+side*.02*s),
         (x-.11*s,y+.022*s,z+side*.018*s),
         (x+.015*s,y-.009*s,z-side*.012*s)]
    fig.add(fig.body,material,v1.mesh(pts,[(0,1,2),(0,2,3)]))

def upgrade(fig):
    # V01 ear spheres give a soft toy shape; replace with deliberate organic planes.
    fig.meshes[fig.head][fig.mat['coat2']].clear()
    fig.meshes[fig.head][fig.mat['pink']].clear()
    for side in (-1,1):
        ear_solid(fig,side,1.06 if fig.id=='sevilho' else .82)
    if fig.id=='sevilho':
        # Preserve animated cheeks, seed-pouch function and brushy tail silhouette.
        for side in (-1,1):
            for i in range(3 if fig.lod==0 else 1):
                ridge(fig,side,-.22+i*.10,.565,side*.10,.75)
    else:
        # Preserve climber's elongated trunk, gripping digits, prehensile tail.
        for side in (-1,1):
            for x in ([-.29,-.18,.22] if fig.lod==0 else [-.22]):
                ridge(fig,side,x,.595,side*.11,.62,'coat2')
    return fig

def parse_glb(path):
    import struct
    raw=path.read_bytes()
    assert raw[:4]==b'glTF' and struct.unpack_from('<I',raw,8)[0]==len(raw)
    n=struct.unpack_from('<I',raw,12)[0]
    scene=json.loads(raw[20:20+n])
    assert len(scene.get('animations',[]))==11
    assert len(scene.get('meshes',[]))>=1
    assert len(scene.get('skins',[]))==0
    return scene

def main():
    for ident in ('sevilho','arbelio'):
        dest=ROOT/ident
        info={'id':ident,'version':'v02',
          'built_from':'wildhaven-small-savanna-herbivores-animated-v01',
          'art_status':'awaiting_user_model_approval','production':'exported',
          'integration':'not_integrated',
          'rig':'rigid animated glTF node hierarchy; 0 skins',
          'materials':'matte PBR, explicit faceted normals',
          'scale':'inherited uncalibrated v01 units',
          'notes':'11 legacy clips and node hierarchy preserved; no runtime IK',
          'lods':[]}
        for lod in (0,1,2):
            fig=upgrade(v1.Figure(ident,lod))
            path=dest/f'{ident}-savanna-faceted-v02-LOD{lod}.glb'
            stats=fig.export(path)
            gltf=parse_glb(path)
            assert set(stats['animationNames'])=={a['name'] for a in gltf['animations']}
            stats['sha256']=hashlib.sha256(path.read_bytes()).hexdigest()
            stats['sha256_verified_local']=True
            stats['rigJoints']=0
            stats['skins']=0
            stats['triangleMeasure']='sum of indexed primitive triangles, mesh definitions'
            stats['source']='assets/models/creatures/savanna-small-herbivores-v02/source/refine_pair.py'
            info['lods'].append(stats)
            print(ident,lod,stats['bytes'],stats['triangleCount'],len(gltf['animations']),flush=True)
        (dest/f'{ident}-manifest-v02.json').write_text(
            json.dumps(info,indent=2,ensure_ascii=False)+'\n',encoding='utf8')

if __name__=='__main__': main()
