"""Bake the original massif relief and albedo onto local-coordinate game terrains."""
from functools import lru_cache
import numpy as np
from scipy.interpolate import LinearNDInterpolator
from scipy.spatial import cKDTree, Delaunay
from perimeter import ROOT, GLB, CELLS, CORNERS, DIR, center, colors, knots, source, surface, dump
from forest import Writer

holes = {(2,-2),(3,-2)}
forest_tip=(3,-3)  # FX_12, directly north of the shared terminal corner
corridor = holes | {forest_tip,(1,-1),(1,0),(0,2),(1,2),(1,1),(2,0),(2,-1),(2,1),(3,0),(3,-1)}
folder = ROOT/'models/cordilheira'

@lru_cache(None)
def terrain(pos):
    tile=CELLS[pos]
    glb=GLB(source(tile))
    pr=surface(glb,tile)
    v=glb.array(pr['attributes']['POSITION']).astype(float)
    return v,colors(glb,pr),glb.array(pr['indices']).reshape(-1,3)

def smooth(t):
    t=np.clip(t,0,1)
    return t*t*(3-2*t)

def donor_strip():
    # The neighbouring massif in the continental viewer uses this authored atlas.
    # Sample its actual triangles and vertex albedo together, without a nearest-point blur.
    from matplotlib.tri import Triangulation, LinearTriInterpolator
    from perimeter import WORLD
    atlas=GLB(WORLD/'world-visual-coherence-v12/models/world_170_v12.glb')
    surfaces=[]
    for pos,tile in CELLS.items():
        if not tile['id'].startswith(('MW_','MN2_')) or center(*pos)[1]>12500:
            continue
        pr=atlas.primitive(tile['id']+'__terrain')
        v=atlas.array(pr['attributes']['POSITION']).astype(float)
        f=atlas.array(pr['indices']).reshape(-1,3)
        tri=Triangulation(v[:,0],v[:,2],f[:,::-1])
        attrs=np.column_stack([v[:,1],colors(atlas,pr)])
        surfaces.append([LinearTriInterpolator(tri,values) for values in attrs.T])
    return surfaces

