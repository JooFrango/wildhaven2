#!/usr/bin/env python3
"""VTK reimports the exported GLB; screenshot is of actual exported geometry + UV."""
from pathlib import Path
import sys
import vtk
ROOT=Path(__file__).resolve().parent.parent
GLB=ROOT/'arenoceto-v01-textured-blockout.glb'
PREV=ROOT/'previews';PREV.mkdir(exist_ok=True)

views={
 'side': {'camera':(0,10,66),'focal':(-1.5,4.2,0),'zoom':45,'name':'PERFIL'},
 'front':{'camera':(61,13,0),'focal':(2,4.6,0),'zoom':32,'name':'FRENTE'},
 'three_quarter':{'camera':(45,26,49),'focal':(-1.0,4.0,0),'zoom':46,'name':'TRÊS QUARTOS'},
}
for filename,view in views.items():
    win=vtk.vtkRenderWindow();win.SetOffScreenRendering(True);win.SetSize(1500,990)
    win.SetMultiSamples(0)
    ren=vtk.vtkRenderer();ren.SetBackground(.93,.91,.85);ren.SetBackground2(.99,.98,.94);ren.GradientBackgroundOn();win.AddRenderer(ren)
    imp=vtk.vtkGLTFImporter();imp.SetFileName(str(GLB));imp.SetRenderWindow(win);imp.Update()
    actors=ren.GetActors();actors.InitTraversal();actor_count=actors.GetNumberOfItems()
    tex_count=0
    for i in range(actor_count):
        actor=actors.GetNextActor();prop=actor.GetProperty()
        pass  # preserve imported PBR material and its UV texture
        if actor.GetTexture():tex_count+=1
    # Ground is renderer-only studio backdrop, NOT part of the GLB model.
    plane=vtk.vtkPlaneSource();plane.SetOrigin(-39,.0,-30);plane.SetPoint1(39,.0,-30);plane.SetPoint2(-39,.0,30);plane.SetXResolution(1);plane.SetYResolution(1)
    pm=vtk.vtkPolyDataMapper();pm.SetInputConnection(plane.GetOutputPort());ground=vtk.vtkActor();ground.SetMapper(pm)
    ground.GetProperty().SetColor(.72,.65,.53);ground.GetProperty().SetOpacity(.27)
    ren.AddActor(ground)
    main=vtk.vtkLight();main.SetLightTypeToSceneLight();main.SetPosition(7,45,45);main.SetFocalPoint(0,3,0);main.SetIntensity(1.3);main.SetColor(1,0.94,.83);ren.AddLight(main)
    rim=vtk.vtkLight();rim.SetLightTypeToSceneLight();rim.SetPosition(-22,22,-38);rim.SetFocalPoint(0,3,0);rim.SetIntensity(.72);rim.SetColor(.87,.91,1);ren.AddLight(rim)
    label=vtk.vtkTextActor();label.SetInput('WILDHAVEN  /  ARENOCETO V01   |   '+view['name']+'   |   GLB REAL REIMPORTADO')
    label.SetDisplayPosition(52,52);txt=label.GetTextProperty();txt.SetFontSize(20);txt.SetBold(True);txt.SetColor(.23,.20,.17);ren.AddActor2D(label)
    credit=vtk.vtkTextActor();credit.SetInput('Blockout facetado  •  Atlas UV pintado  •  Sem rig/animação  •  Revisão da forma')
    credit.SetDisplayPosition(52,25);credit.GetTextProperty().SetFontSize(16);credit.GetTextProperty().SetColor(.36,.31,.27);ren.AddActor2D(credit)
    camera=ren.GetActiveCamera();camera.ParallelProjectionOn();camera.SetPosition(*view['camera']);camera.SetFocalPoint(*view['focal']);camera.SetViewUp(0,1,0)
    camera.SetParallelScale(view['zoom']*.31)
    ren.ResetCameraClippingRange();win.Render()
    fil=vtk.vtkWindowToImageFilter();fil.SetInput(win);fil.SetInputBufferTypeToRGB();fil.ReadFrontBufferOff();fil.Update()
    wr=vtk.vtkPNGWriter();wr.SetFileName(str(PREV/('arenoceto-v01-real-glb-'+filename+'.png')));wr.SetInputConnection(fil.GetOutputPort());wr.Write()
    print(filename,'actors_from_glb=',actor_count,'tex_from_glb=',tex_count, 'file=',PREV/('arenoceto-v01-real-glb-'+filename+'.png'))
    del win
