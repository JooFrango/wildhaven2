from pathlib import Path
import vtk,struct,json,hashlib,io,math
import numpy as np
from scipy.spatial.transform import Rotation as R,Slerp
from vtk.util.numpy_support import vtk_to_numpy,numpy_to_vtk
from PIL import Image,ImageDraw,ImageFont,ImageFilter
ROOT=Path(__file__).resolve().parents[1];P=ROOT/'previews';P.mkdir(exist_ok=True);path=ROOT/'lagarto-papagaio-v03-animado.glb';raw=path.read_bytes();jl=struct.unpack_from('<I',raw,12)[0];g=json.loads(raw[20:20+jl]);binary=raw[28+jl:]
def read(i):
 a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];n={'SCALAR':1,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']];dt={5126:'<f4',5121:'u1',5125:'<u4'}[a['componentType']];return np.frombuffer(binary,dtype=dt,count=a['count']*n,offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(a['count'],n)
nodes=g['nodes']; parents={c:i for i,n in enumerate(nodes) for c in n.get('children',[])}; sk=g['skins'][0];ji=sk['joints'];socket=next(i for i,n in enumerate(nodes) if n['name']=='poison_mouth_socket');
# Independent GLB channel evaluator for mouth socket. VTK importer plays the actual glTF animation for the mesh.
animations={a['name']:a for a in g['animations']};
def transforms_at(name,t):
 a=animations[name]; q={};tr={}
 for ch in a['channels']:
  x=ch['target'];s=a['samplers'][ch['sampler']];times=read(s['input']).ravel();out=read(s['output']);u=np.clip(t,times[0],times[-1]);k=min(max(np.searchsorted(times,u)-1,0),len(times)-2);f=(u-times[k])/(times[k+1]-times[k]);
  if x['path']=='rotation':q[x['node']]=Slerp([0,1],R.from_quat(out[k:k+2]))([f])[0]
  else:tr[x['node']]=out[k]*(1-f)+out[k+1]*f
 cache={}
 def world(i):
  if i in cache:return cache[i]
  p=parents.get(i);r=q.get(i,R.identity());v=tr.get(i,np.array(nodes[i].get('translation',[0,0,0])))
  if p is not None:
   pr,pv=world(p);v=pv+pr.apply(v);r=pr*r
  cache[i]=(r,v);return r,v
 return [world(i) for i in ji],world(socket)
def socket_at(name,t):return transforms_at(name,t)[1]
ren=vtk.vtkRenderer();ren.SetBackground(.65,.72,.67);ren.SetBackground2(.91,.94,.87);ren.GradientBackgroundOn();w=vtk.vtkRenderWindow();w.SetOffScreenRendering(1);w.SetSize(720,420);w.SetMultiSamples(2);w.AddRenderer(ren);imp=vtk.vtkGLTFImporter();imp.SetFileName(str(path));imp.SetRenderWindow(w);imp.Update();ren.RemoveAllLights()
for pos,intensity in [((4,8,5),1.3),((-4,4,-6),.9),((4,1,-5),.75),((0,-4,3),.5)]:
 l=vtk.vtkLight();l.SetLightTypeToSceneLight();l.SetPosition(*pos);l.SetFocalPoint(0,.8,0);l.SetIntensity(intensity);ren.AddLight(l)
a=list(ren.GetActors())[0];a.GetProperty().SetAmbient(.32);a.GetProperty().SetDiffuse(.85)
# Evaluate skin directly from exported glTF accessors. VTK recognizes clips but its importer does not deform these vertices on this platform.
primitive=g['meshes'][0]['primitives'][0]; attrs=primitive['attributes']; rest=read(attrs['POSITION']);normals=read(attrs['NORMAL']);joints=read(attrs['JOINTS_0']);weights=read(attrs['WEIGHTS_0']);inv=read(sk['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1);mesh=a.GetMapper().GetInput();assert mesh.GetNumberOfPoints()==len(rest);assert np.allclose(vtk_to_numpy(mesh.GetPoints().GetData()),rest)
def deform(name,t):
 transforms,_=transforms_at(name,t);mat=np.tile(np.eye(4),(len(ji),1,1));mat[:,:3,:3]=np.array([r.as_matrix() for r,p in transforms]);mat[:,:3,3]=[p for r,p in transforms];mat=mat@inv
 blend=(mat[joints]*weights[:,:,None,None]).sum(axis=1);v=np.einsum('nij,nj->ni',blend[:,:3,:3],rest)+blend[:,:3,3];nn=np.einsum('nij,nj->ni',blend[:,:3,:3],normals);nn/=np.maximum(np.linalg.norm(nn,axis=1,keepdims=True),1e-8)
 mesh.GetPoints().SetData(numpy_to_vtk(v.astype(np.float32),deep=True));mesh.GetPointData().SetNormals(numpy_to_vtk(nn.astype(np.float32),deep=True));mesh.Modified();a.GetMapper().Modified();return v
# ground reference, no collision claims
plane=vtk.vtkPlaneSource();plane.SetOrigin(-10,-.035,-8);plane.SetPoint1(10,-.035,-8);plane.SetPoint2(-10,-.035,8);mapper=vtk.vtkPolyDataMapper();mapper.SetInputConnection(plane.GetOutputPort());ground=vtk.vtkActor();ground.SetMapper(mapper);ground.GetProperty().SetColor(.42,.49,.40);ground.GetProperty().SetAmbient(.5);ren.AddActor(ground)
cam=ren.GetActiveCamera();cam.ParallelProjectionOn();cam.SetViewUp(0,1,0)
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',17);sub=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',11)
checks={};frames_all=[]
def project(p):
 ren.SetWorldPoint(*p,1);ren.WorldToDisplay();x,y,z=ren.GetDisplayPoint();return x,420-y
rng=np.random.default_rng(55);particles=rng.random((135,5))
def gas_overlay(im,t):
 # Stylized game VFX mockup, not a physical gas simulation. Emitter follows evaluated GLB mouth node.
 layer=Image.new('RGBA',im.size);d=ImageDraw.Draw(layer,'RGBA')
 if 1.12<=t<=2.48:
  r,p=socket_at('poison_gas',t); f=r.apply([1,0,0]); down=r.apply([0,-.13,0]);
  for k in range(18,0,-1):
   u=k/18;x,y=project(p+f*(.06+u*.86)+down*u);radius=4+u*13;d.ellipse((x-radius,y-radius,x+radius,y+radius),fill=(150,202,40,int(100-42*u)))
 for j,(r1,r2,r3,r4,r5) in enumerate(particles):
  born=1.12+r1*1.36;age=t-born
  if age<0 or age>1.35:continue
  r,p=socket_at('poison_gas',born);forward=r.apply([1,0,0]);side=r.apply([0,0,1]);up=r.apply([0,1,0]);pos=p+forward*(.10+age*(1.1+r2*.9))+side*(r3-.5)*age*1.0+up*((r4-.4)*age*.65+.10*age)
  x,y=project(pos);radius=6+age*(19+r5*12);alpha=int(105*(1-age/1.35)*min(1,age/.09));d.ellipse((x-radius,y-radius,x+radius,y+radius),fill=(139+int(35*r5),194+int(28*r4),40,alpha))
 return Image.alpha_composite(im.convert('RGBA'),layer.filter(ImageFilter.GaussianBlur(4))).convert('RGB')
# VTK animation importer directly evaluates stored joints and skin.
for name,label in [('walk','CAMINHADA'),('run','CORRIDA'),('bite_heavy','MORDIDA PESADA'),('tail_sweep_left','GOLPE DE CAUDA'),('poison_gas','GÁS VENENOSO')]:
 idx=next(k for k in range(imp.GetNumberOfAnimations()) if imp.GetAnimationName(k)==name)
 for k in range(imp.GetNumberOfAnimations()):imp.DisableAnimation(k)
 dur=float(read(animations[name]['samplers'][0]['input'])[-1,0]);cam.SetFocalPoint(.0,.76,0) if name!='poison_gas' else cam.SetFocalPoint(.65,.8,0);cam.SetPosition(3.8,3.1,12) if name!='poison_gas' else cam.SetPosition(2.6,2.3,12);cam.SetParallelScale(2.22 if name!='poison_gas' else 2.47);ren.ResetCameraClippingRange();frames=[];coords=[]
 for t in np.linspace(0,dur,max(10,round(dur*12)),endpoint=False):
  coords.append(deform(name,float(t)));w.Render();c=vtk.vtkWindowToImageFilter();c.SetInput(w);c.ReadFrontBufferOff();c.Update();arr=vtk_to_numpy(c.GetOutput().GetPointData().GetScalars()).reshape(420,720,-1);im=Image.fromarray(arr[::-1,:,:3].copy())
  if name=='poison_gas':im=gas_overlay(im,float(t))
  d=ImageDraw.Draw(im);d.rectangle((0,0,720,37),fill='#142b20');d.text((13,9),'WILDHAVEN  /  '+label,font=font,fill='#f0f4df');d.text((12,402),'GLB v03 real  |  '+('VFX ilustrativo separado' if name=='poison_gas' else 'IK incorporado aos clipes'),font=sub,fill='#f0f4df',stroke_width=1,stroke_fill='#1b3024');frames.append(im)
 checks[name]={'frames':len(frames),'vertex_displacement_max':float(max(np.linalg.norm(c-coords[0],axis=1).max() for c in coords))};assert checks[name]['vertex_displacement_max']>.01,name;frames[len(frames)//2].save(P/(name+'.png'));frames[0].save(P/(name+'.gif'),save_all=True,append_images=frames[1:],duration=83,loop=0,disposal=2,optimize=True);frames_all+=frames
frames_all[0].save(P/'animacoes.gif',save_all=True,append_images=frames_all[1:],duration=83,loop=0,disposal=2,optimize=True)
(ROOT/'render_report.json').write_text(json.dumps({'source_sha256':hashlib.sha256(raw).hexdigest(),'renderer':'VTK reimport + independent CPU glTF skin evaluator','clips_reimported':imp.GetNumberOfAnimations(),'rendered':checks,'vfx':'separate 2D stylized particles projected from animated mouth socket','full_artistic_qa':False},indent=2));print(checks)
