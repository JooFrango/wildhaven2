#!/usr/bin/env python3
"""Render three genuine views of each Dodarro GLB through VTK glTF importer."""
from pathlib import Path
import vtk

ROOT=Path(__file__).resolve().parent.parent
DIR=ROOT/"previews"
DIR.mkdir(parents=True,exist_ok=True)
CAMERAS={
 "perfil":((0.2,1.45,7.5),(0,1.35,0)),
 "frente":((7.5,1.51,0.0),(0,1.32,0)),
 "tres_quartos":((5.8,3.08,6.9),(0,1.36,0)),
}
for variant in ("selvagem","montaria"):
 path=ROOT/f"dodarro_{variant}_v01_blockout.glb"
 for label,(position,target) in CAMERAS.items():
  ren=vtk.vtkRenderer()
  ren.SetBackground(0.885,0.864,0.839)
  ren.SetBackground2(0.95,0.943,0.93)
  ren.GradientBackgroundOn()
  win=vtk.vtkRenderWindow()
  win.SetSize(920,800)
  win.SetOffScreenRendering(1)
  win.AddRenderer(ren)
  imp=vtk.vtkGLTFImporter()
  imp.SetFileName(str(path))
  imp.SetRenderWindow(win)
  imp.Update()
  ren.RemoveAllLights()
  for light_pos,light_col,intens in [
   ((4,8,7),(1.0,.97,.92),1.35),
   ((-5,5,-4),(.78,.87,1.0),.73),
   ((0,6,-6),(1.0,.86,.72),.48)
  ]:
   l=vtk.vtkLight()
   l.SetLightTypeToSceneLight()
   l.SetPosition(*light_pos)
   l.SetFocalPoint(0,1.4,0)
   l.SetColor(*light_col)
   l.SetIntensity(intens)
   ren.AddLight(l)
  cam=ren.GetActiveCamera()
  cam.SetPosition(*position)
  cam.SetFocalPoint(*target)
  cam.SetViewUp(0,1,0)
  cam.ParallelProjectionOn()
  cam.SetParallelScale(1.74)
  ren.ResetCameraClippingRange()
  win.Render()
  image=vtk.vtkWindowToImageFilter()
  image.SetInput(win)
  image.SetInputBufferTypeToRGB()
  image.ReadFrontBufferOff()
  image.Update()
  output=DIR/f"dodarro_{variant}_v01_REAL_{label}.png"
  writer=vtk.vtkPNGWriter()
  writer.SetFileName(str(output))
  writer.SetInputConnection(image.GetOutputPort())
  writer.Write()
  assert output.is_file() and output.stat().st_size>10000,output
  print("REAL GLB REIMPORT RENDER",output,output.stat().st_size)
  win.Finalize()
