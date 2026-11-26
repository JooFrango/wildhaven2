#!/usr/bin/env python3
"""Actual UV textured reimported glTF 2.0 renderer and animation playback checker.

Reads the BINARY output GLB, glTF JOINTS/WEIGHTS, inverse bind matrices and
animation samplers. Posed vertices are deformed by the exported rig; no render
from source pose generators. Uses VTK offscreen and 2048px PNG embedded in GLB.
"""
from __future__ import annotations
import argparse,hashlib,io,json,math,os,struct
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,ImageFont
from scipy.spatial.transform import Rotation,Slerp
import vtk
from vtk.util.numpy_support import numpy_to_vtk,numpy_to_vtkIdTypeArray

ROOT=Path(os.getenv('WILDHAVEN_V02_ROOT', str(Path(__file__).resolve().parents[1])))
FONT='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'

class Reader:
 def __init__(self,path):
  self.path=Path(path);blob=self.path.read_bytes();self.sha=hashlib.sha256(blob).hexdigest()
  assert blob[:4]==b'glTF' and struct.unpack_from('<I',blob,8)[0]==len(blob)
  length=struct.unpack_from('<I',blob,12)[0];self.obj=json.loads(blob[20:20+length]);offset=20+length
  assert blob[offset+4:offset+8]==b'BIN\0';length2=struct.unpack_from('<I',blob,offset)[0]
  self.bin=blob[offset+8:offset+8+length2]
  self.parent={j:i for i,n in enumerate(self.obj['nodes']) for j in n.get('children',[])}
  self.prim=self.obj['meshes'][0]['primitives'][0];a=self.prim['attributes']
  self.xyz=self.acc(a['POSITION']).astype('f4');self.norm=self.acc(a['NORMAL']).astype('f4')
  self.uv=self.acc(a['TEXCOORD_0']).astype('f4');self.joints=self.acc(a['JOINTS_0']).astype('int32');self.weights=self.acc(a['WEIGHTS_0']).astype('f4')
  self.faces=self.acc(self.prim['indices']).reshape(-1,3).astype('i8')
  imgview=self.obj['bufferViews'][self.obj['images'][0]['bufferView']]
  self.img=Image.open(io.BytesIO(self.bin[imgview['byteOffset']:imgview['byteOffset']+imgview['byteLength']])).convert('RGB')
  self.clips={a['name']:a for a in self.obj['animations']}
  self.ibm=self.acc(self.obj['skins'][0]['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)
  self.njoints=len(self.obj['skins'][0]['joints'])
  assert len(self.xyz)==len(self.uv)==len(self.weights)==len(self.joints)
  assert np.max(np.abs(self.weights.sum(axis=1)-1))<1e-5
 def acc(self,idx):
  a=self.obj['accessors'][idx];vw=self.obj['bufferViews'][a['bufferView']]
  elements={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]
  types={5126:'<f4',5121:'u1',5123:'<u2',5125:'<u4'}
  off=vw.get('byteOffset',0)+a.get('byteOffset',0)
  arr=np.frombuffer(self.bin,dtype=types[a['componentType']],offset=off,count=a['count']*elements).reshape(a['count'],elements).copy()
  return arr[:,0] if elements==1 else arr
 def posed(self,clip=None,t=0):
  values={}
  if clip:
   animation=self.clips[clip]
   for ch in animation['channels']:
    sample=animation['samplers'][ch['sampler']];times=self.acc(sample['input']);key=self.acc(sample['output'])
    target=ch['target'];mode=target['path'];ix=int(np.searchsorted(times,t))
    if ix<=0:value=key[0]
    elif ix>=len(times):value=key[-1]
    else:
     a,b=map(float,(times[ix-1],times[ix]));u=(t-a)/(b-a)
     if mode=='rotation':value=Slerp([0.,1.],Rotation.from_quat(key[[ix-1,ix]]))([u]).as_quat()[0]
     else:value=key[ix-1]*(1-u)+key[ix]*u
    values[target['node'],mode]=value
  cache={};nodes=self.obj['nodes']
  def matrix(ni):
   if ni in cache:return cache[ni]
   node=nodes[ni];tr=np.asarray(values.get((ni,'translation'),node.get('translation',[0,0,0])),float)
   rot=np.asarray(values.get((ni,'rotation'),node.get('rotation',[0,0,0,1])),float)
   scale=np.asarray(values.get((ni,'scale'),node.get('scale',[1,1,1])),float)
   mat=np.eye(4);mat[:3,:3]=Rotation.from_quat(rot).as_matrix()@np.diag(scale);mat[:3,3]=tr
   if ni in self.parent:mat=matrix(self.parent[ni])@mat
   cache[ni]=mat;return mat
  transforms=np.array([matrix(n)@self.ibm[j] for j,n in enumerate(self.obj['skins'][0]['joints'])])
  v=np.column_stack((self.xyz,np.ones(len(self.xyz))));out=np.zeros_like(self.xyz,dtype='f4')
  for k in range(4):
   wt=self.weights[:,k];mask=wt>1e-8
   if not np.any(mask):continue
   deformed=np.einsum('nij,nj->ni',transforms[self.joints[mask,k]],v[mask]);out[mask]+=deformed[:,:3]*wt[mask,None]
  return out

def make_scene(reader,width=850,height=560):
 renderer=vtk.vtkRenderer();renderer.SetBackground(.77,.75,.73);renderer.SetBackground2(.59,.57,.55);renderer.GradientBackgroundOn()
 win=vtk.vtkRenderWindow();win.SetOffScreenRendering(1);win.SetMultiSamples(0);win.SetSize(width,height);win.AddRenderer(renderer)
 pts=vtk.vtkPoints();pts.SetData(numpy_to_vtk(np.ascontiguousarray(reader.xyz),deep=True))
 faces=reader.faces;poly=vtk.vtkPolyData();poly.SetPoints(pts)
 cells=vtk.vtkCellArray();offs=np.arange(0,3*(len(faces)+1),3,dtype='i8')
 cells.SetData(numpy_to_vtkIdTypeArray(offs,deep=True),numpy_to_vtkIdTypeArray(faces.reshape(-1).astype('i8'),deep=True));poly.SetPolys(cells)
 uvar=numpy_to_vtk(reader.uv,deep=True);uvar.SetNumberOfComponents(2);uvar.SetName('TCoords');poly.GetPointData().SetTCoords(uvar)
 normals=numpy_to_vtk(reader.norm,deep=True);normals.SetName('Normals');poly.GetPointData().SetNormals(normals)
 mp=vtk.vtkPolyDataMapper();mp.SetInputData(poly);mp.ScalarVisibilityOff()
 actor=vtk.vtkActor();actor.SetMapper(mp);actor.GetProperty().SetInterpolationToFlat();actor.GetProperty().SetAmbient(.37);actor.GetProperty().SetDiffuse(.67);actor.GetProperty().SetSpecular(.03);actor.GetProperty().BackfaceCullingOff()
 img=reader.img
 importer=vtk.vtkImageImport();pix=np.flipud(np.asarray(img)).copy()
 importer.CopyImportVoidPointer(pix.tobytes(),pix.nbytes);importer.SetDataScalarTypeToUnsignedChar();importer.SetNumberOfScalarComponents(3)
 importer.SetDataExtent(0,img.width-1,0,img.height-1,0,0);importer.SetWholeExtent(0,img.width-1,0,img.height-1,0,0);importer.Update()
 texture=vtk.vtkTexture();texture.SetInputConnection(importer.GetOutputPort());texture.InterpolateOn();texture.RepeatOff();actor.SetTexture(texture);renderer.AddActor(actor)
 shadow_src=vtk.vtkSphereSource();shadow_src.SetThetaResolution(44);shadow_src.SetPhiResolution(22)
 smp=vtk.vtkPolyDataMapper();smp.SetInputConnection(shadow_src.GetOutputPort());shad=vtk.vtkActor();shad.SetMapper(smp)
 bounds=np.ptp(reader.xyz,axis=0);shad.SetScale(bounds[0]*.53,.001,bounds[2]*.56);shad.SetPosition(float(np.mean(reader.xyz[:,0])),.004,0)
 shad.GetProperty().SetColor(.27,.25,.23);shad.GetProperty().SetOpacity(.16);renderer.AddActor(shad)
 for location,power in [((2.4,3.1,3.3),1.03),((-2.5,2.4,-3),.63)]:
  lig=vtk.vtkLight();lig.SetPosition(*location);lig.SetFocalPoint(0,0,0);lig.SetIntensity(power);renderer.AddLight(lig)
 return renderer,win,pts,poly,importer,texture,actor

def take(renderer,win,r,angle='three-quarter'):
 bounds=np.ptp(r.xyz,axis=0);h=max(bounds[1],.17);w=max(bounds[0],bounds[2]);ctr=np.mean([r.xyz.min(axis=0),r.xyz.max(axis=0)],axis=0)
 camera=renderer.GetActiveCamera()
 if angle=='profile':cam=np.array([0,h*2.2,w*3.7]);scale=max(.23,w*.42)
 elif angle=='front':cam=np.array([w*3.7,h*2.2,w*.12]);scale=max(.22,bounds[2]*.76,h*.87)
 else:cam=np.array([w*2.45,h*2.7,w*2.6]);scale=max(.24,w*.47)
 camera.SetPosition(*(ctr+cam));camera.SetFocalPoint(*(ctr+[0,0,0]));camera.SetViewUp(0,1,0);camera.ParallelProjectionOn();camera.SetParallelScale(scale)
 renderer.ResetCameraClippingRange();win.Render()
 cap=vtk.vtkWindowToImageFilter();cap.SetInput(win);cap.SetInputBufferTypeToRGB();cap.ReadFrontBufferOn();cap.Update()
 from vtk.util.numpy_support import vtk_to_numpy
 output=cap.GetOutput();sz=output.GetDimensions();arr=vtk_to_numpy(output.GetPointData().GetScalars()).reshape(sz[1],sz[0],3)
 return Image.fromarray(np.flipud(arr).copy())

def label_image(im,sp,label,sha):
 i=im.copy();draw=ImageDraw.Draw(i);draw.rectangle((0,0,i.width,53),fill=(39,38,38))
 try:font=ImageFont.truetype(FONT,19);sm=ImageFont.truetype(FONT,12)
 except:font=None;sm=None
 draw.text((23,10),f'WILDHAVEN / {sp.upper()} v02 / {label.upper()}',font=font,fill=(240,218,181))
 draw.text((i.width-179,22),f'GLB {sha[:10]}...',font=sm,fill=(190,180,169))
 return i

def render_one(sp,gifs=True):
 path=ROOT/sp/'v02';r=Reader(path/f'{sp}-v02-animated-LOD0.glb');manfile=path/'manifest.json';m=json.loads(manfile.read_text())
 assert r.sha==m['glb']['sha256'] and r.njoints==26 and len(r.clips)==16
 assert np.max(np.abs(r.posed()-r.xyz))<3e-6
 out=path/'previews';out.mkdir(exist_ok=True)
 renderer,win,pts,poly,*remaining=make_scene(r,830,550)
 panels=[]
 for angle in ('profile','front','three-quarter'):
  img=label_image(take(renderer,win,r,angle),sp,angle,r.sha)
  dest=out/f'{sp}-v02-real-glb-{angle}.png';img.save(dest,compress_level=4);panels.append(img)
 contact=Image.new('RGB',(830*3,550),(45,44,43))
 for i,img in enumerate(panels):contact.paste(img,(i*830,0))
 contact.save(out/f'{sp}-v02-three-real-glb-views.png',compress_level=3)
 displacements={}
 for clip,meta in r.clips.items():
  d=meta['extras']['durationSeconds'];sample=[r.posed(clip,d*k/8) for k in range(9)]
  disp=max(float(np.linalg.norm(x-r.xyz,axis=1).max()) for x in sample)
  displacements[clip]=round(disp,5)
  assert disp>0.004, (sp,clip,disp)
 if gifs:
  for clip in ('walk',*m['defense_specials']):
   duration=r.clips[clip]['extras']['durationSeconds'];loop=r.clips[clip]['extras']['loop'];imgs=[]
   for k in range(12):
    t=duration*k/(12 if loop else 11)
    pos=r.posed(clip,t)
    pts.SetData(numpy_to_vtk(np.ascontiguousarray(pos),deep=True));pts.Modified();poly.Modified()
    imgs.append(label_image(take(renderer,win,r,'three-quarter'),sp,clip,r.sha))
   dest=out/f'{sp}-v02-{clip}-real-glb.gif';imgs[0].save(dest,save_all=True,append_images=imgs[1:],duration=110,loop=0,optimize=True,disposal=2)
   print('GIF',sp,clip,dest.stat().st_size,flush=True)
 m['glb_reimport_sha256']=r.sha;m['animation_playback_validation']={'reimport_sha256':r.sha,'rest_pose_max_error_m':float(np.max(np.abs(r.posed()-r.xyz))),
  'per_clip_vertex_movement_m':displacements,'method':'CPU linear blend skinning from exported GLB inverse bind matrices, keyframes, JOINTS_0 and WEIGHTS_0'}
 m['previews']={p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'source_glb_sha256':r.sha} for p in out.iterdir() if p.suffix.lower() in ('.png','.gif')}
 manfile.write_text(json.dumps(m,indent=2,ensure_ascii=False)+'\n')
 print('VALIDATED AND RENDERED',sp,len(m['previews']),'real previews',flush=True)
 win.Finalize()

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--species',nargs='+',choices=['caudraco','lajurim','cornevio','fossario'],default=['caudraco','lajurim','cornevio','fossario']);p.add_argument('--no-gif',action='store_true');args=p.parse_args()
 for sp in args.species:render_one(sp,gifs=not args.no_gif)
