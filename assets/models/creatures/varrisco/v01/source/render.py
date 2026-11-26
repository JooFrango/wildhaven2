#!/usr/bin/env python3
"""Render profile, front and three-quarter images from the *reimported GLB*.
Uses vtkGLTFImporter. Environment is a neutral studio floor and fixed lights;
no concept/image-generation elements are composited into render outputs.
"""
from __future__ import annotations
import json, hashlib, math
from pathlib import Path
import vtk
ROOT=Path(__file__).resolve().parents[1]
GLB=ROOT/'varrisco-v01-anatomy-blockout.glb'
PREV=ROOT/'previews'
PREV.mkdir(exist_ok=True)

renderer=vtk.vtkRenderer()
renderer.SetBackground(0.82,0.84,0.86)
renderer.SetBackground2(0.94,0.94,0.93)
renderer.GradientBackgroundOn()
renwin=vtk.vtkRenderWindow()
renwin.SetOffScreenRendering(1)
renwin.SetSize(1500,1100)
renwin.SetMultiSamples(8)
renwin.AddRenderer(renderer)
importer=vtk.vtkGLTFImporter()
importer.SetFileName(str(GLB))
importer.SetRenderWindow(renwin)
importer.Update()
print('Imported GLB vtkGLTFImporter',GLB.name,'actors',renderer.GetActors().GetNumberOfItems())
# Studio floor is an explicit visualization aid (not part of the GLB).
plane=vtk.vtkPlaneSource()
plane.SetOrigin(-4,-.008,-3);plane.SetPoint1(4,-.008,-3);plane.SetPoint2(-4,-.008,3)
plane.SetXResolution(1);plane.SetYResolution(1)
mapper=vtk.vtkPolyDataMapper();mapper.SetInputConnection(plane.GetOutputPort())
floor=vtk.vtkActor();floor.SetMapper(mapper)
floor.GetProperty().SetColor(.74,.71,.67)
floor.GetProperty().SetAmbient(.3)
floor.GetProperty().SetDiffuse(.7)
floor.GetProperty().SetSpecular(.03)
renderer.AddActor(floor)
for i,pos in enumerate([(2,7,7),(-5,4,4),(1,5,-7)]):
 l=vtk.vtkLight();l.SetLightTypeToSceneLight();l.SetPosition(*pos)
 l.SetFocalPoint(-.25,.9,0);l.SetIntensity([.90,.45,.52][i]);renderer.AddLight(l)
#renderer.SetUseFXAA(True)
# Support transparent PNG? keep opaque background, valuable to understand silhouette.
views={
 'profile': {'position':(-.20,1.26,7.8),'focal':(-.20,.77,0),'parallel':1.44},
 'front':{'position':(7.7,1.26,0),'focal':(-.1,.80,0),'parallel':1.20},
 'three-quarter':{'position':(4.8,2.58,6.7),'focal':(-.18,.76,0),'parallel':1.40}
}
for name,v in views.items():
 camera=renderer.GetActiveCamera()
 camera.SetPosition(*v['position']);camera.SetFocalPoint(*v['focal']);camera.SetViewUp(0,1,0)
 camera.SetParallelProjection(True);camera.SetParallelScale(v['parallel'])
 renderer.ResetCameraClippingRange()
 renwin.Render()
 w2i=vtk.vtkWindowToImageFilter();w2i.SetInput(renwin);w2i.SetInputBufferTypeToRGB();w2i.ReadFrontBufferOn();w2i.Update()
 dest=PREV/f'varrisco-v01-real-glb-{name}.png'
 png=vtk.vtkPNGWriter();png.SetFileName(str(dest));png.SetInputConnection(w2i.GetOutputPort());png.Write()
 print(name,dest.stat().st_size,'bytes')
manifest=json.loads((ROOT/'manifest.json').read_text(encoding='utf8'))
manifest['renderer']='vtkGLTFImporter of exported binary GLB + VTK offscreen 1500x1100 neutral studio lighting/floor'
manifest['previews_sha256']={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in PREV.glob('varrisco-v01-real-glb-*.png')}
manifest['rendered_glb_sha256']=hashlib.sha256(GLB.read_bytes()).hexdigest()
(ROOT/'manifest.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n',encoding='utf8')
