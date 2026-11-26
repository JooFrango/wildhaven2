#!/usr/bin/env python3
"""Render TRUE profile/front/three-quarter PNGs after importing the built GLB.
Never renders from source generator or synthetic 2D imagery.
"""
from __future__ import annotations
import json,hashlib
from pathlib import Path
import vtk
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1]
GLB=ROOT/'gravarto-v01-anatomy-blockout.glb'
PRE=ROOT/'previews';PRE.mkdir(exist_ok=True)
ren=vtk.vtkRenderer();ren.SetBackground(.70,.72,.75);ren.SetBackground2(.90,.91,.91);ren.GradientBackgroundOn()
win=vtk.vtkRenderWindow();win.SetSize(1480,1000);win.SetOffScreenRendering(1);win.SetMultiSamples(4);win.AddRenderer(ren)
imp=vtk.vtkGLTFImporter();imp.SetFileName(str(GLB));imp.SetRenderWindow(win);imp.Update()
print('Reimported',GLB.name,'actors',ren.GetActors().GetNumberOfItems())
for actor in ren.GetActors():
 actor.GetProperty().SetAmbient(.24)
 actor.GetProperty().SetDiffuse(.74)
# Only decorative stage; model must remain the imported GLB
plane=vtk.vtkPlaneSource();plane.SetOrigin(-5,-.045,-4);plane.SetPoint1(5,-.045,-4);plane.SetPoint2(-5,-.045,4)
map=vtk.vtkPolyDataMapper();map.SetInputConnection(plane.GetOutputPort())
floor=vtk.vtkActor();floor.SetMapper(map);floor.GetProperty().SetColor(.48,.46,.44);floor.GetProperty().SetAmbient(.40);floor.GetProperty().SetDiffuse(.6);floor.GetProperty().SetSpecular(.0);ren.AddActor(floor)
for pos,bright in [((3,7,6),1.1),((-4,4,4),.55),((1,7,-6),.66)]:
 l=vtk.vtkLight();l.SetLightTypeToSceneLight();l.SetPosition(*pos);l.SetFocalPoint(-.35,.7,0);l.SetIntensity(bright);ren.AddLight(l)
views={
 'profile': {'pos':(-.55,2.1,11),'foc':(-.53,.78,0),'scale':2.18},
 'front':{'pos':(11,2.0,0),'foc':(.1,.77,0),'scale':1.52},
 'three-quarter':{'pos':(7.5,3.4,9.0),'foc':(-.55,.78,0),'scale':2.08},
}
for name,c in views.items():
 camera=ren.GetActiveCamera();camera.SetPosition(*c['pos']);camera.SetFocalPoint(*c['foc']);camera.SetViewUp(0,1,0)
 camera.SetParallelProjection(True);camera.SetParallelScale(c['scale']);ren.ResetCameraClippingRange();win.Render()
 filt=vtk.vtkWindowToImageFilter();filt.SetInput(win);filt.SetInputBufferTypeToRGB();filt.ReadFrontBufferOn();filt.Update()
 writer=vtk.vtkPNGWriter();dest=PRE/f'gravarto-v01-real-glb-{name}.png';writer.SetFileName(str(dest));writer.SetInputConnection(filt.GetOutputPort());writer.Write()
 print(name,dest.stat().st_size)
imgs=[Image.open(PRE/f'gravarto-v01-real-glb-{name}.png').convert('RGB') for name in views]
thumbs=[]
for im in imgs:
 im.thumbnail((900,610),Image.Resampling.LANCZOS);thumbs.append(im)
canvas=Image.new('RGB',(900*3,650),(39,41,45));d=ImageDraw.Draw(canvas)
for i,(name,im) in enumerate(zip(views,thumbs)):
 x=i*900;canvas.paste(im,(x,40))
 d.text((x+27,13),f'GRAVARTO v01  /  {name.upper()}  /  GLB REIMPORTADO',fill=(232,223,209))
canvas.save(PRE/'Gravarto_v01_GLb_Real_3_Angulos.png',optimize=True)
manifest=json.loads((ROOT/'manifest.json').read_text())
manifest['preview_status']='reimported_exported_binary_vtkGLTFImporter'
manifest['rendered_glb_sha256']=hashlib.sha256(GLB.read_bytes()).hexdigest()
manifest['previews']={p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in PRE.glob('*.png')}
manifest['renderer']='VTK vtkGLTFImporter and VTK offscreen rendering of exported binary. Neutral floor and studio lights are additions to presentation, not the GLB.'
(ROOT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
