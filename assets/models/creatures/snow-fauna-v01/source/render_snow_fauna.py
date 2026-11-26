#!/usr/bin/env python3
"""Reimport exported *real* GLB with vtkGLTFImporter and render orthogonal views."""
from pathlib import Path
import json
import numpy as np
import vtk
from PIL import Image,ImageOps,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1]
PREV=ROOT/'previews';PREV.mkdir(exist_ok=True)
DISPLAY={'casquim':'CASQUIM','gelfaro':'GÉLFARO','tufrino':'TUFRINO DE GELO','branquelope':'BRANQUELÓPE','nevisco':'NEVISCO'}


def render_one(spec):
 p=ROOT/'assets'/spec/f'{spec}_blockout_v01.glb'
 renderer=vtk.vtkRenderer()
 renderer.SetBackground(.73,.77,.78)
 renderer.SetBackground2(.89,.92,.93)
 renderer.GradientBackgroundOn()
 window=vtk.vtkRenderWindow();window.SetOffScreenRendering(True);window.AddRenderer(renderer)
 window.SetSize(900,690);window.SetMultiSamples(4)
 imp=vtk.vtkGLTFImporter();imp.SetFileName(str(p));imp.SetRenderWindow(window)
 imp.Update()
 # Separate lights from the exported asset and keep the actual GLB material/textures.
 renderer.RemoveAllLights()
 light=vtk.vtkLight();light.SetLightTypeToSceneLight();light.SetPosition(-4,-5,8);light.SetFocalPoint(0,0,.45);light.SetIntensity(1.20);renderer.AddLight(light)
 fill=vtk.vtkLight();fill.SetPosition(5,2,6);fill.SetFocalPoint(0,0,.35);fill.SetIntensity(1.00);renderer.AddLight(fill)
 ambient=vtk.vtkLight();ambient.SetPosition(-2,5,5);ambient.SetFocalPoint(0,0,.5);ambient.SetIntensity(.8);renderer.AddLight(ambient)
 renderer.SetUseImageBasedLighting(False)
 for a in renderer.GetActors():
  a.GetProperty().SetAmbient(.35);a.GetProperty().SetDiffuse(.8)
 bounds=[]
 for a in renderer.GetActors():
  b=a.GetBounds()
  if b and b[0]<1e20:bounds.append(b)
 if not bounds:raise RuntimeError(f'GLB importer had no actors: {p}')
 box=[min(x[0] for x in bounds),max(x[1] for x in bounds),min(x[2] for x in bounds),max(x[3] for x in bounds),min(x[4] for x in bounds),max(x[5] for x in bounds)]
 center=[(box[0]+box[1])/2,(box[2]+box[3])/2,(box[4]+box[5])/2]
 sizes=[box[1]-box[0],box[3]-box[2],box[5]-box[4]]
 radius=float(max(sizes))
 views={'perfil':(0,-1,0),'frente':(-1,0,0),'tres_quartos':(-.8,-.7,.28)}
 result={}
 for angle,direction in views.items():
  cam=renderer.GetActiveCamera();cam.SetFocalPoint(*center)
  cam.SetPosition(*(np.array(center)+np.array(direction,dtype=float)*radius*4))
  cam.SetViewUp(0,0,1);cam.ParallelProjectionOn();cam.SetParallelScale(radius*.66)
  cam.SetClippingRange(.01,max(20,radius*12))
  renderer.ResetCameraClippingRange();window.Render()
  capture=vtk.vtkWindowToImageFilter();capture.SetInput(window);capture.SetScale(1);capture.ReadFrontBufferOff();capture.Update()
  path=PREV/f'{spec}_{angle}_real_glb.png'
  wr=vtk.vtkPNGWriter();wr.SetInputConnection(capture.GetOutputPort());wr.SetFileName(str(path));wr.Write()
  result[angle]=str(path)
 # Contact strip (same reimported-GLB images, no synthetic stand-ins)
 w=720;h=560
 thumbs=[]
 for angle in ('perfil','frente','tres_quartos'):
  im=Image.open(result[angle]).convert('RGB');im.thumbnail((w,h),Image.Resampling.LANCZOS)
  canvas=Image.new('RGB',(w,h),(235,237,237));canvas.paste(im,((w-im.width)//2,(h-im.height)//2))
  draw=ImageDraw.Draw(canvas)
  draw.rectangle((0,h-58,w,h),fill=(31,42,44));draw.text((22,h-41),{'perfil':'PERFIL','frente':'FRENTE','tres_quartos':'TRÊS-QUARTOS'}[angle],fill=(255,255,255))
  thumbs.append(canvas)
 collage=Image.new('RGB',(w*3,h+100),(230,232,231))
 for i,im in enumerate(thumbs):collage.paste(im,(i*w,100))
 d=ImageDraw.Draw(collage);d.rectangle((0,0,w*3,100),fill=(33,46,48));d.text((35,27),DISPLAY[spec]+'   |   BLOCKOUT GLB REAL   •   V01',fill=(252,250,241),stroke_width=0)
 fn=PREV/f'{spec}_3vistas_real_glb.png';collage.save(fn,optimize=True)
 return {'species':spec,'glb':str(p),'actors':len(bounds),'bounds':box,'renders':result,'contact_sheet':str(fn)}

if __name__=='__main__':
 res=[render_one(s) for s in DISPLAY]
 (PREV/'render_report.json').write_text(json.dumps(res,ensure_ascii=False,indent=2),encoding='utf-8')
 for r in res:print(r['species'],r['bounds'],r['contact_sheet'])
