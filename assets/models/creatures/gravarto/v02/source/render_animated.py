#!/usr/bin/env python3
"""Playback-proof renderer for Gravarto v02 using the actual *exported* GLB.

All animation frames are reconstructed from the glTF accessors, keyframes,
quaternions, skin joints and inverse-bind matrices, never from source poses.
The 2048x2048 painted PNG is decoded from the same GLB's image bufferView.
VTK renders posed textured 3D geometry, GIF frames are not synthetic artwork.
"""
from __future__ import annotations
from pathlib import Path
import hashlib, io, json, math, struct
import numpy as np
from scipy.spatial.transform import Rotation,Slerp
from PIL import Image,ImageDraw
import vtk
from vtk.util.numpy_support import numpy_to_vtk,numpy_to_vtkIdTypeArray

ROOT=Path(__file__).resolve().parent.parent
GLB=ROOT/'gravarto-v02-animated-LOD0.glb'
PRE=ROOT/'previews';PRE.mkdir(exist_ok=True)

class Reader:
 def __init__(self,path=GLB):
  self.file=path
  self.bytes=path.read_bytes();b=self.bytes
  assert b[:4]==b'glTF' and struct.unpack_from('<I',b,8)[0]==len(b)
  self.sha=hashlib.sha256(b).hexdigest()
  n=struct.unpack_from('<I',b,12)[0]
  self.obj=json.loads(b[20:20+n]);j=20+n
  assert b[j+4:j+8]==b'BIN\0'
  self.buf=b[j+8:j+8+struct.unpack_from('<I',b,j)[0]]
  self.parent={child:i for i,node in enumerate(self.obj['nodes']) for child in node.get('children',[])}
  self.prim=self.obj['meshes'][0]['primitives'][0]
  att=self.prim['attributes'];self.pos=self.acc(att['POSITION']).astype('f4')
  self.uv=self.acc(att['TEXCOORD_0']).astype('f4')
  self.norm=self.acc(att['NORMAL']).astype('f4')
  self.joints=self.acc(att['JOINTS_0']).astype('int32')
  self.weights=self.acc(att['WEIGHTS_0']).astype('f4')
  self.faces=self.acc(self.prim['indices']).reshape(-1,3).astype('int64')
  iv=self.obj['images'][0]['bufferView'];view=self.obj['bufferViews'][iv];start=view.get('byteOffset',0)
  self.texture=Image.open(io.BytesIO(self.buf[start:start+view['byteLength']])).convert('RGBA')
 def acc(self,i):
  a=self.obj['accessors'][i];view=self.obj['bufferViews'][a['bufferView']]
  typ={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]
  typemap={5126:'<f4',5121:'u1',5123:'<u2',5125:'<u4'}
  off=view.get('byteOffset',0)+a.get('byteOffset',0)
  ret=np.frombuffer(self.buf,dtype=typemap[a['componentType']],offset=off,count=a['count']*typ).reshape(-1,typ).copy()
  if a.get('normalized',False):ret=ret.astype('f4')/(255. if a['componentType']==5121 else 65535.)
  return ret[:,0] if typ==1 else ret
 def clips(self):return {x['name']:x for x in self.obj['animations']}
 def posed(self,name,t):
  clip=self.clips().get(name) if name else None
  values={}
  if clip:
   for channel in clip['channels']:
    s=clip['samplers'][channel['sampler']]
    times=self.acc(s['input']);keyframes=self.acc(s['output'])
    target=channel['target'];mode=target['path']
    k=int(np.searchsorted(times,t))
    if k<=0:val=keyframes[0]
    elif k>=len(times):val=keyframes[-1]
    else:
     a,b=float(times[k-1]),float(times[k]);u=(t-a)/(b-a)
     if mode=='rotation':
      val=Slerp([0.,1.],Rotation.from_quat(keyframes[[k-1,k]]))([u]).as_quat()[0]
     else: val=(1-u)*keyframes[k-1]+u*keyframes[k]
    values[(target['node'],mode)]=val
  nodes=self.obj['nodes'];matcache={}
  def matrix(node_index):
   if node_index in matcache:return matcache[node_index]
   node=nodes[node_index]
   trans=values.get((node_index,'translation'),node.get('translation',[0,0,0]))
   rot=values.get((node_index,'rotation'),node.get('rotation',[0,0,0,1]))
   m=np.eye(4,dtype=float);m[:3,:3]=Rotation.from_quat(rot).as_matrix();m[:3,3]=trans
   if node_index in self.parent:m=matrix(self.parent[node_index])@m
   matcache[node_index]=m
   return m
  skin=self.obj['skins'][0]
  inv=self.acc(skin['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)
  mats=np.array([matrix(node)@inv[i] for i,node in enumerate(skin['joints'])])
  v=np.column_stack((self.pos,np.ones(len(self.pos))))
  out=np.zeros((len(v),3),dtype='f4')
  for slot in range(4):
   wt=self.weights[:,slot];mask=wt>1e-8
   if not np.any(mask):continue
   result=np.einsum('nij,nj->ni',mats[self.joints[mask,slot]],v[mask])
   out[mask]+=result[:,:3]*wt[mask,None]
  return out

def make_scene(r,width=900,height=620):
 ren=vtk.vtkRenderer();ren.SetBackground(.69,.71,.75);ren.SetBackground2(.91,.92,.92);ren.GradientBackgroundOn()
 win=vtk.vtkRenderWindow();win.SetOffScreenRendering(1);win.SetMultiSamples(0);win.SetSize(width,height);win.AddRenderer(ren)
 floor=vtk.vtkPlaneSource();floor.SetOrigin(-5,-.047,-4);floor.SetPoint1(5,-.047,-4);floor.SetPoint2(-5,-.047,4)
 mp=vtk.vtkPolyDataMapper();mp.SetInputConnection(floor.GetOutputPort());actor=vtk.vtkActor();actor.SetMapper(mp)
 actor.GetProperty().SetColor(.48,.47,.45);actor.GetProperty().SetDiffuse(.6);actor.GetProperty().SetAmbient(.45);ren.AddActor(actor)
 for p,power in [((3,7,6),1.1),((-4,4,4),.65),((1,7,-6),.6)]:
  l=vtk.vtkLight();l.SetLightTypeToSceneLight();l.SetPosition(*p);l.SetFocalPoint(-.4,.7,0);l.SetIntensity(power);ren.AddLight(l)
 points=vtk.vtkPoints();points.SetData(numpy_to_vtk(r.pos,deep=True))
 polys=vtk.vtkCellArray();offs=np.arange(0,(len(r.faces)+1)*3,3,dtype=np.int64)
 polys.SetData(numpy_to_vtkIdTypeArray(offs,deep=True),numpy_to_vtkIdTypeArray(r.faces.reshape(-1).astype(np.int64),deep=True))
 poly=vtk.vtkPolyData();poly.SetPoints(points);poly.SetPolys(polys)
 uv=numpy_to_vtk(r.uv,deep=True);uv.SetName('UV');poly.GetPointData().SetTCoords(uv)
 normal=numpy_to_vtk(r.norm,deep=True);normal.SetName('Normals');poly.GetPointData().SetNormals(normal)
 mapper=vtk.vtkPolyDataMapper();mapper.SetInputData(poly)
 model=vtk.vtkActor();model.SetMapper(mapper)
 model.GetProperty().SetAmbient(.25);model.GetProperty().SetDiffuse(.75);model.GetProperty().SetSpecular(.02)
 model.GetProperty().SetInterpolationToFlat();model.GetProperty().BackfaceCullingOff()
 # vtkPNGReader maintains the correct UV orientation of the original GLB.
 atlas=ROOT/'rendered_texture_reimported.png';r.texture.save(atlas)
 read=vtk.vtkPNGReader();read.SetFileName(str(atlas));read.Update()
 vt=vtk.vtkTexture();vt.SetInputConnection(read.GetOutputPort());vt.InterpolateOn();vt.RepeatOn();model.SetTexture(vt)
 ren.AddActor(model)
 cam=ren.GetActiveCamera();cam.SetPosition(6.2,3.0,8.0);cam.SetFocalPoint(-.55,.75,0);cam.SetViewUp(0,1,0)
 cam.SetParallelProjection(True);cam.SetParallelScale(2.03);ren.ResetCameraClippingRange()
 return ren,win,points,poly

def capture(win):
 win.Render();w=vtk.vtkWindowToImageFilter();w.SetInput(win);w.SetInputBufferTypeToRGB();w.ReadFrontBufferOn();w.Update()
 writer=vtk.vtkPNGWriter();writer.WriteToMemoryOn();writer.SetInputConnection(w.GetOutputPort());writer.Write()
 return Image.open(io.BytesIO(memoryview(writer.GetResult()).tobytes())).convert('RGB')

def generate_gif(r,clip,frames=16):
 ren,win,points,poly=make_scene(r)
 duration=float(r.clips()[clip]['extras']['durationSeconds'])
 looping=bool(r.clips()[clip]['extras']['loop'])
 images=[]
 for k in range(frames):
  t=duration*k/(frames if looping else frames-1)
  posed=r.posed(clip,t)
  points.SetData(numpy_to_vtk(np.ascontiguousarray(posed),deep=True))
  points.Modified();poly.Modified()
  img=capture(win)
  d=ImageDraw.Draw(img);d.rectangle((14,12,340,50),fill=(37,38,39))
  d.text((28,22),f'GRAVARTO v02    /    {clip.upper()}',fill=(239,228,210))
  images.append(img)
 path=PRE/f'gravarto-v02-{clip}-real-skinned-glb.gif'
 images[0].save(path,save_all=True,append_images=images[1:],duration=110 if clip!='short_sprint' else 75,
                optimize=True,loop=0,disposal=2)
 print('Real animated',path.name,path.stat().st_size,flush=True)
 return path

def main():
 r=Reader();err=np.max(np.abs(r.posed(None,0)-r.pos));assert err<5e-5,err
 print('Rest pose inverseBindMatrices:',err,'GLB sha256',r.sha,flush=True)
 dynamic={}
 for clip in r.clips():
  dur=float(r.clips()[clip]['extras']['durationSeconds'])
  samples=[r.posed(clip,dur*(i/8)) for i in range(9)]
  motion=max(float(np.max(np.linalg.norm(s-r.pos,axis=1))) for s in samples)
  if motion<.01:raise RuntimeError(f'Animation too static {clip} {motion}')
  dynamic[clip]=round(motion,4)
 print('All 17 GLB clips have measurable vertex motion:',dynamic,flush=True)
 for clip in ('walk','short_sprint','bite','tail_sweep'):
  generate_gif(r,clip,frames=14)
 manifest_path=ROOT/'manifest.json';m=json.loads(manifest_path.read_text())
 m['animation_playback_validation']={'reimported_glb_sha256':r.sha,'rest_bind_max_error_m':float(err),
  'per_clip_max_vertex_displacement_m':dynamic,'method':'CPU LBS on reimported glTF skin weights, animation keyframes and inverse bind matrices',
  'renderer':'VTK 3D mesh with UV PNG decoded from exported GLB; no source-pose substitution'}
 m['previews']={p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
    for p in sorted(PRE.iterdir()) if p.suffix.lower() in ('.png','.gif') and not p.name.startswith('vtk_trot')}
 (ROOT/'manifest.json').write_text(json.dumps(m,indent=2,ensure_ascii=False)+'\n')
 print('Previews done!',flush=True)
if __name__=='__main__':main()
