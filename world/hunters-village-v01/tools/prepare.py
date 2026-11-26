"""Recover exact v12 edge constraints and complete temperate specimens from FX_20."""
import io
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
from scipy.spatial import Delaunay, cKDTree

from glb import BASE, HERE, CENTER, NEIGHBORS, GLB, dump
from layout import LOTS, PATHS

CACHE = HERE/'.build'
A = 2500*math.sqrt(3)/2
SEED = 71170


def smooth(a):
    t=np.clip(a,0,1)
    return t*t*(3-2*t)


def color_at_vertices(glb, prim):
    att=prim['attributes']
    c=glb.array(att['COLOR_0'])[:,:3].copy()
    pbr=glb.doc['materials'][prim['material']]['pbrMetallicRoughness']
    c*=pbr.get('baseColorFactor',[1,1,1,1])[:3]
    if 'baseColorTexture' in pbr:
        spec=pbr['baseColorTexture']
        tex=glb.doc['textures'][spec['index']]
        view=glb.doc['bufferViews'][glb.doc['images'][tex['source']]['bufferView']]
        start=view.get('byteOffset',0)
        pix=np.asarray(Image.open(io.BytesIO(glb.bin[start:start+view['byteLength']])).convert('RGB'))/255.
        uv=glb.array(att['TEXCOORD_'+str(spec.get('texCoord',0))]).copy()
        samp=glb.doc.get('samplers',[{}])[tex.get('sampler',0)]
        for k,axis in enumerate(['wrapS','wrapT']):
            uv[:,k]=uv[:,k].clip(0,1) if samp.get(axis)==33071 else uv[:,k]%1
        ix=np.rint(uv*np.array(pix.shape[1::-1])-uv).astype(int)
        rgb=pix[ix[:,1],ix[:,0]]
        c*=np.where(rgb<=.04045,rgb/12.92,((rgb+.055)/1.055)**2.4)
    return c


def read_edges():
    world=json.loads((BASE/'composition.json').read_text(encoding='utf8'))
    assert world['tile_count']==len(world['tiles'])==170
    by_id={t['id']:t for t in world['tiles']}
    files=json.loads((BASE/'manifest.json').read_text(encoding='utf8'))['files']
    digests={item['id']:item['sha256'] for item in files if item['file'].startswith('detailed/')}
    centers=np.array([[t['center_x'],t['center_z']] for t in world['tiles']])
    dist=np.linalg.norm(centers-CENTER,axis=1)
    assert dist.min()>2*A-.02
    assert {t['id'] for t,d in zip(world['tiles'],dist) if abs(d-2*A)<.02}==set(NEIGHBORS)
    profiles=[]
    for id_ in NEIGHBORS:
        tile=by_id[id_]
        g=GLB(BASE/'detailed'/(id_.lower()+'_v12.glb'))
        assert g.sha==digests[id_]
        displacement=np.array([tile['center_x'],tile['center_z']])-CENTER
        normal=displacement/(2*A)
        tangent=np.array([-normal[1],normal[0]])
        prim=g.primitive('terrain')
        v=g.array(prim['attributes']['POSITION']).astype(float)
        v[:,[0,2]]+=displacement
        loc=v[:,[0,2]]
        ids=np.flatnonzero(abs(loc@normal-A)<.002)
        ids=ids[np.argsort(loc[ids]@tangent)]
        along=loc[ids]@tangent
        ids=ids[np.r_[True,np.diff(along)>.002]]
        ts=loc[ids]@tangent
        assert len(ids)>24 and abs(ts[0]+1250)<.002 and abs(ts[-1]-1250)<.002
        n=g.array(prim['attributes']['NORMAL'])[ids]
        c=color_at_vertices(g,prim)[ids]
        # One geometric inward derivative per boundary segment from its actual neighbor triangle.
        faces=g.array(prim['indices']).ravel().reshape(-1,3)
        boundary=abs(loc@normal-A)<.002
        contact=faces[boundary[faces].sum(1)==2]
        tri=v[contact]
        fn=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0])
        slope=-(fn[:,[0,2]]@normal)/fn[:,1]
        mid=np.sum((loc[contact]@tangent)*boundary[contact],axis=1)/2
        order=np.argsort(mid)
        profiles.append(dict(id=id_,normal=normal,tangent=tangent,t=ts,h=v[ids,1],c=c,
                             gradient=-(n[:,[0,2]]/n[:,1,None])@normal,
                             mid=mid[order],slope=slope[order],sha=g.sha))
    return profiles


def route_distance(points, lines):
    result=np.full(len(points),np.inf)
    for path in lines:
        for a,b in zip(path,path[1:]):
            a,b=np.asarray(a),np.asarray(b)
            delta=b-a
            t=np.clip(((points-a)@delta)/(delta@delta),0,1)
            result=np.minimum(result,np.linalg.norm(points-a-t[:,None]*delta,axis=1))
    return result


