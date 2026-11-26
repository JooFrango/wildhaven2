#!/usr/bin/env python3
"""Actual screenshot render of Torvardo GLB with vtkGLTFImporter."""
from pathlib import Path
import numpy as np
import vtk
from PIL import Image, ImageOps, ImageDraw, ImageFont
ROOT=Path(__file__).resolve().parent.parent
GLB=ROOT/'torvardo-v03-anatomy-blockout.glb'
OUTPUT=ROOT/'previews';OUTPUT.mkdir(parents=True,exist_ok=True)

def screenshot(angle,w=1300,h=940):
 renderer=vtk.vtkRenderer()
 renderer.SetBackground(.76,.79,.77)
 renderer.SetBackground2(.965,.963,.935)
 renderer.GradientBackgroundOn()
 win=vtk.vtkRenderWindow();win.SetOffScreenRendering(1);win.SetSize(w,h)
 win.SetMultiSamples(8);win.AddRenderer(renderer)
 imp=vtk.vtkGLTFImporter();imp.SetFileName(str(GLB));imp.SetRenderWindow(win);imp.Update()
 allactors=renderer.GetActors();allactors.InitTraversal()
 actors=[];mins=np.array([1e9]*3);maxs=-mins
 for _ in range(allactors.GetNumberOfItems()):
  actor=allactors.GetNextActor()
  if not actor:continue
  # Imported vertex colors already in real GLB; keep lit matte surfaces.
  prop=actor.GetProperty();prop.SetAmbient(.29);prop.SetDiffuse(.82);prop.SetSpecular(.015);prop.SetSpecularPower(10)
  actors.append(actor)
  b=actor.GetBounds()
  if not b:continue
  mn=np.array([b[0],b[2],b[4]]);mx=np.array([b[1],b[3],b[5]])
  mins=np.minimum(mins,mn);maxs=np.maximum(maxs,mx)
 # Studio keys emphasize hard plane changes, rather than flat shadowless clay.
 key=vtk.vtkLight();key.SetPosition(6,10,12);key.SetFocalPoint(0,1.5,0);key.SetIntensity(1.25);renderer.AddLight(key)
 fill=vtk.vtkLight();fill.SetPosition(-5,7,-9);fill.SetFocalPoint(0,1.5,0);fill.SetIntensity(.45);renderer.AddLight(fill)
 rim=vtk.vtkLight();rim.SetPosition(-8,10,4);rim.SetFocalPoint(0,2,0);rim.SetIntensity(.53);renderer.AddLight(rim)
 center=(mins+maxs)*.5
 extent=(maxs-mins).max()
 camera=renderer.GetActiveCamera()
 if angle=='side':camera.SetPosition(center[0],center[1]+extent*.19,center[2]+extent*2.7)
 elif angle=='front':camera.SetPosition(center[0]+extent*2.55,center[1]+extent*.22,center[2])
 else:camera.SetPosition(center[0]+extent*1.55,center[1]+extent*.47,center[2]+extent*1.93)
 camera.SetFocalPoint(*center);camera.SetViewUp(0,1,0)
 camera.ParallelProjectionOn();camera.SetParallelScale(extent*(.45 if angle=='side' else .46))
 renderer.ResetCameraClippingRange()
 win.Render()
 capture=vtk.vtkWindowToImageFilter();capture.SetInput(win);capture.SetInputBufferTypeToRGB();capture.ReadFrontBufferOff();capture.Update()
 writer=vtk.vtkPNGWriter();out=OUTPUT/(f'torvardo-v03-real-glb-{angle}.png');writer.SetFileName(str(out));writer.SetInputConnection(capture.GetOutputPort());writer.Write()
 win.Finalize()
 print('rendered',angle,'nactors',len(actors),'ext',maxs-mins,'file',out.stat().st_size)
 return out

def montages(files):
 imgs=[Image.open(p).convert('RGB') for p in files]
 width=2300;height=1060
 bg=Image.new('RGB',(width,height),'#E6E5D9')
 sizes=[(1100,880),(545,390),(545,390)]
 pos=[(42,90),(1185,90),(1185,580)]
 for i,im in enumerate(imgs):
  fitted=ImageOps.contain(im,sizes[i],Image.Resampling.LANCZOS)
  bg.paste(fitted,(pos[i][0]+(sizes[i][0]-fitted.width)//2,pos[i][1]+(sizes[i][1]-fitted.height)//2))
 d=ImageDraw.Draw(bg)
 try:
  ft=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',31)
  st=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',22)
 except:ft=ImageFont.load_default();st=ft
 d.text((45,28),'TORVARDO v03 — BLOQUEIO ANATÔMICO • MODELO GLB REAL',font=ft,fill='#263A31')
 d.text((56,945),'3/4 • Silhueta / materiais de face / junta e apoio',font=st,fill='#40574C')
 d.text((1195,457),'Perfil — proporções e planos',font=st,fill='#40574C')
 d.text((1195,957),'Frente — largura de ombros e escudo',font=st,fill='#40574C')
 path=OUTPUT/'Torvardo_v03_Preview_GLb_Real_3_Angulos.png';bg.save(path,optimize=True)
 print('montage',path)

if __name__=='__main__':
 files=[screenshot(a) for a in ('three_quarter','side','front')]
 montages(files)