def build():
    folder.mkdir(exist_ok=True)
    samples=[]
    edges=[]
    for q,r in corridor:
        for i,(dq,dr) in enumerate(DIR):
            near=q+dq,r+dr
            if near not in corridor:
                edges.append(CORNERS[[i,(i+1)%6]]+center(q,r))
            if (q,r) in holes and near in CELLS:
                v,c,_=terrain(near)
                ids=knots(v,*CORNERS[[(i+3)%6,(i+4)%6]])
                samples.append(np.column_stack([v[ids][:,[0,2]]+center(*near),v[ids,1],c[ids]]))
    rim=np.vstack(samples)
    base=LinearNDInterpolator(rim[:,:2],rim[:,2:])
    nearest=cKDTree(rim[:,:2])
    surfaces=donor_strip()
    records=[]
    for pos in sorted(corridor):
        v,col,f=terrain((1,1) if pos in holes else pos)
        # A uniform interior resolves gullies crossing the long radial faces of the desert tiles.
        rim_ids=np.concatenate([knots(v,*CORNERS[[i,(i+1)%6]])[:-1] for i in range(6)])
        rim_xz=v[rim_ids][:,[0,2]]
        gx,gz=np.meshgrid(np.arange(-2200,2201,48),np.arange(-2500,2501,48))
        grid=np.column_stack([gx.ravel(),gz.ravel()])
        normals=(CORNERS+np.roll(CORNERS,-1,axis=0))
        normals/=np.linalg.norm(normals,axis=1)[:,None]
        grid=grid[(grid@normals.T).max(1)<2165-20]
        inside=LinearNDInterpolator(v[:,[0,2]],np.column_stack([v[:,1],col]))(grid)
        assert np.isfinite(inside).all()
        p=np.vstack([rim_xz,grid])
        col=np.vstack([col[rim_ids],inside[:,1:]])
        v=np.column_stack([p[:,0],np.r_[v[rim_ids,1],inside[:,0]],p[:,1]])
        f=Delaunay(p).simplices[:,::-1]
        tri=v[f]
        f=f[np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0])[:,1]>.02]
        world=v[:,[0,2]]+center(*pos)
        x,z=world.T
        if pos in holes:
            values=base(world)
            distance,index=nearest.query(world)
            rim_points=(distance<.02)|~np.isfinite(values[:,0])
            values[rim_points]=rim[index[rim_points],2:]
            v[:,1],col=values[:,0],values[:,1:]
        axis=np.interp(z,[-10000,-7500,-4300,-1600,750,3600,7500],
                         [6480,6500,6570,7270,7510,6500,6300])
        # Reuse adjacent grey-rock faces, with their ridges, ravines and asymmetric toes.
        # Folding a reflection through the two source rows preserves continuity at the turns.
        travel=np.maximum(0,7900-z)
        sample_z=7300+5100-np.abs(np.mod(travel,10200)-5100)
        offset=x-axis
        # The desert-facing buttress projects from the western slope between the peaks.
        buttress=1450*np.exp(-((z+3100-.34*offset)/1550)**2)*smooth(-offset/1250)
        source_axis=np.interp(sample_z,[7300,9000,11250,12400],[6500,7030,8330,8160])
        sample_x=source_axis+offset+buttress
        rock=np.column_stack([v[:,1],col])
        valid=np.zeros(len(v),bool)
        for fields in surfaces:
            y=fields[0](sample_x,sample_z)
            inside=~np.ma.getmaskarray(y)
            if inside.any():
                rock[inside,0]=y.data[inside]
                for j,field in enumerate(fields[1:],1):
                    rock[inside,j]=field(sample_x[inside],sample_z[inside])
                valid|=inside
        clearance=np.full(len(v),np.inf)
        for start,end in edges:
            vec=end-start
            rel=world-start
            t=np.clip(rel@vec/(vec@vec),0,1)
            clearance=np.minimum(clearance,np.linalg.norm(rel-t[:,None]*vec,axis=1))
        donor_margin=np.maximum(0,4000-abs(sample_x-source_axis))
        weight=smooth(donor_margin/950)*smooth((clearance-.02)/1250)*smooth((8200-z)/2400)*smooth((z+9900)/2050)*smooth((4200-abs(offset+buttress))/1300)*valid
        # Carry a low rock spur into the eastern terminal hex, alongside the forest rim.
        # The shared corner of the terminal pair lies south of this rim.
        if pos in holes:
            run=np.clip((-z-7650)/1750,0,1)
            spine=6550+1040*run
            flank=smooth(1-abs(x-spine)/(1250-490*run))
            toe=flank*smooth((-z-7550)/620)*smooth((z+9800)/750)
            toe*=smooth((clearance-.02)/240)*valid
            weight=np.maximum(weight,toe*(.90-.42*run))
        bed=v[:,1].copy()
        uplift=np.maximum(0,rock[:,0]-bed)
        v[:,1]+=uplift*weight
        blend=(weight*smooth(uplift/180))[:,None]
        col=col*(1-blend)+rock[:,1:]*blend
        if pos in holes or pos==forest_tip:
            run=np.clip((-z-8000)/3650,0,1)
            spine=6710+470*np.sin(run*np.pi)
            flank=smooth(1-abs(x-spine)/(1540-480*run))
            spur=flank*smooth((-z-7000)/1400)*(1-smooth(run))
            spur*=smooth((clearance-.02)/500)
            # A long descending shoulder crosses the former border into the forest.
            v[:,1]=np.maximum(v[:,1],bed+2170*spur)
            pigment=smooth(spur/.19)*smooth((-z-6950)/800)
            stone=np.tile([.207,.176,.140],(len(v),1))
            for fields in surfaces:
                sx=source_axis+.32*(x-spine)
                tone=fields[1](sx,sample_z)
                ids=~np.ma.getmaskarray(tone)
                for j,field in enumerate(fields[1:]):
                    stone[ids,j]=field(sx[ids],sample_z[ids])
            col+=pigment[:,None]*(stone-col)
        name=CELLS[pos]['id'] if pos in CELLS else 'Serra_%d_%d'%pos
        w=Writer()
        w.d['asset']['generator']='Wildhaven | Cordilheira'
        if pos==forest_tip:
            # Retain the original forest objects around the new rocky footprint.
            forest=GLB(source(CELLS[pos]))
            w.d=forest.doc
            w.bin=bytearray(forest.bin)
            old_mesh=next(n['mesh'] for n in w.d['nodes'] if n['name']=='terrain')
            mesh=w.mesh('terrain',v,f,col)
            w.d['meshes'][mesh]['primitives'][0]['material']=w.d['meshes'][old_mesh]['primitives'][0].get('material',0)
            w.d['meshes'][old_mesh]=w.d['meshes'].pop()
        else:
            mesh=w.mesh('terrain',v,f,col)
            w.node(name='terrain',mesh=mesh,extras={'tileId':name})
        file=folder/(name+'.glb')
        w.save(file)
        cx,cz=center(*pos)
        records.append(dict(id=name,q=pos[0],r=pos[1],center_x=cx,center_z=cz,
                            model_path='world/coast-v01/models/cordilheira/'+file.name,
                            model_url='/world/coast-v01/models/cordilheira/'+file.name,sha256=GLB(file).sha,
                            replaces=name if pos in CELLS else None))
    dump(folder/'composition.json',dict(scale_m=5000,tile_count=len(records),tiles=records))

if __name__=='__main__':
    build()