def make_terrain(edges):
    rng=np.random.default_rng(SEED)
    normals=np.array([e['normal'] for e in edges])
    def margin(xz): return A-np.max(xz@normals.T,axis=1)
    boundary=np.vstack([A*e['normal']+e['t'][:,None]*e['tangent'] for e in edges])
    boundary=np.unique(np.round(boundary,3),axis=0)
    pts=[boundary, boundary*(1-3.5/A),boundary*(1-24/A)]
    # Triangulate in plan: metre-scale in town, wider spacing through the forest.
    for spacing,rmin,rmax in [(61,210,3000),(12,86,260),(3.8,58,94),(1.15,0,63)]:
        raw=np.arange(-rmax,rmax+spacing,spacing,dtype=float)
        x,z=np.meshgrid(raw,raw)
        grid=np.column_stack((x.ravel(),z.ravel()))
        grid+=rng.uniform(-.28,.28,grid.shape)*spacing
        radius=np.linalg.norm(grid,axis=1)
        pts.append(grid[(radius>=rmin)&(radius<rmax)&(margin(grid)>36)])
    # Approaches begin at the village road network and reach all six sides.
    exits=[(55,33),(55,33),(43,-23),(-42,-38),(-53,22),(-53,22)]
    outer=[]
    for i,e in enumerate(edges):
        end=A*e['normal']
        start=np.array(exits[i])
        path=[start]
        for t in np.linspace(.025,1,40):
            path.append(start*(1-t)+end*t+e['tangent']*math.sin(math.pi*t)*math.sin(t*6+i)*90)
        outer.append(path)
        for a,b in zip(path,path[1:]):
            d=b-a
            side=np.array([-d[1],d[0]])/np.linalg.norm(d)
            for mix in np.arange(0,1,.25):
                c=a+mix*d
                strip=c+np.array([-5.5,-2.0,0,2.0,5.5])[:,None]*side
                pts.append(strip[margin(strip)>38])
    points=np.unique(np.round(np.vstack(pts),3),axis=0)
    tri=Delaunay(points)
    faces=tri.simplices
    # Rounding input to millimetres leaves tiny exterior slivers on straight lines.
    abc=points[faces]
    d1,d2=abc[:,1]-abc[:,0],abc[:,2]-abc[:,0]
    along_side=np.any(np.all(abs(abc@normals.T-A)<.002,axis=1),axis=1)
    faces=faces[((d1[:,0]*d2[:,1]-d1[:,1]*d2[:,0])>1e-9)&~along_side]
    # Signed distance and interpolation along each of the six measured sides.
    ds=np.maximum(A-points@normals.T,0)
    weights=1/np.maximum(ds,.00005)**2.5
    weights/=weights.sum(1,keepdims=True)
    heights=[]; colors=[]
    for i,e in enumerate(edges):
        t=points@e['tangent']
        raw=np.interp(t,e['t'],e['h'])
        deriv=np.interp(t,e['mid'],e['slope'])
        heights.append(raw-deriv*np.minimum(ds[:,i],240)*np.exp(-ds[:,i]/255))
        colors.append(np.column_stack([np.interp(t,e['t'],ch) for ch in e['c'].T]))
    h=(np.array(heights).T*weights).sum(1)
    color=(np.stack(colors,1)*weights[:,:,None]).sum(1)
    rim=smooth((ds.min(1)-3.6)/530)
    x,z=points.T; y=-z
    radius=np.hypot(x,y)
    base=round(float(np.median(h[radius<45])),1)
    urban=smooth((160-radius)/78)
    terrace=lambda a: 2.4*smooth((a+20)/6)+2.4*smooth((a-5)/6)+5.4*smooth((a-13)/8)
    urban_h=terrace(y)-2.7*np.exp(-((x+2-2.2*np.sin((y+18)/11))/2.8)**2)*smooth((-y-7)/7)
    for _,_,lx,ly,w,d,deg,_ in LOTS:
        a=math.radians(deg)
        dx,dy=x-lx,y-ly
        foot=np.maximum(abs(dx*np.cos(a)+dy*np.sin(a))-w/2,abs(-dx*np.sin(a)+dy*np.cos(a))-d/2)
        mask=smooth((2.9-foot)/2.6)
        urban_h=urban_h*(1-mask)+terrace(ly)*mask
    village_paths=[[(px,-py) for px,py in path] for path in PATHS]
    trail=route_distance(points,outer+village_paths)
    square=np.hypot((x+4)/7,(y-1)/4.3)
    dirt=np.maximum(1-smooth((trail-1.15)/1.3),1-smooth((square-.75)/.35))
    dirt*=smooth(ds.min(1)/48)
    wrinkle=np.sin(x*.17+np.sin(y*.23))*.5+np.sin(y*.38+x*.29)*.2
    grass=np.column_stack((.15+.018*wrinkle,.24+.035*wrinkle,.076+.012*wrinkle))
    color=color*(1-urban[:,None])+grass*urban[:,None]
    bed=(1-smooth((abs(x+2-2.2*np.sin((y+18)/11))-1.4)/2.1))*smooth((-y-8)/7)*urban
    color=color*(1-bed[:,None])+np.array([.19,.163,.114])*bed[:,None]
    color=color*(1-dirt[:,None])+np.array([.31,.216,.115])*dirt[:,None]
    # The guarded town ellipse stays clear; taller specimens return gradually outside it.
    forest=smooth((np.hypot(x/1.05,y)-62)/46)*smooth((ds.min(1)-64)/40)*smooth((trail-5)/14)
    # At these border elevations there is no incoming water mesh in any neighbor.
    np.savez_compressed(CACHE/'terrain.npz',xz=points,faces=faces,h=h,rim=rim,urban=urban,
                        town=base+urban_h,color=color,forest=forest,base=base)
    return base,outer


