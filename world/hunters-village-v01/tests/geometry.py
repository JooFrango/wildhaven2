"""Check the exported 3D shapes, the six untouched v12 sources and access to every door."""
import hashlib
import json
import math
import sys
from collections import deque
from pathlib import Path

import numpy as np
from matplotlib.tri import Triangulation
from scipy.ndimage import label
from scipy.spatial import cKDTree

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from glb import BASE,CENTER,HERE,MODELS,QA,GLB,dump
from prepare import A,read_edges
from layout import PATHS


def surface(glb):
    p=glb.doc['meshes'][0]['primitives'][0]
    v=glb.array(p['attributes']['POSITION']).astype(float)
    f=glb.array(p['indices']).reshape(-1,3)
    xz,ii,inv=np.unique(v[:,[0,2]],axis=0,return_index=True,return_inverse=True)
    faces=inv[f][:,::-1]
    grid=Triangulation(xz[:,0],xz[:,1],faces)
    find=grid.get_trifinder()
    def sample(x,z):
        idx=find(x,z)
        q=xz[faces[idx]];d0=q[...,1,:]-q[...,0,:]; d1=q[...,2,:]-q[...,0,:]
        dx=x-q[...,0,0]; dz=z-q[...,0,1]
        det=d0[...,0]*d1[...,1]-d0[...,1]*d1[...,0]
        u=(dx*d1[...,1]-dz*d1[...,0])/det;w=(d0[...,0]*dz-d0[...,1]*dx)/det
        ys=v[ii,1][faces[idx]]
        y=ys[...,0]*(1-u-w)+ys[...,1]*u+ys[...,2]*w
        return np.where(idx<0,np.nan,y)
    return v,f,glb.array(p['attributes']['COLOR_0'])[:,:3],sample


def check_edges(v,f,c):
    rows=[]
    loc=v[:,[0,2]]
    for e in read_edges():
        dist=loc@e['normal']-A;sel=np.flatnonzero(abs(dist)<.002)
        idx=sel[np.argsort(loc[sel]@e['tangent'])]
        t=loc[idx]@e['tangent']
        idx=idx[np.r_[True,np.diff(t)>.002]];t=loc[idx]@e['tangent']
        assert len(t)==len(e['t'])==73
        # Union of both knot sets plus extra probes: the difference is piecewise linear.
        probe=np.unique(np.r_[np.linspace(-1250,1250,1001),t,e['t']])
        dy=np.abs(np.interp(probe,t,v[idx,1])-np.interp(probe,e['t'],e['h']))
        dymax=dy.max()
        dx=max(abs(dist[idx]).max(),abs(t-e['t']).max())
        rgb=np.abs(c[idx]-e['c']).max()
        near=f[(abs(dist[f])<.002).sum(1)==2]
        tri=v[near];normal=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0])
        slope=-(normal[:,[0,2]]@e['normal'])/normal[:,1]
        mid=np.sum((loc[near]@e['tangent'])*(abs(dist[near])<.002),axis=1)/2
        order=np.argsort(mid)
        ds=np.degrees(abs(np.arctan(slope[order])-np.arctan(np.interp(mid[order],e['mid'],e['slope']))))
        assert dymax<.03 and dx<.03,(e['id'],dymax,dx)
        rows.append(dict(neighbor=e['id'],neighbor_sha256=e['sha'],knots=len(t),probes=len(probe),
            max_height_error_m=float(dymax),max_plan_error_m=float(dx),max_linear_rgb_delta=float(rgb),
            max_across_edge_slope_delta_deg=float(ds.max()),p95_slope_delta_deg=float(np.quantile(ds,.95))))
    return rows


