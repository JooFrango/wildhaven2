#!/usr/bin/env python3
"""Real VTK raster previews from an exported GLB, never concept synthesis."""
from __future__ import annotations
import sys, pathlib, json
import numpy as np
from vtk.util.numpy_support import numpy_to_vtk, numpy_to_vtkIdTypeArray
import vtk
from optimize import load_glb, read_accessor

def render(path,output,angle='three_quarter',width=1100,height=840):
    d,b=load_glb(path)
    parent={}
    for i,node in enumerate(d['nodes']):
      for c in node.get('children',[]):parent[c]=i
    world={}
    def pos(i):
       if i not in world:
        p=np.array(d['nodes'][i].get('translation',[0,0,0]),float)
        world[i]=p+(pos(parent[i]) if i in parent else 0)
       return world[i]
    ren=vtk.vtkRenderer();ren.SetBackground(.82,.85,.86);ren.SetBackground2(.955,.956,.939);ren.GradientBackgroundOn()
    win=vtk.vtkRenderWindow();win.SetOffScreenRendering(1);win.SetSize(width,height);win.AddRenderer(ren)
    mins=np.array([np.inf]*3);maxs=-mins
    def draw(v,f,c):
       nonlocal mins,maxs
       mins=np.minimum(mins,v.min(axis=0));maxs=np.maximum(maxs,v.max(axis=0))
       poly=vtk.vtkPolyData()
       pp=vtk.vtkPoints();pp.SetData(numpy_to_vtk(np.ascontiguousarray(v,dtype=np.float32),deep=True));poly.SetPoints(pp)
       arr=np.column_stack((np.full(len(f),3,dtype=np.int64),f.astype(np.int64)))
       cell=vtk.vtkCellArray();cell.SetCells(len(f),numpy_to_vtkIdTypeArray(np.ascontiguousarray(arr).reshape(-1),deep=True));poly.SetPolys(cell)
       cv=numpy_to_vtk(np.ascontiguousarray(c,dtype=np.uint8),deep=True,array_type=vtk.VTK_UNSIGNED_CHAR)
       cv.SetNumberOfComponents(3);poly.GetPointData().SetScalars(cv)
       norm=vtk.vtkPolyDataNormals();norm.SetInputData(poly);norm.SplittingOn();norm.SetFeatureAngle(52);norm.ConsistencyOn()
       mapper=vtk.vtkPolyDataMapper();mapper.SetInputConnection(norm.GetOutputPort());mapper.ScalarVisibilityOn()
       actor=vtk.vtkActor();actor.SetMapper(mapper)
       actor.GetProperty().SetAmbient(.28);actor.GetProperty().SetDiffuse(.78);actor.GetProperty().SetSpecular(.02)
       ren.AddActor(actor)
    for ni,node in enumerate(d['nodes']):
      if 'mesh' not in node:continue
      for primitive in d['meshes'][node['mesh']]['primitives']:
       attrs=primitive['attributes']
       vv=read_accessor(d,b,attrs['POSITION']).reshape(-1,3).astype(np.float32)
       if not 'skin' in node:vv=vv+pos(ni)
       ff=read_accessor(d,b,primitive['indices']).reshape(-1,3)
       if 'COLOR_0' in attrs:
        cols=read_accessor(d,b,attrs['COLOR_0'])
        if cols.dtype==np.uint8:pass
        else:cols=np.clip(cols*255,0,255).astype(np.uint8)
       else:
        mat=d['materials'][primitive['material']]['pbrMetallicRoughness']['baseColorFactor'][:3]
        cols=np.tile(np.round(np.array(mat)*255).astype(np.uint8),(len(vv),1))
       draw(vv,ff,cols)
    # Clean studio background. Do not add fake ground geometry to the creature screenshot.
    key=vtk.vtkLight();key.SetPosition(5,9,11);key.SetFocalPoint(0,1,0);key.SetIntensity(1.15);ren.AddLight(key)
    rim=vtk.vtkLight();rim.SetPosition(-8,5,-9);rim.SetFocalPoint(0,1,0);rim.SetIntensity(.68);ren.AddLight(rim)
    cam=ren.GetActiveCamera();center=(mins+maxs)*.5
    ext=max(maxs-mins)
    if angle=='side':cam.SetPosition(center[0],center[1]+ext*.38,center[2]+ext*2.5)
    elif angle=='front':cam.SetPosition(center[0]+ext*2.5,center[1]+ext*.21,center[2])
    else:cam.SetPosition(center[0]+ext*1.65,center[1]+ext*.71,center[2]+ext*1.95)
    cam.SetFocalPoint(*center);cam.SetViewUp(0,1,0);cam.ParallelProjectionOn();cam.SetParallelScale(ext*.47)
    ren.ResetCameraClippingRange();win.Render()
    capture=vtk.vtkWindowToImageFilter();capture.SetInput(win);capture.ReadFrontBufferOff();capture.Update()
    pathlib.Path(output).parent.mkdir(parents=True,exist_ok=True)
    writer=vtk.vtkPNGWriter();writer.SetInputConnection(capture.GetOutputPort());writer.SetFileName(str(output));writer.Write();win.Finalize()
    return {'bytes':pathlib.Path(output).stat().st_size,'triangles':sum(len(read_accessor(d,b,p['indices']))//3 for m in d['meshes'] for p in m['primitives']),'bounds':(mins.tolist(),maxs.tolist())}

if __name__=='__main__':
 import argparse
 a=argparse.ArgumentParser();a.add_argument('input');a.add_argument('output');a.add_argument('--angle',default='side');x=a.parse_args();print(json.dumps(render(x.input,x.output,x.angle),indent=2))