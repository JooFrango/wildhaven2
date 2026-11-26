"""Audit exported geometry, its contacts with pinned originals and the review-only ocean datum."""
import hashlib
import io
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
from scipy.spatial import cKDTree

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from perimeter import A, BASE, CELLS, CORNERS, GLB, ROOT, SEA, WORLD, PILOTS, center, dump, knots, source, surface
from terrain import profiles
from vegetation import Surface

def faces(g,pr):
    return g.array(pr['indices']).reshape(-1,3)

def edges(f):
    pairs=np.vstack([f[:,[0,1]],f[:,[1,2]],f[:,[2,0]]])
    return np.unique(np.sort(pairs,axis=1),axis=0,return_counts=True)

def components(v,f):
    unique,remap=np.unique(v,axis=0,return_inverse=True)
    f=remap[f]
    es,counts=edges(f)
    assert (counts==2).all(),'solid with open or non-manifold edges'
    mat=coo_matrix((np.ones(len(es)),(es[:,0],es[:,1])),shape=(len(unique),)*2)
    n,labels=connected_components(mat,directed=False)
    return [unique[labels==i] for i in range(n)]

def validate(kind):
    tiles=json.loads((ROOT/'prototipos.json').read_text('utf8'))['tiles']
    path=ROOT/next(t['model'] for t in tiles if t['id']==kind);g=GLB(path)
    assert g.doc['asset']['version']=='2.0'
    assert not g.doc.get('skins') and not g.doc.get('animations')
    for img in g.doc['images']:
        view=g.doc['bufferViews'][img['bufferView']]
        start=view.get('byteOffset',0)
        with Image.open(io.BytesIO(g.bin[start:start+view['byteLength']])) as im:im.verify()
    by_mesh={node['mesh']:node for node in g.doc['nodes']}
    pr=g.primitive('terrain');ground=Surface(g,pr)
    solids=[];plants=0;vertices=0;triangles=0;instanced_tris=0
    land=g.array(pr['attributes']['POSITION']).astype(float)
    for mi,mesh in enumerate(g.doc['meshes']):
        node=by_mesh[mi];role=node['extras']['role']
        assert role in {'terrain','rock','arch','ice','vegetation'}
        for p in mesh['primitives']:
            at=p['attributes']
            assert {'POSITION','NORMAL','COLOR_0','TEXCOORD_0'}<=at.keys()
            v=g.array(at['POSITION']).astype(float);uv=g.array(at['TEXCOORD_0']);n=g.array(at['NORMAL'])
            assert np.isfinite(v).all() and np.isfinite(uv).all() and np.ptp(uv,axis=0).min()>.001
            assert (abs(np.linalg.norm(n,axis=1)-1)<.0001).all()
            f=faces(g,p);assert f.min()>=0 and f.max()<len(v)
            t=v[f];norm=np.cross(t[:,1]-t[:,0],t[:,2]-t[:,0])
            assert np.linalg.norm(norm,axis=1).min()>1e-6,(kind,mesh['name'],'degenerate')
            vertices+=len(v);triangles+=len(f);copies=1
            if role=='terrain':
                assert (norm[:,1]>0).all()
                assert abs(norm[:,1].sum()/2-3*A*2500)<1
                es,counts=edges(f);assert counts.max()==2
                border=v[es[counts==1]][:,:,[0,2]]
                normals=(CORNERS+np.roll(CORNERS,-1,axis=0))/(2*A)
                assert (abs((border.mean(1)@normals.T).max(1)-A)<.003).all()
            elif role=='vegetation':
                attr=node['extensions']['EXT_mesh_gpu_instancing']['attributes']
                pos=g.array(attr['TRANSLATION']);copies=len(pos);plants+=copies
                y,_=ground.sample(pos[:,[0,2]])
                assert np.isfinite(y).all() and np.max(abs(pos[:,1]+.15-y))<.007
                rad=np.max(np.linalg.norm(v[:,[0,2]],axis=1))*g.array(attr['SCALE'])[:,0]
                margin=A-(pos[:,[0,2]]@((CORNERS+np.roll(CORNERS,-1,axis=0))/(2*A)).T).max(1)
                assert np.min(margin-rad)>0,(kind,'outer canopy')
            else:
                assert (v[:,[0,2]]@((CORNERS+np.roll(CORNERS,-1,axis=0))/(2*A)).T).max()<=A
                for piece in components(v,f):
                    xz=piece[:,[0,2]];bed,_=ground.sample(xz)
                    assert np.isfinite(bed).all()
                    if role=='ice':assert (piece[:,1]-bed).min()>0 and piece[:,1].min()<SEA<piece[:,1].max()
                    else:
                        assert (piece[:,1]-bed).min()<0 and (piece[:,1]-bed).max()>0
                    solids.append((xz.min(0),xz.max(0),role))
                if role=='arch':
                    # A real opening: horizontal ray beneath the central span crosses no arch triangles.
                    from terrain import basis
                    tangent,out=basis(kind)
                    u=v[:,[0,2]]@tangent
                    u0=(u.min()+u.max())*.5
                    z0=v[:,1].min()+.32*np.ptp(v[:,1])
                    flat=np.stack((u,v[:,1]),axis=1)[f];a=flat[:,0]
                    b=flat[:,1]-a;c=flat[:,2]-a;d=np.array([u0,z0])-a
                    det=b[:,0]*c[:,1]-b[:,1]*c[:,0];valid=abs(det)>1e-8
                    s=(d[:,0]*c[:,1]-d[:,1]*c[:,0])[valid]/det[valid]
                    t=(b[:,0]*d[:,1]-b[:,1]*d[:,0])[valid]/det[valid]
                    assert not np.any((s>=0)&(t>=0)&(s+t<=1))
            instanced_tris+=len(f)*copies
    # A disjoint projected footprint proves the formations do not pierce each other.
    # Where axis-aligned boxes meet, use separating axes of the actual projected hulls.
    from scipy.spatial import ConvexHull
    hulls=[]
    for mi,m in enumerate(g.doc['meshes']):
        if by_mesh[mi]['extras']['role'] in ('arch','ice','rock'):
            p=m['primitives'][0];v=g.array(p['attributes']['POSITION'])
            for piece in components(v,faces(g,p)):
                pts=piece[:,[0,2]].astype(float);hulls.append(pts[ConvexHull(pts).vertices])
    for i,a in enumerate(hulls):
        for b in hulls[i+1:]:
            if np.any(a.max(0)<b.min(0)) or np.any(b.max(0)<a.min(0)):continue
            e=np.vstack([np.roll(h,-1,axis=0)-h for h in (a,b)])
            ax=e[:,[1,0]]*[-1,1];aa=a@ax.T;bb=b@ax.T
            assert np.any((aa.max(0)<bb.min(0))|(bb.max(0)<aa.min(0))),kind
    seams=[]
    for rec in profiles(kind):
        old=rec['tile'];origin=center(*PILOTS[kind]);sg=GLB(source(old));sp=surface(sg,old)
        orig=sg.array(sp['attributes']['POSITION']).astype(float)
        orig[:,[0,2]]+=np.array([old['center_x'],old['center_z']])-origin
        a,b=rec['a'],rec['b'];ix=knots(land,a,b);jx=knots(orig,a,b)
        assert len(ix)==len(jx)
        dist=np.linalg.norm(land[ix]-orig[jx],axis=1)
        assert dist.max()<.03
        gx=g.array(pr['attributes']['COLOR_0'])[ix,:3]
        color=float(np.max(abs(gx-rec['c'])))
        assert color<.006
        # Independent triangle-plane derivative on each interval, both sides of the seam.
        def gradient(v,f):
            xz=v[:,[0,2]]-a;mask=(abs(xz@rec['inward'])<.015)[f]
            good=mask.sum(1)==2;tri=v[f[good]]
            mid=((xz@rec['axis'])[f[good]]*mask[good]).sum(1)/2
            norm=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0])
            slopes=-(norm[:,[0,2]]@rec['inward'])/norm[:,1]
            return slopes[np.argsort(mid)]
        gn=gradient(land,faces(g,pr));go=gradient(orig,faces(sg,sp))
        assert gn.shape==go.shape and np.isfinite(gn).all()
        seams.append(dict(source=old['id'],knots=len(ix),max_height_m=float(abs(land[ix,1]-orig[jx,1]).max()),
                    max_distance_m=float(dist.max()),max_slope_angle_delta_deg=float(np.max(abs(np.degrees(np.arctan(gn)-np.arctan(go))))),
                    max_linear_rgb_delta=color,sha256=sg.sha))
    assert land[:,1].min()<SEA<land[:,1].max()
    return dict(file='models/'+path.name,sha256=g.sha,bytes=path.stat().st_size,vertices=vertices,triangles=triangles,
        triangles_with_instances=instanced_tris,plant_instances=plants,meshes=len(g.doc['meshes']),solid_components=len(solids),
        texture_images=len(g.doc['images']),bones=0,clips=0,range_y_m=[float(land[:,1].min()),float(land[:,1].max())],seams=seams)

