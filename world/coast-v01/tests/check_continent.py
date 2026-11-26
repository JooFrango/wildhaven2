"""Reimport the coastal ring, its locked contacts, the ocean shelves and the SV_E estuary."""
import sys,hashlib,json
from pathlib import Path
from collections import Counter, defaultdict
import numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from ring import *
from glb import dump
from vegetation import Surface
import importlib.util
spec=importlib.util.spec_from_file_location('coast_validate',Path(__file__).with_name('validate.py'))
audit=importlib.util.module_from_spec(spec);spec.loader.exec_module(audit)

catalog=json.loads((ROOT/'viewer/continente/composition.json').read_text('utf8'))
rows={(r['q'],r['r']):r for r in catalog['tiles']}
assert set(rows)==set(SLOTS) and len(rows)==77 and catalog['total']==len(CELLS)+len(rows)
assert catalog['sea_m']==SEA
locked={Path(m['file']).stem.split('-')[0]:m['sha256'] for m in json.loads((ROOT/'manifest.json').read_text('utf8'))['models']}
for k,p in PILOT_FILES.items():assert hashlib.sha256(p.read_bytes()).hexdigest()==locked[k]
parts={};measure=defaultdict(list);intersections=0;plant_total=0;river_check=None

def read_edges(pos,v,c,tag):
    ctr=center(*pos)
    for side,(dq,dr) in enumerate(DIR):
        other=pos[0]+dq,pos[1]+dr
        if other not in rows and other not in CELLS and other not in shelf_cells:continue
        ids=knots(v,*CORNERS[[side,(side+1)%6]])
        parts[pos,side]=(v[ids]+[ctr[0],0,ctr[1]],c[ids],tag)

shelf_cells={tuple(p) for p in catalog['shelf_cells']}
for pos,r in rows.items():
    g=GLB(ROOT/r['model']);assert g.sha==r['sha256']
    pr=g.primitive('terrain');v=g.array(pr['attributes']['POSITION']).astype(float);c=colors(g,pr)
    f=g.array(pr['indices']).reshape(-1,3);tri=v[f]
    area=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0])[:,1]
    assert area.min()>0 and abs(area.sum()/2-3*A*2500)<1
    pairs=np.vstack([f[:,[0,1]],f[:,[1,2]],f[:,[2,0]]]);es,n=np.unique(np.sort(pairs,axis=1),axis=0,return_counts=True)
    assert n.max()==2 and (abs((v[es[n==1]][:,:,[0,2]].mean(1)@NORMALS.T).max(1)-A)<.01).all()
    read_edges(pos,v,c,'litoral')
    if r['approved_pilot']:continue
    land=Surface(g,pr);hulls=[]
    for node in g.doc['nodes']:
        role=node['extras']['role'];m=g.doc['meshes'][node['mesh']]['primitives'][0];attrs=m['attributes']
        pts=g.array(attrs['POSITION']);ff=g.array(m['indices']).reshape(-1,3)
        assert 'TEXCOORD_0' in attrs and np.isfinite(pts).all() and 'material' in m
        assert np.isfinite(g.array(attrs['TEXCOORD_0'])).all()
        tri=pts[ff];assert np.linalg.norm(np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]),axis=1).min()>1e-7
        if role in ('ice','rock'):
            from scipy.spatial import ConvexHull
            for part in audit.components(pts,ff):
                xz=part[:,[0,2]].astype(float);bed=land.sample(xz)[0]
                dy=part[:,1]-bed
                assert np.isfinite(dy).all() and dy.max()>0
                if role=='ice':assert dy.min()>0
                else:assert dy.min()<0
                projected=xz[ConvexHull(xz).vertices]
                for b in hulls:
                    if np.any(projected.max(0)<b.min(0)) or np.any(b.max(0)<projected.min(0)):continue
                    edges=np.vstack([np.roll(i,-1,axis=0)-i for i in (projected,b)])
                    ax=edges[:,[1,0]]*[-1,1];aa=projected@ax.T;bb=b@ax.T
                    assert np.any((aa.max(0)<bb.min(0))|(bb.max(0)<aa.min(0)))
                hulls.append(projected);intersections+=1
        if role=='vegetation':
            inst=node['extensions']['EXT_mesh_gpu_instancing']['attributes'];places=g.array(inst['TRANSLATION']);radius=np.linalg.norm(pts[:,[0,2]],axis=1).max()*g.array(inst['SCALE'])[:,0]
            assert (A-(places[:,[0,2]]@NORMALS.T).max(1)>radius).all()
            assert np.max(abs(land.sample(places[:,[0,2]])[0]-places[:,1]-.12))<.02
            plant_total+=len(places)
        if role=='river':
            stations=pts.reshape(-1,9,3);levels=stations[:,4,1]
            assert np.all(np.diff(levels)<=0) and levels[-1]==SEA
            clearance=levels-land.sample(stations[:,4][:,[0,2]])[0]
            assert np.isfinite(clearance).all() and clearance.min()>0,(pos,clearance.min())
            t=next(t for t in CELLS.values() if t['id']=='SV_E')
            src=GLB(source(t));vv=src.array(src.primitive('river_water')['attributes']['POSITION']).astype(float)
            boundary=vv[abs(vv[:,0]-A)<.02];boundary=boundary[np.argsort(boundary[:,2])]
            diff=boundary+[t['center_x'],0,t['center_z']]-stations[0]-[r['center_xz'][0],0,r['center_xz'][1]]
            assert np.linalg.norm(diff,axis=1).max()<.03
            # Compare exported roots with the banks of the exported water, in local coordinates.
            x=stations[:,4,0]
            assert np.all(np.diff(x)>0)
            submerged=0
            for plant in g.doc['nodes']:
                if plant['extras']['role']!='vegetation':continue
                transforms=plant['extensions']['EXT_mesh_gpu_instancing']['attributes']
                px,_,pz=g.array(transforms['TRANSLATION']).T
                lower=np.interp(px,x,stations[:,:,2].min(1))
                upper=np.interp(px,x,stations[:,:,2].max(1))
                submerged+=int(np.count_nonzero((px>=x[0])&(px<=x[-1])&(pz>=lower)&(pz<=upper)))
            assert submerged==0
            river_check=dict(stations=len(levels),start_y=float(levels[0]),end_y=float(levels[-1]),min_bed_clearance_m=float(clearance.min()),contact_error_m=float(np.linalg.norm(diff,axis=1).max()),plant_roots_in_channel=submerged)
