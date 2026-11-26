#!/usr/bin/env python3
"""Render poses and playback from actual GLB tracks by CPU skinning and VTK."""
import json,struct,sys,math,os,subprocess
from pathlib import Path
import numpy as np
import vtk
from vtk.util import numpy_support as ns
from scipy.spatial.transform import Rotation
from PIL import Image,ImageDraw,ImageFont
import generate_cavoru as g
D=Path(__file__).resolve().parent
W,H=610,490
renderer=vtk.vtkRenderer();renderer.SetBackground(.055,.085,.069);renderer.SetBackground2(.205,.275,.21);renderer.GradientBackgroundOn()
window=vtk.vtkRenderWindow();window.SetSize(W,H);window.SetOffScreenRendering(True);window.SetMultiSamples(0);window.AddRenderer(renderer)
renderer.AutomaticLightCreationOff()
for pos,intensity in [((-4,6,-4),1.25),((4,4,1),.9),((2,2,-5),.45)]:
 light=vtk.vtkLight();light.SetPosition(*pos);light.SetFocalPoint(0,.7,0);light.SetIntensity(intensity);renderer.AddLight(light)
cam=renderer.GetActiveCamera();cam.SetPosition(3.2,1.78,-3.8);cam.SetFocalPoint(0,.71,0);cam.SetViewAngle(38);cam.SetViewUp(0,1,0)
renderer.ResetCameraClippingRange()
font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
ft=ImageFont.truetype(font,19);title=ImageFont.truetype(font,23)
scene=[];tracks={};current=None

