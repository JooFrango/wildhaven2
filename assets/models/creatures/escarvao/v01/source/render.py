#!/usr/bin/env python3
"""Re-import each exported GLB through VTK GLTFImporter; no image AI in previews."""
from pathlib import Path
import sys, hashlib
import numpy as np
import vtk
from PIL import Image, ImageOps, ImageDraw, ImageFont
ROOT=Path(__file__).resolve().parent.parent
PRE=ROOT/'previews'; PRE.mkdir(parents=True,exist_ok=True)
SHOTS={}

def render(variant, angle,w=1050,h=830):
 path=ROOT/f'escarvao_{variant}_blockout_v01.glb'
 renderer=vtk.vtkRenderer();renderer.SetBackground(.12,.14,.17);renderer.SetBackground2(.30,.31,.30);renderer.GradientBackgroundOn()
 win=vtk.vtkRenderWindow();win.SetOffScreenRendering(1);win.SetSize(w,h);win.SetMultiSamples(4);win.AddRenderer(renderer)
 imp=vtk.vtkGLTFImporter();imp.SetFileName(str(path));imp.SetRenderWindow(win);imp.Update()
 actors=renderer.GetActors();actors.InitTraversal(); mn=np.ones(3)*1e6;mx=-mn;actorcount=0
 for _ in range(actors.GetNumberOfItems()):
  a=actors.GetNextActor()
  if a is None:continue
  actorcount+=1
  # VTK retains imported texture material; lighting settings are only studio presentation.
  pr=a.GetProperty();pr.SetAmbient(.26);pr.SetDiffuse(.78);pr.SetSpecular(.025);pr.SetSpecularPower(20)
  b=a.GetBounds();mn=np.minimum(mn,[b[0],b[2],b[4]]);mx=np.maximum(mx,[b[1],b[3],b[5]])
 ext=mx-mn;center=(mn+mx)*.5; m=ext.max()
 for pos,brightness in [((6,10,9),1.45),((-6,7,0),.65),((2,10,-8),.8)]:
  l=vtk.vtkLight();l.SetPosition(*pos);l.SetFocalPoint(*center);l.SetIntensity(brightness);renderer.AddLight(l)
 cam=renderer.GetActiveCamera()
 if angle=='side':cam.SetPosition(center[0],center[1]+m*.10,center[2]+m*2.7)
 elif angle=='front':cam.SetPosition(center[0]+m*2.7,center[1]+m*.23,center[2])
 else:cam.SetPosition(center[0]+m*1.72,center[1]+m*.51,center[2]+m*1.72)
 cam.SetFocalPoint(*center);cam.SetViewUp(0,1,0);cam.ParallelProjectionOn();cam.SetParallelScale(m*.67)
 renderer.ResetCameraClippingRange()
 win.Render()
 cap=vtk.vtkWindowToImageFilter();cap.SetInput(win);cap.SetInputBufferTypeToRGB();cap.ReadFrontBufferOff();cap.Update()
 out=PRE/f'escarvao_{variant}_real_glb_{angle}.png'
 writer=vtk.vtkPNGWriter();writer.SetFileName(str(out));writer.SetInputConnection(cap.GetOutputPort());writer.Write()
 print(f'REIMPORT GLB {variant} {angle}: actors={actorcount}, bounds={np.round(ext,2)}, png={out.stat().st_size} bytes',flush=True)
 win.Finalize();SHOTS[(variant,angle)]=out
 return out

def sheet():
 # 3 variants x 3 actual rendered views, with readable header.
 variants=['cobre','rubro','oliva'];angs=['three_quarter','side','front']
 W=2400;H=2340; out=Image.new('RGB',(W,H),'#161b1b');d=ImageDraw.Draw(out)
 font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';bold='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
 f1=ImageFont.truetype(bold,51);f2=ImageFont.truetype(bold,31);f3=ImageFont.truetype(font,22)
 d.text((55,34),'WILDHAVEN  /  ESCARVAO v01',font=f1,fill='#e2cba3')
 d.text((55,100),'REAL GLB • STATIC ANATOMICAL BLOCKOUT • 3 UV VARIANTS',font=f3,fill='#aaa9a0')
 cw=748;ch=605;gap=30
 for ri,v in enumerate(variants):
  top=170+ri*718
  d.text((56,top), {'cobre':'01  /  COBRE — dunas douradas','rubro':'02  /  RUBRO — ferro e rochas','oliva':'03  /  OLIVA — areas de oásis'}[v],font=f2,fill='#f1dfc5')
  for ci,ang in enumerate(angs):
   im=Image.open(SHOTS[(v,ang)]).convert('RGB')
   im=ImageOps.fit(im,(cw,ch),Image.Resampling.LANCZOS)
   x=52+ci*(cw+gap); y=top+51;out.paste(im,(x,y))
   d.text((x+12,y+ch-37),{'three_quarter':'TRES QUARTOS','side':'PERFIL','front':'FRENTE'}[ang],font=f3,fill='#ffffff',stroke_width=2,stroke_fill='#131718')
 path=PRE/'escarvao_v01_tres_variantes_tres_angulos_GLB_REAL.png';out.save(path,optimize=True)
 print('SHEET',str(path),path.stat().st_size)

if __name__=='__main__':
 for variant in ('cobre','rubro','oliva'):
  for angle in ('three_quarter','side','front'):render(variant,angle)
 sheet()
