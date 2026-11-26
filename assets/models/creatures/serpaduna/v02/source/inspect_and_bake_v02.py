#!/usr/bin/env python3
"""Independent CPU glTF 2.0 animation+skinning evaluator + screenshot generation.
Evaluates the ACTUAL v02 GLB bytes (not build internals), baked pose geometry is used for previews.
"""
from pathlib import Path
from io import BytesIO
import struct, json, hashlib, math, sys
import numpy as np
from scipy.spatial.transform import Rotation as R, Slerp
from PIL import Image,ImageDraw
import vtk
from vtk.util import numpy_support
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'previews';OUT.mkdir(exist_ok=True)
PATH=ROOT/'serpaduna_v02_rig_animated.glb'
b=PATH.read_bytes();assert struct.unpack_from('<III',b,0)==(0x46546c67,2,len(b))
p=12;chunks=[]
while p<len(b):
 l,typ=struct.unpack_from('<I4s',b,p);p+=8;chunks.append((typ,b[p:p+l]));p+=l
G=json.loads(next(x for k,x in chunks if k==b'JSON'));buf=next(x for k,x in chunks if k==b'BIN\0')
def accessor(ai):
 a=G['accessors'][ai];view=G['bufferViews'][a['bufferView']];types={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16};dt={5126:'<f4',5123:'<u2',5121:'u1',5125:'<u4'}[a['componentType']];c=types[a['type']]
 start=view.get('byteOffset',0)+a.get('byteOffset',0)
 stride=view.get('byteStride',np.dtype(dt).itemsize*c)
 if stride==np.dtype(dt).itemsize*c:
  z=np.frombuffer(buf,dtype=dt,offset=start,count=a['count']*c).reshape(-1,c).copy()
 else:
  z=np.array([np.frombuffer(buf,dtype=dt,offset=start+i*stride,count=c) for i in range(a['count'])])
 return z

M=np.eye(4)
def mat(t,quat):
 a=np.eye(4);a[:3,:3]=R.from_quat(quat).as_matrix();a[:3,3]=t;return a
