#!/usr/bin/env python3
"""Renders generated exclusively from reimported real exported Fulgaronte GLB."""
from pathlib import Path
import math
import vtk
import numpy as np
from PIL import Image,ImageOps,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parent.parent
GLB=ROOT/'fulgaronte_v02_blockout_reconstruido.glb'
OUT=ROOT/'previews';OUT.mkdir(exist_ok=True)

BLUE=(230,237,241); WHITE=(246,248,248)

def snap(view,w=1280,h=860):
 ren=vtk.vtkRenderer()
 ren.SetBackground(.61,.69,.73)
 ren.SetBackground2(.95,.965,.971)
 ren.GradientBackgroundOn()
 window=vtk.vtkRenderWindow();window.SetOffScreenRendering(1);window.AddRenderer(ren);window.SetSize(w,h)
 window.SetMultiSamples(4)
 importer=vtk.vtkGLTFImporter();importer.SetFileName(str(GLB));importer.SetRenderWindow(window);importer.Update()
 actors=ren.GetActors();actors.InitTraversal();n=actors.GetNumberOfItems()
 bounds=np.array([float('inf'),-float('inf'),float('inf'),-float('inf'),float('inf'),-float('inf')])
 for k in range(n):
  ac=actors.GetNextActor()
  if ac is None: continue
  b=ac.GetBounds()
  if not b:continue
  bounds[::2]=np.minimum(bounds[::2],np.array(b)[::2]);bounds[1::2]=np.maximum(bounds[1::2],np.array(b)[1::2])
  ac.GetProperty().SetAmbient(.32);ac.GetProperty().SetDiffuse(.80);ac.GetProperty().SetSpecular(.04)
  ac.GetProperty().SetSpecularPower(14)
 # Ground plane: visual render set only, not exported with beast
 plane=vtk.vtkPlaneSource();plane.SetCenter(-2.2,-.013,0);plane.SetNormal(0,1,0);plane.SetOrigin(-16,-.05,-10);plane.SetPoint1(9,-.05,-10);plane.SetPoint2(-16,-.05,10);plane.SetXResolution(1);plane.SetYResolution(1)
 # Avoid ground interfering with subject geometry. Lit pale floor
 mp=vtk.vtkPolyDataMapper();mp.SetInputConnection(plane.GetOutputPort());actor=vtk.vtkActor();actor.SetMapper(mp);actor.GetProperty().SetColor(.80,.83,.84);actor.GetProperty().SetAmbient(.6);actor.GetProperty().SetDiffuse(.15);ren.AddActor(actor)
 for pos,intensity in [((9,19,14),1.30),((-10,11,-12),.60),((-7,13,8),.56)]:
  li=vtk.vtkLight();li.SetPosition(*pos);li.SetFocalPoint(-1,2,0);li.SetIntensity(intensity);ren.AddLight(li)
 # camera perspective-free real comparisons
 c=ren.GetActiveCamera();c.ParallelProjectionOn();c.SetViewUp(0,1,0)
 if view=='perfil':
  target=(-2.2,2.57,.15);c.SetPosition(-2.2,3.12,28);scale=5.75
 elif view=='frente':
  target=(3.1,2.85,0);c.SetPosition(27,3.7,0);scale=3.5
 elif view=='tres_quartos':
  target=(-1.8,2.75,0);c.SetPosition(13,7.0,24);scale=6.1
 else:raise ValueError(view)
 c.SetFocalPoint(*target);c.SetParallelScale(scale);ren.ResetCameraClippingRange()
 window.Render();cap=vtk.vtkWindowToImageFilter();cap.SetInput(window);cap.SetInputBufferTypeToRGB();cap.ReadFrontBufferOff();cap.Update()
 wr=vtk.vtkPNGWriter();dest=OUT/(f'fulgaronte_v02_real_glb_{view}.png');wr.SetFileName(str(dest));wr.SetInputConnection(cap.GetOutputPort());wr.Write()
 window.Finalize();print('RENDER',view,'actors',n,'image_bytes',dest.stat().st_size,'bounds',bounds.tolist())
 return dest

def collage(files):
 images=[Image.open(x).convert('RGB') for x in files]
 WIDTH=2600;HEIGHT=1450;bg=Image.new('RGB',(WIDTH,HEIGHT),'#e9eff2')
 draw=ImageDraw.Draw(bg)
 try:
  F=lambda size,bold=False:ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans'+('-Bold' if bold else '')+'.ttf',size)
 except: F=lambda size,bold=False:ImageFont.load_default()
 head=F(48,True);mid=F(33,True);small=F(26)
 draw.rectangle((0,0,WIDTH,121),fill='#243b47')
 draw.text((48,28),'WILDHAVEN  /  FULGARONTE v02  /  BLOCKOUT 3D REAL',font=head,fill='#eef4ee')
 draw.text((48,144),'CONCEITO APROVADO  •  FORMA EM REVISAO  •  GLB EXPORTADO E REIMPORTADO',font=small,fill='#3b5361')
 # each panel 2x2: large three-quarter on left and profile/front at right
 slots=[((40,207,1550,1289),'Três-quartos'),((1582,207,2560,710),'Perfil'),((1582,778,2560,1289),'Frente')]
 for (rect,label),pic in zip(slots,images):
  x0,y0,x1,y1=rect
  draw.rounded_rectangle((x0-2,y0-2,x1+2,y1+2),radius=16,fill='#c3cfd5')
  fit=ImageOps.fit(pic,(x1-x0,y1-y0),method=Image.Resampling.LANCZOS,centering=(.5,.48));bg.paste(fit,(x0,y0))
  draw=ImageDraw.Draw(bg);draw.rectangle((x0+15,y0+14,x0+260,y0+65),fill='#223944')
  draw.text((x0+28,y0+20),label,font=mid,fill='white')
 draw.rectangle((0,1345,WIDTH,HEIGHT),fill='#243b47')
 draw.text((48,1365),f"{__import__('json').load(open(ROOT/'manifest.json'))['triangles']} triangulos   |   corpo reconstruido   |   1 malha, atlas UV   |   sem rig/animacoes",font=F(30),fill='#e8f0ef')
 dest=OUT/'Fulgaronte_v02_3_Vistas_GLb_Real.png';bg.save(dest,optimize=True)
 print('MONTAGE',dest,dest.stat().st_size)

if __name__=='__main__':
 collage([snap('tres_quartos'),snap('perfil'),snap('frente')])
