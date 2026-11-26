"""Continue above-water tips of locked pilot boundaries into ocean-side hexes."""
import numpy as np
from scipy.interpolate import LinearNDInterpolator
from scipy.spatial import Delaunay
from perimeter import A, CELLS, CORNERS, DIR, SEA, ROOT, GLB, center, knots, colors
from ring import SLOTS, NORMALS, smooth
from forest import Writer

def build_shelf(records,bath,lo,res):
    rows={(r['q'],r['r']):r for r in records};edges=[];wet_cells=set()
    for pos,row in rows.items():
        g=GLB(ROOT/row['model']);pr=g.primitive('terrain')
        v=g.array(pr['attributes']['POSITION']);col=colors(g,pr);c=center(*pos)
        for i,(dq,dr) in enumerate(DIR):
            dest=pos[0]+dq,pos[1]+dr
            if dest in rows or dest in CELLS:continue
            a,b=CORNERS[[i,(i+1)%6]];axis=(b-a)/2500
            ids=knots(v,a,b)
            s=(v[ids][:,[0,2]]-a)@axis
            edges.append((a+c,b+c,axis,s,v[ids,1],col[ids]))
            if v[ids,1].max()>SEA-22:wet_cells.add(dest)
    w=Writer();written=[]
    for pos in sorted(wet_cells):
        c=center(*pos)
        ring=np.vstack([a+(b-a)*np.arange(72)[:,None]/72 for a,b in zip(CORNERS,np.roll(CORNERS,-1,axis=0))])
        x,z=np.meshgrid(np.arange(-2380,2381,67),np.arange(-2380,2381,67));grid=np.column_stack([x.ravel(),z.ravel()])
        p=np.vstack([ring,grid[(grid@NORMALS.T).max(1)<A-35]])
        world=p+c;weight=np.zeros(len(p));val=np.zeros((len(p),4));nearest=np.full(len(p),99999.)
        for a,b,axis,s,y,rgb in edges:
            if np.linalg.norm((a+b)/2-c)>5800:continue
            t=np.clip((world-a)@axis,0,2500);d=np.linalg.norm(world-a-t[:,None]*axis,axis=1)
            influence=smooth(1-d/1750)/np.maximum(.001,d)**3
            height=np.interp(t,s,y)
            offset=425+95*np.sin(world[:,0]/480+world[:,1]/615)
            fade=smooth(d/offset)
            level=(1-fade)*height+fade*(SEA-150)
            color=np.column_stack([np.interp(t,s,rgb[:,j]) for j in range(3)])
            val+=influence[:,None]*np.column_stack([level,color])
            weight+=influence;nearest=np.minimum(nearest,d)
        data=val/np.maximum(1e-20,weight[:,None]);data[weight==0]=[SEA-150,.07,.11,.1]
        v=np.column_stack([world[:,0],data[:,0],world[:,1]])
        tri=Delaunay(p).simplices[:,::-1];abc=v[tri]
        tri=tri[np.cross(abc[:,1]-abc[:,0],abc[:,2]-abc[:,0])[:,1]>.002]
        name='Shelf_%+d_%+d'%pos
        m=w.mesh(name,v,tri,data[:,1:]);w.node(name=name,mesh=m,extras={'role':'ocean_shelf'})
        # The same global depth image drives the breakers over the apron and the main ring.
        footprint=((c-lo)/res).astype(int)
        x,z=np.meshgrid(np.arange(footprint[0]-51,footprint[0]+52),np.arange(footprint[1]-51,footprint[1]+52))
        ij=np.column_stack([x.ravel(),z.ravel()])
        ij=ij[(ij>=0).all(1)&(ij[:,0]<bath.shape[1])&(ij[:,1]<bath.shape[0])]
        xy=lo+(ij+.5)*res-c;mask=(xy@NORMALS.T).max(1)<A
        h=LinearNDInterpolator(p,data[:,0])(xy[mask]);ids=ij[mask]
        bath[ids[:,1],ids[:,0],0]=255-np.nan_to_num(np.maximum(0,SEA-h),nan=245).clip(0,255).astype('uint8')
        bath[ids[:,1],ids[:,0],1]=255
        written.append([int(pos[0]),int(pos[1])])
    w.save(ROOT/'viewer/continente/plataforma.glb')
    return written
