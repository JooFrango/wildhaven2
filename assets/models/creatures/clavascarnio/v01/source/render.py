#!/usr/bin/env python3
"""Real renders from GLB exported and reimported by VTK GLTFImporter."""
import os,sys,json,hashlib
from pathlib import Path
import vtk
from PIL import Image, ImageDraw, ImageFont
root=Path(sys.argv[1] if len(sys.argv)>1 else Path(__file__).resolve().parents[1]);path=root/'clavascarnio-v01-blockout.glb'
sha=hashlib.sha256(path.read_bytes()).hexdigest();assert sha==json.loads((root/'manifest.json').read_text())['sha256']
print('Importing EXACT GLB: ',path,'sha',sha)
views={
 'perfil':((8.4,2.3,-.5),(0,1.55,-.65),5.9),
 'frente':((0,2.0,-10),(0,1.52,-.62),5.9),
 'tres-quartos':((7.6,3.5,-8.6),(0,1.50,-.60),6.8),
}
for name,(loc,at,ortho) in views.items():
    ren=vtk.vtkRenderer();ren.SetBackground(.105,.120,.145);ren.SetBackground2(.20,.23,.25);ren.GradientBackgroundOn()
    win=vtk.vtkRenderWindow();win.SetSize(1000,820);win.SetOffScreenRendering(True);win.SetMultiSamples(8)
    win.AddRenderer(ren)
    importer=vtk.vtkGLTFImporter();importer.SetFileName(str(path));importer.SetRenderWindow(win)
    importer.Update()
    n=ren.GetActors().GetNumberOfItems();print(name,'GLTF imported actors',n)
    assert n>0
    # Studio light; leave imported mesh, geometry, UV and normals untouched.
    for imported_actor in vtk.vtkActorCollection.SafeDownCast(ren.GetActors()) or []:
        prop=imported_actor.GetProperty();prop.SetAmbient(.28);prop.SetDiffuse(.77);prop.SetSpecular(.03)
    ren.AutomaticLightCreationOff()
    for pos,col,intensity in [((4,9,-6),(1.0,.89,.72),1.65),((-5,4,-1),(.62,.77,1.0),.70),((1,5,8),(1,.70,.53),.82)]:
        l=vtk.vtkLight();l.SetLightTypeToSceneLight();l.SetPosition(*pos);l.SetFocalPoint(0,1,0);l.SetColor(*col);l.SetIntensity(intensity);ren.AddLight(l)
    # No terrain geometry: all visible geometry is reimported GLB.
    cam=ren.GetActiveCamera();cam.SetPosition(*loc);cam.SetFocalPoint(*at);cam.SetViewUp(0,1,0);cam.ParallelProjectionOn();cam.SetParallelScale(ortho/2)
    ren.ResetCameraClippingRange()
    win.Render()
    w=vtk.vtkWindowToImageFilter();w.SetInput(win);w.SetInputBufferTypeToRGB();w.ReadFrontBufferOff();w.Update()
    writer=vtk.vtkPNGWriter();writer.SetInputConnection(w.GetOutputPort());f=root/'previews'/f'clavascarnio-v01-glb-real-{name}.png';writer.SetFileName(str(f));writer.Write()
    assert f.is_file()
    print(f,'bytes',f.stat().st_size)
    win.Finalize()
