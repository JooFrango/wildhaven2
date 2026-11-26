#!/usr/bin/env python3
"""Render actual poses computed from REIMPORTED animated v02 GLBs (no AI images)."""
from __future__ import annotations
import io,os,tempfile
from pathlib import Path
import numpy as np
from PIL import Image,ImageOps,ImageDraw,ImageFont
import trimesh,vtk
from trimesh.visual import TextureVisuals
from trimesh.visual.material import PBRMaterial
from build_rig import BASE,parse_glb,read_accessor,CLIPS
from validate_rig import sample_vertices

OUT=BASE/'previews';OUT.mkdir(exist_ok=True)
PALETTES={'cobre':'COBRE','rubro':'RUBRO','oliva':'OLIVA'}


def prepared_mesh(doc,binbytes,skinned):
    prim=doc['meshes'][0]['primitives'][0]
    faces=read_accessor(doc,binbytes,prim['indices']).reshape(-1,3).astype(np.int64)
    uv=read_accessor(doc,binbytes,prim['attributes']['TEXCOORD_0'])
    pic=doc['images'][0];v=doc['bufferViews'][pic['bufferView']]
    png=binbytes[v['byteOffset']:v['byteOffset']+v['byteLength']]
    texture=Image.open(io.BytesIO(png)).convert('RGB')
    mesh=trimesh.Trimesh(vertices=skinned,faces=faces,process=False,validate=False)
    mesh.visual=TextureVisuals(uv=uv,material=PBRMaterial(name='v02-authentic-reimport-texture',
                         baseColorTexture=texture,metallicFactor=0.,roughnessFactor=.92,doubleSided=True))
    scene=trimesh.Scene();scene.add_geometry(mesh)
    return scene


def frame(variant,clip,t,angle='three_quarter',size=(890,625)):
    doc,data=parse_glb(BASE/f'escarvao_{variant}_rig_anim_v02.glb')
    base,pts,_,_=sample_vertices(doc,data,clip,t)
    scene=prepared_mesh(doc,data,pts)
    with tempfile.TemporaryDirectory(prefix='escarvao_pose_') as tmp:
        poseglb=Path(tmp)/'sample_from_real_animated_GLB.glb'
        poseglb.write_bytes(scene.export(file_type='glb'))
        renderer=vtk.vtkRenderer();renderer.SetBackground(.22,.24,.26);renderer.SetBackground2(.10,.12,.14);renderer.GradientBackgroundOn()
        win=vtk.vtkRenderWindow();win.SetOffScreenRendering(1);win.SetSize(*size);win.AddRenderer(renderer);win.SetMultiSamples(4)
        imp=vtk.vtkGLTFImporter();imp.SetFileName(str(poseglb));imp.SetRenderWindow(win);imp.Update()
        key=vtk.vtkLight();key.SetPosition(7,11,12);key.SetIntensity(1.35);renderer.AddLight(key)
        fill=vtk.vtkLight();fill.SetPosition(-6,7,-12);fill.SetIntensity(.55);renderer.AddLight(fill)
        rim=vtk.vtkLight();rim.SetPosition(-7,11,4);rim.SetIntensity(.35);renderer.AddLight(rim)
        actors=renderer.GetActors();actors.InitTraversal()
        for _ in range(actors.GetNumberOfItems()):
            act=actors.GetNextActor();act.GetProperty().SetAmbient(.26);act.GetProperty().SetDiffuse(.77);act.GetProperty().SetSpecular(.015)
        center=np.array([.30,1.25,0]);ext=5.7
        camera=renderer.GetActiveCamera()
        if angle=='front':camera.SetPosition(*(center+np.array([2.65,.36,0])*ext))
        elif angle=='side':camera.SetPosition(*(center+np.array([0,.23,2.55])*ext))
        else:camera.SetPosition(*(center+np.array([1.65,.63,1.95])*ext))
        camera.SetFocalPoint(*center);camera.SetViewUp(0,1,0)
        camera.ParallelProjectionOn();camera.SetParallelScale(2.9 if size[0]>800 else 3.0)
        renderer.ResetCameraClippingRange();win.Render()
        capture=vtk.vtkWindowToImageFilter();capture.SetInput(win);capture.SetInputBufferTypeToRGB();capture.ReadFrontBufferOff();capture.Update()
        png=vtk.vtkPNGWriter();png.SetWriteToMemory(True);png.SetInputConnection(capture.GetOutputPort());png.Write()
        buf=memoryview(png.GetResult()).tobytes()
        image=Image.open(io.BytesIO(buf)).convert('RGB')
        win.Finalize()
    return image


