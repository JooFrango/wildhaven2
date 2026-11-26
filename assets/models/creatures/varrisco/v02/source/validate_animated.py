#!/usr/bin/env python3
"""Validate actual finished exported Varrisco GLB, glTF skin/clips and previews."""
from __future__ import annotations
import json,struct,hashlib,sys
from pathlib import Path
import numpy as np
import vtk
from vtk.util.numpy_support import vtk_to_numpy
root=Path(__file__).resolve().parents[1]
p=root/'varrisco-animated-v02-LOD0.glb'
b=p.read_bytes();assert b[:4]==b'glTF' and struct.unpack_from('<II',b,4)==(2,len(b))
n=struct.unpack_from('<I',b,12)[0];g=json.loads(b[20:20+n]); v=g['meshes'][0]['primitives'][0]
assert len(g.get('skins',[]))==1 and len(g['skins'][0]['joints'])==24
assert len(g.get('animations',[]))==17
assert len({a['name'] for a in g['animations']})==17
assert {'JOINTS_0','WEIGHTS_0','POSITION','NORMAL','COLOR_0'}<=set(v['attributes'])
assert g['accessors'][v['indices']]['count']//3==4110
assert all(len(a['channels'])>0 for a in g['animations'])
assert all(g['accessors'][s['inverseBindMatrices']]['count']==24 for s in g['skins'])
reader=vtk.vtkGLTFReader(); reader.SetFileName(str(p));reader.SetFrameRate(24)
reader.SetApplyDeformationsToGeometry(True);reader.UpdateInformation()
assert reader.GetNumberOfAnimations()==17
def mesh(o):
 if isinstance(o,vtk.vtkPolyData):return o
 if isinstance(o,vtk.vtkMultiBlockDataSet):
  for i in range(o.GetNumberOfBlocks()):
   b=o.GetBlock(i)
   if b is not None:
    q=mesh(b)
    if q is not None:return q
 return None
reader.EnableAnimation(2) # run
reader.UpdateTimeStep(.1);p1=vtk_to_numpy(mesh(reader.GetOutputDataObject(0)).GetPoints().GetData()).copy()
reader.UpdateTimeStep(.31);p2=vtk_to_numpy(mesh(reader.GetOutputDataObject(0)).GetPoints().GetData()).copy()
change=float(np.linalg.norm(p1-p2,axis=1).mean())
assert change>.005,change
pre=root/'previews'
for name in ['varrisco-v02-real-glb-profile.png','varrisco-v02-real-glb-front.png','varrisco-v02-real-glb-three-quarter.png',
             'varrisco-v02-run-real-glb.gif','varrisco-v02-bite-real-glb.gif','varrisco-v02-pounce-real-glb.gif']:
 file=pre/name;data=file.read_bytes();assert len(data)>80000,name
 assert data.startswith(b'\x89PNG') or data.startswith(b'GIF8'),name
 m=json.loads((root/'manifest.json').read_text())
 assert m['realGltfPreviews'][name]['sha256']==hashlib.sha256(data).hexdigest(),name
assert m['files'][0]['sha256']==hashlib.sha256(b).hexdigest()
print('PASS: GLB bytes',len(b),'24 joints 17 clips 4110 triangles; animated vertex displacement',change)
