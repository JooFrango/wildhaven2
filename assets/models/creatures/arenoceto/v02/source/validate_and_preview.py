#!/usr/bin/env python3
"""Independent animation playback validator + actual animated GLB screenshots.
Reads animation samplers + joint matrices + skins from the EXPORTED GLB,
computes CPU weighted skinning, and renders that geometry via VTK with the
original UV-painted PNG texture. Does not render source poses.
"""
from __future__ import annotations
import json,struct,math,hashlib
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,ImageFont
import vtk
from vtk.util.numpy_support import vtk_to_numpy, numpy_to_vtk

ROOT=Path(__file__).resolve().parent.parent
BASE=ROOT.parent/'v01'
GLB=ROOT/'arenoceto-v02-skinned-animated-LOD0.glb'
TEX=BASE/'textures/arenoceto-v01-handpaint-atlas.png'
PREV=ROOT/'previews';PREV.mkdir(parents=True,exist_ok=True)

class Reader:
    def __init__(self,p):
        data=p.read_bytes();assert data[:4]==b'glTF';assert struct.unpack_from('<I',data,8)[0]==len(data)
        n,typ=struct.unpack_from('<I4s',data,12);assert typ==b'JSON'
        self.j=json.loads(data[20:20+n]);idx=20+n
        n,typ=struct.unpack_from('<I4s',data,idx);assert typ==b'BIN\0'
        self.raw=data[idx+8:idx+8+n]
        assert len(self.raw)>=self.j['buffers'][0]['byteLength']
        self.hash=hashlib.sha256(data).hexdigest()
    def array(self,idx):
        ac=self.j['accessors'][idx];view=self.j['bufferViews'][ac['bufferView']]
        dt={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[ac['componentType']]
        dim={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[ac['type']]
        return np.frombuffer(self.raw,dtype=dt,count=ac['count']*dim,offset=view.get('byteOffset',0)+ac.get('byteOffset',0)).reshape((-1,dim)).copy()

class Animator:
    def __init__(self,reader):
        self.r=reader;self.j=reader.j
        self.skin=self.j['skins'][0]
        prim=self.j['meshes'][0]['primitives'][0]
        attrs=prim['attributes']
        self.vertices=reader.array(attrs['POSITION']).astype(np.float64)
        self.uv=reader.array(attrs['TEXCOORD_0']).astype('float32')
        self.joints=reader.array(attrs['JOINTS_0']).astype(np.int32)
        self.weights=reader.array(attrs['WEIGHTS_0']).astype(np.float64)
        self.indices=reader.array(prim['indices']).astype(np.int32).reshape(-1)
        self.ibms=reader.array(self.skin['inverseBindMatrices']).astype('float64').reshape(-1,4,4).transpose((0,2,1))
        self.node_joint_idx={node:i for i,node in enumerate(self.skin['joints'])}
        self.parent={}
        for i,n in enumerate(self.j['nodes']):
            for c in n.get('children',[]):self.parent[c]=i
        self.anim_names={a['name']:i for i,a in enumerate(self.j['animations'])}
        self.verts_h=np.column_stack((self.vertices,np.ones(len(self.vertices))))
        self.mesh=self.j['nodes'][1]
        self.name='arenoceto'
    def sample_channel(self,anim,channel,t):
        sampler=anim['samplers'][channel['sampler']]
        ts=self.r.array(sampler['input'])[:,0]
        values=self.r.array(sampler['output'])
        if t<=ts[0]:return values[0]
        if t>=ts[-1]:return values[-1]
        i=int(np.searchsorted(ts,t,side='right')-1)
        a=float((t-ts[i])/(ts[i+1]-ts[i]))
        x=(1-a)*values[i]+a*values[i+1]
        if channel['target']['path']=='rotation':x/=np.linalg.norm(x)
        return x
    @staticmethod
    def transform(tr,qt):
        x,y,z,w=qt;x2=x*x;y2=y*y;z2=z*z
        T=np.eye(4)
        T[:3,:3]=[[1-2*(y2+z2),2*(x*y-z*w),2*(x*z+y*w)],
                  [2*(x*y+z*w),1-2*(x2+z2),2*(y*z-x*w)],
                  [2*(x*z-y*w),2*(y*z+x*w),1-2*(x2+y2)]]
        T[:3,3]=tr
        return T
    def deform(self,name,t):
        anim=self.j['animations'][self.anim_names[name]]
        trs={}
        for ch in anim['channels']:
            tgt=ch['target'];trs.setdefault(tgt['node'],{})[tgt['path']]=self.sample_channel(anim,ch,t)
        world={}
        def world_t(node_id):
            if node_id in world:return world[node_id]
            node=self.j['nodes'][node_id]
            tr=np.array(trs.get(node_id,{}).get('translation',node.get('translation',[0,0,0])))
            rot=np.array(trs.get(node_id,{}).get('rotation',node.get('rotation',[0,0,0,1])))
            local=self.transform(tr,rot)
            if node_id in self.parent:mat=world_t(self.parent[node_id])@local
            else:mat=local
            world[node_id]=mat
            return mat
        mats=np.array([world_t(k)@self.ibms[i] for i,k in enumerate(self.skin['joints'])])
        # True linear-blend skinning, per vertex, across a maximum of four joints.
        skinned=np.zeros((len(self.vertices),4),dtype=np.float64)
        for k in range(4):
            skinned+=np.einsum('nij,nj->ni',mats[self.joints[:,k]],self.verts_h)*self.weights[:,k,None]
        return np.asarray(skinned[:,:3],dtype=np.float32)

def verify(reader,anim):
    j=reader.j;a=j['meshes'][0]['primitives'][0]['attributes'];skin=j['skins'][0]
    assert 'JOINTS_0' in a and 'WEIGHTS_0' in a and 'TEXCOORD_0' in a
    assert len(j['skins'])==1 and len(skin['joints'])==16
    assert len(j['animations'])==20
    assert len(j['meshes'])==1 and len(j['images'])==1 and j['images'][0]['mimeType']=='image/png'
    assert anim.vertices.shape==(6156,3) and anim.uv.shape==(6156,2)
    assert len(anim.indices)==6156
    assert np.max(np.abs(anim.weights.sum(axis=1)-1))<1e-5
    assert np.max(anim.joints)<16
    assert np.any((anim.weights>.05)&(anim.weights<.95)), 'Not a true blended skin'
    assert np.all(np.isfinite(anim.ibms))
    # Compare original exact embedded texture bytes, exported geometry, UV and topology.
    base=Reader(BASE/'arenoceto-v01-textured-blockout.glb')
    pbase=base.j['meshes'][0]['primitives'][0]
    for key in ['POSITION','TEXCOORD_0']:
        assert np.array_equal(base.array(pbase['attributes'][key]),reader.array(a[key])),key
    assert np.array_equal(base.array(pbase['indices']),reader.array(j['meshes'][0]['primitives'][0]['indices']))
    img0=base.j['bufferViews'][base.j['images'][0]['bufferView']]
    img1=j['bufferViews'][j['images'][0]['bufferView']]
    assert base.raw[img0['byteOffset']:img0['byteOffset']+img0['byteLength']]==reader.raw[img1['byteOffset']:img1['byteOffset']+img1['byteLength']]
    # Bind pose comparison. Actual initial frame of 'idle' has a small breath motion;
    # compare inverse bind matrices directly to bind transforms instead.
    expected={}
    for ji,node_id in enumerate(skin['joints']):
        node=j['nodes'][node_id]
        tr=np.array(node['translation']);parent=anim.parent.get(node_id)
        if parent and parent in expected:T=expected[parent]@anim.transform(tr,node['rotation'])
        else:T=anim.transform(tr,node['rotation'])
        expected[node_id]=T
        assert np.allclose(T@anim.ibms[ji],np.eye(4),atol=1e-5),(node['name'],T@anim.ibms[ji])
    metrics={}
    for clip in j['animations']:
        name=clip['name'];times=reader.array(clip['samplers'][0]['input'])[:,0]
        assert np.all(np.diff(times)>0)
        start=anim.deform(name,float(times[0]));middle=anim.deform(name,float(times[len(times)//2]));end=anim.deform(name,float(times[-1]));quarter=anim.deform(name,float(times[len(times)//4]))
        variations=[float(np.max(np.linalg.norm(f-start,axis=1))) for f in [quarter,middle,end]]
        assert max(variations)>.02,(name,variations)
        assert all(np.all(np.isfinite(f)) for f in (start,quarter,middle,end))
        assert min(f[:,1].min() for f in (start,quarter,middle,end))>-40
        if clip.get('extras',{}).get('loop'):
            assert float(np.max(np.linalg.norm(start-end,axis=1)))<.001,(name,'loop seam')
        for ch in clip['channels']:
            out=reader.array(clip['samplers'][ch['sampler']]['output'])
            assert np.all(np.isfinite(out))
            if ch['target']['path']=='rotation':assert np.max(abs(np.linalg.norm(out,axis=1)-1))<.0005
        metrics[name]={'duration_seconds':float(times[-1]),'channels':len(clip['channels']),
                       'max_vertex_movement_m':round(max(variations),4),
                       'loop':bool(clip.get('extras',{}).get('loop'))}
    manifest=json.loads((ROOT/'manifest.json').read_text());assert manifest['sha256']==reader.hash
    metricsfile=ROOT/'animation-validation.json'
    metricsfile.write_text(json.dumps({'glb_sha256':reader.hash,'weighted_skin_verified':True,
                'original_texture_bytes_identical':True,'original_mesh_uv_and_indices_identical':True,
                'joint_inverse_bind_verified':True,'all_clip_channels_and_loop_seams_valid':True,
                'clips':metrics},indent=2,ensure_ascii=False)+'\n')
    print('VALIDATION PASSED',len(metrics),'true skinned animations, max deformation in meters:',{k:v['max_vertex_movement_m'] for k,v in metrics.items()})
    return metrics

def draw_views(anim):
    # VTK importer is used for material/texture: mesh actors come from THE EXPORTED GLB,
    # then per-vertex coordinates are replaced by weighted CPU-skinning sampled from
    # its exported animation channels (VTK 9.6 importer exposes animation names but
    # does not update the skinned polydata on UpdateAtTimeValue).
    win=vtk.vtkRenderWindow();win.SetOffScreenRendering(True);win.SetSize(1040,700);win.SetMultiSamples(0)
    ren=vtk.vtkRenderer();win.AddRenderer(ren)
    imp=vtk.vtkGLTFImporter();imp.SetFileName(str(GLB));imp.SetRenderWindow(win);imp.Update()
    assert imp.GetNumberOfAnimations()==20
    actors=ren.GetActors();actors.InitTraversal();actor=actors.GetNextActor();assert actor is not None
    mesh=actor.GetMapper().GetInput();pts=mesh.GetPoints();assert pts.GetNumberOfPoints()==len(anim.vertices)
    arr=vtk_to_numpy(pts.GetData())
    assert np.allclose(arr,anim.vertices,atol=1e-6)
    texture=actor.GetProperty().GetTexture('albedoTex');assert texture is not None,'must preserve GLB base-color UV texture'
    ren.SetBackground(.93,.91,.85);ren.SetBackground2(.995,.986,.955);ren.GradientBackgroundOn()
    lamp=vtk.vtkLight();lamp.SetLightTypeToSceneLight();lamp.SetPosition(40,52,42);lamp.SetFocalPoint(0,4,0);lamp.SetIntensity(1.18);ren.AddLight(lamp)
    rim=vtk.vtkLight();rim.SetLightTypeToSceneLight();rim.SetPosition(-35,15,-50);rim.SetIntensity(.7);ren.AddLight(rim)
    cam=ren.GetActiveCamera();cam.ParallelProjectionOn();cam.SetViewUp(0,1,0)
    def camera(which):
        if which=='side':cam.SetPosition(0,10,70);cam.SetFocalPoint(-1,4,0);cam.SetParallelScale(16.5)
        elif which=='front':cam.SetPosition(66,14,0);cam.SetFocalPoint(3,4,0);cam.SetParallelScale(14)
        else:cam.SetPosition(42,24,52);cam.SetFocalPoint(-1,5,0);cam.SetParallelScale(20.0)
        ren.ResetCameraClippingRange()
    def snapshot(clip,t,view='three_quarter',resolution=None):
        camera(view)
        vals=anim.deform(clip,t)
        arr[:]=vals
        pts.GetData().Modified();pts.Modified();mesh.Modified()
        # Update normals for hard-faceted triangles so rotating surfaces shade correctly.
        normals=np.cross(vals[1::3]-vals[::3],vals[2::3]-vals[::3])
        lens=np.linalg.norm(normals,axis=1)
        normals=normals/np.maximum(lens[:,None],1e-7)
        n=np.repeat(normals,3,axis=0)
        mesh.GetPointData().SetNormals(numpy_to_vtk(np.asarray(n,dtype=np.float32),deep=True))
        ren.ResetCameraClippingRange();win.Render()
        f=vtk.vtkWindowToImageFilter();f.SetInput(win);f.SetInputBufferTypeToRGB();f.ReadFrontBufferOff();f.Update()
        image=vtk_to_numpy(f.GetOutput().GetPointData().GetScalars()).reshape((700,1040,3))
        # VTK bitmap originates bottom-left
        pil=Image.fromarray(np.flipud(image).copy())
        return pil
    # three animated frames of actual glb material in standard review positions
    from PIL import ImageOps
    for view,t,clip in [('side',.8,'swim_sand'),('front',1.6,'filter_feed'),('three_quarter',2.2,'breach')]:
        im=snapshot(clip,t,view)
        d=ImageDraw.Draw(im);d.rectangle((0,0,1040,58),fill=(35,38,33));d.text((26,22),'WILDHAVEN / ARENOCETO v02 / '+view.upper()+' / '+clip.upper()+' / GLB ANIMADO REAL',fill=(245,226,184))
        im.save(PREV/('arenoceto-v02-real-animated-'+view+'.png'),optimize=True)
    # GIFs from exported binary's glTF skin and clip samplers, not pre-baked pictures.
    gifclips=['swim_sand','filter_feed','breach','tail_slam','dive','threat_display']
    for clip in gifclips:
        duration=float(anim.r.array(anim.j['animations'][anim.anim_names[clip]]['samplers'][0]['input'])[-1,0])
        frames=[]
        for i in range(16):
            t=duration*i/16
            im=snapshot(clip,t)
            im=im.resize((624,420),Image.Resampling.LANCZOS)
            d=ImageDraw.Draw(im)
            d.rectangle((0,0,624,37),fill=(33,36,32))
            d.text((13,11),'ARENOCETO v02  |  '+clip.upper()+'  |  GLB REAL',fill=(247,223,180))
            frames.append(im)
        frames[0].save(PREV/('arenoceto-v02-'+clip+'-real-glb.gif'),save_all=True,
                    append_images=frames[1:],duration=170,loop=0,optimize=True)
        print('GIF',clip,(PREV/('arenoceto-v02-'+clip+'-real-glb.gif')).stat().st_size)
    side=Image.open(PREV/'arenoceto-v02-real-animated-side.png')
    front=Image.open(PREV/'arenoceto-v02-real-animated-front.png')
    three=Image.open(PREV/'arenoceto-v02-real-animated-three_quarter.png')
    sheet=Image.new('RGB',(1560,430),(37,38,35))
    for i,(image,label) in enumerate([(side,'PERFIL / SWIM'),(front,'FRENTE / FILTER'),(three,'3/4 / BREACH')]):
        im=image.resize((520,350),Image.Resampling.LANCZOS);sheet.paste(im,(i*520,40))
        ImageDraw.Draw(sheet).text((i*520+18,405),label,fill=(238,216,181))
    sheet.save(PREV/'arenoceto-v02-three-real-animated-poses.png',optimize=True)
    win.Finalize()

def main():
    r=Reader(GLB);anim=Animator(r)
    metrics=verify(r,anim)
    draw_views(anim)
    manifest=json.loads((ROOT/'manifest.json').read_text())
    manifest['validation']={'independent_animation_channels':True,'rendered_actual_exported_skin_samplers':True,
                            'real_glb_snapshots':3,'real_glb_gif_clips':6,
                            'source_version_sha256_verified':True}
    (ROOT/'manifest.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n')
    print('FINISHED',manifest['animation_count'],'clips, GLB',manifest['sha256'])
if __name__=='__main__':main()
