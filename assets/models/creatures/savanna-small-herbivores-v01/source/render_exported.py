#!/usr/bin/env python3
"""True model screenshots: load final exported GLB with vtkGLTFImporter and capture rendered pixels."""
from pathlib import Path
import argparse,vtk
ROOT=Path(__file__).resolve().parents[1]

def render_one(model, destination,angle='three_quarter'):
    win=vtk.vtkRenderWindow();win.SetOffScreenRendering(1);win.SetSize(1200,850)
    importer=vtk.vtkGLTFImporter();importer.SetFileName(str(model));importer.SetRenderWindow(win);importer.Update()
    ren=win.GetRenderers().GetFirstRenderer()
    ren.SetBackground(.90,.91,.88);ren.SetBackground2(.78,.82,.81);ren.GradientBackgroundOn()
    bounds=ren.ComputeVisiblePropBounds()
    if bounds[1]<=bounds[0]:raise RuntimeError('No GLB model geometry imported: '+str(model))
    xmin,xmax,ymin,ymax,zmin,zmax=bounds
    cx=(xmin+xmax)/2;cy=(ymin+ymax)/2;cz=(zmin+zmax)/2
    extent=max(xmax-xmin,ymax-ymin,(zmax-zmin)*1.4)
    ground=vtk.vtkPlaneSource();yy=ymin-.04
    ground.SetOrigin(-8,yy,-8);ground.SetPoint1(8,yy,-8);ground.SetPoint2(-8,yy,8)
    mapper=vtk.vtkPolyDataMapper();mapper.SetInputConnection(ground.GetOutputPort())
    actor=vtk.vtkActor();actor.SetMapper(mapper)
    actor.GetProperty().SetColor(.68,.65,.54);actor.GetProperty().SetAmbient(.46)
    ren.AddActor(actor)
    ren.RemoveAllLights()
    for pos,intensity in [((4.,7.,7.),1.0),((-5.,5.,-4.),.48)]:
        light=vtk.vtkLight();light.SetPosition(*pos);light.SetFocalPoint(cx,cy,cz);light.SetIntensity(intensity);ren.AddLight(light)
    cam=ren.GetActiveCamera();cam.ParallelProjectionOn()
    if angle=='side':cam.SetPosition(cx,cy+.35,cz+8)
    elif angle=='front':cam.SetPosition(cx+8,cy+.3,cz)
    else:cam.SetPosition(cx+4.6,cy+1.9,cz+6.4)
    cam.SetFocalPoint(cx,cy,cz);cam.SetViewUp(0,1,0);cam.SetParallelScale(max(.55,extent*.49))
    ren.ResetCameraClippingRange();win.Render()
    capture=vtk.vtkWindowToImageFilter();capture.SetInput(win);capture.ReadFrontBufferOff();capture.Update()
    out=vtk.vtkPNGWriter();out.SetInputConnection(capture.GetOutputPort());out.SetFileName(str(destination));out.Write()
    win.Finalize()
    assert destination.stat().st_size>10000

def main(root=ROOT):
    (root/'previews').mkdir(parents=True,exist_ok=True)
    for id in ['sevilho','arbelio','frutavil','cromatil']:
        glb=root/'models'/id/f'{id}-savanna-animated-v01-LOD0.glb'
        for angle in ['side','three_quarter','front']:
            target=root/'previews'/f'{id}-real-3d-{angle}-v01.png'
            render_one(glb,target,angle);print(id,angle,target.stat().st_size,flush=True)
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--root',default=ROOT,type=Path);a=p.parse_args();main(a.root)