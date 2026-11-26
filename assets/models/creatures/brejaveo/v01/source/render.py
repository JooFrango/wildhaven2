#!/usr/bin/env python3
"""Render real GLB reimported into trimesh, geometry+UV material reconstructed in VTK."""
import math,hashlib,json
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,ImageFont,ImageFilter
import trimesh, vtk
from vtk.util.numpy_support import numpy_to_vtk
ROOT=Path(__file__).resolve().parent.parent
GLB=ROOT/'brejaveo-v01-anatomia-blockout.glb'
SCENE=trimesh.load(GLB,force='scene',process=False)
print('READ actual glb',GLB,len(SCENE.geometry))

def vtk_actor(tmesh,tex):
    poly=vtk.vtkPolyData()
    v=np.asarray(tmesh.vertices,dtype=np.float32)
    f=np.asarray(tmesh.faces,dtype=np.int64)
    pts=vtk.vtkPoints();pts.SetData(numpy_to_vtk(v,deep=True));poly.SetPoints(pts)
    cells=vtk.vtkCellArray();cells.SetCells(len(f),numpy_to_vtk(np.column_stack((np.full(len(f),3),f)).ravel().astype(np.int64),deep=True,array_type=vtk.VTK_ID_TYPE));poly.SetPolys(cells)
    actor=vtk.vtkActor()
    if hasattr(tmesh.visual,'uv') and tmesh.visual.uv is not None:
        uv=numpy_to_vtk(np.asarray(tmesh.visual.uv,dtype=np.float32),deep=True)
        uv.SetNumberOfComponents(2);uv.SetName('TextureCoordinates');poly.GetPointData().SetTCoords(uv)
        mat=tmesh.visual.material
        if getattr(mat,'baseColorTexture',None) is not None:
            actor.SetTexture(tex)
        elif getattr(mat,'baseColorFactor',None) is not None:
            rgb=np.array(mat.baseColorFactor[:3],dtype=float);rgb=rgb/(255 if rgb.max()>1.0 else 1.0);actor.GetProperty().SetColor(*[float(a) for a in rgb])
    normals=vtk.vtkPolyDataNormals();normals.SetInputData(poly);normals.ComputeCellNormalsOn();normals.ComputePointNormalsOff();normals.ConsistencyOn();normals.Update()
    mapper=vtk.vtkPolyDataMapper();mapper.SetInputConnection(normals.GetOutputPort());mapper.ScalarVisibilityOff();actor.SetMapper(mapper)
    prop=actor.GetProperty();prop.SetInterpolationToPhong();prop.SetAmbient(.36);prop.SetDiffuse(.75);prop.SetSpecular(.055);prop.SetSpecularPower(19)
    actor.GetProperty().BackfaceCullingOff()
    return actor

reader=vtk.vtkPNGReader();reader.SetFileName(str(ROOT/'textures/brejaveo-v01-atlas-uv.png'));reader.Update()
texture=vtk.vtkTexture();texture.SetInputConnection(reader.GetOutputPort());texture.InterpolateOn();texture.RepeatOff();

FONT='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
FONT_BOLD='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'

