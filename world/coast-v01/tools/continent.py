"""Build the 72 exterior tiles plus the lightweight, all-continent shoreline view."""
import hashlib
from functools import lru_cache
import numpy as np
from scipy.interpolate import LinearNDInterpolator
from scipy.spatial import Delaunay
from PIL import Image
from build import Writer, material, uv_attribute, add_mesh, arch, rock
from ring import *
from perimeter import WORLD
from glb import dump

DEST=ROOT/'models/continente'
OVERVIEW=ROOT/'viewer/continente'
def triangles(g,pr):return g.array(pr['indices']).reshape(-1,3)
def stats(path,g):
    vertices=faces=drawn=0
    for n in g.doc['nodes']:
        if 'mesh' not in n:continue
        assembly=n.get('extensions',{}).get('EXT_mesh_gpu_instancing',{}).get('attributes',{})
        count=g.doc['accessors'][assembly['TRANSLATION']]['count'] if assembly else 1
        for p in g.doc['meshes'][n['mesh']]['primitives']:
            vertices+=g.doc['accessors'][p['attributes']['POSITION']]['count']
            t=g.doc['accessors'][p['indices']]['count']//3;faces+=t;drawn+=t*count
    return dict(sha256=g.sha,bytes=path.stat().st_size,vertices=vertices,triangles=faces,triangles_with_instances=drawn)

@lru_cache(maxsize=None)
def plants(style):
    source_kind={'jungle':'falesia','swamp':'falesia','temperate':'praia','plains':'arcos','savanna':'arcos'}[style]
    path=PILOT_FILES[source_kind]
    if style=='swamp':path=WORLD/'tropical-south-v01/vegetation/PT_+3_13.glb'
    g=GLB(path);result=[]
    for n in g.doc['nodes']:
        if 'EXT_mesh_gpu_instancing' not in n.get('extensions',{}):continue
        name=n['name']
        if style=='swamp' and not name.startswith(('Figueira','Arbusto','Juncos','Dossel')):continue
        pr=g.doc['meshes'][n['mesh']]['primitives'][0];at=pr['attributes']
        result.append((name,g.array(at['POSITION']).astype(float),triangles(g,pr),g.array(at['COLOR_0'])[:,:3]))
    return result