for rec in PLAN['boundary']:
    pos=rec['q'],rec['r'];t=CELLS[pos];g=GLB(source(t));assert g.sha==rec['sha256']
    pr=surface(g,t);read_edges(pos,g.array(pr['attributes']['POSITION']).astype(float),colors(g,pr),'original')
shelf=GLB(ROOT/'viewer/continente/plataforma.glb')
for pos in shelf_cells:
    pr=shelf.primitive('Shelf_%+d_%+d'%pos)
    v=shelf.array(pr['attributes']['POSITION']).astype(float);c=center(*pos);v[:,[0,2]]-=c
    read_edges(pos,v,colors(shelf,pr),'plataforma')
for (pos,side),(vs,col,tag) in parts.items():
    dq,dr=DIR[side];nb=pos[0]+dq,pos[1]+dr
    if nb<pos or (tag=='original' and nb in CELLS):continue
    other=parts.get((nb,(side+3)%6))
    if not other:continue
    p,c,ot=other;kind='/'.join(sorted([tag,ot]))
    assert len(vs)==len(p),(pos,nb)
    delta=vs-p[::-1];dist=float(np.linalg.norm(delta,axis=1).max())
    assert dist<.03,(pos,nb,dist)
    measure[kind].append(dict(a=list(pos),b=list(nb),knots=len(p),height_m=float(abs(delta[:,1]).max()),distance_m=dist,linear_rgb_delta=float(np.abs(col-c[::-1]).max())))
assert len(measure['litoral/original'])==148 and river_check
assert len(measure['litoral/litoral'])==sum((q+d,r+e) in SLOTS for q,r in SLOTS for d,e in DIR)//2
summary={k:dict(edges=len(es),pairs=sum(v['knots'] for v in es),max_height_m=max(v['height_m'] for v in es),max_distance_m=max(v['distance_m'] for v in es),max_linear_rgb_delta=max(v['linear_rgb_delta'] for v in es)) for k,es in measure.items()}
dump(ROOT/'tests/continente.json',dict(summary=summary,river=river_check,verified_locked_coastal=5,verified_locked_continental=71,
    new_solid_components=intersections,new_plant_instances=plant_total,contacts=measure))
print(summary,river_check)
