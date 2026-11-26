#!/usr/bin/env python3
"""Render actual animated GLB skeleton keyframes (CPU skinning) using offscreen VTK."""
import math,struct,json,subprocess
from pathlib import Path
import numpy as np
import vtk
from vtk.util import numpy_support as ns
from scipy.spatial.transform import Rotation
from PIL import Image,ImageDraw,ImageFont
import generate_creatures as g
D=Path(__file__).resolve().parent
W,H=550,450
renderer=vtk.vtkRenderer();renderer.SetBackground(.058,.075,.068);renderer.SetBackground2(.20,.225,.19);renderer.GradientBackgroundOn();renderer.AutomaticLightCreationOff()
window=vtk.vtkRenderWindow();window.AddRenderer(renderer);window.SetSize(W,H);window.SetOffScreenRendering(True);window.SetMultiSamples(0)
for pos,intensity in [((-3,5,-4),1.4),((3,3,1),.85),((1,1,-5),.7)]:
 li=vtk.vtkLight();li.SetPosition(*pos);li.SetFocalPoint(0,.5,0);li.SetIntensity(intensity);renderer.AddLight(li)
cam=renderer.GetActiveCamera();cam.SetViewAngle(39)
FONT='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';ft=ImageFont.truetype(FONT,17);title=ImageFont.truetype(FONT,22)
scene=[];clips={};cfg=None