def decorate(w,slot,v,f,sample,rng,mat,ring):
    kind=slot['kind'];biomes=' '.join(e['biome'].lower() for e in slot['contacts'])
    xy=v[:,[0,2]];inside=A-(xy@NORMALS.T).max(1)
    def in_channel(xz,clearance):
        world=xz+slot['center_xz'];run=world[...,0]-ring.mouth[0]
        z,width,_=ring.channel(run)
        return (abs(world[...,1]-z)<width+clearance)&(run>=-clearance)&(run<=3050+clearance)
    shore=np.flatnonzero((v[:,1]<SEA-5)&(v[:,1]>SEA-135)&(inside>165))
    occupied=[];parts=[];landforms=0
    def solid(shape,p,is_ice):
        nonlocal landforms
        vs,fs,cs=shape;radius=np.linalg.norm(vs[:,[0,2]],axis=1).max()
        if in_channel(p,radius+8):return False
        if (p@NORMALS.T).max()+radius>A-8:return False
        if any(np.linalg.norm(p-other)<radius+rr for other,rr in occupied):return False
        xz=p+vs[:,[0,2]];alt=sample(xz)
        if not np.isfinite(alt).all():return False
        if is_ice:
            base=SEA-.43*np.ptp(vs[:,1])
            if base<alt.max()+2:return False
        else:
            foot=vs[:,1]<np.percentile(vs[:,1],25)+.1
            base=alt[foot].min()-5
            if (vs[:,1]+base-alt).max()<7:return False
        vs=vs.copy();vs[:,[0,2]]=xz;vs[:,1]+=base
        occupied.append((p,radius));parts.append((vs,fs,cs));landforms+=1;return True
    if kind in ('arcos','falesia'):
        for attempt in rng.permutation(shore)[:130]:
            p=xy[attempt];span=rng.uniform(210,535);height=rng.uniform(140,295)
            shape=arch(rng,span,height,rng.uniform(44,87))
            # Align along the local isobath.
            grad=np.array([float(sample((p+[20,0])[None])[0]-sample((p-[20,0])[None])[0]),float(sample((p+[0,20])[None])[0]-sample((p-[0,20])[None])[0])])
            theta=np.arctan2(grad[0],-grad[1])
            cs,sn=np.cos(theta),np.sin(theta);shape[0][:,[0,2]]=shape[0][:,[0,2]]@np.array([[cs,-sn],[sn,cs]])
            solid(shape,p,False)
            if landforms>=(2 if kind=='arcos' else 1):break
    for j in rng.permutation(shore)[:120]:
        size=rng.uniform(16,97);cold=kind=='glacial'
        solid(rock(rng,size,size*rng.uniform(.52,1.35),size*rng.uniform(.62,2.1)+(65 if kind in ('arcos','falesia') else 0),cold),xy[j],cold)
        if landforms>={'praia':10,'falesia':27,'arcos':25,'glacial':32,'dunas':11}[kind]:break
    if parts:
        vv=np.vstack([s[0] for s in parts]);offset=0;ff=[]
        for pts,faces,_ in parts:ff.append(faces+offset);offset+=len(pts)
        add_mesh(w,'Formações costeiras',vv,np.vstack(ff),np.vstack([s[2] for s in parts]),np.column_stack([(vv[:,0]+.29*vv[:,2])/150,vv[:,1]/93]),mat,'ice' if kind=='glacial' else 'rock')
    if kind in ('glacial','dunas'):return landforms,0
    style='swamp' if 'swamp' in biomes else 'jungle' if 'jungle' in biomes or 'tropical rocky' in biomes else 'savanna' if 'savanna' in biomes else 'plains' if 'plains' in biomes else 'temperate'
    prototypes=plants(style)
    points=rng.uniform(-2500,2500,({'jungle':3650,'swamp':2900,'temperate':1700,'plains':990,'savanna':1280}[style],2))
    points=points[(points@NORMALS.T).max(1)<A-80]
    h=sample(points);slope=np.hypot(sample(points+[3,0])-h,sample(points+[0,3])-h)/3
    take=(h>SEA+(22 if style=='swamp' else 56))&(slope<.65)&~in_channel(points,32)
    points=points[take];h=h[take];assigned=rng.integers(len(prototypes),size=len(h));instances=0
    ext='EXT_mesh_gpu_instancing'
    for i,(name,pv,pf,pc) in enumerate(prototypes):
        ids=np.flatnonzero(assigned==i);scale=rng.uniform(.73,1.12,len(ids))
        keep=A-(points[ids]@NORMALS.T).max(1)>scale*np.linalg.norm(pv[:,[0,2]],axis=1).max()+1
        ids=ids[keep];scale=scale[keep];n=len(ids)
        if not n:continue
        rot=rng.uniform(0,np.pi,n);p=points[ids]
        mesh=w.mesh(name,pv,pf,pc);pr=w.d['meshes'][mesh]['primitives'][0]
        pr['attributes']['TEXCOORD_0']=uv_attribute(w,pv[:,[0,2]]/48)
        at=dict(TRANSLATION=w.acc(np.column_stack([p[:,0],h[ids]-.12,p[:,1]]).astype('<f4'),5126,bounds=True),
            ROTATION=w.acc(np.column_stack([np.zeros(n),np.sin(rot),np.zeros(n),np.cos(rot)]).astype('<f4'),5126),
            SCALE=w.acc(np.repeat(scale[:,None],3,axis=1).astype('<f4'),5126))
        w.node(name=name,mesh=mesh,extensions={ext:{'attributes':at}},extras={'role':'vegetation'})
        instances+=n
    if instances:w.d.update(extensionsRequired=[ext],extensionsUsed=[ext])
    return landforms,instances

def river_mesh(w,ring,c):
    # Open upstream row exactly matches all nine water knots on SV_E's eastern face.
    run=np.arange(0,3051,25);z,half,y=ring.channel(run)
    offsets=np.linspace(-1,1,9)
    v=np.column_stack([np.repeat(ring.mouth[0]+run-c[0],9),np.repeat(y,9),(z[:,None]+half[:,None]*offsets-c[1]).ravel()])
    faces=[]
    for i in range(len(run)-1):
        for j in range(8):
            a=9*i+j;faces.extend([[a,a+1,a+9],[a+1,a+10,a+9]])
    c=np.tile([.039,.224,.227],(len(v),1))
    m=w.mesh('Foz SV_E',v,np.array(faces),c);pr=w.d['meshes'][m]['primitives'][0]
    pr['attributes']['TEXCOORD_0']=uv_attribute(w,v[:,[0,2]]/125)
    w.node(name='Foz SV_E',mesh=m,extras={'role':'river','receivingLevel':SEA})