def parse(region,lod=0):
 global scene,tracks,current
 current=(region,lod)
 for *_,act in scene:renderer.RemoveActor(act)
 scene=[];tracks={}
 g.setup(region,lod);g.generate_geometry()
 raw=(D/f'cavoru_{region}_{"LOD1_" if lod else ""}animated_v01.glb').read_bytes()
 jlen=struct.unpack_from('<I',raw,12)[0];gl=json.loads(raw[20:20+jlen]);offset=20+jlen
 bin_len=struct.unpack_from('<I',raw,offset)[0];blob=raw[offset+8:offset+8+bin_len]
 def acc(k):
  a=gl['accessors'][k];v=gl['bufferViews'][a['bufferView']]
  typ={'SCALAR':1,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]
  dtype={5121:'u1',5123:'<u2',5125:'<u4',5126:'<f4'}[a['componentType']]
  return np.frombuffer(blob,dtype=dtype,count=a['count']*typ,offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(a['count'],typ)
 for mat,data in g.G.items():
  base=np.asarray(data['vertices'],np.float64);ids=np.asarray(data['joints'],int);faces=np.asarray(data['faces'],np.int64)
  points=vtk.vtkPoints();points.SetData(ns.numpy_to_vtk(base.astype(np.float32),deep=1))
  poly=vtk.vtkPolyData();poly.SetPoints(points)
  cells=vtk.vtkCellArray();cells.SetCells(len(faces),ns.numpy_to_vtkIdTypeArray(np.column_stack([np.full(len(faces),3,dtype=np.int64),faces]).ravel(),deep=1));poly.SetPolys(cells)
  mapper=vtk.vtkPolyDataMapper();mapper.SetInputData(poly)
  actor=vtk.vtkActor();actor.SetMapper(mapper)
  actor.GetProperty().SetColor(*g.COLORS[region][mat]);actor.GetProperty().SetAmbient(.35);actor.GetProperty().SetDiffuse(.66)
  actor.GetProperty().SetInterpolationToGouraud();renderer.AddActor(actor)
  scene.append((base,ids,points,poly,actor))
 for a in gl['animations']:
  tr={}
  for c in a['channels']:
   s=a['samplers'][c['sampler']];tr[(c['target']['node'],c['target']['path'])]=(acc(s['input']).ravel(),acc(s['output']))
  tracks[a['name']]=tr


def interp(ts,values,t,path):
 if t<=ts[0]:return values[0]
 if t>=ts[-1]:return values[-1]
 i=int(np.searchsorted(ts,t,side='right')-1);u=(t-ts[i])/(ts[i+1]-ts[i]);aa=values[i];bb=values[i+1]
 if path=='rotation':
  if np.dot(aa,bb)<0:bb=-bb
  cosine=np.clip(np.dot(aa,bb),-1,1)
  if cosine<.9995:
   theta=np.arccos(cosine)
   return np.sin((1-u)*theta)/np.sin(theta)*aa+np.sin(u*theta)/np.sin(theta)*bb
 return aa*(1-u)+bb*u

def animate(clip,t):
 tr=tracks[clip];world={}
 for j,(name,parent,o) in enumerate(g.BONES):
  trans=g.OFF[name].copy();rot=np.array([0,0,0,1],float)
  for prop in ('translation','rotation'):
   if (j,prop) in tr:
    ts,vals=tr[(j,prop)];val=interp(ts,vals,t,prop)
    if prop=='translation':trans=val
    else:rot=val
  R=Rotation.from_quat(rot).as_matrix()
  if parent is not None:
   Pr,Px=world[g.BID[parent]];pos=Px+Pr@trans;R=Pr@R
  else:pos=trans
  world[j]=(R,pos)
 for original,ids,points,poly,actor in scene:
  arr=np.empty_like(original)
  for joint in np.unique(ids):
   mask=ids==joint;rot,pos=world[joint];bone=g.BONES[joint][0]
   arr[mask]=(original[mask]-g.REST[bone])@rot.T+pos
  points.SetData(ns.numpy_to_vtk(arr.astype(np.float32),deep=1));points.Modified();poly.Modified()

def shot(clip='idle',time=0):
 animate(clip,time);window.Render()
 filt=vtk.vtkWindowToImageFilter();filt.SetInput(window);filt.SetInputBufferTypeToRGB();filt.ReadFrontBufferOff();filt.Update()
 arr=ns.vtk_to_numpy(filt.GetOutput().GetPointData().GetScalars()).reshape(H,W,3)[::-1].copy()
 return Image.fromarray(arr)

if __name__=='__main__':
 for reg in ('forest','plains'):
  parse(reg);shot('idle',.4).save(D/f'cavoru_{reg}_preview.png',optimize=True);print('Rendered',reg,flush=True)
 # equal-width variant comparison
 frames=[]
 for reg,label in [('forest','CAVORU-DA-FLORESTA   ·   bosque temperado'),('plains','CAVORU-DAS-PLANÍCIES   ·   campos abertos')]:
  parse(reg);im=shot('idle',.5);frames.append((im,label))
 canvas=Image.new('RGB',(W*2,570),(21,30,25));d=ImageDraw.Draw(canvas)
 for k,(im,label) in enumerate(frames):
  canvas.paste(im,(W*k,0));d.rectangle((W*k,490,W*(k+1),570),fill=(24,32,25));d.text((W*k+26,509),label,font=title,fill=(237,213,159))
 canvas.save(D/'cavoru_variants_comparison.png',optimize=True)
 # contact sheet with 12 poses in consistent size
 poses=[('idle',.4),('walk',.38),('trot',.25),('short_sprint',.19),('graze',1.1),('sniff_ground',.9),('dig_shallow',1.15),('pull_tuber',.85),('chew',.7),('lookout',.8),('warning_call',.9),('rest',2.1)]
 parse('plains');sw,sh=430,375;contact=Image.new('RGB',(sw*4,sh*3),(21,30,26));d=ImageDraw.Draw(contact)
 for i,(name,t) in enumerate(poses):
  im=shot(name,t);im.thumbnail((sw,315))
  x=(i%4)*sw;y=(i//4)*sh
  contact.paste(im,(x+(sw-im.width)//2,y))
  d.rounded_rectangle((x+10,y+316,x+sw-10,y+365),radius=8,fill=(34,49,36))
  d.text((x+28,y+327),name,font=title,fill=(243,227,178));print('Pose',name,flush=True)
 contact.save(D/'cavoru_actions_contact_sheet.png',optimize=True)
 # one GIF and MP4 covering both ecotypes and representative actions, not a fake animation.
 selected=[('forest','walk',1.57,12),('forest','dig_shallow',3.5,16),('forest','graze',3.1,12),('plains','short_sprint',.67,12),('plains','warning_call',1.9,12),('plains','push_defense',1.45,12)]
 imgs=[]
 prev_reg=''
 for reg,clip,dur,count in selected:
  if reg!=prev_reg:parse(reg);prev_reg=reg
  for i in range(count):
   im=shot(clip,dur*i/(count-1)).resize((550,442))
   txt='Cavoru-da-Floresta' if reg=='forest' else 'Cavoru-das-Planícies'
   dr=ImageDraw.Draw(im)
   dr.rounded_rectangle((14,14,425,52),radius=8,fill=(19,31,24));dr.text((26,23),f'{txt} | {clip}',font=ft,fill=(248,230,187))
   imgs.append(im)
  print('Video',reg,clip,flush=True)
 imgs[0].save(D/'cavoru_animations_preview.gif',save_all=True,append_images=imgs[1:],duration=94,loop=0,optimize=False,disposal=2)
 # ffmpeg raw frames piped into encoder using temporary png sequence, no imagegen substitution
 tmp=D/'frames';tmp.mkdir(exist_ok=True)
 for i,im in enumerate(imgs):im.save(tmp/f'f_{i:04d}.png')
 proc=subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','error','-framerate','10','-i',str(tmp/'f_%04d.png'),'-c:v','libx264','-crf','22','-pix_fmt','yuv420p','-movflags','+faststart',str(D/'cavoru_preview_celular.mp4')],capture_output=True,text=True)
 print('MP4',proc.returncode,proc.stderr,flush=True)
 for p in tmp.glob('*.png'):p.unlink()
 tmp.rmdir()
