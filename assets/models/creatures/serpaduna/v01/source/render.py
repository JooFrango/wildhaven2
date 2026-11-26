#!/usr/bin/env python3
"""Real GLB reimported by VTK GLTFImporter; three screenshots, not AI concept art."""
from pathlib import Path
import vtk
from vtk.util import numpy_support
import numpy as np
ROOT=Path(__file__).resolve().parent.parent
GLB=ROOT/'serpaduna_v01_blockout.glb'
VIEWS=[
    ('perfil', (0,-13,4.0), (0,0,.98)),
    ('frente',(-12,-0.30,3.25),(0,0,.98)),
    ('tres_quartos',(-10,-11,5.6),(0,0,1.02)),
]
for name,position,target in VIEWS:
    win=vtk.vtkRenderWindow()
    win.SetSize(1300,960)
    win.SetOffScreenRendering(1)
    win.SetMultiSamples(8)
    importer=vtk.vtkGLTFImporter()
    importer.SetFileName(str(GLB))
    importer.SetRenderWindow(win)
    importer.Update()
    ren=win.GetRenderers().GetFirstRenderer()
    ren.SetBackground(.105,.094,.084)
    ren.SetBackground2(.22,.19,.15)
    ren.GradientBackgroundOn()
    # force neutral rough surfaces to read as faceted 3D
    ren.AutomaticLightCreationOff()
    lights=[((1,-6,9),1.15),((-5,4,6),.65),((4,5,3),.55)]
    for coord,intensity in lights:
        l=vtk.vtkLight();l.SetLightTypeToSceneLight();l.SetPosition(*coord)
        l.SetFocalPoint(0,0,0);l.SetIntensity(intensity)
        l.SetColor(1.,.95,.86) if coord[1]<0 else l.SetColor(.82,.86,1.)
        ren.AddLight(l)
    cam=ren.GetActiveCamera()
    cam.ParallelProjectionOn()
    cam.SetPosition(*position);cam.SetFocalPoint(*target);cam.SetViewUp(0,0,1)
    cam.SetParallelScale(2.90)
    ren.ResetCameraClippingRange()
    win.Render()
    window2image=vtk.vtkWindowToImageFilter()
    window2image.SetInput(win);window2image.SetInputBufferTypeToRGB();window2image.ReadFrontBufferOff();window2image.Update()
    writer=vtk.vtkPNGWriter()
    writer.SetFileName(str(ROOT/'previews'/('serpaduna_v01_real_glb_'+name+'.png')))
    writer.SetInputConnection(window2image.GetOutputPort());writer.Write()
    print(name,'actors',ren.GetActors().GetNumberOfItems(),'bounds',ren.ComputeVisiblePropBounds())
    win.Finalize()
