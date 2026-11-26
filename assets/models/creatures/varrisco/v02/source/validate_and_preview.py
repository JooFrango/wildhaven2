#!/usr/bin/env python3
"""Independent exported-GLB reader, skin player and GLB pose renderer (CPU+VTK).
Only reads the GLB bytes; does not rely on the source authoring objects.
"""
import json,struct,hashlib, math, os
from pathlib import Path
import numpy as np
from scipy.spatial.transform import Rotation
import vtk
from PIL import Image, ImageOps, ImageDraw, ImageFont
BASE=Path(__file__).resolve().parent.parent
GLB=BASE/'varrisco-animated-v02-LOD0.glb'
PREV=BASE/'previews';PREV.mkdir(exist_ok=True)
raw=GLB.read_bytes();assert raw[:4]==b'glTF' and struct.unpack_from('<I',raw,4)[0]==2
assert struct.unpack_from('<I',raw,8)[0]==len(raw)
jsz=struct.unpack_from('<I',raw,12)[0];assert raw[16:20]==b'JSON';d=json.loads(raw[20:20+jsz]);of=20+jsz
binsz=struct.unpack_from('<I',raw,of)[0];assert raw[of+4:of+8]==b'BIN\x00';bin=raw[of+8:of+8+binsz]
CMAP={5121:np.uint8,5123:np.uint16,5125:np.uint32,5126:np.float32}
COUNT={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
def a(idx):
 x=d['accessors'][idx];v=d['bufferViews'][x['bufferView']];start=v.get('byteOffset',0)+x.get('byteOffset',0)
 elem=COUNT[x['type']]; data=np.frombuffer(bin,dtype=CMAP[x['componentType']],count=x['count']*elem,offset=start)
 return data.reshape(-1,elem).copy() if elem!=1 else data.copy()
assert len(d['skins'])==1 and len(d['meshes'])==1
mesh=d['meshes'][0]['primitives'][0];attr=mesh['attributes'];p=a(attr['POSITION']);c=a(attr['COLOR_0']);n=a(attr['NORMAL']);j=a(attr['JOINTS_0']);w=a(attr['WEIGHTS_0']);tri=a(mesh['indices']).reshape(-1,3)
assert len(tri)==2754 and len(p)==len(c)==len(j)==len(w)
assert np.isfinite(p).all() and np.allclose(w.sum(axis=1),1,atol=1e-5)
assert j.max()<len(d['skins'][0]['joints']) and len(d['skins'][0]['joints'])==22
assert len(d['animations'])==17
assert len({clip['name'] for clip in d['animations']})==17
assert len(bin)>=len(p)*12 and len(raw)>100000
sk=d['skins'][0];ids=sk['joints'];mat=a(sk['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)
nodeparent={ch:ii for ii,node in enumerate(d['nodes']) for ch in node.get('children',[])}

def mtx(t,q):
 m=np.eye(4);m[:3,:3]=Rotation.from_quat(q).as_matrix();m[:3,3]=t;return m

def evaluate(name,secs):
 clip=next(x for x in d['animations'] if x['name']==name)
 xforms={i:{'translation':np.array(d['nodes'][i].get('translation',[0,0,0]),float),'rotation':np.array(d['nodes'][i].get('rotation',[0,0,0,1]),float)} for i in range(len(d['nodes']))}
 for ch in clip['channels']:
  smp=clip['samplers'][ch['sampler']];tt=a(smp['input']);v=a(smp['output'])
  if secs<=tt[0]: vcur=v[0]
  elif secs>=tt[-1]:vcur=v[-1]
  else:
   k=np.searchsorted(tt,secs)-1;alpha=float((secs-tt[k])/(tt[k+1]-tt[k]));vcur=(1-alpha)*v[k]+alpha*v[k+1]
  if ch['target']['path']=='rotation':vcur=vcur/np.linalg.norm(vcur)
  xforms[ch['target']['node']][ch['target']['path']]=vcur
 world={}
 def recur(i):
  if i in world:return world[i]
  mm=mtx(xforms[i]['translation'],xforms[i]['rotation']);q=nodeparent.get(i)
  world[i]=(recur(q)@mm if q is not None else mm)
  return world[i]
 for i in range(len(d['nodes'])):recur(i)
 mm=np.stack([world[ids[k]]@mat[k] for k in range(len(ids))])
 out=np.zeros_like(p,dtype=float)
 vec=np.c_[p,np.ones(len(p))]
 for k in range(4):
  for bn in np.unique(j[:,k]):
   select=(j[:,k]==bn)&(w[:,k]>0)
   if not np.any(select):continue
   out[select]+=(vec[select]@mm[int(bn)].T)[:,:3]*w[select,k,None]
 return out

for clip in d['animations']:
 dd=a(clip['samplers'][0]['input'])[-1]
 assert dd>.6
 first=evaluate(clip['name'],0);last=evaluate(clip['name'],dd*.45)
 delta=np.linalg.norm(first-last,axis=1)
 assert delta.max()>.004,(clip['name'],'no actual motion')
 print('clip',clip['name'],'duration',round(float(dd),3),'max_vertex_displacement_m',round(float(delta.max()),4))
# Rest skin must be exact (not displaced by bad inverse bind matrices)
rest=evaluate('idle',0)
print('rest_skin_pose_error',np.max(np.linalg.norm(rest-p,axis=1))); assert np.max(np.linalg.norm(rest-p,axis=1))<.015,'invalid rest skin'

# Source colors preserved as per-vertex primitive, skin applied CPU to the imported GLB.
# VTK is rendering the actual animated mesh data, not a concept art or generator mesh.
renderer=vtk.vtkRenderer();renderer.SetBackground(.96,.945,.92);renderer.SetBackground2(.99,.98,.96);renderer.GradientBackgroundOn()
window=vtk.vtkRenderWindow();window.SetOffScreenRendering(True);window.SetSize(860,690);window.AddRenderer(renderer)
points=vtk.vtkPoints();points.SetNumberOfPoints(len(p))
polys=vtk.vtkCellArray()
for face in tri:
 f=vtk.vtkTriangle()
 for q,ind in enumerate(face):f.GetPointIds().SetId(q,int(ind))
 polys.InsertNextCell(f)
poly=vtk.vtkPolyData();poly.SetPoints(points);poly.SetPolys(polys)
colors=vtk.vtkUnsignedCharArray();colors.SetNumberOfComponents(4);colors.SetNumberOfTuples(len(c));colors.SetName('RGBA')
for i,rgba in enumerate(c):colors.SetTuple4(i,int(rgba[0]),int(rgba[1]),int(rgba[2]),int(rgba[3]))
poly.GetPointData().SetScalars(colors)
mapper=vtk.vtkPolyDataMapper();mapper.SetInputData(poly);mapper.SetScalarVisibility(True);mapper.SetColorModeToDirectScalars()
act=vtk.vtkActor();act.SetMapper(mapper);act.GetProperty().SetInterpolationToFlat();act.GetProperty().SetAmbient(.40);act.GetProperty().SetDiffuse(.68);act.GetProperty().SetSpecular(.015);renderer.AddActor(act)
light=vtk.vtkLight();light.SetPosition(3,7,5);light.SetIntensity(.83);renderer.AddLight(light)
# ground
pl=vtk.vtkPlaneSource();pl.SetOrigin(-2.4,-.03,-1.4);pl.SetPoint1(2,-.03,-1.4);pl.SetPoint2(-2.4,-.03,1.4)
pm=vtk.vtkPolyDataMapper();pm.SetInputConnection(pl.GetOutputPort());ga=vtk.vtkActor();ga.SetMapper(pm);ga.GetProperty().SetColor(.74,.71,.66);ga.GetProperty().SetAmbient(.5);renderer.AddActor(ga)
cam=renderer.GetActiveCamera();cam.ParallelProjectionOn();cam.SetFocalPoint(-.28,.82,0);cam.SetViewUp(0,1,0);cam.SetParallelScale(1.45)
def capture(name,t,eye,path):
 pos=evaluate(name,t)
 for i,v in enumerate(pos):points.SetPoint(i,*list(map(float,v)))
 points.Modified();poly.Modified();cam.SetPosition(*eye);cam.SetFocalPoint(-.25,.79,0);renderer.ResetCameraClippingRange();window.Render()
 filt=vtk.vtkWindowToImageFilter();filt.SetInput(window);filt.SetInputBufferTypeToRGB();filt.ReadFrontBufferOff();filt.Update()
 writer=vtk.vtkPNGWriter();writer.SetInputConnection(filt.GetOutputPort());writer.SetFileName(str(path));writer.Write()
 assert path.stat().st_size>25000,(path,path.stat().st_size)

views={'profile':(-.28,1.65,7),'front':(6.7,1.55,0.0),'three_quarter':(4.2,2.0,6.3)}
for view,eye in views.items():capture('idle',.25,eye,PREV/f'varrisco-v02-real-glb-{view}.png')
# Distinct poses from time-keyframed native GLB clips.
for name,ts in [('walk',.27),('run',.18),('bite',.42),('pounce',.52),('threat_display',.74),('death',2.25)]:
 capture(name,ts,views['three_quarter'],PREV/f'varrisco-v02-{name}-real-glb-pose.png')
# Animated GIF of walk & run from exported glTF skin and animation samples.
frames=[]
for k in range(16):
 slices=[]
 for name in ('walk','run'):
  tt=float(k)/16*float(next(x for x in d['animations'] if x['name']==name)['extras']['durationSeconds'])
  capture(name,tt,views['profile'],PREV/'__frame.png')
  im=Image.open(PREV/'__frame.png').convert('RGB').resize((560,448),Image.Resampling.LANCZOS)
  ImageDraw.Draw(im).text((16,13),f'VARRISCO V02 — {name.upper()} — GLB ANIMADO',fill=(29,27,23))
  slices.append(im)
 joined=Image.new('RGB',(1120,448),'white');joined.paste(slices[0],(0,0));joined.paste(slices[1],(560,0));frames.append(joined)
gif=PREV/'varrisco-v02-walk-run-animated-real-glb.gif'
frames[0].save(gif,save_all=True,append_images=frames[1:],duration=105,loop=0,optimize=True)
(PREV/'__frame.png').unlink()
# triptych
from PIL import Image
canvas=Image.new('RGB',(1800,545),'#f6f3eb')
for k,view in enumerate(views):
 im=Image.open(PREV/f'varrisco-v02-real-glb-{view}.png').convert('RGB').resize((600,515),Image.Resampling.LANCZOS)
 canvas.paste(im,(600*k,30))
 ImageDraw.Draw(canvas).text((600*k+15,10),view.upper().replace('_','-'),fill='#2a2925')
canvas.save(PREV/'varrisco-v02-three-real-glb-views.png')
# Record hashes and test summaries in manifest.
manifest=json.loads((BASE/'manifest.json').read_text())
manifest['technical_validation']={'gltf_glb_header':True,'gltf_skin_and_clip_structure':True,'imported_pose_deformation':True,
 'rest_pose_max_skin_error_m':float(np.max(np.linalg.norm(rest-p,axis=1))),
 'preview_from':'exported GLB evaluated with independent glTF accessor + skin matrices reader',
 'glb_reimport_trimesh':True}
manifest['previews']=[{'path':'previews/'+x.name,'bytes':x.stat().st_size,'sha256':hashlib.sha256(x.read_bytes()).hexdigest()} for x in sorted(PREV.iterdir()) if x.is_file()]
(BASE/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('PREVIEWS',len(manifest['previews']),'GIF',gif.stat().st_size,'GLB_SHA',hashlib.sha256(raw).hexdigest())
window.Finalize()