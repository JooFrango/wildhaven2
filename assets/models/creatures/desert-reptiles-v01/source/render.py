#!/usr/bin/env python3
"""Render 3 actual turntables from previously EXPORTED and REIMPORTED GLB.
Not concept art: original GLB exact SHA stored in each preview entry.
"""
from __future__ import annotations
import argparse, json, math,hashlib,os
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,ImageFont
import trimesh
import vtk
from vtk.util.numpy_support import numpy_to_vtk,numpy_to_vtkIdTypeArray

BASE=Path(__file__).resolve().parent.parent
OUTROOT=Path(os.environ.get('WILDHAVEN_MODELS_ROOT',str(BASE)))
FONT='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'

def create_actor(glb_path):
    s=trimesh.load(glb_path,force='scene',process=False)
    assert len(s.geometry)==1
    mesh=list(s.geometry.values())[0]
    v=np.asarray(mesh.vertices,dtype=np.float64);f=np.asarray(mesh.faces,dtype=np.int64)
    uv=np.asarray(mesh.visual.uv,dtype=np.float64)
    assert len(v)==len(uv) and len(f)>150 and mesh.visual.kind=='texture'
    p=vtk.vtkPolyData();points=vtk.vtkPoints();points.SetData(numpy_to_vtk(v,deep=True));p.SetPoints(points)
    cell=vtk.vtkCellArray();cell.SetCells(len(f),numpy_to_vtkIdTypeArray(np.column_stack([np.full(len(f),3),f]).ravel(),deep=True));p.SetPolys(cell)
    t=numpy_to_vtk(uv,deep=True);t.SetNumberOfComponents(2);t.SetName('TCoords');p.GetPointData().SetTCoords(t)
    normals=vtk.vtkPolyDataNormals();normals.SetInputData(p);normals.ComputePointNormalsOn();normals.SplittingOn();normals.SetFeatureAngle(50);normals.AutoOrientNormalsOff();normals.ConsistencyOff();normals.Update()
    mapper=vtk.vtkPolyDataMapper();mapper.SetInputConnection(normals.GetOutputPort());mapper.ScalarVisibilityOff()
    actor=vtk.vtkActor();actor.SetMapper(mapper);actor.GetProperty().SetInterpolationToFlat();actor.GetProperty().SetAmbient(.40);actor.GetProperty().SetDiffuse(.67);actor.GetProperty().SetSpecular(.04)
    # Extract actual embedded image (not use generated original image as substitute).
    img=mesh.visual.material.baseColorTexture.convert('RGB')
    importer=vtk.vtkImageImport();pix=np.flipud(np.array(img)).copy();importer.CopyImportVoidPointer(pix.tobytes(),pix.nbytes);importer.SetDataScalarTypeToUnsignedChar();importer.SetNumberOfScalarComponents(3)
    importer.SetDataExtent(0,img.width-1,0,img.height-1,0,0);importer.SetWholeExtent(0,img.width-1,0,img.height-1,0,0);importer.Update()
    texture=vtk.vtkTexture();texture.SetInputConnection(importer.GetOutputPort());texture.InterpolateOn();texture.RepeatOff();actor.SetTexture(texture)
    return actor,mesh,img,importer,texture,normals