def font(size=22,bold=False):
    file='/usr/share/fonts/truetype/dejavu/DejaVuSans-'+('Bold' if bold else '')+'.ttf'
    if not bold:file='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
    try:return ImageFont.truetype(file,size)
    except:return ImageFont.load_default()


def contact_sheet():
    labels=[('cobre','walk',.35),('cobre','threat_display',.94),('cobre','sting',.45),
            ('rubro','walk',.35),('rubro','threat_display',.94),('rubro','sting',.45),
            ('oliva','walk',.35),('oliva','threat_display',.94),('oliva','sting',.45)]
    w=1320;h=1260;cw=420;ch=350;g=13;mx=18
    im=Image.new('RGB',(w,h),(19,23,24));d=ImageDraw.Draw(im)
    d.text((24,18),'WILDHAVEN  /  ESCARVAO  v02',font=font(40,True),fill='#F0D4A4')
    d.text((24,73),'RIG GLTF REAL  •  51 JUNTAS  •  18 CLIPES  •  3 TEXTURAS UV',font=font(17),fill='#AEB8B2')
    for i,(variant,clip,t) in enumerate(labels):
        r,c=divmod(i,3);px=mx+c*(cw+g);py=108+r*(ch+25)
        a=frame(variant,clip,t,size=(cw,ch))
        im.paste(a,(px,py))
        d.text((px+12,py+ch-33),f'{PALETTES[variant]}  /  {clip}',font=font(17,True),fill='#FFF1D0')
    d.text((25,1240),'Previa tecnica: pose calculada dos canais e pesos do GLB v02 exportado, reimportada em VTK.',font=font(13),fill='#ABB1AC')
    path=OUT/'escarvao_v02_3_variantes_clipes_GLTF_REAL.png';im.save(path,optimize=True);print('CONTACT',path,im.size)


def essential_stills():
    for angle in ('side','front','three_quarter'):
        im=frame('cobre','walk',.27,angle=angle,size=(960,700))
        d=ImageDraw.Draw(im)
        d.text((25,20),f'ESCARVAO COBRE  /  WALK  /  {angle}  /  GLB REAL',font=font(20,True),fill='#F3DCB5')
        file=OUT/f'escarvao_v02_cobre_walk_{angle}_GLTF_REAL.png';im.save(file,optimize=True)
        print('STILL',file)


def gif_evidence():
    for clip in ('walk','sting'):
        duration=CLIPS[clip][0];images=[]
        for j in range(10):
            t=duration*j/10
            im=frame('cobre',clip,t,angle='three_quarter',size=(650,480))
            ImageDraw.Draw(im).text((18,13),f'ESCARVAO v02  /  {clip.upper()}  /  t={t:.2f}s  /  GLTF REAL',font=font(15,True),fill='#F1D6A7')
            images.append(im)
        path=OUT/f'escarvao_v02_{clip}_GLTF_REAL.gif'
        images[0].save(path,save_all=True,append_images=images[1:],duration=135,loop=0,optimize=False)
        print('GIF',path,path.stat().st_size)

if __name__=='__main__':
    import sys
    mode=sys.argv[1] if len(sys.argv)>1 else 'all'
    if mode in ('all','stills'):essential_stills();contact_sheet()
    if mode in ('all','gifs'):gif_evidence()
