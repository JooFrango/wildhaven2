#!/usr/bin/env python3
"""Independent GLB glTF animation validator and visual preview generator.

Reads ONLY the EXPORTED V03 GLB skin, inverse bind matrices, texture,
and 22 glTF animation channels. Reimports GLB in VTK, and because VTK 9.6
cannot directly update skinned vertices on UpdateAtTimeValue, applies the
exported glTF poses by CPU skinning onto its imported mesh per frame.
These are GENUINE rendered animated model previews, not AI illustrations.
"""
from __future__ import annotations
import hashlib,json,struct,math
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
import vtk
from vtk.util.numpy_support import vtk_to_numpy,numpy_to_vtk
HERE=Path(__file__).resolve().parent.parent
BASE=HERE.parent/'v02'/'arraia-de-areia-v02-anatomia-refinada.glb'
GLB=HERE/'arraia-de-areia-v03-rig-animated-LOD0.glb'
PREV=HERE/'previews';PREV.mkdir(parents=True,exist_ok=True)

class GLBReader:
 def __init__(self,path):
    b=path.read_bytes();assert b[:4]==b'glTF' and struct.unpack_from('<I',b,8)[0]==len(b)
    n,typ=struct.unpack_from('<I4s',b,12);assert typ==b'JSON'
    self.j=json.loads(b[20:20+n]);off=20+n
    l,typ=struct.unpack_from('<I4s',b,off);assert typ==b'BIN\x00'
    self.raw=b[off+8:off+8+l];self.sha=hashlib.sha256(b).hexdigest()
 def array(self,idx):
    a=self.j['accessors'][idx];v=self.j['bufferViews'][a['bufferView']]
    n={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]
    dt={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[a['componentType']]
    off=v.get('byteOffset',0)+a.get('byteOffset',0)
    assert v.get('byteStride',np.dtype(dt).itemsize*n)==np.dtype(dt).itemsize*n
    return np.frombuffer(self.raw,dtype=dt,count=a['count']*n,offset=off).reshape(-1,n).copy()
 def image_bytes(self):
    im=self.j['images'][0]; assert im['mimeType']=='image/png'
    v=self.j['bufferViews'][im['bufferView']];o=v.get('byteOffset',0)
    return self.raw[o:o+v['byteLength']]

class Player:
 def __init__(self,reader):
    self.r=reader;self.g=reader.j;self.skin=self.g['skins'][0]
    prim=self.g['meshes'][0]['primitives'][0];a=prim['attributes']
    self.xyz=reader.array(a['POSITION']).astype('float64')
    self.uv=reader.array(a['TEXCOORD_0']).astype('float32')
    self.indices=reader.array(prim['indices']).astype(int).reshape(-1)
    self.joint=reader.array(a['JOINTS_0']).astype(int)
    self.weight=reader.array(a['WEIGHTS_0']).astype(float)
    self.ibms=reader.array(self.skin['inverseBindMatrices']).astype(float).reshape(-1,4,4).transpose(0,2,1)
    self.hom=np.column_stack([self.xyz,np.ones(len(self.xyz))])
    self.parent={}
    for i,n in enumerate(self.g['nodes']):
        for c in n.get('children',[]):self.parent[c]=i
    self.names={a['name']:a for a in self.g['animations']}
 @staticmethod
 def matrix(t,q):
    x,y,z,w=q;x2=x*x;y2=y*y;z2=z*z
    M=np.eye(4)
    M[:3,:3]=[[1-2*(y2+z2),2*(x*y-z*w),2*(x*z+y*w)],
              [2*(x*y+z*w),1-2*(x2+z2),2*(y*z-x*w)],
              [2*(x*z-y*w),2*(y*z+x*w),1-2*(x2+y2)]]
    M[:3,3]=t
    return M
 def channel(self,clip,ch,t):
    s=clip['samplers'][ch['sampler']]
    ts=self.r.array(s['input']).reshape(-1)
    val=self.r.array(s['output'])
    if t<=ts[0]:return val[0]
    if t>=ts[-1]:return val[-1]
    i=int(np.searchsorted(ts,t,side='right')-1)
    w=float((t-ts[i])/(ts[i+1]-ts[i]))
    y=val[i]*(1-w)+val[i+1]*w
    if ch['target']['path']=='rotation':y=y/np.linalg.norm(y)
    return y
 def deform(self,name,t):
    clip=self.names[name]
    pose={}
    for ch in clip['channels']:
        target=ch['target'];pose.setdefault(target['node'],{})[target['path']]=self.channel(clip,ch,t)
    cache={}
    def world(i):
        if i in cache:return cache[i]
        node=self.g['nodes'][i];p=pose.get(i,{})
        T=self.matrix(p.get('translation',node.get('translation',[0,0,0])),p.get('rotation',node.get('rotation',[0,0,0,1])))
        if i in self.parent:T=world(self.parent[i])@T
        cache[i]=T
        return T
    mats=np.array([world(k)@self.ibms[i] for i,k in enumerate(self.skin['joints'])])
    verts=np.zeros((len(self.xyz),4),float)
    for k in range(4):
        verts+=np.einsum('nij,nj->ni',mats[self.joint[:,k]],self.hom)*self.weight[:,k,None]
    assert np.isfinite(verts).all()
    return np.asarray(verts[:,:3],dtype=np.float32)

def test_playback(reader,player):
    j=reader.j;b=GLBReader(BASE)
    assert len(j['meshes'])==len(j['materials'])==len(j['images'])==len(j['skins'])==1
    assert len(j['animations'])==22 and len(j['skins'][0]['joints'])==23
    orig=b.j['meshes'][0]['primitives'][0];now=j['meshes'][0]['primitives'][0]
    for attr in ['POSITION','TEXCOORD_0']:
        assert np.array_equal(reader.array(now['attributes'][attr]),b.array(orig['attributes'][attr])),attr
    assert np.array_equal(reader.array(now['indices']),b.array(orig['indices']))
    assert reader.image_bytes()==b.image_bytes()
    assert player.xyz.shape==(19728,3)
    assert np.allclose(player.weight.sum(axis=1),1.,atol=1e-5)
    assert player.joint.min()>=0 and player.joint.max()<23
    assert np.any((player.weight>.10)&(player.weight<.90)),'no blended weights'
    assert np.unique(player.joint[player.weight>.05]).size>=18
    assert np.isfinite(player.ibms).all()
    # Bind matrix must bring every reference joint exactly back to origin.
    rest={}
    for i,jid in enumerate(player.skin['joints']):
        n=j['nodes'][jid]
        mat=player.matrix(n.get('translation',[0,0,0]),n.get('rotation',[0,0,0,1]))
        if jid in player.parent and player.parent[jid] in rest:mat=rest[player.parent[jid]]@mat
        rest[jid]=mat
        assert np.allclose(mat@player.ibms[i],np.eye(4),atol=2e-5),n['name']
    results={}
    for name,clip in player.names.items():
        ts=reader.array(clip['samplers'][0]['input']).reshape(-1)
        assert len(ts)>=25 and np.all(np.diff(ts)>0)
        assert all(s['interpolation']=='LINEAR' for s in clip['samplers'])
        assert len(clip['channels'])==24
        samples=[player.deform(name,float(t)) for t in [ts[0],ts[len(ts)//4],ts[len(ts)//2],ts[-1]]]
        assert all(np.isfinite(x).all() for x in samples)
        assert max(np.max(np.linalg.norm(x-samples[0],axis=1)) for x in samples[1:])>.01,name
        for channel in clip['channels']:
            vals=reader.array(clip['samplers'][channel['sampler']]['output'])
            assert np.isfinite(vals).all()
            if channel['target']['path']=='rotation':
                assert np.allclose(np.linalg.norm(vals,axis=1),1,atol=5e-4)
        if clip['extras']['loop']:
            err=np.max(np.linalg.norm(samples[0]-samples[-1],axis=1))
            assert err<.001,(name,err)
        movement=max(float(np.max(np.linalg.norm(x-samples[0],axis=1))) for x in samples[1:])
        results[name]={'duration_s':float(ts[-1]),'channels':len(clip['channels']),
                       'max_deformation_m':round(movement,4),'loop':clip['extras']['loop']}
    rec={'glb_sha256':reader.sha,'base_glb_sha256':b.sha,
         'original_painted_texture_bytes_identical':True,
         'original_positions_uv_and_indices_identical':True,
         'bind_pose_inverse_matrices_valid':True,'weighted_skin_deformation_valid':True,
         'all_22_clips_passed':True,'loop_seams_valid':True,'clips':results}
    (HERE/'animation-validation.json').write_text(json.dumps(rec,ensure_ascii=False,indent=2)+'\n')
    print('PASS: All 22 exported animated clips, skinned playback, UV/texture and loops',results)

def previews(reader,player):
    width,height=1050,740
    win=vtk.vtkRenderWindow();win.SetOffScreenRendering(True);win.SetSize(width,height);win.SetMultiSamples(0)
    ren=vtk.vtkRenderer();win.AddRenderer(ren)
    importer=vtk.vtkGLTFImporter();importer.SetFileName(str(GLB));importer.SetRenderWindow(win);importer.Update()
    assert importer.GetNumberOfAnimations()==22
    acts=ren.GetActors();acts.InitTraversal();actor=acts.GetNextActor();assert actor
    mesh=actor.GetMapper().GetInput();points=mesh.GetPoints()
    assert points.GetNumberOfPoints()==len(player.xyz)
    coords=vtk_to_numpy(points.GetData())
    assert np.allclose(coords,player.xyz,atol=2e-6)
    tex=actor.GetProperty().GetTexture('albedoTex')
    assert tex is not None,'embedded BaseColor texture was not imported'
    ren.SetBackground(.92,.89,.83);ren.SetBackground2(.995,.981,.949);ren.GradientBackgroundOn()
    main=vtk.vtkLight();main.SetLightTypeToSceneLight();main.SetPosition(26,45,25);main.SetFocalPoint(0,2.8,0);main.SetIntensity(1.23);ren.AddLight(main)
    rim=vtk.vtkLight();rim.SetLightTypeToSceneLight();rim.SetPosition(-23,11,-33);rim.SetIntensity(.75);ren.AddLight(rim)
    cam=ren.GetActiveCamera();cam.ParallelProjectionOn();cam.SetViewUp(0,1,0)
    def camera(view):
        if view=='perfil':cam.SetPosition(1,10,55);cam.SetFocalPoint(-2,3.0,0);cam.SetParallelScale(10.0)
        elif view=='frente':cam.SetPosition(54,12,0);cam.SetFocalPoint(-2.5,2.9,0);cam.SetParallelScale(9.5)
        elif view=='superior':cam.SetPosition(-2,42,0.01);cam.SetFocalPoint(-2,2.8,0);cam.SetViewUp(1,0,0);cam.SetParallelScale(9.5)
        else:cam.SetPosition(34,21,30);cam.SetFocalPoint(-2,3.0,0);cam.SetParallelScale(10.4)
        if view!='superior':cam.SetViewUp(0,1,0)
        ren.ResetCameraClippingRange()
    def frame(clip,t,view='tres-quartos'):
        camera(view)
        xyz=player.deform(clip,t)
        coords[:]=xyz
        points.GetData().Modified();points.Modified();mesh.Modified()
        # Update faceted normals per triangle to preserve Torvardo-style planar shading
        a=xyz[player.indices].reshape(-1,3,3)
        n=np.cross(a[:,1]-a[:,0],a[:,2]-a[:,0])
        n=n/np.maximum(np.linalg.norm(n,axis=1)[:,None],1e-7)
        vertnorm=np.repeat(n,3,axis=0)
        normals=numpy_to_vtk(np.asarray(vertnorm,dtype=np.float32),deep=True)
        mesh.GetPointData().SetNormals(normals)
        ren.ResetCameraClippingRange();win.Render()
        f=vtk.vtkWindowToImageFilter();f.SetInput(win);f.SetInputBufferTypeToRGB();f.ReadFrontBufferOff();f.Update()
        img=vtk_to_numpy(f.GetOutput().GetPointData().GetScalars()).reshape(height,width,3)
        return Image.fromarray(np.flipud(img).copy())
    for view,clip,t in [('perfil','swim_sand',.75),('frente','filter_feed',1.35),('tres-quartos','breach',1.75),('superior','swim_sand',.95)]:
        img=frame(clip,t,view)
        d=ImageDraw.Draw(img);d.rectangle((0,0,width,47),fill=(37,37,34))
        d.text((20,17),f'WILDHAVEN | ARRAIA-DE-AREIA v03 | {view.upper()} | {clip.upper()} | GLB REAL',fill=(245,221,178))
        dest=PREV/f'arraia-de-areia-v03-GLB-animado-real-{view}.png'
        img.save(dest,optimize=True)
    clips=['swim_sand','dive','filter_feed','fin_slap','tail_sweep','breach']
    for clip in clips:
        animation=player.names[clip]
        duration=float(reader.array(animation['samplers'][0]['input'])[-1,0])
        frames=[]
        for i in range(12):
            t=duration*i/12
            img=frame(clip,t,'tres-quartos').resize((630,444),Image.Resampling.BILINEAR)
            d=ImageDraw.Draw(img);d.rectangle((0,0,630,31),fill=(37,36,34))
            d.text((12,9),f'ARRAIA-DE-AREIA v03 | {clip.upper()} | GLB ANIMADO REAL',fill=(243,214,168))
            frames.append(img)
        out=PREV/f'arraia-de-areia-v03-{clip}-GLB-real.gif'
        frames[0].save(out,save_all=True,append_images=frames[1:],loop=0,duration=170,optimize=True)
        print('GIF',clip,out.stat().st_size)
    sheet=Image.new('RGB',(1560,460),(37,35,32))
    for k,view in enumerate(['perfil','frente','tres-quartos']):
        im=Image.open(PREV/f'arraia-de-areia-v03-GLB-animado-real-{view}.png').resize((520,366),Image.Resampling.BILINEAR)
        sheet.paste(im,(520*k,35))
        ImageDraw.Draw(sheet).text((520*k+19,423),view.upper()+' / RENDER REAL DO GLB ANIMADO',fill=(236,217,185))
    sheet.save(PREV/'arraia-de-areia-v03-tres-vistas-animadas-GLB-real.png',optimize=True)
    win.Finalize()

def main():
    r=GLBReader(GLB);p=Player(r);test_playback(r,p);previews(r,p)
    m=json.loads((HERE/'manifest.json').read_text());m['independent_glb_playback_verified']=True
    m['real_preview_pngs']=4;m['real_preview_gifs']=6
    (HERE/'manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
    print('COMPLETE:',r.sha,'clips',len(p.names),'joints',len(p.skin['joints']))
if __name__=='__main__':main()
