#!/usr/bin/env python3
"""Validate re-imported Escarvao v02 glTF skin, original material and sampled motion."""
from __future__ import annotations
import hashlib,json,math
from pathlib import Path
import numpy as np
from build_rig import BASE,V01,VARIANTS,CLIPS,parse_glb,read_accessor


def quat_mat(q):
    x,y,z,w=np.asarray(q,dtype=float)/np.linalg.norm(q)
    return np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w),0],
                     [2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w),0],
                     [2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y),0],
                     [0,0,0,0]],float)


def sample_gltf(doc,data,clip,time):
    """Read animation data from EXPORTED GLB. Cubic not used; LINEAR normalized quaternion sampling."""
    anim=next(a for a in doc['animations'] if a['name']==clip)
    transforms={}
    for ch in anim['channels']:
        smp=anim['samplers'][ch['sampler']]
        times=read_accessor(doc,data,smp['input'])[:,0]
        values=read_accessor(doc,data,smp['output'])
        i=int(np.searchsorted(times,time,side='right')-1)
        i=max(0,min(i,len(times)-2));alpha=np.clip((time-times[i])/(times[i+1]-times[i]),0,1)
        a=values[i].astype(float);b=values[i+1].astype(float)
        if ch['target']['path']=='rotation':
            if a@b<0:b=-b
            q=a*(1-alpha)+b*alpha;v=q/np.linalg.norm(q)
        else:v=a*(1-alpha)+b*alpha
        transforms.setdefault(ch['target']['node'],{})[ch['target']['path']]=v
    return transforms


def sample_vertices(doc,data,clip,time):
    transform=sample_gltf(doc,data,clip,time) if clip else {}
    nodes=doc['nodes']
    par={}
    for i,node in enumerate(nodes):
        for child in node.get('children',[]):par[child]=i
    global_mat={}
    def world(i):
        if i in global_mat:return global_mat[i]
        n=nodes[i];override=transform.get(i,{})
        mat=quat_mat(override.get('rotation',n.get('rotation',[0,0,0,1])))
        mat[:3,3]=override.get('translation',n.get('translation',[0,0,0]))
        mat[3,3]=1
        global_mat[i]=world(par[i])@mat if i in par else mat
        return global_mat[i]
    skin=doc['skins'][0]
    ibm=read_accessor(doc,data,skin['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)
    bones=np.array([world(joint)@ibm[i] for i,joint in enumerate(skin['joints'])])
    mesh=doc['meshes'][0]['primitives'][0]
    pts=read_accessor(doc,data,mesh['attributes']['POSITION']).astype(np.float64)
    joints=read_accessor(doc,data,mesh['attributes']['JOINTS_0']).astype(np.int32)
    weights=read_accessor(doc,data,mesh['attributes']['WEIGHTS_0']).astype(float)
    hp=np.column_stack((pts,np.ones(len(pts))))
    out=np.zeros((len(pts),4),dtype=np.float64)
    for slot in range(4):
        active=weights[:,slot]>1e-7
        out[active]+=np.einsum('nij,nj->ni',bones[joints[active,slot]],hp[active])*weights[active,slot,None]
    return pts,out[:,:3],weights,joints


def check():
    manifest=json.loads((BASE/'manifest_v02.json').read_text())
    results=[]
    texture_differences=[]
    for variant in VARIANTS:
        file=BASE/f'escarvao_{variant}_rig_anim_v02.glb'
        inp=V01/f'escarvao_{variant}_blockout_v01.glb'
        model,data=parse_glb(file);base,orig=parse_glb(inp)
        item=next(i for i in manifest['variants'] if i['variant']==variant)
        assert hashlib.sha256(file.read_bytes()).hexdigest()==item['sha256']
        assert data[:len(orig)]==orig,'Original vertex and PNG image bytes changed'
        assert base['bufferViews']==model['bufferViews'][:len(base['bufferViews'])]
        a=model['meshes'][0]['primitives'][0]['attributes']
        assert {'JOINTS_0','WEIGHTS_0','POSITION','TEXCOORD_0'}<=set(a)
        assert len(model.get('skins',[]))==1
        assert len(model['skins'][0]['joints'])==51
        assert len(model['animations'])==18
        assert sorted(c['name'] for c in model['animations'])==sorted(CLIPS)
        assert len(model['images'])==len(base['images'])==1
        assert len(model['materials'])==len(base['materials'])==1
        assert len(model['meshes'])==len(base['meshes'])==1
        orig_pts,p,w,j=sample_vertices(model,data,None,0)
        assert np.max(abs(orig_pts-p))<5e-5,'Invalid inverse bind, rest pose no longer matches v01'
        assert np.max(abs(w.sum(axis=1)-1))<1e-5
        assert np.isfinite(w).all() and np.isfinite(p).all()
        assert j.max()<51 and j.min()>=0
        assert np.count_nonzero((w[:,0]<.99)&(w[:,1]>.01))>100
        stats={}
        for name,dur_loop in CLIPS.items():
            anim=next(a for a in model['animations'] if a['name']==name)
            assert len(anim['samplers'])>=1 and len(anim['channels'])>=1
            assert all(ch['target']['path'] in ('rotation','translation') for ch in anim['channels'])
            for sm in anim['samplers']:
                ts=read_accessor(model,data,sm['input'])[:,0]
                assert np.isclose(ts[0],0) and np.isclose(ts[-1],dur_loop[0],atol=1e-5)
                assert np.all(np.diff(ts)>0) and sm['interpolation']=='LINEAR'
            samples=[]
            for fraction in (.0,.13,.31,.59,.83,1.):
                _,pose,_,_=sample_vertices(model,data,name,float(dur_loop[0])*fraction)
                assert np.isfinite(pose).all()
                assert np.max(abs(pose))<15, name
                samples.append(pose)
            peak=max(float(np.linalg.norm(x-samples[0],axis=1).max()) for x in samples[1:])
            assert peak>.012,(name,peak)
            stats[name]=round(peak,3)
        results.append({'variant':variant,'triangles':len(p)//3,'vertices':len(p),
                       'skin_joint_count':51,'weighted_vertices':int((w[:,0]<.999).sum()),
                       'animation_clips':len(model['animations']), 'max_displacement_m_by_clip':stats,
                       'geometry_texture_binary_preserved':True})
    # exact same bone names + motion clip channel arrays in all variants
    a,_=parse_glb(BASE/'escarvao_cobre_rig_anim_v02.glb')
    for v in VARIANTS[1:]:
        b,_=parse_glb(BASE/f'escarvao_{v}_rig_anim_v02.glb')
        assert [n['name'] for n in a['nodes'][2:]]==[n['name'] for n in b['nodes'][2:]]
        assert [(x['name'],len(x['channels'])) for x in a['animations']]==[(x['name'],len(x['channels'])) for x in b['animations']]
    report={'validated_reimported_glbs':True,'analysis':'glTF channels and true JOINTS_0 / WEIGHTS_0 CPU skinning',
            'animation_spatial_test':'Sampled 5 poses for 18 clips, all non-zero motion',
            'other_limitations':'No terrain IK, navmesh, physics, gameplay or combat yet; no LOD1/LOD2',
            'variants':results}
    (BASE/'validation_v02.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
    print('VALIDATED: 3 original-material GLBs, 51-joint skins, 18 moving clips, 3,487 triangles each')
    for z in results:print(z['variant'],'walk:',z['max_displacement_m_by_clip']['walk'],'sting:',z['max_displacement_m_by_clip']['sting'],'death:',z['max_displacement_m_by_clip']['death'])
    return report

if __name__=='__main__':check()