if __name__=='__main__':
    plan=json.loads((ROOT/'perimetro.json').read_text('utf8'))
    assert [len(plan['boundary']),len(plan['slots']),sum(len(r['contacts']) for r in plan['slots'])]==[71,77,148]
    water=json.loads((ROOT/'prototipos.json').read_text('utf8'))['water']
    assert water['level_m']==plan['sea_level_m']==SEA
    assert min(e['height_m'][0] for r in plan['slots'] for e in r['contacts'])>SEA
    pinned=json.loads((WORLD/'hunters-village-v01/base-source.json').read_text('utf8'))
    for r in plan['boundary']:
        t=CELLS[(r['q'],r['r'])]
        expected=t['sha256'] if t.get('regionId')=='tropical-south' else pinned['files']['detailed/'+t['id'].lower()+'_v12.glb']['sha256']
        actual=hashlib.sha256(source(t).read_bytes()).hexdigest()
        assert r['sha256']==actual==expected
    base=plan['base_commit']
    paths=subprocess.check_output(['git','-C',str(ROOT),'diff','--name-only',base,'--','../../'],text=True).splitlines()
    assert all(p.startswith('world/coast-v01/') for p in paths),paths
    models=[]
    approved={'glacial':'80c2fc5da01e72b6ca5beca8394f2434e788ec139cf8a01697c6c6f2cf8f59a0',
              'arcos':'eeb6ff51bdaec566336325add6ff070244eb8c5c15a6257e9e26014d25e205ed',
              'dunas':'5ac7be885deeb238a32e12e84a1dc329db1a4ba91ec51011e8e97bfd25ac1e35',
              'praia':'cc165202af84b804ce5142d1254650353560ac117c4b6ec9861d148763cf392b',
              'falesia':'66fbdfbe1fd21f067f1a7bbc18136f861ef7513aaeadf29107f3324bafe6c091'}
    for kind in PILOTS:
        m=validate(kind)
        if kind in approved:assert m['sha256']==approved[kind],kind
        m['art_status']='approved' if kind in approved else 'awaiting director review'
        models.append(m);print(kind,m['triangles'],m['seams'],flush=True)
    dump(ROOT/'manifest.json',dict(version='v02',stage='five approved prototypes',sea_m=SEA,original_boundary_hashes_verified=71,
        composition_sha256=hashlib.sha256((WORLD/'tropical-south-v01/composition_195.json').read_bytes()).hexdigest(),models=models))