def components(g,name):
    prim=g.primitive(name); v=g.array(prim['attributes']['POSITION']); f=g.array(prim['indices']).reshape(-1,3)
    c=g.array(prim['attributes']['COLOR_0'])
    adj=coo_matrix((np.ones(f.size), (f.ravel(),np.roll(f,1,axis=1).ravel())),shape=(len(v),len(v)))
    count,labels=connected_components(adj,directed=False)
    buckets=np.split(np.argsort(labels[f[:,0]],kind='stable'),np.cumsum(np.bincount(labels[f[:,0]],minlength=count))[:-1])
    pieces=[]
    for idx in buckets:
        ids,inv=np.unique(f[idx],return_inverse=True)
        pieces.append((v[ids].astype(float),inv.reshape(-1,3),c[ids,:3]))
    return pieces


def extract_trees():
    g=GLB(BASE/'detailed/fx_20_v12.glb')
    trunks=components(g,'trunks')
    roots=np.array([v[:len(v)//2].mean(0) for v,_,_ in trunks])
    search=cKDTree(roots[:,[0,2]])
    attached=[[] for _ in trunks]
    for name in ('branches','broadleaf_canopy','conifer_canopy'):
        for v,f,c in components(g,name):
            pos=v[:5].mean(0) if name=='branches' else v.mean(0)
            i=search.query(pos[[0,2]])[1]
            attached[i].append((name,v,f,c))
    chosen=[]; report=[]
    for kind,needed in [('Folhosa',5),('Conifera',3)]:
        count=0
        for i in np.argsort(-search.query(roots[:,[0,2]],k=2)[0][:,1]):
            v,f,c=trunks[i]
            branches=attached[i]
            tags=[b[0] for b in branches]
            if kind=='Folhosa':
                if len(v)!=16 or 'conifer_canopy' in tags or tags.count('branches')+1!=tags.count('broadleaf_canopy') or tags.count('branches')<3: continue
            elif len(v)!=14 or set(tags)!={'conifer_canopy'} or not 5<=len(tags)<=7: continue
            all_v=[];all_f=[];all_c=[]
            for _,vs,fs,cs in [('trunks',v,f,c)]+branches:
                if _=='conifer_canopy':
                    # Original fans are visible from below; orient the outer surface upward.
                    d=np.cross(vs[fs[:,1]]-vs[fs[:,0]],vs[fs[:,2]]-vs[fs[:,0]])
                    if np.median(d[:,1])<0: fs=fs[:,[0,2,1]]
                all_f.extend(fs+len(all_v));all_v.extend(vs-roots[i]);all_c.extend(cs)
            name=f'{kind}_{count+1:02d}'
            np.savez_compressed(CACHE/(name+'.npz'),v=all_v,f=all_f,c=all_c)
            record=dict(name=name,trunk_component=int(i),source_root=roots[i].round(5).tolist(),triangles=len(all_f))
            chosen.append(record);count+=1
            if count==needed: break
        assert count==needed
    return chosen


def main():
    CACHE.mkdir(exist_ok=True)
    edges=read_edges()
    base,outer=make_terrain(edges)
    data=dict(base_commit='5865b5d0e92ec3eef541bfb51f3c1d9d7cbeb258',base_tiles=170,
              id='HV_01',q=7,r=-1,worldCoord=[float(CENTER[0]),0,float(CENTER[1])],village_datum_m=base,
              edges=[dict(id=e['id'],sha256=e['sha'],samples=len(e['t']),height_m=[float(min(e['h'])),float(max(e['h']))]) for e in edges],
              trees=extract_trees(),source_water_meshes_at_border=[])
    dump(HERE/'site.json',data)
    dump(CACHE/'approaches.json',[[[float(x),float(z)] for x,z in line] for line in outer])
    print('Local datum',base,'metres; profiles',[(e['id'],len(e['t'])) for e in edges])

if __name__=='__main__':
    main()

