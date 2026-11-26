#!/usr/bin/env python3
"""Real GLB previews, read back exported binary from disk, VTK EGL renderer.
Never substitutes generated art for render. All model vertices derive from GLB.
"""
from pathlib import Path
import math, numpy as np, trimesh
from PIL import Image,ImageDraw,ImageFont,ImageOps
import vtk
from vtk.util.numpy_support import numpy_to_vtk,numpy_to_vtkIdTypeArray
ROOT=Path(__file__).resolve().parent.parent
GLB=ROOT/'sirocauro-v01-anatomia-pesada-blockout.glb'
OUT=ROOT/'previews';OUT.mkdir(exist_ok=True)
s=trimesh.load(GLB,force='scene')
raw=s.dump()
assert raw, 'GLB reimport failed'
# every vertex and UV comes from original GLB
for k in raw:assert isinstance(k,trimesh.Trimesh) and k.visual.kind=='texture'
mesh=trimesh.util.concatenate(raw)
# trimesh GLB export may rotate axes; bounding box verifies orientation after reimport
print('GLB bounds',mesh.bounds,'triangles',len(mesh.faces),'UV',len(mesh.visual.uv))
poly=vtk.vtkPolyData()
pts=vtk.vtkPoints();pts.SetData(numpy_to_vtk(mesh.vertices.astype('float32'),deep=True));poly.SetPoints(pts)
tri=vtk.vtkCellArray();faces=np.column_stack([np.full(len(mesh.faces),3,dtype=np.int64),mesh.faces]).flatten();tri.SetCells(len(mesh.faces),numpy_to_vtkIdTypeArray(faces,deep=True));poly.SetPolys(tri)
tcoords=numpy_to_vtk(mesh.visual.uv.astype('float32'),deep=True);tcoords.SetNumberOfComponents(2);tcoords.SetName('UV');poly.GetPointData().SetTCoords(tcoords)
mapper=vtk.vtkPolyDataMapper();mapper.SetInputData(poly)
model=vtk.vtkActor();model.SetMapper(mapper)
model.GetProperty().SetAmbient(.49);model.GetProperty().SetDiffuse(.83);model.GetProperty().SetSpecular(.06);model.GetProperty().SetSpecularPower(8)
reader=vtk.vtkPNGReader();reader.SetFileName(str(ROOT/'textures'/'sirocauro-v01-uv-atlas.png'));reader.Update()
texture=vtk.vtkTexture();texture.SetInputConnection(reader.GetOutputPort());texture.InterpolateOn();texture.RepeatOff();model.SetTexture(texture)

r=vtk.vtkRenderer();r.SetBackground(.15,.16,.16)
win=vtk.vtkRenderWindow();win.SetOffScreenRendering(1);win.AddRenderer(r);win.SetSize(1152,760);win.SetMultiSamples(8)
r.AddActor(model)
# stage for spatial scale, not part of GLB
floor=vtk.vtkPlaneSource();floor.SetOrigin(-20,-15,-.20);floor.SetPoint1(20,-15,-.20);floor.SetPoint2(-20,15,-.20);floor.Update()
fm=vtk.vtkPolyDataMapper();fm.SetInputConnection(floor.GetOutputPort());fa=vtk.vtkActor();fa.SetMapper(fm);fa.GetProperty().SetColor(.29,.26,.21);fa.GetProperty().SetAmbient(.43);fa.GetProperty().SetDiffuse(.55);r.AddActor(fa)
# small directional ambient with 3 light sources
for pos,c,intensity in [((-12,-12,20),(.99,.93,.83),1.22),((8,10,17),(.86,.92,1.),.85),((14,-8,10),(1.,.75,.57),.31)]:
 l=vtk.vtkLight();l.SetLightTypeToSceneLight();l.SetPosition(*pos);l.SetFocalPoint(0,0,3);l.SetColor(*c);l.SetIntensity(intensity);r.AddLight(l)

def text_title(path,label,view):
 im=Image.open(path).convert('RGB')
 dr=ImageDraw.Draw(im)
 try:
  large=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',34)
  small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',20)
 except Exception:large=small=ImageFont.load_default()
 dr.rectangle((0,0,im.width,71),fill=(23,27,29));dr.text((34,15),'SIROCAURO   |   BLOCKOUT v01',font=large,fill=(232,211,165))
 dr.rectangle((0,im.height-46,im.width,im.height),fill=(23,27,29));dr.text((34,im.height-34),f'{label}   |   Render real do GLB reimportado   |   0 animações',font=small,fill=(218,220,213))
 im.save(path,quality=94)
 return im

def render(name,position,focus,scale):
 camera=vtk.vtkCamera();camera.ParallelProjectionOn();camera.SetPosition(*position);camera.SetFocalPoint(*focus);camera.SetViewUp(0,0,1);camera.SetParallelScale(scale)
 r.SetActiveCamera(camera);r.ResetCameraClippingRange();win.Render()
 w=vtk.vtkWindowToImageFilter();w.SetInput(win);w.SetInputBufferTypeToRGB();w.ReadFrontBufferOff();w.Update()
 writer=vtk.vtkPNGWriter();writer.SetInputConnection(w.GetOutputPort());p=OUT/f'sirocauro-v01-real-glb-{name}.png';writer.SetFileName(str(p));writer.Write()
 return text_title(p,name,position)

views=[
  ('perfil',(1,-32,6.8),(1,0,2.8),5.7),
  ('frente',(-26,-.4,6.0),(-1.6,0,3.1),4.7),
  ('tres-quartos',(-20,-21,10.7),(.3,0,2.9),5.55),
]
imgs=[]
for n,pos,focus,scale in views:imgs.append(render(n,pos,focus,scale))
# Contact sheet, literal screenshots, sized to inspect silhouette.
thumb_w=820;thumb_h=545; margin=24; label_h=55
sheet=Image.new('RGB',(thumb_w*3+margin*4,thumb_h+margin*2+105),(29,31,30))
for i,(name,_,_,_) in enumerate(views):
 im=imgs[i].resize((thumb_w,thumb_h),Image.Resampling.LANCZOS)
 sheet.paste(im,(margin+i*(thumb_w+margin),margin+70))
try:font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',41)
except:font=ImageFont.load_default()
ImageDraw.Draw(sheet).text((margin,15),'Wildhaven  |  Sirocauro  |  anatomia mais pesada',fill=(238,214,165),font=font)
sheet.save(OUT/'sirocauro-v01-real-glb-3-vistas.png')
# Concept comparison, original artwork shown as SOURCE, not GLB render.
source=Image.open('/mnt/data/sirocauro-conceito.png').convert('RGB')
photo=imgs[2]
canvas=Image.new('RGB',(1900,670),(29,31,30))
for idx,base in enumerate([source,photo]):
 target=ImageOps.contain(base,(908,588),Image.Resampling.LANCZOS)
 canvas.paste(target,(29+idx*945+(908-target.width)//2,60+(588-target.height)//2))
d=ImageDraw.Draw(canvas)
try:fm=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',25)
except:fm=ImageFont.load_default()
d.text((28,15),'CONCEITO APROVADO  (arte, não GLB)',fill=(236,216,173),font=fm)
d.text((975,15),'BLOCKOUT v01  (render GLB real)',fill=(236,216,173),font=fm)
canvas.save(OUT/'sirocauro-v01-conceito-vs-glb.png')
print('renders complete',list(str(p) for p in OUT.iterdir()))