rest={i:{'t':np.asarray(G['nodes'][i].get('translation',[0,0,0]),float),'q':np.asarray(G['nodes'][i].get('rotation',[0,0,0,1]),float)} for i in G['skins'][0]['joints']}
root=G['skins'][0]['skeleton'];names=[a['name'] for a in G['animations']]
ibms=accessor(G['skins'][0]['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)
joints=G['skins'][0]['joints']
assert len(joints)==72

def pose_anim(clip,t):
 anim=G['animations'][names.index(clip)]
 times_dict={}
 weights=np.zeros(4,dtype=np.float32)
 for ch in anim['channels']:
  samp=anim['samplers'][ch['sampler']];times=times_dict.setdefault(samp['input'],accessor(samp['input']).ravel());vals=accessor(samp['output'])
  node=ch['target']['node'];prop=ch['target']['path']
  k=min(max(0,np.searchsorted(times,t)-1),len(times)-2);fraction=float(np.clip((t-times[k])/(times[k+1]-times[k]),0.,1.))
  if prop=='weights':
   vals=vals.reshape(len(times),4);weights=(1-fraction)*vals[k]+fraction*vals[k+1];continue
  if prop=='rotation':
   qa,qb=vals[k],vals[k+1];dot=float(np.dot(qa,qb));qb=-qb if dot<0 else qb
   q=(1-fraction)*qa+fraction*qb;q=q/np.linalg.norm(q)
   rest[node]['animated_q']=q
  if prop=='translation':rest[node]['animated_t']=(1-fraction)*vals[k]+fraction*vals[k+1]
 world={}
 def dfs(j,parent):
  st=rest[j];m=parent @ mat(st.get('animated_t',st['t']),st.get('animated_q',st['q']))
  world[j]=m
  for child in G['nodes'][j].get('children',[]):
   if child in rest:dfs(child,m)
 dfs(root,np.eye(4))
 for st in rest.values():st.pop('animated_t',None);st.pop('animated_q',None)
 assert len(world)==72
 skin=np.stack([world[joints[i]]@ibms[i] for i in range(len(joints))])
 # meaningful real pose verification: each bone matrix must deform points
 geometries=[]
 for mi,me in enumerate(G['meshes']):
  prim=me['primitives'][0];attrs=prim['attributes']
  xyz=accessor(attrs['POSITION']).astype(np.float64)
  if mi==0:
   for k,tg in enumerate(prim.get('targets',[])):
    xyz+=float(weights[k])*accessor(tg['POSITION'])
  jj=accessor(attrs['JOINTS_0']).astype(int);ww=accessor(attrs['WEIGHTS_0']).astype(np.float64)
  pts4=np.column_stack([xyz,np.ones(len(xyz))])
  transformed=np.zeros((len(xyz),4))
  for ci in range(4):
   transformed+=ww[:,ci,None]*np.einsum('nij,nj->ni',skin[jj[:,ci]],pts4)
  geometries.append(transformed[:,:3])
 return geometries, weights, world

# Test glTF full-skin movement, along with vertex deformations: no animation-only metadata.
clip_times={'idle':(0.,2.1),'slither':(0.,1.0),'fast_slither':(0.,.6),
            'coil_defend':(0.,1.25),'alert':(0.,.7),'tongue_flick':(0.,.45),
            'ambush_strike':(.06,1.1),'venom_bite':(.06,.90),'swallow_whole':(.4,3.25),
            'rest':(0.,2.0),'death':(.06,2.8)}
metrics={}
for n,(t0,t1) in clip_times.items():
 p0,w0,j0=pose_anim(n,t0);p1,w1,j1=pose_anim(n,t1)
 disp=np.linalg.norm(p0[0]-p1[0],axis=1)
 jaw=np.linalg.norm(p0[2]-p1[2],axis=1)
 metrics[n]={'body_max_m':round(float(np.max(disp)),5),
             'body_mean_m':round(float(np.mean(disp)),5),
             'jaw_max_m':round(float(np.max(jaw)),5),
             'max_bolus_weight':round(float(np.max(w1)),4)}
print(json.dumps(metrics,indent=2))
(ROOT/'animation_test_metrics.json').write_text(json.dumps(metrics,indent=2),encoding='utf-8')

# Render real animated geometry from CPU glTF skinning; VTK GLTFImporter only listed clips.
# Use VTK shaded mesh, restoring per-mesh UV/color from the exported GLB itself.
ren=vtk.vtkRenderer();win=vtk.vtkRenderWindow();win.SetOffScreenRendering(1);win.SetSize(1050,740);win.SetMultiSamples(4);win.AddRenderer(ren)
ren.SetBackground(.103,.09,.075);ren.SetBackground2(.23,.196,.16);ren.GradientBackgroundOn()
ren.AutomaticLightCreationOff()
for pos,intensity,col in [((1,-6,9),1.15,(1.,.95,.86)),((-5,4,6),.67,(.82,.86,1.)),((4,5,3),.55,(.95,.86,.78))]:
 light=vtk.vtkLight();light.SetPosition(*pos);light.SetFocalPoint(0,0,0);light.SetIntensity(intensity);light.SetColor(*col);light.SetLightTypeToSceneLight();ren.AddLight(light)
actors=[];points=[]
for mi,me in enumerate(G['meshes']):
 prim=me['primitives'][0];att=prim['attributes'];pos=accessor(att['POSITION']);faces=accessor(prim['indices']).astype(np.int64).ravel().reshape(-1,3)
 poly=vtk.vtkPolyData();pts=vtk.vtkPoints();pts.SetData(numpy_support.numpy_to_vtk(pos.astype(np.float32),deep=True));poly.SetPoints(pts)
 cc=vtk.vtkCellArray();cc.SetCells(len(faces),numpy_support.numpy_to_vtkIdTypeArray(np.hstack([np.full((len(faces),1),3),faces]).astype(np.int64).ravel(),deep=True));poly.SetPolys(cc)
 if mi==0:
  uv=accessor(att['TEXCOORD_0']);uv[:,1]=1-uv[:,1]
  vc=numpy_support.numpy_to_vtk(uv.astype(np.float32),deep=True);vc.SetNumberOfComponents(2);poly.GetPointData().SetTCoords(vc)
 fn=vtk.vtkPolyDataNormals();fn.SetInputData(poly);fn.SetSplitting(True);fn.SetFeatureAngle(35)
 mapper=vtk.vtkPolyDataMapper();mapper.SetInputConnection(fn.GetOutputPort())
 actor=vtk.vtkActor();actor.SetMapper(mapper)
 if mi==0:
  imageview=G['images'][0]['bufferView'];bv=G['bufferViews'][imageview];bytes_png=buf[bv['byteOffset']:bv['byteOffset']+bv['byteLength']]
  image=Image.open(BytesIO(bytes_png)).convert('RGB')
  tmp=ROOT/'body_texture_embedded_v01.png';image.save(tmp)
  reader=vtk.vtkPNGReader();reader.SetFileName(str(tmp));reader.Update()
  t=vtk.vtkTexture();t.SetInputConnection(reader.GetOutputPort());t.InterpolateOn();actor.SetTexture(t)
 else:
  col=accessor(att['COLOR_0'])[0].astype(float)/255.
  actor.GetProperty().SetColor(*col[:3])
 actor.GetProperty().SetAmbient(.11);actor.GetProperty().SetDiffuse(.85);actor.GetProperty().SetSpecular(.04)
 ren.AddActor(actor);points.append((pts,fn));actors.append(actor)
cam=ren.GetActiveCamera();cam.ParallelProjectionOn();cam.SetPosition(-10,-11,5.6);cam.SetFocalPoint(0,0,1.15);cam.SetViewUp(0,0,1);cam.SetParallelScale(3.25)
wn=vtk.vtkWindowToImageFilter();wn.SetInput(win);wn.SetInputBufferTypeToRGB();wn.ReadFrontBufferOff()
def render(clip,t,out=None,pos=None):
 xyz,weights,_=pose_anim(clip,t)
 for (pts,fn),coord in zip(points,xyz):
  pts.SetData(numpy_support.numpy_to_vtk(coord.astype(np.float32),deep=True))
  pts.Modified();fn.Modified()
 if pos is not None:cam.SetPosition(*pos)
 ren.ResetCameraClippingRange();win.Render();wn.Modified();wn.Update()
 v=wn.GetOutput();arr=numpy_support.vtk_to_numpy(v.GetPointData().GetScalars());arr=arr.reshape(740,1050,3)[::-1]
 im=Image.fromarray(arr.copy(),'RGB')
 if out:im.save(OUT/out)
 return im
# 3 views from skinning evaluation at neutral pose
for name,pos in [('perfil',(0,-13,4.0)),('frente',(-12,-.3,3.25)),('tres_quartos',(-10,-11,5.6))]:
 render('idle',0.,f'serpaduna_v02_real_deformed_{name}.png',pos)
# multiple animated key poses
for name,t in [('slither',1.0),('ambush_strike',1.12),('venom_bite',.82),('swallow_whole',3.1),('death',2.8)]:
 render(name,t,f'pose_baked_{name}.png',(-10,-11,5.6))
# animated GIF frames are actual GLB joint/morph transform evaluations
for clip,dur in [('slither',4.),('venom_bite',1.8),('swallow_whole',7.)]:
 frames=[]
 for ts in np.linspace(0,dur,20,endpoint=False):
  a=render(clip,float(ts),None,(-10,-11,5.6)).resize((700,493))
  frames.append(a)
 frames[0].save(OUT/f'serpaduna_v02_{clip}_deformed_real.gif',save_all=True,append_images=frames[1:],duration=110,loop=0,optimize=True)
 print('GIF',clip)
# side-by-side overview
names=['perfil','frente','tres_quartos']
imgs=[Image.open(OUT/f'serpaduna_v02_real_deformed_{x}.png').resize((720,510)) for x in names]
canvas=Image.new('RGB',(2160,568),(27,23,20)); d=ImageDraw.Draw(canvas)
for i,(name,im) in enumerate(zip(names,imgs)):
 canvas.paste(im,(720*i,58));d.text((720*i+30,23),f'SERPÁDUNA v02 - {name.upper()} · GLB RIG REAL',fill=(233,208,159))
canvas.save(OUT/'serpaduna_v02_3_vistas_do_rig_real.png',optimize=True)
print('DONE',len(actors),'meshes')
win.Finalize()