def check_trees(sample):
    glb=GLB(MODELS/'hv_01_forest.glb');records=[];root_error=0;overhang=1e9
    normal=np.array([e['normal'] for e in read_edges()])
    for node in glb.doc['nodes']:
        a=node['extensions']['EXT_mesh_gpu_instancing']['attributes']
        pts=glb.array(a['TRANSLATION']).astype(float);sc=glb.array(a['SCALE'])[:,0]
        q=glb.array(a['ROTATION']);yaw=2*np.arctan2(q[:,1],q[:,3])
        assert np.allclose(np.linalg.norm(q,axis=1),1,atol=1e-5)
        h=sample(pts[:,0],pts[:,2]);assert np.isfinite(h).all()
        root_error=max(root_error,float(abs(pts[:,1]-h).max()))
        p=glb.doc['meshes'][node['mesh']]['primitives'][0]
        v=glb.array(p['attributes']['POSITION'])[:,[0,2]]
        for pt,s,ang in zip(pts,sc,yaw):
            ca,sa=np.cos(ang),np.sin(ang)
            geo=(v@np.array([[ca,-sa],[sa,ca]]))*s+pt[[0,2]]
            overhang=min(overhang,float(A-(geo@normal.T).max()))
        records.append(dict(specimen=node['name'],count=len(pts),triangles_per_tree=glb.doc['accessors'][p['indices']]['count']//3))
    assert root_error<.03 and overhang>0,(root_error,overhang)
    return dict(batches=records,count=sum(r['count'] for r in records),max_root_error_m=root_error,
                minimum_foliage_clearance_to_hex_m=overhang,extension='EXT_mesh_gpu_instancing')


def check_access(stage,sample):
    step=.6;xx=np.arange(-54,55,step);zz=np.arange(-51,46,step);x,z=np.meshgrid(xx,zz)
    h=sample(x,z);assert np.isfinite(h).all()
    for cx,cz,w,d,top in stage['walkable']:
        sel=(abs(x-cx)<=w/2+.04)&(abs(z-cz)<=d/2+.04)
        h[sel]=np.maximum(h[sel],top)
    open_=np.ones(x.shape,dtype=bool)
    for bx,bz,w,d,lo,hi in stage['blockers']:
        open_&=~((abs(x-bx)<w/2+.25)&(abs(z-bz)<d/2+.25)&(h+1.68>lo)&(h<hi-.1))
    for lot in stage['lots']:
        cx,cy,cz=lot['anchor'];theta=lot['yaw'];cs,sn=math.cos(theta),math.sin(theta)
        dx=x-cx;dy=cz-z;lx=dx*cs+dy*sn;ly=-dx*sn+dy*cs
        inside=(abs(lx)<lot['bounds_m'][0]/2)&(abs(ly)<lot['bounds_m'][1]/2)
        if lot['floorLift']:h[inside]=np.maximum(h[inside],cy+lot['floorLift'])
        for bx,by,w,d,lo,hi in lot['collision']:
            open_&=~((abs(lx-bx)<w/2+.25)&(abs(ly-by)<d/2+.25)&(h+1.68>cy+lo)&(h<cy+hi-.1))
    def cell(x,z):return (int(np.argmin(abs(zz-z))),int(np.argmin(abs(xx-x))))
    start=cell(-13,23);q=deque([start]);parent={start:None}
    while q:
        j,i=q.popleft()
        for dj,di in ((-1,0),(1,0),(0,-1),(0,1)):
            b,a=j+dj,i+di
            if not(0<=b<h.shape[0] and 0<=a<h.shape[1]) or (b,a) in parent:continue
            if open_[b,a] and abs(h[b,a]-h[j,i])<=.42+.75*step:
                parent[(b,a)]=(j,i);q.append((b,a))
    routes={}
    for lot in stage['lots']:
        cx,cy,cz=lot['anchor'];rot=lot['yaw'];d=lot['bounds_m'][1];p=lot['entranceLocal'][1]
        goal=cell(cx+p*math.sin(rot),cz+p*math.cos(rot))
        assert goal in parent,('entrance',stage['phase'],lot['id'])
        inside=cell(cx+(d/2-.8)*math.sin(rot),cz+(d/2-.8)*math.cos(rot))
        assert inside in parent,('inside',stage['phase'],lot['id'])
        cells=[inside]
        while parent[cells[-1]] is not None:cells.append(parent[cells[-1]])
        cells.reverse()
        # Keep changes in heading and the last point; store real heights for NPC traversal.
        keep=[0]+[k for k in range(1,len(cells)-1) if tuple(np.subtract(cells[k],cells[k-1]))!=tuple(np.subtract(cells[k+1],cells[k]))]+[len(cells)-1]
        routes[lot['id']]=[[round(float(xx[cells[k][1]]),2),round(float(h[cells[k]]),3),round(float(zz[cells[k][0]]),2)] for k in keep]
    return routes


def asset_metrics():
    assets=[]
    for f in sorted(MODELS.rglob('*.glb')):
        g=GLB(f);d=g.doc
        tris=[sum(d['accessors'][p['indices']]['count']//3 for p in m['primitives']) for m in d['meshes']]
        geo=sum(tris)
        drawn=0
        for node in d['nodes']:
            if 'mesh' not in node:continue
            inst=node.get('extensions',{}).get('EXT_mesh_gpu_instancing')
            drawn+=tris[node['mesh']]*(d['accessors'][inst['attributes']['TRANSLATION']]['count'] if inst else 1)
        assets.append(dict(file=f.relative_to(HERE).as_posix(),sha256=g.sha,bytes=f.stat().st_size,
            mesh_triangles=geo,instanced_triangles=drawn,meshes=len(tris),materials=len(d.get('materials',[])),
            textures=len(d.get('textures',[])),skins=len(d.get('skins',[])),clips=len(d.get('animations',[]))))
    return assets


def main():
    world=json.loads((BASE/'composition.json').read_text(encoding='utf8'));site=json.loads((HERE/'site.json').read_text(encoding='utf8'))
    v,f,c,sample=surface(GLB(MODELS/'hv_01_terrain.glb'))
    seams=check_edges(v,f,c);trees=check_trees(sample)
    prog=json.loads((HERE/'progression.json').read_text(encoding='utf8'))
    anchors={};routes={}
    for stage in prog['phases']:
        for lot in stage['lots']:
            old=anchors.setdefault(lot['id'],lot['anchor'])
            assert old==lot['anchor']
        routes[str(stage['phase'])]=check_access(stage,sample)
        stage['availableFacilities']=[lot['id'] for lot in stage['lots']]
        stage['newFacilities']=[lot['id'] for lot in stage['lots'] if lot['firstPhase']==stage['phase']]
        stage['routesUnlocked']=stage['newFacilities']
        stage['expandedFacilities']=[
            [],['hall','forge','store','training','house_a','house_b'],
            ['hall','forge','market','training','tower'],['hall','forge','market','training']
        ][stage['phase']-1]
    dump(HERE/'progression.json',prog)
    prepared=HERE/'.build/approaches.json'
    approaches=(json.loads(prepared.read_text(encoding='utf8')) if prepared.exists() else
                json.loads((HERE/'navigation.json').read_text(encoding='utf8'))['approaches'])
    dump(HERE/'navigation.json',dict(start=[-13,23],coordinateSystem='local glTF X,Y,Z metres',routes=routes,
        approaches=approaches))
    metrics=asset_metrics()
    land=next(a for a in metrics if a['file']=='models/hv_01_terrain.glb')
    tile=dict(id='HV_01',q=7,r=-1,label='Vila dos Hunters',biome='temperate forest',scale_m=5000,
        center_x=float(CENTER[0]),center_z=float(CENTER[1]),worldCoord=site['worldCoord'],
        chunkId='HV_01',regionId='auralis-eastern-range',model_path='world/hunters-village-v01/'+land['file'],
        sha256=land['sha256'],layers={'forest':'models/hv_01_forest.glb','phase':'progression.json'})
    source=json.loads((HERE/'base-source.json').read_text(encoding='utf8'))
    original=[]
    for t in world['tiles']:
        key=t['model_path'].split('world-visual-coherence-v12/',1)[1]
        assert key in source['files']
        original.append(dict(t,model_url='/'+t['model_path']))
    tile['model_url']='/'+tile['model_path']
    comp=dict(world,version='hunters-village-v01',tile_count=171,base_source='base-source.json',tiles=original+[tile],
              shared_edges=world['shared_edges']+[{'a':'HV_01','b':e['neighbor']} for e in seams],shared_edge_count=443)
    assert comp['shared_edge_count']==len(comp['shared_edges']) and len(original)==170
    for old,new in zip(world['tiles'],original):
        assert all(new[k]==val for k,val in old.items() if k!='model_url')
    dump(HERE/'composition_171.json',comp)
    dump(QA/'geometry.json',dict(base_commit=site['base_commit'],base_tiles=170,total_tiles=171,base_connections=437,
        total_connections=443,edge_tolerance_m=.03,seams=seams,trees=trees,
        accessible_lots_by_phase={k:list(v) for k,v in routes.items()},stable_anchors=anchors))
    dump(HERE/'manifest.json',dict(chunkId='HV_01',version=1,baseSource='base-source.json',files=metrics,
        shared_atlas=['textures/village-color.jpg','textures/village-orm.png','textures/village-normal.png'],
        geometryNodes='Wildhaven_Vila_Hunters.blend',composition='composition_171.json',progression='progression.json',
        navigation='navigation.json',geometry_report='tests/geometry.json'))
    print(len(metrics),'GLBs;',trees['count'],'trees; worst edge height m',max(x['max_height_error_m'] for x in seams))
    print('Walkable lots',[(key,len(r)) for key,r in routes.items()])

if __name__=='__main__':main()

