#!/usr/bin/env python3
"""Real preview renderer: import final exported glTF/GLB and evaluate skinned animations.

Profile/front/three-quarter are captured by vtkGLTFImporter directly. Animated
frames are generated from the exported GLB's animation samplers, inverse bind
matrices, normalized JOINTS_0/WEIGHTS_0 and indexed skin mesh, then rendered with
VTK. No generator-pose substitution, no generated still illustration as GIF.
"""
from __future__ import annotations
import hashlib, io, json, math, struct
from pathlib import Path
import numpy as np
from scipy.spatial.transform import Rotation, Slerp
from PIL import Image, ImageDraw, ImageFont
import vtk
HERE=Path(__file__).resolve().parent
ROOT=HERE.parent
GLB=ROOT/'varrisco-animated-v02-LOD0.glb'
PREV=ROOT/'previews'
PREV.mkdir(exist_ok=True,parents=True)

class GLBReader:
 def __init__(self,path):
  self.path=path
  b=path.read_bytes()
  assert b[:4]==b'glTF' and struct.unpack_from('<I',b,8)[0]==len(b)
  jlen=struct.unpack_from('<I',b,12)[0]
  self.data=json.loads(b[20:20+jlen]); off=20+jlen
  binlength=struct.unpack_from('<I',b,off)[0]
  assert b[off+4:off+8]==b'BIN\0'
  self.raw=b[off+8:off+8+binlength]
 def a(self,index):
  a=self.data['accessors'][index];view=self.data['bufferViews'][a['bufferView']]
  ncomp={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]
  dtype={5126:'<f4',5121:'u1',5123:'<u2',5125:'<u4',5122:'<i2'}[a['componentType']]
  pos=view.get('byteOffset',0)+a.get('byteOffset',0)
  out=np.frombuffer(self.raw,dtype=dtype,count=a['count']*ncomp,offset=pos).reshape(a['count'],ncomp).copy()
  if a.get('normalized',False):
   out=out.astype(np.float32)/({5121:255,5123:65535}[a['componentType']])
  return out[:,0] if ncomp==1 else out
 def mesh(self):
  p=self.data['meshes'][0]['primitives'][0]
  att=p['attributes'];return (self.a(att['POSITION']),self.a(att['COLOR_0']),
    self.a(att['JOINTS_0']).astype('int32'),self.a(att['WEIGHTS_0']),
    self.a(p['indices']).reshape(-1,3))
 def sample(self,clip_name,t):
  clip=next(c for c in self.data['animations'] if c['name']==clip_name)
  override={}
  for channel in clip['channels']:
   smp=clip['samplers'][channel['sampler']]; tt=self.a(smp['input']); vv=self.a(smp['output'])
   if t<=tt[0]:value=vv[0]
   elif t>=tt[-1]:value=vv[-1]
   else:
    idx=int(np.searchsorted(tt,t)); t0,t1=tt[idx-1],tt[idx]; alpha=float((t-t0)/(t1-t0))
    if channel['target']['path']=='rotation':
     slerp=Slerp([0,1],Rotation.from_quat(vv[[idx-1,idx],:]))
     value=slerp([alpha]).as_quat()[0]
    else:value=vv[idx-1]*(1-alpha)+vv[idx]*alpha
   override[(channel['target']['node'],channel['target']['path'])]=value
  nodes=self.data['nodes'];globs=[None]*len(nodes)
  def matrix(idx):
   node=nodes[idx]
   t=np.asarray(override.get((idx,'translation'),node.get('translation',[0,0,0])),float)
   q=np.asarray(override.get((idx,'rotation'),node.get('rotation',[0,0,0,1])),float)
   mat=np.eye(4);mat[:3,:3]=Rotation.from_quat(q).as_matrix();mat[:3,3]=t
   return mat
  parent={c:i for i,n in enumerate(nodes) for c in n.get('children',[])}
  def globalmat(idx):
   if globs[idx] is None:
    globs[idx]=matrix(idx) if idx not in parent else globalmat(parent[idx])@matrix(idx)
   return globs[idx]
  skin=self.data['skins'][0];ibms=self.a(skin['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)
  matrices=np.array([globalmat(j)@ibms[k] for k,j in enumerate(skin['joints'])])
  verts,rgba,joints,weights,faces=self.mesh()
  points=np.concatenate((verts,np.ones((len(verts),1))),axis=1)
  posed=np.zeros_like(verts)
  # Evaluate LBS from actual glTF inverse-bind matrices + animation, not v01 source.
  for slot in range(4):
   ws=weights[:,slot]
   for joint in np.unique(joints[ws>1e-8,slot]):
    mask=(joints[:,slot]==joint) & (ws>1e-8)
    transformed=(points[mask]@matrices[joint].T)[:,:3]
    posed[mask]+=transformed*ws[mask,None]
  return posed,rgba,faces

def studio(width=960,height=720):
 renderer=vtk.vtkRenderer();renderer.SetBackground(.82,.84,.86)
 renderer.SetBackground2(.94,.94,.93);renderer.GradientBackgroundOn()
 win=vtk.vtkRenderWindow();win.SetOffScreenRendering(1);win.SetSize(width,height)
 win.SetMultiSamples(0);win.AddRenderer(renderer)
 # Floor plane for positional cues, not part of GLB mesh.
 floor=vtk.vtkPlaneSource();floor.SetOrigin(-4,-.012,-3);floor.SetPoint1(4,-.012,-3);floor.SetPoint2(-4,-.012,3)
 mp=vtk.vtkPolyDataMapper();mp.SetInputConnection(floor.GetOutputPort())
 actor=vtk.vtkActor();actor.SetMapper(mp)
 actor.GetProperty().SetColor(.74,.715,.68);actor.GetProperty().SetDiffuse(.7)
 actor.GetProperty().SetSpecular(.0);renderer.AddActor(actor)
 for pos,intensity in [((2,7,7),1.),((-5,4,4),.4),((1,5,-7),.44)]:
  light=vtk.vtkLight();light.SetLightTypeToSceneLight();light.SetPosition(*pos)
  light.SetFocalPoint(-.25,.65,0);light.SetIntensity(intensity);renderer.AddLight(light)
 return renderer,win

def update_camera(renderer,view='three-quarter'):
 cam=renderer.GetActiveCamera();views={
  'profile':((-0.22,1.35,7.8),(-.20,.73,0),1.35),
  'front':((7.7,1.3,0),(-.15,.76,0),1.2),
  'three-quarter':((4.8,2.7,6.7),(-.23,.75,0),1.35)}
 a,b,scale=views[view];cam.SetPosition(*a);cam.SetFocalPoint(*b)
 cam.SetParallelProjection(True);cam.SetParallelScale(scale);cam.SetViewUp(0,1,0)
 renderer.ResetCameraClippingRange()

def capture(win):
 win.Render();flt=vtk.vtkWindowToImageFilter();flt.SetInput(win)
 flt.SetInputBufferTypeToRGB();flt.ReadFrontBufferOn();flt.Update()
 writer=vtk.vtkPNGWriter();writer.WriteToMemoryOn();writer.SetInputConnection(flt.GetOutputPort());writer.Write()
 encoded=memoryview(writer.GetResult()).tobytes()
 return Image.open(io.BytesIO(encoded)).convert('RGB')

def mesh_actor(vertices,colors,faces):
 points=vtk.vtkPoints();points.SetDataTypeToFloat()
 points.SetNumberOfPoints(len(vertices))
 for i,p in enumerate(vertices):points.SetPoint(i,*[float(x) for x in p])
 arr=vtk.vtkCellArray()
 for face in faces:
  tri=vtk.vtkTriangle()
  for j,x in enumerate(face):tri.GetPointIds().SetId(j,int(x))
  arr.InsertNextCell(tri)
 poly=vtk.vtkPolyData();poly.SetPoints(points);poly.SetPolys(arr)
 rgb=vtk.vtkUnsignedCharArray();rgb.SetNumberOfComponents(3);rgb.SetName('Colors')
 for c in colors:
  r,g,b=np.asarray(c[:3],float)
  if max(r,g,b)<=1.0:r,g,b=r*255,g*255,b*255
  rgb.InsertNextTuple3(int(r),int(g),int(b))
 poly.GetPointData().SetScalars(rgb)
 n=vtk.vtkPolyDataNormals();n.SetInputData(poly);n.SplittingOn();n.ConsistencyOff();n.AutoOrientNormalsOff();n.Update()
 mapper=vtk.vtkPolyDataMapper();mapper.SetInputConnection(n.GetOutputPort())
 mapper.SetColorModeToDirectScalars();mapper.SetScalarModeToUsePointData()
 actor=vtk.vtkActor();actor.SetMapper(mapper)
 actor.GetProperty().SetAmbient(.29);actor.GetProperty().SetDiffuse(.65)
 actor.GetProperty().SetInterpolationToFlat()
 actor.GetProperty().SetSpecular(.03)
 return actor,points

def still_views(reader):
 renderer,win=studio(1280,920)
 importer=vtk.vtkGLTFImporter();importer.SetFileName(str(GLB));importer.SetRenderWindow(win)
 importer.Update()
 assert renderer.GetActors().GetNumberOfItems()>=1
 result=[]
 for view in ('profile','front','three-quarter'):
  update_camera(renderer,view);img=capture(win)
  path=PREV/f'varrisco-v02-real-glb-{view}.png';img.save(path,optimize=True)
  result.append((view,img,path))
  print('Real GLB imported still',view,path.stat().st_size)
 canvas=Image.new('RGB',(1280*3,960),'#e8e6de')
 draw=ImageDraw.Draw(canvas)
 for k,(name,img,path) in enumerate(result):
  canvas.paste(img,(k*1280,0));draw.text((k*1280+24,922),name.upper(),fill='#242424')
 canvas.save(PREV/'Varrisco_v02_Three_Real_GLB_Views.png',optimize=True)

def frame_gif(reader,clip,view,frames=16,width=720,height=540):
 renderer,win=studio(width,height);update_camera(renderer,view)
 base_pos,rgba,_,_,face=reader.mesh()
 actor,points=mesh_actor(base_pos,rgba,face);renderer.AddActor(actor)
 duration=next((clipdur for c,(clipdur,_) in CLIPS.items() if c==clip),None)
 if duration is None:
  duration=next(a['extras']['durationSec'] for a in reader.data['animations'] if a['name']==clip)
 # Playback exactly from exported GLB's embedded samplers.
 seq=[]
 for fi in range(frames):
  t=duration * fi/(frames-1 if clip not in ('run','walk','idle','stalk') else frames)
  pos,_,_=reader.sample(clip,t)
  for i,p in enumerate(pos):points.SetPoint(i,float(p[0]),float(p[1]),float(p[2]))
  points.Modified();actor.GetMapper().GetInput().Modified()
  img=capture(win)
  draw=ImageDraw.Draw(img); draw.rectangle((8,8,235,40),fill=(35,38,38))
  draw.text((16,18),f'VARRISCO v02  /  {clip}',fill=(240,235,222))
  seq.append(img)
 return seq

# imported here for optional GIF generation, relying on embedded clip durations
try:
 from build_animated import CLIPS
except Exception:
 CLIPS={}


def main():
 reader=GLBReader(GLB);still_views(reader)
 for clip,view in (('run','three-quarter'),('bite','profile'),('pounce','three-quarter')):
  frames=frame_gif(reader,clip,view,frames=16,width=720,height=540)
  path=PREV/f'varrisco-v02-{clip}-real-glb.gif'
  frames[0].save(path,save_all=True,append_images=frames[1:],duration=85 if clip=='run' else 110,
                loop=0,optimize=True,disposal=2)
  print('Real skinned GLB animated GIF',path.name,path.stat().st_size)
 manifest_path=ROOT/'manifest.json';m=json.loads(manifest_path.read_text(encoding='utf8'))
 m['realGltfPreviews']={p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
     for p in sorted(PREV.iterdir()) if p.suffix.lower() in ('.png','.gif')}
 m['renderedGlbSha256']=hashlib.sha256(GLB.read_bytes()).hexdigest()
 m['previewMethod']='Stills vtkGLTFImporter, dynamic frames CPU linear-blend skinning of reimported GLB glTF animation/accessors and VTK rendering'
 manifest_path.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf8')

if __name__=='__main__':main()
