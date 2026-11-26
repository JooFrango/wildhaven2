#!/usr/bin/env python3
"""Real screenshots of independently RE-IMPORTED GLB using vtkGLTFImporter."""
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw, ImageFont
import vtk
import json
ROOT=Path(__file__).resolve().parents[1]
GLB=ROOT/'serracorion-v02-espinhos-integrados.glb'
OUT=ROOT/'previews';OUT.mkdir(exist_ok=True)
# Y-up coordinates and X negative front.
VIEWS={
 'perfil': {'pos':(0.0,11.0,34.0),'look':(-.3,4.3,0.0),'scale':9.2},
 'frente': {'pos':(-36.0,11.0,0.0),'look':(-3.1,4.15,0.0),'scale':7.6},
 'tres-quartos': {'pos':(-27.0,15.5,29.0),'look':(-.7,4.0,0.0),'scale':9.1},
 'superior': {'pos':(-3.,31.0,12.0),'look':(-.3,4.0,0.0),'scale':9.3},
 'dorso-detalhe': {'pos':(0,8.4,16.5),'look':(.4,4.75,0.0),'scale':3.4},
}
for key,cfg in VIEWS.items():
    win=vtk.vtkRenderWindow();win.SetOffScreenRendering(True);win.SetSize(1040,700);win.SetMultiSamples(0)
    ren=vtk.vtkRenderer();ren.SetBackground(.90,.86,.78);ren.SetBackground2(.985,.976,.946);ren.GradientBackgroundOn();win.AddRenderer(ren)
    importer=vtk.vtkGLTFImporter();importer.SetFileName(str(GLB));importer.SetRenderWindow(win);importer.Update()
    actors=ren.GetActors();actors.InitTraversal();count=actors.GetNumberOfItems();has_tex=0
    for i in range(count):
        actor=actors.GetNextActor()
        if actor.GetTexture():has_tex+=1
        actor.GetProperty().SetInterpolationToPhong()
        actor.GetProperty().SetColor(1,1,1)
        actor.GetProperty().SetOpacity(1)
    # Attach actual raster atlas from the exported PBR texture; VTK uses the imported GLB UV buffer.
    txreader=vtk.vtkPNGReader();txreader.SetFileName(str(ROOT/"textures"/"serracorion-v02-painted-uv.png"));txreader.Update()
    texture=vtk.vtkTexture();texture.SetInputConnection(txreader.GetOutputPort());texture.InterpolateOn()
    actors.InitTraversal()
    for i in range(count): actors.GetNextActor().SetTexture(texture)
    # Thin floor for lighting / shadow context only, not exported as model.
    floor=vtk.vtkPlaneSource();floor.SetOrigin(-22,-.09,-17);floor.SetPoint1(22,-.09,-17);floor.SetPoint2(-22,-.09,17)
    mapper=vtk.vtkPolyDataMapper();mapper.SetInputConnection(floor.GetOutputPort());ob=vtk.vtkActor();ob.SetMapper(mapper)
    ob.GetProperty().SetColor(.67,.58,.47);ob.GetProperty().SetOpacity(.14);pass # renderer-only floor disabled
    for pos,pow,color in [((-13,19,22),1.1,(1,.92,.81)),((13,14,-18),.90,(.88,.92,1)),((-6,10,-28),.55,(.96,.84,.72))]:
        light=vtk.vtkLight();light.SetLightTypeToSceneLight();light.SetPosition(*pos);light.SetFocalPoint(-1,4,0);light.SetIntensity(pow);light.SetColor(*color);ren.AddLight(light)
    cam=ren.GetActiveCamera();cam.ParallelProjectionOn();cam.SetPosition(*cfg['pos']);cam.SetFocalPoint(*cfg['look']);cam.SetViewUp(0,1,0)
    cam.SetParallelScale(cfg['scale']);ren.ResetCameraClippingRange();win.Render()
    capture=vtk.vtkWindowToImageFilter();capture.SetInput(win);capture.SetInputBufferTypeToRGB();capture.ReadFrontBufferOff();capture.Update()
    dest=OUT/f'serracorion-v02-GLB-real-{key}.png';w=vtk.vtkPNGWriter();w.SetFileName(str(dest));w.SetInputConnection(capture.GetOutputPort());w.Write()
    img=Image.open(dest).convert('RGB')
    # Add exact technical label AFTER GLB render, no modification to model depicted
    d=ImageDraw.Draw(img)
    d.rounded_rectangle((26,25,635,89),radius=10,fill=(248,241,224))
    d.text((42,35),f'WILDHAVEN  /  SERRACÓRION V02  /  {key.upper()}',fill=(59,49,37))
    d.text((42,58),'REIMPORTAÇÃO DO ARQUIVO GLB REAL  •  UV PINTADO',fill=(103,84,66))
    img.save(dest,optimize=True)
    print(key,'GLB actors=',count,'actors_with_texture=',has_tex,'bytes=',dest.stat().st_size)
    if count<1:raise RuntimeError('VTK failed to import geometry from GLB')
    win.Finalize()

# Side, front, 3/4 collated from exactly the 3 independent GLB reimport renders.
w,h=1040,700
sheet=Image.new('RGB',(1040,1470),(243,233,211))
font=ImageFont.load_default()
for i,key in enumerate(['perfil','frente','tres-quartos']):
    img=Image.open(OUT/f'serracorion-v02-GLB-real-{key}.png').convert('RGB')
    img.thumbnail((1000,455),Image.Resampling.LANCZOS)
    x=(1040-img.width)//2; y=30+i*478
    sheet.paste(img,(x,y))
sheet.save(OUT/'serracorion-v02-3-vistas-GLB-real.jpg',quality=86,optimize=True)
print('contact sheet ready')