def parse(creature):
 global scene,clips,cfg
 for act,*_ in scene:renderer.RemoveActor(act)
 scene=[];clips={};cfg=g.Geometry(creature,0)
 g.carniroca_model(cfg) if creature=='carniroca' else g.tufrilo_model(cfg)
 p=D/f'{creature}_animated_v01.glb';raw=p.read_bytes();jl=struct.unpack_from('<I',raw,12)[0];gl=json.loads(raw[20:20+jl]);bp=20+jl
 ln=struct.unpack_from('<I',raw,bp)[0];blob=raw[bp+8:bp+8+ln]
 def acc(i):
  a=gl['accessors'][i];v=gl['bufferViews'][a['bufferView']];count={'SCALAR':1,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']];dtype={5123:'<u2',5125:'<u4',5126:'<f4'}[a['componentType']]
  return np.frombuffer(blob,dtype=dtype,count=a['count']*count,offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(a['count'],count)
 for mat,data in cfg.groups.items():
  points=vtk.vtkPoints();base=np.asarray(data['v'],np.float32);points.SetData(ns.numpy_to_vtk(base,deep=1))
  faces=np.asarray(data['f'],np.int64);ids=np.asarray(data['j'],np.int64)
  poly=vtk.vtkPolyData();poly.SetPoints(points);cells=vtk.vtkCellArray();cells.SetCells(len(faces),ns.numpy_to_vtkIdTypeArray(np.column_stack([np.full(len(faces),3,np.int64),faces]).ravel(),deep=1));poly.SetPolys(cells)
  mapper=vtk.vtkPolyDataMapper();mapper.SetInputData(poly)
  actor=vtk.vtkActor();actor.SetMapper(mapper);actor.GetProperty().SetColor(*cfg.materials[mat]);actor.GetProperty().SetAmbient(.38);actor.GetProperty().SetDiffuse(.65);renderer.AddActor(actor)
  scene.append((actor,base,ids,points,poly))
 for ani in gl['animations']:
  tracks={}
  for chan in ani['channels']:
   sm=ani['samplers'][chan['sampler']];tracks[(chan['target']['node'],chan['target']['path'])]=(acc(sm['input']).ravel(),acc(sm['output']))
  clips[ani['name']]=(tracks,ani['extras']['durationSeconds'])
 if creature=='carniroca':cam.SetPosition(2.5,1.65,-3.35);cam.SetFocalPoint(0,.70,0)
 else:cam.SetPosition(1.2,.87,-1.60);cam.SetFocalPoint(0,.32,0)
 cam.SetViewUp(0,1,0);renderer.ResetCameraClippingRange()

def interp(tt,val,time,path):
 if time<=tt[0]:return val[0]
 if time>=tt[-1]:return val[-1]
 i=int(np.searchsorted(tt,time,side='right')-1);u=(time-tt[i])/(tt[i+1]-tt[i]);a=val[i];b=val[i+1]
 if path=='rotation':
  if np.dot(a,b)<0:b=-b
  cosine=np.clip(np.dot(a,b),-1,1)
  if cosine<.9995:
   theta=np.arccos(cosine);return np.sin((1-u)*theta)/np.sin(theta)*a+np.sin(u*theta)/np.sin(theta)*b
 return a*(1-u)+b*u

def animate(name,time):
 tracks,duration=clips[name];time=min(time,duration);world={}
 for i,(bone,parent,_) in enumerate(cfg.bones):
  xyz=cfg.trans[bone].copy();q=np.array([0,0,0,1],float)
  for prop in ('translation','rotation'):
   if (i,prop) in tracks:
    ts,v=tracks[(i,prop)];v=interp(ts,v,time,prop)
    if prop=='translation':xyz=v
    else:q=v
  R=Rotation.from_quat(q).as_matrix()
  if parent is not None:
   pr,px=world[cfg.ids[parent]];xyz=px+pr@xyz;R=pr@R
  world[i]=(R,xyz)
 for actor,original,ids,points,poly in scene:
  result=np.empty_like(original)
  for bone_id in np.unique(ids):
   mask=ids==bone_id;bone=cfg.names[bone_id];R,xyz=world[bone_id];result[mask]=(original[mask]-cfg.rest[bone])@R.T+xyz
  points.SetData(ns.numpy_to_vtk(result.astype(np.float32),deep=1));points.Modified();poly.Modified()

def shot(name='idle',time=.3):
 if cfg.creature=='carniroca':
  cam.SetPosition(*((2.5,1.65,-3.35) if name in ('fly','glide','flap_hard','bank_left','bank_right','threaten','takeoff') else (1.72,1.34,-2.3)))
  renderer.ResetCameraClippingRange()
 animate(name,time);window.Render();filt=vtk.vtkWindowToImageFilter();filt.SetInput(window);filt.SetInputBufferTypeToRGB();filt.ReadFrontBufferOff();filt.Update()
 arr=ns.vtk_to_numpy(filt.GetOutput().GetPointData().GetScalars()).reshape(H,W,3)[::-1].copy()
 return Image.fromarray(arr)

def produce():
 stills=[]
 for species,label in [('carniroca','CARNIROCA  ·  necrófago alado'),('tufrilo','TUFRILO  ·  pequeno herbívoro')]:
  parse(species);im=shot('idle',.6);im.save(D/f'{species}_preview.png',optimize=True);stills.append((im,label))
  print('Preview',species,flush=True)
 combined=Image.new('RGB',(W*2,H+70),(21,29,25));p=ImageDraw.Draw(combined)
 for i,(im,label) in enumerate(stills):
  x=i*W;combined.paste(im,(x,0));p.rectangle((x,H,x+W,H+70),fill=(22,32,25));p.text((x+24,H+20),label,font=title,fill=(246,219,158))
 combined.save(D/'carniroca_tufrilo_comparison.png',optimize=True)
 poses=[('carniroca','idle',.5),('carniroca','walk',.5),('carniroca','fly',.42),('carniroca','glide',1.2),('carniroca','peck_carrion',.9),('carniroca','threaten',.65),('tufrilo','idle',.7),('tufrilo','hop',.18),('tufrilo','sprint',.27),('tufrilo','nibble',.55),('tufrilo','dig',.68),('tufrilo','alert_call',.85)]
 sw,sh=365,320;contact=Image.new('RGB',(sw*4,sh*3),(20,30,26));dr=ImageDraw.Draw(contact)
 prev=''
 for i,(name,clip,time) in enumerate(poses):
  if name!=prev:parse(name);prev=name
  img=shot(clip,time);img.thumbnail((sw-10,sh-52));x=i%4*sw;y=i//4*sh
  contact.paste(img,(x+(sw-img.width)//2,y));dr.rounded_rectangle((x+11,y+264,x+sw-11,y+310),radius=8,fill=(32,45,35));dr.text((x+21,y+271),clip+' · '+name[:4],font=ft,fill=(240,224,180))
 contact.save(D/'actions_contact_sheet.png',optimize=True);print('Contact sheet',flush=True)
 selected=[('carniroca','walk',12),('carniroca','fly',16),('carniroca','peck_carrion',14),('tufrilo','hop',12),('tufrilo','dig',14),('tufrilo','alert_call',12)]
 imgs=[];prev=''
 for species,clip,n in selected:
  if species!=prev:parse(species);prev=species
  dur=clips[clip][1]
  for k in range(n):
   img=shot(clip,float(dur*k/(n-1))).resize((440,360));d=ImageDraw.Draw(img)
   d.rounded_rectangle((10,10,420,42),radius=7,fill=(20,30,25));d.text((19,17),f'{species.upper()}  ·  {clip}',font=ft,fill=(252,230,185));imgs.append(img)
  print('Animated',species,clip,flush=True)
 # reduced gif palette for size
 imgs=[im.quantize(colors=128,method=Image.Quantize.FASTOCTREE) for im in imgs]
 imgs[0].save(D/'creatures_animations_preview.gif',save_all=True,append_images=imgs[1:],duration=110,loop=0,disposal=2,optimize=False)
 print('GIF done',flush=True)
 tmp=D/'frames';tmp.mkdir(exist_ok=True)
 for i,img in enumerate(imgs):img.convert('RGB').save(tmp/f'f_{i:04d}.png')
 run=subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','error','-framerate','9','-i',str(tmp/'f_%04d.png'),'-c:v','libx264','-crf','24','-pix_fmt','yuv420p','-movflags','+faststart',str(D/'creatures_preview_mobile.mp4')],capture_output=True,text=True)
 print('MP4',run.returncode,run.stderr[:300],flush=True)
 for p in tmp.iterdir():p.unlink()
 tmp.rmdir()
if __name__=='__main__':produce()
