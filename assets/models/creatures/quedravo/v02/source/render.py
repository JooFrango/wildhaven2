#!/usr/bin/env python3
"""Reimports the exported Quedravo GLB with VTK, produces actual camera renders."""
from pathlib import Path
import numpy as np
import vtk
from PIL import Image, ImageOps, ImageDraw, ImageFont
ROOT=Path(__file__).resolve().parent.parent
GLB=ROOT/'quedravo_v02_blockout_2000.glb'
DIR=ROOT/'previews';DIR.mkdir(parents=True,exist_ok=True)

def render(view,w=1700,h=1040):
 ren=vtk.vtkRenderer();ren.SetBackground(.18,.19,.22);ren.SetBackground2(.43,.43,.47);ren.GradientBackgroundOn()
 win=vtk.vtkRenderWindow();win.SetSize(w,h);win.SetOffScreenRendering(1);win.SetMultiSamples(2);win.AddRenderer(ren)
 imp=vtk.vtkGLTFImporter();imp.SetFileName(str(GLB));imp.SetRenderWindow(win);imp.Update()
 actors=ren.GetActors();actors.InitTraversal();lo=np.ones(3)*np.inf;hi=-lo;count=0
 for _ in range(actors.GetNumberOfItems()):
  actor=actors.GetNextActor();
  if actor is None:continue
  count+=1
  prop=actor.GetProperty();prop.SetAmbient(.55);prop.SetDiffuse(.76);prop.SetSpecular(.05);prop.SetSpecularPower(20)
  b=actor.GetBounds();
  if b:
   lo=np.minimum(lo,[b[0],b[2],b[4]]);hi=np.maximum(hi,[b[1],b[3],b[5]])
 ctr=(lo+hi)/2;diff=hi-lo;span=max(diff);c=ren.GetActiveCamera();rad=span*2.8
 if view=='frente':
  pos=ctr+np.array([rad,.25*rad,0])
  scale=max(diff[1]*.64,diff[2]/(w/h)*.60)
 elif view=='perfil':
  pos=ctr+np.array([0,.12*rad,rad]);scale=max(diff[1]*.68,diff[0]/(w/h)*.60)
 else:
  pos=ctr+np.array([rad*.80,rad*.31,rad*.86]);scale=max(diff[1]*.73,diff[2]/(w/h)*.51)
 c.SetPosition(*pos);c.SetFocalPoint(*ctr);c.SetViewUp(0,1,0);c.ParallelProjectionOn();c.SetParallelScale(scale)
 ren.ResetCameraClippingRange()
 for pos,intens in [([6,10,8],1.4),([-7,7,-12],.9),([-2,12,5],1.0)]:
  light=vtk.vtkLight();light.SetPosition(*(ctr+np.asarray(pos)*1.5));light.SetFocalPoint(*ctr);light.SetIntensity(intens);ren.AddLight(light)
 win.Render()
 cap=vtk.vtkWindowToImageFilter();cap.SetInput(win);cap.SetInputBufferTypeToRGB();cap.ReadFrontBufferOff();cap.Update()
 path=DIR/f'quedravo_v02_real_glb_{view}.png';png=vtk.vtkPNGWriter();png.SetFileName(str(path));png.SetInputConnection(cap.GetOutputPort());png.Write()
 win.Finalize()
 print('RENDER',view,'actors',count,'bounds',np.round(lo,2),np.round(hi,2),'bytes',path.stat().st_size,flush=True)
 return path

def montage(paths):
 try:
  ftitle=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',40)
  ft=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',26)
 except:ftitle=ImageFont.load_default();ft=ftitle
 W,H=2310,1540;bg=Image.new('RGB',(W,H),'#171b23');d=ImageDraw.Draw(bg)
 d.rectangle((0,0,W,114),fill='#211e24')
 d.text((52,27),'QUEDRAVO  v02   |   OTIMIZADO • 2.000 TRIÂNGULOS • GLB REAL',font=ftitle,fill='#e8d5ae')
 d.text((52,80),'CONCEITO APROVADO  •  GEOMETRIA PARA REVISÃO  •  SEM RIG / ANIMAÇÃO',font=ft,fill='#b3a79a')
 areas=[(30,140,2250,820),(30,990,1080,450),(1190,990,1080,450)]
 names=['FRONTAL — ENVERGADURA E ANATOMIA DAS ASAS','PERFIL — CABEÇA, GARRAS E TORSO','TRÊS-QUARTOS — VOLUME E SILHUETA']
 for p,area,name in zip(paths,areas,names):
  x,y,w,h=area;img=Image.open(p).convert('RGB');img=ImageOps.contain(img,(w,h),Image.Resampling.LANCZOS)
  bg.paste(img,(x+(w-img.width)//2,y+(h-img.height)//2));d.text((x+15,y+h+15),name,font=ft,fill='#d8c6a9')
 dest=DIR/'Quedravo_v02_3_Vistas_GLb_Real.png';bg.save(dest,optimize=True)
 print('MONTAGE',dest, dest.stat().st_size)
if __name__=='__main__':
 all=[render(x,1900,840) if x=='frente' else render(x,1480,1020) for x in ('frente','perfil','tres_quartos')]
 montage(all)