def make_tile(ring,pos,slot):
    c=center(*pos);p,f=ring.points(pos);data=ring.field(pos,p)
    v=np.column_stack([p[:,0],data[:,0],p[:,1]]);col=data[:,1:].clip(0,1)
    w=Writer();w.d['asset']['generator']='Wildhaven | Litoral continental'
    kind=slot['kind'];rng=np.random.default_rng(91271+97*pos[0]+1361*pos[1])
    y,x=np.mgrid[:128,:128]
    # Neutral at the technical border. Fine markings vary by substrate; vertex albedo carries the biome.
    phase=rng.random()*6.28;noise=rng.normal(0,.9,x.shape)
    relief=np.sin(x*.62+y*.16+np.sin(y/19)+phase) if kind=='dunas' else np.cos(y*.48+np.sin(x/12)+phase)
    strength={'glacial':4,'arcos':7,'dunas':2,'praia':3,'falesia':6}[kind]
    texel=(np.column_stack([x.ravel(),y.ravel()])+.5)*5000/128-2500
    margin=(A-(texel@NORMALS.T).max(1)).reshape(x.shape)
    detail=255+smooth((margin-60)/100)*(-4+noise+strength*relief)
    texture=material(w,kind,np.clip(detail,0,255).astype('uint8'))
    add_mesh(w,'terrain',v,f,col,(p+2500)/5000,texture,'terrain')
    sampler=LinearNDInterpolator(p,v[:,1])
    forms,instances=decorate(w,slot,v,f,sampler,rng,texture,ring)
    if pos==(5,5):river_mesh(w,ring,c)
    path=DEST/(tile_id(pos)+'.glb');w.save(path)
    return path,forms,instances

def main():
    DEST.mkdir(parents=True,exist_ok=True);OVERVIEW.mkdir(parents=True,exist_ok=True)
    ring=Ring();records=[];overview=Writer()
    # Metres to the centre of each image pixel. The packed global bathymetry does not repeat at tile boundaries.
    res=52.;centers=np.array([center(*pos) for pos in SLOTS])
    lo=np.floor((centers.min(0)-3200)/res)*res
    dims=np.ceil((centers.max(0)+3200-lo)/res).astype(int)
    pixels=np.zeros((dims[1],dims[0],3),dtype='uint8')
    for pos,slot in SLOTS.items():
        name=tile_id(pos);c=center(*pos);pil=slot['pilot']
        if pil:path=PILOT_FILES[pil];forms=instances=None
        else:path,forms,instances=make_tile(ring,pos,slot)
        g=GLB(path);pr=g.primitive('terrain');v=g.array(pr['attributes']['POSITION']).astype(float)
        col=rgb(g,pr);xz=v[:,[0,2]]
        # Overview keeps the complete contact loop; interior is decimated on a 165 m grid.
        boundary=np.abs((xz@NORMALS.T).max(1)-A)<.014
        ids=np.unique(np.r_[np.where(boundary)[0],np.unique(np.floor(xz/165),axis=0,return_index=True)[1]])
        f=Delaunay(xz[ids]).simplices[:,::-1];wv=v[ids].copy();wv[:,[0,2]]+=c
        tri=wv[f];f=f[np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0])[:,1]>.01]
        m=overview.mesh(name,wv,f,col[ids]);overview.node(name=name,mesh=m,extras={'tileId':name})
        footprint=((c-lo)/res).astype(int);ii=np.arange(footprint[0]-52,footprint[0]+53);jj=np.arange(footprint[1]-52,footprint[1]+53)
        xx,zz=np.meshgrid(ii,jj);xy=np.column_stack([xx.ravel(),zz.ravel()])*res+lo+res/2-c
        mask=(xy@NORMALS.T).max(1)<A
        h=LinearNDInterpolator(xz,v[:,1])(xy[mask])
        depth=np.nan_to_num(np.maximum(0,SEA-h),nan=245).clip(0,255)
        pixels[zz.ravel()[mask],xx.ravel()[mask],0]=255-depth.astype('uint8')
        pixels[zz.ravel()[mask],xx.ravel()[mask],1]=255
        records.append(dict(id=name,q=pos[0],r=pos[1],center_xz=c.tolist(),kind=slot['kind'],model=str(path.relative_to(ROOT)).replace(chr(92),'/'),
            approved_pilot=bool(pil),biomes=sorted({e['biome'] for e in slot['contacts']}),contacts=[e['source'] for e in slot['contacts']],**stats(path,g)))
        print(name,flush=True)
    overview.save(OVERVIEW/'litoral.glb')
    from shelf import build_shelf
    shelves=build_shelf(records,pixels,lo,res)
    for pos in list(CELLS)+[tuple(p) for p in PLAN['inland_voids']]:
        c=center(*pos);ix,iz=((c-lo)/res).astype(int)
        xx,zz=np.meshgrid(np.arange(ix-49,ix+50),np.arange(iz-49,iz+50))
        p=np.column_stack([xx.ravel(),zz.ravel()])*res+lo+res/2-c
        mask=(p@NORMALS.T).max(1)<A
        pixels[zz.ravel()[mask],xx.ravel()[mask],2]=255
    Image.fromarray(pixels).save(OVERVIEW/'bath.png')
    dump(OVERVIEW/'composition.json',dict(original=195,total=272,sea_m=SEA,shelf_cells=shelves,bath_min_xz=lo.tolist(),bath_size_xz=(dims*res).tolist(),tiles=records))
if __name__=='__main__':main()