def image_for(actor,view,width=800,height=520):
    render=vtk.vtkRenderer();render.SetBackground(.77,.75,.73);render.SetBackground2(.59,.57,.55);render.GradientBackgroundOn()
    window=vtk.vtkRenderWindow();window.SetOffScreenRendering(1);window.SetSize(width,height);window.SetMultiSamples(4);window.AddRenderer(render)
    render.AddActor(actor)
    # Ground-contact matte ambient ellipse. A full plane can conceal the legs,
    # so use a shallow organic contact shadow instead of an opaque floor.
    shadow_src=vtk.vtkSphereSource();shadow_src.SetThetaResolution(50);shadow_src.SetPhiResolution(20)
    shadow_map=vtk.vtkPolyDataMapper();shadow_map.SetInputConnection(shadow_src.GetOutputPort())
    shadow=vtk.vtkActor();shadow.SetMapper(shadow_map);shadow.SetScale(.57,.001,.29)
    shadow.SetPosition(-.015,.007,0);shadow.GetProperty().SetColor(.29,.26,.23)
    shadow.GetProperty().SetOpacity(.14);render.AddActor(shadow)
    # Camera and simple soft directional lights.
    if view=='profile': pos=(.06,.58,2.15);scale=.325
    elif view=='front':pos=(2.2,.59,.12);scale=.295
    else: pos=(1.65,.81,1.65);scale=.345
    center=(-.04,.14,0.)
    camera=vtk.vtkCamera();camera.SetPosition(*pos);camera.SetFocalPoint(*center);camera.SetViewUp(0,1,0);camera.ParallelProjectionOn();camera.SetParallelScale(scale);render.SetActiveCamera(camera)
    for position,intensity in [((2.6,4.1,2.2),1.05),((-2.2,2.5,-3),.62)]:
        light=vtk.vtkLight();light.SetPosition(*position);light.SetFocalPoint(0,0,0);light.SetIntensity(intensity);render.AddLight(light)
    window.Render()
    capture=vtk.vtkWindowToImageFilter();capture.SetInput(window);capture.SetInputBufferTypeToRGB();capture.ReadFrontBufferOff();capture.Update()
    arr=capture.GetOutput().GetPointData().GetScalars();npimg=np.frombuffer(memoryview(arr),dtype=np.uint8).reshape(height,width,3)
    pil=Image.fromarray(np.flipud(npimg).copy())
    window.Finalize()
    return pil

def caption(im,species,view,sha):
    width,height=im.size
    canvas=Image.new('RGB',(width,height+95),(38,37,36));canvas.paste(im,(0,0));d=ImageDraw.Draw(canvas)
    font=ImageFont.truetype(FONT,28);sub=ImageFont.truetype(FONT,15)
    d.text((32,height+10),species.upper()+'  /  '+{'profile':'PERFIL','front':'FRENTE','three-quarter':'3/4'}[view],font=font,fill=(246,218,168))
    d.text((33,height+52),'Render real do GLB reimportado  •  UV pintado  •  Sem rig ou animações',font=sub,fill=(198,194,187))
    d.text((width-265,height+14),'SHA256 '+sha[:16]+'...',font=sub,fill=(160,156,146))
    return canvas

def render_one(spec):
    folder=(OUTROOT/spec/'v01') if os.environ.get('WILDHAVEN_MODELS_ROOT') else BASE/spec; report=json.loads((folder/'manifest.json').read_text()); glb=folder/report['glb'];blob=glb.read_bytes();sha=hashlib.sha256(blob).hexdigest();assert sha==report['sha256']
    actor,mesh,texture,*dependencies=create_actor(glb)
    assert np.array_equal(np.asarray(texture),np.asarray(Image.open(folder/report['paint_map']).convert('RGB')))
    report['previews']={};outdir=folder/'previews';outdir.mkdir(exist_ok=True)
    ims=[]
    for view in ['profile','front','three-quarter']:
        im=caption(image_for(actor,view),spec,view,sha);p=outdir/f'{spec}-v01-real-glb-{view}.png';im.save(p,compress_level=2)
        report['previews'][p.name]={'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'source_glb_sha256':sha,'camera_view':view}
        ims.append(im)
    # Original reimported PNG contact sheet with stable hash tied to the actual GLB.
    w=560;h=int(ims[0].height*w/ims[0].width)
    sheet=Image.new('RGB',(w*3,h+30),(37,36,36))
    for idx,im in enumerate(ims):sheet.paste(im.resize((w,h),Image.Resampling.LANCZOS),(w*idx,0))
    ImageDraw.Draw(sheet).text((22,h+4),'WILDHAVEN  —  ORIGINAL GLB RENDERS   |   PROFILE   /   FRONT   /   THREE-QUARTER',fill=(230,217,186))
    summary=outdir/f'{spec}-v01-three-real-glb-views.png';sheet.save(summary,compress_level=2)
    report['previews'][summary.name]={'bytes':summary.stat().st_size,'sha256':hashlib.sha256(summary.read_bytes()).hexdigest(),'source_glb_sha256':sha,'camera_view':'contact_sheet'}
    (folder/'manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print('RENDERED',spec,[p for p in report['previews']],'glb sha256',sha,flush=True)

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--species',nargs='+',choices=['caudraco','lajurim','cornevio','fossario'],default=['caudraco','lajurim','cornevio','fossario']);a=p.parse_args()
    for spec in a.species:render_one(spec)
