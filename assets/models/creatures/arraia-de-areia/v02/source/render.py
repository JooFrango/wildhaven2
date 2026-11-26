#!/usr/bin/env python3
"""Three genuine studio screenshots from EXPORTED+REIMPORTED Arraia GLB.
No AI imagery, no proxy meshes; studio lights/ground are render-only.
"""
from pathlib import Path
import hashlib,json
import vtk
from PIL import Image,ImageDraw,ImageFont

ROOT=Path(__file__).resolve().parent.parent
GLB=ROOT/'arraia-de-areia-v02-anatomia-refinada.glb'
PREV=ROOT/'previews';PREV.mkdir(exist_ok=True)
manifest=json.loads((ROOT/'manifest.json').read_text())
assert manifest['sha256_glb']==hashlib.sha256(GLB.read_bytes()).hexdigest()

views={
 'perfil':{'camera':(-2.0,8,67),'focal':(-2,2.6,0),'scale':10.0,'label':'PERFIL'},
 'frente':{'camera':(70,10,0),'focal':(0,2.2,0),'scale':10.4,'label':'FRENTE'},
 'tres-quartos':{'camera':(42,27,46),'focal':(-1.6,2.6,0),'scale':10.3,'label':'TRÊS-QUARTOS'},
 'superior':{'camera':(-2,75,0),'focal':(-2,2.2,0),'scale':11.2,'label':'VISTA SUPERIOR (EXTRA)'},
}
for name,cfg in views.items():
    win=vtk.vtkRenderWindow();win.SetOffScreenRendering(True);win.SetSize(1600,1040);win.SetMultiSamples(0)
    ren=vtk.vtkRenderer();ren.SetBackground(.85,.82,.74);ren.SetBackground2(.97,.95,.89);ren.GradientBackgroundOn()
    win.AddRenderer(ren)
    imp=vtk.vtkGLTFImporter();imp.SetFileName(str(GLB));imp.SetRenderWindow(win);imp.Update()
    actors=ren.GetActors();actors.InitTraversal()
    num=actors.GetNumberOfItems();tex_count=0
    for _ in range(num):
        ac=actors.GetNextActor()
        if ac.GetTexture():tex_count+=1
    assert num>=1
    # Studio floor; never merged into the creature mesh
    if name not in ('superior',):
        ps=vtk.vtkPlaneSource();ps.SetOrigin(-34,.1,-24);ps.SetPoint1(34,.1,-24);ps.SetPoint2(-34,.1,24)
        m=vtk.vtkPolyDataMapper();m.SetInputConnection(ps.GetOutputPort());ground=vtk.vtkActor();ground.SetMapper(m)
        ground.GetProperty().SetColor(.76,.69,.57);ground.GetProperty().SetOpacity(.15);ren.AddActor(ground)
    ren.RemoveAllLights()
    l1=vtk.vtkLight();l1.SetPosition(25,50,45);l1.SetFocalPoint(0,2,0);l1.SetIntensity(1.7);l1.SetColor(1,.97,.9);ren.AddLight(l1)
    l2=vtk.vtkLight();l2.SetPosition(-33,35,-32);l2.SetFocalPoint(0,2,0);l2.SetIntensity(1.1);l2.SetColor(.89,.94,1);ren.AddLight(l2)
    l3=vtk.vtkLight();l3.SetPosition(-12,20,22);l3.SetFocalPoint(0,2,0);l3.SetIntensity(.5);l3.SetColor(1,.89,.77);ren.AddLight(l3)
    cam=ren.GetActiveCamera();cam.ParallelProjectionOn();cam.SetPosition(*cfg['camera']);cam.SetFocalPoint(*cfg['focal'])
    cam.SetViewUp(*( (0,0,-1) if name=='superior' else (0,1,0) ))
    cam.SetParallelScale(cfg['scale']);ren.ResetCameraClippingRange()
    title=vtk.vtkTextActor();title.SetInput('WILDHAVEN   |   ARRAIA-DE-AREIA  V02   |   '+cfg['label'])
    title.SetDisplayPosition(48,70);title.GetTextProperty().SetFontSize(28);title.GetTextProperty().SetBold(True)
    title.GetTextProperty().SetColor(.23,.19,.13);ren.AddActor2D(title)
    info=vtk.vtkTextActor();info.SetInput('RENDER REAL: GLB exportado e reimportado  /  Textura UV pintada  /  Anatomia refinada / estático')
    info.SetDisplayPosition(48,38);info.GetTextProperty().SetFontSize(18);info.GetTextProperty().SetColor(.32,.27,.22)
    ren.AddActor2D(info)
    win.Render()
    grab=vtk.vtkWindowToImageFilter();grab.SetInput(win);grab.SetInputBufferTypeToRGB();grab.ReadFrontBufferOff();grab.Update()
    fn=PREV/('arraia-de-areia-v02-GLB-real-'+name+'.png')
    out=vtk.vtkPNGWriter();out.SetInputConnection(grab.GetOutputPort());out.SetFileName(str(fn));out.Write()
    size=fn.stat().st_size;assert size>30000
    print(f'{name}: {size} bytes; GLB mesh actors {num}; imported textured actors {tex_count} -> {fn}')
    win.Finalize();del win
# Contact sheet from the real three exported GLB renders, no new imagery
thumbs=[]
for key in ['perfil','frente','tres-quartos']:
    im=Image.open(PREV/('arraia-de-areia-v02-GLB-real-'+key+'.png')).convert('RGB')
    im.thumbnail((1000,650))
    thumbs.append(im)
canvas=Image.new('RGB',(2400,700),(244,239,230))
for im,i in zip(thumbs,range(3)):
    target=im.resize((770,500),Image.Resampling.LANCZOS)
    canvas.paste(target,(20+i*800,74))
font=None
for f in ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf','/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf']:
    try:font=ImageFont.truetype(f,31);break
    except OSError:pass
d=ImageDraw.Draw(canvas)
d.text((30,17),'ARRAIA-DE-AREIA   |   GLB REAL / 3 VISTAS / UV PINTADA',fill=(48,35,24),font=font)
for i,x in enumerate(['PERFIL','FRENTE','TRÊS-QUARTOS']):d.text((30+i*800,598),x,fill=(48,35,24),font=font)
canvas.save(PREV/'arraia-de-areia-v02-GLB-real-3-vistas.png',optimize=True)