def render(name,position,focal,parallel_scale=2.3):
    W,H=1300,850
    renderer=vtk.vtkRenderer();renderer.SetBackground(.115,.17,.155);renderer.SetBackground2(.18,.22,.19);renderer.GradientBackgroundOn()
    for m in SCENE.geometry.values():renderer.AddActor(vtk_actor(m,texture))
    # ground for orientation only; render mesh always in original pose
    plane=vtk.vtkPlaneSource();plane.SetOrigin(-20,-20,-.055);plane.SetPoint1(20,-20,-.055);plane.SetPoint2(-20,20,-.055)
    pm=vtk.vtkPolyDataMapper();pm.SetInputConnection(plane.GetOutputPort())
    pa=vtk.vtkActor();pa.SetMapper(pm);pa.GetProperty().SetColor(.16,.22,.19);pa.GetProperty().SetAmbient(.5);pa.GetProperty().SetDiffuse(.4)
    renderer.AddActor(pa)
    for pos,intens,color in [((-6,-8,12),.89,(1,.96,.79)),((4,7,8),.67,(.73,.84,1)),((-1,0,12),.26,(1,1,1))]:
        l=vtk.vtkLight();l.SetPosition(*pos);l.SetFocalPoint(*focal);l.SetIntensity(intens);l.SetColor(*color)
        renderer.AddLight(l)
    camera=renderer.GetActiveCamera();camera.ParallelProjectionOn();camera.SetParallelScale(parallel_scale)
    camera.SetPosition(*position);camera.SetFocalPoint(*focal);camera.SetViewUp(0,0,1)
    win=vtk.vtkRenderWindow();win.SetOffScreenRendering(True);win.SetMultiSamples(4);win.SetSize(W,H);win.AddRenderer(renderer)
    win.Render()
    filt=vtk.vtkWindowToImageFilter();filt.SetInput(win);filt.SetInputBufferTypeToRGB();filt.ReadFrontBufferOff();filt.Update()
    from vtk.util.numpy_support import vtk_to_numpy
    arr=vtk_to_numpy(filt.GetOutput().GetPointData().GetScalars()).reshape(H,W,3)
    im=Image.fromarray(arr[::-1].copy(),'RGB')
    # editorial overlays, distinct from rendered geometry
    canvas=Image.new('RGB',(W,H+118),(18,25,23));canvas.paste(im,(0,90))
    dr=ImageDraw.Draw(canvas)
    fb=ImageFont.truetype(FONT_BOLD,35);f=ImageFont.truetype(FONT,22);small=ImageFont.truetype(FONT,18)
    dr.text((35,23),'BREJÁVEO  /  BLOCKOUT REAL v01',font=fb,fill=(234,221,186))
    dr.text((35,H+100),'WILDHAVEN   •   GLB reimportado   •   '+name.upper(),font=f,fill=(209,221,192),anchor='lm')
    dr.text((W-27,H+100),'SEM RIG  /  SEM ANIMAÇÕES',font=small,fill=(198,196,162),anchor='rm')
    path=ROOT/'previews'/f'brejaveo-v01-real-glb-{name}.png';canvas.save(path,optimize=True)
    print(name,path,canvas.size)
    win.Finalize()
    return canvas

# Orthographic front is negative X (head), side is negative Y, three-quarter opens both head and wing.
side=render('perfil',(-.1,-13,4.5),(-.2,0,1.33),2.28)
front=render('frente',(-12,0,4.6),(-.3,0,1.32),2.40)
three=render('tres-quartos',(-10,-11,6.4),(-.15,0,1.35),2.55)
# composite three true rendered views (not imagegen)
W,H=1368,1170
panel=Image.new('RGB',(W,H),(20,27,25))
d=ImageDraw.Draw(panel)
fb=ImageFont.truetype(FONT_BOLD,40);f=ImageFont.truetype(FONT,21)
d.text((48,32),'BREJÁVEO   /   APROVAÇÃO DA FORMA',font=fb,fill=(237,226,198))
d.text((48,89),'Wildhaven • modelo 3D GLB real • 3.692 triângulos • UV pintada • sem rig',font=f,fill=(175,197,178))
for i,(label,im) in enumerate([('01  PERFIL',side),('02  FRENTE',front),('03  TRÊS-QUARTOS',three)]):
    # crop overlays from component and size to panels
    shot=im.crop((0,90,1300,940)); shot.thumbnail((1300,302),Image.Resampling.LANCZOS)
    y=148+i*340
    d.rounded_rectangle((34,y,1333,y+321),radius=14,fill=(37,53,47))
    panel.paste(shot,((W-shot.width)//2,y+8))
    d.text((70,y+285),label,font=ImageFont.truetype(FONT_BOLD,23),fill=(240,213,150))
np=ROOT/'previews/brejaveo-v01-real-glb-3-vistas.png';panel.save(np,optimize=True)
print('sheet',np)